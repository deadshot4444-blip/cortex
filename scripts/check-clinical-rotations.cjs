const fs = require('node:fs');
const path = require('node:path');
const base = path.join(__dirname, '..', 'data');
const read = file => JSON.parse(fs.readFileSync(path.join(base, file), 'utf8'));

const STATUSES = ['better', 'stable', 'unstable', 'worse', 'critical'];

/* A reacting patient is a layer written over one case: plain wording for each prompt, and a consequence
   for every option. It has to line up with the case option for option, or the learner would be shown
   the outcome of a call they did not make. `lessons` maps MCAT unit ids to titles when it is supplied. */
function checkReaction(id, c, reaction, investigation, lessons, check, text) {
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const tag = `${id} reaction`;
  if (!object(reaction)) {
    check(false, `${tag}: must be an object`);
    return;
  }
  const stages = Array.isArray(c.stages) ? c.stages : [];
  check(/^\d{4}-\d{2}-\d{2}$/.test(reaction.sourceCheckedOn), `${tag}: source-check date required`);
  check(
    reaction.independentReview === 'pending' || (text(reaction.reviewer) && text(reaction.reviewedAt)),
    `${tag}: completed review needs identity and date`
  );
  check(
    Array.isArray(reaction.sources) &&
      reaction.sources.length > 0 &&
      reaction.sources.every(
        source => text(source?.title) && /^https:\/\//.test(source.url) && !source.url.includes('example.org')
      ),
    `${tag}: primary source links required`
  );
  for (const field of ['title', 'setting', 'handoff', 'plainDiagnosis'])
    check(text(reaction[field]), `${tag}: missing ${field}`);
  for (const kind of ['interview', 'exam'])
    check(
      Array.isArray(reaction.investigation?.[kind]) &&
        reaction.investigation[kind].length === investigation?.[kind]?.length &&
        reaction.investigation[kind].every(item => text(item?.prompt) && text(item?.finding)),
      `${tag}: plain ${kind} items must match the authored list one for one`
    );
  const resultStages = stages.map((stage, i) => (stage.type === 'result' ? String(i) : null)).filter(Boolean);
  check(
    object(reaction.results) &&
      Object.keys(reaction.results).sort().join() === resultStages.sort().join() &&
      Object.values(reaction.results).every(result => text(result?.label) && text(result?.content)),
    `${tag}: every result needs a plain-language version`
  );
  const decisionStages = stages
    .map((stage, i) => (stage.type === 'question' && stage.label !== 'DIAGNOSIS' ? String(i) : null))
    .filter(Boolean);
  check(
    object(reaction.decisions) && Object.keys(reaction.decisions).sort().join() === decisionStages.sort().join(),
    `${tag}: decisions must cover exactly the case's decision stages`
  );
  for (const key of decisionStages) {
    const stage = stages[Number(key)],
      decision = reaction.decisions?.[key],
      at = `${tag}/${key}`;
    if (!object(decision)) continue;
    check(
      text(decision.resident) && text(decision.question) && text(decision.fix),
      `${at}: resident line, question and fix required`
    );
    check(
      Array.isArray(decision.options) &&
        decision.options.length === stage.options.length &&
        decision.options.every(text) &&
        new Set(decision.options).size === decision.options.length,
      `${at}: one distinct plain option per case option`
    );
    check(
      Array.isArray(decision.terms) &&
        decision.terms.length > 0 &&
        decision.terms.every(item => text(item?.term) && text(item?.meaning)),
      `${at}: words to know required`
    );
    check(
      Array.isArray(decision.outcomes) && decision.outcomes.length === stage.options.length,
      `${at}: one outcome per option`
    );
    (Array.isArray(decision.outcomes) ? decision.outcomes : []).forEach((outcome, choice) => {
      const here = `${at} option ${choice}`;
      if (!object(outcome)) {
        check(false, `${here}: outcome must be an object`);
        return;
      }
      check(
        choice === stage.answer ? outcome.kind === 'safe' : ['near-miss', 'delay'].includes(outcome.kind),
        `${here}: only the case's keyed option may be the safe call`
      );
      check(
        Number.isInteger(outcome.minutes) && outcome.minutes > 0,
        `${here}: minutes must be a positive whole number`
      );
      check(text(outcome.story) && text(outcome.reply), `${here}: story and resident reply required`);
      const vitals = outcome.vitals === undefined ? {} : outcome.vitals,
        trend = outcome.trend === undefined ? {} : outcome.trend;
      check(
        object(vitals) && Object.entries(vitals).every(([name, value]) => name in (c.vitals || {}) && text(value)),
        `${here}: changed vitals must be vitals this case records`
      );
      check(
        object(trend) && Object.entries(trend).every(([name, way]) => name in vitals && ['up', 'down'].includes(way)),
        `${here}: a trend must point up or down on a vital that changed`
      );
      check(outcome.status === undefined || STATUSES.includes(outcome.status), `${here}: unknown status`);
      check(outcome.alarm === undefined || typeof outcome.alarm === 'string', `${here}: alarm must be text`);
      if (outcome.kind === 'delay')
        check(
          ['unstable', 'worse', 'critical'].includes(outcome.status) && text(outcome.alarm),
          `${here}: an unsafe delay must leave the patient visibly worse`
        );
      if (outcome.kind === 'near-miss')
        check(
          outcome.status === undefined && outcome.vitals === undefined,
          `${here}: a near miss is caught before it reaches the patient`
        );
      if (outcome.kind === 'safe')
        check(!['worse', 'critical'].includes(outcome.status), `${here}: the safe call cannot make the patient worse`);
    });
  }
  /* Outcomes carry fixed readings, and a learner can reach a decision by any mix of earlier calls. A
     reading shown as rising therefore has to be higher than anything it could have been before, and
     one shown as falling lower; otherwise some path would print "rising" under a smaller number. */
  const reading = value => parseFloat(String(value));
  const reach = Object.fromEntries(
    Object.entries(c.vitals || {}).map(([name, value]) => [name, { low: reading(value), high: reading(value) }])
  );
  for (const key of decisionStages) {
    const outcomes = Array.isArray(reaction.decisions?.[key]?.outcomes) ? reaction.decisions[key].outcomes : [];
    for (const [choice, outcome] of outcomes.entries())
      for (const [name, way] of Object.entries(
        outcome?.trend && typeof outcome.trend === 'object' ? outcome.trend : {}
      )) {
        const now = reading(outcome.vitals?.[name]),
          before = reach[name];
        if (before && Number.isFinite(now))
          check(
            way === 'up' ? now > before.high : now < before.low,
            `${tag}/${key} option ${choice}: ${name} is shown ${way === 'up' ? 'rising' : 'falling'} but an earlier call can already leave it at ${way === 'up' ? before.high : before.low}`
          );
      }
    for (const outcome of outcomes)
      for (const [name, value] of Object.entries(
        outcome?.vitals && typeof outcome.vitals === 'object' ? outcome.vitals : {}
      ))
        if (reach[name] && Number.isFinite(reading(value))) {
          reach[name].low = Math.min(reach[name].low, reading(value));
          reach[name].high = Math.max(reach[name].high, reading(value));
        }
  }
  const diagnosis = stages.find(stage => stage.type === 'question' && stage.label === 'DIAGNOSIS');
  check(
    text(reaction.differential?.resident) &&
      text(reaction.differential?.question) &&
      text(reaction.differential?.reveal),
    `${tag}: differential needs a resident line, a question and a reveal`
  );
  check(
    Array.isArray(reaction.differential?.options) &&
      reaction.differential.options.length === diagnosis?.options?.length &&
      reaction.differential.options.every(text) &&
      new Set(reaction.differential.options).size === reaction.differential.options.length,
    `${tag}: one distinct plain diagnosis per case option`
  );
  check(
    Array.isArray(reaction.differential?.terms) &&
      reaction.differential.terms.every(item => text(item?.term) && text(item?.meaning)),
    `${tag}: differential words to know must be complete`
  );
  check(
    ['stable', 'worse', 'critical'].every(status => text(reaction.ending?.[status])),
    `${tag}: an ending is required for a stable, a worse and a critical patient`
  );
  check(
    Array.isArray(reaction.science) &&
      reaction.science.length >= 1 &&
      reaction.science.length <= 4 &&
      reaction.science.every(item => text(item?.tag) && text(item?.title) && text(item?.text)),
    `${tag}: one to four science links required`
  );
  if (lessons)
    for (const item of Array.isArray(reaction.science) ? reaction.science : [])
      check(
        item.lesson === undefined || (lessons.has(item.lesson) && lessons.get(item.lesson) === item.lessonTitle),
        `${tag}: science link "${item?.title}" must name an MCAT lesson by its id and current title`
      );
}

