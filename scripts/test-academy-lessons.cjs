const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const file = process.argv[2] || 'data/anatomy-foundations.json';
const ECGTrace = require('../ecg-engine.js');
const section = process.argv[3] || 'anatomy';
const original = JSON.parse(fs.readFileSync(file));
const plainTrace = value => JSON.parse(JSON.stringify(value));
const source = fs.readFileSync('academy-lessons.js', 'utf8').replace('window.AcademyLessons = Object.freeze',
  'window.lessonTest = { validLesson, validRecord, ready, courses }; window.AcademyLessons = Object.freeze');

function harness(saved = new Map(), data = original) {
  let invalid = 0, writes = 0, fail = false, lastMain, focused = null;
  const nodes = new Map();
  const win = { addEventListener() {}, scrollY: 0, scrollTo(_, y) { win.scrollY = y; } };
  const location = new URL(`http://localhost/${section === 'reference' ? 'medicine' : section}`);
  function node(html = '') {
    return { html, children: [], disabled: false, value: '',
      appendChild(child) { this.children.push(child); },
      querySelector(selector) {
        if (!this.html.includes(`id="${selector.slice(1)}"`)) return null;
        return nodes.get(selector) || nodes.set(selector, {}).get(selector);
      },
      querySelectorAll(selector) {
        if (selector === '[data-academy-view]') return [...this.html.matchAll(/data-academy-view="([a-z0-9-]+)"/g)].map(match => {
          const button = { dataset: { academyView: match[1] }, focus() {} }; nodes.set('view-' + match[1], button); return button;
        });
        if (selector !== '[data-answer]') return [];
        return [...this.html.matchAll(/data-answer="(\d+)"/g)].map(match => {
          const button = { dataset: { answer: match[1] } }; nodes.set('answer-' + match[1], button); return button;
        });
      },
    };
  }
  const storage = { paused: false, read: (key, fallback) => saved.has(key) ? JSON.parse(saved.get(key)) : fallback,
    watch() {}, sessionFailed() { invalid++; this.paused = true; },
    write(key, value) { writes++; if (fail) return false; saved.set(key, JSON.stringify(value)); return true; } };
  const context = vm.createContext({ console, Date, Math, URL, URLSearchParams, location, ECGTrace,
    window: win, document: { querySelector(selector) {
      if (selector === '.academy-answer' && !lastMain?.html.includes('class="academy-answer"')) return null;
      return { focus() { focused = selector; }, scrollIntoView() {} };
    } }, StudyStorage: storage,
    fetch: async () => ({ ok: true, json: async () => structuredClone(data) }),
    sectionUrl: () => section === 'reference' ? '/medicine' : '/' + section, history: { pushState(_, __, url) { location.href = new URL(url, location).href; }, replaceState(_, __, url) { location.href = new URL(url, location).href; } },
    esc: value => String(value), el: html => { const result = node(html); if (html.includes('<main')) lastMain = result; return result; },
    topbar: () => node(), setView() { win.scrollY = 0; focused = 'h1'; },
  });
  vm.runInContext(source, context);
  return { api: context.window.AcademyLessons, internal: context.window.lessonTest, saved, nodes, win,
    get invalid() { return invalid; }, get writes() { return writes; }, get html() { return lastMain?.html; },
    get focused() { return focused; }, set fail(value) { fail = value; }, storage };
}

