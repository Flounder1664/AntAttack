// Voxel city. (W × L × H) Uint8Array, indexed (x + y*W + z*W*L).
// 0 = empty. 1 = block. 2 = wall block. 3 = ant nest marker (ground only).

export let W = 40;
export let L = 40;
export let H = 6;

export function setWorldSize(w, l, h) { W = w; L = l; H = h; }

export function makeWorld() {
  const grid = new Uint8Array(W * L * H);
  return { grid, W, L, H };
}

const idx = (x, y, z) => x + y * W + z * W * L;

export function get(world, x, y, z) {
  if (x < 0 || x >= W || y < 0 || y >= L || z < 0 || z >= H) return 0;
  return world.grid[idx(x, y, z)];
}
export function set(world, x, y, z, v) {
  if (x < 0 || x >= W || y < 0 || y >= L || z < 0 || z >= H) return;
  world.grid[idx(x, y, z)] = v;
}

// Highest filled z+1 at column (x,y); 0 means the ground is exposed.
export function topAt(world, x, y) {
  for (let z = H - 1; z >= 0; z--) {
    if (get(world, x, y, z)) return z + 1;
  }
  return 0;
}

// Player collision height in voxel units.
// 1 = player only occupies their feet cell, so they fit under a 1-unit overhang
// (e.g. a bridge deck at z=1 leaves z=0 walkable beneath it).
const PLAYER_H = 1;

// Find every valid standing z in column (x,y): the cell at z must be empty for
// PLAYER_H units, and there must be a solid floor directly below (or z===0).
// Returns the position whose distance to preferredZ is smallest.
// preferredZ lets callers stay on whichever surface they're already on —
// ground-level walkers pass 0 and stay under a bridge; deck-level walkers
// pass their current z and stay on top.
export function feetAt(world, x, y, preferredZ = 0) {
  const valid = [];
  for (let z = 0; z < H; z++) {
    let fits = true;
    for (let dz = 0; dz < PLAYER_H; dz++) {
      if (get(world, x, y, z + dz)) { fits = false; break; }
    }
    if (!fits) continue;
    if (z === 0 || get(world, x, y, z - 1)) valid.push(z);
  }
  if (valid.length === 0) return topAt(world, x, y); // solid column — stand on top
  if (valid.length === 1) return valid[0];
  // Multiple surfaces: pick the one closest to where the caller already is.
  return valid.reduce((best, z) =>
    Math.abs(z - preferredZ) < Math.abs(best - preferredZ) ? z : best,
    valid[0]
  );
}

// Movement rule: can step from (ax,ay,fromZ) → (bx,by)?
// fromZ is the caller's current feet height; the target z is resolved with
// feetAt using fromZ as the preferred level, keeping entities on whichever
// surface they're already traversing.
export function canStep(world, ax, ay, bx, by, fromZ = null) {
  if (bx < 0 || bx >= W || by < 0 || by >= L) return false;
  const fa = fromZ !== null ? fromZ : feetAt(world, ax, ay);
  const fb = feetAt(world, bx, by, fa); // resolve target surface near fa
  if (Math.abs(fb - fa) > 1) return false;
  if (fb > fa) {
    // climbing: source column must be clear at fa so there's no overhang
    if (get(world, ax, ay, fa)) return false;
  }
  return true;
}

// Is the cell air at the player's eye height (used for overhang occlusion later).
export function isOpenAt(world, x, y, z) {
  return !get(world, x, y, z);
}

// Are (x,y) coords within the outer-wall border ring?
export function isOnWallRing(x, y, margin = 0) {
  return x === margin || x === W - 1 - margin || y === margin || y === L - 1 - margin;
}

// ── Architecture helpers ────────────────────────────────────────────────────
// Safe-set: skips out-of-bounds and wall-ring tiles when placing (v=1),
// but allows clearing (v=0) anywhere inside bounds.
function ss(world, x, y, z, v = 1) {
  if (x < 2 || x >= W - 2 || y < 2 || y >= L - 2 || z < 0 || z >= H) return;
  if (v && (isOnWallRing(x, y) || isOnWallRing(x, y, 1))) return;
  set(world, x, y, z, v);
}

