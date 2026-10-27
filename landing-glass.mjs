// A paused scene sampled once into an ordinary image: no live backdrop-filter
// surface is retained under editable text or reflowing conversation content.
export const LANDING_GLASS_TARGETS = '.conversation-onboarding :is(.onboarding-message,.onboarding-reading,.onboarding-input-row,.kn-birth-time-picker,.birth-hour-grid button,.quick-replies button,.onboarding-composer>.btn)';
const PROPERTIES = ['--landing-glass-image','--landing-glass-size','--landing-glass-position','--landing-glass-fill'];

export function coverRect(sourceWidth,sourceHeight,width,height) {
  const scale=Math.max(width/sourceWidth,height/sourceHeight);
  return {x:(width-sourceWidth*scale)/2,y:(height-sourceHeight*scale)/2,width:sourceWidth*scale,height:sourceHeight*scale};
}

export function glassPosition(sceneRect,targetRect,width,height) {
  return {x:(sceneRect.left-targetRect.left)*width/sceneRect.width,y:(sceneRect.top-targetRect.top)*height/sceneRect.height};
}

// Three separable box passes approximate a Gaussian when CanvasRenderingContext2D
// has no filter support (older WebKit). Clamped edges avoid transparent seams.
export function softwareGlassBlur(image,width,height,sigma,saturation=1) {
  const data=image.data, ideal=Math.sqrt(4*sigma*sigma+1);
  const lower=Math.max(1,Math.floor(ideal)-(Math.floor(ideal)%2===0?1:0)),upper=lower+2;
  const count=Math.round((12*sigma*sigma-3*lower*lower-12*lower-9)/(-4*lower-4));
  const temp=new Uint8ClampedArray(data.length);
  for(let pass=0;pass<3;pass++){
    const radius=Math.max(0,((pass<count?lower:upper)-1)/2),diameter=radius*2+1;
    for(let axis=0;axis<2;axis++){
      const input=axis?temp:data,output=axis?data:temp;
      const rows=axis?width:height,length=axis?height:width,stride=axis?width*4:4;
      for(let row=0;row<rows;row++){
        const base=axis?row*4:row*width*4,sums=[0,0,0];
        for(let k=-radius;k<=radius;k++){const p=base+Math.max(0,Math.min(length-1,k))*stride;for(let c=0;c<3;c++)sums[c]+=input[p+c];}
        for(let col=0;col<length;col++){
          const p=base+col*stride;for(let c=0;c<3;c++)output[p+c]=sums[c]/diameter;output[p+3]=255;
          const from=base+Math.max(0,col-radius)*stride,to=base+Math.min(length-1,col+radius+1)*stride;
          for(let c=0;c<3;c++)sums[c]+=input[to+c]-input[from+c];
        }
      }
    }
  }
  for(let p=0;p<data.length;p+=4){const gray=.213*data[p]+.715*data[p+1]+.072*data[p+2];for(let c=0;c<3;c++)data[p+c]=gray+(data[p+c]-gray)*saturation;}
  return image;
}

const canvasBlurSupport=new WeakMap();

// A writable filter property is not proof that the engine actually filters
// pixels. Some WebKit canvas paths accept the string but draw a sharp image.
// Verify one tiny impulse once per canvas factory; the real scene stays private
// to the renderer and never needs to be read for this capability check.
export function canvasBlurWorks(createCanvas){
  if(canvasBlurSupport.has(createCanvas))return canvasBlurSupport.get(createCanvas);
  let supported=false;
  try{
    const source=createCanvas(),target=createCanvas();source.width=source.height=target.width=target.height=17;
    const paint=source.getContext('2d',{alpha:false}),filter=target.getContext('2d',{alpha:false,willReadFrequently:true});
    if(paint&&filter&&'filter'in filter){
      paint.fillStyle='#000';paint.fillRect(0,0,17,17);paint.fillStyle='#fff';paint.fillRect(8,8,1,1);
      filter.filter='blur(2px) saturate(1)';filter.drawImage(source,0,0);
      const pixels=filter.getImageData(8,8,2,1).data;
      supported=pixels[0]>0&&pixels[0]<254&&pixels[4]>0;
    }
  }catch{/* The deterministic software path also covers unreadable probes. */}
  canvasBlurSupport.set(createCanvas,supported);return supported;
}

