const openingRoutes = new Set(['welcome', 'login', 'register', 'verify']);
const anchorSelector = '.welcome .brand > .brand-logo, .auth-page .auth-brand > .brand-logo';

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
  let image = null, animation = null, destination = null, route = null, reduced = false, disposed = false;
  const stop = () => {const previous=animation; animation=null; previous?.cancel();};
  const settle = () => {stop(); if(image) phone.dataset.openingLogoMotion='settled';};
  function clear() {
    stop(); image?.remove(); image=null; destination=null;
    delete phone.dataset.openingLogo;
    delete phone.dataset.openingLogoMotion;
  }
  function sync({route:nextRoute=route, animate=true, reducedMotion=reduced} = {}) {
    if(disposed) return;
    route=nextRoute; reduced=reducedMotion;
    const anchor=openingRoutes.has(route) ? phone.querySelector(anchorSelector) : null;
    const target=logoRect(anchor,phone);
    if(!anchor || !target) {clear(); return;}
    // A same-route refresh (validation/countdown) does not restart an ongoing trip.
    if(image && sameRect(destination,target)) {if(reduced || doc.hidden) settle(); return;}
    const source=logoRect(image,phone);
    stop();
    if(!image) {
      image=doc.createElement('img'); image.className='opening-logo-image';
      image.src=anchor.currentSrc || anchor.src; image.alt=''; image.draggable=false;
      image.setAttribute('aria-hidden','true'); phone.append(image);
    }
    destination=target;
    Object.assign(image.style,{left:`${target.x}px`,top:`${target.y}px`,width:`${target.width}px`,height:`${target.height}px`});
    phone.dataset.openingLogo='true';
    phone.dataset.openingLogoMotion='settled';
    if(!source || !animate || reduced || doc.hidden || !image.animate || sameRect(source,target)) return;
    const current=image.animate([
      {transform:`translate(${source.x-target.x}px, ${source.y-target.y}px) scale(${source.width/target.width}, ${source.height/target.height})`},
      {transform:'translate(0px, 0px) scale(1, 1)'},
    ],{duration,easing:'cubic-bezier(.22,.72,.2,1)',fill:'both'});
    animation=current; phone.dataset.openingLogoMotion='moving';
    current.finished.then(()=>{if(animation===current) settle();},()=>{});
  }
  const resize=new win.ResizeObserver(()=>sync({animate:!!animation})); resize.observe(phone);
  const visibility=()=>{if(doc.hidden) settle();};
  doc.addEventListener('visibilitychange',visibility);
  return {sync, get active(){return !!animation;}, dispose(){disposed=true;clear();resize.disconnect();doc.removeEventListener('visibilitychange',visibility);}};
}
