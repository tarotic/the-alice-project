// The default ink colour: yellow, the first look the letters and shapes tools had.
// Each stroke is drawn in the colour it was started in (see ink.colours).
export const INK_COLOUR = '#FDD835'

export function drawInk(ctx, ink, sizePx) {
  const k = sizePx / 100
  ctx.save()
  ctx.lineWidth = 5 * k
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ink.strokes.forEach((s, i) => {
    const colour = (ink.colours && ink.colours[i]) || INK_COLOUR
    ctx.strokeStyle = colour
    ctx.fillStyle = colour
    if (s.length === 1) {
      ctx.beginPath()
      ctx.arc(s[0].x * k, s[0].y * k, 2.5 * k, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    ctx.beginPath()
    s.forEach((p, j) => (j ? ctx.lineTo(p.x * k, p.y * k) : ctx.moveTo(p.x * k, p.y * k)))
    ctx.stroke()
  })
  ctx.restore()
}
