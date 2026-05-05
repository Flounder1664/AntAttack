// BFS pathfinding over the walkable surface (top-of-column),
// with a 1-step climb/descent rule (matches world.canStep).

import { W, L, canStep, feetAt } from "./world.js";

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Returns a Map keyed by `x*L+y` whose value is the next-step cell on the
// shortest path *back* to (gx,gy). Use it to step toward the goal:
//   const next = pathFrom.get(x*L+y); // {x, y}
export function bfsTo(world, gx, gy) {
  const came = new Map();
  const visited = new Uint8Array(W * L);
  const queue = [[gx, gy]];
  visited[gx * L + gy] = 1;

  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= L) continue;
      if (visited[nx * L + ny]) continue;
      if (!canStep(world, nx, ny, x, y)) continue;
      visited[nx * L + ny] = 1;
      came.set(nx * L + ny, { x, y });
      queue.push([nx, ny]);
    }
  }
  return came;
}

// Given a precomputed BFS tree, return the next step from (x,y). null if none.
export function nextStep(came, x, y) {
  return came.get(x * L + y) || null;
}

// Lightweight Manhattan heuristic used when BFS doesn't reach this cell.
export function greedyStepToward(world, x, y, gx, gy) {
  const candidates = [];
  for (const [dx, dy] of DIRS) {
    const nx = x + dx, ny = y + dy;
    if (canStep(world, x, y, nx, ny)) {
      const d = Math.abs(nx - gx) + Math.abs(ny - gy);
      candidates.push({ x: nx, y: ny, d });
    }
  }
  candidates.sort((a, b) => a.d - b.d);
  return candidates[0] || null;
}
