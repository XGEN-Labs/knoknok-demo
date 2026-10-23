const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Paper owns the visible ink and stamp. A fast/unsupported world renderer must
// still wait for the complete paper sequence before growth can begin.
export const CONTRACT_TIMELINE=Object.freeze({inkStart:150,inkComplete:3250,seal:3550,complete:5200,reducedSeal:180,reducedComplete:900});

const signaturePages=new Map();
let signatureInstance=0;
const graphemes=value=>typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(String(value??''))].map(part=>part.segment):Array.from(String(value??''));
const availableHanziPages=new Set('2e 34 35 37 38 39 3b 3c 3f 43 45 46 47 48 49 4c 4d 4e 4f 50 51 52 53 54 55 56 57 58 59 5a 5b 5c 5d 5e 5f 60 61 62 63 64 65 66 67 68 69 6a 6b 6c 6d 6e 6f 70 71 72 73 74 75 76 77 78 79 7a 7b 7c 7d 7e 7f 80 81 82 83 84 85 86 87 88 89 8a 8b 8c 8d 8e 8f 90 91 92 93 94 95 96 97 98 99 9a 9b 9c 9d 9e 9f'.split(' '));
const hanziPage=letter=>{const page=(letter.codePointAt(0)>>8).toString(16);return Array.from(letter).length===1&&availableHanziPages.has(page)?`u${page}`:null;};

// Only name-related local pages are requested. Data is Hanzi Writer 2.0.1,
// derived from Make Me a Hanzi / Arphic; the original license ships beside it.
// These are authentic glyph outlines + pen medians, never invented pen flourishes.
export async function loadContractSignatureGlyphs(name,{fetcher=globalThis.fetch}={}){
 const letters=graphemes(name),pages=new Set(letters.map(hanziPage).filter(Boolean));
 if(letters.some(letter=>/^[\x21-\x7e]$/.test(letter)))pages.add('hershey-cursive');
 const values=await Promise.all([...pages].map(async page=>{
  if(!signaturePages.has(page))signaturePages.set(page,(async()=>{
   try{const response=await fetcher(new URL(`./assets/signature-strokes-20261020/${page}.json`,import.meta.url));if(!response.ok)return{};return(await response.json()).characters||{};}catch{return{};}
  })());
  return[page,await signaturePages.get(page)];
 }));
 const data=new Map(values),glyphs={};
 for(const letter of letters){const page=hanziPage(letter),glyph=data.get(page||'hershey-cursive')?.[letter];if(glyph)glyphs[letter]={...glyph,kind:page?'hanzi':'latin'};}
 return glyphs;
}

