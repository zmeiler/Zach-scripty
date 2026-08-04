/**
 * Procedural sprite factory.
 *
 * The game ships with no image assets: every tile, prop, creature and item icon
 * is drawn with canvas primitives and cached as an offscreen bitmap. That keeps
 * the whole client under a few hundred kilobytes and sidesteps art licensing
 * entirely, at the cost of a chunky, deliberately retro look.
 */

import { TILE } from '../../shared/constants.js';
import { ITEMS } from '../../shared/items.js';
import { appearanceColours } from '../../shared/appearance.js';

const cache = new Map();

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function cached(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const { canvas, ctx } = makeCanvas(w, h);
  draw(ctx, w, h);
  cache.set(key, canvas);
  return canvas;
}

/** Deterministic 0..1 noise from integer coordinates. */
export function noise2(x, y, salt = 0) {
  let n = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function speckle(ctx, w, h, colours, density, salt) {
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const n = noise2(x, y, salt);
      if (n > density) continue;
      ctx.fillStyle = colours[Math.floor(noise2(x, y, salt + 7) * colours.length) % colours.length];
      ctx.fillRect(x, y, 2, 2);
    }
  }
}

// ------------------------------------------------------------------- tiles

const TILE_PAINTERS = {
  [TILE.GRASS]: (ctx, w, h, v) => {
    ctx.fillStyle = '#4a7c3f';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, ['#548a47', '#417136', '#5c9450'], 0.28, v);
  },
  [TILE.DARKGRASS]: (ctx, w, h, v) => {
    ctx.fillStyle = '#3a6634';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, ['#335c2e', '#43723b', '#2e5229'], 0.32, v + 11);
  },
  [TILE.FLOWERS]: (ctx, w, h, v) => {
    ctx.fillStyle = '#4a7c3f';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, ['#548a47', '#417136'], 0.22, v);
    for (let i = 0; i < 3; i += 1) {
      const x = Math.floor(noise2(i, v, 3) * (w - 4)) + 2;
      const y = Math.floor(noise2(v, i, 5) * (h - 4)) + 2;
      ctx.fillStyle = ['#ff8fab', '#ffd166', '#c9a0ff'][i % 3];
      ctx.fillRect(x, y, 2, 2);
    }
  },
  [TILE.PATH]: (ctx, w, h, v) => {
    ctx.fillStyle = '#a98f6a';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, ['#b89b74', '#9c8460', '#c2a880'], 0.3, v + 3);
  },
  [TILE.GRAVEL]: (ctx, w, h, v) => {
    ctx.fillStyle = '#8a8579';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, ['#9b968a', '#767065', '#a8a294'], 0.4, v + 13);
  },
  [TILE.WATER]: (ctx, w, h, v) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2f6f9e');
    grad.addColorStop(1, '#255a83');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    for (let i = 0; i < 3; i += 1) {
      const y = 4 + i * 9 + Math.floor(noise2(i, v, 2) * 3);
      ctx.fillRect(3 + i * 4, y, 10, 2);
    }
  },
  [TILE.SAND]: (ctx, w, h, v) => {
    ctx.fillStyle = '#d9c48f';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, ['#e3d09f', '#cdb87f'], 0.25, v + 5);
  },
  [TILE.STONE]: (ctx, w, h, v) => {
    ctx.fillStyle = '#8f9aa6';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    speckle(ctx, w, h, ['#98a3af', '#828d99'], 0.2, v + 8);
  },
  [TILE.WALL]: (ctx, w, h) => {
    ctx.fillStyle = '#6b625a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7d746a';
    for (let y = 0; y < h; y += 8) {
      const offset = (y / 8) % 2 === 0 ? 0 : 8;
      for (let x = -8; x < w; x += 16) ctx.fillRect(x + offset + 1, y + 1, 14, 6);
    }
  },
  [TILE.PLANK]: (ctx, w, h) => {
    ctx.fillStyle = '#8a6136';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 8) ctx.fillRect(0, y, w, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = 2; y < h; y += 8) ctx.fillRect(0, y, w, 2);
  },
  [TILE.BRIDGE]: (ctx, w, h) => {
    ctx.fillStyle = '#9a6f3f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let x = 0; x < w; x += 6) ctx.fillRect(x, 0, 1, h);
  },
  [TILE.CAVE]: (ctx, w, h, v) => {
    ctx.fillStyle = '#5b5349';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, ['#665d52', '#514a41', '#6f665a'], 0.35, v + 17);
  },
  [TILE.ROCKFACE]: (ctx, w, h, v) => {
    ctx.fillStyle = '#3f3a34';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#4b463f';
    ctx.fillRect(2, 2, w - 6, h - 8);
    speckle(ctx, w, h, ['#57514a', '#332f2a'], 0.3, v + 19);
  },

  // ----------------------------------------------------------- underground
  // The three mine levels each get their own floor and wall so that a glance
  // at the screen tells you how deep you are.
  [TILE.MINE_FLOOR]: (ctx, w, h, v) => {
    ctx.fillStyle = '#443f3d';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, ['#4d4744', '#3b3634', '#544c47'], 0.34, v + 23);
  },
  [TILE.MINE_WALL]: (ctx, w, h, v) => {
    ctx.fillStyle = '#2b2724';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#37322e';
    ctx.fillRect(2, 2, w - 6, h - 8);
    speckle(ctx, w, h, ['#413a35', '#221f1c'], 0.28, v + 29);
  },
  [TILE.EMBER]: (ctx, w, h, v) => {
    ctx.fillStyle = '#4a2a22';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, ['#5c3428', '#3d221c', '#6b3c2b'], 0.3, v + 31);
    // A few coals still glowing under the crust.
    for (let i = 0; i < 2; i += 1) {
      const x = Math.floor(noise2(i, v, 41) * (w - 4)) + 2;
      const y = Math.floor(noise2(v, i, 43) * (h - 4)) + 2;
      ctx.fillStyle = i === 0 ? '#e2703a' : '#f0a44c';
      ctx.fillRect(x, y, 2, 2);
    }
  },
  [TILE.CRYSTAL]: (ctx, w, h, v) => {
    ctx.fillStyle = '#2a1d2e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3a2a40';
    ctx.fillRect(2, 2, w - 6, h - 8);
    ctx.fillStyle = 'rgba(190,140,255,0.35)';
    ctx.fillRect(w * 0.3, h * 0.2, 3, h * 0.5);
    speckle(ctx, w, h, ['#4a3654', '#241a28'], 0.24, v + 37);
  },
  // Solid rock nobody has dug into. Drawn as nothing, so the mine reads as an
  // island of worked stone rather than a rectangle with a border.
  [TILE.VOID]: (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
  }
};

