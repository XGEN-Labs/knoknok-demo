import { resolveCardDesign } from './card-design.mjs?v=20261023-card-36h';
export const CARD_WIDTH=900, CARD_HEIGHT=560;
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
// One front only. Each composition follows a different supplied print reference.
// The same print coordinates drive the responsive DOM and downloadable PNG.
export function cardArtwork(data){
 const d=resolveCardDesign(data),l=d.layout,items=[],ink=d.ink,paper=d.paper,height=[560,510,560,500,540,560][l];
 const logo=(x,y,w,color=ink,rotate=0)=>items.push({type:'logo',x,y,w,h:w/3,color,rotate});
 const backgrounds=[null,null,'assets/business-card-20261023-v2/pet-paper.png','assets/business-card-20261023-v2/blue-paw.png','assets/business-card-20261023-v2/portrait-paper.png','assets/business-card-20261023-v2/creatures-paper.png'];
 if(backgrounds[l])items.push({type:'image',x:0,y:0,w:900,h:height,src:backgrounds[l],fit:'cover'});
 const txt=(kind,text,x,y,w,h,size,{weight=400,family='sans',color=ink,italic=false,align='left',rotate=0,maxLines=2}={})=>{
  if(!text)return;
  let actual=size;
  if(kind==='name')while(actual>30){const count=linesFor(text,actual,w,40,weight,family).length;if(count<=maxLines&&actual*1.1*count<=h)break;actual-=2;}
  items.push({type:'text',kind,text,lines:linesFor(text,actual,w,maxLines,weight,family),x,y,w,h,size:actual,weight,family,color,italic,align,rotate,lineHeight:1.1});
 };
 let portrait;
 const identity=(text,x,y,w,h,size,options={})=>{
  const portraitSize=l===1?144:120,gap=24;
  txt('name',text,x+portraitSize+gap,y,w-portraitSize-gap,h,size,{...options,align:'left'});
  const name=items.at(-1),textHeight=name.lines.length*name.size*name.lineHeight;
  name.h=textHeight;
  let portraitX=x;
  if(l===5){
   const textWidth=Math.min(name.w,Math.max(...name.lines.map(line=>measured(line,name.size,name.weight,name.family)))+2);
   portraitX=x+(w-portraitSize-gap-textWidth)/2;
   name.x=portraitX+portraitSize+gap;name.w=textWidth;
  }
  const portraitY=l===5?Math.max(24,name.y+(textHeight-portraitSize)/2):name.y;
  if(l===5)name.y=portraitY+(portraitSize-textHeight)/2;
  portrait={type:'avatar',x:portraitX,y:portraitY,w:portraitSize,h:portraitSize,src:data.avatar||DEFAULT_CARD_AVATAR,custom:!!data.avatar,fit:data.avatar?'cover':'contain',fill:data.avatar?'transparent':'#e8e7df',pad:data.avatar?0:9};
 };
 const meta=[data.region,data.language].filter(Boolean).join(' · ');
 const tags=(x,y,w,h,size,{columns=2,family='sans',weight=600,color=ink,fill='transparent',stroke='transparent',radius=0,tilt=false,padX=0,padY=0,align='left'}={})=>{
  const count=data.tags.length;if(!count)return;
  const cols=Math.min(columns,count),rows=Math.ceil(count/cols),gapX=24,gapY=6;
  const cell=(w-gapX*(cols-1))/cols,height=Math.min(Math.ceil(size*1.24+padY*2),(h-gapY*(rows-1))/rows);
  data.tags.forEach((tag,i)=>{
   const col=i%cols,row=Math.floor(i/cols);
   const width=fill==='transparent'&&stroke==='transparent'?cell:Math.min(cell,measured(tag,size,weight,family)+padX*2+10);
   items.push({type:'tag',align,text:tag,label:fit(tag,size,width-padX*2-7,weight,family),x:x+col*(cell+gapX),y:y+row*(height+gapY),w:width,h:height,size,weight,family,fill,color,stroke,r:radius,rotate:tilt?[-2,1,-1,2][i%4]:0,padX,padY});
  });
 };
 if(l===0){
  // Selected reference 01: name upper-left, compact information lower-left,
  // a large vertical wordmark on the right, all on uninterrupted chartreuse.
  identity(data.name.replace(/\s+/, '\n'),60,44,585,166,72,{weight:600,maxLines:2});
  txt('bio',data.bio,62,206,590,62,29,{maxLines:2});
  txt('wordmark','Knoknok',526,216,490,129,110,{weight:700,rotate:-90,maxLines:1});
  tags(61,346,584,160,36,{columns:data.tags.length>6?3:data.tags.length>3?2:1,weight:550});
  txt('meta',meta,62,517,590,29,24,{maxLines:1});
 }else if(l===1){
  // Selected reference 02: shared column edges and aligned header/body/footer rows.
  const left=50,right=587,bodyTop=219,footerTop=450;
  // Compensate the original wordmark's transparent padding, preserving its bytes.
  logo(left-15,60,105);txt('meta','Knoknok',right,64,263,30,23,{maxLines:1});
  identity(data.name.replace(/\s+/, '\n'),left,bodyTop,471,190,88,{weight:400,maxLines:2});
  txt('bio',data.bio,left,footerTop,471,30,23,{maxLines:1});
  // Small optical offset aligns the smaller tag letters with the large name.
  tags(right,bodyTop+5,263,194,35,{columns:data.tags.length>4?2:1,weight:400});
  txt('meta',meta,right,footerTop,263,30,23,{maxLines:1});
 }else if(l===2){
  // Selected reference 03: modest sans name, full pale pattern, stamp and Klin line art.
  identity(data.name,94,67,555,71,58,{weight:650,maxLines:1});
  txt('bio',data.bio,238,142,411,63,26,{maxLines:2});
  tags(105,255,536,222,39,{columns:data.tags.length>4?2:1,weight:550});
  txt('meta',meta,105,494,536,30,26,{maxLines:1});txt('wordmark','Knoknok',675,115,145,58,42,{family:'hand',weight:700,align:'center',maxLines:1});
 }else if(l===3){
  // Selected reference 04: three small icons, centered information, right-edge arm.
  identity(data.name,190,160,550,62,48,{weight:500,maxLines:1});
  txt('bio',data.bio,334,224,406,30,25,{maxLines:1});
  tags(155,data.tags.length>3?306:330,590,138,35,{columns:3,weight:500,align:'center'});
  txt('meta',meta,70,459,760,28,25,{align:'center',maxLines:1});
 }else if(l===4){
  // Selected reference 05: name left, small Klin upper-right, ruled information columns.
  identity(data.name,62,61,617,75,43,{weight:400,maxLines:1});
  txt('bio',data.bio,206,124,473,62,26,{maxLines:2});
  items.push({type:'rect',x:441,y:219,w:1.7,h:254,fill:ink,r:0});
  tags(484,228,348,245,38,{columns:data.tags.length>4?2:1,weight:400});
  txt('meta',meta,62,447,346,32,26,{maxLines:1});logo(62,486,137);
 }else{
  // Selected reference 06: centered serif name above a cropped Klin illustration band.
  identity(data.name,68,65,764,91,65,{family:'serif',weight:600,align:'center',maxLines:1});
  txt('bio',data.bio,201,180,498,28,25,{align:'center',maxLines:1});
  tags(117,224,666,110,36,{columns:4,weight:400,align:'center'});
  txt('meta',meta,232,338,436,25,21,{align:'center',maxLines:1});
 }
 // Every design reserves a readable profile portrait, separately from Klin artwork.
 items.push(portrait);
 return {width:CARD_WIDTH,height,paper,ink,layout:l,items};
}
