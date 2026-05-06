// Procedural WebAudio sound effects — no external assets required.
// AudioContext is created lazily on first call so browser autoplay policy
// (requires a prior user gesture) is automatically satisfied.

let _ctx = null;
function ac() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  return _ctx;
}

// Oscillator burst helper — freq glides to freqEnd if supplied.
function osc(freq, dur, vol, type = "square", freqEnd = null) {
  try {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g);
    g.connect(c.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (freqEnd !== null)
      o.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.start(c.currentTime);
    o.stop(c.currentTime + dur + 0.02);
  } catch (_) { /* silently ignore if audio context unavailable */ }
}

// Short footstep tick.
export function playStep() {
  osc(110, 0.05, 0.06, "square");
}

// Grenade throw — fast descending sweep.
export function playThrow() {
  osc(480, 0.13, 0.16, "sawtooth", 110);
}

// Explosion — filtered white noise burst with low rumble.
export function playExplosion() {
  try {
    const c = ac();
    const len = (c.sampleRate * 0.45) | 0;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const flt = c.createBiquadFilter();
    flt.type = "lowpass";
    flt.frequency.setValueAtTime(700, c.currentTime);
    flt.frequency.exponentialRampToValueAtTime(70, c.currentTime + 0.45);
    const g = c.createGain();
    g.gain.setValueAtTime(0.55, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.45);
    src.connect(flt);
    flt.connect(g);
    g.connect(c.destination);
    src.start(c.currentTime);
  } catch (_) {}
}

// Ant bite — harsh short buzz.
export function playBite() {
  osc(85, 0.14, 0.26, "sawtooth");
}

// Hostage picked up — rising two-note chime.
export function playPickup() {
  osc(440, 0.18, 0.18, "sine");
  setTimeout(() => osc(660, 0.22, 0.16, "sine"), 130);
}

// Level complete — ascending four-note fanfare.
export function playWin() {
  [440, 554, 660, 880].forEach((f, i) =>
    setTimeout(() => osc(f, 0.28, 0.16, "sine"), i * 110));
}

// Player death — descending pitch fall.
export function playDeath() {
  osc(300, 0.80, 0.26, "sawtooth", 52);
}

// Timer warning beep (called at 30 s, 20 s, and each second below 10 s).
export function playTimerWarning() {
  osc(880, 0.09, 0.12, "square");
}

// Skill purchased — rising arpeggio chime.
export function playPurchase() {
  [523, 659, 784, 988].forEach((f, i) =>
    setTimeout(() => osc(f, 0.18, 0.14, "sine"), i * 60));
}

// Shield activated / consumed — short metallic zap.
export function playShield() {
  osc(1200, 0.18, 0.16, "square", 600);
}

// Pickup ping — a softer two-note for routine pickups (coin, grenade, time).
export function playPing() {
  osc(880, 0.06, 0.10, "sine");
  setTimeout(() => osc(1320, 0.10, 0.08, "sine"), 50);
}
