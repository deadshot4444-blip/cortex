/* Portable study files. Authentication and other workspaces never enter this format. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StudyBackup = api;
})(typeof window === 'undefined' ? globalThis : window, () => {
  const FORMAT = 'cortex-study-backup', VERSION = 1, MAX_BYTES = 16 * 1024 * 1024;
  const plainKeys = new Set(['cs-mode', 'cs-diff', 'cs-seen-ver', 'cs-anon-id']);
  const arrayKeys = new Set(['cs-history', 'cs-mcat-log', 'cs-mcat-exam-reviews']);
  const keys = new Set([...plainKeys, ...arrayKeys,
    'cs-academy-anatomy-v1', 'cs-academy-reference-v1', 'cs-academy-today-v1', 'cs-academy-connections-v1', 'cs-academy-portfolio-v1', 'cs-anat', 'cs-anat-runs-v1',
    'cs-cases', 'cs-ccma', 'cs-clinical-shift-v1', 'cs-clinical-longitudinal-v1', 'cs-cogpsych', 'cs-cogpsych-research-v1', 'cs-ekg', 'cs-genetics',
    'cs-labs', 'cs-ltl-progress-v1', 'cs-mcat-course-v1', 'cs-mcat-coursework', 'cs-mcat-passage-reviews',
    'cs-mcat-rehearsal-v1', 'cs-mcat-item-reports-v1', 'cs-mcat-plan', 'cs-mcat-q', 'cs-mcat-repairs-v1', 'cs-mcat-srs', 'cs-mcat-v2', 'cs-medicine', 'cs-micro',
    'cs-neuro', 'cs-ped', 'cs-pharm', 'cs-pomo', 'cs-progress', 'cs-socrates', 'cs-streak']);
  // Learner free text is only ever rendered through esc(), so shorthand such as
  // "Na<K and K>Cl" is not markup there. These field names were checked against
  // every section script: none is inserted into HTML unescaped. Authored snapshot
  // fields rendered as HTML (lesson body, reveal, explain) stay strictly checked.
  const learnerText = new Set(['draft', 'firstDraft', 'drafts', 'notes', 'note', 'assessment', 'plan', 'rationale', 'comparison', 'prediction', 'response', 'debrief', 'evidence', 'analysis', 'memo', 'reflection', 'explanation']);
  const longitudinalText = new Set(['hypothesis', 'alternative', 'situation', 'uncertainty', 'next', 'changed']);
  const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const bytes = text => new TextEncoder().encode(text).length;
  function inspect(data, checkMarkup, action = 'restore') {
    if (!object(data) || Object.keys(data).length > 100) throw Error('The file does not contain a supported study workspace.');
    let count = 0;
    function walk(value, depth = 0, field = '', plainText = false, rootKey = '') {
      if (++count > 400000 || depth > 60) throw Error('This backup is too complex to restore safely.');
      if (typeof value === 'number' && !Number.isFinite(value)) throw Error('The backup contains an invalid number.');
      if (typeof value === 'string') {
        if (/(?:^id$|Id$|^key$)/.test(field) && value && !/^[\w:.|/@+ -]{1,250}$/.test(value)) throw Error('The backup contains an invalid content identifier.');
        if (/(?:url|href)$/i.test(field) && value) {
          // Control characters are rejected on purpose: links are re-rendered as HTML.
          // eslint-disable-next-line no-control-regex
          if (/[<>"'`\u0000-\u0020]/.test(value)) throw Error('The backup contains an invalid source link.');
          let url; try { url = new URL(value, 'https://cortexmedical.academy/'); } catch { throw Error('The backup contains an invalid source link.'); }
          if (!['https:', 'http:'].includes(url.protocol)) throw Error('The backup contains an unsupported source link.');
        }
        if (!plainText && /<[a-z/!]/i.test(value)) {
          if (!checkMarkup || !checkMarkup(value)) throw Error(action === 'export'
            ? 'The saved record ' + rootKey + ' contains HTML that a portable backup cannot carry, so no backup was prepared. Download recovery copies instead.'
            : 'The backup contains unsupported HTML. Keep it as a recovery copy; it has not been restored.');
        }
      } else if (value && typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) {
          if (['__proto__', 'prototype', 'constructor'].includes(key) || /[<>"'`&]/.test(key)) throw Error('The backup contains an unsafe record key.');
          // Project strings are rendered as escaped text, including Python such
          // as x<cutoff. Other course snapshots still require inert markup.
          walk(item, depth + 1, key, plainText || learnerText.has(key) || (rootKey === 'cs-clinical-longitudinal-v1' && longitudinalText.has(key)) || (rootKey === 'cs-neuro' && depth === 0 && key === 'projects') || (rootKey === 'cs-cogpsych' && depth === 0 && key === 'practice') || (rootKey === 'cs-mcat-course-v1' && depth === 2 && key === 'help'), rootKey);
        }
      }
    }
    for (const [key, raw] of Object.entries(data)) {
      if (!keys.has(key) && !/^cs-mcat-r-(?:flash|drill|cars|plab|sim)$/.test(key)) throw Error('This app cannot restore the study record: ' + key);
      if (typeof raw !== 'string') throw Error('A saved study record is not serialized text.');
      if (plainKeys.has(key)) {
        if (raw.length > 200 || !/^[\w. -]*$/.test(raw)) throw Error('A saved preference has an unsupported value.');
        continue;
      }
      let value; try { value = JSON.parse(raw); } catch { throw Error('The saved record ' + key + ' is damaged.'); }
      if (arrayKeys.has(key) ? !Array.isArray(value) : !object(value)) throw Error('The saved record ' + key + ' has an unsupported shape.');
      walk(value, 0, '', ['cs-academy-portfolio-v1','cs-mcat-item-reports-v1'].includes(key), key);
    }
    return Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b)));
  }
  // Fixed field order and sorted workspace keys give stable integrity checks.
  function payload(file) {
    return { format: FORMAT, version: VERSION, appVersion: file.appVersion, createdAt: file.createdAt,
      scope: 'active-workspace', data: Object.fromEntries(Object.entries(file.data).sort(([a], [b]) => a.localeCompare(b))) };
  }
  async function digest(value, cryptoAPI = globalThis.crypto) {
    if (!cryptoAPI?.subtle) throw Error('Verified backups require HTTPS or localhost in this browser.');
    return Array.from(new Uint8Array(await cryptoAPI.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))), n => n.toString(16).padStart(2, '0')).join('');
  }
  async function create(data, appVersion, options = {}) {
    const file = payload({ appVersion, createdAt: options.now || new Date().toISOString(), data: inspect(data, options.checkMarkup, 'export') });
    const text = JSON.stringify({ ...file, sha256: await digest(file, options.crypto) }, null, 2);
    if (bytes(text) > MAX_BYTES) throw Error('This workspace exceeds the 16 MB portable backup limit. Download recovery copies instead.');
    return text;
  }
  async function parse(text, options = {}) {
    if (typeof text !== 'string' || bytes(text) > MAX_BYTES) throw Error('Choose a study backup smaller than 16 MB.');
    let file; try { file = JSON.parse(text); } catch { throw Error('This file is not valid JSON.'); }
    if (!object(file) || file.format !== FORMAT || file.version !== VERSION || file.scope !== 'active-workspace') throw Error('This is not a supported Cortex study backup. Recovery downloads use a different format.');
    if (typeof file.appVersion !== 'string' || file.appVersion.length > 80 || typeof file.createdAt !== 'string' || !Number.isFinite(Date.parse(file.createdAt)) || !/^[a-f0-9]{64}$/.test(file.sha256)) throw Error('The backup metadata is incomplete.');
    const data = inspect(file.data, options.checkMarkup), normalized = payload({ ...file, data });
    if (await digest(normalized, options.crypto) !== file.sha256) throw Error('The integrity check failed. This file is incomplete or has changed.');
    return normalized;
  }
  function safeMarkup(text, documentAPI = globalThis.document) {
    // Detached template content is inert. Only the formatting used in authored
    // lesson snapshots is accepted; no scripts, links, media, styles or IDs.
    const template = documentAPI.createElement('template'); template.innerHTML = text;
    const allowed = new Set(['B', 'I', 'EM', 'STRONG', 'BR', 'P', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'CODE', 'PRE', 'FIGURE', 'FIGCAPTION', 'SUB', 'SUP']);
    return [...template.content.querySelectorAll('*')].every(node => allowed.has(node.tagName) && [...node.attributes].every(a => a.name === 'aria-label'));
  }
  return { create, parse, inspect, safeMarkup, MAX_BYTES, VERSION };
});
