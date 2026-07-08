/* ============================================================================
   Cortex · Genetics-2313-01E  —  UTSA Module 3 (Chapters 10-12)
   Password-gated, arcade-style mastery trainer built on science-of-learning
   principles: active recall (testing effect), spaced repetition (Leitner
   boxes), interleaving, and targeted practice on measured weaknesses.

   Self-contained: uses app.js globals (el, esc, setView, topbar, siteFooter).
   Progress lives in localStorage['cs-genetics'] — fully separate from
   clinical / MCAT progress.
   ========================================================================= */

/* ---------- SVG picture-labeling diagrams (authored, scientifically exact) ---------- */
function gChr(cy, arrowY) {
  const arr = arrowY != null
    ? `<line x1="88" y1="${arrowY}" x2="64" y2="${arrowY}" class="gsv-arr"/><path d="M64 ${arrowY} l9 -5 v10 z" class="gsv-arrhead"/>`
    : '';
  return `<svg viewBox="0 0 100 150" class="gen-svg" role="img" aria-label="chromosome diagram">`
    + `<rect x="33" y="12" width="10" height="126" rx="5" class="gsv-chr"/>`
    + `<rect x="49" y="12" width="10" height="126" rx="5" class="gsv-chr"/>`
    + `<rect x="29" y="${cy - 3.5}" width="34" height="7" rx="3.5" class="gsv-cen"/>`
    + `<circle cx="46" cy="${cy}" r="3.2" class="gsv-dot"/>${arr}</svg>`;
}
function gInversion(letters, cenAfter, invFrom, invTo) {
  // letters: array; cenAfter: index after which the centromere dot sits; inv range [invFrom,invTo] (inclusive, display order)
  const n = letters.length, w = 252, pad = 20, gap = (w - pad * 2) / (n - 1);
  let cells = '', hi = '';
  for (let i = 0; i < n; i++) {
    const x = pad + i * gap;
    if (i >= invFrom && i <= invTo) hi += `<rect x="${x - gap / 2 + 2}" y="14" width="${gap - 4}" height="34" class="gsv-hi"/>`;
    cells += `<text x="${x}" y="36" class="gsv-let">${letters[i]}</text>`;
  }
  const cx = pad + cenAfter * gap + gap / 2;
  const cen = `<circle cx="${cx}" cy="31" r="4.2" class="gsv-dot2"/>`;
  return `<svg viewBox="0 0 ${w} 60" class="gen-svg gen-svg-wide" role="img" aria-label="chromosome rearrangement">${hi}<line x1="${pad - 6}" y1="31" x2="${w - pad + 6}" y2="31" class="gsv-track"/>${cen}${cells}</svg>`;
}
function gGametes(labels) {
  const w = 248, n = labels.length, gap = w / n;
  let g = '';
  for (let i = 0; i < n; i++) {
    const cx = gap / 2 + i * gap;
    const norm = labels[i] === 'n';
    g += `<circle cx="${cx}" cy="32" r="19" class="gsv-gam ${norm ? 'norm' : 'ab'}"/><text x="${cx}" y="37" class="gsv-glab">${labels[i]}</text>`;
  }
  return `<svg viewBox="0 0 ${w} 64" class="gen-svg gen-svg-wide" role="img" aria-label="gamete chromosome numbers">${g}</svg>`;
}
function gPunnett(top, side, cells) {
  // 2x2; top/side = gamete labels (len 2); cells = 2x2 array of {g, cls}
  const o = 34, s = 46;
  let r = `<svg viewBox="0 0 130 130" class="gen-svg" role="img" aria-label="Punnett square">`;
  for (let c = 0; c < 2; c++) r += `<text x="${o + s / 2 + c * s}" y="22" class="gsv-plab">${top[c]}</text>`;
  for (let i = 0; i < 2; i++) r += `<text x="14" y="${o + s / 2 + i * s + 5}" class="gsv-plab">${side[i]}</text>`;
  for (let i = 0; i < 2; i++) for (let c = 0; c < 2; c++) {
    const x = o + c * s, y = o + i * s, cell = cells[i][c];
    r += `<rect x="${x}" y="${y}" width="${s}" height="${s}" class="gsv-pcell ${cell.cls}"/><text x="${x + s / 2}" y="${y + s / 2 + 5}" class="gsv-pgeno">${cell.g}</text>`;
  }
  return r + `</svg>`;
}
function gPedigree() {
  // affected mother (filled circle) x unaffected father (open square) -> all kids affected (maternal/mito pattern)
  return `<svg viewBox="0 0 220 110" class="gen-svg gen-svg-wide" role="img" aria-label="pedigree">`
    + `<circle cx="78" cy="22" r="11" class="gsv-aff"/><rect x="121" y="11" width="22" height="22" class="gsv-unaff"/>`
    + `<line x1="89" y1="22" x2="121" y2="22" class="gsv-pline"/><line x1="105" y1="22" x2="105" y2="52" class="gsv-pline"/>`
    + `<line x1="45" y1="52" x2="165" y2="52" class="gsv-pline"/>`
    + [45, 85, 125, 165].map((x, i) => `<line x1="${x}" y1="52" x2="${x}" y2="70" class="gsv-pline"/>` + (i % 2
      ? `<rect x="${x - 11}" y="70" width="22" height="22" class="gsv-aff"/>`
      : `<circle cx="${x}" cy="81" r="11" class="gsv-aff"/>`)).join('')
    + `<text x="110" y="105" class="gsv-pcap">affected mother \u2192 every child affected</text></svg>`;
}
function gRobertson() {
  return `<svg viewBox="0 0 220 120" class="gen-svg gen-svg-wide" role="img" aria-label="Robertsonian fusion">`
    + `<rect x="38" y="20" width="9" height="26" rx="4" class="gsv-chr"/><rect x="38" y="50" width="9" height="46" rx="4" class="gsv-chr"/><circle cx="42.5" cy="48" r="3" class="gsv-dot"/>`
    + `<rect x="74" y="26" width="9" height="20" rx="4" class="gsv-chr"/><rect x="74" y="50" width="9" height="40" rx="4" class="gsv-chr"/><circle cx="78.5" cy="48" r="3" class="gsv-dot"/>`
    + `<path d="M96 58 h26 m-8 -6 l8 6 l-8 6" class="gsv-arr2"/>`
    + `<rect x="150" y="22" width="9" height="74" rx="4" class="gsv-chr"/><rect x="161" y="22" width="9" height="74" rx="4" class="gsv-chr"/><circle cx="160" cy="44" r="3.2" class="gsv-dot"/>`
    + `<text x="60" y="112" class="gsv-pcap">2 acrocentrics</text><text x="160" y="112" class="gsv-pcap">1 fused</text></svg>`;
}
function gPathway(blocked) {
  const X = (bx) => `<line x1="${bx - 7}" y1="32" x2="${bx + 7}" y2="46" class="gsv-x"/><line x1="${bx + 7}" y1="32" x2="${bx - 7}" y2="46" class="gsv-x"/>`;
  let s = `<svg viewBox="0 0 252 66" class="gen-svg gen-svg-wide" role="img" aria-label="pigment pathway">`;
  s += `<rect x="4" y="26" width="56" height="26" rx="3" class="gsv-box"/><text x="32" y="42" class="gsv-boxt">precursor</text>`;
  s += `<path d="M62 39 h30 m-8 -4 l8 4 l-8 4" class="gsv-arr2"/><text x="77" y="20" class="gsv-enz">C enz</text>`;
  s += `<rect x="96" y="26" width="60" height="26" rx="3" class="gsv-box"/><text x="126" y="42" class="gsv-boxt">colorless</text>`;
  s += `<path d="M158 39 h30 m-8 -4 l8 4 l-8 4" class="gsv-arr2"/><text x="173" y="20" class="gsv-enz">P enz</text>`;
  s += `<rect x="192" y="26" width="56" height="26" rx="3" class="gsv-box gsv-box-p"/><text x="220" y="42" class="gsv-boxt">purple</text>`;
  if (blocked === 'C') s += X(77); if (blocked === 'P') s += X(173);
  return s + `</svg>`;
}
function gGrid(spec) {
  const fills = []; spec.forEach(s => { for (let k = 0; k < s.n; k++) fills.push(s.cls); });
  let cells = '';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const x = 8 + c * 25, y = 8 + r * 25, f = fills[r * 4 + c] || 'w'; cells += `<rect x="${x}" y="${y}" width="23" height="23" class="gsv-cell gsv-cell-${f}"/>`; }
  return `<svg viewBox="0 0 116 116" class="gen-svg" role="img" aria-label="dihybrid outcome grid">${cells}</svg>`;
}
function gCrossover() {
  const gam = (cx, lab, rec) => `<circle cx="${cx}" cy="74" r="16" class="gsv-gam ${rec ? 'ab' : 'norm'}"/><text x="${cx}" y="79" class="gsv-glab">${lab}</text>`;
  return `<svg viewBox="0 0 240 104" class="gen-svg gen-svg-wide" role="img" aria-label="crossing over to gametes">`
    + `<text x="120" y="16" class="gsv-pcap">crossover between linked genes A and B → gametes</text>`
    + gam(32, 'A B', false) + gam(86, 'a b', false) + gam(150, 'A b', true) + gam(206, 'a B', true)
    + `<text x="59" y="100" class="gsv-pcap">parental</text><text x="178" y="100" class="gsv-pcap">outlined</text></svg>`;
}
function gMap(genes, dists) {
  const n = genes.length, pad = 26, w = 252, step = (w - pad * 2) / (n - 1);
  let s = `<line x1="${pad}" y1="36" x2="${w - pad}" y2="36" class="gsv-mapline"/>`;
  genes.forEach((g, i) => { const x = pad + i * step; s += `<line x1="${x}" y1="28" x2="${x}" y2="44" class="gsv-maptick"/><text x="${x}" y="22" class="gsv-let">${g}</text>`; });
  dists.forEach((d, i) => { const x = pad + (i + 0.5) * step; s += `<text x="${x}" y="58" class="gsv-mapdist">${d} cM</text>`; });
  return `<svg viewBox="0 0 ${w} 66" class="gen-svg gen-svg-wide" role="img" aria-label="linkage map">${s}</svg>`;
}
function gPed(spec) {
  // spec: {mother:'aff'|'unaff'|'carrier', father:'aff'|'unaff'|'carrier', kids:[['c'|'s', class]], cap}
  const sym = (kind, cx, cy, cls) => kind === 's'
    ? `<rect x="${cx - 11}" y="${cy - 11}" width="22" height="22" class="gsv-${cls === 'aff' ? 'aff' : 'unaff'}"/>${cls === 'carrier' ? `<rect x="${cx - 3.5}" y="${cy - 3.5}" width="7" height="7" class="gsv-aff"/>` : ''}`
    : `<circle cx="${cx}" cy="${cy}" r="11" class="gsv-${cls === 'aff' ? 'aff' : 'unaff'}"/>${cls === 'carrier' ? `<circle cx="${cx}" cy="${cy}" r="3.5" class="gsv-aff"/>` : ''}`;
  const n = spec.kids.length, x0 = 110 - (n - 1) * 24 / 2;
  let s = sym('c', 80, 22, spec.mother) + sym('s', 142, 22, spec.father)
    + `<line x1="91" y1="22" x2="123" y2="22" class="gsv-pline"/><line x1="107" y1="22" x2="107" y2="50" class="gsv-pline"/>`
    + `<line x1="${x0}" y1="50" x2="${x0 + (n - 1) * 48}" y2="50" class="gsv-pline"/>`;
  spec.kids.forEach((k, i) => { const x = x0 + i * 48; s += `<line x1="${x}" y1="50" x2="${x}" y2="66" class="gsv-pline"/>` + sym(k[0], x, 80, k[1]); });
  return `<svg viewBox="0 0 220 108" class="gen-svg gen-svg-wide" role="img" aria-label="pedigree">${s}<text x="110" y="104" class="gsv-pcap">${spec.cap}</text></svg>`;
}
function gSeg(letters, mark, markCls) {
  const pad = 22, w = 240, step = (w - pad * 2) / (letters.length - 1);
  let s = '';
  letters.forEach((L, i) => { const x = pad + i * step, m = mark.includes(i); s += `<rect x="${x - 11}" y="22" width="22" height="22" class="gsv-seg ${m ? markCls : ''}"/><text x="${x}" y="37" class="gsv-segt">${L}</text>`; });
  return `<svg viewBox="0 0 ${w} 60" class="gen-svg gen-svg-wide" role="img" aria-label="chromosome segment">${s}</svg>`;
}
function gReciprocal() {
  return `<svg viewBox="0 0 200 120" class="gen-svg gen-svg-wide" role="img" aria-label="reciprocal translocation">`
    + `<rect x="60" y="14" width="11" height="60" rx="5" class="gsv-spec1"/><rect x="60" y="74" width="11" height="22" rx="5" class="gsv-spec2"/><circle cx="65.5" cy="72" r="3" class="gsv-dot"/>`
    + `<rect x="128" y="14" width="11" height="60" rx="5" class="gsv-spec2"/><rect x="128" y="74" width="11" height="22" rx="5" class="gsv-spec1"/><circle cx="133.5" cy="72" r="3" class="gsv-dot"/>`
    + `<text x="65" y="110" class="gsv-pcap">non-homologous</text><text x="133" y="110" class="gsv-pcap">chromosomes</text></svg>`;
}
function gSets(sets) {
  let x = 12, s = ''; const setW = 26;
  sets.forEach((cls) => { s += `<rect x="${x}" y="16" width="7" height="42" rx="3" class="gsv-set gsv-set-${cls}"/><rect x="${x + 10}" y="20" width="7" height="34" rx="3" class="gsv-set gsv-set-${cls}"/>`; x += setW + 8; });
  return `<svg viewBox="0 0 ${x} 72" class="gen-svg gen-svg-wide" role="img" aria-label="chromosome sets">${s}</svg>`;
}
function gKaryoTri() {
  let x = 16, s = '';
  const pair = (label, n) => { let g = ''; for (let k = 0; k < n; k++) { g += `<rect x="${x}" y="18" width="8" height="40" rx="4" class="gsv-chr ${n === 3 ? 'gsv-tri' : ''}"/>`; x += 11; } g += `<text x="${x - (n * 11) / 2 - 2}" y="70" class="gsv-pcap">${label}</text>`; x += 16; return g; };
  s += pair('1', 2) + pair('2', 2) + pair('21', 3);
  return `<svg viewBox="0 0 ${x} 78" class="gen-svg gen-svg-wide" role="img" aria-label="karyotype">${s}</svg>`;
}

