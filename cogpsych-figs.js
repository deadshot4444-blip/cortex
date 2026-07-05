/* ============================================================================
   Cortex · Cognitive Psychology interactive figures (Chapter 2)
   Original, textbook-fidelity interactive SVG diagrams. Registry: window.COG_FIGS.
   Each figure: COG_FIGS[id](hostEl) -> mounts an interactive figure into hostEl.
   Loaded after cogpsych.js. No external assets; all inline SVG. Reuses the shared
   .gen-fig* / .gen-fig-toggle / .gen-fig-step styling so it matches the Genetics look.

   A bank item references a figure via its `fig` field (must be a key here); the
   runner mounts it above the question stem. Missing keys degrade gracefully.
   ========================================================================= */
(function () {
  'use strict';
  function el(h) { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstChild; }

  /* ---------- shared palette + defs ---------- */
  const C = {
    ink: '#2b3245', dim: '#6b6b76', line: '#c3c8d2', track: '#d7dbe3',
    blue: '#3f5fa8', blueL: '#6f8fd6', green: '#1f8f5f', greenL: '#4cc088',
    red: '#c0392b', amber: '#c78a1f', amberL: '#f2c14e', purple: '#6e4488', purpleL: '#9c6cb8',
  };
  const DEFS = `<defs>
    <linearGradient id="cgBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f8fd6"/><stop offset="1" stop-color="#3f5fa8"/></linearGradient>
    <linearGradient id="cgGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fd39a"/><stop offset="1" stop-color="#1f8f5f"/></linearGradient>
    <linearGradient id="cgAmber" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2c14e"/><stop offset="1" stop-color="#c78a1f"/></linearGradient>
    <linearGradient id="cgPurple" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9a3d8"/><stop offset="1" stop-color="#6e4488"/></linearGradient>
    <linearGradient id="cgGray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe2e8"/><stop offset="1" stop-color="#c3c8d2"/></linearGradient>
    <filter id="cgsh" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="1.4" stdDeviation="1.6" flood-color="#243049" flood-opacity=".24"/></filter>
    <marker id="cgArr" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto"><path d="M0,1 L8,5 L0,9 Z" fill="#3f5fa8"/></marker>
    <marker id="cgArrG" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto"><path d="M0,1 L8,5 L0,9 Z" fill="#1f8f5f"/></marker>
    <marker id="cgArrD" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto"><path d="M0,1 L8,5 L0,9 Z" fill="#6b6b76"/></marker>
  </defs>`;

  const F = 'font-family:var(--sans,system-ui,sans-serif)';
  const M = 'font-family:var(--mono,ui-monospace,monospace)';
  function svgOpen(W, H, label) { return `<svg viewBox="0 0 ${W} ${H}" class="gen-fig-svg" role="img" aria-label="${label}">${DEFS}`; }
  function txt(x, y, s, o) { o = o || {}; return `<text x="${x}" y="${y}" text-anchor="${o.anchor || 'middle'}" fill="${o.fill || C.ink}" style="${o.mono ? M : F};font-weight:${o.w || 600};font-size:${o.size || 12}px">${s}</text>`; }
  function box(x, y, w, h, label, o) {
    o = o || {}; const r = o.r != null ? o.r : 8;
    let s = `<g filter="url(#cgsh)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${o.fill || 'url(#cgBlue)'}"/>`;
    s += `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${Math.max(4, h * 0.28)}" rx="${Math.max(2, r - 2)}" fill="#fff" opacity=".16"/></g>`;
    if (label != null) s += txt(x + w / 2, y + h / 2 + 4.5, label, { fill: o.textFill || '#fff', w: 700, size: o.size || 12 });
    return s;
  }
  function arrow(x1, y1, x2, y2, kind) {
    const m = kind === 'g' ? 'cgArrG' : kind === 'd' ? 'cgArrD' : 'cgArr';
    const col = kind === 'g' ? C.green : kind === 'd' ? C.dim : C.blue;
    const dash = kind === 'd' ? ' stroke-dasharray="4 4"' : '';
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2.6" stroke-linecap="round"${dash} marker-end="url(#${m})"/>`;
  }
  function makeFig(host) {
    const wrap = el('<div class="gen-fig"></div>');
    const svgHost = el('<div class="gen-fig-svgwrap"></div>'); wrap.appendChild(svgHost);
    const ctrls = el('<div class="gen-fig-ctrls"></div>'); wrap.appendChild(ctrls);
    const status = el('<div class="gen-fig-status"></div>'); wrap.appendChild(status);
    const note = el('<div class="gen-fig-note"></div>'); wrap.appendChild(note);
    host.appendChild(wrap);
    return { wrap, svgHost, ctrls, status, note };
  }
  function toggle(label, on) { return el(`<button class="gen-fig-toggle${on ? ' on' : ''}"><span class="dot"></span>${label}</button>`); }
  function stepBtn(label) { return el(`<button class="gen-fig-step">${label}</button>`); }

  const COG_FIGS = {};

  /* ============ FIG: dualism vs physicalism (ch2-mind-brain) ============ */
  COG_FIGS.dualism = function (host) {
    const fig = makeFig(host); const state = { dualist: true };
    const W = 620, H = 210;
    function frame() {
      const d = state.dualist;
      let s = svgOpen(W, H, 'mind and body relationship');
      // body (brain) box
      s += box(70, 78, 150, 60, 'BODY / BRAIN', { fill: 'url(#cgBlue)' });
      s += txt(145, 158, 'physical · measurable', { fill: C.dim, size: 10 });
      // mind box
      s += box(400, 78, 150, 60, 'MIND', { fill: d ? 'url(#cgPurple)' : 'url(#cgGray)' });
      s += txt(475, 158, d ? 'non-physical substance' : '(just brain activity)', { fill: C.dim, size: 10 });
      if (d) {
        // two-way interaction arrows (Descartes interactionism)
        s += arrow(224, 98, 396, 98);
        s += arrow(396, 120, 224, 120);
        s += txt(310, 74, 'interact', { fill: C.purple, size: 10, w: 700 });
      } else {
        // physicalism: mind reduces to brain — one big arrow / identity
        s += `<line x1="224" y1="108" x2="396" y2="108" stroke="${C.green}" stroke-width="3" marker-end="url(#cgArrG)"/>`;
        s += txt(310, 96, 'mind = brain activity', { fill: C.green, size: 10, w: 700 });
      }
      s += `</svg>`; fig.svgHost.innerHTML = s;
      fig.status.textContent = d ? 'DUALISM — two kinds of substance' : 'PHYSICALISM (MONISM) — one kind';
      fig.status.className = 'gen-fig-status ' + (d ? 'off' : 'on');
      fig.note.textContent = d
        ? 'Dualism (Plato, Descartes) holds that mind and body are fundamentally different kinds of thing. Descartes proposed they interact — he even guessed the pineal gland as the meeting point.'
        : 'Physicalism/materialism (a form of monism) holds there is only physical reality: the mind just is the activity of the physical brain, and any sense of a separate non-physical mind is an illusion.';
      tD.classList.toggle('on', d); tP.classList.toggle('on', !d);
    }
    const tD = toggle('Dualism', true), tP = toggle('Physicalism', false);
    tD.addEventListener('click', () => { state.dualist = true; frame(); });
    tP.addEventListener('click', () => { state.dualist = false; frame(); });
    fig.ctrls.append(tD, tP); frame();
  };

  /* ============ FIG: nested levels / contexts (ch2-brain-behavior) ============ */
  COG_FIGS.levels = function (host) {
    const fig = makeFig(host); let step = 0; const N = 4;
    const W = 460, H = 300;
    const rings = [
      { w: 420, h: 260, label: 'WORLD', fill: '#eef1f6', tf: C.dim },
      { w: 320, h: 200, label: 'ENVIRONMENT / SOCIETY', fill: '#e2e8f4', tf: C.dim },
      { w: 220, h: 140, label: 'BODY', fill: '#cbd9f0', tf: C.blue },
      { w: 120, h: 80, label: 'BRAIN', fill: 'url(#cgBlue)', tf: '#fff' },
    ];
    function frame() {
      let s = svgOpen(W, H, 'nested levels of cognition');
      for (let i = 0; i <= step; i++) {
        const r = rings[i], x = (W - r.w) / 2, y = (H - r.h) / 2;
        s += `<rect x="${x}" y="${y}" width="${r.w}" height="${r.h}" rx="14" fill="${r.fill}" stroke="${C.line}" stroke-width="1.2" filter="url(#cgsh)"/>`;
        s += txt(W / 2, y + (i === 3 ? r.h / 2 + 5 : 20), r.label, { fill: r.tf, w: 700, size: i === 3 ? 13 : 11 });
      }
      s += `</svg>`; fig.svgHost.innerHTML = s;
      fig.status.textContent = 'LEVEL ' + (step + 1) + '/' + N + ' — ' + rings[step].label;
      fig.status.className = 'gen-fig-status on';
      const notes = [
        'Even a complete map of the brain would not explain cognition on its own — the brain is only the innermost level.',
        'The brain sits inside a body that supplies its senses and its ability to act.',
        'That body is embedded in an environment and society that set what the inputs and outputs are.',
        'And all of it sits inside the larger structures of the world. Each level must be studied in its own right — which is why behavior, not just neuroscience, is essential.',
      ];
      fig.note.textContent = notes[step];
    }
    const prev = stepBtn('‹ Back'), next = stepBtn('Zoom out ›');
    prev.addEventListener('click', () => { step = Math.max(0, step - 1); frame(); });
    next.addEventListener('click', () => { step = (step + 1) % N; frame(); });
    fig.ctrls.append(prev, next); frame();
  };

  /* ============ FIG: classical conditioning — Pavlov (ch2-behaviorism) ============ */
  COG_FIGS.classicalConditioning = function (host) {
    const fig = makeFig(host); let step = 0; const N = 4;
    const W = 520, H = 200;
    function dog(x, drool) { // simple stylized dog head
      let s = `<g filter="url(#cgsh)"><ellipse cx="${x}" cy="110" rx="26" ry="22" fill="url(#cgGray)"/><ellipse cx="${x - 20}" cy="96" rx="7" ry="12" fill="url(#cgGray)"/><ellipse cx="${x + 20}" cy="96" rx="7" ry="12" fill="url(#cgGray)"/><circle cx="${x - 8}" cy="106" r="2.4" fill="${C.ink}"/><circle cx="${x + 8}" cy="106" r="2.4" fill="${C.ink}"/><ellipse cx="${x}" cy="120" rx="6" ry="4" fill="${C.ink}"/></g>`;
      if (drool) s += `<path d="M${x - 4},126 q-2,10 -1,16" stroke="${C.blueL}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M${x + 4},126 q2,10 1,16" stroke="${C.blueL}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      return s;
    }
    function frame() {
      let s = svgOpen(W, H, 'classical conditioning');
      const food = (x) => `<g filter="url(#cgsh)"><rect x="${x - 14}" y="44" width="28" height="18" rx="4" fill="url(#cgAmber)"/><ellipse cx="${x}" cy="44" rx="14" ry="6" fill="${C.amberL}"/></g>` + txt(x, 34, 'food', { fill: C.amber, size: 10, w: 700 });
      const bell = (x) => `<g filter="url(#cgsh)"><path d="M${x - 14},60 Q${x},32 ${x + 14},60 Z" fill="url(#cgPurple)"/><circle cx="${x}" cy="64" r="3" fill="${C.purple}"/></g>` + txt(x, 26, 'bell', { fill: C.purple, size: 10, w: 700 });
      if (step === 0) {
        s += food(150); s += dog(360, true);
        s += arrow(178, 90, 330, 100);
      } else if (step === 1) {
        s += bell(150); s += dog(360, false);
        s += arrow(178, 90, 330, 100, 'd');
        s += txt(254, 150, 'no salivation', { fill: C.dim, size: 10 });
      } else if (step === 2) {
        s += food(120); s += bell(190); s += dog(390, true);
        s += arrow(214, 90, 356, 100);
        s += txt(150, 150, 'paired, repeatedly', { fill: C.dim, size: 10 });
      } else {
        s += bell(150); s += dog(360, true);
        s += arrow(178, 90, 330, 100);
      }
      s += `</svg>`; fig.svgHost.innerHTML = s;
      const labs = ['UNCONDITIONED: food → salivation', 'NEUTRAL: bell → nothing', 'PAIRING: bell + food → salivation', 'CONDITIONED: bell alone → salivation'];
      fig.status.textContent = labs[step]; fig.status.className = 'gen-fig-status on';
      const notes = [
        'An unconditioned stimulus (food) naturally triggers an unconditioned response (salivation) — no learning required.',
        'A neutral stimulus (a bell) produces no salivation on its own.',
        'The bell is repeatedly paired with the food across many trials.',
        'Now the bell alone triggers salivation — it has become a conditioned stimulus producing a conditioned response. This is classical conditioning (Pavlov, 1927); it needs no mental states.',
      ];
      fig.note.textContent = notes[step];
    }
    const prev = stepBtn('‹ Back'), next = stepBtn('Next step ›');
    prev.addEventListener('click', () => { step = Math.max(0, step - 1); frame(); });
    next.addEventListener('click', () => { step = (step + 1) % N; frame(); });
    fig.ctrls.append(prev, next); frame();
  };

  /* ============ FIG: operant conditioning — Skinner box (ch2-behaviorism) ============ */
  COG_FIGS.operantConditioning = function (host) {
    const fig = makeFig(host); const state = { reinforce: true };
    const W = 460, H = 240;
    function frame() {
      const rein = state.reinforce;
      let s = svgOpen(W, H, 'Skinner box');
      // chamber
      s += `<rect x="60" y="40" width="340" height="170" rx="10" fill="#f4f6fa" stroke="${C.line}" stroke-width="2"/>`;
      // lever
      s += `<rect x="80" y="150" width="54" height="10" rx="4" fill="url(#cgBlue)" filter="url(#cgsh)"/>`;
      s += txt(107, 178, 'lever', { fill: C.dim, size: 10 });
      // rat (stylized)
      s += `<g filter="url(#cgsh)"><ellipse cx="180" cy="176" rx="34" ry="20" fill="url(#cgGray)"/><circle cx="146" cy="170" r="11" fill="url(#cgGray)"/><path d="M214,180 q26,4 34,20" stroke="${C.line}" stroke-width="3" fill="none"/></g>`;
      // dispenser / grid
      if (rein) {
        s += `<rect x="330" y="52" width="40" height="30" rx="5" fill="url(#cgGreen)" filter="url(#cgsh)"/>`;
        s += txt(350, 72, 'food', { fill: '#fff', size: 10, w: 700 });
        s += `<circle cx="350" cy="120" r="4" fill="${C.green}"/><circle cx="350" cy="134" r="4" fill="${C.green}"/>`;
        s += txt(350, 200, 'reward', { fill: C.green, size: 10, w: 700 });
      } else {
        // electrified floor
        s += `<path d="M70,204 l14,-8 l14,8 l14,-8 l14,8 l14,-8 l14,8 l14,-8 l14,8 l14,-8 l14,8 l14,-8 l14,8 l14,-8 l14,8" stroke="${C.red}" stroke-width="2.4" fill="none"/>`;
        s += `<path d="M350,60 l-6,14 l10,0 l-8,16" stroke="${C.amberL}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
        s += txt(350, 200, 'shock', { fill: C.red, size: 10, w: 700 });
      }
      s += `</svg>`; fig.svgHost.innerHTML = s;
      fig.status.textContent = rein ? 'REINFORCEMENT — behavior increases' : 'PUNISHMENT — behavior decreases';
      fig.status.className = 'gen-fig-status ' + (rein ? 'on' : 'off');
      fig.note.textContent = rein
        ? 'Skinner’s operant conditioning shapes voluntary behavior by its consequences. Pressing the lever delivers food (reinforcement), so the rat presses it more — reinforcement learning.'
        : 'When the lever press instead delivers an aversive outcome (a shock = punishment), the behavior decreases. Skinner claimed all behavior could be explained by classical + operant conditioning.';
      tR.classList.toggle('on', rein); tP.classList.toggle('on', !rein);
    }
    const tR = toggle('Reinforcement', true), tP = toggle('Punishment', false);
    tR.addEventListener('click', () => { state.reinforce = true; frame(); });
    tP.addEventListener('click', () => { state.reinforce = false; frame(); });
    fig.ctrls.append(tR, tP); frame();
  };

  /* ============ FIG: Tolman's maze / latent learning (ch2-behaviorism) ============ */
  COG_FIGS.tolmanMaze = function (host) {
    const fig = makeFig(host); const state = { explored: true };
    const W = 420, H = 240;
    // simple T-maze: start at bottom or new side; food at top-right
    function frame() {
      const exp = state.explored;
      let s = svgOpen(W, H, 'Tolman maze latent learning');
      // maze corridors (a plus/T shape)
      const wall = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#e8ecf3" stroke="${C.line}" stroke-width="1.5"/>`;
      s += wall(180, 40, 60, 160);          // vertical corridor
      s += wall(80, 60, 260, 40);           // horizontal top corridor
      // food (top-right)
      s += `<circle cx="315" cy="80" r="12" fill="url(#cgAmber)" filter="url(#cgsh)"/>` + txt(315, 84, '🍒', { size: 12 });
      s += txt(315, 116, 'food', { fill: C.amber, size: 10, w: 700 });
      // start marker
      const startX = 210, startY = 190;
      s += `<circle cx="${startX}" cy="${startY}" r="9" fill="url(#cgBlue)"/>` + txt(startX, 214, 'start', { fill: C.blue, size: 10, w: 700 });
      // trained path (learned turn = right) shown faint
      s += `<path d="M210,182 V80 H303" stroke="${C.line}" stroke-width="3" fill="none" stroke-dasharray="3 4"/>`;
      // the test path from a NEW start point
      const nsX = 100, nsY = 80;
      s += `<circle cx="${nsX}" cy="${nsY}" r="9" fill="url(#cgPurple)"/>` + txt(nsX, 44, 'new start', { fill: C.purple, size: 10, w: 700 });
      if (exp) {
        // rat that explored takes the correct novel turn (toward food)
        s += `<path d="M110,80 H303" stroke="${C.green}" stroke-width="3.4" fill="none" marker-end="url(#cgArrG)"/>`;
        s += txt(200, 150, 'turns toward the food (novel route)', { fill: C.green, size: 10, w: 700 });
      } else {
        // rat that only learned "turn right" goes the wrong way
        s += `<path d="M100,90 V150" stroke="${C.red}" stroke-width="3.4" fill="none" marker-end="url(#cgArr)"/>`;
        s += txt(200, 170, 'repeats the trained turn → wrong way', { fill: C.red, size: 10, w: 700 });
      }
      s += `</svg>`; fig.svgHost.innerHTML = s;
      fig.status.textContent = exp ? 'EXPLORED FIRST — cognitive map' : 'NO EXPLORATION — habit only';
      fig.status.className = 'gen-fig-status ' + (exp ? 'on' : 'off');
      fig.note.textContent = exp
        ? 'Rats allowed to freely explore the maze BEFORE any reward later took a novel shortcut to the food from a new start point. Tolman argued they had built an internal "cognitive map" — latent learning that pure stimulus-response can’t explain.'
        : 'A rat that only ever learned a rewarded turn ("go right") blindly repeats it from the new start and misses the food. Behaviorism predicts exactly this — but it is not what the explorers did.';
      tE.classList.toggle('on', exp); tN.classList.toggle('on', !exp);
    }
    const tE = toggle('Explored first', true), tN = toggle('Trained only', false);
    tE.addEventListener('click', () => { state.explored = true; frame(); });
    tN.addEventListener('click', () => { state.explored = false; frame(); });
    fig.ctrls.append(tE, tN); frame();
  };

  /* ============ FIG: behaviorist black box (ch2-behaviorism) ============ */
  COG_FIGS.blackBox = function (host) {
    const fig = makeFig(host); const state = { open: false };
    const W = 520, H = 190;
    function frame() {
      const open = state.open;
      let s = svgOpen(W, H, 'stimulus response black box');
      s += box(40, 78, 110, 54, 'STIMULUS', { fill: 'url(#cgAmber)' });
      s += txt(95, 150, 'observable', { fill: C.dim, size: 10 });
      s += box(370, 78, 110, 54, 'RESPONSE', { fill: 'url(#cgBlue)' });
      s += txt(425, 150, 'observable', { fill: C.dim, size: 10 });
      // middle box
      if (open) {
        s += `<rect x="196" y="66" width="128" height="78" rx="10" fill="#eef1f6" stroke="${C.blue}" stroke-width="2" filter="url(#cgsh)"/>`;
        s += txt(260, 92, 'mental processes', { fill: C.blue, size: 10.5, w: 700 });
        s += txt(260, 110, 'memory · attention', { fill: C.dim, size: 9.5 });
        s += txt(260, 124, 'reasoning · maps', { fill: C.dim, size: 9.5 });
      } else {
        s += `<rect x="196" y="66" width="128" height="78" rx="10" fill="${C.ink}" filter="url(#cgsh)"/>`;
        s += txt(260, 104, '?', { fill: '#fff', size: 30, w: 800 });
        s += txt(260, 128, 'black box', { fill: '#c9cdd6', size: 9.5 });
      }
      s += arrow(152, 105, 194, 105);
      s += arrow(326, 105, 368, 105);
      s += `</svg>`; fig.svgHost.innerHTML = s;
      fig.status.textContent = open ? 'COGNITIVE VIEW — open the box' : 'BEHAVIORIST VIEW — box stays shut';
      fig.status.className = 'gen-fig-status ' + (open ? 'on' : 'off');
      fig.note.textContent = open
        ? 'The cognitive approach reopens the box: we still measure observable behavior, but use it to INFER the internal mental processes (memory, attention, reasoning) that turn a stimulus into a response.'
        : 'Behaviorism (Watson) studied only the observable stimulus and response, treating everything in between — the mind and brain — as a "black box" not worth (or not possible) to analyze.';
      tB.classList.toggle('on', !open); tC.classList.toggle('on', open);
    }
    const tB = toggle('Behaviorist', true), tC = toggle('Cognitive', false);
    tB.addEventListener('click', () => { state.open = false; frame(); });
    tC.addEventListener('click', () => { state.open = true; frame(); });
    fig.ctrls.append(tB, tC); frame();
  };

  /* ============ FIG: function = input→output mapping (ch2-cognitive-revolution) ============ */
  COG_FIGS.functionMap = function (host) {
    const fig = makeFig(host); let idx = 0;
    const EGS = [
      { in: '2, 3, 6', f: 'addition', out: '11', note: 'The addition function maps a set of numbers to their sum.' },
      { in: '7', f: 'even?', out: '0', note: 'An "even number" function maps an integer to 1 (even) or 0 (odd). 7 is odd → 0.' },
      { in: '🐱 image', f: 'classifier', out: '"cat"', note: 'A function can map a digital image (a big matrix of numbers) to a label — object recognition.' },
      { in: 'sensory input', f: 'the brain', out: 'behavior', note: 'The cognitive revolution’s big idea: cognition itself is a function — sensory input → the brain’s computation → behavior. The goal is to find the algorithm.' },
    ];
    const W = 380, H = 240;
    function frame() {
      const e = EGS[idx];
      let s = svgOpen(W, H, 'function input to output');
      // input
      s += box(120, 20, 140, 40, e.in, { fill: 'url(#cgAmber)', size: 12.5 });
      s += txt(190, 78, 'input', { fill: C.dim, size: 10 });
      // funnel → f
      s += `<path d="M120,96 L260,96 L214,150 L166,150 Z" fill="url(#cgBlue)" filter="url(#cgsh)"/>`;
      s += txt(190, 128, 'f = ' + e.f, { fill: '#fff', size: 13, w: 700 });
      // arrows
      s += arrow(190, 62, 190, 92);
      s += `<line x1="190" y1="150" x2="190" y2="184" stroke="${C.blue}" stroke-width="2.6" marker-end="url(#cgArr)"/>`;
      // output
      s += box(120, 186, 140, 40, e.out, { fill: 'url(#cgGreen)', size: 12.5 });
      s += `</svg>`; fig.svgHost.innerHTML = s;
      fig.status.textContent = `EXAMPLE ${idx + 1}/${EGS.length} — f(${e.in}) = ${e.out}`;
      fig.status.className = 'gen-fig-status on';
      fig.note.textContent = e.note;
    }
    const prev = stepBtn('‹ Prev'), next = stepBtn('Next example ›');
    prev.addEventListener('click', () => { idx = (idx - 1 + EGS.length) % EGS.length; frame(); });
    next.addEventListener('click', () => { idx = (idx + 1) % EGS.length; frame(); });
    fig.ctrls.append(prev, next); frame();
  };

  /* ============ FIG: Donders' three conditions + RT (ch2-cognitive-approach) ============ */
  COG_FIGS.donders = function (host) {
    const fig = makeFig(host); let idx = 0;
    const COND = [
      { name: 'Detection', rt: 0.34, procs: ['detect'], desc: 'Simple RT: one stimulus, one response — just detect the light and press. Fastest.' },
      { name: 'Discrimination (go/no-go)', rt: 0.62, procs: ['detect', 'discriminate'], desc: 'Two stimuli, respond to one only. Adds a discrimination stage → slower than detection.' },
      { name: 'Choice', rt: 1.0, procs: ['detect', 'discriminate', 'choose'], desc: 'Two stimuli, two responses. Adds a choice stage → slowest. RT differences reveal hidden mental steps.' },
    ];
    const W = 460, H = 220;
    function frame() {
      const c = COND[idx];
      let s = svgOpen(W, H, 'Donders reaction time conditions');
      // stage boxes
      const stages = ['detect', 'discriminate', 'choose'];
      const coly = 40;
      stages.forEach((st, i) => {
        const x = 40 + i * 140, on = c.procs.includes(st);
        s += box(x, coly, 120, 44, st, { fill: on ? 'url(#cgBlue)' : 'url(#cgGray)', textFill: on ? '#fff' : C.dim, size: 11 });
        if (i < 2) s += arrow(x + 120, coly + 22, x + 140, coly + 22, on && c.procs.includes(stages[i + 1]) ? '' : 'd');
      });
      // RT bar
      const bx = 40, bw = 380, by = 150;
      s += `<rect x="${bx}" y="${by}" width="${bw}" height="20" rx="10" fill="${C.track}"/>`;
      s += `<rect x="${bx}" y="${by}" width="${Math.round(bw * c.rt)}" height="20" rx="10" fill="url(#cgGreen)"/>`;
      s += txt(bx, by - 8, 'reaction time', { anchor: 'start', fill: C.dim, size: 10 });
      s += txt(bx + bw, by - 8, (c.rt).toFixed(2) + ' (relative)', { anchor: 'end', fill: C.green, size: 10, w: 700, mono: true });
      s += `</svg>`; fig.svgHost.innerHTML = s;
      fig.status.textContent = `${idx + 1}/3 — ${c.name}`; fig.status.className = 'gen-fig-status on';
      fig.note.textContent = c.desc;
    }
    const prev = stepBtn('‹ Back'), next = stepBtn('Next condition ›');
    prev.addEventListener('click', () => { idx = (idx - 1 + COND.length) % COND.length; frame(); });
    next.addEventListener('click', () => { idx = (idx + 1) % COND.length; frame(); });
    fig.ctrls.append(prev, next); frame();
  };

  /* ============ FIG: Stroop effect — interactive (ch2-cognitive-approach) ============ */
  COG_FIGS.stroop = function (host) {
    const fig = makeFig(host); const state = { incongruent: true };
    const W = 460, H = 170;
    const cols = { red: '#c0392b', blue: '#2f6fd0', green: '#1f8f5f', amber: '#c78a1f', purple: '#7a4fb0' };
    const names = ['RED', 'BLUE', 'GREEN', 'AMBER'];
    const inkOrder = ['green', 'amber', 'red', 'blue'];   // ink colors used
    function frame() {
      const inc = state.incongruent;
      let s = svgOpen(W, H, 'Stroop effect');
      for (let i = 0; i < 4; i++) {
        const x = 70 + i * 100, ink = cols[inkOrder[i]];
        if (inc) {
          // color WORD printed in a different ink
          s += txt(x, 90, names[i], { fill: ink, w: 800, size: 22 });
        } else {
          // neutral: colored circle
          s += `<circle cx="${x}" cy="82" r="16" fill="${ink}"/>`;
        }
      }
      s += txt(W / 2, 140, inc ? 'name the INK color (ignore the word)' : 'name the color of each circle', { fill: C.dim, size: 11 });
      s += `</svg>`; fig.svgHost.innerHTML = s;
      fig.status.textContent = inc ? 'INCONGRUENT — slow & error-prone' : 'CONGRUENT / NEUTRAL — fast';
      fig.status.className = 'gen-fig-status ' + (inc ? 'off' : 'on');
      fig.note.textContent = inc
        ? 'Naming the ink color of a mismatched color word is hard — the automatic reading of the word interferes. This is the Stroop effect (Stroop, 1935), a classic phenomenon-driven finding discovered, not predicted.'
        : 'Naming the color of plain circles is quick and easy — there is no conflicting word to suppress. Compare your speed to the incongruent version.';
      tI.classList.toggle('on', inc); tC.classList.toggle('on', !inc);
    }
    const tI = toggle('Color words', true), tC = toggle('Plain circles', false);
    tI.addEventListener('click', () => { state.incongruent = true; frame(); });
    tC.addEventListener('click', () => { state.incongruent = false; frame(); });
    fig.ctrls.append(tI, tC); frame();
  };

  /* ============ FIG: information-processing flowchart (ch2-cognitive-revolution) ============ */
  COG_FIGS.infoProcessing = function (host) {
    const fig = makeFig(host); let step = 0;
    const STAGES = [
      { label: 'sensory input', note: 'Information enters as raw sensory input — the input to the system.' },
      { label: 'sensory\nprocessing', note: 'Early stages register and encode the signal (much of it outside awareness).' },
      { label: 'perception /\nrecognition', note: 'The signal is interpreted and recognized.' },
      { label: 'decision', note: 'A choice or judgment is computed from the processed information.' },
      { label: 'response', note: 'A behavior is produced — the output. Boxes are computational STAGES, not brain areas.' },
    ];
    const W = 520, H = 150;
    function frame() {
      let s = svgOpen(W, H, 'information processing stages');
      const n = STAGES.length, bw = 86, gap = (W - 20 - n * bw) / (n - 1), y = 50, h = 50;
      for (let i = 0; i < n; i++) {
        const x = 10 + i * (bw + gap), active = i <= step;
        const lines = STAGES[i].label.split('\n');
        s += box(x, y, bw, h, null, { fill: active ? 'url(#cgBlue)' : 'url(#cgGray)', r: 7 });
        lines.forEach((ln, k) => s += txt(x + bw / 2, y + h / 2 + 4 - (lines.length - 1) * 6 + k * 12, ln, { fill: active ? '#fff' : C.dim, w: 700, size: 10 }));
        if (i < n - 1) s += arrow(x + bw, y + h / 2, x + bw + gap, y + h / 2, i < step ? '' : 'd');
      }
      s += `</svg>`; fig.svgHost.innerHTML = s;
      fig.status.textContent = `STAGE ${step + 1}/${STAGES.length}`; fig.status.className = 'gen-fig-status on';
      fig.note.textContent = STAGES[step].note;
    }
    const prev = stepBtn('‹ Back'), next = stepBtn('Next stage ›');
    prev.addEventListener('click', () => { step = Math.max(0, step - 1); frame(); });
    next.addEventListener('click', () => { step = (step + 1) % STAGES.length; frame(); });
    fig.ctrls.append(prev, next); frame();
  };

  window.COG_FIGS = COG_FIGS;
})();
