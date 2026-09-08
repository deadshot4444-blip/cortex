import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url),
  core = require('../mcat-repair-engine.js');
const data = JSON.parse(readFileSync(new URL('../data/mcat-repairs.json', import.meta.url), 'utf8'));
const base = process.env.CORTEX_URL || 'http://127.0.0.1:8805/';
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1280, 390, 320]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } }),
      page = await ctx.newPage(),
      errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"value":0}' })
    );
    const overflow = async label =>
      assert.ok(
        (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1,
        `${width}: ${label} overflow`
      );
    await page.goto(`${base}?gates=prod`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.upd-modal').count(), 0);
    assert.equal(
      (await page.locator('[data-go="socrates"] .nav-availability').innerText()).toLowerCase(),
      'coming soon'
    );
    assert.equal((await page.locator('[data-go="neuro"] .nav-availability').innerText()).toLowerCase(), 'in review');
    await overflow('homepage');
    await page.click('#m-quick');
    await page.waitForSelector('[data-repair-answer]');
    assert.ok(new URL(page.url()).pathname === '/mcat');
    assert.equal(await page.evaluate(() => localStorage.getItem('cs-mcat-plan')), null);
    await overflow('diagnostic');
    const c = data.concepts[0];
    await page.check('[name="repair-confidence"][value="sure"]');
    await page.click(`[data-repair-answer="${(c.diagnostic.answer + 1) % 4}"]`);
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('#guide-other-starts > summary');
    await page.click('[data-repair-start]');
    assert.ok((await page.locator('.repair-feedback').innerText()).includes('Not yet'));
    assert.equal(await page.locator('[data-repair-answer]:enabled').count(), 0);
    await page.click('#repair-next');
    await page.waitForSelector('.repair-lesson');
    assert.equal(await page.locator('.repair-figure svg').count(), 1);
    assert.equal(await page.locator('.repair-source a').getAttribute('href'), c.source.url);
    await overflow('lesson');
    await page.click('#repair-next');
    assert.ok((await page.locator('.repair-stem').innerText()) === c.checks[0].stem);
    await page.click(`[data-repair-answer="${c.checks[0].answer}"]`);
    await page.click('#repair-next');
    assert.equal(await page.locator('.repair-result h1').innerText(), 'Passed a new question');
    await overflow('result');
    await page.click('#repair-evidence');
    assert.equal(await page.locator('.repair-library-row').count(), 10);
    await overflow('library');
    await page.click(`[data-repair-concept="${c.id}"]`);
    await page.click('#repair-next');
    assert.ok((await page.locator('.repair-question > .label').innerText()).includes('PREVIOUSLY SEEN'));
    await page.click(`[data-repair-answer="${c.checks[0].answer}"]`);
    await page.click('#repair-next');
    await page.click('#repair-finish');
    await page.waitForSelector('.guide-welcome');
    let state = await page.evaluate(() => JSON.parse(localStorage.getItem('cs-mcat-repairs-v1')));
    assert.equal(core.unseenChecks(c, state).length, 2);
    assert.equal(core.stats(data.concepts, state).laterTotal, 0);
    await page.click('#guide-reference-options > summary');
    await page.click('#begin');
    await page.waitForSelector('.guide-day-hero');
    await page.locator('.guide-original > summary').click();
    assert.ok((await page.locator('.guide-section-head').innerText()).includes('Schedule elapsed: 0%'));
    assert.equal(await page.locator('.guide-task.done').count(), 0);
    await overflow('daily plan');
    // Seed an elapsed waiting period in this isolated test profile, then exercise the real UI.
    const oldNow = Date.now() - 2 * 86400000,
      s = core.empty();
    core.begin(c, s, 'repair', oldNow);
    core.answer(c, s, c.diagnostic.answer, 'sure', oldNow);
    s.active.phase = 'lesson';
    core.afterLesson(c, s);
    core.answer(c, s, c.checks[0].answer, 'sure', oldNow + 1);
    s.active = null;
    await page.evaluate(s => localStorage.setItem('cs-mcat-repairs-v1', JSON.stringify(s)), s);
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('Concept repair & learning evidence', { exact: true }).click();
    await page.click('[data-repair-start]');
    assert.equal(await page.locator('.repair-stem').innerText(), c.checks[1].stem);
    assert.equal(await page.locator('.repair-lesson').count(), 0);
    await page.click(`[data-repair-answer="${c.checks[1].answer}"]`);
    await page.click('#repair-next');
    assert.equal(await page.locator('.repair-result h1').innerText(), 'Passed a later check');
    await page.click('#repair-finish');
    assert.equal(await page.locator('.guide-task.done').count(), 0);
    state = await page.evaluate(() => JSON.parse(localStorage.getItem('cs-mcat-repairs-v1')));
    assert.equal(core.stats(data.concepts, state).laterCorrect, 1);
    assert.equal(core.stats(data.concepts, state).laterTotal, 1);
    // A high-confidence miss in an explicitly mapped drill selects that concept in Mistake Lab.
    await page.evaluate(() =>
      localStorage.setItem(
        'cs-mcat-log',
        JSON.stringify([
          { qId: 'cp-chem-1', category: '5A', section: 'chemPhys', ts: Date.now(), correct: false, conf: 'sure' },
        ])
      )
    );
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('#back');
    await page.click('.mcat-simple-fold summary');
    await page.click('[data-mcat-tool="5"]');
    assert.equal(await page.locator('.repair-priority h2').innerText(), 'Buffers after adding strong acid');
    await page.click('[data-repair-start]');
    const buffer = data.concepts[1];
    await page.click(`[data-repair-answer="${buffer.diagnostic.answer}"]`);
    await page.click('#repair-next');
    await page.click('#repair-next');
    await page.click(`[data-repair-answer="${(buffer.checks[0].answer + 1) % 4}"]`);
    await page.click('#repair-next');
    assert.equal(await page.locator('.repair-lesson').count(), 1);
    await page.click('#repair-next');
    assert.equal(await page.locator('.repair-result h1').innerText(), 'Needs practice');
    assert.deepEqual(errors, []);
    await ctx.close();
    console.log(
      `PASS ${width}px: quick entry, save/resume, distinct questions, later checks, plan preservation, missed-question priority, no overflow/errors`
    );
  }
  // A missing lesson file must leave core MCAT navigation usable and expose a working retry.
  const ctx = await browser.newContext(),
    page = await ctx.newPage();
  await page.route('**/data/mcat-repairs.json*', r => r.fulfill({ status: 503, body: 'unavailable' }));
  await page.goto(`${base}mcat`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.guide-welcome').count(), 1);
  assert.equal(await page.locator('[data-repair-retry]').count(), 1);
  await page.unroute('**/data/mcat-repairs.json*');
  await page.click('#guide-other-starts > summary');
  await page.click('[data-repair-retry]');
  await page.waitForSelector('[data-repair-start]');
  await ctx.close();
  console.log('PASS missing lesson file: recovery and retry');
} finally {
  await browser.close();
}
