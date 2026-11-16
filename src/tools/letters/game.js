import { GLYPHS } from './glyphs.js'
import { emptyInk, startStroke, extendStroke, endStroke, inkPoints } from './ink.js'
import { initialHold, parentHold } from './parent-hold.js'
import { coverage, strayRatio, isDone, TRACE_TOLERANCE } from './scoring.js'
import { SEQUENCE_MODE, startIndex, nextIndex } from './modes.js'

export function nextLetter(index, list) {
  if (list.length === 0) throw new Error('letter list is empty')
  return (index + 1) % list.length
}

export function createLetterGame(mode = SEQUENCE_MODE) {
  return { index: 0, mode, ink: emptyInk(), done: false, hold: initialHold() }
}

export function currentGlyph(state, glyphs = GLYPHS) {
  return glyphs[state.index]
}

export function scoreInk(glyph, ink) {
  const pts = inkPoints(ink)
  const cov = coverage(glyph.strokes, pts, TRACE_TOLERANCE)
  const stray = strayRatio(glyph.strokes, pts, TRACE_TOLERANCE)
  return { coverage: cov, stray, done: isDone(cov, stray) }
}

export function inkEvent(state, event, glyphs = GLYPHS) {
  let ink = state.ink
  if (event.type === 'down') ink = startStroke(ink, event.pointerId, event.point)
  else if (event.type === 'move') ink = extendStroke(ink, event.pointerId, event.point)
  else if (event.type === 'up' || event.type === 'cancel') ink = endStroke(ink, event.pointerId)
  if (ink === state.ink) return state
  // Rescoring costs O(ink points). Doing it on every move made a stroke O(n^2),
  // so moves only extend the ink; the score is checked on down, up and cancel.
  if (event.type === 'move') return { ...state, ink }
  return { ...state, ink, done: state.done || scoreInk(currentGlyph(state, glyphs), ink).done }
}

export function parentEvent(state, event, now) {
  const hold = parentHold(state.hold, event, now)
  if (hold === state.hold) return state
  return { ...state, hold, done: state.done || hold.passed }
}

export function clearInk(state) {
  return { ...state, ink: emptyInk(), done: false, hold: initialHold() }
}

export function goNext(state, glyphs = GLYPHS, rng) {
  const index = state.mode ? nextIndex(state.index, state.mode, glyphs, rng) : nextLetter(state.index, glyphs)
  return { ...state, index, ink: emptyInk(), done: false, hold: initialHold() }
}

// Switch to another mode: start on its first glyph and clear the pad.
export function setMode(state, mode, glyphs = GLYPHS) {
  return { ...state, mode, index: startIndex(mode, glyphs), ink: emptyInk(), done: false, hold: initialHold() }
}

export function isLetterDone(state) {
  return state.done === true
}
