// The Alzheimer's Histology Lab's own identity: a share page (lab.html, generated from index.html)
// served at /lab with the lab's title and card, the card image itself, and the scoped lab palette.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const read = file => fs.readFileSync(file, 'utf8');
const meta = (html, attr, key) => (html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`)) || [])[1];

test('lab.html is index.html with the lab title, canonical URL and share card, and is current', () => {
  execFileSync('python3', ['scripts/build-share-pages.py', '--check'], { stdio: 'pipe' });
  const lab = read('lab.html'),
    index = read('index.html');
  assert.match(lab, /<title>Alzheimer’s Histology Lab — Cortex Medical Academy<\/title>/);
  assert.match(lab, /<link rel="canonical" href="https:\/\/cortexmedical\.academy\/lab">/);
  for (const [attr, key] of [
    ['property', 'og:image'],
    ['property', 'og:image:secure_url'],
    ['name', 'twitter:image'],
  ])
    assert.equal(meta(lab, attr, key), 'https://cortexmedical.academy/og-lab.jpg', key);
  assert.equal(meta(lab, 'property', 'og:url'), 'https://cortexmedical.academy/lab');
  assert.match(meta(lab, 'property', 'og:title'), /Histology Lab/);
  assert.match(meta(lab, 'property', 'og:description'), /Bielschowsky/);
  // Everything after the head's share block is the same app page.
  const body = html => html.slice(html.indexOf('<link rel="sitemap"'));
  assert.equal(body(lab), body(index));
});

test('_redirects serves /lab and /lab/ from lab.html with a 200 rewrite before the SPA fallback', () => {
  const lines = read('_redirects')
    .split('\n')
    .map(l => l.split('#')[0].trim())
    .filter(Boolean);
  const at = source => lines.findIndex(l => l.split(/\s+/)[0] === source);
  for (const source of ['/lab', '/lab/']) {
    assert.ok(at(source) >= 0, source);
    assert.deepEqual(lines[at(source)].split(/\s+/), [source, '/lab.html', '200']);
    assert.ok(at(source) < at('/*'), `${source} comes before the SPA fallback`);
  }
});

test('og-lab.jpg is a 1200×630 JPEG with long-lived headers like the site card', () => {
  const buf = fs.readFileSync('og-lab.jpg');
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
  assert.match(read('_headers'), /\/og-lab\.jpg\n {2}Content-Type: image\/jpeg/);
});

test('the lab palette is scoped to lab pages and keeps Cortex type and buttons', () => {
  const css = read('lab.css');
  const block = css.slice(css.indexOf('html:has(main.lab-page) {'));
  assert.ok(block.length > 0, 'scoped palette block');
  for (const token of ['--bg', '--surface', '--line', '--blue', '--lab-accent'])
    assert.match(block, new RegExp(`${token}:`));
  assert.doesNotMatch(block, /--sans|--mono|font-family/, 'type stays Cortex');
  assert.doesNotMatch(css, /^:root\s*\{[^}]*--bg/m, 'never repaints the whole site');
});
