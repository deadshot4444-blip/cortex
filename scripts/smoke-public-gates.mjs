// Public gate smoke: with production gating forced (`?gates=prod`), the closed courses
// (Learn to Learn, Anatomy, Medicine, Neuroengineering) show their Under construction page from
// the navigation, the Academy catalog and direct deep links; MCAT and Clinical Scenarios stay
// open; none of the closed courses' modules are downloaded; Academy Today and the offline
// download list reflect the same catalog. Runs at desktop and phone widths.
//
//   CORTEX_URL=http://127.0.0.1:8807/ node scripts/smoke-public-gates.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const APP_VERSION =
  (readFileSync(new URL('../app.js', import.meta.url), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || '';
const base = new URL(process.env.CORTEX_URL || 'http://localhost:8765/');
const viewports = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
// `label` is the gate-chip half and must be byte-identical to SECTION_INFO[key].label in app.js.
const CLOSED = {
  dat: { path: 'dat', label: 'DAT', deep: 'view=pat&subtest=angles' },
  socrates: { path: 'learn', label: 'Learn to Learn', deep: 'track=general&lesson=remember' },
  anatomy: { path: 'anatomy', label: 'Anatomy', deep: 'lesson=arm' },
  reference: { path: 'medicine', label: 'Medicine', deep: 'lesson=med-flow-resistance&step=4' },
  neuro: { path: 'neuro', label: 'Neuroengineering', deep: 'unit=1' },
};
const CLOSED_ASSETS =
  /\/(dat(?:-[a-z-]+)?|socrates|anatomy|reference|ekg|ecg-engine|performance-drugs|neuro|neuro-practitioner|neuro-project-engine|python-runtime|code-evaluator)\.js(?:\?|$)|\/data\/(dat-[a-z0-9-]+|learn-to-learn|neuro-projects)\.json/;
// Every file that only a closed course's offline pack ships (data banks, figures, workers) is a
// leak too; derive the list from the manifest so new content is covered automatically.
const manifest = JSON.parse(readFileSync(new URL('../offline-manifest.json', import.meta.url), 'utf8'));
const openFiles = new Set(manifest.packs.filter(p => !(p.id in CLOSED)).flatMap(p => p.files.map(f => f.url)));
const closedOnlyFiles = new Set(
  manifest.packs
    .filter(p => p.id in CLOSED)
    .flatMap(p => p.files.map(f => f.url))
    .filter(url => !openFiles.has(url))
);
const isClosedAsset = url => {
  const path = new URL(url).pathname;
  return CLOSED_ASSETS.test(url) || closedOnlyFiles.has(path);
};

const prod = path => new URL(path + (path.includes('?') ? '&' : '?') + 'gates=prod', base).href;
const browser = await chromium.launch({ headless: true });
const results = [];
const fail = (label, detail) => {
  throw new Error(`${label}: ${JSON.stringify(detail)}`);
};

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [],
    closedAssets = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (isClosedAsset(request.url())) closedAssets.push(request.url());
  });
  await page.addInitScript(version => localStorage.setItem('cs-seen-ver', version), APP_VERSION);
  const noOverflow = async label => {
    const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
    if (overflow > 1) fail(`${viewport.name} ${label} horizontal overflow`, overflow);
  };
  const gateLabel = async label => {
    await page.waitForSelector('.comingsoon .cs-box .label');
    const text = (await page.locator('.cs-box .label').textContent())?.trim();
    if (text !== `${label} · Under construction`) fail(`${label} gate label`, text);
    await noOverflow(`${label} gate`);
    return text;
  };
  const record = { viewport: viewport.name };

  // Navigation pills and Explore menu tags.
  await page.goto(prod('/'), { waitUntil: 'networkidle' });
  record.learnPill = (
    await page.locator('.topbar.mainbar .nav > [data-go="socrates"] .nav-availability').textContent()
  )?.trim();
  record.learnAria = await page.locator('.topbar.mainbar .nav > [data-go="socrates"]').getAttribute('aria-description');
  record.neuroPill = (await page.locator('[data-go="neuro"] .nav-availability').first().textContent())?.trim();
  if (record.learnPill !== 'In review' || record.learnAria !== 'Under construction' || record.neuroPill !== 'In review')
    fail('navigation availability pills', record);
  await page.click('[data-menu="explore"]');
  record.exploreTags = await page.locator('#explore-panel .menuitem .mi-soon').allTextContents();
  if (
    JSON.stringify(record.exploreTags.map(t => t.trim())) !==
    JSON.stringify(['Under construction', 'Under construction'])
  )
    fail('Explore menu tags', record.exploreTags);
  await page.keyboard.press('Escape');

  // Closed courses from the navigation.
  await page.click('.topbar.mainbar .nav > [data-go="socrates"]');
  await page.waitForURL(url => url.pathname === '/learn');
  record.learnFromNav = await gateLabel('Learn to Learn');
  await page.goto(prod('/'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.querySelector('[data-go="neuro"]')?.click());
  record.neuroFromNav = await gateLabel('Neuroengineering');
  for (const key of ['anatomy', 'reference']) {
    await page.goto(prod('/'), { waitUntil: 'networkidle' });
    await page.click('[data-menu="explore"]');
    await page.click(`#explore-panel [data-go="${key}"]`);
    record[key + 'FromMenu'] = await gateLabel(CLOSED[key].label);
  }

  // Closed courses from direct and deep links.
  record.deepLinks = {};
  for (const [key, course] of Object.entries(CLOSED)) {
    await page.goto(prod('/' + course.path), { waitUntil: 'networkidle' });
    await gateLabel(course.label);
    await page.goto(prod('/' + course.path + '?' + course.deep), { waitUntil: 'networkidle' });
    record.deepLinks[key] = await gateLabel(course.label);
    const buttons = await page.locator('.cs-box .endbtns button').allTextContents();
    if (buttons.length !== 2) fail(`${course.label} gate exits`, buttons);
    // A deep link carries a lesson/unit context; the gate must not grow a related-lessons aside.
    const asides = await page.locator('main.comingsoon .connect-context').count();
    if (asides !== 0) fail(`${course.label} gate shows related-lesson discovery`, asides);
  }
  await page.click('#cs-prac');
  await page.waitForURL(url => url.pathname === '/practice');
  await page.waitForSelector('.cshift-hub', { timeout: 15000 });
  record.gateClinicalExit = (await page.locator('.cshift-hub h1').textContent())?.trim();
  if (!record.gateClinicalExit) fail('gate Clinical scenarios exit', record.gateClinicalExit);

  // Academy catalog, Today, lesson discovery and offline downloads.
  await page.goto(prod('/academy'), { waitUntil: 'networkidle' });
  await page.waitForSelector('.academy-catalog');
  record.catalogStatuses = (await page.locator('.academy-catalog .academy-status').allTextContents()).map(t =>
    t.trim()
  );
  record.catalogActions = (await page.locator('.academy-course-bottom a').allTextContents()).map(t =>
    t.replace(/\s*→\s*$/, '').trim()
  );
  if (
    JSON.stringify(record.catalogStatuses) !==
      JSON.stringify([
        'Beta',
        'Under construction',
        'Under construction',
        'Beta',
        'Under construction',
        'Under construction',
        'Under construction',
      ]) ||
    record.catalogActions.filter(t => t === 'View course status').length !== 5
  )
    fail('Academy catalog', { statuses: record.catalogStatuses, actions: record.catalogActions });
  await noOverflow('Academy catalog');
  await page.click('.academy-catalog h2 a[data-course="anatomy"]');
  record.anatomyFromCatalog = await gateLabel('Anatomy');

  await page.goto(prod('/academy?view=today'), { waitUntil: 'networkidle' });
  await page.waitForSelector('.academy-priorities');
  record.todayDisabled = await page
    .locator('.academy-priorities input[data-track]:disabled')
    .evaluateAll(nodes => nodes.map(n => n.dataset.track));
  record.todayEnabled = await page
    .locator('.academy-priorities input[data-track]:not(:disabled)')
    .evaluateAll(nodes => nodes.map(n => n.dataset.track));
  if (
    JSON.stringify([...record.todayDisabled].sort()) !== JSON.stringify(Object.keys(CLOSED).sort()) ||
    JSON.stringify([...record.todayEnabled].sort()) !== JSON.stringify(['mcat', 'practice'])
  )
    fail('Academy Today priorities', { disabled: record.todayDisabled, enabled: record.todayEnabled });
  record.todayClosedResumeLinks = await page
    .locator('#academy-recorded ~ details a[data-resume]')
    .evaluateAll(nodes => nodes.map(n => n.dataset.resume).filter(id => !['mcat', 'practice'].includes(id)));
  if (record.todayClosedResumeLinks.length)
    fail('Academy Today resume links into closed courses', record.todayClosedResumeLinks);
  await noOverflow('Academy Today');

  await page.goto(prod('/academy?view=curriculum&track=anatomy&scope=drafts'), { waitUntil: 'networkidle' });
  await page.waitForSelector('.connect-meta');
  record.discoveryMeta = (await page.locator('.connect-meta').first().textContent())?.trim();
  if (!record.discoveryMeta?.includes('Under construction')) fail('lesson discovery status', record.discoveryMeta);
  await page.locator('.academy-course h3 a').first().click();
  record.anatomyFromDiscovery = await gateLabel('Anatomy');

  await page.goto(prod('/academy?view=storage'), { waitUntil: 'networkidle' });
  await page.waitForSelector('#offline-catalog .offline-course h3, #offline-catalog p', { timeout: 15000 });
  record.downloads = (await page.locator('#offline-catalog .offline-course h3').allTextContents()).map(t => t.trim());
  if (JSON.stringify(record.downloads) !== JSON.stringify(['MCAT preparation', 'Clinical Scenarios']))
    fail('offline download catalog', record.downloads);
  await noOverflow('Study backups & offline downloads');

  // Open courses stay open; the version badge shows the local build. The homepage's clinical
  // button must change the URL to /practice before Clinical Shift renders (it bails otherwise).
  await page.goto(prod('/'), { waitUntil: 'networkidle' });
  await page.click('#m-cases');
  await page.waitForURL(url => url.pathname === '/practice');
  await page.waitForSelector('.cshift-hub', { timeout: 15000 });
  record.homeClinicalButton = (await page.locator('.cshift-hub h1').textContent())?.trim();
  if (!record.homeClinicalButton) fail('homepage clinical button', record.homeClinicalButton);
  await page.goto(prod('/practice'), { waitUntil: 'networkidle' });
  await page.waitForSelector('.cshift-hub');
  record.clinicalHeading = (await page.locator('.cshift-hub h1').textContent())?.trim();
  await page.goto(prod('/practice?view=content'), { waitUntil: 'networkidle' });
  await page.waitForSelector('.cshift-content-register');
  record.clinicalMedicineLinks = await page.locator('.cshift-content-register a[href^="/medicine"]').count();
  if (record.clinicalMedicineLinks !== 0)
    fail('Clinical content register links into Medicine', record.clinicalMedicineLinks);
  await page.goto(prod('/mcat'), { waitUntil: 'networkidle' });
  await page.waitForSelector('main');
  record.mcatGated = await page.locator('.comingsoon').count();
  record.mcatHeading = (await page.locator('main h1').first().textContent())?.trim();
  record.version = (await page.locator('button.ver').first().textContent())?.trim();
  if (!record.clinicalHeading || record.mcatGated !== 0 || !record.mcatHeading || record.version !== `v${APP_VERSION}`)
    fail('open courses', record);

  // Everything above ran under production gating: no closed-course module may have loaded.
  const leaked = [...closedAssets];
  if (leaked.length) fail(`${viewport.name} closed-course assets were requested`, leaked);

  // Localhost without the flag still previews a closed course for development.
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(base.hostname)) {
    await page.goto(new URL('/anatomy', base).href, { waitUntil: 'networkidle' });
    await page.waitForSelector('main');
    record.localPreviewGated = await page.locator('.comingsoon').count();
    if (record.localPreviewGated !== 0) fail('localhost development preview', record.localPreviewGated);
  }
  if (errors.length) fail(`${viewport.name} page errors`, errors);
  results.push(record);
  await context.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