export function tileSprite(tile, variant, size) {
  const painter = TILE_PAINTERS[tile] || TILE_PAINTERS[TILE.GRASS];
  return cached(`tile:${tile}:${variant}:${size}`, size, size, (ctx, w, h) => painter(ctx, w, h, variant));
}

// ----------------------------------------------------------------- objects

const OBJECT_PAINTERS = {
  ladder_down: (ctx, w, h) => drawLadder(ctx, w, h, 'down'),
  ladder_up: (ctx, w, h) => drawLadder(ctx, w, h, 'up'),
  mine_entrance: (ctx, w, h) => {
    // A timbered mouth in the rock, with the dark of the shaft behind it.
    ctx.fillStyle = '#17120f';
    ctx.beginPath();
    ctx.moveTo(w * 0.18, h * 0.92);
    ctx.lineTo(w * 0.18, h * 0.46);
    ctx.quadraticCurveTo(w * 0.5, h * 0.2, w * 0.82, h * 0.46);
    ctx.lineTo(w * 0.82, h * 0.92);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7a5a32';
    ctx.fillRect(w * 0.12, h * 0.44, w * 0.1, h * 0.5);
    ctx.fillRect(w * 0.78, h * 0.44, w * 0.1, h * 0.5);
    ctx.fillRect(w * 0.12, h * 0.36, w * 0.76, h * 0.1);
  },
  brazier: (ctx, w, h) => {
    // Legs, bowl, flame.
    ctx.strokeStyle = '#4a4038';
    ctx.lineWidth = Math.max(2, w * 0.06);
    ctx.beginPath();
    ctx.moveTo(w * 0.36, h * 0.94);
    ctx.lineTo(w * 0.46, h * 0.62);
    ctx.moveTo(w * 0.64, h * 0.94);
    ctx.lineTo(w * 0.54, h * 0.62);
    ctx.stroke();
    ctx.fillStyle = '#5a5148';
    ctx.beginPath();
    ctx.moveTo(w * 0.26, h * 0.5);
    ctx.lineTo(w * 0.74, h * 0.5);
    ctx.lineTo(w * 0.62, h * 0.66);
    ctx.lineTo(w * 0.38, h * 0.66);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e2703a';
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.2);
    ctx.quadraticCurveTo(w * 0.72, h * 0.42, w * 0.5, h * 0.52);
    ctx.quadraticCurveTo(w * 0.28, h * 0.42, w * 0.5, h * 0.2);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.32);
    ctx.quadraticCurveTo(w * 0.62, h * 0.44, w * 0.5, h * 0.5);
    ctx.quadraticCurveTo(w * 0.38, h * 0.44, w * 0.5, h * 0.32);
    ctx.fill();
  },
  mine_cart: (ctx, w, h) => {
    ctx.fillStyle = '#5a5148';
    ctx.fillRect(w * 0.18, h * 0.42, w * 0.64, h * 0.34);
    ctx.fillStyle = '#3b352f';
    ctx.fillRect(w * 0.22, h * 0.46, w * 0.56, h * 0.12);
    ctx.fillStyle = '#2a2622';
    ctx.beginPath();
    ctx.arc(w * 0.32, h * 0.8, w * 0.09, 0, Math.PI * 2);
    ctx.arc(w * 0.68, h * 0.8, w * 0.09, 0, Math.PI * 2);
    ctx.fill();
  },
  tree: (ctx, w, h) => drawTree(ctx, w, h, '#2f6d3f', '#3f8a4f'),
  oak: (ctx, w, h) => drawTree(ctx, w, h, '#3a6b2c', '#4d8a3a'),
  willow: (ctx, w, h) => drawTree(ctx, w, h, '#6d8a3a', '#8aa84c', true),
  stump: (ctx, w, h) => {
    ctx.fillStyle = '#6b4a28';
    ctx.fillRect(w * 0.34, h * 0.68, w * 0.32, h * 0.22);
    ctx.fillStyle = '#8a6136';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.68, w * 0.18, h * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  rock_copper: (ctx, w, h) => drawRock(ctx, w, h, '#b87333'),
  rock_tin: (ctx, w, h) => drawRock(ctx, w, h, '#c9c9c9'),
  rock_iron: (ctx, w, h) => drawRock(ctx, w, h, '#a2543f'),
  rock_coal: (ctx, w, h) => drawRock(ctx, w, h, '#2f3336'),
  rock_spent: (ctx, w, h) => drawRock(ctx, w, h, null),
  fish_spot: (ctx, w, h) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, 4 + i * 5, 2 + i * 2.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  },
  bank: (ctx, w, h) => {
    ctx.fillStyle = '#6b4a28';
    ctx.fillRect(1, h * 0.35, w - 2, h * 0.55);
    ctx.fillStyle = '#8a6136';
    ctx.fillRect(1, h * 0.3, w - 2, h * 0.1);
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(w * 0.35, h * 0.5, w * 0.3, h * 0.12);
  },
  counter: (ctx, w, h) => {
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(1, h * 0.4, w - 2, h * 0.5);
    ctx.fillStyle = '#9a6f3f';
    ctx.fillRect(1, h * 0.36, w - 2, h * 0.08);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(w * 0.2, h * 0.2, w * 0.18, h * 0.16);
    ctx.fillStyle = '#2e86c1';
    ctx.fillRect(w * 0.55, h * 0.22, w * 0.16, h * 0.14);
  },
  furnace: (ctx, w, h) => {
    ctx.fillStyle = '#5b5349';
    ctx.fillRect(w * 0.1, h * 0.2, w * 0.8, h * 0.75);
    ctx.fillStyle = '#3a352f';
    ctx.fillRect(w * 0.28, h * 0.45, w * 0.44, h * 0.4);
    const grad = ctx.createRadialGradient(w / 2, h * 0.68, 1, w / 2, h * 0.68, w * 0.28);
    grad.addColorStop(0, '#ffd166');
    grad.addColorStop(1, '#e2571e');
    ctx.fillStyle = grad;
    ctx.fillRect(w * 0.32, h * 0.55, w * 0.36, h * 0.28);
  },
  anvil: (ctx, w, h) => {
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(w * 0.2, h * 0.55, w * 0.6, h * 0.14);
    ctx.fillRect(w * 0.36, h * 0.68, w * 0.28, h * 0.16);
    ctx.fillRect(w * 0.24, h * 0.84, w * 0.52, h * 0.1);
    ctx.fillStyle = '#6e6e6e';
    ctx.fillRect(w * 0.2, h * 0.52, w * 0.6, h * 0.05);
  },
  range: (ctx, w, h) => {
    ctx.fillStyle = '#5a4636';
    ctx.fillRect(w * 0.1, h * 0.3, w * 0.8, h * 0.62);
    ctx.fillStyle = '#2f2a24';
    ctx.fillRect(w * 0.22, h * 0.46, w * 0.56, h * 0.3);
    ctx.fillStyle = '#ff8c42';
    ctx.fillRect(w * 0.28, h * 0.6, w * 0.44, h * 0.14);
    ctx.fillStyle = '#9aa0a6';
    ctx.fillRect(w * 0.16, h * 0.26, w * 0.68, h * 0.07);
  },
  fountain: (ctx, w, h) => {
    ctx.fillStyle = '#5c666f';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.68, w * 0.46, h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a7b3c0';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.66, w * 0.42, h * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f7fae';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.66, w * 0.32, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8f9aa6';
    ctx.fillRect(w * 0.45, h * 0.3, w * 0.1, h * 0.32);
    ctx.fillStyle = 'rgba(191,230,255,0.85)';
    ctx.fillRect(w * 0.42, h * 0.24, w * 0.16, h * 0.08);
  },
  sign: (ctx, w, h) => {
    ctx.fillStyle = '#6b4a28';
    ctx.fillRect(w * 0.46, h * 0.45, w * 0.08, h * 0.45);
    ctx.fillStyle = '#a9713b';
    ctx.fillRect(w * 0.2, h * 0.28, w * 0.6, h * 0.26);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(w * 0.26, h * 0.34, w * 0.48, 2);
    ctx.fillRect(w * 0.26, h * 0.42, w * 0.34, 2);
  },
  fire: (ctx, w, h) => {
    ctx.fillStyle = '#5a3a1e';
    ctx.fillRect(w * 0.2, h * 0.74, w * 0.6, h * 0.1);
    const grad = ctx.createRadialGradient(w / 2, h * 0.62, 2, w / 2, h * 0.62, w * 0.4);
    grad.addColorStop(0, '#fff2a8');
    grad.addColorStop(0.5, '#ff9d3c');
    grad.addColorStop(1, 'rgba(226,87,30,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.6, w * 0.32, h * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
  }
};

