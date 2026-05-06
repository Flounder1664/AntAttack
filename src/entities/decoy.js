// Decoy — pheromone trap placed by the player. While active, ants pathfind
// to the decoy instead of the player. Lifespan: 5 seconds.

const TTL_MS = 5000;

export function makeDecoy(spawn) {
  return {
    kind: "decoy",
    x: spawn.x, y: spawn.y, z: spawn.z,
    ttl: TTL_MS,
    state: "active",   // active | done
  };
}

export function tickDecoy(d, dtMs) {
  if (d.state !== "active") return;
  d.ttl -= dtMs;
  if (d.ttl <= 0) d.state = "done";
}
