import { createLandingVideoPlayer } from './landing-video-player.mjs?v=20261022-video-30b';
import { createLandingHeldFrame } from './landing-held-frame.mjs?v=20261022-video-30b';
import { createLandingGlass } from './landing-glass.mjs?v=20261022-video-30b';
import { createLandingDeparture } from './landing-departure.mjs?v=20261022-video-30b';

// All information is entered on the same early meadow frame, before the group
// approaches. Only the completed profile unlocks the encounter/contract film;
// the actual signed contract then unlocks growth and the final trip home.
const frame = number => number / 24;
export const LANDING_VIDEO_CUES = Object.freeze([
  {key:'birthDate',start:0,end:frame(48)},
  {key:'birthTime',start:frame(48),end:frame(48)},
  {key:'gender',start:frame(48),end:frame(48)},
  {key:'birthPlace',start:frame(48),end:frame(48)},
  {key:'response',start:frame(48),end:frame(48)},
  {key:'name',start:frame(48),end:frame(48)},
  {key:'companionName',start:frame(48),end:frame(48)},
  {key:'complete',start:frame(48),end:frame(474)},
].map(Object.freeze));
export const LANDING_ARRIVAL_CUE = Object.freeze({key:'arrival',start:frame(474),end:frame(719)});

export function createLandingVideoScene({phone}={}) {
  if(!phone)throw new TypeError('A phone host is required.');
  const host=document.createElement('div');host.className='landing-video-scene';host.hidden=true;
  const video=document.createElement('video');video.className='landing-video-plate';
  video.setAttribute('aria-hidden','true');video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
  video.muted=true;video.defaultMuted=true;video.playsInline=true;video.preload='auto';video.disablePictureInPicture=true;
  video.src='assets/landing-video-20261022/nok-complete-30s-draft.mp4';
  const still=document.createElement('canvas');still.className='landing-video-still landing-video-plate';still.setAttribute('aria-hidden','true');
  const resume=document.createElement('button');resume.type='button';resume.className='landing-video-resume kn-glass-control';resume.textContent='繼續相遇';resume.hidden=true;
  const skip=document.createElement('button');skip.type='button';skip.className='landing-video-skip kn-glass-control';skip.textContent='跳過';skip.setAttribute('aria-label','跳過這段影片，開始回答');skip.hidden=true;
  const status=document.createElement('span');status.className='sr-only';status.setAttribute('role','status');
  host.append(video,still);phone.prepend(host);phone.append(resume,skip,status);
  let active=false,lastState={state:'inactive',readyForInput:false},disposed=false,reducedMotion=false;
  const departure=createLandingDeparture();
  let presentedState='inactive',presentedReady=false;
  const landingGlass=createLandingGlass({phone,sourceCanvas:still});
  const heldFrame=createLandingHeldFrame({video,canvas:still,onSettled:()=>applyPresentation()});
  function applyPresentation() {
    if(!active||disposed)return;
    const next=lastState,held=heldFrame.getDiagnostics();
    const departing=departure.phase!=='idle';
    phone.dataset.landingPhase=departing?departure.phase:'encounter';
    landingGlass.update({active:true,ready:!departing&&next.state==='waiting'&&held.captured,key:`frame:${next.targetTime}`});
    const settling=next.state==='waiting'&&held.state==='settling';
    const frameFailed=next.state==='waiting'&&held.state==='unavailable';
    // A failed seek may still expose the film's first frame. Fall back to the
    // matching room plate rather than revealing the form over that wrong frame.
    presentedState=settling?'settling':frameFailed?'fallback':next.state;
    presentedReady=!departing&&next.readyForInput&&!settling;
    host.classList.toggle('has-held-frame',next.state==='waiting'&&held.captured);
    phone.dataset.landingPlayback=presentedState;
    phone.dataset.landingFrame=held.state;
    phone.dataset.landingCue=next.key||'';
    phone.dataset.landingVideoTime=Number(next.currentTime||0).toFixed(3);
    resume.hidden=next.state!=='blocked';
    skip.hidden=!['loading','playing','blocked'].includes(next.state);
    skip.setAttribute('aria-label',departing?'跳過影片，直接回家':'跳過這段影片，開始回答');
    status.textContent=next.state==='blocked'?'輕觸繼續相遇，播放下一段。':presentedState==='fallback'?'場景暫時未能播放，你可以繼續輸入。':'';
    for(const layer of phone.querySelectorAll('.conversation-onboarding > :is(.onboarding-header,.onboarding-thread,.onboarding-composer)')){
      layer.inert=!presentedReady;
      if(presentedReady)layer.removeAttribute('aria-hidden');else layer.setAttribute('aria-hidden','true');
    }
  }
  function applyState(next) {
    lastState=next;if(!active||disposed)return;
    departure.observe(next);
    if(next.state==='waiting'&&next.key!=='arrival')heldFrame.hold({key:`frame:${next.targetTime}`,targetTime:next.targetTime});
    else heldFrame.release();
    applyPresentation();
  }
  const player=createLandingVideoPlayer({video,cues:[...LANDING_VIDEO_CUES,LANDING_ARRIVAL_CUE],onState:applyState});
  resume.addEventListener('click',()=>player.retry());
  skip.addEventListener('click',()=>{if(player.skip())status.textContent=departure.pending?'我們回家了。':'影片已跳過，請回答這一題。';});
  return {
    update({active:enabled=false,key='birthDate',reducedMotion:stillness=false,restore=false}={}) {
      if(disposed)return;
      reducedMotion=stillness;
      active=enabled;host.hidden=!active;if(!active){departure.cancel();resume.hidden=true;skip.hidden=true;landingGlass.update({active:false});heldFrame.release();host.classList.remove('has-held-frame');presentedState='inactive';presentedReady=false;}phone.classList.toggle('landing-video-active',active);
      if(!active){delete phone.dataset.landingPlayback;delete phone.dataset.landingFrame;delete phone.dataset.landingCue;delete phone.dataset.landingVideoTime;delete phone.dataset.landingPhase;}
      player.update({active,key:departure.phase!=='idle'?'arrival':key,reducedMotion,restore});
      if(active)applyState(lastState);
    },
    depart({onComplete,reducedMotion:stillness=reducedMotion}={}) {
      if(disposed||!active||!departure.begin(onComplete))return false;
      reducedMotion=stillness;
      player.update({active:true,key:'arrival',reducedMotion});
      applyState(lastState);
      return true;
    },
    get readyForInput(){return active&&presentedReady;},
    getDiagnostics:()=>({...player.getDiagnostics(),state:presentedState,readyForInput:active&&presentedReady,phase:departure.phase,heldFrame:heldFrame.getDiagnostics()}),
    dispose(){disposed=true;departure.dispose();landingGlass.dispose();heldFrame.dispose();player.dispose();host.remove();resume.remove();skip.remove();status.remove();phone.classList.remove('landing-video-active');delete phone.dataset.landingPlayback;delete phone.dataset.landingFrame;delete phone.dataset.landingCue;delete phone.dataset.landingVideoTime;delete phone.dataset.landingPhase;}
  };
}
