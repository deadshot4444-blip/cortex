/* Lab instruments in a real browser: the plot is drawn at its on-screen size, the grip drags with a
 * mouse and with a finger, the slider works from the keyboard, the page does not overflow on a phone,
 * and the cursor can be steered by hand. The numbers themselves are proved in
 * scripts/test-neuro-instruments.cjs. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.env.CORTEX_URL || 'http://localhost:8765/';
const APP_VERSION =
  (readFileSync(new URL('../app.js', import.meta.url), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || '';
const data = JSON.parse(readFileSync(new URL('../data/neuro.json', import.meta.url), 'utf8'));
const open = data.simulations.filter(sim => sim.instrument?.gate === 'open');
const errors = [];
const report = {};
const fail = message => {
  throw new Error(message);
};

const browser = await chromium.launch({ headless: true });
async function context(options, seed) {
  const ctx = await browser.newContext(options);
  await ctx.addInitScript(
    ([version, saved]) => {
      localStorage.setItem('cs-seen-ver', version);
      if (saved && !localStorage.getItem('cs-neuro')) localStorage.setItem('cs-neuro', saved);
    },
    [APP_VERSION, seed ? JSON.stringify(seed) : '']
  );
  return ctx;
}
async function lab(ctx, query, ready = '[data-bench]') {
  const page = await ctx.newPage();
  page.on('pageerror', error => errors.push(`${query}: ${error.message}`));
  await page.goto(`${BASE}neuro?${query}`, { waitUntil: 'load' });
  await page.waitForSelector(ready, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  return page;
}
// The site scrolls smoothly, so a click that had to bring its target into view is still moving the
// page when it returns. Positions are only meaningful once that has finished.
async function settle(page) {
  let last = -1;
  for (let quiet = 0; quiet < 4;) {
    const y = await page.evaluate(() => Math.round(scrollY));
    quiet = y === last ? quiet + 1 : 0;
    last = y;
    await page.waitForTimeout(60);
  }
}
const snapshot = page =>
  page.evaluate(() => {
    const plot = document.querySelector('[data-bench-plot]'),
      svg = plot.querySelector('svg'),
      grip = document.querySelector('[data-bench-grip]')?.getBoundingClientRect(),
      line = (
        plot.querySelector('.nx-live-edge') ||
        plot.querySelector('.nx-live-cut') ||
        plot.querySelector('.neuro-series-threshold')
      )?.getBoundingClientRect(),
      text = [...svg.querySelectorAll('text')].map(node => Number.parseFloat(getComputedStyle(node).fontSize));
    return {
      mode: document.querySelector('[data-bench]').dataset.benchMode,
      plotWidth: plot.clientWidth,
      viewBox: svg.getAttribute('viewBox').split(' ').map(Number),
      svgWidth: Math.round(svg.getBoundingClientRect().width),
      smallestText: Math.min(...text),
      overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      values: [...document.querySelectorAll('[data-bench-out]')].map(node => node.textContent),
      read: [...document.querySelectorAll('[data-bench-read] dd')].map(node => node.textContent),
      grip: grip ? [grip.x + grip.width / 2, grip.y + grip.height / 2] : null,
      lineY: line ? line.y : null,
      scrollY: Math.round(scrollY),
    };
  });
function checkLayout(id, state, width) {
  if (state.overflow > 1) fail(`${id} overflows by ${state.overflow}px at ${width}px`);
  if (state.viewBox[2] !== state.plotWidth || Math.abs(state.svgWidth - state.plotWidth) > 1)
    fail(`${id} plot is not drawn at its on-screen width: ${JSON.stringify(state)}`);
  if (state.smallestText < 11) fail(`${id} has ${state.smallestText}px text in its plot`);
}

/* ----- desktop: every open lab ----- */
const desktop = await context({ viewport: { width: 1280, height: 900 } });
for (const sim of open) {
  const page = await lab(desktop, `sim=${sim.id}`);
  const before = await snapshot(page);
  checkLayout(sim.id, before, 1280);
  if (before.mode !== 'explore') fail(`${sim.id} should open in explore mode`);

  // Keyboard: the slider is a real range input.
  const slider = page.locator('[data-bench-control]').first();
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  const keyed = await snapshot(page);
  if (keyed.values[0] === before.values[0]) fail(`${sim.id} slider did not move with the keyboard`);
  if ((await slider.getAttribute('aria-valuetext')) !== keyed.values[0]) fail(`${sim.id} slider value text is stale`);
  await page.click('[data-bench-reset]');
  await settle(page);
  const reset = await snapshot(page);
  if (reset.values.join() !== before.values.join() || reset.read.join() !== before.read.join())
    fail(`${sim.id} reset did not return to the scenario setting`);

  // Mouse: the grip moves the same value, and the line follows the pointer.
  if (before.grip) {
    const [x, y] = reset.grip;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let step = 1; step <= 6; step++) await page.mouse.move(x, y - step * 5);
    const dragged = await snapshot(page);
    await page.mouse.up();
    if (dragged.values[0] === reset.values[0]) fail(`${sim.id} grip did not change the value`);
    if (Math.abs(dragged.grip[1] - (y - 30)) > 12 && !/within 1 /.test(dragged.values[0]))
      fail(`${sim.id} grip did not follow the pointer: ${dragged.grip[1]} vs ${y - 30}`);
    if (dragged.lineY != null && Math.abs(dragged.lineY - reset.lineY) < 4) fail(`${sim.id} line did not move`);
  }

  // The first answer opens the instrument fully and keeps the reader's settings.
  const held = (await snapshot(page)).values;
  await page.click(`[data-sim-choice="${sim.bestAnswerIndex}"]`);
  await page.waitForSelector('[data-bench][data-bench-mode="full"]');
  const after = await snapshot(page);
  checkLayout(sim.id + ' answered', after, 1280);
  if (after.values.slice(0, held.length).join() !== held.join()) fail(`${sim.id} lost its settings on answering`);
  if (!(await page.locator('[data-bench-task] b').textContent()).match(/^(Try this|Done)$/))
    fail(`${sim.id} shows no task after the answer`);
  report[sim.id] = { explore: before.read, answered: after.read };
  await page.close();
}

