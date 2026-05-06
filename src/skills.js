// Skills tree — five branches × five tiers each.
//
// Storage shape: { skillId: levelOwned }. Level 0 = unowned.
// Most skills are single-purchase (maxLevel: 1). A few are repeatable
// (maxLevel: Infinity or a small cap) — buying again increments the level
// counter and the apply() function reads `lvl` to scale its effect.

import * as storage from "./storage.js";

const STORE_KEY = "skills.bought";

export const BRANCHES = ["VITALITY", "GRENADES", "MINES", "BOLTS", "EXPLORER"];

export const SKILLS = [
  // ── VITALITY ─────────────────────────────────────────────────────────────
  { id: "vit_1", branch: "VITALITY", tier: 1, name: "Hardy",         desc: "+1 max health",                   cost:  100, prereqs: [],          maxLevel: 1, apply: (s) => { s.maxHealth += 1; s.health += 1; } },
  { id: "vit_2", branch: "VITALITY", tier: 2, name: "Tough",         desc: "+1 max health",                   cost:  300, prereqs: ["vit_1"],   maxLevel: 1, apply: (s) => { s.maxHealth += 1; s.health += 1; } },
  { id: "vit_3", branch: "VITALITY", tier: 3, name: "Iron Skin",     desc: "+1 max health",                   cost:  800, prereqs: ["vit_2"],   maxLevel: 1, apply: (s) => { s.maxHealth += 1; s.health += 1; } },
  { id: "vit_4", branch: "VITALITY", tier: 4, name: "Field Medic",   desc: "Heal 1 on level start",           cost:  800, prereqs: ["vit_3"],   maxLevel: 1, apply: (s) => { s.healOnStart += 1; } },
  { id: "vit_5", branch: "VITALITY", tier: 5, name: "Adrenaline",    desc: "Speed burst when bitten",         cost: 1500, prereqs: ["vit_4"],   maxLevel: 1, apply: (s) => { s.adrenaline = true; } },
  // ── GRENADES ─────────────────────────────────────────────────────────────
  { id: "gre_1", branch: "GRENADES", tier: 1, name: "Grenade Pin",   desc: "Unlock grenades + 1 start",       cost:  300, prereqs: [],          maxLevel: 1, apply: (s) => { s.grenadeUnlocked = true; s.grenadeStart += 1; } },
  { id: "gre_2", branch: "GRENADES", tier: 2, name: "Quartermaster", desc: "+1 starting grenade (repeatable)",cost:  100, prereqs: ["gre_1"],   maxLevel: 99, apply: (s, lvl) => { s.grenadeStart += lvl; } },
  { id: "gre_3", branch: "GRENADES", tier: 3, name: "Heavy Charge",  desc: "+1 grenade blast radius",         cost: 1600, prereqs: ["gre_2"],   maxLevel: 1, apply: (s) => { s.blastRadius += 1; } },
  { id: "gre_4", branch: "GRENADES", tier: 4, name: "Sticky Frag",   desc: "Grenades home onto ants",         cost: 2000, prereqs: ["gre_3"],   maxLevel: 1, apply: (s) => { s.stickyFrag = true; } },
  { id: "gre_5", branch: "GRENADES", tier: 5, name: "Quick Throw",   desc: "Throw grenades back-to-back",     cost: 2000, prereqs: ["gre_4"],   maxLevel: 1, apply: (s) => { s.quickThrow = true; } },
  // ── MINES ────────────────────────────────────────────────────────────────
  { id: "min_1", branch: "MINES",    tier: 1, name: "Mine Layer",    desc: "Unlock mines + 1 start",          cost:  300, prereqs: [],          maxLevel: 1, apply: (s) => { s.mineUnlocked = true; s.mineStart += 1; } },
  { id: "min_2", branch: "MINES",    tier: 2, name: "Mine Cache",    desc: "+1 starting mine (repeatable)",   cost:  100, prereqs: ["min_1"],   maxLevel: 99, apply: (s, lvl) => { s.mineStart += lvl; } },
  { id: "min_3", branch: "MINES",    tier: 3, name: "Trip Wire",     desc: "Mines trigger on adjacent ant",   cost:  800, prereqs: ["min_2"],   maxLevel: 1, apply: (s) => { s.tripWire = true; } },
  { id: "min_4", branch: "MINES",    tier: 4, name: "Cluster Mine",  desc: "+1 mine blast radius",            cost: 2000, prereqs: ["min_3"],   maxLevel: 1, apply: (s) => { s.mineRadius += 1; } },
  { id: "min_5", branch: "MINES",    tier: 5, name: "Detonator",     desc: "Press M again to detonate all",   cost: 2000, prereqs: ["min_4"],   maxLevel: 1, apply: (s) => { s.remoteDetonator = true; } },
  // ── BOLTS ────────────────────────────────────────────────────────────────
  { id: "bol_1", branch: "BOLTS",    tier: 1, name: "Crossbow",      desc: "Unlock bolts + 1 start",          cost:  300, prereqs: [],          maxLevel: 1, apply: (s) => { s.boltUnlocked = true; s.boltStart += 1; } },
  { id: "bol_2", branch: "BOLTS",    tier: 2, name: "Quiver",        desc: "+1 starting bolt (repeatable)",   cost:  100, prereqs: ["bol_1"],   maxLevel: 99, apply: (s, lvl) => { s.boltStart += lvl; } },
  { id: "bol_3", branch: "BOLTS",    tier: 3, name: "Pierce",        desc: "Bolt kills 2 ants in a line",     cost:  800, prereqs: ["bol_2"],   maxLevel: 1, apply: (s) => { s.boltPierce = true; } },
  { id: "bol_4", branch: "BOLTS",    tier: 4, name: "Bolt Storm",    desc: "Fire 3 bolts in a spread",        cost: 2000, prereqs: ["bol_3"],   maxLevel: 1, apply: (s) => { s.boltStorm = true; } },
  { id: "bol_5", branch: "BOLTS",    tier: 5, name: "Ricochet",      desc: "Bolts bounce off walls once",     cost: 2000, prereqs: ["bol_4"],   maxLevel: 1, apply: (s) => { s.boltRicochet = true; } },
  // ── EXPLORER ─────────────────────────────────────────────────────────────
  { id: "exp_1", branch: "EXPLORER", tier: 1, name: "Light Step",    desc: "+10% walk speed (×3)",            cost:  100, prereqs: [],          maxLevel: 3, apply: (s, lvl) => { s.walkSpeedMult *= Math.pow(1.10, lvl); } },
  { id: "exp_2", branch: "EXPLORER", tier: 2, name: "Cat's Landing", desc: "+1 fall tolerance (repeatable)",  cost: 1500, prereqs: ["exp_1"],   maxLevel: 99, apply: (s, lvl) => { s.fallTolerance += lvl; } },
  { id: "exp_3", branch: "EXPLORER", tier: 3, name: "Decoy",         desc: "Press Z to lure ants",            cost:  800, prereqs: ["exp_2"],   maxLevel: 1, apply: (s) => { s.decoyUnlocked = true; } },
  { id: "exp_4", branch: "EXPLORER", tier: 4, name: "Grappling Step",desc: "Press F to leap 2 tiles",         cost: 1500, prereqs: ["exp_3"],   maxLevel: 1, apply: (s) => { s.grapplingStep = true; } },
  { id: "exp_5", branch: "EXPLORER", tier: 5, name: "Map Vision",    desc: "Tab toggles minimap",             cost: 2000, prereqs: ["exp_4"],   maxLevel: 1, apply: (s) => { s.mapVision = true; } },
];

