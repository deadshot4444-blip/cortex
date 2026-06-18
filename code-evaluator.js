/* Cortex — NeuroCode guided sandbox evaluator (ported from CodePracticeEvaluator.swift) */

function neuroCodeGuidance(lesson) {
  return {
    codingGoal: `Use ${(lesson.codingConcept || '').toLowerCase()} to solve the exercise prompt.`,
    neuroengineeringGoal: `Connect the code to ${(lesson.neuroengineeringConcept || '').toLowerCase()} so the output means something in a toy BCI workflow.`,
    exerciseType: neuroCodeExerciseType(lesson),
    expectedOutput: lesson.expectedOutput,
    successExplanation: 'Your answer matches the expected beginner solution pattern and produces the target output for this guided exercise.',
    retryExplanation: 'Use the prompt, hint, and expected output to compare what your code says with what the BCI concept needs. This checker is simple, so matching the solution structure is the safest path.',
  };
}

function neuroCodeExerciseType(lesson) {
  const prompt = (lesson.challengePrompt || '').toLowerCase();
  if (prompt.includes('predict')) return 'Predict output';
  if (prompt.includes('threshold') || prompt.includes('tune')) return 'Tune a parameter';
  if (prompt.includes('fix') || prompt.includes('bug')) return 'Fix a bug';
  if (prompt.includes('function')) return 'Complete a function';
  if (prompt.includes('missing') || prompt.includes('fill')) return 'Fill a missing line';
  return 'Guided code check';
}

function neuroCodeNormalize(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, '');
}

function neuroCodeNormalizeLine(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed || trimmed.startsWith('#')) return '';
  return neuroCodeNormalize(trimmed);
}

function neuroCodeContainsCoreLines(input, solution) {
  const inputLines = new Set(
    String(input || '').split('\n').map(neuroCodeNormalizeLine).filter(Boolean),
  );
  const coreLines = String(solution || '').split('\n').map(neuroCodeNormalizeLine).filter(Boolean);
  if (!coreLines.length) return false;
  return coreLines.every(line => inputLines.has(line));
}

function neuroCodeEvaluate(input, lesson) {
  const guidance = neuroCodeGuidance(lesson);
  const normalizedInput = neuroCodeNormalize(input);
  const normalizedSolution = neuroCodeNormalize(lesson.solution);

  const passed = normalizedInput.length > 0 && (
    normalizedInput === normalizedSolution ||
    normalizedInput.includes(normalizedSolution) ||
    neuroCodeContainsCoreLines(input, lesson.solution)
  );

  if (passed) {
    return {
      passed: true,
      output: lesson.expectedOutput,
      message: 'Check passed. The sandbox matched the expected beginner exercise output.',
      explanation: guidance.successExplanation,
    };
  }

  return {
    passed: false,
    output: 'No matching expected output yet.',
    message: 'Keep going. Compare your variable names, loop/function structure, and final print/output with the lesson goal.',
    explanation: guidance.retryExplanation,
  };
}