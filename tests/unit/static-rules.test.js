import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
function walk(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}
const srcFiles = walk(path.join(root, 'src'))
const read = (p) => fs.readFileSync(p, 'utf8')

test('AC9 title is exactly Play and no names in html/src', () => {
  const html = read(path.join(root, 'index.html'))
  const m = html.match(/<title>([\s\S]*?)<\/title>/)
  assert.ok(m)
  assert.equal(m[1], 'Play')
  for (const f of [path.join(root, 'index.html'), ...srcFiles])
    assert.doesNotMatch(read(f), /ramona|alice/i, f)
})

test('AC30 forbidden strings absent', () => {
  const banned = ['http://', 'https://', 'fetch(', 'XMLHttpRequest', '<script src="http', 'localStorage', 'sessionStorage', 'document.cookie', '@import url(']
  const files = [path.join(root, 'index.html'), path.join(root, 'styles.css'), ...srcFiles]
  assert.ok(srcFiles.length > 0)
  for (const f of files) {
    const t = read(f)
    for (const b of banned) assert.ok(!t.includes(b), `${f} contains ${b}`)
  }
})

test('AC32 package.json', () => {
  const pkg = JSON.parse(read(path.join(root, 'package.json')))
  assert.equal(pkg.type, 'module')
  assert.ok(!('dependencies' in pkg))
  assert.ok(!('devDependencies' in pkg))
})
