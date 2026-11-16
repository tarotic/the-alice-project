// Round 2: touch slide-off handling for "Parent: got it" (insideRect + pointermove/pointerup outside the button = leave).
import test from 'node:test'
import assert from 'node:assert/strict'
import { installFakeDom } from '../unit/fake-dom.js'

const dom = installFakeDom()
const { insideRect, PARENT_HOLD_MS } = await import('../../src/tools/letters/parent-hold.js')
const { lettersTool } = await import('../../src/tools/letters/tool.js')
const { shapesTool } = await import('../../src/tools/shapes/tool.js')

// ---------- pure insideRect ----------
const R = { left: 100, top: 200, width: 120, height: 48 }
const RB = { left: 100, top: 200, right: 220, bottom: 248 }
test('insideRect: inclusive boundaries on all edges and corners, for width/height and right/bottom rects', () => {
  for (const r of [R, RB, { ...R, right: 220, bottom: 248 }]) {
    for (const [x, y] of [[100, 200], [220, 200], [100, 248], [220, 248], [160, 200], [160, 248], [100, 224], [220, 224], [160, 224]]) assert.equal(insideRect(r, x, y), true, `${x},${y}`)
    for (const [x, y] of [[99.999, 224], [220.001, 224], [160, 199.999], [160, 248.001], [99, 199], [221, 249]]) assert.equal(insideRect(r, x, y), false, `${x},${y}`)
  }
})
test('insideRect: zero-size rect contains only its single point; inverted rects contain nothing', () => {
  assert.equal(insideRect({ left: 5, top: 5, width: 0, height: 0 }, 5, 5), true)
  assert.equal(insideRect({ left: 5, top: 5, width: 0, height: 0 }, 5.1, 5), false)
  assert.equal(insideRect({ left: 5, top: 5, width: 10, height: 0 }, 7, 5), true); assert.equal(insideRect({ left: 5, top: 5, width: 10, height: 0 }, 7, 6), false)
  for (const inv of [{ left: 10, top: 10, width: -5, height: 5 }, { left: 10, top: 10, width: 5, height: -5 }, { left: 10, top: 10, right: 5, bottom: 20 }, { left: 10, top: 10, right: 20, bottom: 5 }])
    for (const [x, y] of [[10, 10], [7, 12], [12, 7], [15, 15], [5, 10]]) assert.equal(insideRect(inv, x, y), false, JSON.stringify(inv) + ' ' + x + ',' + y)
})
test('insideRect: NaN, undefined, null, Infinity coordinates are outside (so a bad event counts as leaving)', () => {
  for (const [x, y] of [[NaN, 220], [150, NaN], [undefined, 220], [150, undefined], [null, 220], [150, null], [Infinity, 220], [-Infinity, 220], [150, Infinity], [NaN, NaN], [undefined, undefined]])
    assert.equal(insideRect(R, x, y), false, `${x},${y}`)
})
test('insideRect: NaN/undefined fields in the rect never produce inside', () => {
  for (const r of [{ left: NaN, top: 0, width: 10, height: 10 }, { left: 0, top: NaN, width: 10, height: 10 }, { left: 0, top: 0, width: NaN, height: 10 }, { left: 0, top: 0, width: 10, height: NaN }, { left: 0, top: 0 }, { left: 0, top: 0, width: 10 }, {}])
    for (const [x, y] of [[5, 5], [0, 0], [NaN, NaN]]) assert.equal(insideRect(r, x, y), false, JSON.stringify(r))
})
test('insideRect: negative coordinates, negative rect origins, huge values, right=0 is not treated as missing', () => {
  assert.equal(insideRect({ left: -50, top: -50, width: 40, height: 40 }, -30, -30), true); assert.equal(insideRect({ left: -50, top: -50, width: 40, height: 40 }, 0, 0), false)
  assert.equal(insideRect({ left: -10, top: -10, right: 0, bottom: 0 }, 0, 0), true); assert.equal(insideRect({ left: -10, top: -10, right: 0, bottom: 0 }, 1, 0), false)
  assert.equal(insideRect({ left: 0, top: 0, width: 1e308, height: 1e308 }, 1e300, 1e300), true)
  assert.equal(insideRect({ left: 1e308, top: 1e308, width: 10, height: 10 }, 1e308, 1e308), true)
  assert.equal(insideRect({ left: 0, top: 0, width: 1e308, height: 1e308 }, -1e308, 5), false); assert.equal(insideRect({ left: 0, top: 0, width: 10, height: 10 }, Number.MAX_VALUE, 5), false)
  assert.equal(insideRect({ left: 0.1, top: 0.1, width: 0.2, height: 0.2 }, 0.1 + 0.2, 0.2), true)
})
test('RECORD insideRect with numeric strings (coerced by the comparison; real events always give numbers)', (t) => {
  t.diagnostic('insideRect(R, "150", "220") = ' + insideRect(R, '150', '220') + '; insideRect(R, "abc", 220) = ' + insideRect(R, 'abc', 220))
  assert.equal(insideRect(R, 'abc', 220), false)
})
test('insideRect does not mutate a frozen rect', () => { assert.doesNotThrow(() => insideRect(Object.freeze({ ...R }), 150, 220)); assert.equal(insideRect(Object.freeze({ ...R }), 150, 220), true) })

