/**
 * Modal game windows (shop, bank, smithing, trade) and the NPC dialogue box.
 * All four windows share one dialog element so focus handling and the Escape
 * key only have to be written once.
 */

import { itemName, ITEMS, shopSellPrice } from '../../../shared/items.js';
import { REPORT_REASONS } from '../../../shared/reports.js';
import { actions } from '../actions.js';
import { bus, state } from '../state.js';
import { itemIcon } from '../sprites.js';

const layer = document.getElementById('windowLayer');
const titleEl = document.getElementById('windowTitle');
const bodyEl = document.getElementById('windowBody');
let lastFocus = null;

export function initWindows() {
  document.getElementById('windowClose').addEventListener('click', closeWindow);
  layer.addEventListener('pointerdown', (event) => {
    if (event.target === layer) closeWindow();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !layer.hidden) closeWindow();
  });

  bus.on('window', (win) => {
    if (!win) hideWindow();
    else renderWindow(win);
  });
  bus.on('dialogue', renderDialogue);
  bus.on('inventory', () => {
    // Bank and trade windows show inventory contents alongside their own list.
    if (state.window && (state.window.kind === 'bank' || state.window.kind === 'trade')) renderWindow(state.window);
  });
}

function closeWindow() {
  actions.closeWindow();
  hideWindow();
}

function hideWindow() {
  layer.hidden = true;
  bodyEl.innerHTML = '';
  lastFocus?.focus?.({ preventScroll: true });
}

function showWindow(title) {
  if (layer.hidden) lastFocus = document.activeElement;
  titleEl.textContent = title;
  layer.hidden = false;
  bodyEl.innerHTML = '';
}

function renderWindow(win) {
  switch (win.kind) {
    case 'shop': return renderShop(win.data);
    case 'bank': return renderBank(win.data);
    case 'craft': return renderCraft(win.data);
    case 'trade': return renderTrade(win.data);
    default: return hideWindow();
  }
}

function iconFor(itemId, size = 40) {
  return itemIcon(itemId, size);
}

// ----------------------------------------------------------------- shop

function renderShop(data) {
  showWindow(data.name);

  const intro = document.createElement('p');
  intro.className = 'muted';
  intro.textContent = data.greeting;
  bodyEl.append(intro);

  const grid = document.createElement('div');
  grid.className = 'shop-grid';
  for (const entry of data.stock) {
    const button = document.createElement('button');
    button.className = 'shop-item';
    button.disabled = entry.count <= 0;
    button.innerHTML = `<div class="name">${itemName(entry.id)}</div>`;
    const info = document.createElement('div');
    info.innerHTML = `<div class="name">${itemName(entry.id)}</div><div class="price">${entry.price} coins · ${entry.count} in stock</div>`;
    button.innerHTML = '';
    button.append(iconFor(entry.id), info);
    button.addEventListener('click', (event) => {
      actions.shop('buy', { id: entry.id, count: event.shiftKey ? 5 : 1 });
    });
    button.title = `${ITEMS[entry.id]?.examine || ''}\nClick to buy 1, shift-click for 5.`;
    grid.append(button);
  }
  bodyEl.append(grid);

  const sellHead = document.createElement('h3');
  sellHead.textContent = 'Your inventory (click to sell)';
  bodyEl.append(sellHead);
  bodyEl.append(inventoryStrip((index, entry) => {
    if (shopSellPrice(entry.id) <= 0) return;
    actions.shop('sell', { slot: index, count: 1 });
  }, (entry) => `${itemName(entry.id)} · sells for ${shopSellPrice(entry.id)}`));
}

// ----------------------------------------------------------------- bank

