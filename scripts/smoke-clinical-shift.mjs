import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const APP_VERSION =
  (readFileSync(new URL('../app.js', import.meta.url), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || '';
const PILOT_STATE_KEY = 'cs-clinical-shift-v1';
const base = new URL(process.env.CORTEX_URL || 'http://localhost:8765/');
const practiceUrl = new URL('practice', base).href;
const pilot = JSON.parse(readFileSync(new URL('../data/clinical-shift-pilot.json', import.meta.url), 'utf8'));
const casesById = new Map(
  pilot.rotations.flatMap(rotation => {
    const specialty = JSON.parse(readFileSync(new URL(`../data/${rotation.key}.json`, import.meta.url), 'utf8'));
    const allowed = new Set(rotation.caseIds);
    return specialty.cases.filter(caseData => allowed.has(caseData.id)).map(caseData => [caseData.id, caseData]);
  })
);
const pilotCaseTitles = [...casesById.values()].map(caseData => caseData.title);
const neurologyRotation = pilot.rotations.find(rotation => rotation.key === 'neurology');
const viewports = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

function fail(message, details) {
  throw new Error(details === undefined ? message : `${message}: ${JSON.stringify(details)}`);
}

async function assertNoHorizontalOverflow(page, viewport, label, overflowChecks) {
  const amount = await page.evaluate(() =>
    Math.max(
      0,
      document.documentElement.scrollWidth - window.innerWidth,
      document.body?.scrollWidth - window.innerWidth || 0
    )
  );
  overflowChecks.push({ label, amount });
  if (amount > 1) fail(`${viewport.name} ${label} has ${amount}px horizontal overflow`);
}

async function readPilotState(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), PILOT_STATE_KEY);
}

async function assertNoCaseSpoilers(page, caseData, label) {
  const bodyText = await page.locator('body').innerText();
  const html = await page.locator('html').innerHTML();
  const leaked = [];
  if (bodyText.includes(caseData.title)) leaked.push('case title');
  if (bodyText.includes(caseData.diagnosis)) leaked.push('final diagnosis');
  if (bodyText.toLowerCase().includes(`${caseData.difficulty.toLowerCase()} case`)) leaked.push('difficulty');
  if (bodyText.includes('Final diagnosis')) leaked.push('final diagnosis label');
  if (html.includes(caseData.id)) leaked.push('case id');
  if (await page.locator('.cshift-debrief, .cshift-diagnosis, .cshift-review-card').count())
    leaked.push('debrief content');
  if (leaked.length) fail(`${label} exposed pre-debrief case spoilers`, leaked);
}

async function assertDelayedFeedback(page, label) {
  const text = await page.locator('.cshift-task').innerText();
  if (/Sound decision|Needs review|Best choice|Final diagnosis/i.test(text)) {
    fail(`${label} exposed correctness before the debrief`, text);
  }
  if (await page.locator('.cshift-review-card, .cshift-diagnosis').count()) {
    fail(`${label} rendered debrief feedback before the debrief`);
  }
}

