import { bindVoiceComposer } from './communication-mode.mjs?v=20261031-product-sync';

/** Dictation only edits the current participant's existing public draft.
 * The normal send button remains the sole message submission path. */
export function bindSharedVoiceComposer({getSession, getDraft, onDraft, ...options} = {}) {
  const session = getSession?.();
  const stillCurrent = () => {
    const current = getSession?.();
    return session?.ownerId && session?.relationshipId && current?.active === true &&
      ['chat', 'connected'].includes(current.route) &&
      current.ownerId === session.ownerId && current.relationshipId === session.relationshipId;
  };
  const binding = bindVoiceComposer({
    ...options,
    inputSelector: '#public-message',
    getDraft: () => stillCurrent() ? getDraft?.() || '' : '',
    onDraft: text => { if (stillCurrent()) onDraft?.(text); },
  });
  return {...binding, isCurrent: stillCurrent};
}