export function getSkillById(id) { return SKILLS.find(s => s.id === id) || null; }

export function getBought() { return storage.load(STORE_KEY, {}) || {}; }
function saveBought(b) { storage.save(STORE_KEY, b); }

export function getLevel(id) { return getBought()[id] || 0; }
export function isOwned(id) { return getLevel(id) >= 1; }
export function isBought(id) { return isOwned(id); }  // legacy alias
export function isMaxed(skill) { return getLevel(skill.id) >= (skill.maxLevel || 1); }

export function prereqsMet(skill) {
  const b = getBought();
  return skill.prereqs.every(p => (b[p] || 0) >= 1);
}

export function statusFor(skill, currency) {
  if (isMaxed(skill)) return "owned";
  if (!prereqsMet(skill)) return "locked";
  if (currency < skill.cost) return "unaffordable";
  return "available";
}

export function buySkill(id, currency) {
  const skill = getSkillById(id);
  if (!skill) return { ok: false, reason: "unknown skill" };
  if (isMaxed(skill)) return { ok: false, reason: "already maxed" };
  if (!prereqsMet(skill)) return { ok: false, reason: "prereqs unmet" };
  if (currency < skill.cost) return { ok: false, reason: "insufficient" };
  const b = getBought();
  b[id] = (b[id] || 0) + 1;
  saveBought(b);
  return { ok: true, skill, newLevel: b[id], newCurrency: currency - skill.cost };
}

// Build the run spec from owned skills. Mutates a fresh opts object that
// startRun() then feeds into makePlayer + run config.
export function buildSpec(cfg) {
  const spec = {
    health: 1,
    maxHealth: 1,
    grenades: cfg.grenades,           // base from level config (now 0 across all levels)
    grenadeStart: 0,                   // bonus added by skills
    mineStart: 0,
    boltStart: 0,
    fallTolerance: 1,
    walkSpeedMult: 1.0,
    blastRadius: 1,
    mineRadius: 1,
    healOnStart: 0,
    grenadeUnlocked: false,
    mineUnlocked: false,
    boltUnlocked: false,
    decoyUnlocked: false,
    stickyFrag: false,
    quickThrow: false,
    tripWire: false,
    remoteDetonator: false,
    boltPierce: false,
    boltStorm: false,
    boltRicochet: false,
    adrenaline: false,
    grapplingStep: false,
    mapVision: false,
  };
  const b = getBought();
  for (const s of SKILLS) {
    const lvl = b[s.id] || 0;
    if (lvl > 0) s.apply(spec, lvl);
  }
  return spec;
}

export function totalBought() {
  const b = getBought();
  return Object.values(b).reduce((s, l) => s + (l > 0 ? 1 : 0), 0);
}

export function branchesOwned() {
  const owned = new Set();
  const b = getBought();
  for (const id in b) {
    if ((b[id] || 0) <= 0) continue;
    const s = getSkillById(id);
    if (s) owned.add(s.branch);
  }
  return owned;
}

export function isBranchMaxed(branch) {
  return SKILLS.filter(s => s.branch === branch).every(s => isMaxed(s));
}

export function resetSkills() { storage.save(STORE_KEY, {}); }
