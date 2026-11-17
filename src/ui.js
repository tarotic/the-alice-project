import './tools/index.js'
import { listTools } from './registry.js'
import { createSwitchState, performSwitch } from './switcher.js'
import { toolIcon } from './icons.js'

const bar = document.getElementById('switcher')
const toolArea = document.getElementById('tool-area')
let state = createSwitchState()
const buttons = new Map()

function trySwitch(id) {
  try {
    state = performSwitch(state, id, toolArea)
  } catch (err) {
    console.error(err)
    state = err.state ?? createSwitchState()
  }
  refresh()
}

function refresh() {
  for (const [id, b] of buttons) b.setAttribute('aria-pressed', String(id === state.activeId))
  toolArea.dataset.tool = state.activeId ?? ''
}

for (const tool of listTools()) {
  const b = document.createElement('button')
  b.type = 'button'
  b.classList.add('tab')
  // The visible tab is an icon. The label stays as screen-reader text and as a hover tooltip.
  const icon = toolIcon(tool.id)
  b.innerHTML = icon
  const name = document.createElement('span')
  name.textContent = tool.label
  if (icon) name.className = 'sr-only'
  b.append(name)
  b.title = tool.label
  b.addEventListener('click', () => {
    trySwitch(tool.id)
  })
  buttons.set(tool.id, b)
  bar.appendChild(b)
}

trySwitch(listTools()[0].id)
