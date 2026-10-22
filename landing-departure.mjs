/** One tail playback owns one arrival. A route change invalidates even a
 * completion already queued by the video, so it cannot navigate back later. */
export function createLandingDeparture({ enqueue = queueMicrotask } = {}) {
  let phase = 'idle', epoch = 0, callback = null, disposed = false;
  return {
    begin(onComplete) {
      if (disposed || phase !== 'idle') return false;
      epoch += 1; phase = 'departing'; callback = onComplete;
      return true;
    },
    observe({ key, state, active } = {}) {
      if (disposed || phase !== 'departing' || !active || key !== 'arrival'
        || !['waiting', 'fallback'].includes(state)) return false;
      phase = 'arriving'; const token = epoch;
      enqueue(() => {
        if (disposed || token !== epoch || phase !== 'arriving') return;
        phase = 'arrived'; const complete = callback; callback = null;
        complete?.();
      });
      return true;
    },
    cancel() { epoch += 1; phase = 'idle'; callback = null; },
    dispose() { this.cancel(); disposed = true; },
    get phase() { return phase; },
    get pending() { return phase === 'departing' || phase === 'arriving'; },
  };
}
