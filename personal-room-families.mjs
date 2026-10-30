// Only approved, complete runtime bundles may be added here. Expected filenames
// and ungenerated films live in the private pending manifest, never this map.
export const PERSONAL_ROOM_FAMILY_BUNDLES = Object.freeze({"wood": {"ready": true, "themes": {"bright": {"label": "白天", "width": 496, "height": 864, "actor": {"x": 140, "y": 415, "width": 195, "height": 235}, "head": {"x": 192, "y": 490, "width": 104, "height": 104}, "lamp": {"x": 432, "y": 335, "width": 64, "height": 90}, "poster": "assets/nok-personal-rooms-20261030-v01/wood/day-poster.png", "roomPoster": "assets/nok-personal-rooms-20261030-v01/wood/day-room-only.png"}, "warm": {"label": "夜晚", "width": 496, "height": 864, "actor": {"x": 140, "y": 415, "width": 195, "height": 235}, "head": {"x": 192, "y": 490, "width": 104, "height": 104}, "lamp": {"x": 432, "y": 335, "width": 64, "height": 90}, "poster": "assets/nok-personal-rooms-20261030-v01/wood/night-poster.png", "roomPoster": "assets/nok-personal-rooms-20261030-v01/wood/night-room-only.png", "idle": "assets/nok-personal-rooms-20261030-v01/wood/night-idle.mp4", "react": "assets/nok-personal-rooms-20261030-v01/wood/night-react.mp4"}}}, "water": {"ready": true, "themes": {"bright": {"label": "白天", "width": 496, "height": 864, "actor": {"x": 145, "y": 450, "width": 205, "height": 205}, "head": {"x": 192, "y": 491, "width": 104, "height": 104}, "lamp": {"x": 430, "y": 335, "width": 65, "height": 100}, "poster": "assets/nok-personal-rooms-20261030-v01/water/day-poster.png", "roomPoster": "assets/nok-personal-rooms-20261030-v01/water/day-room-only.png"}, "warm": {"label": "夜晚", "width": 496, "height": 864, "actor": {"x": 145, "y": 450, "width": 205, "height": 205}, "head": {"x": 192, "y": 491, "width": 104, "height": 104}, "lamp": {"x": 430, "y": 335, "width": 65, "height": 100}, "poster": "assets/nok-personal-rooms-20261030-v01/water/night-poster.png", "roomPoster": "assets/nok-personal-rooms-20261030-v01/water/night-room-only.png", "idle": "assets/nok-personal-rooms-20261030-v01/water/night-idle.mp4", "react": "assets/nok-personal-rooms-20261030-v01/water/night-react.mp4"}}}, "fire": {"ready": true, "themes": {"bright": {"label": "白天", "width": 496, "height": 864, "actor": {"x": 130, "y": 365, "width": 215, "height": 285}, "head": {"x": 192, "y": 488, "width": 104, "height": 104}, "lamp": {"x": 430, "y": 335, "width": 65, "height": 100}, "poster": "assets/nok-personal-rooms-20261030-v01/fire/day-poster.png", "roomPoster": "assets/nok-personal-rooms-20261030-v01/fire/day-room-only.png"}, "warm": {"label": "夜晚", "width": 496, "height": 864, "actor": {"x": 130, "y": 365, "width": 215, "height": 285}, "head": {"x": 192, "y": 488, "width": 104, "height": 104}, "lamp": {"x": 430, "y": 335, "width": 65, "height": 100}, "poster": "assets/nok-personal-rooms-20261030-v01/fire/night-poster.png", "roomPoster": "assets/nok-personal-rooms-20261030-v01/fire/night-room-only.png", "idle": "assets/nok-personal-rooms-20261030-v01/fire/night-idle.mp4", "react": "assets/nok-personal-rooms-20261030-v01/fire/night-react.mp4"}}}, "earth": {"ready": true, "themes": {"bright": {"label": "白天", "width": 496, "height": 864, "actor": {"x": 145, "y": 455, "width": 205, "height": 205}, "head": {"x": 192, "y": 500, "width": 104, "height": 104}, "lamp": {"x": 432, "y": 335, "width": 65, "height": 85}, "poster": "assets/nok-personal-rooms-20261030-v01/earth/day-poster.png", "roomPoster": "assets/nok-personal-rooms-20261030-v01/earth/day-room-only.png"}, "warm": {"label": "夜晚", "width": 496, "height": 864, "actor": {"x": 145, "y": 455, "width": 205, "height": 205}, "head": {"x": 192, "y": 500, "width": 104, "height": 104}, "lamp": {"x": 432, "y": 335, "width": 65, "height": 85}, "poster": "assets/nok-personal-rooms-20261030-v01/earth/night-poster.png", "roomPoster": "assets/nok-personal-rooms-20261030-v01/earth/night-room-only.png", "idle": "assets/nok-personal-rooms-20261030-v01/earth/night-idle.mp4", "react": "assets/nok-personal-rooms-20261030-v01/earth/night-react.mp4"}}}});
export const PERSONAL_ROOM_FAMILY_IDS = Object.freeze(['wood', 'water', 'fire', 'earth']);
const known = id => PERSONAL_ROOM_FAMILY_IDS.includes(id);
const path = value => typeof value === 'string' && /^assets\/[a-zA-Z0-9_./-]+$/.test(value) && !value.split('/').includes('..');
const rectangle = value => value && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(value[key])) && value.width > 0 && value.height > 0;
const geometry = theme => Number.isFinite(theme?.width) && theme.width > 0 && Number.isFinite(theme?.height) && theme.height > 0 && rectangle(theme?.actor) && rectangle(theme?.lamp) && rectangle(theme?.head) && theme.head.width === theme.head.height;
const plates = theme => path(theme?.poster) && path(theme?.roomPoster) && theme.poster !== theme.roomPoster;

