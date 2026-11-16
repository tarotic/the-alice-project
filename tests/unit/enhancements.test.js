import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readText } from './helpers/files.js';
import { RING_COLOURS, DEFAULT_RING_COLOUR } from '../../src/colours.js';
import { rocketPhase, getScreen } from '../../src/screen.js';
import { createTimer, start, pause, tick, reset, justFinished } from '../../src/timer.js';

const html = readText('index.html');
const css = readText('styles.css');

function luminance(hex) {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Timer that has been running for `elapsedMs` (starting from a fresh 120 s timer).
function runningAt(elapsedMs) {
  return tick(start(createTimer(120), 0), elapsedMs);
}

test('colour picker offers exactly ten distinct colours, default among them', () => {
  assert.equal(RING_COLOURS.length, 10);
  const hexes = RING_COLOURS.map((c) => c.hex.toUpperCase());
  assert.equal(new Set(hexes).size, 10);
  for (const h of hexes) assert.match(h, /^#[0-9A-F]{6}$/);
  assert.ok(hexes.includes(DEFAULT_RING_COLOUR.toUpperCase()));
});

test('every picker colour is at least 3:1 against the dark page background', () => {
  const bg = css.match(/--page-bg:\s*(#[0-9a-fA-F]{6})/)[1];
  for (const c of RING_COLOURS) {
    assert.ok(contrast(c.hex, bg) >= 3, `${c.name} ${c.hex} on ${bg}`);
  }
});

test('space background uses no images or external resources', () => {
  assert.ok(!/url\(|@import/.test(css));
  assert.match(css, /body::before/);
  assert.ok(html.includes('class="planet-system planet-big"'));
});

test('rocket is hidden until the final 10 seconds', () => {
  assert.equal(rocketPhase(createTimer(120)), 'hidden');
  assert.equal(rocketPhase(runningAt(109500)), 'hidden'); // 10.5 s left
  assert.equal(rocketPhase(runningAt(110000)), 'prep');   // exactly 10 s left
  assert.equal(rocketPhase(runningAt(119000)), 'prep');   // 1 s left
});

test('rocket is still (ready) when paused in the final 10 seconds', () => {
  const paused = pause(runningAt(115000), 115000);
  assert.equal(paused.status, 'paused');
  assert.equal(rocketPhase(paused), 'ready');
  assert.equal(rocketPhase(pause(runningAt(100000), 100000)), 'hidden');
});

test('rocket launches on finish and hides again on reset', () => {
  const finished = tick(runningAt(0), 120000);
  assert.equal(rocketPhase(finished), 'launch');
  assert.equal(rocketPhase(reset(finished)), 'hidden');
});

test('getScreen exposes the rocket phase', () => {
  assert.equal(getScreen(runningAt(115000)).rocketPhase, 'prep');
});

test('page has the rocket, the blast ring and the colour picker', () => {
  assert.ok(html.includes('id="rocket"'));
  assert.ok(html.includes('id="ring-blast"'));
  assert.ok(html.includes('id="colours"'));
});

test('styles define the launch and blast animations', () => {
  assert.match(css, /@keyframes rocket-launch\b/);
  assert.match(css, /@keyframes rocket-shake\b/);
  assert.match(css, /@keyframes ring-blast\b/);
  assert.match(css, /prefers-reduced-motion/);
});

test('the swatch colour is applied through the ring-running variable', () => {
  const ui = readText('src/ui.js');
  assert.ok(ui.includes("setProperty('--ring-running'"));
});

test('justFinished is true only on the transition into finished', () => {
  const running = tick(runningAt(0), 1000);
  const finished = tick(runningAt(0), 120000);
  assert.equal(justFinished(running, finished), true);
  assert.equal(justFinished(finished, finished), false);
  assert.equal(justFinished(running, running), false);
  assert.equal(justFinished(pause(running, 2000), finished), true);
});

test('finish chime is wired through the single timer setter and unlocked on Start', () => {
  const ui = readText('src/ui.js');
  assert.ok(ui.includes('justFinished(prev, next)'));
  assert.ok(ui.includes('unlockSound();'));
  const sound = readText('src/sound.js');
  assert.ok(!/new Audio|<audio|data:/.test(sound));
});

test('rocket visibility uses the attribute, since SVG has no hidden property', () => {
  const ui = readText('src/ui.js');
  assert.ok(ui.includes("rocketEl.toggleAttribute('hidden'"));
});
