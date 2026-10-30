// Ink margins: public wording chooses a small hand-drawn motif, never private data.
// Category remains semantic metadata; its visual default is used for unknown wording.
import { socialTagTopic } from './social-tags.mjs';
// Text has its own palette channel; icons, outlines and material washes retain ink.
const style=(category,name,fill,ink,shape,icon,material='paper',textInk=ink)=>Object.freeze({category,name,fill,ink,textInk,outline:ink,shape,icon,material,shapeName:({plaque:'手绘铭牌',cloud:'柔弧标签',ticket:'票券缺口',flag:'斜边标签'})[shape]});
export const SOCIAL_TAG_STYLES=Object.freeze({
 identity:style('identity','關於我','#eee8f7','#66517c','plaque','spark'),
 daily:style('daily','我的日常','#f6e8b9','#765925','cloud','sun'),
 skills:style('skills','技能與創作','#f8ddc7','#884c31','ticket','pencil'),
 exploration:style('exploration','經歷與探索','#d7eff0','#286b77','flag','compass','film','#26242c'),
});
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labelOf=item=>typeof item==='object'&&item?String(item.label||item.text||''):String(item||'');
const aliases={personal:'identity',personal_info:'identity',info:'identity',life:'daily',creation:'skills',skill:'skills',creative:'skills',experience:'exploration',experiences:'exploration',explore:'exploration'};
const topicCategories={cats:'daily',jazz:'daily',citywalk:'daily',reading:'daily',coffee:'daily',fitness:'daily',film:'daily',exhibitions:'daily',music:'daily',plants:'daily',cake:'daily',gaming:'daily',photo:'skills',guitar:'skills',drawing:'skills',craft:'skills',baking:'skills',french:'exploration',solo:'exploration',hiking:'exploration',firstcat:'exploration'};
export function socialTagCategory(item){
 const category=typeof item==='object'&&item?(aliases[item.category]||item.category):'';
 if(Object.hasOwn(SOCIAL_TAG_STYLES,category))return category;
 const text=labelOf(item),topic=socialTagTopic(text);
 if(Object.hasOwn(topicCategories,topic))return topicCategories[topic];
 if(/(?:\b[IE][NS][FT][JP](?:-[AT])?\b|星座|座$|大學|大学|學校|学校|專業|专业|職業|职业|工程師|工程师|經理|经理|甲木|乙木|丙火|丁火|戊土|己土|庚金|辛金|壬水|癸水)/i.test(text))return 'identity';
 if(/(?:學習|学习|正在學|正在学|初次|第一次|旅行|獨旅|独旅|探索|旅人|solo\s*trip|learning)/i.test(text))return 'exploration';
 if(/(?:攝影|摄影|膠片|胶片|吉他|創作|创作|畫畫|画画|繪畫|绘画|寫作|写作|手作|陶|coding|guitar|design|film|sketch)/i.test(text))return 'skills';
 return 'daily';
}
const motif=(icon,fill,ink,shape,shapeName,material='paper',outline=ink,textInk=ink)=>Object.freeze({icon,fill,ink,textInk,outline,shape,shapeName,material});
const MOTIFS=Object.freeze({
 wood:motif('sprout','#f3efec','#5b5958','leaf-note','叶缘方签','leaf','#5b5958','#26242c'),
 fire:motif('flame','#b6482e','#fff3d4','ember-cut','斜切火签','enamel','#853c29'),
 earth:motif('mountain','#f6e5b9','#80562c','clay-note','平底陶签','clay'),
 metal:motif('gem','#e5eaf6','#415887','metal-note','直角银签','satin'),
 water:motif('waves','#d8f2f9','#27719a','water-note','水弧标签','water'),
 zodiac:motif('constellation','#7560b1','#fff9ed','orbit-note','弧角星签','ink','#514184'),
 personality:motif('personality','#f8dce6','#884363','soft-note','柔角方签','enamel'),
 cat:motif('cat','#f3ddc6','#825539','cat-note','双耳标签','paper'),
 music:motif('music','#263f7b','#fff0be','record-note','唱片弧签','ink','#24365d'),
 coffee:motif('coffee','#f4e1c8','#805638','cup-note','杯弧标签','glaze'),
 reading:motif('book','#ece9e6','#5d5c5a','bookmark','书角缺口','leaf','#5d5c5a','#26242c'),
 camera:motif('camera','#d8e9ec','#346b7a','ticket','票券缺口','satin','#346b7a','#26242c'),
 guitar:motif('guitar','#ffd9ad','#954a24','pick-note','拨片弧角','glaze'),
 travel:motif('suitcase','#cdecef','#256b77','travel-cut','单角旅签','film','#256b77','#26242c'),
 language:motif('language','#ece2fa','#654c9e','speech-note','对话尾角','enamel'),
 citywalk:motif('footsteps','#eae7e4','#636160','flag','斜边漫游签','paper','#636160','#26242c'),
 fitness:motif('motion','#ebe8e4','#686765','travel-cut','活力切角','film','#686765','#26242c'),
 film:motif('film','#e8e0d4','#62533f','ticket','电影票券'),
 exhibitions:motif('frame','#e8dcf1','#755285','metal-note','画框方签'),
 plants:motif('sprout','#ece9e6','#62605f','leaf-note','叶缘方签','leaf','#62605f','#26242c'),
 cake:motif('cake','#f6dce2','#904f61','soft-note','甜点弧签','glaze'),
 gaming:motif('gamepad','#dce5f7','#4a6091','record-note','游戏弧签','film'),
 drawing:motif('pencil','#f9dfbe','#935d2f','bookmark','画纸缺口'),
 craft:motif('thread','#ebdfce','#826148','plaque','手作方签','paper'),
 baking:motif('oven','#f5dbb6','#945c33','clay-note','烘焙纸签','clay'),
 hiking:motif('mountain','#eae6e3','#666563','travel-cut','山野切角','leaf','#666563','#26242c'),
});
const topicMotifs={cats:'cat',firstcat:'cat',jazz:'music',music:'music',citywalk:'citywalk',reading:'reading',coffee:'coffee',fitness:'fitness',film:'film',exhibitions:'exhibitions',plants:'plants',cake:'cake',gaming:'gaming',photo:'camera',guitar:'guitar',drawing:'drawing',craft:'craft',baking:'baking',french:'language',solo:'travel',hiking:'hiking'};
const TAG_MATCHES=[
 [/甲木|乙木/,'wood'],[/丙火|丁火/,'fire'],[/戊土|己土/,'earth'],[/庚金|辛金/,'metal'],[/壬水|癸水/,'water'],
 [/(?:星座|白羊|牡羊|金牛|雙子|双子|巨蟹|獅子|狮子|處女|处女|天秤|天蠍|天蝎|射手|人馬|人马|摩羯|魔羯|水瓶|寶瓶|宝瓶|雙魚|双鱼)座?/,'zodiac'],
 [/\b[IE][NS][FT][JP](?:-[AT])?\b/i,'personality'],
 [/(?:正在學|正在学|學習|学习|learning).*(?:語|语|文|language|french|english|japanese)|(?:語言|语言|polyglot|bonjour|法語|法语)/i,'language'],
 [/(?:貓|猫|cat(?:'s)?\b)/i,'cat'],[/(?:爵士|音樂|音乐|jazz|music|歌單|歌单|聽歌|听歌)/i,'music'],
 [/(?:吉他|結他|结他|guitar|六根弦)/i,'guitar'],[/(?:攝影|摄影|膠片|胶片|photo|film|camera|拍照|光影收集)/i,'camera'],
 [/(?:旅行|獨旅|独旅|旅人|旅遊|旅游|solo\s*trip|travel|一個人去看世界|一个人去看世界)/i,'travel'],
 [/(?:咖啡|coffee)/i,'coffee'],[/(?:閱讀|阅读|讀書|读书|書頁|书页|book|read)/i,'reading'],
];
export function socialTagStyle(item){
 const base=SOCIAL_TAG_STYLES[socialTagCategory(item)],label=labelOf(item);
 const key=topicMotifs[socialTagTopic(label)]||TAG_MATCHES.find(([match])=>match.test(label))?.[1];
 return key?{...base,...MOTIFS[key],motif:key}:base;
}
// All paths are shared by SVG and Canvas; silhouettes stay quiet and compact.
export function stickerOutline(shape,width,height){
 const w=width,h=height,r=Math.min(15,h*.24),m=h/2;
 if(shape==='ticket')return [['M',r,5],['Q',4,5,4,r],['L',4,m-9],['Q',17,m,4,m+9],['L',4,h-r],['Q',4,h-4,r,h-4],['L',w-r,h-4],['Q',w-4,h-4,w-4,h-r],['L',w-4,m+9],['Q',w-17,m,w-4,m-9],['L',w-4,r],['Q',w-4,4,w-r,4],['Z']];
 if(shape==='flag')return [['M',r+8,5],['Q',w*.5,3,w-r,5],['Q',w-4,6,w-5,r],['L',w-9,h-r],['Q',w-10,h-4,w-r-8,h-4],['L',r,h-3],['Q',4,h-4,5,h-r],['L',9,r],['Q',10,5,r+8,5],['Z']];
 if(shape==='cloud')return [['M',20,6],['Q',w*.3,3,w*.5,5],['Q',w*.7,2,w-18,6],['Q',w-4,6,w-5,20],['Q',w-2,m,w-6,h-18],['Q',w-6,h-3,w-22,h-5],['Q',w*.5,h-1,22,h-5],['Q',6,h-2,6,h-20],['Q',3,m,6,20],['Q',5,6,20,6],['Z']];
 if(shape==='cat-note')return [['M',r,14],['Q',5,15,5,28],['L',5,h-r],['Q',5,h-5,r,h-5],['Q',w*.5,h-1,w-r,h-5],['Q',w-5,h-5,w-5,h-r],['L',w-5,26],['Q',w-5,16,w-15,13],['L',w-27,3],['L',w-42,13],['Q',w*.5,10,43,13],['L',28,4],['L',18,14],['Z']];
 if(shape==='bookmark')return [['M',r,5],['Q',4,5,4,r],['L',4,h-15],['Q',4,h-6,12,h-4],['L',23,h-12],['L',34,h-5],['Q',w*.5,h-3,w-r,h-5],['Q',w-4,h-5,w-4,h-r],['L',w-4,r],['Q',w-4,4,w-r,4],['Q',w*.5,2,r,5],['Z']];
 if(shape==='speech-note')return [['M',r,5],['Q',4,5,4,r],['L',4,h-23],['Q',4,h-13,r,h-13],['Q',w*.5,h-10,w-46,h-13],['L',w-28,h-3],['L',w-25,h-13],['L',w-r,h-14],['Q',w-4,h-15,w-4,h-25],['L',w-4,r],['Q',w-4,4,w-r,4],['Q',w*.5,2,r,5],['Z']];
 if(shape==='travel-cut')return [['M',r,6],['Q',4,6,4,r],['L',4,h-r],['Q',4,h-4,r,h-4],['Q',w*.5,h-1,w-r,h-4],['Q',w-4,h-4,w-4,h-r],['L',w-4,23],['L',w-26,5],['Q',w*.5,3,r,6],['Z']];
 if(shape==='ember-cut')return [['M',26,5],['Q',16,5,9,18],['Q',3,28,4,m],['L',5,h-r],['Q',6,h-4,20,h-4],['L',w-28,h-4],['L',w-5,h-24],['L',w-5,r],['Q',w-5,4,w-r-3,4],['Q',w*.5,2,26,5],['Z']];
 if(shape==='water-note')return [['M',25,6],['Q',w*.5,7,w*.7,4],['Q',w-17,2,w-8,14],['Q',w+1,m,w-9,h-14],['Q',w-16,h-2,w*.7,h-3],['Q',w*.4,h-6,24,h-5],['Q',3,h-5,4,m],['Q',3,6,25,6],['Z']];
 if(shape==='record-note')return [['M',29,5],['Q',w*.5,2,w-30,5],['Q',w-4,5,w-4,m],['Q',w-4,h-5,w-29,h-5],['Q',w*.5,h-2,29,h-5],['Q',4,h-5,4,m],['Q',4,5,29,5],['Z']];
 if(shape==='pick-note')return [['M',25,5],['Q',w*.5,3,w-r,4],['Q',w-3,4,w-4,r],['L',w-4,h-22],['Q',w-5,h-13,w-17,h-5],['Q',w*.5,h-2,25,h-5],['Q',4,h-5,4,m],['Q',4,5,25,5],['Z']];
 if(shape==='cup-note')return [['M',27,5],['Q',w*.5,2,w-20,6],['Q',w-4,6,w-4,21],['L',w-4,h-23],['Q',w-4,h-4,w-29,h-4],['Q',w*.5,h-2,25,h-5],['Q',4,h-5,4,h-23],['L',4,23],['Q',4,5,27,5],['Z']];
 if(shape==='orbit-note')return [['M',24,6],['Q',w*.5,1,w-20,4],['Q',w-3,5,w-4,25],['L',w-4,h-23],['Q',w-4,h-3,w-25,h-5],['Q',w*.5,h+1,22,h-5],['Q',4,h-5,4,h-24],['L',5,24],['Q',5,6,24,6],['Z']];
 if(shape==='soft-note')return [['M',19,6],['Q',w*.5,2,w-20,6],['Q',w-4,7,w-4,20],['L',w-4,h-15],['Q',w-4,h-4,w-20,h-4],['Q',w*.5,h-3,18,h-5],['Q',5,h-5,5,h-18],['L',5,20],['Q',5,7,19,6],['Z']];
 if(shape==='metal-note')return [['M',20,5],['Q',w*.5,2,w-17,5],['Q',w-4,5,w-4,19],['L',w-4,h-17],['Q',w-4,h-4,w-17,h-4],['Q',w*.5,h-2,18,h-4],['Q',5,h-4,5,h-17],['L',4,19],['Q',4,5,20,5],['Z']];
 if(shape==='clay-note')return [['M',19,6],['Q',w*.5,3,w-19,5],['Q',w-5,5,w-5,17],['L',w-5,h-15],['Q',w-5,h-5,w-18,h-5],['L',18,h-5],['Q',5,h-5,5,h-16],['L',5,18],['Q',5,7,19,6],['Z']];
 if(shape==='leaf-note')return [['M',28,6],['Q',w*.5,2,w-22,5],['Q',w-4,5,w-4,24],['L',w-4,h-15],['Q',w-4,h-5,w-20,h-4],['Q',w*.5,h-1,20,h-5],['Q',4,h-5,4,h-22],['L',4,25],['Q',4,7,28,6],['Z']];
 return [['M',r,5],['Q',w*.5,2,w-r,5],['Q',w-3,6,w-4,r],['L',w-6,h-r],['Q',w-5,h-4,w-r,h-4],['Q',w*.5,h-1,r,h-4],['Q',4,h-4,5,h-r],['L',4,r],['Q',5,5,r,5],['Z']];
}
const pathData=commands=>commands.map(([op,...args])=>`${op}${args.map(n=>Math.round(n*100)/100).join(' ')}`).join(' ');
export const stickerPath=(shape,width,height)=>pathData(stickerOutline(shape,width,height));
function traceCommands(context,commands){
 context.beginPath();
 for(const [op,...args] of commands){
  if(op==='M')context.moveTo(...args);else if(op==='L')context.lineTo(...args);else if(op==='Q')context.quadraticCurveTo(...args);else context.closePath();
 }
}
export function traceSticker(context,shape,width,height){traceCommands(context,stickerOutline(shape,width,height));}
export const STICKER_ICONS=Object.freeze({
 footsteps:'M5 3 Q9 1 10 6 L10 12 Q6 15 3 11 L3 7 Q3 4 5 3 Z M15 10 Q19 8 20 13 L20 20 Q16 23 13 19 L13 15 Q13 12 15 10 Z',
 motion:'M14 2 Q18 2 17 6 Q14 9 12 6 Q11 3 14 2 Z M11 9 L7 15 L2 14 M11 9 L16 12 L21 11 M12 11 L13 17 L19 21 M12 17 L7 22',
 film:'M3 5 L21 5 L21 21 L3 21 Z M3 10 L21 10 M6 5 L9 10 M13 5 L16 10 M10 13 L15 16 L10 19 Z',
 frame:'M3 3 L21 3 L21 21 L3 21 Z M6 17 L11 10 L15 15 L18 12 M7 7 L8 7',
 cake:'M3 13 L21 13 L21 22 L3 22 Z M3 16 Q6 19 9 16 Q12 19 15 16 Q18 19 21 16 M5 13 L5 9 L19 9 L19 13 M12 9 L12 5 M12 2 L12 3',
 gamepad:'M8 7 L16 7 Q20 7 21 12 L23 19 Q23 23 19 21 L15 17 L9 17 L5 21 Q1 23 1 19 L3 12 Q4 7 8 7 Z M5 12 L11 12 M8 9 L8 15 M16 12 L16 13 M19 10 L19 11',
 thread:'M9 3 L15 3 L15 6 L18 6 L18 18 L15 18 L15 21 L9 21 L9 18 L6 18 L6 6 L9 6 Z M6 9 L18 12 M6 14 L18 17',
 oven:'M3 3 L21 3 L21 22 L3 22 Z M3 8 L21 8 M7 12 L17 12 L17 18 L7 18 Z M7 5 L8 5 M16 5 L17 5',
 spark:'M12 3 Q11 10 4 12 Q11 13 12 21 Q13 14 20 12 Q13 11 12 3 Z',
 sun:'M8 8 Q12 5 16 8 Q20 12 16 16 Q12 19 8 16 Q5 12 8 8 Z M12 2 L12 4 M20 5 L18 7 M22 12 L20 12 M19 20 L17 18 M12 22 L12 20 M4 20 L6 18 M2 12 L4 12 M4 4 L6 6',
 pencil:'M5 16 L16 4 Q18 3 20 6 L9 19 L4 21 L5 16 Z M14 6 L18 10 M5 16 L9 19',
 compass:'M12 3 Q21 3 21 12 Q21 21 12 21 Q3 21 3 12 Q3 3 12 3 Z M16 8 L14 14 L8 16 L10 10 L16 8 Z',
 sprout:'M12 22 Q13 14 11 9 M11 11 Q3 12 3 4 Q11 3 11 11 Z M12 16 Q13 7 21 8 Q23 16 12 16 Z',
 flame:'M12 2 Q12 8 7 11 Q6 8 6 7 Q1 14 5 19 Q10 24 17 20 Q24 16 18 9 Q18 14 15 13 Q17 7 12 2 Z',
 mountain:'M2 19 L9 5 L13 12 L16 8 L22 19 Z M6 11 L9 13 L12 11 M3 22 L21 22',
 gem:'M7 4 L17 4 L22 10 L12 22 L2 10 L7 4 Z M2 10 L22 10 M7 4 L9 10 L12 22 L15 10 L17 4',
 waves:'M2 7 Q5 3 8 7 Q11 11 14 7 Q17 3 22 7 M2 13 Q5 9 8 13 Q11 17 14 13 Q17 9 22 13 M2 19 Q5 15 8 19 Q11 23 14 19 Q17 15 22 19',
 constellation:'M5 7 L12 15 L20 5 M12 15 L18 21 M5 4 L6 6 L8 7 L6 8 L5 10 L4 8 L2 7 L4 6 L5 4 Z M20 2 L21 4 L23 5 L21 6 L20 8 L19 6 L17 5 L19 4 L20 2 Z M12 13 Q14 13 14 15 Q14 17 12 17 Q10 17 10 15 Q10 13 12 13 Z',
 personality:'M12 3 Q17 3 17 8 Q17 13 12 13 Q7 13 7 8 Q7 3 12 3 Z M3 22 Q3 15 12 15 Q21 15 21 22 M20 3 L20 7 M18 5 L22 5',
 cat:'M3 11 L3 3 L9 7 Q12 6 15 7 L21 3 L21 12 Q23 21 12 22 Q1 21 3 11 Z M7 13 L7 14 M17 13 L17 14 M11 17 L12 18 L13 17 M1 16 L5 17 M19 17 L23 16',
 music:'M9 17 L9 5 L21 2 L21 14 M9 9 L21 6 M9 17 Q8 14 4 16 Q0 18 3 21 Q8 23 9 17 Z M21 14 Q19 12 16 14 Q12 17 15 19 Q20 21 21 14 Z',
 guitar:'M14 9 L19 3 L22 5 L16 12 M19 3 L18 2 M21 5 L22 6 M14 9 Q9 6 9 12 Q2 10 2 17 Q3 23 9 22 Q15 21 12 15 Q18 15 16 12 M7 16 Q9 14 10 16 Q11 18 9 19 Q7 20 7 16 Z M5 19 L7 21',
 camera:'M3 7 L7 7 L9 3 L15 3 L17 7 L21 7 Q23 7 23 10 L22 20 Q12 22 2 20 L1 10 Q1 7 3 7 Z M12 9 Q18 9 18 15 Q18 20 12 20 Q6 20 6 15 Q6 9 12 9 Z M19 10 L20 10',
 suitcase:'M8 6 L8 3 Q12 1 16 3 L16 6 M4 7 Q12 5 20 7 Q22 7 22 10 L21 21 Q12 23 3 21 L2 10 Q2 7 4 7 Z M7 7 L7 21 M17 7 L17 21 M9 13 L15 13',
 language:'M3 5 Q8 1 13 5 Q17 10 12 14 L7 14 L3 18 L4 12 Q0 9 3 5 Z M17 8 Q23 8 23 14 Q23 18 20 19 L20 22 L16 19 L12 19 M5 8 L5 9 M9 8 L9 9 M13 8 L13 9',
 coffee:'M3 7 L16 7 L16 15 Q16 21 10 21 Q3 21 3 15 Z M16 9 Q23 8 22 13 Q21 17 16 16 M7 2 L7 4 M12 1 L12 4 M2 23 L18 23',
 book:'M12 6 Q6 2 2 4 L2 20 Q7 18 12 22 Q17 18 22 20 L22 4 Q17 2 12 6 Z M12 6 L12 22 M5 8 L9 9 M15 9 L19 8',
});
// Small translucent patches hint at material without filters, bitmaps or SVG IDs.
// Every renderer consumes this same ordered list, including the final ink contour.
export function stickerSurfaceLayers(item,width=240,height=76){
 const visual=socialTagStyle(item),w=width,h=height,outline=stickerOutline(visual.shape,w,h);
 const layers=[{kind:'base',commands:outline,fill:visual.fill,opacity:1}];
 const patch=(kind,commands,fill,opacity)=>layers.push({kind,commands,fill,opacity});
 const bottom=visual.shape==='speech-note'?h-23:h-12;
 const leftInset=visual.shape==='record-note'?4:0;
 const left=[['M',14,15],['Q',24,9,35,11],['L',26,26],['Q',17,h*.5,29,bottom],['L',16,bottom-1],['Q',8,h*.5,14,15],['Z']].map(([op,...coordinates])=>[op,...coordinates.map((value,index)=>index%2===0?value+leftInset:value)]);
 const sheen=[['M',13,23],['Q',12,10,29,11],['L',24,15],['Q',17,15,16,22],['Z']];
 const washTop=visual.shape==='cat-note'?20:14;
 const wash=[['M',w*.22,washTop],['Q',w*.47,washTop-6,w*.69,washTop],['Q',w*.77,22,w*.71,h*.58],['Q',w*.47,h*.73,w*.22,h*.59],['Q',w*.17,h*.4,w*.22,washTop],['Z']];
 if(visual.material==='leaf')patch('leaf-wash',left,visual.outline,.08);
 if(visual.material==='paper')patch('paper-wash',wash,visual.outline,.025);
 if(visual.material==='clay'){
  patch('clay-wash',wash,'#bd8c44',.035);
  for(const[x,y]of [[.16,.29],[.35,.7],[.61,.25],[.82,.65]])patch('clay-grain',[['M',w*x,h*y],['L',w*x+1.3,h*y+.2],['L',w*x+.4,h*y+1.1],['Z']],visual.outline,.1);
 }
 if(visual.material==='satin'){
  patch('satin-wash',left,'#ffffff',.28);
  patch('satin-edge',[['M',12,24],['L',28,10],['L',35,10],['L',12,32],['Z']],'#ffffff',.5);
 }
 if(visual.material==='water'){
  patch('water-wash',left,'#43b6d7',.10);
  patch('water-light',wash,'#ffffff',.16);
 }
 if(visual.material==='ink'){
  patch('ink-wash',wash,'#ffffff',.025);
  patch('ink-edge',sheen,'#c0b9ff',.18);
 }
 if(visual.material==='enamel'){
  patch('enamel-wash',wash,'#ffffff',.025);
  patch('enamel-edge',sheen,'#fff9e8',.55);
 }
 if(visual.material==='glaze'){
  patch('glaze-wash',wash,visual.outline,.025);
  patch('glaze-edge',sheen,'#fff9e8',.65);
 }
 if(visual.material==='film'){
  patch('film-wash',left,'#ffffff',.16);
  patch('film-edge',sheen,'#ffffff',.48);
 }
 layers.push({kind:'outline',commands:outline,fill:'none',stroke:visual.outline,strokeWidth:1.8,opacity:1});
 return layers;
}
export function stickerSurfaceMarkup(item,width=240,height=76){
 const visual=socialTagStyle(item);
 const layers=stickerSurfaceLayers(item,width,height).map(layer=>`<path class="social-tag-${layer.kind}" d="${pathData(layer.commands)}" fill="${layer.fill}"${layer.stroke?` stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`:''}${layer.opacity===1?'':` opacity="${layer.opacity}"`}/>`).join('');
 return `<svg class="social-tag-surface" data-material="${visual.material}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">${layers}</svg>`;
}
export function paintStickerSurface(context,item,width=240,height=76){
 context.save();
 const alpha=context.globalAlpha;
 for(const layer of stickerSurfaceLayers(item,width,height)){
  context.globalAlpha=alpha*layer.opacity;traceCommands(context,layer.commands);
  if(layer.fill!=='none'){context.fillStyle=layer.fill;context.fill();}
  if(layer.stroke){context.strokeStyle=layer.stroke;context.lineWidth=layer.strokeWidth;context.lineJoin='round';context.lineCap='round';context.stroke();}
 }
 context.restore();
}
export function socialTagStickerMarkup(item,{action='',id='',selected=false,disabled=false,className=''}={}){
 const label=labelOf(item),style=socialTagStyle(item),tag=action?'button':'span';
 const attrs=action?` type="button" data-action="${esc(action)}"${id?` data-tag-id="${esc(id)}" data-id="${esc(id)}"`:''}${selected?' aria-pressed="true"':''}${disabled?' disabled':''}`:'';
 return `<${tag} class="social-tag-sticker social-tag-${style.category}${selected?' is-selected':''}${className?` ${esc(className)}`:''}"${attrs} title="${esc(label)}" style="--tag-ink:${style.ink};--tag-text-ink:${style.textInk};--tag-fill:${style.fill};--tag-outline:${style.outline}">${stickerSurfaceMarkup(item)}<svg class="social-tag-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${STICKER_ICONS[style.icon]}"/></svg><span class="social-tag-label">${esc(label)}</span></${tag}>`;
}
export function traceStickerIcon(context,icon){
 context.beginPath();
 for(const segment of STICKER_ICONS[icon].matchAll(/([MLQZ])([^MLQZ]*)/g)){
  const args=(segment[2].match(/-?[\d.]+/g)||[]).map(Number);
  if(segment[1]==='M')context.moveTo(...args);else if(segment[1]==='L')context.lineTo(...args);else if(segment[1]==='Q')context.quadraticCurveTo(...args);else context.closePath();
 }
}
