import { WELCOME_SCENE_ASSET } from './scene-assets.mjs?v=20261023-scene-35d';
const WELCOME=WELCOME_SCENE_ASSET;
const ARRIVAL=WELCOME_SCENE_ASSET;
const authRoutes=new Set(['login','register','verify']);
export function createPortalArrival({phone}={}){
  if(!phone)throw new TypeError('The portal arrival requires a phone host.');
  const host=document.createElement('div');host.className='klin-login-scene-host portal-scene-host';host.setAttribute('aria-hidden','true');host.hidden=true;
  host.innerHTML=`<img class="portal-welcome-plate" src="${WELCOME}" alt=""><div class="portal-warm-light"></div><img class="portal-arrival-plate" src="${ARRIVAL}" alt="">`;
  phone.prepend(host);
  // Portal pixels own the complete transition. The retired auth class swaps in
  // the old, unzoomed login underlay and exposes a second rectangular layer.
  phone.classList.remove('klin-login-auth-active');
  let route='',reducedMotion=false,disposed=false,phaseTimer,hideTimer;
  function update(options={}){
    if(disposed)return;
    const next=options.route||'',auth=authRoutes.has(next),active=next==='welcome'||next==='landing'||auth;
    reducedMotion=options.reducedMotion===true;
    if(next===route){phone.dataset.portalMotion=reducedMotion?'still':'full';return;}
    clearTimeout(phaseTimer);clearTimeout(hideTimer);
    const entering=route==='welcome'&&auth&&!reducedMotion;
    phone.dataset.portalMotion=reducedMotion?'still':'full';
    phone.dataset.portalScene=auth?'login':active?next:'inactive';
    phone.dataset.portalPhase=entering?'entering':auth||next==='landing'?'lit':'idle';
    phone.classList.toggle('klin-login-scene-active',active);
    phone.classList.remove('klin-login-auth-active');
    if(active){host.hidden=false;host.classList.remove('portal-departing');}
    else if(!host.hidden){host.classList.add('portal-departing');hideTimer=setTimeout(()=>{host.hidden=true;},reducedMotion?0:800);}
    if(entering)phaseTimer=setTimeout(()=>{if(!disposed&&authRoutes.has(route))phone.dataset.portalPhase='lit';},1900);
    route=next;
  }
  function dispose(){disposed=true;clearTimeout(phaseTimer);clearTimeout(hideTimer);host.remove();phone.classList.remove('klin-login-scene-active','klin-login-auth-active');delete phone.dataset.portalScene;delete phone.dataset.portalPhase;delete phone.dataset.portalMotion;}
  return {update,dispose,get status(){return {route,reducedMotion,disposed,mode:'static-portal',ready:host.querySelector('.portal-welcome-plate').complete};}};
}
