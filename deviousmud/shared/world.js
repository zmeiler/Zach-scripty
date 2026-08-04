/**
 * Deterministic world generation.
 *
 * The map is not stored as data - it is *built* from a seed by code that both
 * the server and the browser run. That keeps the download small and means the
 * client never has to be sent 9,216 tiles, while still guaranteeing both sides
 * agree on every wall and tree (verified with a checksum at login).
 *
 * The world is a stack of *planes*. Plane 0 is the surface; planes 1-3 are the
 * mine that descends under Copper Hollow. Each plane owns its own tile array
 * and its own object index, and every accessor in this module takes the plane
 * as an optional last argument that defaults to the surface - so code that only
 * ever cared about the overworld keeps working unchanged.
 */

import { MAP_HEIGHT, MAP_WIDTH, PLANE_COUNT, SURFACE, TILE, BLOCKED_TILES } from './constants.js';

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
  mithril_rock: {
    name: 'Mithril rock', blocked: true, art: 'rock_mithril',
    action: { id: 'mine', label: 'Mine', skill: 'mining', level: 40, xp: 80, tool: 'pickaxe', yields: 'mithril_ore', respawn: 40, verb: 'swing your pickaxe at' }
  },
  adamant_rock: {
    name: 'Adamant rock', blocked: true, art: 'rock_adamant',
    action: { id: 'mine', label: 'Mine', skill: 'mining', level: 55, xp: 130, tool: 'pickaxe', yields: 'adamant_ore', respawn: 70, verb: 'swing your pickaxe at' }
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
  campfire: { name: 'Fire', blocked: true, art: 'fire', temporary: true, light: 4.5, action: { id: 'cook', label: 'Cook on', verb: 'crouch beside' } },
  brazier: {
    name: 'Brazier', blocked: true, height: 2, art: 'brazier', light: 6,
    action: { id: 'warm', label: 'Warm hands at', verb: 'hold your hands out to' }
  },

  // ----------------------------------------------------------------- descent
  // Every one of these carries a `link` on the *instance*: which plane and tile
  // it delivers you to. The type only says what it looks like and what the menu
  // entry reads.
  mine_entrance: {
    name: 'Mine entrance', blocked: false, height: 2, art: 'mine_entrance',
    action: { id: 'climb', label: 'Climb down', verb: 'climb down into' }
  },
  ladder_down: {
    name: 'Ladder', blocked: false, height: 2, art: 'ladder_down',
    action: { id: 'climb', label: 'Climb down', verb: 'take hold of' }
  },
  ladder_up: {
    name: 'Ladder', blocked: false, height: 2, art: 'ladder_up',
    action: { id: 'climb', label: 'Climb up', verb: 'take hold of' }
  },
  mine_cart: {
    name: 'Mine cart', blocked: true, art: 'mine_cart',
    action: { id: 'read', label: 'Search', verb: 'rummage in' }
  }
});

