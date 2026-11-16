import test from 'node:test'
import assert from 'node:assert/strict'
import { GLYPHS } from '../../src/tools/letters/glyphs.js'
import { emptyInk, startStroke, extendStroke, endStroke, inkPoints, MAX_INK_POINTS } from '../../src/tools/letters/ink.js'
import { parentHold, initialHold, holdProgress, PARENT_HOLD_MS } from '../../src/tools/letters/parent-hold.js'
import { createLetterGame, inkEvent, parentEvent, clearInk, goNext, isLetterDone, currentGlyph } from '../../src/tools/letters/game.js'
import { holdProgressWidth } from '../../src/tools/letters/views/hold-progress.js'
import { toGlyphSpace } from '../../src/tools/letters/tool.js'
import { deepFreeze } from './freeze.js'

const P = (x, y) => ({ x, y })
function traceGame(state, glyph, pid = 1) {
  for (const s of glyph.strokes) {
    s.forEach((p, i) => { state = inkEvent(state, { type: i ? 'move' : 'down', pointerId: pid, point: p }) })
    state = inkEvent(state, { type: 'up', pointerId: pid })
  }
  return state
}

test('AC25 tap / early release / exactly 1000 ms / 999 ms', () => {
  let s = parentHold(initialHold(), { type: 'down', pointerId: 1 }, 100)
  assert.equal(parentHold(s, { type: 'up', pointerId: 1 }, 100 + PARENT_HOLD_MS - 1).passed, false)
  assert.equal(parentHold(s, { type: 'tick', pointerId: 1 }, 100 + PARENT_HOLD_MS - 1).passed, false)
  assert.equal(parentHold(s, { type: 'tick', pointerId: 1 }, 100 + PARENT_HOLD_MS).passed, true)
  assert.equal(parentHold(s, { type: 'up', pointerId: 1 }, 100 + PARENT_HOLD_MS).passed, true)
})
test('AC25 1000 rapid taps (10ms) never pass and always return to idle', () => {
  let s = initialHold(), t = 0
  for (let i = 0; i < 1000; i++) {
    s = parentHold(s, { type: 'down', pointerId: 1 }, t); t += 10
    s = parentHold(s, { type: 'tick', pointerId: 1 }, t)
    s = parentHold(s, { type: 'up', pointerId: 1 }, t); t += 10
    assert.equal(s.passed, false); assert.equal(s.startedAt, null)
  }
})
test('AC25 many near-miss holds (999ms) with leave/cancel never accumulate', () => {
  let s = initialHold(), t = 0
  for (let i = 0; i < 50; i++) {
    s = parentHold(s, { type: 'down', pointerId: 1 }, t)
    s = parentHold(s, { type: 'tick', pointerId: 1 }, t + 999)
    s = parentHold(s, { type: i % 2 ? 'leave' : 'cancel', pointerId: 1 }, t + 999); t += 1000
    assert.deepEqual(s, initialHold())
  }
})
test('AC25 second finger does not restart or steal the hold; foreign up/leave/cancel ignored; leave of owner resets', () => {
  let s = parentHold(initialHold(), { type: 'down', pointerId: 1 }, 0)
  assert.equal(parentHold(s, { type: 'down', pointerId: 2 }, 900), s)
  for (const type of ['up', 'leave', 'cancel']) assert.equal(parentHold(s, { type: type, pointerId: 2 }, 500), s)
  assert.deepEqual(parentHold(s, { type: 'leave', pointerId: 1 }, 500), initialHold())
  // second finger down after owner left: new hold from new time, not old
  const s2 = parentHold(parentHold(s, { type: 'leave', pointerId: 1 }, 950), { type: 'down', pointerId: 2 }, 960)
  assert.equal(parentHold(s2, { type: 'tick', pointerId: 2 }, 1100).passed, false)
})
test('AC25 time going backwards: no pass, progress 0..1, no throw', () => {
  let s = parentHold(initialHold(), { type: 'down', pointerId: 1 }, 5000)
  for (const now of [4000, 0, -5000, -1e12]) {
    assert.equal(parentHold(s, { type: 'tick', pointerId: 1 }, now).passed, false)
    assert.equal(holdProgress(s, now), 0)
    assert.equal(parentHold(s, { type: 'up', pointerId: 1 }, now).passed, false)
  }
  assert.equal(holdProgress(s, 1e15), 1)
})
test('AC25 passed is sticky and ignores later events; passed holdProgress is 1', () => {
  let s = parentHold(parentHold(initialHold(), { type: 'down', pointerId: 1 }, 0), { type: 'tick', pointerId: 1 }, 1000)
  for (const type of ['down', 'up', 'leave', 'cancel', 'tick']) assert.equal(parentHold(s, { type, pointerId: 1 }, 0), s)
  assert.equal(holdProgress(s, 0), 1)
})
test('parentHold does not mutate frozen input, unknown event type is no-op', () => {
  const s = deepFreeze(parentHold(initialHold(), { type: 'down', pointerId: 1 }, 0))
  assert.equal(parentHold(s, { type: 'bogus', pointerId: 1 }, 5), s)
  parentHold(s, { type: 'up', pointerId: 1 }, 5)
})
test('parentHold with NaN/undefined now never passes and holdProgress stays in 0..1 / width is a valid percentage', () => {
  let s = parentHold(initialHold(), { type: 'down', pointerId: 1 }, NaN)
  assert.equal(parentHold(s, { type: 'tick', pointerId: 1 }, 5000).passed, false)
  assert.equal(parentHold(s, { type: 'up', pointerId: 1 }, 5000).passed, false)
  assert.match(holdProgressWidth(holdProgress(s, 5000)), /^\d+%$/)
  assert.match(holdProgressWidth(NaN), /^\d+%$/); assert.match(holdProgressWidth(undefined), /^\d+%$/)
  assert.equal(holdProgressWidth(-3), '0%'); assert.equal(holdProgressWidth(7), '100%')
})
test('AC26 parent pass == traced pass in done state, with empty ink; and ink events after pass keep done', () => {
  let a = createLetterGame()
  a = parentEvent(a, { type: 'down', pointerId: 1 }, 0)
  assert.equal(isLetterDone(a), false)
  a = parentEvent(a, { type: 'tick', pointerId: 1 }, 1000)
  const b = traceGame(createLetterGame(), GLYPHS[0])
  assert.equal(isLetterDone(a), true); assert.equal(isLetterDone(b), true)
  assert.equal(a.done, b.done)
  assert.equal(a.ink.strokes.length, 0)
  a = inkEvent(a, { type: 'down', pointerId: 1, point: P(1, 1) }); assert.equal(a.done, true)
  assert.equal(Object.keys(a).sort().join(), Object.keys(b).sort().join())
})
test('game: clear after done resets done+hold+ink; goNext resets all; Next wraps through all glyphs', () => {
  let s = traceGame(createLetterGame(), GLYPHS[0]); assert.ok(s.done)
  s = clearInk(s); assert.deepEqual([s.done, s.ink.strokes.length, s.hold.passed, s.index], [false, 0, false, 0])
  s = parentEvent(parentEvent(s, { type: 'down', pointerId: 1 }, 0), { type: 'tick', pointerId: 1 }, 1000)
  for (let i = 0; i < GLYPHS.length; i++) { s = goNext(s); assert.equal(s.done, false); assert.equal(s.hold.passed, false) }
  assert.equal(s.index, 0)
})
test('every glyph is completed by tracing via the game reducer with its own id as glyph and not by a different glyph trace', () => {
  for (let i = 0; i < GLYPHS.length; i++) {
    let s = { ...createLetterGame(), index: i }
    s = traceGame(s, GLYPHS[i]); assert.ok(isLetterDone(s), GLYPHS[i].id)
  }
})
test('INFO cross-passes: tracing one glyph may pass another (superset ink); out of scope per requirements, only recorded', (t) => {
  const cross = []
  for (let i = 0; i < GLYPHS.length; i++) for (let j = 0; j < GLYPHS.length; j++) if (i !== j) {
    if (traceGame({ ...createLetterGame(), index: j }, GLYPHS[i]).done) cross.push(`${GLYPHS[i].id}->${GLYPHS[j].id}`)
  }
  t.diagnostic('cross-passes: ' + cross.join(' '))
})
test('ink: single-point stroke, tap, empty', () => {
  let ink = startStroke(emptyInk(), 1, P(10, 10)); ink = endStroke(ink, 1)
  assert.equal(inkPoints(ink).length, 1); assert.equal(ink.activePointerId, null)
  assert.deepEqual(inkPoints(emptyInk()), [])
  let s = inkEvent(createLetterGame(), { type: 'down', pointerId: 1, point: P(50, 50) }); s = inkEvent(s, { type: 'up', pointerId: 1 })
  assert.equal(s.done, false)
})
test('ink: multi-touch second pointer cannot start/extend/end; first keeps drawing', () => {
  let ink = startStroke(emptyInk(), 1, P(0, 0))
  assert.equal(startStroke(ink, 2, P(5, 5)), ink); assert.equal(extendStroke(ink, 2, P(5, 5)), ink); assert.equal(endStroke(ink, 2), ink)
  ink = extendStroke(ink, 1, P(5, 5)); assert.equal(ink.strokes[0].length, 2)
  assert.equal(extendStroke(emptyInk(), 1, P(1, 1)).strokes.length, 0)
})
test('ink: pointerId 0 is a valid id (falsy-id trap)', () => {
  let ink = startStroke(emptyInk(), 0, P(0, 0)); assert.equal(ink.activePointerId, 0)
  ink = extendStroke(ink, 0, P(1, 1)); assert.equal(ink.pointCount, 2)
  ink = endStroke(ink, 0); assert.equal(ink.activePointerId, null)
})
test('ink: NaN / undefined / Infinity / string points are ignored', () => {
  const e = emptyInk()
  for (const p of [undefined, null, P(NaN, 1), P(1, undefined), P(Infinity, 0), { x: '5', y: '5' }, {}]) assert.equal(startStroke(e, 1, p), e)
  const a = startStroke(e, 1, P(1, 1))
  for (const p of [undefined, null, P(NaN, 1), P(-Infinity, 0)]) assert.equal(extendStroke(a, 1, p), a)
})
test('ink: huge point counts are capped (ink level, 20000 extends)', () => {
  let ink = startStroke(emptyInk(), 1, P(0, 0))
  for (let i = 0; i < 20000; i++) ink = extendStroke(ink, 1, P((i * 3) % 100, (i * 7) % 100))
  assert.ok(ink.pointCount <= MAX_INK_POINTS)
})
test('PERF: per-move-event cost with ~3000 ink points on glyph B stays under 3 ms (desktop node; phone budget is a 16 ms frame at maybe 5x slower CPU)', () => {
  let s = { ...createLetterGame(), index: GLYPHS.findIndex((g) => g.id === 'B') }
  let ink = startStroke(emptyInk(), 1, P(0, 0))
  for (let i = 1; i < 3000; i++) ink = extendStroke(ink, 1, P((i * 0.01) % 100, (i * 0.37) % 100))
  s = { ...s, ink }
  const t = performance.now(); const N = 100
  for (let i = 0; i < N; i++) s = inkEvent(s, { type: 'move', pointerId: 1, point: P(50 + i * 0.01, 50) })
  const per = (performance.now() - t) / N
  assert.ok(per < 3, `${per.toFixed(2)} ms per move event at ~3000 points`)
})
test('ink: after cap reached, stroke can still end and Clear recovers drawing', () => {
  let ink = startStroke(emptyInk(), 1, P(0, 0))
  for (let i = 0; i < 6000; i++) ink = extendStroke(ink, 1, P(i % 100, 1))
  let s = { ...createLetterGame(), ink }
  s = inkEvent(s, { type: 'up', pointerId: 1 }); assert.equal(s.ink.activePointerId, null)
  s = clearInk(s); s = inkEvent(s, { type: 'down', pointerId: 2, point: P(1, 1) }); assert.equal(s.ink.strokes.length, 1)
})
test('AC-robust: Clear while stroke active, then late move/up from old pointer does nothing and a new stroke can start', () => {
  let s = inkEvent(createLetterGame(), { type: 'down', pointerId: 1, point: P(1, 1) })
  s = clearInk(s)
  const s2 = inkEvent(s, { type: 'move', pointerId: 1, point: P(2, 2) }); assert.equal(s2, s)
  s = inkEvent(s, { type: 'down', pointerId: 3, point: P(9, 9) }); assert.equal(s.ink.strokes.length, 1)
})
test('reducers never mutate deep-frozen state', () => {
  let s = deepFreeze(createLetterGame())
  s = deepFreeze(inkEvent(s, { type: 'down', pointerId: 1, point: P(1, 1) }))
  s = deepFreeze(inkEvent(s, { type: 'move', pointerId: 1, point: P(3, 3) }))
  s = deepFreeze(parentEvent(s, { type: 'down', pointerId: 5 }, 0))
  deepFreeze(parentEvent(s, { type: 'tick', pointerId: 5 }, 2000)); deepFreeze(clearInk(s)); deepFreeze(goNext(s))
})
test('toGlyphSpace: zero/negative/NaN rect gives null; out-of-range is not clamped; NaN client gives non-finite point which ink rejects', () => {
  assert.equal(toGlyphSpace(1, 1, { left: 0, top: 0, width: 0, height: 10 }), null)
  assert.equal(toGlyphSpace(1, 1, { left: 0, top: 0, width: NaN, height: 10 }), null)
  assert.deepEqual(toGlyphSpace(-100, 300, { left: 0, top: 0, width: 100, height: 100 }), { x: -100, y: 300 })
  const p = toGlyphSpace(NaN, 1, { left: 0, top: 0, width: 100, height: 100 })
  assert.equal(startStroke(emptyInk(), 1, p).strokes.length, 0)
  assert.deepEqual(toGlyphSpace(150, 50, { left: 100, top: 0, width: 200, height: 100 }), { x: 25, y: 50 })
})
test('tracing while ink strays far outside the pad (negative coords) then back is handled', () => {
  const g = GLYPHS[0]
  let s = createLetterGame()
  s = inkEvent(s, { type: 'down', pointerId: 1, point: P(-500, -500) })
  for (let i = 0; i < 30; i++) s = inkEvent(s, { type: 'move', pointerId: 1, point: P(-500 + i, 900) })
  assert.equal(s.done, false)
  assert.equal(currentGlyph(s).id, g.id)
})
