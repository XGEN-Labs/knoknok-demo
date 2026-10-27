// A gently travelling camera and two distant star planes give the painted
// nebula depth without moving the contact world or intercepting its gestures.
export function mountCosmosBackground(root,{reducedMotion=false,onFrame=()=>{}}={}){
  if(!root)return null;
  const image=root.querySelector('img'),canvas=root.querySelector('canvas');
  if(!image||!canvas)return null;
  const doc=root.ownerDocument,win=doc.defaultView;
  const context=canvas.getContext('2d',{alpha:false});
  if(!context){root.dataset.cosmosState='fallback';return {dispose(){},setReducedMotion(){}};}
  let disposed=false,ready=false,frame=null,last=0,elapsed=0,lastGlass=-1,width=0,height=0,ratio=1;
  let seed=55;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const stars=Array.from({length:44},()=>({x:random(),y:random(),depth:.35+random()*.65,radius:.25+random()*.55,alpha:.18+random()*.38,phase:random()*Math.PI*2}));
  function stop(){if(frame!==null)win.cancelAnimationFrame(frame);frame=null;last=0;}
  function paint(){
    if(!ready||disposed||!width||!height)return;
    const time=reducedMotion?0:elapsed/1000;
    context.setTransform(ratio,0,0,ratio,0,0);
    context.globalAlpha=1;context.globalCompositeOperation='source-over';
    const scale=Math.max(width/image.naturalWidth,height/image.naturalHeight)*(1.12+.012*Math.sin(time*.08));
    const iw=image.naturalWidth*scale,ih=image.naturalHeight*scale;
    const x=(width-iw)/2+width*.016*Math.sin(time*.17),y=(height-ih)/2+height*.012*Math.cos(time*.125);
    context.drawImage(image,x,y,iw,ih);
    // Fine points, no cartoon sparkle shapes or fast particles. Nearer points
    // travel slightly faster than the far texture, suggesting camera parallax.
    for(const star of stars){
      const sx=((star.x*width+time*star.depth*.8)%(width+12))-6;
      const sy=((star.y*height-time*star.depth*.28+height+12)%(height+12))-6;
      context.globalAlpha=star.alpha*(.88+.12*Math.sin(time*.5+star.phase));
      context.fillStyle='#fff9ed';context.beginPath();context.arc(sx,sy,star.radius,0,Math.PI*2);context.fill();
    }
    context.globalAlpha=1;
    canvas.dataset.cosmosTime=time.toFixed(2);
    root.dataset.cosmosMotion=reducedMotion?'still':'running';
    if(lastGlass<0||elapsed-lastGlass>=250){
      lastGlass=elapsed;canvas.dataset.cosmosFrame=String(Number(canvas.dataset.cosmosFrame||0)+1);
      onFrame();root.dispatchEvent(new win.Event('kn-cosmos-frame',{bubbles:true}));
    }
  }
  function tick(now){
    frame=null;if(disposed||doc.hidden||reducedMotion||!ready)return;
    if(!last)last=now;
    const delta=now-last;
    if(delta>=1000/30){elapsed+=Math.min(delta,100);last=now;paint();}
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
  if(image.complete){if(image.naturalWidth)loaded();else failed();}
  return {
    setReducedMotion(value){reducedMotion=!!value;stop();lastGlass=-1;paint();start();},
    dispose(){disposed=true;stop();observer.disconnect();image.removeEventListener('load',loaded);image.removeEventListener('error',failed);doc.removeEventListener('visibilitychange',visibility);}
  };
}
