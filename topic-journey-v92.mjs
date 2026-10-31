// Client-side event consumer, not a matching or tag-generation algorithm.
// Production requires an explicitly supplied provider. Demo scenarios are opt-in.
import { ensureSocialTags, syncSocialTags, SOCIAL_TAG_CATEGORIES } from './social-tags.mjs?v=20261026-social-tags-45';

export const TOPIC_SKILLS=Object.freeze([
 Object.freeze({id:'daily-fortune',label:'今日運勢'}),
 Object.freeze({id:'relationships',label:'人際關係'}),
 Object.freeze({id:'future-growth',label:'未來發展'}),
]);
export const DEMO_TOPIC_SCENARIOS=Object.freeze(['reply-only','journal-no-match','journal-with-match']);
const clone=value=>JSON.parse(JSON.stringify(value));
const clean=value=>typeof value==='string'?value.trim():'';
const validId=value=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=256&&!/[\u0000-\u001f]/.test(value);
const requireValue=(condition,message)=>{if(!condition)throw new Error(message);};
const time=value=>Number.isFinite(value)?value:Date.now();
const family=new Set(SOCIAL_TAG_CATEGORIES.map(item=>item.id));
const eventTypes=new Set(['reply','tag.upsert','diary.upsert','match.recommendation','skill.completed']);
const candidateIds=values=>new Set((Array.isArray(values)?values:[]).map(value=>typeof value==='string'?value:value?.id).filter(validId));
function assertOwner(journey,{ownerId,sessionId}={}) {
 requireValue(journey?.version===1&&journey.ownerId===ownerId&&journey.sessionId===sessionId,'這次主題不屬於目前帳號或會話，請重新開啟。');
}

export function createTopicJourney({ownerId,sessionId,topicId,now=Date.now()}={}) {
 requireValue(validId(ownerId)&&validId(sessionId)&&sessionId.length<=120,'無法確認這次主題的帳號與會話。');
 requireValue(TOPIC_SKILLS.some(topic=>topic.id===topicId),'找不到這個主題。');
 return {version:1,ownerId,sessionId,topicId,status:'active',createdAt:time(now),updatedAt:time(now),nextRequest:1,pending:null,messages:[],events:[],processedEventIds:[],recommendations:[]};
}

/** Store returned journey before invoking adapter.run(request). Apply its result
 * to the latest stored journey, not this older request snapshot. */
export function prepareTopicRequest(journey,{ownerId,sessionId,input,now=Date.now()}={}) {
 assertOwner(journey,{ownerId,sessionId});
 requireValue(journey.status==='active','這次主題已結束，請重新開啟。');
 requireValue(!journey.pending,'正在等候 Nok 回覆。');
 const type=input?.type;requireValue(['start','reply','finish'].includes(type),'無法識別這個主題操作。');
 const next=clone(journey),at=time(now),id=`${sessionId}:${next.nextRequest++}`;
 if(type==='start')requireValue(next.messages.length===0,'這次主題已經開始。');
 if(type==='reply'){
  const value=clean(input.text);requireValue(value&&Array.from(value).length<=1000,'先寫下一點想聊的內容，並保持在 1000 字內。');
  requireValue(next.messages.some(message=>message.role==='assistant'),'請先等 Nok 開啟這次主題。');
  next.messages.push({id:`topic-user:${id}`,role:'user',text:value,createdAt:at});
 }
 if(type==='finish')requireValue(next.messages.some(message=>message.role==='user'),'先回覆 Nok，再請它整理這次對話。');
 const request={id,ownerId,sessionId,topicId:next.topicId,input:{type,...(type==='reply'?{text:clean(input.text)}:{})},messages:clone(next.messages),createdAt:at};
 next.pending=clone(request);next.updatedAt=at;
 return {journey:next,request};
}

export function retryTopicRequest(journey,{ownerId,sessionId}={}) {
 assertOwner(journey,{ownerId,sessionId});requireValue(journey.status==='active'&&journey.pending,'沒有等待重試的主題請求。');
 return clone(journey.pending);
}

