/**
 * Sidebar panels: inventory, worn equipment, skills, quest journal, nearby
 * players and options. Each renders from the store and re-renders on its own
 * bus event, which keeps redraw cost proportional to what actually changed.
 */

import { EQUIP_SLOTS, SKILLS } from '../../../shared/constants.js';
import { ITEMS, itemName } from '../../../shared/items.js';
import { levelProgress, xpForLevel } from '../../../shared/skills.js';
import { ATTACK_STYLES } from '../../../shared/engine/combat.js';
import { EMOTES } from '../../../shared/engine/game.js';
import { actions } from '../actions.js';
import { bus, pushChat, state, saveSettings } from '../state.js';
import { itemIcon } from '../sprites.js';
import { inventoryActions, openMenu } from './menu.js';

const SLOT_LABELS = {
  head: 'Head', cape: 'Cape', amulet: 'Neck', weapon: 'Weapon', body: 'Body',
  shield: 'Shield', legs: 'Legs', gloves: 'Hands', boots: 'Feet', ring: 'Ring'
};

let dragFrom = null;

export function initPanels() {
  setupTabs();
  buildInventory();
  buildEquipment();
  buildSkills();
  buildSocial();
  buildSettings();

  bus.on('inventory', () => {
    renderInventory();
    renderEquipment();
  });
  bus.on('skills', renderSkills);
  bus.on('quests', renderQuests);
  bus.on('state', renderSocial);
  bus.on('window', () => renderInventory());
  renderInventory();
  renderEquipment();
  renderSkills();
  renderQuests();
}

function setupTabs() {
  const tabs = [...document.querySelectorAll('.tab')];
  const sidebar = document.getElementById('sidebar');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const panel = tab.dataset.panel;
      const alreadyActive = tab.getAttribute('aria-selected') === 'true';
      showPanel(panel);
      // On phones the sidebar is a bottom sheet: tapping the active tab closes it.
      if (window.matchMedia('(max-width: 980px)').matches) {
        sidebar.classList.toggle('open', !(alreadyActive && sidebar.classList.contains('open')));
      }
    });
  });
}

export function showPanel(name) {
  for (const tab of document.querySelectorAll('.tab')) {
    tab.setAttribute('aria-selected', String(tab.dataset.panel === name));
  }
  for (const panel of document.querySelectorAll('.panel')) {
    panel.hidden = panel.id !== `panel-${name}`;
  }
}

// ------------------------------------------------------------- inventory

function buildInventory() {
  const grid = document.getElementById('inventoryGrid');
  grid.innerHTML = '';
  for (let i = 0; i < 28; i += 1) {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'slot empty';
    slot.dataset.index = String(i);
    slot.setAttribute('aria-label', `Inventory slot ${i + 1}, empty`);
    slot.draggable = true;

    slot.addEventListener('click', () => {
      const entry = state.inventory[i];
      if (!entry) return;
      const list = inventoryActions(i);
      if (list.length) list[0].run();
    });
    slot.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      const entry = state.inventory[i];
      if (!entry) return;
      const rect = document.getElementById('viewport').getBoundingClientRect();
      openMenu(event.clientX - rect.left, event.clientY - rect.top, itemName(entry.id), inventoryActions(i));
    });
    slot.addEventListener('dragstart', () => {
      dragFrom = i;
      slot.classList.add('dragging');
    });
    slot.addEventListener('dragend', () => {
      dragFrom = null;
      slot.classList.remove('dragging');
    });
    slot.addEventListener('dragover', (event) => {
      event.preventDefault();
      slot.classList.add('drop-target');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('drop-target'));
    slot.addEventListener('drop', (event) => {
      event.preventDefault();
      slot.classList.remove('drop-target');
      if (dragFrom !== null && dragFrom !== i) actions.item('swap', dragFrom, { to: i });
    });

    grid.append(slot);
  }
}

export function renderInventory() {
  const grid = document.getElementById('inventoryGrid');
  let used = 0;
  [...grid.children].forEach((slot, index) => {
    const entry = state.inventory[index];
    slot.innerHTML = '';
    if (!entry) {
      slot.classList.add('empty');
      slot.setAttribute('aria-label', `Inventory slot ${index + 1}, empty`);
      return;
    }
    used += 1;
    slot.classList.remove('empty');
    slot.append(itemIcon(entry.id, 34));
    if (entry.count > 1) {
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = entry.count > 99999 ? `${Math.floor(entry.count / 1000)}k` : entry.count;
      slot.append(count);
    }
    slot.title = `${itemName(entry.id)}${entry.count > 1 ? ` x${entry.count}` : ''}`;
    slot.setAttribute('aria-label', `${itemName(entry.id)}, ${entry.count}`);
  });
  document.getElementById('invCount').textContent = `${used}/28`;
}

