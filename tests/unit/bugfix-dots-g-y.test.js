import test from 'node:test'
import assert from 'node:assert/strict'
import { getGlyph } from '../../src/tools/letters/glyphs.js'
import { emptyInk, startStroke, endStroke, inkPoints } from '../../src/tools/letters/ink.js'
import { scoreInk, createLetterGame, inkEvent } from '../../src/tools/letters/game.js'

const inkOf = (strokes) => {
  let ink = emptyInk()
  strokes.forEach((s, i) => {
    ink = startStroke(ink, i + 1, s[0])
    // extendStroke is not needed: feed whole stroke through ink reducer pieces
    for (const p of s.slice(1)) ink = { ...ink, strokes: ink.strokes.map((st, k) => (k === ink.strokes.length - 1 ? [...st, p] : st)), pointCount: ink.pointCount + 1 }
    ink = endStroke(ink, i + 1)
  })
  return ink
}
const trace = (g, k) => g.strokes[k].map((p) => ({ x: p.x, y: p.y }))
const centre = { x: 50, y: 25 }
const tapAt = (dx, dy) => [{ x: centre.x + dx, y: centre.y + dy }]
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7071, 0.7071], [-0.7071, -0.7071], [0.7071, -0.7071], [-0.7071, 0.7071]]

for (const id of ['i', 'j']) {
  const g = getGlyph(id)
  const stem = trace(g, 0)
  test(`${id}: stem + one tap within 5 units of the dot centre passes`, () => {
    for (const r of [0, 3, 5]) for (const [dx, dy] of DIRS) {
      const s = scoreInk(g, inkOf([stem, tapAt(r * dx, r * dy)]))
      assert.ok(s.done, `${id} r=${r} dir=${dx},${dy} cov=${s.coverage}`)
    }
  })
  test(`${id}: stem alone fails, tap alone fails, tap 12 away does not pass`, () => {
    assert.equal(scoreInk(g, inkOf([stem])).done, false)
    assert.ok(scoreInk(g, inkOf([stem])).coverage < 0.8, 'margin below 0.85')
    assert.equal(scoreInk(g, inkOf([tapAt(0, 0)])).done, false)
    for (const [dx, dy] of DIRS) assert.equal(scoreInk(g, inkOf([stem, tapAt(12 * dx, 12 * dy)])).done, false)
  })
  test(`${id}: dot is a tight cluster, far from the stem`, () => {
    const dot = g.strokes[1]
    assert.ok(dot.length >= 10)
    for (const p of dot) assert.ok(Math.hypot(p.x - centre.x, p.y - centre.y) <= 1.5)
    const gap = Math.min(...dot.flatMap((d) => g.strokes[0].map((p) => Math.hypot(d.x - p.x, d.y - p.y))))
    assert.ok(gap > 6)
  })
}

test('single-point ink stroke flows through start/end/inkPoints/score', () => {
  let ink = startStroke(emptyInk(), 7, { x: 50, y: 25 })
  assert.deepEqual(ink.strokes, [[{ x: 50, y: 25 }]])
  ink = endStroke(ink, 7)
  assert.equal(ink.activePointerId, null)
  assert.deepEqual(inkPoints(ink), [{ x: 50, y: 25 }])
  const g = getGlyph('i')
  let st = createLetterGame()
  st = { ...st, index: 0 }
  const s = scoreInk(g, ink)
  assert.ok(s.coverage > 0.2 && !s.done)
  // via the game reducer: stem as moves, then down+up tap on the dot
  const stem = trace(g, 0)
  let game = { ...createLetterGame() }
  const glyphs = [g]
  stem.forEach((p, i) => { game = inkEvent(game, { type: i ? 'move' : 'down', pointerId: 1, point: p }, glyphs) })
  game = inkEvent(game, { type: 'up', pointerId: 1 }, glyphs)
  assert.equal(game.done, false)
  game = inkEvent(game, { type: 'down', pointerId: 2, point: { x: 53, y: 27 } }, glyphs)
  game = inkEvent(game, { type: 'up', pointerId: 2 }, glyphs)
  assert.equal(game.done, true)
})

test('g: one stroke (bowl, stem, hook), within 0..100 and descender <= 95', () => {
  const g = getGlyph('g')
  assert.equal(g.strokes.length, 1)
  for (const p of g.strokes.flat()) assert.ok(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 95.01)
  assert.equal(scoreInk(g, inkOf([trace(g, 0)])).done, true)
  assert.equal(scoreInk(g, inkOf([trace(getGlyph('a'), 0)])).done, false)
})

test('y: both arms required, within 0..100, not passed by v', () => {
  const y = getGlyph('y')
  assert.equal(y.strokes.length, 2)
  for (const p of y.strokes.flat()) assert.ok(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100)
  assert.equal(scoreInk(y, inkOf([trace(y, 0)])).done, false)
  assert.equal(scoreInk(y, inkOf([trace(y, 1)])).done, false)
  assert.equal(scoreInk(y, inkOf([trace(y, 0), trace(y, 1)])).done, true)
  assert.equal(scoreInk(y, inkOf([trace(getGlyph('v'), 0)])).done, false)
})
