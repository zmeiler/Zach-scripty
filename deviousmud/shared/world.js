/**
 * Deterministic world generation.
 *
 * The map is not stored as data - it is *built* from a seed by code that both
 * the server and the browser run. That keeps the download small and means the
 * client never has to be sent 9,216 tiles, while still guaranteeing both sides
 * agree on every wall and tree (verified with a checksum at login).
 */

import { MAP_HEIGHT, MAP_WIDTH, TILE, BLOCKED_TILES } from './constants.js';

export const WORLD_SEED = 20240801;

/** Small, fast, fully deterministic PRNG (mulberry32). */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const OBJECT_TYPES = Object.freeze({
  tree: {
    name: 'Tree', blocked: true, height: 2, art: 'tree',
    action: { id: 'chop', label: 'Chop down', skill: 'woodcutting', level: 1, xp: 25, tool: 'axe', yields: 'logs', respawn: 12, verb: 'swing your axe at' }
  },
  oak_tree: {
    name: 'Oak', blocked: true, height: 2, art: 'oak',
    action: { id: 'chop', label: 'Chop down', skill: 'woodcutting', level: 15, xp: 38, tool: 'axe', yields: 'oak_logs', respawn: 20, verb: 'swing your axe at' }
  },
  willow_tree: {
    name: 'Willow', blocked: true, height: 2, art: 'willow',
    action: { id: 'chop', label: 'Chop down', skill: 'woodcutting', level: 30, xp: 68, tool: 'axe', yields: 'willow_logs', respawn: 25, verb: 'swing your axe at' }
  },
  copper_rock: {
    name: 'Copper rock', blocked: true, art: 'rock_copper',
    action: { id: 'mine', label: 'Mine', skill: 'mining', level: 1, xp: 18, tool: 'pickaxe', yields: 'copper_ore', respawn: 8, verb: 'swing your pickaxe at' }
  },
  tin_rock: {
    name: 'Tin rock', blocked: true, art: 'rock_tin',
    action: { id: 'mine', label: 'Mine', skill: 'mining', level: 1, xp: 18, tool: 'pickaxe', yields: 'tin_ore', respawn: 8, verb: 'swing your pickaxe at' }
  },
  iron_rock: {
    name: 'Iron rock', blocked: true, art: 'rock_iron',
    action: { id: 'mine', label: 'Mine', skill: 'mining', level: 15, xp: 35, tool: 'pickaxe', yields: 'iron_ore', respawn: 16, verb: 'swing your pickaxe at' }
  },
  coal_rock: {
    name: 'Coal rock', blocked: true, art: 'rock_coal',
    action: { id: 'mine', label: 'Mine', skill: 'mining', level: 30, xp: 50, tool: 'pickaxe', yields: 'coal', respawn: 26, verb: 'swing your pickaxe at' }
  },
  shrimp_spot: {
    name: 'Fishing spot', blocked: false, water: true, art: 'fish_spot',
    action: { id: 'fish', label: 'Net', skill: 'fishing', level: 1, xp: 10, tool: 'net', yields: 'raw_shrimp', respawn: 0, verb: 'cast your net into' }
  },
  trout_spot: {
    name: 'Fishing spot', blocked: false, water: true, art: 'fish_spot',
    action: { id: 'fish', label: 'Lure', skill: 'fishing', level: 20, xp: 50, tool: 'rod', yields: 'raw_trout', respawn: 0, verb: 'cast your line into' }
  },
  salmon_spot: {
    name: 'Fishing spot', blocked: false, water: true, art: 'fish_spot',
    action: { id: 'fish', label: 'Lure', skill: 'fishing', level: 30, xp: 70, tool: 'rod', yields: 'raw_salmon', respawn: 0, verb: 'cast your line into' }
  },
  bank_booth: { name: 'Bank booth', blocked: true, art: 'bank', action: { id: 'bank', label: 'Use', verb: 'step up to' } },
  shop_counter: { name: 'Shop counter', blocked: true, art: 'counter', action: { id: 'shop', label: 'Trade', shop: 'general_store', verb: 'lean on' } },
  furnace: { name: 'Furnace', blocked: true, height: 2, art: 'furnace', action: { id: 'smelt', label: 'Smelt', verb: 'open' } },
  anvil: { name: 'Anvil', blocked: true, art: 'anvil', action: { id: 'smith', label: 'Smith', verb: 'stand at' } },
  range: { name: 'Cooking range', blocked: true, art: 'range', action: { id: 'cook', label: 'Cook on', verb: 'open' } },
  fountain: { name: 'Fountain', blocked: true, art: 'fountain', action: { id: 'drink', label: 'Drink from', verb: 'cup your hands in' } },
  signpost: { name: 'Signpost', blocked: true, art: 'sign', action: { id: 'read', label: 'Read', verb: 'squint at' } },
  campfire: { name: 'Fire', blocked: true, art: 'fire', temporary: true, action: { id: 'cook', label: 'Cook on', verb: 'crouch beside' } }
});

