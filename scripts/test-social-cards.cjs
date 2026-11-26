// Share cards: one per main area of the site, drawn by scripts/generate-social-cards.mjs into og/,
// and the tags that attach each card to its area. Crawlers never run the app, so everything here is
// checked in the files a crawler is served: index.html, the share pages built from it, the two
// redirect-only share links and the edge function that tags /practice.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const SITE = 'https://cortexmedical.academy';
const read = file => fs.readFileSync(file, 'utf8');
const stamp = JSON.parse(read('og/cards.json'));
const generator = () => import(pathToFileURL(path.resolve('scripts/generate-social-cards.mjs')).href);
const unescape = text =>
  text
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const meta = (html, attr, key) => {
  const found = html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`));
  return found ? unescape(found[1]) : undefined;
};
const link = (html, rel) => (html.match(new RegExp(`<link rel="${rel}" href="([^"]*)"`)) || [])[1];
const rules = () =>
  read('_redirects')
    .split('\n')
    .map(line => line.split('#')[0].trim())
    .filter(Boolean)
    .map(line => line.split(/\s+/));

// Each main area: the address people share, the file a crawler is served there, and the area's card.
// Every page inside an area keeps the area's path (its state rides in the query string), so it is
// served this same file and this same card.
const AREAS = [
  { path: '/', file: 'index.html', card: 'home' },
  { path: '/academy', file: 'academy.html', card: 'academy' },
  { path: '/mcat', file: 'mcat.html', card: 'mcat' },
  { path: '/dat', file: 'dat.html', card: 'dat' },
  { path: '/neuro', file: 'neuro.html', card: 'neuro' },
  { path: '/lab', file: 'lab.html', card: 'lab' },
  { path: '/updates', file: 'updates.html', card: 'updates' },
];
const SHARE_PAGES = AREAS.filter(area => area.file !== 'index.html');

function cardTags(html, card, label) {
  const image = `${SITE}/${stamp.cards[card].file}`;
  for (const [attr, key] of [
    ['name', 'twitter:image'],
    ['property', 'og:image'],
    ['property', 'og:image:secure_url'],
  ])
    assert.equal(meta(html, attr, key), image, `${label}: ${key}`);
  assert.equal(meta(html, 'name', 'twitter:card'), 'summary_large_image', `${label}: twitter:card`);
  assert.equal(meta(html, 'property', 'og:image:type'), 'image/jpeg', `${label}: og:image:type`);
  assert.equal(meta(html, 'property', 'og:image:width'), '1200', `${label}: og:image:width`);
  assert.equal(meta(html, 'property', 'og:image:height'), '630', `${label}: og:image:height`);
}

test('every number on a card still matches the site, and og/cards.json describes the cards as drawn', async () => {
  const { CARDS, cardFile, cardFacts } = await generator();
  const facts = JSON.parse(JSON.stringify(cardFacts()));
  assert.deepEqual(
    facts,
    stamp.facts,
    'The site changed since the cards were drawn. Raise the rev of each affected card in ' +
      'scripts/generate-social-cards.mjs, run it, then run python3 scripts/build-share-pages.py.'
  );
  assert.deepEqual(Object.keys(stamp.cards).sort(), CARDS.map(card => card.id).sort());
  for (const card of CARDS) {
    assert.equal(stamp.cards[card.id].file, cardFile(card), `${card.id}: file name carries the card's rev`);
    assert.equal(stamp.cards[card.id].alt, card.alt(facts), `${card.id}: alt text`);
    assert.match(stamp.cards[card.id].alt, /^Cortex Medical Academy/, `${card.id}: alt names the site`);
  }
  // The counts come from the same places the pages count them.
  assert.equal(facts.neuro.units, JSON.parse(read('data/neuro.json')).learningPaths[0].steps.length);
  assert.equal(facts.neuro.exercises, JSON.parse(read('data/neuro.json')).neuroCodeLessons.length);
  assert.equal(facts.mcat.lessons, JSON.parse(read('data/mcat-course.json')).units.length);
  assert.equal(facts.clinical.specialties, new Set(JSON.parse(read('data/index.json')).map(entry => entry.key)).size);
  assert.ok(JSON.parse(read('data/index.json')).length >= facts.clinical.bankFloor);
  assert.ok(facts.courses.length >= 5, 'the open courses');
});

