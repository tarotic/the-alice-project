import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { GLYPHS, getGlyph, PAIRED_ORDER } from '../../src/tools/letters/glyphs.js'
import { EXPECTED_LETTERS, FULL_PAIRED_ALPHABET, FULL_SET_TODO } from './expected-letters.js'

test('AC10 stroke data shape', () => {
  assert.ok(GLYPHS.length > 0)
  for (const g of GLYPHS) {
    assert.ok(Array.isArray(g.strokes) && g.strokes.length > 0, g.id)
    for (const s of g.strokes) {
      assert.ok(s.length >= 2, g.id)
      for (const p of s) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), g.id)
    }
  }
  const src = fs.readFileSync(new URL('../../src/tools/letters/glyphs.js', import.meta.url), 'utf8')
  for (const b of ['fetch(', 'url(', '.png', '.svg', '@font-face', 'new Image']) assert.ok(!src.includes(b), b)
})

test('AC11 ids, case, range', () => {
  const ids = GLYPHS.map((g) => g.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual(ids, EXPECTED_LETTERS)
  for (const g of GLYPHS) {
    assert.equal(g.case, g.id === g.id.toLowerCase() ? 'lowercase' : 'uppercase')
    for (const s of g.strokes) for (const p of s) assert.ok(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100, g.id)
  }
  assert.equal(getGlyph('a').id, 'a')
  assert.equal(getGlyph('?'), undefined)
  assert.equal(PAIRED_ORDER.length, 52)
})

test('AC11 full 52 glyphs', { todo: FULL_SET_TODO }, () => {
  assert.equal(GLYPHS.length, 52)
  assert.deepEqual(GLYPHS.map((g) => g.id), FULL_PAIRED_ALPHABET)
})