// Arch/gateway: two 1×2 pillar stacks capped with a lintel row at height h.
// The opening between the pillars is explicitly cleared so it stays passable.
function spawnArch(world, x, y, horiz, span = 3, h = 3) {
  const end = span + 1;
  for (let z = 0; z < h; z++) {
    if (horiz) {
      ss(world, x, y, z); ss(world, x, y+1, z);
      ss(world, x+end, y, z); ss(world, x+end, y+1, z);
    } else {
      ss(world, x, y, z); ss(world, x+1, y, z);
      ss(world, x, y+end, z); ss(world, x+1, y+end, z);
    }
  }
  for (let k = 0; k <= end; k++) {
    if (horiz) { ss(world, x+k, y, h); ss(world, x+k, y+1, h); }
    else        { ss(world, x, y+k, h); ss(world, x+1, y+k, h); }
  }
  // Clear opening so nothing blocks the walkway
  for (let k = 1; k < end; k++) {
    for (let z = 0; z < h; z++) {
      if (horiz) { ss(world, x+k, y, z, 0); ss(world, x+k, y+1, z, 0); }
      else        { ss(world, x, y+k, z, 0); ss(world, x+1, y+k, z, 0); }
    }
  }
}

// Elevated bridge: 2-wide deck at z=1 (feetAt=2).
// Solid support columns at both ends; z=0 cleared under the middle span so
// the deck visually floats. Ramp blocks (z=0 only, feetAt=1) at both approaches
// let player/ants step ground(0) → ramp(1) → deck(2).
function spawnBridge(world, x, y, horiz, len = 8) {
  for (let k = 0; k < len; k++) {
    const isEnd = k === 0 || k === len - 1;
    for (let w = 0; w < 2; w++) {
      const bx = horiz ? x+k : x+w;
      const by = horiz ? y+w : y+k;
      if (isEnd) ss(world, bx, by, 0); else ss(world, bx, by, 0, 0);
      ss(world, bx, by, 1);
      for (let z = 2; z < H; z++) ss(world, bx, by, z, 0);
    }
  }
  for (let w = 0; w < 2; w++) {
    if (horiz) { ss(world, x-1, y+w, 0); ss(world, x+len, y+w, 0); }
    else        { ss(world, x+w, y-1, 0); ss(world, x+w, y+len, 0); }
  }
}

// Tapering tower: size×size base rising h blocks, narrowing by 1 each layer.
function spawnTower(world, x, y, size = 3, h = 4) {
  for (let z = 0; z < h; z++) {
    const inset = Math.min(z, Math.floor((size - 1) / 2));
    for (let dx = inset; dx < size - inset; dx++)
      for (let dy = inset; dy < size - inset; dy++)
        ss(world, x+dx, y+dy, z);
  }
}

// Hollow courtyard: 2-high perimeter ring with one 2-tile gap entrance.
function spawnCourtyard(world, x, y, size = 6) {
  const gapSide = Math.floor(Math.random() * 4);
  const gapStart = 1 + Math.floor(Math.random() * Math.max(1, size - 3));
  for (let k = 0; k < size; k++) {
    const isGap = k >= gapStart && k <= gapStart + 1;
    for (let z = 0; z < 2; z++) {
      if (!(isGap && gapSide === 0)) ss(world, x+k, y,        z);
      if (!(isGap && gapSide === 1)) ss(world, x+k, y+size-1, z);
      if (!(isGap && gapSide === 2)) ss(world, x,        y+k, z);
      if (!(isGap && gapSide === 3)) ss(world, x+size-1, y+k, z);
    }
  }
}

// Accessible staircase: 2 tiles wide, rises one block per step.
function spawnStaircase(world, x, y, horiz, steps = 4) {
  for (let k = 0; k < steps; k++) {
    for (let w = 0; w < 2; w++) {
      const bx = horiz ? x+k : x+w;
      const by = horiz ? y+w : y+k;
      for (let z = 0; z <= k; z++) ss(world, bx, by, z);
    }
  }
}

