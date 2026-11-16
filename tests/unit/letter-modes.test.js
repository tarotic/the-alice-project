import test from 'node:test'
import assert from 'node:assert/strict'
import { GLYPHS, getGlyph } from '../../src/tools/letters/glyphs.js'
import { SEQUENCE_MODE, MODE_OPTIONS, PICK_LETTERS, modeIndices, startIndex, nextIndex } from '../../src/tools/letters/modes.js'
import { createLetterGame, goNext, setMode, inkEvent, isLetterDone } from '../../src/tools/letters/game.js'
import { SHAPES, starVertices } from '../../src/tools/shapes/shapes.js'

const ids = (list) => list.map((i) => GLYPHS[i].id).join('')

test('modes: the selector offers A to Z, a single letter, and random, in that order', () => {
  assert.deepEqual(MODE_OPTIONS.map((o) => o.kind), ['sequence', 'pick', 'random'])
  assert.deepEqual(MODE_OPTIONS.map((o) => o.label), ['A to Z', 'Pick a letter', 'Random'])
  assert.equal(PICK_LETTERS.length, 26)
  assert.equal(PICK_LETTERS[0], 'a'); assert.equal(PICK_LETTERS[25], 'z')
})

test('A to Z: every glyph in paired order, and next wraps from Z back to a', () => {
  assert.equal(ids(modeIndices(SEQUENCE_MODE, GLYPHS)), GLYPHS.map((g) => g.id).join(''))
  let i = startIndex(SEQUENCE_MODE, GLYPHS)
  assert.equal(GLYPHS[i].id, 'a')
  const seen = []
  for (let k = 0; k < GLYPHS.length; k++) { seen.push(GLYPHS[i].id); i = nextIndex(i, SEQUENCE_MODE, GLYPHS) }
  assert.equal(i, 0)
  assert.equal(seen.join(''), GLYPHS.map((g) => g.id).join(''))
})

test('pick a letter: only the lower and upper glyph for that letter, lower first, wrapping between them', () => {
  const mode = { kind: 'pick', letter: 'c' }
  assert.equal(ids(modeIndices(mode, GLYPHS)), 'cC')
  const first = startIndex(mode, GLYPHS)
  assert.equal(GLYPHS[first].id, 'c')
  const second = nextIndex(first, mode, GLYPHS)
  assert.equal(GLYPHS[second].id, 'C')
  assert.equal(nextIndex(second, mode, GLYPHS), first)
})

test('pick a letter: every letter a to z has exactly its two glyphs', () => {
  for (const letter of PICK_LETTERS) {
    const list = modeIndices({ kind: 'pick', letter }, GLYPHS)
    assert.equal(list.length, 2, letter)
    assert.deepEqual(list.map((i) => GLYPHS[i].id).sort(), [letter, letter.toUpperCase()].sort(), letter)
  }
})

test('random: never repeats the current glyph, and every other glyph can come up', () => {
  const mode = { kind: 'random' }
  const seen = new Set()
  let i = 10
  for (let k = 0; k < 4000; k++) {
    const j = nextIndex(i, mode, GLYPHS)
    assert.notEqual(j, i)
    assert.ok(j >= 0 && j < GLYPHS.length)
    seen.add(j); i = j
  }
  assert.equal(seen.size, GLYPHS.length)
})

test('random: uses the injected rng, and a constant rng cannot loop forever', () => {
  assert.equal(nextIndex(0, { kind: 'random' }, GLYPHS, () => 0), 1)
  assert.equal(nextIndex(5, { kind: 'random' }, GLYPHS, () => 0), 0)
  assert.equal(nextIndex(5, { kind: 'random' }, GLYPHS, () => 0.999999), GLYPHS.length - 1)
  assert.equal(nextIndex(0, { kind: 'random' }, [GLYPHS[0]]), 0)
})

