import { createTimer, setDuration, start, pause, resume, reset, tick, parseCustomDuration,
         justFinished, DEFAULT_DURATION_SECONDS } from './timer.js';
import { getScreen } from './screen.js';
import { getRingArc } from './views/ring.js';
import { RING_COLOURS, DEFAULT_RING_COLOUR } from './colours.js';
import { unlockSound, playRing } from './sound.js';
import { WHEEL_MINUTES_MAX, WHEEL_SECONDS_MAX, indexFromOffset, offsetFromIndex, clampIndex,
         stepIndex, keyDelta, wheelValues, positionsFromSeconds, scrollBehaviour } from './wheel.js';

const $ = (id) => document.getElementById(id);

const timeEl = $('time-text');
const doneEl = $('done-text');
const ringEl = $('ring');
const arcEl = $('ring-arc');
const presetsEl = $('presets');
const customEl = $('custom');
const startEl = $('start-btn');
const pauseEl = $('pause-btn');
const resumeEl = $('resume-btn');
const resetEl = $('reset-btn');
const rocketEl = $('rocket');
const coloursEl = $('colours');
const presetButtons = Array.from(presetsEl.querySelectorAll('button'));

// A wheel counts as settled once its scroll position has not moved for this many frames (about 100 ms).
const WHEEL_STILL_FRAMES = 6;
const motion = (query) => window.matchMedia(query);

let timer = createTimer(DEFAULT_DURATION_SECONDS);
let frameId = null;
let ringColour = DEFAULT_RING_COLOUR;

function buildSwatches() {
  for (const c of RING_COLOURS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.dataset.colour = c.hex;
    b.setAttribute('aria-label', c.name);
    b.style.background = c.hex;
    b.addEventListener('click', () => {
      ringColour = c.hex;
      renderColours();
    });
    coloursEl.append(b);
  }
}

function renderColours() {
  document.documentElement.style.setProperty('--ring-running', ringColour);
  for (const b of coloursEl.children) {
    b.setAttribute('aria-pressed', String(b.dataset.colour === ringColour));
  }
}

// Each wheel: a scroll list of values, snapping one value to the centre.
function makeWheel(elId, listId, max) {
  const w = { el: $(elId), list: $(listId), max, value: 0, frame: null, lastTop: 0, still: 0 };
  for (const v of wheelValues(max)) {
    const li = document.createElement('li');
    li.dataset.index = String(v);
    li.textContent = String(v).padStart(2, '0');
    li.addEventListener('click', () => {
      setWheel(w, v, true);
      applyCustom();
    });
    w.list.append(li);
  }
  w.el.addEventListener('scroll', () => onWheelScroll(w));
  w.el.addEventListener('keydown', (e) => onWheelKey(w, e));
  return w;
}

const wheels = {
  min: makeWheel('wheel-min', 'list-min', WHEEL_MINUTES_MAX),
  sec: makeWheel('wheel-sec', 'list-sec', WHEEL_SECONDS_MAX),
};

function highlight(w, index) {
  for (const li of w.list.children) {
    li.classList.toggle('is-centre', Number(li.dataset.index) === index);
  }
  w.el.setAttribute('aria-valuenow', String(index));
}

function setWheel(w, index, animate) {
  w.value = clampIndex(index, w.max);
  highlight(w, w.value);
  w.el.scrollTo({ top: offsetFromIndex(w.value), behavior: animate ? scrollBehaviour(motion) : 'instant' });
}

function onWheelScroll(w) {
  highlight(w, indexFromOffset(w.el.scrollTop, w.max));
  w.still = 0;
  if (w.frame === null) w.frame = requestAnimationFrame(() => checkWheel(w));
}

// Runs each frame while the wheel moves; settles once it has been still long enough.
function checkWheel(w) {
  w.frame = null;
  const top = w.el.scrollTop;
  if (top === w.lastTop) w.still += 1;
  else w.still = 0;
  w.lastTop = top;
  if (w.still >= WHEEL_STILL_FRAMES) {
    settleWheel(w);
    return;
  }
  w.frame = requestAnimationFrame(() => checkWheel(w));
}

// Once the wheel stops, snap it onto its nearest value and apply that value.
function settleWheel(w) {
  setWheel(w, indexFromOffset(w.el.scrollTop, w.max), false);
  applyCustom();
}

function onWheelKey(w, e) {
  const delta = keyDelta(e.key);
  if (delta === 0) return;
  e.preventDefault();
  setWheel(w, stepIndex(w.value, delta, w.max), true);
  applyCustom();
}

// Show the timer's current duration on the wheels (after presets and after reset).
function syncWheelsToTimer() {
  const p = positionsFromSeconds(Math.round(timer.durationMs / 1000));
  setWheel(wheels.min, p.minutes, false);
  setWheel(wheels.sec, p.seconds, false);
}

function render() {
  const s = getScreen(timer);
  timeEl.textContent = s.timeText;
  doneEl.hidden = !s.showDone;
  arcEl.setAttribute('stroke-dasharray', getRingArc(s.fraction).dashArray);
  ringEl.classList.toggle('is-finished', s.ringTone === 'finished');
  rocketEl.toggleAttribute('hidden', s.rocketPhase === 'hidden');
  rocketEl.classList.toggle('is-prep', s.rocketPhase === 'prep');
  rocketEl.classList.toggle('is-launch', s.rocketPhase === 'launch');
  presetsEl.hidden = !s.controls.presets;
  customEl.hidden = !s.controls.custom;
  for (const b of presetButtons) b.disabled = s.durationLocked;
  startEl.hidden = !s.controls.start;
  pauseEl.hidden = !s.controls.pause;
  resumeEl.hidden = !s.controls.resume;
  resetEl.hidden = !s.controls.reset;
}

// Every timer change goes through here so the finish chime plays exactly once.
function setTimer(next) {
  const prev = timer;
  timer = next;
  if (justFinished(prev, next)) playRing();
}

function onFrame() {
  frameId = null;
  setTimer(tick(timer, Date.now()));
  render();
  if (timer.status === 'running') frameId = requestAnimationFrame(onFrame);
}

function ensureFrameLoop() {
  if (frameId === null && timer.status === 'running') frameId = requestAnimationFrame(onFrame);
}

function apply(next) {
  setTimer(next);
  render();
  ensureFrameLoop();
}

// The wheels' values become the custom duration. 0:00 is rejected, so nothing changes.
function applyCustom() {
  const s = parseCustomDuration(String(wheels.min.value), String(wheels.sec.value));
  if (s !== null) apply(setDuration(timer, s));
}

for (const b of presetButtons) {
  b.addEventListener('click', () => {
    apply(setDuration(timer, Number(b.dataset.presetSeconds)));
    syncWheelsToTimer();
  });
}
// Start and Resume are taps, so they are the places to unlock sound on phones.
startEl.addEventListener('click', () => { unlockSound(); apply(start(timer, Date.now())); });
pauseEl.addEventListener('click', () => apply(pause(timer, Date.now())));
resumeEl.addEventListener('click', () => { unlockSound(); apply(resume(timer, Date.now())); });
resetEl.addEventListener('click', () => {
  apply(reset(timer));
  syncWheelsToTimer();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    setTimer(tick(timer, Date.now()));
    render();
    ensureFrameLoop();
  }
});

buildSwatches();
renderColours();
render();
syncWheelsToTimer();
