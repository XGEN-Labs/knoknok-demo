export const NOKING_AVATAR_SIZE = 56;

// Anchor to the header avatar, never to a message or the bottom of the log.
export function nokingEntryGeometry(avatar, phone, phoneWidth, size = NOKING_AVATAR_SIZE) {
  const scale = phone.width / phoneWidth;
  if (!(scale > 0 && avatar.width > 0 && avatar.height > 0)) return null;
  const x = (avatar.left + avatar.width / 2 - phone.left) / scale - size / 2;
  const y = (avatar.top + avatar.height - phone.top) / scale - 14;
  return {x, y, width:size, height:size};
}

/** One small native animation stays directly below the header avatar until the
 * request ends. The log slot is a hidden lifecycle marker, never a destination. */
export function createNokingAvatarEntry(phone) {
  const win = phone.ownerDocument.defaultView;
  let slot = null, picture = null, layer = null, generation = 0;
  function clear() {
    generation++;
    if (picture && slot?.isConnected) slot.append(picture);
    layer?.remove(); layer = null; picture = null; slot = null;
    delete phone.dataset.nokingEntry;
  }
  function place() {
    const avatar = phone.querySelector('.home-chat-avatar');
    const g = avatar && nokingEntryGeometry(avatar.getBoundingClientRect(),phone.getBoundingClientRect(),phone.offsetWidth);
    if (!g || !layer) return false;
    Object.assign(layer.style,{left:`${g.x}px`,top:`${g.y}px`,width:`${g.width}px`,height:`${g.height}px`});
    return true;
  }
  async function start(next, reducedMotion) {
    slot = next; picture = next.querySelector('picture');
    if (!picture) { clear(); return; }
    const current = ++generation;
    try { await picture.querySelector('img')?.decode?.(); } catch {}
    if (current !== generation || !slot?.isConnected || phone.dataset.conversation !== 'true') {if(current===generation)clear();return;}
    layer = phone.ownerDocument.createElement('div');
    layer.className = 'noking-avatar-action'; layer.setAttribute('aria-hidden','true');
    layer.dataset.reducedMotion = String(reducedMotion);
    layer.append(picture); phone.append(layer);
    if (!place()) {clear();return;}
    phone.dataset.nokingEntry = 'under-avatar';
  }
  function sync({reducedMotion=false}={}) {
    const next = phone.querySelector('.conversation-log .noking-action');
    if (slot && next === slot && phone.dataset.conversation === 'true') {
      if(layer){layer.dataset.reducedMotion=String(reducedMotion);place();}return;
    }
    if (slot || layer) clear();
    if (next && phone.dataset.conversation === 'true') void start(next,reducedMotion);
  }
  win.addEventListener('resize',place);
  return {sync,cancel:clear,dispose(){clear();win.removeEventListener('resize',place);}};
}
