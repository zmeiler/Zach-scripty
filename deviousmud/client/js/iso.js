/**
 * Isometric projection.
 *
 * The simulation is a square grid; only the view is isometric. Tiles are drawn
 * as 2:1 diamonds — 64 x 32 at zoom 1 — which keeps the maths exact in integers
 * and the pixel grid crisp.
 *
 *   screenX = (tx - ty) * halfW
 *   screenY = (tx + ty) * halfH
 *
 * Depth is simply tx + ty: anything with a larger sum is nearer the camera and
 * therefore drawn later.
 */

export const ISO_TILE_W = 64;
export const ISO_TILE_H = 32;

/** Height of a one-tile-tall cube face, in pixels at zoom 1. */
export const ISO_WALL_H = 46;

export function isoProject(tx, ty, halfW, halfH) {
  return {
    x: (tx - ty) * halfW,
    y: (tx + ty) * halfH
  };
}

export function isoUnproject(px, py, halfW, halfH) {
  const a = px / halfW;
  const b = py / halfH;
  return {
    x: (b + a) / 2,
    y: (b - a) / 2
  };
}

export function isoDepth(tx, ty) {
  return tx + ty;
}

/** Traces the diamond of a floor tile, in a `w` x `h` box. */
export function diamondPath(ctx, w, h, x = 0, y = 0) {
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w / 2, y + h);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
}

/** Multiplies a hex colour towards black (f < 1) or white (f > 1). */
export function shade(hex, factor) {
  const value = hex.replace('#', '');
  const num = parseInt(value.length === 3 ? value.split('').map((c) => c + c).join('') : value, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const mix = (channel) => {
    const next = factor <= 1 ? channel * factor : channel + (255 - channel) * (factor - 1);
    return Math.max(0, Math.min(255, Math.round(next)));
  };
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

/**
 * Face brightness for a light source sitting above and to the north-west.
 * Every solid in the world uses these three values, which is what makes the
 * scene read as one coherent set of objects rather than a pile of sprites.
 */
export const FACE = {
  top: 1.12,
  left: 0.82,
  right: 0.58
};
