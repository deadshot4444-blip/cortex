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

/* ---------------------------------------------------------------------------
   INTERACTIVE WIDGET 5 — CRISPR-Cas (step through the three stages)
   --------------------------------------------------------------------------- */
function glwCrispr(host, onDone) {
  let step = 0;
  const CAPS = [
    '<b>Adaptation.</b> A virus injects its DNA. Cas proteins snip out a fragment and file it into the <b>CRISPR array</b> as a new <b>spacer</b> — a genetic memory of the invader.',
    '<b>Expression.</b> The array is transcribed and chopped into short <b>crRNAs</b>; each crRNA loads onto a Cas protein to make a patrol complex.',
    '<b>Interference.</b> If that virus returns, the crRNA base-pairs with the matching viral DNA (next to a <b>PAM</b>) and Cas cuts it. The PAM sits on the invader but is absent from the array, so the cell never cuts its own memory.',
  ];
  const ay = 112;
  function rep(x) { return `<rect x="${x}" y="${ay - 6}" width="12" height="12" transform="rotate(45 ${x + 6} ${ay})" class="glw-cr-rep"/>`; }
  function spac(x, c) { return `<rect x="${x}" y="${ay - 7}" width="22" height="14" rx="2" class="glw-cr-sp glw-cr-${c}"/>`; }
  function svg() {
    let s = `<svg viewBox="0 0 320 190" class="glw-svg" role="img" aria-label="CRISPR-Cas system">`;
    s += `<line x1="20" y1="${ay}" x2="236" y2="${ay}" class="glw-temp"/>`;
    let x = 22; const sp = ['a', 'b', 'c'];
    for (let i = 0; i < 3; i++) { s += rep(x); x += 16; s += spac(x, sp[i]); x += 26; }
    s += rep(x);
    s += `<text x="22" y="${ay + 24}" class="glw-cap2">CRISPR array (repeats ◆ + spacers)</text>`;
    if (step === 0) {
      s += `<line x1="120" y1="38" x2="226" y2="38" class="glw-cr-foreign"/><text x="120" y="30" class="glw-cap2">viral DNA</text>`;
      s += `<path d="M205 46 L${x + 32} ${ay - 14}" class="glw-cr-arrow" marker-end="url(#glwa2)"/>`;
      x += 16; s += spac(x, 'new'); s += `<text x="${x + 11}" y="${ay - 13}" class="glw-cap2" text-anchor="middle">new</text>`;
    } else if (step === 1) {
      const c = ['a', 'b', 'c'];
      for (let i = 0; i < 3; i++) { const cx = 86 + i * 64; s += `<rect x="${cx}" y="150" width="22" height="12" rx="2" class="glw-cr-sp glw-cr-${c[i]}"/>`; }
      s += `<circle cx="108" cy="156" r="13" class="glw-cr-cas"/><text x="108" y="160" class="glw-enz">Cas</text>`;
      s += `<text x="186" y="178" class="glw-cap2" text-anchor="middle">crRNAs guide Cas</text>`;
    } else if (step === 2) {
      s += `<line x1="64" y1="44" x2="252" y2="44" class="glw-cr-foreign"/>`;
      s += `<rect x="148" y="54" width="22" height="11" rx="2" class="glw-cr-sp glw-cr-a"/>`;
      s += `<circle cx="159" cy="44" r="14" class="glw-cr-cas"/><text x="159" y="48" class="glw-enz">Cas</text>`;
      s += `<circle cx="206" cy="44" r="3.5" class="glw-cr-pam"/><text x="206" y="34" class="glw-cap2" text-anchor="middle">PAM</text>`;
      s += `<path d="M153 32 L165 56 M165 32 L153 56" class="glw-cr-cut"/>`;
    }
    s += `<defs><marker id="glwa2" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" class="glw-arrh"/></marker></defs></svg>`;
    return s;
  }
  function render() {
    host.innerHTML = '';
    host.appendChild(el(`<div class="glw-step">${svg()}<p class="glw-cap">${CAPS[step]}</p>` +
      `<div class="glw-nav"><span class="glw-dots">${CAPS.map((_, i) => `<span class="${i === step ? 'on' : ''}"></span>`).join('')}</span>` +
      `<button type="button" class="btn btn-solid glw-next">${step < CAPS.length - 1 ? 'Next stage ▸' : 'Replay'}</button></div></div>`));
    host.querySelector('.glw-next').addEventListener('click', () => {
      if (step < CAPS.length - 1) { step++; if (step === CAPS.length - 1) onDone && onDone(); } else { step = 0; }
      render();
    });
  }
  render();
}

const GLW = { basepair: glwBasePair, repfork: glwRepFork, meselson: glwMeselson, helixlabel: glwHelixLabel, crispr: glwCrispr };

/* ---------------------------------------------------------------------------
   LESSONS
   --------------------------------------------------------------------------- */
