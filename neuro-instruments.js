/* Neuroengineering lab instruments.

   A lab in data/neuro.json can carry an `instrument`. Its plot then becomes adjustable: the reader
   moves a threshold, a margin, a gain or a boundary, and every number beside the plot is recomputed
   from the lab's own toy rule. The models come first and touch no DOM, so Node can prove that each
   lab's authored setting reproduces the numbers its text states (scripts/test-neuro-instruments.cjs).

   neuro.js reaches this file through neuroBenchValid, neuroBenchMarkup and neuroBenchMount, each
   behind a typeof check, so a lab falls back to its static plot when this file is missing.

   Names: functions are neuroBench…, markup hooks are data-bench-… and styles are .nx-live-…,
   because the .nx-bench class already means the workbench page layout. */

// The settings a reader last used in each lab, kept until the page reloads. Never saved.
const NEURO_BENCH_STATE = {};

const neuroBenchNum = value => String(Math.round(Number(value) * 1e5) / 1e5 + 0);
const neuroBenchPx = value => Math.round(value * 10) / 10;
const neuroBenchDigits = value => (String(value).split('.')[1] || '').length;
function neuroBenchSnap(value, control) {
  const stepped = control.min + Math.round((value - control.min) / control.step) * control.step;
  const digits = Math.max(neuroBenchDigits(control.step), neuroBenchDigits(control.min));
  return Number(Math.min(control.max, Math.max(control.min, stepped)).toFixed(digits));
}

/* ---------- Models ---------- */

// Samples at or above a threshold, the episodes they form, and where a detector acts when it waits
// for `confirm` consecutive windows. `event` is the labeled span the lab's text describes.
function neuroBenchDetect(values, threshold, confirm = 1, event = null) {
  const above = values.map(value => value >= threshold);
  const inEvent = i => !!event && i >= event.start && i <= event.end;
  const episodes = [];
  above.forEach((on, i) => {
    if (!on) return;
    if (i && above[i - 1]) episodes.at(-1).end = i;
    else episodes.push({ start: i, end: i });
  });
  for (const episode of episodes)
    episode.act = episode.end - episode.start + 1 >= confirm ? episode.start + confirm - 1 : null;
  const actions = episodes.filter(episode => episode.act != null).map(episode => episode.act);
  const onEvent = actions.filter(inEvent);
  return {
    above,
    episodes,
    actions,
    windows: above.filter(Boolean).length,
    inside: above.filter((on, i) => on && inEvent(i)).length,
    outside: above.filter((on, i) => on && !inEvent(i)).length,
    eventWindows: event ? event.end - event.start + 1 : 0,
    actionsOff: actions.length - onEvent.length,
    caught: onEvent.length > 0,
    delay: onEvent.length ? onEvent[0] - event.start : null,
  };
}

// A decoder that abstains while a score is within `margin` of its threshold. 1 acts above the
// threshold, -1 acts below it, 0 holds.
function neuroBenchBand(values, threshold, margin, rateHz) {
  const decisions = values.map(value => (Math.abs(value - threshold) <= margin ? 0 : value > threshold ? 1 : -1));
  let run = 0,
    longest = 0,
    last = 0,
    flips = 0;
  for (const decision of decisions) {
    run = decision ? 0 : run + 1;
    longest = Math.max(longest, run);
    if (!decision) continue;
    if (last && decision !== last) flips++;
    last = decision;
  }
  const held = decisions.filter(decision => !decision).length;
  return { decisions, held, acted: values.length - held, longestHold: longest / rateHz, flips };
}

// A toy cursor loop. Every `dt` it commands gain × (target − observed position), clips the command
// to the speed limit and moves by velocity × dt. `delaySteps` makes the observed position that many
// updates old. `settle` is the first update from which the cursor stays within `band` of the target.
function neuroBenchLoop({ gain, limit, delaySteps = 0, target = 1, dt = 0.1, steps = 20, start = 0, band = 0.05 }) {
  const total = steps + 60,
    all = [start],
    clippedAll = [];
  for (let n = 0; n < total; n++) {
    const seen = n - delaySteps >= 0 ? all[n - delaySteps] : start;
    const command = gain * (target - seen);
    clippedAll.push(Math.abs(command) > limit + 1e-9);
    all.push(all[n] + Math.max(-limit, Math.min(limit, command)) * dt);
  }
  let settle = null;
  for (let n = total; n >= 0 && Math.abs(all[n] - target) <= band + 1e-9; n--) settle = n;
  const positions = all.slice(0, steps + 1),
    clipped = clippedAll.slice(0, steps),
    peak = Math.max(...positions);
  return {
    positions,
    clipped,
    peak,
    overshoot: Math.max(0, peak - target),
    settle: settle != null && settle <= steps ? settle * dt : null,
    clippedCount: clipped.filter(Boolean).length,
    firstStep: positions[1] - positions[0],
  };
}

// A fixed linear decoder on labeled trials [f0, f1, label]. Class 1 only when the score is above 0.
function neuroBenchBoundary(trials, weights, bias) {
  const scores = trials.map(trial => weights[0] * trial[0] + weights[1] * trial[1] + bias);
  const decoded = scores.map(score => (score > 0 ? 1 : 0));
  const wrong = trials.flatMap((trial, i) => (decoded[i] === trial[2] ? [] : [i]));
  return { scores, decoded, wrong, correct: trials.length - wrong.length };
}

// A centered moving average. Full windows only, unless `pad` extends both ends with zeros.
function neuroBenchSmooth(values, width, pad) {
  const half = (width - 1) / 2,
    output = [];
  for (let center = pad ? 0 : half; center < values.length - (pad ? 0 : half); center++) {
    let sum = 0;
    for (let i = center - half; i <= center + half; i++) sum += values[i] ?? 0;
    output.push({ index: center, value: sum / width });
  }
  return output;
}

// What each recorded setting costs once errors are priced, and which settings are cheapest.
function neuroBenchCosts(settings, falseCost, missCost) {
  const costs = settings.map(setting => setting.falseActions * falseCost + setting.missed * missCost);
  const low = Math.min(...costs);
  return { costs, lowest: costs.flatMap((cost, i) => (cost === low ? [i] : [])) };
}

/* ---------- Drawing helpers ---------- */

