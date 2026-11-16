import test from 'node:test'
import assert from 'node:assert/strict'
import { GLYPHS } from '../../src/tools/letters/glyphs.js'
import * as g from '../../src/tools/letters/game.js'
import { EXPECTED_LETTERS, FULL_SET_TODO } from './expected-letters.js'

test('AC24 nextLetter order and wrap', () => {
  assert.equal(g.nextLetter(GLYPHS.length - 1, GLYPHS), 0)
  const seen = new Set()
  let i = 0
  for (let n = 0; n < GLYPHS.length; n++) { seen.add(i); i = g.nextLetter(i, GLYPHS) }
  assert.equal(i, 0)
  assert.equal(seen.size, GLYPHS.length)
  assert.deepEqual(GLYPHS.map((x) => x.id), EXPECTED_LETTERS)
  assert.equal(GLYPHS[0].id, 'a')
  assert.equal(g.createLetterGame().index, 0)
  assert.throws(() => g.nextLetter(0, []), Error)
})

test('AC24 52 steps wrap', { todo: FULL_SET_TODO }, () => {
  let i = 0
  for (let n = 0; n < 52; n++) i = g.nextLetter(i, GLYPHS)
  assert.equal(i, 0)
  assert.equal(GLYPHS.length, 52)
})

const hold = (st) => g.parentEvent(g.parentEvent(st, { type: 'down', pointerId: 1 }, 0), { type: 'tick', pointerId: 1 }, 1000)

test('AC26 parent pass gives done with any ink', () => {
  const s = hold(g.createLetterGame())
  assert.equal(g.isLetterDone(s), true)
  assert.equal(s.done, true)
  let sc = g.createLetterGame()
  sc = g.inkEvent(sc, { type: 'down', pointerId: 1, point: { x: 99, y: 1 } }, GLYPHS)
  sc = g.inkEvent(sc, { type: 'move', pointerId: 1, point: { x: 98, y: 3 } }, GLYPHS)
  sc = g.inkEvent(sc, { type: 'up', pointerId: 1 }, GLYPHS)
  assert.equal(sc.done, false)
  assert.equal(hold(sc).done, true)
})

test('AC26 same shape traced vs parent; reset', () => {
  const glyph = GLYPHS[0]
  let t = g.createLetterGame()
  const s0 = glyph.strokes[0]
  t = g.inkEvent(t, { type: 'down', pointerId: 1, point: s0[0] })
  for (const p of s0.slice(1)) t = g.inkEvent(t, { type: 'move', pointerId: 1, point: p })
  t = g.inkEvent(t, { type: 'up', pointerId: 1 })
  assert.equal(t.done, true)
  const p = hold(g.createLetterGame())
  assert.deepEqual(Object.keys(t).sort(), Object.keys(p).sort())
  assert.equal(g.clearInk(p).done, false)
  assert.equal(g.goNext(p).done, false)
  assert.equal(g.goNext(p).index, 1)
  assert.equal(g.clearInk(p).index, 0)
})

test('currentGlyph', () => {
  assert.equal(g.currentGlyph(g.createLetterGame()).id, 'a')
})
