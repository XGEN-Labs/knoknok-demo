import { normalizeCardLabels, normalizePersonalityTags, normalizeCardAvatar, migrateCardTags } from './card-labels.mjs?v=20261021-refine-27c';
export { CARD_LABEL_GROUPS, CARD_LABEL_LIMIT, CARD_LABEL_MAX_LENGTH, normalizeCardLabels, normalizePersonalityTags, normalizeCardAvatar, PERSONALITY_TAG_LIMIT, PERSONALITY_TAG_MAX_LENGTH, CARD_AVATAR_MAX_BYTES } from './card-labels.mjs?v=20261021-refine-27c';

const DEFAULT_COMPANION = 'assets/klin-20261014/adult.png';
const BRAND_LOGO = 'assets/brand-20261016/knoknok-logo-latest.png';
export const DEFAULT_CARD_AVATAR = 'assets/brand-20261016/default-cloud-avatar.svg';
const LIMITS = Object.freeze({ name: 40, bio: 180, language: 24, region: 60, encoded: 32768, jsonBytes: 24576 });
const TAG_FILLS = ['#f4d3b8', '#ddd3f1', '#cddfe8', '#eee1a9', '#eacbd0', '#d4deef', '#e6d1e9'];
const TAG_EDGES = ['#ddcbbc', '#d1c9e2', '#c6d6e0', '#dfd2aa', '#dfc4ce', '#c8d3e3', '#d9c7dd'];
const TAG_ANGLES = [-1.5, 1.5, -1, 1, -1.5, 1, -1];
// A few almost transparent edge pixels begin at 218; the visible letter ink
// starts at 312. Align the actual printed strokes with the content column.
const BRAND_INK_INSET = 312 / 2172;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const length = value => Array.from(value).length;
const clean = value => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\r\n?/g, '\n').trim() : '';
const shortened = (value, limit) => Array.from(clean(value)).slice(0, limit).join('');
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

// An explicit public snapshot, never a spread of a user/private record. Avatar,
// tags and city require caller selection; no birth or memory inference occurs.
export function publicCardData(user, { includeRegion = false, tags = [], labels = {}, avatar = '' } = {}) {
  const source = plain(user) ? user : {};
  const data = {
    name: shortened(source.name, LIMITS.name) || '新朋友',
    bio: shortened(source.bio, LIMITS.bio),
    language: shortened(source.language, LIMITS.language),
    tags: migrateCardTags(tags, labels),
  };
  if (includeRegion === true) {
    const region = shortened(source.region, LIMITS.region);
    if (region) data.region = region;
  }
  const publicAvatar = normalizeCardAvatar(avatar);
  if (publicAvatar) data.avatar = publicAvatar;
  return data;
}

function validatedData(value) {
  if (!plain(value) || typeof value.name !== 'string') return null;
  const data = {};
  for (const field of ['name', 'bio', 'language', 'region']) {
    if (!own(value, field)) { if (field !== 'region') data[field] = ''; continue; }
    if (typeof value[field] !== 'string' || length(value[field]) > LIMITS[field]) return null;
    const text = clean(value[field]);
    if (field !== 'region' || text) data[field] = text;
  }
  if (!data.name) return null;
  const tags = normalizePersonalityTags(own(value, 'tags') ? value.tags : [], { strict: true });
  if (!tags) return null;
  let labels = {};
  if (own(value, 'labels')) { labels = normalizeCardLabels(value.labels, { strict: true }); if (!labels) return null; }
  data.tags = migrateCardTags(tags, labels);
  if (own(value, 'avatar')) {
    const avatar = normalizeCardAvatar(value.avatar, { strict: true });
    if (avatar === null) return null;
    if (avatar) data.avatar = avatar;
  }
  return data;
}

export function encodeCard(value) {
  const data = validatedData(value);
  if (!data) throw new TypeError('名片內容不完整或超出長度限制。');
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  if (bytes.length > LIMITS.jsonBytes) throw new TypeError('名片內容過長，請換一張較小的頭像。');
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeCard(encoded) {
  if (typeof encoded !== 'string' || !encoded || encoded.length > LIMITS.encoded || encoded.length % 4 === 1 || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  try {
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - encoded.length % 4) % 4));
    if (binary.length > LIMITS.jsonBytes) return null;
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return validatedData(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  } catch { return null; }
}

function companionPath(value) {
  return typeof value === 'string' && /^(?:\.\/)?assets\/[A-Za-z0-9_./-]+\.(?:png|webp|jpe?g)$/i.test(value) && !value.split('/').includes('..') ? value : DEFAULT_COMPANION;
}

