import test from 'node:test'
import assert from 'node:assert/strict'
import { installFakeDom } from '../unit/fake-dom.js'

const dom = installFakeDom()
await import('../../src/tools/index.js')
const { listTools, getTool, defaultRegistry } = await import('../../src/registry.js')
const { createSwitchState, performSwitch, switchTo } = await import('../../src/switcher.js')
const { lettersTool } = await import('../../src/tools/letters/tool.js')
const { shapesTool } = await import('../../src/tools/shapes/tool.js')
const { SHAPES } = await import('../../src/tools/shapes/shapes.js')
const { GLYPHS } = await import('../../src/tools/letters/glyphs.js')

const pad = (h) => dom.find(h, (e) => e.className === 'pad')
const parent = (h) => dom.find(h, (e) => e.className === 'parent')
const btn = (h, t) => dom.find(h, (e) => e.tag === 'button' && e.textContent === t)
const next = (h) => btn(h, 'Next'), clear = (h) => btn(h, 'Clear')
const reward = (h) => dom.find(h, (e) => e.className === 'reward')
const toPx = (p) => ({ clientX: p.x * 4, clientY: p.y * 4 })
const drawStroke = (h, pts, pid = 1, lift = true) => { const pd = pad(h); pts.forEach((p, i) => pd.fire(i ? 'pointermove' : 'pointerdown', { ...toPx(p), pointerId: pid })); if (lift) pd.fire('pointerup', { pointerId: pid }); dom.flushRaf() }
const hold = (h, ms, pid = 9) => { const t0 = 1e6 + Math.random() * 1e3; dom.setNow(t0); parent(h).fire('pointerdown', { pointerId: pid }); dom.setNow(t0 + ms); dom.flushRaf(); dom.flushRaf(); return t0 + ms }
const clean = () => { assert.equal(dom.liveListeners(), 0, 'listeners left'); assert.equal(dom.pendingRaf(), 0, 'rAF left') }
const shapeName = (h) => dom.text(h).match(/\b(circle|square|triangle|rectangle|oval|star)\b/)?.[1]
const passViaParent = (h) => { hold(h, 1100); dom.flushRaf() }

