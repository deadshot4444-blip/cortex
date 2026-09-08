const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('anatomy.js', 'utf8') + '\nrenderAnatView=()=>{};';
const saved = new Map([['cs-anat', JSON.stringify({ hand: { find: 8 } })]]);
const nodes = new Map(),
  listeners = {};
let invalid = 0,
  fail = false;
const context = vm.createContext({
  console,
  Math,
  Date,
  JSON,
  URL,
  URLSearchParams,
  location: { origin: 'http://localhost', pathname: '/anatomy', search: '' },
  history: { pushState() {} },
  sectionUrl: () => '/anatomy',
  esc: String,
  window: {
    addEventListener(type, fn) {
      listeners[type] = fn;
    },
    scrollTo() {},
  },
  document: {
    querySelectorAll: () => [],
    getElementById(id) {
      if (!nodes.has(id))
        nodes.set(id, {
          textContent: '',
          innerHTML: '',
          querySelectorAll: () => [],
          insertAdjacentHTML(_, html) {
            this.innerHTML += html;
          },
          addEventListener(type, fn) {
            this[type] = fn;
          },
          focus() {},
        });
      return nodes.get(id);
    },
  },
  StudyStorage: {
    paused: false,
    read: (key, fallback) => (saved.has(key) ? JSON.parse(saved.get(key)) : fallback),
    watch() {},
    sessionFailed() {
      invalid++;
    },
    write(key, value) {
      if (fail) return false;
      saved.set(key, JSON.stringify(value));
      return true;
    },
  },
});
vm.runInContext(source, context);
const run = code => vm.runInContext(code, context);
assert.equal(run('ANAT_STORE.hand.find'), 8);
run('startAnat("thorax","find")');
assert.equal(run('validAnatRun(anat)'), true);
const target = run('anat.queue[0]');
run(`onBoneClick({dataset:{bone:${JSON.stringify(target)}}})`);
assert.equal(run('anat.answers.length'), 1);
assert.equal(run('anat.correct'), 1);
assert.equal(run('anat.idx'), 0);
run(`onBoneClick({dataset:{bone:${JSON.stringify(target)}}})`);
assert.equal(run('anat.correct'), 1, 'Repeated find clicks must not add credit or skip a prompt');
assert.equal(run('anat.answers.length'), 1);
nodes.get('anext').click();
assert.equal(run('anat.idx'), 1);
while (run('anat.idx < anat.queue.length')) {
  const id = run('anat.queue[anat.idx]');
  run(`onBoneClick({dataset:{bone:${JSON.stringify(id)}}})`);
  nodes.get('anext').click();
}
const time = run('anat.completedAt');
assert.ok(time);
assert.equal(run('ANAT_STORE.thorax.find'), 6);
run('finishAnat()');
assert.equal(run('anat.completedAt'), time);
run('startAnat("thorax","find",true)');
assert.equal(run('ANAT_RUNS.history.length'), 1);
assert.equal(run('ANAT_RUNS.history[0].completedAt'), time);
assert.equal(run('ANAT_STORE.hand.find'), 8);
fail = true;
run('onBoneClick({dataset:{bone:anat.queue[0]}})');
assert.equal(run('anat.answers.length'), 1, 'Failed saving retains the in-tab answer');
fail = false;
run('saveAnatRun()');
assert.equal(JSON.parse(saved.get('cs-anat-runs-v1')).sessions['thorax:find'].answers.length, 1);
run('startAnat("hand","name")');
run('nextQuiz()');
assert.equal(run('validAnatRun(anat)'), true);
const optionOrder = run('JSON.stringify(anat.orders[0])');
run('nextQuiz()');
assert.equal(run('JSON.stringify(anat.orders[0])'), optionOrder);
run('pickName(anat.queue[0],anat.queue[0])');
run('pickName(anat.queue[0],anat.queue[0])');
assert.equal(run('anat.correct'), 1);
assert.equal(invalid, 0);
assert.equal(run('validAnatRun({...anat,idx:99})'), false);
// After a save recovery the anatomy home renders once: AcademyLessons re-renders it whenever the course is bound.
context.renders = 0;
run('renderAnatomy = () => { renders++; }');
listeners['study-storage-recovered']();
assert.equal(run('renders'), 1, 'Unbound anatomy page re-renders itself');
run('anatLessonsBound = true');
listeners['study-storage-recovered']();
assert.equal(run('renders'), 1, 'A bound course leaves the re-render to AcademyLessons');
run('anatLessonsBound = false');
context.location.search = '?lesson=anat-position-forearm';
listeners['study-storage-recovered']();
assert.equal(run('renders'), 1, 'A lesson URL is handled by AcademyLessons');
context.location.search = '';
console.log(
  'Legacy best scores, separate saved atlas sessions, repeated-click protection, immutable option order, retained failed saves and completion/retry history and single recovery re-render passed.'
);
