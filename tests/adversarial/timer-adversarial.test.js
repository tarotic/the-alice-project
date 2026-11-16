import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as T from '../../src/timer.js';
import { getScreen } from '../../src/screen.js';
import { getRingArc, RING_CIRCUMFERENCE } from '../../src/views/ring.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (p) => readFileSync(ROOT + p, 'utf8');

test('AC5 100 pause/resume pairs with 0 ms gap consume no time', () => {
  let t = T.start(T.createTimer(120), 1000);
  for (let i = 0; i < 100; i++) { t = T.pause(t, 1000); assert.equal(t.lastNowMs, null); t = T.resume(t, 1000); }
  t = T.tick(t, 1000);
  assert.equal(t.remainingMs, 120000);
});

test('AC5 100 pairs with 1 s running + 1 s pause consume exactly running time', () => {
  let t = T.start(T.createTimer(300), 0), now = 0;
  for (let i = 0; i < 100; i++) { now += 1000; t = T.pause(t, now); assert.equal(t.status, 'paused'); now += 1000; t = T.resume(t, now); }
  assert.equal(t.remainingMs, 200000);
});

test('AC4 paused timer: huge clock moves, backwards moves and NaN change nothing', () => {
  const t = T.pause(T.start(T.createTimer(60), 0), 5000);
  for (const n of [1e15, -1e15, NaN, Infinity, 0]) assert.equal(T.tick(t, n), t);
  assert.equal(t.remainingMs, 55000);
});

test('AC6 5999 s with a year of ms in one tick finishes at 00:00', () => {
  let t = T.start(T.createTimer(5999), 0);
  t = T.tick(t, 365 * 24 * 3600 * 1000);
  assert.equal(t.remainingMs, 0); assert.equal(t.status, 'finished'); assert.equal(t.lastNowMs, null);
  assert.equal(getScreen(t).timeText, '00:00');
});

test('AC6 finished is sticky: tick/pause/resume/start/setDuration return same object', () => {
  const f = T.tick(T.start(T.createTimer(1), 0), 5000);
  assert.equal(f.status, 'finished');
  assert.equal(T.tick(f, 99999), f); assert.equal(T.pause(f, 1), f); assert.equal(T.resume(f, 1), f);
  assert.equal(T.start(f, 1), f); assert.equal(T.setDuration(f, 30), f);
});

test('AC6 pause at exactly the end finishes', () => {
  const f = T.pause(T.start(T.createTimer(10), 0), 10000);
  assert.equal(f.status, 'finished'); assert.equal(f.remainingMs, 0);
});

test('AC3 backwards clock costs zero, re-anchors, remaining never increases', () => {
  let t = T.start(T.createTimer(100), 100000);
  t = T.tick(t, 110000); assert.equal(t.remainingMs, 90000);
  let prev = t.remainingMs;
  t = T.tick(t, 50000); assert.equal(t.remainingMs, prev); assert.equal(t.lastNowMs, 50000);
  t = T.tick(t, 52000); assert.equal(t.remainingMs, 88000);
  prev = t.remainingMs;
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 2000; i++) {
    t = T.tick(t, Math.floor(rnd() * 1e6));
    assert.ok(t.remainingMs <= prev); prev = t.remainingMs;
    const f = T.fractionRemaining(t); assert.ok(f >= 0 && f <= 1);
    if (t.status === 'finished') break;
  }
});

test('AC3 non-finite now is ignored by tick/start/resume', () => {
  const idle = T.createTimer(10);
  for (const n of [NaN, Infinity, -Infinity, undefined]) assert.equal(T.start(idle, n), idle);
  const run = T.start(idle, 0);
  for (const n of [NaN, Infinity, undefined, 'x']) assert.equal(T.tick(run, n), run);
  const paused = T.pause(run, 1000);
  assert.equal(T.resume(paused, NaN), paused);
});

test('AC8 start with zero duration, double start, rapid start+pause', () => {
  const z = T.createTimer(0);
  assert.equal(T.start(z, 0), z); assert.equal(T.fractionRemaining(z), 0);
  assert.equal(T.setDuration(z, 0), z);
  const r = T.start(T.createTimer(60), 1000);
  assert.equal(T.start(r, 2000), r);
  const p = T.pause(r, 1000); assert.equal(p.status, 'paused'); assert.equal(p.remainingMs, 60000);
  assert.equal(T.pause(p, 1000), p);
  const i = T.createTimer(5);
  assert.equal(T.pause(i, 0), i); assert.equal(T.resume(i, 0), i); assert.equal(T.resume(r, 0), r);
});

