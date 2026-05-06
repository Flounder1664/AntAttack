// Theme = palette + sprite tints. The default theme is unlocked from the start;
// the rest are gated by achievements (see achievements.js).

export const THEMES = {
  spectrum: {
    id: "spectrum",
    name: "Spectrum",
    locked: false,
    palette: {
      // Uniform Spectrum gray — sky AND ground are the same flat colour.
      // Buildings (white cubes + stipple) and dark character silhouettes read
      // against this background, exactly as in the original Ant Attack.
      sky: ["#a8a8a8", "#a8a8a8"],
      fog: "rgba(0,0,0,0.0)",          // no fog — original had flat uniform rendering
      ground: "#a0a0a0",               // barely-different gray — subtle depth cue only
      cubeTop: "#ffffff",
      cubeLeft: "#ffffff",
      cubeRight: "#ffffff",
      cubeLeftStipple: "light",
      cubeRightStipple: "heavy",
      cubeOutline: "#000000",
      wallTop: "#ffffff",
      wallLeft: "#ffffff",
      wallRight: "#ffffff",
      wallLeftStipple: "light",
      wallRightStipple: "heavy",
      // Characters are dark silhouettes on the gray background (matching original).
      // Boy uses p.player (black); Girl / hostage uses p.hostage (red accent).
      player: "#080808",               // near-black silhouette body
      playerAlt: "#ffffff",            // white arm detail — the "white" in black-and-white
      hostage: "#c00000",              // deep red — visible on gray, distinct from player
      ant: "#000000",
      antEye: "#c00000",
      grenade: "#1a1a1a",
      explosion: "#fff200",
      shadow: "rgba(0,0,0,0.26)",
      uiAccent: "#000000",
      uiBg: "#a8a8a8",
      uiPanel: "rgba(255,255,255,0.96)",
      uiText: "#000000",
      uiDanger: "#d50000",
      uiWarn: "#a06800",
      uiFont: "'Press Start 2P', monospace",
      legacyChar: true, // use pixel-art Spectrum sprite style
    },
  },
  mint: {
    id: "mint",
    name: "Mint",
    locked: true,
    palette: {
      sky: ["#08110b", "#0d1c14"],
      fog: "rgba(8,17,11,0.55)",
      ground: "#0e1d14",
      cubeTop: "#a4f5b6",
      cubeLeft: "#5db276",
      cubeRight: "#3c8252",
      cubeOutline: "#0a1a10",
      wallTop: "#cfe9c8",
      wallLeft: "#7ca682",
      wallRight: "#52735a",
      player: "#ffe47a",
      playerAlt: "#ffb56b",
      hostage: "#7ad2ff",
      ant: "#1c241f",
      antEye: "#ff4848",
      grenade: "#9e9e9e",
      explosion: "#ffd86b",
      shadow: "rgba(0,0,0,0.45)",
      uiAccent: "#6dd28a",
      uiBg: "#0a0d12",
      uiPanel: "rgba(10,14,18,0.78)",
      uiText: "#d8e4dc",
      uiDanger: "#e15b4f",
      uiWarn: "#e6c25a",
      uiFont: "'Share Tech Mono', ui-monospace, monospace",
    },
  },
  dusk: {
    id: "dusk",
    name: "Dusk",
    locked: true,
    palette: {
      sky: ["#1a0f1c", "#3a1e2c"],
      fog: "rgba(40,15,30,0.6)",
      ground: "#2a1722",
      cubeTop: "#f3c894",
      cubeLeft: "#c88061",
      cubeRight: "#8b4a3e",
      cubeOutline: "#1c0d10",
      wallTop: "#ffe0a6",
      wallLeft: "#c97953",
      wallRight: "#7d3e30",
      player: "#fff2c2",
      playerAlt: "#ffd29a",
      hostage: "#a0d8e8",
      ant: "#1d0c10",
      antEye: "#ffd14b",
      grenade: "#bfb9aa",
      explosion: "#ffba70",
      shadow: "rgba(0,0,0,0.5)",
      uiAccent: "#ffb56b",
      uiBg: "#1a0f1c",
      uiPanel: "rgba(26,15,28,0.82)",
      uiText: "#ffe0c4",
      uiDanger: "#ff5a4a",
      uiWarn: "#ffba70",
      uiFont: "ui-monospace, 'Courier New', monospace",
    },
  },
  circuit: {
    id: "circuit",
    name: "Circuit",
    locked: true,
    palette: {
      sky: ["#01020a", "#040c1a"],
      fog: "rgba(0,30,60,0.6)",
      ground: "#020812",
      cubeTop: "#7df7ff",
      cubeLeft: "#2f9bb5",
      cubeRight: "#16566a",
      cubeOutline: "#020a14",
      wallTop: "#bafbff",
      wallLeft: "#3fb2cc",
      wallRight: "#18647a",
      player: "#ff7df0",
      playerAlt: "#c14ec0",
      hostage: "#fff37d",
      ant: "#06090f",
      antEye: "#ff5cf0",
      grenade: "#a0d6e0",
      explosion: "#ff7df0",
      shadow: "rgba(0,0,0,0.55)",
      uiAccent: "#7df7ff",
      uiBg: "#01020a",
      uiPanel: "rgba(1,2,10,0.85)",
      uiText: "#bafbff",
      uiDanger: "#ff5cf0",
      uiWarn: "#fff37d",
      uiFont: "'Share Tech Mono', ui-monospace, monospace",
    },
  },
  wireframe: {
    id: "wireframe",
    name: "Wireframe",
    locked: true,
    palette: {
      sky: ["#000000", "#000000"],
      fog: "rgba(0,0,0,0.0)",
      ground: "#000000",
      cubeTop: "#000000",
      cubeLeft: "#000000",
      cubeRight: "#000000",
      cubeOutline: "#00ff88",
      wallTop: "#000000",
      wallLeft: "#000000",
      wallRight: "#000000",
      player: "#00ff88",
      playerAlt: "#aaffcc",
      hostage: "#ffaa00",
      ant: "#ff0066",
      antEye: "#ffffff",
      grenade: "#88ffaa",
      explosion: "#ffffff",
      shadow: "rgba(0,255,136,0.18)",
      uiAccent: "#00ff88",
      uiBg: "#000000",
      uiPanel: "rgba(0,12,8,0.92)",
      uiText: "#aaffcc",
      uiDanger: "#ff5577",
      uiWarn: "#ffe05a",
      uiFont: "'Share Tech Mono', ui-monospace, monospace",
    },
  },
  cathode: {
    id: "cathode",
    name: "Cathode",
    locked: true,
    palette: {
      sky: ["#0a0008", "#160014"],
      fog: "rgba(40,0,30,0.6)",
      ground: "#0a000a",
      cubeTop: "#ff36c8",
      cubeLeft: "#9c1e8c",
      cubeRight: "#561256",
      cubeOutline: "#0a000a",
      wallTop: "#ff7be0",
      wallLeft: "#a32194",
      wallRight: "#5a165a",
      player: "#ffd86b",
      playerAlt: "#ffa030",
      hostage: "#7df7ff",
      ant: "#0a000a",
      antEye: "#ffd86b",
      grenade: "#cccccc",
      explosion: "#ffd86b",
      shadow: "rgba(0,0,0,0.55)",
      uiAccent: "#ff36c8",
      uiBg: "#0a0008",
      uiPanel: "rgba(20,0,16,0.85)",
      uiText: "#ffa6e8",
      uiDanger: "#ff5a4a",
      uiWarn: "#ffd86b",
      uiFont: "'Share Tech Mono', ui-monospace, monospace",
    },
  },
  aurora: {
    id: "aurora",
    name: "Aurora",
    locked: true,
    palette: {
      sky: ["#040a18", "#102050"],
      fog: "rgba(20,40,90,0.5)",
      ground: "#08122a",
      cubeTop: "#9aeac8",
      cubeLeft: "#5e9b94",
      cubeRight: "#2a4f5d",
      cubeOutline: "#040a14",
      wallTop: "#c4f7e1",
      wallLeft: "#6abca5",
      wallRight: "#345a64",
      player: "#ffd28a",
      playerAlt: "#ffaa6b",
      hostage: "#ff9ce4",
      ant: "#04050c",
      antEye: "#ffd28a",
      grenade: "#a0c0d8",
      explosion: "#fff0c8",
      shadow: "rgba(0,0,0,0.45)",
      uiAccent: "#9aeac8",
      uiBg: "#040a18",
      uiPanel: "rgba(8,18,38,0.85)",
      uiText: "#cfe9d8",
      uiDanger: "#ff7a8a",
      uiWarn: "#ffd86b",
      uiFont: "ui-monospace, 'Courier New', monospace",
    },
  },
  bone: {
    id: "bone",
    name: "Bone & Ash",
    locked: true,
    palette: {
      sky: ["#10110f", "#1c1d1a"],
      fog: "rgba(20,20,18,0.5)",
      ground: "#0e0e0c",
      cubeTop: "#e9e1cf",
      cubeLeft: "#a39d8a",
      cubeRight: "#615e54",
      cubeOutline: "#16140f",
      wallTop: "#fbf6e6",
      wallLeft: "#b3ad99",
      wallRight: "#6b6757",
      player: "#ff5a4a",
      playerAlt: "#cc3a2a",
      hostage: "#7ad2ff",
      ant: "#070605",
      antEye: "#ff5a4a",
      grenade: "#bfbfbf",
      explosion: "#ffd86b",
      shadow: "rgba(0,0,0,0.45)",
      uiAccent: "#e9e1cf",
      uiBg: "#10110f",
      uiPanel: "rgba(16,17,15,0.85)",
      uiText: "#e9e1cf",
      uiDanger: "#ff5a4a",
      uiWarn: "#ffd86b",
      uiFont: "ui-monospace, 'Courier New', monospace",
    },
  },
};

export const DEFAULT_THEME = "spectrum";

let _active = THEMES[DEFAULT_THEME];

export function setActiveTheme(id) {
  if (THEMES[id]) {
    _active = THEMES[id];
    applyThemeToCss(_active.palette);
  }
}
export function getActiveTheme() {
  return _active;
}
export function palette() {
  return _active.palette;
}

// Push palette colours into CSS custom properties so the HTML overlay
// (title screen, HUD, end screen) follows the active theme.
export function applyThemeToCss(p) {
  const root = document.documentElement;
  root.style.setProperty("--bg", p.uiBg);
  root.style.setProperty("--fg", p.uiText);
  root.style.setProperty("--accent", p.uiAccent);
  root.style.setProperty("--accent-dim", p.cubeRight);
  root.style.setProperty("--danger", p.uiDanger);
  root.style.setProperty("--warn", p.uiWarn);
  root.style.setProperty("--panel", p.uiPanel);
  root.style.setProperty("--panel-edge", p.uiAccent + "59");
  root.style.setProperty("--font", p.uiFont || "ui-monospace, monospace");
}
