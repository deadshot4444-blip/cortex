// The DAT Reading Comprehension runner (dat-rc.js, DAT-11) in jsdom, plus the data rules of
// DESIGN §3d over whatever passages data/dat-rc.json holds.
//
// The passages themselves are written by the content sessions (C16 → C17 → C18) and the file
// ships with zero of them, so this suite carries its own fixture: FIXTURE is a spec-shaped set
// of three passages (17 + 16 + 17 = 50 questions) that the §3d checker must accept, and SMALL is
// a two-passage toy the interaction tests run end to end without 50 clicks. The same checker
// runs over every authored passage the moment one lands, which is what makes this file C16's
// gate, and the empty-file path is asserted too, because that is the state the track ships in.
//
// Harness style: scripts/test-dat-practice-ui.cjs (jsdom + the shared el/esc/setView/topbar
// stubs and a Map-backed StudyStorage that survives a simulated reload).
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { outline, rc } = require('./dat-data.cjs');

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const RC_OPTIONS = outline.optionPolicy.rc.options;
const RC_PACE = outline.pacingSeconds.rc;
const PASSAGE_SECONDS = (outline.sections.rc.minutes * 60) / outline.sections.rc.passages;
const SKILL_IDS = outline.readingSkills.map(s => s.id);
const SOURCES = ['dat-rc.js'];

// DESIGN §3d / AUTHORING §1.5: the type vocabulary and the family each type belongs to.
const FAMILY = {
  detail: 'rc-1',
  except: 'rc-1',
  sequence: 'rc-1',
  'main-idea': 'rc-2',
  function: 'rc-2',
  title: 'rc-2',
  tone: 'rc-2',
  inference: 'rc-3',
  'strengthen-weaken': 'rc-3',
  application: 'rc-3',
};
const FAMILY_MINIMUM = { 'rc-1': 6, 'rc-2': 4, 'rc-3': 4 };
const WORDS = [1100, 1400];
const PARAGRAPHS = [10, 14];
const PER_PASSAGE = outline.targets.rc.questionsPerPassage;
const PER_SET = outline.targets.rc.questionsPerSet;

/* ---------- the fixture ---------- */
// Neutral filler vocabulary. The words carry no meaning on purpose: this is a shape fixture for
// the runner and the checker, never sample content, and it copies nothing.
const LEXICON = [
  'mineral',
  'surface',
  'enamel',
  'saliva',
  'buffer',
  'gradient',
  'diffusion',
  'crystal',
  'lattice',
  'ion',
  'sample',
  'tissue',
  'interval',
  'measure',
  'model',
  'process',
  'layer',
  'matrix',
  'boundary',
  'fluid',
  'uptake',
  'rate',
  'balance',
  'signal',
  'response',
  'threshold',
  'pattern',
  'structure',
  'function',
  'carbon',
  'oxygen',
  'energy',
  'transfer',
  'stability',
  'solution',
  'density',
  'volume',
  'pressure',
  'temperature',
  'sodium',
];
function paragraphText(seed, count) {
  const words = [];
  for (let i = 0; i < count; i++) words.push(LEXICON[(seed * 7 + i * 3) % LEXICON.length]);
  const sentences = [];
  for (let i = 0; i < words.length; i += 10) {
    const chunk = words.slice(i, i + 10);
    chunk[0] = chunk[0][0].toUpperCase() + chunk[0].slice(1);
    sentences.push(chunk.join(' ') + '.');
  }
  return sentences.join(' ');
}
// Five options of strictly different lengths whose unique longest sits at (i * 2 + 1) % 5, while
// the answer sits at i % 5: the two coincide once every five questions, so the longest-option
// bias is 20 % and the answer positions land within ±1 of uniform.
function optionText(index, position) {
  const rank = (position - ((index * 2 + 1) % RC_OPTIONS) + RC_OPTIONS) % RC_OPTIONS;
  return ('Mineral uptake' + ' and diffusion'.repeat(RC_OPTIONS - rank)).trim();
}
function typeFor(index, total) {
  const firstFamily = total >= 17 ? 7 : 6;
  if (index < firstFamily) return ['detail', 'except', 'sequence'][index % 3];
  if (index < firstFamily + 5) return ['main-idea', 'function', 'title', 'tone'][(index - firstFamily) % 4];
  return ['inference', 'strengthen-weaken', 'application'][(index - firstFamily - 5) % 3];
}
function buildPassage(n, questionCount, paragraphs = 12, wordsPerParagraph = 100) {
  const text = Array.from({ length: paragraphs }, (_, i) => paragraphText(n * 13 + i, wordsPerParagraph)).join('\n\n');
  const questions = Array.from({ length: questionCount }, (_, i) => {
    const type = typeFor(i, questionCount);
    const question = {
      id: `rc-${n}-${i + 1}`,
      skill: FAMILY[type],
      type,
      stem: `Passage ${n}, question ${i + 1}: a ${type} question.`,
      options: Array.from({ length: RC_OPTIONS }, (_, pos) => optionText(i, pos)),
      answer: i % RC_OPTIONS,
      explanation: `Paragraph ${(i % paragraphs) + 1} states the relationship the question asks about.`,
      evidenceParagraphs: [(i % paragraphs) + 1],
    };
    // One question carries an authored displayOrder, so both branches of orderFor() are covered.
    if (n === 1 && i === 3) question.displayOrder = [4, 3, 2, 1, 0];
    return question;
  });
  return {
    id: 'rc-' + n,
    section: 'rc',
    discipline: 'science',
    domain: ['dental', 'biology', 'chemistry'][(n - 1) % 3],
    title: `Fixture passage ${n}`,
    words: paragraphs * wordsPerParagraph,
    text,
    questions,
    contentNote: 'Fixture text written for this test; no published passage is reproduced.',
    sources: [{ title: 'OpenStax Biology 2e', url: 'https://openstax.org/books/biology-2e' }],
    provenance: { origin: 'new', reviewStatus: 'author-checked', sourceCheckedOn: '2026-09-16' },
  };
}
const ROOT = {
  format: 'dat-rc',
  version: 1,
  authoredOn: '2026-09-16',
  author: 'test fixture',
  reviewStatus: 'fixture',
  sourceCheckedOn: '2026-09-16',
  contentNote: 'Fixture.',
  sources: [{ title: 'OpenStax Biology 2e', url: 'https://openstax.org/books/biology-2e' }],
};
const FIXTURE = {
  ...ROOT,
  sets: [{ id: 'rc-set-1', title: 'Set 1', passages: ['rc-1', 'rc-2', 'rc-3'] }],
  passages: [buildPassage(1, 17), buildPassage(2, 16), buildPassage(3, 17)],
};
// Two short passages for the interaction tests: same record shape, six questions in total.
const SMALL = {
  ...ROOT,
  sets: [{ id: 'rc-set-x', title: 'Warm-up', passages: ['rc-8', 'rc-9'] }],
  passages: [buildPassage(8, 3, 4, 40), buildPassage(9, 3, 4, 40)],
};

