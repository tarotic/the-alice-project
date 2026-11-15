import { remainingSeconds, fractionRemaining, formatTime } from './timer.js';

export const ROCKET_WARNING_SECONDS = 10;

// 'hidden' before the final 10 s, 'prep' (shaking) while running in the final 10 s,
// 'ready' (still) when paused in the final 10 s, 'launch' once finished.
export function rocketPhase(timer) {
  if (timer.status === 'finished') return 'launch';
  if (timer.status !== 'running' && timer.status !== 'paused') return 'hidden';
  if (remainingSeconds(timer) > ROCKET_WARNING_SECONDS) return 'hidden';
  return timer.status === 'running' ? 'prep' : 'ready';
}

const CONTROLS = {
  idle: { presets: true, custom: true, start: true, pause: false, resume: false, reset: false },
  running: { presets: false, custom: false, start: false, pause: true, resume: false, reset: true },
  paused: { presets: false, custom: false, start: false, pause: false, resume: true, reset: true },
  finished: { presets: false, custom: false, start: false, pause: false, resume: false, reset: true },
};

export function getScreen(timer) {
  return {
    status: timer.status,
    timeText: formatTime(remainingSeconds(timer)),
    showDone: timer.status === 'finished',
    fraction: fractionRemaining(timer),
    rocketPhase: rocketPhase(timer),
    ringTone: timer.status === 'finished' ? 'finished' : 'running',
    durationLocked: timer.status !== 'idle',
    controls: { ...CONTROLS[timer.status] },
  };
}
