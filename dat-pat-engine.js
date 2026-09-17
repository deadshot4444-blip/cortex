/* DAT Perceptual Ability generators: all six ADA subtests — apertures, view recognition, angle
   ranking, paper folding, cube counting and pattern folding. Pure UMD: no DOM, no storage, no
   app globals — the browser gets window.DatPatCore, Node gets module.exports, and
   scripts/test-dat-pat.cjs drives it headless. Every item is a pure function of (subtest, seed,
   level) and its id carries that triple, so fromId(id) rebuilds it exactly; that is what lets
   the mistake log, the resume blob and the rehearsal forms store the triple instead of SVG
   (DESIGN §3e, §9 risk 5). render() rebuilds every figure from params, so a stripped record
   still draws.

   Validity rules come from RESEARCH §4.1-§4.6, one section per subtest; the ADA's own
   constraints are marked [ADA] where they are enforced. No ADA, vendor or forum figure is
   reproduced — every drawing is generated here from scratch.

   45° folds, deferred out of wave 1, are in. The objection then was sound: on a plain square
   lattice a diagonal crease halves every cell it crosses, and a half-covered cell destroys the
   [ADA] "holes = paper thicknesses" invariant this file proves in verify(). The paper-folding
   lattice now quarters each sub-cell along BOTH its diagonals, so a 45° crease runs along piece
   edges instead of through them and every piece still lies wholly on one side of every fold.
   Diagonals are level ≥ 2, as DESIGN §6 asks. */
