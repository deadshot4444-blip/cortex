import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const base = process.env.CORTEX_URL || 'http://127.0.0.1:8805/',
  data = JSON.parse(readFileSync('data/mcat-v2.json')),
  passages = [
    ...JSON.parse(readFileSync('data/mcat-cars.json')),
    ...JSON.parse(readFileSync('data/mcat-science-passages.json')),
  ];
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
    const open = async view => page.goto(base + 'mcat?gates=prod&view=' + view, { waitUntil: 'networkidle' }),
      overflow = async label =>
        assert.ok(
          (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1,
          `${width} ${label} overflow`
        );
    const coaches = width === 1280 ? data.coaches : [data.coaches[0], data.coaches.find(c => c.passageId === 'cp2')];
    for (const [index, c] of coaches.entries()) {
      const p = passages.find(p => p.id === c.passageId);
      await open('coach');
      await page.click(`[data-coach-start="${c.id}"]`);
      const mode = index === 0 ? 'guided' : 'independent';
      await page.check(`[name="coach-mode"][value="${mode}"]`);
      await page.click('#coach-begin');
      assert.equal(await page.locator('#coach-to-questions').isDisabled(), true);
      for (const t of await page.locator('[data-coach-note]').all())
        await t.fill('The comparison supports a limited claim, with an important qualification.');
      if (index === 0) {
        await page.click('#coach-map-hint');
        await page.reload({ waitUntil: 'networkidle' });
        await page.click('#coach-resume');
        assert.equal(await page.locator('.v2-hint').count(), 1);
        assert.ok((await page.inputValue('#coach-note-0')).includes('limited claim'));
      }
      await overflow(c.id + ' map');
      if (index === 0)
        await page.screenshot({ path: `output/playwright/mcat-v2-coach-map-${width}.png`, fullPage: true });
      await page.click('#coach-to-questions');
      for (const [i, q] of p.questions.entries()) {
        assert.equal(await page.locator('.v2-model').count(), 0);
        await page.check(`[name="coach-answer"][value="${q.answer}"]`);
        await page.fill('#coach-evidence', 'I used the relevant comparison and kept the qualification in the claim.');
        if (c.passageId === 'cp2' && i === 1) await page.click('#coach-q-hint');
        if (index === 0 && i === 0) {
          await page.reload({ waitUntil: 'networkidle' });
          await page.click('#coach-resume');
          assert.equal(await page.locator('[name="coach-answer"]:checked').count(), 1);
          assert.ok((await page.inputValue('#coach-evidence')).length);
        }
        await overflow(c.id + ' question');
        await page.click('#coach-lock');
      }
      await page.waitForSelector('#coach-reflection');
      assert.equal(await page.locator('.v2-model').count(), 1);
      await page.fill('#coach-reflection', 'Next time I will identify the limitation before evaluating the options.');
      await overflow(c.id + ' reflection');
      await page.click('#coach-finish');
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cs-mcat-v2')));
      assert.equal(saved.coach.history.at(-1).answers.length, p.questions.length);
      assert.equal(saved.coach.active, undefined);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cs-mcat-log') || '[]').length), 0);
      if (index === 0) assert.ok(saved.coach.history[0].answers.every(a => a.assisted && !a.repeat));
      if (c.passageId === 'cp2') {
        assert.equal(saved.coach.history.at(-1).answers[0].assisted, false);
        assert.ok(
          saved.coach.history
            .at(-1)
            .answers.slice(1)
            .every(a => a.assisted)
        );
      }
    }
    // Repeating a coached passage remains a repeat even with independent support.
    await open('coach');
    await page.click('[data-coach-start="coach-h1"]');
    await page.check('[name="coach-mode"][value="independent"]');
    await page.click('#coach-begin');
    await page.fill('#coach-note-0', 'I have seen this passage.');
    await page.click('#coach-to-questions');
    const p = passages.find(p => p.id === 'h1');
    for (const q of p.questions) {
      await page.check(`[name="coach-answer"][value="${q.answer}"]`);
      await page.fill('#coach-evidence', 'My previous reading supplies the context.');
      await page.click('#coach-lock');
    }
    await page.fill('#coach-reflection', 'Repeat answers remain separate.');
    await page.click('#coach-finish');
    assert.ok(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem('cs-mcat-v2'))
          .coach.history.at(-1)
          .answers.every(a => a.repeat)
      )
    );
    // Quantitative feedback, setup persistence, invalid input, graph accessibility and immutable first answers.
    for (const [i, skill] of ['units', 'notation', 'logs', 'ratios', 'slopes', 'estimation'].entries()) {
      await open('math');
      await page.click(`[data-math-skill="${skill}"]`);
      let q = await page.evaluate(() => {
        const a = v2State.math.active;
        return McatV2Core.quant(a.skill, a.variant);
      });
      await page.check(`[name="math-setup"][value="${i === 0 ? (q.answer + 1) % 3 : q.answer}"]`);
      await page.click('#math-setup-save');
      if (i === 0) {
        await page.reload({ waitUntil: 'networkidle' });
        await page.click('#math-resume');
        assert.ok((await page.locator('.course-feedback').innerText()).includes(q.errors[(q.answer + 1) % 3]));
        await page.fill('#math-value', '1/2');
        await page.locator('#math-calculate button').click();
        assert.ok((await page.locator('#math-validation').innerText()).includes('finite number'));
      }
      await page.fill('#math-value', String(q.value));
      await page.locator('#math-calculate button').click();
      await page.waitForSelector('#math-next');
      await overflow(skill + ' result');
      const count = await page.evaluate(() => v2State.math.history.length);
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await page.evaluate(() => v2State.math.history.length), count); // math home permits starting a different skill after a finished item.
    }
    const mh = await page.evaluate(() => v2State.math.history);
    assert.equal(mh.length, 6);
    assert.equal(mh[0].assisted, true);
    assert.equal(mh[0].setupCorrect, false);
    assert.equal(mh[0].calculationCorrect, true);
    // Diagnosis: one missed probe -> provisional suggestion; learner overrides and saves once.
    await open('diagnose');
    await page.selectOption('#diagnostic-unit', 'enzyme-rates');
    await page.click('#diagnostic-start');
    for (let i = 0; i < 3; i++) {
      const q = await page.evaluate(() => v2State.diagnostics.active.probes[v2State.diagnostics.active.answers.length]);
      await page.check(`[name="diagnostic-answer"][value="${i === 0 ? (q.answer + 1) % q.options.length : q.answer}"]`);
      await page.click('#diagnostic-save');
    }
    assert.ok((await page.locator('main').innerText()).includes('not a confirmed diagnosis'));
    await page.selectOption('#diagnostic-cause', 'math');
    await page.fill('#diagnostic-note', 'I knew the idea but used the wrong denominator.');
    await page.click('#diagnostic-confirm');
    assert.equal(await page.evaluate(() => v2State.diagnostics.history.at(-1).cause), 'math');
    await page.click('#diagnostic-confirm');
    assert.equal(await page.evaluate(() => v2State.diagnostics.history.length), 1);
    await overflow('diagnosis');
    // Weekly availability, scheduled exam, manual official results, review, removal/undo.
    await open('weekly');
    for (let i = 0; i < 7; i++) await page.fill('#week-day-' + i, '30');
    await page.locator('#week-settings button').click();
    await page.click('#week-exam-add');
    await page.fill('#planned-exam-name', 'Official practice sample');
    const today = await page.evaluate(() => guideDateKey());
    await page.fill('#planned-exam-date', today);
    await page.fill('#planned-exam-minutes', '120');
    await page.selectOption('#planned-exam-source', 'official');
    for (const i of await page.locator('[data-planned-score]').all()) await i.fill('128');
    await page.locator('#planned-exam-form button[type="submit"],#planned-exam-form button.btn-solid').click();
    assert.ok((await page.locator('.v2-score-total').innerText()).includes('512'));
    assert.ok(await page.locator('.v2-budget-note').count());
    await page.click('[data-exam-review]');
    await page.fill('#external-exam-note', 'I will review the graph axes and compare my pace by section.');
    await page.click('#external-review-done');
    assert.ok(await page.evaluate(() => v2State.weekly.exams[0].reviewedAt));
    await open('weekly');
    await page.click('[data-exam-remove]');
    assert.equal(await page.locator('.v2-exam').count(), 0);
    await page.click('#exam-undo');
    assert.equal(await page.locator('.v2-exam').count(), 1);
    await overflow('weekly official result');
    // Pilot is opt-in, local-only, and its export leaves global learning records untouched.
    await open('review');
    assert.equal(await page.locator('#pilot-start').isDisabled(), true);
    await page.check('#pilot-consent');
    await page.click('#pilot-start');
    await page.selectOption('#pilot-clarity', '4');
    await page.fill('#pilot-feedback-note', 'The next step was clear; the table could use more breathing room.');
    await page.locator('#pilot-feedback button').click();
    assert.equal(
      await page.evaluate(() => JSON.parse(localStorage.getItem('cortex-mcat-pilot-v2')).sessions.length),
      1
    );
    assert.equal(await page.evaluate(() => SYNC_KEYS('cortex-mcat-pilot-v2')), false);
    const dl = page.waitForEvent('download');
    await page.click('#pilot-export');
    assert.ok((await dl).suggestedFilename().includes('pilot-feedback'));
    await overflow('pilot');
    assert.deepEqual(errors, []);
    console.log(
      `${width}: coached passages, evidence labels, repeated items, six math skills, diagnosis override, official results, review, undo, local pilot, reload and overflow passed`
    );
    await ctx.close();
  }
} finally {
  await browser.close();
}
