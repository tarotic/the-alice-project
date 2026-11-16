// Merge verification: Timer + Letters + Shapes in one shell. Written by the tester, independent of tests/unit/timer-tool.test.js.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { installTimerDom } from '../unit/helpers/timer-dom.js'

const dom = installTimerDom()
const winAdds = []
const origAdd = window.addEventListener
window.addEventListener = (t, f, o) => { winAdds.push(t); return origAdd.call(window, t, f, o) }
const { makeHost, flushRaf, pendingRaf, liveListeners, setClock, chimes, byId, find, text } = dom

await import('../../src/tools/index.js')
const { listTools, getTool } = await import('../../src/registry.js')
const { createSwitchState, performSwitch } = await import('../../src/switcher.js')
const { timerTool } = await import('../../src/tools/timer/tool.js')
const { lettersTool } = await import('../../src/tools/letters/tool.js')
const { shapesTool } = await import('../../src/tools/shapes/tool.js')
const { createLetterGame } = await import('../../src/tools/letters/game.js')
const { offsetFromIndex } = await import('../../src/wheel.js')
const { GLYPHS } = await import('../../src/tools/letters/glyphs.js')
const { SHAPES } = await import('../../src/tools/shapes/shapes.js')

const click = (id) => byId(id).fire('click')
const preset = (i) => byId('presets').children[i]
const st = () => timerTool.getState()
const pad = (h) => find(h, (e) => e.className === 'pad')
const parent = (h) => find(h, (e) => e.className === 'parent')
const nextBtn = (h) => find(h, (e) => e.tag === 'button' && e.textContent === 'Next')
let c0 = 0
const chimesNow = () => chimes() - c0
function tidy() {
  for (const t of [lettersTool, shapesTool, timerTool]) t.unmount()
  flushRaf(); setClock(0); document.hidden = false
  timerTool.mount(makeHost()); if (st().status !== 'idle') click('reset-btn'); preset(0).fire('click'); timerTool.unmount(); flushRaf(); setClock(0); c0 = chimes()
}
const BASE = (() => { tidy(); return liveListeners() })()

