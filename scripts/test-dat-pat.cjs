/* DatPatCore, all six subtests: apertures, view recognition, angles, hole punching, cube
   counting and pattern folding.
   The contract this file holds the generators to is DESIGN §6 plus the ADA validity rules in
   RESEARCH §4.1-§4.5: an item is a pure function of (subtest, seed, level), its id regenerates
   it exactly, exactly one option is true, every figure is well-formed inert SVG, angle gaps
   never drop below the live-exam floor of 3°, a hole count always equals the paper thickness
   at the punch, a cube tally always adds up to the cube count with no zero answer, exactly one
   aperture lies in the object's own silhouette class at the object's own scale, and counting the
   lines in a view-recognition option never singles the key out, and a pattern-folding net is a
   real non-overlapping unfolding whose four solids stay distinct under the solid's own rotation
   group. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const Core = require('../dat-pat-engine.js');

const BUILT = ['keyholes', 'tfe', 'angles', 'holes', 'cubes', 'patterns'];
const LEVELS = [1, 2, 3];
const parser = new new JSDOM('').window.DOMParser();

function each(fn, seeds = 60) {
  for (const subtest of BUILT)
    for (const level of LEVELS) for (let seed = 1; seed <= seeds; seed++) fn(subtest, seed, level);
}
function assertSvg(svg, where) {
  assert.match(svg, /^<svg [^>]*viewBox="/, where + ' starts with a viewBox');
  assert.match(svg, /role="img"/, where + ' role');
  assert.match(svg, /aria-label="/, where + ' aria-label');
  assert.doesNotMatch(svg, /<script|href=|xlink|<foreignObject|on[a-z]+=/i, where + ' is inert');
  const doc = parser.parseFromString(svg, 'image/svg+xml');
  assert.equal(doc.querySelector('parsererror'), null, where + ' parses');
  const box = doc.documentElement.getAttribute('viewBox').split(' ').map(Number);
  assert.ok(box[2] > 0 && box[2] <= 640, where + ' is at most 640 units wide (' + box[2] + ')');
  assert.ok(box[3] > 0, where + ' has a height');
}

test('all six ADA subtests are built, in order, at the ADA option counts', () => {
  assert.deepEqual(Core.BUILT, BUILT);
  assert.deepEqual(
    Core.SUBTESTS.map(s => s.id),
    ['keyholes', 'tfe', 'angles', 'holes', 'cubes', 'patterns']
  );
  // Option counts are fixed per subtest by the ADA and are never a house choice.
  assert.deepEqual(
    Core.SUBTESTS.map(s => s.options),
    [5, 4, 4, 5, 5, 4]
  );
  // A subtest that does not exist still fails loudly rather than serving something plausible.
  assert.equal(Core.isBuilt('nonsense'), false);
  assert.throws(() => Core.generate('nonsense', 1, 2), /not built yet/);
  assert.equal(Core.fromId('pat-nonsense-s1-l2'), null);
});

test('the same id always rebuilds the same item, and fromId round-trips', () => {
  each((subtest, seed, level) => {
    const first = Core.generate(subtest, seed, level);
    const second = Core.generate(subtest, seed, level);
    assert.deepEqual(second, first, subtest + ' ' + seed + ' ' + level + ' is deterministic');
    assert.equal(first.id, Core.itemId(subtest, seed, level));
    assert.deepEqual(Core.parseId(first.id), { subtest, seed, level });
    assert.deepEqual(Core.fromId(first.id), first, first.id + ' round-trips');
  }, 200);
});

test('every item verifies: one true option, distinct options, an in-range answer and the right count', () => {
  each((subtest, seed, level) => {
    const item = Core.generate(subtest, seed, level);
    const where = item.id;
    assert.equal(item.section, 'pat', where);
    assert.equal(item.format, 'pat', where);
    assert.equal(item.subtest, subtest, where);
    assert.equal(item.level, level, where);
    assert.equal(item.category, Core.subtestSpec(subtest).category, where);
    assert.equal(item.options.length, Core.optionsFor(subtest), where + ' option count');
    assert.equal(new Set(item.options).size, item.options.length, where + ' options distinct');
    assert.ok(Number.isInteger(item.answer) && item.answer >= 0 && item.answer < item.options.length, where);
    assert.ok(item.stem.length > 20 && item.explanation.length > 20, where + ' text');
    assert.doesNotMatch(item.stem, /<|ADA|Bootcamp|Booster|Kaplan|Crack DAT/i, where + ' stem is clean');
    assert.ok(Core.verify(item), where + ' verifies');
    // verify() must be an independent recomputation: break the record and it must refuse.
    const broken = JSON.parse(JSON.stringify(item));
    broken.answer = (broken.answer + 1) % broken.options.length;
    assert.equal(Core.verify(broken), false, where + ' verify rejects a moved key');
  });
});

test('figures, option graphics and explain steps are well-formed inert SVG', () => {
  each((subtest, seed, level) => {
    const item = Core.generate(subtest, seed, level);
    assertSvg(item.figure, item.id + ' figure');
    const rendered = Core.render(item);
    assertSvg(rendered.figure, item.id + ' render figure');
    assert.ok(['text', 'svg'].includes(rendered.optionKind), item.id + ' optionKind');
    assert.equal(rendered.options.length, item.options.length, item.id + ' rendered option count');
    if (rendered.optionKind === 'svg') rendered.options.forEach((svg, i) => assertSvg(svg, item.id + ' option ' + i));
    const steps = Core.explain(item);
    assert.ok(steps.length >= 3, item.id + ' explain steps');
    for (const step of steps) {
      assert.ok(step.title && step.text, item.id + ' step text');
      if (step.svg) assertSvg(step.svg, item.id + ' explain svg');
    }
  }, 20);
});

test('a stripped record carries the triple and no markup, and restores to the same item', () => {
  each((subtest, seed, level) => {
    const item = Core.generate(subtest, seed, level);
    const record = Core.strip(item);
    assert.deepEqual(
      { subtest: record.subtest, seed: record.seed, level: record.level },
      { subtest, seed, level },
      item.id
    );
    assert.equal(record.figure, undefined, item.id + ' no figure');
    assert.equal(record.options, undefined, item.id + ' no option markup');
    assert.doesNotMatch(JSON.stringify(record), /</, item.id + ' stripped record has no <');
    assert.deepEqual(Core.restore(record), item, item.id + ' restores');
    // A stripped record still renders, because render() rebuilds everything from params.
    const rendered = Core.render(record);
    assertSvg(rendered.figure, item.id + ' figure from a stripped record');
    assert.deepEqual(rendered.options, Core.render(item).options, item.id + ' options from a stripped record');
  }, 12);
});

/* ---------- angles (RESEARCH §4.3) ---------- */

test('angle gaps honour the level floor and never drop below 3 degrees', () => {
  assert.equal(Core.ANGLE_FLOOR, 3);
  assert.deepEqual([1, 2, 3].map(Core.angleMinGap), [8, 4, 3]);
  for (const level of LEVELS)
    for (let seed = 1; seed <= 300; seed++) {
      const item = Core.generate('angles', seed, level);
      const angles = item.params.angles;
      assert.equal(angles.length, 4, item.id);
      assert.equal(new Set(angles).size, 4, item.id + ' all four differ');
      assert.equal(item.params.minGap, Core.angleMinGap(level), item.id + ' records its floor');
      for (let i = 0; i < 4; i++) {
        assert.ok(angles[i] >= 15 && angles[i] <= 165, item.id + ' angle in range');
        for (let j = i + 1; j < 4; j++) {
          const gap = Math.abs(angles[i] - angles[j]);
          assert.ok(gap >= Core.angleMinGap(level), item.id + ' gap ' + gap + ' below the level floor');
          assert.ok(gap >= 3, item.id + ' gap ' + gap + ' below the live-exam floor of 3');
        }
      }
      assert.ok(
        angles.some(a => a > 90 || Math.abs(a - 90) <= 10),
        item.id + ' has a near-right or obtuse angle to reference'
      );
      item.params.arms.forEach((pair, i) =>
        assert.ok(Math.abs(pair[0] - pair[1]) >= 0.15, item.id + ' box ' + i + ' has unequal arms')
      );
      assert.ok(
        item.params.orientations.every(o => o >= 0 && o < 360),
        item.id + ' orientations'
      );
      // Options are four permutations of 1-4 and the key is the true ranking.
      const truth = [0, 1, 2, 3]
        .sort((a, b) => angles[a] - angles[b])
        .map(i => i + 1)
        .join('-');
      for (const option of item.options)
        assert.deepEqual(option.split('-').map(Number).sort(), [1, 2, 3, 4], item.id + ' option is a permutation');
      assert.equal(item.options[item.answer], truth, item.id + ' key is the true ranking');
      assert.equal(item.options.filter(o => o === truth).length, 1, item.id + ' exactly one true option');
      assert.match(item.explanation, new RegExp(truth.replace(/-/g, '\\-')), item.id + ' explanation states the order');
    }
});

/* ---------- hole punching (RESEARCH §4.4) ---------- */

test('the punched hole count equals the paper thickness and the stack never leaves the square', () => {
  for (const level of LEVELS)
    for (let seed = 1; seed <= 300; seed++) {
      const item = Core.generate('holes', seed, level);
      const p = item.params;
      assert.ok(p.folds.length >= 2 && p.folds.length <= 4, item.id + ' 2-4 folds');
      assert.ok(p.punches.length >= 1 && p.punches.length <= 2, item.id + ' punch count');
      // Re-simulate independently of generation: null means a fold left the original square.
      const sim = Core.simulateHoles(p.folds, p.punches);
      assert.ok(sim, item.id + ' the folded stack stays inside the original square');
      assert.equal(sim.history.length, p.folds.length + 1, item.id + ' one panel per fold plus the start');
      for (const state of sim.history)
        for (const layer of state)
          for (const [pos, origin] of layer) {
            // The lattice is 8 x 8 sub-cells, each quartered by its two diagonals: 256 pieces.
            for (const value of [pos, origin])
              assert.ok(
                Number.isInteger(value) && value >= 0 && value < 256,
                item.id + ' piece ' + value + ' inside the square'
              );
          }
      const holes = sim.pattern.reduce((s, v) => s + v, 0);
      assert.equal(holes, sim.layersAtPunch, item.id + ' holes equal layers at the punch');
      assert.equal(holes, p.layersAtPunch, item.id + ' layersAtPunch is recorded');
      assert.ok(holes >= 2 && holes <= 12, item.id + ' hole count ' + holes);
      assert.equal(p.pattern.length, 16, item.id + ' the answer grid holds 16 positions');
      assert.ok(
        p.pattern.every(v => v === 0 || v === 1),
        item.id + ' pattern is binary'
      );
      // Five distinct 16-position grids, the key among them exactly once.
      assert.equal(p.optionPatterns.length, 5, item.id + ' five options');
      assert.equal(new Set(p.optionPatterns).size, 5, item.id + ' option grids structurally distinct');
      assert.equal(new Set(item.options).size, 5, item.id + ' option markup distinct');
      const key = p.pattern.join('');
      assert.equal(p.optionPatterns.filter(o => o === key).length, 1, item.id + ' one correct grid');
      assert.equal(p.optionPatterns[item.answer], key, item.id + ' answer points at it');
      for (const option of p.optionPatterns) assert.match(option, /^[01]{16}$/, item.id + ' option grid shape');
    }
});

