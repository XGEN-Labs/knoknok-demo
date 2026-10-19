/** Klin login v4: a complete empty scene plus a true RGBA character sprite. */
export const KLIN_LOGIN_LOOP_SECONDS = 12;
export const KLIN_LOGIN_REFERENCE = Object.freeze({width:854,height:1842});
const vertexSource=`attribute vec2 aPosition; varying vec2 vUv;
void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
// This shader receives ONLY the transparent character. There is no scene sampler,
// color key, outline mask, difference matte, or original-character repair pass.
const fragmentSource=`
precision highp float;
uniform sampler2D uCharacter;
uniform vec2 uResolution;
uniform float uTime;
uniform float uMotion;
varying vec2 vUv;
const float TAU=6.28318530718;
float blink(float t,float center){float d=abs(t-center);return 1.-smoothstep(.035,.125,d);}
vec2 eyeBlink(vec2 q,vec2 eye,float close){
 float dy=q.y-eye.y, ad=abs(dy), outer=132.;
 float weight=1.-smoothstep(37.,70.,abs(q.x-eye.x));
 if(ad<outer&&weight>0.){
  float scale=1.-.96*close, inner=85.*scale;
  float mapped=ad<inner?ad/scale:85.+(ad-inner)*(outer-85.)/(outer-inner);
  q.y=mix(q.y,eye.y+sign(dy)*mapped,weight);
 }
 return q;
}
void main(){
 vec2 view=vec2(vUv.x,1.-vUv.y)*uResolution;
 float cover=max(uResolution.x/854.,uResolution.y/1842.);
 vec2 p=(view-(uResolution-vec2(854.,1842.)*cover)*.5)/cover;
 float phase=uTime/12.*TAU;
 float breath=sin(phase*3.)*uMotion;
 float tilt=sin(phase)*.035*uMotion;
 float lean=pow(max(0.,sin((uTime-5.3)/4.*3.14159265)),4.)*step(5.3,uTime)*step(uTime,9.3)*uMotion;
 vec2 pivot=vec2(418.,1266.);
 p-=pivot;
 // Inverse whole-sprite transform. All uncovered pixels are real empty scene.
 float c=cos(tilt),s=sin(tilt);
 p=mat2(c,-s,s,c)*p;
 p/=vec2(1.+breath*.012+lean*.025,1.+breath*.018+lean*.032);
 p+=pivot;
 vec2 q=(p-vec2(58.7,653.1))/.535;
 float close=max(blink(uTime,4.6),blink(uTime,9.8))*uMotion;
 q=eyeBlink(q,vec2(587.,692.),close);
 q=eyeBlink(q,vec2(774.,692.),close);
 vec2 uv=q/vec2(1359.,1157.);
 if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.)))){gl_FragColor=vec4(0.);return;}
 gl_FragColor=texture2D(uCharacter,uv);
}`;
const loopTime=t=>((Number(t)||0)%12+12)%12;
export function createKlinLoginScene({host,imageUrl,characterUrl,reducedMotion,onReady}={}){
 if(!host)throw new TypeError('Klin login scene requires a host.');
 let disposed=false,loaded=false,requested=true,raf=0,previousStamp=0,lastDraw=0,currentTime=0,mode='loading';
 const media=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
 let reduced=typeof reducedMotion==='boolean'?reducedMotion:Boolean(media?.matches);
 const oldPosition=host.style.position,changedPosition=getComputedStyle(host).position==='static';
 if(changedPosition)host.style.position='relative';
 const backdrop=document.createElement('img');
 backdrop.alt='';backdrop.dataset.klinLayer='scene';backdrop.draggable=false;
 Object.assign(backdrop.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'cover',pointerEvents:'none'});
 const ambient=document.createElement('canvas');ambient.dataset.klinLayer='atmosphere';
 const shadow=document.createElement('canvas');shadow.dataset.klinLayer='contact-shadow';
 const canvas=document.createElement('canvas');canvas.dataset.klinLayer='character';
 for(const layer of [ambient,shadow,canvas])Object.assign(layer.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
 const staticCharacter=document.createElement('img');staticCharacter.alt='';staticCharacter.dataset.klinLayer='character-fallback';
 Object.assign(staticCharacter.style,{position:'absolute',pointerEvents:'none',display:'none',maxWidth:'none'});
 host.append(backdrop,ambient,shadow,canvas,staticCharacter);
 const sprite=new Image();sprite.decoding='async';
 const atmosphere=ambient.getContext('2d'),shadowContext=shadow.getContext('2d');
 let gl=null,drawSprite=null,resolveReady,readyResolved=false;
 const ready=new Promise(resolve=>{resolveReady=resolve;});
 const resources={};
 function setReady(nextMode,error){mode=nextMode;host.dataset.klinMode=mode;if(!readyResolved){readyResolved=true;const result={mode,canvas,error};resolveReady(result);onReady?.(result);}}
 function dimensions(){
  const rect=host.getBoundingClientRect(),w=Math.max(1,rect.width||host.clientWidth||390),h=Math.max(1,rect.height||host.clientHeight||844);
  const ratio=Math.min(window.devicePixelRatio||1,1.5,Math.sqrt(1350000/(w*h)));
  const width=Math.max(1,Math.round(w*ratio)),height=Math.max(1,Math.round(h*ratio));
  for(const layer of [canvas,ambient,shadow])if(layer.width!==width||layer.height!==height){layer.width=width;layer.height=height;}
  const cover=Math.max(w/854,h/1842),offsetX=(w-854*cover)/2,offsetY=(h-1842*cover)/2;
  Object.assign(staticCharacter.style,{left:`${offsetX+58.7*cover}px`,top:`${offsetY+653.1*cover}px`,width:`${1359*.535*cover}px`,height:`${1157*.535*cover}px`});
  return [width,height];
 }
 function glow(ctx,x,y,rx,ry,color,alpha){
  ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);ctx.globalAlpha=alpha;
  const gradient=ctx.createRadialGradient(0,0,0,0,0,1);gradient.addColorStop(0,color);gradient.addColorStop(1,'rgba(255,244,219,0)');ctx.fillStyle=gradient;ctx.fillRect(-1,-1,2,2);ctx.restore();
 }
 function drawAtmosphere(size){
  if(!atmosphere)return;
  const ctx=atmosphere,[w,h]=size;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);
  const cover=Math.max(w/854,h/1842);ctx.setTransform(cover,0,0,cover,(w-854*cover)/2,(h-1842*cover)/2);
  // Broad independent light and mist; never draw or trace scene contours.
  const phase=currentTime/12*Math.PI*2,motion=reduced?0:1;
  glow(ctx,716,460,130,185,'rgba(255,229,173,1)',.045+.025*Math.sin(phase)*motion);
  glow(ctx,159,484,48,75,'rgba(255,232,188,1)',.04+.02*Math.cos(phase)*motion);
  for(let i=0;i<3;i++)glow(ctx,130+i*300+Math.sin(phase+i)*34*motion,635+i*100,190,55,'rgba(235,238,255,1)',.07+.035*Math.sin(phase+i)*motion);

 }
 function draw(){if(disposed||!loaded)return;const size=dimensions();drawAtmosphere(size);if(shadowContext){const [w,h]=size,cover=Math.max(w/854,h/1842);shadowContext.setTransform(1,0,0,1,0,0);shadowContext.clearRect(0,0,w,h);shadowContext.setTransform(cover,0,0,cover,(w-854*cover)/2,(h-1842*cover)/2);glow(shadowContext,418,1268,205,26,'rgba(90,78,113,1)',.14);}drawSprite?.(size);}
 function stopFrame(){if(raf)cancelAnimationFrame(raf);raf=0;previousStamp=0;}
 function schedule(){if(!disposed&&loaded&&requested&&!reduced&&!document.hidden&&drawSprite&&!raf)raf=requestAnimationFrame(frame);}
 function frame(stamp){raf=0;if(disposed||!requested||reduced||document.hidden)return;if(!previousStamp)previousStamp=stamp;currentTime=loopTime(currentTime+Math.min((stamp-previousStamp)/1000,.1));previousStamp=stamp;if(stamp-lastDraw>=1000/30-.6){draw();lastDraw=stamp;}schedule();}
 function freeGL(){if(!gl)return;for(const [key,remove] of [['texture','deleteTexture'],['buffer','deleteBuffer'],['program','deleteProgram']])if(resources[key]){gl[remove](resources[key]);resources[key]=null;}}
 function fallback(error){freeGL();gl=null;drawSprite=null;canvas.style.display='none';staticCharacter.src=sprite.src;staticCharacter.style.display='block';loaded=true;draw();setReady('static',error);}
 function initialize(){
  try{
   gl=canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:false,powerPreference:'low-power'});
   if(!gl){fallback();return;}
   function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(error);}return shader;}
   const vertex=compile(gl.VERTEX_SHADER,vertexSource),fragment=compile(gl.FRAGMENT_SHADER,fragmentSource),program=resources.program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);
   const buffer=resources.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
   const position=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
   const texture=resources.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,sprite);
   const uniforms=Object.fromEntries(['uCharacter','uResolution','uTime','uMotion'].map(k=>[k,gl.getUniformLocation(program,k)]));gl.uniform1i(uniforms.uCharacter,0);
   drawSprite=size=>{gl.viewport(0,0,...size);gl.useProgram(program);gl.uniform2f(uniforms.uResolution,...size);gl.uniform1f(uniforms.uTime,currentTime);gl.uniform1f(uniforms.uMotion,reduced?0:1);gl.drawArrays(gl.TRIANGLES,0,6);};
   loaded=true;draw();setReady('webgl');schedule();
  }catch(error){fallback(error);}
 }
 let sceneLoaded=false,spriteLoaded=false;
 function whenLoaded(){if(!disposed&&sceneLoaded&&spriteLoaded)initialize();}
 backdrop.onload=()=>{sceneLoaded=true;whenLoaded();};sprite.onload=()=>{spriteLoaded=true;whenLoaded();};
 function unavailable(){if(disposed)return;setReady('unavailable',new Error('分层登录素材无法加载'));}
 backdrop.onerror=unavailable;sprite.onerror=unavailable;
 function visibility(){stopFrame();if(!document.hidden)schedule();}
 function mediaChanged(event){if(typeof reducedMotion==='boolean')return;reduced=event.matches;stopFrame();if(reduced)currentTime=0;draw();schedule();}
 const resize=()=>draw(),resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;resizeObserver?.observe(host);if(!resizeObserver)window.addEventListener('resize',resize);
 function lost(event){event.preventDefault();stopFrame();fallback(new Error('WebGL context lost; using the same separated assets'));}
 canvas.addEventListener('webglcontextlost',lost);document.addEventListener('visibilitychange',visibility);media?.addEventListener?.('change',mediaChanged);
 backdrop.src=String(imageUrl||new URL('./source/clean-background.png',import.meta.url));
 sprite.src=String(characterUrl||new URL('./source/character-transparent.png',import.meta.url));
 return {ready,canvas,get currentTime(){return currentTime;},get mode(){return mode;},
  play(){if(disposed)return;requested=true;previousStamp=0;schedule();},pause(){requested=false;stopFrame();draw();},renderAt(seconds){if(disposed)return;currentTime=loopTime(seconds);draw();},
  dispose(){if(disposed)return;disposed=true;stopFrame();resizeObserver?.disconnect();window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);media?.removeEventListener?.('change',mediaChanged);canvas.removeEventListener('webglcontextlost',lost);backdrop.onload=backdrop.onerror=sprite.onload=sprite.onerror=null;freeGL();for(const layer of [backdrop,ambient,shadow,canvas,staticCharacter])layer.remove();if(changedPosition)host.style.position=oldPosition;if(!readyResolved)resolveReady({mode:'disposed',canvas});}
 };
}
export default createKlinLoginScene;
