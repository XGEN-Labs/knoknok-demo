/**
 * A cue-driven background video. UI is unlocked only after the current cue has
 * stopped, or after a recoverable media failure. This module owns playback only;
 * callers own the video element, its source/poster, and every visible control.
 *
 * update({ active, key, reducedMotion, restore }) is safe on every app render.
 * Initial entry at a later cue, reverse navigation, and restore hold that cue's
 * end frame. Forward navigation plays only the next configured interval, so
 * unwanted sections of a supplied film can be skipped without editing it.
 */
export function createLandingVideoPlayer({
  video,
  cues,
  onState = () => {},
  documentRef = globalThis.document,
  scheduler = {},
  stallTimeoutMs = 8000,
} = {}) {
  if (!video?.addEventListener || typeof video.play !== 'function') {
    throw new TypeError('A video element is required');
  }
  if (!Array.isArray(cues) || !cues.length) throw new TypeError('At least one video cue is required');
  const cueList = cues.map(({ key, start, end }) => {
    if (typeof key !== 'string' || !key || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) {
      throw new TypeError('Video cues require a key and a nonnegative start/end interval');
    }
    return Object.freeze({ key, start, end });
  });
  const cueIndexes = new Map(cueList.map((cue, index) => [cue.key, index]));
  if (cueIndexes.size !== cueList.length) throw new TypeError('Video cue keys must be unique');

  const later = scheduler.setTimeout || globalThis.setTimeout.bind(globalThis);
  const cancelLater = scheduler.clearTimeout || globalThis.clearTimeout.bind(globalThis);
  const requestFrame = scheduler.requestAnimationFrame || globalThis.requestAnimationFrame?.bind(globalThis)
    || ((callback) => later(callback, 16));
  const cancelFrame = scheduler.cancelAnimationFrame || globalThis.cancelAnimationFrame?.bind(globalThis) || cancelLater;
  const timeoutMs = Number.isFinite(stallTimeoutMs) ? Math.max(100, stallTimeoutMs) : 8000;
  const listeners = [];
  let active = false;
  let disposed = false;
  let reducedMotion = false;
  let index = -1;
  let mode = 'none';
  let state = 'inactive';
  let reason = '';
  let frameId = null;
  let frameKind = '';
  let watchdogId = null;
  let playEpoch = 0;
  let playPending = false;
  let pendingSeek = null;
  let lastProgress = 0;
  let playAttempts = 0;
  let hasPresentedFrame = false;
  let suspended = false;
  let lastNotification = '';

  const cue = () => cueList[index] || null;
  const hidden = () => documentRef?.hidden === true || documentRef?.visibilityState === 'hidden';
  const mediaTime = () => Number.isFinite(video.currentTime) ? video.currentTime : 0;
  const targetTime = () => {
    const target = cue()?.end ?? 0;
    return Number.isFinite(video.duration) && video.duration > 0 ? Math.min(target, video.duration) : target;
  };
  const canRun = () => !disposed && active && !suspended && !hidden() && mode === 'play';

  function getDiagnostics() {
    return {
      state, key: cue()?.key ?? null, active, reducedMotion, disposed,
      readyForInput: active && (state === 'waiting' || state === 'fallback'),
      reason, currentTime: mediaTime(), startTime: cue()?.start ?? null,
      targetTime: cue() ? targetTime() : null,
      duration: Number.isFinite(video.duration) ? video.duration : null,
      paused: Boolean(video.paused), readyState: Number(video.readyState) || 0,
      playAttempts, hasPresentedFrame,
    };
  }

  function report(nextState, nextReason = '') {
    state = nextState;
    reason = nextReason;
    const signature = `${state}|${cue()?.key ?? ''}|${reason}|${active}`;
    if (signature === lastNotification || disposed) return;
    lastNotification = signature;
    onState(getDiagnostics());
  }

  function clearWatchdog() {
    if (watchdogId !== null) cancelLater(watchdogId);
    watchdogId = null;
  }

  function clearFrame() {
    if (frameId !== null) {
      if (frameKind === 'video') video.cancelVideoFrameCallback?.(frameId);
      else cancelFrame(frameId);
    }
    frameId = null;
    frameKind = '';
  }

  function stopPlayback() {
    playEpoch += 1;
    playPending = false;
    clearFrame();
    clearWatchdog();
    video.pause();
  }

  function seek(time) {
    // Adjacent intervals share their boundary frame. Reassigning currentTime at
    // that same decoded frame needlessly invalidates the decoder surface.
    if (!video.seeking && video.readyState >= 2 && Math.abs(mediaTime() - time) < 0.000001) {
      pendingSeek = null;
      return;
    }
    pendingSeek = time;
    try {
      video.currentTime = time;
      // Before metadata, browsers may accept but ignore a seek. Reapply it once
      // metadata arrives, without restarting a cue or replaying a held frame.
      if (video.readyState >= 1) pendingSeek = null;
    } catch {
      // Metadata/seekability may arrive after this render.
    }
  }

  function applyPendingSeek() {
    if (pendingSeek !== null && video.readyState >= 1) seek(pendingSeek);
  }

  function finish() {
    if (!cue() || disposed) return;
    mode = 'hold';
    stopPlayback();
    seek(targetTime());
    report(active ? 'waiting' : 'inactive');
  }

  function fallback(failure) {
    mode = 'fallback';
    stopPlayback();
    report(active ? 'fallback' : 'inactive', failure);
  }

  function armWatchdog() {
    clearWatchdog();
    if (!canRun()) return;
    watchdogId = later(() => {
      watchdogId = null;
      if (canRun()) fallback(hasPresentedFrame ? 'playback-stalled' : 'load-timeout');
    }, timeoutMs);
  }

  function sampleFrame(presentedTime) {
    if (!canRun()) return;
    if (pendingSeek !== null) return;
    const time = mediaTime();
    if (time >= targetTime() - 0.008 || (Number.isFinite(presentedTime) && presentedTime >= targetTime())) {
      finish();
      return;
    }
    if (time > lastProgress + 0.008) {
      lastProgress = time;
      hasPresentedFrame = true;
      if (state === 'loading') report('playing');
      armWatchdog();
    }
  }

  function queueFrame() {
    if (!canRun() || frameId !== null) return;
    if (typeof video.requestVideoFrameCallback === 'function') {
      frameKind = 'video';
      frameId = video.requestVideoFrameCallback((_now, metadata) => {
        frameId = null;
        sampleFrame(metadata?.mediaTime);
        queueFrame();
      });
    } else {
      frameKind = 'animation';
      frameId = requestFrame(() => {
        frameId = null;
        sampleFrame();
        queueFrame();
      });
    }
  }

  function playFailed(error, epoch) {
    if (disposed || epoch !== playEpoch || !canRun()) return;
    playPending = false;
    if (error?.name === 'NotAllowedError') {
      mode = 'blocked';
      stopPlayback();
      report('blocked', 'user-gesture-required');
    } else {
      fallback(error?.name === 'NotSupportedError' ? 'unsupported-media' : 'playback-failed');
    }
  }

  function startPlayback() {
    if (!canRun() || playPending) return;
    if (video.error) {
      fallback('media-error');
      return;
    }
    applyPendingSeek();
    if (cue().end === cue().start || (pendingSeek === null && mediaTime() >= targetTime() - 0.008)) {
      finish();
      return;
    }
    const epoch = ++playEpoch;
    playPending = true;
    lastProgress = mediaTime();
    report('loading');
    if (!canRun() || epoch !== playEpoch) return;
    armWatchdog();
    queueFrame();
    playAttempts += 1;
    let result;
    try { result = video.play(); } catch (error) { playFailed(error, epoch); return; }
    Promise.resolve(result).then(() => {
      if (disposed || epoch !== playEpoch || !canRun()) {
        // A delayed play promise must not restart an inactive/held video. Do not
        // pause a newer cue which is legitimately playing on the same element.
        if (!disposed && !canRun()) video.pause();
        return;
      }
      playPending = false;
      report('playing');
      sampleFrame();
      queueFrame();
    }, (error) => playFailed(error, epoch));
  }

  function enterCurrentMode() {
    if (!active) { report('inactive'); return; }
    suspended = hidden();
    if (reducedMotion || mode === 'hold') { finish(); return; }
    if (mode === 'fallback') {
      recoverBufferedFrame();
      if (mode === 'fallback') report('fallback', reason || 'media-error');
      return;
    }
    if (mode === 'blocked') { report('blocked', 'user-gesture-required'); return; }
    if (suspended) { report('loading', 'visibility-hidden'); return; }
    startPlayback();
  }

  function update({ active: nextActive = false, key, reducedMotion: nextReducedMotion = false, restore = false } = {}) {
    if (disposed) return getDiagnostics();
    const wasActive = active;
    const wasReducedMotion = reducedMotion;
    active = Boolean(nextActive);
    reducedMotion = Boolean(nextReducedMotion);
    if (!active) {
      if (wasActive) stopPlayback();
      suspended = false;
      report('inactive', mode === 'fallback' ? reason : '');
      return getDiagnostics();
    }
    const nextIndex = cueIndexes.get(key);
    if (nextIndex === undefined) {
      fallback('unknown-cue');
      return getDiagnostics();
    }
    const changed = nextIndex !== index;
    if (changed) {
      const previousIndex = index;
      stopPlayback();
      index = nextIndex;
      hasPresentedFrame = false;
      const hold = restore || reducedMotion || (previousIndex < 0 && nextIndex > 0)
        || (previousIndex >= 0 && nextIndex < previousIndex) || cue().start === cue().end;
      mode = hold ? 'hold' : 'play';
      reason = '';
      seek(hold ? targetTime() : cue().start);
      enterCurrentMode();
    } else if (restore || (reducedMotion && !wasReducedMotion)) {
      finish();
    } else if (!wasActive) {
      enterCurrentMode();
    }
    return getDiagnostics();
  }

  /** Call directly from a user click/tap to retry autoplay without losing gesture activation. */
  function retry() {
    if (disposed || !active || !cue() || (mode !== 'blocked' && mode !== 'fallback')) return false;
    mode = 'play';
    reason = '';
    suspended = hidden();
    if (reducedMotion) finish();
    else if (!suspended) startPlayback();
    return true;
  }

  /** Skip only this film interval. The caller still owns and validates its answer. */
  function skip() {
    if (disposed || !active || !cue() || (mode !== 'play' && mode !== 'blocked')) return false;
    finish();
    return true;
  }

  function listen(target, event, handler) {
    if (!target?.addEventListener) return;
    target.addEventListener(event, handler);
    listeners.push(() => target.removeEventListener(event, handler));
  }

  function recoverBufferedFrame() {
    // A slow range request may finish after the fallback form is already open.
    // Restore this question's held frame, without replaying dialogue or moving
    // on to another answer. Real media/format errors retain the fallback.
    if (!disposed && active && !hidden() && mode === 'fallback'
      && ['load-timeout', 'playback-stalled'].includes(reason)
      && !video.error && Number(video.readyState) >= 2) finish();
  }

  listen(video, 'loadedmetadata', () => {
    if (disposed) return;
    applyPendingSeek();
    if (mode === 'hold') seek(targetTime());
    if (canRun()) sampleFrame();
  });
  listen(video, 'timeupdate', () => sampleFrame());
  listen(video, 'playing', () => {
    if (!canRun()) { video.pause(); return; }
    report('playing');
    queueFrame();
  });
  listen(video, 'waiting', () => {
    if (canRun()) report('loading', 'buffering');
  });
  listen(video, 'stalled', () => {
    if (canRun()) report('loading', 'buffering');
  });
  for (const event of ['loadeddata', 'canplay', 'canplaythrough']) listen(video, event, recoverBufferedFrame);
  listen(video, 'ended', () => { if (canRun()) finish(); });
  listen(video, 'error', () => { if (cue() && !disposed) fallback('media-error'); });
  listen(documentRef, 'visibilitychange', () => {
    recoverBufferedFrame();
    if (!active || disposed || mode !== 'play') return;
    if (hidden()) {
      suspended = true;
      stopPlayback();
      report('loading', 'visibility-hidden');
    } else if (suspended) {
      suspended = false;
      startPlayback();
    }
  });

  function dispose() {
    if (disposed) return;
    stopPlayback();
    disposed = true;
    active = false;
    state = 'inactive';
    for (const remove of listeners.splice(0)) remove();
  }

  return Object.freeze({ update, retry, skip, getDiagnostics, dispose });
}
