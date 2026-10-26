const openingRoutes = new Set(['welcome', 'login', 'register', 'verify']);
const anchorSelector = '.welcome .brand > .brand-logo, .auth-page .auth-brand > .brand-logo';
const formAnchorSelector = '.auth-page .auth-form-brand > .brand-logo';
const whiteInk = 'brightness(0) invert(1)', blackInk = 'brightness(0) invert(0)';

/** Image coordinates in the phone's own space, including scaled desktop previews. */
export function logoRect(image, phone) {
  if (!image || !phone) return null;
  const box = image.getBoundingClientRect(), bounds = phone.getBoundingClientRect();
  if (!box.width || !box.height || !bounds.width) return null;
  const scale = bounds.width / (phone.offsetWidth || phone.clientWidth || bounds.width);
  return {x:(box.left-bounds.left)/scale-(phone.clientLeft||0), y:(box.top-bounds.top)/scale-(phone.clientTop||0), width:box.width/scale, height:box.height/scale};
}
const sameRect = (a, b) => a && b && ['x','y','width','height'].every(key => Math.abs(a[key]-b[key]) < .1);

/** One visible image survives page replacement. Existing images only define layout
 *  and accessible text; a reversal starts at the displayed frame, never an endpoint. */
export function createWelcomeLogoMotion(phone, {duration = 680} = {}) {
  const doc = phone.ownerDocument, win = doc.defaultView;
  let image = null, animation = null, destination = null, destinationInk = null, destinationAnchor = null, route = null, reduced = false, disposed = false;
  const stop = () => {const previous=animation; animation=null; previous?.cancel();};
  // The form can scroll on short/keyboard screens. Keep the shared image inside
  // its actual visible form area after the trip, instead of floating over fields.
  function clipToForm() {
    if(!image) return;
    const panel=destinationAnchor?.closest?.('.auth-panel'), bounds=logoRect(panel,phone), box=logoRect(image,phone);
    image.style.clipPath=bounds&&box ? `inset(${Math.max(0,bounds.y-box.y)}px ${Math.max(0,box.x+box.width-bounds.x-bounds.width)}px ${Math.max(0,box.y+box.height-bounds.y-bounds.height)}px ${Math.max(0,bounds.x-box.x)}px)` : 'none';
  }
  const settle = () => {stop(); if(image) {phone.dataset.openingLogoMotion='settled';clipToForm();}};
  function clear() {
    stop(); image?.remove(); image=null; destination=null; destinationInk=null; destinationAnchor=null;
    delete phone.dataset.openingLogo;
    delete phone.dataset.openingLogoMotion;
  }
  function sync({route:nextRoute=route, animate=true, reducedMotion=reduced} = {}) {
    if(disposed) return;
    route=nextRoute; reduced=reducedMotion;
    const anchor=openingRoutes.has(route) ? phone.querySelector(formAnchorSelector)||phone.querySelector(anchorSelector) : null;
    const target=logoRect(anchor,phone);
    if(!anchor || !target) {clear(); return;}
    const ink=anchor.dataset?.logoTone==='dark' ? blackInk : whiteInk;
    // A same-route refresh (validation/countdown) does not restart an ongoing trip.
    if(image && sameRect(destination,target) && destinationInk===ink) {destinationAnchor=anchor;if(reduced || doc.hidden) settle();else if(!animation)clipToForm();return;}
    const source=logoRect(image,phone);
    // Read the rendered filter before cancelling, so mid-trip reversal keeps its
    // current gray value just as it keeps its current position and scale.
    const sourceInk=image ? win.getComputedStyle?.(image)?.filter || image.style.filter || whiteInk : null;
    stop();
    if(!image) {
      image=doc.createElement('img'); image.className='opening-logo-image';
      image.src=anchor.currentSrc || anchor.src; image.alt=''; image.draggable=false;
      image.setAttribute('aria-hidden','true'); phone.append(image);
    }
    destination=target;destinationInk=ink;destinationAnchor=anchor;
    Object.assign(image.style,{left:`${target.x}px`,top:`${target.y}px`,width:`${target.width}px`,height:`${target.height}px`,filter:ink,clipPath:'none'});
    phone.dataset.openingLogo='true';
    phone.dataset.openingLogoMotion='settled';
    if(!source || !animate || reduced || doc.hidden || !image.animate || (sameRect(source,target)&&sourceInk===ink)) {clipToForm();return;}
    const current=image.animate([
      {transform:`translate(${source.x-target.x}px, ${source.y-target.y}px) scale(${source.width/target.width}, ${source.height/target.height})`,filter:sourceInk},
      {transform:'translate(0px, 0px) scale(1, 1)',filter:ink},
    ],{duration,easing:'cubic-bezier(.22,.72,.2,1)',fill:'both'});
    animation=current; phone.dataset.openingLogoMotion='moving';
    current.finished.then(()=>{if(animation===current) settle();},()=>{});
  }
  const resize=new win.ResizeObserver(()=>sync({animate:!!animation})); resize.observe(phone);
  const visibility=()=>{if(doc.hidden) settle();};
  doc.addEventListener('visibilitychange',visibility);
  const scroll=()=>sync({animate:false});phone.addEventListener('scroll',scroll,true);
  return {sync, get active(){return !!animation;}, dispose(){disposed=true;clear();resize.disconnect();doc.removeEventListener('visibilitychange',visibility);phone.removeEventListener('scroll',scroll,true);}};
}
