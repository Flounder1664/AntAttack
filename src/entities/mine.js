// Mine — placed by the player on their current tile. Detonates when an ant
// walks onto it (or onto an adjacent tile if Trip Wire is owned).

const EXPLODE_MS = 380;

export function makeMine(spawn) {
  return {
    kind: "mine",
    x: spawn.x, y: spawn.y, z: spawn.z,
    state: "armed",     // armed | exploding | done
    expT: 0,
  };
}

export function tickMine(m, dtMs, ants, opts = {}) {
  const { tripWire = false } = opts;
  if (m.state === "armed") {
    const r = tripWire ? 1 : 0;  // detection radius in tiles
    for (const a of ants) {
      if (!a.alive) continue;
      const dx = Math.abs(a.x - m.x);
      const dy = Math.abs(a.y - m.y);
      if (dx + dy <= r && a.z === m.z) {
        m.state = "exploding";
        m.expT = 0;
        return;
      }
    }
  } else if (m.state === "exploding") {
    m.expT += dtMs / EXPLODE_MS;
    if (m.expT >= 1) m.state = "done";
  }
}

// Manually trigger the mine (Remote Detonator).
export function detonate(m) {
  if (m.state !== "armed") return;
  m.state = "exploding";
  m.expT = 0;
}

// Resolve the blast: damage ants in range. Mirrors grenade.applyBlast.
export function applyMineBlast(m, ants, radius = 1) {
  if (m._didBlast || m.state !== "exploding") return { kills: 0, hits: 0 };
  m._didBlast = true;
  let kills = 0, hits = 0;
  for (const a of ants) {
    if (!a.alive) continue;
    const dx = Math.abs(a.x - m.x);
    const dy = Math.abs(a.y - m.y);
    const dz = Math.abs(a.z - m.z);
    if (dx + dy <= radius && dz <= 1) {
      hits += 1;
      a.hp = (a.hp || 1) - 1;
      if (a.hp <= 0) { a.alive = false; kills += 1; }
    }
  }
  return { kills, hits };
}
