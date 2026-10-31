import { ELEMENT_COMPANIONS, validCompanionElement } from './companion-elements.mjs?v=20261031-product-sync';
export const ELEMENT_CHARACTER_ATLAS = 'assets/shared-elements-20261030-88/characters.png';
const CELLS = Object.freeze({metal:[0,310],wood:[310,604],water:[604,900],fire:[900,1199],earth:[1199,1499]});
const HEADS = Object.freeze({metal:[51,300,240,240],wood:[337,283,240,240],water:[630,299,240,240],fire:[927,295,240,240],earth:[1223,300,240,240]});
export function characterArt(profile={}) {
 const element=validCompanionElement(profile.element)?profile.element:'metal',stage=profile.stage==='juvenile'?'juvenile':'adult';
 const [left,right]=CELLS[element],baby=stage==='juvenile';
 return {element,stage,src:ELEMENT_CHARACTER_ATLAS,frame:[left,baby?645:100,right-left,baby?325:520]};
}
export function companionWithArtwork(profile={}) {
 const art=characterArt(profile),head=art.stage==='adult'?HEADS[art.element]:[art.frame[0],art.frame[1],art.frame[2],art.frame[3]];
 return {...profile,element:art.element,name:profile.name||ELEMENT_COMPANIONS[art.element].name,avatar:art.src,avatarFrame:{x:head[0],y:head[1],width:head[2],height:head[3],sheetWidth:1499,sheetHeight:1049}};
}
