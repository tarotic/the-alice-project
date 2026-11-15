import { createTimer, setDuration, start, pause, resume, reset, tick, parseCustomDuration,
         DEFAULT_DURATION_SECONDS } from './timer.js';
import { getScreen } from './screen.js';
import { getRingArc } from './views/ring.js';

const $ = (id) => document.getElementById(id);

const timeEl = $('time-text');
const doneEl = $('done-text');
const ringEl = $('ring');
const arcEl = $('ring-arc');
const presetsEl = $('presets');
const customEl = $('custom');
const minEl = $('custom-minutes');
const secEl = $('custom-seconds');
const applyEl = $('custom-apply');
const startEl = $('start-btn');
const pauseEl = $('pause-btn');
const resumeEl = $('resume-btn');
const resetEl = $('reset-btn');
const presetButtons = Array.from(presetsEl.querySelectorAll('button'));

let timer = createTimer(DEFAULT_DURATION_SECONDS);
let frameId = null;

function render() {
  const s = getScreen(timer);
  timeEl.textContent = s.timeText;
  doneEl.hidden = !s.showDone;
  arcEl.setAttribute('stroke-dasharray', getRingArc(s.fraction).dashArray);
  ringEl.classList.toggle('is-finished', s.ringTone === 'finished');
  presetsEl.hidden = !s.controls.presets;
  customEl.hidden = !s.controls.custom;
  for (const b of presetButtons) b.disabled = s.durationLocked;
  minEl.disabled = s.durationLocked;
  secEl.disabled = s.durationLocked;
  applyEl.disabled = s.durationLocked;
  startEl.hidden = !s.controls.start;
  pauseEl.hidden = !s.controls.pause;
  resumeEl.hidden = !s.controls.resume;
  resetEl.hidden = !s.controls.reset;
}

function onFrame() {
  frameId = null;
  timer = tick(timer, Date.now());
  render();
  if (timer.status === 'running') frameId = requestAnimationFrame(onFrame);
}

function ensureFrameLoop() {
  if (frameId === null && timer.status === 'running') frameId = requestAnimationFrame(onFrame);
}

function apply(next) {
  timer = next;
  render();
  ensureFrameLoop();
}

for (const b of presetButtons) {
  b.addEventListener('click', () => apply(setDuration(timer, Number(b.dataset.presetSeconds))));
}
applyEl.addEventListener('click', () => {
  const s = parseCustomDuration(minEl.value, secEl.value);
  if (s !== null) apply(setDuration(timer, s));
});
startEl.addEventListener('click', () => apply(start(timer, Date.now())));
pauseEl.addEventListener('click', () => apply(pause(timer, Date.now())));
resumeEl.addEventListener('click', () => apply(resume(timer, Date.now())));
resetEl.addEventListener('click', () => apply(reset(timer)));

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    timer = tick(timer, Date.now());
    render();
    ensureFrameLoop();
  }
});

render();
