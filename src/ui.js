import { createTimer, setDuration, start, pause, resume, reset, tick, parseCustomDuration,
         justFinished, DEFAULT_DURATION_SECONDS } from './timer.js';
import { getScreen } from './screen.js';
import { getRingArc } from './views/ring.js';
import { RING_COLOURS, DEFAULT_RING_COLOUR } from './colours.js';
import { unlockSound, playRing } from './sound.js';

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
const rocketEl = $('rocket');
const coloursEl = $('colours');
const presetButtons = Array.from(presetsEl.querySelectorAll('button'));

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
  minEl.disabled = s.durationLocked;
  secEl.disabled = s.durationLocked;
  applyEl.disabled = s.durationLocked;
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

for (const b of presetButtons) {
  b.addEventListener('click', () => apply(setDuration(timer, Number(b.dataset.presetSeconds))));
}
applyEl.addEventListener('click', () => {
  const s = parseCustomDuration(minEl.value, secEl.value);
  if (s !== null) apply(setDuration(timer, s));
});
// Start and Resume are taps, so they are the places to unlock sound on phones.
startEl.addEventListener('click', () => { unlockSound(); apply(start(timer, Date.now())); });
pauseEl.addEventListener('click', () => apply(pause(timer, Date.now())));
resumeEl.addEventListener('click', () => { unlockSound(); apply(resume(timer, Date.now())); });
resetEl.addEventListener('click', () => apply(reset(timer)));

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
