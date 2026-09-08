/* Reviewable wording history against the explicitly recorded local-work baseline. */
const fs=require('node:fs'),{spawnSync}=require('node:child_process'),crypto=require('node:crypto').webcrypto;
const Core=require('../mcat-item-quality-core.js');
const BASE='9bbd1dd6149ce0a7f9b89b95dee96a107031ef02';
const files=['mcat-questions','mcat-science-passages','mcat-cars','mcat-course','mcat-cars-path','mcat-math-transfer'];
function inventory(load){
  const map=new Map();
  function add(file,q,parent='',context=null){
    const question=Core.question(q);if(!question)throw Error('Invalid item '+file+' '+q?.id);
    const key=file+'::'+parent+'::'+q.id;if(map.has(key))throw Error('Duplicate item '+key);
    map.set(key,{key,source:'data/'+file+'.json',parent,itemId:q.id,question,context:Core.savedContext(context)});
  }
  for(const file of files){const d=load(file);if(!d)continue;
    if(file==='mcat-questions')d.forEach(q=>add(file,q));
    if(['mcat-science-passages','mcat-cars'].includes(file))d.forEach(p=>p.questions.forEach(q=>add(file,q,p.id,p)));
    if(file==='mcat-course')d.units.forEach(u=>u.questions.forEach(q=>add(file,q,u.id)));
    if(file==='mcat-cars-path')d.coaches.filter(c=>c.passage).forEach(c=>c.passage.questions.forEach(q=>add(file,q,c.passage.id,c.passage)));
    if(file==='mcat-math-transfer')d.items.forEach(q=>add(file,{...q,options:q.setups},'',{numericTarget:q.value,table:q.table,graph:q.graph}));
  }
  return map;
}
(async()=>{
  const baseline=inventory(file=>{const r=spawnSync('git',['show',BASE+':data/'+file+'.json'],{encoding:'utf8',maxBuffer:10000000});
    if(r.status!==0){if(/does not exist in|exists on disk, but not in/.test(r.stderr))return null;throw Error(r.stderr);}return JSON.parse(r.stdout);});
  const current=inventory(file=>JSON.parse(fs.readFileSync('data/'+file+'.json'))),entries=[];
  for(const key of [...new Set([...baseline.keys(),...current.keys()])].sort()){
    const before=baseline.get(key),after=current.get(key),hash=async item=>item?Core.digest({question:item.question,context:item.context},crypto):null;
    const previousHash=await hash(before),currentHash=await hash(after),change=!before?'added':!after?'removed-from-current-source':previousHash===currentHash?'unchanged':'revised';
    entries.push({key,source:(after||before).source,itemId:(after||before).itemId,change,previousHash,currentHash,
      independentReview:'pending; this comparison does not approve either wording',before:before?{question:before.question,context:before.context}:null,after:after?{question:after.question,context:after.context}:null});
  }
  const counts=Object.fromEntries(['added','revised','removed-from-current-source','unchanged'].map(k=>[k,entries.filter(e=>e.change===k).length]));
  const report={scope:'Authored content history only. No learner data, item calibration or independent reviewer signoff.',baselineCommit:BASE,currentTree:'uncommitted local workspace',counts,entries};
  console.log(JSON.stringify(process.argv.includes('--json')?report:{baselineCommit:BASE,...counts,currentItems:current.size},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
