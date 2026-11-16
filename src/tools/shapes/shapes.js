import { resample } from '../letters/geometry.js'
import { arc } from '../letters/glyphs.js'
export { TRACE_TOLERANCE, COVERAGE_THRESHOLD, STRAY_THRESHOLD } from '../letters/scoring.js'
export { PARENT_HOLD_MS } from '../letters/parent-hold.js'

export const SHAPE_ORDER = ['circle', 'square', 'triangle', 'rectangle', 'oval', 'star']
export const SHAPE_POINT_SPACING = 2

export function closedPolygon(vertices) {
  return [...vertices.map((v) => [...v]), [...vertices[0]]]
}

export function starVertices(cx, cy, outerR, innerR) {
  const out = []
  for (let i = 0; i < 10; i++) {
    const rad = ((-90 - 36 * i) * Math.PI) / 180
    const r = i % 2 === 0 ? outerR : innerR
    out.push([cx + r * Math.cos(rad), cy + r * Math.sin(rad)])
  }
  return out
}

export const SHAPE_SOURCE = {
  circle: [arc(50, 50, 40, 40, 270, -90, 48)],
  square: [closedPolygon([[22, 22], [22, 78], [78, 78], [78, 22]])],
  triangle: [closedPolygon([[50, 15], [15, 85], [85, 85]])],
  rectangle: [closedPolygon([[10, 30], [10, 70], [90, 70], [90, 30]])],
  oval: [arc(50, 50, 24, 40, 270, -90, 48)],
  star: [closedPolygon(starVertices(50, 52, 40, 16))],
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
