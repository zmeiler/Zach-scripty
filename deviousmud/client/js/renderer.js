/**
 * Canvas world renderer.
 *
 * The simulation runs at 600ms per tick; the renderer runs at whatever the
 * display can manage and smooths every position towards its server value, so
 * movement looks continuous without the client ever guessing where an entity
 * will be.
 */

import { TILE_SIZE, TILE } from '../../shared/constants.js';
import { OBJECT_TYPES } from '../../shared/world.js';
import { state } from './state.js';
import { itemSprite, noise2, npcSprite, objectSprite, playerSprite, tileSprite } from './sprites.js';

const SPLAT_LIFETIME = 1200;
const BUBBLE_LIFETIME = 4800;

export class Renderer {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.camX = state.self.x;
    this.camY = state.self.y;
    this.hoverTile = null;
    this.lastFrame = performance.now();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.bubbles = new Map();
    this.resize();
  }

  get tileSize() {
    const base = TILE_SIZE * (state.settings.zoom || 1);
    // Phones get a slightly larger tile so touch targets stay comfortable.
    const scale = this.cssWidth < 620 ? 1.15 : 1;
    return Math.round(base * scale);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.cssWidth = Math.max(320, Math.round(rect.width));
    this.cssHeight = Math.max(240, Math.round(rect.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.cssWidth * this.dpr);
    this.canvas.height = Math.round(this.cssHeight * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Screen pixel -> world tile. */
  screenToTile(px, py) {
    const size = this.tileSize;
    const originX = this.cssWidth / 2 - this.camX * size - size / 2;
    const originY = this.cssHeight / 2 - this.camY * size - size / 2;
    return {
      x: Math.floor((px - originX) / size),
      y: Math.floor((py - originY) / size)
    };
  }

  tileToScreen(tx, ty) {
    const size = this.tileSize;
    return {
      x: this.cssWidth / 2 + (tx - this.camX) * size - size / 2,
      y: this.cssHeight / 2 + (ty - this.camY) * size - size / 2
    };
  }

  /** What did the player click on? Entities beat objects, objects beat ground. */
  pick(px, py) {
    const tile = this.screenToTile(px, py);
    const size = this.tileSize;

    let best = null;
    let bestScore = -Infinity;
    const consider = (candidate, ex, ey, priority) => {
      const screen = this.tileToScreen(ex, ey);
      const withinX = px >= screen.x - size * 0.2 && px <= screen.x + size * 1.2;
      const withinY = py >= screen.y - size * 0.8 && py <= screen.y + size * 1.1;
      if (!withinX || !withinY) return;
      const score = priority + ey * 0.001;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    };

    for (const npc of state.npcs.values()) {
      consider({ kind: 'npc', id: npc.id, entity: npc }, npc.renderX ?? npc.x, npc.renderY ?? npc.y, 30);
    }
    for (const player of state.players.values()) {
      if (player.id === state.playerId) continue;
      consider({ kind: 'player', id: player.id, entity: player }, player.renderX ?? player.x, player.renderY ?? player.y, 25);
    }
    for (const item of state.groundItems.values()) {
      consider({ kind: 'ground_item', id: item.id, entity: item }, item.x, item.y, 20);
    }
    for (const obj of state.dynamicObjects.values()) {
      consider({ kind: 'object', id: obj.id, entity: obj, objectType: obj.type }, obj.x, obj.y, 15);
    }
    const worldObject = this.world.objectAt.get(`${tile.x},${tile.y}`);
    if (worldObject) {
      consider({ kind: 'object', id: worldObject.id, entity: worldObject, objectType: worldObject.type }, worldObject.x, worldObject.y, 10);
    }
    // Trees are two tiles tall: also check the tile below the click.
    const below = this.world.objectAt.get(`${tile.x},${tile.y + 1}`);
    if (below && OBJECT_TYPES[below.type]?.height === 2) {
      consider({ kind: 'object', id: below.id, entity: below, objectType: below.type }, below.x, below.y, 9);
    }

    if (best) return best;
    return { kind: 'tile', x: tile.x, y: tile.y };
  }

  setHover(px, py) {
    this.hoverTile = this.screenToTile(px, py);
  }

  smooth(entity, dt) {
    const speed = Math.min(1, dt / 110);
    if (entity.renderX === undefined) {
      entity.renderX = entity.x;
      entity.renderY = entity.y;
      return;
    }
    // Snap when teleported (respawn) rather than sliding across the map.
    if (Math.abs(entity.renderX - entity.x) > 6 || Math.abs(entity.renderY - entity.y) > 6) {
      entity.renderX = entity.x;
      entity.renderY = entity.y;
      return;
    }
    entity.renderX += (entity.x - entity.renderX) * speed;
    entity.renderY += (entity.y - entity.renderY) * speed;
  }

  render(now) {
    const dt = Math.min(64, now - this.lastFrame);
    this.lastFrame = now;
    const ctx = this.ctx;
    const size = this.tileSize;

    // Camera follows the player with a gentle lag.
    const camSpeed = Math.min(1, dt / 130);
    this.camX += (state.self.x - this.camX) * camSpeed;
    this.camY += (state.self.y - this.camY) * camSpeed;

    ctx.fillStyle = '#0c1116';
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    const originX = this.cssWidth / 2 - this.camX * size - size / 2;
    const originY = this.cssHeight / 2 - this.camY * size - size / 2;
    const minX = Math.max(0, Math.floor(-originX / size) - 1);
    const minY = Math.max(0, Math.floor(-originY / size) - 1);
    const maxX = Math.min(this.world.width - 1, Math.ceil((this.cssWidth - originX) / size));
    const maxY = Math.min(this.world.height - 1, Math.ceil((this.cssHeight - originY) / size));

    // ---- terrain
    for (let ty = minY; ty <= maxY; ty += 1) {
      for (let tx = minX; tx <= maxX; tx += 1) {
        const tile = this.world.tiles[ty * this.world.width + tx];
        const variant = Math.floor(noise2(tx, ty, tile) * 4);
        const sprite = tileSprite(tile, variant, 32);
        ctx.drawImage(sprite, Math.round(originX + tx * size), Math.round(originY + ty * size), size, size);
        if (tile === TILE.WATER) {
          const shimmer = 0.08 + 0.05 * Math.sin(now / 700 + tx * 0.6 + ty * 0.4);
          ctx.fillStyle = `rgba(255,255,255,${shimmer.toFixed(3)})`;
          ctx.fillRect(Math.round(originX + tx * size), Math.round(originY + ty * size), size, size);
        }
      }
    }

    // ---- everything that needs y-sorting
    const drawables = [];

    for (let ty = minY - 1; ty <= maxY + 1; ty += 1) {
      for (let tx = minX; tx <= maxX; tx += 1) {
        const obj = this.world.objectAt.get(`${tx},${ty}`);
        if (!obj || obj.dynamic) continue;
        const def = OBJECT_TYPES[obj.type];
        if (!def) continue;
        const depleted = state.objectStates.get(obj.id)?.depleted;
        let art = def.art;
        if (depleted) {
          if (art === 'tree' || art === 'oak' || art === 'willow') art = 'stump';
          else if (art.startsWith('rock_')) art = 'rock_spent';
          else continue;
        }
        drawables.push({ sort: ty, draw: () => this.drawProp(art, tx, ty, originX, originY, size, def) });
      }
    }

    for (const obj of state.dynamicObjects.values()) {
      const def = OBJECT_TYPES[obj.type];
      if (!def) continue;
      drawables.push({ sort: obj.y, draw: () => this.drawProp(def.art, obj.x, obj.y, originX, originY, size, def) });
    }

    for (const item of state.groundItems.values()) {
      drawables.push({
        sort: item.y - 0.4,
        draw: () => {
          const sprite = itemSprite(item.itemId, 32);
          ctx.drawImage(sprite, Math.round(originX + item.x * size + size * 0.2), Math.round(originY + item.y * size + size * 0.3), size * 0.6, size * 0.6);
        }
      });
    }

    for (const npc of state.npcs.values()) {
      this.smooth(npc, dt);
      drawables.push({ sort: npc.renderY, draw: () => this.drawNpc(npc, originX, originY, size, now) });
    }

    for (const player of state.players.values()) {
      this.smooth(player, dt);
      drawables.push({ sort: player.renderY, draw: () => this.drawPlayer(player, originX, originY, size, now) });
    }

    drawables.sort((a, b) => a.sort - b.sort);
    for (const item of drawables) item.draw();

    this.drawHover(originX, originY, size);
    this.drawSplats(originX, originY, size, now);
    this.drawWeatherTint(now);
  }

  drawProp(art, tx, ty, originX, originY, size, def) {
    const sprite = objectSprite(art, 32);
    const tall = def.height === 2 || sprite.height > sprite.width;
    const drawHeight = tall ? size * 2 : size;
    const x = Math.round(originX + tx * size);
    const y = Math.round(originY + ty * size - (tall ? size : 0));
    this.ctx.drawImage(sprite, x, y, size, drawHeight);
  }

  drawNpc(npc, originX, originY, size, now) {
    const ctx = this.ctx;
    const walking = Math.abs(npc.renderX - npc.x) > 0.05 || Math.abs(npc.renderY - npc.y) > 0.05;
    const frame = walking ? Math.floor(now / 180) % 2 : npc.anim === 'attack' ? Math.floor(now / 120) % 2 : 0;
    const sprite = npcSprite(npc.art, frame, 32);
    const width = size * 1.15;
    const px = Math.round(originX + npc.renderX * size - (width - size) / 2);
    const py = Math.round(originY + npc.renderY * size - size * 0.65);
    this.shadow(originX + npc.renderX * size + size / 2, originY + npc.renderY * size + size * 0.9, size * 0.32);
    ctx.drawImage(sprite, px, py, width, width * 1.5);

    if (!npc.friendly && npc.hp < npc.maxHp) {
      this.healthBar(px, py - 6, size, npc.hp / npc.maxHp);
    }
    // Townsfolk are always named; creatures only when they are close enough to
    // matter, so a busy field of monsters stays readable.
    const distance = Math.max(Math.abs(npc.x - state.self.x), Math.abs(npc.y - state.self.y));
    const named = npc.friendly || distance <= 6 || state.self.targetId === npc.id;
    if (state.settings.showNames && named) {
      this.label(npc.name + (npc.level ? ` (${npc.level})` : ''), px + size / 2, py - 10, npc.friendly ? '#bfe6ff' : '#ffd7a8');
    }
  }

  drawPlayer(player, originX, originY, size, now) {
    const ctx = this.ctx;
    const isSelf = player.id === state.playerId;
    const walking = Math.abs(player.renderX - player.x) > 0.05 || Math.abs(player.renderY - player.y) > 0.05;
    const frame = walking ? Math.floor(now / 170) % 2 : 0;
    const sprite = playerSprite(player.appearance || state.appearance, player.look, frame, 32);
    const width = size * 1.15;
    const px = Math.round(originX + player.renderX * size - (width - size) / 2);
    const py = Math.round(originY + player.renderY * size - size * 0.65);

    this.shadow(originX + player.renderX * size + size / 2, originY + player.renderY * size + size * 0.9, size * 0.3);
    ctx.globalAlpha = player.dead ? 0.4 : 1;
    ctx.drawImage(sprite, px, py, width, width * 1.5);
    ctx.globalAlpha = 1;

    if (player.hp < player.maxHp) this.healthBar(px, py - 6, size, player.hp / player.maxHp);
    if (state.settings.showNames || isSelf) {
      this.label(player.name || 'Adventurer', px + size / 2, py - 10, isSelf ? '#f2c14e' : '#e8eef5');
    }
    if (player.chat) this.bubble(player.chat, px + size / 2, py - 26);
  }

  shadow(cx, cy, radius) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  healthBar(x, y, width, fraction) {
    const ctx = this.ctx;
    const w = width * 0.8;
    const h = 4;
    const bx = x + (width - w) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(bx - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = fraction > 0.5 ? '#58c26f' : fraction > 0.25 ? '#f2c14e' : '#e05e5e';
    ctx.fillRect(bx, y, Math.max(0, w * fraction), h);
  }

  label(text, cx, cy, colour) {
    const ctx = this.ctx;
    ctx.font = '600 12px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(text, cx, cy);
    ctx.fillStyle = colour;
    ctx.fillText(text, cx, cy);
    ctx.textAlign = 'left';
  }

  bubble(text, cx, cy) {
    const ctx = this.ctx;
    ctx.font = '12px "Trebuchet MS", sans-serif';
    const width = Math.min(220, ctx.measureText(text).width + 14);
    ctx.fillStyle = 'rgba(18,25,33,0.92)';
    ctx.strokeStyle = '#f2c14e';
    ctx.lineWidth = 1;
    const x = cx - width / 2;
    const y = cy - 18;
    roundRect(ctx, x, y, width, 20, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e8eef5';
    ctx.textAlign = 'center';
    ctx.fillText(text.length > 34 ? `${text.slice(0, 33)}…` : text, cx, y + 14);
    ctx.textAlign = 'left';
  }

  drawHover(originX, originY, size) {
    if (!this.hoverTile) return;
    const { x, y } = this.hoverTile;
    if (x < 0 || y < 0 || x >= this.world.width || y >= this.world.height) return;
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(242,193,78,0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(originX + x * size) + 1, Math.round(originY + y * size) + 1, size - 2, size - 2);
  }

  drawSplats(originX, originY, size, now) {
    const ctx = this.ctx;
    state.splats = state.splats.filter((splat) => now - splat.born < SPLAT_LIFETIME);
    for (const splat of state.splats) {
      const entity = state.npcs.get(splat.id) || state.players.get(splat.id) || (splat.id === state.playerId ? { renderX: state.self.x, renderY: state.self.y } : null);
      if (!entity) continue;
      const progress = (now - splat.born) / SPLAT_LIFETIME;
      const px = originX + (entity.renderX ?? entity.x) * size + size / 2;
      const py = originY + (entity.renderY ?? entity.y) * size - progress * 26;
      ctx.globalAlpha = 1 - progress;
      const hit = splat.kind === 'hit' && splat.damage > 0;
      ctx.fillStyle = hit ? '#c0392b' : '#4a5c6b';
      ctx.beginPath();
      ctx.arc(px, py, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '700 12px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(hit ? String(splat.damage) : '0', px, py + 4);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }

  /** A gentle vignette; also flashes red briefly when the player is hurt. */
  drawWeatherTint(now) {
    const ctx = this.ctx;
    const gradient = ctx.createRadialGradient(
      this.cssWidth / 2, this.cssHeight / 2, Math.min(this.cssWidth, this.cssHeight) * 0.35,
      this.cssWidth / 2, this.cssHeight / 2, Math.max(this.cssWidth, this.cssHeight) * 0.75
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    if (state.self.dead) {
      ctx.fillStyle = 'rgba(20,0,0,0.45)';
      ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
      this.label('You were knocked out. Waking up…', this.cssWidth / 2, this.cssHeight / 2, '#ffd7a8');
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Minimap: the terrain is rasterised once into an offscreen canvas, then only
 * the viewport box and entity dots are redrawn each frame.
 */
export class Minimap {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.scale = 2;
    this.base = this.rasterise();
  }

  rasterise() {
    const off = document.createElement('canvas');
    off.width = this.world.width * this.scale;
    off.height = this.world.height * this.scale;
    const ctx = off.getContext('2d');
    const colours = {
      [TILE.GRASS]: '#4a7c3f',
      [TILE.DARKGRASS]: '#3a6634',
      [TILE.FLOWERS]: '#578a49',
      [TILE.PATH]: '#a98f6a',
      [TILE.GRAVEL]: '#8a8579',
      [TILE.WATER]: '#2f6f9e',
      [TILE.SAND]: '#d9c48f',
      [TILE.STONE]: '#8f9aa6',
      [TILE.WALL]: '#6b625a',
      [TILE.PLANK]: '#8a6136',
      [TILE.BRIDGE]: '#9a6f3f',
      [TILE.CAVE]: '#5b5349',
      [TILE.ROCKFACE]: '#3f3a34'
    };
    for (let y = 0; y < this.world.height; y += 1) {
      for (let x = 0; x < this.world.width; x += 1) {
        ctx.fillStyle = colours[this.world.tiles[y * this.world.width + x]] || '#4a7c3f';
        ctx.fillRect(x * this.scale, y * this.scale, this.scale, this.scale);
      }
    }
    ctx.fillStyle = '#20401f';
    for (const obj of this.world.objects) {
      const def = OBJECT_TYPES[obj.type];
      if (!def) continue;
      if (def.art === 'tree' || def.art === 'oak' || def.art === 'willow') {
        ctx.fillRect(obj.x * this.scale, obj.y * this.scale, this.scale, this.scale);
      }
    }
    return off;
  }

  render() {
    const ctx = this.ctx;
    const size = this.canvas.width;
    const tilesVisible = 46;
    const src = tilesVisible * this.scale;
    const cx = state.self.x * this.scale;
    const cy = state.self.y * this.scale;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0c1116';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(this.base, cx - src / 2, cy - src / 2, src, src, 0, 0, size, size);

    const toScreen = (x, y) => ({
      x: ((x - state.self.x) / tilesVisible + 0.5) * size,
      y: ((y - state.self.y) / tilesVisible + 0.5) * size
    });

    for (const npc of state.npcs.values()) {
      const p = toScreen(npc.x, npc.y);
      ctx.fillStyle = npc.friendly ? '#5fd0f0' : '#e05e5e';
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    for (const item of state.groundItems.values()) {
      const p = toScreen(item.x, item.y);
      ctx.fillStyle = '#f2c14e';
      ctx.fillRect(p.x - 1, p.y - 1, 3, 3);
    }
    for (const player of state.players.values()) {
      if (player.id === state.playerId) continue;
      const p = toScreen(player.x, player.y);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  }

  /** Minimap click -> world tile, so players can walk by tapping the map. */
  toWorld(px, py) {
    const size = this.canvas.width;
    const tilesVisible = 46;
    return {
      x: Math.round(state.self.x + (px / size - 0.5) * tilesVisible),
      y: Math.round(state.self.y + (py / size - 0.5) * tilesVisible)
    };
  }
}
