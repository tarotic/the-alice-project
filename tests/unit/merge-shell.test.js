import test from 'node:test';
import assert from 'node:assert/strict';
import { readText, exists, listFiles } from './helpers/files.js';

const html = readText('index.html');
const css = readText('styles.css');
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, '');

function rootVar(name) {
  const m = css.match(new RegExp('--' + name + ':\\s*(#[0-9A-Fa-f]{6})\\s*;'));
  assert.ok(m, 'missing :root variable --' + name);
  return m[1];
}
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = ([r, g, b]) => {
  const f = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const blend = (fg, alpha, bg) => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));

test('S1 index.html: nav, main, tool area, timer root, title and script', () => {
  assert.equal((html.match(/<nav id="switcher"/g) || []).length, 1);
  assert.equal((html.match(/<main/g) || []).length, 1);
  assert.match(html, /<main[^>]*id="tool-area"[^>]*data-tool="timer"[^>]*>[\s\S]*id="timer-tool"[\s\S]*<\/main>/);
  assert.ok(html.indexOf('class="space"') < html.indexOf('<nav id="switcher"'));
  assert.match(html, /<title>Play<\/title>/);
  assert.match(html, /<script type="module" src="\.\/src\/ui\.js"><\/script>/);
});

test('S2 every id the timer tool looks up exists exactly once in index.html', () => {
  const tool = readText('src/tools/timer/tool.js');
  const ids = new Set();
  for (const m of tool.matchAll(/\$\('([^']+)'\)/g)) ids.add(m[1]);
  for (const m of tool.matchAll(/makeWheel\('([^']+)',\s*'([^']+)'/g)) { ids.add(m[1]); ids.add(m[2]); }
  const root = tool.match(/TIMER_ROOT_ID\s*=\s*'([^']+)'/);
  assert.ok(root, 'TIMER_ROOT_ID missing');
  ids.add(root[1]);
  assert.ok(ids.size >= 16, 'found only ' + ids.size + ' ids');
  for (const id of ids) {
    const n = (html.match(new RegExp('id="' + id + '"', 'g')) || []).length;
    assert.equal(n, 1, 'id ' + id + ' occurs ' + n + ' times');
  }
});

test('S3 styles.css: scoping of the Letters and Shapes rules', () => {
  const rules = [...cssNoComments.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim()).filter((s) => !s.startsWith('@') && !/^(from|to|\d+%)/.test(s));
  const bare = rules.filter((s) => s === 'button' || s === '*' || s === '.actions');
  assert.deepEqual(bare, []);
  assert.equal(rules.filter((s) => s === 'html, body').length, 1);
  assert.equal(rules.filter((s) => s === 'body').length, 1);
  for (const sel of rules) {
    for (const part of sel.split(',').map((p) => p.trim())) {
      if (!/\.actions|\*|\bbutton\b/.test(part)) continue;
      if (part === 'button' || sel === 'button, input') continue;
      if (/^\.swatch/.test(part) || part === '#presets' || part === '#custom') continue;
      if (/^#presets|^#custom/.test(sel)) continue;
      assert.ok(part.startsWith('#tool-area:not([data-tool="timer"])') || part.startsWith('#switcher'), 'unscoped selector: ' + part);
    }
  }
  assert.ok(css.includes('#switcher'));
  assert.ok(css.includes('--switcher-height'));
});

test('S4 contrast of the new colours', async () => {
  const bg = rgb(rootVar('control-bg'));
  const page = rgb(rootVar('page-bg'));
  assert.ok(ratio(rgb(rootVar('switch-active-text')), rgb(rootVar('switch-active-bg'))) >= 4.5, 'active tab');
  assert.ok(ratio(rgb(rootVar('reward-text')), page) >= 4.5, 'reward vs page');
  assert.ok(ratio(rgb(rootVar('reward-text')), bg) >= 4.5, 'reward vs control');
  assert.ok(ratio(rgb(rootVar('control-text')), rgb(rootVar('hold-fill'))) >= 4.5, 'hold fill');
  const { INK_COLOUR } = await import('../../src/tools/letters/views/ink.js');
  const { GUIDE_COLOUR } = await import('../../src/tools/letters/views/guide.js');
  const ink = rgb(INK_COLOUR);
  assert.ok(ratio(ink, bg) >= 4.5, 'ink vs background');
  const m = GUIDE_COLOUR.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
  assert.ok(m, 'GUIDE_COLOUR must be rgba(...)');
  const guide = blend([Number(m[1]), Number(m[2]), Number(m[3])], Number(m[4]), bg);
  const g = ratio(guide, bg);
  assert.ok(g >= 1.5 && g < 3, 'guide is faint: ' + g);
  assert.ok(ratio(ink, guide) >= 3, 'ink over guide');
});

test('S5 no timers anywhere in src, and no off-screen alarm file', () => {
  for (const f of listFiles('src')) {
    const t = readText(f);
    assert.ok(!t.includes('setTimeout') && !t.includes('setInterval'), f);
  }
  assert.equal(exists('src/tools/timer/finish-alarm.js'), false);
});

test('S6 shell and registration text', () => {
  const ui = readText('src/ui.js');
  assert.ok(ui.includes('dataset.tool'));
  assert.ok(ui.includes('listTools()[0]'));
  const idx = readText('src/tools/index.js');
  const at = (s) => idx.indexOf('registerTool(' + s + ')');
  assert.ok(at('timerTool') >= 0 && at('timerTool') < at('lettersTool') && at('lettersTool') < at('shapesTool'));
  assert.ok(readText('src/tools/timer/tool.js').includes('pause(timer, Date.now())'));
});

test('S7 importing the tool index without any DOM does not throw', async () => {
  // Each test file is its own process and no fake DOM is installed here.
  assert.equal(typeof globalThis.document, 'undefined');
  await import('../../src/tools/index.js');
});