/* The 45° folds wave 1 deferred. The objection was real: on a plain square lattice a diagonal
   crease halves every cell it crosses, and a half-covered cell destroys "the hole count equals
   the paper thickness". The lattice now quarters each sub-cell along both its diagonals, so a
   crease runs along piece edges and every piece lies wholly on one side of it. These tests hold
   the new folds to the same invariants as the old ones, and re-derive the unfolded pattern a
   second way — piece by piece, forwards through the folds — rather than trusting the layer
   bookkeeping that produced it. */
function foldSide(pos, fold) {
  const side = Core.triSide(pos, fold);
  return fold.side === 'high' ? side > 0 : side < 0;
}
// An independent unfold: carry each of the 256 pieces of the original sheet forward through
// every fold and see where it ends up. A hole appears at an original grid cell only when all
// sixteen of its pieces finish underneath the punch.
function unfoldOracle(folds, punches) {
  const landing = new Map();
  for (let pos = 0; pos < 256; pos++) {
    let at = pos;
    for (const fold of folds) {
      if (!foldSide(at, fold)) continue;
      at = Core.foldPos(at, fold);
      if (at < 0) return null;
    }
    landing.set(pos, at);
  }
  const under = new Set();
  for (const cell of punches) for (const piece of Core.trianglesOf(cell)) under.add(piece);
  const pattern = new Array(16).fill(0);
  for (let cell = 0; cell < 16; cell++)
    if (Core.trianglesOf(cell).every(piece => under.has(landing.get(piece)))) pattern[cell] = 1;
  return pattern;
}

test('the unfolded pattern comes out the same when every piece of paper is tracked by hand', () => {
  for (const level of LEVELS)
    for (let seed = 1; seed <= 300; seed++) {
      const item = Core.generate('holes', seed, level);
      const p = item.params;
      const oracle = unfoldOracle(p.folds, p.punches);
      assert.ok(oracle, item.id + ' every piece stays on the sheet');
      assert.deepEqual(oracle, p.pattern, item.id + ' the two unfoldings agree');
      assert.equal(
        oracle.reduce((sum, v) => sum + v, 0),
        p.layersAtPunch,
        item.id + ' the hand count still equals the paper thickness'
      );
    }
});

test('diagonal folds run corner to corner of the answer grid, and only above the warm-up level', () => {
  const seen = { 1: new Set(), 2: new Set(), 3: new Set() };
  for (const level of LEVELS)
    for (let seed = 1; seed <= 300; seed++) {
      const item = Core.generate('holes', seed, level);
      for (const fold of item.params.folds) {
        seen[level].add(fold.axis);
        assert.ok(['x', 'y', 'd', 'a'].includes(fold.axis), item.id + ' known fold direction');
        assert.ok(['low', 'high'].includes(fold.side), item.id + ' known fold side');
        if (fold.axis === 'x' || fold.axis === 'y') {
          assert.ok(fold.at >= 1 && fold.at <= 7, item.id + ' straight crease inside the sheet');
          if (!Core.HOLE_LEVELS[level].half) assert.equal(fold.at % 2, 0, item.id + ' warm-ups fold on grid lines');
        } else {
          // Even offsets are the 45° lines through the answer grid's own corners; an odd one
          // would slice answer-grid cells in half, which is what makes a punch unreadable.
          assert.equal(Math.abs(fold.at) % 2, 0, item.id + ' diagonal crease through grid corners');
          const limit = fold.axis === 'd' ? 6 : 14;
          assert.ok(Math.abs(fold.at) <= limit && (fold.axis === 'd' || fold.at >= 2), item.id + ' crease in range');
        }
      }
    }
  assert.deepEqual([...seen[1]].sort(), ['x', 'y'], 'the warm-up level never folds on a diagonal');
  for (const level of [2, 3]) {
    assert.ok(seen[level].has('d'), 'level ' + level + ' folds on the leading diagonal');
    assert.ok(seen[level].has('a'), 'level ' + level + ' folds on the other diagonal');
  }
});

test('a diagonal fold lands every piece on a piece, and never on a half of one', () => {
  // The whole sheet, folded once on its own diagonal: the paper that moves must land exactly on
  // the paper that stayed, piece for piece, which is the property a square lattice cannot give.
  for (const fold of [
    { axis: 'd', at: 0, side: 'high' },
    { axis: 'd', at: 2, side: 'high' },
    { axis: 'a', at: 8, side: 'high' },
    { axis: 'a', at: 6, side: 'low' },
  ]) {
    const moving = [];
    const staying = new Set();
    for (let pos = 0; pos < 256; pos++) {
      if (foldSide(pos, fold)) moving.push(pos);
      else staying.add(pos);
    }
    assert.ok(moving.length > 0 && staying.size > 0, JSON.stringify(fold) + ' folds something onto something');
    const landed = moving.map(pos => Core.foldPos(pos, fold));
    assert.ok(
      landed.every(pos => pos >= 0 && pos < 256),
      JSON.stringify(fold) + ' the moving half stays inside the square'
    );
    assert.equal(new Set(landed).size, landed.length, JSON.stringify(fold) + ' no two pieces land on each other');
    assert.ok(
      landed.every(pos => staying.has(pos)),
      JSON.stringify(fold) + ' every moved piece lands on paper that stayed put'
    );
    // Folding twice is doing nothing: the crease is a reflection.
    for (const pos of moving)
      assert.equal(Core.foldPos(Core.foldPos(pos, fold), fold), pos, 'the fold is its own undo');
  }
});

test('every fold actually folds: both sides carry paper and the layer count grows', () => {
  for (let seed = 1; seed <= 120; seed++) {
    const item = Core.generate('holes', seed, 3);
    const sim = Core.simulateHoles(item.params.folds, item.params.punches);
    for (let i = 1; i < sim.history.length; i++)
      assert.ok(
        sim.history[i].length > sim.history[i - 1].length,
        item.id + ' fold ' + i + ' splits at least one layer in two'
      );
    assert.ok(sim.history[sim.history.length - 1].length >= 3, item.id + ' the stack ends up layered');
  }
});

/* ---------- cube counting (RESEARCH §4.5) ---------- */

test('cube tallies add up, obey the ADA support rule and never make zero the answer', () => {
  for (const level of LEVELS)
    for (let seed = 1; seed <= 300; seed++) {
      const item = Core.generate('cubes', seed, level);
      const p = item.params;
      const info = Core.cubeAnalysis(p.heights);
      assert.deepEqual(info.tally, p.tally, item.id + ' tally is recorded');
      assert.equal(info.cubes, p.cubes, item.id + ' cube count is recorded');
      const sum = [0, 1, 2, 3, 4, 5].reduce((s, k) => s + info.tally[k], 0);
      assert.equal(sum, info.cubes, item.id + ' the tally sums to the cube count, hidden supports included');
      assert.ok(info.supportsOk, item.id + ' every hidden cube is holding up a visible one');
      for (const [x, y, z] of info.hidden)
        assert.ok(z < p.heights[x][y] - 1, item.id + ' a hidden cube always supports the cube above it');
      // No cube floats: a height map cannot produce one, and the top of each column is visible.
      // Visibility itself is checked against the ray oracle below, never against Core.isHidden.
      for (let x = 0; x < p.heights.length; x++)
        for (let y = 0; y < p.heights[x].length; y++) {
          const h = p.heights[x][y];
          if (h > 0) assert.ok(!info.hidden.some(c => c[0] === x && c[1] === y && c[2] === h - 1), item.id + ' top');
        }
      assert.deepEqual(item.options, Core.CUBE_OPTIONS, item.id + ' fixed option set');
      const count = info.tally[p.question];
      assert.ok(count >= 1 && count <= 5, item.id + ' the answer is between 1 and 5 cubes, never 0');
      assert.equal(item.answer, count - 1, item.id + ' answer index');
      assert.match(item.stem, new RegExp('exactly ' + p.question + ' painted'), item.id + ' stem names the face count');
    }
});

/* ---------- an independent cube-visibility oracle ----------
   Nothing below asks the engine whether a cube is hidden. It fires rays along the (1, 1, 1)
   view direction from sample points on the three camera-facing faces of a cube and reports the
   cube visible when any ray leaves the figure without entering another cube. The diagonal of a
   face (i === j) is skipped: it projects to a hairline of zero area, so a cube that shows only
   that line draws nothing a student could see. Sampling geometry this way is independent of
   however the engine decides the same question. */
function filled(heights, x, y, z) {
  return x >= 0 && y >= 0 && x < heights.length && y < heights[0].length && z >= 0 && z < heights[x][y];
}
function escapes(heights, px, py, pz) {
  const far = heights.length + heights[0].length + 8;
  for (let t = 1e-6; t < far; t += 0.01)
    if (filled(heights, Math.floor(px + t), Math.floor(py + t), Math.floor(pz + t))) return false;
  return true;
}
function oracleVisible(heights, x, y, z, samples = 7) {
  for (let i = 0; i < samples; i++) {
    const a = (i + 0.5) / samples;
    for (let j = 0; j < samples; j++) {
      if (i === j) continue;
      const b = (j + 0.5) / samples;
      if (!filled(heights, x, y, z + 1) && escapes(heights, x + a, y + b, z + 1)) return true;
      if (!filled(heights, x + 1, y, z) && escapes(heights, x + 1, y + a, z + b)) return true;
      if (!filled(heights, x, y + 1, z) && escapes(heights, x + a, y + 1, z + b)) return true;
    }
  }
  return false;
}
function oracleHidden(heights) {
  const out = [];
  for (let x = 0; x < heights.length; x++)
    for (let y = 0; y < heights[x].length; y++)
      for (let z = 0; z < heights[x][y]; z++) if (!oracleVisible(heights, x, y, z)) out.push([x, y, z]);
  return out;
}
// What a diagonal-only rule would report: a cube covered by one sitting at (x+t, y+t, z+t).
function diagonalOnlyHidden(heights, x, y, z) {
  for (let t = 1; x + t < heights.length && y + t < heights[0].length; t++)
    if (heights[x + t][y + t] > z + t) return true;
  return false;
}

