import test from 'node:test'
import assert from 'node:assert/strict'
import * as sc from '../../src/tools/letters/scoring.js'

const P = (x, y) => ({ x, y })
const line = [[P(10, 10), P(10, 90)]]

test('AC13 coverage', () => {
  assert.equal(sc.coverage(line, [], 6), 0)
  assert.equal(sc.coverage(line, sc.guidePoints(line), 6), 1)
  const left = []
  for (let y = 10; y <= 50; y += 2) left.push(P(10, y))
  assert.ok(Math.abs(sc.coverage(line, left, 6) - 0.5) <= 0.1)
  assert.equal(sc.coverage(line, [P(16, 10)], 6) > 0, true)
})

test('AC14 strayRatio', () => {
  assert.equal(sc.strayRatio(line, sc.guidePoints(line), 6), 0)
  assert.equal(sc.strayRatio(line, [P(95, 95)], 6), 1)
  assert.equal(sc.strayRatio(line, [], 6), 0)
  assert.equal(sc.strayRatio(line, [P(10, 50), P(95, 95)], 6), 0.5)
})

test('AC15 isDone and constants', () => {
  assert.equal(sc.COVERAGE_THRESHOLD, 0.85)
  assert.equal(sc.STRAY_THRESHOLD, 0.5)
  assert.equal(sc.isDone(0.85, 0.5), true)
  assert.equal(sc.isDone(0.84, 0), false)
  assert.equal(sc.isDone(1, 0.51), false)
  assert.equal(sc.isDone(NaN, 0), false)
})
