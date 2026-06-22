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
    + `<text x="78" y="105" class="gsv-pcap">affected ♀</text><text x="150" y="105" class="gsv-pcap">all children affected</text></svg>`;
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

const GEN_DIAGRAMS = [
  { id: 'd-cen-meta', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'easy', tag: 'Centromere position', svg: gChr(75),
    q: 'Classify this chromosome by its centromere position.',
    options: ['Metacentric', 'Acrocentric', 'Telocentric', 'Submetacentric'], answer: 0,
    explain: 'The centromere sits at the middle, giving two arms of roughly equal length — that is a metacentric chromosome.' },
  { id: 'd-cen-sub', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'med', tag: 'Centromere position', svg: gChr(55),
    q: 'Classify this chromosome by its centromere position.',
    options: ['Metacentric', 'Submetacentric', 'Telocentric', 'Acrocentric'], answer: 1,
    explain: 'The centromere is offset from center, producing one shorter (p) and one longer (q) arm — submetacentric.' },
  { id: 'd-cen-acro', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'med', tag: 'Centromere position', svg: gChr(30),
    q: 'Classify this chromosome by its centromere position.',
    options: ['Submetacentric', 'Acrocentric', 'Metacentric', 'Telocentric'], answer: 1,
    explain: 'The centromere lies near one end, leaving a very small short arm — acrocentric. (Robertsonian translocations occur between acrocentric chromosomes.)' },
  { id: 'd-cen-telo', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'med', tag: 'Centromere position', svg: gChr(16),
    q: 'Classify this chromosome by its centromere position.',
    options: ['Acrocentric', 'Telocentric', 'Metacentric', 'Submetacentric'], answer: 1,
    explain: 'The centromere is at the very end with essentially no short arm — telocentric.' },
  { id: 'd-arrow-cen', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'easy', tag: 'Label the part', svg: gChr(55, 55),
    q: 'What structure does the arrow point to?',
    options: ['Telomere', 'Centromere', 'Short (p) arm', 'Chiasma'], answer: 1,
    explain: 'The arrow marks the constricted region of repetitive DNA where sister chromatids are held together — the centromere.' },
  { id: 'd-arrow-p', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'easy', tag: 'Label the arm', svg: gChr(55, 33),
    q: 'The arrow points to which arm of the chromosome?',
    options: ['The q arm (long arm)', 'The p arm (short arm)', 'The centromere', 'The telomere'], answer: 1,
    explain: 'The shorter arm above the centromere is the p arm; the longer arm below is the q arm.' },
  { id: 'd-arrow-q', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'easy', tag: 'Label the arm', svg: gChr(55, 96),
    q: 'The arrow points to which arm of the chromosome?',
    options: ['The p arm (short arm)', 'The q arm (long arm)', 'The centromere', 'A telomere'], answer: 1,
    explain: 'The longer arm below the centromere is the q arm (p = short, q = long).' },
  { id: 'd-inv-para', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'hard', tag: 'Inversion type', svg: gInversion(['A', 'B', 'C', 'D', 'G', 'F', 'E'], 3, 4, 6),
    q: 'A chromosome A·B·C·D·●·E·F·G mutates to the arrangement shown (● = centromere). What rearrangement is this?',
    options: ['Pericentric inversion', 'Paracentric inversion', 'Reciprocal translocation', 'Terminal deletion'], answer: 1,
    explain: 'The reversed segment (E·F·G → G·F·E) lies entirely on one arm and does NOT include the centromere — that defines a paracentric inversion.' },
  { id: 'd-inv-peri', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'hard', tag: 'Inversion type', svg: gInversion(['A', 'B', 'E', 'D', 'C', 'F', 'G'], 1, 2, 4),
    q: 'A chromosome A·B·●·C·D·E·F·G mutates to the arrangement shown (● = centromere, highlighted region reversed). What is it?',
    options: ['Paracentric inversion', 'Pericentric inversion', 'Robertsonian translocation', 'Interstitial deletion'], answer: 1,
    explain: 'The inverted segment spans the centromere (the ● lies inside the reversed region) — that is a pericentric inversion.' },
  { id: 'd-ndj-mi', chapter: 6, topic: 'ch6-number', type: 'label', difficulty: 'med', tag: 'Nondisjunction', svg: gGametes(['n+1', 'n+1', 'n−1', 'n−1']),
    q: 'All four gametes from one meiosis have these chromosome numbers. At which stage did nondisjunction occur?',
    options: ['Meiosis I', 'Meiosis II', 'Mitosis', 'No nondisjunction occurred'], answer: 0,
    explain: 'When ALL four gametes are abnormal (two n+1 and two n−1), homologs failed to separate in meiosis I.' },
  { id: 'd-ndj-mii', chapter: 6, topic: 'ch6-number', type: 'label', difficulty: 'med', tag: 'Nondisjunction', svg: gGametes(['n', 'n', 'n+1', 'n−1']),
    q: 'The four gametes from one meiosis have these chromosome numbers. At which stage did nondisjunction occur?',
    options: ['Meiosis I', 'Meiosis II', 'Fertilization', 'S phase'], answer: 1,
    explain: 'Two normal (n) plus one n+1 and one n−1 means sister chromatids failed to separate in meiosis II (only one of the two MII divisions was affected).' },
  { id: 'd-pun-incdom', chapter: 4, topic: 'ch4-interactions', type: 'label', difficulty: 'med', tag: 'Incomplete dominance', answer: 1,
    svg: gPunnett(['Cʳ', 'Cʷ'], ['Cʳ', 'Cʷ'], [[{ g: 'CʳCʳ', cls: 'red' }, { g: 'CʳCʷ', cls: 'pink' }], [{ g: 'CʳCʷ', cls: 'pink' }, { g: 'CʷCʷ', cls: 'white' }]]),
    q: 'Two pink (CʳCʷ) snapdragons are crossed (incomplete dominance). What F2 phenotypic ratio does this Punnett square give?',
    options: ['3 red : 1 white', '1 red : 2 pink : 1 white', 'All pink', '1 red : 1 white'], answer: 1,
    explain: 'With incomplete dominance the heterozygote is pink, so genotype ratio = phenotype ratio: 1 CʳCʳ (red) : 2 CʳCʷ (pink) : 1 CʷCʷ (white).' },
  { id: 'd-pun-abo', chapter: 4, topic: 'ch4-interactions', type: 'label', difficulty: 'med', tag: 'ABO codominance', answer: 2,
    svg: gPunnett(['Iᴬ', 'i'], ['Iᴮ', 'i'], [[{ g: 'IᴬIᴮ', cls: 'pab' }, { g: 'Iᴮi', cls: 'pb' }], [{ g: 'Iᴬi', cls: 'pa' }, { g: 'ii', cls: 'po' }]]),
    q: 'A type-A (Iᴬi) × type-B (Iᴮi) cross. What blood-type ratio does this Punnett square predict?',
    options: ['All type AB', '3 AB : 1 O', '1 AB : 1 A : 1 B : 1 O', '1 A : 1 B'], answer: 2,
    explain: 'Iᴬ and Iᴮ are codominant and i is recessive, giving four equally likely children: IᴬIᴮ (AB), Iᴬi (A), Iᴮi (B), ii (O) — a 1:1:1:1 ratio.' },
  { id: 'd-pedigree-mito', chapter: 4, topic: 'ch4-nonmendelian', type: 'label', difficulty: 'hard', tag: 'Pedigree', svg: gPedigree(),
    q: 'In this pedigree an affected mother passes the trait to ALL of her children (an affected father would pass it to none). Which inheritance pattern is this?',
    options: ['Autosomal dominant', 'X-linked recessive', 'Mitochondrial (maternal) inheritance', 'Genomic imprinting'], answer: 2,
    explain: 'Transmission exclusively through the mother to all offspring is the hallmark of mitochondrial / maternal (cytoplasmic) inheritance — mtDNA comes from the egg.' },
  { id: 'd-robertson', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'med', tag: 'Translocation', svg: gRobertson(),
    q: 'Two acrocentric chromosomes fuse into a single chromosome as shown. What is this event, and how does the chromosome count change?',
    options: ['Reciprocal translocation; count unchanged', 'Robertsonian translocation; count drops by 1', 'Pericentric inversion; count unchanged', 'Duplication; count rises by 1'], answer: 1,
    explain: 'Fusion of two acrocentric chromosomes at the centromere is a Robertsonian translocation; two chromosomes become one, so the total count drops by 1 (e.g., 48 → 47).' },

  { id: 'd-epistasis-path', chapter: 4, topic: 'ch4-epistasis', type: 'label', difficulty: 'med', tag: 'Epistasis pathway', svg: gPathway('C'),
    q: 'In this sweet-pea pigment pathway, the cc genotype blocks the C enzyme (✗). What is the flower color?',
    options: ['Purple', 'White (colorless)', 'Pink', 'Red'], answer: 1,
    explain: 'Purple pigment needs BOTH enzymes (C and P). With the C enzyme blocked, the pathway stalls at the colorless precursor, so the flower is white — the basis of the 9:7 epistatic ratio.' },
  { id: 'd-grid-97', chapter: 4, topic: 'ch4-epistasis', type: 'label', difficulty: 'med', tag: '9:7 ratio', svg: gGrid([{ n: 9, cls: 'p' }, { n: 7, cls: 'w' }]),
    q: 'This dihybrid cross gives 9 purple (filled) : 7 white (open) offspring. Which interaction produces this ratio?',
    options: ['No gene interaction (simple dominance)', 'Duplicate-recessive epistasis', 'Dominant epistasis', 'Incomplete dominance'], answer: 1,
    explain: 'A 9:7 ratio means both genes must contribute a dominant allele for color; cc OR pp gives white. This duplicate (complementary) recessive epistasis collapses the 3:3:1 classes into the "7 white".' },
  { id: 'd-grid-1231', chapter: 4, topic: 'ch4-epistasis', type: 'label', difficulty: 'hard', tag: '12:3:1 ratio', svg: gGrid([{ n: 12, cls: 'c' }, { n: 3, cls: 'p' }, { n: 1, cls: 'r' }]),
    q: 'A dihybrid cross yields 12 : 3 : 1 (light : purple : red). Which gene interaction is this?',
    options: ['Recessive epistasis', 'Dominant epistasis', 'Duplicate-recessive epistasis', 'No gene interaction (simple dominance)'], answer: 1,
    explain: 'A 12:3:1 ratio is dominant epistasis: a dominant allele at one locus (e.g., I) masks the second gene, so 9+3 = 12 share one phenotype, and only the recessive-at-the-epistatic-gene classes (3 and 1) reveal the second gene.' },
  { id: 'd-crossover', chapter: 5, topic: 'ch5-linkage', type: 'label', difficulty: 'med', tag: 'Recombinant gametes', svg: gCrossover(),
    q: 'A crossover between linked genes A and B produces these four gametes. The two outlined gametes (A b and a B) are:',
    options: ['Parental (nonrecombinant) gametes', 'Recombinant (crossover) gametes', 'Identical to the parents', 'Products of nondisjunction'], answer: 1,
    explain: 'Parental gametes keep the original allele combinations (A B, a b). Crossing over swaps alleles between homologs to make NEW combinations (A b, a B) — the recombinant gametes whose frequency gives map distance.' },
  { id: 'd-map', chapter: 5, topic: 'ch5-threepoint', type: 'label', difficulty: 'med', tag: 'Linkage map', svg: gMap(['A', 'B', 'C'], [5, 12]),
    q: 'Using this linkage map, what is the map distance between genes A and C?',
    options: ['7 cM', '12 cM', '17 cM', '60 cM'], answer: 2,
    explain: 'Map distances between linked genes are additive: A–C = A–B + B–C = 5 + 12 = 17 cM (ignoring rare double crossovers).' },
  { id: 'd-ped-ar', chapter: 4, topic: 'ch4-interactions', type: 'label', difficulty: 'hard', tag: 'Pedigree', svg: gPed({ mother: 'unaff', father: 'unaff', kids: [['c', 'unaff'], ['s', 'aff'], ['c', 'unaff']], cap: 'unaffected parents → affected child' }),
    q: 'Two unaffected parents have an affected child (filled). Which inheritance pattern best fits?',
    options: ['Autosomal dominant', 'Autosomal recessive', 'Mitochondrial', 'Y-linked'], answer: 1,
    explain: 'When two unaffected parents produce an affected child, both parents are carriers (heterozygous) of a recessive allele — autosomal recessive inheritance (the trait can "skip" generations).' },
  { id: 'd-ped-xr', chapter: 4, topic: 'ch4-epistasis', type: 'label', difficulty: 'hard', tag: 'Pedigree', svg: gPed({ mother: 'carrier', father: 'unaff', kids: [['s', 'aff'], ['c', 'carrier'], ['s', 'unaff']], cap: 'carrier mother → affected son' }),
    q: 'A carrier mother (dot) and unaffected father have an affected son; the trait shows up mostly in males. Pattern?',
    options: ['Autosomal recessive', 'X-linked recessive', 'Autosomal dominant', 'Mitochondrial'], answer: 1,
    explain: 'Males (XY) need only one copy of an X-linked recessive allele to be affected, so the trait appears far more in sons, passed from carrier mothers — X-linked recessive inheritance.' },
  { id: 'd-deletion', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'med', tag: 'Deletion', svg: gSeg(['A', 'B', 'C', 'D', 'E', 'F'], [2, 3], 'gone'),
    q: 'Segments C and D (dashed) were lost from the MIDDLE of this chromosome. What is this called?',
    options: ['Terminal deletion', 'Interstitial deletion', 'Duplication', 'Paracentric inversion'], answer: 1,
    explain: 'Loss of an internal segment (not at the end) is an interstitial deletion. A terminal deletion removes material from the chromosome end (involving the telomere).' },
  { id: 'd-dup', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'med', tag: 'Duplication', svg: gSeg(['A', 'B', 'C', 'D', 'C', 'D'], [4, 5], 'dupseg'),
    q: 'Segment C–D now appears twice on this chromosome (highlighted). What structural change is this?',
    options: ['Deletion', 'Duplication', 'Inversion', 'Translocation'], answer: 1,
    explain: 'A repeated chromosomal segment is a duplication — often arising from misaligned crossing over. Duplications add genetic material and are the raw material for gene families (paralogs).' },
  { id: 'd-reciprocal', chapter: 6, topic: 'ch6-structural', type: 'label', difficulty: 'med', tag: 'Translocation', svg: gReciprocal(),
    q: 'These two NON-homologous chromosomes have swapped end segments (colors exchanged). What is this?',
    options: ['Robertsonian translocation', 'Reciprocal translocation', 'Pericentric inversion', 'Interstitial deletion'], answer: 1,
    explain: 'A mutual exchange of segments between two non-homologous chromosomes is a reciprocal translocation. If it is balanced (no net gain/loss) the carrier is usually healthy, but gametes can be unbalanced.' },
  { id: 'd-triploid', chapter: 6, topic: 'ch6-number', type: 'label', difficulty: 'easy', tag: 'Ploidy', svg: gSets([1, 1, 1]),
    q: 'This cell carries three complete chromosome sets. What is its ploidy?',
    options: ['Diploid (2n)', 'Triploid (3n)', 'Tetraploid (4n)', 'Haploid (n)'], answer: 1,
    explain: 'Three complete sets = triploid (3n). Triploids are usually sterile/seedless because an odd number of homologs cannot pair evenly in meiosis.' },
  { id: 'd-allopoly', chapter: 6, topic: 'ch6-number', type: 'label', difficulty: 'hard', tag: 'Polyploidy', svg: gSets([1, 1, 2, 2]),
    q: 'This organism has four sets — two from each of two different species (two colors). What is it?',
    options: ['Autotetraploid', 'Allotetraploid (allopolyploid)', 'Triploid', 'Aneuploid'], answer: 1,
    explain: 'Sets from DIFFERENT species make it an allopolyploid; four total sets = allotetraploid (e.g., Xenopus laevis). Autopolyploidy would be extra sets from the SAME species (one color).' },
  { id: 'd-trisomy', chapter: 6, topic: 'ch6-number', type: 'label', difficulty: 'med', tag: 'Aneuploidy', svg: gKaryoTri(),
    q: 'This partial karyotype shows three copies of chromosome 21 (highlighted). What is this?',
    options: ['Monosomy 21 (2n−1)', 'Trisomy 21 / Down syndrome (2n+1)', 'Triploidy (3n)', 'Balanced translocation'], answer: 1,
    explain: 'Three copies of a single chromosome (here 21) is a trisomy (2n+1) — trisomy 21 is Down syndrome. Triploidy (3n) would be three copies of EVERY chromosome, not just one.' },
];

