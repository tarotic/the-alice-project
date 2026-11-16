export function rewardView(done) {
  return { visible: done, text: done ? 'Well done!' : '' }
}

export function drawRewardShape(ctx, sizePx) {
  const c = sizePx / 2
  const R = sizePx * 0.45
  const r = R * 0.4
  ctx.save()
  ctx.fillStyle = '#f5b800'
  ctx.strokeStyle = '#a77b00'
  ctx.lineWidth = Math.max(1, sizePx / 24)
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const x = c + rad * Math.cos(a)
    const y = c + rad * Math.sin(a)
    if (i) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}
