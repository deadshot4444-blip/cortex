// The Alzheimer's Histology Lab's own look: the lab palette is scoped to lab pages. Its share page
// and card are covered with every other area's in scripts/test-social-cards.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = file => fs.readFileSync(file, 'utf8');

test('the lab palette is scoped to lab pages and keeps Cortex type and buttons', () => {
  const css = read('lab.css');
  const block = css.slice(css.indexOf('html:has(main.lab-page) {'));
  assert.ok(block.length > 0, 'scoped palette block');
  for (const token of ['--bg', '--surface', '--line', '--blue', '--lab-accent'])
    assert.match(block, new RegExp(`${token}:`));
  assert.doesNotMatch(block, /--sans|--mono|font-family/, 'type stays Cortex');
  assert.doesNotMatch(css, /^:root\s*\{[^}]*--bg/m, 'never repaints the whole site');
});
