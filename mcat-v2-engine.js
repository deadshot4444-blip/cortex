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
  function diagnose(probes){
    const failed=probes.filter(p=>!p.correct).map(p=>p.domain);
    if(!failed.length)return {cause:'uncertain',text:'All three short checks were correct. The original miss may depend on the passage, timing, or wording. These checks cannot identify a cause.'};
    if(failed.length>1)return {cause:'uncertain',text:`These checks showed difficulty with ${failed.join(' and ')}. More than one explanation is plausible; choose the most useful next focus.`};
    return {cause:failed[0],text:`The ${failed[0]} check was missed while the other two were correct. This suggests a useful place to investigate, not a confirmed diagnosis.`};
  }
  function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function priorQuestionIds(p,{qlog=[],qhist={},coachHistory=[],resumes={}}={}){
    const seen=new Set([...qlog.map(a=>a.qId),...Object.keys(qhist),...coachHistory.flatMap(h=>(h.answers||[]).map(a=>a.qId))]);
    const passageSeen=()=>p.questions.forEach(q=>seen.add(q.id));
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
  function dateFrom(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12);}
  function addDays(s,n){const d=dateFrom(s);d.setDate(d.getDate()+n);return dateKey(d);}
  function duration(s,type,fallback){const xs=s.durations.filter(d=>d.type===type&&d.ms>=60000&&d.ms<=4*3600000).slice(-10).map(d=>d.ms/60000).sort((a,b)=>a-b);return xs.length?Math.max(5,Math.min(60,Math.ceil((xs[Math.floor((xs.length-1)/2)]+xs[Math.floor(xs.length/2)])/2/5)*5)):fallback;}
  function week(s,input){
    const w=s.weekly,start=input.start,days=[],selected=new Set(),done=Object.values(w.done),pool=[];
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
    if(w.active&&!done.some(d=>d.id===w.active.id&&d.day===w.active.day))pool.push({...w.active,reason:'Continue your saved activity.'});
    for(const u of input.units){const r=input.records[u.id]||{};if(r.dueAt)add('course',u.id,`Later check: ${u.title}`,5,'Fresh application due.',{notBefore:dateKey(new Date(r.dueAt)),dueAt:r.dueAt,kind:'delayed',id:`later:${u.id}:${r.attempts?.filter(a=>a.kind==='delayed').length||0}`});}
    const cause=s.diagnostics.history.filter(d=>d.confirmedAt).at(-1);
    if(cause?.cause==='math')add('math','units','Check the units',mathMin,'Your chosen focus after a mistake check.');
    if(cause&&['graph','reading','argument','transfer'].includes(cause.cause))add('coach',input.coaches.find(c=>c.kind===(cause.cause==='graph'?'science':'cars'))?.id,'Practice passage reasoning',coachMin,'Your chosen focus after a mistake check.');
    const active=input.units.find(u=>u.id===input.activeUnit);
    if(active&&!input.records[active.id]?.completedAt)add('course',active.id,active.title,courseMin,'Finish the lesson you started.');
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
    pool.forEach(t=>t.priority=true);
    // Interleave sections while preserving prerequisite order inside each section.
    const groups=['bioBiochem','chemPhys','psychSoc','cars'].map(section=>input.units.filter(u=>u.section===section&&!input.records[u.id]?.completedAt));
    for(let i=0;i<Math.max(...groups.map(g=>g.length),0);i++)for(const group of groups)if(group[i])add('course',group[i].id,group[i].title,courseMin,'Build the next idea in the course.');
    for(const c of input.coaches){if(!s.coach.history.some(h=>h.coachId===c.id))add('coach',c.id,c.title,coachMin,'Apply the science or argument in context.');}
    Object.entries(SKILLS).forEach(([key,title])=>add('math',key,title,mathMin,'Short quantitative practice.'));
    const pendingReviews=w.exams.filter(e=>!e.reviewedAt&&e.date<addDays(start,7));
    const reviewsPlaced=new Set();
    for(let i=0;i<7;i++){
      const date=addDays(start,i),weekday=(dateFrom(date).getDay()+6)%7,budget=w.availability[weekday],pastTarget=!!w.targetDate&&date>w.targetDate;
      const completed=done.filter(t=>t.day===date).map(t=>({...t,done:true}));
      for(const e of w.exams)if(e.reviewedAt&&dateKey(new Date(e.reviewedAt))===date&&!completed.some(t=>t.id===`examReview:${e.id}`))completed.push({id:`examReview:${e.id}`,type:'externalReview',key:e.id,title:`Review: ${e.name}`,minutes:20,reason:'Your completed practice-exam review.',day:date,done:true});
      const day={date,budget,tasks:[...completed],pastTarget};days.push(day);
      const exams=w.exams.filter(e=>e.date===date);
      for(const e of exams)day.tasks.push({id:`exam:${e.id}`,type:'externalExam',key:e.id,title:e.name,minutes:e.minutes,reason:'Your scheduled practice exam.',done:!!e.completedAt});
      let remaining=budget-day.tasks.reduce((n,t)=>n+t.minutes,0);
      if(pastTarget||budget===0||remaining<5)continue;
      for(const e of pendingReviews){if(e.date>=date||reviewsPlaced.has(e.id))continue;if(remaining>=20){day.tasks.push({id:`examReview:${e.id}`,type:'externalReview',key:e.id,title:`Review: ${e.name}`,minutes:20,reason:'Reserved review after your practice exam.'});reviewsPlaced.add(e.id);remaining-=20;}}
      const order=input.mode==='mixed'||input.mode==='exam'||weekday%3===1?['coach','math','course']:['course','math','coach'];
      const buckets=order.map(type=>pool.filter(t=>!t.priority&&t.type===type)),mixed=[];
      for(let j=0;j<Math.max(...buckets.map(b=>b.length),0);j++)for(const bucket of buckets)if(bucket[j])mixed.push(bucket[j]);
      for(const t of [...pool.filter(t=>t.priority),...mixed]){
        const nextMidnight=dateFrom(addDays(date,1));nextMidnight.setHours(0,0,0,0);
        if(!t.key||day.tasks.filter(x=>!x.done).length>=3||t.minutes>remaining||selected.has(t.id)||completed.some(d=>d.id===t.id)||t.notBefore&&t.notBefore>date||t.dueAt&&(i===0?t.dueAt>(input.now??Date.now()):t.dueAt>=nextMidnight.getTime()))continue;
        // A completed task may be done on an earlier day in this rolling week.
        if(done.some(d=>d.id===t.id&&d.day>=start))continue;
        if(t.type==='course'&&day.tasks.some(d=>d.type==='course'&&d.key===t.key))continue;
        day.tasks.push({...t,day:date});selected.add(t.id);remaining-=t.minutes;
      }
      day.unallocated=Math.max(0,remaining);
    }
    return days;
  }
  const api={DAY,SKILLS,normalize,parkCoach,resumeCoach,mathPrior,mathEvidence,noteMathExposure,bucket,evidence,nextSupport,numeric,quant,diagnose,dateKey,dateFrom,addDays,duration,week,priorQuestionIds,optionOrder,optionLabel};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.McatV2Core=api;
})(typeof window!=='undefined'?window:globalThis);
