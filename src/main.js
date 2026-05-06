import {
  TILE_W, TILE_H, TILE_Z,
  setRotation, getRotation,
  setCamera, getCamera,
  rotateWorld, project, sortKey,
  drawCube, drawGround, drawShadow, drawHumanoid, drawAnt, drawGrenade, drawExplosion, drawPickup,
  drawMine, drawBolt, drawDecoy,
} from "./iso.js";

import {
  W, L, H,
  makeWorld, generateCity, get, topAt, setWorldSize,
} from "./world.js";

import { initInput, isPressed, takeActions, rotateScreenDir, setInputEnabled } from "./input.js";
import { palette, THEMES, setActiveTheme, DEFAULT_THEME } from "./themes.js";
import * as ach from "./achievements.js";
import * as storage from "./storage.js";
import { showHud, hideHud, updateHud, toast, showOverlay, hideOverlay, setEndScreen } from "./hud.js";

import { makePlayer, tickPlayer, tryStep, playerRenderPos, isMoving as playerMoving, bite, walkPhase, heal } from "./entities/player.js";
import { playStep, playThrow, playExplosion, playBite, playPickup, playWin, playDeath, playTimerWarning, playPurchase, playShield, playPing } from "./audio.js";
import { makeHostage, tickHostage, hostageRenderPos, touchedBy, walkPhaseHostage } from "./entities/hostage.js";
import { makeAnt, tickAnt, antRenderPos, consumeBite, buildAntPath, pickAntType } from "./entities/ant.js";
import { makeGrenade, tickGrenade, applyBlast } from "./entities/grenade.js";
import { makePickup, applyPickup, pickupTouched, pickPickupType, PICKUP_TYPES } from "./entities/pickup.js";
import { makeMine, tickMine, detonate as detonateMine, applyMineBlast } from "./entities/mine.js";
import { makeBolt, tickBolt } from "./entities/bolt.js";
import { makeDecoy, tickDecoy } from "./entities/decoy.js";
import { bfsTo } from "./ai.js";
import * as skills from "./skills.js";

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
// timer / antInterval / maxAnts kept at original values (the user
// noted that level 1 is already the right difficulty). Difficulty
// progression now comes from enemy variety + map verticality.
//
// `grenades: 0` across all levels — players unlock grenades via the
// GRENADES skill branch (T1 "Grenade Pin" gives 1 starting grenade,
// repeat T2 "Quartermaster" stacks more). Same for mines and bolts.
const LEVELS = [
  // L0 — flat tutorial-ish: low scatter only, no maze, low set-pieces.
  { w: 40, l: 40, h: 6, timer: 180, grenades: 0, maxAnts: 18, antInterval: 4500, mazeLevel: 0.00,
    verticality: 0.0, setPieceMaxH: 1, setPieces: ["courtyard", "lshape", "zigzag"], pickupCount: 6 },
  { w: 44, l: 44, h: 6, timer: 210, grenades: 0, maxAnts: 21, antInterval: 4100, mazeLevel: 0.10,
    verticality: 0.25, setPieceMaxH: 2, setPieces: ["courtyard", "lshape", "zigzag", "staircase", "tower"], pickupCount: 7 },
  { w: 48, l: 48, h: 6, timer: 240, grenades: 0, maxAnts: 24, antInterval: 3800, mazeLevel: 0.22,
    verticality: 0.5, setPieceMaxH: 2, setPieces: ["courtyard", "lshape", "zigzag", "staircase", "tower", "bridge"], pickupCount: 8 },
  { w: 52, l: 52, h: 6, timer: 255, grenades: 0, maxAnts: 27, antInterval: 3400, mazeLevel: 0.38,
    verticality: 0.75, setPieceMaxH: 3, setPieces: ["courtyard", "lshape", "zigzag", "staircase", "tower", "bridge", "arch"], pickupCount: 9 },
  { w: 56, l: 56, h: 6, timer: 270, grenades: 0, maxAnts: 30, antInterval: 3000, mazeLevel: 0.54,
    verticality: 1.0, setPieceMaxH: 3, setPieces: ["courtyard", "lshape", "zigzag", "staircase", "tower", "bridge", "arch"], pickupCount: 10 },
  { w: 60, l: 60, h: 6, timer: 285, grenades: 0, maxAnts: 34, antInterval: 2600, mazeLevel: 0.70,
    verticality: 1.0, setPieceMaxH: 3, setPieces: ["courtyard", "lshape", "zigzag", "staircase", "tower", "bridge", "arch"], pickupCount: 11 },
  { w: 64, l: 64, h: 6, timer: 300, grenades: 0, maxAnts: 38, antInterval: 2200, mazeLevel: 0.88,
    verticality: 1.0, setPieceMaxH: 3, setPieces: ["courtyard", "lshape", "zigzag", "staircase", "tower", "bridge", "arch"], pickupCount: 12 },
];