function drawTree(ctx, w, h, dark, light, droopy = false) {
  ctx.fillStyle = '#5a3a1e';
  ctx.fillRect(w * 0.44, h * 0.6, w * 0.12, h * 0.32);
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.44, w * 0.36, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.ellipse(w * 0.44, h * 0.38, w * 0.24, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  if (droopy) {
    ctx.strokeStyle = light;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      const x = w * (0.22 + i * 0.19);
      ctx.beginPath();
      ctx.moveTo(x, h * 0.5);
      ctx.lineTo(x - 2, h * 0.72);
      ctx.stroke();
    }
  }
}

/** A ladder, drawn tall so it reads as something you climb rather than step over. */
function drawLadder(ctx, w, h, direction) {
  const x0 = w * 0.3;
  const x1 = w * 0.7;
  const top = h * 0.12;
  const bottom = h * 0.92;
  ctx.strokeStyle = '#7a5a32';
  ctx.lineWidth = Math.max(2, w * 0.07);
  ctx.beginPath();
  ctx.moveTo(x0, top);
  ctx.lineTo(x0, bottom);
  ctx.moveTo(x1, top);
  ctx.lineTo(x1, bottom);
  ctx.stroke();
  ctx.strokeStyle = '#9a7642';
  ctx.lineWidth = Math.max(1, w * 0.05);
  for (let i = 0; i <= 5; i += 1) {
    const y = top + ((bottom - top) * i) / 5;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
  }
  // An arrow at the end you would be heading towards.
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath();
  if (direction === 'down') {
    ctx.moveTo(w * 0.5, bottom);
    ctx.lineTo(w * 0.4, bottom - h * 0.1);
    ctx.lineTo(w * 0.6, bottom - h * 0.1);
  } else {
    ctx.moveTo(w * 0.5, top);
    ctx.lineTo(w * 0.4, top + h * 0.1);
    ctx.lineTo(w * 0.6, top + h * 0.1);
  }
  ctx.closePath();
  ctx.fill();
}

