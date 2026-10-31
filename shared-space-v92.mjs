import {SHARED_SCENE_ASSET} from './scene-assets.mjs';
import { normalizeSharedMessageAvatar } from './shared-message-identity.mjs?v=20261030-shared-elements-88';

// Compatibility export; all participants now use one neutral shared scene.
export const SHARED_MEADOW_ASSET = SHARED_SCENE_ASSET;
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const pair = (participants, activeId) => participants.filter(person => person?.id).slice(0, 2).sort((a, b) => Number(b.id === activeId) - Number(a.id === activeId));

/** A shared place belongs to the conversation, never to either participant's
 * room. Keep the two saved companion identities and their standing atlas. */
export function sharedSpaceSceneMarkup(participants = [], activeId) {
  return `<div class="shared-room-scene" data-shared-scene="public"><div class="shared-room-plate"><img class="shared-room-backdrop" src="${SHARED_MEADOW_ASSET}" alt="" draggable="false"></div></div>`;
}

export function sharedSpacePeopleMarkup(participants = [], activeId) {
  const people = pair(participants, activeId);
  if (!people.length) return '';
  return `<div class="shared-people shared-space-people" aria-label="你們的共同空間">${people.map(person => {
    const name = person.name || (person.id === activeId ? '你' : '朋友');
    const source = normalizeSharedMessageAvatar(person.chatAvatar);
    const avatar = source ? `<img src="${escape(source)}" alt="" draggable="false">` : escape(Array.from(name)[0]);
    return `<span class="shared-person"><span class="avatar" aria-hidden="true">${avatar}</span><strong>${escape(name)}</strong></span>`;
  }).join('')}</div>`;
}
