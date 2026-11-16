import { registerTool } from '../registry.js'
import { timerTool } from './timer/tool.js'
import { lettersTool } from './letters/tool.js'
import { shapesTool } from './shapes/tool.js'
import { complexTool } from './complex/tool.js'

registerTool(timerTool)
registerTool(lettersTool)
registerTool(shapesTool)
registerTool(complexTool)
