// Synthetic local journeys for DAT planning, runners, review and offline persistence.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.env.CORTEX_URL || 'http://127.0.0.1:8873/';
assert.ok(
  new URL(base).protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(new URL(base).hostname),
  'Use an isolated local preview for synthetic study records'
);
const browser = await chromium.launch({ headless: true });
mkdirSync('output/playwright', { recursive: true });
try {
  for (const width of [1280, 390, 320]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'America/Chicago' });
    const page = await ctx.newPage(),
      errors = [],
      failed = [];
    page.setDefaultTimeout(15000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => {
      if (r.status() >= 400 && !r.url().includes('/cx-visits/')) failed.push(r.url());
    });
    // No real account or third-party calls; this context contains only synthetic work.
    await ctx.route('**/*', route =>
      new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort()
    );
    const open = async query => {
      await page.goto(base + 'dat?gates=prod&' + query);
      await page.waitForSelector('main');
    };
    const fits = async name =>
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${width}: ${name} overflow`
      );
    await open('view=plan');
    await page.locator('#dat-plan-form button[type=submit]').click();
    await page.waitForSelector('.dat-plan-week');
    await fits('schedule');
    const savedPlan = await page.evaluate(() => localStorage.getItem('cs-dat-plan'));
    await page.locator('main a[href*="view=home"]').click();
    await page.waitForSelector('.dat-landing');
    assert.equal(await page.locator('.dat-section-card').count(), 6, 'saved plan keeps all sections accessible');
    assert.ok(await page.getByRole('link', { name: 'Mistake log', exact: true }).isVisible());
    assert.equal(await page.evaluate(() => document.activeElement.tagName), 'H1', 'overview receives focus');
    await page.goBack();
    await page.waitForSelector('.dat-plan-week');
    assert.equal(await page.evaluate(() => localStorage.getItem('cs-dat-plan')), savedPlan);
    const start = await page.inputValue('#dat-plan-start');
    const plan = await page.evaluate(() => JSON.parse(localStorage.getItem('cs-dat-plan')));
    assert.equal(plan.totalHours, 220);
    assert.ok((await page.locator('.dat-plan-more a').count()) > 0, 'additional scheduled drills can launch');
    await page.locator('.dat-plan-more summary').first().click();
    await fits('expanded extra drills');
    await page.screenshot({
      path: `output/playwright/audit-dat-schedule-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    for (const [section, score] of Object.entries({ bio: 410, gchem: 390, ochem: 420, pat: 450, rc: 430, qr: 400 }))
      await page.fill('#dat-plan-score-' + section, String(score));
    await page.locator('#dat-plan-scores button').click();
    assert.equal(await page.locator('#dat-plan-focus').getAttribute('data-dat-focus'), 'gchem');
    await page.fill('#dat-plan-date', start);
    await page.locator('#dat-plan-form button[type=submit]').click();
    assert.ok((await page.locator('#dat-plan-error').innerText()).length > 0, 'invalid rebuild reports error');
    await open('view=today');
    const first = page.locator('.dat-today-tasks a').first();
    assert.ok((await first.getAttribute('href')).includes('section=gchem'));
    await first.click();
    await page.waitForSelector('.dat-opt');
    await page.locator('#dat-periodic').click();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'dat-periodic-close');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#dat-periodic-modal').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'dat-periodic');
    await page.locator('.dat-opt').first().click();
    await page.reload();
    await page.waitForSelector('.dat-explain');
    const drillBefore = await page.evaluate(() => localStorage.getItem('cs-dat-r-drill'));
    await fits('science feedback');
    await open('view=pat&subtest=keyholes&level=1&n=1');
    await page.waitForSelector('.dat-pat-opt');
    await page.locator('.dat-pat-opt').first().click();
    const patBeforeReload = await page.evaluate(() => JSON.parse(localStorage.getItem('cs-dat-r-pat')));
    await page.reload();
    await page.waitForSelector('#dat-pat-next');
    assert.equal(await page.locator('#study-save-conflict[open]').count(), 0, 'healthy PAT session resumes');
    assert.deepEqual(
      await page.evaluate(() => JSON.parse(localStorage.getItem('cs-dat-r-pat')).results),
      patBeforeReload.results,
      'reload keeps the PAT answer'
    );
    await fits('PAT feedback');
    await open('view=qr&n=1&mode=untimed');
    await page.waitForSelector('.dat-qr-opt');
    await page.locator('#dat-qr-calc-open').click();
    await page.keyboard.press('Shift+Tab');
    assert.ok(await page.locator('#dat-qr-calc').evaluate(el => el.contains(document.activeElement)));
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'dat-qr-calc-open');
    await page.locator('.dat-qr-opt').first().click();
    const qrBeforeReload = await page.evaluate(() => JSON.parse(localStorage.getItem('cs-dat-r-qr')));
    await page.reload();
    await page.waitForSelector('#dat-qr-next');
    assert.equal(await page.locator('#study-save-conflict[open]').count(), 0, 'healthy QR session resumes');
    const qrAfterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('cs-dat-r-qr')));
    assert.equal(qrAfterReload.attemptId, qrBeforeReload.attemptId, 'reload keeps the QR attempt');
    assert.deepEqual(qrAfterReload.results, qrBeforeReload.results, 'reload keeps the QR answer');
    await fits('QR feedback');
    await open('view=rc');
    await page.locator('.dat-rc-list a[data-dat-go]').first().click();
    await page.waitForSelector('.dat-rc-opt');
    await page.locator('.dat-rc-opt').first().click();
    await page.reload();
    await page.waitForSelector('.dat-rc-opt');
    assert.ok(
      (await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('cs-dat-r-rc')).answers).length)) > 0
    );
    await fits('reading passage');
    // Re-ask one item of each source through the shared review runner.
    await page.evaluate(() => {
      const bio = DAT.questions.find(q => q.section === 'bio');
      const qr = DAT.questions.find(q => q.section === 'qr');
      const p = DAT.rc.passages[0],
        rc = p.questions[0];
      const pat = DatPatCore.set('holes', 7, 2, 1)[0];
      const record = q => ({
        section: q.section,
        category: q.category,
        topic: q.topic,
        due: Date.now() - 1,
        reps: 0,
        interval: 0,
        ease: 2.5,
        lapses: 1,
        last: 0,
      });
      localStorage.setItem(
        'cs-dat-srs',
        JSON.stringify({
          [bio.id]: record(bio),
          [qr.id]: record(qr),
          [rc.id]: { ...record(rc), section: 'rc', passage: p.id },
          [pat.id]: { ...record(pat), section: 'pat', subtest: 'holes', seed: pat.seed, level: 2 },
        })
      );
    });
    await open('view=mistakes');
    const resumeCopies = await page.evaluate(() =>
      Object.fromEntries(
        ['cs-dat-r-drill', 'cs-dat-r-pat', 'cs-dat-r-qr', 'cs-dat-r-rc'].map(key => [key, localStorage.getItem(key)])
      )
    );
    assert.ok(Object.values(resumeCopies).every(Boolean), 'all four regular runners have saved work');
    await page.locator('#dat-review-start').click();
    for (let i = 0; i < 4; i++) {
      await page.waitForSelector('.dat-opt:enabled');
      await page.locator('.dat-opt').first().click();
      await fits('review ' + i);
      await page.locator('#dat-next').click();
    }
    await page.waitForSelector('.dat-review-summary');
    assert.equal(
      await page.evaluate(() => localStorage.getItem('cs-dat-r-drill')),
      drillBefore,
      'review preserves ongoing drill'
    );
    assert.deepEqual(
      await page.evaluate(
        keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])),
        Object.keys(resumeCopies)
      ),
      resumeCopies,
      'mixed mistake review preserves science, PAT, QR and RC sessions'
    );
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('cs-dat-log')).filter(r => r.source === 'review').length
      ),
      4
    );
    await open('view=today');
    const done = page.locator('[data-dat-plan-done]').first();
    await done.click();
    await page.reload();
    await page.waitForSelector('.dat-today');
    assert.ok(
      (await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('cs-dat-plan')).done).length)) > 0
    );
    await fits('today');
    await page.screenshot({
      path: `output/playwright/audit-dat-today-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    console.log(
      `${width}: schedule/rebuild/focus, four runners, review isolation, persisted completion, modal focus and overflow passed`
    );
    await ctx.close();
  }
} finally {
  await browser.close();
}
