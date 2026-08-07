import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const APP_VERSION = (readFileSync(new URL('../app.js', import.meta.url), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || '';
const base = new URL(process.env.CORTEX_URL || 'http://localhost:8765/');
const viewports = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });
const results = [];

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  const medicineAssets = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/\/(reference|performance-drugs|ekg)\.js(?:\?|$)/.test(request.url())) medicineAssets.push(request.url());
  });
  await page.addInitScript(version => localStorage.setItem('cs-seen-ver', version), APP_VERSION);

  const assertNoOverflow = async label => {
    const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
    if (overflow > 1) throw new Error(`${viewport.name} ${label} has ${overflow}px horizontal overflow`);
  };

  await page.goto(base.href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.querySelector('[data-go="reference"]')?.click());
  await page.waitForSelector('.comingsoon');
  const medicineLabel = (await page.locator('.cs-box .label').textContent())?.trim();
  if (medicineLabel !== 'Medicine · Under construction') throw new Error(`Medicine gate label is wrong: ${medicineLabel}`);
  await assertNoOverflow('Medicine gate');

  await page.goto(base.href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.querySelector('[data-go="socrates"]')?.click());
  await page.waitForSelector('.comingsoon');
  const learnLabel = (await page.locator('.cs-box .label').textContent())?.trim();
  if (learnLabel !== 'Learn to Learn · Under construction') throw new Error(`Learn gate label is wrong: ${learnLabel}`);
  await assertNoOverflow('Learn to Learn gate');

  await page.goto(base.href, { waitUntil: 'networkidle' });
  await page.click('[data-menu]');
  const medicineMenuTag = (await page.locator('[data-go="reference"] .mi-soon').textContent())?.trim();
  const learnMenuTag = (await page.locator('[data-go="socrates"] .mq-soon').textContent())?.trim();
  if (medicineMenuTag !== 'Under construction' || learnMenuTag !== 'Under construction') {
    throw new Error(`Construction menu tags are wrong: ${JSON.stringify({ medicineMenuTag, learnMenuTag })}`);
  }
  await assertNoOverflow('Explore menu');

  await page.goto(base.href, { waitUntil: 'networkidle' });
  await page.click('[data-go="stats"]');
  await page.click('#stats-medpath');
  await page.waitForSelector('.comingsoon');
  const statsGateLabel = (await page.locator('.cs-box .label').textContent())?.trim();
  if (statsGateLabel !== 'Medicine · Under construction') throw new Error(`Stats bypassed the Medicine gate: ${statsGateLabel}`);

  await page.click('button.ver');
  await page.waitForSelector('.upd-featured');
  const versionText = (await page.locator('button.ver').textContent())?.trim();
  const whatsNewTitle = (await page.locator('.upd-featured h2').textContent())?.trim();
  const whatsNewItems = await page.locator('.upd-featured-list li').count();
  if (versionText !== `v${APP_VERSION}` || whatsNewItems !== 6) {
    throw new Error(`What's New is not the complete ${APP_VERSION} release: ${JSON.stringify({ versionText, whatsNewTitle, whatsNewItems })}`);
  }
  await assertNoOverflow("What's New");

  if (medicineAssets.length) throw new Error(`Construction gates loaded Medicine assets: ${medicineAssets.join(', ')}`);
  if (errors.length) throw new Error(`${viewport.name} page errors: ${errors.join(' | ')}`);
  results.push({ viewport, medicineLabel, learnLabel, medicineMenuTag, learnMenuTag, statsGateLabel, versionText, whatsNewTitle, whatsNewItems, medicineAssets, errors });
  await context.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
