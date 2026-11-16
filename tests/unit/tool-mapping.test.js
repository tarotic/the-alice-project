import test from 'node:test'
import assert from 'node:assert/strict'
import { toGlyphSpace } from '../../src/tools/letters/tool.js'

test('toGlyphSpace', () => {
  const r = { left: 10, top: 20, width: 200, height: 200 }
  assert.deepEqual(toGlyphSpace(10, 20, r), { x: 0, y: 0 })
  assert.deepEqual(toGlyphSpace(210, 220, r), { x: 100, y: 100 })
  assert.deepEqual(toGlyphSpace(110, 120, r), { x: 50, y: 50 })
  assert.equal(toGlyphSpace(1, 1, { left: 0, top: 0, width: 0, height: 10 }), null)
})