test('hidden cubes are the ones an independent ray test cannot see, on hand-built figures', () => {
  // Each fixture is worked out by hand: the cube list, which cubes the eye can reach, and the
  // painted-face tally. A figure is [column x][column y] = height.
  const fixtures = [
    {
      name: 'a flat two-by-two slab hides nothing',
      heights: [
        [1, 1],
        [1, 1],
      ],
      hidden: [],
      tally: { 0: 0, 1: 0, 2: 0, 3: 4, 4: 0, 5: 0 },
      supportsOk: true,
    },
    {
      name: 'a corner cube walled in on all three camera faces',
      // (0,0,0) has the cube above it, one at (1,0,0) and one at (0,1,0): nothing of it reaches
      // the eye, yet no cube sits on its (1,1,1) diagonal.
      heights: [
        [2, 1],
        [1, 0],
      ],
      hidden: [[0, 0, 0]],
      tally: { 0: 0, 1: 0, 2: 1, 3: 0, 4: 2, 5: 1 },
      supportsOk: true,
    },
    {
      name: 'a two-storey pocket under a three-cube tower',
      // 7 cubes: the bottom two of the (0,0) tower are walled in, the third is the tower top.
      heights: [
        [3, 2],
        [2, 0],
        [0, 0],
      ],
      hidden: [
        [0, 0, 0],
        [0, 0, 1],
      ],
      tally: { 0: 0, 1: 0, 2: 2, 3: 2, 4: 2, 5: 1 },
      supportsOk: true,
    },
    {
      name: 'a lone cube screened by two two-cube towers holds nothing up, so the figure is invalid',
      // Neither the diagonal rule nor a check of the three adjacent cells sees this one: the
      // cube above it is missing, and the two towers block every sight line between them.
      heights: [
        [1, 2],
        [2, 0],
      ],
      hidden: [[0, 0, 0]],
      tally: { 0: 0, 1: 0, 2: 0, 3: 3, 4: 0, 5: 2 },
      supportsOk: false,
    },
    {
      name: 'a cube covered along the view diagonal is hidden too, and holds nothing up',
      heights: [
        [1, 1],
        [1, 2],
      ],
      hidden: [[0, 0, 0]],
      tally: { 0: 0, 1: 0, 2: 1, 3: 3, 4: 0, 5: 1 },
      supportsOk: false,
    },
  ];
  for (const fixture of fixtures) {
    const info = Core.cubeAnalysis(fixture.heights);
    const where = fixture.name;
    assert.deepEqual(oracleHidden(fixture.heights), fixture.hidden, where + ': the oracle agrees with the hand count');
    assert.deepEqual(info.hidden, fixture.hidden, where);
    assert.deepEqual(info.tally, fixture.tally, where + ' tally');
    assert.equal(info.supportsOk, fixture.supportsOk, where + ' support rule');
    const cubes = Object.values(fixture.tally).reduce((s, v) => s + v, 0);
    assert.equal(info.cubes, cubes, where + ' cube count');
    // A cube with no polygon of its own draws nothing, so the drawn figure must agree as well.
    assert.equal(
      (Core.isoFigure(fixture.heights, {}).match(/<polygon/g) || []).length,
      drawnFaces(fixture.heights, fixture.hidden),
      where + ': the drawing carries a face for every visible cube and none for a hidden one'
    );
  }
  // The first three fixtures are exactly the figures a diagonal-only rule gets wrong: it reports
  // no hidden cube in either of the two pocket figures.
  for (const [x, y, z] of [
    [0, 0, 0],
    [0, 0, 1],
  ]) {
    assert.equal(
      diagonalOnlyHidden(
        [
          [3, 2],
          [2, 0],
          [0, 0],
        ],
        x,
        y,
        z
      ),
      false,
      'diagonal rule misses the pocket'
    );
    assert.equal(
      Core.isHidden(
        [
          [3, 2],
          [2, 0],
          [0, 0],
        ],
        x,
        y,
        z
      ),
      true,
      'the engine does not'
    );
  }
});

// Camera faces of the visible cubes that sit on the outside of the solid: what isoFigure draws.
function drawnFaces(heights, hidden) {
  let faces = 0;
  for (let x = 0; x < heights.length; x++)
    for (let y = 0; y < heights[x].length; y++)
      for (let z = 0; z < heights[x][y]; z++) {
        if (hidden.some(c => c[0] === x && c[1] === y && c[2] === z)) continue;
        if (!filled(heights, x, y, z + 1)) faces++;
        if (!filled(heights, x + 1, y, z)) faces++;
        if (!filled(heights, x, y + 1, z)) faces++;
      }
  return faces;
}

test('generated cube figures hide exactly what the ray oracle cannot see, and warm-ups hide nothing', () => {
  for (const level of LEVELS)
    for (let seed = 1; seed <= 20; seed++) {
      const item = Core.generate('cubes', seed * 8 + (seed % 3), level);
      const p = item.params;
      const hidden = oracleHidden(p.heights);
      const where = item.id + ' ' + JSON.stringify(p.heights);
      assert.equal(p.hidden.length, hidden.length, where + ' reports the number of cubes the eye cannot reach');
      assert.deepEqual(p.hidden, hidden, where + ' reports exactly which cubes those are');
      // The explanation prints this number, so a warm-up figure really must hide nothing.
      if (level === 1) assert.equal(hidden.length, 0, where + ' is a warm-up figure and hides nothing');
      assert.equal(
        (item.figure.match(/<polygon/g) || []).length,
        drawnFaces(p.heights, hidden),
        where + ' draws a face for every visible cube and none for a hidden one'
      );
      assert.match(
        item.explanation,
        hidden.length ? new RegExp('including ' + hidden.length + ' hidden') : /every one of them visible/,
        where + ' explanation states the hidden count'
      );
    }
});

test('cube faces are opaque so no edge from the back of the solid shows through', () => {
  const item = Core.generate('cubes', 88, 3);
  assert.doesNotMatch(item.figure, /fill-opacity/, 'no translucent face');
  assert.match(item.figure, /<polygon [^>]*fill="#ffffff"/, 'faces are filled');
  assert.match(item.figure, /<polygon [^>]*stroke="currentColor"/, 'and every face keeps its own edge');
});

test('a cube figure carries 2 to 4 questions and a set shows them together', () => {
  for (const level of LEVELS) {
    const items = Core.set('cubes', 800, level, 15);
    assert.equal(items.length, 15, 'level ' + level + ' set size');
    const runs = [];
    for (const item of items) {
      const last = runs[runs.length - 1];
      if (last && last.figure === item.params.figureSeed) last.n++;
      else runs.push({ figure: item.params.figureSeed, n: 1 });
    }
    assert.ok(runs.length >= 4 && runs.length <= 8, 'level ' + level + ' uses 4-8 figures, got ' + runs.length);
    // Every figure, the last one included: a student who reaches the end of a set must not be
    // handed a fresh figure to rebuild for a single question, which is what 15 ÷ perFigure used
    // to leave behind [DESIGN §6: 2-4 questions per figure].
    for (const runLength of runs)
      assert.ok(
        runLength.n >= 2 && runLength.n <= 4,
        'level ' + level + ' asks 2-4 questions per figure, got ' + runs.map(r => r.n).join(',')
      );
    // Questions on one figure must differ from one another.
    for (const run of runs)
      assert.ok(
        new Set(items.filter(i => i.params.figureSeed === run.figure).map(i => i.params.question)).size === run.n,
        'level ' + level + ' repeats a question on one figure'
      );
  }
  // And over a run of seeds, so the tail of a set is a planned group rather than whatever 15
  // divided by the level's group size happened to leave.
  const tail = {};
  for (const level of LEVELS)
    for (let seed = 1; seed <= 40; seed++) {
      const items = Core.set('cubes', seed, level, 15);
      assert.equal(items.length, 15, 'level ' + level + ' seed ' + seed + ' set size');
      const groups = [];
      for (const item of items) {
        const last = groups[groups.length - 1];
        if (last && last.figure === item.params.figureSeed) last.n++;
        else groups.push({ figure: item.params.figureSeed, n: 1 });
      }
      for (const group of groups)
        assert.ok(
          group.n >= 2 && group.n <= 4,
          'level ' + level + ' seed ' + seed + ' groups ' + groups.map(g => g.n).join(',')
        );
      tail[groups[groups.length - 1].n] = (tail[groups[groups.length - 1].n] || 0) + 1;
    }
  assert.equal(
    Object.keys(tail).every(n => Number(n) >= 2),
    true,
    'no set ends on a lone question, tail sizes seen: ' + JSON.stringify(tail)
  );
});

test('the painted-face rule matches the ADA worked example for a lone cube and a tower', () => {
  // One cube resting on the table: five painted faces, the bottom unpainted.
  assert.equal(Core.paintedFaces([[1]], 0, 0, 0), 5);
  // Two cubes stacked: bottom 4 (top glued, bottom resting), top 5.
  assert.equal(Core.paintedFaces([[2]], 0, 0, 0), 4);
  assert.equal(Core.paintedFaces([[2]], 0, 0, 1), 5);
  // Two side by side: 4 each.
  assert.equal(Core.paintedFaces([[1], [1]], 0, 0, 0), 4);
  assert.equal(Core.paintedFaces([[1], [1]], 1, 0, 0), 4);
  // The hidden-cube rule: a cube is hidden exactly when one sits at (x+1, y+1, z+1).
  const stepped = [
    [1, 1],
    [1, 2],
  ];
  assert.equal(Core.isHidden(stepped, 0, 0, 0), true);
  assert.equal(Core.isHidden(stepped, 1, 1, 0), false);
  assert.equal(Core.cubeAnalysis(stepped).hidden.length, 1);
  assert.equal(Core.cubeAnalysis(stepped).supportsOk, false, 'a hidden column top holds nothing up');
});

/* ---------- apertures / keyholes (RESEARCH §4.1) ----------
   Nothing below asks the engine what an object's silhouettes are or what counts as a turn of one.
   The masks here are built by walking occupancy along each axis and asking "does this line of
   sight meet any cube?", and the class is closed by hand under a quarter turn and a reflection.
   That is the brute force the ADA rules need: turning the object 180° about an axis in the
   projection plane presents the mirror of the same outline, so all 8 transforms of each of the 3
   silhouettes are openings the object really passes through, and exactly one option may be one of
   them at the object's own scale [ADA rules 1-3, 5]. */
