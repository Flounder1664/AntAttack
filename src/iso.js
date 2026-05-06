// Isometric (2:1 dimetric) projection helpers and cube/sprite drawing.
//
// World coordinates: (x, y, z). x and y are tile coords on the ground plane;
// z is the height in unit cubes. The renderer applies one of four 90°
// rotations before projecting.

import { palette } from "./themes.js";

export const TILE_W = 160;    // top-face horizontal extent
export const TILE_H = 80;     // top-face vertical extent (half of W → 2:1 dimetric)
export const TILE_Z = 80;     // pixel height of one unit cube on screen

// Stipple (halftone) patterns for the monochrome Spectrum theme.
// Built once per context; light = ~25% black dots, heavy = 50% checker.
let _pat = null;
function stipples(ctx) {
  if (_pat) return _pat;
  const mk = (size, coords) => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const x = c.getContext("2d");
    x.clearRect(0, 0, size, size);
    x.fillStyle = "#000";
    for (const [px, py] of coords) x.fillRect(px, py, 1, 1);
    return ctx.createPattern(c, "repeat");
  };
  _pat = {
    light: mk(4, [[0, 0], [2, 2]]),      // 2/16 ≈ 12.5% — subtle shade
    heavy: mk(2, [[0, 0], [1, 1]]),      // 2/4  = 50%   — checker
  };
  return _pat;
}

// rotation: 0..3 — number of 90° CW rotations applied to the world before projecting.
let _rotation = 0;
export function setRotation(r) { _rotation = ((r % 4) + 4) % 4; }
export function getRotation() { return _rotation; }

// Camera offset (canvas-pixels added to projected screen coordinates).
let _camX = 0, _camY = 0;
export function setCamera(x, y) { _camX = x; _camY = y; }
export function getCamera() { return { x: _camX, y: _camY }; }

// Apply current rotation to world coords inside an enclosing W×L grid.
export function rotateWorld(x, y, W, L) {
  const r = _rotation;
  if (r === 0) return [x, y];
  if (r === 1) return [y, L - 1 - x];
  if (r === 2) return [W - 1 - x, L - 1 - y];
  return [W - 1 - y, x]; // r === 3
}

// World (already-rotated) → screen pixel.
export function project(x, y, z) {
  const sx = (x - y) * (TILE_W / 2) + _camX;
  const sy = (x + y) * (TILE_H / 2) - z * TILE_Z + _camY;
  return [sx, sy];
}

// World+rotation → screen pixel (convenience).
export function worldToScreen(x, y, z, W, L) {
  const [rx, ry] = rotateWorld(x, y, W, L);
  return project(rx, ry, z);
}

// Sort key for painter's algorithm in the rotated frame.
// z weight = 2 so a height step contributes the same sort influence
// as two horizontal steps, which is geometrically correct for our
// 2:1 dimetric projection (TILE_Z = TILE_H = 40).
export function sortKey(rx, ry, z) {
  return rx + ry + z * 2;
}

