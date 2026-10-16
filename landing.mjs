// Adapted from the user's metal-character dialogue. This is a self-selected
// reflection, not a calculated day-master, destiny or personality assessment.
export const METAL_VOICES = {
  geng: {
    label: '清楚、果斷', motif: '一道清晰的聚光',
    teaser: '你像一道聚攏的光，清楚自己要去的方向。',
    reading: '硬是你的保護色。其實被你在意的人，你會用最笨的方式對他好。',
    reply: '那我記住了。你在意的人，我會陪你慢慢靠近。',
    memory: '我更接近清楚、果斷的表達方式，也很在意身邊的人。',
  },
  xin: {
    label: '細膩、講究', motif: '一圈柔和的光暈',
    teaser: '你像一圈柔和的光，細膩，也留意每一點微小的美。',
    reading: '你要的不多，但要得精——寧缺毋濫這四個字，像為你寫的。',
    reply: '那我們就慢慢來。不急著熱鬧，先遇見讓你舒服的人。',
    memory: '我更接近細膩、講究的表達方式，認識人時喜歡慢慢來。',
  },
};

export const validMetalVoice = tone => typeof tone === 'string' && Object.hasOwn(METAL_VOICES, tone);

export function landingComplete(state) {
  if (state.session.activeUserId !== 'a') return true;
  const o = state.onboarding;
  return o?.status === 'ready' && o.basicsComplete === true && o.birthComplete === true && o.interaction?.greeted === true &&
    validMetalVoice(o.interaction?.tone) &&
    ['resonates', 'different'].includes(o.interaction?.response);
}

export function onboardingDestination(state) {
  if (state.session.activeUserId !== 'a') return 'relations';
  const o = state.onboarding;
  if (o?.interaction?.greeted !== true) return 'landing';
  if (o.basicsComplete !== true) return 'setup-basics';
  if (o.birthComplete !== true) return 'setup-birth';
  if (o.status !== 'ready') return 'initializing';
  return landingComplete(state) ? 'home' : 'onboard';
}
