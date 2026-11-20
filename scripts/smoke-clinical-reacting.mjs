// The reacting patient in a real browser, at desktop and phone widths: the monitor is on screen when
// the patient changes, the shift clock runs forward, nothing overflows sideways, a reload does not
// replay a call, and the debrief links into the MCAT course. The decision logic itself is covered
// by scripts/test-clinical-reactions.cjs.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const APP_VERSION =
  (readFileSync(new URL('../app.js', import.meta.url), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || '';
const STATE_KEY = 'cs-clinical-shift-v1';
const base = new URL(process.env.CORTEX_URL || 'http://localhost:8765/');
const practiceUrl = new URL('practice', base).href;
const read = file => JSON.parse(readFileSync(new URL(`../data/${file}.json`, import.meta.url), 'utf8'));
const pilot = read('clinical-shift-pilot');
const course = read('mcat-course');
const rotation = pilot.rotations.find(item => item.caseIds.some(id => pilot.reactions?.[id]));
const viewports = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

function fail(message, details) {
  throw new Error(details === undefined ? message : `${message}: ${JSON.stringify(details)}`);
}

async function noSidewaysScroll(page, viewport, label) {
  const amount = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - window.innerWidth, document.body.scrollWidth - window.innerWidth)
  );
  if (amount > 1) fail(`${viewport.name} ${label} has ${amount}px horizontal overflow`);
}

const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), STATE_KEY);
const clockFace = page => page.locator('#cshift-clock b').textContent();
const face = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/* How much of an element is inside the window right now. */
const shareOnScreen = (page, selector) =>
  page.locator(selector).evaluate(node => {
    const box = node.getBoundingClientRect();
    const visible = Math.max(0, Math.min(box.bottom, innerHeight) - Math.max(box.top, 0));
    return box.height ? visible / box.height : 0;
  });

