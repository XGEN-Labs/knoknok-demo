import * as THREE from './vendor/three/three.module.js';

// Authored environment plates, with live native Klin rendered in front. UI is
// entirely HTML and uses the pre-scene-redesign components and styles.
const assets={
 home:'./assets/portal-scenes-20261020/champagne-metal-room.png',
 porch:'./assets/portal-scenes-20261020/three-avatar-porches.png',
 shared:'./assets/cloud-realm-20261019/shared.webp',
 arrival:'./assets/cloud-realm-20261019/arrival.webp',
};
export function createReferenceField(){
 const group=new THREE.Group();group.name='klin-reference-environments';
 const loader=new THREE.TextureLoader(),uniforms={time:{value:0},aspect:{value:402/874},conversation:{value:0},sceneFrom:{value:0},sceneTo:{value:0},sceneMix:{value:0},visitIndex:{value:0},visitPhase:{value:0},keepsake:{value:0}};
 const ready=Promise.all(Object.entries(assets).map(([key,url])=>new Promise((resolve,reject)=>{
  loader.load(url,texture=>{texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearMipmapLinearFilter;uniforms[key].value=texture;resolve(texture);},undefined,reject);
  uniforms[key]={value:null};
 })));
 const material=new THREE.ShaderMaterial({uniforms,depthWrite:false,depthTest:false,toneMapped:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,.9999,1.);}',
  fragmentShader:`varying vec2 vUv;uniform sampler2D home;uniform sampler2D porch;uniform sampler2D shared;uniform sampler2D arrival;
   uniform float aspect;uniform float time;uniform float sceneFrom;uniform float sceneTo;uniform float sceneMix;uniform float visitIndex;uniform float visitPhase;uniform float keepsake;
   vec4 sampleScene(float id,vec2 uv){if(id>2.5)return texture2D(arrival,uv);if(id>1.5)return texture2D(shared,uv);if(id>.5)return texture2D(porch,uv);return texture2D(home,uv);}
   void main(){
    vec2 uv=vUv;float sourceAspect=854./1842.;
    if(aspect>sourceAspect)uv.y=.5+(uv.y-.5)*sourceAspect/aspect;
    else uv.x=.5+(uv.x-.5)*aspect/sourceAspect;
    vec4 color=mix(sampleScene(sceneFrom,uv),sampleScene(sceneTo,uv),sceneMix);
    float porchWeight=mix(step(.5,sceneFrom)*(1.-step(1.5,sceneFrom)),step(.5,sceneTo)*(1.-step(1.5,sceneTo)),sceneMix);
    vec2 door=vec2(.20+visitIndex*.30,.59);float halo=exp(-dot((uv-door)*vec2(1.8,1.),(uv-door)*vec2(1.8,1.))*180.);
    float replyPulse=visitPhase<.9?.75+.25*sin(time*7.):1.;
    color.rgb+=vec3(.045,.020,.004)*halo*porchWeight*visitPhase*replyPulse;
    float sharedWeight=mix(step(1.5,sceneFrom)*(1.-step(2.5,sceneFrom)),step(1.5,sceneTo)*(1.-step(2.5,sceneTo)),sceneMix);
    float tile=exp(-dot((uv-vec2(.5,.48))*vec2(1.8,1.),(uv-vec2(.5,.48))*vec2(1.8,1.))*400.);
    color.rgb+=vec3(.045,.020,.005)*tile*sharedWeight*keepsake;
    gl_FragColor=color;
    #include <colorspace_fragment>
   }`
 });
 const plane=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);plane.frustumCulled=false;plane.renderOrder=-100;group.add(plane);
 return {group,material,ready};
}
export function createReferenceDepth(kind){const group=new THREE.Group();group.name=`klin-reference-${kind}`;return{group,plants:[]};}
export function updateReferenceDepth(){}
export function createReferenceGates(){const group=new THREE.Group();group.name='klin-reference-door-state';return{group};}
export function updateReferenceGates(gates,state={}){gates.group.userData.state=state;}
export function updateReferenceField(field,{from='home',to=from,mix=0,visit={},keepsake=false}={}){
 const kind=name=>name==='porch'?1:name==='shared'?2:name==='welcome'?3:0;
 const u=field.material.uniforms;u.sceneFrom.value=kind(from);u.sceneTo.value=kind(to);u.sceneMix.value=mix;
 u.visitIndex.value=Number(visit.activeId)||0;u.visitPhase.value=visit.phase==='open'?1:visit.phase==='knocking'?.6:0;u.keepsake.value=keepsake?1:0;
}
