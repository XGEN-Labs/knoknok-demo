import { normalizeCardAvatar } from './card-labels.mjs';
import { uiIcon } from './ui-icons.mjs?v=20261026-experience-42';
import { WORLD_ANCHORS } from './friend-world-math.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const doors=Object.freeze({b:'wood',c:'water',d:'earth',e:'wood',f:'earth',g:'wood',h:'water',i:'earth'});
export function friendNetworkSearchText(friend){return `${friend.name||''} ${(friend.interests||[]).join(' ')} ${friend.recent||''}`.toLocaleLowerCase();}
export function renderFriendNetwork({friends=[],users={},query=''}={}){
 const search=String(query).trim().toLocaleLowerCase();
 const sorted=[...friends].sort((a,b)=>(Number(b.closeness)||0)-(Number(a.closeness)||0)||(Number(a.closenessRank)||0)-(Number(b.closenessRank)||0)).slice(0,8);
 let visible=0;
 const nodes=sorted.map((friend,index)=>{
  const [lon,lat]=WORLD_ANCHORS[index],primary=index===0;
  const matches=!search||friendNetworkSearchText(friend).includes(search);if(matches)visible++;
  const kind=doors[friend.id]||['wood','water','earth'][index%3],avatar=normalizeCardAvatar(users[friend.id]?.cardAvatar);
  return `<button type="button" class="network-friend${primary?' is-primary':''} is-${kind}" data-action="open-demo-friend" data-id="${esc(friend.id)}" data-search="${esc(friendNetworkSearchText(friend))}" data-closeness-rank="${index}" data-world-lon="${lon}" data-world-lat="${lat}" ${matches?'':'hidden'} aria-label="敲敲 ${esc(friend.name)} 的門${primary?'，最近常聊的朋友':''}"><span class="world-contact-avatar" aria-hidden="true">${avatar?`<img src="${esc(avatar)}" alt="" draggable="false">`:esc(friend.initial||friend.name?.slice(0,1)||'友')}</span><span class="network-house" aria-hidden="true"><img src="assets/scenes-20261026-41/house-${kind}.webp" alt="" draggable="false"></span><span class="network-house-label"><strong>${esc(friend.name)}</strong></span></button>`;
 });
 return `<div class="relationship-network friend-house-network spirit-world" data-world-filtered="${!!search}" role="group" aria-label="精靈小星球"><div class="world-viewport" tabindex="0" role="group" aria-label="拖動或使用方向鍵旋轉精靈小星球"><div class="world-shadow" aria-hidden="true"></div><div class="world-fallback" aria-hidden="true"></div><canvas class="world-canvas" aria-hidden="true"></canvas><div class="world-rooms">${nodes.join('')}</div></div><div class="world-navigation"><button type="button" data-world-turn="-1" aria-label="向左轉動小星球">${uiIcon('back')}</button><span>轉動小星球，敲敲朋友的門</span><button type="button" data-world-turn="1" aria-label="向右轉動小星球">${uiIcon('back')}</button></div><p class="network-empty" ${visible?'hidden':''}>還沒有找到這段回響。<br>換個名字或話題試試。</p></div>`;
}
