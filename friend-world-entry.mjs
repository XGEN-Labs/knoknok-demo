// Paint the existing loading markup before allocating/compiling the globe.
// Two animation frames yield one real browser paint; there is no timed hold.
export function mountFriendWorldAfterPaint(root,options,mount,scheduler={}) {
  if(!root)return null;
  const win=root.ownerDocument.defaultView;
  const request=scheduler.requestFrame||win.requestAnimationFrame.bind(win);
  const cancel=scheduler.cancelFrame||win.cancelAnimationFrame.bind(win);
  let frame=null,world=null,disposed=false,query,settled=false,resolve,failure=null;
  const state=status=>({status,visible:status==='loading',pending:status==='loading'?['first-paint']:[],errors:status==='fallback'?['renderer']:[]});
  const ready=new Promise(done=>{resolve=done;});
  const finish=value=>{if(!settled){settled=true;resolve(value);}};
  function fallback(){
    root.dataset.worldState='fallback';root.dataset.worldRenderer='fallback';root.setAttribute('aria-busy','false');
    const loader=root.querySelector('.world-loading');if(loader)loader.hidden=true;
    const value=state('fallback');failure=value;options?.onStateChange?.(value);finish(value);
  }
  function dispose(){
    if(disposed)return;disposed=true;if(frame!==null)cancel(frame);frame=null;
    world?.dispose();finish(state('disposed'));
  }
  function start(){
    frame=null;if(disposed)return;if(root.isConnected===false){dispose();return;}
    try{
      world=mount(root,options);if(!world){fallback();return;}
      if(query!==undefined)world.setQuery(query);
      Promise.resolve(world.ready).then(finish,()=>{if(!disposed)fallback();});
    }catch{fallback();}
  }
  frame=request(()=>{frame=null;if(!disposed)frame=request(start);});
  return {ready,getState:()=>disposed?state('disposed'):failure||world?.getState()||state('loading'),setQuery(value){query=value;if(!disposed)world?.setQuery(value);},dispose};
}
