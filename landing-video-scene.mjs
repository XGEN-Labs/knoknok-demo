import { createLandingVideoPlayer } from './landing-video-player.mjs';

// The runtime asset physically excludes the supplied film's baked UI.
// Original frames [0,16) + [116,190), 30fps; source bytes remain archived.
// Integer frame boundaries keep pauses on reviewed, clean frames.
const frame = number => number / 30;
export const LANDING_VIDEO_CUES = Object.freeze([
  // Frame 15 still has the film's black iris; 16 is the first full meadow.
  {key:'birthDate',start:0,end:frame(16)},
  {key:'birthTime',start:frame(16),end:frame(25)},
  {key:'gender',start:frame(25),end:frame(37)},
  {key:'birthPlace',start:frame(37),end:frame(49)},
  {key:'response',start:frame(49),end:frame(62)},
  {key:'name',start:frame(62),end:frame(77)},
  {key:'companionName',start:frame(77),end:frame(82)},
  {key:'complete',start:frame(82),end:frame(88)},
].map(Object.freeze));

export function createLandingVideoScene({phone}={}) {
  if(!phone)throw new TypeError('A phone host is required.');
  const host=document.createElement('div');host.className='landing-video-scene';host.hidden=true;
  const video=document.createElement('video');video.className='landing-video-plate';
  video.setAttribute('aria-hidden','true');video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
  video.muted=true;video.defaultMuted=true;video.playsInline=true;video.preload='auto';video.disablePictureInPicture=true;
  video.src='assets/landing-video-20261021/encounter-clean-cut-v2.mp4';
  const resume=document.createElement('button');resume.type='button';resume.className='landing-video-resume kn-glass-control';resume.textContent='繼續相遇';resume.hidden=true;
  const skip=document.createElement('button');skip.type='button';skip.className='landing-video-skip kn-glass-control';skip.textContent='跳過';skip.setAttribute('aria-label','跳過這段影片，開始回答');skip.hidden=true;
  const status=document.createElement('span');status.className='sr-only';status.setAttribute('role','status');
  host.append(video);phone.prepend(host);phone.append(resume,skip,status);
  let active=false,lastState={state:'inactive',readyForInput:false},disposed=false;
  function applyState(next) {
    lastState=next;if(!active||disposed)return;
    phone.dataset.landingPlayback=next.state;
    phone.dataset.landingCue=next.key||'';
    phone.dataset.landingVideoTime=Number(next.currentTime||0).toFixed(3);
    resume.hidden=next.state!=='blocked';
    skip.hidden=!['loading','playing','blocked'].includes(next.state);
    status.textContent=next.state==='blocked'?'輕觸繼續相遇，播放下一段。':next.state==='fallback'?'場景暫時未能播放，你可以繼續輸入。':'';
    for(const layer of phone.querySelectorAll('.conversation-onboarding > :is(.onboarding-header,.onboarding-thread,.onboarding-composer)')){
      layer.inert=!next.readyForInput;
      if(next.readyForInput)layer.removeAttribute('aria-hidden');else layer.setAttribute('aria-hidden','true');
    }
  }
  const player=createLandingVideoPlayer({video,cues:LANDING_VIDEO_CUES,onState:applyState});
  resume.addEventListener('click',()=>player.retry());
  skip.addEventListener('click',()=>{if(player.skip())status.textContent='影片已跳過，請回答這一題。';});
  return {
    update({active:enabled=false,key='birthDate',reducedMotion=false,restore=false}={}) {
      active=enabled;host.hidden=!active;if(!active){resume.hidden=true;skip.hidden=true;}phone.classList.toggle('landing-video-active',active);
      if(!active){delete phone.dataset.landingPlayback;delete phone.dataset.landingCue;delete phone.dataset.landingVideoTime;}
      player.update({active,key,reducedMotion,restore});
      if(active)applyState(lastState);
    },
    get readyForInput(){return active&&lastState.readyForInput;},
    getDiagnostics:()=>player.getDiagnostics(),
    dispose(){disposed=true;player.dispose();host.remove();resume.remove();skip.remove();status.remove();phone.classList.remove('landing-video-active');delete phone.dataset.landingPlayback;delete phone.dataset.landingCue;delete phone.dataset.landingVideoTime;}
  };
}
