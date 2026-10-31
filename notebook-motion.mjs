// A real, readable notebook floats out from the companion; no prerecorded UI.
export function mountNotebookMotion(dialog, phone) {
 let animations=[],destroyed=false,closing=false;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const trigger=phone.querySelector('[data-action="tag-diary"]');
 const place=()=>{const r=phone.getBoundingClientRect();for(const [key,value] of Object.entries({left:r.left,top:r.top,width:r.width,height:r.height}))dialog.style.setProperty(`--notebook-${key}`,`${value}px`);};
 place();window.addEventListener('resize',place);window.visualViewport?.addEventListener('resize',place);
 const book=()=>dialog.querySelector('.notebook-v92');
 const origin=()=>{
  const p=phone.getBoundingClientRect(),b=book().getBoundingClientRect(),actor=phone.querySelector('.home-companion');
  const a=actor?.getBoundingClientRect();
  const x=a?.width?a.left+a.width*.5:p.left+p.width*.5,y=a?.height?a.top+a.height*.48:p.top+p.height*.58;
  return `translate(${x-b.left-b.width/2}px,${y-b.top-b.height/2}px) scale(.09) rotate(-12deg) rotateY(-24deg)`;
 };
 const animate=(el,frames,options)=>{const a=el.animate(frames,{fill:'both',...options});animations.push(a);return a.finished.catch(()=>{});};
 const cover=()=>{const el=document.createElement('div');el.className='notebook-front-cover';el.setAttribute('aria-hidden','true');el.innerHTML='<img class="notebook-cover-logo" src="assets/brand-20261028-noknok/noknok-selected-white.png" alt=""><span class="notebook-cover-name">日記本</span>';book().append(el);return el;};
 const arrive=async()=>{
  const b=book(),c=cover();dialog.classList.add('notebook-animating');b.inert=true;
  await animate(b,[{transform:origin(),opacity:0},{offset:.22,opacity:1},{transform:'translate(0,0) scale(1) rotate(0) rotateY(0)',opacity:1}],{duration:reduced?1:760,easing:'cubic-bezier(.22,.75,.2,1)'});
  if(destroyed||closing)return;
  await animate(c,[{transform:'rotateY(0deg)',opacity:1},{offset:.76,transform:'rotateY(-100deg)',opacity:1},{transform:'rotateY(-116deg)',opacity:0}],{duration:reduced?1:800,delay:reduced?0:160,easing:'cubic-bezier(.35,.05,.2,1)'});
  if(destroyed||closing)return;c.remove();animations.forEach(a=>a.cancel());animations=[];b.inert=false;dialog.classList.remove('notebook-animating');dialog.querySelector('.notebook-panel')?.focus({preventScroll:true});
 };
 void arrive();
 return {
  async close(done){
   if(closing||destroyed)return;closing=true;
   animations.forEach(a=>a.cancel());animations=[];dialog.querySelector('.notebook-front-cover')?.remove();
   const b=book(),c=cover();b.inert=true;dialog.classList.add('notebook-animating');
   await animate(c,[{transform:'rotateY(-116deg)',opacity:0},{offset:.2,opacity:1},{transform:'rotateY(0deg)',opacity:1}],{duration:reduced?1:500,easing:'ease-in-out'});
   if(destroyed)return;
   await animate(b,[{transform:'none',opacity:1},{offset:.8,opacity:1},{transform:origin(),opacity:0}],{duration:reduced?1:600,easing:'cubic-bezier(.6,0,.8,.3)'});
   if(!destroyed){done();if(trigger?.isConnected)trigger.focus({preventScroll:true});}
  },
  destroy(){destroyed=true;animations.forEach(a=>a.cancel());animations=[];window.removeEventListener('resize',place);window.visualViewport?.removeEventListener('resize',place);dialog.classList.remove('notebook-stage','notebook-animating');},
 };
}
