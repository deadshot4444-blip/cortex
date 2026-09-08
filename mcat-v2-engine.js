/* MCAT v2: transparent practice evidence, quantitative variants, and a bounded weekly plan. */
(function(root){
  const DAY=86400000, SKILLS={units:'Units & dimensions',notation:'Scientific notation',logs:'Logs & pH',ratios:'Ratios & proportionality',slopes:'Graphs & slopes',estimation:'Estimation'};
  function normalize(raw){
    const s=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};s.version=2;
    for(const k of ['coach','math','diagnostics']){if(!s[k]||typeof s[k]!=='object'||Array.isArray(s[k]))s[k]={};if(!Array.isArray(s[k].history))s[k].history=[];}
    if(!Array.isArray(s.coach.parked))s.coach.parked=[];
    if(!s.weekly||typeof s.weekly!=='object'||Array.isArray(s.weekly))s.weekly={};
    const w=s.weekly;if(!Array.isArray(w.availability)||w.availability.length!==7)w.availability=[30,30,30,30,30,60,0];
    w.availability=w.availability.map(n=>Math.min(480,Math.max(0,Number(n)||0)));
    if(!Array.isArray(w.exams))w.exams=[];if(!w.done||typeof w.done!=='object'||Array.isArray(w.done))w.done={};
    if(w.planDays===undefined)w.planDays={};
    if(!Array.isArray(s.durations))s.durations=[];if(!s.activityTime||typeof s.activityTime!=='object'||Array.isArray(s.activityTime))s.activityTime={};return s;
  }
  function parkCoach(s) {
    const r=s.coach.active;if(!r)return false;
    if(s.weekly.active?.type==='coach'&&s.weekly.active.key===r.coachId){r.weekTask=s.weekly.active;delete s.weekly.active;}
    if(!s.coach.parked.some(item=>item.id===r.id))s.coach.parked.push(r);
    delete s.coach.active;return true;
  }
  function resumeCoach(s,id) {
    if(s.coach.active?.id===id)return s.coach.active;
    const r=s.coach.parked.find(item=>item.id===id);if(!r)return null;
    parkCoach(s);s.coach.parked=s.coach.parked.filter(item=>item.id!==id);s.coach.active=r;
    if(r.weekTask)s.weekly.active=r.weekTask;
    return r;
  }
  function mathPrior(s,qId,before=Infinity,runId) {
    const first=s.math.exposures?.[qId];
    if(first&&first.runId!==runId&&first.ts<=before)return first.source;
    if(s.math.history.some(r=>r.qId===qId&&r.id!==runId&&(r.startedAt||r.completedAt)<before))return 'math';
    for(const r of [...s.diagnostics.history,s.diagnostics.active].filter(Boolean)){
      if(r.answers.some(a=>a.qId==='probe-'+qId&&a.ts<=before))return 'investigation';
    }
    return null;
  }
  function mathEvidence(s,r){return {...r,assisted:!!(r.assisted||r.externalAssistance),repeat:!!(r.repeat||mathPrior(s,r.qId,r.startedAt||r.completedAt,r.id))};}
  function noteMathExposure(s,qId,runId,source,ts){if(source==='investigation'&&s.math.active?.qId===qId&&!s.math.active.completedAt)s.math.active.externalAssistance=true;s.math.exposures ||= {};s.math.exposures[qId] ||= {runId,source,ts};}
  function bucket(a){return a.repeat?'repeat':a.assisted?'assisted':'independent';}
  function evidence(attempts){
    const result={independent:{correct:0,total:0},assisted:{correct:0,total:0},repeat:{correct:0,total:0}};
    for(const a of attempts){const b=result[bucket(a)];b.total++;if(a.correct)b.correct++;}return result;
  }
  function nextSupport(history,kind){const done=history.filter(h=>h.kind===kind&&h.completedAt);return done.length>=4?'independent':done.length>=2?'light':'guided';}
  // Presentation order never changes the canonical indices saved for scoring.
  function optionOrder(options,order){
    const identity=options.map((_,i)=>i);
    return Array.isArray(order)&&order.length===options.length&&new Set(order).size===options.length&&order.every(i=>Number.isInteger(i)&&i>=0&&i<options.length)?[...order]:identity;
  }
  function optionLabel(question,index){
    const position=optionOrder(question.options,question.displayOrder).indexOf(index);
    return position<0?'—':String.fromCharCode(65+position);
  }
  function numeric(value,expected){
    const text=String(value).trim();if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text))return null;
    const n=Number(text);if(!Number.isFinite(n))return null;return {value:n,correct:Math.abs(n-expected)<=Math.max(1e-9,Math.abs(expected)*.02)};
  }
  function quant(skill,variant=0){
    if(!SKILLS[skill])return null;const n=((variant%8)+8)%8,k=n+2;let q;
    if(skill==='units'){
      const m=(n+2)*150;
      q={stem:`A solution contains ${m} mg of solute in 0.50 L. What is its concentration in g/L?`,unit:'g/L',value:m/500,
        setups:[`${m} × (1 g / 1000 mg) ÷ 0.50 L`,`${m} × (1000 g / 1 mg) ÷ 0.50 L`,`${m} × (1 g / 1000 mg) × 0.50 L`],
        errors:['Cancel mg, then divide grams by liters.','The conversion is inverted: 1000 mg equals 1 g.','Multiplication leaves g·L, rather than the requested g/L.'],
        hint:'Write the requested units first. Arrange each conversion so unwanted units cancel.',explanation:`${m} mg is ${m/1000} g. Divide by 0.50 L to obtain ${m/500} g/L.`};
    }else if(skill==='notation'){
      const exponent=3+n%3;
      q={stem:`Evaluate (${k} × 10^−${exponent}) × (2 × 10²).`,unit:'',value:k*2*10**(2-exponent),
        setups:[`(${k} × 2) × 10^(−${exponent} + 2)`,`(${k} ÷ 2) × 10^(−${exponent} + 2)`,`(${k} × 2) × 10^(−${exponent} × 2)`],
        errors:['Multiply coefficients and add exponents of the same base.','The coefficients multiply; dividing them changes the operation.','Powers multiply by adding exponents, not multiplying exponents.'],
        hint:'Treat the coefficients and powers of ten separately.',explanation:`The coefficient is ${k*2}; the exponent is ${2-exponent}. The result is ${k*2*10**(2-exponent)}. Scientific notation input such as 4e-2 is accepted.`};
    }else if(skill==='logs'){
      const exp=3+n%4,factor=n<4?1:2;
      q={stem:`Assume ideal dilute-solution behavior. Estimate the pH when [H⁺] = ${factor} × 10^−${exp} mol/L. Use log₁₀2 ≈ 0.30.`,unit:'pH',value:exp-(factor===2?.30103:0),
        setups:[`−(log₁₀${factor} − ${exp})`,`log₁₀${factor} − ${exp}`,`${exp} + log₁₀${factor}`],
        errors:['pH is the negative base-10 logarithm of hydrogen-ion activity, approximated here by concentration in mol/L.','This omits the minus sign in the pH definition.','Increasing [H⁺] lowers pH, so this sign is reversed.'],
        hint:'pH = −log₁₀[H⁺]. A larger hydrogen-ion concentration means a smaller pH.',explanation:`−log₁₀(${factor} × 10^−${exp}) = ${exp} − log₁₀${factor} ≈ ${(exp-(factor===2?.30103:0)).toFixed(2)}.`};
      // With a coefficient of one, two numerical expressions coincide; retain distinct incorrect setups.
      if(factor===1){q.setups[2]=`10^${exp}`;q.errors[2]='pH is a logarithm, not the reciprocal concentration.';}
    }else if(skill==='ratios'){
      const old=n+2,change=n%2?3:2;
      q={stem:`For ideal laminar flow, resistance is proportional to 1/r⁴. A tube initially has resistance ${old*change**4} units. Its radius increases ${change}-fold; all other factors stay fixed. What is the new resistance?`,unit:'resistance units',value:old,
        setups:[`${old*change**4} ÷ ${change}⁴`,`${old*change**4} × ${change}⁴`,`${old*change**4} ÷ ${change}`],
        errors:['Use the inverse fourth-power ratio.','A larger radius lowers resistance, so multiplication has the wrong direction.','The fourth power matters; the relationship is not simply inverse-linear.'],
        hint:'Form new/old before inserting numbers: Rnew/Rold = (rold/rnew)⁴.',explanation:`The resistance becomes 1/${change**4} of its previous value: ${old*change**4}/${change**4} = ${old}. This ideal model assumes laminar flow in a rigid cylindrical tube.`};
    }else if(skill==='slopes'){
      const x1=2,x2=6,y1=k*3,y2=y1+4*k;
      q={stem:`A product-concentration graph is linear between t = ${x1} s (${y1} μM) and t = ${x2} s (${y2} μM). What is its average slope over this interval?`,unit:'μM/s',value:k,graph:{xLabel:'Time (s)',yLabel:'Product (μM)',points:[[x1,y1],[x2,y2]]},
        setups:[`(${y2} − ${y1}) / (${x2} − ${x1})`,`${y2} / ${x2}`,`(${x2} − ${x1}) / (${y2} − ${y1})`],
        errors:['Slope is change in y divided by change in x.','y/x is not the interval slope when the intercept is nonzero.','This reverses rise and run and produces s/μM.'],
        hint:'Read both axes and subtract the starting value from the ending value on each axis.',explanation:`Δproduct/Δtime = (${y2} − ${y1})/(6 − 2) = ${k} μM/s. A nonzero starting concentration does not change this slope.`};
    }else{
      const mass=19+n*10,accel=4.9;
      q={stem:`Estimate the net force needed to accelerate a ${mass} kg object at ${accel} m/s². Give an estimate within 2% of the unrounded product.`,unit:'N',value:mass*accel,
        setups:[`${mass} kg × ${accel} m/s²`,`${mass} kg ÷ ${accel} m/s²`,`${accel} m/s² ÷ ${mass} kg`],
        errors:['F = ma; the units become kg·m/s², or newtons.','Dividing gives kg·s²/m, which is not force.','This reverses the relation and does not yield newtons.'],
        hint:'Use 4.9 = 5 − 0.1. Multiply by five, then subtract one tenth of the mass.',explanation:`${mass} × (5 − 0.1) = ${mass*5} − ${mass/10} = ${(mass*4.9).toFixed(1)} N. This is net force, not necessarily a single applied force.`};
    }
    const shift=n%3;q.setups=q.setups.slice(shift).concat(q.setups.slice(0,shift));q.errors=q.errors.slice(shift).concat(q.errors.slice(0,shift));q.answer=(3-shift)%3;
    return {...q,id:`math-${skill}-${n}`,skill,variant:n};
  }
  function validMathTransfer(data) {
    if (!data || typeof data.reviewStatus !== 'string' || typeof data.exposurePolicy !== 'string'
      || !Array.isArray(data.sources) || !data.sources.length || !data.sources.every(source => source && typeof source.title === 'string' && /^https:\/\//.test(source.url))
      || !Array.isArray(data.items) || data.items.length !== 12 || new Set(data.items.map(q => q?.id)).size !== 12) return false;
    return Object.keys(SKILLS).every(skill => data.items.filter(q => q?.skill === skill).length === 2)
      && data.items.every(q => q && SKILLS[q.skill] && [0, 1].includes(q.variant) && q.id === `math-transfer-${q.skill}-${q.variant}`
        && typeof q.stem === 'string' && typeof q.unit === 'string' && Number.isFinite(q.value)
        && Array.isArray(q.setups) && q.setups.length === 3 && new Set(q.setups).size === 3 && q.setups.every(s => typeof s === 'string')
        && Array.isArray(q.errors) && q.errors.length === 3 && q.errors.every(s => typeof s === 'string')
        && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 3 && typeof q.explanation === 'string'
        && Array.isArray(q.unitIds) && q.unitIds.length && q.unitIds.every(id => typeof id === 'string')
        && (!q.graph || Array.isArray(q.graph.points) && q.graph.points.length >= 2 && q.graph.points.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))));
  }
  function mathTransferAllowed(state, skill) {
    const foundationIds = new Set(Array.from({ length: 8 }, (_, i) => `math-${skill}-${i}`));
    return new Set(state.math.history.filter(run => run.completedAt && foundationIds.has(run.qId)).map(run => run.qId)).size >= 2;
  }
  function diagnose(probes){
    const failed=probes.filter(p=>!p.correct).map(p=>p.domain);
    if(!failed.length)return {cause:'uncertain',text:'All three short checks were correct. The original miss may depend on the passage, timing, or wording. These checks cannot identify a cause.'};
    if(failed.length>1)return {cause:'uncertain',text:`These checks showed difficulty with ${failed.join(' and ')}. More than one explanation is plausible; choose the most useful next focus.`};
    return {cause:failed[0],text:`The ${failed[0]} check was missed while the other two were correct. This suggests a useful place to investigate, not a confirmed diagnosis.`};
  }
  function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function firstPassageDisplay(id,{passageDisplays={},qlog=[]}={}) {
    const times=[passageDisplays[id],...qlog.filter(a=>a.passage===id&&!a.unanswered).map(a=>a.ts)].filter(t=>Number.isFinite(t)&&t>0);
    return times.length?Math.min(...times):Infinity;
  }
  function reconcileCoachExposure(s,history) {
    let changed=false;
    for(const run of [s.coach.active,...s.coach.parked,...s.coach.history].filter(Boolean)) {
      const passage=run.content?.passage,firstAt=passage&&firstPassageDisplay(passage.id,history);
      if(!passage||!Number.isFinite(run.startedAt)||!(firstAt<run.startedAt))continue;
      const prior=new Set(run.prior||[]);
      if(passage.questions.every(q=>prior.has(q.id))&&run.answers.every(a=>a.repeat))continue;
      run.exposureCorrection ||= {firstDisplayAt:firstAt,previousPrior:[...prior],previousRepeat:run.answers.map(a=>({qId:a.qId,repeat:!!a.repeat}))};
      run.prior=[...new Set([...prior,...passage.questions.map(q=>q.id)])];
      for(const answer of run.answers)answer.repeat=true;
      changed=true;
    }
    return changed;
  }
  function priorQuestionIds(p,{qlog=[],qhist={},coachHistory=[],coachExposures={},resumes={},passageDisplays={}}={}){
    const seen=new Set([...qlog.map(a=>a.qId),...Object.keys(qhist),...coachHistory.flatMap(h=>(h.answers||[]).map(a=>a.qId))]);
    const passageSeen=()=>p.questions.forEach(q=>seen.add(q.id));
    if(coachExposures?.[p.id]||Number.isFinite(firstPassageDisplay(p.id,{passageDisplays,qlog})))passageSeen();
    for(const key of ['cars','plab'])if(resumes[key]?.p?.id===p.id)passageSeen();
    const drill=resumes.drill;if(drill){for(const a of drill.results||[])seen.add(a.id||a.qId);const q=drill.qs?.[drill.idx];if(q)seen.add(q.id);}
    const sim=resumes.sim;
    if(sim){
      // A queued item is not exposure. Track only displayed or answered items.
      const displayed=new Set([...(sim.seen||[]),...Object.keys(sim.answers||{}),...Object.keys(sim.flags||{})]);
      if(!sim.onBreak&&!sim.finishedAt)displayed.add(`${sim.si}:${sim.idx}`);
      for(const key of displayed){const [si,idx]=key.split(':').map(Number),it=sim.queue?.[si]?.items?.[idx];if(!it)continue;seen.add(it.q.id);if(it.passageId===p.id)passageSeen();}
    }
    return p.questions.filter(q=>seen.has(q.id)).map(q=>q.id);
  }
  function validCarsPath(data) {
    const text=value=>typeof value==='string'&&value.trim().length>0;
    if(!data||!Array.isArray(data.steps)||!data.steps.length||!Array.isArray(data.coaches)||!data.coaches.length
      ||!text(data.title)||!text(data.reviewStatus)||!text(data.source?.title)||!/^https:\/\//.test(data.source?.url))return false;
    const ids=new Set(),questions=new Set();
    return data.coaches.every(coach=>{
      if(!coach||!text(coach.id)||ids.has(coach.id)||coach.kind!=='cars'||!text(coach.title)||!text(coach.unitId)
        ||!Array.isArray(coach.prompts)||!coach.prompts.length||!coach.prompts.every(text)
        ||!Array.isArray(coach.hints)||coach.hints.length!==2||!coach.hints.every(text)
        ||!Array.isArray(coach.questionHints)||coach.questionHints.length!==2||!coach.questionHints.every(text)
        ||!Array.isArray(coach.model)||!coach.model.every(item=>text(item.label)&&text(item.text)))return false;
      ids.add(coach.id);
      const passage=coach.passage;
      if(!passage||passage.id!==coach.passageId||!text(passage.text)||!text(passage.title)||!Array.isArray(passage.questions)||!passage.questions.length)return false;
      const paragraphs=passage.text.split(/\n\n+/).length;
      return passage.questions.every(question=>{
        if(!question||!text(question.id)||questions.has(question.id)||!text(question.stem)||!text(question.explanation)
          ||!Array.isArray(question.options)||question.options.length!==4||!question.options.every(text)||new Set(question.options).size!==4
          ||!Number.isInteger(question.answer)||question.answer<0||question.answer>3||!['cars-1','cars-2','cars-3'].includes(question.skill)
          ||!Array.isArray(question.optionFeedback)||question.optionFeedback.length!==4||!question.optionFeedback.every(text)
          ||!Array.isArray(question.evidenceParagraphs)||!question.evidenceParagraphs.length
          ||!question.evidenceParagraphs.every(index=>Number.isInteger(index)&&index>0&&index<=paragraphs))return false;
        questions.add(question.id);return true;
      });
    })&&new Set(data.steps.map(step=>step.coachId)).size===data.steps.length
      &&data.steps.every(step=>text(step.coachId)&&text(step.unitId)&&text(step.title)&&['guided','light','independent'].includes(step.support));
  }
  function dateFrom(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12);}
  function addDays(s,n){const d=dateFrom(s);d.setDate(d.getDate()+n);return dateKey(d);}
  function duration(s,type,fallback){const xs=s.durations.filter(d=>d.type===type&&d.ms>=60000&&d.ms<=4*3600000).slice(-10).map(d=>d.ms/60000).sort((a,b)=>a-b);return xs.length?Math.max(5,Math.min(240,Math.ceil((xs[Math.floor((xs.length-1)/2)]+xs[Math.floor(xs.length/2)])/2/5)*5)):fallback;}
  function validPlanTask(task) {
    return task && ['id','key','title'].every(key=>typeof task[key]==='string'&&task[key].length>0) && typeof task.reason==='string'
      && ['course','coach','math','externalReview'].includes(task.type)
      && Number.isFinite(task.minutes) && task.minutes>0 && task.minutes<=480
      && (task.selectedAt==null || Number.isFinite(task.selectedAt))
      && (task.dueAt==null || Number.isFinite(task.dueAt))
      && (task.notBefore==null || /^\d{4}-\d{2}-\d{2}$/.test(task.notBefore))
      && (task.manualPrerequisites==null || typeof task.manualPrerequisites==='boolean');
  }
  function validPlanDays(plans) {
    const valid = plan => plan && Number.isFinite(plan.savedAt) && Array.isArray(plan.tasks) && plan.tasks.length<=3
      && plan.tasks.every(validPlanTask) && new Set(plan.tasks.map(task=>task.id)).size===plan.tasks.length
      && (plan.released==null || typeof plan.released==='boolean');
    return plans && typeof plans==='object' && !Array.isArray(plans) && Object.entries(plans).every(([date,plan])=>
      /^\d{4}-\d{2}-\d{2}$/.test(date) && dateKey(dateFrom(date))===date && valid(plan) && (plan.previous==null || valid(plan.previous)));
  }
  function keepDay(s,date,tasks,now,released=false) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||dateKey(dateFrom(date))!==date||!Number.isFinite(now)||date<dateKey(new Date(now))||!validPlanDays(s.weekly.planDays)
      ||!Array.isArray(tasks)||tasks.length>3||!tasks.every(validPlanTask)||new Set(tasks.map(task=>task.id)).size!==tasks.length)return false;
    if(Object.entries(s.weekly.planDays).some(([day,plan])=>day!==date&&day>=dateKey(new Date(now))&&!plan.released&&plan.tasks.some(old=>tasks.some(task=>task.id===old.id))))return false;
    const previous=s.weekly.planDays[date],clean=task=>{
      const copy={selectedAt:task.selectedAt||now};
      for(const key of ['id','type','key','title','minutes','reason','kind','dueAt','notBefore','manualPrerequisites'])if(task[key]!=null)copy[key]=task[key];
      return copy;
    };
    s.weekly.planDays[date]={tasks:tasks.map(clean),savedAt:now,released,
      ...(previous?{previous:{tasks:previous.tasks,savedAt:previous.savedAt,released:!!previous.released}}:{})};
    return true;
  }
  function taskPrerequisites(input,task) {
    if(task.manualPrerequisites || task.resume || task.type==='course'&&task.key===input.activeUnit)return [];
    const unit=input.units.find(unit=>unit.id===(task.type==='course'?task.key:input.coaches.find(coach=>coach.id===task.key)?.unitId));
    if(!unit || task.type==='course'&&(task.kind==='review'||task.kind==='delayed'||input.records[unit.id]?.completedAt))return [];
    const ids=task.type==='coach'?[unit.id]:(unit.prerequisites||[]);
    return ids.filter(id=>!input.records[id]?.completedAt);
  }
  function taskCompleted(s,input,task,since=0) {
    if(Object.values(s.weekly.done).some(done=>done.id===task.id&&done.ts>=since))return true;
    if(task.type==='course') {
      const record=input.records[task.key]||{};
      if(task.kind==='review')return !!record.reviewedAt&&record.reviewedAt>=since;
      if(task.kind==='delayed')return (record.attempts||[]).filter(a=>a.kind==='delayed').length>Number(task.id.split(':').at(-1));
      return !!record.completedAt;
    }
    if(task.type==='coach')return s.coach.history.some(run=>run.coachId===task.key&&run.completedAt>=since);
    if(task.type==='math')return s.math.history.some(run=>run.skill===task.key&&run.completedAt>=since);
    return task.type==='externalReview'&&s.weekly.exams.some(exam=>exam.id===task.key&&exam.reviewedAt>=since);
  }
  function plannerEvidence(s,input,task) {
    if(task.type==='externalReview')return 'Review time follows the practice exam you scheduled. Any entered exam results are self-reported.';
    if(task.type==='course') {
      const record=input.records[task.key]||{},answers=(record.attempts||[]).filter(a=>['check','delayed'].includes(a.kind));
      const checks=answers.filter(a=>a.kind==='check'),later=answers.filter(a=>a.kind==='delayed');
      return answers.length?`${checks.filter(a=>a.correct).length}/${checks.length} first lesson applications and ${later.filter(a=>a.correct).length}/${later.length} later applications correct. These lesson records do not establish unaided mastery; post-answer help stays separate.`:'No completed application answers for this lesson yet. The recommendation follows the course sequence, not an ability estimate.';
    }
    const answers=task.type==='math'?s.math.history.filter(run=>run.skill===task.key).map(run=>({...mathEvidence(s,run),assisted:typeof run.assisted==='boolean'||typeof run.externalAssistance==='boolean'?!!(run.assisted||run.externalAssistance):undefined}))
      :task.type==='coach'?s.coach.history.filter(run=>run.coachId===task.key).flatMap(run=>run.answers||[]):[];
    if(!answers.length)return 'No retained answers for this activity yet. One correct answer would still be limited evidence.';
    const counts={independent:0,assisted:0,repeat:0,unknown:0};
    for(const answer of answers)counts[answer.repeat?'repeat':typeof answer.assisted!=='boolean'?'unknown':answer.assisted?'assisted':'independent']++;
    return `${counts.independent} first answers without recorded help; ${counts.assisted} assisted; ${counts.repeat} repeated; ${counts.unknown} with support conditions unrecorded. Counts describe practice conditions, not mastery.`;
  }
  function week(s,input){
    const w=s.weekly,start=input.start,days=[],selected=new Set(),pool=[];
    const done=Object.values(w.done).map(task=>Number.isFinite(task.ts)?{...task,plannedDay:task.plannedDay||task.day,day:dateKey(new Date(task.ts))}:task);
    const plans=validPlanDays(w.planDays)?w.planDays:{},reserved=new Map(),planned=new Set(input.units.filter(unit=>input.records[unit.id]?.completedAt).map(unit=>unit.id));
    for(const [date,plan] of Object.entries(plans))if(!plan.released&&date>=start&&date<addDays(start,7))for(const task of plan.tasks)reserved.set(task.id,date);
    const courseMin=duration(s,'course',15),coachMin=duration(s,'coach',20),mathMin=duration(s,'math',5);
    // Completed work counts toward availability even when it began outside this planner.
    // Derive display records without changing answers, completion times, or stored history.
    const remember=(task)=>{
      if(!Number.isFinite(task.ts)||task.ts>(input.now??Date.now()))return;
      const day=dateKey(new Date(task.ts));
      if(day<start||day>=addDays(start,7))return;
      if(done.some(d=>d.day===day&&d.type===task.type&&d.key===task.key
        &&(d.kind||'lesson')===(task.kind||'lesson')&&Math.abs(d.ts-task.ts)<1000))return;
      done.push({...task,day,reason:task.reason||'Completed study activity.'});
    };
    (input.completedActivities||[]).forEach(remember);
    for(const u of input.units){const r=input.records[u.id]||{};
      remember({id:`course:${u.id}`,type:'course',key:u.id,title:u.title,minutes:courseMin,ts:r.completedAt,kind:'lesson'});
      remember({id:`review:${u.id}:${r.reviewedAt}`,type:'course',key:u.id,title:`Review: ${u.title}`,minutes:5,ts:r.reviewedAt,kind:'review'});
      (r.attempts||[]).filter(a=>a.kind==='delayed').forEach((a,i)=>remember({id:`later:${u.id}:${i}`,type:'course',key:u.id,title:`Later check: ${u.title}`,minutes:5,ts:a.ts,kind:'delayed'}));
    }
    s.coach.history.forEach(h=>remember({id:`coach:${h.coachId}`,type:'coach',key:h.coachId,title:input.coaches.find(c=>c.id===h.coachId)?.title||'Passage workshop',minutes:coachMin,ts:h.completedAt}));
    s.math.history.forEach(h=>remember({id:`math:${h.skill}`,type:'math',key:h.skill,title:SKILLS[h.skill]||'Quantitative practice',minutes:mathMin,ts:h.completedAt}));
    const add=(type,key,title,minutes,reason,extra={})=>pool.push({id:`${type}:${key}`,type,key,title,minutes,reason,...extra});
    if(w.active&&!done.some(d=>d.id===w.active.id&&d.day===w.active.day))pool.push({...w.active,resume:true,reason:'Continue your saved activity. Missed days do not add extra work.'});
    for(const u of [...input.units].sort((a,b)=>(input.records[a.id]?.dueAt||Infinity)-(input.records[b.id]?.dueAt||Infinity))){const r=input.records[u.id]||{};if(r.completedAt&&r.dueAt)add('course',u.id,`Later check: ${u.title}`,5,'A new application is due after a spacing interval. The oldest due check comes first.',{notBefore:dateKey(new Date(r.dueAt)),dueAt:r.dueAt,kind:'delayed',id:`later:${u.id}:${r.attempts?.filter(a=>a.kind==='delayed').length||0}`});}
    const cause=s.diagnostics.history.filter(d=>d.confirmedAt).at(-1);
    if(cause?.cause==='math')add('math','units','Check the units',mathMin,'Your chosen focus after a mistake check.');
    if(cause&&['graph','reading','argument','transfer'].includes(cause.cause))add('coach',input.coaches.find(c=>c.kind===(cause.cause==='graph'?'science':'cars'))?.id,'Practice passage reasoning',coachMin,'Your chosen focus after a mistake check.');
    const active=input.units.find(u=>u.id===input.activeUnit);
    if(active&&!input.records[active.id]?.completedAt)add('course',active.id,active.title,courseMin,'Finish the lesson you started.',{resume:true});
    const focus=input.units.find(u=>u.id===(cause?.cause==='content'?cause.unitId:input.preferredUnit));
    if(focus)add('course',focus.id,focus.title,courseMin,'Revisit your chosen focus.',{kind:input.records[focus.id]?.completedAt?'review':'lesson'});
    // Use observed lesson misses and explicitly entered official results as transparent priorities.
    const missedUnit=input.units.find(u=>{const r=input.records[u.id]||{};return r.completedAt&&(r.attempts||[]).some(a=>['check','delayed'].includes(a.kind)&&!a.correct&&a.ts>(r.reviewedAt||0));});
    if(missedUnit){const r=input.records[missedUnit.id],missAt=Math.max(...r.attempts.filter(a=>!a.correct).map(a=>a.ts));add('course',missedUnit.id,missedUnit.title,courseMin,'A saved lesson application was missed. Revisit the model.',{kind:'review',id:`review:${missedUnit.id}:${missAt}`});}
    const official=w.exams.filter(e=>e.source==='official'&&e.date<=start&&Object.keys(e.scores||{}).length===4&&Object.values(e.scores).every(v=>Number.isInteger(v)&&v>=118&&v<=132)).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
    if(official){const values=Object.values(official.scores),lowest=Math.min(...values);if(lowest<Math.max(...values)){
      const section=Object.keys(official.scores).find(k=>official.scores[k]===lowest),unit=input.units.find(u=>u.section===section&&!input.records[u.id]?.completedAt),abbr={chemPhys:'C/P',cars:'CARS',bioBiochem:'B/B',psychSoc:'P/S'}[section];
      const reason=`${abbr} is among the lower sections in your latest entered official practice result. This is a focus suggestion, not a score prediction.`;
      if(unit)add('course',unit.id,unit.title,courseMin,reason);
      else{const coach=input.coaches.find(c=>input.units.find(u=>u.id===c.unitId)?.section===section&&!s.coach.history.some(h=>h.coachId===c.id));if(coach)add('coach',coach.id,coach.title,coachMin,reason);}
    }}
    for(const [key,title] of Object.entries(SKILLS)) {
      const history=s.math.history.filter(run=>run.skill===key),first=history.filter(run=>run.assisted===false&&!mathEvidence(s,run).repeat);
      if(history.length&&first.length<2)add('math',key,title,mathMin,'Few first answers without help are recorded for this skill. Try another variant with the support you need.');
    }
    pool.forEach(t=>t.priority=true);
    // Interleave sections while preserving prerequisite order inside each section.
    const groups=['bioBiochem','chemPhys','psychSoc','cars'].map(section=>input.units.filter(u=>u.section===section&&!input.records[u.id]?.completedAt));
    for(let i=0;i<Math.max(...groups.map(g=>g.length),0);i++)for(const group of groups)if(group[i])add('course',group[i].id,group[i].title,courseMin,'Build the next idea in the course.');
    for(const c of input.coaches){if(!s.coach.history.some(h=>h.coachId===c.id))add('coach',c.id,c.title,coachMin,'Apply the science or argument in context.');}
    Object.entries(SKILLS).forEach(([key,title])=>add('math',key,title,mathMin,'Short quantitative practice.'));
    for(const unit of input.units.filter(unit=>input.records[unit.id]?.completedAt))add('course',unit.id,`Review: ${unit.title}`,5,'A lesson review you can choose.',{kind:'review',id:`review:chosen:${unit.id}`,alternateOnly:true});
    for(const coach of input.coaches.filter(coach=>s.coach.history.some(run=>run.coachId===coach.id)))add('coach',coach.id,coach.title,coachMin,'A workshop you can revisit. Prior exposure remains recorded.',{id:`coach:chosen:${coach.id}`,alternateOnly:true});
    const expand=(task,path=[])=>{
      if(task.alternateOnly)return [task];
      const parents=taskPrerequisites(input,task).flatMap(id=>{
        const unit=input.units.find(unit=>unit.id===id);if(!unit||path.includes(id))return [];
        return expand({id:`course:${id}`,type:'course',key:id,title:unit.title,minutes:courseMin,kind:'lesson',priority:task.priority,
          reason:`Foundation for ${task.title}: this prerequisite has no recorded completion.`},[...path,id]);
      });
      return [...parents,task];
    };
    const candidateIds=new Set(),candidates=pool.flatMap(task=>expand(task)).filter(task=>{
      if(!task.key||candidateIds.has(task.id))return false;candidateIds.add(task.id);return true;
    });
    const pendingReviews=w.exams.filter(e=>!e.reviewedAt&&e.date<addDays(start,7));
    const reviewsPlaced=new Set();
    for(let i=0;i<7;i++){
      const date=addDays(start,i),weekday=(dateFrom(date).getDay()+6)%7,budget=w.availability[weekday],pastTarget=!!w.targetDate&&date>w.targetDate;
      const completed=done.filter(t=>t.day===date).map(t=>({...t,done:true}));
      for(const e of w.exams)if(e.reviewedAt&&dateKey(new Date(e.reviewedAt))===date&&!completed.some(t=>t.id===`examReview:${e.id}`))completed.push({id:`examReview:${e.id}`,type:'externalReview',key:e.id,title:`Review: ${e.name}`,minutes:20,reason:'Your completed practice-exam review.',day:date,done:true});
      const kept=plans[date]&&!plans[date].released?plans[date]:null;
      const day={date,budget,tasks:[...completed],pastTarget,kept:!!kept,held:[],alternatives:[]};days.push(day);
      const exams=w.exams.filter(e=>e.date===date);
      for(const e of exams)day.tasks.push({id:`exam:${e.id}`,type:'externalExam',key:e.id,title:e.name,minutes:e.minutes,reason:'Your scheduled practice exam.',done:!!e.completedAt});
      let remaining=budget-day.tasks.reduce((n,t)=>n+t.minutes,0);
      if(!kept&&!pastTarget&&budget)for(const e of pendingReviews){if(e.date>=date||reviewsPlaced.has(e.id)||reserved.has(`examReview:${e.id}`)&&reserved.get(`examReview:${e.id}`)!==date)continue;if(remaining>=20&&day.tasks.filter(task=>!task.done).length<3){day.tasks.push({id:`examReview:${e.id}`,type:'externalReview',key:e.id,title:`Review: ${e.name}`,minutes:20,reason:'Reserved review after your practice exam.'});reviewsPlaced.add(e.id);remaining-=20;}}
      const order=input.mode==='mixed'||input.mode==='exam'||weekday%3===1?['coach','math','course']:['course','math','coach'];
      const buckets=order.map(type=>candidates.filter(t=>!t.priority&&!t.alternateOnly&&t.type===type)),mixed=[];
      for(let j=0;j<Math.max(...buckets.map(b=>b.length),0);j++)for(const bucket of buckets)if(bucket[j])mixed.push(bucket[j]);
      for(const t of kept?kept.tasks:[...candidates.filter(t=>t.priority),...mixed]){
        const nextMidnight=dateFrom(addDays(date,1));nextMidnight.setHours(0,0,0,0);
        if(kept&&taskCompleted(s,input,t,t.selectedAt||kept.savedAt))continue;
        const missing=taskPrerequisites(input,t),available=t.type==='course'?input.units.some(unit=>unit.id===t.key):t.type==='coach'?input.coaches.some(coach=>coach.id===t.key):t.type==='math'?!!SKILLS[t.key]:w.exams.some(exam=>exam.id===t.key);
        const hold=!available?'This activity is not currently available. Your choice is retained.':pastTarget?'After your target date. Adjust the target to schedule this choice.':!budget?'Rest day. Your choice is retained.':t.minutes>remaining?'This choice does not fit the remaining time.':day.tasks.filter(x=>!x.done).length>=3?'Three activities are already planned.':missing.some(id=>!planned.has(id))?'Complete the prerequisite or explicitly use your prior background.':t.notBefore&&t.notBefore>date||t.dueAt&&(i===0?t.dueAt>(input.now??Date.now()):t.dueAt>=nextMidnight.getTime())?'The spacing interval has not elapsed.':null;
        if(hold){if(kept)day.held.push({...t,hold});continue;}
        if(!t.key||selected.has(t.id)||completed.some(d=>d.id===t.id)||reserved.has(t.id)&&reserved.get(t.id)!==date)continue;
        // A completed task may be done on an earlier day in this rolling week.
        if(done.some(d=>d.id===t.id&&d.day>=start))continue;
        if(t.type==='course'&&day.tasks.some(d=>d.type==='course'&&d.key===t.key))continue;
        const prerequisiteNote=missing.length?`Planned after ${missing.map(id=>input.units.find(unit=>unit.id===id)?.title||id).join(', ')}. This depends on completing that work.`:t.manualPrerequisites?'You chose to use your prior background instead of recorded prerequisite completion.':'';
        day.tasks.push({...t,day:date,prerequisiteNote,evidence:plannerEvidence(s,input,t)});selected.add(t.id);remaining-=t.minutes;
        if(t.type==='course'&&(!t.kind||t.kind==='lesson'))planned.add(t.key);
        if(t.type==='externalReview')reviewsPlaced.add(t.key);
      }
      day.unallocated=Math.max(0,remaining);
      if(!pastTarget&&budget&&day.tasks.filter(task=>!task.done).length<3)day.alternatives=candidates.filter(task=>task.minutes<=remaining
        &&!selected.has(task.id)&&!done.some(completed=>completed.id===task.id&&completed.day>=start)
        &&!day.tasks.some(other=>other.id===task.id||other.type===task.type&&other.key===task.key)
        &&!day.held.some(other=>other.id===task.id)&&(!reserved.has(task.id)||reserved.get(task.id)===date)
        &&(!task.notBefore||task.notBefore<=date)&&(!task.dueAt||task.dueAt<=(i===0?(input.now??Date.now()):nextDayStart(date)-1)))
        .map(task=>({...task,prerequisites:taskPrerequisites(input,task),evidence:plannerEvidence(s,input,task)}));
    }
    return days;
  }
  function nextDayStart(date){const next=dateFrom(addDays(date,1));next.setHours(0,0,0,0);return next.getTime();}
  const api={DAY,SKILLS,normalize,parkCoach,resumeCoach,mathPrior,mathEvidence,noteMathExposure,bucket,evidence,nextSupport,numeric,quant,validMathTransfer,mathTransferAllowed,diagnose,dateKey,dateFrom,addDays,duration,week,priorQuestionIds,reconcileCoachExposure,optionOrder,optionLabel,validCarsPath,validPlanDays,validPlanTask,keepDay,taskPrerequisites,taskCompleted,plannerEvidence};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.McatV2Core=api;
})(typeof window!=='undefined'?window:globalThis);
