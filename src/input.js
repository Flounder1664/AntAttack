// Keyboard input. Maintains `pressed` state for held keys and a queue of
// edge-triggered actions (jump, grenade, rotate). The game loop drains the
// queue each tick.

const pressed = new Set();
const queue = [];

const KEY_TO_ACTION = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

const EDGE_KEYS = {
  Space: "grenade",
  KeyG: "grenade",
  KeyJ: "grenade",
  KeyQ: "rotL",
  KeyE: "rotR",
  Escape: "pause",
};

let _enabled = true;
export function setInputEnabled(on) { _enabled = on; if (!on) pressed.clear(); }

export function initInput() {
  window.addEventListener("keydown", (e) => {
    if (!_enabled) return;
    if (e.repeat) {
      // still allow held movement; suppress edge actions on repeat.
      const a = KEY_TO_ACTION[e.code];
      if (a) { pressed.add(a); e.preventDefault(); }
      return;
    }
    const a = KEY_TO_ACTION[e.code];
    if (a) { pressed.add(a); e.preventDefault(); }
    const edge = EDGE_KEYS[e.code];
    if (edge) { queue.push(edge); e.preventDefault(); }
  });

  window.addEventListener("keyup", (e) => {
    const a = KEY_TO_ACTION[e.code];
    if (a) pressed.delete(a);
  });

  window.addEventListener("blur", () => pressed.clear());
}

export function isPressed(action) { return pressed.has(action); }

export function takeActions() {
  const out = queue.slice();
  queue.length = 0;
  return out;
}

// Map a screen-relative input direction (up/down/left/right) into a world
// (dx, dy) step, applying the current view rotation.
//
// When rotation = 0, "up" on screen means moving toward smaller (x+y), which
// in our projection is up-and-back; we map "up" to (-1, -1) intuitively, but
// to keep it tile-aligned we instead project onto the dominant axis.
//
// We use a simple convention: in rotation 0,
//   up    = (0, -1)
//   down  = (0, +1)
//   left  = (-1, 0)
//   right = (+1, 0)
// then rotated 90° per rotation step.
export function rotateScreenDir(action, rotation) {
  let dx = 0, dy = 0;
  if (action === "up") { dx = 0; dy = -1; }
  else if (action === "down") { dx = 0; dy = 1; }
  else if (action === "left") { dx = -1; dy = 0; }
  else if (action === "right") { dx = 1; dy = 0; }
  for (let r = 0; r < rotation; r++) {
    const nx = -dy;
    const ny = dx;
    dx = nx; dy = ny;
  }
  return [dx, dy];
}
