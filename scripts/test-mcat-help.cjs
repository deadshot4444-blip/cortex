const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Core=require('../mcat-course-engine.js'),Backup=require('../study-backup.js'),Portfolio=require('../academy-portfolio-core.js');
const data=JSON.parse(fs.readFileSync('data/mcat-course.json','utf8')),clone=x=>JSON.parse(JSON.stringify(x));
const units=data.units.filter(u=>u.authoredHelp);
function sample(unit=units[0]){
  const state=Core.normalize({}),q=unit.questions.find(q=>q.kind==='check'&&(!unit.authoredHelp||unit.authoredHelp.questionIds.includes(q.id)));
  const answer=Core.answer(state,unit,q,(q.answer+1)%q.options.length,'sure',100);
  return {state,q,answer,help:()=>Core.openHelp(state,unit,q.id,200)};
}
test('only the three intended lessons have valid, bounded authored help',()=>{
  assert.deepEqual(units.map(u=>u.id),['protein-structure','enzyme-rates','membrane-transport']);
  for(const u of units){assert.ok(Core.validHelpContent(u.authoredHelp,u.id));assert.equal(Core.validHelpContent(u.authoredHelp,'out-of-scope'),false);for(const id of u.authoredHelp.questionIds)assert.ok(u.questions.some(q=>q.id===id&&q.kind!=='diagnostic'));}
  const u=units[2],s=Core.normalize({}),q=u.questions.find(q=>q.id==='membrane-transport-2');Core.answer(s,u,q,0,'sure',100);
  assert.equal(Core.openHelp(s,u,q.id,200).guide,undefined,'Osmosis hints are not offered for a coupled-transport question');
});
test('help requires the original answer; early or unanswered later questions do not retrieve it',()=>{
  const s=sample(),u=units[0],before=JSON.stringify(s.state.units[u.id].attempts);
  assert.equal(Core.openHelp(s.state,u,u.questions.find(q=>q.kind==='delayed').id,200),null);
  assert.equal(Core.openHelp(s.state,u,s.q.id,99),null);
  assert.equal(Core.openHelp(Core.normalize({}),u,s.q.id,200),null);
  assert.equal(JSON.stringify(s.state.units[u.id].attempts),before);
});
test('all three guides preserve first writing, opened stages and the original answer independently',()=>{
  for(const unit of units){
    const s=sample(unit),original=JSON.stringify(s.answer),g=s.help().guide;g.draft='My first distinction';
    assert.ok(Core.revealHelp(g,201));g.draft='A later draft';g.reflection='Changed after seeing the hint';
    assert.ok(Core.revealHelp(g,202));assert.equal(Core.revealHelp(g,203),false);
    assert.deepEqual(g.firstNote,{text:'My first distinction',recordedAt:201});assert.deepEqual(g.reveals,[201,202]);
    assert.equal(JSON.stringify(s.answer),original);assert.deepEqual(Core.metrics(data,s.state).first,{correct:0,total:1});
  }
});
test('saved guidance survives source revisions and never copies unrelated private or future-question fields',()=>{
  const unit=clone(units[0]);unit.authoredHelp.privateNote='SECRET';unit.authoredHelp.stages[0].answerKey='FUTURE_KEY';
  const s=sample(unit),g=s.help().guide,before=JSON.stringify(g.content);unit.authoredHelp.stages[0].text='Changed';
  assert.equal(JSON.stringify(s.help().guide.content),before);
  assert.ok(!JSON.stringify(g).includes('SECRET'));assert.ok(!JSON.stringify(g).includes('FUTURE_KEY'));assert.equal(g.content.questions,undefined);
  for(const q of unit.questions.filter(q=>q.kind==='delayed'))assert.ok(!JSON.stringify(g).includes(q.stem));
});
test('wrong source links, malformed stages, unsupported versions and conflicting guide identity are rejected',()=>{
  for(const change of [c=>c.source.url='javascript:alert(1)',c=>c.source.url='https://openstax.org.evil.test/book',c=>c.version=2,c=>c.stages[0].text=null,c=>c.stages.push(c.stages[0])]){
    const c=clone(units[0].authoredHelp);change(c);assert.equal(Core.validHelpContent(c,units[0].id),false);
  }
  const s=sample(),g=s.help().guide;assert.equal(Core.validHelpGuide(g,units[0].id,'another-question'),false);
  g.reveals=[199];assert.equal(Core.revealHelp(g,201),false);g.reveals=[];g.openedAt=NaN;assert.equal(Core.revealHelp(g,201),false);
});
test('legacy supported checks retain their saved question, choice and timestamp',()=>{
  const s=sample(),legacy={questionSnapshot:Core.snapshot(units[0].questions[0]),chosen:1,answeredAt:150};
  s.state.units[units[0].id].help={[s.q.id]:clone(legacy)};const help=s.help();
  for(const key of Object.keys(legacy))assert.deepEqual(help[key],legacy[key]);assert.ok(help.guide);
  const unsupported=sample(data.units[4]);assert.equal(unsupported.help().guide,undefined);
});
test('all seven scoped mistakes get a separate support question and never borrow an upcoming application',()=>{
  let count=0;
  for(const unit of units)for(const id of unit.authoredHelp.questionIds){
    const q=unit.questions.find(q=>q.id===id),state=Core.normalize({});
    Core.record(state,unit.id).attempts.push({qId:id,kind:q.kind,chosen:(q.answer+1)%q.options.length,correct:false,ts:100,questionSnapshot:Core.snapshot(q)});
    const before=JSON.stringify(state.units[unit.id].attempts),help=Core.openHelp(state,unit,id,200);
    assert.equal(help.questionSnapshot.kind,'support');assert.equal(help.questionSnapshot.id,id+'-help');
    assert.deepEqual(help.questionSnapshot,Core.snapshot(unit.authoredHelp.checks[id]));
    for(const other of unit.questions)assert.notEqual(help.questionSnapshot.stem,other.stem);
    unit.authoredHelp.checks[id].privateNote='PRIVATE';
    assert.ok(!JSON.stringify(help).includes('PRIVATE'));delete unit.authoredHelp.checks[id].privateNote;
    assert.equal(JSON.stringify(state.units[unit.id].attempts),before);count++;
  }
  assert.equal(count,7);
});
test('support selection rejects out-of-scope or malformed catalog checks and keeps saved versions',()=>{
  for(const change of [c=>c.kind='delayed',c=>c.id='wrong-help',c=>c.answer=9,c=>c.options=[],c=>c.stem=null]){
    const unit=clone(units[2]),id=unit.authoredHelp.questionIds[0];change(unit.authoredHelp.checks[id]);
    assert.equal(Core.helpQuestion(unit,id).kind,'diagnostic');
  }
  const unit=clone(units[2]),s=sample(unit),help=s.help(),before=clone(help.questionSnapshot);
  unit.authoredHelp.checks[s.q.id].stem='Revised later';assert.deepEqual(s.help().questionSnapshot,before);
  const excluded=unit.questions.find(q=>q.id==='membrane-transport-2');unit.authoredHelp.checks[excluded.id]={...before,id:excluded.id+'-help'};
  assert.equal(Core.helpQuestion(unit,excluded.id).kind,'diagnostic');
});
test('help notes round-trip as inert text; source protocols and unrelated markup checks remain enforced',async()=>{
  const s=sample();s.help().guide.draft='<img src=x onerror=bad> [S]<Km';
  const source={'cs-mcat-course-v1':JSON.stringify(s.state)},options={crypto:require('node:crypto').webcrypto};
  assert.deepEqual((await Backup.parse(await Backup.create(source,'local',options),options)).data,source);
  s.help().guide.content.source.url='javascript:alert(1)';await assert.rejects(Backup.create({'cs-mcat-course-v1':JSON.stringify(s.state)},'local',options),/source link/);
  await assert.rejects(Backup.create({'cs-cogpsych':'{"html":"<img src=x>"}'},'local',options),/HTML/);
});
test('selected portfolio evidence distinguishes first note, displayed assistance and later reflection',()=>{
  const s=sample(),g=s.help().guide;g.draft='Before hints';Core.revealHelp(g,201);g.reflection='After hints';
  const result=Portfolio.candidates({'cs-mcat-course-v1':JSON.stringify(s.state)});assert.equal(result.unavailable.length,0);
  const fields=result.items[0].evidence;assert.ok(fields.some(f=>f.role==='original'&&f.text==='Before hints'));assert.ok(fields.some(f=>f.role==='revision'&&f.text==='After hints'));
  assert.ok(fields.some(f=>f.role==='assistance'&&f.text.includes(g.content.stages[0].text)));
  assert.ok(!fields.some(f=>f.text.includes(g.content.stages[1].text)));
});
