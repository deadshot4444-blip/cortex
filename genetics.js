/* ============================================================================
   Cortex · Genetics-2313-01E  —  UTSA Module 2 (Chapters 4–6, Exam 2)
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

const GEN_DIAGRAMS = [
  { id: 'd-cen-meta', hint: 'Where does the centromere sit, and how do the two arm lengths compare here?', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'easy', tag: 'Centromere position', svg: gChr(75),
    q: 'Classify this chromosome by its centromere position.',
    options: ['Metacentric', 'Acrocentric', 'Telocentric', 'Submetacentric'], answer: 0,
    explain: 'The centromere sits at the middle, giving two arms of roughly equal length — that is a metacentric chromosome.' },
  { id: 'd-cen-sub', hint: 'When arms are unequal but neither is tiny, how far off-center is the centromere?', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'med', tag: 'Centromere position', svg: gChr(55),
    q: 'Classify this chromosome by its centromere position.',
    options: ['Metacentric', 'Submetacentric', 'Telocentric', 'Acrocentric'], answer: 1,
    explain: 'The centromere is offset from center, producing one shorter (p) and one longer (q) arm — submetacentric.' },
  { id: 'd-cen-acro', hint: 'When the centromere sits near one end leaving a very short arm, which class fits?', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'med', tag: 'Centromere position', svg: gChr(30),
    q: 'Classify this chromosome by its centromere position.',
    options: ['Submetacentric', 'Acrocentric', 'Metacentric', 'Telocentric'], answer: 1,
    explain: 'The centromere lies near one end, leaving a very small short arm — acrocentric. (Robertsonian translocations occur between acrocentric chromosomes.)' },
  { id: 'd-cen-telo', hint: 'If the centromere is right at the chromosome\'s tip with essentially one arm, which class?', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'med', tag: 'Centromere position', svg: gChr(16),
    q: 'Classify this chromosome by its centromere position.',
    options: ['Acrocentric', 'Telocentric', 'Metacentric', 'Submetacentric'], answer: 1,
    explain: 'The centromere is at the very end with essentially no short arm — telocentric.' },
  { id: 'd-arrow-cen', hint: 'What constricted point joins the two sister chromatids and attaches spindle fibers?', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'easy', tag: 'Label the part', svg: gChr(55, 55),
    q: 'What structure does the arrow point to?',
    options: ['Telomere', 'Centromere', 'Short (p) arm', 'Chiasma'], answer: 1,
    explain: 'The arrow marks the constricted region of repetitive DNA where sister chromatids are held together — the centromere.' },
  { id: 'd-arrow-p', hint: 'Relative to the centromere, is the indicated arm the shorter or longer one?', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'easy', tag: 'Label the arm', svg: gChr(55, 33),
    q: 'The arrow points to which arm of the chromosome?',
    options: ['The q arm (long arm)', 'The p arm (short arm)', 'The centromere', 'The telomere'], answer: 1,
    explain: 'The shorter arm above the centromere is the p arm; the longer arm below is the q arm.' },
  { id: 'd-arrow-q', hint: 'Compare the two arms about the centromere: is the marked one shorter or longer?', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'easy', tag: 'Label the arm', svg: gChr(55, 96),
    q: 'The arrow points to which arm of the chromosome?',
    options: ['The p arm (short arm)', 'The q arm (long arm)', 'The centromere', 'A telomere'], answer: 1,
    explain: 'The longer arm below the centromere is the q arm (p = short, q = long).' },
  { id: 'd-inv-para', hint: 'Does the inverted segment include the centromere, or lie entirely on one arm?', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'hard', tag: 'Inversion type', svg: gInversion(['A', 'B', 'C', 'D', 'G', 'F', 'E'], 3, 4, 6),
    q: 'A chromosome A·B·C·D·●·E·F·G mutates to the arrangement shown (● = centromere). What rearrangement is this?',
    options: ['Pericentric inversion', 'Paracentric inversion', 'Reciprocal translocation', 'Terminal deletion'], answer: 1,
    explain: 'The reversed segment (E·F·G → G·F·E) lies entirely on one arm and does NOT include the centromere — that defines a paracentric inversion.' },
  { id: 'd-inv-peri', hint: 'Check whether the reversed region spans across the centromere or stays on one side.', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'hard', tag: 'Inversion type', svg: gInversion(['A', 'D', 'C', 'B', 'E', 'F', 'G'], 2, 1, 3),
    q: 'A chromosome A·B·●·C·D·E·F·G mutates to the arrangement shown (● = centromere, highlighted region reversed). What is it?',
    options: ['Paracentric inversion', 'Pericentric inversion', 'Robertsonian translocation', 'Interstitial deletion'], answer: 1,
    explain: 'The inverted segment spans the centromere (the ● lies inside the reversed region) — that is a pericentric inversion.' },
  { id: 'd-ndj-mi', hint: 'If all four gametes are abnormal, did separation fail in the first or second division?', chapter: 6, topic: 'ch6-number', type: 'label', difficulty: 'med', tag: 'Nondisjunction', svg: gGametes(['n+1', 'n+1', 'n−1', 'n−1']),
    q: 'All four gametes from one meiosis have these chromosome numbers. At which stage did nondisjunction occur?',
    options: ['Meiosis I', 'Meiosis II', 'Mitosis', 'No nondisjunction occurred'], answer: 0,
    explain: 'When ALL four gametes are abnormal (two n+1 and two n−1), homologs failed to separate in meiosis I.' },
  { id: 'd-ndj-mii', hint: 'If only one pair of gametes is unbalanced while others are normal, which division failed?', chapter: 6, topic: 'ch6-number', type: 'label', difficulty: 'med', tag: 'Nondisjunction', svg: gGametes(['n', 'n', 'n+1', 'n−1']),
    q: 'The four gametes from one meiosis have these chromosome numbers. At which stage did nondisjunction occur?',
    options: ['Meiosis I', 'Meiosis II', 'Fertilization', 'S phase'], answer: 1,
    explain: 'Two normal (n) plus one n+1 and one n−1 means sister chromatids failed to separate in meiosis II (only one of the two MII divisions was affected).' },
  { id: 'd-pun-incdom', hint: 'With incomplete dominance, what phenotype does each heterozygote show, and how do the three genotype classes split?', chapter: 4, topic: 'ch4-interactions', type: 'label', difficulty: 'med', tag: 'Incomplete dominance', answer: 1,
    svg: gPunnett(['Cʳ', 'Cʷ'], ['Cʳ', 'Cʷ'], [[{ g: 'CʳCʳ', cls: 'red' }, { g: 'CʳCʷ', cls: 'pink' }], [{ g: 'CʳCʷ', cls: 'pink' }, { g: 'CʷCʷ', cls: 'white' }]]),
    q: 'Two pink (CʳCʷ) snapdragons are crossed (incomplete dominance). What F2 phenotypic ratio does this Punnett square give?',
    options: ['3 red : 1 white', '1 red : 2 pink : 1 white', 'All pink', '1 red : 1 white'], answer: 1,
    explain: 'With incomplete dominance the heterozygote is pink, so genotype ratio = phenotype ratio: 1 CʳCʳ (red) : 2 CʳCʷ (pink) : 1 CʷCʷ (white).' },
  { id: 'd-pun-abo', hint: 'Each parent passes one allele; list all four genotype combinations and recall codominance gives a distinct heterozygote type.', chapter: 4, topic: 'ch4-interactions', type: 'label', difficulty: 'med', tag: 'ABO codominance', answer: 2,
    svg: gPunnett(['Iᴬ', 'i'], ['Iᴮ', 'i'], [[{ g: 'IᴬIᴮ', cls: 'pab' }, { g: 'Iᴮi', cls: 'pb' }], [{ g: 'Iᴬi', cls: 'pa' }, { g: 'ii', cls: 'po' }]]),
    q: 'A type-A (Iᴬi) × type-B (Iᴮi) cross. What blood-type ratio does this Punnett square predict?',
    options: ['All type AB', '3 AB : 1 O', '1 AB : 1 A : 1 B : 1 O', '1 A : 1 B'], answer: 2,
    explain: 'Iᴬ and Iᴮ are codominant and i is recessive, giving four equally likely children: IᴬIᴮ (AB), Iᴬi (A), Iᴮi (B), ii (O) — a 1:1:1:1 ratio.' },
  { id: 'd-pedigree-mito', hint: 'Which organelle is inherited only through the egg, making transmission depend entirely on the mother?', chapter: 4, topic: 'ch4-nonmendelian', type: 'label', difficulty: 'hard', tag: 'Pedigree', svg: gPedigree(),
    q: 'In this pedigree an affected mother passes the trait to ALL of her children (an affected father would pass it to none). Which inheritance pattern is this?',
    options: ['Autosomal dominant', 'X-linked recessive', 'Mitochondrial (maternal) inheritance', 'Genomic imprinting'], answer: 2,
    explain: 'Transmission exclusively through the mother to all offspring is the hallmark of mitochondrial / maternal (cytoplasmic) inheritance — mtDNA comes from the egg.' },
  { id: 'd-robertson', hint: 'When two whole chromosomes merge into one, does the total chromosome number stay the same or shift?', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'med', tag: 'Translocation', svg: gRobertson(),
    q: 'Two acrocentric chromosomes fuse into a single chromosome as shown. What is this event, and how does the chromosome count change?',
    options: ['Reciprocal translocation; count unchanged', 'Robertsonian translocation; count drops by 1', 'Pericentric inversion; count unchanged', 'Duplication; count rises by 1'], answer: 1,
    explain: 'Fusion of two acrocentric chromosomes at the centromere is a Robertsonian translocation; two chromosomes become one, so the total count drops by 1 (e.g., 48 → 47).' },

  { id: 'd-epistasis-path', hint: 'If the first enzyme is blocked, can any downstream pigment form along the pathway?', chapter: 4, topic: 'ch4-epistasis', type: 'label', difficulty: 'med', tag: 'Epistasis pathway', svg: gPathway('C'),
    q: 'In this sweet-pea pigment pathway, the cc genotype blocks the C enzyme (✗). What is the flower color?',
    options: ['Purple', 'White (colorless)', 'Pink', 'Red'], answer: 1,
    explain: 'Purple pigment needs BOTH enzymes (C and P). With the C enzyme blocked, the pathway stalls at the colorless precursor, so the flower is white — the basis of the 9:7 epistatic ratio.' },
  { id: 'd-grid-97', hint: 'What 16-part ratio collapses to 9:7, and which class requires a dominant allele at both genes?', chapter: 4, topic: 'ch4-epistasis', type: 'label', difficulty: 'med', tag: '9:7 ratio', svg: gGrid([{ n: 9, cls: 'p' }, { n: 7, cls: 'w' }]),
    q: 'This dihybrid cross gives 9 purple (filled) : 7 white (open) offspring. Which interaction produces this ratio?',
    options: ['No gene interaction (simple dominance)', 'Duplicate-recessive epistasis', 'Dominant epistasis', 'Incomplete dominance'], answer: 1,
    explain: 'A 9:7 ratio means both genes must contribute a dominant allele for color; cc OR pp gives white. This duplicate (complementary) recessive epistasis collapses the 3:3:1 classes into the "7 white".' },
  { id: 'd-grid-1231', hint: 'Which 16ths combine into the largest class here, and does a dominant allele at one gene mask the other?', chapter: 4, topic: 'ch4-epistasis', type: 'label', difficulty: 'hard', tag: '12:3:1 ratio', svg: gGrid([{ n: 12, cls: 'c' }, { n: 3, cls: 'p' }, { n: 1, cls: 'r' }]),
    q: 'A dihybrid cross yields 12 : 3 : 1 (light : purple : red). Which gene interaction is this?',
    options: ['Recessive epistasis', 'Dominant epistasis', 'Duplicate-recessive epistasis', 'No gene interaction (simple dominance)'], answer: 1,
    explain: 'A 12:3:1 ratio is dominant epistasis: a dominant allele at one locus (e.g., I) masks the second gene, so 9+3 = 12 share one phenotype, and only the recessive-at-the-epistatic-gene classes (3 and 1) reveal the second gene.' },
  { id: 'd-crossover', hint: 'Do these allele combinations match either parent\'s original arrangement, or are they newly shuffled?', chapter: 5, topic: 'ch5-linkage', type: 'label', difficulty: 'med', tag: 'Recombinant gametes', svg: gCrossover(),
    q: 'A crossover between linked genes A and B produces these four gametes. The two outlined gametes (A b and a B) are:',
    options: ['Parental (nonrecombinant) gametes', 'Recombinant gametes', 'Identical to the parents', 'Products of nondisjunction'], answer: 1,
    explain: 'Parental gametes keep the original allele combinations (A B, a b). Crossing over swaps alleles between homologs to make NEW combinations (A b, a B) — the recombinant gametes whose frequency gives map distance.' },
  { id: 'd-map', hint: 'How do map distances between adjacent gene intervals combine across A-to-C?', chapter: 5, topic: 'ch5-threepoint', type: 'label', difficulty: 'med', tag: 'Linkage map', svg: gMap(['A', 'B', 'C'], [5, 12]),
    q: 'Using this linkage map, what is the map distance between genes A and C?',
    options: ['7 cM', '12 cM', '17 cM', '60 cM'], answer: 2,
    explain: 'Map distances between linked genes are additive: A–C = A–B + B–C = 5 + 12 = 17 cM (ignoring rare double crossovers).' },
  { id: 'd-ped-ar', hint: 'If both parents show no trait but a child does, what must each parent secretly carry?', chapter: 4, topic: 'ch4-interactions', type: 'label', difficulty: 'hard', tag: 'Pedigree', svg: gPed({ mother: 'unaff', father: 'unaff', kids: [['c', 'unaff'], ['s', 'aff'], ['c', 'unaff']], cap: 'unaffected parents → affected child' }),
    q: 'Two unaffected parents have an affected child (filled). Which inheritance pattern best fits?',
    options: ['Autosomal dominant', 'Autosomal recessive', 'Mitochondrial', 'Y-linked'], answer: 1,
    explain: 'When two unaffected parents produce an affected child, both parents are carriers (heterozygous) of a recessive allele — autosomal recessive inheritance (the trait can "skip" generations).' },
  { id: 'd-ped-xr', hint: 'Why would a trait appear far more in males, and which chromosome do sons inherit from their carrier mother?', chapter: 4, topic: 'ch4-epistasis', type: 'label', difficulty: 'hard', tag: 'Pedigree', svg: gPed({ mother: 'carrier', father: 'unaff', kids: [['s', 'aff'], ['c', 'carrier'], ['s', 'unaff']], cap: 'carrier mother → affected son' }),
    q: 'A carrier mother (dot) and unaffected father have an affected son; the trait shows up mostly in males. Pattern?',
    options: ['Autosomal recessive', 'X-linked recessive', 'Autosomal dominant', 'Mitochondrial'], answer: 1,
    explain: 'Males (XY) need only one copy of an X-linked recessive allele to be affected, so the trait appears far more in sons, passed from carrier mothers — X-linked recessive inheritance.' },
  { id: 'd-deletion', hint: 'Lost from the middle, not an end — which deletion term describes an internal segment versus a terminal one?', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'med', tag: 'Deletion', svg: gSeg(['A', 'B', 'C', 'D', 'E', 'F'], [2, 3], 'gone'),
    q: 'Segments C and D (dashed) were lost from the MIDDLE of this chromosome. What is this called?',
    options: ['Terminal deletion', 'Interstitial deletion', 'Duplication', 'Paracentric inversion'], answer: 1,
    explain: 'Loss of an internal segment (not at the end) is an interstitial deletion. A terminal deletion removes material from the chromosome end (involving the telomere).' },
  { id: 'd-dup', hint: 'A segment now present in two copies on one chromosome — does that add material or remove it?', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'med', tag: 'Duplication', svg: gSeg(['A', 'B', 'C', 'D', 'C', 'D'], [4, 5], 'dupseg'),
    q: 'Segment C–D now appears twice on this chromosome (highlighted). What structural change is this?',
    options: ['Deletion', 'Duplication', 'Inversion', 'Translocation'], answer: 1,
    explain: 'A repeated chromosomal segment is a duplication — often arising from misaligned crossing over. Duplications add genetic material and are the raw material for gene families (paralogs).' },
  { id: 'd-reciprocal', hint: 'Two non-homologous chromosomes traded segments — is this a fusion at centromeres, or a mutual exchange?', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'med', tag: 'Translocation', svg: gReciprocal(),
    q: 'These two NON-homologous chromosomes have swapped end segments (colors exchanged). What is this?',
    options: ['Robertsonian translocation', 'Reciprocal translocation', 'Pericentric inversion', 'Interstitial deletion'], answer: 1,
    explain: 'A mutual exchange of segments between two non-homologous chromosomes is a reciprocal translocation. If it is balanced (no net gain/loss) the carrier is usually healthy, but gametes can be unbalanced.' },
  { id: 'd-triploid', hint: 'Count the complete sets: how does the prefix tri- map onto the number n?', chapter: 6, topic: 'ch6-number', type: 'label', difficulty: 'easy', tag: 'Ploidy', svg: gSets([1, 1, 1]),
    q: 'This cell carries three complete chromosome sets. What is its ploidy?',
    options: ['Diploid (2n)', 'Triploid (3n)', 'Tetraploid (4n)', 'Haploid (n)'], answer: 1,
    explain: 'Three complete sets = triploid (3n). Triploids are usually sterile/seedless because an odd number of homologs cannot pair evenly in meiosis.' },
  { id: 'd-allopoly', hint: 'Four sets sourced from two different species — does \'auto\' or \'allo\' signal different-species origins?', chapter: 6, topic: 'ch6-number', type: 'label', difficulty: 'hard', tag: 'Polyploidy', svg: gSets([1, 1, 2, 2]),
    q: 'This organism has four sets — two from each of two different species (two colors). What is it?',
    options: ['Autotetraploid', 'Allotetraploid (allopolyploid)', 'Triploid', 'Aneuploid'], answer: 1,
    explain: 'Sets from DIFFERENT species make it an allopolyploid; four total sets = allotetraploid (e.g., Xenopus laevis). Autopolyploidy would be extra sets from the SAME species (one color).' },
  { id: 'd-trisomy', hint: 'Three copies of one chromosome (not whole extra sets) — is that 2n+1 or 3n?', chapter: 6, topic: 'ch6-number', type: 'label', difficulty: 'med', tag: 'Aneuploidy', svg: gKaryoTri(),
    q: 'This partial karyotype shows three copies of chromosome 21 (highlighted). What is this?',
    options: ['Monosomy 21 (2n−1)', 'Trisomy 21 / Down syndrome (2n+1)', 'Triploidy (3n)', 'Balanced translocation'], answer: 1,
    explain: 'Three copies of a single chromosome (here 21) is a trisomy (2n+1) — trisomy 21 is Down syndrome. Triploidy (3n) would be three copies of EVERY chromosome, not just one.' },
  { id: 'd-coupling', chapter: 5, topic: 'ch5-linkage', type: 'label', difficulty: 'med', tag: 'Coupling', hint: "The most frequent gametes copy one whole homolog without recombination — read each row.", svg: gCoupling(['A', 'B'], ['a', 'b']),
    q: "These are the two homologs of a dihybrid for linked genes A and B. Which two gametes will be the MOST frequent?",
    options: ['A B and a b', 'A b and a B', 'All four types equally', 'A B and A b'], answer: 0,
    explain: "The most frequent gametes are the parental (nonrecombinant) types, which reproduce each intact homolog. Here the homologs carry A B and a b (the coupling/cis arrangement), so A B and a b are the common gametes; A b and a B are the rarer recombinants from crossing over." },
  { id: 'd-repulsion', chapter: 5, topic: 'ch5-linkage', type: 'label', difficulty: 'med', tag: 'Repulsion', hint: "Each homolog passes its own allele pair into a gamete — what two combinations are shown?", svg: gCoupling(['A', 'b'], ['a', 'B']),
    q: "These are the two homologs of a dihybrid in the repulsion (trans) arrangement. Which two gametes will be the MOST frequent?",
    options: ['A B and a b', 'A b and a B', 'A B and A b', 'All four types equally'], answer: 1,
    explain: "The parental (most frequent) gametes match the intact homologs. In repulsion the homologs carry A b and a B, so those are the common gametes, while A B and a b are the rarer recombinant types produced by crossing over." },
  { id: 'd-bridge', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'hard', tag: 'Inversion products', hint: "Count the centromeres on each piece: one has two, the other has none.", svg: gBridge(),
    q: "A single crossover within a paracentric inversion loop produces the abnormal products shown. What are they?",
    options: ['Two balanced recombinant chromosomes', 'A dicentric bridge and an acentric fragment', 'A reciprocal translocation', 'Trisomy and monosomy'], answer: 1,
    explain: "A crossover inside a paracentric inversion loop joins the two centromeres on one product (a dicentric bridge, which is pulled to both poles and breaks) and leaves the reciprocal product with no centromere (an acentric fragment, which is lost). Both recombinant products are abnormal, so recombinants aren't recovered — paracentric inversions suppress crossing over in heterozygotes." },
  { id: 'd-quad', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'hard', tag: 'Translocation', hint: "Only one segregation pattern sends a complete chromosome set to each pole.", svg: gQuad(),
    q: "A reciprocal-translocation heterozygote forms this cross-shaped quadrivalent in meiosis I. Which segregation pattern yields balanced, viable gametes?",
    options: ['Adjacent-1 segregation', 'Adjacent-2 segregation', 'Alternate segregation', 'Any pattern produces balanced gametes'], answer: 2,
    explain: "In alternate segregation, the diagonal (nonadjacent) chromosomes move to the same pole, so each gamete receives a complete set — either both normal or both translocated chromosomes — and is balanced and viable. Adjacent-1 and adjacent-2 send neighboring chromosomes together, producing unbalanced gametes with duplications and deletions, which is why translocation heterozygotes are semisterile." },
  { id: 'd-triploid3', chapter: 6, topic: 'ch6-number', type: 'label', difficulty: 'med', tag: 'Polyploidy', hint: "Homologs normally line up two-by-two in meiosis — what goes wrong with three of each?", svg: gTriploid3(),
    q: "An autotriploid (3n) carries three homologs of every chromosome, as shown. Why is it usually sterile?",
    options: ['Three homologs cannot pair and segregate evenly in meiosis, giving unbalanced gametes', 'Triploids cannot undergo mitosis', 'The extra set is always silenced by methylation', 'Three sets prevent DNA replication'], answer: 0,
    explain: "Meiosis pairs homologs two-by-two, but with three copies of each chromosome the homologs form trivalents (or a pair plus an unpaired chromosome) and segregate unevenly. The resulting gametes have random, unbalanced chromosome numbers, so few are viable — which is why odd-ploidy autopolyploids like autotriploids are typically sterile (and seedless)." },
];

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
const GEN_GENERATORS = [
  { id: 'gen-rf', chapter: 5, topic: 'ch5-threepoint', type: 'calc', difficulty: 'med', tag: 'Map distance', hint: 'Recombination frequency = recombinants ÷ total, then ×100 for a percentage.',
    make() { const cM = gRand(3, 28), N = gPick([500, 800, 1000, 1200, 1500, 2000]), R = N * cM / 100;
      const o = gOpts(`${cM} cM`, [`${100 - cM} cM`, `${Math.max(1, Math.round(cM / 2))} cM`, `${Math.min(95, cM * 2)} cM`, `${cM + 3} cM`]);
      return { q: `In a testcross of ${N} offspring, ${R} are recombinant for genes A and B. What is the map distance between A and B?`, options: o.options, answer: o.answer, explain: `Map distance = (recombinants ÷ total) × 100 = (${R} ÷ ${N}) × 100 = ${cM} cM (${cM} map units).` }; } },
  { id: 'gen-additive', chapter: 5, topic: 'ch5-threepoint', type: 'calc', difficulty: 'easy', tag: 'Additive distance', hint: 'Map distances between linked genes add up; combine the two flanking intervals.',
    make() { let d1 = gRand(3, 22), d2 = gRand(3, 22); if (d1 === d2) d2 += 1;
      const o = gOpts(`${d1 + d2} cM`, [`${Math.abs(d1 - d2)} cM`, `${Math.max(d1, d2)} cM`, `${Math.round((d1 + d2) / 2)} cM`, `${d1 * d2} cM`]);
      return { q: `Genes D and E are ${d1} cM apart, and genes E and F are ${d2} cM apart, with E in the middle. What map distance is expected between D and F?`, options: o.options, answer: o.answer, explain: `Map distances are additive: D–F = D–E + E–F = ${d1} + ${d2} = ${d1 + d2} cM.` }; } },
  { id: 'gen-geneorder', chapter: 5, topic: 'ch5-threepoint', type: 'calc', difficulty: 'med', tag: 'Gene order', hint: 'In a double crossover, only ONE gene flips versus the parentals; find which.',
    make() { const g = genShuffle(['A', 'B', 'C', 'D', 'E']).slice(0, 3), mid = gRand(0, 2);
      const up = g.join(' '), lo = g.map(x => x.toLowerCase()).join(' ');
      const d1 = g.map((x, i) => i === mid ? x.toLowerCase() : x).join(' ');
      const d2 = g.map((x, i) => i === mid ? x : x.toLowerCase()).join(' ');
      const o = gOpts(`Gene ${g[mid]}`, g.filter((_, i) => i !== mid).map(x => `Gene ${x}`).concat(['Cannot be determined']));
      return { q: `In a three-point cross the parental classes are ${up} and ${lo}; the two double-crossover classes are ${d1} and ${d2}. Which gene is in the middle?`, options: o.options, answer: o.answer, explain: `A double crossover flips only the MIDDLE gene relative to the parentals. Comparing ${up} / ${lo} with ${d1} / ${d2}, only gene ${g[mid]} differs, so gene ${g[mid]} is in the middle.` }; } },
  { id: 'gen-3ptdist', chapter: 5, topic: 'ch5-threepoint', type: 'calc', difficulty: 'hard', tag: 'Map distance', hint: 'A region’s distance counts BOTH its single crossovers AND the double crossovers.',
    make() { const N = 1000, cM = gRand(5, 25), dco = gPick([5, 10, 15, 20]), sco = N * cM / 100 - dco;
      const forgot = cM - Math.round(dco / 10);
      const o = gOpts(`${cM} cM`, [`${forgot} cM`, `${cM + gRand(2, 5)} cM`, `${Math.max(1, cM - gRand(2, 5))} cM`, `${Math.round(dco / 10)} cM`]);
      return { q: `In a three-point testcross of ${N} offspring, the single-crossover classes between genes X and Y total ${sco}, and the double-crossover classes total ${dco}. What is the X–Y map distance?`, options: o.options, answer: o.answer, explain: `A region's distance includes its single crossovers AND the double crossovers: (${sco} + ${dco}) ÷ ${N} × 100 = ${cM} cM.` }; } },
  { id: 'gen-ploidy', chapter: 6, topic: 'ch6-number', type: 'calc', difficulty: 'easy', tag: 'Ploidy', hint: 'Chromosomes per set = total ÷ number of sets.',
    make() { const t = gPick([{ p: 3, n: 'triploid' }, { p: 4, n: 'tetraploid' }, { p: 6, n: 'hexaploid' }, { p: 8, n: 'octoploid' }]), per = gRand(5, 12), tot = t.p * per;
      const o = gOpts(`${per} chromosomes`, [`${tot} chromosomes`, `${t.p} chromosomes`, `${per * 2} chromosomes`, `${Math.round(tot / 2)} chromosomes`]);
      return { q: `A ${t.n} organism (${t.p} chromosome sets) has ${tot} chromosomes total. How many chromosomes are in EACH set?`, options: o.options, answer: o.answer, explain: `Chromosomes per set = total ÷ number of sets = ${tot} ÷ ${t.p} = ${per}.` }; } },
  { id: 'gen-nondisj', chapter: 6, topic: 'ch6-number', type: 'calc', difficulty: 'med', tag: 'Nondisjunction', hint: 'Add the abnormal gamete’s chromosome count to a normal gamete (n); compare to 2n.',
    make() { const n = gRand(4, 12), dip = 2 * n;
      if (gPick([true, false])) { const o = gOpts(`${dip + 1} chromosomes`, [`${dip} chromosomes`, `${dip - 1} chromosomes`, `${n + 1} chromosomes`, `${dip + 2} chromosomes`]);
        return { q: `A diploid species has 2n = ${dip}. An n+1 gamete from nondisjunction is fertilized by a normal gamete. How many chromosomes does the resulting (trisomic) zygote have?`, options: o.options, answer: o.answer, explain: `The n+1 gamete has ${n + 1} chromosomes; a normal gamete has ${n}. Zygote = ${n + 1} + ${n} = ${dip + 1} (2n+1, trisomy).` }; }
      const o = gOpts(`${dip - 1} chromosomes`, [`${dip} chromosomes`, `${dip + 1} chromosomes`, `${n - 1} chromosomes`, `${dip - 2} chromosomes`]);
      return { q: `A diploid species has 2n = ${dip}. An n−1 gamete from nondisjunction is fertilized by a normal gamete. How many chromosomes does the resulting (monosomic) zygote have?`, options: o.options, answer: o.answer, explain: `The n−1 gamete has ${n - 1} chromosomes; a normal gamete has ${n}. Zygote = ${n - 1} + ${n} = ${dip - 1} (2n−1, monosomy).` }; } },
];

let GEN_BANK = GEN_DIAGRAMS.concat(GEN_GENERATORS);   // GEN_GENERATED merged in after genLoadBank()

/* ---------- topic metadata (for weakness reporting) ---------- */
const GEN_TOPICS = {
  'ch4-alleles': { ch: 4, name: 'Allele types & lethal alleles' },
  'ch4-interactions': { ch: 4, name: 'Dominance, ABO, penetrance' },
  'ch4-epistasis': { ch: 4, name: 'Epistasis & sex-influenced traits' },
  'ch4-nonmendelian': { ch: 4, name: 'Non-Mendelian inheritance' },
  'ch5-linkage': { ch: 5, name: 'Linkage & recombination' },
  'ch5-threepoint': { ch: 5, name: 'Three-point crosses' },
  'ch6-structural': { ch: 6, name: 'Structural variations & karyotype' },
  'ch6-number': { ch: 6, name: 'Ploidy & aneuploidy' },
};
const GEN_CH = { 4: 'Mendelian Extensions', 5: 'Linkage & Mapping', 6: 'Chromosome Variation' };