/* ---------- generated + verified MCQ bank (injected at build) ---------- */
const GEN_GENERATED = /*__BANK__*/[{"id": "g-ch4-alleles-1", "chapter": 4, "topic": "ch4-alleles", "type": "concept", "difficulty": "easy", "q": "A wild-type allele is best defined as one that:", "options": ["Encodes a functional protein in normal amounts and is prevalent in the population", "Always produces a brand-new protein function", "Is always lethal when homozygous", "Encodes a nonfunctional protein at reduced levels"], "answer": 0, "explain": "A wild-type allele is the standard reference allele: it is the most prevalent (common) allele in a natural population and encodes a fully functional protein expressed at normal levels, which is exactly what the correct choice states. By contrast, the idea that an allele always creates a brand-new protein function describes gain-of-function (neomorphic) alleles, not wild-type, and the idea that it encodes a nonfunctional protein at reduced levels describes loss-of-function alleles. The claim that a wild-type allele is always lethal when homozygous is simply false, since wild-type alleles are the normal, viable form carried throughout a population.", "tag": "Wild-type"}, {"id": "g-ch4-alleles-2", "chapter": 4, "topic": "ch4-alleles", "type": "concept", "difficulty": "easy", "q": "When a single gene has two or more common wild-type alleles in a population, this is called:", "options": ["Haploinsufficiency", "Genetic polymorphism", "A dominant-negative effect", "A conditional lethal"], "answer": 1, "explain": "Genetic polymorphism is defined as the existence of two or more common alleles of a gene in a population (conventionally with the rarer allele at a frequency above ~1%), which is exactly the scenario described. The other concepts all describe behaviors of specific mutant alleles rather than the presence of multiple common wild-type alleles: haploinsufficiency is when a single functional copy of a gene cannot produce enough product for a normal phenotype, a dominant-negative effect is when a mutant allele's product interferes with the function of the normal allele, and conditional lethality refers to alleles that are lethal only under certain conditions (such as temperature). Because only genetic polymorphism describes a population having multiple common wild-type alleles, it is the correct answer.", "tag": "Polymorphism"}, {"id": "g-ch4-alleles-3", "chapter": 4, "topic": "ch4-alleles", "type": "concept", "difficulty": "med", "q": "Why are loss-of-function alleles typically RECESSIVE?", "options": ["The mutant protein binds and disables the normal protein", "One functional copy is usually sufficient for a normal phenotype", "They produce an enhanced, brand-new function", "Two functional copies are always required for survival"], "answer": 1, "explain": "Loss-of-function alleles diminish or abolish the gene product, but most genes are haplosufficient: a single wild-type copy makes enough functional protein, so one functional copy is usually sufficient for a normal phenotype. This is why heterozygotes appear normal and the mutant allele is recessive. The idea that the mutant protein binds and disables the normal protein describes a dominant-negative (antimorphic) effect, and an enhanced, brand-new function describes a gain-of-function (neomorphic) effect, both of which are dominant; and the claim that two functional copies are always required for survival is simply false as a general rule, since one healthy copy typically suffices.", "tag": "Loss-of-function"}, {"id": "g-ch4-alleles-4", "chapter": 4, "topic": "ch4-alleles", "type": "concept", "difficulty": "easy", "q": "An allele that produces a protein with an enhanced or new function is typically:", "options": ["Recessive", "Dominant", "Conditionally lethal", "Polymorphic"], "answer": 1, "explain": "An allele encoding a protein with enhanced or novel function is a gain-of-function allele, whose new/increased activity manifests even in the presence of a normal allele, making it typically dominant. Loss-of-function alleles, where the remaining normal allele usually provides enough product, are typically recessive. Thus the correct answer is Dominant.", "tag": "Gain-of-function"}, {"id": "g-ch4-alleles-5", "chapter": 4, "topic": "ch4-alleles", "type": "concept", "difficulty": "med", "q": "A disease shows haploinsufficiency. Which combination correctly describes it?", "options": ["Loss-of-function mutation, dominantly inherited", "Gain-of-function mutation, recessively inherited", "Loss-of-function mutation, recessively inherited", "Gain-of-function mutation, dominantly inherited"], "answer": 0, "explain": "Haploinsufficiency means a single wild-type copy cannot make enough gene product for a normal phenotype, so a heterozygote carrying one broken copy is already affected. The defective allele is loss-of-function (reduced or absent product), and because one working copy isn't sufficient, the trait shows dominant inheritance. The choice pairing loss-of-function with dominant inheritance is therefore correct. A gain-of-function description is wrong because haploinsufficiency is about too little normal product, not a new or overactive function, and a recessive description is wrong because a single functional copy already fails to rescue the phenotype.", "tag": "Haploinsufficiency"}, {"id": "g-ch4-alleles-6", "chapter": 4, "topic": "ch4-alleles", "type": "concept", "difficulty": "med", "q": "A mutant protein disrupts the normal phenotype in a heterozygote by physically binding to and interfering with the normal protein. This is a:", "options": ["Haploinsufficient allele", "Conditional lethal allele", "Dominant-negative mutation", "Wild-type polymorphism"], "answer": 2, "explain": "A dominant-negative (antimorphic) mutation produces an altered protein that physically interferes with the wild-type protein, often by binding it within multimeric complexes, so the phenotype is disrupted even when a normal allele is present, which exactly matches the scenario described. This differs from a haploinsufficient allele, where the defect comes merely from reduced dosage of a single functional copy with no active interference. A conditional lethal allele causes its effect only under specific environmental conditions, and a wild-type polymorphism is simply a benign normal variant, so neither involves a mutant protein sabotaging the normal one. Because the described allele actively binds and blocks the wild-type protein, the dominant-negative mutation is uniquely correct.", "tag": "Dominant-negative"}, {"id": "g-ch4-alleles-7", "chapter": 4, "topic": "ch4-alleles", "type": "concept", "difficulty": "hard", "q": "Both haploinsufficiency and dominant-negative mutations are dominant. What distinguishes them mechanistically?", "options": ["Haploinsufficiency interferes with the normal protein; dominant-negative does not", "Haploinsufficiency results from too little functional product; dominant-negative protein actively interferes with the normal protein", "Both are gain-of-function with enhanced activity", "Dominant-negative is recessive while haploinsufficiency is dominant"], "answer": 1, "explain": "The key mechanistic distinction is that haploinsufficiency results from too little functional product while a dominant-negative protein actively interferes with the normal protein. In haploinsufficiency, a single working allele simply makes too little product to support a normal phenotype, yet that product still functions correctly; it is purely a dosage problem. A dominant-negative mutation instead produces an altered protein that sabotages the wild-type protein (for example, by poisoning multimeric complexes or tying up binding partners), so it disrupts function beyond mere dose reduction. The choice claiming both are gain-of-function with enhanced activity is wrong because both are loss-of-function effects, the claim that haploinsufficiency interferes with the normal protein while dominant-negative does not reverses the actual mechanisms, and calling dominant-negative recessive is incorrect since both inheritance patterns are dominant.", "tag": "Dominant mechanisms"}, {"id": "g-ch4-alleles-8", "chapter": 4, "topic": "ch4-alleles", "type": "concept", "difficulty": "easy", "q": "Which is an example of a NONESSENTIAL gene as framed in the course?", "options": ["Huntington disease allele", "The temperature-sensitive fur-color allele in the arctic fox", "A haploinsufficient developmental gene", "A recessive lethal allele"], "answer": 1, "explain": "A nonessential gene is one not required for survival, affecting only a non-vital trait. The temperature-sensitive fur-color allele in the arctic fox simply alters coat color in a conditional way and has no effect on viability, which makes it nonessential. By contrast, the Huntington disease allele and the recessive lethal allele both cause death, and the haploinsufficient developmental gene is essential because normal development requires its full gene dosage. Since only the arctic fox coat-color allele influences a survivable, non-vital trait, it is the example of a nonessential gene.", "tag": "Nonessential genes"}, {"id": "g-ch4-alleles-9", "chapter": 4, "topic": "ch4-alleles", "type": "calc", "difficulty": "med", "q": "Two heterozygotes (Aa x Aa) are crossed; the AA homozygote dies before birth. What phenotypic ratio appears among the SURVIVORS?", "options": ["3:1", "1:1", "2:1", "9:7"], "answer": 2, "explain": "Aa x Aa yields a 1 AA : 2 Aa : 1 aa genotypic ratio. Removing the lethal AA class leaves 2 Aa : 1 aa among survivors, a 2:1 phenotypic ratio (assuming Aa and aa are phenotypically distinguishable, which they must be for a meaningful ratio). This is the standard recessive-lethal allele result that converts the usual 3:1 into 2:1.", "tag": "2:1 ratio"}, {"id": "g-ch4-alleles-10", "chapter": 4, "topic": "ch4-alleles", "type": "calc", "difficulty": "hard", "q": "From an Aa x Aa cross where the AA genotype is lethal, 90 surviving offspring are scored. Approximately how many are expected to be heterozygous (Aa)?", "options": ["30", "45", "60", "90"], "answer": 2, "explain": "Aa x Aa gives a 1 AA : 2 Aa : 1 aa genotypic ratio, but the AA class dies, so among survivors the ratio is 2 Aa : 1 aa. Heterozygotes therefore make up 2/3 of survivors: (2/3)(90) = 60 Aa (with 30 aa). Choosing 45 would incorrectly apply a 3:1 ratio to the lethal-adjusted population.", "tag": "2:1 ratio"}, {"id": "g-ch4-alleles-11", "chapter": 4, "topic": "ch4-alleles", "type": "concept", "difficulty": "med", "q": "Which statement about lethal alleles is correct per the course?", "options": ["Lethal alleles must always be recessive", "Huntington disease is a lethal allele causing neurodegeneration", "Lethal alleles can never alter survivor ratios", "A conditional lethal kills regardless of the environment"], "answer": 1, "explain": "Huntington disease is the correct example because it is a dominant lethal allele that causes progressive neurodegeneration, showing that a lethal allele can act dominantly. The claim that lethal alleles must always be recessive is false, since they can be either dominant or recessive. The idea that lethal alleles never alter survivor ratios is also wrong, because recessive lethals shift the expected 3:1 ratio to 2:1 among survivors. Finally, a conditional lethal is not lethal regardless of the environment; it kills only under specific restrictive conditions, such as a particular temperature.", "tag": "Lethal alleles"}, {"id": "g-ch4-alleles-12", "chapter": 4, "topic": "ch4-alleles", "type": "concept", "difficulty": "hard", "q": "An allele is lethal only at high temperature but allows survival at low temperature. This is best described as a:", "options": ["Conditional lethal allele", "Dominant-negative allele", "Haploinsufficient allele", "Genetic polymorphism"], "answer": 0, "explain": "A conditional lethal allele causes death only under a specific (restrictive) condition while permitting survival under the permissive condition; an allele that is lethal at high temperature but viable at low temperature is the classic temperature-sensitive example. A dominant-negative allele describes a mutant product that interferes with the normal one, and haploinsufficiency describes a single functional copy being inadequate, both of which concern mechanisms of dominance rather than condition-dependent viability. A genetic polymorphism simply refers to multiple common variants existing in a population, so the conditional lethal allele is the only correct description.", "tag": "Conditional lethal"}, {"id": "g-ch4-interactions-1", "chapter": 4, "topic": "ch4-interactions", "type": "concept", "difficulty": "easy", "q": "In a snapdragon cross, red x white gives all pink F1 plants. What does this pattern demonstrate?", "options": ["Codominance", "Incomplete dominance", "Overdominance", "Incomplete penetrance"], "answer": 1, "explain": "A pink heterozygote that is intermediate between the red and white homozygous parents is the textbook example of incomplete dominance, where neither allele fully masks the other and the phenotype blends. This rules out codominance, which would show both red AND white expressed at the same time (like a roan or variegated coat) rather than a single blended color. It also isn't overdominance, where the heterozygote exceeds both parents (typically in fitness), nor incomplete penetrance, where only some individuals carrying a genotype actually display the trait — neither matches the uniform intermediate blend seen here.", "tag": "Incomplete dominance"}, {"id": "g-ch4-interactions-2", "chapter": 4, "topic": "ch4-interactions", "type": "calc", "difficulty": "med", "q": "Red and white flowers (incomplete dominance) are crossed; the F1 are all pink. If F1 are self-crossed, what is the expected F2 phenotypic ratio?", "options": ["3 red : 1 white", "1 red : 2 pink : 1 white", "9 red : 7 white", "1 red : 1 white"], "answer": 1, "explain": "Crossing true-breeding red (RR) with white (R'R') produces all pink (RR') F1, because incomplete dominance gives the heterozygote its own blended phenotype rather than masking one allele. Selfing the pink F1 (RR' x RR') yields a 1:2:1 genotypic ratio of RR : RR' : R'R', and since each genotype shows a distinct color, this maps directly to 1 red : 2 pink : 1 white. A 3:1 ratio would only appear under complete dominance, and a 9:7 ratio reflects gene interaction (epistasis); neither applies here, and a simple 1 red : 1 white split wrongly ignores the pink heterozygotes.", "tag": "1:2:1 ratio"}, {"id": "g-ch4-interactions-3", "chapter": 4, "topic": "ch4-interactions", "type": "calc", "difficulty": "med", "q": "Crossing a pink snapdragon with a white snapdragon (incomplete dominance), what fraction of offspring are expected to be pink?", "options": ["1/4", "1/2", "3/4", "All of them"], "answer": 1, "explain": "In snapdragons with incomplete dominance, pink is the heterozygote (Rr, one red and one white allele) and white is homozygous (rr). Crossing Rr x rr produces a 1:1 ratio: 1/2 Rr (pink) and 1/2 rr (white). Therefore 1/2 of the offspring are expected to be pink.", "tag": "Pink x white"}, {"id": "g-ch4-interactions-4", "chapter": 4, "topic": "ch4-interactions", "type": "concept", "difficulty": "easy", "q": "A person with type AB blood expresses both A and B antigens. This is the classic example of which inheritance pattern?", "options": ["Incomplete dominance", "Codominance", "Overdominance", "Variable expressivity"], "answer": 1, "explain": "Type AB blood is the textbook example of codominance: the I^A and I^B alleles are each fully expressed in the heterozygote, so both A and B antigens appear simultaneously on the red blood cell surface. This contrasts with incomplete dominance, which would yield a single blended intermediate phenotype rather than both distinct antigens. Overdominance (heterozygote advantage) and variable expressivity describe unrelated phenomena.", "tag": "Codominance"}, {"id": "g-ch4-interactions-5", "chapter": 4, "topic": "ch4-interactions", "type": "concept", "difficulty": "med", "q": "The I^A and I^B alleles encode enzymes that modify the H antigen. What type of enzyme are these?", "options": ["DNA polymerases", "Glycosyltransferases that add sugars to the H antigen", "Antibodies against red blood cells", "Proteases that cleave the H antigen"], "answer": 1, "explain": "The I^A and I^B alleles encode glycosyltransferases, enzymes that add a terminal sugar onto the H antigen precursor: the A enzyme transfers N-acetylgalactosamine and the B enzyme transfers galactose, producing the A and B antigens respectively. This sugar-adding function is exactly why \"glycosyltransferases that add sugars to the H antigen\" is correct. They do not destroy the H antigen, so a protease that cleaves it is wrong; they synthesize DNA-unrelated carbohydrate structures, not nucleic acids, ruling out DNA polymerases; and they are metabolic enzymes, not immune proteins, so antibodies against red blood cells is also incorrect.", "tag": "Glycosyltransferase"}, {"id": "g-ch4-interactions-6", "chapter": 4, "topic": "ch4-interactions", "type": "concept", "difficulty": "med", "q": "A person with type A blood naturally produces which antibodies in their serum?", "options": ["Anti-A antibodies", "Anti-B antibodies", "Both anti-A and anti-B", "Neither anti-A nor anti-B"], "answer": 1, "explain": "Type A individuals express the A antigen on their red cells and, by Landsteiner's rule, do not produce antibodies against their own antigen, so no anti-A. They naturally produce antibodies against the foreign B antigen, giving anti-B antibodies in their serum. Therefore the correct option is anti-B antibodies.", "tag": "ABO antibodies"}, {"id": "g-ch4-interactions-7", "chapter": 4, "topic": "ch4-interactions", "type": "calc", "difficulty": "hard", "q": "A type A father (I^A i) and a type B mother (I^B i) have children. Which blood types are possible among their offspring?", "options": ["Only A and B", "Only AB", "A, B, AB, or O", "Only O"], "answer": 2, "explain": "The father (I^A i) can pass on I^A or i, and the mother (I^B i) can pass on I^B or i, so the four equally likely offspring genotypes are I^A I^B (AB), I^A i (A), I^B i (B), and i i (O). Because I^A and I^B are codominant while i is recessive, every one of these combinations shows up, so all four ABO types—A, B, AB, or O—are possible. The notion that only A and B appear ignores the new I^A I^B (AB) and i i (O) combinations; the claim of only AB wrongly assumes neither parent passes the recessive i; and the only-O idea is impossible since neither parent carries two i alleles to guarantee an i i child.", "tag": "ABO cross"}, {"id": "g-ch4-interactions-8", "chapter": 4, "topic": "ch4-interactions", "type": "concept", "difficulty": "med", "q": "Individuals with sickle-cell TRAIT (heterozygotes) resist malaria better than either homozygote. This higher heterozygote fitness is called what?", "options": ["Incomplete dominance", "Codominance", "Overdominance (heterozygote advantage)", "Incomplete penetrance"], "answer": 2, "explain": "Overdominance, or heterozygote advantage, is defined as the heterozygote having greater fitness than either homozygote. Sickle-cell trait carriers (HbA/HbS) resist malaria better than HbA/HbA individuals while avoiding the severe disease of HbS/HbS, exactly fitting this definition. Incomplete dominance and codominance describe phenotypic expression patterns, not fitness, and incomplete penetrance concerns whether a genotype produces its expected phenotype.", "tag": "Overdominance"}, {"id": "g-ch4-interactions-9", "chapter": 4, "topic": "ch4-interactions", "type": "concept", "difficulty": "med", "q": "A dominant allele for polydactyly is described as '70% penetrant.' What does this mean?", "options": ["Affected individuals have 70% of the normal number of fingers", "70% of individuals carrying the genotype actually express the phenotype", "The allele is expressed in 70% of cells in each individual", "70% of the offspring will inherit the allele"], "answer": 1, "explain": "Penetrance is the proportion of individuals carrying a given genotype who actually express the associated phenotype, so \"70% penetrant\" means 70% of allele carriers show polydactyly while the other 30% carry the allele yet appear phenotypically normal (incomplete penetrance). That is exactly what the choice describing 70% of genotype carriers expressing the phenotype captures. The idea that affected people have 70% of the normal finger count confuses penetrance with expressivity (the degree or severity of a trait in those who do express it); the idea that the allele acts in only 70% of cells confuses it with cellular mosaicism; and the idea that 70% of offspring inherit the allele confuses it with transmission or inheritance probability.", "tag": "Penetrance"}, {"id": "g-ch4-interactions-10", "chapter": 4, "topic": "ch4-interactions", "type": "concept", "difficulty": "med", "q": "Among people with polydactyly, some have one extra digit and others have several. This variation in the DEGREE of the trait is best described as:", "options": ["Incomplete penetrance", "Variable expressivity", "Codominance", "Overdominance"], "answer": 1, "explain": "Variable expressivity is correct because it describes how the DEGREE or severity of a phenotype differs among individuals who all express the trait—here, every polydactyly patient has extra digits but they vary in how many. This is distinct from penetrance, which concerns whether the trait appears at all (all-or-none), not its intensity. Codominance (both alleles fully expressed in a heterozygote) and overdominance (heterozygote advantage) describe allelic interactions rather than variation in the strength of an expressed phenotype, so they don't fit. Thus variable expressivity is uniquely correct.", "tag": "Expressivity"}, {"id": "g-ch4-interactions-11", "chapter": 4, "topic": "ch4-interactions", "type": "concept", "difficulty": "hard", "q": "Which statement correctly distinguishes penetrance from expressivity?", "options": ["Penetrance is the degree of expression; expressivity is whether the trait appears at all", "Penetrance is whether (all-or-none) the trait appears; expressivity is the degree to which it is expressed", "Both terms describe blending of phenotypes in heterozygotes", "Both terms describe higher fitness of heterozygotes"], "answer": 1, "explain": "Penetrance is all-or-none: the proportion of individuals carrying a genotype who actually express the associated phenotype at all. Expressivity, by contrast, describes the degree or severity of that phenotype among the individuals who do express it. This is why the correct choice pairs penetrance with whether the trait appears and expressivity with how strongly it is expressed; the choice that assigns \"degree of expression\" to penetrance and \"whether it appears\" to expressivity simply reverses the two definitions. The choices describing blending of phenotypes in heterozygotes (incomplete dominance) and higher heterozygote fitness (heterozygote advantage) are unrelated concepts and define neither term.", "tag": "Penetrance vs expressivity"}, {"id": "g-ch4-interactions-12", "chapter": 4, "topic": "ch4-interactions", "type": "calc", "difficulty": "hard", "q": "A dominant allele is 70% penetrant. If 200 people in a population carry the genotype, approximately how many are expected to express the phenotype?", "options": ["60", "70", "140", "200"], "answer": 2, "explain": "Penetrance is the proportion of individuals carrying a genotype who actually express the associated phenotype. With 70% penetrance, 0.70 × 200 = 140 carriers are expected to display the trait, making 140 correct. The value 60 reflects the non-penetrant carriers who have the allele but stay silent, not those expressing it; 70 mistakenly treats the 70% figure as a raw count instead of applying it to all 200 carriers; and 200 wrongly assumes complete penetrance, where every carrier would show the phenotype.", "tag": "Penetrance calc"}, {"id": "g-ch5-linkage-1", "chapter": 5, "topic": "ch5-linkage", "type": "concept", "difficulty": "easy", "q": "Genes that sit close together on the same chromosome tend to be inherited together. What principle does this violate?", "options": ["Independent assortment", "Segregation", "Dominance", "Complete penetrance"], "answer": 0, "explain": "Mendel's law of independent assortment states that alleles of different genes separate into gametes independently of one another. Genes that lie close together on the same chromosome are physically linked and tend to be transmitted together rather than independently, directly violating this law. Segregation (separation of allele pairs), dominance, and complete penetrance describe unrelated phenomena, so independent assortment is the only correct choice.", "tag": "Linkage"}, {"id": "g-ch5-linkage-2", "chapter": 5, "topic": "ch5-linkage", "type": "concept", "difficulty": "easy", "q": "How many linkage groups do humans have?", "options": ["46", "23", "24", "22"], "answer": 2, "explain": "A linkage group is the set of genes on a single distinct chromosome that tend to be inherited together. Humans have 22 autosomes plus two distinct sex chromosomes, X and Y, which carry different genes and therefore count as two separate linkage groups. This gives 22 + 2 = 24 linkage groups, the standard textbook answer (note it is 24, not the 23 chromosome-pair count, because X and Y are nonhomologous).", "tag": "Linkage groups"}, {"id": "g-ch5-linkage-3", "chapter": 5, "topic": "ch5-linkage", "type": "concept", "difficulty": "med", "q": "During which stage of meiosis does crossing over occur?", "options": ["Metaphase II", "Pachytene of prophase I", "Anaphase I", "Telophase I"], "answer": 1, "explain": "Crossing over occurs during pachytene of prophase I, when homologous chromosomes are fully synapsed via the synaptonemal complex and physically exchange segments at recombination nodules. This reciprocal exchange produces recombinant chromatids and is the molecular basis of genetic recombination. The other listed stages (metaphase II, anaphase I, telophase I) occur after recombination is complete and involve no DNA exchange.", "tag": "Crossing over"}, {"id": "g-ch5-linkage-4", "chapter": 5, "topic": "ch5-linkage", "type": "calc", "difficulty": "easy", "q": "A testcross yields 50 recombinant offspring out of 500 total. What is the map distance between the two genes?", "options": ["5 cM", "10 cM", "20 cM", "50 cM"], "answer": 1, "explain": "Recombination frequency equals the number of recombinant offspring divided by total offspring: 50/500 = 0.10 = 10%. By the standard convention, 1% recombination frequency equals 1 map unit (centiMorgan), so 10% RF corresponds to a map distance of 10 cM. Thus the genes are 10 cM apart.", "tag": "Map distance"}, {"id": "g-ch5-linkage-5", "chapter": 5, "topic": "ch5-linkage", "type": "concept", "difficulty": "med", "q": "In a three-point testcross, which class of offspring is the RAREST?", "options": ["Parental (nonrecombinant)", "Single crossover", "Double crossover", "All classes are equal"], "answer": 2, "explain": "In a three-point testcross, the frequency of a crossover class reflects the joint probability of the required exchanges. Parentals (no crossover) are most frequent, single crossovers (one exchange in one interval) are intermediate, and double crossovers require two simultaneous, independent exchanges, so their frequency is roughly the product of the two single-crossover frequencies—making them the rarest. This rarity is precisely why the DCO classes are used to identify the middle gene and determine gene order.", "tag": "Double crossover"}, {"id": "g-ch5-linkage-6", "chapter": 5, "topic": "ch5-linkage", "type": "concept", "difficulty": "med", "q": "To find the MIDDLE gene in a three-point cross, what do you compare?", "options": ["The two parental classes to each other", "The double crossover classes to the parental classes", "The single crossover classes to each other", "Total offspring to recombinant offspring"], "answer": 1, "explain": "To find the middle gene, compare the double crossover (DCO) classes—the two rarest phenotypes—to the parental (non-crossover) classes: a double crossover repositions only the central gene while leaving the two outer genes in their parental arrangement, so the single allele that appears flipped between the DCO and parental groups identifies the middle gene. This is the standard Klug/Pierce method, which is why comparing the double crossover classes to the parental classes is correct. Comparing the single crossover classes, the two parental classes, or total versus recombinant offspring instead measures map distances or overall recombination frequency and cannot reveal gene order.", "tag": "Gene order"}, {"id": "g-ch5-linkage-7", "chapter": 5, "topic": "ch5-linkage", "type": "calc", "difficulty": "med", "q": "In a corn three-point cross (total 10,756), the Wx-V map distance uses classes 292, 280, 87, and 94. What is the Wx-V distance?", "options": ["7 m.u.", "30 m.u.", "37 m.u.", "3.5 m.u."], "answer": 0, "explain": "The map distance between Wx and V equals the recombination frequency across that interval: add every progeny class showing a crossover between the two genes (both single-crossover classes and both double-crossover classes), divide by the total progeny, and multiply by 100. That gives (292+280+87+94)/10,756 × 100 = 753/10,756 × 100 ≈ 7.0 m.u., so \"7 m.u.\" is correct. The \"30 m.u.\" answer comes from misassigning the larger reciprocal classes to this interval, \"37 m.u.\" from adding two different intervals together, and \"3.5 m.u.\" from mistakenly halving the recombinants instead of counting all of them.", "tag": "Map distance"}, {"id": "g-ch5-linkage-8", "chapter": 5, "topic": "ch5-linkage", "type": "calc", "difficulty": "med", "q": "A three-point cross of 1000 offspring gives DCO classes CSW = 5 and csw = 5. What is the double crossover frequency?", "options": ["0.5%", "1%", "5%", "10%"], "answer": 1, "explain": "Double crossover frequency equals the total double-crossover offspring (both reciprocal DCO classes, CSW = 5 and csw = 5) divided by all offspring, times 100: (5 + 5)/1000 × 100 = 10/1000 × 100 = 1%, so \"1%\" is correct. The choice \"0.5%\" wrongly counts only one of the two reciprocal DCO classes instead of summing them. \"5%\" mistakenly reports the size of a single DCO class (5/1000 would be 0.5%, and treating \"5\" as a raw count rather than a frequency is the error), while \"10%\" misplaces the decimal by using 10/1000 as 0.10 rather than 0.01.", "tag": "DCO frequency"}, {"id": "g-ch5-linkage-9", "chapter": 5, "topic": "ch5-linkage", "type": "calc", "difficulty": "hard", "q": "In the C/S/W cross (total 1000), parentals are CsW = 350 and cSw = 350. The DCO classes CSW = 5 and csw = 5 differ only at S. With gene order C-10cM-S-21cM-W, what is the total recombinant percentage?", "options": ["1%", "10%", "21%", "30%"], "answer": 3, "explain": "The two parental classes (CsW + cSw) total 700, so all recombinant (non-parental) offspring = 1000 - 700 = 300, giving a total recombinant frequency of 300/1000 = 30%. This is internally consistent: the C-S interval shows 10% recombination (90 SCO + 10 DCO = 100) and the S-W interval 21% (200 SCO + 10 DCO = 210), and parentals + all crossover classes (700+90+200+10) sum to 1000. The 30% figure is the directly observed fraction of recombinant gametes, distinct from the additive C-W map distance of 31 cM.", "tag": "Recombinant %"}, {"id": "g-ch5-linkage-10", "chapter": 5, "topic": "ch5-linkage", "type": "calc", "difficulty": "hard", "q": "Genes are ordered D - E - F. If D-E = 8 m.u. and E-F = 12 m.u., what is the D-F map distance?", "options": ["4 m.u.", "12 m.u.", "20 m.u.", "96 m.u."], "answer": 2, "explain": "When one gene lies between the other two, the component map distances add: D-F = D-E + E-F = 8 + 12 = 20 m.u. Since E is the middle gene, the two separately measured flanking distances sum directly. (Underestimation from double crossovers applies only to a distance measured directly from recombinant frequency across the whole interval, not to summed component distances.)", "tag": "Additive distance"}, {"id": "g-ch5-linkage-11", "chapter": 5, "topic": "ch5-linkage", "type": "concept", "difficulty": "hard", "q": "Twin spotting in an organism is taken as evidence of what process?", "options": ["Mitotic recombination", "Nondisjunction", "Independent assortment", "Pericentric inversion"], "answer": 0, "explain": "Twin spots are adjacent patches of differently-marked mutant tissue (e.g., yellow and singed in Drosophila) that arise when mitotic crossing over in a heterozygous somatic cell segregates the recessive alleles so that the two daughter cells become homozygous for different markers. This is the basis of Stern's classic demonstration of mitotic recombination. Nondisjunction, independent assortment, and inversions do not produce these characteristic paired reciprocal clones, so mitotic recombination is the unique correct answer.", "tag": "Mitotic recombination"}, {"id": "g-ch5-threepoint-1", "chapter": 5, "topic": "ch5-threepoint", "type": "concept", "difficulty": "easy", "q": "In a 3-point testcross, which offspring class is the RAREST?", "options": ["Parental (nonrecombinant)", "Single crossovers", "Double crossovers", "All classes are equal"], "answer": 2, "explain": "In a 3-point testcross, parental (nonrecombinant) classes are most frequent, single crossovers are intermediate, and double crossovers (DCO) are rarest. A DCO requires two simultaneous crossover events, and its frequency equals the product of the two single-crossover probabilities, making it the smallest class. This is precisely why the DCO classes are used to identify the middle gene (the gene whose alleles are switched relative to the parentals).", "tag": "DCO frequency"}, {"id": "g-ch5-threepoint-2", "chapter": 5, "topic": "ch5-threepoint", "type": "concept", "difficulty": "med", "q": "How do you determine which gene is in the MIDDLE in a three-point cross?", "options": ["Compare the two parental classes to each other", "Compare the DCO classes to the parental classes; the gene that is flipped is the middle gene", "Find the most frequent class", "Add all single crossovers together"], "answer": 1, "explain": "In a three-point cross, double-crossover (DCO) gametes are the rarest classes, and a double crossover flips only the middle gene relative to the parental arrangement. So if you line up a DCO gamete against a parental gamete, the single locus whose allele has switched is the middle gene. Comparing the two parentals to each other or picking the most frequent class only reveals the parental arrangement (gene order stays hidden), and adding up single crossovers yields map distances, not gene order, which is why comparing DCO to parental classes is the correct way to find the middle gene.", "tag": "Gene order"}, {"id": "g-ch5-threepoint-3", "chapter": 5, "topic": "ch5-threepoint", "type": "calc", "difficulty": "easy", "q": "A testcross yields 50 recombinant offspring out of 500 total. What is the map distance between the two genes?", "options": ["5 cM", "10 cM", "20 cM", "50 cM"], "answer": 1, "explain": "Map distance in centimorgans equals the recombination frequency expressed as a percentage. RF = (recombinant offspring / total offspring) × 100 = (50/500) × 100 = 10%. Since 1% recombination corresponds to 1 cM (1 map unit), the map distance is 10 cM. This standard one-to-one relationship holds for small distances like this one.", "tag": "RF calc"}, {"id": "g-ch5-threepoint-4", "chapter": 5, "topic": "ch5-threepoint", "type": "calc", "difficulty": "med", "q": "In a 1000-offspring testcross, the DCO classes are CSW = 5 and csw = 5. What is the DCO frequency?", "options": ["0.5%", "1%", "5%", "10%"], "answer": 1, "explain": "Double-crossover frequency = (total DCO offspring / total offspring) × 100. Both reciprocal DCO classes (CSW = 5 and csw = 5) must be summed, giving 10 doubles out of 1000, so 10/1000 × 100 = 1%. The answer 1% is correct; 0.5% wrongly counts only one of the two reciprocal DCO classes, while 5% and 10% misread the raw counts or totals as a percentage instead of dividing the combined 10 by the full 1000 offspring.", "tag": "DCO freq"}, {"id": "g-ch5-threepoint-5", "chapter": 5, "topic": "ch5-threepoint", "type": "calc", "difficulty": "easy", "q": "If gene E lies between D and F, with D-E = 12 cM and E-F = 18 cM, what is the D-F map distance?", "options": ["6 cM", "15 cM", "30 cM", "216 cM"], "answer": 2, "explain": "Map distances along a chromosome are additive, so when E lies between D and F, the D-F distance equals the sum of the two intervals: D-F = D-E + E-F = 12 + 18 = 30 cM. At this scale the additive sum is the intended answer (any double-crossover correction would only slightly reduce it and is not invoked here).", "tag": "Additivity"}, {"id": "g-ch5-threepoint-6", "chapter": 5, "topic": "ch5-threepoint", "type": "calc", "difficulty": "hard", "q": "In the corn cross (total 10,756), the Wx-V SCO classes are 292 and 280, and the DCO classes are 87 and 94. What is the Wx-V map distance?", "options": ["5 m.u.", "7 m.u.", "30 m.u.", "37 m.u."], "answer": 1, "explain": "Map distance between a gene pair equals the percentage of recombinants in that interval: single crossovers separating the pair plus the double crossovers (which also recombine that interval). (292 + 280 + 87 + 94)/10756 × 100 = 753/10756 × 100 = 7.0 m.u. Omitting the DCOs would underestimate the distance, so they must be added in.", "tag": "Map distance"}, {"id": "g-ch5-threepoint-7", "chapter": 5, "topic": "ch5-threepoint", "type": "calc", "difficulty": "hard", "q": "Corn cross (total 10,756): Sh-V SCO classes are 1515 and 1531, DCO classes are 87 and 94. What is the Sh-V map distance?", "options": ["7 m.u.", "28 m.u.", "30 m.u.", "37 m.u."], "answer": 2, "explain": "Map distance equals the percentage of recombinant offspring in the Sh-V interval, which includes both single-crossover classes (1515 + 1531) AND both double-crossover classes (87 + 94), because every DCO also carries a crossover within the Sh-V region. So (1515+1531+87+94)/10756 × 100 = 3227/10756 × 100 = 30.0 m.u., making \"30 m.u.\" correct. The \"28 m.u.\" answer comes from wrongly omitting the DCOs (counting only 1515+1531), and \"37 m.u.\" or \"7 m.u.\" come from miscounting which classes recombine in this interval rather than properly adding the SCOs plus twice the DCO contribution.", "tag": "Map distance"}, {"id": "g-ch5-threepoint-8", "chapter": 5, "topic": "ch5-threepoint", "type": "calc", "difficulty": "med", "q": "C/S/W cross (total 1000): there are 300 recombinant offspring. What is the overall recombinant percentage?", "options": ["3%", "30%", "70%", "1%"], "answer": 1, "explain": "Recombinant frequency = (number of recombinant offspring / total offspring) × 100 = (300/1000) × 100 = 30%. This is the standard definition used to compute map distances in cM, so the overall recombinant percentage is 30%.", "tag": "Recombinant %"}, {"id": "g-ch5-threepoint-9", "chapter": 5, "topic": "ch5-threepoint", "type": "concept", "difficulty": "easy", "q": "How many linkage groups do humans have?", "options": ["23", "24", "46", "22"], "answer": 1, "explain": "A linkage group is a set of genes that tend to be inherited together because they lie on the same chromosome; the count equals the number of genetically distinct chromosome types, not the diploid total, since homologous pairs share the same loci. Humans have 22 autosomes plus two non-homologous sex chromosomes (X and Y) carrying largely distinct genes, so X and Y count separately. This yields 22 + 1 + 1 = 24 linkage groups, the standard Klug/Pierce textbook value.", "tag": "Linkage groups"}, {"id": "g-ch5-threepoint-10", "chapter": 5, "topic": "ch5-threepoint", "type": "concept", "difficulty": "med", "q": "At what stage of meiosis does crossing over occur?", "options": ["Metaphase II", "Pachytene of prophase I", "Anaphase I", "Telophase II"], "answer": 1, "explain": "Crossing over occurs at pachytene of prophase I, when homologous chromosomes are fully synapsed via the synaptonemal complex and reciprocal physical exchange between non-sister chromatids takes place at chiasmata. This generates recombinant chromatids and thus recombinant gametes. Metaphase II, anaphase I, and telophase II all occur after recombination is complete.", "tag": "Crossing over"}, {"id": "g-ch5-threepoint-11", "chapter": 5, "topic": "ch5-threepoint", "type": "concept", "difficulty": "easy", "q": "A testcross is defined as a cross between a heterozygote and which type of individual?", "options": ["A homozygous recessive individual", "A homozygous dominant individual", "Another identical heterozygote", "A different species"], "answer": 0, "explain": "A testcross is a cross between an individual of unknown/heterozygous genotype and a homozygous recessive individual. Because the homozygous recessive parent can only contribute recessive alleles, every offspring's phenotype is determined solely by the allele inherited from the other parent, directly revealing that parent's gamete types and any linkage relationships.", "tag": "Testcross"}, {"id": "g-ch5-threepoint-12", "chapter": 5, "topic": "ch5-threepoint", "type": "concept", "difficulty": "med", "q": "Twin spotting is taken as evidence of what rare genetic event?", "options": ["Mitotic recombination", "Nondisjunction in meiosis I", "Double crossover in meiosis", "Independent assortment"], "answer": 0, "explain": "Twin spotting is the signature of mitotic (somatic) recombination. In a cell heterozygous for two linked markers, a rare crossover between the centromere and the loci followed by segregation yields two adjacent daughter clones, each homozygous for the opposite marker, producing the characteristic side-by-side twin patches (e.g., Stern's yellow and singed spots in Drosophila). Meiotic events (nondisjunction, double crossover, independent assortment) act in germ cells and do not generate adjacent reciprocal somatic clones.", "tag": "Twin spotting"}, {"id": "g-ch5-threepoint-13", "chapter": 5, "topic": "ch5-threepoint", "type": "calc", "difficulty": "hard", "q": "In the C/S/W cross, S is the middle gene with C-S = 10 cM and S-W = 21 cM. Using additivity, what is the C-W distance?", "options": ["11 cM", "21 cM", "31 cM", "210 cM"], "answer": 2, "explain": "With S as the middle gene, C and W are the flanking markers, so under additivity the map distances simply add: C-W = C-S + S-W = 10 + 21 = 31 cM, the standard textbook result. The 21 cM answer mistakes the S-W interval alone for the full C-W distance, while 11 cM wrongly subtracts the intervals instead of summing them, and 210 cM comes from multiplying rather than adding. Note that the directly measured flanking recombination frequency may run slightly below 31 cM because undetected double crossovers go uncounted, but the additive map distance is 31 cM.", "tag": "Additivity"}, {"id": "g-ch6-structural-1", "chapter": 6, "topic": "ch6-structural", "type": "concept", "difficulty": "easy", "q": "A chromosome has its centromere positioned very near one end. What is it called?", "options": ["Metacentric", "Submetacentric", "Acrocentric", "Telocentric"], "answer": 2, "explain": "Acrocentric is correct because an acrocentric chromosome has its centromere very near—but not exactly at—one end, producing one very short arm and one long arm (human chromosomes 13, 14, 15, 21, and 22 are examples). A metacentric chromosome is wrong because its centromere sits in the middle, giving two arms of roughly equal length, and a submetacentric chromosome has the centromere only slightly off-center rather than near an end. Telocentric is also wrong because its centromere lies exactly at the terminus with no second arm, whereas here the centromere is merely close to the end, not right at it.", "tag": "Centromere position"}, {"id": "g-ch6-structural-2", "chapter": 6, "topic": "ch6-structural", "type": "concept", "difficulty": "easy", "q": "A deletion removes a segment from the MIDDLE of a chromosome arm, leaving both telomeres intact. This is best described as:", "options": ["Terminal deletion", "Interstitial deletion", "Pericentric inversion", "Reciprocal translocation"], "answer": 1, "explain": "Removing an internal segment from the middle of a chromosome arm while both telomeres stay intact is the definition of an interstitial deletion, which requires two breaks within the arm followed by rejoining of the flanking pieces. This cannot be a terminal deletion, since that involves a single break near the chromosome end and removes a telomere, contradicting the intact telomeres described here. A pericentric inversion and a reciprocal translocation are also wrong because they rearrange chromosomal material rather than deleting any of it. Loss of an internal segment with both telomeres preserved therefore points only to an interstitial deletion.", "tag": "Deletion type"}, {"id": "g-ch6-structural-3", "chapter": 6, "topic": "ch6-structural", "type": "concept", "difficulty": "easy", "q": "Cri-du-chat syndrome results from a deletion on which human chromosome?", "options": ["Chromosome 5", "Chromosome 13", "Chromosome 21", "Chromosome 22"], "answer": 0, "explain": "Cri-du-chat syndrome is caused by a deletion of the short (p) arm of chromosome 5 (5p- syndrome), producing the characteristic high-pitched cat-like cry, intellectual disability, and microcephaly. This makes Chromosome 5 the correct answer. Chromosomes 13, 21, and 22 are acrocentric chromosomes associated with Robertsonian translocations and trisomies (such as Patau and Down syndromes), not with the 5p deletion seen in cri-du-chat.", "tag": "Cri-du-chat"}, {"id": "g-ch6-structural-4", "chapter": 6, "topic": "ch6-structural", "type": "concept", "difficulty": "med", "q": "An inversion has one breakpoint in the p arm and one breakpoint in the q arm, so the inverted segment contains the centromere. This inversion is:", "options": ["Paracentric", "Pericentric", "Terminal", "Robertsonian"], "answer": 1, "explain": "A pericentric inversion is correct: when one breakpoint lies in the p arm and the other in the q arm, the inverted segment spans and includes the centromere, which is exactly what \"peri-\" (around) the centromere describes. A paracentric inversion is wrong because its two breakpoints sit within the same arm, so the inverted segment lies to one side of and excludes the centromere. \"Terminal\" and \"Robertsonian\" are not inversion categories at all: a terminal change refers to a deletion at a chromosome end, and a Robertsonian event is a translocation that fuses two acrocentric chromosomes. Since only \"pericentric\" describes an inversion that captures the centromere, it is the single correct choice.", "tag": "Pericentric"}, {"id": "g-ch6-structural-5", "chapter": 6, "topic": "ch6-structural", "type": "concept", "difficulty": "med", "q": "A chromosome written A B C D*E F G H (where * marks the centromere) is rearranged to A B C D*G F E H. What kind of mutation occurred?", "options": ["Pericentric inversion", "Paracentric inversion", "Interstitial deletion", "Tandem duplication"], "answer": 1, "explain": "The chromosome A B C D*E F G H becomes A B C D*G F E H, where the stretch E F G is flipped to G F E with no genes added or removed, so the event is an inversion rather than a deletion (which would lose genes) or a duplication (which would repeat them). Because both breakpoints fall on the same side of the centromere (D*), the flipped region stays entirely within one arm and never includes the centromere. An inversion that excludes the centromere is, by definition, paracentric; an inversion spanning the centromere would instead be pericentric.", "tag": "Paracentric"}, {"id": "g-ch6-structural-6", "chapter": 6, "topic": "ch6-structural", "type": "concept", "difficulty": "hard", "q": "In an inversion heterozygote, the inverted and normal chromosomes pair by forming an inversion loop. A crossover WITHIN that loop produces:", "options": ["Only fully normal gametes", "Gametes with duplications and deletions", "A reduced chromosome number", "Robertsonian fusion products"], "answer": 1, "explain": "In an inversion heterozygote, the inverted and normal homologs pair by forming an inversion loop, and a crossover within that loop produces recombinant chromatids that carry duplicated and deleted chromosomal segments (with paracentric inversions also generating a dicentric bridge and an acentric fragment). Because these recombinant gametes are genetically unbalanced and typically nonviable, the correct outcome is gametes with duplications and deletions. The idea that only fully normal gametes result is wrong because the crossover specifically creates these unbalanced products; a reduced chromosome number is wrong because no whole chromosomes are lost (segments are merely duplicated/deleted, with all centromeres still present in nonbridge cases); and Robertsonian fusion is unrelated, as it involves joining two acrocentric chromosomes at the centromere, not an intrachromosomal inversion crossover.", "tag": "Inversion loop"}, {"id": "g-ch6-structural-7", "chapter": 6, "topic": "ch6-structural", "type": "concept", "difficulty": "med", "q": "The alpha- and beta-globin genes, expressed at different developmental stages, are members of a gene family. Such families most directly arise by:", "options": ["Pericentric inversion", "Duplication of a segment", "Terminal deletion", "Robertsonian translocation"], "answer": 1, "explain": "Gene families arise when a DNA segment containing a gene is duplicated, most commonly via unequal crossing over from misalignment of repeated sequences. The resulting duplicate copies (paralogs) are free to accumulate mutations and diverge in coding sequence and regulatory control, producing the alpha- and beta-globin genes expressed at different developmental stages. Inversions, terminal deletions, and Robertsonian translocations rearrange or remove existing DNA but do not generate the new gene copies required to build a gene family.", "tag": "Gene families"}, {"id": "g-ch6-structural-8", "chapter": 6, "topic": "ch6-structural", "type": "concept", "difficulty": "med", "q": "Two NON-homologous chromosomes physically exchange segments with each other. This is a:", "options": ["Reciprocal translocation", "Non-reciprocal translocation", "Paracentric inversion", "Interstitial deletion"], "answer": 0, "explain": "A reciprocal translocation is a mutual, two-way exchange of segments between two non-homologous chromosomes, which is exactly what is described here. A non-reciprocal translocation differs because it is a one-way transfer of a segment with no piece exchanged back. A paracentric inversion and an interstitial deletion are both rearrangements confined to a single chromosome, so neither involves two different chromosomes swapping material. Because the scenario specifies a mutual exchange between two non-homologous chromosomes, reciprocal translocation is the only fit.", "tag": "Reciprocal"}, {"id": "g-ch6-structural-9", "chapter": 6, "topic": "ch6-structural", "type": "calc", "difficulty": "med", "q": "A Robertsonian translocation fuses two acrocentric chromosomes in a person who would otherwise have 46 chromosomes. What is their resulting chromosome count?", "options": ["44", "45", "46", "47"], "answer": 1, "explain": "A Robertsonian translocation fuses two acrocentric chromosomes at their centromeres into a single derivative chromosome (losing the tiny short arms), so two chromosomes become one and the diploid count decreases by one: 46 − 1 = 45. The carrier is phenotypically balanced because essentially all functional genetic material is retained, which is why balanced Robertsonian carriers (e.g., 45,XX,rob(13;14)) have 45 chromosomes.", "tag": "Robertsonian count"}, {"id": "g-ch6-structural-10", "chapter": 6, "topic": "ch6-structural", "type": "concept", "difficulty": "easy", "q": "Robertsonian translocations occur specifically between which type of chromosomes?", "options": ["Metacentric", "Telocentric", "Acrocentric", "Submetacentric"], "answer": 2, "explain": "A Robertsonian translocation is the whole-arm fusion of two acrocentric chromosomes near their centromeres, with loss of their small short arms; in humans this involves chromosomes 13, 14, 15, 21, and 22 and reduces the diploid count by one. This is why acrocentric chromosomes are the correct answer: only chromosomes whose centromere sits very near one end carry the negligible short arms that can be shed in this fusion. Metacentric (centromere central) and submetacentric (centromere slightly off-center) chromosomes have substantial genetic material on both arms, so fusing them would not allow loss of a dispensable short arm. Telocentric chromosomes, which lack a short arm entirely, do not normally exist in the human karyotype and so are not the basis of this rearrangement.", "tag": "Acrocentric fusion"}, {"id": "g-ch6-structural-11", "chapter": 6, "topic": "ch6-structural", "type": "concept", "difficulty": "hard", "q": "A reciprocal translocation heterozygote forms a cross-shaped quadrivalent in meiosis I. Which segregation pattern yields BALANCED, viable gametes?", "options": ["Adjacent-1 segregation", "Alternate segregation", "Nondisjunction", "Robertsonian segregation"], "answer": 1, "explain": "In a reciprocal translocation heterozygote, the cross-shaped quadrivalent can resolve by alternate or adjacent segregation. Alternate segregation passes the two normal chromosomes to one pole and the two reciprocally translocated chromosomes to the other, yielding only balanced gametes (genetically normal or balanced translocation carriers) that are viable. Adjacent-1 and adjacent-2 segregation produce unbalanced gametes carrying duplications and deficiencies, which are typically inviable, and \"Robertsonian segregation\" is not a valid pattern for reciprocal translocations.", "tag": "Alternate segregation"}, {"id": "g-ch6-structural-12", "chapter": 6, "topic": "ch6-structural", "type": "concept", "difficulty": "med", "q": "A translocation carrier has no net gain or loss of genetic material and is phenotypically healthy. Their rearrangement is described as:", "options": ["Unbalanced", "Balanced", "Interstitial", "Pericentric"], "answer": 1, "explain": "A balanced translocation is a reciprocal exchange of chromosomal segments with no net gain or loss of genetic material, so carriers are typically phenotypically normal (though they can still produce unbalanced gametes), which is exactly the scenario described. An unbalanced rearrangement, by contrast, has extra or missing material and usually causes a phenotype, so it does not fit a healthy carrier. \"Interstitial\" refers to a kind of deletion and \"pericentric\" describes an inversion spanning the centromere; neither term describes translocation balance, leaving \"balanced\" as the only correct answer.", "tag": "Balanced"}, {"id": "g-ch6-structural-13", "chapter": 6, "topic": "ch6-structural", "type": "concept", "difficulty": "hard", "q": "After an inversion, a gene's level of expression changes even though its coding sequence is unaltered, simply because it was moved to a new chromosomal location. This phenomenon is called:", "options": ["A position effect", "A Robertsonian fusion", "An unbalanced translocation", "A terminal deletion"], "answer": 0, "explain": "A position effect is the change in a gene's expression caused solely by relocating it to a new chromosomal environment (for example, next to heterochromatin after an inversion), with no change to the gene's coding sequence. The classic example is position-effect variegation in Drosophila, where an inversion moves a euchromatic gene beside heterochromatin and silences it. This is the right answer because the question describes altered expression from relocation alone, with the sequence intact. A Robertsonian fusion, an unbalanced translocation, and a terminal deletion are all wrong because they involve loss, gain, or exchange of chromosomal material rather than the pure repositioning of an otherwise intact gene.", "tag": "Position effect"}, {"id": "g-ch6-number-1", "chapter": 6, "topic": "ch6-number", "type": "concept", "difficulty": "easy", "q": "What does the term POLYPLOIDY refer to?", "options": ["Having more than two complete chromosome sets", "Missing a single chromosome from a set", "An extra single chromosome (2n+1)", "Two sets from two different species"], "answer": 0, "explain": "Polyploidy refers to having more than two complete sets of chromosomes (e.g., triploid 3n, tetraploid 4n), a form of euploidy where whole chromosome sets are added. This is the correct general definition because it describes a change in the number of entire chromosome sets, not individual chromosomes. Losing a single chromosome (monosomy) or gaining a single extra chromosome (trisomy, 2n+1) are forms of aneuploidy, which involve single chromosomes rather than whole sets. Combining sets from two different species describes allopolyploidy, which is just one specific subtype rather than the general definition.", "tag": "polyploidy"}, {"id": "g-ch6-number-2", "chapter": 6, "topic": "ch6-number", "type": "concept", "difficulty": "med", "q": "Why are triploid (3n) organisms typically sterile?", "options": ["They lack a centromere", "An odd number of homologs cannot pair evenly in meiosis", "They have too few chromosome sets to survive", "Their chromosomes fuse into one large chromosome"], "answer": 1, "explain": "In a triploid, each chromosome is present in three copies. During meiosis I, homologs pair and segregate two-by-two, but three copies cannot divide evenly into two poles, forming trivalents or univalents that segregate randomly. This yields aneuploid, unbalanced gametes with missing or extra chromosomes, which are generally inviable, making the organism sterile (e.g., seedless triploid watermelons/bananas).", "tag": "triploid"}, {"id": "g-ch6-number-3", "chapter": 6, "topic": "ch6-number", "type": "concept", "difficulty": "med", "q": "An organism has extra chromosome sets all derived from the SAME species. This is called:", "options": ["Allopolyploidy", "Aneuploidy", "Autopolyploidy", "Mosaicism"], "answer": 2, "explain": "Autopolyploidy is the correct answer because it is the condition in which all of the extra chromosome sets originate from a single species, often resulting from a failure of meiotic reduction that doubles the genome within one species. This differs from allopolyploidy, where the extra chromosome sets come from two or more different species (typically via hybridization followed by genome doubling). Aneuploidy is wrong because it refers to the gain or loss of individual chromosomes rather than entire chromosome sets, and mosaicism describes an organism made up of genetically distinct cell populations, which is unrelated to ploidy level.", "tag": "autopolyploidy"}, {"id": "g-ch6-number-4", "chapter": 6, "topic": "ch6-number", "type": "concept", "difficulty": "med", "q": "Xenopus laevis carries 4 chromosome sets derived from 2 different species. This makes it a(n):", "options": ["Autotetraploid", "Allotetraploid", "Allodiploid", "Triploid"], "answer": 1, "explain": "Polyploidy prefixes describe the origin and number of chromosome sets: \"auto-\" means all sets come from a single species, while \"allo-\" means the sets are combined from two or more different species through hybridization, and \"tetra-\" specifies four sets. Because Xenopus laevis has four chromosome sets (tetraploid) derived from two different species, it is an allotetraploid. It is not an autotetraploid, since those four sets would all trace to one species; it is not an allodiploid, which has only two sets (one from each species); and it is not a triploid, which has only three sets.", "tag": "allotetraploid"}, {"id": "g-ch6-number-5", "chapter": 6, "topic": "ch6-number", "type": "calc", "difficulty": "med", "q": "A hexaploid plant has 42 chromosomes total. How many chromosomes are in ONE set?", "options": ["6", "7", "21", "42"], "answer": 1, "explain": "Hexaploid (6n) means the organism has 6 chromosome sets. The number per set (the monoploid number, x) equals total chromosomes divided by ploidy: 42 / 6 = 7. So one set contains 7 chromosomes; 21 would be the diploid/gametic-style miscalculation (42/2) and 6 is the ploidy level itself, not a chromosome count.", "tag": "ploidy math"}, {"id": "g-ch6-number-6", "chapter": 6, "topic": "ch6-number", "type": "calc", "difficulty": "med", "q": "A species has 8 chromosomes in a single set (n=8). How many total chromosomes does a tetraploid individual have?", "options": ["16", "24", "32", "8"], "answer": 2, "explain": "With n=8 chromosomes per single set, ploidy multiplies the set count: a tetraploid (4n) has four sets, giving 4 × 8 = 32 total chromosomes. The distractors correspond to diploid 2n=16 and triploid 3n=24, while 8 is just the haploid set. Thus 32 is uniquely correct.", "tag": "ploidy math"}, {"id": "g-ch6-number-7", "chapter": 6, "topic": "ch6-number", "type": "concept", "difficulty": "easy", "q": "A trisomy is best described by which formula?", "options": ["2n-1", "3n", "2n+1", "4n"], "answer": 2, "explain": "Trisomy is an aneuploid condition in which a single extra chromosome is added to the normal diploid set, which is exactly what 2n+1 represents (e.g., trisomy 21 / Down syndrome). The formula 2n-1 instead describes monosomy, the loss of one chromosome, so it is the opposite situation. The formulas 3n (triploidy) and 4n (tetraploidy) are euploid polyploidy conditions involving whole extra chromosome sets rather than a single-chromosome gain, so they do not describe trisomy. This makes 2n+1 the only correct choice.", "tag": "trisomy"}, {"id": "g-ch6-number-8", "chapter": 6, "topic": "ch6-number", "type": "concept", "difficulty": "med", "q": "Which sex-chromosome aneuploidy corresponds to the karyotype XXY?", "options": ["Turner (45,X)", "Jacobs (XYY)", "Down (trisomy 21)", "Klinefelter (XXY)"], "answer": 3, "explain": "A 47,XXY karyotype is Klinefelter syndrome, a sex-chromosome aneuploidy occurring in phenotypic males who carry an extra X chromosome, which is why \"Klinefelter (XXY)\" is correct. Turner syndrome is wrong because it is monosomy X (45,X), a missing rather than extra sex chromosome. Jacobs syndrome is wrong because it is 47,XYY, an extra Y rather than an extra X. Down syndrome is wrong because it is an autosomal trisomy (trisomy 21), not a sex-chromosome aneuploidy at all.", "tag": "Klinefelter"}, {"id": "g-ch6-number-9", "chapter": 6, "topic": "ch6-number", "type": "concept", "difficulty": "med", "q": "Turner syndrome (45,X) is an example of which condition?", "options": ["Monosomy", "Trisomy", "Triploidy", "Tetraploidy"], "answer": 0, "explain": "Turner syndrome (45,X) has a single X chromosome, one fewer than the normal diploid complement (2n-1 = 45), which is by definition a monosomy. Trisomy is the gain of one chromosome (2n+1), while triploidy (3n) and tetraploidy (4n) involve entire extra chromosome sets. Thus monosomy is the only correct answer.", "tag": "Turner"}, {"id": "g-ch6-number-10", "chapter": 6, "topic": "ch6-number", "type": "concept", "difficulty": "med", "q": "Why are sex-chromosome aneuploidies (like XXY or XYY) usually viable while most autosomal aneuploidies are lethal?", "options": ["Sex chromosomes do not undergo nondisjunction", "Autosomal aneuploidies are caused by polyploidy", "Most autosomal aneuploidies are lethal, but sex-chromosome aneuploidies are usually tolerated", "Sex chromosomes always exist only in mosaic form"], "answer": 2, "explain": "The reason most autosomal aneuploidies are lethal while sex-chromosome aneuploidies are usually tolerated comes down to dosage compensation: extra X chromosomes are largely silenced by X-inactivation (forming Barr bodies), and the Y chromosome carries very few genes, so overall gene dosage stays close to normal. Autosomes have no equivalent silencing system, so an extra or missing autosome throws off the dosage of hundreds of genes and is usually lethal (the rare survivable cases, like trisomy 21, involve the smallest, gene-poor chromosomes). The idea that sex chromosomes never undergo nondisjunction is false, since they clearly do; equating autosomal aneuploidy with polyploidy confuses a change in one chromosome with a duplication of entire chromosome sets; and claiming these conditions exist only in mosaic form is also incorrect, since most affected individuals are not mosaics.", "tag": "viability"}, {"id": "g-ch6-number-11", "chapter": 6, "topic": "ch6-number", "type": "concept", "difficulty": "hard", "q": "Nondisjunction occurs in MEIOSIS I. What are the resulting four gametes?", "options": ["2 normal (n), 1 n+1, and 1 n-1", "All 4 abnormal: 2 are n+1 and 2 are n-1", "All 4 normal (n)", "1 n+1 and 3 normal (n)"], "answer": 1, "explain": "In Meiosis I nondisjunction, homologous chromosomes fail to separate, so one secondary cell gets both homologs (n+1) and the other gets neither (n-1). Meiosis II then proceeds normally, with sister chromatids separating: the n+1 cell produces two n+1 gametes and the n-1 cell produces two n-1 gametes. Thus all four gametes are abnormal (2 n+1 and 2 n-1). The \"2 normal, 1 n+1, 1 n-1\" pattern is the signature of MII nondisjunction, not MI.", "tag": "MI nondisjunction"}, {"id": "g-ch6-number-12", "chapter": 6, "topic": "ch6-number", "type": "calc", "difficulty": "hard", "q": "In a species with 2n=14, MEIOSIS II nondisjunction produces an n+1 gamete. If that gamete is fertilized by a normal n=7 gamete, the zygote's chromosome number is:", "options": ["13 (monosomy)", "14 (normal)", "15 (trisomy)", "21 (triploid)"], "answer": 2, "explain": "With 2n=14, the haploid number is n=7. In meiosis II nondisjunction, sister chromatids fail to separate, so the gamete carries one extra chromosome (n+1 = 8). Fertilizing a normal n=7 gamete gives 8+7=15, which is 2n+1, a trisomy, the correct answer. It is not the normal 14 (that would require both gametes to be balanced), not 13 (a monosomy, which comes from an n-1 gamete that is missing a chromosome), and not 21 (triploidy, 3n, which results from an extra whole haploid set rather than a single extra chromosome).", "tag": "ploidy math"}, {"id": "g-ch6-number-13", "chapter": 6, "topic": "ch6-number", "type": "concept", "difficulty": "hard", "q": "An individual has some cells with normal chromosome number and others that are trisomic, all from a single zygote. What caused this mosaicism?", "options": ["Mitotic nondisjunction in the zygote", "Meiosis I nondisjunction in a parent", "Allopolyploidy between two species", "Robertsonian translocation"], "answer": 0, "explain": "Mosaicism (different chromosome complements in one individual derived from a single zygote) requires a post-fertilization error, which is exactly what mitotic nondisjunction in the early embryo produces: one daughter cell becomes trisomic and seeds a trisomic lineage while sister lineages stay normal. A meiosis I (or II) nondisjunction in a parent happens before fertilization, so the entire zygote and every cell descended from it would be uniformly aneuploid, not mosaic. Allopolyploidy (whole-genome hybridization between species) and a Robertsonian translocation (fusion of two chromosomes) likewise affect every cell uniformly and do not create a mix of normal versus trisomic cells. Therefore, mitotic nondisjunction in the zygote is the only mechanism that explains the observed mosaicism.", "tag": "mosaicism"}, {"id": "g-ch4-epistasis-1", "chapter": 4, "topic": "ch4-epistasis", "type": "concept", "difficulty": "easy", "q": "What defines a sex-influenced trait?", "options": ["An autosomal gene whose dominance relationship depends on the sex of the individual", "A gene located on the X chromosome that is only expressed in females", "A trait expressed in only one sex due to hormones", "A gene that affects multiple unrelated traits simultaneously"], "answer": 0, "explain": "A sex-influenced trait is governed by an autosomal gene whose dominance relationship in heterozygotes depends on the individual's sex, so an allele dominant in one sex is recessive in the other (often due to hormonal differences); pattern baldness is the classic example. This is distinct from a sex-limited trait, where a trait is expressed in only one sex, and from X-linked inheritance, where the gene sits on the X chromosome rather than an autosome. It also differs from pleiotropy, in which a single gene affects multiple unrelated traits.", "tag": "sex-influenced"}, {"id": "g-ch4-epistasis-2", "chapter": 4, "topic": "ch4-epistasis", "type": "concept", "difficulty": "med", "q": "In cattle, the scurs genotype Sc^P Sc^A produces which phenotype?", "options": ["Scurs in both males and females", "Scurs in males, no scurs in females", "No scurs in either sex", "Scurs in females, no scurs in males"], "answer": 1, "explain": "Scurs in cattle is a sex-influenced trait where the scurs allele acts as dominant in males but recessive in females. The heterozygote Sc^P Sc^A therefore expresses scurs in males but not in females, while the homozygote Sc^P Sc^P gives scurs in both sexes and Sc^A Sc^A gives no scurs in either. Thus the heterozygous genotype yields scurs in males and no scurs in females.", "tag": "scurs"}, {"id": "g-ch4-epistasis-3", "chapter": 4, "topic": "ch4-epistasis", "type": "concept", "difficulty": "easy", "q": "Colorful plumage limited to male birds is an example of what?", "options": ["A sex-limited trait", "A sex-influenced trait", "Pleiotropy", "Dominant epistasis"], "answer": 0, "explain": "A sex-limited trait is the right call because the gene is present in both sexes but expressed in only one, with expression typically governed by sex hormones; male-only colorful plumage (and female-only milk production) are classic examples. A sex-influenced trait is different because it does show up in both sexes, just with dominance reversed by sex, as in pattern baldness. Pleiotropy describes one gene affecting multiple traits, and epistasis describes one gene masking the effect of another, so neither fits plumage that simply appears in just one sex.", "tag": "sex-limited"}, {"id": "g-ch4-epistasis-4", "chapter": 4, "topic": "ch4-epistasis", "type": "concept", "difficulty": "med", "q": "For index-finger length, the short allele S is dominant in males but recessive in females. A heterozygous (SL) female will have what finger phenotype?", "options": ["Long index finger", "Short index finger", "Intermediate length", "Cannot be determined"], "answer": 0, "explain": "This is a sex-influenced trait where the allele's dominance depends on sex. In females, S is recessive (L is dominant), so a heterozygous SL female expresses the L phenotype, giving a long index finger. The same SL genotype would be short in a male, where S is dominant.", "tag": "finger-length"}, {"id": "g-ch4-epistasis-5", "chapter": 4, "topic": "ch4-epistasis", "type": "concept", "difficulty": "easy", "q": "Epistasis occurs when:", "options": ["Alleles of one gene mask the effect of a different gene at another locus", "Two alleles of the same gene blend to give an intermediate phenotype", "One gene controls many different traits", "A trait is expressed only in one sex"], "answer": 0, "explain": "Epistasis is a between-gene interaction in which the alleles of one gene mask or modify the phenotypic expression of a different gene at a separate locus, which is exactly what this answer describes. It is not the blending of two alleles of the same gene into an intermediate phenotype (that is incomplete dominance), nor a single gene affecting many traits (that is pleiotropy), nor a trait expressed in only one sex (that is sex-limited expression). The key distinction is that epistasis involves two different genes interacting, whereas those other concepts involve a single gene or a sex-based restriction.", "tag": "epistasis-def"}, {"id": "g-ch4-epistasis-6", "chapter": 4, "topic": "ch4-epistasis", "type": "calc", "difficulty": "med", "q": "In sweet peas, purple requires both C_ and P_; cc or pp gives white. Crossing CcPp x CcPp, what fraction of offspring are PURPLE?", "options": ["9/16", "7/16", "12/16", "3/16"], "answer": 0, "explain": "Purple requires at least one dominant allele at both loci (C_P_). A CcPp x CcPp dihybrid cross yields 9 C_P_ : 3 C_pp : 3 ccP_ : 1 ccpp. Only the 9/16 C_P_ class has both required dominants and is purple; the remaining 7/16 (missing C or P) are white, the classic 9:7 duplicate recessive epistasis ratio.", "tag": "9:7"}, {"id": "g-ch4-epistasis-7", "chapter": 4, "topic": "ch4-epistasis", "type": "calc", "difficulty": "med", "q": "A CcPp x CcPp sweet pea cross yields what ratio of purple to white?", "options": ["9 purple : 7 white", "12 purple : 4 white", "13 purple : 3 white", "9 purple : 3 white : 4 intermediate"], "answer": 0, "explain": "A CcPp x CcPp cross yields the standard dihybrid ratio 9 C_P_ : 3 C_pp : 3 ccP_ : 1 ccpp. In sweet peas, purple pigment requires at least one dominant allele at BOTH genes (complementary/duplicate recessive epistasis), so only the 9/16 C_P_ class is purple. The remaining classes (3 + 3 + 1 = 7/16) each lack a required dominant allele and are white, giving 9 purple : 7 white.", "tag": "9:7"}, {"id": "g-ch4-epistasis-8", "chapter": 4, "topic": "ch4-epistasis", "type": "concept", "difficulty": "med", "q": "Two true-breeding white sweet pea lines, CCpp and ccPP, are crossed and ALL F1 are purple. This result demonstrates:", "options": ["Complementation, because the two mutations are in different genes", "Pleiotropy, because one gene affects color in two ways", "Dominant epistasis masking the white phenotype", "A sex-limited effect on flower color"], "answer": 0, "explain": "Each white parent carries a recessive loss-of-function mutation in a different gene (CCpp lacks P function, ccPP lacks C function), and both functional gene products are required to make purple pigment. The F1 is CcPp, inheriting a wild-type allele of each gene from the opposite parent, so it has at least one working copy of both C and P and is purple. Restoration of the wild-type phenotype when two mutants are combined is the definition of complementation, demonstrating the mutations lie in two different genes.", "tag": "complementation"}, {"id": "g-ch4-epistasis-9", "chapter": 4, "topic": "ch4-epistasis", "type": "calc", "difficulty": "hard", "q": "In corn, dominant I inhibits color; among colored kernels P_ is purple and pp is red. From IiPp x IiPp, what ratio of colorless : purple : red is expected?", "options": ["12 colorless : 3 purple : 1 red", "9 colorless : 3 purple : 4 red", "13 colorless : 2 purple : 1 red", "9 colorless : 6 purple : 1 red"], "answer": 0, "explain": "In a dihybrid IiPp x IiPp cross, the 9:3:3:1 genotypic classes are I_P_ (9/16), I_pp (3/16), iiP_ (3/16), iipp (1/16). Dominant I inhibits color, so all I_ kernels (9+3 = 12/16) are colorless. Only ii kernels show color: iiP_ (3/16) is purple and iipp (1/16) is red, giving the classic dominant-epistasis ratio of 12 colorless : 3 purple : 1 red.", "tag": "12:3:1"}, {"id": "g-ch4-epistasis-10", "chapter": 4, "topic": "ch4-epistasis", "type": "calc", "difficulty": "hard", "q": "A recessive epistasis dihybrid cross produces a modified 9:3:3:1 ratio. Which ratio results?", "options": ["9 : 3 : 4", "9 : 7", "12 : 3 : 1", "9 : 6 : 1"], "answer": 0, "explain": "In recessive epistasis the homozygous recessive genotype at one locus (e.g., aa) masks the phenotypic expression of the second gene. This merges the aaB_ class (3) and the aabb class (1) of the standard 9:3:3:1 into a single phenotype of 4, while the 9 (A_B_) and 3 (A_bb) remain distinct, yielding 9 : 3 : 4. The other options correspond to different interactions (9:7 duplicate recessive, 12:3:1 dominant epistasis, 9:6:1 duplicate genes with additive effect).", "tag": "9:3:4"}, {"id": "g-ch4-epistasis-11", "chapter": 4, "topic": "ch4-epistasis", "type": "concept", "difficulty": "easy", "q": "Sickle-cell disease affecting many different organs is an example of:", "options": ["Pleiotropy, where one gene affects multiple traits", "Epistasis between two organ-specific genes", "A sex-limited trait", "Gene redundancy compensating for organ damage"], "answer": 0, "explain": "Pleiotropy occurs when one gene affects multiple traits. The sickle-cell mutation in the single HBB gene alters one protein (hemoglobin), yet produces wide-ranging effects across many organs (anemia, pain crises, organ damage, infection susceptibility). The other options—epistasis (gene-gene interaction), sex-limited traits, and gene redundancy—do not describe this single-gene-to-many-effects relationship.", "tag": "pleiotropy"}, {"id": "g-ch4-epistasis-12", "chapter": 4, "topic": "ch4-epistasis", "type": "concept", "difficulty": "med", "q": "A paralog (a homologous gene within the same species arising from duplication) compensates for a missing gene's function. This phenomenon is called:", "options": ["Gene redundancy", "Complementation", "Dominant epistasis", "Sex-influenced inheritance"], "answer": 0, "explain": "Gene redundancy is when a paralog (a duplicate homologous gene in the same species) can substitute for the function of a missing or nonfunctional gene, so loss of one copy produces little or no phenotype. This differs from complementation, which restores wild-type function via two different mutant alleles/genomes. Dominant epistasis and sex-influenced inheritance describe unrelated allelic/interaction phenomena, making redundancy the single correct answer.", "tag": "redundancy"}, {"id": "g-ch4-epistasis-13", "chapter": 4, "topic": "ch4-epistasis", "type": "concept", "difficulty": "hard", "q": "Which statement correctly distinguishes sex-influenced from sex-limited traits?", "options": ["Sex-influenced traits can appear in both sexes but with reversed dominance; sex-limited traits appear in only one sex", "Sex-influenced traits appear in only one sex; sex-limited traits appear in both sexes equally", "Both are X-linked, differing only in penetrance", "Sex-limited traits show reversed dominance, while sex-influenced traits are hormone-driven"], "answer": 0, "explain": "Both trait types are autosomal and hormonally modulated, but they differ in how that hormonal context acts. Sex-influenced traits (e.g., pattern baldness, scurs) are expressed in both sexes, yet the heterozygote's dominance is reversed between the sexes, which is exactly what the correct statement describes. Sex-limited traits (e.g., milk yield, male plumage) are phenotypically expressed in only one sex, even though both sexes carry the alleles. The claim that sex-influenced traits appear in only one sex inverts the two definitions, the idea that sex-limited traits show the reversed dominance swaps the defining features, and calling either X-linked is wrong since both are autosomal.", "tag": "compare"}, {"id": "g-ch4-epistasis-14", "chapter": 4, "topic": "ch4-epistasis", "type": "calc", "difficulty": "hard", "q": "When a dominant allele is lethal in the homozygous state, a cross between two heterozygotes (Aa x Aa) yields what ratio among SURVIVING offspring?", "options": ["2 Aa : 1 aa", "3 A_ : 1 aa", "1 AA : 2 Aa : 1 aa", "9 : 7"], "answer": 0, "explain": "At conception, Aa x Aa gives 1 AA : 2 Aa : 1 aa. Because the A allele is lethal when homozygous, the AA class dies before it can be counted, leaving 2 Aa : 1 aa among survivors—so that 2:1 ratio is correct. The standard 3 A_ : 1 aa and the full 1 AA : 2 Aa : 1 aa both fail because they still count the lethal AA individuals, and the 9:7 ratio describes recessive epistasis between two genes, which has nothing to do with this single-gene homozygous-lethal cross.", "tag": "2:1"}, {"id": "g-ch4-nonmendelian-1", "chapter": 4, "topic": "ch4-nonmendelian", "type": "concept", "difficulty": "easy", "q": "Which feature distinguishes extranuclear (cytoplasmic) inheritance from standard Mendelian inheritance?", "options": ["The genes involved are located on the X chromosome", "The genetic material resides outside the nucleus and does not obey the law of segregation", "The genes always show a 3:1 dominant-to-recessive ratio", "The trait is determined solely by the offspring's own nuclear genotype"], "answer": 1, "explain": "Extranuclear (cytoplasmic) inheritance is defined by genetic material that resides outside the nucleus, in organelles such as mitochondria and chloroplasts. Because these organelle genomes are partitioned along with the cytoplasm during cell division rather than separating like nuclear chromosomes in meiosis, they do not obey Mendel's law of segregation. This is what sets it apart from X-linked genes, which are still nuclear and Mendelian, and from the fixed 3:1 dominant-to-recessive ratio expected only of standard Mendelian crosses. It also explains why the trait is not determined solely by the offspring's own nuclear genotype, since organelles are typically inherited from the cytoplasm of one parent (usually maternally).", "tag": "Cytoplasmic"}, {"id": "g-ch4-nonmendelian-2", "chapter": 4, "topic": "ch4-nonmendelian", "type": "concept", "difficulty": "easy", "q": "Mammalian mitochondrial DNA (mtDNA) is best described as:", "options": ["A linear molecule about 17,000 bp long, inherited paternally", "A circular molecule about 17,000 bp long, resembling a prokaryotic genome", "A linear molecule packaged with histones like nuclear DNA", "A circular molecule of several million bp inherited biparentally"], "answer": 1, "explain": "Mammalian mtDNA is a covalently closed circular molecule of about 16,500 bp (roughly 17 kb), with no histone packaging, structurally resembling a prokaryotic genome. It is maternally inherited in mammals (paternal mitochondria are normally eliminated), making the other options wrong on shape, size, packaging, or inheritance.", "tag": "mtDNA"}, {"id": "g-ch4-nonmendelian-3", "chapter": 4, "topic": "ch4-nonmendelian", "type": "concept", "difficulty": "med", "q": "Heteroplasmy helps explain why a maternally inherited mitochondrial disorder such as LHON can vary in severity among relatives. What is heteroplasmy?", "options": ["The silencing of one parental allele by methylation in the germ line", "The presence of more than one type of organellar genome within a single cell", "The deposition of maternal mRNA into the egg by nurse cells", "The complete loss of all mitochondria during fertilization"], "answer": 1, "explain": "Heteroplasmy is the presence of more than one type of organellar (mitochondrial) genome within a single cell, as opposed to homoplasmy where all copies are identical. The varying ratio of mutant to wild-type mtDNA among cells and individuals explains the variable severity of maternally inherited disorders like LHON. The other options describe genomic imprinting, maternal mRNA deposition, and mitochondrial loss, none of which is heteroplasmy.", "tag": "Heteroplasmy"}, {"id": "g-ch4-nonmendelian-4", "chapter": 4, "topic": "ch4-nonmendelian", "type": "concept", "difficulty": "med", "q": "In Mirabilis jalapa (four-o'clock), leaf-color variegation is controlled by chloroplast genes. The phenotype of an offspring plant matches that of:", "options": ["The pollen (paternal) parent only", "The maternal (seed) parent", "An equal blend of both parents", "Whichever parent is homozygous dominant"], "answer": 1, "explain": "Chloroplasts in Mirabilis jalapa are transmitted only through the cytoplasm of the egg, so plastid-controlled leaf variegation is maternally inherited (Correll's classic experiment). The offspring's leaf phenotype matches the maternal (seed) parent regardless of the pollen donor's phenotype, which rules out paternal, blended, or dominance-based outcomes.", "tag": "Mirabilis"}, {"id": "g-ch4-nonmendelian-5", "chapter": 4, "topic": "ch4-nonmendelian", "type": "concept", "difficulty": "med", "q": "In snail shell coiling (dextral vs. sinistral), the offspring's phenotype is determined by the mother's genotype rather than its own. What is the mechanistic basis for this maternal effect?", "options": ["The shell-coiling gene is located in the mitochondrial genome", "One parental allele is silenced by methylation set in the germ line", "The mother deposits mRNA/proteins into the egg (via nurse cells) that direct early development", "The offspring inherits chloroplasts only from the maternal parent"], "answer": 2, "explain": "Snail shell coiling is a maternal effect: the mother's genotype determines the phenotype because she loads the egg cytoplasm with mRNAs and proteins (synthesized by surrounding nurse/follicle cells) that direct the orientation of the early cleavage spindle and thus the coiling direction. The offspring's own genotype is irrelevant for that generation because development is steered by these pre-deposited maternal products, not by the embryo's own transcription. This is distinct from cytoplasmic (mitochondrial/chloroplast) inheritance and from genomic imprinting via methylation, ruling out the other options.", "tag": "Maternal effect"}, {"id": "g-ch4-nonmendelian-6", "chapter": 4, "topic": "ch4-nonmendelian", "type": "concept", "difficulty": "med", "q": "Genomic imprinting produces monoallelic, parent-of-origin-specific expression. Which statement correctly describes imprinting?", "options": ["Both alleles are always expressed regardless of parental origin", "One allele is silenced by methylation established in the germ line based on parent of origin", "The silenced allele is permanently inactivated and never reset across generations", "Imprinting is caused by loss of the entire chromosome carrying one allele"], "answer": 1, "explain": "Genomic imprinting is parent-of-origin-specific monoallelic expression in which one allele is epigenetically silenced by DNA methylation laid down at an imprinting control region during gametogenesis, so the imprint depends on whether the allele passed through the maternal or paternal germ line. This makes the choice describing germ-line methylation that silences one allele based on parent of origin correct. The idea that both alleles are always expressed regardless of origin is wrong because imprinting is specifically monoallelic, and the claim that it results from losing the entire chromosome carrying one allele is wrong since the gene remains present but transcriptionally silenced. The notion that the silenced allele is permanently inactivated and never reset is also wrong, because imprints are erased and re-established each generation in the germ line.", "tag": "Imprinting"}, {"id": "g-ch4-nonmendelian-7", "chapter": 4, "topic": "ch4-nonmendelian", "type": "concept", "difficulty": "hard", "q": "Why can a single individual transmit a given imprinted locus differently depending on whether the offspring is a son or daughter inheriting it?", "options": ["Because mtDNA recombines with nuclear DNA during gametogenesis", "Because imprints are erased and re-established in germ cells according to the sex of the individual", "Because methylation is randomly assigned with no regard to parental sex", "Because nurse cells deposit different proteins for sons versus daughters"], "answer": 1, "explain": "Genomic imprints are not permanent: in the primordial germ cells the inherited methylation marks are erased and then re-established according to the sex of the individual producing the gametes (a maternal pattern in oocytes, a paternal pattern in sperm). This is why the same person can pass on a locus with a different imprint than they received, since the mark is reset to match the type of gamete they make. The other ideas are incorrect, because mtDNA does not recombine with nuclear DNA, imprinting methylation is not assigned randomly without regard to parental sex, and nurse-cell protein deposition is not the mechanism that sets imprints.", "tag": "Imprint reset"}, {"id": "g-ch4-nonmendelian-8", "chapter": 4, "topic": "ch4-nonmendelian", "type": "calc", "difficulty": "hard", "q": "Snail shell coiling shows a maternal effect, with dextral (D) dominant to sinistral (d). A pure dd female is crossed to a DD male; the resulting F1 (all Dd) are selfed/intercrossed to produce F2 snails, which are then allowed to reproduce to give the F3. Among the F3 individuals, what phenotypic ratio of dextral : sinistral is observed?", "options": ["3 dextral : 1 sinistral", "All dextral", "2 dextral : 1 sinistral", "1 dextral : 1 sinistral"], "answer": 0, "explain": "In maternal-effect coiling, an individual's phenotype is set by its mother's genotype. The F2 are 1/4 DD : 1/2 Dd : 1/4 dd, so 3/4 of F2 mothers carry at least one D allele and lay dextral F3 offspring, while 1/4 (dd) lay sinistral F3. Thus the F3 show the one-generation-delayed Mendelian ratio of 3 dextral : 1 sinistral.", "tag": "Coiling 3:1"}, {"id": "g-ch4-nonmendelian-9", "chapter": 4, "topic": "ch4-nonmendelian", "type": "calc", "difficulty": "hard", "q": "A dihybrid cross (AaBb x AaBb) involves a gene interaction in which homozygous recessive bb is epistatic and masks the A locus, producing one phenotype, while B_ allows the A locus to show two phenotypes. What ratio results?", "options": ["9 : 7", "12 : 3 : 1", "9 : 3 : 4", "2 : 1"], "answer": 2, "explain": "This is recessive epistasis. Starting from the standard dihybrid 9 A_B_ : 3 aaB_ : 3 A_bb : 1 aabb output, homozygous recessive bb masks the A locus, so both bb classes collapse into one phenotype (3 + 1 = 4). Within B_, the A locus still shows its two phenotypes, A_B_ (9) and aaB_ (3), giving the \"9 : 3 : 4\" ratio. \"9 : 7\" describes complementary gene action (two genes needed together), \"12 : 3 : 1\" is dominant epistasis, and \"2 : 1\" reflects a lethal allele, none of which match masking by a recessive bb.", "tag": "9:3:4"}, {"id": "g-ch4-nonmendelian-10", "chapter": 4, "topic": "ch4-nonmendelian", "type": "calc", "difficulty": "med", "q": "A heterozygous-by-heterozygous cross (Aa x Aa) involves an allele that is dominant for phenotype but recessive lethal, so the AA class dies before scoring. Among surviving offspring, what phenotypic ratio is observed?", "options": ["9 : 7", "3 : 1", "12 : 3 : 1", "2 : 1"], "answer": 3, "explain": "Aa x Aa yields genotypes 1 AA : 2 Aa : 1 aa. The AA class is recessive lethal and dies before scoring, leaving 2 Aa : 1 aa among survivors. Since A is dominant for phenotype, the 2 Aa individuals show the dominant phenotype and the 1 aa shows the recessive phenotype, giving a 2:1 phenotypic ratio.", "tag": "2:1 lethal"}]/*__END__*/;

