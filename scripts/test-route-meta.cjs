/* Raw HTML for each public route must carry that route's title, description
   and canonical URL. Unknown paths are classified as missing so the edge
   function can answer 404. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const shell = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('route metadata rewrites canonical, title and description, and 404s unknown paths', async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'netlify/edge-functions/route-meta.js')).href);
  assert.equal(mod.classify('/').kind, 'home');
  assert.equal(mod.classify('/dat/').kind, 'route');
  assert.equal(mod.classify('/dat/').key, 'dat');
  assert.equal(mod.classify('/practice').key, 'practice');
  assert.equal(mod.classify('/share/clinical').kind, 'passthrough');
  assert.equal(mod.classify('/genetics').kind, 'passthrough');
  assert.equal(mod.classify('/cogpsych').kind, 'passthrough');
  assert.equal(mod.classify('/some-old-link').kind, 'missing');
  assert.equal(mod.classify('/mcat/not-a-page').kind, 'missing');
  assert.equal(mod.classify('/favicon.ico').kind, 'missing');

  const dat = mod.transform(shell, {
    title: mod.ROUTES.dat.title,
    description: mod.ROUTES.dat.description,
    canonical: 'https://cortexmedical.academy/dat',
  });
  assert.match(dat, /<title>DAT preparation \| Cortex Medical Academy<\/title>/);
  assert.match(dat, /<link rel="canonical" href="https:\/\/cortexmedical\.academy\/dat">/);
  assert.match(dat, /name="description" content="Free preparation for the U\.S\. Dental Admission Test:/);
  assert.doesNotMatch(dat, /name="description" content="Free, evidence-based MCAT prep:/);

  const practice = mod.transform(shell, {
    title: mod.ROUTES.practice.title,
    description: mod.ROUTES.practice.description,
    canonical: 'https://cortexmedical.academy/practice',
    image: mod.ROUTES.practice.image,
    imageAlt: mod.ROUTES.practice.imageAlt,
  });
  assert.match(practice, /<link rel="canonical" href="https:\/\/cortexmedical\.academy\/practice">/);
  assert.match(practice, /property="og:image" content="https:\/\/cortexmedical\.academy\/og-clinical\.jpg"/);
  assert.match(practice, /twitter:site" content="@Kevin_Vigil"/);

  const missing = mod.transform(shell, {
    title: mod.NOT_FOUND.title,
    description: mod.NOT_FOUND.description,
    canonical: 'https://cortexmedical.academy/some-old-link',
  });
  assert.match(missing, /<title>Page not found \| Cortex Medical Academy<\/title>/);
  assert.match(missing, /canonical" href="https:\/\/cortexmedical\.academy\/some-old-link"/);
  assert.doesNotMatch(missing, /canonical" href="https:\/\/cortexmedical\.academy\/"/);

  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  for (const route of Object.values(mod.ROUTES)) {
    assert.ok(app.includes(route.description), route.path);
    assert.ok(app.includes(route.path), route.path);
  }
  assert.ok(app.includes(mod.NOT_FOUND.description));
});