function gCoupling(a, b) {
  const bar = (y, al) => `<rect x="38" y="${y}" width="176" height="12" rx="6" class="gsv-chr"/>`
    + `<line x1="92" y1="${y - 5}" x2="92" y2="${y + 17}" class="gsv-locus"/><line x1="160" y1="${y - 5}" x2="160" y2="${y + 17}" class="gsv-locus"/>`
    + `<text x="92" y="${y - 9}" class="gsv-al">${al[0]}</text><text x="160" y="${y - 9}" class="gsv-al">${al[1]}</text>`;
  return `<svg viewBox="0 0 252 96" class="gen-svg gen-svg-wide" role="img" aria-label="homologous chromosome pair">${bar(34, a)}${bar(70, b)}</svg>`;
}
function gBridge() {
  return `<svg viewBox="0 0 240 104" class="gen-svg gen-svg-wide" role="img" aria-label="dicentric bridge and acentric fragment">`
    + `<path d="M28 52 Q120 30 212 52" class="gsv-bridge"/>`
    + `<circle cx="82" cy="44" r="4" class="gsv-dot"/><circle cx="158" cy="44" r="4" class="gsv-dot"/>`
    + `<text x="120" y="22" class="gsv-pcap">pulled toward both poles → breaks</text>`
    + `<rect x="100" y="78" width="40" height="9" rx="4" class="gsv-frag"/>`
    + `<text x="120" y="100" class="gsv-pcap">loose fragment, no centromere</text></svg>`;
}
function gQuad() {
  const cx = 120, cy = 52;
  return `<svg viewBox="0 0 240 112" class="gen-svg gen-svg-wide" role="img" aria-label="translocation quadrivalent">`
    + `<rect x="${cx - 6}" y="12" width="12" height="30" rx="6" class="gsv-spec1"/>`
    + `<rect x="${cx - 6}" y="62" width="12" height="30" rx="6" class="gsv-spec1"/>`
    + `<rect x="14" y="${cy - 6}" width="30" height="12" rx="6" class="gsv-spec2"/>`
    + `<rect x="196" y="${cy - 6}" width="30" height="12" rx="6" class="gsv-spec2"/>`
    + `<circle cx="${cx}" cy="${cy - 11}" r="3.4" class="gsv-dot"/><circle cx="${cx}" cy="${cy + 11}" r="3.4" class="gsv-dot"/><circle cx="${cx - 11}" cy="${cy}" r="3.4" class="gsv-dot"/><circle cx="${cx + 11}" cy="${cy}" r="3.4" class="gsv-dot"/>`
    + `<text x="120" y="108" class="gsv-pcap">cross-shaped pairing in meiosis I</text></svg>`;
}
function gTriploid3() {
  let s = '';
  for (let k = 0; k < 3; k++) { const x = 86 + k * 16; s += `<rect x="${x}" y="20" width="9" height="54" rx="4" class="gsv-set gsv-set-1"/><circle cx="${x + 4.5}" cy="40" r="3" class="gsv-dot"/>`; }
  return `<svg viewBox="0 0 240 100" class="gen-svg gen-svg-wide" role="img" aria-label="three homologs">${s}<text x="120" y="92" class="gsv-pcap">three homologs of one chromosome (3n)</text></svg>`;
}

const GEN_DIAGRAMS = []; // Module 2 (Ch 4-6) cleared — drop new diagram questions here


/* ---------- generated + verified MCQ bank (injected at build) ---------- */
let GEN_GENERATED = [];   // loaded from data/genetics-bank.json

/* ---------- procedural calc generators (fresh numbers every time) ---------- */
function gRand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function gPick(a) { return a[Math.floor(Math.random() * a.length)]; }
function gOpts(correct, distractors) {
  const ds = [];
  for (const d of distractors) { if (d !== correct && !ds.includes(d) && ds.length < 3) ds.push(d); }
  let k = 0; while (ds.length < 3) ds.push(correct + ' ' + (++k));
  const all = genShuffle([correct].concat(ds));
  return { options: all, answer: all.indexOf(correct) };
}
const GEN_GENERATORS = []; // Module 2 (Ch 4-9) procedural generators cleared — Module 3 uses the static bank


let GEN_BANK = GEN_DIAGRAMS.concat(GEN_GENERATORS);   // GEN_GENERATED merged in after genLoadBank()

