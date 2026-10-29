// The empty-room film stays behind the original, interactive Klin artwork.
// Keep the room still visible until an actual video frame has reached playback.
export function createRoomVideo({container, src, poster, startTime = 0, videoElement, reducedMotion = false} = {}) {
  const doc = container?.ownerDocument;
  if (!doc) throw new TypeError('A room container is required.');
  const video = videoElement || doc.createElement('video');
  if (typeof video.play !== 'function') return {update() {}, dispose() {}};
  video.className = 'klin-room-video';
  video.muted = true; video.defaultMuted = true; video.loop = true; video.playsInline = true;
  video.preload = 'none'; video.poster = poster; video.hidden = true;
  video.setAttribute('aria-hidden', 'true'); video.setAttribute('playsinline', '');
  Object.assign(video.style, {position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none'});
  container.append(video);
  let active = false, reduced = !!reducedMotion, disposed = false, failed = false, pending = false, attempt = 0;
  const shouldPlay = () => !!src && active && !reduced && !doc.hidden && !disposed && !failed;
  let initialSeek = null;
  const conceal = () => {video.hidden = true;};
  const playing = () => {if (shouldPlay()) video.hidden = false;};
  const pause = () => {attempt++; pending = false; conceal(); video.pause();};
  const error = () => {failed = true; pause();};
  const sync = () => {
    if (!shouldPlay()) {pause(); return;}
    if (pending || !video.paused) return;
    if (!video.getAttribute('src')) {
      video.src = src; video.preload = 'auto';
      initialSeek = () => {video.removeEventListener('loadedmetadata', initialSeek); initialSeek = null; if (!disposed && !failed) {try {video.currentTime = Math.max(0, Number(startTime) || 0);} catch {}}};
      if (video.readyState >= 1) initialSeek(); else video.addEventListener('loadedmetadata', initialSeek);
    }
    if (videoElement && video.readyState >= 2) playing();
    const token = ++attempt; pending = true;
    Promise.resolve().then(() => {if (token === attempt && shouldPlay()) return video.play();}).then(() => {
      if (disposed || token !== attempt) return;
      pending = false;
    }, () => {if (token === attempt) {pending = false; conceal();}});
  };
  const visibility = () => sync();
  video.addEventListener('playing', playing);
  video.addEventListener('error', error);
  doc.addEventListener('visibilitychange', visibility);
  return {
    video,
    update(options = {}) {if (disposed) return; active = options.active ?? active; reduced = options.reducedMotion ?? reduced; sync();},
    dispose() {if (disposed) return; disposed = true; pause(); if (initialSeek) {video.removeEventListener('loadedmetadata', initialSeek); initialSeek = null;} video.removeEventListener('playing', playing); video.removeEventListener('error', error); doc.removeEventListener('visibilitychange', visibility); video.removeAttribute('src'); video.load(); video.remove();},
  };
}
