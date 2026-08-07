/* Cortex — Practitioner Track milestone labs */

const M1_STARTER = `threshold_mv = -50
spike_count = 0
events = []

for i, sample in enumerate(RECORDING):
    if sample >= threshold_mv:
        spike_count += 1
        events.append((i, sample))

print("spikes:", spike_count)
for idx, amp in events:
    print("event", idx, ":", amp, "mV")
`;

const M2_STARTER = `# Adaptive spike detection — starter
# RECORDING (uV) is injected. Baseline drifts, so a fixed threshold fails here.

n = len(RECORDING)
mean = sum(RECORDING) / n
var = sum((s - mean) ** 2 for s in RECORDING) / n
std = var ** 0.5
threshold = mean - 3.5 * std
print("threshold:", round(threshold, 2), "uV")

# TODO this counts every sample below threshold as its own spike — a real
# spike is 1-3 consecutive samples. Group each below-threshold RUN into ONE
# spike, then report its trough index, trough amplitude, and width.
spike_count = 0
for i, s in enumerate(RECORDING):
    if s < threshold:
        spike_count += 1
        print("spike", i, ": amp", s, "uV width 1")
print("spikes:", spike_count)
`;

const M2_SUMMARY_TEMPLATE = `Project: Spike Detector + Feature Vector
Phase: Detection & Features
Unlock: Unit 12
Units: 8-12
Skills: adaptive thresholding (mean - 3.5*std), event grouping, per-spike feature extraction (trough index, amplitude, width)
Output: printed threshold + per-spike feature table
Mastery: Units 8-12 + detector that groups crossings into discrete events.
(Cortex Neuroengineering – Educational only)`;

function neuroMilestonePassed(id) {
  return !!(NEURO_PROG.milestones && NEURO_PROG.milestones[id]?.passed);
}

function neuroMilestoneUnlocked(ms, pg) {
  if (ms.status === 'planned') return false;
  return pg.done >= ms.unlockUnit;
}

const M1_SUMMARY_TEMPLATE = `Project: Neural Signal Viewer
Phase: Signal Acquisition
Unlock: Unit 7
Units: 1-7
Skills: time-series, thresholding, basic event detection
Output: plotted trace + table of detected events
Mastery: Units 1-7 + working viewer on noisy data.
(Cortex Neuroengineering – Educational only)`;

