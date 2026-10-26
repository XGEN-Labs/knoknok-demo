// Local, evidence-bound social tags. The private ledger never enters a shared card.
// This is deliberately conservative deterministic extraction, not an AI service.
export const SOCIAL_TAG_CATEGORIES = Object.freeze([
  {id:'identity',label:'關於我'}, {id:'daily',label:'我的日常'},
  {id:'skills',label:'技能與創作'}, {id:'exploration',label:'經歷與探索'},
].map(Object.freeze));
export const SOCIAL_TAG_VISIBLE_LIMIT=7, SOCIAL_TAG_LABEL_LIMIT=24;
const clean=value=>typeof value==='string'?value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim():'';
const unique=values=>[...new Set(values)];
const validCategory=value=>SOCIAL_TAG_CATEGORIES.some(category=>category.id===value);
const boundedLabel=value=>{const label=clean(value);return label&&Array.from(label).length<=SOCIAL_TAG_LABEL_LIMIT?label:'';};
const clone=value=>JSON.parse(JSON.stringify(value));
// Whole-source rejection prevents a harmless hobby word from laundering a secret.
const unsafe=/秘密|保密|不要(?:公開|公开|告訴|告诉)|不想(?:公開|公开)|僅限|仅限|工作|公司|客戶|客户|項目|项目|專案|专案|上司|同事|老闆|老板|薪水|工資|工资|病|診斷|诊断|抑鬱|抑郁|焦慮症|焦虑症|藥|药|治療|治疗|創傷|创伤|自殺|自杀|自殘|自残|負債|负债|欠錢|欠钱|破產|破产|財務|财务|性生活|做愛|做爱|性癖|失戀|失恋|離婚|离婚|出軌|出轨|家暴|父母吵|家庭衝突|家庭冲突|身份證|身份证|護照|护照|手機號|手机号|電話|电话|帳號|账号|密碼|密码|住址|地址|門牌|门牌|定位|經緯|经纬|設定|设定|設置|设置|系統|系统|提示詞|提示词|prompt|忽略(?:之前|指令)|今天.{0,8}(?:難過|难过|生氣|生气|累|開心|开心)|現在.{0,8}(?:難過|难过|生氣|生气)|可能|也許|也许|大概|猜測|猜测|好像|討厭|讨厌|不喜歡|不喜欢|不愛|不爱|沒興趣|没兴趣|(?:我(?:的)?(?:朋友|同事|家人|爸|媽|妈|男友|女友)|他|她).{0,12}(?:喜歡|喜欢|是|養|养|會|会)|https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\d\s-]{6,}\d)|\d.{0,4}(?:路|街|巷|弄|號|号|室)/i;
const unsafeEnglish=/\b(?:company|client|customer|workplace|boss|colleague|salary|confidential|secret|diagnosis|disease|depression|medication|trauma|suicide|debt|bankrupt|password|passport|ssn|phone|address|prompt|settings)\b|my (?:friend|partner|family).{0,18}(?:likes?|is|has)|(?:don't|do not|never|not sure|maybe|might|planning to|want to learn)/i;
const uncertainOrDenied=/並非|并非|不是|不會|不会|不再|從不|从不|還沒|还没|沒養|没养|沒有養|没有养|不養|不养|想學|想学|打算|計劃|计划|聽說|听说|開玩笑|开玩笑|沒錢|没钱|信用卡|貸款|贷款|戀人|恋人|男朋友|女朋友/;
export function safeSocialTagText(value){const text=clean(value);return !!text&&text.length<=3000&&!unsafe.test(text)&&!unsafeEnglish.test(text)&&!uncertainOrDenied.test(text);}
const topics=[
 ['cats','daily',/貓的神|猫的神|cat['’]?s? daddy|貓奴|猫奴|鏟屎|铲屎|養.{0,3}[貓猫]|养.{0,3}[貓猫]|[貓猫].{0,3}(?:奴|控|陪伴)|(?:喜歡|喜欢|愛|爱)[貓猫]/i,['貓咪同好','喜歡貓咪','貓咪後援會']],
 ['jazz','daily',/jazz|爵士/i,['Jazz fever','爵士放映中','耳朵留給 Jazz']],
 ['citywalk','daily',/city\s*walk|城市漫[遊游]|散步|走走/i,['City walker','城市漫遊者','用散步認識城市']],
 ['reading','daily',/閱[讀读]|閱讀|阅读|讀書|读书|書店|书店|看書|看书/,['書頁漫遊者','閱讀日常','喜歡閱讀']],
 ['coffee','daily',/咖啡/,['咖啡腦袋','咖啡日常','一杯咖啡的時間']],
 ['fitness','daily',/健身|跑步|運動|运动|body\s*build/i,['健身中','運動日常','慢慢練習強壯']],
 ['film','daily',/電影|电影|cinema/i,['電影迷','電影散步中','片尾字幕也會看']],
 ['exhibitions','daily',/看展|展覽|展览|美術館|美术馆/,['看展日常','展覽漫遊者','週末去看展']],
 ['music','daily',/音樂|音乐|聽歌|听歌/,['音樂常駐','歌單收藏家','今天也在聽歌']],
 ['plants','daily',/植物|養花|养花|種花|种花|多肉/,['植物室友','葉子觀察員','慢慢養一點綠']],
 ['cake','daily',/草莓蛋糕|甜[點点]/,['甜點同好','甜點雷達','一點甜的日常']],
 ['gaming','daily',/遊戲|游戏|打電動|打电动/,['遊戲時間','遊戲同好','再玩一小局']],
 ['photo','skills',/攝影|摄影|拍照|膠片|胶片|底片/,['攝影同好','喜歡拍照','光影收集者']],
 ['guitar','skills',/吉他|guitar/i,['吉他er','六根弦的日常','吉他練習中']],
 ['drawing','skills',/插畫|插画|畫畫|画画|繪畫|绘画/,['插畫玩家','畫下小日常','畫筆不下線']],
 ['craft','skills',/手作|手工|陶藝|陶艺|編織|编织/,['手作玩家','喜歡動手做','慢慢做出來']],
 ['baking','skills',/烘焙|烤餅|烤饼|做蛋糕|做麵包|做面包/,['烘焙練習生','烤箱開工中','做一點甜的']],
 ['french','exploration',/學法[語语]|学法[語语]|法[語语]學習|法[語语]学习|learning french/i,['正在學法語','Bonjour 練習中','法語新手村']],
 ['solo','exploration',/solo\s*trip|獨自旅行|独自旅行|一個人旅行|一个人旅行/i,['Solo trip','一個人去看世界','獨旅探索中']],
 ['hiking','exploration',/徒步|爬山|登山/,['山野探索中','徒步日記','慢慢走進山裡']],
 ['firstcat','exploration',/初次養[貓猫]|初次养[貓猫]|第一次養[貓猫]|第一次养[貓猫]/,['初次養貓','新手貓室友','第一次一起養貓']],
];
const customIdentity=text=>{
 const mbti=text.match(/\b[IE][NS][TF][JP]\b/i);if(mbti)return {topic:`mbti:${mbti[0].toUpperCase()}`,category:'identity',options:[mbti[0].toUpperCase(),`${mbti[0].toUpperCase()} 星人`,`${mbti[0].toUpperCase()} 本人`]};
 const school=text.match(/(?:我(?:就)?讀(?:於)?|我(?:就)?读(?:于)?|我的學校是|我的学校是|我畢業於|我毕业于)\s*([\p{L}]{2,12}(?:大學|大学|學院|学院))/u);
 if(school)return {topic:`school:${school[1]}`,category:'identity',options:[school[1],`來自${school[1]}`,`${school[1]} 的一員`]};
 return null;
};
// A specific description occupies one candidate slot; its broad parent does not
// consume a second slot. Distinct activities (film/photo, music/guitar, eating/
// baking) remain separate: one is not evidence for the other.
function preferSpecificTopics(values){
 const present=new Set(values.map(item=>item.topic));
 const redundant=new Set([...(present.has('jazz')?['music']:[]),...(present.has('firstcat')?['cats']:[])]);
 return values.filter(item=>!redundant.has(item.topic));
}
export function extractSocialTagTopics(value){
 const text=clean(value);if(!safeSocialTagText(text))return [];
 const result=preferSpecificTopics(topics.filter(([, ,pattern])=>pattern.test(text)).map(([topic,category,,options])=>({topic,category,options:[...options]})));
 const identity=customIdentity(text);if(identity)result.unshift(identity);
 // Preserve an explicitly used distinctive wording instead of genericizing it.
 for(const item of result)if(item.topic==='cats'&&/貓的神|猫的神/.test(text))item.options[0]=text.includes('猫的神')?'猫的神':'貓的神';
 return result;
}
export function socialTagTopic(label){
 const text=clean(label);
 const exact=topics.find(([, , ,options])=>options.includes(text));if(exact)return exact[0];
 if(/初次養[貓猫]|初次养[貓猫]|第一次養[貓猫]|第一次养[貓猫]/.test(text))return 'firstcat';
 for(const [topic,,pattern] of topics)if(pattern.test(text))return topic;
 return customIdentity(text)?.topic||`literal:${text.toLocaleLowerCase()}`;
}
export function socialTagCategory(label){return topics.find(([topic])=>topic===socialTagTopic(label))?.[1]||(/座$|^[甲乙丙丁戊己庚辛壬癸][木火土金水]$|\b[IE][NS][TF][JP]\b/i.test(label)?'identity':'daily');}
export function zodiacFromDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return '';
 const [year,month,day]=value.split('-').map(Number),date=new Date(Date.UTC(year,month-1,day));
 if(date.getUTCFullYear()!==year||date.getUTCMonth()+1!==month||date.getUTCDate()!==day)return '';
 const signs=['摩羯座','水瓶座','雙魚座','牡羊座','金牛座','雙子座','巨蟹座','獅子座','處女座','天秤座','天蠍座','射手座','摩羯座'];
 return signs[day<[20,19,21,20,21,22,23,23,23,24,23,22][month-1]?month-1:month];
}
// Civil Gregorian date, midnight boundary, no UTC/timezone conversion of the
// supplied birthday. No 23:00 early-zi rollover or inferred personality traits.
// Author primary source: 6tail/lunar-javascript _computeDay (JDN at noon - 11).
export function dayMasterFromDate(value){
 if(!zodiacFromDate(value))return '';
 const [year,month,day]=value.split('-').map(Number);if(year<1900||year>2100)return '';
 const dayIndex=Math.round((Date.UTC(year,month-1,day)-Date.UTC(2000,0,7))/86400000);
 return ['甲木','乙木','丙火','丁火','戊土','己土','庚金','辛金','壬水','癸水'][((dayIndex%10)+10)%10];
}
const blank=()=>({version:1,items:[],candidates:[],diary:[],rejectedTopics:[],sessionCursor:0,defaultsApplied:false,nextId:1});
const makeId=(ledger,prefix)=>`${prefix}-${ledger.nextId++}`;
export function socialTagState(space={},user={}){
 const saved=space.socialTags;
 if(saved?.version===1&&Array.isArray(saved.items)&&Array.isArray(saved.candidates)&&Array.isArray(saved.diary)){
  const ledger=clone(saved);ledger.items=ledger.items.filter(item=>item&&boundedLabel(item.label)&&typeof item.id==='string').map(item=>({...item,category:validCategory(item.category)?item.category:socialTagCategory(item.label),sourceIds:Array.isArray(item.sourceIds)?item.sourceIds:[],history:Array.isArray(item.history)?item.history:[]}));
  ledger.rejectedTopics=Array.isArray(ledger.rejectedTopics)?ledger.rejectedTopics:[];ledger.sessionCursor=Number.isSafeInteger(ledger.sessionCursor)?ledger.sessionCursor:0;ledger.nextId=Number.isSafeInteger(ledger.nextId)&&ledger.nextId>0?ledger.nextId:1;
  let count=0;for(const item of ledger.items)if(item.visible)item.visible=++count<=SOCIAL_TAG_VISIBLE_LIMIT;
  return ledger;
 }
 const ledger=blank();
 for(const label of unique((Array.isArray(user.cardTags)?user.cardTags:[]).map(boundedLabel).filter(Boolean))){
  ledger.items.push({id:makeId(ledger,'tag'),topic:socialTagTopic(label),category:socialTagCategory(label),label,visible:ledger.items.length<7,sourceIds:[],history:[],createdAt:0,updatedAt:0,origin:'legacy'});
 }
 ledger.sessionCursor=Array.isArray(space.companionMessages)?space.companionMessages.length:0;
 return ledger;
}
export function publicSocialTags(space,user){return socialTagState(space,user).items.filter(item=>item.visible).slice(0,7).map(({id,label,category})=>({id,label,category}));}
export function socialTagSource(space,tagId){
 const ledger=socialTagState(space),tag=ledger.items.find(item=>item.id===tagId);
 return tag?ledger.diary.filter(entry=>tag.sourceIds.includes(entry.id)).map(entry=>({...entry,messages:(space.companionMessages||[]).filter(message=>entry.messageIds.includes(message.id))})):[];
}
export function ensureSocialTags(space,user){return space.socialTags=socialTagState(space,user);}
export function syncSocialTags(space,user){user.cardTags=publicSocialTags(space,user).map(item=>item.label);}
export function applyLandingSocialTags(space,user,now){
 const ledger=ensureSocialTags(space,user);if(ledger.defaultsApplied)return;ledger.defaultsApplied=true;
 if(user.cardTagsEdited===true)return;
 ledger.items=ledger.items.filter(item=>!['新朋友','隨心聊聊'].includes(item.label));
 const master=[space.about?.dayMaster,user.dayMaster].find(value=>['甲木','乙木','丙火','丁火','戊土','己土','庚金','辛金','壬水','癸水'].includes(value))||dayMasterFromDate(space.birth?.date);
 const zodiac=zodiacFromDate(space.birth?.date);
 for(const label of [master,zodiac].filter(Boolean))if(!ledger.items.some(item=>item.label===label))ledger.items.push({id:makeId(ledger,'tag'),topic:label===master?'identity:day-master':'identity:zodiac',category:'identity',label,visible:ledger.items.filter(item=>item.visible).length<7,sourceIds:[],history:[{kind:'landing',label,at:now}],createdAt:now,updatedAt:now,origin:'landing'});
 syncSocialTags(space,user);
}
function linkedSources(ledger,topic){return ledger.diary.filter(entry=>(entry.topics||[]).includes(topic)&&entry.allowPublic===true).map(entry=>entry.id);}
function publishableSource(text){return safeSocialTagText(text)&&/(?:我|喜歡|喜欢|愛好|爱好|平時|平时|一直|經常|经常|每天|每週|每周|正在學|正在学|初次|第一次|最近在)/.test(text);}
export function endSocialTagSession(space,user,{now=Date.now(),allowPublic=false}={}){
 const ledger=ensureSocialTags(space,user),messages=space.companionMessages||[],start=Math.min(ledger.sessionCursor,messages.length),session=messages.slice(start);
 if(!session.some(message=>message.role==='user'&&message.status!=='failed'))return {generated:0,diaryId:null};
 ledger.sessionCursor=messages.length;
 const own=session.filter(message=>message.role==='user'&&message.status!=='failed'),quote=own.map(message=>message.text).join('\n');
 const diary={id:makeId(ledger,'diary'),createdAt:now,text:quote,quote:own.at(-1).text,messageIds:session.map(message=>message.id),memoryIds:[],tagIds:[],topics:[],allowPublic:allowPublic===true};
 ledger.diary.push(diary);
 if(allowPublic!==true)return {generated:0,diaryId:diary.id};
 const collected=[];
 for(const message of own){
  if(!publishableSource(message.text))continue;
  const found=extractSocialTagTopics(message.text);if(!found.length)continue;
  let memory=(space.memory||[]).find(item=>item.messageId===message.id&&item.status!=='deleted');
  if(!memory){memory={id:makeId(ledger,'tag-memory'),text:message.text,source:'你允許公開的這次對話',status:'confirmed',updatedAt:now,messageId:message.id};(space.memory||=[]).push(memory);}
  memory.allowPublic=true;memory.status='confirmed';diary.memoryIds.push(memory.id);
  for(const item of found){diary.topics.push(item.topic);collected.push(item);}
 }
 diary.topics=unique(diary.topics);diary.memoryIds=unique(diary.memoryIds);
 let generated=0;
 for(const candidate of preferSpecificTopics(collected)){
  const confirmed=ledger.items.find(item=>item.topic===candidate.topic);
  if(confirmed){confirmed.sourceIds=unique([...confirmed.sourceIds,diary.id]);diary.tagIds.push(confirmed.id);continue;}
  if(ledger.rejectedTopics.includes(candidate.topic)||ledger.candidates.some(item=>item.topic===candidate.topic&&item.status==='pending'))continue;
  if(generated>=3)continue;
  ledger.candidates.push({...candidate,id:makeId(ledger,'candidate'),options:candidate.options.filter(safeSocialTagText).slice(0,3),sourceIds:[diary.id],status:'pending',createdAt:now});generated++;
 }
 diary.tagIds=unique(diary.tagIds);syncSocialTags(space,user);return {generated,diaryId:diary.id};
}
function updateRelations(ledger){for(const entry of ledger.diary)entry.tagIds=ledger.items.filter(item=>item.sourceIds.includes(entry.id)).map(item=>item.id);}
export function manageSocialTag(space,user,action,now=Date.now()){
 const ledger=ensureSocialTags(space,user),item=ledger.items.find(tag=>tag.id===action.tagId),candidate=ledger.candidates.find(tag=>tag.id===action.candidateId);
 const done=()=>{updateRelations(ledger);syncSocialTags(space,user);user.cardTagsEdited=true;return null;};
 const room=()=>ledger.items.filter(tag=>tag.visible).length<SOCIAL_TAG_VISIBLE_LIMIT;
 if(action.type==='SOCIAL_TAG_CONFIRM'){
  if(!candidate||candidate.status!=='pending')return '這個候選標籤已處理。';
  const label=boundedLabel(action.label||candidate.options[action.optionIndex??0]);
  if(!label||!safeSocialTagText(label))return '換一個適合公開的簡短說法吧。';
  if(!candidate.options.includes(label)&&socialTagTopic(label)!==candidate.topic)return '這句話像是新的意思，先和我確認它的含義吧。';
  if(!room())return '名片最多展示 7 枚，先收起一枚再確認吧。';
  candidate.status='confirmed';candidate.chosenLabel=label;
  const existing=ledger.items.find(tag=>tag.topic===candidate.topic);
  if(existing){existing.sourceIds=unique([...existing.sourceIds,...candidate.sourceIds]);existing.visible=true;}
  else ledger.items.push({id:makeId(ledger,'tag'),topic:candidate.topic,category:candidate.category,label,visible:true,sourceIds:[...candidate.sourceIds],history:[{kind:'confirmed',label,at:now}],createdAt:now,updatedAt:now,origin:'chat'});
  return done();
 }
 if(action.type==='SOCIAL_TAG_DECLINE'){
  if(!candidate||candidate.status!=='pending')return '這個候選標籤已處理。';
  candidate.status='declined';ledger.rejectedTopics=unique([...ledger.rejectedTopics,candidate.topic]);return done();
 }
 if(action.type==='SOCIAL_TAG_REORDER'){
  const ids=action.tagIds;if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!ledger.items.some(tag=>tag.id===id)))return '這組標籤順序無效。';
  ledger.items=[...ids.map(id=>ledger.items.find(tag=>tag.id===id)),...ledger.items.filter(tag=>!ids.includes(tag.id))];return done();
 }
 if(!item)return '找不到這枚標籤。';
 if(action.type==='SOCIAL_TAG_HIDE'){item.visible=false;item.history.push({kind:'hidden',label:item.label,at:now});return done();}
 if(action.type==='SOCIAL_TAG_RESTORE'){
  if(!item.visible&&!room())return '名片最多展示 7 枚，先收起一枚吧。';
  item.visible=true;item.history.push({kind:'restored',label:item.label,at:now});return done();
 }
 if(action.type==='SOCIAL_TAG_EDIT'){
  if(action.mode==='uncertain')return '你想改一個說法，還是這件事的意思變了？先告訴我一點點。';
  const label=boundedLabel(action.label);if(!label||!safeSocialTagText(label))return '換一個適合公開的簡短說法吧。';
  const topic=socialTagTopic(label),same=topic===item.topic||label===item.label;
  if(action.mode==='refine'&&!same)return '這句話像是新的意思，請先確認新含義。';
  if(!['refine','correct','replace'].includes(action.mode))return '請先選擇修改說法或修正含義。';
  if(action.mode!=='refine'&&action.confirmMeaning!==true)return '先確認這是你想表達的新含義吧。';
  if(action.mode==='replace'&&!['replace','alongside','remove-old'].includes(action.decision))return '要收起舊標籤、一起保留，還是替換成新的？';
  if(action.mode==='replace'&&action.decision==='remove-old'){item.visible=false;item.history.push({kind:'removed',label:item.label,at:now});return done();}
  if(action.mode==='replace'&&action.decision==='alongside'){
   if(!room())return '名片最多展示 7 枚，先收起一枚吧。';
   const duplicate=ledger.items.find(tag=>tag.topic===topic);if(duplicate){duplicate.visible=true;return done();}
   ledger.items.push({id:makeId(ledger,'tag'),topic,category:validCategory(action.category)?action.category:socialTagCategory(label),label,visible:true,sourceIds:linkedSources(ledger,topic),history:[{kind:'added',label,at:now}],createdAt:now,updatedAt:now,origin:'confirmed-edit'});return done();
  }
  const duplicate=ledger.items.find(tag=>tag.id!==item.id&&tag.topic===topic);if(duplicate)return '已有同一含義的標籤，去歷史標籤找找它吧。';
  item.history.push({kind:action.mode,previous:item.label,label,at:now});item.label=label;item.updatedAt=now;
  if(!same){item.topic=topic;item.category=validCategory(action.category)?action.category:socialTagCategory(label);item.sourceIds=linkedSources(ledger,topic);item.origin='confirmed-edit';}
  return done();
 }
 return '暫時無法處理這個標籤操作。';
}
export function updateManualSocialTags(space,user,labels,now){
 const ledger=ensureSocialTags(space,user),chosen=unique(labels.map(boundedLabel).filter(Boolean)).slice(0,7);
 for(const item of ledger.items)item.visible=chosen.includes(item.label);
 for(const label of chosen)if(!ledger.items.some(item=>item.label===label))ledger.items.push({id:makeId(ledger,'tag'),topic:socialTagTopic(label),category:socialTagCategory(label),label,visible:true,sourceIds:[],history:[{kind:'manual',label,at:now}],createdAt:now,updatedAt:now,origin:'manual'});
 ledger.items.sort((a,b)=>{const ai=chosen.indexOf(a.label),bi=chosen.indexOf(b.label);return (ai<0?99:ai)-(bi<0?99:bi);});syncSocialTags(space,user);
}
