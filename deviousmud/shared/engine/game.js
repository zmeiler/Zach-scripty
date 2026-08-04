/**
 * The authoritative game simulation.
 *
 * This module is deliberately free of Node and DOM APIs: the server runs it to
 * host a multiplayer world, and the browser runs the very same class in solo
 * mode when no server is reachable. Everything a client can ask for arrives as
 * a command object and is validated here - the browser is never trusted.
 */

import {
  BANK_SIZE,
  COMBAT_TIMEOUT_TICKS,
  PLANE_COUNT,
  SURFACE,
  HP_REGEN_TICKS,
  INVENTORY_SIZE,
  LOOT_DESPAWN_TICKS,
  LOOT_PRIVATE_TICKS,
  MAX_CHAT_LENGTH,
  RUN_DRAIN_PER_TICK,
  RUN_ENERGY_MAX,
  RUN_REGEN_PER_TICK,
  SPAWN_POINT,
  TRADE_SIZE,
  VIEW_RADIUS,
  EQUIP_SLOTS,
  TILE
} from '../constants.js';
import { ITEMS, getItem, itemName, shopBuyPrice, shopSellPrice, bestTool } from '../items.js';
import { SHOPS, shopDef, shopAccepts } from '../shops.js';
import { COOKING, SMELTING, SMITHING, burnChance, smeltingRecipe, smithingRecipe } from '../crafting.js';
import { NPC_SPAWNS, npcDef } from '../npcs.js';
import { QUESTS, QUEST_IDS, questDef } from '../quests.js';
import { OBJECT_TYPES, buildWorld, isWalkable, objectAt, planeAt, regionAt, tileAt } from '../world.js';
import { createSkillSet, combatLevel, levelForXp, totalLevel } from '../skills.js';
import { sanitizeAppearance } from '../appearance.js';
import { chebyshev, findPath, isAdjacent } from './pathfinding.js';
import {
  ATTACK_SPEED_TICKS,
  ATTACK_STYLES,
  combatXp,
  equipmentBonuses,
  npcCombatStats,
  playerCombatStats,
  resolveAttack
} from './combat.js';
import {
  addItem,
  countItem,
  createContainer,
  deserializeContainer,
  freeSlots,
  itemIds,
  removeItem,
  removeSlot,
  serializeContainer,
  spaceFor,
  swapSlots
} from './inventory.js';
import {
  canStart,
  createQuestState,
  normaliseQuestState,
  objectiveProgress,
  questPoints,
  recordEvent,
  refreshQuests,
  startQuest
} from './questlog.js';
import { chooseOption, entryNode, getNode, nodeEffects, presentNode } from './dialogueRunner.js';

export const EMOTES = ['wave', 'cheer', 'dance', 'bow', 'think', 'laugh'];

const FIREMAKING = {
  logs: { level: 1, xp: 40 },
  oak_logs: { level: 15, xp: 60 },
  willow_logs: { level: 30, xp: 90 }
};

const CAMPFIRE_TICKS = 150;
const RESPAWN_TICKS = 5;
const CHAT_TICKS = 8;

const STARTER_KIT = [
  { id: 'bronze_axe', count: 1 },
  { id: 'tinderbox', count: 1 },
  { id: 'small_net', count: 1 },
  { id: 'bread', count: 3 },
  { id: 'coins', count: 75 }
];

export class Game {
  constructor(options = {}) {
    this.world = options.world || buildWorld();
    this.rng = options.rng || Math.random;
    this.tickCount = 0;
    this.players = new Map();
    this.npcs = new Map();
    this.groundItems = new Map();
    this.dynamicObjects = new Map();
    this.shopStock = new Map();
    this.outbox = [];
    this.nextId = 1;
    this.spawnNpcs();
    this.resetShops();
  }

  // ---------------------------------------------------------------- plumbing

  uid(prefix) {
    this.nextId += 1;
    return `${prefix}${this.nextId}`;
  }

  send(playerId, type, data = {}) {
    this.outbox.push({ to: playerId, msg: { t: type, ...data } });
  }

  /** Everyone who can see (x, y) on that plane gets the message. */
  broadcastNear(x, y, plane, type, data = {}, exclude = null) {
    for (const player of this.players.values()) {
      if (player.id === exclude) continue;
      if (player.plane !== plane) continue;
      if (chebyshev(player.x, player.y, x, y) > VIEW_RADIUS + 2) continue;
      this.send(player.id, type, data);
    }
  }

  broadcastAll(type, data = {}) {
    for (const player of this.players.values()) this.send(player.id, type, data);
  }

  message(playerId, text, channel = 'game') {
    this.send(playerId, 'msg', { text, channel });
  }

  drain() {
    const out = this.outbox;
    this.outbox = [];
    return out;
  }

  // -------------------------------------------------------------- population

  spawnNpcs() {
    for (const spawn of NPC_SPAWNS) {
      const def = npcDef(spawn.type);
      if (!def) continue;
      let { x, y } = spawn;
      const plane = spawn.plane ?? SURFACE;
      if (!isWalkable(this.world, x, y, plane)) {
        const nearby = this.findFreeTileNear(x, y, 6, plane);
        if (!nearby) continue;
        x = nearby.x;
        y = nearby.y;
      }
      const id = this.uid('n');
      this.npcs.set(id, {
        id,
        kind: 'npc',
        type: spawn.type,
        def,
        name: def.name,
        x,
        y,
        plane,
        spawnX: x,
        spawnY: y,
        area: spawn.area,
        dir: 'south',
        hp: def.hp || 1,
        maxHp: def.hp || 1,
        dead: false,
        respawnAt: 0,
        targetId: null,
        nextAttack: 0,
        path: [],
        anim: null,
        wanderCooldown: Math.floor(this.rng() * 10)
      });
    }
  }

  resetShops() {
    for (const shop of Object.values(SHOPS)) {
      const stock = new Map();
      for (const entry of shop.stock) stock.set(entry.id, entry.base);
      this.shopStock.set(shop.id, stock);
    }
  }