export function cardMarkup(value, { companionSrc = DEFAULT_COMPANION, compact = false, showAllTags = false, editable = false } = {}) {
  const data = validatedData(value);
  if (!data) return '';
  const image = escape(companionPath(companionSrc));
  const meta = [data.language ? `<span class="share-card-language">${escape(data.language)}</span>` : '', data.region ? `<span class="share-card-region">${escape(data.region)}</span>` : ''].filter(Boolean).join('');
  const avatar = `<img src="${escape(data.avatar || DEFAULT_CARD_AVATAR)}" alt="${escape(data.name)}的${data.avatar ? '' : '預設'}頭像" width="72" height="72">`;
  // Only the interactive full card truncates its preview. Compact cards and
  // standalone shared snapshots remain complete without an unhandled control.
  const interactiveTags = showAllTags === true && !compact && data.tags.length > 0;
  const previewTags = interactiveTags ? data.tags.slice(0, 3) : data.tags;
  const stickers = previewTags.map((tag, index) => `<span class="personality-sticker sticker-${index + 1}" title="${escape(tag)}" style="--tag-fill:${TAG_FILLS[index]};--tag-edge:${TAG_EDGES[index]};--tag-angle:${TAG_ANGLES[index]}deg">${escape(tag)}</span>`).join('');
  const tagsLink = interactiveTags ? `<button class="share-card-tags-link" type="button" data-action="view-card-tags" aria-label="查看所有 ${data.tags.length} 個標籤">所有標籤<span aria-hidden="true"> · ${data.tags.length} ↗</span></button>` : '';
  // Editing belongs only to an explicitly editable, full personal card. It is
  // absent from standalone/compact share snapshots and the exported artwork.
  const edit = editable === true && !compact ? '<button class="share-card-edit" type="button" data-action="edit-card" aria-label="編輯名片" title="編輯名片"><img src="assets/ui/pencil-square.svg" width="19" height="19" alt="" aria-hidden="true"></button>' : '';
  return `<article class="share-card${compact ? ' is-compact' : ''}" data-print-card${edit ? ' data-card-editable' : ''} aria-label="${escape(data.name)}的分享名片"><div class="paper-card-postage" aria-hidden="true"><div class="paper-card-stamp"><img class="paper-card-landscape" src="assets/cloud-realm-20261019/arrival.webp" alt=""><img class="paper-card-spirit" src="${image}" alt="" draggable="false"></div><span class="paper-card-postage-label">彼之境 · 來客</span></div><header class="share-card-brand"><div class="share-card-brand-top"><span class="share-card-brand-mark"><img class="share-card-brand-logo" src="${BRAND_LOGO}" width="2172" height="724" alt="Knoknok"></span></div><span class="share-card-brand-label">一張名片，一次相遇。</span></header><div class="share-card-identity"><div class="share-card-avatar">${avatar}</div><div class="share-card-name-block"><h2 class="share-card-name${length(data.name) > 12 ? ' is-long-name' : ''}" title="${escape(data.name)}">${escape(data.name)}</h2></div></div><div class="share-card-about">${data.bio ? `<p class="share-card-bio" title="${escape(data.bio)}">${escape(data.bio)}</p>` : ''}${meta ? `<div class="share-card-meta">${meta}</div>` : ''}</div><section class="personality-stickers${data.tags.length ? '' : ' is-empty'}" aria-label="我的標籤${data.tags.length ? ` · ${data.tags.length}` : ''}"><div class="personality-sticker-box${data.tags.length ? '' : ' is-empty'}">${stickers}</div>${tagsLink}</section>${edit}</article>`;
}

export function cardShareURL(value, baseURL) {
  const url = new URL(baseURL);
  if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError('分享名片需要 HTTP 或 HTTPS 網址。');
  url.username = ''; url.password = ''; url.search = ''; url.hash = `card=${encodeCard(value)}`;
  return url.href;
}

function wrapLines(context, text, maxWidth) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const character of Array.from(paragraph)) {
      if (line && context.measureText(line + character).width > maxWidth) { lines.push(line); line = character; }
      else line += character;
    }
    lines.push(line);
  }
  return lines;
}
function rounded(context, x, y, width, height, radius) {
  context.beginPath(); context.moveTo(x + radius, y); context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius); context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius); context.closePath();
}
async function cardImage(path) {
  if (typeof Image === 'undefined' || typeof location === 'undefined') return null;
  const avatar = normalizeCardAvatar(path);
  const source = avatar ? avatar : new URL(path, import.meta.url);
  if (!avatar && (source.origin !== location.origin || !['http:', 'https:'].includes(source.protocol))) return null;
  return new Promise(resolve => {
    const image = new Image(); let settled = false;
    const finish = result => { if (settled) return; settled = true; clearTimeout(timer); image.onload = null; image.onerror = null; resolve(result); };
    const timer = setTimeout(() => finish(null), 3500);
    image.onload = () => finish(image); image.onerror = () => finish(null); image.src = avatar || source.href;
  });
}

