import { feetAt, canStep } from "../world.js";
import { nextStep, greedyStepToward } from "../ai.js";

const STEP_MS = 90; // faster than player so it keeps up and closes gaps

export function makeHostage(spawn) {
  return {
    kind: "hostage",
    x: spawn.x, y: spawn.y, z: spawn.z,
    tx: spawn.x, ty: spawn.y, tz: spawn.z,
    moveT: 0,
    state: "idle", // idle | following | rescued
    stepCount: 0,
  };
}

export function walkPhaseHostage(h) {
  return ((h.stepCount % 2) * 0.5 + h.moveT * 0.5) % 1;
}

export function hostageRenderPos(h) {
  const t = h.moveT;
  return {
    rx: h.x + (h.tx - h.x) * t,
    ry: h.y + (h.ty - h.y) * t,
    rz: h.z + (h.tz - h.z) * t,
  };
}

function isMoving(h) { return h.x !== h.tx || h.y !== h.ty || h.z !== h.tz; }

export function tickHostage(h, world, player, dtMs, pathToPlayer = null, isOccupied = null) {
  if (isMoving(h)) {
    h.moveT += dtMs / STEP_MS;
    if (h.moveT >= 1) {
      h.x = h.tx; h.y = h.ty; h.z = h.tz;
      h.moveT = 0;
    }
    return;
  }

  if (h.state !== "following") return;

  // Try to keep within 1 cell of the player. Step toward player if 2+ away.
  const dx = player.x - h.x;
  const dy = player.y - h.y;
  const dist = Math.abs(dx) + Math.abs(dy);
  if (dist <= 1) return;

  // Use BFS map (shared with ants) for proper maze navigation; fall back to greedy.
  let next = null;
  if (pathToPlayer) next = nextStep(pathToPlayer, h.x, h.y);
  if (!next) next = greedyStepToward(world, h.x, h.y, player.x, player.y);
  if (!next || !canStep(world, h.x, h.y, next.x, next.y, h.z)) return;

  const tz = feetAt(world, next.x, next.y, h.z);
  if (isOccupied && isOccupied(next.x, next.y, tz)) return; // tile taken

  h.tx = next.x;
  h.ty = next.y;
  h.tz = tz;
  h.moveT = 0;
  h.stepCount = (h.stepCount + 1) | 0;
}

export function touchedBy(h, p) {
  if (h.state !== "idle") return false;
  return Math.abs(h.x - p.x) + Math.abs(h.y - p.y) <= 1 && Math.abs(h.z - p.z) <= 1;
}
