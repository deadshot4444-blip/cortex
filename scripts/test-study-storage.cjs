/* Cross-tab conflict detection for the shared clinical records app.js loads before study-storage.js. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const app=fs.readFileSync('app.js','utf8'),storageSource=fs.readFileSync('study-storage.js','utf8');
// The boot slice: STUDY_CORE_KEYS, studyBootCopies, store, loadJSON, safeSet and the save helpers.
const boot=app.slice(app.indexOf('// Raw copies of the shared clinical records'),app.indexOf('const SECTION_SCRIPTS'));
const A='{"cardiology":{"seen":[],"answered":1,"correct":1,"xp":10}}';
const B='{"cardiology":{"seen":[],"answered":1,"correct":1,"xp":10},"neurology":{"seen":["nr-101"],"answered":1,"correct":1,"xp":10}}';
function harness(){
  const dom=new JSDOM('<!doctype html><body></body>',{url:'http://localhost/reference',runScripts:'outside-only'}),w=dom.window,ctx=dom.getInternalVMContext();
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.localStorage.setItem('cs-progress',A);w.localStorage.setItem('cs-history','[]');
  vm.runInContext(boot,ctx);
  const S=()=>vm.runInContext('StudyStorage',ctx);
  return {w,ctx,S,loadStorage:()=>vm.runInContext(storageSource,ctx),
    otherTab:(key,value)=>{w.localStorage.setItem(key,value);w.dispatchEvent(new w.StorageEvent('storage',{key,newValue:value,storageArea:w.localStorage}));},
    // medAwardXP (reference.js) mutates store.progress then calls saveProgress -> safeSet.
    awardMedicine(){const p=vm.runInContext('store.progress',ctx);p.medicine={seen:[],answered:1,correct:1,xp:10};return vm.runInContext('saveProgress(),safeSet("cs-progress",JSON.stringify(store.progress))',ctx);},
    close:()=>dom.window.close()};
}
test('app.js records the raw copy it loaded for every shared clinical key',()=>{
  const h=harness(),copies=JSON.parse(JSON.stringify(vm.runInContext('studyBootCopies',h.ctx)));
  assert.deepEqual(copies,{'cs-progress':A,'cs-cases':null,'cs-history':'[]','cs-streak':null});
  assert.equal(JSON.stringify(vm.runInContext('store.progress',h.ctx)),A);h.close();
});
test('with no cross-tab change the first Medicine award saves normally',()=>{
  const h=harness();h.loadStorage();assert.equal(h.S().paused,false);
  assert.equal(h.awardMedicine(),true);assert.deepEqual(Object.keys(JSON.parse(h.w.localStorage.getItem('cs-progress'))),['cardiology','medicine']);h.close();
});
test('a change made by another tab before study-storage.js loaded pauses saving instead of overwriting it',()=>{
  const h=harness();h.w.localStorage.setItem('cs-progress',B);
  h.loadStorage();assert.equal(h.S().conflicted,true);assert.equal(h.w.document.querySelector('#study-conflict-title').textContent,'Newer study work was saved.');
  assert.equal(h.awardMedicine(),false);assert.equal(h.w.localStorage.getItem('cs-progress'),B);
  const records=h.S().recovery().records;
  assert.equal(JSON.stringify(records['cs-progress'].saved),B);assert.deepEqual(Object.keys(records['cs-progress'].thisTab),['cardiology','medicine']);
  assert.ok('cs-cases' in records&&'cs-history' in records&&'cs-streak' in records);h.close();
});
test('a storage event for a shared key this tab has not written yet is treated as a conflict',()=>{
  const h=harness();h.loadStorage();assert.equal(h.S().paused,false);
  h.otherTab('cs-progress',B);assert.equal(h.S().conflicted,true);
  assert.equal(h.awardMedicine(),false);assert.equal(h.w.localStorage.getItem('cs-progress'),B);h.close();
});
test('a shared key that was absent at boot and appears later is also a conflict',()=>{
  const h=harness();h.loadStorage();h.otherTab('cs-streak','{"current":3,"longest":3,"lastDate":"2026-09-07"}');
  assert.equal(h.S().conflicted,true);assert.equal(vm.runInContext('saveStreak(),safeSet("cs-streak",JSON.stringify(store.streak))',h.ctx),false);
  assert.equal(JSON.parse(h.w.localStorage.getItem('cs-streak')).current,3);h.close();
});
test('study-storage.js still loads and saves when no boot copies exist',()=>{
  const dom=new JSDOM('<!doctype html><body></body>',{url:'http://localhost/practice',runScripts:'outside-only'}),w=dom.window;
  const ctx=dom.getInternalVMContext();vm.runInContext(storageSource,ctx);const S=vm.runInContext('StudyStorage',ctx);assert.equal(S.paused,false);
  assert.equal(S.write('cs-pharm',{a:1}),true);assert.equal(w.localStorage.getItem('cs-pharm'),'{"a":1}');dom.window.close();
});
test('a confirmed workspace replacement opens one recovery dialog and excludes the new workspace from old-tab copies',()=>{
  const dom=new JSDOM('<!doctype html><body></body>',{url:'http://localhost/academy',runScripts:'outside-only'}),w=dom.window,ctx=dom.getInternalVMContext();
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  const rawSet=w.Storage.prototype.setItem.bind(w.localStorage);
  rawSet('cs-note','{"text":"original saved note"}');w.CortexProgress=require('../auth-progress.js');
  vm.runInContext(fs.readFileSync('auth.js','utf8'),ctx);vm.runInContext(storageSource,ctx);
  const S=vm.runInContext('StudyStorage',ctx);S.watch('cs-note',()=>({text:'draft held by old tab'}));
  rawSet(w.CortexProgress.OWNER,JSON.stringify({id:'guest',token:'restored-workspace'}));rawSet('cs-note','{"text":"new workspace note"}');
  w.dispatchEvent(new w.StorageEvent('storage',{key:w.CortexProgress.OWNER,storageArea:w.localStorage}));
  assert.equal(w.document.querySelectorAll('dialog[open]').length,1);assert.equal(w.document.querySelector('#account-work-paused'),null);
  assert.equal(w.document.querySelector('#study-conflict-title').textContent,'Your active workspace changed.');assert.equal(S.conflicted,true);
  assert.equal(S.write('cs-note',{text:'stale write'}),false);assert.equal(w.localStorage.getItem('cs-note'),'{"text":"new workspace note"}');
  const copy=S.recovery().records['cs-note'];assert.equal(copy.saved.text,'original saved note');assert.equal(copy.thisTab.text,'draft held by old tab');
  assert.throws(()=>w.CortexAccount.snapshot());dom.window.close();
});
test('Escape keeps the recovery notice open and Enter cannot activate the lesson behind a native dialog',()=>{
  const h=harness();h.loadStorage();h.S().workspaceChanged();
  const dialog=h.w.document.querySelector('#study-save-conflict'),button=dialog.querySelector('button');
  const escape=new h.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});button.dispatchEvent(escape);
  assert.equal(escape.defaultPrevented,true);assert.equal(dialog.open,true);
  const next=h.w.document.createElement('button');next.setAttribute('data-next','');let advances=0;next.onclick=()=>advances++;h.w.document.body.appendChild(next);
  const keyboard=app.split('/* ---------- keyboard ---------- */')[1].split('\nboot();')[0];
  vm.runInContext(keyboard,h.ctx);
  button.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));assert.equal(advances,0);
  dialog.close();next.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));assert.equal(advances,1);h.close();
});
