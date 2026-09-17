// Trailing-slash section URLs used to boot a blank page: relative script/CSS
// hrefs resolved under /mcat/, Netlify's SPA fallback served HTML as JavaScript,
// and #app never mounted. These pins keep the assets rooted and the 301s in place.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const SECTIONS = [
  'mcat',
  'dat',
  'learn',
  'practice',
  'anatomy',
  'medicine',
  'neuro',
  'academy',
  'stats',
  'utsa',
  'focus',
  'updates',
];

test('index.html loads every stylesheet and boot script from the site root', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const hrefs = [...html.matchAll(/<(?:link|script)\b[^>]*(?:href|src)="([^"]+)"/g)].map(m => m[1]);
  const assets = hrefs.filter(u => /\.(?:css|js)(\?|$)/.test(u));
  assert.ok(assets.length >= 10, 'boot assets are listed');
  for (const url of assets) {
    assert.ok(url.startsWith('/') || /^https?:\/\//.test(url), url + ' must not be path-relative');
    assert.doesNotMatch(url, /^[a-z]/, url + ' would resolve under /mcat/');
  }
});

test('_redirects canonicalizes every section trailing slash before the SPA fallback', () => {
  const text = fs.readFileSync('_redirects', 'utf8');
  const lines = text
    .split('\n')
    .map(l => l.split('#', 1)[0].trim())
    .filter(Boolean);
  const fallback = lines.findIndex(l => l.startsWith('/*'));
  assert.ok(fallback > 0, 'SPA fallback exists');
  for (const name of SECTIONS) {
    const rule = lines.find(l => l.startsWith(`/${name}/`));
    assert.ok(rule, `/${name}/ has a redirect`);
    assert.match(rule, new RegExp(`^/${name}/\\s+/${name}\\s+301$`));
    assert.ok(lines.indexOf(rule) < fallback, `/${name}/ is rewritten before the catch-all`);
  }
});

test('loadScript prefixes relative module URLs so lazy sections survive a slashed path', () => {
  const app = fs.readFileSync('app.js', 'utf8');
  assert.match(app, /src\.startsWith\('\/'\)/);
  assert.match(app, /'\/' \+ src/);
});
