/* Source and format audit only. This does not perform content or learner review. */
const fs = require('node:fs');
const Core = require('../mcat-rehearsal-engine.js');
const manifest = JSON.parse(fs.readFileSync('data/mcat-rehearsals.json'));
const bank = {
  cars: JSON.parse(fs.readFileSync('data/mcat-cars.json')),
  sci: JSON.parse(fs.readFileSync('data/mcat-science-passages.json')),
  questions: JSON.parse(fs.readFileSync('data/mcat-questions.json')),
};
(async () => {
  if (manifest.format !== 1 || new Set(manifest.forms.map(f => f.id)).size !== manifest.forms.length)
    throw Error('Invalid form inventory.');
  const queues = [];
  for (const form of manifest.forms) {
    const section = await Core.verify(form, bank, manifest.protectedPassages);
    queues.push(section);
    console.log(
      `${form.id}: ${section.items.length} questions, ${form.passages.length} passages, ${form.discretes.length} independent questions, ${form.minutes} minutes; ${form.status}. Source fingerprint matches.`
    );
  }
  const total = queues.reduce((sum, section) => sum + section.items.length, 0);
  console.log(`${total} selected questions. Full-length reviewed claim eligible: ${Core.fullLengthEligible(queues)}.`);
  console.log(
    'Independent content and originality/rights review remain pending. Runtime and actual browser verification are separate.'
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
