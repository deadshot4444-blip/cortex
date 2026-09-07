/* Refuse stale course/v2 snapshots; keep both copies available for recovery. */
const McatStorage=(()=>{
  const stores=new Map();let conflicted=false;
  const parse=raw=>{try{return JSON.parse(raw);}catch{return raw;}};
  function conflict(){
    if(conflicted)return;
    conflicted=true;
    window.dispatchEvent(new Event('mcat-storage-conflict'));
    const dialog=document.createElement('dialog');
    dialog.id='mcat-save-conflict';
    dialog.setAttribute('aria-labelledby','mcat-conflict-title');
    dialog.setAttribute('aria-describedby','mcat-conflict-description');
    dialog.style.cssText='box-sizing:border-box;position:fixed;inset:0;margin:auto;width:min(480px,calc(100vw - 32px));max-height:85vh;overflow:auto;padding:24px;border:1px solid #71828b;border-radius:16px;background:#102029;color:#fff;line-height:1.6';
    dialog.innerHTML='<h2 id="mcat-conflict-title">Newer MCAT work was saved.</h2><p id="mcat-conflict-description">Another tab or account sync changed your course or learning-tool progress. Saving is paused in this tab so it cannot replace the newer copy.</p><p>Download both copies if you have notes to keep, then reload to continue with the latest saved work.</p><div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn" id="mcat-conflict-export">Download both copies</button><button class="btn btn-solid" id="mcat-conflict-reload">Reload latest work</button></div><p id="mcat-conflict-status" role="status"></p>';
    dialog.addEventListener('cancel',e=>e.preventDefault());
    dialog.querySelector('#mcat-conflict-export').style.cssText='color:#fff;border-color:#a5bac6;background:transparent';
    dialog.querySelector('#mcat-conflict-reload').style.cssText='color:#102029;border-color:#fff;background:#fff';
    dialog.querySelector('#mcat-conflict-reload').onclick=()=>location.reload();
    dialog.querySelector('#mcat-conflict-export').onclick=()=>{
      try{
        const records=Object.fromEntries([...stores].map(([key,store])=>[key,{thisTab:store.current(),saved:parse(localStorage.getItem(key))}]));
        const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),purpose:'MCAT save conflict recovery',records},null,2)],{type:'application/json'});
        const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='mcat-progress-copies.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
        dialog.querySelector('#mcat-conflict-status').textContent='Download prepared. Your saved progress has not been replaced.';
      }catch{dialog.querySelector('#mcat-conflict-status').textContent='The download could not be prepared. Keep this tab open; the newer saved copy has not been replaced.';}
    };
    document.body.appendChild(dialog);dialog.showModal();
  }
  function watch(key,current){
    let last;try{last=localStorage.getItem(key);}catch{last=null;}
    const store={current,changed:()=>localStorage.getItem(key)!==last};stores.set(key,store);
    return {save(value){
      if(conflicted)return false;
      // Recheck at the write, including same-tab account sync (no storage event).
      if(store.changed()){conflict();return false;}
      const next=JSON.stringify(value);localStorage.setItem(key,next);last=next;return true;
    }};
  }
  window.addEventListener('storage',event=>{
    if(event.storageArea!==localStorage)return;
    try{for(const [key,store] of stores)if((event.key===null||event.key===key)&&store.changed()){conflict();break;}}catch{}
  });
  return {watch,get conflicted(){return conflicted;}};
})();
