import { resample } from '../letters/geometry.js'
import { arc } from '../letters/glyphs.js'
export { TRACE_TOLERANCE, COVERAGE_THRESHOLD, STRAY_THRESHOLD } from '../letters/scoring.js'
export { PARENT_HOLD_MS } from '../letters/parent-hold.js'

export const SHAPE_ORDER = ['circle', 'square', 'triangle', 'rectangle', 'oval', 'star']
export const SHAPE_POINT_SPACING = 2

export function closedPolygon(vertices) {
  return [...vertices.map((v) => [...v]), [...vertices[0]]]
}

// A star drawn the way a person draws it: one stroke that makes five long diagonals, so the
// lines criss-cross. Start at the top point, go to the bottom-right point, then up to the
// upper-left point, across to the upper-right point, down to the bottom-left point, and back up.
// The five outer points sit at -90 + 72k degrees; the order 0, 2, 4, 1, 3 gives the crossing path.
const STAR_DRAW_ORDER = [0, 2, 4, 1, 3]

export function starVertices(cx, cy, outerR) {
  const points = []
  for (let k = 0; k < 5; k++) {
    const rad = ((-90 + 72 * k) * Math.PI) / 180
    points.push([cx + outerR * Math.cos(rad), cy + outerR * Math.sin(rad)])
  }
  return STAR_DRAW_ORDER.map((i) => points[i])
}

export const SHAPE_SOURCE = {
  circle: [arc(50, 50, 40, 40, 270, -90, 48)],
  square: [closedPolygon([[22, 22], [22, 78], [78, 78], [78, 22]])],
  triangle: [closedPolygon([[50, 15], [15, 85], [85, 85]])],
  rectangle: [closedPolygon([[10, 30], [10, 70], [90, 70], [90, 30]])],
  oval: [arc(50, 50, 24, 40, 270, -90, 48)],
  star: [closedPolygon(starVertices(50, 52, 40))],
}

function deepFreeze(o) {
  for (const v of Object.values(o)) if (v !== null && typeof v === 'object') deepFreeze(v)
  return Object.freeze(o)
}

const toPoints = (stroke) => stroke.map(([x, y]) => ({ x, y }))

export const SHAPES = deepFreeze(
  SHAPE_ORDER.map((id) => ({
    id,
    strokes: SHAPE_SOURCE[id].map((s) => resample(toPoints(s), SHAPE_POINT_SPACING)),
  })),
)

export function getShape(id) {
  return SHAPES.find((s) => s.id === id)
}

export function shapeLabel(shape) {
  return shape.id
}
