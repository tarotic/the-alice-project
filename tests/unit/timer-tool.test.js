import test from 'node:test';
import assert from 'node:assert/strict';
import { installTimerDom } from './helpers/timer-dom.js';

const dom = installTimerDom();
const { makeHost, flushRaf, pendingRaf, liveListeners, setClock, chimes, byId, find, text } = dom;

await import('../../src/tools/index.js');
const { listTools } = await import('../../src/registry.js');
const { createSwitchState, performSwitch } = await import('../../src/switcher.js');
const { timerTool } = await import('../../src/tools/timer/tool.js');
const { lettersTool } = await import('../../src/tools/letters/tool.js');
const { shapesTool } = await import('../../src/tools/shapes/tool.js');
const { createLetterGame } = await import('../../src/tools/letters/game.js');
const { offsetFromIndex } = await import('../../src/wheel.js');

const click = (id) => byId(id).fire('click');
const presetBtn = (i) => byId('presets').children[i];
const pad = (h) => find(h, (e) => e.className === 'pad');
const parentBtn = (h) => find(h, (e) => e.className === 'parent');
const dirty = (h) => {
  pad(h).fire('pointerdown', { clientX: 50, clientY: 50, pointerId: 3 });
  pad(h).fire('pointermove', { clientX: 90, clientY: 90, pointerId: 3 });
  parentBtn(h).fire('pointerdown', { pointerId: 9 });
};
const pick = (st) => ({ status: st.status, remainingMs: st.remainingMs, lastNowMs: st.lastNowMs });

let c0 = 0;
const chimesNow = () => chimes() - c0;

// Brings every tool and the timer back to a known state: idle, 2 minutes, nothing mounted.
function tidy() {
  for (const t of [lettersTool, shapesTool, timerTool]) t.unmount();
  flushRaf();
  setClock(0);
  document.hidden = false;
  timerTool.mount(makeHost());
  if (timerTool.getState().status !== 'idle') click('reset-btn');
  presetBtn(0).fire('click');
  timerTool.unmount();
  flushRaf();
  setClock(0);
  c0 = chimes();
}

test('T1 the real index registers Timer, Letters, Shapes in that order', () => {
  const t = listTools();
  assert.equal(t[0].id, 'timer');
});

test('T2 first mount adopts #timer-tool and shows 02:00, idle', () => {
  const host = makeHost();
  timerTool.mount(host);
  assert.equal(host.children.length, 1);
  assert.equal(host.children[0], dom.root);
  assert.equal(byId('time-text').textContent, '02:00');
  assert.equal(timerTool.getState().status, 'idle');
  timerTool.unmount();
});

test('T3 unmount when idle leaves nothing behind; remount reuses the same node and state', () => {
  const host = makeHost();
  timerTool.mount(host);
  const st = timerTool.getState();
  timerTool.unmount();
  assert.equal(liveListeners(), 0);
  assert.equal(pendingRaf(), 0);
  assert.equal(host.children.length, 0);
  timerTool.mount(host);
  assert.equal(host.children[0], dom.root);
  assert.equal(timerTool.getState(), st);
  timerTool.unmount();
  assert.equal(liveListeners(), 0);
});

test('T4 switching away while running pauses with the exact remaining time', () => {
  tidy();
  const host = makeHost();
  let st = performSwitch(createSwitchState(), 'timer', host);
  setClock(0);
  click('start-btn');
  setClock(30000);
  flushRaf();
  assert.equal(timerTool.getState().status, 'running');
  setClock(42500);
  st = performSwitch(st, 'letters', host);
  assert.deepEqual(pick(timerTool.getState()), { status: 'paused', remainingMs: 77500, lastNowMs: null });
  lettersTool.unmount();
  flushRaf();
  assert.equal(liveListeners(), 0, 'timer left listeners');
  assert.equal(pendingRaf(), 0, 'timer left a frame');
  setClock(3600000);
  st = performSwitch(st, 'timer', host);
  assert.equal(timerTool.getState().remainingMs, 77500);
  assert.equal(timerTool.getState().status, 'paused');
  assert.equal(pendingRaf(), 0, 'no auto-resume');
  flushRaf();
  assert.equal(timerTool.getState().status, 'paused');
  assert.equal(byId('resume-btn').hidden, false);
  assert.equal(byId('reset-btn').hidden, false);
  assert.equal(byId('pause-btn').hidden, true);
  assert.equal(byId('start-btn').hidden, true);
  assert.equal(byId('time-text').textContent, '01:18');
  click('resume-btn');
  setClock(3601000);
  flushRaf();
  assert.equal(timerTool.getState().status, 'running');
  assert.equal(timerTool.getState().remainingMs, 76500);
  timerTool.unmount();
});

