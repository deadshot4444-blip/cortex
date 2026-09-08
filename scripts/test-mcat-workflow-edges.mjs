import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext(),
    page = await ctx.newPage();
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"value":0}' }));
  await page.goto((process.env.CORTEX_URL || 'http://127.0.0.1:8805/') + 'mcat', { waitUntil: 'networkidle' });
  await page.click('#guide-reference-options > summary');
  await page.click('#begin');
  const checks = await page.evaluate(() => {
    const plan = guidePlan(),
      target = plan.targetDate,
      day = guideDateKey(),
      c = repairData.concepts[0];
    const old = Date.now() - 2 * DAY,
      state = McatRepairCore.empty();
    McatRepairCore.begin(c, state, 'repair', old);
    McatRepairCore.answer(c, state, c.diagnostic.answer, 'sure', old);
    state.active.phase = 'lesson';
    McatRepairCore.afterLesson(c, state);
    McatRepairCore.answer(c, state, c.checks[0].answer, 'sure', old + 1);
    state.active = null;
    repairState = state;
    saveMcatRepair();
    const daily = studyDailySession(guidePlan());
    const due = daily.tasks.find(t => t.type === 'repair');
    const taperPlan = { ...plan, startDate: guideAddDays(day, -119), lastStudyDate: day, sessions: {}, completed: {} };
    const taper = studyBuildSession(taperPlan, 60, null);
    const paused = {
      ...plan,
      active: { day: 1, id: 'exam', type: 'exam', title: 'Saved exam', minutes: 65 },
      completed: {},
    };
    saveResume('sim', {
      queue: [{ key: 'cars', items: [{ q: MCAT.cars[0].questions[0] }] }],
      si: 0,
      idx: 0,
      answers: {},
      _remain: 100,
    });
    const small = studyBuildSession(paused, 15, null);
    clearResume('sim');
    return {
      dueKind: due.repairKind,
      dueId: due.conceptId,
      targetUnchanged: guidePlan().targetDate === target,
      taperMinutes: taper.tasks.reduce((n, t) => n + t.minutes, 0),
      taperNew: taper.tasks.filter(t => t.type === 'flash').map(t => t.newCards),
      taperPassage: taper.tasks.some(t => ['cars', 'passage'].includes(t.type)),
      savedExam: small.tasks[0].id,
      smallCount: small.tasks.length,
    };
  });
  assert.equal(checks.dueKind, 'later');
  assert.equal(checks.dueId, 'enzyme-inhibition');
  assert.equal(checks.targetUnchanged, true);
  assert.ok(checks.taperMinutes <= 15);
  assert.ok(checks.taperNew.every(n => n === 0));
  assert.equal(checks.taperPassage, false);
  assert.equal(checks.savedExam, 'exam');
  assert.equal(checks.smallCount, 1);
  console.log(
    'PASS due checks replace cached recommendations, taper stays light, large saved sessions survive small budgets'
  );
  // Legacy zero-time, zero-answer CARS resumes expire into blind review rather than receiving a fresh timer.
  await page.evaluate(() => {
    guideClearActiveTask();
    const r = { p: MCAT.cars[0], idx: 0, results: [], timed: true, _remain: 0 };
    resumeCarsSession(r);
  });
  await page.waitForSelector('#cars-rationale');
  assert.equal(await page.locator('#cars-timer').count(), 0);
  assert.equal(
    await page.evaluate(() => cars.results.length),
    await page.evaluate(() => MCAT.cars[0].questions.length)
  );
  console.log('PASS legacy zero-time resume preserves expiry and counts unanswered questions');
  // A plan restart detaches old task identity without discarding the ongoing passage.
  await page.evaluate(() => {
    const plan = guidePlan();
    plan.active = { day: 2, id: 'old-cars', type: 'cars' };
    saveGuidePlan(plan);
    cars.guideTask = plan.active;
    saveResume('cars', cars);
    renderGuide();
  });
  page.once('dialog', d => d.accept());
  await page.click('#restart');
  assert.equal(await page.evaluate(() => loadResume('cars').guideTask), undefined);
  assert.equal(await page.evaluate(() => loadResume('cars').phase), 'blind');
  console.log('PASS restart preserves unfinished review without carrying retired assignment identity');
  await ctx.close();
  // Model data outage should not block the notebook or question feedback.
  const ctx2 = await browser.newContext(),
    p2 = await ctx2.newPage();
  await p2.route('**/data/mcat-experiments.json*', r => r.fulfill({ status: 503, body: 'unavailable' }));
  await p2.goto((process.env.CORTEX_URL || 'http://127.0.0.1:8805/') + 'mcat', { waitUntil: 'networkidle' });
  await p2.evaluate(() => {
    startPassage(MCAT.sci[0], true);
    plab.deadline = Date.now() - 1;
    plabTick();
  });
  assert.equal(await p2.locator('[data-experiment]').count(), 6);
  await p2.evaluate(() => renderPassageHome());
  await p2.click('[data-s="psychSoc"]');
  assert.equal(await p2.locator('#plist .row:enabled').count(), 0);
  await p2.click('#resume');
  await p2.waitForSelector('[data-experiment]');
  await p2.click('#experiment-skip');
  await p2.locator('.experiment-comparison summary').first().click();
  assert.ok((await p2.locator('.experiment-comparison').innerText()).includes('Model notes are unavailable'));
  await ctx2.close();
  console.log('PASS missing model-note data leaves the notebook and answer review usable');
} finally {
  await browser.close();
}
