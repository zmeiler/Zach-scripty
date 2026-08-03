/**
 * Inventory / container helpers.
 *
 * A container is a fixed-length array of `{ id, count }` or `null`. Stackable
 * items occupy a single slot; everything else takes one slot per item, exactly
 * like the games this one takes after.
 */

import { INVENTORY_SIZE } from '../constants.js';
import { isStackable, getItem } from '../items.js';

export function createContainer(size = INVENTORY_SIZE) {
  return new Array(size).fill(null);
}

export function countItem(container, itemId) {
  let total = 0;
  for (const slot of container) {
    if (slot && slot.id === itemId) total += slot.count;
  }
  return total;
}

export function firstIndexOf(container, itemId) {
  return container.findIndex((slot) => slot && slot.id === itemId);
}

export function freeSlots(container) {
  return container.reduce((n, slot) => (slot ? n : n + 1), 0);
}

/** How many of `itemId` will actually fit right now. */
export function spaceFor(container, itemId, count) {
  if (isStackable(itemId) && firstIndexOf(container, itemId) !== -1) return count;
  return Math.min(count, freeSlots(container));
}

/**
 * Adds items, returning how many were actually stored.
 */
export function addItem(container, itemId, count = 1) {
  if (!getItem(itemId) || count <= 0) return 0;
  let remaining = count;

  if (isStackable(itemId)) {
    const idx = firstIndexOf(container, itemId);
    if (idx !== -1) {
      container[idx] = { id: itemId, count: container[idx].count + remaining };
      return count;
    }
    const empty = container.indexOf(null);
    if (empty === -1) return 0;
    container[empty] = { id: itemId, count: remaining };
    return count;
  }

  for (let i = 0; i < container.length && remaining > 0; i += 1) {
    if (container[i] === null) {
      container[i] = { id: itemId, count: 1 };
      remaining -= 1;
    }
  }
  return count - remaining;
}

/** Removes items, returning how many were actually removed. */
export function removeItem(container, itemId, count = 1) {
  let remaining = count;
  for (let i = 0; i < container.length && remaining > 0; i += 1) {
    const slot = container[i];
    if (!slot || slot.id !== itemId) continue;
    const take = Math.min(slot.count, remaining);
    remaining -= take;
    const left = slot.count - take;
    container[i] = left > 0 ? { id: itemId, count: left } : null;
  }
  return count - remaining;
}

export function removeSlot(container, index, count = Infinity) {
  const slot = container[index];
  if (!slot) return null;
  const take = Math.min(slot.count, count);
  const left = slot.count - take;
  container[index] = left > 0 ? { id: slot.id, count: left } : null;
  return { id: slot.id, count: take };
}

export function swapSlots(container, a, b) {
  if (a < 0 || b < 0 || a >= container.length || b >= container.length) return false;
  const tmp = container[a];
  container[a] = container[b];
  container[b] = tmp;
  return true;
}

export function hasItems(container, requirements) {
  return requirements.every((req) => countItem(container, req.id) >= (req.count || 1));
}

/** Compact list of every distinct item id held (used for tool lookups). */
export function itemIds(container) {
  const ids = [];
  for (const slot of container) if (slot) ids.push(slot.id);
  return ids;
}

export function serializeContainer(container) {
  return container.map((slot) => (slot ? { id: slot.id, count: slot.count } : null));
}

export function deserializeContainer(data, size) {
  const container = createContainer(size);
  if (!Array.isArray(data)) return container;
  for (let i = 0; i < Math.min(size, data.length); i += 1) {
    const slot = data[i];
    if (slot && getItem(slot.id) && slot.count > 0) {
      container[i] = { id: slot.id, count: Math.floor(slot.count) };
    }
  }
  return container;
}