/* ---------- topic metadata (for weakness reporting) ---------- */
const GEN_TOPICS = {
  'ch10-rna-types': { name: 'RNA Types & Function', ch: 10, blurb: 'mRNA, tRNA, rRNA, snRNA, snoRNA, miRNA, siRNA, lncRNA; ribozymes.' },
  'ch10-transcription': { name: 'Transcription', ch: 10, blurb: "RNA polymerase, template vs coding strand, 5'->3' synthesis, sigma/holoenzyme." },
  'ch10-txunit': { name: 'Transcription Unit', ch: 10, blurb: 'Promoter, -35/-10 consensus, start site, rho-dependent/independent terminators.' },
  'ch10-processing': { name: 'RNA Processing', ch: 10, blurb: "5' cap, poly(A) tail + AAUAAA, splicing, introns/exons, spliceosome." },
  'ch10-colinearity': { name: 'Colinearity & Splicing', ch: 10, blurb: 'Colinear vs noncolinear genes, R-loops, alternative splicing.' },
  'ch10-trna': { name: 'tRNA Structure', ch: 10, blurb: 'Cloverleaf, acceptor arm (3′ CCA), anticodon arm, modified bases.' },
  'ch11-code': { name: 'The Genetic Code', ch: 11, blurb: 'Codons, degeneracy, wobble, reading frame, start/stop codons.' },
  'ch11-charging': { name: 'tRNA Charging', ch: 11, blurb: 'Aminoacyl-tRNA synthetase, charging, isoaccepting tRNAs, codon-anticodon pairing.' },
  'ch11-initiation': { name: 'Translation Initiation', ch: 11, blurb: 'IF1/IF2/IF3, fMet-tRNA, Shine-Dalgarno, 30S/70S initiation complex.' },
  'ch11-elong-term': { name: 'Elongation & Termination', ch: 11, blurb: 'EF-Tu/EF-Ts/EF-G, A/P/E sites, peptidyl transferase, release factors.' },
  'ch11-ribosome': { name: 'Ribosomes & Protein Fate', ch: 11, blurb: 'Subunits/rRNA, chaperones, prokaryotic vs eukaryotic translation.' },
  'ch12-operon': { name: 'Operon Logic', ch: 12, blurb: 'Operon structure, structural vs regulatory genes, cis vs trans acting.' },
  'ch12-control': { name: 'Positive & Negative Control', ch: 12, blurb: 'Repressor/activator, inducible vs repressible operons.' },
  'ch12-lac': { name: 'lac Operon', ch: 12, blurb: 'lacZYA, allolactose, Lac repressor, CAP/cAMP catabolite repression.' },
  'ch12-lacgeno': { name: 'lac Genotypes & Diploids', ch: 12, blurb: 'lacI/lacIˢ/lacOᶜ mutants, partial diploids (F′), constitutive vs inducible.' },
  'ch12-trp': { name: 'trp Operon & Attenuation', ch: 12, blurb: 'trp repressor + tryptophan corepressor, attenuation/leader region.' },
  'ch12-eukreg': { name: 'Eukaryotic Regulation', ch: 12, blurb: 'Chromatin remodeling, enhancers, insulators, transcription factors.' },
  'ch12-epigenetics': { name: 'Epigenetics', ch: 12, blurb: 'DNA methylation, histone acetylation, imprinting (Beckwith-Wiedemann).' },
  'ch12-ncrna': { name: 'Regulatory RNAs', ch: 12, blurb: 'miRNA/siRNA/RNAi, Dicer, gene silencing.' },
};

const GEN_CH = { 10: 'RNA & Transcription', 11: 'Translation', 12: 'Gene Regulation' };

/* ---------- state + persistence ---------- */
const GEN_KEY = 'cs-genetics';
const GEN_PASS = 'genetics';
// Bump when the genetics module content is swapped -> XP/rank/mastery reset fresh for the new module.
const GEN_MODULE = 'm3-ch10-12';
function genLoad() { try { return JSON.parse(localStorage.getItem(GEN_KEY)) || {}; } catch { return {}; } }
let GEN = Object.assign({
  unlocked: false, module: '', xp: 0, answered: 0, correct: 0,
  bestScore: 0, bestCombo: 0, bestExam: 0, plays: 0,
  streak: { current: 0, longest: 0, lastDate: '' },
  q: {},            // qid -> { box: 0..5, a, c, ts }
  ach: [], examReady: false, starred: {}, learned: {},
}, genLoad());
// Module changed since last visit -> wipe progress so rank/XP/mastery reflect THIS module only (keep unlock).
if (GEN.module !== GEN_MODULE) {
  GEN = {
    unlocked: GEN.unlocked, module: GEN_MODULE,
    xp: 0, answered: 0, correct: 0, bestScore: 0, bestCombo: 0, bestExam: 0, plays: 0,
    streak: { current: 0, longest: 0, lastDate: '' },
    q: {}, ach: [], examReady: false, starred: {}, learned: {},
  };
  try { localStorage.setItem(GEN_KEY, JSON.stringify(GEN)); } catch {}
}
function genSave() { try { localStorage.setItem(GEN_KEY, JSON.stringify(GEN)); } catch {} }

/* ---------- anonymous usage analytics (research) ----------
   Write-only to Supabase `usage_events`. No names / PII — a random per-browser id
   only. Fire-and-forget; never blocks or breaks the UI if offline/unconfigured.   */
function genRandId() {
  try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch {}
  return 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
const GA_ANON = (() => { try { let a = localStorage.getItem('cs-anon-id'); if (!a) { a = genRandId(); localStorage.setItem('cs-anon-id', a); } return a; } catch { return genRandId(); } })();
const GA_SESSION = genRandId();
let GA_sessionLogged = false;
function genTrack(event, props) {
  try {
    const sb = window.__cortexSB;
    if (!sb || !sb.from) return;
    sb.from('usage_events').insert({
      anon_id: GA_ANON,
      session_id: GA_SESSION,
      app_version: (typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''),
      section: 'genetics',
      event,
      props: props || {},
    }).then(() => {}, () => {});   // fire-and-forget
  } catch {}
}

let genTimer = null;
let genKeyHandler = null;
function genUnbindKey() { if (genKeyHandler) { document.removeEventListener('keydown', genKeyHandler); genKeyHandler = null; } }
function genBindKey(fn) { genUnbindKey(); genKeyHandler = fn; document.addEventListener('keydown', fn); }
// every view transition runs genClearTimer() first, so this is the single chokepoint that
// also tears down the previous question's keydown handler (prevents stale-handler leaks).
function genClearTimer() { if (genTimer) { clearInterval(genTimer); genTimer = null; } genUnbindKey(); }

/* ---------- spaced-repetition box model ---------- */
const GEN_INTERVAL_H = [0, 0.3, 4, 24, 72, 168]; // Leitner review intervals (hours) by box
function genQ(id) { return GEN.q[id] || (GEN.q[id] = { box: 0, a: 0, c: 0, ts: 0 }); }
function genBox(id) { return (GEN.q[id] && GEN.q[id].box) || 0; }
function genComp(list) { if (!list.length) return 0; return Math.round(list.reduce((s, q) => s + genBox(q.id), 0) / (list.length * 5) * 100); }
function genChapterQs(ch) { return GEN_BANK.filter(q => q.chapter === ch); }
function genTopicQs(t) { return GEN_BANK.filter(q => q.topic === t); }
function genMastery(ch) { return genComp(genChapterQs(ch)); }
function genOverall() { return genComp(GEN_BANK); }
function genAccuracy() { return GEN.answered ? Math.round(GEN.correct / GEN.answered * 100) : 0; }

function genStatus() {
  const c = genOverall();
  if (c >= 90) return { c, label: 'EXAM READY', cls: 'ready' };
  if (c >= 75) return { c, label: 'Almost exam ready', cls: 'almost' };
  if (c >= 50) return { c, label: 'Solid progress', cls: 'building' };
  if (c > 0) return { c, label: 'Getting started', cls: 'start' };
  return { c, label: 'Not started', cls: 'none' };
}

/* weakest topics first (only count topics that exist in the bank) */
function genWeakTopics() {
  return Object.keys(GEN_TOPICS)
    .map(t => { const qs = genTopicQs(t); return { topic: t, name: GEN_TOPICS[t].name, ch: GEN_TOPICS[t].ch, comp: genComp(qs), n: qs.length, seen: qs.filter(q => { const r = GEN.q[q.id]; return r && r.a > 0; }).length }; })
    .filter(x => x.n > 0)
    .sort((a, b) => a.comp - b.comp || b.n - a.n);
}

/* adaptive selection: weak + unseen + due-for-review, interleaved */
function genSmartPool(n) {
  const now = Date.now();
  const scored = GEN_BANK.map(q => {
    const r = GEN.q[q.id], box = r ? r.box : 0, ts = r ? r.ts : 0;
    const ageH = ts ? (now - ts) / 3.6e6 : 1e6;
    const due = box === 0 || ageH >= GEN_INTERVAL_H[box];
    const pr = (5 - box) * 12 + (box === 0 ? 40 : 0) + (due ? 8 : -40) + Math.random() * 6;
    return { q, pr };
  });
  scored.sort((a, b) => b.pr - a.pr);
  return genShuffle(scored.slice(0, Math.max(n, 1)).map(s => s.q)); // interleave the chosen set
}

function genShuffle(a) { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }

/* ---------- ranks ---------- */
const GEN_RANKS = [
  { min: 0, name: 'Wild-Type' }, { min: 150, name: 'Heterozygote' }, { min: 400, name: 'Carrier' },
  { min: 800, name: 'Recombinant' }, { min: 1400, name: 'Crossover Artist' }, { min: 2200, name: 'Mapmaker' },
  { min: 3200, name: 'Karyotyper' }, { min: 4500, name: 'Geneticist' }, { min: 6200, name: 'Chromosome Sage' },
  { min: 8500, name: "Mendel's Heir" },
];
function genRank(xp) {
  let idx = 0; for (let i = 0; i < GEN_RANKS.length; i++) if (xp >= GEN_RANKS[i].min) idx = i;
  const cur = GEN_RANKS[idx], next = GEN_RANKS[idx + 1] || null;
  const span = next ? next.min - cur.min : 1, into = next ? xp - cur.min : 1;
  return { lvl: idx + 1, name: cur.name, pct: next ? Math.max(2, Math.round(into / span * 100)) : 100, toNext: next ? next.min - xp : 0, next: next ? next.min : null };
}

/* ---------- achievements ---------- */
const GEN_ACH = [
  { id: 'first', name: 'First Strand', desc: 'Answer your first question' },
  { id: 'combo5', name: 'On Fire', desc: 'Reach a 5× combo' },
  { id: 'combo10', name: 'Chain Reaction', desc: 'Reach a 10× combo' },
  { id: 'blitz500', name: 'Blitz Master', desc: 'Score 500+ in one Blitz' },
  { id: 'smart', name: 'Study Smart', desc: 'Finish a Smart Review session' },
  { id: 'perfect', name: 'Flawless', desc: 'Finish a run 100% correct (8+ Q)' },
  { id: 'txn', name: 'Transcriptionist', desc: 'Reach 100% on Transcription' },
  { id: 'code', name: 'Codebreaker', desc: 'Reach 100% on the Genetic Code' },
  { id: 'lac', name: 'Operon Operator', desc: 'Reach 100% on the lac Operon' },
  { id: 'exam', name: 'Exam Slayer', desc: 'Beat the Exam Boss (85%+)' },
  { id: 'ready', name: 'Exam Ready', desc: 'Hit 90% overall competency' },
  { id: 'geneticist', name: 'Certified Geneticist', desc: 'Reach the Geneticist level' },
];
function genGrant(id) {
  if (GEN.ach.includes(id)) return;
  GEN.ach.push(id); genSave();
  const a = GEN_ACH.find(x => x.id === id);
  if (a) genToast(`Achievement unlocked · ${a.name}`);
}
function genToast(msg) {
  const t = el(`<div class="gen-toast">${esc(msg)}</div>`);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 350); }, 2300);
}
function genCheckAch() {
  if (genComp(genTopicQs('ch10-transcription')) >= 100) genGrant('txn');
  if (genComp(genTopicQs('ch11-code')) >= 100) genGrant('code');
  if (genComp(genTopicQs('ch12-lac')) >= 100) genGrant('lac');
  if (genRank(GEN.xp).lvl >= 8) genGrant('geneticist');
  if (genOverall() >= 90) { genGrant('ready'); if (!GEN.examReady) { GEN.examReady = true; genSave(); genTrack('milestone', { kind: 'exam_ready', competency: genOverall() }); } }
}

