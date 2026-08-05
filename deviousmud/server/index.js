/**
 * DeviousMud game server.
 *
 * One process serves three things:
 *   1. the static client (HTML/CSS/JS),
 *   2. a small JSON status API,
 *   3. the authoritative game world over WebSocket.
 *
 * Run it with `npm start`. No dependencies, no build step.
 */

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROTOCOL_VERSION, TICK_MS, GAME_NAME } from '../shared/constants.js';
import { buildWorld } from '../shared/world.js';
import { Game } from '../shared/engine/game.js';
import { sanitizeAppearance } from '../shared/appearance.js';
import { AccountStore, validateName } from './accounts.js';
import { attachWebSocketServer } from './websocket.js';
import { createStaticHandler } from './static.js';
import { ChatGuard, ModerationStore, REPORT_REASONS, describePenalty, isReservedName } from './moderation.js';
import { ConnectionLimiter, LIMITS, LoginThrottle, SlidingWindow, normaliseAddress } from './limits.js';
import { isCommand, loginRefusalMessage, runCommand } from './commands.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_FILE = process.env.DM_DATA || path.join(projectRoot, 'server', 'data', 'accounts.json');
const AUTOSAVE_TICKS = Math.round(30000 / TICK_MS);
const MAX_PLAYERS = Number(process.env.DM_MAX_PLAYERS || 200);
const DATA_DIR = path.dirname(DATA_FILE);

const accounts = new AccountStore(DATA_FILE);
const world = buildWorld();
const game = new Game({ world });

// Moderators are named at boot: DM_ADMINS="Zach,Rowan". They can then promote
// others in game with /mod, which persists.
const moderation = new ModerationStore({
  dir: DATA_DIR,
  admins: String(process.env.DM_ADMINS || '').split(',').map((n) => n.trim()).filter(Boolean)
});
const chatGuard = new ChatGuard();
const connections = new ConnectionLimiter();
const loginThrottle = new LoginThrottle();
const registrations = new SlidingWindow(60 * 60_000, LIMITS.registrationsPerHour);
const inviteLimit = new SlidingWindow(60_000, LIMITS.partyInvitesPerMinute);

/** connectionId -> { conn, playerId, name, isGuest, commandBudget } */
const sessions = new Map();
const playerSessions = new Map();
let nextConnectionId = 1;
const startedAt = Date.now();

const serveStatic = createStaticHandler({ root: projectRoot, index: '/client/index.html' });

const httpServer = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    // The client uses relative module imports, so it must be served from its
    // own directory rather than from the site root.
    if (url.pathname === '/' || url.pathname === '/client') {
      res.writeHead(302, { Location: '/client/', 'Cache-Control': 'no-store' });
      res.end();
      return;
    }

    if (url.pathname === '/api/status') {
      const body = JSON.stringify({
        game: GAME_NAME,
        protocol: PROTOCOL_VERSION,
        online: playerSessions.size,
        maxPlayers: MAX_PLAYERS,
        tick: game.tickCount,
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        worldChecksum: world.checksum,
        moderated: moderation.stats().admins > 0,
        chatLogged: moderation.keepChatLog
      });
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        // Public, read-only status. Packaged clients (the Android WebView shell,
        // a page opened from disk) live on a different origin and must be able
        // to ask whether this server is up before offering multiplayer.
        'Access-Control-Allow-Origin': '*'
      });
      res.end(body);
      return;
    }
    const served = await serveStatic(req, res);
    if (!served) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  } catch (err) {
    console.error('[http]', err);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal error');
  }
});

attachWebSocketServer(httpServer, { path: '/ws', onConnection: handleConnection });

