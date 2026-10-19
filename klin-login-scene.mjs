import { createKlinLoginScene } from './assets/login-world-20261019/klin-login-scene.mjs?v=20261019-mobile-polish-23';

// The login artwork owns its character. Other routes retain the native world.
export function createLoginSceneBridge({phone}={}) {
  if(!phone)throw new TypeError('The login scene requires a phone host.');
  const host=document.createElement('div');
  host.className='klin-login-scene-host';
  host.setAttribute('aria-hidden','true');
  host.hidden=true;
  phone.prepend(host);
  let scene=null,active=false,reducedMotion=false,disposed=false,suspended=false,ready=false,mode='poster';
  function sync(){
    if(disposed)return;
    host.hidden=!active;
    phone.classList.toggle('klin-login-scene-active',active);
    phone.classList.toggle('klin-login-auth-active',active&&Boolean(phone.querySelector('#app .auth-login')));
    phone.dataset.loginScene=active?mode:'inactive';
    if(!scene)return;
    if(!active||suspended||document.hidden||reducedMotion){
      scene.pause();
      if(active&&ready&&reducedMotion&&!document.hidden)scene.renderAt(0);
    }else if(ready)scene.play();
  }
  function start(){
    if(scene||disposed)return;
    try{
      // Motion is controlled by this bridge, including live preference changes.
      scene=createKlinLoginScene({host,characterScale:.76,reducedMotion:false});
      scene.pause();
      Promise.resolve(scene.ready).then(result=>{
        if(disposed)return;
        ready=true;mode=result?.mode||scene.mode||'static';
        sync();
      }).catch(()=>{if(!disposed){mode='poster';sync();}});
    }catch{mode='poster';sync();}
  }
  function update(options={}){
    if(disposed)return;
    active=options.active===true;
    reducedMotion=options.reducedMotion===true;
    if(active)start();
    sync();
  }
  const onVisibility=()=>sync();
  const onPageShow=()=>{suspended=false;sync();};
  const onPageHide=event=>{if(event.persisted){suspended=true;sync();}else dispose();};
  document.addEventListener('visibilitychange',onVisibility);
  window.addEventListener('pageshow',onPageShow);
  window.addEventListener('pagehide',onPageHide);
  function dispose(){
    if(disposed)return;
    disposed=true;
    scene?.dispose();
    document.removeEventListener('visibilitychange',onVisibility);
    window.removeEventListener('pageshow',onPageShow);
    window.removeEventListener('pagehide',onPageHide);
    phone.classList.remove('klin-login-scene-active');
    phone.classList.remove('klin-login-auth-active');
    delete phone.dataset.loginScene;
    host.remove();
  }
  return {update,dispose,get status(){return {active,reducedMotion,ready,mode,disposed,time:scene?.currentTime||0};}};
}