async function runViewport(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  // serve.py cannot proxy the external visitor counter; keep this flow local.
  await context.route('**/cx-visits/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"value":0}' })
  );
  const pageErrors = [],
    consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await context.addInitScript(version => localStorage.setItem('cs-seen-ver', version), APP_VERSION);
  try {
    await page.goto(practiceUrl, { waitUntil: 'networkidle' });
    await page.evaluate(key => localStorage.removeItem(key), STATE_KEY);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.cshift-hub');

    // hub: the ward board is drawn, and the two hero buttons take the reader to their sections
    if (!(await page.locator('.cshift-ward .cshift-ward-screen').isVisible()))
      fail(`${viewport.name} hub has no ward board`);
    for (const [button, heading] of [
      ['#cshift-hero-how', '#cshift-how-title'],
      ['#cshift-hero-start', '#cshift-rotations-title'],
    ]) {
      await page.locator(button).click();
      await page.waitForFunction(
        selector => {
          const box = document.querySelector(selector).getBoundingClientRect();
          return box.top >= 0 && box.bottom <= innerHeight && document.activeElement?.matches(selector);
        },
        heading,
        { timeout: 5000 }
      );
    }
    await noSidewaysScroll(page, viewport, 'hub');

    // the rotation's first patient is a reacting one
    await page.locator(`[data-shift-specialty="${rotation.key}"]`).click();
    await page.waitForSelector('.cshift-handoff');
    let state = await saved(page);
    const reaction = state.active.content.reactions;
    const stages = state.active.content.caseData.stages;
    if (!reaction || !pilot.reactions[state.active.caseId])
      fail(`${viewport.name} was not given a reacting patient first`, state.active.caseId);
    const sweep = await page.locator('.cshift-ecg-sweep').evaluate(node => getComputedStyle(node).animationName);
    if (sweep !== 'cshift-sweep') fail(`${viewport.name} monitor trace is not moving`, sweep);
    if ((await clockFace(page)) !== '00:00') fail(`${viewport.name} shift clock did not start at zero`);
    if ((await shareOnScreen(page, '.cshift-handoff .cshift-resident')) < 1)
      fail(`${viewport.name} handoff does not open on the resident's words`);
    await noSidewaysScroll(page, viewport, 'handoff');

    // investigating moves the clock
    await page.locator('#cshift-open-chart').click();
    await page.waitForSelector('[data-cshift-investigation]');
    await page.locator('[data-cshift-investigation="interview"][data-cshift-index="0"]').click();
    await page.waitForFunction(() => document.querySelector('#cshift-clock b')?.textContent === '00:02');
    if (viewport.name === 'desktop') {
      const side = await page.locator('.cshift-side').evaluate(node => ({
        position: getComputedStyle(node).position,
        top: node.style.getPropertyValue('--cshift-side-top'),
      }));
      if (side.position !== 'sticky' || !/^-?\d+(\.\d+)?px$/.test(side.top))
        fail('desktop patient column does not follow the page', side);
    }
    await noSidewaysScroll(page, viewport, 'investigation');
    await page.locator('#cshift-begin-reasoning').click();
    await page.waitForSelector('.cshift-options');

    // the first call is the worst one on offer
    let cursor = (await saved(page)).active.stageCursor;
    const decision = reaction.decisions[cursor];
    const harmful = decision.outcomes.findIndex(outcome => outcome.kind === 'delay');
    const choice = harmful >= 0 ? harmful : decision.outcomes.findIndex(outcome => outcome.kind === 'near-miss');
    const outcome = decision.outcomes[choice];
    await noSidewaysScroll(page, viewport, 'open decision');
    await page.locator(`.cshift-option[data-cshift-choice="${choice}"]`).click();
    await page.locator('#cshift-lock-decision').click();
    await page.waitForSelector(`.cshift-beat.is-${outcome.kind}`);
    const afterCall = 2 + outcome.minutes;
    // The page glides back to the top, where the patient and the consequence are on screen together.
    await page.waitForFunction(() => scrollY === 0, null, { timeout: 5000 });
    const monitorShare = await shareOnScreen(page, '.cshift-monitor');
    const storyTop = await page.locator('.cshift-beat-story').evaluate(node => node.getBoundingClientRect().top);
    const focused = await page.evaluate(() => document.activeElement?.className || '');
    if (monitorShare < 0.9 || storyTop > viewport.height)
      fail(`${viewport.name} outcome and monitor are not on screen together`, { monitorShare, storyTop });
    if (!focused.includes('cshift-beat-time')) fail(`${viewport.name} outcome did not take focus`, focused);
    await page.waitForFunction(
      text => document.querySelector('#cshift-clock b')?.textContent === text,
      face(afterCall)
    );
    if (outcome.status) {
      const status = (await page.locator('.cshift-monitor-status').innerText()).trim().toLowerCase();
      if (!['getting worse', 'critical', 'unstable'].includes(status))
        fail(`${viewport.name} monitor did not report the patient's decline`, status);
      const tone = await page.locator('.cshift-monitor').evaluate(node => node.className);
      if (!tone.includes(`is-${outcome.status}`)) fail(`${viewport.name} monitor tone did not change`, tone);
    }
    const flashed = await page.locator('.cshift-vitals .is-changed').count();
    if (flashed !== Object.keys(outcome.vitals || {}).length)
      fail(`${viewport.name} changed vitals were not marked`, { flashed, expected: outcome.vitals });
    await noSidewaysScroll(page, viewport, 'outcome');

    // a reload reopens the same outcome and charges nothing more
    const before = JSON.stringify((await saved(page)).active);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector(`.cshift-beat.is-${outcome.kind}`);
    if ((await clockFace(page)) !== face(afterCall) || JSON.stringify((await saved(page)).active) !== before)
      fail(`${viewport.name} reload changed the encounter`);
    await page.locator('#cshift-next-stage').click();
    await page.waitForSelector('.cshift-task');
    let expectedClock = afterCall + decision.outcomes[stages[cursor].answer].minutes;

    // the rest of the shift, every call the safe one; nothing on the way asks for typed text
    const typing = () => page.locator('.cshift-workspace :is(textarea, input[type="text"])').count();
    if (await typing()) fail(`${viewport.name} a reacting shift asked for typed text`);
    for (let step = 0; step < 20 && !(await page.locator('.cshift-debrief-ward').count()); step++) {
      cursor = (await saved(page)).active.stageCursor;
      const kind = await page.locator('.cshift-task').getAttribute('data-cshift-kind');
      if (kind === 'diagnosis') {
        if (!(await page.locator('.cshift-evidence').isVisible()))
          fail(`${viewport.name} the report is not shown before the diagnosis question`);
        await page.locator(`.cshift-option[data-cshift-choice="${stages[cursor].answer}"]`).click();
        await page.locator('#cshift-lock-decision').click();
        await page.waitForSelector('.cshift-task.is-decided .cshift-verdict.is-safe');
        if ((await clockFace(page)) !== face(expectedClock)) fail(`${viewport.name} naming the problem cost time`);
        await noSidewaysScroll(page, viewport, 'diagnosis');
      } else if (kind === 'decision') {
        const safe = reaction.decisions[cursor].outcomes[stages[cursor].answer];
        await page.locator(`.cshift-option[data-cshift-choice="${stages[cursor].answer}"]`).click();
        await page.locator('#cshift-lock-decision').click();
        await page.waitForSelector('.cshift-beat.is-safe');
        expectedClock += safe.minutes;
        await page.waitForFunction(
          text => document.querySelector('#cshift-clock b')?.textContent === text,
          face(expectedClock)
        );
        await noSidewaysScroll(page, viewport, 'safe outcome');
      } else fail(`${viewport.name} reached an unknown phase`, (await saved(page)).active.phase);
      if (await typing()) fail(`${viewport.name} a reacting shift asked for typed text`);
      await page.locator('#cshift-next-stage').click();
      await page.waitForSelector('.cshift-task, .cshift-debrief-ward');
    }

    // the last call leads straight to the debrief
    await page.waitForSelector('.cshift-debrief-ward');
    const steps = await page.locator('.cshift-stepper li').count();
    if (steps !== 4 || (await typing())) fail(`${viewport.name} debrief is not the fourth and last step`, { steps });
    state = await saved(page);
    const bar = await page.locator('.cshift-timebar').evaluate(node => ({
      width: node.getBoundingClientRect().width,
      parts: [...node.children].map(part => Math.round(part.getBoundingClientRect().width)),
      label: node.getAttribute('aria-label'),
    }));
    if (
      state.active.clock !== expectedClock ||
      (await clockFace(page)) !== face(expectedClock) ||
      bar.width < 200 ||
      bar.parts.some(width => width < 4) ||
      !bar.label.includes('minute') ||
      (await page.locator('.cshift-events > li').count()) !== state.active.events.length ||
      (await page.locator('.cshift-domain-grid > article').count()) !== 6 ||
      state.active.scores.safety.minutesLost !== outcome.minutes
    )
      fail(`${viewport.name} debrief does not match the shift that was played`, { bar, clock: state.active.clock });
    await noSidewaysScroll(page, viewport, 'debrief');

    // the science links open real MCAT lessons
    const links = await page
      .locator('.cshift-science article a')
      .evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
    const lessons = reaction.science.filter(item => item.lesson);
    if (links.length !== lessons.length || !links.length) fail(`${viewport.name} debrief has no lesson links`, links);
    const lessonPage = await context.newPage();
    // A lesson keeps loading media after it is readable, so wait for its title rather than a quiet network.
    await lessonPage.goto(new URL(links[0], base).href, { waitUntil: 'domcontentloaded' });
    const unit = course.units.find(item => item.id === lessons[0].lesson);
    await lessonPage.waitForFunction(title => document.querySelector('main')?.innerText.includes(title), unit.title, {
      timeout: 60000,
    });
    await lessonPage.close();

    // the same patient again, from the top
    await page.locator('#cshift-replay').click();
    await page.waitForSelector('.cshift-handoff');
    const replay = (await saved(page)).active;
    if (
      replay.caseId !== state.active.caseId ||
      replay.runId === state.active.runId ||
      replay.clock !== 0 ||
      replay.events.length ||
      (await clockFace(page)) !== '00:00'
    )
      fail(`${viewport.name} replay did not start the same patient afresh`, replay);

    if (pageErrors.length || consoleErrors.length)
      fail(`${viewport.name} emitted browser errors`, { pageErrors, consoleErrors });
    return {
      viewport: viewport.name,
      caseId: state.active.caseId,
      firstCall: outcome.kind,
      shiftMinutes: expectedClock,
      events: state.active.events.length,
      lesson: unit.id,
    };
  } finally {
    await context.close();
  }
}