test('T5 switching away while paused, idle or finished leaves the state unchanged', () => {
  tidy();
  const host = makeHost();
  let st = performSwitch(createSwitchState(), 'timer', host);

  // paused
  setClock(0);
  click('start-btn');
  setClock(5000);
  click('pause-btn');
  const paused = timerTool.getState();
  assert.equal(paused.status, 'paused');
  st = performSwitch(st, 'letters', host);
  assert.equal(timerTool.getState(), paused);
  st = performSwitch(st, 'timer', host);
  assert.equal(timerTool.getState(), paused);

  // finished
  click('reset-btn');
  setClock(0);
  click('start-btn');
  setClock(130000);
  flushRaf();
  const finished = timerTool.getState();
  assert.equal(finished.status, 'finished');
  st = performSwitch(st, 'shapes', host);
  assert.equal(timerTool.getState(), finished);
  st = performSwitch(st, 'timer', host);
  assert.equal(timerTool.getState(), finished);
  assert.equal(byId('done-text').hidden, false);
  assert.equal(byId('time-text').textContent, '00:00');

  // idle: chosen preset and colour are kept
  click('reset-btn');
  presetBtn(2).fire('click');
  const swatch = byId('colours').children[1];
  swatch.fire('click');
  const idle = timerTool.getState();
  assert.equal(idle.status, 'idle');
  st = performSwitch(st, 'letters', host);
  assert.equal(timerTool.getState(), idle);
  st = performSwitch(st, 'timer', host);
  assert.equal(timerTool.getState(), idle);
  assert.equal(byId('wheel-min').getAttribute('aria-valuenow'), '5');
  assert.equal(byId('wheel-sec').getAttribute('aria-valuenow'), '0');
  assert.equal(dom.props['--ring-running'], swatch.dataset.colour);
  assert.equal(swatch.getAttribute('aria-pressed'), 'true');
  timerTool.unmount();
});

test('T6 the chime plays exactly once while mounted', () => {
  tidy();
  const host = makeHost();
  let st = performSwitch(createSwitchState(), 'timer', host);
  setClock(0);
  click('start-btn');
  for (let t = 1000; t <= 125000; t += 1000) {
    setClock(t);
    flushRaf();
  }
  assert.equal(timerTool.getState().status, 'finished');
  assert.equal(chimesNow(), 1);
  setClock(200000);
  flushRaf();
  flushRaf();
  document.hidden = false;
  document.fire('visibilitychange');
  assert.equal(chimesNow(), 1);
  st = performSwitch(st, 'letters', host);
  st = performSwitch(st, 'timer', host);
  assert.equal(chimesNow(), 1);
  timerTool.unmount();
});

test('T7 switching exactly at the finish time finishes it, chimes once, and shows Done on return', () => {
  tidy();
  const host = makeHost();
  let st = performSwitch(createSwitchState(), 'timer', host);
  setClock(0);
  click('start-btn');
  setClock(120000);
  st = performSwitch(st, 'letters', host);
  assert.equal(timerTool.getState().status, 'finished');
  assert.equal(chimesNow(), 1);
  st = performSwitch(st, 'timer', host);
  assert.equal(byId('done-text').hidden, false);
  assert.equal(byId('time-text').textContent, '00:00');
  assert.equal(chimesNow(), 1);
  timerTool.unmount();
});

test('T8 switching in the middle of a wheel scroll discards the scroll', () => {
  tidy();
  const host = makeHost();
  let st = performSwitch(createSwitchState(), 'timer', host);
  st = performSwitch(st, 'letters', host);
  const baseline = pendingRaf();
  st = performSwitch(st, 'timer', host);
  byId('wheel-min').scrollTop = offsetFromIndex(5);
  byId('wheel-min').fire('scroll');
  assert.equal(byId('wheel-min').getAttribute('aria-valuenow'), '5');
  assert.equal(pendingRaf(), 1, 'wheel frame is pending');
  st = performSwitch(st, 'letters', host);
  assert.equal(pendingRaf(), baseline, 'the timer left a frame');
  flushRaf();
  st = performSwitch(st, 'timer', host);
  assert.equal(byId('wheel-min').getAttribute('aria-valuenow'), '2');
  assert.equal(timerTool.getState().durationMs, 120000);
  timerTool.unmount();
});