// ------------------------------------------------------------- equipment

function buildEquipment() {
  const layout = document.getElementById('equipmentLayout');
  const order = ['spacer', 'head', 'cape', 'weapon', 'body', 'shield', 'gloves', 'legs', 'boots', 'amulet', 'ring', 'spacer'];
  layout.innerHTML = '';
  for (const slot of order) {
    if (slot === 'spacer') {
      const filler = document.createElement('div');
      filler.className = 'slot spacer';
      layout.append(filler);
      continue;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'slot empty';
    button.dataset.slot = slot;
    button.title = SLOT_LABELS[slot];
    button.setAttribute('aria-label', `${SLOT_LABELS[slot]}: empty`);
    button.addEventListener('click', () => {
      if (state.equipment[slot]) actions.unequip(slot);
    });
    layout.append(button);
  }

  const picker = document.getElementById('stylePicker');
  picker.innerHTML = '';
  for (const style of Object.values(ATTACK_STYLES)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(state.self.style === style.id));
    button.dataset.style = style.id;
    button.textContent = style.name;
    button.addEventListener('click', () => {
      actions.style(style.id);
      state.self.style = style.id;
      renderEquipment();
    });
    picker.append(button);
  }
}

export function renderEquipment() {
  for (const button of document.querySelectorAll('#equipmentLayout .slot[data-slot]')) {
    const slot = button.dataset.slot;
    const worn = state.equipment[slot];
    button.innerHTML = '';
    if (!worn) {
      button.classList.add('empty');
      button.setAttribute('aria-label', `${SLOT_LABELS[slot]}: empty`);
      continue;
    }
    button.classList.remove('empty');
    button.append(itemIcon(worn.id, 34));
    button.title = `${itemName(worn.id)} - click to remove`;
    button.setAttribute('aria-label', `${SLOT_LABELS[slot]}: ${itemName(worn.id)}, click to remove`);
  }

  const bonuses = document.getElementById('equipBonuses');
  bonuses.innerHTML = '';
  for (const [key, label] of [['attack', 'Attack'], ['strength', 'Strength'], ['defence', 'Defence']]) {
    const cell = document.createElement('div');
    cell.innerHTML = `<strong>+${state.bonuses[key] || 0}</strong>${label}`;
    bonuses.append(cell);
  }
  for (const button of document.querySelectorAll('#stylePicker button')) {
    button.setAttribute('aria-checked', String(button.dataset.style === state.self.style));
  }
}

// ---------------------------------------------------------------- skills

function buildSkills() {
  const grid = document.getElementById('skillGrid');
  grid.innerHTML = '';
  for (const skill of SKILLS) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'skill';
    cell.dataset.skill = skill;
    cell.innerHTML = `<span class="name">${skill}</span><span class="value">1</span><span class="bar"><span style="width:0%"></span></span>`;
    cell.addEventListener('click', () => {
      const entry = state.skills[skill];
      const next = xpForLevel(Math.min(99, entry.level + 1));
      pushChat({
        channel: 'game',
        text: `${skill}: level ${entry.level}, ${Math.round(entry.xp).toLocaleString()} xp. ${
          entry.level >= 99 ? 'Mastered!' : `${Math.max(0, Math.ceil(next - entry.xp)).toLocaleString()} xp to level ${entry.level + 1}.`
        }`,
        at: Date.now()
      });
    });
    grid.append(cell);
  }
}

export function renderSkills() {
  for (const cell of document.querySelectorAll('.skill')) {
    const skill = cell.dataset.skill;
    const entry = state.skills[skill] || { level: 1, xp: 0 };
    cell.querySelector('.value').textContent = skill === 'hitpoints' ? `${state.self.hp}/${entry.level}` : entry.level;
    cell.querySelector('.bar span').style.width = `${Math.round(levelProgress(entry.xp) * 100)}%`;
    cell.setAttribute('aria-label', `${skill} level ${entry.level}`);
  }
  document.getElementById('totalLevel').textContent = `Total ${state.totalLevel} · Combat ${state.combatLevel}`;
}

// ---------------------------------------------------------------- quests