function handleConnection(conn) {
  const id = `c${nextConnectionId += 1}`;
  const address = normaliseAddress(conn.remoteAddress);

  // One address may only hold so many sockets open at once.
  if (!connections.add(address)) {
    conn.sendJson({ t: 'authError', reason: 'Too many connections from your network. Close a tab and try again.' });
    conn.close(1008, 'Connection limit');
    return;
  }

  const session = {
    id,
    conn,
    address,
    playerId: null,
    name: null,
    isGuest: false,
    commands: 0,
    windowStart: Date.now(),
    lastActive: Date.now(),
    connectedAt: Date.now()
  };
  sessions.set(id, session);

  conn.sendJson({
    t: 'hello',
    protocol: PROTOCOL_VERSION,
    online: playerSessions.size,
    motd: 'Welcome to Emberfall. Be kind, explore everything.',
    reportReasons: REPORT_REASONS
  });

  conn.on('message', (raw) => {
    session.lastActive = Date.now();
    if (!rateLimit(session)) {
      conn.close(1008, 'Slow down');
      return;
    }
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'auth') {
      handleAuth(session, msg).catch((err) => {
        console.error('[auth]', err);
        conn.sendJson({ t: 'authError', reason: 'Something went wrong signing in.' });
      });
      return;
    }
    if (msg.t === 'ping') {
      conn.sendJson({ t: 'pong', time: msg.time });
      return;
    }
    if (!session.playerId) return;
    if (msg.t === 'logout') {
      disconnect(session, 'You have been logged out.');
      return;
    }
    if (msg.t === 'report') {
      handleReport(session, msg).catch((err) => console.error('[report]', err));
      return;
    }
    if (msg.t === 'chat') {
      if (!handleChat(session, msg)) return;
    }
    if (msg.t === 'party' && msg.op === 'invite' && !inviteLimit.hit(session.name)) {
      reply(session, 'You are sending invitations very quickly. Give people a moment to answer.');
      return;
    }
    game.handle(session.playerId, msg);
    flushOutbox();
  });

  conn.on('error', (err) => {
    // Reset connections are routine (closed tab, flaky mobile network).
    if (err.code !== 'ECONNRESET') console.warn('[ws]', err.message);
  });

  conn.on('close', () => {
    disconnect(session);
    sessions.delete(id);
    connections.remove(address);
  });
}

function rateLimit(session) {
  const now = Date.now();
  if (now - session.windowStart > 1000) {
    session.windowStart = now;
    session.commands = 0;
  }
  session.commands += 1;
  // A connection that has not logged in has nothing useful to send but `auth`
  // and `ping`, so it gets a much smaller budget.
  const budget = session.playerId ? LIMITS.commandsPerSecond : LIMITS.preAuthCommandsPerSecond;
  return session.commands <= budget;
}

/**
 * Public chat: checked for mutes and flooding before the engine broadcasts it,
 * and recorded so a later report has context. Slash commands are handled here
 * and never reach the engine.
 *
 * @returns true when the message should continue on to the engine
 */
function handleChat(session, msg) {
  const text = String(msg.text || '').trim();
  if (!text) return false;

  if (isCommand(text)) {
    runCommand(text, commandContext(session)).catch((err) => {
      console.error('[command]', err);
      reply(session, 'That command went wrong. Please tell a moderator.');
    });
    return false;
  }

  const muted = moderation.muteStatus(session.name);
  if (muted) {
    reply(session, describePenalty(muted, 'muted'));
    return false;
  }

  const guard = chatGuard.check(session.name, text);
  if (!guard.ok) {
    // What someone tried to say is evidence as much as what got through.
    moderation.noteChat(session.name, text, 'blocked');
    const entry = moderation.mute(session.name, Math.ceil(LIMITS.chatAutoMuteSeconds / 60), `automatic: chat ${guard.reason}`, 'system');
    reply(session, `${guard.message} Chat is paused for a moment.`);
    console.log(`[mod] auto-mute target=${session.name} reason=${guard.reason}`);
    void entry;
    return false;
  }

  moderation.noteChat(session.name, text, msg.channel === 'party' ? 'party' : 'public');
  return true;
}

async function handleReport(session, msg) {
  const target = String(msg.target || '').trim();
  const reason = REPORT_REASONS.find((r) => r.id === msg.reason)?.id || 'other';
  if (!target) return;
  if (target.toLowerCase() === session.name.toLowerCase()) {
    reply(session, 'You cannot report yourself.');
    return;
  }
  const result = await moderation.addReport({
    reporter: session.name,
    target,
    reason,
    note: msg.note
  });
  reply(
    session,
    result.ok
      ? `Thank you. A moderator will read your report about ${target}. You did the right thing telling someone.`
      : result.reason
  );
  if (result.ok) notifyModerators(`New report from ${session.name} about ${target} (${reason}).`);
}