export const REGIONS = Object.freeze([
  { id: 'village', name: 'Emberfall Village', plane: 0, x: 34, y: 40, w: 30, h: 26, music: 'calm' },
  { id: 'woods', name: 'Whispering Woods', plane: 0, x: 22, y: 2, w: 54, h: 36, music: 'woods' },
  { id: 'hollow', name: 'Copper Hollow', plane: 0, x: 2, y: 30, w: 30, h: 38, music: 'cave' },
  { id: 'lake', name: 'Lake Serene', plane: 0, x: 64, y: 26, w: 30, h: 44, music: 'water' },
  { id: 'meadow', name: 'Sunny Meadow', plane: 0, x: 22, y: 66, w: 52, h: 28, music: 'calm' },
  { id: 'mine_upper', name: 'Copper Hollow Mine', plane: 1, x: 0, y: 0, w: MAP_WIDTH, h: MAP_HEIGHT, music: 'cave' },
  { id: 'mine_deep', name: 'The Deep Seam', plane: 2, x: 0, y: 0, w: MAP_WIDTH, h: MAP_HEIGHT, music: 'cave' },
  { id: 'ember_chamber', name: 'The Ember Chamber', plane: 3, x: 0, y: 0, w: MAP_WIDTH, h: MAP_HEIGHT, music: 'cave' }
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
 * One level of the world: its own tiles, its own objects, its own index.
 *
 * `dark` is how much of the plane is unlit, from 0 (broad daylight) to 1 (you
 * see only what your own light reaches). `ambient` is the colour the renderer
 * clears to, which is what makes a cave feel like a cave before a single tile
 * is drawn.
 */
function makePlane(index, id, name, fill, { dark = 0, ambient = '#0a0f14' } = {}) {
  return {
    index,
    id,
    name,
    tiles: new Uint8Array(MAP_WIDTH * MAP_HEIGHT).fill(fill),
    objects: [],
    objectAt: new Map(),
    dark,
    ambient
  };
}

/**
 * Builds the full world. Pure function of the seed.
 */
export function buildWorld(seed = WORLD_SEED) {
  const rng = makeRng(seed);
  const surface = makePlane(SURFACE, 'surface', 'Emberfall', TILE.GRASS);
  const tiles = surface.tiles;

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
    planes: [surface],
    allObjects: [],
    // Surface aliases, so anything that only ever meant "the overworld" reads
    // the way it always did.
    tiles,
    objects: surface.objects,
    objectAt: surface.objectAt,
    buildings: { bank, store, smithy, kitchen },
    regions: REGIONS
  };

  placeObjects(world, rng);
  buildMine(world, rng);
  world.checksum = checksumWorld(world);
  return world;
}

/** The plane a coordinate belongs to, falling back to the surface. */
export function planeAt(world, plane = SURFACE) {
  return world.planes[plane] || world.planes[SURFACE];
}

function tileFree(world, x, y, plane = SURFACE) {
  if (x < 1 || y < 1 || x >= MAP_WIDTH - 1 || y >= MAP_HEIGHT - 1) return false;
  if (planeAt(world, plane).objectAt.has(`${x},${y}`)) return false;
  return true;
}

function addObject(world, type, x, y, plane = SURFACE, extra = null) {
  if (!tileFree(world, x, y, plane)) return null;
  const def = OBJECT_TYPES[type];
  if (!def) return null;
  const level = planeAt(world, plane);
  const tile = level.tiles[idx(x, y)];
  const walkableTile = !BLOCKED_TILES.has(tile);
  if (def.water) {
    if (tile !== TILE.WATER) return null;
  } else if (!walkableTile) {
    return null;
  }
  const obj = { id: `o${world.allObjects.length}`, type, x, y, plane, depletedUntil: 0, ...(extra || {}) };
  level.objects.push(obj);
  level.objectAt.set(`${x},${y}`, obj);
  world.allObjects.push(obj);
  return obj;
}

function nearRoad(x, y) {
  return (Math.abs(y - 51) <= 2 && x >= 28 && x <= 66) || (Math.abs(x - 48) <= 2 && y >= 12 && y <= 84);
}

function placeObjects(world, rng) {
  const { tiles } = world;

  // The mine mouth is claimed before the ore scatter, so a randomly placed rock
  // can never sit on the one tile that has to stay clear.
  world.mineEntrance = addObject(world, 'mine_entrance', 10, 50);

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

// ------------------------------------------------------------------- the mine

/**
 * Three levels under Copper Hollow, hand-laid rather than randomly generated.
 *
 * A random cave is a maze; a designed one is a place. Every room here has a
 * reason to exist - an ore face, a junction, a chamber to fight in - and the
 * corridors between them are short enough that you always know roughly which
 * way is back to the ladder.
 *
 * Rooms are addressed by name so the ladders, ore and (later) creatures can all
 * refer to the same spot without repeating coordinates.
 */
const MINE_LEVELS = [
  {
    plane: 1,
    id: 'mine_upper',
    floor: TILE.CAVE,
    wall: TILE.ROCKFACE,
    rubble: TILE.GRAVEL,
    dark: 0.55,
    ambient: '#0b0906',
    rooms: {
      landing: { x: 40, y: 44, w: 9, h: 8 },
      copper: { x: 24, y: 42, w: 12, h: 10 },
      tin: { x: 26, y: 26, w: 11, h: 9 },
      gallery: { x: 42, y: 26, w: 10, h: 10 },
      iron: { x: 12, y: 34, w: 10, h: 10 },
      coal: { x: 14, y: 54, w: 12, h: 10 },
      hollow: { x: 30, y: 58, w: 12, h: 9 },
      descent: { x: 46, y: 58, w: 9, h: 8 }
    },
    corridors: [
      ['landing', 'copper'], ['copper', 'tin'], ['tin', 'gallery'], ['gallery', 'landing'],
      ['copper', 'iron'], ['iron', 'coal'], ['coal', 'hollow'], ['hollow', 'descent'],
      ['landing', 'descent']
    ],
    ore: [
      { room: 'copper', types: ['copper_rock', 'copper_rock', 'tin_rock'], count: 10 },
      { room: 'tin', types: ['tin_rock', 'tin_rock', 'copper_rock'], count: 9 },
      { room: 'gallery', types: ['iron_rock', 'copper_rock'], count: 7 },
      { room: 'iron', types: ['iron_rock', 'iron_rock', 'coal_rock'], count: 10 },
      { room: 'coal', types: ['coal_rock', 'coal_rock', 'iron_rock'], count: 11 },
      { room: 'hollow', types: ['coal_rock', 'iron_rock'], count: 6 }
    ]
  },
  {
    plane: 2,
    id: 'mine_deep',
    floor: TILE.MINE_FLOOR,
    wall: TILE.MINE_WALL,
    rubble: TILE.GRAVEL,
    dark: 0.78,
    ambient: '#05070b',
    rooms: {
      landing: { x: 46, y: 58, w: 9, h: 8 },
      crossing: { x: 30, y: 56, w: 12, h: 10 },
      seam: { x: 14, y: 52, w: 12, h: 11 },
      fungus: { x: 16, y: 30, w: 13, h: 12 },
      hall: { x: 34, y: 34, w: 14, h: 12 },
      coalface: { x: 50, y: 24, w: 12, h: 12 },
      vault: { x: 52, y: 42, w: 10, h: 10 },
      descent: { x: 34, y: 18, w: 9, h: 8 }
    },
    corridors: [
      ['landing', 'crossing'], ['crossing', 'seam'], ['seam', 'fungus'], ['fungus', 'hall'],
      ['hall', 'crossing'], ['hall', 'coalface'], ['coalface', 'vault'], ['vault', 'landing'],
      ['coalface', 'descent'], ['fungus', 'descent']
    ],
    ore: [
      { room: 'seam', types: ['mithril_rock', 'coal_rock', 'iron_rock'], count: 12 },
      { room: 'coalface', types: ['coal_rock', 'coal_rock', 'iron_rock'], count: 13 },
      { room: 'hall', types: ['iron_rock', 'coal_rock'], count: 8 },
      { room: 'vault', types: ['mithril_rock', 'mithril_rock', 'coal_rock'], count: 8 },
      { room: 'fungus', types: ['coal_rock', 'mithril_rock'], count: 7 }
    ]
  },
  {
    plane: 3,
    id: 'ember_chamber',
    floor: TILE.EMBER,
    wall: TILE.CRYSTAL,
    rubble: TILE.MINE_FLOOR,
    dark: 0.45,
    ambient: '#120604',
    rooms: {
      landing: { x: 34, y: 18, w: 9, h: 8 },
      approach: { x: 35, y: 30, w: 8, h: 10 },
      hall: { x: 26, y: 46, w: 26, h: 22 }
    },
    corridors: [['landing', 'approach'], ['approach', 'hall']],
    ore: [
      { room: 'approach', types: ['adamant_rock', 'mithril_rock'], count: 5 },
      { room: 'landing', types: ['mithril_rock'], count: 3 },
      // Adamant in the boss's own hall: the richest rock in the world is also
      // the one you have to earn the right to stand next to.
      { room: 'hall', types: ['adamant_rock'], count: 7 }
    ]
  }
];

/**
 * The mine's floor plan, published so that creature spawns and quest steps can
 * say "the coal face on level two" instead of repeating a pair of numbers that
 * would then have to be kept in step by hand.
 */
export const MINE_ROOMS = Object.freeze(
  Object.fromEntries(MINE_LEVELS.map((spec) => [spec.plane, spec.rooms]))
);

export function mineRoom(plane, id) {
  const rooms = MINE_ROOMS[plane];
  return (rooms && rooms[id]) || null;
}

function roomCentre(room) {
  return { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
}

/** L-shaped tunnel between two points: along x, then along y. */
function corridor(tiles, ax, ay, bx, by, tile, width = 2) {
  const half = Math.floor(width / 2);
  const x0 = Math.min(ax, bx);
  const x1 = Math.max(ax, bx);
  const y0 = Math.min(ay, by);
  const y1 = Math.max(ay, by);
  fillRect(tiles, x0, ay - half, x1 - x0 + 1, width, tile);
  fillRect(tiles, bx - half, y0, width, y1 - y0 + 1, tile);
}

/**
 * Anything carved gets a wall around it. The rest of the plane stays VOID,
 * which the renderer draws as nothing at all - so a mine level reads as a
 * lit island of rock in the dark rather than a rectangle with a border.
 */
function encloseCarved(level, wall) {
  const { tiles } = level;
  // Decided from a snapshot and applied afterwards: writing walls as we scan
  // would let each new wall seed the next, and the whole plane fills in.
  const ring = [];
  for (let y = 1; y < MAP_HEIGHT - 1; y += 1) {
    for (let x = 1; x < MAP_WIDTH - 1; x += 1) {
      if (tiles[idx(x, y)] !== TILE.VOID) continue;
      let touchesFloor = false;
      for (let dy = -1; dy <= 1 && !touchesFloor; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (tiles[idx(x + dx, y + dy)] !== TILE.VOID) {
            touchesFloor = true;
            break;
          }
        }
      }
      if (touchesFloor) ring.push(idx(x, y));
    }
  }
  for (const i of ring) tiles[i] = wall;
}

function buildMine(world, rng) {
  const built = [];

  for (const spec of MINE_LEVELS) {
    const level = makePlane(spec.plane, spec.id, regionName(spec.id), TILE.VOID, {
      dark: spec.dark,
      ambient: spec.ambient
    });
    world.planes[spec.plane] = level;

    for (const room of Object.values(spec.rooms)) {
      fillRect(level.tiles, room.x, room.y, room.w, room.h, spec.floor);
    }
    for (const [from, to] of spec.corridors) {
      const a = roomCentre(spec.rooms[from]);
      const b = roomCentre(spec.rooms[to]);
      corridor(level.tiles, a.x, a.y, b.x, b.y, spec.floor, spec.plane === 3 ? 3 : 2);
    }
    // A scatter of loose stone, so the floor is not one flat colour.
    for (let i = 0; i < 260; i += 1) {
      const x = 1 + Math.floor(rng() * (MAP_WIDTH - 2));
      const y = 1 + Math.floor(rng() * (MAP_HEIGHT - 2));
      if (level.tiles[idx(x, y)] === spec.floor && rng() < 0.5) level.tiles[idx(x, y)] = spec.rubble;
    }
    encloseCarved(level, spec.wall);
    built.push({ spec, level });
  }

  // Ore faces, placed room by room so each gallery has its own character.
  for (const { spec } of built) {
    for (const patch of spec.ore) {
      const room = spec.rooms[patch.room];
      let placed = 0;
      for (let i = 0; i < patch.count * 6 && placed < patch.count; i += 1) {
        const x = room.x + Math.floor(rng() * room.w);
        const y = room.y + Math.floor(rng() * room.h);
        const type = patch.types[Math.floor(rng() * patch.types.length)];
        if (addObject(world, type, x, y, spec.plane)) placed += 1;
      }
    }
  }

  // --- Stitching the levels together --------------------------------------
  // Each pair of ladders points at the other's tile, so climbing either way
  // leaves you standing at the foot of the one you would use to go back.
  const surfaceEntrance = world.mineEntrance;
  const landings = built.map(({ spec }) => ({ spec, at: roomCentre(spec.rooms.landing) }));
  const descents = built
    .filter(({ spec }) => spec.rooms.descent)
    .map(({ spec }) => ({ spec, at: roomCentre(spec.rooms.descent) }));

  // Surface -> level 1.
  const firstLanding = landings[0];
  const upFromOne = addObject(world, 'ladder_up', firstLanding.at.x, firstLanding.at.y, 1, {
    link: { plane: SURFACE, x: surfaceEntrance.x, y: surfaceEntrance.y }
  });
  surfaceEntrance.link = { plane: 1, x: upFromOne.x, y: upFromOne.y };

  // Level n -> level n+1.
  for (const descent of descents) {
    const below = landings.find((entry) => entry.spec.plane === descent.spec.plane + 1);
    if (!below) continue;
    const up = addObject(world, 'ladder_up', below.at.x, below.at.y, below.spec.plane, {
      link: { plane: descent.spec.plane, x: descent.at.x, y: descent.at.y }
    });
    addObject(world, 'ladder_down', descent.at.x, descent.at.y, descent.spec.plane, {
      link: { plane: below.spec.plane, x: up.x, y: up.y }
    });
  }

  // A little dressing so the galleries look worked rather than found, and a
  // brazier at every landing - whatever else happens, the foot of a ladder is
  // somewhere you can see.
  for (const { spec } of built) {
    for (const room of Object.values(spec.rooms)) {
      if (rng() < 0.45) addObject(world, 'mine_cart', room.x + 1, room.y + 1, spec.plane);
    }
    const landing = spec.rooms.landing;
    addObject(world, 'brazier', landing.x + 1, landing.y + 1, spec.plane);
    addObject(world, 'brazier', landing.x + landing.w - 2, landing.y + landing.h - 2, spec.plane);
  }

  // The Ember Chamber is lit for a fight: braziers down the long walls.
  const chamber = MINE_LEVELS[MINE_LEVELS.length - 1];
  const hall = chamber.rooms.hall;
  for (let i = 0; i < 4; i += 1) {
    const y = hall.y + 3 + Math.floor((i * (hall.h - 6)) / 3);
    addObject(world, 'brazier', hall.x + 2, y, chamber.plane);
    addObject(world, 'brazier', hall.x + hall.w - 3, y, chamber.plane);
  }
}

function regionName(id) {
  const region = REGIONS.find((entry) => entry.id === id);
  return region ? region.name : 'The Deep';
}

/**
 * Order-independent-ish checksum used to prove client and server generated the
 * same map. Cheap, and good enough to catch a stale cached build.
 */
/**
 * Everything on a plane that gives off light of its own, as
 * `{ x, y, radius }`. Built once at generation time: static lights never move,
 * so there is nothing to recompute per frame.
 */
export function planeLights(world, plane = SURFACE) {
  const level = planeAt(world, plane);
  if (!level.lights) {
    level.lights = level.objects
      .filter((obj) => OBJECT_TYPES[obj.type] && OBJECT_TYPES[obj.type].light)
      .map((obj) => ({ x: obj.x, y: obj.y, radius: OBJECT_TYPES[obj.type].light }));
  }
  return level.lights;
}

export function checksumWorld(world) {
  let h = 2166136261 >>> 0;
  for (const level of world.planes) {
    for (let i = 0; i < level.tiles.length; i += 1) {
      h ^= level.tiles[i];
      h = Math.imul(h, 16777619) >>> 0;
    }
  }
  for (const obj of world.allObjects) {
    for (const ch of `${obj.type}:${obj.plane}:${obj.x}:${obj.y};`) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619) >>> 0;
    }
  }
  return h >>> 0;
}