export const REGIONS = Object.freeze([
  { id: 'village', name: 'Emberfall Village', x: 34, y: 40, w: 30, h: 26, music: 'calm' },
  { id: 'woods', name: 'Whispering Woods', x: 22, y: 2, w: 54, h: 36, music: 'woods' },
  { id: 'hollow', name: 'Copper Hollow', x: 2, y: 30, w: 30, h: 38, music: 'cave' },
  { id: 'lake', name: 'Lake Serene', x: 64, y: 26, w: 30, h: 44, music: 'water' },
  { id: 'meadow', name: 'Sunny Meadow', x: 22, y: 66, w: 52, h: 28, music: 'calm' }
]);

function idx(x, y) {
  return y * MAP_WIDTH + x;
}

function fillRect(tiles, x, y, w, h, tile) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      if (xx < 0 || yy < 0 || xx >= MAP_WIDTH || yy >= MAP_HEIGHT) continue;
      tiles[idx(xx, yy)] = tile;
    }
  }
}

function strokeRect(tiles, x, y, w, h, tile) {
  for (let xx = x; xx < x + w; xx += 1) {
    if (xx >= 0 && xx < MAP_WIDTH) {
      if (y >= 0) tiles[idx(xx, y)] = tile;
      if (y + h - 1 < MAP_HEIGHT) tiles[idx(xx, y + h - 1)] = tile;
    }
  }
  for (let yy = y; yy < y + h; yy += 1) {
    if (yy >= 0 && yy < MAP_HEIGHT) {
      if (x >= 0) tiles[idx(x, yy)] = tile;
      if (x + w - 1 < MAP_WIDTH) tiles[idx(x + w - 1, yy)] = tile;
    }
  }
}

/**
 * A building is a walled rectangle with a plank floor and a one-tile doorway.
 * `door` is 'south' | 'north' | 'east' | 'west'.
 */
function placeBuilding(tiles, x, y, w, h, door) {
  fillRect(tiles, x, y, w, h, TILE.PLANK);
  strokeRect(tiles, x, y, w, h, TILE.WALL);
  const cx = x + Math.floor(w / 2);
  const cy = y + Math.floor(h / 2);
  if (door === 'south') tiles[idx(cx, y + h - 1)] = TILE.PLANK;
  if (door === 'north') tiles[idx(cx, y)] = TILE.PLANK;
  if (door === 'west') tiles[idx(x, cy)] = TILE.PLANK;
  if (door === 'east') tiles[idx(x + w - 1, cy)] = TILE.PLANK;
  return { x, y, w, h, door, doorTile: door === 'south' ? { x: cx, y: y + h - 1 } : door === 'north' ? { x: cx, y } : door === 'west' ? { x, y: cy } : { x: x + w - 1, y: cy } };
}

function road(tiles, x1, y1, x2, y2, width = 3, tile = TILE.PATH) {
  const half = Math.floor(width / 2);
  if (y1 === y2) {
    fillRect(tiles, Math.min(x1, x2), y1 - half, Math.abs(x2 - x1) + 1, width, tile);
  } else if (x1 === x2) {
    fillRect(tiles, x1 - half, Math.min(y1, y2), width, Math.abs(y2 - y1) + 1, tile);
  }
}

/**
 * Builds the full world. Pure function of the seed.
 */
