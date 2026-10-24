import { createCardHandoff } from './card-handoff.mjs';
const ease = 'cubic-bezier(.22,.76,.18,1)';
const roomOrder = ['home', 'relations', 'memory', 'profile', 'companion'];

export function prefersStillness(manual) {
  return manual || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function captureCompanion(page) {
  return { page: page?.dataset.screen || 'welcome' };
}

// The foreground clears before the spirit glides or presents its card. It returns
// only at arrival, so the spirit never crosses behind an input, card or panel.
export function transitionScene({ host, app, previous, current, source, world, stage, layout, scrollPositions = [], direction = 'forward', onFinish }) {
  const animations = [];
  const from = source?.page || previous.dataset.screen;
  const to = current.dataset.screen;
  const fromRoom = roomOrder.indexOf(from), toRoom = roomOrder.indexOf(to);
  const sign = fromRoom >= 0 && toRoom >= 0 && fromRoom !== toRoom
    ? Math.sign(toRoom - fromRoom)
    : direction === 'back' || direction === 'backward' ? -1 : 1;
  const travel = Number(host.clientWidth) || Number(current.clientWidth) || 402;
  const duration = world ? 1300 : 650;
  const cardHandoff = world && from === 'home' && ['profile','public-card'].includes(to)
    ? createCardHandoff(host, current) : null;
  let finished = false;
  let cancelWorld;
  let watchdog;
  previous.classList.add('scene-leaving', 'reenter');
  previous.setAttribute('aria-hidden', 'true');
  previous.inert = true;
  previous.removeAttribute('data-screen');
  for (const node of previous.querySelectorAll('[id], [form]')) {
    node.removeAttribute('id'); node.removeAttribute('form');
  }
  current.classList.add('scene-arriving', 'reenter');
  current.inert = true;
  for (const page of [previous, current]) {
    for (const node of page.querySelectorAll('.message,.success-badge')) node.classList.add('scene-static-entry');
  }
  app.classList.add('scene-transitioning');
  host.dataset.travelFrom = from;
  host.dataset.travelTo = to;
  if (world) host.dataset.sceneTravel = 'true';
  if (cardHandoff) host.dataset.cardHandoff = 'presenting';
  app.append(previous);
  for (const { node, top, left } of scrollPositions) { node.scrollTop = top; node.scrollLeft = left; }

  // Keep the newly rendered dock, including its selected filled/outline icons
  // and accessible state. Transplanting the old dock would retain stale assets.
  previous.querySelector('.bottom-nav')?.remove();
  const targets = page => [...page.children].filter(n => !n.matches('.bottom-nav'));
  if (!world) for (const node of targets(previous)) animations.push(node.animate([
    { transform: 'translate3d(0,0,0)' },
    { transform: `translate3d(${-sign * travel}px,0,0)` }
  ], { duration, easing: ease, fill: 'both' }));
  if (!world) for (const node of targets(current)) animations.push(node.animate([
    { transform: `translate3d(${sign * travel}px,0,0)` },
    { transform: 'translate3d(0,0,0)' }
  ], { duration, easing: ease, fill: 'both' }));

  const complete = () => finish(true);
  const panelsDone = Promise.allSettled(animations.map(a => a.finished));
  // Native frame playback pauses in a hidden tab. Its UI watchdog must pause
  // too, or the paper would arrive while the actor is still mid-gesture.
  const doc = host.ownerDocument;
  const watch = () => {
    clearTimeout(watchdog);
    if (!finished && !doc?.hidden) watchdog = setTimeout(() => {
      finish(true);
      cancelWorld?.();
    }, cardHandoff ? 6500 : 2300);
  };
  doc?.addEventListener('visibilitychange', watch);
  watch();
  if (world) {
    try { cancelWorld = world.transition(from, to, { direction, stage, layout, preserveScene: !!cardHandoff, onCardFrame: frame => {
      if (!cardHandoff || finished) return;
      host.dataset.cardHandoff = frame.progress < .4 ? 'presenting' : 'expanding';
      cardHandoff.frame(frame);
    }, onComplete: complete }); }
    catch { panelsDone.then(complete); }
  } else panelsDone.then(complete);
  function finish(focus) {
    if (finished) return;
    finished = true;
    clearTimeout(watchdog);
    doc?.removeEventListener('visibilitychange', watch);
    for (const animation of animations) animation.cancel();
    cardHandoff?.finish();
    previous.remove();
    current.inert = false;
    current.classList.remove('scene-arriving');
    app.classList.remove('scene-transitioning');
    delete host.dataset.sceneTravel;
    delete host.dataset.cardHandoff;
    // The paper has already arrived. Reveal only its surrounding controls;
    // moving the whole page here would visibly move the just-settled card.
    if (focus && cardHandoff) for (const node of current.querySelectorAll('.page-top,.profile-card-tools,.profile-footer')) {
      node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: ease });
    }
    if (focus && world && !cardHandoff) current.classList.add('scene-ui-arrived');
    delete host.dataset.travelFrom; delete host.dataset.travelTo;
    if (focus && current.isConnected) current.querySelector('h2')?.focus({ preventScroll: true });
    onFinish?.();
  }
  return ({ preserveWorld = false } = {}) => {
    if (finished) return;
    // Clean the old UI before stopping the rig: a cancellation implementation
    // may synchronously call onComplete, which must not focus an obsolete page.
    finish(false);
    if (!preserveWorld) cancelWorld?.();
  };
}
