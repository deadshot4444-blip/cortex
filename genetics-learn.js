/* ============================================================================
   Genetics-2313-01E — LEARN MODE
   Socratic, guided lessons with interactive diagrams. Loaded after genetics.js;
   shares globals (el, esc, topbar, siteFooter, setView, GEN, genSave, genClearTimer,
   genTrack, startGenTopic). Teaching, not graded — separate from the box/competency system.
   ========================================================================= */

/* ---------------------------------------------------------------------------
   INTERACTIVE WIDGET 1 — base pairing (build the complementary strand)
   --------------------------------------------------------------------------- */
function glwBasePair(host, onDone) {
  const template = ['A', 'T', 'G', 'C', 'A', 'G'];
  const comp = { A: 'T', T: 'A', G: 'C', C: 'G' };
  const filled = new Array(template.length).fill(null);
  const wrap = el('<div class="glw-bp"></div>');
  const top = el('<div class="glw-bp-row"></div>');
  template.forEach(b => top.appendChild(el(`<span class="glw-base glw-b-${b}">${b}</span>`)));
  const rungs = el('<div class="glw-bp-rungs"></div>');
  template.forEach(() => rungs.appendChild(el('<span class="glw-rung"></span>')));
  const bot = el('<div class="glw-bp-row"></div>');
  const slots = template.map(() => { const s = el('<span class="glw-slot">?</span>'); bot.appendChild(s); return s; });
  const palette = el('<div class="glw-palette"></div>');
  ['A', 'T', 'G', 'C'].forEach(b => palette.appendChild(el(`<button type="button" class="glw-pbtn glw-b-${b}" data-b="${b}">${b}</button>`)));
  const msg = el('<p class="glw-msg">Click the base that pairs with the next open position on the template strand.</p>');
  wrap.append(top, rungs, bot, palette, msg);
  host.innerHTML = ''; host.appendChild(wrap);
  palette.querySelectorAll('.glw-pbtn').forEach(btn => btn.addEventListener('click', () => {
    const i = filled.indexOf(null); if (i < 0) return;
    const b = btn.dataset.b;
    if (b === comp[template[i]]) {
      filled[i] = b; slots[i].textContent = b; slots[i].className = 'glw-slot filled glw-b-' + b;
      rungs.children[i].classList.add('bonded', (template[i] + b === 'GC' || template[i] + b === 'CG') ? 'triple' : 'double');
      if (filled.every(Boolean)) { msg.className = 'glw-msg ok'; msg.innerHTML = '<b>Complete.</b> A–T pairs are held by 2 hydrogen bonds; G–C pairs by 3 — that extra bond makes G–C pairing stronger. Each strand fully specifies the other.'; onDone && onDone(); }
    } else {
      slots[i].classList.add('wrong'); msg.className = 'glw-msg err'; msg.textContent = `${b} doesn't pair with ${template[i]}. The rule is A↔T and G↔C.`;
      setTimeout(() => { slots[i].classList.remove('wrong'); }, 450);
    }
  }));
}

/* ---------------------------------------------------------------------------
   INTERACTIVE WIDGET 2 — replication fork (step through)
   --------------------------------------------------------------------------- */
