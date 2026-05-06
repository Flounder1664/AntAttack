// Grenade: thrown in the player's facing direction. Travels in a parabolic
// arc over `flightMs`, lands, then briefly explodes. The blast kills any ants
// within Manhattan radius 1 in (x,y) and within ±1 in z.

const FLIGHT_MS = 700;
const RANGE_TILES = 4.5;
const EXPLOSION_MS = 380;

export function makeGrenade(player) {
  const ox = player.x, oy = player.y, oz = player.z;
  const f = player.facing || { dx: 0, dy: 1 };
  const tx = ox + f.dx * RANGE_TILES;
  const ty = oy + f.dy * RANGE_TILES;
  return {
    kind: "grenade",
    ox, oy, oz,
    tx, ty,
    t: 0,
    state: "flying", // flying | exploding | done
    expT: 0,
    rx: ox, ry: oy, rz: oz, // current world-space pos for rendering
  };
}

export function tickGrenade(g, dtMs) {
  if (g.state === "flying") {
    g.t += dtMs / FLIGHT_MS;
    if (g.t >= 1) {
      g.t = 1;
      g.state = "exploding";
      g.expT = 0;
    }
    const u = g.t;
    g.rx = g.ox + (g.tx - g.ox) * u;
    g.ry = g.oy + (g.ty - g.oy) * u;
    // arc height (peaks mid-flight)
    g.rz = g.oz + 2.2 * 4 * u * (1 - u);
  } else if (g.state === "exploding") {
    g.expT += dtMs / EXPLOSION_MS;
    if (g.expT >= 1) g.state = "done";
  }
}

// Resolve the blast: damage ants in range. Called once when state transitions
// to exploding (main loop checks `g._didBlast`).
//
// `radius` is the Manhattan radius in (x,y); MUNITIONS-Tier4 skill bumps it.
//
// Returns { kills, hits } so the caller can fire `multi_kill` only on actual
// kills while still tracking hits for sound/animation timing.
export function applyBlast(g, ants, radius = 1) {
  if (g._didBlast || g.state !== "exploding") return { kills: 0, hits: 0 };
  g._didBlast = true;
  let kills = 0;
  let hits = 0;
  for (const a of ants) {
    if (!a.alive) continue;
    const dx = Math.abs(a.x - Math.round(g.tx));
    const dy = Math.abs(a.y - Math.round(g.ty));
    const dz = Math.abs(a.z - Math.round(g.oz));
    if (dx + dy <= radius && dz <= 1) {
      hits += 1;
      a.hp = (a.hp || 1) - 1;
      if (a.hp <= 0) {
        a.alive = false;
        kills += 1;
      }
    }
  }
  return { kills, hits };
}
