// DOM-overlay HUD. Pulls fresh values from the main game state each frame.

const $ = (id) => document.getElementById(id);

export function showHud() { $("hud").classList.remove("hidden"); }
export function hideHud() { $("hud").classList.add("hidden"); }

export function updateHud(state) {
  const t = Math.max(0, state.timerSec | 0);
  const mm = String(Math.floor(t / 60)).padStart(2, "0");
  const ss = String(t % 60).padStart(2, "0");
  $("timer").textContent = `${mm}:${ss}`;
  $("level-display").textContent = `L${state.level}`;
  $("grenades").textContent = `G x ${state.player.grenades}`;

  const pips = $("health").children;
  for (let i = 0; i < pips.length; i++) {
    pips[i].classList.toggle("gone", i >= state.player.health);
  }

  const status = state.hostage.state === "rescued"
    ? "Hostage safe!"
    : state.hostage.state === "following"
      ? "Hostage following — get to a gap"
      : "Find the hostage";
  $("hostage-status").textContent = status;
}

export function toast(text) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = text;
  $("toasts").appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

export function showOverlay(id) {
  $(id).classList.remove("hidden");
}
export function hideOverlay(id) {
  $(id).classList.add("hidden");
}

export function setEndScreen({ won, hasNext, levelNum, detail, achievementsEarned, loseTitle }) {
  if (won && hasNext) {
    $("end-title").textContent = `LEVEL ${levelNum} CLEAR`;
    $("end-title").classList.remove("lose");
  } else {
    $("end-title").textContent = won ? "RESCUED" : (loseTitle || "DEVOURED");
    $("end-title").classList.toggle("lose", !won);
  }
  $("end-detail").textContent = detail;
  const ul = $("end-achievements");
  ul.innerHTML = "";
  for (const a of achievementsEarned) {
    const li = document.createElement("li");
    li.textContent = `★ ${a}`;
    ul.appendChild(li);
  }
  $("next-level").classList.toggle("hidden", !(won && hasNext));
  $("again").classList.toggle("hidden", won && hasNext);
  showOverlay("endscreen");
}
