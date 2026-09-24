const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('anatomy.js', 'utf8');
const records = ['bones', 'muscles', 'organs'].flatMap(name =>
  JSON.parse(fs.readFileSync(`data/${name}.json`, 'utf8'))
);

function harness(saved = new Map()) {
  let invalid = 0;
  const context = vm.createContext({
    console,
    URL,
    URLSearchParams,
    location: { origin: 'http://localhost', pathname: '/anatomy', search: '' },
    history: { pushState() {} },
    sectionUrl: () => '/anatomy',
    window: { addEventListener() {} },
    fetch: async file => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(file, 'utf8')) }),
    StudyStorage: {
      paused: false,
      read: (key, fallback) => (saved.has(key) ? JSON.parse(saved.get(key)) : fallback),
      watch() {},
      sessionFailed() {
        invalid++;
      },
      write(key, value) {
        saved.set(key, JSON.stringify(value));
        return true;
      },
    },
  });
  vm.runInContext(source + '\nrenderAnatView = () => {};', context);
  return { saved, run: code => vm.runInContext(code, context), invalid: () => invalid };
}

test('atlas metadata resolves shared IDs in their authored brain and skull/ear views', async () => {
  const page = harness();
  const targets = page.run('JSON.stringify(VIEW_BONES)');
  await page.run('loadBones()');
  for (const [views, ids] of [
    [
      ['brain-lateral', 'brain-sagittal'],
      ['cerebellum', 'pons', 'medulla'],
    ],
    [
      ['skull', 'ear'],
      ['malleus', 'incus', 'stapes'],
    ],
  ]) {
    for (const view of views) {
      page.run(`startAnat(${JSON.stringify(view)}, 'explore')`);
      for (const id of ids) {
        const expected = records.find(row => row.id === id && row.view === view);
        const actual = page.run(`anatMeta(${JSON.stringify(id)})`);
        assert.equal(actual.name, expected.name);
        assert.equal(actual.blurb, expected.blurb);
        assert.equal(actual.pearl, expected.pearl);
      }
    }
  }
  assert.equal(page.run('JSON.stringify(VIEW_BONES)'), targets);
  assert.equal(page.invalid(), 0);
});

test('new atlas sessions snapshot their view and saved historical explanations survive reload', async () => {
  const page = harness();
  await page.run('loadBones()');
  page.run("startAnat('brain-lateral', 'find')");
  const lateral = records.find(row => row.id === 'cerebellum' && row.view === 'brain-lateral');
  assert.equal(page.run('anat.metadata.cerebellum.blurb'), lateral.blurb);
  assert.equal(page.run('validAnatRun(anat)'), true);
  page.run("anat.metadata.cerebellum.blurb = 'Historical saved explanation'; saveAnatRun()");
  const saved = page.saved.get('cs-anat-runs-v1');
  const reloaded = harness(page.saved);
  await reloaded.run('loadBones()');
  reloaded.run("startAnat('brain-lateral', 'find')");
  assert.equal(reloaded.run("anatMeta('cerebellum').blurb"), 'Historical saved explanation');
  assert.equal(reloaded.saved.get('cs-anat-runs-v1'), saved);
  assert.equal(reloaded.run('validAnatRun(anat)'), true);
  reloaded.run("startAnat('brain-lateral', 'explore')");
  assert.equal(reloaded.run("anatMeta('cerebellum').blurb"), lateral.blurb);
  reloaded.run("startAnat('brain-sagittal', 'find')");
  const sagittal = records.find(row => row.id === 'cerebellum' && row.view === 'brain-sagittal');
  assert.equal(reloaded.run('anat.metadata.cerebellum.blurb'), sagittal.blurb);
  assert.equal(reloaded.invalid(), 0);
});
