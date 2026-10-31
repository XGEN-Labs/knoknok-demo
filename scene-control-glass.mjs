import {coverRect,glassPosition,renderGlassTexture} from './landing-glass.mjs?v=20261031-product-sync';

// Ordinary image backgrounds are deliberately used instead of one composited
// backdrop per capsule. WebKit can split a live backdrop even on a paint-only
// pseudo element when a sibling canvas, SVG or textarea repaints.
export const SCENE_GLASS_TARGETS = [
  // New components opt into the same paint owner through their material class.
  // These named exceptions intentionally remain solid or transparent.
  '.kn-glass-control:not(.kn-birth-time-confirm):not(.landing-video-skip):not(.dark):not(.danger):not(.account-menu-actions > .btn)',
  '.kn-glass-panel','dialog.kn-date-picker',
  '.phone[data-scene-overlay="true"] #app .landing-form-card',
  '#app .scene-icon','#app .icon-button','#app .onboarding-back','#app .auth-back',
  '#app .scene-more','#app .scene-sound','#app .onboarding-history',
  '#app .welcome-actions>.btn','#app .onboarding-composer>.btn',
  '#app .quick-replies>button','#app .birth-hour-grid button',
  '#app .fixed-footer>.btn:not(.dark):not(.danger)',
  '#app .profile-footer>.btn:not(.dark):not(.danger)',
  '#app .profile-edit-footer>.btn:not(.dark):not(.danger)',
  '#app .lounge-footer>.btn:not(.dark):not(.danger)',
  '#app .home-chat-actions>.visit-entry','#app .conversation-replies>button',
  '#app .shared-composer>.btn:not(.dark):not(.danger)',
  '#app .tag-chat-tools>.tag-ui-button','#app .suggestions>button','#app .home-chat-identity',
  '#app .shared-chat-page .shared-people',
  '#app .tag-chat-card','#app .tag-chat-card .tag-ui-button:not(.tag-confirm)',
  '#app .tag-chat-card input:not([type=checkbox]):not([type=radio])',
  '#app .tag-chat-card select:not(.klin-native-select)','#app .tag-chat-card .klin-select-trigger',
  '#app .composer-row','#app .onboarding-input-row','#app .network-search',
  '#app .auth-panel','#app .conversation-message','#app .room-speech',
  '#app .bubble:not(.failed)','#app .onboarding-message',
  '#sheet:not(.notebook-stage)','#sheet .notebook-close','#sheet .sheet-title .icon-button',
  '#sheet .tag-history-entry','#sheet .tag-history-story',
  '#sheet .tag-history-options .tag-ui-button','#sheet .tag-diary-browser .tag-diary-list>button',
  '.landing-volume-toggle','.landing-video-resume',
  '.contract-story .contract-actions>.contract-sign'
].join(',');
const PROPERTIES=['--scene-glass-image','--scene-glass-size','--scene-glass-position','--scene-glass-fill','--scene-glass-shadow'];
const SOURCES=[
  '#app .shared-chat-page .shared-room-backdrop',
  '#app .friends-lounge .network-scene-source canvas:not([hidden])',
  '#app .friends-lounge .network-scene-source img',
  '.landing-video-scene.has-held-frame:not([hidden]) .landing-video-still',
  '.landing-video-scene:not([hidden]) video',
  '.login-video-scene[data-video-ready="true"]:not([hidden]) video',
  '.login-video-scene:not([hidden]) .login-video-poster',
  '.klin-illustrated-world:not([data-active="false"]) .klin-illustrated-plate:not([hidden])',
  '.portal-scene-host:not([hidden]) .portal-arrival-plate'
];
export function sceneSourceRect(sourceRect,phoneRect,width,height,intrinsicWidth,intrinsicHeight){
  const sx=width/phoneRect.width,sy=height/phoneRect.height;
  const box={x:(sourceRect.left-phoneRect.left)*sx,y:(sourceRect.top-phoneRect.top)*sy,width:sourceRect.width*sx,height:sourceRect.height*sy};
  const cover=coverRect(intrinsicWidth,intrinsicHeight,box.width,box.height);
  return {x:box.x+cover.x,y:box.y+cover.y,width:cover.width,height:cover.height};
}
export function sceneGlassMaterial(node,style){
  const own=node.matches('.conversation-message.own,.onboarding-message.is-user')||node.closest('.message.own');
  const kind=node.matches('#sheet,.kn-date-picker')?'sheet':node.matches('.auth-panel,.tag-chat-card,.kn-glass-panel,.landing-form-card,.tag-history-entry')?'panel':node.matches('.conversation-message,.room-speech,.bubble,.onboarding-message,.onboarding-reading')?(own?'own':'conversation'):'control';
  const field={sheet:'--kn-glass-sheet-fill',panel:'--kn-glass-panel-fill',own:'--kn-glass-own-fill',conversation:'--kn-glass-conversation-fill',control:'--kn-glass-fill'}[kind];
  const defaults={sheet:'rgba(255,255,255,.9)',panel:'rgba(255,255,255,.38)',own:'rgba(232,241,252,.9)',conversation:'rgba(255,255,255,.9)',control:'rgba(255,255,255,.62)'};
  const sat=style.getPropertyValue('--kn-glass-saturation').trim()||'100%';
  return {kind,fill:style.getPropertyValue(field).trim()||defaults[kind],blur:parseFloat(style.getPropertyValue(kind==='panel'||kind==='sheet'?'--kn-glass-panel-blur':'--kn-glass-blur'))||32,saturation:(parseFloat(sat)||100)/(sat.endsWith('%')?100:1),shadow:(kind==='panel'||kind==='sheet')&&!node.matches('.tag-history-entry')?'var(--kn-glass-panel-shadow)':'var(--kn-glass-control-shadow)'};
}

