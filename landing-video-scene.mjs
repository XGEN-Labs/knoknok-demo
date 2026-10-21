import { createLandingVideoPlayer } from './landing-video-player.mjs';

// The supplied concept film includes baked forms at 1.3–3.4s and a contract
// after 7.7s. Keep its original bytes; the interactive cut uses clean intervals.
// Replace this cue sheet when the UI-free master becomes available.
export const LANDING_VIDEO_CUES = Object.freeze([
  {key:'birthDate',start:0,end:.70},
  {key:'birthTime',start:3.85,end:4.15},
  {key:'gender',start:4.15,end:4.55},
  {key:'birthPlace',start:4.55,end:4.95},
  {key:'response',start:4.95,end:5.4},
  {key:'name',start:5.4,end:5.9},
  {key:'companionName',start:5.9,end:6.25},
  {key:'complete',start:6.25,end:6.25},
].map(Object.freeze));

export function createLandingVideoScene({phone}={}) {
  if(!phone)throw new TypeError('A phone host is required.');
  const host=document.createElement('div');host.className='landing-video-scene';host.hidden=true;
  const video=document.createElement('video');video.className='landing-video-plate';
  video.setAttribute('aria-hidden','true');video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
  video.muted=true;video.defaultMuted=true;video.playsInline=true;video.preload='auto';video.disablePictureInPicture=true;
  video.src='assets/landing-video-20261021/encounter.mp4';
  const resume=document.createElement('button');resume.type='button';resume.className='landing-video-resume kn-glass-control';resume.textContent='繼續相遇';resume.hidden=true;
  const status=document.createElement('span');status.className='sr-only';status.setAttribute('role','status');
  host.append(video);phone.prepend(host);phone.append(resume,status);
  let active=false,lastState={state:'inactive',readyForInput:false},disposed=false;
  function applyState(next) {
    lastState=next;if(!active||disposed)return;
    phone.dataset.landingPlayback=next.state;
    phone.dataset.landingCue=next.key||'';
    phone.dataset.landingVideoTime=Number(next.currentTime||0).toFixed(3);
    resume.hidden=next.state!=='blocked';
    status.textContent=next.state==='blocked'?'輕觸繼續相遇，播放下一段。':next.state==='fallback'?'場景暫時未能播放，你可以繼續輸入。':'';
    for(const layer of phone.querySelectorAll('.conversation-onboarding > :is(.onboarding-thread,.onboarding-composer)')){
      layer.inert=!next.readyForInput;
      if(next.readyForInput)layer.removeAttribute('aria-hidden');else layer.setAttribute('aria-hidden','true');
    }
  }
  const player=createLandingVideoPlayer({video,cues:LANDING_VIDEO_CUES,onState:applyState});
  resume.addEventListener('click',()=>player.retry());
  return {
    update({active:enabled=false,key='birthDate',reducedMotion=false,restore=false}={}) {
      active=enabled;host.hidden=!active;if(!active)resume.hidden=true;phone.classList.toggle('landing-video-active',active);
      if(!active){delete phone.dataset.landingPlayback;delete phone.dataset.landingCue;delete phone.dataset.landingVideoTime;}
      player.update({active,key,reducedMotion,restore});
      if(active)applyState(lastState);
    },
    get readyForInput(){return active&&lastState.readyForInput;},
    getDiagnostics:()=>player.getDiagnostics(),
    dispose(){disposed=true;player.dispose();host.remove();resume.remove();status.remove();phone.classList.remove('landing-video-active');delete phone.dataset.landingPlayback;delete phone.dataset.landingCue;delete phone.dataset.landingVideoTime;}
  };
}