function drawRock(ctx, w, h, oreColour) {
  ctx.fillStyle = '#6d675e';
  ctx.beginPath();
  ctx.moveTo(w * 0.14, h * 0.86);
  ctx.lineTo(w * 0.28, h * 0.36);
  ctx.lineTo(w * 0.56, h * 0.24);
  ctx.lineTo(w * 0.86, h * 0.5);
  ctx.lineTo(w * 0.82, h * 0.88);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(w * 0.3, h * 0.38, w * 0.2, h * 0.1);
  if (oreColour) {
    ctx.fillStyle = oreColour;
    ctx.fillRect(w * 0.36, h * 0.5, 4, 4);
    ctx.fillRect(w * 0.58, h * 0.42, 4, 4);
    ctx.fillRect(w * 0.5, h * 0.68, 4, 4);
  }
}

export function objectSprite(art, size) {
  const painter = OBJECT_PAINTERS[art] || OBJECT_PAINTERS.stump;
  const TALL = ['tree', 'oak', 'willow', 'furnace', 'ladder_up', 'ladder_down', 'mine_entrance', 'brazier'];
  const height = TALL.includes(art) ? size * 2 : size;
  return cached(`obj:${art}:${size}`, size, height, (ctx, w, h) => painter(ctx, w, h));
}

// -------------------------------------------------------------- characters

const NPC_PALETTES = {
  mayor: { shirt: '#7a4a8a', legs: '#2c3e50', skin: '#e8b98d', hair: '#d9d9d9' },
  shopkeeper: { shirt: '#d68910', legs: '#6e4b3a', skin: '#f3d2b3', hair: '#5b3a1e' },
  banker: { shirt: '#2e4a7a', legs: '#22303f', skin: '#c98d5f', hair: '#2b2118' },
  woodsman: { shirt: '#27ae60', legs: '#5d4037', skin: '#e8b98d', hair: '#a45a2a' },
  miner: { shirt: '#8a6a3a', legs: '#4a4a4a', skin: '#a06a3f', hair: '#2b2118' },
  fisher: { shirt: '#16a085', legs: '#34495e', skin: '#f3d2b3', hair: '#8d8d8d' },
  guard: { shirt: '#95a5a6', legs: '#2c3e50', skin: '#c98d5f', hair: '#2b2118' },
  tutor: { shirt: '#5dade2', legs: '#4a3f6b', skin: '#7a4a2a', hair: '#2b2118' }
};

