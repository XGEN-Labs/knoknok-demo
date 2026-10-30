// Media slots only: these never choose or change the Agent family/persona.
// The user approved reusing the existing Klin encounter film for every family.
const klinEncounter = 'assets/landing-20261028-67/35-complete-effects-voices-no-bgm.mp4';
export const LANDING_FAMILY_VIDEOS = Object.freeze({
  metal: klinEncounter,
  wood: klinEncounter,
  water: klinEncounter,
  fire: klinEncounter,
  earth: klinEncounter,
});
// Before the server assigns a family, the original opening film is retained.
export function landingVideoSource(familyId) {
  return Object.hasOwn(LANDING_FAMILY_VIDEOS, familyId) ? LANDING_FAMILY_VIDEOS[familyId] : klinEncounter;
}