// ---------- flows through the real tool DOM wiring (fake DOM) ----------
const BTN = { left: 300, top: 500, width: 120, height: 48 } // x 300..420, y 500..548
const IN = { clientX: 360, clientY: 524 }, OUT = { clientX: 100, clientY: 100 }, OUT_NEAR = { clientX: 360, clientY: 549 }, EDGE = { clientX: 420, clientY: 548 }
const find = dom.find
function setup(tool) {
  const host = dom.makeHost(); tool.mount(host)
  const parent = find(host, (e) => e.className === 'parent'); parent.getBoundingClientRect = () => BTN
  const next = find(host, (e) => e.tag === 'button' && e.textContent === 'Next')
  return { host, parent, next, pad: find(host, (e) => e.className === 'pad') }
}
const clean = () => { assert.equal(dom.liveListeners(), 0); assert.equal(dom.pendingRaf(), 0) }
for (const [name, tool] of [['letters', lettersTool], ['shapes', shapesTool]]) {
  const ev = (over = {}) => ({ pointerId: 7, ...IN, ...over })
  test(`${name}: stay inside (with moves, incl. exactly on the edge) 1000 ms passes; 999 ms release does not`, () => {
    let c = setup(tool); dom.setNow(0); c.parent.fire('pointerdown', ev())
    for (let i = 1; i <= 20; i++) { dom.setNow(i * 40); c.parent.fire('pointermove', i % 2 ? ev() : { pointerId: 7, ...EDGE }); dom.flushRaf() }
    dom.setNow(1000); dom.flushRaf(); dom.flushRaf(); assert.equal(c.next.disabled, false, 'inside hold'); tool.unmount(); clean()
    c = setup(tool); dom.setNow(0); c.parent.fire('pointerdown', ev()); dom.setNow(999); dom.flushRaf(); c.parent.fire('pointerup', ev()); dom.flushRaf(); assert.equal(c.next.disabled, true); tool.unmount(); clean()
  })
  test(`${name}: move outside in every direction resets; a later tick, up, or move back inside does not pass (hold must restart with a new press)`, () => {
    for (const out of [OUT, OUT_NEAR, { clientX: 299, clientY: 524 }, { clientX: 421, clientY: 524 }, { clientX: 360, clientY: 499 }, { clientX: NaN, clientY: 524 }, { clientX: 360, clientY: undefined }]) {
      const c = setup(tool); dom.setNow(0); c.parent.fire('pointerdown', ev()); dom.setNow(400); c.parent.fire('pointermove', { pointerId: 7, ...out })
      dom.setNow(800); c.parent.fire('pointermove', ev()); dom.setNow(5000); dom.flushRaf(); dom.flushRaf(); c.parent.fire('pointerup', ev()); dom.flushRaf()
      assert.equal(c.next.disabled, true, JSON.stringify(out)); tool.unmount(); clean()
    }
  })
  test(`${name}: a fresh press after sliding out starts a new hold that can pass`, () => {
    const c = setup(tool); dom.setNow(0); c.parent.fire('pointerdown', ev()); dom.setNow(300); c.parent.fire('pointermove', { pointerId: 7, ...OUT })
    dom.setNow(1000); c.parent.fire('pointerdown', ev({ pointerId: 8 })); dom.setNow(1500); dom.flushRaf(); assert.equal(c.next.disabled, true); dom.setNow(2000); dom.flushRaf(); dom.flushRaf(); assert.equal(c.next.disabled, false)
    tool.unmount(); clean()
  })
  test(`${name}: release outside (touch keeps the pointer on the button) resets, even without any move and even at 1500 ms without a tick`, () => {
    let c = setup(tool); dom.setNow(0); c.parent.fire('pointerdown', ev()); dom.setNow(1500); c.parent.fire('pointerup', { pointerId: 7, ...OUT }); dom.flushRaf(); assert.equal(c.next.disabled, true, 'up outside after 1.5 s without a tick'); tool.unmount(); clean()
    c = setup(tool); dom.setNow(0); c.parent.fire('pointerdown', ev()); dom.setNow(1500); c.parent.fire('pointerup', ev()); dom.flushRaf(); assert.equal(c.next.disabled, false, 'up inside after 1.5 s'); tool.unmount(); clean()
  })
  test(`${name}: RECORD race at exactly 1000 ms: a move outside processed before the frame tick wins; after a tick it is already passed and sticky`, (t) => {
    let c = setup(tool); dom.setNow(0); c.parent.fire('pointerdown', ev()); dom.setNow(1000); c.parent.fire('pointermove', { pointerId: 7, ...OUT }); dom.flushRaf(); const raceOutside = c.next.disabled === true; tool.unmount()
    c = setup(tool); dom.setNow(0); c.parent.fire('pointerdown', ev()); dom.setNow(1000); dom.flushRaf(); dom.flushRaf(); c.parent.fire('pointermove', { pointerId: 7, ...OUT }); dom.flushRaf(); const afterTick = c.next.disabled === false; tool.unmount(); clean()
    t.diagnostic(`move outside at exactly 1000 ms before any tick -> not passed: ${raceOutside}; after the tick -> passed and sticky: ${afterTick}`)
    assert.ok(afterTick)
  })
  test(`${name}: multi-touch: another finger moving/lifting outside the button, or drawing on the pad, does not disturb the hold; the holding finger sliding off still resets`, () => {
    let c = setup(tool); dom.setNow(0); c.parent.fire('pointerdown', ev())
    for (let i = 1; i <= 10; i++) { dom.setNow(i * 50); c.parent.fire('pointermove', { pointerId: 9, ...OUT }); c.pad.fire('pointerdown', { pointerId: 9, clientX: 100 + i, clientY: 100 }); c.pad.fire('pointermove', { pointerId: 9, clientX: 120 + i, clientY: 130 }) }
    c.parent.fire('pointerup', { pointerId: 9, ...OUT }); c.parent.fire('pointercancel', { pointerId: 9 }); c.parent.fire('pointerleave', { pointerId: 9 })
    dom.setNow(1100); dom.flushRaf(); dom.flushRaf(); assert.equal(c.next.disabled, false, 'second finger broke the hold'); tool.unmount(); clean()
    c = setup(tool); dom.setNow(0); c.parent.fire('pointerdown', ev()); c.parent.fire('pointerdown', ev({ pointerId: 9 })); dom.setNow(200); c.parent.fire('pointermove', { pointerId: 7, ...OUT }); dom.setNow(2000); dom.flushRaf(); c.parent.fire('pointerup', ev({ pointerId: 9 })); dom.flushRaf()
    assert.equal(c.next.disabled, true, 'holding finger left but second finger kept hold alive'); tool.unmount(); clean()
  })
  test(`${name}: moves with no hold in progress (hover, drawing elsewhere) are inert and schedule nothing`, () => {
    const c = setup(tool); dom.flushRaf(); const before = dom.pendingRaf()
    for (let i = 0; i < 200; i++) c.parent.fire('pointermove', i % 2 ? ev() : { pointerId: 7, ...OUT }); assert.equal(dom.pendingRaf(), before); assert.equal(c.next.disabled, true); tool.unmount(); clean()
  })
  test(`${name}: moves inside while held schedule no extra work (frame count stays bounded)`, () => {
    const c = setup(tool); dom.setNow(0); c.parent.fire('pointerdown', ev()); const f0 = dom.pendingRaf()
    for (let i = 0; i < 500; i++) c.parent.fire('pointermove', { pointerId: 7, clientX: 340 + (i % 40), clientY: 510 + (i % 30) }); assert.ok(dom.pendingRaf() <= f0 + 1, `frames ${dom.pendingRaf()} vs ${f0}`)
    c.parent.fire('pointerup', ev()); dom.flushRaf(); dom.flushRaf(); tool.unmount(); clean()
  })
  test(`${name}: 500 rapid press/slide-off/release cycles never pass and leave no frame or listener`, () => {
    const c = setup(tool); let t = 0
    for (let i = 0; i < 500; i++) { t += 5; dom.setNow(t); c.parent.fire('pointerdown', ev({ pointerId: 100 + i })); t += 600; dom.setNow(t); c.parent.fire(i % 3 ? 'pointermove' : 'pointerup', { pointerId: 100 + i, ...OUT }); t += 600; dom.setNow(t); dom.flushRaf(); c.parent.fire('pointerleave', { pointerId: 100 + i }) }
    dom.flushRaf(); assert.equal(c.next.disabled, true); assert.equal(dom.pendingRaf(), 0); tool.unmount(); clean()
  })
  test(`${name}: switching tools mid-hold (also after a slide off) leaves nothing running and the old button inert`, () => {
    const c = setup(tool); dom.setNow(0); c.parent.fire('pointerdown', ev()); dom.setNow(500); tool.unmount(); dom.setNow(5000); dom.flushRaf()
    assert.doesNotThrow(() => { c.parent.fire('pointermove', ev()); c.parent.fire('pointermove', { pointerId: 7, ...OUT }); c.parent.fire('pointerup', ev()) }); clean()
    const d = setup(tool); assert.equal(d.next.disabled, true); tool.unmount(); clean()
  })
  test(`${name}: mouse flow unchanged: pointerleave resets; up inside passes after 1 s; pointercancel resets`, () => {
    let c = setup(tool); dom.setNow(0); c.parent.fire('pointerdown', ev()); dom.setNow(500); c.parent.fire('pointerleave', ev()); dom.setNow(3000); dom.flushRaf(); assert.equal(c.next.disabled, true); tool.unmount()
    c = setup(tool); dom.setNow(0); c.parent.fire('pointerdown', ev()); dom.setNow(500); c.parent.fire('pointercancel', ev()); dom.setNow(3000); dom.flushRaf(); assert.equal(c.next.disabled, true); tool.unmount()
    c = setup(tool); dom.setNow(0); c.parent.fire('pointerdown', ev()); dom.setNow(1200); c.parent.fire('pointerup', ev()); dom.flushRaf(); assert.equal(c.next.disabled, false); tool.unmount(); clean()
  })
}
test(`const PARENT_HOLD_MS is still 1000`, () => assert.equal(PARENT_HOLD_MS, 1000))
