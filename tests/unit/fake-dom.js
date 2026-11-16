// Minimal fake DOM for mount/unmount tests. Helper only (not a test file).
export function installFakeDom() {
  let live = 0, rafSeq = 0, nowMs = 0
  const rafQueue = new Map()
  class FakeEl {
    constructor(tag) {
      this.tag = tag; this.children = []; this.style = {}; this.className = ''; this.textContent = ''
      this.listeners = []; this.captured = new Set(); this.disabled = false; this.width = 0; this.height = 0; this.clientWidth = 400
    }
    append(...c) { this.children.push(...c) }
    appendChild(c) { this.children.push(c) }
    replaceChildren(...c) { this.children = c }
    setAttribute() {}
    addEventListener(type, fn, opts) {
      const rec = { type, fn, live: true }
      this.listeners.push(rec); live++
      opts?.signal?.addEventListener('abort', () => { if (rec.live) { rec.live = false; live-- } })
    }
    fire(type, ev = {}) {
      for (const l of this.listeners.slice()) if (l.live && l.type === type) l.fn({ preventDefault() {}, clientX: 0, clientY: 0, pointerId: 1, ...ev })
    }
    setPointerCapture(id) { this.captured.add(id) }
    hasPointerCapture(id) { return this.captured.has(id) }
    releasePointerCapture(id) { this.captured.delete(id) }
    getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 } }
    getContext() { return new Proxy({}, { get: (_, k) => (k === 'canvas' ? {} : () => {}), set: () => true }) }
  }
  globalThis.document = { createElement: (t) => new FakeEl(t) }
  globalThis.window = {
    devicePixelRatio: 2,
    addEventListener(type, fn, opts) {
      const rec = { type, fn, live: true }
      live++
      opts?.signal?.addEventListener('abort', () => { if (rec.live) { rec.live = false; live-- } })
    },
  }
  globalThis.requestAnimationFrame = (fn) => { const id = ++rafSeq; rafQueue.set(id, fn); return id }
  globalThis.cancelAnimationFrame = (id) => { rafQueue.delete(id) }
  Object.defineProperty(globalThis, 'performance', { value: { now: () => nowMs }, configurable: true })
  const makeHost = () => {
    const h = new FakeEl('main')
    h.log = []
    h.replaceChildren = (...c) => { h.children = c; h.log.push(c.length === 0 ? 'clear' : 'build') }
    return h
  }
  const flushRaf = () => { const q = [...rafQueue]; rafQueue.clear(); for (const [, fn] of q) fn() }
  const find = (el, pred) => { if (pred(el)) return el; for (const c of el.children) { const r = find(c, pred); if (r) return r } return null }
  const text = (h) => { let s = ''; (function w(e) { s += e.textContent + ' '; e.children.forEach(w) })(h); return s }
  return { FakeEl, makeHost, flushRaf, pendingRaf: () => rafQueue.size, liveListeners: () => live, setNow: (ms) => { nowMs = ms }, find, text }
}
