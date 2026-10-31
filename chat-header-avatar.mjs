// Static transparent portraits on the original Klin solid background.
// The header uses these alpha pixels; travel has its own measured geometry.
import {applyConversationAvatarSource} from './conversation-avatar-motion.mjs?v=20261101-avatar-flight-v06g';
const portraits = {"wood": {"src": "assets/chat-avatars-20261101/spri.png", "width": 640, "height": 640, "crop": {"x": 19.0, "y": 38.0, "width": 600.0, "height": 600.0}}, "water": {"src": "assets/chat-avatars-20261101/lumi.png", "width": 640, "height": 640, "crop": {"x": 55.71428571428572, "y": 102.21428571428572, "width": 528.5714285714286, "height": 528.5714285714286}}, "fire": {"src": "assets/chat-avatars-20261101/flar.png", "width": 640, "height": 640, "crop": {"x": 2.857142857142833, "y": 8.857142857142833, "width": 634.2857142857143, "height": 634.2857142857143}}, "earth": {"src": "assets/chat-avatars-20261101/terr.png", "width": 640, "height": 640, "crop": {"x": 55.92857142857139, "y": 107.92857142857139, "width": 527.1428571428572, "height": 527.1428571428572}}};
const klin = 'assets/klin-avatar-20261029-v10/avatar.png';
export function chatHeaderAvatar(element) {return Object.hasOwn(portraits,element)?portraits[element]:{src:klin};}
export function applyChatHeaderAvatar(container,image,element) {
 const portrait=chatHeaderAvatar(element);
 if(!applyConversationAvatarSource(container,image,portrait))return false;
 // Cropped alpha canvases already include their optical padding. Klin uses
 // exactly its previous 3px CSS padding and original transparent artwork.
 image.style.padding=portrait.crop?'0':'';
 return true;
}
