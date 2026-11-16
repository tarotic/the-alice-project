import test from 'node:test'
import assert from 'node:assert/strict'
import { GLYPHS } from '../../src/tools/letters/glyphs.js'
import { createLetterGame, inkEvent, isLetterDone, clearInk } from '../../src/tools/letters/game.js'
import { coverage, strayRatio, isDone, TRACE_TOLERANCE } from '../../src/tools/letters/scoring.js'
import { MAX_INK_POINTS } from '../../src/tools/letters/ink.js'

const G = (id) => GLYPHS.find((g) => g.id === id)
const idx = (id) => GLYPHS.findIndex((g) => g.id === id)
const start = (id) => ({ ...createLetterGame(), index: idx(id) })
let pid = 1
const stroke = (s, pts) => { const id = pid++; pts.forEach((p, i) => { s = inkEvent(s, { type: i ? 'move' : 'down', pointerId: id, point: p }) }); return inkEvent(s, { type: 'up', pointerId: id }) }
const tap = (s, x, y) => stroke(s, [{ x, y }])
const stem = (s, g) => stroke(s, g.strokes[0])
const ptsDone = (g, ink) => isDone(coverage(g.strokes, ink, TRACE_TOLERANCE), strayRatio(g.strokes, ink, TRACE_TOLERANCE))
const DIRS16 = Array.from({ length: 16 }, (_, k) => [Math.cos((k * Math.PI) / 8), Math.sin((k * Math.PI) / 8)])

