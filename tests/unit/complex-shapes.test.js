import test from 'node:test'
import assert from 'node:assert/strict'
import { PICTURES, PICTURE_ORDER, getPicture, pictureLabel } from '../../src/tools/complex/pictures.js'
import { TRACE_TOLERANCE, COVERAGE_THRESHOLD, STRAY_THRESHOLD, PARENT_HOLD_MS } from '../../src/tools/complex/pictures.js'
import { coverage, strayRatio, isDone } from '../../src/tools/letters/scoring.js'
import { resample } from '../../src/tools/letters/geometry.js'
import { SEQUENCE_MODE } from '../../src/tools/letters/modes.js'
import { goNext, createLetterGame } from '../../src/tools/letters/game.js'
import { listTools } from '../../src/registry.js'
import '../../src/tools/index.js'

const IDS = ['rocket ship', 'cat', 'dog', 'flower', 'bus', 'star']
const own = (p) => p.strokes.flatMap((s) => resample(s, 2))
const done = (g, ink) => isDone(coverage(g.strokes, ink, TRACE_TOLERANCE), strayRatio(g.strokes, ink, TRACE_TOLERANCE))

test('the six pictures in order, with the letters scoring values unchanged', () => {
  assert.deepEqual(PICTURES.map((p) => p.id), IDS)
  assert.deepEqual(PICTURE_ORDER, IDS)
  assert.equal(TRACE_TOLERANCE, 6)
  assert.equal(COVERAGE_THRESHOLD, 0.85)
  assert.equal(STRAY_THRESHOLD, 0.5)
  assert.equal(PARENT_HOLD_MS, 1000)
  assert.equal(getPicture('cat').id, 'cat')
  assert.equal(getPicture('nope'), undefined)
  for (const p of PICTURES) assert.equal(pictureLabel(p), p.id)
})

test('each picture is several strokes of finite points, all inside 0..100, and deep frozen', () => {
  for (const p of PICTURES) {
    assert.ok(p.strokes.length >= 2, p.id)
    for (const s of p.strokes) {
      assert.ok(s.length >= 2, p.id)
      for (const q of s) {
        assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y), p.id)
        assert.ok(q.x >= 0 && q.x <= 100 && q.y >= 0 && q.y <= 100, p.id + ' ' + q.x + ',' + q.y)
      }
    }
  }
  assert.ok(Object.isFrozen(PICTURES) && Object.isFrozen(PICTURES[0]) && Object.isFrozen(PICTURES[0].strokes[0][0]))
})

test('tracing every stroke of a picture is done', () => {
  for (const p of PICTURES) assert.equal(done(p, own(p)), true, p.id)
})

test('tracing only the first stroke is not done, nor is an empty pad or a dense scribble', () => {
  const grid = []
  for (let x = 0; x <= 100; x += 3) for (let y = 0; y <= 100; y += 3) grid.push({ x, y })
  for (const p of PICTURES) {
    assert.equal(done(p, resample(p.strokes[0], 2)), false, 'first stroke only: ' + p.id)
    assert.equal(done(p, []), false, 'empty: ' + p.id)
    assert.equal(done(p, grid), false, 'scribble: ' + p.id)
  }
})

test('no picture passes as a different picture', () => {
  for (const a of PICTURES) {
    for (const b of PICTURES) {
      if (a === b) continue
      assert.equal(done(b, own(a)), false, `${a.id} traced as ${b.id}`)
    }
  }
})

test('Next visits the six pictures in order and wraps back to the rocket ship', () => {
  let s = createLetterGame(SEQUENCE_MODE)
  const seen = [s.index]
  for (let i = 0; i < 6; i++) { s = goNext(s, PICTURES); seen.push(s.index) }
  assert.deepEqual(seen, [0, 1, 2, 3, 4, 5, 0])
})

test('the complex tool is registered after Shapes with the label "Complex shapes"', () => {
  const t = listTools()
  assert.deepEqual(t.map((x) => x.id), ['timer', 'letters', 'shapes', 'complex'])
  assert.equal(t[3].label, 'Complex shapes')
})
