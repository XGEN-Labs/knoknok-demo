export const ROOM_LIGHT_STORAGE_KEY = 'knoknok-room-light-v2';
export const roomThemeReady = theme => Boolean(theme?.poster && theme?.roomPoster);
const isRoomTheme = value => value === 'bright' || value === 'warm';

// Device-local wall time is intentional: birth time, server time and UTC do not
// choose the user's present room. A night belongs to the day on which it began.
export function roomLightPeriod(date = new Date()) {
  const local = new Date(date);
  if (!Number.isFinite(local.getTime())) return {theme: 'bright', key: 'invalid', valid: false};
  const hour = local.getHours(), day = hour >= 7 && hour < 19;
  if (hour < 7) local.setDate(local.getDate() - 1);
  const calendar = [local.getFullYear(), String(local.getMonth() + 1).padStart(2, '0'), String(local.getDate()).padStart(2, '0')].join('-');
  return {theme: day ? 'bright' : 'warm', key: `${calendar}:${day ? 'day' : 'night'}`, valid: true};
}
function readRoomOverride(storage) {
  try {
    const record = JSON.parse(storage?.getItem(ROOM_LIGHT_STORAGE_KEY) || 'null');
    return isRoomTheme(record?.theme) && typeof record?.period === 'string' ? {theme: record.theme, period: record.period} : null;
  } catch {return null;}
}
export function readRoomLightPreference(storage, date = new Date()) {
  const period = roomLightPeriod(date), record = readRoomOverride(storage);
  return period.valid && record?.period === period.key ? record.theme : period.theme;
}
export function writeRoomLightPreference(storage, value, date = new Date()) {
  const period = roomLightPeriod(date);
  if (!isRoomTheme(value) || !period.valid) return null;
  const record = {theme: value, period: period.key};
  try {storage?.setItem(ROOM_LIGHT_STORAGE_KEY, JSON.stringify(record));} catch {}
  return record;
}

// Automatic changes wait for an idle, unobstructed home. One preparation at a
// time preserves the decoded film; failed loads retry on a later clock event.
export function createRoomLightClock({storage, now = () => new Date(), doc, win = doc?.defaultView, getTheme, applyTheme, canApply = () => true, isBusy = () => false, onChange} = {}) {
  let override = readRoomOverride(storage), pending = null, disposed = false;
  const selection = () => {
    const period = roomLightPeriod(now()), manual = period.valid && override?.period === period.key;
    return {theme: manual ? override.theme : period.theme, mode: manual ? 'manual' : 'auto', period: period.key};
  };
  const announce = () => {const value = selection(); onChange?.(value); return value;};
  function refresh() {
    if (disposed) return Promise.resolve(false);
    const value = announce();
    if (doc?.hidden || !canApply() || isBusy()) return Promise.resolve(false);
    if (value.theme === getTheme()) return Promise.resolve(true);
    if (pending) return pending;
    const task = Promise.resolve().then(() => {
      if (disposed || doc?.hidden || !canApply() || isBusy() || selection().theme !== value.theme) return false;
      return applyTheme(value.theme, {manual: false, isCurrent: () => !disposed && !doc?.hidden && canApply() && selection().theme === value.theme});
    }).catch(() => false).finally(() => {if (pending === task) pending = null;});
    pending = task;
    return task;
  }
  function remember(theme, requestedPeriod = roomLightPeriod(now()).key) {
    if (disposed || !isRoomTheme(theme)) return;
    const current = roomLightPeriod(now());
    // A click that finishes after 07/19 must not silently extend yesterday's
    // manual choice across the new automatic period.
    if (current.valid && requestedPeriod === current.key) override = writeRoomLightPreference(storage, theme, now());
    else override = null;
    announce();
  }
  const visibility = () => {if (!doc?.hidden) void refresh();};
  const focus = () => {void refresh();};
  doc?.addEventListener?.('visibilitychange', visibility);
  win?.addEventListener?.('focus', focus);
  const timer = win?.setInterval?.(focus, 60000);
  announce();
  return {selection, remember, refresh, dispose() {
    if (disposed) return;
    disposed = true;
    if (timer !== undefined) win?.clearInterval?.(timer);
    doc?.removeEventListener?.('visibilitychange', visibility);
    win?.removeEventListener?.('focus', focus);
  }};
}

