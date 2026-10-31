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
    Object.assign(image.style,{position:'absolute',maxWidth:'none',padding:'0',width:`${source.width/c.width*100}%`,height:`${source.height/c.height*100}%`,left:`${-c.x/c.width*100}%`,top:`${-c.y/c.height*100}%`,objectFit:'fill'});
  }else{
    for(const key of ['position','overflow','borderRadius'])container.style[key]='';
    for(const key of ['position','maxWidth','padding','width','height','left','top','objectFit'])image.style[key]='';
  }
  return true;
}

export function createConversationAvatarMotion(phone, {duration = 620, imageSrc = '', roomFrame} = {}) {
  const doc = phone.ownerDocument, win = doc.defaultView;
  const later = win.setTimeout?.bind(win) || setTimeout;
  const clearLater = win.clearTimeout?.bind(win) || clearTimeout;
  let flight = null, flightSource = null, animation = null, opacityAnimation = null, complete = null, entering = false, started = 0;
  let handoff = null, entryHandoff = null, generation = 0, phase = 'idle', still = false;
  let destinationRect = null, blendTimer = null, landed = false, returnReady = false, returnBlending = false, returnBlended = false;
  const roomImage = () => phone.querySelector('.klin-illustrated-actor.is-primary .klin-illustrated-art') || phone.querySelector('.home-companion img');
  const avatar = () => phone.querySelector('.home-chat-avatar img');
  const readSource = () => avatarSource(typeof imageSrc==='function'?imageSrc():imageSrc);
  const roomAnchor = () => {const rect=roomFrame?.();return validRectangle(rect)?rect:(flightSource||readSource())?.crop?null:avatarImageRect(roomImage(),phone);};
  const targetRect = () => entering ? avatarImageRect(flightSource?.crop?avatar()?.parentElement:avatar(),phone) : roomAnchor();
  const stopAnimation = () => { const previous = animation; animation = null; previous?.cancel(); };
  const stopOpacity = () => { const previous = opacityAnimation; opacityAnimation = null; previous?.cancel(); };
  const clearBlendTimer = () => { if (blendTimer !== null) clearLater(blendTimer); blendTimer = null; };
  const finish = (committed = false, notify = true) => {
    generation++; phase = 'idle'; destinationRect = null;
    clearBlendTimer();
    // Detach first: cancelling a compositor effect on a visible bridge can
    // briefly expose its source rectangle in WebKit.
    flight?.remove(); flight = null; flightSource = null; stopAnimation(); stopOpacity();
    delete phone.dataset.conversationAvatarMotion;
    const departure = entryHandoff; entryHandoff = null; departure?.cancel();
    const previous = handoff; handoff = null;
    if (committed) previous?.complete(); else previous?.cancel();
    const callback = complete; complete = null; if (notify) callback?.();
  };
  function placeAtDestination() {
    const destination = targetRect();
    if (!destination || !flight) return false;
    stopAnimation(); destinationRect = destination;
    Object.assign(flight.style, {left:`${destination.x}px`, top:`${destination.y}px`, width:`${destination.width}px`, height:`${destination.height}px`});
    return true;
  }
  function blendReturn() {
    if (!handoff || returnBlending || !returnReady || !flight) return;
    const pending = handoff, token = generation, fadeDuration = still ? 0 : 120;
    if (!pending.reveal({duration:fadeDuration})) { if (landed) finish(); return; }
    returnBlending = true;
    if (!fadeDuration || !flight.animate) {returnBlended = true; if (landed) finish(true); return;}
    stopOpacity();
    const fade = flight.animate([{opacity:1}, {opacity:0}], {duration:fadeDuration, easing:'ease-in-out', fill:'both'});
    opacityAnimation = fade;
    fade.finished.then(() => {
      if (token !== generation || opacityAnimation !== fade || handoff !== pending) return;
      returnBlended = true;
      if (landed) finish(true);
    }, () => {});
  }
  async function arrive() {
    landed = true; clearBlendTimer();
    if (!handoff) {finish(); return;}
    phase = 'waiting'; placeAtDestination();
    if (returnBlended) {finish(true); return;}
    if (returnBlending) return;
    const token = generation, pending = handoff;
    let ready = false;
    try {ready = await pending.ready;} catch {}
    if (token !== generation || handoff !== pending) return;
    if (!ready) {finish(); return;}
    returnReady = true; blendReturn();
  }
  function animateFrom(source, remaining = duration) {
    const destination = targetRect();
    if (!source || !destination || !flight?.animate) { arrive(); return; }
    stopAnimation(); clearBlendTimer(); phase = 'moving'; destinationRect = destination;
    Object.assign(flight.style, {left:`${source.x}px`, top:`${source.y}px`, width:`${source.width}px`, height:`${source.height}px`});
    const current = flight.animate([
      {transform:'translate3d(0px, 0px, 0px) scale(1, 1)'},
      {transform:`translate3d(${destination.x-source.x}px, ${destination.y-source.y}px, 0px) scale(${destination.width/source.width}, ${destination.height/source.height})`},
    ], {duration:remaining, easing:'cubic-bezier(.4,0,.2,1)', fill:'both'});
    animation = current;
    // Blend over the last part of the same trip instead of landing, stopping,
    // then starting a second animation. A cold/failed frame still has the
    // existing readiness gate after arrival.
    if (!entering && handoff && !returnBlending) {
      const token = generation;
      blendTimer = later(() => {blendTimer = null; if (token === generation && animation === current) blendReturn();}, Math.max(0, remaining - 120));
    }
    current.finished.then(() => {if (animation === current) arrive();}, () => {});
  }
  async function depart(source) {
    const token = generation, pending = entryHandoff, image = flight;
    phase = 'entry-preparing';
    Object.assign(image.style, {left:`${source.x}px`, top:`${source.y}px`, width:`${source.width}px`, height:`${source.height}px`, opacity:'0'});
    try {await (image.tagName?.toLowerCase()==='span'?image.querySelector?.('img'):image).decode?.();} catch {if (token === generation && image === flight) finish(); return;}
    if (token !== generation || image !== flight || pending !== entryHandoff) return;
    if (!pending.reveal({duration:120})) {finish(); return;}
    started = win.performance.now(); animateFrom(source);
    // Source handoff and travel share a start time; no frozen 120ms prelude.
    if (!image.animate) {image.style.opacity = '1'; entryHandoff = null; pending.complete(); return;}
    const fade = image.animate([{opacity:0}, {opacity:1}], {duration:120, easing:'ease-in-out', fill:'both'});
    opacityAnimation = fade;
    fade.finished.then(() => {
      if (token !== generation || image !== flight || opacityAnimation !== fade || entryHandoff !== pending) return;
      // Keep the filled opacity effect on the same compositor layer until
      // landing; cancelling it here can force WebKit to rasterize mid-flight.
      entryHandoff = null; pending.complete();
    }, () => {});
  }
  function move(value, {reducedMotion = false, prepareEntry, prepareReturn, mutate, onComplete} = {}) {
    if (!value && entryHandoff && phase === 'entry-preparing') {
      complete = null; mutate?.(); complete = onComplete; finish(); return;
    }
    const reversing = !!flight, sourceImage = flight || (value ? roomImage() : avatar());
    const requested = readSource(), header = avatar();
    const descriptor = flightSource || (requested?.crop ? requested : avatarSource(header?.currentSrc || header?.src) || requested || avatarSource(sourceImage?.currentSrc || sourceImage?.src));
    const source = flight ? avatarImageRect(flight,phone) : value && descriptor?.crop ? roomAnchor() : avatarImageRect(!value&&descriptor?.crop?header?.parentElement:sourceImage,phone);
    const src = descriptor?.src;
    finish(false, false); entering = !!value; complete = onComplete; still = reducedMotion;
    landed = returnReady = returnBlending = returnBlended = false;
    if (entering && !reversing && !reducedMotion && !doc.hidden && source && src) entryHandoff = prepareEntry?.() || null;
    phone.dataset.conversationAvatarMotion = entering ? 'enter' : 'leave';
    mutate?.();
    if (!entering && !doc.hidden) {
      handoff = prepareReturn?.() || null;
      const pending = handoff, token = generation;
      if (pending) Promise.resolve(pending.ready).then(ready => {if (generation === token && handoff === pending) returnReady = !!ready;}, () => {});
    }
    if (doc.hidden || !source || !src || (reducedMotion && !handoff)) {finish(); return;}
    flightSource = descriptor;
    flight = doc.createElement(descriptor.crop?'span':'img'); flight.className = 'conversation-avatar-flight';
    if(descriptor.crop){const image=doc.createElement('img');image.alt='';image.draggable=false;flight.append(image);applyConversationAvatarSource(flight,image,descriptor);Object.assign(flight.style,{position:'absolute',display:'block',pointerEvents:'none',transformOrigin:'top left'});}
    else {flight.src=src;flight.alt='';flight.draggable=false;}
    // A crop describes alpha-canvas alignment, not a circular room photograph.
    if(descriptor.alpha)Object.assign(flight.style,{overflow:'visible',borderRadius:'0',background:'transparent',border:'0',boxShadow:'none'});
    flight.setAttribute('aria-hidden','true');
    phone.append(flight); started = win.performance.now();
    if (reducedMotion) arrive(); else if (entryHandoff) depart(source); else animateFrom(source);
  }
  function refresh({reducedMotion = false} = {}) {
    if (!flight) return;
    if (!phone.querySelector('.room-chat-page')) {finish(); return;}
    if (phase === 'entry-preparing') {
      if (reducedMotion) {finish(); return;}
      const origin = flightSource?.crop ? roomAnchor() : entryHandoff?.frame?.() || roomAnchor();
      if (origin) Object.assign(flight.style, {left:`${origin.x}px`, top:`${origin.y}px`, width:`${origin.width}px`, height:`${origin.height}px`});
      return;
    }
    if (phase === 'waiting') {still ||= reducedMotion; placeAtDestination(); if (reducedMotion && returnBlending) finish(true); return;}
    if (reducedMotion) {still = true; if (handoff) arrive(); else finish(); return;}
    const next = targetRect();
    // Render hooks and ResizeObserver can report unchanged geometry. Restarting
    // the easing there creates a velocity discontinuity in the middle of a trip.
    if (next && destinationRect && ['x','y','width','height'].every(key => Math.abs(next[key]-destinationRect[key]) < .1)) return;
    const remaining = Math.max(120, duration - (win.performance.now() - started));
    animateFrom(avatarImageRect(flight, phone), remaining);
  }
  const resize = new win.ResizeObserver(() => refresh()); resize.observe(phone);
  const visibility = () => {if (doc.hidden) finish();};
  doc.addEventListener('visibilitychange', visibility);
  return {move, refresh, cancel:()=>finish(), dispose(){finish();resize.disconnect();doc.removeEventListener('visibilitychange',visibility);}, get active(){return !!flight;}};
}