/* With reduced motion the trace is still, the outcome appears at once and the clock does not count up. */
async function runReducedMotion(browser) {
  const context = await browser.newContext({ viewport: viewports[0], reducedMotion: 'reduce' });
  const page = await context.newPage();
  await context.route('**/cx-visits/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"value":0}' })
  );
  await context.addInitScript(version => localStorage.setItem('cs-seen-ver', version), APP_VERSION);
  try {
    await page.goto(practiceUrl, { waitUntil: 'networkidle' });
    await page.evaluate(key => localStorage.removeItem(key), STATE_KEY);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator(`[data-shift-specialty="${rotation.key}"]`).click();
    await page.waitForSelector('.cshift-handoff');
    const sweep = await page.locator('.cshift-ecg-sweep').evaluate(node => getComputedStyle(node).animationName);
    await page.locator('#cshift-open-chart').click();
    await page.locator('#cshift-begin-reasoning').click();
    await page.waitForSelector('.cshift-options');
    await page.locator('.cshift-option').first().click();
    await page.locator('#cshift-lock-decision').click();
    await page.waitForSelector('.cshift-beat');
    const active = (await saved(page)).active;
    const still = await page.evaluate(() => ({
      beat: [...document.querySelectorAll('.cshift-beat > *')].map(node => getComputedStyle(node).animationName),
      clock: document.querySelector('#cshift-clock b').textContent,
    }));
    if (sweep !== 'none' || still.beat.some(name => name !== 'none') || still.clock !== face(active.clock))
      fail('reduced motion was not respected', { sweep, still });
    return { reducedMotion: true };
  } finally {
    await context.close();
  }
}

if (!rotation) fail('No rotation has a reacting patient');
const browser = await chromium.launch({ headless: true });
try {
  const results = [];
  for (const viewport of viewports) results.push(await runViewport(browser, viewport));
  results.push(await runReducedMotion(browser));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
