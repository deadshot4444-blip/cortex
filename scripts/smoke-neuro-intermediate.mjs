/* The intermediate tier and the module checkpoints in a real browser: a NumPy exercise checked by the
 * real in-browser Python, a checkpoint passed and retaken, and the new screens on a phone. The draw,
 * the scoring and every exercise's cases are proved in scripts/test-neuro-intermediate.cjs. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.env.CORTEX_URL || 'http://localhost:8765/';
const APP_VERSION =
  (readFileSync(new URL('../app.js', import.meta.url), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || '';
const data = JSON.parse(readFileSync(new URL('../data/neuro.json', import.meta.url), 'utf8'));
const byPrompt = Object.fromEntries(
  Object.values(data.unitLessons).flatMap(unit => unit.checks.map(question => [question.prompt, question]))
);
const errors = [];
const report = {};
const fail = message => {
  throw new Error(message);
};

const browser = await chromium.launch({ headless: true });
async function open(options, query, ready) {
  const context = await browser.newContext(options);
  await context.addInitScript(version => localStorage.setItem('cs-seen-ver', version), APP_VERSION);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`${query}: ${error.message}`));
  await page.goto(`${BASE}neuro?${query}`, { waitUntil: 'load' });
  await page.waitForSelector(ready, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  return page;
}
const overflow = page => page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
const desktop = { viewport: { width: 1280, height: 900 } };
const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };

/* ----- a NumPy exercise, checked by the real in-browser Python ----- */
{
  const lesson = data.neuroCodeLessons.find(item => item.id === 'code-np-moving-average');
  const page = await open(desktop, `code=${lesson.id}`, '#neuro-code-editor');
  const status = () => page.locator('[data-py-status]').innerText();
  const settle = pattern =>
    page.waitForFunction(
      source => new RegExp(source).test(document.querySelector('[data-py-status]').innerText),
      pattern.source,
      { timeout: 120000 }
    );
  if ((await page.locator('.nx-tag-tier').innerText()) !== 'Intermediate · NumPy') fail('The tier tag is missing');
  await page.click('[data-check-code]');
  await settle(/input cases passed|No pass|could not/);
  const starter = await status();
  if (!/^\d\/7 input cases passed\.$/.test(starter) || starter.startsWith('7/7'))
    fail('The untouched starter should run with NumPy and fail some cases: ' + starter);
  await page.fill('#neuro-code-editor', lesson.solution);
  await page.click('[data-check-code]');
  await settle(/^7\/7 input cases passed\.$|No pass|could not/);
  if ((await status()) !== '7/7 input cases passed.') fail('The NumPy solution did not pass: ' + (await status()));
  if ((await page.locator('[data-check-results] li').count()) !== 7) fail('Seven result rows expected');
  await page.click('[data-run-code]');
  await settle(/Run complete|could not|stopped/);
  const printed = (await page.locator('[data-term-log]').textContent()).trim();
  if (printed !== lesson.expectedOutput) fail(`Printed ${JSON.stringify(printed)}, expected ${lesson.expectedOutput}`);
  if ((await overflow(page)) > 1) fail('The exercise page overflows');
  report.numpy = { starter, solution: '7/7', printed };
  await page.context().close();
}