function validEvent(event,journey) {
 requireValue(event&&validId(event.id)&&event.ownerId===journey.ownerId&&event.sessionId===journey.sessionId,'Nok 回應的帳號或會話不一致，這次結果沒有套用。');
 requireValue(eventTypes.has(event.type),'Nok 回傳了尚未支援的主題事件。');
 const payload=event.payload||{};
 if(event.type==='reply')requireValue(clean(payload.text),'Nok 還沒有傳回可用的回覆。');
 if(event.type==='tag.upsert'){
  requireValue(validId(payload.id)&&clean(payload.label)&&Array.from(clean(payload.label)).length<=24&&family.has(payload.category),'Nok 回傳的標籤資料不完整。');
  requireValue(payload.basis==='user-selected-topic'&&payload.topicId===journey.topicId,'這枚標籤不是你選擇的主題興趣，這次沒有套用。');
  requireValue(Array.isArray(payload.diaryIds)&&payload.diaryIds.every(validId),'標籤的日記來源資料不完整。');
 }
 if(event.type==='diary.upsert')requireValue(validId(payload.id)&&clean(payload.summary)&&typeof payload.quote==='string','Nok 回傳的日記資料不完整。');
 if(event.type==='match.recommendation')requireValue(validId(payload.candidateId),'Nok 回傳的朋友資料不完整。');
 return {...clone(event),payload:clone(payload)};
}

export function applyTopicAgentEvents(journey,events,{ownerId,sessionId,requestId,eligibleFriends=[],now=Date.now()}={}) {
 assertOwner(journey,{ownerId,sessionId});requireValue(Array.isArray(events)&&events.length>0,'Nok 暫時沒有傳回結果，請重試。');
 const validated=events.map(event=>validEvent(event,journey));
 const processed=new Set(journey.processedEventIds||[]);
 if(validated.every(event=>processed.has(event.id)))return clone(journey);
 requireValue(journey.status==='active'&&journey.pending?.id===requestId,'這個主題請求已取消或過期，結果沒有套用。');
 const next=clone(journey),eligible=candidateIds(eligibleFriends),at=time(now);
 for(const event of validated){
  if(processed.has(event.id))continue;
  if(event.type==='skill.completed')requireValue(next.messages.some(message=>message.role==='user'),'Nok 尚未收到你的回覆，不能完成這次主題。');
  if(event.type==='match.recommendation')requireValue(eligible.has(event.payload.candidateId),'這位朋友目前不在可申請名單中。');
  next.events.push(event);processed.add(event.id);
  if(event.type==='reply')next.messages.push({id:`topic-agent:${event.id}`,role:'assistant',text:clean(event.payload.text),createdAt:at,source:event.source||'agent'});
  if(event.type==='match.recommendation'){
   const recommendation={candidateId:event.payload.candidateId,reason:clean(event.payload.reason),eventId:event.id,source:event.source||'agent'};
   const index=next.recommendations.findIndex(item=>item.candidateId===recommendation.candidateId);
   if(index<0)next.recommendations.push(recommendation);else next.recommendations[index]=recommendation;
  }
  if(event.type==='skill.completed'){next.status='completed';next.completedAt=at;}
 }
 next.processedEventIds=[...processed];next.pending=null;next.updatedAt=at;
 return next;
}

export function cancelTopicJourney(journey,{ownerId,sessionId,now=Date.now()}={}) {
 assertOwner(journey,{ownerId,sessionId});if(journey.status!=='active')return clone(journey);
 return {...clone(journey),status:'cancelled',pending:null,updatedAt:time(now)};
}

const recordId=(kind,ownerId,id)=>`agent-${kind}:${encodeURIComponent(ownerId)}:${encodeURIComponent(id)}`;
/** Only completed adapter effects are persisted. Existing tags and diary entries
 * remain intact; empty/no-match responses cannot create them. */