function glwRepFork(host, onDone) {
  let step = 0;
  const CAPS = [
    'The double helix unwinds at the <b>replication fork</b>, exposing two single-stranded templates that run in opposite directions.',
    '<b>Helicase</b> (purple) breaks the base pairs; <b>single-strand-binding proteins</b> (dots) keep the templates from snapping back together.',
    'On the template that runs 3′→5′ into the fork, the new <b>leading strand</b> is built continuously, chasing the fork.',
    'The other template runs the wrong way. Its new <b>lagging strand</b> is built in short <b>Okazaki fragments</b> pointing away from the fork, each started by a primer (green).',
    '<b>DNA ligase</b> seals the Okazaki fragments into one continuous strand. Both new strands grew only 5′→3′.',
  ];
  const armTop = t => [120 + 180 * t, 100 - 46 * t];
  const armBot = t => [120 + 180 * t, 100 + 46 * t];
  function svg() {
    let s = `<svg viewBox="0 0 320 200" class="glw-svg" role="img" aria-label="replication fork">`;
    // parental duplex
    s += `<line x1="8" y1="96" x2="120" y2="100" class="glw-temp"/><line x1="8" y1="104" x2="120" y2="100" class="glw-temp"/>`;
    s += `<text x="10" y="86" class="glw-cap2">parental DNA</text>`;
    // splayed templates
    const [tx, ty] = armTop(1), [bx, by] = armBot(1);
    s += `<line x1="120" y1="100" x2="${tx}" y2="${ty}" class="glw-temp"/><line x1="120" y1="100" x2="${bx}" y2="${by}" class="glw-temp"/>`;
    s += `<text x="${tx - 6}" y="${ty - 6}" class="glw-cap2" text-anchor="end">3′</text><text x="${bx - 6}" y="${by + 14}" class="glw-cap2" text-anchor="end">5′</text>`;
    if (step >= 1) {
      // SSB dots
      for (let t = 0.35; t < 1; t += 0.22) { const [x, y] = armTop(t); s += `<circle cx="${x}" cy="${y}" r="3.5" class="glw-ssb"/>`; }
      for (let t = 0.35; t < 1; t += 0.22) { const [x, y] = armBot(t); s += `<circle cx="${x}" cy="${y}" r="3.5" class="glw-ssb"/>`; }
      // helicase
      s += `<circle cx="120" cy="100" r="13" class="glw-helicase"/><text x="120" y="103" class="glw-enz">H</text>`;
    }
    if (step >= 2) {
      // leading strand along bottom template, arrow toward fork
      const [x1, y1] = armBot(0.95), [x2, y2] = armBot(0.18);
      s += `<line x1="${x1}" y1="${y1 + 5}" x2="${x2}" y2="${y2 + 5}" class="glw-new" marker-end="url(#glwarr)"/>`;
      const [lx, ly] = armBot(0.62); s += `<text x="${lx}" y="${ly + 20}" class="glw-cap2" text-anchor="middle">leading (continuous)</text>`;
    }
    if (step >= 3) {
      // lagging Okazaki fragments along top template, arrows away from fork
      const segs = [[0.22, 0.45], [0.5, 0.72], [0.77, 0.97]];
      segs.forEach(([a, b]) => {
        const [x1, y1] = armTop(a), [x2, y2] = armTop(b);
        s += `<line x1="${x1}" y1="${y1 - 5}" x2="${x2}" y2="${y2 - 5}" class="glw-new${step >= 4 ? ' joined' : ''}" marker-end="url(#glwarr)"/>`;
        s += `<circle cx="${x1}" cy="${y1 - 5}" r="3" class="glw-primer"/>`;
      });
      const [lx, ly] = armTop(0.6); s += `<text x="${lx}" y="${ly - 14}" class="glw-cap2" text-anchor="middle">lagging (Okazaki fragments)</text>`;
    }
    s += `<defs><marker id="glwarr" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" class="glw-arrh"/></marker></defs></svg>`;
    return s;
  }
  function render() {
    host.innerHTML = '';
    host.appendChild(el(`<div class="glw-step">${svg()}<p class="glw-cap">${CAPS[step]}</p>` +
      `<div class="glw-nav"><span class="glw-dots">${CAPS.map((_, i) => `<span class="${i === step ? 'on' : ''}"></span>`).join('')}</span>` +
      `<button type="button" class="btn btn-solid glw-next">${step < CAPS.length - 1 ? 'Next step ▸' : 'Replay'}</button></div></div>`));
    host.querySelector('.glw-next').addEventListener('click', () => {
      if (step < CAPS.length - 1) { step++; if (step === CAPS.length - 1) onDone && onDone(); } else { step = 0; }
      render();
    });
  }
  render();
}

/* ---------------------------------------------------------------------------
   INTERACTIVE WIDGET 3 — Meselson–Stahl density gradient (step through)
   --------------------------------------------------------------------------- */