/* ---------- state + persistence ---------- */
const GEN_KEY = 'cs-genetics';
const GEN_PASS = 'cortex genetics';
function genLoad() { try { return JSON.parse(localStorage.getItem(GEN_KEY)) || {}; } catch { return {}; } }
let GEN = Object.assign({
  unlocked: false, xp: 0, answered: 0, correct: 0,
  bestScore: 0, bestCombo: 0, bestExam: 0, plays: 0,
  streak: { current: 0, longest: 0, lastDate: '' },
  q: {},            // qid -> { box: 0..5, a, c, ts }
  ach: [], examReady: false, starred: {},
}, genLoad());
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
    .map(t => { const qs = genTopicQs(t); return { topic: t, name: GEN_TOPICS[t].name, ch: GEN_TOPICS[t].ch, comp: genComp(qs), n: qs.length, seen: qs.filter(q => genBox(q.id) > 0).length }; })
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
  { id: 'ch4', name: 'Inheritance Boss', desc: 'Reach 100% on Chapter 4' },
  { id: 'ch5', name: 'Mapmaker', desc: 'Reach 100% on Chapter 5' },
  { id: 'ch6', name: 'Karyotype King', desc: 'Reach 100% on Chapter 6' },
  { id: 'exam', name: 'Exam Slayer', desc: 'Beat the Exam Boss (85%+)' },
  { id: 'ready', name: 'Exam Ready', desc: 'Hit 90% overall competency' },
  { id: 'geneticist', name: 'Certified Geneticist', desc: 'Reach the Geneticist rank' },
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
  if (genMastery(4) >= 100) genGrant('ch4');
  if (genMastery(5) >= 100) genGrant('ch5');
  if (genMastery(6) >= 100) genGrant('ch6');
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
  if (right) { r.c++; r.box = Math.min(5, r.box + 1); r.lastWrong = false; } else { r.box = Math.max(1, r.box - 1); r.lastWrong = true; }
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
async function genLoadBank() {
  try {
    const r = await fetch('data/genetics-bank.json?v=1');
    if (!r.ok) throw new Error('http ' + r.status);
    const data = await r.json();
    if (!Array.isArray(data) || !data.length) throw new Error('empty bank');
    GEN_GENERATED = data;
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
  if (GEN.unlocked) { renderGenHome(); return; }
  renderGenPassword();
}
function renderGenPassword(errMsg) {
  const root = el('<div></div>');
  root.appendChild(topbar('genetics'));
  const main = el(`<main class="panel gen-lock" id="main" tabindex="-1">
    <div class="gen-lock-box cornerframe">
      <span class="label">UTSA · Genetics · Module 2</span>
      <h1 class="gen-lock-title">Genetics-2313-01E</h1>
      <p class="gen-lock-sub">Chapters 4–6 · Exam 2 mastery trainer. This section is locked to a class passphrase.</p>
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
        <span class="label">UTSA · Genetics · Module 2 (Ch 4–6)</span>
        <h1>Genetics-2313-01E</h1>
        <div class="gen-rank"><span class="gen-rank-lvl mono">LV ${rank.lvl}</span><span class="gen-rank-name">${esc(rank.name)}</span></div>
        <div class="gen-xpbar"><span style="width:${rank.pct}%"></span></div>
        <p class="gen-xp-note mono">${GEN.xp.toLocaleString()} XP${rank.next ? ` · ${rank.toNext.toLocaleString()} to next rank` : ' · MAX'}</p>
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
      <button class="gen-mode-card gen-mode-hero cornerframe" data-mode="smart">
        <span class="gen-mode-tag">recommended · endless</span>
        <h2>Smart Review</h2>
        <p>Endless adaptive loop — keeps feeding you your weakest questions (spaced repetition + interleaving) until every one is mastered. Just keep going.</p>
        <span class="gen-mode-go">Study →</span>
      </button>
      <button class="gen-mode-card cornerframe" data-mode="blitz">
        <span class="gen-mode-tag">90s · combo</span>
        <h2>Blitz</h2>
        <p>Rapid-fire across all chapters. Stack combos, chase your high score.</p>
        <span class="gen-mode-go">Start →</span>
      </button>
      <button class="gen-mode-card cornerframe" data-mode="chapter">
        <span class="gen-mode-tag">untimed · learn</span>
        <h2>Chapter Mastery</h2>
        <p>One chapter at a time with full explanations. Build each mastery meter.</p>
        <span class="gen-mode-go">Choose →</span>
      </button>
      <button class="gen-mode-card cornerframe" data-mode="exam">
        <span class="gen-mode-tag">20 Q · 3 lives</span>
        <h2>Exam Boss</h2>
        <p>Mixed Ch 4–6 gauntlet. Beat 85% to slay the boss.${GEN.bestExam ? ` Best: ${GEN.bestExam}%.` : ''}</p>
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
        <span class="label">Mastery by chapter</span>
        ${meter(4)}${meter(5)}${meter(6)}
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
        <li><b>Interleave.</b> Blitz and Smart Review mix chapters on purpose — switching topics beats blocking one at a time.</li>
        <li><b>Chase your weak spots,</b> not what you already know. ≤2 days out: Chapter Mastery once per chapter → Smart Review until 90% → Exam Boss to pressure-test.</li>
      </ol>
    </section>

    <section class="gen-trophy cornerframe">
      <span class="label">Achievements · ${GEN.ach.length}/${GEN_ACH.length}</span>
      <div class="gen-badges">
        ${GEN_ACH.map(a => { const got = GEN.ach.includes(a.id); return `<div class="gen-badge ${got ? 'got' : ''}" title="${esc(a.desc)}"><span class="gen-badge-name">${esc(a.name)}</span><span class="gen-badge-desc">${esc(a.desc)}</span></div>`; }).join('')}
      </div>
    </section>

    <p class="gen-foot-note">${GEN_BANK.length} questions (incl. ${GEN_DIAGRAMS.length} diagram-labeling) · grounded in your Ch 4–6 study guides &amp; Module 2 workshop. <button class="ghostbtn" id="gen-reset">Reset arcade progress</button></p>
  </main>`);

  main.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    const m = b.dataset.mode;
    if (m === 'smart') startGenSmart();
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
    GEN = Object.assign({ unlocked: true, xp: 0, answered: 0, correct: 0, bestScore: 0, bestCombo: 0, bestExam: 0, plays: 0, streak: { current: 0, longest: 0, lastDate: '' }, q: {}, starred: {}, ach: [], examReady: false });
    genSave(); renderGenHome();
  });
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

