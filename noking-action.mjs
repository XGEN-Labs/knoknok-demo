// The v05 TapNow bodies and juvenile-style light are already baked into alpha.
// No CSS pose, eye changes, glow filters or cropping are applied here.
export const NOKING_DURATION_MS = 4042;
export const NOKING_ACTORS = Object.freeze({metal:'klin',wood:'spri',water:'lumi',fire:'flar',earth:'terr'});
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** A presentation lifecycle only. The adapter must explicitly identify Noking;
 * ordinary request activity or reply text must never imply skill execution. */
export function createNokingRun(requestId) {
  let active = null, disposed = false;
  return {
    receive(event) {
      if (disposed || event?.requestId !== requestId || event.skill !== 'noking' || !event.executionId) return false;
      if (event.status === 'running') {
        if (active && active.executionId !== event.executionId) return false;
        active = {requestId, executionId:event.executionId};
        return true;
      }
      if (['completed','failed','cancelled'].includes(event.status) && active?.executionId === event.executionId) {
        active = null;
        return true;
      }
      return false;
    },
    get active() { return active; },
    dispose() { disposed = true; active = null; }
  };
}

export function nokingActionMarkup(profile = {}, run, {reducedMotion = false} = {}) {
  if (!run) return '';
  const role = NOKING_ACTORS[profile.element] || 'klin';
  const base = `assets/noking-v05/${role}`;
  const key = `${run.requestId}/${run.executionId}/${role}/${reducedMotion?'still':'motion'}`;
  const source = reducedMotion ? `${base}/poster.png` : `${base}/noking-alpha.webp?run=${encodeURIComponent(key)}`;
  return `<div class="topic-noking noking-action" data-noking-key="${esc(key)}" data-noking-role="${role}" role="status" aria-label="${esc(profile.name || role)} 正在感应"><picture><source media="(prefers-reduced-motion: reduce)" srcset="${base}/poster.png"><img src="${source}" width="132" height="132" alt="" aria-hidden="true" draggable="false" decoding="sync"></picture></div>`;
}

// Preserve the same animated image through an unrelated conversation rerender.
export function restoreNokingNode(root, previous) {
  const next = root.querySelector('.noking-action');
  if (previous && next && previous.dataset.nokingKey === next.dataset.nokingKey) next.replaceWith(previous);
}