function neuroBenchTicks(min, max, want) {
  const span = max - min || 1,
    pow = 10 ** Math.floor(Math.log10(span / want));
  const step = [1, 2, 5, 10].map(m => m * pow).find(size => span / size <= want + 1);
  const ticks = [];
  for (let tick = Math.ceil(min / step - 1e-9) * step; tick <= max + step * 1e-9; tick += step)
    ticks.push(Number(neuroBenchNum(tick)));
  return ticks;
}
// Axes for a plot drawn at its real pixel size: `geom.W` is the width the plot has on screen.
function neuroBenchFrame(geom, { x, y, xLabel, yLabel, xTicks, below = 0, grip = false, tag = false }) {
  const narrow = geom.W < 440;
  const L = narrow ? 36 : 46,
    R = geom.W - (grip ? 36 : 14),
    T = tag ? 42 : 30,
    B = geom.H - 42 - below;
  const sx = value => L + ((value - x[0]) / (x[1] - x[0] || 1)) * (R - L);
  const sy = value => B - ((value - y[0]) / (y[1] - y[0] || 1)) * (B - T);
  const yTicks = neuroBenchTicks(y[0], y[1], narrow ? 3 : 4);
  const px = neuroBenchPx;
  const svg = `<path class="neuro-fig-grid" d="${yTicks.map(tick => `M${L} ${px(sy(tick))}H${R}`).join('')}" fill="none"/>
    <path class="neuro-fig-axis" d="M${L} ${T}V${B}H${R}" fill="none"/>
    <g class="neuro-fig-text nx-live-ticks">${yTicks.map(tick => `<text x="${L - 7}" y="${px(sy(tick) + 4)}" text-anchor="end">${neuroBenchNum(tick)}</text>`).join('')}${xTicks
      .map(
        ([value, label]) => `<text x="${px(sx(value))}" y="${B + below + 18}" text-anchor="middle">${esc(label)}</text>`
      )
      .join('')}
      <text class="nx-live-axis" x="${L}" y="${tag ? 13 : 15}">${esc(yLabel)}</text><text class="nx-live-axis" x="${R}" y="${geom.H - 6}" text-anchor="end">${esc(xLabel)}</text></g>`;
  return {
    L,
    R,
    T,
    B,
    x: sx,
    y: sy,
    yInv: py => y[0] + ((B - py) / (B - T)) * (y[1] - y[0]),
    svg,
    narrow,
  };
}
const neuroBenchLine = (frame, points, cls) =>
  `<polyline class="${cls}" points="${points.map(([x, y]) => `${neuroBenchPx(frame.x(x))},${neuroBenchPx(frame.y(y))}`).join(' ')}" fill="none"/>`;
// Time labels under a sampled series: first, last and, on a wide plot, the middle sample.
function neuroBenchTimeTicks(count, time, narrow) {
  const picks = count > 6 && !narrow ? [0, Math.round((count - 1) / 2), count - 1] : [0, count - 1];
  return [...new Set(picks)].map(i => [i, neuroBenchNum(time(i))]);
}
const neuroBenchRange = (key, label, control, text) => ({
  key,
  label,
  min: control.min,
  max: control.max,
  step: control.step,
  value: control.value,
  text,
});

/* ---------- Instruments ---------- */

// Threshold on a sampled series: count view (samples and episodes), event view (inside or outside a
// labeled span), confirm view (wait for several windows; optional cost table after the answer).
function neuroBenchDetector(spec, sim) {
  const series = sim.series,
    values = series.values,
    count = values.length,
    unit = series.unit,
    event = spec.event || null,
    windowMs = 1000 / series.sampleRateHz;
  const time = i => (series.xStart || 0) + i / series.sampleRateHz;
  const low = Math.min(...values, spec.threshold.min),
    high = Math.max(...values, spec.threshold.max),
    pad = (high - low || 1) * 0.08;
  const costs = spec.costs || null;
  const marks = { count: '', event: ', episode starts', confirm: ', acts' };
  const run = state => neuroBenchDetect(values, state.threshold, state.confirm || 1, event);
  const priced = state => neuroBenchCosts(costs.settings, state.falseCost, state.missCost);
  return {
    title: spec.title || series.title,
    controls: full => [
      neuroBenchRange('threshold', 'Threshold', spec.threshold, value => `${neuroBenchNum(value)} ${unit}`),
      ...(spec.confirm
        ? [
            neuroBenchRange(
              'confirm',
              'Windows in a row before acting',
              { min: 1, max: spec.confirm.max, step: 1, value: spec.confirm.value },
              value => (value === 1 ? '1 window' : `${value} windows`)
            ),
          ]
        : []),
      ...(costs && full
        ? [
            {
              ...neuroBenchRange(
                'falseCost',
                'Cost of one false action',
                { min: 1, max: 10, step: 1, value: costs.falseAction },
                String
              ),
              zone: 'Reprice the recorded day',
            },
            {
              ...neuroBenchRange(
                'missCost',
                'Cost of one missed event',
                { min: 1, max: 40, step: 1, value: costs.missedEvent },
                String
              ),
              zone: 'Reprice the recorded day',
            },
          ]
        : []),
    ],
    presets: (spec.presets || []).map(preset => ({
      label: `Setting ${preset.label}`,
      set: { threshold: preset.threshold, confirm: preset.confirm },
    })),
    compute: run,
    facts(state, result) {
      const lowest = costs ? priced(state).lowest : [];
      return {
        threshold: state.threshold,
        confirm: state.confirm || 1,
        windows: result.windows,
        inside: result.inside,
        outside: result.outside,
        episodes: result.episodes.length,
        actions: result.actions.length,
        actionsOff: result.actionsOff,
        caught: result.caught ? 1 : 0,
        lowest: lowest.length === 1 ? costs.settings[lowest[0]].label : '',
      };
    },
    draw(state, result, geom) {
      const frame = neuroBenchFrame(geom, {
        x: [0, count - 1],
        y: [low - pad, high + pad],
        xLabel: series.xLabel || 'Time (s)',
        yLabel: `${series.yLabel || 'Amplitude'} (${unit})`,
        xTicks: neuroBenchTimeTicks(count, time, geom.W < 440),
        below: 20,
        grip: true,
        tag: !!event,
      });
      const px = neuroBenchPx,
        half = count > 1 ? (frame.x(1) - frame.x(0)) / 2 : 8,
        line = frame.y(state.threshold);
      const span = (from, to) => [Math.max(frame.L, frame.x(from) - half), Math.min(frame.R, frame.x(to) + half)];
      // A centered tag, kept inside the plot. Mono text at 11px is about 6.7px a character.
      const tag = (text, at, y, cls = '') => {
        const reach = text.length * 3.4 + 2,
          x = Math.min(frame.R - reach, Math.max(frame.L + reach, at));
        return `<text class="nx-live-tag${cls}" x="${px(x)}" y="${px(y)}" text-anchor="middle">${esc(text)}</text>`;
      };
      const eventBand = () => {
        const [from, to] = span(event.start, event.end);
        return `<rect class="nx-live-event" x="${px(from)}" y="${frame.T}" width="${px(to - from)}" height="${frame.B - frame.T}"/>${tag(event.label.toLowerCase(), (from + to) / 2, frame.T - 6)}`;
      };
      const artifact = spec.artifact
        ? tag(
            (spec.artifact.tag || spec.artifact.label).toLowerCase(),
            frame.x(spec.artifact.index),
            frame.y(values[spec.artifact.index]) - 12,
            ' is-quiet'
          )
        : '';
      const track = result.episodes
        .map(episode => {
          const from = frame.x(episode.start) - Math.min(half, 6),
            to = frame.x(episode.end) + Math.min(half, 6);
          return `<rect class="nx-live-run${episode.act == null ? ' is-short' : ''}" x="${px(from)}" y="${frame.B + 7}" width="${px(to - from)}" height="7" rx="3.5"/>`;
        })
        .join('');
      const svg = `${event ? eventBand() : ''}${frame.svg}${track}
        <path class="neuro-series-threshold" d="M${frame.L} ${px(line)}H${frame.R}" fill="none" stroke-width="2" stroke-dasharray="6 4"/>
        ${neuroBenchLine(
          frame,
          values.map((value, i) => [i, value]),
          'neuro-fig-line'
        )}
        ${values.map((value, i) => `<circle class="neuro-fig-dot${result.above[i] ? ' is-on' : ''}" cx="${px(frame.x(i))}" cy="${px(frame.y(value))}" r="${result.above[i] ? 4 : 3}"/>`).join('')}
        ${spec.view === 'count' ? '' : result.actions.map(i => `<circle class="neuro-series-marker" cx="${px(frame.x(i))}" cy="${px(frame.y(values[i]))}" r="8" fill="none" stroke-width="2.5"/>`).join('')}${artifact}`;
      return {
        svg,
        grip: { key: 'threshold', x: frame.R + 16, y: line, fromY: frame.yInv },
      };
    },
    key() {
      const acts =
        spec.view === 'count'
          ? ''
          : spec.confirm
            ? ' White rings: where the detector acts.'
            : ' White rings: where an episode starts.';
      return `Dashed amber line: the threshold. Larger dots are at or above it, and each bar under the plot is one unbroken stretch.${acts}${event ? ` Shaded: ${esc(event.label.toLowerCase())}.` : ''}`;
    },
    read(state, result) {
      if (spec.view === 'count')
        return [
          ['Qualifying samples', `${result.windows} of ${count}`],
          ['Episodes', String(result.episodes.length)],
        ];
      if (spec.view === 'confirm') {
        const onArtifact = spec.artifact && result.actions.includes(spec.artifact.index);
        return [
          ['Actions in this excerpt', String(result.actions.length)],
          ...(spec.artifact
            ? [[spec.artifact.label, onArtifact ? 'Acted on' : 'Ignored', onArtifact ? 'warn' : 'good']]
            : []),
          [
            event.label,
            !result.caught
              ? 'Missed'
              : result.delay
                ? `Acted on ${neuroBenchNum(result.delay * windowMs)} ms after it starts`
                : 'Acted on in its first window',
            result.caught ? 'good' : 'bad',
          ],
        ];
      }
      return [
        ['Windows that trigger', `${result.windows} of ${count}`],
        [
          `Inside the ${event.label.toLowerCase()}`,
          `${result.inside} of ${result.eventWindows}`,
          result.inside ? 'good' : 'bad',
        ],
        ['Outside it', String(result.outside), result.outside ? 'warn' : 'good'],
        ['Episodes that start', String(result.episodes.length)],
      ];
    },
    extra(state, result, full) {
      if (!costs || !full) return '';
      const { costs: totals, lowest } = priced(state),
        top = Math.max(...totals, 1);
      return `<div class="nx-live-costs"><ul>${costs.settings
        .map(
          (setting, i) =>
            `<li${lowest.includes(i) ? ' class="is-low"' : ''}><b>${esc(setting.label)}</b><span>${setting.falseActions} false, ${setting.missed} missed</span><i><i style="width:${neuroBenchPx((totals[i] / top) * 100)}%"></i></i><strong>${neuroBenchNum(totals[i])}</strong><em>${lowest.includes(i) ? 'lowest' : ''}</em></li>`
        )
        .join('')}</ul></div>`;
    },
    table(state, result) {
      return {
        head: ['Index', series.xLabel || 'Time (s)', `Value (${unit})`, 'At or above threshold'],
        rows: values.map((value, i) => [
          i,
          neuroBenchNum(time(i)),
          value,
          (result.above[i] ? 'yes' : 'no') + (result.actions.includes(i) ? marks[spec.view] : ''),
        ]),
      };
    },
  };
}