function drawNeuroWaveform(canvas, samples, events, threshold) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const pad = 16;
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const range = max - min || 1;

  ctx.fillStyle = '#050506';
  ctx.fillRect(0, 0, w, h);

  const yFor = (v) => pad + (h - pad * 2) * (1 - (v - min) / range);
  const xFor = (i) => pad + (w - pad * 2) * (i / Math.max(samples.length - 1, 1));

  if (threshold != null) {
    const ty = yFor(threshold);
    ctx.strokeStyle = '#c4a24a';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad, ty);
    ctx.lineTo(w - pad, ty);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  samples.forEach((v, i) => {
    const x = xFor(i);
    const y = yFor(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const eventSet = new Set((events || []).map(e => e.idx));
  samples.forEach((v, i) => {
    if (!eventSet.has(i)) return;
    ctx.fillStyle = '#1a7f37';
    ctx.beginPath();
    ctx.arc(xFor(i), yFor(v), 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function parseM1Stdout(stdout) {
  const lines = String(stdout || '').trim().split('\n').map(l => l.trim()).filter(Boolean);
  let spikeCount = null;
  const events = [];
  for (const line of lines) {
    const m1 = line.match(/^spikes:\s*(\d+)/i);
    if (m1) spikeCount = Number(m1[1]);
    const m2 = line.match(/^event\s+(\d+)\s*:\s*(-?\d+(?:\.\d+)?)\s*mV/i);
    if (m2) events.push({ idx: Number(m2[1]), amp: Number(m2[2]) });
  }
  return { spikeCount, events };
}

function gradeM1Lab(stdout, recording) {
  const ref = recording.reference;
  const parsed = parseM1Stdout(stdout);
  const issues = [];

  if (parsed.spikeCount !== ref.spikeCount) {
    issues.push(`Spike count should be ${ref.spikeCount}, got ${parsed.spikeCount ?? 'none'}.`);
  }
  if (parsed.events.length !== ref.events.length) {
    issues.push(`Expected ${ref.events.length} event lines, got ${parsed.events.length}.`);
  } else {
    ref.events.forEach((ev, i) => {
      const got = parsed.events[i];
      if (!got || got.idx !== ev.idx || Math.abs(got.amp - ev.amp) > 0.01) {
        issues.push(`Event ${i + 1} should be index ${ev.idx} at ${ev.amp} mV.`);
      }
    });
  }

  return {
    passed: issues.length === 0,
    issues,
    parsed,
  };
}

async function loadM1Recording() {
  const r = await fetch('data/labs/m1-recording.json');
  return r.ok ? r.json() : null;
}

function parseM2Stdout(stdout) {
  const lines = String(stdout || '').trim().split('\n').map(l => l.trim()).filter(Boolean);
  let threshold = null;
  let spikeCount = null;
  const events = [];
  for (const line of lines) {
    const mt = line.match(/^threshold:\s*(-?\d+(?:\.\d+)?)\s*uV/i);
    if (mt) threshold = Number(mt[1]);
    const mc = line.match(/^spikes:\s*(\d+)/i);
    if (mc) spikeCount = Number(mc[1]);
    const me = line.match(/^spike\s+(\d+)\s*:\s*amp\s*(-?\d+(?:\.\d+)?)\s*uV\s*width\s*(\d+)/i);
    if (me) events.push({ idx: Number(me[1]), amp: Number(me[2]), width: Number(me[3]) });
  }
  return { threshold, spikeCount, events };
}

function gradeM2Lab(stdout, recording) {
  const ref = recording.reference;
  const parsed = parseM2Stdout(stdout);
  const issues = [];

  if (parsed.threshold == null || Math.abs(parsed.threshold - ref.thresholdUv) > 0.01) {
    issues.push(`Threshold should print as ${ref.thresholdUv} uV (mean - 3.5 * population std), got ${parsed.threshold ?? 'none'}.`);
  }
  if (parsed.spikeCount !== ref.spikeCount) {
    issues.push(`Spike count should be ${ref.spikeCount} (group each below-threshold run into one spike), got ${parsed.spikeCount ?? 'none'}.`);
  }
  if (parsed.events.length !== ref.events.length) {
    issues.push(`Expected ${ref.events.length} spike lines, got ${parsed.events.length}.`);
  } else {
    ref.events.forEach((ev, i) => {
      const got = parsed.events[i];
      if (!got || got.idx !== ev.idx || Math.abs(got.amp - ev.amp) > 0.01 || got.width !== ev.width) {
        issues.push(`Spike ${i + 1} should be index ${ev.idx}, amp ${ev.amp} uV, width ${ev.width}.`);
      }
    });
  }

  return { passed: issues.length === 0, issues, parsed };
}

async function loadM2Recording() {
  const r = await fetch('data/labs/m2-recording.json');
  return r.ok ? r.json() : null;
}

async function renderNeuroMilestone(milestoneId) {
  await loadNeuro();
  const ms = NEURO.milestones?.milestones?.find(m => m.id === milestoneId);
  const pg = pathProgress();
  if (!ms || !neuroMilestoneUnlocked(ms, pg)) {
    renderNeuroEngineering();
    return;
  }

  if (milestoneId === 'neural-signal-viewer') {
    await renderM1SignalViewer(ms);
    return;
  }
  if (milestoneId === 'spike-detector') {
    await renderM2SpikeDetector(ms);
    return;
  }
  renderNeuroEngineering();
}

async function renderM2SpikeDetector(ms) {
  const recording = await loadM2Recording();
  if (!recording) { renderNeuroEngineering(); return; }

  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const passed = neuroMilestonePassed(ms.id);

  const main = el(`<main class="neuro-page neuro-inner">
    <section class="neuro-body">
      <button class="backbtn topback" id="neback">&larr; Neuroengineering</button>
      <span class="neuro-eyebrow">Practitioner Track &middot; Milestone 2</span>
      <h1 class="neuro-h1">Spike Detector + Feature Vector</h1>
      <p class="neuro-lede">The recording drifts, so the fixed threshold from Milestone 1 fails here. Compute an adaptive threshold from the signal's own statistics, group crossings into discrete spikes, and report a feature vector per spike.</p>
      <div class="neuro-ojt-brief">
        <span class="label">Acceptance criteria</span>
        <ul class="neuro-criteria">
          <li>Threshold = mean &minus; 3.5 &times; population std of <code>RECORDING</code>; print <code>threshold: X.XX uV</code> (2 dp)</li>
          <li>Group each run of consecutive below-threshold samples into ONE spike</li>
          <li>Per spike print <code>spike IDX : amp A uV width W</code> &mdash; trough index, trough amplitude, run length</li>
          <li>Print <code>spikes: N</code> matching the reference</li>
        </ul>
      </div>
      <div class="neuro-lab-viz">
        <span class="label">Recording preview &middot; ${recording.sampleRateHz} Hz &middot; ${recording.samples.length} samples &middot; adaptive threshold dashed</span>
        <canvas class="neuro-wave" id="m2wave" width="900" height="200"></canvas>
      </div>
      <textarea class="neuro-code-draft" id="m2code" rows="18" spellcheck="false">${esc(M2_STARTER)}</textarea>
      <div class="neuro-terminal neuro-ojt-terminal">
        <div class="neuro-terminal-bar">
          <span class="neuro-terminal-dot"></span>
          <span class="neuro-terminal-title">bci-lab@cortex &mdash; milestone_2.py</span>
          <span class="neuro-terminal-status" id="m2status">Python idle</span>
        </div>
        <div class="neuro-terminal-log" id="m2log"></div>
        <p class="neuro-terminal-msg" id="m2msg">Run the starter first &mdash; watch it overcount. Then make it group runs.</p>
      </div>
      <div class="neuro-sandbox-actions">
        <button class="btn btn-solid neuro-btn" id="m2run">Run</button>
        <button class="btn neuro-btn" id="m2submit">Submit milestone</button>
        <button class="btn neuro-btn" id="m2reset">Reset starter</button>
        <button class="btn neuro-btn" id="m2hint">Hint</button>
        <button class="btn neuro-btn" id="m2copy">Copy project summary</button>
      </div>
      <div class="neuro-sandbox-extra" id="m2extra"></div>
      ${passed ? '<p class="neuro-terminal-msg ok">Milestone 2 complete — saved to your progress.</p>' : ''}
    </section>
  </main>`);

  main.querySelector('#neback').addEventListener('click', renderNeuroEngineering);
  const canvas = main.querySelector('#m2wave');
  const code = main.querySelector('#m2code');
  const log = main.querySelector('#m2log');
  const msg = main.querySelector('#m2msg');
  const status = main.querySelector('#m2status');

  const paintWave = () => {
    const w = Math.min(canvas.parentElement?.clientWidth || 900, 900);
    canvas.width = w;
    canvas.height = 200;
    drawNeuroWaveform(canvas, recording.samples, recording.reference.events, recording.reference.thresholdUv);
  };
  paintWave();
  window.addEventListener('resize', paintWave);
  main._m2Resize = paintWave;

  const appendLog = (cls, text) => {
    const line = el(`<div class="neuro-term-line ${cls}"></div>`);
    line.textContent = text;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  };

  const runLab = async (submit) => {
    status.textContent = submit ? 'Grading…' : 'Running…';
    msg.textContent = submit ? 'Submitting against reference…' : 'Executing Python…';
    try {
      const pyodide = await ensurePythonRuntime((s) => { status.textContent = s; });
      const result = await runPythonCode(code.value, {
        globals: { RECORDING: recording.samples },
        onStatus: (s) => { status.textContent = s; },
      });
      appendLog('cmd', `$ python milestone_2.py${submit ? '  # submit' : ''}`);
      if (result.stdout) appendLog('out', result.stdout.trimEnd());
      if (result.stderr) appendLog('err', result.stderr.trimEnd());
      if (!result.ok) {
        msg.textContent = 'Execution failed — fix errors before submitting.';
        msg.classList.add('bad');
        status.textContent = 'Error';
        return;
      }
      if (!submit) {
        msg.textContent = 'Run complete. Submit when the spike table groups each event once.';
        msg.classList.remove('bad');
        status.textContent = 'Python ready';
        return;
      }
      const grade = gradeM2Lab(result.stdout, recording);
      if (grade.passed) {
        if (!NEURO_PROG.milestones) NEURO_PROG.milestones = {};
        NEURO_PROG.milestones[ms.id] = { passed: true, ts: Date.now() };
        saveNeuroProg();
        msg.textContent = 'Milestone 2 passed — feature table matches reference.';
        msg.classList.add('ok');
        status.textContent = 'Passed';
      } else {
        msg.textContent = grade.issues[0] || 'Output mismatch.';
        msg.classList.add('bad');
        status.textContent = 'Failed';
        grade.issues.forEach(i => appendLog('muted', `# ${i}`));
      }
    } catch (e) {
      appendLog('err', e?.message || String(e));
      msg.textContent = 'Runtime error.';
      msg.classList.add('bad');
    }
  };

  main.querySelector('#m2run').addEventListener('click', () => runLab(false));
  main.querySelector('#m2submit').addEventListener('click', () => runLab(true));
  main.querySelector('#m2reset').addEventListener('click', () => {
    code.value = M2_STARTER;
    appendLog('muted', '# reset to starter');
  });
  main.querySelector('#m2hint').addEventListener('click', (e) => {
    e.target.disabled = true;
    main.querySelector('#m2extra').appendChild(el(`<div class="sochint"><span class="label">Hint</span><p>Walk the recording with an index. When a sample drops below <code>threshold</code>, keep advancing while samples stay below it &mdash; that whole run is <em>one</em> spike. Its <b>width</b> is the run length, its <b>amp</b> is the minimum value in the run, its <b>index</b> is where that minimum sits. Print the spike lines as you find them, then <code>spikes: N</code> last.</p></div>`));
  });
  main.querySelector('#m2copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(M2_SUMMARY_TEMPLATE);
      appendLog('muted', '# project summary copied');
    } catch {}
  });

  root.appendChild(main);
  setView(root);
}

async function renderM1SignalViewer(ms) {
  const recording = await loadM1Recording();
  if (!recording) { renderNeuroEngineering(); return; }

  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const passed = neuroMilestonePassed(ms.id);

  const main = el(`<main class="neuro-page neuro-inner">
    <section class="neuro-body">
      <button class="backbtn topback" id="neback">&larr; Neuroengineering</button>
      <span class="neuro-eyebrow">Practitioner Track &middot; Milestone 1</span>
      <h1 class="neuro-h1">Neural Signal Viewer</h1>
      <p class="neuro-lede">OJT lab: load a real recording snippet, detect threshold crossings, print an event table. This is the first build employers want to see.</p>
      <div class="neuro-ojt-brief">
        <span class="label">Acceptance criteria</span>
        <ul class="neuro-criteria">
          <li>Scan <code>RECORDING</code> (injected, mV) with <code>threshold_mv = -50</code></li>
          <li>Print <code>spikes: N</code> where N matches the reference</li>
          <li>Print one line per event: <code>event INDEX : AMP mV</code></li>
        </ul>
      </div>
      <div class="neuro-lab-viz">
        <span class="label">Recording preview &middot; ${recording.sampleRateHz} Hz &middot; ${recording.samples.length} samples</span>
        <canvas class="neuro-wave" id="m1wave" width="900" height="200"></canvas>
      </div>
      <textarea class="neuro-code-draft" id="m1code" rows="14" spellcheck="false">${esc(M1_STARTER)}</textarea>
      <div class="neuro-terminal neuro-ojt-terminal">
        <div class="neuro-terminal-bar">
          <span class="neuro-terminal-dot"></span>
          <span class="neuro-terminal-title">bci-lab@cortex &mdash; milestone_1.py</span>
          <span class="neuro-terminal-status" id="m1status">Python idle</span>
        </div>
        <div class="neuro-terminal-log" id="m1log"></div>
        <p class="neuro-terminal-msg" id="m1msg">Run to execute. Submit grades against the reference recording.</p>
      </div>
      <div class="neuro-sandbox-actions">
        <button class="btn btn-solid neuro-btn" id="m1run">Run</button>
        <button class="btn neuro-btn" id="m1submit">Submit milestone</button>
        <button class="btn neuro-btn" id="m1reset">Reset starter</button>
        <button class="btn neuro-btn" id="m1hint">Hint</button>
        <button class="btn neuro-btn" id="m1copy">Copy project summary</button>
      </div>
      <div class="neuro-sandbox-extra" id="m1extra"></div>
      ${passed ? '<p class="neuro-terminal-msg ok">Milestone 1 complete — saved to your progress.</p>' : ''}
    </section>
  </main>`);

  main.querySelector('#neback').addEventListener('click', renderNeuroEngineering);
  const canvas = main.querySelector('#m1wave');
  const code = main.querySelector('#m1code');
  const log = main.querySelector('#m1log');
  const msg = main.querySelector('#m1msg');
  const status = main.querySelector('#m1status');

  const paintWave = () => {
    const w = Math.min(canvas.parentElement?.clientWidth || 900, 900);
    canvas.width = w;
    canvas.height = 200;
    drawNeuroWaveform(canvas, recording.samples, recording.reference.events, recording.reference.thresholdMv);
  };
  paintWave();
  window.addEventListener('resize', paintWave);
  main._m1Resize = paintWave;

  const appendLog = (cls, text) => {
    const line = el(`<div class="neuro-term-line ${cls}"></div>`);
    line.textContent = text;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  };

  const runLab = async (submit) => {
    status.textContent = submit ? 'Grading…' : 'Running…';
    msg.textContent = submit ? 'Submitting against reference…' : 'Executing Python…';
    try {
      const pyodide = await ensurePythonRuntime((s) => { status.textContent = s; });
      const result = await runPythonCode(code.value, {
        globals: { RECORDING: recording.samples },
        onStatus: (s) => { status.textContent = s; },
      });
      appendLog('cmd', `$ python milestone_1.py${submit ? '  # submit' : ''}`);
      if (result.stdout) appendLog('out', result.stdout.trimEnd());
      if (result.stderr) appendLog('err', result.stderr.trimEnd());
      if (!result.ok) {
        msg.textContent = 'Execution failed — fix errors before submitting.';
        msg.classList.add('bad');
        status.textContent = 'Error';
        return;
      }
      if (!submit) {
        msg.textContent = 'Run complete. Submit when output looks right.';
        msg.classList.remove('bad');
        status.textContent = 'Python ready';
        return;
      }
      const grade = gradeM1Lab(result.stdout, recording);
      if (grade.passed) {
        if (!NEURO_PROG.milestones) NEURO_PROG.milestones = {};
        NEURO_PROG.milestones[ms.id] = { passed: true, ts: Date.now() };
        saveNeuroProg();
        msg.textContent = 'Milestone 1 passed — event table matches reference.';
        msg.classList.add('ok');
        status.textContent = 'Passed';
      } else {
        msg.textContent = grade.issues[0] || 'Output mismatch.';
        msg.classList.add('bad');
        status.textContent = 'Failed';
        grade.issues.forEach(i => appendLog('muted', `# ${i}`));
      }
    } catch (e) {
      appendLog('err', e?.message || String(e));
      msg.textContent = 'Runtime error.';
      msg.classList.add('bad');
    }
  };

  main.querySelector('#m1run').addEventListener('click', () => runLab(false));
  main.querySelector('#m1submit').addEventListener('click', () => runLab(true));
  main.querySelector('#m1reset').addEventListener('click', () => {
    code.value = M1_STARTER;
    appendLog('muted', '# reset to starter');
  });
  main.querySelector('#m1hint').addEventListener('click', (e) => {
    e.target.disabled = true;
    main.querySelector('#m1extra').appendChild(el(`<div class="sochint"><span class="label">Hint</span><p>Spikes are samples <em>above</em> the threshold (less negative than &minus;50 mV). Loop every index, compare with <code>threshold_mv</code>, append matches to a list, then print count and one line per event.</p></div>`));
  });
  main.querySelector('#m1copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(M1_SUMMARY_TEMPLATE);
      appendLog('muted', '# project summary copied');
    } catch {}
  });

  root.appendChild(main);
  setView(root);
}