/* The reacting patient: every authored reaction layer is played through the real screens (jsdom, real
   StudyStorage) on its safest and on its worst path. Checks the clock, the patient, the resident's
   step-in and the debrief. Layout and motion are covered by scripts/smoke-clinical-reacting.mjs. */
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  vm = require('node:vm'),
  { JSDOM } = require('jsdom');
const KEY = 'cs-clinical-shift-v1',
  pause = () => new Promise(resolve => setImmediate(resolve));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const pilot = read('data/clinical-shift-pilot.json');
const banks = Object.fromEntries(pilot.rotations.map(rotation => [rotation.key, read(`data/${rotation.key}.json`)]));
const reacting = Object.keys(pilot.reactions || {}).map(id => {
  const rotation = pilot.rotations.find(item => item.caseIds.includes(id));
  return { id, rotation, caseData: banks[rotation.key].cases.find(c => c.id === id), reaction: pilot.reactions[id] };
});
const STATUS = {
  better: 'Improving',
  stable: 'Stable for now',
  unstable: 'Unstable',
  worse: 'Getting worse',
  critical: 'Critical',
};
const expose = source =>
  source.replace(
    'window.renderClinicalShift = renderClinicalShift;',
    'window.testShift={reactionUsable,activeIsCompatible,newActiveShift,shiftTimeline,applyDecisionOutcome,applyResidentFix,setManifest:value=>shiftManifest=value,setSession:value=>shiftSession=value}; window.renderClinicalShift = renderClinicalShift;'
  );

function harness({ manifest = pilot, seed = null } = {}) {
  const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', {
    url: 'http://localhost/practice',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window,
    ctx = dom.getInternalVMContext(),
    errors = [];
  if (seed) w.localStorage.setItem(KEY, seed);
  w.addEventListener('error', event => {
    errors.push(event.error);
    event.preventDefault();
  });
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  w.el = html => {
    const template = w.document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  };
  w.esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  w.topbar = () => w.el('<header>Clinical Scenarios</header>');
  w.setView = root => w.document.querySelector('#app').replaceChildren(root);
  w.store = { progress: {}, cases: {}, history: [], streak: {} };
  w.stopTimer = () => {};
  w.session = null;
  w.LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  w.NAME_BY_KEY = Object.fromEntries(pilot.rotations.map(rotation => [rotation.key, rotation.name]));
  w.renderClinicalCaseBank = () => {};
  w.renderReview = () => {};
  w.ClinicalLongitudinal = { entry: async () => {}, open() {} };
  w.CortexProgress = { OWNER: 'test-owner' };
  w.sectionUrl = key => '/' + key;
  w.fetch = async () => ({ ok: true, json: async () => structuredClone(manifest) });
  w.loadSpecialty = async key => structuredClone(banks[key]);
  vm.runInContext(fs.readFileSync('study-storage.js', 'utf8'), ctx);
  vm.runInContext(expose(fs.readFileSync('clinical-shift.js', 'utf8')), ctx);
  const find = selector => w.document.querySelector(selector),
    all = selector => [...w.document.querySelectorAll(selector)];
  const text = selector => {
    const node = find(selector);
    assert.ok(node, 'Missing ' + selector);
    return node.textContent.replace(/\s+/g, ' ').trim();
  };
  return {
    w,
    find,
    all,
    text,
    errors,
    click(selector) {
      const node = find(selector);
      assert.ok(node, 'Missing ' + selector);
      assert.equal(node.disabled, false, selector + ' is disabled');
      node.click();
      assert.equal(errors.length, 0, errors[0]?.stack);
    },
    type(selector, value) {
      const node = find(selector);
      assert.ok(node, 'Missing ' + selector);
      node.value = value;
      node.dispatchEvent(new w.Event('input', { bubbles: true }));
    },
    clock: () => Number(find('#cshift-clock').dataset.minutes),
    state: () => JSON.parse(w.localStorage.getItem(KEY)),
    raw: () => w.localStorage.getItem(KEY),
    close: () => w.close(),
  };
}

