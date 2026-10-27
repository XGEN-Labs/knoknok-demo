// Keep message identity across app.innerHTML renders. Only painted bubbles
// animate: the log remains an ordinary scroll viewport for backdrop sampling.
export function createConversationEntryMotion(phone, {duration = 260, stagger = 40} = {}) {
  const doc = phone.ownerDocument, win = doc.defaultView;
  const seen = new Set(), running = new Map();
  let log = null, options = {}, scope = null, active = false, disposed = false, resizeFrame = 0;
  const now = () => win.performance.now();
  const stop = record => { record.animation?.cancel(); };
  const clear = () => { for (const record of running.values()) stop(record); running.clear(); };
  const reduced = () => options.reducedMotion || win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function paint(node, id, started, delay) {
    const elapsed = Math.max(0, now() - started);
    if (elapsed >= duration + delay || typeof node.animate !== 'function') return;
    const animation = node.animate([
      // Remain paintable while almost transparent so the scene sampler keeps
      // this live surface attached throughout its entrance.
      {opacity:0.001, transform:'translateY(8px)'},
      {opacity:1, transform:'translateY(0px)'}
    ], {duration, delay, easing:'cubic-bezier(.22,.68,.2,1)', fill:'both'});
    animation.currentTime = elapsed;
    const record = {node, animation, started, delay};
    running.set(id, record);
    animation.finished.then(() => {
      if (running.get(id) !== record) return;
      running.delete(id); stop(record);
    }, () => {});
  }

  function refresh(nextLog, nextOptions = options) {
    if (disposed) return;
    options = nextOptions;
    if (nextLog !== log) { resize?.disconnect(); log = nextLog; if (log) resize?.observe(log); }
    const nextScope = String(options.scopeKey ?? 'default');
    if (nextScope !== scope) { clear(); seen.clear(); active = false; scope = nextScope; }
    if (!options.active || !log) { clear(); active = false; return; }
    // A first refresh can precede the room-to-chat layout. Observe the log and
    // defer that entry until it has its actual viewport, rather than losing it.
    if (log.hidden || !log.clientHeight) return;
    // Once measured, explicit render/entry hooks own subsequent refreshes. A
    // persistent observer would react to animated overflow at the scroll edge.
    resize?.disconnect();
    const entering = !active;
    active = true;
    const nodes = [...log.querySelectorAll('.conversation-message[data-conversation-id]')]
      .filter(node => !node.hidden && node.dataset.conversationId);
    const current = new Map(nodes.map(node => [node.dataset.conversationId, node]));
    for (const [id, record] of running) {
      if (current.get(id) !== record.node) {
        stop(record); running.delete(id);
        if (current.has(id) && !reduced() && !doc.hidden) paint(current.get(id), id, record.started, record.delay);
      }
    }
    const viewport = log.getBoundingClientRect();
    const visible = node => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > viewport.top && rect.top < viewport.bottom;
    };
    const arrivals = nodes.filter(node => (entering || !seen.has(node.dataset.conversationId)) && visible(node));
    // Long histories open at the latest messages; never queue a long parade.
    const targets = entering ? arrivals.slice(-4) : arrivals;
    for (const node of nodes) seen.add(node.dataset.conversationId);
    if (reduced() || doc.hidden) { clear(); return; }
    const started = now();
    targets.forEach((node, index) => {
      const id = node.dataset.conversationId;
      if (!running.has(id)) paint(node, id, started, Math.min(index, 3) * stagger);
    });
  }

  // Do not install transform effects while ResizeObserver is delivering layout
  // notifications: a bubble at the scroll boundary can change overflow bounds.
  const resize = win.ResizeObserver ? new win.ResizeObserver(() => {
    if (!resizeFrame) resizeFrame = win.requestAnimationFrame(() => { resizeFrame = 0; refresh(log); });
  }) : null;
  const visibility = () => { if (doc.hidden) clear(); };
  doc.addEventListener('visibilitychange', visibility);
  return {
    refresh,
    cancel:clear,
    dispose() {
      disposed = true; clear(); seen.clear(); resize?.disconnect();
      if (resizeFrame) win.cancelAnimationFrame(resizeFrame);
      doc.removeEventListener('visibilitychange', visibility); log = null;
    }
  };
}
