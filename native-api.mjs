// Fixed knok-auth same-origin contract; native credentials and bound identity
// selection stay on the server. Session.request adds Cookie/owner consistency.
export function createNativeApi(session){
 const get=path=>session.request(path),post=(path,body)=>session.request(path,{method:'POST',body}),patch=(path,body)=>session.request(path,{method:'PATCH',body});
 const group=id=>'/api/web/groups/'+encodeURIComponent(id);
 return {
  memoryCapabilities:()=>get('/api/web/memories/capabilities'),
  memoryList:body=>post('/api/web/memories/list',body),memoryGet:body=>post('/api/web/memories/get',body),
  memoryCorrect:body=>post('/api/web/memories/correct',body),memoryForget:body=>post('/api/web/memories/forget',body),
  profile:()=>get('/api/web/profile'),updateProfile:body=>patch('/api/web/profile',body),
  nickname:()=>get('/api/web/agent/nickname'),updateNickname:body=>patch('/api/web/agent/nickname',body),
  rooms:()=>get('/api/web/rooms'),group:id=>get(group(id)),
  groupEvents:(id,cursor)=>get(group(id)+'/events?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):'')),
  groupPost:(id,body)=>post(group(id)+'/post',body),
 };
}
export function projectGroupEvents(events){
 const messages=new Map(),deleted=new Set();let unknownRedaction=false;
 for(const event of events){
  if(typeof event?.id!=='string'||!Number.isSafeInteger(event.seq))throw Error('房間記錄格式無效。');
  if(event.type==='message.redacted'){if(event.scrubbed)unknownRedaction=true;else if(typeof event.messageId==='string')deleted.add(event.messageId);else throw Error('房間撤回記錄格式無效。');}
  if(event.type==='message.posted'){
   if(event.scrubbed){messages.set(event.id,{id:event.id,seq:event.seq,text:'這則訊息已清除。',status:'scrubbed'});continue;}
   if(typeof event.message?.id!=='string'||typeof event.message.text!=='string')throw Error('房間訊息格式無效。');
   messages.set(event.id,{id:event.id,seq:event.seq,messageId:event.message.id,text:event.message.text,status:event.message.status,origin:event.message.origin,at:event.at});
  }
 }
 for(const message of messages.values())if(unknownRedaction||deleted.has(message.messageId)){message.text='這則訊息已清除或撤回。';message.status='redacted';}
 return [...messages.values()].sort((a,b)=>a.seq-b.seq);
}
export async function readGroupHistory(api,id,active=()=>true){
 let cursor=null;const events=[];
 for(let page=0;page<205;page++){
  const result=await api.groupEvents(id,cursor);if(!active())return null;
  if(!Array.isArray(result?.events)||typeof result.cursor!=='string'||!result.cursor)throw Error('房間歷史回覆無效。');
  events.push(...result.events);
  if(result.cursor===cursor)return projectGroupEvents(events);
  cursor=result.cursor;
 }
 throw Error('房間記錄超出本次讀取範圍，尚未顯示內容。');
}
