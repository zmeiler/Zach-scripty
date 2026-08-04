/**
 * Global tuning values shared by the server simulation and the browser client.
 * Nothing in this file may depend on Node or DOM APIs.
 */

export const GAME_NAME = 'DeviousMud';
export const PROTOCOL_VERSION = 3;

/** Length of a single simulation step in milliseconds. */
export const TICK_MS = 600;

/** Rendering size of one world tile, in CSS pixels at zoom 1. */
export const TILE_SIZE = 32;

export const MAP_WIDTH = 96;
export const MAP_HEIGHT = 96;

/** Tiles of world state streamed around each player. */
export const VIEW_RADIUS = 17;

export const INVENTORY_SIZE = 28;
export const BANK_SIZE = 120;
export const TRADE_SIZE = 8;

export const MAX_NAME_LENGTH = 12;
export const MIN_NAME_LENGTH = 3;
export const MAX_CHAT_LENGTH = 120;

/** Where a new (or defeated) player wakes up. */
export const SPAWN_POINT = { x: 48, y: 52 };

/** Run energy drains while running and regenerates while walking. */
export const RUN_ENERGY_MAX = 100;
export const RUN_DRAIN_PER_TICK = 1.1;
export const RUN_REGEN_PER_TICK = 0.55;

/** Hitpoints regenerate one point on this cadence when out of combat. */
export const HP_REGEN_TICKS = 50;

/** Ticks a player stays "in combat" after the last hit landed. */
export const COMBAT_TIMEOUT_TICKS = 12;

/** Ground items belong to their dropper for this long, then go public. */
export const LOOT_PRIVATE_TICKS = 100;
export const LOOT_DESPAWN_TICKS = 300;

export const TILE = {
  GRASS: 0,
  PATH: 1,
  WATER: 2,
  STONE: 3,
  WALL: 4,
  PLANK: 5,
  SAND: 6,
  BRIDGE: 7,
  CAVE: 8,
  ROCKFACE: 9,
  FLOWERS: 10,
  DARKGRASS: 11,
  GRAVEL: 12,
  // Underground. The mine reads as three distinct places, so each level gets
  // its own floor and wall rather than re-tinting the same pair.
  MINE_FLOOR: 13,
  MINE_WALL: 14,
  EMBER: 15,
  CRYSTAL: 16,
  VOID: 17
};

/** Tiles a character can never stand on. */
export const BLOCKED_TILES = new Set([
  TILE.WATER,
  TILE.WALL,
  TILE.ROCKFACE,
  TILE.MINE_WALL,
  TILE.CRYSTAL,
  TILE.VOID
]);

/**
 * The world has a vertical dimension. Plane 0 is the surface; 1-3 descend into
 * the mine below Copper Hollow. Every entity carries a `plane`, and nothing on
 * one plane can see, path to or hit anything on another.
 */
export const PLANE_COUNT = 4;
export const SURFACE = 0;

export const SKILLS = [
  'attack',
  'strength',
  'defence',
  'hitpoints',
  'woodcutting',
  'mining',
  'fishing',
  'cooking',
  'firemaking',
  'smithing'
];

export const COMBAT_SKILLS = ['attack', 'strength', 'defence', 'hitpoints'];

export const EQUIP_SLOTS = [
  'head',
  'cape',
  'amulet',
  'weapon',
  'body',
  'shield',
  'legs',
  'gloves',
  'boots',
  'ring'
];

export const MAX_LEVEL = 99;

/** Client-side interface hints that the server also validates against. */
export const INTERACT = {
  NPC: 'npc',
  OBJECT: 'object',
  PLAYER: 'player',
  GROUND_ITEM: 'ground_item'
};

export const CHAT_CHANNELS = ['game', 'public', 'private', 'system'];
