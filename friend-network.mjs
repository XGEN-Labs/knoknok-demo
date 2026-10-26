import { normalizeCardAvatar } from './card-labels.mjs?v=20261026-experience-41c';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const houses=Object.freeze({b:'wood',c:'water',d:'earth',e:'wood',f:'earth',g:'wood',h:'water',i:'earth'});
// Percentage centers within the safe-area stage. The closest house has room
// for a 144px body; seven smaller houses remain readable around it.
const positions=Object.freeze([
  [50,47], [17,16], [50,13], [83,18],
  [13,48], [87,50], [20,80], [80,82],
]);
const avatar=(value,name)=>{
  const source=normalizeCardAvatar(value);
  return source?`<img src="${esc(source)}" alt="" loading="eager">`:`<span class="network-initial">${esc(Array.from(String(name||'朋友'))[0])}</span>`;
};
export function friendNetworkSearchText(friend){return `${friend.name||''} ${(friend.interests||[]).join(' ')} ${friend.recent||''}`.toLocaleLowerCase();}

/** Pure view: the existing app owns filtering, visit actions and relationships. */
export function renderFriendNetwork({friends=[],users={},query='',ownName='你',ownAvatar=''}={}){
  const search=String(query).trim().toLocaleLowerCase();
  const sorted=[...friends].sort((a,b)=>(Number(b.closeness)||0)-(Number(a.closeness)||0)||(Number(a.closenessRank)||0)-(Number(b.closenessRank)||0)).slice(0,8);
  let visible=0;
  const paths=[],nodes=sorted.map((friend,index)=>{
    const [x,y]=positions[index],primary=index===0;
    const matches=!search||friendNetworkSearchText(friend).includes(search);if(matches)visible++;
    const kind=houses[friend.id]||['wood','water','earth'][index%3];
    const midpoint=x<50?25:x>50?75:50;
    paths.push(`<path class="${primary?'is-primary ':''}${friend.connected?'is-connected':''}" data-friend-id="${esc(friend.id)}" d="M50 94 C${midpoint} 86 ${x} ${Math.max(y+12,63)} ${x} ${y+6}" ${matches?'':'hidden'}/>`);
    return `<button type="button" class="network-friend${primary?' is-primary':''}" style="--node-x:${x}%;--node-y:${y}%" data-action="open-demo-friend" data-id="${esc(friend.id)}" data-search="${esc(friendNetworkSearchText(friend))}" data-closeness-rank="${index}" ${matches?'':'hidden'} aria-label="去 ${esc(friend.name)} 家坐坐${primary?'，最近常聊的朋友':''}"><span class="network-house" aria-hidden="true"><img src="assets/scenes-20261026-41/house-${kind}.webp" alt="" width="640" height="640" loading="eager" decoding="async"></span><span class="network-house-label"><span class="network-avatar" aria-hidden="true">${avatar(users[friend.id]?.cardAvatar,friend.initial||friend.name)}</span><strong>${esc(friend.name)}</strong></span><small class="network-visit-status">${friend.connected?'已經相連':'輕輕敲門'}</small></button>`;
  });
  return `<div class="relationship-network friend-house-network" role="group" aria-label="你與朋友的小屋"><svg class="network-connections" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${paths.join('')}</svg>${nodes.join('')}<div class="network-self" aria-label="${esc(ownName)}，你的位置"><span class="network-avatar" aria-hidden="true">${avatar(ownAvatar,ownName)}</span><span>你</span></div><p class="network-empty" ${visible?'hidden':''}>還沒有找到這段回響。<br>換個名字或話題試試。</p></div>`;
}
