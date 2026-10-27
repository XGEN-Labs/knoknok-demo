/**
 * Freeze a decoded, paused video frame onto a normal canvas before glass UI
 * samples it. A paused decoder texture can still be replaced while seeking;
 * neither currentTime nor the player's logical waiting state proves it is ready.
 */
export function createLandingHeldFrame({ video, canvas, onSettled = () => {}, scheduler = {}, documentRef = globalThis.document, timeoutMs = 1500, frameRate = 30 } = {}) {
  if (!video?.addEventListener || !canvas) throw new TypeError('A video and canvas are required');
  const later = scheduler.setTimeout || globalThis.setTimeout.bind(globalThis);
  const cancelLater = scheduler.clearTimeout || globalThis.clearTimeout.bind(globalThis);
  const requestFrame = scheduler.requestAnimationFrame || globalThis.requestAnimationFrame?.bind(globalThis)
    || ((callback) => later(callback, 16));
  const cancelFrame = scheduler.cancelAnimationFrame || globalThis.cancelAnimationFrame?.bind(globalThis) || cancelLater;
  const sourceFrameDuration = 1 / (Number.isFinite(frameRate) && frameRate > 0 ? frameRate : 30);
  let epoch = 0, disposed = false, state = 'idle', key = null, targetTime = null;
  let frameId = null, videoFrameId = null, timeoutId = null, stableFrames = 0;
  let captured = false, reason = '', captures = 0;
  let resumeStart = null, resumeEnd = null;
  const listeners = [];

  const diagnostics = () => ({ state, key, targetTime, captured, reason, captures, resumeStart });
  // The timeout unlocks the form, but it does not make a delayed network seek a
  // permanent failure. A later decoded frame may restore the film in place.
  const recoverable = () => state === 'unavailable' && reason === 'frame-timeout';
  const pending = token => !disposed && token === epoch && (state === 'settling' || recoverable());
  const decoded = () => !video.seeking && video.paused && Number(video.readyState) >= 2
    && video.videoWidth > 0 && video.videoHeight > 0
    && Math.abs(Number(video.currentTime) - targetTime) < 1 / 60;

  function cancelPending() {
    if (frameId !== null) cancelFrame(frameId);
    if (videoFrameId !== null) video.cancelVideoFrameCallback?.(videoFrameId);
    if (timeoutId !== null) cancelLater(timeoutId);
    frameId = videoFrameId = timeoutId = null;
    stableFrames = 0;
  }
  function settle(token, success, failure = '') {
    if (!pending(token)) return;
    cancelPending();
    captured = success;
    reason = failure;
    state = success ? 'ready' : 'unavailable';
    onSettled(diagnostics());
  }
  function capture(token) {
    if (!pending(token) || !decoded()) return false;
    try {
      const context = canvas.getContext?.('2d', { alpha: false });
      if (!context) { settle(token, false, 'canvas-unavailable'); return true; }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      captures += 1;
      settle(token, true);
    } catch {
      // A resource/platform failure must never trap the onboarding form.
      settle(token, false, 'capture-failed');
    }
    return true;
  }
  function queue(token) {
    if (!pending(token) || frameId !== null) return;
    frameId = requestFrame(() => {
      if (!pending(token)) return;
      frameId = null;
      if (!decoded()) {
        stableFrames = 0;
        if (recoverable()) { cancelPending(); return; }
      }
      else {
        stableFrames += 1;
        // Paused video does not always dispatch a fresh video-frame callback.
        // Two render opportunities after seek completion are the bounded path.
        if (stableFrames >= 2 && capture(token)) return;
        if (videoFrameId === null && typeof video.requestVideoFrameCallback === 'function') {
          videoFrameId = video.requestVideoFrameCallback((_now, metadata) => {
            if (!pending(token)) return;
            videoFrameId = null;
            // Metadata describes the decoded frame; a frame can span a target
            // boundary, so allow one frame at this source video's frame rate.
            if (Number.isFinite(metadata?.mediaTime) && Math.abs(metadata.mediaTime - targetTime) <= sourceFrameDuration + 0.001) capture(token);
          });
        }
      }
      queue(token);
    });
  }
  function hold({ key: nextKey, targetTime: nextTime } = {}) {
    if (disposed) return diagnostics();
    if (nextKey === key && nextTime === targetTime && state !== 'idle' && state !== 'resuming') {
      recover();
      return diagnostics();
    }
    epoch += 1;
    cancelPending();
    key = nextKey;
    resumeStart = resumeEnd = null;
    targetTime = nextTime;
    captured = false;
    reason = '';
    state = 'settling';
    const token = epoch;
    if (!Number.isFinite(targetTime)) {
      settle(token, false, 'invalid-target');
      return diagnostics();
    }
    timeoutId = later(() => settle(token, false, 'frame-timeout'), Math.max(100, timeoutMs));
    queue(token);
    return diagnostics();
  }
  // A play() promise or `playing` event does not prove its next frame is on
  // screen. Keep the still above the running decoder until it presents one.
  function resume({ startTime, endTime = Infinity } = {}) {
    if (disposed || !captured || !Number.isFinite(startTime)) return diagnostics();
    if (state === 'resuming' && resumeStart === startTime && resumeEnd === endTime) return diagnostics();
    epoch += 1;
    cancelPending();
    state = 'resuming'; resumeStart = startTime; resumeEnd = endTime;
    const token = epoch;
    const current = () => !disposed && token === epoch && state === 'resuming';
    const drawable = time => !video.paused && !video.seeking && Number(video.readyState) >= 2
      && Number.isFinite(time) && time >= startTime && time < endTime;
    const presented = () => { release(); onSettled(diagnostics()); };
    function next() {
      if (!current()) return;
      if (typeof video.requestVideoFrameCallback === 'function') {
        videoFrameId = video.requestVideoFrameCallback((_now, metadata) => {
          if (!current()) return;
          videoFrameId = null;
          if (drawable(metadata?.mediaTime)) presented(); else next();
        });
      } else {
        // Older browsers: wait for advancing media time and two render chances.
        frameId = requestFrame(() => {
          if (!current()) return;
          frameId = null;
          if (drawable(Number(video.currentTime)) && Number(video.currentTime) > startTime + 0.000001) stableFrames += 1;
          else stableFrames = 0;
          if (stableFrames >= 2) presented(); else next();
        });
      }
    }
    next();
    return diagnostics();
  }
  function release() {
    epoch += 1;
    cancelPending();
    state = 'idle';
    key = targetTime = null;
    resumeStart = resumeEnd = null;
    captured = false;
    reason = '';
  }
  // A new seek invalidates any render opportunities counted for the old frame.
  const onSeeking = () => { stableFrames = 0; };
  video.addEventListener('seeking', onSeeking);
  listeners.push(() => video.removeEventListener('seeking', onSeeking));
  function recover() {
    // No polling while a download is stalled. Browser media events (or returning
    // to a foreground tab) restart just the bounded two-frame capture, keeping
    // the fallback form usable until the correct frame is ready.
    if (!disposed && recoverable() && decoded() && documentRef?.hidden !== true) queue(epoch);
  }
  for (const event of ['loadeddata', 'seeked', 'canplay', 'canplaythrough']) {
    video.addEventListener(event, recover);
    listeners.push(() => video.removeEventListener(event, recover));
  }
  documentRef?.addEventListener?.('visibilitychange', recover);
  listeners.push(() => documentRef?.removeEventListener?.('visibilitychange', recover));
  function dispose() {
    if (disposed) return;
    release();
    disposed = true;
    for (const remove of listeners) remove();
  }
  return Object.freeze({ hold, resume, release, dispose, getDiagnostics: diagnostics });
}
