// Procedural sound effects for EMBERLINE, built on plain WebAudio.
// No audio files are shipped; every sound is synthesized on the fly.
// The context is created lazily on the first user gesture (pointer lock).
import { PALETTE } from './palette.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.4;
    master.connect(ctx.destination);
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const t = ac.currentTime;
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    let node = src;
    if (lowpass) {
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      src.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(master);
    src.start(t);
  }

  const bank = {
    unlock() { ensure(); },
    setMuted(m) { muted = !!m; },
    get muted() { return muted; },
    shoot(kind) {
      if (kind === 'pistol') { noise(0.09, 0.35, 2600); tone(210, 0.07, 'square', 0.14, 90); }
      else if (kind === 'smg') { noise(0.07, 0.3, 3200); tone(260, 0.05, 'square', 0.11, 120); }
      else if (kind === 'rifle') { noise(0.11, 0.4, 2200); tone(170, 0.09, 'square', 0.16, 70); }
      else if (kind === 'dmr') { noise(0.16, 0.5, 1600); tone(130, 0.13, 'square', 0.2, 55); }
      else noise(0.08, 0.3, 2400);
    },
    dryFire() { tone(1400, 0.03, 'square', 0.08); },
    reload() { tone(500, 0.05, 'square', 0.1); setTimeout(() => tone(760, 0.05, 'square', 0.1), 140); },
    hit() { tone(1150, 0.05, 'sine', 0.22); },
    kill() { tone(880, 0.07, 'sine', 0.22); setTimeout(() => tone(1320, 0.1, 'sine', 0.22), 80); },
    hurt() { tone(140, 0.16, 'sawtooth', 0.22, 60); noise(0.1, 0.18, 900); },
    buy() { tone(660, 0.06, 'sine', 0.18); setTimeout(() => tone(990, 0.08, 'sine', 0.18), 70); },
    denied() { tone(220, 0.12, 'square', 0.14, 160); },
    plantTick() { tone(1050, 0.05, 'sine', 0.16); },
    planted() { tone(520, 0.12, 'sine', 0.2); setTimeout(() => tone(780, 0.16, 'sine', 0.2), 130); },
    defused() { tone(780, 0.12, 'sine', 0.2); setTimeout(() => tone(520, 0.18, 'sine', 0.2), 130); },
    beep() { tone(950, 0.07, 'sine', 0.2); },
    explosion() { noise(0.7, 0.6, 700); tone(70, 0.55, 'sine', 0.4, 30); },
    grenadeThrow() { noise(0.12, 0.14, 1800); },
    roundWin() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'sine', 0.2), i * 110)); },
    roundLose() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'sine', 0.18), i * 120)); },
    matchWin() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'sine', 0.22), i * 130)); },
    step() { noise(0.04, 0.05, 700); },
  };
  // PALETTE is referenced so the module stays part of the import graph
  // even when a build only shakes the audio tree.
  bank.accentCss = '#' + PALETTE.accent.toString(16).padStart(6, '0');
  return bank;
}
