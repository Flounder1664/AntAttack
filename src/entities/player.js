import { feetAt, get, W, L } from "../world.js";

const BASE_STEP_MS = 160;

export function makePlayer(spawn, character = "boy", opts = {}) {
  const {
    health = 1,
    maxHealth = 1,
    grenades = 0,
    mines = 0,
    bolts = 0,
    grenadeUnlocked = false,
    mineUnlocked = false,
    boltUnlocked = false,
    decoyUnlocked = false,
    fallTolerance = 1,
    walkSpeedMult = 1,
    shieldUp = false,
    blastRadius = 1,
    mineRadius = 1,
    boltPierce = false,
    boltStorm = false,
    boltRicochet = false,
    stickyFrag = false,
    quickThrow = false,
    tripWire = false,
    remoteDetonator = false,
    adrenaline = false,
    grapplingStep = false,
    mapVision = false,
  } = opts;
  return {
    kind: "player",
    character,
    x: spawn.x, y: spawn.y, z: spawn.z,
    tx: spawn.x, ty: spawn.y, tz: spawn.z,
    moveT: 0,
    facing: { dx: 0, dy: 1 },
    health, maxHealth,
    bites: 0,
    grenades, mines, bolts,
    grenadesUsed: 0, minesPlaced: 0, boltsFired: 0,
    alive: true, stepCount: 0,
    pendingFallDamage: 0, deathCause: null,
    fallTolerance, walkSpeedMult, shieldUp,
    grenadeUnlocked, mineUnlocked, boltUnlocked, decoyUnlocked,
    blastRadius, mineRadius,
    boltPierce, boltStorm, boltRicochet,
    stickyFrag, quickThrow, tripWire, remoteDetonator,
    adrenaline,
    adrenalineMs: 0,                   // active speed-burst countdown
    grapplingStep,
    grapplingUsed: false,              // reset to false at level start
    mapVision,
    mapVisionOn: false,                // toggled at runtime by Tab
  };
}

export function playerRenderPos(p) {
  const t = p.moveT;
  return {
    rx: p.x + (p.tx - p.x) * t,
    ry: p.y + (p.ty - p.y) * t,
    rz: p.z + (p.tz - p.z) * t,
  };
}

export function isMoving(p) { return p.x !== p.tx || p.y !== p.ty || p.z !== p.tz; }

export function takeFallDamage(p, amount) {
  if (!p.alive || amount <= 0) return;
  p.health = Math.max(0, p.health - amount);
  if (p.health <= 0) { p.alive = false; p.deathCause = "fall"; }
}

export function heal(p, amount) {
  if (!p.alive || amount <= 0) return 0;
  const before = p.health;
  p.health = Math.min(p.maxHealth, p.health + amount);
  return p.health - before;
}

// `leap` — when true, allow up to 2-tile distance moves (Grappling Step).
export function tryStep(p, world, dx, dy, isBlocked = null, leap = false) {
  if (isMoving(p)) return false;
  const stride = leap ? 2 : 1;
  const nx = p.x + dx * stride;
  const ny = p.y + dy * stride;
  if (nx < 0 || nx >= W || ny < 0 || ny >= L) return false;
  const fa = p.z;
  const fb = feetAt(world, nx, ny, fa);
  if (fb - fa > 1) return false;
  if (fb > fa && get(world, p.x, p.y, fa)) return false;
  if (isBlocked && isBlocked(nx, ny, fb)) return false;
  p.tx = nx; p.ty = ny; p.tz = fb;
  p.moveT = 0;
  p.facing = { dx, dy };
  p.stepCount = (p.stepCount + 1) | 0;
  const drop = fa - fb;
  p.pendingFallDamage = drop > p.fallTolerance ? drop - p.fallTolerance : 0;
  return true;
}

export function walkPhase(p) {
  return ((p.stepCount % 2) * 0.5 + p.moveT * 0.5) % 1;
}

export function tickPlayer(p, dtMs) {
  // Adrenaline countdown (continuous, even while idle).
  if (p.adrenalineMs > 0) p.adrenalineMs = Math.max(0, p.adrenalineMs - dtMs);
  if (!isMoving(p)) return 0;
  const baseSpeed = p.walkSpeedMult || 1;
  const adrenalineBoost = p.adrenalineMs > 0 ? 1.5 : 1;
  const stepMs = BASE_STEP_MS / (baseSpeed * adrenalineBoost);
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

// Returns true when a shield consumed the bite.
export function bite(p) {
  if (!p.alive) return false;
  if (p.shieldUp) {
    p.shieldUp = false;
    return true;
  }
  p.bites += 1;
  p.health -= 1;
  if (p.health <= 0) { p.alive = false; p.deathCause = "ant"; return false; }
  // Adrenaline triggers when bitten and survived.
  if (p.adrenaline) p.adrenalineMs = 2000;
  return false;
}
