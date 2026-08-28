import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const APP_VERSION = (readFileSync(new URL('../app.js', import.meta.url), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || '';
const PILOT_STATE_KEY = 'cs-clinical-shift-v1';
const base = new URL(process.env.CORTEX_URL || 'http://localhost:8765/');
const practiceUrl = new URL('practice', base).href;
const pilot = JSON.parse(readFileSync(new URL('../data/clinical-shift-pilot.json', import.meta.url), 'utf8'));
const casesById = new Map(pilot.rotations.flatMap(rotation => {
  const specialty = JSON.parse(readFileSync(new URL(`../data/${rotation.key}.json`, import.meta.url), 'utf8'));
  const allowed = new Set(rotation.caseIds);
  return specialty.cases.filter(caseData => allowed.has(caseData.id)).map(caseData => [caseData.id, caseData]);
}));
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
  const amount = await page.evaluate(() => Math.max(
    0,
    document.documentElement.scrollWidth - window.innerWidth,
    document.body?.scrollWidth - window.innerWidth || 0,
  ));
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
  if (await page.locator('.cshift-debrief, .cshift-diagnosis, .cshift-review-card').count()) leaked.push('debrief content');
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
    if (heading !== 'Start your shift.' || rotationCount !== 3 || legacyControlCount !== 0 || exposedTitles.length
        || !hubText.includes('Formal clinician review is not yet recorded')
        || !shiftFooterText.includes('has not yet undergone formal clinician review')
        || shiftFooterText.includes('independently reviewed')) {
      fail(`${viewport.name} Clinical Shift hub is not specialty-only or honestly disclosed`, { heading, rotationCount, legacyControlCount, exposedTitles, shiftFooterText });
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
    if (!caseInvestigation?.interview?.length || !caseInvestigation?.exam?.length || !caseModelNote?.assessment || !caseModelNote?.plan) {
      fail(`${viewport.name} assigned patient is missing authored investigation or charting content`, caseData.id);
    }
    const handoffText = await page.locator('.cshift-handoff').innerText();
    const normalizedHandoffText = handoffText.toLowerCase();
    const vitalCount = await page.locator('.cshift-vitals > div').count();
    const currentStep = (await page.locator('.cshift-stepper [aria-current="step"] strong').textContent())?.trim();
    if (!normalizedHandoffText.includes(caseData.patient.toLowerCase())
        || !normalizedHandoffText.includes(caseData.setting.toLowerCase())
        || !normalizedHandoffText.includes(caseData.chiefComplaint.toLowerCase()) || vitalCount !== 5 || currentStep !== 'Handoff'
        || handoffText.includes(caseData.history) || handoffText.includes(caseData.exam)) {
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
    if (interviewChoiceCount !== caseInvestigation.interview.length || examChoiceCount !== caseInvestigation.exam.length
        || authoredFindings.some(finding => investigationText.includes(finding))) {
      fail(`${viewport.name} investigation choices are missing or revealed findings before selection`, { interviewChoiceCount, examChoiceCount });
    }
    await assertNoCaseSpoilers(page, caseData, `${viewport.name} investigation`);
    await assertNoHorizontalOverflow(page, viewport, 'investigation', overflowChecks);

    await page.locator('[data-cshift-investigation="interview"][data-cshift-index="0"]').click();
    await page.waitForSelector('[data-cshift-investigation="interview"][data-cshift-index="0"].done');
    investigationText = await page.locator('.cshift-two-col').innerText();
    let savedState = await readPilotState(page);
    if (!investigationText.includes(caseInvestigation.interview[0].finding)
        || caseInvestigation.interview.slice(1).some(item => investigationText.includes(item.finding))
        || caseInvestigation.exam.some(item => investigationText.includes(item.finding))
        || savedState.active.revealed.interviewItems.join(',') !== '0'
        || savedState.active.revealed.examItems.length) {
      fail(`${viewport.name} interview answer was not saved independently`, savedState.active.revealed);
    }

    await page.locator('#cshift-exit').click();
    await page.waitForSelector('.cshift-hub');
    if (!(await page.locator('#cshift-resume').isVisible())) fail(`${viewport.name} shift did not offer resume after save and exit`);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.cshift-hub');
    if (!(await page.locator('#cshift-resume').isVisible())) fail(`${viewport.name} shift resume did not survive a reload`);
    await page.locator('#cshift-resume').click();
    await page.waitForSelector('[data-cshift-investigation="interview"][data-cshift-index="0"].done');
    savedState = await readPilotState(page);
    investigationText = await page.locator('.cshift-two-col').innerText();
    if (savedState.active.phase !== 'investigate' || savedState.active.revealed.interviewItems.join(',') !== '0'
        || savedState.active.revealed.examItems.length || !investigationText.includes(caseInvestigation.interview[0].finding)) {
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
    if (authoredFindings.some(finding => !investigationText.includes(finding))
        || savedState.active.revealed.interviewItems.length !== caseInvestigation.interview.length
        || savedState.active.revealed.examItems.length !== caseInvestigation.exam.length
        || !savedState.active.revealed.history || !savedState.active.revealed.exam) {
      fail(`${viewport.name} completed investigation is missing selected answers or findings`, savedState.active.revealed);
    }
    await assertNoHorizontalOverflow(page, viewport, 'completed chart review', overflowChecks);
    await page.locator('#cshift-begin-reasoning').click();
    await page.waitForSelector('.cshift-task');

    let decisionCount = 0;
    let differentialSeen = false;
    let decisionResumeChecked = false;
    for (let step = 0; step < 20 && !(await page.locator('#cshift-assessment').count()); step++) {
      if (await page.locator('.cshift-options').count()) {
        await assertNoCaseSpoilers(page, caseData, `${viewport.name} decision ${decisionCount + 1}`);
        await assertDelayedFeedback(page, `${viewport.name} decision ${decisionCount + 1}`);
        const options = page.locator('.cshift-option');
        if ((await options.count()) < 4) fail(`${viewport.name} decision has fewer than four choices`);
        await options.first().click();
        if (await page.locator('.cshift-option[aria-pressed="true"]').count() !== 1) {
          fail(`${viewport.name} decision selection did not expose its pressed state`);
        }
        const lockButton = page.locator('#cshift-lock-decision');
        if (await lockButton.isDisabled()) fail(`${viewport.name} selected decision could not be locked`);
        await lockButton.click();
        await page.waitForSelector('.cshift-locked');
        const everyChoiceDisabled = await page.locator('.cshift-option').evaluateAll(buttons => buttons.every(button => button.disabled));
        const lockedText = (await page.locator('.cshift-locked').innerText()).trim();
        if (!everyChoiceDisabled || !lockedText.toLowerCase().includes('decision locked')) {
          fail(`${viewport.name} decision did not become immutable`, { everyChoiceDisabled, lockedText });
        }
        await assertDelayedFeedback(page, `${viewport.name} locked decision ${decisionCount + 1}`);
        await assertNoHorizontalOverflow(page, viewport, `locked decision ${decisionCount + 1}`, overflowChecks);
        decisionCount++;

        if (!decisionResumeChecked) {
          await page.locator('#cshift-exit').click();
          await page.waitForSelector('.cshift-hub');
          await page.reload({ waitUntil: 'networkidle' });
          await page.waitForSelector('#cshift-resume');
          await page.locator('#cshift-resume').click();
          await page.waitForSelector('.cshift-options');
          const resumedChoicesDisabled = await page.locator('.cshift-option').evaluateAll(buttons => buttons.every(button => button.disabled));
          const resumedState = await readPilotState(page);
          if (!resumedChoicesDisabled || resumedState.active.phase !== 'decision'
              || Object.keys(resumedState.active.locks).length !== 1) {
            fail(`${viewport.name} locked decision did not survive reload and resume`, resumedState.active);
          }
          await assertDelayedFeedback(page, `${viewport.name} resumed locked decision`);
          decisionResumeChecked = true;
        }

        await page.locator('#cshift-next-stage').click();
        await page.waitForSelector('.cshift-task');
        continue;
      }

      if (await page.locator('.cshift-dx-list').count()) {
        differentialSeen = true;
        const evidenceCount = await page.locator('.cshift-evidence').count();
        const evidencePrecedesQuestion = await page.locator('.cshift-task').evaluate(task => {
          const evidence = task.querySelector('.cshift-evidence');
          const heading = task.querySelector('h1');
          return !!evidence && !!heading && evidence.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING;
        });
        if (!evidenceCount || !evidencePrecedesQuestion) fail(`${viewport.name} chart evidence was not surfaced before the differential`);
        await assertNoCaseSpoilers(page, caseData, `${viewport.name} differential`);
        await assertDelayedFeedback(page, `${viewport.name} differential`);
        for (let rank = 1; rank <= 3; rank++) {
          await page.locator('.cshift-dx-option:not(.selected)').first().click();
          const ranks = (await page.locator('.cshift-dx-option.selected > span').allTextContents()).map(value => value.trim()).sort();
          const pressed = await page.locator('.cshift-dx-option[aria-pressed="true"]').count();
          if (ranks.length !== rank || pressed !== rank || !ranks.includes(String(rank))) {
            fail(`${viewport.name} differential rank ${rank} was not retained`, ranks);
          }
        }
        const rationale = 'The vascular findings make the leading diagnosis more likely than the competing causes.';
        await page.locator('#cshift-rationale').fill(rationale);
        const lockButton = page.locator('#cshift-lock-differential');
        if (await lockButton.isDisabled()) fail(`${viewport.name} complete differential could not be locked`);
        await lockButton.click();
        await page.waitForSelector('.cshift-locked');
        const dxDisabled = await page.locator('.cshift-dx-option').evaluateAll(buttons => buttons.every(button => button.disabled));
        const rationaleDisabled = await page.locator('#cshift-rationale').isDisabled();
        const differentialState = await readPilotState(page);
        if (!dxDisabled || !rationaleDisabled || !differentialState.active.differential.lockedAt
            || differentialState.active.differential.ranked.length !== 3
            || differentialState.active.differential.rationale !== rationale) {
          fail(`${viewport.name} differential did not lock its ranking and rationale`, differentialState.active.differential);
        }
        await assertDelayedFeedback(page, `${viewport.name} locked differential`);
        await assertNoHorizontalOverflow(page, viewport, 'locked differential', overflowChecks);
        await page.locator('#cshift-next-stage').click();
        await page.waitForSelector('.cshift-task');
        continue;
      }

      fail(`${viewport.name} reached an unknown Clinical Shift phase`, await readPilotState(page));
    }

    if (!decisionCount || !decisionResumeChecked || !differentialSeen || !(await page.locator('#cshift-assessment').count())) {
      fail(`${viewport.name} did not reach every reasoning phase`, { decisionCount, decisionResumeChecked, differentialSeen });
    }
    await assertNoCaseSpoilers(page, caseData, `${viewport.name} unrevealed note`);
    const revealButton = page.locator('#cshift-reveal-note');
    if (!(await revealButton.isDisabled())) fail(`${viewport.name} empty note could reveal the model`);
    if (await page.locator('.cshift-model-note').count()) fail(`${viewport.name} model note appeared before the learner wrote a response`);
    const assessment = 'The presentation is most consistent with an acute vascular neurologic process supported by the chart findings.';
    const plan = 'Obtain urgent confirmatory testing, begin appropriate risk-reducing treatment, and arrange monitored follow-up.';
    await page.locator('#cshift-assessment').fill(assessment);
    if (!(await revealButton.isDisabled())) fail(`${viewport.name} model could be revealed with the plan still empty`);
    await page.locator('#cshift-plan').fill(plan);
    if (await revealButton.isDisabled()) fail(`${viewport.name} complete note could not reveal the model`);
    await assertNoHorizontalOverflow(page, viewport, 'unrevealed note', overflowChecks);
    await revealButton.click();
    await page.waitForSelector('.cshift-note-review-stage');
    let chartReviewText = await page.locator('.cshift-note-review-stage').innerText();
    savedState = await readPilotState(page);
    if (!chartReviewText.includes(assessment) || !chartReviewText.includes(plan)
        || !chartReviewText.includes(caseModelNote.assessment) || !chartReviewText.includes(caseModelNote.plan)
        || await page.locator('.cshift-model-note').count() !== 2
        || savedState.active.phase !== 'note' || !savedState.active.note.revealedAt || savedState.active.completedAt) {
      fail(`${viewport.name} charting self-review did not reveal and save both responses`, savedState.active.note);
    }
    await assertNoHorizontalOverflow(page, viewport, 'charting self-review', overflowChecks);

    await page.locator('#cshift-exit').click();
    await page.waitForSelector('.cshift-hub');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#cshift-resume');
    await page.locator('#cshift-resume').click();
    await page.waitForSelector('.cshift-note-review-stage');
    chartReviewText = await page.locator('.cshift-note-review-stage').innerText();
    if (!chartReviewText.includes(caseModelNote.assessment) || await page.locator('#cshift-assessment, #cshift-plan').count()) {
      fail(`${viewport.name} revealed charting self-review did not survive reload and resume`);
    }
    await page.locator('#cshift-finish-note').click();
    await page.waitForSelector('.cshift-debrief');

    const debriefText = await page.locator('.cshift-debrief').innerText();
    const domainCount = await page.locator('.cshift-domain-grid > article').count();
    const notAssessedCount = await page.locator('.cshift-domain-grid > article strong').filter({ hasText: 'Not assessed' }).count();
    const reviewCount = await page.locator('.cshift-review-card').count();
    const explanationLengths = await page.locator('.cshift-review-explanation').evaluateAll(items => items.map(item => item.textContent.trim().length));
    const pearlCount = await page.locator('.cshift-pearls > article').count();
    const activeStep = (await page.locator('.cshift-stepper li.active strong').textContent())?.trim();
    const completedSteps = await page.locator('.cshift-stepper li.done').count();
    savedState = await readPilotState(page);
    if (!debriefText.includes(caseData.title) || !debriefText.includes(caseData.diagnosis)
        || !debriefText.includes(assessment) || !debriefText.includes(plan)
        || !debriefText.includes(caseModelNote.assessment) || !debriefText.includes(caseModelNote.plan)
        || domainCount !== 6 || notAssessedCount !== 2 || reviewCount !== decisionCount
        || explanationLengths.some(length => length < 20) || pearlCount !== caseData.pearls.length
        || !debriefText.includes('Content status:') || !debriefText.includes('Formal clinician review is not yet recorded')
        || activeStep !== 'Debrief' || completedSteps !== 4
        || await page.locator('.cshift-debrief textarea').count()) {
      fail(`${viewport.name} delayed debrief is incomplete`, {
        domainCount,
        notAssessedCount,
        reviewCount,
        decisionCount,
        explanationLengths,
        pearlCount,
        activeStep,
        completedSteps,
      });
    }
    if (savedState.active.phase !== 'debrief' || !savedState.active.note.revealedAt
        || !savedState.active.completedAt || !savedState.active.differential.lockedAt
        || Object.keys(savedState.active.locks).length !== decisionCount
        || savedState.completed[caseData.id]?.attempts !== 1) {
      fail(`${viewport.name} completed debrief state was not saved`, savedState);
    }
    await assertNoHorizontalOverflow(page, viewport, 'debrief', overflowChecks);

    await page.locator('#cshift-choose-rotation').click();
    await page.waitForSelector('.cshift-hub');
    const neurologyProgress = (await page.locator('[data-shift-specialty="neurology"] .cshift-rotation-progress').textContent())?.trim();
    if (neurologyProgress !== '1/5 completed' || await page.locator('#cshift-resume').count()) {
      fail(`${viewport.name} completed patient did not return to the rotation hub cleanly`, { neurologyProgress });
    }
    await page.locator('#cshift-classic').click();
    await page.waitForSelector('.cs-landing');
    const classicCardCount = await page.locator('.cs-card').count();
    const classicControls = await page.locator('.cs-config, #mixed, .cs-grid').count();
    if (classicCardCount !== 26 || classicControls !== 3 || await page.locator('.cshift-hub, .cshift-debrief').count()) {
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
    await page.locator('#rst-clinical').click();
    await page.waitForSelector('.cshift-hub');
    const resetState = await page.evaluate(key => ({
      pilot: localStorage.getItem(key),
      progress: JSON.parse(localStorage.getItem('cs-progress') || '{}'),
      cases: JSON.parse(localStorage.getItem('cs-cases') || '{}'),
      history: JSON.parse(localStorage.getItem('cs-history') || '[]'),
    }), PILOT_STATE_KEY);
    const resetNeurologyProgress = (await page.locator('[data-shift-specialty="neurology"] .cshift-rotation-progress').textContent())?.trim();
    if (resetState.pilot !== null || Object.keys(resetState.progress).length || Object.keys(resetState.cases).length
        || resetState.history.length || resetNeurologyProgress !== '0/5 completed') {
      fail(`${viewport.name} Clinical reset did not clear both shift and classic progress`, { resetState, resetNeurologyProgress });
    }

    if (pageErrors.length || consoleErrors.length) {
      fail(`${viewport.name} emitted browser errors`, { pageErrors, consoleErrors });
    }

    return {
      viewport,
      assignedCaseId: caseData.id,
      decisionCount,
      differentialRankCount: savedState.active.differential.ranked.length,
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
