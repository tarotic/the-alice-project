import test from 'node:test'
import assert from 'node:assert/strict'
import * as mod from '../../src/registry.js'

const noop = () => {}
const mk = (id) => ({ id, label: 'L' + id, mount: noop, unmount: noop })

test('AC1 registration order, getTool, copy semantics', () => {
  const r = mod.createRegistry()
  r.registerTool(mk('a')); r.registerTool(mk('b')); r.registerTool(mk('c'))
  assert.deepEqual(r.listTools().map((t) => t.id), ['a', 'b', 'c'])
  assert.equal(r.getTool('b').id, 'b')
  assert.equal(r.getTool('zzz'), undefined)
  const list = r.listTools()
  list.pop()
  assert.equal(r.listTools().length, 3)
})

test('AC1 named exports exist', () => {
  for (const n of ['registerTool', 'listTools', 'getTool']) assert.equal(typeof mod[n], 'function')
})

test('AC2 invalid tools throw', () => {
  const r = mod.createRegistry()
  r.registerTool(mk('dup'))
  const bad = [
    { label: 'x', mount: noop, unmount: noop },
    { ...mk(''), id: '' },
    { ...mk('n'), id: 5 },
    mk('dup'),
    { ...mk('e'), label: '' },
    { ...mk('s'), label: '   ' },
    { id: 'nl', mount: noop, unmount: noop },
    { ...mk('m'), mount: 'x' },
    { ...mk('u'), unmount: 1 },
    null,
    'str',
  ]
  for (const t of bad) assert.throws(() => r.registerTool(t), Error)
})