export function renderGlassTexture({sourceCanvas,width,height,ratio=1,blur=30,saturation=1,fill='rgba(255,255,255,.62)',createCanvas,verifyNativeBlur=canvasBlurWorks}) {
  const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio)),radius=blur*ratio,pad=Math.ceil(radius*3);
  const make=(cw,ch)=>{const canvas=createCanvas();canvas.width=cw;canvas.height=ch;const context=canvas.getContext('2d',{alpha:false});if(!context)throw new Error('2D canvas unavailable');return [canvas,context];};
  const [scene,paint]=make(w+2*pad,h+2*pad),rect=coverRect(sourceCanvas.width,sourceCanvas.height,w,h);
  paint.fillStyle='#e7e5f4';paint.fillRect(0,0,scene.width,scene.height);
  paint.drawImage(sourceCanvas,pad+rect.x,pad+rect.y,rect.width,rect.height);
  // Extend the visible plate's edge pixels throughout the blur sampling margin.
  if(pad){
    paint.drawImage(scene,pad,pad,w,1,pad,0,w,pad);
    paint.drawImage(scene,pad,pad+h-1,w,1,pad,pad+h,w,pad);
    paint.drawImage(scene,pad,0,1,scene.height,0,0,pad,scene.height);
    paint.drawImage(scene,pad+w-1,0,1,scene.height,pad+w,0,pad,scene.height);
  }
  const [filtered,filter]=make(scene.width,scene.height);
  const expression=`blur(${radius}px) saturate(${saturation})`;
  let method='software';
  if('filter' in filter&&verifyNativeBlur(createCanvas)){filter.filter=expression;if(filter.filter===expression)method='native';}
  if(method==='native'){filter.drawImage(scene,0,0);filter.filter='none';}
  else {const pixels=paint.getImageData(0,0,scene.width,scene.height);filter.putImageData(softwareGlassBlur(pixels,scene.width,scene.height,radius,saturation),0,0);}
  const [result,output]=make(w,h);output.drawImage(filtered,pad,pad,w,h,0,0,w,h);
  output.fillStyle=fill;output.fillRect(0,0,w,h);
  return {url:result.toDataURL('image/png'),method,width,height};
}

