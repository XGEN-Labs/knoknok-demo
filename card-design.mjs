// A public visual seed, independent of birthdays, private messages and memories.
// Persist it on the profile; carry it in shared snapshots so every surface agrees.
export const CARD_DESIGN_NAMES = Object.freeze(['螢光綠直排', '奶油雙欄', '粉綠線稿', '藍底留白', '藍線分欄', '彩色 Klin']);
export const CARD_PALETTES = Object.freeze([
 {paper:'#d5e537',ink:'#087f50',accent:'#087f50'},
 {paper:'#fffbeb',ink:'#222520',accent:'#222520'},
 {paper:'#ce8aa2',ink:'#005235',accent:'#005235'},
 {paper:'#3b61ec',ink:'#fff7df',accent:'#fff7df'},
 {paper:'#f2f2f1',ink:'#304e9e',accent:'#304e9e'},
 {paper:'#efede8',ink:'#151515',accent:'#0768f4'},
]);
export function normalizeCardDesign(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff ? value : null;
}
export function generateCardDesign(identity = '') {
  let seed = 2166136261;
  for (const char of String(identity)) seed = Math.imul(seed ^ char.codePointAt(0), 16777619) >>> 0;
  return seed;
}
export function resolveCardDesign(value) {
  const seed = normalizeCardDesign(value?.design) ?? generateCardDesign(value?.name || 'friend');
  const layout = seed % CARD_DESIGN_NAMES.length;
  const palette = CARD_PALETTES[layout];
  return { seed, layout, name:CARD_DESIGN_NAMES[layout], ...palette };
}
export function cardNameSize(name) {
  const units = Array.from(name || '').reduce((sum, char) => sum + (/[^\u0000-\u024f]/.test(char) ? 1 : .53), 0);
  return units > 18 ? 17 : units > 10 ? 21 : units > 6 ? 27 : 35;
}
