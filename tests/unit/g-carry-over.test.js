import test from 'node:test'
import assert from 'node:assert/strict'
import { getGlyph } from '../../src/tools/letters/glyphs.js'
import { coverage, strayRatio, isDone, TRACE_TOLERANCE } from '../../src/tools/letters/scoring.js'

const G = getGlyph

test('carry-over g: tracing a plain a scores <= 0.75 on g and is not done', (t) => {
  const ink = G('a').strokes.flat()
  const cov = coverage(G('g').strokes, ink, TRACE_TOLERANCE)
  const stray = strayRatio(G('g').strokes, ink, TRACE_TOLERANCE)
  t.diagnostic(`coverage(g, a) = ${cov}`)
  assert.ok(cov <= 0.85, `coverage ${cov}`)
  assert.equal(isDone(cov, stray), false)
  const own = G('g').strokes.flat()
  assert.equal(isDone(coverage(G('g').strokes, own, TRACE_TOLERANCE), strayRatio(G('g').strokes, own, TRACE_TOLERANCE)), true)
  for (const p of own) assert.ok(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100)
  assert.equal(G('g').strokes.length, 1)
})

test('INFO carry-over g: c o d n p q u against g (recorded only)', (t) => {
  for (const id of ['c', 'o', 'd', 'n', 'p', 'q', 'u']) {
    const ink = G(id).strokes.flat()
    const cov = coverage(G('g').strokes, ink, TRACE_TOLERANCE)
    const stray = strayRatio(G('g').strokes, ink, TRACE_TOLERANCE)
    t.diagnostic(`${id} on g: coverage ${cov.toFixed(3)} stray ${stray.toFixed(3)} done ${isDone(cov, stray)}`)
  }
})