export async function downloadCard(value) {
  const data = validatedData(value);
  if (!data) throw new TypeError('名片內容不完整或超出長度限制。');
  if (typeof document === 'undefined') throw new TypeError('請在瀏覽器中下載名片。');
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 2200;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('瀏覽器暫時無法繪製名片。');
  try { await document.fonts?.load?.('600 50px "Klin Paper Serif"'); } catch { /* Keep the installed serif fallback if the local font cannot load. */ }
  const family = '"Klin Paper Serif","Songti TC","Songti SC","Noto Serif CJK TC","Noto Serif CJK SC","PMingLiU",serif';
  const [logo, companion, avatar, landscape] = await Promise.all([
    cardImage(BRAND_LOGO), cardImage(DEFAULT_COMPANION), cardImage(data.avatar || DEFAULT_CARD_AVATAR),
    cardImage('assets/cloud-realm-20261019/arrival.webp'),
  ]);
  const ink = '#302c29', left = 70, right = 1010;
  const cover = (image, x, y, w, h, focus = .5) => {
    const iw = image.naturalWidth || image.width, ih = image.naturalHeight || image.height;
    const scale = Math.max(w / iw, h / ih), sw = w / scale, sh = h / scale;
    ctx.drawImage(image, (iw - sw) / 2, (ih - sh) * focus, sw, sh, x, y, w, h);
  };
  ctx.textBaseline = 'top'; ctx.fillStyle = ink;
  ctx.font = '600 77px ' + family;
  let nameSize = 77, nameLines = wrapLines(ctx, data.name, 510);
  while (nameLines.length > 2 && nameSize > 29) { nameSize -= 4; ctx.font = '600 ' + nameSize + 'px ' + family; nameLines = wrapLines(ctx, data.name, 510); }
  const identityY = 246, identityHeight = Math.max(132, nameLines.length * (nameSize + 8) + 18);
  let flowY = identityY + identityHeight + 50;
  ctx.font = '50px ' + family;
  const bioLines = data.bio ? wrapLines(ctx, data.bio, right - left).slice(0, 2) : [];
  const allBioLines = data.bio ? wrapLines(ctx, data.bio, right - left) : [];
  const bioY = flowY; flowY += bioLines.length * 77;
  const meta = [data.language, data.region].filter(Boolean).join(' · ');
  const metaY = flowY + (bioLines.length ? 16 : 0);
  if (meta) flowY = metaY + 56;
  flowY += 38;
  const tags = []; let x = left, row = 0; ctx.font = '600 43px ' + family;
  for (const [index, text] of data.tags.entries()) {
    const width = Math.min(450, ctx.measureText(text).width + 54);
    if (x + width > right && x > left) { row++; x = left; }
    let display = text;
    while (ctx.measureText(display).width > width - 54) display = Array.from(display).slice(0, -1).join('');
    if (display !== text) display = Array.from(display).slice(0, -1).join('') + '…';
    tags.push({ index, display, x, y: flowY + row * 94, width }); x += width + 22;
  }
  const height = Math.max(680, flowY + (tags.length ? row * 94 + 77 : 0) + 70);
  // The same warm cotton stock and quiet fibres used by the DOM card.
  ctx.fillStyle = '#fffdf8'; ctx.fillRect(0, 0, 1080, height);
  const paper = ctx.createLinearGradient(0, 0, 1080, height);
  paper.addColorStop(0, '#fffefa'); paper.addColorStop(1, '#fbf7ef');
  ctx.fillStyle = paper; ctx.fillRect(0, 0, 1080, height);
  let seed = 52907; const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
  ctx.strokeStyle = '#ad987319'; ctx.lineWidth = .55;
  for (let i = 0; i < 3800; i++) { const px = random() * 1080, py = random() * height; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + random() * 7, py + 1 + random() * 6); ctx.stroke(); }
  ctx.strokeStyle = '#fffefa'; ctx.lineWidth = 2; rounded(ctx, 8, 8, 1064, height - 16, 16); ctx.stroke();
  if (logo) {
    const tint = document.createElement('canvas'); tint.width = 260; tint.height = 87;
    const print = tint.getContext('2d'); print.drawImage(logo, 0, 0, 260, 87); print.globalCompositeOperation = 'source-in'; print.fillStyle = ink; print.fillRect(0, 0, 260, 87);
    ctx.globalAlpha = .84; ctx.drawImage(tint, left - 260 * BRAND_INK_INSET, 62, 260, 87); ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#7a6e62'; ctx.font = '36px ' + family; ctx.fillText('一張名片，一次相遇。', left, 163);
  // A small printed souvenir stamp replaces the previous full-width image box.
  ctx.save(); ctx.translate(910, 182); ctx.rotate(6 * Math.PI / 180);
  ctx.fillStyle = '#fffefb'; ctx.fillRect(-100, -115, 200, 230);
  ctx.strokeStyle = '#c9bdad'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]); ctx.strokeRect(-99, -114, 198, 228); ctx.setLineDash([]);
  ctx.save(); ctx.beginPath(); ctx.rect(-88, -103, 176, 206); ctx.clip();
  if (landscape) { ctx.globalAlpha = .90; cover(landscape, -88, -103, 176, 206, .35); ctx.globalAlpha = 1; }
  if (companion) { ctx.globalAlpha = .92; ctx.drawImage(companion, -59, -6, 118, 118); ctx.globalAlpha = 1; }
  ctx.restore(); ctx.fillStyle = '#7b6a59'; ctx.font = '36px ' + family; ctx.textAlign = 'center'; ctx.fillText('彼之境 · 來客', 0, 133); ctx.restore(); ctx.textAlign = 'left';
  ctx.save(); ctx.beginPath(); ctx.arc(left + 66, identityY + 66, 66, 0, Math.PI * 2); ctx.clip();
  if (avatar) cover(avatar, left, identityY, 132, 132);
  else {
    const sky = ctx.createLinearGradient(left, identityY, left + 132, identityY + 132); sky.addColorStop(0, '#ebe5f5'); sky.addColorStop(1, '#b8c8ea');
    ctx.fillStyle = sky; ctx.fillRect(left, identityY, 132, 132); ctx.fillStyle = '#fffaf3'; ctx.beginPath(); ctx.arc(left + 66, identityY + 50, 20, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(left + 66, identityY + 127, 38, 44, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore(); ctx.font = '600 ' + nameSize + 'px ' + family;
  // Names are printed directly on the same stock as the rest of the card.
  ctx.fillStyle = ink; nameLines.forEach((line, i) => ctx.fillText(line, 236, identityY + 8 + i * (nameSize + 8)));
  ctx.fillStyle = '#655d54'; ctx.font = '50px ' + family;
  bioLines.forEach((line, i) => {
    let display = line;
    if (i === 1 && allBioLines.length > 2) {
      while (display && ctx.measureText(display + '…').width > right - left) display = Array.from(display).slice(0, -1).join('');
      display += '…';
    }
    ctx.fillText(display, left, bioY + i * 77);
  });
  if (meta) { ctx.fillStyle = '#776b5f'; ctx.font = '42px ' + family; ctx.fillText(meta, left, metaY); }
  for (const { index, display, x, y, width } of tags) {
    ctx.save(); ctx.translate(x + width / 2, y + 38); ctx.rotate(TAG_ANGLES[index] * Math.PI / 180);
    ctx.fillStyle = TAG_FILLS[index]; rounded(ctx, -width / 2, -38, width, 77, 10); ctx.fill();
    ctx.strokeStyle = TAG_EDGES[index]; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#ffffff60'; ctx.lineWidth = 1;
    for (let stripe = -width / 2 + 10; stripe < width / 2 - 4; stripe += 11) { ctx.beginPath(); ctx.moveTo(stripe, -32); ctx.lineTo(stripe + 1, 32); ctx.stroke(); }
    ctx.fillStyle = '#493c43'; ctx.font = '600 43px ' + family; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(display, 0, 2); ctx.restore();
  }
  const portrait = document.createElement('canvas'); portrait.width = 1080; portrait.height = height;
  const portraitContext = portrait.getContext('2d');
  if (!portraitContext) throw new Error('瀏覽器暫時無法繪製名片。');
  portraitContext.save(); rounded(portraitContext, 0, 0, 1080, height, 24); portraitContext.clip(); portraitContext.drawImage(canvas, 0, 0); portraitContext.restore();
  const blob = await new Promise((resolve, reject) => portrait.toBlob(result => result ? resolve(result) : reject(new Error('名片暫時未能匯出，請再試一次。')), 'image/png'));
  const filename = 'Knoknok-' + (Array.from(data.name.replace(/[^\p{L}\p{N}_-]/gu, '')).slice(0, 28).join('') || 'friend') + '-名片.png';
  const objectURL = URL.createObjectURL(blob), link = document.createElement('a'); link.href = objectURL; link.download = filename; document.body.append(link);
  try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(objectURL), 1000); }
  return { blob, filename };
}
