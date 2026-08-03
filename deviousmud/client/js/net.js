/**
 * Transport layer.
 *
 * Two implementations behind one interface:
 *   SocketTransport - talks to the Node server over WebSocket,
 *   SoloTransport   - runs the identical engine inside this tab.
 *
 * Everything above this file is written against `send(msg)` / `onMessage(msg)`
 * and therefore does not know or care which one is in use.
 */

import { PROTOCOL_VERSION, TICK_MS } from '../../shared/constants.js';
import { buildWorld } from '../../shared/world.js';
import { Game } from '../../shared/engine/game.js';

const SOLO_SAVE_KEY = 'deviousmud.solo.v1';
const SERVER_KEY = 'deviousmud.server';

/**
 * Where to find the game server.
 *
 * Normally that is wherever the page came from. A packaged build (Android
 * WebView, or a page opened from disk) has no useful origin, so it can be
 * pointed at a server with `?server=192.168.1.20:8080`, which is remembered for
 * next time.
 */
export function serverOverride() {
  let value = '';
  try {
    value = new URLSearchParams(location.search).get('server') || '';
  } catch {
    value = '';
  }
  try {
    if (value) localStorage.setItem(SERVER_KEY, value);
    else value = localStorage.getItem(SERVER_KEY) || '';
  } catch {
    /* storage blocked - the query parameter still works for this session */
  }
  return value.replace(/^wss?:\/\//, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function overrideSecure(host) {
  // Plain http for private addresses (a phone talking to a PC on the sofa),
  // https for anything routable.
  return !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
}

export class SocketTransport {
  constructor({ onMessage, onStatus }) {
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.socket = null;
    this.queue = [];
    this.reconnectAttempts = 0;
    this.deliberateClose = false;
    this.credentials = null;
    this.kind = 'online';
  }

  static url() {
    const override = serverOverride();
    if (override) return `${overrideSecure(override) ? 'wss:' : 'ws:'}//${override}/ws`;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}/ws`;
  }

  connect() {
    return new Promise((resolve, reject) => {
      let settled = false;
      this.onStatus?.('connecting');
      let socket;
      try {
        socket = new WebSocket(SocketTransport.url());
      } catch (err) {
        reject(err);
        return;
      }
      this.socket = socket;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        socket.close();
        reject(new Error('Timed out connecting to the game server.'));
      }, 6000);

      socket.addEventListener('open', () => {
        clearTimeout(timeout);
        if (!settled) {
          settled = true;
          this.reconnectAttempts = 0;
          this.onStatus?.('online');
          resolve(this);
        }
        for (const msg of this.queue.splice(0)) this.send(msg);
      });

      socket.addEventListener('message', (event) => {
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        if (payload.t === 'batch') {
          for (const msg of payload.m) this.onMessage(msg);
        } else {
          this.onMessage(payload);
        }
      });

      socket.addEventListener('error', () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(new Error('Could not reach the game server.'));
        }
      });

      socket.addEventListener('close', () => {
        this.onStatus?.(this.deliberateClose ? 'closed' : 'lost');
        if (!this.deliberateClose && this.credentials) this.scheduleReconnect();
      });
    });
  }

  /** Exponential backoff, capped, so a server restart heals itself. */
  scheduleReconnect() {
    this.reconnectAttempts += 1;
    if (this.reconnectAttempts > 6) {
      this.onStatus?.('error');
      return;
    }
    const delay = Math.min(16000, 1000 * 2 ** (this.reconnectAttempts - 1));
    this.onStatus?.('reconnecting');
    setTimeout(() => {
      this.connect()
        .then(() => {
          if (this.credentials) this.authenticate(this.credentials);
        })
        .catch(() => this.scheduleReconnect());
    }, delay);
  }

  authenticate(credentials) {
    this.credentials = credentials;
    this.send({ t: 'auth', protocol: PROTOCOL_VERSION, ...credentials });
  }

  send(msg) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.queue.push(msg);
      return;
    }
    this.socket.send(JSON.stringify(msg));
  }

  close() {
    this.deliberateClose = true;
    this.socket?.close();
  }
}

/**
 * Single-player mode. The same `Game` class the server runs, ticking on a
 * timer in the browser, with progress kept in localStorage.
 */
export class SoloTransport {
  constructor({ onMessage, onStatus }) {
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.kind = 'solo';
    this.playerId = 'solo';
    this.game = null;
    this.timer = null;
    this.saveTimer = null;
  }

  static loadSave(name) {
    try {
      const raw = localStorage.getItem(SOLO_SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.save) return null;
      if (name && parsed.save.name && parsed.save.name.toLowerCase() !== name.toLowerCase()) return null;
      return parsed.save;
    } catch {
      return null;
    }
  }

  static hasSave() {
    return Boolean(SoloTransport.loadSave(null));
  }

  connect() {
    this.game = new Game({ world: buildWorld() });
    this.onStatus?.('solo');
    return Promise.resolve(this);
  }

  authenticate({ name, appearance }) {
    const save = SoloTransport.loadSave(name);
    this.game.addPlayer(this.playerId, { name, appearance, save });
    this.flush();
    this.timer = setInterval(() => {
      this.game.tick();
      this.flush();
    }, TICK_MS);
    this.saveTimer = setInterval(() => this.persist(), 10000);
    window.addEventListener('beforeunload', () => this.persist());
  }

  persist() {
    const player = this.game?.players.get(this.playerId);
    if (!player) return;
    try {
      localStorage.setItem(
        SOLO_SAVE_KEY,
        JSON.stringify({ savedAt: Date.now(), save: this.game.serializePlayer(player) })
      );
    } catch {
      /* storage full or blocked - solo progress just will not persist */
    }
  }

  flush() {
    for (const { to, msg } of this.game.drain()) {
      if (to === this.playerId) this.onMessage(msg);
    }
  }

  send(msg) {
    if (!this.game) return;
    if (msg.t === 'auth' || msg.t === 'ping') return;
    this.game.handle(this.playerId, msg);
    this.flush();
  }

  close() {
    this.persist();
    clearInterval(this.timer);
    clearInterval(this.saveTimer);
  }
}

/** Quick reachability probe used by the title screen. */
export async function probeServer(timeoutMs = 2500) {
  const override = serverOverride();
  // Opened straight from disk (or an Android WebView asset) with no server
  // configured: attempting the fetch only logs a scary console error.
  if (!override && !location.protocol.startsWith('http')) return null;
  const endpoint = override
    ? `${overrideSecure(override) ? 'https:' : 'http:'}//${override}/api/status`
    : '/api/status';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