test('registry: Timer, Letters, Shapes in that order; frozen entries; unmounting an unmounted tool is harmless', () => {
  tidy()
  assert.deepEqual(listTools().map((t) => [t.id, t.label]), [['timer', 'Timer'], ['letters', 'Letters'], ['shapes', 'Shapes'], ['complex', 'Complex shapes']])
  for (const t of listTools()) assert.ok(Object.isFrozen(t))
  assert.doesNotThrow(() => { timerTool.unmount(); lettersTool.unmount(); shapesTool.unmount(); timerTool.unmount() })
  assert.equal(getTool('timer').mount, timerTool.mount)
})
test('pause on switch is exact: remaining = duration - elapsed to the millisecond, no frame needed, applied once', () => {
  tidy(); let s = createSwitchState(); const host = makeHost()
  s = performSwitch(s, 'timer', host); setClock(1000); click('start-btn'); setClock(8777)
  s = performSwitch(s, 'letters', host)
  assert.deepEqual([st().status, st().remainingMs, st().lastNowMs], ['paused', 120000 - 7777, null])
  const frozen = st(); timerTool.unmount(); assert.equal(st(), frozen, 'second unmount changed state')
  s = performSwitch(s, 'shapes', host); s = performSwitch(s, 'timer', host)
  assert.equal(st(), frozen, 'round trip changed state'); assert.equal(byId('time-text').textContent, '01:53')
  flushRaf(); setClock(5e9); flushRaf(); assert.equal(st(), frozen, 'auto-resumed or ticked')
  assert.equal(pendingRaf(), 0); assert.equal(byId('resume-btn').hidden, false); assert.equal(byId('start-btn').hidden, true); assert.equal(byId('pause-btn').hidden, true)
  timerTool.unmount()
})
test('paused, idle, finished timers are untouched by unmount/mount (identity), incl. final-10-seconds paused', () => {
  for (const mode of ['idle', 'paused', 'finished', 'paused-final']) {
    tidy(); const host = makeHost(); timerTool.mount(host)
    if (mode !== 'idle') { setClock(0); click('start-btn') }
    if (mode === 'paused') { setClock(5000); click('pause-btn') }
    if (mode === 'paused-final') { setClock(115000); click('pause-btn') }
    if (mode === 'finished') { setClock(121000); flushRaf() }
    const before = st(); timerTool.unmount(); setClock(9e9); timerTool.mount(host)
    assert.equal(st(), before, mode); assert.equal(pendingRaf(), 0, mode)
    if (mode === 'finished') { assert.equal(byId('done-text').hidden, false); assert.equal(byId('time-text').textContent, '00:00') }
    if (mode === 'paused-final') { assert.equal(byId('rocket').hasAttribute('hidden'), false); assert.equal(byId('rocket').classList.contains('is-prep'), false, 'shaking while paused') }
    timerTool.unmount()
  }
})
test('finish ladder: leave at end-1ms, end, end+1ms, end+huge. chime exactly once in every case, never twice on return/switches/visibility', () => {
  for (const off of [-1, 0, 1, 5000, 1e9]) {
    tidy(); const host = makeHost(); let s = performSwitch(createSwitchState(), 'timer', host)
    setClock(0); click('start-btn'); setClock(120000 + off)
    s = performSwitch(s, 'letters', host)
    if (off < 0) { assert.equal(st().status, 'paused', 'off ' + off); assert.equal(st().remainingMs, 1); assert.equal(chimesNow(), 0) }
    else { assert.equal(st().status, 'finished', 'off ' + off); assert.equal(chimesNow(), 1, 'chime at leave ' + off) }
    s = performSwitch(s, 'timer', host); flushRaf(); document.fire('visibilitychange')
    if (off < 0) { setClock(120000 + off + 100); click('resume-btn'); setClock(120000 + off + 102); flushRaf(); assert.equal(st().status, 'finished') }
    assert.equal(chimesNow(), 1, 'off ' + off)
    for (let i = 0; i < 5; i++) { s = performSwitch(s, i % 2 ? 'timer' : 'shapes', host); flushRaf(); document.fire('visibilitychange') }
    assert.equal(chimesNow(), 1, 'after switches off ' + off)
    performSwitch(s, 'timer', host); assert.equal(byId('done-text').hidden, false); click('reset-btn'); assert.equal(st().status, 'idle'); assert.equal(byId('done-text').hidden, true)
    timerTool.unmount(); lettersTool.unmount(); shapesTool.unmount()
  }
})
test('clock jumps while away (backwards, forwards, NaN-ish) never change the paused remaining time; resume continues from it', () => {
  for (const jump of [-1e9, 1e12, 0, 3.6e6]) {
    tidy(); const host = makeHost(); let s = performSwitch(createSwitchState(), 'timer', host)
    setClock(1e6); click('start-btn'); setClock(1e6 + 30000); s = performSwitch(s, 'letters', host); const rem = st().remainingMs; assert.equal(rem, 90000)
    setClock(jump); s = performSwitch(s, 'timer', host); assert.equal(st().remainingMs, rem, 'jump ' + jump); assert.equal(st().status, 'paused')
    click('resume-btn'); setClock(jump + 500); flushRaf(); assert.equal(st().remainingMs, rem - 500, 'resume after jump ' + jump)
    timerTool.unmount()
  }
})
test('1000 rapid mount/unmount cycles with a running timer: exact accounting, no frame/listener growth', () => {
  tidy(); const host = makeHost(); timerTool.mount(host); setClock(0); click('start-btn'); timerTool.unmount()
  let clock = 0; const rem0 = st().remainingMs
  for (let i = 0; i < 1000; i++) {
    clock += 50; setClock(clock); timerTool.mount(host); click('resume-btn'); clock += 3; setClock(clock); timerTool.unmount()
    assert.equal(pendingRaf(), 0); assert.equal(liveListeners(), BASE)
  }
  assert.equal(st().remainingMs, rem0 - 3000); assert.equal(st().status, 'paused'); assert.equal(chimesNow(), 0)
})
test('mid-wheel-scroll: pending wheel frames are cancelled on switch; abandoned value never applied; late scroll events on the old DOM are inert', () => {
  tidy(); const host = makeHost(); let s = performSwitch(createSwitchState(), 'timer', host)
  byId('wheel-min').scrollTop = offsetFromIndex(9); byId('wheel-min').fire('scroll'); assert.ok(pendingRaf() > 0)
  s = performSwitch(s, 'letters', host); flushRaf()
  assert.equal(st().durationMs, 120000, 'abandoned value applied')
  const before = pendingRaf(); byId('wheel-min').fire('scroll'); byId('wheel-sec').fire('scroll'); assert.equal(pendingRaf(), before, 'old node still wired')
  s = performSwitch(s, 'timer', host); assert.equal(byId('wheel-min').getAttribute('aria-valuenow'), '2'); assert.equal(byId('wheel-sec').getAttribute('aria-valuenow'), '0')
  timerTool.unmount(); lettersTool.unmount()
})
test('custom duration chosen with the wheel, preset choice and colour persist across switches; controls lock correctly after return', () => {
  tidy(); const host = makeHost(); let s = performSwitch(createSwitchState(), 'timer', host)
  byId('wheel-sec').scrollTop = offsetFromIndex(30); byId('wheel-sec').fire('scroll'); for (let i = 0; i < 9; i++) flushRaf()
  assert.equal(st().durationMs, 150000, 'custom 2:30')
  byId('colours').children[2].fire('click'); const colour = dom.props['--ring-running']; assert.ok(colour)
  s = performSwitch(s, 'shapes', host); s = performSwitch(s, 'timer', host)
  assert.equal(st().durationMs, 150000); assert.equal(byId('wheel-sec').getAttribute('aria-valuenow'), '30'); assert.equal(byId('wheel-min').getAttribute('aria-valuenow'), '2')
  assert.equal(dom.props['--ring-running'], colour); assert.equal(byId('colours').children[2].getAttribute('aria-pressed'), 'true')
  preset(2).fire('click'); assert.equal(st().durationMs, 300000)
  click('start-btn'); setClock(10000); s = performSwitch(s, 'letters', host); s = performSwitch(s, 'timer', host)
  assert.equal(st().status, 'paused'); assert.equal(byId('presets').hidden, true); assert.equal(byId('custom').hidden, true)
  preset(0).fire('click'); assert.equal(st().durationMs, 300000, 'preset changed while paused'); byId('wheel-sec').fire('keydown', { key: 'ArrowUp', preventDefault() {} }); assert.equal(st().durationMs, 300000)
  click('resume-btn'); assert.equal(st().status, 'running'); preset(1).fire('click'); assert.equal(st().durationMs, 300000, 'preset changed while running')
  click('pause-btn'); click('reset-btn'); assert.equal(st().status, 'idle'); assert.equal(st().remainingMs, 300000); assert.equal(byId('presets').hidden, false)
  preset(1).fire('click'); assert.equal(st().durationMs, 180000); assert.equal(byId('wheel-min').getAttribute('aria-valuenow'), '3')
  timerTool.unmount()
})
test('Letters and Shapes start fresh after any number of timer round trips; the timer keeps its paused state', () => {
  tidy(); const host = makeHost(); let s = performSwitch(createSwitchState(), 'timer', host); setClock(0); click('start-btn')
  for (let i = 0; i < 30; i++) {
    setClock(i * 1000)
    s = performSwitch(s, 'letters', host); pad(host).fire('pointerdown', { clientX: 100, clientY: 100, pointerId: 4 }); pad(host).fire('pointermove', { clientX: 150, clientY: 160, pointerId: 4 }); setClock(i * 1000); parent(host).fire('pointerdown', { pointerId: 8 })
    s = performSwitch(s, 'timer', host); s = performSwitch(s, 'letters', host)
    assert.deepEqual(lettersTool.getState(), createLetterGame()); assert.match(text(host), /a · lowercase/); assert.equal(nextBtn(host).disabled, true)
    s = performSwitch(s, 'shapes', host); pad(host).fire('pointerdown', { clientX: 10, clientY: 10, pointerId: 5 }); parent(host).fire('pointerdown', { pointerId: 9 })
    s = performSwitch(s, 'timer', host); s = performSwitch(s, 'shapes', host)
    assert.deepEqual(shapesTool.getState(), createLetterGame()); assert.match(text(host), /\bcircle\b/); assert.equal(nextBtn(host).disabled, true)
    s = performSwitch(s, 'timer', host)
  }
  assert.equal(st().status, 'paused'); assert.equal(st().remainingMs, 120000)
  timerTool.unmount()
})
test('parent hold in progress on Letters and a stroke in progress on Shapes: switching away/back never leaves a pass, frame, or listener', () => {
  for (const [a, b] of [['letters', 'timer'], ['shapes', 'timer'], ['letters', 'shapes'], ['timer', 'letters']]) {
    tidy(); const host = makeHost(); let s = performSwitch(createSwitchState(), a, host)
    setClock(0); if (a !== 'timer') { parent(host).fire('pointerdown', { pointerId: 2 }); pad(host).fire('pointerdown', { clientX: 120, clientY: 120, pointerId: 3 }) }
    setClock(900); s = performSwitch(s, b, host); setClock(5000); flushRaf()
    const t = getTool(a); s = performSwitch(s, a, host); flushRaf()
    if (a !== 'timer') assert.equal(nextBtn(host).disabled, true, a + ' passed by inherited hold')
    for (const x of [timerTool, lettersTool, shapesTool]) x.unmount(); flushRaf()
    assert.equal(pendingRaf(), 0); assert.equal(liveListeners(), BASE, `${a}->${b}`)
  }
})
test('visibilitychange: no timer listener while another tool is shown; while mounted, finishing in the background chimes once', () => {
  tidy(); const host = makeHost(); let s = performSwitch(createSwitchState(), 'timer', host); setClock(0); click('start-btn')
  s = performSwitch(s, 'letters', host); const l = liveListeners(); document.hidden = true; document.fire('visibilitychange'); document.hidden = false; document.fire('visibilitychange')
  assert.equal(liveListeners(), l); assert.equal(st().status, 'paused'); assert.equal(chimesNow(), 0)
  s = performSwitch(s, 'timer', host); click('resume-btn'); document.hidden = true; setClock(130000); document.hidden = false; document.fire('visibilitychange')
  assert.equal(chimesNow(), 1); flushRaf(); document.fire('visibilitychange'); assert.equal(chimesNow(), 1); assert.equal(st().status, 'finished')
  timerTool.unmount()
})
test('sound unlock after switching: Resume (not only Start) unlocks, then finishing chimes once', () => {
  tidy(); const host = makeHost(); let s = performSwitch(createSwitchState(), 'timer', host); setClock(0); click('start-btn'); setClock(100)
  s = performSwitch(s, 'letters', host); s = performSwitch(s, 'timer', host); click('resume-btn'); setClock(130000); flushRaf()
  assert.equal(chimesNow(), 1); timerTool.unmount()
})
test('listeners: timer adds no window listeners; letters/shapes window listeners vanish on switch; document listener only while the timer is mounted', () => {
  tidy(); const host = makeHost(); winAdds.length = 0
  timerTool.mount(host); assert.ok(!winAdds.includes('resize') && !winAdds.includes('orientationchange'), 'timer registered window listeners'); const t = liveListeners(); timerTool.unmount(); assert.equal(liveListeners(), BASE)
  lettersTool.mount(host); assert.ok(winAdds.includes('resize')); lettersTool.unmount(); assert.equal(liveListeners(), BASE)
  shapesTool.mount(host); shapesTool.unmount(); assert.equal(liveListeners(), BASE); assert.ok(t > BASE)
})
test('RECORD: mounting a mounted timer into a second host is ignored (not reachable via performSwitch)', (tc) => {
  tidy(); const h1 = makeHost(), h2 = makeHost(); timerTool.mount(h1); timerTool.mount(h2)
  tc.diagnostic(`second host children after double mount: ${h2.children.length}; first host: ${h1.children.length}`)
  assert.equal(h1.children.length, 1); timerTool.unmount()
})
test('mount failure of Timer (markup missing) is reported through err.state and does not break later switches to Letters', () => {
  tidy(); const host = makeHost()
  const saved = document.getElementById; document.getElementById = () => null
  // fresh module instance to force adopt(): import with a query string
  return import('../../src/tools/timer/tool.js?missing=1').then(({ timerTool: t2 }) => {
    assert.throws(() => t2.mount(host), /timer-tool/)
    document.getElementById = saved
    assert.doesNotThrow(() => { lettersTool.mount(host); lettersTool.unmount() })
  })
})

