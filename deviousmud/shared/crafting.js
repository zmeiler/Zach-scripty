/**
 * Recipes for the production skills: smelting (furnace), smithing (anvil) and
 * cooking (fire or range).
 */

export const SMELTING = Object.freeze([
  { id: 'bronze_bar', name: 'Bronze bar', level: 1, xp: 7, inputs: [{ id: 'copper_ore', count: 1 }, { id: 'tin_ore', count: 1 }] },
  { id: 'iron_bar', name: 'Iron bar', level: 15, xp: 13, inputs: [{ id: 'iron_ore', count: 1 }], failChance: 0.45, failMessage: 'The ore is too impure and crumbles away.' },
  { id: 'steel_bar', name: 'Steel bar', level: 30, xp: 18, inputs: [{ id: 'iron_ore', count: 1 }, { id: 'coal', count: 2 }] },
  { id: 'mithril_bar', name: 'Mithril bar', level: 35, xp: 30, inputs: [{ id: 'mithril_ore', count: 1 }, { id: 'coal', count: 3 }] },
  { id: 'adamant_bar', name: 'Adamant bar', level: 50, xp: 45, inputs: [{ id: 'adamant_ore', count: 1 }, { id: 'coal', count: 5 }] }
]);

export const SMITHING = Object.freeze([
  { id: 'bronze_dagger', name: 'Bronze dagger', level: 1, xp: 13, bar: 'bronze_bar', bars: 1 },
  { id: 'bronze_axe', name: 'Bronze axe', level: 1, xp: 13, bar: 'bronze_bar', bars: 1 },
  { id: 'bronze_pickaxe', name: 'Bronze pickaxe', level: 2, xp: 13, bar: 'bronze_bar', bars: 1 },
  { id: 'bronze_sword', name: 'Bronze sword', level: 4, xp: 25, bar: 'bronze_bar', bars: 2 },
  { id: 'bronze_helm', name: 'Bronze helm', level: 7, xp: 25, bar: 'bronze_bar', bars: 2 },
  { id: 'bronze_shield', name: 'Bronze shield', level: 12, xp: 38, bar: 'bronze_bar', bars: 3 },
  { id: 'bronze_platelegs', name: 'Bronze platelegs', level: 16, xp: 50, bar: 'bronze_bar', bars: 4 },
  { id: 'bronze_platebody', name: 'Bronze platebody', level: 18, xp: 63, bar: 'bronze_bar', bars: 5 },
  { id: 'iron_sword', name: 'Iron sword', level: 19, xp: 50, bar: 'iron_bar', bars: 2 },
  { id: 'steel_axe', name: 'Steel axe', level: 31, xp: 75, bar: 'steel_bar', bars: 1 },
  { id: 'steel_pickaxe', name: 'Steel pickaxe', level: 32, xp: 75, bar: 'steel_bar', bars: 1 },
  { id: 'steel_sword', name: 'Steel sword', level: 34, xp: 100, bar: 'steel_bar', bars: 2 },
  { id: 'steel_helm', name: 'Steel helm', level: 37, xp: 100, bar: 'steel_bar', bars: 2 },
  { id: 'steel_shield', name: 'Steel shield', level: 42, xp: 150, bar: 'steel_bar', bars: 3 },
  { id: 'steel_platebody', name: 'Steel platebody', level: 48, xp: 250, bar: 'steel_bar', bars: 5 },
  { id: 'mithril_pickaxe', name: 'Mithril pickaxe', level: 40, xp: 150, bar: 'mithril_bar', bars: 1 },
  { id: 'mithril_axe', name: 'Mithril axe', level: 40, xp: 150, bar: 'mithril_bar', bars: 1 },
  { id: 'mithril_sword', name: 'Mithril sword', level: 43, xp: 200, bar: 'mithril_bar', bars: 2 },
  { id: 'mithril_helm', name: 'Mithril helm', level: 46, xp: 200, bar: 'mithril_bar', bars: 2 },
  { id: 'mithril_shield', name: 'Mithril shield', level: 50, xp: 300, bar: 'mithril_bar', bars: 3 },
  { id: 'mithril_platelegs', name: 'Mithril platelegs', level: 54, xp: 400, bar: 'mithril_bar', bars: 4 },
  { id: 'mithril_platebody', name: 'Mithril platebody', level: 58, xp: 500, bar: 'mithril_bar', bars: 5 },
  { id: 'adamant_helm', name: 'Adamant helm', level: 62, xp: 400, bar: 'adamant_bar', bars: 2 },
  { id: 'adamant_shield', name: 'Adamant shield', level: 66, xp: 600, bar: 'adamant_bar', bars: 3 },
  { id: 'adamant_platelegs', name: 'Adamant platelegs', level: 70, xp: 800, bar: 'adamant_bar', bars: 4 },
  { id: 'adamant_platebody', name: 'Adamant platebody', level: 74, xp: 1000, bar: 'adamant_bar', bars: 5 }
]);

export const COOKING = Object.freeze({
  raw_shrimp: { result: 'shrimp', level: 1, xp: 30, burnStop: 34 },
  raw_trout: { result: 'trout', level: 15, xp: 70, burnStop: 50 },
  raw_salmon: { result: 'salmon', level: 25, xp: 90, burnStop: 58 }
});

/** Chance a cook burns the food, given their level and the cooking surface. */
export function burnChance(recipe, level, onRange) {
  if (level >= recipe.burnStop) return 0;
  const span = Math.max(1, recipe.burnStop - recipe.level);
  const progress = Math.min(1, Math.max(0, (level - recipe.level) / span));
  const base = 0.55 * (1 - progress);
  return Math.max(0, onRange ? base * 0.6 : base);
}

export function smeltingRecipe(id) {
  return SMELTING.find((recipe) => recipe.id === id) || null;
}

export function smithingRecipe(id) {
  return SMITHING.find((recipe) => recipe.id === id) || null;
}
