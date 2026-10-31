// Pure renderers. Persistence and authorization stay with existing app actions.
import { cardMarkup } from './public-card.mjs?v=20261030-card-avatar-89';
import { uiIcon } from './ui-icons.mjs?v=20261031-product-sync';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const row=(label,action,{icon='',detail=''}={})=>`<button type="button" class="settings-row product-panel-row" data-action="${action}">${icon?uiIcon(icon):''}<span>${esc(label)}</span>${detail?`<span class="product-panel-value">${esc(detail)}</span>`:''}<span class="settings-chevron" aria-hidden="true">›</span></button>`;
export const DEFAULT_PROFILE_INTRODUCTION='想和新朋友，慢慢聊些喜歡的事。';
export const SETTINGS_LANGUAGES=Object.freeze(['粵語','普通話','英語']);

export function settingsPanelMarkup({language='粵語'}={}) {
 return `<div class="product-panels-v92 settings-menu">${row('帳號','account-menu',{icon:'account'})}${row('語言','settings-language',{icon:'language',detail:language})}</div>`;
}
export function languagePanelMarkup({language='粵語'}={}) {
 const options=SETTINGS_LANGUAGES.includes(language)?SETTINGS_LANGUAGES:[language,...SETTINGS_LANGUAGES].filter(Boolean);
 return `<form class="product-panels-v92 product-language-form" data-form="settings-language"><label class="field" for="settings-language">聊天語言<select id="settings-language" name="language">${options.map(value=>`<option value="${esc(value)}"${value===language?' selected':''}>${esc(value)}</option>`).join('')}</select></label><p>這個選擇會用於你和 Nok 的對話。</p><button type="submit" class="btn">儲存語言</button></form>`;
}
export function cardSharePanelMarkup(data,{nativeShare=false}={}) {
 return `<div class="product-panels-v92 card-share-sheet"><div class="card-share-preview">${cardMarkup(data,{compact:true})}</div><div class="card-share-actions">${nativeShare?'<button type="button" class="btn kn-glass-control card-share-primary" data-action="native-share-card">分享給朋友</button>':''}<button type="button" class="btn kn-glass-control" data-action="download-card">儲存圖片</button></div><div id="card-share-status" class="card-share-status" role="status" aria-live="polite"></div></div>`;
}