export function buildWorld(seed = WORLD_SEED) {
  const rng = makeRng(seed);
  const tiles = new Uint8Array(MAP_WIDTH * MAP_HEIGHT).fill(TILE.GRASS);

  // --- Terrain bands -------------------------------------------------------
  // Northern woods get a darker grass so the region reads at a glance.
  fillRect(tiles, 0, 0, MAP_WIDTH, 34, TILE.DARKGRASS);
  // Southern meadow gets flower speckles later.
  fillRect(tiles, 0, 68, MAP_WIDTH, MAP_HEIGHT - 68, TILE.GRASS);

  // --- Lake Serene (east) --------------------------------------------------
  const lakeCx = 80;
  const lakeCy = 48;
  for (let y = 20; y < 78; y += 1) {
    for (let x = 62; x < MAP_WIDTH; x += 1) {
      const nx = (x - lakeCx) / 15;
      const ny = (y - lakeCy) / 24;
      const wobble = Math.sin(y * 0.45) * 0.06 + Math.cos(x * 0.5) * 0.05;
      const d = nx * nx + ny * ny + wobble;
      if (d < 0.85) tiles[idx(x, y)] = TILE.WATER;
      else if (d < 1.02) tiles[idx(x, y)] = TILE.SAND;
    }
  }

  // --- Copper Hollow (west quarry) ----------------------------------------
  fillRect(tiles, 4, 32, 26, 34, TILE.CAVE);
  strokeRect(tiles, 4, 32, 26, 34, TILE.ROCKFACE);
  fillRect(tiles, 6, 34, 22, 30, TILE.CAVE);
  // Scatter rubble inside the quarry.
  for (let i = 0; i < 90; i += 1) {
    const x = 6 + Math.floor(rng() * 22);
    const y = 34 + Math.floor(rng() * 30);
    if (rng() < 0.35) tiles[idx(x, y)] = TILE.GRAVEL;
  }
  // Quarry mouth on the east wall, aligned with the main road.
  fillRect(tiles, 29, 50, 2, 3, TILE.GRAVEL);
  tiles[idx(29, 51)] = TILE.GRAVEL;

  // --- Roads ---------------------------------------------------------------
  road(tiles, 28, 51, 66, 51, 3);          // west quarry -> village -> lake
  road(tiles, 48, 12, 48, 84, 3);          // woods -> village -> meadow
  road(tiles, 30, 51, 30, 51, 3, TILE.GRAVEL);

  // --- Emberfall Village ---------------------------------------------------
  fillRect(tiles, 38, 42, 22, 20, TILE.PATH);
  const bank = placeBuilding(tiles, 38, 42, 9, 7, 'south');
  const store = placeBuilding(tiles, 51, 42, 9, 7, 'south');
  const smithy = placeBuilding(tiles, 38, 56, 9, 7, 'north');
  const kitchen = placeBuilding(tiles, 51, 56, 9, 7, 'north');
  // Village square around the spawn point.
  fillRect(tiles, 44, 50, 10, 4, TILE.STONE);

  // --- Meadow flowers ------------------------------------------------------
  for (let i = 0; i < 260; i += 1) {
    const x = 20 + Math.floor(rng() * 56);
    const y = 68 + Math.floor(rng() * 24);
    if (tiles[idx(x, y)] === TILE.GRASS) tiles[idx(x, y)] = TILE.FLOWERS;
  }

  const world = {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    tiles,
    buildings: { bank, store, smithy, kitchen },
    objects: [],
    objectAt: new Map(),
    regions: REGIONS
  };

  placeObjects(world, rng);
  world.checksum = checksumWorld(world);
  return world;
}

function tileFree(world, x, y) {
  if (x < 1 || y < 1 || x >= MAP_WIDTH - 1 || y >= MAP_HEIGHT - 1) return false;
  if (world.objectAt.has(`${x},${y}`)) return false;
  return true;
}

function addObject(world, type, x, y) {
  if (!tileFree(world, x, y)) return null;
  const def = OBJECT_TYPES[type];
  if (!def) return null;
  const tile = world.tiles[idx(x, y)];
  const walkableTile = !BLOCKED_TILES.has(tile);
  if (def.water) {
    if (tile !== TILE.WATER) return null;
  } else if (!walkableTile) {
    return null;
  }
  const obj = { id: `o${world.objects.length}`, type, x, y, depletedUntil: 0 };
  world.objects.push(obj);
  world.objectAt.set(`${x},${y}`, obj);
  return obj;
}

function nearRoad(x, y) {
  return (Math.abs(y - 51) <= 2 && x >= 28 && x <= 66) || (Math.abs(x - 48) <= 2 && y >= 12 && y <= 84);
}

