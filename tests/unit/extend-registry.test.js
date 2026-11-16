import test from 'node:test'
import assert from 'node:assert/strict'
import { registerTool, listTools } from '../../src/registry.js'
import { createSwitchState, performSwitch } from '../../src/switcher.js'

test('AC8 a throwaway tool can be added using only registerTool', () => {
  let mounts = 0
  registerTool({ id: 'fake', label: 'Fake', mount: () => mounts++, unmount: () => {} })
  assert.ok(listTools().some((t) => t.id === 'fake'))
  const s = performSwitch(createSwitchState(), 'fake', {})
  assert.equal(s.activeId, 'fake')
  assert.equal(mounts, 1)
})
