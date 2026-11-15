import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readText, listFiles, deployableFiles, exists } from './helpers/files.js';

function assertNoneContain(files, needles) {
  for (const f of files) {
    const text = readText(f).toLowerCase();
    for (const n of needles) {
      assert.ok(!text.includes(n.toLowerCase()), `${f} contains ${n}`);
    }
  }
}

test('AC23 no external resource references in the deployable site', () => {
  const needles = ['http:' + '//', 'https:' + '//', 'src="' + '//', 'href="' + '//', 'url(' + '//',
    '@import', 'fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'EventSource'];
  assertNoneContain(deployableFiles(), needles);
});

test('AC24 no storage, cookies or analytics', () => {
  assertNoneContain(deployableFiles(),
    ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'analytics', 'gtag']);
});

test('AC25 deployable site is only html, css and js', () => {
  const files = deployableFiles();
  assert.ok(files.length >= 6);
  for (const f of files) assert.match(f, /\.(html|css|js)$/, f);
});

test('AC25 package.json has no dependencies and no build', () => {
  const pkg = JSON.parse(readText('package.json'));
  assert.equal(pkg.type, 'module');
  for (const k of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    assert.ok(!(k in pkg), k);
  }
  assert.deepEqual(Object.keys(pkg.scripts), ['test']);
  assert.equal(pkg.scripts.test, 'node --test');
  assert.ok(!exists('node_modules'));
  const rootFiles = listFiles('').filter((f) => !f.includes('/'));
  const banned = /^(webpack\.config\..*|vite\.config\..*|rollup\.config\..*|esbuild\..*|tsconfig\.json|\.babelrc)$/;
  for (const f of rootFiles) assert.ok(!banned.test(f), f);
  assert.ok(!exists('.babelrc'));
});

test('AC25 module imports are relative and end in .js', () => {
  const specs = [];
  for (const f of listFiles('src').filter((x) => x.endsWith('.js'))) {
    const text = readText(f);
    for (const m of text.matchAll(/\bfrom\s*(['"])([^'"]+)\1/g)) specs.push([f, m[2]]);
    for (const m of text.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1/g)) specs.push([f, m[2]]);
    assert.ok(!/\bimport\s*\(\s*[^'"\s]/.test(text), `${f} has a dynamic import with a non-literal`);
  }
  const html = readText('index.html');
  const script = html.match(/<script\b[^>]*\bsrc="([^"]+)"/);
  assert.ok(script);
  specs.push(['index.html', script[1]]);
  assert.ok(specs.length >= 4);
  for (const [f, s] of specs) {
    assert.ok(s.startsWith('./') || s.startsWith('../'), `${f}: ${s}`);
    assert.ok(s.endsWith('.js'), `${f}: ${s}`);
  }
});
