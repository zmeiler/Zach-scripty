/**
 * NPC definitions and their spawn points.
 *
 * Everything here is deliberately family friendly: monsters are mischievous
 * rather than gruesome, "defeated" creatures scamper off, and no NPC ever says
 * anything a parent would mind reading over a shoulder.
 */

import { mineRoom } from './world.js';

export const NPC_TYPES = Object.freeze({
  // ------------------------------------------------------------- townsfolk
  mayor_aldric: {
    name: 'Mayor Aldric', friendly: true, art: 'mayor', examine: 'The cheerful mayor of Emberfall.',
    dialogue: 'mayor_aldric', wander: 1
  },
  shopkeeper_bea: {
    name: 'Shopkeeper Bea', friendly: true, art: 'shopkeeper', examine: 'She runs the general store.',
    dialogue: 'shopkeeper_bea', shop: 'general_store', wander: 0
  },
  banker_cyrus: {
    name: 'Banker Cyrus', friendly: true, art: 'banker', examine: 'He guards everyone\'s odds and ends.',
    dialogue: 'banker_cyrus', bank: true, wander: 0
  },
  woodsman_willow: {
    name: 'Woodsman Willow', friendly: true, art: 'woodsman', examine: 'She knows every tree by name.',
    dialogue: 'woodsman_willow', wander: 2
  },
  miner_mira: {
    name: 'Miner Mira', friendly: true, art: 'miner', examine: 'Covered head to boot in copper dust.',
    dialogue: 'miner_mira', wander: 2
  },
  fisher_finn: {
    name: 'Fisher Finn', friendly: true, art: 'fisher', examine: 'He has been waiting for a bite since dawn.',
    dialogue: 'fisher_finn', wander: 1
  },
  captain_rook: {
    name: 'Captain Rook', friendly: true, art: 'guard', examine: 'Captain of the village watch.',
    dialogue: 'captain_rook', wander: 1
  },
  tutor_pip: {
    name: 'Tutor Pip', friendly: true, art: 'tutor', examine: 'Always happy to explain something twice.',
    dialogue: 'tutor_pip', wander: 1
  },
  foreman_dorn: {
    name: 'Foreman Dorn', friendly: true, art: 'foreman', examine: 'He has waited thirty years for the mine to reopen.',
    dialogue: 'foreman_dorn', wander: 0
  },
  foreman_dorn: {
    name: 'Foreman Dorn', friendly: true, art: 'foreman', examine: 'He has been waiting for the mine to reopen for thirty years.',
    dialogue: 'foreman_dorn', wander: 0
  },

  // -------------------------------------------------------------- creatures
  giant_rat: {
    name: 'Giant rat', art: 'rat', examine: 'It is a very large rat. Not a fan of brooms.',
    level: 2, hp: 6, maxHit: 1, attack: 1, defence: 1, aggressive: false, respawn: 25, xpMultiplier: 1,
    drops: [{ id: 'coins', min: 1, max: 8, chance: 0.7 }]
  },
  goblin_scamp: {
    name: 'Goblin scamp', art: 'goblin', examine: 'A small goblin with a big grin.',
    level: 5, hp: 12, maxHit: 2, attack: 4, defence: 3, aggressive: false, respawn: 30,
    drops: [
      { id: 'coins', min: 3, max: 22, chance: 0.85 },
      { id: 'bronze_dagger', chance: 0.08 },
      { id: 'bread', chance: 0.12 }
    ]
  },
  forest_wolf: {
    name: 'Forest wolf', art: 'wolf', examine: 'Grey, quick, and mostly bluffing.',
    level: 11, hp: 24, maxHit: 4, attack: 11, defence: 9, aggressive: true, respawn: 40,
    drops: [
      { id: 'wolf_pelt', chance: 0.5 },
      { id: 'coins', min: 8, max: 45, chance: 0.8 },
      { id: 'raw_trout', chance: 0.1 }
    ]
  },
  cave_imp: {
    name: 'Cave imp', art: 'imp', examine: 'It borrows things and forgets to give them back.',
    level: 14, hp: 30, maxHit: 5, attack: 14, defence: 12, aggressive: false, respawn: 45,
    drops: [
      { id: 'coins', min: 10, max: 60, chance: 0.85 },
      { id: 'lantern_glass', chance: 0.22 },
      { id: 'copper_ore', min: 1, max: 3, chance: 0.3 },
      { id: 'copper_amulet', chance: 0.05 }
    ]
  },
  rock_golem: {
    name: 'Rock golem', art: 'golem', examine: 'A pile of rocks with strong opinions.',
    level: 24, hp: 55, maxHit: 8, attack: 24, defence: 26, aggressive: true, respawn: 60,
    drops: [
      { id: 'coins', min: 25, max: 140, chance: 0.9 },
      { id: 'iron_ore', min: 1, max: 4, chance: 0.5 },
      { id: 'coal', min: 1, max: 3, chance: 0.35 },
      { id: 'ancient_coin', chance: 0.15 },
      { id: 'steel_bar', chance: 0.08 }
    ]
  },
  meadow_boar: {
    name: 'Meadow boar', art: 'boar', examine: 'It really likes flowers.',
    level: 8, hp: 18, maxHit: 3, attack: 8, defence: 6, aggressive: false, respawn: 35,
    drops: [
      { id: 'coins', min: 5, max: 30, chance: 0.8 },
      { id: 'meadow_flower', chance: 0.3 }
    ]
  },

  // ------------------------------------------------- Copper Hollow Mine (1)
  cave_bat: {
    name: 'Cave bat', art: 'bat', examine: 'It would rather you turned the light off.',
    level: 7, hp: 16, maxHit: 2, attack: 7, defence: 5, aggressive: false, respawn: 28,
    drops: [
      { id: 'coins', min: 4, max: 26, chance: 0.8 },
      { id: 'bat_wing', chance: 0.45 }
    ]
  },
  tunnel_crawler: {
    name: 'Tunnel crawler', art: 'crawler', examine: 'Many legs, no manners.',
    level: 12, hp: 28, maxHit: 4, attack: 12, defence: 9, aggressive: false, respawn: 34,
    drops: [
      { id: 'coins', min: 8, max: 48, chance: 0.85 },
      { id: 'copper_ore', min: 1, max: 3, chance: 0.3 },
      { id: 'tin_ore', min: 1, max: 3, chance: 0.3 }
    ]
  },
  dust_sprite: {
    name: 'Dust sprite', art: 'sprite', examine: 'A small cloud with opinions.',
    level: 17, hp: 34, maxHit: 5, attack: 17, defence: 12, aggressive: true, respawn: 42,
    drops: [
      { id: 'coins', min: 15, max: 80, chance: 0.9 },
      { id: 'iron_ore', min: 1, max: 3, chance: 0.35 },
      { id: 'torch', chance: 0.14 }
    ]
  },

  // ----------------------------------------------------- The Deep Seam (2)
  coal_lurker: {
    name: 'Coal lurker', art: 'lurker', examine: 'It hides in the coal and hopes.',
    level: 25, hp: 54, maxHit: 7, attack: 25, defence: 18, aggressive: false, respawn: 48,
    drops: [
      { id: 'coins', min: 25, max: 140, chance: 0.9 },
      { id: 'coal', min: 2, max: 6, chance: 0.6 },
      { id: 'iron_ore', min: 1, max: 4, chance: 0.3 }
    ]
  },
  shale_hound: {
    name: 'Shale hound', art: 'hound', examine: 'Grey, quick, and made mostly of slate.',
    level: 31, hp: 68, maxHit: 9, attack: 31, defence: 22, aggressive: true, respawn: 54,
    drops: [
      { id: 'coins', min: 40, max: 210, chance: 0.92 },
      { id: 'coal', min: 2, max: 8, chance: 0.55 },
      { id: 'mithril_ore', chance: 0.12 },
      { id: 'miners_boots', chance: 0.05 }
    ]
  },
  deep_golem: {
    name: 'Deep golem', art: 'deep_golem', examine: 'A rock golem that never saw the sun.',
    level: 37, hp: 88, maxHit: 11, attack: 37, defence: 30, aggressive: true, respawn: 66, size: 1.15,
    drops: [
      { id: 'coins', min: 70, max: 320, chance: 0.94 },
      { id: 'mithril_ore', min: 1, max: 3, chance: 0.35 },
      { id: 'coal', min: 3, max: 9, chance: 0.5 },
      { id: 'mithril_bar', chance: 0.1 }
    ]
  },
  crystal_beetle: {
    name: 'Crystal beetle', art: 'beetle', examine: 'Its shell chimes when it walks.',
    level: 41, hp: 82, maxHit: 10, attack: 41, defence: 32, aggressive: false, respawn: 70,
    drops: [
      { id: 'coins', min: 80, max: 360, chance: 0.94 },
      { id: 'crystal_shard', chance: 0.5 },
      { id: 'mithril_bar', chance: 0.16 },
      { id: 'mithril_helm', chance: 0.04 }
    ]
  },

  // -------------------------------------------------- The Ember Chamber (3)
  ember_wisp: {
    name: 'Ember wisp', art: 'wisp', examine: 'A spark that got away from the fire.',
    level: 30, hp: 42, maxHit: 7, attack: 33, defence: 16, aggressive: true, respawn: 40,
    drops: [
      { id: 'coins', min: 30, max: 160, chance: 0.85 },
      { id: 'ember_shard', chance: 0.2 }
    ]
  },
  cinder_guardian: {
    name: 'Cinder guardian', art: 'guardian_statue', examine: 'It has stood here a very long time.',
    level: 53, hp: 105, maxHit: 12, attack: 53, defence: 40, aggressive: true, respawn: 90, size: 1.3,
    drops: [
      { id: 'coins', min: 150, max: 620, chance: 0.96 },
      { id: 'ember_shard', chance: 0.4 },
      { id: 'adamant_ore', min: 1, max: 2, chance: 0.25 },
      { id: 'adamant_bar', chance: 0.08 }
    ]
  },

  /**
   * Cinderheart, the whole point of the descent.
   *
   * It is not a monster so much as a very large, very warm creature having a
   * bad dream: defeat it and it yawns, banks its fire and goes back to sleep.
   * Mechanically it is the only NPC with phases - at two thirds and one third
   * health it wakes further, calls wisps to it, and finally stokes itself.
   */
  cinderheart: {
    name: 'Cinderheart', art: 'cinderheart', examine: 'Enormous, warm, and fast asleep. Mostly.', proper: true,
    level: 72, hp: 190, maxHit: 15, attack: 70, defence: 44, aggressive: true, respawn: 300,
    wander: 0, leash: 16, size: 2.4,
    boss: {
      summon: 'ember_wisp',
      phases: [
        { at: 0.66, summon: 2, say: 'Cinderheart stirs, and sparks scatter from its back.' },
        { at: 0.33, summon: 3, enrage: true, say: 'Cinderheart sits up properly. The whole chamber glows.' }
      ]
    },
    drops: [
      { id: 'coins', min: 800, max: 2600, chance: 1 },
      { id: 'adamant_bar', min: 2, max: 5, chance: 0.9 },
      { id: 'ember_shard', min: 2, max: 4, chance: 0.8 },
      { id: 'cinder_cape', chance: 0.4 },
      { id: 'ember_heart', chance: 0.3 },
      { id: 'emberforged_blade', chance: 0.28 }
    ]
  }
});

