import { resolveCardDesign } from './card-design.mjs?v=20261026-experience-42';
import { socialTagStyle } from './tag-stickers.mjs?v=20261027-tags-50';
export const CARD_WIDTH=600, CARD_HEIGHT=650, CARD_BOTTOM_PADDING=32;
export const CARD_PAPER_TEXTURE='assets/card-paper-20261027/ivory-cotton.jpg';
export const CARD_PAPER_OPACITY=.92;
export const CARD_PAPER_SCALE=1.4;
const CARD_DETAIL_INK='#5d4033';
export const DEFAULT_CARD_AVATAR = 'assets/klin-20261014/adult.png';
export const CARD_FONTS={
 sans:'Helvetica Neue,PingFang TC,PingFang SC,Arial,sans-serif',
 name:'Klin Paper Serif,serif',
 serif:'Georgia,Klin Paper Serif,Songti TC,serif',
 round:'Card Puff,Card WenKai,Arial,sans-serif',
 hand:'Card Hand,Card WenKai,cursive',
 brush:'Card Brush,Card WenKai,cursive'
};
const units=text=>Array.from(text).reduce((n,c)=>n+(/[^\u0000-\u024f]/.test(c)?1:/[MW@]/.test(c)?.86:/[il .\x27!]/.test(c)?.3:.56),0);
let measuringContext;
const measured=(text,size,weight=650,family='sans')=>{
 if(typeof document!=='undefined'){measuringContext ||= document.createElement('canvas').getContext('2d');if(measuringContext){measuringContext.font=`${weight} ${size}px ${CARD_FONTS[family]}`;return measuringContext.measureText(text).width;}}
 return units(text)*size;
};
const fit=(text,size,width,weight=650,family='sans')=>{let out=text;while(out&&measured(out,size,weight,family)>width)out=Array.from(out).slice(0,-1).join('');if(out===text)return out;while(out&&measured(out+'…',size,weight,family)>width)out=Array.from(out).slice(0,-1).join('');return out+'…';};
function linesFor(text,size,width,maxLines,weight,family){
 const lines=[];let line='';
 const tokens=String(text).match(/\n|[A-Za-z0-9]+(?:['’.-][A-Za-z0-9]+)*|[^\S\n]+|[^\s]/gu)||[];
 for(const token of tokens){
  if(token==='\n'){lines.push(line.trim());line='';continue;}
  if(line&&measured(line+token,size,weight,family)>width){lines.push(line.trim());line='';}
  if(measured(token,size,weight,family)>width){
   for(const char of Array.from(token)){if(line&&measured(line+char,size,weight,family)>width){lines.push(line.trim());line='';}line+=char;}
  }else line+=line?token:token.trimStart();
 }
 if(line.trim())lines.push(line.trim());
 // Avoid a detached closing mark or a one-character tail under a full sentence.
 if(lines.length>1&&units(lines.at(-1))<3){
  const previous=lines.at(-2),tail=lines.at(-1),breakAt=Math.max(previous.lastIndexOf('，'),previous.lastIndexOf('、'),previous.lastIndexOf('；'));
  const split=breakAt>=4?breakAt+1:previous.length-1;
  const remainder=previous.slice(split)+tail;
  if(split>0&&measured(remainder,size,weight,family)<=width){lines[lines.length-2]=previous.slice(0,split).trim();lines[lines.length-1]=remainder.trim();}
 }
 if(lines.length>maxLines){lines.length=maxLines;lines[maxLines-1]=fit(lines[maxLines-1]+'…',size,width,weight,family);}
 return lines;
}
// A compact collectible portrait. Content determines its height; all surfaces use
// this exact geometry, including wrapped sticker text and its drawn silhouette.
export function cardArtwork(data){
 const d=resolveCardDesign(data),items=[],ink=d.ink,paper=d.paper;
 const txt=(kind,text,x,y,w,h,size,{weight=400,family='sans',color=ink,align='left',maxLines=2,lineHeight=1.3}={})=>{
  if(!text)return;
  let actual=size;
  if(kind==='name')while(actual>28){
   const count=linesFor(text,actual,w,40,weight,family).length;
   if(count<=maxLines&&actual*lineHeight*count<=h)break;
   actual-=2;
  }
  const lines=linesFor(text,actual,w,maxLines,weight,family);
  items.push({type:'text',kind,text,lines,x,y,w,h,size:actual,weight,family,color,align,lineHeight});
 };
 const tags=Array.isArray(data.tags)?data.tags:[],sparse=tags.length===0;
 const portrait=sparse?{x:210,y:108,w:180,h:180}:{x:52,y:118,w:152,h:152};
 const contentLeft=portrait.x-8,contentWidth=Math.min(492,CARD_WIDTH-contentLeft-44);
 // Align visible logo ink, biography and sticker rows with the avatar ring.
 // The selected 2172px PNG's alpha>=32 ink starts at x76; its size stays unchanged.
 const logoScale=1646/2045,logoWidth=184*logoScale;
 items.push({type:'logo',x:contentLeft-logoWidth*76/2172,y:24+(184/3)*(371.5-363.5*logoScale)/724,w:logoWidth,h:logoWidth/3,color:CARD_DETAIL_INK});
 items.push({type:'rect',x:portrait.x-8,y:portrait.y-8,w:portrait.w+16,h:portrait.h+16,fill:'#e5eace',r:portrait.w/2+8});
 items.push({type:'avatar',...portrait,src:data.avatar||DEFAULT_CARD_AVATAR,custom:!!data.avatar,fit:data.avatar?'cover':'contain',fill:data.avatar?'transparent':'#f4f1e7',pad:data.avatar?0:10});
 txt('name',data.name,sparse?54:230,sparse?316:136,sparse?492:318,sparse?92:116,48,{weight:500,family:'name',align:sparse?'center':'left',maxLines:2,lineHeight:1.2});
 const nameItem=items.find(item=>item.kind==='name');
 const nameBottom=nameItem?nameItem.y+nameItem.lines.length*nameItem.size*nameItem.lineHeight:(sparse?408:252);
 // Region and language belong to the identity block, directly below the name.
 // Measure their actual height so long names and bilingual metadata never collide.
 const meta=[data.region,data.language].filter(Boolean).join(' · ');
 txt('meta',meta,sparse?60:230,nameBottom+12,sparse?480:318,58,22,{family:'hand',color:'#737568',align:sparse?'center':'left',maxLines:2,lineHeight:1.25});
 const metaItem=items.find(item=>item.kind==='meta');
 const identityBottom=metaItem?metaItem.y+metaItem.lines.length*metaItem.size*metaItem.lineHeight:nameBottom;
 const bio=String(data.bio||'').trim();
 const bioY=Math.max(sparse?430:306,identityBottom+24);
 txt('bio',bio,contentLeft,bioY,contentWidth,sparse?104:78,sparse?27:28,{color:CARD_DETAIL_INK,align:'left',maxLines:sparse?3:2,lineHeight:sparse?1.32:1.35});
 const rows=[[]],gap=14,size=30,padX=20,padY=21,iconSize=32,iconSpace=42;
 for(const entry of tags){
  const text=typeof entry==='string'?entry:entry.label||entry.text||'';
  const tagData={label:text,category:typeof entry==='object'?entry.category:data.tagCategories?.[text]};
  const visual=socialTagStyle(tagData),natural=measured(text,size,400,'hand')+padX*2+iconSpace;
  const width=Math.max(142,Math.min(492,Math.ceil(natural)+1));
  const lines=linesFor(text,size,width-padX*2-iconSpace,10,400,'hand');
  const height=Math.max(86,lines.length*size*1.14+padY*2);
  let row=rows.at(-1);
  if(row.length&&row.reduce((n,tag)=>n+tag.w,0)+gap*row.length+width>492){row=[];rows.push(row);}
  row.push({type:'tag',text,label:text,lines,w:width,h:height,size,weight:400,family:'hand',align:'left',color:visual.ink,fill:visual.fill,stroke:visual.outline||visual.ink,shape:visual.shape,icon:visual.icon,category:visual.category,r:0,padX,padY,iconSize,iconSpace,lineHeight:1.14});
 }
 // An omitted introduction has no reserved text block. Keep a clear gap after
 // whichever identity element extends lowest, including a wrapped name or city.
 let tagY=bio?bioY+104:Math.max(portrait.y+portrait.h+8,identityBottom)+32;
 rows.forEach(row=>{
  let x=contentLeft;
  const height=Math.max(0,...row.map(tag=>tag.h));
  row.forEach(tag=>{items.push({...tag,x,y:tagY+(height-tag.h)/2});x+=tag.w+gap;});
  if(row.length)tagY+=height+14;
 });
 // Text boxes reserve room for wrapping, but empty lines are not printed content.
 // Trim after the last visible line or sticker; the same height drives DOM and PNG.
 const contentBottom=Math.max(...items.map(item=>item.y+(item.type==='text'?item.lines.length*item.size*item.lineHeight:item.h)));
 const height=Math.ceil(contentBottom+CARD_BOTTOM_PADDING);
 return {width:CARD_WIDTH,height,paper,ink,paperTexture:CARD_PAPER_TEXTURE,paperOpacity:CARD_PAPER_OPACITY,paperScale:CARD_PAPER_SCALE,layout:0,radius:32,items};
}