test('AC8 bad durations: createTimer throws, setDuration ignores', () => {
  for (const v of [6000, -1, 1.5, NaN, '60', null, undefined, Infinity, 1e9]) {
    assert.throws(() => T.createTimer(v), RangeError);
    const i = T.createTimer(30); assert.equal(T.setDuration(i, v), i);
  }
  assert.equal(T.createTimer(5999).remainingMs, 5999000);
});

test('AC7 reset from every state after setDuration(300) and does not mutate', () => {
  const idle = T.setDuration(T.createTimer(120), 300);
  const run = T.start(idle, 0), pau = T.pause(run, 1000), fin = T.tick(run, 1e9);
  Object.freeze(idle); Object.freeze(run); Object.freeze(pau); Object.freeze(fin);
  for (const t of [idle, run, pau, fin]) {
    const r = T.reset(t);
    assert.deepEqual(r, { status: 'idle', durationMs: 300000, remainingMs: 300000, lastNowMs: null });
  }
  assert.equal(run.remainingMs, 300000);
});

test('AC2 fractional elapsed time compares exact ms', () => {
  const t = T.tick(T.start(T.createTimer(120), 0), 500);
  assert.equal(t.remainingMs, 119500);
  assert.equal(T.tick(T.start(T.createTimer(120), 0.25), 0.75).remainingMs, 119999.5);
});

test('AC15 0.4 s remaining shows 00:01 and a running timer never shows 00:00', () => {
  const t = T.tick(T.start(T.createTimer(5), 0), 4600);
  assert.equal(t.status, 'running'); assert.equal(getScreen(t).timeText, '00:01');
  for (let ms = 0; ms < 5000; ms += 7) {
    const x = T.tick(T.start(T.createTimer(5), 0), ms);
    if (x.status === 'running') assert.notEqual(getScreen(x).timeText, '00:00');
  }
});

test('AC9 fraction exact values for 1, 120 and 5999 s', () => {
  for (const n of [1, 120, 5999]) {
    const s = T.start(T.createTimer(n), 0);
    assert.equal(T.fractionRemaining(s), 1);
    assert.equal(T.fractionRemaining(T.tick(s, n * 500)), 0.5);
    assert.equal(T.fractionRemaining(T.tick(s, n * 1000)), 0);
  }
});

test('AC10 formatTime edge cases', () => {
  assert.equal(T.formatTime(6000), '100:00');
  assert.equal(T.formatTime(-5), '00:00'); assert.equal(T.formatTime(NaN), '00:00');
  assert.equal(T.formatTime(0.1), '00:01'); assert.equal(T.formatTime(59.0), '00:59');
  assert.equal(T.formatTime(60), '01:00'); assert.equal(T.formatTime(Infinity), '00:00');
  assert.equal(T.formatTime(65), '01:05'); assert.equal(T.formatTime(5999), '99:59');
});

test('AC11 custom parse: accepted forms', () => {
  assert.equal(T.parseCustomDuration(' 1 ', '05'), 65);
  assert.equal(T.parseCustomDuration('05', '5'), 305);
  assert.equal(T.parseCustomDuration('99', '59'), 5999);
  assert.equal(T.parseCustomDuration('0', '59'), 59);
  assert.equal(T.parseCustomDuration(1, 5), 65);
});

test('AC11 custom parse: rejected forms (incl. non-ASCII digits)', () => {
  const bad = [['0','0'],['-1','0'],['0','-1'],['+1','0'],['1','+5'],['a','5'],['','5'],['5',''],['1','60'],['100','0'],
    ['1.5','0'],['1','0.5'],[' 1e1','0'],['1','1e1'],['٣','0'],['１','0'],['1 2','0'],['0x1','0'],['001','0'],['0','000'],
    [null,'5'],[undefined,'5'],[NaN,'5'],['5',null],['\n','\t'],['--','--'],['99','60'],['١٢','0']];
  for (const [m, s] of bad) assert.equal(T.parseCustomDuration(m, s), null, JSON.stringify([m, s]));
});

