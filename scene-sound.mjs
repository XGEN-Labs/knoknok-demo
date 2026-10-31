import { createLandingAudio } from './landing-audio-engine.mjs?v=20261028-music-balance-70';

// Existing cue(kind)/setEnabled callers retain one shared, initially muted owner.
export function createSceneSound(options) { return createLandingAudio(options); }