/* What the authored data says should happen on a path, worked out independently of the engine. */
function expectedRun({ caseData, reaction }, pick) {
  const questions = caseData.stages
    .map((stage, index) => ({ stage, index }))
    .filter(({ stage }) => stage.type === 'question' && stage.label !== 'DIAGNOSIS');
  const inquiries = pilot.investigations[caseData.id].interview.length + pilot.investigations[caseData.id].exam.length;
  let clock = 2 * inquiries,
    status = reaction.start?.status || 'stable';
  const vitals = { ...caseData.vitals },
    steps = [];
  let delays = 0,
    nearMisses = 0,
    minutesLost = 0,
    events = 0;
  for (const { stage, index } of questions) {
    const decision = reaction.decisions[index],
      choice = pick(stage, decision),
      outcome = decision.outcomes[choice],
      safe = decision.outcomes[stage.answer];
    const apply = result => {
      clock += result.minutes;
      Object.assign(vitals, result.vitals || {});
      if (result.status) status = result.status;
    };
    apply(outcome);
    events++;
    const afterCall = { clock, status, vitals: { ...vitals } };
    if (choice !== stage.answer) {
      if (outcome.kind === 'delay') delays++;
      else nearMisses++;
      minutesLost += outcome.minutes;
      apply(safe);
      events++;
    }
    steps.push({ index, stage, decision, choice, outcome, afterCall, afterFix: { clock, status } });
  }
  return { steps, clock, status, delays, nearMisses, minutesLost, events, startClock: 2 * inquiries };
}

const safest = stage => stage.answer;
/* The most harmful option on offer: a delay if there is one, otherwise the first near miss. */
const worst = (stage, decision) => {
  const delay = decision.outcomes.findIndex(outcome => outcome.kind === 'delay');
  return delay >= 0 ? delay : decision.outcomes.findIndex(outcome => outcome.kind === 'near-miss');
};

