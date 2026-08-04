/**
 * Canvas world renderer.
 *
 * Draws the tile grid in one of two projections — isometric (the default) or
 * straight top-down — from the same simulation state. The engine only ever
 * deals in tile coordinates, so the projection is purely a view concern:
 * `project` / `unproject` and the art set are the only things that differ.
 *
 * The simulation runs at 600ms per tick; the renderer runs as fast as the
 * display allows and eases every entity towards its last server position, so
 * movement looks continuous without the client ever predicting the future.
 */

import { TILE_SIZE, TILE, BLOCKED_TILES } from '../../shared/constants.js';
import { OBJECT_TYPES, planeAt, planeLights } from '../../shared/world.js';
import { state } from './state.js';
import { itemSprite, noise2, npcSprite, objectSprite, playerSprite, tileSprite } from './sprites.js';
import { ISO_TILE_H, ISO_TILE_W, isoProject, isoUnproject } from './iso.js';
import { isoCubeSprite, isoFloorSprite, isoNpcSprite, isoPlayerSprite, isoPropSprite, ISO_CHAR_H, ISO_CHAR_W } from './isoSprites.js';

const SPLAT_LIFETIME = 1200;

/** Which cube art stands in for each solid tile. */
const CUBE_FOR_TILE = {
  [TILE.ROCKFACE]: 'rockface',
  [TILE.WALL]: 'wall',
  [TILE.MINE_WALL]: 'mine_wall',
  [TILE.CRYSTAL]: 'crystal'
};

