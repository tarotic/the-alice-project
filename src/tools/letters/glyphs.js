import { resample } from './geometry.js'

export const PAIRED_ORDER = 'aAbBcCdDeEfFgGhHiIjJkKlLmMnNoOpPqQrRsStTuUvVwWxXyYzZ'
export const GLYPH_POINT_SPACING = 2

// Screen y is down: 0 deg = right, 90 = bottom, 180 = left, 270 = top.
export function arc(cx, cy, rx, ry, startDeg, endDeg, steps = 24) {
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const th = ((startDeg + ((endDeg - startDeg) * i) / steps) * Math.PI) / 180
    pts.push([cx + rx * Math.cos(th), cy + ry * Math.sin(th)])
  }
  return pts
}

// A dot is a tiny zigzag (radius <= 0.8) around (cx, cy). Resample walks the path length, so
// about `segments` / 2.3 guide points (resample runs twice: glyph build, then scoring) all sit within 0.8 of the centre: one tap near the centre covers them.
export function dot(cx, cy, segments = 40) {
  const pts = []
  for (let i = 0; i <= segments; i++) pts.push([cx + (i % 2 ? 0.8 : -0.8), cy])
  return pts
}

// Quadratic Bezier, for gently curved strokes.
export function bez(p0, p1, p2, steps = 16) {
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t
    pts.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]])
  }
  return pts
}

// Sparse authored strokes as [x, y] pairs. Increment 1b only adds keys here.
export const GLYPH_SOURCE = {
  a: [[...arc(50, 65, 18, 20, 300, -60), [68, 45], [68, 85]]],
  A: [[[50, 15], [25, 85]], [[50, 15], [75, 85]], [[35, 57], [65, 57]]],
  b: [[[32, 15], [32, 85]], arc(50, 65, 18, 20, 180, 540)],
  B: [
    [[30, 15], [30, 85]],
    [[30, 15], [55, 15], ...arc(55, 32.5, 15, 17.5, 270, 450), [55, 50], [30, 50]],
    [[30, 50], [58, 50], ...arc(58, 67.5, 17, 17.5, 270, 450), [58, 85], [30, 85]],
  ],
  c: [arc(50, 65, 20, 20, 315, 45)],
  C: [arc(50, 50, 30, 35, 315, 45)],
  d: [[[68, 15], [68, 85]], arc(50, 65, 18, 20, 0, 360)],
  D: [
    [[30, 15], [30, 85]],
    [[30, 15], [50, 15], ...arc(50, 50, 35, 35, 270, 450), [30, 85]],
  ],
  e: [[[32, 65], [68, 65]], arc(50, 65, 18, 20, 0, -270)],
  E: [
    [[30, 15], [30, 85]],
    [[30, 15], [72, 15]],
    [[30, 50], [66, 50]],
    [[30, 85], [72, 85]],
  ],
  f: [[...arc(60, 25, 10, 10, 0, -180), [50, 85]], [[26, 45], [74, 45]]],
  F: [[[30, 15], [30, 85]], [[30, 15], [70, 15]], [[30, 50], [64, 50]]],
  g: [[...arc(45.5, 62, 17.5, 16.7, 0, -360, 36), [63, 80.6], ...arc(45.5, 80.6, 17.5, 14.4, 0, 165, 24)]],
  G: [[...arc(50, 50, 33, 35, 315, 0), [55, 50]]],
  h: [[[32, 15], [32, 85]], [...arc(50, 60, 18, 15, 180, 360), [68, 85]]],
  H: [[[30, 15], [30, 85]], [[70, 15], [70, 85]], [[30, 50], [70, 50]]],
  i: [[[50, 45], [50, 85]], dot(50, 25)],
  I: [[[25, 15], [75, 15]], [[50, 15], [50, 85]], [[25, 85], [75, 85]]],
  j: [[[50, 45], [50, 85], ...arc(40, 85, 10, 10, 0, 180)], dot(50, 25)],
  J: [[[35, 15], [70, 15]], [[57, 15], [57, 65], ...arc(42, 65, 15, 20, 0, 180)]],
  k: [[[34, 15], [34, 85]], [[66, 45], [34, 65]], [[46, 55], [68, 85]]],
  K: [[[30, 15], [30, 85]], [[70, 15], [32, 55]], [[42, 50], [70, 85]]],
  l: [[[50, 15], [50, 85]]],
  L: [[[30, 15], [30, 85], [75, 85]]],
  m: [
    [[18, 45], [18, 85]],
    [...arc(34, 60, 16, 15, 180, 360), [50, 85]],
    [...arc(66, 60, 16, 15, 180, 360), [82, 85]],
  ],
  M: [[[20, 85], [20, 15], [50, 60], [80, 15], [80, 85]]],
  n: [[[32, 45], [32, 85]], [...arc(50, 60, 18, 15, 180, 360), [68, 85]]],
  N: [[[30, 85], [30, 15], [70, 85], [70, 15]]],
  o: [arc(50, 65, 20, 20, 270, -90)],
  O: [arc(50, 50, 30, 35, 270, -90)],
  p: [[[32, 45], [32, 95]], arc(50, 65, 18, 20, 180, 540)],
  P: [[[30, 85], [30, 15], [55, 15], ...arc(55, 32.5, 15, 17.5, 270, 450), [30, 50]]],
  q: [[[68, 45], [68, 95]], arc(50, 65, 18, 20, 0, 360)],
  Q: [[...arc(50, 50, 30, 35, 45, -315), [84, 95]]],
  r: [[[36, 45], [36, 85]], arc(54, 60, 18, 15, 180, 270, 12)],
  R: [
    [[30, 15], [30, 85]],
    [[30, 15], [55, 15], ...arc(55, 32.5, 15, 17.5, 270, 450), [30, 50]],
    [[45, 50], [70, 85]],
  ],
  s: [[...arc(50, 55, 15, 10, 330, 180), ...arc(50, 75, 15, 10, 0, 180)]],
  S: [[...arc(50, 32.5, 17, 17.5, 330, 180), ...arc(50, 67.5, 17, 17.5, 0, 180)]],
  t: [[[50, 20], [50, 85]], [[30, 45], [70, 45]]],
  T: [[[20, 15], [80, 15]], [[50, 15], [50, 85]]],
  u: [[[32, 45], [32, 65], ...arc(50, 65, 18, 20, 180, 0), [68, 45]]],
  U: [[[30, 15], [30, 65], ...arc(50, 65, 20, 20, 180, 0)], [[70, 15], [70, 65]]],
  v: [[[22, 45], [50, 85], [78, 45]]],
  V: [[[20, 15], [50, 85], [80, 15]]],
  w: [[[16, 45], [32, 85], [50, 50], [68, 85], [84, 45]]],
  W: [[[15, 15], [31, 85], [50, 45], [69, 85], [85, 15]]],
  x: [[[25, 45], [75, 85]], [[75, 45], [25, 85]]],
  X: [[[25, 15], [75, 85]], [[75, 15], [25, 85]]],
  y: [[[22, 45], [58, 75]], bez([78, 45], [62, 80], [30, 95])],
  Y: [[[20, 15], [50, 50]], [[80, 15], [50, 50]], [[50, 50], [50, 85]]],
  z: [[[25, 45], [75, 45], [25, 85], [75, 85]]],
  Z: [[[20, 15], [80, 15], [20, 85], [80, 85]]],
}

