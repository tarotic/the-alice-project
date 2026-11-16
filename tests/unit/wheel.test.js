import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readText } from './helpers/files.js';
import { parseCustomDuration } from '../../src/timer.js';
import { WHEEL_MINUTES_MAX, WHEEL_SECONDS_MAX, WHEEL_ITEM_PX, indexFromOffset, offsetFromIndex,
         stepIndex, keyDelta, wheelValues, positionsFromSeconds, scrollBehaviour } from '../../src/wheel.js';

const html = readText('index.html');
const css = readText('styles.css');
const ui = readText('src/tools/timer/tool.js');

test('CW1 offset maps to index by rounding and clamps to 0..max', () => {
  assert.equal(indexFromOffset(0, 99), 0);
  assert.equal(indexFromOffset(48 * 3 + 20, 99), 3);   // rounds down
  assert.equal(indexFromOffset(48 * 3 + 30, 99), 4);   // rounds up
  assert.equal(indexFromOffset(-100, 99), 0);
  assert.equal(indexFromOffset(48 * 500, 99), 99);
  assert.equal(indexFromOffset(48 * 500, 59), 59);
  assert.equal(indexFromOffset(NaN, 59), 0);
});

test('CW2 index to offset round-trips for every minute and second value', () => {
  for (let i = 0; i <= WHEEL_MINUTES_MAX; i++) {
    assert.equal(indexFromOffset(offsetFromIndex(i), WHEEL_MINUTES_MAX), i);
  }
  for (let i = 0; i <= WHEEL_SECONDS_MAX; i++) {
    assert.equal(indexFromOffset(offsetFromIndex(i), WHEEL_SECONDS_MAX), i);
  }
});

test('CW3 every wheel pair other than 0/0 passes the AC11 parser; 0/0 is rejected', () => {
  assert.equal(parseCustomDuration('0', '0'), null);
  for (let m = 0; m <= WHEEL_MINUTES_MAX; m++) {
    for (let s = 0; s <= WHEEL_SECONDS_MAX; s++) {
      const expected = m * 60 + s;
      const got = parseCustomDuration(String(m), String(s));
      if (expected === 0) assert.equal(got, null);
      else assert.equal(got, expected, `${m}:${s}`);
    }
  }
});

test('CW4 presets and custom seconds map to wheel positions', () => {
  assert.deepEqual(positionsFromSeconds(120), { minutes: 2, seconds: 0 });
  assert.deepEqual(positionsFromSeconds(180), { minutes: 3, seconds: 0 });
  assert.deepEqual(positionsFromSeconds(300), { minutes: 5, seconds: 0 });
  assert.deepEqual(positionsFromSeconds(600), { minutes: 10, seconds: 0 });
  assert.deepEqual(positionsFromSeconds(270), { minutes: 4, seconds: 30 });
});

test('CW6 wheels hold 100 minute items and 60 second items', () => {
  assert.equal(wheelValues(WHEEL_MINUTES_MAX).length, 100);
  assert.equal(wheelValues(WHEEL_SECONDS_MAX).length, 60);
  assert.equal(wheelValues(WHEEL_SECONDS_MAX)[59], 59);
});

test('CW5 page has two wheels labelled min and sec and no typing fields for custom time', () => {
  assert.ok(html.includes('id="wheel-min"') && html.includes('aria-label="Minutes"'));
  assert.ok(html.includes('id="wheel-sec"') && html.includes('aria-label="Seconds"'));
  assert.equal([...html.matchAll(/class="wheel"/g)].length, 2);
  assert.ok(!/<input\b/.test(html));
});

test('CW7 wheel items and wheels are at least 48 CSS px', () => {
  assert.equal(WHEEL_ITEM_PX, 48);
  assert.match(css, /\.wheel-list li\s*\{[^}]*height:\s*48px;/);
  assert.match(css, /\.wheel-wrap\s*\{[^}]*width:\s*88px;/);
});

test('CW8 wheels snap with scroll-snap, and items use scroll-snap-align', () => {
  assert.match(css, /\.wheel\s*\{[^}]*scroll-snap-type:\s*y mandatory;/);
  assert.match(css, /\.wheel-list li\s*\{[^}]*scroll-snap-align:\s*center;/);
});

test('CW9 reduced motion gives instant scrolling, checked with a stubbed matchMedia', () => {
  const reduce = (q) => ({ matches: q === '(prefers-reduced-motion: reduce)' });
  const normal = () => ({ matches: false });
  assert.equal(scrollBehaviour(reduce), 'instant');
  assert.equal(scrollBehaviour(normal), 'smooth');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*scroll-behavior:\s*auto/);
  assert.ok(ui.includes("scrollBehaviour(motion)"));
});

test('CW10 arrow keys step by 1, page keys by 10, others do nothing; values clamp', () => {
  assert.equal(keyDelta('ArrowUp'), -1);
  assert.equal(keyDelta('ArrowDown'), 1);
  assert.equal(keyDelta('PageUp'), -10);
  assert.equal(keyDelta('PageDown'), 10);
  assert.equal(keyDelta('a'), 0);
  assert.equal(stepIndex(0, -1, 99), 0);
  assert.equal(stepIndex(95, 10, 99), 99);
  assert.ok(html.includes('role="spinbutton"'));
  assert.ok(html.includes('aria-valuemax="99"') && html.includes('aria-valuemax="59"'));
  assert.ok(html.includes('tabindex="0"'));
});

test('CW11 wheels are shown only in the idle state (customEl follows controls.custom)', () => {
  assert.ok(ui.includes('customEl.hidden = !s.controls.custom'));
});

test('CW12 no network, storage or build in the new wheel files', () => {
  const wheel = readText('src/wheel.js');
  for (const bad of ['fetch(', 'localStorage', 'http' + '://', 'https' + '://', 'import(']) {
    assert.ok(!wheel.includes(bad), bad);
    assert.ok(!ui.includes(bad), bad);
  }
});