function glwMeselson(host, onDone) {
  let gen = 0;
  const Y = { heavy: 158, hybrid: 112, light: 66 };
  const CAPS = [
    'Generation 0: every cell was grown on heavy <sup>15</sup>N, so all DNA is heavy and forms one low band.',
    'After 1 round on light <sup>14</sup>N: a single band of <b>intermediate</b> density (one heavy strand + one light strand). A conservative copy would have given a separate heavy and light band — so conservative is ruled out.',
    'After 2 rounds: an intermediate band <b>and</b> a light band. Exactly what <b>semiconservative</b> replication predicts — and dispersive (one creeping band) is ruled out.',
  ];
  const bands = [['heavy'], ['hybrid'], ['hybrid', 'light']];
  function svg() {
    let s = `<svg viewBox="0 0 220 200" class="glw-svg" role="img" aria-label="density gradient tube">`;
    s += `<text x="70" y="16" class="glw-cap2" text-anchor="middle">Generation ${gen}</text>`;
    s += `<rect x="42" y="22" width="56" height="166" rx="14" class="glw-tube"/>`;
    bands[gen].forEach(b => { s += `<rect x="46" y="${Y[b] - 5}" width="48" height="10" rx="3" class="glw-band glw-band-${b}"/>`; });
    // reference labels
    s += `<text x="150" y="${Y.light + 4}" class="glw-cap2">light (¹⁴N)</text>`;
    s += `<text x="150" y="${Y.hybrid + 4}" class="glw-cap2">hybrid</text>`;
    s += `<text x="150" y="${Y.heavy + 4}" class="glw-cap2">heavy (¹⁵N)</text>`;
    s += `<line x1="104" y1="${Y.light}" x2="146" y2="${Y.light}" class="glw-ref"/><line x1="104" y1="${Y.hybrid}" x2="146" y2="${Y.hybrid}" class="glw-ref"/><line x1="104" y1="${Y.heavy}" x2="146" y2="${Y.heavy}" class="glw-ref"/>`;
    s += `</svg>`;
    return s;
  }
  function render() {
    host.innerHTML = '';
    host.appendChild(el(`<div class="glw-step">${svg()}<p class="glw-cap">${CAPS[gen]}</p>` +
      `<div class="glw-nav"><span class="glw-dots">${CAPS.map((_, i) => `<span class="${i === gen ? 'on' : ''}"></span>`).join('')}</span>` +
      `<button type="button" class="btn btn-solid glw-next">${gen < CAPS.length - 1 ? 'Next round ▸' : 'Replay'}</button></div></div>`));
    host.querySelector('.glw-next').addEventListener('click', () => {
      if (gen < CAPS.length - 1) { gen++; if (gen === CAPS.length - 1) onDone && onDone(); } else { gen = 0; }
      render();
    });
  }
  render();
}

/* ---------------------------------------------------------------------------
   INTERACTIVE WIDGET 4 — label the helix (click the right part)
   --------------------------------------------------------------------------- */
function glwHelixLabel(host, onDone) {
  const targets = [
    { role: 'backbone', label: 'a sugar–phosphate backbone' },
    { role: 'pair', label: 'a base pair (a rung)' },
    { role: '5end', label: 'the 5′ end of a strand' },
    { role: '3end', label: 'the 3′ end of a strand' },
  ];
  let ti = 0;
  function svg() {
    let s = `<svg viewBox="0 0 220 240" class="glw-svg glw-clickable" role="img" aria-label="DNA ladder">`;
    // backbones (left strand 5'top->3'bottom ; right strand antiparallel 3'top->5'bottom)
    s += `<line x1="74" y1="34" x2="74" y2="206" class="glw-hl-bb" data-role="backbone"/>`;
    s += `<line x1="146" y1="34" x2="146" y2="206" class="glw-hl-bb" data-role="backbone"/>`;
    // rungs
    [54, 84, 114, 144, 174].forEach(y => { s += `<line x1="78" y1="${y}" x2="142" y2="${y}" class="glw-hl-rung" data-role="pair"/>`; });
    // end caps (clickable): left top = 5', left bottom = 3'; right top = 3', right bottom = 5'
    s += `<circle cx="74" cy="34" r="9" class="glw-hl-end" data-role="5end"/><text x="74" y="22" class="glw-cap2" text-anchor="middle">5′</text>`;
    s += `<circle cx="74" cy="206" r="9" class="glw-hl-end" data-role="3end"/><text x="74" y="228" class="glw-cap2" text-anchor="middle">3′</text>`;
    s += `<circle cx="146" cy="34" r="9" class="glw-hl-end" data-role="3end"/><text x="146" y="22" class="glw-cap2" text-anchor="middle">3′</text>`;
    s += `<circle cx="146" cy="206" r="9" class="glw-hl-end" data-role="5end"/><text x="146" y="228" class="glw-cap2" text-anchor="middle">5′</text>`;
    s += `</svg>`;
    return s;
  }
  function render(done) {
    host.innerHTML = '';
    const prompt = done ? '<b>Nice — you labeled them all.</b> The backbones run antiparallel: where one strand reads 5′→3′ downward, its partner reads 3′→5′.' : `Click <b>${targets[ti].label}</b>.`;
    const box = el(`<div class="glw-step">${svg()}<p class="glw-cap glw-hl-prompt">${prompt}</p></div>`);
    host.appendChild(box);
    if (done) return;
    box.querySelectorAll('[data-role]').forEach(elm => elm.addEventListener('click', () => {
      if (elm.dataset.role === targets[ti].role) {
        elm.classList.add('hit'); ti++;
        if (ti >= targets.length) { onDone && onDone(); render(true); }
        else render(false);
      } else {
        elm.classList.add('miss'); setTimeout(() => elm.classList.remove('miss'), 400);
      }
    }));
  }
  render(false);
}

