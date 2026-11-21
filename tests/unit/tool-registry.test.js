// The one place that pins the tab order. Other tests check invariants, so adding a tool
// only changes this list (and the product roadmap), not every test.
import test from 'node:test'
import assert from 'node:assert/strict'
import '../../src/tools/index.js'
import { listTools } from '../../src/registry.js'
import { TOOL_ICONS } from '../../src/icons.js'

const TAB_ORDER = [['timer', 'Timer'], ['letters', 'Letters'], ['shapes', 'Shapes'], ['complex', 'Complex shapes']]

test('tab order and labels match the product order (the only test that pins it)', () => {
  assert.deepEqual(listTools().map((t) => [t.id, t.label]), TAB_ORDER)
})

test('invariant: tool ids are unique and labels are non-empty', () => {
  const tools = listTools()
  assert.equal(new Set(tools.map((t) => t.id)).size, tools.length)
  for (const t of tools) assert.ok(t.label.trim().length > 0, t.id)
})

test('invariant: the first tool is the default shown on load (the timer)', () => {
  assert.equal(listTools()[0].id, 'timer')
})

test('invariant: every tab has an icon, so the bar never shows a bare text label by mistake', () => {
  for (const t of listTools()) assert.ok(TOOL_ICONS[t.id], t.id)
})