function genBumpStreak() {
  const d = new Date(), today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const s = GEN.streak; if (s.lastDate === today) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  s.current = s.lastDate === `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}` ? s.current + 1 : 1;
  s.lastDate = today; if (s.current > s.longest) s.longest = s.current;
}

/* record an answered question; updates box + xp */
function genRecord(qq, right) {
  GEN.answered++; if (right) GEN.correct++;
  const r = genQ(qq.id); r.a++; r.ts = Date.now();
  if (right) { r.c++; r.box = Math.min(5, r.box + 1); r.lastWrong = false; } else { r.box = Math.max(0, r.box - 1); r.lastWrong = true; }
  const diff = qq.difficulty === 'hard' ? 6 : qq.difficulty === 'med' ? 3 : 0;
  const xp = right ? 10 + (qq.type === 'calc' ? 5 : qq.type === 'label' ? 3 : 0) + diff : 1;
  GEN.xp += xp;
  if (!GEN.ach.includes('first')) genGrant('first');
  return xp;
}

/* ============================================================================
   ENTRY + PASSWORD GATE
   ========================================================================= */
let genBankReady = false, genBankFailed = false;
function genValidBankItem(q, seen) {
  return q && typeof q === 'object'
    && typeof q.id === 'string' && q.id && !seen.has(q.id)
    && typeof q.q === 'string' && q.q
    && typeof q.topic === 'string' && Object.prototype.hasOwnProperty.call(GEN_TOPICS, q.topic)
    && Array.isArray(q.options) && q.options.length === 4 && q.options.every(o => typeof o === 'string' && o.length)
    && Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3
    && typeof q.explain === 'string' && typeof q.hint === 'string';
}
async function genLoadBank() {
  try {
    const r = await fetch('data/genetics-bank.json?v=3');
    if (!r.ok) throw new Error('http ' + r.status);
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error('bad bank');   // an empty array is valid (no content yet)
    const seen = new Set(GEN_DIAGRAMS.concat(GEN_GENERATORS).map(q => q.id)), valid = [];
    for (const q of data) {
      if (!genValidBankItem(q, seen)) continue;
      seen.add(q.id);
      if (q.type !== 'concept' && q.type !== 'calc' && q.type !== 'label') q.type = 'concept';
      if (q.difficulty !== 'easy' && q.difficulty !== 'med' && q.difficulty !== 'hard') q.difficulty = 'med';
      valid.push(q);
    }
    if (data.length && !valid.length) throw new Error('no valid bank items');   // non-empty but all malformed -> failure screen
    GEN_GENERATED = valid;
    GEN_BANK = GEN_DIAGRAMS.concat(GEN_GENERATED).concat(GEN_GENERATORS);
    genBankReady = true; genBankFailed = false;
  } catch (e) { genBankFailed = true; }
}
function genLoadingScreen() {
  const root = el('<div></div>'); root.appendChild(topbar('genetics'));
  root.appendChild(el('<main class="panel gen-lock" id="main" tabindex="-1"><div class="gen-lock-box cornerframe"><span class="label">Genetics-2313-01E</span><p class="gen-lock-sub">Loading questions…</p></div></main>'));
  root.appendChild(siteFooter()); setView(root);
}
function genBankError() {
  const root = el('<div></div>'); root.appendChild(topbar('genetics'));
  const main = el('<main class="panel gen-lock" id="main" tabindex="-1"><div class="gen-lock-box cornerframe"><span class="label">Genetics-2313-01E</span><p class="gen-lock-sub">Couldn\'t load the question bank — check your connection.</p><button class="btn btn-solid" id="gen-retry">Retry</button></div></main>');
  main.querySelector('#gen-retry').addEventListener('click', () => { genBankFailed = false; renderGenetics(); });
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}
function renderGenetics() {
  genClearTimer();
  if (!genBankReady) {
    if (genBankFailed) { genBankError(); return; }
    genLoadingScreen();
    genLoadBank().then(renderGenetics);
    return;
  }
  if (!GEN_BANK.length) { renderGenEmpty(); return; }
  if (GEN.unlocked) { renderGenHome(); return; }
  renderGenPassword();
}

function renderGenEmpty() {
  genClearTimer();
  const root = el('<div></div>'); root.appendChild(topbar('genetics'));
  const main = el(`<main class="panel gen-lock" id="main" tabindex="-1"><div class="gen-lock-box cornerframe"><span class="label">Genetics-2313-01E</span><h1 class="gen-lock-title">Coming soon</h1><p class="gen-lock-sub">This module is finished and its questions have been cleared. New course material will appear here once it's added.</p></div></main>`);
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}
function renderGenPassword(errMsg) {
  const root = el('<div></div>');
  root.appendChild(topbar('genetics'));
  const main = el(`<main class="panel gen-lock" id="main" tabindex="-1">
    <div class="gen-lock-box cornerframe">
      <span class="label">UTSA · Genetics · Module 3</span>
      <h1 class="gen-lock-title">Genetics-2313-01E</h1>
      <p class="gen-lock-sub">Module 3 (Ch 10-12): RNA &amp; transcription, translation, and gene regulation. Mastery trainer, locked to a class passphrase.</p>
      <form id="gen-pass-form" class="gen-pass-form" autocomplete="off">
        <input type="password" id="gen-pass" class="gen-pass-input" placeholder="Enter passphrase" aria-label="Passphrase" />
        <button type="submit" class="btn btn-solid">Unlock</button>
      </form>
      ${errMsg ? `<p class="gen-pass-err">${esc(errMsg)}</p>` : ''}
      <p class="gen-priv">Anonymous usage data (how often modes are used and which questions are hardest — no names or personal info) is collected to improve this tool and support educational research.</p>
    </div>
  </main>`);
  main.querySelector('#gen-pass-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (main.querySelector('#gen-pass').value || '').trim().toLowerCase();
    if (val === GEN_PASS) { GEN.unlocked = true; genSave(); genTrack('unlock', {}); renderGenHome(); }
    else renderGenPassword('Incorrect passphrase. Try again.');
  });
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
  setTimeout(() => { const i = document.querySelector('#gen-pass'); if (i) i.focus(); }, 30);
}

/* ============================================================================
   HOME / DASHBOARD
   ========================================================================= */
