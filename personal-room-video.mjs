// These films already contain both Klin and the room. One layer owns the whole
// scene, including its still fallback; the old actor must never be composited
// over a visible frame from this layer.
export function createPersonalRoomVideo({container, idleSrc, reactSrc, poster, posterElement, idleElement, reactElement, initialPlayback, reactStartTime = 0, reducedMotion = false, onChange, onResponseFeedback} = {}) {
  const doc = container?.ownerDocument;
  if (!doc) throw new TypeError('A personal-room container is required.');
  const idle = idleElement || doc.createElement('video');
  if (typeof idle.play !== 'function') return {supported: false, visible: false, update() {}, respond() {return () => {};}, dispose() {}, get status() {return {active: false, visible: false, mode: 'off', responding: false};}};
  const react = reactElement || doc.createElement('video');
  const layer = doc.createElement('div');
  layer.className = 'klin-personal-room-scene';
  layer.hidden = true;
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, {position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden'});
  const still = posterElement || doc.createElement('img');
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
  let active = false, held = false, reduced = !!reducedMotion, disposed = false, failed = false, blocked = false;
  let posterReady = false, desired = 'idle', showing = null, pending = null, attempt = 0, response = 0;
  let reported = '', returnPreparation = null;
  let responseRequestedAt = null, responseRevealedAt = null;
  const clock = () => doc.defaultView?.performance?.now?.() ?? Date.now();
  const responseEntry = () => {const configured = Number(reactStartTime), time = Number.isFinite(configured) ? Math.max(0, configured) : 0, duration = Number(react.duration); return Number.isFinite(duration) && duration > 0 ? Math.min(time, Math.max(0, duration - 1 / 48)) : time;};
  const responsePrimed = () => react.readyState >= 2 && !react.seeking && Math.abs(react.currentTime - responseEntry()) < 1 / 48;
  const metadataSeeks = new Map();
  const clearSeeks = () => {for (const [video, callback] of metadataSeeks) video.removeEventListener('loadedmetadata', callback); metadataSeeks.clear();};
  const shouldPlay = () => !!idleSrc && active && !held && !reduced && !doc.hidden && !disposed && !failed && !blocked;
  const ownsScene = () => (active || held) && !disposed && (posterReady || showing !== null);
  const notify = () => {
    layer.hidden = !ownsScene();
    layer.dataset.mode = showing || 'poster';
    layer.dataset.responsePrimed = String(responsePrimed());
    layer.dataset.responseRequestedAt = responseRequestedAt === null ? '' : String(responseRequestedAt);
    layer.dataset.responseRevealedAt = responseRevealedAt === null ? '' : String(responseRevealedAt);
    layer.dataset.responseStartTime = String(responseEntry());
    const signature = `${layer.hidden}|${layer.dataset.mode}|${desired === 'react'}|${held}|${response}`;
    if (signature !== reported) {reported = signature; onChange?.();}
  };
  const pauseFilms = ({preserveFrame = false} = {}) => {
    attempt++; pending = null; clearSeeks();
    if (!preserveFrame) showing = null;
    for (const video of Object.values(films)) {video.pause(); if (!preserveFrame) video.hidden = true;}
    notify();
  };
  const reset = () => {desired = 'idle'; response++; pauseFilms();};
  function reveal(kind) {
    if (!shouldPlay() || desired !== kind) {films[kind].pause(); return;}
    showing = kind;
    if (kind === 'react' && responseRequestedAt !== null && responseRevealedAt === null) responseRevealedAt = clock();
    for (const [name, video] of Object.entries(films)) {
      video.hidden = name !== kind;
      if (name !== kind) video.pause();
    }
    notify();
    if (kind === 'idle') primeResponse();
  }
  function primeResponse() {
    if (!reactSrc || !shouldPlay() || desired === 'react' || showing === 'react') return;
    if (!react.getAttribute('src')) {react.src = reactSrc; react.preload = 'auto'; react.load();}
    // Prepare the configured real video frame while it is hidden and paused.
    // New clips default to zero; an explicitly reviewed lead-in cut is optional.
    const entry = responseEntry(), ranges = react.seekable;
    const seekable = entry === 0 || !ranges || Array.from({length: ranges.length}, (_, i) => [ranges.start(i), ranges.end(i)]).some(([start, end]) => start <= entry && end >= entry);
    if (seekable && react.readyState >= 1 && !react.seeking && Math.abs(react.currentTime - entry) >= 1 / 48) {try {react.currentTime = entry;} catch {}}
  }
  function sync({restart = false, startTime = 0} = {}) {
    if (!shouldPlay()) {pauseFilms({preserveFrame: held}); return;}
    const kind = desired, video = films[kind];
    if (pending?.kind === kind && !restart) return;
    if (!restart && showing === kind && !video.paused) {notify(); return;}
    if (!video.getAttribute('src')) {video.src = kind === 'idle' ? idleSrc : reactSrc; video.preload = 'auto';}
    const token = ++attempt;
    if (restart) {
      clearSeeks();
      const seek = () => {video.removeEventListener('loadedmetadata', seek); metadataSeeks.delete(video); if (token === attempt && shouldPlay() && desired === kind) {try {video.currentTime = Math.max(0, Number(startTime) || 0);} catch {}}};
      if (video.readyState >= 1) seek();
      else {metadataSeeks.set(video, seek); video.addEventListener('loadedmetadata', seek);}
    }
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
      // Autoplay rejection must retain a transferred decoded frame, rather
      // than exposing the unrelated frame-zero poster after theme commit.
      blocked = true; desired = 'idle'; response++; pauseFilms({preserveFrame: showing !== null});
    });
  }
  // Decode the return pose while the avatar still owns the visible character.
  // This never plays a hidden movie and never drops a live media src on cancel.
  function prepareReturn() {
    returnPreparation?.cancel();
    let cancelled = false, settled = false, mode = null, revealed = false, fade = null, resolveReady;
    let seekRequested = false;
    const ready = new Promise(resolve => {resolveReady = resolve;});
    const events = ['loadedmetadata', 'loadeddata', 'canplay', 'seeked'];
    const clear = () => {
      clearTimeout(timer);
      for (const name of events) idle.removeEventListener(name, check);
      idle.removeEventListener('error', fallback); still.removeEventListener('load', posterLoaded);
    };
    const settle = value => {if (settled) return; settled = true; clear(); resolveReady(value);};
    const posterLoaded = () => {posterReady = !!still.naturalWidth; if (mode === 'poster') settle(posterReady);};
    const fallback = () => {mode = 'poster'; if (posterReady) settle(true);};
    const check = () => {
      if (cancelled || disposed || mode === 'poster') return;
      if (!seekRequested && idle.readyState >= 1) {
        seekRequested = true;
        try {if (Math.abs(idle.currentTime) >= 1 / 24) idle.currentTime = 0;} catch {fallback(); return;}
      }
      if (seekRequested && idle.readyState >= 2 && !idle.seeking && Math.abs(idle.currentTime) < 1 / 24) {
        mode = 'idle'; settle(true);
      }
    };
    const timer = setTimeout(() => {fallback(); settle(posterReady);}, 10000);
    const ticket = {
      ready,
      reveal({duration = 150} = {}) {
        if (cancelled || disposed || !settled || !mode || (mode === 'poster' && !posterReady)) return false;
        revealed = true; active = false; held = true; desired = 'idle';
        blocked = mode === 'poster' && !reduced; showing = mode === 'idle' ? 'idle' : null;
        for (const [kind, video] of Object.entries(films)) {video.pause(); video.hidden = kind !== showing;}
        // Crossfade from the same empty room to this paused decoded frame.
        // The travelling PNG fades out over this exact interval.
        if (duration && layer.animate) fade = layer.animate([{opacity: 0}, {opacity: 1}], {duration, easing: 'ease-out', fill: 'both'});
        notify(); return true;
      },
      complete() {cancelled = true; clear(); fade?.cancel(); fade = null; if (returnPreparation === ticket) returnPreparation = null;},
      cancel() {
        if (cancelled) return; cancelled = true; settle(false); clear(); fade?.cancel(); fade = null;
        if (returnPreparation === ticket) returnPreparation = null;
        if (revealed) {held = false; active = false; reset();} else idle.pause();
      },
    };
    returnPreparation = ticket;
    pauseFilms();
    for (const name of events) idle.addEventListener(name, check);
    idle.addEventListener('error', fallback); still.addEventListener('load', posterLoaded);
    if (reduced || failed || !idleSrc) fallback();
    else {
      if (!idle.getAttribute('src')) {idle.src = idleSrc; idle.preload = 'auto'; idle.load();}
      check();
    }
    return ticket;
  }
  const playing = Object.fromEntries(Object.keys(films).map(kind => [kind, () => reveal(kind)]));
  const decodeError = () => {failed = true; reset();};
  const ended = () => {
    // A tap may already have sought back to the start before a queued ended
    // event from the previous playback arrives. Only the current end owns idle.
    if (disposed || held || desired !== 'react' || !react.ended) return;
    desired = 'idle'; response++;
    // Direct cut back to the idle start; no frame blending or duplicated actor.
    sync({restart: true});
  };
  const loaded = () => {posterReady = !!still.naturalWidth; notify();};
  const posterError = () => {posterReady = false; notify();};
  const visibility = () => {if (held) {pauseFilms({preserveFrame: true}); return;} reset(); if (!doc.hidden) sync({restart: true});};
  for (const [kind, video] of Object.entries(films)) {
    video.addEventListener('playing', playing[kind]);
    video.addEventListener('error', decodeError);
  }
  react.addEventListener('ended', ended);
  react.addEventListener('loadeddata', primeResponse);
  react.addEventListener('canplay', primeResponse);
  react.addEventListener('progress', primeResponse);
  still.addEventListener('load', loaded);
  still.addEventListener('error', posterError);
  doc.addEventListener('visibilitychange', visibility);
  still.src = poster;
  posterReady = !!(still.complete && still.naturalWidth);
  return {
    supported: true, layer, poster: still, idle, react, prepareReturn,
    get visible() {return ownsScene();},
    update(options = {}) {
      if (disposed) return;
      const nextActive = options.active ?? active, nextReduced = options.reducedMotion ?? reduced;
      const changed = nextActive !== active || nextReduced !== reduced;
      const wasHeld = held;
      // An overlay may retain only a scene that already owns visible pixels.
      // Pause the current film in place; never substitute the empty-room plate.
      held = !!options.holdFrame && ownsScene();
      active = !!nextActive; reduced = !!nextReduced;
      if (held) {if (!wasHeld) {desired = showing || 'idle'; response++;} pauseFilms({preserveFrame: true}); return;}
      // Warm the short response while idle plays, so the first click does not
      // have to begin its network request. No offscreen response is played.
      if (initialPlayback?.mode !== 'react') primeResponse();
      if (wasHeld && active) sync();
      else if (changed || wasHeld) {
        reset();
        if (shouldPlay()) {
          const start = initialPlayback; initialPlayback = null;
          if (start?.mode === 'react' && reactSrc) desired = 'react';
          // A theme switch transfers an already decoded frame at this exact
          // time. Own those pixels before play(), without a frame-zero poster.
          const primed = start?.primed && films[desired].readyState >= 2;
          if (primed) reveal(desired);
          sync({restart: !primed, startTime: start?.time || 0});
        }
      }
      else sync();
      notify();
    },
    respond() {
      if (!reactSrc || disposed || !active || held || reduced || doc.hidden || failed) return () => {};
      blocked = false;
      const token = ++response;
      responseRequestedAt = clock(); responseRevealedAt = null;
      // Optional host tactile/UI confirmation, deliberately unwired by default.
      try {onResponseFeedback?.({sequence: token, requestedAt: responseRequestedAt});} catch {}
      const primed = react.paused && responsePrimed();
      desired = 'react';
      notify();
      // Every tap takes ownership immediately, including during the previous
      // response or its pending play promise. Keep the same visible film layer.
      // The already decoded real response frame can own the scene within the
      // click; do not wait for a play() promise or seek to that same frame again.
      if (primed) reveal('react');
      sync({restart: !primed, startTime: responseEntry()});
      return () => {if (!disposed && token === response && desired === 'react') {desired = 'idle'; response++; sync({restart: true});}};
    },
    dispose() {
      if (disposed) return;
      returnPreparation?.cancel(); disposed = true; active = false; held = false; reset();
      for (const [kind, video] of Object.entries(films)) {
        video.removeEventListener('playing', playing[kind]); video.removeEventListener('error', decodeError);
        video.removeAttribute('src'); video.load();
      }
      react.removeEventListener('ended', ended);
      react.removeEventListener('loadeddata', primeResponse);
      react.removeEventListener('canplay', primeResponse);
      react.removeEventListener('progress', primeResponse);
      still.removeEventListener('load', loaded); still.removeEventListener('error', posterError);
      doc.removeEventListener('visibilitychange', visibility);
      layer.remove();
    },
    get status() {return {active, held, visible: ownsScene(), mode: !active && !held ? 'off' : showing || 'poster', responding: active && !held && desired === 'react', responsePrimed: responsePrimed(), responseStartTime: responseEntry(), responseRequestedAt, responseRevealedAt, failed, reduced};},
  };
}