test('each card is a 1200×630 JPEG, small enough for every platform, with the bytes the stamp records', () => {
  const files = Object.values(stamp.cards).map(card => card.file);
  assert.deepEqual(fs.readdirSync('og').sort(), ['cards.json', ...files.map(file => path.basename(file))].sort());
  for (const [id, card] of Object.entries(stamp.cards)) {
    const buf = fs.readFileSync(card.file);
    assert.equal(buf.readUInt16BE(0), 0xffd8, `${id}: JPEG`);
    let at = 2,
      size = null;
    while (at < buf.length) {
      const marker = buf.readUInt16BE(at);
      if (marker >= 0xffc0 && marker <= 0xffc3) {
        size = { height: buf.readUInt16BE(at + 5), width: buf.readUInt16BE(at + 7) };
        break;
      }
      at += 2 + buf.readUInt16BE(at + 2);
    }
    assert.deepEqual(size, { width: 1200, height: 630 }, id);
    assert.ok(buf.length < 300 * 1024, `${id}: under 300 KB (${buf.length} bytes)`);
    assert.equal(crypto.createHash('sha256').update(buf).digest('hex'), card.sha256, `${id}: drawn by the generator`);
  }
});

test('each main area is served its own card, title and address', () => {
  execFileSync('python3', ['scripts/build-share-pages.py', '--check'], { stdio: 'pipe' });
  const index = read('index.html');
  const titles = new Set(),
    images = new Set();
  for (const area of AREAS) {
    const html = read(area.file),
      url = SITE + area.path;
    cardTags(html, area.card, area.file);
    assert.equal(link(html, 'image_src'), `${SITE}/${stamp.cards[area.card].file}`, `${area.file}: image_src`);
    for (const [attr, key] of [
      ['name', 'twitter:image:alt'],
      ['property', 'og:image:alt'],
    ])
      assert.equal(meta(html, attr, key), stamp.cards[area.card].alt, `${area.file}: ${key}`);
    assert.equal(meta(html, 'property', 'og:url'), url, `${area.file}: og:url`);
    assert.equal(link(html, 'canonical'), url, `${area.file}: canonical`);
    assert.equal(meta(html, 'name', 'twitter:title'), meta(html, 'property', 'og:title'), `${area.file}: titles agree`);
    assert.equal(
      meta(html, 'name', 'twitter:description'),
      meta(html, 'property', 'og:description'),
      `${area.file}: descriptions agree`
    );
    assert.ok(meta(html, 'property', 'og:description').length <= 200, `${area.file}: description fits a card`);
    titles.add(meta(html, 'property', 'og:title'));
    images.add(meta(html, 'property', 'og:image'));
  }
  assert.equal(titles.size, AREAS.length, 'no two areas share a title');
  assert.equal(images.size, AREAS.length, 'no two areas share a card');
  // A share page is the app page: everything after the head's share block is index.html.
  const body = html => html.slice(html.indexOf('<link rel="sitemap"'));
  for (const area of SHARE_PAGES) {
    const html = read(area.file);
    assert.equal(body(html), body(index), `${area.file}: same app page`);
    assert.match(html.split('\n')[1], /GENERATED from index\.html by scripts\/build-share-pages\.py/, area.file);
    assert.match(
      meta(html, 'property', 'og:title'),
      / — Cortex Medical Academy$/,
      `${area.file}: title names the site`
    );
  }
  assert.match(meta(read('mcat.html'), 'property', 'og:title'), /^MCAT preparation/);
  assert.match(meta(read('dat.html'), 'property', 'og:title'), /^DAT preparation/);
  assert.match(meta(read('neuro.html'), 'property', 'og:title'), /^Neuroengineering/);
  assert.match(meta(read('lab.html'), 'property', 'og:title'), /Histology Lab/);
  assert.match(meta(read('lab.html'), 'property', 'og:description'), /Bielschowsky/);
});

test('the catalog page names every open course', async () => {
  const { cardFacts } = await generator();
  const description = meta(read('academy.html'), 'property', 'og:description');
  for (const course of cardFacts().courses)
    assert.ok(
      description.includes(course.name.replace("Alzheimer's", 'Alzheimer’s')),
      `${course.name} in: ${description}`
    );
});

