import test from 'node:test'
import assert from 'node:assert/strict'
import { insideRect, PARENT_HOLD_MS } from '../../src/tools/letters/parent-hold.js'
import { installFakeDom } from './fake-dom.js'

test('insideRect: inside, edges, outside, and rects without right/bottom', () => {
  const r = { left: 10, top: 20, right: 110, bottom: 70 }
  assert.equal(insideRect(r, 50, 40), true)
  assert.equal(insideRect(r, 10, 20), true)
  assert.equal(insideRect(r, 110, 70), true)
  assert.equal(insideRect(r, 9, 40), false)
  assert.equal(insideRect(r, 50, 71), false)
  assert.equal(insideRect(r, 111, 40), false)
  assert.equal(insideRect(r, 50, 19), false)
  assert.equal(insideRect({ left: 0, top: 0, width: 400, height: 400 }, 399, 399), true)
  assert.equal(insideRect({ left: 0, top: 0, width: 400, height: 400 }, 401, 5), false)
})

const dom = installFakeDom()
const { makeHost, flushRaf, setNow, find } = dom
const { lettersTool } = await import('../../src/tools/letters/tool.js')
const { shapesTool } = await import('../../src/tools/shapes/tool.js')

for (const [name, tool] of [['letters', lettersTool], ['shapes', shapesTool]]) {
  const mount = () => { const h = makeHost(); tool.mount(h); return h }
  const parent = (h) => find(h, (e) => e.className === 'parent')
  const hold = () => tool.getState().hold
  // The fake button rect is 0..400 in both directions.
  test(name + ': touch slide off the Parent button cancels the hold (no pointerleave)', () => {
    const h = mount()
    setNow(0)
    parent(h).fire('pointerdown', { pointerId: 5, clientX: 200, clientY: 200 })
    assert.notEqual(hold().startedAt, null)
    setNow(300)
    parent(h).fire('pointermove', { pointerId: 5, clientX: 200, clientY: 200 })
    assert.notEqual(hold().startedAt, null)
    setNow(400)
    parent(h).fire('pointermove', { pointerId: 5, clientX: 900, clientY: 200 })
    assert.equal(hold().startedAt, null)
    setNow(PARENT_HOLD_MS + 500)
    flushRaf(); flushRaf()
    parent(h).fire('pointerup', { pointerId: 5, clientX: 900, clientY: 200 })
    assert.equal(hold().passed, false)
    tool.unmount()
  })
  test(name + ': pointerup outside after 1 s does not pass', () => {
    const h = mount()
    setNow(0)
    parent(h).fire('pointerdown', { pointerId: 5, clientX: 200, clientY: 200 })
    setNow(PARENT_HOLD_MS + 100)
    parent(h).fire('pointerup', { pointerId: 5, clientX: -50, clientY: 200 })
    assert.equal(hold().passed, false)
    tool.unmount()
  })
  test(name + ': hold that stays inside still passes at 1 s, moves included', () => {
    const h = mount()
    setNow(0)
    parent(h).fire('pointerdown', { pointerId: 5, clientX: 200, clientY: 200 })
    setNow(500)
    parent(h).fire('pointermove', { pointerId: 5, clientX: 210, clientY: 190 })
    setNow(PARENT_HOLD_MS + 50)
    flushRaf(); flushRaf()
    assert.equal(hold().passed, true)
    tool.unmount()
  })
  test(name + ': a move by another pointer does not cancel the hold', () => {
    const h = mount()
    setNow(0)
    parent(h).fire('pointerdown', { pointerId: 5, clientX: 200, clientY: 200 })
    parent(h).fire('pointermove', { pointerId: 8, clientX: 900, clientY: 900 })
    assert.notEqual(hold().startedAt, null)
    tool.unmount()
  })
}
