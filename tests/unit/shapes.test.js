import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  SHAPES, SHAPE_ORDER, getShape, shapeLabel, closedPolygon, starVertices,
  TRACE_TOLERANCE, COVERAGE_THRESHOLD, STRAY_THRESHOLD, PARENT_HOLD_MS,
} from '../../src/tools/shapes/shapes.js'
import * as scoring from '../../src/tools/letters/scoring.js'
import * as hold from '../../src/tools/letters/parent-hold.js'

const IDS = ['circle', 'square', 'triangle', 'rectangle', 'oval', 'star']
const bbox = (s) => {
  const p = s.strokes.flat()
  const xs = p.map((q) => q.x), ys = p.map((q) => q.y)
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys)
  return { w, h }
}

test('AC6 six shapes in order, valid points, getShape, no assets in source', () => {
  assert.deepEqual(SHAPES.map((s) => s.id), IDS)
  assert.deepEqual(SHAPE_ORDER, IDS)
  for (const s of SHAPES) {
    assert.ok(s.strokes.length > 0)
    for (const st of s.strokes) {
      assert.ok(st.length >= 2)
      for (const p of st) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y))
    }
  }
  const src = fs.readFileSync(new URL('../../src/tools/shapes/shapes.js', import.meta.url), 'utf8')
  for (const b of ['fetch(', 'url(', '.png', '.svg', '@font-face', 'new Image', 'http']) assert.ok(!src.includes(b), b)
  assert.equal(getShape('circle').id, 'circle')
  assert.equal(getShape('x'), undefined)
})

test('shapes are deep-frozen and helpers behave', () => {
  assert.ok(Object.isFrozen(SHAPES) && Object.isFrozen(SHAPES[0]) && Object.isFrozen(SHAPES[0].strokes[0][0]))
  const v = [[0, 0], [1, 0], [1, 1]]
  const c = closedPolygon(v)
  assert.equal(c.length, 4)
  assert.deepEqual(c[3], [0, 0])
  assert.notEqual(c[3], v[0])
  assert.equal(v.length, 3)
  const sv = starVertices(50, 52, 40, 16)
  assert.equal(sv.length, 10)
  assert.ok(Math.abs(sv[0][0] - 50) < 1e-9 && Math.abs(sv[0][1] - 12) < 1e-9)
})

test('AC7 all points within 0..100', () => {
  for (const s of SHAPES) for (const p of s.strokes.flat()) assert.ok(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100, s.id)
})

test('AC8 one stroke per shape, closed', () => {
  for (const s of SHAPES) {
    assert.equal(s.strokes.length, 1, s.id)
    const st = s.strokes[0]
    const a = st[0], b = st[st.length - 1]
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) <= 1, s.id)
  }
})

test('AC9 proportions', (t) => {
  const by = Object.fromEntries(SHAPES.map((s) => [s.id, bbox(s)]))
  t.diagnostic(JSON.stringify(by))
  assert.ok(by.rectangle.w / by.rectangle.h >= 1.8)
  for (const id of ['square', 'circle']) assert.ok(Math.abs(by[id].w - by[id].h) / Math.max(by[id].w, by[id].h) <= 0.05, id)
  assert.ok(by.oval.w <= 0.7 * by.oval.h)
  assert.ok(by.oval.w <= 0.7 * by.circle.w)
})

test('AC10 rule constants are the letters values', () => {
  assert.equal(TRACE_TOLERANCE, 6)
  assert.equal(COVERAGE_THRESHOLD, 0.85)
  assert.equal(STRAY_THRESHOLD, 0.5)
  assert.equal(PARENT_HOLD_MS, 1000)
  assert.ok(TRACE_TOLERANCE === scoring.TRACE_TOLERANCE && COVERAGE_THRESHOLD === scoring.COVERAGE_THRESHOLD)
  assert.ok(STRAY_THRESHOLD === scoring.STRAY_THRESHOLD && PARENT_HOLD_MS === hold.PARENT_HOLD_MS)
})

test('AC19 labels are lowercase names', () => {
  for (const id of IDS) {
    assert.equal(shapeLabel(getShape(id)), id)
    assert.match(shapeLabel(getShape(id)), /^[a-z]+$/)
  }
})
