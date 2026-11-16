// Fake DOM for the timer tool. Helper only (not a test file).
// It extends Tree B's installFakeDom() with a fake tree that mirrors index.html's #timer-tool.
import { installFakeDom } from '../fake-dom.js';

export function installTimerDom() {
  const base = installFakeDom();
  const { FakeEl } = base;
  let docListeners = 0;
  let oscStarts = 0;
  let clockMs = 0;
  const realNow = Date.now;
  const byId = new Map();
  const props = {};

  class TEl extends FakeEl {
    constructor(tag) {
      super(tag);
      this.attrs = new Map();
      this.dataset = {};
      this.scrollTop = 0;
      this._classes = new Set();
      this.classList = {
        toggle: (name, force) => {
          const on = force === undefined ? !this._classes.has(name) : Boolean(force);
          if (on) this._classes.add(name);
          else this._classes.delete(name);
          return on;
        },
        contains: (name) => this._classes.has(name),
        add: (name) => this._classes.add(name),
        remove: (name) => this._classes.delete(name),
      };
    }
    setAttribute(name, value) { this.attrs.set(name, String(value)); }
    getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; }
    hasAttribute(name) { return this.attrs.has(name); }
    toggleAttribute(name, force) {
      const on = force === undefined ? !this.attrs.has(name) : Boolean(force);
      if (on) this.attrs.set(name, '');
      else this.attrs.delete(name);
      return on;
    }
    get hidden() { return this.attrs.has('hidden'); }
    set hidden(v) { this.toggleAttribute('hidden', Boolean(v)); }
    remove() {}
    scrollTo(opts) { this.scrollTop = opts.top; }
    querySelectorAll(sel) {
      const out = [];
      (function walk(e) {
        for (const c of e.children) {
          if (c.tag === sel) out.push(c);
          walk(c);
        }
      })(this);
      return out;
    }
  }

  const el = (tag, id, parent) => {
    const e = new TEl(tag);
    if (id) { e.id = id; byId.set(id, e); }
    if (parent) parent.children.push(e);
    return e;
  };
  const btn = (id, parent, hidden) => {
    const b = el('button', id, parent);
    b.hidden = Boolean(hidden);
    return b;
  };

  // The static markup of index.html, as a tree.
  const root = el('div', 'timer-tool');
  const display = el('section', null, root);
  el('svg', 'ring', display);
  el('circle', 'ring-arc', display);
  el('p', 'time-text', display).textContent = '02:00';
  const done = el('p', 'done-text', display);
  done.textContent = 'Done';
  done.hidden = true;
  el('svg', 'rocket', display).hidden = true;
  const controls = el('section', null, root);
  const presets = el('div', 'presets', controls);
  for (const s of [120, 180, 300, 600]) {
    const b = btn(null, presets);
    b.dataset.presetSeconds = String(s);
  }
  const custom = el('div', 'custom', controls);
  for (const [w, l] of [['wheel-min', 'list-min'], ['wheel-sec', 'list-sec']]) {
    const field = el('div', null, custom);
    const wheel = el('div', w, field);
    wheel.setAttribute('aria-valuenow', '0');
    el('ul', l, wheel);
  }
  el('div', 'colours', controls);
  const actions = el('div', null, controls);
  btn('start-btn', actions);
  btn('pause-btn', actions, true);
  btn('resume-btn', actions, true);
  btn('reset-btn', actions, true);

  globalThis.document = {
    createElement: (t) => new TEl(t),
    getElementById: (id) => byId.get(id) ?? null,
    documentElement: { style: { setProperty: (k, v) => { props[k] = v; } } },
    hidden: false,
    _listeners: [],
    addEventListener(type, fn, opts) {
      const rec = { type, fn, live: true };
      this._listeners.push(rec);
      docListeners++;
      opts?.signal?.addEventListener('abort', () => { if (rec.live) { rec.live = false; docListeners--; } });
    },
    fire(type) {
      for (const l of this._listeners.slice()) if (l.live && l.type === type) l.fn({});
    },
  };

  globalThis.window.matchMedia = () => ({ matches: false });
  globalThis.window.AudioContext = class {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; }
    resume() { this.state = 'running'; }
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
    }
    createOscillator() {
      return { type: '', frequency: { value: 0 }, connect() {}, start() { oscStarts++; }, stop() {} };
    }
  };

  Date.now = () => clockMs;

  return {
    ...base,
    liveListeners: () => base.liveListeners() + docListeners,
    byId: (id) => byId.get(id),
    root,
    props,
    setClock: (ms) => { clockMs = ms; },
    chimes: () => oscStarts / 3,
    restore: () => { Date.now = realNow; },
  };
}
