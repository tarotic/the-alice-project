import { GLYPHS } from './glyphs.js'
import { createLetterGame, currentGlyph, inkEvent, parentEvent, clearInk, goNext, setMode, isLetterDone } from './game.js'
import { MODE_OPTIONS, PICK_LETTERS } from './modes.js'
import { holdProgress, insideRect } from './parent-hold.js'
import { drawGuide } from './views/guide.js'
import { drawInk, INK_COLOUR } from './views/ink.js'
import { holdProgressWidth } from './views/hold-progress.js'
import { rewardView, drawRewardShape } from './views/reward.js'
import { RING_COLOURS } from '../../colours.js'

export function toGlyphSpace(clientX, clientY, rect) {
  if (!(rect.width > 0) || !(rect.height > 0)) return null
  return { x: ((clientX - rect.left) / rect.width) * 100, y: ((clientY - rect.top) / rect.height) * 100 }
}

// The ink colour picked on any drawing tool. Kept at module level, like the timer's ring colour,
// so it survives switching tools. It only sets the colour of the next stroke: lines already drawn
// keep their colour, and no colour change touches the ink, the score or the parent hold.
let inkColour = INK_COLOUR

export function createTraceTool({ id, label, items, labelText, withModes = false }) {
  let controller = null
  let rafId = 0
  let holdRafId = 0
  let mountedHost = null
  let state = null

  return {
    id,
    label,
    mount(host) {
      mountedHost = host
      controller = new AbortController()
      const signal = controller.signal
      state = createLetterGame()

      const mk = (tag, cls, text) => {
        const e = document.createElement(tag)
        if (cls) e.className = cls
        if (text) e.textContent = text
        return e
      }
      const labelEl = mk('div', 'letter-label')
      const pad = mk('canvas', 'pad')
      let modeSel = null
      let letterSel = null
      const head = []
      if (withModes) {
        const modeRow = mk('div', 'mode-row')
        modeSel = mk('select', 'mode-select')
        modeSel.setAttribute('aria-label', 'Mode')
        for (const o of MODE_OPTIONS) {
          const opt = mk('option', '', o.label)
          opt.value = o.kind
          modeSel.append(opt)
        }
        letterSel = mk('select', 'letter-select')
        letterSel.setAttribute('aria-label', 'Letter')
        for (const l of PICK_LETTERS) {
          const opt = mk('option', '', l.toUpperCase())
          opt.value = l
          letterSel.append(opt)
        }
        modeRow.append(modeSel, letterSel)
        head.push(modeRow)
      }
      const colourRow = mk('div', 'ink-colours')
      colourRow.setAttribute('role', 'group')
      colourRow.setAttribute('aria-label', 'Ink colour')
      const swatches = RING_COLOURS.map((c) => {
        const b = mk('button', 'swatch')
        b.type = 'button'
        b.setAttribute('aria-label', c.name)
        b.style.background = c.hex
        colourRow.append(b)
        return { el: b, hex: c.hex }
      })
      const showInkColour = () => {
        for (const sw of swatches) sw.el.setAttribute('aria-pressed', String(sw.hex === inkColour))
      }
      showInkColour()
      const clearBtn = mk('button', '', 'Clear')
      const nextBtn = mk('button', '', 'Next')
      clearBtn.type = nextBtn.type = 'button'
      const actions = mk('div', 'actions')
      actions.append(clearBtn, nextBtn)
      const reward = mk('div', 'reward')
      const rewardText = mk('span')
      const star = mk('canvas', 'reward-star')
      reward.append(star, rewardText)
      const parentBtn = mk('button', 'parent')
      parentBtn.type = 'button'
      const fill = mk('span', 'parent-fill')
      parentBtn.append(fill, mk('span', 'parent-text', 'Parent: got it'))
      host.replaceChildren(...head, labelEl, pad, colourRow, actions, reward, parentBtn)

      const ctx = pad.getContext('2d')

      function sizeCanvas() {
        const dpr = window.devicePixelRatio || 1
        const px = Math.max(1, Math.round(pad.clientWidth * dpr))
        pad.width = px
        pad.height = px
        star.width = star.height = Math.round(48 * dpr)
        const sctx = star.getContext('2d')
        sctx.clearRect(0, 0, star.width, star.height)
        drawRewardShape(sctx, star.width)
      }

      function render() {
        rafId = 0
        const size = pad.width
        ctx.clearRect(0, 0, size, size)
        const g = currentGlyph(state, items)
        drawGuide(ctx, g, size)
        drawInk(ctx, state.ink, size)
        labelEl.textContent = labelText(g)
        if (modeSel) {
          modeSel.value = state.mode.kind
          letterSel.hidden = state.mode.kind !== 'pick'
          if (state.mode.kind === 'pick') letterSel.value = state.mode.letter
        }
        const done = isLetterDone(state)
        const rv = rewardView(done)
        reward.style.visibility = rv.visible ? 'visible' : 'hidden'
        rewardText.textContent = rv.text
        nextBtn.disabled = !done
        fill.style.width = holdProgressWidth(holdProgress(state.hold, performance.now()))
      }
      function schedule() {
        if (!rafId) rafId = requestAnimationFrame(render)
      }

      const point = (e) => toGlyphSpace(e.clientX, e.clientY, pad.getBoundingClientRect())
      const padEvent = (type) => (e) => {
        const p = point(e)
        if (p === null) return
        if (type === 'down') pad.setPointerCapture(e.pointerId)
        state = inkEvent(state, { type, pointerId: e.pointerId, point: p, colour: inkColour }, items)
        schedule()
      }
      pad.addEventListener('pointerdown', padEvent('down'), { signal })
      pad.addEventListener('pointermove', padEvent('move'), { signal })
      pad.addEventListener('pointerup', padEvent('up'), { signal })
      pad.addEventListener('pointercancel', padEvent('cancel'), { signal })

      if (modeSel) {
        modeSel.addEventListener('change', () => {
          const kind = modeSel.value
          const mode = kind === 'pick' ? { kind, letter: letterSel.value } : { kind }
          state = setMode(state, mode, items)
          schedule()
        }, { signal })
        letterSel.addEventListener('change', () => {
          state = setMode(state, { kind: 'pick', letter: letterSel.value }, items)
          schedule()
        }, { signal })
      }

      for (const sw of swatches) {
        sw.el.addEventListener('click', () => { inkColour = sw.hex; showInkColour() }, { signal })
      }

      clearBtn.addEventListener('click', () => { state = clearInk(state); schedule() }, { signal })
      nextBtn.addEventListener('click', () => { if (isLetterDone(state)) { state = goNext(state, items); schedule() } }, { signal })

      function holdLoop() {
        holdRafId = 0
        state = parentEvent(state, { type: 'tick', pointerId: state.hold.pointerId }, performance.now())
        render()
        if (state.hold.startedAt !== null && !state.hold.passed) holdRafId = requestAnimationFrame(holdLoop)
      }
      const parentSend = (kind) => (e) => {
        let type = kind
        if (type === 'down') {
          if (parentBtn.hasPointerCapture(e.pointerId)) parentBtn.releasePointerCapture(e.pointerId)
        }
        // With touch the button keeps the pointer, so pointerleave never comes: an up or move
        // that lands outside the button counts as leaving it.
        if ((type === 'up' || type === 'move') && state.hold.pointerId === e.pointerId && !insideRect(parentBtn.getBoundingClientRect(), e.clientX, e.clientY)) type = 'leave'
        if (type === 'move') return
        state = parentEvent(state, { type, pointerId: e.pointerId }, performance.now())
        if (type === 'down' && !holdRafId) holdRafId = requestAnimationFrame(holdLoop)
        schedule()
      }
      parentBtn.addEventListener('pointerdown', parentSend('down'), { signal })
      parentBtn.addEventListener('pointerup', parentSend('up'), { signal })
      parentBtn.addEventListener('pointermove', parentSend('move'), { signal })
      parentBtn.addEventListener('pointerleave', parentSend('leave'), { signal })
      parentBtn.addEventListener('pointercancel', parentSend('cancel'), { signal })
      parentBtn.addEventListener('contextmenu', (e) => e.preventDefault(), { signal })

      const onResize = () => { sizeCanvas(); schedule() }
      window.addEventListener('resize', onResize, { signal })
      window.addEventListener('orientationchange', onResize, { signal })

      sizeCanvas()
      render()
    },
    unmount() {
      if (controller) controller.abort()
      controller = null
      if (rafId) cancelAnimationFrame(rafId)
      if (holdRafId) cancelAnimationFrame(holdRafId)
      rafId = holdRafId = 0
      if (mountedHost) mountedHost.replaceChildren()
      mountedHost = null
      state = null
    },
    getState() {
      return state
    },
  }
}

export const lettersTool = createTraceTool({
  id: 'letters',
  label: 'Letters',
  items: GLYPHS,
  labelText: (g) => `${g.id} · ${g.case}`,
  withModes: true,
})