export function tileAt(world, x, y, plane = SURFACE) {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return TILE.WALL;
  return planeAt(world, plane).tiles[y * world.width + x];
}

export function objectAt(world, x, y, plane = SURFACE) {
  return planeAt(world, plane).objectAt.get(`${x},${y}`) || null;
}

/** True when a character may stand on this tile right now. */
export function isWalkable(world, x, y, plane = SURFACE) {
  const tile = tileAt(world, x, y, plane);
  if (BLOCKED_TILES.has(tile)) return false;
  const obj = objectAt(world, x, y, plane);
  if (obj) {
    // Stumps and spent rock faces still occupy their tile, so blocking does not
    // depend on whether the resource is currently depleted.
    const def = OBJECT_TYPES[obj.type];
    if (def && def.blocked) return false;
  }
  return true;
}

export function regionAt(world, x, y, plane = SURFACE) {
  for (const region of world.regions) {
    if ((region.plane ?? SURFACE) !== plane) continue;
    if (x >= region.x && x < region.x + region.w && y >= region.y && y < region.y + region.h) return region;
  }
  if (plane !== SURFACE) return { id: 'deep', name: planeAt(world, plane).name, music: 'cave' };
  return { id: 'wilds', name: 'The Outskirts', music: 'calm' };
}

/** How dark a plane is, 0 (daylight) to 1 (only your own light reaches). */
export function planeDarkness(world, plane = SURFACE) {
  return planeAt(world, plane).dark || 0;
}