function placeObjects(world, rng) {
  const { tiles } = world;

  // Whispering Woods: ordinary trees everywhere, oaks in clusters, willows by
  // the northern lake shore.
  for (let i = 0; i < 420; i += 1) {
    const x = 4 + Math.floor(rng() * 68);
    const y = 3 + Math.floor(rng() * 30);
    if (nearRoad(x, y)) continue;
    if (tiles[idx(x, y)] !== TILE.DARKGRASS) continue;
    const roll = rng();
    const type = roll < 0.72 ? 'tree' : roll < 0.94 ? 'oak_tree' : 'willow_tree';
    addObject(world, type, x, y);
  }
  // A few trees around the village edges so beginners do not have to walk far.
  for (let i = 0; i < 60; i += 1) {
    const x = 30 + Math.floor(rng() * 36);
    const y = 36 + Math.floor(rng() * 32);
    if (nearRoad(x, y)) continue;
    if (x >= 36 && x <= 62 && y >= 40 && y <= 64) continue;
    if (tiles[idx(x, y)] !== TILE.GRASS) continue;
    addObject(world, rng() < 0.85 ? 'tree' : 'oak_tree', x, y);
  }
  // Willows love the water's edge.
  for (let i = 0; i < 70; i += 1) {
    const x = 60 + Math.floor(rng() * 12);
    const y = 20 + Math.floor(rng() * 56);
    if (tiles[idx(x, y)] !== TILE.SAND && tiles[idx(x, y)] !== TILE.GRASS) continue;
    if (rng() < 0.4) addObject(world, 'willow_tree', x, y);
  }

  // Copper Hollow: copper and tin near the mouth, iron deeper, coal at the back.
  for (let i = 0; i < 150; i += 1) {
    const x = 6 + Math.floor(rng() * 22);
    const y = 34 + Math.floor(rng() * 30);
    if (tiles[idx(x, y)] !== TILE.CAVE && tiles[idx(x, y)] !== TILE.GRAVEL) continue;
    const depth = 1 - (x - 6) / 22; // 0 at the mouth, 1 at the far wall
    const roll = rng();
    let type = null;
    if (depth < 0.35) type = roll < 0.5 ? 'copper_rock' : roll < 0.8 ? 'tin_rock' : null;
    else if (depth < 0.7) type = roll < 0.35 ? 'copper_rock' : roll < 0.75 ? 'iron_rock' : null;
    else type = roll < 0.4 ? 'iron_rock' : roll < 0.8 ? 'coal_rock' : null;
    if (type) addObject(world, type, x, y);
  }
  // Two starter rocks right by the village so the first quest never stalls.
  addObject(world, 'copper_rock', 35, 47);
  addObject(world, 'tin_rock', 35, 49);

  // Lake Serene: fishing spots on water tiles that touch the shore.
  const shoreSpots = [];
  for (let y = 22; y < 76; y += 1) {
    for (let x = 63; x < MAP_WIDTH - 1; x += 1) {
      if (tiles[idx(x, y)] !== TILE.WATER) continue;
      const touchesLand =
        tiles[idx(x - 1, y)] !== TILE.WATER ||
        tiles[idx(x, y - 1)] !== TILE.WATER ||
        tiles[idx(x, y + 1)] !== TILE.WATER;
      if (touchesLand) shoreSpots.push({ x, y });
    }
  }
  for (let i = 0; i < shoreSpots.length; i += 1) {
    const spot = shoreSpots[i];
    if (i % 5 !== 0) continue;
    const roll = rng();
    const type = roll < 0.55 ? 'shrimp_spot' : roll < 0.85 ? 'trout_spot' : 'salmon_spot';
    addObject(world, type, spot.x, spot.y);
  }

  // Village fixtures.
  const { bank, store, smithy, kitchen } = world.buildings;
  addObject(world, 'bank_booth', bank.x + 3, bank.y + 1);
  addObject(world, 'bank_booth', bank.x + 5, bank.y + 1);
  addObject(world, 'shop_counter', store.x + 3, store.y + 1);
  addObject(world, 'shop_counter', store.x + 5, store.y + 1);
  addObject(world, 'furnace', smithy.x + 2, smithy.y + 4);
  addObject(world, 'anvil', smithy.x + 6, smithy.y + 4);
  addObject(world, 'range', kitchen.x + 4, kitchen.y + 4);
  addObject(world, 'fountain', 48, 51);
  addObject(world, 'signpost', 46, 54);
  addObject(world, 'signpost', 30, 48);
  addObject(world, 'signpost', 62, 51);
}

/**
 * Order-independent-ish checksum used to prove client and server generated the
 * same map. Cheap, and good enough to catch a stale cached build.
 */
export function checksumWorld(world) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < world.tiles.length; i += 1) {
    h ^= world.tiles[i];
    h = Math.imul(h, 16777619) >>> 0;
  }
  for (const obj of world.objects) {
    for (const ch of `${obj.type}:${obj.x}:${obj.y};`) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619) >>> 0;
    }
  }
  return h >>> 0;
}

export function tileAt(world, x, y) {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return TILE.WALL;
  return world.tiles[y * world.width + x];
}

export function objectAt(world, x, y) {
  return world.objectAt.get(`${x},${y}`) || null;
}

/** True when a character may stand on this tile right now. */
export function isWalkable(world, x, y) {
  const tile = tileAt(world, x, y);
  if (BLOCKED_TILES.has(tile)) return false;
  const obj = objectAt(world, x, y);
  if (obj) {
    // Stumps and spent rock faces still occupy their tile, so blocking does not
    // depend on whether the resource is currently depleted.
    const def = OBJECT_TYPES[obj.type];
    if (def && def.blocked) return false;
  }
  return true;
}

export function regionAt(world, x, y) {
  for (const region of world.regions) {
    if (x >= region.x && x < region.x + region.w && y >= region.y && y < region.y + region.h) return region;
  }
  return { id: 'wilds', name: 'The Outskirts', music: 'calm' };
}
