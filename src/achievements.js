// Achievements + theme unlocks. Subscribes to a tiny pub/sub bus for run
// events; persists earned achievements (and via that, unlocked themes) to
// localStorage.

import * as storage from "./storage.js";
import { THEMES } from "./themes.js";

export const ACHIEVEMENTS = [
  {
    id: "first_rescue",
    name: "First Rescue",
    desc: "Rescue your first hostage.",
    unlocks: "mint",
    on: "hostage_rescued",
    test: () => true,
  },
  {
    id: "untouched",
    name: "Untouched",
    desc: "Complete a rescue without taking a single bite.",
    unlocks: "circuit",
    on: "hostage_rescued",
    test: (e) => e.bites === 0,
  },
  {
    id: "pacifist",
    name: "Pacifist",
    desc: "Complete a rescue without throwing a grenade.",
    unlocks: "bone",
    on: "hostage_rescued",
    test: (e) => e.grenadesUsed === 0,
  },
  {
    id: "speedrun",
    name: "Speedrun",
    desc: "Rescue the hostage in under 60 seconds.",
    unlocks: "dusk",
    on: "hostage_rescued",
    test: (e) => e.timeSec < 60,
  },
  {
    id: "exterminator",
    name: "Exterminator",
    desc: "Kill 10 ants in a single run.",
    unlocks: null,
    on: "ant_killed",
    test: (e, ctx) => ctx.runKills >= 10,
  },
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

// Run-scoped context (kill counters etc.)
let runCtx = freshCtx();
export function startRun() { runCtx = freshCtx(); }
function freshCtx() { return { runKills: 0 }; }
export function runContext() { return runCtx; }

// Wire achievements as event listeners. Returns a callback the main loop can
// invoke after a rescue/loss to flush any toasts.
export function initAchievements({ onEarn }) {
  const earnedSet = getEarned();

  function check(eventName, payload) {
    const newlyEarned = [];
    for (const a of ACHIEVEMENTS) {
      if (a.on !== eventName) continue;
      if (earnedSet.has(a.id)) continue;
      if (!a.test(payload, runCtx)) continue;
      earnedSet.add(a.id);
      newlyEarned.push(a);
    }
    if (newlyEarned.length) {
      storage.save(earnedKey, [...earnedSet]);
      for (const a of newlyEarned) onEarn(a);
    }
  }

  on("hostage_rescued", (p) => check("hostage_rescued", p));
  on("ant_killed", (p) => { runCtx.runKills += 1; check("ant_killed", p); });
}