// Draw a single unit cube at voxel-cell index z (the cube occupies world
// height [z, z+1]). `kind` selects palette entries.
// opts.rightShadow / opts.leftShadow: when true, overlay a dark tint on
// the corresponding face to indicate it is in the shadow of a taller
// adjacent column — this visually separates height transitions and
// prevents adjacent blocks from looking merged.
// When the active palette has *Stipple keys the side faces are filled with
// a halftone overlay on top of the base colour, matching the ZX Spectrum look.
export function drawCube(ctx, rx, ry, z, kind = "block", opts = {}) {
  const { rightShadow = false, leftShadow = false,
          backLeftStep = false, backRightStep = false } = opts;
  const p = palette();
  const top   = kind === "wall" ? p.wallTop   : p.cubeTop;
  const left  = kind === "wall" ? p.wallLeft  : p.cubeLeft;
  const right = kind === "wall" ? p.wallRight : p.cubeRight;
  const leftSt  = kind === "wall" ? p.wallLeftStipple  : p.cubeLeftStipple;
  const rightSt = kind === "wall" ? p.wallRightStipple : p.cubeRightStipple;
  const outline = p.cubeOutline;
  const pats = (leftSt || rightSt) ? stipples(ctx) : null;

  const [cx, cy] = project(rx, ry, z + 1);
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;

  // Per-z brightness modulation — uses a single darkening overlay whose
  // alpha decreases with z. A white→white "brightening" overlay does nothing
  // (you can't brighten pure white), so we instead darken the lower tiers
  // and let higher tiers appear bright by comparison.
  //   z=0 → 16% black overlay (visibly darker)
  //   z=1 → 12%
  //   z=2 →  8%
  //   z=3 →  4%
  //   z≥4 →  0% (full base brightness)
  const baseDarken = 0.16;
  const zStep = 0.04;
  const zDarken = Math.max(0, baseDarken - z * zStep);

  // Helper: fill a path with the base colour, apply the z darkening tint
  // (so the base shifts), then overlay stipple texture and any shadow tint
  // on top of the modulated base.
  const fillFace = (path, color, stippleKey, shadowTint = false) => {
    ctx.beginPath();
    path();
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (zDarken > 0) {
      ctx.fillStyle = `rgba(0,0,0,${zDarken})`;
      ctx.fill();
    }
    if (stippleKey && pats) {
      ctx.fillStyle = pats[stippleKey];
      ctx.fill();
    }
    if (shadowTint) {
      ctx.fillStyle = "rgba(0,0,0,0.30)";
      ctx.fill();
    }
  };

  // Top face (rhombus) — always solid, no stipple or shadow tint.
  fillFace(() => {
    ctx.moveTo(cx,      cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx,      cy + hh);
    ctx.lineTo(cx - hw, cy);
  }, top, null, false);

  // Left face (screen-left direction)
  fillFace(() => {
    ctx.moveTo(cx - hw, cy);
    ctx.lineTo(cx,      cy + hh);
    ctx.lineTo(cx,      cy + hh + TILE_Z);
    ctx.lineTo(cx - hw, cy + TILE_Z);
  }, left, leftSt, leftShadow);

  // Right face (screen-right direction)
  fillFace(() => {
    ctx.moveTo(cx + hw, cy);
    ctx.lineTo(cx,      cy + hh);
    ctx.lineTo(cx,      cy + hh + TILE_Z);
    ctx.lineTo(cx + hw, cy + TILE_Z);
  }, right, rightSt, rightShadow);

  // Crisp outline along visible edges — scaled with tile size so the
  // 1-px Spectrum border doesn't disappear at larger tile scales.
  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(1, TILE_W / 54);
  ctx.beginPath();
  ctx.moveTo(cx,      cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx,      cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx,      cy + hh);
  ctx.lineTo(cx,      cy + hh + TILE_Z);
  ctx.moveTo(cx - hw, cy);
  ctx.lineTo(cx - hw, cy + TILE_Z);
  ctx.lineTo(cx,      cy + hh + TILE_Z);
  ctx.lineTo(cx + hw, cy + TILE_Z);
  ctx.lineTo(cx + hw, cy);
  ctx.stroke();

  // ── Back-edge ledge shadow (short perpendicular fade) ────────────────────
  // Clip to the relevant back quadrant, then fill with a gradient running
  // perpendicular to the edge that fades to zero within ~9% of TILE_W —
  // well before the clip's diagonal boundary, so no triangle shape is
  // visible. Inward normals: (±hh, hw)/|edge| ≈ (±0.447, +0.894).
  const sd = TILE_W * 0.085;             // shadow depth in CSS pixels
  const sdx = sd * 0.447;
  const sdy = sd * 0.894;
  if (backLeftStep) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx,      cy - hh);
    ctx.lineTo(cx - hw, cy);
    ctx.lineTo(cx,      cy);
    ctx.closePath();
    ctx.clip();
    const gL = ctx.createLinearGradient(
      cx - hw * 0.5,       cy - hh * 0.5,
      cx - hw * 0.5 + sdx, cy - hh * 0.5 + sdy
    );
    gL.addColorStop(0, "rgba(0,0,0,0.30)");
    gL.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gL;
    ctx.fillRect(cx - hw, cy - hh, hw, hh);
    ctx.restore();
  }
  if (backRightStep) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx,      cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx,      cy);
    ctx.closePath();
    ctx.clip();
    const gR = ctx.createLinearGradient(
      cx + hw * 0.5,       cy - hh * 0.5,
      cx + hw * 0.5 - sdx, cy - hh * 0.5 + sdy
    );
    gR.addColorStop(0, "rgba(0,0,0,0.30)");
    gR.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gR;
    ctx.fillRect(cx, cy - hh, hw, hh);
    ctx.restore();
  }
}

