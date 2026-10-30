import {readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join,extname} from 'node:path';
import {createServer} from 'node:http';
import {once} from 'node:events';
// Local protocol fixtures only. All identities, replies and native DTOs are synthetic.
export async function liveBrowserFixture(webRoot,{landingCreation=false}={}){
 const manifest=JSON.parse(await readFile(join(webRoot,'build-manifest.json'),'utf8')),allowed=new Set(manifest.files.map(f=>f.path)),calls=[],status=new Map([[101,'required'],[202,'not_required'],[303,'completed']]),histories=new Map();
 const controls={failHandoff:false,failCompletion:false,creationBound:false,creation:null};
 const json=(res,code,value)=>{res.writeHead(code,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
 const session=id=>({user:{id,username:`test${id}`},onboarding:{status:status.get(id)||'required'}});
 const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost'),id=Number(req.headers.cookie?.match(/livefixture=(\d+)/)?.[1]);
  if(!url.pathname.startsWith('/api/')){
   const name=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));if(!allowed.has(name)){res.writeHead(404);return res.end();}
   const file=join(webRoot,name),size=(await stat(file)).size,mime={'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4','.m4a':'audio/mp4','.woff2':'font/woff2'};
   const headers={'content-type':mime[extname(file)]||'application/octet-stream','cache-control':'no-store','accept-ranges':'bytes'},range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
   let start=0,end=size-1;if(range){start=Number(range[1]);end=range[2]?Math.min(Number(range[2]),end):end;if(start>end){res.writeHead(416);return res.end();}headers['content-range']=`bytes ${start}-${end}/${size}`;}
   headers['content-length']=end-start+1;res.writeHead(range?206:200,headers);const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);return;
  }
  let body={};if(req.method!=='GET'){const parts=[];for await(const part of req)parts.push(part);body=JSON.parse(Buffer.concat(parts).toString()||'{}');}
  calls.push({path:url.pathname,body,id,owner:req.headers['x-knok-user-id']});
  if(url.pathname==='/api/auth/entry')return json(res,200,{username:body.username,nextAction:body.username==='test101'?'register':'login',passwordMode:'set_password'});
  if(['/api/auth/sign-in','/api/auth/register'].includes(url.pathname)){
   const uid=Number(body.username.replace('test',''));if(![101,202,303].includes(uid)||body.password!=='fixture-only')return json(res,401,{code:'invalid_credentials'});
   res.setHeader('set-cookie',`livefixture=${uid}; HttpOnly; Path=/; SameSite=Lax`);return json(res,200,{user:session(uid).user,nextAction:'bootstrap'});
  }
  if(url.pathname==='/api/auth/logout'){res.setHeader('set-cookie','livefixture=; Path=/; Max-Age=0');return json(res,200,{ok:true});}
  if(!id)return json(res,401,{error:'unauthenticated'});
  if(url.pathname==='/api/auth/bootstrap'){
   const newer=landingCreation&&id===101,bound=!newer||controls.creationBound;
   return json(res,200,{...session(id),accountStatus:'registered',nextAction:bound?'open_chat':'setup_agent',agent:bound?{status:'bound',agentId:`agent-${id}`,roomId:`room-${id}`}:{status:'setup_required',initialization:{state:'pending'}},memory:{status:'not_loaded'},...(newer?{landingCreation:controls.creation||{flow:'landing-v1',state:'awaiting_input'}}:{})});
  }
  if(req.headers['x-knok-user-id']!==String(id))return json(res,409,{error:'SESSION_CHANGED',code:'SESSION_CHANGED'});
  if(url.pathname==='/api/auth/agent-initialization/landing'){
   if(!landingCreation||id!==101)return json(res,409,{error:'legacy_account'});
   if(!controls.creation)controls.creation={flow:'landing-v1',state:'submitted',...body,selection:{ruleVersion:'rongyu-day-master-v1',dayMaster:'甲木',element:'wood',familyId:'wood',personaSpecId:'nok-wood-1',personaVersion:'8.0.0'}};
   return json(res,200,{landingCreation:controls.creation,initialization:{state:'pending'}});
  }
  if(url.pathname==='/api/auth/onboarding/complete'){if(controls.failCompletion)return json(res,503,{error:'completion_unavailable'});status.set(id,'completed');return json(res,200,{onboarding:{status:'completed'}});}
  if(url.pathname==='/api/web/chat/history')return json(res,200,{user:session(id).user,items:histories.get(id)||[],order:'asc',hasMore:false,nextCursor:null,resumeCursor:'fixture-cursor'});
  if(url.pathname==='/api/web/chat'){
   const text=body.messages.at(-1).content,handoff=text.startsWith('這是一段首次見面');if(handoff&&controls.failHandoff)return json(res,503,{error:'unavailable'});
   const history=histories.get(id)||[];let seq=history.length;
   for(const [role,content]of [['user',text],['assistant',handoff?'已收到資料':`真實協議回覆 ${id}`]])history.push({kind:'message',eventId:`event-${id}-${++seq}`,seq,at:'2026-10-28T00:00:00Z',messageId:`message-${id}-${seq}`,role,content,status:'complete'});
   histories.set(id,history);return json(res,200,{text:handoff?'已收到資料':`真實協議回覆 ${id}`,source:'model',provider:'knok-agent'});
  }
  return json(res,404,{error:'missing'});
 }catch(error){json(res,500,{error:error.message});}});
 server.listen(0,'127.0.0.1');await once(server,'listening');return{url:`http://127.0.0.1:${server.address().port}`,calls,controls,status,histories,close:async()=>{const done=new Promise(r=>server.close(r));server.closeAllConnections();await done;}};
}
