// DAT discrete-bank checker. Contract: context/dat/DECISIONS-NUMERIC.md §N3 (reason codes,
// error/warning split, option-policy resolver, two-tier vendor scan, --strict exit codes).
// Pure function over parsed JSON + a thin CLI, the check-clinical-rotations.cjs pattern.
//
//   node scripts/check-dat-banks.cjs [--strict] [--layer N] [--section X] [--json]
//
// Errors are contract violations one item causes; warnings are distributional judgement
// calls over a fragment. --strict also fails on any warning and on LAYER_SHORTFALL, so
// `--strict --layer 1 --section bio` is a content session's acceptance in one exit code.

const REASONS = Object.freeze({
  BANK_SHAPE: 'error',
  DUP_ID: 'error',
  ID_FORMAT: 'error',
  SECTION_MISMATCH: 'error',
  UNKNOWN_CATEGORY: 'error',
  TOPIC_NOT_IN_CATEGORY: 'error',
  UNKNOWN_SKILL: 'error',
  OPTION_COUNT: 'error',
  CANONICAL_OPTIONS: 'error',
  ANSWER_RANGE: 'error',
  EXPLANATION_SHORT: 'error',
  DISTRACTOR_COVERAGE: 'error',
  WEAKEST_TAG: 'error',
  MISSING_WORKED: 'error',
  DISPLAY_ORDER_FORBIDDEN: 'error',
  FIGURE_INVALID: 'error',
  SOURCE_URL: 'error',
  VENDOR_TOKEN: 'error',
  DUPLICATE_STEM: 'error',
  LAYER_SHORTFALL: 'error',
  ARITHMETIC_FALSE: 'error',
  ANSWER_BALANCE: 'warning',
  LONGEST_OPTION_BIAS: 'warning',
  DIFFICULTY_MIX: 'warning',
  WORKED_MISMATCH: 'warning',
  THIN_TOPIC: 'warning',
  SUSPECT_TERM: 'warning',
  DISTRACTOR_ARITHMETIC: 'warning',
});