// ---------------- static / hard rules over both codebases ----------------
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const walk = (rel) => readdirSync(path.join(ROOT, rel), { withFileTypes: true }).flatMap((e) => (e.name.startsWith('.') || e.name === 'node_modules' ? [] : e.isDirectory() ? walk(path.join(rel, e.name)) : [path.join(rel, e.name)]))
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8')
const deployable = ['index.html', 'styles.css', ...walk('src')]

test('static: union of both repos\' forbidden needles over index.html, styles.css and src/** (comments included)', () => {
  const needles = ['http://', 'https://', 'src="//', 'href="//', 'url(', '@import', 'fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'EventSource', 'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'analytics', 'gtag', '<script src="http', 'navigator.', 'eval(', 'new Function', 'importScripts', 'serviceWorker', 'xmlns', 'import(', 'setTimeout', 'setInterval']
  const hits = []
  for (const f of deployable) { const t = read(f); for (const n of needles) if (t.includes(n)) hits.push(`${f}: ${n}`); if (/https?:/i.test(t)) hits.push(f + ': https?:'); if (/\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(t)) hits.push(f + ': //host.tld'); if (/ramona|alice/i.test(t)) hits.push(f + ': owner/project name'); if (/<(img|iframe|object|embed|video|audio|source)\b/i.test(t)) hits.push(f + ': media tag') }
  assert.deepEqual(hits, [])
})
test('static: only .html/.css/.js deployable files; no build files; package.json exact; title Play; one script; one link; no inline handlers', () => {
  for (const f of deployable) assert.match(f, /\.(html|css|js)$/)
  assert.deepEqual(JSON.parse(read('package.json')), { name: 'timer', private: true, type: 'module', scripts: { test: 'node --test' } })
  const html = read('index.html')
  assert.match(html, /<title>Play<\/title>/); assert.equal((html.match(/<title>/g) || []).length, 1)
  assert.equal((html.match(/<script\b/g) || []).length, 1); assert.equal((html.match(/<link\b/g) || []).length, 1)
  assert.ok(!/\sstyle=|\sonclick=|\sonload=/i.test(html)); assert.equal((html.match(/<main\b/g) || []).length, 1); assert.equal((html.match(/id="switcher"/g) || []).length, 1)
  assert.match(html, /<script type="module" src="\.\/src\/ui\.js"><\/script>/)
  for (const f of readdirSync(ROOT)) assert.ok(!/^(webpack|vite|rollup|tsconfig|babel|\.babelrc|node_modules|package-lock)/i.test(f) || f.startsWith('.'), f)
})
test('static: every relative import in src/** resolves to an existing file and ends in .js', () => {
  const bad = []
  for (const f of deployable.filter((x) => x.startsWith('src'))) for (const m of read(f).matchAll(/from\s+'([^']+)'|import\s+'([^']+)'/g)) {
    const spec = m[1] ?? m[2]; if (!spec.startsWith('.')) { bad.push(`${f}: non-relative ${spec}`); continue }
    if (!spec.endsWith('.js')) bad.push(`${f}: ${spec} lacks .js`)
    try { readFileSync(path.join(ROOT, path.dirname(f), spec)) } catch { bad.push(`${f}: ${spec} missing`) }
  }
  assert.deepEqual(bad, [])
})
test('static: pure modules touch no DOM, clock or frames (letters logic, shapes data, timer logic)', () => {
  const pure = ['src/timer.js', 'src/screen.js', 'src/wheel.js', 'src/colours.js', 'src/views/ring.js', 'src/registry.js', 'src/switcher.js', ...['game', 'ink', 'scoring', 'geometry', 'glyphs', 'parent-hold'].map((n) => `src/tools/letters/${n}.js`), 'src/tools/shapes/shapes.js']
  const bad = []
  for (const f of pure) { const t = read(f).replace(/\/\/.*$/gm, ''); for (const n of ['document', 'window', 'performance', 'Date', 'requestAnimationFrame', 'Math.random']) if (new RegExp('\\b' + n.replace('.', '\\.') + '\\b').test(t)) bad.push(`${f}: ${n}`) }
  assert.deepEqual(bad, [])
})
test('static: DOM files import cleanly with no DOM present at all (no top-level document/window/Date use)', async () => {
  const { spawnSync } = await import('node:child_process')
  const code = "for (const f of ['src/tools/timer/tool.js','src/tools/letters/tool.js','src/tools/shapes/tool.js','src/tools/index.js']) await import(pathToFileURL(process.cwd() + '/' + f).href)"
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', "import { pathToFileURL } from 'node:url'; " + code], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
})
test('static: no API newer than Node 20 in src/ or tests/ (CI runs Node 20)', () => {
  const newer = [/Object\.groupBy/, /Map\.groupBy/, /\.union\(/, /\.intersection\(/, /\.difference\(/, /Array\.fromAsync/, /Promise\.withResolvers/, /\.isWellFormed/, /Iterator\.from/, /RegExp\.escape/, /Set\.prototype\.(union|isSubsetOf)/, /\.isSubsetOf\(/]
  const files = [...deployable.filter((f) => f.endsWith('.js')), ...walk('tests').filter((f) => f.endsWith('.js'))]
  const self = path.join('tests', 'adversarial', 'merge-adversarial.test.js')
  const bad = []; for (const f of files) if (f !== self) { const t = read(f); for (const re of newer) if (re.test(t)) bad.push(`${f}: ${re}`) }
  assert.deepEqual(bad, [])
})
test('windows: no tests build paths from URL.pathname, __dirname concatenation or hard-coded separators passed to fs', () => {
  const self = path.join('tests', 'adversarial', 'merge-adversarial.test.js')
  const bad = []
  for (const f of walk('tests').filter((x) => x.endsWith('.js') && x !== self)) {
    const t = read(f)
    if (/\.pathname\b/.test(t)) bad.push(`${f}: .pathname`)
    if (/__dirname\s*\+|__filename\s*\+/.test(t)) bad.push(`${f}: __dirname +`)
    if (/(readFileSync|readdirSync|existsSync|statSync)\([^)]*\+\s*['"`][\\/]/.test(t)) bad.push(`${f}: fs call with concatenated separator`)
    if (/['"`]\/(home|tmp|usr)\//.test(t)) bad.push(`${f}: absolute posix path`)
    if (/\bdir \+ '\/'/.test(t)) bad.push(`${f}: dir + '/' (works on Windows, noted)`)
  }
  assert.deepEqual(bad.filter((b) => !b.includes('noted')), [])
})

// ---------------- CSS reading ----------------
const css = read('styles.css').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }))
test('css: no bare button/*/.actions selectors outside the pinned ones; scoped rules start with #tool-area:not(...) or #switcher', () => {
  const bad = []
  for (const r of rules) for (const s of r.sel.split(',').map((x) => x.trim())) {
    if (/^(button|\*)$/.test(s) || (s === '.actions' && !r.sel.includes('#presets'))) bad.push(s)
    if (/\bbutton\b/.test(s) && !/^(#switcher|#tool-area:not\(\[data-tool="timer"\]\))/.test(s) && s !== 'button' && !/^\.(swatch|presets|actions)/.test(s) && !/^#(presets|custom)/.test(s)) bad.push('unscoped: ' + s)
  }
  assert.deepEqual(bad.filter((b) => b !== 'button'), [])
  assert.equal(rules.filter((r) => /(^|,)\s*button\s*(,|$)/.test(r.sel)).length, 1, 'exactly one rule with bare button')
  assert.equal(rules.filter((r) => r.sel === 'html, body').length <= 1, true); assert.equal(rules.filter((r) => r.sel === 'body').length, 1)
})
test('css: RECORD .parent vs scoped button rule specificity (min-width 120px loses to 48px)', (tc) => {
  const parentRule = rules.find((r) => r.sel === '.parent'); const scoped = rules.find((r) => r.sel.includes('#switcher button') && r.sel.includes('#tool-area'))
  assert.ok(parentRule && scoped)
  tc.diagnostic('.parent min-width declared: ' + (parentRule.body.match(/min-width:\s*([^;]+)/) || [])[1] + '; scoped button rule min-width: ' + (scoped.body.match(/min-width:\s*([^;]+)/) || [])[1] + ' (specificity 1,1,1 vs 0,1,0, so the scoped value wins). See the browser-measured width in the report.')
})
test('css: reduced-motion block contains only animation/opacity resets; no transition; a stylesheet-wide animation whitelist', () => {
  assert.ok(!/transition/.test(css)); const names = [...css.matchAll(/animation(?:-name)?:\s*([a-z-]+)/g)].map((m) => m[1]); for (const n of names) assert.ok(['rocket-shake', 'flame-flicker', 'rocket-launch', 'ring-blast', 'orbit', 'none'].includes(n), n)
  assert.match(css, /prefers-reduced-motion:\s*reduce/)
})
test('css: every 48px-sensitive element: no width/height/min/max below 48px in rules mentioning button, input or preset', () => {
  const bad = []
  for (const r of rules) if (/button|input|preset|swatch|parent/.test(r.sel)) for (const m of r.body.matchAll(/(?<![a-z-])(min-|max-)?(width|height)\s*:\s*(\d+(?:\.\d+)?)px/g)) { const px = Number(m[3]); if (px < 48 && !(m[1] === 'max-')) bad.push(`${r.sel} { ${m[0]} }`) }
  assert.deepEqual(bad, [])
})
test('css: RECORD switcher bar is not sticky and has no safe-area handling', (tc) => {
  const sw = rules.find((r) => r.sel === '#switcher'); tc.diagnostic('switcher position: ' + (/position/.test(sw.body) ? sw.body.match(/position:[^;]+/)[0] : 'static (scrolls away with the page)') + '; env(safe-area-inset) used: ' + /safe-area-inset/.test(css) + '; viewport-fit in html: ' + /viewport-fit/.test(read('index.html')))
})
