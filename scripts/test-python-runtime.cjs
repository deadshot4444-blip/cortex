/* Exercises the worker protocol in real Node workers. This is not browser QA or a Pyodide run. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Worker: NodeWorker } = require('node:worker_threads');
const runtime = fs.readFileSync('python-runtime.js', 'utf8');
const workerSource = fs.readFileSync('python-runtime-worker.js', 'utf8');
const workers = [], events = new Map();
let nextMode = 'normal';
class BrowserWorker {
  constructor(url) {
    assert.equal(url, 'python-runtime-worker.js?v=1');
    this.terminated = false;
    const mode = nextMode; nextMode = 'normal';
    this.worker = new NodeWorker(`
      const { parentPort, workerData } = require('node:worker_threads');
      const vm = require('node:vm');
      global.self = { postMessage: value => parentPort.postMessage(value) };
      global.importScripts = url => { if (!url.includes('v0.26.4/full/pyodide.js')) throw Error('Wrong runtime URL'); };
      global.loadPyodide = async () => {
        if (workerData.mode === 'load-stall') return new Promise(() => {});
        if (workerData.mode === 'load-error') throw Error('Deliberate download failure');
        let out, err;
        return { setStdout: options => out = options.batched, setStderr: options => err = options.batched,
          loadPackage: async packages => { if (packages.includes('missing')) throw Error('Missing package'); },
          toPy: value => Object.assign(value, {destroy() {}}),
          runPythonAsync: async (code, options) => {
            if (code === 'spin') { out('before loop'); while (true) {} }
            if (code === 'overflow') { for (let i = 0; i < 400; i++) out('x'.repeat(100)); }
            else if (code === 'globals') out(JSON.stringify(options.globals));
            else { out('first'); out('second'); err('diagnostic'); }
          } };
      };
      vm.runInThisContext(workerData.source);
      parentPort.on('message', data => self.onmessage({data}));
    `, { eval: true, workerData: { source: workerSource, mode } });
    this.worker.on('message', data => this.onmessage?.({ data }));
    this.worker.on('error', error => this.onerror?.({ message: error.message, preventDefault() {} }));
    this.exited = new Promise(resolve => this.worker.on('exit', resolve));
    workers.push(this);
  }
  postMessage(message) { this.worker.postMessage(message); }
  terminate() { this.terminated = true; return this.worker.terminate(); }
}
const context = vm.createContext({ console, Worker: BrowserWorker, AbortController,
  window: { addEventListener: (name, handler) => events.set(name, handler) },
  setTimeout: (handler, milliseconds) => setTimeout(handler, milliseconds === 10000 ? 100 : milliseconds === 45000 ? 600 : milliseconds), clearTimeout });
vm.runInContext(runtime, context);
(async () => {
  let ticks = 0, output;
  const ticker = setInterval(() => ticks++, 10);
  const stuck = context.runPythonCode('spin', { onOutput: value => output = value });
  const busy = await context.runPythonCode('second run'); assert.equal(busy.reason, 'busy');
  const timedOut = await stuck; clearInterval(ticker);
  assert.equal(timedOut.ok, false); assert.equal(timedOut.reason, 'timeout');
  assert.ok(ticks >= 5, 'The main event loop remains responsive while the worker is blocked');
  assert.match(timedOut.stdout, /before loop/); assert.match(output.stdout, /before loop/);
  assert.equal(workers[0].terminated, true); await workers[0].exited;
  const retried = await context.runPythonCode('normal');
  assert.equal(retried.ok, true); assert.equal(retried.stdout, 'first\nsecond\n'); assert.equal(retried.stderr, 'diagnostic\n');
  assert.equal(workers[1].terminated, true, 'Successful runs also discard their interpreter');
  const withGlobals = await context.runPythonCode('globals', { globals: { RECORDING: [1, 2, 3] }, packages: ['math'] });
  assert.deepEqual(JSON.parse(withGlobals.stdout).RECORDING, [1, 2, 3]);
  const fresh = await context.runPythonCode('globals'); assert.equal(JSON.parse(fresh.stdout).RECORDING, undefined, 'Input globals do not leak into another run');
  const overflow = await context.runPythonCode('overflow'); assert.equal(overflow.ok, false); assert.match(overflow.stderr, /Output limit/); assert.ok(overflow.stdout.length <= 32768);
  nextMode = 'load-error'; const loadError = await context.runPythonCode('normal'); assert.equal(loadError.ok, false); assert.match(loadError.stderr, /download failure/);
  nextMode = 'load-stall'; const controller = new AbortController(); const loading = context.runPythonCode('normal', { signal: controller.signal }); controller.abort();
  const stopped = await loading; assert.equal(stopped.reason, 'stopped'); assert.equal(workers.at(-1).terminated, true);
  const count = workers.length; const alreadyAborted = await context.runPythonCode('normal', { signal: controller.signal });
  assert.equal(alreadyAborted.reason, 'stopped'); assert.equal(workers.length, count);
  const abortAtStatus = new AbortController();
  const canceledBeforeWorker = await context.runPythonCode('normal', { signal: abortAtStatus.signal, onStatus: () => abortAtStatus.abort() });
  assert.equal(canceledBeforeWorker.reason, 'stopped'); assert.equal(workers.length, count, 'Synchronous cancellation cannot leave an orphan worker');
  nextMode = 'load-stall'; const stalled = await context.runPythonCode('normal'); assert.equal(stalled.reason, 'load-timeout'); assert.equal(workers.at(-1).terminated, true);
  const unavailablePackage = await context.runPythonCode('normal', { packages: ['missing'] }); assert.equal(unavailablePackage.ok, false);
  const savingPaused = context.runPythonCode('spin'); events.get('study-storage-paused')(); assert.equal((await savingPaused).reason, 'stopped');
  const pageClosed = context.runPythonCode('spin'); events.get('pagehide')(); assert.equal((await pageClosed).reason, 'stopped');
  const noWorker = vm.createContext({ window: { addEventListener() {} } }); vm.runInContext(runtime, noWorker);
  assert.equal((await noWorker.runPythonCode('normal')).reason, 'unsupported');
  assert.ok(workers.every(worker => worker.terminated)); await Promise.all(workers.map(worker => worker.exited));
  console.log('Worker contract: blocked-loop termination, responsive main thread, streaming/newlines, output cap, clean retry, fresh globals, load/package failure, abort, page exit and save-pause cancellation passed. Real browser/Pyodide verification remains pending.');
})().catch(async error => { workers.forEach(worker => worker.terminate()); console.error(error); process.exitCode = 1; });
