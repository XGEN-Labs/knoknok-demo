import { klinAssets } from './klin-companion.mjs?v=20261023-original-room-character-39';
import { HOME_SCENE_ASSET, HOME_SCENE_VIDEO_ASSET, VISIT_SCENE_ASSET, SHARED_SCENE_ASSET } from './scene-assets.mjs?v=20261027-room-motion-54c';
import { createRoomVideo } from './room-video.mjs?v=20261027-room-motion-54';

// Restore the selected original PNG and the previous illustrated room directly.
// Native modeling and action drafts remain archived outside this renderer.
const SCENES = Object.freeze({
  home: HOME_SCENE_ASSET,
  porch: VISIT_SCENE_ASSET,
  shared: SHARED_SCENE_ASSET,
  welcome: 'assets/cloud-realm-20261019/arrival.webp',
});
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const isCard = page => ['profile', 'public-card'].includes(page);

export function getIllustratedLayout(page) {
  if (['relations', 'search', 'invite'].includes(page)) return {x: .5, footY: .62, height: .18, world: 'porch', character: false};
  if (['chat', 'connected'].includes(page)) return {x: .5, footY: .68, height: .16, world: 'shared', character: false, shared: false};
  if (isCard(page)) return {x: .5, footY: .68, height: .31, world: 'home', character: false};
  return {x: .5, footY: .68, height: .31, world: 'home'};
}

// Keep the same DOM card anchored to the illustration's raised paw before it
// expands into its final position. This also gives reduced-motion a final frame.
export function illustratedCardFrame(progress, layout, width, height) {
  const p = clamp(progress), offer = Math.sin(p * Math.PI);
  const size = Math.min(height * layout.height, width * .78);
  return {
    progress: p,
    phase: p < .25 ? 'present-card' : p < .76 ? 'offer-card' : 'handoff',
    hand: {x: layout.x + size / width * (.25 - .15 * smooth(p / .4)), y: layout.footY - size / height * .42 - offer * .008},
    rotation: -.14 * (1 - smooth(p / .65)),
  };
}

