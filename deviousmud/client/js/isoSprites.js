/**
 * Isometric art set.
 *
 * Purpose-drawn for the 2:1 view: floors are diamonds, solids are cubes with a
 * lit top and two shaded sides, and props sit on a diamond footprint so they
 * key into the floor rather than floating on it. Everything is generated once
 * into an offscreen bitmap and reused, so the game still ships with no image
 * files.
 *
 * Anchoring convention, shared with the renderer:
 *   floors     drawn centred on the tile centre,
 *   props      bottom edge on the tile's lower vertex (their sprite includes
 *              the tile footprint),
 *   characters feet just below the tile centre.
 */

import { TILE } from '../../shared/constants.js';
import { appearanceColours } from '../../shared/appearance.js';
import { metalOf, noise2 } from './sprites.js';
import { FACE, ISO_TILE_H, ISO_TILE_W, ISO_WALL_H, diamondPath, shade } from './iso.js';

const cache = new Map();

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w);
  canvas.height = Math.ceil(h);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function cached(key, w, h, draw) {
  const hit = cache.get(key);
  if (hit) return hit;
  const { canvas, ctx } = makeCanvas(w, h);
  draw(ctx, canvas.width, canvas.height);
  cache.set(key, canvas);
  return canvas;
}

// ---------------------------------------------------------------- floors

const FLOORS = {
  [TILE.GRASS]: { base: '#4a7c3f', grain: ['#568b48', '#417136', '#5f9a52'], tufts: 3 },
  [TILE.DARKGRASS]: { base: '#3a6634', grain: ['#33602f', '#44743c', '#2c5228'], tufts: 4 },
  [TILE.FLOWERS]: { base: '#4d8042', grain: ['#568b48', '#417136'], tufts: 2, flowers: true },
  [TILE.PATH]: { base: '#a98f6a', grain: ['#b89b74', '#9a8360', '#c2a880'], pebbles: 4 },
  [TILE.GRAVEL]: { base: '#8a8579', grain: ['#9b968a', '#767065', '#a8a294'], pebbles: 6 },
  [TILE.SAND]: { base: '#d9c48f', grain: ['#e3d09f', '#cdb87f'], pebbles: 2 },
  [TILE.STONE]: { base: '#8f9aa6', grain: ['#98a3af', '#828d99'], slabs: true },
  [TILE.PLANK]: { base: '#8a6136', grain: ['#96693c', '#7c5730'], boards: true },
  [TILE.BRIDGE]: { base: '#9a6f3f', grain: ['#a87a46', '#8a6236'], boards: true },
  [TILE.CAVE]: { base: '#5b5349', grain: ['#665d52', '#514a41', '#6f665a'], pebbles: 5 },
  [TILE.WATER]: { base: '#2f6f9e', grain: ['#356f9c', '#2a648f'], water: true },
  // Underground. Each mine level gets its own floor so depth is legible at a
  // glance, without a single word of interface.
  [TILE.MINE_FLOOR]: { base: '#443f3d', grain: ['#4d4744', '#3b3634', '#544c47'], pebbles: 6 },
  [TILE.EMBER]: { base: '#4a2a22', grain: ['#5c3428', '#3d221c', '#6b3c2b'], pebbles: 4, embers: true }
};

