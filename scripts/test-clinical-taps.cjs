/* Every step of a shift is one tap. Each classic encounter is played through the real screens (jsdom, real
   StudyStorage) with every call right and with every call wrong: a tap answers a question and the next one
   opens, nothing is typed, and the last call leads to the debrief. Also checks the hold that keeps a stray
   second tap from answering the next question, the optional notepad, the hub's wording, and that an
   encounter saved on a screen that no longer exists picks up where it was. Reacting patients are covered
   by scripts/test-clinical-reactions.cjs; layout by scripts/smoke-clinical-shift.mjs. */
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { pause, pilot, encounters, harness, holdMs, assertTapOnly, flat } = require('./clinical-shift-harness.cjs');
const classic = encounters.filter(entry => !entry.reaction);
const NOTES_MAX = 4000;
const questionsOf = caseData =>
  caseData.stages.map((stage, index) => ({ stage, index })).filter(({ stage }) => stage.type === 'question');
const isDiagnosis = stage => stage.label === 'DIAGNOSIS';
const keyed = stage => stage.answer;
const wrong = stage => (stage.answer + 1) % stage.options.length;
const labels = h => h.all('.cshift-debrief .label').map(node => flat(node.textContent));

/* Answers the question on screen with one tap and checks that the shift moved straight on. */
function answer(h, caseData, { stage, index }, choice) {
  const questions = questionsOf(caseData),
    n = questions.findIndex(question => question.index === index);
  assertTapOnly(h, `${caseData.id} question ${n + 1}`);
  assert.equal(h.state().active.stageCursor, index);
  assert.equal(h.find('.cshift-task').dataset.cshiftKind, isDiagnosis(stage) ? 'diagnosis' : 'decision');
  assert.equal(
    h.text('.cshift-task .label'),
    `Question ${n + 1} of ${questions.length} · ${isDiagnosis(stage) ? 'Diagnosis' : flat(stage.label)}`
  );
  assert.equal(h.text('.cshift-task h1'), flat(stage.question));
  assert.deepEqual(
    h
      .all('.cshift-option strong')
      .map(node => flat(node.textContent))
      .sort(),
    stage.options.map(flat).sort()
  );
  // nothing says whether an earlier call was right, and nothing waits to be confirmed
  assert.doesNotMatch(h.text('.cshift-task'), /Sound decision|Needs review|Best choice|Final diagnosis/);
  assert.equal(h.find('#cshift-next-stage'), null);
  // every report reached so far is in front of the question
  const reports = caseData.stages.slice(0, index).filter(item => item.type === 'result');
  assert.equal(!!h.find('.cshift-evidence'), reports.length > 0);
  for (const report of reports) assert.ok(h.text('.cshift-evidence').includes(flat(report.content)));
  h.click(`.cshift-option[data-cshift-choice="${choice}"]`);
  const active = h.state().active;
  if (isDiagnosis(stage)) {
    assert.deepEqual(active.differential.ranked, [choice]);
    assert.ok(active.differential.lockedAt);
    assert.equal(active.differential.stageIndex, index);
  } else assert.equal(active.locks[index].choice, choice);
  const next = questions[n + 1];
  if (next) {
    // straight on to the next question, with this call filed in the chart
    assert.equal(active.stageCursor, next.index);
    assert.equal(h.text('.cshift-task h1'), flat(next.stage.question));
    assert.ok(h.text('.cshift-chart').includes(`Your call: ${flat(stage.options[choice])}`));
  }
  return choice;
}

async function start(h, { id, rotation }) {
  await h.w.renderClinicalShift();
  await h.w.startClinicalShift(rotation.key, { caseId: id });
  await pause();
  assert.ok(h.find('.cshift-handoff'), 'handoff renders');
  assert.equal(h.state().active.caseId, id);
}

