/** Soft blue-green fluid globe. Time is supplied by the caller; no private RAF. */
const WAVES=Object.freeze([
 Object.freeze({direction:[.82,.48,.31],frequency:4.05,speed:.42,phase:0,amplitude:.011}),
 Object.freeze({direction:[-.36,.86,.37],frequency:3.55,speed:-.31,phase:1.4,amplitude:.0075}),
 Object.freeze({direction:[.29,-.31,.91],frequency:5.10,speed:.27,phase:2.2,amplitude:.004}),
]);
const MAX_DEVIATION=WAVES.reduce((sum,wave)=>sum+wave.amplitude,0);
const number=value=>Number(value).toFixed(12);
const vector=value=>`vec3(${value.map(number).join(',')})`;
// The surface and CPU contact anchors share this radial field.
const waveGLSL=`float fluidRadius(vec3 n,float time){float radius=1.0;\n${WAVES.map(w=>`radius+=${number(w.amplitude)}*sin(dot(n,${vector(w.direction)})*${number(w.frequency)}+time*${number(w.speed)}+${number(w.phase)});`).join('\n')}\nreturn radius;}\nvec3 fluidGradient(vec3 n,float time){vec3 gradient=vec3(0.0);\n${WAVES.map(w=>`gradient+=${vector(w.direction)}*${number(w.amplitude*w.frequency)}*cos(dot(n,${vector(w.direction)})*${number(w.frequency)}+time*${number(w.speed)}+${number(w.phase)});`).join('\n')}\nreturn gradient;}`;
const vertexShader=/* glsl */`
 uniform float uTime;
 varying vec2 vFluidUV;
 varying vec3 vFluidPoint;
 varying vec3 vFluidNormal;
 varying vec3 vFluidView;
 ${waveGLSL}
 void main(){
  vec3 n=normalize(position);
  float radius=fluidRadius(n,uTime);
  vec3 gradient=fluidGradient(n,uTime);
  vec3 surfaceNormal=normalize(n-(gradient-n*dot(n,gradient))/radius);
  vec4 viewPoint=modelViewMatrix*vec4(n*radius,1.0);
  vFluidUV=uv;vFluidPoint=n;vFluidNormal=normalize(normalMatrix*surfaceNormal);vFluidView=isOrthographic?vec3(0.0,0.0,1.0):-viewPoint.xyz;
  gl_Position=projectionMatrix*viewPoint;
 }
`;
const fragmentShader=/* glsl */`
 uniform float uTime;
 uniform sampler2D uTexture;
 uniform bool uHasTexture;
 varying vec2 vFluidUV;
 varying vec3 vFluidPoint;
 varying vec3 vFluidNormal;
 varying vec3 vFluidView;
 vec3 fluidPaint(vec2 p){
  float u=fract(p.x);float v=clamp(p.y,.012,.988);
  vec3 paint=texture2D(uTexture,vec2(u,v)).rgb;
  // A soft crossfade makes the longitude seam continuous even if a generated
  // plate's extreme left and right pixels are not perfectly identical.
  vec3 seam=(texture2D(uTexture,vec2(.001,v)).rgb+texture2D(uTexture,vec2(.999,v)).rgb)*.5;
  return mix(paint,seam,1.0-smoothstep(0.0,.045,min(u,1.0-u)));
 }
 float tide(vec3 p,float t){
  vec3 q=p+vec3(sin(p.y*2.1+t*.19),sin(p.z*2.4-t*.17),sin(p.x*2.0+t*.16))*.48;
  return sin(q.x*2.6+q.y*1.5+t*.16)*.52+sin(q.y*2.8-q.z*2.3-t*.21)*.30+sin(q.z*3.4+q.x*1.8+t*.12)*.18;
 }
 void main(){
  vec3 p=normalize(vFluidPoint),n=normalize(vFluidNormal),view=normalize(vFluidView);
  float time=uTime;
  float field=tide(p,time);
  vec2 flow=vec2(sin(p.y*2.8+p.z*1.7+time*.21),cos(p.x*2.2-p.z*1.9-time*.17));
  vec2 warped=vFluidUV+flow*.075+vec2(time*.006,field*.035);
  float broad=smoothstep(-.65,.7,field)*.55;
  vec3 base=mix(vec3(.003,.10,.64),vec3(.006,.43,.30),broad);
  // Compress the old pale plate into deep water colour. Most of the depth is
  // volumetric-looking 3D flow; the reference plate contributes fine detail.
  if(uHasTexture)base=mix(base,fluidPaint(warped)*vec3(.045,.46,1.05),.35);
  float light=max(0.0,dot(n,normalize(vec3(-.45,.62,.72))));
  float facing=clamp(abs(dot(n,view)),0.0,1.0);
  float fresnel=pow(1.0-facing,2.05);
  // A broad satin reflection slides over the changing normals. Keep the core
  // saturated; emission belongs to the rim rather than a white body wash.
  float pearl=pow(max(0.0,dot(n,normalize(vec3(-.42,.68,.58)))),12.0);
  float ribbon=exp(-pow((field-.10)*7.0,2.0));
  float undertow=tide(p*1.25+vec3(.4,-.3,.6),time-3.0);
  vec3 color=base*(.78+.28*light);
  color+=vec3(.008,.18,.20)*ribbon*(.3+.7*smoothstep(-.5,.6,undertow));
  color+=vec3(.12,.38,.66)*pearl*.62;
  vec3 rim=mix(vec3(.14,.85,1.0),vec3(.30,.62,1.0),smoothstep(-.7,.7,p.x));
  color+=rim*fresnel*(1.45+.16*sin(field*3.0+time*.18));
  gl_FragColor=vec4(color,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
`;