function renderGenHome() {
  genClearTimer();
  if (!GA_sessionLogged) { GA_sessionLogged = true; genTrack('session_start', { competency: genOverall(), mastered: GEN_BANK.filter(q => genBox(q.id) >= 5).length, total: GEN_BANK.length, mobile: (window.innerWidth || 0) < 700 }); }
  const rank = genRank(GEN.xp), status = genStatus();
  const missCount = genMissPool().length, starredCount = genStarredList().length;
  const weak = genWeakTopics();
  const meter = (ch) => `<div class="gen-meter">
      <div class="gen-meter-top"><span>Ch ${ch} · ${GEN_CH[ch]}</span><span class="mono">${genMastery(ch)}%</span></div>
      <div class="gen-bar"><span style="width:${genMastery(ch)}%"></span></div>
    </div>`;
  const weakItems = weak.slice(0, 3).map(w => `<button class="gen-weak-row" data-topic="${w.topic}">
      <span class="gen-weak-name">${esc(w.name)}</span>
      <span class="gen-weak-bar"><span style="width:${w.comp}%"></span></span>
      <span class="mono gen-weak-pct">${w.comp}%</span>
    </button>`).join('');

  const root = el('<div></div>');
  root.appendChild(topbar('genetics'));
  const main = el(`<main class="panel gen-home" id="main" tabindex="-1">
    ${status.cls === 'ready' ? `<div class="gen-ready-banner"><span class="gen-ready-pulse"></span>EXAM READY · ${status.c}% competency</div>` : ''}

    <header class="gen-hero cornerframe">
      <div class="gen-hero-l">
        <span class="label">UTSA · Genetics · Module 3 (Ch 10-12)</span>
        <h1>Genetics-2313-01E</h1>
        <div class="gen-rank"><span class="gen-rank-lvl mono">LV ${rank.lvl}</span><span class="gen-rank-name">${esc(rank.name)}</span></div>
        <div class="gen-xpbar"><span style="width:${rank.pct}%"></span></div>
        <p class="gen-xp-note mono">${GEN.xp.toLocaleString()} XP${rank.next ? ` · ${rank.toNext.toLocaleString()} to next level` : ' · MAX'}</p>
      </div>
      <div class="gen-hero-r">
        <div class="gen-comp-ring gen-comp-${status.cls}">
          <span class="gen-comp-num mono">${status.c}%</span><span class="gen-comp-lab">competency</span>
        </div>
        <span class="gen-comp-status gen-comp-${status.cls}">${status.label}</span>
      </div>
    </header>

    <div class="gen-statrow">
      <div class="gen-stat"><span class="gen-stat-n mono">${GEN.streak.current}</span><span class="gen-stat-l">Day streak</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${genAccuracy()}%</span><span class="gen-stat-l">Accuracy</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${GEN.bestScore}</span><span class="gen-stat-l">Best blitz</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${GEN.bestCombo}×</span><span class="gen-stat-l">Best combo</span></div>
    </div>

    <section class="gen-modes">
      <button class="gen-mode-card gen-mode-workshop cornerframe" data-mode="workshop">
        <span class="gen-mode-tag">instructor packet · verbatim</span>
        <h2>Module 4 Workshop</h2>
        <p>Your professor's own Chapters 10–12 workshop, reproduced word for word — every MCQ, short answer, fill-in, matching, and the operon tables — plus the packet's hand-labeled figures rebuilt as interactive diagrams.</p>
        <span class="gen-mode-go">Open the workshop →</span>
      </button>
      <button class="gen-mode-card gen-mode-learn cornerframe" data-mode="learn">
        <span class="gen-mode-tag">guided · teaches you</span>
        <h2>Learn</h2>
        <p>New to a topic, or it just won't stick? Work through it the Socratic way — a question, your reasoning, then the idea — with interactive diagrams you build and step through.</p>
        <span class="gen-mode-go">Open lessons →</span>
      </button>
      <button class="gen-mode-card gen-mode-hero cornerframe" data-mode="smart">
        <span class="gen-mode-tag">recommended · endless</span>
        <h2>Smart Review</h2>
        <p>Endless adaptive loop — keeps feeding you your weakest questions (spaced repetition + interleaving) until every one is mastered. Just keep going.</p>
        <span class="gen-mode-go">Study →</span>
      </button>
      <button class="gen-mode-card cornerframe" data-mode="blitz">
        <span class="gen-mode-tag">90s · combo</span>
        <h2>Blitz</h2>
        <p>Rapid-fire across the whole chapter. Stack combos, chase your high score.</p>
        <span class="gen-mode-go">Start →</span>
      </button>
      <button class="gen-mode-card cornerframe" data-mode="chapter">
        <span class="gen-mode-tag">untimed · learn</span>
        <h2>Topic Drills</h2>
        <p>Pick one topic and work through it with full explanations until the meter fills.</p>
        <span class="gen-mode-go">Choose →</span>
      </button>
      <button class="gen-mode-card cornerframe" data-mode="exam">
        <span class="gen-mode-tag">20 Q · 3 lives</span>
        <h2>Exam Boss</h2>
        <p>Mixed Ch 10-12 gauntlet. Beat 85% to slay the boss.${GEN.bestExam ? ` Best: ${GEN.bestExam}%.` : ''}</p>
        <span class="gen-mode-go">Fight →</span>
      </button>
      <button class="gen-mode-card cornerframe" data-mode="misses">
        <span class="gen-mode-tag">targeted</span>
        <h2>Review Misses</h2>
        <p>Drill only the questions you've gotten wrong, with hints, until they stick.${missCount ? ` ${missCount} waiting.` : ''}</p>
        <span class="gen-mode-go">Review →</span>
      </button>
    </section>

    <div class="gen-cols">
      <section class="gen-weak cornerframe">
        <span class="label">Your weak spots — focus here</span>
        ${weak.some(w => w.seen > 0) ? weakItems : '<p class="gen-weak-empty">Answer some questions and your weakest topics will surface here with a one-tap drill.</p>'}
        <button class="btn btn-solid gen-weak-cta" data-mode="smart">Drill my weak spots</button>
      </section>

      <section class="gen-mastery cornerframe">
        <span class="label">Chapter mastery</span>
        ${meter(10)}${meter(11)}${meter(12)}
      </section>
    </div>

    <div class="gen-utils">
      <button class="ghostbtn" data-mode="stats">View stats →</button>
      <button class="ghostbtn" data-mode="starred">★ Starred (${starredCount})</button>
    </div>

    <section class="gen-method cornerframe">
      <span class="label">How to study this (science-backed) · exam soon?</span>
      <ol class="gen-method-list">
        <li><b>Test, don't reread.</b> Retrieval practice (answering) builds memory far better than review — this whole arcade is active recall.</li>
        <li><b>Run Smart Review daily.</b> Spaced repetition resurfaces each item right before you'd forget it; the box meter handles the timing.</li>
        <li><b>Interleave.</b> Blitz and Smart Review mix topics on purpose — switching topics beats blocking one at a time.</li>
        <li><b>Chase your weak spots,</b> not what you already know. Exam soon? Topic Drills on your weakest topics → Smart Review until 90% → Exam Boss to pressure-test.</li>
      </ol>
    </section>

    <section class="gen-trophy cornerframe">
      <span class="label">Achievements · ${GEN.ach.length}/${GEN_ACH.length}</span>
      <div class="gen-badges">
        ${GEN_ACH.map(a => { const got = GEN.ach.includes(a.id); return `<div class="gen-badge ${got ? 'got' : ''}" title="${esc(a.desc)}"><span class="gen-badge-name">${esc(a.name)}</span><span class="gen-badge-desc">${esc(a.desc)}</span></div>`; }).join('')}
      </div>
    </section>

    <p class="gen-foot-note">${GEN_BANK.length} questions${GEN_DIAGRAMS.length ? ` (incl. ${GEN_DIAGRAMS.length} diagram-labeling)` : ''} · Module 3 · Chapters 10-12 (RNA, transcription, translation &amp; gene regulation). <button class="ghostbtn" id="gen-reset">Reset arcade progress</button></p>
  </main>`);

  main.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    const m = b.dataset.mode;
    if (m === 'workshop') { if (typeof renderGenWorkshop === 'function') renderGenWorkshop(); }
    else if (m === 'learn') renderGenLearnHome();
    else if (m === 'smart') startGenSmart();
    else if (m === 'blitz') startGenBlitz();
    else if (m === 'chapter') renderGenChapterPick();
    else if (m === 'exam') startGenExam();
    else if (m === 'misses') startGenMisses();
    else if (m === 'stats') renderGenStats();
    else if (m === 'starred') startGenStarred();
  }));
  main.querySelectorAll('[data-topic]').forEach(b => b.addEventListener('click', () => startGenTopic(b.dataset.topic)));
  main.querySelector('#gen-reset').addEventListener('click', () => {
    if (!confirm('Reset all Genetics-2313-01E progress (XP, mastery, achievements)? You stay unlocked.')) return;
    GEN = Object.assign({ unlocked: true, xp: 0, answered: 0, correct: 0, bestScore: 0, bestCombo: 0, bestExam: 0, plays: 0, streak: { current: 0, longest: 0, lastDate: '' }, q: {}, starred: {}, learned: {}, ach: [], examReady: false });
    genSave(); renderGenHome();
  });
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

/* ============================================================================
   CHAPTER PICKER
   ========================================================================= */