function floorTexture(ctx, w, h, def, variant) {
  ctx.save();
  diamondPath(ctx, w, h);
  ctx.clip();

  ctx.fillStyle = def.base;
  ctx.fillRect(0, 0, w, h);

  // Grain: small diamond flecks so the surface is not a flat colour.
  for (let i = 0; i < 26; i += 1) {
    const n = noise2(i, variant, 3);
    const m = noise2(variant, i, 11);
    const x = n * w;
    const y = m * h;
    ctx.fillStyle = def.grain[Math.floor(noise2(i, variant, 17) * def.grain.length) % def.grain.length];
    ctx.fillRect(Math.floor(x), Math.floor(y), 2, 1);
  }

  if (def.slabs) {
    // Slab joints follow the two isometric axes.
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w / 2, h);
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  }

  if (def.boards) {
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i += 1) {
      const t = i / 4;
      ctx.beginPath();
      ctx.moveTo(w * t * 0.5, h * (0.5 - t * 0.5) + h * 0.5 * t);
      ctx.lineTo(w * (0.5 + t * 0.5), h * (t * 0.5) + h * 0.5);
      ctx.stroke();
    }
  }

  if (def.pebbles) {
    for (let i = 0; i < def.pebbles; i += 1) {
      const x = 8 + noise2(i, variant, 5) * (w - 16);
      const y = 6 + noise2(variant, i, 7) * (h - 12);
      ctx.fillStyle = shade(def.base, 0.78);
      ctx.beginPath();
      ctx.ellipse(x, y, 2.5, 1.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(def.base, 1.18);
      ctx.fillRect(Math.floor(x - 1), Math.floor(y - 1.6), 2, 1);
    }
  }

  if (def.tufts) {
    for (let i = 0; i < def.tufts; i += 1) {
      const x = 10 + noise2(i, variant, 23) * (w - 20);
      const y = 8 + noise2(variant, i, 29) * (h - 14);
      ctx.strokeStyle = shade(def.base, 1.22);
      ctx.lineWidth = 1;
      for (let blade = -1; blade <= 1; blade += 1) {
        ctx.beginPath();
        ctx.moveTo(x + blade * 2, y + 2);
        ctx.lineTo(x + blade * 3, y - 3);
        ctx.stroke();
      }
    }
  }

  if (def.embers) {
    // Cracks in the crust, with something warm underneath.
    for (let i = 0; i < 3; i += 1) {
      const x = 12 + noise2(i, variant, 53) * (w - 24);
      const y = 8 + noise2(variant, i, 59) * (h - 14);
      ctx.fillStyle = i === 0 ? '#f0a44c' : '#d4622f';
      ctx.fillRect(Math.floor(x), Math.floor(y), 2, 1);
      ctx.fillStyle = 'rgba(255,150,60,0.22)';
      ctx.beginPath();
      ctx.ellipse(x + 1, y, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (def.flowers) {
    for (let i = 0; i < 3; i += 1) {
      const x = 12 + noise2(i, variant, 31) * (w - 24);
      const y = 8 + noise2(variant, i, 37) * (h - 14);
      ctx.fillStyle = ['#ff8fab', '#ffd166', '#c9a0ff'][i % 3];
      ctx.fillRect(Math.floor(x), Math.floor(y), 2, 2);
      ctx.fillRect(Math.floor(x) - 2, Math.floor(y) + 1, 2, 1);
    }
  }

  if (def.water) {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#3a7cab');
    grad.addColorStop(1, '#22557f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 2; i += 1) {
      const y = h * (0.35 + i * 0.28) + noise2(i, variant, 41) * 3;
      ctx.beginPath();
      ctx.moveTo(w * 0.24, y);
      ctx.lineTo(w * 0.44, y + 3);
      ctx.moveTo(w * 0.56, y - 2);
      ctx.lineTo(w * 0.74, y + 1);
      ctx.stroke();
    }
  }

  ctx.restore();

  // A soft top-left edge light and bottom-right shadow give the tile a facet.
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(1, h / 2);
  ctx.lineTo(w / 2, 1);
  ctx.lineTo(w - 1, h / 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.14)';
  ctx.beginPath();
  ctx.moveTo(1, h / 2);
  ctx.lineTo(w / 2, h - 1);
  ctx.lineTo(w - 1, h / 2);
  ctx.stroke();
}

export function isoFloorSprite(tile, variant) {
  const def = FLOORS[tile] || FLOORS[TILE.GRASS];
  return cached(`floor:${tile}:${variant}`, ISO_TILE_W, ISO_TILE_H, (ctx, w, h) => {
    floorTexture(ctx, w, h, def, variant);
  });
}

// ----------------------------------------------------------------- cubes

/**
 * A solid block: lit top diamond plus the two visible side faces. Used for
 * walls, the quarry rock face and anything else that occupies a whole tile.
 */
/**
 * A solid block: lit top diamond plus the two visible side faces.
 *
 * The sprite is exactly `ISO_TILE_H + height` tall, with the block's lowest
 * point on the bottom edge, so it shares the props' anchoring rule: bottom edge
 * sits on the tile's lower vertex.
 */
function drawCube(ctx, w, h, height, colour, decorate) {
  const topH = ISO_TILE_H;
  const midY = topH / 2;            // y of the left and right corners of the top face
  const lowY = topH;                // y of the near (bottom) corner of the top face

  // Left face.
  ctx.fillStyle = shade(colour, FACE.left);
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(w / 2, lowY);
  ctx.lineTo(w / 2, lowY + height);
  ctx.lineTo(0, midY + height);
  ctx.closePath();
  ctx.fill();

  // Right face.
  ctx.fillStyle = shade(colour, FACE.right);
  ctx.beginPath();
  ctx.moveTo(w, midY);
  ctx.lineTo(w / 2, lowY);
  ctx.lineTo(w / 2, lowY + height);
  ctx.lineTo(w, midY + height);
  ctx.closePath();
  ctx.fill();

  // Top.
  ctx.fillStyle = shade(colour, FACE.top);
  diamondPath(ctx, w, topH, 0, 0);
  ctx.fill();

  // Edges where faces meet.
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  diamondPath(ctx, w, topH, 0, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w / 2, lowY);
  ctx.lineTo(w / 2, lowY + height);
  ctx.stroke();

  if (decorate) decorate(ctx, w, h, midY, height, lowY);
}

const CUBES = {
  wall: {
    colour: '#7d746a',
    height: ISO_WALL_H,
    decorate: (ctx, w, h, midY, height, lowY) => {
      // Courses of stone running along both side faces.
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i += 1) {
        const dy = (height / 3) * i;
        ctx.beginPath();
        ctx.moveTo(0, midY + dy);
        ctx.lineTo(w / 2, lowY + dy);
        ctx.lineTo(w, midY + dy);
        ctx.stroke();
      }
      // Vertical joints, offset per course like real brickwork.
      ctx.beginPath();
      ctx.moveTo(w * 0.25, midY + height / 3.5);
      ctx.lineTo(w * 0.25, midY + height / 1.6);
      ctx.moveTo(w * 0.75, midY + height / 3.5);
      ctx.lineTo(w * 0.75, midY + height / 1.6);
      ctx.stroke();
    }
  },
  rockface: {
    colour: '#4b463f',
    height: ISO_WALL_H + 14,
    decorate: (ctx, w, h, midY, height, lowY) => {
      // Broken strata, so a cliff face does not read as smooth masonry.
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath();
      ctx.moveTo(w * 0.08, midY + height * 0.15);
      ctx.lineTo(w * 0.34, lowY + height * 0.3);
      ctx.lineTo(w * 0.3, lowY + height * 0.7);
      ctx.lineTo(w * 0.06, midY + height * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.moveTo(w * 0.62, lowY + height * 0.2);
      ctx.lineTo(w * 0.92, midY + height * 0.25);
      ctx.lineTo(w * 0.92, midY + height * 0.7);
      ctx.lineTo(w * 0.62, lowY + height * 0.72);
      ctx.closePath();
      ctx.fill();
    }
  },
  mine_wall: {
    colour: '#37322e',
    height: ISO_WALL_H + 10,
    decorate: (ctx, w, h, midY, height, lowY) => {
      // Pick marks: this rock was cut, not weathered.
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i += 1) {
        const y = midY + height * (0.18 + i * 0.15);
        ctx.beginPath();
        ctx.moveTo(w * 0.1, y);
        ctx.lineTo(w * 0.3, y + 5);
        ctx.moveTo(w * 0.7, y + 4);
        ctx.lineTo(w * 0.9, y - 1);
        ctx.stroke();
      }
    }
  },
  crystal: {
    colour: '#3a2a40',
    height: ISO_WALL_H + 20,
    decorate: (ctx, w, h, midY, height, lowY) => {
      // Veins of something that has not seen daylight in a very long time.
      ctx.fillStyle = 'rgba(186,140,255,0.4)';
      ctx.beginPath();
      ctx.moveTo(w * 0.2, midY + height * 0.2);
      ctx.lineTo(w * 0.32, lowY + height * 0.34);
      ctx.lineTo(w * 0.24, lowY + height * 0.78);
      ctx.lineTo(w * 0.14, midY + height * 0.66);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,206,120,0.28)';
      ctx.beginPath();
      ctx.moveTo(w * 0.68, lowY + height * 0.28);
      ctx.lineTo(w * 0.86, midY + height * 0.34);
      ctx.lineTo(w * 0.84, midY + height * 0.74);
      ctx.lineTo(w * 0.66, lowY + height * 0.74);
      ctx.closePath();
      ctx.fill();
    }
  }
};

export function isoCubeSprite(kind) {
  const def = CUBES[kind] || CUBES.wall;
  const height = def.height;
  return cached(`cube:${kind}`, ISO_TILE_W, ISO_TILE_H + height, (ctx, w, h) => {
    drawCube(ctx, w, h, height, def.colour, def.decorate);
  });
}

// ----------------------------------------------------------------- props

/** Ground shadow shared by every free-standing prop. */
function propShadow(ctx, w, h, scale = 0.42) {
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.beginPath();
  ctx.ellipse(w / 2, h - ISO_TILE_H / 2, ISO_TILE_W * scale * 0.5, ISO_TILE_H * scale * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawIsoTree(ctx, w, h, trunkColour, leafColour, style) {
  const baseY = h - ISO_TILE_H / 2;
  propShadow(ctx, w, h, 0.6);

  ctx.fillStyle = shade(trunkColour, 0.8);
  ctx.fillRect(w / 2 - 4, baseY - 30, 8, 30);
  ctx.fillStyle = trunkColour;
  ctx.fillRect(w / 2 - 4, baseY - 30, 4, 30);

  const tiers = style === 'willow' ? 2 : 3;
  for (let i = 0; i < tiers; i += 1) {
    const t = i / tiers;
    const cy = baseY - 34 - i * 20;
    const radius = (style === 'oak' ? 24 : 20) - i * 4;
    ctx.fillStyle = shade(leafColour, FACE.right);
    ctx.beginPath();
    ctx.ellipse(w / 2 + 3, cy + 3, radius, radius * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = leafColour;
    ctx.beginPath();
    ctx.ellipse(w / 2, cy, radius, radius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(leafColour, FACE.top);
    ctx.beginPath();
    ctx.ellipse(w / 2 - radius * 0.28, cy - radius * 0.3, radius * 0.5, radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    if (style === 'willow') {
      ctx.strokeStyle = shade(leafColour, 0.9);
      ctx.lineWidth = 2;
      for (let b = -2; b <= 2; b += 1) {
        ctx.beginPath();
        ctx.moveTo(w / 2 + b * 9, cy + radius * 0.4);
        ctx.quadraticCurveTo(w / 2 + b * 10, cy + radius * 0.9, w / 2 + b * 8, cy + radius * 1.3);
        ctx.stroke();
      }
    }
    if (t > 0.9) break;
  }
}

function drawIsoRock(ctx, w, h, oreColour) {
  const baseY = h - ISO_TILE_H / 2;
  propShadow(ctx, w, h, 0.55);
  const body = '#6d675e';

  ctx.fillStyle = shade(body, FACE.right);
  ctx.beginPath();
  ctx.moveTo(w / 2, baseY - 4);
  ctx.lineTo(w / 2 + 22, baseY - 14);
  ctx.lineTo(w / 2 + 16, baseY - 30);
  ctx.lineTo(w / 2, baseY - 24);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = shade(body, FACE.left);
  ctx.beginPath();
  ctx.moveTo(w / 2, baseY - 4);
  ctx.lineTo(w / 2 - 22, baseY - 14);
  ctx.lineTo(w / 2 - 15, baseY - 30);
  ctx.lineTo(w / 2, baseY - 24);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = shade(body, FACE.top);
  ctx.beginPath();
  ctx.moveTo(w / 2, baseY - 24);
  ctx.lineTo(w / 2 + 16, baseY - 30);
  ctx.lineTo(w / 2 + 2, baseY - 40);
  ctx.lineTo(w / 2 - 15, baseY - 30);
  ctx.closePath();
  ctx.fill();

  if (oreColour) {
    ctx.fillStyle = oreColour;
    ctx.fillRect(w / 2 - 8, baseY - 22, 4, 3);
    ctx.fillRect(w / 2 + 6, baseY - 26, 4, 3);
    ctx.fillRect(w / 2 - 1, baseY - 14, 4, 3);
    ctx.fillStyle = shade(oreColour, 1.3);
    ctx.fillRect(w / 2 - 8, baseY - 22, 2, 1);
    ctx.fillRect(w / 2 + 6, baseY - 26, 2, 1);
  }
}

/** A small box-shaped prop: counters, anvils, ranges, furnaces. */
function drawIsoBox(ctx, w, h, { width = 40, depth = 40, height = 26, colour = '#7a5230', top }) {
  const baseY = h - ISO_TILE_H / 2;
  const halfW = width / 2;
  const halfD = depth / 2;
  const cx = w / 2;

  const corners = {
    n: { x: cx, y: baseY - (halfW + halfD) / 2 * 0.5 },
    e: { x: cx + halfW, y: baseY - (halfD - halfW) / 4 },
    s: { x: cx, y: baseY },
    w: { x: cx - halfD, y: baseY - (halfW - halfD) / 4 }
  };
  const top4 = {
    n: { x: corners.n.x, y: corners.n.y - height },
    e: { x: corners.e.x, y: corners.e.y - height },
    s: { x: corners.s.x, y: corners.s.y - height },
    w: { x: corners.w.x, y: corners.w.y - height }
  };

  propShadow(ctx, w, h, 0.7);

  // Left face.
  ctx.fillStyle = shade(colour, FACE.left);
  ctx.beginPath();
  ctx.moveTo(corners.w.x, corners.w.y);
  ctx.lineTo(corners.s.x, corners.s.y);
  ctx.lineTo(top4.s.x, top4.s.y);
  ctx.lineTo(top4.w.x, top4.w.y);
  ctx.closePath();
  ctx.fill();

  // Right face.
  ctx.fillStyle = shade(colour, FACE.right);
  ctx.beginPath();
  ctx.moveTo(corners.s.x, corners.s.y);
  ctx.lineTo(corners.e.x, corners.e.y);
  ctx.lineTo(top4.e.x, top4.e.y);
  ctx.lineTo(top4.s.x, top4.s.y);
  ctx.closePath();
  ctx.fill();

  // Top.
  ctx.fillStyle = shade(colour, FACE.top);
  ctx.beginPath();
  ctx.moveTo(top4.n.x, top4.n.y);
  ctx.lineTo(top4.e.x, top4.e.y);
  ctx.lineTo(top4.s.x, top4.s.y);
  ctx.lineTo(top4.w.x, top4.w.y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (top) top(ctx, { cx, topY: top4.n.y, baseY, width, height, corners: top4 });
}

/**
 * A ladder leaning into a shaft. The shaft itself is a dark diamond sunk into
 * the tile, so the eye reads "hole" before it reads "prop" - which is what
 * makes clicking one feel obvious rather than learned.
 */
function drawIsoLadder(ctx, w, h, direction) {
  const baseY = h - ISO_TILE_H / 2;

  // The opening.
  ctx.fillStyle = '#0b0806';
  ctx.beginPath();
  ctx.moveTo(w / 2, baseY - ISO_TILE_H * 0.42);
  ctx.lineTo(w / 2 + ISO_TILE_W * 0.38, baseY);
  ctx.lineTo(w / 2, baseY + ISO_TILE_H * 0.42);
  ctx.lineTo(w / 2 - ISO_TILE_W * 0.38, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Two rails running up out of the hole, and rungs between them.
  const topY = baseY - (direction === 'down' ? 30 : 62);
  const railL = w / 2 - 8;
  const railR = w / 2 + 8;
  ctx.strokeStyle = shade('#7a5a32', FACE.top);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(railL, baseY + 4);
  ctx.lineTo(railL - 3, topY);
  ctx.moveTo(railR, baseY + 4);
  ctx.lineTo(railR - 3, topY);
  ctx.stroke();
  ctx.strokeStyle = shade('#9a7642', FACE.left);
  ctx.lineWidth = 2;
  const rungs = direction === 'down' ? 3 : 6;
  for (let i = 0; i <= rungs; i += 1) {
    const t = i / rungs;
    const y = baseY + 4 + (topY - baseY - 4) * t;
    ctx.beginPath();
    ctx.moveTo(railL - 3 * t, y);
    ctx.lineTo(railR - 3 * t, y);
    ctx.stroke();
  }
}

const PROPS = {
  ladder_down: (ctx, w, h) => drawIsoLadder(ctx, w, h, 'down'),
  ladder_up: (ctx, w, h) => drawIsoLadder(ctx, w, h, 'up'),
  mine_entrance: (ctx, w, h) => {
    const baseY = h - ISO_TILE_H / 2;
    propShadow(ctx, w, h, 0.6);
    // Dark mouth.
    ctx.fillStyle = '#100c0a';
    ctx.beginPath();
    ctx.moveTo(w * 0.24, baseY);
    ctx.lineTo(w * 0.24, baseY - 34);
    ctx.quadraticCurveTo(w * 0.5, baseY - 62, w * 0.76, baseY - 34);
    ctx.lineTo(w * 0.76, baseY);
    ctx.closePath();
    ctx.fill();
    // Timber frame.
    ctx.fillStyle = shade('#7a5a32', FACE.left);
    ctx.fillRect(w * 0.18, baseY - 44, 7, 46);
    ctx.fillStyle = shade('#7a5a32', FACE.right);
    ctx.fillRect(w * 0.75, baseY - 44, 7, 46);
    ctx.fillStyle = shade('#8a6a3c', FACE.top);
    ctx.fillRect(w * 0.16, baseY - 52, w * 0.66, 9);
    // Spoil heap either side, so it sits in the ground rather than on it.
    ctx.fillStyle = shade('#5b5349', FACE.left);
    ctx.beginPath();
    ctx.ellipse(w * 0.5, baseY + 2, ISO_TILE_W * 0.42, ISO_TILE_H * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  brazier: (ctx, w, h) => {
    const baseY = h - ISO_TILE_H / 2;
    propShadow(ctx, w, h, 0.42);
    // A warm pool on the floor, so the light reads even before the darkness
    // layer is composited over it.
    ctx.fillStyle = 'rgba(255,160,70,0.16)';
    ctx.beginPath();
    ctx.ellipse(w / 2, baseY, ISO_TILE_W * 0.44, ISO_TILE_H * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = shade('#4a4038', FACE.left);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 8, baseY);
    ctx.lineTo(w / 2 - 3, baseY - 20);
    ctx.moveTo(w / 2 + 8, baseY);
    ctx.lineTo(w / 2 + 3, baseY - 20);
    ctx.moveTo(w / 2, baseY + 3);
    ctx.lineTo(w / 2, baseY - 20);
    ctx.stroke();

    // Bowl: a shallow ellipse for the rim, a darker one for the inside.
    ctx.fillStyle = shade('#5a5148', FACE.left);
    ctx.beginPath();
    ctx.ellipse(w / 2, baseY - 20, 13, 7, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = shade('#6a6158', FACE.top);
    ctx.beginPath();
    ctx.ellipse(w / 2, baseY - 22, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b211b';
    ctx.beginPath();
    ctx.ellipse(w / 2, baseY - 22, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Flame.
    ctx.fillStyle = '#e2703a';
    ctx.beginPath();
    ctx.moveTo(w / 2, baseY - 46);
    ctx.quadraticCurveTo(w / 2 + 11, baseY - 30, w / 2, baseY - 21);
    ctx.quadraticCurveTo(w / 2 - 11, baseY - 30, w / 2, baseY - 46);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(w / 2, baseY - 39);
    ctx.quadraticCurveTo(w / 2 + 6, baseY - 29, w / 2, baseY - 22);
    ctx.quadraticCurveTo(w / 2 - 6, baseY - 29, w / 2, baseY - 39);
    ctx.fill();
  },
  mine_cart: (ctx, w, h) => {
    const baseY = h - ISO_TILE_H / 2;
    propShadow(ctx, w, h, 0.44);
    drawIsoBox(ctx, w, h, { width: 34, depth: 22, height: 16, colour: '#5a5148' });
    ctx.fillStyle = '#2a2622';
    ctx.beginPath();
    ctx.ellipse(w * 0.38, baseY, 5, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(w * 0.62, baseY, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  tree: (ctx, w, h) => drawIsoTree(ctx, w, h, '#6b4a28', '#3f8a4f', 'tree'),
  oak: (ctx, w, h) => drawIsoTree(ctx, w, h, '#5f4326', '#4d8a3a', 'oak'),
  willow: (ctx, w, h) => drawIsoTree(ctx, w, h, '#6b5a34', '#8aa84c', 'willow'),
  stump: (ctx, w, h) => {
    const baseY = h - ISO_TILE_H / 2;
    propShadow(ctx, w, h, 0.45);
    ctx.fillStyle = shade('#6b4a28', FACE.left);
    ctx.fillRect(w / 2 - 10, baseY - 14, 20, 14);
    ctx.fillStyle = shade('#8a6136', FACE.top);
    ctx.beginPath();
    ctx.ellipse(w / 2, baseY - 14, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(w / 2, baseY - 14, 5, 2.4, 0, 0, Math.PI * 2);
    ctx.stroke();
  },
  rock_copper: (ctx, w, h) => drawIsoRock(ctx, w, h, '#b87333'),
  rock_tin: (ctx, w, h) => drawIsoRock(ctx, w, h, '#c9c9c9'),
  rock_iron: (ctx, w, h) => drawIsoRock(ctx, w, h, '#a2543f'),
  rock_coal: (ctx, w, h) => drawIsoRock(ctx, w, h, '#2f3336'),
  rock_mithril: (ctx, w, h) => drawIsoRock(ctx, w, h, '#5c7cbf'),
  rock_adamant: (ctx, w, h) => drawIsoRock(ctx, w, h, '#3f7a52'),
  rock_spent: (ctx, w, h) => drawIsoRock(ctx, w, h, null),
  fish_spot: (ctx, w, h) => {
    const baseY = h - ISO_TILE_H / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.ellipse(w / 2, baseY - 6, 6 + i * 7, 3 + i * 3.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(w / 2 + 5, baseY - 9, 3, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  bank: (ctx, w, h) => drawIsoBox(ctx, w, h, {
    width: 46, depth: 46, height: 30, colour: '#6b4a28',
    top: (c, { cx, topY }) => {
      c.fillStyle = '#f2c14e';
      c.fillRect(cx - 10, topY + 14, 20, 5);
      c.fillStyle = shade('#f2c14e', 0.7);
      c.fillRect(cx - 10, topY + 19, 20, 2);
    }
  }),
  counter: (ctx, w, h) => drawIsoBox(ctx, w, h, {
    width: 46, depth: 46, height: 26, colour: '#7a5230',
    top: (c, { cx, topY }) => {
      c.fillStyle = '#c0392b';
      c.fillRect(cx - 14, topY + 8, 9, 7);
      c.fillStyle = '#2e86c1';
      c.fillRect(cx + 3, topY + 11, 8, 6);
      c.fillStyle = '#e0b877';
      c.fillRect(cx - 4, topY + 16, 10, 4);
    }
  }),
  furnace: (ctx, w, h) => {
    drawIsoBox(ctx, w, h, { width: 48, depth: 48, height: 48, colour: '#5b5349' });
    const baseY = h - ISO_TILE_H / 2;
    // Mouth with a fire glow on the front-left face.
    const grad = ctx.createRadialGradient(w / 2 - 8, baseY - 24, 2, w / 2 - 8, baseY - 24, 16);
    grad.addColorStop(0, '#fff0b0');
    grad.addColorStop(0.45, '#ff9d3c');
    grad.addColorStop(1, 'rgba(226,87,30,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(w / 2 - 8, baseY - 24, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2520';
    ctx.fillRect(w / 2 + 4, baseY - 62, 10, 14);
  },
  anvil: (ctx, w, h) => {
    const baseY = h - ISO_TILE_H / 2;
    propShadow(ctx, w, h, 0.5);
    ctx.fillStyle = shade('#4a4a4a', FACE.left);
    ctx.fillRect(w / 2 - 12, baseY - 12, 24, 12);
    ctx.fillStyle = shade('#4a4a4a', FACE.right);
    ctx.fillRect(w / 2 - 6, baseY - 22, 12, 12);
    ctx.fillStyle = shade('#6e6e6e', FACE.top);
    ctx.beginPath();
    ctx.moveTo(w / 2 - 20, baseY - 24);
    ctx.lineTo(w / 2, baseY - 32);
    ctx.lineTo(w / 2 + 20, baseY - 24);
    ctx.lineTo(w / 2, baseY - 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade('#6e6e6e', FACE.right);
    ctx.beginPath();
    ctx.moveTo(w / 2 + 20, baseY - 24);
    ctx.lineTo(w / 2 + 26, baseY - 22);
    ctx.lineTo(w / 2 + 20, baseY - 18);
    ctx.lineTo(w / 2 + 12, baseY - 20);
    ctx.closePath();
    ctx.fill();
  },
  range: (ctx, w, h) => {
    drawIsoBox(ctx, w, h, { width: 46, depth: 46, height: 30, colour: '#5a4636' });
    const baseY = h - ISO_TILE_H / 2;
    ctx.fillStyle = '#2f2a24';
    ctx.fillRect(w / 2 - 14, baseY - 22, 16, 12);
    ctx.fillStyle = '#ff8c42';
    ctx.fillRect(w / 2 - 12, baseY - 19, 12, 7);
    ctx.fillStyle = shade('#9aa0a6', FACE.top);
    ctx.beginPath();
    ctx.ellipse(w / 2 + 4, baseY - 38, 9, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  fountain: (ctx, w, h) => {
    const baseY = h - ISO_TILE_H / 2;
    propShadow(ctx, w, h, 0.85);
    ctx.fillStyle = shade('#8f9aa6', FACE.left);
    ctx.beginPath();
    ctx.ellipse(w / 2, baseY - 6, 26, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade('#8f9aa6', FACE.top);
    ctx.beginPath();
    ctx.ellipse(w / 2, baseY - 10, 26, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f6f9e';
    ctx.beginPath();
    ctx.ellipse(w / 2, baseY - 10, 19, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(191,230,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(w / 2 - 5, baseY - 12, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade('#8f9aa6', FACE.top);
    ctx.fillRect(w / 2 - 4, baseY - 34, 8, 24);
    ctx.beginPath();
    ctx.ellipse(w / 2, baseY - 34, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(191,230,255,0.8)';
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i += 2) {
      ctx.beginPath();
      ctx.moveTo(w / 2, baseY - 36);
      ctx.quadraticCurveTo(w / 2 + i * 14, baseY - 30, w / 2 + i * 12, baseY - 14);
      ctx.stroke();
    }
  },
  sign: (ctx, w, h) => {
    const baseY = h - ISO_TILE_H / 2;
    propShadow(ctx, w, h, 0.35);
    ctx.fillStyle = shade('#6b4a28', FACE.left);
    ctx.fillRect(w / 2 - 3, baseY - 30, 6, 30);
    ctx.fillStyle = shade('#a9713b', FACE.top);
    ctx.beginPath();
    ctx.moveTo(w / 2 - 20, baseY - 44);
    ctx.lineTo(w / 2 + 18, baseY - 50);
    ctx.lineTo(w / 2 + 18, baseY - 32);
    ctx.lineTo(w / 2 - 20, baseY - 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(w / 2 - 14, baseY - 42, 26, 2);
    ctx.fillRect(w / 2 - 14, baseY - 37, 18, 2);
  },
  fire: (ctx, w, h) => {
    const baseY = h - ISO_TILE_H / 2;
    ctx.fillStyle = '#5a3a1e';
    ctx.beginPath();
    ctx.ellipse(w / 2, baseY - 4, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    const grad = ctx.createRadialGradient(w / 2, baseY - 16, 2, w / 2, baseY - 16, 22);
    grad.addColorStop(0, '#fff2a8');
    grad.addColorStop(0.45, '#ff9d3c');
    grad.addColorStop(1, 'rgba(226,87,30,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(w / 2, baseY - 18, 16, 20, 0, 0, Math.PI * 2);
    ctx.fill();
  }
};

/** Height in pixels above the tile footprint for each prop. */
const PROP_HEIGHTS = {
  ladder_down: 44, ladder_up: 76, mine_entrance: 72, mine_cart: 40, brazier: 64,
  tree: 110, oak: 116, willow: 104, stump: 34,
  rock_copper: 56, rock_tin: 56, rock_iron: 56, rock_coal: 56, rock_spent: 56,
  rock_mithril: 58, rock_adamant: 60,
  fish_spot: 34, bank: 62, counter: 58, furnace: 96, anvil: 56, range: 66,
  fountain: 62, sign: 62, fire: 48
};

export function isoPropSprite(art) {
  const painter = PROPS[art] || PROPS.stump;
  const height = PROP_HEIGHTS[art] || 48;
  return cached(`prop:${art}`, ISO_TILE_W, height + ISO_TILE_H, (ctx, w, h) => painter(ctx, w, h));
}

export function isoPropHeight(art) {
  return (PROP_HEIGHTS[art] || 48) + ISO_TILE_H;
}

// ------------------------------------------------------------ characters

const CHAR_W = 48;
const CHAR_H = 72;

/**
 * One character, drawn three-quarter view to match the projection.
 * `facing` is 'front' or 'back'; the renderer mirrors the sprite for the two
 * remaining directions, which is how four facings come from two drawings.
 */
function drawIsoCharacter(ctx, w, h, palette, options) {
  const { facing = 'front', frame = 0, weapon, shield, helm, cape, build = 'slim' } = options;
  const cx = w / 2;
  const groundY = h - 4;
  const wide = build === 'sturdy' ? 1.12 : 1;

  const legH = 16;
  const bodyH = 20 * wide;
  const headR = 7.5;
  const step = frame % 2 === 0 ? 1 : -1;

  // Contact shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, groundY, 13, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  if (cape) {
    ctx.fillStyle = shade(cape, facing === 'back' ? 1.05 : 0.75);
    ctx.beginPath();
    ctx.moveTo(cx - 9 * wide, groundY - legH - bodyH + 2);
    ctx.lineTo(cx + 9 * wide, groundY - legH - bodyH + 2);
    ctx.lineTo(cx + 11 * wide, groundY - 6);
    ctx.lineTo(cx - 11 * wide, groundY - 6);
    ctx.closePath();
    ctx.fill();
  }

  // Legs, offset along the isometric axis so a walk cycle reads at this scale.
  ctx.fillStyle = shade(palette.legs, FACE.left);
  ctx.fillRect(cx - 7, groundY - legH, 6, legH - (step > 0 ? 2 : 0));
  ctx.fillStyle = shade(palette.legs, FACE.right);
  ctx.fillRect(cx + 1, groundY - legH, 6, legH - (step > 0 ? 0 : 2));

  // Torso: two tones so the body has a lit and a shaded side.
  const torsoY = groundY - legH - bodyH;
  ctx.fillStyle = shade(palette.shirt, FACE.left);
  ctx.fillRect(cx - 9 * wide, torsoY, 9 * wide, bodyH);
  ctx.fillStyle = shade(palette.shirt, FACE.right);
  ctx.fillRect(cx, torsoY, 9 * wide, bodyH);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(cx - 9 * wide, groundY - legH - 3, 18 * wide, 3);

  // Arms.
  ctx.fillStyle = shade(palette.skin, FACE.left);
  ctx.fillRect(cx - 12 * wide, torsoY + 2, 4, bodyH * 0.7);
  ctx.fillStyle = shade(palette.skin, FACE.right);
  ctx.fillRect(cx + 8 * wide, torsoY + 2, 4, bodyH * 0.7);

  // Head.
  const headY = torsoY - headR + 1;
  ctx.fillStyle = shade(palette.skin, 1.02);
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(palette.skin, FACE.right);
  ctx.beginPath();
  ctx.arc(cx + 1.5, headY + 1, headR - 1, -Math.PI / 3, Math.PI / 2);
  ctx.fill();

  if (helm) {
    ctx.fillStyle = shade(helm, FACE.top);
    ctx.beginPath();
    ctx.arc(cx, headY, headR + 1.5, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(helm, FACE.left);
    ctx.fillRect(cx - headR - 1.5, headY - 1, (headR + 1.5) * 2, 3);
  } else if (palette.hairStyle !== 'bald') {
    ctx.fillStyle = palette.hair;
    ctx.beginPath();
    ctx.arc(cx, headY - 1, headR, Math.PI, Math.PI * 2);
    ctx.fill();
    if (facing === 'back') {
      ctx.beginPath();
      ctx.arc(cx, headY, headR, 0, Math.PI * 2);
      ctx.fill();
    } else if (['long', 'braids', 'ponytail'].includes(palette.hairStyle)) {
      ctx.fillRect(cx - headR, headY - 1, headR * 2, headR * 1.5);
    }
    if (palette.hairStyle === 'bun') {
      ctx.beginPath();
      ctx.arc(cx, headY - headR - 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (facing === 'front') {
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(cx - 3, headY - 1, 2, 2);
    ctx.fillRect(cx + 1, headY - 1, 2, 2);
  }

  if (weapon) {
    ctx.fillStyle = shade(weapon, FACE.top);
    ctx.fillRect(cx + 11 * wide, torsoY - 8, 3, 22);
    ctx.fillStyle = '#5a3a1e';
    ctx.fillRect(cx + 10 * wide, torsoY + 12, 5, 4);
  }
  if (shield) {
    ctx.fillStyle = shade(shield, FACE.left);
    ctx.beginPath();
    ctx.ellipse(cx - 13 * wide, torsoY + 10, 5, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(shield, FACE.top);
    ctx.beginPath();
    ctx.ellipse(cx - 13 * wide, torsoY + 8, 3, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function isoPlayerSprite(appearance, look, frame, facing) {
  const colours = appearanceColours(appearance);
  const key = `pc:${JSON.stringify(appearance)}:${JSON.stringify(look || {})}:${frame}:${facing}`;
  return cached(key, CHAR_W, CHAR_H, (ctx, w, h) => {
    drawIsoCharacter(ctx, w, h, {
      shirt: look && look.body ? metalOf(look.body) : colours.shirt,
      legs: look && look.legs ? metalOf(look.legs) : colours.legs,
      skin: colours.skin,
      hair: colours.hair,
      hairStyle: colours.hairStyle
    }, {
      facing,
      frame,
      build: colours.build,
      helm: look && look.head ? metalOf(look.head) : null,
      weapon: look && look.weapon ? metalOf(look.weapon) : null,
      shield: look && look.shield ? metalOf(look.shield) : null,
      cape: look && look.cape ? metalOf(look.cape) : null
    });
  });
}

const NPC_PALETTES = {
  mayor: { shirt: '#7a4a8a', legs: '#2c3e50', skin: '#e8b98d', hair: '#d9d9d9', hairStyle: 'short' },
  shopkeeper: { shirt: '#d68910', legs: '#6e4b3a', skin: '#f3d2b3', hair: '#5b3a1e', hairStyle: 'bun' },
  banker: { shirt: '#2e4a7a', legs: '#22303f', skin: '#c98d5f', hair: '#2b2118', hairStyle: 'short' },
  woodsman: { shirt: '#27ae60', legs: '#5d4037', skin: '#e8b98d', hair: '#a45a2a', hairStyle: 'ponytail' },
  miner: { shirt: '#8a6a3a', legs: '#4a4a4a', skin: '#a06a3f', hair: '#2b2118', hairStyle: 'short' },
  fisher: { shirt: '#16a085', legs: '#34495e', skin: '#f3d2b3', hair: '#8d8d8d', hairStyle: 'short' },
  guard: { shirt: '#95a5a6', legs: '#2c3e50', skin: '#c98d5f', hair: '#2b2118', hairStyle: 'bald' },
  tutor: { shirt: '#5dade2', legs: '#4a3f6b', skin: '#7a4a2a', hair: '#2b2118', hairStyle: 'curly' },
  foreman: { shirt: '#a8641f', legs: '#3c3226', skin: '#c98d5f', hair: '#8d8d8d', hairStyle: 'short' }
};

/** Four-legged creatures, built from an iso body ellipse and a raised head. */
function drawIsoBeast(ctx, w, h, { body, shade: dark, scale = 1, tail = false, tusks = false, frame = 0 }) {
  const cx = w / 2;
  const groundY = h - 6;
  const bodyW = 20 * scale;
  const bodyH = 11 * scale;
  const lift = frame % 2 === 0 ? 0 : 1;

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, groundY, bodyW * 0.85, bodyH * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs.
  ctx.fillStyle = dark;
  ctx.fillRect(cx - bodyW * 0.6, groundY - 9 + lift, 3.5, 9);
  ctx.fillRect(cx - bodyW * 0.1, groundY - 9, 3.5, 9 - lift);
  ctx.fillRect(cx + bodyW * 0.3, groundY - 9 + lift, 3.5, 9);

  // Body.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(cx, groundY - 13, bodyW, bodyH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(body, FACE.top);
  ctx.beginPath();
  ctx.ellipse(cx - bodyW * 0.2, groundY - 16, bodyW * 0.6, bodyH * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head, forward and to the right (towards the camera).
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(cx + bodyW * 0.75, groundY - 18, 8 * scale, 6.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(cx + bodyW * 0.55, groundY - 23);
  ctx.lineTo(cx + bodyW * 0.7, groundY - 30);
  ctx.lineTo(cx + bodyW * 0.85, groundY - 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(cx + bodyW * 0.95, groundY - 20, 2, 2);

  if (tusks) {
    ctx.fillStyle = '#f0e6d2';
    ctx.fillRect(cx + bodyW * 1.05, groundY - 15, 4, 2);
  }
  if (tail) {
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - bodyW * 0.9, groundY - 14);
    ctx.quadraticCurveTo(cx - bodyW * 1.5, groundY - 20, cx - bodyW * 1.3, groundY - 8);
    ctx.stroke();
  }
}

const CREATURES = {
  rat: (ctx, w, h, frame) => drawIsoBeast(ctx, w, h, { body: '#8a7f72', shade: '#6b6157', scale: 0.75, tail: true, frame }),
  wolf: (ctx, w, h, frame) => drawIsoBeast(ctx, w, h, { body: '#8e99a4', shade: '#5f6a75', scale: 1.05, tail: true, frame }),
  boar: (ctx, w, h, frame) => drawIsoBeast(ctx, w, h, { body: '#7a5a44', shade: '#5b4230', scale: 1, tusks: true, frame }),
  bat: (ctx, w, h, frame) => drawIsoBat(ctx, w, h, '#6b5a72', '#3d3242', frame),
  crawler: (ctx, w, h, frame) => drawIsoBeast(ctx, w, h, { body: '#6f5a45', shade: '#4a3a2c', scale: 0.72, tail: true, frame }),
  sprite: (ctx, w, h, frame) => drawIsoGlow(ctx, w, h, '#cbb9a0', '#8a7a63', frame),
  lurker: (ctx, w, h, frame) => drawIsoBeast(ctx, w, h, { body: '#3c4043', shade: '#202124', scale: 0.92, tail: true, frame }),
  hound: (ctx, w, h, frame) => drawIsoBeast(ctx, w, h, { body: '#7a8590', shade: '#4a5560', scale: 1.05, tail: true, frame }),
  deep_golem: (ctx, w, h) => drawIsoStoneFigure(ctx, w, h, '#4a4f5c', '#7d9adf', 1.05),
  beetle: (ctx, w, h, frame) => drawIsoBeetle(ctx, w, h, frame),
  wisp: (ctx, w, h, frame) => drawIsoGlow(ctx, w, h, '#ff8a3d', '#c0562a', frame),
  guardian_statue: (ctx, w, h) => drawIsoStoneFigure(ctx, w, h, '#6b5a4a', '#ff8a3d', 1.18),
  cinderheart: (ctx, w, h, frame) => drawIsoCinderheart(ctx, w, h, frame),
  golem: (ctx, w, h) => drawIsoStoneFigure(ctx, w, h, '#6d675e', '#b87333', 1)
};

/**
 * A blocky figure standing on the tile: two shaded body halves, a lit cap and
 * a pair of arms. Golems, deep golems and the chamber statues share it, which
 * is what makes them read as a family.
 */
function drawIsoStoneFigure(ctx, w, h, stone, eye, scale = 1) {
  const cx = w / 2;
  const groundY = h - 6;
  const body = Math.round(34 * scale);
  const half = Math.round(14 * scale);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, groundY, 18 * scale, 8 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(stone, FACE.left);
  ctx.fillRect(cx - half, groundY - body, half, body);
  ctx.fillStyle = shade(stone, FACE.right);
  ctx.fillRect(cx, groundY - body, half, body);
  ctx.fillStyle = shade(stone, FACE.top);
  ctx.beginPath();
  ctx.moveTo(cx, groundY - body - 6);
  ctx.lineTo(cx + half, groundY - body);
  ctx.lineTo(cx, groundY - body + 6);
  ctx.lineTo(cx - half, groundY - body);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(stone, 0.72);
  ctx.fillRect(cx - half - 8, groundY - body * 0.88, 7, body * 0.6);
  ctx.fillRect(cx + half + 1, groundY - body * 0.88, 7, body * 0.6);
  ctx.fillStyle = eye;
  ctx.fillRect(cx - 7, groundY - body + 2, 4, 3);
  ctx.fillRect(cx + 3, groundY - body + 2, 4, 3);
}

function drawIsoBat(ctx, w, h, body, dark, frame) {
  const cx = w / 2;
  const cy = h - 30 - (frame % 2) * 3;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, h - 6, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  const spread = frame % 2 ? 20 : 15;
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.quadraticCurveTo(cx - spread, cy - 9, cx - spread - 4, cy + 5);
  ctx.quadraticCurveTo(cx - spread * 0.5, cy + 3, cx, cy + 5);
  ctx.moveTo(cx, cy);
  ctx.quadraticCurveTo(cx + spread, cy - 9, cx + spread + 4, cy + 5);
  ctx.quadraticCurveTo(cx + spread * 0.5, cy + 3, cx, cy + 5);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 1, 6, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(cx - 3, cy - 2, 2, 2);
  ctx.fillRect(cx + 1, cy - 2, 2, 2);
}

function drawIsoGlow(ctx, w, h, core, halo, frame) {
  const cx = w / 2;
  const cy = h - 26 - (frame % 2) * 2;
  const r = 17 + (frame % 2);
  const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
  grad.addColorStop(0, core);
  grad.addColorStop(0.45, halo);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff6dc';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawIsoBeetle(ctx, w, h, frame) {
  const cx = w / 2;
  const groundY = h - 8;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, groundY + 2, 15, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a2c44';
  ctx.lineWidth = 2;
  for (let i = -1; i <= 1; i += 1) {
    const lift = (frame % 2 ? i : -i) * 2;
    ctx.beginPath();
    ctx.moveTo(cx - 9, groundY - 8 + i * 3);
    ctx.lineTo(cx - 18, groundY - 1 + i * 2 + lift);
    ctx.moveTo(cx + 9, groundY - 8 + i * 3);
    ctx.lineTo(cx + 18, groundY - 1 + i * 2 - lift);
    ctx.stroke();
  }
  ctx.fillStyle = shade('#5b4470', FACE.left);
  ctx.beginPath();
  ctx.ellipse(cx, groundY - 9, 13, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(201,160,255,0.8)';
  ctx.beginPath();
  ctx.moveTo(cx, groundY - 19);
  ctx.lineTo(cx + 7, groundY - 10);
  ctx.lineTo(cx, groundY - 3);
  ctx.lineTo(cx - 7, groundY - 10);
  ctx.closePath();
  ctx.fill();
}

/**
 * Cinderheart. Bigger than anything else in the world, and drawn to look warm
 * rather than dangerous: it is a creature having a bad dream, not a demon.
 */
function drawIsoCinderheart(ctx, w, h, frame) {
  const cx = w / 2;
  const groundY = h - 4;
  const breathe = (frame % 2) * 2;

  ctx.fillStyle = 'rgba(255,140,60,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, groundY - 4, 26, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = shade('#4a2a22', FACE.left);
  ctx.beginPath();
  ctx.ellipse(cx, groundY - 20 - breathe, 22, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade('#5c3428', FACE.top);
  ctx.beginPath();
  ctx.ellipse(cx, groundY - 26 - breathe, 18, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Coals showing through the cracks in its back.
  ctx.fillStyle = '#e2703a';
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    ctx.fillRect(cx + Math.cos(a) * 13 - 2, groundY - 26 - breathe + Math.sin(a) * 7 - 1, 4, 3);
  }
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.ellipse(cx, groundY - 24 - breathe, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head, and two sleepy eyes.
  ctx.fillStyle = shade('#4a2a22', FACE.right);
  ctx.beginPath();
  ctx.ellipse(cx + 12, groundY - 34 - breathe, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx + 9, groundY - 36 - breathe, 3, 0.25, Math.PI - 0.25);
  ctx.arc(cx + 16, groundY - 36 - breathe, 3, 0.25, Math.PI - 0.25);
  ctx.stroke();
}

export function isoNpcSprite(art, frame, facing) {
  const key = `npc:${art}:${frame}:${facing}`;
  return cached(key, CHAR_W, CHAR_H, (ctx, w, h) => {
    if (CREATURES[art]) {
      CREATURES[art](ctx, w, h, frame);
      return;
    }
    if (art === 'goblin' || art === 'imp') {
      const palette = art === 'goblin'
        ? { shirt: '#6b8f3a', legs: '#4a5c2a', skin: '#7fa050', hair: '#3f5220', hairStyle: 'bald' }
        : { shirt: '#8e44ad', legs: '#5b2c6f', skin: '#c0679a', hair: '#2b1030', hairStyle: 'bald' };
      ctx.save();
      ctx.translate(0, h * 0.12);
      ctx.scale(1, 0.86);
      drawIsoCharacter(ctx, w, h, palette, { facing, frame });
      ctx.restore();
      return;
    }
    const palette = NPC_PALETTES[art] || NPC_PALETTES.tutor;
    drawIsoCharacter(ctx, w, h, palette, {
      facing,
      frame,
      helm: art === 'guard' ? '#cfd8dc' : null,
      weapon: art === 'guard' ? '#cfd8dc' : null
    });
  });
}

export const ISO_CHAR_W = CHAR_W;
export const ISO_CHAR_H = CHAR_H;

export function clearIsoCache() {
  cache.clear();
}
