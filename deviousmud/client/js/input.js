/**
 * Input handling for mouse, touch and keyboard.
 *
 * One rule keeps the three consistent: a tap or left click runs the primary
 * action, a right click or long press opens the full action menu.
 */

import { actions } from './actions.js';
import { bus, state } from './state.js';
import { closeMenu, isMenuOpen, openMenu, worldActions } from './ui/menu.js';
import { focusChat, isChatFocused } from './ui/chat.js';
import { showPanel } from './ui/panels.js';
import { hint, toast } from './ui/hud.js';

const LONG_PRESS_MS = 420;
const DRAG_TOLERANCE = 12;

export function initInput({ canvas, renderer, minimap, minimapCanvas }) {
  let pointerDownAt = null;
  let longPressTimer = null;
  let moved = false;

  const localPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 2) return; // handled by contextmenu
    const point = localPoint(event);
    pointerDownAt = point;
    moved = false;
    canvas.setPointerCapture?.(event.pointerId);

    longPressTimer = setTimeout(() => {
      if (moved) return;
      const pick = renderer.pick(point.x, point.y);
      openMenu(point.x, point.y, describe(pick), worldActions(pick));
      pointerDownAt = null;
      if (navigator.vibrate) navigator.vibrate(12);
    }, LONG_PRESS_MS);
  });

  canvas.addEventListener('pointermove', (event) => {
    const point = localPoint(event);
    renderer.setHover(point.x, point.y);
    if (pointerDownAt && Math.hypot(point.x - pointerDownAt.x, point.y - pointerDownAt.y) > DRAG_TOLERANCE) {
      moved = true;
      clearTimeout(longPressTimer);
    }
    if (event.pointerType === 'mouse') {
      const pick = renderer.pick(point.x, point.y);
      const first = worldActions(pick)[0];
      hint(first ? first.label : '');
    }
  });

  canvas.addEventListener('pointerleave', () => {
    renderer.hoverTile = null;
    hint('');
  });

  // Changing plane teleports the world out from under the cursor, so whatever
  // the hint was describing is no longer there to describe.
  bus.on('plane', () => hint(''));

  canvas.addEventListener('pointerup', (event) => {
    clearTimeout(longPressTimer);
    if (!pointerDownAt || moved) {
      pointerDownAt = null;
      return;
    }
    if (isMenuOpen()) {
      closeMenu();
      pointerDownAt = null;
      return;
    }
    const point = localPoint(event);
    const pick = renderer.pick(point.x, point.y);
    const [primary] = worldActions(pick);
    primary?.run();
    pointerDownAt = null;
  });

  canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const pick = renderer.pick(point.x, point.y);
    openMenu(point.x, point.y, describe(pick), worldActions(pick));
  });

  // Minimap: click to walk.
  minimapCanvas.addEventListener('click', (event) => {
    const rect = minimapCanvas.getBoundingClientRect();
    const target = minimap.toWorld(
      ((event.clientX - rect.left) / rect.width) * minimapCanvas.width,
      ((event.clientY - rect.top) / rect.height) * minimapCanvas.height
    );
    actions.walkTo(target.x, target.y);
  });

  // Keyboard.
  window.addEventListener('keydown', (event) => {
    if (state.mode !== 'game') return;
    if (isChatFocused()) {
      if (event.key === 'Escape') event.target.blur();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    switch (event.key.toLowerCase()) {
      case 'enter':
        event.preventDefault();
        focusChat();
        break;
      case 'i': showPanel('inventory'); break;
      case 'e': showPanel('equipment'); break;
      case 'k': showPanel('skills'); break;
      case 'q': showPanel('quests'); break;
      case 'p': showPanel('social'); break;
      case 'o': showPanel('settings'); break;
      case 'r':
        state.self.run = !state.self.run;
        actions.toggleRun(state.self.run);
        toast(state.self.run ? 'Running' : 'Walking');
        break;
      case 'escape':
        closeMenu();
        actions.closeWindow();
        break;
      case 'arrowup': case 'w': step(0, -1); break;
      case 'arrowdown': case 's': step(0, 1); break;
      case 'arrowleft': case 'a': step(-1, 0); break;
      case 'arrowright': case 'd': step(1, 0); break;
      default: return;
    }
    if (event.key !== 'Enter') event.preventDefault();
  });

  // Touch shortcut buttons.
  const touchControls = document.getElementById('touchControls');
  if (matchMedia('(pointer: coarse)').matches) touchControls.hidden = false;
  touchControls.addEventListener('click', (event) => {
    const button = event.target.closest('[data-touch]');
    if (!button) return;
    if (button.dataset.touch === 'run') {
      state.self.run = !state.self.run;
      actions.toggleRun(state.self.run);
      toast(state.self.run ? 'Running' : 'Walking');
    } else if (button.dataset.touch === 'chat') {
      focusChat();
    } else if (button.dataset.touch === 'panels') {
      document.getElementById('sidebar').classList.toggle('open');
    }
  });

  // Pinch to zoom on touch devices.
  let pinchStart = null;
  canvas.addEventListener('touchstart', (event) => {
    if (event.touches.length === 2) {
      pinchStart = { distance: touchDistance(event), zoom: state.settings.zoom };
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (event) => {
    if (event.touches.length === 2 && pinchStart) {
      const ratio = touchDistance(event) / pinchStart.distance;
      state.settings.zoom = Math.max(0.7, Math.min(1.8, pinchStart.zoom * ratio));
    }
  }, { passive: true });
  canvas.addEventListener('touchend', () => {
    pinchStart = null;
  });
}

function touchDistance(event) {
  const [a, b] = event.touches;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function step(dx, dy) {
  actions.walkTo(state.self.x + dx, state.self.y + dy);
}

function describe(pick) {
  if (!pick) return '';
  if (pick.kind === 'npc') return pick.entity.name;
  if (pick.kind === 'player') return pick.entity.name || 'Adventurer';
  if (pick.kind === 'ground_item') return 'Item';
  if (pick.kind === 'object') return 'Object';
  return 'Ground';
}
