/**
 * Shop stock lists. Stock regenerates towards `base` over time so a busy world
 * never leaves a new player without a starter axe.
 */

export const SHOPS = Object.freeze({
  general_store: {
    id: 'general_store',
    name: 'Bea\'s General Store',
    greeting: 'Everything a young adventurer needs, and a cake besides.',
    stock: [
      { id: 'bronze_axe', base: 10 },
      { id: 'bronze_pickaxe', base: 10 },
      { id: 'fishing_rod', base: 10 },
      { id: 'small_net', base: 10 },
      { id: 'tinderbox', base: 10 },
      { id: 'hammer', base: 10 },
      { id: 'bread', base: 20 },
      { id: 'honey_cake', base: 5 },
      { id: 'leather_body', base: 6 },
      { id: 'leather_legs', base: 6 },
      { id: 'leather_gloves', base: 6 },
      { id: 'leather_boots', base: 6 },
      { id: 'wooden_shield', base: 6 },
      { id: 'bronze_dagger', base: 4 },
      { id: 'bronze_sword', base: 3 }
    ]
  }
});

export function shopDef(id) {
  return SHOPS[id] || null;
}

/**
 * Items a shop is willing to buy from players. Bea takes anything that is not
 * coins and not a quest item (quest items are filtered by their sell price).
 */
export function shopAccepts(shopId, itemId) {
  if (!SHOPS[shopId]) return false;
  return itemId !== 'coins';
}