  findFreeTileNear(x, y, radius = 4, plane = SURFACE) {
    for (let r = 0; r <= radius; r += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (isWalkable(this.world, nx, ny, plane)) return { x: nx, y: ny };
        }
      }
    }
    return null;
  }

  /**
   * Adds a player. `profile.save` is a previously serialised player, if any.
   */
  addPlayer(id, profile = {}) {
    const save = profile.save || null;
    const player = {
      id,
      kind: 'player',
      name: profile.name || 'Adventurer',
      appearance: sanitizeAppearance(save ? save.appearance : profile.appearance),
      x: save ? save.x ?? SPAWN_POINT.x : SPAWN_POINT.x,
      y: save ? save.y ?? SPAWN_POINT.y : SPAWN_POINT.y,
      plane: save ? clampPlane(save.plane) : SURFACE,
      dir: 'south',
      path: [],
      skills: createSkillSet(),
      hp: 10,
      inventory: createContainer(INVENTORY_SIZE),
      equipment: Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, null])),
      bank: createContainer(BANK_SIZE),
      quests: createQuestState(),
      run: true,
      energy: RUN_ENERGY_MAX,
      attackStyle: 'accurate',
      action: null,
      pending: null,
      combat: { targetId: null, nextAttack: 0, timer: 0 },
      dialogue: null,
      ui: null,
      trade: null,
      chat: null,
      anim: null,
      dead: false,
      respawnAt: 0,
      lastRegen: 0,
      seen: new Map(),
      lookVersion: 1,
      splats: [],
      isNew: !save
    };

    if (save) this.applySave(player, save);
    else for (const entry of STARTER_KIT) addItem(player.inventory, entry.id, entry.count);

    if (!isWalkable(this.world, player.x, player.y, player.plane)) {
      const free = this.findFreeTileNear(player.x, player.y, 8, player.plane);
      if (free) {
        player.x = free.x;
        player.y = free.y;
      } else {
        // Nowhere sensible on that plane any more (a changed map, an edited
        // save): put them back by the fountain rather than inside a wall.
        player.plane = SURFACE;
        const surface = this.findFreeTileNear(SPAWN_POINT.x, SPAWN_POINT.y, 8, SURFACE) || SPAWN_POINT;
        player.x = surface.x;
        player.y = surface.y;
      }
    }

    this.players.set(id, player);
    this.sendFullState(player);
    this.broadcastNear(player.x, player.y, player.plane, 'msg', { text: `${player.name} has joined Emberfall.`, channel: 'system' }, id);
    return player;
  }

  removePlayer(id) {
    const player = this.players.get(id);
    if (!player) return null;
    if (player.trade) this.cancelTrade(player, 'Your trading partner left.');
    this.players.delete(id);
    this.broadcastNear(player.x, player.y, player.plane, 'msg', { text: `${player.name} has left Emberfall.`, channel: 'system' }, id);
    return this.serializePlayer(player);
  }

  serializePlayer(player) {
    return {
      name: player.name,
      appearance: player.appearance,
      x: player.x,
      y: player.y,
      plane: player.plane,
      hp: player.hp,
      energy: Math.round(player.energy),
      attackStyle: player.attackStyle,
      run: player.run,
      skills: Object.fromEntries(Object.entries(player.skills).map(([k, v]) => [k, Math.round(v.xp)])),
      inventory: serializeContainer(player.inventory),
      bank: serializeContainer(player.bank),
      equipment: Object.fromEntries(
        EQUIP_SLOTS.map((slot) => [slot, player.equipment[slot] ? { id: player.equipment[slot].id, count: player.equipment[slot].count } : null])
      ),
      quests: player.quests
    };
  }

  applySave(player, save) {
    if (save.skills) {
      for (const [skill, xp] of Object.entries(save.skills)) {
        if (!player.skills[skill]) continue;
        const value = Math.max(0, Number(xp) || 0);
        player.skills[skill].xp = value;
        player.skills[skill].level = levelForXp(value);
      }
    }
    player.hp = Math.max(1, Math.min(player.skills.hitpoints.level, Math.floor(save.hp ?? player.skills.hitpoints.level)));
    player.energy = Math.max(0, Math.min(RUN_ENERGY_MAX, Number(save.energy ?? RUN_ENERGY_MAX)));
    player.run = save.run !== false;
    player.attackStyle = ATTACK_STYLES[save.attackStyle] ? save.attackStyle : 'accurate';
    player.inventory = deserializeContainer(save.inventory, INVENTORY_SIZE);
    player.bank = deserializeContainer(save.bank, BANK_SIZE);
    player.quests = normaliseQuestState(save.quests);
    for (const slot of EQUIP_SLOTS) {
      const worn = save.equipment ? save.equipment[slot] : null;
      player.equipment[slot] = worn && getItem(worn.id) ? { id: worn.id, count: Math.max(1, Math.floor(worn.count || 1)) } : null;
    }
  }

  maxHp(player) {
    return player.skills.hitpoints.level;
  }

  // ----------------------------------------------------------- command entry

  /**
   * Handles one client command. Unknown or malformed commands are ignored.
   */
  handle(playerId, msg) {
    const player = this.players.get(playerId);
    if (!player || !msg || typeof msg.t !== 'string') return;
    if (player.dead && !['chat', 'emote', 'style'].includes(msg.t)) return;

    switch (msg.t) {
      case 'move': return this.cmdMove(player, msg);
      case 'interact': return this.cmdInteract(player, msg);
      case 'item': return this.cmdItem(player, msg);
      case 'unequip': return this.cmdUnequip(player, msg);
      case 'chat': return this.cmdChat(player, msg);
      case 'emote': return this.cmdEmote(player, msg);
      case 'style': return this.cmdStyle(player, msg);
      case 'run': return this.cmdRun(player, msg);
      case 'dialogue': return this.cmdDialogue(player, msg);
      case 'shop': return this.cmdShop(player, msg);
      case 'bank': return this.cmdBank(player, msg);
      case 'craft': return this.cmdCraft(player, msg);
      case 'trade': return this.cmdTrade(player, msg);
      case 'closeUI': return this.closeInterfaces(player);
      case 'appearance': return this.cmdAppearance(player, msg);
      default: return undefined;
    }
  }

  clearActivity(player, { keepCombat = false } = {}) {
    player.action = null;
    player.pending = null;
    if (!keepCombat) player.combat.targetId = null;
    if (player.dialogue) {
      player.dialogue = null;
      this.send(player.id, 'dialogue', { node: null });
    }
  }

  cmdMove(player, msg) {
    const x = Math.floor(Number(msg.x));
    const y = Math.floor(Number(msg.y));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < 0 || y < 0 || x >= this.world.width || y >= this.world.height) return;
    this.clearActivity(player);
    player.path = findPath(this.world, player.x, player.y, x, y, { plane: player.plane });
    if (player.path.length === 0 && !(player.x === x && player.y === y)) {
      this.message(player.id, 'You cannot reach that.');
    }
  }

  cmdInteract(player, msg) {
    const kind = msg.kind;
    const id = String(msg.id || '');
    const action = msg.action ? String(msg.action) : null;
    this.clearActivity(player);

    // A stale click from before a ladder, or a client trying its luck: nothing
    // on another level is ever a legal target.
    const sameLevel = (thing) => thing && (thing.plane ?? SURFACE) === player.plane;

    if (kind === 'npc') {
      const npc = this.npcs.get(id);
      if (!npc || npc.dead || !sameLevel(npc)) return;
      player.pending = { kind: 'npc', id, action: action || (npc.def.friendly ? 'talk' : 'attack'), range: 1 };
      this.pathToward(player, npc.x, npc.y, 1);
    } else if (kind === 'object') {
      const obj = this.objectById(id);
      if (!sameLevel(obj)) return;
      player.pending = { kind: 'object', id, action, range: 1 };
      this.pathToward(player, obj.x, obj.y, 1);
    } else if (kind === 'player') {
      const other = this.players.get(id);
      if (!other || other.id === player.id || !sameLevel(other)) return;
      player.pending = { kind: 'player', id, action: action || 'follow', range: 1 };
      this.pathToward(player, other.x, other.y, 1);
    } else if (kind === 'ground_item') {
      const item = this.groundItems.get(id);
      if (!sameLevel(item)) return;
      player.pending = { kind: 'ground_item', id, action: 'take', range: 0 };
      this.pathToward(player, item.x, item.y, 0);
    }
  }

  pathToward(player, x, y, range) {
    if (chebyshev(player.x, player.y, x, y) <= range) {
      player.path = [];
      return;
    }
    player.path = findPath(this.world, player.x, player.y, x, y, { range, plane: player.plane });
    if (player.path.length === 0) this.message(player.id, 'You cannot reach that.');
  }

  cmdChat(player, msg) {
    const raw = String(msg.text || '').slice(0, MAX_CHAT_LENGTH).trim();
    if (!raw) return;
    const text = filterChat(raw);
    player.chat = { text, ticks: CHAT_TICKS };
    this.broadcastNear(player.x, player.y, player.plane, 'chat', { id: player.id, name: player.name, text });
  }

  cmdEmote(player, msg) {
    const id = String(msg.id || '');
    if (!EMOTES.includes(id)) return;
    player.anim = { kind: 'emote', id, until: this.tickCount + 5 };
  }

  cmdStyle(player, msg) {
    const style = String(msg.style || '');
    if (!ATTACK_STYLES[style]) return;
    player.attackStyle = style;
    this.message(player.id, `Combat style: ${ATTACK_STYLES[style].name}.`);
  }

  cmdRun(player, msg) {
    player.run = Boolean(msg.on);
  }

  cmdAppearance(player, msg) {
    player.appearance = sanitizeAppearance(msg.appearance);
    player.lookVersion += 1;
    this.message(player.id, 'You change your look.');
  }

  // ------------------------------------------------------------- inventory

  cmdItem(player, msg) {
    const slot = Math.floor(Number(msg.slot));
    if (!Number.isInteger(slot) || slot < 0 || slot >= INVENTORY_SIZE) return;
    const entry = player.inventory[slot];
    const op = String(msg.op || 'use');

    if (op === 'swap') {
      const to = Math.floor(Number(msg.to));
      if (Number.isInteger(to)) swapSlots(player.inventory, slot, to);
      this.sendInventory(player);
      return;
    }
    if (!entry) return;
    const def = getItem(entry.id);
    if (!def) return;

    switch (op) {
      case 'equip':
        this.equipItem(player, slot);
        break;
      case 'eat':
        this.eatItem(player, slot);
        break;
      case 'light':
        this.lightFire(player, slot);
        break;
      case 'drop':
        this.dropItem(player, slot, msg.count);
        break;
      case 'examine':
        this.message(player.id, def.examine || 'It is an item.');
        break;
      case 'use':
      default:
        if (def.heal) this.eatItem(player, slot);
        else if (def.slot) this.equipItem(player, slot);
        else if (FIREMAKING[entry.id]) this.lightFire(player, slot);
        else this.message(player.id, def.examine || 'Nothing interesting happens.');
        break;
    }
  }

  equipItem(player, slot) {
    const entry = player.inventory[slot];
    const def = entry && getItem(entry.id);
    if (!def || !def.slot) {
      this.message(player.id, 'You cannot wear that.');
      return;
    }
    for (const [skill, level] of Object.entries(def.requires || {})) {
      if (player.skills[skill].level < level) {
        this.message(player.id, `You need ${skill} level ${level} to use the ${def.name.toLowerCase()}.`);
        return;
      }
    }
    const current = player.equipment[def.slot];
    player.inventory[slot] = null;
    if (current) addItem(player.inventory, current.id, current.count);
    player.equipment[def.slot] = { id: entry.id, count: 1 };
    if (entry.count > 1) addItem(player.inventory, entry.id, entry.count - 1);
    player.lookVersion += 1;
    this.message(player.id, `You equip the ${def.name.toLowerCase()}.`);
    this.sendInventory(player);
  }

  cmdUnequip(player, msg) {
    const slot = String(msg.slot || '');
    if (!EQUIP_SLOTS.includes(slot)) return;
    const worn = player.equipment[slot];
    if (!worn) return;
    if (freeSlots(player.inventory) === 0) {
      this.message(player.id, 'Your inventory is too full.');
      return;
    }
    player.equipment[slot] = null;
    addItem(player.inventory, worn.id, worn.count);
    player.lookVersion += 1;
    this.sendInventory(player);
  }

  eatItem(player, slot) {
    const entry = player.inventory[slot];
    const def = entry && getItem(entry.id);
    if (!def || !def.heal) {
      this.message(player.id, 'You cannot eat that.');
      return;
    }
    removeSlot(player.inventory, slot, 1);
    const before = player.hp;
    player.hp = Math.min(this.maxHp(player), player.hp + def.heal);
    player.anim = { kind: 'eat', until: this.tickCount + 2 };
    this.message(player.id, `You eat the ${def.name.toLowerCase()}. It heals ${player.hp - before} hitpoints.`);
    this.sendInventory(player);
  }

  lightFire(player, slot) {
    const entry = player.inventory[slot];
    const recipe = entry && FIREMAKING[entry.id];
    if (!recipe) {
      this.message(player.id, 'You cannot light that.');
      return;
    }
    if (!bestTool(itemIds(player.inventory), 'tinderbox')) {
      this.message(player.id, 'You need a tinderbox to light a fire.');
      return;
    }
    if (player.skills.firemaking.level < recipe.level) {
      this.message(player.id, `You need firemaking level ${recipe.level} to light those.`);
      return;
    }
    if (objectAt(this.world, player.x, player.y, player.plane) || tileAt(this.world, player.x, player.y, player.plane) === TILE.WATER) {
      this.message(player.id, 'You cannot light a fire here.');
      return;
    }
    removeSlot(player.inventory, slot, 1);
    this.addDynamicObject('campfire', player.x, player.y, player.plane, CAMPFIRE_TICKS);
    this.awardXp(player, 'firemaking', recipe.xp);
    player.anim = { kind: 'light', until: this.tickCount + 3 };
    this.message(player.id, 'The fire catches and the logs begin to burn.');
    recordEvent(player, 'action', 'light_fire');
    this.sendInventory(player);
    this.checkQuests(player);
    // Step aside so the player is not standing in their own campfire.
    const free = this.findFreeTileNear(player.x, player.y, 2, player.plane);
    if (free) {
      player.x = free.x;
      player.y = free.y;
    }
  }

  dropItem(player, slot, count) {
    const entry = player.inventory[slot];
    if (!entry) return;
    const def = getItem(entry.id);
    if (def && def.questItem) {
      this.message(player.id, 'That is too important to drop.');
      return;
    }
    const amount = count === 'all' ? entry.count : Math.max(1, Math.min(entry.count, Math.floor(Number(count) || 1)));
    const removed = removeSlot(player.inventory, slot, amount);
    if (!removed) return;
    this.spawnGroundItem(removed.id, removed.count, player.x, player.y, player.plane, player.id);
    this.message(player.id, `You drop the ${itemName(removed.id).toLowerCase()}.`);
    this.sendInventory(player);
  }

  spawnGroundItem(itemId, count, x, y, plane = SURFACE, ownerId = null) {
    const id = this.uid('g');
    const item = { id, itemId, count, x, y, plane, owner: ownerId, droppedAt: this.tickCount };
    this.groundItems.set(id, item);
    return item;
  }

  pickUp(player, item) {
    if (!item || !this.groundItems.has(item.id)) return;
    if (item.owner && item.owner !== player.id && this.tickCount - item.droppedAt < LOOT_PRIVATE_TICKS) {
      this.message(player.id, 'That is not yours to take yet.');
      return;
    }
    const room = spaceFor(player.inventory, item.itemId, item.count);
    if (room <= 0) {
      this.message(player.id, 'Your inventory is too full to hold that.');
      return;
    }
    addItem(player.inventory, item.itemId, room);
    if (room >= item.count) this.groundItems.delete(item.id);
    else item.count -= room;
    this.message(player.id, `You pick up ${room > 1 ? `${room} x ` : ''}${itemName(item.itemId).toLowerCase()}.`);
    this.sendInventory(player);
    this.checkQuests(player);
  }

  // ---------------------------------------------------------------- skilling

  objectById(id) {
    if (this.dynamicObjects.has(id)) return this.dynamicObjects.get(id);
    return this.world.allObjects.find((obj) => obj.id === id) || null;
  }

  addDynamicObject(type, x, y, plane, lifetime) {
    const id = this.uid('d');
    const obj = { id, type, x, y, plane, expires: this.tickCount + lifetime, dynamic: true, depletedUntil: 0 };
    this.dynamicObjects.set(id, obj);
    planeAt(this.world, plane).objectAt.set(`${x},${y}`, obj);
    return obj;
  }

  removeDynamicObject(obj) {
    this.dynamicObjects.delete(obj.id);
    const index = planeAt(this.world, obj.plane).objectAt;
    if (index.get(`${obj.x},${obj.y}`) === obj) index.delete(`${obj.x},${obj.y}`);
  }

  /** Runs the moment a player reaches whatever they clicked on. */
  performPending(player) {
    const pending = player.pending;
    if (!pending) return;
    player.pending = null;

    if (pending.kind === 'ground_item') {
      this.pickUp(player, this.groundItems.get(pending.id));
      return;
    }
    if (pending.kind === 'npc') {
      const npc = this.npcs.get(pending.id);
      if (!npc || npc.dead) return;
      player.dir = directionTo(player, npc);
      if (pending.action === 'talk' && npc.def.friendly) this.openDialogue(player, npc);
      else if (pending.action === 'attack' && !npc.def.friendly) this.startCombat(player, npc);
      else if (pending.action === 'examine') this.message(player.id, npc.def.examine || 'An ordinary sort of creature.');
      else if (npc.def.friendly) this.openDialogue(player, npc);
      return;
    }
    if (pending.kind === 'player') {
      const other = this.players.get(pending.id);
      if (!other) return;
      if (pending.action === 'trade') this.requestTrade(player, other);
      else this.message(player.id, `${other.name} is level ${combatLevel(other.skills)}.`);
      return;
    }
    if (pending.kind === 'object') {
      const obj = this.objectById(pending.id);
      if (!obj) return;
      player.dir = directionTo(player, obj);
      this.useObject(player, obj, pending.action);
    }
  }

  useObject(player, obj, requested) {
    const def = OBJECT_TYPES[obj.type];
    if (!def || !def.action) return;
    const action = def.action;
    const kind = requested || action.id;

    switch (kind) {
      case 'chop':
      case 'mine':
      case 'fish':
        this.beginGathering(player, obj, action);
        break;
      case 'bank':
        this.openBank(player);
        break;
      case 'shop':
        this.openShop(player, action.shop);
        break;
      case 'smelt':
        player.ui = { kind: 'craft', mode: 'smelt', objectId: obj.id };
        this.send(player.id, 'craft', { mode: 'smelt', recipes: SMELTING, level: player.skills.smithing.level });
        break;
      case 'smith':
        if (!bestTool(itemIds(player.inventory), 'hammer')) {
          this.message(player.id, 'You need a hammer to work the anvil.');
          return;
        }
        player.ui = { kind: 'craft', mode: 'smith', objectId: obj.id };
        this.send(player.id, 'craft', { mode: 'smith', recipes: SMITHING, level: player.skills.smithing.level });
        break;
      case 'cook':
        this.beginCooking(player, obj);
        break;
      case 'drink':
        player.hp = Math.min(this.maxHp(player), player.hp + 2);
        this.message(player.id, 'You drink the cool spring water. Refreshing.');
        break;
      case 'climb':
        this.climb(player, obj);
        break;
      case 'read':
        this.message(player.id, this.signText(obj));
        break;
      default:
        this.message(player.id, 'Nothing interesting happens.');
    }
  }

  /**
   * Moves a player between planes. A ladder is a single, instant step - there
   * is no partial state to get stuck in - but everything that was watching the
   * player has to be told, because from every other player's point of view they
   * simply vanished.
   */
  climb(player, obj) {
    const link = obj.link;
    if (!link) {
      this.message(player.id, 'It does not lead anywhere.');
      return;
    }
    const destination = planeAt(this.world, link.plane);
    const spot = isWalkable(this.world, link.x, link.y, link.plane)
      ? { x: link.x, y: link.y }
      : this.findFreeTileNear(link.x, link.y, 4, link.plane);
    if (!spot) {
      this.message(player.id, 'Something is blocking the way.');
      return;
    }

    const fromX = player.x;
    const fromY = player.y;
    const fromPlane = player.plane;
    const going = link.plane > fromPlane ? 'down' : 'up';

    this.clearActivity(player);
    if (player.trade) this.cancelTrade(player, 'You cannot trade from different levels.');
    player.path = [];
    player.x = spot.x;
    player.y = spot.y;
    player.plane = link.plane;
    // Nobody on the new level has seen this player's kit yet, and nobody on the
    // old one should keep a stale copy of it.
    player.seen.clear();
    for (const other of this.players.values()) other.seen.delete(player.id);
    for (const npc of this.npcs.values()) if (npc.targetId === player.id) npc.targetId = null;

    this.broadcastNear(fromX, fromY, fromPlane, 'msg', { text: `${player.name} climbs ${going}.`, channel: 'system' }, player.id);
    this.message(player.id, `You climb ${going} into ${destination.name}.`, 'system');
    this.send(player.id, 'plane', this.planeInfo(player));
    this.sendState(player);
    recordEvent(player, 'action', `climb_${destination.id}`);
    this.checkQuests(player);
  }

  planeInfo(player) {
    const level = planeAt(this.world, player.plane);
    return {
      plane: player.plane,
      id: level.id,
      name: level.name,
      dark: level.dark,
      ambient: level.ambient,
      x: player.x,
      y: player.y
    };
  }

  signText(obj) {
    if (obj.type === 'mine_cart') return 'The cart holds nothing but grit and one very old glove.';
    if (obj.plane === 1) return 'Chalked on the rock: "Copper and tin above, iron and coal below. Bring a light."';
    if (obj.plane >= 2) return 'Scratched into the wall: "Deeper still. Bring a friend as well as a light."';
    if (obj.x < 40) return 'Signpost: "Copper Hollow - mind the golems. Ore this way."';
    if (obj.x > 58) return 'Signpost: "Lake Serene - fishing, swimming, and quiet."';
    return 'Signpost: "Emberfall Village. Bank north-west, store north-east, smithy south-west, kitchen south-east."';
  }

  beginGathering(player, obj, action) {
    if (obj.depletedUntil > this.tickCount) {
      this.message(player.id, 'There is nothing left to gather here.');
      return;
    }
    const level = player.skills[action.skill].level;
    if (level < action.level) {
      this.message(player.id, `You need ${action.skill} level ${action.level} to do that.`);
      return;
    }
    const tool = bestTool([...itemIds(player.inventory), ...Object.values(player.equipment).filter(Boolean).map((e) => e.id)], action.tool);
    if (action.tool && !tool) {
      this.message(player.id, `You need a ${action.tool} for that.`);
      return;
    }
    if (freeSlots(player.inventory) === 0 && !player.inventory.some((s) => s && s.id === action.yields && ITEMS[action.yields].stackable)) {
      this.message(player.id, 'Your inventory is too full.');
      return;
    }
    player.action = {
      kind: 'gather',
      objectId: obj.id,
      skill: action.skill,
      action,
      toolPower: tool ? tool.power || 1 : 1,
      nextTick: this.tickCount + 1
    };
    this.message(player.id, `You ${action.verb} the ${OBJECT_TYPES[obj.type].name.toLowerCase()}.`);
  }

  beginCooking(player, obj) {
    const raw = player.inventory.find((slot) => slot && COOKING[slot.id]);
    if (!raw) {
      this.message(player.id, 'You have nothing to cook.');
      return;
    }
    const recipe = COOKING[raw.id];
    if (player.skills.cooking.level < recipe.level) {
      this.message(player.id, `You need cooking level ${recipe.level} to cook that.`);
      return;
    }
    player.action = {
      kind: 'cook',
      objectId: obj.id,
      onRange: obj.type === 'range',
      nextTick: this.tickCount + 2
    };
  }

  tickGathering(player) {
    const action = player.action;
    const obj = this.objectById(action.objectId);
    if (!obj) {
      player.action = null;
      return;
    }
    if (!isAdjacent(player.x, player.y, obj.x, obj.y)) {
      player.action = null;
      return;
    }
    if (obj.depletedUntil > this.tickCount) {
      this.message(player.id, 'There is nothing left to gather here.');
      player.action = null;
      return;
    }
    player.anim = { kind: action.action.id, until: this.tickCount + 2 };
    if (this.tickCount < action.nextTick) return;
    action.nextTick = this.tickCount + 1;

    const level = player.skills[action.skill].level;
    const chance = Math.min(0.9, 0.12 + 0.022 * (level - action.action.level) + 0.09 * action.toolPower);
    if (this.rng() > chance) return;

    const yieldId = action.action.yields;
    if (spaceFor(player.inventory, yieldId, 1) <= 0) {
      this.message(player.id, 'Your inventory is too full.');
      player.action = null;
      return;
    }
    addItem(player.inventory, yieldId, 1);
    this.awardXp(player, action.skill, action.action.xp);
    this.message(player.id, `You get some ${itemName(yieldId).toLowerCase()}.`);
    this.sendInventory(player);
    this.checkQuests(player);
    if (action.action.respawn > 0) {
      obj.depletedUntil = this.tickCount + action.action.respawn;
      player.action = null;
    }
  }

  tickCooking(player) {
    const action = player.action;
    const obj = this.objectById(action.objectId);
    if (!obj || !isAdjacent(player.x, player.y, obj.x, obj.y)) {
      player.action = null;
      return;
    }
    player.anim = { kind: 'cook', until: this.tickCount + 2 };
    if (this.tickCount < action.nextTick) return;
    action.nextTick = this.tickCount + 3;

    const index = player.inventory.findIndex((slot) => slot && COOKING[slot.id]);
    if (index === -1) {
      this.message(player.id, 'You have nothing left to cook.');
      player.action = null;
      return;
    }
    const rawId = player.inventory[index].id;
    const recipe = COOKING[rawId];
    if (player.skills.cooking.level < recipe.level) {
      player.action = null;
      return;
    }
    removeSlot(player.inventory, index, 1);
    const burned = this.rng() < burnChance(recipe, player.skills.cooking.level, action.onRange);
    if (burned) {
      addItem(player.inventory, 'burnt_fish', 1);
      this.message(player.id, 'You accidentally burn it. Everyone does at first.');
    } else {
      addItem(player.inventory, recipe.result, 1);
      this.awardXp(player, 'cooking', recipe.xp);
      this.message(player.id, `You cook a lovely ${itemName(recipe.result).toLowerCase()}.`);
      recordEvent(player, 'action', 'cook_food');
    }
    this.sendInventory(player);
    this.checkQuests(player);
  }

  cmdCraft(player, msg) {
    if (!player.ui || player.ui.kind !== 'craft') return;
    const recipeId = String(msg.recipe || '');
    const count = Math.max(1, Math.min(28, Math.floor(Number(msg.count) || 1)));
    const { mode, objectId } = player.ui;
    const recipe = mode === 'smelt' ? smeltingRecipe(recipeId) : smithingRecipe(recipeId);
    if (!recipe) return;
    if (player.skills.smithing.level < recipe.level) {
      this.message(player.id, `You need smithing level ${recipe.level} for that.`);
      return;
    }
    player.ui = null;
    this.send(player.id, 'closeUI', {});
    player.action = { kind: 'craft', mode, recipe, remaining: count, objectId, nextTick: this.tickCount + 2 };
  }

  tickCrafting(player) {
    const action = player.action;
    if (this.tickCount < action.nextTick) {
      player.anim = { kind: action.mode === 'smelt' ? 'smelt' : 'smith', until: this.tickCount + 2 };
      return;
    }
    action.nextTick = this.tickCount + 3;
    const recipe = action.recipe;

    if (action.mode === 'smelt') {
      const missing = recipe.inputs.find((input) => countItem(player.inventory, input.id) < input.count);
      if (missing) {
        this.message(player.id, `You need more ${itemName(missing.id).toLowerCase()}.`);
        player.action = null;
        return;
      }
      for (const input of recipe.inputs) removeItem(player.inventory, input.id, input.count);
      if (recipe.failChance && this.rng() < recipe.failChance) {
        this.message(player.id, recipe.failMessage || 'The smelt fails.');
      } else {
        addItem(player.inventory, recipe.id, 1);
        this.awardXp(player, 'smithing', recipe.xp);
        this.message(player.id, `You smelt a ${recipe.name.toLowerCase()}.`);
      }
    } else {
      if (countItem(player.inventory, recipe.bar) < recipe.bars) {
        this.message(player.id, `You need ${recipe.bars} ${itemName(recipe.bar).toLowerCase()}.`);
        player.action = null;
        return;
      }
      if (!bestTool(itemIds(player.inventory), 'hammer')) {
        this.message(player.id, 'You need a hammer.');
        player.action = null;
        return;
      }
      removeItem(player.inventory, recipe.bar, recipe.bars);
      addItem(player.inventory, recipe.id, 1);
      this.awardXp(player, 'smithing', recipe.xp);
      this.message(player.id, `You hammer out a ${recipe.name.toLowerCase()}.`);
    }

    player.anim = { kind: action.mode === 'smelt' ? 'smelt' : 'smith', until: this.tickCount + 2 };
    action.remaining -= 1;
    this.sendInventory(player);
    this.checkQuests(player);
    if (action.remaining <= 0) player.action = null;
  }

  // ------------------------------------------------------------------ combat

  startCombat(player, npc) {
    if (npc.def.friendly) {
      this.message(player.id, 'That is not something you should attack.');
      return;
    }
    player.combat.targetId = npc.id;
    player.combat.nextAttack = Math.max(player.combat.nextAttack, this.tickCount);
    npc.targetId = npc.targetId || player.id;
  }

  tickPlayerCombat(player) {
    const npc = this.npcs.get(player.combat.targetId);
    if (!npc || npc.dead || npc.plane !== player.plane) {
      player.combat.targetId = null;
      return;
    }
    if (!isAdjacent(player.x, player.y, npc.x, npc.y)) {
      if (player.path.length === 0) this.pathToward(player, npc.x, npc.y, 1);
      return;
    }
    player.path = [];
    player.dir = directionTo(player, npc);
    if (this.tickCount < player.combat.nextAttack) return;
    player.combat.nextAttack = this.tickCount + ATTACK_SPEED_TICKS;
    player.combat.timer = COMBAT_TIMEOUT_TICKS;
    player.anim = { kind: 'attack', until: this.tickCount + 2 };

    const attacker = playerCombatStats(player);
    const defender = { ...npcCombatStats(npc.def), style: 'accurate' };
    const result = resolveAttack(attacker, defender, this.rng);
    const damage = Math.min(result.damage, npc.hp);
    npc.hp -= damage;
    this.pushSplat(npc, damage, result.hit ? 'hit' : 'miss');
    if (damage > 0) {
      const award = combatXp(player.attackStyle, damage);
      for (const [skill, xp] of Object.entries(award)) this.awardXp(player, skill, xp);
    }
    npc.targetId = npc.targetId || player.id;
    if (npc.hp <= 0) this.defeatNpc(player, npc);
  }

  tickNpcCombat(npc) {
    const target = this.players.get(npc.targetId);
    if (!target || target.dead || target.plane !== npc.plane) {
      // Climbing a ladder ends a fight: nothing follows you between levels.
      npc.targetId = null;
      return;
    }
    if (chebyshev(npc.x, npc.y, npc.spawnX, npc.spawnY) > 12) {
      npc.targetId = null;
      npc.path = findPath(this.world, npc.x, npc.y, npc.spawnX, npc.spawnY, { plane: npc.plane });
      return;
    }
    if (!isAdjacent(npc.x, npc.y, target.x, target.y)) {
      if (npc.path.length === 0) npc.path = findPath(this.world, npc.x, npc.y, target.x, target.y, { range: 1, plane: npc.plane });
      return;
    }
    npc.path = [];
    npc.dir = directionTo(npc, target);
    if (this.tickCount < npc.nextAttack) return;
    npc.nextAttack = this.tickCount + ATTACK_SPEED_TICKS;
    npc.anim = { kind: 'attack', until: this.tickCount + 2 };

    const attacker = npcCombatStats(npc.def);
    const defender = playerCombatStats(target);
    const result = resolveAttack(attacker, defender, this.rng);
    const damage = Math.min(result.damage, target.hp);
    target.hp -= damage;
    target.combat.timer = COMBAT_TIMEOUT_TICKS;
    this.pushSplat(target, damage, result.hit ? 'hit' : 'miss');
    if (damage > 0) this.awardXp(target, 'hitpoints', damage * 0.4);
    if (target.hp <= 0) this.knockOut(target);
  }

  pushSplat(entity, damage, kind) {
    const splat = { id: entity.id, damage, kind };
    for (const player of this.players.values()) {
      if (player.plane !== (entity.plane ?? SURFACE)) continue;
      if (chebyshev(player.x, player.y, entity.x, entity.y) <= VIEW_RADIUS) player.splats.push(splat);
    }
  }

  defeatNpc(player, npc) {
    npc.dead = true;
    npc.hp = 0;
    npc.targetId = null;
    npc.path = [];
    npc.respawnAt = this.tickCount + (npc.def.respawn || 30);
    player.combat.targetId = null;
    this.message(player.id, `The ${npc.def.name.toLowerCase()} scampers away, defeated.`);

    for (const drop of npc.def.drops || []) {
      if (this.rng() > (drop.chance ?? 1)) continue;
      const min = drop.min ?? 1;
      const max = drop.max ?? min;
      const count = min + Math.floor(this.rng() * (max - min + 1));
      if (count > 0) this.spawnGroundItem(drop.id, count, npc.x, npc.y, npc.plane, player.id);
    }

    recordEvent(player, 'kill', npc.type);
    this.checkQuests(player);
  }

  knockOut(player) {
    player.dead = true;
    player.hp = 0;
    player.path = [];
    player.action = null;
    player.pending = null;
    player.combat.targetId = null;
    player.respawnAt = this.tickCount + RESPAWN_TICKS;
    for (const npc of this.npcs.values()) if (npc.targetId === player.id) npc.targetId = null;
    this.message(player.id, 'You have been knocked out! You will wake up in Emberfall shortly.', 'system');
    player.wokeUnderground = player.plane !== SURFACE;
    this.send(player.id, 'effect', { kind: 'knockout' });
  }

  respawn(player) {
    player.dead = false;
    player.x = SPAWN_POINT.x;
    player.y = SPAWN_POINT.y;
    // However deep you were, you always wake up on the surface. Losing the walk
    // back down is the whole cost of being knocked out.
    player.plane = SURFACE;
    player.seen.clear();
    player.hp = this.maxHp(player);
    player.energy = RUN_ENERGY_MAX;
    player.combat.timer = 0;
    this.message(
      player.id,
      player.wokeUnderground
        ? 'Someone carried you up the ladder. You wake up by the fountain, no worse for it.'
        : 'You wake up by the fountain, dusted off and none the worse.',
      'system'
    );
    player.wokeUnderground = false;
    this.send(player.id, 'effect', { kind: 'respawn' });
  }

  awardXp(player, skill, amount) {
    if (!player.skills[skill] || amount <= 0) return;
    const entry = player.skills[skill];
    const before = entry.level;
    entry.xp += amount;
    entry.level = levelForXp(entry.xp);
    if (entry.level > before) {
      if (skill === 'hitpoints') player.hp += entry.level - before;
      this.message(player.id, `Congratulations! Your ${skill} level is now ${entry.level}.`, 'system');
      this.send(player.id, 'effect', { kind: 'levelup', skill, level: entry.level });
    }
    this.sendSkills(player);
  }

  // ------------------------------------------------------------- interfaces

  closeInterfaces(player) {
    player.ui = null;
    if (player.dialogue) player.dialogue = null;
    if (player.trade) this.cancelTrade(player, 'Trade cancelled.');
    this.send(player.id, 'closeUI', {});
  }

  dialogueContext(player) {
    return {
      countItem: (id) => countItem(player.inventory, id),
      questPoints: () => questPoints(player.quests)
    };
  }

  openDialogue(player, npc) {
    const nodeId = entryNode(player, npc.type, this.dialogueContext(player));
    if (!nodeId) {
      this.message(player.id, `${npc.name} nods politely.`);
      return;
    }
    player.dialogue = { npcId: npc.id, npcType: npc.type, nodeId };
    this.enterNode(player, npc.type, nodeId);
  }

  enterNode(player, npcType, nodeId) {
    const node = getNode(npcType, nodeId);
    if (!node) {
      player.dialogue = null;
      this.send(player.id, 'dialogue', { node: null });
      return;
    }
    for (const effect of nodeEffects(npcType, nodeId)) this.applyEffect(player, effect);
    player.dialogue = { ...(player.dialogue || {}), npcType, nodeId };
    const payload = presentNode(player, npcType, nodeId, this.dialogueContext(player));
    const npc = [...this.npcs.values()].find((n) => n.type === npcType);
    this.send(player.id, 'dialogue', {
      node: payload,
      npcName: npc ? npc.name : '',
      playerName: player.name
    });
  }

  cmdDialogue(player, msg) {
    if (!player.dialogue) return;
    const { npcType, nodeId } = player.dialogue;
    if (msg.close) {
      player.dialogue = null;
      this.send(player.id, 'dialogue', { node: null });
      return;
    }
    const index = Math.floor(Number(msg.option));
    const result = chooseOption(player, npcType, nodeId, index, this.dialogueContext(player));
    for (const effect of result.effects) this.applyEffect(player, effect);
    if (result.nextNode) {
      this.enterNode(player, npcType, result.nextNode);
    } else {
      player.dialogue = null;
      this.send(player.id, 'dialogue', { node: null });
    }
  }

  applyEffect(player, effect) {
    switch (effect.type) {
      case 'startQuest': {
        const result = startQuest(player, effect.quest);
        if (result.started) {
          this.message(player.id, `Quest started: ${result.quest.name}.`, 'system');
          this.send(player.id, 'effect', { kind: 'quest', quest: effect.quest, state: 'started' });
          this.sendQuests(player);
        } else if (result.reason) {
          this.message(player.id, result.reason);
        }
        break;
      }
      case 'setStage': {
        const state = player.quests[effect.quest];
        if (state && !state.completed) {
          state.stage = effect.stage;
          state.counter = 0;
          this.sendQuests(player);
        }
        break;
      }
      case 'completeQuest':
        this.completeQuest(player, effect.quest);
        break;
      case 'giveItem': {
        const count = effect.count || 1;
        if (spaceFor(player.inventory, effect.id, count) < count) {
          this.spawnGroundItem(effect.id, count, player.x, player.y, player.plane, player.id);
          this.message(player.id, `You have no room, so the ${itemName(effect.id).toLowerCase()} drops at your feet.`);
        } else {
          addItem(player.inventory, effect.id, count);
          this.message(player.id, `You receive ${count > 1 ? `${count} x ` : ''}${itemName(effect.id).toLowerCase()}.`);
        }
        this.sendInventory(player);
        this.checkQuests(player);
        break;
      }
      case 'takeItem':
        removeItem(player.inventory, effect.id, effect.count || 1);
        this.sendInventory(player);
        break;
      case 'openShop':
        this.openShop(player, effect.shop);
        break;
      case 'openBank':
        this.openBank(player);
        break;
      case 'heal':
        player.hp = this.maxHp(player);
        this.message(player.id, 'You feel completely restored.');
        break;
      case 'message':
        this.message(player.id, effect.text);
        break;
      default:
        break;
    }
  }

  completeQuest(player, questId) {
    const quest = questDef(questId);
    const state = player.quests[questId];
    if (!quest || !state || state.completed) return;
    state.completed = true;
    state.stage = quest.stages[quest.stages.length - 1].id;
    const rewards = quest.rewards || {};
    if (rewards.coins) addItem(player.inventory, 'coins', rewards.coins);
    for (const item of rewards.items || []) {
      if (spaceFor(player.inventory, item.id, item.count) < item.count) {
        this.spawnGroundItem(item.id, item.count, player.x, player.y, player.plane, player.id);
      } else {
        addItem(player.inventory, item.id, item.count);
      }
    }
    for (const [skill, xp] of Object.entries(rewards.xp || {})) this.awardXp(player, skill, xp);
    this.message(player.id, `Quest complete: ${quest.name}!`, 'system');
    if (rewards.text) this.message(player.id, rewards.text, 'system');
    this.send(player.id, 'effect', { kind: 'quest', quest: questId, state: 'complete', rewards });
    this.sendInventory(player);
    this.sendQuests(player);
    this.broadcastAll('msg', { text: `${player.name} has completed ${quest.name}!`, channel: 'system' });
  }

  checkQuests(player) {
    const advanced = refreshQuests(player, (id) => countItem(player.inventory, id));
    if (advanced.length === 0) return;
    for (const step of advanced) {
      this.message(player.id, `${QUESTS[step.questId].name}: ${step.journal}`, 'system');
    }
    this.sendQuests(player);
  }

  // ------------------------------------------------------------------- shops

  openShop(player, shopId) {
    const shop = shopDef(shopId);
    if (!shop) return;
    player.ui = { kind: 'shop', shop: shopId };
    this.sendShop(player, shopId);
  }

  sendShop(player, shopId) {
    const shop = shopDef(shopId);
    const stock = this.shopStock.get(shopId) || new Map();
    this.send(player.id, 'shop', {
      id: shopId,
      name: shop.name,
      greeting: shop.greeting,
      stock: shop.stock.map((entry) => ({
        id: entry.id,
        count: stock.get(entry.id) || 0,
        price: shopBuyPrice(entry.id)
      }))
    });
  }

  cmdShop(player, msg) {
    if (!player.ui || player.ui.kind !== 'shop') return;
    const shopId = player.ui.shop;
    const stock = this.shopStock.get(shopId);
    if (!stock) return;
    const count = Math.max(1, Math.min(100, Math.floor(Number(msg.count) || 1)));

    if (msg.op === 'buy') {
      const itemId = String(msg.id || '');
      const available = stock.get(itemId) || 0;
      if (available <= 0) {
        this.message(player.id, 'The shop has run out of those.');
        return;
      }
      const amount = Math.min(count, available);
      const price = shopBuyPrice(itemId);
      const affordable = Math.min(amount, Math.floor(countItem(player.inventory, 'coins') / price));
      if (affordable <= 0) {
        this.message(player.id, 'You cannot afford that.');
        return;
      }
      const room = spaceFor(player.inventory, itemId, affordable);
      if (room <= 0) {
        this.message(player.id, 'Your inventory is too full.');
        return;
      }
      removeItem(player.inventory, 'coins', price * room);
      addItem(player.inventory, itemId, room);
      stock.set(itemId, available - room);
      this.message(player.id, `You buy ${room > 1 ? `${room} x ` : ''}${itemName(itemId).toLowerCase()} for ${price * room} coins.`);
    } else if (msg.op === 'sell') {
      const slot = Math.floor(Number(msg.slot));
      const entry = player.inventory[slot];
      if (!entry) return;
      if (!shopAccepts(shopId, entry.id) || getItem(entry.id).questItem) {
        this.message(player.id, 'The shopkeeper will not take that.');
        return;
      }
      const amount = Math.min(count, entry.count);
      const price = shopSellPrice(entry.id);
      removeSlot(player.inventory, slot, amount);
      addItem(player.inventory, 'coins', price * amount);
      stock.set(entry.id, (stock.get(entry.id) || 0) + amount);
      this.message(player.id, `You sell ${amount > 1 ? `${amount} x ` : ''}${itemName(entry.id).toLowerCase()} for ${price * amount} coins.`);
    }
    this.sendInventory(player);
    this.sendShop(player, shopId);
  }

  restockShops() {
    for (const shop of Object.values(SHOPS)) {
      const stock = this.shopStock.get(shop.id);
      if (!stock) continue;
      for (const entry of shop.stock) {
        const current = stock.get(entry.id) || 0;
        if (current < entry.base) stock.set(entry.id, current + 1);
        else if (current > entry.base) stock.set(entry.id, current - 1);
      }
    }
    for (const player of this.players.values()) {
      if (player.ui && player.ui.kind === 'shop') this.sendShop(player, player.ui.shop);
    }
  }

  // -------------------------------------------------------------------- bank

  openBank(player) {
    player.ui = { kind: 'bank' };
    this.sendBank(player);
  }

  sendBank(player) {
    this.send(player.id, 'bank', { items: serializeContainer(player.bank) });
  }

  cmdBank(player, msg) {
    if (!player.ui || player.ui.kind !== 'bank') return;
    const op = String(msg.op || '');
    const count = msg.count === 'all' ? Infinity : Math.max(1, Math.floor(Number(msg.count) || 1));

    if (op === 'deposit') {
      const slot = Math.floor(Number(msg.slot));
      const entry = player.inventory[slot];
      if (!entry) return;
      // "All" means every one the player is carrying, which for non-stackable
      // items such as logs or ore spans several inventory slots.
      const amount = msg.count === 'all' ? countItem(player.inventory, entry.id) : Math.min(entry.count, count);
      const stored = addItem(player.bank, entry.id, amount);
      if (stored <= 0) {
        this.message(player.id, 'Your bank is full.');
        return;
      }
      removeItem(player.inventory, entry.id, stored);
    } else if (op === 'withdraw') {
      const index = Math.floor(Number(msg.slot));
      const entry = player.bank[index];
      if (!entry) return;
      // Non-stackable items occupy one bank slot each, so a request for ten
      // logs has to be satisfied across slots rather than from the clicked one.
      const held = countItem(player.bank, entry.id);
      const amount = Math.min(held, count);
      const room = spaceFor(player.inventory, entry.id, amount);
      if (room <= 0) {
        this.message(player.id, 'Your inventory is too full.');
        return;
      }
      removeItem(player.bank, entry.id, room);
      addItem(player.inventory, entry.id, room);
    } else if (op === 'depositAll') {
      for (let i = 0; i < player.inventory.length; i += 1) {
        const entry = player.inventory[i];
        if (!entry) continue;
        const stored = addItem(player.bank, entry.id, entry.count);
        if (stored > 0) removeSlot(player.inventory, i, stored);
      }
    } else if (op === 'depositEquipment') {
      for (const slot of EQUIP_SLOTS) {
        const worn = player.equipment[slot];
        if (!worn) continue;
        const stored = addItem(player.bank, worn.id, worn.count);
        if (stored > 0) player.equipment[slot] = null;
      }
      player.lookVersion += 1;
    }
    this.sendInventory(player);
    this.sendBank(player);
  }

  // ------------------------------------------------------------------- trade

  requestTrade(player, other) {
    if (player.trade || other.trade) {
      this.message(player.id, 'Somebody is already trading.');
      return;
    }
    if (other.plane !== player.plane) return;
    other.tradeRequestFrom = player.id;
    this.message(player.id, `You send a trade request to ${other.name}.`);
    this.message(other.id, `${player.name} wishes to trade with you. Click them to accept.`, 'system');
    if (player.tradeRequestFrom === other.id) this.beginTrade(player, other);
  }

  beginTrade(a, b) {
    a.tradeRequestFrom = null;
    b.tradeRequestFrom = null;
    a.trade = { withId: b.id, offer: createContainer(TRADE_SIZE), accepted: false };
    b.trade = { withId: a.id, offer: createContainer(TRADE_SIZE), accepted: false };
    a.ui = { kind: 'trade' };
    b.ui = { kind: 'trade' };
    this.sendTrade(a);
    this.sendTrade(b);
  }

  sendTrade(player) {
    const trade = player.trade;
    if (!trade) return;
    const other = this.players.get(trade.withId);
    if (!other || !other.trade) return;
    this.send(player.id, 'trade', {
      partner: other.name,
      yours: serializeContainer(trade.offer),
      theirs: serializeContainer(other.trade.offer),
      youAccepted: trade.accepted,
      theyAccepted: other.trade.accepted
    });
  }

  cancelTrade(player, reason) {
    const trade = player.trade;
    if (!trade) return;
    const other = this.players.get(trade.withId);
    for (const slot of trade.offer) if (slot) addItem(player.inventory, slot.id, slot.count);
    player.trade = null;
    if (player.ui && player.ui.kind === 'trade') player.ui = null;
    this.send(player.id, 'closeUI', {});
    this.message(player.id, reason);
    this.sendInventory(player);
    if (other && other.trade) {
      for (const slot of other.trade.offer) if (slot) addItem(other.inventory, slot.id, slot.count);
      other.trade = null;
      if (other.ui && other.ui.kind === 'trade') other.ui = null;
      this.send(other.id, 'closeUI', {});
      this.message(other.id, reason);
      this.sendInventory(other);
    }
  }

  cmdTrade(player, msg) {
    const op = String(msg.op || '');
    if (op === 'request') {
      const other = this.players.get(String(msg.id || ''));
      if (other) this.requestTrade(player, other);
      return;
    }
    if (op === 'accept-request') {
      const from = player.tradeRequestFrom && this.players.get(player.tradeRequestFrom);
      if (from) this.beginTrade(player, from);
      return;
    }
    if (!player.trade) return;
    const other = this.players.get(player.trade.withId);
    if (!other || !other.trade) {
      this.cancelTrade(player, 'Your trading partner is gone.');
      return;
    }

    if (op === 'offer') {
      const slot = Math.floor(Number(msg.slot));
      const entry = player.inventory[slot];
      if (!entry) return;
      const def = getItem(entry.id);
      if (def.questItem) {
        this.message(player.id, 'You cannot trade that.');
        return;
      }
      const count = msg.count === 'all'
        ? countItem(player.inventory, entry.id)
        : Math.max(1, Math.min(entry.count, Math.floor(Number(msg.count) || 1)));
      const room = spaceFor(player.trade.offer, entry.id, count);
      if (room <= 0) {
        this.message(player.id, 'Your trade offer is full.');
        return;
      }
      const stored = addItem(player.trade.offer, entry.id, room);
      removeItem(player.inventory, entry.id, stored);
    } else if (op === 'withdraw') {
      const index = Math.floor(Number(msg.slot));
      const entry = player.trade.offer[index];
      if (!entry) return;
      const room = spaceFor(player.inventory, entry.id, entry.count);
      if (room <= 0) return;
      removeSlot(player.trade.offer, index, room);
      addItem(player.inventory, entry.id, room);
    } else if (op === 'accept') {
      player.trade.accepted = true;
      if (other.trade.accepted) {
        this.settleTrade(player, other);
        return;
      }
    } else if (op === 'unaccept') {
      player.trade.accepted = false;
    } else if (op === 'cancel') {
      this.cancelTrade(player, 'The trade was cancelled.');
      return;
    }

    // Any change to an offer invalidates both acceptances.
    if (op === 'offer' || op === 'withdraw') {
      player.trade.accepted = false;
      other.trade.accepted = false;
    }
    this.sendInventory(player);
    this.sendTrade(player);
    this.sendTrade(other);
  }

  settleTrade(a, b) {
    const aItems = a.trade.offer.filter(Boolean);
    const bItems = b.trade.offer.filter(Boolean);
    const roomForA = bItems.every((slot) => spaceFor(a.inventory, slot.id, slot.count) >= slot.count);
    const roomForB = aItems.every((slot) => spaceFor(b.inventory, slot.id, slot.count) >= slot.count);
    if (!roomForA || !roomForB) {
      a.trade.accepted = false;
      b.trade.accepted = false;
      this.message(a.id, 'Not enough inventory space to complete the trade.');
      this.message(b.id, 'Not enough inventory space to complete the trade.');
      this.sendTrade(a);
      this.sendTrade(b);
      return;
    }
    for (const slot of bItems) addItem(a.inventory, slot.id, slot.count);
    for (const slot of aItems) addItem(b.inventory, slot.id, slot.count);
    a.trade = null;
    b.trade = null;
    a.ui = null;
    b.ui = null;
    this.send(a.id, 'closeUI', {});
    this.send(b.id, 'closeUI', {});
    this.message(a.id, 'Trade complete.', 'system');
    this.message(b.id, 'Trade complete.', 'system');
    this.sendInventory(a);
    this.sendInventory(b);
  }

  // -------------------------------------------------------------- simulation

  tick() {
    this.tickCount += 1;

    for (const player of this.players.values()) this.tickPlayer(player);
    for (const npc of this.npcs.values()) this.tickNpc(npc);

    this.tickObjects();
    this.tickGroundItems();
    if (this.tickCount % 50 === 0) this.restockShops();

    for (const player of this.players.values()) this.sendState(player);
    for (const player of this.players.values()) player.splats.length = 0;
    return this.tickCount;
  }

  tickPlayer(player) {
    if (player.dead) {
      if (this.tickCount >= player.respawnAt) this.respawn(player);
      return;
    }

    // Movement first, so an action can fire the moment we arrive.
    const steps = player.run && player.energy > 0 ? 2 : 1;
    let moved = false;
    for (let i = 0; i < steps && player.path.length > 0; i += 1) {
      const next = player.path.shift();
      if (!isWalkable(this.world, next.x, next.y, player.plane)) {
        player.path = [];
        break;
      }
      player.dir = directionBetween(player.x, player.y, next.x, next.y) || player.dir;
      player.x = next.x;
      player.y = next.y;
      moved = true;
      if (i === 0 && steps === 2) player.energy = Math.max(0, player.energy - RUN_DRAIN_PER_TICK);
    }
    if (!moved) player.energy = Math.min(RUN_ENERGY_MAX, player.energy + RUN_REGEN_PER_TICK);

    if (player.pending) {
      const target = this.pendingTarget(player.pending);
      if (!target) player.pending = null;
      else if (chebyshev(player.x, player.y, target.x, target.y) <= player.pending.range) this.performPending(player);
      else if (player.path.length === 0) player.pending = null;
    }

    if (player.combat.targetId) this.tickPlayerCombat(player);
    else if (player.action) {
      if (player.action.kind === 'gather') this.tickGathering(player);
      else if (player.action.kind === 'cook') this.tickCooking(player);
      else if (player.action.kind === 'craft') this.tickCrafting(player);
    }

    if (player.combat.timer > 0) player.combat.timer -= 1;
    if (player.chat) {
      player.chat.ticks -= 1;
      if (player.chat.ticks <= 0) player.chat = null;
    }
    if (player.anim && player.anim.until <= this.tickCount) player.anim = null;

    // Slow, steady regeneration when nothing is trying to hit you.
    if (player.combat.timer === 0 && this.tickCount - player.lastRegen >= HP_REGEN_TICKS) {
      player.lastRegen = this.tickCount;
      if (player.hp < this.maxHp(player)) player.hp += 1;
    }
  }

  pendingTarget(pending) {
    if (pending.kind === 'npc') return this.npcs.get(pending.id) || null;
    if (pending.kind === 'player') return this.players.get(pending.id) || null;
    if (pending.kind === 'ground_item') return this.groundItems.get(pending.id) || null;
    if (pending.kind === 'object') return this.objectById(pending.id);
    return null;
  }

  tickNpc(npc) {
    if (npc.dead) {
      if (this.tickCount >= npc.respawnAt) {
        npc.dead = false;
        npc.hp = npc.maxHp;
        npc.x = npc.spawnX;
        npc.y = npc.spawnY;
        npc.anim = null;
      }
      return;
    }
    if (npc.anim && npc.anim.until <= this.tickCount) npc.anim = null;

    if (!npc.targetId && npc.def.aggressive) {
      for (const player of this.players.values()) {
        if (player.dead || player.plane !== npc.plane) continue;
        // Creatures ignore anyone who simply wandered past out of reach, and
        // never pick on a character less than a third of their level.
        if (combatLevel(player.skills) * 3 < (npc.def.level || 1)) continue;
        if (chebyshev(npc.x, npc.y, player.x, player.y) <= 3) {
          npc.targetId = player.id;
          this.message(player.id, `The ${npc.def.name.toLowerCase()} takes an interest in you.`);
          break;
        }
      }
    }

    if (npc.targetId) {
      this.tickNpcCombat(npc);
    } else if (npc.def.wander !== 0) {
      npc.wanderCooldown -= 1;
      if (npc.wanderCooldown <= 0) {
        npc.wanderCooldown = 6 + Math.floor(this.rng() * 10);
        const area = npc.area;
        const tx = area.x + Math.floor(this.rng() * area.w);
        const ty = area.y + Math.floor(this.rng() * area.h);
        if (isWalkable(this.world, tx, ty, npc.plane)) npc.path = findPath(this.world, npc.x, npc.y, tx, ty, { plane: npc.plane });
      }
    }

    if (npc.path && npc.path.length > 0) {
      const next = npc.path.shift();
      if (isWalkable(this.world, next.x, next.y, npc.plane)) {
        npc.dir = directionBetween(npc.x, npc.y, next.x, next.y) || npc.dir;
        npc.x = next.x;
        npc.y = next.y;
      } else {
        npc.path = [];
      }
    }
  }

  tickObjects() {
    for (const obj of this.dynamicObjects.values()) {
      if (obj.expires <= this.tickCount) this.removeDynamicObject(obj);
    }
  }

  tickGroundItems() {
    for (const item of this.groundItems.values()) {
      if (this.tickCount - item.droppedAt > LOOT_DESPAWN_TICKS) this.groundItems.delete(item.id);
    }
  }

  // ------------------------------------------------------------- outbound UI

  sendFullState(player) {
    this.send(player.id, 'login', {
      id: player.id,
      name: player.name,
      appearance: player.appearance,
      worldSeed: this.world.seed,
      checksum: this.world.checksum,
      spawn: { x: player.x, y: player.y },
      plane: this.planeInfo(player),
      isNew: player.isNew
    });
    this.sendInventory(player);
    this.sendSkills(player);
    this.sendQuests(player);
  }

  sendInventory(player) {
    this.send(player.id, 'inventory', {
      items: serializeContainer(player.inventory),
      equipment: Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, player.equipment[slot]])),
      bonuses: equipmentBonuses(player.equipment)
    });
  }

  sendSkills(player) {
    this.send(player.id, 'skills', {
      skills: Object.fromEntries(Object.entries(player.skills).map(([k, v]) => [k, { xp: Math.round(v.xp), level: v.level }])),
      combatLevel: combatLevel(player.skills),
      totalLevel: totalLevel(player.skills),
      hp: player.hp,
      maxHp: this.maxHp(player)
    });
  }

  sendQuests(player) {
    this.send(player.id, 'quests', {
      quests: QUEST_IDS.map((id) => {
        const quest = QUESTS[id];
        const state = player.quests[id];
        return {
          id,
          name: quest.name,
          difficulty: quest.difficulty,
          length: quest.length,
          description: quest.description,
          startHint: quest.startHint,
          stage: state.stage,
          completed: state.completed,
          journal: quest.stages.filter((s) => state.completed || s.id <= state.stage).map((s) => s.journal),
          objective: objectiveProgress(player, id),
          rewards: quest.rewards
        };
      }),
      points: questPoints(player.quests)
    });
  }

  sendState(player) {
    const players = [];
    const npcs = [];
    const items = [];
    const objects = [];

    for (const other of this.players.values()) {
      if (other.plane !== player.plane) continue;
      if (chebyshev(player.x, player.y, other.x, other.y) > VIEW_RADIUS) continue;
      const seenVersion = player.seen.get(other.id);
      const entry = {
        id: other.id,
        x: other.x,
        y: other.y,
        dir: other.dir,
        hp: other.hp,
        maxHp: this.maxHp(other),
        anim: other.anim ? other.anim.kind : null,
        chat: other.chat ? other.chat.text : null,
        dead: other.dead
      };
      if (seenVersion !== other.lookVersion) {
        entry.name = other.name;
        entry.appearance = other.appearance;
        entry.level = combatLevel(other.skills);
        entry.look = Object.fromEntries(
          EQUIP_SLOTS.filter((slot) => other.equipment[slot]).map((slot) => [slot, other.equipment[slot].id])
        );
        player.seen.set(other.id, other.lookVersion);
      }
      players.push(entry);
    }

    for (const npc of this.npcs.values()) {
      if (npc.dead || npc.plane !== player.plane) continue;
      if (chebyshev(player.x, player.y, npc.x, npc.y) > VIEW_RADIUS) continue;
      npcs.push({
        id: npc.id,
        type: npc.type,
        name: npc.name,
        x: npc.x,
        y: npc.y,
        dir: npc.dir,
        hp: npc.hp,
        maxHp: npc.maxHp,
        level: npc.def.level || 0,
        friendly: Boolean(npc.def.friendly),
        art: npc.def.art,
        anim: npc.anim ? npc.anim.kind : null
      });
    }

    for (const item of this.groundItems.values()) {
      if (item.plane !== player.plane) continue;
      if (chebyshev(player.x, player.y, item.x, item.y) > VIEW_RADIUS) continue;
      items.push({ id: item.id, itemId: item.itemId, count: item.count, x: item.x, y: item.y });
    }

    for (const obj of planeAt(this.world, player.plane).objects) {
      if (chebyshev(player.x, player.y, obj.x, obj.y) > VIEW_RADIUS) continue;
      if (obj.depletedUntil > this.tickCount) objects.push({ id: obj.id, depleted: true });
    }
    for (const obj of this.dynamicObjects.values()) {
      if (obj.plane !== player.plane) continue;
      if (chebyshev(player.x, player.y, obj.x, obj.y) > VIEW_RADIUS) continue;
      objects.push({ id: obj.id, type: obj.type, x: obj.x, y: obj.y, dynamic: true });
    }

    this.send(player.id, 'state', {
      tick: this.tickCount,
      self: {
        x: player.x,
        y: player.y,
        plane: player.plane,
        dir: player.dir,
        hp: player.hp,
        maxHp: this.maxHp(player),
        energy: Math.round(player.energy),
        run: player.run,
        style: player.attackStyle,
        dead: player.dead,
        inCombat: player.combat.timer > 0,
        targetId: player.combat.targetId,
        region: regionAt(this.world, player.x, player.y, player.plane).name,
        busy: Boolean(player.action)
      },
      players,
      npcs,
      items,
      objects,
      splats: player.splats.slice()
    });
  }
}

