/**
 * A* pathfinding over the tile grid.
 *
 * Movement is 4-directional plus diagonals, but a diagonal step is only legal
 * when both orthogonal neighbours are clear - otherwise characters slip through
 * the corners of buildings.
 */

import { isWalkable } from '../world.js';

const MAX_NODES = 6000;

const DIRS = [
  { dx: 0, dy: -1, cost: 10 },
  { dx: 1, dy: 0, cost: 10 },
  { dx: 0, dy: 1, cost: 10 },
  { dx: -1, dy: 0, cost: 10 },
  { dx: 1, dy: -1, cost: 14 },
  { dx: 1, dy: 1, cost: 14 },
  { dx: -1, dy: 1, cost: 14 },
  { dx: -1, dy: -1, cost: 14 }
];

function heuristic(x1, y1, x2, y2) {
  const dx = Math.abs(x1 - x2);
  const dy = Math.abs(y1 - y2);
  return 10 * (dx + dy) - 6 * Math.min(dx, dy);
}

function canStep(world, x, y, dx, dy, blocked) {
  const nx = x + dx;
  const ny = y + dy;
  if (!isWalkable(world, nx, ny) || blocked(nx, ny)) return false;
  if (dx !== 0 && dy !== 0) {
    if (!isWalkable(world, x + dx, y) || blocked(x + dx, y)) return false;
    if (!isWalkable(world, x, y + dy) || blocked(x, y + dy)) return false;
  }
  return true;
}

/**
 * Finds a path from (sx,sy) to (tx,ty).
 *
 * @param {object} opts.blocked   extra "is this tile occupied" predicate
 * @param {number} opts.range     stop as soon as we are within this many tiles
 * @returns {Array<{x:number,y:number}>} steps excluding the start tile
 */
export function findPath(world, sx, sy, tx, ty, opts = {}) {
  const blocked = opts.blocked || (() => false);
  const range = opts.range ?? 0;
  if (sx === tx && sy === ty) return [];

  const withinGoal = (x, y) => Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= range;
  if (withinGoal(sx, sy)) return [];

  const open = [{ x: sx, y: sy, g: 0, f: heuristic(sx, sy, tx, ty), key: sx * 10000 + sy }];
  const cameFrom = new Map();
  const gScore = new Map([[sx * 10000 + sy, 0]]);
  const closed = new Set();
  let best = null;
  let bestH = Infinity;
  let expanded = 0;

  while (open.length && expanded < MAX_NODES) {
    // Small maps make a linear scan cheaper than maintaining a heap.
    let bestIdx = 0;
    for (let i = 1; i < open.length; i += 1) if (open[i].f < open[bestIdx].f) bestIdx = i;
    const current = open.splice(bestIdx, 1)[0];
    if (closed.has(current.key)) continue;
    closed.add(current.key);
    expanded += 1;

    const h = heuristic(current.x, current.y, tx, ty);
    if (h < bestH) {
      bestH = h;
      best = current;
    }

    if (withinGoal(current.x, current.y)) return reconstruct(cameFrom, current);

    for (const dir of DIRS) {
      if (!canStep(world, current.x, current.y, dir.dx, dir.dy, blocked)) continue;
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      const key = nx * 10000 + ny;
      if (closed.has(key)) continue;
      const tentative = current.g + dir.cost;
      if (tentative >= (gScore.get(key) ?? Infinity)) continue;
      gScore.set(key, tentative);
      cameFrom.set(key, current);
      open.push({ x: nx, y: ny, g: tentative, f: tentative + heuristic(nx, ny, tx, ty), key });
    }
  }

  // Unreachable: walk as close as we managed to get, which feels much better
  // than refusing to move at all.
  if (best && best.key !== sx * 10000 + sy) return reconstruct(cameFrom, best);
  return [];
}

function reconstruct(cameFrom, node) {
  const path = [];
  let current = node;
  while (current) {
    path.push({ x: current.x, y: current.y });
    current = cameFrom.get(current.key);
  }
  path.pop(); // drop the start tile
  path.reverse();
  return path;
}

export function chebyshev(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** Melee range: orthogonally or diagonally adjacent (or standing on it). */
export function isAdjacent(ax, ay, bx, by) {
  return chebyshev(ax, ay, bx, by) <= 1;
}
