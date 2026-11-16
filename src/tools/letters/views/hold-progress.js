export function holdProgressWidth(progress) {
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0
  return `${Math.round(p * 100)}%`
}