function renderBank(data) {
  showWindow('Bank of Emberfall');

  const bar = document.createElement('div');
  bar.className = 'window-actions';
  const depositAll = document.createElement('button');
  depositAll.className = 'small';
  depositAll.textContent = 'Deposit inventory';
  depositAll.addEventListener('click', () => actions.bank('depositAll'));
  const depositWorn = document.createElement('button');
  depositWorn.className = 'small';
  depositWorn.textContent = 'Deposit worn items';
  depositWorn.addEventListener('click', () => actions.bank('depositEquipment'));
  bar.append(depositAll, depositWorn);
  bodyEl.append(bar);

  const grid = document.createElement('div');
  grid.className = 'bank-grid';
  const stored = data.items.filter(Boolean).length;
  data.items.forEach((entry, index) => {
    if (!entry) return;
    const button = document.createElement('button');
    button.className = 'slot';
    button.append(iconFor(entry.id, 36));
    if (entry.count > 1) {
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = entry.count > 99999 ? `${Math.floor(entry.count / 1000)}k` : entry.count;
      button.append(count);
    }
    button.title = `${itemName(entry.id)} x${entry.count} - click to withdraw 1, shift-click for 10`;
    button.setAttribute('aria-label', `${itemName(entry.id)}, ${entry.count} stored`);
    button.addEventListener('click', (event) => {
      actions.bank('withdraw', { slot: index, count: event.shiftKey ? 10 : 1 });
    });
    grid.append(button);
  });
  if (stored === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Your bank is empty. Click something in your inventory below to store it.';
    bodyEl.append(empty);
  }
  bodyEl.append(grid);

  const head = document.createElement('h3');
  head.textContent = 'Inventory (click to deposit)';
  bodyEl.append(head);
  bodyEl.append(inventoryStrip((index) => actions.bank('deposit', { slot: index, count: 'all' })));
}

// ---------------------------------------------------------------- craft

function renderCraft(data) {
  showWindow(data.mode === 'smelt' ? 'Furnace' : 'Anvil');
  const note = document.createElement('p');
  note.className = 'muted';
  note.textContent = data.mode === 'smelt'
    ? 'Choose what to smelt. One copper and one tin make a bronze bar.'
    : 'Choose what to hammer out. You need a hammer and the right number of bars.';
  bodyEl.append(note);

  const grid = document.createElement('div');
  grid.className = 'recipe-grid';
  for (const recipe of data.recipes) {
    const button = document.createElement('button');
    button.className = 'recipe';
    const locked = data.level < recipe.level;
    button.disabled = locked;
    const requirement = data.mode === 'smelt'
      ? recipe.inputs.map((input) => `${input.count} ${itemName(input.id).toLowerCase()}`).join(' + ')
      : `${recipe.bars} x ${itemName(recipe.bar).toLowerCase()}`;
    const info = document.createElement('div');
    info.innerHTML = `<div class="name">${recipe.name}</div><div class="req">Level ${recipe.level} · ${requirement}</div>`;
    button.append(iconFor(recipe.id), info);
    button.addEventListener('click', (event) => actions.craft(recipe.id, event.shiftKey ? 10 : 1));
    button.title = locked ? `Requires smithing level ${recipe.level}` : 'Click to make 1, shift-click for 10';
    grid.append(button);
  }
  bodyEl.append(grid);
}

// ---------------------------------------------------------------- trade

function renderTrade(data) {
  showWindow(`Trading with ${data.partner}`);

  const columns = document.createElement('div');
  columns.className = 'trade-columns';
  columns.append(
    tradeColumn('Your offer', data.yours, (index) => actions.trade('withdraw', { slot: index })),
    tradeColumn(`${data.partner}'s offer`, data.theirs, null)
  );
  bodyEl.append(columns);

  const status = document.createElement('p');
  status.className = `trade-status${data.youAccepted && data.theyAccepted ? ' ready' : ''}`;
  status.textContent = `${data.youAccepted ? 'You have accepted' : 'You have not accepted'} · ${
    data.theyAccepted ? `${data.partner} has accepted` : `waiting for ${data.partner}`
  }`;
  bodyEl.append(status);

  const bar = document.createElement('div');
  bar.className = 'window-actions';
  const accept = document.createElement('button');
  accept.className = 'primary small';
  accept.textContent = data.youAccepted ? 'Withdraw acceptance' : 'Accept trade';
  accept.addEventListener('click', () => actions.trade(data.youAccepted ? 'unaccept' : 'accept'));
  const cancel = document.createElement('button');
  cancel.className = 'small';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => actions.trade('cancel'));
  bar.append(accept, cancel);
  bodyEl.append(bar);

  const head = document.createElement('h3');
  head.textContent = 'Inventory (click to offer)';
  bodyEl.append(head);
  bodyEl.append(inventoryStrip((index) => actions.trade('offer', { slot: index, count: 'all' })));
}

