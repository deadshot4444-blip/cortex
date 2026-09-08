import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const base = process.env.CORTEX_URL || 'http://127.0.0.1:8805/';
assert.equal(new URL(base).port, '8805');
const data = JSON.parse(readFileSync('data/mcat-course.json')),
  h2 = JSON.parse(readFileSync('data/mcat-cars.json')).find(p => p.id === 'h2');
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1280, 390, 320]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' }),
      page = await ctx.newPage(),
      errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"value":0}' })
    );
    const open = view => page.goto(base + 'mcat?gates=prod&view=' + view, { waitUntil: 'networkidle' });
    const overflow = async () =>
      assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
    await open('course');
    // A pre-update pending choice keeps its displayed wording through submit and history.
    await page.evaluate(() => {
      const r = courseRecord('membrane-transport');
      r.learnedAt = 1;
      r.exploredAt = 2;
      r.draft = { qId: 'membrane-transport-1', chosen: 3, confidence: 'sure' };
      saveCourse();
      renderCourseUnit('membrane-transport', 'check');
    });
    assert.match(await page.locator('.course-answers').innerText(), /Hydrolyze ATP/);
    await page.click('#course-submit');
    assert.match(await page.locator('.course-feedback').innerText(), /Hydrolyze ATP/);
    const saved = await page.evaluate(() => JSON.stringify(courseRecord('membrane-transport').attempts));
    await page.reload({ waitUntil: 'networkidle' });
    assert.match(await page.locator('.course-feedback').innerText(), /Hydrolyze ATP/);
    assert.equal(await page.evaluate(() => JSON.stringify(courseRecord('membrane-transport').attempts)), saved);
    // A new attempt uses revised choices; its selected text and feedback survive reload.
    await page.evaluate(() => {
      const r = courseRecord('memory-retrieval');
      r.learnedAt = 1;
      r.exploredAt = 2;
      saveCourse();
      renderCourseUnit('memory-retrieval', 'check');
    });
    const q = data.units.find(u => u.id === 'memory-retrieval').questions.find(q => q.kind === 'check');
    assert.ok((await page.locator('.course-answers').innerText()).includes(q.options[1]));
    await page.check('[name="course-answer"][value="1"]');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('[name="course-answer"]:checked').inputValue(), '1');
    await page.click('#course-submit');
    assert.ok((await page.locator('.course-feedback').innerText()).includes(q.options[1]));
    await overflow();
    // Placement legacy draft and saved record also preserve their former choices.
    await page.evaluate(() => {
      const units = courseData.units.filter(u => u.placementEligible),
        u = units.find(u => u.questions[0].previousVersion),
        p = courseState.placement;
      p.startedAt = 1;
      p.answers = {};
      for (const prior of units.slice(0, units.indexOf(u)))
        p.answers[prior.id] = { qId: prior.questions[0].id, chosen: null, correct: null, confidence: 'unsure', ts: 1 };
      p.draft = { unitId: u.id, chosen: 0, confidence: 'sure' };
      saveCourse();
      renderCoursePlacement();
    });
    assert.match(await page.locator('.course-answers').innerText(), /Ignore the acid/);
    await page.click('#placement-next');
    assert.equal(
      await page.evaluate(() => courseState.placement.answers['buffer-balance'].questionSnapshot.options[0]),
      'Ignore the acid'
    );
    // Complete h2 in ordinary CARS, then check blind review and archived letters against display order.
    await page.evaluate(() =>
      startCars(
        MCAT.cars.find(p => p.id === 'h2'),
        false
      )
    );
    for (const q of h2.questions) {
      assert.deepEqual(
        await page.locator('.opts .opt').evaluateAll(bs => bs.map(b => Number(b.dataset.i))),
        q.displayOrder
      );
      assert.equal(
        await page.locator(`.opt[data-i="${q.answer}"] .key`).innerText(),
        'ABCD'[q.displayOrder.indexOf(q.answer)]
      );
      await page.click(`.opt[data-i="${q.answer}"]`);
    }
    await page.waitForSelector('#cars-rationale');
    const first = await page.evaluate(() => cars.results[cars.reviewOrder[cars.reviewIdx]].q);
    assert.deepEqual(
      await page.locator('[data-review-answer]').evaluateAll(bs => bs.map(b => Number(b.dataset.reviewAnswer))),
      first.displayOrder
    );
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => resumeCarsSession(loadResume('cars')));
    while (await page.locator('#cars-review-skip').count()) await page.click('#cars-review-skip');
    assert.deepEqual(await page.locator('.study-score-pair strong').allTextContents(), ['6/6', '6/6']);
    const reviewText = await page.locator('.drill-review').textContent();
    assert.ok(reviewText.includes('Original: C · Review: Skipped · Correct: C'));
    // A genuinely old saved passage retains natural ordering and its original answer letters.
    await page.evaluate(() => {
      const p = JSON.parse(JSON.stringify(MCAT.cars.find(p => p.id === 'h2')));
      p.questions.forEach(q => delete q.displayOrder);
      cars = { p, phase: 'attempt', attemptId: 'legacy-fixture', idx: 0, results: [], timed: false };
      saveResume('cars', cars);
      renderCarsRunner();
    });
    assert.deepEqual(
      await page.locator('.opts .opt').evaluateAll(bs => bs.map(b => Number(b.dataset.i))),
      [0, 1, 2, 3]
    );
    await page.click('.opt[data-i="1"]');
    assert.equal(await page.evaluate(() => cars.results[0].chosen), 1);
    assert.equal(await page.evaluate(() => cars.results[0].correct), true);
    await page.evaluate(() => clearResume('cars'));
    // New coach orders persist; old workshops with no order map retain their original ordering.
    await open('coach');
    await page.click('[data-coach-start="coach-h2"]');
    await page.check('[name="coach-mode"][value="independent"]');
    await page.click('#coach-begin');
    await page.fill('#coach-note-0', 'Automated fixture: evaluate the author’s conditional argument.');
    await page.click('#coach-to-questions');
    assert.deepEqual(
      await page.locator('[name="coach-answer"]').evaluateAll(bs => bs.map(b => Number(b.value))),
      h2.questions[0].displayOrder
    );
    await page.check('[name="coach-answer"][value="1"]');
    await page.fill('#coach-evidence', 'The passage makes the claim conditional.');
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('#coach-resume');
    assert.equal(await page.locator('[name="coach-answer"]:checked').inputValue(), '1');
    assert.deepEqual(
      await page.locator('[name="coach-answer"]').evaluateAll(bs => bs.map(b => Number(b.value))),
      h2.questions[0].displayOrder
    );
    await page.click('#coach-lock');
    assert.equal(await page.evaluate(() => v2State.coach.active.answers[0].correct), true);
    await page.evaluate(() => {
      delete v2State.coach.active.choiceOrders;
      v2Save();
      renderV2Coach();
    });
    assert.deepEqual(
      await page.locator('[name="coach-answer"]').evaluateAll(bs => bs.map(b => Number(b.value))),
      [0, 1, 2, 3]
    );
    await overflow();
    // Timed CARS uses displayed positions but records canonical values through archive.
    await page.evaluate(() => {
      sim = {
        queue: [{ key: 'cars', items: simPool('cars').filter(i => i.passageId === 'h2') }],
        si: 0,
        idx: 0,
        answers: {},
        flags: {},
        results: [],
        attemptId: 'timed-order-fixture',
        sectionDurationMs: 600000,
        deadline: Date.now() + 600000,
      };
      renderSimQ();
    });
    for (const [i, q] of h2.questions.entries()) {
      assert.deepEqual(
        await page.locator('#opts .opt').evaluateAll(bs => bs.map(b => Number(b.dataset.i))),
        q.displayOrder
      );
      await page.click(`.opt[data-i="${q.answer}"]`);
      if (i === 0) {
        await page.reload({ waitUntil: 'networkidle' });
        await page.evaluate(() => {
          sim = loadResume('sim');
          renderSimQ();
        });
        assert.equal(await page.locator('#opts .picked').getAttribute('data-i'), '1');
      }
      if (i < 5) await page.click('#next');
    }
    await page.evaluate(() => submitSection());
    assert.equal(await page.evaluate(() => sim.results[0].correct), 6);
    assert.match(await page.locator('#dr').textContent(), /You: C.*Correct: C/);
    assert.deepEqual(errors, []);
    await ctx.close();
    console.log(
      `PASS ${width}px old/new course wording, placement, CARS order, blind review, coach, timed archive and reload`
    );
  }
} finally {
  await browser.close();
}
