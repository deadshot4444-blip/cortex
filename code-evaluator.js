/* NeuroCode: bounded Python checks. Reflection is explicitly self-reviewed. */
const _solutionOutCache = new Map();
function neuroCodeGuidance(lesson) {
  return {
    codingGoal: lesson.codingConcept || 'Complete the authored exercise',
    neuroengineeringGoal: lesson.neuroengineeringConcept || 'Interpret a synthetic example',
    exerciseType: lesson.checks ? 'Function practice' : 'Example practice',
    expectedOutput: lesson.expectedOutput,
    successExplanation: lesson.checks
      ? 'The submitted function passed the listed input cases. This is exercise evidence, not a general proficiency score.'
      : 'Only the example output was compared; this does not establish correctness on other inputs.',
    retryExplanation: 'Read the prompt and failed case, edit the function, then check again.',
  };
}
function neuroCodeIsRunnablePython(code) {
  return /print\s*\(|def\s+\w|for\s+\w|if\s+.+:|=\s*[[\-0-9"']|import\s+\w/.test(String(code || '').trim());
}
function neuroCodeNormalizeOutput(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}
function neuroCodeOutputsMatch(actual, expected) {
  const a = neuroCodeNormalizeOutput(actual),
    e = neuroCodeNormalizeOutput(expected);
  return !!e && a === e;
}
function neuroCodeCheckScript(code, lesson, marker) {
  const spec = JSON.stringify(lesson.checks);
  return `
def _cortex_check():
    import json, math, copy, io, contextlib
    spec = json.loads(${JSON.stringify(spec)})
    scope = {'__name__': '__cortex_exercise__'}
    class LimitedOutput(io.StringIO):
        def write(self, value):
            if self.tell() + len(value) > 16000:
                raise ValueError('Output limit reached; print a smaller sample')
            return super().write(value)
    output = LimitedOutput()
    with contextlib.redirect_stdout(output):
        exec(${JSON.stringify(code)}, scope)
    function = scope.get(spec['function'])
    if not callable(function):
        raise ValueError('Define the function ' + spec['function'])
    def equal(actual, expected):
        if isinstance(expected, bool):
            return isinstance(actual, bool) and actual == expected
        if isinstance(expected, (int, float)):
            return isinstance(actual, (int, float)) and not isinstance(actual, bool) and math.isclose(actual, expected, rel_tol=1e-7, abs_tol=1e-9)
        if isinstance(expected, list):
            return isinstance(actual, list) and len(actual) == len(expected) and all(equal(a, e) for a, e in zip(actual, expected))
        if isinstance(expected, dict):
            return isinstance(actual, dict) and actual.keys() == expected.keys() and all(equal(actual[k], expected[k]) for k in expected)
        return type(actual) == type(expected) and actual == expected
    def clip(value):
        return value if len(value) <= 2000 else value[:2000] + '… (truncated; full length ' + str(len(value)) + ' characters)'
    results = []
    for index, case in enumerate(spec['cases']):
        args = copy.deepcopy(case['args'])
        expected_label = case.get('raises') or repr(case['expected'])
        try:
            with contextlib.redirect_stdout(output):
                actual = function(*args)
            unchanged = not spec.get('preserveArgs') or args == case['args']
            item = {'passed': not case.get('raises') and equal(actual, case.get('expected')) and unchanged, 'actual': clip(repr(actual)), 'expected': clip(expected_label), 'argsPreserved': unchanged}
            if spec.get('captureExampleResult') and index in spec.get('captureResultIndices', [0]):
                try:
                    encoded = json.dumps(actual, allow_nan=False)
                    if len(encoded) <= 16000:
                        item['value'] = json.loads(encoded)
                except (TypeError, ValueError, OverflowError):
                    pass
            results.append(item)
        except Exception as error:
            unchanged = not spec.get('preserveArgs') or args == case['args']
            results.append({'passed': case.get('raises') == type(error).__name__ and unchanged, 'actual': clip(type(error).__name__ + ': ' + str(error)), 'expected': clip(expected_label), 'argsPreserved': unchanged})
    print(${JSON.stringify(marker)} + json.dumps({'cases': results, 'stdout': output.getvalue()}))
_cortex_check()
`;
}
async function neuroCodeEvaluateOJT(code, lesson, onStatus, options = {}) {
  const draft = String(code || '').trim(),
    guidance = neuroCodeGuidance(lesson);
  if (!draft)
    return { passed: false, message: 'Write a response before checking.', explanation: guidance.retryExplanation };
  if (!lesson.checks && !neuroCodeIsRunnablePython(lesson.solution))
    return {
      passed: false,
      mode: 'self-review',
      needsSelfReview: true,
      message: 'Compare your explanation with the authored model.',
      explanation: 'Written explanations are saved without automatic grading.',
      model: lesson.solution,
    };
  if (lesson.checks) {
    const marker = `CORTEX_CHECK_${Date.now()}_${Math.random().toString(36).slice(2)}:`;
    const run = await runPythonCode(neuroCodeCheckScript(draft, lesson, marker), { ...options, onStatus });
    const line = run.stdout?.split('\n').find(line => line.startsWith(marker));
    let result;
    try {
      if (line) result = JSON.parse(line.slice(marker.length));
    } catch {}
    if (!run.ok || !result || !Array.isArray(result.cases) || result.cases.length !== lesson.checks.cases.length) {
      const message =
        run.reason === 'stopped'
          ? 'Check stopped. No pass assigned.'
          : ['runtime', 'load-timeout', 'unsupported'].includes(run.reason)
            ? 'Python is unavailable. Retry the check or download your code to run it elsewhere. No pass assigned.'
            : run.reason === 'timeout'
              ? 'Python reached the execution time limit. Check loops or reduce the workload, then retry. No pass assigned.'
              : 'The function check could not complete.';
      return {
        passed: false,
        mode: 'function',
        reason: run.reason,
        stdout: run.stdout,
        stderr: run.stderr,
        message,
        explanation: guidance.retryExplanation,
      };
    }
    const passed = result.cases.every(item => item.passed === true),
      count = result.cases.filter(item => item.passed).length;
    return {
      passed,
      mode: 'function',
      cases: result.cases,
      stdout: result.stdout,
      stderr: run.stderr,
      message: `${count}/${result.cases.length} input cases passed.`,
      explanation: passed ? guidance.successExplanation : guidance.retryExplanation,
    };
  }
  const key = lesson.id + ':' + lesson.solution;
  let reference = _solutionOutCache.get(key);
  if (!reference) {
    reference = await runPythonCode(lesson.solution.trim(), { ...options, onStatus });
    if (reference.ok) _solutionOutCache.set(key, reference);
  }
  if (!reference.ok)
    return {
      passed: false,
      mode: 'example',
      message: 'The reference example could not run. Retry when Python is available.',
      stderr: reference.stderr,
    };
  const run = await runPythonCode(draft, { ...options, onStatus });
  const passed = run.ok && neuroCodeOutputsMatch(run.stdout, reference.stdout);
  return {
    passed,
    mode: 'example',
    stdout: run.stdout,
    stderr: run.stderr,
    targetOutput: reference.stdout,
    message: passed ? 'Example output matches.' : 'The example output does not match.',
    explanation: guidance.successExplanation,
  };
}
function neuroCodeEvaluate() {
  return {
    passed: false,
    output: '',
    message: 'Python execution is unavailable.',
    explanation: 'Your draft is retained. Retry the runtime to check it; no result has been assigned.',
  };
}