async function play(h, entry, pick, { ask = true, notes = '' } = {}) {
  const { id, rotation, caseData } = entry;
  await start(h, entry);
  assert.equal(h.state().active.content.reactions, null, 'a classic encounter');
  assertTapOnly(h, `${id} handoff`);
  assert.equal(h.find('.cshift-notepad'), null, 'nothing to note at the handoff');
  h.click('#cshift-open-chart');
  assertTapOnly(h, `${id} investigation`);
  const investigation = pilot.investigations[id];
  if (ask)
    for (const kind of ['interview', 'exam'])
      for (let index = 0; index < investigation[kind].length; index++)
        h.click(`[data-cshift-investigation="${kind}"][data-cshift-index="${index}"]`);
  if (notes) {
    h.notepad(true);
    h.type('#cshift-notes', notes);
  }
  const kept = notes.slice(0, NOTES_MAX);
  h.click('#cshift-begin-reasoning');
  const questions = questionsOf(caseData),
    picks = {};
  for (const question of questions) {
    assert.equal(h.find('#cshift-notes').value, kept);
    assert.equal(h.find('.cshift-notepad').open, !!notes);
    picks[question.index] = answer(h, caseData, question, pick(question.stage));
  }

  // the last call leads straight to the debrief
  assert.ok(h.find('.cshift-debrief'), `${id} debrief renders`);
  assert.equal(h.find('.cshift-debrief-ward'), null);
  assert.equal(h.find('textarea, input, .cshift-notepad, .cshift-option'), null);
  assert.deepEqual(
    h.all('.cshift-stepper li').map(node => node.className.trim()),
    ['done', 'done', 'done', 'active']
  );
  const state = h.state(),
    active = state.active,
    decisions = questions.filter(({ stage }) => !isDiagnosis(stage)),
    diagnosis = questions.find(({ stage }) => isDiagnosis(stage)),
    right = decisions.filter(({ stage, index }) => picks[index] === stage.answer).length,
    named = picks[diagnosis.index] === diagnosis.stage.answer;
  assert.equal(active.phase, 'debrief');
  assert.ok(active.completedAt);
  assert.equal(Object.keys(active.locks).length, decisions.length);
  // 15 for asking and examining, 25 for the diagnosis, 60 for the decisions; nothing for writing
  const points = [ask ? 15 : 0, named ? 25 : 0, Math.round((60 * right) / decisions.length)];
  assert.deepEqual(
    [active.scores.information, active.scores.reasoning, active.scores.decisions, active.scores.documentation],
    [...points, 0]
  );
  assert.equal(
    active.scores.total,
    points.reduce((sum, value) => sum + value, 0)
  );
  assert.equal(h.text('.cshift-score strong'), String(active.scores.total));
  assert.deepEqual(
    h.all('.cshift-domain-grid > article > span').map(node => node.textContent),
    ['Decisions', 'Diagnosis', 'Investigating']
  );
  const asked = ask ? investigation.interview.length + investigation.exam.length : 0;
  assert.deepEqual(
    h.all('.cshift-domain-grid > article > strong').map(node => node.textContent),
    [
      `${right} of ${decisions.length}`,
      named ? 'Right first time' : 'Missed',
      `${asked} of ${investigation.interview.length + investigation.exam.length}`,
    ]
  );
  assert.deepEqual(labels(h), [
    `Shift debrief · ${rotation.name}`,
    'Final diagnosis',
    'Your diagnosis',
    'Decision review',
    'Example note',
    'Clinical pearls',
    ...(kept.trim() ? ['Your notepad'] : []),
  ]);
  const debrief = h.text('.cshift-debrief');
  assert.ok(debrief.includes(flat(caseData.title)));
  assert.ok(debrief.includes(flat(caseData.diagnosis)));
  // the diagnosis: the pick, the keyed answer, and why
  assert.equal(h.all('.cshift-ranked-review li').length, named ? 1 : 2);
  assert.equal(h.all('.cshift-ranked-review li.correct').length, 1);
  assert.ok(h.text('.cshift-ranked-review li.correct').includes(flat(diagnosis.stage.options[diagnosis.stage.answer])));
  if (!named)
    assert.ok(
      h.text('.cshift-ranked-review li.missed').includes(flat(diagnosis.stage.options[picks[diagnosis.index]]))
    );
  assert.ok(debrief.includes(flat(diagnosis.stage.explanation)));
  // each decision: the call, the best response, and why
  assert.equal(h.all('.cshift-review-card').length, decisions.length);
  assert.equal(h.all('.cshift-review-card.correct').length, right);
  for (const { stage, index } of decisions) {
    assert.ok(debrief.includes(flat(stage.options[picks[index]])));
    assert.ok(debrief.includes(flat(stage.explanation)));
  }
  // the example note is there to read; nothing is set beside it and nothing was written
  assert.ok(h.text('.cshift-clinical-note').includes(flat(pilot.modelNotes[id].assessment)));
  assert.ok(h.text('.cshift-clinical-note').includes(flat(pilot.modelNotes[id].plan)));
  assert.equal(h.find('.cshift-note-comparison, .cshift-debrief blockquote'), null);
  assert.equal(h.all('.cshift-pearls > article').length, caseData.pearls.length);
  assert.ok(debrief.includes('Independent clinician review remains pending'));
  if (kept.trim()) {
    assert.equal(h.find('.cshift-notes-review p').textContent, kept.trim());
    assert.equal(active.notes, kept);
  } else assert.equal(h.find('.cshift-notes-review'), null);
  assert.equal(state.completed[id].attempts, 1);
  assert.equal(state.completed[id].lastScore, active.scores.total);
  assert.equal(state.history[0].encounter.runId, active.runId);
  return { active, picks, questions };
}

