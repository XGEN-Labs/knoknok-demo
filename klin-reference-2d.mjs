import {captureRoomAvatarFrame} from './room-avatar-frame.mjs?v=20261031-return-frame-104';
import { klinAssets } from './klin-companion.mjs?v=20261031-product-sync';
import { HOME_SCENE_ASSET, HOME_SCENE_VIDEO_ASSET, HOME_CHARACTER_SCENE_ASSET, HOME_CHARACTER_IDLE_ASSET, HOME_CHARACTER_REACT_ASSET, VISIT_SCENE_ASSET, SHARED_SCENE_ASSET } from './scene-assets.mjs?v=20261031-product-sync';
import {ROOM_LIGHT_THEMES} from './room-light-assets.mjs?v=20261031-product-sync';
import {roomThemeReady, readRoomLightPreference, roomLightPeriod, createRoomLightClock, createRoomLightSwitch, captureRoomFade, prepareRoomFilm, seekRoomFilm} from './room-light-theme.mjs?v=20261031-product-sync';
import { createRoomVideo } from './room-video.mjs?v=20261031-product-sync';
import { createPersonalRoomVideo } from './personal-room-video.mjs?v=20261031-return-frame-104';

// Home/adult uses the approved room-and-character films. Original separate
// artwork remains available for the avatar/card bridge and other scenes/ages.
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

