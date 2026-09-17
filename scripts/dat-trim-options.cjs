#!/usr/bin/env node
/* One-off migration for the option-count contingency (DESIGN §7.4 item 7, §10.3, risk 1).
 *
 * Every science, RC and standard-QR item is authored with five options and exactly one
 * distractor tagged "weakest": true, because no current ADA page states the live option count
 * (RESEARCH §2.2, §10.2 item 1). If a purchased ADA module shows four, the fix is a data edit,
 * not a code change: set the affected optionPolicy entry (sns / rc / qr — never a per-section
 * key, which does not exist) to options: 4 and status to the verified grade, then run this
 * script. It drops the weakest distractor from every governed item, re-indexes `answer`,
 * `distractors[].i` and any `displayOrder`, and records `revision` + `previousVersion` so
 * scripts/check-dat-item-history.cjs can account for every touched item (AUTHORING §6.9).
 * Renderers need no change: they are generic over options.length and LETTERS.
 *
 *   node scripts/dat-trim-options.cjs              # dry run, prints the plan
 *   node scripts/dat-trim-options.cjs --write      # applies it
 *   node scripts/dat-trim-options.cjs --policy qr  # one policy only
 *
 * Run it once, immediately after the option count is settled and before the next content
 * session: trimming twenty seed items is nothing, trimming five hundred is a migration.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const POLICIES = ['sns', 'rc', 'qr'];
const FIXED = ['qc', 'ds'];

// The one shared resolver (AUTHORING §6.2, check-dat-banks.cjs:58). Fixed option sets are
// never trimmed: qc is four verbatim options and ds is five.
function policyKey(outline, item) {
  if (FIXED.includes(item.format)) return item.format;
  const section = outline.sections?.[item.section];
  if (!section) return undefined;
  return section.block === 'sns' ? 'sns' : item.section;
}

/* Trim one item to `target` options by removing its weakest distractor.
   Returns { changed, item, reason }. `reason` is set only when nothing was done, so a caller
   can tell "already four options" from "this item has no weakest tag to drop". */
function trimItem(item, target) {
  if (!item || !Array.isArray(item.options)) return { changed: false, item, reason: 'NO_OPTIONS' };
  if (item.options.length <= target) return { changed: false, item, reason: 'ALREADY_TRIMMED' };
  if (item.options.length !== target + 1) return { changed: false, item, reason: 'UNEXPECTED_COUNT' };
  const distractors = Array.isArray(item.distractors) ? item.distractors : [];
  const weakest = distractors.filter(d => d && d.weakest === true);
  if (weakest.length !== 1) return { changed: false, item, reason: 'WEAKEST_TAG' };
  const drop = weakest[0].i;
  if (!Number.isInteger(drop) || drop < 0 || drop >= item.options.length)
    return { changed: false, item, reason: 'WEAKEST_INDEX' };
  if (drop === item.answer) return { changed: false, item, reason: 'WEAKEST_IS_KEY' };

  const next = JSON.parse(JSON.stringify(item));
  // previousVersion keeps the prior wording verbatim; a second run would overwrite a first
  // migration's record, so an item that already carries one is left alone above by the count
  // guard. The three fields are the ones AUTHORING §6.9 names.
  next.revision = Number.isInteger(item.revision) ? item.revision + 1 : 1;
  next.previousVersion = {
    stem: item.stem,
    options: item.options.slice(),
    explanation: item.explanation,
  };
  next.options = item.options.filter((_, i) => i !== drop);
  next.answer = item.answer > drop ? item.answer - 1 : item.answer;
  next.distractors = distractors
    .filter(d => d.i !== drop)
    .map(d => {
      const copy = Object.assign({}, d);
      if (copy.i > drop) copy.i -= 1;
      // Once the count is verified the checker requires zero weakest tags (DECISIONS §N3).
      delete copy.weakest;
      return copy;
    });
  if (Array.isArray(item.displayOrder))
    next.displayOrder = item.displayOrder.filter(i => i !== drop).map(i => (i > drop ? i - 1 : i));
  return { changed: true, item: next };
}

/* Trim every governed item in one parsed bank fragment. `items` may also be the question array
   of an RC passage — the shape the trim needs is options / answer / distractors only. */
