// The Neuroengineering share card: a share page (neuro.html, generated from index.html) served at
// /neuro with the course's title and card, and the card image itself.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const read = file => fs.readFileSync(file, 'utf8');
const meta = (html, attr, key) => (html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`)) || [])[1];

test('neuro.html is index.html with the neuro title, canonical URL and share card, and is current', () => {
  execFileSync('python3', ['scripts/build-share-pages.py', '--check'], { stdio: 'pipe' });
  const neuro = read('neuro.html'),
    index = read('index.html');
  assert.match(neuro, /<title>Neuroengineering — Cortex Medical Academy<\/title>/);
  assert.match(neuro, /<link rel="canonical" href="https:\/\/cortexmedical\.academy\/neuro">/);
  for (const [attr, key] of [
    ['property', 'og:image'],
    ['property', 'og:image:secure_url'],
    ['name', 'twitter:image'],
  ])
    assert.equal(meta(neuro, attr, key), 'https://cortexmedical.academy/og-neuro.jpg', key);
  assert.equal(meta(neuro, 'property', 'og:url'), 'https://cortexmedical.academy/neuro');
  assert.match(meta(neuro, 'property', 'og:title'), /Neuroengineering/);
  // Everything after the head's share block is the same app page.
  const body = html => html.slice(html.indexOf('<link rel="sitemap"'));
  assert.equal(body(neuro), body(index));
});

test('_redirects serves /neuro and /neuro/ from neuro.html with a 200 rewrite before the SPA fallback', () => {
  const lines = read('_redirects')
    .split('\n')
    .map(l => l.split('#')[0].trim())
    .filter(Boolean);
  const at = source => lines.findIndex(l => l.split(/\s+/)[0] === source);
  for (const source of ['/neuro', '/neuro/']) {
    assert.ok(at(source) >= 0, source);
    assert.deepEqual(lines[at(source)].split(/\s+/), [source, '/neuro.html', '200']);
    assert.ok(at(source) < at('/*'), `${source} comes before the SPA fallback`);
  }
});

test('og-neuro.jpg is a 1200×630 JPEG with long-lived headers like the site card', () => {
  const buf = fs.readFileSync('og-neuro.jpg');
  assert.equal(buf.readUInt16BE(0), 0xffd8, 'JPEG');
  let i = 2,
    size = null;
  while (i < buf.length) {
    const marker = buf.readUInt16BE(i);
    if (marker >= 0xffc0 && marker <= 0xffc3) {
      size = { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      break;
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  assert.deepEqual(size, { width: 1200, height: 630 });
  assert.match(read('_headers'), /\/og-neuro\.jpg\n {2}Content-Type: image\/jpeg/);
});