function renderGenChapterPick() {
  genClearTimer();
  const card = (key) => { const t = GEN_TOPICS[key], qs = genTopicQs(key); return `<button class="gen-ch-card cornerframe" data-topic="${key}">
    <span class="gen-ch-num mono">CH ${t.ch}</span><h2>${esc(t.name)}</h2><p>${esc(t.blurb)}</p>
    <div class="gen-meter"><div class="gen-bar"><span style="width:${genComp(qs)}%"></span></div></div>
    <span class="mono gen-ch-pct">${genComp(qs)}% · ${qs.length} Q</span></button>`; };
  const root = el('<div></div>');
  root.appendChild(topbar('genetics'));
  const main = el(`<main class="panel gen-pick" id="main" tabindex="-1">
    <div class="gen-pick-head"><button class="ghostbtn" id="gen-back">← Home</button><h1>Topic Drills</h1></div>
    <div class="gen-ch-grid">
      ${Object.keys(GEN_TOPICS).map(card).join('')}
    </div>
  </main>`);
  main.querySelector('#gen-back').addEventListener('click', renderGenHome);
  main.querySelectorAll('[data-topic]').forEach(b => b.addEventListener('click', () => startGenTopic(b.dataset.topic)));
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

/* ============================================================================
   GAME RUNS
   ========================================================================= */
function startGenSmart() {
  genBumpStreak(); GEN.plays++; genSave();
  // Endless adaptive loop: serve the single most-needed (weakest/due/unseen) question
  // each time, forever, until every question is fully mastered (box 5).
  genTrack('mode_start', { mode: 'smart' });
  genRunQuestion({ mode: 'smart', endless: true, pool: [], retryQ: [], idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false, lastId: null, lastTopic: null });
}
function startGenBlitz() {
  genBumpStreak(); GEN.plays++; genSave();
  genTrack('mode_start', { mode: 'blitz' });
  genRunQuestion({ mode: 'blitz', pool: genShuffle(GEN_BANK), idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, timeLeft: 90, locked: false });
}
function startGenChapter(ch) {
  GEN.plays++; genSave();
  genTrack('mode_start', { mode: 'chapter', chapter: ch });
  genRunQuestion({ mode: 'chapter', chapter: ch, pool: genShuffle(genChapterQs(ch)), idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false });
}
function startGenTopic(t) {
  GEN.plays++; genSave();
  genTrack('mode_start', { mode: 'topic', topic: t });
  genRunQuestion({ mode: 'topic', topic: t, pool: genShuffle(genTopicQs(t)), idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false });
}
function startGenExam() {
  genBumpStreak(); GEN.plays++; genSave();
  const chs = Object.keys(GEN_CH).map(Number);
  const per = Math.ceil(20 / Math.max(1, chs.length));
  let pool = [];
  chs.forEach(ch => { pool = pool.concat(genShuffle(genChapterQs(ch)).slice(0, per)); });
  pool = genShuffle(pool).slice(0, 20);
  if (pool.length < 20) { const have = new Set(pool.map(q => q.id)); pool = pool.concat(genShuffle(GEN_BANK).filter(q => !have.has(q.id)).slice(0, 20 - pool.length)); }
  genTrack('mode_start', { mode: 'exam' });
  genRunQuestion({ mode: 'exam', pool, idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, lives: 3, locked: false });
}
/* ---------- review misses, starred, stats ---------- */
function genMissPool() { return GEN_BANK.filter(q => { const r = GEN.q[q.id]; return r && r.a > 0 && (r.lastWrong || r.box <= 2); }); }
function genStarredList() { return GEN_BANK.filter(q => GEN.starred && GEN.starred[q.id]); }
function genToggleStar(id) { if (!GEN.starred) GEN.starred = {}; if (GEN.starred[id]) delete GEN.starred[id]; else GEN.starred[id] = 1; genSave(); return !!GEN.starred[id]; }
function genEmpty(title, msg) {
  genClearTimer();
  const root = el('<div></div>'); root.appendChild(topbar('genetics'));
  const main = el(`<main class="panel gen-result" id="main" tabindex="-1"><div class="gen-res-box cornerframe"><span class="label">${esc(title)}</span><p class="gen-empty-msg">${esc(msg)}</p><div class="gen-res-btns"><button class="btn btn-solid" id="gen-homebtn">Back to home</button></div></div></main>`);
  main.querySelector('#gen-homebtn').addEventListener('click', renderGenHome);
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}
function startGenMisses() {
  const pool = genShuffle(genMissPool());
  if (!pool.length) { genEmpty('Review misses', 'No misses to review right now — nice work. Play a mode to surface your weak spots, then come back.'); return; }
  GEN.plays++; genSave();
  genRunQuestion({ mode: 'misses', pool, idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false });
}
function startGenStarred() {
  const pool = genShuffle(genStarredList());
  if (!pool.length) { genEmpty('Starred questions', "You haven't starred any questions yet. Tap the star on any question to save it here for later."); return; }
  GEN.plays++; genSave();
  genRunQuestion({ mode: 'starred', pool, idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false });
}
function renderGenStats() {
  genClearTimer();
  const topicRows = Object.keys(GEN_TOPICS).map(t => {
    const qs = genTopicQs(t); if (!qs.length) return '';
    let a = 0, c = 0, m = 0; qs.forEach(q => { const r = GEN.q[q.id]; if (r) { a += r.a; c += r.c; if (r.box >= 4) m++; } });
    const acc = a ? Math.round(c / a * 100) : 0;
    return `<div class="gen-srow"><span class="gen-srow-name">${esc(GEN_TOPICS[t].name)}</span><span class="gen-srow-bar"><span style="width:${genComp(qs)}%"></span></span><span class="mono gen-srow-vals">${genComp(qs)}% · ${acc}% acc · ${m}/${qs.length}</span></div>`;
  }).join('');
  const maxed = GEN_BANK.filter(q => GEN.q[q.id] && GEN.q[q.id].box >= 5).length;
  const root = el('<div></div>'); root.appendChild(topbar('genetics'));
  const main = el(`<main class="panel gen-pick" id="main" tabindex="-1">
    <div class="gen-pick-head"><button class="ghostbtn" id="gen-back">← Home</button><h1>Your stats</h1></div>
    <div class="gen-statrow">
      <div class="gen-stat"><span class="gen-stat-n mono">${genOverall()}%</span><span class="gen-stat-l">Competency</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${genAccuracy()}%</span><span class="gen-stat-l">Accuracy</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${GEN.answered.toLocaleString()}</span><span class="gen-stat-l">Answered</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${maxed}/${GEN_BANK.length}</span><span class="gen-stat-l">Maxed out</span></div>
    </div>
    <section class="gen-mastery cornerframe"><span class="label">By topic — competency · accuracy · strong</span>${topicRows}</section>
    <div class="gen-res-btns gen-stats-actions"><button class="btn" id="gen-misses2">Review my misses (${genMissPool().length})</button><button class="btn" id="gen-starred2">★ Starred (${genStarredList().length})</button></div>
  </main>`);
  main.querySelector('#gen-back').addEventListener('click', renderGenHome);
  main.querySelector('#gen-misses2').addEventListener('click', startGenMisses);
  main.querySelector('#gen-starred2').addEventListener('click', startGenStarred);
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

function genComboMult(combo) { return Math.min(5, 1 + Math.floor(combo / 3)); }

// Endless Smart Review: pick the one most-needed question right now. Weakest box
// first, then due-for-review, lightly interleaved, never the same one twice in a row.
// Returns null once everything is fully mastered (box 5).
function genNextSmart(run) {
  // In-session requeue (Quizlet-style): a missed question cycles back within 2-3 questions,
  // ahead of the normal adaptive pick, and reappears with its "think it through" hint.
  if (run.retryQ && run.retryQ.length) {
    const i = run.retryQ.findIndex(r => r.due <= run.answered);
    if (i >= 0) { const r = run.retryQ.splice(i, 1)[0]; run.lastId = r.q.id; run.lastTopic = r.q.topic; return r.q; }
  }
  const now = Date.now();
  const pool = GEN_BANK.filter(q => genBox(q.id) < 5);
  if (!pool.length) {
    // everything mastered but a retry is still pending -> serve it rather than ending
    if (run.retryQ && run.retryQ.length) { const r = run.retryQ.shift(); run.lastId = r.q.id; run.lastTopic = r.q.topic; return r.q; }
    return null;
  }
  let best = null, bestPr = -1e9;
  for (const q of pool) {
    const r = GEN.q[q.id], box = r ? r.box : 0, ts = r ? r.ts : 0;
    const ageH = ts ? (now - ts) / 3.6e6 : 1e6;
    const due = box === 0 || ageH >= GEN_INTERVAL_H[box];
    let pr = (5 - box) * 12 + (box === 0 ? 30 : 0) + (due ? 8 : -30) + Math.random() * 6;
    if (q.id === run.lastId) pr -= 100;                         // no immediate repeat
    if (run.lastTopic && q.topic === run.lastTopic) pr -= 4;    // light interleaving
    if (pr > bestPr) { bestPr = pr; best = q; }
  }
  run.lastId = best.id; run.lastTopic = best.topic;
  return best;
}

function genSmartComplete(run) {
  genClearTimer(); genGrant('smart'); genCheckAch(); genSave();
  genTrack('milestone', { kind: 'fully_mastered' });
  genTrack('run_end', { mode: 'smart', answered: run.answered, correct: run.correct, maxCombo: run.maxCombo, competency: genOverall() });
  const root = el('<div></div>');
  root.appendChild(topbar('genetics'));
  const main = el(`<main class="panel gen-result" id="main" tabindex="-1">
    <div class="gen-res-box cornerframe">
      <span class="label">Fully mastered</span>
      <h1 class="gen-res-sub">All ${GEN_BANK.length} questions maxed</h1>
      <div class="gen-res-grid">
        <div><span class="mono">100%</span><span>competency</span></div>
        <div><span class="mono">${run.correct}/${run.answered}</span><span>this session</span></div>
        <div><span class="mono">${run.maxCombo}×</span><span>best streak</span></div>
        <div><span class="mono">${GEN.xp.toLocaleString()}</span><span>total XP</span></div>
      </div>
      <p class="gen-res-ready">Every question is maxed out — you mastered Module 3. Run a maintenance pass anytime to stay sharp.</p>
      <div class="gen-res-btns">
        <button class="btn btn-solid" id="gen-maint">Maintenance pass</button>
        <button class="btn" id="gen-homebtn">Home</button>
      </div>
    </div>
  </main>`);
  main.querySelector('#gen-homebtn').addEventListener('click', renderGenHome);
  main.querySelector('#gen-maint').addEventListener('click', () => genRunQuestion({ mode: 'smart', pool: genShuffle(GEN_BANK), idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false }));
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

/* ---------- calc tools: mini calculator + scratchpad (calc questions only) ---------- */
let genToolsOpen = false;   // panel open-state persists across questions in a session
let genScratch = '';        // scratchpad text persists across questions in a session
function genToolsHtml() {
  const keys = ['C', '←', '(', ')', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '=', '+'];
  const dk = { 'C': 'clear', '←': 'back', '=': 'eq' };
  const cl = { 'C': 'gen-calc-fn', '←': 'gen-calc-fn', '=': 'gen-calc-eq', '÷': 'gen-calc-op', '×': 'gen-calc-op', '−': 'gen-calc-op', '+': 'gen-calc-op' };
  const grid = keys.map(k => `<button type="button" class="gen-calc-key ${cl[k] || ''}" data-k="${dk[k] || k}">${k}</button>`).join('');
  return `<div class="gen-tools">
      <button type="button" class="gen-tools-toggle" id="gen-tools-toggle">${genToolsOpen ? '▾' : '▸'} Calculator &amp; scratchpad</button>
      <div class="gen-tools-panel" id="gen-tools-panel"${genToolsOpen ? '' : ' hidden'}>
        <div class="gen-calc">
          <input type="text" class="gen-calc-disp" id="gen-calc-disp" inputmode="none" readonly aria-label="Calculator display" />
          <div class="gen-calc-keys">${grid}</div>
        </div>
        <div class="gen-pad"><textarea class="gen-pad-area" id="gen-pad-area" rows="6" placeholder="Scratchpad — work it out here…"></textarea></div>
      </div>
    </div>`;
}
function genCalcEval(expr) {
  if (!/^[-−0-9+*/×÷().%\s]*$/.test(expr)) return 'Error';
  const clean = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/%/g, '/100');
  if (!clean.trim()) return '';
  try {
    const v = Function('"use strict";return (' + clean + ')')();
    if (typeof v !== 'number' || !isFinite(v)) return 'Error';
    return String(Math.round(v * 1e6) / 1e6);
  } catch { return 'Error'; }
}
function genWireTools(main) {
  const toggle = main.querySelector('#gen-tools-toggle');
  if (!toggle) return;
  const panel = main.querySelector('#gen-tools-panel');
  const disp = main.querySelector('#gen-calc-disp');
  const pad = main.querySelector('#gen-pad-area');
  toggle.addEventListener('click', () => {
    genToolsOpen = panel.hidden; panel.hidden = !genToolsOpen;
    toggle.textContent = (genToolsOpen ? '▾' : '▸') + ' Calculator & scratchpad';
  });
  if (pad) { pad.value = genScratch; pad.addEventListener('input', () => { genScratch = pad.value; }); }
  let evaluated = false;
  main.querySelectorAll('.gen-calc-key').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.k;
    if (k === 'clear') { disp.value = ''; evaluated = false; return; }
    if (k === 'back') { disp.value = disp.value.slice(0, -1); evaluated = false; return; }
    if (k === 'eq') { disp.value = genCalcEval(disp.value); evaluated = true; return; }
    if (disp.value === 'Error') disp.value = '';
    if (evaluated) { if (/[0-9.(]/.test(k)) disp.value = ''; evaluated = false; }
    disp.value += k;
  }));
}

