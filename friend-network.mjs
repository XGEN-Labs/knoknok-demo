const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const doors=Object.freeze({b:'wood',c:'water',d:'earth',e:'wood',f:'earth',g:'wood',h:'water',i:'earth'});
// A larger nearby door and seven smaller entrances express closeness without
// inventing links between people or placing the viewer in the neighbourhood.
const positions=Object.freeze([
  [50,47], [17,16], [50,13], [83,18],
  [13,48], [87,50], [20,80], [80,82],
]);
const door=kind=>`<svg class="network-door is-${kind}" viewBox="0 0 100 120" aria-hidden="true" focusable="false"><path class="door-surround" d="M21 109 L21.5 51 C21.4 30 32 16.5 49.5 16 C67 15.5 79 30 78.8 50 L79 109 Q50 111 21 109 Z"/><path class="door-opening" d="M32 108 L32.4 53 C32.3 38 39 28 50 28.5 C61.8 28.4 68 38.3 67.7 53 L68 108"/><path class="door-sill" d="M20 110 Q49 112 80 110"/><path class="door-knob" d="M59 76.5 Q61.5 75 62 77.5 Q62.2 80 59.5 79.5 Q57.8 79 59 76.5 Z"/></svg>`;
export function friendNetworkSearchText(friend){return `${friend.name||''} ${(friend.interests||[]).join(' ')} ${friend.recent||''}`.toLocaleLowerCase();}

/** Pure view: the existing app owns filtering, visit actions and relationships. */
export function renderFriendNetwork({friends=[],query=''}={}){
  const search=String(query).trim().toLocaleLowerCase();
  const sorted=[...friends].sort((a,b)=>(Number(b.closeness)||0)-(Number(a.closeness)||0)||(Number(a.closenessRank)||0)-(Number(b.closenessRank)||0)).slice(0,8);
  let visible=0;
  const nodes=sorted.map((friend,index)=>{
    const [x,y]=positions[index],primary=index===0;
    const matches=!search||friendNetworkSearchText(friend).includes(search);if(matches)visible++;
    const kind=doors[friend.id]||['wood','water','earth'][index%3];
    return `<button type="button" class="network-friend${primary?' is-primary':''}" style="--node-x:${x}%;--node-y:${y}%" data-action="open-demo-friend" data-id="${esc(friend.id)}" data-search="${esc(friendNetworkSearchText(friend))}" data-closeness-rank="${index}" ${matches?'':'hidden'} aria-label="去 ${esc(friend.name)} 家坐坐${primary?'，最近常聊的朋友':''}"><span class="network-house" aria-hidden="true">${door(kind)}</span><span class="network-house-label"><strong>${esc(friend.name)}</strong></span></button>`;
  });
  return `<div class="relationship-network friend-house-network" role="group" aria-label="朋友的門口">${nodes.join('')}<p class="network-empty" ${visible?'hidden':''}>還沒有找到這段回響。<br>換個名字或話題試試。</p></div>`;
}
