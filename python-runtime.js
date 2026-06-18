/* Cortex — in-browser Python 3 (Pyodide) for NeuroCode OJT labs */

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
const PYTHON_TIMEOUT_MS = 10000;

let _pyodideReady = null;

function loadExternalScript(src) {
  if (document.querySelector(`script[src="${src}"]`)) {
    return window.loadPyodide ? Promise.resolve() : new Promise((res, rej) => {
      const t = setInterval(() => { if (window.loadPyodide) { clearInterval(t); res(); } }, 50);
      setTimeout(() => { clearInterval(t); rej(new Error('Pyodide script stalled')); }, 30000);
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function ensurePythonRuntime(onStatus) {
  if (_pyodideReady) return _pyodideReady;
  _pyodideReady = (async () => {
    onStatus?.('Loading Python 3 runtime…');
    await loadExternalScript(`${PYODIDE_CDN}pyodide.js`);
    onStatus?.('Initializing Pyodide…');
    const pyodide = await loadPyodide({ indexURL: PYODIDE_CDN });
    onStatus?.('Python lab ready.');
    return pyodide;
  })().catch(err => {
    _pyodideReady = null;
    throw err;
  });
  return _pyodideReady;
}

async function runPythonCode(code, opts = {}) {
  const pyodide = await ensurePythonRuntime(opts.onStatus);
  if (opts.packages?.length) {
    opts.onStatus?.(`Loading ${opts.packages.join(', ')}…`);
    await pyodide.loadPackage(opts.packages);
  }
  if (opts.globals) {
    for (const [key, val] of Object.entries(opts.globals)) {
      pyodide.globals.set(key, pyodide.toPy(val));
    }
  }
  let stdout = '';
  let stderr = '';
  pyodide.setStdout({ batched: (s) => { stdout += s; } });
  pyodide.setStderr({ batched: (s) => { stderr += s; } });

  const run = pyodide.runPythonAsync(code);
  const timer = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout — execution exceeded ${PYTHON_TIMEOUT_MS / 1000}s`)), PYTHON_TIMEOUT_MS);
  });

  try {
    await Promise.race([run, timer]);
    return { ok: true, stdout, stderr };
  } catch (e) {
    const msg = e?.message || String(e);
    return { ok: false, stdout, stderr: stderr ? `${stderr}\n${msg}` : msg };
  }
}