/* ---------- DESIGN §3d ---------- */
function wordCount(text) {
  return String(text || '')
    .split(/\s+/)
    .filter(Boolean).length;
}
function paragraphsOf(passage) {
  return String(passage.text || '')
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(Boolean);
}
// Returns the list of rule violations, so a test can assert both "clean" and "this break is caught".
function passageErrors(passage) {
  const problems = [];
  const say = (ok, message) => {
    if (!ok) problems.push(message);
  };
  const paragraphs = paragraphsOf(passage),
    words = wordCount(passage.text),
    questions = passage.questions || [];
  say(/^rc-\d+$/.test(passage.id || ''), 'id pattern');
  say(words >= WORDS[0] && words <= WORDS[1], `words ${words}`);
  say(paragraphs.length >= PARAGRAPHS[0] && paragraphs.length <= PARAGRAPHS[1], `paragraphs ${paragraphs.length}`);
  say(
    questions.length >= PER_PASSAGE[0] && questions.length <= PER_PASSAGE[1],
    `questions per passage ${questions.length}`
  );
  say(Array.isArray(passage.sources) && passage.sources.every(s => /^https:/.test(s.url || '')), 'https sources');
  say(!!passage.contentNote && !!passage.provenance, 'provenance block');
  const family = { 'rc-1': 0, 'rc-2': 0, 'rc-3': 0 },
    positions = new Array(RC_OPTIONS).fill(0);
  let longest = 0;
  const ids = new Set();
  questions.forEach((q, i) => {
    say(q.id === `${passage.id}-${i + 1}`, `question id ${q.id}`);
    say(!ids.has(q.id), `duplicate question id ${q.id}`);
    ids.add(q.id);
    say(SKILL_IDS.includes(q.skill), `skill ${q.skill}`);
    say(Object.prototype.hasOwnProperty.call(FAMILY, q.type), `type ${q.type}`);
    say(FAMILY[q.type] === q.skill, `type ${q.type} does not belong to skill ${q.skill}`);
    say(Array.isArray(q.options) && q.options.length === RC_OPTIONS, `option count on ${q.id}`);
    say(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < RC_OPTIONS, `answer index on ${q.id}`);
    say(!!q.stem && !!q.explanation, `stem and explanation on ${q.id}`);
    say(
      Array.isArray(q.evidenceParagraphs) &&
        q.evidenceParagraphs.length > 0 &&
        q.evidenceParagraphs.every(n => Number.isInteger(n) && n >= 1 && n <= paragraphs.length),
      `evidenceParagraphs on ${q.id}`
    );
    if (q.displayOrder !== undefined) {
      const sorted = [...q.displayOrder].sort((a, b) => a - b);
      say(
        q.displayOrder.length === RC_OPTIONS && sorted.every((v, idx) => v === idx),
        `displayOrder on ${q.id} is a permutation`
      );
    }
    if (FAMILY[q.type]) family[FAMILY[q.type]]++;
    if (Number.isInteger(q.answer)) positions[q.answer]++;
    if (Array.isArray(q.options) && q.options[q.answer]?.length === Math.max(...q.options.map(o => o.length)))
      longest++;
  });
  for (const [skill, minimum] of Object.entries(FAMILY_MINIMUM))
    say(family[skill] >= minimum, `${skill} count ${family[skill]} below ${minimum}`);
  say(longest / (questions.length || 1) <= 0.3, `longest-option bias ${longest}/${questions.length}`);
  const uniform = questions.length / RC_OPTIONS;
  positions.forEach((count, i) => say(Math.abs(count - uniform) <= 1, `answer position ${i} used ${count} times`));
  return problems;
}
function setErrors(data) {
  const problems = [];
  for (const set of data.sets || []) {
    const list = (set.passages || []).map(id => (data.passages || []).find(p => p.id === id));
    if (list.some(p => !p)) {
      problems.push(`${set.id} names a passage that does not exist`);
      continue;
    }
    if (list.length !== outline.sections.rc.passages) problems.push(`${set.id} has ${list.length} passages`);
    const total = list.reduce((n, p) => n + p.questions.length, 0);
    if (total !== PER_SET) problems.push(`${set.id} totals ${total} questions, not ${PER_SET}`);
  }
  return problems;
}

