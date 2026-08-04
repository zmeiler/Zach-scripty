/**
 * Heads-up display: the hitpoints and run-energy orbs, region label, tile
 * coordinates, hint bar and level-up toasts.
 */

import { actions } from '../actions.js';
import { bus, state } from '../state.js';

const CIRCUMFERENCE = 2 * Math.PI * 17;

export function initHud() {
  document.getElementById('orbEnergy').addEventListener('click', () => {
    state.self.run = !state.self.run;
    actions.toggleRun(state.self.run);
    toast(state.self.run ? 'Running' : 'Walking');
  });

  bus.on('state', renderHud);
  bus.on('skills', renderHud);
  bus.on('effect', (effect) => {
    if (effect.kind === 'levelup') toast(`${effect.skill} level ${effect.level}!`);
    if (effect.kind === 'quest' && effect.state === 'complete') toast('Quest complete!');
    if (effect.kind === 'knockout') toast('Knocked out - waking up in Emberfall');
  });
}

export function renderHud() {
  const hpFraction = state.self.maxHp ? Math.max(0, state.self.hp / state.self.maxHp) : 0;
  const energyFraction = Math.max(0, Math.min(1, (state.self.energy ?? 100) / 100));

  const hpCircle = document.querySelector('.orb-fill.hp');
  const energyCircle = document.querySelector('.orb-fill.energy');
  if (hpCircle) hpCircle.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - hpFraction));
  if (energyCircle) energyCircle.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - energyFraction));

  document.getElementById('hpValue').textContent = state.self.hp ?? 0;
  document.getElementById('energyValue').textContent = Math.round(state.self.energy ?? 0);
  document.getElementById('orbEnergy').classList.toggle('walking', !state.self.run);
  document.getElementById('regionLabel').textContent = state.self.region || 'Emberfall';
  document.getElementById('coords').textContent = `${state.self.x}, ${state.self.y}`;
}

export function hint(text) {
  const bar = document.getElementById('hintBar');
  bar.textContent = text || '';
}

let toastTimer = null;
export function toast(text) {
  const area = document.getElementById('toastArea');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  area.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2600);
  while (area.childElementCount > 3) area.firstElementChild.remove();
}
