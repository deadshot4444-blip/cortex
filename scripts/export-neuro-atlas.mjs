#!/usr/bin/env node
/**
 * Export NeuroEngineering Atlas Swift seed data → cortex/data/neuro.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ATLAS_ROOT = '/Users/kevinvigil/neuroengineeringapp/NeuroEngineeringAtlas';
const OUT_PATH = path.join(__dirname, '..', 'data', 'neuro.json');

const failures = [];

function readSwift(relPath) {
  const full = path.join(ATLAS_ROOT, relPath);
  try {
    return fs.readFileSync(full, 'utf8');
  } catch (err) {
    failures.push(`Failed to read ${relPath}: ${err.message}`);
    return '';
  }
}

function stripComments(text) {
  return text.replace(/\/\/[^\n]*/g, '');
}

/** Find matching closing delimiter, respecting strings and nesting. */
function findMatching(text, openIdx, open = '(', close = ')') {
  let depth = 0;
  let i = openIdx;
  let inString = null; // '"', "'", or '`'
  let inTriple = false;

  while (i < text.length) {
    const ch = text[i];
    const next2 = text.slice(i, i + 3);

    if (inTriple) {
      if (next2 === '"""') {
        inTriple = false;
        i += 3;
        continue;
      }
      i++;
      continue;
    }

    if (inString) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === inString) {
        inString = null;
      }
      i++;
      continue;
    }

    if (next2 === '"""') {
      inTriple = true;
      i += 3;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = ch;
      i++;
      continue;
    }

    if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

function findMatchingBracket(text, openIdx) {
  return findMatching(text, openIdx, '[', ']');
}

/** Extract top-level TypeName(...) blocks from source. */
function extractBlocks(source, typeName) {
  const cleaned = stripComments(source);
  const blocks = [];
  const needle = `${typeName}(`;
  let searchFrom = 0;

  while (true) {
    const idx = cleaned.indexOf(needle, searchFrom);
    if (idx === -1) break;
    const openParen = idx + typeName.length;
    const closeParen = findMatching(cleaned, openParen);
    if (closeParen === -1) {
      failures.push(`Unbalanced parens for ${typeName} at offset ${idx}`);
      break;
    }
    blocks.push(cleaned.slice(openParen + 1, closeParen));
    searchFrom = closeParen + 1;
  }
  return blocks;
}

function skipWs(text, pos) {
  while (pos < text.length && /\s/.test(text[pos])) pos++;
  return pos;
}

function parseQuotedString(text, pos) {
  const quote = text[pos];
  if (quote !== '"' && quote !== "'") return null;
  let i = pos + 1;
  let value = '';
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\' && i + 1 < text.length) {
      const esc = text[i + 1];
      if (esc === 'n') value += '\n';
      else if (esc === 't') value += '\t';
      else if (esc === 'r') value += '\r';
      else if (esc === '\\') value += '\\';
      else if (esc === '"') value += '"';
      else if (esc === "'") value += "'";
      else value += esc;
      i += 2;
      continue;
    }
    if (ch === quote) {
      return { value, end: i + 1 };
    }
    value += ch;
    i++;
  }
  failures.push(`Unterminated string at ${pos}`);
  return { value, end: text.length };
}

function parseTripleString(text, pos) {
  if (text.slice(pos, pos + 3) !== '"""') return null;
  let i = pos + 3;
  let value = '';
  while (i < text.length) {
    if (text.slice(i, i + 3) === '"""') {
      return { value, end: i + 3 };
    }
    value += text[i];
    i++;
  }
  failures.push(`Unterminated triple string at ${pos}`);
  return { value, end: text.length };
}

