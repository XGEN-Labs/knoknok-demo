import { SEATED_KLIN_ASSET } from './friend-room.mjs?v=20261028-seated-63';
import { klinAssets } from './klin-companion.mjs?v=20261023-original-room-character-39';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

/** Each participant brings their own saved companion to the shared room.
 * Current profiles use the selected Klin artwork; an uploaded human avatar is
 * never substituted for the companion, and no alternate identity is invented. */
export function sharedAgentsMarkup(participants = [], activeId) {
  const people = participants.filter(person => person?.id).slice(0, 2);
  people.sort((a, b) => Number(b.id === activeId) - Number(a.id === activeId));
  if (!people.length) return '';
  return `<div class="shared-agents" role="group" aria-label="陪伴你們的兩位伙伴">${people.map(person => {
    const stage = person.companion?.stage === 'juvenile' ? 'juvenile' : 'adult';
    const name = person.companion?.name || 'Klin';
    const owner = person.id === activeId ? '你' : person.name || '朋友';
    const own = person.id === activeId;
    const role = `${owner}的 Agent`;
    const label = `${role} · ${name}`;
    return `<figure class="shared-agent" data-agent-owner="${escape(person.id)}" data-agent-stage="${stage}" data-agent-side="${own ? 'own' : 'other'}"><div class="shared-agent-art"><span class="shared-agent-shadow" aria-hidden="true"></span><img src="${stage==='adult'?SEATED_KLIN_ASSET:klinAssets[stage]}" alt="${escape(label)}" width="1280" height="1280" draggable="false"></div><figcaption class="kn-glass-control" aria-label="${escape(label)}" title="${escape(label)}"><span class="shared-agent-owner">${escape(owner)}的</span><strong class="shared-agent-name">Agent · ${escape(name)}</strong></figcaption></figure>`;
  }).join('')}</div>`;
}
