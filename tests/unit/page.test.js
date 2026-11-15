import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readText } from './helpers/files.js';
import { PRESET_SECONDS } from '../../src/timer.js';

const html = readText('index.html');
const css = readText('styles.css');
const ui = readText('src/ui.js');

function cssRules() {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '');
  const rules = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(clean)) !== null) {
    rules.push({ selectors: m[1].split(',').map((s) => s.trim()), body: m[2] });
  }
  return rules;
}

test('AC12 page has exactly four labelled preset buttons', () => {
  const re = /<button\b[^>]*\bdata-preset-seconds="(\d+)"[^>]*>\s*([^<]*?)\s*<\/button>/g;
  const found = [...html.matchAll(re)];
  assert.equal(found.length, 4);
  assert.deepEqual(found.map((f) => Number(f[1])), [...PRESET_SECONDS]);
  assert.deepEqual(found.map((f) => f[2]), ['2 min', '3 min', '5 min', '10 min']);
});

test('AC13 ui disables duration controls from durationLocked', () => {
  assert.ok(ui.includes('durationLocked'));
  assert.ok(ui.includes('.disabled'));
});

test('AC15 ui re-renders every frame while running', () => {
  for (const s of ['requestAnimationFrame(', 'Date.now()', 'tick(', 'visibilitychange']) {
    assert.ok(ui.includes(s), `ui.js missing ${s}`);
  }
  assert.ok(html.includes('id="time-text"'));
  assert.ok(!ui.includes('setInterval'));
});

test('AC17 one 48px minimum rule covers buttons and inputs', () => {
  const rules = cssRules();
  const both = rules.filter((r) => r.selectors.includes('button') && r.selectors.includes('input'));
  assert.equal(both.length, 1);
  assert.match(both[0].body, /min-width:\s*48px\s*;/);
  assert.match(both[0].body, /min-height:\s*48px\s*;/);
  assert.match(both[0].body, /touch-action:\s*manipulation\s*;/);
  const control = /(^|[\s.#])(button|input|preset|custom-apply|custom-minutes|custom-seconds|start-btn|pause-btn|resume-btn|reset-btn)\b/;
  for (const r of rules) {
    if (!r.selectors.some((s) => control.test(s))) continue;
    for (const m of r.body.matchAll(/(?:^|[;\s])(width|height|max-width|max-height)\s*:\s*(\d+(?:\.\d+)?)px/g)) {
      assert.ok(Number(m[2]) >= 48, `${r.selectors.join(',')} sets ${m[1]} ${m[2]}px`);
    }
  }
  assert.ok(!/\sstyle\s*=/.test(html));
  assert.ok(!/\sonclick\s*=/.test(html));
  const tags = [...html.matchAll(/<(button|input|a|select|textarea)\b/g)].map((m) => m[1]);
  assert.ok(tags.length > 0);
  assert.ok(tags.every((t) => t === 'button' || t === 'input'));
});

test('AC18 page has every control id', () => {
  for (const id of ['presets', 'custom', 'custom-minutes', 'custom-seconds', 'custom-apply',
    'start-btn', 'pause-btn', 'resume-btn', 'reset-btn']) {
    assert.ok(html.includes(`id="${id}"`), `missing id ${id}`);
  }
});

test('AC21 markup has Done text and finished track rule', () => {
  assert.match(html, /<p\b[^>]*id="done-text"[^>]*\bhidden\b[^>]*>\s*Done\s*<\/p>/);
  const rules = cssRules();
  const fin = rules.find((r) => r.selectors.includes('.ring.is-finished .ring-track'));
  assert.ok(fin);
  assert.match(fin.body, /stroke:\s*var\(--ring-finished\)/);
  const arc = rules.find((r) => r.selectors.includes('.ring-arc'));
  assert.ok(arc);
  assert.match(arc.body, /stroke-linecap:\s*butt/);
});
