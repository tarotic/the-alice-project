import test from 'node:test'
import assert from 'node:assert/strict'
import { SHAPES } from '../../src/tools/shapes/shapes.js'
import { createLetterGame, currentGlyph, goNext, nextLetter, inkEvent, parentEvent, isLetterDone } from '../../src/tools/letters/game.js'

test('AC21 next wraps through all six shapes', () => {
  assert.equal(nextLetter(5, SHAPES), 0)
  let i = 0
  const seen = []
  for (let k = 0; k < 6; k++) { seen.push(i); i = nextLetter(i, SHAPES) }
  assert.equal(i, 0)
  assert.deepEqual(seen, [0, 1, 2, 3, 4, 5])
  assert.deepEqual(seen.map((k) => SHAPES[k].id), ['circle', 'square', 'triangle', 'rectangle', 'oval', 'star'])
  assert.equal(createLetterGame().index, 0)
  assert.equal(currentGlyph(createLetterGame(), SHAPES).id, 'circle')
  let st = inkEvent(createLetterGame(), { type: 'down', pointerId: 1, point: { x: 1, y: 1 } }, SHAPES)
  st = parentEvent(st, { type: 'down', pointerId: 2 }, 0)
  const n = goNext(st, SHAPES)
  assert.equal(n.index, 1)
  assert.equal(n.done, false)
  assert.equal(n.ink.strokes.length, 0)
  assert.equal(n.hold.startedAt, null)
})

test('AC23 parent hold passes after 1000 ms regardless of ink', () => {
  const g = createLetterGame()
  let st = parentEvent(g, { type: 'down', pointerId: 1 }, 0)
  st = parentEvent(st, { type: 'tick', pointerId: 1 }, 999)
  assert.equal(isLetterDone(st), false)
  st = parentEvent(st, { type: 'tick', pointerId: 1 }, 1000)
  assert.equal(isLetterDone(st), true)
  // tap
  let t = parentEvent(g, { type: 'down', pointerId: 1 }, 0)
  t = parentEvent(t, { type: 'up', pointerId: 1 }, 0)
  assert.equal(isLetterDone(t), false)
  // early release
  let e = parentEvent(g, { type: 'down', pointerId: 1 }, 0)
  e = parentEvent(e, { type: 'up', pointerId: 1 }, 500)
  assert.equal(isLetterDone(e), false)
  // scribble far from circle, then hold: done without ink matching
  let s = g
  s = inkEvent(s, { type: 'down', pointerId: 3, point: { x: 2, y: 2 } }, SHAPES)
  s = inkEvent(s, { type: 'move', pointerId: 3, point: { x: 4, y: 4 } }, SHAPES)
  s = inkEvent(s, { type: 'up', pointerId: 3 }, SHAPES)
  assert.equal(isLetterDone(s), false)
  s = parentEvent(s, { type: 'down', pointerId: 1 }, 0)
  s = parentEvent(s, { type: 'tick', pointerId: 1 }, 1000)
  assert.equal(isLetterDone(s), true)
})