function trimBank(outline, data, policy) {
  const target = outline.optionPolicy?.[policy]?.options;
  if (!Number.isInteger(target)) throw Error('optionPolicy.' + policy + '.options is not a number');
  const items = Array.isArray(data.items) ? data.items : [];
  const trimmed = [],
    skipped = [];
  const out = items.map(item => {
    if (policyKey(outline, item) !== policy) return item;
    const result = trimItem(item, target);
    if (result.changed) trimmed.push(item.id);
    else if (result.reason !== 'ALREADY_TRIMMED') skipped.push({ id: item.id, reason: result.reason });
    return result.item;
  });
  return { data: Object.assign({}, data, { items: out }), trimmed, skipped };
}

/* ---------- file walk ---------- */
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
function bankFiles(outline) {
  return (outline.files?.questions || [])
    .map(name => path.join(ROOT, 'data', name + '.json'))
    .filter(file => fs.existsSync(file));
}
// RC questions live inside passages, so they are trimmed in place rather than through trimBank.
function trimRc(outline, rc) {
  const target = outline.optionPolicy?.rc?.options;
  if (!Number.isInteger(target)) throw Error('optionPolicy.rc.options is not a number');
  const trimmed = [],
    skipped = [];
  for (const passage of rc.passages || [])
    passage.questions = (passage.questions || []).map(question => {
      const result = trimItem(question, target);
      if (result.changed) trimmed.push(passage.id + ':' + question.id);
      else if (result.reason !== 'ALREADY_TRIMMED')
        skipped.push({ id: passage.id + ':' + question.id, reason: result.reason });
      return result.item;
    });
  return { data: rc, trimmed, skipped };
}
function plan(policies, write) {
  const outline = readJson(path.join(ROOT, 'data', 'dat-outline.json'));
  const report = { policies: [], trimmed: 0, skipped: [], files: [] };
  for (const policy of policies) {
    const entry = outline.optionPolicy?.[policy];
    if (!entry) throw Error('Unknown option policy: ' + policy);
    report.policies.push({ policy, options: entry.options, status: entry.status });
    if (policy === 'rc') {
      const file = path.join(ROOT, 'data', 'dat-rc.json');
      if (!fs.existsSync(file)) continue;
      const result = trimRc(outline, readJson(file));
      if (result.trimmed.length && write) writeJson(file, result.data);
      if (result.trimmed.length) report.files.push({ file: 'data/dat-rc.json', count: result.trimmed.length });
      report.trimmed += result.trimmed.length;
      report.skipped.push(...result.skipped);
      continue;
    }
    for (const file of bankFiles(outline)) {
      const result = trimBank(outline, readJson(file), policy);
      if (result.trimmed.length && write) writeJson(file, result.data);
      if (result.trimmed.length) report.files.push({ file: path.relative(ROOT, file), count: result.trimmed.length });
      report.trimmed += result.trimmed.length;
      report.skipped.push(...result.skipped);
    }
  }
  return report;
}

function main(argv) {
  const write = argv.includes('--write');
  const at = argv.indexOf('--policy');
  const policies = at >= 0 ? [argv[at + 1]] : POLICIES;
  for (const policy of policies)
    if (!POLICIES.includes(policy)) {
      console.error('--policy must be one of ' + POLICIES.join(', ') + ' (qc and ds are fixed sets).');
      return 1;
    }
  const report = plan(policies, write);
  for (const entry of report.policies)
    console.log('optionPolicy.' + entry.policy + ': options ' + entry.options + ' (' + entry.status + ')');
  for (const file of report.files) console.log((write ? 'trimmed ' : 'would trim ') + file.count + ' in ' + file.file);
  for (const skip of report.skipped) console.log('SKIPPED ' + skip.id + ' — ' + skip.reason);
  console.log((write ? 'Trimmed ' : 'Would trim ') + report.trimmed + ' item(s).');
  if (!write && report.trimmed) console.log('Re-run with --write to apply, then bump the fragment cache lines.');
  return report.skipped.length ? 1 : 0;
}

module.exports = { trimItem, trimBank, trimRc, policyKey, plan, POLICIES };
if (require.main === module) process.exit(main(process.argv.slice(2)));
