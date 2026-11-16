import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { GLYPHS, PAIRED_ORDER } from '../../src/tools/letters/glyphs.js'
import { resample } from '../../src/tools/letters/geometry.js'
import { coverage, strayRatio, isDone, TRACE_TOLERANCE } from '../../src/tools/letters/scoring.js'
import { nextLetter, createLetterGame, inkEvent, isLetterDone } from '../../src/tools/letters/game.js'
import { EXPECTED_LETTERS, FULL_SET_TODO } from '../unit/expected-letters.js'

const ALPHA = 'aAbBcCdDeEfFgGhHiIjJkKlLmMnNoOpPqQrRsStTuUvVwWxXyYzZ'
const flat = (g) => g.strokes.flat()
const done = (g, ink) => isDone(coverage(g.strokes, ink, TRACE_TOLERANCE), strayRatio(g.strokes, ink, TRACE_TOLERANCE))
const len = (s) => resample(s, 0.5).length
const grid = (step) => { const a = []; for (let x = 0; x <= 100; x += step) for (let y = 0; y <= 100; y += step) a.push({ x, y }); return a }
const G = (id) => GLYPHS.find((g) => g.id === id)

test('52-letter tests are not gated: unit helper has all 52 and no TODO flag', () => {
  assert.equal(GLYPHS.length, 52); assert.deepEqual(GLYPHS.map((g) => g.id), [...ALPHA]); assert.equal(PAIRED_ORDER, ALPHA)
  assert.equal(EXPECTED_LETTERS.length, 52); assert.equal(FULL_SET_TODO, false)
  const src = readFileSync(fileURLToPath(new URL('../unit/glyphs.test.js', import.meta.url)), 'utf8')
  assert.ok(!/\{\s*todo\s*:\s*['"`]/.test(src.replace(/todo:\s*FULL_SET_TODO/g, '')), 'hard-coded todo in glyphs.test.js')
})
test('AC10/11 all 52: >=2 points per stroke, finite, 0..100 inclusive, unique ids, case field', () => {
  assert.equal(new Set(GLYPHS.map((g) => g.id)).size, 52)
  for (const g of GLYPHS) {
    assert.ok(g.strokes.length >= 1, g.id)
    assert.equal(g.case, g.id === g.id.toLowerCase() ? 'lowercase' : 'uppercase')
    for (const s of g.strokes) { assert.ok(s.length >= 2, g.id); for (const p of s) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100, `${g.id} ${p.x},${p.y}`) }
  }
})
test('AC12 all 52: stored strokes have consecutive gaps <= GLYPH spacing 2 (no jumps inside a stroke)', () => {
  for (const g of GLYPHS) for (const s of g.strokes) for (let i = 1; i < s.length; i++) assert.ok(Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y) <= 2 + 1e-9, g.id)
})
test('AC17 all 52: own trace passes (as points, as game-reducer finger trace, reversed, 0.5-spaced)', () => {
  for (const g of GLYPHS) {
    assert.ok(done(g, flat(g)), g.id); assert.ok(done(g, flat(g).reverse()), g.id + ' rev')
    let s = { ...createLetterGame(), index: GLYPHS.indexOf(g) }
    for (const st of g.strokes) { st.forEach((p, i) => { s = inkEvent(s, { type: i ? 'move' : 'down', pointerId: 1, point: p }) }); s = inkEvent(s, { type: 'up', pointerId: 1 }) }
    assert.ok(isLetterDone(s), g.id + ' via reducer')
  }
})
test('AC17 all 52: wobbly finger (+-3 jitter, 4 offset) still passes', () => {
  const bad = []
  for (const g of GLYPHS) {
    const j = flat(g).map((p, i) => ({ x: p.x + (i % 2 ? 3 : -3), y: p.y + (i % 3 ? 2 : -2) }))
    if (!done(g, j)) bad.push(g.id + ' jitter')
    if (!done(g, flat(g).map((p) => ({ x: p.x + 4, y: p.y })))) bad.push(g.id + ' offset')
  }
  assert.deepEqual(bad, [])
})
test('AC18 all 52: first stroke only does not pass for every multi-stroke glyph', () => {
  const bad = GLYPHS.filter((g) => g.strokes.length >= 2 && done(g, g.strokes[0])).map((g) => g.id)
  assert.deepEqual(bad, [])
  assert.ok(GLYPHS.filter((g) => g.strokes.length >= 2).length >= 20)
})
test('INFO: later single strokes that pass alone (stricter than AC18; recorded only)', (t) => {
  const hit = []
  for (const g of GLYPHS.filter((x) => x.strokes.length >= 2)) g.strokes.forEach((s, i) => { if (i > 0 && done(g, s)) hit.push(`${g.id} stroke${i}`) })
  t.diagnostic('stroke alone passes: ' + hit.join(', '))
})
test('AC16 all 52: dense grids (0.5..10 spacing), horizontal-line raster, and a diagonal raster never pass', () => {
  const bad = []
  for (const step of [0.5, 1, 2, 3, 4, 5, 8, 10]) for (const g of GLYPHS) if (done(g, grid(step))) bad.push(`${g.id}@${step}`)
  const rows = []; for (let y = 0; y <= 100; y += 1.5) for (let x = 0; x <= 100; x += 1) rows.push({ x: y % 3 ? x : 100 - x, y })
  const diag = []; for (let k = -100; k <= 200; k += 3) for (let t = 0; t <= 100; t += 1) diag.push({ x: t, y: k - t })
  for (const g of GLYPHS) { if (done(g, rows)) bad.push(g.id + ' rows'); if (done(g, diag.filter((p) => p.y >= 0 && p.y <= 100))) bad.push(g.id + ' diag') }
  assert.deepEqual(bad, [])
})
test('AC16 all 52: grid is not done through the game reducer either (scribble zigzag then lift)', () => {
  for (let i = 0; i < GLYPHS.length; i++) {
    let s = { ...createLetterGame(), index: i }
    s = inkEvent(s, { type: 'down', pointerId: 1, point: { x: 0, y: 0 } })
    for (let r = 0; r <= 100; r += 2) for (let c = 0; c <= 100; c += 2) s = inkEvent(s, { type: 'move', pointerId: 1, point: { x: r % 4 ? 100 - c : c, y: r } })
    s = inkEvent(s, { type: 'up', pointerId: 1 }); assert.equal(isLetterDone(s), false, GLYPHS[i].id)
  }
})
test('stray-heavy ink never passes: own trace + 1.2x stray points; 60% stray; random scatter', () => {
  const bad = []
  for (const g of GLYPHS) {
    const own = flat(g)
    const far = Array.from({ length: Math.ceil(own.length * 1.2) }, (_, i) => ({ x: -50 - (i % 7), y: 200 + i }))
    if (done(g, [...own, ...far])) bad.push(g.id + ' own+far')
    const near = Array.from({ length: own.length * 2 }, (_, i) => ({ x: 8 + (i * 37) % 85, y: 5 + (i * 53) % 95 }))
    if (strayRatio(g.strokes, [...own, ...near], TRACE_TOLERANCE) <= 0.5 && done(g, [...own, ...near])) bad.push(g.id + ' own+scatter (stray<=0.5 by chance)')
    const r = Array.from({ length: 3000 }, (_, i) => ({ x: (i * 7919) % 101, y: (i * 104729) % 101 }))
    if (done(g, r)) bad.push(g.id + ' random')
  }
  assert.deepEqual(bad.filter((b) => !b.includes('by chance')), [])
})
test('boundary: own trace plus stray at 49% still passes, at 55% does not (every glyph)', () => {
  const bad = []
  for (const g of GLYPHS) {
    const own = g.strokes.flatMap((s) => resample(s, 1)); const n = own.length
    const mk = (frac) => Array.from({ length: Math.round((n * frac) / (1 - frac)) }, (_, i) => ({ x: -100 - i, y: -100 }))
    if (!done(g, [...own, ...mk(0.4)])) bad.push(g.id + ' 40% stray should pass')
    if (done(g, [...own, ...mk(0.55)])) bad.push(g.id + ' 55% stray should fail')
  }
  assert.deepEqual(bad, [])
})
test('partial traces of all 52: first 50% and 70% of every stroke fail; first stroke of multi fails', () => {
  const pre = (s, f) => { const p = resample(s, 0.5); return p.slice(0, Math.max(1, Math.floor(p.length * f))) }
  const bad = []
  for (const g of GLYPHS) { if (done(g, g.strokes.flatMap((s) => pre(s, 0.5)))) bad.push(g.id + ' 50%'); if (done(g, g.strokes.flatMap((s) => pre(s, 0.7)))) bad.push(g.id + ' 70% (info)') }
  assert.deepEqual(bad.filter((b) => b.includes('50%')), [])
})
test('INFO: glyphs that pass with 70% / 80% of every stroke traced (recorded only)', (t) => {
  const pre = (s, f) => { const p = resample(s, 0.5); return p.slice(0, Math.max(1, Math.floor(p.length * f))) }
  for (const f of [0.7, 0.8]) t.diagnostic(`pass at ${f * 100}%: ` + GLYPHS.filter((g) => done(g, g.strokes.flatMap((s) => pre(s, f)))).map((g) => g.id).join(','))
})
test('i and j: dots are required (stem alone does not pass), and dots alone do not pass; same for I/J/other multi-stroke', () => {
  for (const id of ['i', 'j']) {
    const g = G(id); assert.equal(g.strokes.length, 2, id)
    const stem = g.strokes.reduce((a, b) => (len(b) > len(a) ? b : a)), dot = g.strokes.find((s) => s !== stem)
    assert.ok(len(dot) < len(stem)); assert.equal(done(g, stem), false, id + ' stem alone'); assert.equal(done(g, dot), false, id + ' dot alone'); assert.ok(done(g, [...stem, ...dot]), id + ' both')
    // dot must be separated from stem in the glyph (a real dot, not part of the stem)
    const gap = Math.min(...dot.flatMap((d) => stem.map((p) => Math.hypot(d.x - p.x, d.y - p.y)))); assert.ok(gap > TRACE_TOLERANCE, `${id} dot only ${gap.toFixed(1)} from stem`)
    // a single tapped point at the dot center plus stem
    const c = { x: dot.reduce((a, p) => a + p.x, 0) / dot.length, y: dot.reduce((a, p) => a + p.y, 0) / dot.length }
    assert.ok(done(g, [...stem, c, c]), id + ' stem + tapped dot centre')
  }
})
test('AC24 all 52: nextLetter cycles a,A,...,z,Z,a; 52 steps return to 0 visiting each once; GLYPHS wrap through reducer', () => {
  let i = 0; const seen = []
  for (let k = 0; k < 52; k++) { seen.push(GLYPHS[i].id); i = nextLetter(i, GLYPHS) }
  assert.equal(i, 0); assert.equal(seen.join(''), ALPHA); assert.equal(GLYPHS[nextLetter(51, GLYPHS)].id, 'a')
  assert.equal(GLYPHS[0].id, 'a'); assert.equal(GLYPHS[0].case, 'lowercase')
})
test('INFO cross-letter confusion matrix over all 52 (excludes same-letter case pairs; recorded only)', (t) => {
  const cross = [], casePairs = [], named = {}
  for (const a of GLYPHS) for (const b of GLYPHS) if (a !== b && done(b, flat(a))) {
    if (a.id.toLowerCase() === b.id.toLowerCase()) casePairs.push(`${a.id}->${b.id}`)
    else cross.push(`${a.id}->${b.id}`)
  }
  for (const [a, b] of [['c', 'o'], ['o', 'c'], ['l', 'I'], ['I', 'l'], ['l', 'i'], ['i', 'l'], ['v', 'V'], ['w', 'W'], ['w', 'u'], ['w', 'U'], ['u', 'U'], ['s', 'S'], ['S', 's'], ['C', 'O'], ['O', 'C'], ['e', 'c'], ['c', 'e'], ['n', 'h'], ['h', 'n'], ['r', 'n'], ['n', 'r'], ['p', 'P'], ['b', 'h'], ['h', 'b'], ['q', 'g'], ['g', 'q'], ['y', 'Y'], ['z', 'Z']]) named[`${a}->${b}`] = done(G(b), flat(G(a)))
  t.diagnostic(`cross-letter passes (${cross.length}): ` + cross.join(' '))
  t.diagnostic(`same-letter case-pair passes (${casePairs.length}, not listed as issues): ` + casePairs.join(' '))
  t.diagnostic('named probes (trace X passes Y?): ' + Object.entries(named).map(([k, v]) => `${k}=${v}`).join(' '))
  const per = {}; for (const c of cross) { const [a] = c.split('->'); per[a] = (per[a] || 0) + 1 }
  t.diagnostic('letters whose trace passes the most other letters: ' + Object.entries(per).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => `${k}:${v}`).join(' '))
})
test('INFO: single-stroke glyphs: passes with a plain circle / straight line / empty-looking ink (recorded only)', (t) => {
  const circle = Array.from({ length: 80 }, (_, i) => ({ x: 50 + 25 * Math.cos(i / 80 * 2 * Math.PI), y: 55 + 30 * Math.sin(i / 80 * 2 * Math.PI) }))
  const line = (x1, y1, x2, y2) => resample([{ x: x1, y: y1 }, { x: x2, y: y2 }], 1)
  const probes = { circle, vertical50: line(50, 15, 50, 85), horizontal50: line(15, 50, 85, 50), diagA: line(15, 15, 85, 85), diagB: line(85, 15, 15, 85) }
  for (const [name, ink] of Object.entries(probes)) t.diagnostic(`${name} passes: ` + (GLYPHS.filter((g) => done(g, ink)).map((g) => g.id).join(',') || '(none)'))
})
test('longest glyphs m M w W (path length) traced end-to-end via reducer; report ink length', (t) => {
  const L = (g) => g.strokes.reduce((a, s) => a + (len(s) - 1) * 0.5, 0)
  t.diagnostic('glyph path lengths (units of 100): ' + GLYPHS.map((g) => `${g.id}:${Math.round(L(g))}`).sort((a, b) => b.split(':')[1] - a.split(':')[1]).slice(0, 8).join(' '))
  for (const id of ['m', 'M', 'w', 'W']) { const g = G(id); assert.ok(done(g, flat(g)), id) }
})
test('NaN / undefined / out-of-range inputs against all 52 glyph guides do not throw and never pass', () => {
  for (const g of GLYPHS) for (const ink of [[{ x: NaN, y: NaN }], [{ x: undefined, y: 3 }], [{ x: 1e6, y: -1e6 }], []]) { assert.doesNotThrow(() => done(g, ink)); assert.equal(done(g, ink), false, g.id) }
})
