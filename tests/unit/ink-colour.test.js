import test from 'node:test'
import assert from 'node:assert/strict'
import { installFakeDom } from './fake-dom.js'

const dom = installFakeDom()
import { emptyInk, startStroke, extendStroke, endStroke, inkPoints } from '../../src/tools/letters/ink.js'
import { inkEvent, scoreInk, clearInk, createLetterGame } from '../../src/tools/letters/game.js'
import { drawInk, INK_COLOUR } from '../../src/tools/letters/views/ink.js'
import { RING_COLOURS } from '../../src/colours.js'
import { GLYPHS } from '../../src/tools/letters/glyphs.js'
import { PICTURES } from '../../src/tools/complex/pictures.js'
import { resample } from '../../src/tools/letters/geometry.js'
import { lettersTool } from '../../src/tools/letters/tool.js'

const P = (x, y) => ({ x, y })
const RED = '#D32F2F'
const BLUE = '#0072B2'

test('the default ink is one of the picker colours, so the first look is unchanged', () => {
  assert.equal(INK_COLOUR, '#FDD835')
  assert.ok(RING_COLOURS.some((c) => c.hex === INK_COLOUR))
  assert.equal(RING_COLOURS.length, 10)
})

test('each stroke remembers the colour it was started in; extend and end keep it', () => {
  let ink = emptyInk()
  assert.deepEqual(ink.colours, [])
  ink = startStroke(ink, 1, P(0, 0), RED)
  ink = extendStroke(ink, 1, P(5, 5))
  ink = endStroke(ink, 1)
  ink = startStroke(ink, 2, P(9, 9), BLUE)
  ink = endStroke(ink, 2)
  assert.equal(ink.strokes.length, 2)
  assert.deepEqual(ink.colours, [RED, BLUE])
})

test('a stroke started without a colour uses the default ink', () => {
  const ink = startStroke(emptyInk(), 1, P(0, 0))
  assert.deepEqual(ink.colours, [INK_COLOUR])
})

test('a colour passed on a move does not recolour the stroke in progress', () => {
  let s = createLetterGame()
  s = inkEvent(s, { type: 'down', pointerId: 1, point: P(10, 10), colour: RED }, GLYPHS)
  s = inkEvent(s, { type: 'move', pointerId: 1, point: P(20, 20), colour: BLUE }, GLYPHS)
  s = inkEvent(s, { type: 'up', pointerId: 1, point: P(20, 20), colour: BLUE }, GLYPHS)
  assert.deepEqual(s.ink.colours, [RED])
})

test('clear removes the strokes and their colours', () => {
  let s = createLetterGame()
  s = inkEvent(s, { type: 'down', pointerId: 1, point: P(10, 10), colour: RED }, GLYPHS)
  s = clearInk(s)
  assert.deepEqual(s.ink.colours, [])
})

test('colour never changes what is traced: the same strokes in mixed colours score the same as in yellow', () => {
  const picture = PICTURES.find((p) => p.id === 'cat')
  const strokes = picture.strokes.map((st) => resample(st, 2))
  const play = (colours) => {
    let ink = emptyInk()
    strokes.forEach((st, i) => {
      const c = colours[i % colours.length]
      st.forEach((p, j) => {
        ink = j === 0 ? startStroke(ink, 1, p, c) : extendStroke(ink, 1, p)
      })
      ink = endStroke(ink, 1)
    })
    return ink
  }
  const yellow = play([INK_COLOUR])
  const mixed = play([RED, BLUE, '#00897B'])
  assert.deepEqual(inkPoints(mixed), inkPoints(yellow))
  assert.deepEqual(scoreInk({ strokes: picture.strokes }, mixed), scoreInk({ strokes: picture.strokes }, yellow))
  assert.equal(scoreInk({ strokes: picture.strokes }, mixed).done, true)
})

