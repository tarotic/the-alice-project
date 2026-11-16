import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
}

test('AC26 shapes folder exists and is scanned', () => {
  const dir = path.join(root, 'src', 'tools', 'shapes')
  assert.ok(fs.statSync(dir).isDirectory())
  assert.ok(fs.readdirSync(dir).length >= 1)
  const all = walk(path.join(root, 'src'))
  assert.ok(all.includes(path.join(dir, 'shapes.js')))
  assert.ok(all.includes(path.join(dir, 'tool.js')))
})