function genRunQuestion(run) {
  genClearTimer();
  run.locked = false;
  let qq;
  if (run.endless) {
    qq = genNextSmart(run);
    if (!qq) { genSmartComplete(run); return; }
  } else {
    if (!run.pool.length) { genEndRun(run); return; }
    if (run.mode === 'blitz') { if (run.idx >= run.pool.length) { run.pool = genShuffle(GEN_BANK); run.idx = 0; } }
    else if (run.idx >= run.pool.length) { genEndRun(run); return; }
    qq = run.pool[run.idx];
  }
  if (qq && qq.make) qq = Object.assign({}, qq, qq.make());
  const showHint = !!((qq._retry || (GEN.q[qq.id] && GEN.q[qq.id].lastWrong)) && qq.hint);
  const order = genShuffle([0, 1, 2, 3]);
  const correctDisp = order.indexOf(qq.answer);

  const root = el('<div></div>');
  root.appendChild(topbar('genetics'));
  const main = el(`<main class="panel gen-game" id="main" tabindex="-1">
    ${genHud(run)}
    <div class="gen-q cornerframe" data-qid="${qq.id}">
      <div class="gen-q-meta"><span class="mono">CH ${qq.chapter}</span><span class="gen-q-tag">${esc((GEN_TOPICS[qq.topic] && GEN_TOPICS[qq.topic].name) || 'Practice')}</span><span class="gen-q-diff gen-d-${qq.difficulty}">${qq.difficulty}</span>${qq.type === 'label' ? '<span class="gen-q-pic">diagram</span>' : ''}<button type="button" class="gen-star ${GEN.starred && GEN.starred[qq.id] ? 'on' : ''}" id="gen-star" aria-label="Star this question">${GEN.starred && GEN.starred[qq.id] ? '★' : '☆'}</button></div>
      ${qq.svg ? `<div class="gen-q-svg">${qq.svg}</div>` : ''}
      ${qq.fig && window.GEN_FIGS && window.GEN_FIGS[qq.fig] ? '<div class="gen-q-fig" id="gen-fig"></div>' : ''}
      <h2 class="gen-q-stem">${esc(qq.q)}</h2>
      ${showHint ? `<div class="gen-hint"><span class="gen-hint-lab">Think it through</span> ${esc(qq.hint)}</div>` : ''}
      <div class="gen-opts">
        ${order.map((origIdx, dispIdx) => `<button class="gen-opt" data-disp="${dispIdx}" data-ok="${dispIdx === correctDisp ? 1 : 0}"><span class="gen-opt-key mono">${String.fromCharCode(65 + dispIdx)}</span><span class="gen-opt-txt">${esc(qq.options[origIdx])}</span></button>`).join('')}
      </div>
      ${qq.type === 'calc' ? genToolsHtml() : ''}
      <div class="gen-explain" id="gen-explain" hidden></div>
      <div class="gen-next-row" id="gen-next-row" hidden><button class="btn btn-solid" id="gen-next">Next →</button></div>
    </div>
  </main>`);

  const optsWrap = main.querySelector('.gen-opts');
  const explainBox = main.querySelector('#gen-explain');
  const nextRow = main.querySelector('#gen-next-row');

  const choose = (btn) => {
    if (run.locked) return;
    run.locked = true;
    const right = btn.dataset.ok === '1';
    const beforeBox = genBox(qq.id);
    genRecord(qq, right); run.answered++;
    if (right && run.mode !== 'blitz' && genBox(qq.id) === 5 && beforeBox === 4) genToast(`Mastered · ${qq.tag}`);
    genTrack('answer', { mode: run.mode, qid: qq.id, chapter: qq.chapter, topic: qq.topic, type: qq.type, difficulty: qq.difficulty, correct: right ? 1 : 0 });
    [...optsWrap.querySelectorAll('.gen-opt')].forEach(o => { o.disabled = true; if (o.dataset.ok === '1') o.classList.add('correct'); else if (o === btn) o.classList.add('wrong'); });

    if (right) {
      run.correct++; run.combo++; if (run.combo > run.maxCombo) run.maxCombo = run.combo;
      if (run.combo > GEN.bestCombo) GEN.bestCombo = run.combo;
      if (run.combo === 5) genGrant('combo5');
      if (run.combo === 10) genGrant('combo10');
      const mult = genComboMult(run.combo);
      const base = (qq.type === 'calc' ? 150 : qq.type === 'label' ? 130 : 100) + (qq.difficulty === 'hard' ? 50 : qq.difficulty === 'med' ? 25 : 0);
      run.score += base * mult;
      genFlash(main, `+${base * mult}`, run.combo >= 3 ? `${mult}× COMBO` : '', true);
    } else {
      run.combo = 0; if (run.mode === 'exam') run.lives--;
      genFlash(main, 'MISS', '', false);
      if (run.mode === 'chapter' || run.mode === 'topic' || run.mode === 'misses' || run.mode === 'starred') {
        const retry = Object.assign({}, qq); delete retry.make; retry._retry = true;
        run.pool.splice(Math.min(run.pool.length, run.idx + 1 + gRand(1, 2)), 0, retry);
      } else if (run.endless) {
        // Smart Review: requeue the miss to reappear within 2-3 questions with its hint.
        const retry = Object.assign({}, qq); delete retry.make; retry._retry = true;
        (run.retryQ || (run.retryQ = [])).push({ q: retry, due: run.answered + gRand(1, 2) });
      }
    }
    genCheckAch(); genSave();
    explainBox.innerHTML = `<span class="gen-ex-label">${right ? 'Correct' : 'Answer'}</span> ${esc(qq.explain)}`;
    explainBox.hidden = false;

    if (run.mode === 'exam' && run.lives <= 0) {
      nextRow.hidden = false; const nb = main.querySelector('#gen-next'); nb.textContent = 'See results →';
      nb.addEventListener('click', () => genEndRun(run)); nb.focus(); return;
    }
    if (run.mode === 'blitz') {
      setTimeout(() => { run.idx++; if (run.timeLeft > 0) genRunQuestion(run); }, right ? 650 : 1100);
    } else {
      nextRow.hidden = false; const nb = main.querySelector('#gen-next');
      if (!run.endless && run.idx + 1 >= run.pool.length) nb.textContent = 'Finish →';
      nb.addEventListener('click', () => { run.idx++; genRunQuestion(run); }); nb.focus();
    }
  };

  optsWrap.querySelectorAll('.gen-opt').forEach(b => b.addEventListener('click', () => choose(b)));
  const onKey = (e) => {
    // self-guard: if this question's view is gone (e.g. navigated away), retire this handler
    if (!document.body.contains(main)) { document.removeEventListener('keydown', onKey); if (genKeyHandler === onKey) genKeyHandler = null; return; }
    const tg = e.target;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable)) return;
    if (run.locked) { if (e.key === 'Enter' && !nextRow.hidden) main.querySelector('#gen-next')?.click(); return; }
    let k = -1;
    if (/^[a-dA-D]$/.test(e.key)) k = e.key.toLowerCase().charCodeAt(0) - 97;
    else if (/^[1-4]$/.test(e.key)) k = +e.key - 1;
    if (k >= 0) { const b = optsWrap.querySelector(`.gen-opt[data-disp="${k}"]`); if (b) choose(b); }
  };
  genWireTools(main);
  const starBtn = main.querySelector('#gen-star'); if (starBtn) starBtn.addEventListener('click', (e) => { const on = genToggleStar(qq.id); e.currentTarget.textContent = on ? '★' : '☆'; e.currentTarget.classList.toggle('on', on); });
  genBindKey(onKey);   // replaces any previous question's handler

  root.appendChild(main); root.appendChild(siteFooter()); setView(root);

  // mount the interactive figure (if this question has one) above the stem
  if (qq.fig && window.GEN_FIGS && window.GEN_FIGS[qq.fig]) {
    const figHost = main.querySelector('#gen-fig');
    if (figHost) { try { window.GEN_FIGS[qq.fig](figHost); } catch (e) { figHost.remove(); } }
  }

  if (run.mode === 'blitz') {
    const tEl = main.querySelector('#gen-time');
    genTimer = setInterval(() => {
      if (!document.body.contains(main)) { genClearTimer(); return; }
      run.timeLeft--;
      if (tEl) { tEl.textContent = run.timeLeft; if (run.timeLeft <= 10) tEl.classList.add('low'); }
      if (run.timeLeft <= 0) { genClearTimer(); genEndRun(run); }
    }, 1000);
  }
}

