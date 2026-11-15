import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRingArc, RING_CIRCUMFERENCE } from '../../src/views/ring.js';
import { createTimer, start, tick } from '../../src/timer.js';
import { getScreen } from '../../src/screen.js';

test('AC16 arc length follows progress', () => {
  assert.equal(getRingArc(1).drawnLength, RING_CIRCUMFERENCE);
  assert.equal(getRingArc(0.5).drawnLength, RING_CIRCUMFERENCE / 2);
  assert.equal(getRingArc(0).drawnLength, 0);
  assert.equal(getRingArc(-1).drawnLength, 0);
  assert.equal(getRingArc(2).drawnLength, RING_CIRCUMFERENCE);
  assert.equal(getRingArc(NaN).drawnLength, 0);
  const a = getRingArc(0.25);
  assert.ok(a.dashArray.startsWith(String(a.drawnLength)));
  assert.equal(a.circumference, RING_CIRCUMFERENCE);
});

test('AC21 finished arc is empty', () => {
  const finished = tick(start(createTimer(10), 0), 10000);
  assert.equal(getRingArc(getScreen(finished).fraction).drawnLength, 0);
});
