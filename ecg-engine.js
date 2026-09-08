/* Original schematic ECGs in seconds and millivolts. No patient recordings. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ECGTrace = api;
})(typeof window === 'undefined' ? globalThis : window, () => {
  'use strict';
  const DURATION = 6,
    SAMPLE_RATE = 250;
  const kinds = [
    'sinus',
    'brady',
    'tachy',
    'afib',
    'flutter',
    'svt',
    'junctional',
    'avb1',
    'mobitz1',
    'mobitz2',
    'chb',
    'pvc',
    'vt',
    'torsades',
    'vfib',
    'asystole',
    'stemi',
    'hyperk',
    'wpw',
    'paced',
  ];
  const round = n => Math.round(n * 10000) / 10000;
  const escape = value =>
    String(value).replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  function interpolate(t, vertices) {
    if (t < vertices[0][0] || t > vertices.at(-1)[0]) return 0;
    for (let i = 1; i < vertices.length; i++) {
      const [end, y] = vertices[i],
        [start, previous] = vertices[i - 1];
      if (t <= end) return previous + ((y - previous) * (t - start)) / (end - start);
    }
    return 0;
  }
  function hump(t, start, width, amplitude) {
    return t < start || t > start + width ? 0 : amplitude * Math.sin((Math.PI * (t - start)) / width) ** 2;
  }
  function create(kind) {
    if (!kinds.includes(kind)) throw Error('Unknown ECG example');
    const p = [],
      beats = [],
      duration = DURATION;
    const atria = (rr, first = 0.14) => {
      for (let t = first; t < duration; t += rr) p.push(round(t));
    };
    const beat = (start, options = {}) => {
      const b = { start: round(start), width: 0.08, amplitude: 1, tAmp: 0.26, tWidth: 0.24, ...options };
      b.end = round(start + b.width);
      b.peak = round(start + b.width * (b.delta ? 0.64 : 0.4));
      beats.push(b);
    };
    const sinus = (rr, pr = 0.16, options = {}) => {
      atria(rr, pr > 0.2 ? 0.04 : 0.14);
      p.forEach(start => beat(start + pr, { p: start, ...options }));
    };
    let description = '',
      context = 'Illustrative adult pattern. Symptoms, pulse, prior tracings and the other leads are not supplied.';
    switch (kind) {
      case 'sinus':
        sinus(0.8);
        description = 'Regular P waves, each followed after 160 ms by an 80 ms QRS. R–R interval 0.80 s.';
        break;
      case 'brady':
        sinus(1.25, 0.16, { tWidth: 0.28 });
        description = 'One P before each narrow QRS; constant PR. R–R interval 1.25 s.';
        break;
      case 'tachy':
        sinus(0.48, 0.16, { tWidth: 0.12 });
        description =
          'Regular P waves followed by narrow QRS complexes; R–R interval 0.48 s. Repolarization approaches the next P wave.';
        break;
      case 'afib': {
        const intervals = [0.65, 0.85, 0.48, 1.02, 0.72, 0.58, 0.93, 0.64];
        for (let t = 0.3, i = 0; t < duration; t += intervals[i++ % intervals.length]) beat(t);
        description =
          'Unequal R–R intervals, narrow QRS complexes and a fine fluctuating baseline. No distinct repeating P waves are modeled.';
        break;
      }
      case 'flutter':
        for (let t = 0.3; t < duration; t += 0.4) beat(t, { tAmp: 0.1, tWidth: 0.12 });
        description =
          'Continuous sawtooth atrial activity repeats every 0.20 s; narrow QRS complexes repeat every 0.40 s. The atrial wave can overlap a QRS or T wave.';
        break;
      case 'svt':
        for (let t = 0.3; t < duration; t += 1 / 3) beat(t, { tAmp: 0.15, tWidth: 0.1 });
        description =
          'Regular narrow QRS complexes, about 0.333 s apart. Separate preceding P waves are not identifiable in this model.';
        break;
      case 'junctional':
        for (let t = 0.3; t < duration; t += 1.2) beat(t, { tWidth: 0.28 });
        description = 'Regular narrow QRS complexes 1.20 s apart without an identifiable preceding P wave.';
        break;
      case 'avb1':
        sinus(60 / 70, 0.26);
        description = 'Each P is followed by a narrow QRS, with a constant 260 ms PR interval.';
        break;
      case 'mobitz1':
        atria(0.8);
        p.forEach((start, i) => {
          const pr = [0.16, 0.2, 0.24, null][i % 4];
          if (pr !== null) beat(start + pr, { p: start });
        });
        description =
          'P waves remain 0.80 s apart. Successive PR intervals are 160, 200 and 240 ms, followed by a P without a QRS. The sequence then repeats.';
        break;
      case 'mobitz2':
        atria(0.8);
        p.forEach((start, i) => {
          if (i % 3 !== 2) beat(start + 0.16, { p: start, width: 0.14, tWidth: 0.18 });
        });
        description =
          'P waves remain 0.80 s apart. Conducted PR intervals stay at 160 ms; every third P lacks a QRS. The modeled QRS duration is 140 ms.';
        break;
      case 'chb':
        atria(0.8);
        for (let t = 0.4; t < duration; t += 1.45) beat(t, { width: 0.14 });
        description =
          'Atrial events repeat every 0.80 s. Wide 140 ms QRS complexes repeat independently every 1.45 s, at 0.40, 1.85, 3.30 and 4.75 s. The gap from the nearest preceding P shortens from 260 ms to 110 ms, then the P waves at 3.34 s and 4.94 s fall inside a QRS and a T wave respectively.';
        break;
      case 'pvc':
        atria(0.8);
        [0.3, 1.1, 1.9, 2.42, 3.5, 4.3, 5.1, 5.9].forEach((start, i) =>
          beat(start, i === 3 ? { width: 0.16, amplitude: -1, tAmp: 0.35 } : { p: round(start - 0.16) })
        );
        description =
          'Narrow complexes are interrupted by an early, oppositely directed 160 ms complex at 2.42 s without a preceding conducted P. The adjacent QRS-onset intervals are 0.52 s and 1.08 s. Modeled sinus P waves continue independently.';
        break;
      case 'vt':
        for (let t = 0.2; t < duration; t += 0.36) beat(t, { width: 0.16, tAmp: -0.2, tWidth: 0.12 });
        description =
          'Regular, similarly shaped 160 ms QRS complexes repeat every 0.36 s. No independent atrial activity is resolved in this schematic.';
        break;
      case 'torsades':
        for (let t = 0.2; t < duration; t += 0.27) {
          const c = Math.cos((t * Math.PI) / 2);
          beat(t, { width: 0.18, amplitude: (c < 0 ? -1 : 1) * (0.45 + 0.9 * Math.abs(c)), tAmp: 0 });
        }
        description =
          'Fast broad complexes change amplitude and polarity across the strip. There is no measurable intervening QT interval during the run.';
        context =
          'For this teaching example only, a preceding ECG is stated to have a prolonged QT interval. That preceding ECG is not shown.';
        break;
      case 'vfib':
        description =
          'Continuously changing irregular deflections without organized P waves, QRS complexes or a countable ventricular rate.';
        break;
      case 'asystole':
        description =
          'An almost flat modeled signal without identifiable P waves or QRS complexes. Equipment connection and a pulse cannot be assessed from this image.';
        break;
      case 'stemi':
        sinus(60 / 70, 0.16, { st: 0.2 });
        description =
          'Regular narrow complexes with a modeled ST level about 0.20 mV above the reference baseline. Only one schematic projection is supplied.';
        break;
      case 'hyperk':
        sinus(60 / 70, 0.16, { tAmp: 0.58, tWidth: 0.2 });
        description =
          'Pointed, relatively tall T waves follow narrow QRS complexes. This example does not show progressive changes or supply a potassium result.';
        break;
      case 'wpw':
        sinus(0.8, 0.1, { width: 0.14, delta: true, tAmp: -0.15, tWidth: 0.18 });
        description =
          'PR is 100 ms. The 140 ms QRS starts with a gradual positive slur for 40 ms before its steeper upstroke.';
        break;
      case 'paced':
        for (let t = 0.3; t < duration; t += 1) beat(t, { width: 0.16, paced: true, tAmp: -0.2 });
        description =
          'A brief modeled pacing spike occurs 20 ms before each 160 ms QRS; ventricular complexes repeat every 1.00 s. Mechanical contraction is not measured.';
        break;
    }
    function value(t) {
      if (kind === 'vfib')
        return (
          0.42 * Math.sin(t * 2 * Math.PI * 4.7 + 0.8 * Math.sin(t * 2.1)) +
          0.24 * Math.sin(t * 2 * Math.PI * 7.3) +
          0.13 * Math.sin(t * 2 * Math.PI * 11.1)
        );
      if (kind === 'asystole') return 0.004 * Math.sin(t * 43);
      let y = p.reduce((sum, start) => sum + hump(t, start, 0.08, 0.13), 0);
      if (kind === 'afib') y += 0.018 * Math.sin(t * 47) + 0.012 * Math.sin(t * 73);
      if (kind === 'flutter') {
        const phase = (t % 0.2) / 0.2;
        y += phase < 0.85 ? 0.14 - (0.28 * phase) / 0.85 : -0.14 + (0.28 * (phase - 0.85)) / 0.15;
      }
      for (const b of beats) {
        const x = round(t - b.start),
          w = b.width,
          a = b.amplitude;
        const vertices = b.delta
          ? [
              [0, 0],
              [0.04, 0.22],
              [w * 0.64, a],
              [w * 0.85, -0.22],
              [w, 0],
            ]
          : [
              [0, 0],
              [w * 0.2, -0.12 * a],
              [w * 0.4, a],
              [w * 0.72, -0.3 * a],
              [w, b.st || 0],
            ];
        y += interpolate(x, vertices);
        const tStart = b.end + 0.06;
        y += hump(t, tStart, b.tWidth, b.tAmp);
        if (b.st && t > b.end && t <= tStart + b.tWidth) y += b.st * (t <= tStart ? 1 : 1 - (t - tStart) / b.tWidth);
        if (b.paced)
          y += interpolate(t - (b.start - 0.02), [
            [0, 0],
            [0.004, 1.3],
            [0.008, 0],
          ]);
      }
      return y;
    }
    return {
      version: 1,
      duration,
      sampleRate: SAMPLE_RATE,
      description,
      context,
      values: Array.from({ length: duration * SAMPLE_RATE + 1 }, (_, i) => round(value(i / SAMPLE_RATE))),
      atrial: p,
      qrs: beats
        .filter(b => b.start < duration)
        .map(b => ({ start: b.start, end: b.end, peak: b.peak, p: b.p ?? null })),
    };
  }
  function valid(trace) {
    const number = v => Number.isFinite(v) && v >= 0 && v <= DURATION + 0.5;
    return (
      !!trace &&
      trace.version === 1 &&
      trace.duration === DURATION &&
      trace.sampleRate === SAMPLE_RATE &&
      typeof trace.description === 'string' &&
      typeof trace.context === 'string' &&
      Array.isArray(trace.values) &&
      trace.values.length === DURATION * SAMPLE_RATE + 1 &&
      trace.values.every(v => Number.isFinite(v) && Math.abs(v) <= 2) &&
      Array.isArray(trace.atrial) &&
      trace.atrial.every(number) &&
      Array.isArray(trace.qrs) &&
      trace.qrs.every(
        b =>
          b &&
          number(b.start) &&
          number(b.end) &&
          number(b.peak) &&
          b.start < b.peak &&
          b.peak < b.end &&
          (b.p === null || (number(b.p) && b.p < b.start))
      )
    );
  }
  let sequence = 0;
  function markup(trace) {
    if (!valid(trace)) throw Error('Saved ECG trace is invalid');
    const id = 'ecg-grid-' + ++sequence,
      left = 60,
      top = 70,
      width = 750,
      height = 200;
    const x = t => left + t * 125,
      y = mv => top + height / 2 - mv * 50;
    const path = trace.values
      .map((v, i) => `${i ? 'L' : 'M'}${x(i / SAMPLE_RATE).toFixed(2)},${y(v).toFixed(2)}`)
      .join(' ');
    return `<figure class="ecg-figure"><div class="ekgstrip" tabindex="0" role="region" aria-label="Six-second ECG plot. Scroll horizontally to inspect the full trace.">
      <svg class="ekgsvg" role="img" aria-label="Synthetic ECG: time in seconds, voltage in millivolts" aria-describedby="${id}-description" viewBox="0 0 840 317" preserveAspectRatio="xMinYMin meet" xmlns="http://www.w3.org/2000/svg">
      <desc id="${id}-description">${escape(trace.description)}</desc><defs>
      <pattern id="${id}-small" x="${left}" y="${top}" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="#eedddd" stroke-width=".5"/></pattern>
      <pattern id="${id}" x="${left}" y="${top}" width="25" height="25" patternUnits="userSpaceOnUse"><rect width="25" height="25" fill="url(#${id}-small)"/><path d="M25 0H0V25" fill="none" stroke="#d5a7a7" stroke-width=".8"/></pattern></defs>
      <rect x="${left}" y="${top}" width="${width}" height="${height}" fill="url(#${id})" stroke="#9b8585"/>
      <g fill="#292929" font-size="12" font-family="sans-serif"><text x="${left}" y="17">Voltage (mV)</text>
      ${[-2, -1, 0, 1, 2].map(v => `<text x="50" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
      ${[0, 1, 2, 3, 4, 5, 6].map(t => `<text x="${x(t)}" y="289" text-anchor="middle">${t}</text>`).join('')}
      <text x="435" y="309" text-anchor="middle">Time (s)</text><text x="650" y="25">1 mV / 0.2 s</text></g>
      <path d="M760 60H765V10H790V60H795" fill="none" stroke="#59636a" stroke-width="1.3"/>
      <path d="${path}" fill="none" stroke="#17242b" stroke-width="1.5" stroke-linejoin="round"/></svg></div>
      <figcaption>Original synthetic trace, 6 seconds. Small square: 0.04 s × 0.1 mV; large square: 0.20 s × 0.5 mV. Conventional 25 mm/s and 10 mm/mV proportions; physical screen millimeters vary. The calibration pulse is separate from the signal.</figcaption></figure>
      <p class="course-caption">${escape(trace.context)}</p><details class="ecg-measurements"><summary>Text description and measurements</summary><p>${escape(trace.description)}</p>
      <p>P-wave onsets (s): ${trace.atrial.length ? trace.atrial.map(n => n.toFixed(2)).join(', ') : 'No separate P-wave onsets identified in this model.'}</p>
      ${
        trace.qrs.length
          ? `<div class="academy-comparison" tabindex="0" role="region" aria-label="Modeled ECG event measurements"><table><caption>Modeled event times. These are authored values, not automated clinical measurements.</caption>
      <thead><tr><th scope="col">QRS onset (s)</th><th scope="col">QRS duration (ms)</th><th scope="col">Conducted PR (ms)</th><th scope="col">R–R interval, QRS onset to onset (s)</th></tr></thead><tbody>
      ${trace.qrs.map((b, i) => `<tr><th scope="row">${b.start.toFixed(3)}</th><td>${Math.round(1000 * (b.end - b.start))}</td><td>${b.p === null ? 'Not assigned' : Math.round(1000 * (b.start - b.p))}</td><td>${i ? (b.start - trace.qrs[i - 1].start).toFixed(3) : 'First visible complex'}</td></tr>`).join('')}</tbody></table></div>`
          : '<p>No organized QRS events are assigned; a ventricular rate is not calculated.</p>'
      }</details>`;
  }
  return Object.freeze({ create, valid, markup, kinds: Object.freeze(kinds) });
});