function gridMask(w, h, fn) {
  const bits = [];
  for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) bits.push(fn(u, v) ? 1 : 0);
  return { w, h, bits };
}
function rayMask(heights, axis) {
  const w = heights.length,
    d = heights[0].length;
  let H = 0;
  for (let x = 0; x < w; x++) for (let y = 0; y < d; y++) H = Math.max(H, heights[x][y]);
  const solid = (x, y, z) => filled(heights, x, y, z);
  if (axis === 0)
    return gridMask(w, d, (u, v) => {
      for (let z = 0; z < H; z++) if (solid(u, d - 1 - v, z)) return true;
      return false;
    });
  if (axis === 1)
    return gridMask(w, H, (u, v) => {
      for (let y = 0; y < d; y++) if (solid(u, y, H - 1 - v)) return true;
      return false;
    });
  return gridMask(d, H, (u, v) => {
    for (let x = 0; x < w; x++) if (solid(x, u, H - 1 - v)) return true;
    return false;
  });
}
function quarterTurn(m) {
  return gridMask(m.h, m.w, (u, v) => m.bits[(m.h - 1 - u) * m.w + v]);
}
function reflected(m) {
  return gridMask(m.w, m.h, (u, v) => m.bits[v * m.w + (m.w - 1 - u)]);
}
function maskName(m) {
  return m.w + 'x' + m.h + ':' + m.bits.join('');
}
function apertureClass(heights) {
  const keys = new Set();
  for (const axis of [0, 1, 2]) {
    let cur = rayMask(heights, axis);
    for (let k = 0; k < 4; k++) {
      keys.add(maskName(cur));
      keys.add(maskName(reflected(cur)));
      cur = quarterTurn(cur);
    }
  }
  return keys;
}
function optionName(option) {
  return option.w + 'x' + option.h + ':' + option.bits;
}

test('exactly one opening fits, proved by brute force over the whole 3 x 8 silhouette class', () => {
  for (const level of LEVELS)
    for (let seed = 1; seed <= 300; seed++) {
      const item = Core.generate('keyholes', seed, level);
      const p = item.params;
      const klass = apertureClass(p.heights);
      assert.ok(klass.size >= 3 && klass.size <= 24, item.id + ' class size ' + klass.size);
      const fits = [];
      // [ADA rule 3] the opening is the exact external outline at the object's own scale, so a
      // correctly shaped outline drawn smaller is not an opening the object passes through.
      p.options.forEach((option, i) => {
        if (option.scale === 1 && klass.has(optionName(option))) fits.push(i);
      });
      assert.deepEqual(fits, [item.answer], item.id + ' must offer exactly one workable opening');
      assert.equal(p.options.length, 5, item.id + ' five openings [ADA]');
      assert.equal(
        new Set(p.options.map(o => optionName(o) + '@' + o.scale)).size,
        5,
        item.id + ' the five openings are different drawings'
      );
      // Rule 3 is taught by one distractor, and it is the right shape at the wrong size.
      const small = p.options.filter(o => o.scale !== 1);
      assert.equal(small.length, 1, item.id + ' exactly one wrong-size opening');
      assert.ok(small[0].scale >= 0.6 && small[0].scale < 0.95, item.id + ' scale ' + small[0].scale);
      assert.ok(klass.has(optionName(small[0])), item.id + ' the wrong-size opening is the right shape');
      // [ADA rule 4] nothing is hidden that is not holding up something visible, so the drawing
      // fixes the object's geometry and no silhouette depends on a guess.
      for (const [x, y, z] of oracleHidden(p.heights))
        assert.ok(z < p.heights[x][y] - 1, item.id + ' a hidden part of the object supports nothing');
    }
});

test('the object and the openings are drawn to one scale, so "too small" is visible', () => {
  assert.equal(Core.KEY_ISO.z, Core.KEY_UNIT, 'one cube edge of the object is one square of an opening');
  assert.equal(Core.KEY_CANVAS, 5 * Core.KEY_UNIT + 12, 'the opening canvas holds the widest outline at that unit');
  const squares = svg => [...svg.matchAll(/<rect [^>]*width="([\d.]+)"/g)].map(m => Number(m[1]));
  for (const level of LEVELS)
    for (let seed = 1; seed <= 60; seed++) {
      const item = Core.generate('keyholes', seed, level);
      const p = item.params;
      assert.equal(p.unit, Core.KEY_UNIT, item.id + ' records the drawn unit');
      const w = p.heights.length,
        d = p.heights[0].length;
      let maxZ = 0;
      for (let x = 0; x < w; x++) for (let y = 0; y < d; y++) maxZ = Math.max(maxZ, p.heights[x][y]);
      const box = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(item.figure);
      assert.equal(Number(box[1]), 520, item.id + ' the object sits in the canvas dat.css sizes to 520 px');
      assert.equal(
        Number(box[2]),
        20 + (w + d) * Core.KEY_ISO.h + maxZ * Core.KEY_ISO.z,
        item.id + ' the object is drawn at exactly one cube edge per unit'
      );
      const rendered = Core.render(item);
      // Every opening shares one canvas, so the five outlines are strictly comparable with each
      // other however the browser scales the row.
      for (const svg of rendered.options)
        assert.ok(
          svg.indexOf('viewBox="0 0 ' + Core.KEY_CANVAS + ' ' + Core.KEY_CANVAS + '"') === 5,
          item.id + ' one opening canvas'
        );
      const key = squares(rendered.options[item.answer]);
      assert.ok(key.length, item.id + ' the key opening is drawn');
      key.forEach(v => assert.equal(v, Core.KEY_UNIT, item.id + ' the key is drawn at the object scale'));
      const smallIndex = p.options.findIndex(o => o.scale !== 1);
      squares(rendered.options[smallIndex]).forEach(v =>
        assert.ok(v <= Core.KEY_UNIT * 0.9, item.id + ' the wrong-size opening is visibly smaller (' + v + ')')
      );
    }
});

test('the keyhole review describes the opening the generator actually built', () => {
  /* Every recipe's copy is checked against its code, not just the one that was reported.
     maskToggle flips exactly one cell, so a toggle-derived opening (mirror, sibling, moved) always
     carries one square MORE or FEWER than the outline it was built from — the same squares are
     never rearranged. Copy calling that "one square moved" or "one step in the wrong place"
     describes a transformation the generator does not perform. */
  const filled = bits => bits.split('').filter(c => c === '1').length;
  const seen = {};
  for (const level of LEVELS)
    for (let seed = 1; seed <= 120; seed++) {
      const item = Core.generate('keyholes', seed, level);
      const p = item.params;
      const key = p.options[item.answer];
      const panel = Core.explain(item).find(step => /Rule the other four out/.test(step.title));
      assert.ok(panel, item.id + ' the review rules the other four out');
      const clauses = panel.text.split(' · ');
      assert.equal(clauses.length, p.options.length, item.id + ' one clause per opening');
      for (let i = 0; i < p.options.length; i++) {
        const option = p.options[i],
          clause = clauses[i];
        seen[option.kind] = (seen[option.kind] || 0) + 1;
        assert.ok(clause.startsWith('ABCDE'[i] + ':'), item.id + ' clauses run in letter order: ' + clause);
        if (option.kind === 'answer') continue;
        if (option.kind === 'scale') {
          // "the right shape, but drawn smaller": the key's own squares at a smaller unit.
          assert.equal(option.bits, key.bits, item.id + ' the wrong-size opening is the key’s shape');
          assert.equal(option.w + 'x' + option.h, key.w + 'x' + key.h, item.id + ' and the key’s dimensions');
          assert.ok(option.scale < 1, item.id + ' and it really is drawn smaller');
          assert.match(clause, /drawn smaller than the object/, item.id + ' ' + clause);
          continue;
        }
        if (option.kind === 'stretch') {
          // "stretched on one axis": maskStretch duplicates one row or one column, so exactly one
          // dimension grows by one and the other is untouched.
          const grew = (option.w === key.w + 1 && option.h === key.h) || (option.h === key.h + 1 && option.w === key.w);
          assert.ok(grew, item.id + ' the stretched opening grows on exactly one axis');
          assert.match(clause, /stretched on one axis/, item.id + ' ' + clause);
          continue;
        }
        if (option.kind === 'mirror')
          assert.equal(
            Math.abs(filled(option.bits) - filled(key.bits)),
            1,
            item.id + ' the mirror decoy is one square off the key, not the key rearranged'
          );
        assert.match(clause, /one square added or taken away/, item.id + ' ' + clause);
        assert.doesNotMatch(clause, /\bmoved\b|wrong place/, item.id + ' ' + clause);
      }
      assert.doesNotMatch(item.explanation, /\bmoved\b|wrong place/, item.id + ' the short explanation agrees');
    }
  for (const kind of ['answer', 'scale', 'mirror', 'sibling', 'stretch'])
    assert.ok(seen[kind] > 50, kind + ' openings are common enough to be worth checking, got ' + (seen[kind] || 0));

  // The coaching copy in data/dat-pat.json is read in the same sitting as the review panel above,
  // so it has to describe the same decoys. Its keyholes pitfall used to promise "a near-mirror
  // with one step moved", which is a transformation no recipe performs.
  const authored = JSON.parse(
    fs.readFileSync(require('node:path').join(__dirname, '..', 'data', 'dat-pat.json'), 'utf8')
  );
  const keyholes = authored.subtests.find(s => s.id === 'keyholes');
  for (const field of ['rules', 'strategy', 'pitfalls'])
    for (const line of keyholes[field])
      assert.doesNotMatch(line, /\bmoved\b|wrong place/, 'data/dat-pat.json keyholes ' + field + ': ' + line);
});

/* ---------- view recognition (RESEARCH §4.2) ---------- */

/* Two hand-computed solids. Both were worked out on paper — cell by cell, sight line by sight
   line — before the projector existed, so they check the projector against something other than
   itself. A line is written "x1,y1 x2,y2 style" in view coordinates, origin at the top left of
   the view, one unit per cube.

   FIXTURE 1, the stepped block. heights[x][y], x to the right, y away from the viewer, z up:
     (0,0) 1   (0,1) 2
     (1,0) 1   (1,1) 1
   Top view (front row at the bottom): the 2x2 outline, plus the two edges that box in the back
   left column where it stands a storey higher — 6 solid lines, nothing hidden, because from above
   every face is either on top or on the outside.
   Front view (looking along +y): the back left column shows above the front left one, so the
   outline is an L. The top faces of the front left column and of both right columns all sit at
   z = 1 and touch, so they draw as ONE line right across the view — 6 solid lines.
   End view (looking from the right, front of the object on the left): the mirror situation, the
   tall column now at the right of the view — 6 solid lines.

   FIXTURE 2, a 3x3 slab two cubes high with the middle column one cube lower: a square blind
   pocket, one cube deep, in the middle of the top face.
   Top view: the 3x3 outline plus the four edges of the pocket mouth, all solid — you are looking
   straight into it.
   Front view: a 3x2 rectangle, with the pocket's two side walls and its floor DASHED, because a
   full cube of material stands between them and the eye. The end view is the same by symmetry. */