async function play(h, entry, pick, { resumeAtBeat = false } = {}) {
  const { id, rotation, caseData, reaction } = entry;
  const want = expectedRun(entry, pick);
  await h.w.startClinicalShift(rotation.key, { caseId: id });
  await pause();
  // handoff: the resident speaks, the monitor shows the arrival vitals, the clock has not started
  assert.ok(h.find('.cshift-handoff'), 'handoff renders');
  assert.equal(h.state().active.caseId, id);
  assert.ok(h.state().active.content.reactions, 'the reaction layer is frozen into the encounter');
  assert.equal(h.text('.cshift-handoff .cshift-resident p'), reaction.handoff);
  assert.equal(h.text('.cshift-monitor-status'), STATUS[reaction.start?.status || 'stable']);
  assert.equal(h.all('.cshift-vitals > div').length, Object.keys(caseData.vitals).length);
  assert.equal(h.clock(), 0);
  assert.ok(!h.text('.cshift-handoff').includes(caseData.diagnosis), 'no diagnosis at the handoff');
  h.click('#cshift-open-chart');
  // investigating: plain wording, findings hidden until asked, two minutes each
  const plain = reaction.investigation;
  assert.deepEqual(
    h.all('[data-cshift-investigation="interview"] strong').map(node => node.textContent),
    plain.interview.map(item => item.prompt)
  );
  assert.ok(!h.text('.cshift-two-col').includes(plain.interview[0].finding));
  let asked = 0;
  for (const kind of ['interview', 'exam'])
    for (let index = 0; index < plain[kind].length; index++) {
      h.click(`[data-cshift-investigation="${kind}"][data-cshift-index="${index}"]`);
      assert.equal(h.clock(), 2 * ++asked);
      assert.ok(h.text('.cshift-chart').includes(plain[kind][index].finding), 'the answer is filed in the chart');
    }
  assert.equal(h.clock(), want.startClock);
  h.click('#cshift-begin-reasoning');

  let differentialSeen = false;
  const differential = () => {
    const stage = caseData.stages.find(item => item.label === 'DIAGNOSIS');
    assert.equal(h.text('.cshift-task h1'), reaction.differential.question);
    assert.deepEqual(
      h
        .all('.cshift-dx-option strong')
        .map(node => node.textContent)
        .sort(),
      [...reaction.differential.options].sort()
    );
    for (const result of Object.values(reaction.results))
      assert.ok(
        h.text('.cshift-evidence').includes(result.content.replace(/\s+/g, ' ')),
        'the plain report is in front of the question'
      );
    assert.ok(!h.text('.cshift-task').includes(reaction.differential.reveal), 'no reveal before the answer is locked');
    h.click(`.cshift-dx-option[data-cshift-dx="${stage.answer}"]`);
    h.type('#cshift-rationale', 'Because the report in the chart points to it.');
    h.click('#cshift-lock-differential');
    assert.ok(h.text('.cshift-beat .cshift-resident p').startsWith('Yes. ' + reaction.differential.reveal));
    h.click('#cshift-next-stage');
    differentialSeen = true;
  };

  for (const [number, step] of want.steps.entries()) {
    if (h.find('.cshift-dx-list')) differential();
    const { decision, outcome, choice, stage } = step;
    // the call: plain wording, nothing about correctness yet
    assert.equal(h.text('.cshift-task .label'), `Decision ${number + 1} of ${want.steps.length}`);
    assert.equal(h.text('.cshift-task .cshift-resident p'), decision.resident);
    assert.equal(h.text('.cshift-task h1'), decision.question);
    assert.deepEqual(
      h
        .all('.cshift-option strong')
        .map(node => node.textContent)
        .sort(),
      [...decision.options].sort()
    );
    assert.doesNotMatch(h.text('.cshift-task'), /Safe call|Unsafe delay|Near miss|steps in/);
    assert.equal(h.find('#cshift-lock-decision').disabled, true);
    const before = h.clock();
    h.click(`.cshift-option[data-cshift-choice="${choice}"]`);
    h.click('#cshift-lock-decision');
    // what happens next
    assert.ok(h.find(`.cshift-beat.is-${outcome.kind}`), 'the outcome of this option is shown');
    assert.equal(
      h.text('.cshift-beat-time'),
      `${outcome.minutes} ${outcome.minutes === 1 ? 'minute' : 'minutes'} later`
    );
    assert.equal(h.text('.cshift-beat-story p'), outcome.story);
    assert.ok(h.text('.cshift-beat-story span').endsWith(decision.options[choice]));
    assert.equal(h.text('.cshift-beat .cshift-resident p'), outcome.reply);
    assert.equal(
      h.text('.cshift-beat .cshift-resident > div > span'),
      choice === stage.answer ? 'Resident' : 'Resident steps in'
    );
    assert.match(
      h.text('.cshift-verdict'),
      { safe: /^Safe call · \d+ minutes? used$/, 'near-miss': /^Near miss/, delay: /^Unsafe delay/ }[outcome.kind]
    );
    assert.equal(h.text('#cshift-next-stage'), `${choice === stage.answer ? 'Continue' : decision.fix} →`);
    assert.equal(h.clock(), before + outcome.minutes);
    assert.equal(h.clock(), step.afterCall.clock);
    assert.equal(h.text('.cshift-monitor-status'), STATUS[step.afterCall.status]);
    for (const [key, value] of Object.entries(outcome.vitals || {}))
      assert.ok(
        h.text('.cshift-vitals').includes(value.match(/^[\d./]+%?/)[0]),
        `${key} on the monitor follows the outcome`
      );
    if (outcome.alarm) assert.equal(h.text('.cshift-monitor-alarm'), outcome.alarm);
    assert.equal(h.find('.cshift-option'), null, 'a locked call offers no second choice');
    if (resumeAtBeat) {
      // leaving and reopening on the outcome must not charge the time or the harm twice
      const saved = h.raw();
      h.click('#cshift-exit');
      await pause();
      h.click('#cshift-resume');
      await pause();
      assert.ok(h.find(`.cshift-beat.is-${outcome.kind}`));
      assert.equal(h.clock(), step.afterCall.clock);
      assert.equal(h.raw(), saved);
    }
    h.click('#cshift-next-stage');
    const state = h.state().active;
    assert.equal(state.clock, step.afterFix.clock, 'the resident’s safe call takes its own time');
    assert.equal(state.patient.status, step.afterFix.status);
    assert.equal(state.events.filter(event => event.stage === step.index).length, choice === stage.answer ? 1 : 2);
  }
  if (h.find('.cshift-dx-list')) differential();
  assert.ok(differentialSeen, 'the diagnosis question was asked');

  // the note
  assert.equal(h.find('#cshift-reveal-note').disabled, true);
  assert.equal(h.find('.cshift-model-note'), null);
  h.type('#cshift-assessment', 'A patient with a serious problem that we found and treated in time today.');
  h.type('#cshift-plan', 'The team has started treatment and the specialists are taking over from here.');
  h.click('#cshift-reveal-note');
  assert.ok(h.text('.cshift-note-review-stage').includes(pilot.modelNotes[id].assessment));
  assert.doesNotMatch(h.text('.cshift-note-review-stage'), /model/i);
  h.click('#cshift-finish-note');

  // the debrief
  assert.ok(h.find('.cshift-debrief.cshift-debrief-ward'), 'the reacting debrief renders');
  const state = h.state(),
    active = state.active;
  assert.equal(h.text('.cshift-debrief-hero h1'), reaction.title.replace(/_/g, ''));
  assert.equal(h.text('.cshift-outcome strong'), reaction.ending[want.status] || reaction.ending.stable);
  assert.equal(h.clock(), want.clock);
  assert.equal(active.clock, want.clock);
  assert.equal(active.events.length, want.events);
  assert.deepEqual(
    {
      delays: active.scores.safety.delays,
      nearMisses: active.scores.safety.nearMisses,
      minutesLost: active.scores.safety.minutesLost,
      minutes: active.scores.safety.minutes,
      status: active.scores.safety.status,
    },
    {
      delays: want.delays,
      nearMisses: want.nearMisses,
      minutesLost: want.minutesLost,
      minutes: want.clock,
      status: want.status,
    }
  );
  assert.equal(h.all('.cshift-events > li').length, want.events);
  assert.equal(h.all('.cshift-domain-grid > article').length, 6);
  const safetyTile = h.text('.cshift-domain-grid > article:first-child');
  assert.match(
    safetyTile,
    want.delays
      ? new RegExp(`^Patient safety${want.delays} unsafe delay`)
      : want.nearMisses
        ? new RegExp(`^Patient safety${want.nearMisses} near miss`)
        : /^Patient safetyNo unsafe calls/
  );
  assert.doesNotMatch(h.text('.cshift-debrief'), /Not assessed/);
  const segments = h.w.testShift.shiftTimeline(structuredClone(active)).segments;
  assert.equal(h.all('.cshift-timebar > i').length, segments.length);
  assert.equal(segments[0].from, 0);
  assert.equal(segments.at(-1).to, want.clock);
  assert.equal(segments.at(-1).status, want.status);
  assert.equal(
    segments.reduce((sum, segment) => sum + (segment.to - segment.from), 0),
    want.clock,
    'the timeline accounts for every minute once'
  );
  assert.deepEqual(
    h.all('.cshift-science article a').map(node => node.getAttribute('href')),
    reaction.science.filter(item => item.lesson).map(item => `/mcat?view=course&unit=${item.lesson}`)
  );
  assert.equal(h.all('.cshift-review-card').length, want.steps.length);
  assert.equal(h.all('.cshift-review-card.correct').length, want.steps.length - want.delays - want.nearMisses);
  assert.ok(h.text('.cshift-debrief').includes(caseData.diagnosis), 'the clinical diagnosis is still given');
  assert.ok(h.text('.cshift-debrief').includes('Independent clinician review remains pending'));
  for (const source of reaction.sources) assert.ok(h.find(`.cshift-debrief a[href="${source.url}"]`), source.url);
  assert.equal(state.completed[id].attempts, 1);
  assert.equal(state.history[0].encounter.runId, active.runId);
  assert.equal(h.find('.cshift-debrief textarea'), null);
  return { want, runId: active.runId };
}

