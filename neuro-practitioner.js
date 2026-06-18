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

function neuroMilestonePassed(id) {
  return !!(NEURO_PROG.milestones && NEURO_PROG.milestones[id]?.passed);
}

function neuroMilestoneUnlocked(ms, pg) {
  if (ms.status === 'building') return true;
  return pg.done >= ms.unlockUnit;
}

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
  const r = await fetch('data/labs/m1-recording.json', { cache: 'no-store' });
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
  renderNeuroEngineering();
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
      </div>
      ${passed ? '<p class="neuro-terminal-msg ok">Milestone 1 complete — saved to your progress.</p>' : ''}
    </section>
  </main>`);

  main.querySelector('#neback').addEventListener('click', renderNeuroEngineering);
  const canvas = main.querySelector('#m1wave');
  const code = main.querySelector('#m1code');
  const log = main.querySelector('#m1log');
  const msg = main.querySelector('#m1msg');
  const status = main.querySelector('#m1status');

  drawNeuroWaveform(canvas, recording.samples, recording.reference.events, recording.reference.thresholdMv);

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

  root.appendChild(main);
  setView(root);
}