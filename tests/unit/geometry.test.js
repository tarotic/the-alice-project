import test from 'node:test'
import assert from 'node:assert/strict'
import { resample, distance, nearestDistance } from '../../src/tools/letters/geometry.js'
import { arc } from '../../src/tools/letters/glyphs.js'

const P = (x, y) => ({ x, y })
function check(stroke, spacing) {
  const frozen = JSON.stringify(stroke)
  const out = resample(stroke, spacing)
  assert.equal(JSON.stringify(stroke), frozen)
  assert.deepEqual(out[0], stroke[0])
  assert.deepEqual(out[out.length - 1], stroke[stroke.length - 1])
  for (let i = 0; i < out.length; i++) {
    assert.ok(Number.isFinite(out[i].x) && Number.isFinite(out[i].y))
    if (i) assert.ok(distance(out[i - 1], out[i]) <= spacing + 1e-9)
  }
  return out
}

test('AC12 resample shapes', () => {
  assert.ok(check([P(0, 0), P(50, 0)], 2).length >= 26)
  check([P(0, 0), P(10, 0), P(10, 10)], 3)
  check(arc(50, 50, 20, 20, 0, 360).map(([x, y]) => P(x, y)), 2)
  check([P(0, 0), P(0, 0), P(10, 0), P(10, 0), P(20, 0)], 4)
})

test('AC12 resample edge cases', () => {
  assert.deepEqual(resample([], 2), [])
  assert.deepEqual(resample([P(3, 4)], 2), [P(3, 4)])
  for (const s of [0, -1, NaN, Infinity]) assert.throws(() => resample([P(0, 0), P(1, 1)], s), Error)
})

test('distance helpers', () => {
  assert.equal(distance(P(0, 0), P(3, 4)), 5)
  assert.equal(nearestDistance(P(0, 0), []), Infinity)
  assert.equal(nearestDistance(P(0, 0), [P(3, 4), P(1, 0)]), 1)
})