const GEN_LESSONS = [
  {
    "id": "l-helix",
    "chapter": 8,
    "topic": "ch8-structure",
    "title": "The Double Helix",
    "blurb": "Build DNA from a single nucleotide up to the antiparallel double helix.",
    "steps": [
      {
        "kind": "teach",
        "body": "Every living thing stores its instructions in DNA. Let’s build it from the ground up. The repeating unit is the <b>nucleotide</b> — three parts: a five-carbon <b>sugar</b>, a <b>phosphate</b> group, and a nitrogenous <b>base</b>."
      },
      {
        "kind": "ask",
        "prompt": "DNA and RNA differ by a single atom on their sugar: RNA’s ribose has an –OH at the 2′ carbon, while DNA’s deoxyribose has only –H there. Which would you expect to be the more stable, longer-lived molecule — and why would that matter for an organism’s genetic archive?",
        "reveal": "<b>DNA.</b> That missing oxygen makes deoxyribose less chemically reactive, so DNA resists breakdown — ideal for long-term storage. RNA’s extra –OH makes it more reactive and shorter-lived."
      },
      {
        "kind": "teach",
        "body": "There are four bases. Two <b>purines</b> (A and G — a fused double ring) and two <b>pyrimidines</b> (C and T — a single ring). They join the two strands by hydrogen bonds, and the pairing is picky. Try it:"
      },
      {
        "kind": "interactive",
        "widget": "basepair",
        "instructions": "Build the complementary strand — click the base that pairs with each one on the template."
      },
      {
        "kind": "teach",
        "body": "The rule: <b>A pairs with T</b> (2 hydrogen bonds) and <b>G pairs with C</b> (3 hydrogen bonds). This is exactly why Chargaff measured %A = %T and %G = %C. And because each base has just one partner, <b>each strand carries all the information needed to rebuild the other</b> — the secret to copying DNA."
      },
      {
        "kind": "ask",
        "prompt": "The two strands run in opposite directions — one oriented 5′→3′, the other 3′→5′. What do we call that arrangement?",
        "choices": [
          "Convergent",
          "Perpendicular",
          "Antiparallel",
          "Sidewinding"
        ],
        "answer": 2,
        "reveal": "<b>Antiparallel.</b> One strand’s 5′ end sits across from the other’s 3′ end. Antiparallel strands + complementary base pairing are the heart of the Watson–Crick model."
      },
      {
        "kind": "interactive",
        "widget": "helixlabel",
        "instructions": "Now name the parts. Click the part of the ladder that matches each prompt."
      },
      {
        "kind": "checkpoint",
        "q": "Which is a valid base pair AND the more stable of the two pairings?",
        "options": [
          "A with T, joined by three hydrogen bonds",
          "A with C, a mismatch of two hydrogen bonds",
          "G with T, a wobble pair of two hydrogen bonds",
          "G with C, joined by three hydrogen bonds"
        ],
        "answer": 3,
        "explain": "G pairs with C through three hydrogen bonds — one more than the two in an A–T pair — so G–C is the more stable pairing. G–T and A–C are not valid Watson–Crick pairs, and A–T has two bonds, not three."
      }
    ]
  },
  {
    "id": "l-replication",
    "chapter": 9,
    "topic": "ch9-mechanism",
    "title": "How DNA Copies Itself",
    "blurb": "From the classic Meselson–Stahl experiment to the moving replication fork.",
    "steps": [
      {
        "kind": "teach",
        "body": "When a cell divides it must copy <b>all</b> of its DNA. Watson and Crick’s model hinted at how: unzip the two strands, and let each act as a <b>template</b> for a new partner strand. But is that really what happens?"
      },
      {
        "kind": "ask",
        "prompt": "Suppose each daughter molecule ends up with one <i>old</i> strand and one brand-<i>new</i> strand. What would we call that style of replication?",
        "choices": [
          "Bidirectional fork replication",
          "Dispersive strand replication",
          "Conservative-style replication",
          "Semiconservative replication"
        ],
        "answer": 3,
        "reveal": "<b>Semiconservative</b> — each daughter molecule conserves half (one strand) of the parent. Two rivals were also on the table: <b>conservative</b> (parent stays whole, a fully new copy is made) and <b>dispersive</b> (strands chopped and patched together)."
      },
      {
        "kind": "interactive",
        "widget": "meselson",
        "instructions": "Meselson and Stahl settled it using heavy (¹⁵N) and light (¹⁴N) DNA. Step through the generations and watch where the bands land."
      },
      {
        "kind": "teach",
        "body": "One <b>intermediate</b> band after round 1 eliminated the conservative model. <b>Two</b> bands after round 2 — one intermediate, one light — matched <b>only</b> semiconservative replication."
      },
      {
        "kind": "teach",
        "body": "Now zoom into the copying machine. DNA polymerase can only add bases to a free <b>3′ end</b>, so it builds strictly <b>5′→3′</b>. But the two templates are antiparallel… so how can both be copied at the same moving fork?"
      },
      {
        "kind": "interactive",
        "widget": "repfork",
        "instructions": "Step through a single replication fork and watch how the cell solves the antiparallel problem."
      },
      {
        "kind": "ask",
        "prompt": "One new strand is built smoothly toward the fork; the other is built in short, backward pieces. Why can’t both simply be made continuously?",
        "reveal": "Because the templates point opposite ways. Only the strand whose template runs 3′→5′ <i>into</i> the fork can be built continuously — the <b>leading strand</b>. The other template is exposed the “wrong” way, so its new strand (the <b>lagging strand</b>) must be made in short <b>Okazaki fragments</b>, each restarted with a fresh primer and later stitched together by ligase."
      },
      {
        "kind": "checkpoint",
        "q": "At a replication fork, the lagging strand is synthesized…",
        "options": [
          "Continuously, reading the template in the 3'->5' direction",
          "Continuously, needing no RNA primer at all to get going",
          "Continuously, running straight in toward the moving fork",
          "Discontinuously, in Okazaki fragments built backward"
        ],
        "answer": 3,
        "explain": "The lagging-strand template runs the opposite way, so its new strand is built in short Okazaki fragments that point away from the fork, each requiring its own RNA primer. Synthesis is always 5′→3′ (never 3′→5′), and a primer is always needed to start."
      }
    ]
  },
  {
    "id": "l-discovery",
    "chapter": 8,
    "topic": "ch8-discovery",
    "title": "How We Learned DNA Is the Gene",
    "blurb": "Reason through the three experiments that overturned “genes are protein.”",
    "steps": [
      {
        "kind": "teach",
        "body": "For decades, most scientists bet that genes were made of <b>protein</b>, not DNA. Proteins had 20 different building blocks; DNA seemed boringly repetitive. Three experiments overturned that bet."
      },
      {
        "kind": "teach",
        "body": "<b>1928 — Griffith.</b> Harmless live <b>R</b> bacteria, mixed with heat-killed deadly <b>S</b> bacteria, were injected into mice. Each component on its own was harmless."
      },
      {
        "kind": "ask",
        "prompt": "The mice died — and living S bacteria were recovered from them. What must have happened?",
        "choices": [
          "The heat-killed S cells revived and resumed dividing in the live mouse",
          "The mouse's own tissue cells turned infectious and killed the host",
          "A molecule from the dead S cells heritably transformed the R cells",
          "The R cells spontaneously mutated into the S form by pure chance"
        ],
        "answer": 2,
        "reveal": "A “<b>transforming principle</b>” passed from the dead S cells into the living R cells and permanently, heritably changed them. But <i>what molecule</i> was it?"
      },
      {
        "kind": "ask",
        "prompt": "Griffith’s extract contained DNA, protein, RNA, and more. How would <i>you</i> design an experiment to pin down which molecule is the transforming principle?",
        "reveal": "Avery, MacLeod & McCarty’s elegant idea: destroy <b>one</b> type of molecule at a time and see which destroys the transforming activity. They treated the extract with <b>protease</b> (kills protein), <b>RNase</b> (kills RNA), or <b>DNase</b> (kills DNA)."
      },
      {
        "kind": "ask",
        "prompt": "Only one of those treatments abolished transformation. Which result points to the genetic material?",
        "choices": [
          "RNase abolished it, so the transforming principle is the RNA",
          "Protease abolished it, so the transforming principle is protein",
          "No enzyme abolished it, so the principle resists all digestion",
          "Only DNase abolished it, so the transforming principle is DNA"
        ],
        "answer": 3,
        "reveal": "Only <b>DNase</b> abolished the activity → the transforming principle is <b>DNA</b>. Yet many scientists still clung to the protein hypothesis…"
      },
      {
        "kind": "teach",
        "body": "<b>1952 — Hershey & Chase.</b> A T2 bacteriophage is essentially just DNA packed inside a protein coat. They tagged the <b>DNA with radioactive ³²P</b> and the <b>protein with ³⁵S</b>, let the phages infect bacteria, then blended off the empty coats."
      },
      {
        "kind": "ask",
        "prompt": "Inside the infected cells — and in the next generation of phages — the radioactivity was ³²P, not ³⁵S. What does that tell you?",
        "choices": [
          "Neither the DNA nor the protein coat ever truly entered the host cell",
          "DNA enters and reappears in progeny, so DNA is the genetic material",
          "Both the DNA and the protein coat entered the host cell equally well",
          "Protein enters and reappears in the progeny, so protein is the carrier"
        ],
        "answer": 1,
        "reveal": "Only the <b>DNA</b> (³²P) went in and reappeared in the next generation. Together with Avery’s result, this finally convinced the field: <b>genes are made of DNA</b>."
      },
      {
        "kind": "checkpoint",
        "q": "Why did Hershey and Chase choose ³²P and ³⁵S specifically?",
        "options": [
          "DNA has phosphorus, no sulfur; protein has sulfur, no phosphorus",
          "The radioactive isotopes chemically convert the DNA into protein",
          "Phosphorus selectively tags the protein while sulfur tags the DNA",
          "Each molecule carries identical amounts of phosphorus and of sulfur"
        ],
        "answer": 0,
        "explain": "DNA contains phosphorus (in its sugar-phosphate backbone) but essentially no sulfur, while protein contains sulfur (in some amino acids) but no phosphorus. So ³²P traces DNA and ³⁵S traces protein independently — the labels only mark molecules, they don’t convert one into another."
      }
    ]
  },
  {
    "id": "l-conjugation",
    "chapter": 7,
    "topic": "ch7-conjugation",
    "title": "How Bacteria Share Genes",
    "blurb": "Bacteria don't need sex or offspring to swap DNA. Discover the three clever routes they use to trade genes sideways, and why those tricks are fueling the antibiotic resistance crisis.",
    "steps": [
      {
        "kind": "teach",
        "body": "Imagine an infection that shrugs off a drug it has never encountered, because a neighboring microbe simply handed it the resistance gene. Bacteria reproduce by splitting in two, which only copies DNA <i>down</i> to descendants. Yet they can also pass genes <i>sideways</i> between unrelated cells, a process called <b>horizontal gene transfer</b>. This chapter unpacks the three routes they use: <b>conjugation</b>, <b>transformation</b>, and <b>transduction</b>."
      },
      {
        "kind": "teach",
        "body": "In <b>conjugation</b>, two cells physically connect through a bridge called a <b>sex pilus</b>, and DNA flows in one direction only, from <b>donor</b> to <b>recipient</b>. The ability to donate is encoded by the <b>F factor</b>, a plasmid: cells carrying it are <b>F+</b> donors, and cells lacking it are <b>F-</b> recipients. Think of it less like mating and more like a one-way data cable plugged in by the cell that owns the F factor."
      },
      {
        "kind": "ask",
        "prompt": "In a simple F+ x F- conjugation, the donor copies its F factor and ships the copy across the pilus. After transfer is complete, what is the mating type of the former recipient cell?",
        "reveal": "The recipient turns into a donor. Conjugation copies the F factor and sends the copy across, so the original donor stays F+ and the former recipient is now F+ too, fully equipped to conjugate with the next F- cell it meets. This is exactly why an F factor can sweep through a population like a chain letter. An Hfr or F' state would first require the F factor to interact with the chromosome, which a plain F+ x F- cross never does.",
        "choices": [
          "It becomes Hfr, with the F factor fused into the chromosome",
          "It becomes F', having gained extra chromosomal genes nearby",
          "It stays F-, since a donor never gives away its F factor",
          "It becomes F+, since it now carries a copy of the F factor"
        ],
        "answer": 3
      },
      {
        "kind": "teach",
        "body": "Sometimes the F factor splices itself <i>into</i> the bacterial chromosome, creating an <b>Hfr cell</b> (\"high frequency of recombination\"). Now conjugation drags chromosomal genes along behind it in a fixed order, starting from where F sits. Because the connecting pilus usually breaks before the whole chromosome can transfer, the genes nearest the start enter first. If the integrated F later pops back out and accidentally grabs a few neighboring chromosomal genes, it becomes an <b>F' factor</b> that ferries those genes to the next recipient."
      },
      {
        "kind": "ask",
        "prompt": "Researchers deliberately interrupt Hfr conjugation at timed intervals, blending the cells to snap the pilus, and record which donor genes reached recipients at each time point. Why does this 'interrupted mating' let them map gene order in minutes?",
        "reveal": "Because Hfr transfer is sequential and begins from a fixed point, a gene's time of entry mirrors its physical position. A gene that consistently shows up after 10 minutes sits closer to the origin of transfer than one that only appears after 25 minutes. By logging the entry time of each gene, scientists build a chromosome map whose 'distance' unit is literally minutes, an elegant trick that turns a stopwatch into a ruler."
      },
      {
        "kind": "teach",
        "body": "The second route needs no contact at all. In <b>transformation</b>, a cell in a special receptive state called <b>competence</b> scoops up <b>naked DNA</b> floating in its surroundings, often released when other cells die and burst. The third route, <b>transduction</b>, is a delivery mistake: a <b>bacteriophage</b> (a virus that infects bacteria) accidentally packages bits of one host's DNA and injects them into the next bacterium it infects. In all three routes, the incoming DNA must <b>recombine</b> into the recipient's genome (or persist as a plasmid) to be inherited stably, and none of these processes is tied to reproduction."
      },
      {
        "kind": "checkpoint",
        "q": "A bacterium acquires new DNA without ever touching another cell and without any virus involved; it simply absorbs DNA fragments left behind by lysed neighbors. Which process is this?",
        "options": [
          "Hfr integration",
          "Transformation",
          "Transduction",
          "Conjugation"
        ],
        "answer": 1,
        "explain": "Taking up free, naked DNA from the environment is the defining feature of transformation, and it requires the cell to be in a competent state. Conjugation needs cell-to-cell contact through a pilus, and the virus-mediated route requires a bacteriophage as the carrier, so neither fits a contact-free, virus-free uptake of loose DNA."
      },
      {
        "kind": "checkpoint",
        "q": "Why are conjugation, transformation, and transduction such a serious problem for the spread of antibiotic resistance?",
        "options": [
          "They need the host cell to fully reproduce before any DNA can move",
          "They strip resistance genes out of bacterial populations permanently",
          "They only copy genes from a parent cell down to its daughter cells",
          "They shuttle resistance genes sideways between unrelated bacteria"
        ],
        "answer": 3,
        "explain": "All three mechanisms are forms of horizontal gene transfer, moving DNA sideways between cells that are not parent and offspring and that may not even be the same species. A resistance gene that arises in one bacterium can therefore jump into many others without waiting for reproduction, letting resistance spread far faster than mutation and vertical inheritance alone ever could."
      }
    ]
  },
  {
    "id": "l-defense",
    "chapter": 7,
    "topic": "ch7-defense",
    "title": "Restriction & CRISPR Immunity: How Microbes Fight Viruses",
    "blurb": "Bacteria and archaea live under constant viral attack. This lesson builds up two defense systems — the blunt-but-fast restriction-modification system and the adaptive, memory-based CRISPR-Cas system — and reveals the elegant trick each uses to destroy invaders without destroying itself.",
    "steps": [
      {
        "kind": "teach",
        "body": "A single drop of seawater can hold ten million virus particles, and bacteriophages outnumber bacteria by roughly ten to one. To a microbe, the world is a relentless storm of foreign DNA trying to hijack its machinery. Survival demanded immune systems, and microbes evolved two very different ones: a fast, hardwired defense called <b>restriction-modification</b>, and a slower but adaptable one with actual memory, called <b>CRISPR-Cas</b>."
      },
      {
        "kind": "teach",
        "body": "Start with the simpler weapon. A <b>restriction endonuclease</b> is a protein that scans DNA and cuts it wherever it meets a specific short sequence (often a palindrome such as GAATTC). Chop an invading phage's genome into fragments and it can no longer replicate. But this raises an obvious danger: the bacterium's <i>own</i> chromosome almost certainly contains that same sequence too."
      },
      {
        "kind": "ask",
        "prompt": "If a restriction enzyme cuts every GAATTC it encounters, how does a bacterium avoid shredding its own chromosome, which surely carries GAATTC sites as well?",
        "reveal": "The cell protects itself through <b>modification</b>: a partner methyltransferase adds methyl groups to its own copies of the recognition sequence. Methylated sites are invisible to the restriction enzyme, so only <i>unmethylated</i> foreign DNA gets cut. This self-versus-nonself flag is the entire logic of restriction-modification. (Bacteria have no nucleus to wall off their DNA, the recognition sequence is identical in self and invader rather than misspelled, and the enzyme stays active at all times — which is why the other answers fail.)",
        "choices": [
          "It hides the enzyme inside a membrane compartment, away from the chromosome",
          "It methylates its own copies of that sequence, so the enzyme skips over them",
          "Its own version of the sequence is spelled slightly differently from the invader's",
          "It delays making the enzyme until the phage has already finished replicating"
        ],
        "answer": 1
      },
      {
        "kind": "teach",
        "body": "Restriction-modification is powerful but dumb: it has no memory and meets every novel invader the same way. <b>CRISPR-Cas</b> is the upgrade — an <i>adaptive, heritable</i> immune system. Its centerpiece is the <b>CRISPR array</b>: a run of short, near-identical (often partially palindromic) <b>repeats</b> separated by unique <b>spacers</b>, where each spacer is a fragment of DNA captured from a virus the cell — or an ancestor — survived. Neighboring <b>cas genes</b> encode the Cas proteins that do the work. The array is essentially a genetic scrapbook of past enemies."
      },
      {
        "kind": "teach",
        "body": "CRISPR immunity unfolds in three stages. In <b>adaptation</b>, Cas proteins grab a chunk of an invader's DNA (a <b>protospacer</b>) and paste it into the array as a brand-new spacer — this forms the memory. In <b>expression</b>, the array is transcribed into a long <b>pre-crRNA</b>, then processed into short individual <b>crRNAs</b>, each loaded onto one or more Cas proteins to build an effector complex. In <b>interference</b>, that complex uses its crRNA to base-pair with matching returning DNA, and Cas cleaves it."
      },
      {
        "kind": "ask",
        "prompt": "Here's the catch. After adaptation, the invader's sequence now exists in TWO places: in the foreign DNA, and as a spacer in the cell's own CRISPR array. The crRNA matches both. What stops the effector complex from destroying the cell's own array?",
        "reveal": "The key is the <b>PAM</b> (protospacer-adjacent motif), a short sequence (for example NGG in many systems) lying immediately beside the protospacer <i>in the foreign DNA</i>. Cas demands a valid PAM before it will commit to cutting. Because the array stores only the spacer and NOT the flanking PAM, the cell's own CRISPR memory lacks the trigger — so the effector strikes the invader while sparing the array. (Methylation is the restriction-modification trick, the effector clearly does target DNA, and Cas freely accesses the chromosome — so the other answers miss the mark.)",
        "choices": [
          "The array is chemically methylated for protection, much like in restriction-modification",
          "The crRNA can base-pair only with foreign RNA, and never with any of the DNA at all",
          "Cas proteins are able to physically reach only DNA that lies outside the chromosome",
          "A short PAM flanks the protospacer in the invader but is absent from the array spacer"
        ],
        "answer": 3
      },
      {
        "kind": "interactive",
        "widget": "crispr",
        "instructions": "Step through the three stages of CRISPR-Cas immunity — adaptation, expression, and interference."
      },
      {
        "kind": "checkpoint",
        "q": "Which feature is the defining advantage of CRISPR-Cas over restriction-modification?",
        "options": [
          "It defends the cell only against the genomes of single-stranded RNA viruses",
          "It keeps a heritable record of past invaders that drives adaptive immunity",
          "It relies on methylation to mark the cell's own self DNA as protected",
          "It cleaves invading DNA at one fixed, specific recognition sequence in the genome"
        ],
        "answer": 1,
        "explain": "Both systems cleave foreign DNA, but only CRISPR-Cas builds a memory: it captures spacers from invaders and passes that record to daughter cells, so the lineage responds faster to a returning threat. That heritable, sequence-specific memory is what makes it adaptive. Restriction-modification, by contrast, is a fixed, inborn defense that never learns, and methylation is its hallmark rather than a CRISPR feature."
      },
      {
        "kind": "checkpoint",
        "q": "A researcher finds a CRISPR spacer that perfectly matches a region of a phage genome, yet the system never cleaves the cell's own array. The most likely reason is:",
        "options": [
          "The cell methylates its own stored array but leaves the phage DNA unmethylated",
          "The array spacer happens to be transcribed in the wrong reading direction here",
          "The stored array spacer lacks the adjacent PAM that the phage region carries",
          "Cas proteins are all degraded by the cell before they ever reach the array"
        ],
        "answer": 2,
        "explain": "Cleavage requires both a crRNA match AND a valid adjacent motif. The invading DNA carries that motif right next to the matching region, but the stored spacer was copied without its flanking motif, so the targeting requirement is never met inside the array. This is precisely how the system tells a real invader apart from its own genetic memory. The remaining explanations either describe restriction-modification or invent mechanisms CRISPR does not use."
      }
    ]
  },
  {
    "id": "l-viruses",
    "chapter": 7,
    "topic": "ch7-phages",
    "title": "Viruses: Lytic, Lysogenic & Retro",
    "blurb": "How viruses hijack cells, hide inside our DNA, and reinvent themselves fast enough to outrun our immune systems.",
    "steps": [
      {
        "kind": "teach",
        "body": "A virus sits right at the edge of being alive: a scrap of genetic code wrapped in protein, with no way to reproduce on its own. To make copies, it has to break into a living cell and convert that cell's machinery into a virus factory. The real story of this chapter is <i>strategy</i> — different viruses face the same problem (copy me) and solve it in startlingly different ways. We'll start with the viruses that infect bacteria, called <b>bacteriophages</b>, because they lay out the two classic playbooks most clearly."
      },
      {
        "kind": "teach",
        "body": "The aggressive playbook is the <b>lytic cycle</b>. The phage <b>attaches</b> to the host, <b>injects its DNA</b>, and immediately hijacks the cell to mass-produce new viral parts. Those parts self-assemble into fresh phages, and finally the cell bursts open — <b>lysis</b> — releasing a swarm to hunt for new hosts. It's fast, destructive, and the host always dies. Phages that <i>only</i> run this program are called <b>virulent</b>."
      },
      {
        "kind": "ask",
        "prompt": "The lytic cycle kills the host fast. But picture a phage infecting a starving bacterium in a nutrient-poor environment, where healthy host cells are scarce. Why might bursting the cell open right away actually be a poor survival bet for the virus?",
        "reveal": "If the phage lyses its host immediately but there are few healthy cells nearby to infect, the newly released phages have nowhere to go and simply fall apart. A smarter move is to lie low: integrate into the host genome and get copied passively every time the bacterium divides, riding along for free until conditions improve. That patient strategy is the <b>lysogenic cycle</b> — and it's precisely why temperate phages exist."
      },
      {
        "kind": "teach",
        "body": "In the <b>lysogenic cycle</b>, the phage DNA inserts itself into the host chromosome and becomes a <b>prophage</b>. It does nothing destructive — it's simply replicated along with the host's own DNA at every cell division, quietly spreading through generations. Later, stress (classically a dose of <b>UV light</b>) can trigger <b>induction</b>: the prophage excises itself and flips into the lytic cycle. Phages that can take either path are called <b>temperate</b>."
      },
      {
        "kind": "ask",
        "prompt": "To actually count phages in the lab, microbiologists spread bacteria into a smooth 'lawn' on a plate, add phages, and watch for clear spots called plaques. Each clear spot is a hole in the lawn where bacteria have died. What had to happen for one of those clear spots to form?",
        "reveal": "A <b>plaque</b> is the visible footprint of the lytic cycle playing out in miniature. One phage infects a cell, bursts it, and the released offspring infect the neighbors, which burst and release still more — a spreading wave of death that clears a circle in the lawn. Because each plaque traces back to a single original phage, counting plaques lets you count viruses.",
        "choices": [
          "Cells in that spot starved after exhausting the local nutrient supply",
          "A phage infected a cell, lysed it, and offspring killed neighbors",
          "Antibiotics diffusing through the agar dissolved the bacterial cells",
          "A single bacterium divided faster than every neighbor around it"
        ],
        "answer": 1
      },
      {
        "kind": "teach",
        "body": "Now flip to viruses that infect us. <b>Retroviruses</b> run the usual flow of genetic information backward. They carry <b>RNA</b> rather than DNA, and bring along an enzyme called <b>reverse transcriptase</b> that copies that RNA back into DNA. A second enzyme, <b>integrase</b>, then stitches this DNA into the host genome as a <b>provirus</b>. Their genome is compact: <b>gag</b> builds the capsid, <b>pol</b> encodes reverse transcriptase and integrase, and <b>env</b> makes the envelope proteins."
      },
      {
        "kind": "teach",
        "body": "<b>HIV</b> is the infamous retrovirus. It targets <b>helper T cells</b> — the immune system's coordinators — so the very defense meant to fight it gets dismantled from the inside. Worse, reverse transcriptase is sloppy and makes copying errors constantly, so HIV <b>mutates fast</b>, staying a step ahead of both the immune response and many drugs. Notice the parallel: a prophage hiding in bacterial DNA and a provirus hiding in our DNA are running the same 'lie low inside the host genome' trick."
      },
      {
        "kind": "checkpoint",
        "q": "What is the defining role of reverse transcriptase in a retrovirus's life cycle?",
        "options": [
          "It bursts the host cell membrane to release newly assembled virions",
          "It builds the protein capsid shell that encloses the viral genome",
          "It copies the viral RNA genome into DNA so the genome integrates",
          "It splices the finished viral DNA straight into the host chromosome"
        ],
        "answer": 2,
        "explain": "Retroviruses start with an RNA genome but need DNA to integrate into the host. Reverse transcriptase performs that backward step — RNA into DNA — which is exactly why these viruses are called 'retro.' Stitching the resulting DNA into the chromosome is the separate job of integrase, and the capsid is built from the gag gene's products."
      },
      {
        "kind": "checkpoint",
        "q": "Influenza has a segmented RNA genome. When two different flu strains infect the same host cell at once and swap whole segments, producing a dramatically new virus, this is called:",
        "options": [
          "Antigenic drift, from slow accumulation of point mutations",
          "Induction, from prophage activation triggered by UV light",
          "Lysogeny, from quiet integration as a dormant prophage",
          "Antigenic shift, from reassorting entire genome segments"
        ],
        "answer": 3,
        "explain": "Because flu's genome is split into separate segments, co-infection lets two strains physically reshuffle whole pieces into a brand-new combination — antigenic shift — and that abrupt, large change can spark a pandemic the population has no immunity to. It's distinct from antigenic drift, the slow accumulation of small point mutations that nudges the virus a little at a time."
      }
    ]
  },
  {
    "id": "l-genmat",
    "chapter": 8,
    "topic": "ch8-genetic-material",
    "title": "What Makes Good Genetic Material",
    "blurb": "Before anyone knew DNA was the molecule of heredity, scientists had to reason out what any genetic material MUST be able to do — and most of them bet on the wrong molecule. Let's reconstruct that detective story.",
    "steps": [
      {
        "kind": "teach",
        "body": "Imagine you are a biologist in 1920. You know traits pass from parent to offspring, but you have no idea which molecule carries them. Before you can find the culprit, you need a <b>job description</b> — a list of everything the genetic material must be capable of doing. Get that list right, and you'll know what kind of molecule to hunt for."
      },
      {
        "kind": "ask",
        "prompt": "Think about what heredity actually requires. What are the essential jobs the molecule of inheritance has to perform — what must it be able to do for life to work across generations?",
        "reveal": "Biologists eventually agreed on four non-negotiable requirements. The genetic material must (1) <b>store complex information</b> — enough to specify an entire organism; (2) <b>replicate faithfully</b>, so copies pass accurately to offspring; (3) be <b>expressible as a phenotype</b>, meaning the stored information can be read out (through transcription and translation) to build traits; and (4) have the <b>capacity to vary</b>, so that mutation and new combinations can fuel evolution. Any candidate molecule had to pass all four tests."
      },
      {
        "kind": "teach",
        "body": "Notice the tension hidden in that list. Faithful copying demands <b>stability and accuracy</b> — the archive can't drift every generation. But the capacity to vary demands the opposite: the molecule <b>can't be so rigid that change is impossible</b>. Good genetic material walks a tightrope — stable enough to be a reliable record, yet flexible enough to occasionally change and feed evolution."
      },
      {
        "kind": "ask",
        "prompt": "It's the 1920s through 1940s. Cells contain both proteins and nucleic acids. Proteins are built from 20 different amino acids; DNA is built from just 4 nucleotides. If you had to bet which molecule stores all of heredity's complex information, which would you pick — and why?",
        "reveal": "Most scientists bet on <b>protein</b>, and the reasoning was understandable for its time. With <b>20 amino acids</b> to arrange in endless sequences, proteins looked rich enough to encode the staggering complexity of a living organism. DNA's mere <b>4 nucleotides</b> seemed like too small an alphabet to write the whole book of life. The information-storage requirement is exactly what made protein the favorite — the variety argument felt decisive. They were wrong, but for a reason that made sense before the structure of DNA was understood.",
        "choices": [
          "Protein, because it is chemically far more stable than the fragile DNA strand",
          "Protein, because 20 amino acids offer richer variety than DNA's 4 bases",
          "DNA, because it was already proven to carry the genetic code in cells",
          "DNA, because a compact 4-letter alphabet is more than enough for heredity"
        ],
        "answer": 1
      },
      {
        "kind": "teach",
        "body": "DNA's reputation got worse thanks to Phoebus Levene. His <b>tetranucleotide hypothesis</b> proposed that DNA was just the four nucleotides occurring in roughly equal amounts, locked into a fixed, monotonous repeating unit — picture ...ATGC-ATGC-ATGC... on and on. If DNA were truly that <b>repetitive and uniform</b>, it couldn't store complex, variable information at all. The idea made DNA look like a dull structural scaffold, not the keeper of heredity."
      },
      {
        "kind": "ask",
        "prompt": "Which of the four requirements does the tetranucleotide hypothesis most directly seem to violate, and why does that matter so much?",
        "reveal": "It attacks the ability to <b>store complex information</b>, and it undercuts the <b>capacity to vary</b>. A molecule that is just one short motif repeated identically carries almost no information — every stretch looks like every other stretch, so there is nothing meaningful to read and nothing that can meaningfully change. The hypothesis turned out to be wrong: DNA's four bases occur in <b>any order, in essentially limitless sequences</b>, which is precisely what lets a four-letter alphabet encode enormous complexity. But while people believed DNA was monotonous, it simply didn't look like a serious candidate."
      },
      {
        "kind": "teach",
        "body": "One more property quietly favors DNA as the long-term keeper of information: <b>chemical stability</b>. Compared with its cousin RNA, DNA is far less reactive — RNA carries an extra hydroxyl group on its sugar that makes it more prone to breaking down. A genome is meant to be a durable <b>archive</b> passed faithfully across generations, so a tougher, more stable molecule is exactly what you'd want for permanent storage, leaving the more fragile RNA better suited to short-lived, working copies."
      },
      {
        "kind": "checkpoint",
        "q": "Why did many early-twentieth-century scientists favor protein over DNA as the genetic material?",
        "options": [
          "Protein was thought to be the only molecule in cells able to copy and replicate itself",
          "DNA had simply not yet been found or identified inside the nucleus of living cells",
          "Protein was known to be far more chemically reactive and active than the DNA molecule",
          "Protein's 20 amino acids seemed varied enough for heredity; DNA's 4 looked too plain"
        ],
        "answer": 3,
        "explain": "The decisive argument was about information capacity. With twenty different building blocks, proteins seemed rich enough to encode an organism's complexity, whereas DNA's four-letter alphabet — especially under the mistaken belief that those letters merely repeated monotonously — looked far too simple to carry heredity."
      },
      {
        "kind": "checkpoint",
        "q": "Which statement best captures why DNA's chemical stability suits its biological role?",
        "options": [
          "Its constant instability lets it mutate freely, which is genetic material's true job",
          "Its stability lets DNA be read straight into protein with no intermediate molecule",
          "Its stability is precisely why each DNA strand is built from 20 different amino acids",
          "Its greater stability versus reactive RNA suits it as a long-term genetic archive"
        ],
        "answer": 3,
        "explain": "Genetic material must be copied faithfully and preserved across generations, so a durable, less reactive molecule is ideal for permanent storage. DNA is more chemically stable than RNA, which fits the role of a long-term archive, while the more fragile RNA tends to serve as the short-lived working copy."
      }
    ]
  },
  {
    "id": "l-packaging",
    "chapter": 8,
    "topic": "ch8-packaging",
    "title": "Packing the Genome",
    "blurb": "Two meters of DNA folds into a nucleus a few microns wide. Let's unpack the supercoils, spools, and chemical switches that make it fit — and keep it readable.",
    "steps": [
      {
        "kind": "teach",
        "body": "A single human cell holds about two meters of <b>DNA</b> packed into a nucleus roughly one-hundred-thousandth that wide. Picture stuffing a strand of yarn the length of a football field into a marble — without snarling it so badly you can never find the part you need. Evolution's answer was layered compaction that stays both <i>organized</i> and <i>readable</i>. The first trick is twisting: a double helix can be <b>overwound</b> (extra twists, called <b>positive supercoiling</b>) or <b>underwound</b> (fewer twists, <b>negative supercoiling</b>). Like a phone cord that loops on itself when over-twisted, the molecule writhes to relieve the strain — but only if its ends are held fast. With free ends, the strain just spins away."
      },
      {
        "kind": "ask",
        "prompt": "Why does a linear piece of DNA with two free ends NOT hold supercoils, while a bacterial circle or a protein-anchored loop does?",
        "reveal": "Supercoiling is stored torsional stress, and stress only lasts if it has nowhere to escape. A free end behaves like an open valve — the helix simply unspins until the strain is gone. To trap supercoils you need <b>constrained ends</b>: a covalently closed circle (as in bacteria) or DNA pinned down by proteins. That is why most cellular DNA can hold a supercoiled state.",
        "choices": [
          "Free ends let the strands spin and bleed off the twisting strain",
          "Circular DNA simply packs many more base pairs along its length",
          "Linear DNA lacks the phosphate backbone needed to store any twist",
          "Free ends are chemically far more stable than closed loops or coils"
        ],
        "answer": 0
      },
      {
        "kind": "teach",
        "body": "Cells actively manage twisting with enzymes called <b>topoisomerases</b>. They work by transiently <i>cutting</i> one or both strands, letting the DNA rotate or pass through the break, then <i>rejoining</i> it — adding or removing twists on demand. Most cellular DNA is kept slightly <b>negatively supercoiled</b> (underwound), which makes the strands easier to peel apart for replication and transcription and also helps it pack more compactly."
      },
      {
        "kind": "ask",
        "prompt": "A cell needs to open its DNA for transcription. Would positive (overwound) or negative (underwound) supercoiling make that easier, and why?",
        "reveal": "Underwinding means the helix is already 'short' on twists, so locally separating the two strands relieves stored tension rather than fighting it. That is why <b>negative supercoiling</b> is the cell's default — it primes the DNA to be opened for reading and copying, while also taking up less space.",
        "choices": [
          "Negative, because underwinding stores tension favoring strand separation",
          "Neither, because supercoiling has no real effect on strand opening at all",
          "Positive, because overwinding pre-loosens the paired strands for opening",
          "Positive, because the extra winding adds stabilizing hydrogen bonds"
        ],
        "answer": 0
      },
      {
        "kind": "teach",
        "body": "Bacteria and eukaryotes pack differently. A typical bacterial chromosome is a single <b>circular</b> molecule lacking histones; it is twisted and bundled into looped domains in a dense region called the <b>nucleoid</b>. Eukaryotes instead build <b>chromatin</b> — DNA plus a large cast of proteins. Its core repeating unit is the <b>nucleosome</b>: about 147 base pairs of DNA wrapped roughly twice around a <b>histone octamer</b> (two copies each of H2A, H2B, H3, and H4). A separate linker histone, <b>H1</b>, clamps the DNA where it enters and exits. Strung together, nucleosomes resemble <i>beads on a string</i> — the first real level of packaging."
      },
      {
        "kind": "ask",
        "prompt": "Histones are loaded with positively charged amino acids. Why is that charge chemically perfect for binding DNA?",
        "reveal": "DNA carries a strongly <b>negative</b> charge along its phosphate backbone. The <b>positively charged</b> histones grip it through electrostatic attraction — the molecular version of a magnet snapping onto steel. Hold onto this charge idea: it is the secret behind how cells later loosen or tighten chromatin on command.",
        "choices": [
          "The charge lets histones base-pair directly with the exposed bases",
          "The positive charge repels DNA, leaving it only loosely tethered",
          "DNA's phosphate backbone is negative, so opposite charges attract",
          "Histones exploit the charge to nick and cut the DNA backbone open"
        ],
        "answer": 2
      },
      {
        "kind": "teach",
        "body": "Packaging then continues in tiers: the beads-on-a-string fiber coils into a thicker <b>30-nm fiber</b>, which folds into large <b>loops</b> anchored to a protein scaffold, condensing further into the <b>chromatid</b> seen in a metaphase chromosome. But packing is not uniform. <b>Euchromatin</b> is loosely packed, gene-rich, and actively transcribed — the 'open for business' regions. <b>Heterochromatin</b> is tightly condensed, gene-poor, and largely silent. A region's packing state is itself a major switch over whether its genes can be read."
      },
      {
        "kind": "ask",
        "prompt": "Adding acetyl groups to histones (acetylation) neutralizes their positive charge. Predict what that does to chromatin and to gene activity.",
        "reveal": "Recall that histones grip DNA through positive-on-negative attraction. <b>Acetylation</b> cancels some of that positive charge, weakening the grip so the DNA loosens away from the histones. Looser, more open chromatin (euchromatin-like) is easier for transcription machinery to reach — so acetylation generally <i>promotes</i> gene expression. Some packaging marks like this are heritable yet leave the DNA sequence untouched; these are <b>epigenetic</b> changes. <b>DNA methylation</b> (often added to silence a region) is another classic example — copied to daughter cells, yet <i>reversible</i>. Epigenetics is how genetically identical cells become a neuron versus a skin cell.",
        "choices": [
          "Tightens chromatin into a closed state and broadly silences nearby genes",
          "Has no real effect, since surface charge does not govern DNA packing",
          "Severs the DNA strand at that site, physically deleting the local genes",
          "Loosens chromatin into an open state and tends to activate nearby genes"
        ],
        "answer": 3
      },
      {
        "kind": "checkpoint",
        "q": "Which statement about the nucleosome is correct?",
        "options": [
          "It forms when topoisomerases slice the DNA into clean 147-bp fragments",
          "It is one circular DNA molecule carrying no bound histone proteins at all",
          "About 147 bp wraps twice around an octamer of H2A, H2B, H3, H4, plus H1",
          "It is DNA looped tightly around a single central H1 linker histone core"
        ],
        "answer": 2,
        "explain": "The nucleosome is the basic bead of chromatin: roughly 147 base pairs of DNA wound about twice around a histone octamer (two each of H2A, H2B, H3, and H4), with the linker histone H1 securing the entry and exit DNA. A protein-free circular molecule describes a bacterial chromosome, not a nucleosome, and the remaining choices misstate both the histone composition and how nucleosomes form."
      },
      {
        "kind": "checkpoint",
        "q": "Which change is epigenetic — heritable and reversible without altering the DNA sequence?",
        "options": [
          "DNA methylation that quietly silences a target gene region",
          "A rewriting of the genetic code's own codon-to-amino-acid map",
          "A deletion that permanently strips away a whole chromosome arm",
          "A point mutation that swaps one DNA base for a different base"
        ],
        "answer": 0,
        "explain": "Epigenetic marks such as DNA methylation can be inherited by daughter cells and later removed, all without changing the underlying base sequence. A point mutation is an actual sequence change, a deletion physically removes DNA, and the codon-assignment option describes something that does not occur in normal cells — none of which fit the definition of an epigenetic change."
      }
    ]
  },
  {
    "id": "l-chromosome",
    "chapter": 8,
    "topic": "ch8-chromosome",
    "title": "Centromeres, Telomeres & Repeats",
    "blurb": "Why some of the most important DNA on a chromosome codes for nothing at all — and how the ends and the middle keep your genome from falling apart.",
    "steps": [
      {
        "kind": "teach",
        "body": "Imagine handing a cell a giant string of beads and asking it to copy them, split them evenly into two daughter cells, and never let the loose ends fray or stick together. To pull this off, a chromosome needs special landmarks that aren't really about <b>genes</b> at all. Two of the most critical — the <b>centromere</b> in the middle and the <b>telomeres</b> at the tips — are built largely from repetitive, non-coding DNA. This lesson is about how physical structure, not protein-coding, is what makes a genome workable."
      },
      {
        "kind": "teach",
        "body": "The <b>centromere</b> is the chromosome's handle: it's where the <b>kinetochore</b> assembles and the <b>spindle</b> fibers grab on to drag sister chromatids apart in mitosis. It sits in a region of tightly packed <b>heterochromatin</b>, and in many species it's full of <b>highly repetitive</b> tandem (satellite) DNA. But here's the twist — there is <b>no universal centromere sequence</b> that every centromere shares."
      },
      {
        "kind": "ask",
        "prompt": "If centromeres aren't defined by one specific DNA sequence, then what tells the cell 'THIS spot is the centromere, build the kinetochore here'?",
        "reveal": "Centromere identity is <b>epigenetic</b>, not sequence-based. At the centromere, the usual histone <b>H3</b> in the nucleosomes is swapped out for the variant <b>CENP-A</b>. That altered chromatin is the actual mark the cell reads to know where to assemble the kinetochore — which is why a given spot can stay 'the centromere' across cell generations even though no single DNA sequence is required.",
        "choices": [
          "A shared promoter sequence common to every centromere region",
          "A variant histone, CENP-A, that swaps in for normal H3 there",
          "The shortest, most compact stretch of DNA along the chromosome",
          "An enhancer element that the spindle fibers bind to directly"
        ],
        "answer": 1
      },
      {
        "kind": "teach",
        "body": "Now the ends. Each <b>telomere</b> is a cap made of a short, <b>G-rich</b> sequence repeated over and over — in humans, <b>TTAGGG</b> stacked thousands of times. One strand runs longer than the other, leaving a single-stranded <b>3' G-overhang</b>. A protein complex called <b>shelterin</b> binds and folds this end so the cell doesn't mistake the natural chromosome tip for damage."
      },
      {
        "kind": "ask",
        "prompt": "Why does a chromosome even NEED a protective cap? What would the cell's repair machinery do with a bare, unprotected DNA end?",
        "reveal": "A naked DNA end looks exactly like a <b>double-strand break</b> — an emergency the cell tries to fix by joining ends together. Without protection, chromosomes would get fused end-to-end and then shredded during division. <b>Shelterin</b> hides the natural tip so it reads as a proper end rather than as damage, preventing both fusion and degradation.",
        "choices": [
          "Read it as a double-strand break and try to repair or fuse the end",
          "Nothing at all, since free DNA ends are perfectly stable on their own",
          "Convert the exposed end into a fully working second centromere",
          "Immediately build a brand-new functional gene right at that broken end"
        ],
        "answer": 0
      },
      {
        "kind": "teach",
        "body": "Step back to the whole genome and you hit a puzzle: total genome size doesn't track how complex an organism seems. Some amphibians and plants carry far more DNA than humans do. This mismatch is the <b>C-value paradox</b> — and its resolution is that much of a large genome isn't unique genes but <b>repetitive</b> and non-coding sequence."
      },
      {
        "kind": "teach",
        "body": "Genomic DNA sorts into rough classes by copy number. <b>Unique-sequence DNA</b> is present in one or a few copies — most protein-coding genes and gene families like the <b>beta-globin</b> cluster. <b>Moderately repetitive DNA</b> includes <b>rRNA</b> and <b>tRNA</b> genes plus interspersed repeats such as <b>SINEs</b> (e.g. <b>Alu</b>) and <b>LINEs</b>, many of which are remnants of mobile <b>transposons</b>. <b>Highly repetitive DNA</b> is short sequences tandemly repeated many thousands to millions of times, clustered at structural sites like centromeres and telomeres."
      },
      {
        "kind": "ask",
        "prompt": "An Alu element appears scattered hundreds of thousands of times throughout the genome, both between and within genes, and is a leftover from a mobile genetic element. Which sequence class does it best fit?",
        "reveal": "<b>Alu</b> is a <b>SINE</b> — a short interspersed element scattered across the genome rather than clustered, and derived from transposons. That 'many copies, spread out, transposon-derived' profile is the signature of <b>moderately repetitive interspersed</b> DNA. It isn't unique (far too many copies) and it isn't the dense tandem arrays of highly repetitive satellite DNA.",
        "choices": [
          "Clustered centromeric satellite arrays",
          "Highly repetitive tandem satellite DNA",
          "Moderately repetitive interspersed DNA",
          "Unique-sequence single-copy genomic DNA"
        ],
        "answer": 2
      },
      {
        "kind": "checkpoint",
        "q": "Which statement about the centromere is correct?",
        "options": [
          "It is built mostly from unique-sequence protein-coding genes",
          "It is marked epigenetically by the variant histone CENP-A over H3",
          "Its position is fixed by one DNA sequence shared across all species",
          "It is the G-rich repeated cap that blocks chromosome end fusion"
        ],
        "answer": 1,
        "explain": "Centromere identity is epigenetic: the variant histone CENP-A takes the place of H3 in centromeric nucleosomes, and the cell reads that chromatin mark to build the kinetochore. There's no universal centromere sequence; the G-rich cap describes telomeres; and centromeres are repetitive heterochromatin rather than unique coding DNA."
      },
      {
        "kind": "checkpoint",
        "q": "Human telomeres consist of which feature?",
        "options": [
          "CENP-A nucleosomes that recruit the spindle fibers to the chromosome",
          "The tandem repeat TTAGGG ending in a single-stranded 3' G-overhang",
          "The beta-globin gene family arranged in long tandem repeats",
          "rRNA genes that fall into the moderately repetitive sequence class"
        ],
        "answer": 1,
        "explain": "A telomere is the chromosome-end cap: many copies of the G-rich repeat TTAGGG ending in a single-stranded 3' overhang, with shelterin proteins binding so the tip isn't read as a double-strand break. CENP-A and the spindle belong to the centromere, while beta-globin and rRNA genes are coding or moderately repetitive sequences, not end caps."
      }
    ]
  },
  {
    "id": "l-enzymes",
    "chapter": 9,
    "topic": "ch9-enzymes",
    "title": "The Replication Crew",
    "blurb": "Copying a bacterial genome is a relay race run by a pit crew of proteins, each with one specialized job. Meet the team that unzips, stabilizes, primes, builds, proofreads, and seals DNA — and learn why it almost never makes a mistake.",
    "steps": [
      {
        "kind": "teach",
        "body": "Imagine a bacterium that has to copy over 4 million base pairs flawlessly before it splits in two — and do it in well under an hour. No single protein could pull that off. Instead, evolution assembled a <b>replication crew</b>: a team of specialized proteins working at the <b>replication fork</b>, each handling exactly one job in the assembly line that duplicates the chromosome."
      },
      {
        "kind": "teach",
        "body": "Replication starts at a fixed spot called the <b>origin</b>. The <b>initiator protein (DnaA)</b> binds there first and destabilizes the double helix, opening a small bubble of single-stranded DNA in an AT-rich stretch. Think of DnaA as the crew member who cracks open the zipper so everyone else can get to work."
      },
      {
        "kind": "ask",
        "prompt": "Once DnaA opens that bubble, the two strands are still wound tightly into a helix everywhere else. What kind of machine do you think the cell needs next to actually run the fork forward and keep unwinding the DNA?",
        "reveal": "The fork needs <b>helicase</b>, the unwinding motor. It uses energy to travel along the DNA and break the hydrogen bonds holding the base pairs together, peeling the two strands apart so they can each serve as a template. Gluing the strands tighter would block replication, and the crew members that add bases come later — first you have to expose the template strands.",
        "choices": [
          "A motor that breaks hydrogen bonds and peels the strands apart",
          "A polymerase that adds fresh bases onto the growing strand end",
          "A protein that clamps the two parental strands together tightly",
          "A nuclease that chops the DNA into short scattered fragments"
        ],
        "answer": 0
      },
      {
        "kind": "teach",
        "body": "Two problems appear the instant helicase unwinds the DNA. First, the freshly separated single strands are sticky and tend to re-pair or fold up — so <b>single-strand-binding proteins (SSBs)</b> coat them and hold them open and ready. Second, unwinding a twisted helix builds up torsional strain ahead of the fork, like twisting a phone cord tighter. <b>DNA gyrase</b>, a type of <b>topoisomerase</b>, snips, swivels, and reseals the DNA to release that supercoiling so the fork doesn't seize up."
      },
      {
        "kind": "teach",
        "body": "Now the templates are exposed and ready to be copied — but there's a catch. <b>DNA polymerases cannot start a new strand from scratch.</b> They can only <i>extend</i> an existing chain by adding to a free <b>3'-OH</b> group. So the crew calls in <b>primase</b>, an RNA-making enzyme that lays down a short <b>RNA primer</b> on the template. That primer provides the 3'-OH the polymerase needs as a starting handhold."
      },
      {
        "kind": "ask",
        "prompt": "Why does the cell bother making the primer out of RNA — and then later have to come back and replace it with DNA — instead of just starting with DNA in the first place?",
        "reveal": "It comes down to the rule that <b>DNA polymerase can only add to an existing 3'-OH</b>; it cannot place the very first nucleotide on a bare template. <b>Primase</b> has no such restriction — it can begin a strand from nothing, but it builds with RNA. So the cell accepts a temporary RNA starter to get going, then cleans it up afterward. Using RNA also flags the primer as 'remove me later,' which helps keep replication accurate."
      },
      {
        "kind": "teach",
        "body": "With a primer in place, the main builder takes over: <b>DNA polymerase III</b>. It races along the template synthesizing new DNA in the <b>5'-to-3' direction</b>, and it's also a proofreader — its <b>3'-to-5' exonuclease</b> activity backs up to remove a wrong base right after inserting it. Then <b>DNA polymerase I</b> steps in to remove the RNA primers and fill those gaps with DNA, and finally <b>DNA ligase</b> seals the leftover <b>nicks</b> in the sugar-phosphate backbone, stitching the new strand into one continuous piece."
      },
      {
        "kind": "checkpoint",
        "q": "A mutant bacterium produces a DNA polymerase III that still synthesizes DNA normally but has completely lost its 3'-to-5' exonuclease activity. What is the most likely consequence?",
        "options": [
          "RNA primers can no longer be laid down ahead of the polymerase",
          "The two parental strands can no longer be unwound at the fork",
          "Replication can no longer start at the chromosomal origin site",
          "The mutation rate climbs as mismatched bases go unproofread"
        ],
        "answer": 3,
        "explain": "The 3'-to-5' exonuclease is the proofreading function: it removes a mismatched base immediately after it's inserted. Without it, wrong bases stay in place, so errors accumulate and the mutation rate climbs. Starting replication, making primers, and unwinding the helix are jobs handled by other crew members — the initiator, primase, and helicase — so those steps are unaffected."
      },
      {
        "kind": "checkpoint",
        "q": "Bacterial replication achieves a fidelity of roughly one error per billion base pairs. Which combination best explains this extraordinary accuracy?",
        "options": [
          "Helicase unwinding paired with single-strand-binding proteins coating DNA",
          "Accurate base selection, active proofreading, and later mismatch repair",
          "DNA gyrase relieving supercoils paired with ligase sealing the nicks",
          "Primase laying RNA primers and DNA polymerase I later clearing them"
        ],
        "answer": 1,
        "explain": "Fidelity is the product of three independent safeguards stacked together: the polymerase selects the correct complementary base accurately to begin with, it proofreads and excises mistakes as it goes, and a separate mismatch repair system scans the finished DNA afterward to catch what slipped through. Each layer multiplies the accuracy of the last. The other jobs are real and important, but they handle unwinding, strain relief, and primer cleanup rather than guarding the accuracy of the copied sequence."
      }
    ]
  },
  {
    "id": "l-telomerase",
    "chapter": 9,
    "topic": "ch9-eukaryotic",
    "title": "Copying the Ends: The End-Replication Problem and Telomerase",
    "blurb": "Linear chromosomes have a built-in copying flaw at their tips. Discover why eukaryotes fire many origins exactly once, why DNA's ends keep getting shorter, and the clever RNA-toting enzyme that pushes back against the clock.",
    "steps": [
      {
        "kind": "teach",
        "body": "Imagine a painter who can only paint a floor by first laying down a strip of tape to stand on, then peeling it up at the very end. In the middle of a room that's no problem, but at the far wall the tape leaves a bare patch that never gets painted. Your <b>linear chromosomes</b> face exactly this dilemma every time a cell divides. To understand why, we first have to see why copying eukaryotic DNA is harder than copying a tidy bacterial loop."
      },
      {
        "kind": "teach",
        "body": "A human cell must copy roughly two meters of DNA in just a few hours, so it cannot rely on a single starting point. Instead it launches replication from <b>many origins</b> scattered along each chromosome. But this creates a control problem: each stretch of DNA must be copied <b>exactly once per cell cycle</b> — no piece left out, and no piece copied twice. Over-copying would scramble gene dosage; under-copying would lose information."
      },
      {
        "kind": "ask",
        "prompt": "If a cell has hundreds of origins that each need to fire once and only once, what would go wrong if an origin were allowed to re-fire later in the same S phase?",
        "reveal": "Re-firing an origin would duplicate the same DNA segment twice in one cycle, leaving that region over-represented while the rest of the genome sits at the normal two copies. This unbalanced gene dosage is dangerous and can drive genomic instability. So the cell needs a hard rule: an origin fires once, then stays shut until the next cycle.",
        "choices": [
          "The surplus copies are quietly detected and discarded by the cell automatically",
          "That region ends up skipped over entirely and is never copied at all",
          "The whole chromosome finishes replicating noticeably faster, with no real downside",
          "That region gets copied twice, giving the cell unbalanced extra gene copies"
        ],
        "answer": 3
      },
      {
        "kind": "teach",
        "body": "Cells enforce the once-per-cycle rule through <b>licensing</b>. In G1, before DNA synthesis begins, the <b>origin-recognition complex (ORC)</b> marks each origin and helps load the <b>MCM2-7 helicase</b> onto the DNA — like issuing a one-time permit. When S phase arrives, the helicase activates and the origin fires. Crucially, once an origin has fired, <b>re-licensing is blocked</b> for the rest of the cycle, so no origin can be reloaded until the cell resets in the next G1."
      },
      {
        "kind": "teach",
        "body": "Now back to the ends. DNA polymerase has two unbreakable habits: it can only <b>build in the 5' to 3' direction</b>, and it cannot start from scratch — it needs an <b>RNA primer</b> to begin. On the lagging strand, synthesis happens in short pieces, each kicked off by its own primer. When those RNA primers are later removed, DNA fills the gaps... except for the primer at the very <b>5' end</b> of a new strand, where there is no upstream DNA to extend from."
      },
      {
        "kind": "ask",
        "prompt": "The terminal RNA primer at the 5' end of a newly made lagging strand gets removed, leaving a gap. Why can't DNA polymerase just fill that gap the way it fills the others?",
        "reveal": "Every interior gap gets filled because polymerase extends from the 3' end of the neighboring fragment into the gap. But the terminal gap sits at the chromosome's very tip — there is no fragment beyond it to supply a 3' end to build from. With nothing to extend, the gap stays empty. This is the <b>end-replication problem</b>: each round of copying leaves the new strand a little shorter.",
        "choices": [
          "DNA polymerase simply runs out of free nucleotides at the chromosome end",
          "Helicase has already departed, so the strand is sealed shut beforehand",
          "The terminal gap is far too small for the cell to ever detect",
          "There is no upstream 3' end at the tip for polymerase to extend from"
        ],
        "answer": 3
      },
      {
        "kind": "teach",
        "body": "Left unchecked, this means chromosomes would shrink a bit with every division, eventually eating into essential genes. Eukaryotes buffer against this with <b>telomeres</b> — long stretches of repetitive, G-rich sequence capping each chromosome end. Telomeres hold no protein-coding genes, so they act as a sacrificial fuse: the cell can afford to lose a little telomere each cycle. But a fuse only buys time; something has to rebuild it."
      },
      {
        "kind": "teach",
        "body": "Enter <b>telomerase</b>, a <b>ribonucleoprotein</b> — part protein, part RNA. Its trick is that it carries its <b>own RNA template</b> built right in. Telomerase uses that internal template to extend the <b>G-rich strand</b> outward, adding fresh repeats to the chromosome tip. The lengthened overhang then gives the ordinary lagging-strand machinery enough room to lay down a primer and fill in, so the chromosome no longer net-shortens."
      },
      {
        "kind": "ask",
        "prompt": "Telomerase is unusual among the enzymes of replication. What single feature most directly lets it solve the end problem?",
        "reveal": "Ordinary polymerases must read an existing DNA template — and that's exactly what runs out at the chromosome end. Telomerase sidesteps this by hauling its own short RNA template, so it can keep dictating and adding the telomeric repeat even where no template DNA remains. That self-contained template is what makes it a specialized reverse transcriptase for the ends. (It still works off the chromosome's existing 3' overhang, so it isn't primer-free.)",
        "choices": [
          "It synthesizes DNA strictly in the unusual 3' to 5' direction here",
          "It strips the telomeres away so the chromosome end can fully reset",
          "It copies DNA freely, needing no primer or existing 3' end at all",
          "It carries its own internal RNA template that dictates the repeat"
        ],
        "answer": 3
      },
      {
        "kind": "teach",
        "body": "Telomerase isn't running everywhere. It is robustly active in <b>germ cells and stem cells</b>, which must preserve full-length chromosomes across generations and through many divisions. Most ordinary <b>somatic cells</b> keep it low or off, so their telomeres gradually erode — a process tied to <b>cellular aging</b> and to the limited number of times such cells can divide. Tellingly, the large majority of <b>cancers (around 85-90%)</b> switch telomerase back on, granting tumor cells the unlimited division that healthy somatic cells lack."
      },
      {
        "kind": "checkpoint",
        "q": "A researcher has a somatic cell line whose chromosomes shorten with each division until the cells stop dividing. They then engineer the cells to express active telomerase. What is the most likely result?",
        "options": [
          "Chromosomes keep shortening at the same rate, since telomerase acts elsewhere",
          "Origins abruptly stop firing, halting all genome replication outright",
          "Telomere length holds steady, and the cells divide well past their old limit",
          "Every chromosome is copied twice per cycle, doubling its gene dosage"
        ],
        "answer": 2,
        "explain": "The shortening came from the end-replication problem with no enzyme rebuilding the tips. Supplying active telomerase restores the ability to add telomeric repeats, maintaining length and lifting the shortening-based brake on division — exactly how it extends replicative lifespan and why reactivating it is common in cancer. Origin firing and copy number per cycle are unrelated to this fix."
      },
      {
        "kind": "checkpoint",
        "q": "Which statement correctly pairs a mechanism with the problem it solves in eukaryotic replication?",
        "options": [
          "Telomerase is the factor that restricts each origin to one single firing per cell cycle",
          "Licensing caps each origin at one firing per cycle; telomerase counters end-shortening",
          "Both licensing and telomerase exist chiefly to speed up the overall replication run here",
          "Licensing by ORC and MCM2-7 fills the terminal gap left after primer removal at the tip"
        ],
        "answer": 1,
        "explain": "These are two separate challenges with two separate fixes. Loading the helicase in G1 and then blocking re-licensing keeps every origin to a single firing per cycle, preventing over- or under-replication. Telomerase instead addresses the unavoidable gap at the tips of linear DNA, adding repeats so chromosomes don't progressively erode. Conflating them confuses origin control with end maintenance."
      }
    ]
  },
  {
    "id": "l-recomb",
    "chapter": 9,
    "topic": "ch9-recombination",
    "title": "Crossing Over Up Close",
    "blurb": "Peek inside meiosis to see how two chromosomes physically swap DNA — and why not a single letter of the genetic code gets lost in the trade.",
    "steps": [
      {
        "kind": "teach",
        "body": "You already know that crossing over shuffles alleles and lets us build genetic maps. But how do two enormous DNA molecules actually <b>trade pieces</b> without dropping or duplicating any information? The answer is a precise molecular cut-and-paste called <b>homologous recombination</b> — the same machinery your cells use to repair broken DNA. In this lesson we'll watch it happen one strand at a time."
      },
      {
        "kind": "teach",
        "body": "Recombination begins when two <b>homologous duplexes</b> (matching chromosomes, one inherited from each parent) line up side by side. Single strands from the two homologs base-pair with each other, creating a stretch of <b>heteroduplex DNA</b> — a double helix whose two strands come from <i>different</i> chromosomes. Because the homologs share nearly the same sequence, these paired strands fit together almost perfectly, which is exactly why homology is required."
      },
      {
        "kind": "ask",
        "prompt": "Heteroduplex DNA means one strand came from each homolog. Why does the cell get away with pairing strands from two different chromosomes — what makes that even possible?",
        "reveal": "Homologs carry the same genes in the same order, so their sequences are almost identical. That near-identity is what lets a strand from one chromosome form a stable, complementary double helix with a strand from the other. This is why recombination is called <b>homologous</b> — without matching sequence, the strands couldn't pair and the whole process would fail.",
        "choices": [
          "The homologs carry nearly identical sequences, so the strands are complementary enough to base-pair",
          "Special repair enzymes rewrite one strand to match the other strand just before the two of them pair",
          "A protein scaffold on the chromosome clamps the two strands together, so base pairing is not needed",
          "Any DNA strand will base-pair with any other strand no matter how different their sequences are"
        ],
        "answer": 0
      },
      {
        "kind": "teach",
        "body": "Where the strands cross from one duplex to the other, they form an X-shaped structure called a <b>Holliday junction</b> — the physical crossover point. This junction isn't locked in place: it can slide along the paired DNA, swapping which base pairs belong to the heteroduplex. This sliding is called <b>branch migration</b>, and it lengthens the region where the two homologs have exchanged strands."
      },
      {
        "kind": "ask",
        "prompt": "A Holliday junction is eventually cut apart ('resolved') to separate the two chromosomes, and there are two different orientations in which those cuts can be made. Why should the cell care which orientation it uses — both of them do separate the DNA, after all?",
        "reveal": "Here's the punchline of recombination: the <i>orientation</i> of the cuts decides the outcome. Resolving the junction one way leaves the flanking DNA in its original arrangement — a <b>noncrossover</b> product. Cutting the other way reciprocally exchanges the flanking arms — a <b>crossover</b> product, where each chromosome now carries a chunk of its partner. Same junction, two cutting choices, two genetically different results."
      },
      {
        "kind": "teach",
        "body": "So how does this all get started in meiosis? The favored explanation is the <b>double-strand-break model</b>. A protein called <b>Spo11</b> deliberately cuts <i>both</i> strands of one chromosome at a single site. The broken ends are trimmed back (resected) to leave overhanging <b>3' single strands</b>, one of which invades the intact homolog and pairs with it. New DNA synthesis then copies the homolog as a template, and the process can build <i>two</i> Holliday junctions that are later resolved into crossover or noncrossover products."
      },
      {
        "kind": "checkpoint",
        "q": "In the double-strand-break model of meiotic recombination, what is the role of the protein Spo11?",
        "options": [
          "It makes the initiating double-strand break, cutting both strands of one duplex",
          "It proofreads the freshly made DNA so none of the original parental sequence is altered",
          "It physically hauls the paired homologous chromosomes apart toward the spindle poles",
          "It seals up the two Holliday junctions at the very end to finish off the strand exchange"
        ],
        "answer": 0,
        "explain": "Spo11 is the trigger of the whole process: it deliberately breaks both strands of one duplex, creating the double-strand break that then gets resected to 3' single strands. Those single strands invade the homolog, set up the Holliday junctions, and the rest of recombination follows from there."
      },
      {
        "kind": "checkpoint",
        "q": "After a crossover finishes, why is no genetic information lost or gained — even though both strands of one chromosome were cut?",
        "options": [
          "The cell simply deletes whatever extra stretch of DNA shows up, keeping the totals balanced",
          "The intact homolog acts as a template, so each gap is filled by copying matching sequence",
          "Missing bases get swapped for random nucleotides that average out across many daughter cells",
          "Crossing over only shuffles bound proteins around and never moves any actual DNA sequence"
        ],
        "answer": 1,
        "explain": "Recombination is conservative because it's homology-guided. When the ends are resected and gaps appear, DNA synthesis copies the undamaged homolog — which carries the same genes — so every base that's removed is rebuilt from a matching template. The chromosomes swap which parental alleles they carry, but the total genetic content is fully preserved."
      }
    ]
  }
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
          const right = pick === step.answer;
          reveal.classList.add(right ? 'right' : 'wrong');
          reveal.insertAdjacentHTML('afterbegin', `<p class="gen-ask-verdict"><b>${right ? 'Correct.' : 'Not quite.'}</b></p>`);
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
