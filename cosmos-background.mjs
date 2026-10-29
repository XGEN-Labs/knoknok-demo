// A gently travelling camera and two distant star planes give the painted
// nebula depth without moving the contact world or intercepting its gestures.
export function mountCosmosBackground(root,{reducedMotion=false,onFrame=()=>{}}={}){
  if(!root)return null;
  const image=root.querySelector('img'),canvas=root.querySelector('canvas');
  if(!image||!canvas)return null;
  const doc=root.ownerDocument,win=doc.defaultView;
  const context=canvas.getContext('2d',{alpha:false});
  if(!context){root.dataset.cosmosState='fallback';return {dispose(){},setReducedMotion(){}};}
  let disposed=false,ready=false,frame=null,last=0,elapsed=0,lastPaint=0,lastGlass=-1,width=0,height=0,ratio=1;
  let nearbyPlanet=null,planetAtlas=null,planetsReady=false,planetStatus='loading';
  const sceneRoot=root.parentElement;
  function worldLayout(event){
    const viewport=event.target.querySelector?.('.world-viewport');
    if(!viewport||!event.detail)return;
    const worldBox=viewport.getBoundingClientRect(),skyBox=root.getBoundingClientRect();
    const scale=worldBox.width/(viewport.clientWidth||worldBox.width);
    const skyScale=skyBox.width/(root.clientWidth||skyBox.width);
    nearbyPlanet={x:(worldBox.left-skyBox.left+event.detail.cx*scale)/skyScale,y:(worldBox.top-skyBox.top+event.detail.cy*scale)/skyScale,r:event.detail.radius*scale/skyScale};
    root.dataset.cosmosPlanetLinked='true';paint();
  }
  sceneRoot?.addEventListener('kn-world-layout',worldLayout);
  let seed=55;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const stars=Array.from({length:60},(_,index)=>{const near=index>=44;return {x:random(),y:random(),near,speed:near?1.15+random()*.55:.40+random()*.25,radius:near?.65+random()*.42:.28+random()*.32,alpha:near?.40+random()*.23:.22+random()*.24,phase:random()*Math.PI*2};});
  const wrap=(value,size)=>((value%size)+size)%size;
  function clearMeteorPath(path){
    if(!nearbyPlanet)return true;
    const {x,y,r}=nearbyPlanet,dx=path.x2-path.x1,dy=path.y2-path.y1;
    const t=Math.max(0,Math.min(1,((x-path.x1)*dx+(y-path.y1)*dy)/(dx*dx+dy*dy)));
    // Includes the tallest avatar/name marker above any point on the globe.
    return Math.hypot(path.x1+t*dx-x,path.y1+t*dy-y)>r+84;
  }
  function meteorAt(time){
    if(reducedMotion||time<2.5)return null;
    const cycle=Math.floor((time-2.5)/32),local=time-2.5-cycle*32,starts=[0,7.8,16.4,23.8];
    let slot=3;while(slot>0&&local<starts[slot])slot--;
    const index=cycle*4+slot,age=local-starts[slot],duration=1.35+(index%3)*.15;
    if(age<0||age>=duration)return null;
    const routes=[[.06,.16,.42,.205],[.55,.17,.96,.21],[.43,.16,.06,.21],[.03,.82,.34,.87]];
    const candidates=[routes[slot],[.05,.14,.32,.17],[.68,.14,.95,.17]];
    for(let candidate=0;candidate<candidates.length;candidate++){
      const [x1,y1,x2,y2]=candidates[candidate],path={x1:x1*width,y1:y1*height,x2:x2*width,y2:y2*height};
      if(clearMeteorPath(path))return {...path,index,progress:age/duration,lane:slot===3&&candidate===0?'lower':'upper'};
    }
    return null;
  }
  function drawMeteor(meteor){
    const {x1,y1,x2,y2,progress}=meteor,tail=Math.max(0,progress-.32),dx=x2-x1,dy=y2-y1;
    const tx=x1+dx*tail,ty=y1+dy*tail,hx=x1+dx*progress,hy=y1+dy*progress;
    const alpha=Math.pow(Math.sin(progress*Math.PI),.65)*.86;
    const streak=context.createLinearGradient(tx,ty,hx,hy);
    streak.addColorStop(0,'rgba(172,211,241,0)');streak.addColorStop(.65,'rgba(188,221,246,.32)');streak.addColorStop(1,'rgba(239,249,255,.95)');
    context.lineCap='round';context.strokeStyle=streak;context.globalAlpha=alpha*.16;context.lineWidth=4;
    context.beginPath();context.moveTo(tx,ty);context.lineTo(hx,hy);context.stroke();
    context.globalAlpha=alpha;context.lineWidth=1.15;context.stroke();
    context.globalAlpha=alpha*.16;context.fillStyle='#d9f1ff';context.beginPath();context.arc(hx,hy,3,0,Math.PI*2);context.fill();
    context.globalAlpha=alpha;context.beginPath();context.arc(hx,hy,1.05,0,Math.PI*2);context.fill();
  }
  function planetPositions(time){return [
    {x:width*.15+14*Math.sin(time*.095),y:height*.23+6*Math.sin(time*.07),size:32,alpha:.28},
    {x:width*.82+16*(Math.sin(time*.09+2.2)-Math.sin(2.2)),y:height*.16+7*Math.sin(time*.06),size:42,alpha:.22},
  ];}
  function atlasLoaded(){if(disposed)return;planetsReady=planetAtlas.naturalWidth>=2&&planetAtlas.naturalHeight>0;planetStatus=planetsReady?'ready':'unavailable';root.dataset.cosmosPlanetsLoaded=String(planetsReady);paint();}
  function atlasFailed(){if(disposed)return;planetsReady=false;planetStatus='unavailable';root.dataset.cosmosPlanetsLoaded='false';paint();}
  function stop(){if(frame!==null)win.cancelAnimationFrame(frame);frame=null;last=0;}
  function paint(){
    if(!ready||disposed||doc.hidden||!width||!height)return;
    const time=reducedMotion?0:elapsed/1000;
    context.setTransform(ratio,0,0,ratio,0,0);
    context.globalAlpha=1;context.globalCompositeOperation='source-over';
    const scale=Math.max(width/image.naturalWidth,height/image.naturalHeight)*(1.12+.012*Math.sin(time*.08));
    const iw=image.naturalWidth*scale,ih=image.naturalHeight*scale;
    const x=(width-iw)/2+width*.016*Math.sin(time*.17),y=(height-ih)/2+height*.012*Math.cos(time*.125);
    context.drawImage(image,x,y,iw,ih);
    // Deepen the blue space slightly, before stars, rim atmosphere and meteors
    // are composited so luminous details retain their local contrast.
    context.fillStyle='rgba(3,8,24,.16)';context.fillRect(0,0,width,height);
    const distantPlanets=planetPositions(time);
    if(planetsReady){
      const tile=planetAtlas.naturalWidth/2,tileHeight=planetAtlas.naturalHeight;
      distantPlanets.forEach((planet,index)=>{const h=planet.size*tileHeight/tile;context.globalAlpha=planet.alpha;context.drawImage(planetAtlas,index*tile,0,tile,tileHeight,planet.x-planet.size/2,planet.y-h/2,planet.size,h);});
      context.globalAlpha=1;
    }
    if(nearbyPlanet){
      const {x:px,y:py,r}=nearbyPlanet;
      // A broad, quiet pool of the same blue light that reaches the sphere's
      // right rim joins the near atmosphere to the distant star field.
      const haze=context.createRadialGradient(px-r*.12,py-r*.18,r*.72,px,py,r*1.62);
      haze.addColorStop(0,'rgba(141,238,226,.03)');haze.addColorStop(.26,'rgba(91,203,215,.14)');haze.addColorStop(1,'rgba(54,128,183,0)');
      context.fillStyle=haze;context.fillRect(px-r*1.7,py-r*1.7,r*3.4,r*3.4);
    }
    // Two quiet depth planes drift at different speeds: roughly 6 versus 18 px
    // in twelve seconds. Small nearby glows remain points, not starburst icons.
    for(const star of stars){
      const sx=wrap(star.x*width+time*star.speed,width+12)-6;
      const sy=wrap(star.y*height-time*(star.near?.38:.16)+height+12,height+12)-6;
      const alpha=star.alpha*(.88+.12*Math.sin(time*.55+star.phase));
      context.fillStyle=star.near?'#d7edff':'#f3f3ec';
      if(star.near){context.globalAlpha=alpha*.10;context.beginPath();context.arc(sx,sy,star.radius*2.8,0,Math.PI*2);context.fill();}
      context.globalAlpha=alpha;context.beginPath();context.arc(sx,sy,star.radius,0,Math.PI*2);context.fill();
    }
    const meteor=meteorAt(time);if(meteor)drawMeteor(meteor);
    root.dataset.cosmosPlanetsLoaded=String(planetsReady);root.dataset.cosmosMeteorActive=String(!!meteor);
    root.dataset.cosmosDepth=JSON.stringify({planet:{loaded:planetsReady,status:planetStatus,positions:distantPlanets.map(p=>({x:+p.x.toFixed(2),y:+p.y.toFixed(2),size:p.size}))},meteors:{active:!!meteor,index:meteor?.index??null,progress:meteor?+meteor.progress.toFixed(3):null,lane:meteor?.lane??null,path:meteor?{x1:meteor.x1,y1:meteor.y1,x2:meteor.x2,y2:meteor.y2}:null},stars:{far:44,near:16}});
    context.globalAlpha=1;
    canvas.dataset.cosmosTime=time.toFixed(2);
    root.dataset.cosmosMotion=reducedMotion?'still':'running';
    // The planet shares this 30 Hz scene clock. Glass sampling keeps its own
    // slower notification below; no second RAF is created for the fluid body.
    root.dispatchEvent(new win.CustomEvent('kn-cosmos-tick',{bubbles:true,detail:{time,reducedMotion}}));
    if(lastGlass<0||elapsed-lastGlass>=250){
      lastGlass=elapsed;canvas.dataset.cosmosFrame=String(Number(canvas.dataset.cosmosFrame||0)+1);
      onFrame();root.dispatchEvent(new win.Event('kn-cosmos-frame',{bubbles:true}));
    }
  }
  function tick(now){
    frame=null;if(disposed||doc.hidden||reducedMotion||!ready)return;
    if(!last)last=now;
    const delta=now-last;last=now;elapsed+=Math.min(delta,100);
    const interval=1000/30;
    if(elapsed-lastPaint>=interval-.01){lastPaint+=Math.floor((elapsed-lastPaint+.01)/interval)*interval;paint();}
    frame=win.requestAnimationFrame(tick);
  }
  function start(){if(!disposed&&ready&&!doc.hidden&&!reducedMotion&&frame===null)frame=win.requestAnimationFrame(tick);}
  function resize(){
    const box=root.getBoundingClientRect();width=root.clientWidth||box.width;height=root.clientHeight||box.height;
    if(!width||!height)return;
    ratio=Math.min(win.devicePixelRatio||1,1.5);
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    lastGlass=-1;paint();
  }
  function loaded(){
    if(disposed||!image.naturalWidth)return;
    ready=true;canvas.hidden=false;root.dataset.cosmosState='ready';resize();start();
  }
  function failed(){stop();ready=false;canvas.hidden=true;root.dataset.cosmosState='fallback';}
  function visibility(){if(doc.hidden){stop();root.dataset.cosmosMotion='paused';}else{paint();start();}}
  image.addEventListener('load',loaded);image.addEventListener('error',failed);
  doc.addEventListener('visibilitychange',visibility);
  const observer=new win.ResizeObserver(resize);observer.observe(root);
  if(typeof win.Image==='function'){
    planetAtlas=new win.Image();planetAtlas.decoding='async';planetAtlas.addEventListener('load',atlasLoaded);planetAtlas.addEventListener('error',atlasFailed);
    planetAtlas.src='assets/visit-fluid-20261029-80/distant-planets.png';
    if(planetAtlas.complete){if(planetAtlas.naturalWidth)atlasLoaded();else atlasFailed();}
  }else{planetStatus='unavailable';root.dataset.cosmosPlanetsLoaded='false';}
  if(image.complete){if(image.naturalWidth)loaded();else failed();}
  return {
    setReducedMotion(value){reducedMotion=!!value;stop();lastGlass=-1;paint();start();},
    dispose(){if(disposed)return;disposed=true;stop();observer.disconnect();planetAtlas?.removeEventListener('load',atlasLoaded);planetAtlas?.removeEventListener('error',atlasFailed);planetAtlas?.removeAttribute?.('src');image.removeEventListener('load',loaded);image.removeEventListener('error',failed);doc.removeEventListener('visibilitychange',visibility);sceneRoot?.removeEventListener('kn-world-layout',worldLayout);}
  };
}