export function renderQuests() {
  const list = document.getElementById('questList');
  list.innerHTML = '';
  for (const quest of state.quests) {
    const card = document.createElement('article');
    card.className = `quest${quest.completed ? ' complete' : quest.stage > 0 ? ' active' : ''}`;
    const status = quest.completed ? 'Completed' : quest.stage > 0 ? 'In progress' : 'Not started';
    card.innerHTML = `
      <h3>${quest.name}</h3>
      <p class="meta">${quest.difficulty} · ${quest.length} · ${status}</p>
      <p class="state">${quest.stage === 0 && !quest.completed ? quest.startHint : quest.description}</p>
    `;
    if (quest.journal.length) {
      const journal = document.createElement('ol');
      for (const line of quest.journal) {
        const li = document.createElement('li');
        li.textContent = line;
        journal.append(li);
      }
      card.append(journal);
    }
    if (quest.objective) {
      const objective = document.createElement('p');
      objective.className = 'objective';
      const progress = quest.objective.have === null ? '' : ` (${quest.objective.have}/${quest.objective.need})`;
      objective.textContent = `▶ ${quest.objective.label}${progress}`;
      card.append(objective);
    }
    list.append(card);
  }
  document.getElementById('questPoints').textContent = `${state.questPoints} points`;
}

// ---------------------------------------------------------------- social

function buildSocial() {
  const row = document.getElementById('emoteRow');
  row.innerHTML = '';
  for (const emote of EMOTES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = emote;
    button.addEventListener('click', () => actions.emote(emote));
    row.append(button);
  }
}

function renderSocial() {
  const list = document.getElementById('playerList');
  const others = [...state.players.values()].filter((player) => player.id !== state.playerId);
  list.innerHTML = '';
  if (others.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Nobody else nearby right now.';
    list.append(li);
  }
  for (const player of others) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${player.name || 'Adventurer'}${player.level ? ` (level ${player.level})` : ''}</span>`;
    const trade = document.createElement('button');
    trade.className = 'small';
    trade.textContent = 'Trade';
    trade.addEventListener('click', () => actions.interact('player', player.id, 'trade'));
    li.append(trade);
    list.append(li);
  }
  document.getElementById('onlineCount').textContent = `${others.length + 1} in view`;
}

// -------------------------------------------------------------- settings

function buildSettings() {
  const body = document.getElementById('settingsBody');
  body.innerHTML = '';

  body.append(
    toggleSetting('Show names above characters', 'showNames'),
    toggleSetting('Sound effects', 'sound'),
    toggleSetting('High contrast', 'highContrast', () => applyAccessibility()),
    toggleSetting('Larger text', 'largeText', () => applyAccessibility()),
    rangeSetting('Zoom', 'zoom', 0.7, 1.8, 0.1)
  );

  const logout = document.createElement('button');
  logout.textContent = 'Log out';
  logout.addEventListener('click', () => {
    actions.logout();
    setTimeout(() => location.reload(), 200);
  });
  body.append(logout);

  const help = document.createElement('p');
  help.className = 'muted';
  help.innerHTML = 'Shortcuts: <kbd>I</kbd> bag · <kbd>E</kbd> worn · <kbd>K</kbd> skills · <kbd>Q</kbd> quests · <kbd>P</kbd> people · <kbd>O</kbd> options · <kbd>Enter</kbd> chat · <kbd>Esc</kbd> close · <kbd>R</kbd> run';
  body.append(help);

  applyAccessibility();
}

function toggleSetting(label, key, after) {
  const wrap = document.createElement('div');
  wrap.className = 'setting';
  const text = document.createElement('span');
  text.textContent = label;
  const button = document.createElement('button');
  button.className = 'switch';
  button.setAttribute('role', 'switch');
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-checked', String(Boolean(state.settings[key])));
  button.addEventListener('click', () => {
    state.settings[key] = !state.settings[key];
    button.setAttribute('aria-checked', String(state.settings[key]));
    saveSettings();
    after?.();
  });
  wrap.append(text, button);
  return wrap;
}

function rangeSetting(label, key, min, max, step) {
  const wrap = document.createElement('div');
  wrap.className = 'setting';
  const text = document.createElement('span');
  text.textContent = label;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(state.settings[key]);
  input.setAttribute('aria-label', label);
  input.addEventListener('input', () => {
    state.settings[key] = Number(input.value);
    saveSettings();
  });
  wrap.append(text, input);
  return wrap;
}

export function applyAccessibility() {
  document.body.classList.toggle('high-contrast', Boolean(state.settings.highContrast));
  document.documentElement.style.fontSize = state.settings.largeText ? '18px' : '';
}