function genHud(run) {
  const quit = `<button class="ghostbtn gen-quit" id="gen-quit">✕ ${run.mode === 'blitz' || run.mode === 'exam' ? 'Quit' : 'Exit'}</button>`;
  if (run.mode === 'blitz') return `<div class="gen-hud">${quit}
    <div class="gen-hud-time"><span class="mono" id="gen-time">${run.timeLeft}</span><span class="gen-hud-l">sec</span></div>
    <div class="gen-hud-score"><span class="mono">${run.score}</span><span class="gen-hud-l">score</span></div>
    <div class="gen-hud-combo ${run.combo >= 3 ? 'hot' : ''}"><span class="mono">${run.combo}×</span><span class="gen-hud-l">combo</span></div></div>`;
  if (run.mode === 'exam') return `<div class="gen-hud">${quit}
    <div class="gen-hud-q"><span class="mono">${run.idx + 1}/${run.pool.length}</span><span class="gen-hud-l">question</span></div>
    <div class="gen-hud-lives">${'◆'.repeat(Math.max(0, run.lives))}${'◇'.repeat(Math.max(0, 3 - run.lives))}</div>
    <div class="gen-hud-score"><span class="mono">${run.correct}</span><span class="gen-hud-l">correct</span></div></div>`;
  if (run.mode === 'smart' && run.endless) {
    const mastered = GEN_BANK.filter(q => genBox(q.id) >= 5).length;
    return `<div class="gen-hud">${quit}
    <div class="gen-hud-q"><span class="mono">${mastered}/${GEN_BANK.length}</span><span class="gen-hud-l">mastered</span></div>
    <div class="gen-hud-q"><span class="mono">${genOverall()}%</span><span class="gen-hud-l">competency</span></div>
    <div class="gen-hud-combo ${run.combo >= 3 ? 'hot' : ''}"><span class="mono">${run.combo}×</span><span class="gen-hud-l">streak</span></div>
    <div class="gen-hud-score"><span class="mono">${run.correct}/${run.answered}</span><span class="gen-hud-l">correct</span></div></div>`;
  }
  const label = run.mode === 'smart' ? 'Smart Review' : run.mode === 'misses' ? 'Review misses' : run.mode === 'starred' ? 'Starred' : run.mode === 'topic' ? (GEN_TOPICS[run.topic] ? GEN_TOPICS[run.topic].name : 'Drill') : `Ch ${run.chapter}`;
  return `<div class="gen-hud">${quit}
    <div class="gen-hud-q"><span class="mono">${run.idx + 1}/${run.pool.length}</span><span class="gen-hud-l">${esc(label)}</span></div>
    <div class="gen-hud-combo ${run.combo >= 3 ? 'hot' : ''}"><span class="mono">${run.combo}×</span><span class="gen-hud-l">streak</span></div>
    <div class="gen-hud-score"><span class="mono">${run.correct}/${run.answered}</span><span class="gen-hud-l">correct</span></div></div>`;
}

function genFlash(scope, big, small, good) {
  const f = el(`<div class="gen-flash ${good ? 'good' : 'bad'}"><span class="gen-flash-big">${esc(big)}</span>${small ? `<span class="gen-flash-small">${esc(small)}</span>` : ''}</div>`);
  scope.appendChild(f); requestAnimationFrame(() => f.classList.add('in'));
  setTimeout(() => { f.classList.remove('in'); setTimeout(() => f.remove(), 300); }, 700);
}
document.addEventListener('click', (e) => { if (e.target && e.target.id === 'gen-quit') { genClearTimer(); renderGenHome(); } });

/* ============================================================================
   RESULTS
   ========================================================================= */
function genEndRun(run) {
  genClearTimer();
  const acc = run.answered ? Math.round(run.correct / run.answered * 100) : 0;
  let headline = '', sub = '', extra = '';
  const grid = (cells) => `<div class="gen-res-grid">${cells.map(c => `<div><span class="mono">${c[0]}</span><span>${c[1]}</span></div>`).join('')}</div>`;

  if (run.mode === 'blitz') {
    const best = run.score > GEN.bestScore; if (best) GEN.bestScore = run.score;
    if (run.score >= 500) genGrant('blitz500');
    if (acc === 100 && run.answered >= 8) genGrant('perfect');
    headline = best ? 'NEW HIGH SCORE' : 'Time!'; sub = `${run.score} points`;
    extra = grid([[`${run.correct}/${run.answered}`, 'answered'], [`${acc}%`, 'accuracy'], [`${run.maxCombo}×`, 'best combo'], [`${GEN.bestScore}`, 'all-time best']]);
  } else if (run.mode === 'exam') {
    const beat = acc >= 85 && run.lives > 0; if (acc > GEN.bestExam) GEN.bestExam = acc; if (beat) genGrant('exam');
    headline = run.lives <= 0 ? 'BOSS WINS' : (beat ? 'BOSS DEFEATED' : 'Boss survives'); sub = `${acc}% · ${run.correct}/${run.answered}`;
    extra = grid([[`${acc}%`, 'score'], [`${run.maxCombo}×`, 'best combo'], [`${run.lives}`, 'lives left'], [`${GEN.bestExam}%`, 'best ever']]);
  } else if (run.mode === 'smart') {
    genGrant('smart'); if (acc === 100 && run.answered >= 8) genGrant('perfect');
    headline = 'Smart Review done'; sub = `${genOverall()}% overall competency`;
    extra = grid([[`${run.correct}/${run.answered}`, 'correct'], [`${acc}%`, 'accuracy'], [`+${run.maxCombo}`, 'best streak'], [`${genOverall()}%`, 'competency']]);
  } else if (run.mode === 'topic') {
    headline = 'Drill complete'; sub = `${GEN_TOPICS[run.topic] ? GEN_TOPICS[run.topic].name : ''} · ${genComp(genTopicQs(run.topic))}%`;
    extra = grid([[`${run.correct}/${run.answered}`, 'correct'], [`${acc}%`, 'accuracy'], [`${genComp(genTopicQs(run.topic))}%`, 'topic competency'], [`${genOverall()}%`, 'overall']]);
  } else if (run.mode === 'misses' || run.mode === 'starred') {
    if (acc === 100 && run.answered >= 8) genGrant('perfect');
    headline = run.mode === 'misses' ? 'Misses reviewed' : 'Starred reviewed'; sub = `${run.correct}/${run.answered} correct`;
    extra = grid([[`${run.correct}/${run.answered}`, 'correct'], [`${acc}%`, 'accuracy'], [`${genMissPool().length}`, 'misses left'], [`${genOverall()}%`, 'competency']]);
  } else {
    if (acc === 100 && run.answered >= 8) genGrant('perfect');
    headline = 'Chapter complete'; sub = `Ch ${run.chapter} · ${genMastery(run.chapter)}% mastered`;
    extra = grid([[`${run.correct}/${run.answered}`, 'correct'], [`${acc}%`, 'accuracy'], [`${run.maxCombo}×`, 'best streak'], [`${genMastery(run.chapter)}%`, 'mastery']]);
  }
  genCheckAch(); genSave();
  genTrack('run_end', { mode: run.mode, answered: run.answered, correct: run.correct, accuracy: acc, score: run.score, maxCombo: run.maxCombo, competency: genOverall() });
  const status = genStatus();

  const root = el('<div></div>');
  root.appendChild(topbar('genetics'));
  const main = el(`<main class="panel gen-result" id="main" tabindex="-1">
    <div class="gen-res-box cornerframe">
      <span class="label">${esc(headline)}</span>
      <h1 class="gen-res-sub">${esc(sub)}</h1>
      ${extra}
      ${status.cls === 'ready' ? '<p class="gen-res-ready">EXAM READY — 90%+ competency. Keep Smart Review warm.</p>' : ''}
      <p class="gen-res-xp mono">${GEN.xp.toLocaleString()} XP total · LV ${genRank(GEN.xp).lvl} ${esc(genRank(GEN.xp).name)}</p>
      <div class="gen-res-btns">
        <button class="btn btn-solid" id="gen-again">${run.mode === 'blitz' ? 'Run it back' : run.mode === 'exam' ? 'Rematch' : run.mode === 'smart' ? 'Another set' : 'Again'}</button>
        <button class="btn" id="gen-homebtn">Home</button>
      </div>
    </div>
  </main>`);
  main.querySelector('#gen-homebtn').addEventListener('click', renderGenHome);
  main.querySelector('#gen-again').addEventListener('click', () => {
    if (run.mode === 'blitz') startGenBlitz();
    else if (run.mode === 'exam') startGenExam();
    else if (run.mode === 'smart') startGenSmart();
    else if (run.mode === 'misses') startGenMisses();
    else if (run.mode === 'starred') startGenStarred();
    else if (run.mode === 'topic') startGenTopic(run.topic);
    else startGenChapter(run.chapter);
  });
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}