const ID_RE = /^[a-z0-9][\w-]{2,80}$/;
const FORMATS = ['standard', 'qc', 'ds', 'data'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
// Tier 1: brand-unique, never ordinary science prose → error.
const VENDOR_TOKENS = [
  /\bKaplan\b/i,
  /\bPrometric\b/i,
  /\bBootcamp\b/i,
  /\bBoot\s+Camp\b/i,
  /\bDAT\s+Booster\b/i,
  /\bDAT\s+Destroyer\b/i,
  /\bCrack\s+the\s+DAT\b/i,
  /\bCrackDAT\b/i,
];
// Tier 2: ambiguous bare words (adenosine deaminase, booster dose, catalytic cracking) → warning,
// cleared by the fragment ROOT's lexicalExceptions.
const SUSPECT_TERMS = [/\bADA\b/, /\bBooster\b/i, /\bDestroyer\b/i, /\bCrack\w*\b/i];

function policyKey(outline, item) {
  if (item.format === 'qc' || item.format === 'ds') return item.format;
  const section = outline.sections?.[item.section];
  if (!section) return undefined;
  return section.block === 'sns' ? 'sns' : item.section;
}

function minimumFor(outline, categoryId, layer) {
  const target = outline.targets?.questions?.[categoryId],
    fraction = outline.targets?.layers?.[String(layer)];
  if (!Number.isFinite(target) || !Number.isFinite(fraction)) return null;
  return Math.floor(target * fraction);
}

function normalizeStem(stem) {
  return String(stem)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scanText(item) {
  const parts = [item.stem, item.common, item.quantityA, item.quantityB, item.explanation];
  if (Array.isArray(item.statements)) parts.push(...item.statements);
  if (Array.isArray(item.options)) parts.push(...item.options);
  if (Array.isArray(item.distractors)) parts.push(...item.distractors.map(d => d?.why));
  if (item.table) {
    parts.push(item.table.caption);
    if (Array.isArray(item.table.headers)) parts.push(...item.table.headers);
    if (Array.isArray(item.table.rows)) parts.push(...item.table.rows.flat());
  }
  return parts.filter(p => typeof p === 'string');
}

// Simple arithmetic in named variables: enough to check a QC item's two quantities. Anything
// the evaluator cannot read is skipped; the workedCheckedOn date is then the author's signature.
function evaluate(expression, values) {
  let source = String(expression)
    .replace(/[−–]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/\^/g, '**')
    .replace(/²/g, '**2')
    .replace(/³/g, '**3')
    .replace(/√\(?([\w.]+)\)?/g, 'Math.sqrt($1)');
  const names = Object.keys(values);
  // These become `new Function` parameter names, so only plain identifiers may pass.
  if (!names.every(name => /^[A-Za-z_]\w*$/.test(name) && name !== 'Math')) return null;
  if (!/^[\w\s+\-*/().,]*$/.test(source.replace(/Math\.sqrt/g, ''))) return null;
  for (const token of source.match(/[A-Za-z_]\w*/g) || [])
    if (token !== 'Math' && token !== 'sqrt' && !names.includes(token)) return null;
  try {
    const fn = new Function(...names, 'return (' + source + ');');
    const result = fn(...names.map(n => values[n]));
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}
function checkWorkedQc(item) {
  const values = item.worked?.values;
  if (!values || typeof values !== 'object') return null;
  const names = Object.keys(values);
  if (!names.length) return null;
  const lists = names.map(n => (Array.isArray(values[n]) ? values[n] : [values[n]]));
  if (!lists.every(list => list.every(v => typeof v === 'number'))) return null;
  const combos = lists.reduce((acc, list) => acc.flatMap(prefix => list.map(v => [...prefix, v])), [[]]);
  let relation = null;
  for (const combo of combos) {
    const scope = Object.fromEntries(names.map((n, i) => [n, combo[i]]));
    const a = evaluate(item.quantityA, scope),
      b = evaluate(item.quantityB, scope);
    if (a === null || b === null) return null;
    const r = Math.abs(a - b) < 1e-9 ? 2 : a > b ? 0 : 1;
    if (relation === null) relation = r;
    else if (relation !== r) return 3;
  }
  return relation;
}

// Arithmetic written out in teaching copy: "210 ÷ 140 = 1.5", "0.20 × 40 = 8.0", "30/200 = 3/20".
// Only digits, operators, brackets and numeric "25% of 40" count. Algebra ("x + 3 = 5"), names ("[2+2]", "2-methyl"),
// hyphenated ranges and anything touching a letter are skipped, so every hit is arithmetic a
// learner is asked to take on trust. Every class of content defect two audits found was a
// rationale or explanation whose own numbers did not add up (CONTENT-LOG, C12 corrections).
const A_NUM = String.raw`\d+(?:,\d{3})*(?:\.\d+)?`;
const A_PERCENT_AMOUNT = String.raw`(?:\(\s*${A_NUM}\s*\)|${A_NUM})[²³]?`;
const A_PERCENT_OF = String.raw`(${A_NUM})\s*%\s*of\s*(${A_PERCENT_AMOUNT})`;
const A_TERM = String.raw`\(?\s*(?:${A_PERCENT_OF}|${A_NUM})\s*\)?[²³]?`;
const A_OP = String.raw`(?:\s*[+×*÷/−]\s*|\s+-\s+)`;
const A_EXPR = String.raw`${A_TERM}(?:${A_OP}${A_TERM})*`;
const ARITHMETIC = new RegExp(
  String.raw`(?<![\w.,'’^[-])(?<![+×*÷/−^]\s*)(?<!\s-\s*)(?<!%\s*of\s*)${A_EXPR}(?:\s*=\s*${A_EXPR})*(?![\w\]]|\.\d|\s*[+×*÷/−^]|\s+-\s)`,
  'gi'
);
const NUMBERS = new RegExp(A_NUM, 'g');

function arithmeticValue(text) {
  const source = String(text)
    // Treat the complete numeric phrase as one factor; do not extract its quantity alone.
    .replace(new RegExp(A_PERCENT_OF, 'gi'), '($1 / 100 * $2)')
    .replace(/,(?=\d{3})/g, '')
    .replace(/−/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/²/g, '**2')
    .replace(/³/g, '**3')
    .trim();
  if (!/^[\d\s+\-*/().]+$/.test(source)) return null;
  let depth = 0;
  for (const ch of source) {
    depth += ch === '(' ? 1 : ch === ')' ? -1 : 0;
    if (depth < 0) return null;
  }
  if (depth !== 0) return null;
  try {
    const value = new Function('return (' + source + ');')();
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}
// Half a unit in the last place a plain number states: "8.0" claims ±0.05, "13" claims ±0.5.
// An expression claims exactness.
function statedPrecision(text) {
  const t = String(text).trim();
  if (!/^\d+(?:,\d{3})*(?:\.\d+)?$/.test(t)) return 0;
  const decimals = (/\.(\d+)$/.exec(t) || ['', ''])[1].length;
  return 0.5 * 10 ** -decimals;
}
function agrees(a, b, tolerance) {
  return Math.abs(a - b) <= Math.max(tolerance, 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))) * (1 + 1e-9);
}
// Each written-out computation in `text`: its parts in order and their values. A chain
// `a = b = c` must agree link by link at the precision each plain number states.
function arithmeticIn(text) {
  const out = [];
  for (const m of String(text).matchAll(ARITHMETIC)) {
    if (!/[+×*÷/−=%]|\s-\s/.test(m[0])) continue;
    const parts = m[0].split('=').map(p => p.trim());
    const values = parts.map(arithmeticValue);
    const tolerances = parts.map(statedPrecision);
    if (values.some(v => v === null)) continue;
    // "20/50 = 40 %" states a percentage.
    if (parts.length > 1 && /^\s*%/.test(String(text).slice(m.index + m[0].length))) {
      values[values.length - 1] /= 100;
      tolerances[tolerances.length - 1] /= 100;
    }
    out.push({ text: m[0].trim(), parts, values, tolerances });
  }
  return out;
}
function falseLink(hit) {
  for (let i = 1; i < hit.parts.length; i++) {
    const tolerance = Math.max(hit.tolerances[i - 1], hit.tolerances[i]);
    if (!agrees(hit.values[i - 1], hit.values[i], tolerance)) return i;
  }
  return 0;
}
// The number a numeric option states ("2.625 hours" → 2.625, "7/20" → 0.35, "40 %" → 0.4).
function optionValue(option) {
  const m = /^\s*(−|-)?\s*(\d+(?:,\d{3})*(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(%?)\s*[^\d]*$/.exec(String(option));
  if (!m) return null;
  const value = arithmeticValue(m[2]);
  if (value === null) return null;
  const sign = m[1] ? -1 : 1;
  return { value: (sign * value) / (m[3] ? 100 : 1), tolerance: statedPrecision(m[2]) / (m[3] ? 100 : 1) };
}
// A wrong option's rationale that shows arithmetic has to reach that option: directly, or one
// multiplication or division away by a number the stem or the rationale itself gives (a
// rationale may name the wrong ratio and leave the "× 2.0 atm" to the stem). Prose-only
// rationales are out of reach of a checker and are left to review.
function distractorReaches(item, d) {
  const option = optionValue(item.options[d.i]);
  if (!option) return true;
  const hits = arithmeticIn(d.why);
  if (!hits.length) return true;
  const given = [item.stem, item.common, d.why, ...(item.table?.rows || []).flat()]
    .filter(t => typeof t === 'string' || typeof t === 'number')
    .flatMap(t => String(t).match(NUMBERS) || [])
    .map(arithmeticValue)
    .filter(v => v !== null && v !== 0);
  const tolerance = Math.max(option.tolerance, 0.005 * Math.abs(option.value));
  return hits
    .flatMap(h => h.values)
    .some(
      v =>
        agrees(v, option.value, tolerance) ||
        given.some(k => agrees(v * k, option.value, tolerance) || agrees(v / k, option.value, tolerance))
    );
}

function checkDatBanks(outline, fragments, options = {}) {
  const { strict = false, layer = null, section = null } = options;
  const errors = [],
    warnings = [];
  const finding = (reason, detail) => {
    const level = REASONS[reason];
    const f = {
      reason,
      level,
      file: null,
      itemId: null,
      category: null,
      message: '',
      have: null,
      need: null,
      ...detail,
    };
    (level === 'error' ? errors : warnings).push(f);
  };
  const categories = new Map();
  for (const concept of outline.concepts || [])
    for (const cat of concept.categories || []) categories.set(cat.id, { ...cat, section: concept.section });
  const skills = new Set((outline.scienceSkills || []).map(s => s.id));

  const inventory = {
    bySection: {},
    byCategory: Object.fromEntries([...categories.keys()].map(id => [id, { items: 0, topics: {} }])),
    byFormat: { standard: 0, qc: 0, ds: 0, data: 0 },
    byDifficulty: { easy: 0, medium: 0, hard: 0 },
    byAnswerIndex: {},
  };
  const ids = new Map(),
    stems = new Map(),
    perSection = {}; // section -> layer -> [items]

  for (const fragment of fragments) {
    const file = fragment.file,
      data = fragment.data;
    const layerFromName = Number((/dat-questions-[a-z]+-(\d)\.json$/.exec(file) || [])[1]);
    if (
      !data ||
      data.format !== 'dat-bank' ||
      !Number.isInteger(data.version) ||
      typeof data.section !== 'string' ||
      !Number.isInteger(data.layer) ||
      !Array.isArray(data.items) ||
      (Number.isFinite(layerFromName) && data.layer !== layerFromName)
    ) {
      finding('BANK_SHAPE', {
        file,
        message: 'ROOT needs format "dat-bank", version, section, layer (matching the filename) and items[].',
      });
      continue;
    }
    if (!outline.sections?.[data.section]) {
      finding('BANK_SHAPE', { file, message: `Unknown section "${data.section}".` });
      continue;
    }
    const exceptions = Array.isArray(data.lexicalExceptions) ? data.lexicalExceptions : [];
    const usedExceptions = new Set();
    const bucket = (inventory.bySection[data.section] ||= { items: 0, fragments: 0 });
    bucket.fragments++;
    perSection[data.section] ||= {};
    (perSection[data.section][data.layer] ||= []).push(...data.items);
    const answerCounts = new Map(); // options.length -> [counts]
    let longestCorrect = 0,
      longestEligible = 0;
    const difficulties = new Set();

    for (const item of data.items) {
      const where = { file, itemId: typeof item?.id === 'string' ? item.id : null, category: item?.category || null };
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.stem !== 'string' ||
        !Array.isArray(item.options) ||
        !item.provenance ||
        typeof item.provenance !== 'object'
      ) {
        finding('BANK_SHAPE', { ...where, message: 'Item needs stem, options[] and provenance{}.' });
        continue;
      }
      const format = item.format || 'standard';
      if (typeof item.id !== 'string' || !ID_RE.test(item.id))
        finding('ID_FORMAT', { ...where, message: `Id "${item.id}" must match ${ID_RE}.` });
      else if (ids.has(item.id)) finding('DUP_ID', { ...where, message: `Id repeats (first in ${ids.get(item.id)}).` });
      else ids.set(item.id, file);
      const cat = categories.get(item.category);
      if (!cat) finding('UNKNOWN_CATEGORY', { ...where, message: `"${item.category}" is not an outline category.` });
      else {
        if (item.section !== data.section || item.section !== cat.section)
          finding('SECTION_MISMATCH', {
            ...where,
            message: `item.section "${item.section}" must equal the fragment section "${data.section}" and the category section "${cat.section}".`,
          });
        if (!cat.topics.includes(item.topic))
          finding('TOPIC_NOT_IN_CATEGORY', {
            ...where,
            message: `topic "${item.topic}" is not verbatim in ${cat.id}.topics.`,
          });
        inventory.byCategory[cat.id].items++;
        inventory.byCategory[cat.id].topics[item.topic] = (inventory.byCategory[cat.id].topics[item.topic] || 0) + 1;
      }
      if (!skills.has(item.skill))
        finding('UNKNOWN_SKILL', { ...where, message: `skill "${item.skill}" is not in scienceSkills.` });
      if (!FORMATS.includes(format))
        finding('BANK_SHAPE', { ...where, message: `format "${format}" is not one of ${FORMATS.join('/')}.` });
      if (DIFFICULTIES.includes(item.difficulty)) {
        inventory.byDifficulty[item.difficulty]++;
        difficulties.add(item.difficulty);
      } else finding('BANK_SHAPE', { ...where, message: `difficulty "${item.difficulty}" is not easy/medium/hard.` });
      inventory.byFormat[format] = (inventory.byFormat[format] || 0) + 1;

      const key = policyKey(outline, item),
        policy = key ? outline.optionPolicy?.[key] : undefined;
      if (!policy)
        finding('BANK_SHAPE', {
          ...where,
          message: `No optionPolicy entry resolves for section "${item.section}" / format "${format}".`,
        });
      else {
        if (item.options.length !== policy.options)
          finding('OPTION_COUNT', {
            ...where,
            have: item.options.length,
            need: policy.options,
            message: `${item.options.length} options; optionPolicy.${key} requires ${policy.options}.`,
          });
        if (Array.isArray(policy.canonical) && JSON.stringify(item.options) !== JSON.stringify(policy.canonical))
          finding('CANONICAL_OPTIONS', {
            ...where,
            message: `${format} options must be optionPolicy.${key}.canonical verbatim and in order.`,
          });
        const weakest = (item.distractors || []).filter(d => d?.weakest === true).length,
          needWeakest = policy.status === 'unverified' ? 1 : 0;
        if (weakest !== needWeakest)
          finding('WEAKEST_TAG', {
            ...where,
            have: weakest,
            need: needWeakest,
            message: `${weakest} distractor(s) tagged weakest; optionPolicy.${key}.status "${policy.status}" requires ${needWeakest}.`,
          });
      }
      const n = item.options.length;
      if (!Number.isInteger(item.answer) || item.answer < 0 || item.answer >= n)
        finding('ANSWER_RANGE', { ...where, message: `answer ${item.answer} is outside [0, ${n}).` });
      else {
        inventory.byAnswerIndex[item.answer] = (inventory.byAnswerIndex[item.answer] || 0) + 1;
        if (!answerCounts.has(n)) answerCounts.set(n, Array(n).fill(0));
        answerCounts.get(n)[item.answer]++;
        if (format === 'standard' || format === 'data') {
          const lengths = item.options.map(o => String(o).length),
            max = Math.max(...lengths);
          if (lengths.filter(l => l === max).length === 1) {
            longestEligible++;
            if (lengths[item.answer] === max) longestCorrect++;
          }
        }
      }
      if (typeof item.explanation !== 'string' || item.explanation.length <= 60)
        finding('EXPLANATION_SHORT', { ...where, message: 'explanation must be longer than 60 characters.' });
      const distractors = Array.isArray(item.distractors) ? item.distractors : [];
      const covered = new Set(distractors.map(d => d?.i));
      const missing = [...item.options.keys()].filter(i => i !== item.answer && !covered.has(i));
      if (missing.length || distractors.some(d => d?.i === item.answer || typeof d?.why !== 'string' || !d.why))
        finding('DISTRACTOR_COVERAGE', {
          ...where,
          message: `every wrong option needs a distractors[] entry with a why (missing: ${missing.join(', ') || 'none'}; none may point at the answer).`,
        });
      if (['qc', 'ds', 'data'].includes(format)) {
        if (
          !item.worked ||
          typeof item.worked !== 'object' ||
          !item.worked.values ||
          typeof item.worked.workedCheckedOn !== 'string'
        )
          finding('MISSING_WORKED', { ...where, message: `${format} items carry worked { values, workedCheckedOn }.` });
        else if (format === 'qc') {
          const relation = checkWorkedQc(item);
          if (relation !== null && relation !== item.answer)
            finding('WORKED_MISMATCH', {
              ...where,
              have: relation,
              need: item.answer,
              message: `worked.values substitute to option ${relation}, answer says ${item.answer}.`,
            });
        }
        if (
          format === 'data' &&
          (!item.table ||
            !Array.isArray(item.table.headers) ||
            !Array.isArray(item.table.rows) ||
            typeof item.setId !== 'string')
        )
          finding('BANK_SHAPE', {
            ...where,
            message: 'data items carry table { caption, headers, rows } and a setId.',
          });
      }
      if ((format === 'qc' || format === 'ds') && item.displayOrder != null)
        finding('DISPLAY_ORDER_FORBIDDEN', {
          ...where,
          message: 'qc/ds items never carry displayOrder; their options are fixed.',
        });
      if (item.figure != null) {
        const svg = String(item.figure);
        if (
          !/^\s*<svg[\s>]/.test(svg) ||
          !/<\/svg>\s*$/.test(svg) ||
          Buffer.byteLength(svg, 'utf8') > 8192 ||
          /<script|href\s*=|xlink|<foreignObject|\son[a-z]+\s*=/i.test(svg)
        )
          finding('FIGURE_INVALID', {
            ...where,
            message:
              'figure must be one inline <svg> ≤ 8 KB with no <script>, no href or xlink, no <foreignObject> and no inline event handler.',
          });
      }
      for (const [label, text] of [
        ['stem', item.stem],
        ['common', item.common],
        ['explanation', item.explanation],
        ...distractors.map(d => [`distractors[i=${d?.i}]`, d?.why]),
      ]) {
        if (typeof text !== 'string') continue;
        for (const hit of arithmeticIn(text)) {
          const i = falseLink(hit);
          if (i)
            finding('ARITHMETIC_FALSE', {
              ...where,
              message: `${label}: "${hit.text}" — ${hit.parts[i - 1]} is ${+hit.values[i - 1].toPrecision(6)}, not ${hit.parts[i]}. Use ≈ for a rounded result.`,
            });
        }
      }
      if (format === 'standard' || format === 'data')
        for (const d of distractors)
          if (Number.isInteger(d?.i) && typeof d.why === 'string' && !distractorReaches(item, d))
            finding('DISTRACTOR_ARITHMETIC', {
              ...where,
              message: `distractors[i=${d.i}] shows ${arithmeticIn(d.why)
                .map(h => `"${h.text}"`)
                .join(', ')}, which does not produce option ${d.i} "${item.options[d.i]}".`,
            });
      const url = item.provenance.source?.url;
      if (item.provenance.source != null && !/^https:\/\//.test(String(url)))
        finding('SOURCE_URL', { ...where, message: `provenance.source.url "${url}" must be https.` });
      const normalized = normalizeStem(item.stem);
      if (stems.has(normalized))
        finding('DUPLICATE_STEM', { ...where, message: `stem duplicates ${stems.get(normalized)}.` });
      else stems.set(normalized, item.id);
      for (const text of scanText(item)) {
        for (const re of VENDOR_TOKENS) {
          const m = re.exec(text);
          if (m) finding('VENDOR_TOKEN', { ...where, message: `"${m[0]}" is a prep-vendor token.` });
        }
        for (const re of SUSPECT_TERMS) {
          const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
          for (const m of text.matchAll(global)) {
            if (exceptions.includes(m[0])) usedExceptions.add(m[0]);
            else
              finding('SUSPECT_TERM', {
                ...where,
                message: `"${m[0]}" reads as a prep-vendor word; list it in lexicalExceptions if it is a legitimate term.`,
              });
          }
        }
      }
    }
    bucket.items += data.items.length;
    for (const listed of exceptions)
      if (!usedExceptions.has(listed))
        finding('SUSPECT_TERM', { file, message: `lexicalExceptions lists "${listed}" but no item text matches it.` });
    if (data.items.length >= 20) {
      for (const [n, counts] of answerCounts) {
        const total = counts.reduce((a, b) => a + b, 0);
        if (total < 20) continue;
        const shares = counts.map(c => c / total),
          maxShare = n >= 5 ? 0.35 : 0.4;
        if (Math.max(...shares) > maxShare || Math.min(...shares) < 0.1)
          finding('ANSWER_BALANCE', {
            file,
            message: `${n}-option answer positions ${counts.join('/')} of ${total}: max share ≤ ${maxShare}, min ≥ 0.10.`,
          });
      }
      if (longestEligible >= 20 && longestCorrect / longestEligible > 0.3)
        finding('LONGEST_OPTION_BIAS', {
          file,
          have: longestCorrect,
          need: Math.floor(longestEligible * 0.3),
          message: `the longest option is correct in ${longestCorrect}/${longestEligible} items (> 30 %).`,
        });
      for (const level of DIFFICULTIES)
        if (!difficulties.has(level))
          finding('DIFFICULTY_MIX', { file, message: `no ${level} items in a fragment of ${data.items.length}.` });
    }
  }

  // Gate: cumulative per category across layers ≤ N for the chosen section(s).
  let gate = null;
  const gatedSections = section ? [section] : Object.keys(perSection);
  const gateLayer = sec =>
    layer != null ? Number(layer) : Math.max(0, ...Object.keys(perSection[sec] || {}).map(Number));
  if (layer != null || strict) {
    const minima = {},
      counts = {},
      shortfalls = [];
    for (const sec of gatedSections) {
      const N = gateLayer(sec);
      if (!N) continue;
      const items = Object.entries(perSection[sec] || {})
        .filter(([l]) => Number(l) <= N)
        .flatMap(([, list]) => list);
      for (const [id, cat] of categories) {
        if (cat.section !== sec) continue;
        const need = minimumFor(outline, id, N);
        if (need === null) continue;
        const have = items.filter(it => it.category === id).length;
        minima[id] = need;
        counts[id] = have;
        if (have < need) shortfalls.push({ category: id, have, need });
        // Topic coverage is a complete-bank rule: at layer 1 a category like GC-1 (7 topics, minimum 4)
        // cannot cover its topics, so THIN_TOPIC only fires when the gate's fraction reaches 1.0.
        if (layer != null && (outline.targets?.layers?.[String(N)] ?? 0) >= 1) {
          const zero = cat.topics.filter(t => !items.some(it => it.category === id && it.topic === t)).length;
          if (zero > 2)
            finding('THIN_TOPIC', {
              category: id,
              have: cat.topics.length - zero,
              need: cat.topics.length - 2,
              message: `${zero} of ${cat.topics.length} topics in ${id} have no items at layer ${N}.`,
            });
        }
      }
      if (strict)
        for (const s of shortfalls.filter(s => categories.get(s.category).section === sec))
          finding('LAYER_SHORTFALL', {
            category: s.category,
            have: s.have,
            need: s.need,
            message: `${s.category}: ${s.have} items, layer ${N} needs ${s.need}.`,
          });
    }
    gate = {
      layer: layer != null ? Number(layer) : null,
      fraction: layer != null ? (outline.targets?.layers?.[String(layer)] ?? null) : null,
      minima,
      counts,
      shortfalls,
    };
  }

  const lines = ['section    items  fragments'];
  for (const [sec, b] of Object.entries(inventory.bySection))
    lines.push(`${sec.padEnd(10)} ${String(b.items).padStart(5)}  ${b.fragments}`);
  lines.push('', 'category   items' + (gate && gate.layer != null ? `  need(L${gate.layer})` : ''));
  for (const [id, c] of Object.entries(inventory.byCategory)) {
    if (/^(RC|PAT)-/.test(id)) continue;
    lines.push(
      `${id.padEnd(10)} ${String(c.items).padStart(5)}` +
        (gate && gate.minima[id] != null
          ? `  ${String(gate.minima[id]).padStart(4)}${c.items < gate.minima[id] ? '  SHORT' : ''}`
          : '')
    );
  }
  lines.push(
    '',
    `formats: ${Object.entries(inventory.byFormat)
      .map(([k, v]) => `${k} ${v}`)
      .join(' · ')}`,
    `difficulty: ${Object.entries(inventory.byDifficulty)
      .map(([k, v]) => `${k} ${v}`)
      .join(' · ')}`
  );
  const table = lines.join('\n');
  const ok = errors.length === 0 && (!strict || (warnings.length === 0 && (gate?.shortfalls.length ?? 0) === 0));
  return { ok, errors, warnings, inventory, gate, table };
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  // `--layer abc` used to parse to NaN and skip the gate entirely, reporting success.
  const layerArg = value => {
    if (value == null) return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 3) {
      console.error('--layer must be 1, 2 or 3; got "' + value + '".');
      process.exit(2);
    }
    return n;
  };
  const flag = name => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : null;
  };
  if (argv.includes('--help')) {
    console.log(
      'node scripts/check-dat-banks.cjs [--strict] [--layer N] [--section X] [--json]\n' +
        'Layer gate: every category needs Math.floor(targets.questions[cat] × targets.layers[N]) items merged across dat-questions-X-1…X-N.'
    );
    process.exit(0);
  }
  const data = require('./dat-data.cjs');
  const fragments = data.fragments.questions.filter(f => f.data).map(f => ({ file: f.file, data: f.data }));
  const report = checkDatBanks(data.outline, fragments, {
    strict: argv.includes('--strict'),
    layer: layerArg(flag('--layer')),
    section: flag('--section'),
  });
  if (argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(report.table);
    for (const f of [...report.errors, ...report.warnings])
      console.log(
        `${f.level.toUpperCase().padEnd(7)} ${f.reason.padEnd(24)} ${f.file || ''} ${f.itemId || f.category || ''} — ${f.message}`
      );
    console.log(
      `\n${report.errors.length} errors, ${report.warnings.length} warnings` +
        (report.gate?.shortfalls.length ? `, ${report.gate.shortfalls.length} layer shortfall(s)` : '')
    );
  }
  process.exitCode = report.ok ? 0 : 1;
}

module.exports = { checkDatBanks, minimumFor, policyKey, REASONS, arithmeticIn, optionValue };