test('the hub describes four steps and asks for no writing', async () => {
  const h = harness();
  await h.w.renderClinicalShift();
  assert.equal(h.text('#cshift-how-title'), 'Four steps, one patient at a time.');
  assert.deepEqual(
    h.all('.cshift-how li strong').map(node => node.textContent),
    ['Meet the patient', 'Ask and examine', 'Decide', 'Debrief']
  );
  for (const selector of ['.cshift-ward-hero', '.cshift-how', '.cshift-rotations'])
    assert.doesNotMatch(h.text(selector), /\b(writ(e|ten)|lock(ed)?|notes?|rank)\b/i, selector);
  assert.ok(classic.length >= 1, 'there are classic encounters to play');
  h.close();
});

for (const entry of classic) {
  test(`${entry.id}: one tap answers each question, and every call right is a full score`, async () => {
    const h = harness();
    const { active } = await play(h, entry, keyed);
    assert.equal(active.scores.total, 100);
    h.close();
  });

  test(`${entry.id}: every call wrong earns only the points for asking, and the debrief says why`, async () => {
    const h = harness();
    const { active } = await play(h, entry, wrong);
    assert.equal(active.scores.total, 15);
    assert.equal(active.scores.correct, 0);
    assert.equal(active.scores.diagnosisRank, -1);
    h.close();
  });
}

test('a finished shift reopens from the saved shifts with its calls and without a write', async () => {
  const entry = classic[0];
  const h = harness();
  const { active, picks, questions } = await play(h, entry, wrong, { ask: false, notes: 'Check the potassium first' });
  assert.equal(active.scores.total, 0, 'nothing asked and nothing right');
  const saved = h.raw();
  h.w.openClinicalShiftHistory({ runId: active.runId });
  await pause();
  assert.ok(h.find('.cshift-debrief'));
  assert.equal(h.find('#cshift-next-patient, textarea, input'), null);
  assert.equal(h.find('.cshift-notes-review p').textContent, 'Check the potassium first');
  const chart = h.text('.cshift-saved-chart');
  for (const { stage, index } of questions)
    assert.ok(chart.includes(`Your call: ${flat(stage.options[picks[index]])}`));
  assert.equal(h.raw(), saved);
  h.close();
});

test('the notepad is optional, keeps what is written, and is never scored', async () => {
  const entry = classic[0];
  const scores = [];
  // the same shift three times: no notes, a note longer than the notepad holds, and only blank space
  for (const notes of ['', `<img src=x onerror=alert(1)> ${'x'.repeat(NOTES_MAX + 500)}`, ' \n \n']) {
    const h = harness();
    const { active } = await play(h, entry, keyed, { notes });
    assert.equal((active.notes || '').length, Math.min(notes.length, NOTES_MAX));
    assert.equal(h.find('.cshift-debrief img'), null, 'a note is text, never markup');
    scores.push(active.scores);
    h.close();
  }
  assert.deepEqual(scores[1], scores[0]);
  assert.deepEqual(scores[2], scores[0]);

  // its title bar says whether there is anything in it, and blank space is nothing
  const h = harness();
  await start(h, entry);
  h.click('#cshift-open-chart');
  assert.equal(h.text('.cshift-notepad summary'), 'notepad · optional');
  assert.equal(h.find('#cshift-notes').getAttribute('maxlength'), String(NOTES_MAX));
  h.notepad(true);
  h.type('#cshift-notes', '   ');
  assert.equal(h.text('.cshift-notepad summary'), 'notepad · optional');
  h.type('#cshift-notes', 'Potassium 5.9');
  assert.equal(h.text('.cshift-notepad summary'), 'notepad · your notes');
  // closing it keeps the text, and it stays closed on the next screen
  h.notepad(false);
  h.click('#cshift-begin-reasoning');
  assert.equal(h.find('.cshift-notepad').open, false);
  assert.equal(h.find('#cshift-notes').value, 'Potassium 5.9');
  assert.equal(h.text('.cshift-notepad summary'), 'notepad · your notes');
  // leaving and coming back keeps it too
  h.click('#cshift-exit');
  await pause();
  h.click('#cshift-resume');
  await pause();
  assert.equal(h.find('#cshift-notes').value, 'Potassium 5.9');
  h.close();
});