function tradeColumn(title, items, onClick) {
  const column = document.createElement('div');
  column.className = 'trade-column';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const slots = document.createElement('div');
  slots.className = 'trade-slots';
  for (let i = 0; i < 8; i += 1) {
    const entry = items[i];
    const cell = document.createElement('button');
    cell.className = `slot${entry ? '' : ' empty'}`;
    cell.disabled = !entry || !onClick;
    if (entry) {
      cell.append(iconFor(entry.id, 32));
      if (entry.count > 1) {
        const count = document.createElement('span');
        count.className = 'count';
        count.textContent = entry.count;
        cell.append(count);
      }
      cell.title = `${itemName(entry.id)} x${entry.count}`;
      if (onClick) cell.addEventListener('click', () => onClick(i));
    }
    slots.append(cell);
  }
  column.append(heading, slots);
  return column;
}

/** A compact row of the player's inventory, reused by every window. */
function inventoryStrip(onClick, titleFor) {
  const strip = document.createElement('div');
  strip.className = 'bank-grid';
  state.inventory.forEach((entry, index) => {
    if (!entry) return;
    const button = document.createElement('button');
    button.className = 'slot';
    button.append(iconFor(entry.id, 34));
    if (entry.count > 1) {
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = entry.count > 99999 ? `${Math.floor(entry.count / 1000)}k` : entry.count;
      button.append(count);
    }
    button.title = titleFor ? titleFor(entry) : `${itemName(entry.id)} x${entry.count}`;
    button.setAttribute('aria-label', button.title);
    button.addEventListener('click', () => onClick(index, entry));
    strip.append(button);
  });
  if (!strip.children.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Your inventory is empty.';
    return empty;
  }
  return strip;
}

// ---------------------------------------------------------------- report

/**
 * Reporting a player. Opened by the client rather than the server, because it
 * must work the instant something upsetting happens — no round trip, no
 * waiting, and one tap to send.
 */
export function openReportWindow(name) {
  showWindow(`Report ${name}`);

  const intro = document.createElement('p');
  intro.className = 'muted';
  intro.textContent = `Tell a moderator what happened with ${name}. Reports are private, and the chat around it is included so we can see for ourselves.`;
  bodyEl.append(intro);

  const list = document.createElement('div');
  list.className = 'report-reasons';
  for (const reason of REPORT_REASONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = reason.label;
    button.addEventListener('click', () => {
      actions.report(name, reason.id, noteInput.value.trim());
      hideWindow();
    });
    list.append(button);
  }
  bodyEl.append(list);

  const noteLabel = document.createElement('label');
  noteLabel.className = 'report-note';
  noteLabel.textContent = 'Anything else we should know? (optional)';
  const noteInput = document.createElement('input');
  noteInput.type = 'text';
  noteInput.maxLength = 200;
  noteInput.placeholder = 'What happened?';
  noteLabel.append(noteInput);
  bodyEl.append(noteLabel);

  const reassure = document.createElement('p');
  reassure.className = 'muted';
  reassure.textContent = 'If something online upsets you, it is always okay to tell a grown-up you trust.';
  bodyEl.append(reassure);

  list.querySelector('button')?.focus({ preventScroll: true });
}

// -------------------------------------------------------------- dialogue

function renderDialogue(node) {
  const box = document.getElementById('dialogueBox');
  const speakerEl = document.getElementById('dialogueSpeaker');
  const textEl = document.getElementById('dialogueText');
  const optionsEl = document.getElementById('dialogueOptions');

  if (!node) {
    box.hidden = true;
    optionsEl.innerHTML = '';
    return;
  }

  box.hidden = false;
  speakerEl.textContent = node.speaker === 'player' ? node.playerName || 'You' : node.npcName || '';
  textEl.textContent = node.text;
  optionsEl.innerHTML = '';

  if (node.options.length) {
    node.options.forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = option.text;
      button.addEventListener('click', () => actions.dialogueChoose(option.index));
      optionsEl.append(button);
    });
  } else {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'primary';
    button.textContent = node.canContinue ? 'Continue' : 'Goodbye';
    button.addEventListener('click', () => (node.canContinue ? actions.dialogueChoose(0) : actions.dialogueClose()));
    optionsEl.append(button);
  }
  optionsEl.querySelector('button')?.focus({ preventScroll: true });
}
