/* Derive an exact content review queue; this records structure, not reviewer approval. */
const fs = require('node:fs'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict');
const Core = require('../neuro-project-engine.js');
const read = name => JSON.parse(fs.readFileSync('data/' + name));
const data = read('neuro-projects.json'),
  milestones = read('neuro-milestones.json').milestones;
const units = read('neuro.json').learningPaths[0].steps.map(step => step.id);
assert.equal(data.version, 1);
assert.equal(data.projects.length, milestones.length);
assert.equal(new Set(data.projects.map(p => p.id)).size, data.projects.length);
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const projects = data.projects.map((project, index) => {
  Core.validateProject(project);
  const milestone = milestones[index];
  assert.equal(project.id, milestone.id);
  assert.equal(project.revision, milestone.revision);
  assert.equal(project.unlockUnit, milestone.unlockUnit);
  assert.deepEqual(project.prerequisites, units.slice(0, milestone.unlockUnit));
  assert.equal(project.previousProject, index ? data.projects[index - 1].id : null);
  assert.equal(sha(Core.canonicalInputs(project.checks.cases[0].args)), project.inputSha256);
  return {
    id: project.id,
    revision: project.revision,
    sha256: sha(JSON.stringify(project)),
    inputSha256: project.inputSha256,
    review: project.review,
    provenance: project.provenance,
    sources: project.sources,
    prerequisites: project.prerequisites,
    previousProject: project.previousProject,
    method: project.method,
    rubric: project.rubric,
    function: project.checks.function,
    checks: project.checks.cases.map((c, index) => ({
      index,
      label: c.label,
      outcome: c.raises || 'documented return value',
    })),
    reviewQuestions: [
      'Do the inputs, units, reference method and outputs agree?',
      'Do failure cases expose meaningful mistakes and preserve arguments?',
      'Are biological, statistical and control-system limitations explicit?',
      'Does the written rubric avoid implying professional competence?',
    ],
  };
});
const report = {
  scope:
    'Content structure and exact revisions; independent engineering review and browser acceptance remain separate.',
  counts: { projects: projects.length, behaviorCases: projects.reduce((sum, p) => sum + p.checks.length, 0) },
  projects,
};
console.log(
  JSON.stringify(
    process.argv.includes('--json')
      ? report
      : {
          ...report.counts,
          independentReview: projects.every(p => p.review.status === 'reviewed') ? 'recorded' : 'pending',
        },
    null,
    2
  )
);