// The complete visible name is retained, including emoji / unsupported scripts.
// Known Chinese glyphs draw each official stroke along its own median, clipped
// to that stroke's outline. Latin letters trace their actual Hershey cursive paths.
// Unsupported graphemes use an honest text fallback instead of guessed strokes.
export function createContractSignature(name,glyphs={},prefix=`contract-name-${++signatureInstance}`){
 const letters=graphemes(name),characters=letters.map(letter=>{
  const glyph=glyphs[letter];
  if(glyph?.kind==='hanzi'&&glyph.strokes?.length===glyph.medians?.length&&glyph.strokes.length&&glyph.medians.every(points=>points.length>1&&points.every(point=>point.length===2&&point.every(Number.isFinite))))return{letter,kind:'hanzi',glyph,strokes:glyph.strokes.map((outline,index)=>({outline,path:glyph.medians[index].map((point,i)=>`${i?'L':'M'}${point.join(' ')}`).join(' ')}))};
  if(glyph?.kind==='latin'&&typeof glyph.path==='string'&&Number.isFinite(glyph.advance)){const paths=glyph.path.match(/M[^M]+/g)||[];if(paths.length)return{letter,kind:'latin',glyph,strokes:paths.map(path=>({path}))};}
  return{letter,kind:'fallback',strokes:[{}]};
 });
 const count=characters.reduce((sum,character)=>sum+character.strokes.length,0),gaps=Math.max(0,letters.length-1)*70;
 const interval=Math.max(140,(CONTRACT_TIMELINE.inkComplete-CONTRACT_TIMELINE.inkStart-gaps)/Math.max(1,count));
 let cursor=CONTRACT_TIMELINE.inkStart;
 const markup=characters.map((character,index)=>{
  const {letter,kind,glyph,strokes}=character;
  const paths=strokes.map((stroke,strokeIndex)=>{
   const style=`--ink-delay:${cursor.toFixed(2)}ms;--ink-duration:${(interval*.86).toFixed(2)}ms`;cursor+=interval;
   if(kind==='fallback')return`<span class="contract-signature-fallback" style="${style}">${escape(letter===' '?'\u00a0':letter)}</span>`;
   const clip=`${prefix}-${index}-${strokeIndex}`;
   return`${kind==='hanzi'?`<clipPath id="${clip}" clipPathUnits="userSpaceOnUse"><path d="${escape(stroke.outline)}"/></clipPath>`:''}<path class="contract-ink-stroke" d="${escape(stroke.path)}" ${kind==='hanzi'?`clip-path="url(#${clip})" stroke-width="200"`:'stroke-width="1.25"'} pathLength="1" style="${style}"/>`;
  }).join('');
  cursor+=index<letters.length-1?70:0;
  if(kind==='fallback')return`<span class="contract-signature-character" data-signature-kind="fallback" aria-hidden="true">${paths}</span>`;
  return`<svg class="contract-signature-character" data-signature-kind="${kind}" data-character="${escape(letter)}" aria-hidden="true" viewBox="${kind==='hanzi'?'0 0 1024 1024':`-4 -5 ${Math.max(16,glyph.advance+8)} 42`}"${kind==='latin'?` style="width:${((Math.max(16,glyph.advance+8))/42).toFixed(3)}em"`:''}><g${kind==='hanzi'?' transform="translate(0 900) scale(1 -1)"':''}>${paths}</g></svg>`;
 }).join('');
 const inkComplete=Math.max(CONTRACT_TIMELINE.inkComplete,cursor),seal=inkComplete+300;
 return{markup,characters:letters.length,strokes:count,fallback:characters.filter(character=>character.kind==='fallback').map(character=>character.letter),timeline:{inkStart:CONTRACT_TIMELINE.inkStart,inkComplete,seal,complete:Math.max(CONTRACT_TIMELINE.complete,seal+1650)}};
}

