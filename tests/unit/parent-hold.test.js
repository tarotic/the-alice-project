import test from 'node:test'
import assert from 'node:assert/strict'
import { PARENT_HOLD_MS, initialHold, parentHold as ph, holdProgress } from '../../src/tools/letters/parent-hold.js'

const ev = (type, pointerId) => ({ type, pointerId })
const run = (steps) => steps.reduce((s, [t, now, id]) => ph(s, ev(t, id), now), initialHold())

test('AC25 constants and basic hold', () => {
  assert.equal(PARENT_HOLD_MS, 1000)
  assert.equal(run([['down', 0, 1], ['tick', 999, 1]]).passed, false)
  assert.equal(run([['down', 0, 1], ['tick', 1000, 1]]).passed, true)
})

test('AC25 early release resets', () => {
  let s = run([['down', 0, 1], ['up', 500, 1]])
  assert.deepEqual(s, initialHold())
  s = ph(ph(s, ev('down', 1), 600), ev('tick', 1), 1599)
  assert.equal(s.passed, false)
  assert.equal(ph(s, ev('tick', 1), 1600).passed, true)
  assert.equal(run([['down', 0, 1], ['up', 0, 1]]).passed, false)
})

test('AC25 leave and cancel reset', () => {
  for (const t of ['leave', 'cancel'])
    assert.equal(run([['down', 0, 1], [t, 800, 1], ['tick', 1200, 1]]).passed, false)
})

test('AC25 up at >=1000 without tick passes', () => {
  assert.equal(run([['down', 0, 1], ['up', 1000, 1]]).passed, true)
})

test('AC25 second pointer ignored', () => {
  const s = run([['down', 0, 1]])
  assert.strictEqual(ph(s, ev('down', 2), 400), s)
  assert.strictEqual(ph(s, ev('up', 2), 400), s)
  assert.strictEqual(ph(s, ev('leave', 2), 400), s)
})

test('AC25 tick idle same object; undefined ids; backwards clock', () => {
  const i = initialHold()
  assert.strictEqual(ph(i, ev('tick'), 5), i)
  assert.equal(run([['down', 0], ['tick', 1000]]).passed, true)
  assert.equal(run([['down', 1000, 1], ['tick', 500, 1]]).passed, false)
})

test('AC25 passed is sticky', () => {
  const p = run([['down', 0, 1], ['tick', 1000, 1]])
  assert.strictEqual(ph(p, ev('up', 1), 1100), p)
  assert.strictEqual(ph(p, ev('leave', 1), 1100), p)
})

test('AC25 holdProgress and frozen input', () => {
  assert.equal(holdProgress(initialHold(), 100), 0)
  const h = Object.freeze(ph(initialHold(), ev('down', 1), 0))
  assert.equal(holdProgress(h, 500), 0.5)
  assert.equal(holdProgress(h, 5000), 1)
  assert.equal(holdProgress({ ...initialHold(), passed: true }, 0), 1)
  ph(h, ev('tick', 1), 2000)
  assert.equal(h.passed, false)
})
