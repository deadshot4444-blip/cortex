/* Shared study persistence: retain drafts, refuse stale writes, and expose recovery. */
const StudyStorage=(()=>{
  const stores=new Map();let problem=null,dialog=null,allowReload=false;
  const ownerKey=typeof CortexProgress!=='undefined'?CortexProgress.OWNER:null;
  let owner=null,ownerReadable=true;
  try{if(ownerKey)owner=localStorage.getItem(ownerKey);}catch{ownerReadable=false;}
  const parse=raw=>{try{return JSON.parse(raw);}catch{return raw;}};
  const sameOwner=()=>ownerReadable&&(!ownerKey||localStorage.getItem(ownerKey)===owner);
  function recovery(){
    let currentOwner=null;try{if(ownerReadable)currentOwner=sameOwner();}catch{}
    const records={};
    for(const [key,store] of stores){
      let saved=store.last,readable=store.readable;
      if(currentOwner)try{saved=localStorage.getItem(key);readable=true;}catch{readable=false;}
      let thisTab;try{thisTab=JSON.parse(JSON.stringify(store.current?store.current():store.serialize?parse(store.serialize()):parse(store.pending?store.next:store.last)));}catch{thisTab={recoveryError:'This draft could not be serialized. Copy important notes from the open page.'};}
      records[key]={thisTab,saved:parse(saved),savedReadable:readable,savedSource:currentOwner?'current browser copy':'last copy read by this tab'};
    }
    return {exportedAt:new Date().toISOString(),purpose:'Cortex study save recovery',accountChanged:currentOwner===null?null:!currentOwner,records};
  }
  function download(){
    const blob=new Blob([JSON.stringify(recovery(),null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='cortex-progress-copies.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function showProblem(kind){
    if(problem&&problem!=='write'&&kind==='write')return;
    const first=!problem;problem=kind;
    if(first){window.dispatchEvent(new Event('study-storage-paused'));if(kind==='conflict')window.dispatchEvent(new Event('study-storage-conflict'));}
    if(!document.body)return;
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='study-save-conflict';
      dialog.setAttribute('aria-labelledby','study-conflict-title');dialog.setAttribute('aria-describedby','study-conflict-description');
      dialog.style.cssText='box-sizing:border-box;position:fixed;inset:0;margin:auto;width:min(480px,calc(100vw - 32px));max-height:85vh;overflow:auto;padding:24px;border:1px solid #71828b;border-radius:16px;background:#102029;color:#fff;line-height:1.6';
      dialog.innerHTML='<h2 id="study-conflict-title"></h2><p id="study-conflict-description"></p><p>Keep this tab open. Download the available copies before reloading if you have work to keep.</p><div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn" id="study-conflict-export">Download recovery copies</button><button class="btn" id="study-save-retry">Retry saving</button><button class="btn" id="study-conflict-reload">Reload saved work</button></div><p id="study-conflict-status" role="status"></p>';
      dialog.addEventListener('cancel',e=>e.preventDefault());
      dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();}});
      for(const button of dialog.querySelectorAll('button'))button.style.cssText='color:#fff;border-color:#a5bac6;background:transparent;min-height:44px;white-space:normal';
      dialog.querySelector('#study-conflict-export').onclick=()=>{try{download();dialog.querySelector('#study-conflict-status').textContent='Recovery download prepared. It includes drafts still held by this tab.';}catch{dialog.querySelector('#study-conflict-status').textContent='Download could not be prepared. Keep this tab open and copy important notes.';}};
      dialog.querySelector('#study-conflict-reload').onclick=()=>{allowReload=true;location.reload();};
      dialog.querySelector('#study-save-retry').onclick=retry;
      document.body.appendChild(dialog);dialog.showModal();
    }
    dialog.querySelector('#study-conflict-title').textContent=kind==='conflict'?'Newer study work was saved.':kind==='account'?'Your active workspace changed.':kind==='read'?'Saved work could not be read.':kind==='session'?'Your saved session could not open.':'Your latest work could not be saved.';
    dialog.querySelector('#study-conflict-description').textContent={
      conflict:'Another tab or account sync changed your progress. Saving is paused here so it cannot replace the newer copy.',
      account:'Another tab replaced the saved workspace or changed the active account. This tab cannot overwrite that work. Its recovery download includes only copies already held here.',
      read:'Saving is paused because the browser copy is unavailable or damaged. It has not been replaced with empty progress. Restore browser storage access, then reload.',
      session:'The saved session could not be restored. Its stored copy has been kept. Download it for recovery before reloading or seeking help.',
      write:'Your newest work is held in this tab, but saving to this browser failed. Free some browser storage, then retry. Closing or reloading now can lose unsaved work.'
    }[kind];
    const retryButton=dialog.querySelector('#study-save-retry');
    retryButton.hidden=kind!=='write';retryButton.style.display=kind==='write'?'':'none';
  }
  function entry(key){
    if(stores.has(key))return stores.get(key);
    const store={last:null,readable:true,pending:false,next:null,current:null,serialize:null};stores.set(key,store);
    try{if(!ownerReadable){showProblem('read');store.readable=false;}else if(!sameOwner()){showProblem('account');store.readable=false;}else store.last=localStorage.getItem(key);}catch{store.readable=false;showProblem('read');}
    return store;
  }
  function read(key,fallback){
    const store=entry(key),raw=store.pending?store.next:store.last;
    if(raw===null)return fallback;
    try{return JSON.parse(raw);}catch{store.readable=false;showProblem('read');return fallback;}
  }
  function unchanged(store,key){
    if(!ownerReadable){showProblem('read');return false;}
    if(!sameOwner()){showProblem('account');return false;}
    if(!store.readable){showProblem('read');return false;}
    if(localStorage.getItem(key)!==store.last){showProblem('conflict');return false;}
    return true;
  }
  function flush(store,key){
    if(!unchanged(store,key))return false;
    if(store.next===null)localStorage.removeItem(key);else localStorage.setItem(key,store.next);
    store.last=store.next;store.pending=false;return true;
  }
  function writeRaw(key,value){
    const store=entry(key);store.next=value===null?null:String(value);store.pending=true;store.serialize=null;
    if(problem)return false;
    try{return flush(store,key);}catch{showProblem('write');return false;}
  }
  function write(key,value){
    const store=entry(key);
    const serialize=()=>{const raw=JSON.stringify(value);if(raw===undefined)throw new TypeError('Progress is not serializable');return raw;};
    try{return writeRaw(key,serialize());}catch{store.serialize=serialize;store.pending=true;showProblem('write');return false;}
  }
  function watch(key,current){const store=entry(key);store.current=current;return {save:value=>write(key,value)};}
  function retry(){
    if(problem!=='write')return false;
    try{
      for(const [key,store] of stores)if(!unchanged(store,key))return false;
      // A failed serialization must succeed before any queued write or deletion.
      for(const store of stores.values())if(store.pending&&store.serialize){store.next=store.serialize();store.serialize=null;}
      const pending=[...stores].filter(([,s])=>s.pending).sort((a,b)=>Number(a[1].next===null)-Number(b[1].next===null));
      for(const [key,store] of pending)if(!flush(store,key))return false;
      problem=null;if(dialog){dialog.close();dialog.remove();dialog=null;}
      window.dispatchEvent(new Event('study-storage-recovered'));return true;
    }catch{showProblem('write');if(dialog)dialog.querySelector('#study-conflict-status').textContent='Saving still failed. The pending copies remain in this tab.';return false;}
  }
  // app.js reads the shared clinical records before this module loads. Adopt the
  // raw copies that tab actually rendered so the storage listener and unchanged()
  // compare against them; a copy that already differs is a conflict, not a base.
  if(typeof studyBootCopies!=='undefined'&&studyBootCopies&&typeof studyBootCopies==='object'){
    for(const [key,raw] of Object.entries(studyBootCopies)){
      const store=entry(key);
      if(store.readable&&store.last!==raw){store.last=raw;showProblem('conflict');}
    }
  }
  window.addEventListener('storage',event=>{
    if(event.storageArea!==localStorage)return;
    try{
      if(!sameOwner()){showProblem('account');return;}
      for(const [key,store] of stores)if((event.key===null||event.key===key)&&store.readable&&localStorage.getItem(key)!==store.last){showProblem('conflict');break;}
    }catch{showProblem('read');}
  });
  window.addEventListener('beforeunload',event=>{if(problem&&!allowReload){event.preventDefault();event.returnValue='';}});
  return {read,write,writeRaw,remove:key=>writeRaw(key,null),watch,retry,recovery,workspaceChanged:()=>showProblem('account'),sessionFailed:()=>showProblem('session'),get conflicted(){return problem==='conflict'||problem==='account';},get paused(){return !!problem;}};
})();
