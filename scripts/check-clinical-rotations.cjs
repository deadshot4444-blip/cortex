const fs = require('node:fs');
const path = require('node:path');
const base = path.join(__dirname, '..', 'data');
const read = file => JSON.parse(fs.readFileSync(path.join(base, file), 'utf8'));

function validate(manifest, banks, index, counts) {
  const errors = [], queue = [], ids = new Set();
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const check = (ok, message) => { if (!ok) errors.push(message); };
  check(Array.isArray(manifest.rotations) && manifest.rotations.length > 0, 'At least one rotation is required');
  for (const rotation of Array.isArray(manifest.rotations) ? manifest.rotations : []) {
    const bank = banks[rotation.key];
    check(bank?.cases?.length === counts[rotation.key], `${rotation.key}: catalog count disagrees`);
    for (const id of rotation.caseIds || []) {
      check(!ids.has(id), `${id}: duplicate rotation assignment`); ids.add(id);
      const matches = bank?.cases?.filter(item => item.id === id) || [];
      check(matches.length === 1, `${id}: case must exist once`);
      const c = matches[0]; if (!c) continue;
      check(index.filter(item => item.id === id && item.key === rotation.key).length === 1, `${id}: index entry must exist once`);
      const indexed = index.find(item => item.id === id && item.key === rotation.key);
      check(['title', 'difficulty', 'diagnosis'].every(field => indexed?.[field] === c[field]), `${id}: search metadata disagrees with current content`);
      for (const field of ['title', 'patient', 'setting', 'chiefComplaint', 'history', 'exam', 'diagnosis']) check(text(c[field]), `${id}: missing ${field}`);
      check(c.vitals && Object.values(c.vitals).every(text), `${id}: missing or invalid vitals`);
      check(Array.isArray(c.pearls) && c.pearls.length > 0 && c.pearls.every(text), `${id}: missing learning points`);
      const stages = Array.isArray(c.stages) ? c.stages : [], diagnosis = stages.findIndex(stage => stage.label === 'DIAGNOSIS');
      check(stages[0]?.type === 'question' && stages[0]?.label === 'INITIAL APPROACH', `${id}: first decision must be an initial approach`);
      check(stages.filter(stage => stage.type === 'question' && stage.label === 'DIAGNOSIS').length === 1, `${id}: exactly one differential checkpoint required`);
      check(stages.slice(0, diagnosis).some(stage => stage.type === 'result'), `${id}: differential needs staged findings`);
      check(stages.slice(diagnosis + 1).some(stage => stage.type === 'question'), `${id}: post-diagnosis decision required`);
      stages.forEach((stage, i) => {
        if (stage.type === 'result') check(text(stage.content), `${id}/${i}: empty result`);
        else {
          check(stage.type === 'question' && text(stage.question) && text(stage.explanation), `${id}/${i}: invalid decision`);
          check(Array.isArray(stage.options) && stage.options.length >= 4 && stage.options.every(text) && new Set(stage.options).size === stage.options.length, `${id}/${i}: at least four distinct options required`);
          check(Number.isInteger(stage.answer) && stage.answer >= 0 && stage.answer < stage.options?.length, `${id}/${i}: invalid answer index`);
        }
      });
      const review = manifest.caseReviews?.[id], note = manifest.modelNotes?.[id], investigation = manifest.investigations?.[id];
      check(text(note?.assessment) && text(note?.plan), `${id}: complete model note required`);
      for (const kind of ['interview', 'exam']) check(investigation?.[kind]?.length > 0 && investigation[kind].every(item => text(item.prompt) && text(item.finding)), `${id}: missing ${kind} findings`);
      check(text(review?.objective) && text(review?.alternativesAndLimits), `${id}: objective and limits required`);
      check(/^\d{4}-\d{2}-\d{2}$/.test(review?.sourceCheckedOn), `${id}: source-check date required`);
      check(Array.isArray(review?.sources) && review.sources.length > 0 && review.sources.every(source => text(source.title) && /^https:\/\//.test(source.url) && !source.url.includes('example.org')), `${id}: primary source links required`);
      check(review?.independentReview === 'pending' || text(review?.reviewer) && text(review?.reviewedAt), `${id}: completed review needs identity and date`);
      queue.push({ caseId: id, specialty: rotation.key, title: c.title, objective: review?.objective,
        contentRevision: c.contentRevision || manifest.version, sourceCheckedOn: review?.sourceCheckedOn,
        independentReview: review?.independentReview || 'pending', reviewer: review?.reviewer || null,
        reviewedAt: review?.reviewedAt || null, questions: review?.reviewQuestions || ['Verify staged decisions, reasonable alternatives, final model note and regional applicability.'],
        sources: review?.sources || [], browserWalkthrough: 'See separately recorded evidence; not inferred by this validator' });
    }
  }
  return { errors, queue };
}

if (require.main === module) {
  const manifest = read('clinical-shift-pilot.json');
  const banks = Object.fromEntries(manifest.rotations.map(rotation => [rotation.key, read(rotation.key + '.json')]));
  const result = validate(manifest, banks, read('index.json'), read('manifest.json'));
  if (process.argv.includes('--json')) console.log(JSON.stringify({ manifestVersion: manifest.version, ...result }, null, 2));
  else console.log(result.errors.length ? result.errors.join('\n') : `${result.queue.length} registered encounters passed authoring consistency checks. Independent clinician review remains pending.`);
  if (result.errors.length) process.exitCode = 1;
}
module.exports = { validate };
