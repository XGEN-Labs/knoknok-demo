// Only alpha artwork travels. Room pixels are never put on the moving layer.
import {chatHeaderAvatar} from './chat-header-avatar.mjs?v=20261101-avatar-flight-v06g';
const bounds={metal:[111,106,1147,1133],wood:[144,128,494,548],water:[135,185,505,548],fire:[152,104,488,548],earth:[135,195,504,548]};
export function chatTravelAvatar(element){
 const family=Object.hasOwn(bounds,element)?element:'metal',portrait=chatHeaderAvatar(family);
 // The original Klin header displays a 1254px image inside 3px padding on
 // each side of a 36px slot. This virtual crop matches that endpoint exactly.
 return {...portrait,...(!portrait.crop?{width:1254,height:1254,crop:{x:-125.4,y:-125.4,width:1504.8,height:1504.8}}:{}),alpha:true,bounds:bounds[family]};
}
export function chatTravelRoomFrame(frame,element){
 if(!frame||!['x','y','width','height'].every(key=>Number.isFinite(frame[key]))||frame.width<=0||frame.height<=0)return null;
 const {crop,bounds:[x0,y0,x1,y1]}=chatTravelAvatar(element),scale=Math.min(frame.width/(x1-x0),frame.height/(y1-y0));
 return {x:frame.x+frame.width/2-((x0+x1)/2-crop.x)*scale,y:frame.y+frame.height/2-((y0+y1)/2-crop.y)*scale,width:crop.width*scale,height:crop.height*scale};
}
