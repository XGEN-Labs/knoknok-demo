const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Paper owns the visible ink and stamp. A fast/unsupported world renderer must
// still wait for the complete paper sequence before growth can begin.
export const CONTRACT_TIMELINE=Object.freeze({inkStart:150,inkComplete:3250,seal:3550,complete:5200,reducedSeal:180,reducedComplete:900});

// This is an in-world promise between the player and Klin, kept locally.
// Only the explicit signature button can start it; cancellation never commits.
export function showCompanionContract({phone,getWorld,userName,companionName,reduced=false,onCommit,onClose}={}){
 const layer=document.createElement('section');layer.className='contract-story';if(reduced)layer.classList.add('is-reduced');layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-labelledby','contract-heading');
 const now=new Date(),date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('.');
 const name=String(userName??''),letters=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(name)].map(part=>part.segment):Array.from(name);
 const characterTime=(CONTRACT_TIMELINE.inkComplete-CONTRACT_TIMELINE.inkStart)/Math.max(1,letters.length);
 const signature=letters.map((letter,index)=>`<span class="contract-signature-character" aria-hidden="true" style="--ink-delay:${(CONTRACT_TIMELINE.inkStart+index*characterTime).toFixed(2)}ms;--ink-duration:${characterTime.toFixed(2)}ms">${escape(letter===' '?'\u00a0':letter)}</span>`).join('');
 layer.innerHTML=`<article class="contract-document"><div class="contract-document-meta"><span>彼之境 · 回響檔案</span><span>No. 0001</span></div><header class="contract-document-heading"><span class="contract-mark" aria-hidden="true">✧</span><h2 id="contract-heading">相遇契約</h2><small>A PROMISE BETWEEN US</small></header><div class="contract-names"><strong>${escape(userName)}</strong><span>與</span><strong>${escape(companionName)}</strong></div><p class="contract-preamble">從這一次相遇開始，<br>我們為彼此留一盞燈。</p><div class="contract-clauses"><p><span>一</span>認真聽見彼此，記得那些微小的心事。</p><p><span>二</span>尊重各自的步調，陪伴每一次新的相遇。</p></div><div class="contract-signatures"><div class="contract-user-signature"><small>你的名字</small><div class="contract-signature-ink"><span class="contract-signature-name" aria-label="${escape(name)}">${signature}</span></div></div><div class="contract-companion-signature"><small>你的同行者</small><strong>${escape(companionName)}</strong></div></div><footer class="contract-document-footer"><time datetime="${date.replaceAll('.','-')}">${date}</time><span>於彼之境，初次相遇</span></footer><span class="contract-seal" aria-hidden="true"><span>彼</span><span>之境</span></span></article><div class="contract-actions"><p role="status" aria-live="polite" class="contract-status contract-sr-only">等待你確認這份相遇契約。</p><button type="button" class="btn contract-sign">留下我的名字</button><button type="button" class="contract-later">再想一想</button></div>`;
 layer.querySelector('.contract-document').dataset.longNames=String(Math.max(Array.from(String(userName||'')).length,Array.from(String(companionName||'')).length)>10);
 const app=phone.querySelector('#app'),previousInert=app?.inert;
 if(app)app.inert=true;phone.classList.add('contract-open');phone.append(layer);
 let disposed=false,signing=false,stopWorld=null,worldSigned=false,worldComplete=false,paperSealReady=false,paperComplete=false;
 const timers=new Set();
 function later(callback,delay){const timer=setTimeout(()=>{timers.delete(timer);if(!disposed)callback();},delay);timers.add(timer);}
 function dispose(restore=true){if(disposed)return;disposed=true;for(const timer of timers)clearTimeout(timer);timers.clear();stopWorld?.();stopWorld=null;document.removeEventListener('keydown',escapeKey);layer.remove();phone.classList.remove('contract-open');if(app)app.inert=previousInert;onClose?.();if(restore)app?.querySelector('[data-action="open-contract"]')?.focus({preventScroll:true});}
 function seal(){if(disposed||!paperSealReady||!(worldSigned||worldComplete))return;layer.classList.add('is-sealed');layer.querySelector('.contract-status').textContent='約定收到了。我們一起長大。';}
 function complete(){if(disposed||!paperComplete||!worldComplete)return;seal();stopWorld=null;dispose(false);onCommit?.();}
 function sign(){if(disposed||signing)return;signing=true;layer.classList.add('is-signing');layer.querySelector('.contract-sign').disabled=true;layer.querySelector('.contract-sign').textContent='正在寫下我們的約定…';layer.querySelector('.contract-status').textContent='你的名字，正在成為第一段回響。';
  later(()=>{paperSealReady=true;seal();},reduced?CONTRACT_TIMELINE.reducedSeal:CONTRACT_TIMELINE.seal);
  later(()=>{paperComplete=true;complete();},reduced?CONTRACT_TIMELINE.reducedComplete:CONTRACT_TIMELINE.complete);
  const world=getWorld?.();
  if(world?.signContract){
   const cancel=world.signContract({onSigned:()=>{if(disposed)return;worldSigned=true;seal();},onComplete:()=>{if(disposed)return;worldComplete=true;stopWorld=null;seal();complete();}});
   stopWorld=worldComplete?null:cancel;
  }else{worldSigned=true;worldComplete=true;}
 }
 function escapeKey(event){if(event.key==='Escape'){event.preventDefault();dispose();}}
 layer.querySelector('.contract-sign').addEventListener('click',sign);layer.querySelector('.contract-later').addEventListener('click',()=>dispose());document.addEventListener('keydown',escapeKey);layer.querySelector('.contract-sign').focus({preventScroll:true});
 return dispose;
}
