import {readGroupHistory} from './native-api.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,action,attributes='')=>`<button type="button" class="btn ghost" data-action="native-${action}" ${attributes}>${label}</button>`;
const textField=(name,label,value,max=200)=>`<div class="field"><label>${label}<input class="input" name="${name}" value="${esc(value)}" maxlength="${max}" required></label></div>`;
const errorText=error=>error?.message||'讀取未完成，請稍後重試。';
// All methods are supplied by the authenticated BFF adapter. This view never owns
// credentials or browser-persisted copies of native records.
export function createNativePanels({api,owner,showSheet,history,refreshHistory,onProfile=()=>{}}){
 let serial=0,currentOwner=null,active=null,capabilities=null,memoryItems=[],memoryCursor=null,profile=null,nickname=null;
 const pending=new Map();
 function reset(){serial++;active=null;currentOwner=null;capabilities=null;memoryItems=[];memoryCursor=null;profile=null;nickname=null;pending.clear();}
 function paint(ticket,html){if(!valid(ticket))return;showSheet(ticket.title,`<div data-native-panel="${ticket.id}">${html}</div>`);}
 function valid(ticket){return active===ticket&&ticket.owner===owner()&&!!document.querySelector(`[data-native-panel="${ticket.id}"]`)?.closest('dialog')?.open;}
 function begin(title){if(currentOwner!==owner()){reset();currentOwner=owner();}const ticket={id:++serial,owner:owner(),title};active=ticket;showSheet(title,`<div data-native-panel="${ticket.id}" role="status">正在讀取…</div>`);return ticket;}
 function fail(ticket,error,retry){paint(ticket,`<p role="alert">${esc(errorText(error))}</p>${retry?button('重新讀取',retry):''}`);}
 function requestId(kind,body){const key=JSON.stringify([currentOwner,kind,body]);if(!pending.has(key))pending.set(key,crypto.randomUUID());return {key,id:pending.get(key)};}
 async function mutate(ticket,kind,body,write,done){
  if(!valid(ticket)||ticket.busy)return;ticket.busy=true;
  const operation=requestId(kind,body);document.querySelector(`[data-native-panel="${ticket.id}"]`)?.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{const result=await write({...body,requestId:operation.id});if(!valid(ticket))return;pending.delete(operation.key);await done(result);}
  catch(error){if(valid(ticket))paint(ticket,`<p role="alert">${esc(errorText(error))} 尚未確認變更，請先重新讀取。</p>${button('重新讀取','memory')}`);}
  finally{ticket.busy=false;}
 }
 function memoryList(){return `${memoryItems.length?memoryItems.map(({record})=>`<article class="field"><p>${esc(record.text)}</p>${button('查看','memory-detail',`data-id="${esc(record.id)}"`)}</article>`).join(''):'<p>目前沒有可讀取的記憶。</p>'}${memoryCursor?button('讀取更多','memory-more'):''}${button('重新讀取','memory')}`;}
 async function memories(more=false){
  const ticket=begin('伙伴的記憶');
  try{
   if(!more){capabilities=await api.memoryCapabilities();if(!valid(ticket))return;memoryItems=[];memoryCursor=null;}
   if(!capabilities?.available||!capabilities.features?.list){paint(ticket,'<p>記憶服務目前尚未開放。</p>');return;}
   const page=await api.memoryList(memoryCursor?{cursor:memoryCursor}:{});if(!valid(ticket))return;
   if(!Array.isArray(page?.items)||!(page.nextCursor===null||typeof page.nextCursor==='string'))throw Error('記憶回覆格式無效。');
   for(const item of page.items){if(typeof item?.record?.id!=='string'||typeof item.record.text!=='string'||!Number.isSafeInteger(item.version))throw Error('記憶內容格式無效。');}
   const items=new Map((more?memoryItems:[]).map(item=>[item.record.id,item]));for(const item of page.items)items.set(item.record.id,item);
   memoryItems=[...items.values()];memoryCursor=page.nextCursor;paint(ticket,memoryList());
  }catch(error){fail(ticket,error,'memory');}
 }
 async function memoryDetail(id){
  const ticket=begin('這段記憶');
  try{
   const item=await api.memoryGet({id});if(!valid(ticket))return;
   if(!item){paint(ticket,`<p>這段記憶已不存在或不可讀取。</p>${button('返回記憶','memory')}`);return;}
   if(item.record?.id!==id||typeof item.record?.text!=='string'||!Number.isSafeInteger(item.version))throw Error('記憶內容格式無效。');
   ticket.item=item;
   paint(ticket,`<p>${esc(item.record.text)}</p>${capabilities?.features?.correct?button('用我說過的話修正','memory-correct'):''}${capabilities?.features?.forget?button('遺忘這段記憶','memory-forget'):''}${button('返回記憶','memory')}`);
  }catch(error){fail(ticket,error,'memory');}
 }
 async function correction(){
  const ticket=active;if(!valid(ticket)||!ticket.item)return;
  await refreshHistory();if(!valid(ticket))return;
  const view=history();if(!view.historyReady||view.error){fail(ticket,Error(view.error||'聊天記錄尚未讀取，暫時無法選擇修正依據。'),'memory');return;}
  ticket.sources=view.messages.filter(m=>m.role==='user'&&m.status==='complete'&&Number.isSafeInteger(m.seq)&&m.source==='model').slice(-100).reverse();
  if(!ticket.sources.length){paint(ticket,`<p>請先在聊天中告訴伙伴正確的內容，再回來選擇那句話。</p>${button('返回記憶','memory')}`);return;}
  paint(ticket,`<p>選擇你已說過的話，作為這段記憶的正確內容。</p><form data-form="native-correct"><div class="field"><label for="native-source">對話內容</label><select class="input" name="source" id="native-source">${ticket.sources.map((m,i)=>`<option value="${i}">${esc(m.text)}</option>`).join('')}</select></div><button type="submit" class="btn">確認修正</button></form>${button('返回記憶','memory')}`);
 }
 function forget(){const ticket=active;if(!valid(ticket)||!ticket.item)return;paint(ticket,`<p>確定讓伙伴遺忘下面這段記憶？此操作會永久移除這筆記憶。</p><blockquote>${esc(ticket.item.record.text)}</blockquote>${button('確認遺忘','memory-forget-confirm')}${button('取消','memory')}`);}
 async function account(){
  const ticket=begin('我的資料');
  const [p,n]=await Promise.allSettled([api.profile(),api.nickname()]);if(!valid(ticket))return;
  profile=p.status==='fulfilled'?p.value:null;nickname=n.status==='fulfilled'?n.value:null;
  if(profile&&!profile.fields){fail(ticket,Error('資料回覆格式無效。'),'profile');return;}
  if(nickname&&(!Number.isSafeInteger(nickname.revision)||!(nickname.agentNickname===null||typeof nickname.agentNickname==='string'))){fail(ticket,Error('伙伴稱呼回覆格式無效。'),'profile');return;}
  if(profile||nickname)onProfile(profile,nickname);
  const labels={preferredName:'你的稱呼',timezone:'時區',homeCity:'居住城市'};
  const fields=profile?Object.entries(labels).map(([key,label])=>`<article class="field"><strong>${label}</strong><p>${esc(profile.fields[key]?.value||'尚未填寫')}</p>${button('修改','profile-edit',`data-key="${key}"`)}</article>`).join(''):`<p role="alert">${esc(errorText(p.reason))}</p>`;
  paint(ticket,`${fields}${profile?.fields?.boundaries?`<p>相處界線：${esc(profile.fields.boundaries.value.join('；'))}</p>`:''}${nickname?`<article class="field"><strong>伙伴的稱呼</strong><p>${esc(nickname.agentNickname||'尚未設定')}</p>${button('修改','nickname-edit')}</article>`:`<p role="alert">${esc(errorText(n.reason))}</p>`}${button('重新讀取','profile')}`);
 }
 function editProfile(key){
  const ticket=active;if(!valid(ticket)||!profile||!['preferredName','timezone','homeCity'].includes(key))return;
  const labels={preferredName:'你的稱呼',timezone:'時區',homeCity:'居住城市'},limits={preferredName:32,timezone:128,homeCity:64};ticket.field=key;
  paint(ticket,`<form data-form="native-profile">${textField('value',labels[key],profile.fields[key]?.value||'',limits[key])}<button type="submit" class="btn">儲存</button></form>${button('取消','profile')}`);
 }
 function editNickname(){const ticket=active;if(!valid(ticket)||!nickname)return;paint(ticket,`<form data-form="native-nickname">${textField('value','伙伴的稱呼',nickname.agentNickname||'',32)}<button type="submit" class="btn">儲存</button></form>${button('取消','profile')}`);}
 async function rooms(){
  const ticket=begin('串門');try{const result=await api.rooms();if(!valid(ticket))return;if(!Array.isArray(result.rooms))throw Error('房間回覆格式無效。');ticket.rooms=result.rooms;
   const groups=result.rooms.filter(r=>r.kind==='group');paint(ticket,groups.length?groups.map((room,i)=>`<article class="field"><p>共享房間 ${i+1}</p>${button('進入房間','room',`data-id="${esc(room.roomId)}"`)}</article>`).join(''):'<p>目前沒有已加入的共享房間。</p>');
  }catch(error){fail(ticket,error,'rooms');}
 }
 async function room(id){
  const ticket=begin('共享房間');ticket.roomId=id;
  try{
   const detail=await api.group(id);if(!valid(ticket))return;if(detail?.roomId!==id)throw Error('房間身份不符。');
   const messages=await readGroupHistory(api,id,()=>valid(ticket));if(!messages||!valid(ticket))return;
   paint(ticket,`<div role="log" aria-label="共享房間聊天">${messages.length?messages.map(m=>`<article class="field"><small>${m.origin==='human'?'成員':'伙伴'}${m.at?' · '+esc(new Date(m.at).toLocaleString()):''}</small><p>${esc(m.text)}</p>${m.status==='interrupted'?'<small>這段回覆未完成。</small>':''}</article>`).join(''):'<p>還沒有可顯示的聊天。</p>'}</div><form data-form="native-group"><div class="field"><label>和房間裡的伙伴說話<textarea class="input" name="message" maxlength="1000" required></textarea></label></div><button type="submit" class="btn">發送</button></form>${button('重新讀取','room',`data-id="${esc(id)}"`)}${button('返回房間列表','rooms')}`);
  }catch(error){fail(ticket,error,'rooms');}
 }
 async function submit(form){
  const ticket=active;if(!valid(ticket)||ticket.busy)return;const fields=new FormData(form);
  if(form.dataset.form==='native-correct'){
   const source=ticket.sources?.[Number(fields.get('source'))];if(!source||!ticket.item)return;
   const body={id:ticket.item.record.id,expectedVersion:ticket.item.version,text:source.text,sourceSeq:source.seq,sourceEventId:source.id};
   return mutate(ticket,'correct',body,api.memoryCorrect,async()=>{await memoryDetail(body.id);});
  }
  if(form.dataset.form==='native-group'){
   const text=String(fields.get('message')||'').trim();if(!text||!ticket.roomId)return;ticket.busy=true;form.querySelector('button').disabled=true;
   const operation=requestId('group-post',{roomId:ticket.roomId,text});
   try{const result=await api.groupPost(ticket.roomId,{clientMsgId:operation.id,text});if(!valid(ticket))return;if(typeof result?.eventId!=='string'||typeof result.messageId!=='string')throw Error('傳送結果尚未確認。');pending.delete(operation.key);await room(ticket.roomId);}
   catch(error){paint(ticket,`<p role="alert">${esc(errorText(error))} 請先讀取房間記錄確認傳送結果。</p>${button('讀取房間記錄','room',`data-id="${esc(ticket.roomId)}"`)}`);}finally{ticket.busy=false;}return;
  }
  if(['native-profile','native-nickname'].includes(form.dataset.form)){
   const value=String(fields.get('value')||'').trim();if(!value)return;ticket.busy=true;form.querySelector('button').disabled=true;
   try{if(form.dataset.form==='native-nickname')await api.updateNickname({agentNickname:value,expectedRevision:nickname.revision});else{const key=ticket.field;if(!key)return;await api.updateProfile({[key]:{value,visibility:profile.fields[key]?.visibility||'private'}});}if(valid(ticket))await account();}
   catch(error){fail(ticket,error,'profile');}finally{ticket.busy=false;}
  }
 }
 async function action(name,element){
  if(name==='memory')return memories();if(name==='memory-more')return memories(true);if(name==='memory-detail')return memoryDetail(element.dataset.id);
  if(name==='memory-correct')return correction();if(name==='memory-forget')return forget();
  if(name==='memory-forget-confirm'){const ticket=active;if(!valid(ticket)||!ticket.item)return;return mutate(ticket,'forget',{ids:[ticket.item.record.id],mode:'purge'},api.memoryForget,async()=>{await memories();});}
  if(name==='profile')return account();if(name==='profile-edit')return editProfile(element.dataset.key);if(name==='nickname-edit')return editNickname();if(name==='rooms')return rooms();if(name==='room')return room(element.dataset.id);
 }
 return {memories,profile:account,rooms,action,submit,reset};
}
