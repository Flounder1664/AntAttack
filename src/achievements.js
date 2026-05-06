// Achievements + theme unlocks. Subscribes to a tiny pub/sub bus for run
// events; persists earned achievements (and via that, unlocked themes) to
// localStorage along with lifetime stats and per-run counters.

import * as storage from "./storage.js";
import { THEMES } from "./themes.js";
import * as skills from "./skills.js";

// Helper for achievements that need lifetime totals.
function lifetime() { return storage.load("stats.lifetime", {
  rescues: 0, kills: 0, pickups: 0, deaths: 0, steps: 0, fallsSurvived: 0,
  killsByType: { WORKER: 0, SOLDIER: 0, SCOUT: 0 },
  pickupsByType: { HEALTH: 0, GRENADE: 0, COIN: 0, GEM: 0, SHIELD: 0, TIME: 0, MAP: 0 },
}); }
function saveLifetime(L) { storage.save("stats.lifetime", L); }

export const ACHIEVEMENTS = [
  // ── Rescue milestones ────────────────────────────────────────────────
  { id: "first_rescue",  name: "First Rescue",          desc: "Rescue your first hostage.",                     unlocks: "mint",     on: "hostage_rescued", test: () => true },
  { id: "five_rescues",  name: "Five Rescues",          desc: "Rescue five hostages across all your runs.",     unlocks: null,        on: "hostage_rescued", test: (e,c,L) => L.rescues >= 5 },
  { id: "twenty_rescues",name: "Twenty Rescues",        desc: "Rescue twenty hostages total.",                  unlocks: null,        on: "hostage_rescued", test: (e,c,L) => L.rescues >= 20 },
  { id: "all_levels",    name: "Antescher Conquered",   desc: "Complete all seven levels.",                     unlocks: "aurora",   on: "level_completed", test: (e) => e.levelIdx === 6 },
  // ── Style badges ─────────────────────────────────────────────────────
  { id: "untouched",     name: "Untouched",             desc: "Complete a rescue without taking a single bite.",unlocks: "circuit",  on: "hostage_rescued", test: (e) => e.bites === 0 },
  { id: "pacifist",      name: "Pacifist",              desc: "Complete a rescue without throwing a grenade.",  unlocks: "bone",     on: "hostage_rescued", test: (e) => e.grenadesUsed === 0 },
  { id: "speedrun",      name: "Speedrun",              desc: "Rescue the hostage in under 60 seconds.",        unlocks: "dusk",     on: "hostage_rescued", test: (e) => e.timeSec < 60 },
  { id: "hardline",      name: "Hardline",              desc: "Rescue with no skills purchased.",               unlocks: null,        on: "hostage_rescued", test: () => skills.totalBought() === 0 },
  { id: "sniper",        name: "Sniper",                desc: "Kill 5 ants with a single grenade.",             unlocks: null,        on: "multi_kill",      test: (e) => e.count >= 5 },
  // ── Combat tallies ───────────────────────────────────────────────────
  { id: "first_kill",    name: "First Kill",            desc: "Kill your first ant.",                            unlocks: null,        on: "ant_killed",      test: (e,c) => c.runKills === 1 },
  { id: "exterminator",  name: "Exterminator",          desc: "Kill 10 ants in a single run.",                  unlocks: null,        on: "ant_killed",      test: (e,c) => c.runKills >= 10 },
  { id: "total_war_50",  name: "Total War",             desc: "Kill 50 ants across all your runs.",             unlocks: null,        on: "ant_killed",      test: (e,c,L) => L.kills >= 50 },
  { id: "total_war_200", name: "Genocide",              desc: "Kill 200 ants across all your runs.",            unlocks: null,        on: "ant_killed",      test: (e,c,L) => L.kills >= 200 },
  // ── Movement ─────────────────────────────────────────────────────────
  { id: "cliffhanger",   name: "Cliffhanger",           desc: "Survive a 4-block fall.",                         unlocks: null,        on: "fall_survived",   test: (e) => e.drop >= 4 },
  { id: "sprinter",      name: "Sprinter",              desc: "Take 200 steps in a single run.",                unlocks: null,        on: "hostage_rescued", test: (e,c) => c.runSteps >= 200 },
  // ── Pickups ──────────────────────────────────────────────────────────
  { id: "first_pickup",  name: "First Pickup",          desc: "Collect any pickup.",                             unlocks: null,        on: "pickup_collected",test: () => true },
  { id: "collector",     name: "Collector",             desc: "Collect 50 pickups across all your runs.",       unlocks: null,        on: "pickup_collected",test: (e,c,L) => L.pickups >= 50 },
  { id: "hoarder",       name: "Hoarder",               desc: "Collect 200 pickups across all your runs.",      unlocks: null,        on: "pickup_collected",test: (e,c,L) => L.pickups >= 200 },
  // ── Currency ─────────────────────────────────────────────────────────
  { id: "penny",         name: "Penny Pincher",         desc: "Earn 100 antillae lifetime.",                    unlocks: null,        on: "currency_changed",test: (e) => e.lifetime >= 100 },
  { id: "wealthy",       name: "Wealthy",               desc: "Earn 1000 antillae lifetime.",                   unlocks: null,        on: "currency_changed",test: (e) => e.lifetime >= 1000 },
  { id: "magnate",       name: "Magnate",               desc: "Earn 5000 antillae lifetime.",                   unlocks: "cathode",  on: "currency_changed",test: (e) => e.lifetime >= 5000 },
  // ── Skills ───────────────────────────────────────────────────────────
  { id: "first_skill",   name: "First Skill",           desc: "Buy your first skill.",                           unlocks: null,        on: "skill_bought",    test: () => true },
  { id: "specialist",    name: "Specialist",            desc: "Max out one skill branch.",                       unlocks: null,        on: "skill_bought",    test: () => skills.BRANCHES.some(b => skills.isBranchMaxed(b)) },
  { id: "polymath",      name: "Polymath",              desc: "Buy at least one skill in each branch.",         unlocks: "wireframe",on: "skill_bought",    test: () => skills.branchesOwned().size >= 3 },
  // ── Misc ─────────────────────────────────────────────────────────────
  { id: "bare",          name: "Bare Necessity",        desc: "Rescue with 1 health start and zero pickups.",   unlocks: null,        on: "hostage_rescued", test: (e,c) => c.runPickups === 0 && e.startMaxHealth === 1 },
  { id: "last_second",   name: "Last Second",           desc: "Rescue with under 5 seconds remaining.",         unlocks: null,        on: "hostage_rescued", test: (e) => e.timerRemaining < 5 },
  { id: "exterm_solo",   name: "Solo Exterminator",     desc: "Rescue without grenades after killing 5+ ants.", unlocks: null,        on: "hostage_rescued", test: (e,c) => e.grenadesUsed === 0 && c.runKills >= 5 },
  { id: "slay_soldier",  name: "Slayer",                desc: "Kill your first soldier ant.",                    unlocks: null,        on: "ant_killed",      test: (e,c,L) => L.killsByType.SOLDIER >= 1 },
  { id: "outrun_scout",  name: "Outrunner",             desc: "Rescue with a scout still alive on the map.",    unlocks: null,        on: "hostage_rescued", test: (e) => e.scoutsAlive > 0 },
  { id: "purge",         name: "Purge",                 desc: "Kill at least 5 of every ant type.",              unlocks: null,        on: "ant_killed",      test: (e,c,L) => L.killsByType.WORKER >= 5 && L.killsByType.SOLDIER >= 5 && L.killsByType.SCOUT >= 5 },
  { id: "theme_collector",name:"Theme Collector",       desc: "Unlock every theme.",                             unlocks: null,        on: "any",             test: () => Object.keys(THEMES).every(id => isThemeUnlocked(id)) },
];

