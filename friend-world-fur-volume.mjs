import {FLUID_MAX_DEVIATION,FLUID_WAVE_GLSL,fluidRadiusAt} from './friend-world-fluid.mjs?v=20261030-visit-fur-92';

// Curved, tapered ribbons rooted in object space: depth and silhouette come
// from geometry, not a photographed sphere or camera-facing matte.
const common=/* glsl */`
 uniform float uTime;
 ${FLUID_WAVE_GLSL}
 vec3 groom(vec3 n){
  vec3 axis=normalize(vec3(.42,.24,.88));
  vec3 curl=cross(axis,n);
  vec3 down=vec3(-.15,-1.0,.08);down-=n*dot(down,n);
  vec3 wave=vec3(sin(n.y*15.0+n.z*8.0),sin(n.z*13.0+n.x*9.0),sin(n.x*14.0+n.y*7.0));
  wave-=n*dot(wave,n);
  return normalize(curl*.9+down*.55+wave*.38+vec3(.0001));
 }
 vec3 coatColor(vec3 n){
  float cyan=smoothstep(-.5,.8,n.y*.7-n.x*.4);
  float clump=.88+.12*sin(n.x*8.0+n.y*6.0)*sin(n.z*6.0-n.y*4.0);
  return mix(vec3(.002,.26,1.45),vec3(.008,.85,1.22),cyan)*clump;
 }
`;
const fiberVertex=/* glsl */`
 ${common}
 attribute vec3 root;
 attribute vec3 seed;
 varying float vT;
 varying float vAcross;
 varying float vRandom;
 varying vec3 vNormal;
 varying vec3 vTangent;
 varying vec3 vColor;
 varying vec3 vView;
 void main(){
  float t=position.y;vec3 n=root;
  vec3 g=groom(n);
  float tuft=.78+.22*sin(n.x*19.0+n.y*13.0)*sin(n.z*17.0-n.y*9.0);
  float len=mix(.085,.205,pow(seed.x,1.5))*tuft;
  if(seed.z>.99)len=.22;
  float sway=sin(uTime*1.3+seed.y*6.28+n.y*5.0)*.0035;
  vec3 side=normalize(cross(n,g));
  g=normalize(g+side*(seed.y-.5)*.40);
  vec3 bend=g*len*1.05+side*(seed.y-.5)*.025;
  vec3 base=n*(0.955*fluidRadius(n,uTime));
  vec3 point=base+n*len*(t-.60*t*t)+bend*t*t+side*sway*t*t;
  vec3 tangent=normalize(n*len*(1.0-1.20*t)+2.0*bend*t+side*sway*2.0*t);
  vec3 vp=(modelViewMatrix*vec4(point,1.0)).xyz;
  vec3 vt=normalize(normalMatrix*tangent);
  vec3 right=normalize(cross(vt,normalize(-vp)));
  float width=mix(.0008,.00145,seed.z)*pow(max(.02,1.0-t),.7);
  vp+=right*position.x*width;
  vT=t;vAcross=position.x;vRandom=seed.z;
  vNormal=normalize(normalMatrix*normalize(n+g*.40));vTangent=vt;vView=normalize(-vp);vColor=coatColor(n);
  gl_Position=projectionMatrix*vec4(vp,1.0);
 }
`;
const fiberFragment=/* glsl */`
 varying float vT;varying float vAcross;varying float vRandom;
 varying vec3 vNormal;varying vec3 vTangent;varying vec3 vColor;varying vec3 vView;
 void main(){
  vec3 n=normalize(vNormal),tangent=normalize(vTangent);
  vec3 light=normalize(vec3(-.68,.85,.75));
  float diffuse=.46+.84*max(0.0,dot(n,light));
  float shaft=sqrt(max(0.0,1.0-pow(dot(tangent,light),2.0)));
  vec3 halfVector=normalize(light+normalize(vView));
  float sheen=pow(sqrt(max(0.0,1.0-pow(dot(tangent,halfVector),2.0))),24.0);
  float occlusion=mix(.46,1.18,smoothstep(0.0,.70,vT));
  vec3 color=vColor*diffuse*occlusion*(.80+vRandom*.25);
  color+=vec3(.07,.52,.75)*sheen*.46*smoothstep(.15,.8,vT);
  color+=vColor*shaft*.16;
  float fill=max(0.0,dot(n,normalize(vec3(.85,.05,.6))));
  color+=vColor*vec3(.15,.4,.72)*fill*.20;
  float rim=pow(1.0-max(0.0,dot(n,normalize(vView))),3.0);
  float edgeLight=.35+.65*max(0.0,dot(n,normalize(vec3(-.6,.7,-.4))));
  color+=vec3(.08,.78,1.15)*rim*edgeLight*.95*smoothstep(.2,.8,vT);
  float alpha=1.0-smoothstep(.45,1.0,abs(vAcross));
  if(alpha<.08)discard;
  gl_FragColor=vec4(color,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
`;
const baseVertex=/* glsl */`${common}
 varying vec3 vN;varying vec3 vP;
 void main(){vP=normalize(position);vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position*fluidRadius(vP,uTime),1.0);}
`;
const baseFragment=/* glsl */`${common}
 varying vec3 vN;varying vec3 vP;
 void main(){float light=.38+.62*max(0.0,dot(normalize(vN),normalize(vec3(-.68,.85,.75))));gl_FragColor=vec4(coatColor(vP)*light*.64,1.0);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }
`;

