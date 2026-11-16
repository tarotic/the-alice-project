import { resample } from './geometry.js'
import { INK_COLOUR } from './views/ink.js'

export const MAX_INK_POINTS = 5000
export const INK_SPACING = 2

const finite = (p) => p != null && Number.isFinite(p.x) && Number.isFinite(p.y)

// `colours[i]` is the colour stroke i was started in. Colour is for looks only: scoring reads
// `strokes` through inkPoints, so changing colour never changes what counts as traced.
export function emptyInk() {
  return { strokes: [], colours: [], activePointerId: null, pointCount: 0 }
}

export function startStroke(ink, pointerId, point, colour = INK_COLOUR) {
  if (ink.activePointerId !== null || !finite(point) || ink.pointCount >= MAX_INK_POINTS) return ink
  return {
    strokes: [...ink.strokes, [{ x: point.x, y: point.y }]],
    colours: [...ink.colours, colour],
    activePointerId: pointerId,
    pointCount: ink.pointCount + 1,
  }
}

export function extendStroke(ink, pointerId, point) {
  if (ink.activePointerId === null || pointerId !== ink.activePointerId || !finite(point) || ink.pointCount >= MAX_INK_POINTS) return ink
  const strokes = ink.strokes.slice()
  const last = strokes.length - 1
  strokes[last] = [...strokes[last], { x: point.x, y: point.y }]
  return { strokes, colours: ink.colours, activePointerId: ink.activePointerId, pointCount: ink.pointCount + 1 }
}

export function endStroke(ink, pointerId) {
  if (ink.activePointerId === null || pointerId !== ink.activePointerId) return ink
  return { ...ink, activePointerId: null }
}

export function inkPoints(ink) {
  return ink.strokes.flatMap((s) => resample(s, INK_SPACING))
}
