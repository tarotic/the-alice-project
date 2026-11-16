import { createTraceTool } from '../letters/tool.js'
import { SHAPES, shapeLabel } from './shapes.js'

export const shapesTool = createTraceTool({ id: 'shapes', label: 'Shapes', items: SHAPES, labelText: shapeLabel })
