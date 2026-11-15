// Finish chime, made with Web Audio (no audio files, nothing fetched).
// Mobile browsers only allow sound after a tap, so unlockSound() must run inside a click handler.

let ctx = null;

export function unlockSound() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) {
    ctx = null;
  }
}

function pulse(at) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.5, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + 0.32);
}

export function playRing() {
  try {
    if (!ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime;
    for (const offset of [0, 0.35, 0.7]) pulse(t0 + offset);
  } catch (e) {
    // Sound is a bonus; never let it break the timer.
  }
}
