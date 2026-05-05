import {
  TILE_W, TILE_H, TILE_Z,
  setRotation, getRotation,
  setCamera, getCamera,
  rotateWorld, project, sortKey,
  drawCube, drawGround, drawShadow, drawHumanoid, drawAnt, drawGrenade, drawExplosion,
} from "./iso.js";

import {
  W, L, H,
  makeWorld, generateCity, get, topAt, setWorldSize,
} from "./world.js";

import { initInput, isPressed, takeActions, rotateScreenDir, setInputEnabled } from "./input.js";
import { palette, THEMES, setActiveTheme, DEFAULT_THEME } from "./themes.js";
import * as ach from "./achievements.js";
import { showHud, hideHud, updateHud, toast, showOverlay, hideOverlay, setEndScreen } from "./hud.js";

import { makePlayer, tickPlayer, tryStep, playerRenderPos, isMoving as playerMoving, bite, walkPhase } from "./entities/player.js";
import { playStep, playThrow, playExplosion, playBite, playPickup, playWin, playDeath, playTimerWarning } from "./audio.js";
import { makeHostage, tickHostage, hostageRenderPos, touchedBy, walkPhaseHostage } from "./entities/hostage.js";
import { makeAnt, tickAnt, antRenderPos, consumeBite, buildAntPath } from "./entities/ant.js";
import { makeGrenade, tickGrenade, applyBlast } from "./entities/grenade.js";

// ------- Death flavour text -------
const DEATH_MSGS = {
  ant: [
    "The colony was hungry. You volunteered.",
    "Six legs, zero mercy.",
    "Consumed. The hostage mourns alone.",
    "The ants have been expecting you.",
    "Every ant in Antescher had a nibble.",
    "The swarm was patient. You were not.",
    "You were lunch. And second lunch.",
    "The mandibles send their regards.",
    "Antescher has a no-survivor policy.",
  ],
  fall: [
    "Gravity: still operational.",
    "The ground rose up to greet you. Enthusiastically.",
    "Antescher is not designed for the vertically adventurous.",
    "Some ledges are decorative. You found one the hard way.",
    "A bold descent. A brief one.",
    "The hostage watched in silence from above.",
    "You stepped off the edge. It didn't step back.",
    "Physics was not on your side today.",
    "The city is full of last steps. You found yours.",
  ],
  time: [
    "Time ran out. Antescher claims another.",
    "The city outlasted you. It always does.",
    "Too slow. The ants will find the hostage eventually.",
    "Antescher is eternal. You, less so.",
    "The clock was never on your side.",
    "Another name scratched into the walls.",
    "The sand ran out. So did you.",
    "The hostage is still in there. Still waiting.",
    "Unhurried. Unsuccessful.",
  ],
};
const LOSE_TITLES = { ant: "DEVOURED", fall: "SPLATTERED", time: "TOO SLOW" };
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ------- Rotation-aware face-neighbour lookup -------
// FACE_ADJ: world offsets for the front (viewer-facing) right and left columns.
//   r=0: right=(x+1,y)  left=(x,y+1)
//   r=1: right=(x,y+1)  left=(x-1,y)
//   r=2: right=(x-1,y)  left=(x,y-1)
//   r=3: right=(x,y-1)  left=(x+1,y)
//
// BACK_ADJ: world offsets for the back (away-from-viewer) edges.
//   back-left  = direction of the top-left  edge of the top rhombus (−rx direction in rotated frame)
//   back-right = direction of the top-right edge of the top rhombus (−ry direction in rotated frame)
//   = exactly −FACE_ADJ (negated element-wise)
const FACE_ADJ = [
  [[1, 0], [0, 1]],   // r=0
  [[0, 1], [-1, 0]],  // r=1
  [[-1, 0], [0, -1]], // r=2
  [[0, -1], [1, 0]],  // r=3
];
const BACK_ADJ = [
  [[-1, 0], [0, -1]], // r=0
  [[0, -1], [1, 0]],  // r=1
  [[1, 0], [0, 1]],   // r=2
  [[0, 1], [-1, 0]],  // r=3
];
function faceNeighbours(x, y, rot) {
  const [[rdx, rdy], [ldx, ldy]] = FACE_ADJ[rot];
  return { rnx: x + rdx, rny: y + rdy, lnx: x + ldx, lny: y + ldy };
}
function backNeighbours(x, y, rot) {
  const [[bldx, bldy], [brdx, brdy]] = BACK_ADJ[rot];
  return { blnx: x + bldx, blny: y + bldy, brnx: x + brdx, brny: y + brdy };
}
function safeTopAt(world, nx, ny) {
  if (nx < 0 || nx >= W || ny < 0 || ny >= L) return 0;
  return topAt(world, nx, ny);
}

