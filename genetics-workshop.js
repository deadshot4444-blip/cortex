/* ============================================================================
   Genetics-2313-01E — MODULE 4 WORKSHOP (Chapters 10-12)
   The professor's workshop packet, reproduced word-for-word, as an interactive
   digital workbook. Loaded after genetics.js; shares app.js globals
   (el, esc, topbar, siteFooter, setView) and genetics globals (GEN, genSave,
   genClearTimer, genTrack, renderGenHome).

   Question text, options, and answers are VERBATIM from the professor's answer
   key. We do not invent explanations for the multiple-choice items — the key
   marks the correct option, so that is what we show.

   Diagram items (Q32-57 in the packet) were printed to be drawn on by hand.
   Here they are rebuilt as ORIGINAL interactive label-the-diagram exercises —
   26 labels across 5 figures. We deliberately do NOT host the McGraw Hill art
   (copyright); these are our own vector schematics of the same concepts.

   Progress lives in GEN.ws (inside localStorage['cs-genetics']).
   ========================================================================= */

/* ---------------------------------------------------------------------------
   PROGRESS
   --------------------------------------------------------------------------- */
function gwsState() {
  if (!GEN.ws || typeof GEN.ws !== 'object') GEN.ws = { ans: {}, done: {} };
  if (!GEN.ws.ans) GEN.ws.ans = {};
  if (!GEN.ws.done) GEN.ws.done = {};
  return GEN.ws;
}
function gwsSet(qid, val) { const w = gwsState(); w.ans[qid] = val; genSave(); }
function gwsGet(qid) { return gwsState().ans[qid]; }
function gwsResetSection(sec) {
  const w = gwsState();
  gwsSectionQids(sec).forEach(id => { delete w.ans[id]; });
  delete w.done[sec.id];
  genSave();
}
function gwsSectionQids(sec) {
  const ids = [];
  if (sec.items) sec.items.forEach(it => ids.push(sec.id + ':' + it.n));
  if (sec.diagrams) sec.diagrams.forEach(d => d.slots.forEach(s => ids.push(sec.id + ':' + d.id + ':' + s.n)));
  if (sec.terms) sec.terms.forEach(t => ids.push(sec.id + ':' + t.n));
  if (sec.tables) sec.tables.forEach(t => t.rows.forEach((r, ri) => t.cols.forEach((c, ci) => { if (c.blank) ids.push(sec.id + ':' + t.id + ':' + ri + ':' + ci); })));
  return ids;
}
function gwsSectionProgress(sec) {
  const ids = gwsSectionQids(sec), w = gwsState();
  const done = ids.filter(id => w.ans[id] !== undefined && w.ans[id] !== null && w.ans[id] !== '').length;
  return { done, total: ids.length, pct: ids.length ? Math.round(done / ids.length * 100) : 0 };
}
function gwsOverall() {
  let d = 0, t = 0;
  GWS.sections.forEach(s => { const p = gwsSectionProgress(s); d += p.done; t += p.total; });
  return { done: d, total: t, pct: t ? Math.round(d / t * 100) : 0 };
}
function gwsNorm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

/* ============================================================================
   INTERACTIVE DIAGRAMS (original schematics — Q32-57 label bank)
   Each: { id, n0, title, caption, W, H, art(), slots:[{n,x,y,answer}] }
   Pins are numbered with the packet's question numbers.
   ========================================================================= */
const GWS_ART = {};

