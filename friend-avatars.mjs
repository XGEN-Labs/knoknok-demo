import { normalizeCardAvatar } from './card-labels.mjs';

// These local portraits illustrate fictional Demo contacts. They do not
// represent real Knoknok accounts. See assets/demo-avatars-20261026-45/sources.json
export const DEMO_FRIEND_AVATARS = Object.freeze(Object.fromEntries(
  ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map(id => [id, `assets/demo-avatars-20261026-45/${id}.jpg`]),
));

export function friendAvatarSource(friend = {}, user = {}) {
  // Keep user-provided photos first, including older local contact schemas.
  // Arbitrary remote URLs are intentionally not loaded from saved profiles.
  for (const owner of [user, friend]) {
    for (const field of ['cardAvatar', 'avatar', 'avatarUrl', 'photo']) {
      const uploaded = normalizeCardAvatar(owner[field]);
      if (uploaded) return uploaded;
    }
  }
  return DEMO_FRIEND_AVATARS[friend.id || user.id] || '';
}
