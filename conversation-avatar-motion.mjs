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

const validRectangle = value => value && ['x','y','width','height'].every(key=>Number.isFinite(value[key])) && value.width>0 && value.height>0;
function avatarSource(value) {
  if(typeof value==='string')return value?{src:value}:null;
  if(!value || typeof value.src!=='string' || !value.src)return null;
  if(!value.crop)return {src:value.src};
  if(!(value.width>0&&value.height>0&&validRectangle(value.crop)&&value.crop.width===value.crop.height))return null;
  return value;
}
export function applyConversationAvatarSource(container,image,value) {
  const source=avatarSource(value);if(!container||!image||!source)return false;
  image.src=source.src;
  if(source.crop){
    const c=source.crop;
    Object.assign(container.style,{position:'relative',overflow:'hidden',borderRadius:'50%'});
    Object.assign(image.style,{position:'absolute',maxWidth:'none',width:`${source.width/c.width*100}%`,height:`${source.height/c.height*100}%`,left:`${-c.x/c.width*100}%`,top:`${-c.y/c.height*100}%`,objectFit:'fill'});
  }else{
    for(const key of ['position','overflow','borderRadius'])container.style[key]='';
    for(const key of ['position','maxWidth','width','height','left','top','objectFit'])image.style[key]='';
  }
  return true;
}

