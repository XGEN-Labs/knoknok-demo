const LOOP_URL = 'assets/pixel-animation/04-xin-openness.gif';
const POSTER_URL = 'assets/pixel-animation/04-xin-openness.png';
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
const escapeAttribute = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

function wantsStillness() {
  return window.matchMedia(reducedMotionQuery).matches || Boolean(document.body?.classList.contains('reduced-motion'));
}

// Reuse the original transparent five-second GIF and its original still image.
// The CSS viewport only removes unused canvas; all poses remain inside it.
export function pixelCompanionMarkup(label = 'Knok 像素伙伴', attrs = '') {
  const source = wantsStillness() ? POSTER_URL : LOOP_URL;
  return `<span class="companion-art pixel-companion pixel-animated" role="img" aria-label="${escapeAttribute(label)}" ${attrs}><span class="pixel-loop-viewport"><img data-pixel-animation src="${source}" width="512" height="512" alt="" aria-hidden="true" draggable="false"></span></span>`;
}

let detachPreferenceListener;

// The app calls this after applying its setting, including the initial render.
export function syncCompanionAnimation() {
  const source = wantsStillness() ? POSTER_URL : LOOP_URL;
  for (const image of document.querySelectorAll('img[data-pixel-animation]')) {
    if (image.getAttribute('src') !== source) image.setAttribute('src', source);
  }
}

// Listen only for OS changes; prototype changes are synced by its renderer.
export function initCompanionAnimation() {
  if (detachPreferenceListener) return detachPreferenceListener;
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener('change', syncCompanionAnimation);
  syncCompanionAnimation();
  detachPreferenceListener = () => {
    media.removeEventListener('change', syncCompanionAnimation);
    detachPreferenceListener = undefined;
  };
  return detachPreferenceListener;
}
