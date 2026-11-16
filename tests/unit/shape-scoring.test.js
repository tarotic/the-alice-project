import test from 'node:test'
import assert from 'node:assert/strict'
import { SHAPES } from '../../src/tools/shapes/shapes.js'
import { resample } from '../../src/tools/letters/geometry.js'
import { coverage, strayRatio, isDone, TRACE_TOLERANCE } from '../../src/tools/letters/scoring.js'
import { createLetterGame, inkEvent, isLetterDone, scoreInk } from '../../src/tools/letters/game.js'
import { emptyInk } from '../../src/tools/letters/ink.js'

const done = (item, ink) => isDone(coverage(item.strokes, ink, TRACE_TOLERANCE), strayRatio(item.strokes, ink, TRACE_TOLERANCE))
const grid = []
for (let x = 0; x <= 100; x += 2) for (let y = 0; y <= 100; y += 2) grid.push({ x, y })
const prefix60 = (item) => {
  const pts = item.strokes.flatMap((s) => resample(s, 0.5))
  return pts.slice(0, Math.floor(0.6 * pts.length))
}
const S = (id) => SHAPES.find((s) => s.id === id)

function replay(index, strokes) {
  let st = { ...createLetterGame(), index }
  let id = 1
  for (const s of strokes) {
    st = inkEvent(st, { type: 'down', pointerId: id, point: s[0] }, SHAPES)
    for (const p of s.slice(1)) st = inkEvent(st, { type: 'move', pointerId: id, point: p }, SHAPES)
    st = inkEvent(st, { type: 'up', pointerId: id }, SHAPES)
    id++
  }
  return st
}

test('AC11 own trace is done (direct and via reducer)', () => {
  SHAPES.forEach((s, i) => {
    assert.ok(done(s, s.strokes.flat()), s.id)
    assert.ok(isLetterDone(replay(i, s.strokes)), s.id)
  })
})

test('AC12 60% of the outline is not done', (t) => {
  for (const s of SHAPES) {
    const p = prefix60(s)
    t.diagnostic(`${s.id}: cov ${coverage(s.strokes, p, TRACE_TOLERANCE).toFixed(3)}`)
    assert.equal(done(s, p), false, s.id)
  }
})

test('AC12 circle: 60% of the circle is not done', () => {
  const c = S('circle')
  assert.equal(done(c, prefix60(c)), false)
})

test('AC13 no multi-stroke shapes; first-stroke-only would not be done', () => {
  const multi = SHAPES.filter((s) => s.strokes.length >= 2)
  assert.equal(multi.length, 0)
  for (const s of multi) assert.equal(done(s, s.strokes[0]), false, s.id)
})

test('AC14 dense grid is not done (direct and via reducer)', () => {
  SHAPES.forEach((s, i) => {
    assert.ok(strayRatio(s.strokes, grid, TRACE_TOLERANCE) > 0.5, s.id)
    assert.equal(done(s, grid), false, s.id)
    let st = { ...createLetterGame(), index: i }
    st = inkEvent(st, { type: 'down', pointerId: 1, point: grid[0] }, SHAPES)
    for (const p of grid.slice(1)) st = inkEvent(st, { type: 'move', pointerId: 1, point: p }, SHAPES)
    st = inkEvent(st, { type: 'up', pointerId: 1 }, SHAPES)
    assert.equal(isLetterDone(st), false, s.id)
  })
})

test('AC15 empty ink is not done', () => {
  for (const s of SHAPES) {
    assert.equal(done(s, []), false, s.id)
    assert.equal(scoreInk(s, emptyInk()).done, false, s.id)
  }
})

const similar = new Set(['circle>oval', 'oval>circle', 'square>rectangle', 'rectangle>square'])
test('AC16 one shape never passes as another (matrix printed)', (t) => {
  for (const A of SHAPES) {
    const row = []
    for (const B of SHAPES) {
      const cov = coverage(B.strokes, A.strokes.flat(), TRACE_TOLERANCE)
      const stray = strayRatio(B.strokes, A.strokes.flat(), TRACE_TOLERANCE)
      row.push(`${B.id}:${cov.toFixed(2)}/${stray.toFixed(2)}`)
      if (A !== B && !similar.has(`${A.id}>${B.id}`)) assert.equal(done(B, A.strokes.flat()), false, `${A.id} ink on ${B.id}`)
    }
    t.diagnostic(`${A.id} ink -> ${row.join(' ')}`)
  }
})

test('AC17 look-alike pairs are not interchangeable', () => {
  const pairs = [['oval', 'circle'], ['circle', 'oval'], ['rectangle', 'square'], ['square', 'rectangle']]
  for (const [ink, guide] of pairs) assert.equal(done(S(guide), S(ink).strokes.flat()), false, `${ink} ink on ${guide} guide`)
})
