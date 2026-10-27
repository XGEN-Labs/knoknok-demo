import { createLandingAudio } from './landing-audio-engine.mjs?v=20261027-glass-52g';

// Existing cue(kind)/setEnabled callers retain one shared, initially muted owner.
export function createSceneSound(options) { return createLandingAudio(options); }