// Soft drop-shadow ellipse on the ground (or a rooftop) at world (rx,ry,z).
export function drawShadow(ctx, rx, ry, z, scale = 1) {
  const [cx, cy] = project(rx, ry, z);
  const p = palette();
  ctx.fillStyle = p.shadow;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, (TILE_W / 2) * 0.42 * scale, (TILE_H / 2) * 0.42 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Approximate humanoid sprite (player or hostage).
//
// `phase` (0..1, looping) drives a walking cycle: legs swing, body bobs.
// When idle pass phase = 0 and `moving = false` to use the still pose.
export function drawHumanoid(ctx, sx, sy, opts = {}) {
  const {
    primary = "#ffe47a",
    secondary = "#ffb56b",
    outline = "#000",
    phase = 0,
    moving = false,
    legacy = false,
  } = opts;

  if (legacy) {
    // ── Spectrum / pixel-art mode (faithful to the 1983 original) ─────────
    // Sandy White's sprites were 16×16 pixel monochrome silhouettes with a
    // distinctive lean stick-figure look: small 3-wide head, narrow torso,
    // arms visibly swung out from the shoulders, legs in a wide stride.
    // We snap to a "game pixel" grid scaled to TILE_W so the figure stays
    // proportional at every zoom level.
    const u = Math.max(2, Math.round(TILE_W / 30));   // 3 px at TILE_W=80, 4 px at TILE_W=120
    const bx = Math.round(sx / u) * u;
    const by = Math.round(sy / u) * u;
    const frame = moving ? (Math.floor(phase * 4) % 2) : 0;

    ctx.fillStyle = primary;

    // Head — 3u × 3u with single-pixel eye sockets.
    ctx.fillRect(bx - 1 * u, by - 14 * u, 3 * u, 3 * u);
    ctx.fillStyle = secondary;
    ctx.fillRect(bx - 1 * u, by - 13 * u, 1 * u, 1 * u);
    ctx.fillRect(bx + 1 * u, by - 13 * u, 1 * u, 1 * u);
    ctx.fillStyle = primary;

    // Neck — 1u stub linking head to shoulders.
    ctx.fillRect(bx, by - 11 * u, 1 * u, 1 * u);

    // Torso — 3u wide, 5u tall.
    ctx.fillRect(bx - 1 * u, by - 10 * u, 3 * u, 5 * u);

    // Arms — visibly swung out from the shoulders. Walking: one forward,
    // one back; idle: both hang down at the sides.
    if (!moving) {
      ctx.fillRect(bx - 2 * u, by - 10 * u, 1 * u, 5 * u);
      ctx.fillRect(bx + 2 * u, by - 10 * u, 1 * u, 5 * u);
    } else if (frame === 0) {
      // Left arm forward+down, right arm back+down
      ctx.fillRect(bx - 2 * u, by - 10 * u, 1 * u, 3 * u);
      ctx.fillRect(bx - 3 * u, by -  8 * u, 1 * u, 2 * u); // forward extend
      ctx.fillRect(bx + 2 * u, by -  9 * u, 1 * u, 4 * u);
    } else {
      ctx.fillRect(bx - 2 * u, by -  9 * u, 1 * u, 4 * u);
      ctx.fillRect(bx + 2 * u, by - 10 * u, 1 * u, 3 * u);
      ctx.fillRect(bx + 3 * u, by -  8 * u, 1 * u, 2 * u); // forward extend
    }

    // Legs — 1u wide, separated by a 1u gap. Walking strides one leg
    // straight back while the other swings forward (foot lifted off ground).
    if (!moving) {
      ctx.fillRect(bx - 1 * u, by - 5 * u, 1 * u, 5 * u);  // left leg
      ctx.fillRect(bx + 1 * u, by - 5 * u, 1 * u, 5 * u);  // right leg
      // Small feet
      ctx.fillRect(bx - 2 * u, by - 1 * u, 1 * u, 1 * u);
      ctx.fillRect(bx + 2 * u, by - 1 * u, 1 * u, 1 * u);
    } else if (frame === 0) {
      // Left leg back/planted, right leg forward
      ctx.fillRect(bx - 1 * u, by - 5 * u, 1 * u, 5 * u);
      ctx.fillRect(bx + 1 * u, by - 5 * u, 1 * u, 3 * u);
      ctx.fillRect(bx + 2 * u, by - 2 * u, 1 * u, 2 * u);  // right foot forward
      ctx.fillRect(bx - 2 * u, by - 1 * u, 1 * u, 1 * u);  // left foot
    } else {
      ctx.fillRect(bx - 1 * u, by - 5 * u, 1 * u, 3 * u);
      ctx.fillRect(bx - 2 * u, by - 2 * u, 1 * u, 2 * u);  // left foot forward
      ctx.fillRect(bx + 1 * u, by - 5 * u, 1 * u, 5 * u);
      ctx.fillRect(bx + 2 * u, by - 1 * u, 1 * u, 1 * u);  // right foot
    }

    return;
  }

  // ── Modern smooth mode ────────────────────────────────────────────────────
  // s scales the figure with the current zoom level (s=1 at TILE_W=80, 1.5 at 120)
  // and a +20% bump so characters read clearly against the larger blocks.
  const s = (TILE_W / 80) * 1.2;
  const w = 10 * s, h = 22 * s;

  const swing = moving ? Math.sin(phase * Math.PI * 2) : 0;
  const bob   = moving ? Math.abs(Math.sin(phase * Math.PI * 2)) * 1.2 * s : 0;
  const bodyY = sy - bob;

  const legA = (4 + swing * 3) * s;
  const legB = (-4 - swing * 3) * s;
  const legLen = (8 - Math.abs(swing) * 2) * s;

  ctx.fillStyle = secondary;
  ctx.fillRect(sx + legA - 1.5 * s, sy - legLen, 3 * s, legLen);
  ctx.fillRect(sx + legB - 1.5 * s, sy - legLen, 3 * s, legLen);

  ctx.fillStyle = primary;
  ctx.fillRect(sx - w / 2, bodyY - h, w, h - 8 * s);

  ctx.fillStyle = secondary;
  const armOff = swing * 1.5 * s;
  ctx.fillRect(sx - w / 2 - 1 * s, bodyY - h + 2 * s + armOff, 1.5 * s, 6 * s);
  ctx.fillRect(sx + w / 2 - 0.5 * s, bodyY - h + 2 * s - armOff, 1.5 * s, 6 * s);

  ctx.fillStyle = primary;
  ctx.fillRect(sx - 4 * s, bodyY - h - 6 * s, 8 * s, 6 * s);

  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(1, s);
  ctx.strokeRect(sx - w / 2 + 0.5, bodyY - h + 0.5, w - 1, h - 9 * s);
  ctx.strokeRect(sx - 3.5 * s, bodyY - h - 5.5 * s, 7 * s, 5 * s);
}

// Ant: low, six-legged silhouette with two glowing eyes.
// `legacy` switches to a chunky pixel-art rendering for the Spectrum theme.
// `type` ("WORKER" | "SOLDIER" | "SCOUT") scales the sprite and applies a
// distinguishing stripe (SOLDIER) or smaller silhouette (SCOUT).
export function drawAnt(ctx, sx, sy, frame = 0, opts = {}) {
  const { legacy = false, type = "WORKER" } = opts;
  const p = palette();
  const typeScale =
    type === "SOLDIER" ? 1.4 :
    type === "SCOUT"   ? 0.8 :
    1.0;

  if (legacy) {
    // ── Pixel-art ant ─────────────────────────────────────────────────────
    // Anatomy laid out left→right (rear→front) with proper ant features:
    //   abdomen — 4u rounded oval, sits at the back
    //   petiole — 1u "waist" pinch between abdomen and thorax
    //   thorax  — 3u wide, six bent legs attach here in three pairs
    //   neck    — 1u link
    //   head    — 3u rounded with red eyes and forked mandibles
    //   antennae— two elbowed segments rising and bending forward
    const u = Math.max(2, Math.round((TILE_W / 30) * typeScale));
    const bx = Math.round(sx / u) * u;
    const by = Math.round(sy / u) * u;
    const w = frame % 2;  // wiggle phase

    ctx.fillStyle = p.ant;

    // Abdomen — 4u wide × 4u tall, corners shaved for an oval silhouette.
    ctx.fillRect(bx - 9 * u, by - 4 * u, 4 * u, 4 * u);   // main body
    ctx.fillRect(bx - 8 * u, by - 5 * u, 2 * u, 1 * u);   // top curve
    ctx.fillRect(bx - 8 * u, by + 0 * u, 2 * u, 1 * u);   // bottom curve
    ctx.fillRect(bx - 10 * u, by - 3 * u, 1 * u, 2 * u);  // tapered tail

    // Petiole — single-pixel pinch between abdomen and thorax.
    ctx.fillRect(bx - 5 * u, by - 2 * u, 1 * u, 1 * u);

    // Thorax — 3u wide × 3u tall (legs attach here).
    ctx.fillRect(bx - 4 * u, by - 3 * u, 3 * u, 3 * u);

    // Neck — 1u link to the head.
    ctx.fillRect(bx - 1 * u, by - 2 * u, 1 * u, 1 * u);

    // Head — 3u wide × 3u tall, top corners shaved for roundness.
    ctx.fillRect(bx,         by - 3 * u, 3 * u, 3 * u);
    ctx.fillRect(bx + 1 * u, by - 4 * u, 1 * u, 1 * u);   // crown

    // Forked mandibles — two 1u prongs at the front.
    ctx.fillRect(bx + 3 * u, by - 3 * u, 1 * u, 1 * u);
    ctx.fillRect(bx + 3 * u, by - 1 * u, 1 * u, 1 * u);

    // Antennae — two elbowed pairs rising from the top of the head and
    // bending forward at the elbow. Distinctive ant feature.
    // Left antenna
    ctx.fillRect(bx,         by - 4 * u, 1 * u, 1 * u);   // base
    ctx.fillRect(bx,         by - 5 * u, 1 * u, 1 * u);   // first segment up
    ctx.fillRect(bx + 1 * u, by - 6 * u, 1 * u, 1 * u);   // elbow + tip forward
    // Right antenna
    ctx.fillRect(bx + 2 * u, by - 4 * u, 1 * u, 1 * u);   // base
    ctx.fillRect(bx + 2 * u, by - 5 * u, 1 * u, 1 * u);   // first segment up
    ctx.fillRect(bx + 3 * u, by - 6 * u, 1 * u, 1 * u);   // elbow + tip forward

    // Six legs (3 pairs from thorax) — bent insect legs that wiggle.
    for (let i = 0; i < 3; i++) {
      const lx = bx - 4 * u + i * 1 * u;          // attach along thorax
      const upWig = ((i + w) & 1) ? u : 0;
      const dnWig = ((i + w) & 1) ? 0 : u;
      // Top leg (out & up): joint at thorax, then bent tip up-left
      ctx.fillRect(lx,        by - 4 * u,         1 * u, 1 * u);
      ctx.fillRect(lx - 1 * u, by - 5 * u + upWig, 1 * u, 1 * u);
      // Bottom leg (out & down): joint at thorax, then bent tip down-left
      ctx.fillRect(lx,        by + 0 * u,         1 * u, 1 * u);
      ctx.fillRect(lx - 1 * u, by + 1 * u - dnWig, 1 * u, 1 * u);
    }

    // Glowing red eyes on the head.
    ctx.fillStyle = p.antEye;
    ctx.fillRect(bx + 1 * u, by - 2 * u, 1 * u, 1 * u);

    // SOLDIER — abdominal stripe so they're recognisably tougher.
    if (type === "SOLDIER") {
      ctx.fillStyle = p.antEye;
      ctx.fillRect(bx - 8 * u, by - 3 * u, 2 * u, 1 * u);
    }
    return;
  }

  // ── Smooth (non-legacy) mode ──────────────────────────────────────────
  // typeScale resizes via context — wrap in save/scale/restore.
  if (typeScale !== 1.0) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(typeScale, typeScale);
    ctx.translate(-sx, -sy);
  }
  ctx.fillStyle = p.ant;
  // body: head, thorax, abdomen
  ctx.beginPath();
  ctx.ellipse(sx + 6, sy - 6, 4, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(sx, sy - 6, 4, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(sx - 7, sy - 5, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // legs (animated)
  const off = (frame % 2) * 2 - 1;
  ctx.strokeStyle = p.ant;
  ctx.lineWidth = 1.4;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(sx + i * 4, sy - 5);
    ctx.lineTo(sx + i * 4 - 3, sy + (i % 2 ? off : -off));
    ctx.moveTo(sx + i * 4, sy - 5);
    ctx.lineTo(sx + i * 4 + 3, sy + (i % 2 ? -off : off));
    ctx.stroke();
  }

  // eyes
  ctx.fillStyle = p.antEye;
  ctx.fillRect(sx + 7, sy - 7, 1.5, 1.5);
  ctx.fillRect(sx + 4, sy - 7, 1.5, 1.5);

  if (typeScale !== 1.0) ctx.restore();
}

// Small grenade.
export function drawGrenade(ctx, sx, sy) {
  const p = palette();
  ctx.fillStyle = p.grenade;
  ctx.beginPath();
  ctx.arc(sx, sy - 3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.cubeOutline;
  ctx.fillRect(sx - 0.5, sy - 7, 1, 2);
}

// World pickup. Each type has a colour + glyph; we render a soft pulse
// around the icon so the player can spot pickups across the map.
// `phase` (0..1, looping) drives the pulse amplitude.
export function drawPickup(ctx, sx, sy, type, phase = 0) {
  const p = palette();
  const u = Math.max(2, Math.round(TILE_W / 30));
  const colors = {
    HEALTH:  "#ff5577",
    GRENADE: "#bbbb22",
    COIN:    "#ffd14b",
    GEM:     "#7df7ff",
    SHIELD:  "#88ddff",
    TIME:    "#dddddd",
    MAP:     "#9affae",
  };
  const c = colors[type] || "#ffffff";
  const cy = sy - u * 2; // hover slightly above ground

  // Pulse halo
  const pulse = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
  ctx.save();
  ctx.globalAlpha = 0.18 + 0.18 * pulse;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(sx, cy, u * (1.6 + 0.4 * pulse), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Outline / body
  ctx.fillStyle = c;
  ctx.strokeStyle = p.cubeOutline || "#000";
  ctx.lineWidth = Math.max(1, u / 3);

  // Type-specific glyph drawn from rectangles so it stays crisp at any scale.
  if (type === "HEALTH") {
    // red cross
    ctx.fillRect(sx - u * 1.5, cy - u * 0.5, u * 3, u * 1);
    ctx.fillRect(sx - u * 0.5, cy - u * 1.5, u * 1, u * 3);
    ctx.strokeRect(sx - u * 1.5, cy - u * 0.5, u * 3, u * 1);
    ctx.strokeRect(sx - u * 0.5, cy - u * 1.5, u * 1, u * 3);
  } else if (type === "GRENADE") {
    // small grenade-like circle with a stem
    ctx.beginPath();
    ctx.arc(sx, cy, u * 1.2, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = p.cubeOutline || "#000";
    ctx.fillRect(sx - u * 0.3, cy - u * 1.8, u * 0.6, u * 0.6);
  } else if (type === "COIN") {
    ctx.beginPath();
    ctx.arc(sx, cy, u * 1.0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  } else if (type === "GEM") {
    // diamond
    ctx.beginPath();
    ctx.moveTo(sx,             cy - u * 1.4);
    ctx.lineTo(sx + u * 1.0,   cy);
    ctx.lineTo(sx,             cy + u * 1.4);
    ctx.lineTo(sx - u * 1.0,   cy);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  } else if (type === "SHIELD") {
    // shield: ring + small bar
    ctx.beginPath();
    ctx.arc(sx, cy, u * 1.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(sx - u * 0.5, cy - u * 0.2, u * 1.0, u * 0.4);
  } else if (type === "TIME") {
    // hourglass: two triangles meeting at the centre
    ctx.beginPath();
    ctx.moveTo(sx - u * 1.0, cy - u * 1.2);
    ctx.lineTo(sx + u * 1.0, cy - u * 1.2);
    ctx.lineTo(sx,           cy);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx - u * 1.0, cy + u * 1.2);
    ctx.lineTo(sx + u * 1.0, cy + u * 1.2);
    ctx.lineTo(sx,           cy);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  } else if (type === "MAP") {
    // folded map: rectangle with a fold line
    ctx.fillRect(sx - u * 1.3, cy - u * 0.9, u * 2.6, u * 1.8);
    ctx.strokeRect(sx - u * 1.3, cy - u * 0.9, u * 2.6, u * 1.8);
    ctx.beginPath();
    ctx.moveTo(sx - u * 0.4, cy - u * 0.9);
    ctx.lineTo(sx - u * 0.4, cy + u * 0.9);
    ctx.moveTo(sx + u * 0.5, cy - u * 0.9);
    ctx.lineTo(sx + u * 0.5, cy + u * 0.9);
    ctx.stroke();
  }
}

// Flat ground rhombus — the top face of the ground plane at z=0.
// shadowed=true adds a semi-transparent dark overlay to simulate the shadow
// cast by an overhang (e.g. a bridge deck) directly above.
export function drawGround(ctx, rx, ry, shadowed = false) {
  const p = palette();
  const [cx, cy] = project(rx, ry, 0);
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;

  const rhombus = () => {
    ctx.beginPath();
    ctx.moveTo(cx,      cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx,      cy + hh);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();
  };

  rhombus();
  ctx.fillStyle = p.ground;
  ctx.fill();

  if (shadowed) {
    rhombus();
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.fill();
  }
}

// Expanding explosion ring.
export function drawExplosion(ctx, sx, sy, t) {
  const p = palette();
  const r = 4 + t * 28;
  ctx.strokeStyle = p.explosion;
  ctx.globalAlpha = Math.max(0, 1 - t);
  ctx.lineWidth = 3 * (1 - t);
  ctx.beginPath();
  ctx.arc(sx, sy - 6, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
