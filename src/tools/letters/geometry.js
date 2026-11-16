export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function nearestDistance(p, points) {
  let best = Infinity
  for (const q of points) {
    const d = distance(p, q)
    if (d < best) best = d
  }
  return best
}

export function resample(stroke, spacing) {
  if (typeof spacing !== 'number' || !Number.isFinite(spacing) || spacing <= 0) {
    throw new Error('spacing must be a finite number greater than 0')
  }
  if (stroke.length === 0) return []
  if (stroke.length === 1) return [{ x: stroke[0].x, y: stroke[0].y }]
  const out = [{ x: stroke[0].x, y: stroke[0].y }]
  let carried = 0 // arc length already walked since the last output point
  for (let i = 1; i < stroke.length; i++) {
    const a = stroke[i - 1]
    const b = stroke[i]
    const len = distance(a, b)
    if (len === 0) continue
    let pos = spacing - carried // distance along this segment of the next output point
    while (pos <= len + 1e-12) {
      const t = Math.min(pos / len, 1)
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
      pos += spacing
    }
    carried = len - (pos - spacing)
    if (carried < 0) carried = 0
  }
  const last = stroke[stroke.length - 1]
  const prev = out[out.length - 1]
  if (prev.x !== last.x || prev.y !== last.y) out.push({ x: last.x, y: last.y })
  return out
}