const CREATURE_PAINTERS = {
  rat: (ctx, w, h) => drawBeast(ctx, w, h, '#8a7f72', '#6b6157', 0.55, true),
  wolf: (ctx, w, h) => drawBeast(ctx, w, h, '#8e99a4', '#5f6a75', 0.75),
  boar: (ctx, w, h) => drawBeast(ctx, w, h, '#7a5a44', '#5b4230', 0.7),
  goblin: (ctx, w, h) => drawHumanoid(ctx, w, h, { shirt: '#6b8f3a', legs: '#4a5c2a', skin: '#7fa050', hair: '#3f5220' }, 0.82),
  imp: (ctx, w, h) => drawHumanoid(ctx, w, h, { shirt: '#8e44ad', legs: '#5b2c6f', skin: '#c0679a', hair: '#2b1030' }, 0.7),
  golem: (ctx, w, h) => {
    ctx.fillStyle = '#6d675e';
    ctx.fillRect(w * 0.22, h * 0.3, w * 0.56, h * 0.55);
    ctx.fillStyle = '#57514a';
    ctx.fillRect(w * 0.3, h * 0.16, w * 0.4, h * 0.2);
    ctx.fillStyle = '#b87333';
    ctx.fillRect(w * 0.38, h * 0.22, w * 0.08, h * 0.06);
    ctx.fillRect(w * 0.56, h * 0.22, w * 0.08, h * 0.06);
    ctx.fillStyle = '#4b463f';
    ctx.fillRect(w * 0.16, h * 0.38, w * 0.1, h * 0.34);
    ctx.fillRect(w * 0.74, h * 0.38, w * 0.1, h * 0.34);
  }
};

function drawBeast(ctx, w, h, body, shade, scale, tail = false) {
  const top = h * (1 - scale * 0.55);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, top + h * 0.2, w * 0.3 * scale + 4, h * 0.16 * scale + 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade;
  ctx.fillRect(w * 0.24, top + h * 0.28, w * 0.08, h * 0.14);
  ctx.fillRect(w * 0.68, top + h * 0.28, w * 0.08, h * 0.14);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(w * 0.74, top + h * 0.12, w * 0.13 * scale + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(w * 0.78, top + h * 0.1, 2, 2);
  if (tail) {
    ctx.strokeStyle = shade;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.24, top + h * 0.2);
    ctx.quadraticCurveTo(w * 0.06, top + h * 0.1, w * 0.12, top + h * 0.3);
    ctx.stroke();
  }
}

