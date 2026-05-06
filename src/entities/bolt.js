// Bolt — straight-line projectile fired in the player's facing direction.
// Travels in a straight line until it hits an ant, the outer city wall, or
// runs out of range. Pierce lets it survive the first kill; Ricochet bounces
// it off the wall once. Bolt Storm fires three bolts in a perpendicular
// spread pattern.

import { W, L, get } from "../world.js";

const BOLT_TILES_PER_SEC = 22;        // base flight speed
const RANGE_TILES = 14;

export function makeBolt(player, opts = {}) {
  const { dx = 1, dy = 0 } = player.facing || {};
  const { ox = player.x, oy = player.y, oz = player.z, pierce = false, ricochet = false } = opts;
  return {
    kind: "bolt",
    ox, oy, oz,
    dx, dy,
    rx: ox, ry: oy, rz: oz,
    range: RANGE_TILES,
    distance: 0,
    state: "flying",     // flying | done
    pierceLeft: pierce ? 1 : 0,
    bouncesLeft: ricochet ? 1 : 0,
  };
}

// Tick a bolt forward by dtMs, checking ants/walls along the path.
// Returns the array of ants killed during this tick.
export function tickBolt(b, dtMs, world, ants) {
  if (b.state !== "flying") return [];
  const killed = [];
  const advance = (BOLT_TILES_PER_SEC * dtMs) / 1000;
  let remain = advance;
  // Substep so we don't skip tiles at high speeds.
  while (remain > 0 && b.state === "flying") {
    const step = Math.min(remain, 0.25);
    b.rx += b.dx * step;
    b.ry += b.dy * step;
    b.distance += step;
    remain -= step;

    // Out of range?
    if (b.distance >= b.range) { b.state = "done"; break; }

    // Tile coords for collision tests.
    const ix = Math.round(b.rx);
    const iy = Math.round(b.ry);

    // Hit world bounds?
    if (ix < 0 || ix >= W || iy < 0 || iy >= L) {
      if (b.bouncesLeft > 0) {
        b.bouncesLeft -= 1;
        // Reverse on whichever axis went out of bounds.
        if (ix < 0 || ix >= W) b.dx = -b.dx;
        if (iy < 0 || iy >= L) b.dy = -b.dy;
        // Pull back inside before continuing.
        b.rx = Math.max(0, Math.min(W - 1, b.rx));
        b.ry = Math.max(0, Math.min(L - 1, b.ry));
      } else {
        b.state = "done";
      }
      continue;
    }

    // Hit a wall block at the bolt's z?
    if (get(world, ix, iy, Math.round(b.oz))) {
      if (b.bouncesLeft > 0) {
        b.bouncesLeft -= 1;
        b.dx = -b.dx; b.dy = -b.dy;
      } else {
        b.state = "done";
      }
      continue;
    }

    // Hit an ant?
    let hit = null;
    for (const a of ants) {
      if (!a.alive) continue;
      if (a.x === ix && a.y === iy && Math.abs(a.z - b.oz) <= 1) {
        hit = a; break;
      }
    }
    if (hit) {
      hit.hp = (hit.hp || 1) - 1;
      if (hit.hp <= 0) { hit.alive = false; killed.push(hit); }
      if (b.pierceLeft > 0) {
        b.pierceLeft -= 1;
      } else {
        b.state = "done";
      }
    }
  }
  return killed;
}