export function personalRoomArtwork(familyId, stage = 'adult', view = 'full') {
  if (!known(familyId)) return null;
  const phase = stage === 'juvenile' ? 'baby' : 'adult';
  const part = view === 'head' ? (phase === 'baby' ? 'babyHead' : 'head') : phase;
  return `assets/studio-family-artwork.svg#${familyId}-${part}`;
}

export function personalRoomFamilyReady(bundle) {
  if (bundle?.ready !== true) return false;
  const day = bundle.themes?.bright, night = bundle.themes?.warm;
  // Daytime is an actual still. The empty room is also a still unless a later
  // reviewed bundle explicitly supplies a separately encoded empty-room loop.
  return !!(plates(day) && plates(night) && geometry(day) && geometry(night)
    && !day.idle && !day.react && !day.roomLoop
    && path(night.idle) && path(night.react)
    && (!night.roomLoop || path(night.roomLoop)));
}

export function resolvePersonalRoomPresentation(familyId, bundles = PERSONAL_ROOM_FAMILY_BUNDLES) {
  if (!known(familyId) || !Object.hasOwn(bundles, familyId)) return null;
  const bundle = bundles[familyId];
  if (!personalRoomFamilyReady(bundle)) return null;
  const day = bundle.themes.bright;
  return {familyId, avatar: {src: day.poster, width: day.width, height: day.height, crop: day.head}, world: {
    roomThemes: bundle.themes, characterFilm: true, separateAdultArtwork: false,
    // Adult room/flight pixels come from the actual scene poster. The legacy
    // seated sheet is retained only for the existing juvenile fallback.
    characterAssets: {adult: day.poster, juvenile: personalRoomArtwork(familyId, 'juvenile')},
  }};
}

// Keep the already available Klin films for an explicitly assigned metal
// family; other families need their own complete, validated media bundle.
export function personalRoomFilmAllowed(familyId, bundles = PERSONAL_ROOM_FAMILY_BUNDLES) {
  return familyId === 'metal' || resolvePersonalRoomPresentation(familyId, bundles) !== null;
}

export function personalRoomMarkup(presentation, label = '') {
  if (!presentation?.world?.characterAssets?.adult) return null;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  return `<span class="companion-art klin-art" data-companion="${esc(presentation.familyId)}" data-stage="adult" role="img" aria-label="${esc(label)}"></span>`;
}
