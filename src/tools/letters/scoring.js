import { resample, nearestDistance } from './geometry.js'

export const TRACE_TOLERANCE = 6
export const SAMPLE_SPACING = 2
export const COVERAGE_THRESHOLD = 0.85
export const STRAY_THRESHOLD = 0.5

export function guidePoints(guide) {
  return guide.flatMap((s) => resample(s, SAMPLE_SPACING))
}

export function coverage(guide, ink, tolerance) {
  const gp = guidePoints(guide)
  if (gp.length === 0 || ink.length === 0) return 0
  let hit = 0
  for (const g of gp) if (nearestDistance(g, ink) <= tolerance) hit++
  return hit / gp.length
}

export function strayRatio(guide, ink, tolerance) {
  if (ink.length === 0) return 0
  const gp = guidePoints(guide)
  let stray = 0
  for (const p of ink) if (nearestDistance(p, gp) > tolerance) stray++
  return stray / ink.length
}

export function isDone(cov, stray) {
  return cov >= COVERAGE_THRESHOLD && stray <= STRAY_THRESHOLD
}
