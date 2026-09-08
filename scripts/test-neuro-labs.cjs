/* State/handler and real CPython checks. These are not browser or Pyodide walkthroughs. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {spawnSync} = require('node:child_process');
const data = JSON.parse(fs.readFileSync('data/neuro.json'));
const source = fs.readFileSync('neuro.js','utf8');
const evaluator = fs.readFileSync('code-evaluator.js','utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function python(code) {
  const result=spawnSync('python3',['-'],{input:code,encoding:'utf8',timeout:5000});
  return {ok:result.status===0,stdout:result.stdout||'',stderr:result.stderr||result.error?.message||''};
}
function element(html='') {
  let content=html;
  const nodes=new Map();
  const node={children:[],value:'',dataset:{},disabled:false,hidden:false,readOnly:false,
    appendChild(child){this.children.push(child);return child;}, remove(){}, focus(){}, scrollIntoView(){},
    addEventListener(type,callback){this['on'+type]=callback;}, classList:{add(){},remove(){}},
    get html(){return content;}, get innerHTML(){return content;}, set innerHTML(value){content=value;nodes.clear();},
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;},
    querySelectorAll(selector){
      if(selector==='[data-manual-trace] textarea') return this.querySelector('[data-manual-trace]')?.querySelectorAll('textarea')||[];
      const found=[];
      for(const match of content.matchAll(/<(button|textarea|div|p|pre|input)\b([^>]*)>/g)) {
        const tag=match[1],attrs=match[2],id=attrs.match(/\bid="([^"]+)"/)?.[1];
        const attr=selector.match(/^\[([^\]]+)\]$/)?.[1];
        if(!(selector===tag || selector==='#'+id || attr && new RegExp('\\b'+attr+'(?:=|\\s|$)').test(attrs))) continue;
        const key=id ? '#'+id : String(match.index);
        if(!nodes.has(key)) {
          const end=content.indexOf('</'+tag+'>',match.index+match[0].length);
          const inner=end<0?'':content.slice(match.index+match[0].length,end);
          const child=element(inner);child.disabled=/\bdisabled\b/.test(attrs);child.readOnly=/\breadonly\b/.test(attrs);child.hidden=/\bhidden\b/.test(attrs);
          if(tag==='textarea')child.value=inner;
          for(const entry of attrs.matchAll(/data-([a-z-]+)="([^"]*)"/g))child.dataset[entry[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=entry[2];
          nodes.set(key,child);
        }
        found.push(nodes.get(key));
      }
      return found;
    },
  };
  return node;
}
function harness(saved=new Map(),content=data) {
  let invalid=0,fail=false,lastMain,lastRoot,mode='python';
  const location=new URL('http://localhost/neuro'), historyCalls=[],events=new Map();
  const storage={paused:false,read:(key,fallback)=>saved.has(key)?JSON.parse(saved.get(key)):fallback,watch(){},
    sessionFailed(){invalid++;this.paused=true;},write(key,value){if(fail){this.paused=true;return false;}saved.set(key,JSON.stringify(value));return true;}};
  const context=vm.createContext({console,Date,Math,JSON,URL,URLSearchParams,Set,Map,AbortController,Blob,setTimeout,
    StudyStorage:storage,location,LETTERS:['A','B','C','D'],
    history:Object.fromEntries(['pushState','replaceState'].map(name=>[name,(_,__,url)=>{historyCalls.push(name);location.href=new URL(url,location).href;}])),
    window:{addEventListener:(name,callback)=>events.set(name,callback)},
    document:{querySelector(){return null;},createElement:()=>({click(){}})},
    sectionUrl:()=>'/neuro',esc:value=>String(value??''),topbar:()=>element(),setView:node=>{lastRoot=node;},
    el:html=>{const node=element(html);if(html.includes('<main'))lastMain=node;return node;},
    fetch:async file=>({ok:true,json:async()=>file.includes('milestones')?{milestones:[]}:structuredClone(content)}),
    runPythonCode:async(code,options={})=>{
      if(mode==='python')return python(code);
      options.onStatus?.('Running test stub');options.onOutput?.({stdout:'partial output',stderr:''});
      return new Promise(resolve=>options.signal.addEventListener('abort',()=>resolve({ok:false,reason:'stopped',stdout:'partial output',stderr:'Stopped'}),{once:true}));
    },
  });
  vm.runInContext(evaluator,context);vm.runInContext(source,context);
  return {context,saved,storage,events,location,historyCalls,run:code=>vm.runInContext(code,context),
    get main(){return lastMain;},get root(){return lastRoot;},get invalid(){return invalid;},set fail(value){fail=value;},set mode(value){mode=value;}};
}
(async()=>{
  const h=harness();await h.run('loadNeuro()');
  let cases=0;
  for(const lesson of data.neuroCodeLessons) {
    assert.ok(lesson.checks,lesson.id);
    const result=await h.context.neuroCodeEvaluateOJT(lesson.solution,lesson);
    assert.equal(result.passed,true,lesson.id+': '+JSON.stringify(result));cases+=result.cases.length;
    assert.equal((await h.context.neuroCodeEvaluateOJT(lesson.codeExample,lesson)).passed,false,lesson.id+' starter has work left');
    assert.equal((await h.context.neuroCodeEvaluateOJT('print('+JSON.stringify(lesson.expectedOutput)+')',lesson)).passed,false,'Printout cannot replace '+lesson.checks.function);
    const output=python(lesson.solution);assert.equal(output.ok,true);assert.equal(output.stdout.trim(),lesson.expectedOutput.trim(),lesson.id+' visible example matches the solution');
    assert.ok(lesson.sources.every(item=>item.url.startsWith('https://')));
  }
  const wrong={
    'code-variables-voltage':'def voltage_difference(a,b):\n    return a-b',
    'code-plotting-eeg-series':'def time_axis(n,r):\n    return [(i+1)/r for i in range(n)]',
    'code-feature-extraction':'def window_features(x):\n    m=sum(x)/len(x)\n    return [m,abs(m),sum(v>=m for v in x)]',
    'code-simple-bci-decoder':'def linear_command(f,w,b):\n    s=f[0]*w[0]+f[1]*w[1]+b\n    return [s,"right" if s>=0 else "left"]',
    'code-weighted-linear-decoder':'def accuracy(t,w,b):\n    return 1.0',
    'code-closed-loop-rule':'def gate_output(f,t,b,a):\n    return f>t or b>20 or a',
    'code-decoder-drift':'def corrected_feature(o,r,c):\n    return o-c',
    'code-data-minimization':'def select_features(r,a,p):\n    return [x for x in r if x["channel"] in a] if p!="raw_waveforms" else []',
  };
  for(const [id,code] of Object.entries(wrong)) assert.equal((await h.context.neuroCodeEvaluateOJT(code,data.neuroCodeLessons.find(x=>x.id===id))).passed,false,id+' common mistake is detected');
  const feature=data.neuroCodeLessons.find(x=>x.id==='code-feature-extraction');
  const values=feature.series.values,mean=values.reduce((a,b)=>a+b,0)/values.length;
  assert.equal(mean,3);assert.equal(values.reduce((a,b)=>a+b*b,0),180);assert.equal(values.filter(x=>x>mean).length,3);
  for(const series of [...data.neuroCodeLessons,...data.simulations].map(x=>x.series).filter(Boolean)) {
    assert.equal(h.context.neuroValidSeries(series),true);
    const markup=h.context.neuroSeriesMarkup(series);
    assert.match(markup,/Time \(s\)/);assert.ok(markup.includes('Amplitude ('+series.unit+')'));assert.match(markup,/scope="col"/);
    assert.ok(!markup.includes('NaN')&&!markup.includes('Infinity'));assert.equal((markup.match(/<circle /g)||[]).length,series.values.length);
  }
  assert.equal(h.context.neuroValidSeries({...feature.series,sampleRateHz:0}),false);
  assert.equal(h.context.neuroValidSeries({...feature.series,values:[NaN]}),false);
  assert.equal(h.context.neuroSeriesMarkup(null),'');
  assert.match(h.context.neuroSeriesMarkup({...feature.series,values:[0]}),/<circle/);
  for(const sim of data.simulations) {
    assert.ok(data.topics.some(topic=>topic.id===sim.relatedTopicId),sim.id+' topic exists');
    h.context.renderNeuroSim(sim.id);const record=h.run('NEURO_PROG.simWork')[sim.id];
    const bad=(sim.bestAnswerIndex+1)%sim.choices.length;
    h.main.querySelectorAll('[data-sim-choice]').find(button=>Number(button.dataset.simChoice)===bad).onclick();
    const answeredAt=record.answers.simulation.answeredAt;
    assert.equal(record.answers.simulation.chosen,bad);assert.ok(h.main.html.includes('First answer needs review'));
    h.main.querySelectorAll('[data-sim-choice]').find(button=>Number(button.dataset.simChoice)===sim.bestAnswerIndex).onclick();
    assert.equal(record.answers.simulation.chosen,bad);assert.equal(record.answers.simulation.answeredAt,answeredAt);
    const input=h.main.querySelector('#sim-debrief');input.value='The supplied denominator describes only this synthetic example.';input.oninput();
    h.main.querySelector('#sim-complete').onclick();const at=record.completedAt;
    assert.ok(at);assert.equal(h.context.neuroCompleteSim(record),false);assert.equal(record.completedAt,at);
    assert.equal(h.main.querySelector('#sim-debrief').readOnly,true);assert.equal(h.context.neuroValidSimWork(record),true);
  }
  assert.deepEqual(plain(h.run('NEURO_PROG.sims')),{},'New comparisons do not overwrite legacy simulation history');
  const changed=structuredClone(data);changed.simulations.forEach(sim=>{sim.title='Changed title';sim.choices[0].label='Changed option';});
  const reload=harness(h.saved,changed);await reload.run('loadNeuro()');
  reload.context.renderNeuroSim(data.simulations[0].id);
  assert.ok(reload.main.html.includes(data.simulations[0].title));assert.ok(!reload.main.html.includes('Changed title'));
  assert.equal(reload.location.search,'?sim='+data.simulations[0].id);
  reload.context.renderNeuroSimLibrary();assert.equal(reload.location.search,'?view=sims');
  assert.equal(reload.historyCalls.at(-1),'pushState','Different labs retain a Back entry');
  reload.context.neuroRoute('unit-1','lesson');reload.context.neuroRoute('unit-1','recall');assert.equal(reload.historyCalls.at(-1),'replaceState','Stage changes do not flood Back history');
  reload.location.href='http://localhost/neuro?sim='+data.simulations[1].id;
  await reload.context.renderNeuroEngineering({fromUrl:true});assert.ok(reload.main.html.includes(data.simulations[1].title));
  const damaged=JSON.parse(h.saved.get('cs-neuro'));damaged.simWork[data.simulations[0].id].answers.simulation.chosen=99;
  const badSaved=new Map([['cs-neuro',JSON.stringify(damaged)]]),bad=harness(badSaved);
  assert.equal(bad.invalid,1);assert.equal(badSaved.get('cs-neuro'),JSON.stringify(damaged));
  const failed=harness();await failed.run('loadNeuro()');failed.context.renderNeuroSim(data.simulations[0].id);
  failed.fail=true;failed.main.querySelectorAll('[data-sim-choice]')[0].onclick();
  assert.equal(failed.storage.paused,true);assert.ok(!failed.main.html.includes('sim-debrief'),'Failed answer save must not reveal feedback');
  assert.equal(JSON.parse(failed.saved.get('cs-neuro')).simWork[data.simulations[0].id].answers.simulation.chosen,undefined);
  failed.fail=false;failed.storage.paused=false;failed.run('saveNeuroProg()');failed.events.get('study-storage-recovered')();await new Promise(resolve=>setImmediate(resolve));
  assert.ok(failed.main.html.includes('sim-debrief'),'Recovery returns to the saved simulation and reveals retained answer');

  // Exercise the same controls used by the Python editor, without simulating browser rendering.
  const code=data.neuroCodeLessons.find(x=>x.id==='code-variables-voltage'), shell=element();
  const c=harness();await c.run('loadNeuro()');let continued=0;
  c.context.mountNeuroCodeSandbox(code,code.id,{requirePass:true,onDone:()=>continued++},shell);
  const sandbox=shell.children[0],button=name=>sandbox.querySelector('[data-'+name+']');
  button('trace-code').onclick();let host=button('manual-trace');
  assert.equal(host.querySelector('#trace-reveal').disabled,true);
  host.querySelectorAll('[data-trace-prediction]').forEach((input,i)=>{input.value=i===0?'20':'I predict -5';input.oninput();});
  host.querySelector('#trace-reveal').onclick();
  assert.equal(host.querySelectorAll('[data-trace-prediction]')[0].readOnly,true);
  const work=c.run('NEURO_PROG.code')[code.id].current;
  assert.deepEqual(plain(work.manualTrace.predictions),['20','I predict -5']);
  assert.equal(c.context.neuroWorkComplete(work),false);
  const comparison=host.querySelector('#trace-comparison');comparison.value='Subtracting a negative resting value makes the example difference positive.';comparison.oninput();
  host.querySelector('#trace-complete').onclick();const traceAt=work.manualTrace.completedAt;
  assert.ok(traceAt);assert.equal(c.context.neuroWorkComplete(work),true);assert.equal(work.attempts.length,0);
  assert.match(c.context.neuroCodeEvidenceLabel(work),/has not passed Python/);
  assert.equal(button('continue-row').hidden,false);button('code-done').onclick();button('code-done').onclick();assert.equal(continued,1);
  c.mode='stall';const pending=button('run-code').onclick();assert.equal(button('stop-code').hidden,false);
  assert.equal(sandbox.querySelector('#neuro-code-editor').readOnly,true);assert.equal(button('trace-code').disabled,true);
  button('stop-code').onclick();await pending;
  assert.equal(work.lastRun.reason,'stopped');assert.equal(work.attempts.length,0);assert.equal(button('stop-code').hidden,true);
  assert.equal(sandbox.querySelector('#neuro-code-editor').readOnly,false);assert.equal(work.manualTrace.completedAt,traceAt);
  const checking=button('check-code').onclick();button('stop-code').onclick();await checking;
  assert.equal(work.attempts.at(-1).passed,false);assert.equal(work.attempts.at(-1).reason,'stopped');
  c.mode='python';const editor=sandbox.querySelector('#neuro-code-editor');editor.value=code.solution;editor.oninput();
  await button('check-code').onclick();assert.equal(work.attempts.at(-1).passed,true);assert.match(c.context.neuroCodeEvidenceLabel(work),/5\/5/);
  const stored=harness(c.saved);assert.equal(stored.invalid,0);assert.equal(stored.run('NEURO_PROG.code')[code.id].current.manualTrace.completedAt,traceAt);
  const malformed=JSON.parse(c.saved.get('cs-neuro'));malformed.code[code.id].current.manualTrace.predictions=[];
  assert.equal(harness(new Map([['cs-neuro',JSON.stringify(malformed)]])).invalid,1);
  console.log(`Neuro labs: ${data.neuroCodeLessons.length} reference functions / ${cases} CPython cases, eight wrong algorithms, ${data.simulations.length} saved simulation journeys, immutable first choices/content, plot math/labels, recovery/routes, manual trace without false pass and Stop/retry handlers passed. Browser/Pyodide checks remain separate.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
