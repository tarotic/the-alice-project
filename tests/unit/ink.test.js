import test from 'node:test'
import assert from 'node:assert/strict'
import * as k from '../../src/tools/letters/ink.js'

const P = (x, y) => ({ x, y })
const deepFreeze = (o) => { Object.values(o).forEach((v) => typeof v === 'object' && v && deepFreeze(v)); return Object.freeze(o) }

test('multi-touch guard', () => {
  let ink = k.startStroke(k.emptyInk(), 1, P(0, 0))
  assert.strictEqual(k.startStroke(ink, 2, P(5, 5)), ink)
  assert.strictEqual(k.extendStroke(ink, 2, P(5, 5)), ink)
  assert.strictEqual(k.endStroke(ink, 2), ink)
  ink = k.extendStroke(ink, 1, P(10, 0))
  ink = k.endStroke(ink, 1)
  assert.equal(ink.activePointerId, null)
  assert.equal(ink.strokes.length, 1)
})

test('single point stroke kept', () => {
  let ink = k.endStroke(k.startStroke(k.emptyInk(), 1, P(5, 5)), 1)
  assert.deepEqual(k.inkPoints(ink), [P(5, 5)])
})

test('non-finite ignored', () => {
  const e = k.emptyInk()
  assert.strictEqual(k.startStroke(e, 1, P(NaN, 0)), e)
  const s = k.startStroke(e, 1, P(0, 0))
  assert.strictEqual(k.extendStroke(s, 1, P(0, Infinity)), s)
})

test('cap on points', () => {
  let ink = k.startStroke(k.emptyInk(), 1, P(0, 0))
  for (let i = 0; i < k.MAX_INK_POINTS + 50; i++) ink = k.extendStroke(ink, 1, P(i % 100, 1))
  assert.equal(ink.pointCount, k.MAX_INK_POINTS)
})

test('no mutation', () => {
  const e = deepFreeze(k.emptyInk())
  const s = deepFreeze(k.startStroke(e, 1, P(0, 0)))
  const m = deepFreeze(k.extendStroke(s, 1, P(4, 0)))
  deepFreeze(k.endStroke(m, 1))
  assert.equal(e.strokes.length, 0)
})