/* ----- a checkpoint: pass it, then take a new mix ----- */
async function answerAll(page, wrong = 0) {
  const count = await page.locator('#necpquestions [data-q]').count();
  for (let n = 0; n < count; n++) {
    const block = page.locator(`#necpquestions [data-q="${n}"]`),
      question = byPrompt[await block.locator('p.q').innerText()];
    if (!question) fail('A checkpoint question is not one of the course questions');
    const pick = n < wrong ? (question.correctIndex + 1) % question.choices.length : question.correctIndex;
    await block.locator(`[data-cp-choice="${pick}"]`).click();
    await block.locator('.explain').waitFor();
  }
  return count;
}
{
  const page = await open(desktop, 'checkpoint=signals', '#necpquestions [data-q]');
  const units = await page.locator('.nx-q-n').allInnerTexts();
  if (units.length !== 6 || new Set(units.map(text => text.split('· ')[1])).size !== 5)
    fail('Six questions covering all five units expected: ' + units.join(' | '));
  await page.locator('[data-q="0"] [data-cp-choice]').first().focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-q="0"] .explain').waitFor();
  if (!(await page.evaluate(() => document.activeElement.classList.contains('explain'))))
    fail('Focus should move to the explanation of the answered question');
  const before = await page.evaluate(() => scrollY);
  if ((await page.locator('#necpmeta').innerText()).toLowerCase() !== '1 of 6 answered') fail('Progress line is wrong');
  await page.reload();
  await page.waitForSelector('#necpquestions [data-q]');
  if ((await page.locator('[data-q="0"] .explain').count()) !== 1) fail('An answer did not survive a reload');
  const first = await page.evaluate(() => JSON.parse(localStorage.getItem('cs-neuro')).checkpoints.signals);
  const firstRight = first.current.answers[first.current.ids[0]] === byId(first.current.ids[0]).correctIndex ? 1 : 0;
  for (let n = 1; n < 6; n++) {
    const block = page.locator(`#necpquestions [data-q="${n}"]`),
      question = byPrompt[await block.locator('p.q').innerText()];
    await block.locator(`[data-cp-choice="${question.correctIndex}"]`).click();
    await block.locator('.explain').waitFor();
  }
  await page.waitForSelector('#necpresult');
  const score = await page.locator('.nx-cp-score').innerText();
  if (score !== `${5 + firstRight} of 6`) fail('Score is wrong: ' + score);
  if (!(await page.evaluate(() => document.activeElement.id === 'necpresult'))) fail('Focus should move to the result');
  if (!(await page.locator('#necpresult.is-passed').count())) fail('Five or six right should pass');
  await page.click('#necpretake');
  await page.waitForFunction(() => /^0 of 6 answered/i.test(document.querySelector('#necpmeta').innerText));
  const second = await page.evaluate(() => JSON.parse(localStorage.getItem('cs-neuro')).checkpoints.signals);
  const repeated = second.current.ids.filter(id => first.current.ids.includes(id)).length;
  if (repeated !== 2) fail(`A retake should repeat two questions, not ${repeated}`);
  await answerAll(page, 2);
  await page.waitForSelector('#necpresult');
  if ((await page.locator('.nx-cp-score').innerText()) !== '4 of 6')
    fail('A retake with two misses should score 4 of 6');
  if (!/Your earlier pass still stands\.$/.test(await page.locator('.nx-cp-take').innerText()))
    fail('An earlier pass should be kept');
  if ((await page.locator('[data-cp-unit]').count()) < 1) fail('A short attempt should offer the units to review');
  if ((await overflow(page)) > 1) fail('The checkpoint page overflows');
  // The module page and the hub show the saved result.
  await page.click('#neback');
  await page.waitForSelector('[data-checkpoint="signals"]');
  if (!/passed · best \d\/6/i.test(await page.locator('[data-checkpoint="signals"]').innerText()))
    fail('The module page should show the pass');
  if ((await page.locator('.neuro-module .neuro-rows [data-code]').count()) !== 2)
    fail('The module page should list its two NumPy exercises');
  report.checkpoint = { first: score, second: '4 of 6', repeated, scrolledAt: before };
  await page.context().close();
}
function byId(id) {
  return Object.values(data.unitLessons)
    .flatMap(unit => unit.checks)
    .find(question => question.id === id);
}

/* ----- phone: the new screens fit, and a checkpoint works by touch ----- */
{
  const page = await open(phone, 'checkpoint=decoding', '#necpquestions [data-q]');
  if ((await overflow(page)) > 1) fail('The checkpoint overflows on a phone');
  const small = await page.evaluate(
    () =>
      [...document.querySelectorAll('main [data-cp-choice]')].filter(node => node.getBoundingClientRect().height < 44)
        .length
  );
  if (small) fail(`${small} answer buttons are under 44px tall on a phone`);
  await answerAll(page);
  await page.waitForSelector('#necpresult.is-passed');
  if ((await overflow(page)) > 1) fail('The checkpoint result overflows on a phone');
  for (const [query, ready] of [
    ['view=code', '#necodelab-numpy [data-code]'],
    ['module=decoding', '[data-checkpoint="decoding"]'],
    ['code=code-np-decode-trials', '#neuro-code-editor'],
    ['', '[data-checkpoint]'],
  ]) {
    await page.goto(`${BASE}neuro?${query}`, { waitUntil: 'load' });
    await page.waitForSelector(ready, { timeout: 20000, state: 'attached' });
    // On a phone the hub keeps its unit list folded until asked.
    await page.evaluate(() => document.querySelectorAll('details#ne-track').forEach(node => (node.open = true)));
    await page.waitForSelector(ready, { timeout: 20000 });
    const over = await overflow(page);
    if (over > 1) fail(`neuro?${query} overflows by ${over}px on a phone`);
  }
  if ((await page.locator('[data-checkpoint]').count()) !== 4) fail('The hub should show four checkpoint rows');
  await page.context().close();
}

console.log(JSON.stringify({ report, errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
