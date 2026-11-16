import { resample } from './geometry.js'

export const MAX_INK_POINTS = 5000
export const INK_SPACING = 2

const finite = (p) => p != null && Number.isFinite(p.x) && Number.isFinite(p.y)

export function emptyInk() {
  return { strokes: [], activePointerId: null, pointCount: 0 }
}

export function startStroke(ink, pointerId, point) {
  if (ink.activePointerId !== null || !finite(point) || ink.pointCount >= MAX_INK_POINTS) return ink
  return {
    strokes: [...ink.strokes, [{ x: point.x, y: point.y }]],
    activePointerId: pointerId,
    pointCount: ink.pointCount + 1,
  }
}

export function extendStroke(ink, pointerId, point) {
  if (ink.activePointerId === null || pointerId !== ink.activePointerId || !finite(point) || ink.pointCount >= MAX_INK_POINTS) return ink
  const strokes = ink.strokes.slice()
  const last = strokes.length - 1
  strokes[last] = [...strokes[last], { x: point.x, y: point.y }]
  return { strokes, activePointerId: ink.activePointerId, pointCount: ink.pointCount + 1 }
}

export function endStroke(ink, pointerId) {
  if (ink.activePointerId === null || pointerId !== ink.activePointerId) return ink
  return { ...ink, activePointerId: null }
}

export function inkPoints(ink) {
  return ink.strokes.flatMap((s) => resample(s, INK_SPACING))
}
