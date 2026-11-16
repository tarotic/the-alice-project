import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SHAPES, SHAPE_ORDER, getShape, shapeLabel } from '../../src/tools/shapes/shapes.js'
import { GLYPHS } from '../../src/tools/letters/glyphs.js'
import { resample } from '../../src/tools/letters/geometry.js'
import { coverage, strayRatio, isDone, TRACE_TOLERANCE, COVERAGE_THRESHOLD, STRAY_THRESHOLD } from '../../src/tools/letters/scoring.js'
import { PARENT_HOLD_MS } from '../../src/tools/letters/parent-hold.js'
import { createLetterGame, inkEvent, parentEvent, goNext, clearInk, nextLetter, isLetterDone } from '../../src/tools/letters/game.js'

const IDS = ['circle', 'square', 'triangle', 'rectangle', 'oval', 'star']
const S = (id) => SHAPES.find((s) => s.id === id)
const flat = (s) => s.strokes.flat()
const cov = (g, ink) => coverage(g.strokes, ink, TRACE_TOLERANCE)
const str = (g, ink) => strayRatio(g.strokes, ink, TRACE_TOLERANCE)
const done = (g, ink) => isDone(cov(g, ink), str(g, ink))
const bbox = (s) => { const p = flat(s); const xs = p.map((q) => q.x), ys = p.map((q) => q.y); return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) } }
const grid = (step) => { const a = []; for (let x = 0; x <= 100; x += step) for (let y = 0; y <= 100; y += step) a.push({ x, y }); return a }
const prefix = (s, f) => { const p = resample(s.strokes[0], 0.5); return p.slice(0, Math.max(1, Math.floor(p.length * f))) }
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const jitter = (pts, amp) => pts.map((p) => ({ x: p.x + (rnd() * 2 - 1) * amp, y: p.y + (rnd() * 2 - 1) * amp }))

