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
  await clinicalNav.click();
  await page.waitForURL(new URL('practice', base).href);
  await page.waitForSelector('.cshift-hub');
  const clinicalShiftHeading = (await page.locator('.cshift-hub h1').textContent())?.trim();
  const clinicalRotationCount = await page.locator('[data-shift-specialty]').count();
  const clinicalLegacyClutterCount = await page.locator('.cs-config, #mixed, .cs-grid').count();
  const clinicalReviewStatus = (await page.locator('.cshift-content-status').textContent())?.trim() || '';
  if (clinicalShiftHeading !== 'Start your shift.' || clinicalRotationCount !== 3
      || clinicalLegacyClutterCount !== 0 || !clinicalReviewStatus.includes('Formal clinician review is not yet recorded')) {
    throw new Error(`Clinical Shift landing is wrong: ${JSON.stringify({ clinicalShiftHeading, clinicalRotationCount, clinicalLegacyClutterCount, clinicalReviewStatus })}`);
  }
  await assertNoOverflow('Clinical Shift hub');
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
  await page.waitForSelector('.guide-setup-hero');
  const guideEntryHeading = (await page.locator('.guide-setup-hero h1').textContent())?.trim();
  const guideTrackCount = await page.locator('[data-track]').count();
  if (guideEntryHeading !== 'Choose your pace.' || guideTrackCount !== 3) {
    throw new Error(`First MCAT visit did not open plan setup: ${JSON.stringify({ guideEntryHeading, guideTrackCount })}`);
  }
  await assertNoOverflow('Guided MCAT setup');
  await page.click('#back');
  await page.waitForSelector('.mcat-landing');
  const mcatHeading = (await page.locator('.mcat-simple-hero h1').textContent())?.trim();
  const mcatCoreToolCount = await page.locator('#mcat-core-tools [data-mcat-tool]').count();
  const mcatSupportToolCount = await page.locator('#mcat-support-tools [data-mcat-tool]').count();
  const mcatFoldCount = await page.locator('.mcat-simple-fold').count();
  const mcatOpenFoldCount = await page.locator('.mcat-simple-fold[open]').count();
  const mcatLegacyClutterCount = await page.locator('.mcat-statband, .mcat-group, .mcat-method, .mcat-extras, .mcat-closing').count();
  if (mcatHeading !== 'MCAT Prep' || mcatCoreToolCount !== 5 || mcatSupportToolCount !== 4
      || mcatFoldCount !== 2 || mcatOpenFoldCount !== 0 || mcatLegacyClutterCount !== 0) {
    throw new Error(`MCAT home is not simplified: ${JSON.stringify({ mcatHeading, mcatCoreToolCount, mcatSupportToolCount, mcatFoldCount, mcatOpenFoldCount, mcatLegacyClutterCount })}`);
  }
  await assertNoOverflow('MCAT home');
  await page.click('#mcat-core-tools [data-mcat-tool="0"]');
  await page.waitForSelector('.hero h1');
  const mcatFirstToolHeading = (await page.locator('.hero h1').textContent())?.trim();
  if (mcatFirstToolHeading !== 'Flashcard Reactor.') throw new Error(`MCAT core tool did not open: ${mcatFirstToolHeading}`);
  await page.click('#back');
  await page.waitForSelector('.mcat-landing');
  await page.click('#mc-enter');
  await page.waitForSelector('.guide-setup-hero');
  await page.click('[data-track="60"]');
  const guideSelectedTrack = (await page.locator('.guide-track.active strong').textContent())?.trim();
  await page.click('#begin');
  await page.waitForSelector('.guide-day-hero');
  const guideDayLabel = (await page.locator('.guide-day-hero > .label').textContent())?.trim();
  const guideTaskCount = await page.locator('[data-guide-task]').count();
  const guideInitialDoneCount = await page.locator('.guide-task.done').count();
  if (guideTrackCount !== 3 || guideSelectedTrack !== '60-day intensive'
      || !guideDayLabel?.includes('Day 1 of 60') || guideTaskCount < 3 || guideInitialDoneCount !== 0) {
    throw new Error(`Guided MCAT setup is wrong: ${JSON.stringify({ guideTrackCount, guideSelectedTrack, guideDayLabel, guideTaskCount, guideInitialDoneCount })}`);
  }
  await assertNoOverflow('Guided MCAT dashboard');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.guide-day-hero');
  const guideSavedGameHeading = (await page.locator('.guide-day-hero h1').textContent())?.trim();
  const guideLandingCount = await page.locator('.mcat-landing').count();
  if (guideSavedGameHeading !== 'Today’s MCAT plan' || guideLandingCount !== 0) {
    throw new Error(`Returning MCAT visit did not open the saved dashboard: ${JSON.stringify({ guideSavedGameHeading, guideLandingCount })}`);
  }
  await assertNoOverflow('Returning MCAT saved-game dashboard');
  await page.click('#guide-next');
  await page.waitForSelector('.flash-stage');
  const guideFlashProgress = (await page.locator('.topstat').textContent())?.trim() || '';
  const guideFlashTotal = Number(guideFlashProgress.split('/')[1]?.trim() || 0);
  for (let step = 0; step < 80 && !(await page.locator('#guide').count()); step++) {
    await page.click('#reveal');
    await page.click('.ratebtn.good');
  }
  await page.waitForSelector('#guide');
  const guideReturnLabel = (await page.locator('#guide').textContent())?.trim();
  await page.click('#guide');
  await page.waitForSelector('.guide-day-hero');
  const guideDoneCount = await page.locator('.guide-task.done').count();
  if (guideFlashTotal < 1 || guideReturnLabel !== "Continue today's plan →" || guideDoneCount !== 1) {
    throw new Error(`Guided MCAT completion is wrong: ${JSON.stringify({ guideFlashTotal, guideReturnLabel, guideDoneCount })}`);
  }
  await assertNoOverflow('Guided MCAT completed task');
  await page.click('#guide-next');
  await page.waitForSelector('.case .q');
  const guideDrillCrumb = (await page.locator('.run-crumb').textContent())?.replace(/\s+/g, ' ').trim();
  await page.click('#exit');
  await page.waitForSelector('.guide-day-hero');
  const guideResumeLabel = (await page.locator('#guide-next').textContent())?.trim();
  await page.click('#guide-next');
  await page.waitForSelector('.case .q');
  await page.click('#exit');
  await page.waitForSelector('.guide-day-hero');
  if (!guideDrillCrumb?.includes('Drill') || !guideDrillCrumb.includes('Structure and function of proteins') || guideResumeLabel !== 'Resume current task →') {
    throw new Error(`Guided MCAT resume is wrong: ${JSON.stringify({ guideDrillCrumb, guideResumeLabel })}`);
  }
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

  await page.goto(new URL('?gates=prod', base).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.querySelector('[data-go="reference"]')?.click());
  await page.waitForSelector('.comingsoon');
  const medicineLabel = (await page.locator('.cs-box .label').textContent())?.trim();
  if (medicineLabel !== 'Medicine · Under construction') throw new Error(`Medicine gate label is wrong: ${medicineLabel}`);
  await assertNoOverflow('Medicine gate');

  await page.goto(new URL('?gates=prod', base).href, { waitUntil: 'networkidle' });
  await page.click('.topbar.mainbar .nav > [data-go="socrates"]');
  await page.waitForURL(new URL('learn', base).href);
  await page.waitForSelector('.comingsoon');
  const learnLabel = (await page.locator('.cs-box .label').textContent())?.trim();
  const learnPrimaryActive = await page.locator('.topbar.mainbar .nav > [data-go="socrates"]').evaluate(button => button.classList.contains('active'));
  if (learnLabel !== 'Learn to Learn · Coming soon' || !learnPrimaryActive) {
    throw new Error(`Learn flagship gate is wrong: ${JSON.stringify({ learnLabel, learnPrimaryActive })}`);
  }
  await assertNoOverflow('Learn to Learn gate');
  await page.goto(new URL('learn?gates=prod', base).href, { waitUntil: 'networkidle' });
  await page.waitForSelector('.comingsoon');
  const directLearnLabel = (await page.locator('.cs-box .label').textContent())?.trim();
  if (directLearnLabel !== 'Learn to Learn · Coming soon') throw new Error(`Direct Learn gate is wrong: ${directLearnLabel}`);

  await page.goto(new URL('?gates=prod', base).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.querySelector('[data-go="neuro"]')?.click());
  await page.waitForSelector('.comingsoon');
  const neuroGateLabel = (await page.locator('.cs-box .label').textContent())?.trim();
  if (neuroGateLabel !== 'Neuroengineering · Under construction') throw new Error(`Neuro gate label is wrong: ${neuroGateLabel}`);
  await assertNoOverflow('Neuroengineering gate');

  await page.goto(new URL('?gates=prod', base).href, { waitUntil: 'networkidle' });
  await page.click('[data-menu="mcat"]');
  await page.click('[data-menu="explore"]');
  const mcatExpandedAfterExplore = await page.locator('[data-menu="mcat"]').getAttribute('aria-expanded');
  const exploreExpanded = await page.locator('[data-menu="explore"]').getAttribute('aria-expanded');
  const medicineMenuTag = (await page.locator('#explore-panel [data-go="reference"] .mi-soon').textContent())?.trim();
  const exploreLearningPaths = (await page.locator('#explore-panel .menu-group .mi-name').allTextContents()).map(label => label.trim());
  const quickLabels = (await page.locator('.menu-quick .menuquick').allTextContents()).map(label => label.trim());
  if (mcatExpandedAfterExplore !== 'false' || exploreExpanded !== 'true'
      || medicineMenuTag !== 'Under construction'
      || JSON.stringify(exploreLearningPaths) !== JSON.stringify(['Anatomy', 'Medicine'])
      || JSON.stringify(quickLabels) !== JSON.stringify(['Focus timer', 'UTSA & UT Health'])) {
    throw new Error(`Explore menu organization is wrong: ${JSON.stringify({ mcatExpandedAfterExplore, exploreExpanded, medicineMenuTag, exploreLearningPaths, quickLabels })}`);
  }
  await assertNoOverflow('Explore menu');

  const cogMenuCount = await page.locator('#explore-panel [data-go="cogpsych"]').count();
  if (cogMenuCount !== 0) throw new Error('Cognitive Psychology is still in the Explore menu');
  await page.goto(new URL('cogpsych?gates=prod', base).href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => location.pathname === '/');
  const cogRetiredCourseCount = await page.locator('.cog-course-home, .cog-simple-hero').count();
  if (cogRetiredCourseCount !== 0) throw new Error('Retired /cogpsych still renders the course');

  await page.goto(new URL('?gates=prod', base).href, { waitUntil: 'networkidle' });
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
  const priorPublicVersion = (await page.locator('.updates-history .upd-ver').first().textContent())?.trim();
  if (versionText !== `v${APP_VERSION}`
      || whatsNewTitle !== 'Clinical Shift, a taught PED course, and a saved-game MCAT hub'
      || whatsNewItems !== 10
      || priorPublicVersion !== 'v1.25.23') {
    throw new Error(`What's New is not the cumulative ${APP_VERSION} release: ${JSON.stringify({ versionText, whatsNewTitle, whatsNewItems, priorPublicVersion })}`);
  }
  await assertNoOverflow("What's New");

  if (medicineAssets.length) throw new Error(`Construction gates loaded Medicine assets: ${medicineAssets.join(', ')}`);
  if (learnAssets.length) throw new Error(`Construction gate loaded Learn to Learn assets: ${learnAssets.join(', ')}`);
  if (errors.length) throw new Error(`${viewport.name} page errors: ${errors.join(' | ')}`);
  results.push({ viewport, primaryOrder, clinicalNavLabel, clinicalNavVisibleText, clinicalShiftHeading, clinicalRotationCount, clinicalLegacyClutterCount, clinicalReviewStatus, learnVisibleText, guideEntryHeading, mcatHeading, mcatCoreToolCount, mcatSupportToolCount, mcatFoldCount, mcatOpenFoldCount, mcatLegacyClutterCount, mcatFirstToolHeading, guideTrackCount, guideSelectedTrack, guideDayLabel, guideTaskCount, guideSavedGameHeading, guideLandingCount, guideFlashTotal, guideReturnLabel, guideDoneCount, guideDrillCrumb, guideResumeLabel, mcatMenuItems, mcatMenuDescriptions, statsHeading, mcatParentActiveOnStats, statsAriaCurrent, medicineLabel, learnLabel, directLearnLabel, learnPrimaryActive, neuroGateLabel, medicineMenuTag, exploreLearningPaths, quickLabels, cogMenuCount, cogRetiredCourseCount, statsGateLabel, versionText, whatsNewTitle, whatsNewItems, priorPublicVersion, medicineAssets, learnAssets, errors });
  await context.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
