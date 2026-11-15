export const RING_RADIUS = 54;
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function getRingArc(progress) {
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const drawnLength = RING_CIRCUMFERENCE * p;
  return {
    circumference: RING_CIRCUMFERENCE,
    drawnLength,
    dashArray: `${drawnLength} ${RING_CIRCUMFERENCE}`,
  };
}
