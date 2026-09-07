/* MCAT repair sessions: authored lessons, first-exposure checks, and local evidence. */
const REPAIR_KEY = 'cs-mcat-repairs-v1';
let repairData = null, repairState = null, repairLoading = null, repairSaveFailed = false;
async function loadMcatRepairs() {
  if (repairData) return true;
  if (repairLoading) return repairLoading;
  repairLoading = (async () => {
    try {
      const response = await fetch('data/mcat-repairs.json?v=3');
      if (!response.ok) throw new Error('Repair lessons unavailable');
      const data = await response.json();
      if (data.version !== 1 || !Array.isArray(data.concepts) || !data.concepts.length) throw new Error('Invalid repair lessons');
      repairData = data;
      repairState = McatRepairCore.normalize(loadJSON(REPAIR_KEY, null), repairData.concepts);
      return true;
    } catch { return false; }
    finally { repairLoading = null; }
  })();
  return repairLoading;
}
function saveMcatRepair() {
  try { localStorage.setItem(REPAIR_KEY, JSON.stringify(repairState)); repairSaveFailed=false; }
  catch { repairSaveFailed=true; }
}
function setRepairView(root) {
  const footer=siteFooter();
  footer.querySelector('.sf-legal').textContent=footer.querySelector('.sf-legal').textContent.replace('Original study content with guided self-review.','Original educational pilot. Sources included with each lesson.');
  root.appendChild(footer);setView(root);
}
function repairDate(at) { return new Date(at).toLocaleString(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }); }
function repairConcept(id) { return repairData?.concepts.find(c => c.id === id); }
function repairStatsMarkup() {
  const s = McatRepairCore.stats(repairData.concepts,repairState);
  return `<div class="repair-evidence" aria-label="Learning evidence from the repair pilot">
    <div><strong>${s.practiced}/${repairData.concepts.length}</strong><span>Concepts practiced</span></div>
    <div><strong>${s.laterPassed}</strong><span>Passed a later check</span></div>
    <div><strong>${s.laterTotal ? `${s.laterCorrect}/${s.laterTotal}` : 'Not checked'}</strong><span>Correct on first attempts at later questions</span></div>
  </div><p class="repair-fine">Evidence from this 10-concept pilot, not an MCAT score or a mastery estimate. Repeated questions do not count as new evidence.</p>`;
}
function mountRepairDashboard(host, showEvidence = true) {
  if (!host) return;
  if (!repairData) {
    host.innerHTML='<div class="repair-priority"><h2>Five-minute repair sessions</h2><p>The lessons could not load. Your other study tools are ready.</p><button class="btn" data-repair-retry>Retry lessons</button></div>';
    host.querySelector('[data-repair-retry]').onclick=async () => { await loadMcatRepairs(); mountRepairDashboard(host, showEvidence); };
    return;
  }
  const recommendation=McatRepairCore.recommend(repairData.concepts,repairState,QLOG,Date.now());
  host.innerHTML=`<section class="repair-priority" aria-label="Your next concept session">
    <span class="label">${recommendation?.resume ? 'Session in progress' : recommendation?.kind === 'later' ? 'Check it again' : 'Five-minute focus'}</span>
    <h2>${recommendation ? esc(recommendation.concept.title) : 'Your next checks are scheduled.'}</h2>
    <p>${recommendation ? esc(recommendation.reason) : 'Keep following your study plan. Later checks will appear here when they are due.'}</p>
    <div class="repair-actions">${recommendation ? `<button class="btn btn-solid" data-repair-start>${recommendation.resume ? 'Continue session' : recommendation.kind === 'later' ? 'Start later check' : 'Start 5-minute session'} →</button>` : ''}<button class="ghostbtn" data-repair-library>All 10 concepts &amp; evidence</button></div>
    </section>${showEvidence ? repairStatsMarkup() : ''}`;
  host.querySelector('[data-repair-start]')?.addEventListener('click',() => launchRepairRecommendation(recommendation));
  host.querySelector('[data-repair-library]').onclick=renderRepairHub;
}
function launchRepairRecommendation(rec) {
  if (!rec) return renderRepairHub();
  if (!rec.resume) McatRepairCore.begin(rec.concept,repairState,rec.kind,Date.now());
  saveMcatRepair(); renderRepairSession();
}
async function startMcatQuickSession() {
  await loadMCAT();
  if (!repairData) return renderRepairHub();
  const rec=McatRepairCore.recommend(repairData.concepts,repairState,QLOG,Date.now());
  launchRepairRecommendation(rec);
}
async function renderRepairHub() {
  await loadMcatRepairs();
  const root=el('<div></div>'); root.appendChild(topbar('mcat'));
  const main=el(`<main class="panel repair-page"><button class="backbtn topback" id="repair-home">Back to MCAT plan</button><header><span class="label">MCAT · 10-concept pilot</span><h1>Work through one gap.</h1><p>A question to locate the gap, a short lesson, then a different application. Later checks return after at least 24 hours.</p></header><div id="repair-priority"></div><div class="repair-library"></div></main>`);
  mountRepairDashboard(main.querySelector('#repair-priority'));
  if (repairData) {
    const gaps=McatRepairCore.gaps(repairData.concepts,repairState,QLOG);
    main.querySelector('.repair-library').innerHTML=repairData.concepts.map(c => {
      const r=repairState.records[c.id];
      const isActive=repairState.active?.conceptId===c.id;
      const newChecks=McatRepairCore.unseenChecks(c,repairState).length;
      const due=r?.dueAt && r.dueAt <= Date.now() && newChecks;
      const gap=gaps.some(g => g.concept.id===c.id);
      const status=gap ? 'Recent miss to revisit' : McatRepairCore.status(c,repairState);
      const waiting=r?.dueAt > Date.now();
      const action=isActive ? 'Continue session' : due ? 'Start later check' : !(r?.attempts || []).some(a => a.mode !== 'diagnose') || gap ? 'Start session' : 'Review & practice';
      return `<article class="repair-library-row"><div><span class="label">${esc(SEC_ABBR[c.section])}</span><h2>${esc(c.title)}</h2><p>${esc(status)}</p>${waiting ? `<small>Next fresh check: ${esc(repairDate(r.dueAt))}</small>` : r?.attempts.length && !newChecks ? '<small>All authored applications have been seen. Further practice repeats questions.</small>' : ''}</div><button class="btn" data-repair-concept="${c.id}" ${repairState.active && !isActive ? 'disabled' : ''}>${action}</button></article>`;
    }).join('');
    main.querySelectorAll('[data-repair-concept]').forEach(b => b.onclick=() => {
      const c=repairConcept(b.dataset.repairConcept), r=repairState.records[c.id];
      if (repairState.active) return renderRepairSession();
      const kind=r?.dueAt && r.dueAt<=Date.now() && McatRepairCore.unseenChecks(c,repairState).length ? 'later' : !(r?.attempts || []).some(a => a.mode !== 'diagnose') || gaps.some(g => g.concept.id===c.id) ? 'repair' : 'practice';
      McatRepairCore.begin(c,repairState,kind,Date.now()); saveMcatRepair(); renderRepairSession();
    });
    if (repairState.active) main.querySelector('.repair-library').prepend(el('<p class="repair-fine">Finish your saved session before opening a different concept.</p>'));
  }
  main.querySelector('#repair-home').onclick=renderMCATEntry;
  root.appendChild(main); setRepairView(root);
}
function repairVisual(c) {
  if (c.id === 'enzyme-inhibition') {
    const curve = km => Array.from({length:81},(_,i) => { const x=i/4; return `${i?'L':'M'}${40+15*x},${175-130*x/(km+x)}`; }).join(' ');
    return `<figure class="repair-figure"><svg viewBox="0 0 410 235" role="img" aria-labelledby="repair-curve-title repair-curve-desc"><title id="repair-curve-title">Competitive inhibition shifts the curve right</title><desc id="repair-curve-desc">Both curves approach the same maximum rate. With competitive inhibitor, more substrate is required to reach half that rate. Curves are illustrative.</desc><path d="M40 30V175H345" fill="none" stroke="#657181"/><path d="M40 45H345 M40 110H345" stroke="#b6c1cd" stroke-dasharray="4 4"/><path d="${curve(2)}" fill="none" stroke="#17212d" stroke-width="3"/><path d="${curve(6)}" fill="none" stroke="#0b5cad" stroke-width="3"/><text x="350" y="48" font-size="12">Vmax</text><text x="347" y="114" font-size="11">½ Vmax</text><text x="40" y="20" font-size="13">Rate</text><text x="124" y="198" font-size="13">Substrate concentration →</text><path d="M43 220H65" stroke="#17212d" stroke-width="3"/><text x="72" y="224" font-size="12">No inhibitor</text><path d="M201 220H223" stroke="#0b5cad" stroke-width="3"/><text x="230" y="224" font-size="12">Competitive inhibitor</text></svg><figcaption>Same plateau. More substrate needed for the same rate below that plateau. Illustrative curves.</figcaption></figure>`;
  }
  if (c.id === 'operant-conditioning') return `<div class="repair-table-wrap"><table class="repair-table"><caption>Classify by the observed change in behavior</caption><thead><tr><th scope="col">Consequence</th><th scope="col">Behavior increases</th><th scope="col">Behavior decreases</th></tr></thead><tbody><tr><th scope="row">Added</th><td>Positive reinforcement</td><td>Positive punishment</td></tr><tr><th scope="row">Removed</th><td>Negative reinforcement</td><td>Negative punishment</td></tr></tbody></table></div>`;
  if (c.id === 'inheritance') return `<div class="repair-table-wrap"><table class="repair-table"><caption>Aa × Aa: each cell has probability 1/4</caption><thead><tr><th scope="col">Gametes</th><th scope="col">A</th><th scope="col">a</th></tr></thead><tbody><tr><th scope="row">A</th><td>AA · unaffected</td><td>Aa · carrier</td></tr><tr><th scope="row">a</th><td>Aa · carrier</td><td>aa · affected</td></tr></tbody></table></div>`;
  return '';
}
function repairLessonMarkup(c) {
  return `<section class="repair-lesson"><span class="label">The missing idea</span><h1>${esc(c.title)}</h1><p class="repair-lead">${esc(c.lesson)}</p>
    ${repairVisual(c)}<ol class="repair-map" aria-label="Concept map">${c.diagram.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
    <aside class="repair-distinction"><strong>Keep this distinction</strong><p>${esc(c.distinction)}</p></aside>
    <p class="repair-source">Concept reference: <a href="${esc(c.source.url)}" target="_blank" rel="noopener">${esc(c.source.title)}</a>${(c.additionalSources || []).map(source => ` · <a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)}</a>`).join('')}. Original Cortex questions.</p>
    <button class="btn btn-solid" id="repair-next">${repairState.active.lessonAfterCheck ? 'See session result' : repairState.active.kind==='practice' ? 'Practice a seen question' : 'Try a different question'} →</button></section>`;
}
function renderRepairSession() {
  const a=repairState?.active, c=repairConcept(a?.conceptId);
  if (!a || !c) return renderRepairHub();
  if (location.pathname !== '/mcat') { const url=new URL(location.href); url.pathname='/mcat'; history.pushState({sec:'mcat'},'',url.pathname+url.search); }
  const root=el(`<div>${mcatTaskHeader(['Repair'],'<span class="topstat">5 min</span>','Exit')}</div>`);
  const step=['diagnose','feedback'].includes(a.phase) && a.questionId===c.diagnostic.id ? 0 : a.phase==='lesson' ? 1 : a.phase==='done' ? 3 : 2;
  const main=el(`<main class="panel repair-page repair-session"><div class="repair-stepper" aria-label="Session progress">${['Find the gap','Learn','Apply','Evidence'].map((s,i)=>`<span ${i===step ? 'aria-current="step"' : ''}>${i+1} · ${s}</span>`).join('')}</div><div id="repair-stage"></div>${repairSaveFailed ? '<p class="repair-warning" role="status">Your browser could not save this session. Keep this tab open to continue.</p>' : '<p class="repair-save">Progress saves on this device.</p>'}</main>`);
  const stage=main.querySelector('#repair-stage');
  if (a.phase==='lesson') {
    stage.innerHTML=repairLessonMarkup(c);
    stage.querySelector('#repair-next').onclick=() => { if(a.lessonAfterCheck){a.phase='done';a.lessonAfterCheck=false;}else McatRepairCore.afterLesson(c,repairState); saveMcatRepair();renderRepairSession(); };
  } else if(a.phase==='done') {
    studyCompleteRepair(a);
    const r=repairState.records[c.id], result=a.result;
    stage.innerHTML=`<section class="repair-result"><span class="label">Session evidence</span><h1>${esc(McatRepairCore.status(c,repairState))}</h1>
      <p>${result?.mode==='practice' ? 'This was a previously seen question. The result is saved as practice, not a new or delayed pass.' : result?.correct ? 'You answered this application correctly. That is evidence for this concept, not a prediction of your MCAT score.' : 'This application still needs practice. The explanation is available below.'}</p>
      ${r?.dueAt ? `<div class="repair-next-check"><strong>Your next fresh check</strong><span>${esc(repairDate(r.dueAt))}</span><p>It will appear on your MCAT plan. Opening the lesson early will not use up that question.</p></div>` : '<p>All three authored application questions have now been seen. You can keep practicing; repeats will be labeled.</p>'}
      <details><summary>Review the key idea</summary><p>${esc(c.lesson)}</p><p>${esc(c.distinction)}</p></details>
      <div class="repair-actions"><button class="btn btn-solid" id="repair-finish">Back to my MCAT plan →</button><button class="btn" id="repair-evidence">View concept evidence</button></div></section>`;
    const finish=where => { repairState.active=null;saveMcatRepair();where(); };
    stage.querySelector('#repair-finish').onclick=()=>finish(renderMCATEntry);
    stage.querySelector('#repair-evidence').onclick=()=>finish(renderRepairHub);
  } else {
    const q=[c.diagnostic,...c.checks].find(q=>q.id===a.questionId);
    const answered=a.phase==='feedback';
    const first=!(repairState.records[c.id]?.attempts || []).some(x=>x.questionId===q.id);
    const label=a.phase==='diagnose' || (answered && a.result.mode==='diagnose') ? 'Find the gap' : a.kind==='later' ? 'Later check · answer before review' : a.kind==='practice' || (!first && !answered) ? 'Practice · previously seen question' : 'Apply the idea · new question';
    stage.innerHTML=`<section class="repair-question"><span class="label">${label}</span><h1>${a.kind==='later' ? 'What can you retrieve now?' : 'Test the idea.'}</h1><p class="repair-stem">${esc(q.stem)}</p>
      <fieldset class="repair-confidence" ${answered ? 'disabled' : ''}><legend>How sure are you?</legend>${['guess','unsure','sure'].map(v=>`<label><input type="radio" name="repair-confidence" value="${v}" ${a.confidence===v ? 'checked' : ''}>${CONF[v]}</label>`).join('')}</fieldset>
      <div class="opts">${q.options.map((option,i)=>`<button class="opt ${answered ? i===q.answer ? 'correct' : i===a.result.choice ? 'wrong' : 'dimmed' : ''}" data-repair-answer="${i}" ${answered?'disabled':''}><span class="key">${'ABCD'[i]}</span><span>${esc(option)}${answered && i===q.answer ? ' · Correct answer' : answered && i===a.result.choice ? ' · Your answer' : ''}</span></button>`).join('')}</div>
      ${answered ? `<section class="repair-feedback" role="status"><strong>${a.result.correct?'Correct':'Not yet'}</strong><p>${esc(q.explanation)}</p>${a.result.mode==='diagnose' ? `<p>${a.result.correct ? 'Now connect that answer to the underlying idea.' : 'Use the short lesson to work through this distinction.'}</p>` : ''}<button class="btn btn-solid" id="repair-next">${a.result.mode==='diagnose'?'Read the short lesson':a.result.correct?'See the evidence':'Work through the explanation'} →</button></section>` : '<p class="repair-fine">Choose an answer to lock it and see feedback.</p>'}</section>`;
    stage.querySelectorAll('[name="repair-confidence"]').forEach(radio=>radio.onchange=()=>{a.confidence=radio.value;saveMcatRepair();});
    stage.querySelectorAll('[data-repair-answer]').forEach(b=>b.onclick=()=>{McatRepairCore.answer(c,repairState,Number(b.dataset.repairAnswer),a.confidence,Date.now());saveMcatRepair();renderRepairSession();});
    stage.querySelector('#repair-next')?.addEventListener('click',()=>{
      if(a.result.mode==='diagnose') a.phase='lesson';
      else if(a.result.correct) a.phase='done';
      else {a.phase='lesson';a.lessonAfterCheck=true;}
      saveMcatRepair();renderRepairSession();
    });
  }
  wireRunHeader(root,renderMCATEntry);
  root.appendChild(main);setRepairView(root);
}
