import * as THREE from './vendor/three/three.module.js';
import { globePoint,worldMetrics,dragRotation,shouldSuppressKnock,clampPitch } from './friend-world-math.mjs?v=20261029-visit-82c';
import { createFriendWorldLoadGate } from './friend-world-loading.mjs?v=20261026-social-tags-45';
import { createFluidPlanet } from './friend-world-fluid.mjs?v=20261029-visit-83e';
export function friendSearchOrientation(longitude,latitude){
 return {yaw:-(Number(longitude)||0)*Math.PI/180,pitch:clampPitch((Number(latitude)||0)*Math.PI/180)};
}
const TEXTURE='assets/visit-fluid-20261029-80/fluid-pearl.png';
/** One renderer per visible view. All sample media are packaged locally. */
export function mountFriendWorld(root,{reducedMotion=false,orientation={yaw:0,pitch:0},onRotate=()=>{},onStateChange=()=>{}}={}){
 if(!root)return null;
 const viewport=root.querySelector('.world-viewport'),canvas=root.querySelector('canvas'),nodes=[...root.querySelectorAll('.network-friend')],phone=root.closest('.phone'),loader=root.querySelector('.world-loading');
 const images=[...root.querySelectorAll('.world-rooms img')],imageCleanups=[];
 let yaw=orientation.yaw||0,pitch=clampPitch(orientation.pitch||0),disposed=false,drag=null,suppressUntil=0,renderer=null,texture=null,contextLost=false;
 let width=0,height=0,metrics,scene,camera,fluid=null,time=0;
 const sceneRoot=root.closest('.friends-lounge');
 root.dataset.reducedMotion=String(reducedMotion);
 function failedImage(image){image.style.visibility='hidden';image.closest('.world-contact-avatar')?.setAttribute('data-image-failed','true');}
 function useFallback(){root.dataset.worldRenderer='fallback';canvas.style.visibility='hidden';}
 const gate=createFriendWorldLoadGate(['renderer','texture','layout',...images.map((_,index)=>`image-${index}`)],{
  onChange(state){
   if(disposed)return;
   root.dataset.worldState=state.status;root.setAttribute('aria-busy',String(state.status==='loading'));
   if(loader)loader.hidden=!state.visible;
   onStateChange(state);
  },
  onTimeout(keys){if(keys.includes('texture'))useFallback();keys.forEach(key=>{if(key.startsWith('image-'))failedImage(images[Number(key.slice(6))]);});},
 });
 function watchImage(image,key,{fallback=false}={}){
  let settled=false;
  const clean=()=>{image.removeEventListener('load',loaded);image.removeEventListener('error',failed);};
  const finish=ok=>{if(settled||disposed)return;settled=true;clean();if(!ok&&!fallback)failedImage(image);gate.complete(key,ok);};
  const failed=()=>finish(false);
  const loaded=()=>{if(!image.naturalWidth)return failed();if(typeof image.decode==='function')image.decode().then(()=>finish(true),()=>finish(!!image.naturalWidth));else finish(true);};
  image.addEventListener('load',loaded);image.addEventListener('error',failed);imageCleanups.push(()=>{settled=true;clean();});
  if(image.complete)loaded();
 }
 images.forEach((image,index)=>watchImage(image,`image-${index}`));
 const setStyle=(node,key,value)=>{if(node.style.getPropertyValue(key)!==value)node.style.setProperty(key,value);};
 const setAttribute=(node,key,value)=>{if(node.getAttribute(key)!==String(value))node.setAttribute(key,String(value));};
 let searchOrientation=null;
 function focusSearchMatch(){const match=nodes.find(node=>!node.hidden);if(match)({yaw,pitch}=friendSearchOrientation(match.dataset.worldLon,match.dataset.worldLat));}
 function setQuery(value){
  const filtered=!!String(value??'').trim();
  if(filtered){if(!searchOrientation)searchOrientation={yaw,pitch};focusSearchMatch();}
  else if(searchOrientation){({yaw,pitch}=searchOrientation);searchOrientation=null;}
  root.dataset.worldFiltered=String(filtered);resize();
 }
 function draw({notifyRotation=true}={}){
  if(disposed)return;
  metrics=worldMetrics(width,height);const {radius,cx,cy}=metrics;
  setStyle(root,'--world-diameter',`${radius*2}px`);setStyle(root,'--world-center-y',`${cy}px`);
  root.dataset.worldYaw=yaw.toFixed(3);root.dataset.worldPitch=pitch.toFixed(3);
  setStyle(root.querySelector('.world-fallback'),'background-position',`${50+yaw*32}% 50%`);
  nodes.forEach(node=>{
   const ground=globePoint(+node.dataset.worldLon,+node.dataset.worldLat,0,0),surfaceRadius=fluid?.radiusAt(ground.x,ground.y,ground.z,time)||1,point=globePoint(+node.dataset.worldLon,+node.dataset.worldLat,yaw,pitch),scale=Math.min(1,radius/165)*(node.classList.contains('is-primary')?1.19:1)*(.78+Math.max(0,point.z)*.22);
   const back=point.z<.09,unavailable=back||node.hidden;setAttribute(node,'data-world-back',back);setAttribute(node,'tabindex',unavailable?-1:0);setAttribute(node,'aria-hidden',unavailable);
   setStyle(node,'left',`${Number((cx+point.x*radius*surfaceRadius).toFixed(1))}px`);setStyle(node,'top',`${Number((cy-point.y*radius*surfaceRadius).toFixed(1))}px`);
   setStyle(node,'--world-node-scale',scale.toFixed(3));setStyle(node,'z-index',String(10+Math.round(point.z*10)));
   setStyle(node,'opacity',String(Math.min(1,Math.max(0,(point.z-.06)/.15))));
  });
  if(renderer&&fluid&&!contextLost){
   fluid.group.rotation.set(pitch,yaw,0,'XYZ');fluid.group.position.y=(height/2-cy)/radius;
   camera.left=-width/2/radius;camera.right=width/2/radius;camera.top=height/2/radius;camera.bottom=-height/2/radius;camera.updateProjectionMatrix();
   renderer.render(scene,camera);root.dataset.worldDrawCalls=String(renderer.info.render.calls);root.dataset.worldTriangles=String(renderer.info.render.triangles);root.dataset.worldMaterial='blue-green-fluid';root.dataset.worldTime=time.toFixed(3);
  }
  if(notifyRotation)onRotate({yaw,pitch});
 }

 function resize(){const box=viewport.getBoundingClientRect();width=viewport.clientWidth||box.width;height=viewport.clientHeight||box.height;if(!width||!height)return;renderer?.setSize(width,height,false);draw();gate.complete('layout');root.dispatchEvent(new root.ownerDocument.defaultView.CustomEvent('kn-world-layout',{bubbles:true,detail:{radius:metrics.radius,cx:metrics.cx,cy:metrics.cy}}));}
 try{
  renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,20);camera.position.z=5;
  gate.complete('renderer');
  new THREE.TextureLoader().load(TEXTURE,loaded=>{
   if(disposed||contextLost){loaded.dispose();return;}
   texture=loaded;loaded.colorSpace=THREE.SRGBColorSpace;loaded.wrapS=THREE.RepeatWrapping;loaded.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),4);
   try{
    fluid=createFluidPlanet(THREE,{texture:loaded,reducedMotion});fluid.update(time);scene.add(fluid.group);
    root.dataset.worldFluid=JSON.stringify(fluid.stats);root.dataset.worldRenderer='webgl';canvas.style.visibility='';draw();gate.complete('texture');
   }catch(error){fluid?.dispose();fluid=null;useFallback();gate.complete('texture',false);console.warn('Fluid planet unavailable; keeping the static material.',error);}
  },undefined,()=>{if(disposed)return;useFallback();gate.complete('texture',false);});
 }catch{useFallback();renderer?.dispose();renderer=null;gate.complete('renderer',false);const fallbackTexture=new Image();fallbackTexture.src=TEXTURE;watchImage(fallbackTexture,'texture',{fallback:true});}

 function down(event){if(event.button!==0||root.dataset.worldState==='loading')return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,yaw,pitch,moved:false};}
 function move(event){if(!drag||drag.id!==event.pointerId)return;if(event.buttons===0){cancel(event);return;}const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(!drag.moved&&!shouldSuppressKnock(dx,dy))return;
  drag.moved=true;viewport.setPointerCapture?.(event.pointerId);root.dataset.worldDragging='true';event.preventDefault();const next=dragRotation(drag,dx,dy);yaw=next.yaw;pitch=next.pitch;draw();}
 function up(event){if(!drag||drag.id!==event.pointerId)return;const moved=drag.moved;drag=null;root.dataset.worldDragging='false';if(viewport.hasPointerCapture?.(event.pointerId))viewport.releasePointerCapture(event.pointerId);if(moved){suppressUntil=performance.now()+500;}}
 function cancel(event){if(!drag||drag.id!==event.pointerId)return;drag=null;root.dataset.worldDragging='false';suppressUntil=performance.now()+500;}
 function click(event){if(performance.now()<suppressUntil||root.dataset.worldState==='loading'){event.preventDefault();event.stopImmediatePropagation();}}
 function wheel(event){event.preventDefault();yaw+=Math.max(-100,Math.min(100,event.deltaX||event.deltaY))*.004;draw();}
 function key(event){if(event.target!==viewport||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;event.preventDefault();if(event.key==='Home'){yaw=0;pitch=0;}else if(event.key==='ArrowLeft'||event.key==='ArrowRight')yaw+=event.key==='ArrowLeft'?-.28:.28;else pitch=clampPitch(pitch+(event.key==='ArrowUp'?-.18:.18));draw();}
 function spaceFrame(event){
  if(disposed)return;
  reducedMotion=!!event.detail.reducedMotion;root.dataset.reducedMotion=String(reducedMotion);
  time=reducedMotion?0:Number(event.detail.time)||0;fluid?.setReducedMotion(reducedMotion);fluid?.update(time);
  if(contextLost||!renderer||!fluid)return;
  draw({notifyRotation:false});
 }
 sceneRoot?.addEventListener('kn-cosmos-tick',spaceFrame);
 function lost(event){event.preventDefault();contextLost=true;useFallback();gate.fail('webgl-context');gate.complete('texture',false);}

 viewport.addEventListener('pointerdown',down);viewport.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);viewport.addEventListener('lostpointercapture',cancel);viewport.addEventListener('wheel',wheel,{passive:false});viewport.addEventListener('keydown',key);root.addEventListener('click',click,true);canvas.addEventListener('webglcontextlost',lost);
 const observer=new ResizeObserver(resize);observer.observe(viewport);const keyboardObserver=new MutationObserver(resize);if(phone)keyboardObserver.observe(phone,{attributes:true,attributeFilter:['data-keyboard-open']});
 if(root.dataset.worldFiltered==='true'){searchOrientation={yaw,pitch};focusSearchMatch();}
 resize();
 return {ready:gate.ready,getState:gate.getState,setQuery,dispose(){if(disposed)return;gate.dispose();disposed=true;imageCleanups.forEach(clean=>clean());observer.disconnect();keyboardObserver.disconnect();viewport.removeEventListener('pointerdown',down);viewport.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);viewport.removeEventListener('lostpointercapture',cancel);viewport.removeEventListener('wheel',wheel);viewport.removeEventListener('keydown',key);root.removeEventListener('click',click,true);canvas.removeEventListener('webglcontextlost',lost);sceneRoot?.removeEventListener('kn-cosmos-tick',spaceFrame);fluid?.dispose();texture?.dispose();renderer?.dispose();}};
}
