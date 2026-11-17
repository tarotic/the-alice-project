import { resample } from '../letters/geometry.js'
import { arc, bez, dot } from '../letters/glyphs.js'
export { TRACE_TOLERANCE, COVERAGE_THRESHOLD, STRAY_THRESHOLD } from '../letters/scoring.js'
export { PARENT_HOLD_MS } from '../letters/parent-hold.js'

// Complex shapes: simple pictures made from several shapes and lines together. Each picture is a
// list of strokes in the same 0..100 box as letters and shapes. Scoring is the same as letters:
// the child must cover most of all the strokes, and must not scribble far from them.
export const PICTURE_ORDER = ['rocket ship', 'cat', 'dog', 'flower', 'bus', 'star', 'house']
export const PICTURE_POINT_SPACING = 2

const closed = (pts) => [...pts, pts[0]]

// Star with sparkle rays. The rays sit between the star's points so they do not touch the star.
function sparkleRays(cx, cy, inner, outer) {
  return [-54, 18, 90, 162, 234].map((deg) => {
    const rad = (deg * Math.PI) / 180
    return [[cx + inner * Math.cos(rad), cy + inner * Math.sin(rad)], [cx + outer * Math.cos(rad), cy + outer * Math.sin(rad)]]
  })
}

function starOutline(cx, cy, outerR, innerR) {
  const pts = []
  for (let i = 0; i < 10; i++) {
    const rad = ((-90 + 36 * i) * Math.PI) / 180
    const r = i % 2 === 0 ? outerR : innerR
    pts.push([cx + r * Math.cos(rad), cy + r * Math.sin(rad)])
  }
  return closed(pts)
}

export const PICTURE_SOURCE = {
  // Body with a rounded nose, a porthole, two fins and a flame.
  'rocket ship': [
    [[40, 70], [40, 35], ...arc(50, 35, 10, 10, 180, 360, 16), [60, 70], [40, 70]],
    arc(50, 50, 5, 5, 0, 360, 20),
    closed([[40, 52], [28, 70], [40, 70]]),
    closed([[60, 52], [72, 70], [60, 70]]),
    [[42, 70], [46, 88], [50, 78], [54, 88], [58, 70]],
  ],
  // Round face, pointed ears, two eye dots, a nose, and whiskers.
  cat: [
    arc(50, 56, 30, 30, 0, 360, 48),
    closed([[24, 40], [26, 14], [44, 28]]),
    closed([[76, 40], [74, 14], [56, 28]]),
    dot(41, 50),
    dot(59, 50),
    closed([[47, 62], [53, 62], [50, 66]]),
    [[22, 60], [6, 56]],
    [[22, 68], [6, 72]],
    [[78, 60], [94, 56]],
    [[78, 68], [94, 72]],
  ],
  // Round face with floppy ears hanging at the sides, eyes, a nose, a mouth and a tongue.
  dog: [
    arc(50, 50, 28, 28, 0, 360, 44),
    arc(18, 48, 8, 18, 0, 360, 32),
    arc(82, 48, 8, 18, 0, 360, 32),
    dot(40, 42),
    dot(60, 42),
    arc(50, 55, 5, 4, 0, 360, 20),
    [[43, 64], [50, 68], [57, 64]],
    arc(50, 68, 4, 5, 0, 180, 12),
  ],
  // Five petals around a centre, a stem and one leaf.
  flower: [
    arc(50, 36, 9, 9, 0, 360, 20),
    arc(50, 20, 8, 8, 0, 360, 20),
    arc(65.2, 31.1, 8, 8, 0, 360, 20),
    arc(59.4, 48.9, 8, 8, 0, 360, 20),
    arc(40.6, 48.9, 8, 8, 0, 360, 20),
    arc(34.8, 31.1, 8, 8, 0, 360, 20),
    [...bez([50, 45], [56, 62], [58, 92])],
    [...bez([50, 70], [70, 70], [68, 58]), ...bez([68, 58], [56, 60], [50, 70])],
  ],
  // Side view: a long body with three windows and two wheels.
  bus: [
    closed([[12, 30], [12, 70], [88, 70], [88, 30]]),
    closed([[19, 36], [19, 50], [34, 50], [34, 36]]),
    closed([[42, 36], [42, 50], [57, 50], [57, 36]]),
    closed([[65, 36], [65, 50], [80, 50], [80, 36]]),
    arc(28, 72, 7, 7, 0, 360, 20),
    arc(72, 72, 7, 7, 0, 360, 20),
  ],
  // A five-point star with short sparkle lines around it.
  star: [starOutline(50, 50, 26, 11), ...sparkleRays(50, 50, 34, 44)],
  // A roof on a box with a door and a chimney.
  house: [
    closed([[18, 48], [50, 16], [82, 48]]),
    closed([[26, 48], [26, 86], [74, 86], [74, 48]]),
    closed([[44, 86], [44, 64], [56, 64], [56, 86]]),
    [[64, 36], [64, 20], [74, 20], [74, 42]],
  ],
}

function deepFreeze(o) {
  for (const v of Object.values(o)) if (v !== null && typeof v === 'object') deepFreeze(v)
  return Object.freeze(o)
}

const toPoints = (stroke) => stroke.map(([x, y]) => ({ x, y }))

export const PICTURES = deepFreeze(
  PICTURE_ORDER.map((id) => ({
    id,
    strokes: PICTURE_SOURCE[id].map((s) => resample(toPoints(s), PICTURE_POINT_SPACING)),
  })),
)

export function getPicture(id) {
  return PICTURES.find((p) => p.id === id)
}

export function pictureLabel(picture) {
  return picture.id
}