test('Clinical Scenarios gets its card at the edge, and both share links carry theirs', async () => {
  // The edge function is plain ES-module JavaScript; a data: URL loads it the same way on any Node.
  const source = read('netlify/edge-functions/practice-og.js');
  const edge = await import(`data:text/javascript,${encodeURIComponent(source)}`);
  assert.deepEqual(edge.config.path, ['/practice', '/practice/*']);
  const { html, applied } = edge.transform(read('index.html'));
  assert.equal(applied, 13, 'every share tag in index.html is rewritten');
  cardTags(html, 'clinical', '/practice');
  assert.equal(link(html, 'image_src'), `${SITE}/${stamp.cards.clinical.file}`);
  assert.equal(meta(html, 'name', 'twitter:image:alt'), stamp.cards.clinical.alt);
  assert.equal(meta(html, 'property', 'og:image:alt'), stamp.cards.clinical.alt);
  assert.equal(meta(html, 'property', 'og:url'), `${SITE}/practice`);
  assert.equal(link(html, 'canonical'), `${SITE}/practice`);
  assert.equal(meta(html, 'property', 'og:title'), 'Clinical Scenarios — Cortex Medical Academy');
  // The description's one number is the case bank's. Neither it nor the card says the note is
  // compared with a model or with a clinician's.
  const description = meta(html, 'property', 'og:description');
  assert.match(description, /^Start your shift: meet a patient/);
  assert.doesNotMatch(description, /model|clinician|compare/i);
  const { CARDS, cardFacts } = await generator();
  const drawn = CARDS.find(card => card.id === 'clinical').build(cardFacts());
  assert.doesNotMatch(drawn.slice(drawn.indexOf('<body')), /model|clinician|compare/i, 'the Clinical card');
  assert.doesNotMatch(stamp.cards.clinical.alt, /model|clinician|compare/i, 'the Clinical alt text');
  const specialties = new Set(JSON.parse(read('data/index.json')).map(entry => entry.key)).size;
  assert.ok(description.includes(`${specialties} specialties`), description);

  const clinical = read('share-clinical.html');
  cardTags(clinical, 'clinical', 'share-clinical.html');
  assert.equal(meta(clinical, 'property', 'og:description'), description, 'the share link says the same');
  assert.equal(meta(clinical, 'name', 'twitter:description'), description);
  cardTags(read('share.html'), 'home', 'share.html');
});

test('_redirects serves each share page at its path before the SPA fallback, and old card addresses still answer', () => {
  const lines = rules();
  const at = source => lines.findIndex(rule => rule[0] === source);
  for (const area of SHARE_PAGES)
    for (const source of [area.path, `${area.path}/`]) {
      assert.ok(at(source) >= 0, source);
      assert.deepEqual(lines[at(source)], [source, `/${area.file}`, '200']);
      assert.ok(at(source) < at('/*'), `${source} comes before the SPA fallback`);
    }
  const moved = lines.filter(rule => /^\/og-/.test(rule[0]));
  assert.deepEqual(moved.map(rule => rule[0]).sort(), [
    '/og-clinical.jpg',
    '/og-lab.jpg',
    '/og-neuro-2.jpg',
    '/og-v5.jpg',
  ]);
  for (const [source, target, status] of moved) {
    assert.equal(status, '301', source);
    assert.ok(fs.existsSync(target.slice(1)), `${source} points at a card that exists (${target})`);
    assert.ok(!fs.existsSync(source.slice(1)), `${source} is gone, so the redirect is what answers`);
  }
  // Nothing else on the site still points at a retired card.
  for (const file of [
    'index.html',
    'share.html',
    'share-clinical.html',
    '_headers',
    'netlify/edge-functions/practice-og.js',
  ])
    assert.doesNotMatch(read(file), /og-(?:v5|clinical|neuro-2|lab)\.jpg/, file);
});

test('_headers gives every card the JPEG type, a one-day cache and open access', () => {
  assert.match(
    read('_headers'),
    /\n\/og\/\*\.jpg\n {2}Content-Type: image\/jpeg\n {2}Cache-Control: public, max-age=86400\n {2}Access-Control-Allow-Origin: \*/
  );
});

test('the share tags credit the X account the site links to', () => {
  const handle = read('app.js').match(/const X_HANDLE = '([^']+)'/)[1];
  for (const file of ['index.html', 'share.html', 'share-clinical.html', ...SHARE_PAGES.map(area => area.file)]) {
    const html = read(file);
    assert.equal(meta(html, 'name', 'twitter:site'), `@${handle}`, `${file}: twitter:site`);
    const creator = meta(html, 'name', 'twitter:creator');
    if (creator !== undefined) assert.equal(creator, `@${handle}`, `${file}: twitter:creator`);
  }
});
