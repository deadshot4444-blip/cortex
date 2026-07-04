/* ============================================================================
   Cortex · Genetics interactive figures (Module 3)
   Textbook-fidelity, original interactive SVG diagrams. Registry: window.GEN_FIGS.
   Each figure: GEN_FIGS[id](hostEl, opts) -> mounts an interactive figure.
   Shares one visual toolkit (gradients, shadows, protein/gene/DNA primitives).
   Loaded after genetics.js. No external assets; all inline SVG.
   ========================================================================= */
(function () {
  'use strict';
  function el(h){const t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstChild;}

  /* ---------- shared gradient/shadow defs (one per figure svg) ---------- */
  const FIG_DEFS = `
  <defs>
    <linearGradient id="dnaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c7d0da"/><stop offset=".5" stop-color="#aab6c4"/><stop offset="1" stop-color="#8b9aab"/></linearGradient>
    <linearGradient id="dnaG2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7c7b0"/><stop offset="1" stop-color="#b39b78"/></linearGradient>
    <linearGradient id="capG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4cc0a8"/><stop offset="1" stop-color="#1f8f78"/></linearGradient>
    <linearGradient id="promG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2c14e"/><stop offset="1" stop-color="#c78a1f"/></linearGradient>
    <linearGradient id="opG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8697a"/><stop offset="1" stop-color="#b81f3a"/></linearGradient>
    <linearGradient id="termG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f7bd6"/><stop offset="1" stop-color="#5b45a8"/></linearGradient>
    <linearGradient id="dimG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe2e8"/><stop offset="1" stop-color="#c3c8d2"/></linearGradient>
    <linearGradient id="geneG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f8fd6"/><stop offset="1" stop-color="#3f5fa8"/></linearGradient>
    <linearGradient id="exonG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f8fd6"/><stop offset="1" stop-color="#3f5fa8"/></linearGradient>
    <linearGradient id="intronG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6e2b0"/><stop offset="1" stop-color="#cabf7e"/></linearGradient>
    <linearGradient id="reggeneG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa2af"/><stop offset="1" stop-color="#6d7686"/></linearGradient>
    <radialGradient id="repG" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#f07d8c"/><stop offset=".55" stop-color="#d33a52"/><stop offset="1" stop-color="#9c1730"/></radialGradient>
    <radialGradient id="capprotG" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#5fd3b9"/><stop offset=".55" stop-color="#22a488"/><stop offset="1" stop-color="#116b57"/></radialGradient>
    <radialGradient id="polG" cx=".38" cy=".28" r=".85"><stop offset="0" stop-color="#5b6a86"/><stop offset=".5" stop-color="#38455f"/><stop offset="1" stop-color="#1f2942"/></radialGradient>
    <radialGradient id="molG" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffd98a"/><stop offset="1" stop-color="#d99a24"/></radialGradient>
    <radialGradient id="riboLG" cx=".4" cy=".3" r=".85"><stop offset="0" stop-color="#c9a3d8"/><stop offset=".55" stop-color="#9c6cb8"/><stop offset="1" stop-color="#6e4488"/></radialGradient>
    <radialGradient id="riboSG" cx=".4" cy=".3" r=".85"><stop offset="0" stop-color="#e0b6c4"/><stop offset=".55" stop-color="#c07f96"/><stop offset="1" stop-color="#8f4f66"/></radialGradient>
    <linearGradient id="mrnaG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e8663a"/><stop offset="1" stop-color="#f0a35e"/></linearGradient>
    <linearGradient id="trnaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb8d8"/><stop offset="1" stop-color="#4a86ac"/></linearGradient>
    <filter id="softsh" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="1.4" stdDeviation="1.6" flood-color="#243049" flood-opacity=".28"/></filter>
    <filter id="protsh" x="-40%" y="-40%" width="180%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2.4" flood-color="#243049" flood-opacity=".34"/></filter>
    <marker id="mrnaArr" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto"><path d="M0,1 L8,5 L0,9 Z" fill="#e8663a"/></marker>
    <marker id="blkArr" markerWidth="9" markerHeight="9" refX="6" refY="4.5" orient="auto"><path d="M0,1 L7,4.5 L0,8 Z" fill="#38455f"/></marker>
  </defs>`;

  /* ---------- primitives (y0 = current figure DNA baseline) ---------- */
  let y0 = 150;
  function setBaseline(y){ y0 = y; }
  function duplex(x1,x2,y){ return `<g><rect x="${x1}" y="${y-7}" width="${x2-x1}" height="14" rx="7" fill="url(#dnaG)" filter="url(#softsh)"/><rect x="${x1}" y="${y-7}" width="${x2-x1}" height="4.5" rx="2.2" fill="#fff" opacity=".35"/></g>`; }
  function tile(x,w,grad,letter,sub){
    let s=`<g filter="url(#softsh)"><rect x="${x}" y="${y0-15}" width="${w}" height="30" rx="5" fill="url(#${grad})"/><rect x="${x+2}" y="${y0-13}" width="${w-4}" height="9" rx="4" fill="#fff" opacity=".22"/><text x="${x+w/2}" y="${y0+4}" text-anchor="middle" fill="#fff" style="font:700 12px var(--mono,monospace)">${letter}</text></g>`;
    if(sub) s+=`<text x="${x+w/2}" y="${y0+29}" text-anchor="middle" fill="#6b6b76" style="font:600 9.5px var(--sans,sans-serif)">${sub}</text>`;
    return s;
  }
  function gene(x,w,label,sub,grad){
    grad=grad||'geneG'; const h=30,t=13,yt=y0-h/2;
    const d=`M${x},${yt} H${x+w-t} L${x+w},${y0} L${x+w-t},${yt+h} H${x} Z`;
    let s=`<g filter="url(#softsh)"><path d="${d}" fill="url(#${grad})"/><path d="M${x+2},${yt+2} H${x+w-t-2} L${x+w-4},${y0} L${x+w-t-2},${yt+h-2} H${x+2} Z" fill="#fff" opacity=".12"/><text x="${x+(w-t)/2}" y="${y0+4}" text-anchor="middle" fill="#fff" style="font:italic 700 12px var(--sans,sans-serif)">${label}</text></g>`;
    if(sub) s+=`<text x="${x+w/2}" y="${y0+30}" text-anchor="middle" fill="#6b6b76" style="font:600 9.5px var(--sans,sans-serif)">${sub}</text>`;
    return s;
  }
  function prot(cx,cy,rx,ry,grad,label,lobes){
    lobes=lobes||1; let s=`<g filter="url(#protsh)">`;
    if(lobes===2){ s+=`<ellipse cx="${cx-rx*0.5}" cy="${cy}" rx="${rx*0.72}" ry="${ry}" fill="url(#${grad})"/><ellipse cx="${cx+rx*0.5}" cy="${cy}" rx="${rx*0.72}" ry="${ry}" fill="url(#${grad})"/>`; }
    else { s+=`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${grad})"/>`; }
    s+=`<ellipse cx="${cx-rx*0.3}" cy="${cy-ry*0.4}" rx="${rx*0.4}" ry="${ry*0.35}" fill="#fff" opacity=".22"/>`;
    if(label) s+=`<text x="${cx}" y="${cy+3.5}" text-anchor="middle" fill="#fff" style="font:700 9px var(--sans,sans-serif)">${label}</text>`;
    return s+`</g>`;
  }
  function mol(cx,cy){ return `<g filter="url(#protsh)"><circle cx="${cx}" cy="${cy}" r="7" fill="url(#molG)"/><circle cx="${cx-2}" cy="${cy-2}" r="2.4" fill="#fff" opacity=".5"/></g>`; }
  function cap(w,h,cls){ return {w,h}; }
  function svgOpen(W,H,label){ return `<svg viewBox="0 0 ${W} ${H}" class="gen-fig-svg" role="img" aria-label="${label}">${FIG_DEFS}`; }

  /* shell builder: title-less figure card with optional controls + status + note */
  function makeFig(host){
    const wrap=el('<div class="gen-fig"></div>');
    const svgHost=el('<div class="gen-fig-svgwrap"></div>'); wrap.appendChild(svgHost);
    const ctrls=el('<div class="gen-fig-ctrls"></div>'); wrap.appendChild(ctrls);
    const status=el('<div class="gen-fig-status"></div>'); wrap.appendChild(status);
    const note=el('<div class="gen-fig-note"></div>'); wrap.appendChild(note);
    host.appendChild(wrap);
    return {wrap,svgHost,ctrls,status,note};
  }
  function toggle(label,on){ const b=el(`<button class="gen-fig-toggle${on?' on':''}"><span class="dot"></span>${label}</button>`); return b; }
  function stepBtn(label){ return el(`<button class="gen-fig-step">${label}</button>`); }

  const GEN_FIGS = {};

  /* ============ FIG: lac operon (ch12-lac / ch12-lacgeno) — flagship ============ */
  GEN_FIGS.lacOperon = function(host){
    const F=makeFig(host); const state={lactose:false,glucose:true};
    let anim=0, raf=0;
    const W=660,H=250;
    const CAP=[168,52],PROM=[224,42],OP=[268,50],gZ=[366,92],gY=[462,86],gA=[552,88];
    function frame(){
      setBaseline(150);
      const {lactose,glucose}=state, repBound=!lactose, capBound=!glucose, on=!repBound, strong=on&&capBound;
      let s=svgOpen(W,H,'lac operon regulation');
      s+=duplex(20,W-20,y0);
      s+=`<g filter="url(#softsh)"><path d="M28,${y0-15} H86 L98,${y0} L86,${y0+15} H28 Z" fill="url(#reggeneG)"/></g>`;
      s+=`<text x="60" y="${y0+4}" text-anchor="middle" fill="#fff" style="font:italic 700 12px var(--sans)">lacI</text>`;
      s+=`<text x="60" y="${y0+30}" text-anchor="middle" fill="#6b6b76" style="font:600 9.5px var(--sans)">repressor gene</text>`;
      s+=tile(CAP[0],CAP[1],capBound?'capG':'dimG','CAP','CAP site');
      s+=tile(PROM[0],PROM[1],'promG','P','');
      s+=tile(OP[0],OP[1],repBound?'opG':'dimG','O','');
      s+=`<text x="${(PROM[0]+OP[0]+OP[1])/2}" y="${y0+29}" text-anchor="middle" fill="#6b6b76" style="font:600 8.5px var(--sans)">promoter · operator</text>`;
      s+=gene(gZ[0],gZ[1],'lacZ','β-galactosidase');
      s+=gene(gY[0],gY[1],'lacY','permease');
      s+=gene(gA[0],gA[1],'lacA','transacetylase');
      if(capBound){ s+=prot(CAP[0]+CAP[1]/2,y0-30,21,15,'capprotG','CAP',2); s+=mol(CAP[0]+CAP[1]/2-24,y0-30); }
      if(repBound){ s+=prot(OP[0]+OP[1]/2,y0-30,24,17,'repG','repressor',2); }
      else { s+=`<g opacity="${lactose?1:0.001}">`+prot(150,52,22,15,'repG','repressor',2)+mol(180,54)+`<text x="180" y="34" text-anchor="middle" fill="#6b6b76" style="font:600 9px var(--sans)">allolactose</text></g>`; }
      if(on){
        const t=anim, startX=PROM[0]+PROM[1]/2, endX=gA[0]+gA[1]-14, polX=startX+(endX-startX)*t, mEnd=polX-24;
        s+=`<path d="M${startX-6},${y0+30} Q${(startX+mEnd)/2},${y0+44} ${mEnd},${y0+30}" fill="none" stroke="url(#mrnaG)" stroke-width="${strong?4.5:2.8}" stroke-linecap="round" marker-end="url(#mrnaArr)"/>`;
        s+=`<text x="${startX+6}" y="${y0+52}" fill="#c65a2e" style="font:600 10px var(--sans)">mRNA · ${strong?'HIGH':'low (basal)'}</text>`;
        s+=`<g filter="url(#protsh)" transform="translate(${polX},${y0-3})"><path d="M-23,-3 q-6,-18 13,-18 q20,0 20,14 q0,6 -5,8 q5,3 5,9 q0,14 -20,14 q-18,0 -13,-17 q-4,-3 -4,-7 q0,-5 4,-7 Z" fill="url(#polG)"/><ellipse cx="-7" cy="-9" rx="8" ry="5" fill="#fff" opacity=".18"/></g>`;
        s+=`<text x="${polX}" y="${y0-26}" text-anchor="middle" fill="#38455f" style="font:700 8.5px var(--sans)">RNA polymerase</text>`;
      } else {
        s+=`<line x1="${gZ[0]}" y1="${y0+30}" x2="${gA[0]+gA[1]}" y2="${y0+30}" stroke="#d0d3da" stroke-width="2.4" stroke-dasharray="2 6" stroke-linecap="round"/>`;
        s+=`<text x="${(gZ[0]+gA[0]+gA[1])/2}" y="${y0+52}" text-anchor="middle" fill="#c0392b" style="font:600 10.5px var(--sans)">no transcription</text>`;
      }
      s+=`</svg>`; F.svgHost.innerHTML=s;
      F.status.textContent=on?(strong?'OPERON ON — high expression':'OPERON ON — basal expression'):'OPERON OFF';
      F.status.className='gen-fig-status '+(on?'on':'off');
      const p=[]; p.push(lactose?'Lactose is converted to allolactose, which binds the repressor and pulls it off the operator.':'No lactose → the repressor stays active and clamps the operator, blocking RNA polymerase.');
      if(on)p.push(glucose?'Glucose present → cAMP low → CAP unbound → only weak, basal transcription.':'Glucose absent → cAMP high → CAP binds and recruits RNA polymerase → strong transcription.');
      F.note.textContent=p.join(' ');
      tL.classList.toggle('on',lactose); tG.classList.toggle('on',glucose);
    }
    function loop(){ if(!state.lactose){anim=0;frame();return;} anim+=0.006; if(anim>=1)anim=0; frame(); raf=requestAnimationFrame(loop); }
    function restart(){ cancelAnimationFrame(raf); anim=0; if(state.lactose)raf=requestAnimationFrame(loop); else frame(); }
    const tL=toggle('Lactose',false), tG=toggle('Glucose',true);
    tL.addEventListener('click',()=>{state.lactose=!state.lactose;restart();});
    tG.addEventListener('click',()=>{state.glucose=!state.glucose;frame();});
    F.ctrls.append(tL,tG); restart();
  };

  /* ============ FIG: transcription unit + bubble (ch10-txunit / transcription) ============ */
  GEN_FIGS.txUnit = function(host){
    const F=makeFig(host); setBaseline(150);
    let playing=true, anim=0, raf=0;
    const W=680,H=250;
    const prom=[150,60], start=224, code=[250,360], term=[520,54];
    function render(){
      setBaseline(150);
      let s=svgOpen(W,H,'transcription unit');
      s+=duplex(24,W-24,y0);
      // coding vs template strand labels
      s+=`<text x="30" y="${y0-14}" fill="#6b6b76" style="font:600 9px var(--sans)">5′ coding (nontemplate) 3′</text>`;
      s+=`<text x="30" y="${y0+26}" fill="#6b6b76" style="font:600 9px var(--sans)">3′ template 5′</text>`;
      // elements
      s+=tile(prom[0],prom[1],'promG','−35 −10','promoter');
      s+=`<text x="${start}" y="${y0-16}" text-anchor="middle" fill="#1a7f37" style="font:700 10px var(--mono)">+1</text><path d="M${start},${y0-11} l0,-14 l14,7 z" fill="#1a7f37"/>`;
      s+=`<text x="${start}" y="${y0-30}" text-anchor="middle" fill="#1a7f37" style="font:600 9px var(--sans)">start</text>`;
      s+=`<rect x="${code[0]}" y="${y0-8}" width="${code[1]-code[0]}" height="16" rx="3" fill="url(#geneG)" opacity=".55"/><text x="${(code[0]+code[1])/2}" y="${y0+4}" text-anchor="middle" fill="#243049" style="font:600 10px var(--sans)">RNA-coding region</text>`;
      s+=tile(term[0],term[1],'termG','T','terminator');
      // polymerase + growing RNA
      const t=anim, px=start+(term[0]-start)*t;
      s+=`<path d="M${start-4},${y0+34} Q${(start+px)/2},${y0+48} ${px-22},${y0+34}" fill="none" stroke="url(#mrnaG)" stroke-width="3.4" stroke-linecap="round" marker-end="url(#mrnaArr)"/>`;
      s+=`<text x="${start}" y="${y0+58}" fill="#c65a2e" style="font:600 10px var(--sans)">RNA 5′→3′</text>`;
      s+=`<g filter="url(#protsh)" transform="translate(${px},${y0-2})"><path d="M-23,-3 q-6,-18 13,-18 q20,0 20,14 q0,6 -5,8 q5,3 5,9 q0,14 -20,14 q-18,0 -13,-17 q-4,-3 -4,-7 q0,-5 4,-7 Z" fill="url(#polG)"/><ellipse cx="-7" cy="-9" rx="8" ry="5" fill="#fff" opacity=".18"/></g>`;
      s+=`<text x="${px}" y="${y0-26}" text-anchor="middle" fill="#38455f" style="font:700 8.5px var(--sans)">RNA polymerase</text>`;
      s+=`</svg>`;
      F.svgHost.innerHTML=s;
      F.status.textContent='TRANSCRIPTION UNIT'; F.status.className='gen-fig-status on';
      F.note.textContent='RNA polymerase binds the promoter, starts at +1, and reads the template strand 3′→5′ while building RNA 5′→3′ until the terminator. The RNA matches the coding strand (U for T).';
    }
    function loop(){ if(!playing){render();return;} anim+=0.005; if(anim>=1)anim=0; render(); raf=requestAnimationFrame(loop); }
    const play=toggle('Animate',true);
    play.addEventListener('click',()=>{playing=!playing;play.classList.toggle('on',playing);cancelAnimationFrame(raf);if(playing)raf=requestAnimationFrame(loop);else render();});
    F.ctrls.appendChild(play);
    raf=requestAnimationFrame(loop);
  };

  /* ============ FIG: tRNA cloverleaf (ch10-trna) ============ */
  GEN_FIGS.tRNA = function(host){
    const F=makeFig(host);
    const W=440,H=320, hx=220, hy=150;
    // a capsule "arm" (stem+loop) pointing down from hub, rotated by deg; returns far-end point
    function arm(deg,len,w,label,labelIn){
      const rad=deg*Math.PI/180, ex=hx+len*Math.sin(rad), ey=hy+len*Math.cos(rad);
      let s=`<g filter="url(#softsh)"><rect x="${hx-w/2}" y="${hy-6}" width="${w}" height="${len+12}" rx="${w/2}" fill="url(#trnaG)" transform="rotate(${deg} ${hx} ${hy})"/>`;
      // subtle highlight
      s+=`<rect x="${hx-w/2+3}" y="${hy-3}" width="${w-6}" height="${len}" rx="${(w-6)/2}" fill="#fff" opacity=".13" transform="rotate(${deg} ${hx} ${hy})"/></g>`;
      return {s, ex, ey};
    }
    function render(){
      let s=svgOpen(W,H,'tRNA cloverleaf structure');
      // central hub
      let g='';
      const dArm=arm(-58,96,30,'D'), acArm=arm(0,104,32,'AC'), tArm=arm(58,96,30,'T');
      // acceptor stem points UP (deg 180 -> up), thinner
      const acc=arm(180,104,20,'acc');
      g+=acc.s+dArm.s+acArm.s+tArm.s;
      // hub cap to merge visually
      g+=`<circle cx="${hx}" cy="${hy}" r="20" fill="url(#trnaG)"/>`;
      s+=g;
      // amino acid at top of acceptor stem
      const topx=acc.ex, topy=acc.ey;
      s+=prot(topx,topy-10,15,12,'molG','aa');
      s+=`<text x="${topx}" y="${topy-28}" text-anchor="middle" fill="#6b6b76" style="font:600 9.5px var(--sans)">amino acid</text>`;
      s+=`<text x="${topx+16}" y="${topy+4}" fill="#6b6b76" style="font:600 9px var(--mono)">3′ CCA</text>`;
      s+=`<text x="${topx-16}" y="${topy+4}" text-anchor="end" fill="#6b6b76" style="font:600 9px var(--mono)">5′</text>`;
      // arm labels near loop ends
      s+=`<text x="${dArm.ex-6}" y="${dArm.ey+4}" text-anchor="end" fill="#38455f" style="font:700 9.5px var(--sans)">D arm</text>`;
      s+=`<text x="${tArm.ex+6}" y="${tArm.ey+4}" fill="#38455f" style="font:700 9.5px var(--sans)">TΨC arm</text>`;
      // anticodon at bottom loop
      s+=`<rect x="${acArm.ex-38}" y="${acArm.ey-1}" width="76" height="21" rx="5" fill="#fff" stroke="#4a86ac" stroke-width="1.5"/><text x="${acArm.ex}" y="${acArm.ey+13.5}" text-anchor="middle" fill="#2b5a74" style="font:700 10px var(--mono)">anticodon</text>`;
      s+=`</svg>`;
      F.svgHost.innerHTML=s;
      F.status.textContent='tRNA — CLOVERLEAF'; F.status.className='gen-fig-status on';
      F.note.textContent='Each tRNA folds into a four-armed cloverleaf. The acceptor arm carries the amino acid on its 3′ CCA end; the anticodon arm base-pairs (antiparallel) with the mRNA codon.';
    }
    render();
  };

  /* ============ FIG: pre-mRNA processing (ch10-processing) ============ */
  GEN_FIGS.processing = function(host){
    const F=makeFig(host);
    let step=0; const STEPS=4; // 0 pre-mRNA, 1 cap, 2 tail, 3 spliced
    const W=680,H=200;
    function render(){
      const capd=step>=1, taild=step>=2, spliced=step>=3;
      const y=96; const ex=[[120,70],[300,64],[470,74]]; const inW=46;
      let s=svgOpen(W,H,'pre-mRNA processing');
      // strand line
      const x0=90, x1=560;
      s+=`<line x1="${x0}" y1="${y}" x2="${spliced?x0+ (ex[0][1]+ex[1][1]+ex[2][1]) +90:x1}" y2="${y}" stroke="#c3c8d2" stroke-width="4" stroke-linecap="round"/>`;
      if(!spliced){
        // exons + introns laid out
        let cx=x0+20;
        const layout=[];
        ex.forEach((e,i)=>{ layout.push(['ex',cx,e[1],i+1]); cx+=e[1]; if(i<ex.length-1){ layout.push(['in',cx,inW]); cx+=inW; } });
        layout.forEach(seg=>{
          if(seg[0]==='ex'){ s+=`<rect x="${seg[1]}" y="${y-13}" width="${seg[2]}" height="26" rx="3" fill="url(#exonG)" filter="url(#softsh)"/><text x="${seg[1]+seg[2]/2}" y="${y+4}" text-anchor="middle" fill="#fff" style="font:700 10px var(--sans)">E${seg[3]}</text>`; }
          else { s+=`<path d="M${seg[1]},${y} q${seg[2]/2},22 ${seg[2]},0" fill="none" stroke="url(#intronG)" stroke-width="7"/><text x="${seg[1]+seg[2]/2}" y="${y+30}" text-anchor="middle" fill="#a99537" style="font:600 8.5px var(--sans)">intron</text>`; }
        });
      } else {
        let cx=x0+20; ex.forEach((e,i)=>{ s+=`<rect x="${cx}" y="${y-13}" width="${e[1]}" height="26" rx="3" fill="url(#exonG)" filter="url(#softsh)"/><text x="${cx+e[1]/2}" y="${y+4}" text-anchor="middle" fill="#fff" style="font:700 10px var(--sans)">E${i+1}</text>`; cx+=e[1]; });
        s+=`<text x="${x0+20+(ex[0][1]+ex[1][1]+ex[2][1])/2}" y="${y+34}" text-anchor="middle" fill="#3f5fa8" style="font:600 9px var(--sans)">introns removed · exons joined</text>`;
      }
      // 5' cap
      if(capd){ s+=prot(x0-2,y,11,10,'capprotG','m7G'); s+=`<text x="${x0-2}" y="${y-20}" text-anchor="middle" fill="#116b57" style="font:600 8.5px var(--sans)">5′ cap</text>`; }
      else { s+=`<text x="${x0-2}" y="${y+4}" text-anchor="middle" fill="#c3c8d2" style="font:700 14px var(--sans)">5′</text>`; }
      // 3' poly-A tail
      const tailX = spliced ? x0+20+(ex[0][1]+ex[1][1]+ex[2][1]) : x1;
      if(taild){ let tx=tailX; for(let i=0;i<5;i++){ s+=`<circle cx="${tx+i*12}" cy="${y}" r="4.5" fill="#d99a24"/>`;} s+=`<text x="${tailX+30}" y="${y-14}" text-anchor="middle" fill="#a86f14" style="font:600 8.5px var(--sans)">poly(A) tail</text>`; }
      else { s+=`<text x="${tailX}" y="${y+4}" text-anchor="middle" fill="#c3c8d2" style="font:700 14px var(--sans)">3′</text>`; }
      s+=`</svg>`;
      F.svgHost.innerHTML=s;
      const labs=['Pre-mRNA (introns + exons)','Added 5′ cap (m7G)','Added 3′ poly(A) tail','Spliced → mature mRNA'];
      F.status.textContent=labs[step].toUpperCase(); F.status.className='gen-fig-status on';
      const notes=['Freshly transcribed pre-mRNA still contains introns and lacks its ends. Three processing steps make it a mature, exportable mRNA.',
        'A modified guanine (7-methylguanosine) cap is added to the 5′ end — it protects the RNA and helps ribosome binding.',
        'A poly(A) tail is added downstream of the AAUAAA signal at the 3′ end, aiding stability and export.',
        'The spliceosome removes introns and joins exons. Only exons remain in the mature mRNA.'];
      F.note.textContent=notes[step];
    }
    const prev=stepBtn('‹ Back'), next=stepBtn('Next step ›');
    prev.addEventListener('click',()=>{step=Math.max(0,step-1);render();});
    next.addEventListener('click',()=>{step=Math.min(STEPS-1,step+1);render();});
    F.ctrls.append(prev,next); render();
  };

  /* ============ FIG: ribosome elongation A/P/E (ch11-elong-term / ribosome) ============ */
  GEN_FIGS.ribosome = function(host){
    const F=makeFig(host);
    let step=0; const N=4; // 0: A empty  1: aa-tRNA in A  2: peptide bond  3: translocation
    const W=560,H=280;
    const cx=280, mY=176;                 // mRNA line y
    const sites={E:cx-64,P:cx,A:cx+64};   // codon x-centers
    function trna(x, topY, aa, occupied, label){
      if(!occupied) return '';
      let s=`<g filter="url(#softsh)">`;
      // tRNA body (small stylized L: stem down to mRNA, loop up)
      s+=`<path d="M${x-9},${mY-8} L${x-9},${topY+14} Q${x-9},${topY} ${x},${topY} Q${x+9},${topY} ${x+9},${topY+14} L${x+9},${mY-8} Z" fill="url(#trnaG)"/>`;
      s+=`<rect x="${x-8}" y="${mY-10}" width="16" height="10" rx="2" fill="url(#trnaG)"/>`;
      // amino acid bead on top
      if(aa) s+=`<circle cx="${x}" cy="${topY-2}" r="9" fill="url(#molG)"/>`;
      s+=`</g>`;
      if(label) s+=`<text x="${x}" y="${mY+26}" text-anchor="middle" fill="#2b5a74" style="font:700 8.5px var(--mono)">${label}</text>`;
      return s;
    }
    function render(){
      const aInA = step>=1, bonded=step>=2, moved=step>=3;
      const pOcc = !moved, eOcc=moved; // after translocation, P->E, A->P (simplified)
      let s=svgOpen(W,H,'ribosome elongation cycle');
      // mRNA ribbon with codons
      s+=`<rect x="60" y="${mY-5}" width="440" height="10" rx="5" fill="url(#mrnaG)" filter="url(#softsh)"/>`;
      s+=`<text x="66" y="${mY-12}" fill="#c65a2e" style="font:600 9px var(--sans)">5′ mRNA</text><text x="494" y="${mY-12}" text-anchor="end" fill="#c65a2e" style="font:600 9px var(--sans)">3′</text>`;
      // codon ticks
      [-2,-1,0,1,2].forEach(k=>{ const x=cx+k*64; s+=`<line x1="${x-9}" y1="${mY+5}" x2="${x-9}" y2="${mY+9}" stroke="#b5532b"/><line x1="${x+9}" y1="${mY+5}" x2="${x+9}" y2="${mY+9}" stroke="#b5532b"/>`; });
      // tRNAs (behind subunits): P-site tRNA (peptidyl) and A-site (incoming)
      const topY=110;
      s+=trna(sites.E, topY, false, eOcc, moved?'E':'');
      s+=trna(sites.P, topY, !moved, pOcc, 'P');
      s+=trna(sites.A, topY, aInA, aInA, aInA?'A':'');
      // large + small subunits (drawn over the tRNA stems, with a channel gap at mRNA)
      s+=`<g filter="url(#protsh)"><path d="M${cx-118},${mY-6} q-16,-78 118,-78 q134,0 118,78 q-4,20 -30,20 q-30,0 -30,-14 h-116 q0,14 -30,14 q-26,0 -30,-20 Z" fill="url(#riboLG)"/></g>`;
      s+=`<text x="${cx}" y="${mY-40}" text-anchor="middle" fill="#fff" style="font:700 10px var(--sans)">large subunit (50S)</text>`;
      s+=`<g filter="url(#protsh)"><path d="M${cx-118},${mY+6} q-16,58 118,58 q134,0 118,-58 q-4,-14 -30,-14 q-30,0 -30,10 h-116 q0,-10 -30,-10 q-26,0 -30,14 Z" fill="url(#riboSG)"/></g>`;
      s+=`<text x="${cx}" y="${mY+44}" text-anchor="middle" fill="#fff" style="font:700 10px var(--sans)">small subunit (30S)</text>`;
      // A/P/E labels on the subunit body
      s+=`<text x="${sites.E}" y="${mY-2}" text-anchor="middle" fill="#efe4f2" style="font:700 11px var(--mono)">E</text>`;
      s+=`<text x="${sites.P}" y="${mY-2}" text-anchor="middle" fill="#efe4f2" style="font:700 11px var(--mono)">P</text>`;
      s+=`<text x="${sites.A}" y="${mY-2}" text-anchor="middle" fill="#efe4f2" style="font:700 11px var(--mono)">A</text>`;
      // growing polypeptide out the top of P/A
      const chainX = bonded? sites.A : sites.P;
      let chain=`<path d="M${sites.P},${topY-2} `; for(let i=0;i<4;i++){ chain+=`q10,-16 20,0 `; } chain+=`" fill="none" stroke="#8f6db0" stroke-width="6" stroke-linecap="round"/>`;
      s+=`<g filter="url(#softsh)">${chain}`; for(let i=0;i<5;i++){ s+=`<circle cx="${sites.P+i*20-4}" cy="${topY-14-(i%2?6:0)}" r="6" fill="url(#riboLG)"/>`; } s+=`</g>`;
      s+=`<text x="${sites.P-4}" y="${topY-38}" text-anchor="middle" fill="#6e4488" style="font:600 9px var(--sans)">polypeptide</text>`;
      s+=`</svg>`;
      F.svgHost.innerHTML=s;
      const labs=['A site empty — codon exposed','Charged tRNA enters the A site (EF-Tu)','Peptide bond forms — chain transferred to A-site tRNA','Translocation (EF-G): ribosome shifts, tRNAs move P→E, A→P'];
      F.status.textContent=labs[step].split(' — ')[0].split(' (')[0].toUpperCase(); F.status.className='gen-fig-status on';
      const notes=['The ribosome holds three sites: E (exit), P (peptidyl), A (aminoacyl). The next codon sits open in the A site.',
        'EF-Tu delivers the matching aminoacyl-tRNA to the A site, where its anticodon pairs with the codon.',
        'Peptidyl transferase (an rRNA ribozyme in the large subunit) forms the peptide bond, moving the growing chain onto the A-site tRNA.',
        'EF-G drives translocation: the ribosome advances one codon, the now-empty tRNA exits via E, and the peptidyl-tRNA sits in P — ready for the next cycle.'];
      F.note.textContent=notes[step];
    }
    const prev=stepBtn('‹ Back'), next=stepBtn('Next step ›');
    prev.addEventListener('click',()=>{step=Math.max(0,step-1);render();});
    next.addEventListener('click',()=>{step=(step+1)%N;render();});
    F.ctrls.append(prev,next); render();
  };

  /* ============ FIG: operon control — inducible vs repressible (ch12-control / operon) ============ */
  GEN_FIGS.operonControl = function(host){
    const F=makeFig(host);
    const state={mode:'inducible', signal:false}; // signal = inducer present / corepressor present
    const W=620,H=230;
    const OP=[250,50], gene=[330,180];
    function frame(){
      setBaseline(140);
      const {mode,signal}=state;
      // inducible: normally OFF (repressor active); inducer INACTIVATES repressor -> ON when signal
      // repressible: normally ON; corepressor ACTIVATES repressor -> OFF when signal
      const repActive = (mode==='inducible') ? !signal : signal;
      const on = !repActive;
      let s=svgOpen(W,H,mode+' operon');
      s+=duplex(24,W-24,y0);
      s+=tile(160,44,'promG','P','promoter');
      s+=tile(OP[0],OP[1],repActive?'opG':'dimG','O','operator');
      s+=geneBlock(gene[0],gene[1],'structural genes');
      // repressor blob (on operator if active, else floating)
      if(repActive){ s+=prot(OP[0]+OP[1]/2,y0-30,23,16,'repG','repressor',2); }
      else { s+=`<g opacity=".85">`+prot(OP[0]+OP[1]/2,y0-52,21,15,'repG','repressor',2)+`</g>`; }
      // signal molecule
      if(signal){ s+=mol(OP[0]+OP[1]/2+ (repActive? -2 : 20), y0-30 + (repActive?0:-22));
        s+=`<text x="${OP[0]+OP[1]/2+40}" y="${y0-46}" fill="#a86f14" style="font:600 9px var(--sans)">${mode==='inducible'?'inducer':'corepressor'}</text>`; }
      // output
      if(on){ s+=`<path d="M${gene[0]-4},${y0+30} q60,14 ${gene[1]-20},0" fill="none" stroke="url(#mrnaG)" stroke-width="3.4" stroke-linecap="round" marker-end="url(#mrnaArr)"/><text x="${gene[0]+40}" y="${y0+52}" fill="#c65a2e" style="font:600 10px var(--sans)">transcription ON</text>`; }
      else { s+=`<line x1="${gene[0]}" y1="${y0+30}" x2="${gene[0]+gene[1]}" y2="${y0+30}" stroke="#d0d3da" stroke-width="2.4" stroke-dasharray="2 6"/><text x="${gene[0]+gene[1]/2}" y="${y0+52}" text-anchor="middle" fill="#c0392b" style="font:600 10px var(--sans)">transcription OFF</text>`; }
      s+=`</svg>`; F.svgHost.innerHTML=s;
      F.status.textContent=`${mode.toUpperCase()} — ${on?'ON':'OFF'}`; F.status.className='gen-fig-status '+(on?'on':'off');
      const base = mode==='inducible' ? 'Inducible operons are normally OFF: the repressor is active by default.' : 'Repressible operons are normally ON: the repressor is inactive by default.';
      const sig = mode==='inducible'
        ? (signal?'The inducer binds and inactivates the repressor → operon switches ON (e.g. lac).':'No inducer → repressor stays on the operator → OFF.')
        : (signal?'The corepressor binds and activates the repressor → operon switches OFF (e.g. trp).':'No corepressor → repressor stays inactive → ON.');
      F.note.textContent=base+' '+sig;
      tI.classList.toggle('on',mode==='inducible'); tR.classList.toggle('on',mode==='repressible'); tS.classList.toggle('on',signal);
      tS.querySelector('.lbl').textContent = mode==='inducible'?'Inducer':'Corepressor';
    }
    function geneBlock(x,w,label){ let s=`<g filter="url(#softsh)"><rect x="${x}" y="${y0-13}" width="${w}" height="26" rx="4" fill="url(#geneG)"/><rect x="${x+2}" y="${y0-11}" width="${w-4}" height="8" rx="3" fill="#fff" opacity=".14"/><text x="${x+w/2}" y="${y0+4}" text-anchor="middle" fill="#fff" style="font:600 11px var(--sans)">${label}</text></g>`; return s; }
    const tI=toggle('Inducible',true), tR=toggle('Repressible',false);
    const tS=el(`<button class="gen-fig-toggle"><span class="dot"></span><span class="lbl">Inducer</span></button>`);
    tI.addEventListener('click',()=>{state.mode='inducible';frame();});
    tR.addEventListener('click',()=>{state.mode='repressible';frame();});
    tS.addEventListener('click',()=>{state.signal=!state.signal;frame();});
    F.ctrls.append(tI,tR,tS); frame();
  };

  /* ============ FIG: trp operon + attenuation (ch12-trp) ============ */
  GEN_FIGS.trpOperon = function(host){
    const F=makeFig(host);
    const state={trp:false};
    const W=640,H=250;
    function frame(){
      setBaseline(140);
      const high=state.trp;
      const repActive=high; // trp present -> corepressor -> repressor active -> OFF
      let s=svgOpen(W,H,'trp operon and attenuation');
      s+=duplex(24,W-24,y0);
      s+=tile(120,44,'promG','P','promoter');
      s+=tile(180,46,repActive?'opG':'dimG','O','operator');
      // leader / attenuator region
      s+=tile(250,52,'termG','L','leader/attenuator');
      // structural genes trpE-A
      s+=`<g filter="url(#softsh)"><rect x="330" y="${y0-13}" width="270" height="26" rx="4" fill="url(#geneG)"/><text x="465" y="${y0+4}" text-anchor="middle" fill="#fff" style="font:italic 600 11px var(--sans)">trpE  trpD  trpC  trpB  trpA</text></g>`;
      // trp repressor + tryptophan corepressor
      if(repActive){ s+=prot(203,y0-30,22,15,'repG','repressor',2); s+=mol(224,y0-32); s+=`<text x="250" y="${y0-46}" fill="#a86f14" style="font:600 9px var(--sans)">tryptophan (corepressor)</text>`; }
      else { s+=`<g opacity=".8">`+prot(203,y0-52,20,14,'repG','repressor',2)+`</g><text x="203" y="${y0-70}" text-anchor="middle" fill="#6b6b76" style="font:600 9px var(--sans)">inactive repressor</text>`; }
      // attenuation hairpin indicator
      if(high){ s+=`<path d="M276,${y0+28} q6,-14 12,0 q6,14 12,0" fill="none" stroke="#5b45a8" stroke-width="3"/><text x="294" y="${y0+52}" text-anchor="middle" fill="#5b45a8" style="font:600 9px var(--sans)">terminator hairpin</text>`; }
      // output
      if(!repActive){ s+=`<path d="M330,${y0+30} q120,14 250,0" fill="none" stroke="url(#mrnaG)" stroke-width="3.4" stroke-linecap="round" marker-end="url(#mrnaArr)"/><text x="360" y="${y0+52}" fill="#c65a2e" style="font:600 10px var(--sans)">transcription ON — make Trp</text>`; }
      else { s+=`<line x1="330" y1="${y0+30}" x2="600" y2="${y0+30}" stroke="#d0d3da" stroke-width="2.4" stroke-dasharray="2 6"/><text x="465" y="${y0+52}" text-anchor="middle" fill="#c0392b" style="font:600 10px var(--sans)">transcription OFF</text>`; }
      s+=`</svg>`; F.svgHost.innerHTML=s;
      F.status.textContent=high?'HIGH TRP — OPERON OFF':'LOW TRP — OPERON ON'; F.status.className='gen-fig-status '+(high?'off':'on');
      F.note.textContent = high
        ? 'When tryptophan is abundant it acts as a corepressor: it binds and activates the trp repressor, which blocks the operator. Attenuation reinforces shutdown by forming a terminator hairpin in the leader. No need to make more Trp.'
        : 'When tryptophan is scarce the repressor is inactive and the operator is free, so the trp biosynthetic genes are transcribed and the cell makes its own tryptophan.';
      tT.classList.toggle('on',high);
    }
    const tT=toggle('Tryptophan present',false);
    tT.addEventListener('click',()=>{state.trp=!state.trp;frame();});
    F.ctrls.append(tT); frame();
  };

  /* ============ FIG: codon–anticodon pairing / reading frame (ch11-code / charging) ============ */
  GEN_FIGS.codon = function(host){
    const F=makeFig(host);
    // fixed mRNA; highlight reading frame codons and show anticodon pairing on the current codon
    const mrna='AUGGCACGUUAA';
    const codons=[]; for(let i=0;i<mrna.length;i+=3) codons.push(mrna.slice(i,i+3));
    const aa={AUG:'Met (start)',GCA:'Ala',CGU:'Arg',UAA:'STOP'};
    let idx=0;
    const W=560,H=230;
    const comp={A:'U',U:'A',G:'C',C:'G'};
    function frame(){
      const y=100, x0=120, cw=30;
      let s=svgOpen(W,H,'codon anticodon pairing');
      s+=`<text x="${x0-14}" y="${y+6}" text-anchor="end" fill="#c65a2e" style="font:600 10px var(--mono)">5′</text>`;
      s+=`<text x="${x0+mrna.length*cw+8}" y="${y+6}" fill="#c65a2e" style="font:600 10px var(--mono)">3′</text>`;
      // mRNA bases
      for(let i=0;i<mrna.length;i++){ const inFrame=(i>=idx*3&&i<idx*3+3);
        s+=`<rect x="${x0+i*cw}" y="${y-15}" width="${cw-3}" height="30" rx="4" fill="${inFrame?'url(#mrnaG)':'#f0d9cc'}" ${inFrame?'filter="url(#softsh)"':''}/>`;
        s+=`<text x="${x0+i*cw+(cw-3)/2}" y="${y+5}" text-anchor="middle" fill="${inFrame?'#fff':'#b5532b'}" style="font:700 13px var(--mono)">${mrna[i]}</text>`;
      }
      s+=`<text x="${x0+mrna.length*cw/2}" y="${y-26}" text-anchor="middle" fill="#6b6b76" style="font:600 9.5px var(--sans)">mRNA — read 5′→3′ in non-overlapping codons</text>`;
      // current codon + anticodon tRNA below
      const cx=x0+idx*3*cw+(3*cw)/2-1.5;
      const cod=codons[idx], anti=cod.split('').map(b=>comp[b]).join('');
      s+=`<path d="M${cx-45},${y+18} L${cx+45},${y+18} L${cx+45},${y+42} q0,26 -45,26 q-45,0 -45,-26 Z" fill="url(#trnaG)" filter="url(#softsh)"/>`;
      // anticodon bases aligned under the codon (antiparallel: shown 3'->5' under 5'->3')
      for(let i=0;i<3;i++){ s+=`<text x="${cx-45+ i*cw + (cw-3)/2}" y="${y+40}" text-anchor="middle" fill="#fff" style="font:700 13px var(--mono)">${anti[i]}</text>`; }
      s+=`<text x="${cx-56}" y="${y+38}" text-anchor="end" fill="#eaf2f6" style="font:600 8px var(--mono)">3′</text><text x="${cx+56}" y="${y+38}" fill="#eaf2f6" style="font:600 8px var(--mono)">5′</text>`;
      s+=`<text x="${cx}" y="${y+80}" text-anchor="middle" fill="#2b5a74" style="font:700 10px var(--sans)">anticodon · tRNA → ${aa[cod]||'?'}</text>`;
      s+=`</svg>`; F.svgHost.innerHTML=s;
      F.status.textContent=`CODON ${idx+1}/${codons.length} — ${cod} → ${aa[cod]||'?'}`; F.status.className='gen-fig-status on';
      F.note.textContent='The ribosome reads mRNA 5′→3′ in non-overlapping three-base codons. Each codon is read by a tRNA whose anticodon pairs antiparallel with it. AUG starts; a stop codon (UAA/UAG/UGA) ends translation.';
    }
    const prev=stepBtn('‹ Prev codon'), next=stepBtn('Next codon ›');
    prev.addEventListener('click',()=>{idx=(idx-1+codons.length)%codons.length;frame();});
    next.addEventListener('click',()=>{idx=(idx+1)%codons.length;frame();});
    F.ctrls.append(prev,next); frame();
  };

  /* ============ FIG: R-loop / alternative splicing (ch10-colinearity) ============ */
  GEN_FIGS.altSplice = function(host){
    const F=makeFig(host);
    const state={skip:false};
    const W=620,H=230;
    function frame(){
      const y=90, x0=90;
      const ex=[[x0,60,1],[x0+120,60,2],[x0+240,60,3]]; const inW=60;
      let s=svgOpen(W,H,'alternative splicing');
      // pre-mRNA
      s+=`<text x="${x0-6}" y="${y-24}" fill="#6b6b76" style="font:600 10px var(--sans)">pre-mRNA</text>`;
      let cx=x0;
      const segs=[];
      ex.forEach((e,i)=>{ segs.push(['e',cx,60,e[2]]); cx+=60; if(i<2){segs.push(['i',cx,inW]);cx+=inW;} });
      segs.forEach(g=>{ if(g[0]==='e'){ s+=`<rect x="${g[1]}" y="${y-13}" width="${g[2]}" height="26" rx="3" fill="url(#exonG)" filter="url(#softsh)"/><text x="${g[1]+g[2]/2}" y="${y+4}" text-anchor="middle" fill="#fff" style="font:700 11px var(--sans)">E${g[3]}</text>`; }
        else { s+=`<path d="M${g[1]},${y} q${g[2]/2},20 ${g[2]},0" fill="none" stroke="url(#intronG)" stroke-width="7"/>`; } });
      // two splice paths
      const midY=y+80;
      s+=`<text x="${x0-6}" y="${midY-14}" fill="#3f5fa8" style="font:600 10px var(--sans)">mature mRNA (${state.skip?'exon 2 skipped':'all exons'})</text>`;
      const inc = state.skip ? [1,3] : [1,2,3];
      let mx=x0;
      inc.forEach((n,i)=>{ s+=`<rect x="${mx}" y="${midY-13}" width="60" height="26" rx="3" fill="url(#exonG)" filter="url(#softsh)"/><text x="${mx+30}" y="${midY+4}" text-anchor="middle" fill="#fff" style="font:700 11px var(--sans)">E${n}</text>`; mx+=60; });
      s+=`<text x="${x0+230}" y="${midY+4}" fill="#6b6b76" style="font:600 9.5px var(--sans)">→ ${state.skip?'protein isoform B':'protein isoform A'}</text>`;
      s+=`</svg>`; F.svgHost.innerHTML=s;
      F.status.textContent=state.skip?'ALTERNATIVE SPLICE — EXON 2 SKIPPED':'DEFAULT SPLICE — ALL EXONS'; F.status.className='gen-fig-status on';
      F.note.textContent='Introns are removed and exons joined. By including or skipping particular exons, one pre-mRNA can yield multiple mRNAs and protein isoforms — this is alternative splicing, and it is why many genes are noncolinear with their proteins.';
      tk.classList.toggle('on',state.skip);
    }
    const tk=toggle('Skip exon 2',false);
    tk.addEventListener('click',()=>{state.skip=!state.skip;frame();});
    F.ctrls.append(tk); frame();
  };

  /* ============ FIG: enhancer / insulator / chromatin (ch12-eukreg / epigenetics) ============ */
  GEN_FIGS.eukReg = function(host){
    const F=makeFig(host);
    const state={enhancer:true, insulator:false};
    const W=620,H=250;
    function frame(){
      const y=170, x0=40;
      const active = state.enhancer && !state.insulator;
      let s=svgOpen(W,H,'eukaryotic transcriptional regulation');
      s+=duplex(x0,W-30,y);
      // enhancer (distal), insulator (between), promoter, gene
      s+=`<g filter="url(#softsh)"><rect x="${x0+10}" y="${y-13}" width="56" height="26" rx="4" fill="url(#capG)"/><text x="${x0+38}" y="${y+4}" text-anchor="middle" fill="#fff" style="font:700 9px var(--mono)">ENH</text></g><text x="${x0+38}" y="${y+28}" text-anchor="middle" fill="#6b6b76" style="font:600 8.5px var(--sans)">enhancer</text>`;
      if(state.insulator){ s+=`<g filter="url(#softsh)"><rect x="${x0+150}" y="${y-15}" width="20" height="30" rx="3" fill="url(#termG)"/></g><text x="${x0+160}" y="${y+28}" text-anchor="middle" fill="#6b6b76" style="font:600 8.5px var(--sans)">insulator</text>`; }
      s+=tile(x0+250,44,'promG','P','promoter');
      s+=gene(x0+330,150,'gene','');
      // activator proteins on enhancer + looping to promoter
      s+=prot(x0+38,y-30,17,12,'capprotG','TF',2);
      if(active){
        // DNA loop bringing enhancer TF to promoter
        s+=`<path d="M${x0+38},${y-14} C${x0+80},${y-90} ${x0+230},${y-90} ${x0+272},${y-14}" fill="none" stroke="#9c6cb8" stroke-width="2.5" stroke-dasharray="4 3"/>`;
        s+=prot(x0+272,y-30,15,11,'riboLG','pol',1);
        s+=`<path d="M${x0+330},${y+30} q60,14 120,0" fill="none" stroke="url(#mrnaG)" stroke-width="3.4" stroke-linecap="round" marker-end="url(#mrnaArr)"/><text x="${x0+360}" y="${y+52}" fill="#c65a2e" style="font:600 10px var(--sans)">transcription ON</text>`;
      } else {
        s+=`<line x1="${x0+330}" y1="${y+30}" x2="${x0+480}" y2="${y+30}" stroke="#d0d3da" stroke-width="2.4" stroke-dasharray="2 6"/><text x="${x0+405}" y="${y+52}" text-anchor="middle" fill="#c0392b" style="font:600 10px var(--sans)">no activation</text>`;
      }
      s+=`</svg>`; F.svgHost.innerHTML=s;
      F.status.textContent=active?'ENHANCER ACTIVE — ON':(state.insulator?'INSULATOR BLOCKS ENHANCER':'NO ENHANCER'); F.status.className='gen-fig-status '+(active?'on':'off');
      F.note.textContent = active
        ? 'Activator proteins bound at a distant enhancer contact the promoter by looping the DNA, boosting transcription — enhancers work over distance and orientation.'
        : (state.insulator? 'An insulator placed between the enhancer and promoter blocks the enhancer’s effect, so the gene is not activated.' : 'Without an enhancer-bound activator, the promoter fires only weakly.');
      tE.classList.toggle('on',state.enhancer); tI.classList.toggle('on',state.insulator);
    }
    const tE=toggle('Enhancer + activator',true), tI=toggle('Insulator between',false);
    tE.addEventListener('click',()=>{state.enhancer=!state.enhancer;frame();});
    tI.addEventListener('click',()=>{state.insulator=!state.insulator;frame();});
    F.ctrls.append(tE,tI); frame();
  };

  /* ============ FIG: RNAi pathway (ch12-ncrna) ============ */
  GEN_FIGS.rnai = function(host){
    const F=makeFig(host);
    let step=0; const N=3; // dsRNA -> Dicer -> siRNA+RISC -> target cleavage
    const W=560,H=230;
    function render(){
      const cx=280,y=90;
      let s=svgOpen(W,H,'RNA interference pathway');
      if(step===0){
        s+=`<rect x="150" y="${y-8}" width="260" height="7" rx="3.5" fill="url(#mrnaG)"/><rect x="150" y="${y+2}" width="260" height="7" rx="3.5" fill="#c65a2e"/>`;
        s+=`<text x="280" y="${y-18}" text-anchor="middle" fill="#6b6b76" style="font:600 10px var(--sans)">double-stranded RNA</text>`;
      } else if(step===1){
        s+=prot(cx,y,34,24,'riboLG','Dicer',1);
        s+=`<rect x="120" y="${y-3}" width="90" height="6" rx="3" fill="url(#mrnaG)"/><rect x="350" y="${y-3}" width="90" height="6" rx="3" fill="url(#mrnaG)"/>`;
        s+=`<text x="280" y="${y+50}" text-anchor="middle" fill="#6b6b76" style="font:600 10px var(--sans)">Dicer cleaves dsRNA into short siRNA duplexes</text>`;
      } else {
        // RISC + guide siRNA finding target mRNA
        s+=prot(cx-70,y,30,22,'riboSG','RISC',1);
        s+=`<rect x="${cx-92}" y="${y+22}" width="44" height="5" rx="2.5" fill="#38455f"/><text x="${cx-70}" y="${y+42}" text-anchor="middle" fill="#38455f" style="font:600 8.5px var(--sans)">guide siRNA</text>`;
        s+=`<rect x="${cx-10}" y="${y+22}" width="200" height="7" rx="3.5" fill="url(#mrnaG)"/><text x="${cx+90}" y="${y+18}" text-anchor="middle" fill="#c65a2e" style="font:600 9px var(--sans)">target mRNA</text>`;
        s+=`<path d="M${cx+80},${y+16} l6,10 l6,-10" fill="none" stroke="#c0392b" stroke-width="2"/>`;
        s+=`<text x="280" y="${y+66}" text-anchor="middle" fill="#c0392b" style="font:600 10px var(--sans)">complementary mRNA is cleaved / silenced</text>`;
      }
      s+=`</svg>`; F.svgHost.innerHTML=s;
      const labs=['DOUBLE-STRANDED RNA','DICER CLEAVAGE','RISC — TARGET SILENCING'];
      F.status.textContent=labs[step]; F.status.className='gen-fig-status on';
      const notes=['RNA interference begins with double-stranded RNA in the cell.',
        'The enzyme Dicer chops dsRNA into ~21-nt small interfering RNAs (siRNAs).',
        'One siRNA strand loads into RISC and guides it to a complementary mRNA, which is cleaved (siRNA) or translationally repressed (miRNA) — silencing the gene.'];
      F.note.textContent=notes[step];
    }
    const prev=stepBtn('‹ Back'), next=stepBtn('Next step ›');
    prev.addEventListener('click',()=>{step=Math.max(0,step-1);render();});
    next.addEventListener('click',()=>{step=(step+1)%N;render();});
    F.ctrls.append(prev,next); render();
  };

  window.GEN_FIGS = GEN_FIGS;
})();
