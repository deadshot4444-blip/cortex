import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

// Track the live app version so the "what's new" modal never blocks navigation as versions bump.
const APP_VERSION = (readFileSync(new URL('../app.js', import.meta.url), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || '';
const viewport = {
  width: Number(process.env.CORTEX_VIEWPORT_WIDTH) || 1280,
  height: Number(process.env.CORTEX_VIEWPORT_HEIGHT) || 900,
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport });
const errors = [];
const overflowChecks = [];
page.on('pageerror', e => errors.push(`${e.message}\n${e.stack?.split('\n')[1] || ''}`));

async function assertNoHorizontalOverflow(label) {
  const amount = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
  overflowChecks.push({ label, amount });
  if (amount > 1) throw new Error(`${label} has ${amount}px of horizontal overflow at ${viewport.width}px`);
}

await page.addInitScript(v => localStorage.setItem('cs-seen-ver', v), APP_VERSION);
await page.goto(process.env.CORTEX_URL || 'http://localhost:8765/', { waitUntil: 'networkidle' });
await page.click('[data-go="neuro"]');
await page.waitForFunction(
  () => typeof renderNeuroEngineering === 'function' && document.querySelector('.neuro-page'),
  { timeout: 15000 },
);

const hero = (await page.textContent('.neuro-hero h1'))?.trim();
await assertNoHorizontalOverflow('Neuro hub');
const mainCards = await page.locator('.neuro-subcard').count();
const trackInitiallyOpen = await page.locator('#ne-track').evaluate(el => el.open);
const showUnitsVisible = await page.locator('.neuro-track-toggle-show').isVisible();
if (mainCards !== 0) throw new Error(`Main Neuro page should not show subject cards, found: ${mainCards}`);
if (trackInitiallyOpen) throw new Error('The Track should start collapsed');
if (!showUnitsVisible) throw new Error('Collapsed Track should show the Show units control');
await page.click('#nf-track');
const trackOpenedFromFoundation = await page.locator('#ne-track').evaluate(el => el.open);
const hideUnitsVisible = await page.locator('.neuro-track-toggle-hide').isVisible();
if (!trackOpenedFromFoundation) throw new Error('The Foundations Track button should open the Track dropdown');
if (!hideUnitsVisible) throw new Error('Open Track should show the Hide units control');
await assertNoHorizontalOverflow('Open Track');
await page.click('.neuro-track-summary');
await page.click('#ne-library');
await page.waitForSelector('.neuro-library', { timeout: 10000 });
const libraryCards = await page.locator('.neuro-library .neuro-subcard').count();
const libraryLabs = await page.locator('.neuro-library .neuro-lablink').count();
if (libraryCards !== 12) throw new Error(`Lessons & labs should show 12 subjects, found: ${libraryCards}`);
if (libraryLabs !== 3) throw new Error(`Lessons & labs should show 3 practice links, found: ${libraryLabs}`);
await assertNoHorizontalOverflow('Lessons & Labs');
const libraryBackText = (await page.locator('#neback').textContent())?.trim();
if (libraryBackText !== '← Back to Neuroengineering') throw new Error(`Library needs a clear back button, got: ${libraryBackText}`);
await page.locator('.neuro-library .neuro-subcard').first().click();
await page.waitForSelector('#nerows', { timeout: 10000 });
const subjectTopicTitles = await page.locator('.neuro-row-title').allTextContents();
const subjectTopicMeta = await page.locator('.neuro-row-sub').allTextContents();
const subjectTopicMetaGap = await page.locator('.neuro-row').first().evaluate(row => {
  const title = row.querySelector('.neuro-row-title')?.getBoundingClientRect();
  const meta = row.querySelector('.neuro-row-sub')?.getBoundingClientRect();
  return title && meta ? Math.round((meta.top - title.bottom) * 10) / 10 : -1;
});
if (subjectTopicMetaGap < 4) throw new Error(`Question count needs its own line and breathing room, got: ${subjectTopicMetaGap}px`);
if (subjectTopicTitles[0]?.trim() !== 'LFPs vs. Spikes' || !subjectTopicMeta[0]?.includes('Track Unit 1')) {
  throw new Error(`Neural Signals should follow Track order, got: ${JSON.stringify({ subjectTopicTitles, subjectTopicMeta })}`);
}
if (subjectTopicTitles[1]?.trim() !== 'The Action Potential' || !subjectTopicMeta[1]?.includes('Track Unit 2')) {
  throw new Error(`Action Potential should be identified as Track Unit 2, got: ${JSON.stringify({ subjectTopicTitles, subjectTopicMeta })}`);
}
await page.locator('.neuro-row').first().click();
await page.waitForSelector('#ne-atlas', { timeout: 10000 });
const topicBackText = (await page.locator('#neback').textContent())?.trim();
if (topicBackText !== '← Back to Neural Signals') throw new Error(`Topic needs a clear destination in its back button, got: ${topicBackText}`);
const topicNavSeparated = await page.evaluate(() => {
  const back = document.querySelector('#neback')?.getBoundingClientRect();
  const eyebrow = document.querySelector('.neuro-eyebrow')?.getBoundingClientRect();
  return Boolean(back && eyebrow && back.bottom < eyebrow.top);
});
if (!topicNavSeparated) throw new Error('Topic back button and category label should be visually separated');
await assertNoHorizontalOverflow('Topic lesson');
await page.click('#neback');
await page.waitForSelector('#nerows', { timeout: 10000 });
await page.click('#neback');
await page.waitForSelector('#ne-path', { timeout: 10000 });
const pathText = (await page.locator('#ne-path').textContent())?.trim();
const currentRowText = (await page.locator('.neuro-trackrow.current .neuro-trackgo').textContent())?.trim();
if (pathText !== 'Start · Unit 1') throw new Error(`Fresh Track CTA should say Start, got: ${pathText}`);
if (currentRowText !== 'Start →') throw new Error(`Fresh current unit should say Start, got: ${currentRowText}`);

await page.click('#ne-path');
await page.waitForSelector('#neunitstages', { timeout: 10000 });
await page.waitForTimeout(400);
const startEntryScrollY = await page.evaluate(() => window.scrollY);
if (startEntryScrollY > 1) throw new Error(`Start should open the unit at the top, got scrollY: ${startEntryScrollY}`);
await assertNoHorizontalOverflow('Unit start');
const unitTypeScale = await page.evaluate(() => ({
  stageLabel: Number.parseFloat(getComputedStyle(document.querySelector('.neuro-stage > .label')).fontSize),
  objectiveRow: Number.parseFloat(getComputedStyle(document.querySelector('.neuro-stage > .neuro-kv')).fontSize),
  objectiveLabel: Number.parseFloat(getComputedStyle(document.querySelector('.neuro-stage > .neuro-kv > span:first-child')).fontSize),
  objectiveValue: Number.parseFloat(getComputedStyle(document.querySelector('.neuro-stage > .neuro-kv > span:last-child')).fontSize),
}));
if (unitTypeScale.stageLabel !== 18 || unitTypeScale.objectiveRow !== 16 || unitTypeScale.objectiveLabel !== 11 || unitTypeScale.objectiveValue !== 16) {
  throw new Error(`Unit teaching hierarchy is off, got: ${JSON.stringify(unitTypeScale)}`);
}
await page.click('#neback');
await page.waitForSelector('#ne-path', { timeout: 10000 });
const resumedPathText = (await page.locator('#ne-path').textContent())?.trim();
const resumedRowText = (await page.locator('.neuro-trackrow.current .neuro-trackgo').textContent())?.trim();
if (resumedPathText !== 'Continue · Unit 1') throw new Error(`Used Track CTA should say Continue, got: ${resumedPathText}`);
if (resumedRowText !== 'Continue →') throw new Error(`Used current unit should say Continue, got: ${resumedRowText}`);
await page.click('#ne-path');
await page.waitForSelector('#neunitstages', { timeout: 10000 });
await page.waitForTimeout(400);
const continueEntryScrollY = await page.evaluate(() => window.scrollY);
if (continueEntryScrollY > 1) throw new Error(`Continue should open the unit at the top, got scrollY: ${continueEntryScrollY}`);

let recallSubmitSeen = false;
let recallContinueSeen = false;
for (let i = 0; i < 4; i++) {
  await page.locator('#neunitstages [data-cont]:not([disabled])').last().click();
  await page.waitForTimeout(120);
}
for (let i = 0; i < 2; i++) {
  const submit = page.locator('#neunitstages [data-submit-answer]').last();
  if (!(await submit.isVisible())) throw new Error('Active recall Submit answer button is not visible');
  const submitText = (await submit.textContent())?.trim();
  if (submitText !== 'Submit answer') throw new Error(`Active recall action should say Submit answer, got: ${submitText}`);
  await page.locator('#neunitstages textarea.socinput').last().fill('Ordered samples preserve how the signal changes over time.');
  recallSubmitSeen = true;
  await submit.click();
  const next = page.locator('#neunitstages [data-cont]:not([disabled])').last();
  recallContinueSeen = (await next.count()) > 0 && await next.isVisible();
  await next.click();
  await page.waitForTimeout(120);
}

await page.waitForSelector('.neuro-quiz-gate', { timeout: 10000 });
const quickCheckStartLabel = (await page.locator('#neunitlab').textContent())?.trim();
if (quickCheckStartLabel !== 'Stage 6 / 9 · Quick check') throw new Error(`Quick Check progress needs context, got: ${quickCheckStartLabel}`);
const topicReviewInline = (await page.locator('.neuro-quiz-gate .neuro-topic-review').count()) === 1
  && (await page.locator('.neuro-quiz-gate [data-topic-first]').count()) === 0;
if (!topicReviewInline) throw new Error('Quick Check topic review should stay inside the unit');
await assertNoHorizontalOverflow('Quick Check');

async function answerEmbeddedQuiz(choiceIndexes) {
  for (const choiceIndex of choiceIndexes) {
    await page.locator(`.neuro-quiz-gate .opt[data-i="${choiceIndex}"]`).click();
    const questionCount = await page.locator('.neuro-embed [data-neuro-quiz-stages] > .neuro-stage').count();
    if (questionCount !== 1) throw new Error(`Quick Check should show one active question, found: ${questionCount}`);
    await page.locator('.neuro-quiz-gate [data-cont]:not([disabled])').click();
    await page.waitForTimeout(120);
  }
}

await answerEmbeddedQuiz([1, 0]);
await page.waitForSelector('[data-quiz-retry]', { timeout: 10000 });
const failedQuickCheckLabel = (await page.locator('#neunitlab').textContent())?.trim();
const failedQuickCheckScore = (await page.locator('.neuro-quiz-result.retry .neuro-score').textContent())?.replace(/\s/g, '');
if (failedQuickCheckLabel !== 'Stage 6 / 9 · Quick check' || failedQuickCheckScore !== '01/02') {
  throw new Error(`Failed Quick Check should explain why progress remains at stage 6, got: ${JSON.stringify({ failedQuickCheckLabel, failedQuickCheckScore })}`);
}
await page.click('[data-quiz-review]');
const reviewStayedInUnit = await page.locator('.neuro-quiz-result .neuro-topic-review').evaluate(el => el.open)
  && page.url().endsWith('/neuro');
if (!reviewStayedInUnit) throw new Error('Reviewing the supporting topic should not leave the unit');
await page.click('[data-quiz-retry]');
await answerEmbeddedQuiz([0, 0]);
await page.waitForSelector('[data-quiz-continue]', { timeout: 10000 });
const passedQuickCheckScore = (await page.locator('.neuro-quiz-result.passed .neuro-score').textContent())?.replace(/\s/g, '');
if (passedQuickCheckScore !== '02/02') throw new Error(`Passed Quick Check should show 02/02, got: ${passedQuickCheckScore}`);
await page.click('[data-quiz-continue]');
await page.waitForFunction(() => document.querySelector('#neunitlab')?.textContent?.includes('Stage 7 / 9 · NeuroCode'));
const stageAfterQuickCheck = (await page.locator('#neunitlab').textContent())?.trim();

const codeMore = page.locator('#neunitstages details.neuro-sandbox-more').last();
await codeMore.evaluate(el => { el.open = true; });
await page.locator('#neunitstages [data-predict-out]').last().click();
const visibleExpectedOutput = (await page.locator('#neunitstages [data-predict]').last().textContent())?.replace(/\s+/g, ' ').trim();
if (!visibleExpectedOutput?.includes('Number of samples: 7') || visibleExpectedOutput.includes('Number of samples: 6')) {
  throw new Error(`Lists exercise should display the 7-sample challenge target, got: ${visibleExpectedOutput}`);
}
await page.locator('#neunitstages [data-load-sol]').last().click();
await page.locator('#neunitstages [data-check-code]').last().click();
await page.waitForSelector('#neunitstages [data-code-done]:visible', { timeout: 30000 });
const terminalResultInset = await page.locator('#neunitstages .neuro-ojt-terminal').last().evaluate(terminal => {
  const message = terminal.querySelector('.neuro-terminal-msg');
  const hint = terminal.querySelector('.neuro-terminal-hint');
  return {
    messageLeft: Number.parseFloat(getComputedStyle(message).paddingLeft),
    hintLeft: Number.parseFloat(getComputedStyle(hint).paddingLeft),
    hintBottom: Number.parseFloat(getComputedStyle(hint).paddingBottom),
  };
});
if (terminalResultInset.messageLeft < 12 || terminalResultInset.hintLeft < 12 || terminalResultInset.hintBottom < 12) {
  throw new Error(`NeuroCode result text should be inset from the terminal frame, got: ${JSON.stringify(terminalResultInset)}`);
}
await page.locator('#neunitstages [data-code-done]').last().click();
await page.waitForTimeout(500);
const stageAfterCode = (await page.locator('#neunitlab').textContent())?.trim();
if (stageAfterCode !== 'Stage 8 / 9 · NeuroSim') {
  const codeState = await page.evaluate(() => ({
    stageIdx: neUnit?.stageIdx,
    stages: neUnit?.stages,
    codeDoneVisible: Boolean(document.querySelector('[data-code-done]')?.offsetParent),
    simCount: document.querySelectorAll('#nesimopts').length,
  }));
  throw new Error(`NeuroCode should advance to Stage 8, got: ${JSON.stringify({ stageAfterCode, codeState })}`);
}

const simBestIndex = await page.evaluate(() => neuroSim(neUnit.step.simulationId).bestAnswerIndex);
const simChoiceCount = await page.locator('#neunitstages #nesimopts .opt').count();
const simWrongIndex = (simBestIndex + 1) % simChoiceCount;
await page.locator('#neunitstages #nesimopts .opt').nth(simWrongIndex).click();
await page.waitForTimeout(200);
const simRetryText = (await page.locator('#nesimdone').count())
  ? (await page.locator('#nesimdone').last().textContent())?.trim()
  : null;
if (!simRetryText) {
  const simState = await page.evaluate(() => ({
    stageIdx: neUnit?.stageIdx,
    simOpts: document.querySelectorAll('#nesimopts .opt').length,
    disabledOpts: document.querySelectorAll('#nesimopts .opt:disabled').length,
    afterText: document.querySelector('#nesimafter')?.textContent?.trim(),
  }));
  throw new Error(`NeuroSim answer should render an action, got: ${JSON.stringify(simState)}`);
}
if (simRetryText !== 'Retry NeuroSim') throw new Error(`Incorrect NeuroSim needs a retry action, got: ${simRetryText}`);
await page.click('#nesimdone');
await page.locator('#neunitstages #nesimopts .opt').nth(simBestIndex).click();
await page.click('#nesimdone');
await page.waitForFunction(() => document.querySelector('#neunitlab')?.textContent?.includes('Stage 9 / 9 · Debrief'));
await page.locator('#neunitstages [data-cont]:not([disabled])').last().click();
await page.waitForSelector('#nenu', { timeout: 10000 });

const stages = await page.locator('#neunitstages .neuro-stage').count();
const hasQuiz = (await page.locator('#neunitstages .neuro-embed').count()) > 0;
const unitLab = (await page.locator('#neunitlab').textContent())?.trim();
const unitCompleted = await page.locator('#nenu').isVisible();
if (!recallSubmitSeen || !recallContinueSeen) throw new Error('Active recall should provide Submit answer followed by Next/Continue');
if (!unitCompleted || unitLab !== 'Complete') throw new Error(`Unit 1 should complete end to end, got: ${JSON.stringify({ unitCompleted, unitLab })}`);
await assertNoHorizontalOverflow('Unit complete');

console.log(JSON.stringify({ viewport, overflowChecks, hero, mainCards, trackInitiallyOpen, showUnitsVisible, trackOpenedFromFoundation, hideUnitsVisible, libraryCards, libraryLabs, libraryBackText, subjectTopicTitles, subjectTopicMeta, subjectTopicMetaGap, topicBackText, topicNavSeparated, pathText, currentRowText, startEntryScrollY, resumedPathText, resumedRowText, continueEntryScrollY, unitTypeScale, recallSubmitSeen, recallContinueSeen, quickCheckStartLabel, topicReviewInline, failedQuickCheckLabel, failedQuickCheckScore, reviewStayedInUnit, passedQuickCheckScore, stageAfterQuickCheck, visibleExpectedOutput, terminalResultInset, stageAfterCode, simRetryText, stages, hasQuiz, unitLab, unitCompleted, errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
