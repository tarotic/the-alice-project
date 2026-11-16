import test from 'node:test'
import assert from 'node:assert/strict'
import { GLYPHS, PAIRED_ORDER } from '../../src/tools/letters/glyphs.js'
import { resample } from '../../src/tools/letters/geometry.js'
import { coverage, strayRatio, isDone, guidePoints, TRACE_TOLERANCE } from '../../src/tools/letters/scoring.js'
import { nextLetter } from '../../src/tools/letters/game.js'

const flat = (g) => g.strokes.flat()
const grid = (step) => { const a = []; for (let x = 0; x <= 100; x += step) for (let y = 0; y <= 100; y += step) a.push({ x, y }); return a }
const score = (g, ink) => ({ c: coverage(g.strokes, ink, TRACE_TOLERANCE), s: strayRatio(g.strokes, ink, TRACE_TOLERANCE) })
const done = (g, ink) => { const r = score(g, ink); return isDone(r.c, r.s) }
// first `frac` of arc length of a stroke
function prefix(stroke, frac) {
  const pts = resample(stroke, 0.5)
  return pts.slice(0, Math.max(1, Math.floor(pts.length * frac)))
}

test('AC16 dense grids of many spacings are never done, every glyph', () => {
  const bad = []
  for (const step of [0.5, 1, 2, 3, 4, 5, 8, 10]) for (const g of GLYPHS) {
    if (done(g, grid(step))) bad.push(`${g.id}@${step}`)
  }
  assert.deepEqual(bad, [])
})
test('AC16 grid with exactly-on-guide points added still reports stray>0.5 for dense grid', () => {
  for (const g of GLYPHS) assert.ok(score(g, grid(1)).s > 0.5, g.id)
})
test('AC17 own points done; reversed and jittered(+-3) and offset(4) traces done', () => {
  for (const g of GLYPHS) {
    assert.ok(done(g, flat(g)), g.id + ' own')
    assert.ok(done(g, flat(g).slice().reverse()), g.id + ' reversed')
    const j = flat(g).map((p, i) => ({ x: p.x + (i % 2 ? 3 : -3), y: p.y + (i % 3 ? 2 : -2) }))
    assert.ok(done(g, j), g.id + ' jitter')
    assert.ok(done(g, flat(g).map((p) => ({ x: p.x + 4, y: p.y }))), g.id + ' offset 4 x')
  }
})
test('AC17 trace done when ink is a single dense stroke segment per glyph stroke, drawn at 0.5 spacing', () => {
  for (const g of GLYPHS) assert.ok(done(g, g.strokes.flatMap((s) => resample(s, 0.5))), g.id)
})
test('AC18 first stroke only is not done for every multi-stroke glyph', () => {
  for (const g of GLYPHS.filter((x) => x.strokes.length >= 2)) assert.ok(!done(g, g.strokes[0]), g.id)
})
test('INFO proper subsets of strokes that still count as done (stricter than AC18; recorded only)', (t) => {
  const hit = []
  for (const g of GLYPHS.filter((x) => x.strokes.length >= 2)) {
    const n = g.strokes.length
    for (let mask = 1; mask < (1 << n) - 1; mask++) if (done(g, g.strokes.filter((_, i) => mask & (1 << i)).flat())) hit.push(`${g.id} strokes-mask=${mask}`)
  }
  t.diagnostic('subsets done: ' + hit.join(', '))
})
test('partial trace: first 60% of every stroke is not done; first 99% of each stroke is done-or-not but never throws', () => {
  for (const g of GLYPHS) {
    assert.ok(!done(g, g.strokes.flatMap((s) => prefix(s, 0.6))), g.id + ' 60%')
    for (const f of [0.8, 0.99]) score(g, g.strokes.flatMap((s) => prefix(s, f)))
  }
})
test('INFO single-stroke glyphs completed by only 70% of the stroke (recorded only)', (t) => {
  const hit = GLYPHS.filter((g) => g.strokes.length === 1 && done(g, prefix(g.strokes[0], 0.7))).map((g) => g.id)
  t.diagnostic('done at 70%: ' + hit.join(','))
})
test('single-stroke glyphs: 40% of the stroke is not done', () => {
  for (const g of GLYPHS.filter((x) => x.strokes.length === 1)) assert.ok(!done(g, prefix(g.strokes[0], 0.4)), g.id)
})
test('INFO letter a: ink of only a plain circle (no stem) is done?', (t) => {
  const g = GLYPHS.find((x) => x.id === 'a'); const o = GLYPHS.find((x) => x.id === 'o')
  const circle = o.strokes[0].map((p) => ({ x: p.x, y: p.y + 0 }))
  t.diagnostic('o-shaped circle passes a: ' + done(g, circle))
})
test('single-point ink and a tap on every guide point individually are not done', () => {
  for (const g of GLYPHS) {
    for (const p of [flat(g)[0], { x: 0, y: 0 }, { x: 50, y: 50 }]) assert.ok(!done(g, [p]), g.id)
  }
})
test('AC13 empty ink 0, exact ink 1, tolerance 0 with exact ink 1, results within 0..1 for random ink', () => {
  for (const g of GLYPHS) {
    assert.equal(coverage(g.strokes, [], 6), 0)
    assert.equal(coverage(g.strokes, guidePoints(g.strokes), 6), 1)
    assert.equal(coverage(g.strokes, guidePoints(g.strokes), 0), 1)
    assert.equal(strayRatio(g.strokes, guidePoints(g.strokes), 0), 0)
    for (let i = 0; i < 20; i++) {
      const ink = Array.from({ length: 1 + (i * 7) % 50 }, () => ({ x: Math.random() * 140 - 20, y: Math.random() * 140 - 20 }))
      const { c, s } = score(g, ink)
      assert.ok(c >= 0 && c <= 1 && s >= 0 && s <= 1)
    }
  }
})
test('AC14 empty ink 0; entirely away 1; away = far outside box', () => {
  for (const g of GLYPHS) {
    assert.equal(strayRatio(g.strokes, [], 6), 0)
    assert.equal(strayRatio(g.strokes, [{ x: 1000, y: 1000 }, { x: -500, y: 3 }], 6), 1)
  }
})
test('NaN / undefined / out-of-range inputs to scoring do not throw and never say done', () => {
  const g = GLYPHS[0]
  const nanInk = [{ x: NaN, y: NaN }, { x: undefined, y: 1 }]
  assert.doesNotThrow(() => score(g, nanInk))
  assert.ok(!done(g, nanInk))
  assert.equal(isDone(NaN, 0), false); assert.equal(isDone(1, NaN), false)
  assert.equal(isDone(undefined, undefined), false)
  assert.equal(isDone(0.85, 0.5), true); assert.equal(isDone(0.8499999, 0.5), false); assert.equal(isDone(0.85, 0.5000001), false)
  const wild = [{ strokes: [[{ x: -3000, y: 3000 }, { x: 3000, y: -3000 }]] }]
  assert.doesNotThrow(() => coverage(wild[0].strokes, flat(g), 6))
  assert.equal(coverage([], flat(g), 6), 0)
  assert.equal(strayRatio([], flat(g), 6), 1)
})
test('INFO isDone coerces numeric strings (recorded only)', (t) => { t.diagnostic('isDone("1","0") = ' + isDone('1', '0')) })
test('huge ink (50k points) scores in reasonable time against the largest glyph', () => {
  const g = GLYPHS.reduce((a, b) => (flat(b).length > flat(a).length ? b : a))
  const ink = Array.from({ length: 50000 }, (_, i) => ({ x: (i * 7) % 100, y: (i * 13) % 100 }))
  const t = Date.now(); score(g, ink); assert.ok(Date.now() - t < 5000, `took ${Date.now() - t}ms`)
})
test('AC10/11 glyph data: >=2 finite points per stroke, 0..100, plan convention 15..85, no NaN, unique ids, paired order', () => {
  const ids = GLYPHS.map((g) => g.id)
  assert.equal(new Set(ids).size, ids.length)
  let last = -1
  for (const g of GLYPHS) {
    const idx = PAIRED_ORDER.indexOf(g.id); assert.ok(idx > last, g.id + ' order'); last = idx
    assert.ok(g.strokes.length >= 1)
    for (const s of g.strokes) { assert.ok(s.length >= 2); for (const p of s) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y))
      assert.ok(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100, g.id)
      assert.ok(p.x >= 15 - 1e-9 && p.x <= 85 + 1e-9, `${g.id} x=${p.x} outside plan convention 15..85`)
    } }
    assert.equal(g.case, g.id === g.id.toLowerCase() ? 'lowercase' : 'uppercase')
  }
  assert.ok(Object.isFrozen(GLYPHS[0]) && Object.isFrozen(GLYPHS[0].strokes[0][0]))
})
test('AC11 full set: 52 glyphs exist (a-z, A-Z)', { todo: GLYPHS.length < 52 ? 'increment 1b: ' + (52 - GLYPHS.length) + ' glyphs not yet implemented' : false }, () => {
  assert.equal(GLYPHS.length, 52, `only ${GLYPHS.length} glyphs implemented; missing: ${[...PAIRED_ORDER].filter((c) => !GLYPHS.some((g) => g.id === c)).join('')}`)
})
test('AC12 resample property test: gap<=spacing, endpoints kept, no NaN, on random polylines incl. repeats', () => {
  for (let t = 0; t < 300; t++) {
    const n = 2 + Math.floor(Math.random() * 20), sp = [0.3, 1, 2, 7, 150][t % 5]
    const st = []
    for (let i = 0; i < n; i++) { const p = i && Math.random() < 0.2 ? st[i - 1] : { x: Math.random() * 100, y: Math.random() * 100 }; st.push({ ...p }) }
    const out = resample(st, sp)
    assert.deepEqual(out[0], st[0]); assert.deepEqual(out.at(-1), st.at(-1))
    for (const p of out) assert.ok(Number.isFinite(p.x + p.y))
    // gap is measured along the path by contract; Euclidean gap is a lower bound so must be <= spacing too
    for (let i = 1; i < out.length; i++) assert.ok(Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y) <= sp + 1e-9)
  }
})
test('AC12 resample edge cases', () => {
  assert.deepEqual(resample([], 2), [])
  assert.deepEqual(resample([{ x: 1, y: 1 }], 2), [{ x: 1, y: 1 }])
  assert.deepEqual(resample([{ x: 1, y: 1 }, { x: 1, y: 1 }], 2), [{ x: 1, y: 1 }])
  for (const bad of [0, -1, NaN, Infinity, undefined, null, '2']) assert.throws(() => resample([{ x: 0, y: 0 }, { x: 5, y: 0 }], bad))
  assert.equal(resample([{ x: 0, y: 0 }, { x: 1e5, y: 0 }], 2).length, 50001)
})
test('AC24 nextLetter: 52 steps over the paired alphabet cycle back; GLYPHS wrap too', () => {
  const full = [...PAIRED_ORDER]
  let i = 0, seen = new Set()
  for (let k = 0; k < 52; k++) { seen.add(i); i = nextLetter(i, full) }
  assert.equal(i, 0); assert.equal(seen.size, 52)
  assert.equal(nextLetter(51, full), 0)
  assert.equal(full[0], 'a'); assert.equal(full[1], 'A'); assert.equal(full[50], 'z'); assert.equal(full[51], 'Z')
  assert.throws(() => nextLetter(0, []))
  let j = 0; for (let k = 0; k < GLYPHS.length; k++) j = nextLetter(j, GLYPHS); assert.equal(j, 0)
  assert.equal(GLYPHS[0].id, 'a')
})
