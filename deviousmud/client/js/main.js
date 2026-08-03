/**
 * Client entry point: screen flow (title -> character creation -> game),
 * transport selection, and the render loop.
 */

import { buildWorld } from '../../shared/world.js';
import { GAME_NAME } from '../../shared/constants.js';
import { applyMessage, bus, state, pushChat } from './state.js';
import { setTransport, actions } from './actions.js';
import { SocketTransport, SoloTransport, probeServer } from './net.js';
import { Minimap, Renderer } from './renderer.js';
import { initInput } from './input.js';
import { initAudio } from './audio.js';
import { initPanels, applyAccessibility, renderQuests } from './ui/panels.js';
import { initChat } from './ui/chat.js';
import { initWindows } from './ui/windows.js';
import { initHud, renderHud, toast } from './ui/hud.js';
import { getAppearance, initCreation, setAppearance } from './ui/creation.js';

const world = buildWorld();
let transport = null;
let renderer = null;
let minimap = null;
let serverInfo = null;

const screens = {
  title: document.getElementById('screen-title'),
  create: document.getElementById('screen-create'),
  game: document.getElementById('screen-game')
};

function showScreen(name) {
  state.mode = name;
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  if (name === 'game') {
    requestAnimationFrame(() => {
      renderer?.resize();
      document.getElementById('world').focus({ preventScroll: true });
    });
  }
}

// --------------------------------------------------------------- bootstrap

async function boot() {
  document.title = `${GAME_NAME} - Emberfall`;
  initCreation(() => {});
  initAudio();
  wireTitleScreen();
  applyAccessibility();
  document.body.classList.remove('loading');

  serverInfo = await probeServer();
  const line = document.getElementById('serverLine');
  if (serverInfo) {
    line.textContent = `Server online · ${serverInfo.online} adventurer${serverInfo.online === 1 ? '' : 's'} in Emberfall.`;
    line.classList.add('online');
  } else {
    line.textContent = 'No game server found. You can still play solo - progress saves in this browser.';
    line.classList.add('offline');
    document.getElementById('passwordField').hidden = true;
  }
  if (SoloTransport.hasSave()) {
    const save = SoloTransport.loadSave(null);
    if (save?.name) document.getElementById('loginName').value = save.name;
  }
}

function wireTitleScreen() {
  const form = document.getElementById('loginForm');
  const errorEl = document.getElementById('loginError');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('loginName').value.trim();
    const password = document.getElementById('loginPass').value;
    if (!serverInfo) {
      startSolo(name || 'Adventurer');
      return;
    }
    if (!name) {
      showError(errorEl, 'Please enter your character name.');
      return;
    }
    startOnline({ mode: 'login', name, password, appearance: getAppearance() });
  });

  document.getElementById('btnRegister').addEventListener('click', () => {
    document.getElementById('createName').value = document.getElementById('loginName').value.trim();
    showScreen('create');
  });

  document.getElementById('btnSolo').addEventListener('click', () => {
    const name = document.getElementById('loginName').value.trim() || 'Adventurer';
    startSolo(name);
  });

  document.getElementById('btnCreateBack').addEventListener('click', () => showScreen('title'));

  document.getElementById('createForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('createName').value.trim();
    const password = document.getElementById('createPass').value;
    const errorCreate = document.getElementById('createError');
    if (name.length < 3) {
      showError(errorCreate, 'Names need at least 3 characters.');
      return;
    }
    if (serverInfo && password.length < 4) {
      showError(errorCreate, 'Passwords need at least 4 characters.');
      return;
    }
    if (serverInfo) startOnline({ mode: 'register', name, password, appearance: getAppearance() });
    else startSolo(name);
  });
}

function showError(el, text) {
  el.textContent = text;
  el.hidden = false;
}

// -------------------------------------------------------------- transports

async function startOnline(credentials) {
  const errorEl = state.mode === 'create' ? document.getElementById('createError') : document.getElementById('loginError');
  errorEl.hidden = true;
  try {
    transport = new SocketTransport({ onMessage: handleMessage, onStatus: handleStatus });
    await transport.connect();
    setTransport(transport);
    transport.authenticate(credentials);
  } catch (err) {
    showError(errorEl, `${err.message} You can still play solo.`);
  }
}

function startSolo(name) {
  transport = new SoloTransport({ onMessage: handleMessage, onStatus: handleStatus });
  setTransport(transport);
  transport.connect().then(() => {
    transport.authenticate({ name, appearance: getAppearance() });
  });
}

function handleStatus(status) {
  state.connection = status;
  if (status === 'lost') toast('Connection lost - reconnecting…');
  if (status === 'reconnecting') toast('Reconnecting…');
  if (status === 'error') toast('Could not reconnect. Reload to try again.');
}

function handleMessage(msg) {
  if (msg.t === 'authError') {
    const errorEl = state.mode === 'create' ? document.getElementById('createError') : document.getElementById('loginError');
    showError(errorEl, msg.reason);
    return;
  }
  if (msg.t === 'hello') return;
  applyMessage(msg);
}

// ------------------------------------------------------------- game start

bus.on('login', (msg) => {
  if (state.mode === 'game') return;
  if (msg.checksum && msg.checksum !== world.checksum) {
    console.warn('World checksum mismatch - reload to pick up the latest client build.');
  }
  setAppearance(msg.appearance);
  startGame();
});

function startGame() {
  showScreen('game');

  const canvas = document.getElementById('world');
  const minimapCanvas = document.getElementById('minimap');
  renderer = new Renderer(canvas, world);
  minimap = new Minimap(minimapCanvas, world);

  initPanels();
  initChat();
  initWindows();
  initHud();
  initInput({ canvas, renderer, minimap, minimapCanvas });
  renderQuests();
  renderHud();

  // Debug/automation hook. The server is authoritative, so nothing here can be
  // used to cheat - it only exposes what this tab already knows.
  window.DEVIOUSMUD = { state, renderer, minimap, actions, world };

  window.addEventListener('resize', () => renderer.resize());
  const observer = new ResizeObserver(() => renderer.resize());
  observer.observe(document.getElementById('viewport'));

  pushChat({ channel: 'system', text: `Welcome to Emberfall, ${state.playerName}. Talk to Tutor Pip by the fountain if you are new.`, at: Date.now() });

  let last = 0;
  function frame(now) {
    renderer.render(now);
    // The minimap only needs a few frames a second.
    if (now - last > 120) {
      minimap.render();
      last = now;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

window.addEventListener('beforeunload', () => {
  try {
    actions.logout();
    transport?.close();
  } catch {
    /* leaving anyway */
  }
});

boot();