test('a stray second tap cannot answer the next question or skip an outcome', async () => {
  assert.ok(holdMs >= 300 && holdMs <= 1000, 'the hold outlasts a double click without making anyone wait');
  const wake = () => new Promise(resolve => setTimeout(resolve, holdMs + 80));
  const held = h => h.all('.cshift-option').map(button => button.disabled && button.hasAttribute('data-cshift-hold'));
  const answered = h => Object.keys(h.state().active.locks).length + (h.state().active.differential.lockedAt ? 1 : 0);

  const h = harness({ hold: true });
  await start(h, classic[0]);
  h.click('#cshift-open-chart');
  h.click('#cshift-begin-reasoning');
  assert.ok(held(h).length >= 4 && held(h).every(Boolean), 'a question opens with its options inert');
  h.find('.cshift-option').click();
  assert.equal(answered(h), 0, 'a tap inside the hold answers nothing');
  await wake();
  assert.ok(
    h.all('.cshift-option').every(button => !button.disabled),
    'and then the options wake up'
  );
  h.click('.cshift-option');
  assert.equal(answered(h), 1);
  // the next question opened under the same finger: it is inert again
  assert.ok(held(h).every(Boolean));
  h.find('.cshift-option').click();
  assert.equal(answered(h), 1, 'the second tap of a double tap answers nothing');
  await wake();
  h.click('.cshift-option');
  assert.equal(answered(h), 2);
  h.close();

  // a reacting patient: the button that moves on from an outcome is held too
  const entry = encounters.find(item => item.reaction);
  const r = harness({ hold: true });
  await start(r, entry);
  r.click('#cshift-open-chart');
  r.click('#cshift-begin-reasoning');
  assert.ok(held(r).every(Boolean));
  await wake();
  const cursor = r.state().active.stageCursor;
  r.click('.cshift-option');
  const next = r.find('#cshift-next-stage');
  assert.ok(next.disabled && next.hasAttribute('data-cshift-hold'), 'the way on from an outcome opens inert');
  next.click();
  assert.equal(r.state().active.stageCursor, cursor, 'the outcome stays on screen');
  assert.ok(r.find('.cshift-beat'));
  await wake();
  r.click('#cshift-next-stage');
  assert.ok(r.state().active.stageCursor > cursor);
  r.close();
});

/* Encounters begun before every step became a tap can be saved on a screen that no longer exists. */
function begun(entry, change) {
  const source = harness();
  source.w.testShift.setManifest(structuredClone(pilot));
  const active = JSON.parse(JSON.stringify(source.w.testShift.newActiveShift(entry.rotation, entry.caseData)));
  source.close();
  delete active.notes;
  change(active, entry.caseData.stages);
  return active;
}
async function reopen(active) {
  const h = harness({ seed: JSON.stringify({ version: 1, active, completed: {}, history: [] }) });
  h.w.history.pushState({}, '', `/practice?view=shift&run=${active.runId}`);
  await h.w.renderClinicalShift();
  await pause();
  assert.equal(h.errors.length, 0, h.errors[0]?.stack);
  return h;
}
const resultsBefore = (stages, end) =>
  stages.flatMap((stage, index) => (stage.type === 'result' && index < end ? [index] : []));

test('an encounter left on the old write-up step goes to its debrief and keeps what was typed', async () => {
  const entry = classic[0];
  const active = begun(entry, (run, stages) => {
    const dx = stages.findIndex(isDiagnosis);
    run.phase = 'note';
    run.stageCursor = stages.length;
    run.resultsRevealed = resultsBefore(stages, stages.length);
    run.differential = {
      stageIndex: dx,
      ranked: [stages[dx].answer],
      rationale: 'The timing and the scan fit.',
      lockedAt: 5,
    };
    for (const [index, stage] of stages.entries())
      if (stage.type === 'question' && index !== dx) run.locks[index] = { choice: stage.answer, lockedAt: 5 };
    run.note = { assessment: 'A half-written assessment', plan: '', revealedAt: null };
  });
  const h = await reopen(active);
  assert.ok(h.find('.cshift-debrief'));
  assert.equal(h.find('textarea, input'), null);
  assert.equal(h.state().completed[entry.id].attempts, 1);
  assert.equal(h.state().active.scores.total, 85, 'every call right, nothing asked');
  // what was written then is kept and shown, beside the example note
  assert.ok(labels(h).includes('Your note'));
  assert.ok(h.text('.cshift-note-comparison').includes('A half-written assessment'));
  assert.ok(h.text('.cshift-note-comparison').includes(flat(pilot.modelNotes[entry.id].assessment)));
  assert.equal(h.text('.cshift-debrief blockquote'), 'The timing and the scan fit.');
  assert.doesNotMatch(h.text('.cshift-debrief'), /Model note/);
  h.close();
});

