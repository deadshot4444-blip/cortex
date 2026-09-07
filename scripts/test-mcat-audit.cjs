const assert=require('node:assert/strict');
const core=require('../mcat-v2-engine.js');
let failures=0;
function test(name,fn){try{fn();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.message);}}
const now=new Date(2026,8,7,9).getTime(),start=core.dateKey(new Date(now));
const input=()=>({now,start,units:[],records:{},coaches:[]});
const state=()=>core.normalize({weekly:{availability:[30,30,30,30,30,30,30]}});
test('A completed exam review remains visible and consumes its 20-minute reservation',()=>{
  const s=state();s.weekly.exams=[{id:'exam',name:'Practice',date:core.addDays(start,-1),minutes:120,reviewedAt:now}];
  const today=core.week(s,input())[0],review=today.tasks.find(t=>t.type==='externalReview');
  assert.ok(review?.done);assert.equal(review.minutes,20);assert.ok(today.tasks.reduce((n,t)=>n+t.minutes,0)<=30);
  assert.equal(core.week(s,input()).flatMap(d=>d.tasks).filter(t=>t.type==='externalReview').length,1);
});
test('An earlier completion of the same skill does not hide a new saved activity',()=>{
  const s=state();s.weekly.active={id:'math:units',type:'math',key:'units',title:'My saved attempt',minutes:20,day:start};
  s.weekly.done.previous={...s.weekly.active,day:core.addDays(start,-1)};
  assert.equal(core.week(s,input())[0].tasks[0].title,'My saved attempt');
});
test('Later checks only enter Today after the actual unlock time',()=>{
  const s=state(),i=input();i.units=[{id:'unit',title:'Unit',section:'chemPhys'}];i.records.unit={completedAt:now-86400000,dueAt:now+8*3600000};
  let days=core.week(s,i);assert.equal(days[0].tasks.some(t=>t.kind==='delayed'),false);
  assert.ok(days.slice(1).some(d=>d.tasks.some(t=>t.kind==='delayed')));
  days=core.week(s,{...i,now:now+8*3600000});assert.ok(days[0].tasks.some(t=>t.kind==='delayed'));
});
// Evaluate the rendered notation/log choices, not just their different strings.
function evaluate(text){const expression=text.replaceAll('−','-').replaceAll('×','*').replaceAll('÷','/').replaceAll('^','**').replace(/log₁₀(\d+)/g,'Math.log10($1)');assert.match(expression,/^[\d\s+*/().\-Mathlog]+$/);return Function('return '+expression)();}
test('Every notation and logarithm variant has exactly one numerically correct setup',()=>{
  for(const skill of ['notation','logs'])for(let v=0;v<8;v++){
    const q=core.quant(skill,v),matches=q.setups.map(evaluate).map(x=>Math.abs(x-q.value)<1e-5);
    assert.equal(matches.filter(Boolean).length,1,q.id);assert.equal(matches[q.answer],true,q.id);
  }
});
test('Interrupted passage exposure counts, but unseen exam queue entries do not',()=>{
  const p={id:'p',questions:[{id:'p1'},{id:'p2'}]},item={passageId:'p',q:{id:'p1'}};
  assert.deepEqual(core.priorQuestionIds(p,{resumes:{cars:{p}}}),['p1','p2']);
  const sim={queue:[{items:[{q:{id:'other'}},item]}],si:0,idx:0,answers:{},flags:{}};
  assert.deepEqual(core.priorQuestionIds(p,{resumes:{sim}}),[]);
  sim.seen=['0:1'];assert.deepEqual(core.priorQuestionIds(p,{resumes:{sim}}),['p1','p2']);
  delete sim.seen;sim.answers['0:1']=0;assert.deepEqual(core.priorQuestionIds(p,{resumes:{sim}}),['p1','p2']);
});
process.exitCode=failures?1:0;