// Abstain margin around a decoder threshold.
function neuroBenchMargin(spec, sim) {
  const series = sim.series,
    values = series.values,
    count = values.length,
    names = spec.labels;
  const time = i => (series.xStart || 0) + i / series.sampleRateHz;
  const reach = Math.max(...values.map(value => Math.abs(value - spec.threshold)), spec.margin.max) * 1.12;
  const word = decision => (decision > 0 ? names[1] : decision < 0 ? names[0] : 'hold');
  return {
    title: spec.title || series.title,
    controls: () => [
      neuroBenchRange(
        'margin',
        'Abstain margin',
        spec.margin,
        value => `within ${neuroBenchNum(value)} of the threshold`
      ),
    ],
    presets: [],
    compute: state => neuroBenchBand(values, spec.threshold, state.margin, series.sampleRateHz),
    facts: (state, result) => ({
      margin: state.margin,
      acted: result.acted,
      held: result.held,
      flips: result.flips,
      longestHold: result.longestHold,
    }),
    draw(state, result, geom) {
      const frame = neuroBenchFrame(geom, {
        x: [0, count - 1],
        y: [spec.threshold - reach, spec.threshold + reach],
        xLabel: series.xLabel || 'Time (s)',
        yLabel: `${series.yLabel || 'Score'} (${series.unit})`,
        xTicks: neuroBenchTimeTicks(count, time, geom.W < 440),
        below: 22,
        grip: true,
      });
      const px = neuroBenchPx,
        top = frame.y(spec.threshold + state.margin),
        bottom = frame.y(spec.threshold - state.margin),
        base = frame.B + 12;
      const mark = (decision, i) => {
        const x = px(frame.x(i));
        if (!decision) return `<path class="nx-live-hold" d="M${x - 4} ${base}h8" fill="none"/>`;
        const tip = decision > 0 ? 5 : -5;
        return `<path class="nx-live-go${decision < 0 ? ' is-other' : ''}" d="M${x + tip} ${base}L${x - tip} ${base - 5}V${base + 5}Z"/>`;
      };
      const svg = `<rect class="nx-live-margin" x="${frame.L}" y="${px(top)}" width="${frame.R - frame.L}" height="${px(Math.max(0, bottom - top))}"/>${frame.svg}
        <path class="neuro-series-threshold" d="M${frame.L} ${px(frame.y(spec.threshold))}H${frame.R}" fill="none" stroke-width="2" stroke-dasharray="6 4"/>
        <path class="nx-live-edge" d="M${frame.L} ${px(top)}H${frame.R}M${frame.L} ${px(bottom)}H${frame.R}" fill="none"/>
        ${neuroBenchLine(
          frame,
          values.map((value, i) => [i, value]),
          'neuro-fig-line'
        )}
        ${values.map((value, i) => `<circle class="neuro-fig-dot${result.decisions[i] ? ' is-on' : ' is-held'}" cx="${px(frame.x(i))}" cy="${px(frame.y(value))}" r="${result.decisions[i] ? 4 : 3.5}"/>`).join('')}
        ${result.decisions.map(mark).join('')}`;
      return {
        svg,
        grip: { key: 'margin', x: frame.R + 16, y: top, fromY: py => frame.yInv(py) - spec.threshold },
      };
    },
    key: () =>
      `Dashed amber line: the threshold. Shaded: the abstain margin. Hollow dots are held. Under the plot, an arrow is a window the decoder acts on (pointing right for ${esc(names[1])}, left for ${esc(names[0])}) and a dash is a hold.`,
    read: (state, result) => [
      ['Windows acted on', `${result.acted} of ${count}`],
      ['Windows held', String(result.held)],
      ['Longest hold', `${neuroBenchNum(result.longestHold)} s`],
      ['Direction changes', String(result.flips), result.flips ? 'warn' : ''],
    ],
    table: (state, result) => ({
      head: ['Index', series.xLabel || 'Time (s)', `Score (${series.unit})`, 'Decision'],
      rows: values.map((value, i) => [i, neuroBenchNum(time(i)), value, word(result.decisions[i])]),
    }),
  };
}