export function createSceneControlGlass({phone,environment={}}={}){
  if(!phone)throw new TypeError('A phone host is required.');
  const doc=phone.ownerDocument,win=doc.defaultView;
  const computed=environment.getComputedStyle||(node=>win.getComputedStyle(node));
  const createCanvas=environment.createCanvas||(()=>doc.createElement('canvas'));
  const renderTexture=environment.renderGlassTexture||renderGlassTexture;
  const Resize=environment.ResizeObserver||win.ResizeObserver,Mutation=environment.MutationObserver||win.MutationObserver;
  const later=environment.setTimeout||win.setTimeout.bind(win),cancel=environment.clearTimeout||win.clearTimeout.bind(win);
  const requestFrame=environment.requestAnimationFrame||win.requestAnimationFrame?.bind(win)||(callback=>later(callback,16));
  const cancelFrame=environment.cancelAnimationFrame||win.cancelAnimationFrame?.bind(win)||cancel;
  const touched=new Map(),observed=new Set();
  let disposed=false,refreshing=false,timer=null,resizeFrame=null,source=null,signature='',textures=new Map(),renders=0,error='',frameRenders=0;
  // ResizeObserver delivery must not synchronously mutate observed layout.
  const resize=Resize?new Resize(()=>{if(disposed||resizeFrame!==null)return;resizeFrame=requestFrame(()=>{resizeFrame=null;if(!disposed)refresh();});}):null;
  const mutation=Mutation?new Mutation(()=>refresh()):null;
  const visible=(node,sourceCheck=false)=>{if(!node||node.hidden||node.closest('[hidden]'))return false;const rect=node.getBoundingClientRect();if(!rect.width||!rect.height)return false;for(let current=node;current;current=current.parentElement){const style=computed(current);if(style.display==='none'||style.visibility==='hidden'||(sourceCheck&&style.opacity==='0'))return false;if(current===phone)break;}return true;};
  // The floating friend composer must include scrolling bubbles in its backdrop.
  const sceneTargets=()=>[...phone.querySelectorAll(SCENE_GLASS_TARGETS)].filter(node=>!(node.matches('.composer-row')&&node.closest('.shared-composer'))&&visible(node)&&node.getAttribute('data-landing-glass')!=='ready');
  function chooseSource(){for(const selector of SOURCES)for(const node of phone.querySelectorAll(selector)){if(!visible(node,true))continue;const width=node.videoWidth||node.naturalWidth||node.width,height=node.videoHeight||node.naturalHeight||node.height;if(width&&height&&(!node.matches('video')||node.readyState>=2))return {node,width,height};}return null;}
  function preserve(node){if(!touched.has(node))touched.set(node,{marker:node.getAttribute('data-scene-glass'),styles:PROPERTIES.map(p=>[node.style.getPropertyValue(p),node.style.getPropertyPriority(p)])});}
  function assign(node,marker,values){preserve(node);PROPERTIES.forEach((p,i)=>{const value=values[i]||'';if(node.style.getPropertyValue(p)!==value){if(value)node.style.setProperty(p,value);else node.style.removeProperty(p);}});if(node.getAttribute('data-scene-glass')!==marker)node.setAttribute('data-scene-glass',marker);if(!observed.has(node)){observed.add(node);resize?.observe(node);}}
  function restore(node,prior){PROPERTIES.forEach((p,i)=>{const [value,priority]=prior.styles[i];if(value)node.style.setProperty(p,value,priority);else node.style.removeProperty(p);});if(prior.marker===null)node.removeAttribute('data-scene-glass');else node.setAttribute('data-scene-glass',prior.marker);resize?.unobserve(node);observed.delete(node);touched.delete(node);}
  function schedule(video){if(timer!==null){cancel(timer);timer=null;}if(!disposed&&!doc.hidden&&video&&!video.paused&&!video.ended)timer=later(()=>{timer=null;refresh();},250);}
  function refresh(){
    if(disposed||refreshing||phone.dataset.conversationAvatarMotion)return false;refreshing=true;
    try{
      const nodes=sceneTargets();
      const current=new Set(nodes);for(const [node,prior]of touched)if(!current.has(node))restore(node,prior);
      const selected=chooseSource(),rect=phone.getBoundingClientRect(),width=phone.clientWidth,height=phone.clientHeight;
      const video=selected?.node.matches('video')?selected.node:null;schedule(video);
      if(!nodes.length||!selected||!width||!height||!rect.width||!rect.height){
        textures.clear();signature='';source=null;
        for(const node of nodes){const material=sceneGlassMaterial(node,computed(node));assign(node,'fallback',['','','',material.fill,material.shadow]);}
        return false;
      }
      const {node:media}=selected,mediaRect=media.getBoundingClientRect();
      const next=JSON.stringify([selected.width,selected.height,width,height,media.currentSrc||media.src||'',media.matches('canvas')?(media.dataset.cosmosFrame||media.dataset.landingFrameRevision||phone.dataset.landingCue):'',video?Math.floor((video.currentTime||0)*4):'',mediaRect.left-rect.left,mediaRect.top-rect.top,mediaRect.width,mediaRect.height]);
      if(media!==source||next!==signature){textures.clear();signature=next;source=media;}
      let snapshot=null;
      const materials=new Map(),surfaces=[];
      for(const node of nodes){
        const material=sceneGlassMaterial(node,computed(node));
        // Controls inside an already painted form/sheet naturally see that
        // parent's texture. Keep their white layer instead of sampling behind
        // the parent again (which would erase the panel's 38% white material).
        const parent=node.parentElement?.closest('.auth-panel,.tag-chat-card,#sheet:not(.notebook-stage),.kn-date-picker,.kn-glass-panel,.kn-glass-control,.landing-form-card,.tag-history-entry');
        if(parent&&current.has(parent)){surfaces.push({node,material,layer:true});continue;}
        const materialKey=JSON.stringify([material.kind,material.fill,material.blur,material.saturation]);
        let texture=materials.get(materialKey)||textures.get(materialKey);
        if(!texture){
          if(!snapshot){snapshot=createCanvas();snapshot.width=width;snapshot.height=height;const context=snapshot.getContext('2d',{alpha:false});if(!context)throw new Error('2D canvas unavailable');context.fillStyle='#eee6d9';context.fillRect(0,0,width,height);const box=sceneSourceRect(mediaRect,rect,width,height,selected.width,selected.height);const mediaFilter=computed(media).filter;if('filter'in context&&mediaFilter&&mediaFilter!=='none')context.filter=mediaFilter;context.drawImage(media,box.x,box.y,box.width,box.height);
            const mediaStyle=computed(media),overlayTop=mediaStyle.getPropertyValue('--kn-scene-overlay-top').trim(),overlayBottom=mediaStyle.getPropertyValue('--kn-scene-overlay-bottom').trim();
            if(overlayTop&&overlayBottom){const gradient=context.createLinearGradient(0,0,0,height);gradient.addColorStop(0,overlayTop);gradient.addColorStop(1,overlayBottom);context.filter='none';context.fillStyle=gradient;context.fillRect(0,0,width,height);}
            frameRenders++;}
          texture={...renderTexture({sourceCanvas:snapshot,width,height,ratio:1,blur:material.blur,saturation:material.saturation,fill:material.fill,createCanvas}),material};renders++;
        }
        materials.set(materialKey,texture);surfaces.push({node,material,texture});
      }
      textures=materials;
      for(const {node,material,texture,layer}of surfaces){
        if(layer){assign(node,'layer',['','','',material.fill,material.shadow]);continue;}
        const position=glassPosition(rect,node.getBoundingClientRect(),width,height);
        assign(node,'ready',[`url("${texture.url}")`,`${width}px ${height}px`,`${position.x}px ${position.y}px`,material.fill,material.shadow]);
      }
      error='';return true;
    }catch(cause){error=String(cause?.message||cause);textures.clear();signature='';for(const node of sceneTargets()){const material=sceneGlassMaterial(node,computed(node));assign(node,'fallback',['','','',material.fill,material.shadow]);}return false;}
    finally{refreshing=false;}
  }
  resize?.observe(phone);
  mutation?.observe(phone,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','src','data-active','data-conversation-avatar-motion','data-video-ready','data-landing-glass','data-landing-cue','data-landing-frame-revision']});
  // A seek/decode may replace pixels without advancing the 250ms sample bucket.
  // Invalidate only the currently sampled landing video; while its captured still
  // is displayed above it, that still remains the paint owner until handoff.
  const mediaReady=event=>{if(event.target===source&&event.target.matches('video')&&event.target.closest('.landing-video-scene'))signature='';refresh();};
  const mediaEvents=['loadeddata','playing','seeked'];
  const events=['kn-cosmos-frame','scroll','load','pause','transitionend','animationend','pointerover','focusin'];
  events.forEach(event=>phone.addEventListener(event,refresh,true));
  mediaEvents.forEach(event=>phone.addEventListener(event,mediaReady,true));
  win.addEventListener('resize',refresh);win.visualViewport?.addEventListener('resize',refresh);win.visualViewport?.addEventListener('scroll',refresh);doc.addEventListener('visibilitychange',refresh);doc.fonts?.addEventListener('loadingdone',refresh);
  refresh();
  return {refresh,getDiagnostics:()=>({surfaces:touched.size,renders,frameRenders,source:source?.className||'',materials:[...textures.values()].map(t=>({kind:t.material.kind,fill:t.material.fill,method:t.method})),error}),dispose(){if(disposed)return;disposed=true;if(timer!==null)cancel(timer);timer=null;if(resizeFrame!==null)cancelFrame(resizeFrame);resizeFrame=null;for(const [node,prior]of touched)restore(node,prior);textures.clear();resize?.disconnect();mutation?.disconnect();events.forEach(event=>phone.removeEventListener(event,refresh,true));mediaEvents.forEach(event=>phone.removeEventListener(event,mediaReady,true));win.removeEventListener('resize',refresh);win.visualViewport?.removeEventListener('resize',refresh);win.visualViewport?.removeEventListener('scroll',refresh);doc.removeEventListener('visibilitychange',refresh);doc.fonts?.removeEventListener('loadingdone',refresh);}};
}
