export const klinAssets = Object.freeze({
  juvenile: 'assets/klin-native-20261016-0907/juvenile.png',
  adult: 'assets/native-room-20261023-37/adult.png',
});

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function klinMarkup({stage = 'juvenile', label = 'Klin', attrs = '', decorative = false} = {}) {
  const age = stage === 'adult' ? 'adult' : 'juvenile';
  return `<span class="companion-art klin-art" data-companion="klin" data-stage="${age}" ${decorative ? 'aria-hidden="true"' : `role="img" aria-label="${escape(label)}"`} ${attrs}><img class="figma-companion-image" src="${klinAssets[age]}" width="768" height="768" alt="" aria-hidden="true" draggable="false"><span class="klin-loading-light" aria-hidden="true"><span class="klin-loading-label">Klin 正在靠近…</span></span></span>`;
}

// The native adult is rendered with its room lighting to a transparent web layer.
// Native Blender data is not downloaded by this 2D runtime.
export function setKlinLoadingState(phone, state) {
  if (!['loading', 'ready', 'fallback'].includes(state)) throw new TypeError('Unknown Klin loading state');
  for (const candidate of ['loading', 'ready', 'fallback']) phone.classList.toggle(`klin-world-${candidate}`, candidate === state);
  let status = phone.querySelector('.klin-loading-status');
  if (state === 'loading') {
    if (!status) {
      status = phone.ownerDocument.createElement('span');
      status.className = 'klin-loading-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      phone.append(status);
    }
    status.textContent = 'Klin 正在靠近…';
  } else status?.remove();
}
