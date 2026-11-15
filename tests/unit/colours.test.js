import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readText } from './helpers/files.js';

const css = readText('styles.css');

function prop(name) {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  assert.ok(m, `missing --${name}`);
  return m[1];
}

function luminance(hex) {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function ruleBody(selectorRegex) {
  const re = new RegExp(`${selectorRegex}\\s*\\{([^}]*)\\}`);
  const m = css.match(re);
  assert.ok(m, `rule not found: ${selectorRegex}`);
  return m[1];
}

test('contrast self-check', () => {
  assert.equal(contrast('#FFFFFF', '#000000').toFixed(2), '21.00');
});

test('AC21a finished colour differs from running colour and is at least 3:1', () => {
  const fin = prop('ring-finished');
  const run = prop('ring-running');
  const track = prop('ring-track');
  const bg = prop('page-bg');
  assert.notEqual(fin.toLowerCase(), run.toLowerCase());
  assert.notEqual(fin.toLowerCase(), track.toLowerCase());
  assert.ok(contrast(fin, bg) >= 3, `ratio ${contrast(fin, bg)}`);
});

test('AC21a colour constants are the ones the page uses', () => {
  assert.match(ruleBody('(?:^|\\})\\s*body'), /background(?:-color)?:[^;]*var\(--page-bg\)/);
  assert.match(ruleBody('\\.ring-arc'), /stroke:\s*var\(--ring-running\)/);
  assert.match(ruleBody('\\.ring\\.is-finished \\.ring-track'), /stroke:\s*var\(--ring-finished\)/);
});

test('AC21b Done text is at least 4.5:1', () => {
  assert.ok(contrast(prop('done-text'), prop('page-bg')) >= 4.5);
  assert.match(ruleBody('\\.done'), /color:\s*var\(--done-text\)/);
});