// Toy cursor loop with an adjustable gain, speed limit or observation delay.
function neuroBenchCursor(spec) {
  const fixed = { target: spec.target, dt: spec.dt, steps: spec.steps };
  const adjustable = key => Number.isFinite(spec[key].min);
  const settings = state => ({ ...fixed, gain: state.gain, limit: state.limit, delaySteps: state.delay });
  const compare = spec.compare || null;
  const hidden = full => (full ? [] : spec.mask || []);
  const labels = {
    gain: ['Gain', value => neuroBenchNum(value)],
    limit: ['Speed limit', value => `${neuroBenchNum(value)} units/s`],
    delay: ['Observation delay', value => `${neuroBenchNum(value * spec.dt)} s`],
  };
  return {
    title: spec.title,
    hand: !!spec.hand,
    start: { gain: spec.gain.value, limit: spec.limit.value, delay: spec.delay.value },
    controls: () =>
      ['delay', 'limit', 'gain']
        .filter(adjustable)
        .map(key => neuroBenchRange(key, labels[key][0], spec[key], labels[key][1])),
    presets: [],
    compute(state) {
      const result = neuroBenchLoop(settings(state));
      if (compare) result.other = neuroBenchLoop({ ...settings(state), ...compare.set }).positions;
      return result;
    },
    facts: (state, result) => ({
      gain: state.gain,
      limit: state.limit,
      delay: state.delay,
      peak: result.peak,
      overshoot: result.overshoot,
      clipped: result.clippedCount,
      firstStep: result.firstStep,
      settled: result.settle == null ? 0 : 1,
    }),
    draw(state, result, geom, full) {
      const all = [...result.positions, ...(result.other || []), spec.target * 1.25, 0];
      const frame = neuroBenchFrame(geom, {
        x: [0, spec.steps],
        y: [Math.floor(Math.min(...all) * 2 + 1e-9) / 2, Math.ceil(Math.max(...all) * 2 - 1e-9) / 2],
        xLabel: 'Time (s)',
        yLabel: 'Cursor position',
        xTicks: [0, spec.steps / 2, spec.steps].map(step => [step, neuroBenchNum(step * spec.dt)]),
      });
      const px = neuroBenchPx,
        goal = px(frame.y(spec.target));
      const limited =
        hidden(full).includes('clipped') || !adjustable('limit')
          ? ''
          : result.clipped
              .map((on, n) =>
                on
                  ? `<path class="nx-live-clip" d="M${px(frame.x(n))} ${px(frame.y(result.positions[n]))}L${px(frame.x(n + 1))} ${px(frame.y(result.positions[n + 1]))}" fill="none"/>`
                  : ''
              )
              .join('');
      const svg = `${frame.svg}
        <path class="neuro-series-threshold" d="M${frame.L} ${goal}H${frame.R}" fill="none" stroke-width="2" stroke-dasharray="6 4"/>
        ${
          result.other
            ? neuroBenchLine(
                frame,
                result.other.map((value, n) => [n, value]),
                'neuro-fig-compare nx-live-other'
              )
            : ''
        }
        ${neuroBenchLine(
          frame,
          result.positions.map((value, n) => [n, value]),
          'neuro-fig-line'
        )}${limited}
        ${result.positions.map((value, n) => `<circle class="neuro-fig-dot" cx="${px(frame.x(n))}" cy="${px(frame.y(value))}" r="${frame.narrow ? 2 : 2.6}"/>`).join('')}`;
      return { svg, grip: null };
    },
    key(full) {
      const clip =
        adjustable('limit') && !hidden(full).includes('clipped')
          ? ' Amber stretches: updates where the speed limit clipped the command.'
          : '';
      return `Dashed amber line: the target. Dots are the positions the loop computes every ${neuroBenchNum(spec.dt)} s.${compare ? ` Dotted grey line: ${esc(compare.label.toLowerCase())}.` : ''}${clip}`;
    },
    read(state, result, full) {
      // Readouts round to three places. The exact values table keeps five.
      const window = `${neuroBenchNum(spec.steps * spec.dt)} s`,
        short = value => neuroBenchNum(Math.round(value * 1000) / 1000);
      const all = {
        firstStep: ['First step', short(result.firstStep)],
        peak: ['Highest position', short(result.peak)],
        overshoot: [
          'Past the target by',
          result.overshoot >= 0.0005 ? short(result.overshoot) : 'nothing',
          result.overshoot > 0.05 ? 'warn' : 'good',
        ],
        settle: [
          'Stays within 0.05 of the target from',
          result.settle == null ? `not within ${window}` : `${neuroBenchNum(result.settle)} s`,
          result.settle == null ? 'warn' : '',
        ],
        clipped: ['Updates the limit clipped', `${result.clippedCount} of ${spec.steps}`],
      };
      return spec.readouts.filter(key => !hidden(full).includes(key)).map(key => all[key]);
    },
    table(state, result, full) {
      const limited = adjustable('limit') && !hidden(full).includes('clipped');
      return {
        head: [
          'Update',
          'Time (s)',
          'Position',
          ...(result.other ? [compare.label] : []),
          ...(limited ? ['Clipped'] : []),
        ],
        rows: result.positions.map((value, n) => [
          n,
          neuroBenchNum(n * spec.dt),
          neuroBenchNum(value),
          ...(result.other ? [neuroBenchNum(result.other[n])] : []),
          ...(limited ? [n < spec.steps ? (result.clipped[n] ? 'yes' : 'no') : ''] : []),
        ]),
      };
    },
  };
}