export function createKlinWorld({host, reducedMotion = false} = {}) {
  if (!host) throw new TypeError('createKlinWorld requires a host element.');
  const doc = host.ownerDocument;
  const win = doc.defaultView || globalThis;
  const now = () => win.performance.now();
  const frame = callback => win.requestAnimationFrame(callback);
  const cancelFrame = id => win.cancelAnimationFrame(id);
  const node = (tag, className) => { const element = doc.createElement(tag); element.className = className; return element; };
  const room = node('div', 'klin-illustrated-room');
  const plates = Object.fromEntries(Object.entries(SCENES).map(([key, src]) => {
    const image = node('img', 'klin-illustrated-plate'); image.alt = ''; image.draggable = false;
    image.src = new URL(src, import.meta.url).href; image.dataset.scene = key; image.hidden = key !== 'home'; room.append(image); return [key, image];
  }));
  const makeActor = className => {
    const anchor = node('div', `klin-illustrated-actor ${className}`), shadow = node('span', 'klin-illustrated-shadow'), artwork = node('img', 'klin-illustrated-art');
    artwork.alt = ''; artwork.draggable = false; artwork.src = new URL(klinAssets.adult, import.meta.url).href;
    anchor.append(shadow, artwork); host.append(anchor); return {anchor, artwork};
  };
  host.append(room);
  const primary = makeActor('is-primary'), secondary = makeActor('is-secondary');
  host.classList.add('klin-illustrated-world'); host.dataset.world = 'loading'; host.dataset.rendering = 'illustrated-2d'; host.dataset.model = 'original-adult-illustration';
  host.parentElement?.setAttribute('data-character-renderer', 'illustrated-2d');
  const state = {page: 'home', stage: 'adult', layout: getIllustratedLayout('home'), reduced: !!reducedMotion, active: true, disposed: false, action: null, frame: 0, conversation: false, participants: [], lounge: {}, realm: {}, portal: 'idle'};
  const roomVideo = createRoomVideo({container: room, src: new URL(HOME_SCENE_VIDEO_ASSET, import.meta.url).href, poster: new URL(HOME_SCENE_ASSET, import.meta.url).href, reducedMotion});
  const dimensions = () => ({width: host.clientWidth || host.getBoundingClientRect().width || 402, height: host.clientHeight || host.getBoundingClientRect().height || 874});
  const stop = () => { if (state.frame) cancelFrame(state.frame); state.frame = 0; state.action = null; host.dataset.transitionPhase = 'idle'; primary.artwork.style.transform = ''; };

  function draw(layout = state.layout) {
    if (state.disposed) return;
    const {width, height} = dimensions(), size = Math.min(height * layout.height, width * .78);
    for (const [key, image] of Object.entries(plates)) image.hidden = key !== layout.world;
    host.dataset.scene = layout.world;
    roomVideo.update({active: state.active && layout.world === 'home', reducedMotion: state.reduced});
    primary.anchor.hidden = layout.character === false;
    secondary.anchor.hidden = !layout.shared;
    for (const [actor, x] of [[primary, layout.x], [secondary, .70]]) {
      actor.anchor.style.left = `${x * 100}%`; actor.anchor.style.top = `${layout.footY * 100}%`;
      actor.anchor.style.width = `${size}px`; actor.anchor.style.height = `${size}px`;
    }
    host.dataset.conversationMode = state.conversation ? 'conversation' : 'idle';
  }
  function setStage(stage) {
    state.stage = stage === 'juvenile' ? 'juvenile' : 'adult';
    const src = new URL(klinAssets[state.stage], import.meta.url).href;
    for (const actor of [primary, secondary]) if (actor.artwork.src !== src) actor.artwork.src = src;
  }
  function setPage(page, {stage = state.stage, layout, immediate = false} = {}) {
    if (state.disposed) return;
    if (page === state.page && !immediate && state.action) return;
    stop(); state.page = page; state.conversation = false; setStage(stage);
    state.layout = {...getIllustratedLayout(page), ...(layout || {})}; draw();
  }
  function setLayout(layout = {}) { if (state.action?.kind === 'transition') return; state.layout = {...state.layout, ...layout}; draw(); }
  function runAction(kind, duration, update, complete) {
    stop(); const action = {kind, started: now(), duration: state.reduced ? 1 : duration, update, complete}; state.action = action;
    update(0);
    const tick = timestamp => {
      state.frame = 0;
      if (state.disposed || state.action !== action || !state.active || doc.hidden) return;
      const progress = clamp((timestamp - action.started) / action.duration); update(progress);
      if (progress < 1) state.frame = frame(tick);
      else { state.action = null; host.dataset.transitionPhase = 'idle'; primary.artwork.style.transform = ''; complete?.(); }
    };
    action.tick = tick;
    if (state.active && !doc.hidden) state.frame = frame(tick);
    else action.pausedAt = now();
    return () => { if (state.action === action) { stop(); draw(); } };
  }
  function transition(from, to, {onComplete, onCardFrame, stage = state.stage, layout: override, preserveScene = false} = {}) {
    const offering = from === 'home' && isCard(to), source = {...state.layout};
    const destination = offering && preserveScene ? source : {...getIllustratedLayout(to), ...(override || {})};
    state.page = to; state.conversation = false; setStage(stage);
    return runAction('transition', offering ? 1850 : 650, progress => {
      const eased = smooth(progress);
      if (offering) {
        draw(source); const gesture = Math.sin(progress * Math.PI);
        primary.artwork.style.transform = `translateY(${12 - gesture * 2}%) rotate(${-gesture * 3}deg) scale(${1 + gesture * .035})`;
        const {width, height} = dimensions(), card = illustratedCardFrame(progress, source, width, height);
        host.dataset.transitionPhase = card.phase; onCardFrame?.(card);
      } else {
        host.dataset.transitionPhase = progress < .5 ? 'glide' : 'settle';
        draw({...destination, x: lerp(source.x, destination.x, eased), footY: lerp(source.footY, destination.footY, eased) - Math.sin(progress * Math.PI) * .012, height: lerp(source.height, destination.height, eased)});
      }
    }, () => { state.layout = destination; draw(); onComplete?.(); });
  }
  function interact(kind = 'wave') {
    if (state.action?.kind === 'transition' || state.disposed) return () => {};
    return runAction(kind, 750, progress => {
      const gesture = Math.sin(progress * Math.PI * 2) * (1 - progress);
      primary.artwork.style.transform = `translateY(12%) rotate(${gesture * (kind === 'look' ? 1.5 : 4)}deg)`;
    });
  }
  function setConversationMode(value = false) {
    if (state.page !== 'home') return;
    const enabled = !!value;
    // A reduced-motion page reset can retain a hidden layout while resetting
    // the mode flag. Reconcile both, so the next exit always restores the room.
    if (state.conversation === enabled && state.layout.character === !enabled) return;
    state.conversation = enabled;
    // The DOM avatar bridge owns the trip to the header. Keep the room pose
    // unchanged so exiting can return to the same grounded position.
    if (state.action?.kind !== 'transition') setLayout({...getIllustratedLayout('home'), character: !enabled});
  }
  function pause() {
    if (state.action && state.action.pausedAt == null) state.action.pausedAt = now();
    if (state.frame) cancelFrame(state.frame);
    state.frame = 0;
  }
  function resume() {
    if (!state.action || state.frame || !state.active || doc.hidden || state.disposed) return;
    if (state.action.pausedAt != null) {state.action.started += now() - state.action.pausedAt; state.action.pausedAt = null;}
    state.frame = frame(state.action.tick);
  }
  function setActive(value) {state.active = !!value; host.dataset.active = String(state.active); roomVideo.update({active: state.active && state.layout.world === 'home'}); if (!state.active) pause(); else resume();}
  function setReducedMotion(value) {
    state.reduced = !!value;
    roomVideo.update({reducedMotion: state.reduced});
    if (state.reduced && state.action) {
      state.action.duration = 1; state.action.started = now() - 1;
      if (state.action.pausedAt != null) state.action.pausedAt = now();
      resume();
    }
  }
  const visibility = () => {if (doc.hidden) pause(); else resume();};
  doc.addEventListener('visibilitychange', visibility);
  const observer = new win.ResizeObserver(() => draw()); observer.observe(host);
  draw();
  const imageReady = image => image.complete && image.naturalWidth ? Promise.resolve() : new Promise((resolve, reject) => {
    const clear = () => {image.removeEventListener('load', loaded); image.removeEventListener('error', failed);};
    const loaded = () => {clear(); resolve();}, failed = () => {clear(); reject(new Error('Scene artwork unavailable'));};
    image.addEventListener('load', loaded, {once: true}); image.addEventListener('error', failed, {once: true});
  });
  // Only the arrival room and selected actor can hold up the first room. Other
  // routes have their own readiness gate in the host, so a missing visit plate
  // must never hide an otherwise ready home scene.
  let releaseDisposed;
  const disposedReady = new Promise(resolve => {releaseDisposed = resolve;});
  const loadedReady = Promise.all([primary.artwork, plates.home].map(imageReady)).then(() => {
    if (state.disposed) return false; host.dataset.world = 'ready'; return true;
  }).catch(() => { host.dataset.world = 'fallback'; return false; });
  const ready = Promise.race([loadedReady, disposedReady]);
  function dispose() {if (state.disposed) return; stop(); state.disposed = true; roomVideo.dispose(); releaseDisposed(false); observer.disconnect(); doc.removeEventListener('visibilitychange', visibility); host.replaceChildren();}
  const completeWithoutGrowth = options => { let cancelled = false; queueMicrotask(() => {if (!cancelled && !state.disposed) {options?.onSigned?.(); options?.onComplete?.();}}); return () => {cancelled = true;}; };
  return {
    supported: true, ready, setPage, setStage, setLayout, transition, interact, setConversationMode, setActive, setReducedMotion, resize: draw, dispose,
    setSharedScene(src) {const url=new URL(src,import.meta.url).href;if(plates.shared.src!==url)plates.shared.src=url;},
    setCardPreview() {}, setParticipants: participants => {state.participants = participants || [];},
    setPortalState: value => {state.portal = value;}, setLoungeState: value => {state.lounge = {...state.lounge, ...value};}, setRealmState: value => {state.realm = {...state.realm, ...value};},
    grow: completeWithoutGrowth, signContract: completeWithoutGrowth,
    get status() {return {page: state.page, stage: state.stage, action: state.action?.kind || 'idle', world: state.layout.world, rendering: 'illustrated-2d', model: host.dataset.model, nativeReady: false, conversation: state.conversation, transitionPhase: host.dataset.transitionPhase || 'idle', participants: state.participants.map(person => person.id), lounge: {...state.lounge}, realm: {...state.realm}, portal: state.portal, particleSamples: 0};},
  };
}
