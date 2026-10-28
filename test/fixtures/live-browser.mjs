import {readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join,extname} from 'node:path';
import {createServer} from 'node:http';
import {once} from 'node:events';
// Local protocol fixtures only. All identities, replies and native DTOs are synthetic.
export async function liveBrowserFixture(webRoot){
 const manifest=JSON.parse(await readFile(join(webRoot,'build-manifest.json'),'utf8')),allowed=new Set(manifest.files.map(f=>f.path)),calls=[],status=new Map([[101,'required'],[202,'not_required'],[303,'completed']]),histories=new Map();
 const controls={failHandoff:false,failCompletion:false},memories=new Map(),profiles=new Map(),nicknames=new Map(),groupEvents=new Map();
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
  if(url.pathname==='/api/auth/bootstrap')return json(res,200,{...session(id),accountStatus:'registered',nextAction:'open_chat',agent:{status:'bound',agentId:`agent-${id}`,roomId:`room-${id}`},memory:{status:'not_loaded'}});
  if(req.headers['x-knok-user-id']!==String(id))return json(res,409,{error:'SESSION_CHANGED',code:'SESSION_CHANGED'});
  const memory=()=>{if(!memories.has(id))memories.set(id,{record:{id:'memory-'+id,text:'記憶內容 '+id},version:1});return memories.get(id);};
  if(url.pathname==='/api/web/memories/capabilities')return json(res,200,{available:true,features:{list:true,get:true,correct:true,forget:true}});
  if(url.pathname==='/api/web/memories/list')return json(res,200,{revision:1,items:memory()?[memory()]:[],nextCursor:null});
  if(url.pathname==='/api/web/memories/get')return json(res,200,memory()?.record.id===body.id?memory():null);
  if(url.pathname==='/api/web/memories/correct'){
   const item=memory(),source=(histories.get(id)||[]).find(m=>m.eventId===body.sourceEventId&&m.seq===body.sourceSeq&&m.role==='user');
   if(!source||body.text!==source.content||item?.record.id!==body.id||item.version!==body.expectedVersion)return json(res,409,{code:'KNOK_MEMORY_CONFLICT'});
   memories.set(id,{record:{...item.record,text:body.text},version:item.version+1});return json(res,200,{revision:2,changed:1});
  }
  if(url.pathname==='/api/web/memories/forget'){if(!body.ids.includes(memory()?.record.id))return json(res,400,{code:'invalid'});memories.set(id,null);return json(res,200,{revision:3,changed:1});}
  if(url.pathname==='/api/web/profile'){
   if(!profiles.has(id))profiles.set(id,{agentId:'agent-'+id,fields:{preferredName:{value:'原稱呼'+id,visibility:'private'},homeCity:{value:'香港',visibility:'private'}}});const profile=profiles.get(id);
   if(req.method==='PATCH')Object.assign(profile.fields,body);return json(res,200,profile);
  }
  if(url.pathname==='/api/web/agent/nickname'){
   if(!nicknames.has(id))nicknames.set(id,{agentId:'agent-'+id,agentNickname:'原伙伴'+id,revision:1});const nick=nicknames.get(id);
   if(req.method==='PATCH'){if(body.expectedRevision!==nick.revision)return json(res,409,{code:'revision_conflict'});nick.agentNickname=body.agentNickname;nick.revision++;}return json(res,200,nick);
  }
  if(url.pathname==='/api/web/rooms')return json(res,200,{rooms:[{roomId:'shared-'+id,kind:'group'}]});
  if(url.pathname.startsWith('/api/web/groups/')){
   const parts=url.pathname.split('/'),roomId=parts[4];if(roomId!=='shared-'+id)return json(res,403,{code:'forbidden'});
   const events=groupEvents.get(id)||[];
   if(parts[5]==='events')return json(res,200,{events:url.searchParams.get('cursor')===String(events.length+1)?[]:events,cursor:String(events.length+1)});
   if(parts[5]==='post'){const seq=events.length+1,event={id:'group-event-'+seq,seq,at:'2026-10-28T00:00:00Z',type:'message.posted',message:{id:'group-message-'+seq,text:body.text,origin:'human',status:'complete'}};events.push(event);groupEvents.set(id,events);return json(res,200,{eventId:event.id,messageId:event.message.id,seq,deduplicated:false});}
   return json(res,200,{roomId,version:1,lastSeq:events.length});
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
 server.listen(0,'127.0.0.1');await once(server,'listening');return{url:`http://127.0.0.1:${server.address().port}`,calls,controls,status,histories,memories,profiles,nicknames,groupEvents,close:async()=>{const done=new Promise(r=>server.close(r));server.closeAllConnections();await done;}};
}
