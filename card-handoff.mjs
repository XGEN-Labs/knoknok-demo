const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

// Keep the real, already-laid-out public card in its destination. Only its
// transform changes; no screenshot, duplicate card, texture, or content swap.
export function createCardHandoff(host, page) {
  const card = page.querySelector('.share-card');
  if (!card || !host.getBoundingClientRect || !card.getBoundingClientRect) return null;
  const originalStyle = card.getAttribute('style');
  const originalHidden = card.getAttribute('aria-hidden');
  const hostRect = host.getBoundingClientRect();
  const rect = card.getBoundingClientRect();
  const width = host.clientWidth, height = host.clientHeight;
  if (!width || !height || !rect.width || !hostRect.width || !hostRect.height) return null;
  const factorX = width / hostRect.width, factorY = height / hostRect.height;
  const targetX = (rect.left + rect.width / 2 - hostRect.left) * factorX;
  const targetY = (rect.top + rect.height / 2 - hostRect.top) * factorY;
  let closed = false;
  card.classList.add('card-in-handoff');
  page.classList.add('card-handoff-page');
  card.setAttribute('aria-hidden', 'true');
  card.style.opacity = '0';
  card.style.transformOrigin = '50% 50%';
  card.style.willChange = 'transform, opacity';
  return {
    card,
    frame({ progress = 0, hand = { x: .5, y: .54 }, rotation = -.08 } = {}) {
      if (closed) return;
      const p = clamp(progress);
      // The first beat is Klin gathering its hands. Then the same portrait
      // leaves those hands, opens toward the viewer, and settles exactly at 1.
      const reveal = smooth((p - .09) / .14);
      const flight = smooth((p - .40) / .56);
      const scale = .22 + .78 * flight;
      const dx = (hand.x * width - targetX) * (1 - flight);
      // Klin holds the upper sides of the portrait, keeping its eyes above it.
      const gripOffset = rect.height * factorY * scale * .20;
      const dy = (hand.y * height + gripOffset - targetY) * (1 - flight);
      const angle = rotation * (1 - flight);
      card.style.opacity = String(reveal);
      card.style.transform = `translate3d(${dx}px,${dy}px,0) rotate(${angle}rad) scale(${scale})`;
      card.dataset.handoffProgress = String(p);
    },
    finish() {
      if (closed) return;
      closed = true;
      card.classList.remove('card-in-handoff');
      page.classList.remove('card-handoff-page');
      delete card.dataset.handoffProgress;
      if (originalStyle === null) card.removeAttribute('style');
      else card.setAttribute('style', originalStyle);
      if (originalHidden === null) card.removeAttribute('aria-hidden');
      else card.setAttribute('aria-hidden', originalHidden);
    },
  };
}
