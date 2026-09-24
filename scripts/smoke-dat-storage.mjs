// Fresh-profile DAT backup/restore and real service-worker offline journey.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.env.CORTEX_URL || 'http://127.0.0.1:8873/';
assert.ok(new URL(base).protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Chicago' });
  const page = await ctx.newPage(),
    errors = [];
  page.setDefaultTimeout(20000);
  page.on('pageerror', e => errors.push(e.message));
  await ctx.route('**/*.supabase.co/**', r => r.abort());
  await page.goto(base + 'dat?gates=prod&view=plan');
  await page.locator('#dat-plan-form button[type=submit]').click();
  await page.waitForSelector('.dat-plan-week');
  const originalPlan = await page.evaluate(() => localStorage.getItem('cs-dat-plan'));
  await page.goto(base + 'dat?gates=prod&view=drill&section=bio&n=1&mode=untimed');
  await page.locator('.dat-opt').first().click();
  await page.goto(base + 'academy?gates=prod&view=storage');
  await page.locator('#storage-export').click();
  await page.waitForSelector('#storage-download a');
  const file = await page.locator('#storage-download a').evaluate(async a => (await fetch(a.href)).text());
  const data = JSON.parse(file).data;
  assert.equal(data['cs-dat-plan'], originalPlan);
  assert.equal(JSON.parse(data['cs-dat-log']).length, 1);
  assert.ok(data['cs-dat-r-drill']);
  assert.ok(!Object.keys(data).some(k => /token|cortex-progress/.test(k)));
  await page.goto(base + 'dat?gates=prod&view=plan');
  await page.fill('#dat-plan-hours', '3');
  await page.locator('#dat-plan-form button[type=submit]').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('cs-dat-plan')).hoursPerWeek === 3);
  await page.goto(base + 'academy?gates=prod&view=storage');
  await page
    .locator('#storage-file')
    .setInputFiles({ name: 'synthetic-study.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  await page.waitForSelector('[data-confirm]');
  await page.locator('[data-confirm]').check();
  await page.locator('[data-apply]').click();
  await page.waitForSelector('#storage-export');
  assert.equal(await page.evaluate(() => localStorage.getItem('cs-dat-plan')), originalPlan);
  for (const key of ['cs-dat-log', 'cs-dat-q', 'cs-dat-r-drill'])
    assert.equal(await page.evaluate(k => localStorage.getItem(k), key), data[key]);
  const tampered = JSON.parse(file);
  tampered.data['cs-dat-plan'] = '{}';
  await page.locator('#storage-file').setInputFiles({
    name: 'changed-study.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(tampered)),
  });
  await page.waitForFunction(() =>
    document.querySelector('#storage-import-status')?.textContent.includes('integrity check failed')
  );
  assert.equal(await page.locator('[data-apply]').count(), 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('cs-dat-plan')), originalPlan);
  console.log('DAT backup round trip preserved plan/log/history/resume; tampered import refused without mutation');
  const card = page
    .locator('#offline-catalog .offline-course')
    .filter({ has: page.getByRole('heading', { name: 'DAT preparation', exact: true }) });
  await card.getByRole('button', { name: 'Download course', exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('#offline-status')?.textContent.includes('Download finished'),
    null,
    { timeout: 60000 }
  );
  await page.getByRole('button', { name: 'Refresh download list', exact: true }).click();
  const link = page.locator('#offline-saved a').filter({ hasText: 'Open downloaded course' });
  await link.waitFor();
  const href = await link.getAttribute('href');
  await link.click();
  await page.waitForSelector('.dat-today');
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('.dat-today');
  assert.ok(new URL(page.url()).searchParams.get('offline'));
  await page.locator('.dat-today-tasks a').first().click();
  await page.waitForSelector('.dat-pat-opt');
  await page.locator('.dat-pat-opt').first().click();
  await page.reload();
  await page.waitForSelector('.dat-pat-opt:disabled');
  assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('cs-dat-log')).some(r => r.section === 'pat')));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  mkdirSync('output/playwright', { recursive: true });
  await page.screenshot({
    path: 'output/playwright/audit-dat-offline-390.png',
    fullPage: true,
    animations: 'disabled',
  });
  assert.deepEqual(errors, []);
  console.log(
    'Downloaded DAT with verified hashes; offline reload, PAT answer and persisted resume passed at 390px: ' + href
  );
  await ctx.close();
} finally {
  await browser.close();
}
