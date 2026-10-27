/* Fade the painted surfaces, never the scroll container: masking an ancestor
   would prevent each glass bubble from sampling the room behind it. */
export function conversationEdgeMask(surface, viewport, fade = 24, scale = 1) {
  const height = (surface.bottom - surface.top) / scale;
  if (!(height > 0) || !(viewport.bottom > viewport.top)) return 'none';
  const topFade = surface.top < viewport.top + fade * scale;
  const bottomFade = surface.bottom > viewport.bottom - fade * scale;
  if (!topFade && !bottomFade) return 'none';
  // Keep stops outside the surface bounds. Clamping them would make a bubble
  // suddenly transparent as it first enters the soft edge instead of fading.
  const round = value => Math.round(value * 100) / 100;
  const start = round((viewport.top - surface.top) / scale);
  const topEnd = round((viewport.top - surface.top) / scale + fade);
  const bottomStart = round((viewport.bottom - surface.top) / scale - fade);
  const end = round((viewport.bottom - surface.top) / scale);
  const stops = [];
  if (topFade) stops.push(`transparent ${start}px`, `#000 ${topEnd}px`);
  if (bottomFade) stops.push(`#000 ${bottomStart}px`, `transparent ${end}px`);
  return `linear-gradient(to bottom, ${stops.join(', ')})`;
}

export function mountConversationScroll(log) {
  if (!log) return null;
  const view = log.ownerDocument.defaultView;
  // The footer itself is transparent. Fade its individual glass buttons so it
  // does not become another backdrop root around them.
  const surfaces = [...log.querySelectorAll(':scope > .conversation-message, :scope > .tag-chat-card, :scope > .tag-chat-tools > button')];
  let frame = 0, disposed = false;
  const update = () => {
    frame = 0;
    if (disposed || !log.clientHeight) return;
    const viewport = log.getBoundingClientRect();
    const scale = viewport.height / log.offsetHeight || 1;
    for (const surface of surfaces) {
      const mask = conversationEdgeMask(surface.getBoundingClientRect(), viewport, 24, scale);
      surface.setAttribute('data-conversation-scroll-surface', '');
      surface.style.setProperty('--kn-conversation-edge-mask', mask);
    }
  };
  const schedule = () => { if (!disposed && !frame) frame = view.requestAnimationFrame(update); };
  const observer = new view.ResizeObserver(schedule);
  observer.observe(log);
  for (const surface of surfaces) observer.observe(surface);
  log.addEventListener('scroll', schedule, {passive: true});
  update();
  return {
    update,
    dispose() {
      disposed = true;
      view.cancelAnimationFrame(frame);
      observer.disconnect();
      log.removeEventListener('scroll', schedule);
      for (const surface of surfaces) {
        surface.removeAttribute('data-conversation-scroll-surface');
        surface.style.removeProperty('--kn-conversation-edge-mask');
      }
    }
  };
}