function validate(manifest, banks, index, counts, course) {
  const errors = [],
    queue = [],
    ids = new Set();
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const check = (ok, message) => {
    if (!ok) errors.push(message);
  };
  const lessons = course ? new Map((course.units || []).map(unit => [unit.id, unit.title])) : null;
  check(Array.isArray(manifest.rotations) && manifest.rotations.length > 0, 'At least one rotation is required');
  for (const rotation of Array.isArray(manifest.rotations) ? manifest.rotations : []) {
    const bank = banks[rotation.key];
    check(bank?.cases?.length === counts[rotation.key], `${rotation.key}: catalog count disagrees`);
    for (const id of rotation.caseIds || []) {
      check(!ids.has(id), `${id}: duplicate rotation assignment`);
      ids.add(id);
      const matches = bank?.cases?.filter(item => item.id === id) || [];
      check(matches.length === 1, `${id}: case must exist once`);
      const c = matches[0];
      if (!c) continue;
      check(
        index.filter(item => item.id === id && item.key === rotation.key).length === 1,
        `${id}: index entry must exist once`
      );
      const indexed = index.find(item => item.id === id && item.key === rotation.key);
      check(
        ['title', 'difficulty', 'diagnosis'].every(field => indexed?.[field] === c[field]),
        `${id}: search metadata disagrees with current content`
      );
      for (const field of ['title', 'patient', 'setting', 'chiefComplaint', 'history', 'exam', 'diagnosis'])
        check(text(c[field]), `${id}: missing ${field}`);
      check(c.vitals && Object.values(c.vitals).every(text), `${id}: missing or invalid vitals`);
      check(Array.isArray(c.pearls) && c.pearls.length > 0 && c.pearls.every(text), `${id}: missing learning points`);
      const stages = Array.isArray(c.stages) ? c.stages : [],
        diagnosis = stages.findIndex(stage => stage.label === 'DIAGNOSIS');
      check(
        stages[0]?.type === 'question' && stages[0]?.label === 'INITIAL APPROACH',
        `${id}: first decision must be an initial approach`
      );
      check(
        stages.filter(stage => stage.type === 'question' && stage.label === 'DIAGNOSIS').length === 1,
        `${id}: exactly one differential checkpoint required`
      );
      check(
        stages.slice(0, diagnosis).some(stage => stage.type === 'result'),
        `${id}: differential needs staged findings`
      );
      check(
        stages.slice(diagnosis + 1).some(stage => stage.type === 'question'),
        `${id}: post-diagnosis decision required`
      );
      stages.forEach((stage, i) => {
        if (stage.type === 'result') check(text(stage.content), `${id}/${i}: empty result`);
        else {
          check(
            stage.type === 'question' && text(stage.question) && text(stage.explanation),
            `${id}/${i}: invalid decision`
          );
          check(
            Array.isArray(stage.options) &&
              stage.options.length >= 4 &&
              stage.options.every(text) &&
              new Set(stage.options).size === stage.options.length,
            `${id}/${i}: at least four distinct options required`
          );
          check(
            Number.isInteger(stage.answer) && stage.answer >= 0 && stage.answer < stage.options?.length,
            `${id}/${i}: invalid answer index`
          );
        }
      });
      const review = manifest.caseReviews?.[id],
        note = manifest.modelNotes?.[id],
        investigation = manifest.investigations?.[id];
      check(text(note?.assessment) && text(note?.plan), `${id}: complete model note required`);
      for (const kind of ['interview', 'exam'])
        check(
          investigation?.[kind]?.length > 0 &&
            investigation[kind].every(item => text(item.prompt) && text(item.finding)),
          `${id}: missing ${kind} findings`
        );
      check(text(review?.objective) && text(review?.alternativesAndLimits), `${id}: objective and limits required`);
      check(/^\d{4}-\d{2}-\d{2}$/.test(review?.sourceCheckedOn), `${id}: source-check date required`);
      check(
        Array.isArray(review?.sources) &&
          review.sources.length > 0 &&
          review.sources.every(
            source => text(source.title) && /^https:\/\//.test(source.url) && !source.url.includes('example.org')
          ),
        `${id}: primary source links required`
      );
      check(
        review?.independentReview === 'pending' || (text(review?.reviewer) && text(review?.reviewedAt)),
        `${id}: completed review needs identity and date`
      );
      const reaction = manifest.reactions?.[id];
      if (reaction !== undefined) checkReaction(id, c, reaction, investigation, lessons, check, text);
      queue.push({
        caseId: id,
        specialty: rotation.key,
        title: c.title,
        objective: review?.objective,
        contentRevision: c.contentRevision || manifest.version,
        sourceCheckedOn: review?.sourceCheckedOn,
        independentReview: review?.independentReview || 'pending',
        reviewer: review?.reviewer || null,
        reviewedAt: review?.reviewedAt || null,
        questions: review?.reviewQuestions || [
          'Verify staged decisions, reasonable alternatives, final model note and regional applicability.',
        ],
        sources: review?.sources || [],
        reactingPatient: reaction
          ? {
              sourceCheckedOn: reaction.sourceCheckedOn,
              independentReview: reaction.independentReview || 'pending',
              sources: reaction.sources || [],
            }
          : null,
        browserWalkthrough: 'See separately recorded evidence; not inferred by this validator',
      });
    }
  }
  for (const id of Object.keys(manifest.reactions || {}))
    check(ids.has(id), `${id}: a reaction was written for a case outside the rotations`);
  return { errors, queue };
}

if (require.main === module) {
  const manifest = read('clinical-shift-pilot.json');
  const banks = Object.fromEntries(manifest.rotations.map(rotation => [rotation.key, read(rotation.key + '.json')]));
  const result = validate(manifest, banks, read('index.json'), read('manifest.json'), read('mcat-course.json'));
  if (process.argv.includes('--json'))
    console.log(JSON.stringify({ manifestVersion: manifest.version, ...result }, null, 2));
  else
    console.log(
      result.errors.length
        ? result.errors.join('\n')
        : `${result.queue.length} registered encounters (${result.queue.filter(row => row.reactingPatient).length} with a reacting patient) passed authoring consistency checks. Independent clinician review remains pending.`
    );
  if (result.errors.length) process.exitCode = 1;
}
module.exports = { validate };
