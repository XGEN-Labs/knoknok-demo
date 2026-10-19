const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// This is an in-world promise between the player and Klin, kept locally.
// Only the explicit signature button can start it; cancellation never commits.
export function showCompanionContract({phone,getWorld,userName,companionName,reduced=false,onCommit,onClose}={}){
 const layer=document.createElement('section');layer.className='contract-story';layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-labelledby','contract-heading');
 const now=new Date(),date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('.');
 layer.innerHTML=`<article class="contract-document"><div class="contract-document-meta"><span>彼之境 · 回響檔案</span><span>No. 0001</span></div><header class="contract-document-heading"><span class="contract-mark" aria-hidden="true">✧</span><h2 id="contract-heading">相遇契約</h2><small>A PROMISE BETWEEN US</small></header><div class="contract-names"><strong>${escape(userName)}</strong><span>與</span><strong>${escape(companionName)}</strong></div><p class="contract-preamble">從這一次相遇開始，<br>我們為彼此留一盞燈。</p><div class="contract-clauses"><p><span>一</span>認真聽見彼此，記得那些微小的心事。</p><p><span>二</span>尊重各自的步調，陪伴每一次新的相遇。</p></div><div class="contract-signatures"><div class="contract-user-signature"><small>你的名字</small><div class="contract-signature-ink"><svg class="contract-signature" viewBox="0 0 240 45" aria-hidden="true"><path d="M15 30Q34 0 31 30T61 22Q77 3 72 30T98 20Q111 7 112 28T145 17Q154 3 153 29T184 19Q199 1 195 29L225 22"/></svg><span>${escape(userName)}</span></div></div><div class="contract-companion-signature"><small>你的同行者</small><strong>${escape(companionName)}</strong></div></div><footer class="contract-document-footer"><time datetime="${date.replaceAll('.','-')}">${date}</time><span>於彼之境，初次相遇</span></footer><span class="contract-seal" aria-hidden="true"><span>彼</span><span>之境</span></span></article><div class="contract-actions"><p role="status" aria-live="polite" class="contract-status contract-sr-only">等待你確認這份相遇契約。</p><button type="button" class="btn contract-sign">留下我的名字</button><button type="button" class="contract-later">再想一想</button></div>`;
 layer.querySelector('.contract-document').dataset.longNames=String(Math.max(Array.from(String(userName||'')).length,Array.from(String(companionName||'')).length)>10);
 const app=phone.querySelector('#app'),previousInert=app?.inert;
 if(app)app.inert=true;phone.classList.add('contract-open');phone.append(layer);
 let disposed=false,signing=false,stopWorld=null,fallbackTimer=null;
 function dispose(restore=true){if(disposed)return;disposed=true;clearTimeout(fallbackTimer);stopWorld?.();stopWorld=null;document.removeEventListener('keydown',escapeKey);layer.remove();phone.classList.remove('contract-open');if(app)app.inert=previousInert;onClose?.();if(restore)app?.querySelector('[data-action="open-contract"]')?.focus({preventScroll:true});}
 function complete(){if(disposed)return;stopWorld=null;dispose(false);onCommit?.();}
 function sign(){if(disposed||signing)return;signing=true;layer.classList.add('is-signing');layer.querySelector('.contract-sign').disabled=true;layer.querySelector('.contract-status').textContent='你的名字，正在成為第一段回響。';
  const sealed=()=>{if(disposed)return;layer.classList.add('is-sealed');layer.querySelector('.contract-status').textContent='約定收到了。我們一起長大。';};
  const world=getWorld?.();
  if(world?.signContract)stopWorld=world.signContract({onSigned:sealed,onComplete:complete});
  else{sealed();fallbackTimer=setTimeout(complete,reduced?650:2200);}
 }
 function escapeKey(event){if(event.key==='Escape'){event.preventDefault();dispose();}}
 layer.querySelector('.contract-sign').addEventListener('click',sign);layer.querySelector('.contract-later').addEventListener('click',()=>dispose());document.addEventListener('keydown',escapeKey);layer.querySelector('.contract-sign').focus({preventScroll:true});
 return dispose;
}
