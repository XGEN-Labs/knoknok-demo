// Door and interior share one stable owner mapping, independent of ranking.
export const FRIEND_ROOM_KINDS = Object.freeze({b:'wood',c:'water',d:'earth',e:'wood',f:'earth',g:'wood',h:'water',i:'earth'});
export const FRIEND_ROOM_ASSETS = Object.freeze({wood:'assets/shared-room-20261027-61/wood.png',water:'assets/shared-room-20261027-61/water.png',earth:'assets/shared-room-20261027-61/earth.png'});
export const SEATED_KLIN_ASSET = 'assets/shared-room-20261027-61/klin-seated-v3.png';
export function friendRoomKind(person) {
  const selected = person?.room?.kind;
  return Object.hasOwn(FRIEND_ROOM_ASSETS, selected) ? selected : FRIEND_ROOM_KINDS[person?.id] || 'earth';
}
export function friendRoomScene(person) {return FRIEND_ROOM_ASSETS[friendRoomKind(person)];}