(function (root) {
  /* ---------- subtests and levels ---------- */
  // options/category mirror data/dat-outline.json patSubtests; the outline stays the source
  // of truth for the UI, this table only keeps the engine self-contained for Node tests.
  const SUBTESTS = [
    { id: 'keyholes', category: 'PAT-KEY', options: 5, built: true },
    { id: 'tfe', category: 'PAT-TFE', options: 4, built: true },
    { id: 'angles', category: 'PAT-ANG', options: 4, built: true },
    { id: 'holes', category: 'PAT-HOLE', options: 5, built: true },
    { id: 'cubes', category: 'PAT-CUBE', options: 5, built: true },
    { id: 'patterns', category: 'PAT-FOLD', options: 4, built: true },
  ];
  const BUILT = SUBTESTS.filter(s => s.built).map(s => s.id);
  const LEVELS = { 1: 'Warm-up', 2: 'Test-like', 3: 'Harder than test' };
  const ID_RE = /^pat-([a-z]+)-s(\d+)-l([123])$/;

  function subtestSpec(id) {
    return SUBTESTS.find(s => s.id === id) || null;
  }
  function isBuilt(id) {
    return BUILT.includes(id);
  }
  function optionsFor(id) {
    return subtestSpec(id)?.options ?? 5;
  }
  // A level outside 1-3 clamps to the nearest valid level, so a link that claims level 9 serves
  // the hardest set rather than quietly dropping to the middle one. Only a missing or
  // non-numeric level falls back to 2.
  function levelOf(level) {
    if (level == null || level === '') return 2;
    const n = Number(level);
    if (!Number.isFinite(n)) return 2;
    return Math.min(3, Math.max(1, Math.round(n)));
  }

  /* ---------- deterministic randomness ---------- */
  function mulberry32(a) {
    let t = a >>> 0;
    return function () {
      t = (t + 0x6d2b79f5) >>> 0;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function rngFor(subtest, seed, level, salt) {
    return mulberry32(hash(subtest + ':' + seed + ':' + level + ':' + (salt || '')));
  }
  function int(rng, lo, hi) {
    return lo + Math.floor(rng() * (hi - lo + 1));
  }
  function pick(rng, list) {
    return list[Math.floor(rng() * list.length)];
  }
  function shuffled(rng, list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  function round(value, places) {
    const f = Math.pow(10, places);
    return Math.round(value * f) / f;
  }

  /* ---------- ids ---------- */
  function itemId(subtest, seed, level) {
    return 'pat-' + subtest + '-s' + seed + '-l' + level;
  }
  function parseId(id) {
    const m = ID_RE.exec(String(id == null ? '' : id));
    return m ? { subtest: m[1], seed: Number(m[2]), level: Number(m[3]) } : null;
  }

  /* ---------- SVG helpers ----------
     Only <svg> <g> <path> <polygon> <polyline> <line> <circle> <rect> <text> with numeric
     attributes, role="img" and aria-label. No scripts, no href, no external references
     (DESIGN §6). Figures stay under 640 units wide so they scale down to 320 px. */
  function esc(text) {
    return String(text).replace(/[&<>"']/g, c => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(value) {
    return String(round(value, 2));
  }
  function svgWrap(width, height, label, className, body) {
    return (
      '<svg viewBox="0 0 ' +
      num(width) +
      ' ' +
      num(height) +
      '" role="img" aria-label="' +
      esc(label) +
      '" class="' +
      esc(className) +
      '" preserveAspectRatio="xMidYMid meet">' +
      body +
      '</svg>'
    );
  }
  function rect(x, y, w, h, attrs) {
    return '<rect x="' + num(x) + '" y="' + num(y) + '" width="' + num(w) + '" height="' + num(h) + '" ' + attrs + '/>';
  }
  function line(x1, y1, x2, y2, attrs) {
    return '<line x1="' + num(x1) + '" y1="' + num(y1) + '" x2="' + num(x2) + '" y2="' + num(y2) + '" ' + attrs + '/>';
  }
  function circle(cx, cy, r, attrs) {
    return '<circle cx="' + num(cx) + '" cy="' + num(cy) + '" r="' + num(r) + '" ' + attrs + '/>';
  }
  function polygon(points, attrs) {
    return '<polygon points="' + points.map(p => num(p[0]) + ',' + num(p[1])).join(' ') + '" ' + attrs + '/>';
  }
  function polyline(points, attrs) {
    return '<polyline points="' + points.map(p => num(p[0]) + ',' + num(p[1])).join(' ') + '" ' + attrs + '/>';
  }
  function text(x, y, value, attrs) {
    return '<text x="' + num(x) + '" y="' + num(y) + '" ' + attrs + '>' + esc(value) + '</text>';
  }
  const INK = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"';
  const THIN = 'fill="none" stroke="currentColor" stroke-width="1"';
  const DASH = 'fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="3 3" opacity="0.55"';
  const PAPER = 'fill="currentColor" opacity="0.1" stroke="none"';
  // Cube faces are opaque line art, the way the exam draws them: a translucent face lets edges
  // from the far side of the solid ghost through and turns a counting item into a puzzle about
  // which lines are real. Front edges stay legible because every face carries its own stroke.
  const FACE = 'fill="#ffffff" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"';
  const LABEL = 'font-size="10" fill="currentColor" text-anchor="middle"';
  const TAG = 'font-size="11" fill="currentColor" font-weight="600"';

  /* =========================================================================
     Angle discrimination (RESEARCH §4.3)
     ========================================================================= */
  // 3° is the smallest gap anyone reports on the live exam; 2° is harder than the real test,
  // so the floor is hard-coded and every level clamps to it.
  const ANGLE_FLOOR = 3;
  const ANGLE_MIN_GAP = { 1: 8, 2: 4, 3: 3 };
  const ANGLE_MIN = 15;
  const ANGLE_MAX = 165;

  function angleMinGap(level) {
    return Math.max(ANGLE_FLOOR, ANGLE_MIN_GAP[levelOf(level)]);
  }
  function genAngles(seed, level) {
    const lvl = levelOf(level);
    const rng = rngFor('angles', seed, lvl);
    const minGap = angleMinGap(lvl);
    // Four sorted degrees with every consecutive gap ≥ minGap, inside [15, 165].
    const span = ANGLE_MAX - ANGLE_MIN - 3 * minGap;
    const draws = [0, 1, 2, 3].map(() => int(rng, 0, span)).sort((a, b) => a - b);
    let sorted = draws.map((u, i) => ANGLE_MIN + u + i * minGap);
    // At least one near-right or obtuse angle per set: lift the whole set if the largest is small.
    const lift = Math.max(0, 96 - sorted[3]);
    sorted = sorted.map(a => a + lift);
    const byBox = shuffled(rng, sorted);
    const orientations = byBox.map(() => int(rng, 0, 359));
    const arms = byBox.map(() => {
      const a = round(0.55 + rng() * 0.45, 2);
      let b = round(0.55 + rng() * 0.45, 2);
      if (Math.abs(a - b) < 0.15) b = round(a < 0.775 ? a + 0.18 : a - 0.18, 2);
      return [a, b];
    });
    const params = { angles: byBox, orientations, arms, minGap };
    const truth = angleRanking(byBox);
    const options = shuffled(rng, angleOptions(byBox, truth));
    const answer = options.indexOf(truth);
    return {
      id: itemId('angles', seed, lvl),
      section: 'pat',
      category: 'PAT-ANG',
      skill: 'skill-2',
      format: 'pat',
      subtest: 'angles',
      seed,
      level: lvl,
      stem: 'Rank the four angles from smallest to largest.',
      figure: anglesFigure(params, {}),
      optionKind: 'text',
      options,
      answer,
      explanation:
        'Measured angles: ' +
        byBox.map((a, i) => i + 1 + ' = ' + a + '°').join(', ') +
        '. Smallest to largest: ' +
        truth +
        '.',
      params,
    };
  }
  function angleRanking(angles) {
    return [0, 1, 2, 3]
      .sort((a, b) => angles[a] - angles[b])
      .map(i => i + 1)
      .join('-');
  }
  // Distractors swap the two closest angles, the next-closest pair, and both at once — the
  // three permutations a learner who mis-ranks one near pair actually produces.
  function angleOptions(angles, truth) {
    const rank = truth.split('-').map(Number);
    const gaps = [0, 1, 2].map(i => angles[rank[i + 1] - 1] - angles[rank[i] - 1]);
    const order = [0, 1, 2].sort((a, b) => gaps[a] - gaps[b] || a - b);
    const swapAt = (list, i) => {
      const c = list.slice();
      const t = c[i];
      c[i] = c[i + 1];
      c[i + 1] = t;
      return c;
    };
    return [rank, swapAt(rank, order[0]), swapAt(rank, order[1]), swapAt(swapAt(rank, order[0]), order[1])].map(p =>
      p.join('-')
    );
  }
  function angleBox(params, box, x0, y0, size, degrees) {
    const cx = x0 + size / 2,
      cy = y0 + size / 2 + 4,
      r = size * 0.42;
    const start = params.orientations[box],
      sweep = params.angles[box];
    const p1 = [
      cx + r * params.arms[box][0] * Math.cos((start * Math.PI) / 180),
      cy - r * params.arms[box][0] * Math.sin((start * Math.PI) / 180),
    ];
    const p2 = [
      cx + r * params.arms[box][1] * Math.cos(((start + sweep) * Math.PI) / 180),
      cy - r * params.arms[box][1] * Math.sin(((start + sweep) * Math.PI) / 180),
    ];
    return (
      rect(x0, y0, size, size, THIN + ' rx="4"') +
      polyline([p1, [cx, cy], p2], INK) +
      text(x0 + 9, y0 + 15, String(box + 1), TAG) +
      (degrees ? text(cx, y0 + size - 5, params.angles[box] + '°', LABEL) : '')
    );
  }
  function anglesFigure(params, opts) {
    const size = 118,
      gap = 6,
      pad = 6;
    const order = opts && opts.sorted ? [0, 1, 2, 3].sort((a, b) => params.angles[a] - params.angles[b]) : [0, 1, 2, 3];
    const width = 4 * size + 3 * gap + 2 * pad,
      height = size + 2 * pad;
    const body = order
      .map((box, slot) => angleBox(params, box, pad + slot * (size + gap), pad, size, !!(opts && opts.degrees)))
      .join('');
    return svgWrap(
      width,
      height,
      opts && opts.sorted
        ? 'The four angles redrawn from smallest to largest with their measures'
        : 'Four angles in boxes labelled 1 to 4',
      'dat-pat-svg dat-pat-angles',
      body
    );
  }
  function verifyAngles(item) {
    const p = item.params;
    if (!p || !Array.isArray(p.angles) || p.angles.length !== 4) return false;
    if (new Set(p.angles).size !== 4) return false;
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++) {
        const gap = Math.abs(p.angles[i] - p.angles[j]);
        if (gap < p.minGap || gap < ANGLE_FLOOR) return false;
      }
    if (p.angles.some(a => a < ANGLE_MIN || a > ANGLE_MAX)) return false;
    if (!p.angles.some(a => a > 90 || Math.abs(a - 90) <= 10)) return false;
    if (p.arms.some(pair => Math.abs(pair[0] - pair[1]) < 0.15)) return false;
    const truth = angleRanking(p.angles);
    return item.options.filter(o => o === truth).length === 1 && item.options[item.answer] === truth;
  }
  function explainAngles(item) {
    const p = item.params;
    const rank = angleRanking(p.angles).split('-').map(Number);
    const gaps = [0, 1, 2].map(i => p.angles[rank[i + 1] - 1] - p.angles[rank[i] - 1]);
    const closest = gaps.indexOf(Math.min.apply(null, gaps));
    return [
      {
        title: 'Measure each angle',
        text: p.angles.map((a, i) => 'Box ' + (i + 1) + ': ' + a + '°').join(' · '),
        svg: anglesFigure(p, { degrees: true }),
      },
      {
        title: 'Redraw them in order',
        text: 'Smallest to largest the boxes run ' + rank.join('-') + '.',
        svg: anglesFigure(p, { sorted: true, degrees: true }),
      },
      {
        title: 'The pair that decides the item',
        text:
          'Boxes ' +
          rank[closest] +
          ' and ' +
          rank[closest + 1] +
          ' differ by only ' +
          gaps[closest] +
          '°, so compare those two directly (nest one inside the other, or judge each against a right angle) before you commit. The set never drops below ' +
          p.minGap +
          '° between any two angles.',
        svg: '',
      },
    ];
  }

  /* =========================================================================
     Paper folding / hole punching (RESEARCH §4.4)
     ========================================================================= */
  // The sheet is an 8×8 sub-cell lattice over the 4×4 answer grid, so half-cell folds are
  // exact. A layer is a Map of current sub-cell position -> original sub-cell position; a
  // fold splits every layer into the part that stays and the reflected part that moves, which
  // is what makes "holes = paper thicknesses at the punch" [ADA] provable rather than assumed.
  const SUB = 8;
  // Each sub-cell is quartered by BOTH its diagonals: 0 the top quarter, 1 the right, 2 the
  // bottom, 3 the left. A square lattice cannot hold a 45° fold, because a 45° crease halves
  // every square it crosses and a half-covered cell breaks "holes = layers at the punch". On
  // this lattice the crease runs along quarter edges instead, every piece lies wholly on one
  // side of it, and the invariant survives — which is what makes diagonal folds possible here
  // (they were deferred out of wave 1 for exactly this reason).
  const TRI = 4;
  const HOLE_LEVELS = {
    1: { folds: [2, 2], punches: [1, 1], half: false, diagonal: false },
    2: { folds: [3, 3], punches: [1, 1], half: true, diagonal: true },
    3: { folds: [3, 4], punches: [1, 2], half: true, diagonal: true },
  };
  const FALLBACK_FOLDS = [
    { axis: 'x', at: 4, side: 'high' },
    { axis: 'y', at: 4, side: 'high' },
  ];

  function triPos(x, y, t) {
    return (((y << 3) | x) << 2) | t;
  }
  function subX(pos) {
    return (pos >> 2) & 7;
  }
  function subY(pos) {
    return pos >> 5;
  }
  function triOf(pos) {
    return pos & 3;
  }
  function gridOf(pos) {
    return ((subY(pos) >> 1) << 2) | (subX(pos) >> 1);
  }
  // The sixteen quarters that make up one cell of the 4×4 answer grid.
  function trianglesOf(cell) {
    const r = (cell >> 2) * 2,
      c = (cell & 3) * 2;
    const out = [];
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++) for (let t = 0; t < TRI; t++) out.push(triPos(c + dx, r + dy, t));
    return out;
  }
  /* Six times a quarter's centroid, in sub-cell units. Six, because a quarter's centroid sits a
     third of the way from the cell edge and a half along it: at six times scale every coordinate
     is a whole number, and no centroid ever lands ON a crease. That is what makes "which side of
     this fold is this piece on" an exact integer test for all four fold directions, with no
     piece straddling and no floating-point tie to break. */
  const TRI_CENTRE = [
    [3, 1],
    [5, 3],
    [3, 5],
    [1, 3],
  ];
  function triSide(pos, fold) {
    const c = TRI_CENTRE[triOf(pos)];
    const cx = 6 * subX(pos) + c[0],
      cy = 6 * subY(pos) + c[1];
    if (fold.axis === 'x') return cx - 6 * fold.at; // crease at x = at
    if (fold.axis === 'y') return cy - 6 * fold.at; // crease at y = at
    if (fold.axis === 'd') return cy - cx - 6 * fold.at; // crease along y = x + at
    return cx + cy - 6 * fold.at; // crease along x + y = at
  }
  // Folding turns the paper over, so a quarter changes which part of its sub-cell it occupies.
  // These are the four reflections, as permutations of the quarters.
  const TRI_FLIP = {
    x: [0, 3, 2, 1],
    y: [2, 1, 0, 3],
    d: [3, 2, 1, 0],
    a: [1, 0, 3, 2],
  };
  // Where a piece lands, or -1 when it would leave the original square [ADA].
  function foldPos(pos, fold) {
    const x = subX(pos),
      y = subY(pos);
    let nx, ny;
    if (fold.axis === 'x') {
      nx = 2 * fold.at - 1 - x;
      ny = y;
    } else if (fold.axis === 'y') {
      nx = x;
      ny = 2 * fold.at - 1 - y;
    } else if (fold.axis === 'd') {
      nx = y - fold.at;
      ny = x + fold.at;
    } else {
      nx = fold.at - y - 1;
      ny = fold.at - x - 1;
    }
    if (nx < 0 || nx >= SUB || ny < 0 || ny >= SUB) return -1;
    return triPos(nx, ny, TRI_FLIP[fold.axis][triOf(pos)]);
  }
  function initialLayers() {
    const m = new Map();
    for (let y = 0; y < SUB; y++)
      for (let x = 0; x < SUB; x++)
        for (let t = 0; t < TRI; t++) {
          const pos = triPos(x, y, t);
          m.set(pos, pos);
        }
    return [m];
  }
  // Returns { layers, moved, stayed } or null when any moving piece would leave the original
  // square — the [ADA] rule that the paper never turns and never overhangs.
  function applyFold(layers, fold) {
    const out = [];
    let moved = 0,
      stayed = 0;
    for (const layer of layers) {
      const stay = new Map(),
        move = new Map();
      for (const [pos, origin] of layer) {
        const side = triSide(pos, fold);
        if (fold.side === 'high' ? side < 0 : side > 0) {
          stay.set(pos, origin);
          stayed++;
          continue;
        }
        const landed = foldPos(pos, fold);
        if (landed < 0) return null;
        move.set(landed, origin);
        moved++;
      }
      if (stay.size) out.push(stay);
      if (move.size) out.push(move);
    }
    return { layers: out, moved, stayed };
  }
  // A punch is valid on a grid cell only when every layer that touches the cell covers all
  // sixteen of its quarters and maps them onto one whole original cell. That is exactly the
  // condition under which the hole count equals the thickness, so it is enforced, not hoped for
  // — and it is why a cell the crease runs through can never be punched.
  function punchInfo(layers, cell) {
    const quarters = trianglesOf(cell);
    const cells = [];
    for (const layer of layers) {
      const got = quarters.map(p => (layer.has(p) ? layer.get(p) : -1));
      const present = got.filter(v => v >= 0);
      if (!present.length) continue;
      if (present.length !== quarters.length) return null;
      if (new Set(got).size !== quarters.length) return null;
      const owners = new Set(got.map(gridOf));
      if (owners.size !== 1) return null;
      cells.push(gridOf(got[0]));
    }
    if (!cells.length) return null;
    if (new Set(cells).size !== cells.length) return null;
    return cells;
  }
  function simulateHoles(folds, punches) {
    let layers = initialLayers();
    const history = [layers];
    for (const fold of folds) {
      const step = applyFold(layers, fold);
      if (!step || !step.moved || !step.stayed) return null;
      layers = step.layers;
      history.push(layers);
    }
    const pattern = new Array(16).fill(0);
    const holeCells = [];
    let layersAtPunch = 0;
    for (const cell of punches) {
      const info = punchInfo(layers, cell);
      if (!info) return null;
      layersAtPunch += info.length;
      for (const g of info) holeCells.push(g);
    }
    if (new Set(holeCells).size !== holeCells.length) return null;
    for (const g of holeCells) pattern[g] = 1;
    return { layers, history, pattern, layersAtPunch, holeCells };
  }
  function foldCandidates(layers, spec) {
    const out = [];
    for (const axis of ['x', 'y'])
      for (let at = 1; at < SUB; at++) {
        if (!spec.half && at % 2) continue;
        for (const side of ['low', 'high']) out.push({ axis, at, side });
      }
    /* Diagonals only along the 45° lines that run corner to corner of the ANSWER grid, never
       through the middle of one of its cells. Those are the creases that carry whole answer-grid
       cells onto whole answer-grid cells; any other 45° line would leave half-cells that no
       punch could sit on honestly, which is the shape of the wave-1 objection. */
    if (spec.diagonal) {
      for (let at = -SUB + 2; at <= SUB - 2; at += 2)
        for (const side of ['low', 'high']) out.push({ axis: 'd', at, side });
      for (let at = 2; at <= 2 * SUB - 2; at += 2)
        for (const side of ['low', 'high']) out.push({ axis: 'a', at, side });
    }
    // Viability is a property of where the paper IS, not of how it is layered, so it is decided
    // on the footprint without building the folded layers: with four fold directions to try at
    // every step, building each candidate in full is most of the cost of an item.
    const foot = footprint(layers);
    return out.filter(fold => {
      let moved = 0,
        stayed = 0;
      for (const pos of foot) {
        if (fold.side === 'high' ? triSide(pos, fold) < 0 : triSide(pos, fold) > 0) {
          stayed++;
          continue;
        }
        if (foldPos(pos, fold) < 0) return false;
        moved++;
      }
      return moved > 0 && stayed > 0;
    });
  }
  function buildHoles(rng, level) {
    const spec = HOLE_LEVELS[levelOf(level)];
    const count = int(rng, spec.folds[0], spec.folds[1]);
    const folds = [];
    let layers = initialLayers();
    for (let i = 0; i < count; i++) {
      const cands = foldCandidates(layers, spec);
      if (!cands.length) return null;
      const fold = pick(rng, cands);
      folds.push(fold);
      layers = applyFold(layers, fold).layers;
    }
    const wanted = int(rng, spec.punches[0], spec.punches[1]);
    const valid = [];
    for (let cell = 0; cell < 16; cell++) if (punchInfo(layers, cell)) valid.push(cell);
    if (valid.length < wanted) return null;
    const order = shuffled(rng, valid).sort((a, b) => punchInfo(layers, b).length - punchInfo(layers, a).length);
    const punches = order.slice(0, wanted).sort((a, b) => a - b);
    const sim = simulateHoles(folds, punches);
    if (!sim) return null;
    const holes = sim.pattern.reduce((s, v) => s + v, 0);
    if (holes !== sim.layersAtPunch) return null;
    if (holes < 2 || holes > 12) return null;
    return { folds, punches, sim };
  }
  function mirrorPattern(pattern, axis) {
    const out = new Array(16).fill(0);
    for (let i = 0; i < 16; i++) {
      if (!pattern[i]) continue;
      const r = i >> 2,
        c = i & 3;
      out[axis === 'h' ? (r << 2) | (3 - c) : ((3 - r) << 2) | c] = 1;
    }
    return out;
  }
  function transposePattern(pattern) {
    const out = new Array(16).fill(0);
    for (let i = 0; i < 16; i++) if (pattern[i]) out[((i & 3) << 2) | (i >> 2)] = 1;
    return out;
  }
  function togglePattern(pattern, cell) {
    const out = pattern.slice();
    out[cell] = out[cell] ? 0 : 1;
    return out;
  }
  function patternKey(pattern) {
    return pattern.join('');
  }
  function genHoles(seed, level) {
    const lvl = levelOf(level);
    let built = null,
      rng = null;
    for (let attempt = 0; attempt < 80 && !built; attempt++) {
      rng = rngFor('holes', seed, lvl, 'a' + attempt);
      built = buildHoles(rng, lvl);
    }
    if (!built) {
      rng = rngFor('holes', seed, lvl, 'fallback');
      const sim = simulateHoles(FALLBACK_FOLDS, [0]);
      built = { folds: FALLBACK_FOLDS.slice(), punches: [0], sim };
    }
    const answer = built.sim.pattern;
    const picks = [],
      seen = new Set([patternKey(answer)]);
    const push = p => {
      if (!p) return false;
      const key = patternKey(p);
      if (seen.has(key) || picks.length >= 4) return false;
      seen.add(key);
      picks.push(p);
      return true;
    };
    // The four recipes a real learner produces: mirror across the wrong axis, forget the last
    // fold, unfold two folds out of order, and miscount the thickness by one hole.
    push(mirrorPattern(answer, rng() < 0.5 ? 'h' : 'v'));
    const dropped = built.folds.length > 1 ? simulateHoles(built.folds.slice(0, -1), built.punches) : null;
    push(dropped && dropped.pattern);
    for (let i = 0; i + 1 < built.folds.length && picks.length < 3; i++) {
      const swapped = built.folds.slice();
      const t = swapped[i];
      swapped[i] = swapped[i + 1];
      swapped[i + 1] = t;
      const sim = simulateHoles(swapped, built.punches);
      if (sim) push(sim.pattern);
    }
    const toggles = shuffled(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    push(togglePattern(answer, toggles[0]));
    const spares = [mirrorPattern(answer, 'v'), mirrorPattern(answer, 'h'), transposePattern(answer)]
      .concat(toggles.map(c => togglePattern(answer, c)))
      .concat(toggles.map(c => togglePattern(togglePattern(answer, c), toggles[(c + 5) % 16])));
    for (const p of spares) push(p);
    const optionPatterns = shuffled(rng, picks.concat([answer])).map(patternKey);
    const params = {
      folds: built.folds,
      punches: built.punches,
      pattern: answer,
      layersAtPunch: built.sim.layersAtPunch,
      optionPatterns,
    };
    const holeList = answer
      .map((v, i) => (v ? 'row ' + ((i >> 2) + 1) + ' column ' + ((i & 3) + 1) : null))
      .filter(Boolean);
    return {
      id: itemId('holes', seed, lvl),
      section: 'pat',
      category: 'PAT-HOLE',
      skill: 'skill-2',
      format: 'pat',
      subtest: 'holes',
      seed,
      level: lvl,
      stem: 'The square is folded as shown and then punched. Choose the pattern of holes in the unfolded square.',
      figure: holesFigure(params),
      optionKind: 'svg',
      options: optionPatterns.map((key, i) => holeOption(key, i)),
      answer: optionPatterns.indexOf(patternKey(answer)),
      explanation:
        'The stack is ' +
        params.layersAtPunch +
        ' ' +
        (params.layersAtPunch === 1 ? 'layer' : 'layers') +
        ' thick where the punch goes through, so the unfolded square shows ' +
        params.layersAtPunch +
        ' holes: ' +
        holeList.join(', ') +
        '.',
      params,
    };
  }
  function foldLabel(fold) {
    if (fold.axis === 'x') return 'Vertical fold';
    if (fold.axis === 'y') return 'Horizontal fold';
    return 'Diagonal fold';
  }
  function footprint(layers) {
    const out = new Set();
    for (const layer of layers) for (const pos of layer.keys()) out.add(pos);
    return out;
  }
  // The three corners of one quarter on the page: the sub-cell edge it spans, closed at the
  // sub-cell's centre.
  function triPoints(pos, px, py, cell) {
    const x = px + subX(pos) * cell,
      y = py + subY(pos) * cell,
      t = triOf(pos);
    const corners = [
      [x, y],
      [x + cell, y],
      [x + cell, y + cell],
      [x, y + cell],
    ];
    return [corners[t], corners[(t + 1) % 4], [x + cell / 2, y + cell / 2]];
  }
  // The quarter on the other side of one of a quarter's three edges: edge 0 is the sub-cell edge
  // and crosses into the next sub-cell; edges 1 and 2 run to the centre and are shared with the
  // quarters either side. -1 means the edge is the edge of the sheet.
  const TRI_STEP = [
    [0, -1, 2],
    [1, 0, 3],
    [0, 1, 0],
    [-1, 0, 1],
  ];
  function triNeighbour(pos, edge) {
    const t = triOf(pos);
    if (edge) return triPos(subX(pos), subY(pos), (t + (edge === 1 ? 1 : 3)) % 4);
    const step = TRI_STEP[t];
    const nx = subX(pos) + step[0],
      ny = subY(pos) + step[1];
    return nx < 0 || nx >= SUB || ny < 0 || ny >= SUB ? -1 : triPos(nx, ny, step[2]);
  }
  // The outline of a set of quarters: every edge whose other side is not in the set. On a
  // diagonal fold that traces the 45° crease as naturally as it traces a straight one.
  function boundary(cells, px, py, cell, attrs) {
    let body = '';
    for (const pos of cells) {
      const pts = triPoints(pos, px, py, cell);
      for (let edge = 0; edge < 3; edge++) {
        const other = triNeighbour(pos, edge);
        if (other >= 0 && cells.has(other)) continue;
        const from = pts[edge],
          to = pts[(edge + 1) % 3];
        body += line(from[0], from[1], to[0], to[1], attrs);
      }
    }
    return body;
  }
  // Fill whole sub-cells with one rectangle and only the cut ones quarter by quarter: filling
  // every quarter separately would quadruple the size of every figure for no visible gain.
  function paperFill(cells, px, py, cell) {
    let body = '';
    const whole = new Set();
    for (const pos of cells) {
      const x = subX(pos),
        y = subY(pos);
      const key = (y << 3) | x;
      if (whole.has(key)) continue;
      if ([0, 1, 2, 3].every(t => cells.has(triPos(x, y, t)))) {
        whole.add(key);
        body += rect(px + x * cell, py + y * cell, cell, cell, PAPER);
      } else body += polygon(triPoints(pos, px, py, cell), PAPER);
    }
    return body;
  }
  // One panel. `ghost` is where the sheet lay before this fold, drawn in broken lines the way
  // the ADA panels do it: without it a panel would show only the resulting footprint, and a
  // learner could not tell which side was folded onto which — the item would be unanswerable.
  function paperPanel(layers, px, py, cell, marks, ghost) {
    const here = footprint(layers);
    let body = rect(px, py, cell * SUB, cell * SUB, DASH + ' rx="2"');
    if (ghost) body += boundary(footprint(ghost), px, py, cell, DASH);
    body += paperFill(here, px, py, cell);
    body += boundary(here, px, py, cell, INK);
    for (const mark of marks || [])
      body += circle(px + ((mark & 3) * 2 + 1) * cell, py + ((mark >> 2) * 2 + 1) * cell, cell * 0.8, INK);
    return body;
  }
  // Which grid cells of a given fold state sit over a punched piece of the original sheet.
  function markedCells(layers, punchedOrigins) {
    const out = new Set();
    for (const layer of layers) for (const [pos, origin] of layer) if (punchedOrigins.has(origin)) out.add(gridOf(pos));
    return [...out];
  }
  function holesFigure(params) {
    const sim = simulateHoles(params.folds, params.punches);
    // An impossible fold sequence has no panels to draw; bail before touching sim.history.
    if (!sim) return svgWrap(1, 1, 'Figure unavailable', 'dat-pat-svg dat-pat-holes', '');
    // The ADA layout: one panel per fold, then the same sheet again with the punch on it.
    const folds = params.folds.length;
    const panels = folds + 1;
    const size = 80,
      cell = size / SUB,
      gap = 12,
      pad = 6;
    const width = panels * size + (panels - 1) * gap + 2 * pad,
      height = size + 26 + pad;
    let body = '';
    for (let i = 0; i < panels; i++) {
      const px = pad + i * (size + gap);
      const last = i === panels - 1;
      body += paperPanel(
        sim.history[last ? folds : i + 1],
        px,
        pad,
        cell,
        last ? params.punches : null,
        last ? null : sim.history[i]
      );
      body += text(px + size / 2, pad + size + 16, last ? 'Punch' : 'Fold ' + (i + 1), LABEL);
    }
    return svgWrap(
      width,
      height,
      'Folding sequence: the dashed square is the original sheet, the solid outline is the folded paper, and the open circle is the punch',
      'dat-pat-svg dat-pat-holes',
      body
    );
  }
  function holeGrid(key, label, className) {
    const pad = 7,
      cell = 16,
      size = pad * 2 + cell * 4;
    let body = rect(1, 1, size - 2, size - 2, THIN + ' rx="4"');
    for (let i = 0; i < 16; i++) {
      const cx = pad + (i & 3) * cell + cell / 2,
        cy = pad + (i >> 2) * cell + cell / 2;
      body +=
        key[i] === '1'
          ? circle(cx, cy, 5.4, 'fill="currentColor" stroke="none"')
          : circle(cx, cy, 5.4, THIN + ' opacity="0.65"');
    }
    return svgWrap(size, size, label, className, body);
  }
  function holeOption(key, index) {
    const holes = key.split('').filter(c => c === '1').length;
    return holeGrid(
      key,
      'Answer grid with ' + holes + ' ' + (holes === 1 ? 'hole' : 'holes'),
      'dat-pat-svg dat-pat-grid dat-pat-grid-' + index
    );
  }
  function verifyHoles(item) {
    const p = item.params;
    if (!p || !Array.isArray(p.folds) || !Array.isArray(p.punches)) return false;
    const sim = simulateHoles(p.folds, p.punches);
    if (!sim) return false;
    if (patternKey(sim.pattern) !== patternKey(p.pattern)) return false;
    if (sim.layersAtPunch !== p.layersAtPunch) return false;
    if (sim.pattern.reduce((s, v) => s + v, 0) !== p.layersAtPunch) return false;
    if (!Array.isArray(p.optionPatterns) || p.optionPatterns.length !== optionsFor('holes')) return false;
    if (new Set(p.optionPatterns).size !== p.optionPatterns.length) return false;
    const key = patternKey(sim.pattern);
    if (p.optionPatterns.filter(o => o === key).length !== 1) return false;
    return p.optionPatterns[item.answer] === key;
  }
  function explainHoles(item) {
    const p = item.params;
    const sim = simulateHoles(p.folds, p.punches);
    const steps = [];
    const size = 80,
      cell = size / SUB,
      pad = 6;
    const panel = (layers, marks, label, ghost) =>
      svgWrap(
        size + pad * 2,
        size + pad * 2,
        label,
        'dat-pat-svg dat-pat-unfold',
        paperPanel(layers, pad, pad, cell, marks, ghost)
      );
    // Every sub-cell of the original sheet the punch went through, so each unfold panel can
    // show the holes that have appeared so far rather than an empty sheet.
    const punchedOrigins = new Set();
    for (const g of sim.holeCells) for (const quarter of trianglesOf(g)) punchedOrigins.add(quarter);
    steps.push({
      title: 'Punch the folded stack',
      text:
        'The folded paper is ' +
        p.layersAtPunch +
        ' ' +
        (p.layersAtPunch === 1 ? 'layer' : 'layers') +
        ' thick under the punch, so ' +
        p.layersAtPunch +
        ' holes must appear once it is opened.',
      svg: panel(sim.history[sim.history.length - 1], p.punches, 'The folded stack with the punch marked'),
    });
    for (let k = p.folds.length; k >= 1; k--) {
      steps.push({
        title: 'Undo ' + (k === p.folds.length ? 'the last fold' : 'fold ' + k),
        text:
          foldLabel(p.folds[k - 1]) +
          ': reflect every hole back across that fold line. Work backwards, last fold first — unfolding out of order is the usual way this item is lost.',
        svg: panel(
          sim.history[k - 1],
          markedCells(sim.history[k - 1], punchedOrigins),
          'The sheet after undoing fold ' + k,
          sim.history[k]
        ),
      });
    }
    steps.push({
      title: 'Read the answer grid',
      text: item.explanation,
      svg: holeGrid(patternKey(p.pattern), 'The correct hole pattern', 'dat-pat-svg dat-pat-grid'),
    });
    return steps;
  }

  /* =========================================================================
     Cube counting (RESEARCH §4.5)
     ========================================================================= */
  // Figures are height maps, so no cube ever floats. A cube is hidden when nothing of it reaches
  // the viewer (isHidden below); a cube in a height map can only be hidden if cubes stand on it,
  // and cubeAnalysis rejects any figure where a hidden cube is a column top, which is the [ADA]
  // rule "the only hidden cubes are those required to support other cubes".
  // Level 1 is two storeys and nothing hidden. Its footprint is wide enough (and its figures
  // terraced enough — see randomHeights) that a painted-face class of four or five cubes is
  // reachable, without which options D and E could never be the answer on a warm-up set.
  const CUBE_LEVELS = {
    1: { grid: [2, 4], maxH: 2, cubes: [5, 12], hidden: [0, 0], questions: 2 },
    2: { grid: [3, 4], maxH: 3, cubes: [8, 14], hidden: [1, 2], questions: 3 },
    3: { grid: [3, 5], maxH: 4, cubes: [12, 20], hidden: [2, 4], questions: 4 },
  };
  const CUBE_OPTIONS = ['1 cube', '2 cubes', '3 cubes', '4 cubes', '5 cubes'];
  const FALLBACK_HEIGHTS = [
    [2, 1],
    [1, 2],
  ];

  function heightAt(heights, x, y) {
    return x >= 0 && y >= 0 && x < heights.length && y < heights[0].length ? heights[x][y] : 0;
  }
  function cubeList(heights) {
    const out = [];
    for (let x = 0; x < heights.length; x++)
      for (let y = 0; y < heights[x].length; y++) for (let z = 0; z < heights[x][y]; z++) out.push([x, y, z]);
    return out;
  }
  // Sight lines out of a cube toward the viewer at (1, 1, 1). Every such line steps +x, +y and
  // +z once per lattice period; which of the six orders it takes depends on where inside the
  // cube it starts, so these six cell walks cover every line that could carry the cube to the
  // eye (a line along a face diagonal projects to a hairline of zero area and does not count).
  const VIEW_PATHS = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
  // A cube is hidden exactly when all six walks meet a cube before leaving the figure: the
  // student can see no part of it, however the three camera-facing faces happen to be covered.
  // hiddenIn() takes an occupancy predicate rather than a height map, so keyholes (a height map)
  // and the TFE solids (a height map with holes carved out of it) share one visibility rule.
  function hiddenIn(occ, w, d, h, x, y, z) {
    const span = w + d + h + 2;
    return VIEW_PATHS.every(path => {
      let cx = x,
        cy = y,
        cz = z;
      for (let k = 0; k < span; k++)
        for (const axis of path) {
          if (axis === 0) cx++;
          else if (axis === 1) cy++;
          else cz++;
          if (cx >= w || cy >= d || cz >= h) return false;
          if (occ(cx, cy, cz)) return true;
        }
      return false;
    });
  }
  function heightOcc(heights) {
    const w = heights.length,
      d = heights[0].length;
    return (x, y, z) => x >= 0 && y >= 0 && x < w && y < d && z >= 0 && z < heights[x][y];
  }
  function maxHeight(heights) {
    let maxZ = 0;
    for (let x = 0; x < heights.length; x++)
      for (let y = 0; y < heights[x].length; y++) maxZ = Math.max(maxZ, heights[x][y]);
    return maxZ;
  }
  function isHidden(heights, x, y, z) {
    return hiddenIn(heightOcc(heights), heights.length, heights[0].length, maxHeight(heights), x, y, z);
  }
  function paintedFaces(heights, x, y, z) {
    let neighbours = 0;
    if (heightAt(heights, x - 1, y) > z) neighbours++;
    if (heightAt(heights, x + 1, y) > z) neighbours++;
    if (heightAt(heights, x, y - 1) > z) neighbours++;
    if (heightAt(heights, x, y + 1) > z) neighbours++;
    if (z + 1 < heights[x][y]) neighbours++;
    if (z > 0) neighbours++;
    return 6 - neighbours - (z === 0 ? 1 : 0);
  }
  function cubeAnalysis(heights) {
    const cubes = cubeList(heights);
    const tally = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const hidden = [];
    let supportsOk = true;
    for (const [x, y, z] of cubes) {
      tally[paintedFaces(heights, x, y, z)]++;
      if (isHidden(heights, x, y, z)) {
        hidden.push([x, y, z]);
        // A hidden cube that is the top of its column holds nothing up, which the ADA forbids.
        if (z === heights[x][y] - 1) supportsOk = false;
      }
    }
    return { cubes: cubes.length, tally, hidden, supportsOk };
  }
  function randomHeights(rng, spec) {
    const w = int(rng, spec.grid[0], spec.grid[1]),
      d = int(rng, spec.grid[0], spec.grid[1]);
    const heights = [];
    for (let x = 0; x < w; x++) heights.push(new Array(d).fill(0));
    // Connected footprint by random growth, then a height on each occupied column.
    const start = [int(rng, 0, w - 1), int(rng, 0, d - 1)];
    const footprint = [start];
    const taken = new Set([start[0] * d + start[1]]);
    const target = int(rng, Math.max(3, Math.ceil((w * d) / 2)), w * d);
    let guard = 0;
    while (footprint.length < target && guard++ < 200) {
      const [bx, by] = pick(rng, footprint);
      const step = pick(rng, [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]);
      const nx = bx + step[0],
        ny = by + step[1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= d) continue;
      if (taken.has(nx * d + ny)) continue;
      taken.add(nx * d + ny);
      footprint.push([nx, ny]);
    }
    // Heights come from a per-figure ceiling rather than the level maximum, so a figure terraces
    // instead of spiking. Repeated heights are what make a painted-face class of four or five
    // cubes possible, and that is what lets every answer 1-5 be the key at every level.
    const ceiling = int(rng, 1, spec.maxH);
    for (const [x, y] of footprint) heights[x][y] = int(rng, 1, ceiling);
    return heights;
  }
  function cubeFigure(figureSeed, level) {
    const lvl = levelOf(level);
    const spec = CUBE_LEVELS[lvl];
    for (let attempt = 0; attempt < 400; attempt++) {
      const rng = mulberry32(hash('cubes:figure:' + figureSeed + ':' + lvl + ':' + attempt));
      const heights = randomHeights(rng, spec);
      const info = cubeAnalysis(heights);
      if (!info.supportsOk) continue;
      if (info.cubes < spec.cubes[0] || info.cubes > spec.cubes[1]) continue;
      if (info.hidden.length < spec.hidden[0] || info.hidden.length > spec.hidden[1]) continue;
      const questions = [1, 2, 3, 4, 5].filter(k => info.tally[k] >= 1 && info.tally[k] <= 5);
      if (questions.length < 2) continue;
      return { heights, questions, ...info };
    }
    const heights = FALLBACK_HEIGHTS.map(row => row.slice());
    const info = cubeAnalysis(heights);
    return { heights, questions: [1, 2, 3, 4, 5].filter(k => info.tally[k] >= 1 && info.tally[k] <= 5), ...info };
  }
  function genCubes(seed, level) {
    const lvl = levelOf(level);
    const figureSeed = Math.floor(seed / 8),
      slot = seed % 8;
    const fig = cubeFigure(figureSeed, lvl);
    const question = fig.questions[slot % fig.questions.length];
    const count = fig.tally[question];
    const params = {
      heights: fig.heights,
      tally: fig.tally,
      hidden: fig.hidden,
      cubes: fig.cubes,
      question,
      figureSeed,
    };
    return {
      id: itemId('cubes', seed, lvl),
      section: 'pat',
      category: 'PAT-CUBE',
      skill: 'skill-2',
      format: 'pat',
      subtest: 'cubes',
      seed,
      level: lvl,
      figureId: 'cubes-f' + figureSeed + '-l' + lvl,
      stem:
        'The figure was built from same-size cubes and then painted on every side except the bottom it rests on. How many cubes have exactly ' +
        question +
        ' painted ' +
        (question === 1 ? 'face' : 'faces') +
        '?',
      figure: cubesFigure(params),
      optionKind: 'text',
      options: CUBE_OPTIONS.slice(),
      answer: count - 1,
      explanation:
        'The figure holds ' +
        fig.cubes +
        ' cubes, ' +
        (fig.hidden.length === 0
          ? 'every one of them visible'
          : 'including ' +
            fig.hidden.length +
            ' hidden ' +
            (fig.hidden.length === 1 ? 'cube that supports' : 'cubes that support') +
            ' the cubes above ' +
            (fig.hidden.length === 1 ? 'it' : 'them')) +
        '. Painted-face tally: ' +
        [1, 2, 3, 4, 5].map(k => k + ' → ' + fig.tally[k]).join(', ') +
        (fig.tally[0] ? ', 0 → ' + fig.tally[0] : '') +
        '. Exactly ' +
        count +
        ' ' +
        (count === 1 ? 'cube has' : 'cubes have') +
        ' ' +
        question +
        ' painted ' +
        (question === 1 ? 'face' : 'faces') +
        '.',
      params,
    };
  }
  /* Isometric renderer. Screen(x, y, z) = (ox + (x - y) * W, oy + (x + y) * H - z * Z). Z = 2H
     is what makes this a true projection along (1, 1, 1) — the direction isHidden reasons about
     — so cube (x+1, y+1, z+1) lands exactly on cube (x, y, z) and a hidden cube contributes no
     ink at all. Cubes are drawn back to front by x + y + z (a valid depth order for unit cubes
     under this view) with opaque faces, and only the three camera-facing faces of a cube with no
     neighbour in that direction are drawn: that is the hidden-line removal. */
  // The unit is the drawn size of one cube edge: z = 2h is what makes the projection true, and w
  // is h·√3 rounded to whole units. Passing it in is what lets keyholes draw the same solid at a
  // different (smaller) edge length without a second renderer.
  const ISO_UNIT = { w: 22, h: 12, z: 24 };
  function voxelBox(w, d, h, unit, pad) {
    return {
      width: pad * 2 + (w + d) * unit.w,
      height: pad * 2 + (w + d) * unit.h + h * unit.z,
      ox: pad + d * unit.w,
      oy: pad + h * unit.z,
    };
  }
  function voxelBody(occ, w, d, h, unit, ox, oy) {
    const cells = [];
    for (let x = 0; x < w; x++)
      for (let y = 0; y < d; y++) for (let z = 0; z < h; z++) if (occ(x, y, z)) cells.push([x, y, z]);
    const drawn = cells
      .filter(([x, y, z]) => !hiddenIn(occ, w, d, h, x, y, z))
      .sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
    let body = '';
    for (const [x, y, z] of drawn) {
      const P = (dx, dy, dz) => [
        ox + (x + dx - (y + dy)) * unit.w,
        oy + (x + dx + y + dy) * unit.h - (z + dz) * unit.z,
      ];
      if (!occ(x, y, z + 1)) body += polygon([P(0, 0, 1), P(1, 0, 1), P(1, 1, 1), P(0, 1, 1)], FACE);
      if (!occ(x + 1, y, z)) body += polygon([P(1, 0, 0), P(1, 1, 0), P(1, 1, 1), P(1, 0, 1)], FACE);
      if (!occ(x, y + 1, z)) body += polygon([P(0, 1, 0), P(1, 1, 0), P(1, 1, 1), P(0, 1, 1)], FACE);
    }
    return body;
  }
  function isoFigure(heights, opts) {
    const w = heights.length,
      d = heights[0].length,
      maxZ = maxHeight(heights);
    const occ = heightOcc(heights);
    const box = voxelBox(w, d, maxZ, ISO_UNIT, 10);
    return svgWrap(
      box.width,
      box.height,
      (opts && opts.label) || 'Isometric drawing of a figure built from cubes',
      'dat-pat-svg dat-pat-cubes',
      voxelBody(occ, w, d, maxZ, ISO_UNIT, box.ox, box.oy)
    );
  }
  function cubesFigure(params) {
    return isoFigure(params.heights, {
      label: 'Isometric drawing of a figure built from ' + params.cubes + ' cubes',
    });
  }
  function verifyCubes(item) {
    const p = item.params;
    if (!p || !Array.isArray(p.heights)) return false;
    const info = cubeAnalysis(p.heights);
    if (!info.supportsOk) return false;
    if (info.cubes !== p.cubes) return false;
    const sum = [0, 1, 2, 3, 4, 5].reduce((s, k) => s + info.tally[k], 0);
    if (sum !== info.cubes) return false;
    for (const k of [0, 1, 2, 3, 4, 5]) if (info.tally[k] !== p.tally[k]) return false;
    if (info.hidden.length !== p.hidden.length) return false;
    const count = info.tally[p.question];
    if (!(count >= 1 && count <= 5)) return false;
    if (item.options.length !== CUBE_OPTIONS.length) return false;
    if (item.options.some((o, i) => o !== CUBE_OPTIONS[i])) return false;
    return item.answer === count - 1;
  }
  function explainCubes(item) {
    const p = item.params;
    const info = cubeAnalysis(p.heights);
    return [
      {
        title: 'Count every cube, hidden supports included',
        text:
          'The figure holds ' +
          info.cubes +
          ' cubes. ' +
          (info.hidden.length
            ? info.hidden.length + ' of them cannot be seen; each one is there only because a visible cube rests on it.'
            : 'Every cube is visible in this figure.'),
        svg: isoFigure(p.heights, { label: 'The figure with every cube counted' }),
      },
      {
        title: 'Build the painted-face tally once',
        text:
          [1, 2, 3, 4, 5].map(k => k + ' painted: ' + info.tally[k]).join(' · ') +
          (info.tally[0] ? ' · 0 painted: ' + info.tally[0] : '') +
          '. The rows add to ' +
          info.cubes +
          ', which is the check that nothing was missed. Remember the face a cube rests on is never painted, and a cube touching a neighbour loses that face too.',
        svg: '',
      },
      {
        title: 'Read the row the question asks for',
        text:
          'Exactly ' +
          info.tally[p.question] +
          ' ' +
          (info.tally[p.question] === 1 ? 'cube has' : 'cubes have') +
          ' ' +
          p.question +
          ' painted ' +
          (p.question === 1 ? 'face' : 'faces') +
          '. Five painted faces only ever appear on a lone tower top; four only on an isolated cube with one neighbour.',
        svg: '',
      },
    ];
  }

  /* =========================================================================
     Binary masks (shared by keyhole silhouettes)
     ========================================================================= */
  // A mask is a tight w×h grid of 0/1 in row-major order: the exact shape of an orthographic
  // silhouette, which is also the exact shape of the aperture that fits it [ADA rule 2].
  function mask(w, h, fn) {
    const bits = new Array(w * h).fill(0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) bits[y * w + x] = fn(x, y) ? 1 : 0;
    return { w, h, bits };
  }
  function maskAt(m, x, y) {
    return x >= 0 && y >= 0 && x < m.w && y < m.h ? m.bits[y * m.w + x] : 0;
  }
  function maskKeyOf(m) {
    return m.w + 'x' + m.h + ':' + m.bits.join('');
  }
  function maskFrom(w, h, bits) {
    return { w, h, bits: String(bits).split('').map(Number) };
  }
  function maskTrim(m) {
    let x0 = m.w,
      x1 = -1,
      y0 = m.h,
      y1 = -1;
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < m.w; x++)
        if (m.bits[y * m.w + x]) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    if (x1 < 0) return null;
    return mask(x1 - x0 + 1, y1 - y0 + 1, (x, y) => maskAt(m, x + x0, y + y0));
  }
  function maskRot(m) {
    return mask(m.h, m.w, (x, y) => maskAt(m, y, m.h - 1 - x));
  }
  function maskFlip(m) {
    return mask(m.w, m.h, (x, y) => maskAt(m, m.w - 1 - x, y));
  }
  /* The full dihedral group of a silhouette. Turning the object 180° about an axis lying in the
     projection plane swaps the near and far faces, and that presents the mirror image of the same
     silhouette — so every one of the 8 transforms of each of the 3 axis silhouettes is genuinely
     an opening the object passes through [ADA rule 1], and none of them can be a distractor. */
  function maskClass(list) {
    const keys = new Set();
    for (const base of list) {
      let cur = base;
      for (let k = 0; k < 4; k++) {
        keys.add(maskKeyOf(cur));
        keys.add(maskKeyOf(maskFlip(cur)));
        cur = maskRot(cur);
      }
    }
    return keys;
  }
  function maskConnected(m) {
    const filled = [];
    for (let i = 0; i < m.bits.length; i++) if (m.bits[i]) filled.push(i);
    if (!filled.length) return false;
    const seen = new Set([filled[0]]),
      queue = [filled[0]];
    while (queue.length) {
      const i = queue.pop(),
        x = i % m.w,
        y = (i - (i % m.w)) / m.w;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          ny = y + dy;
        if (!maskAt(m, nx, ny)) continue;
        const j = ny * m.w + nx;
        if (seen.has(j)) continue;
        seen.add(j);
        queue.push(j);
      }
    }
    return seen.size === filled.length;
  }
  function maskUsable(m) {
    return !!m && m.w >= 2 && m.h >= 2 && m.w <= 5 && m.h <= 5 && maskConnected(m);
  }
  function maskSolid(m) {
    return m.bits.every(b => b === 1);
  }
  function maskToggle(m, index) {
    const copy = { w: m.w, h: m.h, bits: m.bits.slice() };
    copy.bits[index] = copy.bits[index] ? 0 : 1;
    const trimmed = maskTrim(copy);
    return maskUsable(trimmed) ? trimmed : null;
  }
  // Duplicating one row or column is "the right shape stretched on one axis": the outline still
  // looks like the object's, but one feature is now the wrong size [RESEARCH §4.1 rule 3].
  function maskStretch(m, axis, i) {
    if (axis === 'x') return m.w + 1 > 5 ? null : mask(m.w + 1, m.h, (x, y) => maskAt(m, x <= i ? x : x - 1, y));
    return m.h + 1 > 5 ? null : mask(m.w, m.h + 1, (x, y) => maskAt(m, x, y <= i ? y : y - 1));
  }
  function maskOutline(m, unit, ox, oy, attrs) {
    let body = '';
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < m.w; x++) {
        if (!maskAt(m, x, y)) continue;
        const gx = ox + x * unit,
          gy = oy + y * unit;
        if (!maskAt(m, x, y - 1)) body += line(gx, gy, gx + unit, gy, attrs);
        if (!maskAt(m, x, y + 1)) body += line(gx, gy + unit, gx + unit, gy + unit, attrs);
        if (!maskAt(m, x - 1, y)) body += line(gx, gy, gx, gy + unit, attrs);
        if (!maskAt(m, x + 1, y)) body += line(gx + unit, gy, gx + unit, gy + unit, attrs);
      }
    return body;
  }
  function maskShape(m, unit, ox, oy) {
    let body = '';
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < m.w; x++) if (maskAt(m, x, y)) body += rect(ox + x * unit, oy + y * unit, unit, unit, PAPER);
    return body + maskOutline(m, unit, ox, oy, INK);
  }

  /* =========================================================================
     Apertures / keyholes (RESEARCH §4.1)
     ========================================================================= */
  /* The object is a height-map solid, so the drawing fixes its geometry completely: every column
     top is visible (checked below), nothing is hidden that is not held up by something visible,
     and there is no hidden irregularity to guess at [ADA rule 4]. Its three axis silhouettes are
     the only openings it passes through, up to the 8 turns of each [ADA rules 1-2], and the answer
     is one member of that 24-mask class drawn at the object's own scale [ADA rule 3]. Every
     distractor is proved to lie outside the class before the item ships [ADA rule 5]. */
  const KEY_UNIT = 16; // one cube edge, in SVG user units: shared by the object and the openings
  const KEY_PAD = 6;
  // 5 · 16 + 2 · 6 = 92, which is the max-width dat.css gives an option SVG, so one user unit is
  // one CSS pixel in the options; KEY_FIG_W is the figure's max-width for the same reason. The
  // object and the openings therefore reach the screen at one scale wherever the figure is not
  // being squeezed below 520 px (see the scale note in data/dat-pat.json).
  const KEY_CANVAS = 5 * KEY_UNIT + 2 * KEY_PAD;
  const KEY_FIG_W = 520;
  const KEY_ISO = { w: 14, h: 8, z: 16 };
  const KEY_LEVELS = {
    1: { grid: [2, 3], maxH: 2, scale: 0.7 },
    2: { grid: [3, 4], maxH: 3, scale: 0.8 },
    3: { grid: [3, 4], maxH: 4, scale: 0.85 },
  };
  const KEY_FALLBACK = [
    [2, 1],
    [1, 1],
  ];
  const AXIS_WORD = ['top', 'front', 'end'];
  // One line of review copy per recipe below, and each says what that recipe actually does.
  // maskToggle flips exactly one cell, so mirror, sibling and moved always carry one square MORE
  // or FEWER than the outline they were built from — a square is never moved, and describing one
  // as moved tells a learner to look for something the drawing does not contain.
  const KEY_FAULT = {
    answer: 'the key — the object’s own outline, at the object’s own size',
    scale: 'the right shape, but drawn smaller than the object — it would jam before it went through',
    mirror: 'the mirror of the right outline with one square added or taken away',
    sibling: 'one of the object’s other outlines with one square added or taken away',
    stretch: 'the right outline stretched on one axis, so one feature is the wrong size',
    moved: 'one of the object’s outlines with one square added or taken away, so no side of it is this shape',
  };

  // Top view keeps the front edge of the object at the bottom row, the way the object is drawn;
  // front and end views are the column-height profiles along x and along y.
  function keyholeSilhouettes(heights) {
    const w = heights.length,
      d = heights[0].length,
      maxZ = maxHeight(heights);
    const colX = x => {
      let m = 0;
      for (let y = 0; y < d; y++) m = Math.max(m, heights[x][y]);
      return m;
    };
    const colY = y => {
      let m = 0;
      for (let x = 0; x < w; x++) m = Math.max(m, heights[x][y]);
      return m;
    };
    return [
      mask(w, d, (x, row) => heights[x][d - 1 - row] > 0),
      mask(w, maxZ, (x, row) => colX(x) > maxZ - 1 - row),
      mask(d, maxZ, (y, row) => colY(y) > maxZ - 1 - row),
    ];
  }
  function keyholeValid(heights) {
    const w = heights.length,
      d = heights[0].length;
    for (let x = 0; x < w; x++) if (!heights[x].some(v => v > 0)) return false;
    for (let y = 0; y < d; y++) {
      let any = false;
      for (let x = 0; x < w; x++) if (heights[x][y] > 0) any = true;
      if (!any) return false;
    }
    const info = cubeAnalysis(heights);
    // A column top the eye cannot reach would leave the object's height ambiguous, which is the
    // one thing [ADA rule 4] promises never happens.
    if (!info.supportsOk || info.cubes < 4) return false;
    const sil = keyholeSilhouettes(heights);
    if (sil.some(m => !maskUsable(m))) return false;
    // At least two of the three openings must have a real notch, or the item is a rectangle hunt.
    return sil.filter(m => !maskSolid(m)).length >= 2;
  }
  function keyholeModel(seed, level) {
    const spec = KEY_LEVELS[level];
    for (let attempt = 0; attempt < 300; attempt++) {
      const rng = mulberry32(hash('keyholes:model:' + seed + ':' + level + ':' + attempt));
      const heights = randomHeights(rng, spec);
      if (keyholeValid(heights)) return heights;
    }
    return KEY_FALLBACK.map(row => row.slice());
  }
  function keyholeOptions(rng, heights, spec) {
    const sil = keyholeSilhouettes(heights);
    const klass = maskClass(sil);
    const notched = [0, 1, 2].filter(i => !maskSolid(sil[i]));
    const answerAxis = pick(rng, notched.length ? notched : [0, 1, 2]);
    const turns = int(rng, 0, 7);
    let base = sil[answerAxis];
    for (let k = 0; k < turns % 4; k++) base = maskRot(base);
    if (turns >= 4) base = maskFlip(base);
    const answer = base;
    const seen = new Set(),
      options = [];
    const push = (kind, m, scale) => {
      if (!m || !maskUsable(m)) return false;
      if (scale === 1 && klass.has(maskKeyOf(m))) return false; // never two right answers [rule 5]
      const key = maskKeyOf(m) + '@' + scale;
      if (seen.has(key)) return false;
      seen.add(key);
      options.push({ kind, w: m.w, h: m.h, bits: m.bits.join(''), scale });
      return true;
    };
    seen.add(maskKeyOf(answer) + '@1');
    options.push({ kind: 'answer', w: answer.w, h: answer.h, bits: answer.bits.join(''), scale: 1 });
    push('scale', answer, spec.scale);
    const cells = shuffled(
      rng,
      Array.from({ length: 25 }, (_, i) => i)
    );
    const toggles = (m, kind) => {
      for (const c of cells) {
        if (c >= m.w * m.h) continue;
        if (push(kind, maskToggle(m, c), 1)) return true;
      }
      return false;
    };
    toggles(maskFlip(answer), 'mirror');
    const sibling = pick(
      rng,
      [0, 1, 2].filter(i => i !== answerAxis)
    );
    let sib = sil[sibling];
    for (let k = 0, t = int(rng, 0, 3); k < t; k++) sib = maskRot(sib);
    toggles(sib, 'sibling');
    for (const axis of shuffled(rng, ['x', 'y']))
      for (const i of cells) {
        if (i >= (axis === 'x' ? answer.w : answer.h)) continue;
        if (push('stretch', maskStretch(answer, axis, i), 1)) break;
      }
    // Fill any gap the recipes above could not use on this object with further single-square moves.
    for (const m of [answer, maskFlip(answer), sil[0], sil[1], sil[2]]) {
      if (options.length >= 5) break;
      toggles(m, 'moved');
    }
    return { answerAxis, turns, options: options.slice(0, 5), klass };
  }
  function genKeyholes(seed, level) {
    const lvl = levelOf(level);
    const spec = KEY_LEVELS[lvl];
    let heights = null,
      built = null;
    for (let attempt = 0; attempt < 12 && !built; attempt++) {
      heights = keyholeModel(seed + attempt * 1000003, lvl);
      const rng = rngFor('keyholes', seed, lvl, 'o' + attempt);
      const draft = keyholeOptions(rng, heights, spec);
      if (draft.options.length === optionsFor('keyholes')) built = draft;
    }
    if (!built) {
      heights = KEY_FALLBACK.map(row => row.slice());
      built = keyholeOptions(rngFor('keyholes', seed, lvl, 'fallback'), heights, spec);
    }
    const rng = rngFor('keyholes', seed, lvl, 'order');
    const options = shuffled(rng, built.options);
    const params = {
      heights,
      answerAxis: built.answerAxis,
      turns: built.turns,
      unit: KEY_UNIT,
      options: options.map(o => ({ kind: o.kind, w: o.w, h: o.h, bits: o.bits, scale: o.scale })),
    };
    const answer = params.options.findIndex(o => o.kind === 'answer');
    return {
      id: itemId('keyholes', seed, lvl),
      section: 'pat',
      category: 'PAT-KEY',
      skill: 'skill-2',
      format: 'pat',
      subtest: 'keyholes',
      seed,
      level: lvl,
      stem: 'The solid object above can pass straight through exactly one of these openings if the right side goes in first. It may be turned any way you like before it starts through, but not once it has started. Object and openings are drawn to the same scale. Which opening fits?',
      figure: keyholeFigure(params),
      optionKind: 'svg',
      options: params.options.map((o, i) => apertureSvg(o, i)),
      answer,
      explanation:
        'Flatten the object along each of its three axes and you get three outlines; turning the object simply turns one of those outlines. The opening that fits is the ' +
        AXIS_WORD[params.answerAxis] +
        ' outline' +
        (params.turns % 4 ? ', turned ' + (params.turns % 4) * 90 + '°' : '') +
        (params.turns >= 4 ? ' and flipped over' : '') +
        '. The others are ruled out one by one: ' +
        params.options
          .map((o, i) => (o.kind === 'answer' ? null : letterFor(i) + ' is ' + KEY_FAULT[o.kind]))
          .filter(Boolean)
          .join('; ') +
        '.',
      params,
    };
  }
  function keyholeFigure(params) {
    const heights = params.heights;
    const w = heights.length,
      d = heights[0].length,
      maxZ = maxHeight(heights);
    const box = voxelBox(w, d, maxZ, KEY_ISO, 10);
    // The object sits in a canvas as wide as the figure's own CSS max-width, so its cube edge
    // reaches the screen at the same number of pixels as an opening's square does.
    const ox = box.ox + (KEY_FIG_W - box.width) / 2;
    return svgWrap(
      KEY_FIG_W,
      box.height,
      'Isometric drawing of the solid object',
      'dat-pat-svg dat-pat-keyholes',
      voxelBody(heightOcc(heights), w, d, maxZ, KEY_ISO, ox, box.oy)
    );
  }
  function apertureSvg(option, index) {
    const m = maskFrom(option.w, option.h, option.bits);
    const unit = round(KEY_UNIT * option.scale, 3);
    const ox = round((KEY_CANVAS - m.w * unit) / 2, 3),
      oy = round((KEY_CANVAS - m.h * unit) / 2, 3);
    return svgWrap(
      KEY_CANVAS,
      KEY_CANVAS,
      'Outline of an opening',
      'dat-pat-svg dat-pat-aperture dat-pat-aperture-' + index,
      maskShape(m, unit, ox, oy)
    );
  }
  function verifyKeyholes(item) {
    const p = item.params;
    if (!p || !Array.isArray(p.heights) || !Array.isArray(p.options)) return false;
    if (p.unit !== KEY_UNIT) return false;
    if (!keyholeValid(p.heights)) return false;
    const klass = maskClass(keyholeSilhouettes(p.heights));
    let hits = 0,
      hit = -1;
    p.options.forEach((o, i) => {
      const m = maskFrom(o.w, o.h, o.bits);
      if (o.scale !== 1) return; // the right shape at the wrong size is not the right opening
      if (!klass.has(maskKeyOf(m))) return;
      hits++;
      hit = i;
    });
    if (hits !== 1 || hit !== item.answer) return false;
    return p.options[item.answer].kind === 'answer' && p.options.every(o => o.scale > 0 && o.scale <= 1);
  }
  function silhouettePanel(heights, highlight) {
    const sil = keyholeSilhouettes(heights);
    const slot = 5 * KEY_UNIT + 16,
      pad = 6;
    const width = 3 * slot + 2 * 10 + pad * 2,
      height = slot + 22 + pad * 2;
    let body = '';
    sil.forEach((m, i) => {
      const sx = pad + i * (slot + 10),
        ox = sx + (slot - m.w * KEY_UNIT) / 2,
        oy = pad + (slot - m.h * KEY_UNIT) / 2;
      body +=
        rect(sx, pad, slot, slot, i === highlight ? INK + ' rx="4"' : THIN + ' rx="4"') +
        maskShape(m, KEY_UNIT, ox, oy) +
        text(sx + slot / 2, pad + slot + 15, AXIS_WORD[i] + (i === highlight ? ' — fits' : ''), LABEL);
    });
    return svgWrap(
      width,
      height,
      'The three outlines of the object, one per axis',
      'dat-pat-svg dat-pat-keyfaces',
      body
    );
  }
  // Step 2 of the review has to show the turn, not describe it: the axis outline on the left, the
  // outline as the item actually drew it on the right. Without both panels a learner reads "turned
  // 90° and flipped" and has nothing to check it against.
  // Captions sit under a 92-unit box in a monospaced face, so they stay short enough not to run
  // past it; the full sentence is in the step's own text.
  function turnLabel(turns) {
    const spun = (turns % 4) * 90;
    if (!spun) return turns >= 4 ? 'flipped' : 'as it is';
    return spun + '°' + (turns >= 4 ? ' + flip' : '');
  }
  function turnPanel(heights, axis, turns, option) {
    const before = keyholeSilhouettes(heights)[axis];
    const after = maskFrom(option.w, option.h, option.bits);
    const slot = 5 * KEY_UNIT + 16,
      pad = 6,
      gap = 40;
    const width = pad * 2 + slot * 2 + gap,
      height = pad + slot + 22;
    const panel = (m, x, caption) =>
      rect(x, pad, slot, slot, THIN + ' rx="4"') +
      maskShape(m, KEY_UNIT, x + (slot - m.w * KEY_UNIT) / 2, pad + (slot - m.h * KEY_UNIT) / 2) +
      text(x + slot / 2, pad + slot + 15, caption, LABEL);
    const midY = pad + slot / 2,
      ax = pad + slot + 9,
      bx = pad + slot + gap - 9;
    return svgWrap(
      width,
      height,
      'The axis outline on the left and the same outline turned into the opening on the right',
      'dat-pat-svg dat-pat-keyturn',
      panel(before, pad, AXIS_WORD[axis] + ' outline') +
        line(ax, midY, bx, midY, INK) +
        polyline(
          [
            [bx - 6, midY - 4],
            [bx, midY],
            [bx - 6, midY + 4],
          ],
          INK
        ) +
        panel(after, pad + slot + gap, turnLabel(turns))
    );
  }
  /* Rule 3 in one picture: the key and the wrong-size opening side by side inside one drawing, at
     their true relative sizes. Comparing them across two option buttons depends on the browser
     giving both the same width; inside one SVG the comparison is exact at any screen width. */
  function scalePanel(key, small) {
    const slot = KEY_CANVAS,
      pad = 6,
      gap = 20;
    const panel = (option, x, caption) => {
      const m = maskFrom(option.w, option.h, option.bits);
      const unit = round(KEY_UNIT * option.scale, 3);
      return (
        rect(x, pad, slot, slot, THIN + ' rx="4"') +
        maskShape(m, unit, x + (slot - m.w * unit) / 2, pad + (slot - m.h * unit) / 2) +
        text(x + slot / 2, pad + slot + 15, caption, LABEL)
      );
    };
    return svgWrap(
      pad * 2 + slot * 2 + gap,
      pad + slot + 22,
      'The opening that fits beside the one that is the right shape but too small',
      'dat-pat-svg dat-pat-keyscale',
      panel(key, pad, 'fits') + panel(small, pad + slot + gap, 'too small')
    );
  }
  function explainKeyholes(item) {
    const p = item.params;
    const answer = p.options[item.answer];
    const small = p.options.find(o => o.scale !== 1) || null;
    const turned = (p.turns % 4) * 90;
    return [
      {
        title: 'Flatten the object three ways',
        text: 'Imagine the object crushed flat against a wall from above, from the front and from one end. Those three outlines — and nothing else — are the openings it can pass through. Everything you can see of the object tells you its shape; nothing is hidden that is not held up by a part you can see.',
        svg: silhouettePanel(p.heights, -1),
      },
      {
        title: 'Turn the outline, do not redraw it',
        text:
          'The object may be turned any way round before it starts through, so each outline may arrive rotated or flipped — and a flipped outline is still an opening the object goes through, not a trap. Here the opening is the ' +
          AXIS_WORD[p.answerAxis] +
          ' outline' +
          (turned ? ', turned ' + turned + '°' : '') +
          (p.turns >= 4 ? ' and flipped over' : '') +
          '. Once it has started through it may not be turned again, so the fit has to be exact.',
        svg: turnPanel(p.heights, p.answerAxis, p.turns, answer),
      },
      {
        title: 'Rule the other four out',
        text:
          p.options
            .map((o, i) => letterFor(i) + ': ' + (o.kind === 'answer' ? KEY_FAULT.answer : KEY_FAULT[o.kind]))
            .join(' · ') +
          '. Size is a real difference, not a drawing accident: the two below are the same shape and only one of them lets the object through.',
        svg: small ? scalePanel(answer, small) : apertureSvg(answer, item.answer),
      },
    ];
  }

  /* =========================================================================
     View recognition / top-front-end (RESEARCH §4.2)
     ========================================================================= */
  /* The solid is a height map with square holes carved out of it: blind pockets from level 2 and
     a straight tunnel at level 3, which is what puts hidden edges in the views. The projector
     below is generic over occupancy, so it never knows which feature it is drawing.

     One line is drawn wherever two neighbouring cells of a view differ anywhere along the line of
     sight. It is solid when some such difference has nothing in front of it, and dashed otherwise;
     because one line carries one flag, a solid edge automatically wins over a dashed one that
     falls on it [RESEARCH §4.2]. Every edge of an axis-aligned solid is either parallel to the
     line of sight (it projects to a point) or bounds a cell of the view, so this rule draws every
     line the view has and no others. */
  // Two drawn sizes, one geometry. An option view is small and is enlarged a little by the browser;
  // the figure is laid out at the width dat.css gives it (520 px), so one user unit is one pixel
  // there and the view labels stay the size of the page's other small caps instead of being
  // magnified along with the drawing.
  const TFE_UNIT = 16,
    TFE_PAD = 6;
  const TFE_FIG_UNIT = 40,
    TFE_FIG_PAD = 10,
    TFE_FIG_GAP = 44,
    TFE_FIG_W = 520;
  const TFE_VIEWS = ['top', 'front', 'end'];
  const TFE_LABEL = { top: 'TOP', front: 'FRONT', end: 'END' };
  const EDGE = INK;
  const HIDDEN_EDGE = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="4 3"';
  const FIG_EDGE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"';
  const FIG_HIDDEN = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="7 5"';
  const TFE_LEVELS = {
    1: { grid: [2, 3], maxH: 3, blind: 0, tunnel: false },
    2: { grid: [3, 4], maxH: 3, blind: 1, tunnel: false },
    3: { grid: [3, 4], maxH: 4, blind: 2, tunnel: true },
  };
  const TFE_FALLBACK = {
    heights: [
      [1, 2],
      [1, 1],
    ],
    features: [],
  };
  // Which two of the three views hand the missing one its outline (RESEARCH §4.2 alignment).
  const TFE_SHARE = {
    top: 'shares its width with the front view and its depth with the end view',
    front: 'shares its width with the top view and its height with the end view',
    end: 'shares its depth with the top view and its height with the front view',
  };
  const TFE_FAULT = {
    answer: 'the key — the view the object really has',
    toggle: 'has one line drawn solid that should be hidden, or hidden when it should be solid',
    drop: 'is missing one of the interior lines',
    add: 'carries an extra line where the object has no edge',
    mirror: 'is the right view flipped left to right',
  };

  function tfeOcc(heights, features) {
    const w = heights.length,
      d = heights[0].length,
      h = maxHeight(heights);
    const gone = new Set();
    for (const f of features || []) {
      if (f.kind === 'blind')
        for (let k = 0; k < f.depth; k++) gone.add(f.x + ':' + f.y + ':' + (heights[f.x][f.y] - 1 - k));
      if (f.kind === 'tunnel') for (let x = 0; x < w; x++) gone.add(x + ':' + f.y + ':' + f.z);
    }
    const occ = (x, y, z) =>
      x >= 0 && y >= 0 && x < w && y < d && z >= 0 && z < heights[x][y] && !gone.has(x + ':' + y + ':' + z);
    return { w, d, h, occ };
  }
  function tfeSolid(model) {
    const { w, d, h, occ } = model;
    const cells = [];
    for (let x = 0; x < w; x++)
      for (let y = 0; y < d; y++) for (let z = 0; z < h; z++) if (occ(x, y, z)) cells.push([x, y, z]);
    if (cells.length < 4) return false;
    const key = c => c.join(':');
    const all = new Set(cells.map(key));
    const seen = new Set([key(cells[0])]),
      queue = [cells[0]];
    while (queue.length) {
      const [x, y, z] = queue.pop();
      for (const [dx, dy, dz] of [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ]) {
        const n = [x + dx, y + dy, z + dz];
        if (!occ(n[0], n[1], n[2]) || seen.has(key(n))) continue;
        seen.add(key(n));
        queue.push(n);
      }
    }
    return seen.size === all.size;
  }
  function tfeDims(model, view) {
    if (view === 'top') return { uW: model.w, vH: model.d, depth: model.h };
    if (view === 'front') return { uW: model.w, vH: model.h, depth: model.d };
    return { uW: model.d, vH: model.h, depth: model.w };
  }
  function tfeCell(model, view, u, v, k) {
    if (view === 'top') return model.occ(u, model.d - 1 - v, model.h - 1 - k);
    if (view === 'front') return model.occ(u, k, model.h - 1 - v);
    return model.occ(model.w - 1 - k, u, model.h - 1 - v);
  }
  function tfeEdge(model, view, a, b) {
    const { uW, vH, depth } = tfeDims(model, view);
    const col = cell => {
      const [u, v] = cell;
      const out = new Array(depth).fill(false);
      if (u < 0 || v < 0 || u >= uW || v >= vH) return out;
      for (let k = 0; k < depth; k++) out[k] = !!tfeCell(model, view, u, v, k);
      return out;
    };
    const A = col(a),
      B = col(b);
    let found = false,
      visible = false;
    for (let k = 0; k < depth; k++) {
      if (A[k] === B[k]) continue;
      found = true;
      let clear = true;
      for (let j = 0; j < k; j++)
        if (A[j] || B[j]) {
          clear = false;
          break;
        }
      if (clear) visible = true;
    }
    return found ? { hidden: !visible } : null;
  }
  function mergeLines(segs) {
    const out = [];
    const groups = new Map();
    for (const s of segs) {
      const vertical = s.x1 === s.x2;
      const key = (vertical ? 'v' : 'h') + ':' + (vertical ? s.x1 : s.y1) + ':' + (s.hidden ? 1 : 0);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    }
    for (const list of groups.values()) {
      const vertical = list[0].x1 === list[0].x2;
      list.sort((a, b) => (vertical ? a.y1 - b.y1 : a.x1 - b.x1));
      let cur = null;
      for (const s of list) {
        const start = vertical ? s.y1 : s.x1,
          end = vertical ? s.y2 : s.x2;
        if (cur && (vertical ? cur.y2 : cur.x2) === start) {
          if (vertical) cur.y2 = end;
          else cur.x2 = end;
          continue;
        }
        cur = { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, hidden: s.hidden };
        out.push(cur);
      }
    }
    return sortLines(out);
  }
  function sortLines(lines) {
    return lines
      .slice()
      .sort(
        (a, b) => a.x1 - b.x1 || a.y1 - b.y1 || a.x2 - b.x2 || a.y2 - b.y2 || (a.hidden ? 1 : 0) - (b.hidden ? 1 : 0)
      );
  }
  function linesKey(lines) {
    return sortLines(lines)
      .map(l => [l.x1, l.y1, l.x2, l.y2, l.hidden ? 1 : 0].join(','))
      .join(' ');
  }
  function tfeLines(model, view) {
    const { uW, vH } = tfeDims(model, view);
    const segs = [];
    for (let u = 0; u <= uW; u++)
      for (let v = 0; v < vH; v++) {
        const e = tfeEdge(model, view, [u - 1, v], [u, v]);
        if (e) segs.push({ x1: u, y1: v, x2: u, y2: v + 1, hidden: e.hidden });
      }
    for (let v = 0; v <= vH; v++)
      for (let u = 0; u < uW; u++) {
        const e = tfeEdge(model, view, [u, v - 1], [u, v]);
        if (e) segs.push({ x1: u, y1: v, x2: u + 1, y2: v, hidden: e.hidden });
      }
    return mergeLines(segs);
  }
  // A drawn option is a set of lines, so the number of lines a student counts is the number of
  // lines after collinear neighbours of the same style have run together — which is what the
  // line-count check below and the immunity rule both measure.
  function lineCount(lines) {
    return mergeLines(lines).length;
  }
  // The counting shortcut is run on the lines a student can actually see, and a dashed line is a
  // hidden edge, not one of them. So the immunity rule is measured on the solid lines [DESIGN §6:
  // "at least one distractor has the same visible-line count as the answer"]; the total count is
  // held level as well, so neither way of counting singles the key out.
  function visibleLineCount(lines) {
    return mergeLines(lines).filter(l => !l.hidden).length;
  }
  // Raise the ring around one inner column so a blind pocket has a legal site there, and raise a
  // whole row (with a neighbour to hold the roof up) so a straight tunnel has one. Both only ever
  // add material, so the footprint stays connected and no column loses its visible top.
  function ensurePocket(rng, heights) {
    const w = heights.length,
      d = heights[0].length;
    const sites = [];
    for (let x = 1; x < w - 1; x++) for (let y = 1; y < d - 1; y++) sites.push([x, y]);
    if (!sites.length) return false;
    const [x, y] = pick(rng, sites);
    const floor = Math.max(2, heights[x][y]);
    heights[x][y] = floor;
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ])
      heights[nx][ny] = Math.max(heights[nx][ny], floor);
    return true;
  }
  function ensureTunnel(rng, heights) {
    const w = heights.length,
      d = heights[0].length;
    if (d < 2) return false;
    const y = int(rng, 0, d - 1);
    const beside = y === 0 ? 1 : y - 1;
    for (let x = 0; x < w; x++) {
      heights[x][y] = Math.max(heights[x][y], 3);
      heights[x][beside] = Math.max(heights[x][beside], 2);
    }
    return true;
  }

  function tfeBuild(seed, level) {
    const spec = TFE_LEVELS[level];
    for (let attempt = 0; attempt < 400; attempt++) {
      const rng = mulberry32(hash('tfe:model:' + seed + ':' + level + ':' + attempt));
      const heights = randomHeights(rng, spec);
      const w = heights.length,
        d = heights[0].length;
      let ok = true;
      for (let x = 0; x < w; x++) if (!heights[x].some(v => v > 0)) ok = false;
      for (let y = 0; y < d; y++) {
        let any = false;
        for (let x = 0; x < w; x++) if (heights[x][y] > 0) any = true;
        if (!any) ok = false;
      }
      if (!ok) continue;
      // A flat slab has three rectangles for views and teaches nothing; insist on a step.
      const tops = [];
      for (let x = 0; x < w; x++) for (let y = 0; y < d; y++) tops.push(heights[x][y]);
      if (new Set(tops).size < 2) continue;
      // Level 2 and up must actually carve something, so the shape is nudged until a pocket has
      // somewhere to sit: a cell away from the edge whose four neighbours stand at least as high.
      // Without that nudge a random 3x4 terrace offers a legal pocket site about one time in
      // thirty and "blind holes from level 2" would be a promise the generator rarely keeps.
      if (spec.blind && !ensurePocket(rng, heights)) continue;
      if (spec.tunnel && rng() < 0.5) ensureTunnel(rng, heights);
      const features = [];
      const pockets = shuffled(
        rng,
        (() => {
          const out = [];
          for (let x = 1; x < w - 1; x++)
            for (let y = 1; y < d - 1; y++) {
              const hxy = heights[x][y];
              if (hxy < 2) continue;
              if (heightAt(heights, x - 1, y) < hxy) continue;
              if (heightAt(heights, x + 1, y) < hxy) continue;
              if (heightAt(heights, x, y - 1) < hxy) continue;
              if (heightAt(heights, x, y + 1) < hxy) continue;
              out.push({ x, y, headroom: hxy });
            }
          return out;
        })()
      );
      if (spec.blind && !pockets.length) continue;
      // Depth 1 is the plain blind hole; depth 2 next to a depth-1 neighbour is the stepped pocket
      // the ADA's own sample draws as a countersink. Both are blind: a cube of floor always stays.
      for (const pocket of pockets.slice(0, spec.blind))
        features.push({ kind: 'blind', x: pocket.x, y: pocket.y, depth: pocket.headroom > 2 ? int(rng, 1, 2) : 1 });
      // One straight tunnel, level 3 only: it needs a row of columns with a cube of roof over the
      // bore and at least one column beside the row to keep that roof attached to the solid.
      if (spec.tunnel && d >= 2) {
        const bores = [];
        for (let y = 0; y < d; y++)
          for (let z = 1; z + 1 < spec.maxH; z++) {
            let fits = true;
            for (let x = 0; x < w; x++) if (heights[x][y] < z + 2) fits = false;
            let attached = false;
            for (let y2 = 0; y2 < d; y2++)
              if (y2 !== y) for (let x = 0; x < w; x++) if (heights[x][y2] > z) attached = true;
            if (fits && attached) bores.push({ kind: 'tunnel', y, z });
          }
        if (bores.length) features.push(pick(rng, bores));
      }
      const model = tfeOcc(heights, features);
      if (!tfeSolid(model)) continue;
      if (TFE_VIEWS.some(view => !tfeLines(model, view).length)) continue;
      return { heights, features };
    }
    return { heights: TFE_FALLBACK.heights.map(r => r.slice()), features: [] };
  }
  /* A recipe is applied to the true view and the result is merged again, so an option is exactly
     the set of lines a student sees: two collinear neighbours that end up sharing a style are one
     line, here and on screen. Without that, two recipes could draw the same picture from different
     line lists and the item would ship with two identical options. */
  function applyRecipe(truth, recipe, uW) {
    const lines = truth.map(l => Object.assign({}, l));
    if (recipe.kind === 'answer') return mergeLines(lines);
    if (recipe.kind === 'toggle') {
      if (!lines[recipe.i]) return null;
      lines[recipe.i].hidden = !lines[recipe.i].hidden;
      return mergeLines(lines);
    }
    if (recipe.kind === 'drop') {
      if (!lines[recipe.i]) return null;
      lines.splice(recipe.i, 1);
      return mergeLines(lines);
    }
    if (recipe.kind === 'add') {
      lines.push({ x1: recipe.x1, y1: recipe.y1, x2: recipe.x2, y2: recipe.y2, hidden: false });
      return mergeLines(lines);
    }
    if (recipe.kind === 'mirror')
      return mergeLines(lines.map(l => ({ x1: uW - l.x2, y1: l.y1, x2: uW - l.x1, y2: l.y2, hidden: l.hidden })));
    return null;
  }
  function tfeRecipes(rng, model, missing) {
    const truth = tfeLines(model, missing);
    const { uW, vH } = tfeDims(model, missing);
    const truthKey = linesKey(truth);
    const want = lineCount(truth);
    const wantVisible = visibleLineCount(truth);
    const interior = truth
      .map((l, i) => i)
      .filter(i => {
        const l = truth[i];
        if (l.x1 === l.x2) return l.x1 > 0 && l.x1 < uW;
        return l.y1 > 0 && l.y1 < vH;
      });
    const drawn = new Set(
      truth.flatMap(l =>
        l.x1 === l.x2
          ? Array.from({ length: l.y2 - l.y1 }, (_, k) => 'v' + l.x1 + ':' + (l.y1 + k))
          : Array.from({ length: l.x2 - l.x1 }, (_, k) => 'h' + l.y1 + ':' + (l.x1 + k))
      )
    );
    const blanks = [];
    for (let u = 1; u < uW; u++)
      for (let v = 0; v < vH; v++) if (!drawn.has('v' + u + ':' + v)) blanks.push({ x1: u, y1: v, x2: u, y2: v + 1 });
    for (let v = 1; v < vH; v++)
      for (let u = 0; u < uW; u++) if (!drawn.has('h' + v + ':' + u)) blanks.push({ x1: u, y1: v, x2: u + 1, y2: v });
    const byKind = {
      toggle: shuffled(rng, interior.length ? interior : truth.map((l, i) => i)).map(i => ({ kind: 'toggle', i })),
      mirror: [{ kind: 'mirror' }],
      drop: shuffled(rng, interior).map(i => ({ kind: 'drop', i })),
      add: shuffled(rng, blanks).map(b => Object.assign({ kind: 'add' }, b)),
    };
    const keep = [{ kind: 'answer' }];
    const seen = new Set([truthKey]);
    const take = recipe => {
      const lines = applyRecipe(truth, recipe, uW);
      if (!lines) return false;
      const key = linesKey(lines);
      if (seen.has(key)) return false;
      seen.add(key);
      keep.push(recipe);
      return true;
    };
    // The first distractor has to be one that leaves both counts alone — the solid lines a student
    // counts on screen and the lines in all — so counting lines can never single the key out
    // [RESEARCH §4.2: the line-counting shortcut is obsolete; DESIGN §6: same visible-line count].
    // A toggle flips one line solid↔dashed, so it moves the visible count and rarely qualifies;
    // the search therefore runs over every recipe kind rather than toggles and the mirror alone,
    // in an order the seed chooses so the immunity distractor is not the same kind every time.
    const immunity = shuffled(rng, ['mirror', 'add', 'toggle', 'drop']);
    for (const recipe of immunity.flatMap(kind => byKind[kind])) {
      const lines = applyRecipe(truth, recipe, uW);
      if (lines && lineCount(lines) === want && visibleLineCount(lines) === wantVisible && take(recipe)) break;
    }
    if (keep.length < 2) return null;
    // Then one of each remaining recipe before a second of any, so an item shows a learner more
    // than one way to be wrong.
    const order = shuffled(rng, ['drop', 'add', 'mirror', 'toggle']);
    for (let round = 0; round < 6 && keep.length < optionsFor('tfe'); round++)
      for (const kind of order) {
        if (keep.length >= optionsFor('tfe')) break;
        const recipe = byKind[kind][round];
        if (recipe) take(recipe);
      }
    return keep.length === optionsFor('tfe') ? keep : null;
  }
  function genTfe(seed, level) {
    const lvl = levelOf(level);
    let built = null,
      heights = null,
      features = null,
      missing = null;
    for (let attempt = 0; attempt < 12 && !built; attempt++) {
      const draft = tfeBuild(seed + attempt * 1000003, lvl);
      heights = draft.heights;
      features = draft.features;
      const rng = rngFor('tfe', seed, lvl, 'r' + attempt);
      missing = pick(rng, TFE_VIEWS);
      built = tfeRecipes(rng, tfeOcc(heights, features), missing);
    }
    if (!built) {
      heights = TFE_FALLBACK.heights.map(r => r.slice());
      features = [];
      missing = 'end';
      built = tfeRecipes(rngFor('tfe', seed, lvl, 'fallback'), tfeOcc(heights, features), missing);
    }
    const order = shuffled(rngFor('tfe', seed, lvl, 'order'), built);
    const params = { heights, features, missing, recipes: order };
    const answer = order.findIndex(r => r.kind === 'answer');
    const shown = TFE_VIEWS.filter(v => v !== missing);
    const model = tfeOcc(heights, features);
    const truth = tfeLines(model, missing);
    const hiddenCount = truth.filter(l => l.hidden).length;
    return {
      id: itemId('tfe', seed, lvl),
      section: 'pat',
      category: 'PAT-TFE',
      skill: 'skill-2',
      format: 'pat',
      subtest: 'tfe',
      seed,
      level: lvl,
      stem:
        'The ' +
        shown.map(v => TFE_LABEL[v].toLowerCase()).join(' and ') +
        ' views of one solid object are shown, drawn flat with no perspective. Edges you could not see from that side are dashed. Choose the missing ' +
        TFE_LABEL[missing].toLowerCase() +
        ' view.',
      figure: tfeFigure(params),
      optionKind: 'svg',
      options: order.map((recipe, i) => tfeOptionSvg(params, i)),
      answer,
      explanation:
        'The ' +
        TFE_LABEL[missing].toLowerCase() +
        ' view ' +
        TFE_SHARE[missing] +
        ', so its outline is fixed before you draw a single interior line. It has ' +
        truth.length +
        ' lines in all, ' +
        (hiddenCount ? hiddenCount + ' of them dashed because the edge sits inside the solid' : 'none of them dashed') +
        '. Counting lines will not separate the choices here: ' +
        'at least one wrong view has the same number of lines in all and the same number of solid ones.',
      params,
    };
  }
  function tfeOptionLines(params, index) {
    const model = tfeOcc(params.heights, params.features);
    const { uW } = tfeDims(model, params.missing);
    return applyRecipe(tfeLines(model, params.missing), params.recipes[index], uW) || [];
  }
  function viewBody(lines, ox, oy, unit, ink, hidden) {
    return lines
      .map(l => line(ox + l.x1 * unit, oy + l.y1 * unit, ox + l.x2 * unit, oy + l.y2 * unit, l.hidden ? hidden : ink))
      .join('');
  }
  /* The fixed ADA layout: TOP upper-left, FRONT lower-left, END lower-right, so width lines up
     between the top and front views, height between the front and end views, and depth between
     the top and end views [RESEARCH §4.2]. The slot the item asks for is left blank. */
  function tfeFigure(params, compact) {
    const model = tfeOcc(params.heights, params.features);
    // The review shows the same layout inside a panel dat.css caps at 190 px, so it is drawn at
    // the small unit: at the figure's own unit the labels would arrive at three pixels tall.
    const unit = compact ? TFE_UNIT : TFE_FIG_UNIT,
      pad = compact ? TFE_PAD : TFE_FIG_PAD,
      gap = compact ? 20 : TFE_FIG_GAP,
      head = compact ? 12 : 16,
      ink = compact ? EDGE : FIG_EDGE,
      hidden = compact ? HIDDEN_EDGE : FIG_HIDDEN,
      tag = compact ? 'font-size="9" fill="currentColor" font-weight="600"' : TAG;
    const size = view => {
      const { uW, vH } = tfeDims(model, view);
      return [uW * unit, vH * unit];
    };
    const dims = { top: size('top'), front: size('front'), end: size('end') };
    const col0 = pad,
      col1 = pad + Math.max(dims.top[0], dims.front[0]) + gap;
    const row0 = pad + head,
      row1 = row0 + dims.top[1] + gap + head;
    const inner = col1 + dims.end[0] + pad;
    const height = row1 + Math.max(dims.front[1], dims.end[1]) + pad;
    const width = compact ? inner : Math.max(TFE_FIG_W, inner);
    const shift = (width - inner) / 2;
    const slots = { top: [col0 + shift, row0], front: [col0 + shift, row1], end: [col1 + shift, row1] };
    let body = '';
    for (const view of TFE_VIEWS) {
      const [x, y] = slots[view],
        [vw, vh] = dims[view];
      body += text(x, y - 5, TFE_LABEL[view] + ' VIEW', tag);
      if (view === params.missing)
        body +=
          rect(x, y, vw, vh, DASH + ' rx="3"') +
          text(
            x + vw / 2,
            y + vh / 2 + (compact ? 5 : 8),
            '?',
            'font-size="' + (compact ? 14 : 22) + '" fill="currentColor" text-anchor="middle"'
          );
      else body += viewBody(tfeLines(model, view), x, y, unit, ink, hidden);
    }
    return svgWrap(
      width,
      height,
      'Two orthographic views of a solid object with the third left blank',
      'dat-pat-svg dat-pat-tfe',
      body
    );
  }
  function tfeOptionSvg(params, index) {
    const model = tfeOcc(params.heights, params.features);
    const { uW, vH } = tfeDims(model, params.missing);
    return svgWrap(
      uW * TFE_UNIT + 2 * TFE_PAD,
      vH * TFE_UNIT + 2 * TFE_PAD,
      'Candidate ' + TFE_LABEL[params.missing].toLowerCase() + ' view',
      'dat-pat-svg dat-pat-view dat-pat-view-' + index,
      viewBody(tfeOptionLines(params, index), TFE_PAD, TFE_PAD, TFE_UNIT, EDGE, HIDDEN_EDGE)
    );
  }
  function verifyTfe(item) {
    const p = item.params;
    if (!p || !Array.isArray(p.heights) || !Array.isArray(p.recipes)) return false;
    if (!TFE_VIEWS.includes(p.missing)) return false;
    const model = tfeOcc(p.heights, p.features);
    if (!tfeSolid(model)) return false;
    const truthKey = linesKey(tfeLines(model, p.missing));
    const drawn = p.recipes.map((_, i) => tfeOptionLines(p, i));
    if (drawn.some(lines => !lines.length)) return false;
    const keys = drawn.map(linesKey);
    if (new Set(keys).size !== keys.length) return false;
    if (keys.filter(k => k === truthKey).length !== 1) return false;
    if (keys[item.answer] !== truthKey) return false;
    // Line-count immunity: the key must never be the only view with its number of lines, counted
    // the way a student counts them — the solid lines on screen — nor by the lines in all.
    const counts = drawn.map(lines => lines.length);
    if (counts.filter(c => c === counts[item.answer]).length < 2) return false;
    const visible = drawn.map(lines => lines.filter(l => !l.hidden).length);
    return visible.filter(c => c === visible[item.answer]).length >= 2;
  }
  function explainTfe(item) {
    const p = item.params;
    const model = tfeOcc(p.heights, p.features);
    const truth = tfeLines(model, p.missing);
    const hidden = truth.filter(l => l.hidden);
    const shown = TFE_VIEWS.filter(v => v !== p.missing);
    const full = { heights: p.heights, features: p.features, missing: null, recipes: p.recipes };
    return [
      {
        title: 'Take the outline from the views you have',
        text:
          'The three views share their measurements: width runs across the top and front views, height down the front and end views, and depth between the top and end views with the top view turned a quarter turn. So the ' +
          TFE_LABEL[p.missing].toLowerCase() +
          ' view ' +
          TFE_SHARE[p.missing] +
          ' — the ' +
          shown.map(v => TFE_LABEL[v].toLowerCase()).join(' and ') +
          ' views settle its outline before you draw a single line inside it.',
        svg: tfeFigure(p, true),
      },
      {
        title: 'Then put the interior lines in one feature at a time',
        text:
          'Pick one feature — a step, a pocket, a wall — and follow that feature alone through every option before you move to the next. ' +
          (hidden.length
            ? hidden.length +
              ' of the ' +
              truth.length +
              ' lines in the ' +
              TFE_LABEL[p.missing].toLowerCase() +
              ' view are dashed, because from that side the edge lies behind solid material. Where a visible edge and a hidden one fall on the same line, the solid line is drawn.'
            : 'All ' +
              truth.length +
              ' lines in the ' +
              TFE_LABEL[p.missing].toLowerCase() +
              ' view are solid: from that side nothing of the object hides behind anything else, so a dashed line in an option is wrong on its own. The other two views below still dash what they hide.'),
        svg: tfeCompleteFigure(full),
      },
      {
        title: 'Rule the other options out',
        text: p.recipes.map((r, i) => letterFor(i) + ': ' + TFE_FAULT[r.kind]).join(' · '),
        svg: tfeOptionSvg(p, item.answer),
      },
    ];
  }
  function tfeCompleteFigure(params) {
    return tfeFigure({ heights: params.heights, features: params.features, missing: null }, true);
  }

  /* =========================================================================
     Pattern folding / 3D form development (RESEARCH §4.6)
     ========================================================================= */
  /* One solid, drawn four ways. The net at the left is the solid's surface cut along a spanning
     tree of its face graph and laid flat, and it is laid flat as seen from OUTSIDE, which is the
     [ADA] rule "the outside of the pattern is what is seen". Folding away from the viewer is
     then a rotation, never a reflection, so the mirror image is a wrong answer and is offered as
     one (the classic trap, RESEARCH §4.6).

     Everything below reads one table: a solid is { verts, faces }, and the unfolding, the
     rotation group, the mirror map, the shading and the isometric drawing are all derived from
     it. Adding a solid is therefore a data edit, not a new code path. Solids are convex on
     purpose: for a convex solid the faces whose outward normal leans toward the camera are
     exactly the faces you can see, so "draw the front-facing faces" IS hidden-surface removal
     and needs no depth sort that could be subtly wrong.

     Uniqueness is proved against the solid's own rotation group: two shadings that differ only
     by turning the solid are THE SAME ANSWER, so a canonical key (the smallest shading over all
     rotations) must be different for all four options, and the key's owner must be the option
     the item calls correct. A second check compares what is actually drawn, because two
     shadings that differ only on the hidden back faces would reach the page as identical
     pictures. */
  const PF_EPS = 1e-6;
  // A face this close to edge-on would vanish from the drawing and leave a gap in the outline,
  // so a viewpoint that puts any face there is rejected rather than drawn.
  const PF_VIEW_FLOOR = 0.08;
  // z = 2h and w = h·√3 is the same true isometric projection the voxel renderer uses, so a
  // pattern-folding solid and a cube-counting figure are drawn from the same eye.
  const PF_UNIT = { w: 15.59, h: 9, z: 18 };
  const PF_VIEW = [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)];
  const PF_SHADE =
    'fill="currentColor" fill-opacity="0.34" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"';
  const PF_MARK = 'fill="currentColor" fill-opacity="0.85" stroke="none"';
  const PF_OPT_W = 152,
    PF_OPT_H = 138,
    PF_NET_W = 380,
    PF_NET_H = 260;

  /* The shapes. A solid whose own rotation group is large cannot carry four tellable shadings:
     every pair of adjacent faces on a cube is every other pair turned round, so a cube net has
     only two shadings up to rotation and a four-option item cannot be built from it honestly.
     Every shape in the pool therefore has unequal edges, which keeps its rotation group small
     enough to leave room. The machinery itself is general — it derives a cube's full group of 24
     correctly, and scripts/test-dat-pat.cjs checks that it does — but a cube never becomes an
     item, because an honest four-option cube item cannot be built from face shading alone. */
  const PF_SOLIDS = {
    brick: {
      label: 'rectangular box',
      dims: [
        [2, 3, 4],
        [2, 3, 5],
        [3, 4, 5],
        [2, 4, 5],
        [3, 4, 6],
        [3, 5, 6],
      ],
      tweaks: [
        [0, 1],
        [1, 1],
        [2, 1],
      ],
    },
    wedge: {
      label: 'triangular prism',
      dims: [
        [3, 2, 4],
        [4, 2, 5],
        [3, 4, 2],
        [2, 3, 4],
        [5, 3, 2],
        [2, 4, 5],
      ],
      tweaks: [
        [0, 1],
        [1, 1],
        [2, 1],
      ],
    },
    trap: {
      label: 'truncated prism',
      dims: [
        [3, 2, 4],
        [2, 3, 4],
        [4, 3, 6],
        [3, 4, 4],
        [2, 5, 4],
      ],
      tweaks: [
        [0, 1],
        [1, 1],
        [2, 2],
      ],
    },
    pyr: {
      label: 'square pyramid',
      dims: [
        [2, 2, 3],
        [4, 4, 3],
        [4, 4, 5],
        [2, 2, 5],
      ],
      tweaks: [
        [0, 2],
        [2, 1],
      ],
    },
    hex: {
      label: 'hexagonal prism',
      dims: [
        [2, 2, 3],
        [2, 2, 5],
        [3, 3, 4],
      ],
      tweaks: [
        [0, 1],
        [2, 1],
      ],
    },
  };
  const PF_LEVELS = {
    1: { kinds: ['brick'], shaded: 2, marker: false },
    2: { kinds: ['brick', 'wedge', 'trap', 'pyr'], shaded: 2, marker: false },
    3: { kinds: ['brick', 'wedge', 'trap', 'pyr', 'hex'], shaded: 3, marker: true },
  };
  const PF_FAULT = {
    opposite: 'a shaded region has been moved to the face directly opposite the one the pattern shades',
    answer: 'the pattern folded away from you, with every shaded region landing where the net says it does',
    slid: 'the shading has slipped onto a face next door, so two regions that touch in the net no longer touch',
    moved: 'a shaded region has jumped to a face that does not touch the rest of the shading',
    mirror: 'the pattern folded toward you instead of away, which turns the solid into its mirror image',
    altered: 'one face is the wrong shape, so this solid is not the one the net describes',
    turned:
      'the corner mark has been turned to a different corner of its face, and shading keeps its orientation through a fold',
  };
  const PF_SHORT = {
    opposite: 'move the shading to the opposite face',
    slid: 'slide the shading onto the face next door',
    moved: 'move it to a face that touches nothing shaded',
    mirror: 'fold the pattern toward you instead of away',
    altered: 'change the shape of one face',
    turned: 'turn the corner mark to a different corner',
  };

  /* ---------- small vector helpers ---------- */
  function pfSub(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }
  function pfCross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function pfDot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }
  function pfUnitVec(a) {
    const len = Math.sqrt(pfDot(a, a)) || 1;
    return [a[0] / len, a[1] / len, a[2] / len];
  }
  function pfApply(m, v) {
    return [
      m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
      m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
      m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
    ];
  }
  function pfMean(list) {
    const out = [0, 0, 0];
    for (const p of list) {
      out[0] += p[0] / list.length;
      out[1] += p[1] / list.length;
      out[2] += p[2] / list.length;
    }
    return out;
  }

  /* ---------- the solids ---------- */
  // Each constructor returns vertices and face loops; the loops are re-oriented below so every
  // normal points out of the solid, which is what makes "outside" well defined everywhere else.
  function pfRawSolid(kind, dims) {
    const a = dims[0],
      b = dims[1],
      c = dims[2];
    if (kind === 'cube' || kind === 'brick')
      return {
        verts: [
          [0, 0, 0],
          [a, 0, 0],
          [a, b, 0],
          [0, b, 0],
          [0, 0, c],
          [a, 0, c],
          [a, b, c],
          [0, b, c],
        ],
        faces: [
          [0, 1, 2, 3],
          [4, 5, 6, 7],
          [0, 1, 5, 4],
          [1, 2, 6, 5],
          [2, 3, 7, 6],
          [3, 0, 4, 7],
        ],
      };
    if (kind === 'wedge')
      return {
        verts: [
          [0, 0, 0],
          [a, 0, 0],
          [0, 0, c],
          [0, b, 0],
          [a, b, 0],
          [0, b, c],
        ],
        faces: [
          [0, 1, 2],
          [3, 4, 5],
          [0, 1, 4, 3],
          [1, 2, 5, 4],
          [2, 0, 3, 5],
        ],
      };
    if (kind === 'trap') {
      const profile = [
        [0, 0],
        [a, 0],
        [a, c],
        [0, c / 2],
      ];
      return {
        verts: profile.map(p => [p[0], 0, p[1]]).concat(profile.map(p => [p[0], b, p[1]])),
        faces: [
          [0, 1, 2, 3],
          [4, 5, 6, 7],
          [0, 1, 5, 4],
          [1, 2, 6, 5],
          [2, 3, 7, 6],
          [3, 0, 4, 7],
        ],
      };
    }
    if (kind === 'pyr')
      return {
        verts: [
          [0, 0, 0],
          [a, 0, 0],
          [a, a, 0],
          [0, a, 0],
          [a / 2, a / 2, c],
        ],
        faces: [
          [0, 1, 2, 3],
          [0, 1, 4],
          [1, 2, 4],
          [2, 3, 4],
          [3, 0, 4],
        ],
      };
    // hexagonal prism: circumradius a, height c, one vertex on the +x axis
    const ring = [0, 1, 2, 3, 4, 5].map(k => [
      round(a * Math.cos((k * Math.PI) / 3), 6),
      round(a * Math.sin((k * Math.PI) / 3), 6),
    ]);
    return {
      verts: ring.map(p => [p[0], p[1], 0]).concat(ring.map(p => [p[0], p[1], c])),
      faces: [
        [0, 1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10, 11],
      ].concat([0, 1, 2, 3, 4, 5].map(k => [k, (k + 1) % 6, ((k + 1) % 6) + 6, k + 6])),
    };
  }
  function pfDimsOk(kind, dims) {
    if (dims.some(v => !Number.isFinite(v) || v < 2 || v > 8)) return false;
    if (kind === 'wedge' && dims[0] === dims[2]) return false; // an isosceles wedge can turn a face edge-on
    if (kind === 'trap' && (dims[2] % 2 || dims[2] < 4)) return false;
    if (kind === 'pyr' && dims[0] % 2) return false;
    return true;
  }
  const PF_CACHE = new Map();
  function pfSolid(kind, dims) {
    const key = kind + ':' + dims.join('x');
    if (PF_CACHE.has(key)) return PF_CACHE.get(key);
    const raw = pfRawSolid(kind, dims);
    const centre = pfMean(raw.verts);
    const faces = raw.faces.map(loop => {
      const o = raw.verts[loop[0]];
      const n = pfCross(pfSub(raw.verts[loop[1]], o), pfSub(raw.verts[loop[2]], o));
      return pfDot(n, pfSub(pfMean(loop.map(i => raw.verts[i])), centre)) < 0 ? loop.slice().reverse() : loop.slice();
    });
    const solid = { kind, dims: dims.slice(), verts: raw.verts, faces, centre };
    solid.normals = faces.map(loop => {
      const o = solid.verts[loop[0]];
      return pfUnitVec(pfCross(pfSub(solid.verts[loop[1]], o), pfSub(solid.verts[loop[2]], o)));
    });
    solid.adj = pfAdjacency(solid);
    PF_CACHE.set(key, solid);
    return solid;
  }
  // Two faces are neighbours when they share an edge; that edge is the fold line between them.
  function pfAdjacency(solid) {
    const edges = new Map();
    solid.faces.forEach((loop, fi) => {
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i],
          b = loop[(i + 1) % loop.length];
        const key = Math.min(a, b) + ':' + Math.max(a, b);
        if (!edges.has(key)) edges.set(key, { a: Math.min(a, b), b: Math.max(a, b), faces: [] });
        edges.get(key).faces.push(fi);
      }
    });
    const adj = solid.faces.map(() => []);
    for (const edge of edges.values())
      if (edge.faces.length === 2) {
        adj[edge.faces[0]].push({ face: edge.faces[1], edge: [edge.a, edge.b] });
        adj[edge.faces[1]].push({ face: edge.faces[0], edge: [edge.a, edge.b] });
      }
    return adj;
  }
  function pfNeighbours(solid, fi) {
    return solid.adj[fi].map(n => n.face);
  }

  /* ---------- the rotation group and the mirror map ---------- */
  // Candidates: the 24 rotations of the cubic lattice, plus the sixth-turns a hexagonal prism
  // needs. A candidate is kept only when it maps the solid's own vertex set onto itself, so the
  // group is derived from the geometry rather than hard-coded per shape.
  function pfIsometries(mirrorToo) {
    const out = [];
    const axes = [0, 1, 2];
    for (const px of axes)
      for (const py of axes)
        for (const pz of axes) {
          if (px === py || py === pz || px === pz) continue;
          for (const sx of [1, -1])
            for (const sy of [1, -1])
              for (const sz of [1, -1]) {
                const m = [
                  [0, 0, 0],
                  [0, 0, 0],
                  [0, 0, 0],
                ];
                m[0][px] = sx;
                m[1][py] = sy;
                m[2][pz] = sz;
                const det =
                  m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
                  m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
                  m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
                if (mirrorToo ? det < 0 : det > 0) out.push(m);
              }
        }
    for (let k = 1; k < 6; k++) {
      const t = (k * Math.PI) / 3,
        cos = round(Math.cos(t), 9),
        sin = round(Math.sin(t), 9);
      if (mirrorToo) {
        out.push([
          [cos, sin, 0],
          [sin, -cos, 0],
          [0, 0, 1],
        ]);
        out.push([
          [cos, sin, 0],
          [sin, -cos, 0],
          [0, 0, -1],
        ]);
      } else {
        out.push([
          [cos, -sin, 0],
          [sin, cos, 0],
          [0, 0, 1],
        ]);
        out.push([
          [cos, sin, 0],
          [sin, -cos, 0],
          [0, 0, -1],
        ]);
      }
    }
    return out;
  }
  const PF_ROTS = pfIsometries(false);
  const PF_FLIPS = pfIsometries(true);
  // An isometry of the solid, expressed as the permutation it induces on vertices and faces.
  function pfMaps(solid, m) {
    const vertMap = [];
    for (let i = 0; i < solid.verts.length; i++) {
      const p = pfApply(m, pfSub(solid.verts[i], solid.centre));
      let hit = -1;
      for (let j = 0; j < solid.verts.length; j++) {
        const q = pfSub(solid.verts[j], solid.centre);
        if (Math.abs(p[0] - q[0]) < 1e-5 && Math.abs(p[1] - q[1]) < 1e-5 && Math.abs(p[2] - q[2]) < 1e-5) {
          hit = j;
          break;
        }
      }
      if (hit < 0) return null;
      vertMap.push(hit);
    }
    if (new Set(vertMap).size !== vertMap.length) return null;
    const byKey = new Map();
    solid.faces.forEach((loop, fi) =>
      byKey.set(
        loop
          .slice()
          .sort((x, y) => x - y)
          .join(','),
        fi
      )
    );
    const faceMap = [];
    for (const loop of solid.faces) {
      const key = loop
        .map(v => vertMap[v])
        .sort((x, y) => x - y)
        .join(',');
      if (!byKey.has(key)) return null;
      faceMap.push(byKey.get(key));
    }
    return { m, vertMap, faceMap };
  }
  // The solid's rotation group, as the permutations it makes of faces and vertices. The
  // candidate list holds a couple of matrices twice (a half-turn reached two ways), so the group
  // is deduplicated by the permutation it induces: its size is then the real group order, which
  // scripts/test-dat-pat.cjs pins shape by shape.
  function pfSymmetries(solid) {
    if (!solid.sym) {
      const seen = new Set();
      solid.sym = [];
      for (const m of PF_ROTS) {
        const maps = pfMaps(solid, m);
        if (!maps) continue;
        const key = maps.faceMap.join(',') + '/' + maps.vertMap.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        solid.sym.push(maps);
      }
    }
    return solid.sym;
  }
  function pfMirror(solid) {
    if (solid.flip === undefined) {
      solid.flip = null;
      for (const m of PF_FLIPS) {
        const maps = pfMaps(solid, m);
        if (maps) {
          solid.flip = maps;
          break;
        }
      }
    }
    return solid.flip;
  }
  /* The canonical name of a shading: the smallest description it has over every rotation of the
     solid. Two options with the same canonical name are the same answer seen from two angles,
     which is exactly the failure the ADA's "only one is correct" forbids. */
  function pfConfigKey(solid, config) {
    const sym = pfSymmetries(solid);
    let best = null;
    for (const g of sym) {
      const shaded = config.shaded
        .map(f => g.faceMap[f])
        .sort((x, y) => x - y)
        .join(',');
      const mark = config.marker ? g.faceMap[config.marker.face] + '@' + g.vertMap[config.marker.vert] : '-';
      const key = shaded + '|' + mark;
      if (best === null || key < best) best = key;
    }
    return solid.kind + ':' + solid.dims.join('x') + '#' + best;
  }

  /* ---------- unfolding ---------- */
  // Face-local screen coordinates: origin at the loop's first vertex, x along its first edge,
  // y down the page, laid out as an eye OUTSIDE the solid sees that face. Every face uses the
  // same rule, so the whole net is the outside of the pattern.
  function pfFaceLocal(solid, fi) {
    const loop = solid.faces[fi];
    const o = solid.verts[loop[0]];
    const u = pfUnitVec(pfSub(solid.verts[loop[1]], o));
    const w = pfCross(solid.normals[fi], u);
    const out = {};
    for (const vi of loop) {
      const p = pfSub(solid.verts[vi], o);
      out[vi] = [pfDot(p, u), -pfDot(p, w)];
    }
    return out;
  }
  // The rigid motion (rotation, never a reflection) that carries one placed edge onto another.
  function pfRigid(a1, a2, b1, b2) {
    const da = [a2[0] - a1[0], a2[1] - a1[1]],
      db = [b2[0] - b1[0], b2[1] - b1[1]];
    const la = Math.hypot(da[0], da[1]),
      lb = Math.hypot(db[0], db[1]);
    if (la < PF_EPS || Math.abs(la - lb) > 1e-6) return null;
    return { c: (da[0] * db[0] + da[1] * db[1]) / (la * lb), s: (da[0] * db[1] - da[1] * db[0]) / (la * lb), a1, b1 };
  }
  function pfMove(t, p) {
    const x = p[0] - t.a1[0],
      y = p[1] - t.a1[1];
    return [t.b1[0] + x * t.c - y * t.s, t.b1[1] + x * t.s + y * t.c];
  }
  // A tree is { root, steps: [[child, parent, edgeA, edgeB], …] } in placement order.
  function pfUnfold(solid, tree) {
    if (!tree || !Array.isArray(tree.steps)) return null;
    const place = solid.faces.map(() => null);
    if (!solid.faces[tree.root]) return null;
    place[tree.root] = pfFaceLocal(solid, tree.root);
    const seen = new Set([tree.root]);
    for (const step of tree.steps) {
      const child = step[0],
        parent = step[1],
        ea = step[2],
        eb = step[3];
      if (!solid.faces[child] || !solid.faces[parent] || seen.has(child) || !seen.has(parent)) return null;
      if (!solid.adj[child].some(n => n.face === parent && n.edge[0] === ea && n.edge[1] === eb)) return null;
      const local = pfFaceLocal(solid, child);
      const parentPlace = place[parent];
      if (!local[ea] || !local[eb] || !parentPlace[ea] || !parentPlace[eb]) return null;
      const t = pfRigid(local[ea], local[eb], parentPlace[ea], parentPlace[eb]);
      if (!t) return null;
      const out = {};
      for (const vi of solid.faces[child]) out[vi] = pfMove(t, local[vi]);
      place[child] = out;
      seen.add(child);
    }
    return seen.size === solid.faces.length ? place : null;
  }
  function pfTree(rng, solid) {
    const root = int(rng, 0, solid.faces.length - 1);
    const seen = new Set([root]);
    const steps = [];
    const frontier = shuffled(
      rng,
      solid.adj[root].map(n => ({ parent: root, n }))
    );
    while (frontier.length) {
      const at = int(rng, 0, Math.min(frontier.length, 3) - 1);
      const take = frontier.splice(at, 1)[0];
      if (seen.has(take.n.face)) continue;
      seen.add(take.n.face);
      steps.push([take.n.face, take.parent, take.n.edge[0], take.n.edge[1]]);
      for (const n of shuffled(rng, solid.adj[take.n.face]))
        if (!seen.has(n.face)) frontier.push({ parent: take.n.face, n });
    }
    return seen.size === solid.faces.length ? { root, steps } : null;
  }
  function pfPolys(solid, place) {
    return solid.faces.map((loop, fi) => loop.map(vi => place[fi][vi]));
  }
  function pfShrink(poly, k) {
    const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length,
      cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    return poly.map(p => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]);
  }
  // Separating-axis test on two convex polygons, each pulled 6 % toward its own centre so that
  // faces meeting along a fold line do not read as an overlap.
  function pfHits(A, B) {
    for (const poly of [A, B])
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i],
          b = poly[(i + 1) % poly.length];
        const ax = -(b[1] - a[1]),
          ay = b[0] - a[0];
        let minA = Infinity,
          maxA = -Infinity,
          minB = Infinity,
          maxB = -Infinity;
        for (const p of A) {
          const d = p[0] * ax + p[1] * ay;
          minA = Math.min(minA, d);
          maxA = Math.max(maxA, d);
        }
        for (const p of B) {
          const d = p[0] * ax + p[1] * ay;
          minB = Math.min(minB, d);
          maxB = Math.max(maxB, d);
        }
        if (maxA <= minB + PF_EPS || maxB <= minA + PF_EPS) return false;
      }
    return true;
  }
  function pfNetOverlaps(solid, place) {
    const polys = pfPolys(solid, place).map(poly => pfShrink(poly, 0.94));
    for (let i = 0; i < polys.length; i++)
      for (let j = i + 1; j < polys.length; j++) if (pfHits(polys[i], polys[j])) return true;
    return false;
  }

  /* ---------- drawing ---------- */
  function pfProject(p) {
    return [(p[0] - p[1]) * PF_UNIT.w, (p[0] + p[1]) * PF_UNIT.h - p[2] * PF_UNIT.z];
  }
  function pfViewPool(kind) {
    return kind === 'hex' ? PF_ROTS.length : 24;
  }
  // A viewpoint is a turn of the solid under the fixed isometric eye. It is usable when no face
  // is edge-on — which would leave a gap in the outline — and when the drawing shows at least
  // three faces with shading on some and not on others, so the picture can be told from its
  // rivals by what it actually shows.
  function pfViewFaces(solid, view) {
    const m = PF_ROTS[view];
    if (!m) return null;
    const lit = [];
    for (let fi = 0; fi < solid.faces.length; fi++) {
      const d = pfDot(pfApply(m, solid.normals[fi]), PF_VIEW);
      if (Math.abs(d) < PF_VIEW_FLOOR) return null;
      if (d > 0) lit.push(fi);
    }
    return lit;
  }
  function pfPoints(solid, view) {
    return solid.verts.map(v => pfProject(pfApply(PF_ROTS[view], pfSub(v, solid.centre))));
  }
  function pfBounds(points) {
    const xs = points.map(p => p[0]),
      ys = points.map(p => p[1]);
    return {
      x0: Math.min.apply(null, xs),
      x1: Math.max.apply(null, xs),
      y0: Math.min.apply(null, ys),
      y1: Math.max.apply(null, ys),
    };
  }
  function pfMarkerPoly(loop, at, pointOf) {
    const i = loop.indexOf(at);
    if (i < 0) return null;
    const v = pointOf(at),
      prev = pointOf(loop[(i + loop.length - 1) % loop.length]),
      next = pointOf(loop[(i + 1) % loop.length]);
    const lerp = (from, to, k) => [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k];
    return [v, lerp(v, next, 0.34), lerp(v, prev, 0.34)];
  }
  /* What one option actually puts on the page: its front-facing faces, each filled plain or
     shaded, plus the corner mark when it is on a face you can see. pfPictureKey() hashes exactly
     this at unit scale, because two options that differ only on the faces turned away from the
     eye would reach the learner as the same picture and the item would have two right answers. */
  function pfPicture(solidKind, option, view, scale) {
    const solid = pfSolid(solidKind, option.dims);
    const lit = pfViewFaces(solid, view) || [];
    const pts = pfPoints(solid, view);
    const box = pfBounds(
      lit.length ? lit.reduce((all, fi) => all.concat(solid.faces[fi].map(vi => pts[vi])), []) : pts
    );
    const ox = PF_OPT_W / 2 - ((box.x0 + box.x1) / 2) * scale,
      oy = PF_OPT_H / 2 - ((box.y0 + box.y1) / 2) * scale;
    const at = vi => [round(ox + pts[vi][0] * scale, 2), round(oy + pts[vi][1] * scale, 2)];
    const faces = lit.map(fi => ({ fi, points: solid.faces[fi].map(at), shaded: option.shaded.includes(fi) }));
    const marker =
      option.marker && lit.includes(option.marker.face)
        ? pfMarkerPoly(solid.faces[option.marker.face], option.marker.vert, at)
        : null;
    return { faces, marker };
  }
  // Every drawing has to show some shading and some plain face. A candidate whose shaded faces
  // all happen to be turned away would reach the page as a blank solid beside a net with shaded
  // regions, which reads as a broken drawing rather than as a wrong answer.
  function pfPictureTells(solidKind, option, view) {
    const parts = pfPicture(solidKind, option, view, 1);
    return parts.faces.some(f => f.shaded) && parts.faces.some(f => !f.shaded);
  }
  function pfPictureKey(solidKind, option, view) {
    const parts = pfPicture(solidKind, option, view, 1);
    return (
      parts.faces
        .map(f => (f.shaded ? '#' : '.') + f.points.map(p => p.join(',')).join(' '))
        .sort()
        .join('|') + (parts.marker ? '!' + parts.marker.map(p => round(p[0], 2) + ',' + round(p[1], 2)).join(' ') : '')
    );
  }
  // One scale for all four options, taken from the widest of them: the exam draws the candidates
  // at one size, so a size difference must never be the tell.
  function pfOptionScale(params) {
    let wide = 1,
      tall = 1;
    for (const option of params.options) {
      const box = pfBounds(pfPoints(pfSolid(params.kind, option.dims), params.view));
      wide = Math.max(wide, box.x1 - box.x0);
      tall = Math.max(tall, box.y1 - box.y0);
    }
    return Math.min((PF_OPT_W - 22) / wide, (PF_OPT_H - 22) / tall);
  }
  function pfOptionSvg(params, index) {
    const parts = pfPicture(params.kind, params.options[index], params.view, pfOptionScale(params));
    let body = '';
    for (const face of parts.faces) body += polygon(face.points, face.shaded ? PF_SHADE : FACE);
    if (parts.marker) body += polygon(parts.marker, PF_MARK);
    return svgWrap(
      PF_OPT_W,
      PF_OPT_H,
      'Isometric drawing of a folded solid, option ' + letterFor(index),
      'dat-pat-svg dat-pat-pattern-option',
      body
    );
  }
  function pfNetFigure(params, opts) {
    const solid = pfSolid(params.kind, params.dims);
    const place = pfUnfold(solid, params.tree);
    const width = (opts && opts.width) || PF_NET_W,
      height = (opts && opts.height) || PF_NET_H;
    if (!place) return svgWrap(width, height, 'Flat pattern', 'dat-pat-svg dat-pat-pattern-net', '');
    const polys = pfPolys(solid, place);
    const box = pfBounds(polys.reduce((all, poly) => all.concat(poly), []));
    const scale = Math.min(
      (width - 24) / Math.max(0.001, box.x1 - box.x0),
      (height - 24) / Math.max(0.001, box.y1 - box.y0)
    );
    const at = p => [
      round(width / 2 + (p[0] - (box.x0 + box.x1) / 2) * scale, 2),
      round(height / 2 + (p[1] - (box.y0 + box.y1) / 2) * scale, 2),
    ];
    let body = '';
    polys.forEach((poly, fi) => {
      body += polygon(poly.map(at), params.shaded.includes(fi) ? PF_SHADE : FACE);
    });
    // Every region's outline is stroked after all the fills, so the lines between regions are
    // solid: the [ADA] convention is that a fold happens along a solid line.
    polys.forEach(poly => {
      body += polygon(poly.map(at), INK);
    });
    if (params.marker) {
      const poly = pfMarkerPoly(solid.faces[params.marker.face], params.marker.vert, vi =>
        at(place[params.marker.face][vi])
      );
      if (poly) body += polygon(poly, PF_MARK);
    }
    if (opts && opts.numbers)
      polys.forEach((poly, fi) => {
        const pts = poly.map(at);
        body += text(
          pts.reduce((s, p) => s + p[0], 0) / pts.length,
          pts.reduce((s, p) => s + p[1], 0) / pts.length + 4,
          String(fi + 1),
          LABEL
        );
      });
    return svgWrap(
      width,
      height,
      'Flat pattern of ' + solid.faces.length + ' regions that folds into a solid',
      'dat-pat-svg dat-pat-pattern-net',
      body
    );
  }

  /* ---------- shading, distractors and the generator ---------- */
  function pfPickShaded(rng, solid, count) {
    const order = shuffled(
      rng,
      solid.faces.map((_, i) => i)
    );
    const shaded = [order[0]];
    while (shaded.length < count) {
      // Grow the patch along the face graph where it can, so the net shows a connected region
      // whose adjacency is the thing the item is really about.
      const rest = order.filter(f => !shaded.includes(f));
      const touching = rest.filter(f => shaded.some(s => pfNeighbours(solid, s).includes(f)));
      const next = (touching.length ? touching : rest)[0];
      if (next === undefined) break;
      shaded.push(next);
    }
    return shaded.sort((a, b) => a - b);
  }
  // The wrong-shape option changes one edge length, never by so much that size alone would
  // separate it from the rest: a solid drawn half the size of its rivals is a different question.
  function pfTweak(rng, kind, dims) {
    for (const tweak of shuffled(rng, PF_SOLIDS[kind].tweaks))
      for (const sign of shuffled(rng, [1, -1])) {
        const next = dims.slice();
        next[tweak[0]] += sign * tweak[1];
        if (next[tweak[0]] * 1.75 < dims[tweak[0]] || next[tweak[0]] > dims[tweak[0]] * 1.75) continue;
        if (pfDimsOk(kind, next)) return next;
      }
    return null;
  }
  /* The four wrong answers the teachers name (RESEARCH §4.6): the shading slid onto the face
     next door, the shading jumped to a face that touches nothing shaded, the mirror-image fold,
     a solid with one face shape changed, and — once a corner mark exists — the mark turned to
     another corner of its own face. */
  function pfCandidates(rng, solid, config) {
    const out = [];
    const unshaded = solid.faces.map((_, i) => i).filter(f => !config.shaded.includes(f));
    const swap = (from, to) => ({
      dims: solid.dims.slice(),
      shaded: config.shaded.map(f => (f === from ? to : f)).sort((a, b) => a - b),
      marker: config.marker && config.marker.face === from ? null : config.marker,
    });
    const centre = fi => pfMean(solid.faces[fi].map(v => solid.verts[v]));
    for (const from of shuffled(rng, config.shaded)) {
      const rest = config.shaded.filter(f => f !== from);
      const near = shuffled(rng, unshaded).filter(t => rest.some(s => pfNeighbours(solid, s).includes(t)));
      const far = shuffled(rng, unshaded).filter(t => !rest.some(s => pfNeighbours(solid, s).includes(t)));
      // "Opposite" is the face whose centre is furthest from this one — on a box that is the
      // parallel face across the solid, which is the move DESIGN §6 names first.
      const here = centre(from);
      const across = unshaded
        .slice()
        .sort(
          (a, b) =>
            pfDot(pfSub(centre(b), here), pfSub(centre(b), here)) -
            pfDot(pfSub(centre(a), here), pfSub(centre(a), here))
        );
      if (across.length) out.push(Object.assign(swap(from, across[0]), { kind: 'opposite' }));
      if (near.length) out.push(Object.assign(swap(from, near[0]), { kind: 'slid' }));
      if (far.length) out.push(Object.assign(swap(from, far[0]), { kind: 'moved' }));
    }
    const flip = pfMirror(solid);
    if (flip)
      out.push({
        kind: 'mirror',
        dims: solid.dims.slice(),
        shaded: config.shaded.map(f => flip.faceMap[f]).sort((a, b) => a - b),
        marker: config.marker
          ? { face: flip.faceMap[config.marker.face], vert: flip.vertMap[config.marker.vert] }
          : null,
      });
    const tweaked = pfTweak(rng, solid.kind, solid.dims);
    if (tweaked) out.push({ kind: 'altered', dims: tweaked, shaded: config.shaded.slice(), marker: config.marker });
    if (config.marker)
      for (const vert of shuffled(
        rng,
        solid.faces[config.marker.face].filter(v => v !== config.marker.vert)
      ))
        out.push({
          kind: 'turned',
          dims: solid.dims.slice(),
          shaded: config.shaded.slice(),
          marker: { face: config.marker.face, vert },
        });
    return out;
  }
  // Keep the answer plus the first three rivals that are neither the same answer turned round
  // (the canonical key over the rotation group) nor the same picture (what is drawn).
  function pfChoose(rng, solid, config, view) {
    const answer = { kind: 'answer', dims: solid.dims.slice(), shaded: config.shaded.slice(), marker: config.marker };
    const keep = [answer];
    const keys = new Set([pfConfigKey(solid, answer)]);
    const drawn = new Set([pfPictureKey(solid.kind, answer, view)]);
    // The mirror-image fold is the trap every teacher names, so it is offered whenever it is a
    // genuinely different solid — on a shading that happens to be its own mirror it is not, and
    // the rotation-group key throws it out below rather than letting a second key onto the page.
    const pool = pfCandidates(rng, solid, config);
    const ordered = pool
      .filter(o => o.kind === 'mirror')
      .concat(
        shuffled(
          rng,
          pool.filter(o => o.kind !== 'mirror')
        )
      );
    for (const option of ordered) {
      if (keep.length === 4) break;
      const key = pfConfigKey(pfSolid(solid.kind, option.dims), option);
      if (keys.has(key)) continue;
      if (!pfPictureTells(solid.kind, option, view)) continue;
      const picture = pfPictureKey(solid.kind, option, view);
      if (drawn.has(picture)) continue;
      keys.add(key);
      drawn.add(picture);
      keep.push(option);
    }
    return keep.length === 4 ? keep : null;
  }
  function pfBuild(seed, level) {
    const spec = PF_LEVELS[level];
    for (let attempt = 0; attempt < 24; attempt++) {
      const rng = mulberry32(hash('patterns:model:' + seed + ':' + level + ':' + attempt));
      const kind = pick(rng, spec.kinds);
      const dims = pick(rng, PF_SOLIDS[kind].dims);
      if (!pfDimsOk(kind, dims)) continue;
      const solid = pfSolid(kind, dims);
      const tree = pfTree(rng, solid);
      if (!tree) continue;
      const place = pfUnfold(solid, tree);
      if (!place || pfNetOverlaps(solid, place)) continue;
      const shaded = pfPickShaded(rng, solid, Math.min(spec.shaded, solid.faces.length - 2));
      const markFace = spec.marker ? pick(rng, shaded) : -1;
      const config = {
        shaded,
        marker: spec.marker ? { face: markFace, vert: pick(rng, solid.faces[markFace]) } : null,
      };
      const views = shuffled(
        rng,
        Array.from({ length: pfViewPool(kind) }, (_, i) => i)
      );
      for (const view of views) {
        const lit = pfViewFaces(solid, view);
        if (!lit || lit.length < 3) continue;
        if (!lit.some(f => shaded.includes(f)) || !lit.some(f => !shaded.includes(f))) continue;
        const built = pfChoose(rng, solid, config, view);
        if (built) return { kind, dims, tree, shaded, marker: config.marker, view, options: built };
      }
    }
    return null;
  }
  /* The last-resort item. It is a real item, not a placeholder: a seed that defeats every
     attempt above is handed a different seed, deterministically, until one of them builds. The
     pools are wide enough that this never runs in practice, and scripts/test-dat-pat.cjs pins
     that by generating every level over hundreds of seeds. */
  function pfFallback(level) {
    for (let step = 1; step < 200; step++) {
      const built = pfBuild(step * 7919, level);
      if (built) return built;
    }
    return null;
  }
  function genPatterns(seed, level) {
    const lvl = levelOf(level);
    let built = null;
    for (let attempt = 0; attempt < 8 && !built; attempt++) built = pfBuild(seed + attempt * 1000003, lvl);
    if (!built) built = pfFallback(lvl);
    const order = shuffled(rngFor('patterns', seed, lvl, 'order'), built.options);
    const params = {
      kind: built.kind,
      dims: built.dims.slice(),
      tree: { root: built.tree.root, steps: built.tree.steps.map(s => s.slice()) },
      shaded: built.shaded.slice(),
      marker: built.marker ? { face: built.marker.face, vert: built.marker.vert } : null,
      view: built.view,
      options: order.map(o => ({
        kind: o.kind,
        dims: o.dims.slice(),
        shaded: o.shaded.slice(),
        marker: o.marker ? { face: o.marker.face, vert: o.marker.vert } : null,
      })),
    };
    const answer = params.options.findIndex(o => o.kind === 'answer');
    const solid = pfSolid(params.kind, params.dims);
    return {
      id: itemId('patterns', seed, lvl),
      section: 'pat',
      category: 'PAT-FOLD',
      skill: 'skill-2',
      format: 'pat',
      subtest: 'patterns',
      seed,
      level: lvl,
      stem: 'The flat pattern on the left folds along every solid line into a closed solid, and the side you can see now stays on the outside. Which of the four drawings is that solid?',
      figure: pfNetFigure(params),
      optionKind: 'svg',
      options: params.options.map((_, i) => pfOptionSvg(params, i)),
      answer,
      explanation:
        'The pattern has ' +
        solid.faces.length +
        ' regions, so it closes into a ' +
        PF_SOLIDS[params.kind].label +
        ', and ' +
        (params.shaded.length === 1 ? 'one region is shaded' : params.shaded.length + ' regions are shaded') +
        '. Fold away from yourself: every region swings back along the line it shares with its neighbour, so regions that touch in the pattern still touch on the solid and the shading keeps the way it faces. ' +
        letterFor(answer) +
        ' is the only drawing that puts every shaded face where the pattern puts it. The rest ' +
        params.options
          .filter(o => o.kind !== 'answer')
          .map(o => PF_SHORT[o.kind])
          .join(', ') +
        '.',
      params,
    };
  }
  function verifyPatterns(item) {
    const p = item.params;
    if (!p || !PF_SOLIDS[p.kind] || !Array.isArray(p.dims) || !pfDimsOk(p.kind, p.dims)) return false;
    if (!Array.isArray(p.options) || p.options.length !== 4) return false;
    const solid = pfSolid(p.kind, p.dims);
    // The net must be a real unfolding of this solid: a spanning tree of the face graph over
    // edges the two faces actually share, with no region lying on top of another.
    const place = pfUnfold(solid, p.tree);
    if (!place || pfNetOverlaps(solid, place)) return false;
    if (!Array.isArray(p.shaded) || !p.shaded.length || p.shaded.length >= solid.faces.length) return false;
    if (p.shaded.some(f => !solid.faces[f])) return false;
    if (p.marker && (!solid.faces[p.marker.face] || !solid.faces[p.marker.face].includes(p.marker.vert))) return false;
    const lit = pfViewFaces(solid, p.view);
    if (!lit || lit.length < 3) return false;
    if (!lit.some(f => p.shaded.includes(f)) || !lit.some(f => !p.shaded.includes(f))) return false;
    // Uniqueness under the rotation group: no option may be the truth turned round, and no two
    // options may be the same solid seen from another angle.
    const truth = pfConfigKey(solid, { shaded: p.shaded, marker: p.marker || null });
    const keys = p.options.map(o => pfConfigKey(pfSolid(p.kind, o.dims), o));
    if (new Set(keys).size !== keys.length) return false;
    if (keys.filter(k => k === truth).length !== 1) return false;
    if (keys[item.answer] !== truth) return false;
    const drawn = p.options.map(o => pfPictureKey(p.kind, o, p.view));
    if (new Set(drawn).size !== drawn.length) return false;
    if (!p.options.every(o => pfPictureTells(p.kind, o, p.view))) return false;
    return true;
  }
  function explainPatterns(item) {
    const p = item.params;
    const solid = pfSolid(p.kind, p.dims);
    const lit = pfViewFaces(solid, p.view) || [];
    const touching = p.shaded.some(f => pfNeighbours(solid, f).some(n => p.shaded.includes(n)));
    return [
      {
        title: 'Number the regions',
        text:
          'The pattern has ' +
          solid.faces.length +
          ' regions and closes into a ' +
          PF_SOLIDS[p.kind].label +
          '. Regions that share a line in the pattern share an edge on the solid, so this numbering is also a map of what ends up next to what. Shaded regions: ' +
          p.shaded.map(f => f + 1).join(', ') +
          '.',
        svg: pfNetFigure(p, { numbers: true }),
      },
      {
        title: 'Fold away from yourself',
        text:
          'Each region swings back along the line it shares with its neighbour, so the face you are looking at now ends up on the outside. Folding the other way — toward you — builds the mirror image, which is why one wrong drawing looks so nearly right. ' +
          (p.shaded.length === 1
            ? 'The one shaded region lands on a single face, and the faces around it are the regions that surround it in the pattern.'
            : touching
              ? 'Two shaded regions touch in the pattern, so those two faces share an edge on the solid.'
              : 'No two shaded regions touch in the pattern, so no two shaded faces may share an edge on the solid.'),
        svg: pfOptionSvg(p, item.answer),
      },
      {
        title: 'Read only the faces you can see',
        text:
          'This viewpoint shows ' +
          lit.length +
          ' of the ' +
          solid.faces.length +
          ' faces, and ' +
          lit.filter(f => p.shaded.includes(f)).length +
          ' of those are shaded on the correct solid' +
          (p.marker
            ? ', with the corner mark at the same corner of its face as in the pattern — shading and marks keep their orientation through a fold.'
            : '. The faces turned away never decide the item, so check the three you can see and stop.'),
        svg: '',
      },
      {
        title: 'Rule the other options out',
        text: p.options.map((o, i) => letterFor(i) + ': ' + PF_FAULT[o.kind]).join(' · '),
        svg: '',
      },
    ];
  }

  /* ---------- public surface ---------- */
  // Option letters in explain() text. The page owns the real letters (LETTERS in app.js); this is
  // the same A, B, C… sequence so a review step can name an option without importing the page.
  function letterFor(index) {
    return String.fromCharCode(65 + index);
  }
  const GENERATORS = {
    keyholes: genKeyholes,
    tfe: genTfe,
    angles: genAngles,
    holes: genHoles,
    cubes: genCubes,
    patterns: genPatterns,
  };
  const VERIFIERS = {
    keyholes: verifyKeyholes,
    tfe: verifyTfe,
    angles: verifyAngles,
    holes: verifyHoles,
    cubes: verifyCubes,
    patterns: verifyPatterns,
  };
  const EXPLAINERS = {
    keyholes: explainKeyholes,
    tfe: explainTfe,
    angles: explainAngles,
    holes: explainHoles,
    cubes: explainCubes,
    patterns: explainPatterns,
  };

  function generate(subtest, seed, level) {
    const gen = GENERATORS[subtest];
    if (!gen) throw Error('PAT subtest not built yet: ' + subtest);
    const s = Number.isFinite(Number(seed)) ? Math.abs(Math.trunc(Number(seed))) : 0;
    return gen(s, levelOf(level));
  }
  function fromId(id) {
    const parsed = parseId(id);
    if (!parsed || !GENERATORS[parsed.subtest]) return null;
    return generate(parsed.subtest, parsed.seed, parsed.level);
  }
  function verify(item) {
    if (!item || !VERIFIERS[item.subtest]) return false;
    if (!Array.isArray(item.options) || item.options.length !== optionsFor(item.subtest)) return false;
    if (new Set(item.options).size !== item.options.length) return false;
    if (!Number.isInteger(item.answer) || item.answer < 0 || item.answer >= item.options.length) return false;
    return VERIFIERS[item.subtest](item);
  }
  // Every figure and every SVG option is rebuilt from params, so a stripped record renders.
  function render(record) {
    if (!record || !record.params) return { figure: '', options: [], optionKind: 'text' };
    // A stripped record has no options array; its id is enough to rebuild the whole item.
    const item = Array.isArray(record.options) ? record : fromId(record.id) || record;
    if (!item.params) return { figure: '', options: [], optionKind: 'text' };
    if (item.subtest === 'angles')
      return { figure: anglesFigure(item.params, {}), options: item.options.slice(), optionKind: 'text' };
    if (item.subtest === 'cubes')
      return { figure: cubesFigure(item.params), options: CUBE_OPTIONS.slice(), optionKind: 'text' };
    if (item.subtest === 'holes')
      return {
        figure: holesFigure(item.params),
        options: item.params.optionPatterns.map((key, i) => holeOption(key, i)),
        optionKind: 'svg',
      };
    if (item.subtest === 'keyholes')
      return {
        figure: keyholeFigure(item.params),
        options: item.params.options.map((option, i) => apertureSvg(option, i)),
        optionKind: 'svg',
      };
    if (item.subtest === 'tfe')
      return {
        figure: tfeFigure(item.params),
        options: item.params.recipes.map((_, i) => tfeOptionSvg(item.params, i)),
        optionKind: 'svg',
      };
    if (item.subtest === 'patterns')
      return {
        figure: pfNetFigure(item.params),
        options: item.params.options.map((_, i) => pfOptionSvg(item.params, i)),
        optionKind: 'svg',
      };
    return { figure: '', options: [], optionKind: 'text' };
  }
  function explain(item) {
    if (!item || !EXPLAINERS[item.subtest]) return [];
    return EXPLAINERS[item.subtest](item);
  }
  // The persistable record: ids, the regeneration triple, params and the answer. No markup
  // ever reaches storage (study-backup.js rejects it; DESIGN §9 risk 5).
  function strip(item) {
    if (!item) return null;
    return {
      id: item.id,
      section: item.section,
      category: item.category,
      subtest: item.subtest,
      seed: item.seed,
      level: item.level,
      optionKind: item.optionKind,
      answer: item.answer,
      params: JSON.parse(JSON.stringify(item.params)),
    };
  }
  function restore(record) {
    return record ? fromId(record.id) : null;
  }

  /* set() balances the answer letter over a set by choosing seeds, never by rearranging a
     generated item: an item must stay byte-identical to generate(subtest, seed, level) or the
     stored triple would regenerate a different option order in review.

     Ties are broken with the set's own seeded rng. Taking the first letter with the lowest count
     instead walks A→B→C→D in strict rotation, and because a 15-item set is not a whole number of
     4-letter cycles the truncated last cycle always drops the same letter: D was correct 3 times
     to A/B/C's 4 in nearly every angles set. A random tie-break moves the short letter around. */
  // The letter that owes the most, ties broken at random so no letter is structurally short.
  function leastUsed(rng, counts) {
    const min = Math.min.apply(null, counts);
    const tied = [];
    for (let i = 0; i < counts.length; i++) if (counts[i] === min) tied.push(i);
    return tied[Math.floor(rng() * tied.length)];
  }
  function set(subtest, seedBase, level, n) {
    const lvl = levelOf(level);
    const want = Number.isFinite(Number(n)) && Number(n) > 0 ? Math.min(Math.trunc(Number(n)), 120) : 15;
    if (subtest === 'cubes') return cubeSet(seedBase, lvl, want);
    const rng = mulberry32(hash('set:' + subtest + ':' + seedBase + ':' + lvl + ':' + want));
    const counts = new Array(optionsFor(subtest)).fill(0);
    const items = [];
    let seed = Math.max(1, Math.trunc(Number(seedBase) || 1));
    while (items.length < want) {
      const target = leastUsed(rng, counts);
      let best = null;
      for (let t = 0; t < 12; t++) {
        const item = generate(subtest, seed + t, lvl);
        if (!best || counts[item.answer] < counts[best.item.answer]) best = { item, t };
        if (item.answer === target) {
          best = { item, t };
          break;
        }
      }
      items.push(best.item);
      counts[best.item.answer]++;
      seed += best.t + 1;
    }
    return items;
  }
  /* Cube questions come in runs of 2-4 on one figure, the way the exam presents them, so the
     balancing choice is which figure and which of its answerable counts to ask. A figure is
     scored first on how many of the set's neediest answers it can supply and only then on the
     cost of its cheapest questions: scoring on cost alone makes small figures — which mostly
     offer one- and two-cube classes — crowd out the four- and five-cube answers, which is how
     "5 cubes" ended up correct 4% of the time at level 1 instead of 20%. */
  function cubeSet(seedBase, level, want) {
    const rng = mulberry32(hash('cubes:set:' + seedBase + ':' + level + ':' + want));
    const counts = new Array(5).fill(0);
    const items = [];
    let figureSeed = Math.max(1, Math.floor((Number(seedBase) || 8) / 8));
    let guard = 0;
    while (items.length < want && guard++ < 400) {
      // A figure is read and rebuilt once and then asked 2-4 times [DESIGN §6], so the tail of the
      // set is planned rather than truncated: never take more questions than the set still wants,
      // and never leave exactly one behind — a lone question on a fresh figure is the worst value
      // for the work it costs. Both adjustments stay inside the 2-4 band.
      const left = want - items.length;
      let perFigure = Math.min(Math.max(2, Math.min(CUBE_LEVELS[level].questions, 4)), Math.max(2, left));
      if (left - perFigure === 1) perFigure = left <= 4 ? left : perFigure - 1;
      // The perFigure answers this set owes the most, ties broken at random (the jitter is < 1,
      // so it only ever reorders equal counts).
      const targets = counts
        .map((c, i) => [c + rng(), i + 1])
        .sort((a, b) => a[0] - b[0])
        .slice(0, perFigure)
        .map(pair => pair[1]);
      let best = null;
      for (let t = 0; t < 40; t++) {
        const fig = cubeFigure(figureSeed + t, level);
        const offered = new Set(fig.questions.map(q => fig.tally[q]));
        const missed = targets.filter(want_ => !offered.has(want_)).length;
        // Score the figure on the cheapest perFigure answers it can offer, not on all of them.
        const cost = fig.questions
          .map(q => counts[fig.tally[q] - 1])
          .sort((a, b) => a - b)
          .slice(0, perFigure)
          .reduce((s, v) => s + v, 0);
        // A figure that cannot be asked perFigure times leaves the tail of the set one question
        // short of a whole group, so having enough questions to ask outranks answer balance.
        const short = Math.max(0, perFigure - fig.questions.length);
        const score = short * 100000 + missed * 1000 + cost;
        if (!best || score < best.score) best = { t, fig, score };
        if (score === 0) break;
      }
      const fig = best.fig;
      const slots = [];
      const available = fig.questions.map((q, i) => i);
      while (slots.length < perFigure && available.length) {
        const owed = i => counts[fig.tally[fig.questions[available[i]]] - 1];
        let low = owed(0);
        for (let i = 1; i < available.length; i++) low = Math.min(low, owed(i));
        const tied = [];
        for (let i = 0; i < available.length; i++) if (owed(i) === low) tied.push(i);
        const slot = available.splice(tied[Math.floor(rng() * tied.length)], 1)[0];
        slots.push(slot);
        counts[fig.tally[fig.questions[slot]] - 1]++;
      }
      for (const slot of slots.sort((a, b) => a - b)) {
        if (items.length >= want) break;
        items.push(generate('cubes', (figureSeed + best.t) * 8 + slot, level));
      }
      figureSeed += best.t + 1;
    }
    return items.slice(0, want);
  }
  /* formItems(spec): either an explicit list (ids or triples, used by rehearsal forms) or a
     description of a mixed set in ADA subtest order. */
  function formItems(spec) {
    if (Array.isArray(spec))
      return spec
        .map(entry => (typeof entry === 'string' ? fromId(entry) : generate(entry.subtest, entry.seed, entry.level)))
        .filter(Boolean);
    const config = spec || {};
    const order = (config.order || SUBTESTS.map(s => s.id)).filter(isBuilt);
    const level = levelOf(config.level);
    const per = Number.isFinite(Number(config.per)) ? Number(config.per) : 15;
    const base = Math.max(1, Math.trunc(Number(config.seedBase) || 1));
    return order.reduce((out, subtest, i) => out.concat(set(subtest, base + i * 10007, level, per)), []);
  }

  const api = {
    SUBTESTS,
    BUILT,
    LEVELS,
    ANGLE_FLOOR,
    CUBE_OPTIONS,
    mulberry32,
    hash,
    rngFor,
    isBuilt,
    levelOf,
    optionsFor,
    subtestSpec,
    itemId,
    parseId,
    generate,
    fromId,
    verify,
    render,
    explain,
    strip,
    restore,
    set,
    formItems,
    angleMinGap,
    cubeFigure,
    cubeAnalysis,
    isHidden,
    paintedFaces,
    isoFigure,
    voxelBox,
    voxelBody,
    simulateHoles,
    triSide,
    foldPos,
    trianglesOf,
    HOLE_LEVELS,
    KEY_UNIT,
    KEY_CANVAS,
    KEY_ISO,
    KEY_LEVELS,
    keyholeSilhouettes,
    keyholeValid,
    maskClass,
    maskKeyOf,
    maskFrom,
    TFE_VIEWS,
    TFE_UNIT,
    tfeOcc,
    tfeLines,
    tfeDims,
    tfeSolid,
    tfeOptionLines,
    lineCount,
    linesKey,
    PF_SOLIDS,
    PF_LEVELS,
    pfSolid,
    pfUnfold,
    pfNetOverlaps,
    pfPolys,
    pfSymmetries,
    pfMirror,
    pfConfigKey,
    pfViewFaces,
    pfPictureKey,
    pfPictureTells,
    pfNeighbours,
    pfBuild,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DatPatCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
