'use strict';
// Guards content conventions in data/medicine-foundations.json that were
// found broken in the 2026-09 audit: numbered catalog headings, US medical
// spelling, and OpenStax citation titles that match the section in the URL.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'medicine-foundations.json'), 'utf8'));

test('every catalog group title is numbered in order', () => {
  data.groups.forEach((group, i) => {
    assert.match(group.title, new RegExp('^' + (i + 1) + '\\. '), group.id);
  });
});

test('lesson text uses US spelling for -kalemia / hemolysis (source titles and URLs excluded)', () => {
  const offenders = [];
  const walk = (node, keyPath) => {
    if (typeof node === 'string') {
      if (/kalaemi|haemol/i.test(node)) offenders.push(keyPath + ': ' + node.slice(0, 60));
    } else if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, keyPath + '[' + i + ']'));
    } else if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (key === 'sources') continue; // cited UK guideline keeps its own spelling
        walk(value, keyPath + '.' + key);
      }
    }
  };
  walk(data.lessons, 'lessons');
  assert.deepEqual(offenders, []);
});

test('OpenStax citation titles name the section their URL points to', () => {
  const words = s =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ');
  for (const lesson of data.lessons) {
    for (const source of lesson.sources || []) {
      const m = /openstax\.org\/books\/microbiology\/pages\/(\d+)-(\d+)-(.+)$/.exec(source.url || '');
      if (!m) continue;
      const section = m[1] + '.' + m[2];
      assert.ok(source.title.includes(section), lesson.id + ': ' + source.title);
      const slug = words(m[3]);
      const title = words(source.title.split(':').slice(1).join(':'));
      const overlap = slug.filter(w => w.length > 3 && title.includes(w));
      assert.ok(overlap.length >= 1, lesson.id + ': "' + source.title + '" does not describe ' + source.url);
    }
  }
});
