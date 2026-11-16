export const INK_COLOUR = '#FDD835'

export function drawInk(ctx, ink, sizePx) {
  const k = sizePx / 100
  ctx.save()
  ctx.strokeStyle = INK_COLOUR
  ctx.fillStyle = INK_COLOUR
  ctx.lineWidth = 5 * k
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const s of ink.strokes) {
    if (s.length === 1) {
      ctx.beginPath()
      ctx.arc(s[0].x * k, s[0].y * k, 2.5 * k, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    ctx.beginPath()
    s.forEach((p, i) => (i ? ctx.lineTo(p.x * k, p.y * k) : ctx.moveTo(p.x * k, p.y * k)))
    ctx.stroke()
  }
  ctx.restore()
}
