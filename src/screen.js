import { remainingSeconds, fractionRemaining, formatTime } from './timer.js';

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
    ringTone: timer.status === 'finished' ? 'finished' : 'running',
    durationLocked: timer.status !== 'idle',
    controls: { ...CONTROLS[timer.status] },
  };
}