const GEN_BANK = GEN_DIAGRAMS.concat(GEN_GENERATED);

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
  ach: [], examReady: false,
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
  if (right) { r.c++; r.box = Math.min(5, r.box + 1); } else { r.box = Math.max(1, r.box - 1); }
  const diff = qq.difficulty === 'hard' ? 6 : qq.difficulty === 'med' ? 3 : 0;
  const xp = right ? 10 + (qq.type === 'calc' ? 5 : qq.type === 'label' ? 3 : 0) + diff : 1;
  GEN.xp += xp;
  if (!GEN.ach.includes('first')) genGrant('first');
  return xp;
}

/* ============================================================================
   ENTRY + PASSWORD GATE
   ========================================================================= */
function renderGenetics() {
  genClearTimer();
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
  }));
  main.querySelectorAll('[data-topic]').forEach(b => b.addEventListener('click', () => startGenTopic(b.dataset.topic)));
  main.querySelector('#gen-reset').addEventListener('click', () => {
    if (!confirm('Reset all Genetics-2313-01E progress (XP, mastery, achievements)? You stay unlocked.')) return;
    GEN = Object.assign({ unlocked: true, xp: 0, answered: 0, correct: 0, bestScore: 0, bestCombo: 0, bestExam: 0, plays: 0, streak: { current: 0, longest: 0, lastDate: '' }, q: {}, ach: [], examReady: false });
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
  const order = genShuffle([0, 1, 2, 3]);
  const correctDisp = order.indexOf(qq.answer);

  const root = el('<div></div>');
  root.appendChild(topbar('genetics'));
  const main = el(`<main class="panel gen-game" id="main" tabindex="-1">
    ${genHud(run)}
    <div class="gen-q cornerframe" data-qid="${qq.id}">
      <div class="gen-q-meta"><span class="mono">CH ${qq.chapter}</span><span class="gen-q-tag">${esc((GEN_TOPICS[qq.topic] && GEN_TOPICS[qq.topic].name) || 'Practice')}</span><span class="gen-q-diff gen-d-${qq.difficulty}">${qq.difficulty}</span>${qq.type === 'label' ? '<span class="gen-q-pic">diagram</span>' : ''}</div>
      ${qq.svg ? `<div class="gen-q-svg">${qq.svg}</div>` : ''}
      <h2 class="gen-q-stem">${esc(qq.q)}</h2>
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
    if (run.locked) { if (e.key === 'Enter' && !nextRow.hidden) main.querySelector('#gen-next')?.click(); return; }
    let k = -1;
    if (/^[a-dA-D]$/.test(e.key)) k = e.key.toLowerCase().charCodeAt(0) - 97;
    else if (/^[1-4]$/.test(e.key)) k = +e.key - 1;
    if (k >= 0) { const b = optsWrap.querySelector(`.gen-opt[data-disp="${k}"]`); if (b) choose(b); }
  };
  genWireTools(main);
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
  const label = run.mode === 'smart' ? 'Smart Review' : run.mode === 'topic' ? (GEN_TOPICS[run.topic] ? GEN_TOPICS[run.topic].name : 'Drill') : `Ch ${run.chapter}`;
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
    else if (run.mode === 'topic') startGenTopic(run.topic);
    else startGenChapter(run.chapter);
  });
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}
