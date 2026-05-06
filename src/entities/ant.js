import { feetAt, canStep } from "../world.js";
import { bfsTo, nextStep, greedyStepToward } from "../ai.js";

const STEP_MS = 320; // base (far away)

function stepMsForDist(d) {
  if (d <= 2) return 140;
  if (d <= 5) return 200;
  if (d <= 9) return 260;
  return STEP_MS;
}

// Three ant types, each with distinct stats:
//   WORKER  — the basic ant. Default stats.
//   SOLDIER — slower, takes 2 grenade hits to kill, larger sprite.
//   SCOUT   — faster, fragile. 1 grenade kills it.
//
// `stepMul` multiplies the distance-derived step interval (1.0 = unchanged,
// 1.4 = 40% slower, 0.7 = 30% faster).
export const ANT_TYPES = {
  WORKER:  { hp: 1, stepMul: 1.0,  biteDmg: 1, scale: 1.0 },
  SOLDIER: { hp: 2, stepMul: 1.30, biteDmg: 1, scale: 1.4 },
  SCOUT:   { hp: 1, stepMul: 0.65, biteDmg: 1, scale: 0.8 },
};

// Spawn-share table indexed by levelIdx (0..6).
const TYPE_WEIGHTS = [
  { WORKER: 100, SOLDIER:  0, SCOUT:  0 },  // L0
  { WORKER: 100, SOLDIER:  0, SCOUT:  0 },  // L1
  { WORKER:  80, SOLDIER: 20, SCOUT:  0 },  // L2
  { WORKER:  70, SOLDIER: 30, SCOUT:  0 },  // L3
  { WORKER:  60, SOLDIER: 25, SCOUT: 15 },  // L4
  { WORKER:  50, SOLDIER: 30, SCOUT: 20 },  // L5
  { WORKER:  40, SOLDIER: 35, SCOUT: 25 },  // L6
];

export function pickAntType(levelIdx) {
  const table = TYPE_WEIGHTS[Math.max(0, Math.min(TYPE_WEIGHTS.length - 1, levelIdx))];
  let total = 0;
  for (const k in table) total += table[k];
  let r = Math.random() * total;
  for (const k in table) {
    r -= table[k];
    if (r <= 0) return k;
  }
  return "WORKER";
}

export function makeAnt(spawn, type = "WORKER") {
  const t = ANT_TYPES[type] || ANT_TYPES.WORKER;
  return {
    kind: "ant",
    id: Math.random().toString(36).slice(2, 9),
    type,
    hp: t.hp,
    stepMul: t.stepMul,
    biteDmg: t.biteDmg,
    scale: t.scale,
    x: spawn.x, y: spawn.y, z: spawn.z,
    tx: spawn.x, ty: spawn.y, tz: spawn.z,
    moveT: 0,
    _stepMs: STEP_MS,
    biteCooldownMs: 0,
    alive: true,
    repathInMs: Math.random() * 600,
    cachedPath: null,
  };
}

export function antRenderPos(a) {
  const t = a.moveT;
  return {
    rx: a.x + (a.tx - a.x) * t,
    ry: a.y + (a.ty - a.y) * t,
    rz: a.z + (a.tz - a.z) * t,
  };
}

function isMoving(a) { return a.x !== a.tx || a.y !== a.ty || a.z !== a.tz; }

// Periodically a single shared BFS map can be supplied via `pathFromPlayer`
// (precomputed each tick from player as goal). If null, fall back to greedy.
// isOccupied(x, y, z) — optional callback; return true to block a step.
export function tickAnt(a, world, player, dtMs, pathFromPlayer, isOccupied = null) {
  if (!a.alive) return;

  if (a.biteCooldownMs > 0) a.biteCooldownMs -= dtMs;

  if (isMoving(a)) {
    a.moveT += dtMs / a._stepMs;
    if (a.moveT >= 1) {
      a.x = a.tx; a.y = a.ty; a.z = a.tz;
      a.moveT = 0;
    }
    return;
  }

  // Bite only when on the same level and horizontally adjacent.
  // Ants on a lower (or higher) z cannot bite across a ledge.
  if (Math.abs(a.x - player.x) + Math.abs(a.y - player.y) <= 1 && a.z === player.z) {
    if (a.biteCooldownMs <= 0) {
      a.biteCooldownMs = 700;
      // Bite is applied by main loop reading antIsBitingNow.
      a._biteFlag = true;
    }
    return;
  }

  // Choose next cell.
  let next = null;
  if (pathFromPlayer) {
    const step = nextStep(pathFromPlayer, a.x, a.y);
    if (step) next = step;
  }
  if (!next) {
    next = greedyStepToward(world, a.x, a.y, player.x, player.y);
  }
  if (!next) return;
  if (!canStep(world, a.x, a.y, next.x, next.y, a.z)) return;

  const tz = feetAt(world, next.x, next.y, a.z);
  if (isOccupied && isOccupied(next.x, next.y, tz)) return; // tile taken

  const mdist = Math.abs(next.x - player.x) + Math.abs(next.y - player.y);
  a._stepMs = Math.round(stepMsForDist(mdist) * a.stepMul);
  a.tx = next.x; a.ty = next.y; a.tz = tz;
  a.moveT = 0;
}

// Read-and-clear bite flag.
export function consumeBite(a) {
  if (a._biteFlag) { a._biteFlag = false; return true; }
  return false;
}

// Build shared BFS map (called once per AI tick from main).
export function buildAntPath(world, player) {
  return bfsTo(world, player.x, player.y);
}