function reply(session, text, channel = 'system') {
  session.conn.sendJson({ t: 'msg', text, channel });
}

function commandContext(session) {
  return {
    session,
    moderation,
    reply: (text, channel) => reply(session, text, channel),
    announce: (text) => {
      for (const other of playerSessions.values()) reply(other, text);
    },
    findSession: (name) => {
      const key = String(name || '').toLowerCase();
      return [...playerSessions.values()].find((s) => s.name.toLowerCase() === key) || null;
    },
    disconnect: (target, why) => disconnect(target, why),
    onlineNames: () => [...playerSessions.values()].map((s) => s.name),
    notifyModerators
  };
}

/** Tells every moderator who is online that something needs attention. */
function notifyModerators(text) {
  for (const session of playerSessions.values()) {
    if (moderation.isAdmin(session.name)) reply(session, text);
  }
}

async function handleAuth(session, msg) {
  if (session.playerId) return;
  if (playerSessions.size >= MAX_PLAYERS) {
    refuse(session, 'Emberfall is full right now. Try again shortly.');
    return;
  }

  const mode = String(msg.mode || 'guest');
  const appearance = sanitizeAppearance(msg.appearance);
  let name = String(msg.name || '').trim();
  let save = null;
  let isGuest = false;

  // Failed attempts are throttled by address and by account name, so neither
  // "one password against many accounts" nor "many passwords against one
  // account" gets far.
  const addressKey = `ip:${session.address}`;
  const nameKey = `name:${name.toLowerCase()}`;
  for (const throttleKey of [addressKey, nameKey]) {
    const wait = loginThrottle.blockedFor(throttleKey);
    if (wait > 0) {
      refuse(session, loginRefusalMessage(wait));
      return;
    }
  }

  // A ban is checked before anything else so a banned player cannot even see
  // whether a password was right.
  const preBan = moderation.banStatus(name);
  if (preBan) {
    refuse(session, describePenalty(preBan, 'banned'));
    return;
  }

  if (mode === 'register') {
    if (accounts.accounts.size >= LIMITS.maxAccounts) {
      refuse(session, 'This world is not taking new characters right now.');
      return;
    }
    if (!registrations.hit(session.address)) {
      refuse(session, 'That is a lot of new characters from one place. Please try again later.');
      return;
    }
    if (isReservedName(name)) {
      refuse(session, 'That name is reserved. Please pick another.');
      return;
    }
    const result = await accounts.register(name, String(msg.password || ''), appearance);
    if (!result.ok) {
      refuse(session, result.reason);
      return;
    }
    name = result.account.name;
    save = null;
  } else if (mode === 'login') {
    const result = await accounts.authenticate(name, String(msg.password || ''));
    if (!result.ok) {
      const wait = Math.max(loginThrottle.fail(addressKey), loginThrottle.fail(nameKey));
      refuse(session, wait > 0 ? loginRefusalMessage(wait) : result.reason);
      return;
    }
    loginThrottle.succeed(addressKey);
    loginThrottle.succeed(nameKey);
    name = result.account.name;
    save = result.account.save && result.account.save.skills ? result.account.save : null;
  } else {
    const check = validateName(name || 'Guest');
    if (!check.ok) {
      refuse(session, check.reason);
      return;
    }
    if (isReservedName(check.name)) {
      refuse(session, 'That name is reserved. Please pick another.');
      return;
    }
    name = check.name;
    isGuest = true;
  }

  // The resolved name may differ in case from what was typed.
  const ban = moderation.banStatus(name);
  if (ban) {
    refuse(session, describePenalty(ban, 'banned'));
    return;
  }

  // One live character per name.
  for (const other of playerSessions.values()) {
    if (other.name.toLowerCase() === name.toLowerCase()) {
      refuse(session, 'That character is already logged in.');
      return;
    }
  }

  const playerId = `p${session.id}`;
  session.playerId = playerId;
  session.name = name;
  session.isGuest = isGuest;
  playerSessions.set(playerId, session);

  game.addPlayer(playerId, { name, appearance, save });
  flushOutbox();

  const mute = moderation.muteStatus(name);
  if (mute) reply(session, describePenalty(mute, 'muted'));
  if (moderation.isAdmin(name)) reply(session, 'You are a moderator here. Type /help for your commands.');
  if (moderation.keepChatLog) {
    reply(session, 'Be kind: public chat is recorded so moderators can help. Type /report to tell us about a problem.');
  }

  console.log(`[login] ${name}${isGuest ? ' (guest)' : ''} from ${session.address} - ${playerSessions.size} online`);
}

