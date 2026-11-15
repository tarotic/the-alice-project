import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTimer, setDuration, start, tick, pause } from '../../src/timer.js';
import { getScreen } from '../../src/screen.js';

test('AC13 duration locked while running or paused', () => {
  const idle = createTimer(120);
  const running = start(idle, 0);
  const paused = pause(running, 1000);
  assert.equal(setDuration(running, 60), running);
  assert.equal(setDuration(paused, 60), paused);
  assert.equal(getScreen(running).durationLocked, true);
  assert.equal(getScreen(paused).durationLocked, true);
  assert.equal(getScreen(idle).durationLocked, false);
});

test('AC15 time text advances every whole second', () => {
  const s = start(createTimer(5), 0);
  const expected = ['00:05', '00:04', '00:03', '00:02', '00:01', '00:00'];
  for (let i = 0; i <= 5; i++) {
    assert.equal(getScreen(tick(s, i * 1000)).timeText, expected[i]);
  }
  assert.equal(getScreen(tick(s, 200)).timeText, '00:05');
});

test('AC18 visible controls per state', () => {
  const idle = createTimer(60);
  const running = start(idle, 0);
  const paused = pause(running, 1000);
  const finished = tick(running, 60000);
  const mk = (presets, custom, startB, pauseB, resumeB, resetB) =>
    ({ presets, custom, start: startB, pause: pauseB, resume: resumeB, reset: resetB });
  assert.deepEqual(getScreen(idle).controls, mk(true, true, true, false, false, false));
  assert.deepEqual(getScreen(running).controls, mk(false, false, false, true, false, true));
  assert.deepEqual(getScreen(paused).controls, mk(false, false, false, false, true, true));
  assert.deepEqual(getScreen(finished).controls, mk(false, false, false, false, false, true));
});

test('AC21 finished screen shows Done, 00:00, empty arc, finished tone', () => {
  const running = start(createTimer(60), 0);
  const finished = tick(running, 60000);
  const f = getScreen(finished);
  assert.equal(f.showDone, true);
  assert.equal(f.timeText, '00:00');
  assert.equal(f.fraction, 0);
  assert.equal(f.ringTone, 'finished');
  const r = getScreen(running);
  assert.equal(r.showDone, false);
  assert.equal(r.ringTone, 'running');
});