export function commitTopicResult(space,user,journey,{ownerId,sessionId,now=Date.now()}={}) {
 assertOwner(journey,{ownerId,sessionId});requireValue(user?.id===ownerId,'目前使用者與主題結果不一致。');
 requireValue(journey.status==='completed','Nok 還沒有確認完成這次主題。');
 requireValue(!space.topicJourney||(space.topicJourney.ownerId===ownerId&&space.topicJourney.sessionId===sessionId&&space.topicJourney.status!=='cancelled'),'私人主題已取消或切換會話，這次結果沒有保存。');
 const at=time(now),draft=clone(space),profile=clone(user),ledger=ensureSocialTags(draft,profile);
 const receipts=new Set(Array.isArray(draft.topicEventReceipts)?draft.topicEventReceipts:[]);
 const unseen=journey.events.filter(event=>!receipts.has(`${ownerId}/${sessionId}/${event.id}`));
 const diaryEvents=unseen.filter(event=>event.type==='diary.upsert'),tagEvents=unseen.filter(event=>event.type==='tag.upsert');
 for(const event of diaryEvents){
  const payload=event.payload,id=recordId('diary',ownerId,payload.id),old=ledger.diary.find(item=>item.id===id);
  const entry={...(old||{}),id,createdAt:old?.createdAt??at,updatedAt:at,summary:clean(payload.summary),quote:payload.quote,text:journey.messages.filter(message=>message.role==='user').map(message=>message.text).join('\n'),messageIds:journey.messages.map(message=>message.id),memoryIds:old?.memoryIds||[],tagIds:old?.tagIds||[],topics:old?.topics||[],allowPublic:tagEvents.some(tag=>tag.payload.diaryIds.includes(payload.id)&&tag.payload.public===true),origin:'agent-topic',source:event.source||'agent',agentSourceId:payload.id};
  if(old)Object.assign(old,entry);else ledger.diary.push(entry);
 }
 for(const event of tagEvents){
  const payload=event.payload,id=recordId('tag',ownerId,payload.id),old=ledger.items.find(item=>item.id===id);
  const sourceIds=payload.diaryIds.map(value=>recordId('diary',ownerId,value));
  requireValue(sourceIds.every(value=>ledger.diary.some(entry=>entry.id===value)),'這枚標籤的日記來源尚未收到，沒有保存部分結果。');
  const visible=old?old.visible:payload.public===true&&ledger.items.filter(item=>item.visible).length<7;
  const item={...(old||{}),id,topic:`agent-topic:${journey.topicId}`,category:payload.category,label:clean(payload.label),visible,sourceIds:[...new Set([...(old?.sourceIds||[]),...sourceIds])],history:[...(old?.history||[]),{kind:'agent-topic',label:clean(payload.label),...(old&&old.label!==clean(payload.label)?{previous:old.label}:{}),at}],createdAt:old?.createdAt??at,updatedAt:at,origin:'agent-topic',source:event.source||'agent',agentSourceId:payload.id};
  if(old)Object.assign(old,item);else ledger.items.push(item);
 }
 if(diaryEvents.length){
  draft.companionMessages=Array.isArray(draft.companionMessages)?draft.companionMessages:[];
  const ids=new Set(draft.companionMessages.map(message=>message.id));
  for(const message of journey.messages)if(!ids.has(message.id)){draft.companionMessages.push(clone(message));ids.add(message.id);}
 }
 for(const event of unseen)receipts.add(`${ownerId}/${sessionId}/${event.id}`);
 draft.topicEventReceipts=[...receipts];draft.topicJourney=clone(journey);syncSocialTags(draft,profile);
 Object.assign(space,draft);Object.assign(user,profile);
 return {diaryIds:diaryEvents.map(event=>recordId('diary',ownerId,event.payload.id)),tagIds:tagEvents.map(event=>recordId('tag',ownerId,event.payload.id)),recommendations:clone(journey.recommendations),appliedEvents:unseen.length};
}

const demoCopy={
 'daily-fortune':{question:'今天最想留意哪件事？可以從你在意的一個小重點說起。',advice:'先照顧今天最在意的一件事，替自己留一個能做到的小步驟。這是整理日常的建議，不是對未來的保證。',tag:'關心日常節奏'},
 relationships:{question:'最近想聊哪一段相處，或哪一種感受？說你願意分享的部分就好。',advice:'先分清自己的感受和希望，再選一個舒服的時機表達。對方怎麼回應，可以慢慢觀察，不急著替關係下結論。',tag:'喜歡聊相處'},
 'future-growth':{question:'最近想往哪個方向前進？先選一個你想試試看的小目標。',advice:'把目標縮成這週可以試一次的行動，做完再回看哪些適合自己。方向可以調整，不需要一次決定全部。',tag:'探索成長方向'},
};

