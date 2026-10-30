const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

/** senderId is the existing participant/owner id; only an explicit isAI:true
 * marks agent speech. Draft assistance never changes a human sender's identity.
 * This presenter neither creates messages nor enables shared agent replies. */
export function sharedMessageIdentity(message, { participants = [], activeId } = {}) {
  const owner = participants.find(person => person?.id && person.id === message?.senderId);
  if (!owner) return { kind:'unknown', side:'unknown', role:'未確認身份', name:'發言者', ownerId:'' };
  const own = owner.id === activeId;
  const agent = message.isAI === true;
  return {
    kind:agent ? 'agent' : 'person',
    side:own ? 'own' : 'other',
    role:agent ? own ? '你的 Agent' : '對方的 Agent' : own ? '你' : '對方',
    name:agent ? owner.companion?.name || owner.companionName || 'Klin' : owner.name || (own ? '你' : '朋友'),
    ownerId:owner.id,
  };
}

export function sharedMessageMarkup(message, context) {
  const identity = sharedMessageIdentity(message, context);
  const own = identity.side === 'own';
  const label = `${identity.role} · ${identity.name}`;
  const retry = message.status === 'failed' && own && identity.kind === 'person'
    ? `<button type="button" class="text-button" data-retry="${escape(message.id)}">傳送失敗 · 重試</button>` : '';
  return `<div class="message${own ? ' own' : ''}" data-speaker-kind="${identity.kind}" data-speaker-side="${identity.side}" data-speaker-owner="${escape(identity.ownerId)}"><div class="message-content"><div class="bubble"><div class="message-label" aria-label="${escape(label)}"><span class="shared-message-role">${escape(identity.role)}</span><strong class="shared-message-name">${escape(identity.name)}</strong></div><div class="shared-message-text">${escape(message.text)}</div></div>${retry}</div></div>`;
}