/** Maps a facing to the pair (sprite view, mirrored) used by the iso art. */
function isoFacing(dir) {
  switch (dir) {
    case 'east': return { view: 'front', flip: false };
    case 'south': return { view: 'front', flip: true };
    case 'north': return { view: 'back', flip: false };
    case 'west': return { view: 'back', flip: true };
    default: return { view: 'front', flip: true };
  }
}

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
    this.drawables = [];
    this.resize();
  }

  get isometric() {
    return (state.settings.projection || 'iso') === 'iso';
  }

  /**
   * The plane the camera is on. Everything drawn - floors, solids, props - is
   * read from here rather than from the world root, so climbing a ladder swaps
   * the whole scene without the renderer knowing anything about ladders.
   */
  get level() {
    return planeAt(this.world, state.self.plane || 0);
  }

  /** Zoom, with a nudge upwards on small screens so touch targets stay usable. */
  get scale() {
    const zoom = state.settings.zoom || 1;
    return zoom * (this.cssWidth < 620 ? 1.12 : 1);
  }

  /** Square-tile size, used by the top-down projection and the UI. */
  get tileSize() {
    return Math.round(TILE_SIZE * this.scale);
  }

  get halfW() {
    return (ISO_TILE_W / 2) * this.scale;
  }

  get halfH() {
    return (ISO_TILE_H / 2) * this.scale;
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

  // ------------------------------------------------------------ projection

  /** Tile coordinate -> centre of that tile on screen. */
  project(tx, ty) {
    if (this.isometric) {
      const p = isoProject(tx - this.camX, ty - this.camY, this.halfW, this.halfH);
      return { x: this.cssWidth / 2 + p.x, y: this.cssHeight / 2 + p.y };
    }
    const size = this.tileSize;
    return {
      x: this.cssWidth / 2 + (tx - this.camX) * size,
      y: this.cssHeight / 2 + (ty - this.camY) * size
    };
  }

  /** Screen pixel -> tile coordinate (floored). */
  unproject(px, py) {
    if (this.isometric) {
      const t = isoUnproject(px - this.cssWidth / 2, py - this.cssHeight / 2, this.halfW, this.halfH);
      return { x: Math.floor(t.x + this.camX + 0.5), y: Math.floor(t.y + this.camY + 0.5) };
    }
    const size = this.tileSize;
    return {
      x: Math.floor((px - this.cssWidth / 2) / size + this.camX + 0.5),
      y: Math.floor((py - this.cssHeight / 2) / size + this.camY + 0.5)
    };
  }

  /** Kept for callers that want the top-left of a tile's bounding box. */
  tileToScreen(tx, ty) {
    const c = this.project(tx, ty);
    return this.isometric
      ? { x: c.x - this.halfW, y: c.y - this.halfH }
      : { x: c.x - this.tileSize / 2, y: c.y - this.tileSize / 2 };
  }

  screenToTile(px, py) {
    return this.unproject(px, py);
  }

  setHover(px, py) {
    this.hoverTile = this.unproject(px, py);
  }

  /** Tiles that can appear on screen, with a margin for tall props. */
  visibleBounds() {
    if (!this.isometric) {
      const size = this.tileSize;
      const halfCols = Math.ceil(this.cssWidth / size / 2) + 2;
      const halfRows = Math.ceil(this.cssHeight / size / 2) + 3;
      return {
        minX: Math.max(0, Math.floor(this.camX) - halfCols),
        maxX: Math.min(this.world.width - 1, Math.ceil(this.camX) + halfCols),
        minY: Math.max(0, Math.floor(this.camY) - halfRows),
        maxY: Math.min(this.world.height - 1, Math.ceil(this.camY) + halfRows)
      };
    }
    // Unproject the four screen corners; the diamond they span is the view.
    const margin = 140;
    const corners = [
      this.unproject(-margin, -margin),
      this.unproject(this.cssWidth + margin, -margin),
      this.unproject(-margin, this.cssHeight + margin),
      this.unproject(this.cssWidth + margin, this.cssHeight + margin)
    ];
    return {
      minX: Math.max(0, Math.min(...corners.map((c) => c.x)) - 1),
      maxX: Math.min(this.world.width - 1, Math.max(...corners.map((c) => c.x)) + 1),
      minY: Math.max(0, Math.min(...corners.map((c) => c.y)) - 1),
      maxY: Math.min(this.world.height - 1, Math.max(...corners.map((c) => c.y)) + 1)
    };
  }

  // ---------------------------------------------------------------- frame

  smooth(entity, dt) {
    const speed = Math.min(1, dt / 110);
    if (entity.renderX === undefined) {
      entity.renderX = entity.x;
      entity.renderY = entity.y;
      return;
    }
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

    const camSpeed = Math.min(1, dt / 130);
    this.camX += (state.self.x - this.camX) * camSpeed;
    this.camY += (state.self.y - this.camY) * camSpeed;

    // Underground planes clear to their own colour, so a cave feels like a
    // cave before a single tile has been drawn.
    ctx.fillStyle = this.level.ambient || (this.isometric ? '#0a0f14' : '#0c1116');
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    const bounds = this.visibleBounds();
    this.drawFloors(bounds, now);

    // Everything with height, sorted back to front.
    const drawables = [];
    this.collectProps(bounds, drawables, now);
    this.collectEntities(drawables, dt, now);
    drawables.sort((a, b) => a.depth - b.depth || a.tie - b.tie);

    const selfDepth = this.isometric ? state.self.x + state.self.y : state.self.y;
    const selfPoint = this.project(state.self.x, state.self.y);

    for (const item of drawables) {
      // Fade tall things standing between the camera and the player.
      const hides =
        item.tall &&
        item.depth > selfDepth &&
        selfPoint.x > item.bounds.x - 4 &&
        selfPoint.x < item.bounds.x + item.bounds.w + 4 &&
        selfPoint.y > item.bounds.y &&
        selfPoint.y < item.bounds.y + item.bounds.h + 8;
      if (hides) ctx.globalAlpha = 0.42;
      item.draw();
      ctx.globalAlpha = 1;
    }

    this.drawables = drawables;
    // Darkness sits above the world but below the interface: you cannot see
    // into the dark, but you can always read your own health bar.
    this.drawDarkness(now);
    this.drawHover();
    this.drawOverlays(drawables, now);
    this.drawSplats(now);
    this.drawVignette();
  }

  /**
   * Underground, the plane is covered by a black sheet and light sources punch
   * holes in it.
   *
   * The sheet is composited on its own canvas because `destination-out` has to
   * cut through the *shadow*, not through the world already drawn beneath it.
   * One offscreen canvas is reused for the life of the page.
   */
  drawDarkness(now) {
    const dark = this.level.dark || 0;
    if (dark <= 0) return;

    if (!this.shadow || this.shadow.width !== Math.ceil(this.cssWidth) || this.shadow.height !== Math.ceil(this.cssHeight)) {
      this.shadow = document.createElement('canvas');
      this.shadow.width = Math.ceil(this.cssWidth);
      this.shadow.height = Math.ceil(this.cssHeight);
      this.shadowCtx = this.shadow.getContext('2d');
    }
    const sctx = this.shadowCtx;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalCompositeOperation = 'source-over';
    sctx.clearRect(0, 0, this.shadow.width, this.shadow.height);
    sctx.fillStyle = this.level.ambient || '#05070b';
    sctx.globalAlpha = dark;
    sctx.fillRect(0, 0, this.shadow.width, this.shadow.height);
    sctx.globalAlpha = 1;

    sctx.globalCompositeOperation = 'destination-out';
    for (const light of this.lights(now)) {
      const p = this.project(light.x, light.y);
      // Tiles are wider than they are tall in the isometric view, so a circular
      // radius in tiles has to be drawn as an ellipse in pixels.
      const rx = light.radius * (this.isometric ? this.halfW : this.tileSize);
      const ry = light.radius * (this.isometric ? this.halfH * 1.5 : this.tileSize);
      const gradient = sctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rx);
      gradient.addColorStop(0, 'rgba(0,0,0,1)');
      gradient.addColorStop(0.55, `rgba(0,0,0,${0.85 * light.strength})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      // Squash the circle about its own centre: the gradient rides the
      // transform, so it stays aligned with the ellipse it fills.
      sctx.save();
      sctx.translate(p.x, p.y);
      sctx.scale(1, ry / rx);
      sctx.translate(-p.x, -p.y);
      sctx.fillStyle = gradient;
      sctx.beginPath();
      sctx.arc(p.x, p.y, rx, 0, Math.PI * 2);
      sctx.fill();
      sctx.restore();
    }
    sctx.globalCompositeOperation = 'source-over';

    this.ctx.drawImage(this.shadow, 0, 0, this.cssWidth, this.cssHeight);
  }

  /** Every light that could matter this frame, in tile coordinates. */
  lights(now) {
    const out = [];
    // A candle-sized glow around the player even with nothing lit, so being
    // caught without a torch is difficult rather than impossible.
    const own = Math.max(1.6, state.self.light || 0);
    out.push({ x: state.self.x, y: state.self.y, radius: own, strength: 1 });

    for (const player of state.players.values()) {
      if (player.id === state.playerId || !player.light) continue;
      out.push({ x: player.renderX ?? player.x, y: player.renderY ?? player.y, radius: player.light, strength: 1 });
    }

    // Fires flicker; static lights do not.
    for (const obj of state.dynamicObjects.values()) {
      const def = OBJECT_TYPES[obj.type];
      if (!def || !def.light) continue;
      out.push({ x: obj.x, y: obj.y, radius: def.light * (0.92 + 0.08 * Math.sin(now / 220)), strength: 1 });
    }
    for (const light of planeLights(this.world, state.self.plane || 0)) {
      out.push({ ...light, radius: light.radius * (0.94 + 0.06 * Math.sin(now / 320 + light.x)), strength: 0.92 });
    }
    return out;
  }

  drawFloors(bounds, now) {
    const ctx = this.ctx;
    const iso = this.isometric;
    const tiles = this.level.tiles;
    const w = iso ? this.halfW * 2 : this.tileSize;
    const h = iso ? this.halfH * 2 : this.tileSize;

    for (let ty = bounds.minY; ty <= bounds.maxY; ty += 1) {
      for (let tx = bounds.minX; tx <= bounds.maxX; tx += 1) {
        const tile = tiles[ty * this.world.width + tx];
        // Undug rock: there is nothing there to draw, at all.
        if (tile === TILE.VOID) continue;
        // Walls and cliffs are solids, drawn later as cubes.
        if (iso && BLOCKED_TILES.has(tile) && tile !== TILE.WATER) continue;
        const variant = Math.floor(noise2(tx, ty, tile) * 4);
        const sprite = iso ? isoFloorSprite(tile, variant) : tileSprite(tile, variant, 32);
        const p = this.project(tx, ty);
        ctx.drawImage(sprite, Math.round(p.x - w / 2), Math.round(p.y - h / 2), Math.ceil(w), Math.ceil(h));

        if (tile === TILE.WATER) {
          const shimmer = 0.06 + 0.05 * Math.sin(now / 700 + tx * 0.6 + ty * 0.4);
          ctx.globalAlpha = shimmer;
          ctx.fillStyle = '#dff2ff';
          if (iso) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - h / 2);
            ctx.lineTo(p.x + w / 2, p.y);
            ctx.lineTo(p.x, p.y + h / 2);
            ctx.lineTo(p.x - w / 2, p.y);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.fillRect(Math.round(p.x - w / 2), Math.round(p.y - h / 2), w, h);
          }
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  collectProps(bounds, drawables, now) {
    const ctx = this.ctx;
    const iso = this.isometric;

    for (let ty = bounds.minY; ty <= bounds.maxY; ty += 1) {
      for (let tx = bounds.minX; tx <= bounds.maxX; tx += 1) {
        const depth = iso ? tx + ty : ty;

        // Solid terrain becomes a cube in the isometric view.
        const tile = this.level.tiles[ty * this.world.width + tx];
        if (tile === TILE.VOID) continue;
        if (iso && BLOCKED_TILES.has(tile) && tile !== TILE.WATER) {
          const sprite = isoCubeSprite(CUBE_FOR_TILE[tile] || 'wall');
          const p = this.project(tx, ty);
          const w = sprite.width * this.scale;
          const h = sprite.height * this.scale;
          const x = Math.round(p.x - w / 2);
          const y = Math.round(p.y + this.halfH - h);
          drawables.push({
            depth,
            tie: 0,
            tall: true,
            bounds: { x, y, w, h },
            sprite,
            draw: () => ctx.drawImage(sprite, x, y, Math.ceil(w), Math.ceil(h))
          });
          continue;
        }

        const obj = this.level.objectAt.get(`${tx},${ty}`);
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
        drawables.push(this.propDrawable(art, tx, ty, def, { kind: 'object', id: obj.id, entity: obj, objectType: obj.type }));
      }
    }

    for (const obj of state.dynamicObjects.values()) {
      const def = OBJECT_TYPES[obj.type];
      if (!def) continue;
      drawables.push(this.propDrawable(def.art, obj.x, obj.y, def, { kind: 'object', id: obj.id, entity: obj, objectType: obj.type }));
    }

    for (const item of state.groundItems.values()) {
      const p = this.project(item.x, item.y);
      const size = (this.isometric ? this.halfW : this.tileSize / 2) * 0.9;
      const sprite = itemSprite(item.itemId, 32);
      const x = Math.round(p.x - size / 2);
      const y = Math.round(p.y - size / 2 + (this.isometric ? this.halfH * 0.2 : 0));
      drawables.push({
        depth: (this.isometric ? item.x + item.y : item.y) - 0.05,
        tie: 1,
        tall: false,
        bounds: { x, y, w: size, h: size },
        sprite,
        pick: { kind: 'ground_item', id: item.id, entity: item },
        draw: () => {
          ctx.globalAlpha = 0.85 + 0.15 * Math.sin(now / 400);
          ctx.drawImage(sprite, x, y, size, size);
          ctx.globalAlpha = 1;
        }
      });
    }
  }

  propDrawable(art, tx, ty, def, pick) {
    const ctx = this.ctx;
    const p = this.project(tx, ty);
    const iso = this.isometric;
    const sprite = iso ? isoPropSprite(art) : objectSprite(art, 32);
    const w = iso ? sprite.width * this.scale : this.tileSize;
    const tall = iso ? sprite.height > ISO_TILE_H * 2 : def.height === 2;
    const h = iso ? sprite.height * this.scale : (def.height === 2 ? this.tileSize * 2 : this.tileSize);
    const x = Math.round(p.x - w / 2);
    const y = iso ? Math.round(p.y + this.halfH - h) : Math.round(p.y - this.tileSize / 2 - (def.height === 2 ? this.tileSize : 0));

    return {
      depth: iso ? tx + ty : ty,
      tie: 2,
      tall,
      bounds: { x, y, w, h },
      sprite,
      pick,
      draw: () => ctx.drawImage(sprite, x, y, Math.ceil(w), Math.ceil(h))
    };
  }

  collectEntities(drawables, dt, now) {
    for (const npc of state.npcs.values()) {
      this.smooth(npc, dt);
      drawables.push(this.characterDrawable(npc, now, false));
    }
    for (const player of state.players.values()) {
      this.smooth(player, dt);
      drawables.push(this.characterDrawable(player, now, true));
    }
  }

  characterDrawable(entity, now, isPlayer) {
    const ctx = this.ctx;
    const iso = this.isometric;
    const p = this.project(entity.renderX, entity.renderY);
    const moving = Math.abs(entity.renderX - entity.x) > 0.04 || Math.abs(entity.renderY - entity.y) > 0.04;
    const attacking = entity.anim === 'attack' || entity.anim === 'chop' || entity.anim === 'mine';
    const frame = moving ? Math.floor(now / 170) % 2 : attacking ? Math.floor(now / 130) % 2 : 0;

    let sprite;
    let w;
    let h;
    let x;
    let y;
    let flip = false;

    // Most creatures are person-sized; a few are not, and how large one is
    // drawn is the only warning a player gets before they click on it.
    const bulk = entity.size || 1;

    if (iso) {
      const facing = isoFacing(entity.dir);
      flip = facing.flip;
      sprite = isPlayer
        ? isoPlayerSprite(entity.appearance || state.appearance, entity.look, frame, facing.view)
        : isoNpcSprite(entity.art, frame, facing.view);
      w = ISO_CHAR_W * this.scale * bulk;
      h = ISO_CHAR_H * this.scale * bulk;
      x = Math.round(p.x - w / 2);
      y = Math.round(p.y + this.halfH * 0.55 - h);
    } else {
      sprite = isPlayer
        ? playerSprite(entity.appearance || state.appearance, entity.look, frame, 32)
        : npcSprite(entity.art, frame, 32);
      w = this.tileSize * 1.15 * bulk;
      h = w * 1.5;
      x = Math.round(p.x - w / 2);
      y = Math.round(p.y - this.tileSize * 0.5 - h + this.tileSize);
    }

    const dead = isPlayer && entity.dead;

    return {
      depth: iso ? entity.renderX + entity.renderY : entity.renderY,
      tie: 3,
      tall: false,
      bounds: { x, y, w, h },
      sprite,
      flip,
      pick: isPlayer
        ? (entity.id === state.playerId ? null : { kind: 'player', id: entity.id, entity })
        : { kind: 'npc', id: entity.id, entity },
      entity,
      isPlayer,
      draw: () => {
        ctx.globalAlpha = dead ? 0.4 : ctx.globalAlpha;
        if (flip) {
          ctx.save();
          ctx.translate(x + w, y);
          ctx.scale(-1, 1);
          ctx.drawImage(sprite, 0, 0, Math.ceil(w), Math.ceil(h));
          ctx.restore();
        } else {
          ctx.drawImage(sprite, x, y, Math.ceil(w), Math.ceil(h));
        }
        ctx.globalAlpha = dead ? 1 : ctx.globalAlpha;
      }
    };
  }

  // -------------------------------------------------------------- overlays

  /** Names, health bars and chat bubbles, drawn above every sprite. */
  drawOverlays(drawables, now) {
    this.labelRects = [];
    for (const item of drawables) {
      if (!item.entity) continue;
      const entity = item.entity;
      const topY = item.bounds.y;
      const centreX = item.bounds.x + item.bounds.w / 2;

      if (item.isPlayer) {
        if (entity.hp < entity.maxHp) this.healthBar(centreX, topY - 6, item.bounds.w, entity.hp / entity.maxHp);
        if (state.settings.showNames || entity.id === state.playerId) {
          this.label(
            entity.name || 'Adventurer',
            centreX,
            topY - 11,
            entity.id === state.playerId ? '#f2c14e' : '#e8eef5',
            entity.id === state.playerId
          );
        }
        if (entity.chat) this.bubble(entity.chat, centreX, topY - 26);
      } else {
        if (!entity.friendly && entity.hp < entity.maxHp) this.healthBar(centreX, topY - 6, item.bounds.w, entity.hp / entity.maxHp);
        const distance = Math.max(Math.abs(entity.x - state.self.x), Math.abs(entity.y - state.self.y));
        const named = entity.friendly || distance <= 6 || state.self.targetId === entity.id;
        if (state.settings.showNames && named) {
          this.label(
            entity.name + (entity.level ? ` (${entity.level})` : ''),
            centreX,
            topY - 11,
            entity.friendly ? '#bfe6ff' : '#ffd7a8',
            state.self.targetId === entity.id
          );
        }
      }
    }
  }

  healthBar(cx, y, width, fraction) {
    const ctx = this.ctx;
    const w = Math.max(22, width * 0.62);
    const h = 4;
    const x = cx - w / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = fraction > 0.5 ? '#58c26f' : fraction > 0.25 ? '#f2c14e' : '#e05e5e';
    ctx.fillRect(x, y, Math.max(0, w * fraction), h);
  }

  /**
   * Draws a name, unless it would land on top of one already drawn this frame.
   * `force` keeps the player's own name and the current target always visible.
   */
  label(text, cx, cy, colour, force = false) {
    const ctx = this.ctx;
    ctx.font = '600 12px "Trebuchet MS", sans-serif';
    if (this.labelRects) {
      const width = ctx.measureText(text).width;
      const rect = { x: cx - width / 2, y: cy - 11, w: width, h: 13 };
      const collides = this.labelRects.some((other) =>
        rect.x < other.x + other.w && rect.x + rect.w > other.x &&
        rect.y < other.y + other.h && rect.y + rect.h > other.y);
      if (collides && !force) return;
      this.labelRects.push(rect);
    }
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
    const clipped = text.length > 34 ? `${text.slice(0, 33)}…` : text;
    const width = Math.min(240, ctx.measureText(clipped).width + 16);
    const x = cx - width / 2;
    const y = cy - 20;
    ctx.fillStyle = 'rgba(18,25,33,0.94)';
    ctx.strokeStyle = '#f2c14e';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, width, 20, 6);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 4, y + 20);
    ctx.lineTo(cx + 4, y + 20);
    ctx.lineTo(cx, y + 25);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8eef5';
    ctx.textAlign = 'center';
    ctx.fillText(clipped, cx, y + 14);
    ctx.textAlign = 'left';
  }

  drawHover() {
    if (!this.hoverTile) return;
    const { x, y } = this.hoverTile;
    if (x < 0 || y < 0 || x >= this.world.width || y >= this.world.height) return;
    const ctx = this.ctx;
    const p = this.project(x, y);
    ctx.strokeStyle = 'rgba(242,193,78,0.85)';
    ctx.lineWidth = 2;
    if (this.isometric) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - this.halfH);
      ctx.lineTo(p.x + this.halfW, p.y);
      ctx.lineTo(p.x, p.y + this.halfH);
      ctx.lineTo(p.x - this.halfW, p.y);
      ctx.closePath();
      ctx.stroke();
    } else {
      const size = this.tileSize;
      ctx.strokeRect(Math.round(p.x - size / 2) + 1, Math.round(p.y - size / 2) + 1, size - 2, size - 2);
    }
  }

  drawSplats(now) {
    const ctx = this.ctx;
    state.splats = state.splats.filter((splat) => now - splat.born < SPLAT_LIFETIME);
    for (const splat of state.splats) {
      const entity =
        state.npcs.get(splat.id) ||
        state.players.get(splat.id) ||
        (splat.id === state.playerId ? { renderX: state.self.x, renderY: state.self.y } : null);
      if (!entity) continue;
      const progress = (now - splat.born) / SPLAT_LIFETIME;
      const p = this.project(entity.renderX ?? entity.x, entity.renderY ?? entity.y);
      const px = p.x;
      const py = p.y - (this.isometric ? 34 : 20) - progress * 26;
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

  drawVignette() {
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

  // --------------------------------------------------------------- picking

  /**
   * What did the player click on? Hit-tests the sprites actually drawn last
   * frame, front to back — the only reliable way to pick in an isometric scene
   * where sprites overlap several tiles.
   *
   * The test is per-pixel, not per-rectangle: a signpost or a tree is mostly
   * empty space inside its bounding box, and a bounding-box test lets it steal
   * clicks aimed at whoever is standing behind it.
   */
  pick(px, py) {
    let transparentFallback = null;

    for (let i = this.drawables.length - 1; i >= 0; i -= 1) {
      const item = this.drawables[i];
      if (!item.pick) continue;
      const b = item.bounds;
      if (px < b.x || px > b.x + b.w || py < b.y || py > b.y + b.h) continue;

      if (this.spriteHit(item, px, py)) return item.pick;
      // Remember the nearest thing whose box we were inside, in case nothing
      // scores a solid pixel (tiny sprites, rounding at high zoom).
      if (!transparentFallback && item.pick.kind !== 'object') transparentFallback = item.pick;
    }

    if (transparentFallback) return transparentFallback;
    const tile = this.unproject(px, py);
    return { kind: 'tile', x: tile.x, y: tile.y };
  }

  /** True when the sprite has a non-transparent pixel under (px, py). */
  spriteHit(item, px, py) {
    const sprite = item.sprite;
    if (!sprite) return true; // no art to test against: treat the box as solid
    const b = item.bounds;
    let u = ((px - b.x) / b.w) * sprite.width;
    const v = ((py - b.y) / b.h) * sprite.height;
    if (item.flip) u = sprite.width - u;
    const mask = alphaMask(sprite);
    if (!mask) return true;
    const x = Math.min(sprite.width - 1, Math.max(0, Math.floor(u)));
    const y = Math.min(sprite.height - 1, Math.max(0, Math.floor(v)));
    return mask[y * sprite.width + x] > 24;
  }
}

/**
 * One-byte-per-pixel alpha mask for a sprite, built once and cached against the
 * canvas. Sprites are generated once and reused, so this costs a single
 * getImageData per distinct sprite for the life of the page.
 */
const maskCache = new WeakMap();

function alphaMask(sprite) {
  const cached = maskCache.get(sprite);
  if (cached) return cached;
  try {
    const ctx = sprite.getContext('2d');
    const { data } = ctx.getImageData(0, 0, sprite.width, sprite.height);
    const mask = new Uint8Array(sprite.width * sprite.height);
    for (let i = 0; i < mask.length; i += 1) mask[i] = data[i * 4 + 3];
    maskCache.set(sprite, mask);
    return mask;
  } catch {
    // Tainted canvas or no 2d context: fall back to bounding-box picking.
    maskCache.set(sprite, null);
    return null;
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
 * the entity dots are redrawn each frame. It stays top-down in both
 * projections — a map you glance at should be a map, not a diamond.
 */
export class Minimap {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.scale = 2;
    // One raster per plane, built the first time you set foot on it. Three mine
    // levels is three cheap 192x192 bitmaps, so there is nothing to gain from
    // being cleverer than a cache.
    this.bases = new Map();
  }

  baseFor(plane) {
    if (!this.bases.has(plane)) this.bases.set(plane, this.rasterise(plane));
    return this.bases.get(plane);
  }

  rasterise(plane = 0) {
    const level = planeAt(this.world, plane);
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
      [TILE.ROCKFACE]: '#3f3a34',
      [TILE.MINE_FLOOR]: '#443f3d',
      [TILE.MINE_WALL]: '#2b2724',
      [TILE.EMBER]: '#4a2a22',
      [TILE.CRYSTAL]: '#2a1d2e'
    };
    for (let y = 0; y < this.world.height; y += 1) {
      for (let x = 0; x < this.world.width; x += 1) {
        const tile = level.tiles[y * this.world.width + x];
        // Undug rock is left transparent, so the map of a mine is the shape of
        // the mine rather than a filled square.
        if (tile === TILE.VOID) continue;
        ctx.fillStyle = colours[tile] || '#4a7c3f';
        ctx.fillRect(x * this.scale, y * this.scale, this.scale, this.scale);
      }
    }
    ctx.fillStyle = '#20401f';
    for (const obj of level.objects) {
      const def = OBJECT_TYPES[obj.type];
      if (!def) continue;
      if (def.art === 'tree' || def.art === 'oak' || def.art === 'willow') {
        ctx.fillRect(obj.x * this.scale, obj.y * this.scale, this.scale, this.scale);
      }
    }

    // Ways between levels, marked loudly. A player who cannot find the stairs
    // has no dungeon, however much of one you built - so these are drawn last,
    // larger than a tile, and in the one colour nothing else on the map uses.
    for (const obj of level.objects) {
      if (!obj.link) continue;
      const size = this.scale * 3;
      const x = obj.x * this.scale - this.scale;
      const y = obj.y * this.scale - this.scale;
      ctx.fillStyle = '#0c1116';
      ctx.fillRect(x - 1, y - 1, size + 2, size + 2);
      ctx.fillStyle = obj.link.plane > obj.plane ? '#ff8a3d' : '#7fd4ff';
      ctx.fillRect(x, y, size, size);
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
    const level = planeAt(this.world, state.self.plane || 0);
    ctx.fillStyle = level.ambient || '#0c1116';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(this.baseFor(state.self.plane || 0), cx - src / 2, cy - src / 2, src, src, 0, 0, size, size);

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

  toWorld(px, py) {
    const size = this.canvas.width;
    const tilesVisible = 46;
    return {
      x: Math.round(state.self.x + (px / size - 0.5) * tilesVisible),
      y: Math.round(state.self.y + (py / size - 0.5) * tilesVisible)
    };
  }
}