const GLW = { basepair: glwBasePair, repfork: glwRepFork, meselson: glwMeselson, helixlabel: glwHelixLabel };

/* ---------------------------------------------------------------------------
   LESSONS
   --------------------------------------------------------------------------- */
const GEN_LESSONS = [
  {
    id: 'l-helix', chapter: 8, topic: 'ch8-structure', title: 'The Double Helix',
    blurb: 'Build DNA from a single nucleotide up to the antiparallel double helix.',
    steps: [
      { kind: 'teach', body: 'Every living thing stores its instructions in DNA. Let’s build it from the ground up. The repeating unit is the <b>nucleotide</b> — three parts: a five-carbon <b>sugar</b>, a <b>phosphate</b> group, and a nitrogenous <b>base</b>.' },
      { kind: 'ask', prompt: 'DNA and RNA differ by a single atom on their sugar: RNA’s ribose has an –OH at the 2′ carbon, while DNA’s deoxyribose has only –H there. Which would you expect to be the more stable, longer-lived molecule — and why would that matter for an organism’s genetic archive?', reveal: '<b>DNA.</b> That missing oxygen makes deoxyribose less chemically reactive, so DNA resists breakdown — ideal for long-term storage. RNA’s extra –OH makes it more reactive and shorter-lived.' },
      { kind: 'teach', body: 'There are four bases. Two <b>purines</b> (A and G — a fused double ring) and two <b>pyrimidines</b> (C and T — a single ring). They join the two strands by hydrogen bonds, and the pairing is picky. Try it:' },
      { kind: 'interactive', widget: 'basepair', instructions: 'Build the complementary strand — click the base that pairs with each one on the template.' },
      { kind: 'teach', body: 'The rule: <b>A pairs with T</b> (2 hydrogen bonds) and <b>G pairs with C</b> (3 hydrogen bonds). This is exactly why Chargaff measured %A = %T and %G = %C. And because each base has just one partner, <b>each strand carries all the information needed to rebuild the other</b> — the secret to copying DNA.' },
      { kind: 'ask', prompt: 'The two strands run in opposite directions — one oriented 5′→3′, the other 3′→5′. What do we call that arrangement?', choices: ['Antiparallel', 'Parallel', 'Perpendicular', 'Identical'], answer: 0, reveal: '<b>Antiparallel.</b> One strand’s 5′ end sits across from the other’s 3′ end. Antiparallel strands + complementary base pairing are the heart of the Watson–Crick model.' },
      { kind: 'interactive', widget: 'helixlabel', instructions: 'Now name the parts. Click the part of the ladder that matches each prompt.' },
      { kind: 'checkpoint', q: 'Which is a valid base pair AND the more stable of the two pairings?', options: ['G with C, held by 3 hydrogen bonds', 'A with T, held by 3 hydrogen bonds', 'G with T, held by 2 hydrogen bonds', 'A with C, held by 2 hydrogen bonds'], answer: 0, explain: 'G pairs with C through three hydrogen bonds — one more than the two in an A–T pair — so G–C is the more stable pairing. G–T and A–C are not valid Watson–Crick pairs, and A–T has two bonds, not three.' },
    ],
  },
  {
    id: 'l-replication', chapter: 9, topic: 'ch9-mechanism', title: 'How DNA Copies Itself',
    blurb: 'From the classic Meselson–Stahl experiment to the moving replication fork.',
    steps: [
      { kind: 'teach', body: 'When a cell divides it must copy <b>all</b> of its DNA. Watson and Crick’s model hinted at how: unzip the two strands, and let each act as a <b>template</b> for a new partner strand. But is that really what happens?' },
      { kind: 'ask', prompt: 'Suppose each daughter molecule ends up with one <i>old</i> strand and one brand-<i>new</i> strand. What would we call that style of replication?', choices: ['Semiconservative', 'Conservative', 'Dispersive', 'Bidirectional'], answer: 0, reveal: '<b>Semiconservative</b> — each daughter molecule conserves half (one strand) of the parent. Two rivals were also on the table: <b>conservative</b> (parent stays whole, a fully new copy is made) and <b>dispersive</b> (strands chopped and patched together).' },
      { kind: 'interactive', widget: 'meselson', instructions: 'Meselson and Stahl settled it using heavy (¹⁵N) and light (¹⁴N) DNA. Step through the generations and watch where the bands land.' },
      { kind: 'teach', body: 'One <b>intermediate</b> band after round 1 eliminated the conservative model. <b>Two</b> bands after round 2 — one intermediate, one light — matched <b>only</b> semiconservative replication.' },
      { kind: 'teach', body: 'Now zoom into the copying machine. DNA polymerase can only add bases to a free <b>3′ end</b>, so it builds strictly <b>5′→3′</b>. But the two templates are antiparallel… so how can both be copied at the same moving fork?' },
      { kind: 'interactive', widget: 'repfork', instructions: 'Step through a single replication fork and watch how the cell solves the antiparallel problem.' },
      { kind: 'ask', prompt: 'One new strand is built smoothly toward the fork; the other is built in short, backward pieces. Why can’t both simply be made continuously?', reveal: 'Because the templates point opposite ways. Only the strand whose template runs 3′→5′ <i>into</i> the fork can be built continuously — the <b>leading strand</b>. The other template is exposed the “wrong” way, so its new strand (the <b>lagging strand</b>) must be made in short <b>Okazaki fragments</b>, each restarted with a fresh primer and later stitched together by ligase.' },
      { kind: 'checkpoint', q: 'At a replication fork, the lagging strand is synthesized…', options: ['Discontinuously, in Okazaki fragments pointing away from the fork', 'Continuously, straight toward the fork', 'In the 3′→5′ direction', 'Without needing any primer'], answer: 0, explain: 'The lagging-strand template runs the opposite way, so its new strand is built in short Okazaki fragments that point away from the fork, each requiring its own RNA primer. Synthesis is always 5′→3′ (never 3′→5′), and a primer is always needed to start.' },
    ],
  },
  {
    id: 'l-discovery', chapter: 8, topic: 'ch8-discovery', title: 'How We Learned DNA Is the Gene',
    blurb: 'Reason through the three experiments that overturned “genes are protein.”',
    steps: [
      { kind: 'teach', body: 'For decades, most scientists bet that genes were made of <b>protein</b>, not DNA. Proteins had 20 different building blocks; DNA seemed boringly repetitive. Three experiments overturned that bet.' },
      { kind: 'teach', body: '<b>1928 — Griffith.</b> Harmless live <b>R</b> bacteria, mixed with heat-killed deadly <b>S</b> bacteria, were injected into mice. Each component on its own was harmless.' },
      { kind: 'ask', prompt: 'The mice died — and living S bacteria were recovered from them. What must have happened?', choices: ['Something from the dead S cells genetically transformed the live R cells', 'The heat-killed S cells came back to life', 'The R cells happened to mutate into S by chance', 'The mouse’s own cells became infectious'], answer: 0, reveal: 'A “<b>transforming principle</b>” passed from the dead S cells into the living R cells and permanently, heritably changed them. But <i>what molecule</i> was it?' },
      { kind: 'ask', prompt: 'Griffith’s extract contained DNA, protein, RNA, and more. How would <i>you</i> design an experiment to pin down which molecule is the transforming principle?', reveal: 'Avery, MacLeod & McCarty’s elegant idea: destroy <b>one</b> type of molecule at a time and see which destroys the transforming activity. They treated the extract with <b>protease</b> (kills protein), <b>RNase</b> (kills RNA), or <b>DNase</b> (kills DNA).' },
      { kind: 'ask', prompt: 'Only one of those treatments abolished transformation. Which result points to the genetic material?', choices: ['DNase destroyed it → the transforming principle is DNA', 'Protease destroyed it → it is protein', 'RNase destroyed it → it is RNA', 'None of the treatments destroyed it'], answer: 0, reveal: 'Only <b>DNase</b> abolished the activity → the transforming principle is <b>DNA</b>. Yet many scientists still clung to the protein hypothesis…' },
      { kind: 'teach', body: '<b>1952 — Hershey & Chase.</b> A T2 bacteriophage is essentially just DNA packed inside a protein coat. They tagged the <b>DNA with radioactive ³²P</b> and the <b>protein with ³⁵S</b>, let the phages infect bacteria, then blended off the empty coats.' },
      { kind: 'ask', prompt: 'Inside the infected cells — and in the next generation of phages — the radioactivity was ³²P, not ³⁵S. What does that tell you?', choices: ['DNA enters the cell and is passed to progeny → DNA is the genetic material', 'Protein enters the cell → protein is the genetic material', 'Both entered the cell equally', 'Neither molecule entered the cell'], answer: 0, reveal: 'Only the <b>DNA</b> (³²P) went in and reappeared in the next generation. Together with Avery’s result, this finally convinced the field: <b>genes are made of DNA</b>.' },
      { kind: 'checkpoint', q: 'Why did Hershey and Chase choose ³²P and ³⁵S specifically?', options: ['DNA has phosphorus but no sulfur; protein has sulfur but no phosphorus', 'Both molecules contain equal amounts of both elements', 'Phosphorus labels protein and sulfur labels DNA', 'The isotopes convert DNA into protein'], answer: 0, explain: 'DNA contains phosphorus (in its sugar-phosphate backbone) but essentially no sulfur, while protein contains sulfur (in some amino acids) but no phosphorus. So ³²P traces DNA and ³⁵S traces protein independently — the labels only mark molecules, they don’t convert one into another.' },
    ],
  },
];

