// A public visual seed, independent of birthdays, private messages and memories.
// Persist it on the profile; carry it in shared snapshots so every surface agrees.
// One shared portrait design. Legacy seeds are accepted for old shared links,
// but no longer choose a different layout or palette.
export const CARD_DESIGN_NAMES = Object.freeze(['奶油白直式']);
export const CARD_PALETTES = Object.freeze([
 {paper:'#fbf8f1',ink:'#363a42',accent:'#afaeac'},
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
  const layout = 0;
  const palette = CARD_PALETTES[layout];
  return { seed, layout, name:CARD_DESIGN_NAMES[layout], ...palette };
}
export function cardNameSize(name) {
  const units = Array.from(name || '').reduce((sum, char) => sum + (/[^\u0000-\u024f]/.test(char) ? 1 : .53), 0);
  return units > 18 ? 17 : units > 10 ? 21 : units > 6 ? 27 : 35;
}
