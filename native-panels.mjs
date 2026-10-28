import {readGroupHistory} from './native-api.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,action,attributes='')=>`<button type="button" class="btn ghost" data-action="native-${action}" ${attributes}>${label}</button>`;
const textField=(name,label,value,max=200)=>`<div class="field"><label>${label}<input class="input" name="${name}" value="${esc(value)}" maxlength="${max}" required></label></div>`;
const errorText=error=>error?.message||'讀取未完成，請稍後重試。';
// All methods are supplied by the authenticated BFF adapter. This view never owns
// credentials or browser-persisted copies of native records.
export function createNativePanels({api,owner,showSheet,onProfile=()=>{}}){
 let serial=0,currentOwner=null,active=null,profile=null,nickname=null;
 const pending=new Map();
 function reset(){serial++;active=null;currentOwner=null;profile=null;nickname=null;pending.clear();}
 function paint(ticket,html){if(!valid(ticket))return;showSheet(ticket.title,`<div data-native-panel="${ticket.id}">${html}</div>`);}
 function valid(ticket){return active===ticket&&ticket.owner===owner()&&!!document.querySelector(`[data-native-panel="${ticket.id}"]`)?.closest('dialog')?.open;}
 function begin(title){if(currentOwner!==owner()){reset();currentOwner=owner();}const ticket={id:++serial,owner:owner(),title};active=ticket;showSheet(title,`<div data-native-panel="${ticket.id}" role="status">正在讀取…</div>`);return ticket;}
 function fail(ticket,error,retry){paint(ticket,`<p role="alert">${esc(errorText(error))}</p>${retry?button('重新讀取',retry):''}`);}
 function requestId(kind,body){const key=JSON.stringify([currentOwner,kind,body]);if(!pending.has(key))pending.set(key,crypto.randomUUID());return {key,id:pending.get(key)};}
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
  if(name==='profile')return account();if(name==='profile-edit')return editProfile(element.dataset.key);if(name==='nickname-edit')return editNickname();if(name==='rooms')return rooms();if(name==='room')return room(element.dataset.id);
 }
 return {profile:account,rooms,action,submit,reset};
}