// Fixed decoder weights with a boundary the reader slides by changing the bias.
function neuroBenchDecoder(spec) {
  const trials = spec.trials,
    [w0, w1] = spec.weights,
    names = spec.labels,
    [xName, yName] = spec.axes;
  const edge = (index, pick) => pick(...trials.map(trial => trial[index]));
  const x = [edge(0, Math.min) - 2, edge(0, Math.max) + 2],
    y = [edge(1, Math.min) - 2, edge(1, Math.max) + 2],
    hold = x[0] + 1;
  // The boundary is where the score is 0: f1 = -(w0 × f0 + bias) / w1.
  const cut = (f0, bias) => -(w0 * f0 + bias) / w1;
  const name = i => `${i} s [${trials[i][0]}, ${trials[i][1]}]`;
  return {
    title: spec.title,
    controls: () => [neuroBenchRange('bias', 'Bias', spec.bias, value => neuroBenchNum(value))],
    presets: [],
    compute: state => neuroBenchBoundary(trials, spec.weights, state.bias),
    facts: (state, result) => ({ bias: state.bias, correct: result.correct }),
    draw(state, result, geom, full) {
      const frame = neuroBenchFrame(geom, {
        x,
        y,
        xLabel: xName,
        yLabel: yName,
        xTicks: neuroBenchTicks(x[0], x[1], geom.W < 440 ? 3 : 5).map(tick => [tick, neuroBenchNum(tick)]),
        grip: true,
      });
      const px = neuroBenchPx,
        from = [frame.L, frame.y(cut(x[0], state.bias))],
        to = [frame.R, frame.y(cut(x[1], state.bias))];
      // Class 1 lies on the side where the score is above 0.
      const upper = w1 > 0 ? frame.T - 400 : frame.B + 400;
      const point = (trial, i) => {
        const cx = px(frame.x(trial[0])),
          cy = px(frame.y(trial[1])),
          bad = full && result.wrong.includes(i);
        return `${trial[2] ? `<circle class="neuro-fig-pt-b" cx="${cx}" cy="${cy}" r="5.5"/>` : `<rect class="neuro-fig-pt-a" x="${cx - 5}" y="${cy - 5}" width="10" height="10" fill="none" stroke-width="2"/>`}
          ${bad ? `<circle class="nx-live-miss" cx="${cx}" cy="${cy}" r="11" fill="none"/>` : ''}<text class="nx-live-tag is-quiet" x="${cx + 9}" y="${cy + 15}">${i} s</text>`;
      };
      const svg = `<defs><clipPath id="nx-live-box"><rect x="${frame.L}" y="${frame.T}" width="${frame.R - frame.L}" height="${frame.B - frame.T}"/></clipPath></defs>
        <g clip-path="url(#nx-live-box)"><path class="nx-live-side" d="M${px(from[0])} ${px(from[1])}L${px(to[0])} ${px(to[1])}V${upper}H${frame.L}Z"/></g>${frame.svg}
        <g clip-path="url(#nx-live-box)"><path class="nx-live-cut" d="M${px(from[0])} ${px(from[1])}L${px(to[0])} ${px(to[1])}" fill="none"/></g>
        ${trials.map(point).join('')}`;
      return {
        svg,
        grip: {
          key: 'bias',
          x: frame.x(hold),
          y: Math.min(frame.B, Math.max(frame.T, frame.y(cut(hold, state.bias)))),
          fromY: py => -(w0 * hold + w1 * frame.yInv(py)),
        },
      };
    },
    key: full =>
      `Filled circles are trials labeled ${esc(names[1])}; hollow squares are labeled ${esc(names[0])}. The tinted side of the line is where the score is above 0. Each point shows its trial time.${full ? ' Red rings: trials the rule labels wrongly.' : ''}`,
    read(state, result, full) {
      return [
        ['Scores, trials 0 s to ' + (trials.length - 1) + ' s', result.scores.map(neuroBenchNum).join(', ')],
        [`Decoded ${names[1]}`, `${result.decoded.filter(Boolean).length} of ${trials.length}`],
        ...(full
          ? [
              ['Labeled correctly', `${result.correct} of ${trials.length}`, result.wrong.length ? 'warn' : 'good'],
              ['Labeled wrongly', result.wrong.length ? result.wrong.map(name).join('; ') : 'none'],
            ]
          : []),
      ];
    },
    table: (state, result, full) => ({
      head: ['Trial', xName, yName, 'Label', 'Score', ...(full ? ['Decoded'] : [])],
      rows: trials.map((trial, i) => [
        `${i} s`,
        trial[0],
        trial[1],
        names[trial[2]],
        neuroBenchNum(result.scores[i]),
        ...(full ? [names[result.decoded[i]] + (result.wrong.includes(i) ? ' (wrong)' : '')] : []),
      ]),
    }),
  };
}

// Centered moving average with an adjustable window width and edge rule.
function neuroBenchAverage(spec, sim) {
  const series = sim.series,
    values = series.values,
    count = values.length,
    top = Math.max(...values);
  const time = i => (series.xStart || 0) + i / series.sampleRateHz;
  const list = output => `[${output.map(item => neuroBenchNum(item.value)).join(', ')}]`;
  return {
    title: spec.title || series.title,
    controls: () => [
      neuroBenchRange('width', 'Window width', spec.width, value => (value === 1 ? '1 sample' : `${value} samples`)),
      { key: 'pad', label: 'Pad both ends with zeros', toggle: true, value: spec.pad.value ? 1 : 0 },
    ],
    presets: [],
    compute: state => neuroBenchSmooth(values, state.width, !!state.pad),
    facts: (state, result) => ({ width: state.width, pad: state.pad ? 1 : 0, outputs: result.length }),
    draw(state, result, geom) {
      const frame = neuroBenchFrame(geom, {
        x: [0, count - 1],
        y: [Math.min(0, ...values), top * 1.12 || 1],
        xLabel: 'Sample index',
        yLabel: `${series.yLabel || 'Amplitude'} (${series.unit})`,
        xTicks: values.map((_, i) => [i, String(i)]),
      });
      const px = neuroBenchPx;
      const svg = `${frame.svg}${neuroBenchLine(
        frame,
        values.map((value, i) => [i, value]),
        'neuro-fig-line nx-live-faint'
      )}
        ${values.map((value, i) => `<circle class="neuro-fig-dot nx-live-faint" cx="${px(frame.x(i))}" cy="${px(frame.y(value))}" r="3"/>`).join('')}
        ${neuroBenchLine(
          frame,
          result.map(item => [item.index, item.value]),
          'nx-live-out'
        )}
        ${result.map(item => `<rect class="nx-live-out-dot" x="${px(frame.x(item.index) - 4.5)}" y="${px(frame.y(item.value) - 4.5)}" width="9" height="9"/>`).join('')}`;
      return { svg, grip: null };
    },
    key: () =>
      'Faint line with dots: the input. Amber line with squares: the moving average, drawn at each window’s center sample.',
    read(state, result) {
      const peak = result.length ? Math.max(...result.map(item => item.value)) : 0;
      return [
        ['Output', result.length ? list(result) : 'no full window fits'],
        ['Output samples', `${result.length} of ${count}`],
        ['Highest value', `${neuroBenchNum(top)} in, ${neuroBenchNum(peak)} out`],
      ];
    },
    table: (state, result) => ({
      head: ['Index', 'Time (s)', `Input (${series.unit})`, 'Moving average'],
      rows: values.map((value, i) => {
        const out = result.find(item => item.index === i);
        return [i, neuroBenchNum(time(i)), value, out ? neuroBenchNum(out.value) : '—'];
      }),
    }),
  };
}

/* ---------- Steering by hand ---------- */