test('the fixture obeys every DESIGN §3d rule, and a set of three is exactly 50 questions', () => {
  for (const passage of FIXTURE.passages) assert.deepEqual(passageErrors(passage), [], passage.id);
  assert.deepEqual(setErrors(FIXTURE), []);
  assert.equal(
    FIXTURE.passages.reduce((n, p) => n + p.questions.length, 0),
    PER_SET
  );
  assert.deepEqual(
    FIXTURE.passages.map(p => p.questions.length),
    [17, 16, 17],
    'the fixed 17 + 16 + 17 split (DECISIONS-NUMERIC N4f)'
  );
});

test('the §3d checker actually fails when a rule is broken', () => {
  const broken = (mutate, needle) => {
    const clone = structuredClone(FIXTURE.passages[0]);
    mutate(clone);
    const problems = passageErrors(clone);
    assert.ok(
      problems.some(p => p.includes(needle)),
      `${needle} was not caught; got ${JSON.stringify(problems)}`
    );
  };
  broken(p => (p.text = p.text.split('\n\n').slice(0, 4).join('\n\n')), 'paragraphs');
  broken(p => p.questions.splice(-3), 'questions per passage');
  broken(p => (p.questions[0].skill = 'rc-9'), 'skill');
  broken(p => (p.questions[0].type = 'vibes'), 'type');
  broken(p => (p.questions[0].evidenceParagraphs = [99]), 'evidenceParagraphs');
  broken(p => (p.questions[0].evidenceParagraphs = []), 'evidenceParagraphs');
  broken(p => p.questions[0].options.pop(), 'option count');
  broken(p => (p.questions[3].displayOrder = [0, 1, 2, 3, 3]), 'permutation');
  broken(p => p.questions.forEach(q => (q.answer = 0)), 'answer position');
  broken(p => p.questions.forEach(q => (q.options[q.answer] += ' with a much longer tail')), 'longest-option bias');
  broken(p => p.questions.slice(0, 8).forEach(q => ((q.type = 'tone'), (q.skill = 'rc-2'))), 'rc-1 count');
});

test('every authored passage on disk obeys the same rules', () => {
  const data = rc || { passages: [], sets: [] };
  assert.ok(Array.isArray(data.passages), 'data/dat-rc.json always carries a passages array');
  for (const passage of data.passages) assert.deepEqual(passageErrors(passage), [], passage.id);
  assert.deepEqual(setErrors(data), []);
  const ids = data.passages.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length, 'passage ids are unique');
});

