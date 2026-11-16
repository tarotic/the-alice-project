export const GUIDE_COLOUR = 'rgba(255,255,255,0.28)'

export function drawGuide(ctx, glyph, sizePx) {
  const k = sizePx / 100
  ctx.save()
  ctx.strokeStyle = GUIDE_COLOUR
  ctx.lineWidth = 12 * k
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const s of glyph.strokes) {
    ctx.beginPath()
    s.forEach((p, i) => (i ? ctx.lineTo(p.x * k, p.y * k) : ctx.moveTo(p.x * k, p.y * k)))
    ctx.stroke()
  }
  ctx.restore()
}