// This is an in-world promise between the player and Klin, kept locally.
// Only the explicit signature button can start it; cancellation never commits.
export function showCompanionContract({phone,getWorld,userName,companionName,reduced=false,onCommit,onClose,loadSignatureGlyphs=loadContractSignatureGlyphs}={}){
 const layer=document.createElement('section');layer.className='contract-story';if(reduced)layer.classList.add('is-reduced');layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-labelledby','contract-heading');
 const now=new Date(),date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('.');
 const name=String(userName??'');let signature=createContractSignature(name);
 layer.innerHTML=`<div class="contract-paper-viewport" tabindex="0" role="region" aria-label="相遇契約內容"><article class="contract-document"><div class="contract-document-meta"><span>彼之境 · 回響檔案</span><span>No. 0001</span></div><header class="contract-document-heading"><span class="contract-mark" aria-hidden="true">✧</span><h2 id="contract-heading">相遇契約</h2><small>A PROMISE BETWEEN US</small></header><div class="contract-names"><strong>${escape(userName)}</strong><span>與</span><strong>${escape(companionName)}</strong></div><p class="contract-preamble">從這一次相遇開始，<br>我們為彼此留一盞燈。</p><div class="contract-clauses"><p><span>一</span>認真聽見彼此，記得那些微小的心事。</p><p><span>二</span>尊重各自的步調，陪伴每一次新的相遇。</p></div><div class="contract-signatures"><div class="contract-user-signature"><small>你的名字</small><div class="contract-signature-ink"><span class="contract-signature-name" aria-label="${escape(name)}">${signature.markup}</span></div></div><div class="contract-companion-signature"><small>你的同行者</small><strong>${escape(companionName)}</strong></div></div><footer class="contract-document-footer"><time datetime="${date.replaceAll('.','-')}">${date}</time><span>於彼之境，初次相遇</span></footer><span class="contract-seal" aria-hidden="true"><img src="assets/contract-seal-20261021/realm-seal.png" alt="" width="1280" height="1280"></span></article></div><div class="contract-actions"><p role="status" aria-live="polite" class="contract-status contract-sr-only">等待你確認這份相遇契約。</p><button type="button" class="btn contract-sign">留下我的名字</button></div>`;
 layer.querySelector('.contract-document').dataset.longNames=String(Math.max(Array.from(String(userName||'')).length,Array.from(String(companionName||'')).length)>10);
 const signatureSize=graphemes(name).length>8?12:graphemes(name).length>4?18:26;
 layer.querySelector('.contract-signature-name').style?.setProperty('--signature-font-size',`${signatureSize}px`);
 const app=phone.querySelector('#app'),previousInert=app?.inert;
 if(app)app.inert=true;phone.classList.add('contract-open');phone.append(layer);
 let disposed=false,signing=false,stopWorld=null,worldSigned=false,worldComplete=false,paperSealReady=false,paperComplete=false;
 const ready=Promise.resolve().then(()=>loadSignatureGlyphs(name)).catch(()=>({})).then(glyphs=>{if(disposed)return;signature=createContractSignature(name,glyphs);layer.querySelector('.contract-signature-name').innerHTML=signature.markup;layer.dataset.inkComplete=String(signature.timeline.inkComplete);layer.dataset.sealAt=String(signature.timeline.seal);layer.dataset.completeAt=String(signature.timeline.complete);layer.dataset.signatureStrokes=String(signature.strokes);layer.dataset.signatureFallback=String(signature.fallback.length);});
 const timers=new Set();
 function later(callback,delay){const timer=setTimeout(()=>{timers.delete(timer);if(!disposed)callback();},delay);timers.add(timer);}
 function dispose(restore=true){if(disposed)return;disposed=true;for(const timer of timers)clearTimeout(timer);timers.clear();stopWorld?.();stopWorld=null;document.removeEventListener('keydown',escapeKey);layer.remove();phone.classList.remove('contract-open');if(app)app.inert=previousInert;onClose?.();if(restore)app?.querySelector('[data-action="open-contract"]')?.focus({preventScroll:true});}
 function seal(){if(disposed||!paperSealReady||!(worldSigned||worldComplete))return;layer.classList.add('is-sealed');layer.querySelector('.contract-status').textContent='約定收到了。我們一起長大。';}
 function complete(){if(disposed||!paperComplete||!worldComplete)return;seal();stopWorld=null;dispose(false);onCommit?.();}
 async function sign(){if(disposed||signing)return;signing=true;layer.querySelector('.contract-sign').disabled=true;layer.querySelector('.contract-sign').setAttribute('aria-busy','true');layer.querySelector('.contract-sign').textContent='正在寫下我們的約定…';await ready;if(disposed)return;layer.classList.add('is-signing');layer.querySelector('.contract-status').textContent='你的名字，正在成為第一段回響。';
  later(()=>{paperSealReady=true;seal();},reduced?CONTRACT_TIMELINE.reducedSeal:signature.timeline.seal);
  later(()=>{paperComplete=true;complete();},reduced?CONTRACT_TIMELINE.reducedComplete:signature.timeline.complete);
  const world=getWorld?.();
  if(world?.signContract){
   const cancel=world.signContract({onSigned:()=>{if(disposed)return;worldSigned=true;seal();},onComplete:()=>{if(disposed)return;worldComplete=true;stopWorld=null;seal();complete();}});
   stopWorld=worldComplete?null:cancel;
  }else{worldSigned=true;worldComplete=true;}
 }
 function escapeKey(event){if(event.key==='Escape'){event.preventDefault();dispose();}}
 layer.querySelector('.contract-sign').addEventListener('click',sign);document.addEventListener('keydown',escapeKey);layer.querySelector('.contract-sign').focus({preventScroll:true});
 dispose.ready=ready;
 return dispose;
}