// ------- Level configs -------
const LEVELS = [
  { w: 40, l: 40, h: 6, timer: 180, grenades: 8, maxAnts: 18, antInterval: 4500, mazeLevel: 0.00 },
  { w: 44, l: 44, h: 6, timer: 210, grenades: 8, maxAnts: 21, antInterval: 4100, mazeLevel: 0.10 },
  { w: 48, l: 48, h: 6, timer: 240, grenades: 8, maxAnts: 24, antInterval: 3800, mazeLevel: 0.22 },
  { w: 52, l: 52, h: 6, timer: 255, grenades: 7, maxAnts: 27, antInterval: 3400, mazeLevel: 0.38 },
  { w: 56, l: 56, h: 6, timer: 270, grenades: 6, maxAnts: 30, antInterval: 3000, mazeLevel: 0.54 },
  { w: 60, l: 60, h: 6, timer: 285, grenades: 6, maxAnts: 34, antInterval: 2600, mazeLevel: 0.70 },
  { w: 64, l: 64, h: 6, timer: 300, grenades: 5, maxAnts: 38, antInterval: 2200, mazeLevel: 0.88 },
];

// ------- Globals -------
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let world, spawnPlayer, spawnHostage, gaps, nests;
let player, hostage, ants, grenades, explosions;
let mode = "title"; // title | playing | paused | end
let lastT = 0;
let timerSec = 0;
let _lastTimerInt = -1; // for timer-warning beeps
let pathPlayerCache = null;
let pathRebuildMs = 0;
let ANT_SPAWN_INTERVAL_MS = LEVELS[0].antInterval;
let MAX_ANTS = LEVELS[0].maxAnts;
let antSpawnMs = 0;
let TIMER_BUDGET = LEVELS[0].timer;
let currentLevel = 0;
let runEarned = []; // achievements earned this run, for endscreen

// Resize canvas for crisp DPR-aware rendering and to fill the viewport.
function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", fitCanvas);

// ------- Title / theme picker -------
function refreshThemePicker() {
  const root = document.getElementById("theme-pick");
  root.innerHTML = "";
  for (const id of Object.keys(THEMES)) {
    const t = THEMES[id];
    const btn = document.createElement("button");
    btn.className = "pick";
    btn.dataset.theme = id;
    const unlocked = ach.isThemeUnlocked(id);
    btn.disabled = !unlocked;
    btn.textContent = unlocked ? t.name : `${t.name} (locked)`;
    if (id === DEFAULT_THEME) btn.classList.add("selected");
    btn.addEventListener("click", () => {
      if (!unlocked) return;
      for (const b of root.children) b.classList.remove("selected");
      btn.classList.add("selected");
      setActiveTheme(id);
    });
    root.appendChild(btn);
  }
}

function refreshAchievementList() {
  const ul = document.getElementById("ach-ul");
  ul.innerHTML = "";
  for (const a of ach.ACHIEVEMENTS) {
    const li = document.createElement("li");
    const earned = ach.isEarned(a.id);
    li.textContent = `${earned ? "★" : "☆"} ${a.name} — ${a.desc}`;
    if (earned) li.classList.add("earned");
    ul.appendChild(li);
  }
}