test('AC12 AC13 locked during running/paused for every preset', () => {
  const r = T.start(T.createTimer(120), 0), p = T.pause(r, 1);
  for (const s of T.PRESET_SECONDS) { assert.equal(T.setDuration(r, s), r); assert.equal(T.setDuration(p, s), p); }
  assert.equal(getScreen(r).durationLocked, true); assert.equal(getScreen(p).durationLocked, true);
  assert.equal(getScreen(T.createTimer(5)).durationLocked, false);
});

test('AC18 controls table per state, and returned controls object is not shared', () => {
  const idle = T.createTimer(5);
  const a = getScreen(idle); a.controls.start = false;
  assert.equal(getScreen(idle).controls.start, true);
  const run = T.start(idle, 0), pau = T.pause(run, 1), fin = T.tick(run, 1e6);
  assert.deepEqual(getScreen(idle).controls, { presets: true, custom: true, start: true, pause: false, resume: false, reset: false });
  assert.deepEqual(getScreen(run).controls, { presets: false, custom: false, start: false, pause: true, resume: false, reset: true });
  assert.deepEqual(getScreen(pau).controls, { presets: false, custom: false, start: false, pause: false, resume: true, reset: true });
  assert.deepEqual(getScreen(fin).controls, { presets: false, custom: false, start: false, pause: false, resume: false, reset: true });
});

test('AC16 ring arc over a full run is monotone non-increasing and within circumference', () => {
  const t = T.start(T.createTimer(120), 0);
  let prev = Infinity;
  for (let ms = 0; ms <= 120000; ms += 16) {
    const a = getRingArc(T.fractionRemaining(T.tick(t, ms)));
    assert.ok(a.drawnLength <= prev + 1e-9 && a.drawnLength >= 0 && a.drawnLength <= RING_CIRCUMFERENCE);
    prev = a.drawnLength;
  }
  assert.equal(getRingArc(Infinity).drawnLength, 0);
  assert.equal(getRingArc(undefined).drawnLength, 0);
  assert.equal(getRingArc(0.5).dashArray, `${RING_CIRCUMFERENCE / 2} ${RING_CIRCUMFERENCE}`);
});

test('AC20 smoothness (logic part): one second of run moves the arc by exactly 1/N of the ring', () => {
  const t = T.start(T.createTimer(120), 0);
  const a = getRingArc(T.fractionRemaining(T.tick(t, 0))).drawnLength;
  const b = getRingArc(T.fractionRemaining(T.tick(t, 1000))).drawnLength;
  assert.ok(Math.abs((a - b) - RING_CIRCUMFERENCE / 120) < 1e-9);
});

test('AC21 finished screen: Done, 00:00, empty arc, finished tone; 1 ms earlier is not', () => {
  const f = T.tick(T.start(T.createTimer(3), 0), 3000);
  const s = getScreen(f);
  assert.equal(s.showDone, true); assert.equal(s.timeText, '00:00'); assert.equal(getRingArc(s.fraction).drawnLength, 0);
  assert.equal(s.ringTone, 'finished');
  assert.equal(getScreen(T.tick(T.start(T.createTimer(3), 0), 2999)).showDone, false);
});

test('AC13 ui.js render disables presets, inputs and Set from durationLocked', () => {
  const ui = read('src/tools/timer/tool.js');
  for (const frag of ['b.disabled = s.durationLocked'])
    assert.ok(ui.includes(frag), frag);
});

test('AC15 ui.js: tab-return ticks with Date.now, single loop guard, no setInterval', () => {
  const ui = read('src/tools/timer/tool.js');
  assert.ok(!/setInterval|setTimeout/.test(ui));
  assert.match(ui, /visibilitychange[\s\S]*tick\(timer, Date\.now\(\)\)/);
  assert.match(ui, /frameId === null && timer\.status === 'running'/);
  // Only the timer loop (onFrame) is counted; the wheel settle check also uses rAF.
  assert.equal((ui.match(/requestAnimationFrame\(onFrame\)/g) || []).length, 2);
});

test('AC15 tab backgrounded 10 min then return, and return after the end', () => {
  let t = T.start(T.createTimer(900), 0);
  t = T.tick(t, 1000);
  t = T.tick(t, 601000); assert.equal(t.remainingMs, 299000); assert.equal(getScreen(t).timeText, '04:59');
  t = T.tick(t, 601000 + 400000); assert.equal(getScreen(t).showDone, true);
});

