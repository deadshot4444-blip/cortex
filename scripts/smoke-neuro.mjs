import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

// Track the live app version so the "what's new" modal never blocks navigation as versions bump.
const APP_VERSION =
  (readFileSync(new URL('../app.js', import.meta.url), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || '';
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
  { timeout: 15000 }
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
if (libraryBackText !== '← Back to Neuroengineering')
  throw new Error(`Library needs a clear back button, got: ${libraryBackText}`);
await page.locator('.neuro-library .neuro-subcard').first().click();
await page.waitForSelector('#nerows', { timeout: 10000 });
const subjectTopicTitles = await page.locator('.neuro-row-title').allTextContents();
const subjectTopicMeta = await page.locator('.neuro-row-sub').allTextContents();
const subjectTopicMetaGap = await page
  .locator('.neuro-row')
  .first()
  .evaluate(row => {
    const title = row.querySelector('.neuro-row-title')?.getBoundingClientRect();
    const meta = row.querySelector('.neuro-row-sub')?.getBoundingClientRect();
    return title && meta ? Math.round((meta.top - title.bottom) * 10) / 10 : -1;
  });
if (subjectTopicMetaGap < 4)
  throw new Error(`Question count needs its own line and breathing room, got: ${subjectTopicMetaGap}px`);
if (subjectTopicTitles[0]?.trim() !== 'LFPs vs. Spikes' || !subjectTopicMeta[0]?.includes('Track Unit 1')) {
  throw new Error(
    `Neural Signals should follow Track order, got: ${JSON.stringify({ subjectTopicTitles, subjectTopicMeta })}`
  );
}
if (subjectTopicTitles[1]?.trim() !== 'The Action Potential' || !subjectTopicMeta[1]?.includes('Track Unit 2')) {
  throw new Error(
    `Action Potential should be identified as Track Unit 2, got: ${JSON.stringify({ subjectTopicTitles, subjectTopicMeta })}`
  );
}
await page.locator('.neuro-row').first().click();
await page.waitForSelector('#ne-atlas', { timeout: 10000 });
const topicBackText = (await page.locator('#neback').textContent())?.trim();
if (topicBackText !== '← Back to Neural Signals')
  throw new Error(`Topic needs a clear destination in its back button, got: ${topicBackText}`);
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
  objectiveLabel: Number.parseFloat(
    getComputedStyle(document.querySelector('.neuro-stage > .neuro-kv > span:first-child')).fontSize
  ),
  objectiveValue: Number.parseFloat(
    getComputedStyle(document.querySelector('.neuro-stage > .neuro-kv > span:last-child')).fontSize
  ),
}));
if (
  unitTypeScale.stageLabel !== 18 ||
  unitTypeScale.objectiveRow !== 16 ||
  unitTypeScale.objectiveLabel !== 11 ||
  unitTypeScale.objectiveValue !== 16
) {
  throw new Error(`Unit teaching hierarchy is off, got: ${JSON.stringify(unitTypeScale)}`);
}
await page.click('#neback');
await page.waitForSelector('#ne-path', { timeout: 10000 });
const resumedPathText = (await page.locator('#ne-path').textContent())?.trim();
const resumedRowText = (await page.locator('.neuro-trackrow.current .neuro-trackgo').textContent())?.trim();
if (resumedPathText !== 'Continue · Unit 1')
  throw new Error(`Used Track CTA should say Continue, got: ${resumedPathText}`);
if (resumedRowText !== 'Continue →') throw new Error(`Used current unit should say Continue, got: ${resumedRowText}`);
await page.click('#ne-path');
await page.waitForSelector('#neunitstages', { timeout: 10000 });
await page.waitForTimeout(400);
const continueEntryScrollY = await page.evaluate(() => window.scrollY);
if (continueEntryScrollY > 1)
  throw new Error(`Continue should open the unit at the top, got scrollY: ${continueEntryScrollY}`);

// Current foundation units keep the first answers and review them without retrying to a perfect score.
for (let i = 0; i < 4; i++) await page.click('#neuro-unit-next');
let recallSubmitSeen = false;
let recallContinueSeen = false;
for (let i = 0; i < 2; i++) {
  await page.fill('#neuro-recall', 'Ordered samples preserve how the signal changes over time.');
  await page.click('#neuro-recall-reveal');
  recallSubmitSeen = (await page.locator('#neunitstages').innerText()).includes('Compare with the model');
  recallContinueSeen = await page.locator('#neuro-recall-next').isVisible();
  if (!recallSubmitSeen || !recallContinueSeen)
    throw new Error('Recall must save and reveal the model before continuing');
  await page.click('#neuro-recall-next');
}
const quickCheckStartLabel = (await page.locator('#neunitlab').textContent()).trim();
if (quickCheckStartLabel !== 'Stage 6 / 9 · Quick check') throw new Error(quickCheckStartLabel);
if (!(await page.locator('#neuro-unit-next').isDisabled()))
  throw new Error('Unanswered quick checks must block progression');
