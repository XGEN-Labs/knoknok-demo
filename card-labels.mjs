// Personality stickers are chosen by their owner. Never infer them from private
// birthday, chat, memory or onboarding records. The old two groups are retained
// only to read already-published cards and migrate explicit saved selections.
export const CARD_LABEL_GROUPS = Object.freeze([
  Object.freeze({ id: 'rhythm', label: '生活節奏' }),
  Object.freeze({ id: 'social', label: '社交偏好' }),
]);
export const CARD_LABEL_LIMIT = 2;
export const CARD_LABEL_MAX_LENGTH = 16;
export const PERSONALITY_TAG_LIMIT = 7;
export const PERSONALITY_TAG_MAX_LENGTH = 24;
export const CARD_AVATAR_MAX_BYTES = 16384;

const clean = value => value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
export function normalizePersonalityTags(value, { strict = false } = {}) {
  if (!Array.isArray(value)) return strict ? null : [];
  if (strict && (value.length > PERSONALITY_TAG_LIMIT || value.some(tag => typeof tag !== 'string' || Array.from(tag).length > PERSONALITY_TAG_MAX_LENGTH))) return null;
  return [...new Set(value.filter(tag => typeof tag === 'string').map(tag => Array.from(clean(tag)).slice(0, PERSONALITY_TAG_MAX_LENGTH).join('')).filter(Boolean))].slice(0, PERSONALITY_TAG_LIMIT);
}

export function normalizeCardLabels(value, { strict = false } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return strict ? null : {};
  const labels = {};
  for (const { id } of CARD_LABEL_GROUPS) {
    if (!Object.hasOwn(value, id)) continue;
    const input = value[id];
    if (!Array.isArray(input)) { if (strict) return null; else continue; }
    if (strict && (input.length > CARD_LABEL_LIMIT || input.some(tag => typeof tag !== 'string' || Array.from(tag).length > CARD_LABEL_MAX_LENGTH))) return null;
    const tags = [...new Set(input.filter(tag => typeof tag === 'string').map(tag => Array.from(clean(tag)).slice(0, CARD_LABEL_MAX_LENGTH).join('')).filter(Boolean))].slice(0, CARD_LABEL_LIMIT);
    if (tags.length) labels[id] = tags;
  }
  return labels;
}

export function migrateCardTags(tags, labels) {
  return normalizePersonalityTags([...normalizePersonalityTags(tags), ...Object.values(normalizeCardLabels(labels)).flat()]);
}

// No remote URLs, SVG, HTML or arbitrary data types. Files must be a bounded
// raster image with a matching signature; upload UI additionally resizes them.
export function normalizeCardAvatar(value, { strict = false } = {}) {
  if (value === '' || value === undefined) return '';
  const invalid = () => strict ? null : '';
  if (typeof value !== 'string' || value.length > 21900) return invalid();
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) return invalid();
  try {
    const bytes = atob(match[2]);
    if (!bytes.length || bytes.length > CARD_AVATAR_MAX_BYTES || btoa(bytes) !== match[2]) return invalid();
    const octets = [...bytes.slice(0, 12)].map(character => character.charCodeAt(0));
    const valid = match[1] === 'png' ? octets.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10'
      : match[1] === 'jpeg' ? octets[0] === 255 && octets[1] === 216 && octets[2] === 255
      : bytes.slice(0, 4) === 'RIFF' && bytes.slice(8, 12) === 'WEBP';
    return valid ? value : invalid();
  } catch { return invalid(); }
}