(async () => {
  const h = harness(); await h.api.load(section, file);
  const course = h.internal.courses.get(section);
  assert.equal(original.lessons.length, section === 'anatomy' ? 12 : 22);
  assert.ok(original.lessons.every(h.internal.validLesson));
  assert.equal(original.lessons.flatMap(lesson => lesson.steps.filter(step => step.kind === 'check')).length, section === 'anatomy' ? 30 : 60);
  if (original.groups) {
    const catalog=h.api.catalog(section);
    assert.equal((catalog.match(/data-academy-lesson=/g)||[]).length,original.lessons.length);
    for(const group of original.groups) assert.ok(catalog.includes(group.title));
  }
  for (const lesson of original.lessons) {
    h.api.open(section, lesson.id, 99);
    const record = course.progress.lessons[lesson.id];
    assert.equal(record.index, 0, 'A direct URL cannot skip unanswered steps');
    let checks = 0;
    for (const [i, step] of lesson.steps.entries()) {
      assert.equal(record.index, i);
      if(step.table) { assert.ok(h.html.includes(step.table.caption)); assert.match(h.html, /scope="col"/); assert.match(h.html, /scope="row"/); }
      if (step.kind === 'check') {
        const first = checks++ === 0, chosen = first ? (step.answer + 1) % step.options.length : step.answer;
        h.win.scrollY = 480; h.nodes.get('answer-' + chosen).onclick();
        assert.equal(h.win.scrollY, 480, 'Answering a check keeps the scroll position');
        assert.equal(h.focused, '.academy-answer', 'Focus moves to the feedback after answering');
        assert.match(h.html, /class="academy-answer" role="status" tabindex="-1"/);
        const answeredAt = record.steps[step.id].answeredAt;
        h.nodes.get('answer-' + step.answer).onclick();
        assert.equal(record.steps[step.id].selected, chosen, 'The first answer is immutable');
        assert.equal(record.steps[step.id].answeredAt, answeredAt);
      } else if (step.kind === 'reflect') {
        const input = h.nodes.get('#academy-response'); input.value = 'Original explanation with a specific relationship.'; input.oninput();
        h.nodes.get('#academy-next').onclick();
        assert.equal(record.completedAt, undefined, 'Comparison is required before completion');
        h.win.scrollY = 320; h.nodes.get('#academy-reveal').onclick();
        assert.equal(h.win.scrollY, 320, 'Revealing the model keeps the scroll position');
        assert.equal(h.focused, '.academy-answer', 'Focus moves to the model explanation after revealing');
        if (step.required) {
          const savedStep = record.steps[step.id];
          assert.equal(savedStep.firstDraft, input.value);
          h.nodes.get('#academy-next').onclick(); assert.equal(record.completedAt, undefined, 'Required comparison cannot be skipped');
          const comparison = h.nodes.get('#academy-comparison'); comparison.value = 'My timing agrees; clinical cause and outcome remain uncertain.'; comparison.oninput();
        }
      } else if (step.views) {
        h.win.scrollY = 200; h.nodes.get('view-' + step.views[1].id).onclick();
        assert.equal(record.steps[step.id].view, step.views[1].id);
        assert.equal(h.win.scrollY, 200); assert.equal(h.focused, `[data-academy-view="${step.views[1].id}"]`);
        assert.ok(h.html.includes(step.views[1].description));
        h.fail = true; h.nodes.get('view-' + step.views[0].id).onclick();
        assert.equal(JSON.parse(h.saved.get(course.key)).lessons[lesson.id].steps[step.id].view, step.views[1].id);
        h.fail = false; h.api.open(section, lesson.id, i);
        assert.equal(JSON.parse(h.saved.get(course.key)).lessons[lesson.id].steps[step.id].view, step.views[0].id);
      }
      if (i + 1 < lesson.steps.length) h.nodes.get('#academy-next').onclick();
    }
    h.fail = true; h.nodes.get('#academy-next').onclick();
    const completedAt = record.completedAt;
    assert.ok(completedAt);
    h.fail = false; h.nodes.get('#academy-next').onclick();
    assert.equal(record.completedAt, completedAt, 'Retry keeps the original completion time');
    assert.ok(h.html.includes(`${checks - 1}/${checks} checks correct`));
    assert.ok(h.internal.validRecord(record));
    h.api.open(section, lesson.id, lesson.steps.length - 1);
    assert.match(h.html, /readonly/);
  }
  const requiredLesson = original.lessons.find(lesson => lesson.steps.some(step => step.required));
  if (requiredLesson) {
    const fresh = harness(); await fresh.api.load(section, 'test'); fresh.api.open(section, requiredLesson.id);
    const record = fresh.internal.courses.get(section).progress.lessons[requiredLesson.id];
    for (const [index, step] of requiredLesson.steps.entries()) {
      if (step.kind === 'check') fresh.nodes.get('answer-' + step.answer).onclick();
      if (step.required) {
        const input = fresh.nodes.get('#academy-response');
        input.value = '   '; input.oninput(); fresh.nodes.get('#academy-reveal').onclick();
        assert.equal(record.steps[step.id].revealedAt, undefined, 'Whitespace cannot unlock the model');
        input.value = 'My original measured explanation.'; input.oninput(); fresh.nodes.get('#academy-reveal').onclick();
        assert.equal(record.steps[step.id].firstDraft, input.value);
        const comparison = fresh.nodes.get('#academy-comparison');
        comparison.value = 'I agree on the measurements; the clinical cause remains uncertain.';
        fresh.fail = true; comparison.oninput();
        assert.equal(fresh.nodes.get('#academy-next').disabled, true, 'A failed comparison save cannot enable completion');
        const disk = JSON.parse(fresh.saved.get('cs-academy-' + section + '-v1')).lessons[requiredLesson.id];
        assert.equal(disk.steps[step.id].comparison, undefined, 'The prior saved copy remains intact');
        fresh.fail = false; comparison.oninput(); fresh.nodes.get('#academy-next').onclick(); assert.ok(record.completedAt);
        const broken = structuredClone(record); delete broken.steps[step.id].firstDraft;
        assert.equal(fresh.internal.validRecord(broken), false, 'A required pre-feedback explanation cannot disappear from a completed record');
      } else if (index + 1 < requiredLesson.steps.length) fresh.nodes.get('#academy-next').onclick();
    }
    const updated = structuredClone(original); const changedStep = updated.lessons.find(lesson => lesson.id === requiredLesson.id).steps.find(step => step.trace);
    if (changedStep) {
      changedStep.trace.values[100] = .9;
      const reload = harness(fresh.saved, updated); await reload.api.load(section, 'test'); reload.api.open(section, requiredLesson.id, 0);
      assert.deepEqual(plainTrace(reload.internal.courses.get(section).progress.lessons[requiredLesson.id].content.steps.find(step => step.trace).trace), plainTrace(record.content.steps.find(step => step.trace).trace));
    }
  }
  const changed = structuredClone(original); changed.lessons[0].title = 'Changed content';
  changed.lessons[0].steps[1].answer = (changed.lessons[0].steps[1].answer + 1) % 4;
  const reload = harness(h.saved, changed); await reload.api.load(section, 'test');
  reload.api.open(section, original.lessons[0].id, 1);
  assert.ok(reload.html.includes(original.lessons[0].title));
  assert.doesNotMatch(reload.html, /Changed content/);
  const existing = reload.internal.courses.get(section).progress.lessons[original.lessons[0].id];
  assert.equal(existing.content.steps[1].answer, original.lessons[0].steps[1].answer);
  // Revision changes must never reinterpret, discard, or silently rescore an earlier attempt.
  const first = original.lessons[0], stepIds = first.steps.map(step => step.id);
  const bump = (base, revision, edit) => { const copy = structuredClone(base); const lesson = copy.lessons[0]; lesson.revision = revision; edit(lesson); return copy; };
  const partial = harness(); await partial.api.load(section, 'test'); partial.api.open(section, first.id, 0); partial.nodes.get('#academy-next').onclick();
  partial.nodes.get('answer-' + (first.steps[1].answer + 1) % first.steps[1].options.length).onclick();
  const before = structuredClone(partial.internal.courses.get(section).progress.lessons[first.id]);
  const revised = bump(original, 2, lesson => {
    lesson.title = 'Revised title'; lesson.steps[0].paragraphs[0] = 'Revised paragraph';
    lesson.steps[1].options.reverse(); lesson.steps[1].answer = 0; lesson.steps[1].explanation = 'Revised explanation';
  });
  const refreshed = harness(partial.saved, revised); await refreshed.api.load(section, 'test'); refreshed.api.open(section, first.id, 1);
  const refreshedRecord = refreshed.internal.courses.get(section).progress.lessons[first.id];
  assert.deepEqual(JSON.parse(JSON.stringify(refreshedRecord)), JSON.parse(JSON.stringify(before)), 'An unfinished attempt keeps its wording, answer meaning and timestamps');
  assert.match(refreshed.html, /Revised title/); assert.match(refreshed.html, /Revised explanation/);
  assert.match(refreshed.html, /Read the revised lesson \(includes answers\)/);
  assert.equal(JSON.parse(refreshed.saved.get(`cs-academy-${section}-v1`)).lessons[first.id].content.revision, 1);
  const reshaped = bump(revised, 3, lesson => { lesson.steps.splice(1, 1); lesson.steps.push({ id: 'inserted-step', kind: 'read', paragraphs: ['Inserted step'] }); });
  const rebuilt = harness(refreshed.saved, reshaped); await rebuilt.api.load(section, 'test'); rebuilt.api.open(section, first.id, 1);
  const rebuiltRecord = rebuilt.internal.courses.get(section).progress.lessons[first.id];
  assert.deepEqual(JSON.parse(JSON.stringify(rebuiltRecord)), JSON.parse(JSON.stringify(before)), 'Removing an authored step does not erase its saved answer');
  assert.match(rebuilt.html, /Inserted step/); assert.match(rebuilt.html, /Your first answer/);
  assert.ok(rebuilt.internal.validRecord(rebuiltRecord));
  const snapshot = harness(h.saved, revised); await snapshot.api.load(section, 'test'); snapshot.api.open(section, first.id, 1);
  const snapshotRecord = snapshot.internal.courses.get(section).progress.lessons[first.id];
  assert.equal(snapshotRecord.content.revision, 1, 'A completed lesson keeps its snapshot');
  assert.equal(snapshotRecord.content.steps[1].answer, first.steps[1].answer);
  assert.ok(snapshot.html.includes(first.steps[1].explanation)); assert.match(snapshot.html, /revised since you started/);
  assert.match(snapshot.html, /Revised explanation/); assert.doesNotMatch(snapshot.html, /<h1>Revised title/);
  snapshot.api.open(section, first.id, 0); assert.match(snapshot.html, /Revised paragraph/, 'Current teaching is accessible from any saved step');
  const damaged = structuredClone(existing); damaged.steps[damaged.content.steps[1].id].selected = 99;
  assert.equal(reload.internal.validRecord(damaged), false);
  const bad = harness(new Map([[`cs-academy-${section}-v1`, JSON.stringify({ lessons: { bad: damaged } })]]));
  await bad.api.load(section, 'test'); assert.equal(bad.invalid, 1); assert.equal(bad.writes, 0);
  const regional = original.lessons.find(lesson => lesson.steps[0].views);
  if (regional) {
    const badLesson = structuredClone(regional); badLesson.steps[0].views[0].rows[0].relation = '';
    assert.equal(h.internal.validLesson(badLesson), false);
    const badView = structuredClone(course.progress.lessons[regional.id]); badView.steps[regional.steps[0].id].view = 'missing';
    assert.equal(h.internal.validRecord(badView), false);
    const update = structuredClone(original); update.lessons.find(lesson => lesson.id === regional.id).steps[0].views[0].title = 'Revised after this session';
    const viewReload = harness(h.saved, update); await viewReload.api.load(section, 'test'); viewReload.api.open(section, regional.id, 0);
    assert.doesNotMatch(viewReload.html, /Revised after this session/);
    assert.match(viewReload.html, /aria-pressed="true"/);
  }
  const comparison = original.lessons.find(lesson=>lesson.steps.some(step=>step.table));
  if(comparison) {
    const stepIndex=comparison.steps.findIndex(step=>step.table);
    const update=structuredClone(original);update.lessons.find(lesson=>lesson.id===comparison.id).steps[stepIndex].table.rows[0][1]='Changed after completion';
    const tableReload=harness(h.saved,update);await tableReload.api.load(section,'test');tableReload.api.open(section,comparison.id,stepIndex);
    assert.doesNotMatch(tableReload.html,/Changed after completion/);
    const damagedTable=structuredClone(comparison);damagedTable.steps[stepIndex].table.rows[0].pop();
    assert.equal(h.internal.validLesson(damagedTable),false,'A comparison cannot silently drop a cell');
    const later = original.lessons[original.lessons.indexOf(comparison)+1];
    tableReload.api.open(section,comparison.id,comparison.steps.length-1);tableReload.nodes.get('#academy-next').onclick();tableReload.nodes.get('#academy-next-lesson').onclick();
    assert.match(tableReload.html,new RegExp(later.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    for(const lesson of original.lessons.filter(lesson=>lesson.group!=='physiology')) {
      assert.equal(lesson.review.status,'pending');assert.equal(lesson.review.reviewer,null);assert.equal(lesson.review.reviewedAt,null);
      assert.equal(lesson.steps.filter(step=>step.kind==='check').length,3);assert.ok(lesson.sourceCheckedOn);
    }
  }
  console.log(`${original.lessons.length} authored lessons: required-step gates, immutable first answers, frozen completed content, revision disclosure, in-place feedback focus, written work, idempotent completion, saved relationship views, reload compatibility and corrupt-record protection passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
