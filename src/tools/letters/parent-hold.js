export const PARENT_HOLD_MS = 1000

export function initialHold() {
  return { pointerId: null, startedAt: null, passed: false }
}

const isIdle = (s) => s.startedAt === null
const passedState = () => ({ pointerId: null, startedAt: null, passed: true })
const elapsed = (s, now) => Math.max(0, now - s.startedAt)

export function parentHold(state, event, now) {
  if (state.passed) return state
  const { type, pointerId } = event
  if (type === 'down') {
    if (!isIdle(state)) return state
    return { pointerId, startedAt: now, passed: false }
  }
  if (isIdle(state)) return state
  if (type === 'tick') return elapsed(state, now) >= PARENT_HOLD_MS ? passedState() : state
  if (pointerId !== state.pointerId) return state
  if (type === 'up') return elapsed(state, now) >= PARENT_HOLD_MS ? passedState() : initialHold()
  if (type === 'leave' || type === 'cancel') return initialHold()
  return state
}

// True when the point is inside the rectangle (edges count as inside). Pure, so it needs no DOM.
export function insideRect(rect, x, y) {
  const right = rect.right ?? rect.left + rect.width
  const bottom = rect.bottom ?? rect.top + rect.height
  return x >= rect.left && x <= right && y >= rect.top && y <= bottom
}

export function holdProgress(state, now) {
  if (state.passed) return 1
  if (state.startedAt === null) return 0
  return Math.min(1, Math.max(0, (now - state.startedAt) / PARENT_HOLD_MS))
}