export function createConversationAvatarMotion(phone, {duration = 620, imageSrc = '', roomFrame} = {}) {
  const doc = phone.ownerDocument, win = doc.defaultView;
  let flight = null, flightSource = null, animation = null, complete = null, entering = false, started = 0;
  let handoff = null, generation = 0, phase = 'idle', still = false;
  const roomImage = () => phone.querySelector('.klin-illustrated-actor.is-primary .klin-illustrated-art') || phone.querySelector('.home-companion img');
  const avatar = () => phone.querySelector('.home-chat-avatar img');
  const readSource = () => avatarSource(typeof imageSrc==='function'?imageSrc():imageSrc);
  const roomAnchor = () => {const rect=roomFrame?.();return validRectangle(rect)?rect:(flightSource||readSource())?.crop?null:avatarImageRect(roomImage(),phone);};
  const destinationRect = () => entering ? avatarImageRect(flightSource?.crop?avatar()?.parentElement:avatar(),phone) : roomAnchor();
  const stopAnimation = () => { const previous = animation; animation = null; previous?.cancel(); };
  const finish = (committed = false) => {
    generation++; phase = 'idle';
    stopAnimation(); flight?.remove(); flight = null; flightSource = null;
    delete phone.dataset.conversationAvatarMotion;
    const previous = handoff; handoff = null;
    if (committed) previous?.complete(); else previous?.cancel();
    const callback = complete; complete = null; callback?.();
  };
  function placeAtDestination() {
    const destination = destinationRect();
    if (!destination || !flight) return false;
    stopAnimation();
    Object.assign(flight.style, {left:`${destination.x}px`, top:`${destination.y}px`, width:`${destination.width}px`, height:`${destination.height}px`});
    return true;
  }
  async function arrive() {
    if (!handoff) {finish(); return;}
    phase = 'waiting'; placeAtDestination();
    const token = generation, pending = handoff;
    let ready = false;
    try {ready = await pending.ready;} catch {}
    if (token !== generation || handoff !== pending) return;
    // Retain the landed image while the first movie frame is unavailable.
    // Navigation/reversal cancels immediately; total media failure releases the
    // bridge to the existing scene fallback instead of trapping its ownership.
    if (!ready) {finish(); return;}
    const fadeDuration = still ? 0 : 150;
    if (!pending.reveal({duration:fadeDuration})) {finish(); return;}
    phase = 'blending';
    if (!fadeDuration || !flight?.animate) {finish(true); return;}
    const fade = flight.animate([{opacity:1}, {opacity:0}], {duration:fadeDuration, easing:'ease-out', fill:'both'});
    animation = fade;
    fade.finished.then(() => {if (animation === fade && token === generation) finish(true);}, () => {});
  }
  function animateFrom(source, remaining = duration) {
    const destination = destinationRect();
    if (!source || !destination || !flight?.animate) { arrive(); return; }
    stopAnimation(); phase = 'moving';
    Object.assign(flight.style, {left:`${source.x}px`, top:`${source.y}px`, width:`${source.width}px`, height:`${source.height}px`});
    const current = flight.animate([
      {transform:'translate(0px, 0px) scale(1, 1)'},
      {transform:`translate(${destination.x-source.x}px, ${destination.y-source.y}px) scale(${destination.width/source.width}, ${destination.height/source.height})`},
    ], {duration:remaining, easing:'cubic-bezier(.22,.72,.2,1)', fill:'both'});
    animation = current;
    current.finished.then(() => {if (animation === current) arrive();}, () => {});
  }
  function move(value, {reducedMotion = false, prepareReturn, mutate, onComplete} = {}) {
    const sourceImage = flight || (value ? roomImage() : avatar());
    const descriptor = flightSource || readSource() || avatarSource(sourceImage?.currentSrc || sourceImage?.src);
    const source = flight ? avatarImageRect(flight,phone) : value && descriptor?.crop ? roomAnchor() : avatarImageRect(!value&&descriptor?.crop?avatar()?.parentElement:sourceImage,phone);
    // Keep a reversal on its currently visible image; a fresh HOME flight can
    // use the film-matched avatar without changing cards or other scene actors.
    const src = descriptor?.src;
    // A reversal starts at the currently displayed frame, never at an endpoint.
    finish(); entering = !!value; complete = onComplete; still = reducedMotion;
    // Establish ownership before mutate can activate the room at frame zero.
    phone.dataset.conversationAvatarMotion = entering ? 'enter' : 'leave';
    mutate?.();
    if (!entering && !doc.hidden) handoff = prepareReturn?.() || null;
    if (doc.hidden || !source || !src || (reducedMotion && !handoff)) {finish(); return;}
    flightSource = descriptor;
    flight = doc.createElement(descriptor.crop?'span':'img'); flight.className = 'conversation-avatar-flight';
    if(descriptor.crop){const image=doc.createElement('img');image.alt='';image.draggable=false;flight.append(image);applyConversationAvatarSource(flight,image,descriptor);Object.assign(flight.style,{position:'absolute',display:'block',pointerEvents:'none',transformOrigin:'top left'});}
    else {flight.src=src;flight.alt='';flight.draggable=false;}
    flight.setAttribute('aria-hidden','true');
    phone.append(flight);
    started = win.performance.now();
    if (reducedMotion) arrive(); else animateFrom(source);
  }
  function refresh({reducedMotion = false} = {}) {
    if (!flight) return;
    if (!phone.querySelector('.room-chat-page')) {finish(); return;}
    if (phase === 'waiting') {still ||= reducedMotion; placeAtDestination(); return;}
    if (phase === 'blending') {
      // Keep the opacity animation; resize only retargets the fixed endpoint.
      const destination = destinationRect();
      if (destination) Object.assign(flight.style, {left:`${destination.x}px`, top:`${destination.y}px`, width:`${destination.width}px`, height:`${destination.height}px`});
      if (reducedMotion) finish(true);
      return;
    }
    if (reducedMotion) {still = true; if (handoff) arrive(); else finish(); return;}
    const remaining = Math.max(120, duration - (win.performance.now() - started));
    animateFrom(avatarImageRect(flight, phone), remaining);
  }
  const resize = new win.ResizeObserver(() => refresh()); resize.observe(phone);
  const visibility = () => {if (doc.hidden) finish();};
  doc.addEventListener('visibilitychange', visibility);
  return {move, refresh, cancel:()=>finish(), dispose(){finish();resize.disconnect();doc.removeEventListener('visibilitychange',visibility);}, get active(){return !!flight;}};
}
