// One contract for every drawing a child can trace (letters, shapes, pictures).
// A new item added to any collection gets these checks automatically, with no test edits.
import test from 'node:test'
import assert from 'node:assert/strict'
import { GLYPHS } from '../../src/tools/letters/glyphs.js'
import { SHAPES } from '../../src/tools/shapes/shapes.js'
import { PICTURES } from '../../src/tools/complex/pictures.js'
import { coverage, strayRatio, isDone, TRACE_TOLERANCE } from '../../src/tools/letters/scoring.js'
import { resample } from '../../src/tools/letters/geometry.js'

const own = (item) => item.strokes.flatMap((s) => resample(s, 2))
const done = (item, ink) => isDone(coverage(item.strokes, ink, TRACE_TOLERANCE), strayRatio(item.strokes, ink, TRACE_TOLERANCE))
const GRID = []
for (let x = 0; x <= 100; x += 3) for (let y = 0; y <= 100; y += 3) GRID.push({ x, y })

// Known, accepted look-alikes (see docs/letters-shapes/shapes/requirements.md AC17). Each entry is "traced -> wrongly passes".
const SHAPE_KNOWN = new Set(['oval->circle', 'circle->oval', 'rectangle->square', 'square->rectangle'])

const collections = [
  { name: 'letters', items: GLYPHS, crossCheck: false, note: 'letters have known confusions (see docs/letters-shapes/letters/test-report.md); cross-check is reported, not enforced' },
  { name: 'shapes', items: SHAPES, crossCheck: true, allowed: SHAPE_KNOWN },
  { name: 'pictures', items: PICTURES, crossCheck: true, allowed: new Set() },
]

for (const c of collections) {
  test(`${c.name}: every item is a non-empty list of strokes inside 0..100`, () => {
    assert.ok(c.items.length > 0)
    for (const item of c.items) {
      assert.ok(item.strokes.length >= 1, `${c.name} ${item.id}`)
      for (const s of item.strokes) for (const p of s) assert.ok(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100, `${c.name} ${item.id}`)
    }
  })

  test(`${c.name}: tracing an item is done; empty and dense-scribble pads are not`, () => {
    for (const item of c.items) {
      assert.equal(done(item, own(item)), true, `${c.name} own trace: ${item.id}`)
      assert.equal(done(item, []), false, `${c.name} empty: ${item.id}`)
      assert.equal(done(item, GRID), false, `${c.name} scribble: ${item.id}`)
    }
  })

  test(`${c.name}: a multi-stroke item is not done from its first stroke alone`, () => {
    for (const item of c.items.filter((i) => i.strokes.length > 1)) {
      assert.equal(done(item, resample(item.strokes[0], 2)), false, `${c.name} first stroke: ${item.id}`)
    }
  })

  if (c.crossCheck) {
    test(`${c.name}: no item is passed by another item's trace, except accepted look-alikes`, () => {
      const bad = []
      for (const a of c.items) for (const b of c.items) {
        if (a === b) continue
        const key = `${a.id}->${b.id}`
        if (c.allowed.has(key)) continue
        if (done(b, own(a))) bad.push(key)
      }
      assert.deepEqual(bad, [])
    })
  }
}
