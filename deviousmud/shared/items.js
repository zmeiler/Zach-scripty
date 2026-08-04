/**
 * The item catalogue.
 *
 * Every item carries a `shape` and `palette` so the client can draw a readable
 * icon procedurally - the game ships with no image files at all, which keeps
 * the download tiny and avoids any third-party art licensing.
 *
 * Fields:
 *   stackable   several of the item share one inventory slot
 *   slot        equipment slot, if the item can be worn/wielded
 *   bonuses     added to combat rolls while equipped
 *   heal        hitpoints restored when eaten
 *   tool        capability the item grants (axe, pickaxe, rod, ...)
 *   requires    { skill: level } gate for equipping
 */

const RAW_ITEMS = [
  // ---------------------------------------------------------------- currency
  { id: 'coins', name: 'Coins', examine: 'Lovely, shiny coins.', value: 1, stackable: true, shape: 'coin', palette: ['#f2c14e', '#b8860b'] },

  // ------------------------------------------------------------------- tools
  { id: 'bronze_axe', name: 'Bronze axe', examine: 'A woodcutter\'s first friend.', value: 16, tool: 'axe', power: 1, slot: 'weapon', bonuses: { attack: 2, strength: 3, defence: 0 }, shape: 'axe', palette: ['#b87333', '#7a4a1e'] },
  { id: 'steel_axe', name: 'Steel axe', examine: 'Bites into wood twice as fast.', value: 200, tool: 'axe', power: 2, slot: 'weapon', bonuses: { attack: 6, strength: 7, defence: 0 }, requires: { attack: 5 }, shape: 'axe', palette: ['#c9d1d9', '#6b7280'] },
  { id: 'bronze_pickaxe', name: 'Bronze pickaxe', examine: 'For chipping rocks apart.', value: 18, tool: 'pickaxe', power: 1, slot: 'weapon', bonuses: { attack: 2, strength: 2, defence: 0 }, shape: 'pickaxe', palette: ['#b87333', '#7a4a1e'] },
  { id: 'steel_pickaxe', name: 'Steel pickaxe', examine: 'Heavier, and much more effective.', value: 220, tool: 'pickaxe', power: 2, slot: 'weapon', bonuses: { attack: 5, strength: 6, defence: 0 }, requires: { attack: 5 }, shape: 'pickaxe', palette: ['#c9d1d9', '#6b7280'] },
  { id: 'fishing_rod', name: 'Fishing rod', examine: 'Patience, wrapped in string.', value: 24, tool: 'rod', power: 1, shape: 'rod', palette: ['#8b5a2b', '#d9d9d9'] },
  { id: 'small_net', name: 'Small net', examine: 'Good for scooping up shrimp.', value: 10, tool: 'net', power: 1, shape: 'net', palette: ['#e6e6e6', '#9aa0a6'] },
  { id: 'tinderbox', name: 'Tinderbox', examine: 'Makes light work of a pile of logs.', value: 12, tool: 'tinderbox', shape: 'box', palette: ['#8b5a2b', '#f2a03d'] },
  { id: 'hammer', name: 'Hammer', examine: 'Every smith needs one.', value: 14, tool: 'hammer', shape: 'hammer', palette: ['#8b5a2b', '#9aa0a6'] },
  { id: 'lantern', name: 'Willow\'s lantern', examine: 'A warm little light, safely returned.', value: 0, questItem: true, light: 6, shape: 'lamp', palette: ['#f6d365', '#7a4a1e'] },
  { id: 'torch', name: 'Torch', examine: 'Pitch on a stick. It will do.', value: 20, light: 3.5, slot: 'weapon', bonuses: { attack: 1, strength: 1, defence: 0 }, shape: 'torch', palette: ['#8b5a2b', '#f2a03d'] },
  { id: 'miners_lantern', name: 'Miner\'s lantern', examine: 'Steady light, and it will not blow out.', value: 320, light: 6.5, shape: 'lamp', palette: ['#ffd75e', '#5f6368'] },
  { id: 'lantern_glass', name: 'Lantern glass', examine: 'Cracked, but repairable.', value: 0, questItem: true, shape: 'gem', palette: ['#bfe6ff', '#5fa8d3'] },
  { id: 'wolf_pelt', name: 'Wolf pelt', examine: 'Thick grey fur, shed naturally.', value: 25, shape: 'pelt', palette: ['#9aa0a6', '#5f6368'] },
  { id: 'meadow_flower', name: 'Meadow flower', examine: 'It smells of summer.', value: 4, shape: 'flower', palette: ['#ff8fab', '#5fbf6a'] },

  // ------------------------------------------------------------ raw resources
  { id: 'logs', name: 'Logs', examine: 'A bundle of ordinary logs.', value: 4, shape: 'log', palette: ['#8b5a2b', '#5c3a1a'] },
  { id: 'oak_logs', name: 'Oak logs', examine: 'Dense and slow burning.', value: 12, shape: 'log', palette: ['#a9713b', '#6b4423'] },
  { id: 'willow_logs', name: 'Willow logs', examine: 'Light, pale wood.', value: 22, shape: 'log', palette: ['#c8a165', '#8a6a3a'] },
  { id: 'copper_ore', name: 'Copper ore', examine: 'Streaked with orange metal.', value: 8, shape: 'ore', palette: ['#b87333', '#6b4423'] },
  { id: 'tin_ore', name: 'Tin ore', examine: 'Dull grey, but useful.', value: 8, shape: 'ore', palette: ['#c0c0c0', '#6b7280'] },
  { id: 'iron_ore', name: 'Iron ore', examine: 'Heavy and rust-red.', value: 26, shape: 'ore', palette: ['#a2543f', '#5a2f24'] },
  { id: 'coal', name: 'Coal', examine: 'Burns hot in a furnace.', value: 34, shape: 'ore', palette: ['#3c4043', '#202124'] },
  { id: 'bronze_bar', name: 'Bronze bar', examine: 'Copper and tin, married by fire.', value: 30, shape: 'bar', palette: ['#b87333', '#8a5a2b'] },
  { id: 'iron_bar', name: 'Iron bar', examine: 'Ready for the anvil.', value: 70, shape: 'bar', palette: ['#9aa0a6', '#5f6368'] },
  { id: 'steel_bar', name: 'Steel bar', examine: 'Iron, improved by coal.', value: 150, shape: 'bar', palette: ['#cfd8dc', '#78909c'] },
  { id: 'mithril_ore', name: 'Mithril ore', examine: 'Blue-green, and lighter than it looks.', value: 90, shape: 'ore', palette: ['#5c7cbf', '#33487a'] },
  { id: 'mithril_bar', name: 'Mithril bar', examine: 'Rings like a bell when you tap it.', value: 320, shape: 'bar', palette: ['#7d9adf', '#43598f'] },
  { id: 'adamant_ore', name: 'Adamant ore', examine: 'Dark green, and very heavy indeed.', value: 210, shape: 'ore', palette: ['#3f7a52', '#22452f'] },
  { id: 'adamant_bar', name: 'Adamant bar', examine: 'It took the furnace a long while.', value: 760, shape: 'bar', palette: ['#4f9166', '#2c5a3d'] },
  { id: 'ember_shard', name: 'Ember shard', examine: 'Still warm. It will not go out.', value: 400, shape: 'gem', palette: ['#ff8a3d', '#a83c12'] },
  { id: 'bat_wing', name: 'Bat wing', examine: 'Leathery, and shed naturally.', value: 12, shape: 'pelt', palette: ['#6b5a72', '#3d3242'] },
  { id: 'crystal_shard', name: 'Crystal shard', examine: 'It hums if you hold it still.', value: 140, shape: 'gem', palette: ['#c9a0ff', '#6c4d99'] },

  // --------------------------------------------------------------------- food
  { id: 'raw_shrimp', name: 'Raw shrimp', examine: 'Best not eaten like this.', value: 3, shape: 'fish', palette: ['#ffb3a7', '#d97b6c'] },
  { id: 'shrimp', name: 'Shrimp', examine: 'Cooked to a gentle pink.', value: 6, heal: 3, shape: 'fish', palette: ['#ff8a65', '#c75b39'] },
  { id: 'raw_trout', name: 'Raw trout', examine: 'Slippery.', value: 12, shape: 'fish', palette: ['#a7c7e7', '#5f8fb4'] },
  { id: 'trout', name: 'Trout', examine: 'Flaky and warm.', value: 20, heal: 7, shape: 'fish', palette: ['#d8b384', '#a07850'] },
  { id: 'raw_salmon', name: 'Raw salmon', examine: 'A fine catch.', value: 26, shape: 'fish', palette: ['#ff9e80', '#c96f52'] },
  { id: 'salmon', name: 'Salmon', examine: 'Perfectly cooked.', value: 40, heal: 10, shape: 'fish', palette: ['#ff7043', '#bf4f30'] },
  { id: 'burnt_fish', name: 'Burnt fish', examine: 'Every cook makes a few.', value: 0, shape: 'fish', palette: ['#4a4a4a', '#262626'] },
  { id: 'bread', name: 'Bread', examine: 'Baked fresh in Emberfall.', value: 12, heal: 5, shape: 'bread', palette: ['#e0b877', '#a37e4a'] },
  { id: 'honey_cake', name: 'Honey cake', examine: 'Bea\'s speciality.', value: 45, heal: 14, shape: 'cake', palette: ['#ffd28a', '#e08f4a'] },

  // ------------------------------------------------------------------ weapons
  { id: 'bronze_dagger', name: 'Bronze dagger', examine: 'Short, quick, and cheap.', value: 30, slot: 'weapon', bonuses: { attack: 4, strength: 4, defence: 0 }, shape: 'dagger', palette: ['#b87333', '#7a4a1e'] },
  { id: 'bronze_sword', name: 'Bronze sword', examine: 'A dependable starter blade.', value: 60, slot: 'weapon', bonuses: { attack: 7, strength: 7, defence: 1 }, shape: 'sword', palette: ['#b87333', '#7a4a1e'] },
  { id: 'iron_sword', name: 'Iron sword', examine: 'Noticeably heavier.', value: 160, slot: 'weapon', bonuses: { attack: 12, strength: 12, defence: 1 }, requires: { attack: 5 }, shape: 'sword', palette: ['#9aa0a6', '#5f6368'] },
  { id: 'steel_sword', name: 'Steel sword', examine: 'Balanced and bright.', value: 420, slot: 'weapon', bonuses: { attack: 20, strength: 19, defence: 2 }, requires: { attack: 10 }, shape: 'sword', palette: ['#cfd8dc', '#78909c'] },
  { id: 'guardian_blade', name: 'Guardian blade', examine: 'Awarded to defenders of Emberfall.', value: 900, slot: 'weapon', bonuses: { attack: 26, strength: 24, defence: 4 }, requires: { attack: 15 }, shape: 'sword', palette: ['#ffd75e', '#b8860b'] },
  { id: 'mithril_sword', name: 'Mithril sword', examine: 'Light in the hand, and very sharp.', value: 900, slot: 'weapon', bonuses: { attack: 30, strength: 28, defence: 3 }, requires: { attack: 20 }, shape: 'sword', palette: ['#7d9adf', '#43598f'] },
  { id: 'adamant_sword', name: 'Adamant sword', examine: 'Heavier than steel, and worth it.', value: 2200, slot: 'weapon', bonuses: { attack: 42, strength: 40, defence: 4 }, requires: { attack: 30 }, shape: 'sword', palette: ['#4f9166', '#2c5a3d'] },
  { id: 'emberforged_blade', name: 'Emberforged blade', examine: 'Forged in Cinderheart\'s own coals.', value: 6000, slot: 'weapon', bonuses: { attack: 58, strength: 55, defence: 6 }, requires: { attack: 40 }, shape: 'sword', palette: ['#ff8a3d', '#a83c12'] },

  // ------------------------------------------------------------------- armour
  { id: 'wooden_shield', name: 'Wooden shield', examine: 'Better than nothing.', value: 20, slot: 'shield', bonuses: { attack: 0, strength: 0, defence: 4 }, shape: 'shield', palette: ['#8b5a2b', '#5c3a1a'] },
  { id: 'bronze_shield', name: 'Bronze shield', examine: 'Dented, but honest.', value: 70, slot: 'shield', bonuses: { attack: 0, strength: 0, defence: 8 }, shape: 'shield', palette: ['#b87333', '#7a4a1e'] },
  { id: 'steel_shield', name: 'Steel shield', examine: 'Heavy on the arm.', value: 380, slot: 'shield', bonuses: { attack: 0, strength: 0, defence: 16 }, requires: { defence: 10 }, shape: 'shield', palette: ['#cfd8dc', '#78909c'] },
  { id: 'leather_body', name: 'Leather body', examine: 'Supple and quiet.', value: 40, slot: 'body', bonuses: { attack: 0, strength: 0, defence: 6 }, shape: 'body', palette: ['#8d6e63', '#5d4037'] },
  { id: 'bronze_platebody', name: 'Bronze platebody', examine: 'Clanks when you run.', value: 180, slot: 'body', bonuses: { attack: 0, strength: 0, defence: 14 }, requires: { defence: 5 }, shape: 'body', palette: ['#b87333', '#7a4a1e'] },
  { id: 'steel_platebody', name: 'Steel platebody', examine: 'Proper protection.', value: 640, slot: 'body', bonuses: { attack: 0, strength: 0, defence: 26 }, requires: { defence: 10 }, shape: 'body', palette: ['#cfd8dc', '#78909c'] },
  { id: 'leather_legs', name: 'Leather chaps', examine: 'Practical trousers.', value: 30, slot: 'legs', bonuses: { attack: 0, strength: 0, defence: 4 }, shape: 'legs', palette: ['#8d6e63', '#5d4037'] },
  { id: 'bronze_platelegs', name: 'Bronze platelegs', examine: 'Solid leg protection.', value: 140, slot: 'legs', bonuses: { attack: 0, strength: 0, defence: 10 }, requires: { defence: 5 }, shape: 'legs', palette: ['#b87333', '#7a4a1e'] },
  { id: 'bronze_helm', name: 'Bronze helm', examine: 'Keeps the rain off, mostly.', value: 60, slot: 'head', bonuses: { attack: 0, strength: 0, defence: 6 }, shape: 'helm', palette: ['#b87333', '#7a4a1e'] },
  { id: 'steel_helm', name: 'Steel helm', examine: 'A knight would nod at this.', value: 260, slot: 'head', bonuses: { attack: 0, strength: 0, defence: 12 }, requires: { defence: 10 }, shape: 'helm', palette: ['#cfd8dc', '#78909c'] },
  { id: 'leather_gloves', name: 'Leather gloves', examine: 'Good grip.', value: 18, slot: 'gloves', bonuses: { attack: 1, strength: 0, defence: 2 }, shape: 'gloves', palette: ['#8d6e63', '#5d4037'] },
  { id: 'leather_boots', name: 'Leather boots', examine: 'Worn in, not worn out.', value: 18, slot: 'boots', bonuses: { attack: 0, strength: 0, defence: 2 }, shape: 'boots', palette: ['#8d6e63', '#5d4037'] },
  { id: 'travellers_cape', name: 'Traveller\'s cape', examine: 'Emberfall green.', value: 50, slot: 'cape', bonuses: { attack: 0, strength: 1, defence: 3 }, shape: 'cape', palette: ['#4caf50', '#2e7d32'] },
  { id: 'copper_amulet', name: 'Copper amulet', examine: 'A miner\'s good-luck charm.', value: 90, slot: 'amulet', bonuses: { attack: 3, strength: 2, defence: 1 }, shape: 'amulet', palette: ['#b87333', '#ffd75e'] },
  { id: 'ring_of_tides', name: 'Ring of tides', examine: 'Cool to the touch.', value: 250, slot: 'ring', bonuses: { attack: 2, strength: 2, defence: 2 }, shape: 'ring', palette: ['#5fa8d3', '#bfe6ff'] },

  // ------------------------------------------------- mithril and adamant
  { id: 'mithril_pickaxe', name: 'Mithril pickaxe', examine: 'Bites through rock like bread.', value: 640, tool: 'pickaxe', power: 3, slot: 'weapon', bonuses: { attack: 9, strength: 10, defence: 0 }, requires: { attack: 20 }, shape: 'pickaxe', palette: ['#7d9adf', '#43598f'] },
  { id: 'mithril_axe', name: 'Mithril axe', examine: 'Barely notices an oak.', value: 620, tool: 'axe', power: 3, slot: 'weapon', bonuses: { attack: 10, strength: 11, defence: 0 }, requires: { attack: 20 }, shape: 'axe', palette: ['#7d9adf', '#43598f'] },
  { id: 'mithril_helm', name: 'Mithril helm', examine: 'You forget you are wearing it.', value: 560, slot: 'head', bonuses: { attack: 0, strength: 0, defence: 18 }, requires: { defence: 20 }, shape: 'helm', palette: ['#7d9adf', '#43598f'] },
  { id: 'mithril_shield', name: 'Mithril shield', examine: 'Wide, and hardly any weight.', value: 820, slot: 'shield', bonuses: { attack: 0, strength: 0, defence: 24 }, requires: { defence: 20 }, shape: 'shield', palette: ['#7d9adf', '#43598f'] },
  { id: 'mithril_platelegs', name: 'Mithril platelegs', examine: 'You could run in these.', value: 980, slot: 'legs', bonuses: { attack: 0, strength: 0, defence: 28 }, requires: { defence: 20 }, shape: 'legs', palette: ['#7d9adf', '#43598f'] },
  { id: 'mithril_platebody', name: 'Mithril platebody', examine: 'Proper armour that does not weigh you down.', value: 1500, slot: 'body', bonuses: { attack: 0, strength: 0, defence: 38 }, requires: { defence: 20 }, shape: 'body', palette: ['#7d9adf', '#43598f'] },
  { id: 'adamant_helm', name: 'Adamant helm', examine: 'Dark green, and utterly solid.', value: 1400, slot: 'head', bonuses: { attack: 0, strength: 0, defence: 26 }, requires: { defence: 30 }, shape: 'helm', palette: ['#4f9166', '#2c5a3d'] },
  { id: 'adamant_shield', name: 'Adamant shield', examine: 'Nothing in the mine dents it.', value: 2000, slot: 'shield', bonuses: { attack: 0, strength: 0, defence: 34 }, requires: { defence: 30 }, shape: 'shield', palette: ['#4f9166', '#2c5a3d'] },
  { id: 'adamant_platelegs', name: 'Adamant platelegs', examine: 'Heavy, but you stop noticing.', value: 2400, slot: 'legs', bonuses: { attack: 0, strength: 0, defence: 38 }, requires: { defence: 30 }, shape: 'legs', palette: ['#4f9166', '#2c5a3d'] },
  { id: 'adamant_platebody', name: 'Adamant platebody', examine: 'The best armour a village smith can make.', value: 3600, slot: 'body', bonuses: { attack: 0, strength: 0, defence: 52 }, requires: { defence: 30 }, shape: 'body', palette: ['#4f9166', '#2c5a3d'] },
  { id: 'ember_heart', name: 'Ember heart', examine: 'Warm against your collarbone.', value: 4200, slot: 'amulet', bonuses: { attack: 10, strength: 8, defence: 6 }, requires: { attack: 35 }, shape: 'amulet', palette: ['#ff8a3d', '#ffd166'] },
  { id: 'cinder_cape', name: 'Cinder cape', examine: 'Woven from something that used to burn.', value: 3000, slot: 'cape', bonuses: { attack: 0, strength: 4, defence: 12 }, requires: { defence: 30 }, shape: 'cape', palette: ['#c0562a', '#5f2410'] },
  { id: 'miners_boots', name: 'Miner\'s boots', examine: 'Steel toes. Mira swears by them.', value: 420, slot: 'boots', bonuses: { attack: 0, strength: 1, defence: 9 }, requires: { defence: 15 }, shape: 'boots', palette: ['#6b5a48', '#3c3226'] },

  // -------------------------------------------------------------- quest items
  { id: 'ancient_coin', name: 'Ancient coin', examine: 'Older than the village itself.', value: 0, questItem: true, shape: 'coin', palette: ['#cfd8dc', '#8a9298'] },
  { id: 'mine_key', name: 'Hollow key', examine: 'Opens the old mine gate.', value: 0, questItem: true, shape: 'key', palette: ['#ffd75e', '#8a6a2b'] },
  { id: 'forge_wardens_ring', name: 'Forge-warden\'s ring', examine: 'Given for letting something sleep.', value: 0, questItem: true, slot: 'ring', bonuses: { attack: 6, strength: 6, defence: 6 }, shape: 'ring', palette: ['#ff8a3d', '#ffd166'] },
  { id: 'dorns_tally', name: 'Dorn\'s tally stick', examine: 'Notched once for every year the mine stood empty.', value: 0, questItem: true, shape: 'log', palette: ['#8b5a2b', '#f2c14e'] }
];

