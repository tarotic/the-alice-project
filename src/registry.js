export function createRegistry() {
  const tools = []
  return {
    registerTool(tool) {
      if (tool === null || typeof tool !== 'object') throw new Error('tool must be an object')
      const { id, label, mount, unmount } = tool
      if (typeof id !== 'string' || id === '') throw new Error('tool id must be a non-empty string')
      if (tools.some((t) => t.id === id)) throw new Error('duplicate tool id: ' + id)
      if (typeof label !== 'string' || label.trim() === '') throw new Error('tool label must be non-empty')
      if (typeof mount !== 'function') throw new Error('tool mount must be a function')
      if (typeof unmount !== 'function') throw new Error('tool unmount must be a function')
      const stored = Object.freeze({ id, label, mount, unmount })
      tools.push(stored)
      return stored
    },
    listTools() {
      return tools.slice()
    },
    getTool(id) {
      return tools.find((t) => t.id === id)
    },
  }
}

export const defaultRegistry = createRegistry()
export function registerTool(tool) {
  return defaultRegistry.registerTool(tool)
}
export function listTools() {
  return defaultRegistry.listTools()
}
export function getTool(id) {
  return defaultRegistry.getTool(id)
}