function refuse(session, reason) {
  session.conn.sendJson({ t: 'authError', reason });
}

function disconnect(session, reason) {
  if (!session.playerId) return;
  const saved = game.removePlayer(session.playerId);
  if (saved && !session.isGuest) accounts.saveCharacter(session.name, saved);
  playerSessions.delete(session.playerId);
  session.playerId = null;
  flushOutbox();
  if (reason) session.conn.sendJson({ t: 'msg', text: reason, channel: 'system' });
  console.log(`[logout] ${session.name} - ${playerSessions.size} online`);
}

/** Batches every queued engine message into one frame per player. */
function flushOutbox() {
  const batches = new Map();
  for (const { to, msg } of game.drain()) {
    if (!batches.has(to)) batches.set(to, []);
    batches.get(to).push(msg);
  }
  for (const [playerId, messages] of batches) {
    const session = playerSessions.get(playerId);
    if (!session) continue;
    session.conn.sendJson({ t: 'batch', m: messages });
  }
}

function autosave() {
  for (const session of playerSessions.values()) {
    if (session.isGuest) continue;
    const player = game.players.get(session.playerId);
    if (player) accounts.saveCharacter(session.name, game.serializePlayer(player));
  }
}

let loopTimer = null;
let sweepTimer = null;

/** Disconnects sessions that have gone quiet, and ages out limiter state. */
function sweep() {
  const now = Date.now();
  for (const session of sessions.values()) {
    if (!session.playerId) {
      // A connection that never logs in is not allowed to sit there forever.
      if (now - session.connectedAt > LIMITS.preAuthTimeoutMs) {
        session.conn.close(1000, 'No sign in');
      }
      continue;
    }
    if (now - session.lastActive > LIMITS.idleTimeoutMs) {
      reply(session, 'You have been away a while, so we saved your character and signed you out.');
      disconnect(session, 'Idle');
      session.conn.close(1000, 'Idle');
    }
  }
  moderation.prune(now);
  loginThrottle.sweep(now);
  registrations.sweep(now);
  inviteLimit.sweep(now);
}

async function start() {
  const loaded = await accounts.load();
  console.log(`[data] ${loaded} account(s) loaded from ${DATA_FILE}`);
  const modStats = await moderation.load();
  console.log(`[data] moderation: ${modStats.mutes} mute(s), ${modStats.bans} ban(s), ${modStats.admins} moderator(s), chat log ${moderation.keepChatLog ? 'on' : 'off'}`);
  if (modStats.admins === 0) {
    console.log('[data] no moderators configured - set DM_ADMINS="YourName" to appoint one');
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(`\n  ${GAME_NAME} is running`);
    console.log(`  Play:   http://localhost:${PORT}/`);
    console.log(`  Status: http://localhost:${PORT}/api/status`);
    console.log(`  World checksum: ${world.checksum}\n`);
  });

  loopTimer = setInterval(() => {
    try {
      game.tick();
      flushOutbox();
      if (game.tickCount % AUTOSAVE_TICKS === 0) autosave();
    } catch (err) {
      console.error('[tick]', err);
    }
  }, TICK_MS);

  sweepTimer = setInterval(sweep, 30_000);
  sweepTimer.unref?.();
}

async function shutdown(signal) {
  console.log(`\n[${signal}] shutting down...`);
  if (loopTimer) clearInterval(loopTimer);
  if (sweepTimer) clearInterval(sweepTimer);
  autosave();
  try {
    await accounts.flush();
    await moderation.flush();
  } catch (err) {
    console.error('[shutdown] save failed:', err.message);
  }
  for (const session of sessions.values()) session.conn.close(1001, 'Server restarting');
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => console.error('[unhandled]', err));

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
