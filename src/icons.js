// Tab icons: simple line drawings in a 24 by 24 box, coloured by the button's text colour.
// Each is plain inline SVG markup, with no external references.
const svg = (body) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`

export const TOOL_ICONS = Object.freeze({
  timer: svg('<circle cx="12" cy="13" r="8"/><path d="M12 13V9M9 2h6"/>'),
  letters: svg('<path d="M4 20L12 4L20 20M7.5 14h9"/>'),
  shapes: svg('<path d="M12 4L21 20H3Z"/>'),
  complex: svg('<path d="M3 11L12 4L21 11"/><path d="M5 10v10h14V10M10 20v-5h4v5"/>'),
})

export function toolIcon(id) {
  return TOOL_ICONS[id] ?? ''
}
