import { defaultRegistry } from './registry.js'

export function createSwitchState(activeId = null) {
  return { activeId }
}

export function switchTo(state, id, registry = defaultRegistry) {
  if (registry.getTool(id) === undefined) return state
  if (id === state.activeId) return state
  return { activeId: id }
}

export function performSwitch(state, id, host, registry = defaultRegistry) {
  const next = switchTo(state, id, registry)
  if (next === state) return state
  if (state.activeId !== null) registry.getTool(state.activeId).unmount()
  try {
    registry.getTool(id).mount(host)
  } catch (err) {
    // The old tool is already unmounted, so nothing is active now.
    err.state = createSwitchState()
    throw err
  }
  return next
}