test('a colour change mid-picture leaves the game state, ink points and hold untouched', () => {
  let s = createLetterGame()
  s = inkEvent(s, { type: 'down', pointerId: 1, point: P(10, 10), colour: RED }, GLYPHS)
  const before = { points: inkPoints(s.ink), done: s.done, hold: s.hold, index: s.index }
  // The colour is only read when a stroke starts, so the picker tapped mid-stroke changes nothing here.
  s = inkEvent(s, { type: 'up', pointerId: 1, point: P(10, 10), colour: BLUE }, GLYPHS)
  assert.deepEqual(inkPoints(s.ink), before.points)
  assert.equal(s.done, before.done)
  assert.deepEqual(s.hold, before.hold)
  assert.equal(s.index, before.index)
})

test('drawInk paints each stroke in its own colour', () => {
  const calls = []
  const ctx = {
    strokeStyle: null, fillStyle: null,
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, fill() {},
    stroke() { calls.push(this.strokeStyle) },
  }
  let ink = startStroke(emptyInk(), 1, P(0, 0), RED)
  ink = extendStroke(ink, 1, P(10, 0))
  ink = endStroke(ink, 1)
  ink = startStroke(ink, 2, P(0, 10), BLUE)
  ink = extendStroke(ink, 2, P(10, 10))
  drawInk(ctx, ink, 100)
  assert.deepEqual(calls, [RED, BLUE])
})

test('drawInk falls back to the default ink for ink with no colours recorded', () => {
  const calls = []
  const ctx = { save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, fill() {}, stroke() { calls.push(this.strokeStyle) } }
  drawInk(ctx, { strokes: [[P(0, 0), P(5, 5)]], colours: [], activePointerId: null, pointCount: 2 }, 100)
  assert.deepEqual(calls, [INK_COLOUR])
})

test('the colour button opens a modal; picking a swatch sets the next stroke colour and closes it', () => {
  const dom = installFakeDom()
  const host = dom.makeHost()
  lettersTool.mount(host)
  const colourBtn = dom.find(host, (e) => e.className === 'ink-colour-btn')
  const modal = dom.find(host, (e) => e.className === 'ink-modal')
  assert.ok(colourBtn && modal, 'colour button and modal present')
  assert.equal(modal.hidden, true, 'modal starts closed')
  const pad = dom.find(host, (e) => e.className === 'pad')
  const grid = dom.find(modal, (e) => e.className === 'ink-colours')
  assert.equal(grid.children.length, RING_COLOURS.length)
  const swatch = (hex) => grid.children[RING_COLOURS.findIndex((c) => c.hex === hex)]
  const toPx = (p) => ({ clientX: p.x * 4, clientY: p.y * 4 })

  pad.fire('pointerdown', { ...toPx(P(10, 10)), pointerId: 1 })
  colourBtn.fire('click')
  assert.equal(modal.hidden, false, 'tapping the colour button opens the modal')
  swatch(RED).fire('click')
  assert.equal(modal.hidden, true, 'picking a swatch closes the modal')
  assert.equal(colourBtn.style.background, RED, 'button shows the new colour')
  pad.fire('pointermove', { ...toPx(P(30, 30)), pointerId: 1 })
  pad.fire('pointerup', { pointerId: 1 })
  colourBtn.fire('click')
  swatch(BLUE).fire('click')
  pad.fire('pointerdown', { ...toPx(P(50, 50)), pointerId: 2 })
  pad.fire('pointerup', { pointerId: 2 })

  const s = lettersTool.getState()
  assert.deepEqual(s.ink.colours, [INK_COLOUR, BLUE])
  assert.equal(s.ink.strokes.length, 2)

  colourBtn.fire('click')
  modal.fire('keydown', { key: 'Escape' })
  assert.equal(modal.hidden, true, 'Escape closes the modal')
  colourBtn.fire('click')
  modal.fire('click', { target: modal })
  assert.equal(modal.hidden, true, 'a tap on the backdrop closes the modal')
  lettersTool.unmount()
  assert.equal(dom.liveListeners(), 0, 'no listeners left after unmount')
  dom.flushRaf()
})
