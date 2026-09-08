const assert=require('node:assert/strict');
const fs=require('node:fs');const core=require('../mcat-course-engine.js');
const data=JSON.parse(fs.readFileSync('data/mcat-course.json','utf8'));
assert.equal(data.units.length,45);assert.equal(data.categories.length,34);assert.equal(new Set(data.categories.map(c=>c.id)).size,34);
const cards=new Set(JSON.parse(fs.readFileSync('data/mcat-cards.json')).map(c=>c.id));
const passages=JSON.parse(fs.readFileSync('data/mcat-science-passages.json'));
const qs=new Set([...JSON.parse(fs.readFileSync('data/mcat-questions.json')),...JSON.parse(fs.readFileSync('data/mcat-cars.json')).flatMap(p=>p.questions),...passages.flatMap(p=>p.questions)].map(q=>q.id));
for(const u of data.units){assert.equal(u.questions.length,6);assert.equal(u.questions[0].kind,'diagnostic');assert.equal(u.questions.at(-1).kind,'delayed');for(const q of u.questions){assert.equal(q.options.length,4);assert.ok(q.answer>=0&&q.answer<4);assert.ok(q.explanation.length>30);}for(const id of u.cards)assert.ok(cards.has(id),id);for(const id of u.questionIds)assert.ok(qs.has(id),id);for(const id of u.passages)assert.ok(passages.some(p=>p.id===id),id);for(const id of u.prerequisites)assert.ok(data.units.some(x=>x.id===id));}
let s=core.normalize({});const u=data.units[0],now=1000000,r=core.record(s,u.id);
assert.equal(core.complete(s,u,now),false);r.learnedAt=now;r.exploredAt=now;
const checks=u.questions.filter(q=>q.kind==='check');
core.answer(s,u,checks[0],(checks[0].answer+1)%4,'sure',now);core.answer(s,u,checks[0],checks[0].answer,'sure',now+1);
assert.equal(r.attempts.length,1);assert.equal(r.attempts[0].correct,false);assert.equal(core.complete(s,u,now),false);
core.answer(s,u,checks[1],checks[1].answer,'unsure',now);assert.ok(core.complete(s,u,now));assert.equal(r.dueAt,now+core.DAY);
assert.equal(core.answer(s,u,u.questions[3],u.questions[3].answer,'sure',now+core.DAY-1),null);
assert.equal(core.recommendation(data,s,[],now+core.DAY).kind,'delayed');
assert.ok(core.answer(s,u,u.questions[3],u.questions[3].answer,'sure',now+core.DAY));assert.equal(r.dueAt,now+core.DAY*4);
core.answer(s,u,u.questions[3],0,'guess',now+core.DAY*3);assert.equal(r.attempts.length,3);core.complete(s,u,now+core.DAY*3);assert.equal(r.dueAt,now+core.DAY*4);
assert.deepEqual(core.metrics(data,s).first,{correct:1,total:2});assert.deepEqual(core.metrics(data,s).delayed,{correct:1,total:1});
s=core.normalize({placement:{answers:{'enzyme-rates':{chosen:1,correct:false,confidence:'sure'}},background:{}}});assert.equal(core.recommendation(data,s,[],now).unit.id,'protein-structure','A miss cannot skip the prerequisite');
assert.match(core.recommendation(data,s,[],now).reason,/builds on/);core.record(s,'protein-structure').completedAt=now;
assert.equal(core.recommendation(data,s,[],now).unit.id,'enzyme-rates','The intended focus becomes available after its foundation');
s.preferredUnit='buffer-balance';assert.equal(core.recommendation(data,s,[],now).unit.id,'buffer-balance');
s.activeUnit='circuit-paths';assert.equal(core.recommendation(data,s,[],now).kind,'resume');
s=core.normalize({placement:{answers:{'enzyme-rates':{chosen:null,correct:null}}}});assert.equal(core.recommendation(data,s,[],now).unit.id,'protein-structure');
console.log('Course content, references, immutable first answers, completion, delayed gating, and recommendation checks passed.');

s=core.normalize({});const revisitRecord=core.record(s,u.id);revisitRecord.completedAt=now;assert.equal(core.recommendation(data,s,[{qId:u.questionIds[0],correct:false,ts:now+1}],now+2).kind,'review');revisitRecord.reviewedAt=now+3;assert.notEqual(core.recommendation(data,s,[{qId:u.questionIds[0],correct:false,ts:now+1}],now+4).kind,'review');console.log('Recent misses can revisit completed lessons without creating new completion or answer evidence.');
