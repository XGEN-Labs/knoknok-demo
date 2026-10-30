// Read-only presentation: saved summaries/quotes are never synthesized from chat.
import { socialTagState } from './social-tags.mjs?v=20261026-social-tags-45';
import { diaryCalendarData } from './social-tags-ui.mjs?v=20261030-spirit-notebook-8';
import { uiIcon } from './ui-icons.mjs?v=20261030-handdrawn-motion-92c';
import { socialTagStickerMarkup } from './tag-stickers.mjs?v=20261030-spirit-notebook-8';
import { families } from './studio-family-data.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const text=value=>typeof value==='string'?value.trim():'';
const timestamp=value=>typeof value==='number'?value:typeof value==='string'&&value.trim()?Date.parse(value):NaN;
const keyFor=value=>{const date=new Date(timestamp(value));return Number.isFinite(date.getTime())?`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`:'';};
const unique=values=>[...new Set(values.filter(Boolean))];
const validDay=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const [y,m,d]=value.split('-').map(Number),date=new Date(y,m-1,d,12);return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d;};
const dayLabel=day=>`${day.slice(0,4)} 年 ${Number(day.slice(5,7))} 月 ${Number(day.slice(8))} 日`;
const safeAvatar=value=>typeof value==='string'&&(/^assets\/[a-zA-Z0-9_./#-]+$/.test(value)&&!value.split('/').includes('..'))?value:'';

function savedMessages(space) {
 const seen=new Set();
 return [...(space.companionMessages||[]),...(space.topicMessages||[])].filter(message=>{
  if(!message||!['user','assistant'].includes(message.role)||message.id&&seen.has(message.id))return false;
  if(message.id)seen.add(message.id);return true;
 });
}

export function notebookDayData(space={},user={}, {now=Date.now(),day=''}={}) {
 const today=keyFor(now)||keyFor(Date.now()),selected=validDay(day)?day:today;
 const ledger=socialTagState(space,user);
 const entries=ledger.diary.filter(entry=>entry&&typeof entry.id==='string'&&keyFor(entry.createdAt)===selected).sort((a,b)=>timestamp(a.createdAt)-timestamp(b.createdAt));
 const ids=new Set(entries.map(entry=>entry.id));
 const sourceMessageIds=new Set(entries.flatMap(entry=>Array.isArray(entry.messageIds)?entry.messageIds:[]));
 const records=savedMessages(space);
 return {day:selected,today,isToday:selected===today,entries,
  summaries:unique(entries.map(entry=>text(entry.summary))),
  quotes:unique(entries.map(entry=>text(entry.quote))),
  tags:ledger.items.filter(item=>Array.isArray(item.sourceIds)&&item.sourceIds.some(id=>ids.has(id))),
  messages:records.filter(message=>keyFor(message.createdAt)===selected).sort((a,b)=>timestamp(a.createdAt)-timestamp(b.createdAt)),
  undatedMessages:records.filter(message=>!keyFor(message.createdAt)&&sourceMessageIds.has(message.id)),
 };
}

export function notebookCompanionData(options={}) {
 const companion=options.companion&&typeof options.companion==='object'?options.companion:{};
 const name=text(options.companionName)||text(companion.name)||'Klin';
 const familyId=typeof options.family==='string'?options.family:options.family?.id||companion.element;
 const family=families.find(item=>item.id===familyId)||null;
 const personality=text(options.personality)||text(companion.personality);
 const skillSource=Array.isArray(options.skills)?options.skills:Array.isArray(companion.skills)?companion.skills:[];
 const skills=skillSource.map(value=>typeof value==='string'?{name:text(value),description:''}:value&&typeof value==='object'?{name:text(value.name)||text(value.label),description:text(value.description)}:null).filter(value=>value?.name);
 return {name,avatar:safeAvatar(options.avatar),family:family?{id:family.id,name:family.familyName,clan:family.clan}:null,
  personality:personality||((familyId==='metal'||(!familyId&&name==='Klin'))?'有點慢熱，也總對小事好奇。習慣先聽你說完，再一起把零碎的心事理清。':''),skills};
}

function originalChatMarkup(messages,name) {
 return messages.map(message=>`<div class="notebook-message${message.role==='user'?' own':''}"><small>${message.role==='user'?'我':esc(name)}${keyFor(message.createdAt)?` · ${new Date(timestamp(message.createdAt)).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit',hour12:false})}`:''}</small><p>${esc(message.text)}</p></div>`).join('');
}

export function notebookDayMarkup(space={},user={},options={}) {
 const day=notebookDayData(space,user,options),name=notebookCompanionData(options).name;
 const summaryEmpty=day.entries.length||day.messages.length?'這一天的聊天已留下，還沒有整理成總結。':'這一天還沒有留下日記。';
 const heading=day.isToday?'今日':'當日';
 return `<article class="notebook-paper notebook-day-detail" data-notebook-day="${day.day}"><header class="notebook-day-heading"><time datetime="${day.day}">${Number(day.day.slice(5,7))} 月 ${Number(day.day.slice(8))} 日</time><p>${day.day.slice(0,4)} · ${new Date(day.day+'T12:00:00').toLocaleDateString('zh-HK',{weekday:'long'})}${day.isToday?' · 今天':''}</p></header><section class="notebook-section"><h4>${heading}總結</h4>${day.summaries.length?day.summaries.map(summary=>`<p class="notebook-copy">${esc(summary)}</p>`).join(''):`<p class="notebook-empty">${summaryEmpty}</p>`}</section><section class="notebook-section notebook-quotes"><h4>${heading}金句</h4>${day.quotes.length?day.quotes.map(quote=>`<blockquote>${esc(quote)}</blockquote>`).join(''):'<p class="notebook-empty">這一天還沒有留下金句。</p>'}</section>${day.tags.length?`<section class="notebook-section"><h4>關聯標籤</h4><div class="tag-associated tag-diary-readonly" aria-label="已確認的關聯標籤">${day.tags.map(item=>socialTagStickerMarkup(item)).join('')}</div></section>`:''}<details class="notebook-originals" ${options.showChat?'open':''}><summary>原始聊天 <span>${day.messages.length?`${day.messages.length} 則`:''}</span>${uiIcon('back')}</summary><div>${originalChatMarkup(day.messages,name)||'<p class="notebook-empty">這一天沒有保存聊天記錄。</p>'}</div>${day.undatedMessages.length?`<section class="notebook-undated"><h4>未記錄時間的原話</h4><p class="notebook-empty">曾收在這天的小記裡，沒有留下時間。</p>${originalChatMarkup(day.undatedMessages,name)}</section>`:''}</details><p class="notebook-privacy">僅自己可見</p></article>`;
}

function recordsMarkup(space,user,options) {
 const calendar=diaryCalendarData(space,user,options),today=keyFor(options.now??Date.now());
 const ledger=socialTagState(space,user),messages=savedMessages(space),days=new Set();
 for(const item of [...ledger.diary,...messages]){const day=keyFor(item.createdAt);if(day.startsWith(calendar.month+'-'))days.add(day);}
 if(today.startsWith(calendar.month+'-'))days.add(today);
 const cells=calendar.cells.map(cell=>cell?`<button type="button" class="notebook-calendar-day${days.has(cell.day)&&[...ledger.diary,...messages].some(item=>keyFor(item.createdAt)===cell.day)?' has-record':''}" data-action="notebook-day" data-day="${cell.day}" aria-label="查看 ${cell.day.replaceAll('-',' / ')} 的日記" ${cell.today?'aria-current="date"':''}><span>${cell.number}</span><i aria-hidden="true"></i></button>`:'<span></span>').join('');
 const rows=[...days].sort().reverse().map(day=>{
  const data=notebookDayData(space,user,{...options,day});
  const preview=data.summaries[0]||data.quotes[0]||data.messages.at(-1)?.text||'今天的故事，慢慢留下。';
  return `<button type="button" class="notebook-day-row" data-action="notebook-day" data-day="${day}" aria-label="查看 ${dayLabel(day)}的日記"><time datetime="${day}"><strong>${Number(day.slice(8))}</strong><span>${Number(day.slice(5,7))} 月</span></time><span class="notebook-row-copy"><span>${day===today?'今天':new Date(day+'T12:00:00').toLocaleDateString('zh-HK',{weekday:'long'})}</span><span>${esc(preview)}</span></span>${uiIcon('back')}</button>`;
 }).join('');
 return `<div class="notebook-records" data-diary-month="${calendar.month}"><nav class="notebook-calendar-heading" aria-label="日記月份"><button type="button" data-action="tag-diary-month" data-month="${calendar.previous}" aria-label="上一個月" ${calendar.canPrevious?'':'disabled'}>${uiIcon('back')}</button><h4>${calendar.title}</h4><button type="button" class="is-next" data-action="tag-diary-month" data-month="${calendar.next}" aria-label="下一個月" ${calendar.canNext?'':'disabled'}>${uiIcon('back')}</button></nav><div class="notebook-weekdays" aria-hidden="true">${['一','二','三','四','五','六','日'].map(day=>`<span>${day}</span>`).join('')}</div><div class="notebook-calendar" role="group" aria-label="${calendar.title}聊天記錄">${cells}</div><section class="notebook-days" aria-label="按日期查看日記">${rows||'<p class="notebook-empty">這個月還沒有留下聊天記錄。</p>'}</section></div>`;
}

function aboutMarkup(options) {
 const nok=notebookCompanionData(options);
 return `<article class="notebook-paper notebook-about"><div class="notebook-nok-heading">${nok.avatar?`<img class="notebook-nok-avatar" src="${esc(nok.avatar)}" alt="${esc(nok.name)}的頭像" width="72" height="72" draggable="false">`:''}<div><h4>${esc(nok.name)}</h4><p>和你結下契約的 Nok</p></div></div><section class="notebook-section"><h4>家族</h4><p>${nok.family?`${esc(nok.family.name)} · ${esc(nok.family.clan)}家族`:'還沒有記錄家族資料。'}</p></section><section class="notebook-section"><h4>性格</h4><p class="${nok.personality?'notebook-copy':'notebook-empty'}">${esc(nok.personality)||'在相處中，慢慢認識彼此。'}</p></section><section class="notebook-section notebook-skills"><h4>Skill</h4>${nok.skills.length?`<ul>${nok.skills.map(skill=>`<li><span>${esc(skill.name)}</span>${skill.description?`<p>${esc(skill.description)}</p>`:''}</li>`).join('')}</ul>`:'<p class="notebook-empty">還沒有記錄技能。</p>'}</section></article>`;
}

export function notebookMarkup(space={},user={},options={}) {
 const tab=['today','day','about','records'].includes(options.tab)?options.tab:'today';
 const tabs=[['records','日記檢索'],['about','Nok 檔案']];
 const nav=`<nav class="notebook-bookmarks" aria-label="日記本附頁">${tabs.map(([key,label])=>`<button type="button" id="notebook-tab-${key}" aria-controls="notebook-panel-${key}" aria-pressed="${key===tab}" data-action="notebook-tab" data-tab="${key}">${label}</button>`).join('')}</nav>`;
 const body=tab==='about'?aboutMarkup(options):tab==='day'?notebookDayMarkup(space,user,options):tab==='today'?notebookDayMarkup(space,user,{...options,day:keyFor(options.now??Date.now())}):recordsMarkup(space,user,options);
 const heading=tab==='today'?'<span class="notebook-current-label" id="notebook-current-label">今日日記</span>':tab==='day'?`<button type="button" class="notebook-return" data-action="tag-diary-records">${uiIcon('back')}日記檢索</button>`:`<button type="button" class="notebook-return" data-action="notebook-tab" data-tab="today">${uiIcon('back')}今日日記</button>`;
 return `<div class="notebook-v92" data-notebook-tab="${tab}">${nav}<div class="notebook-book-title">${heading}</div><div class="notebook-panel" role="region" aria-label="${tab==='today'?'今日日記':tab==='day'?'這一天的日記':tab==='about'?'Nok 檔案':'日記檢索'}" tabindex="-1" id="notebook-panel-${tab}">${body}</div></div>`;
}
