const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const Core = require('../academy-portfolio-core.js'), Backup = require('../study-backup.js'), crypto = require('node:crypto').webcrypto;
const read = path => JSON.parse(fs.readFileSync(path)), clone = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const anatomy = read('data/anatomy-foundations.json').lessons[0], medicine = read('data/medicine-foundations.json').lessons[0];
  const psych = read('data/cogpsych-learn.json')[0], project = read('data/neuro-projects.json').projects[0];
  const a = (content, steps) => ({ content, startedAt: 100, completedAt: 200, steps });
  const data = {
    'cs-mcat-course-v1': {units:{mcat1:{completedAt:200,notes:'My current MCAT note',attempts:[{qId:'first',kind:'check',chosen:0,correct:false,ts:100,confidence:'unsure',questionSnapshot:{stem:'Original MCAT wording',options:['first','second']}},{qId:'later',kind:'delayed',chosen:1,correct:true,ts:86400200,questionSnapshot:{stem:'A different delayed question',options:['first','second']}}],help:{first:{questionSnapshot:{options:['helpA','helpB']},chosen:1}},privateExtra:'MCAT_PRIVATE_EXTRA'}}},
    'cs-ltl-progress-v1': {general:{lessons:{ltl1:{revision:1,completedAt:'2026-09-07T10:00:00Z',steps:{practice:{content:{prompt:'A learning strategy'},draft:'Original LTL writing',revealedAt:'2026-09-07T09:00:00Z'}}}}}},
    'cs-cogpsych': {lessons:{[psych.id]:a(psych,{ask:{content:{prompt:'<b>Psych prompt</b>'},draft:'Psych writing',revealedAt:130}})},privateExtra:'PSYCH_PRIVATE_EXTRA'},
    'cs-academy-anatomy-v1':{lessons:{[anatomy.id]:a(anatomy,{reflect:{content:{prompt:'Anatomy prompt'},firstDraft:'Original anatomy',draft:'Original anatomy',revealedAt:130,comparison:'Later anatomy comparison'}})}},
    'cs-academy-reference-v1':{lessons:{[medicine.id]:a(medicine,{reflect:{content:{prompt:'Medicine prompt'},draft:'Medicine draft'}})}},
    'cs-clinical-shift-v1':{active:{runId:'shift1',startedAt:100,completedAt:200,content:{revision:1,caseData:{title:'Fictional shift'}},differential:{rationale:'First differential',lockedAt:110},note:{assessment:'My assessment',plan:'My plan',revealedAt:150}}},
    'cs-neuro':{projects:{[project.id]:{current:{runId:'project1',content:project,startedAt:100,completedAt:200,firstPrediction:{text:'First engineering prediction'},draft:'def f(x):\n return x<2',attempts:[{draft:'def f(x):\n return x<2',status:'done',assisted:true,result:{passed:true}}],memo:{result:'My result',limitation:'My limitation',next:'My next test'}},history:[]}},privateExtra:'NEURO_PRIVATE_EXTRA'},
    'sb-auth-token':{access_token:'SECRET_AUTH'},'cs-unrelated':{secret:'UNRELATED_RECORD'},'cortex-other-owner':{secret:'OTHER_OWNER'},
  };
  return Object.fromEntries(Object.entries(data).map(([k,v])=>[k,JSON.stringify(v)]));
}
test('seven tracks produce selected evidence without importing unrelated records or current catalog wording', () => {
  const data=fixture(), before=clone(data), result=Core.candidates(data);
  assert.equal(result.unavailable.length,0);assert.equal(new Set(result.items.map(a=>a.track)).size,7);
  assert.equal(result.items.length,7);assert.deepEqual(data,before);
  const text=JSON.stringify(result);for(const secret of ['SECRET_AUTH','UNRELATED_RECORD','OTHER_OWNER','PRIVATE_EXTRA'])assert.ok(!text.includes(secret));
  assert.ok(text.includes('Original MCAT wording'));assert.ok(text.includes('Independent content review not established'));
  const mcat=result.items.find(a=>a.track==='mcat');assert.ok(mcat.evidence.some(e=>e.label.startsWith('Delayed application')));
  assert.ok(mcat.evidence.some(e=>e.role==='assistance'&&e.text.includes('after this answer')));
});
test('selected snapshots and append-only reflections preserve original writing through course revisions',()=>{
  const source=Core.candidates(fixture()).items.find(a=>a.track==='anatomy'), state=Core.empty();
  assert.equal(Core.add(state,source,1000),true);const original=clone(state.entries[0].source);
  source.evidence[0].text='Later course wording';assert.deepEqual(state.entries[0].source,original);
  assert.equal(Core.add(state,source),false);const e=state.entries[0];e.draft='Reconsidered explanation';assert.equal(Core.revise(e,'used',2000),true);
  e.draft='Another revision';Core.revise(e,'unknown',3000);assert.equal(e.revisions[0].text,'Reconsidered explanation');assert.deepEqual(e.source,original);Core.validate(state);
});
test('export requires exact visible selection, drops drafts and unknown keys and never infers unaided mastery',()=>{
  const state=Core.empty();for(const item of Core.candidates(fixture()).items)Core.add(state,item,1000);
  assert.throws(()=>Core.exportFile(state,[]));assert.throws(()=>Core.exportFile(state,['missing']));
  const e=state.entries.find(e=>e.source.track==='neuro');e.draft='UNRECORDED_PORTFOLIO_DRAFT';e.secret='SECRET_ENTRY';e.source.secret='SECRET_SOURCE';
  const exported=Core.exportFile(state,[e.id],2000), file=JSON.parse(exported);assert.equal(file.entries.length,1);
  for(const secret of ['UNRECORDED_PORTFOLIO_DRAFT','SECRET_ENTRY','SECRET_SOURCE','MCAT wording'])assert.ok(!exported.includes(secret));
  assert.ok(exported.includes('not accreditation'));assert.ok(exported.includes('In-app reference was opened'));
  e.hiddenAt=2100;assert.throws(()=>Core.exportFile(state,[e.id]));e.hiddenAt=null;assert.equal(JSON.parse(Core.exportFile(state,[e.id])).entries.length,1);
});
test('malformed and legacy records remain intact and do not become fabricated learning evidence',()=>{
  const data=fixture();data['cs-neuro']='{broken';data['cs-cogpsych']=JSON.stringify({lessons:{bad:null}});
  data['cs-mcat-course-v1']=JSON.stringify({units:{legacy:{attempts:[{qId:'old',chosen:1,correct:false,ts:2}]}}});
  const before=clone(data), result=Core.candidates(data);assert.deepEqual(data,before);assert.ok(result.unavailable.length>=2);
  assert.ok(result.items.find(i=>i.track==='mcat').evidence.some(e=>e.text.includes('not saved')));
  const source=Core.candidates(fixture()).items[0];source.provenance.contentReview={token:'secret'};assert.throws(()=>Core.validateArtifact(source));
});
test('timeline records contain only presented checkpoints and learner writing, not unopened future models',()=>{
  const c=read('data/clinical-longitudinal.json').cases[0], node=c.nodes.find(n=>n.id===c.start);
  const run={runId:'timeline1',caseData:c,startedAt:100,completedAt:null,records:[{nodeId:node.id,choice:node.options[0].id,reason:{hypothesis:'My hypothesis',alternative:'My alternative',evidence:'My evidence'}}],handoff:null,comparison:''};
  const result=Core.candidates({'cs-clinical-longitudinal-v1':JSON.stringify({active:run,history:[]})});assert.equal(result.items.length,1);
  const output=JSON.stringify(result.items[0]);assert.ok(output.includes('My hypothesis'));assert.ok(output.includes(node.observation));
  assert.ok(!output.includes(c.nodes.find(n=>n.kind==='handoff').model.assessment));
});
test('portfolio backups preserve angle brackets as plain text while unrelated HTML remains restricted',async()=>{
  const state=Core.empty();Core.add(state,Core.candidates(fixture()).items.find(i=>i.track==='neuro'));state.entries[0].draft='<script>literal writing</script>';
  const raw={[Core.KEY]:JSON.stringify(state)}, file=await Backup.create(raw,'local',{crypto});assert.deepEqual((await Backup.parse(file,{crypto})).data,raw);
  await assert.rejects(()=>Backup.create({'cs-cogpsych':JSON.stringify({malicious:'<script>execute</script>'})},'local',{crypto}),/HTML/);
});
module.exports={fixture};