export function createTopicAdapter({mode='production',provider,scenario='reply-only',demoCandidateId=''}={}) {
 if(mode==='production'){
  requireValue(provider&&typeof provider.run==='function','這個主題的 Agent 服務尚未配置，暫時無法使用。');
  return Object.freeze({mode:'production',run:(request,options)=>provider.run(clone(request),options)});
 }
 requireValue(mode==='demo'&&DEMO_TOPIC_SCENARIOS.includes(scenario),'無法使用這個主題示範配置。');
 if(scenario==='journal-with-match')requireValue(validId(demoCandidateId),'示範推薦需要明確指定示例朋友。');
 return Object.freeze({mode:'demo',scenario,label:'本地示範情境，非實際 Agent 結果',async run(request,{onSkillEvent}={}){
  // Explicit local fixture; this is not a claimed production Skill invocation.
  onSkillEvent?.({requestId:request.id,executionId:`demo-noking:${request.id}`,skill:'noking',status:'running'});
  const copy=demoCopy[request.topicId];requireValue(copy,'找不到這個主題示範。');
  const event=(suffix,type,payload={})=>({id:`${request.id}:${suffix}`,ownerId:request.ownerId,sessionId:request.sessionId,type,payload,source:'demo-scenario'});
  if(request.input.type==='start')return [event('reply','reply',{text:copy.question})];
  if(request.input.type==='reply')return [event('reply','reply',{text:copy.advice})];
  requireValue(request.input.type==='finish','無法識別這個示範操作。');
  const last=request.messages.filter(message=>message.role==='user').at(-1);requireValue(last,'先回覆 Nok，再整理這次對話。');
  const events=[];
  if(scenario!=='reply-only'){
   const diaryId=`${request.sessionId}-diary`,topic=TOPIC_SKILLS.find(item=>item.id===request.topicId);
   events.push(event('diary','diary.upsert',{id:diaryId,summary:`今天聊到「${topic.label}」。你提到：「${last.text}」我們一起把想法整理成可以慢慢嘗試的小步驟。`,quote:last.text}));
   events.push(event('tag','tag.upsert',{id:`interest-${request.topicId}`,label:copy.tag,category:'daily',basis:'user-selected-topic',topicId:request.topicId,public:true,diaryIds:[diaryId]}));
  }
  if(scenario==='journal-with-match')events.push(event('candidate','match.recommendation',{candidateId:demoCandidateId,reason:'這是示範 Agent 回傳的一位示例朋友，並非前端計算的匹配。'}));
  events.push(event('complete','skill.completed'));return events;
 }});
}

export function requestTopicVisit(state,{ownerId,requestId,candidateId,eligibleFriends=[],now=Date.now()}={}) {
 requireValue(validId(ownerId)&&validId(requestId)&&validId(candidateId),'串門申請資料不完整。');
 requireValue(candidateIds(eligibleFriends).has(candidateId),'這位朋友目前不能申請串門。');
 const next=state?clone(state):{version:1,ownerId,requests:[]};
 requireValue(next.version===1&&next.ownerId===ownerId&&Array.isArray(next.requests),'串門申請不屬於目前帳號。');
 const existing=next.requests.find(item=>item.id===requestId);
 if(existing){requireValue(existing.candidateId===candidateId,'這個申請編號已用於另一位朋友。');return next;}
 next.requests.push({id:requestId,ownerId,candidateId,status:'sent',createdAt:time(now),updatedAt:time(now)});return next;
}

export function resolveDemoTopicVisit(state,{ownerId,requestId,decision,mode,explicitControl=false,now=Date.now()}={}) {
 requireValue(mode==='demo'&&explicitControl===true,'只有明確的示範控制可以模擬對方回應，申請不會自動接受。');
 requireValue(state?.version===1&&state.ownerId===ownerId,'串門申請不屬於目前帳號。');
 requireValue(['accept','reject'].includes(decision),'請明確選擇接受或拒絕。');
 const next=clone(state),request=next.requests.find(item=>item.id===requestId);requireValue(request,'找不到這次串門申請。');
 const status=decision==='accept'?'matched':'rejected';
 if(request.status===status)return next;
 requireValue(request.status==='sent','這次申請已有結果。');
 request.status=status;request.updatedAt=time(now);request.source='explicit-demo-control';return next;
}