export function createLandingGlass({phone,sourceCanvas,environment={}}={}) {
  if(!phone||!sourceCanvas)throw new TypeError('A phone and held source canvas are required.');
  const doc=phone.ownerDocument,win=doc.defaultView;
  const createCanvas=environment.createCanvas||(()=>doc.createElement('canvas'));
  const verifyNativeBlur=environment.verifyNativeBlur||canvasBlurWorks;
  const computed=environment.getComputedStyle||(node=>win.getComputedStyle(node));
  const Resize=environment.ResizeObserver||win.ResizeObserver,Mutation=environment.MutationObserver||win.MutationObserver;
  let active=false,ready=false,key='',disposed=false,textures=new Map(),signature='',renders=0,error='',refreshing=false;
  const touched=new Map(),observed=new Set();
  const resize=Resize?new Resize(()=>refresh()):null;
  const mutation=Mutation?new Mutation(()=>refresh()):null;
  function restore(node,previous){for(const [index,property] of PROPERTIES.entries()){const value=previous.styles[index];if(value[0])node.style.setProperty(property,...value);else node.style.removeProperty(property);}if(previous.marker===null)node.removeAttribute('data-landing-glass');else node.setAttribute('data-landing-glass',previous.marker);}
  function clear(){for(const [node,previous] of touched)restore(node,previous);touched.clear();for(const node of observed)resize?.unobserve(node);observed.clear();}
  function invalidate(){clear();textures.clear();signature='';}
  function refresh(){
    if(disposed||refreshing||!active||!ready)return false;
    refreshing=true;
    try {
      const nodes=[...phone.querySelectorAll(LANDING_GLASS_TARGETS)].map(node=>({node,target:node.getBoundingClientRect()})).filter(({target})=>target.width&&target.height);
      const rect=sourceCanvas.getBoundingClientRect(),width=sourceCanvas.clientWidth,height=sourceCanvas.clientHeight;
      if(!nodes.length||!width||!height||!rect.width||!rect.height||!sourceCanvas.width||!sourceCanvas.height){invalidate();return false;}
      const ratio=Math.min(2,Math.max(1,win.devicePixelRatio||1));
      const nextSignature=JSON.stringify([key,sourceCanvas.width,sourceCanvas.height,width,height,ratio]);
      if(nextSignature!==signature){textures.clear();signature=nextSignature;}
      // A held frame can contain reading surfaces and ordinary controls together.
      // Cache each computed material once; DOM order must never choose its fill.
      const currentTextures=new Map();
      for(const surface of nodes){
        const style=computed(surface.node),isConversation=surface.node.matches('.onboarding-message,.onboarding-reading');
        const material=isConversation?(surface.node.matches('.is-user')?'own':'conversation'):'control';
        const blur=parseFloat(style.getPropertyValue('--kn-glass-blur'))||30;
        const sat=style.getPropertyValue('--kn-glass-saturation').trim()||'100%',saturation=(parseFloat(sat)||100)/(sat.endsWith('%')?100:1);
        const fillProperty=material==='own'?'--kn-glass-own-fill':material==='conversation'?'--kn-glass-conversation-fill':'--kn-glass-fill';
        const fill=style.getPropertyValue(fillProperty).trim()||(material==='own'?'rgba(232,241,252,.9)':material==='conversation'?'rgba(255,255,255,.9)':'rgba(255,255,255,.62)');
        const materialKey=JSON.stringify([material,blur,saturation,fill]);
        let texture=currentTextures.get(materialKey)||textures.get(materialKey);
        if(!texture){texture={...renderGlassTexture({sourceCanvas,width,height,ratio,blur,saturation,fill,createCanvas,verifyNativeBlur}),material,fill};renders++;}
        currentTextures.set(materialKey,texture);surface.texture=texture;
      }
      textures=currentTextures;
      const current=new Set(nodes.map(({node})=>node));
      for(const [node,previous] of touched)if(!current.has(node)){restore(node,previous);touched.delete(node);resize?.unobserve(node);observed.delete(node);}
      for(const {node,target,texture} of nodes){
        if(!touched.has(node))touched.set(node,{marker:node.getAttribute('data-landing-glass'),styles:PROPERTIES.map(property=>[node.style.getPropertyValue(property),node.style.getPropertyPriority(property)])});
        const position=glassPosition(rect,target,width,height);
        const values=[`url("${texture.url}")`,`${width}px ${height}px`,`${position.x}px ${position.y}px`,texture.fill];
        for(const [index,property] of PROPERTIES.entries())if(node.style.getPropertyValue(property)!==values[index])node.style.setProperty(property,values[index]);
        node.setAttribute('data-landing-glass','ready');
        if(!observed.has(node)){observed.add(node);resize?.observe(node);}
      }
      error='';return true;
    }catch(cause){error=String(cause?.message||cause);invalidate();return false;}
    finally{refreshing=false;}
  }
  resize?.observe(sourceCanvas);resize?.observe(phone);
  mutation?.observe(phone,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
  phone.addEventListener('scroll',refresh,true);win.addEventListener('resize',refresh);
  win.visualViewport?.addEventListener('resize',refresh);win.visualViewport?.addEventListener('scroll',refresh);
  doc.fonts?.addEventListener('loadingdone',refresh);
  return {
    update({active:enabled=false,ready:settled=false,key:cue=''}={}){if(disposed)return false;active=enabled;ready=settled;key=cue;if(!active||!ready){invalidate();return false;}return refresh();},
    getDiagnostics:()=>({active,ready,surfaces:touched.size,renders,method:[...new Set([...textures.values()].map(texture=>texture.method))].join(','),materials:[...textures.values()].map(({material,fill})=>({material,fill})),error}),
    dispose(){if(disposed)return;disposed=true;invalidate();resize?.disconnect();mutation?.disconnect();phone.removeEventListener('scroll',refresh,true);win.removeEventListener('resize',refresh);win.visualViewport?.removeEventListener('resize',refresh);win.visualViewport?.removeEventListener('scroll',refresh);doc.fonts?.removeEventListener('loadingdone',refresh);}
  };
}
