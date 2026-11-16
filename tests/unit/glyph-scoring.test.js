import test from 'node:test'
import assert from 'node:assert/strict'
import { GLYPHS } from '../../src/tools/letters/glyphs.js'
import { coverage, strayRatio, isDone, TRACE_TOLERANCE } from '../../src/tools/letters/scoring.js'
import { createLetterGame, inkEvent, isLetterDone } from '../../src/tools/letters/game.js'

const grid = []
for (let x = 0; x <= 100; x += 2) for (let y = 0; y <= 100; y += 2) grid.push({ x, y })

test('AC16 dense grid is not done for any glyph', () => {
  for (const g of GLYPHS) {
    assert.ok(strayRatio(g.strokes, grid, TRACE_TOLERANCE) > 0.5, g.id)
    assert.equal(isDone(coverage(g.strokes, grid, TRACE_TOLERANCE), strayRatio(g.strokes, grid, TRACE_TOLERANCE)), false, g.id)
  }
})

test('AC17 own points are done', () => {
  for (const g of GLYPHS) {
    const ink = g.strokes.flat()
    assert.ok(isDone(coverage(g.strokes, ink, TRACE_TOLERANCE), strayRatio(g.strokes, ink, TRACE_TOLERANCE)), g.id)
    let st = createLetterGame()
    // advance to the glyph under test
    st = { ...st, index: GLYPHS.indexOf(g) }
    let id = 1
    for (const s of g.strokes) {
      st = inkEvent(st, { type: 'down', pointerId: id, point: s[0] })
      for (const p of s.slice(1)) st = inkEvent(st, { type: 'move', pointerId: id, point: p })
      st = inkEvent(st, { type: 'up', pointerId: id })
      id++
    }
    assert.equal(isLetterDone(st), true, g.id)
  }
})

test('AC18 first stroke alone is not done', () => {
  assert.ok(GLYPHS.some((g) => g.strokes.length >= 2))
  for (const g of GLYPHS) {
    if (g.strokes.length < 2) continue
    const ink = g.strokes[0]
    assert.equal(isDone(coverage(g.strokes, ink, TRACE_TOLERANCE), strayRatio(g.strokes, ink, TRACE_TOLERANCE)), false, g.id)
  }
})