function drawHumanoid(ctx, w, h, palette, scale = 1, options = {}) {
  const { hairStyle = 'short', weapon = null, shield = null, helm = null, cape = null, frame = 0 } = options;
  const unit = h / 48;
  const cx = w / 2;
  const bottom = h - unit * 2;
  const legH = 12 * unit * scale;
  const bodyH = 15 * unit * scale;
  const headR = 5.2 * unit * scale;
  const swing = frame % 2 === 0 ? 1 : -1;

  if (cape) {
    ctx.fillStyle = cape;
    ctx.fillRect(cx - 7 * unit * scale, bottom - legH - bodyH + 2 * unit, 14 * unit * scale, bodyH + 6 * unit);
  }

  // Legs (alternate while walking)
  ctx.fillStyle = palette.legs;
  ctx.fillRect(cx - 5 * unit * scale, bottom - legH, 4 * unit * scale, legH - (swing > 0 ? unit : 0));
  ctx.fillRect(cx + 1 * unit * scale, bottom - legH, 4 * unit * scale, legH - (swing > 0 ? 0 : unit));

  // Torso
  ctx.fillStyle = palette.shirt;
  ctx.fillRect(cx - 6 * unit * scale, bottom - legH - bodyH, 12 * unit * scale, bodyH);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(cx - 6 * unit * scale, bottom - legH - 3 * unit, 12 * unit * scale, 3 * unit);

  // Arms
  ctx.fillStyle = palette.skin;
  ctx.fillRect(cx - 8.5 * unit * scale, bottom - legH - bodyH + unit, 3 * unit * scale, bodyH * 0.75);
  ctx.fillRect(cx + 5.5 * unit * scale, bottom - legH - bodyH + unit, 3 * unit * scale, bodyH * 0.75);

  // Head
  const headY = bottom - legH - bodyH - headR + unit;
  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  // Hair / helmet
  if (helm) {
    ctx.fillStyle = helm;
    ctx.beginPath();
    ctx.arc(cx, headY, headR + unit * 0.6, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - headR - unit * 0.6, headY - unit, (headR + unit * 0.6) * 2, unit * 1.6);
  } else if (hairStyle !== 'bald') {
    ctx.fillStyle = palette.hair;
    ctx.beginPath();
    ctx.arc(cx, headY - unit * 0.6, headR, Math.PI, Math.PI * 2);
    ctx.fill();
    if (hairStyle === 'long' || hairStyle === 'braids' || hairStyle === 'ponytail') {
      ctx.fillRect(cx - headR, headY - unit, headR * 2, headR * (hairStyle === 'ponytail' ? 1.1 : 1.6));
    }
    if (hairStyle === 'bun') {
      ctx.beginPath();
      ctx.arc(cx, headY - headR - unit, unit * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (hairStyle === 'curly') {
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.arc(cx + i * headR * 0.7, headY - headR * 0.7, unit * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Eyes
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(cx - 2.2 * unit, headY - 0.4 * unit, 1.4 * unit, 1.4 * unit);
  ctx.fillRect(cx + 1 * unit, headY - 0.4 * unit, 1.4 * unit, 1.4 * unit);

  if (weapon) {
    ctx.fillStyle = weapon;
    ctx.fillRect(cx + 8 * unit * scale, bottom - legH - bodyH - 4 * unit, 2 * unit, 16 * unit * scale);
    ctx.fillStyle = '#5a3a1e';
    ctx.fillRect(cx + 7 * unit * scale, bottom - legH - bodyH + 8 * unit, 4 * unit, 3 * unit);
  }
  if (shield) {
    ctx.fillStyle = shield;
    ctx.fillRect(cx - 12 * unit * scale, bottom - legH - bodyH + 3 * unit, 5 * unit, 10 * unit * scale);
  }
}

const METAL_COLOURS = {
  bronze: '#b87333',
  iron: '#9aa0a6',
  steel: '#cfd8dc',
  guardian: '#ffd75e',
  wooden: '#8b5a2b',
  leather: '#8d6e63'
};

export function metalOf(itemId) {
  if (!itemId) return null;
  for (const [key, colour] of Object.entries(METAL_COLOURS)) {
    if (itemId.startsWith(key)) return colour;
  }
  const def = ITEMS[itemId];
  return def && def.palette ? def.palette[0] : '#cfd8dc';
}

/**
 * Player sprite. `look` maps equipment slots to item ids so armour shows up on
 * other players without sending anything but ids over the wire.
 */
export function playerSprite(appearance, look, frame, size) {
  const colours = appearanceColours(appearance);
  const key = `pc:${JSON.stringify(appearance)}:${JSON.stringify(look || {})}:${frame}:${size}`;
  return cached(key, size, Math.round(size * 1.5), (ctx, w, h) => {
    const palette = {
      shirt: look && look.body ? metalOf(look.body) : colours.shirt,
      legs: look && look.legs ? metalOf(look.legs) : colours.legs,
      skin: colours.skin,
      hair: colours.hair
    };
    drawHumanoid(ctx, w, h, palette, colours.build === 'sturdy' ? 1.08 : 1, {
      hairStyle: look && look.head ? 'bald' : colours.hairStyle,
      helm: look && look.head ? metalOf(look.head) : null,
      weapon: look && look.weapon ? metalOf(look.weapon) : null,
      shield: look && look.shield ? metalOf(look.shield) : null,
      cape: look && look.cape ? metalOf(look.cape) : null,
      frame
    });
  });
}

export function npcSprite(art, frame, size) {
  const key = `npc:${art}:${frame}:${size}`;
  return cached(key, size, Math.round(size * 1.5), (ctx, w, h) => {
    if (CREATURE_PAINTERS[art]) {
      CREATURE_PAINTERS[art](ctx, w, h);
      return;
    }
    const palette = NPC_PALETTES[art] || NPC_PALETTES.tutor;
    drawHumanoid(ctx, w, h, palette, 1, {
      hairStyle: art === 'guard' ? 'bald' : 'short',
      helm: art === 'guard' ? '#cfd8dc' : null,
      weapon: art === 'guard' ? '#cfd8dc' : null,
      frame
    });
  });
}

// ------------------------------------------------------------- item icons

const ICON_PAINTERS = {
  coin: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = b; ctx.beginPath(); ctx.arc(w * 0.55, h * 0.55, w * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = a; ctx.beginPath(); ctx.arc(w * 0.45, h * 0.45, w * 0.3, 0, Math.PI * 2); ctx.fill();
  },
  log: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = a; ctx.fillRect(w * 0.12, h * 0.34, w * 0.76, h * 0.3);
    ctx.fillStyle = b; ctx.beginPath(); ctx.ellipse(w * 0.86, h * 0.49, w * 0.08, h * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = a; ctx.fillRect(w * 0.2, h * 0.62, w * 0.6, h * 0.2);
  },
  ore: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = '#6d675e';
    ctx.beginPath(); ctx.moveTo(w * 0.2, h * 0.76); ctx.lineTo(w * 0.32, h * 0.3); ctx.lineTo(w * 0.7, h * 0.26); ctx.lineTo(w * 0.82, h * 0.74); ctx.closePath(); ctx.fill();
    ctx.fillStyle = a; ctx.fillRect(w * 0.36, h * 0.42, w * 0.14, h * 0.14);
    ctx.fillStyle = b; ctx.fillRect(w * 0.56, h * 0.54, w * 0.12, h * 0.12);
  },
  bar: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = b; ctx.fillRect(w * 0.16, h * 0.5, w * 0.68, h * 0.22);
    ctx.fillStyle = a; ctx.fillRect(w * 0.22, h * 0.4, w * 0.62, h * 0.16);
  },
  fish: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = a; ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.5, w * 0.3, h * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = b; ctx.beginPath(); ctx.moveTo(w * 0.18, h * 0.5); ctx.lineTo(w * 0.05, h * 0.34); ctx.lineTo(w * 0.05, h * 0.66); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1b1b1b'; ctx.fillRect(w * 0.68, h * 0.44, 2, 2);
  },
  sword: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = a; ctx.fillRect(w * 0.45, h * 0.12, w * 0.1, h * 0.56);
    ctx.fillStyle = b; ctx.fillRect(w * 0.32, h * 0.66, w * 0.36, h * 0.07);
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(w * 0.44, h * 0.72, w * 0.12, h * 0.18);
  },
  dagger: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = a; ctx.fillRect(w * 0.46, h * 0.24, w * 0.08, h * 0.4);
    ctx.fillStyle = b; ctx.fillRect(w * 0.36, h * 0.62, w * 0.28, h * 0.06);
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(w * 0.45, h * 0.68, w * 0.1, h * 0.16);
  },
  axe: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(w * 0.44, h * 0.22, w * 0.1, h * 0.62);
    // A wedge with a curved cutting edge reads as an axe; a plain triangle
    // reads as a flag on a pole.
    ctx.fillStyle = a;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.2);
    ctx.quadraticCurveTo(w * 0.9, h * 0.24, w * 0.86, h * 0.44);
    ctx.quadraticCurveTo(w * 0.78, h * 0.56, w * 0.5, h * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = b;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.2);
    ctx.lineTo(w * 0.58, h * 0.21);
    ctx.lineTo(w * 0.58, h * 0.5);
    ctx.lineTo(w * 0.5, h * 0.5);
    ctx.closePath();
    ctx.fill();
  },
  pickaxe: (ctx, w, h, [a]) => {
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(w * 0.46, h * 0.2, w * 0.08, h * 0.66);
    ctx.strokeStyle = a; ctx.lineWidth = Math.max(2, w * 0.08);
    ctx.beginPath(); ctx.moveTo(w * 0.2, h * 0.34); ctx.quadraticCurveTo(w * 0.5, h * 0.16, w * 0.8, h * 0.34); ctx.stroke();
  },
  hammer: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = a; ctx.fillRect(w * 0.46, h * 0.3, w * 0.08, h * 0.56);
    ctx.fillStyle = b; ctx.fillRect(w * 0.28, h * 0.2, w * 0.44, h * 0.16);
  },
  rod: (ctx, w, h, [a, b]) => {
    ctx.strokeStyle = a; ctx.lineWidth = Math.max(2, w * 0.06);
    ctx.beginPath(); ctx.moveTo(w * 0.2, h * 0.82); ctx.lineTo(w * 0.78, h * 0.18); ctx.stroke();
    ctx.strokeStyle = b; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w * 0.78, h * 0.18); ctx.lineTo(w * 0.6, h * 0.7); ctx.stroke();
  },
  net: (ctx, w, h, [a]) => {
    ctx.strokeStyle = a; ctx.lineWidth = 1.5;
    for (let i = 0; i <= 4; i += 1) {
      ctx.beginPath(); ctx.moveTo(w * 0.2 + i * w * 0.15, h * 0.24); ctx.lineTo(w * 0.2 + i * w * 0.15, h * 0.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w * 0.2, h * 0.24 + i * h * 0.14); ctx.lineTo(w * 0.8, h * 0.24 + i * h * 0.14); ctx.stroke();
    }
  },
  box: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = a; ctx.fillRect(w * 0.24, h * 0.36, w * 0.52, h * 0.4);
    ctx.fillStyle = b; ctx.fillRect(w * 0.24, h * 0.36, w * 0.52, h * 0.1);
  },
  shield: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = a;
    ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.16); ctx.lineTo(w * 0.82, h * 0.3); ctx.lineTo(w * 0.7, h * 0.82); ctx.lineTo(w * 0.5, h * 0.9);
    ctx.lineTo(w * 0.3, h * 0.82); ctx.lineTo(w * 0.18, h * 0.3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = b; ctx.fillRect(w * 0.46, h * 0.3, w * 0.08, h * 0.44);
  },
  body: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = a; ctx.fillRect(w * 0.26, h * 0.26, w * 0.48, h * 0.5);
    ctx.fillStyle = b; ctx.fillRect(w * 0.14, h * 0.3, w * 0.14, h * 0.3);
    ctx.fillRect(w * 0.72, h * 0.3, w * 0.14, h * 0.3);
  },
  legs: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = a; ctx.fillRect(w * 0.28, h * 0.26, w * 0.44, h * 0.2);
    ctx.fillStyle = b; ctx.fillRect(w * 0.28, h * 0.46, w * 0.18, h * 0.34);
    ctx.fillRect(w * 0.54, h * 0.46, w * 0.18, h * 0.34);
  },
  helm: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = a; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.54, w * 0.28, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillRect(w * 0.22, h * 0.54, w * 0.56, h * 0.14);
    ctx.fillStyle = b; ctx.fillRect(w * 0.46, h * 0.3, w * 0.08, h * 0.24);
  },
  gloves: (ctx, w, h, [a]) => {
    ctx.fillStyle = a; ctx.fillRect(w * 0.24, h * 0.4, w * 0.22, h * 0.34);
    ctx.fillRect(w * 0.54, h * 0.4, w * 0.22, h * 0.34);
  },
  boots: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = a; ctx.fillRect(w * 0.24, h * 0.4, w * 0.2, h * 0.3);
    ctx.fillRect(w * 0.56, h * 0.4, w * 0.2, h * 0.3);
    ctx.fillStyle = b; ctx.fillRect(w * 0.2, h * 0.66, w * 0.28, h * 0.12);
    ctx.fillRect(w * 0.52, h * 0.66, w * 0.28, h * 0.12);
  },
  cape: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = a; ctx.beginPath(); ctx.moveTo(w * 0.3, h * 0.22); ctx.lineTo(w * 0.7, h * 0.22); ctx.lineTo(w * 0.82, h * 0.82); ctx.lineTo(w * 0.18, h * 0.82); ctx.closePath(); ctx.fill();
    ctx.fillStyle = b; ctx.fillRect(w * 0.3, h * 0.22, w * 0.4, h * 0.08);
  },
  amulet: (ctx, w, h, [a, b]) => {
    ctx.strokeStyle = b; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.42, w * 0.22, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = a; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.66, w * 0.12, 0, Math.PI * 2); ctx.fill();
  },
  ring: (ctx, w, h, [a, b]) => {
    ctx.strokeStyle = a; ctx.lineWidth = Math.max(3, w * 0.1);
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.56, w * 0.22, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = b; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.3, w * 0.1, 0, Math.PI * 2); ctx.fill();
  },
  gem: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = a; ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.2); ctx.lineTo(w * 0.78, h * 0.5); ctx.lineTo(w * 0.5, h * 0.82); ctx.lineTo(w * 0.22, h * 0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = b; ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.2); ctx.lineTo(w * 0.5, h * 0.82); ctx.lineTo(w * 0.22, h * 0.5); ctx.closePath(); ctx.fill();
  },
  bread: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = a; ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.56, w * 0.32, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = b; ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath(); ctx.moveTo(w * (0.5 + i * 0.16), h * 0.42); ctx.lineTo(w * (0.54 + i * 0.16), h * 0.54); ctx.stroke();
    }
  },
  cake: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = b; ctx.fillRect(w * 0.24, h * 0.48, w * 0.52, h * 0.3);
    ctx.fillStyle = a; ctx.fillRect(w * 0.24, h * 0.38, w * 0.52, h * 0.14);
    ctx.fillStyle = '#ff8fab'; ctx.fillRect(w * 0.46, h * 0.26, w * 0.06, h * 0.12);
  },
  lamp: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = b; ctx.fillRect(w * 0.36, h * 0.24, w * 0.28, h * 0.08);
    ctx.fillStyle = a; ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.56, w * 0.2, h * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = b; ctx.fillRect(w * 0.34, h * 0.76, w * 0.32, h * 0.08);
  },
  torch: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = a;
    ctx.fillRect(w * 0.44, h * 0.42, w * 0.12, h * 0.5);
    ctx.fillStyle = b;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.1);
    ctx.quadraticCurveTo(w * 0.74, h * 0.32, w * 0.5, h * 0.46);
    ctx.quadraticCurveTo(w * 0.26, h * 0.32, w * 0.5, h * 0.1);
    ctx.fill();
    ctx.fillStyle = '#fff0b3';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.32, w * 0.06, h * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  key: (ctx, w, h, [a, b]) => {
    ctx.strokeStyle = a; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(w * 0.36, h * 0.4, w * 0.14, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = a; ctx.fillRect(w * 0.44, h * 0.46, w * 0.34, h * 0.08);
    ctx.fillStyle = b; ctx.fillRect(w * 0.68, h * 0.54, w * 0.06, h * 0.12);
  },
  pelt: (ctx, w, h, [a, b]) => {
    ctx.fillStyle = a; ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.54, w * 0.3, h * 0.26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = b; ctx.fillRect(w * 0.42, h * 0.34, w * 0.16, h * 0.4);
  },
  flower: (ctx, w, h, [a, b]) => {
    ctx.strokeStyle = b; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.86); ctx.lineTo(w * 0.5, h * 0.5); ctx.stroke();
    ctx.fillStyle = a;
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(w * 0.5 + Math.cos(angle) * w * 0.14, h * 0.4 + Math.sin(angle) * h * 0.14, w * 0.09, 0, Math.PI * 2); ctx.fill();
    }
  }
};

export function itemSprite(itemId, size = 32) {
  const def = ITEMS[itemId];
  const shape = (def && def.shape) || 'box';
  const palette = (def && def.palette) || ['#9aa0a6', '#5f6368'];
  return cached(`item:${itemId}:${size}`, size, size, (ctx, w, h) => {
    const painter = ICON_PAINTERS[shape] || ICON_PAINTERS.box;
    painter(ctx, w, h, palette);
  });
}

/**
 * Returns a *new* canvas element containing the given sprite.
 *
 * `canvas.cloneNode()` copies the element but not its pixels, so every UI icon
 * has to be blitted into a fresh canvas rather than cloned.
 */
export function spriteElement(source, cssSize = 32) {
  const { canvas, ctx } = makeCanvas(source.width, source.height);
  ctx.drawImage(source, 0, 0);
  canvas.style.width = `${cssSize}px`;
  canvas.style.height = `${cssSize}px`;
  return canvas;
}

export function itemIcon(itemId, cssSize = 32) {
  return spriteElement(itemSprite(itemId, 32), cssSize);
}

export function clearSpriteCache() {
  cache.clear();
}