export function projectRoomLamp(width, height, theme) {
  if (!(width > 0 && height > 0 && theme?.width > 0 && theme?.height > 0 && theme?.lamp)) return null;
  const s = Math.max(width / theme.width, height / theme.height);
  const cx = theme.lamp.x * s - (theme.width * s - width) / 2;
  const cy = theme.lamp.y * s - (theme.height * s - height) / 2;
  // Never move an offscreen lamp's target onto unrelated scenery.
  if (cx < 0 || cx > width || cy < 0 || cy > height) return null;
  const w = Math.max(44, theme.lamp.width * s), h = Math.max(44, theme.lamp.height * s);
  if (w > width || h > height) return null;
  return {x: Math.max(0, Math.min(width - w, cx - w / 2)), y: Math.max(0, Math.min(height - h, cy - h / 2)), width: w, height: h};
}
export const rectanglesOverlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export function createRoomLightSwitch({phone, getState, onToggle} = {}) {
  const doc = phone.ownerDocument;
  const button = doc.createElement('button');
  button.type = 'button'; button.className = 'room-lamp-switch';
  Object.assign(button.style, {position: 'absolute', zIndex: '2', padding: '0', border: '0', background: 'transparent', borderRadius: '50%', cursor: 'pointer', touchAction: 'manipulation'});
  phone.append(button);
  let busy = false, disposed = false;
  function update() {
    if (disposed) return;
    const state = getState(), rect = projectRoomLamp(state.width, state.height, state.theme);
    let blocked = false;
    if (rect && phone.getBoundingClientRect && phone.querySelectorAll) {
      const bounds = phone.getBoundingClientRect();
      if (bounds.width && bounds.height) for (const control of phone.querySelectorAll('.home-top, .home-chat-bottom, .conversation-message, button, input, textarea, a, [role="button"]')) {
        if (control === button || control.hidden || !control.getBoundingClientRect) continue;
        const r = control.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const box = {x:(r.left-bounds.left)*state.width/bounds.width, y:(r.top-bounds.top)*state.height/bounds.height, width:r.width*state.width/bounds.width, height:r.height*state.height/bounds.height};
        if (rectanglesOverlap(rect, box)) {blocked = true; break;}
      }
    }
    button.hidden = !state.active || !rect || blocked;
    button.disabled = busy || !state.targetReady;
    button.setAttribute('aria-pressed', String(state.id === 'bright'));
    button.setAttribute('aria-label', state.targetReady ? `切換為${state.id === 'bright' ? '夜晚' : '白天'}場景` : `${state.id === 'bright' ? '夜晚' : '白天'}場景素材準備中`);
    button.title = state.targetReady ? `點燈切換為${state.id === 'bright' ? '夜晚' : '白天'}場景` : `${state.id === 'bright' ? '夜晚' : '白天'}場景素材準備中`;
    if (rect) Object.assign(button.style, {left:`${rect.x}px`, top:`${rect.y}px`, width:`${rect.width}px`, height:`${rect.height}px`});
  }
  const click = event => {
    event.preventDefault(); event.stopPropagation();
    if (busy || button.disabled || button.hidden || disposed) return;
    busy = true; update();
    Promise.resolve().then(onToggle).catch(() => {}).finally(() => {busy = false; update();});
  };
  button.addEventListener('click', click);
  const resize = () => update();
  const observer = typeof doc.defaultView?.ResizeObserver === 'function' ? new doc.defaultView.ResizeObserver(resize) : null;
  observer?.observe(phone);
  // Chat bubbles can scroll over the lamp; covered text must retain its gesture.
  phone.addEventListener?.('scroll', resize, true);
  update();
  return {button, update, dispose() {disposed = true; observer?.disconnect(); phone.removeEventListener?.('scroll', resize, true); button.removeEventListener('click', click); button.remove();}};
}

