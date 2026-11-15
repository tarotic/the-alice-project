import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTimer, setDuration, start, tick, pause, resume, reset,
  remainingSeconds, fractionRemaining, formatTime, parseCustomDuration,
  PRESET_SECONDS,
} from '../../src/timer.js';

const N = 120;

test('AC1 new timer is idle with full remaining time', () => {
  const t = createTimer(90);
  assert.equal(t.status, 'idle');
  assert.equal(t.remainingMs, 90000);
});

test('AC2 running timer loses exactly the elapsed time', () => {
  const T = 10;
  const t = tick(start(createTimer(N), 1000), 1000 + T * 1000);
  assert.equal(t.remainingMs, (N - T) * 1000);
  assert.equal(t.status, 'running');
  const half = tick(start(createTimer(N), 1000), 1500);
  assert.equal(half.remainingMs, 119500);
});

test('AC3 one 30 s clock jump removes 30 s', () => {
  const s = start(createTimer(N), 5000);
  const one = tick(s, 35000);
  assert.equal(one.remainingMs, (N - 30) * 1000);
  let many = s;
  for (let i = 1; i <= 300; i++) many = tick(many, 5000 + i * 100);
  assert.equal(many.remainingMs, one.remainingMs);
});

test('AC4 paused timer ignores the clock', () => {
  let t = start(createTimer(N), 0);
  t = pause(t, 5000);
  const rem = t.remainingMs;
  t = tick(t, 65000);
  assert.equal(t.remainingMs, rem);
  assert.equal(t.status, 'paused');
  assert.equal(t.lastNowMs, null);
});

test('AC5 resume continues from paused remaining', () => {
  let t = start(createTimer(N), 0);
  t = tick(t, 10000);
  t = pause(t, 10000);
  t = resume(t, 70000);
  t = tick(t, 80000);
  assert.equal(t.remainingMs, (N - 20) * 1000);
  assert.equal(t.status, 'running');
});

test('AC6 finishes at exactly zero and never negative', () => {
  const s = start(createTimer(N), 0);
  const a = tick(s, N * 1000);
  assert.equal(a.remainingMs, 0);
  assert.equal(a.status, 'finished');
  const b = tick(s, N * 10000);
  assert.equal(b.remainingMs, 0);
  assert.equal(b.status, 'finished');
  const c = pause(s, N * 10000);
  assert.equal(c.status, 'finished');
  assert.equal(c.remainingMs, 0);
});

test('AC7 reset returns to idle with last chosen duration', () => {
  const base = start(setDuration(createTimer(N), 300), 0);
  const running = tick(base, 1000);
  const paused = pause(running, 2000);
  const finished = tick(base, 400000);
  for (const t of [running, paused, finished]) {
    const r = reset(t);
    assert.equal(r.status, 'idle');
    assert.equal(r.durationMs, 300000);
    assert.equal(r.remainingMs, r.durationMs);
    assert.equal(r.lastNowMs, null);
  }
});

test('AC8 ignored actions return the same timer', () => {
  const zero = createTimer(0);
  assert.equal(start(zero, 0), zero);
  const idle = createTimer(N);
  const running = start(idle, 0);
  const paused = pause(running, 1000);
  const finished = tick(running, N * 1000);
  assert.equal(start(running, 5), running);
  assert.equal(pause(idle, 0), idle);
  assert.equal(pause(paused, 0), paused);
  assert.equal(pause(finished, 0), finished);
  assert.equal(resume(idle, 0), idle);
  assert.equal(resume(running, 0), running);
  assert.equal(resume(finished, 0), finished);
  assert.equal(tick(idle, 5), idle);
  assert.equal(tick(finished, 5), finished);
  assert.equal(tick(running, NaN), running);
  assert.equal(start(idle, Infinity), idle);
  assert.equal(setDuration(running, 60), running);
  assert.equal(setDuration(idle, 0), idle);
});

test('AC9 fraction is 1, 0.5, 0 and stays within 0..1', () => {
  const s = start(createTimer(N), 0);
  assert.equal(fractionRemaining(s), 1);
  assert.equal(fractionRemaining(tick(s, 60000)), 0.5);
  assert.equal(fractionRemaining(tick(s, N * 1000)), 0);
  assert.equal(fractionRemaining(createTimer(0)), 0);
  let t = s;
  let now = 0;
  for (let i = 0; i < 200; i++) {
    now += Math.floor((Math.random() - 0.4) * 2000);
    t = tick(t, now);
    const f = fractionRemaining(t);
    assert.ok(f >= 0 && f <= 1, `fraction ${f}`);
  }
});

test('AC10 formats mm:ss', () => {
  assert.equal(formatTime(65), '01:05');
  assert.equal(formatTime(600), '10:00');
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(5999), '99:59');
  assert.equal(formatTime(6000), '100:00');
  assert.equal(formatTime(NaN), '00:00');
  assert.equal(remainingSeconds({ remainingMs: 400 }), 1);
});

test('AC11 parses valid custom time', () => {
  assert.equal(parseCustomDuration('1', '5'), 65);
  assert.equal(parseCustomDuration('99', '59'), 5999);
  assert.equal(parseCustomDuration('0', '1'), 1);
  assert.equal(parseCustomDuration(' 05 ', '00'), 300);
});

test('AC11 rejects invalid custom time', () => {
  const bad = [['0', '0'], ['-1', '0'], ['a', '5'], ['', '5'], ['1', '60'],
    ['100', '0'], ['1.5', '0'], [' 1e1', '0'], ['1', ''], ['+1', '0']];
  for (const [m, s] of bad) assert.equal(parseCustomDuration(m, s), null, `${m}|${s}`);
  const timer = createTimer(N);
  let next = timer;
  const parsed = parseCustomDuration('0', '0');
  if (parsed !== null) next = setDuration(timer, parsed);
  assert.equal(next, timer);
});

test('AC12 presets are 2, 3, 5, 10 minutes', () => {
  assert.deepEqual([...PRESET_SECONDS], [120, 180, 300, 600]);
  for (const p of PRESET_SECONDS) {
    const t = setDuration(createTimer(N), p);
    assert.equal(t.durationMs, p * 1000);
    assert.equal(t.remainingMs, p * 1000);
  }
});

test('createTimer and setDuration reject bad durations', () => {
  for (const bad of [6000, -1, 1.5, NaN, '60']) {
    assert.throws(() => createTimer(bad), RangeError);
    const t = createTimer(N);
    assert.equal(setDuration(t, bad), t);
  }
});
