import { cardArtwork, CARD_FONTS, DEFAULT_CARD_AVATAR } from './card-artwork.mjs?v=20261030-text-ink-87';
import { stickerSurfaceMarkup, STICKER_ICONS, paintStickerSurface, traceStickerIcon } from './tag-stickers.mjs?v=20261030-text-ink-87';
import { normalizeCardDesign, generateCardDesign } from './card-design.mjs?v=20261026-experience-42';
import { normalizeCardLabels, normalizePersonalityTags, normalizeCardAvatar, migrateCardTags } from './card-labels.mjs?v=20261021-refine-27c';
export { CARD_LABEL_GROUPS, CARD_LABEL_LIMIT, CARD_LABEL_MAX_LENGTH, normalizeCardLabels, normalizePersonalityTags, normalizeCardAvatar, PERSONALITY_TAG_LIMIT, PERSONALITY_TAG_MAX_LENGTH, CARD_AVATAR_MAX_BYTES } from './card-labels.mjs?v=20261021-refine-27c';

const BRAND_LOGO = 'assets/brand-20261028-noknok/noknok-selected-white.png';
export { DEFAULT_CARD_AVATAR };
const LIMITS = Object.freeze({ name: 40, bio: 180, language: 24, region: 60, encoded: 32768, jsonBytes: 24576 });
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const length = value => Array.from(value).length;
const clean = value => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\r\n?/g, '\n').trim() : '';
const shortened = (value, limit) => Array.from(clean(value)).slice(0, limit).join('');
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

// An explicit public snapshot, never a spread of a user/private record. Avatar,
// tags and city require caller selection; no birth or memory inference occurs.
const publicTagCategories = (tags, categories) => Object.fromEntries(tags.flatMap(label =>
  plain(categories) && own(categories, label) && ['identity','daily','skills','exploration'].includes(categories[label]) ? [[label, categories[label]]] : []));
