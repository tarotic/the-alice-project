// Letter modes decide which glyph comes next. Pure functions, no DOM.
//   { kind: 'sequence' }          A to Z in paired order (a, A, b, B, ...), wraps from Z to a.
//   { kind: 'pick', letter }      Only the two glyphs for one letter (lower then upper), wraps.
//   { kind: 'random' }            Any glyph, never the same one twice in a row.

export const SEQUENCE_MODE = Object.freeze({ kind: 'sequence' })

export const MODE_OPTIONS = Object.freeze([
  { kind: 'sequence', label: 'A to Z' },
  { kind: 'pick', label: 'Pick a letter' },
  { kind: 'random', label: 'Random' },
])

export const PICK_LETTERS = Object.freeze('abcdefghijklmnopqrstuvwxyz'.split(''))

const letterOf = (glyph) => glyph.id.toLowerCase()

// Indices into `glyphs` that the mode can show, in the order they are shown.
export function modeIndices(mode, glyphs) {
  const all = glyphs.map((_, i) => i)
  if (mode.kind !== 'pick') return all
  return all.filter((i) => letterOf(glyphs[i]) === mode.letter)
}

// The first glyph shown when a mode is chosen.
export function startIndex(mode, glyphs) {
  if (glyphs.length === 0) throw new Error('letter list is empty')
  const list = modeIndices(mode, glyphs)
  return list.length ? list[0] : 0
}

// The glyph after `index` under `mode`. `rng` returns a number in [0, 1).
export function nextIndex(index, mode, glyphs, rng = Math.random) {
  if (glyphs.length === 0) throw new Error('letter list is empty')
  if (mode.kind === 'random') {
    if (glyphs.length === 1) return 0
    // Draw from the other glyphs only: [0, n-2], shifted past `index`. One draw, no retry loop.
    let j = Math.floor(rng() * (glyphs.length - 1))
    if (j >= index) j += 1
    return j
  }
  const list = modeIndices(mode, glyphs)
  const pos = list.indexOf(index)
  return list[(pos + 1) % list.length]
}
