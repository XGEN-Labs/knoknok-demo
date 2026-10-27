import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {join,extname} from 'node:path';
// Local BFF/model protocol fixture only; no production accounts or Memory claims.
export async function landingBrowserFixture(webRoot){
 const manifest=JSON.parse(await readFile(join(webRoot,'build-manifest.json'),'utf8'));
 const allowed=new Set(manifest.files.map(f=>f.path));const calls=[],accepted=[];const controls={failHandoff:true,failCompletion:false};
 const onboarding=new Map([[101,'required'],[202,'not_required']]);
 const session=id=>({user:{id,username:`test${id}`},...(onboarding.has(id)?{onboarding:{status:onboarding.get(id)}}:{})});
 const json=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
 const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost'),id=Number(req.headers.cookie?.match(/fixture=(\d+)/)?.[1]);
  if(url.pathname==='/api/auth/me')return json(res,id?200:401,id?session(id):{error:'unauthenticated'});
  if(url.pathname==='/api/auth/logout'){res.setHeader('set-cookie','fixture=; Path=/; Max-Age=0');return json(res,200,{ok:true});}
  if(req.method==='POST'){
   const parts=[];for await(const p of req)parts.push(p);const body=JSON.parse(Buffer.concat(parts));
   if(url.pathname==='/api/auth/login'){const n=Number(body.username.replace('test',''));if(![101,202,303].includes(n)||body.password!=='fixture-only')return json(res,401,{error:'invalid'});res.setHeader('set-cookie',`fixture=${n}; HttpOnly; Path=/; SameSite=Lax`);return json(res,200,session(n));}
   if(url.pathname==='/api/auth/onboarding/complete'){
    if(!id)return json(res,401,{error:'unauthenticated'});
    if(req.headers['x-knok-user-id']!==String(id))return json(res,409,{code:'SESSION_CHANGED',error:'changed'});
    if(controls.failCompletion)return json(res,503,{error:'completion unavailable'});
    if(onboarding.get(id)==='required')onboarding.set(id,'completed');
    return json(res,200,{onboarding:{status:onboarding.get(id)||'not_required'}});
   }
   if(url.pathname==='/api/web/chat'){
    if(!id)return json(res,401,{error:'unauthenticated'});if(req.headers['x-knok-user-id']!==String(id))return json(res,409,{code:'SESSION_CHANGED',error:'changed'});
    const prompt=body.messages.at(-1).content,isHandoff=prompt.startsWith('這是一段首次見面');calls.push({owner:id,isHandoff,body});
    if(isHandoff&&controls.failHandoff)return json(res,503,{error:'fixture unavailable'});
    if(isHandoff)accepted.push({owner:id,prompt});return json(res,200,{provider:'knok-agent',source:'model',text:isHandoff?'HIDDEN_HANDOFF_ACK':`正常回覆 ${id}`});
   }
  }
  const file=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));if(!allowed.has(file)){res.writeHead(404);return res.end();}
  const mime={'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4','.m4a':'audio/mp4','.woff2':'font/woff2'};
  res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(await readFile(join(webRoot,file)));
 }catch{json(res,500,{error:'fixture error'});}});
 server.listen(0,'127.0.0.1');await once(server,'listening');return{url:`http://127.0.0.1:${server.address().port}`,calls,accepted,controls,onboarding,manifest,close:async()=>{const done=new Promise(r=>server.close(r));server.closeAllConnections();await done;}};
}
