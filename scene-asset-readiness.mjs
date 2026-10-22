/** Wait only for the current route's critical images. A failed image is settled:
 * the route may use its CSS fallback, and the same failure is not retried forever.
 * Successful decoded images and in-flight requests are shared within this instance.
 */
export function createSceneAssetReadiness({
  loading, imageFactory = () => new Image(), onChange = () => {}, timeoutMs = 12000, scheduler = {},
} = {}) {
  if (!loading?.setPending) throw new TypeError('A loading-state coordinator is required');
  const later = scheduler.setTimeout || globalThis.setTimeout.bind(globalThis);
  const cancel = scheduler.clearTimeout || globalThis.clearTimeout.bind(globalThis);
  const deadline = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 12000;
  const cache = new Map();
  let generation = 0, disposed = false, signature = '', route = { key: '', urls: [], scene: 'welcome' };
  let loaderPending = false, lastEmission = '';
  const pathOnly = url => {
    try {
      if (/^[a-z][a-z\d+.-]*:/i.test(url)) return new URL(url).pathname;
    } catch { return '(invalid image path)'; }
    return url.split(/[?#]/, 1)[0];
  };
  const currentRecords = () => route.urls.map(url => cache.get(url)).filter(Boolean);
  function getDiagnostics() {
    const records = currentRecords();
    return {
      key: route.key, scene: route.scene,
      ready: records.every(record => record.state !== 'pending'),
      pending: records.filter(record => record.state === 'pending').map(record => pathOnly(record.url)),
      errors: records.filter(record => record.state === 'error').map(record => ({ path: pathOnly(record.url), reason: record.reason })),
      total: records.length,
    };
  }
  function publish() {
    if (disposed) return;
    const diagnostics = getDiagnostics(), next = JSON.stringify(diagnostics);
    if (next !== lastEmission) { lastEmission = next; onChange(diagnostics); }
  }
  function syncLoader() {
    if (disposed) return;
    const pending = !getDiagnostics().ready;
    if (pending !== loaderPending) {
      loaderPending = pending;
      loading.setPending('scene-images', pending, { scene: route.scene, timeoutMs: Math.max(14000, deadline + 2000) });
    }
    publish();
  }
  function load(url) {
    if (cache.has(url)) return cache.get(url);
    let resolve;
    const record = { url, state: 'pending', reason: '', image: null, timer: null, promise: new Promise(done => { resolve = done; }) };
    cache.set(url, record);
    const cleanup = () => {
      if (record.timer !== null) cancel(record.timer);
      record.timer = null;
      if (record.image) record.image.onload = record.image.onerror = null;
    };
    record.settle = reason => {
      if (record.state !== 'pending') return;
      cleanup(); record.reason = reason; record.state = reason ? 'error' : 'ready'; resolve(record);
    };
    try {
      const image = imageFactory(); record.image = image;
      let decoding = false;
      image.onload = () => {
        if (decoding || record.state !== 'pending') return;
        decoding = true;
        // onload alone does not prove the image is ready for the first paint.
        try {
          const decoded = typeof image.decode === 'function' ? image.decode() : undefined;
          Promise.resolve(decoded).then(() => record.settle(''), () => record.settle('decode-error'));
        } catch { record.settle('decode-error'); }
      };
      image.onerror = () => record.settle('image-error');
      record.timer = later(() => record.settle('image-timeout'), deadline);
      image.decoding = 'async'; image.src = url;
      if (image.complete && image.naturalWidth > 0) image.onload?.();
    } catch { record.settle('image-unavailable'); }
    return record;
  }
  function update({ key = '', urls = [], scene = 'welcome' } = {}) {
    if (disposed) return getDiagnostics();
    const unique = [...new Set(urls.filter(url => typeof url === 'string' || url instanceof URL).map(String).filter(Boolean))];
    const nextSignature = JSON.stringify([key, scene, [...unique].sort()]);
    if (nextSignature === signature) return getDiagnostics();
    signature = nextSignature; const token = ++generation;
    // Close the old coordinator key before registering the new one. Its minimum
    // visible interval keeps the scene stable while the new request takes over.
    if (loaderPending) { loading.setPending('scene-images', false); loaderPending = false; }
    route = { key, urls: unique, scene };
    const records = unique.map(load);
    syncLoader();
    for (const record of records) {
      if (record.state === 'pending') record.promise.then(() => {
        if (!disposed && token === generation) syncLoader();
      });
    }
    return getDiagnostics();
  }
  function dispose() {
    if (disposed) return;
    disposed = true; generation++;
    if (loaderPending) loading.setPending('scene-images', false, { immediate: true });
    loaderPending = false;
    for (const record of cache.values()) if (record.state === 'pending') record.settle('disposed');
    cache.clear();
  }
  return Object.freeze({ update, getDiagnostics, dispose, get ready() { return getDiagnostics().ready; } });
}
