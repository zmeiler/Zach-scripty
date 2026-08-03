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

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_FILE = process.env.DM_DATA || path.join(projectRoot, 'server', 'data', 'accounts.json');
const AUTOSAVE_TICKS = Math.round(30000 / TICK_MS);
const MAX_COMMANDS_PER_SECOND = 40;
const MAX_PLAYERS = Number(process.env.DM_MAX_PLAYERS || 200);

const accounts = new AccountStore(DATA_FILE);
const world = buildWorld();
const game = new Game({ world });

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
        worldChecksum: world.checksum
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
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
  const session = { id, conn, playerId: null, name: null, isGuest: false, commands: 0, windowStart: Date.now() };
  sessions.set(id, session);

  conn.sendJson({
    t: 'hello',
    protocol: PROTOCOL_VERSION,
    online: playerSessions.size,
    motd: 'Welcome to Emberfall. Be kind, explore everything.'
  });

  conn.on('message', (raw) => {
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
  });
}

function rateLimit(session) {
  const now = Date.now();
  if (now - session.windowStart > 1000) {
    session.windowStart = now;
    session.commands = 0;
  }
  session.commands += 1;
  return session.commands <= MAX_COMMANDS_PER_SECOND;
}

async function handleAuth(session, msg) {
  if (session.playerId) return;
  if (playerSessions.size >= MAX_PLAYERS) {
    session.conn.sendJson({ t: 'authError', reason: 'Emberfall is full right now. Try again shortly.' });
    return;
  }

  const mode = String(msg.mode || 'guest');
  const appearance = sanitizeAppearance(msg.appearance);
  let name = String(msg.name || '').trim();
  let save = null;
  let isGuest = false;

  if (mode === 'register') {
    const result = await accounts.register(name, String(msg.password || ''), appearance);
    if (!result.ok) {
      session.conn.sendJson({ t: 'authError', reason: result.reason });
      return;
    }
    name = result.account.name;
    save = null;
  } else if (mode === 'login') {
    const result = await accounts.authenticate(name, String(msg.password || ''));
    if (!result.ok) {
      session.conn.sendJson({ t: 'authError', reason: result.reason });
      return;
    }
    name = result.account.name;
    save = result.account.save && result.account.save.skills ? result.account.save : null;
  } else {
    const check = validateName(name || 'Guest');
    if (!check.ok) {
      session.conn.sendJson({ t: 'authError', reason: check.reason });
      return;
    }
    name = check.name;
    isGuest = true;
  }

  // One live character per name.
  for (const other of playerSessions.values()) {
    if (other.name.toLowerCase() === name.toLowerCase()) {
      session.conn.sendJson({ t: 'authError', reason: 'That character is already logged in.' });
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
  console.log(`[login] ${name}${isGuest ? ' (guest)' : ''} - ${playerSessions.size} online`);
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

async function start() {
  const loaded = await accounts.load();
  console.log(`[data] ${loaded} account(s) loaded from ${DATA_FILE}`);

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
}

async function shutdown(signal) {
  console.log(`\n[${signal}] shutting down...`);
  if (loopTimer) clearInterval(loopTimer);
  autosave();
  try {
    await accounts.flush();
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
