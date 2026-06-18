import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(`${e.message}\n${e.stack?.split('\n')[1] || ''}`));

await page.addInitScript(() => localStorage.setItem('cs-seen-ver', '1.9.0'));
await page.goto('http://localhost:8765/', { waitUntil: 'networkidle' });
await page.click('[data-go="neuro"]');
await page.waitForFunction(
  () => typeof renderNeuroEngineering === 'function' && document.querySelector('.neuro-page'),
  { timeout: 15000 },
);

const hero = (await page.textContent('.neuro-hero h1'))?.trim();
const cards = await page.locator('.neuro-subcard').count();
const pathText = (await page.locator('#ne-path').textContent())?.trim();

await page.click('#ne-path');
await page.waitForSelector('#neunitstages', { timeout: 10000 });

for (let i = 0; i < 40; i++) {
  let acted = false;
  for (const sel of ['[data-reveal]', '.opt:not([disabled])', '#nesol', '#nesimdone', '#necdone', '[data-cont]']) {
    const btn = page.locator(`#neunitstages ${sel}`).last();
    if (!(await btn.count())) continue;
    await btn.click();
    await page.waitForTimeout(120);
    acted = true;
    break;
  }
  if (!acted) break;
}

const stages = await page.locator('#neunitstages .neuro-stage').count();
const hasQuiz = (await page.locator('#neunitstages .neuro-embed').count()) > 0;
const unitLab = await page.locator('#neunitlab').textContent();

console.log(JSON.stringify({ hero, cards, pathText, stages, hasQuiz, unitLab, errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);