export function createPlushPlanet(THREE,{reducedMotion=false,fiberCount=220000}={}){
 const group=new THREE.Group();group.name='volumetric-blue-fur-planet';
 const uniforms={uTime:{value:0}};
 const geometry=new THREE.SphereGeometry(.954,80,56);
 const material=new THREE.ShaderMaterial({uniforms,vertexShader:baseVertex,fragmentShader:baseFragment,toneMapped:false});
 const mesh=new THREE.Mesh(geometry,material);group.add(mesh);
 const fibers=new THREE.InstancedBufferGeometry(),positions=[],indices=[];
 const segments=6;
 for(let i=0;i<=segments;i++){positions.push(-1,i/segments,0,1,i/segments,0);if(i<segments){let a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}
 fibers.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));fibers.setIndex(indices);
 const roots=new Float32Array(fiberCount*3),seeds=new Float32Array(fiberCount*3);
 let state=94031;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 for(let i=0;i<fiberCount;i++){
  const y=1-2*(i+.5)/fiberCount,a=i*2.399963229728653+(random()-.5)*.015,r=Math.sqrt(1-y*y);
  roots.set([Math.cos(a)*r,y,Math.sin(a)*r],i*3);seeds.set([random(),random(),random()],i*3);
 }
 fibers.setAttribute('root',new THREE.InstancedBufferAttribute(roots,3));fibers.setAttribute('seed',new THREE.InstancedBufferAttribute(seeds,3));fibers.instanceCount=fiberCount;
 const bound=1.125;
 fibers.boundingSphere=new THREE.Sphere(new THREE.Vector3(),bound);
 geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),bound);
 const fiberMaterial=new THREE.ShaderMaterial({uniforms,vertexShader:fiberVertex,fragmentShader:fiberFragment,transparent:true,depthWrite:true,depthTest:true,side:THREE.DoubleSide,toneMapped:false});
 const hair=new THREE.Mesh(fibers,fiberMaterial);hair.name='individual-curved-fibers';group.add(hair);
 let requestedTime=0,disposed=false;const applyTime=()=>uniforms.uTime.value=reducedMotion?0:requestedTime;
 const stats=Object.freeze({drawCalls:2,geometries:2,materials:2,triangles:geometry.index.count/3+fiberCount*segments*2,fiberCount,maxRadialDeviation:bound-1,radialMotion:FLUID_MAX_DEVIATION,externalTextures:0,animationOwner:'caller',surface:'curved-3d-fibers'});
 return {group,mesh,stats,radiusAt(x=0,y=0,z=1,seconds=uniforms.uTime.value){return 1.014*fluidRadiusAt(x,y,z,reducedMotion?0:seconds);},update(seconds){if(disposed)return;requestedTime=Number.isFinite(seconds)?seconds:0;applyTime();},setReducedMotion(value){if(disposed)return;reducedMotion=!!value;applyTime();},dispose(){if(disposed)return;disposed=true;group.removeFromParent();group.clear();for(const r of [geometry,material,fibers,fiberMaterial])r.dispose();}};
}