test('there is at least one reacting patient and each one lines up with its case', () => {
  assert.ok(reacting.length >= 1);
  const h = harness();
  h.w.testShift.setManifest(structuredClone(pilot));
  for (const { caseData, reaction, rotation } of reacting) {
    const usable = h.w.testShift.reactionUsable;
    assert.equal(usable(caseData, reaction), true);
    const active = h.w.testShift.newActiveShift(rotation, caseData);
    assert.notEqual(active.content.reactions, reaction, 'frozen copy, not the live manifest');
    assert.deepEqual(JSON.parse(JSON.stringify(active.content.reactions)), reaction);
    assert.equal(active.clock, 0);
    assert.equal(h.w.testShift.activeIsCompatible(active, caseData), true);
    const key = Object.keys(reaction.decisions)[0],
      answer = caseData.stages[key].answer,
      other = (answer + 1) % caseData.stages[key].options.length;
    for (const damage of [
      r => {
        r.decisions[key].outcomes[answer].kind = 'delay';
      },
      r => {
        r.decisions[key].outcomes[other].kind = 'safe';
      },
      r => r.decisions[key].outcomes.pop(),
      r => r.decisions[key].options.pop(),
      r => {
        r.decisions[key].outcomes[other].minutes = 2.5;
      },
      r => {
        r.decisions[key].outcomes[other].vitals = { Mood: 'low' };
      },
      r => {
        r.decisions[key].outcomes[other].status = 'doomed';
      },
      r => delete r.decisions[key],
      r => r.differential.options.pop(),
    ]) {
      const broken = structuredClone(reaction);
      damage(broken);
      assert.equal(usable(caseData, broken), false, damage.toString());
      // a saved encounter carrying a damaged layer is refused rather than rendered
      const tampered = structuredClone(active);
      tampered.content.reactions = broken;
      assert.equal(h.w.testShift.activeIsCompatible(tampered, caseData), false);
    }
    for (const damage of [
      a => {
        a.clock = -5;
      },
      a => {
        a.clock = 'soon';
      },
      a => {
        a.patient.status = 'doomed';
      },
      a => {
        a.patient = null;
      },
      a => {
        a.events = [{ type: 'decision', stage: 1, choice: 0, kind: 'safe', minutes: 1, at: 0, status: 'stable' }];
      },
      a => {
        a.events = [{ type: 'decision', stage: 0, choice: 99, kind: 'safe', minutes: 1, at: 0, status: 'stable' }];
      },
      a => {
        a.events = [{ type: 'decision', stage: 0, choice: 0, kind: 'lucky', minutes: 1, at: 0, status: 'stable' }];
      },
    ]) {
      const broken = structuredClone(active);
      damage(broken);
      assert.equal(h.w.testShift.activeIsCompatible(broken, caseData), false, damage.toString());
    }
    // a call is charged once, and the resident's safe call follows an unsafe one exactly once
    const run = h.w.testShift.newActiveShift(rotation, caseData),
      decision = reaction.decisions[key];
    h.w.testShift.setSession({ rotation, caseData, active: run });
    h.w.testShift.applyDecisionOutcome(Number(key), other);
    h.w.testShift.applyDecisionOutcome(Number(key), other);
    assert.equal(run.clock, decision.outcomes[other].minutes);
    assert.equal(run.events.length, 1);
    h.w.testShift.applyResidentFix(Number(key));
    h.w.testShift.applyResidentFix(Number(key));
    assert.equal(run.clock, decision.outcomes[other].minutes + decision.outcomes[answer].minutes);
    assert.equal(run.events.map(event => event.type).join(), 'decision,fix');
    const clean = h.w.testShift.newActiveShift(rotation, caseData);
    h.w.testShift.setSession({ rotation, caseData, active: clean });
    h.w.testShift.applyDecisionOutcome(Number(key), answer);
    h.w.testShift.applyResidentFix(Number(key));
    assert.equal(clean.clock, decision.outcomes[answer].minutes, 'a safe call needs no step-in');
    assert.equal(clean.events.length, 1);
    h.w.testShift.setSession(null);
    // an encounter saved before reacting patients existed has none of these fields and still opens
    const legacy = structuredClone(active);
    for (const field of ['clock', 'events', 'patient']) delete legacy[field];
    delete legacy.content.reactions;
    assert.equal(h.w.testShift.activeIsCompatible(legacy, caseData), true);
  }
  h.close();
});

