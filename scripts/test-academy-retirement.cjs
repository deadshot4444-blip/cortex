const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

test('retiring a course preserves historical plans without scheduling or advertising it', () => {
  const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'https://cortex.example/academy?view=today', runScripts: 'outside-only' });
  const w = dom.window, context = dom.getInternalVMContext();
  const now = new Date(), date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const original = {
    'cs-academy-today-v1': JSON.stringify({ version:1, budget:45, priority:['cogpsych','mcat'], paused:[], days:{
      [date]: { blocks:{ cogpsych:{ planned:15, startedAt:1, completedAt:2, minutes:20 } } },
      '2025-01-01': { blocks:{ cogpsych:{ planned:15, startedAt:1 } } }
    } }),
    'cs-cogpsych': JSON.stringify({ lessons:{ saved:{ draft:'Retain my earlier writing.' } } })
  };
  const saved = new Map(Object.entries(original)), writes = [];
  Object.assign(w, {
    IS_LOCAL_PREVIEW:false, sectionUrl:id=>'/'+id, openSection(){},
    StudyStorage:{ paused:false, read:(key,fallback)=>saved.has(key)?JSON.parse(saved.get(key)):fallback, watch(){},
      sessionFailed(){ this.paused=true; }, write(key,value){ writes.push(key);saved.set(key,JSON.stringify(value));return true; } },
    el:html=>{const t=w.document.createElement('template');t.innerHTML=html;return t.content.firstElementChild;},
    esc:value=>String(value), setView:node=>w.document.querySelector('#app').replaceChildren(node)
  });
  w.topbar=()=>w.el('<header>Academy</header>');
  for(const file of ['academy.js','academy-today.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
  w.AcademyToday.render();
  assert.equal(w.StudyStorage.paused,false);
  assert.equal(w.CortexAcademy.tracks.length,6);
  assert.equal(w.document.querySelectorAll('[data-track]').length,6);
  assert.equal(w.document.querySelector('[data-track="cogpsych"], [data-start="cogpsych"], [data-finish="cogpsych"]'),null);
  assert.match(w.document.querySelector('.academy-day-summary').textContent,/20 minutes recorded/);
  assert.ok(w.document.querySelector('[data-start="mcat"]'));
  assert.match(w.document.querySelector('#academy-recorded').parentElement.textContent,/Archived course · 20 minutes/);
  assert.deepEqual(Object.fromEntries(saved),original);
  assert.deepEqual(writes,[]);
  dom.window.close();
});

test('public discovery and new offline packs contain no retired-course destination', () => {
  const catalog=JSON.parse(fs.readFileSync('data/academy-curriculum.json'));
  const manifest=JSON.parse(fs.readFileSync('offline-manifest.json'));
  assert.equal(catalog.entries.some(entry=>entry.track==='cogpsych'),false);
  assert.equal(catalog.connections.some(link=>link.from.startsWith('cogpsych:')||link.to.startsWith('cogpsych:')),false);
  assert.equal(catalog.cards.some(card=>card.links.some(link=>link.track==='cogpsych')),false);
  assert.equal(manifest.packs.some(pack=>pack.id==='cogpsych'),false);
  assert.equal(manifest.packs.some(pack=>pack.files.some(file=>/cogpsych/.test(file.url))),false);
});
