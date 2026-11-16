import test from 'node:test'
import assert from 'node:assert/strict'
import { createRegistry } from '../../src/registry.js'
import { createSwitchState, performSwitch } from '../../src/switcher.js'

test('bug 2: failed mount after unmount reports nothing active and leaves input state alone', () => {
  const r = createRegistry(), log = []
  r.registerTool({ id: 'a', label: 'A', mount() { log.push('a:m') }, unmount() { log.push('a:u') } })
  r.registerTool({ id: 'bad', label: 'B', mount() { log.push('bad:m'); throw new Error('boom') }, unmount() { log.push('bad:u') } })
  const st = Object.freeze(performSwitch(createSwitchState(), 'a', {}, r))
  log.length = 0
  let caught
  try { performSwitch(st, 'bad', {}, r) } catch (e) { caught = e }
  assert.equal(caught.message, 'boom')
  assert.equal(caught.state.activeId, null)
  assert.deepEqual(st, { activeId: 'a' })
  assert.deepEqual(log, ['a:u', 'bad:m'])
})
