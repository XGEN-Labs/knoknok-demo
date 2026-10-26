// Reviewed 21-complete-native-mouth-clean.mp4: 1646 frames at 24 fps.
// Verified identical PTS, dialogue and UI gates to landing-46; timing retained.
// These are manual UI gates, not the individual speech/edit segments. A user
// answer advances the next interval; pausing never consumes response time.
const frame = number => number / 24;
export const LANDING_VIDEO_FRAME_RATE = 24;
export const LANDING_VIDEO_FRAME_COUNT = 1646;
export const LANDING_VIDEO_CUES = Object.freeze([
  {key:'where',start:0,end:frame(88)},
  {key:'birthDate',start:frame(88),end:frame(236)},
  {key:'birthTime',start:frame(236),end:frame(318)},
  {key:'gender',start:frame(318),end:frame(318)},
  {key:'birthPlace',start:frame(318),end:frame(318)},
  {key:'response',start:frame(318),end:frame(995)},
  {key:'contractLight',start:frame(995),end:frame(1140)},
  {key:'name',start:frame(1140),end:frame(1164)},
  {key:'companionName',start:frame(1164),end:frame(1188)},
  {key:'complete',start:frame(1188),end:frame(1236)},
].map(Object.freeze));
// Hold the last decodable frame, not the duration/end-exclusive boundary.
export const LANDING_ARRIVAL_CUE = Object.freeze({key:'arrival',start:frame(1236),end:frame(1645)});
export const LANDING_NOKING_CUE = Object.freeze({start:frame(850),end:frame(995)});

// Exact fixed dialogue from source-playback-manifest.json, localized only to
// Traditional Chinese. These intervals follow film time, never wall-clock time.
export const LANDING_VIDEO_SUBTITLES = Object.freeze([
  {id:'01-awakening',start:0.1,end:3.556,text:'NokNok 敲敲……你終於醒了'},
  {id:'02-realm',start:3.7666666666666666,end:6.286666666666667,text:'你在敲敲彼之境'},
  {id:'03-birthday',start:6.516666666666667,end:9.708666666666666,text:'你可以告訴我你的生日嗎'},
  {id:'04-time',start:9.933333333333334,end:13.149333333333335,text:'時辰，不記得也沒關係'},
  {id:'05-crowd-question',start:13.65,end:15.738,text:'是這個人嗎？'},
  {id:'06-crowd-maybe',start:15.938,end:17.882,text:'好像是……'},
  {id:'07-crowd-arrival',start:18.082,end:20.41,text:'等等，它來了！'},
  {id:'08-found-you',start:31.375,end:34.855,text:'太好了，你就是我要找的人！'},
  {id:'09-contract',start:41.458333333333336,end:43.97833333333334,text:'這個是我們的契約'},
].map(Object.freeze));

export function landingVideoSubtitleAt(currentTime,{playing=false}={}) {
  if(!playing||!Number.isFinite(currentTime))return null;
  return LANDING_VIDEO_SUBTITLES.find(cue=>currentTime>=cue.start&&currentTime<cue.end)||null;
}

export function landingVideoNokingAt(currentTime,{playing=false}={}) {
  const {start,end}=LANDING_NOKING_CUE;
  if(!playing||!Number.isFinite(currentTime)||currentTime<start||currentTime>=end)return null;
  return {progress:(currentTime-start)/(end-start)};
}

export function landingVideoOverlaysPlaying({active=false,disposed=false,state='inactive',paused=true,seeking=false,readyState=0}={}) {
  return active&&!disposed&&state==='playing'&&!paused&&!seeking&&readyState>=3;
}
