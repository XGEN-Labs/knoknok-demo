// Measure the displayed image, including contain-fit padding and a scaled phone
// preview. One temporary image bridges the room and the persistent header.
export function avatarImageRect(image, phone) {
  if (!image || !phone) return null;
  const box = image.getBoundingClientRect(), bounds = phone.getBoundingClientRect();
  if (!box.width || !box.height || !bounds.width || !bounds.height) return null;
  const css = phone.ownerDocument.defaultView.getComputedStyle(image);
  const scale = bounds.width / (phone.offsetWidth || phone.clientWidth || bounds.width);
  const px = key => (parseFloat(css[key]) || 0) * scale;
  const left = px('paddingLeft') + px('borderLeftWidth'), top = px('paddingTop') + px('borderTopWidth');
  let width = box.width - left - px('paddingRight') - px('borderRightWidth');
  let height = box.height - top - px('paddingBottom') - px('borderBottomWidth');
  let x = box.left + left, y = box.top + top;
  if (css.objectFit === 'contain' && image.naturalWidth && image.naturalHeight) {
    const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const fittedWidth = image.naturalWidth * ratio, fittedHeight = image.naturalHeight * ratio;
    x += (width - fittedWidth) / 2; y += (height - fittedHeight) / 2;
    width = fittedWidth; height = fittedHeight;
  }
  return {x:(x - bounds.left) / scale - (phone.clientLeft || 0), y:(y - bounds.top) / scale - (phone.clientTop || 0), width:width / scale, height:height / scale};
}

export function createConversationAvatarMotion(phone, {duration = 620} = {}) {
  const doc = phone.ownerDocument, win = doc.defaultView;
  let flight = null, animation = null, complete = null, entering = false, started = 0;
  const roomImage = () => phone.querySelector('.klin-illustrated-actor.is-primary .klin-illustrated-art') || phone.querySelector('.home-companion img');
  const avatar = () => phone.querySelector('.home-chat-avatar img');
  const target = () => entering ? avatar() : roomImage();
  const stopAnimation = () => { const previous = animation; animation = null; previous?.cancel(); };
  const finish = () => {
    stopAnimation(); flight?.remove(); flight = null;
    delete phone.dataset.conversationAvatarMotion;
    const callback = complete; complete = null; callback?.();
  };
  function animateFrom(source, remaining = duration) {
    const destination = avatarImageRect(target(), phone);
    if (!source || !destination || !flight?.animate) { finish(); return; }
    stopAnimation();
    Object.assign(flight.style, {left:`${source.x}px`, top:`${source.y}px`, width:`${source.width}px`, height:`${source.height}px`});
    const current = flight.animate([
      {transform:'translate(0px, 0px) scale(1, 1)'},
      {transform:`translate(${destination.x-source.x}px, ${destination.y-source.y}px) scale(${destination.width/source.width}, ${destination.height/source.height})`},
    ], {duration:remaining, easing:'cubic-bezier(.22,.72,.2,1)', fill:'both'});
    animation = current;
    current.finished.then(() => {if (animation === current) finish();}, () => {});
  }
  function move(value, {reducedMotion = false, mutate, onComplete} = {}) {
    const sourceImage = flight || (value ? roomImage() : avatar());
    const source = avatarImageRect(sourceImage, phone), src = sourceImage?.currentSrc || sourceImage?.src;
    // A reversal starts at the currently displayed frame, never at an endpoint.
    finish(); entering = !!value; complete = onComplete;
    mutate?.();
    if (reducedMotion || doc.hidden || !source || !src) {finish(); return;}
    flight = doc.createElement('img'); flight.className = 'conversation-avatar-flight';
    flight.src = src; flight.alt = ''; flight.draggable = false; flight.setAttribute('aria-hidden','true');
    phone.append(flight); phone.dataset.conversationAvatarMotion = entering ? 'enter' : 'leave';
    started = win.performance.now(); animateFrom(source);
  }
  function refresh({reducedMotion = false} = {}) {
    if (!flight) return;
    if (reducedMotion || !phone.querySelector('.room-chat-page')) {finish(); return;}
    const remaining = Math.max(120, duration - (win.performance.now() - started));
    animateFrom(avatarImageRect(flight, phone), remaining);
  }
  const resize = new win.ResizeObserver(() => refresh()); resize.observe(phone);
  const visibility = () => {if (doc.hidden) finish();};
  doc.addEventListener('visibilitychange', visibility);
  return {move, refresh, cancel:finish, dispose(){finish();resize.disconnect();doc.removeEventListener('visibilitychange',visibility);}, get active(){return !!flight;}};
}