function deepFreeze(o) {
  for (const v of Object.values(o)) if (v !== null && typeof v === 'object') deepFreeze(v)
  return Object.freeze(o)
}

const toPoints = (stroke) => stroke.map(([x, y]) => ({ x, y }))

// Lowercase sources are authored tall: ascenders at y=15, baseline at y=85. That sits the bowls
// low in the box. Squash them so the baseline is at y=68 and the x-height body centres on the
// middle line, with descenders hanging below it.
const LOWER_BAND = { top: 15, base: 85, newTop: 8, newBase: 68 }
const lowerY = (y) => LOWER_BAND.newTop + ((y - LOWER_BAND.top) * (LOWER_BAND.newBase - LOWER_BAND.newTop)) / (LOWER_BAND.base - LOWER_BAND.top)

const placed = (id, stroke) => {
  const pts = toPoints(stroke)
  return id === id.toLowerCase() ? pts.map((p) => ({ x: p.x, y: lowerY(p.y) })) : pts
}

export const GLYPHS = deepFreeze(
  [...PAIRED_ORDER]
    .filter((id) => id in GLYPH_SOURCE)
    .map((id) => ({
      id,
      case: id === id.toLowerCase() ? 'lowercase' : 'uppercase',
      strokes: GLYPH_SOURCE[id].map((s) => resample(placed(id, s), GLYPH_POINT_SPACING)),
    })),
)

export function getGlyph(id) {
  return GLYPHS.find((g) => g.id === id)
}
