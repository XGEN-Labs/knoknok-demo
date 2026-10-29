// Filter only the fixed chat viewport's SourceGraphic. Native scrolling moves
// its content through fixed weights; no message copies or scroll/rAF masks.
const SVG = 'http://www.w3.org/2000/svg';
const BLURS = [0, 3, 8, 16, 24];
const cleanNumber = value => Math.round(value * 100) / 100;
const cleanAlpha = value => Math.round(value * 1e6) / 1e6;
let nextFilterId = 0;

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

function edgeStops({viewportHeight, topBand, bottomBand}) {
  const upper = Math.min(Math.max(0, topBand), viewportHeight / 2);
  const lower = Math.min(Math.max(0, bottomBand), viewportHeight / 2);
  const samples = [0, .2, .4, .45, .5, .55, .6, .65, .7, .75, .8, .85, .9, .95, 1];
  return [
    ...(upper ? [...samples].reverse().map(p => [upper * (1 - p), p]) : [[0, 0]]),
    ...(lower ? samples.map(p => [viewportHeight - lower * (1 - p), p]) : [[viewportHeight, 0]])
  ];
}

// Retained for archived diagnostics; runtime masks are fixed SVG image inputs.
export function conversationEdgeMask({top, viewportHeight, topBand, bottomBand, level = 0}) {
  return `linear-gradient(to bottom,${edgeStops({viewportHeight, topBand, bottomBand}).map(([y, progress]) =>
    `rgba(0,0,0,${cleanAlpha(conversationEdgeWeights(progress)[level])}) ${cleanNumber(y - top)}px`).join(',')})`;
}

export function conversationEdgeMaskSVG({width, height, topBand, bottomBand, level}) {
  const stops = edgeStops({viewportHeight:height, topBand, bottomBand}).map(([y, progress]) =>
    `<stop offset="${y / height}" stop-color="white" stop-opacity="${cleanAlpha(conversationEdgeWeights(progress)[level])}"/>`).join('');
  return `<svg xmlns="${SVG}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="w" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient></defs><rect width="100%" height="100%" fill="url(#w)"/></svg>`;
}

