import { socialTagState, SOCIAL_TAG_CATEGORIES } from './social-tags.mjs?v=20261026-social-tags-45';
import { socialTagStickerMarkup } from './tag-stickers.mjs?v=20261030-spirit-notebook-8';
import { uiIcon } from './ui-icons.mjs?v=20261028-diary-paper-71b';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(text,action,id='',extra='')=>`<button type="button" class="tag-ui-button" data-action="${action}" data-id="${esc(id)}" ${extra}>${text}</button>`;
const stamp=item=>socialTagStickerMarkup(item);
const date=time=>new Date(time).toLocaleDateString('zh-HK',{month:'long',day:'numeric'});
const diaryMonth=time=>{const value=new Date(time);return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}`;};
// Current confirmed sources are authoritative after wording/meaning changes.
const linkedTags=(ledger,entry)=>ledger.items.filter(item=>item.sourceIds.includes(entry.id));
const sourceTag=(item,{history=false}={})=>`<button type="button" class="tag-sticker-open" data-action="tag-source" data-id="${esc(item.id)}" ${history?'data-history="true" ':''}aria-label="查看 ${esc(item.label)} 的故事">${stamp(item)}</button>`;
const tagSelection=(item,{history=false,diaryId=''}={})=>`<div class="tag-management-row">${sourceTag(item,{history})}${item.visible?button('已在名片','tag-already-visible',item.id,'disabled aria-disabled="true"'):button('貼回名片',history?'tag-history-restore':diaryId?'tag-diary-restore':'tag-restore',item.id,`${diaryId?`data-entry="${esc(diaryId)}" `:''}aria-label="把 ${esc(item.label)} 貼回名片"`)}</div>`;

export function tagManagementMarkup(space,user,{returnToEditor=false}={}){
 const ledger=socialTagState(space,user),shown=ledger.items.filter(t=>t.visible),hidden=ledger.items.filter(t=>!t.visible),pending=ledger.candidates.filter(t=>t.status==='pending');
 return `<div class="social-tags-panel">${returnToEditor?button('返回名片編輯','card-edit-return'):''}<p class="small-note">把最像你的幾枚放在前面。名片最多展示 7 枚。</p><div class="tag-management-list">${shown.map((item,i)=>`<div class="tag-management-row">${sourceTag(item)}<div class="tag-row-actions">${button('↑','tag-move',item.id,`data-direction="-1" aria-label="上移 ${esc(item.label)}" ${i===0?'disabled':''}`)}${button('↓','tag-move',item.id,`data-direction="1" aria-label="下移 ${esc(item.label)}" ${i===shown.length-1?'disabled':''}`)}${button('收起','tag-hide',item.id)}</div></div>`).join('')||'<p class="tag-empty">還沒有貼上標籤，和 Klin 聊聊喜歡的事吧。</p>'}</div>${pending.length?button(`有 ${pending.length} 枚新提案，和 Klin 看看`,'tag-open-chat'):''}${button('從記憶日記選標籤','tag-history')}<details class="tag-history" ${!shown.length?'open':''}><summary>收藏過的標籤 <span>${hidden.length}</span></summary>${hidden.map(item=>tagSelection(item)).join('')||'<p class="small-note">收起的標籤會留在這裡。</p>'}</details><div class="tag-panel-footer">${button('去聊聊','tag-open-chat')}${button('Nok 日記','tag-diary')}</div></div>`;
}

export function historyTagPickerMarkup(space,user){
 const ledger=socialTagState(space,user),seen=new Set();
 const entries=[...ledger.diary].reverse().map(entry=>{
  // The confirmed ledger is authoritative. Pending/declined proposals and
  // arbitrary diary topic strings never become restore actions here.
  const tags=linkedTags(ledger,entry).filter(item=>{if(seen.has(item.id))return false;seen.add(item.id);return true;});
  return {entry,tags};
 }).filter(({tags})=>tags.length);
 return `<div class="social-tags-panel tag-history-picker"><p class="small-note">從以前的小記，挑回你已確認過的標籤。當時的故事會一直留著。</p><div class="tag-diary-list">${entries.map(({entry,tags})=>`<section class="tag-history-entry"><button type="button" class="tag-history-story" data-action="tag-history-diary" data-id="${esc(entry.id)}" aria-label="閱讀 ${esc(date(entry.createdAt))} 的記憶日記"><time>${date(entry.createdAt)}</time><p>${esc(entry.text.slice(0,100))}</p><span>看看當時的故事 ↗</span></button><div class="tag-history-options">${tags.map(item=>tagSelection(item,{history:true})).join('')}</div></section>`).join('')||'<p class="tag-empty">日記裡還沒有已確認的標籤。新提案會先和你確認，再收進這裡。</p>'}</div><div class="tag-panel-footer">${button('返回展示標籤','tag-history-back')}</div></div>`;
}
export function tagChatMarkup(space,user,{editingId=''}={}){
 const ledger=socialTagState(space,user),pending=ledger.candidates.filter(t=>t.status==='pending'),editing=ledger.items.find(t=>t.id===editingId);
 if(editing)return `<section class="tag-chat-card"><p class="tag-chat-eyebrow">一起改改這枚標籤</p>${stamp(editing)}<form data-form="social-tag-edit" data-id="${esc(editing.id)}"><label for="social-tag-wording">你想怎麼說？</label><input class="input" id="social-tag-wording" name="label" maxlength="24" required value="${esc(editing.label)}"><label for="social-tag-mode">這次想改的是</label><select id="social-tag-mode" name="mode"><option value="refine">意思不變，換個說法</option><option value="correct">原來理解錯了，確認新含義</option><option value="replace">換成另一件事，確認新含義</option><option value="uncertain">還不確定，先聊聊</option></select><div class="tag-replace-choice" hidden><label for="social-tag-decision">原來這枚怎麼處理？</label><select id="social-tag-decision" name="decision"><option value="replace">替換成新標籤</option><option value="alongside">兩枚一起保留</option><option value="remove-old">只收起原來這枚</option></select></div><p class="small-note">只更新標籤。當時的日記和原話會保留。</p><button type="submit" class="tag-ui-button tag-confirm">確認修改</button>${button('先不改','tag-cancel-edit')}</form></section>`;
 return pending.map(candidate=>`<section class="tag-chat-card"><p class="tag-chat-eyebrow">這樣介紹你，好不好？</p><p class="small-note">${esc(SOCIAL_TAG_CATEGORIES.find(c=>c.id===candidate.category)?.label||'我的日常')} · 選你最喜歡的一種說法</p><div class="tag-candidate-options">${candidate.options.map((label,i)=>`<button type="button" class="tag-sticker-open" data-action="tag-confirm" data-id="${esc(candidate.id)}" data-option="${i}" aria-label="確認標籤 ${esc(label)}">${stamp({label,category:candidate.category})}</button>`).join('')}</div><details><summary>我想換個說法</summary><form data-form="social-tag-confirm" data-id="${esc(candidate.id)}"><input class="input" name="label" maxlength="24" required aria-label="新的標籤措辭" placeholder="用你的語氣，說同一件事"><button type="submit" class="tag-ui-button tag-confirm">就用這句</button></form></details><div class="tag-panel-footer">${button('都不太像我','tag-decline',candidate.id)}${button('看看這次的日記','tag-diary-entry',candidate.sourceIds[0])}</div></section>`).join('');
}
const diaryDay=time=>{const value=new Date(time);return `${diaryMonth(time)}-${String(value.getDate()).padStart(2,'0')}`;};
const validMonth=value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value)&&Number(value.slice(0,4))>=1900&&Number(value.slice(0,4))<=9998;
const monthOffset=(month,offset)=>{const [y,m]=month.split('-').map(Number);return diaryMonth(new Date(y,m-1+offset,1,12));};
/** Calendar state is derived without changing saved diary or original messages. */
export function diaryCalendarData(space,user,{month='',day='',now=Date.now()}={}){
 const ledger=socialTagState(space,user),today=diaryDay(now),selectedMonth=validMonth(month)?month:today.slice(0,7);
 const [year,monthNumber]=selectedMonth.split('-').map(Number),days=new Date(year,monthNumber,0).getDate(),leading=(new Date(year,monthNumber-1,1).getDay()+6)%7;
 const entries=[...ledger.diary].sort((a,b)=>b.createdAt-a.createdAt),byDay=new Map();
 for(const entry of entries){const key=diaryDay(entry.createdAt);if(!byDay.has(key))byDay.set(key,[]);byDay.get(key).push(entry);}
 const requested=String(day),validDay=requested.startsWith(`${selectedMonth}-`)&&/^\d{4}-\d{2}-\d{2}$/.test(requested)&&Number(requested.slice(-2))>=1&&Number(requested.slice(-2))<=days;
 const selectedDay=validDay?requested:today.startsWith(selectedMonth)?today:entries.map(entry=>diaryDay(entry.createdAt)).find(key=>key.startsWith(selectedMonth))||`${selectedMonth}-01`;
 const cells=Array.from({length:Math.ceil((leading+days)/7)*7},(_,i)=>{const number=i-leading+1;if(number<1||number>days)return null;const key=`${selectedMonth}-${String(number).padStart(2,'0')}`;return {day:key,number,count:byDay.get(key)?.length||0,today:key===today,selected:key===selectedDay};});
 return {month:selectedMonth,day:selectedDay,title:`${year} 年 ${monthNumber} 月`,previous:monthOffset(selectedMonth,-1),next:monthOffset(selectedMonth,1),canPrevious:selectedMonth!=='1900-01',canNext:selectedMonth!=='9998-12',cells,entries:byDay.get(selectedDay)||[]};
}
const nokName=value=>typeof value==='string'&&value.trim()?value.trim():'Klin';
const nokIntroduction=name=>`<section class="tag-nok-intro" aria-label="Nok 自述"><h4>Nok 自述</h4><p>我是 ${esc(name)}，和你結下契約的 Nok。</p><p>我有點慢熱，也總對小事好奇。喜歡慢慢認識一個人，習慣先聽你說完，再一起把零碎的心事理清。</p></section>`;
const readOnlyTags=(items,empty='還沒有確認的關聯標籤。')=>`<div class="tag-associated tag-diary-readonly" aria-label="已確認的關聯標籤">${items.map(stamp).join('')||`<p class="small-note">${empty}</p>`}</div>`;
const messageTime=value=>{
 const time=typeof value==='number'?value:typeof value==='string'&&value.trim()?Date.parse(value):NaN;
 return Number.isFinite(time)&&Number.isFinite(new Date(time).getTime())?time:null;
};
function diaryChatData(space,entry){
 const day=diaryDay(entry.createdAt),ids=new Set(entry.messageIds||[]);
 const records=(space.companionMessages||[]).filter(message=>message&&(message.role==='user'||message.role==='assistant'));
 const dated=records.map((message,index)=>({message,index,time:messageTime(message.createdAt)}))
  .filter(record=>record.time!==null&&diaryDay(record.time)===day)
  .sort((a,b)=>a.time-b.time||a.index-b.index).map(record=>record.message);
 const undated=records.filter(message=>ids.has(message.id)&&messageTime(message.createdAt)===null);
 return {dated,undated};
}
const originalMessages=(messages,name)=>messages.map(message=>{
 const time=messageTime(message.createdAt);
 return `<div class="${message.role==='user'?'own':''}"><small>${message.role==='user'?'我':esc(name)}${time!==null?` <time datetime="${new Date(time).toISOString()}">${new Date(time).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit',hour12:false})}</time>`:''}</small><p>${esc(message.text)}</p></div>`;
}).join('');

export function diaryListMarkup(space,user,options={}){
 const calendar=diaryCalendarData(space,user,options),ledger=socialTagState(space,user);
 const entryIds=new Set(calendar.entries.map(entry=>entry.id)),dayTags=ledger.items.filter(item=>item.sourceIds.some(id=>entryIds.has(id)));
 const quote=calendar.entries.find(entry=>typeof entry.quote==='string'&&entry.quote.trim())?.quote;
 const selectedLabel=`${calendar.day.slice(0,4)} 年 ${Number(calendar.day.slice(5,7))} 月 ${Number(calendar.day.slice(8))} 日`;
 return `<div class="social-tags-panel tag-diary-browser tag-diary-summary" data-diary-month="${calendar.month}" data-diary-day="${calendar.day}">${nokIntroduction(nokName(options.companionName))}<time class="tag-diary-date" datetime="${calendar.day}">${selectedLabel}</time><section class="tag-diary-section tag-diary-quote"><h4>Quote</h4>${quote?`<blockquote>${esc(quote)}</blockquote>`:'<p class="small-note">這一天還沒有保存的 Quote。</p>'}</section><section class="tag-diary-section tag-day-associations"><h4>關聯社交標籤</h4>${readOnlyTags(dayTags,'這一天還沒有已確認的關聯標籤。')}</section>${button('查看聊天記錄','tag-diary-records')}</div>`;
}
export function diaryRecordsMarkup(space,user,options={}){
 const calendar=diaryCalendarData(space,user,options),ledger=socialTagState(space,user),selectedLabel=`${Number(calendar.day.slice(5,7))} 月 ${Number(calendar.day.slice(8))} 日`;
 const heading=`<nav class="tag-calendar-heading" aria-label="日記月份"><button type="button" class="tag-calendar-nav" data-action="tag-diary-month" data-month="${calendar.previous}" ${calendar.canPrevious?'':'disabled'} aria-label="上一個月">${uiIcon('back')}</button><h4>${calendar.title}</h4><button type="button" class="tag-calendar-nav is-next" data-action="tag-diary-month" data-month="${calendar.next}" ${calendar.canNext?'':'disabled'} aria-label="下一個月">${uiIcon('back')}</button></nav>`;
 const cells=calendar.cells.map(cell=>cell?`<button type="button" class="tag-calendar-day${cell.count?' has-entry':''}" data-action="tag-diary-day" data-day="${cell.day}" aria-pressed="${cell.selected}" ${cell.today?'aria-current="date" ':''}aria-label="${cell.day.replaceAll('-',' / ')}，${cell.count?`${cell.count} 篇日記`:'沒有日記'}"><span>${cell.number}</span>${cell.count?'<i aria-hidden="true"></i>':''}</button>`:'<span class="tag-calendar-blank" aria-hidden="true"></span>').join('');
 const entries=calendar.entries.map(entry=>{
  const count=linkedTags(ledger,entry).length;
  return `<button type="button" data-action="tag-diary-entry" data-id="${esc(entry.id)}"><time datetime="${new Date(entry.createdAt).toISOString()}">${new Date(entry.createdAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit',hour12:false})}</time><p>${esc(String(entry.text||'').slice(0,100))}</p><span>${count?`${count} 枚關聯標籤`:'翻開聊天摘記'}<span aria-hidden="true"> ↗</span></span></button>`;
 }).join('')||'<p class="tag-empty">這一天還沒有小記。</p>';
 return `<div class="social-tags-panel tag-diary-browser tag-diary-records" data-diary-month="${calendar.month}" data-diary-day="${calendar.day}">${heading}<div class="tag-calendar-weekdays" aria-hidden="true">${['一','二','三','四','五','六','日'].map(label=>`<span>${label}</span>`).join('')}</div><div class="tag-diary-calendar" role="group" aria-label="${calendar.title}日記日曆">${cells}</div><section class="tag-diary-day-list" aria-label="${selectedLabel}的小記"><h4>${selectedLabel}<span>${calendar.entries.length?`${calendar.entries.length} 篇小記`:''}</span></h4><div class="tag-diary-list">${entries}</div></section></div>`;
}
export function diaryEntryMarkup(space,user,id,{tab='diary',selectTags=false,companionName='Klin'}={}){
 const ledger=socialTagState(space,user),entry=ledger.diary.find(e=>e.id===id);if(!entry)return '<p>這篇日記暫時找不到。</p>';
 const name=nokName(companionName),linked=linkedTags(ledger,entry),messages=diaryChatData(space,entry),chatActive=tab==='chat',key=encodeURIComponent(entry.id);
 const tabItems=[{key:'diary',label:'日記',action:selectTags?'tag-history-diary':'tag-diary-entry'},{key:'chat',label:'原始聊天',action:selectTags?'tag-history-chat':'tag-diary-chat'}];
 const tabs=`<nav class="tag-diary-tabs" role="tablist" aria-label="日記與原始聊天">${tabItems.map(item=>`<button type="button" class="tag-ui-button" role="tab" id="diary-tab-${item.key}-${key}" aria-controls="diary-panel-${item.key}-${key}" aria-selected="${(item.key==='chat')===chatActive}" data-action="${item.action}" data-id="${esc(entry.id)}">${item.label}</button>`).join('')}</nav>`;
 const tags=selectTags?`<div class="tag-associated">${linked.map(item=>tagSelection(item,{history:true})).join('')||'<span class="small-note">還沒有確認的關聯標籤。</span>'}</div>`:readOnlyTags(linked);
 const diary=`<div class="tag-diary-panel" role="tabpanel" id="diary-panel-diary-${key}" aria-labelledby="diary-tab-diary-${key}" ${chatActive?'hidden':''}>${nokIntroduction(name)}<section class="tag-diary-section"><h4>這天的聊天摘記</h4><p class="tag-diary-body">${esc(entry.text)}</p></section><section class="tag-diary-section tag-diary-quote"><h4>Quote</h4>${entry.quote?`<blockquote>${esc(entry.quote)}</blockquote>`:'<p class="small-note">這天還沒有留下金句。</p>'}</section><section class="tag-diary-section"><h4>關聯社交標籤</h4>${tags}</section></div>`;
 const undated=messages.undated.length?`<section class="tag-undated-chat"><h4>未記錄時間的原話</h4><p class="small-note">這些原話曾收在這篇小記裡，但沒有留下日期。</p><div class="tag-original-chat">${originalMessages(messages.undated,name)}</div></section>`:'';
 const chat=`<div class="tag-diary-panel tag-chat-records" role="tabpanel" id="diary-panel-chat-${key}" aria-labelledby="diary-tab-chat-${key}" ${chatActive?'':'hidden'}><h4>這一天的原始聊天</h4><div class="tag-original-chat">${originalMessages(messages.dated,name)||'<p class="small-note">這一天沒有保存聊天記錄。</p>'}</div>${undated}</div>`;
 return `<article class="social-tags-panel tag-diary-detail"><time class="tag-diary-date" datetime="${new Date(entry.createdAt).toISOString()}">${new Date(entry.createdAt).toLocaleDateString('zh-HK',{year:'numeric',month:'long',day:'numeric'})}</time>${tabs}${diary}${chat}<p class="tag-diary-privacy">僅自己可見 · 原始記錄只讀</p>${button(selectTags?'返回歷史標籤':'回到聊天記錄',selectTags?'tag-history':'tag-diary-records')}</article>`;
}
