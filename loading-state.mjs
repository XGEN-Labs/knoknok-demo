export const LOADING_LABELS = Object.freeze({
  welcome: '正在靠近你…',
  landing: '正在靠近你…',
  room: '正在把房間點亮…',
});

// May be placed inside #phone before the module graph loads. The runtime adopts
// this exact node, so the first paint and subsequent resource waits use one layer.
export const LOADING_CHARACTER_MARKUP = `<svg viewBox="0 0 144 144" width="72" height="72" fill="none" focusable="false" aria-hidden="true">
  <g class="loading-character-body">
    <path class="loading-character-outline" d="M33 118C19 115 14 104 18 91L10 88Q18 81 17 72L11 64Q25 64 30 53L27 37Q40 42 49 35Q62 29 72 12Q82 31 94 36Q104 42 117 36L115 53Q122 63 133 65L128 75Q126 81 135 89L126 94Q129 112 111 119Q108 126 98 124L88 124Q72 128 56 124L46 124Q36 126 33 118Z"/>
    <g class="loading-character-foot is-left"><path d="M38 119q8 4 16 1"/></g>
    <g class="loading-character-foot is-right"><path d="M90 120q8 3 16-1"/></g>
    <g class="loading-character-gaze"><g class="loading-character-eyes"><ellipse cx="59" cy="82" rx="3.7" ry="8"/><ellipse cx="84" cy="82" rx="3.7" ry="8"/></g></g>
  </g>
</svg>`;
export function loadingIndicatorMarkup(label='正在靠近你…') {
  const safe=String(label).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return `<span class="scene-loading-inline" role="status"><span class="scene-loading-symbol">${LOADING_CHARACTER_MARKUP}</span><span class="sr-only">${safe}</span></span>`;
}
export const LOADING_BOOT_MARKUP = `<div class="scene-loading" data-loading-variant="fullscreen" data-loading-state="visible" data-loading-scene="welcome" aria-hidden="false">
  <div class="scene-loading-content">
    <div class="scene-loading-symbol" aria-hidden="true">${LOADING_CHARACTER_MARKUP}</div>
    <p class="scene-loading-label" role="status" aria-live="polite" aria-atomic="true">正在靠近你…</p>
  </div>
</div>`;

/** Resource-state coordinator; it does not load media or manufacture progress.
 * begin() returns a token-bound completion function, so late resource callbacks
 * cannot release a later request with the same key. Errors should finish or
 * clear their request; an upper bound also fails open if an event never arrives.
 */
export function createLoadingController({
  delayMs = 180, minVisibleMs = 360, fadeMs = 180, maxPendingMs = 20000,
  initiallyVisible = false, reducedMotion = false, scheduler = {},
  onChange = () => {}, onTimeout = () => {},
} = {}) {
  const later = scheduler.setTimeout || globalThis.setTimeout.bind(globalThis);
  const cancel = scheduler.clearTimeout || globalThis.clearTimeout.bind(globalThis);
  const now = scheduler.now || (() => globalThis.performance?.now?.() ?? Date.now());
  const duration = (value, fallback) => Number.isFinite(value) && value >= 0 ? value : fallback;
  delayMs = duration(delayMs, 180); minVisibleMs = duration(minVisibleMs, 360);
  fadeMs = duration(fadeMs, 180); maxPendingMs = Math.max(100, duration(maxPendingMs, 20000));
  const pending = new Map();
  let phase = initiallyVisible ? 'visible' : 'hidden', visibleAt = initiallyVisible ? now() : null;
  let scene = 'welcome', label = LOADING_LABELS.welcome, timer = null, sequence = 0, disposed = false;
  let lastEmission = '';
  const getState = () => ({
    phase, visible: phase === 'visible' || phase === 'leaving',
    pending: [...pending.keys()], scene, label, reducedMotion,
  });
  function emit() {
    const state = getState(), serialized = JSON.stringify(state);
    if (serialized !== lastEmission) { lastEmission = serialized; onChange(state); }
  }
  function cancelTransition() { if (timer !== null) cancel(timer); timer = null; }
  function hide() { cancelTransition(); phase = 'hidden'; visibleAt = null; emit(); }
  function finishVisibility() {
    cancelTransition();
    if (!pending.size && !disposed) {
      if (reducedMotion || !fadeMs) hide();
      else {
        phase = 'leaving'; emit();
        timer = later(() => { timer = null; if (!pending.size && !disposed) hide(); }, fadeMs);
      }
    }
  }
  function reconcile() {
    if (disposed) return;
    if (pending.size) {
      const active = [...pending.values()].sort((a, b) => b.priority - a.priority || b.order - a.order)[0];
      scene = active.scene; label = active.label;
      if (phase === 'visible' || phase === 'leaving') {
        cancelTransition(); phase = 'visible'; emit(); return;
      }
      if (phase !== 'pending') {
        cancelTransition(); phase = 'pending'; emit();
        timer = later(() => {
          timer = null;
          if (pending.size && !disposed) { phase = 'visible'; visibleAt = now(); emit(); }
        }, delayMs);
      } else emit();
      return;
    }
    if (phase === 'pending' || phase === 'hidden') { hide(); return; }
    if (phase === 'leaving') return;
    cancelTransition();
    const remaining = Math.max(0, minVisibleMs - (now() - visibleAt));
    if (remaining) timer = later(() => { timer = null; finishVisibility(); }, remaining);
    else finishVisibility();
    emit();
  }
  function complete(key, token, immediate = false) {
    const record = pending.get(key);
    if (disposed || !record || record.token !== token) return false;
    cancel(record.timeout); pending.delete(key);
    if (immediate && !pending.size) hide(); else reconcile();
    return true;
  }
  function begin(key, options = {}) {
    if (disposed) return () => false;
    if (typeof key !== 'string' || !key) throw new TypeError('A loading resource key is required');
    const previous = pending.get(key); if (previous) cancel(previous.timeout);
    const token = Symbol(key), kind = options.scene in LOADING_LABELS ? options.scene : 'welcome';
    const record = {
      token, scene: kind, label: options.label || LOADING_LABELS[kind],
      priority: Number.isFinite(options.priority) ? options.priority : 0, order: ++sequence, timeout: null,
    };
    record.timeout = later(() => {
      if (disposed || pending.get(key)?.token !== token) return;
      pending.delete(key); reconcile();
      onTimeout({ key, scene: record.scene, label: record.label });
    }, Math.max(100, duration(options.timeoutMs, maxPendingMs)));
    pending.set(key, record); reconcile();
    return ({ immediate = false } = {}) => complete(key, token, immediate);
  }
  function setPending(key, waiting, options = {}) {
    if (disposed) return;
    if (waiting) {
      // Repeated playback events do not reset the delay or timeout deadline.
      if (!pending.has(key)) begin(key, options);
    } else {
      const record = pending.get(key);
      if (record) complete(key, record.token, !!options.immediate);
    }
  }
  function clear({ immediate = true } = {}) {
    for (const record of pending.values()) cancel(record.timeout);
    pending.clear();
    if (immediate) hide(); else reconcile();
  }
  function track(promise, { key, ...options } = {}) {
    const finish = begin(key, options);
    return Promise.resolve(promise).finally(() => finish());
  }
  function setReducedMotion(value) {
    reducedMotion = !!value;
    if (reducedMotion && phase === 'leaving') hide(); else emit();
  }
  function dispose() { if (disposed) return; clear(); disposed = true; }
  emit();
  if (initiallyVisible) reconcile();
  return Object.freeze({ begin, setPending, clear, track, setReducedMotion, dispose, getState });
}

