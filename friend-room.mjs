import { validCompanionElement } from './companion-elements.mjs?v=20261030-elements-88';
export const FRIEND_ROOM_ASSETS = Object.freeze({
 metal:'assets/shared-elements-20261030-88/metal-room.png',
 wood:'assets/shared-elements-20261030-88/wood-room.png',
 water:'assets/shared-elements-20261030-88/water-room.png',
 fire:'assets/shared-elements-20261030-88/fire-room.png',
 earth:'assets/shared-elements-20261030-88/earth-room.png',
});
// Retained only for older imports; active shared seats use element-character-art.
export const SEATED_KLIN_ASSET = 'assets/shared-room-20261027-61/klin-seated-selected.png';
export const FRIEND_ROOM_KINDS = Object.freeze({b:'wood',c:'water',d:'metal',e:'wood',f:'fire',g:'wood',h:'water',i:'earth'});
export function friendRoomKind(person) {
 const element=person?.companion?.element;
 return validCompanionElement(element)?element:'metal';
}
export function friendRoomScene(person) {return FRIEND_ROOM_ASSETS[friendRoomKind(person)];}
