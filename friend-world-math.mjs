export const WORLD_ANCHORS = Object.freeze([[0,-4],[-46,42],[0,61],[46,42],[-65,-4],[65,-4],[-36,-49],[36,-49]]);
export const clampPitch = value => Math.max(-.64,Math.min(.64,value));
export function globePoint(longitude,latitude,yaw=0,pitch=0){
 const lon=longitude*Math.PI/180,lat=latitude*Math.PI/180;
 const x=Math.cos(lat)*Math.sin(lon),y=Math.sin(lat),z=Math.cos(lat)*Math.cos(lon);
 const xx=x*Math.cos(yaw)+z*Math.sin(yaw),zz=-x*Math.sin(yaw)+z*Math.cos(yaw);
 return {x:xx,y:y*Math.cos(pitch)-zz*Math.sin(pitch),z:y*Math.sin(pitch)+zz*Math.cos(pitch)};
}
export function worldMetrics(width,height){return {radius:Math.min(width*.44,height*.33),cx:width/2,cy:height*.54};}
export function dragRotation({yaw=0,pitch=0},dx,dy){return {yaw:yaw+dx*.008,pitch:clampPitch(pitch+dy*.006)};}
export function shouldSuppressKnock(dx,dy){return Math.hypot(dx,dy)>6;}
