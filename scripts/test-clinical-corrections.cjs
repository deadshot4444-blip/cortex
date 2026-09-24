const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const reconciliationPath = 'content/clinical-corrections-reconciliation-2026-09-23.json';
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

function checkFixture(mutate = () => {}) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-clinical-history-'));
  const write = (file, data) => {
    const destination = path.join(folder, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, JSON.stringify(data));
  };
  const history = read('content/clinical-corrections-m29.json');
  const current = read('data/cardiology.json').cases.find(c => c.id === history.case.id);
  const state = {
    current,
    reconciliation: read(reconciliationPath),
    later: read('data/clinical-shift-revisions.json'),
  };
  try {
    mutate(state);
    write('data/manifest.json', { cardiology: 1 });
    write('data/cardiology.json', { cases: [state.current] });
    write('data/index.json', [{ ...state.current, key: 'cardiology' }]);
    write('data/labs.json', [history.lab.after]);
    write('data/clinical-shift-revisions.json', state.later);
    write(reconciliationPath, state.reconciliation);
    fs.copyFileSync(
      path.join(root, 'content/clinical-corrections-m29.json'),
      path.join(folder, 'content/clinical-corrections-m29.json')
    );
    return spawnSync(process.execPath, [path.join(root, 'scripts/check-clinical-corrections.cjs')], {
      cwd: folder,
      encoding: 'utf8',
    });
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

test('the intact original history plus explicit reconciliation reconstructs the current case', () => {
  const result = checkFixture();
  assert.equal(result.status, 0, result.stderr);
});

test('an unlogged distractor or explanation mutation still fails the complete case comparison', () => {
  for (const field of ['distractor', 'explanation']) {
    const result = checkFixture(({ current }) => {
      if (field === 'distractor') current.stages[5].options[1] += ' Unlogged edit.';
      else current.stages[5].explanation += ' Unlogged edit.';
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /AssertionError/);
    assert.match(result.stderr, /Unlogged edit/);
  }
});

test('omitting a recorded transition does not silently accept the current revision', () => {
  const result = checkFixture(({ reconciliation }) => reconciliation.changes.shift());
  assert.equal(result.status, 1);
  assert.match(result.stderr, /revision: 3/);
  assert.match(result.stderr, /revision: 2/);
});

test('a reconstruction with an incorrect before value is rejected before applying it', () => {
  const result = checkFixture(({ reconciliation }) => {
    reconciliation.changes[1].before = 'Invented older wording';
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\/case\/stages\/5\/options\/1 before/);
});

test('the original historical record hash cannot be silently replaced', () => {
  const result = checkFixture(({ reconciliation }) => {
    reconciliation.sourceEvidence.preservedHistorySha256 = '0'.repeat(64);
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /The original correction record must remain intact/);
});