const STEP_BLOCK = [
  [1, 2],
  [1, 1],
];
const POCKET_BLOCK = [
  [2, 2, 2],
  [2, 1, 2],
  [2, 2, 2],
];
const HAND_VIEWS = {
  step: {
    top: ['0,0 0,2 solid', '0,0 2,0 solid', '0,1 1,1 solid', '0,2 2,2 solid', '1,0 1,1 solid', '2,0 2,2 solid'],
    front: ['0,0 0,2 solid', '0,0 1,0 solid', '0,1 2,1 solid', '0,2 2,2 solid', '1,0 1,1 solid', '2,1 2,2 solid'],
    end: ['0,1 0,2 solid', '0,1 2,1 solid', '0,2 2,2 solid', '1,0 1,1 solid', '1,0 2,0 solid', '2,0 2,2 solid'],
  },
  pocket: {
    top: [
      '0,0 0,3 solid',
      '0,0 3,0 solid',
      '0,3 3,3 solid',
      '1,1 1,2 solid',
      '1,1 2,1 solid',
      '1,2 2,2 solid',
      '2,1 2,2 solid',
      '3,0 3,3 solid',
    ],
    front: [
      '0,0 0,2 solid',
      '0,0 3,0 solid',
      '0,2 3,2 solid',
      '1,0 1,1 dashed',
      '1,1 2,1 dashed',
      '2,0 2,1 dashed',
      '3,0 3,2 solid',
    ],
    end: [
      '0,0 0,2 solid',
      '0,0 3,0 solid',
      '0,2 3,2 solid',
      '1,0 1,1 dashed',
      '1,1 2,1 dashed',
      '2,0 2,1 dashed',
      '3,0 3,2 solid',
    ],
  },
};
function drawnLines(model, view) {
  return Core.tfeLines(model, view)
    .map(l => l.x1 + ',' + l.y1 + ' ' + l.x2 + ',' + l.y2 + ' ' + (l.hidden ? 'dashed' : 'solid'))
    .sort();
}

test('the three-view projector reproduces two views worked out by hand', () => {
  for (const [name, heights] of [
    ['step', STEP_BLOCK],
    ['pocket', POCKET_BLOCK],
  ]) {
    const model = Core.tfeOcc(heights, []);
    assert.ok(Core.tfeSolid(model), name + ' is one connected solid');
    for (const view of Core.TFE_VIEWS)
      assert.deepEqual(drawnLines(model, view), HAND_VIEWS[name][view].slice().sort(), name + ' ' + view + ' view');
  }
  // A blind pocket carved as a feature is the same solid as a height map with a lower middle.
  const carved = Core.tfeOcc(
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2],
    ],
    [{ kind: 'blind', x: 1, y: 1, depth: 1 }]
  );
  for (const view of Core.TFE_VIEWS)
    assert.deepEqual(drawnLines(carved, view), HAND_VIEWS.pocket[view].slice().sort(), 'carved pocket ' + view);
  // And the drawing dashes exactly the lines the hand count calls hidden.
  const front = Core.tfeLines(carved, 'front');
  assert.equal(front.filter(l => l.hidden).length, 3, 'three hidden lines in the front view');
});

test('counting lines never picks the right view out of the four', () => {
  const missingSeen = new Set();
  let dashedItems = 0;
  for (const level of LEVELS)
    for (let seed = 1; seed <= 300; seed++) {
      const item = Core.generate('tfe', seed, level);
      missingSeen.add(item.params.missing);
      assert.ok(Core.TFE_VIEWS.includes(item.params.missing), item.id + ' the missing view is one of the three');
      // What a student counts is what is drawn, and a dashed line is an edge they are told they
      // cannot see: the count that has to be immune is the count of SOLID lines on screen
      // [DESIGN §6 "the same visible-line count"]. Counting every <line> element instead re-derives
      // the generator's own total, which a solid↔dashed toggle preserves for free — so the total
      // is asserted as well, but it is the solid count that proves the shortcut is dead.
      const drawn = item.options.map(svg => svg.match(/<line [^>]*>/g) || []);
      const counts = drawn.map(lines => lines.length);
      const visible = drawn.map(lines => lines.filter(l => !/stroke-dasharray/.test(l)).length);
      assert.ok(
        counts.every(c => c >= 4),
        item.id + ' every option is a closed view, not a fragment'
      );
      assert.ok(
        counts.filter(c => c === counts[item.answer]).length >= 2,
        item.id + ' the key is the only option with ' + counts[item.answer] + ' lines'
      );
      assert.ok(
        visible.filter(c => c === visible[item.answer]).length >= 2,
        item.id + ' the key is the only option a student sees ' + visible[item.answer] + ' lines in (' + visible + ')'
      );
      assert.equal(new Set(item.options).size, 4, item.id + ' four different drawings [ADA: one is correct]');
      if (item.options.some(svg => /stroke-dasharray/.test(svg))) dashedItems++;
      // The object itself is never drawn: the figure holds the two given views and a blank.
      assert.doesNotMatch(item.figure, /<polygon/, item.id + ' no pictorial of the object is shown');
      assert.match(item.figure, /TOP VIEW/, item.id + ' the fixed ADA layout is labelled');
      assert.match(item.figure, /FRONT VIEW/, item.id);
      assert.match(item.figure, /END VIEW/, item.id);
    }
  assert.deepEqual([...missingSeen].sort(), ['end', 'front', 'top'], 'every view goes missing across a run of seeds');
  assert.ok(dashedItems > 100, 'hidden edges are common across the three levels, got ' + dashedItems);
});

test('the three views line up the way orthographic projection makes them', () => {
  for (const level of LEVELS)
    for (let seed = 1; seed <= 120; seed++) {
      const item = Core.generate('tfe', seed, level);
      const model = Core.tfeOcc(item.params.heights, item.params.features);
      const top = Core.tfeDims(model, 'top'),
        front = Core.tfeDims(model, 'front'),
        end = Core.tfeDims(model, 'end');
      // Width across top and front, height down front and end, depth across top and end.
      assert.equal(top.uW, front.uW, item.id + ' width is shared by the top and front views');
      assert.equal(front.vH, end.vH, item.id + ' height is shared by the front and end views');
      assert.equal(top.vH, end.uW, item.id + ' depth is shared by the top and end views');
      // Each view looks all the way through the object along the remaining axis.
      assert.equal(top.depth * front.depth * end.depth, top.uW * top.vH * front.vH, item.id + ' depths');
      // The candidate views are drawn at the size the missing slot has, not at some other size.
      const slot = Core.tfeDims(model, item.params.missing);
      for (const svg of item.options)
        assert.ok(
          svg.indexOf('viewBox="0 0 ' + (slot.uW * Core.TFE_UNIT + 12) + ' ' + (slot.vH * Core.TFE_UNIT + 12) + '"') ===
            5,
          item.id + " every candidate is drawn in the missing view's own frame"
        );
    }
});

test('the level dial carves the features it promises, and only those', () => {
  const survey = level => {
    const kinds = new Set();
    let carved = 0,
      tunnels = 0,
      hiddenViews = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const item = Core.generate('tfe', seed, level);
      const features = item.params.features;
      if (features.length) carved++;
      if (features.some(f => f.kind === 'tunnel')) tunnels++;
      for (const f of features) kinds.add(f.kind);
      const model = Core.tfeOcc(item.params.heights, features);
      if (Core.tfeLines(model, item.params.missing).some(l => l.hidden)) hiddenViews++;
      // A blind pocket is blind: a cube of floor always stays under it.
      for (const f of features)
        if (f.kind === 'blind')
          assert.ok(f.depth >= 1 && f.depth < item.params.heights[f.x][f.y], item.id + ' pocket ' + f.depth);
    }
    return { kinds: [...kinds].sort(), carved, tunnels, hiddenViews };
  };
  const one = survey(1),
    two = survey(2),
    three = survey(3);
  assert.deepEqual(one.kinds, [], 'level 1 is stacked blocks and carves nothing');
  assert.equal(one.carved, 0, 'level 1 carves nothing');
  assert.deepEqual(two.kinds, ['blind'], 'level 2 carves blind pockets only');
  assert.equal(two.carved, 150, 'every level 2 object has a pocket, not one in thirty');
  assert.deepEqual(three.kinds, ['blind', 'tunnel'], 'level 3 adds the straight tunnel');
  assert.ok(three.tunnels > 20 && three.tunnels < 150, 'a tunnel is a level 3 variation, got ' + three.tunnels);
  // Pockets and tunnels are what put edges out of sight, so the asked-for view hides more of them
  // as the dial goes up. Stacked blocks already hide some, which is why this is a trend not a gate.
  assert.ok(two.hiddenViews > one.hiddenViews, 'pockets hide more edges than steps alone');
  assert.ok(three.hiddenViews >= two.hiddenViews, 'level 3 hides at least as much as level 2');
});

/* ---------- sets and forms ---------- */

/* ---------- pattern folding (RESEARCH §4.6) ----------
   Three things have to be true of every pattern-folding item and none of them can be taken on
   trust from the generator, so each is recomputed here from the item's own params: the net is a
   real unfolding of the solid (congruent regions, no region on top of another, no region flipped
   over), the four drawings are four different solids under the solid's own rotation group, and
   the one the item calls correct is the one the net actually folds into. */
const PF_KINDS = ['brick', 'wedge', 'trap', 'pyr', 'hex'];

function pfConfigOf(option) {
  return { shaded: option.shaded.slice().sort((a, b) => a - b), marker: option.marker || null };
}
// Is config B config A turned round? Brute force over the solid's rotation group, computed here
// from the option's own face and vertex permutations rather than from the generator's key.
function pfSameTurned(solid, a, b) {
  if (a.shaded.length !== b.shaded.length) return false;
  for (const g of Core.pfSymmetries(solid)) {
    const moved = a.shaded.map(f => g.faceMap[f]).sort((x, y) => x - y);
    if (moved.join(',') !== b.shaded.join(',')) continue;
    if (!a.marker && !b.marker) return true;
    if (!a.marker || !b.marker) continue;
    if (g.faceMap[a.marker.face] === b.marker.face && g.vertMap[a.marker.vert] === b.marker.vert) return true;
  }
  return false;
}
function pfLengths(points) {
  return points.map((p, i) => {
    const q = points[(i + 1) % points.length];
    return Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) * 1000) / 1000;
  });
}
function pfArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const q = points[(i + 1) % points.length];
    sum += points[i][0] * q[1] - q[0] * points[i][1];
  }
  return sum / 2;
}

