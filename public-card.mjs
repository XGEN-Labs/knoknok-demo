import { normalizeCardLabels, normalizePersonalityTags, normalizeCardAvatar, migrateCardTags } from './card-labels.mjs?v=20261015-universe-5';
export { CARD_LABEL_GROUPS, CARD_LABEL_LIMIT, CARD_LABEL_MAX_LENGTH, normalizeCardLabels, normalizePersonalityTags, normalizeCardAvatar, PERSONALITY_TAG_LIMIT, PERSONALITY_TAG_MAX_LENGTH, CARD_AVATAR_MAX_BYTES } from './card-labels.mjs?v=20261015-universe-5';

const DEFAULT_COMPANION = 'assets/klin-native-20261016-0907/adult.png';
const BRAND_LOGO = 'assets/brand-20261016/knoknok-logo-latest.png';
const LIMITS = Object.freeze({ name: 40, bio: 180, language: 24, region: 60, encoded: 32768, jsonBytes: 24576 });
const STICKER_COLORS = ['#c8e7ff', '#ffd1e5', '#dfd0ff', '#ffe1af', '#c9d5ff', '#ffcdc4', '#f0ccff'];
const STICKER_ANGLES = [-5, 4, -3, 4, -4, 3, -2];
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

export function cardMarkup(value, { companionSrc = DEFAULT_COMPANION, compact = false } = {}) {
  const data = validatedData(value);
  if (!data) return '';
  const image = escape(companionPath(companionSrc));
  const meta = [data.language ? `<span class="share-card-language">${escape(data.language)}</span>` : '', data.region ? `<span class="share-card-region">${escape(data.region)}</span>` : ''].filter(Boolean).join('');
  const avatar = data.avatar ? `<img src="${escape(data.avatar)}" alt="${escape(data.name)}的頭像" width="72" height="72">` : `<span aria-label="${escape(data.name)}的預設頭像">${escape(Array.from(data.name)[0])}</span>`;
  const stickers = data.tags.map((tag, index) => `<span class="personality-sticker sticker-${index + 1}" title="${escape(tag)}" style="--sticker-color:${STICKER_COLORS[index]};--sticker-angle:${STICKER_ANGLES[index]}deg">${escape(tag)}</span>`).join('');
  return `<article class="share-card${compact ? ' is-compact' : ''}" aria-label="${escape(data.name)}的分享名片"><div class="share-card-brand"><span class="share-card-brand-mark"><img class="share-card-brand-logo" src="${BRAND_LOGO}" width="2172" height="724" alt="Knoknok"></span><span class="share-card-brand-label">你好，新朋友</span></div><div class="share-card-identity"><div class="share-card-avatar">${avatar}</div><div class="share-card-name-block"><p class="share-card-hello">你好，我是</p><h2 class="share-card-name" title="${escape(data.name)}">${escape(data.name)}</h2></div></div><div class="share-card-about">${data.bio ? `<p class="share-card-bio" title="${escape(data.bio)}">${escape(data.bio)}</p>` : ''}${meta ? `<div class="share-card-meta">${meta}</div>` : ''}</div><section class="personality-stickers" aria-label="我的個性標籤"><header><span>我的標籤${data.tags.length ? ` · ${data.tags.length}` : ''}</span><span class="sticker-orbit-mark" aria-hidden="true">✧</span></header><div class="personality-sticker-box${data.tags.length ? '' : ' is-empty'}">${stickers || '<span class="personality-empty">把你的個性，貼在這裡</span>'}</div></section><footer class="share-card-footer"><span class="share-card-companion"><img src="${image}" width="62" height="62" alt="Klin" draggable="false"><span>Klin 陪我認識你</span></span><span class="share-card-footer-mark" aria-hidden="true">✦</span></footer></article>`;
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
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1600;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('瀏覽器暫時無法繪製名片。');
  const family = '-apple-system,BlinkMacSystemFont,"PingFang TC","PingFang SC",system-ui,sans-serif';
  const [logo, companion, avatar] = await Promise.all([cardImage(BRAND_LOGO), cardImage(DEFAULT_COMPANION), data.avatar ? cardImage(data.avatar) : null]);
  ctx.fillStyle = '#f6f3ff'; ctx.fillRect(0, 0, 1080, 1600);
  ctx.fillStyle = '#ffffff'; rounded(ctx, 36, 36, 1008, 1528, 64); ctx.fill();
  ctx.textBaseline = 'top';
  if (logo) {
    const tint = document.createElement('canvas'); tint.width = 300; tint.height = 100;
    const ink = tint.getContext('2d');
    if (ink) { ink.drawImage(logo, 0, 0, 300, 100); ink.globalCompositeOperation = 'source-in'; ink.fillStyle = '#191c22'; ink.fillRect(0, 0, 300, 100); ctx.drawImage(tint, 90, 82, 300, 100); }
  } else { ctx.fillStyle = '#191c22'; ctx.font = `700 42px ${family}`; ctx.fillText('Knoknok', 110, 102); }
  ctx.fillStyle = '#777181'; ctx.font = `30px ${family}`; ctx.fillText('你好，新朋友', 750, 115);
  ctx.save(); ctx.beginPath(); ctx.arc(190, 302, 82, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = '#e9ddff'; ctx.fillRect(108, 220, 164, 164);
  if (avatar) { const side = Math.min(avatar.naturalWidth, avatar.naturalHeight); ctx.drawImage(avatar, (avatar.naturalWidth-side)/2, (avatar.naturalHeight-side)/2, side, side, 108, 220, 164, 164); }
  else { ctx.fillStyle = '#53416b'; ctx.font = `700 76px ${family}`; ctx.textAlign = 'center'; ctx.fillText(Array.from(data.name)[0], 190, 254); }
  ctx.restore(); ctx.textAlign = 'left';
  ctx.fillStyle = '#777181'; ctx.font = `32px ${family}`; ctx.fillText('你好，我是', 310, 220);
  let nameSize = 90, nameLines;
  do { ctx.font = `700 ${nameSize}px ${family}`; nameLines = wrapLines(ctx, data.name, 650); if (nameLines.length <= 2 || nameSize <= 28) break; nameSize -= 4; } while (true);
  ctx.fillStyle = '#191c22'; for (let i = 0; i < nameLines.length; i++) ctx.fillText(nameLines[i], 310, 266 + i * (nameSize + 6));
  const identityBottom = Math.max(384, 266 + nameLines.length * (nameSize + 6));
  let flowY = identityBottom + 34;
  ctx.font = `39px ${family}`; ctx.fillStyle = '#504956';
  const bioLines = data.bio ? wrapLines(ctx, data.bio, 860).slice(0, 3) : [];
  const allBioLines = data.bio ? wrapLines(ctx, data.bio, 860) : [];
  bioLines.forEach((line, index) => ctx.fillText(line + (index === 2 && allBioLines.length > 3 ? '…' : ''), 110, flowY + index * 52));
  flowY += bioLines.length * 52;
  const meta = [data.language, data.region].filter(Boolean).join(' · ');
  if (meta) { flowY += bioLines.length ? 15 : 0; ctx.fillStyle = '#777181'; ctx.font = `35px ${family}`; ctx.fillText(meta, 110, flowY); flowY += 43; }
  flowY += 38;
  ctx.fillStyle = '#26202f'; ctx.font = `700 36px ${family}`; ctx.fillText(`我的標籤${data.tags.length ? ` · ${data.tags.length}` : ''}`, 110, flowY);
  ctx.fillStyle = '#ad81ef'; ctx.font = `36px ${family}`; ctx.fillText('✧', 930, flowY - 4);
  const stickerTop = flowY + 52;
  let stickerBottom = stickerTop + 116;
  if (data.tags.length) {
    let fontSize = 39, rows;
    do {
      ctx.font = `600 ${fontSize}px ${family}`; rows = [[]]; let width = 0;
      data.tags.forEach((text, index) => {
        const tagWidth = Math.min(244, ctx.measureText(text).width + 52);
        if (rows.at(-1).length && width + tagWidth + 20 > 780) { rows.push([]); width = 0; }
        let displayText = text;
        while (ctx.measureText(displayText).width > tagWidth - 45 && Array.from(displayText).length > 1) displayText = Array.from(displayText).slice(0, -1).join('');
        if (displayText !== text) displayText = Array.from(displayText).slice(0, -1).join('') + '…';
        rows.at(-1).push({ text: displayText, index, width: tagWidth }); width += tagWidth + 20;
      });
      if (rows.length <= 3 || fontSize <= 19) break; fontSize -= 2;
    } while (true);
    const rowHeight = 84, boxHeight = rows.length * rowHeight + 42;
    ctx.fillStyle = '#fcfaff'; rounded(ctx, 110, stickerTop, 860, boxHeight, 38); ctx.fill();
    rows.forEach((row, rowIndex) => {
      const sum = row.reduce((total, tag) => total + tag.width + 20, -20); let x = 540 - sum / 2;
      row.forEach(tag => {
        ctx.save(); ctx.translate(x + tag.width / 2, stickerTop + 58 + rowIndex * rowHeight); ctx.rotate(STICKER_ANGLES[tag.index] * Math.PI / 180);
        ctx.fillStyle = STICKER_COLORS[tag.index]; rounded(ctx, -tag.width / 2, -28, tag.width, 58, 29); ctx.fill();
        ctx.font = `600 ${fontSize}px ${family}`; ctx.fillStyle = '#35243e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tag.text, 0, 1); ctx.restore(); x += tag.width + 20;
      });
    });
    stickerBottom = stickerTop + boxHeight;
  } else {
    ctx.fillStyle = '#fcfaff'; rounded(ctx, 110, stickerTop, 860, 116, 38); ctx.fill();
    ctx.font = `36px ${family}`; ctx.fillStyle = '#8f809c'; ctx.textAlign = 'center'; ctx.fillText('把你的個性，貼在這裡', 540, stickerTop + 44); ctx.textAlign = 'left';
  }
  const footerY = stickerBottom + 36;
  ctx.strokeStyle = '#eee5f7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(110, footerY); ctx.lineTo(970, footerY); ctx.stroke();
  if (companion) ctx.drawImage(companion, 108, footerY + 20, 82, 82);
  ctx.fillStyle = '#777181'; ctx.font = `35px ${family}`; ctx.fillText('Klin 陪我認識你', companion ? 215 : 110, footerY + 47);
  ctx.fillStyle = '#af85e4'; ctx.font = `40px ${family}`; ctx.fillText('✦', 920, footerY + 37);
  // Trim the exported portrait to its actual content, just like the fitted card.
  const portrait = document.createElement('canvas'); portrait.width = 1080; portrait.height = Math.ceil(footerY + 156);
  const portraitContext = portrait.getContext('2d');
  if (!portraitContext) throw new Error('瀏覽器暫時無法繪製名片。');
  portraitContext.fillStyle = '#f6f3ff'; portraitContext.fillRect(0, 0, portrait.width, portrait.height);
  portraitContext.save(); rounded(portraitContext, 36, 36, 1008, portrait.height - 72, 64); portraitContext.clip(); portraitContext.drawImage(canvas, 0, 0); portraitContext.restore();
  const blob = await new Promise((resolve, reject) => portrait.toBlob(result => result ? resolve(result) : reject(new Error('名片暫時未能匯出，請再試一次。')), 'image/png'));
  const filename = `Knoknok-${Array.from(data.name.replace(/[^\p{L}\p{N}_-]/gu, '')).slice(0, 28).join('') || 'friend'}-名片.png`;
  const objectURL = URL.createObjectURL(blob), link = document.createElement('a'); link.href = objectURL; link.download = filename; document.body.append(link);
  try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(objectURL), 1000); }
  return { blob, filename };
}
