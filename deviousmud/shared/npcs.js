/**
 * NPC definitions and their spawn points.
 *
 * Everything here is deliberately family friendly: monsters are mischievous
 * rather than gruesome, "defeated" creatures scamper off, and no NPC ever says
 * anything a parent would mind reading over a shoulder.
 */

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
  ...gridSpawns('rock_golem', 10, 58, 2, 2, 7)
]);

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
