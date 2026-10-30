import { characterArt } from './element-character-art.mjs?v=20261031-product-sync';
import { ELEMENT_COMPANIONS } from './companion-elements.mjs?v=20261031-product-sync';
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
/** Each seat uses its participant's saved identity. Captions are intentionally
 * absent; screen readers still identify the owner and companion. */
export function sharedAgentsMarkup(participants=[],activeId) {
 const people=participants.filter(person=>person?.id).slice(0,2).sort((a,b)=>Number(b.id===activeId)-Number(a.id===activeId));
 if(!people.length)return '';
 return `<div class="shared-agents" role="group" aria-label="陪伴你們的兩位伙伴">${people.map(person=>{
  const art=characterArt(person.companion),name=person.companion?.name||ELEMENT_COMPANIONS[art.element].name,owner=person.id===activeId?'你':person.name||'朋友';
  return `<figure class="shared-agent" data-agent-owner="${escape(person.id)}" data-agent-element="${art.element}" data-agent-stage="${art.stage}" data-agent-side="${person.id===activeId?'own':'other'}"><div class="shared-agent-art"><span class="shared-agent-shadow" aria-hidden="true"></span><svg class="element-character-sprite" viewBox="${art.frame.join(' ')}" role="img" aria-label="${escape(owner)}的 ${escape(name)}" preserveAspectRatio="xMidYMax meet"><image href="${art.src}" width="1499" height="1049" /></svg></div></figure>`;
 }).join('')}</div>`;
}