// ---------------------------------------------------------------- utilities

/** Keeps a loaded save on a plane that actually exists. */
function clampPlane(value) {
  const plane = Math.floor(Number(value));
  return Number.isFinite(plane) && plane >= 0 && plane < PLANE_COUNT ? plane : SURFACE;
}

function directionBetween(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'east' : 'west';
  if (dy !== 0) return dy > 0 ? 'south' : 'north';
  return null;
}

function directionTo(from, to) {
  return directionBetween(from.x, from.y, to.x, to.y) || from.dir || 'south';
}

/**
 * Chat filter. DeviousMud is meant to be readable over a child's shoulder, so
 * the server strips anything that looks like an address or a rude word before
 * the text ever reaches another player.
 */
const BLOCKED_PATTERNS = [
  /\bhttps?:\/\/\S+/gi,
  /\b[\w.+-]+@[\w-]+\.[\w.]+\b/gi,
  /\b\d[\d\s().-]{7,}\d\b/g
];

const BLOCKED_WORDS = ['damn', 'hell', 'crap', 'stupid', 'idiot', 'hate you', 'shut up'];

export function filterChat(text) {
  let out = text.replace(/\s+/g, ' ').trim();
  for (const pattern of BLOCKED_PATTERNS) out = out.replace(pattern, '[hidden]');
  for (const word of BLOCKED_WORDS) {
    const re = new RegExp(`\\b${word}\\b`, 'gi');
    out = out.replace(re, (match) => '*'.repeat(match.length));
  }
  return out.slice(0, MAX_CHAT_LENGTH);
}

export function createGame(options) {
  return new Game(options);
}
