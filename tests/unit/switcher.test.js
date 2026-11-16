import test from 'node:test'
import assert from 'node:assert/strict'
import { createRegistry } from '../../src/registry.js'
import { createSwitchState, switchTo, performSwitch } from '../../src/switcher.js'

function setup() {
  const log = []
  const r = createRegistry()
  for (const id of ['a', 'b'])
    r.registerTool({ id, label: id, mount: (h) => log.push(id + ':mount:' + (h && h.name)), unmount: () => log.push(id + ':unmount') })
  return { r, log }
}

test('AC3 switchTo', () => {
  const { r } = setup()
  const s = createSwitchState()
  const s2 = switchTo(s, 'a', r)
  assert.deepEqual(s2, { activeId: 'a' })
  assert.notEqual(s2, s)
  assert.strictEqual(switchTo(s2, 'nope', r), s2)
  assert.strictEqual(switchTo(s2, 'a', r), s2)
})

test('AC4 mount/unmount order', () => {
  const { r, log } = setup()
  const host = { name: 'H' }
  let s = performSwitch(createSwitchState(), 'a', host, r)
  assert.deepEqual(log, ['a:mount:H'])
  log.length = 0
  s = performSwitch(s, 'b', host, r)
  assert.deepEqual(log, ['a:unmount', 'b:mount:H'])
  log.length = 0
  performSwitch(s, 'nope', host, r)
  performSwitch(s, 'b', host, r)
  assert.deepEqual(log, [])
})

test('AC5 state keys', () => {
  const { r } = setup()
  assert.deepEqual(Object.keys(createSwitchState()), ['activeId'])
  assert.deepEqual(Object.keys(switchTo(createSwitchState(), 'a', r)), ['activeId'])
})