test('setMode: starts on the mode first glyph and clears ink, done and hold; keeps the mode', () => {
  let s = createLetterGame()
  assert.equal(s.mode.kind, 'sequence')
  s = inkEvent(s, { type: 'down', pointerId: 1, point: { x: 1, y: 1 } })
  s = setMode(s, { kind: 'pick', letter: 'k' }, GLYPHS)
  assert.equal(GLYPHS[s.index].id, 'k')
  assert.equal(s.ink.strokes ? s.ink.strokes.length : 0, 0)
  assert.equal(s.done, false)
  assert.equal(isLetterDone(s), false)
  assert.deepEqual(s.mode, { kind: 'pick', letter: 'k' })
  s = setMode(s, { kind: 'random' }, GLYPHS)
  assert.equal(s.mode.kind, 'random')
  assert.equal(s.index, 0)
})

test('goNext follows the mode: pick cycles the pair, A to Z advances, random changes glyph', () => {
  let s = setMode(createLetterGame(), { kind: 'pick', letter: 'm' }, GLYPHS)
  s = goNext(s, GLYPHS)
  assert.equal(GLYPHS[s.index].id, 'M')
  s = goNext(s, GLYPHS)
  assert.equal(GLYPHS[s.index].id, 'm')
  s = setMode(createLetterGame(), SEQUENCE_MODE, GLYPHS)
  s = goNext(s, GLYPHS)
  assert.equal(GLYPHS[s.index].id, 'A')
  s = setMode(createLetterGame(), { kind: 'random' }, GLYPHS)
  const before = s.index
  s = goNext(s, GLYPHS, () => 0.5)
  assert.notEqual(s.index, before)
  assert.equal(s.mode.kind, 'random')
})

test('star: one stroke of five crossing diagonals, drawn top, bottom-right, upper-left, upper-right, bottom-left', () => {
  const sv = starVertices(50, 52, 40)
  assert.equal(sv.length, 5)
  assert.ok(Math.abs(sv[0][0] - 50) < 1e-9 && Math.abs(sv[0][1] - 12) < 1e-9, 'starts at the top point')
  // Every step of the drawing jumps across the star: the chord is the pentagram diagonal, not an outer edge.
  const diagonal = 2 * 40 * Math.sin((72 * 2 * Math.PI) / 360)
  for (let k = 0; k < 5; k++) {
    const a = sv[k], b = sv[(k + 1) % 5]
    assert.ok(Math.abs(Math.hypot(a[0] - b[0], a[1] - b[1]) - diagonal) < 1e-6, `step ${k}`)
  }
  const star = SHAPES.find((s) => s.id === 'star')
  assert.equal(star.strokes.length, 1)
  const st = star.strokes[0]
  assert.ok(Math.hypot(st[0].x - st[st.length - 1].x, st[0].y - st[st.length - 1].y) <= 1, 'closed')
})

test('lowercase: bodies sit around the middle line, descenders hang below it, everything stays in the box', () => {
  for (const g of GLYPHS) for (const p of g.strokes.flat()) assert.ok(p.y >= 0 && p.y <= 100, `${g.id} ${p.y}`)
  const span = (id) => {
    const ys = getGlyph(id).strokes.flat().map((p) => p.y)
    return { top: Math.min(...ys), bottom: Math.max(...ys) }
  }
  // Bowl letters: the x-height body is centred near y=50.
  for (const id of ['o', 'a', 'e', 'n', 'u']) {
    const { top, bottom } = span(id)
    assert.ok(Math.abs((top + bottom) / 2 - 50) < 4, `${id} centre ${(top + bottom) / 2}`)
  }
  // Descenders go below the baseline (68) but not out of the box.
  for (const id of ['g', 'j', 'p', 'q', 'y']) {
    const { bottom } = span(id)
    assert.ok(bottom > 70 && bottom <= 85, `${id} descender bottom ${bottom}`)
  }
  // Uppercase is unchanged: still spans the full cap height.
  const O = span('O')
  assert.ok(O.top <= 16 && O.bottom >= 84, 'O is still full height')
  assert.equal(SHAPES.length, 6)
})
