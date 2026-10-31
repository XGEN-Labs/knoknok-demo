import {socialTagState} from './social-tags.mjs';
import {socialTagStickerMarkup} from './tag-stickers.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const action=(label,key,id,attrs='')=>`<button type="button" class="tag-ui-button" data-action="${key}" data-id="${esc(id)}" ${attrs}>${label}</button>`;
export function cardTagsManagementMarkup(space,user){
 const tags=socialTagState(space,user).items,shown=tags.filter(t=>t.visible),hidden=tags.filter(t=>!t.visible);
 const row=(t,i)=>`<div class="tag-management-row">${socialTagStickerMarkup(t)}<div class="tag-row-actions">${t.visible?`${action('↑','tag-move',t.id,`data-direction="-1" aria-label="上移 ${esc(t.label)}" ${i===0?'disabled':''}`)}${action('↓','tag-move',t.id,`data-direction="1" aria-label="下移 ${esc(t.label)}" ${i===shown.length-1?'disabled':''}`)}`:''}${action(t.visible?'收起':'展示',t.visible?'tag-hide':'tag-restore',t.id)}</div></div>`;
 return `<div class="social-tags-panel card-tags-only"><p class="small-note">調整名片展示的標籤與順序，最多展示 7 枚。</p><div class="tag-management-list">${shown.map(row).join('')||'<p>名片上還沒有展示標籤。</p>'}</div>${hidden.length?`<details class="tag-history"><summary>已收起（${hidden.length}）</summary>${hidden.map(row).join('')}</details>`:''}</div>`;
}