/* shared svg helpers (scoped) */
const _a = {
  duplex(x1, x2, y, h) {
    h = h || 11;
    return `<rect x="${x1}" y="${y - h / 2}" width="${x2 - x1}" height="${h}" rx="${h / 2}" fill="url(#gwsDna)"/>`;
  },
  strand(x1, x2, y, col) { return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${col || '#7d93b4'}" stroke-width="3.4" stroke-linecap="round"/>`; },
  txt(x, y, s, o) {
    o = o || {};
    return `<text x="${x}" y="${y}" text-anchor="${o.anchor || 'middle'}" fill="${o.fill || '#3f3f46'}" style="font-family:${o.mono ? 'var(--mono)' : 'var(--sans)'};font-size:${o.size || 10.5}px;font-weight:${o.w || 600}">${s}</text>`;
  },
  box(x, y, w, h, fill, label, tf) {
    let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${fill}"/>`;
    if (label) s += _a.txt(x + w / 2, y + h / 2 + 3.6, label, { fill: tf || '#fff', w: 700, size: 10, mono: true });
    return s;
  },
  polymerase(cx, cy, s) {
    s = s || 1;
    return `<g transform="translate(${cx},${cy}) scale(${s})" filter="url(#gwsSh)">
      <path d="M-30,-4 q-8,-24 17,-24 q26,0 26,18 q0,8 -7,11 q7,4 7,12 q0,18 -26,18 q-24,0 -17,-22 q-5,-4 -5,-9 q0,-6 5,-8 Z" fill="url(#gwsPol)"/>
      <ellipse cx="-9" cy="-12" rx="10" ry="6" fill="#fff" opacity=".18"/></g>`;
  },
  rna(d, w) { return `<path d="${d}" fill="none" stroke="#d1462f" stroke-width="${w || 3}" stroke-linecap="round"/>`; },
  arrow(x1, y1, x2, y2, col) { return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col || '#52525b'}" stroke-width="1.8" marker-end="url(#gwsArr)"/>`; },
};
const GWS_DEFS = `<defs>
  <linearGradient id="gwsDna" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c3d0e2"/><stop offset="1" stop-color="#8ea3c0"/></linearGradient>
  <linearGradient id="gwsPol" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6a45c"/><stop offset="1" stop-color="#a4722c"/></linearGradient>
  <linearGradient id="gwsRho" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fb4d8"/><stop offset="1" stop-color="#4d7ba8"/></linearGradient>
  <linearGradient id="gwsSig" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2b8d8"/><stop offset="1" stop-color="#a85f93"/></linearGradient>
  <filter id="gwsSh" x="-40%" y="-40%" width="180%" height="200%"><feDropShadow dx="0" dy="1.2" stdDeviation="1.5" flood-color="#1f2937" flood-opacity=".26"/></filter>
  <marker id="gwsArr" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,1 L7,4.5 L0,8 Z" fill="#52525b"/></marker>
</defs>`;

/* --- D1: bacterial promoter & transcriptional start site (Q32-38) --- */
GWS_ART.promoter = {
  id: 'promoter', title: 'Bacterial promoter & transcriptional start site',
  caption: 'A bacterial promoter sits upstream of the transcriptional start site. Label the strands, the two consensus elements, the promoter, the start site, and the RNA.',
  W: 640, H: 250,
  art() {
    const y1 = 90, y2 = 130;
    let s = '';
    s += _a.strand(30, 610, y1, '#5b7fae');
    s += _a.strand(30, 610, y2, '#93a7c2');
    s += _a.txt(20, y1 + 4, "5′", { anchor: 'end', mono: true, fill: '#71717a' });
    s += _a.txt(620, y1 + 4, "3′", { anchor: 'start', mono: true, fill: '#71717a' });
    s += _a.txt(20, y2 + 4, "3′", { anchor: 'end', mono: true, fill: '#71717a' });
    s += _a.txt(620, y2 + 4, "5′", { anchor: 'start', mono: true, fill: '#71717a' });
    // -35 and -10 boxes
    s += _a.box(150, y1 - 11, 70, 42, '#c8892f', '−35', '#fff');
    s += _a.box(320, y1 - 11, 70, 42, '#c8892f', '−10', '#fff');
    // promoter bracket
    s += `<path d="M150,60 L150,52 L390,52 L390,60" fill="none" stroke="#71717a" stroke-width="1.4"/>`;
    // spacer annotation
    s += `<line x1="222" y1="110" x2="318" y2="110" stroke="#a1a1aa" stroke-width="1" stroke-dasharray="3 3"/>`;
    s += _a.txt(270, 105, '16–18 bp', { size: 9, fill: '#a1a1aa', mono: true });
    // +1 start site
    s += `<line x1="452" y1="72" x2="452" y2="146" stroke="#1a7f37" stroke-width="1.6" stroke-dasharray="4 3"/>`;
    s += _a.txt(452, 66, '+1', { fill: '#1a7f37', w: 700, mono: true, size: 11 });
    // RNA emerging
    s += _a.rna('M452,74 q26,-22 60,-24');
    s += `<path d="M512,50 l-9,3 l4,-8 z" fill="#d1462f"/>`;
    s += _a.txt(524, 44, "5′", { anchor: 'start', mono: true, fill: '#d1462f', size: 9.5 });
    return s;
  },
  slots: [
    { n: 32, x: 78, y: 74, answer: 'Coding strand' },
    { n: 33, x: 78, y: 148, answer: 'Template strand' },
    { n: 34, x: 270, y: 46, answer: 'Promoter' },
    { n: 35, x: 185, y: 152, answer: '−35 sequence' },
    { n: 36, x: 355, y: 152, answer: '−10 sequence' },
    { n: 37, x: 452, y: 170, answer: 'Transcriptional start site' },
    { n: 38, x: 548, y: 66, answer: 'RNA' },
  ],
};

/* --- D2: the transcription bubble (Q39-44) --- */
GWS_ART.bubble = {
  id: 'bubble', title: 'The open transcription bubble',
  caption: 'RNA polymerase slides along the DNA, opening a bubble. Label the enzyme, the two strands, the hybrid, and the DNA that is opening and closing.',
  W: 640, H: 280,
  art() {
    const yc = 150;
    let s = '';
    // closed duplex left and right
    s += _a.duplex(20, 200, yc);
    s += _a.duplex(440, 620, yc);
    // bubble: splayed strands
    s += `<path d="M200,${yc - 5} C250,${yc - 60} 390,${yc - 60} 440,${yc - 5}" fill="none" stroke="#5b7fae" stroke-width="3.4"/>`;
    s += `<path d="M200,${yc + 5} C250,${yc + 60} 390,${yc + 60} 440,${yc + 5}" fill="none" stroke="#93a7c2" stroke-width="3.4"/>`;
    // RNA-DNA hybrid (short paired stretch along the template)
    s += `<path d="M290,${yc + 42} L370,${yc + 34}" stroke="#d1462f" stroke-width="3.4" stroke-linecap="round"/>`;
    for (let i = 0; i < 5; i++) { const t = i / 4, x = 292 + t * 76, yy = (yc + 42) - t * 8; s += `<line x1="${x}" y1="${yy}" x2="${x + 1}" y2="${yy - 9}" stroke="#a1a1aa" stroke-width="1.2"/>`; }
    // RNA exit
    s += _a.rna('M290,192 q-60,26 -108,20');
    s += _a.txt(168, 218, "5′", { mono: true, fill: '#d1462f', size: 9.5 });
    // polymerase over the bubble
    s += _a.polymerase(320, yc + 2, 1.5);
    // direction arrow
    s += _a.arrow(470, yc - 44, 560, yc - 44);
    // unwinding / rewinding curls
    s += `<path d="M206,${yc - 26} q-14,-10 -6,-22" fill="none" stroke="#52525b" stroke-width="1.4" marker-end="url(#gwsArr)"/>`;
    s += `<path d="M434,${yc - 26} q14,-10 6,-22" fill="none" stroke="#52525b" stroke-width="1.4" marker-end="url(#gwsArr)"/>`;
    return s;
  },
  slots: [
    { n: 39, x: 320, y: 118, answer: 'RNA polymerase' },
    { n: 40, x: 250, y: 96, answer: 'Coding strand' },
    { n: 41, x: 250, y: 214, answer: 'Template strand' },
    { n: 42, x: 396, y: 196, answer: 'RNA–DNA hybrid region' },
    { n: 43, x: 176, y: 106, answer: 'Unwinding of DNA' },
    { n: 44, x: 470, y: 106, answer: 'Rewinding of DNA' },
  ],
};

/* --- D3: sigma factor initiation cycle (Q45-49) --- */
GWS_ART.sigma = {
  id: 'sigma', title: 'σ factor and the initiation cycle',
  caption: 'The holoenzyme finds the promoter, melts it open, and then the σ factor departs. Label each stage and each player.',
  W: 640, H: 340,
  art() {
    let s = '';
    const rows = [70, 150, 230, 306];
    rows.forEach(y => { s += _a.duplex(30, 610, y, 9); });
    // promoter tiles on each row
    rows.forEach(y => { s += _a.box(230, y - 10, 40, 20, '#dcb87a', '−35', '#4a3411'); s += _a.box(300, y - 10, 40, 20, '#dcb87a', '−10', '#4a3411'); });
    // row1: holoenzyme with sigma, off promoter (sliding)
    s += _a.polymerase(130, 62, 0.9);
    s += `<ellipse cx="106" cy="76" rx="17" ry="11" fill="url(#gwsSig)" filter="url(#gwsSh)"/>`;
    s += _a.arrow(170, 62, 216, 62);
    // row2: closed complex on promoter
    s += _a.polymerase(285, 142, 0.9);
    s += `<ellipse cx="261" cy="156" rx="17" ry="11" fill="url(#gwsSig)" filter="url(#gwsSh)"/>`;
    // row3: open complex (bubble) + short RNA
    s += `<path d="M262,224 q22,-16 44,0" fill="none" stroke="#5b7fae" stroke-width="2.6"/>`;
    s += `<path d="M262,236 q22,16 44,0" fill="none" stroke="#93a7c2" stroke-width="2.6"/>`;
    s += _a.polymerase(285, 222, 0.9);
    s += `<ellipse cx="261" cy="236" rx="17" ry="11" fill="url(#gwsSig)" filter="url(#gwsSh)"/>`;
    s += _a.rna('M300,244 q22,10 40,6', 2.4);
    // row4: sigma released, core enzyme moving, transcript
    s += _a.polymerase(400, 298, 0.9);
    s += `<ellipse cx="196" cy="300" rx="17" ry="11" fill="url(#gwsSig)" filter="url(#gwsSh)"/>`;
    s += _a.rna('M372,312 q-50,18 -96,14', 2.6);
    return s;
  },
  slots: [
    { n: 45, x: 88, y: 100, answer: 'σ factor' },
    { n: 46, x: 152, y: 34, answer: 'RNA polymerase holoenzyme' },
    { n: 47, x: 420, y: 150, answer: 'Closed complex' },
    { n: 48, x: 420, y: 230, answer: 'Open complex' },
    { n: 49, x: 470, y: 274, answer: 'RNA polymerase core enzyme' },
  ],
};

/* --- D4: rho-dependent termination (Q50-53) --- */
GWS_ART.rhoDep = {
  id: 'rhoDep', title: 'ρ-dependent termination',
  caption: 'The ρ protein latches onto the rut site and chases the polymerase, unwinding the RNA–DNA hybrid at the pause.',
  W: 640, H: 250,
  art() {
    let s = '';
    s += _a.duplex(30, 610, 168);
    // terminator region on DNA
    s += _a.box(452, 156, 78, 24, '#3f3f46', 'terminator', '#fff');
    // RNA with rut site
    s += _a.rna('M70,120 L200,120 L300,120 q40,0 60,14');
    s += `<rect x="150" y="114" width="52" height="12" rx="6" fill="#e3b341"/>`;
    s += _a.txt(176, 106, 'rut', { size: 9.5, fill: '#8a6100', w: 700, mono: true });
    s += _a.txt(60, 124, "5′", { anchor: 'end', mono: true, fill: '#d1462f', size: 9.5 });
    // stem-loop pausing polymerase
    s += `<path d="M366,132 q10,-26 20,0 q10,26 20,0" fill="none" stroke="#d1462f" stroke-width="2.6"/>`;
    // rho protein (hexagon) moving along RNA
    s += `<g filter="url(#gwsSh)"><path d="M250,102 l14,-8 l14,8 l0,16 l-14,8 l-14,-8 z" fill="url(#gwsRho)"/></g>`;
    s += _a.arrow(286, 110, 330, 118);
    // polymerase paused at terminator
    s += _a.polymerase(430, 160, 1.15);
    return s;
  },
  slots: [
    { n: 50, x: 176, y: 84, answer: 'ρ recognition site (rut)' },
    { n: 51, x: 264, y: 74, answer: 'ρ protein' },
    { n: 52, x: 386, y: 106, answer: 'Stem-loop' },
    { n: 53, x: 490, y: 204, answer: 'Terminator' },
  ],
};

/* --- D5: rho-independent termination (Q54-57) --- */
GWS_ART.rhoIndep = {
  id: 'rhoIndep', title: 'ρ-independent (intrinsic) termination',
  caption: 'A stem-loop stalls the polymerase; the weak U-rich hybrid then lets go on its own — no ρ protein required.',
  W: 640, H: 250,
  art() {
    let s = '';
    s += _a.duplex(30, 610, 168);
    s += _a.box(470, 156, 78, 24, '#3f3f46', 'terminator', '#fff');
    // RNA with hairpin then U-rich stretch
    s += _a.rna('M70,120 L280,120');
    s += `<path d="M280,120 q6,-42 26,-42 q20,0 26,42" fill="none" stroke="#d1462f" stroke-width="2.8"/>`;
    for (let i = 0; i < 4; i++) { const y = 92 + i * 9; s += `<line x1="292" y1="${y}" x2="320" y2="${y}" stroke="#a1a1aa" stroke-width="1.1"/>`; }
    s += _a.rna('M332,120 L404,120');
    ['U', 'U', 'U', 'U'].forEach((u, i) => { s += _a.txt(346 + i * 18, 112, u, { mono: true, size: 10.5, fill: '#d1462f', w: 700 }); });
    s += _a.txt(60, 124, "5′", { anchor: 'end', mono: true, fill: '#d1462f', size: 9.5 });
    // NusA sitting on the polymerase
    s += `<circle cx="440" cy="132" r="15" fill="#7fae94" filter="url(#gwsSh)"/>`;
    s += _a.txt(440, 136, 'NusA', { size: 8.5, fill: '#fff', w: 700 });
    s += _a.polymerase(446, 164, 1.15);
    return s;
  },
  slots: [
    { n: 54, x: 306, y: 62, answer: 'Stem-loop' },
    { n: 55, x: 368, y: 92, answer: 'U-rich RNA in the RNA–DNA hybrid' },
    { n: 56, x: 402, y: 132, answer: 'NusA' },
    { n: 57, x: 508, y: 204, answer: 'Terminator' },
  ],
};

const GWS_DIAGRAMS = [GWS_ART.promoter, GWS_ART.bubble, GWS_ART.sigma, GWS_ART.rhoDep, GWS_ART.rhoIndep];

/* ============================================================================
   THE WORKSHOP CONTENT — verbatim from the professor's answer key
   ========================================================================= */
const GWS = {
  title: 'Module 4 Workshop',
  chapters: 'Chapters 10–12',
  sections: [

    /* ---------------- Chapter 10 · multiple choice (1-19) ---------------- */
    {
      id: 'c10mc', kind: 'mcq', ch: 'Chapter 10',
      chTitle: 'Gene Transcription and RNA Modification',
      title: 'Multiple Choice', range: '1–19',
      items: [
        { n: 1, q: 'How does the -35 sequence in bacterial promoters influence transcription?', options: ['It signals the end of transcription', 'It binds the ribosome to start translation', 'It is recognized by the sigma factor to initiate transcription', 'It ensures proper splicing of the transcript'], answer: 2 },
        { n: 2, q: 'What is the function of general transcription factors in eukaryotic transcription?', options: ['They unwind DNA after transcription', 'They help RNA polymerase bind to the promoter and initiate transcription', 'They degrade mRNA after translation', 'They transport mRNA from the nucleus'], answer: 1 },
        { n: 3, q: 'How does rho-dependent termination differ from rho-independent termination in prokaryotes?', options: ['Rho-dependent termination requires a poly-A tail', 'Rho-independent termination involves exonuclease activity', 'Rho-dependent uses a helicase protein to release the RNA, while rho-independent relies on hairpin loops', 'Rho-dependent termination only occurs in eukaryotes'], answer: 2 },
        { n: 4, q: 'What is the primary role of enhancers in eukaryotic gene regulation?', options: ['They directly bind RNA polymerase II', 'They increase transcription levels by binding activator proteins even from a distance', 'They terminate transcription', 'They encode ribosomal RNA'], answer: 1 },
        { n: 5, q: 'Why is the 5′ cap added to eukaryotic mRNA essential?', options: ['It signals exon removal', 'It helps stabilize the mRNA and helps it exit the nucleus and initiate translation', 'It degrades unstable transcripts', 'It aids in splicing'], answer: 1 },
        { n: 6, q: 'In the torpedo model of eukaryotic transcription termination, what occurs after the cleavage of the transcript?', options: ['Rho factor binds the DNA', 'An exonuclease degrades the RNA downstream, displacing RNA polymerase', 'The DNA template is methylated', 'The ribosome binds the RNA polymerase'], answer: 1 },
        { n: 7, q: 'What advantage does the presence of introns provide to eukaryotic genes?', options: ['It increases mutation rates', 'It permits alternative splicing, leading to protein diversity', 'It prevents transcription entirely', 'It allows DNA replication to speed up'], answer: 1 },
        { n: 8, q: 'What is the role of U6 snRNP in pre-mRNA splicing?', options: ['It cleaves the poly-A tail', 'It degrades exons', 'It catalyzes the splicing reaction at the splice sites', 'It binds the promoter region'], answer: 2 },
        { n: 9, q: 'How does RNA editing contribute to protein diversity?', options: ['It stabilizes the poly-A tail', 'It changes the RNA sequence post-transcriptionally, potentially altering the amino acid sequence', 'It blocks translation', 'It initiates transcription'], answer: 1 },
        { n: 10, q: 'A mutation in the polyadenylation signal of a gene would most directly affect which mRNA process?', options: ['Transcription initiation', 'Spliceosome assembly', '3′ end cleavage and poly-A tail addition', 'Cap-binding protein attachment'], answer: 2 },
        { n: 11, q: 'Where in the cell are ribosomal subunits first assembled?', options: ['Cytoplasm', 'Nucleoplasm', 'Endoplasmic reticulum', 'Nucleolus'], answer: 3 },
        { n: 12, q: 'What could result if the spliceosome fails to recognize an intron?', options: ['Translation of mRNA is enhanced', 'A mature mRNA with incorrect exon combinations is produced', 'DNA replication is halted', 'The mRNA forms a hairpin loop'], answer: 1 },
        { n: 13, q: 'What experimental evidence supports the occurrence of alternative splicing?', options: ['The same gene producing different mRNAs and proteins in different tissues', 'Every gene only having one mRNA product', 'DNA forming multiple promoter regions', 'Translation beginning in the nucleus'], answer: 0 },
        { n: 14, q: 'If the TATA-binding protein (TBP) is missing, what immediate effect would this have on transcription?', options: ['The mRNA would be degraded', 'The pre-initiation complex would fail to assemble at the promoter', 'Splicing would not occur', 'RNA polymerase would move in the wrong direction'], answer: 1 },
        { n: 15, q: 'What process is impaired in a mutated RNA polymerase II that lacks the ability to phosphorylate its CTD?', options: ['Ribosome recruitment', 'DNA replication', 'Coordination of mRNA processing steps like capping and splicing'], answer: 2 },
        { n: 16, q: 'How does the DNA template strand determine the RNA transcript sequence?', options: ['It is identical to the RNA strand', 'Its sequence is copied exactly, base for base', 'RNA is complementary to the DNA template strand', 'RNA binds to the coding strand'], answer: 2 },
        { n: 17, q: 'What distinguishes the DNA coding strand from the template strand?', options: ['The coding strand is translated into protein', 'The coding strand is complementary to the mRNA', 'The coding strand has a different sugar backbone', 'The coding strand matches the mRNA sequence (except T is replaced with U)'], answer: 3 },
        { n: 18, q: 'Why are transcription factors considered trans-acting elements?', options: ['They are found only in mitochondria', 'They are located on the same DNA molecule as the genes they regulate', 'They are proteins encoded by different genes that act at distant sites in the genome', 'They only bind RNA'], answer: 2 },
        { n: 19, q: 'What is the consequence if the 5′ cap is not added to a newly formed eukaryotic mRNA?', options: ['The RNA polymerase will stop transcription prematurely', 'The mRNA may not be recognized by the ribosome and may be degraded in the cytoplasm', 'The poly-A tail will not be added', 'Transcription will switch to the antisense strand'], answer: 1 },
      ],
    },

    /* ---------------- Chapter 10 · short answer (20-31) ---------------- */
    {
      id: 'c10sa', kind: 'short', ch: 'Chapter 10',
      chTitle: 'Gene Transcription and RNA Modification',
      title: 'Short Answer', range: '20–31',
      items: [
        { n: 20, q: 'In eukaryotes, what is the role of general transcription factors (TFs)?', a: 'They help RNA polymerase II bind to the promoter and initiate transcription. TFIID in particular recognizes the TATA box and recruits the other TFs' },
        { n: 21, q: 'How does rho-dependent termination differ mechanistically from rho-independent termination?', a: 'Rho-dependent uses the rho protein to bind the rut site and unwind RNA from DNA; rho-independent relies on a hairpin loop followed by a U-rich sequence to destabilize the complex.' },
        { n: 22, q: 'Why is the 5′ cap essential for mRNA function?', a: 'It protects mRNA from degradation, aids in nuclear export, and is required for translation initiation' },
        { n: 23, q: 'What happens during the torpedo model of transcription termination?', a: 'An exonuclease degrades the remaining RNA after cleavage, catching up to and displacing RNA polymerase.' },
        { n: 24, q: 'How does RNA editing contribute to protein diversity?', a: 'It alters nucleotide sequences post-transcriptionally, changing the resulting protein product.' },
        { n: 25, q: 'A mutation in the polyadenylation signal might affect which part of mRNA processing?', a: '3′ end cleavage and poly-A tail addition.' },
        { n: 26, q: 'What does the presence of introns allow for in eukaryotic genes?', a: 'They allow for alternative splicing, increasing protein diversity.' },
        { n: 27, q: 'If a spliceosome fails to recognize an intron, what could be the consequence? What is special about the U6 subunit?', a: 'If a spliceosome fails to recognize an intron, it may be retained in the mRNA, potentially leading to a nonfunctional or harmful protein. The U6 snRNA is crucial because it acts as a ribozyme, catalyzing the splicing reactions.' },
        { n: 28, q: 'What is the importance of alternative splicing?', a: 'It allows one gene to produce multiple protein variants.' },
        { n: 29, q: 'How is rRNA processed and where does it occur?', a: 'rRNA is transcribed as a large precursor (45S in eukaryotes) and is processed in the nucleolus. This involves cleavage into smaller rRNAs (18S, 5.8S, and 28S), chemical modifications like methylation and pseudouridylation, and assembly with ribosomal proteins to form ribosomal subunits. The 5S rRNA is transcribed separately outside the nucleolus but joins the large subunit later.' },
        { n: 30, q: 'What is the consequence of missing the TATA-binding protein (TBP) in eukaryotic transcription?', a: 'Transcription by RNA polymerase II would not initiate properly.' },
        { n: 31, q: 'What distinguishes the DNA coding strand from the template strand?', a: 'The coding strand has the same sequence as mRNA (except T for U) it is not used in transcription; the template strand is used by RNA polymerase to synthesize mRNA.' },
      ],
    },

    /* ---------------- Diagram labeling (32-57) ---------------- */
    {
      id: 'diag', kind: 'diagram', ch: 'Chapter 10',
      chTitle: 'Gene Transcription and RNA Modification',
      title: 'Label the Diagrams', range: '32–57',
      note: 'In the printed packet these figures were left blank to be labeled by hand. Click a numbered pin, then choose its label.',
      diagrams: GWS_DIAGRAMS,
    },

    /* ---------------- Fill in the blank (58-72) ---------------- */
    {
      id: 'fill', kind: 'fill', ch: 'Chapters 11 & 12',
      chTitle: 'Translation; Gene Regulation',
      title: 'Fill in the Blank', range: '58–72',
      items: [
        { n: 58, before: 'The bond that forms between amino acids during translation is called a', after: 'bond.', a: 'peptide', accept: ['peptide'] },
        { n: 59, before: 'A tRNA carrying an amino acid is referred to as a', after: 'tRNA.', a: 'charged', accept: ['charged'] },
        { n: 60, before: 'The ribosomal site where peptide bond formation (peptidyl transferase) occurs is the', after: 'site.', a: 'P', accept: ['p', 'psite'] },
        { n: 61, before: 'The three-nucleotide sequences on mRNA that specify amino acids are called', after: '.', a: 'codons', accept: ['codons', 'codon'] },
        { n: 62, before: 'The enzyme that attaches amino acids to tRNAs is', after: 'synthetase.', a: 'aminoacyl-tRNA', accept: ['aminoacyltrna', 'aminoacyl'] },
        { n: 63, before: 'In bacteria, ribosome binding to mRNA is guided by the', after: 'sequence.', a: 'Shine-Dalgarno', accept: ['shinedalgarno'] },
        { n: 64, before: 'In the lac operon, lactose serves as an', after: 'that allows transcription.', a: 'inducer', accept: ['inducer'] },
        { n: 65, before: 'A regulatory protein that binds DNA to prevent transcription is a', after: '.', a: 'repressor', accept: ['repressor'] },
        { n: 66, before: 'When chromatin is tightly packed and transcriptionally silent, it is called', after: '.', a: 'heterochromatin', accept: ['heterochromatin'] },
        { n: 67, before: 'DNA methylation generally', after: 'gene expression.', a: 'decreases or represses', accept: ['decreases', 'represses', 'decreasesorrepresses', 'reduces', 'silences'] },
        { n: 68, before: 'Epigenetic modifications alter gene expression without changing the', after: '.', a: 'DNA sequence', accept: ['dnasequence', 'sequence'] },
        { n: 69, before: 'In eukaryotes, transcriptional activators bind to DNA regions called', after: '.', a: 'enhancers', accept: ['enhancers', 'enhancer'] },
        { n: 70, before: 'The regulatory protein that binds iron in post-transcriptional control of ferritin is called', after: '.', a: 'iron regulatory protein (IRP)', accept: ['ironregulatoryprotein', 'ironregulatoryproteinirp', 'irp'] },
        { n: 71, before: 'Regions rich in CpG sites that regulate transcription are called', after: '.', a: 'CpG islands', accept: ['cpgislands', 'cpgisland'] },
        { n: 72, before: 'The process by which nucleosomes are moved or restructured using ATP is called', after: '.', a: 'chromatin-remodeling', accept: ['chromatinremodeling', 'chromatinremodelling'] },
      ],
    },

    /* ---------------- True / False (73-82) ---------------- */
    {
      id: 'tf', kind: 'tf', ch: 'Chapters 11 & 12',
      chTitle: 'Translation; Gene Regulation',
      title: 'True / False and rewrite to correct the statement', range: '73–82',
      items: [
        { n: 73, s: 'The E site of the ribosome holds the incoming aminoacyl-tRNA.', t: false, fix: 'The E site holds the exiting tRNA.' },
        { n: 74, s: 'Aminoacyl-tRNA synthetase ensures accurate pairing between amino acids and tRNAs.', t: true },
        { n: 75, s: 'Translational control can occur by blocking ribosome binding to mRNA.', t: true },
        { n: 76, s: 'Constitutive genes are constantly expressed without regulation.', t: true },
        { n: 77, s: 'Attenuation regulates eukaryotic genes involved in amino acid biosynthesis.', t: false, fix: 'Attenuation occurs in prokaryotes (e.g., trp operon).' },
        { n: 78, s: 'Histone acetylation generally opens chromatin and increases transcription.', t: true },
        { n: 79, s: 'DNA methylation generally results in gene silencing.', t: true },
        { n: 80, s: 'Enhancers must be located immediately upstream of the promoter to function.', t: false, fix: 'Enhancers can act at variable distances.' },
        { n: 81, s: 'Regulatory transcription factors can be activated by phosphorylation.', t: true },
        { n: 82, s: 'Heterochromatin typically shows lower levels of transcription.', t: true },
      ],
    },

    /* ---------------- Matching (83-93) ---------------- */
    {
      id: 'match', kind: 'match', ch: 'Chapters 11 & 12',
      chTitle: 'Translation; Gene Regulation',
      title: 'Matching', range: '83–93',
      terms: [
        { n: 83, term: 'Histone variants', a: 'H' },
        { n: 84, term: 'Epigenetics', a: 'D' },
        { n: 85, term: 'Imprinting', a: 'J' },
        { n: 86, term: 'Covalent histone modification', a: 'E' },
        { n: 87, term: 'Heterochromatin', a: 'F' },
        { n: 88, term: 'Euchromatin', a: 'B' },
        { n: 89, term: 'Repressor', a: 'G' },
        { n: 90, term: 'Silencer', a: 'A' },
        { n: 91, term: 'Activator', a: 'I' },
        { n: 92, term: 'Epigenetic inheritance', a: 'K' },
        { n: 93, term: 'Enhancer', a: 'C' },
      ],
      defs: [
        { k: 'A', d: 'DNA sequence that represses gene expression when bound by a protein' },
        { k: 'B', d: 'Structural chromatin form associated with active gene expression' },
        { k: 'C', d: 'DNA sequence that increases transcription when bound by a activator regulatory protein and decreases transcription when bound by a repressor. May involve methylation and chromatin remodeling' },
        { k: 'D', d: 'A form of gene regulation that does <b>not</b> alter DNA sequence' },
        { k: 'E', d: 'Reversible chemical changes to histone tails (e.g., acetylation that loosens the connection with DNA promotes transcription)' },
        { k: 'F', d: 'Compact chromatin form usually associated with gene silencing' },
        { k: 'G', d: 'Protein that binds DNA and reduces transcription' },
        { k: 'H', d: 'Specific DNA packaging proteins that have a slight difference in their amino acid sequence, that can alter chromatin structure' },
        { k: 'I', d: 'Protein that binds DNA and promotes transcription' },
        { k: 'J', d: 'Gene expression pattern based on parent of origin' },
        { k: 'K', d: 'Transmission of gene expression states across cell divisions without changing DNA sequence, may occur in oogenesis, spermatogenesis or embryogenesis' },
      ],
    },

    /* ---------------- Chapters 11-12 · application MCQ (94-126) ---------------- */
    {
      id: 'c1112mc', kind: 'mcq', ch: 'Chapters 11 & 12',
      chTitle: 'Translation; Gene Regulation',
      title: 'Application Multiple Choice', range: '94–126',
      items: [
        { n: 94, q: 'A ribosome stalls because the mRNA lacks a proper ribosome-binding site. Which step is most directly affected?', options: ['Elongation', 'Termination', 'Initiation', 'Release factor function'], answer: 2 },
        { n: 95, q: 'A mutation prevents an aminoacyl-tRNA synthetase from recognizing its tRNA. What is the most likely outcome?', options: ['Faster protein synthesis', 'Misincorporation of amino acids', 'Ribosome skipping codons', 'Translation termination'], answer: 1 },
        { n: 96, q: 'A researcher changes the start codon AUG to AUA. What happens?', options: ['Normal initiation', 'No translation begins', 'Excess protein produced', 'Frameshift mutation'], answer: 1 },
        { n: 97, q: 'Which situation would reduce translation efficiency in eukaryotes?', options: ['Loss of poly-A tail', 'Increased ribosome recruitment', 'Presence of multiple start codons', 'Proper 5′ cap'], answer: 0 },
        { n: 98, q: 'A mutation causes tRNAs to frequently mispair with codons. Which process is most disrupted?', options: ['Ribosome assembly', 'Fidelity of protein synthesis', 'RNA splicing', 'mRNA export'], answer: 1 },
        { n: 99, q: 'A competitive inhibitor blocks peptidyl-transferase activity. Predict the result.', options: ['No peptide bonds form', 'Incorrect amino acids incorporated', 'Ribosomes cannot bind mRNA', 'Transcription stops'], answer: 0 },
        { n: 100, q: 'Which event best explains why protein synthesis stops when a stop codon is reached?', options: ['tRNA hydrolyzes GTP', 'Release factors bind', 'Ribosome slides past stop codon', 'mRNA becomes methylated'], answer: 1 },
        { n: 101, q: 'A cell overproduces a protein despite normal environmental conditions. Which mechanism most likely failed?', options: ['tRNA synthesis', 'Translational repression system', 'Ribosome biogenesis', 'RNA polymerase termination'], answer: 1 },
        { n: 102, q: 'A mutation eliminates the operator in an operon. Predict the effect.', options: ['The operon cannot be repressed', 'RNA polymerase cannot bind', 'Chromatin compacts', 'Transcription becomes iron-dependent'], answer: 0 },
        { n: 103, q: 'A cell grows in low glucose and no lactose. What happens to the lac operon?', options: ['Fully activated', 'Repressed', 'Activated only during translation', 'Activated by cAMP only'], answer: 1 },
        { n: 104, q: 'A small molecule inactivates a repressor. This gene is likely:', options: ['Repressible', 'Inducible', 'Constitutive', 'Epigenetically silenced'], answer: 1 },
        { n: 105, q: 'A mutation prevents formation of the attenuation hairpin in the trp operon. Predict expression levels.', options: ['Higher tryptophan production even when tryptophan is high', 'Permanent repression', 'No ribosome binding', 'Stop codon misread'], answer: 0 },
        { n: 106, q: 'Which experimental result suggests translational regulation?', options: ['mRNA levels unchanged; protein levels reduced', 'mRNA increases with protein', 'Chromatin-modifying enzyme recruited', 'RNA polymerase blocked at promoter'], answer: 0 },
        { n: 107, q: 'Glucose suddenly becomes available to bacteria consuming lactose. Expected result?', options: ['Lac operon increases expression', 'cAMP levels rise', 'CAP detaches, lowering transcription', 'Attenuation begins'], answer: 2 },
        { n: 108, q: 'An mRNA forms secondary structure that blocks the ribosome. This is:', options: ['Transcriptional repression', 'Attenuation', 'Translational inhibition', 'Antisense degradation'], answer: 2 },
        { n: 109, q: 'Which mutation produces a constitutive lac operon?', options: ['Repressor cannot bind operator', 'No Shine-Dalgarno sequence', 'CAP cannot bind cAMP', 'Excess tryptophan present'], answer: 0 },
        { n: 110, q: 'In bacteria, a mutation destroys a repressor binding site. Which outcome occurs?', options: ['Gene always expressed', 'RNA polymerase cannot bind', 'Translation is blocked', 'Chromatin condenses'], answer: 0 },
        { n: 111, q: 'A researcher deletes the promoter of a bacterial operon. Predict gene expression.', options: ['Silent — RNA polymerase cannot initiate transcription', 'Hyper-active genes', 'RNA polymerase binds stronger', 'Controlled by cAMP'], answer: 0 },
        { n: 112, q: 'A gene becomes highly expressed after histone acetyl transferase recruitment. Why?', options: ['DNA condenses', 'RNA polymerase is blocked', 'Chromatin opens, increasing access', 'Methylation increases'], answer: 2 },
        { n: 113, q: 'A cell prevents transcription factor entry into the nucleus. What is affected?', options: ['Transcription initiation', 'Splicing', 'Translation elongation', 'Protein folding'], answer: 0 },
        { n: 114, q: 'A mutation prevents CpG methylation near a promoter. Predict expression.', options: ['Likely increased transcription', 'No effect', 'Protein degraded', 'Ribosomes cannot bind'], answer: 0 },
        { n: 115, q: 'Which scenario demonstrates epigenetic inheritance?', options: ['DNA sequence mutation passed to offspring', 'Methylation patterns transmitted during gametogenesis', 'RNA polymerase proofreading', 'tRNA recycling'], answer: 1 },
        { n: 116, q: 'A steroid hormone crosses the cell membrane and binds its receptor. What happens next?', options: ['Receptor dimerizes and regulates transcription', 'mRNA splicing occurs', 'Ribosomes pause translation', 'Promoter methylation increases'], answer: 0 },
        { n: 117, q: 'A chromatin remodeler relocates nucleosomes away from a promoter. Consequence?', options: ['Increased gene transcription', 'Transposable element activation', 'DNA replication failure', 'Stop codon readthrough'], answer: 0 },
        { n: 118, q: 'DNA methylation inhibitors are used in cancer therapy because they:', options: ['Activate tumor-suppressor genes', 'Destroy oncogene promoters', 'Block ribosome movement', 'Increase histone density'], answer: 0 },
        { n: 119, q: 'Histone methylation at silencing sites increases. Predict effect.', options: ['Increased transcription', 'Reduced transcription', 'Ribosome falls off', 'No effect on chromatin'], answer: 1 },
        { n: 120, q: 'A regulatory protein binds a silencer. What occurs next?', options: ['Transcription decreases', 'Chromatin opens', 'Ribosomes assemble', 'RNA splicing accelerates'], answer: 0 },
        { n: 121, q: 'A transcription factor requires phosphorylation to bind DNA. This represents:', options: ['Post-translational regulation', 'Attenuation', 'Alternative splicing', 'Nucleosome editing'], answer: 0 },
        { n: 122, q: 'A knockout mouse lacks a key chromatin remodeler. Which phenotype is most plausible?', options: ['Abnormal development due to mis-regulated genes', 'Faster protein translation', 'Improved DNA repair', 'Silencing of operons'], answer: 0 },
        { n: 123, q: 'A metabolic pathway produces amino acid Z through a series of enzyme-catalyzed steps. You observe that when the concentration of amino acid Z increases, the activity of the first enzyme in the pathway significantly decreases. Which of the following best explains this observation?', options: ['Amino acid Z activates the enzyme through allosteric enhancement.', 'The cell increases transcription of the enzyme gene when Z is abundant.', 'Amino acid Z binds to the active site of the first enzyme to block the substrate.', 'Amino acid Z binds to an allosteric site on the first enzyme, reducing its activity.'], answer: 3 },
        { n: 124, q: 'Which of the following best describes the role of antisense RNA in gene regulation?', options: ['It enhances transcription by binding to the promoter region of a gene.', 'It codes for a protein that represses translation.', 'It binds to a complementary mRNA strand to block translation.', 'It modifies the DNA sequence to prevent gene expression.'], answer: 2 },
        { n: 125, q: 'A researcher observes that a target cell begins transcribing certain anti-inflammatory genes shortly after exposure to a glucocorticoid hormone. Which of the following best explains how glucocorticoids regulate gene expression in this scenario?', options: ['They activate second messengers that phosphorylate transcription factors in the cytoplasm.', 'They bind directly to mRNA molecules to enhance translation.', 'They bind to membrane receptors, triggering calcium release and enzyme activation.', 'They enter the cell, bind to intracellular receptors, and influence gene transcription in the nucleus.'], answer: 3 },
        { n: 126, q: 'A child inherits a mutated allele of a gene from the father, but shows no symptoms of disease. However, when the same mutation is inherited from the mother, the disease is expressed. Which of the following best explains this observation?', options: ['The paternal allele undergoes X-inactivation in the child.', 'The gene is only expressed from the maternally inherited allele due to genomic imprinting.', 'The mutation is dominant only when inherited from the mother.', 'Both alleles are equally expressed, but the paternal mutation is silenced post-translationally.'], answer: 1 },
      ],
    },

    /* ---------------- Complete the tables ---------------- */
    {
      id: 'tables', kind: 'table', ch: 'Chapter 12',
      chTitle: 'Gene Regulation',
      title: 'Complete the Tables', range: 'Lac & Trp operons',
      tables: [
        {
          id: 'lac', title: 'Table: Lac Operon Regulation',
          prompt: 'Fill in the blanks for each scenario based on the presence or absence of <b>lactose</b> and <b>glucose</b>. Indicate whether the <b>repressor is bound</b>, whether <b>CAP is bound</b>, whether the <b>operon is transcribed</b>, and whether <b>lactose-metabolizing enzymes</b> are made.',
          cols: [
            { h: 'Lactose Present?' }, { h: 'Glucose Present?' },
            { h: 'Repressor Bound?', blank: true, opts: ['Yes', 'No'] },
            { h: 'CAP Bound?', blank: true, opts: ['Yes', 'No'] },
            { h: 'Operon Transcribed?', blank: true, opts: ['Yes', 'No', 'Low level'] },
            { h: 'Enzymes Produced?', blank: true, opts: ['Yes', 'No', 'Few'] },
          ],
          rows: [
            ['No', 'Yes', 'Yes', 'No', 'No', 'No'],
            ['Yes', 'Yes', 'No', 'No', 'Low level', 'Few'],
            ['Yes', 'No', 'No', 'Yes', 'Yes', 'Yes'],
            ['No', 'No', 'Yes', 'Yes', 'No', 'No'],
          ],
        },
        {
          id: 'trp', title: 'Table: Trp Operon Regulation',
          prompt: 'Fill in the blanks for each scenario based on the presence or absence of <b>tryptophan</b>. Indicate whether the <b>repressor is active</b>, whether it is <b>bound to the operator</b>, whether the <b>operon is transcribed</b>, and whether <b>tryptophan-synthesizing enzymes</b> are produced.',
          cols: [
            { h: 'Tryptophan Present?' },
            { h: 'Repressor Active?', blank: true, opts: ['Yes', 'No'] },
            { h: 'Repressor Bound to Operator?', blank: true, opts: ['Yes', 'No'] },
            { h: 'Operon Transcribed?', blank: true, opts: ['Yes', 'No'] },
            { h: 'Enzymes Produced?', blank: true, opts: ['Yes', 'No'] },
          ],
          rows: [
            ['Yes', 'Yes', 'Yes', 'No', 'No'],
            ['No', 'No', 'No', 'Yes', 'Yes'],
          ],
        },
      ],
    },
  ],
};

/* ============================================================================
   WORKSHOP HOME
   ========================================================================= */
function renderGenWorkshop() {
  genClearTimer();
  genTrack('workshop_home', {});
  const ov = gwsOverall();
  const card = (sec) => {
    const p = gwsSectionProgress(sec);
    const complete = p.total && p.done === p.total;
    return `<button class="gws-sec-card cornerframe ${complete ? 'done' : ''}" data-sec="${sec.id}">
      <span class="gws-sec-kicker">${esc(sec.ch)} · Q ${esc(sec.range)}</span>
      <h3>${esc(sec.title)}</h3>
      <p>${esc(sec.chTitle)}</p>
      <div class="gws-sec-foot">
        <span class="gws-bar"><span style="width:${p.pct}%"></span></span>
        <span class="mono gws-sec-pct">${complete ? '✓ complete' : p.done + '/' + p.total}</span>
      </div>
    </button>`;
  };
  const root = el('<div></div>');
  root.appendChild(topbar('genetics'));
  const main = el(`<main class="panel gws" id="main" tabindex="-1">
    <div class="gws-top">
      <button class="ghostbtn" id="gws-back">← Genetics</button>
    </div>

    <header class="gws-hero cornerframe">
      <span class="label">Instructor workshop · reproduced verbatim</span>
      <h1 class="gws-title">${esc(GWS.title)}</h1>
      <p class="gws-sub">${esc(GWS.chapters)} — Transcription, Translation &amp; Gene Regulation</p>
      <div class="gws-hero-meter">
        <div class="gws-bar lg"><span style="width:${ov.pct}%"></span></div>
        <span class="mono gws-hero-pct">${ov.done} / ${ov.total} answered · ${ov.pct}%</span>
      </div>
    </header>

    <div class="gws-note">
      Every question, option, and answer below is your professor's, word for word. The five figures were printed
      blank to be labeled by hand — here they're rebuilt as interactive diagrams you can label on screen.
    </div>

    <section class="gws-secgrid">${GWS.sections.map(card).join('')}</section>

    <div class="gws-utils">
      <button class="ghostbtn" id="gws-reset">Reset all workshop answers</button>
    </div>
  </main>`);
  main.querySelector('#gws-back').addEventListener('click', renderGenHome);
  main.querySelectorAll('[data-sec]').forEach(b => b.addEventListener('click', () => renderGenWorkshopSection(b.dataset.sec)));
  main.querySelector('#gws-reset').addEventListener('click', () => {
    if (!confirm('Clear every answer you have entered in the Module 4 Workshop?')) return;
    GEN.ws = { ans: {}, done: {} }; genSave(); renderGenWorkshop();
  });
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

/* ============================================================================
   SECTION VIEW
   ========================================================================= */
function renderGenWorkshopSection(secId) {
  genClearTimer();
  const sec = GWS.sections.find(s => s.id === secId);
  if (!sec) { renderGenWorkshop(); return; }
  genTrack('workshop_section', { section: secId });

  const root = el('<div></div>');
  root.appendChild(topbar('genetics'));
  const p = gwsSectionProgress(sec);
  const main = el(`<main class="panel gws" id="main" tabindex="-1">
    <div class="gws-top">
      <button class="ghostbtn" id="gws-back">← Workshop</button>
      <span class="gws-crumb mono">Q ${esc(sec.range)}</span>
    </div>
    <header class="gws-sechead">
      <span class="label">${esc(sec.ch)} · ${esc(sec.chTitle)}</span>
      <h1>${esc(sec.title)}</h1>
      ${sec.note ? `<p class="gws-sechead-note">${esc(sec.note)}</p>` : ''}
      <div class="gws-bar"><span id="gws-secbar" style="width:${p.pct}%"></span></div>
      <span class="mono gws-secprog" id="gws-secprog">${p.done}/${p.total} answered</span>
    </header>
    <div class="gws-body" id="gws-body"></div>
    <div class="gws-secfoot">
      <button class="btn" id="gws-revealall">Reveal all answers</button>
      <button class="ghostbtn" id="gws-resetsec">Reset this section</button>
      <button class="btn btn-solid" id="gws-next">${gwsNextLabel(sec)}</button>
    </div>
  </main>`);

  const body = main.querySelector('#gws-body');
  const bump = () => {
    const pp = gwsSectionProgress(sec);
    main.querySelector('#gws-secbar').style.width = pp.pct + '%';
    main.querySelector('#gws-secprog').textContent = pp.done + '/' + pp.total + ' answered';
  };

  if (sec.kind === 'mcq') gwsRenderMCQ(body, sec, bump);
  else if (sec.kind === 'short') gwsRenderShort(body, sec, bump);
  else if (sec.kind === 'fill') gwsRenderFill(body, sec, bump);
  else if (sec.kind === 'tf') gwsRenderTF(body, sec, bump);
  else if (sec.kind === 'match') gwsRenderMatch(body, sec, bump);
  else if (sec.kind === 'diagram') gwsRenderDiagrams(body, sec, bump);
  else if (sec.kind === 'table') gwsRenderTables(body, sec, bump);

  main.querySelector('#gws-back').addEventListener('click', renderGenWorkshop);
  main.querySelector('#gws-revealall').addEventListener('click', () => {
    body.querySelectorAll('[data-reveal]').forEach(b => b.click());
    body.querySelectorAll('.gws-diag').forEach(d => { const sb = d.querySelector('[data-showans]'); if (sb) sb.click(); });
  });
  main.querySelector('#gws-resetsec').addEventListener('click', () => {
    if (!confirm('Clear your answers for this section?')) return;
    gwsResetSection(sec); renderGenWorkshopSection(secId);
  });
  main.querySelector('#gws-next').addEventListener('click', () => {
    const i = GWS.sections.findIndex(s => s.id === secId);
    if (i >= 0 && i < GWS.sections.length - 1) renderGenWorkshopSection(GWS.sections[i + 1].id);
    else renderGenWorkshop();
  });
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
  window.scrollTo(0, 0);
}
function gwsNextLabel(sec) {
  const i = GWS.sections.findIndex(s => s.id === sec.id);
  return (i >= 0 && i < GWS.sections.length - 1) ? 'Next section →' : 'Finish ✓';
}

/* ---------------------------------------------------------------------------
   RENDERERS — one per question kind
   --------------------------------------------------------------------------- */
const GWS_LETTERS = ['A', 'B', 'C', 'D', 'E'];

function gwsRenderMCQ(host, sec, bump) {
  sec.items.forEach(it => {
    const qid = sec.id + ':' + it.n;
    const prev = gwsGet(qid);
    const card = el(`<article class="gws-q cornerframe">
      <div class="gws-q-head"><span class="gws-n mono">${it.n}</span><p class="gws-q-text">${esc(it.q)}</p></div>
      <div class="gws-opts">
        ${it.options.map((o, i) => `<button class="gws-opt" data-i="${i}"><span class="gws-opt-k mono">${GWS_LETTERS[i]}</span><span class="gws-opt-t">${esc(o)}</span></button>`).join('')}
      </div>
      <button class="gws-revealbtn" data-reveal>Show answer</button>
    </article>`);
    const opts = [...card.querySelectorAll('.gws-opt')];
    const mark = (picked) => {
      opts.forEach((b, i) => {
        b.disabled = true;
        if (i === it.answer) b.classList.add('correct');
        else if (i === picked) b.classList.add('wrong');
      });
      card.querySelector('[data-reveal]').remove();
      card.classList.add('answered');
    };
    opts.forEach(b => b.addEventListener('click', () => {
      const picked = +b.dataset.i;
      gwsSet(qid, picked); mark(picked); bump();
      genTrack('workshop_answer', { section: sec.id, q: it.n, correct: picked === it.answer ? 1 : 0 });
    }));
    card.querySelector('[data-reveal]').addEventListener('click', () => { gwsSet(qid, -1); mark(-1); bump(); });
    if (prev !== undefined) mark(prev);
    host.appendChild(card);
  });
}

function gwsRenderShort(host, sec, bump) {
  sec.items.forEach(it => {
    const qid = sec.id + ':' + it.n;
    const card = el(`<article class="gws-q cornerframe">
      <div class="gws-q-head"><span class="gws-n mono">${it.n}</span><p class="gws-q-text">${esc(it.q)}</p></div>
      <textarea class="gws-ta" rows="3" placeholder="Write your answer, then check it against the key…"></textarea>
      <button class="gws-revealbtn" data-reveal>Show the key</button>
      <div class="gws-key" hidden><span class="gws-key-lab">Answer key</span><p>${esc(it.a)}</p></div>
    </article>`);
    const ta = card.querySelector('.gws-ta');
    const key = card.querySelector('.gws-key');
    const btn = card.querySelector('[data-reveal]');
    const saved = gwsGet(qid);
    if (typeof saved === 'string') ta.value = saved;
    ta.addEventListener('input', () => { gwsSet(qid, ta.value); bump(); });
    btn.addEventListener('click', () => {
      key.hidden = false; btn.remove(); card.classList.add('answered');
      if (!gwsGet(qid)) { gwsSet(qid, ta.value || ' '); bump(); }
    });
    host.appendChild(card);
  });
}

function gwsRenderFill(host, sec, bump) {
  sec.items.forEach(it => {
    const qid = sec.id + ':' + it.n;
    const card = el(`<article class="gws-q gws-q-fill cornerframe">
      <div class="gws-q-head"><span class="gws-n mono">${it.n}</span>
        <p class="gws-q-text">${esc(it.before)} <input type="text" class="gws-blank" aria-label="answer" autocomplete="off" spellcheck="false" /> ${esc(it.after)}</p>
      </div>
      <div class="gws-fill-row">
        <button class="gws-checkbtn" data-check>Check</button>
        <button class="gws-revealbtn inline" data-reveal>Show answer</button>
        <span class="gws-verdict" hidden></span>
      </div>
      <div class="gws-key" hidden><span class="gws-key-lab">Answer</span><p>${esc(it.a)}</p></div>
    </article>`);
    const inp = card.querySelector('.gws-blank');
    const verdict = card.querySelector('.gws-verdict');
    const key = card.querySelector('.gws-key');
    const saved = gwsGet(qid);
    if (typeof saved === 'string') inp.value = saved;
    inp.addEventListener('input', () => { gwsSet(qid, inp.value); verdict.hidden = true; inp.classList.remove('ok', 'no'); bump(); });
    const check = () => {
      const v = gwsNorm(inp.value);
      if (!v) return;
      const ok = it.accept.some(a => gwsNorm(a) === v) || gwsNorm(it.a) === v;
      verdict.hidden = false;
      verdict.textContent = ok ? 'Correct' : 'Not quite';
      verdict.className = 'gws-verdict ' + (ok ? 'ok' : 'no');
      inp.classList.toggle('ok', ok); inp.classList.toggle('no', !ok);
    };
    card.querySelector('[data-check]').addEventListener('click', check);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
    card.querySelector('[data-reveal]').addEventListener('click', (e) => {
      key.hidden = false; e.currentTarget.remove(); card.classList.add('answered');
      if (!gwsGet(qid)) { gwsSet(qid, ' '); bump(); }
    });
    host.appendChild(card);
  });
}

function gwsRenderTF(host, sec, bump) {
  sec.items.forEach(it => {
    const qid = sec.id + ':' + it.n;
    const card = el(`<article class="gws-q cornerframe">
      <div class="gws-q-head"><span class="gws-n mono">${it.n}</span><p class="gws-q-text">${esc(it.s)}</p></div>
      <div class="gws-tf">
        <button class="gws-tfbtn" data-v="1">True</button>
        <button class="gws-tfbtn" data-v="0">False</button>
      </div>
      <button class="gws-revealbtn" data-reveal>Show answer</button>
      <div class="gws-key" hidden>
        <span class="gws-key-lab">${it.t ? 'True' : 'False'}</span>
        ${it.fix ? `<p><b>Corrected:</b> ${esc(it.fix)}</p>` : '<p>The statement as written is correct.</p>'}
      </div>
    </article>`);
    const btns = [...card.querySelectorAll('.gws-tfbtn')];
    const key = card.querySelector('.gws-key');
    const mark = (picked) => {
      btns.forEach(b => {
        b.disabled = true;
        const v = b.dataset.v === '1';
        if (v === it.t) b.classList.add('correct');
        else if (picked !== null && (b.dataset.v === '1') === picked) b.classList.add('wrong');
      });
      key.hidden = false;
      const rb = card.querySelector('[data-reveal]'); if (rb) rb.remove();
      card.classList.add('answered');
    };
    btns.forEach(b => b.addEventListener('click', () => {
      const picked = b.dataset.v === '1';
      gwsSet(qid, picked ? 1 : 0); mark(picked); bump();
    }));
    card.querySelector('[data-reveal]').addEventListener('click', () => { gwsSet(qid, -1); mark(null); bump(); });
    const prev = gwsGet(qid);
    if (prev !== undefined) mark(prev === -1 ? null : prev === 1);
    host.appendChild(card);
  });
}

function gwsRenderMatch(host, sec, bump) {
  const wrap = el(`<div class="gws-match">
    <div class="gws-match-defs cornerframe">
      <span class="label">Definitions</span>
      ${sec.defs.map(d => `<p class="gws-def"><span class="gws-def-k mono">${d.k}</span> ${d.d}</p>`).join('')}
    </div>
    <div class="gws-match-terms"></div>
  </div>`);
  const termHost = wrap.querySelector('.gws-match-terms');
  sec.terms.forEach(t => {
    const qid = sec.id + ':' + t.n;
    const row = el(`<div class="gws-term cornerframe">
      <span class="gws-n mono">${t.n}</span>
      <span class="gws-term-name">${esc(t.term)}</span>
      <select class="gws-select" aria-label="match ${esc(t.term)}">
        <option value="">—</option>
        ${sec.defs.map(d => `<option value="${d.k}">${d.k}</option>`).join('')}
      </select>
      <span class="gws-verdict" hidden></span>
    </div>`);
    const sel = row.querySelector('.gws-select');
    const verdict = row.querySelector('.gws-verdict');
    const saved = gwsGet(qid);
    if (typeof saved === 'string' && saved) sel.value = saved;
    const judge = () => {
      if (!sel.value) { verdict.hidden = true; return; }
      const ok = sel.value === t.a;
      verdict.hidden = false;
      verdict.textContent = ok ? 'Correct' : 'Not quite';
      verdict.className = 'gws-verdict ' + (ok ? 'ok' : 'no');
    };
    sel.addEventListener('change', () => { gwsSet(qid, sel.value); judge(); bump(); });
    if (sel.value) judge();
    termHost.appendChild(row);
  });
  const rev = el('<button class="gws-revealbtn" data-reveal>Show all matches</button>');
  rev.addEventListener('click', () => {
    sec.terms.forEach((t, i) => {
      const sel = termHost.children[i].querySelector('.gws-select');
      sel.value = t.a; sel.dispatchEvent(new Event('change'));
    });
    rev.remove();
  });
  host.appendChild(wrap); host.appendChild(rev);
}

function gwsRenderDiagrams(host, sec, bump) {
  sec.diagrams.forEach(d => host.appendChild(gwsBuildDiagram(d, sec, bump)));
}

function gwsBuildDiagram(d, sec, bump) {
  const wrap = el(`<article class="gws-diag cornerframe">
    <span class="label">Q ${d.slots[0].n}–${d.slots[d.slots.length - 1].n}</span>
    <h3 class="gws-diag-title">${esc(d.title)}</h3>
    <p class="gws-diag-cap">${esc(d.caption)}</p>
    <div class="gws-diag-stage">
      <svg viewBox="0 0 ${d.W} ${d.H}" class="gws-svg" role="img" aria-label="${esc(d.title)}">${GWS_DEFS}${d.art()}</svg>
      <div class="gws-pins"></div>
    </div>
    <div class="gws-bank"><span class="gws-bank-lab">Word bank</span><div class="gws-bank-terms"></div></div>
    <div class="gws-diag-foot">
      <button class="gws-checkbtn" data-checkdiag>Check labels</button>
      <button class="gws-revealbtn inline" data-showans>Show answers</button>
      <button class="ghostbtn gws-clear" data-cleardiag>Clear</button>
      <span class="gws-verdict" hidden></span>
    </div>
  </article>`);

  const pinHost = wrap.querySelector('.gws-pins');
  const bankHost = wrap.querySelector('.gws-bank-terms');
  const verdict = wrap.querySelector('.gws-verdict');
  let selected = null;

  const qid = (s) => sec.id + ':' + d.id + ':' + s.n;

  // pins positioned in % over the stage
  d.slots.forEach(s => {
    const pin = el(`<button class="gws-pin" data-n="${s.n}" style="left:${(s.x / d.W) * 100}%;top:${(s.y / d.H) * 100}%">
      <span class="gws-pin-n mono">${s.n}</span><span class="gws-pin-lab"></span></button>`);
    pin.addEventListener('click', () => {
      if (pin.classList.contains('locked')) return;
      const cur = gwsGet(qid(s));
      if (cur) { // clicking a filled pin clears it back to the bank
        gwsSet(qid(s), '');
        pin.querySelector('.gws-pin-lab').textContent = '';
        pin.classList.remove('filled');
        syncBank(); bump(); return;
      }
      pinHost.querySelectorAll('.gws-pin').forEach(p => p.classList.remove('sel'));
      pin.classList.add('sel'); selected = s;
    });
    pinHost.appendChild(pin);
  });

  const terms = d.slots.map(s => s.answer).slice().sort((a, b) => a.localeCompare(b));
  function usedTerms() { return d.slots.map(s => gwsGet(qid(s))).filter(Boolean); }
  function syncBank() {
    const used = usedTerms();
    bankHost.querySelectorAll('.gws-bankterm').forEach(bt => {
      bt.classList.toggle('used', used.includes(bt.dataset.term));
    });
  }
  terms.forEach(t => {
    const bt = el(`<button class="gws-bankterm" data-term="${esc(t)}">${esc(t)}</button>`);
    bt.addEventListener('click', () => {
      if (bt.classList.contains('used')) return;
      if (!selected) { verdict.hidden = false; verdict.className = 'gws-verdict hint'; verdict.textContent = 'Pick a numbered pin first'; return; }
      verdict.hidden = true;
      gwsSet(qid(selected), t);
      const pin = pinHost.querySelector(`.gws-pin[data-n="${selected.n}"]`);
      pin.querySelector('.gws-pin-lab').textContent = t;
      pin.classList.add('filled'); pin.classList.remove('sel');
      selected = null; syncBank(); bump();
    });
    bankHost.appendChild(bt);
  });

  // restore saved labels
  d.slots.forEach(s => {
    const v = gwsGet(qid(s));
    if (v) {
      const pin = pinHost.querySelector(`.gws-pin[data-n="${s.n}"]`);
      pin.querySelector('.gws-pin-lab').textContent = v;
      pin.classList.add('filled');
    }
  });
  syncBank();

  wrap.querySelector('[data-checkdiag]').addEventListener('click', () => {
    let right = 0, filled = 0;
    d.slots.forEach(s => {
      const pin = pinHost.querySelector(`.gws-pin[data-n="${s.n}"]`);
      const v = gwsGet(qid(s));
      pin.classList.remove('ok', 'no');
      if (!v) return;
      filled++;
      if (v === s.answer) { pin.classList.add('ok'); right++; } else pin.classList.add('no');
    });
    verdict.hidden = false;
    verdict.className = 'gws-verdict ' + (right === d.slots.length ? 'ok' : 'no');
    verdict.textContent = `${right}/${d.slots.length} correct` + (filled < d.slots.length ? ` · ${d.slots.length - filled} unlabeled` : '');
  });
  wrap.querySelector('[data-showans]').addEventListener('click', (e) => {
    d.slots.forEach(s => {
      gwsSet(qid(s), s.answer);
      const pin = pinHost.querySelector(`.gws-pin[data-n="${s.n}"]`);
      pin.querySelector('.gws-pin-lab').textContent = s.answer;
      pin.classList.add('filled', 'ok', 'locked'); pin.classList.remove('no', 'sel');
    });
    syncBank(); bump();
    verdict.hidden = false; verdict.className = 'gws-verdict ok'; verdict.textContent = 'Answers shown';
    e.currentTarget.remove();
  });
  wrap.querySelector('[data-cleardiag]').addEventListener('click', () => {
    d.slots.forEach(s => {
      gwsSet(qid(s), '');
      const pin = pinHost.querySelector(`.gws-pin[data-n="${s.n}"]`);
      pin.querySelector('.gws-pin-lab').textContent = '';
      pin.classList.remove('filled', 'ok', 'no', 'sel', 'locked');
    });
    verdict.hidden = true; selected = null; syncBank(); bump();
  });
  return wrap;
}

function gwsRenderTables(host, sec, bump) {
  sec.tables.forEach(t => {
    const wrap = el(`<article class="gws-tablecard cornerframe">
      <h3 class="gws-diag-title">${esc(t.title)}</h3>
      <p class="gws-diag-cap">${t.prompt}</p>
      <div class="gws-tablescroll">
        <table class="gws-table">
          <thead><tr>${t.cols.map(c => `<th>${esc(c.h)}</th>`).join('')}</tr></thead>
          <tbody>
            ${t.rows.map((r, ri) => `<tr>${r.map((cell, ci) => t.cols[ci].blank
      ? `<td class="blank" data-r="${ri}" data-c="${ci}"></td>`
      : `<td class="given">${esc(cell)}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="gws-diag-foot">
        <button class="gws-checkbtn" data-checktable>Check table</button>
        <button class="gws-revealbtn inline" data-reveal>Show answers</button>
        <span class="gws-verdict" hidden></span>
      </div>
    </article>`);
    const verdict = wrap.querySelector('.gws-verdict');
    const qid = (ri, ci) => sec.id + ':' + t.id + ':' + ri + ':' + ci;

    wrap.querySelectorAll('td.blank').forEach(td => {
      const ri = +td.dataset.r, ci = +td.dataset.c;
      const sel = el(`<select class="gws-select" aria-label="${esc(t.cols[ci].h)} row ${ri + 1}">
        <option value="">—</option>
        ${t.cols[ci].opts.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
      </select>`);
      const saved = gwsGet(qid(ri, ci));
      if (typeof saved === 'string' && saved) sel.value = saved;
      sel.addEventListener('change', () => { gwsSet(qid(ri, ci), sel.value); td.classList.remove('ok', 'no'); verdict.hidden = true; bump(); });
      td.appendChild(sel);
    });

    wrap.querySelector('[data-checktable]').addEventListener('click', () => {
      let right = 0, tot = 0;
      wrap.querySelectorAll('td.blank').forEach(td => {
        const ri = +td.dataset.r, ci = +td.dataset.c;
        tot++;
        const v = td.querySelector('select').value;
        td.classList.remove('ok', 'no');
        if (!v) return;
        if (v === t.rows[ri][ci]) { td.classList.add('ok'); right++; } else td.classList.add('no');
      });
      verdict.hidden = false;
      verdict.className = 'gws-verdict ' + (right === tot ? 'ok' : 'no');
      verdict.textContent = `${right}/${tot} correct`;
    });
    wrap.querySelector('[data-reveal]').addEventListener('click', (e) => {
      wrap.querySelectorAll('td.blank').forEach(td => {
        const ri = +td.dataset.r, ci = +td.dataset.c;
        const sel = td.querySelector('select');
        sel.value = t.rows[ri][ci];
        gwsSet(qid(ri, ci), sel.value);
        td.classList.add('ok'); td.classList.remove('no');
      });
      bump();
      verdict.hidden = false; verdict.className = 'gws-verdict ok'; verdict.textContent = 'Answers shown';
      e.currentTarget.remove();
    });
    host.appendChild(wrap);
  });
}
