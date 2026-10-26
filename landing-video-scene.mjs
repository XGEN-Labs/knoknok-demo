import { createLandingVideoPlayer } from './landing-video-player.mjs?v=20261023-experience-34d';
import { createLandingHeldFrame } from './landing-held-frame.mjs?v=20261023-experience-34d';
import { createLandingGlass } from './landing-glass.mjs?v=20261023-experience-34d';
import { createLandingDeparture } from './landing-departure.mjs?v=20261023-experience-34d';
import { LANDING_VIDEO_CUES, LANDING_ARRIVAL_CUE, landingVideoSubtitleAt, landingVideoNokingAt, landingVideoOverlaysPlaying } from './landing-video-cues.mjs?v=20261026-answers-47';
export { LANDING_VIDEO_CUES, LANDING_ARRIVAL_CUE } from './landing-video-cues.mjs?v=20261026-answers-47';

export function createLandingVideoScene({phone,onPresentation=()=>{},onMediaChange=()=>{}}={}) {
  if(!phone)throw new TypeError('A phone host is required.');
  const host=document.createElement('div');host.className='landing-video-scene';host.hidden=true;
  const video=document.createElement('video');video.className='landing-video-plate';
  video.setAttribute('aria-hidden','true');video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
  video.muted=true;video.defaultMuted=true;video.playsInline=true;video.preload='auto';video.disablePictureInPicture=true;
  video.src='assets/landing-20261026-47/21-complete-native-mouth-clean.mp4';
  const still=document.createElement('canvas');still.className='landing-video-still landing-video-plate';still.setAttribute('aria-hidden','true');
  const subtitle=document.createElement('p');subtitle.className='landing-video-subtitle';subtitle.hidden=true;
  const noking=document.createElement('div');noking.className='landing-video-noking kn-glass-control';noking.hidden=true;
  const nokingLabel=document.createElement('span');nokingLabel.textContent='Noking 中';
  const nokingTrack=document.createElement('span');nokingTrack.className='landing-video-noking-track';nokingTrack.setAttribute('aria-hidden','true');
  noking.append(nokingLabel,nokingTrack);
  const resume=document.createElement('button');resume.type='button';resume.className='landing-video-resume kn-glass-control';resume.textContent='繼續相遇';resume.hidden=true;
  const skip=document.createElement('button');skip.type='button';skip.className='landing-video-skip kn-glass-control';skip.textContent='跳過';skip.setAttribute('aria-label','跳過這段影片，開始回答');skip.hidden=true;
  const status=document.createElement('span');status.className='sr-only';status.setAttribute('role','status');
  host.append(video,still,subtitle,noking);phone.prepend(host);phone.append(resume,skip,status);
  let active=false,lastState={state:'inactive',readyForInput:false},disposed=false,reducedMotion=false;
  const departure=createLandingDeparture();
  let presentedState='inactive',presentedReady=false;
  let subtitleFrame=null,subtitleFrameKind='';
  const isPlaying=()=>landingVideoOverlaysPlaying({active,disposed,state:presentedState,paused:video.paused,seeking:video.seeking,readyState:video.readyState});
  function cancelSubtitleFrame(){
    if(subtitleFrame!==null){
      if(subtitleFrameKind==='video')video.cancelVideoFrameCallback?.(subtitleFrame);
      else globalThis.cancelAnimationFrame?.(subtitleFrame);
    }
    subtitleFrame=null;subtitleFrameKind='';
  }
  function syncSubtitle(){
    const playing=isPlaying(),cue=landingVideoSubtitleAt(video.currentTime,{playing});
    const nokingState=landingVideoNokingAt(video.currentTime,{playing});
    subtitle.hidden=!cue;
    if(subtitle.textContent!==(cue?.text||''))subtitle.textContent=cue?.text||'';
    noking.hidden=!nokingState;
    noking.style.setProperty('--landing-noking-progress',String(nokingState?.progress||0));
    if(active)phone.dataset.landingVideoTime=Number(video.currentTime||0).toFixed(3);
    if(!playing){cancelSubtitleFrame();return;}
    if(subtitleFrame!==null)return;
    const next=()=>{subtitleFrame=null;subtitleFrameKind='';syncSubtitle();};
    if(typeof video.requestVideoFrameCallback==='function'){
      subtitleFrameKind='video';subtitleFrame=video.requestVideoFrameCallback(next);
    }else if(typeof globalThis.requestAnimationFrame==='function'){
      subtitleFrameKind='animation';subtitleFrame=globalThis.requestAnimationFrame(next);
    }
  }
  const reportMedia=()=>onMediaChange({active:active&&!disposed,playing:isPlaying(),time:video.currentTime||0,rate:video.playbackRate||1});
  const mediaEvents=['timeupdate','playing','pause','waiting','seeking','seeked','ratechange','ended'];
  const onMediaEvent=()=>{syncSubtitle();reportMedia();};
  for(const event of mediaEvents)video.addEventListener(event,onMediaEvent);
  const landingGlass=createLandingGlass({phone,sourceCanvas:still});
  const heldFrame=createLandingHeldFrame({video,canvas:still,frameRate:24,onSettled:()=>applyPresentation()});
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
    presentedReady=!departing&&(presentedState==='fallback'||(next.readyForInput&&held.captured&&held.state==='ready'));
    const hasHeldFrame=held.captured&&(next.state==='waiting'||held.state==='resuming');
    host.classList.toggle('has-held-frame',hasHeldFrame);
    host.classList.toggle('is-resuming',hasHeldFrame&&held.state==='resuming');
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
    syncSubtitle();
    onPresentation({state:presentedState,readyForInput:presentedReady,hasHeldFrame,key:next.key,currentTime:video.currentTime||0});reportMedia();
  }
  function applyState(next) {
    lastState=next;if(!active||disposed)return;
    departure.observe(next);
    if(next.state==='waiting'&&next.key!=='arrival')heldFrame.hold({key:`frame:${next.targetTime}`,targetTime:next.targetTime});
    else if(['loading','playing','blocked'].includes(next.state)&&heldFrame.getDiagnostics().captured)heldFrame.resume({startTime:next.startTime,endTime:next.targetTime});
    else heldFrame.release();
    applyPresentation();
  }
  const player=createLandingVideoPlayer({video,cues:[...LANDING_VIDEO_CUES,LANDING_ARRIVAL_CUE],onState:applyState});
  resume.addEventListener('click',()=>player.retry());
  skip.addEventListener('click',()=>{if(player.skip())status.textContent=departure.pending?'我們回家了。':'影片已跳過，請回答這一題。';});
  return {
    update({active:enabled=false,key='where',reducedMotion:stillness=false,restore=false}={}) {
      if(disposed)return;
      reducedMotion=stillness;
      active=enabled;host.hidden=!active;if(!active){departure.cancel();resume.hidden=true;skip.hidden=true;landingGlass.update({active:false});heldFrame.release();host.classList.remove('has-held-frame','is-resuming');presentedState='inactive';presentedReady=false;}phone.classList.toggle('landing-video-active',active);
      if(!active){delete phone.dataset.landingPlayback;delete phone.dataset.landingFrame;delete phone.dataset.landingCue;delete phone.dataset.landingVideoTime;delete phone.dataset.landingPhase;}
      player.update({active,key:departure.phase!=='idle'?'arrival':key,reducedMotion,restore});
      if(active)applyState(lastState);else{syncSubtitle();onPresentation({state:'inactive',readyForInput:false,key:null,currentTime:video.currentTime||0});reportMedia();}
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
    dispose(){disposed=true;cancelSubtitleFrame();reportMedia();for(const event of mediaEvents)video.removeEventListener(event,onMediaEvent);departure.dispose();landingGlass.dispose();heldFrame.dispose();player.dispose();host.remove();resume.remove();skip.remove();status.remove();phone.classList.remove('landing-video-active');delete phone.dataset.landingPlayback;delete phone.dataset.landingFrame;delete phone.dataset.landingCue;delete phone.dataset.landingVideoTime;delete phone.dataset.landingPhase;}
  };
}