const earnedKey = "achievements.earned";

export function getEarned() {
  return new Set(storage.load(earnedKey, []));
}
export function isEarned(id) {
  return getEarned().has(id);
}

export function isThemeUnlocked(id) {
  if (!THEMES[id]) return false;
  if (!THEMES[id].locked) return true;
  for (const a of ACHIEVEMENTS) {
    if (a.unlocks === id && isEarned(a.id)) return true;
  }
  return false;
}

// Subscribers: name -> [fn]
const subs = new Map();
export function on(eventName, fn) {
  if (!subs.has(eventName)) subs.set(eventName, []);
  subs.get(eventName).push(fn);
}
export function emit(eventName, payload, ctx = {}) {
  for (const fn of subs.get(eventName) || []) fn(payload, ctx);
}

// Run-scoped context tracking counters used by per-run achievements.
function freshCtx() {
  return {
    runKills: 0,
    runPickups: 0,
    runSteps: 0,
    runFalls: 0,
    pickupCounts: { HEALTH: 0, GRENADE: 0, COIN: 0, GEM: 0, SHIELD: 0, TIME: 0, MAP: 0 },
    killsByType: { WORKER: 0, SOLDIER: 0, SCOUT: 0 },
    multiKillMax: 0,
  };
}
let runCtx = freshCtx();
export function startRun() { runCtx = freshCtx(); }
export function runContext() { return runCtx; }