export function createConversationEdgeBlur(phone, {environment = {}} = {}) {
  const doc = phone.ownerDocument, win = doc.defaultView;
  const computed = environment.getComputedStyle || (node => win.getComputedStyle(node));
  const request = environment.requestAnimationFrame || win.requestAnimationFrame.bind(win);
  const cancel = environment.cancelAnimationFrame || win.cancelAnimationFrame.bind(win);
  const Resize = environment.ResizeObserver || win.ResizeObserver;
  const decode = environment.decodeImage || (async url => {
    const image = new win.Image();
    if (typeof image.decode === 'function') { image.src = url; await image.decode(); }
    else await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
    return image;
  });
  let page = null, log = null, group = null, svg = null, defs = null, probes = [];
  let frame = 0, commitFrame = 0, generation = 0, disposed = false;
  let pending = null, active = null, lastError = null, geometryUpdates = 0;
  const schedule = () => { if (!disposed && group && !frame) frame = request(updateGeometry); };
  const resize = Resize ? new Resize(schedule) : null;
  const element = (name, attrs = {}) => {
    const node = doc.createElementNS(SVG, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
  };
  function cancelPending() {
    generation++;
    if (commitFrame) cancel(commitFrame); commitFrame = 0;
    pending?.filter.remove(); pending = null;
  }
  function detach() {
    cancelPending(); resize?.disconnect();
    if (frame) cancel(frame); frame = 0;
    if (group?.parentElement && log) {
      const {scrollTop, scrollLeft} = log;
      group.parentElement.insertBefore(log, group);
      log.scrollTop = scrollTop; log.scrollLeft = scrollLeft;
    }
    svg?.remove(); group?.remove();
    page = log = group = svg = defs = active = null; probes = []; lastError = null;
  }
  function attach(nextPage, nextLog) {
    page = nextPage; log = nextLog;
    group = doc.createElement('div'); group.className = 'kn-conversation-edge-group';
    const {scrollTop, scrollLeft} = log;
    log.parentElement.insertBefore(group, log); group.append(log);
    log.scrollTop = scrollTop; log.scrollLeft = scrollLeft;
    probes = ['top', 'bottom'].map(edge => {
      const probe = doc.createElement('i');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:0;height:var(--kn-chat-edge-${edge});`;
      group.append(probe); return probe;
    });
    // Definitions live outside the filtered input. They have no layout or
    // accessibility content and never add an absolute child to the scroll log.
    svg = element('svg', {width:0, height:0, 'aria-hidden':'true', focusable:'false'});
    svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none;overflow:hidden;';
    defs = element('defs'); svg.append(defs); phone.append(svg);
    resize?.observe(group); probes.forEach(probe => resize?.observe(probe));
  }
  function buildFilter(geometry) {
    const {width, height} = geometry, region = {x:0, y:0, width, height};
    const id = `kn-chat-edge-${++nextFilterId}`;
    const filter = element('filter', {...region, id, filterUnits:'userSpaceOnUse',
      primitiveUnits:'userSpaceOnUse', 'color-interpolation-filters':'sRGB'});
    const urls = []; let previous = '';
    BLURS.forEach((blur, level) => {
      const url = `data:image/svg+xml,${encodeURIComponent(conversationEdgeMaskSVG({...geometry, level}))}`;
      urls.push(url);
      filter.append(element('feImage', {...region, href:url, preserveAspectRatio:'none', result:`weight${level}`}));
      if (blur) filter.append(element('feGaussianBlur', {...region, in:'SourceGraphic', stdDeviation:blur, result:`blur${level}`}));
      filter.append(element('feComposite', {...region, in:blur ? `blur${level}` : 'SourceGraphic',
        in2:`weight${level}`, operator:'in', result:`part${level}`}));
      if (level) {
        const result = `sum${level}`;
        filter.append(element('feComposite', {...region, in:previous, in2:`part${level}`,
          operator:'arithmetic', k1:0, k2:1, k3:1, k4:0, result}));
        previous = result;
      } else previous = 'part0';
    });
    // location.href addresses this document even when a <base> changes baseURI.
    const url = new URL(win.location?.href || doc.URL || doc.baseURI);
    url.hash = id;
    return {filter, urls, reference:`url("${url.href}")`};
  }
  function updateGeometry() {
    frame = 0;
    if (disposed || !group) return;
    const geometry = {width:group.clientWidth, height:group.clientHeight,
      topBand:parseFloat(computed(probes[0]).height) || 0,
      bottomBand:parseFloat(computed(probes[1]).height) || 0};
    if (!geometry.width || !geometry.height) { cancelPending(); return; }
    const key = JSON.stringify(geometry);
    if (key === pending?.key) return;
    if (key === active?.key) { if (pending) cancelPending(); return; }
    cancelPending();
    const candidate = {...buildFilter(geometry), geometry, key, token:generation, images:null};
    pending = candidate; defs.append(candidate.filter); lastError = null;
    // Keep the previous filter (or clear content on first mount) until every
    // alpha image is decoded. A later resize/route must not apply stale work.
    Promise.all(candidate.urls.map(decode)).then(images => {
      if (disposed || pending !== candidate || candidate.token !== generation) return;
      candidate.images = images;
      commitFrame = request(() => {
        commitFrame = 0;
        if (disposed || pending !== candidate || candidate.token !== generation) return;
        const previous = active;
        group.style.setProperty('filter', candidate.reference);
        active = candidate; pending = null; geometryUpdates++;
        previous?.filter.remove();
      });
    }).catch(error => {
      if (pending !== candidate || candidate.token !== generation) return;
      candidate.filter.remove(); pending = null;
      lastError = error?.message || 'Could not decode message edge masks';
    });
  }
  function refresh(nextPage, options = {}) {
    if (disposed) return;
    const supported = doc.createElementNS && (environment.decodeImage || win.Image)
      && (!win.CSS?.supports || win.CSS.supports('filter', 'url("#kn-chat-edge")'));
    const nextLog = supported && options.active && nextPage?.querySelector('.conversation-log,.shared-messages');
    if (!nextLog) { detach(); return; }
    if (nextLog !== log) { detach(); attach(nextPage, nextLog); }
    schedule();
  }
  win.addEventListener('resize', schedule); win.visualViewport?.addEventListener('resize', schedule);
  doc.addEventListener('visibilitychange', schedule); doc.fonts?.addEventListener('loadingdone', schedule);
  return {refresh, getDiagnostics:() => ({active:Boolean(log), mode:'svg-viewport', copiedMessages:0,
    filterReady:Boolean(active), preparing:Boolean(pending), geometryUpdates,
    geometry:active?.geometry || null, error:lastError}), dispose() {
    if (disposed) return;
    disposed = true; detach();
    win.removeEventListener('resize', schedule); win.visualViewport?.removeEventListener('resize', schedule);
    doc.removeEventListener('visibilitychange', schedule); doc.fonts?.removeEventListener('loadingdone', schedule);
  }};
}
