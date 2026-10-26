/** Wait for the real world resources. Fast cached loads never flash a spinner;
 * failures become a usable fallback instead of holding the page indefinitely. */
export function createFriendWorldLoadGate(keys, {
  delayMs = 120, timeoutMs = 12000, scheduler = {}, onChange = () => {}, onTimeout = () => {},
} = {}) {
  const later = scheduler.setTimeout || globalThis.setTimeout.bind(globalThis);
  const cancel = scheduler.clearTimeout || globalThis.clearTimeout.bind(globalThis);
  const pending = new Set(keys), errors = new Set();
  let status = pending.size ? 'loading' : 'ready', visible = false, disposed = false;
  let showTimer, timeout, resolve;
  const ready = new Promise(done => { resolve = done; });
  const state = () => ({status, visible, pending: [...pending], errors: [...errors]});
  const emit = () => onChange(state());
  function finish() {
    cancel(showTimer); cancel(timeout); visible = false;
    status = errors.size ? 'fallback' : 'ready'; emit(); resolve(state());
  }
  if (pending.size) {
    showTimer = later(() => { if (!disposed && pending.size) { visible = true; emit(); } }, delayMs);
    timeout = later(() => {
      if (disposed || !pending.size) return;
      const failed = [...pending]; failed.forEach(key => errors.add(key)); pending.clear();
      onTimeout(failed); finish();
    }, timeoutMs);
    emit();
  } else finish();
  return {
    ready, getState: state,
    complete(key, ok = true) {
      if (disposed || !pending.delete(key)) return false;
      if (!ok) errors.add(key);
      if (pending.size) emit(); else finish();
      return true;
    },
    fail(key) {
      if (disposed) return false;
      errors.add(key);
      if (status !== 'loading') status = 'fallback';
      emit(); return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true; cancel(showTimer); cancel(timeout); pending.clear();
      status = 'disposed'; visible = false; emit(); resolve(state());
    },
  };
}
