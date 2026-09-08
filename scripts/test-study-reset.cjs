/* Actual reset dialog with the real account transaction in isolated jsdom storage. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const Progress=require('../auth-progress.js'),app=fs.readFileSync('app.js','utf8');
const code=app.slice(app.indexOf('const SPECIALTIES = ['),app.indexOf('const NAME_BY_KEY'))+app.slice(app.indexOf('function studyResetData('),app.indexOf('\nfunction prog(key)'));
const seed={
  'cs-mcat-course-v1':'{"units":{"u1":{"notes":"MCAT note"}}}', 'cs-mcat-v2':'{}',
  'cs-neuro':'{"projects":{"one":{"code":"return 1"}}}', 'cs-cogpsych':'{}','cs-cogpsych-research-v1':'{}',
  'cs-ltl-progress-v1':'{}','cs-academy-anatomy-v1':'{}','cs-academy-reference-v1':'{}',
  'cs-academy-portfolio-v1':'{"entries":[{"title":"Selected work"}]}','cs-academy-today-v1':'{}','cs-academy-connections-v1':'{}',
  'cs-clinical-shift-v1':'{}','cs-clinical-longitudinal-v1':'{}','cs-cases':'{}','cs-history':'[]','cs-streak':'{}',
  'cs-medicine':'{}','cs-pharm':'{}','cs-pomo':'{}',
  'cs-progress':'{"cardiology":{"xp":50},"emergency-medicine":{"xp":20},"medicine":{"xp":30}}',
  'cs-mode':'untimed','cs-anon-id':'local-identifier','sb-token':'SECRET','cortex-progress-copy-v1:other-account':'{"data":{"cs-neuro":"PRIVATE_OTHER"}}'
};
function harness(client){
  const dom=new JSDOM('<!doctype html><body></body>',{url:'http://localhost/academy',runScripts:'outside-only'}),w=dom.window;
  for(const[k,v]of Object.entries(seed))w.localStorage.setItem(k,v);
  let fail=null,reloads=0,paused=false;const storage={get length(){return w.localStorage.length;},key:i=>w.localStorage.key(i),getItem:k=>w.localStorage.getItem(k),
    setItem(k,v){if(fail?.('set',k)){fail=null;throw Error('Injected storage failure');}w.localStorage.setItem(k,v);},
    removeItem(k){if(fail?.('remove',k)){fail=null;throw Error('Injected storage failure');}w.localStorage.removeItem(k);}};
  const engine=Progress.create({storage,client,onReload:()=>reloads++});
  w.CortexAccount={available:true,snapshot:()=>engine.portableSnapshot(),prepareRestore:data=>engine.prepareRestore(data),restore:preview=>engine.restore(preview),downloadRecovery(){}};
  w.StudyStorage={get paused(){return paused;}};w.el=html=>{const t=w.document.createElement('template');t.innerHTML=html;return t.content.firstElementChild;};w.esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');w.trapModal=()=>{};
  vm.runInContext(code,dom.getInternalVMContext());w.openResetProgress();
  const find=s=>w.document.querySelector(s),click=s=>{const n=find(s);assert.ok(n,s);n.click();};
  return{w,find,click,engine,storage,get reloads(){return reloads;},set fail(fn){fail=fn;},set paused(value){paused=value;},close(){engine.stop();dom.window.close();}};
}
test('all-study reset previews first, covers all seven courses and preserves preferences, auth and recovery copies',()=>{
  const h=harness(),before=h.engine.portableSnapshot().data;h.click('#rst-all');assert.deepEqual(h.engine.portableSnapshot().data,before);assert.match(h.find('#rst-preview').textContent,/All seven courses/);
  h.click('#rst-confirm');assert.equal(h.reloads,1);
  for(const key of Object.keys(before))assert.equal(h.storage.getItem(key),['cs-mode','cs-anon-id'].includes(key)?before[key]:null,key);
  assert.equal(h.storage.getItem('sb-token'),'SECRET');assert.equal(h.storage.getItem('cortex-progress-copy-v1:other-account'),seed['cortex-progress-copy-v1:other-account']);
  assert.deepEqual(JSON.parse(h.storage.getItem(Progress.archiveKey('guest'))).data,before);h.close();
});
test('clinical reset keeps Medicine counters, other courses and the selected portfolio',()=>{
  const h=harness();h.click('#rst-clinical');h.click('#rst-confirm');assert.deepEqual(JSON.parse(h.storage.getItem('cs-progress')),{medicine:{xp:30}});
  assert.equal(h.storage.getItem('cs-clinical-longitudinal-v1'),null);for(const k of ['cs-mcat-course-v1','cs-academy-reference-v1','cs-academy-portfolio-v1','cs-academy-today-v1'])assert.equal(h.storage.getItem(k),seed[k]);h.close();
});
test('Medicine and MCAT resets remove their full current scope while retaining other courses and portfolio snapshots',()=>{
  const m=harness();m.click('#rst-medicine');m.click('#rst-confirm');assert.equal(m.storage.getItem('cs-academy-reference-v1'),null);assert.deepEqual(JSON.parse(m.storage.getItem('cs-progress')),{cardiology:{xp:50},'emergency-medicine':{xp:20}});assert.equal(m.storage.getItem('cs-academy-portfolio-v1'),seed['cs-academy-portfolio-v1']);m.close();
  const h=harness();h.click('#rst-mcat');h.click('#rst-confirm');assert.equal(h.storage.getItem('cs-mcat-course-v1'),null);assert.equal(h.storage.getItem('cs-mcat-v2'),null);for(const k of ['cs-neuro','cs-academy-reference-v1','cs-academy-portfolio-v1','cs-academy-today-v1'])assert.equal(h.storage.getItem(k),seed[k]);h.close();
});
test('canceling, closing or choosing a different scope invalidates a previously prepared reset',()=>{
  for(const mode of ['cancel','close','rescope']){
    const h=harness(),before=h.engine.portableSnapshot().data;h.click('#rst-all');const old=h.find('#rst-confirm');
    h.click(mode==='cancel'?'#rst-back':mode==='close'?'#rst-cancel':'#rst-clinical');old.click();assert.deepEqual(h.engine.portableSnapshot().data,before);assert.equal(h.reloads,0);h.close();
  }
});
test('newer writes, changed account ownership and paused study saves block a stale reset',()=>{
  for(const mode of ['newer','owner','paused']){
    const h=harness();h.click('#rst-all');if(mode==='newer')h.storage.setItem('cs-neuro','{"changed":true}');if(mode==='owner')h.storage.setItem(Progress.OWNER,JSON.stringify({id:'B',token:'changed'}));if(mode==='paused')h.paused=true;
    const expected=h.storage.getItem('cs-neuro');h.click('#rst-confirm');assert.equal(h.storage.getItem('cs-neuro'),expected);assert.equal(h.storage.getItem('cs-mcat-course-v1'),seed['cs-mcat-course-v1']);assert.equal(h.reloads,0);assert.match(h.find('#rst-status').textContent,/changed|paused/);h.close();
  }
});
test('failed recovery-copy creation and mid-reset failure preserve the original workspace',()=>{
  for(const mode of ['archive','mid-delete']){
    const h=harness(),before=h.engine.portableSnapshot().data;h.click('#rst-all');
    h.fail=(operation,key)=>mode==='archive'?operation==='set'&&key===Progress.archiveKey('guest'):operation==='remove'&&key==='cs-neuro';h.click('#rst-confirm');
    for(const[k,v]of Object.entries(before))assert.equal(h.storage.getItem(k),v,mode+' '+k);assert.equal(h.reloads,0);assert.match(h.find('#rst-status').textContent,/failure/);h.close();
  }
});
test('unreadable shared counters cannot be silently erased by a narrower course reset',()=>{
  for(const broken of ['broken','{bad json','[]','"text"']){
    const h=harness();h.storage.setItem('cs-progress',broken);h.click('#rst-clinical');assert.equal(h.find('#rst-confirm'),null);assert.equal(h.storage.getItem('cs-progress'),broken);assert.equal(h.storage.getItem('cs-cases'),seed['cs-cases']);
    assert.equal(h.find('#rst-status').textContent,'Shared progress could not be read. Keep a recovery copy before resetting.',broken);h.close();
  }
});
test('the clinical preview discloses that the day streak shared with MCAT practice is cleared',()=>{
  const h=harness();h.click('#rst-clinical');assert.match(h.find('#rst-preview').textContent,/day streak that MCAT practice also builds/);
  assert.equal(h.storage.getItem('cs-streak'),seed['cs-streak']);h.click('#rst-confirm');assert.equal(h.storage.getItem('cs-streak'),null);
  const m=harness();m.click('#rst-mcat');assert.doesNotMatch(m.find('#rst-preview').textContent,/streak/);m.click('#rst-confirm');assert.equal(m.storage.getItem('cs-streak'),seed['cs-streak']);h.close();m.close();
});
test('a reset attempted while an account save is still syncing explains the wait without restore wording',()=>{
  // A cloud read that never settles keeps the engine in its syncing state, as it is for 2.5 s after every signed-in save.
  const pending=new Promise(()=>{}),query={select:()=>query,eq:()=>query,maybeSingle:()=>pending};
  const h=harness({from:()=>query});h.engine.setUser({id:'guest'});assert.equal(h.engine.state,'syncing');
  h.click('#rst-clinical');assert.equal(h.find('#rst-confirm'),null);assert.equal(h.storage.getItem('cs-cases'),seed['cs-cases']);
  const text=h.find('#rst-status').textContent;assert.match(text,/still in progress/);assert.match(text,/Try again/);assert.doesNotMatch(text,/restor/i);h.close();
});
