/* Cortex — NeuroCode OJT evaluator (real Python + reflection fallback) */

const _solutionOutCache = {};

function neuroCodeGuidance(lesson) {
  return {
    codingGoal: `Use ${(lesson.codingConcept || '').toLowerCase()} to solve the exercise prompt.`,
    neuroengineeringGoal: `Connect the code to ${(lesson.neuroengineeringConcept || '').toLowerCase()} so the output means something in a toy BCI workflow.`,
    exerciseType: neuroCodeExerciseType(lesson),
    expectedOutput: lesson.expectedOutput,
    successExplanation: 'Your code ran and produced the target output for this OJT exercise.',
    retryExplanation: 'Run your draft first, read stdout/stderr, then adjust until Check passes.',
  };
}

function neuroCodeExerciseType(lesson) {
  const prompt = (lesson.challengePrompt || '').toLowerCase();
  if (prompt.includes('predict')) return 'Predict output';
  if (prompt.includes('threshold') || prompt.includes('tune')) return 'Tune a parameter';
  if (prompt.includes('fix') || prompt.includes('bug')) return 'Fix a bug';
  if (prompt.includes('function')) return 'Complete a function';
  if (prompt.includes('missing') || prompt.includes('fill')) return 'Fill a missing line';
  if (prompt.includes('explain') || prompt.includes('describe')) return 'Explain & verify';
  return 'OJT code task';
}

function neuroCodeIsRunnablePython(code) {
  const c = String(code || '').trim();
  if (!c) return false;
  return /print\s*\(|def\s+\w|for\s+\w|if\s+.+:|=\s*[\[\-0-9"']|import\s+\w/.test(c);
}

function neuroCodeNormalizeOutput(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .join('\n');
}

function neuroCodeParseLineValue(line) {
  const m = line.match(/^(.+?):\s*(.+)$/);
  if (!m) return { key: null, raw: line.trim() };
  return { key: m[1].trim().toLowerCase(), raw: m[2].trim() };
}

function neuroCodeValuesEqual(a, b) {
  if (a === b) return true;
  const na = Number(a), nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return Math.abs(na - nb) < 0.02;
  return neuroCodeNormalizeOutput(a).toLowerCase() === neuroCodeNormalizeOutput(b).toLowerCase();
}

function neuroCodeOutputsMatch(actual, expected) {
  const a = neuroCodeNormalizeOutput(actual);
  const e = neuroCodeNormalizeOutput(expected);
  if (!e) return !!a;
  if (a === e) return true;

  const al = a.split('\n'), el = e.split('\n');
  if (al.length !== el.length) {
    if (a.includes(e) || e.includes(a)) return true;
    return false;
  }
  return al.every((line, i) => {
    const av = neuroCodeParseLineValue(line);
    const ev = neuroCodeParseLineValue(el[i]);
    if (av.key && ev.key && av.key === ev.key) return neuroCodeValuesEqual(av.raw, ev.raw);
    return neuroCodeValuesEqual(line, el[i]);
  });
}

function neuroCodeReflectionMatch(code, solution) {
  const draft = neuroCodeNormalizeOutput(code).toLowerCase();
  const target = neuroCodeNormalizeOutput(solution).toLowerCase();
  if (!target) return false;
  if (draft.includes(target) || target.includes(draft)) return true;
  const keywords = target.split(/\s+/).filter(w => w.length > 5);
  if (!keywords.length) return false;
  const hits = keywords.filter(w => draft.includes(w)).length;
  return hits >= Math.ceil(keywords.length * 0.45);
}

async function neuroCodeSolutionOutput(lesson, onStatus) {
  if (_solutionOutCache[lesson.id]) return _solutionOutCache[lesson.id];
  if (!neuroCodeIsRunnablePython(lesson.solution)) {
    _solutionOutCache[lesson.id] = { runnable: false, stdout: '', stderr: '' };
    return _solutionOutCache[lesson.id];
  }
  const result = await runPythonCode(lesson.solution.trim(), { onStatus });
  _solutionOutCache[lesson.id] = {
    runnable: true,
    stdout: result.stdout,
    stderr: result.stderr,
    ok: result.ok,
  };
  return _solutionOutCache[lesson.id];
}

async function neuroCodeEvaluateOJT(code, lesson, onStatus) {
  const guidance = neuroCodeGuidance(lesson);
  const trimmed = String(code || '').trim();

  if (!trimmed) {
    return {
      passed: false,
      mode: 'python',
      stdout: '',
      stderr: '',
      message: 'Write code in the editor before running.',
      explanation: guidance.retryExplanation,
    };
  }

  const solRef = await neuroCodeSolutionOutput(lesson, onStatus);

  if (!solRef.runnable) {
    const refl = neuroCodeReflectionMatch(trimmed, lesson.solution);
    if (refl) {
      return {
        passed: true,
        mode: 'reflection',
        stdout: trimmed,
        stderr: '',
        message: 'Check passed — your explanation covers the key ideas.',
        explanation: guidance.successExplanation,
      };
    }
    const run = await runPythonCode(trimmed, { onStatus });
    if (run.ok && neuroCodeOutputsMatch(run.stdout, lesson.expectedOutput)) {
      return {
        passed: true,
        mode: 'python',
        stdout: run.stdout,
        stderr: run.stderr,
        message: 'Check passed — starter output reproduced.',
        explanation: guidance.successExplanation,
      };
    }
    return {
      passed: false,
      mode: 'reflection',
      stdout: run.stdout,
      stderr: run.stderr,
      message: 'For this OJT task, print your explanation or match the challenge in code.',
      explanation: `Target ideas: ${lesson.solution.trim().slice(0, 120)}…`,
    };
  }

  const run = await runPythonCode(trimmed, { onStatus });
  const targetOut = solRef.stdout || lesson.expectedOutput || '';
  const passed = run.ok && neuroCodeOutputsMatch(run.stdout, targetOut);

  if (passed) {
    return {
      passed: true,
      mode: 'python',
      stdout: run.stdout,
      stderr: run.stderr,
      message: 'Check passed — stdout matches the reference solution.',
      explanation: guidance.successExplanation,
      targetOutput: targetOut,
    };
  }

  let message = run.ok
    ? 'Output mismatch — compare your stdout to the challenge goal.'
    : 'Python error — read stderr and fix before checking again.';
  if (!run.ok && run.stderr) message = 'Execution failed.';

  return {
    passed: false,
    mode: 'python',
    stdout: run.stdout,
    stderr: run.stderr,
    message,
    explanation: guidance.retryExplanation,
    targetOutput: targetOut,
  };
}

/* Legacy sync matcher — kept for offline fallback only */
function neuroCodeEvaluate(input, lesson) {
  const guidance = neuroCodeGuidance(lesson);
  const normalizedInput = neuroCodeNormalizeOutput(input).toLowerCase().replace(/\s+/g, '');
  const normalizedSolution = neuroCodeNormalizeOutput(lesson.solution).toLowerCase().replace(/\s+/g, '');
  const passed = normalizedInput.length > 0 && (
    normalizedInput === normalizedSolution ||
    normalizedInput.includes(normalizedSolution)
  );
  return {
    passed,
    output: passed ? lesson.expectedOutput : 'No matching expected output yet.',
    message: passed ? 'Structure match (runtime unavailable).' : 'Keep going.',
    explanation: passed ? guidance.successExplanation : guidance.retryExplanation,
  };
}