// ------- Globals -------
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let world, spawnPlayer, spawnHostage, gaps, nests, pickups;
let player, hostage, ants, grenades, mines, bolts, decoys, explosions;
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
let runEarned = [];          // achievements earned this run, for endscreen
let runSpec = null;           // skill-applied options snapshot for the current run
let runCurrency = 0;          // currency earned this run (will be added to lifetime on endRun)
let runBreakdown = null;      // [["kills", n], ["pickups", n], ...] for endscreen
let runState = {              // run-scoped extras pickups read/write
  timerBonus: 0,              // TIME pickup: seconds added to timerSec
  mapRevealMs: 0,             // MAP pickup: how long the world is "lit" by the reveal
};

// Persisted currency total (lifetime). Helpers wrap localStorage so we can
// uniformly bump it from anywhere and emit currency_changed.
function loadCurrency() { return storage.load("currency", 0) | 0; }
function saveCurrency(v) { storage.save("currency", v | 0); }
function bumpCurrency(amount) {
  if (!amount) return loadCurrency();
  const next = loadCurrency() + amount;
  saveCurrency(next);
  ach.emit("currency_changed", { lifetime: next });
  return next;
}

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
  const earned = ach.ACHIEVEMENTS.filter(a => ach.isEarned(a.id)).length;
  const head = document.getElementById("ach-head");
  if (head) head.textContent = `Achievements (${earned}/${ach.ACHIEVEMENTS.length})`;
  for (const a of ach.ACHIEVEMENTS) {
    const li = document.createElement("li");
    const e = ach.isEarned(a.id);
    li.textContent = `${e ? "★" : "☆"} ${a.name} — ${a.desc}`;
    if (e) li.classList.add("earned");
    ul.appendChild(li);
  }
}