// L-shaped building: 2 arms meeting at one corner, h blocks tall.
function spawnLShape(world, x, y, h = 2) {
  const a = 4 + Math.floor(Math.random() * 3);
  const b = 3 + Math.floor(Math.random() * 2);
  for (let z = 0; z < h; z++) {
    for (let k = 0; k < a; k++) { ss(world, x+k, y, z); ss(world, x+k, y+1, z); }
    for (let k = 2; k < 2+b; k++) { ss(world, x, y+k, z); ss(world, x+1, y+k, z); }
  }
}

// Zigzag wall: alternating 2-tile offsets create a jagged channel obstacle.
function spawnZigzag(world, x, y, horiz, zags = 3, h = 2) {
  for (let i = 0; i < zags; i++) {
    const off = (i % 2) * 2;
    for (let k = 0; k < 3; k++) {
      for (let z = 0; z < h; z++) {
        if (horiz) { ss(world, x+i*3+k, y+off, z); ss(world, x+i*3+k, y+off+1, z); }
        else        { ss(world, x+off, y+i*3+k, z); ss(world, x+off+1, y+i*3+k, z); }
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────

// Procedurally generate the city. Mutates `world`.
//
// Layout (inspired by the original Antescher):
//  - Square outer wall, 2 cubes high, with 3 gaps.
//  - Interior packed with stepped/ziggurat cube clusters of varying heights.
//  - A handful of ant-nest tiles scattered on the ground.
//  - Player spawn near a wall gap; hostage spawn deep inside, far from gaps.
//
// Returns { spawnPlayer, spawnHostage, gaps, nests, pickups }.
//
// `opts` may include:
//   mazeLevel       — corridor density (existing)
//   verticality     — 0..1 cap on cluster + corridor heights (NEW)
//   setPieces       — whitelist of allowed set-piece kinds (NEW)
//   setPieceMaxH    — cap on set-piece heights for that level (NEW)
//   pickupCount     — how many pickups to place (NEW)
//   pickupTypeFor() — function (slotIdx) → type string (NEW)
export function generateCity(world, opts = {}) {
  const {
    mazeLevel = 0,
    verticality = 1.0,
    setPieces = ["arch", "bridge", "tower", "courtyard", "staircase", "lshape", "zigzag"],
    setPieceMaxH = 3,
    pickupCount = 0,
    pickupTypeFor = null,
  } = opts;
  const { grid } = world;
  grid.fill(0);

  // --- Outer wall (2 high) on the border ring ---
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < L; y++) {
      if (isOnWallRing(x, y)) {
        set(world, x, y, 0, 2);
        set(world, x, y, 1, 2);
      }
    }
  }

  // --- Carve a single gap in the wall (one entrance = one exit) ---
  const gaps = [];
  const gapCount = 1;
  for (let i = 0; i < gapCount; i++) {
    const side = Math.floor(Math.random() * 4);
    const pos = 6 + Math.floor(Math.random() * (W - 12));
    const width = 2 + Math.floor(Math.random() * 2);
    let g = null;
    for (let k = 0; k < width; k++) {
      let gx, gy;
      if (side === 0) { gx = pos + k; gy = 0; }
      else if (side === 1) { gx = W - 1; gy = pos + k; }
      else if (side === 2) { gx = pos + k; gy = L - 1; }
      else { gx = 0; gy = pos + k; }
      set(world, gx, gy, 0, 0);
      set(world, gx, gy, 1, 0);
      if (!g) g = { x: gx, y: gy, side };
    }
    if (g) gaps.push(g);
  }

  // --- Interior structures ---
  // Scale cluster and loose-block counts with map area so larger levels feel equally dense.
  const areaScale = (W * L) / (40 * 40);
  const clusterCount = Math.round((14 + Math.floor(Math.random() * 9)) * areaScale);
  // Verticality cap: clamps cluster height. At verticality=0 (L0) all clusters
  // are 1 high; at 1.0 (L4+) the original 1–3 range applies.
  const maxClusterH = Math.max(1, Math.round(1 + 2 * verticality));
  for (let c = 0; c < clusterCount; c++) {
    const fw = 2 + Math.floor(Math.random() * 4); // footprint width
    const fl = 2 + Math.floor(Math.random() * 4);
    const fh = 1 + Math.floor(Math.random() * maxClusterH); // bounded by verticality
    const cx = 3 + Math.floor(Math.random() * (W - 6 - fw));
    const cy = 3 + Math.floor(Math.random() * (L - 6 - fl));

    const stepped = Math.random() < 0.6;
    for (let z = 0; z < fh; z++) {
      const inset = stepped ? z : 0;
      for (let dx = inset; dx < fw - inset; dx++) {
        for (let dy = inset; dy < fl - inset; dy++) {
          const x = cx + dx;
          const y = cy + dy;
          if (!isOnWallRing(x, y) && !isOnWallRing(x, y, 1)) {
            set(world, x, y, z, 1);
          }
        }
      }
    }
  }

  // A few standalone single cubes scattered around for cover.
  const looseCount = Math.round((18 + Math.floor(Math.random() * 12)) * areaScale);
  for (let i = 0; i < looseCount; i++) {
    const x = 2 + Math.floor(Math.random() * (W - 4));
    const y = 2 + Math.floor(Math.random() * (L - 4));
    if (isOnWallRing(x, y) || isOnWallRing(x, y, 1)) continue;
    if (topAt(world, x, y) === 0) {
      set(world, x, y, 0, 1);
    }
  }

  // --- Maze corridors (only on higher-maze-level runs) ---
  // Long 2-high wall segments create channels and funnel movement.
  // Multiplied by verticality so flat early levels skip them entirely.
  if (mazeLevel > 0 && verticality > 0.25) {
    const corridorCount = Math.round(mazeLevel * 28 * areaScale * verticality);
    for (let i = 0; i < corridorCount; i++) {
      const horiz = Math.random() < 0.5;
      const len = 5 + Math.floor(Math.random() * 9); // 5–13 tiles long
      const wallH = 2 + (Math.random() < mazeLevel * 0.4 ? 1 : 0); // 2 or 3 high
      const bx0 = 3 + Math.floor(Math.random() * (W - 6 - (horiz ? len : 1)));
      const by0 = 3 + Math.floor(Math.random() * (L - 6 - (horiz ? 1 : len)));
      const gapK = Math.floor(len / 2) + Math.floor(Math.random() * 3) - 1; // passage
      for (let k = 0; k < len; k++) {
        if (k === gapK) continue; // leave a one-tile gap so routes aren't sealed
        const bx = horiz ? bx0 + k : bx0;
        const by = horiz ? by0 : by0 + k;
        if (!isOnWallRing(bx, by) && !isOnWallRing(bx, by, 1)) {
          for (let z = 0; z < wallH; z++) set(world, bx, by, z, 1);
        }
      }
    }
  }

  // --- Architectural set-pieces ---
  // Placed after clusters/corridors so they stamp clean geometry on top.
  // Count scales gently with map area; the type list is restricted by the
  // level's `setPieces` whitelist, and heights are clamped by `setPieceMaxH`
  // so early levels still get set-pieces but render flat.
  {
    const count = Math.round((5 + Math.floor(Math.random() * 5)) * Math.sqrt(areaScale));
    const r = () => Math.random();
    const allowed = new Set(setPieces);
    const pickKind = () => {
      const order = ["arch", "bridge", "tower", "courtyard", "staircase", "lshape", "zigzag"];
      const choices = order.filter(k => allowed.has(k));
      return choices[Math.floor(r() * choices.length)] || "courtyard";
    };
    const cap = Math.max(1, setPieceMaxH);
    const clampH = (h) => Math.min(h, cap);
    for (let i = 0; i < count; i++) {
      const fx = 5 + Math.floor(r() * (W - 14));
      const fy = 5 + Math.floor(r() * (L - 14));
      const kind = pickKind();
      if      (kind === "arch")      spawnArch(world, fx, fy, r() < 0.5, clampH(2 + (r() < 0.4 ? 1 : 0)), Math.min(2, cap));
      else if (kind === "bridge")    spawnBridge(world, fx, fy, r() < 0.5, 6 + Math.floor(r() * 5));
      else if (kind === "tower")     spawnTower(world, fx, fy, clampH(2 + (r() < 0.5 ? 1 : 0)), 2 + Math.floor(r() * 2));
      else if (kind === "courtyard") spawnCourtyard(world, fx, fy, 5 + Math.floor(r() * 4));
      else if (kind === "staircase") spawnStaircase(world, fx, fy, r() < 0.5, clampH(3 + Math.floor(r() * 3)));
      else if (kind === "lshape")    spawnLShape(world, fx, fy, clampH(1 + Math.floor(r() * 2)));
      else                           spawnZigzag(world, fx, fy, r() < 0.5, clampH(2 + Math.floor(r() * 3)), Math.min(2, cap));
    }
  }

  // --- Ant nests (scaled with map size). ---
  const nests = [];
  const nestCount = Math.max(4, Math.round(4 * areaScale));
  for (let i = 0; i < nestCount; i++) {
    let x, y, tries = 30;
    do {
      x = 4 + Math.floor(Math.random() * (W - 8));
      y = 4 + Math.floor(Math.random() * (L - 8));
      tries--;
    } while (tries > 0 && topAt(world, x, y) !== 0);
    nests.push({ x, y });
  }

  // --- Player spawn: just inside the first gap. ---
  const g0 = gaps[0];
  let px = g0.x, py = g0.y;
  const inward = inwardFromGap(g0);
  px += inward.dx; py += inward.dy;
  // Ensure ground there.
  while (topAt(world, px, py) > 0) {
    set(world, px, py, topAt(world, px, py) - 1, 0);
  }
  const spawnPlayer = { x: px, y: py, z: 0 };

  // --- Hostage spawn: ground tile far from the gap AND far from the player. ---
  const MIN_HOSTAGE_DIST = 14; // Manhattan tiles from player spawn
  let best = null, bestScore = -1;
  for (let tries = 0; tries < 400; tries++) {
    const x = 4 + Math.floor(Math.random() * (W - 8));
    const y = 4 + Math.floor(Math.random() * (L - 8));
    if (topAt(world, x, y) > 0) continue;
    const playerDist = Math.abs(x - spawnPlayer.x) + Math.abs(y - spawnPlayer.y);
    if (playerDist < MIN_HOSTAGE_DIST) continue;
    let s = Infinity;
    for (const g of gaps) {
      const d = Math.abs(g.x - x) + Math.abs(g.y - y);
      if (d < s) s = d;
    }
    if (s > bestScore) { bestScore = s; best = { x, y, z: 0 }; }
  }
  let spawnHostage = best;
  if (!spawnHostage) {
    // Exhaustive fallback — scan for any open interior tile
    outer: for (let x = 5; x < W - 5; x++) {
      for (let y = 5; y < L - 5; y++) {
        if (!isOnWallRing(x, y) && topAt(world, x, y) === 0) {
          spawnHostage = { x, y, z: 0 };
          break outer;
        }
      }
    }
    if (!spawnHostage) {
      // Absolute last resort: clear the centre tile
      const cx = Math.floor(W / 2), cy = Math.floor(L / 2);
      for (let z = H - 1; z >= 0; z--) set(world, cx, cy, z, 0);
      spawnHostage = { x: cx, y: cy, z: 0 };
    }
  }

  // --- Pickups (after spawns are determined so we can keep distance). ---
  const pickups = [];
  if (pickupCount > 0 && pickupTypeFor) {
    for (let i = 0; i < pickupCount; i++) {
      let x, y, tries = 60;
      do {
        x = 4 + Math.floor(Math.random() * (W - 8));
        y = 4 + Math.floor(Math.random() * (L - 8));
        tries--;
      } while (
        tries > 0 && (
          topAt(world, x, y) !== 0
          || (Math.abs(x - spawnPlayer.x) + Math.abs(y - spawnPlayer.y)) < 4
          || (spawnHostage && Math.abs(x - spawnHostage.x) + Math.abs(y - spawnHostage.y) < 2)
          || pickups.some(p => p.x === x && p.y === y)
        )
      );
      if (tries > 0) {
        pickups.push({ x, y, z: 0, type: pickupTypeFor(i) });
      }
    }
  }

  return { spawnPlayer, spawnHostage, gaps, nests, pickups };
}

function inwardFromGap(g) {
  if (g.side === 0) return { dx: 0, dy: 1 };
  if (g.side === 1) return { dx: -1, dy: 0 };
  if (g.side === 2) return { dx: 0, dy: -1 };
  return { dx: 1, dy: 0 };
}
