/**
 * Client-side state store.
 *
 * The server is authoritative, so this is a cache of the last thing it told us
 * plus a few purely local preferences. UI modules subscribe to events instead
 * of polling.
 */

import { EQUIP_SLOTS, SKILLS } from '../../shared/constants.js';

class Emitter {
  constructor() {
    this.handlers = new Map();
  }

  on(event, handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event, payload) {
    for (const handler of this.handlers.get(event) || []) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[bus] handler for "${event}" failed`, err);
      }
    }
  }
}

export const bus = new Emitter();

const SETTINGS_KEY = 'deviousmud.settings.v1';

const defaultSettings = {
  projection: 'iso',
  zoom: 1,
  sound: true,
  music: false,
  showNames: true,
  highContrast: false,
  largeText: false,
  chatFilter: 'all'
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : { ...defaultSettings };
  } catch {
    return { ...defaultSettings };
  }
}

export const state = {
  mode: 'title', // title | create | game
  connection: 'idle', // idle | connecting | online | solo | error
  playerId: null,
  playerName: '',
  appearance: null,

  self: { x: 48, y: 52, hp: 10, maxHp: 10, energy: 100, run: true, style: 'accurate', region: '', dead: false },
  players: new Map(),
  npcs: new Map(),
  groundItems: new Map(),
  objectStates: new Map(), // objectId -> { depleted } for world objects
  dynamicObjects: new Map(),
  splats: [],

  inventory: new Array(28).fill(null),
  equipment: Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, null])),
  bonuses: { attack: 0, strength: 0, defence: 0 },
  skills: Object.fromEntries(SKILLS.map((skill) => [skill, { level: 1, xp: 0 }])),
  combatLevel: 3,
  totalLevel: 10,
  quests: [],
  questPoints: 0,

  chat: [],
  dialogue: null,
  window: null, // { kind: 'shop'|'bank'|'craft'|'trade', data }
  tick: 0,
  lastTickAt: 0,
  settings: loadSettings()
};

export function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  } catch {
    /* private browsing - preferences just will not persist */
  }
  bus.emit('settings', state.settings);
}

export function pushChat(entry) {
  state.chat.push(entry);
  if (state.chat.length > 300) state.chat.shift();
  bus.emit('chat', entry);
}

/** Applies one server message to the store. */
export function applyMessage(msg) {
  switch (msg.t) {
    case 'login':
      state.playerId = msg.id;
      state.playerName = msg.name;
      state.appearance = msg.appearance;
      bus.emit('login', msg);
      break;

    case 'state': {
      state.tick = msg.tick;
      state.lastTickAt = performance.now();
      Object.assign(state.self, msg.self);

      const seenPlayers = new Set();
      for (const entry of msg.players) {
        seenPlayers.add(entry.id);
        const existing = state.players.get(entry.id) || { renderX: entry.x, renderY: entry.y };
        state.players.set(entry.id, {
          ...existing,
          ...entry,
          name: entry.name ?? existing.name,
          appearance: entry.appearance ?? existing.appearance,
          look: entry.look ?? existing.look,
          level: entry.level ?? existing.level,
          prevX: existing.x ?? entry.x,
          prevY: existing.y ?? entry.y
        });
      }
      for (const id of [...state.players.keys()]) if (!seenPlayers.has(id)) state.players.delete(id);

      const seenNpcs = new Set();
      for (const entry of msg.npcs) {
        seenNpcs.add(entry.id);
        const existing = state.npcs.get(entry.id) || {};
        state.npcs.set(entry.id, { ...existing, ...entry, prevX: existing.x ?? entry.x, prevY: existing.y ?? entry.y });
      }
      for (const id of [...state.npcs.keys()]) if (!seenNpcs.has(id)) state.npcs.delete(id);

      state.groundItems.clear();
      for (const item of msg.items) state.groundItems.set(item.id, item);

      state.objectStates.clear();
      state.dynamicObjects.clear();
      for (const obj of msg.objects) {
        if (obj.dynamic) state.dynamicObjects.set(obj.id, obj);
        else state.objectStates.set(obj.id, obj);
      }

      for (const splat of msg.splats) {
        state.splats.push({ ...splat, born: performance.now() });
      }
      if (state.splats.length > 60) state.splats.splice(0, state.splats.length - 60);

      bus.emit('state', msg);
      break;
    }

    case 'inventory':
      state.inventory = msg.items;
      state.equipment = msg.equipment;
      state.bonuses = msg.bonuses;
      bus.emit('inventory', msg);
      break;

    case 'skills':
      state.skills = msg.skills;
      state.combatLevel = msg.combatLevel;
      state.totalLevel = msg.totalLevel;
      state.self.hp = msg.hp;
      state.self.maxHp = msg.maxHp;
      bus.emit('skills', msg);
      break;

    case 'quests':
      state.quests = msg.quests;
      state.questPoints = msg.points;
      bus.emit('quests', msg);
      break;

    case 'msg':
      pushChat({ channel: msg.channel || 'game', text: msg.text, at: Date.now() });
      break;

    case 'chat':
      pushChat({ channel: 'public', who: msg.name, text: msg.text, id: msg.id, at: Date.now() });
      bus.emit('bubble', msg);
      break;

    case 'dialogue':
      state.dialogue = msg.node ? { ...msg.node, npcName: msg.npcName, playerName: msg.playerName } : null;
      bus.emit('dialogue', state.dialogue);
      break;

    case 'shop':
      state.window = { kind: 'shop', data: msg };
      bus.emit('window', state.window);
      break;

    case 'bank':
      state.window = { kind: 'bank', data: msg };
      bus.emit('window', state.window);
      break;

    case 'craft':
      state.window = { kind: 'craft', data: msg };
      bus.emit('window', state.window);
      break;

    case 'trade':
      state.window = { kind: 'trade', data: msg };
      bus.emit('window', state.window);
      break;

    case 'closeUI':
      state.window = null;
      bus.emit('window', null);
      break;

    case 'effect':
      bus.emit('effect', msg);
      break;

    default:
      bus.emit(msg.t, msg);
      break;
  }
}