test('every solid in the pool is convex, closed, and has the rotation group its shape demands', () => {
  // The drawing rule "fill the faces whose normal leans toward the eye" is hidden-surface removal
  // only for a convex solid, so convexity is a load-bearing property and not a coincidence.
  for (const kind of PF_KINDS)
    for (const dims of Core.PF_SOLIDS[kind].dims) {
      const solid = Core.pfSolid(kind, dims);
      const where = kind + ' ' + dims.join('x');
      for (let fi = 0; fi < solid.faces.length; fi++) {
        const loop = solid.faces[fi];
        const origin = solid.verts[loop[0]];
        const n = solid.normals[fi];
        for (const v of solid.verts) {
          const d = (v[0] - origin[0]) * n[0] + (v[1] - origin[1]) * n[1] + (v[2] - origin[2]) * n[2];
          assert.ok(d < 1e-9, where + ' face ' + fi + ' has the whole solid behind it (convex)');
        }
      }
      // Closed surface: every edge is shared by exactly two faces, so the net has no free edge.
      const edges = new Map();
      solid.faces.forEach(loop => {
        for (let i = 0; i < loop.length; i++) {
          const key = [loop[i], loop[(i + 1) % loop.length]].sort((a, b) => a - b).join(':');
          edges.set(key, (edges.get(key) || 0) + 1);
        }
      });
      for (const [key, count] of edges) assert.equal(count, 2, where + ' edge ' + key + ' is shared twice');
      assert.equal(
        Core.pfSymmetries(solid).length,
        new Set(Core.pfSymmetries(solid).map(g => g.faceMap.join(','))).size
      );
    }
  // Hand-known group orders: a box with three unequal edges keeps only the three half-turns, a
  // square box adds the quarter-turns, a cube has all 24, a scalene prism has none at all, a
  // square pyramid has the four turns about its axis and a hexagonal prism has twelve.
  const orders = [
    ['brick', [2, 3, 4], 4],
    ['brick', [2, 2, 3], 8],
    ['brick', [2, 2, 2], 24],
    ['wedge', [3, 2, 4], 1],
    ['trap', [3, 2, 4], 1],
    ['pyr', [4, 4, 3], 4],
    ['hex', [2, 2, 3], 12],
  ];
  for (const [kind, dims, order] of orders)
    assert.equal(Core.pfSymmetries(Core.pfSolid(kind, dims)).length, order, kind + ' ' + dims.join('x') + ' group');
});

test('the net is a true unfolding: congruent regions, none flipped, none overlapping', () => {
  for (const level of LEVELS)
    for (let seed = 1; seed <= 320; seed++) {
      const item = Core.generate('patterns', seed, level);
      const p = item.params;
      const solid = Core.pfSolid(p.kind, p.dims);
      const where = item.id + ' ' + p.kind;
      // The tree is a spanning tree of the face graph over edges the two faces really share.
      const seen = new Set([p.tree.root]);
      for (const [child, parent, a, b] of p.tree.steps) {
        assert.ok(!seen.has(child), where + ' places face ' + child + ' once');
        assert.ok(seen.has(parent), where + ' places a parent before its child');
        assert.ok(
          Core.pfNeighbours(solid, child).includes(parent) &&
            solid.faces[child].includes(a) &&
            solid.faces[child].includes(b) &&
            solid.faces[parent].includes(a) &&
            solid.faces[parent].includes(b),
          where + ' folds along an edge the two faces share'
        );
        seen.add(child);
      }
      assert.equal(seen.size, solid.faces.length, where + ' the net uses every face exactly once');
      const place = Core.pfUnfold(solid, p.tree);
      assert.ok(place, where + ' unfolds');
      assert.equal(Core.pfNetOverlaps(solid, place), false, where + ' no region lies on another');
      const polys = Core.pfPolys(solid, place);
      // Each flat region is congruent to its face: same edge lengths, same cyclic order.
      polys.forEach((poly, fi) => {
        const loop = solid.faces[fi];
        const solidEdges = loop.map((v, i) => {
          const q = solid.verts[loop[(i + 1) % loop.length]],
            r = solid.verts[v];
          return Math.round(Math.hypot(q[0] - r[0], q[1] - r[1], q[2] - r[2]) * 1000) / 1000;
        });
        assert.deepEqual(pfLengths(poly), solidEdges, where + ' region ' + fi + ' is congruent to its face');
      });
      // Every region keeps the same handedness, which is what "you are looking at the outside of
      // the pattern" means: one flipped region would be a net of the inside surface.
      const signs = polys.map(poly => Math.sign(pfArea(poly)));
      assert.equal(new Set(signs).size, 1, where + ' every region is laid out the same way up');
    }
});

test('no pattern distractor is the right solid seen from another angle', () => {
  for (const level of LEVELS)
    for (let seed = 1; seed <= 320; seed++) {
      const item = Core.generate('patterns', seed, level);
      const p = item.params;
      const where = item.id;
      const truth = pfConfigOf({ shaded: p.shaded, marker: p.marker });
      const solid = Core.pfSolid(p.kind, p.dims);
      let matches = 0;
      p.options.forEach((option, i) => {
        const same = option.dims.join('x') === p.dims.join('x') && pfSameTurned(solid, truth, pfConfigOf(option));
        if (same) matches++;
        assert.equal(same, i === item.answer, where + ' option ' + i + ' (' + option.kind + ') keyed correctly');
      });
      assert.equal(matches, 1, where + ' exactly one option folds from this net');
      // And no two options are each other turned round either.
      for (let i = 0; i < p.options.length; i++)
        for (let j = i + 1; j < p.options.length; j++) {
          if (p.options[i].dims.join('x') !== p.options[j].dims.join('x')) continue;
          assert.equal(
            pfSameTurned(solid, pfConfigOf(p.options[i]), pfConfigOf(p.options[j])),
            false,
            where + ' options ' + i + ' and ' + j + ' are two different solids'
          );
        }
      // What is drawn must differ too: two shadings that agree on every face the viewpoint shows
      // would reach the learner as the same picture whatever the hidden faces do.
      const drawn = p.options.map(option => Core.pfPictureKey(p.kind, option, p.view));
      assert.equal(new Set(drawn).size, 4, where + ' the four drawings are four different pictures');
      const lit = Core.pfViewFaces(solid, p.view);
      assert.ok(lit && lit.length >= 3, where + ' the viewpoint shows at least three faces');
      assert.ok(
        lit.some(f => p.shaded.includes(f)) && lit.some(f => !p.shaded.includes(f)),
        where + ' the viewpoint shows both a shaded and an unshaded face'
      );
      // Not only the key: every drawing shows shading somewhere, so none of the four is a blank
      // solid sitting beside a shaded net.
      p.options.forEach((option, i) =>
        assert.ok(Core.pfPictureTells(p.kind, option, p.view), where + ' option ' + i + ' shows some shading')
      );
    }
});

test('a mirror-image option really is the mirror, and the level dial carves what it promises', () => {
  let mirrors = 0,
    markers = 0;
  const seenKinds = { 1: new Set(), 2: new Set(), 3: new Set() };
  for (const level of LEVELS)
    for (let seed = 1; seed <= 240; seed++) {
      const p = Core.generate('patterns', seed, level).params;
      seenKinds[level].add(p.kind);
      assert.ok(Core.PF_LEVELS[level].kinds.includes(p.kind), 'level ' + level + ' may not use ' + p.kind);
      assert.equal(p.shaded.length, Core.PF_LEVELS[level].shaded, 'level ' + level + ' shaded count');
      assert.equal(!!p.marker, Core.PF_LEVELS[level].marker, 'level ' + level + ' corner mark');
      if (p.marker) markers++;
      const solid = Core.pfSolid(p.kind, p.dims);
      const flip = Core.pfMirror(solid);
      for (const option of p.options) {
        if (option.kind !== 'mirror') continue;
        mirrors++;
        assert.deepEqual(
          option.shaded,
          p.shaded.map(f => flip.faceMap[f]).sort((a, b) => a - b),
          'the mirror option is the shading reflected'
        );
      }
    }
  assert.ok(mirrors > 100, 'the mirror-image fold is offered often, not rarely: ' + mirrors);
  assert.equal(markers, 240, 'every level-3 item carries a corner mark');
  assert.deepEqual([...seenKinds[1]], ['brick'], 'the warm-up level stays on boxes');
  assert.ok(seenKinds[3].has('hex'), 'the hardest level reaches the hexagonal prism');
});

test('every pattern seed builds a real item, so the fallback is never the thing a learner sees', () => {
  for (const level of LEVELS)
    for (let seed = 1; seed <= 400; seed++)
      assert.ok(Core.pfBuild(seed, level), 'patterns seed ' + seed + ' level ' + level + ' builds');
});

test('a 90-item mixed form, fifteen of each subtest in ADA order, builds in well under a second', () => {
  Core.formItems({ seedBase: 3, level: 2, per: 15 });
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const started = process.hrtime.bigint();
    const form = Core.formItems({ seedBase: 100 + i * 977, level: 2, per: 15 });
    runs.push(Number(process.hrtime.bigint() - started) / 1e6);
    assert.equal(form.length, 90, 'ninety items');
    assert.deepEqual([...new Set(form.map(i2 => i2.subtest))], BUILT, 'ADA subtest order');
    for (const subtest of BUILT)
      assert.equal(form.filter(i2 => i2.subtest === subtest).length, 15, subtest + ' contributes fifteen');
  }
  const median = runs.slice().sort((a, b) => a - b)[1];
  // DESIGN §6 asks for under 250 ms; the measured figure is about 90 ms.
  assert.ok(median < 250, 'a 90-item form took ' + median.toFixed(0) + ' ms');
});

test('set() balances the answer letter and every item stays byte-identical to its id', () => {
  for (const subtest of BUILT)
    for (const level of LEVELS) {
      let worst = 0;
      for (let base = 1; base <= 25; base++) {
        const items = Core.set(subtest, base * 613 + 1, level, 15);
        assert.equal(items.length, 15, subtest + ' set size');
        assert.equal(new Set(items.map(i => i.id)).size, 15, subtest + ' ids unique inside a set');
        for (const item of items) {
          assert.deepEqual(Core.fromId(item.id), item, item.id + ' a set item is exactly its id');
          assert.ok(Core.verify(item), item.id + ' verifies inside a set');
          assert.equal(item.level, level, item.id);
        }
        const counts = new Array(Core.optionsFor(subtest)).fill(0);
        items.forEach(i => counts[i.answer]++);
        worst = Math.max(worst, Math.max.apply(null, counts));
      }
      // Cube counting has a fixed option set keyed to the tally, so the letter cannot be chosen
      // freely the way a shuffled option order can; small warm-up figures rarely produce four-
      // and five-cube answers. 6 of 15 is the ceiling there, 5 of 15 everywhere else.
      const ceiling = subtest === 'cubes' ? 6 : 5;
      assert.ok(worst <= ceiling, subtest + ' level ' + level + ' letter share peaked at ' + worst + '/15');
    }
});

/* Balance across a whole set is the thing a learner can game, so it is measured over many sets
   and at every level. Two different failures are caught here: an aggregate letter share that
   drifts (cube counting at level 1 used to key "5 cubes" 4% of the time), and a per-set shape
   that is the same every time (angles used to leave D one short in nearly every set, which a
   loose aggregate bound misses). Set counts differ by subtest only because a hole-punching set
   costs about fifty times what an angles set costs to build. */
const SETS_PER_LEVEL = { angles: 120, cubes: 30, holes: 12, keyholes: 20, tfe: 20, patterns: 30 };

