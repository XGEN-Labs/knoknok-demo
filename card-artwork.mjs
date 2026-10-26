import { resolveCardDesign } from './card-design.mjs?v=20261026-experience-42';
export const CARD_WIDTH=600, CARD_HEIGHT=840;
export const DEFAULT_CARD_AVATAR = 'assets/klin-20261014/adult.png';
export const CARD_FONTS={
 sans:'Helvetica Neue,PingFang TC,PingFang SC,Arial,sans-serif',
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
 for(const char of Array.from(text)){if(char==='\n'||(line&&measured(line+char,size,weight,family)>width)){lines.push(line.trim());line=char==='\n'?'':char;}else line+=char;}
 if(line)lines.push(line.trim());
 if(lines.length>maxLines){lines.length=maxLines;lines[maxLines-1]=fit(lines[maxLines-1]+'…',size,width,weight,family);}
 return lines;
}
// One gentle portrait, shared by the browser, shared links and PNG export.
// The original six print directions remain archived as process history.
export function cardArtwork(data){
 const d=resolveCardDesign(data),items=[],ink=d.ink,paper=d.paper;
 const txt=(kind,text,x,y,w,h,size,{weight=400,family='sans',color=ink,align='center',maxLines=2,lineHeight=1.3}={})=>{
  if(!text)return;
  let actual=size;
  if(kind==='name')while(actual>24){
   const count=linesFor(text,actual,w,40,weight,family).length;
   if(count<=maxLines&&actual*lineHeight*count<=h)break;
   actual-=2;
  }
  const lines=linesFor(text,actual,w,maxLines,weight,family);
  items.push({type:'text',kind,text,lines,x,y,w,h,size:actual,weight,family,color,align,lineHeight});
 };
 items.push({type:'logo',x:196,y:40,w:208,h:208/3,color:'#657067'});
 items.push({type:'rect',x:198,y:124,w:204,h:204,fill:'#e9ede3',r:102});
 items.push({type:'avatar',x:210,y:136,w:180,h:180,src:data.avatar||DEFAULT_CARD_AVATAR,custom:!!data.avatar,fit:data.avatar?'cover':'contain',fill:data.avatar?'transparent':'#f3f1e9',pad:data.avatar?0:12});
 txt('name',data.name,56,351,488,88,46,{weight:600,family:'serif',maxLines:2,lineHeight:1.12});
 txt('bio',data.bio,60,450,480,79,25,{color:'#727680',maxLines:2,lineHeight:1.45});
 items.push({type:'rect',x:230,y:553,w:140,h:1.5,fill:'#d9ddcf',r:0});
 // Center whole rows; 7 maximum-width labels still fit in four rows.
 // Ellipsized labels retain their complete text as a title and accessible action.
 const size=25,padX=19,padY=10,gap=12,height=48,rows=[[]];
 for(const text of data.tags){
  const width=Math.max(76,Math.min(234,measured(text,size,400,'sans')+padX*2+4));
  let row=rows.at(-1);
  if(row.length&&row.reduce((n,tag)=>n+tag.w,0)+gap*row.length+width>488){row=[];rows.push(row);}
  row.push({type:'tag',text,label:fit(text,size,width-padX*2,400,'sans'),w:width,h:height,size,weight:400,family:'sans',align:'center',color:'#657065',fill:'#edf0e6',stroke:'transparent',r:24,padX,padY});
 }
 rows.forEach((row,ri)=>{
  let x=(CARD_WIDTH-row.reduce((n,tag)=>n+tag.w,0)-gap*Math.max(0,row.length-1))/2;
  row.forEach(tag=>{items.push({...tag,x,y:566+ri*56});x+=tag.w+gap;});
 });
 txt('meta',[data.region,data.language].filter(Boolean).join(' · '),56,794,488,30,21,{color:'#8a8d94',maxLines:1});
 return {width:CARD_WIDTH,height:CARD_HEIGHT,paper,ink,layout:0,radius:32,items};
}
