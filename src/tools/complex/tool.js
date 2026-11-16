import { createTraceTool } from '../letters/tool.js'
import { PICTURES, pictureLabel } from './pictures.js'

export const complexTool = createTraceTool({ id: 'complex', label: 'Complex shapes', items: PICTURES, labelText: pictureLabel })