test('every answer letter is reachable and near-equally likely over many sets, at every level', () => {
  for (const subtest of BUILT)
    for (const level of LEVELS) {
      const options = Core.optionsFor(subtest);
      const sets = SETS_PER_LEVEL[subtest];
      const counts = new Array(options).fill(0);
      const short = new Array(options).fill(0);
      for (let base = 1; base <= sets; base++) {
        const perSet = new Array(options).fill(0);
        Core.set(subtest, base * 8191 + level, level, 15).forEach(item => perSet[item.answer]++);
        perSet.forEach((c, i) => (counts[i] += c));
        const min = Math.min.apply(null, perSet);
        if (perSet.filter(c => c === min).length === 1) short[perSet.indexOf(min)]++;
      }
      const where = subtest + ' level ' + level + ' ' + JSON.stringify(counts);
      const expected = (sets * 15) / options;
      counts.forEach((c, i) =>
        assert.ok(c >= expected * 0.6, where + ': option ' + i + ' is the key ' + c + ' times, expected ~' + expected)
      );
      const chi2 = counts.reduce((sum, c) => sum + Math.pow(c - expected, 2) / expected, 0);
      assert.ok(chi2 < 16, where + ': letter distribution chi-square ' + chi2.toFixed(1));
      short.forEach((c, i) =>
        assert.ok(c <= sets * 0.5, where + ': option ' + i + ' is the short letter in ' + c + ' of ' + sets + ' sets')
      );
    }
});

test('a level outside 1-3 clamps to the nearest level instead of dropping to the middle', () => {
  for (const subtest of BUILT) {
    for (const high of [4, 9, 300]) {
      assert.equal(Core.generate(subtest, 5, high).level, 3, subtest + ' level ' + high);
      assert.deepEqual(Core.generate(subtest, 5, high), Core.generate(subtest, 5, 3), subtest + ' ' + high + ' is 3');
    }
    for (const low of [0, -1, -40]) {
      assert.equal(Core.generate(subtest, 5, low).level, 1, subtest + ' level ' + low);
      assert.deepEqual(Core.generate(subtest, 5, low), Core.generate(subtest, 5, 1), subtest + ' ' + low + ' is 1');
    }
    // A missing or unreadable level still falls back to the middle one.
    for (const empty of [undefined, null, '', 'hard', NaN])
      assert.equal(Core.generate(subtest, 5, empty).level, 2, subtest + ' level ' + String(empty));
  }
  assert.equal(Core.set('angles', 3, 7, 4)[0].level, 3, 'a set clamps too');
  assert.equal(Core.set('cubes', 24, 0, 4)[0].level, 1, 'a cube set clamps too');
  assert.equal(Core.formItems({ seedBase: 3, level: 12, per: 2 })[0].level, 3, 'a form clamps too');
});

test('formItems builds a mixed form from a spec and rebuilds one from stored ids', () => {
  const form = Core.formItems({ order: Core.SUBTESTS.map(s => s.id), seedBase: 7, level: 2, per: 15 });
  assert.equal(form.length, 90, 'all six built subtests contribute fifteen each');
  assert.deepEqual([...new Set(form.map(i => i.subtest))], BUILT, 'ADA subtest order is preserved');
  Core.formItems({ seedBase: 11, level: 2, per: 15 });
  const ids = form.map(i => i.id);
  assert.deepEqual(Core.formItems(ids), form, 'a form rebuilds from its ids alone');
  assert.deepEqual(
    Core.formItems(form.map(i => ({ subtest: i.subtest, seed: i.seed, level: i.level }))),
    form,
    'a form rebuilds from stored triples'
  );
});

test('dat-pat.js never puts a generated figure or option graphic into storage', () => {
  /* Asserted on the stored VALUES, not on the file's source text: a regex over dat-pat.js passes
     happily for code that writes an SVG through a variable, and the key-name matches it used to
     make were the file checked against itself. So the runner is driven for real — a 15-item set
     answered to the end, its review's add-to-mistake-log pressed, and a form left mid-run so the
     resume blob is in the store too — and every value the runner wrote is inspected. study-backup.js
     refuses any value containing markup, so one "<" here costs the learner their whole export. */
  const drill = patPage('https://cortex.test/dat?view=pat&subtest=holes&level=2');
  drill.w.DatPat.render();
  assert.ok(drill.w.document.querySelector('.dat-pat-figure svg'), 'the runner draws a live figure on screen');
  for (let i = 0; i < 15; i++) {
    const option = drill.w.document.querySelector('#dat-pat-opt-' + (i % 5));
    assert.ok(option, 'item ' + (i + 1) + ' offers its options');
    option.click();
    const next = drill.w.document.querySelector('#dat-pat-next');
    if (next) next.click();
  }
  const enrol = drill.w.document.querySelector('[data-dat-enrol]');
  assert.ok(enrol, 'the review offers add-to-mistake-log');
  enrol.click();
  // A form abandoned mid-run, so a live resume blob is in the store alongside the finished set.
  const form = patPage('https://cortex.test/dat?view=pat&set=full&level=2');
  form.w.DatPat.render();
  answerEverything(form.w, 3);
  const stored = Object.assign({}, drill.cell, { 'cs-dat-r-pat': form.cell['cs-dat-r-pat'] });
  for (const key of ['cs-dat-log', 'cs-dat-q', 'cs-dat-srs', 'cs-dat-r-pat'])
    assert.ok(stored[key] !== undefined, key + ' was actually written, so the check has something to look at');
  assert.equal(stored['cs-dat-log'].length, 15, 'one log row per answered item');
  assert.ok(Object.keys(stored['cs-dat-srs']).length, 'the mistake log took the item');
  assert.ok(stored['cs-dat-r-pat'].ids.length, 'the abandoned form left its ids behind');
  for (const [key, value] of Object.entries(stored)) {
    assert.match(key, /^cs-dat-/, 'the runner writes no key outside the DAT namespace');
    const text = JSON.stringify(value);
    assert.doesNotMatch(text, /<svg/i, key + ' carries no SVG');
    assert.doesNotMatch(text, /<[a-z/!]/i, key + ' would be refused by study-backup.js');
  }
  // What is stored instead is the regeneration triple, and it really does rebuild the figures.
  for (const row of stored['cs-dat-log']) {
    assert.equal(row.qId, Core.itemId(row.subtest, row.seed, row.level), row.qId + ' is its own triple');
    assert.ok(Core.fromId(row.qId), row.qId + ' regenerates from the stored row alone');
  }
  for (const id of stored['cs-dat-r-pat'].ids) assert.ok(Core.fromId(id), id + ' regenerates from the resume blob');
  drill.dom.window.close();
  form.dom.window.close();
});

test('data/dat-pat.json describes every built subtest with levels and demo seeds', () => {
  const data = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, '..', 'data', 'dat-pat.json'), 'utf8'));
  assert.deepEqual(
    data.subtests.map(s => s.id),
    BUILT
  );
  for (const subtest of data.subtests) {
    assert.equal(subtest.category, Core.subtestSpec(subtest.id).category, subtest.id + ' category');
    for (const field of ['rules', 'strategy', 'pitfalls'])
      assert.ok(Array.isArray(subtest[field]) && subtest[field].length >= 3, subtest.id + ' ' + field);
    assert.deepEqual(Object.keys(subtest.levels), ['1', '2', '3'], subtest.id + ' levels');
    for (const level of LEVELS) {
      assert.equal(subtest.levels[String(level)].label, Core.LEVELS[level], subtest.id + ' level label');
      const seeds = subtest.demoSeeds[String(level)];
      assert.equal(seeds.length, 3, subtest.id + ' three demo seeds per level');
      for (const seed of seeds) {
        const item = Core.generate(subtest.id, seed, level);
        assert.ok(Core.verify(item), subtest.id + ' demo seed ' + seed + ' verifies');
      }
    }
    const text = JSON.stringify(subtest);
    assert.doesNotMatch(
      text,
      /<|Bootcamp|Booster|Kaplan|Crack DAT|Princeton/i,
      subtest.id + ' is clean original prose'
    );
  }
});

test('a level outside the built range clamps to the nearest level instead of falling to the middle', () => {
  // A shared link that claims level 9 must serve the hardest set, not quietly serve level 2.
  assert.equal(Core.levelOf(9), 3);
  assert.equal(Core.levelOf(4), 3);
  assert.equal(Core.levelOf(0), 1);
  assert.equal(Core.levelOf(-2), 1);
  assert.equal(Core.levelOf(2), 2);
  // Only a missing or unreadable level falls back to the middle.
  assert.equal(Core.levelOf(null), 2);
  assert.equal(Core.levelOf(''), 2);
  assert.equal(Core.levelOf('abc'), 2);
  // The page must use this clamp rather than a second rule of its own.
  const page = fs.readFileSync(require('node:path').join(__dirname, '..', 'dat-pat.js'), 'utf8');
  assert.match(page, /Core\.levelOf\(/, 'dat-pat.js params() delegates to the engine clamp');
  assert.doesNotMatch(page, /level === 1 \|\| level === 2 \|\| level === 3/, 'no second level rule in the page');
});

/* The mixed ninety-item form, driven in jsdom. Two things are being pinned here. One: the form
   is fifteen of every subtest in the ADA's order under a single sixty-minute clock, and it ends
   with a result for each subtest. Two: the scaled estimate is shown only when the score layer is
   actually loaded — DAT-08 does not exist yet, and a page that invented a 200-600 number from a
   raw count would be making up a score. */
function patPage(url, extras) {
  const vm = require('node:vm');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  const outline = JSON.parse(fs.readFileSync(path.join(root, 'data', 'dat-outline.json'), 'utf8'));
  const dom = new JSDOM('<!doctype html><div id="app"></div>', { url, runScripts: 'outside-only' });
  const w = dom.window;
  const cell = {};
  Object.assign(w, {
    StudyStorage: {
      read: (key, fallback) => (key in cell ? JSON.parse(JSON.stringify(cell[key])) : fallback),
      write: (key, value) => {
        cell[key] = JSON.parse(JSON.stringify(value));
        return true;
      },
      remove: key => {
        delete cell[key];
        return true;
      },
      watch() {},
      sessionFailed() {},
    },
    el: html => {
      const template = w.document.createElement('template');
      template.innerHTML = html;
      return template.content.firstElementChild;
    },
    esc: String,
    topbar: () => w.document.createElement('header'),
    setView: node => w.document.querySelector('#app').replaceChildren(node),
    stopTimer() {},
    LETTERS: 'ABCDE'.split(''),
    datUrl: (query = {}) => '/dat?' + new URLSearchParams(query).toString(),
    datDataNotice: () => w.document.createElement('div'),
    datView: main => w.document.querySelector('#app').replaceChildren(main),
    DatDrillCore: {
      enroll: (store, item) => {
        store[item.id] = store[item.id] || { id: item.id };
        return store[item.id];
      },
    },
    DAT: { pausers: [], attemptStores: null, outline, pat: null, loaded: true },
  });
  Object.assign(w, extras || {});
  for (const file of ['dat-pat-engine.js', 'dat-pat.js'])
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), dom.getInternalVMContext());
  return { dom, w, cell };
}
function answerEverything(w, limit) {
  let clicks = 0;
  for (let i = 0; i < limit; i++) {
    const button = w.document.querySelector('#dat-pat-opt-0');
    if (!button || button.disabled) break;
    button.click();
    clicks++;
  }
  return clicks;
}

