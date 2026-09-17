// One Node-side merge of the DAT data files: the twin of loadDAT() in dat.js. Every DAT
// check and test reads from here so nobody re-implements the fragment walk. Missing
// fragments are skipped (test-dat-content.cjs is what asserts they exist); a present file
// that does not parse throws, because that is never a content-session state to tolerate.
//
// Flat in scripts/ on purpose: neither the `test-*.cjs` glob of `npm test` nor the
// `check-*.cjs` glob of `check:content` picks it up.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');

function read(name) {
  const file = path.join(dataDir, name.endsWith('.json') ? name : name + '.json');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// `outline.files` is the registry: a fragment is { name, file, data } with data null when absent.
function fragmentsOf(outline) {
  const walk = kind =>
    (outline.files[kind] || []).map(name => ({ name, kind, file: 'data/' + name + '.json', data: read(name) }));
  return { course: walk('course'), cards: walk('cards'), questions: walk('questions') };
}

// The exact shapes loadDAT() builds in the browser (DESIGN §3a "Loader").
function mergeCourse(outline, courseFragments) {
  const present = courseFragments.filter(
    f => f.data && Array.isArray(f.data.units) && f.data.chapter && typeof f.data.chapter.id === 'string'
  );
  const units = present.flatMap(f => f.data.units);
  const chapters = present.map(f => ({
    ...f.data.chapter,
    units: units.filter(u => u.chapter === f.data.chapter.id).map(u => u.id),
  }));
  return {
    version: 1,
    authoredOn: outline.authoredOn,
    status: 'DAT course merged from fragments; independent subject review pending.',
    outlineSource: outline.sourceUrl,
    categories: outline.concepts.flatMap(c =>
      c.categories.map(cat => ({ id: cat.id, title: cat.title, section: c.section }))
    ),
    chapters,
    units,
  };
}

function load() {
  const outline = read('dat-outline');
  if (!outline) throw Error('data/dat-outline.json is missing.');
  const fragments = fragmentsOf(outline);
  return {
    outline,
    fragments,
    course: mergeCourse(outline, fragments.course),
    questions: fragments.questions.filter(f => f.data && Array.isArray(f.data.items)).flatMap(f => f.data.items),
    cards: fragments.cards.filter(f => f.data && Array.isArray(f.data.cards)).flatMap(f => f.data.cards),
    rc: read('dat-rc'),
    pat: read('dat-pat'),
    repairs: read('dat-repairs'),
    rehearsals: read('dat-rehearsals'),
    scoreTables: read('dat-score-tables'),
  };
}

const merged = load();
module.exports = { read, load, fragmentsOf, mergeCourse, ...merged };
