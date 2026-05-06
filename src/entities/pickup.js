// In-world pickup item. Player walks over it to collect.
// Types are referenced by string id throughout (so saves stay readable).
import { heal } from "./player.js";

// Each type defines its display label, currency reward (for COIN/GEM), and
// the `apply` callback that mutates run state. Effects that grant currency
// return the amount so the main loop can add it to the run total.
export const PICKUP_TYPES = {
  HEALTH: {
    name: "Med Kit",
    desc: "+1 HP",
    icon: "+",          // simple cross icon for the legacy renderer
    color: "#ff5577",
    apply(player /*, runState */) {
      const got = heal(player, 1);
      return { healed: got, currency: 0 };
    },
  },
  GRENADE: {
    name: "Grenade Crate",
    desc: "+2 grenades",
    icon: "G",
    color: "#bbbb22",
    apply(player) {
      player.grenades += 2;
      return { currency: 0 };
    },
  },
  COIN: {
    name: "Coin",
    desc: "+5 ¤",
    icon: "·",
    color: "#ffd14b",
    apply() { return { currency: 5 }; },
  },
  GEM: {
    name: "Gem",
    desc: "+20 ¤",
    icon: "◆",
    color: "#7df7ff",
    apply() { return { currency: 20 }; },
  },
  SHIELD: {
    name: "Shield",
    desc: "Negates next bite",
    icon: "○",
    color: "#88ddff",
    apply(player) { player.shieldUp = true; return { currency: 0 }; },
  },
  TIME: {
    name: "Hourglass",
    desc: "+10 s on the timer",
    icon: "⌛",
    color: "#dddddd",
    apply(_player, runState) {
      if (runState) runState.timerBonus = (runState.timerBonus || 0) + 10;
      return { currency: 0 };
    },
  },
  MAP: {
    name: "City Map",
    desc: "Reveal exit & ant paths briefly",
    icon: "M",
    color: "#aaffaa",
    apply(_player, runState) {
      if (runState) runState.mapRevealMs = 4000;
      return { currency: 0 };
    },
  },
};

// Per-level spawn weights (entries are { L1: w1, ..., L6: w6 }) — interpolated
// linearly between table entries. We index by clamped level.
const WEIGHTS = {
  HEALTH:  [30, 28, 24, 20, 16, 12, 10],
  GRENADE: [25, 24, 22, 20, 18, 16, 15],
  COIN:    [20, 18, 16, 14, 12, 11, 10],
  GEM:     [ 5,  8, 12, 16, 20, 22, 25],
  SHIELD:  [10, 11, 12, 13, 14, 15, 15],
  TIME:    [ 8, 10, 11, 12, 12, 12, 12],
  MAP:     [ 2,  3,  5,  7,  9, 11, 13],
};

export function pickPickupType(levelIdx) {
  const i = Math.max(0, Math.min(6, levelIdx));
  const total = Object.values(WEIGHTS).reduce((s, arr) => s + arr[i], 0);
  let r = Math.random() * total;
  for (const k in WEIGHTS) {
    r -= WEIGHTS[k][i];
    if (r <= 0) return k;
  }
  return "COIN";
}

export function makePickup(spawn, type) {
  return {
    kind: "pickup",
    type,
    x: spawn.x, y: spawn.y, z: spawn.z,
    collected: false,
    bornAt: performance.now(),
  };
}

// Has the player just stepped onto this pickup's tile?
// Same shape as hostage.touchedBy — Manhattan ≤ 1 + same z.
export function pickupTouched(p, player) {
  if (p.collected) return false;
  return Math.abs(p.x - player.x) + Math.abs(p.y - player.y) <= 0
      && p.z === player.z;
}

// Apply the pickup effect. Returns the result object from the type's apply.
export function applyPickup(p, player, runState) {
  if (p.collected) return null;
  p.collected = true;
  const def = PICKUP_TYPES[p.type];
  if (!def) return null;
  return def.apply(player, runState);
}
