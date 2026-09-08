/* Pinned Pyodide runtime. This worker receives exactly one run, then is destroyed. */
'use strict';
const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
let received = false;
self.onmessage = async event => {
  if (received) return;
  received = true;
  const { id, code, packages, globals } = event.data;
  let stdout = '', stderr = '', sinceOutput = 0, namespace;
  const send = data => self.postMessage({ id, ...data });
  const output = () => { send({ type: 'output', stdout, stderr }); sinceOutput = 0; };
  const write = stream => line => {
    const text = String(line) + '\n';
    if (stdout.length + stderr.length + text.length > 32768) throw new Error('Output limit reached. Print a smaller sample and try again.');
    if (stream === 'stdout') stdout += text; else stderr += text;
    sinceOutput += text.length;
    if (sinceOutput >= 4096 || stdout.length + stderr.length === text.length) output();
  };
  try {
    importScripts(PYODIDE_CDN + 'pyodide.js');
    send({ type: 'status', text: 'Initializing Python…' });
    const pyodide = await loadPyodide({ indexURL: PYODIDE_CDN });
    if (packages.length) {
      send({ type: 'status', text: 'Loading exercise packages…' });
      await pyodide.loadPackage(packages);
    }
    pyodide.setStdout({ batched: write('stdout') });
    pyodide.setStderr({ batched: write('stderr') });
    namespace = pyodide.toPy({ ...globals, __name__: '__main__' });
    send({ type: 'running' });
    const result = await pyodide.runPythonAsync(code, { globals: namespace });
    result?.destroy?.();
    output(); send({ type: 'result', ok: true, stdout, stderr });
  } catch (error) {
    const detail = String(error.message || error).slice(0, 12000);
    stderr = (stderr + (stderr ? '\n' : '') + detail).slice(0, 32768);
    send({ type: 'result', ok: false, reason: 'execution', stdout, stderr });
  } finally { namespace?.destroy?.(); }
};
