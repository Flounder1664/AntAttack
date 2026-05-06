// Skills tree — permanent cross-run upgrades bought with currency.
//
// Persisted under `antescher.v1.skills.bought` as { skillId: levelOwned }.
// Most skills are one-shot (level 0/1); the multi-tier ones in each branch
// are separate ids (vit_1, vit_2, vit_3, vit_4) so prereq checks stay simple.

import * as storage from "./storage.js";

const STORE_KEY = "skills.bought";

// Branch labels — used in the title-screen UI columns.
export const BRANCHES = ["VITALITY", "MUNITIONS", "EXPLORER"];

// Each skill is a single buyable node. `apply(spec)` mutates an opts object
// that startRun() then feeds into makePlayer / level config.
//
//   spec.maxHealth, spec.health         — starting hp & cap
//   spec.grenades                       — starting grenades (added to cfg.grenades)
//   spec.fallTolerance                  — falls of (≤ tolerance) deal no damage
//   spec.walkSpeedMult                  — multiplier on walk speed (1 = base)
//   spec.blastRadius                    — applyBlast() radius (1 = base)
//   spec.healOnStart                    — extra HP healed on level entry
//   spec.exitRevealed                   — show exit indicator from start
//   spec.antPathReveal                  — soft-render ant routes
export const SKILLS = [
  // VITALITY — body
  { id: "vit_1", branch: "VITALITY",  tier: 1, name: "Hardy",        desc: "+1 max health",            cost:  50, prereqs: [],         apply: s => { s.maxHealth += 1; s.health += 1; } },
  { id: "vit_2", branch: "VITALITY",  tier: 2, name: "Tough",        desc: "+1 max health",            cost: 150, prereqs: ["vit_1"],  apply: s => { s.maxHealth += 1; s.health += 1; } },
  { id: "vit_3", branch: "VITALITY",  tier: 3, name: "Iron Skin",    desc: "+1 max health",            cost: 400, prereqs: ["vit_2"],  apply: s => { s.maxHealth += 1; s.health += 1; } },
  { id: "vit_4", branch: "VITALITY",  tier: 4, name: "Field Medic",  desc: "Heal 1 on level start",    cost: 800, prereqs: ["vit_3"],  apply: s => { s.healOnStart = (s.healOnStart || 0) + 1; } },
  // MUNITIONS — hand
  { id: "mun_1", branch: "MUNITIONS", tier: 1, name: "Quartermaster",desc: "+1 starting grenade",      cost:  50, prereqs: [],         apply: s => { s.grenades += 1; } },
  { id: "mun_2", branch: "MUNITIONS", tier: 2, name: "Bandolier",    desc: "+1 starting grenade",      cost: 150, prereqs: ["mun_1"],  apply: s => { s.grenades += 1; } },
  { id: "mun_3", branch: "MUNITIONS", tier: 3, name: "Arsenal",      desc: "+1 starting grenade",      cost: 400, prereqs: ["mun_2"],  apply: s => { s.grenades += 1; } },
  { id: "mun_4", branch: "MUNITIONS", tier: 4, name: "Heavy Charge", desc: "+1 grenade blast radius",  cost: 800, prereqs: ["mun_3"],  apply: s => { s.blastRadius += 1; } },
  // EXPLORER — mind
  { id: "exp_1", branch: "EXPLORER",  tier: 1, name: "Light Step",   desc: "+10% walk speed",          cost:  50, prereqs: [],         apply: s => { s.walkSpeedMult *= 1.10; } },
  { id: "exp_2", branch: "EXPLORER",  tier: 2, name: "Cat's Landing",desc: "Survive 4-block falls",    cost: 150, prereqs: ["exp_1"],  apply: s => { s.fallTolerance = Math.max(s.fallTolerance, 4); } },
  { id: "exp_3", branch: "EXPLORER",  tier: 3, name: "Cartographer", desc: "Exit gap pre-revealed",    cost: 400, prereqs: ["exp_2"],  apply: s => { s.exitRevealed = true; } },
  { id: "exp_4", branch: "EXPLORER",  tier: 4, name: "Tracker",      desc: "Highlight ant paths",      cost: 800, prereqs: ["exp_3"],  apply: s => { s.antPathReveal = true; } },
];

export function getSkillById(id) {
  return SKILLS.find(s => s.id === id) || null;
}

export function getBought() {
  return storage.load(STORE_KEY, {}) || {};
}
function saveBought(b) { storage.save(STORE_KEY, b); }

export function isBought(id) {
  const b = getBought();
  return !!b[id];
}

export function prereqsMet(skill) {
  const b = getBought();
  return skill.prereqs.every(p => b[p]);
}

// Returns "owned" | "available" | "locked" (prereqs not met) | "unaffordable"
export function statusFor(skill, currency) {
  if (isBought(skill.id)) return "owned";
  if (!prereqsMet(skill)) return "locked";
  if (currency < skill.cost) return "unaffordable";
  return "available";
}

// Attempt to buy a skill. Returns { ok, reason, newCurrency, skill } where
// `reason` explains failure on !ok. The currency state is read/written via
// the supplied {get, set} callbacks so we don't import currency-handling
// here (avoids a circular import with main.js).
export function buySkill(id, currency) {
  const skill = getSkillById(id);
  if (!skill) return { ok: false, reason: "unknown skill" };
  if (isBought(id)) return { ok: false, reason: "already owned" };
  if (!prereqsMet(skill)) return { ok: false, reason: "prereqs unmet" };
  if (currency < skill.cost) return { ok: false, reason: "insufficient" };
  const b = getBought();
  b[id] = 1;
  saveBought(b);
  return { ok: true, skill, newCurrency: currency - skill.cost };
}

// Build a base skill-applied "spec" from level config. Mutated in place.
// startRun() reads this to construct makePlayer opts and run-config tweaks.
export function buildSpec(cfg) {
  const spec = {
    health: 1,
    maxHealth: 1,
    grenades: cfg.grenades,
    fallTolerance: 1,
    walkSpeedMult: 1.0,
    blastRadius: 1,
    healOnStart: 0,
    exitRevealed: false,
    antPathReveal: false,
  };
  const b = getBought();
  for (const s of SKILLS) {
    if (b[s.id]) s.apply(spec);
  }
  return spec;
}

// Helpers for achievement checks
export function totalBought() {
  return Object.keys(getBought()).length;
}
export function branchesOwned() {
  const owned = new Set();
  const b = getBought();
  for (const id in b) {
    const s = getSkillById(id);
    if (s) owned.add(s.branch);
  }
  return owned;
}
export function isBranchMaxed(branch) {
  const b = getBought();
  return SKILLS.filter(s => s.branch === branch).every(s => b[s.id]);
}

// One-time reset (debug / hard reset).
export function resetSkills() { storage.save(STORE_KEY, {}); }