// What a controller sees when its view of the cursor is `delay` seconds old. `trail` lists
// [time, position] pairs, oldest first.
function neuroBenchSeen(trail, now, delay) {
  const at = now - delay;
  let i = trail.length - 1;
  while (i > 0 && trail[i][0] > at) i--;
  const from = trail[i],
    to = trail[i + 1];
  if (!to || at <= from[0]) return from[1];
  return from[1] + ((to[1] - from[1]) * (at - from[0])) / (to[0] - from[0] || 1);
}
const neuroBenchHandSpan = spec => [Math.min(0, spec.target) - 0.25, Math.max(0, spec.target) + 0.75];
function neuroBenchHandMarkup(spec) {
  const [low, high] = neuroBenchHandSpan(spec),
    at = value => neuroBenchPx(((value - low) / (high - low)) * 100);
  return `<div class="nx-live-hand" data-bench-hand>
    <p class="nx-live-sub">Your turn</p>
    <p class="nx-live-hand-note">You are the loop now. Hold a button, or an arrow key, to move the dot. Let go inside the target. <span data-hand-lag></span></p>
    <div class="nx-live-track"><i class="nx-live-zone" style="left:${at(spec.target - spec.hand.zone)}%;width:${at(low + 2 * spec.hand.zone)}%"></i><i class="nx-live-start" style="left:${at(0)}%"></i><i class="nx-live-dot" data-hand-dot style="left:${at(0)}%"></i></div>
    <div class="nx-live-scale" aria-hidden="true"><span style="left:${at(0)}%">0</span><span style="left:${at(spec.target)}%">target</span></div>
    <div class="nx-live-tools"><button type="button" class="nx-live-chip" data-hand-move="-1" aria-keyshortcuts="ArrowLeft">&larr; Hold left</button><button type="button" class="nx-live-chip" data-hand-move="1" aria-keyshortcuts="ArrowRight">Hold right &rarr;</button><button type="button" class="nx-live-chip is-reset" data-hand-reset>Start over</button></div>
    <p class="nx-live-hand-say" role="status" data-hand-say>The dot is at 0.</p>
  </div>`;
}
// The reader holds a button and the cursor moves at a fixed speed. The dot shows where the cursor
// was `delay` seconds ago, which is all a delayed loop ever sees.
function neuroBenchHandMount(host, spec, state) {
  const panel = host.querySelector('[data-bench-hand]');
  if (!panel || typeof requestAnimationFrame !== 'function') return null;
  const [low, high] = neuroBenchHandSpan(spec),
    { speed, zone } = spec.hand,
    dot = panel.querySelector('[data-hand-dot]'),
    say = panel.querySelector('[data-hand-say]');
  const delay = () => state.delay * spec.dt;
  let position = 0,
    direction = 0,
    clock = 0,
    last = null,
    frame = 0,
    moves = 0,
    trail = [[0, 0]];
  const place = seen => (dot.style.left = `${neuroBenchPx(((seen - low) / (high - low)) * 100)}%`);
  const report = () => {
    const off = position - spec.target,
      inside = Math.abs(off) <= zone + 1e-9,
      round = value => neuroBenchNum(Math.round(value * 100) / 100);
    panel.classList.toggle('is-in', !!moves && inside);
    say.textContent = moves
      ? `Stopped at ${round(position)}: ${inside ? 'inside the target' : `${round(Math.abs(off))} ${off > 0 ? 'past' : 'short of'} the target`}. Moves so far: ${moves}.`
      : 'The dot is at 0.';
  };
  const tick = now => {
    frame = 0;
    if (!panel.isConnected) return;
    // A long gap means the page was in the background, where a released key is never reported.
    if (last != null && now - last > 500) direction = 0;
    const elapsed = last == null ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    clock += elapsed;
    if (direction) position = Math.min(high, Math.max(low, position + direction * speed * elapsed));
    trail.push([clock, position]);
    while (trail.length > 2 && trail[1][0] < clock - delay() - 0.1) trail.shift();
    const seen = neuroBenchSeen(trail, clock, delay());
    place(seen);
    if (direction || Math.abs(seen - position) > 1e-4) frame = requestAnimationFrame(tick);
    else {
      last = null;
      report();
    }
  };
  const steer = next => {
    if (next === direction) return;
    if (next && !direction) {
      moves++;
      panel.classList.remove('is-in');
      say.textContent = 'Moving. Let go to stop.';
    }
    direction = next;
    if (!frame) frame = requestAnimationFrame(tick);
  };
  panel.querySelectorAll('[data-hand-move]').forEach(button => {
    const way = Number(button.dataset.handMove),
      stop = () => direction === way && steer(0),
      press = event => event.key === ' ' || event.key === 'Enter';
    button.addEventListener('pointerdown', event => {
      button.setPointerCapture?.(event.pointerId);
      steer(way);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur'])
      button.addEventListener(type, stop);
    button.addEventListener('keydown', event => {
      if (!press(event)) return;
      event.preventDefault();
      if (!event.repeat) steer(way);
    });
    button.addEventListener('keyup', event => press(event) && stop());
    button.addEventListener('contextmenu', event => event.preventDefault());
  });
  const arrow = event => (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0);
  panel.addEventListener('keydown', event => {
    const way = arrow(event);
    if (!way) return;
    event.preventDefault();
    if (!event.repeat) steer(way);
  });
  panel.addEventListener('keyup', event => arrow(event) === direction && steer(0));
  panel.querySelector('[data-hand-reset]').addEventListener('click', () => {
    direction = 0;
    position = 0;
    moves = 0;
    trail = [[clock, 0]];
    place(0);
    report();
  });
  const lag = panel.querySelector('[data-hand-lag]');
  return {
    sync() {
      lag.textContent = delay() ? `Your view of it is ${neuroBenchNum(delay())} s old.` : 'Your view of it is live.';
    },
  };
}

const NEURO_BENCH_KINDS = {
  detector: neuroBenchDetector,
  margin: neuroBenchMargin,
  cursor: neuroBenchCursor,
  decoder: neuroBenchDecoder,
  average: neuroBenchAverage,
};

/* ---------- Validation ---------- */

function neuroBenchValid(spec, sim) {
  const finite = Number.isFinite,
    whole = Number.isInteger,
    text = value => typeof value === 'string' && !!value.trim();
  const control = c =>
    !!c &&
    [c.value, c.min, c.max, c.step].every(finite) &&
    c.step > 0 &&
    c.min < c.max &&
    c.value >= c.min &&
    c.value <= c.max;
  const sampled = () => {
    const series = sim?.series;
    return (
      !!series &&
      Array.isArray(series.values) &&
      series.values.length > 1 &&
      series.values.length <= 64 &&
      series.values.every(finite) &&
      finite(series.sampleRateHz) &&
      series.sampleRateHz > 0 &&
      text(series.title) &&
      typeof series.unit === 'string'
    );
  };
  const span = item =>
    !!item && whole(item.start) && whole(item.end) && item.start >= 0 && item.end >= item.start && text(item.label);
  if (!spec || typeof spec !== 'object' || !NEURO_BENCH_KINDS[spec.kind] || !['open', 'after'].includes(spec.gate))
    return false;
  if (!text(spec.task) || (spec.gate === 'open' && !text(spec.explore))) return false;
  if (
    spec.goal != null &&
    !(
      text(spec.done) &&
      Array.isArray(spec.goal) &&
      spec.goal.length > 0 &&
      spec.goal.every(
        rule =>
          Array.isArray(rule) && rule.length === 3 && text(rule[0]) && ['=', '>', '<', '>=', '<='].includes(rule[1])
      )
    )
  )
    return false;
  if (spec.kind === 'detector') {
    const count = sim?.series?.values?.length || 0;
    const views = {
      count: () => true,
      event: () => span(spec.event),
      confirm: () => span(spec.event) && !!spec.confirm,
    };
    return (
      sampled() &&
      control(spec.threshold) &&
      !!views[spec.view]?.() &&
      (spec.event == null || (span(spec.event) && spec.event.end < count)) &&
      (spec.confirm == null ||
        (whole(spec.confirm.value) &&
          whole(spec.confirm.max) &&
          spec.confirm.value >= 1 &&
          spec.confirm.max > 1 &&
          spec.confirm.value <= spec.confirm.max)) &&
      (spec.artifact == null ||
        (whole(spec.artifact.index) &&
          spec.artifact.index >= 0 &&
          spec.artifact.index < count &&
          text(spec.artifact.label) &&
          (spec.artifact.tag == null || text(spec.artifact.tag)))) &&
      (spec.presets || []).every(
        preset =>
          text(preset.label) &&
          finite(preset.threshold) &&
          neuroBenchSnap(preset.threshold, spec.threshold) === preset.threshold &&
          whole(preset.confirm) &&
          preset.confirm >= 1 &&
          preset.confirm <= (spec.confirm?.max || 1)
      ) &&
      (spec.costs == null ||
        (whole(spec.costs.falseAction) &&
          whole(spec.costs.missedEvent) &&
          spec.costs.falseAction >= 1 &&
          spec.costs.falseAction <= 10 &&
          spec.costs.missedEvent >= 1 &&
          spec.costs.missedEvent <= 40 &&
          Array.isArray(spec.costs.settings) &&
          spec.costs.settings.length > 1 &&
          spec.costs.settings.every(item => text(item.label) && whole(item.falseActions) && whole(item.missed))))
    );
  }
  if (spec.kind === 'margin')
    return (
      sampled() &&
      finite(spec.threshold) &&
      control(spec.margin) &&
      spec.margin.min >= 0 &&
      Array.isArray(spec.labels) &&
      spec.labels.length === 2 &&
      spec.labels.every(text)
    );
  if (spec.kind === 'cursor') {
    const setting = c => !!c && finite(c.value) && (c.min == null || control(c));
    return (
      text(spec.title) &&
      [spec.target, spec.dt].every(finite) &&
      spec.dt > 0 &&
      whole(spec.steps) &&
      spec.steps >= 4 &&
      spec.steps <= 60 &&
      ['gain', 'limit', 'delay'].every(key => setting(spec[key])) &&
      ['gain', 'limit', 'delay'].some(key => spec[key].min != null) &&
      whole(spec.delay.value) &&
      (spec.delay.min == null || (whole(spec.delay.min) && whole(spec.delay.step))) &&
      spec.limit.value > 0 &&
      Array.isArray(spec.readouts) &&
      spec.readouts.length > 0 &&
      spec.readouts.every(key => ['firstStep', 'peak', 'overshoot', 'settle', 'clipped'].includes(key)) &&
      (spec.mask == null || Array.isArray(spec.mask)) &&
      (spec.compare == null ||
        (text(spec.compare.label) && !!spec.compare.set && typeof spec.compare.set === 'object')) &&
      (spec.hand == null ||
        (spec.delay.min != null && [spec.hand.speed, spec.hand.zone].every(value => finite(value) && value > 0)))
    );
  }
  if (spec.kind === 'decoder')
    return (
      text(spec.title) &&
      control(spec.bias) &&
      Array.isArray(spec.weights) &&
      spec.weights.length === 2 &&
      spec.weights.every(finite) &&
      spec.weights[1] !== 0 &&
      [spec.labels, spec.axes].every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(text)) &&
      Array.isArray(spec.trials) &&
      spec.trials.length > 1 &&
      spec.trials.length <= 24 &&
      spec.trials.every(
        trial => Array.isArray(trial) && finite(trial[0]) && finite(trial[1]) && (trial[2] === 0 || trial[2] === 1)
      )
    );
  return (
    sampled() &&
    control(spec.width) &&
    whole(spec.width.min) &&
    spec.width.min % 2 === 1 &&
    spec.width.step === 2 &&
    spec.width.max <= sim.series.values.length &&
    !!spec.pad &&
    typeof spec.pad.value === 'boolean'
  );
}

/* ---------- Screen ---------- */

function neuroBenchTool(sim, spec) {
  if (!neuroBenchValid(spec, sim)) return null;
  const tool = NEURO_BENCH_KINDS[spec.kind](spec, sim);
  tool.spec = spec;
  return tool;
}
function neuroBenchState(sim, tool, full) {
  const state = (NEURO_BENCH_STATE[sim.id] ||= {});
  for (const control of tool.controls(full)) if (!(control.key in state)) state[control.key] = control.value;
  for (const [key, value] of Object.entries(tool.start || {})) if (!(key in state)) state[key] = value;
  return state;
}
const neuroBenchGeom = width => {
  const W = Math.min(760, Math.max(240, Math.round(width)));
  return { W, H: W < 440 ? 236 : 276 };
};
function neuroBenchMet(facts, goal) {
  return goal.every(([key, op, want]) => {
    const have = facts[key];
    if (op === '=') return have === want;
    if (op === '>') return have > want;
    if (op === '<') return have < want;
    return op === '>=' ? have >= want : have <= want;
  });
}
// Everything on the instrument that depends on the current settings.
function neuroBenchView(tool, state, geom, full) {
  const spec = tool.spec,
    result = tool.compute(state),
    controls = tool.controls(full),
    drawn = tool.draw(state, result, geom, full),
    read = tool.read(state, result, full),
    table = tool.table(state, result, full);
  if (full && spec.goal && neuroBenchMet(tool.facts(state, result), spec.goal)) state.done = true;
  const done = full && !!spec.goal && !!state.done;
  return {
    grip: drawn.grip,
    svg: `<svg viewBox="0 0 ${geom.W} ${geom.H}" role="img" aria-label="${esc(tool.title)}: adjustable plot. The numbers under it and the exact values table describe the current setting.">${drawn.svg}</svg>`,
    read: read
      .map(
        ([label, value, tone]) =>
          `<div${tone ? ` class="is-${tone}"` : ''}><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`
      )
      .join(''),
    extra: tool.extra ? tool.extra(state, result, full) : '',
    task: full
      ? `<b>${done ? 'Done' : 'Try this'}</b><span>${esc(spec.task)}</span>`
      : `<b>Explore</b><span>${esc(spec.explore)}</span>`,
    done,
    won: done ? esc(spec.done) : '',
    table: `<table><thead><tr>${table.head.map(cell => `<th scope="col">${esc(cell)}</th>`).join('')}</tr></thead><tbody>${table.rows
      .map(
        row =>
          `<tr><th scope="row">${esc(row[0])}</th>${row
            .slice(1)
            .map(cell => `<td>${esc(cell)}</td>`)
            .join('')}</tr>`
      )
      .join('')}</tbody></table>`,
    say: `${controls
      .filter(control => !control.toggle)
      .map(control => `${control.label} ${control.text(state[control.key])}`)
      .join(', ')}. ${read.map(([label, value]) => `${label}: ${value}`).join('. ')}.`,
    atStart: controls.every(control => state[control.key] === control.value),
  };
}
const neuroBenchGripStyle = (grip, geom) =>
  `left:${neuroBenchPx((grip.x / geom.W) * 100)}%;top:${neuroBenchPx((grip.y / geom.H) * 100)}%`;
const neuroBenchFill = (control, value) =>
  `--nx-fill:${neuroBenchPx(((value - control.min) / (control.max - control.min)) * 100)}%`;

function neuroBenchMarkup(sim, spec, full) {
  const tool = neuroBenchTool(sim, spec);
  if (!tool) return '';
  const state = neuroBenchState(sim, tool, full),
    geom = neuroBenchGeom(560),
    view = neuroBenchView(tool, state, geom, full),
    controls = tool.controls(full),
    later = controls.filter(item => item.zone);
  const control = item =>
    item.toggle
      ? `<label class="nx-live-check"><input type="checkbox" data-bench-control="${item.key}" ${state[item.key] ? 'checked' : ''}><span>${esc(item.label)}</span></label>`
      : `<div class="nx-live-ctl"><label for="nx-live-${item.key}">${esc(item.label)}</label><span class="nx-live-val" data-bench-out="${item.key}">${esc(item.text(state[item.key]))}</span>
        <input type="range" id="nx-live-${item.key}" data-bench-control="${item.key}" min="${item.min}" max="${item.max}" step="${item.step}" value="${state[item.key]}" aria-valuetext="${esc(item.text(state[item.key]))}" style="${neuroBenchFill(item, state[item.key])}"></div>`;
  return `<figure class="neuro-series nx-live" data-bench="${esc(sim.id)}" data-bench-mode="${full ? 'full' : 'explore'}">
    <figcaption><b>${esc(tool.title)}</b> <span>&middot; adjustable &middot; synthetic data</span></figcaption>
    <p class="nx-live-task${view.done ? ' is-done' : ''}" data-bench-task>${view.task}</p>
    <div class="nx-live-stage"><div class="nx-live-plot" data-bench-plot>${view.svg}${view.grip ? `<span class="nx-live-grip" data-bench-grip aria-hidden="true" style="${neuroBenchGripStyle(view.grip, geom)}"><i></i></span>` : ''}</div></div>
    <p class="nx-live-key">${tool.key(full)}</p>
    <div class="nx-live-controls">${controls
      .filter(item => !item.zone)
      .map(control)
      .join('')}
      <div class="nx-live-tools">${tool.presets.map((preset, i) => `<button type="button" class="nx-live-chip" data-bench-preset="${i}">${esc(preset.label)}</button>`).join('')}<button type="button" class="nx-live-chip is-reset" data-bench-reset ${view.atStart ? 'disabled' : ''}>Back to the scenario&rsquo;s setting</button></div></div>
    <dl class="nx-live-read" data-bench-read>${view.read}</dl>
    ${later.length ? `<div class="nx-live-controls is-later"><p class="nx-live-sub">${esc(later[0].zone)}</p>${later.map(control).join('')}</div>` : ''}
    <div data-bench-extra>${view.extra}</div>${tool.hand ? neuroBenchHandMarkup(spec) : ''}
    <p class="nx-live-won" data-bench-won ${view.won ? '' : 'hidden'}>${view.won}</p>
    <p class="nx-sr" role="status" data-bench-say></p>
    <details class="nx-live-values"><summary>Exact values</summary><div style="overflow-x:auto" data-bench-table>${view.table}</div></details>
  </figure>`;
}

function neuroBenchMount(root, sim, spec, full) {
  const host = root?.querySelector?.('[data-bench]'),
    tool = host && neuroBenchTool(sim, spec);
  if (!tool) return;
  const state = neuroBenchState(sim, tool, full),
    controls = tool.controls(full),
    find = selector => host.querySelector(selector),
    plot = find('[data-bench-plot]'),
    gripEl = find('[data-bench-grip]'),
    reset = find('[data-bench-reset]');
  const hand = tool.hand ? neuroBenchHandMount(host, spec, state) : null;
  let geom = neuroBenchGeom(560),
    grip = null,
    timer = 0,
    news = '';
  const paint = announce => {
    const view = neuroBenchView(tool, state, geom, full);
    grip = view.grip;
    plot.querySelector('svg')?.remove();
    plot.insertAdjacentHTML('afterbegin', view.svg);
    if (gripEl && grip) gripEl.setAttribute('style', neuroBenchGripStyle(grip, geom));
    for (const control of controls) {
      const input = find(`[data-bench-control="${control.key}"]`);
      if (control.toggle) {
        input.checked = !!state[control.key];
        continue;
      }
      const text = control.text(state[control.key]);
      if (Number(input.value) !== state[control.key]) input.value = state[control.key];
      input.setAttribute('aria-valuetext', text);
      input.setAttribute('style', neuroBenchFill(control, state[control.key]));
      find(`[data-bench-out="${control.key}"]`).textContent = text;
    }
    host.querySelectorAll('[data-bench-preset]').forEach((button, i) => {
      const set = tool.presets[i].set;
      button.setAttribute('aria-pressed', String(Object.keys(set).every(key => state[key] === set[key])));
    });
    find('[data-bench-read]').innerHTML = view.read;
    find('[data-bench-extra]').innerHTML = view.extra;
    find('[data-bench-table]').innerHTML = view.table;
    const task = find('[data-bench-task]');
    if (view.done && !task.classList.contains('is-done')) news = ` Task done. ${spec.done}`;
    task.innerHTML = view.task;
    task.classList.toggle('is-done', view.done);
    const won = find('[data-bench-won]');
    won.hidden = !view.won;
    won.innerHTML = view.won;
    reset.disabled = view.atStart;
    hand?.sync();
    if (!announce) return;
    clearTimeout(timer);
    // One sentence for screen readers once the reader pauses, with the task result when it is new.
    timer = setTimeout(() => {
      find('[data-bench-say]').textContent = view.say + news;
      news = '';
    }, 600);
  };
  const set = (key, value) => {
    const control = controls.find(item => item.key === key);
    const next = control.toggle ? (value ? 1 : 0) : neuroBenchSnap(Number(value), control);
    if (!Number.isFinite(next) || next === state[key]) return;
    state[key] = next;
    paint(true);
  };
  for (const control of controls)
    find(`[data-bench-control="${control.key}"]`).addEventListener('input', event =>
      set(control.key, control.toggle ? event.target.checked : event.target.value)
    );
  host.querySelectorAll('[data-bench-preset]').forEach((button, i) =>
    button.addEventListener('click', () => {
      Object.assign(state, tool.presets[i].set);
      paint(true);
    })
  );
  reset.addEventListener('click', () => {
    for (const control of controls) state[control.key] = control.value;
    paint(true);
    find('[data-bench-control]').focus({ preventScroll: true });
  });
  if (gripEl) {
    // The grip is a shortcut for pointers. The slider under the plot is the control with a name,
    // a keyboard and a value for screen readers.
    let offset = null;
    const drag = event => {
      if (offset == null || !grip) return;
      const box = plot.getBoundingClientRect();
      if (!box.height) return;
      set(grip.key, grip.fromY(((event.clientY - offset - box.top) / box.height) * geom.H));
    };
    const release = () => {
      offset = null;
      gripEl.classList.remove('is-held');
    };
    gripEl.addEventListener('pointerdown', event => {
      if (!grip) return;
      const box = plot.getBoundingClientRect();
      offset = event.clientY - (box.top + (grip.y / geom.H) * box.height);
      gripEl.classList.add('is-held');
      gripEl.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    gripEl.addEventListener('pointermove', drag);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) gripEl.addEventListener(type, release);
  }
  // Redraw at the plot's real width so labels and strokes keep their size on every screen.
  if (typeof ResizeObserver === 'function') {
    let shown = false;
    const watch = new ResizeObserver(() => {
      // Mounting happens before the lab is on the page, so only a plot that was shown and then
      // removed is finished with.
      if (!plot.isConnected) return shown ? watch.disconnect() : undefined;
      shown = true;
      const width = Math.round(plot.clientWidth);
      if (!width || neuroBenchGeom(width).W === geom.W) return;
      geom = neuroBenchGeom(width);
      paint(false);
    });
    watch.observe(plot);
  }
  paint(false);
}
