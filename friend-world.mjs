import * as THREE from './vendor/three/three.module.js';
import { globePoint,worldMetrics,dragRotation,shouldSuppressKnock,clampPitch } from './friend-world-math.mjs';
import { createFriendWorldLoadGate } from './friend-world-loading.mjs?v=20261026-social-tags-45';
const MEADOW_SURFACE='assets/home-scene-20261023-v35/welcome-meadow.webp';
const FALLBACK_SURFACE='assets/friend-realm-20261027-49/meadow-fallback.svg';

// A continuous 3-D field avoids the equator seams of a painted road texture.
const meadowHeight=(x,y,z)=>.016*Math.sin(x*4.1+y*2.2)*Math.cos(z*3.7-y)+.008*Math.sin(y*8.2-z*3.3)*Math.cos(x*6.1+z);
const meadowPatch=(x,y,z)=>.5+.25*Math.sin(x*4.6+z*3.7)*Math.cos(y*5.1-z)+.13*Math.sin(z*11.4+y*7.1)*Math.cos(x*8.9-y*2);
function createMeadow(){
 const world=new THREE.Group(),surface=new THREE.SphereGeometry(1,112,80),positions=surface.attributes.position,colors=new Float32Array(positions.count*3);
 const pale=new THREE.Color(0xf7f9ec),moss=new THREE.Color(0xe4efd9),color=new THREE.Color(),normal=new THREE.Vector3();
 for(let i=0;i<positions.count;i++){normal.fromBufferAttribute(positions,i).normalize();const {x,y,z}=normal,r=1+meadowHeight(x,y,z);positions.setXYZ(i,x*r,y*r,z*r);color.lerpColors(pale,moss,meadowPatch(x,y,z));colors.set([color.r,color.g,color.b],i*3);}
 surface.setAttribute('color',new THREE.BufferAttribute(colors,3));surface.computeVertexNormals();
 world.add(new THREE.Mesh(surface,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0})));
 // Each tuft is a few curved blades rooted in the soil, never floating decor.
 const blade=new THREE.BufferGeometry();blade.setAttribute('position',new THREE.Float32BufferAttribute([-.006,0,0,.006,0,0,.003,.031,.004,-.006,0,0,.003,.031,.004,-.001,.053,.01],3));blade.computeVertexNormals();
 const count=48,grass=new THREE.InstancedMesh(blade,new THREE.MeshStandardMaterial({color:0x93a578,roughness:1,side:THREE.DoubleSide}),count*3);
 const dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);
 for(let i=0;i<count;i++){const y=1-2*(i+.5)/count,angle=i*2.399963229728653,ring=Math.sqrt(1-y*y);normal.set(Math.cos(angle)*ring,y,Math.sin(angle)*ring);
  const r=1+meadowHeight(normal.x,normal.y,normal.z),size=.5+.5*(.5+.5*Math.sin(i*17.13));
  for(let j=0;j<3;j++){dummy.position.copy(normal).multiplyScalar(r-.003);dummy.quaternion.setFromUnitVectors(up,normal);dummy.rotateY(i*1.37+j*2.1);dummy.rotateZ((j-1)*.3);dummy.scale.setScalar(size);dummy.updateMatrix();grass.setMatrixAt(i*3+j,dummy.matrix);color.lerpColors(pale,moss,.25+.55*(.5+.5*Math.sin(i*9.7+j)));grass.setColorAt(i*3+j,color);}
 }
 world.add(grass);return world;
}
/** One renderer per visible view. All sample media are packaged locally. */
export function mountFriendWorld(root,{reducedMotion=false,orientation={yaw:0,pitch:0},onRotate=()=>{},onStateChange=()=>{}}={}){
 if(!root)return null;
 const viewport=root.querySelector('.world-viewport'),canvas=root.querySelector('canvas'),nodes=[...root.querySelectorAll('.network-friend')],phone=root.closest('.phone'),loader=root.querySelector('.world-loading');
 const images=[...root.querySelectorAll('.world-rooms img')],imageCleanups=[];
 let yaw=orientation.yaw||0,pitch=clampPitch(orientation.pitch||0),disposed=false,drag=null,suppressUntil=0,renderer=null,texture=null,contextLost=false;
 let width=0,height=0,metrics,scene,camera,planet;
 root.dataset.reducedMotion=String(reducedMotion);
 function failedImage(image){image.style.visibility='hidden';image.closest('.network-house')?.setAttribute('data-image-failed','true');}
 function useFallback(){root.dataset.worldRenderer='fallback';canvas.style.visibility='hidden';}
 const gate=createFriendWorldLoadGate(['renderer','terrain','layout',...images.map((_,index)=>`image-${index}`)],{
  onChange(state){
   if(disposed)return;
   root.dataset.worldState=state.status;root.setAttribute('aria-busy',String(state.status==='loading'));
   if(loader)loader.hidden=!state.visible;
   onStateChange(state);
  },
  onTimeout(keys){if(keys.includes('terrain'))useFallback();keys.forEach(key=>{if(key.startsWith('image-'))failedImage(images[Number(key.slice(6))]);});},
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
  if(renderer&&!contextLost&&!listMode()){
   planet.rotation.set(pitch,yaw,0,'XYZ');planet.position.y=(height/2-cy)/radius;
   camera.left=-width/2/radius;camera.right=width/2/radius;camera.top=height/2/radius;camera.bottom=-height/2/radius;camera.updateProjectionMatrix();renderer.render(scene,camera);
  }
  onRotate({yaw,pitch});
 }
 function resize(){const box=viewport.getBoundingClientRect();width=viewport.clientWidth||box.width;height=viewport.clientHeight||box.height;if(!width||!height)return;renderer?.setSize(width,height,false);draw();gate.complete('layout');}
 try{
  renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,20);camera.position.z=5;
  scene.add(new THREE.HemisphereLight(0xfffcf1,0xc2d0b1,2.7));const light=new THREE.DirectionalLight(0xfff5e5,1.05);light.position.set(-3,5,4);scene.add(light);
  planet=createMeadow();scene.add(planet);root.dataset.worldRenderer='webgl';gate.complete('renderer');
  // Reuse the actual landing meadow, sampling only its grass area via UVs.
  // The original image stays untouched; mirrored wrapping removes a hard seam.
  new THREE.TextureLoader().load(MEADOW_SURFACE,loaded=>{if(disposed||contextLost){loaded.dispose();return;}texture=loaded;loaded.colorSpace=THREE.SRGBColorSpace;loaded.wrapS=THREE.MirroredRepeatWrapping;loaded.wrapT=THREE.ClampToEdgeWrapping;loaded.repeat.set(2,.32);loaded.offset.set(0,.2);loaded.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),4);const material=planet.children[0].material;material.map=loaded;material.bumpMap=loaded;material.bumpScale=.014;material.needsUpdate=true;root.dataset.worldSurface='landing-meadow';draw();gate.complete('terrain');},undefined,()=>{if(disposed)return;root.dataset.worldSurface='procedural-fallback';draw();gate.complete('terrain',false);});
 }catch{useFallback();renderer?.dispose();renderer=null;gate.complete('renderer',false);const fallbackSurface=new Image();fallbackSurface.src=FALLBACK_SURFACE;watchImage(fallbackSurface,'terrain',{fallback:true});}
 function down(event){if(event.button!==0||listMode()||root.dataset.worldState==='loading')return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,yaw,pitch,moved:false};}
 function move(event){if(!drag||drag.id!==event.pointerId)return;if(event.buttons===0){cancel(event);return;}const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(!drag.moved&&!shouldSuppressKnock(dx,dy))return;
  drag.moved=true;viewport.setPointerCapture?.(event.pointerId);root.dataset.worldDragging='true';event.preventDefault();const next=dragRotation(drag,dx,dy);yaw=next.yaw;pitch=next.pitch;draw();}
 function up(event){if(!drag||drag.id!==event.pointerId)return;const moved=drag.moved;drag=null;root.dataset.worldDragging='false';if(viewport.hasPointerCapture?.(event.pointerId))viewport.releasePointerCapture(event.pointerId);if(moved){suppressUntil=performance.now()+500;}}
 function cancel(event){if(!drag||drag.id!==event.pointerId)return;drag=null;root.dataset.worldDragging='false';suppressUntil=performance.now()+500;}
 function click(event){if(performance.now()<suppressUntil||root.dataset.worldState==='loading'){event.preventDefault();event.stopImmediatePropagation();}}
 function wheel(event){if(listMode())return;event.preventDefault();yaw+=Math.max(-100,Math.min(100,event.deltaX||event.deltaY))*.004;draw();}
 function key(event){if(event.target!==viewport||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;event.preventDefault();if(event.key==='Home'){yaw=0;pitch=0;}else if(event.key==='ArrowLeft'||event.key==='ArrowRight')yaw+=event.key==='ArrowLeft'?-.28:.28;else pitch=clampPitch(pitch+(event.key==='ArrowUp'?-.18:.18));draw();}
 function lost(event){event.preventDefault();contextLost=true;useFallback();gate.fail('webgl-context');gate.complete('terrain',false);}
 viewport.addEventListener('pointerdown',down);viewport.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);viewport.addEventListener('lostpointercapture',cancel);viewport.addEventListener('wheel',wheel,{passive:false});viewport.addEventListener('keydown',key);root.addEventListener('click',click,true);canvas.addEventListener('webglcontextlost',lost);
 const observer=new ResizeObserver(resize);observer.observe(viewport);const keyboardObserver=new MutationObserver(resize);if(phone)keyboardObserver.observe(phone,{attributes:true,attributeFilter:['data-keyboard-open']});
 resize();
 return {ready:gate.ready,getState:gate.getState,setQuery(value){root.dataset.worldFiltered=String(!!String(value).trim());resize();},dispose(){if(disposed)return;gate.dispose();disposed=true;imageCleanups.forEach(clean=>clean());observer.disconnect();keyboardObserver.disconnect();viewport.removeEventListener('pointerdown',down);viewport.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);viewport.removeEventListener('lostpointercapture',cancel);viewport.removeEventListener('wheel',wheel);viewport.removeEventListener('keydown',key);root.removeEventListener('click',click,true);canvas.removeEventListener('webglcontextlost',lost);const geometries=new Set(),materials=new Set();planet?.traverse(node=>{if(node.isInstancedMesh)node.dispose();if(node.geometry)geometries.add(node.geometry);if(node.material)materials.add(node.material);});geometries.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());texture?.dispose();renderer?.dispose();}};
}