/** Shared texture stays caller-owned. group is centred on radius-one origin.
 * update(seconds) sets a single time for material and the bound radiusAt helper.
 * Explicit radiusAt(...,seconds) is useful before update when placing anchors.
 */
export function createFluidPlanet(THREE,{texture=null,reducedMotion=false}={}){
 const group=new THREE.Group();group.name='soft-fluid-planet';
 const geometry=new THREE.SphereGeometry(1,112,80);
 // Account for shader displacement during CPU frustum culling.
 geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),1+MAX_DEVIATION);
 const uniforms={uTime:{value:0},uTexture:{value:texture},uHasTexture:{value:!!texture}};
 const material=new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,depthTest:true,depthWrite:true,toneMapped:false});
 const mesh=new THREE.Mesh(geometry,material);mesh.name='blue-green-fluid-surface';mesh.castShadow=false;mesh.receiveShadow=false;group.add(mesh);
 let time=0,requestedTime=0,disposed=false;
 const clock=seconds=>reducedMotion?0:Number.isFinite(seconds)?seconds:0;
 function radiusAt(x,y,z,seconds=time){const length=Math.hypot(x,y,z)||1,n=[x/length,y/length,z/length],t=clock(seconds);let radius=1;for(const wave of WAVES)radius+=wave.amplitude*Math.sin((n[0]*wave.direction[0]+n[1]*wave.direction[1]+n[2]*wave.direction[2])*wave.frequency+t*wave.speed+wave.phase);return radius;}
 const stats=Object.freeze({drawCalls:1,geometries:1,materials:1,triangles:geometry.index.count/3,maxRadialDeviation:MAX_DEVIATION,externalTextures:texture?1:0,animationOwner:'caller'});
 return {group,mesh,stats,radiusAt,update(seconds){if(disposed)return;requestedTime=Number.isFinite(seconds)?seconds:0;time=clock(requestedTime);uniforms.uTime.value=time;},setReducedMotion(value){if(disposed)return;reducedMotion=!!value;time=clock(requestedTime);uniforms.uTime.value=time;},dispose(){if(disposed)return;disposed=true;group.removeFromParent();group.clear();geometry.dispose();material.dispose();}};
}
