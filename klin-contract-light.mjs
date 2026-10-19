import * as THREE from './vendor/three/three.module.js';

const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>(x=clamp(x),x*x*(3-2*x));
export function contractLightPhase(progress){
  return progress==null?'idle':progress<.24?'touch':progress<.52?'weave':progress<.80?'sign':progress<1?'acknowledge':'sealed';
}

// A visual acknowledgement only. The host commits the actual contract after
// this cancellable sequence completes; this module never changes age or data.
export function createContractLight(){
  const group=new THREE.Group();group.name='klin-contract-light';group.visible=false;
  const uniforms={progress:{value:0},time:{value:0},opacity:{value:0},trace:{value:0}};
  const lineMaterial=(tint)=>new THREE.ShaderMaterial({uniforms:{...uniforms,tint:{value:new THREE.Color(tint)}},transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,toneMapped:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform vec3 tint;uniform float progress;uniform float opacity;uniform float trace;
      void main(){float head=clamp(progress*2.1,0.,1.3);float lead=1.-smoothstep(head-.02,head+.02,vUv.x);float tail=smoothstep(head-.65,head-.40,vUv.x);float edge=sin(vUv.y*3.1415926);gl_FragColor=vec4(tint*1.35,lead*tail*edge*opacity);#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
  const trails=new THREE.Group();group.add(trails);
  const curves=[];
  const rebuild=origin=>{
    for(const child of [...trails.children]){child.geometry.dispose();child.material.dispose();trails.remove(child);}
    curves.length=0;
    for(const side of [-1,1]){
      const curve=new THREE.CatmullRomCurve3([origin.clone(),new THREE.Vector3(side*.65,-1.3,1.1),new THREE.Vector3(side*1.15,.80,.9),new THREE.Vector3(side*.60,1.35,.7),new THREE.Vector3(side*.82,-.20,1.0),new THREE.Vector3(0,-.50,1.2)]);
      curves.push(curve);
      const material=lineMaterial(side<0?0x8b9dff:0xffd9ac);
      const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,96,.015,6,false),material);mesh.renderOrder=5;trails.add(mesh);
      const halo=new THREE.Mesh(new THREE.TubeGeometry(curve,80,.055,6,false),lineMaterial(side<0?0xa9afff:0xffbfa2));halo.material.uniforms.opacity={value:.25};halo.renderOrder=4;trails.add(halo);
    }
  };
  rebuild(new THREE.Vector3(0,-4,1.0));
  const sheetMaterial=new THREE.ShaderMaterial({uniforms:{opacity:uniforms.opacity,trace:uniforms.trace,time:uniforms.time},transparent:true,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float opacity;uniform float trace;uniform float time;
      void main(){vec2 p=abs(vUv-.5);float inside=(1.-smoothstep(.43,.49,p.x))*(1.-smoothstep(.39,.49,p.y));float edge=pow(max(p.x*2.,p.y*2.),10.);vec3 col=mix(vec3(.64,.72,1.),vec3(1.,.83,.60),vUv.x);gl_FragColor=vec4(col*(1.+edge*.4),inside*(.10+edge*.35)*opacity*trace);#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
  const sheet=new THREE.Mesh(new THREE.PlaneGeometry(2.2,1.18),sheetMaterial);sheet.position.set(0,-.42,1.15);sheet.rotation.z=-.045;sheet.renderOrder=6;group.add(sheet);
  const signaturePoints=[];
  const signatureCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.66,-.42,1.20),new THREE.Vector3(-.39,-.15,1.20),new THREE.Vector3(-.46,-.64,1.20),new THREE.Vector3(-.20,-.39,1.20),new THREE.Vector3(.03,-.52,1.20),new THREE.Vector3(.22,-.31,1.20),new THREE.Vector3(.13,-.59,1.20),new THREE.Vector3(.57,-.39,1.20)]);
  signaturePoints.push(...signatureCurve.getPoints(100));
  const signatureGeometry=new THREE.BufferGeometry().setFromPoints(signaturePoints);
  const signatureMaterial=new THREE.LineBasicMaterial({color:0xffe2ae,transparent:true,opacity:0,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const signature=new THREE.Line(signatureGeometry,signatureMaterial);signature.renderOrder=8;group.add(signature);
  const sealGeometry=new THREE.BufferGeometry().setFromPoints(Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*2;return new THREE.Vector3(Math.cos(a)*.16+.70,Math.sin(a)*.16-.68,1.21);}));
  const sealMaterial=new THREE.LineBasicMaterial({color:0xc6c9ff,transparent:true,opacity:0,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const seal=new THREE.Line(sealGeometry,sealMaterial);seal.renderOrder=8;group.add(seal);
  const beadGeometry=new THREE.BufferGeometry();beadGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(18),3));
  const beadMaterial=new THREE.ShaderMaterial({uniforms:{opacity:uniforms.opacity,pixelRatio:{value:1}},transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,toneMapped:false,
    vertexShader:'uniform float pixelRatio;void main(){gl_PointSize=16.*pixelRatio;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform float opacity;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float a=exp(-r*r*5.)*(1.-smoothstep(.55,1.,r));gl_FragColor=vec4(vec3(.75,.84,1.2),a*opacity);}' });
  const beads=new THREE.Points(beadGeometry,beadMaterial);beads.renderOrder=7;beads.frustumCulled=false;group.add(beads);
  let lastOrigin=new THREE.Vector3(0,-4,1);
  function update({progress=null,time=0,position,scale=1,origin,reduced=false,pixelRatio=1}={}){
    group.visible=progress!=null;
    if(!group.visible)return;
    if(position)group.position.copy(position);group.scale.setScalar(scale);
    const p=clamp(progress),appear=smooth(p/.12),fade=1-smooth((p-.91)/.09),sheetReveal=smooth((p-.28)/.22);
    uniforms.progress.value=reduced?1:p;uniforms.time.value=reduced?0:time;uniforms.opacity.value=appear*fade;uniforms.trace.value=sheetReveal;
    if(origin&&lastOrigin.distanceToSquared(origin)>.04){lastOrigin.copy(origin);rebuild(origin);}
    sheet.scale.setScalar(.84+sheetReveal*.16+Math.sin(clamp((p-.80)/.20)*Math.PI)*.025);
    signatureGeometry.setDrawRange(0,Math.max(0,Math.round(101*smooth((p-.49)/.28))));
    signatureMaterial.opacity=uniforms.opacity.value*.95;sealMaterial.opacity=uniforms.opacity.value*smooth((p-.76)/.10);
    seal.scale.setScalar(1+Math.sin(clamp((p-.78)/.22)*Math.PI)*.10);
    beadMaterial.uniforms.pixelRatio.value=pixelRatio;
    const points=beadGeometry.attributes.position;
    for(let i=0;i<6;i++){const curve=curves[i%2],along=clamp(p*2.1-i%3*.11),point=curve.getPoint(along);points.setXYZ(i,point.x,point.y,point.z);}
    points.needsUpdate=true;
    trails.visible=!reduced&&p<.72;beads.visible=!reduced&&p<.72;
  }
  return{group,update};
}