function bindCharPick() {
  const root = document.getElementById("char-pick");
  for (const btn of root.children) {
    btn.addEventListener("click", () => {
      for (const b of root.children) b.classList.remove("selected");
      btn.classList.add("selected");
    });
  }
}
function selectedChar() {
  return document.querySelector("#char-pick .selected").dataset.char;
}

// ------- Game lifecycle -------
function startRun(levelIdx = 0) {
  currentLevel = levelIdx;
  const cfg = LEVELS[levelIdx];
  setWorldSize(cfg.w, cfg.l, cfg.h);
  ANT_SPAWN_INTERVAL_MS = cfg.antInterval;
  MAX_ANTS = cfg.maxAnts;
  TIMER_BUDGET = cfg.timer;

  world = makeWorld();
  const gen = generateCity(world, { mazeLevel: cfg.mazeLevel });
  spawnPlayer = gen.spawnPlayer;
  spawnHostage = gen.spawnHostage;
  gaps = gen.gaps;
  nests = gen.nests;

  player = makePlayer(spawnPlayer, selectedChar());
  player.grenades = cfg.grenades;
  hostage = makeHostage(spawnHostage);
  ants = [];
  grenades = [];
  explosions = [];
  timerSec = TIMER_BUDGET;
  _lastTimerInt = TIMER_BUDGET + 1; // prevent false trigger on first frame
  pathPlayerCache = null;
  pathRebuildMs = 0;
  antSpawnMs = 1200;
  setRotation(0);
  _camSx = null; _camSy = null; // will snap to player on first frame
  ach.startRun();
  runEarned = [];

  if (levelIdx > 0) toast(`Level ${levelIdx + 1} — The city grows larger`);

  // seed two ants total at the nests furthest from the player so the
  // opening seconds aren't an instant death.
  const ranked = nests
    .map((n) => ({ n, d: Math.abs(n.x - player.x) + Math.abs(n.y - player.y) }))
    .sort((a, b) => b.d - a.d);
  for (const r of ranked.slice(0, 2)) {
    ants.push(makeAnt({ x: r.n.x, y: r.n.y, z: 0 }));
  }

  hideOverlay("title");
  hideOverlay("endscreen");
  hideOverlay("pause");
  showHud();
  setInputEnabled(true);
  mode = "playing";
}

function endRun(won) {
  mode = "end";
  const hasNext = won && currentLevel < LEVELS.length - 1;
  setInputEnabled(false);
  hideHud();
  if (won) playWin(); else playDeath();
  if (won) {
    ach.emit("hostage_rescued", {
      bites: player.bites,
      grenadesUsed: player.grenadesUsed,
      timeSec: TIMER_BUDGET - timerSec,
    });
  }
  const deathCause = !won ? (player.health <= 0 ? (player.deathCause || "ant") : "time") : null;
  setEndScreen({
    won,
    hasNext,
    levelNum: currentLevel + 1,
    loseTitle: deathCause ? LOSE_TITLES[deathCause] : null,
    detail: won
      ? `Time: ${TIMER_BUDGET - timerSec | 0}s · Bites: ${player.bites} · Grenades: ${player.grenadesUsed}`
      : pick(DEATH_MSGS[deathCause]),
    achievementsEarned: runEarned,
  });
}

// ------- Input handling -------
function handleEdgeActions() {
  for (const a of takeActions()) {
    if (mode === "paused") {
      if (a === "pause") resumeGame();
      continue;
    }
    if (mode !== "playing") continue;
    if (a === "pause") { pauseGame(); continue; }
    if (a === "rotL") setRotation(getRotation() + 3);
    else if (a === "rotR") setRotation(getRotation() + 1);
    else if (a === "grenade") throwGrenade();
  }
}

