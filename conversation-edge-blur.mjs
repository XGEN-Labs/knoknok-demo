// Only message pixels enter this effect. The visual copies live in a shadow
// tree so glass samplers, message queries and delegated actions never see them.
const MASKS = ['mask-image', '-webkit-mask-image'];
const BLURS = [0, 3, 8, 16, 24], BLEED = BLURS.at(-1) * 3;
const cleanNumber = value => Math.round(value * 100) / 100;
const cleanAlpha = value => Math.round(value * 1e6) / 1e6;

export function conversationEdgeWeights(progress) {
  const p = Math.max(0, Math.min(1, progress));
  const fade = Math.max(0, (p - .5) * 2);
  const envelope = 1 - fade * fade * (3 - 2 * fade);
  const stage = Math.min(BLURS.length - 1, p * 5), low = Math.floor(stage);
  const weights = BLURS.map(() => 0);
  weights[low] = (1 - (stage - low)) * envelope;
  if (low + 1 < weights.length) weights[low + 1] = (stage - low) * envelope;
  return weights;
}

export function conversationEdgeMask({top, viewportHeight, topBand, bottomBand, level = 0}) {
  const upper = Math.min(Math.max(0, topBand), viewportHeight / 2);
  const lower = Math.min(Math.max(0, bottomBand), viewportHeight / 2);
  const samples = [0, .2, .4, .45, .5, .55, .6, .65, .7, .75, .8, .85, .9, .95, 1];
  const stops = [
    ...(upper ? [...samples].reverse().map(p => [upper * (1 - p), p]) : [[0, 0]]),
    ...(lower ? samples.map(p => [viewportHeight - lower * (1 - p), p]) : [[viewportHeight, 0]])
  ];
  return `linear-gradient(to bottom,${stops.map(([y, progress]) =>
    `rgba(0,0,0,${cleanAlpha(conversationEdgeWeights(progress)[level])}) ${cleanNumber(y - top)}px`).join(',')})`;
}

