// Drives src/tools/letters/tool.js against a tiny fake DOM to check mount/unmount hygiene and event wiring.
import test from 'node:test'
import assert from 'node:assert/strict'

let liveListeners = 0, rafSeq = 0, rafQueue = new Map(), nowMs = 0
const windowListeners = []
class FakeEl {
  constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.className = ''; this.textContent = ''; this.listeners = []; this.captured = new Set(); this.disabled = false; this.width = 0; this.height = 0; this.clientWidth = 400 }
  append(...c) { this.children.push(...c) }
  appendChild(c) { this.children.push(c) }
  replaceChildren(...c) { this.children = c }
  setAttribute() {}
  addEventListener(type, fn, opts) {
    const rec = { type, fn, live: true }; this.listeners.push(rec); liveListeners++
    opts?.signal?.addEventListener('abort', () => { if (rec.live) { rec.live = false; liveListeners-- } })
  }
  fire(type, ev = {}) { for (const l of this.listeners.slice()) if (l.live && l.type === type) l.fn({ preventDefault() {}, clientX: 0, clientY: 0, pointerId: 1, ...ev }) }
  setPointerCapture(id) { this.captured.add(id) }
  hasPointerCapture(id) { return this.captured.has(id) }
  releasePointerCapture(id) { this.captured.delete(id) }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 } }
  getContext() { return new Proxy({}, { get: (_, k) => (k === 'canvas' ? {} : () => {}), set: () => true }) }
}
globalThis.document = { createElement: (t) => new FakeEl(t) }
const winTarget = { devicePixelRatio: 2, addEventListener(type, fn, opts) { const rec = { type, fn, live: true }; windowListeners.push(rec); liveListeners++; opts?.signal?.addEventListener('abort', () => { if (rec.live) { rec.live = false; liveListeners-- } }) } }
globalThis.window = winTarget
globalThis.requestAnimationFrame = (fn) => { const id = ++rafSeq; rafQueue.set(id, fn); return id }
globalThis.cancelAnimationFrame = (id) => { rafQueue.delete(id) }
Object.defineProperty(globalThis, 'performance', { value: { now: () => nowMs }, configurable: true })
const flushRaf = () => { const q = [...rafQueue]; rafQueue.clear(); for (const [, fn] of q) fn() }

const { lettersTool } = await import('../../src/tools/letters/tool.js')
const { createRegistry } = await import('../../src/registry.js')
const { createSwitchState, performSwitch } = await import('../../src/switcher.js')

const find = (el, pred) => { if (pred(el)) return el; for (const c of el.children) { const r = find(c, pred); if (r) return r } return null }
const pad = (h) => find(h, (e) => e.className === 'pad')
const parent = (h) => find(h, (e) => e.className === 'parent')
const text = (h) => { let s = ''; (function w(e) { s += e.textContent + ' '; e.children.forEach(w) })(h); return s }