/**
 * Spawns. `area` is the rectangle an NPC wanders inside; monsters return to it
 * if they chase a player too far.
 */
export const NPC_SPAWNS = Object.freeze([
  // Village
  { type: 'mayor_aldric', x: 48, y: 55, area: { x: 45, y: 53, w: 7, h: 5 } },
  { type: 'tutor_pip', x: 46, y: 53, area: { x: 44, y: 50, w: 8, h: 5 } },
  { type: 'shopkeeper_bea', x: 55, y: 45, area: { x: 55, y: 45, w: 1, h: 1 } },
  { type: 'banker_cyrus', x: 42, y: 45, area: { x: 42, y: 45, w: 1, h: 1 } },
  { type: 'captain_rook', x: 50, y: 57, area: { x: 49, y: 56, w: 4, h: 4 } },
  { type: 'woodsman_willow', x: 44, y: 38, area: { x: 42, y: 36, w: 6, h: 5 } },
  { type: 'miner_mira', x: 32, y: 51, area: { x: 31, y: 49, w: 4, h: 5 } },
  { type: 'fisher_finn', x: 64, y: 50, area: { x: 62, y: 48, w: 4, h: 5 } },

  // Meadow - the gentle starter creatures. Spawns are deliberately sparse:
  // a wall of monsters reads as a farm, not a place worth exploring.
  ...gridSpawns('giant_rat', 36, 71, 3, 2, 8),
  ...gridSpawns('meadow_boar', 30, 82, 3, 1, 9),
  ...gridSpawns('goblin_scamp', 58, 74, 2, 2, 8),

  // Woods
  ...gridSpawns('forest_wolf', 28, 12, 3, 2, 9),
  ...gridSpawns('goblin_scamp', 62, 16, 2, 2, 7),

  // Copper Hollow
  ...gridSpawns('cave_imp', 11, 38, 3, 2, 7),
  ...gridSpawns('rock_golem', 10, 58, 2, 2, 7),

  // --------------------------------------------------------------- the mine
  // Spawns are addressed by room, so moving a gallery in the floor plan moves
  // whatever lives in it. Every level ramps upwards away from its ladder.
  // Dorn stands at the foot of the first ladder, which is where anyone coming
  // down for the first time arrives.
  ...roomSpawns(1, 'landing', 'foreman_dorn', 1),
  ...roomSpawns(1, 'copper', 'cave_bat', 3),
  ...roomSpawns(1, 'tin', 'cave_bat', 2),
  ...roomSpawns(1, 'gallery', 'tunnel_crawler', 3),
  ...roomSpawns(1, 'iron', 'tunnel_crawler', 2),
  ...roomSpawns(1, 'coal', 'dust_sprite', 3),
  ...roomSpawns(1, 'hollow', 'dust_sprite', 2),
  ...roomSpawns(1, 'descent', 'cave_imp', 2),

  ...roomSpawns(2, 'crossing', 'coal_lurker', 3),
  ...roomSpawns(2, 'seam', 'coal_lurker', 2),
  ...roomSpawns(2, 'fungus', 'shale_hound', 3),
  ...roomSpawns(2, 'hall', 'shale_hound', 2),
  ...roomSpawns(2, 'coalface', 'deep_golem', 3),
  ...roomSpawns(2, 'vault', 'crystal_beetle', 3),
  ...roomSpawns(2, 'descent', 'deep_golem', 2),

  ...roomSpawns(3, 'approach', 'ember_wisp', 3),
  ...roomSpawns(3, 'hall', 'cinder_guardian', 4),
  ...bossSpawn(3, 'hall', 'cinderheart')
]);

