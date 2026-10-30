import {HOME_SCENE_ASSET, HOME_SCENE_VIDEO_ASSET, HOME_CHARACTER_SCENE_ASSET, HOME_CHARACTER_IDLE_ASSET, HOME_CHARACTER_REACT_ASSET} from './scene-assets.mjs?v=20261030-klin-room-daynight-v12';

// Both themes must use the same down-hand character and native camera crop.
// A static fallback needs BOTH a character poster and an empty-room poster.
// Missing video fields mean a real still fallback, never a guessed video URL.
export const ROOM_LIGHT_THEMES = Object.freeze({
  warm: Object.freeze({label: '夜晚', width: 496, height: 864, lamp: {x: 433, y: 333, width: 56, height: 60}, poster: HOME_CHARACTER_SCENE_ASSET, idle: HOME_CHARACTER_IDLE_ASSET, react: HOME_CHARACTER_REACT_ASSET, roomPoster: HOME_SCENE_ASSET, roomLoop: HOME_SCENE_VIDEO_ASSET}),
  bright: Object.freeze({label: '白天', width: 496, height: 864, lamp: {x: 433, y: 333, width: 56, height: 60}, poster: 'assets/klin-room-motion-20261030-v11/poster-daylight.png', idle: 'assets/klin-room-motion-20261030-v11/idle-daylight.mp4', react: 'assets/klin-room-motion-20261030-v11/react-daylight.mp4', roomPoster: 'assets/klin-room-motion-20261030-v11/room-only-daylight.png', roomLoop: 'assets/klin-room-motion-20261030-v11/room-loop-daylight.mp4'}),
});