export function createConversationEdgeBlur(phone, {environment = {}} = {}) {
  const doc = phone.ownerDocument, win = doc.defaultView;
  const computed = environment.getComputedStyle || (node => win.getComputedStyle(node));
  const request = environment.requestAnimationFrame || win.requestAnimationFrame.bind(win);
  const cancel = environment.cancelAnimationFrame || win.cancelAnimationFrame.bind(win);
  const Resize = environment.ResizeObserver || win.ResizeObserver;
  const Mutation = environment.MutationObserver || win.MutationObserver;
  const records = new Map();
  let page = null, log = null, group = null, host = null, shadow = null, probes = [], frame = 0;
  let disposed = false, reducedMotion = false, dirty = true;
  const set = (style, name, value, priority = '') => {
    if (style.getPropertyValue(name) !== value || style.getPropertyPriority(name) !== priority)
      style.setProperty(name, value, priority);
  };
  const schedule = () => { if (!disposed && log && !frame) frame = request(paint); };
  const invalidate = () => { dirty = true; schedule(); };
  const resize = Resize ? new Resize(invalidate) : null;
  const mutation = Mutation ? new Mutation(invalidate) : null;
  const observe = () => mutation?.observe(log, {subtree:true, childList:true, characterData:true,
    attributes:true, attributeFilter:['class', 'style', 'hidden', 'data-scene-glass']});

  function restore(node, record) {
    MASKS.forEach((name, index) => {
      const [value, priority] = record.masks[index];
      if (value) node.style.setProperty(name, value, priority); else node.style.removeProperty(name);
    });
    record.wrapper.remove(); records.delete(node);
  }
  function detach() {
    mutation?.disconnect(); resize?.disconnect();
    log?.removeEventListener('scroll', schedule);
    if (frame) cancel(frame); frame = 0;
    for (const [node, record] of records) restore(node, record);
    if (group?.parentElement && log) {
      const {scrollTop, scrollLeft} = log;
      group.parentElement.insertBefore(log, group);
      log.scrollTop = scrollTop; log.scrollLeft = scrollLeft;
    }
    host?.remove(); group?.remove(); group = host = shadow = log = page = null; probes = [];
  }
  function attach(nextPage, nextLog) {
    page = nextPage; log = nextLog;
    // Isolate only the scroll content and its copies. Adjacent blur levels
    // sum to one until the outer fade; the room stays outside this group.
    group = doc.createElement('div'); group.className = 'kn-conversation-edge-group';
    const {scrollTop, scrollLeft} = log;
    log.parentElement.insertBefore(group, log); group.append(log);
    log.scrollTop = scrollTop; log.scrollLeft = scrollLeft;
    host = doc.createElement('div'); host.className = 'kn-conversation-edge-layer';
    host.setAttribute('aria-hidden', 'true'); host.inert = true;
    // Shadow isolation also keeps style writes here outside the scene glass
    // MutationObserver. This layer never samples the room behind a message.
    shadow = host.attachShadow({mode:'open'});
    probes = ['top', 'bottom'].map(edge => {
      const probe = doc.createElement('i');
      probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:0;height:var(--kn-chat-edge-${edge});`;
      shadow.append(probe); return probe;
    });
    // Share the browser's native scroll translation with the real messages.
    // A viewport sibling driven by scroll/rAF can lag compositor scrolling.
    log.append(host); log.addEventListener('scroll', schedule, {passive:true});
    resize?.observe(log); resize?.observe(page); observe(); dirty = true;
  }
  function snapshot(source) {
    const copy = source.cloneNode(true);
    const originals = [source, ...source.querySelectorAll('*')];
    const copies = [copy, ...copy.querySelectorAll('*')];
    originals.forEach((node, index) => {
      const visual = copies[index], style = computed(node);
      // No duplicate identity, action, live region or form participation.
      for (const attribute of [...visual.attributes]) {
        if (/^(?:id|class|name|role|tabindex|autofocus|contenteditable|data-.+|aria-.+|on.+)$/.test(attribute.name))
          visual.removeAttribute(attribute.name);
      }
      visual.style.cssText = '';
      for (const property of style) {
        if (!property.startsWith('--')) visual.style.setProperty(property, style.getPropertyValue(property));
      }
      for (const property of [...MASKS, 'filter', 'backdrop-filter', '-webkit-backdrop-filter', 'animation', 'transition'])
        visual.style.setProperty(property, 'none');
      visual.style.setProperty('pointer-events', 'none');
      if ('disabled' in visual) visual.disabled = true;
    });
    for (const [name, value] of Object.entries({position:'absolute',
      right:'auto', bottom:'auto', margin:'0', transform:'none', opacity:'1',
      'box-sizing':'border-box', 'min-width':'0', 'max-width':'none', 'min-height':'0', 'max-height':'none'})) copy.style.setProperty(name, value);
    return copy;
  }
  function paint() {
    frame = 0;
    if (!log || disposed) return;
    // Disconnect only our own observer while writing the masks. The sampler
    // may still update original surface textures, which invalidate the copy.
    mutation?.disconnect();
    try {
      if (doc.hidden || log.hidden || !log.clientHeight || !log.clientWidth) {
        for (const [node, record] of records) restore(node, record);
        host.hidden = true; return;
      }
      host.hidden = false;
      const viewport = log.getBoundingClientRect();
      const sx = viewport.width / log.clientWidth, sy = viewport.height / log.clientHeight;
      if (!sx || !sy) return;
      const height = log.clientHeight;
      // Read the existing extent before painting. It only limits the copies;
      // never feed it into the zero-height paint host or extend the scroll range.
      const contentHeight = Math.max(height, log.scrollHeight);
      const topBand = parseFloat(computed(probes[0]).height) || 0;
      const bottomBand = parseFloat(computed(probes[1]).height) || 0;
      const nodes = [...log.querySelectorAll('.conversation-message,.message .bubble')];
      const active = new Set(); let animating = false;
      for (const node of nodes) {
        if (node.hidden || node.closest('[hidden]')) continue;
        const rect = node.getBoundingClientRect(), top = (rect.top - viewport.top) / sy;
        const width = rect.width / sx, nodeHeight = rect.height / sy;
        let opacity = 1;
        for (let ancestor = node; ancestor && ancestor !== log; ancestor = ancestor.parentElement) {
          opacity *= Number(computed(ancestor).opacity);
          if (!reducedMotion && ancestor.getAnimations?.().some(animation => animation.playState === 'running')) animating = true;
        }
        if (!width || !nodeHeight || top + nodeHeight + BLEED <= 0 || top - BLEED >= height ||
          (top >= topBand && top + nodeHeight <= height - bottomBand)) continue;
        active.add(node);
        let record = records.get(node);
        if (!record) {
          const wrapper = doc.createElement('div');
          wrapper.style.cssText = 'position:absolute;pointer-events:none;overflow:hidden;isolation:isolate;';
          const layers = BLURS.slice(1).map(blur => {
            const surface = doc.createElement('div');
            surface.style.cssText = 'position:absolute;inset:0;pointer-events:none;mix-blend-mode:plus-lighter;';
            wrapper.append(surface); return {surface, blur, copy:null};
          });
          record = {wrapper, layers, masks:MASKS.map(name => [node.style.getPropertyValue(name), node.style.getPropertyPriority(name)])};
          records.set(node, record); shadow.append(wrapper);
        }
        if (!record.layers[0].copy || dirty) {
          const template = snapshot(node);
          for (const layer of record.layers) {
            layer.copy = template.cloneNode(true);
            layer.copy.style.setProperty('filter', `blur(${layer.blur}px)`);
            layer.surface.replaceChildren(layer.copy);
          }
        }
        const contentLeft = (rect.left - viewport.left) / sx + log.scrollLeft;
        const contentTop = top + log.scrollTop;
        const left = Math.max(log.scrollLeft, contentLeft - BLEED);
        const right = Math.min(log.scrollLeft + log.clientWidth, contentLeft + width + BLEED);
        const start = Math.max(0, contentTop - BLEED);
        const end = Math.min(contentHeight, contentTop + nodeHeight + BLEED);
        const geometry = {top, viewportHeight:height, topBand, bottomBand};
        for (const name of MASKS) {
          set(node.style, name, conversationEdgeMask(geometry), 'important');
          record.layers.forEach((layer, index) => set(layer.surface.style, name,
            conversationEdgeMask({...geometry, top:start - log.scrollTop, level:index + 1})));
        }
        // Positions belong to scroll content; only the masks use viewport
        // coordinates. Between JS frames both surfaces move together natively.
        set(record.wrapper.style, 'left', `${cleanNumber(left)}px`);
        set(record.wrapper.style, 'top', `${cleanNumber(start)}px`);
        set(record.wrapper.style, 'width', `${cleanNumber(Math.max(0, right - left))}px`);
        set(record.wrapper.style, 'height', `${cleanNumber(Math.max(0, end - start))}px`);
        set(record.wrapper.style, 'opacity', String(opacity));
        for (const layer of record.layers) {
          set(layer.copy.style, 'left', `${cleanNumber(contentLeft - left)}px`);
          set(layer.copy.style, 'top', `${cleanNumber(contentTop - start)}px`);
          set(layer.copy.style, 'width', `${cleanNumber(width)}px`);
          set(layer.copy.style, 'height', `${cleanNumber(nodeHeight)}px`);
        }
      }
      for (const [node, record] of records) if (!active.has(node)) restore(node, record);
      dirty = false;
      if (animating && !reducedMotion) schedule();
    } finally { if (log) observe(); }
  }
  function refresh(nextPage, options = {}) {
    if (disposed) return;
    reducedMotion = Boolean(options.reducedMotion);
    const supported = !win.CSS?.supports || win.CSS.supports('mix-blend-mode', 'plus-lighter');
    const nextLog = supported && options.active && nextPage?.querySelector('.conversation-log,.shared-messages');
    if (!nextLog) { detach(); return; }
    if (nextLog !== log) { detach(); attach(nextPage, nextLog); }
    invalidate();
  }
  win.addEventListener('resize', invalidate); win.visualViewport?.addEventListener('resize', invalidate);
  doc.addEventListener('visibilitychange', invalidate); doc.fonts?.addEventListener('loadingdone', invalidate);
  return {refresh, getDiagnostics:() => ({active:Boolean(log), copiedMessages:records.size}), dispose() {
    if (disposed) return; disposed = true; detach();
    win.removeEventListener('resize', invalidate); win.visualViewport?.removeEventListener('resize', invalidate);
    doc.removeEventListener('visibilitychange', invalidate); doc.fonts?.removeEventListener('loadingdone', invalidate);
  }};
}
