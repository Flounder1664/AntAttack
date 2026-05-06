// Grenade: thrown in the player's facing direction. Travels in a parabolic
// arc over `flightMs`, lands, then briefly explodes. The blast damages any
// ant within Manhattan radius (1 by default; +1 with Heavy Charge) in (x,y)
// and within ±1 in z.

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
    rx: ox, ry: oy, rz: oz,
  };
}

// `opts.stickyFrag` — when true, the grenade gently steers its impact target
// toward the nearest ant within 2 tiles of where it was about to land.
export function tickGrenade(g, dtMs, opts = {}, ants = null) {
  const { stickyFrag = false } = opts;
  if (g.state === "flying") {
    g.t += dtMs / FLIGHT_MS;
    if (g.t >= 1) {
      g.t = 1;
      g.state = "exploding";
      g.expT = 0;
    }
    // Sticky Frag — bias the impact toward the closest live ant within 2
    // tiles of the current straight-line target. Effect grows during flight.
    if (stickyFrag && ants && g.t < 1) {
      let best = null, bestD = 999;
      for (const a of ants) {
        if (!a.alive) continue;
        const d = Math.abs(a.x - g.tx) + Math.abs(a.y - g.ty);
        if (d < bestD) { bestD = d; best = a; }
      }
      if (best && bestD <= 2) {
        // Pull the target by a fraction proportional to dt.
        const pull = Math.min(1, dtMs / 250);
        g.tx += (best.x - g.tx) * pull;
        g.ty += (best.y - g.ty) * pull;
      }
    }
    const u = g.t;
    g.rx = g.ox + (g.tx - g.ox) * u;
    g.ry = g.oy + (g.ty - g.oy) * u;
    g.rz = g.oz + 2.2 * 4 * u * (1 - u);
  } else if (g.state === "exploding") {
    g.expT += dtMs / EXPLOSION_MS;
    if (g.expT >= 1) g.state = "done";
  }
}

// Resolve the blast: damage ants in range. Called once when state transitions
// to exploding (main loop checks `g._didBlast`). Returns { kills, hits }.
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