test('AC6 exactly six shapes in order, stroke data only, frozen, lookups', () => {
  assert.deepEqual(SHAPES.map((s) => s.id), IDS); assert.deepEqual(SHAPE_ORDER, IDS)
  for (const s of SHAPES) { assert.ok(s.strokes.length >= 1); for (const st of s.strokes) { assert.ok(st.length >= 2); for (const p of st) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y)) } }
  assert.ok(Object.isFrozen(SHAPES) && Object.isFrozen(SHAPES[0].strokes[0][0]))
  assert.equal(getShape('nope'), undefined); assert.equal(getShape('star').id, 'star')
  const src = readFileSync(new URL('../../src/tools/shapes/shapes.js', import.meta.url), 'utf8')
  for (const bad of ['fetch(', 'url(', '.png', '.svg', '@font-face', 'new Image', 'http']) assert.ok(!src.includes(bad), bad)
})
test('AC7 all points within 0..100; AC8 each stroke closed within 1 unit (report exact gap)', (t) => {
  for (const s of SHAPES) {
    for (const st of s.strokes) for (const p of st) assert.ok(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100, s.id)
    for (const st of s.strokes) { const gap = Math.hypot(st[0].x - st.at(-1).x, st[0].y - st.at(-1).y); assert.ok(gap < 1, s.id + ' gap ' + gap) }
    for (const st of s.strokes) for (let i = 1; i < st.length; i++) assert.ok(Math.hypot(st[i].x - st[i - 1].x, st[i].y - st[i - 1].y) <= 2 + 1e-9, s.id + ' gap in stroke')
  }
  t.diagnostic('bboxes: ' + SHAPES.map((s) => { const b = bbox(s); return `${s.id}:${b.w.toFixed(1)}x${b.h.toFixed(1)}` }).join(' '))
})
test('AC9 aspect ratios', (t) => {
  const b = Object.fromEntries(SHAPES.map((s) => [s.id, bbox(s)]))
  assert.ok(b.rectangle.w / b.rectangle.h >= 1.8, 'rect ' + b.rectangle.w / b.rectangle.h)
  assert.ok(Math.abs(b.square.w - b.square.h) / Math.max(b.square.w, b.square.h) <= 0.05)
  assert.ok(Math.abs(b.circle.w - b.circle.h) / Math.max(b.circle.w, b.circle.h) <= 0.05)
  assert.ok(b.oval.w / b.oval.h <= 0.7, 'oval ratio ' + b.oval.w / b.oval.h); assert.ok(b.oval.w <= 0.7 * b.circle.w, 'oval vs circle width')
  t.diagnostic(`rect ratio ${(b.rectangle.w / b.rectangle.h).toFixed(2)}, oval w/h ${(b.oval.w / b.oval.h).toFixed(2)}, oval w / circle w ${(b.oval.w / b.circle.w).toFixed(2)}`)
})
test('AC10 constants equal letters values', () => {
  assert.equal(TRACE_TOLERANCE, 6); assert.equal(COVERAGE_THRESHOLD, 0.85); assert.equal(STRAY_THRESHOLD, 0.5); assert.equal(PARENT_HOLD_MS, 1000)
})
test('AC11/15 own trace passes (points, reversed, 0.5-spaced, via reducer); empty ink fails', () => {
  for (const s of SHAPES) {
    assert.ok(done(s, flat(s)), s.id); assert.ok(done(s, flat(s).reverse()), s.id + ' rev'); assert.ok(done(s, resample(s.strokes[0], 0.5)), s.id + ' fine')
    assert.equal(done(s, []), false); assert.equal(cov(s, []), 0); assert.equal(str(s, []), 0)
    let g = { ...createLetterGame(), index: SHAPES.indexOf(s) }
    s.strokes[0].forEach((p, i) => { g = inkEvent(g, { type: i ? 'move' : 'down', pointerId: 1, point: p }, SHAPES) }); assert.equal(g.done, false, s.id + ' not done before lift')
    g = inkEvent(g, { type: 'up', pointerId: 1 }, SHAPES); assert.equal(g.done, true, s.id + ' done after lift')
  }
})
test('AC12 60% / 50% unclosed trace fails; AC13 single-stroke count asserted', () => {
  for (const s of SHAPES) { assert.equal(done(s, prefix(s, 0.6)), false, s.id + ' 60%'); assert.equal(done(s, prefix(s, 0.5)), false, s.id + ' 50%') }
  assert.equal(SHAPES.filter((s) => s.strokes.length >= 2).length, 0)
})
test('INFO where an unclosed trace starts to pass (percent of outline, 1% steps; recorded)', (t) => {
  const out = SHAPES.map((s) => { let first = null; for (let f = 0.3; f <= 1.0001; f += 0.01) if (done(s, prefix(s, f))) { first = Math.round(f * 100); break } return `${s.id}:${first}%` })
  t.diagnostic('first passing prefix: ' + out.join(' '))
  for (const s of SHAPES) for (const f of [0.7, 0.8]) t.diagnostic(`${s.id} @${f * 100}% -> ${done(s, prefix(s, f))} (cov ${cov(s, prefix(s, f)).toFixed(2)})`)
})
test('AC14 grid scribbles of many spacings never pass, all six; zigzag and raster too', () => {
  for (const step of [0.5, 1, 2, 3, 5, 8, 10]) for (const s of SHAPES) assert.equal(done(s, grid(step)), false, `${s.id}@${step}`)
  const rows = []; for (let y = 0; y <= 100; y += 1.5) for (let x = 0; x <= 100; x += 1) rows.push({ x: Math.round(y / 1.5) % 2 ? x : 100 - x, y })
  for (const s of SHAPES) assert.equal(done(s, rows), false, s.id)
})
test('degenerate inks fail: tiny circle (centre and on outline), lines through the middle, single points, stray-heavy, NaN/huge', () => {
  const tiny = (cx, cy, r) => Array.from({ length: 40 }, (_, i) => ({ x: cx + r * Math.cos(i / 40 * 6.283), y: cy + r * Math.sin(i / 40 * 6.283) }))
  const line = (a, b, c, d) => resample([{ x: a, y: b }, { x: c, y: d }], 1)
  for (const s of SHAPES) {
    const p0 = s.strokes[0][0]
    for (const ink of [tiny(50, 50, 3), tiny(50, 50, 10), tiny(p0.x, p0.y, 4), line(0, 50, 100, 50), line(50, 0, 50, 100), line(0, 0, 100, 100), line(100, 0, 0, 100), line(10, 50, 90, 50), [p0], [{ x: 50, y: 50 }], [{ x: NaN, y: NaN }], [{ x: 1e6, y: 1e6 }]]) assert.equal(done(s, ink), false, s.id)
    const own = flat(s)
    assert.equal(done(s, [...own, ...Array.from({ length: Math.ceil(own.length * 1.2) }, (_, i) => ({ x: -50 - (i % 9), y: 200 + i }))]), false, s.id + ' stray-heavy')
    const mk = (f) => Array.from({ length: Math.round(own.length * f / (1 - f)) }, (_, i) => ({ x: -100 - i, y: -100 }))
    assert.equal(done(s, [...own, ...mk(0.4)]), true, s.id + ' 40% stray tolerated'); assert.equal(done(s, [...own, ...mk(0.55)]), false, s.id + ' 55% stray')
  }
})
test('single taps anywhere (1-unit grid around the box) and 50 rapid taps never pass any shape', () => {
  for (const s of SHAPES) {
    for (let x = -5; x <= 105; x++) for (let y = -5; y <= 105; y++) assert.equal(done(s, [{ x, y }]), false, `${s.id}@${x},${y}`)
    assert.equal(done(s, Array.from({ length: 50 }, (_, i) => ({ x: s.strokes[0][i % 4].x, y: s.strokes[0][i % 4].y }))), false)
  }
})
test('AC16/17 pairwise matrix: no shape\'s own trace passes any other shape; numbers recorded', (t) => {
  const rows = []; const bad = []
  for (const a of SHAPES) for (const b of SHAPES) if (a !== b) {
    const c = cov(b, flat(a)), r = str(b, flat(a)); rows.push(`${a.id}->${b.id}: cov ${c.toFixed(2)} stray ${r.toFixed(2)}`)
    if (isDone(c, r)) bad.push(`${a.id}->${b.id}`)
  }
  t.diagnostic('pairs (ink of A against B guide):\n' + rows.join('\n'))
  assert.deepEqual(bad, [])
  for (const [a, b] of [['circle', 'oval'], ['oval', 'circle'], ['square', 'rectangle'], ['rectangle', 'square']]) assert.equal(done(S(b), flat(S(a))), false, `${a}->${b}`)
})
test('modest finger jitter (2 and 3 units), offsets, and +-5% scale still pass own trace; recorded max jitter', (t) => {
  const bad = []
  for (const s of SHAPES) {
    for (const amp of [1, 2, 3]) for (let k = 0; k < 20; k++) if (!done(s, jitter(resample(s.strokes[0], 1), amp))) bad.push(`${s.id} jitter ${amp} #${k}`)
    for (const [dx, dy] of [[3, 0], [0, 3], [-3, -3], [4, 4]]) if (!done(s, flat(s).map((p) => ({ x: p.x + dx, y: p.y + dy })))) bad.push(`${s.id} offset ${dx},${dy}`)
    for (const k of [0.95, 1.05]) if (!done(s, flat(s).map((p) => ({ x: 50 + (p.x - 50) * k, y: 50 + (p.y - 50) * k })))) bad.push(`${s.id} scale ${k}`)
  }
  assert.deepEqual(bad, [])
  t.diagnostic('uniform random jitter amplitude where 20/20 trials still pass: ' + SHAPES.map((s) => { let m = 0; for (let a = 1; a <= 10; a += 0.5) { let ok = true; for (let k = 0; k < 20; k++) if (!done(s, jitter(resample(s.strokes[0], 1), a))) ok = false; if (ok) m = a }; return `${s.id}:${m}` }).join(' '))
})
test('INFO sloppy traces: jittered/offset/scaled trace of one shape against its look-alike (recorded; AC17 known limitation)', (t) => {
  const out = []
  for (const [a, b] of [['circle', 'oval'], ['oval', 'circle'], ['square', 'rectangle'], ['rectangle', 'square']]) {
    for (const [name, tr] of [['offset 5', (p) => ({ x: p.x + 5, y: p.y })], ['scale .85 about centre', (p) => ({ x: 50 + (p.x - 50) * 0.85, y: 50 + (p.y - 50) * 0.85 })], ['scale 1.15', (p) => ({ x: 50 + (p.x - 50) * 1.15, y: 50 + (p.y - 50) * 1.15 })]])
      out.push(`${a}(${name})->${b}: ${done(S(b), flat(S(a)).map(tr))}`)
  }
  t.diagnostic(out.join('; '))
})
test('AC21 shape order and wrap through goNext/nextLetter; 6 steps return to 0 visiting each once', () => {
  let s = createLetterGame(); const seen = []
  for (let k = 0; k < 6; k++) { seen.push(SHAPES[s.index].id); s = goNext(s, SHAPES) }
  assert.deepEqual(seen, IDS); assert.equal(s.index, 0); assert.equal(nextLetter(5, SHAPES), 0)
  for (const [i, id] of IDS.entries()) assert.equal(shapeLabel(SHAPES[i]), id)
  for (const id of IDS) assert.equal(shapeLabel(S(id)), id.toLowerCase())
})
test('AC23 parent hold for shapes at the reducer level: passes at >=1000 for any ink (also with scribble), not at 999/tap/leave/cancel', () => {
  for (let i = 0; i < 6; i++) {
    const base = { ...createLetterGame(), index: i }
    let s = parentEvent(parentEvent(base, { type: 'down', pointerId: 1 }, 10), { type: 'tick', pointerId: 1 }, 1010); assert.equal(isLetterDone(s), true)
    s = parentEvent(parentEvent(base, { type: 'down', pointerId: 1 }, 10), { type: 'up', pointerId: 1 }, 1009); assert.equal(isLetterDone(s), false)
    for (const t of ['leave', 'cancel']) assert.equal(isLetterDone(parentEvent(parentEvent(base, { type: 'down', pointerId: 1 }, 0), { type: t, pointerId: 1 }, 5000)), false)
    let scr = base; scr = inkEvent(scr, { type: 'down', pointerId: 1, point: { x: 1, y: 1 } }, SHAPES); scr = inkEvent(scr, { type: 'up', pointerId: 1 }, SHAPES)
    assert.equal(isLetterDone(parentEvent(parentEvent(scr, { type: 'down', pointerId: 2 }, 0), { type: 'up', pointerId: 2 }, 1000)), true)
    assert.equal(isLetterDone(clearInk(s)), false)
  }
})
test('AC26 src/tools/shapes exists with files; scan covers it; forbidden strings absent in shapes/ and letters/tool.js', () => {
  const dir = fileURLToPath(new URL('../../src/tools/shapes/', import.meta.url))
  assert.ok(existsSync(dir)); const files = readdirSync(dir); assert.ok(files.length >= 2)
  const bad = ['http://', 'https://', 'fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'document.cookie', '@import url(', '<script src="http']
  for (const f of files) { const t = readFileSync(dir + f, 'utf8'); for (const b of bad) assert.ok(!t.includes(b), f + ' ' + b); assert.ok(!/ramona|alice/i.test(t), f) }
})
// ---- letters carry-over: g ----
test('g carry-over: a-trace does not pass g; g own trace passes; descender within 0..100; cross-letter record for g', (t) => {
  const g = GLYPHS.find((x) => x.id === 'g'), a = GLYPHS.find((x) => x.id === 'a')
  assert.equal(done(g, flat(a)), false, 'a over g'); assert.ok(cov(g, flat(a)) < 0.85)
  assert.ok(done(g, flat(g)))
  for (const p of flat(g)) assert.ok(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100, `g point ${p.x},${p.y}`)
  assert.ok(Math.max(...flat(g).map((p) => p.y)) > 85, 'g has a descender below the baseline')
  t.diagnostic(`a over g coverage ${cov(g, flat(a)).toFixed(3)} stray ${str(g, flat(a)).toFixed(3)}`)
  const passes = GLYPHS.filter((o) => o.id !== 'g' && done(o, flat(g))).map((o) => o.id), passedBy = GLYPHS.filter((o) => o.id !== 'g' && done(g, flat(o))).map((o) => o.id)
  t.diagnostic(`tracing g also passes: ${passes.join(',') || '(none)'}; tracing these passes g: ${passedBy.join(',') || '(none)'}`)
  assert.equal(done(g, flat(GLYPHS.find((x) => x.id === 'o'))), false); assert.equal(done(g, flat(GLYPHS.find((x) => x.id === 'q'))), false)
})
test('letters unchanged: 52 glyphs in paired order, each own trace passes, nextLetter wraps over all 52, first glyph a', () => {
  assert.equal(GLYPHS.length, 52); assert.equal(GLYPHS[0].id, 'a')
  let i = 0; for (let k = 0; k < 52; k++) { assert.ok(done(GLYPHS[i], flat(GLYPHS[i]))); i = nextLetter(i, GLYPHS) } assert.equal(i, 0)
})
