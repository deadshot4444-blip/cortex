// DAT reading type: stems, RC passages, options and the periodic-table labels a student
// actually has to read. Chrome (crumbs, clocks) may stay small; reading text may not drop
// below 16px on a phone and may not stay gray-on-gray. PAT SVG labels are engine-owned
// and are not asserted here (changing them would shift figure scale).
//
// Reads dat.css the same way scripts/test-dat-shell.cjs does: flat rules plus @media, no
// nested selectors outside a media block.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function cssRules(css) {
  const out = [];
  const scan = (text, media) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) return;
      const head = text.slice(i, open).trim();
      if (head.startsWith('@media')) {
        let depth = 1,
          j = open + 1;
        while (j < text.length && depth) {
          if (text[j] === '{') depth++;
          else if (text[j] === '}') depth--;
          j++;
        }
        scan(text.slice(open + 1, j - 1), head.replace(/^@media\s*/, ''));
        i = j;
      } else {
        const close = text.indexOf('}', open);
        out.push({ media, selector: head, body: text.slice(open + 1, close).trim() });
        i = close + 1;
      }
    }
  };
  scan(css.replace(/\/\*[\s\S]*?\*\//g, ''), null);
  return out;
}
function decl(rule, name) {
  return (new RegExp('(?:^|;)\\s*' + name + '\\s*:([^;]+)').exec(rule.body) || [])[1]?.trim();
}
function covers(rule, needle) {
  return rule.selector
    .split(',')
    .map(s => s.trim())
    .includes(needle);
}
function appliesAt(media, width) {
  if (!media) return true;
  const max = /max-width:\s*(\d+)px/.exec(media);
  const min = /min-width:\s*(\d+)px/.exec(media);
  if (max && width > Number(max[1])) return false;
  if (min && width < Number(min[1])) return false;
  return true;
}
function lastDecl(rules, needle, prop, width) {
  let value;
  for (const rule of rules) {
    if (!covers(rule, needle)) continue;
    if (!appliesAt(rule.media, width)) continue;
    const next = decl(rule, prop);
    if (next) value = next;
  }
  return value;
}
function px(value) {
  const match = /^([\d.]+)px$/.exec(String(value || ''));
  return match ? Number(match[1]) : NaN;
}

const RULES = cssRules(fs.readFileSync('dat.css', 'utf8'));
const DESKTOP = 1280;
const PHONE = 390;

test('DAT stems stay 17px near-black on a desktop and on a phone', () => {
  for (const sel of ['.dat-item .dat-stem', '.q.dat-stem', '.dat-qr-stem', '.dat-pat-stem', '.dat-rc-stem']) {
    for (const width of [DESKTOP, PHONE]) {
      assert.equal(lastDecl(RULES, sel, 'color', width), 'var(--text)', sel + ' @ ' + width);
      assert.ok(px(lastDecl(RULES, sel, 'font-size', width)) >= 17, sel + ' @ ' + width + ' stays at least 17px');
    }
  }
});

test('RC passage text is near-black, at least 16px, and does not shrink to 14px on a phone', () => {
  assert.equal(lastDecl(RULES, '.dat-rc-text > li', 'color', DESKTOP), 'var(--text)');
  assert.equal(lastDecl(RULES, '.dat-rc-text > li', 'color', PHONE), 'var(--text)');
  assert.ok(px(lastDecl(RULES, '.dat-rc-text > li', 'font-size', DESKTOP)) >= 16, 'desktop passage');
  const phone = px(lastDecl(RULES, '.dat-rc-text > li', 'font-size', PHONE));
  assert.ok(phone >= 16, 'phone passage is ' + phone + 'px');
  assert.equal(lastDecl(RULES, '.dat-rc-passage', 'background', DESKTOP), 'var(--bg)');
});

test('options a student reads are 16px --text; letter keys are not faint 12px', () => {
  for (const sel of ['.dat-drill-main .opt', '.dat-opt', '.dat-qr-opt', '.dat-rc-opt']) {
    assert.ok(px(lastDecl(RULES, sel, 'font-size', DESKTOP)) >= 16, sel);
    assert.equal(lastDecl(RULES, sel, 'color', DESKTOP), 'var(--text)', sel);
  }
  for (const sel of ['.dat-opt .key', '.dat-qr-opt .key', '.dat-rc-opt .key']) {
    assert.ok(px(lastDecl(RULES, sel, 'font-size', DESKTOP)) >= 13, sel);
    assert.equal(lastDecl(RULES, sel, 'color', DESKTOP), 'var(--dim)', sel + ' is dim, not faint');
  }
});

test('quantitative comparison, data tables and the periodic table stay readable', () => {
  assert.ok(px(lastDecl(RULES, '.dat-qc-common', 'font-size', DESKTOP)) >= 16);
  assert.equal(lastDecl(RULES, '.dat-qc-common', 'color', DESKTOP), 'var(--text)');
  assert.ok(px(lastDecl(RULES, '.dat-ds p', 'font-size', DESKTOP)) >= 16);
  assert.ok(px(lastDecl(RULES, '.dat-data-table', 'font-size', DESKTOP)) >= 14);
  assert.ok(px(lastDecl(RULES, '.dat-pt-z', 'font-size', DESKTOP)) >= 9, 'atomic number was 7px');
  assert.ok(px(lastDecl(RULES, '.dat-pt-sym', 'font-size', DESKTOP)) >= 12, 'symbol was 11px');
});
