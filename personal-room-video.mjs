// These films already contain both Klin and the room. One layer owns the whole
// scene, including its still fallback; the old actor must never be composited
// over a visible frame from this layer.
export function createPersonalRoomVideo({container, idleSrc, reactSrc, poster, reducedMotion = false, onChange} = {}) {
  const doc = container?.ownerDocument;
  if (!doc) throw new TypeError('A personal-room container is required.');
  const idle = doc.createElement('video');
  if (typeof idle.play !== 'function') return {supported: false, visible: false, update() {}, respond() {return () => {};}, dispose() {}, get status() {return {active: false, visible: false, mode: 'off', responding: false};}};
  const react = doc.createElement('video');
  const layer = doc.createElement('div');
  layer.className = 'klin-personal-room-scene';
  layer.hidden = true;
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, {position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden'});
  const still = doc.createElement('img');
  still.className = 'klin-personal-room-poster';
  still.alt = ''; still.draggable = false;
  const fill = {position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none'};
  Object.assign(still.style, fill);
  const films = {idle, react};
  for (const [kind, video] of Object.entries(films)) {
    video.className = `klin-personal-room-video is-${kind}`;
    video.dataset.action = kind;
    video.muted = true; video.defaultMuted = true; video.playsInline = true;
    video.loop = kind === 'idle'; video.preload = 'none'; video.hidden = true;
    video.setAttribute('aria-hidden', 'true'); video.setAttribute('playsinline', '');
    Object.assign(video.style, fill);
  }
  layer.append(still, idle, react);
  container.append(layer);
  let active = false, reduced = !!reducedMotion, disposed = false, failed = false, blocked = false;
  let posterReady = false, desired = 'idle', showing = null, pending = null, attempt = 0, response = 0;
  let reported = '';
  const shouldPlay = () => active && !reduced && !doc.hidden && !disposed && !failed && !blocked;
  const ownsScene = () => active && !disposed && (posterReady || showing !== null);
  const notify = () => {
    layer.hidden = !ownsScene();
    layer.dataset.mode = showing || 'poster';
    const signature = `${layer.hidden}|${layer.dataset.mode}|${desired === 'react'}`;
    if (signature !== reported) {reported = signature; onChange?.();}
  };
  const pauseFilms = () => {
    attempt++; pending = null; showing = null;
    for (const video of Object.values(films)) {video.pause(); video.hidden = true;}
    notify();
  };
  const reset = () => {desired = 'idle'; response++; pauseFilms();};
  function reveal(kind) {
    if (!shouldPlay() || desired !== kind) {films[kind].pause(); return;}
    showing = kind;
    for (const [name, video] of Object.entries(films)) {
      video.hidden = name !== kind;
      if (name !== kind) video.pause();
    }
    notify();
  }
  function sync({restart = false} = {}) {
    if (!shouldPlay()) {pauseFilms(); return;}
    const kind = desired, video = films[kind];
    if (pending?.kind === kind && !restart) return;
    if (!restart && showing === kind && !video.paused) {notify(); return;}
    if (!video.getAttribute('src')) {video.src = kind === 'idle' ? idleSrc : reactSrc; video.preload = 'auto';}
    if (restart) {try {video.currentTime = 0;} catch {}}
    const token = ++attempt;
    pending = {token, kind};
    // A cancelled microtask must not restart media after navigation/disposal.
    Promise.resolve().then(() => {
      if (token !== attempt || !shouldPlay() || desired !== kind) return;
      return video.play();
    }).then(() => {
      if (token !== attempt || disposed) {if (!shouldPlay() || desired !== kind) video.pause(); return;}
      pending = null;
      if (!video.paused && video.readyState >= 2) reveal(kind);
    }, () => {
      if (token !== attempt || disposed) return;
      blocked = true; desired = 'idle'; response++; pauseFilms();
    });
  }
  const playing = Object.fromEntries(Object.keys(films).map(kind => [kind, () => reveal(kind)]));
  const decodeError = () => {failed = true; reset();};
  const ended = () => {
    // A tap may already have sought back to the start before a queued ended
    // event from the previous playback arrives. Only the current end owns idle.
    if (disposed || desired !== 'react' || !react.ended) return;
    desired = 'idle'; response++;
    // Direct cut back to the idle start; no frame blending or duplicated actor.
    sync({restart: true});
  };
  const loaded = () => {posterReady = !!still.naturalWidth; notify();};
  const posterError = () => {posterReady = false; notify();};
  const visibility = () => {reset(); if (!doc.hidden) sync({restart: true});};
  for (const [kind, video] of Object.entries(films)) {
    video.addEventListener('playing', playing[kind]);
    video.addEventListener('error', decodeError);
  }
  react.addEventListener('ended', ended);
  still.addEventListener('load', loaded);
  still.addEventListener('error', posterError);
  doc.addEventListener('visibilitychange', visibility);
  still.src = poster;
  posterReady = !!(still.complete && still.naturalWidth);
  return {
    supported: true, layer, poster: still, idle, react,
    get visible() {return ownsScene();},
    update(options = {}) {
      if (disposed) return;
      const nextActive = options.active ?? active, nextReduced = options.reducedMotion ?? reduced;
      const changed = nextActive !== active || nextReduced !== reduced;
      active = !!nextActive; reduced = !!nextReduced;
      // Warm the short response while idle plays, so the first click does not
      // have to begin its network request. No offscreen response is played.
      if (shouldPlay() && !react.getAttribute('src')) {react.src = reactSrc; react.preload = 'auto'; react.load();}
      if (changed) {reset(); if (shouldPlay()) sync({restart: true});}
      else sync();
      notify();
    },
    respond() {
      if (disposed || !active || reduced || doc.hidden || failed) return () => {};
      blocked = false;
      const token = ++response;
      desired = 'react';
      notify();
      // Every tap takes ownership immediately, including during the previous
      // response or its pending play promise. Keep the same visible film layer.
      sync({restart: true});
      return () => {if (!disposed && token === response && desired === 'react') {desired = 'idle'; response++; sync({restart: true});}};
    },
    dispose() {
      if (disposed) return;
      disposed = true; active = false; reset();
      for (const [kind, video] of Object.entries(films)) {
        video.removeEventListener('playing', playing[kind]); video.removeEventListener('error', decodeError);
        video.removeAttribute('src'); video.load();
      }
      react.removeEventListener('ended', ended);
      still.removeEventListener('load', loaded); still.removeEventListener('error', posterError);
      doc.removeEventListener('visibilitychange', visibility);
      layer.remove();
    },
    get status() {return {active, visible: ownsScene(), mode: !active ? 'off' : showing || 'poster', responding: desired === 'react', failed, reduced};},
  };
}
