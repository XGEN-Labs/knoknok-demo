import * as THREE from './vendor/three/three.module.js';
import { globePoint,worldMetrics,dragRotation,shouldSuppressKnock,clampPitch } from './friend-world-math.mjs';
const TEXTURE='assets/world-20261026-42/planet-meadow.webp';
/** One renderer per visible view. No idle animation, networking, or external avatars. */
export function mountFriendWorld(root,{reducedMotion=false,orientation={yaw:0,pitch:0},onRotate=()=>{}}={}){
 if(!root)return null;
 const viewport=root.querySelector('.world-viewport'),canvas=root.querySelector('canvas'),nodes=[...root.querySelectorAll('.network-friend')],phone=root.closest('.phone');
 let yaw=orientation.yaw||0,pitch=clampPitch(orientation.pitch||0),disposed=false,drag=null,suppressUntil=0,renderer=null,texture=null;
 let width=0,height=0,metrics,scene,camera,planet,geometry,material;
 const listMode=()=>root.dataset.worldFiltered==='true'||phone?.dataset.keyboardOpen==='true';
 function draw(){
  if(disposed)return;
  metrics=worldMetrics(width,height);const {radius,cx,cy}=metrics;
  root.style.setProperty('--world-diameter',`${radius*2}px`);root.style.setProperty('--world-center-y',`${cy}px`);
  root.dataset.worldYaw=yaw.toFixed(3);root.dataset.worldPitch=pitch.toFixed(3);
  root.querySelector('.world-fallback').style.backgroundPosition=`${50+yaw*32}% 50%`;
  nodes.forEach(node=>{
   const point=globePoint(+node.dataset.worldLon,+node.dataset.worldLat,yaw,pitch),scale=Math.min(1,radius/165)*(node.classList.contains('is-primary')?1.19:1)*(.78+Math.max(0,point.z)*.22);
   const back=point.z<.09&&!listMode();node.dataset.worldBack=String(back);node.tabIndex=back?-1:0;node.setAttribute('aria-hidden',String(back));
   node.style.left=`${cx+point.x*radius}px`;node.style.top=`${cy-point.y*radius}px`;
   node.style.setProperty('--world-node-scale',scale.toFixed(3));node.style.zIndex=String(10+Math.round(point.z*10));
   node.style.opacity=listMode()?'1':String(Math.min(1,Math.max(0,(point.z-.06)/.15)));
  });
  if(renderer&&!listMode()){
   planet.rotation.set(pitch,yaw,0,'XYZ');planet.position.y=(height/2-cy)/radius;
   camera.left=-width/2/radius;camera.right=width/2/radius;camera.top=height/2/radius;camera.bottom=-height/2/radius;camera.updateProjectionMatrix();renderer.render(scene,camera);
  }
  onRotate({yaw,pitch});
 }
 function resize(){const box=viewport.getBoundingClientRect();width=viewport.clientWidth||box.width;height=viewport.clientHeight||box.height;if(!width||!height)return;renderer?.setSize(width,height,false);draw();}
 try{
  renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,20);camera.position.z=5;
  scene.add(new THREE.HemisphereLight(0xfffcf1,0xa6b88e,2.8));const light=new THREE.DirectionalLight(0xffedcf,1.8);light.position.set(-3,5,4);scene.add(light);
  geometry=new THREE.SphereGeometry(1,80,56);material=new THREE.MeshStandardMaterial({color:0xd6e0b9,roughness:1,metalness:0});planet=new THREE.Mesh(geometry,material);scene.add(planet);
  new THREE.TextureLoader().load(TEXTURE,loaded=>{if(disposed){loaded.dispose();return;}texture=loaded;loaded.colorSpace=THREE.SRGBColorSpace;loaded.wrapS=THREE.RepeatWrapping;loaded.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),4);material.map=loaded;material.bumpMap=loaded;material.bumpScale=.012;material.color.set(0xffffff);material.needsUpdate=true;root.dataset.worldRenderer='webgl';draw();},undefined,()=>{root.dataset.worldRenderer='fallback';canvas.style.visibility='hidden';});
 }catch{root.dataset.worldRenderer='fallback';renderer?.dispose();renderer=null;}
 function down(event){if(event.button!==0||listMode()||event.target.closest('.world-navigation'))return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,yaw,pitch,moved:false};}
 function move(event){if(!drag||drag.id!==event.pointerId)return;if(event.buttons===0){cancel(event);return;}const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(!drag.moved&&!shouldSuppressKnock(dx,dy))return;
  drag.moved=true;viewport.setPointerCapture?.(event.pointerId);root.dataset.worldDragging='true';event.preventDefault();const next=dragRotation(drag,dx,dy);yaw=next.yaw;pitch=next.pitch;draw();}
 function up(event){if(!drag||drag.id!==event.pointerId)return;const moved=drag.moved;drag=null;root.dataset.worldDragging='false';if(viewport.hasPointerCapture?.(event.pointerId))viewport.releasePointerCapture(event.pointerId);if(moved){suppressUntil=performance.now()+500;}}
 function cancel(event){if(!drag||drag.id!==event.pointerId)return;drag=null;root.dataset.worldDragging='false';suppressUntil=performance.now()+500;}
 function click(event){if(performance.now()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();return;}const button=event.target.closest('[data-world-turn]');if(button){event.preventDefault();yaw+=Number(button.dataset.worldTurn)*.42;draw();}}
 function wheel(event){if(listMode())return;event.preventDefault();yaw+=Math.max(-100,Math.min(100,event.deltaX||event.deltaY))*.004;draw();}
 function key(event){if(event.target!==viewport||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;event.preventDefault();if(event.key==='Home'){yaw=0;pitch=0;}else if(event.key==='ArrowLeft'||event.key==='ArrowRight')yaw+=event.key==='ArrowLeft'?-.28:.28;else pitch=clampPitch(pitch+(event.key==='ArrowUp'?-.18:.18));draw();}
 function lost(event){event.preventDefault();root.dataset.worldRenderer='fallback';canvas.style.visibility='hidden';}
 viewport.addEventListener('pointerdown',down);viewport.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);viewport.addEventListener('lostpointercapture',cancel);viewport.addEventListener('wheel',wheel,{passive:false});viewport.addEventListener('keydown',key);root.addEventListener('click',click,true);canvas.addEventListener('webglcontextlost',lost);
 const observer=new ResizeObserver(resize);observer.observe(viewport);const keyboardObserver=new MutationObserver(resize);if(phone)keyboardObserver.observe(phone,{attributes:true,attributeFilter:['data-keyboard-open']});
 resize();
 return {setQuery(value){root.dataset.worldFiltered=String(!!String(value).trim());resize();},dispose(){disposed=true;observer.disconnect();keyboardObserver.disconnect();viewport.removeEventListener('pointerdown',down);viewport.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);viewport.removeEventListener('lostpointercapture',cancel);viewport.removeEventListener('wheel',wheel);viewport.removeEventListener('keydown',key);root.removeEventListener('click',click,true);canvas.removeEventListener('webglcontextlost',lost);geometry?.dispose();material?.dispose();texture?.dispose();renderer?.dispose();}};
}