/** DOM adapter. Append to the phone, above content and below skip/volume.
 * `blockTargets: [app]` also prevents keyboard access beneath the opaque layer.
 * The phone is not marked aria-busy: doing so would silence its live status.
 */
export function createLoadingState({ host, adoptNode, variant = 'fullscreen', blockTargets = [], onChange = () => {}, ...options } = {}) {
  if (!host?.append || !host.ownerDocument) throw new TypeError('A loading host is required');
  const document = host.ownerDocument;
  let node = adoptNode || host.querySelector?.(':scope > .scene-loading');
  const adopted = !!node;
  if (!node) {
    const template = document.createElement('template'); template.innerHTML = LOADING_BOOT_MARKUP;
    node = template.content.firstElementChild;
    node.dataset.loadingState = 'hidden'; node.setAttribute('aria-hidden', 'true');
    host.append(node);
  }
  node.dataset.loadingVariant = variant === 'local' ? 'local' : 'fullscreen';
  const labelNode = node.querySelector('.scene-loading-label');
  if (!labelNode) throw new TypeError('The loading layer needs a scene-loading-label');
  const previousInert = new Map(), previousBusy = new Map();
  let announced = labelNode.textContent, disposed = false;
  function render(state) {
    node.dataset.loadingState = state.phase; node.dataset.loadingScene = state.scene;
    node.dataset.reducedMotion = String(state.reducedMotion);
    node.setAttribute('aria-hidden', state.visible ? 'false' : 'true');
    host.dataset.loadingState = state.phase;
    // Changing pending asset counts must not re-announce an unchanged sentence.
    if (state.visible && state.label !== announced) { announced = state.label; labelNode.textContent = state.label; }
    for (const target of blockTargets.filter(Boolean)) {
      if (state.visible) {
        if (!previousInert.has(target)) {
          previousInert.set(target, target.inert);
          previousBusy.set(target, target.getAttribute('aria-busy'));
        }
        target.inert = true; target.setAttribute('aria-busy', 'true');
      } else if (previousInert.has(target)) {
        target.inert = previousInert.get(target); previousInert.delete(target);
        const busy = previousBusy.get(target); previousBusy.delete(target);
        if (busy === null) target.removeAttribute('aria-busy'); else target.setAttribute('aria-busy', busy);
      }
    }
    onChange(state);
  }
  const controller = createLoadingController({
    ...options, initiallyVisible: adopted && node.dataset.loadingState === 'visible', onChange: render,
  });
  return Object.freeze({
    ...controller, element: node,
    get visible() { return controller.getState().visible; },
    dispose() {
      if (disposed) return; disposed = true; controller.dispose();
      node.remove(); delete host.dataset.loadingState;
    },
  });
}