/**
 * Spreads `count` creatures evenly across a named mine room, each wandering
 * inside that room rather than inside a fixed square drawn around itself: a
 * gallery is the right size for a patrol, and nothing wanders into rock.
 */
function roomSpawns(plane, roomId, type, count) {
  const room = mineRoom(plane, roomId);
  if (!room) return [];
  const area = { x: room.x + 1, y: room.y + 1, w: Math.max(1, room.w - 2), h: Math.max(1, room.h - 2) };
  const out = [];
  for (let i = 0; i < count; i += 1) {
    // Golden-ratio stepping scatters them without clumping or lining up.
    const fx = (i * 0.618033988749895) % 1;
    const fy = (i * 0.381966011250105 + 0.27) % 1;
    out.push({
      type,
      plane,
      x: area.x + Math.floor(fx * area.w),
      y: area.y + Math.floor(fy * area.h),
      area
    });
  }
  return out;
}

/** One boss, in the middle of its hall, patrolling nothing. */
function bossSpawn(plane, roomId, type) {
  const room = mineRoom(plane, roomId);
  if (!room) return [];
  const x = room.x + Math.floor(room.w / 2);
  const y = room.y + Math.floor(room.h / 2);
  return [{ type, plane, x, y, area: { x, y, w: 1, h: 1 } }];
}

function gridSpawns(type, x0, y0, cols, rows, spacing) {
  const out = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = x0 + c * spacing;
      const y = y0 + r * spacing;
      out.push({ type, x, y, area: { x: x - 3, y: y - 3, w: 7, h: 7 } });
    }
  }
  return out;
}

export function npcDef(type) {
  return NPC_TYPES[type] || null;
}

/**
 * How to refer to a creature in a sentence. Most are things ("the giant rat");
 * a few have names ("Cinderheart"), and putting "the" in front of a name reads
 * like a mistake.
 */
export function creatureName(def) {
  if (!def) return 'something';
  return def.proper ? def.name : `the ${def.name.toLowerCase()}`;
}
