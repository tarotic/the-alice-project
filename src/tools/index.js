import { registerTool } from '../registry.js'
import { timerTool } from './timer/tool.js'
import { lettersTool } from './letters/tool.js'
import { shapesTool } from './shapes/tool.js'

registerTool(timerTool)
registerTool(lettersTool)
registerTool(shapesTool)
