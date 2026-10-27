// The empty-room film stays behind the original, interactive Klin artwork.
// Keep the room still visible until an actual video frame has reached playback.
export function createRoomVideo({container, src, poster, reducedMotion = false} = {}) {
  const doc = container?.ownerDocument;
  if (!doc) throw new TypeError('A room container is required.');
  const video = doc.createElement('video');
  if (typeof video.play !== 'function') return {update() {}, dispose() {}};
  video.className = 'klin-room-video';
  video.muted = true; video.defaultMuted = true; video.loop = true; video.playsInline = true;
  video.preload = 'none'; video.poster = poster; video.hidden = true;
  video.setAttribute('aria-hidden', 'true'); video.setAttribute('playsinline', '');
  Object.assign(video.style, {position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none'});
  container.append(video);
  let active = false, reduced = !!reducedMotion, disposed = false, failed = false, pending = false, attempt = 0;
  const shouldPlay = () => active && !reduced && !doc.hidden && !disposed && !failed;
  const conceal = () => {video.hidden = true;};
  const playing = () => {if (shouldPlay()) video.hidden = false;};
  const pause = () => {attempt++; pending = false; conceal(); video.pause();};
  const error = () => {failed = true; pause();};
  const sync = () => {
    if (!shouldPlay()) {pause(); return;}
    if (pending || !video.paused) return;
    if (!video.getAttribute('src')) {video.src = src; video.preload = 'auto';}
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
    dispose() {if (disposed) return; disposed = true; pause(); video.removeEventListener('playing', playing); video.removeEventListener('error', error); doc.removeEventListener('visibilitychange', visibility); video.removeAttribute('src'); video.load(); video.remove();},
  };
}
