const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=JSON.parse(fs.readFileSync('data/medicine-path.json'));
const source=fs.readFileSync('reference.js','utf8');
const saved=new Map([['cs-pharm',JSON.stringify({learned:{'legacy-drug':1234},drill:{correct:4,total:7},learnResume:{legacy:{index:2}}})]]);
let invalid=0,canSave=true,blocked='micro';const requests=[];
const context=vm.createContext({console,Date,Math,JSON,Set,
  StudyStorage:{read:(key,fallback)=>saved.has(key)?JSON.parse(saved.get(key)):fallback,watch(){},sessionFailed(){invalid++;},
    write(key,value){if(!canSave)return false;saved.set(key,JSON.stringify(value));return true;}},
  window:{},fetch:async file=>{requests.push(file);return {ok:!file.includes(blocked),json:async()=>file.includes('medicine-path')?path:JSON.parse(fs.readFileSync(file.split('?')[0]))};}});
vm.runInContext(source,context);const run=code=>vm.runInContext(code,context);
(async()=>{
  assert.equal(run('PHARM_PROG.learned["legacy-drug"]'),1234);
  assert.equal(run('PHARM_PROG.drill.total'),7);
  assert.equal(run('PHARM_PROG.learnResume.legacy.index'),2);
  assert.equal(invalid,0);
  const before=saved.get('cs-pharm');canSave=false;run('PHARM_PROG.learnResume.legacy.index=3;');assert.equal(run('savePharmProg()'),false);assert.equal(saved.get('cs-pharm'),before);
  canSave=true;assert.equal(run('savePharmProg()'),true);assert.equal(JSON.parse(saved.get('cs-pharm')).learnResume.legacy.index,3);
  await assert.rejects(run('loadRef()'),/micro reference did not download/);
  assert.equal(run('REF.loaded'),false);assert.ok(run('REF.pharm.length>0 && REF.labs.length>0'));assert.equal(run('REF.micro'),null);
  const oldCount=requests.length;blocked='none';await run('loadRef()');assert.deepEqual(requests.slice(oldCount),['data/micro.json']);assert.equal(run('REF.loaded'),true);
  blocked='medicine-path';await assert.rejects(run('loadMedPath()'),/did not download/);assert.equal(run('MED_PATH.loaded'),false);
  blocked='none';await run('loadMedPath()');assert.equal(run('MED_PATH.nodes.length'),81);
  assert.equal(run('pharmClassComplete("missing-category",REF.pharm)'),false,'Missing reference data cannot count as completed learning');
  assert.equal(new Set(path.nodes.map(node=>node.id)).size,81);
  for(const [phase,total] of Object.entries(path.phases))assert.equal(path.nodes.filter(node=>node.phase===phase).length,total);
  run('safeProg({drill:[]},defaultPharmProg())');assert.equal(invalid,1);
  console.log('Legacy Medicine work, failed-save retention, selective download retry, 81-node inventory, missing-data completion guard and malformed progress protection passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
