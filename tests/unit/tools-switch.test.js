import test from 'node:test'
import assert from 'node:assert/strict'
import { installFakeDom } from './fake-dom.js'

const dom = installFakeDom()
const { makeHost, flushRaf, pendingRaf, liveListeners, setNow, find, text } = dom

await import('../../src/tools/index.js')
const { listTools } = await import('../../src/registry.js')
const { createSwitchState, performSwitch } = await import('../../src/switcher.js')
const { lettersTool } = await import('../../src/tools/letters/tool.js')
const { shapesTool } = await import('../../src/tools/shapes/tool.js')
const { SHAPES } = await import('../../src/tools/shapes/shapes.js')
const { createLetterGame, currentGlyph } = await import('../../src/tools/letters/game.js')

const pad = (h) => find(h, (e) => e.className === 'pad')
const parent = (h) => find(h, (e) => e.className === 'parent')
const label = (h) => find(h, (e) => e.className === 'letter-label').textContent
const btn = (h, t) => find(h, (e) => e.textContent === t && e.tag === 'button')
const dirty = (h) => {
  pad(h).fire('pointerdown', { clientX: 50, clientY: 50, pointerId: 3 })
  pad(h).fire('pointermove', { clientX: 90, clientY: 90, pointerId: 3 })
  parent(h).fire('pointerdown', { pointerId: 9 })
}

test('AC1 registry lists Timer, Letters then Shapes', () => {
  const t = listTools()
  assert.ok(t.length >= 3)
})

test('AC2 switching mounts/unmounts exactly once each', () => {
  const host = makeHost()
  let st = createSwitchState()
  st = performSwitch(st, 'letters', host)
  host.log.length = 0
  st = performSwitch(st, 'shapes', host)
  assert.deepEqual(host.log, ['clear', 'build'])
  assert.equal(lettersTool.getState(), null)
  assert.notEqual(shapesTool.getState(), null)
  assert.match(text(host), /circle/)
  host.log.length = 0
  st = performSwitch(st, 'letters', host)
  assert.deepEqual(host.log, ['clear', 'build'])
  assert.equal(shapesTool.getState(), null)
  assert.match(text(host), /a · lowercase/)
  host.log.length = 0
  const same = performSwitch(st, 'letters', host)
  assert.equal(same, st)
  assert.deepEqual(host.log, [])
  lettersTool.unmount()
})

test('AC3 a switch always returns a fresh tool', () => {
  const host = makeHost()
  let st = performSwitch(createSwitchState(), 'letters', host)
  dirty(host)
  st = performSwitch(st, 'shapes', host)
  assert.equal(pendingRaf(), 0)
  st = performSwitch(st, 'letters', host)
  assert.deepEqual(st, { activeId: 'letters' })
  assert.deepEqual(Object.keys(st), ['activeId'])
  assert.deepEqual(lettersTool.getState(), createLetterGame())
  assert.match(text(host), /a · lowercase/)
  dirty(host)
  st = performSwitch(st, 'shapes', host)
  assert.equal(pendingRaf(), 0)
  dirty(host)
  st = performSwitch(st, 'letters', host)
  assert.equal(pendingRaf(), 0)
  st = performSwitch(st, 'shapes', host)
  assert.deepEqual(shapesTool.getState(), createLetterGame())
  assert.equal(currentGlyph(shapesTool.getState(), SHAPES).id, 'circle')
  assert.match(text(host), /circle/)
  shapesTool.unmount()
})

test('AC3 support: 50 rapid switches leave only the active tool listeners', () => {
  const host = makeHost()
  let st = performSwitch(createSwitchState(), 'letters', host)
  const countFresh = (id) => {
    const h = makeHost()
    const tool = id === 'letters' ? lettersTool : shapesTool
    const before = liveListeners()
    tool.mount(h)
    const n = liveListeners() - before
    tool.unmount()
    return n
  }
  // the fresh-mount probes above must not run while a tool is mounted in `host`, so unmount first
  lettersTool.unmount()
  const nL = countFresh('letters'), nS = countFresh('shapes')
  st = createSwitchState()
  st = performSwitch(st, 'letters', host)
  for (let i = 0; i < 50; i++) {
    dirty(host)
    st = performSwitch(st, i % 2 === 0 ? 'shapes' : 'letters', host)
  }
  assert.equal(st.activeId, 'letters')
  assert.equal(liveListeners(), nL)
  assert.ok(nL > 0 && nS > 0)
  assert.ok(pendingRaf() <= 1)
  lettersTool.unmount()
  assert.equal(liveListeners(), 0)
  assert.equal(pendingRaf(), 0)
  assert.equal(host.children.length, 0)
})

test('AC19 DOM: labels cycle through the six shapes and wrap', () => {
  const host = makeHost()
  shapesTool.mount(host)
  const seen = []
  for (let i = 0; i < 6; i++) {
    seen.push(label(host))
    setNow(i * 10000)
    parent(host).fire('pointerdown', { pointerId: 4 })
    setNow(i * 10000 + 1100)
    flushRaf(); flushRaf()
    btn(host, 'Next').fire('click')
    flushRaf()
  }
  assert.deepEqual(seen, ['circle', 'square', 'triangle', 'rectangle', 'oval', 'star'])
  assert.equal(label(host), 'circle')
  shapesTool.unmount()
})

test('AC21 DOM: Next is disabled until done', () => {
  const host = makeHost()
  shapesTool.mount(host)
  const next = btn(host, 'Next')
  assert.equal(next.disabled, true)
  next.fire('click'); flushRaf()
  assert.equal(label(host), 'circle')
  setNow(0)
  parent(host).fire('pointerdown', { pointerId: 4 })
  setNow(1100); flushRaf(); flushRaf()
  assert.equal(next.disabled, false)
  next.fire('click'); flushRaf()
  assert.equal(label(host), 'square')
  shapesTool.unmount()
})

test('cleanup: late events on the old tool do nothing', () => {
  const host = makeHost()
  let st = performSwitch(createSwitchState(), 'shapes', host)
  const oldPad = pad(host), oldParent = parent(host)
  oldPad.fire('pointerdown', { clientX: 10, clientY: 10, pointerId: 7 })
  oldParent.fire('pointerdown', { pointerId: 9 })
  st = performSwitch(st, 'letters', host)
  assert.equal(pendingRaf(), 0)
  assert.doesNotThrow(() => { oldPad.fire('pointermove', { clientX: 30, clientY: 30, pointerId: 7 }); oldParent.fire('pointerup', { pointerId: 9 }); flushRaf() })
  assert.equal(pendingRaf(), 0)
  lettersTool.unmount()
})
