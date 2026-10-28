import { createLandingAudio } from './landing-audio-engine.mjs?v=20261028-audio-63';

// Existing cue(kind)/setEnabled callers retain one shared, initially muted owner.
export function createSceneSound(options) { return createLandingAudio(options); }