export function publicCardData(user, { includeRegion = false, tags = [], labels = {}, avatar = '', tagCategories = {} } = {}) {
  const source = plain(user) ? user : {};
  const data = {
    name: shortened(source.name, LIMITS.name) || '新朋友',
    bio: shortened(source.bio, LIMITS.bio),
    language: shortened(source.language, LIMITS.language),
    tags: migrateCardTags(tags, labels),
  };
  const categories = publicTagCategories(data.tags, tagCategories);
  if (Object.keys(categories).length) data.tagCategories = categories;
  if (includeRegion === true) {
    const region = shortened(source.region, LIMITS.region);
    if (region) data.region = region;
  }
  const publicAvatar = normalizeCardAvatar(avatar);
  if (publicAvatar) data.avatar = publicAvatar;
  const design = normalizeCardDesign(source.cardDesign);
  if (design !== null) data.design = design;
  else if (typeof source.id === 'string' && source.id) data.design = generateCardDesign(source.id);
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
  const categories = publicTagCategories(data.tags, value.tagCategories);
  if (Object.keys(categories).length) data.tagCategories = categories;
  if (own(value, 'avatar')) {
    const avatar = normalizeCardAvatar(value.avatar, { strict: true });
    if (avatar === null) return null;
    if (avatar) data.avatar = avatar;
  }
  if (own(value, 'design')) {
    const design = normalizeCardDesign(value.design);
    if (design === null) return null;
    data.design = design;
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

const artworkAsset = path => path.startsWith('data:') ? path : new URL(path, import.meta.url).href;
const preparedFontSets = new WeakMap();
// DOM previews and PNG export must measure the same loaded font faces. Keep one
// readiness promise per document so reopening or sharing the card does not reload them.
export function prepareCardFonts(sample = 'Knoknok 名片 標籤') {
 const fonts = typeof document === 'undefined' ? null : document.fonts;
 if (!fonts) return Promise.resolve();
 if (!preparedFontSets.has(fonts)) preparedFontSets.set(fonts, (async () => {
  await fonts.ready;
  if (fonts.load) await Promise.allSettled([...new Set(Object.values(CARD_FONTS))].map(family => fonts.load(`${family===CARD_FONTS.name?500:600} 32px ${family}`, sample)));
  await fonts.ready;
 })());
 return preparedFontSets.get(fonts);
}
function artworkMarkup(art,{interactive=false,editable=false}={}){
 const cqw=value=>value/art.width*100;
 const geometry=item=>`left:${item.x/art.width*100}%;top:${item.y/art.height*100}%;width:${item.w/art.width*100}%;height:${item.h/art.height*100}%;transform:rotate(${item.rotate||0}deg);`;
 return art.items.map(item=>{
  const box=geometry(item);
  if(item.type==='rect')return `<div class="bc-art bc-block" aria-hidden="true" style="${box}background:${item.fill};border-radius:${cqw(item.r)}cqw"></div>`;
  if(item.type==='logo')return `<span class="bc-art bc-logo" role="img" aria-label="NokNok" style="${box}color:${item.color}"></span>`;
  if(item.type==='avatar'){
   const alt=item.custom?'名片頭像':'Klin 預設頭像';
   const portraitStyle=`object-fit:${item.fit};background:${item.fill};padding:${cqw(item.pad)}cqw;box-sizing:border-box;`;
   const src=escape(artworkAsset(item.src));
   return editable?`<button class="bc-art bc-avatar" type="button" data-action="edit-card" aria-label="${item.custom?'更換頭像':'上傳頭像'}" title="${item.custom?'更換頭像':'上傳頭像'}" style="${box}"><img src="${src}" alt="${alt}" style="${portraitStyle}" draggable="false"></button>`:`<img class="bc-art bc-avatar" src="${src}" alt="${alt}" style="${box}${portraitStyle}" draggable="false">`;
  }
  if(item.type==='image')return `<img class="bc-art bc-image" src="${escape(artworkAsset(item.src))}" alt="" style="${box}object-fit:${item.fit==='cover'?'cover':'contain'};" draggable="false">`;
  const font=`font-size:${cqw(item.size)}cqw;font-weight:${item.weight};font-family:${CARD_FONTS[item.family]};color:${item.color};`;
  if(item.type==='tag'){
   const textY=(item.h-item.lines.length*item.size*item.lineHeight)/2;
   const style=`${box}${font}padding:0;text-align:${item.align||'left'};`;
   const inner=`${stickerSurfaceMarkup(item,item.w,item.h)}<svg class="bc-sticker-icon" viewBox="0 0 24 24" aria-hidden="true" style="left:${cqw(item.padX)}cqw;top:${cqw((item.h-item.iconSize)/2)}cqw;width:${cqw(item.iconSize)}cqw;height:${cqw(item.iconSize)}cqw"><path d="${STICKER_ICONS[item.icon]}"/></svg><span class="bc-sticker-label" style="color:${item.textColor||item.color};left:${cqw(item.padX+item.iconSpace)}cqw;top:${cqw(textY)}cqw;line-height:${item.lineHeight}">${item.lines.map(escape).join('<br>')}</span>`;
   return interactive?`<button class="bc-art bc-tag" type="button" data-action="view-card-tags" data-label="${escape(item.text)}" aria-label="查看全部標籤：${escape(item.text)}" title="${escape(item.text)}" style="${style}">${inner}</button>`:`<span class="bc-art bc-tag" title="${escape(item.text)}" style="${style}">${inner}</span>`;
  }
  const tag=item.kind==='name'?'h2':'p';
  return `<${tag} class="bc-art bc-${item.kind}" title="${escape(item.text)}" style="${box}${font}font-style:${item.italic?'italic':'normal'};text-align:${item.align};line-height:${item.lineHeight}">${item.lines.map(escape).join('<br>')}</${tag}>`;
 }).join('');
}
export function cardMarkup(value, { compact = false, showAllTags = false, editable = false } = {}) {
 const data=validatedData(value);if(!data)return '';
 const art=cardArtwork(data);
 return `<article class="share-card business-card${compact?' is-compact':''}" data-print-card data-business-card data-layout="${art.layout}" style="--bc-paper:${art.paper};aspect-ratio:${art.width}/${art.height};border-radius:${art.radius/art.width*100}% / ${art.radius/art.height*100}%" aria-label="${escape(data.name)}的名片"><div class="bc-face bc-front" style="background:${art.paper};color:${art.ink}"><div class="bc-paper" aria-hidden="true" style="background-image:url('${escape(artworkAsset(art.paperTexture))}');opacity:${art.paperOpacity};background-size:${art.paperScale*100}cqw ${art.paperScale*100}cqw;mix-blend-mode:multiply"></div>${artworkMarkup(art,{interactive:showAllTags&&!compact,editable:editable&&!compact})}</div></article>`;
}

export function cardShareURL(value, baseURL) {
  const url = new URL(baseURL);
  if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError('分享名片需要 HTTP 或 HTTPS 網址。');
  url.username = ''; url.password = ''; url.search = ''; url.hash = `card=${encodeCard(value)}`;
  return url.href;
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

// HTML and PNG consume exactly the same composition specification.
export async function renderCardImage(value) {
 const data=validatedData(value);if(!data)throw new TypeError('名片內容不完整或超出長度限制。');
 if(typeof document==='undefined')throw new TypeError('請在瀏覽器中下載名片。');
 await prepareCardFonts([data.name,...data.tags].join(' '));
 const art=cardArtwork(data),canvas=document.createElement('canvas');canvas.width=art.width*2;canvas.height=art.height*2;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('瀏覽器暫時無法繪製名片。');
 const paths=[...new Set([BRAND_LOGO,art.paperTexture,...art.items.filter(i=>i.src).map(i=>i.src)])];
 const loaded=await Promise.all(paths.map(cardImage)),images=new Map(paths.map((p,i)=>[p,loaded[i]]));
 ctx.scale(2,2);rounded(ctx,0,0,art.width,art.height,art.radius);ctx.clip();ctx.fillStyle=art.paper;ctx.fillRect(0,0,art.width,art.height);ctx.textBaseline='top';
 const paperImage=images.get(art.paperTexture);
 if(paperImage){ctx.save();ctx.globalAlpha=art.paperOpacity;ctx.globalCompositeOperation='multiply';const tile=art.width*art.paperScale;for(let y=0;y<art.height;y+=tile)ctx.drawImage(paperImage,0,y,tile,tile);ctx.restore();}
 for(const item of art.items){
  ctx.save();ctx.translate(item.x+item.w/2,item.y+item.h/2);ctx.rotate((item.rotate||0)*Math.PI/180);ctx.translate(-item.w/2,-item.h/2);
  if(item.type==='rect'){ctx.fillStyle=item.fill;if(item.r){rounded(ctx,0,0,item.w,item.h,Math.min(item.r,item.w/2,item.h/2));ctx.fill();}else ctx.fillRect(0,0,item.w,item.h);}
  else if(item.type==='logo'){
   const source=images.get(BRAND_LOGO);if(source){const layer=document.createElement('canvas');layer.width=source.naturalWidth;layer.height=source.naturalHeight;const ink=layer.getContext('2d');ink.drawImage(source,0,0);ink.globalCompositeOperation='source-in';ink.fillStyle=item.color;ink.fillRect(0,0,layer.width,layer.height);ctx.drawImage(layer,0,0,item.w,item.h);}
  }else if(item.type==='image'||item.type==='avatar'){
   const source=images.get(item.src);
   if(source){
    const iw=source.naturalWidth,ih=source.naturalHeight;
    if(item.type==='avatar'){ctx.beginPath();ctx.ellipse(item.w/2,item.h/2,item.w/2,item.h/2,0,0,Math.PI*2);ctx.clip();if(item.fill!=='transparent'){ctx.fillStyle=item.fill;ctx.fillRect(0,0,item.w,item.h);}}
    if(item.fit==='cover'){
     const scale=Math.max(item.w/iw,item.h/ih),sw=item.w/scale,sh=item.h/scale;
     ctx.drawImage(source,(iw-sw)/2,(ih-sh)/2,sw,sh,0,0,item.w,item.h);
    }else{
     const pad=item.pad||0,scale=Math.min((item.w-pad*2)/iw,(item.h-pad*2)/ih);
     ctx.drawImage(source,(item.w-iw*scale)/2,(item.h-ih*scale)/2,iw*scale,ih*scale);
    }
   }
  }else{
   ctx.font=`${item.italic?'italic ':''}${item.weight} ${item.size}px ${CARD_FONTS[item.family]}`;ctx.fillStyle=item.color;
   if(item.type==='tag'){
    paintStickerSurface(ctx,item,item.w,item.h);ctx.strokeStyle=item.color;ctx.lineJoin='round';ctx.lineCap='round';
    ctx.save();ctx.translate(item.padX,(item.h-item.iconSize)/2);ctx.scale(item.iconSize/24,item.iconSize/24);ctx.lineWidth=2;traceStickerIcon(ctx,item.icon);ctx.stroke();ctx.restore();
    ctx.fillStyle=item.textColor||item.color;ctx.textAlign='left';
    const textY=(item.h-item.lines.length*item.size*item.lineHeight)/2;
    item.lines.forEach((line,index)=>ctx.fillText(line,item.padX+item.iconSpace,textY+index*item.size*item.lineHeight));
   }else{ctx.textAlign=item.align;item.lines.forEach((line,i)=>ctx.fillText(line,item.align==='right'?item.w:item.align==='center'?item.w/2:0,i*item.size*item.lineHeight));}
  }
  ctx.restore();
 }
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('名片暫時未能匯出，請再試一次。')),'image/png'));
 return blob;
}
export async function downloadCard(value) {
 const data=validatedData(value);if(!data)throw new TypeError('名片內容不完整或超出長度限制。');
 const blob=await renderCardImage(data);
 const filename='Knoknok-'+(Array.from(data.name.replace(/[^\p{L}\p{N}_-]/gu,'')).slice(0,28).join('')||'friend')+'-名片.png';
 const objectURL=URL.createObjectURL(blob),link=document.createElement('a');link.href=objectURL;link.download=filename;document.body.append(link);
 try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(objectURL),1000);}
 return {blob,filename};
}