test('T9 1000 rapid switches across all three tools keep the paused time', () => {
  tidy();
  const host = makeHost();
  let st = performSwitch(createSwitchState(), 'timer', host);
  setClock(0);
  click('start-btn');
  setClock(10000);
  st = performSwitch(st, 'letters', host);
  const remaining = timerTool.getState().remainingMs;
  assert.equal(remaining, 110000);
  const ids = ['timer', 'letters', 'shapes'];
  const counts = {};
  for (let i = 1; i <= 1000; i++) {
    const id = ids[i % 3];
    setClock(10000 + i * 100000);
    st = performSwitch(st, id, host);
    if (counts[id] === undefined) counts[id] = liveListeners();
    assert.equal(liveListeners(), counts[id], 'listeners at ' + i);
    assert.ok(pendingRaf() <= 1, 'frames at ' + i);
  }
  assert.equal(timerTool.getState().remainingMs, remaining);
  assert.equal(timerTool.getState().status, 'paused');
  assert.equal(chimesNow(), 0);
  for (const t of [timerTool, lettersTool, shapesTool]) t.unmount();
  flushRaf();
  assert.equal(liveListeners(), 0);
  assert.equal(pendingRaf(), 0);
});

test('T10 visibilitychange while another tool is shown does nothing to the timer', () => {
  tidy();
  const host = makeHost();
  let st = performSwitch(createSwitchState(), 'timer', host);
  setClock(0);
  click('start-btn');
  setClock(1000);
  st = performSwitch(st, 'letters', host);
  const before = timerTool.getState();
  const rafs = pendingRaf();
  setClock(500000);
  document.hidden = true;
  assert.doesNotThrow(() => document.fire('visibilitychange'));
  document.hidden = false;
  assert.doesNotThrow(() => document.fire('visibilitychange'));
  assert.equal(timerTool.getState(), before);
  assert.equal(pendingRaf(), rafs);
  assert.equal(chimesNow(), 0);
  lettersTool.unmount();
});

test('T11 Letters and Shapes are fresh on every mount while the timer keeps its paused state', () => {
  tidy();
  const host = makeHost();
  let st = performSwitch(createSwitchState(), 'timer', host);
  setClock(0);
  click('start-btn');
  setClock(20000);
  st = performSwitch(st, 'letters', host);
  const paused = timerTool.getState();
  assert.equal(paused.remainingMs, 100000);
  dirty(host);
  st = performSwitch(st, 'timer', host);
  assert.equal(timerTool.getState(), paused);
  st = performSwitch(st, 'letters', host);
  assert.deepEqual(lettersTool.getState(), createLetterGame());
  dirty(host);
  st = performSwitch(st, 'shapes', host);
  dirty(host);
  st = performSwitch(st, 'timer', host);
  st = performSwitch(st, 'shapes', host);
  assert.deepEqual(shapesTool.getState(), createLetterGame());
  assert.match(text(host), /circle/);
  assert.equal(timerTool.getState(), paused);
  assert.equal(timerTool.getState().remainingMs, 100000);
  shapesTool.unmount();
});

test('T12 old controls and the old pad are inert after a switch', () => {
  tidy();
  const host = makeHost();
  let st = performSwitch(createSwitchState(), 'timer', host);
  setClock(0);
  click('start-btn');
  setClock(5000);
  click('pause-btn');
  const paused = timerTool.getState();
  st = performSwitch(st, 'letters', host);
  const oldPad = pad(host);
  byId('resume-btn').fire('click');
  presetBtn(1).fire('click');
  byId('reset-btn').fire('click');
  assert.equal(timerTool.getState(), paused);
  st = performSwitch(st, 'timer', host);
  oldPad.fire('pointerdown', { clientX: 10, clientY: 10, pointerId: 1 });
  oldPad.fire('pointermove', { clientX: 60, clientY: 60, pointerId: 1 });
  assert.equal(lettersTool.getState(), null);
  assert.equal(pendingRaf(), 0);
  timerTool.unmount();
});