test('AC17 CSS: no sub-48px size on controls; no inline styles; control element census', () => {
  const css = read('styles.css'), html = read('index.html');
  assert.ok(!/\sstyle\s*=/.test(html));
  assert.ok(!/\sonclick\s*=/i.test(html));
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  for (const [, sel, body] of rules) {
    if (!/button|input|\.preset|#(custom|start|pause|resume|reset)/.test(sel)) continue;
    for (const m of body.matchAll(/(?:^|[;\s])(width|height|max-width|max-height)\s*:\s*([\d.]+)px/g))
      assert.ok(Number(m[2]) >= 48, `${sel.trim()} ${m[0]}`);
  }
  assert.match(css, /button,\s*input\s*\{[^}]*min-width:\s*48px;[^}]*min-height:\s*48px;/);
  assert.equal([...html.matchAll(/<(button|input)\b/g)].length, 4 + 4);
  assert.ok(!/<(a|select|textarea)\b/.test(html));
});

test('AC18 [hidden] rule uses !important so display:flex on #presets/#custom cannot reveal hidden', () => {
  assert.match(read('styles.css'), /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
});

test('AC12 html presets exactly 4, initial markup consistent with the 120 s default', () => {
  const html = read('index.html');
  assert.equal([...html.matchAll(/data-preset-seconds=/g)].length, 4);
  assert.match(html, /id="time-text"[^>]*>02:00</);
  assert.equal(T.DEFAULT_DURATION_SECONDS, 120);
  assert.match(html, /id="done-text"[^>]*\bhidden\b/);
});

test('AC16 index.html static dasharray equals full ring circumference', () => {
  const html = read('index.html');
  const m = html.match(/stroke-dasharray="([\d.]+) ([\d.]+)"/);
  assert.ok(m);
  assert.ok(Math.abs(Number(m[1]) - RING_CIRCUMFERENCE) < 0.001);
  assert.ok(Math.abs(Number(m[2]) - RING_CIRCUMFERENCE) < 0.001);
});

function walk(dir, out = []) {
  for (const e of readdirSync(ROOT + dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = dir + '/' + e.name;
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

test('AC23 AC24 AC25 site files: no network, storage, eval, non html/css/js, one script, one link', () => {
  const files = ['index.html', 'styles.css', ...walk('src')];
  const patterns = [/https?:/i, /\/\/[a-z0-9.-]+\.[a-z]{2,}/i, /fetch\s*\(/, /XMLHttpRequest|WebSocket|sendBeacon|EventSource/,
    /localStorage|sessionStorage|indexedDB|document\.cookie|navigator\./, /\beval\s*\(|new Function|importScripts|serviceWorker/,
    /@import|url\(/, /<(img|iframe|object|embed|video|audio|source)\b/i];
  for (const f of files) {
    assert.match(f, /\.(html|css|js)$/);
    const s = read(f);
    for (const re of patterns) assert.ok(!re.test(s), `${f} matches ${re}`);
  }
  const html = read('index.html');
  assert.equal((html.match(/<script\b/g) || []).length, 1);
  assert.equal((html.match(/<link\b/g) || []).length, 1);
  assert.ok(!/xmlns/.test(html));
});

test('AC25 package.json exactly as plan', () => {
  const p = JSON.parse(read('package.json'));
  assert.deepEqual(p, { name: 'timer', private: true, type: 'module', scripts: { test: 'node --test' } });
});

test('AC21a AC21b contrast computed independently; no transition/animation', () => {
  const css = read('styles.css');
  const hex = (n) => css.match(new RegExp('--' + n + ':\\s*#([0-9a-fA-F]{6})'))[1];
  const lum = (h) => {
    const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  assert.notEqual(hex('ring-finished').toLowerCase(), hex('ring-running').toLowerCase());
  assert.ok(cr(hex('ring-finished'), hex('page-bg')) >= 3);
  assert.ok(cr(hex('done-text'), hex('page-bg')) >= 4.5);
  // Increment 1 banned all animation. The rocket launch and blast ring are now allowed,
  // so the check is: only those named animations exist, and reduced motion turns them off.
  assert.ok(!/transition/.test(css));
  const animated = [...css.matchAll(/animation:\s*([a-z-]+)/g)].map((m) => m[1]);
  assert.ok(animated.length > 0);
  for (const name of animated) assert.ok(['rocket-shake', 'flame-flicker', 'rocket-launch', 'ring-blast', 'orbit', 'none'].includes(name), name);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
