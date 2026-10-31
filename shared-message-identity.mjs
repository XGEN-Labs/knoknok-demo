import { normalizeCardAvatar } from './card-labels.mjs';

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

/** The caller selects each participant's display avatar. Saved arbitrary remote
 * profile URLs never become requests: only validated raster uploads and local
 * same-origin sources are accepted. Blob URLs require a known matching origin. */
export function normalizeSharedMessageAvatar(value, { baseURL = globalThis.document?.baseURI || globalThis.location?.href } = {}) {
  if (typeof value !== 'string' || !value || /[\u0000-\u001f\u007f\\]/.test(value)) return '';
  const source = value.trim();
  if (/^data:/i.test(source)) return normalizeCardAvatar(source);
  if (!source || source.length > 2048) return '';
  try {
    const base = baseURL ? new URL(baseURL) : null;
    const origin = base && ['http:', 'https:'].includes(base.protocol) ? base.origin : null;
    const absolute = /^[a-z][a-z\d+.-]*:/i.test(source) || source.startsWith('//');
    // A relative asset remains useful in server-rendered/test markup; an
    // absolute or blob URL cannot be trusted without the actual page origin.
    if (absolute && !origin) return '';
    const url = new URL(source, origin ? base.href : 'https://local.invalid/');
    if (url.username || url.password || url.origin !== (origin || 'https://local.invalid')) return '';
    if (!['http:', 'https:', 'blob:'].includes(url.protocol)) return '';
    return source;
  } catch { return ''; }
}

export function sharedMessageAvatarSource(message, context = {}) {
  const identity = sharedMessageIdentity(message, context);
  if (identity.kind === 'unknown') return '';
  const owner = context.participants?.find(person => person?.id === identity.ownerId);
  return normalizeSharedMessageAvatar(identity.kind === 'agent' ? owner?.companion?.avatar : owner?.chatAvatar, context);
}

function avatarFrame(value) {
  if (!value || typeof value !== 'object') return null;
  const { x, y, width, height, sheetWidth, sheetHeight } = value;
  if (![x, y, width, height, sheetWidth, sheetHeight].every(number => typeof number === 'number' && Number.isFinite(number))) return null;
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || sheetWidth <= 0 || sheetHeight <= 0) return null;
  if (x + width > sheetWidth || y + height > sheetHeight) return null;
  return { x, y, width, height, sheetWidth, sheetHeight };
}

function avatarMarkup(identity, source, context) {
  const owner = context?.participants?.find(person => person?.id === identity.ownerId);
  const frame = identity.kind === 'agent' ? avatarFrame(owner?.companion?.avatarFrame) : null;
  const fallback = identity.kind === 'agent' ? '✦' : identity.kind === 'unknown' ? '?' : Array.from(String(identity.name))[0] || '人';
  let image = `<span class="shared-message-avatar-fallback">${escape(fallback)}</span>`;
  if (source) image = frame
    ? `<svg class="shared-message-avatar-frame" viewBox="${frame.x} ${frame.y} ${frame.width} ${frame.height}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><image href="${escape(source)}" width="${frame.sheetWidth}" height="${frame.sheetHeight}"/></svg>`
    : `<img src="${escape(source)}" alt="" width="24" height="24" draggable="false">`;
  return `<span class="shared-message-avatar" aria-hidden="true">${image}</span>`;
}

export function sharedMessageMarkup(message, context) {
  const identity = sharedMessageIdentity(message, context);
  const own = identity.side === 'own';
  const label = `${identity.role} · ${identity.name}`;
  const avatar = avatarMarkup(identity, sharedMessageAvatarSource(message, context), context);
  const retry = message.status === 'failed' && own && identity.kind === 'person'
    ? `<button type="button" class="text-button" data-retry="${escape(message.id)}">傳送失敗 · 重試</button>` : '';
  return `<div class="message${own ? ' own' : ''}" data-speaker-kind="${identity.kind}" data-speaker-side="${identity.side}" data-speaker-owner="${escape(identity.ownerId)}"><div class="message-content"><div class="bubble"><div class="message-label" aria-label="${escape(label)}"><span class="shared-message-speaker">${avatar}<strong class="shared-message-name">${escape(identity.name)}</strong></span><span class="shared-message-role">${escape(identity.role)}</span></div><div class="shared-message-text">${escape(message.text)}</div></div>${retry}</div></div>`;
}
