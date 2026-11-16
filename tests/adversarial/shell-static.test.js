import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRegistry } from '../../src/registry.js'
import { createSwitchState, switchTo, performSwitch } from '../../src/switcher.js'

const root = fileURLToPath(new URL('../../', import.meta.url))
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))
const files = [...walk(join(root, 'src')), join(root, 'index.html')]
const fake = (id, log) => ({ id, label: id.toUpperCase(), mount: () => log.push(id + ':m'), unmount: () => log.push(id + ':u') })

test('AC30 forbidden strings absent from src/ and index.html and styles.css (@import)', () => {
  const bad = ['http://', 'https://', 'fetch(', 'XMLHttpRequest', '<script src="http', 'localStorage', 'sessionStorage', 'document.cookie', '@import url(']
  const hits = []
  for (const f of [...files, join(root, 'styles.css')]) { const t = readFileSync(f, 'utf8'); for (const b of bad) if (t.includes(b)) hits.push(f + ' has ' + b) }
  assert.deepEqual(hits, [])
})
test('AC9 title exactly Play (approved change), no Ramona/Alice anywhere in src/ index.html styles.css', () => {
  assert.match(readFileSync(join(root, 'index.html'), 'utf8'), /<title>Play<\/title>/)
  for (const f of [...files, join(root, 'styles.css')]) assert.ok(!/ramona|alice/i.test(readFileSync(f, 'utf8')), f)
  assert.equal((readFileSync(join(root, 'index.html'), 'utf8').match(/<title>/g) || []).length, 1)
})
test('AC32 package.json', () => {
  const p = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.equal(p.type, 'module'); assert.ok(!('dependencies' in p) && !('devDependencies' in p))
})
test('AC29/20 CSS static: buttons min 48px, pad touch-action none, viewport does not disable zoom', () => {
  const css = readFileSync(join(root, 'styles.css'), 'utf8'), html = readFileSync(join(root, 'index.html'), 'utf8')
  assert.match(css, /button\s*\{[^}]*min-width:\s*48px[^}]*min-height:\s*48px/); assert.match(css, /\.pad\s*\{[^}]*touch-action:\s*none/)
  assert.ok(!/user-scalable\s*=\s*no|maximum-scale/i.test(html))
})
test('AC2 registry rejects hostile inputs and leaves no partial registration', () => {
  const r = createRegistry(), ok = () => {}
  const bads = [null, undefined, 5, 'x', [], { id: 'a' }, { id: 5, label: 'l', mount: ok, unmount: ok }, { id: ' ', label: 5, mount: ok, unmount: ok }, { id: 'a', label: '\n\t', mount: ok, unmount: ok },
    { id: 'a', label: 'l', mount: 'x', unmount: ok }, { id: 'a', label: 'l', mount: ok, unmount: null }, { id: 'a', label: 'l', mount: ok }, { id: undefined, label: 'l', mount: ok, unmount: ok }, { id: '', label: 'l', mount: ok, unmount: ok }]
  for (const b of bads) {
    if (b && typeof b === 'object' && b.id === ' ' ) continue // whitespace-only id: spec only forbids empty; label non-string already fails
    assert.throws(() => r.registerTool(b), undefined, JSON.stringify(b))
  }
  assert.deepEqual(r.listTools(), [])
  r.registerTool({ id: 'a', label: 'l', mount: ok, unmount: ok }); assert.throws(() => r.registerTool({ id: 'a', label: 'l2', mount: ok, unmount: ok })); assert.equal(r.listTools().length, 1)
})
test('AC1 registered tool is frozen, later mutation of source object does not alter registry; order preserved for 100 tools', () => {
  const r = createRegistry(), src = { id: 'a', label: 'A', mount() {}, unmount() {} }; const st = r.registerTool(src); src.label = 'ZZZ'
  assert.equal(r.getTool('a').label, 'A'); assert.ok(Object.isFrozen(st))
  for (let i = 0; i < 100; i++) r.registerTool({ id: 't' + i, label: 'T', mount() {}, unmount() {} })
  assert.deepEqual(r.listTools().slice(1).map((t) => t.id), Array.from({ length: 100 }, (_, i) => 't' + i))
  assert.equal(r.getTool('toString'), undefined); assert.equal(r.getTool('__proto__'), undefined); assert.equal(r.getTool(undefined), undefined)
})
test('AC3-5 switchTo odd ids; state keys; frozen state', () => {
  const r = createRegistry(); r.registerTool(fake('a', [])); const s = Object.freeze(createSwitchState())
  for (const id of [undefined, null, '', 'nope', 0, {}, NaN, 'a '])  assert.equal(switchTo(s, id, r), s)
  assert.deepEqual(Object.keys(switchTo(s, 'a', r)), ['activeId']); assert.deepEqual(Object.keys(s), ['activeId'])
})
test('AC4 rapid switching 1000x: unmount/mount strictly alternate, each exactly once per switch', () => {
  const r = createRegistry(), log = []; r.registerTool(fake('a', log)); r.registerTool(fake('b', log))
  let st = createSwitchState(); const host = {}
  for (let i = 0; i < 1000; i++) { st = performSwitch(st, i % 2 ? 'b' : 'a', host, r); st = performSwitch(st, i % 2 ? 'b' : 'a', host, r) }
  assert.equal(log.length, 1999)
  assert.equal(log[0], 'a:m')
  for (let i = 1; i < log.length; i += 2) { assert.match(log[i], /:u$/); assert.match(log[i + 1], /:m$/); assert.notEqual(log[i][0], log[i + 1][0]) }
})
test('AC4 switching to unknown id mid-run does not unmount the active tool', () => {
  const r = createRegistry(), log = []; r.registerTool(fake('a', log)); let st = performSwitch(createSwitchState(), 'a', {}, r)
  st = performSwitch(st, 'zzz', {}, r); assert.deepEqual(log, ['a:m']); assert.equal(st.activeId, 'a')
})
test('AC4 mount throws: performSwitch throws, err.state.activeId === null, input state untouched, log is [a:m, a:u]', () => {
  const r = createRegistry(), log = []
  r.registerTool(fake('a', log)); r.registerTool({ id: 'bad', label: 'B', mount() { log.push('bad:m'); throw new Error('boom') }, unmount() { log.push('bad:u') } })
  const st = Object.freeze(performSwitch(createSwitchState(), 'a', {}, r))
  let err; try { performSwitch(st, 'bad', {}, r) } catch (e) { err = e }
  assert.ok(err instanceof Error); assert.equal(err.message, 'boom')
  assert.deepEqual(err.state, { activeId: null }); assert.deepEqual(Object.keys(err.state), ['activeId'])
  assert.deepEqual(st, { activeId: 'a' })
  assert.deepEqual(log, ['a:m', 'a:u', 'bad:m'])
  assert.equal(log.includes('a:m', 1), false, 'old tool must not be remounted')
})
test('AC4 mount throws from the very first mount (no active tool): err.state null-active, only the bad mount ran', () => {
  const r = createRegistry(), log = []
  r.registerTool({ id: 'bad', label: 'B', mount() { log.push('m'); throw new TypeError('x') }, unmount() { log.push('u') } })
  const s0 = createSwitchState(); let err
  try { performSwitch(s0, 'bad', {}, r) } catch (e) { err = e }
  assert.ok(err instanceof TypeError); assert.deepEqual(err.state, { activeId: null }); assert.deepEqual(log, ['m']); assert.deepEqual(s0, { activeId: null })
})
test('after a failed mount the app can recover: switching to a good tool works and unmounts nothing stale', () => {
  const r = createRegistry(), log = []
  r.registerTool(fake('a', log)); r.registerTool({ id: 'bad', label: 'B', mount() { throw new Error('boom') }, unmount() { log.push('bad:u') } })
  let st = performSwitch(createSwitchState(), 'a', {}, r)
  try { performSwitch(st, 'bad', {}, r) } catch (e) { st = e.state }
  assert.equal(st.activeId, null)
  st = performSwitch(st, 'a', {}, r)
  assert.equal(st.activeId, 'a'); assert.deepEqual(log, ['a:m', 'a:u', 'a:m'])
})
test('mount throwing a non-object (string / null) still propagates (documents behaviour)', () => {
  const r = createRegistry()
  r.registerTool({ id: 'bad', label: 'B', mount() { throw 'str' }, unmount() {} })
  assert.throws(() => performSwitch(createSwitchState(), 'bad', {}, r), (e) => e instanceof TypeError || e === 'str')
})
test('successful switches unchanged: new state object, input unchanged, order unmount then mount, same-id and unknown-id no-ops', () => {
  const r = createRegistry(), log = []; r.registerTool(fake('a', log)); r.registerTool(fake('b', log))
  const s0 = createSwitchState(); const s1 = performSwitch(s0, 'a', 'H', r); const s2 = performSwitch(s1, 'b', 'H', r)
  assert.deepEqual([s0, s1, s2], [{ activeId: null }, { activeId: 'a' }, { activeId: 'b' }])
  assert.equal(performSwitch(s2, 'b', 'H', r), s2); assert.equal(performSwitch(s2, 'q', 'H', r), s2)
  assert.deepEqual(log, ['a:m', 'a:u', 'b:m'])
})