async function runViewport(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  // serve.py cannot proxy the external visitor counter; keep this content-flow test local.
  await context.route('**/cx-visits/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"value":0}' })
  );
  const pageErrors = [];
  const consoleErrors = [];
  const overflowChecks = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await context.addInitScript(version => {
    localStorage.setItem('cs-seen-ver', version);
    Math.random = () => 0;
  }, APP_VERSION);

  try {
    await page.goto(practiceUrl, { waitUntil: 'networkidle' });
    await page.evaluate(key => localStorage.removeItem(key), PILOT_STATE_KEY);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.cshift-hub', { timeout: 15000 });

    const heading = (await page.locator('.cshift-hub h1').textContent())?.trim();
    const rotationCount = await page.locator('[data-shift-specialty]').count();
    const legacyControlCount = await page.locator('.cs-config, #mixed, .cs-grid').count();
    const hubText = await page.locator('.cshift-hub').innerText();
    const shiftFooterText = await page.locator('.sitefoot .sf-legal').innerText();
    const exposedTitles = pilotCaseTitles.filter(title => hubText.includes(title));
    const howSteps = (await page.locator('.cshift-how li strong').allTextContents()).join(' > ');
    if (
      heading !== 'Start your shift.' ||
      howSteps !== 'Meet the patient > Ask and examine > Decide > Debrief' ||
      rotationCount !== 3 ||
      legacyControlCount !== 0 ||
      exposedTitles.length ||
      !hubText.includes('independent clinician review remains pending') ||
      !shiftFooterText.includes('Not a substitute for official AAMC materials or clinical judgment') ||
      shiftFooterText.includes('independently reviewed')
    ) {
      fail(`${viewport.name} Clinical Shift hub is not specialty-only or honestly disclosed`, {
        heading,
        rotationCount,
        legacyControlCount,
        exposedTitles,
        shiftFooterText,
      });
    }
    await assertNoHorizontalOverflow(page, viewport, 'shift hub', overflowChecks);

    await page.locator('[data-shift-specialty="neurology"]').click();
    await page.waitForSelector('.cshift-handoff', { timeout: 15000 });
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || 'null')?.active?.caseId, PILOT_STATE_KEY);
    const assignedState = await readPilotState(page);
    const caseData = casesById.get(assignedState.active.caseId);
    const caseInvestigation = pilot.investigations[assignedState.active.caseId];
    const caseModelNote = pilot.modelNotes[assignedState.active.caseId];
    if (!caseData || !neurologyRotation.caseIds.includes(caseData.id) || assignedState.active.key !== 'neurology') {
      fail(`${viewport.name} did not receive a hidden Neurology pilot patient`, assignedState.active);
    }
    if (
      !caseInvestigation?.interview?.length ||
      !caseInvestigation?.exam?.length ||
      !caseModelNote?.assessment ||
      !caseModelNote?.plan
    ) {
      fail(`${viewport.name} assigned patient is missing authored investigation or charting content`, caseData.id);
    }
    const handoffText = await page.locator('.cshift-handoff').innerText();
    const normalizedHandoffText = handoffText.toLowerCase();
    const vitalCount = await page.locator('.cshift-vitals > div').count();
    const currentStep = (await page.locator('.cshift-stepper [aria-current="step"] strong').textContent())?.trim();
    if (
      !normalizedHandoffText.includes(caseData.patient.toLowerCase()) ||
      !normalizedHandoffText.includes(caseData.setting.toLowerCase()) ||
      !normalizedHandoffText.includes(caseData.chiefComplaint.toLowerCase()) ||
      vitalCount !== 5 ||
      currentStep !== 'Handoff' ||
      handoffText.includes(caseData.history) ||
      handoffText.includes(caseData.exam)
    ) {
      fail(`${viewport.name} handoff did not reveal exactly the assigned patient summary`, { vitalCount, handoffText });
    }
    await assertNoCaseSpoilers(page, caseData, `${viewport.name} handoff`);
    await assertNoHorizontalOverflow(page, viewport, 'handoff', overflowChecks);

    await page.locator('#cshift-open-chart').click();
    await page.waitForSelector('.cshift-task');
    let investigationText = await page.locator('.cshift-two-col').innerText();
    const interviewChoiceCount = await page.locator('[data-cshift-investigation="interview"]').count();
    const examChoiceCount = await page.locator('[data-cshift-investigation="exam"]').count();
    const authoredFindings = [...caseInvestigation.interview, ...caseInvestigation.exam].map(item => item.finding);
    if (
      interviewChoiceCount !== caseInvestigation.interview.length ||
      examChoiceCount !== caseInvestigation.exam.length ||
      authoredFindings.some(finding => investigationText.includes(finding))
    ) {
      fail(`${viewport.name} investigation choices are missing or revealed findings before selection`, {
        interviewChoiceCount,
        examChoiceCount,
      });
    }
    await assertNoCaseSpoilers(page, caseData, `${viewport.name} investigation`);
    await assertNoHorizontalOverflow(page, viewport, 'investigation', overflowChecks);

    await page.locator('[data-cshift-investigation="interview"][data-cshift-index="0"]').click();
    await page.waitForSelector('[data-cshift-investigation="interview"][data-cshift-index="0"].done');
    investigationText = await page.locator('.cshift-two-col').innerText();
    let savedState = await readPilotState(page);
    if (
      !investigationText.includes(caseInvestigation.interview[0].finding) ||
      caseInvestigation.interview.slice(1).some(item => investigationText.includes(item.finding)) ||
      caseInvestigation.exam.some(item => investigationText.includes(item.finding)) ||
      savedState.active.revealed.interviewItems.join(',') !== '0' ||
      savedState.active.revealed.examItems.length
    ) {
      fail(`${viewport.name} interview answer was not saved independently`, savedState.active.revealed);
    }

    await page.locator('#cshift-exit').click();
    await page.waitForSelector('.cshift-hub');
    if (!(await page.locator('#cshift-resume').isVisible()))
      fail(`${viewport.name} shift did not offer resume after save and exit`);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.cshift-hub');
    if (!(await page.locator('#cshift-resume').isVisible()))
      fail(`${viewport.name} shift resume did not survive a reload`);
    await page.locator('#cshift-resume').click();
    await page.waitForSelector('[data-cshift-investigation="interview"][data-cshift-index="0"].done');
    savedState = await readPilotState(page);
    investigationText = await page.locator('.cshift-two-col').innerText();
    if (
      savedState.active.phase !== 'investigate' ||
      savedState.active.revealed.interviewItems.join(',') !== '0' ||
      savedState.active.revealed.examItems.length ||
      !investigationText.includes(caseInvestigation.interview[0].finding)
    ) {
      fail(`${viewport.name} resumed investigation did not restore its exact state`, savedState.active);
    }
    await assertNoCaseSpoilers(page, caseData, `${viewport.name} resumed investigation`);

    for (let index = 1; index < caseInvestigation.interview.length; index++) {
      await page.locator(`[data-cshift-investigation="interview"][data-cshift-index="${index}"]`).click();
      await page.waitForSelector(`[data-cshift-investigation="interview"][data-cshift-index="${index}"].done`);
    }
    for (let index = 0; index < caseInvestigation.exam.length; index++) {
      await page.locator(`[data-cshift-investigation="exam"][data-cshift-index="${index}"]`).click();
      await page.waitForSelector(`[data-cshift-investigation="exam"][data-cshift-index="${index}"].done`);
    }
    investigationText = await page.locator('.cshift-two-col').innerText();
    savedState = await readPilotState(page);
    if (
      authoredFindings.some(finding => !investigationText.includes(finding)) ||
      savedState.active.revealed.interviewItems.length !== caseInvestigation.interview.length ||
      savedState.active.revealed.examItems.length !== caseInvestigation.exam.length ||
      !savedState.active.revealed.history ||
      !savedState.active.revealed.exam
    ) {
      fail(
        `${viewport.name} completed investigation is missing selected answers or findings`,
        savedState.active.revealed
      );
    }
    await assertNoHorizontalOverflow(page, viewport, 'completed chart review', overflowChecks);

    // the notepad: optional, beside the chart, and what is typed there stays put
    const notes = 'Right pupil smaller\n<b>not bold</b> & recheck';
    const notepad = page.locator('.cshift-notepad');
    if (await notepad.evaluate(node => node.open)) fail(`${viewport.name} notepad did not start closed`);
    await notepad.locator('summary').click();
    await page.locator('#cshift-notes').fill(notes);
    await page.waitForFunction(
      ([key, text]) => JSON.parse(localStorage.getItem(key))?.active?.notes === text,
      [PILOT_STATE_KEY, notes]
    );
    await assertNoHorizontalOverflow(page, viewport, 'open notepad', overflowChecks);
    await page.locator('#cshift-begin-reasoning').click();
    await page.waitForSelector('.cshift-task.is-question');

    // Every question is answered with one tap: nothing to type, nothing to confirm, and no stop on the
    // way to the next one. How each call held up stays hidden until the debrief.
    const questions = caseData.stages.filter(stage => stage.type === 'question');
    const answered = active => Object.keys(active.locks).length + (active.differential.lockedAt ? 1 : 0);
    const waitForAnswer = count =>
      page.waitForFunction(
        ([key, expected]) => {
          const active = JSON.parse(localStorage.getItem(key)).active;
          return Object.keys(active.locks).length + (active.differential.lockedAt ? 1 : 0) === expected;
        },
        [PILOT_STATE_KEY, count]
      );
    let questionCount = 0;
    let diagnosisSeen = false;
    let resumeChecked = false;
    let doubleTapChecked = false;
    let holdChecked = false;
    for (let step = 0; step < 20 && !(await page.locator('.cshift-debrief').count()); step++) {
      const number = questionCount + 1;
      const stage = questions[questionCount];
      const task = page.locator('.cshift-task.is-question');
      await task.waitFor();
      const kind = await task.getAttribute('data-cshift-kind');
      const label = (await task.locator('> .label').textContent()).trim();
      const diagnosis = stage?.label === 'DIAGNOSIS';
      if (
        !stage ||
        kind !== (diagnosis ? 'diagnosis' : 'decision') ||
        label !== `Question ${number} of ${questions.length} · ${diagnosis ? 'Diagnosis' : stage.label}`
      ) {
        fail(`${viewport.name} question ${number} is not the next question of the case`, { kind, label });
      }
      await assertNoCaseSpoilers(page, caseData, `${viewport.name} question ${number}`);
      await assertDelayedFeedback(page, `${viewport.name} question ${number}`);
      const toType = await page.locator('.cshift-task :is(textarea, input)').count();
      const textBoxes = await page.locator('.cshift-workspace :is(textarea, input)').count();
      const toConfirm = await page
        .locator('#cshift-lock-decision, #cshift-lock-differential, #cshift-next-stage, .cshift-locked')
        .count();
      if (toType || textBoxes !== 1 || toConfirm) {
        fail(`${viewport.name} question ${number} asks for more than one tap`, { toType, textBoxes, toConfirm });
      }
      const options = page.locator('.cshift-option');
      if ((await options.count()) < 4) fail(`${viewport.name} question ${number} has fewer than four choices`);
      if (diagnosis) {
        diagnosisSeen = true;
        const evidencePrecedesQuestion = await task.evaluate(node => {
          const evidence = node.querySelector('.cshift-evidence');
          const heading = node.querySelector('h1');
          return (
            !!evidence && !!heading && !!(evidence.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)
          );
        });
        if (!evidencePrecedesQuestion)
          fail(`${viewport.name} chart evidence was not surfaced before the diagnosis question`);
      }
      if ((await page.locator('#cshift-notes').inputValue()) !== notes || !(await notepad.evaluate(node => node.open)))
        fail(`${viewport.name} notepad did not keep its text and stay open at question ${number}`);
      await assertNoHorizontalOverflow(page, viewport, `question ${number}`, overflowChecks);

      if (!holdChecked) {
        // The next question is drawn in the same task as the tap. Its options start inert, so a second
        // tap that lands on them answers nothing; then they wake up.
        await page.waitForSelector('.cshift-option:not(:disabled)');
        const inert = await page.evaluate(() => {
          document.querySelector('.cshift-option').click();
          return [...document.querySelectorAll('.cshift-option')].map(button => button.disabled);
        });
        if (inert.length < 4 || inert.some(disabled => !disabled))
          fail(`${viewport.name} the next question did not open with its options inert`, inert);
        await page.waitForSelector('.cshift-option:not(:disabled)');
        holdChecked = true;
      } else if (!doubleTapChecked) {
        await options.first().dblclick();
        doubleTapChecked = true;
      } else await options.first().click();
      await waitForAnswer(number);
      questionCount = number;
      const after = (await readPilotState(page)).active;
      if (answered(after) !== number || (diagnosis && after.differential.ranked.length !== 1)) {
        fail(`${viewport.name} one tap did not answer exactly one question`, {
          number,
          locks: after.locks,
          differential: after.differential,
        });
      }

      if (!resumeChecked) {
        await page.locator('#cshift-exit').click();
        await page.waitForSelector('.cshift-hub');
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForSelector('#cshift-resume');
        await page.locator('#cshift-resume').click();
        await page.waitForSelector('.cshift-task.is-question');
        const resumedState = await readPilotState(page);
        const resumedLabel = (await page.locator('.cshift-task > .label').textContent()).trim();
        if (
          answered(resumedState.active) !== 1 ||
          !['decision', 'differential'].includes(resumedState.active.phase) ||
          !resumedLabel.startsWith(`Question 2 of ${questions.length}`) ||
          (await page.locator('#cshift-notes').inputValue()) !== notes
        ) {
          fail(`${viewport.name} an answered question did not survive reload and resume`, resumedState.active);
        }
        await assertDelayedFeedback(page, `${viewport.name} resumed question`);
        // a reload closes the notepad; the text is still in it
        await notepad.locator('summary').click();
        resumeChecked = true;
      }
    }

    if (questionCount !== questions.length || !diagnosisSeen || !resumeChecked || !doubleTapChecked || !holdChecked) {
      fail(`${viewport.name} did not answer every question with one tap each`, {
        questionCount,
        diagnosisSeen,
        resumeChecked,
        doubleTapChecked,
        holdChecked,
      });
    }

    // the last call leads straight to the debrief: there is no write-up step
    await page.waitForSelector('.cshift-debrief');
    const decisionCount = questions.length - 1;
    const debriefText = await page.locator('.cshift-debrief').innerText();
    const domainCount = await page.locator('.cshift-domain-grid > article').count();
    const reviewCount = await page.locator('.cshift-review-card').count();
    const explanationLengths = await page
      .locator('.cshift-review-explanation')
      .evaluateAll(items => items.map(item => item.textContent.trim().length));
    const pearlCount = await page.locator('.cshift-pearls > article').count();
    const activeStep = (await page.locator('.cshift-stepper li.active strong').textContent())?.trim();
    const completedSteps = await page.locator('.cshift-stepper li.done').count();
    const exampleNote = await page.locator('.cshift-clinical-note').innerText();
    const notesShown = await page.locator('.cshift-notes-review p').evaluate(node => node.textContent);
    savedState = await readPilotState(page);
    if (
      !debriefText.includes(caseData.title) ||
      !debriefText.includes(caseData.diagnosis) ||
      !exampleNote.includes(caseModelNote.assessment) ||
      !exampleNote.includes(caseModelNote.plan) ||
      /Not assessed|Model note|Charting self-review|Your differential/i.test(debriefText) ||
      domainCount !== 3 ||
      reviewCount !== decisionCount ||
      explanationLengths.length !== decisionCount + 1 ||
      explanationLengths.some(length => length < 20) ||
      pearlCount !== caseData.pearls.length ||
      !debriefText.includes('Scope and alternatives') ||
      !debriefText.includes('Independent clinician review remains pending') ||
      activeStep !== 'Debrief' ||
      completedSteps !== 3 ||
      notesShown !== notes ||
      (await page.locator('.cshift-notes-review p *').count()) ||
      (await page.locator('.cshift-workspace :is(textarea, input), .cshift-notepad, .cshift-note-comparison').count())
    ) {
      fail(`${viewport.name} delayed debrief is incomplete`, {
        domainCount,
        reviewCount,
        decisionCount,
        explanationLengths,
        pearlCount,
        activeStep,
        completedSteps,
        notesShown,
      });
    }
    if (
      savedState.active.phase !== 'debrief' ||
      !savedState.active.completedAt ||
      !savedState.active.differential.lockedAt ||
      savedState.active.differential.ranked.length !== 1 ||
      savedState.active.differential.rationale ||
      savedState.active.note.assessment ||
      savedState.active.note.plan ||
      savedState.active.note.revealedAt ||
      savedState.active.notes !== notes ||
      Object.keys(savedState.active.locks).length !== decisionCount ||
      savedState.active.scores.documentation !== 0 ||
      savedState.completed[caseData.id]?.attempts !== 1
    ) {
      fail(`${viewport.name} completed debrief state was not saved`, savedState);
    }
    await assertNoHorizontalOverflow(page, viewport, 'debrief', overflowChecks);

    await page.locator('#cshift-choose-rotation').click();
    await page.waitForSelector('.cshift-hub');
    const neurologyProgress = (
      await page.locator('[data-shift-specialty="neurology"] .cshift-rotation-progress').textContent()
    )?.trim();
    if (
      neurologyProgress !== `1/${neurologyRotation.caseIds.length} completed` ||
      (await page.locator('#cshift-resume').count())
    ) {
      fail(`${viewport.name} completed patient did not return to the rotation hub cleanly`, { neurologyProgress });
    }
    await page.locator('#cshift-classic').click();
    await page.waitForSelector('.cs-landing');
    const classicCardCount = await page.locator('.cs-card').count();
    const classicControls = await page.locator('.cs-config, #mixed, .cs-grid').count();
    if (
      classicCardCount !== 26 ||
      classicControls !== 3 ||
      (await page.locator('.cshift-hub, .cshift-debrief').count())
    ) {
      fail(`${viewport.name} Classic case bank escape is incomplete`, { classicCardCount, classicControls });
    }
    await assertNoHorizontalOverflow(page, viewport, 'classic case bank', overflowChecks);

    await page.locator('[data-scn="review"]').click();
    await page.waitForSelector('.cs-review');
    const classicHistoryText = await page.locator('.cs-rows').innerText();
    if (!classicHistoryText.includes(caseData.title)) {
      fail(`${viewport.name} completed shift did not reach the existing case history`, classicHistoryText);
    }
    await page.locator('[data-scn="practice"]').click();
    await page.waitForSelector('.cshift-hub');
    await page.locator('#cshift-classic').click();
    await page.waitForSelector('.cs-landing');
    await page.locator('#reset').click();
    await page.waitForSelector('#rst');
    const beforeReset = await page.evaluate(key => localStorage.getItem(key), PILOT_STATE_KEY);
    await page.locator('#rst-clinical').click();
    await page.waitForSelector('#rst-confirm');
    if ((await page.evaluate(key => localStorage.getItem(key), PILOT_STATE_KEY)) !== beforeReset)
      fail(`${viewport.name} reset preview changed saved work before confirmation`);
    await page.locator('#rst-confirm').click();
    await page.waitForSelector('.cshift-hub');
    const recoveryCopy = await page.evaluate(
      key => JSON.parse(localStorage.getItem(CortexProgress.archiveKey('guest')))?.data?.[key],
      PILOT_STATE_KEY
    );
    if (recoveryCopy !== beforeReset) fail(`${viewport.name} reset did not retain the previous shift for recovery`);
    const resetState = await page.evaluate(
      key => ({
        pilot: localStorage.getItem(key),
        progress: JSON.parse(localStorage.getItem('cs-progress') || '{}'),
        cases: JSON.parse(localStorage.getItem('cs-cases') || '{}'),
        history: JSON.parse(localStorage.getItem('cs-history') || '[]'),
      }),
      PILOT_STATE_KEY
    );
    const resetNeurologyProgress = (
      await page.locator('[data-shift-specialty="neurology"] .cshift-rotation-progress').textContent()
    )?.trim();
    if (
      resetState.pilot !== null ||
      Object.keys(resetState.progress).length ||
      Object.keys(resetState.cases).length ||
      resetState.history.length ||
      resetNeurologyProgress !== `0/${neurologyRotation.caseIds.length} completed`
    ) {
      fail(`${viewport.name} Clinical reset did not clear both shift and classic progress`, {
        resetState,
        resetNeurologyProgress,
      });
    }

    if (pageErrors.length || consoleErrors.length) {
      fail(`${viewport.name} emitted browser errors`, { pageErrors, consoleErrors });
    }

    return {
      viewport,
      assignedCaseId: caseData.id,
      questionCount,
      decisionCount,
      diagnosisPicks: savedState.active.differential.ranked.length,
      domainCount,
      reviewCount,
      pearlCount,
      neurologyProgress,
      classicCardCount,
      classicHistoryLinked: true,
      resetVerified: true,
      overflowChecks,
      pageErrors,
      consoleErrors,
    };
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  const results = [];
  for (const viewport of viewports) results.push(await runViewport(browser, viewport));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
