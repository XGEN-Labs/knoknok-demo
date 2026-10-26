/** Verified against v15 dialogue-manifest.json; film 21 preserves that audio.
 * Static recordings use these exact service settings. Browser rate/pitch are
 * only an approximation of the provider prosody, even with the same voice ID.
 */
export const ROOM_VOICE_PROFILE = Object.freeze({
  provider: 'Microsoft Edge Read Aloud',
  model: 'zh-CN-YunxiaNeural',
  language: 'zh-CN',
  rate: '-4%', volume: '-8%', pitch: '+0Hz',
  browserRate: .96, browserVolume: .92, browserPitch: 1,
});

export const isRoomNarration = scope => /^home:/.test(String(scope || ''));
export const isMandarin = lang => /^zh-(?:CN|Hans)(?:$|-)/i.test(String(lang || '').replaceAll('_', '-'));

const voiceIdentifiers = new Set([
  'zh-CN-YunxiaNeural',
  'Microsoft Server Speech Text to Speech Voice (zh-CN, YunxiaNeural)',
  'Microsoft Yunxia Online (Natural) - Chinese (Mainland)',
].map(value => value.toLowerCase()));

/** Never select an online service for new dynamic private text. Matching a
 * language or a similar name alone is not evidence of the film's speaker.
 */
export function findLocalLandingVoice(voices, lang = 'zh-CN') {
  if (!isMandarin(lang)) return null;
  return voices.find(voice => voice.localService === true && isMandarin(voice.lang) &&
    [voice.name, voice.voiceURI].some(value => voiceIdentifiers.has(String(value || '').toLowerCase()))) || null;
}
