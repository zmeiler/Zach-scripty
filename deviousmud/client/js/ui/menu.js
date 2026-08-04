/**
 * Right-click / long-press action menu.
 *
 * Left click always performs the first (most obvious) action; the menu exists
 * for everything else, which is what keeps the game playable with one finger.
 */

import { OBJECT_TYPES } from '../../../shared/world.js';
import { ITEMS, itemName } from '../../../shared/items.js';
import { actions } from '../actions.js';
import { pushChat, state } from '../state.js';
import { openReportWindow } from './windows.js';

const menuEl = document.getElementById('contextMenu');
let openFor = null;

/**
 * Builds the action list for something in the world.
 * The first entry is the left-click action.
 */
export function worldActions(pick) {
  if (!pick) return [];
  switch (pick.kind) {
    case 'npc': {
      const npc = pick.entity;
      const list = [];
      if (npc.friendly) {
        list.push({ label: `Talk to ${npc.name}`, run: () => actions.interact('npc', npc.id, 'talk') });
      } else {
        list.push({ label: `Attack ${npc.name} (level ${npc.level})`, run: () => actions.interact('npc', npc.id, 'attack') });
      }
      list.push({ label: `Examine ${npc.name}`, run: () => actions.interact('npc', npc.id, 'examine') });
      list.push({ label: 'Walk here', run: () => actions.walkTo(npc.x, npc.y) });
      return list;
    }
    case 'object': {
      const def = OBJECT_TYPES[pick.objectType];
      const label = def?.action?.label || 'Use';
      const name = def?.name || 'Object';
      const list = [{ label: `${label} ${name.toLowerCase()}`, run: () => actions.interact('object', pick.id, def?.action?.id) }];
      if (def?.action?.id === 'cook') list.push({ label: 'Cook on it', run: () => actions.interact('object', pick.id, 'cook') });
      list.push({ label: `Examine ${name.toLowerCase()}`, run: () => addLocalMessage(`${name}: ${describeObject(pick.objectType)}`) });
      list.push({ label: 'Walk here', run: () => actions.walkTo(pick.entity.x, pick.entity.y) });
      return list;
    }
    case 'player': {
      const player = pick.entity;
      return [
        { label: `Follow ${player.name || 'player'}`, run: () => actions.interact('player', player.id, 'follow') },
        { label: `Trade with ${player.name || 'player'}`, run: () => actions.interact('player', player.id, 'trade') },
        { label: `Examine ${player.name || 'player'}`, run: () => actions.interact('player', player.id, 'examine') },
        { label: `Report ${player.name || 'player'}`, run: () => openReportWindow(player.name || 'Adventurer') },
        { label: 'Walk here', run: () => actions.walkTo(player.x, player.y) }
      ];
    }
    case 'ground_item': {
      const item = pick.entity;
      return [
        { label: `Take ${itemName(item.itemId).toLowerCase()}`, run: () => actions.interact('ground_item', item.id) },
        { label: 'Examine', run: () => addLocalMessage(ITEMS[item.itemId]?.examine || 'An item.') },
        { label: 'Walk here', run: () => actions.walkTo(item.x, item.y) }
      ];
    }
    default:
      return [{ label: 'Walk here', run: () => actions.walkTo(pick.x, pick.y) }];
  }
}

/** Actions for an inventory slot, aware of any open shop/bank/trade window. */
export function inventoryActions(index) {
  const entry = state.inventory[index];
  if (!entry) return [];
  const def = ITEMS[entry.id] || {};
  const list = [];
  const openWindow = state.window?.kind;

  if (openWindow === 'shop') {
    list.push({ label: 'Sell 1', run: () => actions.shop('sell', { slot: index, count: 1 }) });
    list.push({ label: 'Sell 5', run: () => actions.shop('sell', { slot: index, count: 5 }) });
    list.push({ label: 'Sell all', run: () => actions.shop('sell', { slot: index, count: entry.count }) });
  } else if (openWindow === 'bank') {
    list.push({ label: 'Deposit 1', run: () => actions.bank('deposit', { slot: index, count: 1 }) });
    list.push({ label: 'Deposit 10', run: () => actions.bank('deposit', { slot: index, count: 10 }) });
    list.push({ label: 'Deposit all', run: () => actions.bank('deposit', { slot: index, count: 'all' }) });
  } else if (openWindow === 'trade') {
    list.push({ label: 'Offer 1', run: () => actions.trade('offer', { slot: index, count: 1 }) });
    list.push({ label: 'Offer all', run: () => actions.trade('offer', { slot: index, count: 'all' }) });
  }

  if (def.heal) list.push({ label: `Eat ${def.name.toLowerCase()}`, run: () => actions.item('eat', index) });
  if (def.slot) list.push({ label: `Wear ${def.name.toLowerCase()}`, run: () => actions.item('equip', index) });
  if (entry.id.endsWith('logs')) list.push({ label: 'Light a fire', run: () => actions.item('light', index) });
  list.push({ label: 'Examine', run: () => actions.item('examine', index) });
  if (!def.questItem) {
    list.push({ label: 'Drop', run: () => actions.item('drop', index, { count: 1 }) });
    if (entry.count > 1) list.push({ label: 'Drop all', run: () => actions.item('drop', index, { count: 'all' }) });
  }
  return list;
}

function describeObject(type) {
  const def = OBJECT_TYPES[type];
  if (!def) return 'You are not sure what it is.';
  if (def.action?.skill) return `Requires ${def.action.skill} level ${def.action.level}.`;
  return 'Looks useful.';
}

function addLocalMessage(text) {
  pushChat({ channel: 'game', text, at: Date.now() });
}

export function openMenu(x, y, title, entries) {
  if (!entries.length) return;
  menuEl.innerHTML = '';
  if (title) {
    const head = document.createElement('div');
    head.className = 'menu-title';
    head.textContent = title;
    menuEl.append(head);
  }
  for (const entry of entries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = entry.label;
    button.setAttribute('role', 'menuitem');
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      closeMenu();
      entry.run();
    });
    menuEl.append(button);
  }
  menuEl.hidden = false;
  openFor = { x, y };

  // Keep the menu inside the viewport.
  const viewport = document.getElementById('viewport').getBoundingClientRect();
  const rect = menuEl.getBoundingClientRect();
  const left = Math.min(x, viewport.width - rect.width - 8);
  const top = Math.min(y, viewport.height - rect.height - 8);
  menuEl.style.left = `${Math.max(4, left)}px`;
  menuEl.style.top = `${Math.max(4, top)}px`;
  menuEl.querySelector('button')?.focus({ preventScroll: true });
}

export function closeMenu() {
  menuEl.hidden = true;
  openFor = null;
}

export function isMenuOpen() {
  return Boolean(openFor);
}

document.addEventListener('pointerdown', (event) => {
  if (!menuEl.hidden && !menuEl.contains(event.target)) closeMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});
