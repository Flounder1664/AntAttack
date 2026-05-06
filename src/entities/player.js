import { feetAt, get, W, L } from "../world.js";

const BASE_STEP_MS = 130;

// makePlayer accepts opts that come from skills + level config.
// Defaults match the new 1-life-baseline progression model.
export function makePlayer(spawn, character = "boy", opts = {}) {
  const {
    health = 1,
    maxHealth = 1,
    grenades = 8,
    fallTolerance = 1,   // a drop > fallTolerance deals (drop - fallTolerance) damage
    walkSpeedMult = 1,   // 1 = base; 1.1 = 10% faster (lower step interval)
    shieldUp = false,    // SHIELD pickup — absorbs next bite
  } = opts;
  return {
    kind: "player",
    character,
    // logical tile + interp position toward target tile
    x: spawn.x, y: spawn.y, z: spawn.z,
    tx: spawn.x, ty: spawn.y, tz: spawn.z,
    moveT: 0,                 // 0..1 between (x,y,z) and (tx,ty,tz)
    facing: { dx: 0, dy: 1 }, // last direction moved (for grenade aim)
    health,
    maxHealth,
    bites: 0,
    grenades,
    grenadesUsed: 0,
    alive: true,
    stepCount: 0,
    pendingFallDamage: 0,     // set in tryStep, applied on landing
    deathCause: null,         // "ant" | "fall" — set when health hits 0
    fallTolerance,
    walkSpeedMult,
    shieldUp,
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

// Heal — capped at p.maxHealth. Returns the amount actually applied.
export function heal(p, amount) {
  if (!p.alive || amount <= 0) return 0;
  const before = p.health;
  p.health = Math.min(p.maxHealth, p.health + amount);
  return p.health - before;
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
  // Falling more than fallTolerance blocks deals (drop - fallTolerance) damage.
  const drop = fa - fb;
  p.pendingFallDamage = drop > p.fallTolerance ? drop - p.fallTolerance : 0;
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
  // walkSpeedMult > 1 means faster — divide step interval by it.
  const stepMs = BASE_STEP_MS / (p.walkSpeedMult || 1);
  p.moveT += dtMs / stepMs;
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

// Returns true if a shield consumed the bite.
export function bite(p) {
  if (!p.alive) return false;
  if (p.shieldUp) {
    p.shieldUp = false;
    return true;  // shield absorbed it
  }
  p.bites += 1;
  p.health -= 1;
  if (p.health <= 0) { p.alive = false; p.deathCause = "ant"; }
  return false;
}