test('mount builds expected controls: label a lowercase, Clear, Next (disabled), Parent: got it', () => {
  const host = new FakeEl('main'); lettersTool.mount(host)
  const t = text(host)
  assert.match(t, /a · lowercase/); assert.match(t, /Clear/); assert.match(t, /Next/); assert.match(t, /Parent: got it/)
  assert.equal(find(host, (e) => e.textContent === 'Next').disabled, true)
  assert.ok(!find(host, (e) => e.tag === 'select'))
  lettersTool.unmount()
})
test('repeated mount/unmount x200 leaves no live listeners and no pending rAF', () => {
  const host = new FakeEl('main')
  for (let i = 0; i < 200; i++) { lettersTool.mount(host); pad(host).fire('pointerdown', { clientX: 50, clientY: 50 }); parent(host).fire('pointerdown'); lettersTool.unmount() }
  assert.equal(liveListeners, 0); assert.equal(rafQueue.size, 0); assert.equal(host.children.length, 0)
})
test('switching tools mid-stroke and mid-parent-hold via switcher: no stray rAF, old pad dead, fresh game on return', () => {
  const reg = createRegistry(); reg.registerTool(lettersTool)
  const log = []
  reg.registerTool({ id: 'x', label: 'X', mount: () => log.push('m'), unmount: () => log.push('u') })
  const host = new FakeEl('main'); let st = createSwitchState()
  st = performSwitch(st, 'letters', host, reg)
  const oldPad = pad(host), oldParent = parent(host)
  oldPad.fire('pointerdown', { clientX: 10, clientY: 10, pointerId: 7 }); oldPad.fire('pointermove', { clientX: 20, clientY: 20, pointerId: 7 })
  oldParent.fire('pointerdown', { pointerId: 9 })
  assert.ok(rafQueue.size > 0)
  st = performSwitch(st, 'x', host, reg)
  assert.equal(rafQueue.size, 0, 'rAF left pending after unmount')
  assert.equal(liveListeners, 0)
  assert.doesNotThrow(() => { oldPad.fire('pointermove', { clientX: 30, clientY: 30, pointerId: 7 }); oldParent.fire('pointerup', { pointerId: 9 }); flushRaf() })
  for (let i = 0; i < 50; i++) { st = performSwitch(st, 'letters', host, reg); st = performSwitch(st, 'x', host, reg) }
  assert.equal(liveListeners, 0); assert.equal(rafQueue.size, 0)
  st = performSwitch(st, 'letters', host, reg)
  assert.match(text(host), /a · lowercase/)
  lettersTool.unmount()
})
test('AC28 parent hold in DOM: tap no pass; hold 1s via rAF loop passes -> Next enabled; reward visible', () => {
  const host = new FakeEl('main'); lettersTool.mount(host)
  const p = parent(host), next = find(host, (e) => e.textContent === 'Next')
  nowMs = 0; p.fire('pointerdown', { pointerId: 4 }); nowMs = 100; flushRaf(); p.fire('pointerup', { pointerId: 4 }); flushRaf()
  assert.equal(next.disabled, true)
  nowMs = 1000; p.fire('pointerdown', { pointerId: 5 })
  nowMs = 1500; flushRaf(); assert.equal(next.disabled, true)
  const fill = find(host, (e) => e.className === 'parent-fill'); assert.match(fill.style.width, /^(4\d|5\d)%$/)
  nowMs = 2000; flushRaf(); flushRaf()
  assert.equal(next.disabled, false); assert.match(text(host), /Well done/)
  assert.equal(rafQueue.size, 0, 'hold loop must stop after pass')
  lettersTool.unmount()
})
test('AC28 parent hold interrupted by pointerleave / pointercancel / early release never passes; loop stops', () => {
  const host = new FakeEl('main'); lettersTool.mount(host)
  const p = parent(host), next = find(host, (e) => e.textContent === 'Next')
  for (const ev of ['pointerleave', 'pointercancel', 'pointerup']) {
    nowMs = 0; p.fire('pointerdown', { pointerId: 2 }); nowMs = 900; flushRaf(); p.fire(ev, { pointerId: 2 }); nowMs = 5000; flushRaf(); flushRaf()
    assert.equal(next.disabled, true, ev); assert.equal(rafQueue.size, 0, ev + ' leaked rAF')
  }
  lettersTool.unmount()
})
test('AC28 parent: pointerdown releases implicit touch capture so pointerleave can fire', () => {
  const host = new FakeEl('main'); lettersTool.mount(host); const p = parent(host)
  p.captured.add(3); p.fire('pointerdown', { pointerId: 3 }); assert.equal(p.captured.has(3), false)
  lettersTool.unmount()
})
test('AC28 rapid 500 taps on parent leave no pending loop after final release', () => {
  const host = new FakeEl('main'); lettersTool.mount(host); const p = parent(host)
  for (let i = 0; i < 500; i++) { nowMs += 10; p.fire('pointerdown', { pointerId: 1 }); nowMs += 10; p.fire('pointerup', { pointerId: 1 }); flushRaf() }
  flushRaf(); assert.equal(rafQueue.size, 0); assert.equal(find(host, (e) => e.textContent === 'Next').disabled, true)
  lettersTool.unmount()
})
test('pad: multi-touch -- second finger ignored, capture requested for it; pointercancel ends stroke', () => {
  const host = new FakeEl('main'); lettersTool.mount(host); const pd = pad(host)
  pd.fire('pointerdown', { clientX: 10, clientY: 10, pointerId: 1 }); pd.fire('pointerdown', { clientX: 200, clientY: 200, pointerId: 2 })
  pd.fire('pointermove', { clientX: 200, clientY: 210, pointerId: 2 }); pd.fire('pointermove', { clientX: 12, clientY: 12, pointerId: 1 })
  pd.fire('pointercancel', { pointerId: 1 })
  pd.fire('pointerdown', { clientX: 300, clientY: 300, pointerId: 2 })   // after cancel a new stroke can start
  assert.doesNotThrow(flushRaf)
  lettersTool.unmount()
})
test('pad: events with NaN/undefined coords and pointerId undefined do not throw', () => {
  const host = new FakeEl('main'); lettersTool.mount(host); const pd = pad(host)
  assert.doesNotThrow(() => { pd.fire('pointerdown', { clientX: NaN, clientY: undefined }); pd.fire('pointermove', { clientX: NaN, clientY: NaN }); pd.fire('pointerup', { pointerId: undefined }); flushRaf() })
  lettersTool.unmount()
})
test('resize / orientationchange x100 do not throw and are batched into one frame', () => {
  const host = new FakeEl('main'); lettersTool.mount(host)
  for (let i = 0; i < 100; i++) windowListeners.filter((l) => l.live && (l.type === 'resize' || l.type === 'orientationchange')).forEach((l) => l.fn({}))
  assert.ok(rafQueue.size <= 1, 'rAF queue size ' + rafQueue.size); assert.doesNotThrow(flushRaf)
  lettersTool.unmount()
})
test('Clear and Next buttons: Next disabled click does nothing; Clear after pass re-disables Next', () => {
  const host = new FakeEl('main'); lettersTool.mount(host)
  const next = find(host, (e) => e.textContent === 'Next'), clear = find(host, (e) => e.textContent === 'Clear'), p = parent(host)
  next.fire('click'); flushRaf(); assert.match(text(host), /a · lowercase/)
  nowMs = 0; p.fire('pointerdown'); nowMs = 1100; flushRaf(); flushRaf(); assert.equal(next.disabled, false)
  clear.fire('click'); flushRaf(); assert.equal(next.disabled, true)
  nowMs = 2000; p.fire('pointerdown'); nowMs = 3100; flushRaf(); flushRaf(); next.fire('click'); flushRaf(); assert.match(text(host), /A · uppercase/)
  lettersTool.unmount()
})