test('the mixed form runs fifteen of each subtest in ADA order under one sixty-minute clock', () => {
  const { dom, w, cell } = patPage('https://cortex.test/dat?view=pat&set=full&level=2');
  w.DatPat.render();
  const clock = w.document.querySelector('.dat-pat-pace-label').textContent;
  assert.match(clock, /left of 60 min/, 'the form runs against a section clock, not a per-item pace');
  assert.equal(w.document.querySelector('.dat-pat-count').textContent, 'Item 1 of 90');
  assert.match(w.document.querySelector('.dat-pat-eyebrow').textContent, /mixed form/);
  // The resume blob is the form's ids and answers and nothing else: no markup may reach storage.
  const blob = cell['cs-dat-r-pat'];
  assert.equal(blob.form, true, 'the saved blob knows it is a form');
  assert.equal(blob.ids.length, 90);
  assert.doesNotMatch(JSON.stringify(blob), /</, 'the resume blob carries no markup');
  const order = blob.ids.map(id => Core.parseId(id).subtest);
  assert.deepEqual([...new Set(order)], BUILT, 'ADA subtest order');
  for (const subtest of BUILT)
    assert.equal(order.filter(s => s === subtest).length, 15, subtest + ' contributes fifteen');
  assert.equal(answerEverything(w, 95), 90, 'ninety items are answered, then the form ends');
  const main = w.document.querySelector('#app');
  assert.match(main.textContent, /Mixed form · results/);
  const rows = [...w.document.querySelectorAll('.dat-pat-form-table tbody tr')];
  assert.equal(rows.length, 6, 'a result row for every subtest');
  const outline = JSON.parse(
    fs.readFileSync(require('node:path').join(__dirname, '..', 'data', 'dat-outline.json'), 'utf8')
  );
  for (const subtest of outline.patSubtests)
    assert.ok(main.textContent.includes(subtest.alias), subtest.alias + ' has a row');
  assert.ok(
    rows.every(row => /\d+ of 15/.test(row.textContent)),
    'each row reports the raw count out of 15'
  );
  // No score layer loaded: the page says so and prints no scaled number.
  assert.equal(w.document.querySelector('.dat-pat-estimate'), null, 'no estimate without the score layer');
  assert.match(main.textContent, /Scaled 200–600 estimates arrive with the score layer/);
  assert.doesNotMatch(main.textContent, /est\. \d\d\d/, 'nothing that reads as a scaled score');
  assert.equal(cell['cs-dat-r-pat'], undefined, 'the finished form clears its resume blob');
  const log = cell['cs-dat-log'];
  assert.equal(log.length, 90, 'one log row per answered item');
  assert.ok(
    log.every(row => row.section === 'pat' && row.seed >= 0 && row.level === 2 && !('figure' in row)),
    'log rows carry the regeneration triple and no figure'
  );
  assert.doesNotMatch(JSON.stringify(log), /</, 'no markup reaches the log');
  dom.window.close();
});

test('an unfinished form is offered back from the picker and resumes where it stopped', () => {
  const started = patPage('https://cortex.test/dat?view=pat&set=full&level=2');
  started.w.DatPat.render();
  for (let i = 0; i < 4; i++) started.w.document.querySelector('#dat-pat-opt-0').click();
  const saved = started.cell['cs-dat-r-pat'];
  assert.equal(saved.idx, 4, 'the blob remembers the seat');
  started.dom.window.close();
  // A fresh page with that blob: the picker offers it, and the form itself picks it back up.
  const picker = patPage('https://cortex.test/dat?view=pat&level=2');
  picker.cell['cs-dat-r-pat'] = saved;
  picker.w.DatPat.render();
  const resume = [...picker.w.document.querySelectorAll('.course-notice a')].find(a => a.textContent === 'Resume it');
  assert.ok(resume, 'the picker offers the unfinished form');
  assert.match(picker.w.document.querySelector('.course-notice').textContent, /ninety-item form/);
  assert.match(resume.getAttribute('href'), /set=full/, 'and sends the learner back to the form, not to a subtest');
  picker.dom.window.close();
  const again = patPage('https://cortex.test/dat?view=pat&set=full&level=2');
  again.cell['cs-dat-r-pat'] = saved;
  again.w.DatPat.render();
  assert.equal(again.w.document.querySelector('.dat-pat-count').textContent, 'Item 5 of 90', 'it resumes mid-form');
  assert.deepEqual(again.cell['cs-dat-r-pat'].ids, saved.ids, 'on the same ninety items');
  again.dom.window.close();
});

test('the form prints a PAT estimate only when the score layer is on the page', () => {
  const asked = [];
  const { dom, w } = patPage('https://cortex.test/dat?view=pat&set=full&level=2', {
    DatScoreCore: {
      DISCLAIMER: 'An estimate from practice items, not a predicted score.',
      estimate(section, correct, total) {
        asked.push([section, correct, total]);
        return { scaled: 420, band: [400, 440], percentile: 65, old: 19 };
      },
    },
  });
  w.DatPat.render();
  assert.equal(answerEverything(w, 95), 90);
  const line = w.document.querySelector('.dat-pat-estimate');
  assert.ok(line, 'the estimate line renders when DatScoreCore is present');
  assert.match(line.textContent, /est\. 420 \(band 400–440\)/);
  assert.match(line.textContent, /65th percentile/);
  assert.match(line.textContent, /19 on the pre-2025 scale/);
  assert.match(w.document.querySelector('#app').textContent, /not a predicted score/, 'the disclaimer follows it');
  assert.equal(asked.length, 1, 'the page asks the score layer once');
  assert.equal(asked[0][0], 'pat');
  assert.equal(asked[0][2], 90, 'out of ninety');
  dom.window.close();
});

test('a score layer that throws or answers with nonsense leaves the raw counts standing', () => {
  for (const estimate of [
    () => {
      throw Error('no table');
    },
    () => null,
    () => ({ scaled: 'unknown' }),
  ]) {
    const { dom, w } = patPage('https://cortex.test/dat?view=pat&set=full&level=2', {
      DatScoreCore: { estimate },
    });
    w.DatPat.render();
    assert.equal(answerEverything(w, 95), 90);
    const main = w.document.querySelector('#app');
    assert.equal(w.document.querySelector('.dat-pat-estimate'), null, 'no estimate line');
    assert.equal([...w.document.querySelectorAll('.dat-pat-form-table tbody tr')].length, 6, 'raw rows survive');
    assert.doesNotMatch(main.textContent, /est\. /, 'nothing that reads as a score');
    dom.window.close();
  }
});

test('the picker offers the form and surfaces the level ramp only once it has been earned', () => {
  const page = patPage('https://cortex.test/dat?view=pat&level=2');
  page.w.DatPat.render();
  const app = page.w.document.querySelector('#app');
  assert.match(app.textContent, /Start the 90-item form/, 'the mixed form is offered from the picker');
  assert.equal(app.querySelector('.dat-pat-raise'), null, 'no ramp suggestion with an empty log');
  page.dom.window.close();
  // Two sets of 15 at 14/15, inside the 22 s angle-ranking budget, earns the suggestion.
  const rows = [];
  for (const attempt of ['a1', 'a2'])
    for (let i = 0; i < 15; i++)
      rows.push({
        qId: 'pat-angles-s' + i + '-l2',
        section: 'pat',
        subtest: 'angles',
        level: 2,
        correct: i > 0,
        ms: 12000,
        ts: 1000 + i,
        attemptId: attempt,
        source: 'pat',
      });
  const earned = patPage('https://cortex.test/dat?view=pat&level=2');
  earned.cell['cs-dat-log'] = rows;
  earned.w.DatPat.render();
  const raise = earned.w.document.querySelector('.dat-pat-raise');
  assert.ok(raise, 'the ramp is surfaced after two strong sets');
  assert.match(raise.textContent, /try level 3/);
  assert.match(raise.getAttribute('href'), /level=3/);
  assert.equal(
    earned.w.document.querySelectorAll('.dat-pat-raise').length,
    1,
    'only the subtest that earned it is flagged'
  );
  earned.dom.window.close();
  // The same two sets taken over the pace budget do not earn it.
  const slow = patPage('https://cortex.test/dat?view=pat&level=2');
  slow.cell['cs-dat-log'] = rows.map(row => Object.assign({}, row, { ms: 40000 }));
  slow.w.DatPat.render();
  assert.equal(slow.w.document.querySelector('.dat-pat-raise'), null, 'over budget earns nothing');
  slow.dom.window.close();
});

test('the picker still renders when the generator engine did not load', () => {
  // renderPicker() is the page shown when DatPatCore is missing, and it calls params() —
  // so params() must not reach through Core. This threw before the guard landed.
  const { JSDOM } = require('jsdom');
  const vm = require('node:vm');
  const dom = new JSDOM('<!doctype html><div id="app"></div>', {
    url: 'https://cortex.test/dat?view=pat&subtest=cubes&level=9',
    runScripts: 'outside-only',
  });
  const w = dom.window;
  Object.assign(w, {
    StudyStorage: { read: (_k, d) => d, write: () => true, watch() {}, sessionFailed() {} },
    el: html => {
      const t = w.document.createElement('template');
      t.innerHTML = html;
      return t.content.firstElementChild;
    },
    esc: String,
    topbar: () => w.document.createElement('header'),
    setView: node => w.document.querySelector('#app').replaceChildren(node),
    stopTimer() {},
    LETTERS: 'ABCDEF'.split(''),
    datUrl: (params = {}) => '/dat?' + new URLSearchParams(params).toString(),
    datDataNotice: () => w.document.createElement('div'),
    datView: main => w.document.querySelector('#app').replaceChildren(main),
    DAT: { pausers: [], attemptStores: null, outline: null, loaded: true },
  });
  // Deliberately do not load dat-pat-engine.js: this is the did-not-load path.
  vm.runInContext(
    fs.readFileSync(require('node:path').join(__dirname, '..', 'dat-pat.js'), 'utf8'),
    dom.getInternalVMContext()
  );
  assert.doesNotThrow(() => w.DatPat.render(), 'the engine-missing page must not throw');
  assert.match(w.document.querySelector('#app').textContent, /did not load/);
  dom.window.close();
});