test('an encounter resting on an answered question moves on to the next one', async () => {
  const entry = classic[0],
    questions = questionsOf(entry.caseData);
  const active = begun(entry, (run, stages) => {
    run.phase = 'decision';
    run.stageCursor = questions[0].index;
    run.locks[questions[0].index] = { choice: stages[questions[0].index].answer, lockedAt: 5 };
  });
  const h = await reopen(active);
  const resumed = h.state().active;
  assert.equal(resumed.stageCursor, questions[1].index);
  assert.equal(Object.keys(resumed.locks).length, 1);
  assert.deepEqual(resumed.resultsRevealed, resultsBefore(entry.caseData.stages, questions[1].index));
  assert.equal(h.text('.cshift-task h1'), flat(questions[1].stage.question));
  assert.equal(h.find('.cshift-locked, #cshift-next-stage'), null);
  h.close();
});

test('an older three-way differential is kept as it was ranked and the shift carries on', async () => {
  const entry = classic[0],
    questions = questionsOf(entry.caseData),
    dx = questions.findIndex(({ stage }) => isDiagnosis(stage)),
    stage = questions[dx].stage,
    others = stage.options.map((_, index) => index).filter(index => index !== stage.answer);
  const active = begun(entry, (run, stages) => {
    run.phase = 'differential';
    run.stageCursor = questions[dx].index;
    run.resultsRevealed = resultsBefore(stages, questions[dx].index);
    for (const question of questions.slice(0, dx))
      run.locks[question.index] = { choice: question.stage.answer, lockedAt: 5 };
    run.differential = {
      stageIndex: questions[dx].index,
      ranked: [others[0], stage.answer, others[1]],
      rationale: 'Second on my list because of the scan.',
      lockedAt: 5,
    };
  });
  const h = await reopen(active);
  assert.equal(h.state().active.stageCursor, questions[dx + 1].index, 'it opens on the question after the diagnosis');
  for (const question of questions.slice(dx + 1)) answer(h, entry.caseData, question, question.stage.answer);
  assert.ok(h.find('.cshift-debrief'));
  assert.equal(h.all('.cshift-ranked-review li').length, 3);
  assert.equal(h.all('.cshift-ranked-review li.correct').length, 1);
  assert.equal(h.text('.cshift-domain-grid > article:nth-child(2) strong'), 'Ranked #2');
  assert.equal(h.text('.cshift-debrief blockquote'), 'Second on my list because of the scan.');
  assert.equal(h.state().active.scores.reasoning, 0, 'only a first pick earns the diagnosis points');
  assert.equal(h.state().active.scores.decisions, 60);
  h.close();
});

test('a differential that was being ranked becomes one pick', async () => {
  const entry = classic[0],
    questions = questionsOf(entry.caseData),
    dx = questions.findIndex(({ stage }) => isDiagnosis(stage)),
    stage = questions[dx].stage,
    others = stage.options.map((_, index) => index).filter(index => index !== stage.answer);
  const active = begun(entry, (run, stages) => {
    run.phase = 'differential';
    run.stageCursor = questions[dx].index;
    run.resultsRevealed = resultsBefore(stages, questions[dx].index);
    for (const question of questions.slice(0, dx))
      run.locks[question.index] = { choice: question.stage.answer, lockedAt: 5 };
    run.differential = {
      stageIndex: questions[dx].index,
      ranked: others.slice(0, 2),
      rationale: 'draft',
      lockedAt: null,
    };
  });
  const h = await reopen(active);
  answer(h, entry.caseData, questions[dx], stage.answer);
  assert.deepEqual(h.state().active.differential.ranked, [stage.answer]);
  h.close();
});

test('a reacting call that was picked but never confirmed is simply asked again', async () => {
  const entry = encounters.find(item => item.reaction),
    first = questionsOf(entry.caseData)[0];
  const active = begun(entry, run => {
    run.phase = 'decision';
    run.stageCursor = first.index;
    run.drafts[first.index] = wrong(first.stage);
  });
  const h = await reopen(active);
  assert.equal(h.all('.cshift-option').length, first.stage.options.length);
  assert.equal(h.find('.cshift-beat'), null);
  h.click(`.cshift-option[data-cshift-choice="${first.stage.answer}"]`);
  assert.ok(h.find('.cshift-beat.is-safe'));
  assert.deepEqual(h.state().active.drafts, {});
  assert.equal(h.state().active.locks[first.index].choice, first.stage.answer);
  h.close();
});
