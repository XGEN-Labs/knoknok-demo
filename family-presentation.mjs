import {families} from './studio-family-data.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function assignedFamily(bootstrap){
 if(bootstrap?.landingCreation?.flow!=='landing-v1'||bootstrap.landingCreation.state!=='submitted')return null;
 return families.find(f=>f.id===bootstrap.landingCreation.selection?.familyId)||null;
}
export function familyArtwork(familyId,stage='adult',view='full'){
 if(!families.some(f=>f.id===familyId))return null;
 const phase=stage==='juvenile'?'baby':'adult';
 const key=view==='head'?(phase==='baby'?'babyHead':'head'):phase;
 return `assets/studio-family-artwork.svg#${familyId}-${key}`;
}
export function familyMarkup(familyId,{stage='adult',label='',attrs=''}={}){
 const src=familyArtwork(familyId,stage);if(!src)return '';
 return `<span class="companion-art klin-art" data-companion="${familyId}" data-stage="${stage}" role="img" aria-label="${esc(label)}" ${attrs}><img class="figma-companion-image" src="${src}" width="768" height="768" alt="" aria-hidden="true" draggable="false"></span>`;
}
