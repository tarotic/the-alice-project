export const MAX_DURATION_SECONDS = 5999;
export const PRESET_SECONDS = Object.freeze([120, 180, 300, 600]);
export const DEFAULT_DURATION_SECONDS = 120;

function isValidSeconds(s, min) {
  return Number.isInteger(s) && s >= min && s <= MAX_DURATION_SECONDS;
}

export function createTimer(durationSeconds) {
  if (!isValidSeconds(durationSeconds, 0)) {
    throw new RangeError('durationSeconds must be an integer from 0 to 5999');
  }
  const ms = durationSeconds * 1000;
  return { status: 'idle', durationMs: ms, remainingMs: ms, lastNowMs: null };
}

export function setDuration(timer, durationSeconds) {
  if (timer.status !== 'idle' || !isValidSeconds(durationSeconds, 1)) return timer;
  return createTimer(durationSeconds);
}

export function start(timer, now) {
  if (timer.status !== 'idle' || !(timer.durationMs > 0) || !Number.isFinite(now)) return timer;
  return { status: 'running', durationMs: timer.durationMs, remainingMs: timer.durationMs, lastNowMs: now };
}

export function tick(timer, now) {
  if (timer.status !== 'running' || !Number.isFinite(now)) return timer;
  const delta = Math.max(0, now - timer.lastNowMs);
  const remainingMs = Math.max(0, timer.remainingMs - delta);
  if (remainingMs === 0) {
    return { ...timer, status: 'finished', remainingMs: 0, lastNowMs: null };
  }
  return { ...timer, remainingMs, lastNowMs: now };
}

export function pause(timer, now) {
  if (timer.status !== 'running') return timer;
  const t = tick(timer, now);
  if (t.status === 'finished') return t;
  return { ...t, status: 'paused', lastNowMs: null };
}

export function resume(timer, now) {
  if (timer.status !== 'paused' || !Number.isFinite(now)) return timer;
  return { ...timer, status: 'running', lastNowMs: now };
}

export function reset(timer) {
  return { status: 'idle', durationMs: timer.durationMs, remainingMs: timer.durationMs, lastNowMs: null };
}

export function remainingSeconds(timer) {
  return Math.ceil(timer.remainingMs / 1000);
}

export function fractionRemaining(timer) {
  if (timer.durationMs === 0) return 0;
  return Math.min(1, Math.max(0, timer.remainingMs / timer.durationMs));
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatTime(totalSeconds) {
  const s = Number.isFinite(totalSeconds) ? Math.max(0, Math.ceil(totalSeconds)) : 0;
  return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
}

export function parseCustomDuration(minutesText, secondsText) {
  const m = String(minutesText).trim();
  const s = String(secondsText).trim();
  if (!/^\d{1,2}$/.test(m) || !/^\d{1,2}$/.test(s)) return null;
  const seconds = Number(s);
  if (seconds > 59) return null;
  const total = Number(m) * 60 + seconds;
  if (total < 1 || total > MAX_DURATION_SECONDS) return null;
  return total;
}