function parseNumber(text, pos) {
  const m = text.slice(pos).match(/^-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const num = Number(m[0]);
  return { value: Number.isInteger(num) && !m[0].includes('.') ? parseInt(m[0], 10) : num, end: pos + m[0].length };
}

function parseEnum(text, pos) {
  if (text[pos] !== '.') return null;
  const m = text.slice(pos + 1).match(/^[\w]+/);
  if (!m) return null;
  return { value: m[0], end: pos + 1 + m[0].length };
}

function parseNil(text, pos) {
  if (text.slice(pos, pos + 3) === 'nil') {
    return { value: null, end: pos + 3 };
  }
  return null;
}

function parseIdentifier(text, pos) {
  const m = text.slice(pos).match(/^[\w]+/);
  if (!m) return null;
  return { value: m[0], end: pos + m[0].length };
}

function parseValue(text, pos) {
  pos = skipWs(text, pos);
  if (pos >= text.length) return { value: undefined, end: pos };

  const nil = parseNil(text, pos);
  if (nil) return nil;

  if (text.slice(pos, pos + 3) === '"""') {
    return parseTripleString(text, pos);
  }

  if (text[pos] === '"' || text[pos] === "'") {
    return parseQuotedString(text, pos);
  }

  if (text[pos] === '.') {
    return parseEnum(text, pos);
  }

  if (text[pos] === '[') {
    return parseArray(text, pos);
  }

  if (text[pos] === '(') {
    // tuple or grouped expression — rare in our data
    const close = findMatching(text, pos);
    const inner = text.slice(pos + 1, close);
    return { value: inner.trim(), end: close + 1 };
  }

  const num = parseNumber(text, pos);
  if (num) return num;

  // nested struct TypeName(...)
  const id = parseIdentifier(text, pos);
  if (id) {
    const after = skipWs(text, id.end);
    if (text[after] === '(') {
      const close = findMatching(text, after);
      const inner = text.slice(after + 1, close);
      const nested = parseStructByType(id.value, inner);
      return { value: nested, end: close + 1 };
    }
    // bare identifier (rare)
    return { value: id.value, end: id.end };
  }

  failures.push(`Could not parse value at pos ${pos}: ${text.slice(pos, pos + 40)}...`);
  return { value: null, end: pos + 1 };
}

function parseArray(text, pos) {
  const close = findMatchingBracket(text, pos);
  if (close === -1) {
    failures.push(`Unbalanced array at ${pos}`);
    return { value: [], end: text.length };
  }
  const inner = text.slice(pos + 1, close);
  const items = [];
  let i = 0;
  while (i < inner.length) {
    i = skipWs(inner, i);
    if (i >= inner.length) break;
    const parsed = parseValue(inner, i);
    if (parsed.value !== undefined) items.push(parsed.value);
    i = skipWs(inner, parsed.end);
    if (inner[i] === ',') i++;
  }
  return { value: items, end: close + 1 };
}

/** Parse `field: value` pairs from a struct body (not nested at top level). */
function parseFields(body) {
  const fields = {};
  let pos = 0;
  while (pos < body.length) {
    pos = skipWs(body, pos);
    if (pos >= body.length) break;

    const id = parseIdentifier(body, pos);
    if (!id) {
      pos++;
      continue;
    }
    pos = skipWs(body, id.end);
    if (body[pos] !== ':') {
      pos = id.end;
      continue;
    }
    pos = skipWs(body, pos + 1);
    const val = parseValue(body, pos);
    fields[id.value] = val.value;
    pos = skipWs(body, val.end);
    if (body[pos] === ',') pos++;
  }
  return fields;
}

function parseStructByType(typeName, body) {
  const f = parseFields(body);
  switch (typeName) {
    case 'Subject':
      return {
        id: f.id,
        name: f.name,
        summary: f.summary,
        iconName: f.iconName,
        accentHex: f.accentHex,
        topicIds: f.topicIds ?? [],
      };
    case 'Topic':
      return {
        id: f.id,
        subjectId: f.subjectId,
        title: f.title,
        explanation: f.explanation,
        clinicalRelevance: f.clinicalRelevance,
        vocabulary: f.vocabulary ?? [],
        oneLineMaster: f.oneLineMaster,
        quizQuestions: f.quizQuestions ?? [],
        miniProjectIdea: f.miniProjectIdea,
        relatedFutureLab: f.relatedFutureLab,
        socraticPrompts: f.socraticPrompts ?? [],
      };
    case 'VocabularyTerm':
      return { term: f.term, definition: f.definition };
    case 'QuizQuestion':
      return {
        id: f.id,
        prompt: f.prompt,
        choices: f.choices ?? [],
        correctIndex: f.correctIndex,
        explanation: f.explanation,
        wrongAnswerHint: f.wrongAnswerHint ?? null,
      };
    case 'SocraticPrompt':
      return { id: f.id, question: f.question, hint: f.hint, answer: f.answer };
    case 'LearningPath':
      return {
        id: f.id,
        title: f.title,
        summary: f.summary,
        steps: f.steps ?? [],
      };
    case 'LearningPathStep':
      return {
        id: f.id,
        order: f.order,
        title: f.title,
        subjectId: f.subjectId,
        topicId: f.topicId,
        neuroCodeLessonId: f.neuroCodeLessonId ?? null,
        simulationId: f.simulationId ?? null,
        primaryActionType: f.primaryActionType,
        primaryActionLabel: f.primaryActionLabel,
        checkpointPrompt: f.checkpointPrompt ?? null,
        reflectionQuestion: f.reflectionQuestion ?? null,
        estimatedFocus: f.estimatedFocus,
        stepObjective: f.stepObjective,
        explanation: f.explanation,
        oneLineMaster: f.oneLineMaster,
      };
    case 'SimulationCard':
      return {
        id: f.id,
        title: f.title,
        subjectId: f.subjectId,
        relatedTopicId: f.relatedTopicId,
        difficulty: f.difficulty,
        scenario: f.scenario,
        signalDescription: f.signalDescription,
        decisionQuestion: f.decisionQuestion,
        choices: f.choices ?? [],
        bestAnswerIndex: f.bestAnswerIndex,
        oneLineMaster: f.oneLineMaster,
        topicToReviewNext: f.topicToReviewNext,
        scoringCategories: f.scoringCategories ?? [],
      };
    case 'SimChoice':
      return { label: f.label, rationale: f.rationale };
    case 'NeuroCodeLesson':
      return {
        id: f.id,
        title: f.title,
        codingConcept: f.codingConcept,
        neuroengineeringConcept: f.neuroengineeringConcept,
        explanation: f.explanation,
        codeExample: f.codeExample,
        expectedOutput: f.expectedOutput,
        challengePrompt: f.challengePrompt,
        hint: f.hint,
        solution: f.solution,
        oneLineMaster: f.oneLineMaster,
        difficulty: f.difficulty,
        relatedSubjectId: f.relatedSubjectId,
      };
    case 'BCIUnitLessonContent':
      return {
        whyItMatters: f.whyItMatters,
        shortLesson: f.shortLesson,
        keyTerms: f.keyTerms ?? [],
        mentalModel: f.mentalModel,
        workedExample: f.workedExample,
        activeRecallPrompts: f.activeRecallPrompts ?? [],
        commonMistake: f.commonMistake,
        masteryCriteria: f.masteryCriteria,
      };
    case 'ActiveRecallPrompt':
      return { prompt: f.prompt, hint: f.hint, answer: f.answer };
    default:
      return f;
  }
}

function parseBlocks(source, typeName) {
  return extractBlocks(source, typeName).map((body) => parseStructByType(typeName, body));
}

function parseTopics() {
  const dataDir = path.join(ATLAS_ROOT, 'Data');
  const files = fs.readdirSync(dataDir).filter((f) => /^Topics_.*\.swift$/.test(f));
  const topics = [];
  for (const file of files.sort()) {
    const source = readSwift(path.join('Data', file));
    const parsed = parseBlocks(source, 'Topic');
    if (parsed.length === 0) {
      failures.push(`No topics parsed from ${file}`);
    }
    topics.push(...parsed);
  }
  return topics;
}

/** Extract unit lessons keyed 1–20 from BCIUnitLessonContent.swift */
function parseUnitLessons() {
  const source = readSwift('Support/BCIUnitLessonContent.swift');
  const cleaned = stripComments(source);
  const unitLessons = {};
  const dictMarker = 'private static let lessons: [Int: BCIUnitLessonContent] = [';
  const dictStart = cleaned.indexOf(dictMarker);
  if (dictStart === -1) {
    failures.push('Could not find lessons dictionary in BCIUnitLessonContent.swift');
    return unitLessons;
  }
  const bracketStart = dictStart + dictMarker.length - 1; // opening '[' of the dictionary literal
  const bracketEnd = findMatchingBracket(cleaned, bracketStart);
  const dictBody = cleaned.slice(bracketStart + 1, bracketEnd);

  const entryRe = /(\d+)\s*:\s*BCIUnitLessonContent\s*\(/g;
  let match;
  while ((match = entryRe.exec(dictBody)) !== null) {
    const order = match[1];
    const openParen = match.index + match[0].length - 1;
    const closeParen = findMatching(dictBody, openParen);
    if (closeParen === -1) {
      failures.push(`Unbalanced parens for unit lesson ${order}`);
      continue;
    }
    const body = dictBody.slice(openParen + 1, closeParen);
    unitLessons[order] = parseStructByType('BCIUnitLessonContent', body);
  }
  return unitLessons;
}

function main() {
  const subjects = parseBlocks(readSwift('Data/SeedSubjects.swift'), 'Subject');
  const topics = parseTopics();
  const learningPaths = parseBlocks(readSwift('Data/SeedLearningPaths.swift'), 'LearningPath');
  const simulations = parseBlocks(readSwift('Data/SeedSimulations.swift'), 'SimulationCard');
  const neuroCodeLessons = parseBlocks(readSwift('Data/SeedNeuroCodeLessons.swift'), 'NeuroCodeLesson');
  const unitLessons = parseUnitLessons();

  const output = {
    subjects,
    topics,
    learningPaths,
    simulations,
    neuroCodeLessons,
    unitLessons,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');

  const pathSteps = learningPaths.reduce((n, p) => n + (p.steps?.length ?? 0), 0);
  const unitLessonKeys = Object.keys(unitLessons);

  const counts = {
    subjects: subjects.length,
    topics: topics.length,
    pathSteps,
    simulations: simulations.length,
    neuroCodeLessons: neuroCodeLessons.length,
    unitLessons: unitLessonKeys.length,
  };

  const expected = {
    subjects: 12,
    topics: 24,
    pathSteps: 20,
    simulations: 12,
    neuroCodeLessons: 12,
    unitLessons: 20,
  };

  console.log('Export complete:', OUT_PATH);
  console.log('\nCounts:');
  for (const [key, val] of Object.entries(counts)) {
    const ok = val === expected[key];
    console.log(`  ${key}: ${val}${ok ? '' : ` (expected ${expected[key]})`}`);
  }

  if (failures.length) {
    console.log(`\nParse failures (${failures.length}):`);
    failures.forEach((f) => console.log(`  - ${f}`));
  } else {
    console.log('\nParse failures: none');
  }

  const mismatches = Object.entries(expected).filter(([k, v]) => counts[k] !== v);
  if (mismatches.length) {
    process.exitCode = 1;
  }
}

main();