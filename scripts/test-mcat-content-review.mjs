import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile, mkdir} from 'node:fs/promises';
const base = process.env.CORTEX_URL || 'http://127.0.0.1:8805/';
assert.equal(new URL(base).port, '8805', 'Use the isolated test origin, not a learner preview');
const browser = await chromium.launch({headless:true});
try {
  for (const width of [1280,390,320]) {
    const context = await browser.newContext({viewport:{width,height:900},acceptDownloads:true});
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', r => r.fulfill({status:200,contentType:'application/json',body:'{"value":0}'}));
    const open = view => page.goto(base + 'mcat?gates=prod&view=' + view,{waitUntil:'networkidle'});
    await open('review');
    const assertLearnerCopy = async () => assert.doesNotMatch(await page.locator('main').innerText(), /AI content review|human review|subject-matter review pending|learner pilot|local reviewer attestations/i);
    await assertLearnerCopy();
    assert.equal(await page.locator('#review-attestation, #review-export').count(), 0);
    assert.equal(await page.locator('#pilot-start').isDisabled(), true);
    assert.equal(await page.evaluate(() => v2Pilot.active), undefined);
    assert.equal(await page.evaluate(() => Object.keys(v2Pilot.reviews).length), 0);
    await page.locator('.course-map summary').click();
    await page.selectOption('#review-unit', 'stereochemistry');
    assert.equal(await page.locator('#review-unit-details a').count(), 2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await page.locator('.course-map summary').click();
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({top:0,left:0,behavior:'instant'}); });
    await page.waitForFunction(() => scrollY === 0);
    await mkdir('output/playwright', {recursive:true});
    await page.screenshot({path:`output/playwright/mcat-reflections-${width}.png`,fullPage:true});
    // Synthetic fixture in this disposable browser context; never counted as a real learner pilot.
    await page.check('#pilot-consent'); await page.click('#pilot-start');
    await page.fill('#pilot-feedback-note', 'AUTOMATED TEST FIXTURE: saved draft, no learner observations.');
    await page.selectOption('#pilot-clarity', '3');
    await page.reload({waitUntil:'networkidle'});
    assert.match(await page.inputValue('#pilot-feedback-note'), /AUTOMATED TEST FIXTURE/);
    assert.equal(await page.inputValue('#pilot-clarity'), '3');
    assert.match(await page.locator('#pilot-feedback').innerText(), /leave it open and return later/);
    assert.equal(await page.evaluate(() => v2Pilot.sessions.length), 0);
    assert.deepEqual(await page.evaluate(() => {const s=v2PilotSnapshot(v2Pilot.active.startedAt);return [s.lessons.length,s.coach.length,s.math.length,s.laterAnswers.length];}), [0,0,0,0]);
    await page.getByRole('button',{name:'Finish and save reflection',exact:true}).click();
    assert.equal(await page.evaluate(() => v2Pilot.sessions.length), 1);
    assert.equal(await page.evaluate(() => v2Pilot.active), undefined);
    await page.getByText('Past reflections · 1', {exact:true}).click();
    assert.match(await page.locator('.course-saved-answer').innerText(), /AUTOMATED TEST FIXTURE/);
    // Old pilot notes and reviewer records survive the presentation change and remain exportable.
    await page.evaluate(() => {
      const data=JSON.parse(localStorage.getItem('cortex-mcat-pilot-v2'));
      data.reviews['protein-structure']={status:'changes',note:'OLD REVIEW FIXTURE',ts:1};
      data.sessions.push({id:'old-pilot',startedAt:1,finishedAt:2,note:'OLD PILOT FIXTURE',consent:'Voluntary local feedback'});
      localStorage.setItem('cortex-mcat-pilot-v2',JSON.stringify(data));
    });
    await page.reload({waitUntil:'networkidle'});
    await page.getByText('Past reflections · 2', {exact:true}).click();
    assert.match(await page.locator('.course-saved-answer').first().innerText(), /OLD PILOT FIXTURE/);
    const exportPromise = page.waitForEvent('download'); await page.click('#pilot-export');
    const bundle = JSON.parse(await readFile(await (await exportPromise).path(), 'utf8'));
    assert.equal(bundle.sessions.length, 2);
    assert.equal(bundle.previousReviewNotes['protein-structure'].note, 'OLD REVIEW FIXTURE');
    assert.equal(bundle.active, null);
    assert.equal(bundle.sessions[0].note, 'AUTOMATED TEST FIXTURE: saved draft, no learner observations.');
    await assertLearnerCopy();
    await open('progress'); await assertLearnerCopy();
    await page.getByRole('button',{name:'My study reflections',exact:true}).click();
    await page.waitForSelector('#pilot-start');
    await open('course'); await page.locator('[data-course-open="protein-structure"]').first().click();
    await page.waitForSelector('.course-notebook'); await assertLearnerCopy();
    await open('coach'); await page.click('[data-coach-start="coach-cp2"]'); await page.click('#coach-begin');
    assert.match(await page.locator('.v2-passage > .course-caption').innerText(), /illustrative data/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await page.evaluate(() => { const p=MCAT.sci.find(p=>p.id==='bb1');startPassage(p,false); });
    assert.match(await page.locator('.cars-passage > .course-caption').innerText(), /illustrative data/);
    assert.ok(await page.evaluate(() => simPool('bioBiochem').filter(i=>i.passageId==='bb1').every(i=>i.contentNote?.includes('illustrative data'))));
    assert.deepEqual(errors, []); await context.close();
    console.log(`PASS ${width}px learner copy, reflection opt-in/save/reload/export, legacy records, zero fabricated observations, and passage disclosures`);
  }
} finally { await browser.close(); }