export function captureRoomFade({container, source, width, height, duration = 320} = {}) {
  if (!source) return null;
  const canvas = container.ownerDocument.createElement('canvas');
  const context = canvas.getContext?.('2d');
  if (!context) return null;
  const sw = source.videoWidth || source.naturalWidth, sh = source.videoHeight || source.naturalHeight;
  if (!(sw > 0 && sh > 0)) return null;
  canvas.width = Math.round(width); canvas.height = Math.round(height);
  const scale = Math.max(width / sw, height / sh);
  try {context.drawImage(source, (width-sw*scale)/2, (height-sh*scale)/2, sw*scale, sh*scale);} catch {return null;}
  canvas.className = 'room-light-fade'; canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {position:'absolute', inset:'0', width:'100%', height:'100%', pointerEvents:'none', zIndex:'1'});
  let animation = null, removed = false;
  const dispose = () => {if (removed) return; removed = true; animation?.cancel(); canvas.remove();};
  return {dispose, start() {if (removed) return; container.append(canvas); if (!canvas.animate) {dispose(); return;} animation = canvas.animate([{opacity:1},{opacity:0}], {duration, easing:'ease-out', fill:'forwards'}); animation.finished.then(dispose, dispose);}};
}


// Theme media is prepared offscreen. Transferring the same decoded video node
// avoids destroying a scene before its replacement has the matching frame.
export function prepareRoomFilm({doc, src, signal, timeout = 10000, onState} = {}) {
  if (!src) return Promise.resolve(null);
  const video = doc.createElement('video');
  video.muted = true; video.defaultMuted = true; video.playsInline = true;
  video.preload = 'auto'; video.hidden = true; video.setAttribute('playsinline', '');
  // A decoded first frame does not imply that a newly downloaded file can
  // seek to the outgoing pose. HTTP200 progressive loads may clamp an early
  // seek to zero; Range-serving hosts advertise the full seekable duration.
  const seekable = () => {
    const duration = Number(video.duration);
    if (!video.seekable || !Number.isFinite(duration) || duration <= 0) return true;
    for (let i = 0; i < video.seekable.length; i++) if (video.seekable.start(i) <= 1 / 24 && video.seekable.end(i) >= duration - 1 / 24) return true;
    return false;
  };
  return waitForRoomFilm(video, () => video.readyState >= 2 && seekable(), ['loadeddata', 'canplay', 'canplaythrough', 'progress', 'suspend', 'durationchange'], signal, timeout, () => {video.src = src; video.load();}, onState);
}
export function seekRoomFilm(video, time, {signal, timeout = 10000, onState} = {}) {
  if (!video) return Promise.resolve(null);
  const duration = Number(video.duration), requested = Math.max(0, Number(time) || 0);
  const target = Number.isFinite(duration) && duration > 0 ? Math.min(requested, Math.max(0, duration - 1 / 48)) : requested;
  return waitForRoomFilm(video, () => video.readyState >= 2 && !video.seeking && Math.abs(video.currentTime - target) < 1 / 24, ['seeked', 'loadeddata', 'canplay', 'timeupdate'], signal, timeout, () => {video.currentTime = target;}, onState);
}
function waitForRoomFilm(video, ready, events, signal, timeout, start, onState) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const clear = () => {clearTimeout(timer); for (const name of events) video.removeEventListener(name, check); video.removeEventListener('error', failed); signal?.removeEventListener('abort', aborted);};
    const ranges = value => value ? Array.from({length: value.length}, (_, i) => [value.start(i), value.end(i)]) : [];
    const report = (event, error) => onState?.({event, error: error ? String(error) : undefined, src: video.getAttribute('src'), time: video.currentTime, duration: video.duration, ready: video.readyState, seeking: !!video.seeking, connected: !!video.isConnected, network: video.networkState, seekable: ranges(video.seekable), buffered: ranges(video.buffered)});
    const finish = (error) => {if (settled) return; report(error ? 'failed' : 'ready', error); settled = true; clear(); if (error) {video.pause(); video.removeAttribute('src'); video.load(); reject(error);} else resolve(video);};
    const check = event => {report(event?.type || 'check'); if (ready()) finish();};
    const failed = () => finish(new Error('Room video unavailable'));
    const aborted = () => finish(new Error('Room video preparation cancelled'));
    const timer = setTimeout(() => finish(new Error('Room video preparation timed out')), timeout);
    for (const name of events) video.addEventListener(name, check);
    video.addEventListener('error', failed); signal?.addEventListener('abort', aborted, {once: true});
    if (signal?.aborted) {aborted(); return;}
    try {start(); check();} catch (error) {finish(error);}
  });
}