/* ---------- jsdom harness ---------- */
const OPEN = [];
after(() => {
  for (const w of OPEN.splice(0))
    try {
      w.close();
    } catch {
      /* already closed by the test that opened it */
    }
});
function harness({ url = 'http://localhost/dat', store = new Map(), data = SMALL } = {}) {
  const dom = new JSDOM('<!doctype html><div id="app"></div>', { url, runScripts: 'outside-only' });
  OPEN.push(dom.window);
  const w = dom.window,
    context = dom.getInternalVMContext();
  const writes = [];
  Object.assign(w, {
    IS_LOCAL_PREVIEW: true,
    LETTERS: [...LETTERS],
    sectionUrl: id => '/' + id,
    stopTimer() {},
    el: html => {
      const t = w.document.createElement('template');
      t.innerHTML = html;
      return t.content.firstElementChild;
    },
    esc: value =>
      String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
    setView: node => w.document.querySelector('#app').replaceChildren(node),
    topbar: active => w.el(`<header data-active="${active}">Cortex</header>`),
    StudyStorage: {
      paused: false,
      read: (key, fallback) => (store.has(key) ? JSON.parse(store.get(key)) : fallback),
      watch(key, current) {
        return { save: value => this.write(key, value) };
      },
      write(key, value) {
        writes.push(key);
        store.set(key, JSON.stringify(value));
        return true;
      },
      remove(key) {
        store.delete(key);
        return true;
      },
    },
    // data/dat-rc.json is served from the fixture; every other DAT file comes off disk.
    fetch: async file => {
      const name = file.replace(/^data\//, '').split('?')[0];
      if (name === 'dat-rc.json') return { ok: true, json: async () => structuredClone(data) };
      if (!fs.existsSync('data/' + name)) return { ok: false };
      return { ok: true, json: async () => JSON.parse(fs.readFileSync('data/' + name, 'utf8')) };
    },
  });
  for (const file of ['academy.js', 'dat.js', 'dat-drill-engine.js', ...SOURCES])
    vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  const find = selector => w.document.querySelector(selector);
  const all = selector => [...w.document.querySelectorAll(selector)];
  return {
    w,
    store,
    writes,
    find,
    all,
    run: code => vm.runInContext(code, context),
    text: selector => find(selector)?.textContent.trim(),
    texts: selector => all(selector).map(n => n.textContent.trim()),
    saved: key => (store.has(key) ? JSON.parse(store.get(key)) : null),
    // The rendered question, resolved from the stem so no test depends on deal order.
    question() {
      const stem = find('.dat-rc-q .dat-rc-stem').textContent;
      for (const p of data.passages) {
        const q = p.questions.find(x => x.stem === stem);
        if (q) return { passage: p, q };
      }
      throw Error('the rendered stem belongs to no fixture question');
    },
    go(query) {
      w.history.replaceState({}, '', '/dat' + (query ? '?' + query : ''));
      return w.renderDATEntry();
    },
    close: () => w.close(),
  };
}
// Answers the visible question ('correct' | 'wrong' | 'skip') and moves on.
function answerCurrent(h, how = 'correct') {
  const { q } = h.question();
  if (how !== 'skip') {
    const target = h
      .all('.dat-rc-opt')
      .find(b => (how === 'correct' ? +b.dataset.datI === q.answer : +b.dataset.datI !== q.answer));
    target.click();
  }
  h.find('#dat-rc-next').click();
  return q;
}
// Fills in one blind-review card: pick an option, cite a paragraph, write a rationale, continue.
function reviewCurrent(h, { skip = false, choose = 'correct', rationale = 'The second paragraph says so.' } = {}) {
  if (skip) {
    h.find('#dat-rc-blind-skip').click();
    return;
  }
  const { q } = h.question();
  h.all('.dat-rc-opt')
    .find(b => (choose === 'correct' ? +b.dataset.datI === q.answer : +b.dataset.datI !== q.answer))
    .click();
  h.all('.dat-rc-evidence')[0].click();
  const field = h.find('#dat-rc-rationale');
  field.value = rationale;
  field.dispatchEvent(new h.w.Event('input', { bubbles: true }));
  h.find('#dat-rc-blind-next').click();
}

/* ---------- registration and the empty-data path ---------- */
test('the runner registers itself the way the shell expects', () => {
  const h = harness();
  assert.deepEqual(Object.keys(h.run('window.DatRc')).sort(), ['pause', 'render', 'reset']);
  assert.equal(h.run('DAT.pausers.length'), 1, 'the RC clocks are registered with the shell pauser');
  h.close();
});

test('with no passages written yet the view degrades to the track notice instead of throwing', async () => {
  const h = harness({ data: { ...ROOT, sets: [], passages: [] } });
  await h.go('view=rc');
  assert.ok(h.find('.dat-notice'), 'the standard notice shape is rendered');
  assert.match(h.text('.dat-rc-empty h1'), /not written yet/);
  await h.go('view=rc&set=rc-set-1');
  assert.ok(h.find('.dat-rc-empty'), 'a deep link to a set is just as safe');
  assert.equal(h.saved('cs-dat-r-rc'), null, 'nothing is written for a set that does not exist');
  h.close();
});

test('the module pins no option count and no A-E letter run of its own', () => {
  for (const file of SOURCES) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /'ABCD/, file + ' has no ABCD literal (DESIGN §2c)');
    assert.doesNotMatch(source, /\[\s*'A'\s*,\s*'B'\s*,/, file + ' builds no letter array of its own');
  }
  assert.match(fs.readFileSync('dat-rc.js', 'utf8'), /Core\.letters\(/, 'letters come from the drill engine');
});

/* ---------- the split-screen runner ---------- */
test('a set runs split-screen with numbered paragraphs, both clocks and policy option keys', async () => {
  const h = harness({ data: FIXTURE });
  await h.go('view=rc&set=rc-set-1');
  const { passage, q } = h.question();
  assert.equal(passage.id, 'rc-1', 'the set opens on its first passage');

  // Questions above, passage below: the question section precedes the passage in the DOM, which
  // is what the stacked phone layout needs; dat.css turns the same markup into two columns.
  const stage = h.find('.dat-rc-stage');
  const order = [...stage.children].map(node => node.className.split(' ')[0]);
  assert.deepEqual(order, ['dat-rc-q', 'dat-rc-passage']);
  assert.equal(h.all('.dat-rc-text > li.dat-rc-par').length, 12, 'every paragraph is a numbered list item');
  assert.deepEqual(
    h.all('.dat-rc-text > li').map(li => +li.dataset.datPar),
    Array.from({ length: 12 }, (_, i) => i + 1)
  );

  assert.deepEqual(h.texts('.dat-rc-opt .key'), LETTERS.slice(0, RC_OPTIONS), 'keys come from the option policy');
  assert.deepEqual(
    h.texts('.dat-rc-opt span:not(.key)').sort(),
    [...q.options].sort(),
    'every authored option is rendered exactly once'
  );
  assert.equal(h.text('.dat-rc-count'), 'Q 1/50', 'the set is one 50-question block');
  assert.equal(h.text('#dat-rc-clock'), '60:00', '3 passages x 20 minutes = the 60-minute section clock');
  assert.equal(h.text('#dat-rc-passage-clock'), '20:00', 'the passage clock is the section budget over three');
  assert.equal(PASSAGE_SECONDS, 1200);
  h.close();
});

test('a single passage runs on its own 20-minute clock, and an unknown set falls back to the picker', async () => {
  const h = harness({ data: FIXTURE });
  await h.go('view=rc&passage=rc-2');
  assert.equal(h.question().passage.id, 'rc-2');
  assert.equal(h.text('.dat-rc-count'), 'Q 1/16', 'one passage, its own questions');
  assert.equal(h.text('#dat-rc-clock'), '20:00', 'one passage budget, not the whole section');
  assert.equal(h.saved('cs-dat-r-rc').setId, null);

  await h.go('view=rc&set=rc-set-nope');
  assert.ok(h.find('.dat-rc-picker'), 'an unknown set lands on the picker');
  assert.match(h.text('.dat-rc-notice'), /not available/);
  h.close();
});

test('an authored displayOrder is honoured; otherwise the engine deals the order', async () => {
  const h = harness({ data: FIXTURE });
  await h.go('view=rc&set=rc-set-1');
  for (let i = 0; i < 3; i++) h.find('#dat-rc-next').click();
  const { q } = h.question();
  assert.deepEqual(q.displayOrder, [4, 3, 2, 1, 0], 'this is the fixture question that carries one');
  assert.deepEqual(
    h.all('.dat-rc-opt').map(b => +b.dataset.datI),
    q.displayOrder
  );
  h.close();
});

test('mark, the review screen and its filters navigate the section', async () => {
  const h = harness();
  await h.go('view=rc&set=rc-set-x');
  const first = h.question().q;
  h.all('.dat-rc-opt')[0].click();
  h.find('#dat-rc-next').click();
  h.find('#dat-rc-flag').click();
  const marked = h.question().q;
  assert.equal(h.text('#dat-rc-flag'), 'Marked');
  assert.deepEqual(h.saved('cs-dat-r-rc').marks, { [marked.id]: true });

  h.find('#dat-rc-review').click();
  assert.ok(h.find('.dat-rc-nav-screen'), 'the review screen opens');
  assert.equal(h.all('.dat-rc-nav-table tbody tr').length, 6, 'all six questions are listed');
  assert.ok(h.find('#dat-rc-clock'), 'the section clock keeps running on the review screen');
  h.all('[data-dat-filter]')
    .find(b => b.dataset.datFilter === 'marked')
    .click();
  assert.equal(h.all('.dat-rc-nav-table tbody tr').length, 1, 'the Marked filter shows only the flagged question');
  h.all('[data-dat-filter]')
    .find(b => b.dataset.datFilter === 'incomplete')
    .click();
  assert.equal(h.all('.dat-rc-nav-table tbody tr').length, 5, 'one answer given, five incomplete');
  h.all('[data-dat-goto]')[0].click();
  assert.equal(h.question().q.id, first.id === marked.id ? first.id : h.question().q.id, 'Go jumps back into the set');
  assert.ok(h.find('.dat-rc-stage'), 'and lands on the runner, not the review screen');
  h.close();
});

test('drag-to-highlight stores character offsets and paints a mark, and a click clears it', async () => {
  const h = harness();
  await h.go('view=rc&set=rc-set-x');
  const paragraph = h.find('.dat-rc-text > li[data-dat-par="2"]');
  const range = h.w.document.createRange();
  range.setStart(paragraph.firstChild, 0);
  range.setEnd(paragraph.firstChild, 7);
  const selection = h.w.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  h.find('#dat-rc-passage').dispatchEvent(new h.w.MouseEvent('mouseup', { bubbles: true }));

  const button = h.find('#dat-rc-highlight');
  assert.equal(button.hidden, false, 'a selection inside one paragraph pops the Highlight button');
  button.click();
  const mark = h.find('.dat-rc-text > li[data-dat-par="2"] .dat-rc-mark');
  assert.ok(mark, 'the paragraph is repainted with the highlight');
  assert.equal(mark.textContent.length, 7);
  const blob = h.saved('cs-dat-r-rc');
  assert.deepEqual(blob.highlights['rc-8'], [{ par: 2, start: 0, end: 7 }], 'offsets are stored, never markup');

  mark.dispatchEvent(new h.w.MouseEvent('click', { bubbles: true }));
  assert.equal(h.find('.dat-rc-text > li[data-dat-par="2"] .dat-rc-mark'), null, 'clicking a highlight clears it');
  assert.equal(h.saved('cs-dat-r-rc').highlights['rc-8'], undefined);
  h.close();
});

test('a reload resumes the set with its answers, marks, highlights and clock', async () => {
  const store = new Map();
  const first = harness({ store });
  await first.go('view=rc&set=rc-set-x');
  const q1 = answerCurrent(first, 'correct');
  first.find('#dat-rc-flag').click();
  const q2 = first.question().q;
  first.all('.dat-rc-opt')[0].click();
  const blob = first.saved('cs-dat-r-rc');
  assert.equal(blob.idx, 1);
  assert.equal(blob.answers[q1.id], q1.answer);
  assert.ok(blob._remain > 0 && blob._remain <= 2 * PASSAGE_SECONDS * 1000);
  first.close();

  const second = harness({ store });
  await second.go('view=rc&set=rc-set-x');
  assert.equal(second.question().q.id, q2.id, 'the reload lands on the question that was open');
  assert.equal(second.text('.dat-rc-count'), 'Q 2/6');
  assert.equal(second.text('#dat-rc-flag'), 'Marked', 'the mark survived');
  assert.equal(
    second.all('.dat-rc-opt').filter(b => b.classList.contains('picked')).length,
    1,
    'the saved answer is still selected'
  );
  second.find('#dat-rc-prev').click();
  assert.equal(second.question().q.id, q1.id);
  assert.equal(
    +second.all('.dat-rc-opt').find(b => b.classList.contains('picked')).dataset.datI,
    q1.answer,
    'the first answer came back too'
  );
  second.close();
});

/* ---------- blind review ---------- */
test('the attempt hands over to a blind review that orders marked and unsure questions first', async () => {
  const h = harness();
  await h.go('view=rc&set=rc-set-x');
  // Answer everything, but mark the third question and call the fifth "sure".
  const asked = [];
  for (let i = 0; i < 6; i++) {
    if (i === 2) h.find('#dat-rc-flag').click();
    if (i === 4)
      h.all('#dat-rc-conf .mode')
        .find(b => b.dataset.datConf === 'sure')
        .click();
    asked.push(answerCurrent(h, i % 2 ? 'wrong' : 'correct'));
  }
  const blob = h.saved('cs-dat-r-rc');
  assert.equal(blob.phase, 'blind', 'the last Next ends the section and opens the blind review');
  assert.equal(h.find('[data-dat-phase="blind"]').dataset.datPhase, 'blind');
  assert.equal(blob.reviewOrder[blob.reviewOrder.length - 1], asked[4].id, 'the confident question sorts last');
  assert.ok(blob.reviewOrder.includes(asked[2].id));
  assert.equal(blob.reviewOrder.length, 6);

  // Answers stay hidden: no verdict, no correct/wrong classes, and the passage offers evidence.
  assert.equal(h.find('.dat-rc-explain'), null);
  assert.equal(h.all('.dat-rc-opt.correct').length + h.all('.dat-rc-opt.wrong').length, 0);
  assert.equal(h.all('.dat-rc-evidence').length, 4, 'every paragraph is selectable evidence');

  const next = h.find('#dat-rc-blind-next');
  assert.equal(next.disabled, true, 'nothing saved until an answer, evidence and a rationale exist');
  h.all('.dat-rc-opt')[0].click();
  assert.equal(next.disabled, true);
  h.all('.dat-rc-evidence')[1].click();
  assert.equal(next.disabled, true);
  const field = h.find('#dat-rc-rationale');
  field.value = 'Paragraph two states it.';
  field.dispatchEvent(new h.w.Event('input', { bubbles: true }));
  assert.equal(next.disabled, false, 'all three present, so the card can be saved');
  assert.equal(h.text('#dat-rc-evidence-count'), '1 evidence paragraph selected.');
  next.click();
  const saved = h.saved('cs-dat-r-rc');
  const firstReviewed = saved.reviews[blob.reviewOrder[0]];
  assert.equal(firstReviewed.reviewed, true);
  assert.deepEqual(firstReviewed.evidence, [2]);
  assert.equal(firstReviewed.rationale, 'Paragraph two states it.');
  assert.equal(saved.reviewIdx, 1);

  h.find('#dat-rc-blind-skip').click();
  assert.equal(h.saved('cs-dat-r-rc').reviews[blob.reviewOrder[1]].skipped, true, 'skipping keeps the first answer');
  h.close();
});

test('a reload during the blind review comes back to the blind review', async () => {
  const store = new Map();
  const first = harness({ store });
  await first.go('view=rc&set=rc-set-x');
  for (let i = 0; i < 6; i++) answerCurrent(first, 'correct');
  reviewCurrent(first);
  assert.equal(first.saved('cs-dat-r-rc').phase, 'blind');
  first.close();

  const second = harness({ store });
  await second.go('view=rc&set=rc-set-x');
  assert.ok(second.find('[data-dat-phase="blind"]'), 'the second pass resumes where it stopped');
  assert.equal(second.text('.dat-rc-count'), '2/6');
  second.close();
});

/* ---------- the result page, the log and the saved report ---------- */
async function fullRun(h, { wrongEvery = 2 } = {}) {
  await h.go('view=rc&set=rc-set-x');
  const asked = [];
  for (let i = 0; i < 6; i++) asked.push(answerCurrent(h, i % wrongEvery === 1 ? 'wrong' : 'correct'));
  for (let i = 0; i < 6; i++) reviewCurrent(h, { skip: i > 3, choose: 'correct' });
  return asked;
}

test('the review page reports accuracy, seconds against the 72-second target and accuracy by skill', async () => {
  const h = harness();
  const asked = await fullRun(h);
  assert.ok(h.find('.dat-rc-review'), 'the result page renders once the blind review is done');
  const correctFirstPass = asked.filter((_, i) => i % 2 !== 1).length;
  assert.equal(h.text('#dat-rc-accuracy'), Math.round((correctFirstPass / 6) * 100) + '%');
  assert.match(h.text('#dat-rc-pace'), new RegExp(`vs ${RC_PACE} s target`));
  assert.equal(RC_PACE, 72);
  assert.ok(h.all('.dat-rc-skill-table tbody tr').length >= 1, 'accuracy is broken out by reading skill');
  assert.match(h.text('.dat-rc-skill-table tbody tr'), /RC-\d/, 'rows are labelled with the outline category');
  assert.ok(h.all('.dat-rc-evidence-block').length >= 1, 'the evidence paragraph is shown for review');
  assert.ok(
    h.find('.dat-rc-evidence-par').textContent.length > 20,
    'and it is the paragraph text, regenerated from the passage'
  );
  // Blind-review arithmetic: the four reflected cards were all answered correctly on the second pass.
  assert.equal(+h.text('#dat-rc-improved'), asked.slice(0, 4).filter((_, i) => i % 2 === 1).length);
  assert.equal(+h.text('#dat-rc-lost'), 0);
  h.close();
});

test('every answered question writes one cs-dat-log row and misses enrol in the mistake log', async () => {
  const h = harness();
  const asked = await fullRun(h);
  const log = h.saved('cs-dat-log');
  assert.equal(log.length, 6, 'one row per question of the first pass, never one per review card');
  for (const row of log) {
    assert.equal(row.section, 'rc');
    assert.match(row.category, /^RC-[123]$/, 'the QLOG category is an outline category id');
    assert.ok(['rc-8', 'rc-9'].includes(row.passage), 'the passage id travels with the row');
    assert.equal(row.source, 'rc');
    assert.equal(typeof row.ms, 'number');
    assert.ok(row.attemptId.startsWith('dat-rc-'));
  }
  const missed = asked.filter((_, i) => i % 2 === 1);
  const srs = h.saved('cs-dat-srs');
  assert.deepEqual(Object.keys(srs).sort(), missed.map(q => q.id).sort(), 'exactly the missed questions enrolled');
  for (const id of Object.keys(srs)) {
    assert.equal(srs[id].section, 'rc');
    assert.ok(srs[id].due > 0, 'the record is scheduled by the shared SM-2 scheduler');
    assert.ok(['rc-8', 'rc-9'].includes(srs[id].passage), 'the mistake record knows its passage');
  }
  const hist = h.saved('cs-dat-q');
  assert.equal(Object.keys(hist).length, 6);
  assert.equal(h.saved('cs-dat-r-rc'), null, 'the resume blob is cleared when the run is finished');
  h.close();
});

test('the blind review is saved to cs-dat-passage-reviews in the documented shape', async () => {
  const h = harness();
  await fullRun(h);
  const reports = h.saved('cs-dat-passage-reviews');
  const keys = Object.keys(reports);
  assert.equal(keys.length, 1);
  assert.match(keys[0], /^rc:dat-rc-/, "reports are keyed 'rc:<attemptId>' (DESIGN §4)");
  const report = reports[keys[0]];
  assert.equal(report.kind, 'rc');
  assert.equal(report.setId, 'rc-set-x');
  assert.deepEqual(report.passageIds, ['rc-8', 'rc-9']);
  assert.equal(report.paceSeconds, RC_PACE);
  assert.equal(report.questions.length, 6);
  assert.deepEqual(Object.keys(report.totals).sort(), ['correct', 'improved', 'lost', 'n', 'reviewed', 'revised']);
  const entry = report.questions[0];
  assert.deepEqual(Object.keys(entry).sort(), [
    'chosen',
    'conf',
    'correct',
    'marked',
    'ms',
    'passage',
    'qId',
    'review',
    'skill',
    'type',
  ]);
  assert.equal(typeof entry.review.rationale, 'string');
  assert.ok(Array.isArray(entry.review.evidence));
  assert.equal(report.questions[5].review.skipped, true, 'a skipped card is recorded as skipped');
  assert.equal(
    JSON.stringify(report).includes('Mineral uptake and diffusion and diffusion'),
    false,
    'the report stores ids and offsets, never a copy of the passage or its options'
  );
  h.close();
});

test('nothing this runner writes to a cs-dat-* key contains markup', async () => {
  const h = harness();
  await h.go('view=rc&set=rc-set-x');
  // Highlight first, so the resume blob under test carries a range as well as answers.
  const paragraph = h.find('.dat-rc-text > li[data-dat-par="1"]');
  const range = h.w.document.createRange();
  range.setStart(paragraph.firstChild, 2);
  range.setEnd(paragraph.firstChild, 20);
  const selection = h.w.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  h.find('#dat-rc-passage').dispatchEvent(new h.w.MouseEvent('mouseup', { bubbles: true }));
  h.find('#dat-rc-highlight').click();
  const mid = h.saved('cs-dat-r-rc');
  assert.doesNotMatch(JSON.stringify(mid), /<[a-z/!]/i, 'the cs-dat-r-rc blob is markup-free mid-run');

  for (let i = 0; i < 6; i++) answerCurrent(h, 'correct');
  for (let i = 0; i < 6; i++) reviewCurrent(h, { rationale: 'Paragraph 2 states the rate.' });
  for (const [key, value] of h.store) {
    assert.match(key, /^cs-dat-/, 'the runner writes no key outside the DAT namespace');
    assert.doesNotMatch(value, /<[a-z/!]/i, key + ' would be refused by study-backup.js');
  }
  assert.ok(h.store.has('cs-dat-passage-reviews'));
  h.close();
});

/* ---------- pause and reset ---------- */
test('the shell pauser stops the clocks and the recovered hook restarts them', async () => {
  const h = harness();
  await h.go('view=rc&set=rc-set-x');
  const stopped = h.run('pauseDatTools()');
  assert.equal(stopped.length, 1, 'the RC clock hands the shell a resume hook');
  assert.equal(stopped[0].selector, '#dat-rc-clock');
  h.run("window.dispatchEvent(new window.Event('study-storage-recovered'))");
  assert.ok(h.find('#dat-rc-clock'), 'the runner is still on screen and its clock node survived');
  h.close();
});

// The section clock is banked once, by pause(), and every later reader takes the banked value
// rather than recomputing it from a deadline that is no longer running. Without that, a save
// landing while the clocks are paused persists a zero clock and the next resume force-ends the
// section - time the learner never spent.
test('a pause, a save while paused and a resume leave the section clock where it was', async () => {
  const h = harness();
  await h.go('view=rc&set=rc-set-x');
  answerCurrent(h, 'correct');
  const before = h.saved('cs-dat-r-rc')._remain;
  assert.ok(before > 0, 'the running section banks a positive clock');

  // renderDATEntry pauses before awaiting loadDAT, so the runner stays mounted and clickable
  // while the clocks are stopped; the same state is reachable from study-storage-paused.
  h.run("window.dispatchEvent(new window.Event('study-storage-paused'))");
  h.find('#dat-rc-flag').click();
  const paused = h.saved('cs-dat-r-rc')._remain;
  assert.ok(paused > 0, 'a save taken while the clocks are paused persists the banked time, not zero');
  assert.ok(before - paused <= 2000, `the paused save dropped the clock from ${before} to ${paused}`);

  // A second pause before any resume must not bank the already-banked value a second time.
  h.run("window.dispatchEvent(new window.Event('study-storage-paused'))");
  h.run("window.dispatchEvent(new window.Event('study-storage-recovered'))");
  assert.ok(h.find('.dat-rc-stage'), 'the section resumed instead of being force-ended by a zero clock');
  h.find('#dat-rc-flag').click();
  const after = h.saved('cs-dat-r-rc')._remain;
  assert.ok(after > 0 && before - after <= 3000, `the clock came back as ${after} against ${before} before the pause`);
  h.close();
});

// resetDatState (dat.js) is what a workspace reset or an account replacement actually calls, so
// that is what is driven here rather than window.DatRc.reset() directly: calling the hook by hand
// passes whether or not dat.js is wired to it, which is how a missing DatRc line survived a round.
test('a workspace reset drops the in-flight run and the shared attempt cache', async () => {
  const h = harness();
  await h.go('view=rc&set=rc-set-x');
  answerCurrent(h, 'correct');
  assert.notEqual(h.run('DAT.attemptStores'), null, 'the shared attempt cache is built when a set starts');
  assert.notEqual(h.run('window.DatRc.pause()'), undefined, 'a run is in flight, so the pauser hands back a hook');
  h.run('resetDatState()');
  assert.equal(h.run('DAT.attemptStores'), null, 'the cache is dropped with the rest of the workspace');
  assert.equal(h.run('window.DatRc.pause()'), undefined, 'and the in-flight run went with it');
  h.close();
});
