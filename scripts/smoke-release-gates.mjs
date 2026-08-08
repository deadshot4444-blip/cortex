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
  const learnAssets = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/\/(reference|performance-drugs|ekg)\.js(?:\?|$)/.test(request.url())) medicineAssets.push(request.url());
    if (/\/(socrates\.js|data\/learn-to-learn\.json)(?:\?|$)/.test(request.url())) learnAssets.push(request.url());
  });
  await page.addInitScript(version => localStorage.setItem('cs-seen-ver', version), APP_VERSION);

  const assertNoOverflow = async label => {
    const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
    if (overflow > 1) throw new Error(`${viewport.name} ${label} has ${overflow}px horizontal overflow`);
  };

  await page.goto(base.href, { waitUntil: 'networkidle' });
  const primaryOrder = await page.locator('.topbar.mainbar .nav').evaluate(nav => [...nav.children].map(child => {
    const button = child.matches('button.navlink') ? child : child.querySelector(':scope > button.menubtn');
    return button?.getAttribute('aria-label') || button?.textContent?.replace('▾', '').trim();
  }));
  const expectedPrimaryOrder = ['MCAT', 'Clinical Scenarios', 'Learn to Learn', 'Explore'];
  const learnPrimaryCount = await page.locator('.topbar.mainbar .nav > [data-go="socrates"]').count();
  const learnExploreCount = await page.locator('#explore-panel [data-go="socrates"]').count();
  const topLevelStatsCount = await page.locator('.topbar.mainbar .nav > [data-go="stats"]').count();
  const learnVisibleText = await page.locator('.topbar.mainbar .nav > [data-go="socrates"]').evaluate(button => [...button.children]
    .find(child => getComputedStyle(child).display !== 'none')?.textContent?.trim());
  const expectedLearnText = viewport.name === 'mobile' ? 'Learn' : 'Learn to Learn';
  if (JSON.stringify(primaryOrder) !== JSON.stringify(expectedPrimaryOrder)
      || learnPrimaryCount !== 1 || learnExploreCount !== 0 || topLevelStatsCount !== 0
      || learnVisibleText !== expectedLearnText) {
    throw new Error(`Primary navigation hierarchy is wrong: ${JSON.stringify({ primaryOrder, learnPrimaryCount, learnExploreCount, topLevelStatsCount, learnVisibleText, expectedLearnText })}`);
  }
  const clinicalNav = page.locator('[data-go="practice"]');
  const clinicalNavLabel = await clinicalNav.getAttribute('aria-label');
  const clinicalNavVisibleText = await clinicalNav.evaluate(button => [...button.children]
    .find(child => getComputedStyle(child).display !== 'none')?.textContent?.trim());
  const expectedClinicalNavText = viewport.name === 'mobile' ? 'Clinical' : 'Clinical Scenarios';
  if (clinicalNavLabel !== 'Clinical Scenarios' || clinicalNavVisibleText !== expectedClinicalNavText) {
    throw new Error(`Clinical navigation label is wrong: ${JSON.stringify({ clinicalNavLabel, clinicalNavVisibleText, expectedClinicalNavText })}`);
  }
  await page.click('[data-menu="mcat"]');
  await page.waitForSelector('#mcat-panel:not([hidden])');
  const mcatMenuItems = (await page.locator('#mcat-panel .mi-name').allTextContents()).map(label => label.trim());
  const mcatMenuDescriptions = (await page.locator('#mcat-panel .mi-desc').allTextContents()).map(label => label.trim());
  if (JSON.stringify(mcatMenuItems) !== JSON.stringify(['MCAT Prep', 'Stats'])
      || JSON.stringify(mcatMenuDescriptions) !== JSON.stringify(['Forever-free study suite', 'Progress dashboard'])) {
    throw new Error(`MCAT menu organization is wrong: ${JSON.stringify({ mcatMenuItems, mcatMenuDescriptions })}`);
  }
  await assertNoOverflow('MCAT menu');
  await page.click('#mcat-panel [data-go="mcat"]');
  await page.waitForURL(new URL('mcat', base).href);
  await page.waitForSelector('.mcat-landing');
  await page.click('[data-menu="mcat"]');
  await page.click('#mcat-panel [data-go="stats"]');
  await page.waitForURL(new URL('stats', base).href);
  await page.waitForSelector('.hero h1');
  const statsHeading = (await page.locator('.hero h1').textContent())?.trim();
  const mcatParentActiveOnStats = await page.locator('[data-menu="mcat"]').evaluate(button => button.classList.contains('active'));
  await page.click('[data-menu="mcat"]');
  const statsAriaCurrent = await page.locator('#mcat-panel [data-go="stats"]').getAttribute('aria-current');
  await page.keyboard.press('Escape');
  const mcatClosedByEscape = await page.locator('#mcat-panel').evaluate(panel => panel.hidden);
  const focusedMenuAfterEscape = await page.evaluate(() => document.activeElement?.getAttribute('data-menu'));
  if (statsHeading !== 'Stats.' || !mcatParentActiveOnStats || statsAriaCurrent !== 'page'
      || !mcatClosedByEscape || focusedMenuAfterEscape !== 'mcat') {
    throw new Error(`MCAT/Stats navigation is wrong: ${JSON.stringify({ statsHeading, mcatParentActiveOnStats, statsAriaCurrent, mcatClosedByEscape, focusedMenuAfterEscape })}`);
  }

  await page.goto(base.href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.querySelector('[data-go="reference"]')?.click());
  await page.waitForSelector('.comingsoon');
  const medicineLabel = (await page.locator('.cs-box .label').textContent())?.trim();
  if (medicineLabel !== 'Medicine · Under construction') throw new Error(`Medicine gate label is wrong: ${medicineLabel}`);
  await assertNoOverflow('Medicine gate');

  await page.goto(base.href, { waitUntil: 'networkidle' });
  await page.click('.topbar.mainbar .nav > [data-go="socrates"]');
  await page.waitForURL(new URL('learn', base).href);
  await page.waitForSelector('.comingsoon');
  const learnLabel = (await page.locator('.cs-box .label').textContent())?.trim();
  const learnPrimaryActive = await page.locator('.topbar.mainbar .nav > [data-go="socrates"]').evaluate(button => button.classList.contains('active'));
  if (learnLabel !== 'Learn to Learn · Under construction' || !learnPrimaryActive) {
    throw new Error(`Learn flagship gate is wrong: ${JSON.stringify({ learnLabel, learnPrimaryActive })}`);
  }
  await assertNoOverflow('Learn to Learn gate');
  await page.goto(new URL('learn', base).href, { waitUntil: 'networkidle' });
  await page.waitForSelector('.comingsoon');
  const directLearnLabel = (await page.locator('.cs-box .label').textContent())?.trim();
  if (directLearnLabel !== 'Learn to Learn · Under construction') throw new Error(`Direct Learn gate is wrong: ${directLearnLabel}`);

  await page.goto(base.href, { waitUntil: 'networkidle' });
  await page.click('[data-menu="mcat"]');
  await page.click('[data-menu="explore"]');
  const mcatExpandedAfterExplore = await page.locator('[data-menu="mcat"]').getAttribute('aria-expanded');
  const exploreExpanded = await page.locator('[data-menu="explore"]').getAttribute('aria-expanded');
  const medicineMenuTag = (await page.locator('#explore-panel [data-go="reference"] .mi-soon').textContent())?.trim();
  const exploreLearningPaths = (await page.locator('#explore-panel .menu-group .mi-name').allTextContents()).map(label => label.trim());
  const quickLabels = (await page.locator('.menu-quick .menuquick').allTextContents()).map(label => label.trim());
  if (mcatExpandedAfterExplore !== 'false' || exploreExpanded !== 'true'
      || medicineMenuTag !== 'Under construction'
      || JSON.stringify(exploreLearningPaths) !== JSON.stringify(['Anatomy', 'Medicine', 'Cognitive Psychology'])
      || JSON.stringify(quickLabels) !== JSON.stringify(['Focus timer', 'UTSA & UT Health'])) {
    throw new Error(`Explore menu organization is wrong: ${JSON.stringify({ mcatExpandedAfterExplore, exploreExpanded, medicineMenuTag, exploreLearningPaths, quickLabels })}`);
  }
  await assertNoOverflow('Explore menu');

  await page.goto(base.href, { waitUntil: 'networkidle' });
  await page.click('[data-menu="mcat"]');
  await page.click('#mcat-panel [data-go="stats"]');
  await page.waitForSelector('#stats-medpath');
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
  if (learnAssets.length) throw new Error(`Construction gate loaded Learn to Learn assets: ${learnAssets.join(', ')}`);
  if (errors.length) throw new Error(`${viewport.name} page errors: ${errors.join(' | ')}`);
  results.push({ viewport, primaryOrder, clinicalNavLabel, clinicalNavVisibleText, learnVisibleText, mcatMenuItems, mcatMenuDescriptions, statsHeading, mcatParentActiveOnStats, statsAriaCurrent, medicineLabel, learnLabel, directLearnLabel, learnPrimaryActive, medicineMenuTag, exploreLearningPaths, quickLabels, statsGateLabel, versionText, whatsNewTitle, whatsNewItems, medicineAssets, learnAssets, errors });
  await context.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