function throwGrenade() {
  if (player.grenades <= 0) return;
  player.grenades -= 1;
  player.grenadesUsed += 1;
  grenades.push(makeGrenade(player));
  playThrow();
}

function handleHeldMovement() {
  if (playerMoving(player)) return;
  // Block the player from stepping onto a tile currently occupied by an ant.
  const antAt = (x, y, z) => ants.some(a => a.alive &&
    a.x === x && a.y === y && a.z === z);
  for (const a of ["up", "down", "left", "right"]) {
    if (isPressed(a)) {
      const [dx, dy] = rotateScreenDir(a, getRotation());
      if (tryStep(player, world, dx, dy, antAt)) { playStep(); return; }
    }
  }
}

function pauseGame() {
  mode = "paused";
  showOverlay("pause");
}
function resumeGame() {
  hideOverlay("pause");
  mode = "playing";
}
document.getElementById("resume").addEventListener("click", resumeGame);
document.getElementById("quit").addEventListener("click", () => {
  hideOverlay("pause");
  hideHud();
  world = null;
  showOverlay("title");
  refreshThemePicker();
  refreshAchievementList();
  mode = "title";
});

// ------- Update -------
function update(dtMs) {
  handleEdgeActions();
  if (mode !== "playing") return;

  handleHeldMovement();
  const fallDmg = tickPlayer(player, dtMs);
  if (fallDmg > 0) {
    flashCanvasShake();
    toast(`Fell too far! −${fallDmg} health`);
  }

  // Hostage
  if (hostage.state === "idle" && touchedBy(hostage, player)) {
    hostage.state = "following";
    playPickup();
    toast("Hostage in tow — find a wall gap!");
  }
  // Hostage is blocked by any ant's current or reserved tile.
  const hostageOcc = (x, y, z) => ants.some(a => a.alive &&
    ((a.x === x && a.y === y && a.z === z) ||
     (a.tx === x && a.ty === y && a.tz === z)));
  tickHostage(hostage, world, player, dtMs, pathPlayerCache, hostageOcc);

  // Ants — periodically rebuild shared BFS path from player.
  pathRebuildMs -= dtMs;
  if (pathRebuildMs <= 0) {
    pathPlayerCache = buildAntPath(world, player);
    pathRebuildMs = 250;
  }
  for (const a of ants) {
    // Each ant is blocked by the player's current tile and every other ant's
    // current AND reserved (target) tile, preventing stacking.
    const antOcc = (x, y, z) => {
      if (player.x === x && player.y === y && player.z === z) return true;
      for (const b of ants) {
        if (b === a || !b.alive) continue;
        if (b.x === x && b.y === y && b.z === z) return true;
        if (b.tx === x && b.ty === y && b.tz === z) return true;
      }
      return false;
    };
    tickAnt(a, world, player, dtMs, pathPlayerCache, antOcc);
    if (consumeBite(a)) {
      playBite();
      bite(player);
      flashCanvasShake();
    }
  }

  // Grenades + explosions
  for (const g of grenades) {
    const wasFlying = g.state === "flying";
    tickGrenade(g, dtMs);
    if (wasFlying && g.state === "exploding") {
      playExplosion();
      const k = applyBlast(g, ants);
      for (let i = 0; i < k; i++) ach.emit("ant_killed", {});
    }
  }
  grenades = grenades.filter((g) => g.state !== "done");

  // Cull dead ants after a short delay so blasts feel impactful.
  ants = ants.filter((a) => a.alive);

  // Spawn waves.
  antSpawnMs -= dtMs;
  if (antSpawnMs <= 0) {
    antSpawnMs = ANT_SPAWN_INTERVAL_MS;
    if (ants.length < MAX_ANTS) {
      const n = nests[Math.floor(Math.random() * nests.length)];
      if (n) ants.push(makeAnt({ x: n.x, y: n.y, z: 0 }));
    }
  }

  // Win check: player is at a gap in the wall ring AND the hostage is close
  // enough to have genuinely been escorted out (not left behind deep inside).
  if (hostage.state === "following") {
    const onRing = player.x === 0 || player.x === W - 1 || player.y === 0 || player.y === L - 1;
    const dist = Math.abs(hostage.x - player.x) + Math.abs(hostage.y - player.y);
    if (onRing && dist <= 3) {
      hostage.state = "rescued";
      endRun(true);
      return;
    }
  }

  // Lose checks.
  if (!player.alive) { endRun(false); return; }
  timerSec -= dtMs / 1000;
  if (timerSec <= 0) { timerSec = 0; endRun(false); return; }

  // Timer warning beeps: at 30 s, 20 s, and every second below 10 s.
  const timerInt = timerSec | 0;
  if (timerInt !== _lastTimerInt) {
    _lastTimerInt = timerInt;
    if (timerInt === 30 || timerInt === 20 || timerInt < 10) playTimerWarning();
  }

  // Smooth camera — lerps toward the player's TILE position (not interpolated),
  // giving a flowing pan while the character itself snaps grid-to-grid.
  const pr = playerRenderPos(player);
  const [rx, ry] = rotateWorld(pr.rx, pr.ry, W, L);
  setCamera(0, 0);
  const [psx, psy] = project(rx, ry, pr.rz);
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  const tgX = cw / 2 - psx, tgY = ch / 2 - psy;
  if (_camSx === null) { _camSx = tgX; _camSy = tgY; } // snap on first frame
  const alpha = 1 - Math.exp(-7 * dtMs / 1000);        // dt-independent lerp
  _camSx += (tgX - _camSx) * alpha;
  _camSy += (tgY - _camSy) * alpha;
  setCamera(_camSx, _camSy);

  updateHud({ timerSec, player, hostage, level: currentLevel + 1 });
}

