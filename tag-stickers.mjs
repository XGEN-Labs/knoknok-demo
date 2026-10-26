// Four public tag families share one drawn outline in HTML and exported artwork.
// Classification is visual only: explicit metadata wins; no private profile is read.
export const SOCIAL_TAG_STYLES = Object.freeze({
 identity: Object.freeze({ category:'identity', name:'關於我', fill:'#e2d9f2', ink:'#66517c', shape:'plaque', icon:'spark' }),
 daily: Object.freeze({ category:'daily', name:'我的日常', fill:'#f7d68b', ink:'#765925', shape:'cloud', icon:'sun' }),
 skills: Object.freeze({ category:'skills', name:'技能與創作', fill:'#efb8a5', ink:'#834d3c', shape:'ticket', icon:'pencil' }),
 exploration: Object.freeze({ category:'exploration', name:'經歷與探索', fill:'#bbdce0', ink:'#406b70', shape:'flag', icon:'compass' }),
});
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const aliases={personal:'identity',personal_info:'identity',info:'identity',life:'daily',creation:'skills',skill:'skills',creative:'skills',experience:'exploration',experiences:'exploration',explore:'exploration'};
export function socialTagCategory(item) {
 const category=typeof item==='object'&&item?(aliases[item.category]||item.category):'';
 if(Object.hasOwn(SOCIAL_TAG_STYLES,category))return category;
 const text=typeof item==='object'&&item?String(item.label||item.text||''):String(item||'');
 if(/(?:\b[IE][NS][FT][JP]\b|星座|座$|大學|大学|學校|学校|專業|专业|職業|职业|工程師|工程师|經理|经理|甲木|乙木|丙火|丁火|戊土|己土|庚金|辛金|壬水|癸水)/i.test(text))return 'identity';
 if(/(?:學習|学习|正在學|正在学|初次|第一次|旅行|獨旅|独旅|探索|旅人|solo\s*trip|learning)/i.test(text))return 'exploration';
 if(/(?:攝影|摄影|膠片|胶片|吉他|創作|创作|畫畫|画画|繪畫|绘画|寫作|写作|手作|陶|coding|guitar|design|film|sketch)/i.test(text))return 'skills';
 return 'daily';
}
// Public words refine the badge, while the semantic category keeps its outline.
// These are recognisable motifs, never a random colour assignment or a new tag.
const TAG_MOTIFS=Object.freeze([
 {match:/(?:甲木|乙木)/,motif:'wood',icon:'sprout',fill:'#d9e7bd',ink:'#526d3b'},
 {match:/(?:丙火|丁火)/,motif:'fire',icon:'flame',fill:'#f5c4a1',ink:'#965334'},
 {match:/(?:戊土|己土)/,motif:'earth',icon:'mountain',fill:'#e9d2a2',ink:'#806333'},
 {match:/(?:庚金|辛金)/,motif:'metal',icon:'gem',fill:'#dce2e8',ink:'#586a7d'},
 {match:/(?:壬水|癸水)/,motif:'water',icon:'waves',fill:'#c3deea',ink:'#47748b'},
 {match:/(?:星座|白羊|牡羊|金牛|雙子|双子|巨蟹|獅子|狮子|處女|处女|天秤|天蠍|天蝎|射手|人馬|人马|摩羯|魔羯|水瓶|寶瓶|宝瓶|雙魚|双鱼)座?/,motif:'zodiac',icon:'constellation',fill:'#ded7f2',ink:'#6b588b'},
 {match:/\b[IE][NS][FT][JP](?:-[AT])?\b/i,motif:'personality',icon:'personality',fill:'#f0c9dc',ink:'#86566e'},
 {match:/(?:正在學|正在学|學習|学习|learning).*(?:語|语|文|language|french|english|japanese)|(?:語言|语言|polyglot)/i,motif:'language',icon:'language',fill:'#e1d8ef',ink:'#6a5b82'},
 {match:/(?:初次|第一次).*養貓|(?:初次|第一次).*养猫/,motif:'cat',icon:'cat',fill:'#efd0be',ink:'#855d49'},
 {match:/(?:貓|猫|cat(?:'s)?\b)/i,motif:'cat',icon:'cat',fill:'#efd0be',ink:'#855d49'},
 {match:/(?:爵士|音樂|音乐|jazz|music)/i,motif:'music',icon:'music',fill:'#f3d58d',ink:'#7a5f25'},
 {match:/(?:吉他|結他|结他|guitar)/i,motif:'guitar',icon:'guitar',fill:'#edbd9f',ink:'#845a3e'},
 {match:/(?:攝影|摄影|膠片|胶片|photo|film|camera)/i,motif:'camera',icon:'camera',fill:'#c9dcd4',ink:'#4f7163'},
 {match:/(?:旅行|獨旅|独旅|旅人|旅遊|旅游|solo\s*trip|travel)/i,motif:'travel',icon:'suitcase',fill:'#bcdedc',ink:'#427674'},
 {match:/(?:咖啡|coffee)/i,motif:'coffee',icon:'coffee',fill:'#e3ceb7',ink:'#785b42'},
 {match:/(?:閱讀|阅读|讀書|读书|book|read)/i,motif:'reading',icon:'book',fill:'#cadcb4',ink:'#5b7140'},
]);
export function socialTagStyle(item){
 const base=SOCIAL_TAG_STYLES[socialTagCategory(item)];
 const label=typeof item==='object'&&item?String(item.label||item.text||''):String(item||'');
 const variant=TAG_MOTIFS.find(({match})=>match.test(label));
 if(!variant)return base;
 const {match,...visual}=variant;
 return {...base,...visual};
}
export function stickerOutline(shape,width,height) {
 const w=width,h=height,r=Math.min(15,h*.24),m=h/2;
 if(shape==='ticket')return [['M',r,4],['Q',4,4,4,r],['L',4,m-8],['Q',16,m,4,m+8],['L',4,h-r],['Q',4,h-4,r,h-4],['L',w-r,h-4],['Q',w-4,h-4,w-4,h-r],['L',w-4,m+8],['Q',w-16,m,w-4,m-8],['L',w-4,r],['Q',w-4,4,w-r,4],['Z']];
 if(shape==='flag')return [['M',r+8,4],['Q',w*.5,2,w-r,5],['Q',w-4,6,w-5,r],['L',w-9,h-r],['Q',w-10,h-4,w-r-8,h-4],['L',r,h-3],['Q',4,h-4,5,h-r],['L',9,r],['Q',10,4,r+8,4],['Z']];
 if(shape==='cloud')return [['M',25,7],['Q',w*.25,1,w*.44,5],['Q',w*.62,0,w*.77,6],['Q',w-7,1,w-6,20],['Q',w+1,m,w-7,h-18],['Q',w-6,h-2,w-25,h-5],['Q',w*.65,h+1,w*.5,h-4],['Q',w*.27,h+1,24,h-5],['Q',6,h,7,h-20],['Q',0,m,7,19],['Q',5,3,25,7],['Z']];
 return [['M',r,5],['Q',w*.5,0,w-r,5],['Q',w-3,6,w-4,r],['L',w-6,h-r],['Q',w-5,h-4,w-r,h-4],['Q',w*.5,h+1,r,h-4],['Q',4,h-4,5,h-r],['L',4,r],['Q',5,5,r,5],['Z']];
}
export const stickerPath=(shape,width,height)=>stickerOutline(shape,width,height).map(([op,...args])=>`${op}${args.map(n=>Math.round(n*100)/100).join(' ')}`).join(' ');
export function traceSticker(context,shape,width,height){
 context.beginPath();
 for(const [op,...args] of stickerOutline(shape,width,height)) {
  if(op==='M')context.moveTo(...args);else if(op==='L')context.lineTo(...args);else if(op==='Q')context.quadraticCurveTo(...args);else context.closePath();
 }
}
export const STICKER_ICONS=Object.freeze({
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
 language:'M2 4 Q8 2 14 4 L14 13 L8 13 L4 17 L4 13 L2 13 Z M17 8 L22 8 L22 20 L20 20 L20 23 L16 20 L10 20 L10 16 M5 7 L11 7 M8 6 L8 8 M6 8 L10 11 M10 8 L6 11 M17 12 L15 17 M17 12 L19 17 M16 15 L18 15',
 coffee:'M3 7 L16 7 L16 15 Q16 21 10 21 Q3 21 3 15 Z M16 9 Q23 8 22 13 Q21 17 16 16 M7 2 L7 4 M12 1 L12 4 M2 23 L18 23',
 book:'M12 6 Q6 2 2 4 L2 20 Q7 18 12 22 Q17 18 22 20 L22 4 Q17 2 12 6 Z M12 6 L12 22 M5 8 L9 9 M15 9 L19 8',
});
export function stickerSurfaceMarkup(item,width=240,height=76) {
 const style=socialTagStyle(item);
 return `<svg class="social-tag-surface" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><path d="${stickerPath(style.shape,width,height)}" fill="${style.fill}" stroke="${style.ink}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
export function socialTagStickerMarkup(item,{action='',id='',selected=false,disabled=false,className=''}={}) {
 const label=typeof item==='object'&&item?String(item.label||item.text||''):String(item||'');
 const style=socialTagStyle(item),tag=action?'button':'span';
 const attrs=action?` type="button" data-action="${esc(action)}"${id?` data-tag-id="${esc(id)}" data-id="${esc(id)}"`:''}${selected?' aria-pressed="true"':''}${disabled?' disabled':''}`:'';
 return `<${tag} class="social-tag-sticker social-tag-${style.category}${selected?' is-selected':''}${className?` ${esc(className)}`:''}"${attrs} title="${esc(label)}" style="--tag-ink:${style.ink};--tag-fill:${style.fill}">${stickerSurfaceMarkup(item)}<svg class="social-tag-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${STICKER_ICONS[style.icon]}"/></svg><span class="social-tag-label">${esc(label)}</span></${tag}>`;
}

export function traceStickerIcon(context,icon) {
 context.beginPath();
 for(const segment of STICKER_ICONS[icon].matchAll(/([MLQZ])([^MLQZ]*)/g)){
  const args=(segment[2].match(/-?[\d.]+/g)||[]).map(Number);
  if(segment[1]==='M')context.moveTo(...args);else if(segment[1]==='L')context.lineTo(...args);else if(segment[1]==='Q')context.quadraticCurveTo(...args);else context.closePath();
 }
}
