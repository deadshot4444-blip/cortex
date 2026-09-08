/* Each Python run owns a worker; stopping it also discards its interpreter. */
const PYTHON_TIMEOUT_MS = 10000;
const PYTHON_LOAD_TIMEOUT_MS = 45000;
let pythonActiveRun = null;
let pythonRunId = 0;

function stopPythonCode(message = 'Python stopped. Your editor draft is retained.') {
  pythonActiveRun?.finish({ ok: false, reason: 'stopped', stderr: message });
}

function runPythonCode(code, opts = {}) {
  const failure = (reason, stderr) => Promise.resolve({ ok: false, reason, stdout: '', stderr });
  if (opts.signal?.aborted) return failure('stopped', 'Python stopped before execution.');
  if (typeof Worker === 'undefined')
    return failure(
      'unsupported',
      'This browser cannot run the Python worker. Use the authored trace activity or export your code for another environment.'
    );
  if (pythonActiveRun) return failure('busy', 'Another Python run is active. Stop it or wait for its result.');
  return new Promise(resolve => {
    const id = ++pythonRunId;
    let worker,
      timer,
      finished = false,
      running = false,
      stdout = '',
      stderr = '';
    const abort = () =>
      job.finish({ ok: false, reason: 'stopped', stderr: 'Python stopped. Your editor draft is retained.' });
    const job = {
      finish(result) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        opts.signal?.removeEventListener('abort', abort);
        worker?.terminate();
        if (pythonActiveRun === job) pythonActiveRun = null;
        resolve({ stdout, stderr, ...result });
      },
    };
    pythonActiveRun = job;
    opts.signal?.addEventListener('abort', abort, { once: true });
    const startTimer = (milliseconds, reason, message) => {
      clearTimeout(timer);
      timer = setTimeout(() => job.finish({ ok: false, reason, stderr: message }), milliseconds);
    };
    try {
      opts.onStatus?.('Loading Python in a separate worker…');
      if (finished) return;
      worker = new Worker('python-runtime-worker.js?v=2');
      startTimer(
        PYTHON_LOAD_TIMEOUT_MS,
        'load-timeout',
        'Python or its packages did not load within 45 seconds. Your draft is retained; retry when the connection is available.'
      );
      worker.onerror = event => {
        event.preventDefault?.();
        job.finish({ ok: false, reason: 'runtime', stderr: event.message || 'The Python worker could not load.' });
      };
      worker.onmessageerror = () =>
        job.finish({ ok: false, reason: 'runtime', stderr: 'The Python worker returned an unreadable result.' });
      worker.onmessage = event => {
        const message = event.data;
        if (finished || !message || message.id !== id) return;
        if (message.type === 'running' && !running) {
          running = true;
          opts.onStatus?.('Running Python. Stop is available.');
          if (finished) return;
          startTimer(
            PYTHON_TIMEOUT_MS,
            'timeout',
            'Python stopped after 10 seconds of execution. Check loops or reduce the workload, then retry.'
          );
        } else if (message.type === 'status') opts.onStatus?.(String(message.text));
        else if (message.type === 'output') {
          stdout = String(message.stdout || '').slice(0, 32768);
          stderr = String(message.stderr || '').slice(0, 32768);
          opts.onOutput?.({ stdout, stderr });
        } else if (message.type === 'result' && typeof message.ok === 'boolean') {
          job.finish({
            ok: message.ok,
            reason: message.reason,
            stdout: String(message.stdout || '').slice(0, 32768),
            stderr: String(message.stderr || '').slice(0, 32768),
          });
        }
      };
      worker.postMessage({ id, code: String(code || ''), packages: opts.packages || [], globals: opts.globals || {} });
    } catch (error) {
      job.finish({ ok: false, reason: 'runtime', stderr: error.message || String(error) });
    }
  });
}
window.addEventListener?.('pagehide', () => stopPythonCode());
window.addEventListener?.('study-storage-paused', () =>
  stopPythonCode('Python stopped while study saving is paused. Your draft is retained.')
);