export const ITEMS = Object.freeze(
  Object.fromEntries(
    RAW_ITEMS.map((item) => [
      item.id,
      Object.freeze({
        stackable: false,
        value: 0,
        ...item,
        bonuses: Object.freeze({ attack: 0, strength: 0, defence: 0, ...(item.bonuses || {}) })
      })
    ])
  )
);

export function getItem(id) {
  return ITEMS[id] || null;
}

export function itemName(id) {
  return ITEMS[id] ? ITEMS[id].name : 'Unknown item';
}

export function isStackable(id) {
  return Boolean(ITEMS[id] && ITEMS[id].stackable);
}

/** Shops pay less than they charge; both are derived from the base value. */
export function shopBuyPrice(id) {
  const item = ITEMS[id];
  if (!item) return 0;
  return Math.max(1, Math.round(item.value * 1.35));
}

export function shopSellPrice(id) {
  const item = ITEMS[id];
  if (!item || item.questItem) return 0;
  return Math.max(1, Math.floor(item.value * 0.55));
}

/** Highest `power` tool of a kind that the given inventory/equipment holds. */
export function bestTool(itemIds, kind) {
  let best = null;
  for (const id of itemIds) {
    const item = ITEMS[id];
    if (!item || item.tool !== kind) continue;
    if (!best || (item.power || 1) > (best.power || 1)) best = item;
  }
  return best;
}
