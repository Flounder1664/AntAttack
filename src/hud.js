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

  // Weapon counters — only show what the player has unlocked.
  const gEl = $("grenades");
  if (gEl) {
    if (state.player.grenadeUnlocked) {
      gEl.textContent = `G ${state.player.grenades}`;
      gEl.classList.remove("locked");
    } else {
      gEl.textContent = "G —";
      gEl.classList.add("locked");
    }
  }
  const mEl = $("mines");
  if (mEl) {
    if (state.player.mineUnlocked) {
      mEl.textContent = `M ${state.player.mines}`;
      mEl.classList.remove("hidden", "locked");
    } else {
      mEl.classList.add("hidden");
    }
  }
  const bEl = $("bolts");
  if (bEl) {
    if (state.player.boltUnlocked) {
      bEl.textContent = `B ${state.player.bolts}`;
      bEl.classList.remove("hidden", "locked");
    } else {
      bEl.classList.add("hidden");
    }
  }

  // Currency tally — passed in via state.currency.
  const cur = $("currency");
  if (cur) cur.textContent = `¤ ${state.currency || 0}`;

  // Health pips — render up to player.maxHealth, marking missing as `gone`.
  const healthEl = $("health");
  const max = Math.max(1, state.player.maxHealth || state.player.health || 1);
  // Re-render pips if the count doesn't match the current max.
  if (healthEl.children.length !== max) {
    healthEl.innerHTML = "";
    for (let i = 0; i < max; i++) healthEl.appendChild(document.createElement("span"));
  }
  const pips = healthEl.children;
  for (let i = 0; i < pips.length; i++) {
    pips[i].classList.toggle("gone", i >= state.player.health);
  }
  healthEl.classList.toggle("shielded", !!state.player.shieldUp);

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

export function setEndScreen({
  won, hasNext, levelNum, detail, achievementsEarned, loseTitle,
  currencyBreakdown, currencyTotal,
}) {
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

  // Per-run currency breakdown — shown above achievements.
  if (currencyBreakdown && currencyBreakdown.length) {
    const head = document.createElement("li");
    head.className = "ach-head";
    const total = currencyBreakdown.reduce((s, [, n]) => s + n, 0);
    head.textContent = `+ ${total} ¤  (lifetime ${currencyTotal || 0})`;
    ul.appendChild(head);
    for (const [label, amount] of currencyBreakdown) {
      if (!amount) continue;
      const li = document.createElement("li");
      li.className = "ach-currency";
      li.textContent = `· ${label}: ${amount}`;
      ul.appendChild(li);
    }
  }

  for (const a of achievementsEarned) {
    const li = document.createElement("li");
    li.textContent = `★ ${a}`;
    ul.appendChild(li);
  }
  $("next-level").classList.toggle("hidden", !(won && hasNext));
  $("again").classList.toggle("hidden", won && hasNext);
  showOverlay("endscreen");
}
