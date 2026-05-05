import { feetAt, get, W, L } from "../world.js";

const STEP_MS = 130;

export function makePlayer(spawn, character = "boy") {
  return {
    kind: "player",
    character,
    // logical tile + interp position toward target tile
    x: spawn.x, y: spawn.y, z: spawn.z,
    tx: spawn.x, ty: spawn.y, tz: spawn.z,
    moveT: 0,                 // 0..1 between (x,y,z) and (tx,ty,tz)
    facing: { dx: 0, dy: 1 }, // last direction moved (for grenade aim)
    health: 4,
    bites: 0,
    grenades: 8,
    grenadesUsed: 0,
    alive: true,
    stepCount: 0,
    pendingFallDamage: 0,     // set in tryStep, applied on landing
    deathCause: null,         // "ant" | "fall" — set when health hits 0
  };
}

// Smooth screen position used for rendering.
export function playerRenderPos(p) {
  const t = p.moveT;
  return {
    rx: p.x + (p.tx - p.x) * t,
    ry: p.y + (p.ty - p.y) * t,
    rz: p.z + (p.tz - p.z) * t,
  };
}

export function isMoving(p) { return p.x !== p.tx || p.y !== p.ty || p.z !== p.tz; }

// Reduce health from a fall without counting it as an ant bite.
export function takeFallDamage(p, amount) {
  if (!p.alive || amount <= 0) return;
  p.health = Math.max(0, p.health - amount);
  if (p.health <= 0) { p.alive = false; p.deathCause = "fall"; }
}

// Try to move one tile. Unlike canStep (which blocks drops > 1), the player
// is allowed to walk off edges of any height — the drop is recorded and
// applied as fall damage when the animation completes in tickPlayer.
// isBlocked(x, y, z) — optional callback; return true to veto the move.
export function tryStep(p, world, dx, dy, isBlocked = null) {
  if (isMoving(p)) return false;
  const nx = p.x + dx, ny = p.y + dy;
  if (nx < 0 || nx >= W || ny < 0 || ny >= L) return false;
  const fa = p.z;
  const fb = feetAt(world, nx, ny, fa);
  if (fb - fa > 1) return false;              // can't step up more than 1 block
  if (fb > fa && get(world, p.x, p.y, fa)) return false; // overhang blocks climb
  if (isBlocked && isBlocked(nx, ny, fb)) return false;  // entity collision
  p.tx = nx; p.ty = ny; p.tz = fb;
  p.moveT = 0;
  p.facing = { dx, dy };
  p.stepCount = (p.stepCount + 1) | 0;
  // Falling 2+ blocks deals (drop − 1) damage on landing.
  p.pendingFallDamage = fa - fb > 1 ? fa - fb - 1 : 0;
  return true;
}

// Continuous walking phase 0..1 used by the sprite animator.
// Each step contributes half a cycle, so legs alternate naturally.
export function walkPhase(p) {
  return ((p.stepCount % 2) * 0.5 + p.moveT * 0.5) % 1;
}

// Returns the fall damage dealt this tick (0 when no landing occurred).
export function tickPlayer(p, dtMs) {
  if (!isMoving(p)) return 0;
  p.moveT += dtMs / STEP_MS;
  if (p.moveT >= 1) {
    p.x = p.tx; p.y = p.ty; p.z = p.tz;
    p.moveT = 0;
    const dmg = p.pendingFallDamage;
    p.pendingFallDamage = 0;
    if (dmg > 0) takeFallDamage(p, dmg);
    return dmg;
  }
  return 0;
}

export function bite(p) {
  if (!p.alive) return;
  p.bites += 1;
  p.health -= 1;
  if (p.health <= 0) { p.alive = false; p.deathCause = "ant"; }
}