/* ----- desktop: steer the cursor by hand ----- */
{
  const page = await lab(desktop, 'sim=sim-bci-latency-trace', '[data-bench-hand]');
  const say = () => page.locator('[data-hand-say]').textContent();
  const dot = () => page.locator('[data-hand-dot]').evaluate(node => Number.parseFloat(node.style.left));
  const start = await dot();
  const button = page.locator('[data-hand-move="1"]');
  await button.scrollIntoViewIfNeeded();
  await settle(page);
  const box = await button.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  const whileHeld = await dot();
  await page.mouse.up();
  await page.waitForFunction(() => /^Stopped at/.test(document.querySelector('[data-hand-say]').textContent));
  const stopped = await dot();
  if (!(whileHeld > start && stopped > whileHeld))
    fail(`The delayed dot should still be catching up at release: ${start} ${whileHeld} ${stopped}`);
  if (!/^Stopped at [\d.]+: .*the target\. Moves so far: 1\.$/.test(await say())) fail(await say());
  await page.click('[data-hand-reset]');
  if ((await say()) !== 'The dot is at 0.' || (await dot()) !== start) fail('Start over did not reset the cursor');
  report.hand = { start, whileHeld, stopped };
  await page.close();
}

/* ----- desktop: an instrument that waits for the first answer, inside its unit ----- */
{
  const step = data.learningPaths[0].steps.find(
    item => data.unitLessons[String(item.order)]?.simulation?.instrument?.gate === 'after'
  );
  const unit = data.unitLessons[String(step.order)];
  const content = {
    step,
    unit,
    topic: data.topics.find(topic => topic.id === step.topicId) || null,
    checks: unit.checks || [],
    code: null,
    sim: unit.simulation,
  };
  const stages = ['lesson', 'recall', ...(content.checks.length ? ['quiz'] : []), 'sim', 'debrief'];
  const seeded = await context(
    { viewport: { width: 1280, height: 900 } },
    {
      pathDone: [],
      pathStarted: true,
      units: {
        [step.id]: {
          layout: 2,
          content,
          stageIdx: stages.indexOf('sim'),
          recallIdx: (unit.activeRecallPrompts || []).length,
          recall: [],
          answers: {},
          debrief: '',
          startedAt: 1,
        },
      },
    }
  );
  const page = await lab(seeded, `unit=${step.id}`, '#neuro-unit-questions [data-choice]');
  if (await page.locator('[data-bench]').count()) fail('A gated instrument opened before the answer');
  if (!(await page.locator('.nx-lab-plot figure.neuro-series svg').count())) fail('The static plot is missing');
  if (!(await page.locator('.nx-live-soon').isVisible())) fail('The note about the locked plot is missing');
  await page.click(`[data-choice="${unit.simulation.bestAnswerIndex}"]`);
  await page.waitForSelector('[data-bench][data-bench-mode="full"]');
  checkLayout(unit.simulation.id, await snapshot(page), 1280);
  if (!(await page.locator('#neuro-unit-next').isEnabled())) fail('The unit cannot continue after the lab answer');
  report.gated = unit.simulation.id;
  await seeded.close();
}
await desktop.close();

/* ----- phone: layout, and a finger on the grip must move the value without scrolling the page ----- */
const phone = await context({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});
for (const sim of open) {
  const page = await lab(phone, `sim=${sim.id}`);
  const state = await snapshot(page);
  checkLayout(sim.id + ' phone', state, 390);
  if (state.grip) {
    await page.evaluate(() =>
      document.querySelector('[data-bench-plot]').scrollIntoView({ behavior: 'instant', block: 'center' })
    );
    await settle(page);
    const at = await snapshot(page),
      [x, y] = at.grip,
      cdp = await phone.newCDPSession(page);
    const swipe = async (px, py, distance) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: px, y: py }] });
      for (let step = 1; step <= 8; step++) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: px, y: py + (distance * step) / 8 }],
        });
        await page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(300);
    };
    await swipe(x, y, -32);
    const dragged = await snapshot(page);
    if (dragged.values[0] === at.values[0]) fail(`${sim.id} grip ignored a finger`);
    if (Math.abs(dragged.scrollY - at.scrollY) > 2) fail(`${sim.id} page scrolled while the grip was dragged`);
    // Anywhere else on the plot, the same swipe still scrolls the page.
    const box = await page.locator('[data-bench-plot]').boundingBox();
    await swipe(box.x + box.width * 0.4, box.y + box.height * 0.5, -90);
    const scrolled = await snapshot(page);
    if (scrolled.scrollY - dragged.scrollY < 40) fail(`${sim.id} plot swallowed a page scroll`);
    if (scrolled.values[0] !== dragged.values[0]) fail(`${sim.id} value changed during a page scroll`);
  }
  await page.close();
}
await phone.close();

console.log(JSON.stringify({ labs: open.map(sim => sim.id), report, errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
