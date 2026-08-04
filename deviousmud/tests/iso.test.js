/**
 * Isometric projection tests.
 *
 * `client/js/iso.js` deliberately has no DOM imports so the maths behind the
 * view can be tested in Node, without a browser.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ISO_TILE_H, ISO_TILE_W, isoDepth, isoProject, isoUnproject, shade } from '../client/js/iso.js';

const halfW = ISO_TILE_W / 2;
const halfH = ISO_TILE_H / 2;

/** Math.round(-0.2) is -0, which is a tile index of zero everywhere it matters. */
const tileOf = (value) => Math.round(value) || 0;

test('tiles project to a 2:1 diamond grid', () => {
  assert.deepEqual(isoProject(0, 0, halfW, halfH), { x: 0, y: 0 });
  // One step east goes right and down by half a tile.
  assert.deepEqual(isoProject(1, 0, halfW, halfH), { x: halfW, y: halfH });
  // One step south goes left and down.
  assert.deepEqual(isoProject(0, 1, halfW, halfH), { x: -halfW, y: halfH });
  // Opposite corners of a tile pair sit on the same screen column.
  assert.equal(isoProject(1, 1, halfW, halfH).x, 0);
  assert.equal(isoProject(1, 1, halfW, halfH).y, ISO_TILE_H);
});

test('unproject inverts project for every tile in a region', () => {
  for (let y = -20; y <= 20; y += 1) {
    for (let x = -20; x <= 20; x += 1) {
      const p = isoProject(x, y, halfW, halfH);
      const back = isoUnproject(p.x, p.y, halfW, halfH);
      assert.equal(tileOf(back.x), x, `x round trip at ${x},${y}`);
      assert.equal(tileOf(back.y), y, `y round trip at ${x},${y}`);
    }
  }
});

test('a click anywhere inside a tile resolves to that tile', () => {
  // Sample points well inside the diamond, which is what the renderer rounds.
  const samples = [
    { dx: 0, dy: 0 },
    { dx: halfW * 0.4, dy: 0 },
    { dx: -halfW * 0.4, dy: 0 },
    { dx: 0, dy: halfH * 0.4 },
    { dx: 0, dy: -halfH * 0.4 }
  ];
  for (const tile of [{ x: 3, y: 7 }, { x: 48, y: 52 }, { x: 0, y: 0 }]) {
    const centre = isoProject(tile.x, tile.y, halfW, halfH);
    for (const sample of samples) {
      const back = isoUnproject(centre.x + sample.dx, centre.y + sample.dy, halfW, halfH);
      assert.equal(tileOf(back.x), tile.x);
      assert.equal(tileOf(back.y), tile.y);
    }
  }
});

test('depth orders the scene back to front', () => {
  // Anything further south or east is nearer the camera and sorts later.
  assert.ok(isoDepth(5, 5) > isoDepth(4, 5));
  assert.ok(isoDepth(5, 5) > isoDepth(5, 4));
  // Tiles on the same diagonal share a depth: they never overlap each other.
  assert.equal(isoDepth(6, 4), isoDepth(4, 6));
});

test('zoom scales the projection uniformly', () => {
  const zoomed = isoProject(3, 5, halfW * 2, halfH * 2);
  const normal = isoProject(3, 5, halfW, halfH);
  assert.equal(zoomed.x, normal.x * 2);
  assert.equal(zoomed.y, normal.y * 2);
});

test('face shading lightens and darkens without leaving the colour range', () => {
  assert.equal(shade('#000000', 0.5), 'rgb(0, 0, 0)');
  assert.equal(shade('#ffffff', 1.5), 'rgb(255, 255, 255)');
  assert.equal(shade('#808080', 0.5), 'rgb(64, 64, 64)');
  // Three-digit hex is accepted too.
  assert.equal(shade('#fff', 1), 'rgb(255, 255, 255)');
  const lit = shade('#4a7c3f', 1.12);
  assert.match(lit, /^rgb\(\d+, \d+, \d+\)$/);
});
