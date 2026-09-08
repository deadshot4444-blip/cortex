/* Saved practice journeys use the actual controller, account engine and StudyStorage in jsdom. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom'),Progress=require('../auth-progress.js'),Backup=require('../study-backup.js'),crypto=require('node:crypto').webcrypto;
const bank=JSON.parse(fs.readFileSync('data/cogpsych-bank.json')),lessons=JSON.parse(fs.readFileSync('data/cogpsych-learn.json')),KEY='cs-cogpsych';
function harness(seed={},now=1788795000000){
  const dom=new JSDOM('<!doctype html><body><div id="app"></div></body>',{url:'http://localhost/cogpsych?view=practice',runScripts:'outside-only'}),w=dom.window,ctx=dom.getInternalVMContext();
  const get=w.Storage.prototype.getItem,set=w.Storage.prototype.setItem,remove=w.Storage.prototype.removeItem;
  for(const[k,v]of Object.entries(seed))set.call(w.localStorage,k,v);
  const storage={get length(){return w.localStorage.length;},key:i=>w.localStorage.key(i),getItem:k=>get.call(w.localStorage,k),setItem:(k,v)=>set.call(w.localStorage,k,v),removeItem:k=>remove.call(w.localStorage,k)};
  const engine=Progress.create({storage});w.CortexProgress=Progress;let fail=()=>false,time=now,id=0;const timers=new Map(),timeouts=new Map(),writes=[],errors=[];
  w.Storage.prototype.setItem=function(k,v){engine.beforeWrite(k);if(fail(k,JSON.parse(k===KEY?v:'null')))throw Error('Synthetic quota failure');set.call(this,k,v);engine.afterWrite(k);if(k===KEY)writes.push(JSON.parse(v));};
  w.Date.now=()=>time;w.setInterval=fn=>{timers.set(++id,fn);return id;};w.clearInterval=id=>timers.delete(id);w.setTimeout=fn=>{timeouts.set(++id,fn);return id;};w.clearTimeout=id=>timeouts.delete(id);
  w.el=html=>{const t=w.document.createElement('template');t.innerHTML=html;return t.content.firstElementChild;};
  w.esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  w.topbar=()=>w.el('<header>Psychology</header>');w.siteFooter=()=>w.el('<footer>Cortex</footer>');w.sectionUrl=s=>'/'+s;w.setView=root=>w.document.querySelector('#app').replaceChildren(root);w.IS_LOCAL_PREVIEW=true;
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};w.requestAnimationFrame=fn=>fn();
  w.addEventListener('error',e=>{errors.push(e.error);e.preventDefault();});
  const run=code=>vm.runInContext(code,ctx);for(const file of ['study-storage.js','cogpsych.js','cogpsych-learn.js'])run(fs.readFileSync(file,'utf8'));
  w.bank=JSON.parse(JSON.stringify(bank));w.lessons=lessons;run('COG_BANK=bank;cogBankReady=true;COG_LESSONS=lessons;cogLearnReady=true;');
  const find=s=>w.document.querySelector(s),click=s=>{const n=find(s);assert.ok(n,s);n.click();assert.equal(errors.length,0,errors[0]?.stack);};
  return{w,run,find,click,writes,storage,errors,timers,timeouts,raw:()=>storage.getItem(KEY),state:()=>JSON.parse(storage.getItem(KEY)||'null'),
    seed:()=>Object.fromEntries(Array.from({length:storage.length},(_,i)=>storage.key(i)).map(k=>[k,storage.getItem(k)])),
    force:(key,value)=>storage.setItem(key,value),set fail(fn){fail=fn;},set time(t){time=t;},get time(){return time;},
    input(s,value){const n=find(s);assert.ok(n,s);n.value=value;n.dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(errors.length,0,errors[0]?.stack);},
    choose(right=true){const q=JSON.parse(run('JSON.stringify(COG.practice.current.question)'));click('[data-choice="'+(right?q.answer:(q.answer+1)%4)+'"]');},
    start(mode='chapter',pool=[bank[0]]){w.input={mode,pool,chapter:pool[0]?.chapter,topic:pool[0]?.topic,...(mode==='exam'?{lives:4,maxLives:4}:{})};run('cogRunQuestion(input)');},
    async recover(){assert.equal(run('StudyStorage.retry()'),true);await w.renderCogPsych();},
    close(){engine.stop();dom.window.close();}};
}
test('all seven entry modes reopen the same question, order and feedback without double-counting',()=>{
  for(const code of ['startCogSmart()','startCogBlitz()','startCogChapter(1)','startCogTopic(COG_BANK[0].topic)','startCogExam()','COG.q[COG_BANK[0].id]={box:0,a:1,c:0,ts:1,lastWrong:true};startCogMisses()','COG.starred[COG_BANK[0].id]=1;startCogStarred()']){
    const h=harness();h.run(code);const before=h.state().practice;assert.ok(before.current);const h2=harness(h.seed(),h.time);h2.run('cogRunQuestion(COG.practice)');
    assert.deepEqual(h2.state().practice.current,before.current);assert.equal(h2.state().plays,1);h2.choose();const answered=h2.state();
    const h3=harness(h2.seed(),h2.time);h3.run('cogRunQuestion(COG.practice)');assert.equal(h3.state().answered,answered.answered);assert.equal(h3.state().practice.answered,1);
    assert.deepEqual(h3.state().practice.current,answered.practice.current);assert.ok(h3.find('.gen-opt').disabled);assert.match(h3.find('#gen-explain').textContent,/already recorded/);
    h.close();h2.close();h3.close();
  }
});
test('later bank revisions and download loss do not rewrite open questions, queues or feedback',async()=>{
  const h=harness();h.start('chapter',bank.slice(0,3));h.choose(false);h.click('#gen-next');const old=h.state().practice;
  const h2=harness(h.seed());h2.run('COG_BANK=[];cogBankReady=false;cogLoadBank=async()=>{};cogLoadLessons=async()=>{throw Error("Offline lesson download")};');await h2.w.renderCogPsych();assert.deepEqual(h2.state().practice,old);
  assert.equal(h2.find('.gen-q-stem').textContent,old.current.question.q);h2.choose();h2.click('#gen-next');assert.equal(h2.state().practice.current.question.q,old.pool[old.idx+1].q);
  h.close();h2.close();
});
test('smart review freezes source wording and persists scheduled retries',()=>{
  const h=harness();h.run('COG_BANK=COG_BANK.slice(0,3);startCogSmart()');h.choose(false);const old=h.state().practice;assert.equal(old.retryQ.length,1);
  const h2=harness(h.seed());h2.run('COG_BANK=COG_BANK.map(q=>({...q,q:"REVISED"}));cogRunQuestion(COG.practice)');assert.deepEqual(h2.state().practice.retryQ,old.retryQ);
  for(let i=0;i<3;i++){h2.click('#gen-next');assert.notEqual(h2.find('.gen-q-stem').textContent,'REVISED');h2.choose();}
  assert.ok(h2.state().practice.supportedAnswers>=1);h.close();h2.close();
});
test('scratchpad and calculator persist as escaped text, including post-evaluation behavior and help counts',async()=>{
  const q=bank[0],h=harness();h.start('chapter',[q]);h.click('#gen-tools-toggle');h.input('#gen-pad-area','x<cutoff; <img src=x onerror=alert(1)>');
  for(const key of ['2','+','3','eq'])h.click('[data-k="'+key+'"]');assert.equal(h.state().practice.calculator,'5');
  const h2=harness(h.seed());h2.run('cogRunQuestion(COG.practice)');assert.equal(h2.find('#gen-calc-disp').value,'5');assert.equal(h2.find('#gen-pad-area').value,h.state().practice.scratch);assert.equal(h2.find('main img'),null);
  h2.click('[data-k="2"]');assert.equal(h2.state().practice.calculator,'2');h2.choose();assert.equal(h2.state().practice.supportedAnswers,1);h2.click('#gen-next');
  assert.equal(h2.state().practice.current.question.id,q.id);assert.ok(h2.state().practice.completedAt);assert.match(h2.find('main').textContent,/not an examination score/);
  const data={[KEY]:h2.raw()},options={crypto};assert.deepEqual((await Backup.parse(await Backup.create(data,'local',options),options)).data,data);
  h.close();h2.close();
});
test('saved authored emphasis is readable while unknown markup and learner notes stay literal',()=>{
  const q={...bank[0],explain:'A <b>useful idea</b> & <img src=x onerror=alert(1)>',hint:'Consider <b>evidence</b>.'};
  const h=harness();h.run('COG.q[bank[0].id]={box:0,a:1,c:0,ts:1,lastWrong:true};');h.start('chapter',[q]);
  assert.match(h.find('.gen-hint').textContent,/Consider evidence\./);
  h.click('#gen-tools-toggle');h.input('#gen-pad-area','Keep <b>my own markup</b>');h.choose();
  const h2=harness(h.seed());h2.run('cogRunQuestion(COG.practice)');
  assert.match(h2.find('#gen-explain').textContent,/A useful idea & <img src=x onerror=alert\(1\)>/);
  assert.equal(h2.find('#gen-explain img'),null);
  assert.equal(h2.find('#gen-pad-area').value,'Keep <b>my own markup</b>');
  assert.equal(h2.state().practice.current.question.explain,q.explain,'Stored wording is unchanged');
  h2.click('#gen-next');assert.match(h2.find('main details').textContent,/A useful idea & <img/);
  assert.equal(h2.find('main img'),null);h.close();h2.close();
});
test('answer and first achievement fail atomically and recovery neither loses nor doubles the answer',async()=>{
  const h=harness();h.start();const prior=h.raw();h.fail=(key,value)=>key===KEY&&value.answered>0;h.choose();assert.equal(h.raw(),prior);
  const held=h.run('StudyStorage.recovery().records[COG_KEY].thisTab');assert.equal(held.answered,1);assert.equal(held.practice.answered,1);assert.ok(held.ach.includes('first'));assert.ok(h.find('#study-save-conflict'));
  h.choose(false);assert.equal(h.run('COG.answered'),1);h.fail=()=>false;await h.recover();assert.equal(h.state().answered,1);assert.equal(h.state().q[bank[0].id].a,1);assert.ok(h.find('.gen-opt').disabled);
  assert.ok(h.writes.every(s=>s.answered===s.practice.answered));h.close();
});
test('failed final save recovers completed results exactly once, including a full challenge',async()=>{
  const h=harness();h.start('exam',bank.slice(0,20));for(let i=0;i<20;i++){h.choose();if(i<19)h.click('#gen-next');}
  h.fail=(key,value)=>key===KEY&&!!value.practice.completedAt;h.click('#gen-next');assert.equal(h.state().practice.completedAt,null);const completed=h.run('COG.practice.completedAt');assert.ok(completed);
  h.fail=()=>false;await h.recover();assert.equal(h.state().practice.completedAt,completed);assert.equal(h.state().bestExam,100);assert.equal(h.state().ach.filter(x=>x==='exam').length,1);assert.equal(h.state().answered,20);
  h.run('cogRunQuestion(COG.practice)');assert.equal(h.state().answered,20);assert.equal(h.state().practice.completedAt,completed);assert.equal(h.state().practice.current.selected,h.state().practice.current.question.answer);h.close();
});
test('early ending and exhausted challenge lives do not award a passing exam result',()=>{
  const h=harness();h.start('exam',bank.slice(0,20));h.choose();h.click('#cog-quit');h.click('#cog-practice-end');assert.ok(h.state().practice.endedEarly);assert.equal(h.state().bestExam,0);assert.ok(!h.state().ach.includes('exam'));
  assert.equal(h.find('main h1').textContent,'Session ended early');
  h.click('#gen-again');for(let i=0;i<4;i++){h.choose(false);h.click('#gen-next');}assert.equal(h.state().practice.lives,0);assert.ok(h.state().practice.completedAt);assert.equal(h.state().bestExam,0);
  assert.equal(h.find('main h1').textContent,'Challenge stopped: no lives left');assert.match(h.find('#gen-lives-out').textContent,/after 4 of 20 questions/);assert.match(h.find('#gen-lives-out').textContent,/No best score was recorded/);
  const h2=harness(h.seed(),h.time);h2.run('cogRunQuestion(COG.practice)');assert.equal(h2.find('main h1').textContent,'Challenge stopped: no lives left','A reopened saved session keeps the explanation');
  const h3=harness();h3.start('exam',bank.slice(0,20));for(let i=0;i<20;i++){h3.choose(true);if(i<19)h3.click('#gen-next');}h3.click('#gen-next');
  assert.equal(h3.find('main h1').textContent,'Session finished');assert.equal(h3.find('#gen-lives-out'),null);h.close();h2.close();h3.close();
});
test('Enter advances an answered question only from non-interactive targets',()=>{
  const h=harness();h.start('chapter',bank.slice(0,3));h.choose();const key=target=>target.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  for(const selector of ['#cog-quit','#gen-star','#gen-tools-toggle']){const control=h.find(selector);control.focus();key(control);assert.equal(h.state().practice.idx,0,selector+' keeps the answered question');assert.ok(control.isConnected);}
  key(h.find('.gen-opt[aria-pressed="true"]'));assert.equal(h.state().practice.idx,1,'Enter on the answered option advances');
  h.choose();key(h.w.document.body);assert.equal(h.state().practice.idx,2,'Enter on the page advances');h.close();
});
test('an unfinished session blocks every other practice start with a visible reason instead of a silent swap',()=>{
  const h=harness();h.run('COG.starred[COG_BANK[0].id]=1;COG.q[COG_BANK[1].id]={box:0,a:1,c:0,ts:1,lastWrong:true};');h.start('exam',bank.slice(0,20));h.choose();
  h.click('#cog-quit');const saved=h.state().practice;assert.match(h.find('.course-notice').textContent,/1 answer recorded/);
  for(const mode of ['smart','chapter','misses','blitz','exam','starred']){const b=h.find(`[data-mode="${mode}"]`);assert.ok(b.disabled,mode);assert.match(b.title,/saved practice session/);}
  assert.ok(!h.find('[data-mode="stats"]').disabled);h.click('[data-mode="stats"]');
  for(const id of ['#gen-misses2','#gen-starred2'])assert.ok(h.find(id).disabled,id);assert.match(h.find('#gen-stats-saved').textContent,/Resume or end it/);
  h.run('startCogStarred()');assert.ok(h.find('#cog-practice-resume'),'A direct start routes to the saved-session notice');assert.equal(h.find('[data-cog-practice]'),null);
  assert.deepEqual(h.state().practice,saved);assert.equal(h.state().plays,1);h.click('#cog-practice-resume');assert.equal(h.find('.gen-hud-lives')?.textContent.length,4);
  h.choose();h.click('#gen-next');assert.equal(h.state().practice.idx,1);assert.equal(h.state().practice.mode,'exam');h.close();
});
test('achievements unlocked inside a save batch are announced after the save',()=>{
  const h=harness();h.start('chapter',bank.slice(0,2));const toasts=()=>[...h.w.document.body.querySelectorAll('.gen-toast')].map(t=>t.textContent);
  h.choose();assert.deepEqual(toasts(),['Achievement unlocked · First Insight']);assert.ok(h.state().ach.includes('first'));
  const h2=harness();h2.start('chapter',bank.slice(0,2));h2.fail=(key,value)=>key===KEY&&value.answered>0;h2.choose();assert.equal(h2.w.document.body.querySelector('.gen-toast'),null,'A failed save shows no toast');h.close();h2.close();
});
test('completing every lesson unlocks Course Scholar on the home page',()=>{
  const h=harness();h.run('COG_LESSONS.filter(l=>COG_CH[l.chapter]).forEach(l=>COG.learned[l.id]=1);renderCogHome()');assert.ok(h.state().ach.includes('scholar'));
  assert.match(h.find('.gen-badge.got .gen-badge-name').textContent,/Course Scholar/);
  const h2=harness();h2.run('renderCogHome()');assert.equal(h2.run('COG.ach.includes("scholar")'),false);assert.equal(h2.find('.gen-badge.got'),null);h.close();h2.close();
});
test('review starts report a missing practice bank rather than an empty pool',()=>{
  for(const code of ['startCogMisses()','startCogStarred()']){const h=harness();h.run('COG_BANK=[];cogBankReady=false;'+code);assert.match(h.find('main').textContent,/Practice unavailable/);assert.doesNotMatch(h.find('main').textContent,/nice work|starred any/);h.close();}
});
test('reset progress is refused while saving is paused',async()=>{
  const h=harness();h.start();h.fail=(key,value)=>key===KEY&&value.answered>0;h.choose();assert.ok(h.find('#study-save-conflict'));
  h.run('renderCogHome()');h.click('#gen-reset');assert.equal(h.find('.cog-reset-confirm'),null);assert.equal(h.run('COG.answered'),1);assert.equal(h.run('StudyStorage.recovery().records[COG_KEY].thisTab.answered'),1);
  h.fail=()=>false;await h.recover();h.run('renderCogHome()');h.click('#gen-reset');assert.ok(h.find('.cog-reset-confirm'));assert.equal(h.state().answered,1);h.click('#cog-reset-confirm');assert.equal(h.state().answered,0);h.close();
});
test('the quick recall clock persists deadlines, pauses on leave, and expires after an ungraceful reload',()=>{
  const h=harness();h.start('blitz');h.time+=12000;h.click('#cog-quit');const paused=h.state().practice;assert.equal(paused.remainingMs,78000);assert.equal(paused.deadline,null);
  h.time+=3600000;h.click('#cog-practice-resume');assert.equal(h.state().practice.remainingMs,78000);const before=h.seed();const h2=harness(before,h.time+80000);h2.run('cogRunQuestion(COG.practice)');assert.ok(h2.state().practice.completedAt);assert.equal(h2.state().practice.remainingMs,0);assert.equal(h2.state().answered,0);h.close();h2.close();
});
test('hidden pages pause the clock and detached automatic advances cannot change the resumed session',()=>{
  const h=harness();h.start('blitz');const oldTimer=[...h.timers.values()][0];h.choose();const stale=[...h.timeouts.values()][0];oldTimer();assert.equal(h.timers.size,1,'An old interval cannot stop the current question clock');h.time+=9000;Object.defineProperty(h.w.document,'hidden',{value:true,configurable:true});h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));
  assert.equal(h.state().practice.remainingMs,81000);assert.equal(h.timers.size,0);const idx=h.state().practice.idx;stale();assert.equal(h.state().practice.idx,idx);
  h.click('#cog-practice-resume');stale();assert.equal(h.state().practice.idx,idx);h.close();
});
test('scratchpad quota recovery preserves the newest text and stopped quick recall time',async()=>{
  const h=harness();h.start('blitz');h.click('#gen-tools-toggle');h.time+=7000;h.fail=(k,v)=>k===KEY&&v.practice.scratch==='Unsaved work';h.input('#gen-pad-area','Unsaved work');
  assert.equal(h.state().practice.scratch,'');h.time+=10000;h.fail=()=>false;await h.recover();assert.equal(h.state().practice.scratch,'Unsaved work');assert.equal(h.state().practice.remainingMs,83000);assert.equal(h.find('#gen-pad-area').value,'Unsaved work');h.close();
});
test('account changes, newer saved work and detached handlers cannot overwrite the current workspace',()=>{
  for(const kind of ['owner','newer','detached']){
    const h=harness();h.start();const button=h.find('.gen-opt'),original=h.raw();
    if(kind==='owner')h.force(Progress.OWNER,JSON.stringify({id:'B',token:'other'}));else if(kind==='newer')h.force(KEY,JSON.stringify({answered:99}));else h.run('renderCogHome()');
    const before=h.raw();button.click();assert.equal(h.raw(),before);assert.equal(h.run('COG.answered'),0);if(kind!=='detached')assert.ok(h.find('#study-save-conflict'));else assert.equal(before,original);h.close();
  }
});
test('invalid sessions are retained for recovery rather than reset, and result controls reject stale views',()=>{
  const good=harness();good.start();const saved=good.state();good.close();
  for(const mutate of [s=>s.practice.current.order=[0,0,2,3],s=>s.practice.current.selected=8,s=>s.practice.remainingMs=-1,s=>s.practice.scratch=null,s=>s.practice.current.question.svg='<svg></svg>']){
    const value=structuredClone(saved);mutate(value);const raw=JSON.stringify(value),h=harness({[KEY]:raw});assert.ok(h.find('#study-save-conflict'));assert.equal(h.raw(),raw);h.close();
  }
  const h=harness();h.start();h.choose();h.click('#gen-next');const old=h.find('#gen-again');h.click('#gen-homebtn');old.click();assert.equal(h.state().plays,1);h.close();
});
test('scoped reset supports cancel and Escape, retains other records, and recovers a failed write',async()=>{
  const h=harness({'cs-cogpsych-research-v1':'{"synthetic":"keep research"}','cs-academy-anatomy-v1':'{"lessons":{}}'});
  h.start();h.choose();h.run('renderCogHome()');const before=h.raw(),other=h.storage.getItem('cs-cogpsych-research-v1');
  h.click('#gen-reset');assert.equal(h.w.document.activeElement.id,'cog-reset-keep');assert.match(h.find('#cog-reset-scope').textContent,/Research investigations and other courses stay saved/);
  h.click('#cog-reset-keep');assert.equal(h.raw(),before);assert.equal(h.w.document.activeElement.id,'gen-reset');
  h.click('#gen-reset');h.find('dialog').dispatchEvent(new h.w.Event('cancel',{cancelable:true}));assert.equal(h.find('.cog-reset-confirm'),null);assert.equal(h.raw(),before);
  h.click('#gen-reset');h.fail=(k,v)=>k===KEY&&v.answered===0;h.click('#cog-reset-confirm');assert.ok(h.find('#study-save-conflict'));assert.equal(h.raw(),before);
  h.fail=()=>false;await h.recover();assert.equal(h.state().answered,0);assert.equal(h.state().practice,undefined);assert.equal(h.storage.getItem('cs-cogpsych-research-v1'),other);assert.equal(h.storage.getItem('cs-academy-anatomy-v1'),'{"lessons":{}}');h.close();
});
test('a reset confirmation cannot erase a changed account, a newer saved copy or a detached view',()=>{
  for(const kind of ['owner','newer','detached']){
    const h=harness();h.start();h.choose();h.run('renderCogHome()');h.click('#gen-reset');const button=h.find('#cog-reset-confirm');
    if(kind==='owner')h.force(Progress.OWNER,JSON.stringify({id:'B',token:'other'}));else if(kind==='newer')h.force(KEY,JSON.stringify({answered:99}));else h.run('renderCogHome()');
    const raw=h.raw();button.click();assert.equal(h.raw(),raw);assert.equal(h.run('COG.answered'),1);h.close();
  }
});
