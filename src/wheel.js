// Pure logic for the minutes and seconds wheels. No DOM here, so it is testable in node.
export const WHEEL_ITEM_PX = 48;
export const WHEEL_MINUTES_MAX = 99;
export const WHEEL_SECONDS_MAX = 59;

export function clampIndex(index, max) {
  if (!Number.isFinite(index)) return 0;
  return Math.min(max, Math.max(0, index));
}

// The wheel rests with item `index` centred when its scroll offset is index * item height.
export function indexFromOffset(offset, max, itemPx = WHEEL_ITEM_PX) {
  return clampIndex(Math.round(offset / itemPx), max);
}

export function offsetFromIndex(index, itemPx = WHEEL_ITEM_PX) {
  return index * itemPx;
}

export function stepIndex(index, delta, max) {
  return clampIndex(index + delta, max);
}

// Arrow keys step by 1, Page keys by 10. Anything else does nothing.
export function keyDelta(key) {
  switch (key) {
    case 'ArrowUp': return -1;
    case 'ArrowDown': return 1;
    case 'PageUp': return -10;
    case 'PageDown': return 10;
    default: return 0;
  }
}

export function wheelValues(max) {
  return Array.from({ length: max + 1 }, (_, i) => i);
}

export function positionsFromSeconds(totalSeconds) {
  return { minutes: Math.floor(totalSeconds / 60), seconds: totalSeconds % 60 };
}

// `matchMediaFn` is window.matchMedia or a stub. Reduced motion means jump, not glide.
export function scrollBehaviour(matchMediaFn) {
  return matchMediaFn('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
}