for (const entry of reacting) {
  test(`${entry.id}: every safe call keeps the patient where the author left them and loses no time`, async () => {
    const h = harness();
    await h.w.renderClinicalShift();
    const { want } = await play(h, entry, safest);
    assert.equal(want.delays + want.nearMisses, 0);
    assert.match(h.text('.cshift-timeline h2'), /Every call was safe/);
    assert.equal(h.all('.cshift-chip.is-fix').length, 0);
    assert.equal(h.state().active.scores.decisions, 45);
    h.close();
  });

  test(`${entry.id}: unsafe calls cost time, change the patient, and the resident steps in once`, async () => {
    const h = harness();
    await h.w.renderClinicalShift();
    const { want, runId } = await play(h, entry, worst, { resumeAtBeat: true });
    assert.ok(want.delays + want.nearMisses === want.steps.length, 'every call on this path was unsafe');
    assert.equal(h.all('.cshift-chip.is-fix').length, want.steps.length);
    assert.equal(h.state().active.scores.decisions, 0);
    assert.doesNotMatch(h.text('.cshift-timeline h2'), /Every call was safe/);
    assert.ok(want.clock > expectedRun(entry, safest).clock, 'the unsafe path takes longer');

    // the saved record replays the same debrief without writing anything
    const saved = h.raw();
    h.w.openClinicalShiftHistory({ runId });
    await pause();
    assert.ok(h.find('.cshift-debrief.cshift-debrief-ward'));
    assert.equal(h.all('.cshift-events > li').length, want.events);
    assert.equal(h.find('#cshift-replay'), null);
    assert.ok(h.find('.cshift-saved-chart .cshift-chart'));
    assert.equal(h.raw(), saved);
    h.click('#cshift-exit');
    await pause();
    assert.ok(h.text('.cshift-history-list').includes(entry.reaction.title.replace(/_/g, '')));
    h.close();
  });

  test(`${entry.id}: the same patient can be replayed from the debrief with a fresh clock`, async () => {
    const h = harness();
    await h.w.renderClinicalShift();
    const { runId } = await play(h, entry, safest);
    h.click('#cshift-replay');
    await pause();
    await pause();
    const active = h.state().active;
    assert.ok(h.find('.cshift-handoff'));
    assert.equal(active.caseId, entry.id);
    assert.notEqual(active.runId, runId);
    assert.equal(active.clock, 0);
    assert.deepEqual(active.events, []);
    assert.equal(active.patient.status, entry.reaction.start?.status || 'stable');
    assert.equal(h.state().history.length, 1, 'the finished run stays in the saved shifts');
    h.close();
  });
}