/* ============================================================================
   CHAPTER PICKER
   ========================================================================= */
function renderGenChapterPick() {
  genClearTimer();
  const card = (ch, blurb) => `<button class="gen-ch-card cornerframe" data-ch="${ch}">
    <span class="gen-ch-num mono">CH ${ch}</span><h2>${GEN_CH[ch]}</h2><p>${blurb}</p>
    <div class="gen-meter"><div class="gen-bar"><span style="width:${genMastery(ch)}%"></span></div></div>
    <span class="mono gen-ch-pct">${genMastery(ch)}% · ${genChapterQs(ch).length} Q</span></button>`;
  const root = el('<div></div>');
  root.appendChild(topbar('genetics'));
  const main = el(`<main class="panel gen-pick" id="main" tabindex="-1">
    <div class="gen-pick-head"><button class="ghostbtn" id="gen-back">← Home</button><h1>Chapter Mastery</h1></div>
    <div class="gen-ch-grid">
      ${card(4, 'Dominance types, epistasis, sex-influenced traits, non-Mendelian inheritance.')}
      ${card(5, 'Recombination, map distance, three-point crosses, gene order.')}
      ${card(6, 'Deletions, inversions, translocations, ploidy, aneuploidy.')}
    </div>
  </main>`);
  main.querySelector('#gen-back').addEventListener('click', renderGenHome);
  main.querySelectorAll('[data-ch]').forEach(b => b.addEventListener('click', () => startGenChapter(+b.dataset.ch)));
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
  genRunQuestion({ mode: 'smart', endless: true, pool: [], idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false, lastId: null, lastTopic: null });
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
  const pick = (ch, n) => genShuffle(genChapterQs(ch)).slice(0, n);
  const pool = genShuffle([...pick(4, 8), ...pick(5, 6), ...pick(6, 6)]).slice(0, 20);
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
  const now = Date.now();
  const pool = GEN_BANK.filter(q => genBox(q.id) < 5);
  if (!pool.length) return null;
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
      <p class="gen-res-ready">Every question is maxed out — you mastered Module 2. Run a maintenance pass anytime to stay sharp.</p>
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
