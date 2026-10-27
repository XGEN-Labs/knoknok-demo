import { friendAvatarSource } from './friend-avatars.mjs?v=20261026-social-tags-45';
import { loadingIndicatorMarkup } from './loading-state.mjs';
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
  const kind=doors[friend.id]||['wood','water','earth'][index%3],avatar=friendAvatarSource(friend,users[friend.id]);
  return `<button type="button" class="network-friend${primary?' is-primary':''} is-${kind}" data-action="open-demo-friend" data-id="${esc(friend.id)}" data-search="${esc(friendNetworkSearchText(friend))}" data-closeness-rank="${index}" data-world-lon="${lon}" data-world-lat="${lat}" ${matches?'':'hidden'} aria-label="敲敲 ${esc(friend.name)} 的門${primary?'，最近常聊的朋友':''}"><span class="world-contact-avatar" aria-hidden="true"><span class="world-avatar-fallback">${esc(friend.initial||friend.name?.slice(0,1)||'友')}</span>${avatar?`<img src="${esc(avatar)}" alt="" draggable="false" decoding="async">`:''}</span><span class="network-house" aria-hidden="true"><img src="assets/friend-realm-20261027-49/house-${kind}.svg" alt="" draggable="false"></span><span class="network-house-label"><strong>${esc(friend.name)}</strong></span></button>`;
 });
 return `<div class="relationship-network friend-house-network spirit-world" data-world-filtered="${!!search}" data-world-state="loading" aria-busy="true" role="group" aria-label="精靈小星球"><div class="world-viewport" tabindex="0" role="group" aria-label="拖動、滾動或使用方向鍵旋轉精靈小星球"><div class="world-shadow" aria-hidden="true"></div><div class="world-fallback" aria-hidden="true"></div><canvas class="world-canvas" aria-hidden="true"></canvas><div class="world-rooms">${nodes.join('')}</div></div><div class="world-loading" hidden>${loadingIndicatorMarkup('正在點亮朋友的小星球…')}</div><p class="network-empty" ${visible?'hidden':''}>還沒有找到這段回響。<br>換個名字或話題試試。</p></div>`;
}