test('a reaction layer that has drifted from its case is ignored and the classic encounter runs', async () => {
  const entry = reacting[0];
  const manifest = structuredClone(pilot);
  const decision = Object.values(manifest.reactions[entry.id].decisions)[0];
  [decision.outcomes[0], decision.outcomes[1]] = [decision.outcomes[1], decision.outcomes[0]];
  const h = harness({ manifest });
  await h.w.renderClinicalShift();
  await h.w.startClinicalShift(entry.rotation.key, { caseId: entry.id });
  await pause();
  assert.equal(h.state().active.content.reactions, null);
  assert.equal(h.text('.cshift-handoff .label'), 'New patient handoff');
  assert.equal(h.find('#cshift-clock'), null);
  assert.equal(h.text('.cshift-monitor-status'), 'On arrival');
  assert.equal(h.find('.cshift-resident'), null);
  h.close();
});

test('a rotation hands out its reacting patients before its classic ones', async () => {
  const entry = reacting[0];
  const h = harness();
  h.w.Math.random = () => 0.999;
  await h.w.renderClinicalShift();
  const tag = h.text(`[data-shift-specialty="${entry.rotation.key}"] .cshift-rotation-tag`);
  const count = entry.rotation.caseIds.filter(id => pilot.reactions[id]).length;
  assert.equal(
    tag,
    count === entry.rotation.caseIds.length
      ? 'The patient reacts to your calls'
      : `${count} of ${entry.rotation.caseIds.length} patients react to your calls so far`
  );
  h.click(`[data-shift-specialty="${entry.rotation.key}"]`);
  await pause();
  await pause();
  assert.ok(pilot.reactions[h.state().active.caseId], 'the first patient assigned is a reacting one');
  h.close();
});
