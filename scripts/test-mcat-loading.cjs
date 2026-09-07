/* Exercise the actual loader with failed responses; no browser or account access. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function setup(){
  const calls=[],failures=new Map();
  const context=vm.createContext({console,window:{addEventListener(){}},document:{addEventListener(){}},
    McatStorage:{read:(key,fallback)=>fallback,watch(){},write(){throw Error('Unexpected progress write');}},
    loadMcatRepairs:async()=>{},loadExperimentNotes:async()=>{},loadMcatCourse:async()=>{},loadMcatV2:async()=>{},
    fetch:async file=>{calls.push(file);const key=file.split('?')[0],fault=failures.get(key);
      if(fault==='network')throw Error('Offline');if(fault==='503')return {ok:false};
      return {ok:true,json:async()=>{if(fault==='json')throw Error('Invalid JSON');if(fault==='shape')return {};return JSON.parse(fs.readFileSync(path.join(root,key),'utf8'));}};}});
  const run=code=>vm.runInContext(code,context);run(fs.readFileSync(path.join(root,'mcat.js'),'utf8'));
  return {run,calls,failures};
}
(async()=>{
  let failed=0;
  async function test(name,fn){try{await fn();console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,e.stack);}}
  await test('An outage stays retryable and does not refetch already loaded banks',async()=>{
    const s=setup();s.failures.set('data/mcat-cards.json','503');await s.run('loadMCAT()');
    assert.equal(s.run('MCAT.loaded'),false);assert.equal(s.run('MCAT.cards.length'),0);assert.equal(s.run('MCAT.questions.length'),263);
    s.failures.clear();s.calls.length=0;await s.run('loadMCAT()');
    assert.equal(s.run('MCAT.loaded'),true);assert.equal(s.run('MCAT.cards.length'),504);assert.deepEqual(s.calls,['data/mcat-cards.json']);
    s.calls.length=0;await s.run('loadMCAT()');assert.equal(s.calls.length,0);
  });
  await test('Offline, malformed JSON, and malformed bank shapes do not become successful empty loads',async()=>{
    for(const fault of ['network','json','shape']){
      const s=setup();s.failures.set('data/mcat-outline.json',fault);s.failures.set('data/mcat-science-passages.json',fault);
      await s.run('loadMCAT()');assert.equal(s.run('MCAT.loaded'),false);assert.equal(s.run('MCAT.outline'),null);assert.equal(s.run('MCAT.sci.length'),0);
      s.failures.clear();await s.run('loadMCAT()');assert.equal(s.run('MCAT.loaded'),true);assert.equal(s.run('MCAT.sci.length'),34);
    }
  });
  process.exitCode=failed?1:0;
})();