test('AC1 real tool index: exactly three tools, ids timer, letters, shapes, labels "Timer" "Letters" "Shapes"', () => {
  const tools = listTools()
  assert.equal(tools.length, 3); assert.deepEqual(tools.map((t) => t.label), ['Timer', 'Letters', 'Shapes']); assert.deepEqual(tools.map((t) => t.id), ['timer', 'letters', 'shapes'])
  assert.equal(getTool('timer').label, 'Timer'); assert.equal(getTool('letters').label, 'Letters'); assert.equal(getTool('shapes').label, 'Shapes')
  for (const t of tools) { assert.equal(typeof t.mount, 'function'); assert.equal(typeof t.unmount, 'function') }
  assert.throws(() => defaultRegistry.registerTool({ id: 'shapes', label: 'X', mount() {}, unmount() {} }))
})
test('AC2 switch order and exactly-once counts via DOM effects: Letters->Shapes->Letters, same-tool no-op, unknown no-op', () => {
  const host = dom.makeHost(); let st = createSwitchState()
  st = performSwitch(st, 'letters', host); assert.deepEqual(host.log, ['build'])
  st = performSwitch(st, 'letters', host); assert.deepEqual(host.log, ['build'], 'same tool re-mounted')
  st = performSwitch(st, 'zzz', host); assert.deepEqual(host.log, ['build']); assert.equal(st.activeId, 'letters')
  st = performSwitch(st, 'shapes', host); assert.deepEqual(host.log, ['build', 'clear', 'build']); assert.equal(shapeName(host), 'circle')
  st = performSwitch(st, 'shapes', host); assert.deepEqual(host.log, ['build', 'clear', 'build'])
  st = performSwitch(st, 'letters', host); assert.deepEqual(host.log, ['build', 'clear', 'build', 'clear', 'build']); assert.match(dom.text(host), /a · lowercase/)
  assert.deepEqual(Object.keys(st), ['activeId']); getTool('letters').unmount(); clean()
})
test('AC2 1000 rapid switches: strictly alternating clear/build, each exactly once, nothing left running at the end', () => {
  const host = dom.makeHost(); let st = performSwitch(createSwitchState(), 'letters', host)
  for (let i = 0; i < 1000; i++) st = performSwitch(st, i % 2 ? 'letters' : 'shapes', host)
  assert.equal(host.log.length, 1 + 2 * 1000)
  host.log.forEach((e, i) => assert.equal(e, i % 2 ? 'clear' : 'build', 'position ' + i))
  assert.equal(st.activeId, 'letters'); assert.equal(dom.pendingRaf() <= 1, true)
  getTool('letters').unmount(); dom.flushRaf(); clean()
})
test('AC3 fresh state: Letters->Shapes->Letters and Shapes->Letters->Shapes; nothing carries (index, ink, done, hold, label, reward)', () => {
  const host = dom.makeHost(); let st = performSwitch(createSwitchState(), 'letters', host)
  drawStroke(host, [{ x: 50, y: 20 }, { x: 50, y: 60 }]); passViaParent(host)
  assert.equal(lettersTool.getState().done, true); next(host).fire('click'); dom.flushRaf(); assert.equal(lettersTool.getState().index, 1)
  drawStroke(host, [{ x: 10, y: 10 }, { x: 20, y: 20 }], 3, false)
  st = performSwitch(st, 'shapes', host)
  assert.equal(lettersTool.getState(), null); const sh = shapesTool.getState()
  assert.deepEqual([sh.index, sh.done, sh.ink.strokes.length, sh.ink.activePointerId, sh.hold.startedAt, sh.hold.passed], [0, false, 0, null, null, false]); assert.equal(shapeName(host), 'circle')
  drawStroke(host, SHAPES[0].strokes[0]); assert.equal(next(host).disabled, false); next(host).fire('click'); dom.flushRaf(); assert.equal(shapesTool.getState().index, 1)
  drawStroke(host, [{ x: 5, y: 5 }, { x: 9, y: 9 }], 4, false)
  st = performSwitch(st, 'letters', host)
  const l = lettersTool.getState(); assert.deepEqual([l.index, l.done, l.ink.strokes.length, l.ink.activePointerId, l.hold.passed], [0, false, 0, null, false])
  assert.match(dom.text(host), /a · lowercase/); assert.equal(next(host).disabled, true); assert.equal(reward(host).style.visibility, 'hidden')
  assert.equal(dom.find(host, (e) => e.className === 'parent-fill').style.width, '0%')
  assert.deepEqual(Object.keys(st), ['activeId'])
  st = performSwitch(st, 'shapes', host); assert.equal(shapeName(host), 'circle'); assert.equal(shapesTool.getState().ink.strokes.length, 0)
  getTool('shapes').unmount(); assert.equal(shapesTool.getState(), null); clean()
})
test('switching mid-stroke, mid parent-hold, with pending frames: no leftover rAF/listeners, old DOM inert, new tool unaffected', () => {
  for (const [from, to] of [['letters', 'shapes'], ['shapes', 'letters']]) {
    const host = dom.makeHost(); let st = performSwitch(createSwitchState(), from, host)
    const oldPad = pad(host), oldParent = parent(host)
    oldPad.fire('pointerdown', { clientX: 100, clientY: 100, pointerId: 5 }); oldPad.fire('pointermove', { clientX: 200, clientY: 200, pointerId: 5 })
    dom.setNow(100); oldParent.fire('pointerdown', { pointerId: 6 })
    assert.ok(dom.pendingRaf() > 0)
    st = performSwitch(st, to, host); assert.equal(dom.pendingRaf(), 0, 'rAF pending after switch (' + from + ')')
    assert.doesNotThrow(() => { oldPad.fire('pointermove', { clientX: 300, clientY: 300, pointerId: 5 }); oldPad.fire('pointerup', { pointerId: 5 }); oldParent.fire('pointerup', { pointerId: 6 }); dom.setNow(5000); dom.flushRaf() })
    const state = (to === 'letters' ? lettersTool : shapesTool).getState(); assert.equal(state.ink.strokes.length, 0); assert.equal(state.done, false); assert.equal(state.hold.startedAt, null)
    assert.equal(next(host).disabled, true)
    getTool(to).unmount(); clean()
  }
})
test('mid-hold switching 200x with hold 900ms elapsed: never passes the new tool, no timers survive', () => {
  const host = dom.makeHost(); let st = performSwitch(createSwitchState(), 'letters', host)
  for (let i = 0; i < 200; i++) { dom.setNow(i * 10000); parent(host).fire('pointerdown', { pointerId: 1 }); dom.setNow(i * 10000 + 900); dom.flushRaf(); st = performSwitch(st, i % 2 ? 'letters' : 'shapes', host); dom.setNow(i * 10000 + 5000); dom.flushRaf(); assert.equal(next(host).disabled, true, 'iteration ' + i) }
  getTool(st.activeId).unmount(); clean()
})
test('Shapes DOM: label is lowercase name for each of six; Next disabled until done; order and wrap via Next', () => {
  const host = dom.makeHost(); performSwitch(createSwitchState(), 'shapes', host)
  const names = ['circle', 'square', 'triangle', 'rectangle', 'oval', 'star']
  assert.ok(!dom.find(host, (e) => e.tag === 'select')); assert.ok(!/ · /.test(dom.text(host)))
  for (let i = 0; i < 7; i++) {
    const expect = names[i % 6]
    assert.equal(dom.find(host, (e) => e.className === 'letter-label').textContent, expect)
    assert.equal(next(host).disabled, true); next(host).fire('click'); dom.flushRaf(); assert.equal(dom.find(host, (e) => e.className === 'letter-label').textContent, expect, 'Next while disabled advanced')
    drawStroke(host, SHAPES[i % 6].strokes[0]); assert.equal(next(host).disabled, false, expect); assert.match(dom.text(host), /Well done/)
    next(host).fire('click'); dom.flushRaf()
  }
  getTool('shapes').unmount(); clean()
})
test('Shapes DOM: reward only after the finger lifts; 60% trace gets none; scribble gets none; Clear retries', () => {
  const host = dom.makeHost(); performSwitch(createSwitchState(), 'shapes', host)
  const c = SHAPES[0].strokes[0]
  drawStroke(host, c, 1, false); assert.equal(next(host).disabled, true, 'reward mid-stroke'); assert.equal(reward(host).style.visibility, 'hidden')
  pad(host).fire('pointerup', { pointerId: 1 }); dom.flushRaf(); assert.equal(next(host).disabled, false)
  clear(host).fire('click'); dom.flushRaf(); assert.equal(next(host).disabled, true); assert.equal(shapesTool.getState().ink.strokes.length, 0)
  drawStroke(host, c.slice(0, Math.floor(c.length * 0.6))); assert.equal(next(host).disabled, true)
  clear(host).fire('click'); dom.flushRaf()
  const pts = []; for (let r = 0; r <= 100; r += 2) for (let x = 0; x <= 100; x += 2) pts.push({ x: r % 4 ? 100 - x : x, y: r })
  drawStroke(host, pts); assert.equal(next(host).disabled, true)
  clear(host).fire('click'); dom.flushRaf(); drawStroke(host, c); assert.equal(next(host).disabled, false)
  getTool('shapes').unmount(); clean()
})
test('Shapes DOM: one-point strokes (taps), 100 rapid taps, multi-touch second finger ignored, cancel path', () => {
  const host = dom.makeHost(); performSwitch(createSwitchState(), 'shapes', host); const pd = pad(host)
  for (let i = 0; i < 100; i++) { pd.fire('pointerdown', { clientX: 200 + (i % 5), clientY: 40, pointerId: 1 }); pd.fire('pointerup', { pointerId: 1 }) }
  dom.flushRaf(); assert.equal(next(host).disabled, true)
  pd.fire('pointerdown', { ...toPx({ x: 50, y: 10 }), pointerId: 1 }); pd.fire('pointerdown', { clientX: 20, clientY: 20, pointerId: 2 }); pd.fire('pointermove', { clientX: 25, clientY: 25, pointerId: 2 }); pd.fire('pointerup', { pointerId: 2 }); dom.flushRaf()
  assert.equal(shapesTool.getState().ink.activePointerId, 1)
  drawStroke(host, SHAPES[0].strokes[0].slice(1), 1, false); pd.fire('pointercancel', { pointerId: 1 }); dom.flushRaf()
  assert.equal(shapesTool.getState().ink.activePointerId, null)
  getTool('shapes').unmount(); clean()
})
test('Shapes DOM: own trace passes for all six, 60% does not; resized/scrolled pad still maps', () => {
  const host = dom.makeHost(); performSwitch(createSwitchState(), 'shapes', host); const pd = pad(host)
  pd.getBoundingClientRect = () => ({ left: 20, top: -300, width: 250, height: 250 })
  for (let i = 0; i < 6; i++) {
    const s = SHAPES[i].strokes[0]
    const draw = (pts) => { pts.forEach((p, k) => pd.fire(k ? 'pointermove' : 'pointerdown', { clientX: 20 + p.x * 2.5, clientY: -300 + p.y * 2.5, pointerId: 1 })); pd.fire('pointerup', { pointerId: 1 }); dom.flushRaf() }
    draw(s.slice(0, Math.floor(s.length * 0.6))); assert.equal(next(host).disabled, true, SHAPES[i].id + ' 60%')
    clear(host).fire('click'); dom.flushRaf(); draw(s); assert.equal(next(host).disabled, false, SHAPES[i].id + ' own'); next(host).fire('click'); dom.flushRaf()
  }
  getTool('shapes').unmount(); clean()
})
test('AC23 Shapes DOM parent hold: >=1000ms passes with empty ink and with scribble ink; tap, 999ms, leave, cancel do not; progress shown', () => {
  const host = dom.makeHost(); performSwitch(createSwitchState(), 'shapes', host); const p = parent(host)
  dom.setNow(0); p.fire('pointerdown', { pointerId: 2 }); dom.setNow(10); dom.flushRaf(); p.fire('pointerup', { pointerId: 2 }); dom.flushRaf(); assert.equal(next(host).disabled, true, 'tap')
  dom.setNow(0); p.fire('pointerdown', { pointerId: 2 }); dom.setNow(999); dom.flushRaf(); assert.match(dom.find(host, (e) => e.className === 'parent-fill').style.width, /^(9\d|100)%$/); p.fire('pointerup', { pointerId: 2 }); dom.flushRaf(); assert.equal(next(host).disabled, true, '999')
  for (const ev of ['pointerleave', 'pointercancel']) { dom.setNow(0); p.fire('pointerdown', { pointerId: 2 }); dom.setNow(900); dom.flushRaf(); p.fire(ev, { pointerId: 2 }); dom.setNow(9999); dom.flushRaf(); dom.flushRaf(); assert.equal(next(host).disabled, true, ev) }
  assert.equal(dom.pendingRaf(), 0)
  drawStroke(host, [{ x: 1, y: 1 }, { x: 99, y: 99 }]); dom.setNow(0); p.fire('pointerdown', { pointerId: 2 }); dom.setNow(1000); dom.flushRaf(); dom.flushRaf()
  assert.equal(next(host).disabled, false); assert.match(dom.text(host), /Well done/); assert.equal(dom.pendingRaf(), 0)
  clear(host).fire('click'); dom.flushRaf(); assert.equal(next(host).disabled, true)
  dom.setNow(0); p.fire('pointerdown', { pointerId: 3 }); dom.setNow(1000); dom.flushRaf(); dom.flushRaf(); assert.equal(next(host).disabled, false, 'empty ink')
  getTool('shapes').unmount(); clean()
})
test('time going backwards during a shapes hold never passes', () => {
  const host = dom.makeHost(); performSwitch(createSwitchState(), 'shapes', host)
  dom.setNow(5000); parent(host).fire('pointerdown', { pointerId: 1 }); for (const t of [4000, 0, -9999]) { dom.setNow(t); dom.flushRaf() }
  assert.equal(next(host).disabled, true); getTool('shapes').unmount(); clean()
})
test('Letters behave exactly as before inside the real shell: i dot tap, g own trace, 52nd wrap, parent hold, cleanup', () => {
  const host = dom.makeHost(); performSwitch(createSwitchState(), 'letters', host)
  let seen = []
  for (let i = 0; i < 53; i++) {
    const g = GLYPHS[i % 52]; seen.push(dom.find(host, (e) => e.className === 'letter-label').textContent)
    g.strokes.forEach((s) => drawStroke(host, s))
    assert.equal(next(host).disabled, false, g.id); next(host).fire('click'); dom.flushRaf()
  }
  assert.deepEqual(seen.slice(0, 4), ['a · lowercase', 'A · uppercase', 'b · lowercase', 'B · uppercase']); assert.equal(seen[51], 'Z · uppercase'); assert.equal(seen[52], 'a · lowercase')
  getTool('letters').unmount(); clean()
})
test('switchTo remains pure for the two real tools', () => {
  const s = createSwitchState('letters'); assert.equal(switchTo(s, 'letters'), s); assert.deepEqual(switchTo(s, 'shapes'), { activeId: 'shapes' }); assert.equal(switchTo(s, 'nope'), s); assert.deepEqual(s, { activeId: 'letters' })
})