/* ---------------------------------------------------------------------------
   PROGRESS
   --------------------------------------------------------------------------- */
function glDone(id) { return !!(GEN.learned && GEN.learned[id]); }
function glMark(id) { if (!GEN.learned) GEN.learned = {}; GEN.learned[id] = 1; genSave(); }

/* ---------------------------------------------------------------------------
   LEARN HOME
   --------------------------------------------------------------------------- */
function renderGenLearnHome() {
  genClearTimer();
  genTrack('learn_home', {});
  const byCh = {};
  GEN_LESSONS.forEach(l => { (byCh[l.chapter] = byCh[l.chapter] || []).push(l); });
  const chBlock = (ch) => `<section class="gen-learn-ch">
      <span class="label">Chapter ${ch} · ${(typeof GEN_CH !== 'undefined' && GEN_CH[ch]) || ''}</span>
      <div class="gen-learn-grid">
        ${byCh[ch].map(l => `<button class="gen-learn-card cornerframe ${glDone(l.id) ? 'done' : ''}" data-lesson="${l.id}">
          ${glDone(l.id) ? '<span class="gen-learn-check">✓ learned</span>' : '<span class="gen-learn-go2">lesson</span>'}
          <h2>${esc(l.title)}</h2>
          <p>${esc(l.blurb)}</p>
          <span class="gen-learn-meta mono">${l.steps.length} steps · interactive</span>
        </button>`).join('')}
      </div>
    </section>`;
  const root = el('<div></div>');
  root.appendChild(topbar('genetics'));
  const main = el(`<main class="panel gen-learn-home" id="main" tabindex="-1">
    <div class="gen-pick-head"><button class="ghostbtn" id="gen-back">← Home</button><h1>Learn</h1></div>
    <p class="gen-learn-intro">Short, guided lessons that <b>teach</b> the concept the Socratic way — a question, your reasoning, then the idea — with interactive diagrams you build and step through. When a lesson clicks, jump to the drills to lock it in.</p>
    ${Object.keys(byCh).sort().map(chBlock).join('')}
  </main>`);
  main.querySelector('#gen-back').addEventListener('click', renderGenHome);
  main.querySelectorAll('[data-lesson]').forEach(b => b.addEventListener('click', () => renderGenLesson(b.dataset.lesson)));
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

/* ---------------------------------------------------------------------------
   LESSON PLAYER
   --------------------------------------------------------------------------- */
function renderGenLesson(id) {
  genClearTimer();
  const lesson = GEN_LESSONS.find(l => l.id === id);
  if (!lesson) { renderGenLearnHome(); return; }
  genTrack('learn_start', { lesson: id });
  let idx = 0;

  function frame(inner, opts) {
    opts = opts || {};
    const root = el('<div></div>');
    root.appendChild(topbar('genetics'));
    const pct = Math.round((idx) / lesson.steps.length * 100);
    const main = el(`<main class="panel gen-lesson" id="main" tabindex="-1">
      <div class="gen-lesson-top">
        <button class="ghostbtn" id="gen-exit">← Lessons</button>
        <span class="gen-lesson-title">${esc(lesson.title)}</span>
        <span class="mono gen-lesson-count">${Math.min(idx + 1, lesson.steps.length)}/${lesson.steps.length}</span>
      </div>
      <div class="gen-lesson-bar"><span style="width:${pct}%"></span></div>
      <div class="gen-lesson-body" id="lesson-body"></div>
      <div class="gen-lesson-nav">
        <button class="btn" id="lesson-back" ${idx === 0 ? 'disabled' : ''}>Back</button>
        <button class="btn btn-solid" id="lesson-next" ${opts.gate ? 'disabled' : ''}>${opts.nextLabel || 'Next'}</button>
      </div>
    </main>`);
    main.querySelector('#lesson-body').appendChild(inner);
    main.querySelector('#gen-exit').addEventListener('click', renderGenLearnHome);
    main.querySelector('#lesson-back').addEventListener('click', () => { if (idx > 0) { idx--; show(); } });
    const nextBtn = main.querySelector('#lesson-next');
    nextBtn.addEventListener('click', () => {
      if (idx < lesson.steps.length - 1) { idx++; show(); }
      else { glMark(lesson.id); genTrack('learn_done', { lesson: lesson.id }); finish(); }
    });
    const root2 = el('<div></div>'); // placeholder (unused)
    root.appendChild(main); root.appendChild(siteFooter()); setView(root);
    return { ungate: () => { nextBtn.disabled = false; } };
  }

  function show() {
    const step = lesson.steps[idx];
    const last = idx === lesson.steps.length - 1;
    const nextLabel = last ? 'Finish ✓' : 'Next ▸';

    if (step.kind === 'teach') {
      frame(el(`<div class="gen-step gen-step-teach"><p>${step.body}</p></div>`), { nextLabel });

    } else if (step.kind === 'ask') {
      const box = el(`<div class="gen-step gen-step-ask">
        <span class="gen-step-kind">Think it through</span>
        <p class="gen-ask-prompt">${step.prompt}</p>
        <div class="gen-ask-body"></div>
      </div>`);
      const body = box.querySelector('.gen-ask-body');
      const handle = frame(box, { nextLabel });
      if (Array.isArray(step.choices)) {
        const opts = el('<div class="gen-ask-choices"></div>');
        step.choices.forEach((c, i) => opts.appendChild(el(`<button type="button" class="gen-ask-choice" data-i="${i}">${esc(c)}</button>`)));
        body.appendChild(opts);
        const reveal = el(`<div class="gen-ask-reveal" hidden><p>${step.reveal}</p></div>`);
        body.appendChild(reveal);
        opts.querySelectorAll('.gen-ask-choice').forEach(btn => btn.addEventListener('click', () => {
          if (opts.dataset.locked) return; opts.dataset.locked = '1';
          const pick = +btn.dataset.i;
          opts.querySelectorAll('.gen-ask-choice').forEach((b, i) => { b.disabled = true; if (i === step.answer) b.classList.add('correct'); else if (i === pick) b.classList.add('wrong'); });
          reveal.hidden = false;
        }));
      } else {
        const btn = el('<button type="button" class="btn gen-ask-show">Show me ▾</button>');
        const reveal = el(`<div class="gen-ask-reveal" hidden><p>${step.reveal}</p></div>`);
        body.append(btn, reveal);
        btn.addEventListener('click', () => { reveal.hidden = false; btn.hidden = true; });
      }

    } else if (step.kind === 'interactive') {
      const box = el(`<div class="gen-step gen-step-interactive">
        <p class="gen-inter-instr">${esc(step.instructions)}</p>
        <div class="gen-inter-host"></div>
        <p class="gen-inter-done" hidden>✓ nice work</p>
      </div>`);
      const handle = frame(box, { nextLabel });
      const host = box.querySelector('.gen-inter-host');
      const doneMsg = box.querySelector('.gen-inter-done');
      const widget = GLW[step.widget];
      if (widget) widget(host, () => { doneMsg.hidden = false; });
      else host.appendChild(el('<p class="gen-inter-instr">[missing widget]</p>'));

    } else if (step.kind === 'checkpoint') {
      const box = el(`<div class="gen-step gen-step-check">
        <span class="gen-step-kind">Quick check</span>
        <p class="gen-check-q">${esc(step.q)}</p>
        <div class="gen-check-opts"></div>
        <div class="gen-check-fb" hidden></div>
      </div>`);
      const handle = frame(box, { gate: true, nextLabel });
      const opts = box.querySelector('.gen-check-opts');
      const fb = box.querySelector('.gen-check-fb');
      step.options.forEach((o, i) => opts.appendChild(el(`<button type="button" class="gen-check-opt" data-i="${i}">${esc(o)}</button>`)));
      opts.querySelectorAll('.gen-check-opt').forEach(btn => btn.addEventListener('click', () => {
        if (opts.dataset.locked) return; opts.dataset.locked = '1';
        const pick = +btn.dataset.i;
        opts.querySelectorAll('.gen-check-opt').forEach((b, i) => { b.disabled = true; if (i === step.answer) b.classList.add('correct'); else if (i === pick) b.classList.add('wrong'); });
        fb.hidden = false; fb.className = 'gen-check-fb ' + (pick === step.answer ? 'right' : 'wrong');
        fb.innerHTML = `<b>${pick === step.answer ? 'Correct.' : 'Not quite.'}</b> ${esc(step.explain)}`;
        handle.ungate();
      }));
    }
  }

  function finish() {
    genClearTimer();
    const root = el('<div></div>');
    root.appendChild(topbar('genetics'));
    const main = el(`<main class="panel gen-result" id="main" tabindex="-1">
      <div class="gen-res-box cornerframe">
        <span class="label">Lesson complete</span>
        <h1 class="gen-res-sub">${esc(lesson.title)}</h1>
        <p class="gen-empty-msg">You’ve got the concept — now lock it in with a few drills on this topic.</p>
        <div class="gen-res-btns">
          <button class="btn btn-solid" id="l-drill">Drill this topic ▸</button>
          <button class="btn" id="l-more">More lessons</button>
          <button class="btn" id="l-home">Home</button>
        </div>
      </div>
    </main>`);
    main.querySelector('#l-drill').addEventListener('click', () => { if (typeof startGenTopic === 'function') startGenTopic(lesson.topic); else renderGenHome(); });
    main.querySelector('#l-more').addEventListener('click', renderGenLearnHome);
    main.querySelector('#l-home').addEventListener('click', renderGenHome);
    root.appendChild(main); root.appendChild(siteFooter()); setView(root);
  }

  show();
}
