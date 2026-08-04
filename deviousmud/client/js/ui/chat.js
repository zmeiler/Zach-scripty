/**
 * Chat log and entry box. Messages arrive on four channels (game, public,
 * system, private) and the chips filter the log without losing history.
 */

import { actions } from '../actions.js';
import { bus, state, saveSettings } from '../state.js';

const logEl = document.getElementById('chatLog');
const formEl = document.getElementById('chatForm');
const inputEl = document.getElementById('chatInput');

export function initChat() {
  for (const chip of document.querySelectorAll('.chat-tabs .chip')) {
    chip.addEventListener('click', () => {
      state.settings.chatFilter = chip.dataset.channel;
      saveSettings();
      for (const other of document.querySelectorAll('.chat-tabs .chip')) {
        const active = other === chip;
        other.classList.toggle('active', active);
        other.setAttribute('aria-selected', String(active));
      }
      renderAll();
    });
    if (chip.dataset.channel === state.settings.chatFilter) chip.click();
  }

  formEl.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = inputEl.value.trim();
    if (text) actions.chat(text);
    inputEl.value = '';
    inputEl.blur();
  });

  bus.on('chat', (entry) => {
    if (matchesFilter(entry)) appendLine(entry);
  });

  renderAll();
}

export function focusChat() {
  inputEl.focus();
}

export function isChatFocused() {
  return document.activeElement === inputEl;
}

function matchesFilter(entry) {
  const filter = state.settings.chatFilter || 'all';
  return filter === 'all' || entry.channel === filter;
}

function appendLine(entry) {
  const line = document.createElement('p');
  line.className = `c-${entry.channel}`;
  if (entry.who) {
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = `${entry.who}: `;
    line.append(who);
  }
  line.append(document.createTextNode(entry.text));
  const atBottom = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 24;
  logEl.append(line);
  while (logEl.childElementCount > 260) logEl.firstElementChild.remove();
  if (atBottom) logEl.scrollTop = logEl.scrollHeight;
}

function renderAll() {
  logEl.innerHTML = '';
  for (const entry of state.chat) {
    if (matchesFilter(entry)) appendLine(entry);
  }
  logEl.scrollTop = logEl.scrollHeight;
}
