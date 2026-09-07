const assert=require('node:assert/strict'),fs=require('node:fs');
const course=require('../mcat-course-engine.js'),v2=require('../mcat-v2-engine.js');
const data=JSON.parse(fs.readFileSync('data/mcat-course.json')),cars=JSON.parse(fs.readFileSync('data/mcat-cars.json'));
let checks=0;function test(name,fn){fn();checks++;console.log('PASS',name);}
test('Revised items have four distinct options, stable IDs/keys and preserved prior wording',()=>{
 const revised=data.units.flatMap(u=>u.questions).filter(q=>q.revision===2);assert.equal(revised.length,150);
 for(const q of revised){assert.equal(new Set(q.options).size,4,q.id);assert.equal(q.answer,q.previousVersion.answer,q.id);assert.equal(q.id,q.previousVersion.id);assert.equal(q.kind,q.previousVersion.kind);assert.ok(q.explanation.length>70,q.id);assert.equal(q.previousVersion.options.length,4);}
});
test('Old answers and drafts resolve to old wording without changing their stored result',()=>{
 const q=data.units.find(u=>u.id==='memory-retrieval').questions[0];
 const old={qId:q.id,chosen:2,correct:false,ts:1},before=JSON.stringify(old);
 assert.equal(course.questionForRecord(q,old).options[2],'A spinal reflex');assert.equal(JSON.stringify(old),before);
 assert.equal(course.questionForRecord(q,{qId:q.id,chosen:2}).stem,q.previousVersion.stem);
 assert.equal(course.questionForRecord(q,null),q);
});
test('New answer snapshots preserve shown content even through future edits',()=>{
 const u=data.units.find(u=>u.id==='memory-retrieval'),q=u.questions.find(q=>q.kind==='check'),s=course.normalize({});
 const a=course.answer(s,u,q,q.answer,'sure',10),saved=JSON.stringify(a);
 const later={...q,options:['new 0','new 1','new 2','new 3'],explanation:'Rewritten later'};
 assert.equal(course.questionForRecord(later,a).options[q.answer],q.options[q.answer]);
 assert.equal(course.questionForRecord(later,a).explanation,q.explanation);
 assert.equal(course.answer(s,u,later,0,'guess',20),a);assert.equal(JSON.stringify(a),saved);
 const snap=course.snapshot(q);snap.options[0]='changed copy';assert.notEqual(q.options[0],snap.options[0]);
});
test('h2 uses all four displayed positions without changing its canonical key',()=>{
 const p=cars.find(p=>p.id==='h2'),counts=[0,0,0,0];
 for(const q of p.questions){const order=v2.optionOrder(q.options,q.displayOrder);assert.equal(q.answer,1);assert.deepEqual([...order].sort(),[0,1,2,3]);counts[order.indexOf(q.answer)]++;assert.equal(v2.optionLabel(q,q.answer),'ABCD'[order.indexOf(q.answer)]);assert.doesNotMatch(q.explanation,/\b[ABCD] (?:is|captures|states|overreaches|misreads|reverses|fails|inverts|fixates|reduces|smuggles)|matching [ABCD]\b/);}
 assert.ok(counts.every(n=>n>=1&&n<=2));
});
test('Legacy and malformed display orders fall back safely, including unanswered labels',()=>{
 for(const order of [undefined,null,[1,1,2,3],[4,1,2,3],['0',1,2,3],[0,1]])assert.deepEqual(v2.optionOrder(['a','b','c','d'],order),[0,1,2,3]);
 assert.equal(v2.optionLabel({options:['a','b','c','d']},1),'B');assert.equal(v2.optionLabel({options:['a','b']},null),'—');
});
console.log(`${checks} question quality and compatibility checks passed.`);