// v09 native 496×864 film: a square proxy aligns the legacy transparent
// artwork's eyes and feet with the filmed actor and covers its response hands.
export function personalRoomCharacterFrame(width, height, theme) {
  const native = theme?.width > 0 && theme?.height > 0 && theme?.actor ? theme : {width:496,height:864,actor:{x:133,y:436,width:216,height:216}};
  const scale = Math.max(width / native.width, height / native.height);
  const filmWidth = native.width * scale, filmHeight = native.height * scale;
  return {x: native.actor.x * scale - (filmWidth - width) / 2, y: native.actor.y * scale - (filmHeight - height) / 2, width: native.actor.width * scale, height: native.actor.height * scale};
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

export function createKlinWorld({host, reducedMotion = false, roomThemes = ROOM_LIGHT_THEMES, roomThemeStorage, roomThemeNow = () => new Date(), characterAssets = klinAssets, characterFilm = true, separateAdultArtwork = true, onRoomThemeChange} = {}) {
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
    artwork.alt = ''; artwork.draggable = false; artwork.src = new URL(characterAssets.adult, import.meta.url).href;
    anchor.append(shadow, artwork); host.append(anchor); return {anchor, artwork};
  };
  host.append(room);
  const primary = makeActor('is-primary'), secondary = makeActor('is-secondary');
  host.classList.add('klin-illustrated-world'); host.dataset.world = 'loading'; host.dataset.rendering = 'illustrated-2d'; host.dataset.model = 'original-adult-illustration';
  host.parentElement?.setAttribute('data-character-renderer', 'illustrated-2d');
  const state = {page: 'home', stage: 'adult', layout: getIllustratedLayout('home'), reduced: !!reducedMotion, active: true, disposed: false, action: null, frame: 0, conversation: false, participants: [], lounge: {}, realm: {}, portal: 'idle'};
  let themeStorage = roomThemeStorage;
  if (themeStorage === undefined) {try {themeStorage = win.localStorage;} catch {}}
  const preferredTheme = readRoomLightPreference(themeStorage, roomThemeNow());
  let roomTheme = roomThemeReady(roomThemes[preferredTheme]) ? preferredTheme : 'warm';
  let roomClock = null;
  let themeRequest = 0, swappingTheme = false, themeFade = null, lightSwitch = null, pendingThemePreparation = null, themeSeekHeld = 0;
  const assetURL = asset => asset ? new URL(asset, import.meta.url).href : null;
  const themeConfig = () => roomThemes[roomTheme];
  const makeRoomVideo = (theme, startTime = 0, videoElement) => createRoomVideo({container: room, src: assetURL(theme.roomLoop), poster: assetURL(theme.roomPoster), startTime, videoElement, reducedMotion: state.reduced});
  let roomVideo = makeRoomVideo(themeConfig());
  plates.home.src = assetURL(themeConfig().roomPoster);
  let renderedLayout = state.layout;
  let projectedProxy = false, hitTarget = null, conversationReturn = null, conversationEntry = null;
  const makePersonalRoom = (theme, posterElement, initialPlayback, films = {}) => createPersonalRoomVideo({container: room, idleSrc: assetURL(theme.idle), reactSrc: assetURL(theme.react), poster: assetURL(theme.poster), posterElement, idleElement: films.idle, reactElement: films.react, initialPlayback, reactStartTime: theme.reactStartTime ?? 0, reducedMotion: state.reduced, onChange: applyMediaOwnership});
  let personalRoom = makePersonalRoom(themeConfig());
  const dimensions = () => ({width: host.clientWidth || host.getBoundingClientRect().width || 402, height: host.clientHeight || host.getBoundingClientRect().height || 874});
  const stop = () => { if (state.frame) cancelFrame(state.frame); state.frame = 0; state.action = null; host.dataset.transitionPhase = 'idle'; primary.artwork.style.transform = ''; };

  function personalSceneEligible(layout = renderedLayout) {
    return characterFilm && state.page === 'home' && layout.world === 'home' && state.stage === 'adult' && layout.character !== false && !layout.shared && !state.conversation && state.action?.kind !== 'transition' && !host.parentElement?.dataset?.conversationAvatarMotion && host.parentElement?.dataset?.sceneOverlay !== 'true';
  }
  function applyMediaOwnership() {
    if (state.disposed || swappingTheme) return;
    const owns = personalRoom.visible;
    // Visibility preserves the original image's measurable geometry for the
    // existing room-to-header flight. character:false retains normal hiding.
    primary.anchor.style.visibility = owns ? 'hidden' : '';
    positionActors(renderedLayout, owns);
    const nextHit = owns && !personalRoom.status.held ? host.parentElement?.querySelector?.('.home-companion') : null;
    if (hitTarget && hitTarget !== nextHit) for (const property of ['left', 'top', 'width', 'height', 'bottom', 'transform']) hitTarget.style[property] = '';
    hitTarget = nextHit;
    if (hitTarget) {
      const {width, height} = dimensions(), rect = personalRoomCharacterFrame(width, height, themeConfig());
      Object.assign(hitTarget.style, {left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px`, bottom: 'auto', transform: 'none'});
    }
    const travelling = !!host.parentElement?.dataset?.conversationAvatarMotion;
    roomVideo.update({active: state.active && renderedLayout.world === 'home' && !owns && !travelling, holdFrame: travelling && !owns, reducedMotion: state.reduced});
    host.dataset.personalRoom = owns ? personalRoom.status.mode : 'off';
    host.dataset.personalRoomHeld = String(personalRoom.status.held === true);
    lightSwitch?.update();
    void roomClock?.refresh();
  }
  const prepareThemeImage = (src, signal) => new Promise((resolve, reject) => {
    const image = node('img', 'klin-illustrated-plate'); image.alt = ''; image.draggable = false;
    let settled = false;
    const clear = () => {clearTimeout(timer); image.removeEventListener('load', loaded); image.removeEventListener('error', failed); signal?.removeEventListener('abort', aborted);};
    const finish = error => {if (settled) return; settled = true; clear(); if (error) reject(error); else resolve(image);};
    const loaded = () => finish(image.naturalWidth ? null : new Error('Room image unavailable'));
    const failed = () => finish(new Error('Room image unavailable'));
    const aborted = () => finish(new Error('Room image preparation cancelled'));
    const timer = setTimeout(() => finish(new Error('Room image preparation timed out')), 10000);
    image.addEventListener('load', loaded); image.addEventListener('error', failed); signal?.addEventListener('abort', aborted, {once: true});
    if (signal?.aborted) {aborted(); return;}
    image.src = assetURL(src);
    if (image.complete && image.naturalWidth) loaded();
  });
  async function setRoomTheme(next, {manual = true, isCurrent = () => true} = {}) {
    const requestedPeriod = roomLightPeriod(roomThemeNow()).key;
    const request = ++themeRequest;
    pendingThemePreparation?.abort();
    if (state.disposed || !roomThemeReady(roomThemes[next])) return false;
    if (next === roomTheme) return true;
    const preparation = new AbortController(); pendingThemePreparation = preparation;
    const films = {}, prepared = [], diagnostics = []; let committed = false, heldForSeek = false;
    const diagnose = data => {diagnostics.push({at: now(), docHidden: !!doc.hidden, ...data}); if (diagnostics.length > 60) diagnostics.shift(); host.dataset.roomThemePhase = data.phase; host.dataset.roomThemeEvents = JSON.stringify(diagnostics);};
    diagnose({phase: 'images'});
    const valid = () => isCurrent() && !preparation.signal.aborted && !state.disposed && request === themeRequest && state.page === 'home' && state.active && !state.action && !doc.hidden && !host.parentElement?.dataset?.conversationAvatarMotion && host.parentElement?.dataset?.sceneOverlay !== 'true';
    try {
      const target = roomThemes[next];
      const [posterImage, roomImage] = await Promise.all([prepareThemeImage(target.poster, preparation.signal), prepareThemeImage(target.roomPoster, preparation.signal)]);
      if (!valid()) return false;
      if (!state.reduced) {
        await Promise.all(['idle', 'react', 'roomLoop'].map(async kind => {
          const video = await prepareRoomFilm({doc, src: assetURL(target[kind]), signal: preparation.signal, onState: data => diagnose({phase: 'decode', kind, ...data})});
          if (video) {films[kind] = video; prepared.push(video);}
        }));
      }
      if (!valid()) return false;
      const source = personalRoom.visible ? (personalRoom.status.mode === 'react' ? personalRoom.react : personalRoom.status.mode === 'idle' ? personalRoom.idle : personalRoom.poster) : (!roomVideo.video?.hidden && roomVideo.video?.readyState >= 2 ? roomVideo.video : plates.home);
      const outgoingPlayback = {mode: personalRoom.status.mode === 'react' ? 'react' : 'idle', time: Number(source?.currentTime) || 0, primed: false};
      // Only the short final seek holds the old actor. Network/decode loading
      // above leaves the current scene playing and owned until it can transfer.
      const incoming = personalRoom.visible ? films[outgoingPlayback.mode] : films.roomLoop;
      if (incoming) {
        if (personalRoom.visible) {themeSeekHeld = request; personalRoom.update({active: true, holdFrame: true}); heldForSeek = true;}
        await seekRoomFilm(incoming, outgoingPlayback.time, {signal: preparation.signal, onState: data => diagnose({phase: 'seek', targetTime: outgoingPlayback.time, ...data})});
        outgoingPlayback.primed = true;
      }
      if (!valid()) return false;
      themeFade?.dispose(); themeFade = null;
      if (!state.reduced) themeFade = captureRoomFade({container: room, source, ...dimensions()});
      if (themeSeekHeld === request) themeSeekHeld = 0;
      swappingTheme = true;
      personalRoom.dispose(); roomVideo.dispose(); roomTheme = next;
      roomImage.dataset.scene = 'home'; roomImage.hidden = renderedLayout.world !== 'home';
      if (plates.home.replaceWith) {plates.home.replaceWith(roomImage); plates.home = roomImage;}
      else plates.home.src = assetURL(themeConfig().roomPoster);
      roomVideo = makeRoomVideo(themeConfig(), outgoingPlayback.time, films.roomLoop);
      personalRoom = makePersonalRoom(themeConfig(), posterImage, outgoingPlayback, films);
      swappingTheme = false; committed = true;
      host.dataset.roomLight = roomTheme;
      try {onRoomThemeChange?.();} catch {}
      host.parentElement?.style?.setProperty?.('--kn-room-scene-image', `url("${assetURL(themeConfig().roomPoster)}")`);
      if (manual) roomClock?.remember(roomTheme, requestedPeriod);
      syncMedia(); themeFade?.start();
      diagnose({phase: 'committed', theme: next});
      return true;
    } catch (error) {diagnose({phase: 'failed', error: String(error)}); preparation.abort(); return false;}
    finally {
      if (themeSeekHeld === request) themeSeekHeld = 0;
      if (!committed) {
        preparation.abort();
        for (const video of prepared) {video.pause(); video.removeAttribute('src'); video.load();}
        if (heldForSeek && !state.disposed) syncMedia();
      }
      if (pendingThemePreparation === preparation) pendingThemePreparation = null;
    }
  }
  function positionActors(layout, owns) {
    const {width, height} = dimensions(), size = Math.min(height * layout.height, width * .78);
    const homeAdult = state.page === 'home' && layout.world === 'home' && state.stage === 'adult';
    if (!homeAdult) projectedProxy = false;
    if (owns) projectedProxy = true;
    const bridge = host.parentElement?.dataset?.conversationAvatarMotion;
    const keepProjected = owns || (projectedProxy && homeAdult && (state.conversation || layout.character === false || bridge));
    for (const [actor, x] of [[primary, layout.x], [secondary, .70]]) {
      actor.anchor.style.left = `${x * 100}%`; actor.anchor.style.top = `${layout.footY * 100}%`;
      actor.anchor.style.width = `${size}px`; actor.anchor.style.height = `${size}px`;
    }
    if (keepProjected) {
      const rect = personalRoomCharacterFrame(width, height, themeConfig());
      Object.assign(primary.anchor.style, {left: `${rect.x + rect.width / 2}px`, top: `${rect.y + rect.height}px`, width: `${rect.width}px`, height: `${rect.height}px`});
      primary.artwork.style.transform = 'none'; primary.artwork.style.objectFit = 'fill';
    } else {
      if (primary.artwork.style.transform === 'none') primary.artwork.style.transform = '';
      primary.artwork.style.objectFit = '';
    }
  }
  // The current visible movie frame stays still while the matching PNG takes
  // ownership at the same room position. Only entry uses this short departure.
  let conversationAvatarFrame = null;
  const avatarCrop = () => themeConfig().head || themeConfig().actor || {x:133,y:436,width:216,height:216};
  function prepareConversationEntry() {
    conversationEntry?.cancel();
    if (!characterFilm || state.disposed || state.page !== 'home' || state.conversation || !personalRoom.visible) return null;
    const owner = personalRoom;
    let fade = null, released = false;
    const valid = () => !released && !state.disposed && conversationEntry === ticket && personalRoom === owner && state.page === 'home';
    const release = () => {
      if (released) return;
      released = true;
      // Hide/reconcile the film before cancelling its fill animation, avoiding
      // an opaque one-frame flash as the departing layer loses its effect.
      if (conversationEntry === ticket) conversationEntry = null;
      if (!state.disposed) syncMedia();
      fade?.cancel(); fade = null;
    };
    const ticket = {
      frame() {const {width, height} = dimensions(); return personalRoomCharacterFrame(width, height);},
      reveal({duration = 120} = {}) {
        if (!valid()) return false;
        if (duration && owner.layer.animate) fade = owner.layer.animate([{opacity: 1}, {opacity: 0}], {duration, easing: 'ease-in-out', fill: 'both'});
        return true;
      },
      complete: release,
      cancel: release,
    };
    conversationEntry = ticket;
    conversationAvatarFrame = null;
    owner.update({active: false, holdFrame: true});
    return ticket;
  }
  function prepareConversationReturn() {
    conversationReturn?.cancel();
    if (!characterFilm || state.disposed || state.page !== 'home' || state.conversation || !personalRoom.prepareReturn) return null;
    const owner = personalRoom, preparation = owner.prepareReturn();
    const valid = () => !state.disposed && conversationReturn === ticket && personalRoom === owner && state.page === 'home' && !state.conversation;
    const ticket = {
      revealed: false,
      ready: preparation.ready,
      reveal(options) {
        if (!valid()) return false;
        ticket.revealed = preparation.reveal(options); return ticket.revealed;
      },
      complete() {
        if (!valid()) {preparation.cancel(); return;}
        conversationReturn = null; preparation.complete(); syncMedia();
      },
      cancel() {
        if (conversationReturn === ticket) conversationReturn = null;
        preparation.cancel();
      },
    };
    conversationReturn = ticket;
    return ticket;
  }
  function syncMedia(layout = renderedLayout) {
    renderedLayout = layout;
    if (!state.active || state.page !== 'home' || host.parentElement?.dataset?.conversationAvatarMotion || state.reduced) {themeFade?.dispose(); themeFade = null;}
    const holdEntry = conversationEntry && state.page === 'home' && state.active && !doc.hidden;
    const holdFrame = !!holdEntry || (characterFilm && state.active && layout.world === 'home' && state.stage === 'adult' && !state.conversation
      && (conversationReturn?.revealed || (!host.parentElement?.dataset?.conversationAvatarMotion
      && (themeSeekHeld !== 0 || isCard(state.page) || host.parentElement?.dataset?.sceneOverlay === 'true'))));
    personalRoom.update({active: state.active && personalSceneEligible(layout), holdFrame, reducedMotion: state.reduced});
    applyMediaOwnership();
  }

  function draw(layout = state.layout) {
    if (state.disposed) return;
    for (const [key, image] of Object.entries(plates)) image.hidden = key !== layout.world;
    host.dataset.scene = layout.world;
    primary.anchor.hidden = layout.character === false || (!separateAdultArtwork && state.stage === 'adult');
    secondary.anchor.hidden = !layout.shared;
    syncMedia(layout);
    host.dataset.conversationMode = state.conversation ? 'conversation' : 'idle';
  }
  function setStage(stage) {
    state.stage = stage === 'juvenile' ? 'juvenile' : 'adult';
    const src = new URL(characterAssets[state.stage], import.meta.url).href;
    for (const actor of [primary, secondary]) if (actor.artwork.src !== src) actor.artwork.src = src;
    syncMedia();
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
    if (personalRoom.supported && personalSceneEligible()) return kind === 'wave' ? personalRoom.respond() : () => {};
    return runAction(kind, 750, progress => {
      const gesture = Math.sin(progress * Math.PI * 2) * (1 - progress);
      primary.artwork.style.transform = `translateY(12%) rotate(${gesture * (kind === 'look' ? 1.5 : 4)}deg)`;
    });
  }
  function setConversationMode(value = false) {
    if (state.page !== 'home') return;
    const enabled = !!value;
    if (state.conversation !== enabled) {themeFade?.dispose(); themeFade = null;}
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
  function setActive(value) {state.active = !!value; host.dataset.active = String(state.active); syncMedia(); if (!state.active) pause(); else resume();}
  function setReducedMotion(value) {
    state.reduced = !!value;
    syncMedia();
    if (state.reduced && state.action) {
      state.action.duration = 1; state.action.started = now() - 1;
      if (state.action.pausedAt != null) state.action.pausedAt = now();
      resume();
    }
  }
  roomClock = createRoomLightClock({storage: themeStorage, now: roomThemeNow, doc, win, getTheme: () => roomTheme, applyTheme: setRoomTheme, isBusy: () => !!pendingThemePreparation, canApply: () => !state.disposed && state.active && state.page === 'home' && renderedLayout.world === 'home' && !state.action && !personalRoom.status.responding && !host.parentElement?.dataset?.conversationAvatarMotion && host.parentElement?.dataset?.sceneOverlay !== 'true', onChange: value => {host.dataset.roomLightMode = value.mode; host.dataset.roomLightPeriod = value.period;}});
  const visibility = () => {if (doc.hidden) {pendingThemePreparation?.abort(); pause();} else resume();};
  doc.addEventListener('visibilitychange', visibility);
  const observer = new win.ResizeObserver(() => draw()); observer.observe(host);
  const bridgeObserver = typeof win.MutationObserver === 'function' ? new win.MutationObserver(() => syncMedia()) : null;
  if (host.parentElement) bridgeObserver?.observe(host.parentElement, {attributes: true, attributeFilter: ['data-conversation-avatar-motion', 'data-scene-overlay']});
  if (host.parentElement) lightSwitch = createRoomLightSwitch({phone: host.parentElement, getState: () => ({...dimensions(), id: roomTheme, theme: themeConfig(), targetReady: roomThemeReady(roomThemes[roomTheme === 'warm' ? 'bright' : 'warm']), active: state.active && state.page === 'home' && renderedLayout.world === 'home' && !state.action && !host.parentElement?.dataset?.conversationAvatarMotion && host.parentElement?.dataset?.sceneOverlay !== 'true'}), onToggle: () => setRoomTheme(roomTheme === 'warm' ? 'bright' : 'warm')});
  host.dataset.roomLight = roomTheme;
  host.parentElement?.style?.setProperty?.('--kn-room-scene-image', `url("${assetURL(themeConfig().roomPoster)}")`);
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
  const loadedReady = Promise.all([!separateAdultArtwork && personalRoom.poster ? personalRoom.poster : primary.artwork, plates.home].map(imageReady)).then(() => {
    if (state.disposed) return false; host.dataset.world = 'ready'; return true;
  }).catch(() => { host.dataset.world = 'fallback'; return false; });
  const ready = Promise.race([loadedReady, disposedReady]);
  function dispose() {if (state.disposed) return; conversationEntry?.cancel(); conversationReturn?.cancel(); stop(); state.disposed = true; roomClock?.dispose(); themeRequest++; pendingThemePreparation?.abort(); themeFade?.dispose(); lightSwitch?.dispose(); if (hitTarget) for (const property of ['left', 'top', 'width', 'height', 'bottom', 'transform']) hitTarget.style[property] = ''; personalRoom.dispose(); roomVideo.dispose(); releaseDisposed(false); observer.disconnect(); bridgeObserver?.disconnect(); doc.removeEventListener('visibilitychange', visibility); host.replaceChildren();}
  const completeWithoutGrowth = options => { let cancelled = false; queueMicrotask(() => {if (!cancelled && !state.disposed) {options?.onSigned?.(); options?.onComplete?.();}}); return () => {cancelled = true;}; };
  return {
    get roomSceneAsset() {return themeConfig().roomPoster;},
    supported: true, ready, setPage, setStage, setLayout, transition, interact, setConversationMode, prepareConversationEntry, prepareConversationReturn, setRoomTheme, setActive, setReducedMotion, resize: draw, dispose,
    setSharedScene(src) {const url=new URL(src,import.meta.url).href;if(plates.shared.src!==url)plates.shared.src=url;},
    setCardPreview() {}, setParticipants: participants => {state.participants = participants || [];},
    setPortalState: value => {state.portal = value;}, setLoungeState: value => {state.lounge = {...state.lounge, ...value};}, setRealmState: value => {state.realm = {...state.realm, ...value};},
    grow: completeWithoutGrowth, signContract: completeWithoutGrowth,
    get roomAvatar() {
      const theme=themeConfig(), crop=avatarCrop();
      if (conversationEntry && !conversationAvatarFrame) conversationAvatarFrame=captureRoomAvatarFrame(personalRoom.frame,{width:theme.width,height:theme.height,crop},doc);
      if (conversationAvatarFrame && (conversationEntry || state.conversation || host.parentElement?.dataset?.conversationAvatarMotion)) return conversationAvatarFrame;
      return {src:assetURL(theme.poster),width:theme.width,height:theme.height,crop};
    },
    get roomCharacterFrame() {const {width,height}=dimensions(),theme=themeConfig();return personalRoomCharacterFrame(width,height,{...theme,actor:theme.actor||{x:151,y:455,width:180,height:180}});},
    get roomAvatarFrame() {const theme=themeConfig(),{width,height}=dimensions();return personalRoomCharacterFrame(width,height,{...theme,actor:avatarCrop()});},
    get status() {return {page: state.page, stage: state.stage, action: state.action?.kind || (personalRoom.status.responding ? 'wave' : 'idle'), world: state.layout.world, rendering: 'illustrated-2d', model: host.dataset.model, nativeReady: false, conversation: state.conversation, roomLight: roomTheme, personalRoom: personalRoom.status, transitionPhase: host.dataset.transitionPhase || 'idle', participants: state.participants.map(person => person.id), lounge: {...state.lounge}, realm: {...state.realm}, portal: state.portal, particleSamples: 0};},
  };
}
