/** Explicit Demo presets only: never infer an element from birth data or a room. */
export const ELEMENT_COMPANIONS = Object.freeze({
  metal:Object.freeze({id:'klin',name:'Klin'}),
  wood:Object.freeze({id:'spri',name:'Spri'}),
  water:Object.freeze({id:'lumi',name:'Lumi'}),
  fire:Object.freeze({id:'flar',name:'Flar'}),
  earth:Object.freeze({id:'terr',name:'Terr'}),
});
export const DEMO_COMPANION_ELEMENTS = Object.freeze({a:'metal',b:'wood',c:'water',d:'metal',e:'wood',f:'fire',g:'wood',h:'water',i:'earth'});
export const validCompanionElement = value => Object.hasOwn(ELEMENT_COMPANIONS,value);

/** Use only an explicit assigned family for the current owner's presentation.
 * Preserve the stored profile and all other participants; never derive identity. */
export function companionDisplayProfile(profile, { ownerId, activeId, family, serverName } = {}) {
  if (typeof ownerId !== 'string' || !ownerId || ownerId !== activeId || typeof family?.id !== 'string' || !validCompanionElement(family.id)) return profile;
  const element = family.id;
  const explicitName = typeof serverName === 'string' ? serverName.trim() : '';
  const savedName = typeof profile?.name === 'string' ? profile.name.trim() : '';
  // Only the legacy Klin default follows an explicitly assigned family. A
  // supplied server name (including Klin) and the user's chosen name stay intact.
  const name = explicitName || (savedName && savedName !== 'Klin' ? savedName : ELEMENT_COMPANIONS[element].name);
  return {...profile, element, id:ELEMENT_COMPANIONS[element].id, name};
}