const checks = await page.evaluate(() => neUnit.record.content.checks);
for (const [i, question] of checks.entries()) {
  const choice = i === 0 ? (question.correctIndex + 1) % question.choices.length : question.correctIndex;
  await page.locator('#neuro-unit-questions .neuro-block').nth(i).locator(`[data-choice="${choice}"]`).click();
  if (!(await page.locator('#neuro-unit-questions .neuro-block').nth(i).innerText()).includes('Model answer:'))
    throw new Error('A saved answer must reveal its model and explanation');
}
const firstAnswers = await page.evaluate(() => JSON.stringify(neUnit.record.answers));
await page.reload({ waitUntil: 'networkidle' });
if ((await page.evaluate(() => JSON.stringify(neUnit.record.answers))) !== firstAnswers)
  throw new Error('Quick-check first answers changed after reload');
if (await page.locator('#neuro-unit-questions [data-choice]:not([disabled])').count())
  throw new Error('Reviewed first answers must remain locked');
await assertNoHorizontalOverflow('Quick Check');
await page.click('#neuro-unit-next');
const stageAfterQuickCheck = (await page.locator('#neunitlab').textContent()).trim();
if (stageAfterQuickCheck !== 'Stage 7 / 9 · NeuroCode') throw new Error(stageAfterQuickCheck);
if (await page.locator('[data-code-done]').isVisible()) throw new Error('Untested code must not pass the unit gate');
const codeCases = await page.evaluate(() => neUnit.record.content.code.checks.cases.length);
await page.locator('details.neuro-sandbox-more > summary').click();
await page.click('[data-load-sol]');
await page.click('[data-check-code]');
await page.waitForSelector('[data-code-done]:visible', { timeout: 60000 });
const codeResult = await page.locator('[data-py-status]').innerText();
if (codeResult !== `${codeCases}/${codeCases} input cases passed.`) throw new Error(codeResult);
if ((await page.locator('[data-check-results] li').count()) !== codeCases)
  throw new Error('Each Python input case needs an inspectable result');
await assertNoHorizontalOverflow('NeuroCode result');
await page.click('[data-code-done]');
const stageAfterCode = (await page.locator('#neunitlab').textContent()).trim();
if (stageAfterCode !== 'Stage 8 / 9 · NeuroSim') throw new Error(stageAfterCode);
const sim = await page.evaluate(() => neUnit.record.content.sim);
const simWrongIndex = (sim.bestAnswerIndex + 1) % sim.choices.length;
if (!(await page.locator('#neuro-unit-next').isDisabled()))
  throw new Error('Unanswered simulation must block progression');
await page.locator(`#neuro-unit-questions [data-choice="${simWrongIndex}"]`).click();
if (!(await page.locator('#neunitstages').innerText()).includes('First answer needs review'))
  throw new Error('The simulation must honestly preserve its wrong first answer');
await page.reload({ waitUntil: 'networkidle' });
if ((await page.evaluate(() => neUnit.record.answers.simulation.chosen)) !== simWrongIndex)
  throw new Error('The saved simulation answer changed');
await page.click('#neuro-unit-next');
await page.fill('#neuro-debrief', 'A recording preserves a sequence, units and timing rather than one voltage.');
await page.click('#neuro-unit-next');
await page.waitForSelector('#neuro-next-unit');
const unitLab = (await page.locator('#neunitlab').textContent()).trim();
const unitCompleted = await page.locator('#neuro-next-unit').isVisible();
if (!unitCompleted || unitLab !== 'Complete') throw new Error('Unit did not complete');
const saved = await page.evaluate(() => neUnit.record);
if (!saved.completedAt || !saved.codeWork.support.solutionAt || !saved.recall.every(r => r.draft && r.revealedAt))
  throw new Error('Completion must retain recall, code support and timestamp evidence');
if (
  !(await page.locator('#neunitstages').innerText()).includes(
    `${checks.length - 1}/${checks.length} quick checks correct`
  )
)
  throw new Error('Completion must count the preserved first answers accurately');
await assertNoHorizontalOverflow('Unit complete');

console.log(
  JSON.stringify(
    {
      viewport,
      overflowChecks,
      hero,
      mainCards,
      trackInitiallyOpen,
      showUnitsVisible,
      trackOpenedFromFoundation,
      hideUnitsVisible,
      libraryCards,
      libraryLabs,
      libraryBackText,
      subjectTopicTitles,
      subjectTopicMeta,
      subjectTopicMetaGap,
      topicBackText,
      topicNavSeparated,
      pathText,
      currentRowText,
      startEntryScrollY,
      resumedPathText,
      resumedRowText,
      continueEntryScrollY,
      unitTypeScale,
      recallSubmitSeen,
      recallContinueSeen,
      quickCheckStartLabel,
      firstAnswers,
      stageAfterQuickCheck,
      codeResult,
      stageAfterCode,
      simWrongIndex,
      unitLab,
      unitCompleted,
      errors,
    },
    null,
    2
  )
);
await browser.close();
process.exit(errors.length ? 1 : 0);
