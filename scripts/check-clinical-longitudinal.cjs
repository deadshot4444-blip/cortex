/* Derive the review queue from every playable branch, never from a hand-written subset. */
const fs = require('node:fs'),
  crypto = require('node:crypto');
const Core = require('../clinical-longitudinal-engine.js');
const data = JSON.parse(fs.readFileSync('data/clinical-longitudinal.json'));
if (data.version !== 1 || !data.cases?.length || new Set(data.cases.map(c => c.id)).size !== data.cases.length)
  throw Error('Invalid collection');
const cases = data.cases.map(item => {
  Core.validateCase(item);
  return {
    id: item.id,
    revision: item.revision,
    sha256: crypto.createHash('sha256').update(JSON.stringify(item)).digest('hex'),
    review: item.review,
    scope: item.scope,
    sources: item.sources,
    paths: Core.paths(item),
    checkpoints: item.nodes.map(node => ({
      id: node.id,
      title: node.title,
      kind: node.kind,
      reviewQuestions: node.reviewQuestions,
      branches: (node.options || []).map(option => ({ id: option.id, next: option.next, feedback: option.feedback })),
    })),
  };
});
const report = {
  scope: 'Structural branch coverage, not clinical approval or browser acceptance',
  cases,
  counts: {
    cases: cases.length,
    checkpoints: cases.reduce((n, c) => n + c.checkpoints.length, 0),
    branches: cases.reduce((n, c) => n + c.checkpoints.reduce((s, p) => s + p.branches.length, 0), 0),
    paths: cases.reduce((n, c) => n + c.paths.length, 0),
  },
};
console.log(
  JSON.stringify(
    process.argv.includes('--json')
      ? report
      : {
          ...report.counts,
          independentReview: cases.every(c => c.review.status === 'reviewed') ? 'recorded' : 'pending',
        },
    null,
    2
  )
);
