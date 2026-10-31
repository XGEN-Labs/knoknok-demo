import {TOPIC_SKILLS} from './topic-journey-v92.mjs?v=20261031-noking-v06e';
import {nokingActionMarkup} from './noking-action.mjs?v=20261031-noking-v06e';
import {loadingIndicatorMarkup} from './loading-state.mjs';
import {cardMarkup,publicCardData,DEFAULT_CARD_AVATAR} from './public-card.mjs';
import {friendAvatarSource} from './friend-avatars.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function topicMessages(messages,journey,archive=[]){const ids=new Set();return [...messages,...archive,...(journey?.messages||[])].filter(m=>{if(ids.has(m.id))return false;ids.add(m.id);return true;});}
export function topicControlsMarkup(journey,{busy=false,error='',ready=true}={}){
 if(!ready)return '';
 const active=journey?.status==='active';
 if(active){const controls=`${error?`<p role="alert">${esc(error)}</p>`:''}${journey.pending&&!busy?'<button data-action="topic-retry" type="button">重試</button>':''}${!busy&&!journey.pending&&journey.messages.some(m=>m.role==='user')?'<button data-action="topic-finish" type="button">先聊到這裡</button>':''}`;return controls?`<div class="topic-controls">${controls}</div>`:'';}
 return `<div class="topic-shortcuts" aria-label="想聊的主題">${TOPIC_SKILLS.map(topic=>`<button type="button" data-action="topic-start" data-topic-id="${topic.id}">${esc(topic.label)}</button>`).join('')}</div>`;
}
export function topicNokingMarkup(profile,{busy=false,noking=null,reducedMotion=false}={}){if(busy&&noking)return nokingActionMarkup(profile,noking,{reducedMotion});return busy?`<div class="topic-noking" role="status" aria-live="polite">${loadingIndicatorMarkup(`${profile?.name||'Nok'} 正在想一想…`)}</div>`:'';}
export function candidateCardMarkup(person,{reason=''}={}){
 if(!person)return '';
 const data=publicCardData(person,{tags:person.cardTags||[],avatar:friendAvatarSource({id:person.id},person)||DEFAULT_CARD_AVATAR});
 return `<article class="topic-recommendation"><p>${esc(reason||'也許你們可以聊聊')}</p>${cardMarkup(data,{compact:true})}<button type="button" class="kn-glass-control" data-action="visit-enter-space" data-id="${esc(person.id)}">進入公共空間</button></article>`;
}
export function visitRequestsMarkup(requests,users){
 const states={sent:{label:'已發送',detail:'先前送出的串門申請'},matched:{label:'已匹配',detail:'曾經互相回應的串門申請'},rejected:{label:'已拒絕',detail:'這次申請沒有約成'}};
 const records=Array.isArray(requests)?[...requests].sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0)):[];
 const rows=records.map(record=>{
  const person=users?.[record.candidateId],status=states[record.status]||{label:'狀態待確認',detail:'這筆記錄尚未提供狀態。'};
  return `<article class="visit-request-row" role="listitem"><img src="${esc(friendAvatarSource({id:record.candidateId},person)||DEFAULT_CARD_AVATAR)}" alt=""><div class="visit-request-copy"><div class="visit-request-identity"><strong>${esc(person?.name||'新朋友')}</strong><span class="visit-request-status">${status.label}</span></div><p>${status.detail}</p></div>${record.status==='matched'?`<button type="button" class="tag-ui-button visit-request-enter" data-action="visit-enter-space" data-id="${esc(record.candidateId)}">串門</button>`:''}</article>`;
 }).join('');
 return `<section class="visit-request-panel" aria-label="串門記錄">${rows?`<div class="visit-request-list" role="list">${rows}</div>`:'<p class="visit-request-empty">還沒有串門記錄。</p>'}</section>`;
}