// ---- round 2: scoring only on down/up/cancel ----
const { GLYPHS } = await import('../../src/tools/letters/glyphs.js')
const { resample } = await import('../../src/tools/letters/geometry.js')
const fresh = () => { const h = new FakeEl('main'); lettersTool.mount(h); return h }
const nextBtn = (h) => find(h, (e) => e.textContent === 'Next')
const rewardEl = (h) => find(h, (e) => e.className === 'reward')
const toPx = (p) => ({ clientX: p.x * 4, clientY: p.y * 4 })
const goTo = (h, id) => { // advance via parent pass + Next until glyph id shown
  while (!text(h).includes(id + ' · ')) { const p = parent(h); nowMs += 10; p.fire('pointerdown', { pointerId: 99 }); nowMs += 1100; flushRaf(); flushRaf(); nextBtn(h).fire('click'); flushRaf() }
}
const trace = (h, glyph, { lift = true, pid = 1, upType = 'pointerup' } = {}) => {
  const pd = pad(h)
  glyph.strokes.forEach((s, si) => {
    s.forEach((p, i) => pd.fire(i ? 'pointermove' : 'pointerdown', { ...toPx(p), pointerId: pid }))
    if (lift || si < glyph.strokes.length - 1) pd.fire(upType, { pointerId: pid })
  })
  flushRaf()
}

