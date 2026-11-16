import test from 'node:test'
import assert from 'node:assert/strict'
import { createLetterGame, inkEvent, scoreInk } from '../../src/tools/letters/game.js'
import { GLYPHS } from '../../src/tools/letters/glyphs.js'

const P = (x, y) => ({ x, y })

test('bug 1: moves do not rescore; the letter is scored when the stroke ends', () => {
  const glyph = GLYPHS[0]
  const stroke = glyph.strokes[0]
  let s = inkEvent(createLetterGame(), { type: 'down', pointerId: 1, point: stroke[0] })
  for (const p of stroke.slice(1)) s = inkEvent(s, { type: 'move', pointerId: 1, point: p })
  assert.equal(s.done, false, 'no scoring during moves')
  assert.equal(scoreInk(glyph, s.ink).done, true)
  s = inkEvent(s, { type: 'up', pointerId: 1 })
  assert.equal(s.done, true)
})

test('bug 1: per-move cost does not grow with ink length', () => {
  let s = inkEvent(createLetterGame(), { type: 'down', pointerId: 1, point: P(0, 0) })
  const timeMoves = (n) => {
    const t = performance.now()
    for (let i = 0; i < n; i++) s = inkEvent(s, { type: 'move', pointerId: 1, point: P(i % 100, (i * 7) % 100) })
    return (performance.now() - t) / n
  }
  timeMoves(2500)
  assert.ok(timeMoves(100) < 1)
})