function refreshSkillTree() {
  const root = document.getElementById("skills-grid");
  if (!root) return;
  root.innerHTML = "";
  const cur = loadCurrency();
  const totalEl = document.getElementById("currency-total");
  if (totalEl) totalEl.textContent = `¤ ${cur}`;
  for (const branch of skills.BRANCHES) {
    const col = document.createElement("div");
    col.className = "skill-col";
    const head = document.createElement("h4");
    head.textContent = branch;
    col.appendChild(head);
    for (let tier = 1; tier <= 5; tier++) {
      const node = skills.SKILLS.find(s => s.branch === branch && s.tier === tier);
      if (!node) continue;
      const status = skills.statusFor(node, cur);
      const lvl = skills.getLevel(node.id);
      const isRepeatable = node.maxLevel > 1;
      const btn = document.createElement("button");
      btn.className = `skill-cell skill-${status}`;
      btn.disabled = status !== "available";
      const lvlBadge = isRepeatable && lvl > 0
        ? `<em>Lv.${lvl}${node.maxLevel < 99 ? "/" + node.maxLevel : ""}</em>`
        : "";
      btn.innerHTML = `<b>${node.name}</b> ${lvlBadge}<br><small>${node.desc}</small><br><span>¤ ${node.cost}</span>`;
      btn.title = `Tier ${tier}`;
      btn.addEventListener("click", () => {
        const before = loadCurrency();
        const r = skills.buySkill(node.id, before);
        if (!r.ok) return;
        saveCurrency(r.newCurrency);
        playPurchase();
        toast(`Skill bought: ${r.skill.name}${r.newLevel > 1 ? " Lv." + r.newLevel : ""}`);
        ach.emit("skill_bought", { id: r.skill.id, branch: r.skill.branch, tier: r.skill.tier });
        refreshSkillTree();
        refreshAchievementList();
        refreshThemePicker();
      });
      col.appendChild(btn);
    }
    root.appendChild(col);
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

  // Compute the run spec from skills (mutates a fresh opts object).
  runSpec = skills.buildSpec(cfg);
  // Apply the heal-on-start bonus.
  if (runSpec.healOnStart > 0) {
    runSpec.health = Math.min(runSpec.maxHealth, runSpec.health + runSpec.healOnStart);
  }

  world = makeWorld();
  const gen = generateCity(world, {
    mazeLevel: cfg.mazeLevel,
    verticality: cfg.verticality ?? 1.0,
    setPieces: cfg.setPieces,
    setPieceMaxH: cfg.setPieceMaxH ?? 3,
    pickupCount: cfg.pickupCount ?? 0,
    pickupTypeFor: () => pickPickupType(levelIdx),
  });
  spawnPlayer = gen.spawnPlayer;
  spawnHostage = gen.spawnHostage;
  gaps = gen.gaps;
  nests = gen.nests;
  pickups = (gen.pickups || []).map(p => makePickup({ x: p.x, y: p.y, z: p.z }, p.type));

  player = makePlayer(spawnPlayer, selectedChar(), {
    health: runSpec.health,
    maxHealth: runSpec.maxHealth,
    grenades: runSpec.grenades + (runSpec.grenadeStart || 0),
    mines: runSpec.mineStart || 0,
    bolts: runSpec.boltStart || 0,
    grenadeUnlocked: runSpec.grenadeUnlocked,
    mineUnlocked: runSpec.mineUnlocked,
    boltUnlocked: runSpec.boltUnlocked,
    decoyUnlocked: runSpec.decoyUnlocked,
    fallTolerance: runSpec.fallTolerance,
    walkSpeedMult: runSpec.walkSpeedMult,
    blastRadius: runSpec.blastRadius,
    mineRadius: runSpec.mineRadius,
    boltPierce: runSpec.boltPierce,
    boltStorm: runSpec.boltStorm,
    boltRicochet: runSpec.boltRicochet,
    stickyFrag: runSpec.stickyFrag,
    quickThrow: runSpec.quickThrow,
    tripWire: runSpec.tripWire,
    remoteDetonator: runSpec.remoteDetonator,
    adrenaline: runSpec.adrenaline,
    grapplingStep: runSpec.grapplingStep,
    mapVision: runSpec.mapVision,
  });
  hostage = makeHostage(spawnHostage);
  ants = [];
  grenades = [];
  mines = [];
  bolts = [];
  decoys = [];
  explosions = [];
  timerSec = TIMER_BUDGET;
  _lastTimerInt = TIMER_BUDGET + 1;
  pathPlayerCache = null;
  pathRebuildMs = 0;
  antSpawnMs = 1200;
  setRotation(0);
  _camSx = null; _camSy = null;
  ach.startRun();
  runEarned = [];
  runCurrency = 0;
  runBreakdown = { kills: 0, pickups: 0, rescue: 0, timeBonus: 0, achievements: 0, fail: 0 };
  runState.timerBonus = 0;
  runState.mapRevealMs = runSpec.exitRevealed ? Infinity : 0;

  // Apply Field Medic heal-on-start (also caps at maxHealth via player.heal).
  // Player already starts at runSpec.health which already includes it via
  // the spec computation; nothing extra to do here.

  // Reset per-level flags.
  player.grapplingUsed = false;

  if (levelIdx > 0) toast(`Level ${levelIdx + 1} — The city grows larger`);

  // Seed two ants total at the nests furthest from the player.
  const ranked = nests
    .map((n) => ({ n, d: Math.abs(n.x - player.x) + Math.abs(n.y - player.y) }))
    .sort((a, b) => b.d - a.d);
  for (const r of ranked.slice(0, 2)) {
    ants.push(makeAnt({ x: r.n.x, y: r.n.y, z: 0 }, pickAntType(currentLevel)));
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

  // 1. Emit run-end events FIRST so style achievements (untouched, pacifist,
  //    speedrun, all_levels, last_second, etc.) populate `runEarned` before
  //    we tally the achievement bonus.
  if (won) {
    const aliveScouts = ants.filter(a => a.alive && a.type === "SCOUT").length;
    ach.emit("hostage_rescued", {
      bites: player.bites,
      grenadesUsed: player.grenadesUsed,
      timeSec: TIMER_BUDGET - timerSec,
      timerRemaining: timerSec,
      startMaxHealth: runSpec ? runSpec.maxHealth : 1,
      scoutsAlive: aliveScouts,
    });
    ach.emit("level_completed", {
      levelIdx: currentLevel,
      bites: player.bites,
      grenadesUsed: player.grenadesUsed,
      time: TIMER_BUDGET - timerSec,
    });
  }

  // 2. Currency from the run outcome (rescue / fail consolation).
  if (won) {
    const rescueBonus = 50 + Math.max(0, timerSec | 0);
    runBreakdown.rescue += rescueBonus;
    runCurrency += rescueBonus;
  } else {
    const failConsolation = 5;
    runBreakdown.fail += failConsolation;
    runCurrency += failConsolation;
  }
  // 3. Achievement bonuses — 25¤ for every achievement earned this run.
  const achBonus = runEarned.length * 25;
  runBreakdown.achievements += achBonus;
  runCurrency += achBonus;

  // 4. Persist lifetime currency. This may unlock currency-milestone
  //    achievements (penny / wealthy / magnate); they appear in runEarned via
  //    onEarn but don't retroactively affect achBonus.
  if (runCurrency) bumpCurrency(runCurrency);
  const deathCause = !won ? (player.health <= 0 ? (player.deathCause || "ant") : "time") : null;
  const breakdownArr = [
    ["Ant kills",     runBreakdown.kills],
    ["Pickups",       runBreakdown.pickups],
    won ? ["Rescue bonus", runBreakdown.rescue] : ["Run consolation", runBreakdown.fail],
    ["Achievements",  runBreakdown.achievements],
  ].filter(([, n]) => n > 0);
  setEndScreen({
    won,
    hasNext,
    levelNum: currentLevel + 1,
    loseTitle: deathCause ? LOSE_TITLES[deathCause] : null,
    detail: won
      ? `Time: ${TIMER_BUDGET - timerSec | 0}s · Bites: ${player.bites} · Grenades: ${player.grenadesUsed}`
      : pick(DEATH_MSGS[deathCause]),
    achievementsEarned: runEarned,
    currencyBreakdown: breakdownArr,
    currencyTotal: loadCurrency(),
  });
  // Refresh title-screen UI so when player goes back, currency/skills update.
  refreshSkillTree();
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
    else if (a === "mine")    placeMine();
    else if (a === "bolt")    fireBolt();
    else if (a === "decoy")   dropDecoy();
    else if (a === "grapple") grappleStep();
    else if (a === "map")     toggleMap();
  }
}

function throwGrenade() {
  if (!player.grenadeUnlocked) { toast("Grenades locked — buy Grenade Pin"); return; }
  if (player.grenades <= 0) return;
  player.grenades -= 1;
  player.grenadesUsed += 1;
  grenades.push(makeGrenade(player));
  playThrow();
}

function placeMine() {
  if (!player.mineUnlocked) { toast("Mines locked — buy Mine Layer"); return; }
  // Remote Detonator: a re-press detonates every armed mine instantly.
  if (player.remoteDetonator && mines.some(m => m.state === "armed")) {
    for (const m of mines) detonateMine(m);
    playPing();
    return;
  }
  if (player.mines <= 0) return;
  // No two mines on the same tile.
  if (mines.some(m => m.state === "armed" && m.x === player.x && m.y === player.y && m.z === player.z)) return;
  player.mines -= 1;
  player.minesPlaced += 1;
  mines.push(makeMine({ x: player.x, y: player.y, z: player.z }));
  playPing();
}

function fireBolt() {
  if (!player.boltUnlocked) { toast("Bolts locked — buy Crossbow"); return; }
  if (player.bolts <= 0) return;
  player.bolts -= 1;
  player.boltsFired += 1;
  // Bolt Storm: fire 3 in a perpendicular spread.
  if (player.boltStorm) {
    const f = player.facing || { dx: 1, dy: 0 };
    const perp = { dx: -f.dy, dy: f.dx };
    bolts.push(makeBolt(player, { ox: player.x,           oy: player.y,           oz: player.z, pierce: player.boltPierce, ricochet: player.boltRicochet }));
    bolts.push(makeBolt(player, { ox: player.x + perp.dx, oy: player.y + perp.dy, oz: player.z, pierce: player.boltPierce, ricochet: player.boltRicochet }));
    bolts.push(makeBolt(player, { ox: player.x - perp.dx, oy: player.y - perp.dy, oz: player.z, pierce: player.boltPierce, ricochet: player.boltRicochet }));
  } else {
    bolts.push(makeBolt(player, { pierce: player.boltPierce, ricochet: player.boltRicochet }));
  }
  playThrow();
}

function dropDecoy() {
  if (!player.decoyUnlocked) { toast("Decoy locked — buy Decoy"); return; }
  // Only one decoy active at a time.
  if (decoys.some(d => d.state === "active")) return;
  decoys.push(makeDecoy({ x: player.x, y: player.y, z: player.z }));
  playPing();
  toast("Decoy active — ants distracted for 5s");
}

function grappleStep() {
  if (!player.grapplingStep) return;
  if (player.grapplingUsed) { toast("Grappling Step already used this level"); return; }
  if (playerMoving(player)) return;
  const f = player.facing || { dx: 0, dy: 1 };
  const antAt = (x, y, z) => ants.some(a => a.alive && a.x === x && a.y === y && a.z === z);
  if (tryStep(player, world, f.dx, f.dy, antAt, true)) {
    player.grapplingUsed = true;
    playPing();
  }
}

function toggleMap() {
  if (!player.mapVision) {
    toast("Map Vision locked — buy in Explorer tier 5");
    return;
  }
  player.mapVisionOn = !player.mapVisionOn;
}

function handleHeldMovement() {
  if (playerMoving(player)) return;
  const antAt = (x, y, z) => ants.some(a => a.alive &&
    a.x === x && a.y === y && a.z === z);
  for (const a of ["up", "down", "left", "right"]) {
    if (isPressed(a)) {
      const [dx, dy] = rotateScreenDir(a, getRotation());
      const beforeZ = player.z;
      if (tryStep(player, world, dx, dy, antAt)) {
        playStep();
        const drop = beforeZ - player.tz;
        if (drop >= 2) ach.emit("fall_survived", { drop });
        return;
      }
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
  refreshSkillTree();
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
  const hostageOcc = (x, y, z) => ants.some(a => a.alive &&
    ((a.x === x && a.y === y && a.z === z) ||
     (a.tx === x && a.ty === y && a.tz === z)));
  tickHostage(hostage, world, player, dtMs, pathPlayerCache, hostageOcc);

  // Pickup collection — each pickup checked against the player's tile.
  for (const pk of pickups) {
    if (pk.collected) continue;
    if (pickupTouched(pk, player)) {
      const result = applyPickup(pk, player, runState);
      if (!result) continue;
      const def = PICKUP_TYPES[pk.type];
      // Currency from pickup itself (COIN/GEM) — plus a flat 5/pickup tracking fee.
      const flatPickupReward = 5;
      const fromType = result.currency || 0;
      const total = flatPickupReward + fromType;
      runBreakdown.pickups += total;
      runCurrency += total;
      // Sound: SHIELD has its own sound; everything else uses the soft ping.
      if (pk.type === "SHIELD") playShield();
      else if (pk.type === "HEALTH") playPickup();
      else playPing();
      toast(`${def.name}: ${def.desc}`);
      ach.emit("pickup_collected", { type: pk.type });
    }
  }
  // Apply TIME pickup bonus to the timer.
  if (runState.timerBonus > 0) {
    timerSec += runState.timerBonus;
    runState.timerBonus = 0;
  }
  // Decay MAP pickup reveal.
  if (runState.mapRevealMs > 0 && runState.mapRevealMs !== Infinity) {
    runState.mapRevealMs -= dtMs;
    if (runState.mapRevealMs < 0) runState.mapRevealMs = 0;
  }

  // Decoys — tick down their timers.
  for (const d of decoys) tickDecoy(d, dtMs);
  decoys = decoys.filter(d => d.state !== "done");

  // Ants — periodically rebuild shared BFS path. If a decoy is active the
  // ants pathfind to the decoy instead of the player; this is what lets
  // Decoy actually divert the swarm.
  pathRebuildMs -= dtMs;
  if (pathRebuildMs <= 0) {
    const activeDecoy = decoys.find(d => d.state === "active");
    const target = activeDecoy || player;
    pathPlayerCache = bfsTo(world, target.x, target.y);
    pathRebuildMs = 250;
  }
  for (const a of ants) {
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
      const absorbed = bite(player);
      if (absorbed) {
        playShield();
        toast("Shield absorbed bite!");
      } else {
        playBite();
        flashCanvasShake();
      }
    }
  }

  // Grenades + explosions
  for (const g of grenades) {
    const wasFlying = g.state === "flying";
    tickGrenade(g, dtMs, { stickyFrag: !!(runSpec && runSpec.stickyFrag) }, ants);
    if (wasFlying && g.state === "exploding") {
      playExplosion();
      const radius = runSpec ? runSpec.blastRadius : 1;
      const { kills } = applyBlast(g, ants, radius);
      if (kills > 0) ach.emit("multi_kill", { count: kills });
    }
  }
  // Mines
  for (const m of mines) {
    const wasArmed = m.state === "armed";
    tickMine(m, dtMs, ants, { tripWire: !!(runSpec && runSpec.tripWire) });
    if (wasArmed && m.state === "exploding") {
      playExplosion();
      const radius = runSpec ? runSpec.mineRadius : 1;
      const { kills } = applyMineBlast(m, ants, radius);
      if (kills > 0) ach.emit("multi_kill", { count: kills });
    }
  }
  mines = mines.filter(m => m.state !== "done");
  // Bolts
  for (const b of bolts) {
    const killed = tickBolt(b, dtMs, world, ants);
    if (killed.length > 0) ach.emit("multi_kill", { count: killed.length });
  }
  bolts = bolts.filter(b => b.state !== "done");
  // Per-tick kill bookkeeping — picks up any dead-and-unprocessed ants from
  // this frame's blasts (regardless of which grenade did the killing).
  for (const a of ants) {
    if (!a.alive && !a._countedKill) {
      a._countedKill = true;
      runBreakdown.kills += 1;
      runCurrency += 1;
      ach.emit("ant_killed", { type: a.type });
    }
  }
  grenades = grenades.filter((g) => g.state !== "done");
  ants = ants.filter((a) => a.alive);

  antSpawnMs -= dtMs;
  if (antSpawnMs <= 0) {
    antSpawnMs = ANT_SPAWN_INTERVAL_MS;
    if (ants.length < MAX_ANTS) {
      const n = nests[Math.floor(Math.random() * nests.length)];
      if (n) ants.push(makeAnt({ x: n.x, y: n.y, z: 0 }, pickAntType(currentLevel)));
    }
  }

  // Win check.
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

  // Timer warning beeps.
  const timerInt = timerSec | 0;
  if (timerInt !== _lastTimerInt) {
    _lastTimerInt = timerInt;
    if (timerInt === 30 || timerInt === 20 || timerInt < 10) playTimerWarning();
  }

  // Smooth camera.
  const pr = playerRenderPos(player);
  const [rx, ry] = rotateWorld(pr.rx, pr.ry, W, L);
  setCamera(0, 0);
  const [psx, psy] = project(rx, ry, pr.rz);
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  const tgX = cw / 2 - psx, tgY = ch / 2 - psy;
  if (_camSx === null) { _camSx = tgX; _camSy = tgY; }
  const alpha = 1 - Math.exp(-7 * dtMs / 1000);
  _camSx += (tgX - _camSx) * alpha;
  _camSy += (tgY - _camSy) * alpha;
  setCamera(_camSx, _camSy);

  updateHud({ timerSec, player, hostage, level: currentLevel + 1, currency: loadCurrency() });
}

let _shake = 0;
function flashCanvasShake() { _shake = 6; }

let _camSx = null, _camSy = null;

// ------- Render -------
function render() {
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  const p = palette();

  if (!world) {
    const grad0 = ctx.createLinearGradient(0, 0, 0, ch);
    grad0.addColorStop(0, p.sky[0]);
    grad0.addColorStop(1, p.sky[1]);
    ctx.fillStyle = grad0;
    ctx.fillRect(0, 0, cw, ch);
    return;
  }

  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, p.sky[0]);
  grad.addColorStop(1, p.sky[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);

  let shakeX = 0, shakeY = 0;
  if (_shake > 0) {
    shakeX = (Math.random() * 2 - 1) * _shake;
    shakeY = (Math.random() * 2 - 1) * _shake;
    _shake -= 0.6;
    const cam = getCamera();
    setCamera(cam.x + shakeX, cam.y + shakeY);
  }

  const list = [];
  const rot = getRotation();
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < L; y++) {
      const top = topAt(world, x, y);
      const [rx, ry] = rotateWorld(x, y, W, L);
      if (!get(world, x, y, 0)) {
        const shadowed = top > 0;
        list.push({ key: sortKey(rx, ry, 0) - 0.5, kind: "ground", rx, ry, shadowed });
      }
      const { rnx, rny, lnx, lny } = faceNeighbours(x, y, rot);
      const rightNeighTop = safeTopAt(world, rnx, rny);
      const leftNeighTop  = safeTopAt(world, lnx, lny);
      const { blnx, blny, brnx, brny } = backNeighbours(x, y, rot);
      const backLeftNeighTop  = safeTopAt(world, blnx, blny);
      const backRightNeighTop = safeTopAt(world, brnx, brny);
      for (let z = 0; z < top; z++) {
        const v = get(world, x, y, z);
        if (!v) continue;
        const rightShadow = rightNeighTop > z + 1;
        const leftShadow  = leftNeighTop  > z + 1;
        const isTopFace = !get(world, x, y, z + 1);
        const backLeftStep  = isTopFace && backLeftNeighTop  < z + 1;
        const backRightStep = isTopFace && backRightNeighTop < z + 1;
        list.push({ key: sortKey(rx, ry, z), kind: "cube", rx, ry, z, blockType: v,
          rightShadow, leftShadow, backLeftStep, backRightStep });
      }
    }
  }

  // Pickups
  for (const pk of pickups) {
    if (pk.collected) continue;
    const [rx, ry] = rotateWorld(pk.x, pk.y, W, L);
    list.push({ key: sortKey(rx, ry, pk.z) + 0.3, kind: "pickup", rx, ry, rz: pk.z, pk });
  }
  // Hostage
  {
    const h = hostageRenderPos(hostage);
    const [rx, ry] = rotateWorld(h.rx, h.ry, W, L);
    list.push({ key: sortKey(rx, ry, h.rz) + 0.5, kind: "hostage", rx, ry, rz: h.rz });
  }
  {
    const pp = playerRenderPos(player);
    const [rx, ry] = rotateWorld(pp.rx, pp.ry, W, L);
    list.push({ key: sortKey(rx, ry, pp.rz) + 0.6, kind: "player", rx, ry, rz: pp.rz });
  }
  for (const a of ants) {
    const ar = antRenderPos(a);
    const [rx, ry] = rotateWorld(ar.rx, ar.ry, W, L);
    list.push({ key: sortKey(rx, ry, ar.rz) + 0.4, kind: "ant", rx, ry, rz: ar.rz, ant: a });
  }
  for (const g of grenades) {
    const [rx, ry] = rotateWorld(g.rx, g.ry, W, L);
    list.push({ key: sortKey(rx, ry, g.rz) + 0.7, kind: "grenade", rx, ry, rz: g.rz, g });
  }
  for (const m of mines) {
    const [rx, ry] = rotateWorld(m.x, m.y, W, L);
    list.push({ key: sortKey(rx, ry, m.z) + 0.25, kind: "mine", rx, ry, rz: m.z, m });
  }
  for (const d of decoys) {
    if (d.state !== "active") continue;
    const [rx, ry] = rotateWorld(d.x, d.y, W, L);
    list.push({ key: sortKey(rx, ry, d.z) + 0.45, kind: "decoy", rx, ry, rz: d.z, d });
  }
  for (const b of bolts) {
    const [rx, ry] = rotateWorld(b.rx, b.ry, W, L);
    list.push({ key: sortKey(rx, ry, b.rz) + 0.55, kind: "bolt", rx, ry, rz: b.rz, b });
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
      drawAnt(ctx, sx, sy, frame, { legacy: !!p.legacyChar, type: item.ant.type });
    } else if (item.kind === "pickup") {
      const [sx, sy] = project(item.rx, item.ry, item.rz);
      const phase = ((performance.now() - (item.pk.bornAt || 0)) / 800) % 1;
      drawPickup(ctx, sx, sy, item.pk.type, phase);
    } else if (item.kind === "grenade") {
      const [sx, sy] = project(item.rx, item.ry, item.rz);
      if (item.g.state === "flying") drawGrenade(ctx, sx, sy);
      else if (item.g.state === "exploding") drawExplosion(ctx, sx, sy, item.g.expT);
    } else if (item.kind === "mine") {
      const [sx, sy] = project(item.rx, item.ry, item.rz);
      drawMine(ctx, sx, sy, item.m.state, item.m.expT);
    } else if (item.kind === "decoy") {
      const [sx, sy] = project(item.rx, item.ry, item.rz);
      drawDecoy(ctx, sx, sy, Math.max(0, item.d.ttl / 5000));
    } else if (item.kind === "bolt") {
      const [sx, sy] = project(item.rx, item.ry, item.rz);
      drawBolt(ctx, sx, sy, item.b.dx, item.b.dy);
    }
  }

  // Compass arrow
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
      arrowColor = p.uiAccent;
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
        const s = Math.min(scaleX, scaleY);
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

  // Vignette / fog edge — softened during MAP pickup reveal.
  const reveal = runState && runState.mapRevealMs > 0 ? 0.6 : 0;
  const vg = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * (0.45 + reveal * 0.4), cw / 2, ch / 2, Math.min(cw, ch) * 0.85);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, p.fog);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, cw, ch);

  // Minimap (Map Vision skill — Tab toggles it).
  if (player && player.mapVisionOn) {
    const cellSize = Math.max(3, Math.floor(280 / Math.max(W, L)));
    const mw = W * cellSize, mh = L * cellSize;
    const mx = cw - mw - 16, my = 16;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
    ctx.strokeStyle = p.uiAccent || "#fff";
    ctx.lineWidth = 1;
    ctx.strokeRect(mx - 4, my - 4, mw + 8, mh + 8);
    // tile heights
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < L; y++) {
        const t = topAt(world, x, y);
        if (t === 0) continue;
        const v = Math.min(1, t / 4);
        ctx.fillStyle = `rgba(255,255,255,${0.12 + v * 0.28})`;
        ctx.fillRect(mx + x * cellSize, my + y * cellSize, cellSize, cellSize);
      }
    }
    // exit gaps
    if (gaps) {
      ctx.fillStyle = p.uiAccent || "#7df";
      for (const g of gaps) {
        ctx.fillRect(mx + g.x * cellSize - 1, my + g.y * cellSize - 1, cellSize + 2, cellSize + 2);
      }
    }
    // ants
    ctx.fillStyle = "#ff5566";
    for (const a of ants) {
      ctx.fillRect(mx + a.x * cellSize, my + a.y * cellSize, cellSize, cellSize);
    }
    // hostage
    ctx.fillStyle = p.hostage || "#ffaa00";
    ctx.fillRect(mx + hostage.x * cellSize - 1, my + hostage.y * cellSize - 1, cellSize + 2, cellSize + 2);
    // player
    ctx.fillStyle = p.player || "#ffffff";
    ctx.fillRect(mx + player.x * cellSize - 1, my + player.y * cellSize - 1, cellSize + 2, cellSize + 2);
    ctx.restore();
  }
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
  refreshSkillTree();
  bindCharPick();

  ach.initAchievements({
    onEarn: (a) => {
      runEarned.push(a.name);
      toast(`★ ${a.name} unlocked`);
      refreshAchievementList();
      refreshThemePicker();
      refreshSkillTree(); // theme_collector / new theme unlocks may affect things
    },
  });

  document.getElementById("start").addEventListener("click", () => startRun(0));
  document.getElementById("again").addEventListener("click", () => {
    hideOverlay("endscreen");
    showOverlay("title");
    refreshThemePicker();
    refreshAchievementList();
    refreshSkillTree();
    mode = "title";
  });
  document.getElementById("next-level").addEventListener("click", () => {
    hideOverlay("endscreen");
    startRun(currentLevel + 1);
  });

  setActiveTheme(DEFAULT_THEME);
  mode = "title";
  showOverlay("title");
  requestAnimationFrame(frame);
}
boot();