test('R2 reward appears after the finger lifts for a correct trace, not before (single-stroke glyph a)', () => {
  const h = fresh(); const g = GLYPHS.find((x) => x.id === 'a')
  trace(h, g, { lift: false })
  assert.equal(nextBtn(h).disabled, true, 'Next must stay disabled mid-stroke')
  assert.equal(rewardEl(h).style.visibility, 'hidden'); assert.ok(!text(h).includes('Well done'))
  pad(h).fire('pointerup', { pointerId: 1 }); flushRaf()
  assert.equal(nextBtn(h).disabled, false); assert.equal(rewardEl(h).style.visibility, 'visible'); assert.match(text(h), /Well done/)
  lettersTool.unmount()
})
test('R2 every glyph via DOM: trace by finger passes after the last lift; pointermove never changes the reward state (nothing passes mid-stroke); i/j dot is a tap that scores on press', () => {
  const h = fresh()
  for (const g of GLYPHS) {
    goTo(h, g.id)
    const pd = pad(h)
    let stable = nextBtn(h).disabled; assert.equal(stable, true, g.id + ' starts locked')
    g.strokes.forEach((s, si) => {
      s.forEach((p, i) => {
        pd.fire(i ? 'pointermove' : 'pointerdown', { ...toPx(p), pointerId: 1 }); flushRaf()
        if (i === 0) stable = nextBtn(h).disabled
        else assert.equal(nextBtn(h).disabled, stable, `${g.id} stroke ${si} point ${i}: reward state changed by a move`)
      })
      pd.fire('pointerup', { pointerId: 1 }); flushRaf(); stable = nextBtn(h).disabled
      const isDotLetter = g.id === 'i' || g.id === 'j'
      if (si === 0 && g.strokes.length > 1 && g.id !== 'A') assert.equal(stable, true, g.id + ' rewarded after first stroke alone')
      if (isDotLetter && si === 0) assert.equal(stable, true, g.id + ' stem alone rewarded')
    })
    assert.equal(nextBtn(h).disabled, false, g.id + ' no reward after final lift')
  }
  lettersTool.unmount()
})
test('R3 i/j via DOM: stem alone no reward; far tap (>12) no reward; near tap after stem rewards (on press, stays after lift)', () => {
  for (const id of ['i', 'j']) {
    const g = GLYPHS.find((x) => x.id === id)
    const stemUp = (h) => { const pd = pad(h); g.strokes[0].forEach((p, i) => pd.fire(i ? 'pointermove' : 'pointerdown', { ...toPx(p), pointerId: 1 })); pd.fire('pointerup', { pointerId: 1 }); flushRaf() }
    const tap = (h, x, y, pid = 2) => { const pd = pad(h); pd.fire('pointerdown', { clientX: x * 4, clientY: y * 4, pointerId: pid }); flushRaf(); const onPress = nextBtn(h).disabled; pd.fire('pointerup', { pointerId: pid }); flushRaf(); return { onPress, afterLift: nextBtn(h).disabled } }
    let h = fresh(); goTo(h, id); stemUp(h); assert.equal(nextBtn(h).disabled, true, id + ' stem alone')
    assert.deepEqual(tap(h, 50, 25 + 13), { onPress: true, afterLift: true }, id + ' tap 13 away'); assert.deepEqual(tap(h, 50 + 15, 25), { onPress: true, afterLift: true })
    assert.deepEqual(tap(h, 50, 25), { onPress: false, afterLift: false }, id + ' near tap'); assert.match(text(h), /Well done/)
    lettersLeave(h)
    h = fresh(); goTo(h, id)                                   // tap before the stem
    assert.deepEqual(tap(h, 50, 25), { onPress: true, afterLift: true }); stemUp(h); assert.equal(nextBtn(h).disabled, false, id + ' tap then stem')
    lettersLeave(h)
  }
})
function lettersLeave() { lettersTool.unmount() }
test('R3 DOM with scrolled/resized pad rect: events mapped through getBoundingClientRect still pass the i dot tap and reject a far tap', () => {
  const h = fresh(); goTo(h, 'i'); const pd = pad(h), g = GLYPHS.find((x) => x.id === 'i')
  pd.getBoundingClientRect = () => ({ left: 37, top: -250, width: 300, height: 300 })
  const px = (p) => ({ clientX: 37 + p.x * 3, clientY: -250 + p.y * 3 })
  g.strokes[0].forEach((p, i) => pd.fire(i ? 'pointermove' : 'pointerdown', { ...px(p), pointerId: 1 })); pd.fire('pointerup', { pointerId: 1 }); flushRaf()
  assert.equal(nextBtn(h).disabled, true)
  pd.fire('pointerdown', { ...px({ x: 50, y: 40 }), pointerId: 2 }); pd.fire('pointerup', { pointerId: 2 }); flushRaf(); assert.equal(nextBtn(h).disabled, true, '15 away')
  pd.getBoundingClientRect = () => ({ left: 5, top: 900, width: 150, height: 150 })     // layout changed
  pd.fire('pointerdown', { clientX: 5 + 50 * 1.5, clientY: 900 + 25 * 1.5, pointerId: 3 }); pd.fire('pointerup', { pointerId: 3 }); flushRaf()
  assert.equal(nextBtn(h).disabled, false); lettersTool.unmount()
})
test('R2 scribbles get no reward even after lifting, for every glyph (grid zigzag over the whole pad)', () => {
  const h = fresh()
  for (const g of GLYPHS) {
    goTo(h, g.id); const pd = pad(h)
    pd.fire('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 })
    for (let row = 0; row <= 100; row += 2) for (let c = 0; c <= 100; c += 2) pd.fire('pointermove', { clientX: (row % 4 ? 100 - c : c) * 4, clientY: row * 4, pointerId: 1 })
    pd.fire('pointerup', { pointerId: 1 }); flushRaf()
    assert.equal(nextBtn(h).disabled, true, g.id + ' scribble rewarded')
  }
  lettersTool.unmount()
})
test('R2 pointercancel after a complete trace still scores; cancel after a partial trace does not reward', () => {
  const h = fresh(); goTo(h, 'l'); const g = GLYPHS.find((x) => x.id === 'l')
  trace(h, g, { lift: false }); pad(h).fire('pointercancel', { pointerId: 1 }); flushRaf()
  assert.equal(nextBtn(h).disabled, false)
  const h2 = fresh(); goTo(h2, 'l'); const half = { strokes: [g.strokes[0].slice(0, 10)] }
  trace(h2, half, { lift: false }); pad(h2).fire('pointercancel', { pointerId: 1 }); flushRaf()
  assert.equal(nextBtn(h2).disabled, true)
  lettersTool.unmount()
})
test('R2 a stroke that never gets pointerup: no reward; later pointerdown ignored; Clear recovers and trace works', () => {
  const h = fresh(); goTo(h, 'l'); const g = GLYPHS.find((x) => x.id === 'l'), pd = pad(h)
  trace(h, g, { lift: false })
  assert.equal(nextBtn(h).disabled, true)
  pd.fire('pointerdown', { clientX: 10, clientY: 10, pointerId: 2 }); flushRaf()    // stuck: ignored
  assert.equal(nextBtn(h).disabled, true)
  find(h, (e) => e.textContent === 'Clear').fire('click'); flushRaf()
  trace(h, g); assert.equal(nextBtn(h).disabled, false)
  lettersTool.unmount()
})
test('R2 lost pointerup then parent pass still works and Next resets the stuck stroke', () => {
  const h = fresh(); trace(h, GLYPHS.find((x) => x.id === 'a'), { lift: false })
  nowMs = 0; parent(h).fire('pointerdown', { pointerId: 8 }); nowMs = 1200; flushRaf(); flushRaf()
  assert.equal(nextBtn(h).disabled, false); nextBtn(h).fire('click'); flushRaf()
  assert.match(text(h), /A · uppercase/)
  trace(h, GLYPHS.find((x) => x.id === 'A')); assert.equal(nextBtn(h).disabled, false)
  lettersTool.unmount()
})
test('R2 pointerup from a different finger does not trigger scoring/reward of the drawing finger', () => {
  const h = fresh(); goTo(h, 'l'); const g = GLYPHS.find((x) => x.id === 'l'), pd = pad(h)
  trace(h, g, { lift: false }); pd.fire('pointerup', { pointerId: 5 }); flushRaf()
  assert.equal(nextBtn(h).disabled, true)
  pd.fire('pointerup', { pointerId: 1 }); flushRaf(); assert.equal(nextBtn(h).disabled, false)
  lettersTool.unmount()
})
test('R2 parent hold still passes at 1 s and not at 900 ms (DOM), reward visible', () => {
  const h = fresh(); nowMs = 0; parent(h).fire('pointerdown', { pointerId: 3 }); nowMs = 900; flushRaf()
  assert.equal(nextBtn(h).disabled, true); nowMs = 1000; flushRaf(); flushRaf()
  assert.equal(nextBtn(h).disabled, false); assert.equal(rewardEl(h).style.visibility, 'visible')
  lettersTool.unmount()
})
test('R2 once rewarded, further scribbling/moves do not unreward; Clear does', () => {
  const h = fresh(); goTo(h, 'l'); trace(h, GLYPHS.find((x) => x.id === 'l')); const pd = pad(h)
  pd.fire('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 }); pd.fire('pointermove', { clientX: 390, clientY: 390, pointerId: 1 }); pd.fire('pointerup', { pointerId: 1 }); flushRaf()
  assert.equal(nextBtn(h).disabled, false)
  find(h, (e) => e.textContent === 'Clear').fire('click'); flushRaf(); assert.equal(nextBtn(h).disabled, true)
  lettersTool.unmount()
})
