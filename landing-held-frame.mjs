/**
 * Freeze a decoded, paused video frame onto a normal canvas before glass UI
 * samples it. A paused decoder texture can still be replaced while seeking;
 * neither currentTime nor the player's logical waiting state proves it is ready.
 */
export function createLandingHeldFrame({ video, canvas, onSettled = () => {}, scheduler = {}, timeoutMs = 1500 } = {}) {
  if (!video?.addEventListener || !canvas) throw new TypeError('A video and canvas are required');
  const later = scheduler.setTimeout || globalThis.setTimeout.bind(globalThis);
  const cancelLater = scheduler.clearTimeout || globalThis.clearTimeout.bind(globalThis);
  const requestFrame = scheduler.requestAnimationFrame || globalThis.requestAnimationFrame?.bind(globalThis)
    || ((callback) => later(callback, 16));
  const cancelFrame = scheduler.cancelAnimationFrame || globalThis.cancelAnimationFrame?.bind(globalThis) || cancelLater;
  let epoch = 0, disposed = false, state = 'idle', key = null, targetTime = null;
  let frameId = null, videoFrameId = null, timeoutId = null, stableFrames = 0;
  let captured = false, reason = '', captures = 0;
  const listeners = [];

  const diagnostics = () => ({ state, key, targetTime, captured, reason, captures });
  const pending = token => !disposed && token === epoch && state === 'settling';
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
      if (!decoded()) stableFrames = 0;
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
            // boundary, so allow one source frame (the runtime is 30fps).
            if (Number.isFinite(metadata?.mediaTime) && Math.abs(metadata.mediaTime - targetTime) <= 1 / 30 + 0.001) capture(token);
          });
        }
      }
      queue(token);
    });
  }
  function hold({ key: nextKey, targetTime: nextTime } = {}) {
    if (disposed) return diagnostics();
    if (nextKey === key && nextTime === targetTime && state !== 'idle') return diagnostics();
    epoch += 1;
    cancelPending();
    key = nextKey;
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
  function release() {
    epoch += 1;
    cancelPending();
    state = 'idle';
    key = targetTime = null;
    captured = false;
    reason = '';
  }
  // A new seek invalidates any render opportunities counted for the old frame.
  const onSeeking = () => { stableFrames = 0; };
  video.addEventListener('seeking', onSeeking);
  listeners.push(() => video.removeEventListener('seeking', onSeeking));
  function dispose() {
    if (disposed) return;
    release();
    disposed = true;
    for (const remove of listeners) remove();
  }
  return Object.freeze({ hold, release, dispose, getDiagnostics: diagnostics });
}