for (const id of ['i', 'j']) {
  const g = G(id), C = { x: 50, y: 25 }
  test(`${id}: stem + tap at offsets 0..5 in 16 directions passes`, () => {
    for (const r of [0, 1, 2, 3, 4, 5]) for (const [dx, dy] of DIRS16) assert.ok(isLetterDone(tap(stem(start(id), g), C.x + r * dx, C.y + r * dy)), `${id} r=${r} d=${dx.toFixed(2)},${dy.toFixed(2)}`)
  })
  test(`${id}: INFO max passing tap radius (recorded) and far taps >=12 never pass`, (t) => {
    let maxR = 0
    for (let r = 0; r <= 20; r += 0.5) if (DIRS16.every(([dx, dy]) => isLetterDone(tap(stem(start(id), g), C.x + r * dx, C.y + r * dy)))) maxR = r
    t.diagnostic(`${id} tap passes in all 16 directions up to radius ${maxR}`)
    for (const r of [12, 13, 15, 20, 40]) for (const [dx, dy] of DIRS16) assert.equal(isLetterDone(tap(stem(start(id), g), C.x + r * dx, C.y + r * dy)), false, `${id} r=${r}`)
  })
  test(`${id}: tap with finger jitter (2-3 points within 2 units) passes`, () => {
    for (const [dx, dy] of DIRS16) {
      const pts = [{ x: 50 + 2 * dx, y: 25 + 2 * dy }, { x: 50 - 1 * dy, y: 25 + 1 * dx }, { x: 50 + dx, y: 25 + dy }]
      assert.ok(isLetterDone(stroke(stem(start(id), g), pts)), id)
      assert.ok(isLetterDone(stroke(stem(start(id), g), pts.slice(0, 2))), id + ' 2pts')
    }
  })
  test(`${id}: stem alone fails; tap alone fails; tap then nothing fails; stem without hook (j) fails; far tap fails`, () => {
    assert.equal(isLetterDone(stem(start(id), g)), false)
    assert.equal(isLetterDone(tap(start(id), 50, 25)), false)
    const noHook = g.strokes[0].filter((p) => p.y <= 85 || id === 'i')
    assert.equal(isLetterDone(tap(stroke(start(id), noHook), 50, 25)), id === 'i', `${id} stem(+without hook)+dot`)
    assert.equal(isLetterDone(tap(stem(start(id), g), 50, 55)), false)
  })
  test(`${id}: tap before the stem, double tap, repeated taps all pass; stem then tap at the stem end does not`, () => {
    assert.ok(isLetterDone(stem(tap(start(id), 50, 25), g)))
    assert.ok(isLetterDone(tap(tap(stem(start(id), g), 50, 25), 50, 25)))
    let s = stem(start(id), g); for (let k = 0; k < 50; k++) s = tap(s, 50 + (k % 5) * 0.5, 25 + (k % 3) * 0.5)
    assert.ok(isLetterDone(s)); assert.ok(s.ink.pointCount <= MAX_INK_POINTS)
    assert.equal(isLetterDone(tap(stem(start(id), g), 50, 80)), false)
  })
  test(`${id}: taps only (50 rapid taps on the dot, no stem) never pass; 50 scattered taps + stem is recorded not asserted`, (t) => {
    let s = start(id); for (let k = 0; k < 50; k++) s = tap(s, 50 + (k % 4) * 0.4, 25)
    assert.equal(isLetterDone(s), false)
    let r = stem(start(id), g); for (let k = 0; k < 50; k++) r = tap(r, (k * 37) % 100, (k * 53) % 100)
    t.diagnostic(`${id}: stem + 50 scattered taps done = ${isLetterDone(r)}`)
  })
  test(`${id}: reward comes from the tap on pointer DOWN (scoring on down), while the finger is still pressed`, () => {
    let s = stem(start(id), g); s = inkEvent(s, { type: 'down', pointerId: 77, point: C })
    assert.equal(isLetterDone(s), true, 'recorded design: tap scores on press')
  })
}
test('cap: 6000 taps near the dot cannot grow ink beyond the cap and clear recovers', () => {
  let s = stem(start('i'), G('i'))
  for (let k = 0; k < 6000; k++) s = tap(s, 50, 90 + (k % 3))
  assert.ok(s.ink.pointCount <= MAX_INK_POINTS)
  s = clearInk(s); s = stem(s, G('i')); s = tap(s, 50, 25); assert.ok(isLetterDone(s))
})
test('NO tap-only path passes any glyph: every single tap on a 1-unit grid over (and around) the box, for all 52', () => {
  const bad = []
  for (const g of GLYPHS) for (let x = -10; x <= 110; x++) for (let y = -10; y <= 110; y++) if (ptsDone(g, [{ x, y }])) bad.push(`${g.id}@${x},${y}`)
  assert.deepEqual(bad, [])
})
test('NO tap cluster passes any glyph: 2 and 3 taps near each glyph point, 50 taps at random, for all 52', () => {
  const bad = []
  for (const g of GLYPHS) {
    const pts = g.strokes.flat()
    for (let i = 0; i < pts.length; i += 7) { if (ptsDone(g, [pts[i], pts[(i * 3 + 11) % pts.length]])) bad.push(g.id + ' 2taps'); if (ptsDone(g, [pts[i], pts[(i + 5) % pts.length], pts[(i * 5 + 3) % pts.length]])) bad.push(g.id + ' 3taps') }
    const rnd = Array.from({ length: 50 }, (_, k) => ({ x: (k * 7919) % 101, y: (k * 104729) % 101 })); if (ptsDone(g, rnd)) bad.push(g.id + ' random50')
  }
  assert.deepEqual([...new Set(bad)], [])
})
test('the i/j dot centre tap plus any one other tap cannot pass l, I, t, T, f, or any non-dot glyph', () => {
  const bad = []
  for (const g of GLYPHS.filter((x) => x.id !== 'i' && x.id !== 'j')) for (let y = 0; y <= 100; y += 5) if (ptsDone(g, [{ x: 50, y: 25 }, { x: 50, y }])) bad.push(`${g.id} dot+tap@${y}`)
  assert.deepEqual(bad, [])
})
test('stem + dot-centre tap (an i drawn) passes which other letters? recorded', (t) => {
  const out = []
  for (const id of ['i', 'j']) { const ink = [...G(id).strokes.flat()]; for (const g of GLYPHS) if (g.id !== id && ptsDone(g, ink)) out.push(`${id}->${g.id}`) }
  t.diagnostic('i/j drawing passes: ' + out.join(' '))
  // also: a stem-and-a-tap on an unrelated letter
  const l = G('l'); t.diagnostic('l stem + tap at (50,25) passes: ' + ptsDone(l, [...l.strokes.flat(), { x: 50, y: 25 }]) + '; l stem alone passes i: ' + ptsDone(G('i'), l.strokes.flat()))
})
test('INFO g and y: own trace, partial traces, cross-letter record', (t) => {
  for (const id of ['g', 'y']) {
    const g = G(id), full = g.strokes.flat()
    const passes = GLYPHS.filter((o) => o.id !== id && ptsDone(o, full)).map((o) => o.id), passedBy = GLYPHS.filter((o) => o.id !== id && ptsDone(g, o.strokes.flat())).map((o) => o.id)
    t.diagnostic(`${id}: strokes=${g.strokes.length}; tracing ${id} also passes: ${passes.join(',') || '(none)'}; tracing these passes ${id}: ${passedBy.join(',') || '(none)'}`)
    assert.ok(ptsDone(g, full), id)
    assert.ok(!GLYPHS.filter((o) => g.strokes.length > 1 && ptsDone(g, g.strokes[0])).length)
    for (const f of [0.4, 0.5]) { const p = g.strokes.flatMap((s) => s.slice(0, Math.floor(s.length * f))); assert.equal(ptsDone(g, p), false, `${id} ${f}`) }
  }
  const y = G('y'); assert.equal(ptsDone(y, y.strokes[0]), false, 'y left arm alone'); assert.equal(ptsDone(y, y.strokes[1]), false, 'y right arm alone')
  const g = G('g'); assert.equal(ptsDone(g, g.strokes[0].slice(0, 49)), false, 'g bowl only'); assert.equal(ptsDone(G('g'), G('o').strokes[0]), false, 'plain circle passes g')
})
test('moves never change done for any glyph: whole-glyph and scribble streams, evaluated per event', () => {
  for (let i = 0; i < GLYPHS.length; i++) {
    let s = { ...createLetterGame(), index: i }
    for (const st of GLYPHS[i].strokes) {
      st.forEach((p, k) => { const before = s.done; s = inkEvent(s, { type: k ? 'move' : 'down', pointerId: 1, point: p }); if (k) assert.equal(s.done, before, GLYPHS[i].id + ' move changed done') })
      s = inkEvent(s, { type: 'up', pointerId: 1 })
    }
    assert.ok(s.done, GLYPHS[i].id)
  }
})