let _shake = 0;
function flashCanvasShake() { _shake = 6; }

// Smoothed camera — initialised to null so the first frame snaps instantly.
let _camSx = null, _camSy = null;

// ------- Render -------
function render() {
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  const p = palette();

  if (!world) {
    // Title-screen state: just paint the sky and bail.
    const grad0 = ctx.createLinearGradient(0, 0, 0, ch);
    grad0.addColorStop(0, p.sky[0]);
    grad0.addColorStop(1, p.sky[1]);
    ctx.fillStyle = grad0;
    ctx.fillRect(0, 0, cw, ch);
    return;
  }

  // Sky gradient.
  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, p.sky[0]);
  grad.addColorStop(1, p.sky[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);

  // Optional camera shake on damage.
  let shakeX = 0, shakeY = 0;
  if (_shake > 0) {
    shakeX = (Math.random() * 2 - 1) * _shake;
    shakeY = (Math.random() * 2 - 1) * _shake;
    _shake -= 0.6;
    const cam = getCamera();
    setCamera(cam.x + shakeX, cam.y + shakeY);
  }

  // Build draw list — cubes + entities — then sort by paint order.
  const list = [];

  const rot = getRotation();
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < L; y++) {
      const top = topAt(world, x, y);
      const [rx, ry] = rotateWorld(x, y, W, L);
      // Draw a ground tile whenever z=0 is open (bare ground OR under an overhang).
      // shadowed=true when blocks exist above z=0 (bridge deck, arch lintel, etc.)
      // so the ground beneath reads as darker — the block's cast shadow.
      if (!get(world, x, y, 0)) {
        const shadowed = top > 0;
        list.push({ key: sortKey(rx, ry, 0) - 0.5, kind: "ground", rx, ry, shadowed });
      }
      // Pre-compute face neighbours for shadow tinting (front faces) and
      // back-edge ledge shadows (back faces, invisible from camera).
      const { rnx, rny, lnx, lny } = faceNeighbours(x, y, rot);
      const rightNeighTop = safeTopAt(world, rnx, rny);
      const leftNeighTop  = safeTopAt(world, lnx, lny);
      const { blnx, blny, brnx, brny } = backNeighbours(x, y, rot);
      const backLeftNeighTop  = safeTopAt(world, blnx, blny);
      const backRightNeighTop = safeTopAt(world, brnx, brny);
      for (let z = 0; z < top; z++) {
        const v = get(world, x, y, z);
        if (!v) continue;
        // Front-face shadow tint: darken when a taller block is immediately adjacent.
        const rightShadow = rightNeighTop > z + 1;
        const leftShadow  = leftNeighTop  > z + 1;
        // Back-edge ledge shadow: only on the topmost exposed face, only where
        // the back neighbour is lower (step-down away from camera). The renderer
        // draws a gradient strip extending outward from those edges so the
        // height change is visible even with no wall face from this angle.
        const isTopFace = !get(world, x, y, z + 1);
        const backLeftStep  = isTopFace && backLeftNeighTop  < z + 1;
        const backRightStep = isTopFace && backRightNeighTop < z + 1;
        list.push({ key: sortKey(rx, ry, z), kind: "cube", rx, ry, z, blockType: v,
          rightShadow, leftShadow, backLeftStep, backRightStep });
      }
    }
  }

  // Hostage
  {
    const h = hostageRenderPos(hostage);
    const [rx, ry] = rotateWorld(h.rx, h.ry, W, L);
    list.push({ key: sortKey(rx, ry, h.rz) + 0.5, kind: "hostage", rx, ry, rz: h.rz });
  }
  // Player
  {
    const pp = playerRenderPos(player);
    const [rx, ry] = rotateWorld(pp.rx, pp.ry, W, L);
    list.push({ key: sortKey(rx, ry, pp.rz) + 0.6, kind: "player", rx, ry, rz: pp.rz });
  }
  // Ants
  for (const a of ants) {
    const ar = antRenderPos(a);
    const [rx, ry] = rotateWorld(ar.rx, ar.ry, W, L);
    list.push({ key: sortKey(rx, ry, ar.rz) + 0.4, kind: "ant", rx, ry, rz: ar.rz, ant: a });
  }
  // Grenades + explosions
  for (const g of grenades) {
    const [rx, ry] = rotateWorld(g.rx, g.ry, W, L);
    list.push({ key: sortKey(rx, ry, g.rz) + 0.7, kind: "grenade", rx, ry, rz: g.rz, g });
  }

  list.sort((a, b) => a.key - b.key);

  for (const item of list) {
    if (item.kind === "ground") {
      drawGround(ctx, item.rx, item.ry, item.shadowed);
    } else if (item.kind === "cube") {
      drawCube(ctx, item.rx, item.ry, item.z, item.blockType === 2 ? "wall" : "block",
        { rightShadow: item.rightShadow, leftShadow: item.leftShadow,
          backLeftStep: item.backLeftStep, backRightStep: item.backRightStep });
    } else if (item.kind === "player") {
      const [sx, sy] = project(item.rx, item.ry, item.rz);
      drawShadow(ctx, item.rx, item.ry, item.rz);
      drawHumanoid(ctx, sx, sy, {
        primary: player.character === "girl" ? p.hostage : p.player,
        secondary: p.playerAlt,
        outline: p.cubeOutline,
        moving: playerMoving(player),
        phase: walkPhase(player),
        legacy: !!p.legacyChar,
      });
    } else if (item.kind === "hostage") {
      const [sx, sy] = project(item.rx, item.ry, item.rz);
      drawShadow(ctx, item.rx, item.ry, item.rz);
      drawHumanoid(ctx, sx, sy, {
        primary: p.hostage,
        secondary: p.playerAlt,
        outline: p.cubeOutline,
        moving: hostage.x !== hostage.tx || hostage.y !== hostage.ty,
        phase: walkPhaseHostage(hostage),
        legacy: !!p.legacyChar,
      });
      // Pulsing beacon above the hostage so they're visible in the city
      if (hostage.state === "idle") {
        const pulse = 0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 350));
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.fillStyle = p.hostage;
        ctx.beginPath();
        ctx.arc(sx, sy - 36, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = p.cubeOutline || "#000";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
    } else if (item.kind === "ant") {
      const [sx, sy] = project(item.rx, item.ry, item.rz);
      drawShadow(ctx, item.rx, item.ry, item.rz, 0.8);
      const frame = ((performance.now() / 80) | 0);
      drawAnt(ctx, sx, sy, frame, { legacy: !!p.legacyChar });
    } else if (item.kind === "grenade") {
      const [sx, sy] = project(item.rx, item.ry, item.rz);
      if (item.g.state === "flying") drawGrenade(ctx, sx, sy);
      else if (item.g.state === "exploding") drawExplosion(ctx, sx, sy, item.g.expT);
    }
  }

  // Compass arrow: toward hostage when idle, toward the exit gap when escorting.
  {
    let arrowSx = null, arrowSy = null, arrowColor = p.hostage;
    if (hostage && hostage.state === "idle") {
      const hr = hostageRenderPos(hostage);
      const [hrx, hry] = rotateWorld(hr.rx, hr.ry, W, L);
      [arrowSx, arrowSy] = project(hrx, hry, hr.rz);
    } else if (hostage && hostage.state === "following" && gaps && gaps.length > 0) {
      const g = gaps[0];
      const [grx, gry] = rotateWorld(g.x, g.y, W, L);
      [arrowSx, arrowSy] = project(grx, gry, 0);
      arrowColor = p.uiAccent; // distinct colour so the player notices the switch
    }
    if (arrowSx !== null) {
      const dx = arrowSx - cw / 2;
      const dy = arrowSy - ch / 2;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 60) {
        const angle = Math.atan2(dy, dx);
        const margin = 32;
        const scaleX = (cw / 2 - margin) / Math.abs(dx || 1);
        const scaleY = (ch / 2 - margin) / Math.abs(dy || 1);
        const s = Math.min(scaleX, scaleY); // always clamp to screen edge
        const ax = cw / 2 + dx * s;
        const ay = ch / 2 + dy * s;
        const blink = Math.sin(performance.now() / 500) > 0;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(angle);
        ctx.globalAlpha = blink ? 1 : 0.6;
        ctx.fillStyle = arrowColor;
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-5, -5);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-5, 5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = p.cubeOutline || "#000";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }
  }

  // Vignette / fog edge.
  const vg = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.45, cw / 2, ch / 2, Math.min(cw, ch) * 0.85);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, p.fog);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, cw, ch);
}

// ------- Loop -------
function frame(t) {
  if (!lastT) lastT = t;
  const dt = Math.min(64, t - lastT);
  lastT = t;
  try {
    update(dt);
    render();
  } catch (err) {
    console.error("frame error", err);
  }
  requestAnimationFrame(frame);
}

// ------- Boot -------
function boot() {
  fitCanvas();
  initInput();
  refreshThemePicker();
  refreshAchievementList();
  bindCharPick();

  ach.initAchievements({
    onEarn: (a) => {
      runEarned.push(a.name);
      toast(`★ ${a.name} unlocked`);
      refreshAchievementList();
      refreshThemePicker();
    },
  });

  document.getElementById("start").addEventListener("click", () => startRun(0));
  document.getElementById("again").addEventListener("click", () => {
    hideOverlay("endscreen");
    showOverlay("title");
    refreshThemePicker();
    refreshAchievementList();
    mode = "title";
  });
  document.getElementById("next-level").addEventListener("click", () => {
    hideOverlay("endscreen");
    startRun(currentLevel + 1);
  });

  setActiveTheme(DEFAULT_THEME); // also pushes palette into CSS vars
  mode = "title";
  showOverlay("title");
  requestAnimationFrame(frame);
}
boot();