// Add to lifetime stats.
function bumpLifetime(field, by = 1) {
  const L = lifetime();
  L[field] = (L[field] || 0) + by;
  saveLifetime(L);
  return L;
}
function bumpLifetimeMap(mapField, key, by = 1) {
  const L = lifetime();
  L[mapField] = L[mapField] || {};
  L[mapField][key] = (L[mapField][key] || 0) + by;
  saveLifetime(L);
  return L;
}

export function getLifetime() { return lifetime(); }

// Wire achievements as event listeners. Returns a callback the main loop can
// invoke after a rescue/loss to flush any toasts.
export function initAchievements({ onEarn }) {
  const earnedSet = getEarned();

  function check(eventName, payload) {
    const L = lifetime();
    const newlyEarned = [];
    for (const a of ACHIEVEMENTS) {
      if (a.on !== eventName && a.on !== "any") continue;
      if (earnedSet.has(a.id)) continue;
      try { if (!a.test(payload, runCtx, L)) continue; } catch { continue; }
      earnedSet.add(a.id);
      newlyEarned.push(a);
    }
    if (newlyEarned.length) {
      storage.save(earnedKey, [...earnedSet]);
      for (const a of newlyEarned) onEarn(a);
    }
  }

  on("hostage_rescued", (p) => {
    bumpLifetime("rescues", 1);
    check("hostage_rescued", p);
  });
  on("ant_killed", (p) => {
    runCtx.runKills += 1;
    if (p && p.type) {
      runCtx.killsByType[p.type] = (runCtx.killsByType[p.type] || 0) + 1;
      bumpLifetimeMap("killsByType", p.type, 1);
    }
    bumpLifetime("kills", 1);
    check("ant_killed", p);
  });
  on("pickup_collected", (p) => {
    runCtx.runPickups += 1;
    if (p && p.type) {
      runCtx.pickupCounts[p.type] = (runCtx.pickupCounts[p.type] || 0) + 1;
      bumpLifetimeMap("pickupsByType", p.type, 1);
    }
    bumpLifetime("pickups", 1);
    check("pickup_collected", p);
  });
  on("skill_bought",  (p) => check("skill_bought", p));
  on("currency_changed", (p) => check("currency_changed", p));
  on("level_completed", (p) => check("level_completed", p));
  on("fall_survived", (p) => {
    runCtx.runFalls += 1;
    bumpLifetime("fallsSurvived", 1);
    check("fall_survived", p);
  });
  on("multi_kill", (p) => {
    if (p && p.count > runCtx.multiKillMax) runCtx.multiKillMax = p.count;
    check("multi_kill", p);
  });
  // "any" achievements (e.g. theme_collector) are re-tested by every check()
  // call above — no separate subscription needed.
}
