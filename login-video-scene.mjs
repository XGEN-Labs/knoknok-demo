export const LOGIN_VIDEO_ASSET = 'assets/welcome-sky-20261026-45/welcome-meadow-match.mp4';
export const LOGIN_VIDEO_POSTER = 'assets/welcome-sky-20261026-45/poster.jpg';
const openingRoutes = new Set(['welcome','login','register','verify']);

/** One persistent, silent video across welcome and sign-in. The poster is also
 * the reduced-motion and unavailable/autoplay-blocked fallback. */
export function createLoginVideoScene({phone,onPending=()=>{},document:doc=globalThis.document,scheduler=globalThis}={}) {
  if(!phone)throw new TypeError('A phone host is required.');
  const host=doc.createElement('div');host.className='klin-login-scene-host login-video-scene';host.hidden=true;host.setAttribute('aria-hidden','true');
  const poster=doc.createElement('img');poster.className='login-video-poster';poster.src=LOGIN_VIDEO_POSTER;poster.alt='';
  const video=doc.createElement('video');video.className='login-video-background';
  video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;video.preload='auto';video.poster=LOGIN_VIDEO_POSTER;video.disablePictureInPicture=true;
  video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
  host.append(poster,video);phone.prepend(host);
  let active=false,reduced=false,disposed=false,ready=false,failed=false,loaded=false,route='',pending=false,timer=null,playToken=0,starting=false;
  const clearTimer=()=>{if(timer!==null)scheduler.clearTimeout(timer);timer=null;};
  function publish(){
    host.dataset.videoReady=String(ready&&!failed&&!reduced);
    const next=active&&!doc.hidden&&!reduced&&!ready&&!failed;
    if(next!==pending){pending=next;onPending(next);}
  }
  function fallback(){failed=true;starting=false;clearTimer();video.pause();publish();}
  function play(){
    if(disposed||!active||reduced||doc.hidden||failed||starting||(!video.paused&&ready))return;
    if(!loaded){loaded=true;video.src=LOGIN_VIDEO_ASSET;}
    const token=++playToken;starting=true;
    if(!ready&&timer===null)timer=scheduler.setTimeout(fallback,8000);
    publish();
    try{Promise.resolve(video.play()).then(()=>{
      if(disposed||token!==playToken)return;
      starting=false;
      if(!active||reduced||doc.hidden){video.pause();return;}
      ready=video.readyState>=2;clearTimer();publish();
    },()=>{if(!disposed&&token===playToken)fallback();});}catch{fallback();}
  }
  function stop(){playToken++;starting=false;clearTimer();video.pause();}
  function onReady(){if(disposed)return;ready=true;clearTimer();publish();}
  function visibility(){if(doc.hidden)stop();else play();publish();}
  function retry(){if(active&&!reduced&&failed&&!video.error){failed=false;play();}}
  video.addEventListener('loadeddata',onReady);video.addEventListener('playing',onReady);video.addEventListener('error',fallback);
  doc.addEventListener('visibilitychange',visibility);phone.addEventListener('pointerdown',retry);
  function update(options={}){
    if(disposed)return;
    route=options.route||'';active=options.active!==false&&openingRoutes.has(route);reduced=options.reducedMotion===true;
    host.hidden=!active;phone.classList.toggle('klin-login-scene-active',active);phone.classList.toggle('login-video-active',active);phone.classList.remove('klin-login-auth-active');
    phone.dataset.portalScene=active?(route==='welcome'?'welcome':'login'):'inactive';phone.dataset.portalPhase=active?'idle':'inactive';phone.dataset.portalMotion=reduced?'still':'full';
    if(!active||reduced||doc.hidden)stop();else play();publish();
  }
  function dispose(){if(disposed)return;disposed=true;stop();if(pending)onPending(false);pending=false;
    video.removeEventListener('loadeddata',onReady);video.removeEventListener('playing',onReady);video.removeEventListener('error',fallback);
    doc.removeEventListener('visibilitychange',visibility);phone.removeEventListener('pointerdown',retry);video.removeAttribute('src');video.load();host.remove();
    phone.classList.remove('klin-login-scene-active','login-video-active');
  }
  return {update,dispose,get status(){return {route,active,reducedMotion:reduced,ready,failed,pending,mode:'login-video'};}};
}
