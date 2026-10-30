import { landingVideoSource } from './landing-family-videos.mjs';
import { createLandingVideoPlayer } from './landing-video-player.mjs?v=20261028-opening-audio-68';
import { createLandingHeldFrame } from './landing-held-frame.mjs?v=20261030-avatar-return-85';
import { createLandingGlass } from './landing-glass.mjs?v=20261028-diary-paper-71b';
import { createLandingDeparture } from './landing-departure.mjs?v=20261023-experience-34d';
import { LOADING_CHARACTER_MARKUP } from './loading-state.mjs?v=20261023-experience-34d';
import { LANDING_VIDEO_CUES, LANDING_ARRIVAL_CUE, landingVideoSubtitleAt, landingVideoNokingAt, landingVideoOverlaysPlaying } from './landing-video-cues.mjs?v=20261027-glass-52g';
export { LANDING_VIDEO_CUES, LANDING_ARRIVAL_CUE } from './landing-video-cues.mjs?v=20261027-glass-52g';

export function landingVideoPresentation(next, held, departing = false, hadVisibleFrame = false) {
  const frameFailed = next.state === 'waiting' && held.state === 'unavailable';
  const state = next.state === 'fallback' || frameFailed ? 'error'
    : next.state === 'waiting' && held.state !== 'ready' ? 'settling'
    : next.state === 'playing' && !next.hasPresentedFrame ? 'loading' : next.state;
  const hasFrame = Boolean(hadVisibleFrame || next.hasPresentedFrame || held.captured);
  return {state, readyForInput: !departing && ['waiting','audio-waiting'].includes(state) && next.readyForInput && held.captured && held.state === 'ready',
    gated: ['error','blocked'].includes(state) || (!hasFrame && ['loading','settling','audio-waiting'].includes(state))};
}

export function createLandingVideoScene({phone,familyId=null,onPresentation=()=>{},onMediaChange=()=>{}}={}) {
  if(!phone)throw new TypeError('A phone host is required.');
  const host=document.createElement('div');host.className='landing-video-scene';host.hidden=true;
  const video=document.createElement('video');video.className='landing-video-plate';
  video.setAttribute('aria-hidden','true');video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
  video.muted=true;video.defaultMuted=true;video.playsInline=true;video.preload='auto';video.disablePictureInPicture=true;
  let source=landingVideoSource(familyId);video.src=source;
  const still=document.createElement('canvas');still.className='landing-video-still landing-video-plate';still.setAttribute('aria-hidden','true');
  const subtitle=document.createElement('p');subtitle.className='landing-video-subtitle';subtitle.hidden=true;
  const noking=document.createElement('div');noking.className='landing-video-noking kn-glass-control';noking.hidden=true;
  const nokingLabel=document.createElement('span');nokingLabel.textContent='Noking 中';
  const nokingTrack=document.createElement('span');nokingTrack.className='landing-video-noking-track';nokingTrack.setAttribute('aria-hidden','true');
  noking.append(nokingLabel,nokingTrack);
  const resume=document.createElement('button');resume.type='button';resume.className='landing-video-resume kn-glass-control';resume.textContent='繼續相遇';resume.hidden=true;
  const gate=document.createElement('div');gate.className='landing-video-gate';gate.hidden=true;
  const gateContent=document.createElement('div');gateContent.className='scene-loading-content';
  const gateSymbol=document.createElement('div');gateSymbol.className='scene-loading-symbol';gateSymbol.setAttribute('aria-hidden','true');gateSymbol.innerHTML=LOADING_CHARACTER_MARKUP;
  const gateLabel=document.createElement('p');gateLabel.className='landing-video-gate-label';gateLabel.setAttribute('role','status');gateLabel.setAttribute('aria-live','polite');
  gateContent.append(gateSymbol,gateLabel,resume);gate.append(gateContent);
  const skip=document.createElement('button');skip.type='button';skip.className='landing-video-skip kn-glass-control';skip.textContent='跳過';skip.setAttribute('aria-label','跳過這段影片，開始回答');skip.hidden=true;
  const status=document.createElement('span');status.className='sr-only';status.setAttribute('role','status');
  host.append(video,still,subtitle,noking);phone.prepend(host);phone.append(gate,skip,status);
  let active=false,lastState={state:'inactive',readyForInput:false},disposed=false,reducedMotion=false;
  const departure=createLandingDeparture();
  let presentedState='inactive',presentedReady=false,hasVisibleFrame=false,retainedCapture=false;
  let openingAudioAllowed=true,openingAudioPending=null;
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
  const reportMedia=()=>onMediaChange({active:active&&!disposed,playing:isPlaying(),ready:hasVisibleFrame,time:video.currentTime||0,rate:video.playbackRate||1});
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
    landingGlass.update({active:true,ready:!departing&&['waiting','audio-waiting'].includes(next.state)&&held.captured,key:`frame:${held.targetTime}`});
    hasVisibleFrame=hasVisibleFrame||Boolean(next.hasPresentedFrame||held.captured);
    retainedCapture=retainedCapture||held.captured;
    const presentation=landingVideoPresentation(next,held,departing,hasVisibleFrame);
    presentedState=presentation.state;presentedReady=Boolean(presentation.readyForInput);
    const hasHeldFrame=held.captured&&(['waiting','audio-waiting'].includes(next.state)||held.state==='resuming')
      || retainedCapture&&(presentedState==='error'||!next.hasPresentedFrame&&['loading','settling','blocked'].includes(presentedState));
    host.classList.toggle('has-held-frame',hasHeldFrame);
    host.classList.toggle('is-resuming',hasHeldFrame&&held.state==='resuming');
    phone.dataset.landingPlayback=presentedState;
    phone.dataset.landingFrame=held.state;
    phone.dataset.landingCue=next.key||'';
    phone.dataset.landingVideoTime=Number(next.currentTime||0).toFixed(3);
    gate.hidden=!presentation.gated;gate.dataset.preserveFrame=String(hasVisibleFrame);gate.setAttribute('aria-busy',String(['loading','settling'].includes(presentedState)));
    gateLabel.textContent=presentedState==='error'?'影片暫時未能載入，請重新試一次。':presentedState==='blocked'?'輕觸下方按鈕，繼續這次相遇。':'正在載入相遇影片…';
    resume.hidden=!['blocked','error'].includes(presentedState);
    resume.textContent=presentedState==='error'?'重新載入影片':'繼續相遇';
    skip.hidden=next.state!=='playing'||!next.hasPresentedFrame;
    skip.setAttribute('aria-label',departing?'跳過影片，直接回家':'跳過這段影片，開始回答');
    status.textContent='';
    for(const layer of phone.querySelectorAll('.conversation-onboarding > :is(.onboarding-header,.onboarding-thread,.onboarding-composer)')){
      layer.inert=!presentedReady;
      if(presentedReady)layer.removeAttribute('aria-hidden');else layer.setAttribute('aria-hidden','true');
    }
    syncSubtitle();
    onPresentation({state:presentedState,readyForInput:presentedReady,hasHeldFrame,needsLoading:!hasVisibleFrame&&['loading','settling','audio-waiting'].includes(presentedState),key:next.key,currentTime:video.currentTime||0});reportMedia();
    if(openingAudioPending&&next.state==='audio-waiting'){
      if(held.captured&&held.state==='ready')openingAudioPending.resolveFrame(true);
      else if(held.state==='unavailable')openingAudioPending.resolveFrame(false);
    }
  }
  function applyState(next) {
    lastState=next;if(!active||disposed)return;
    if(next.state!=='fallback')departure.observe(next);
    if(next.state==='audio-waiting')heldFrame.hold({key:`frame:${next.currentTime}`,targetTime:next.currentTime});
    else if(next.state==='waiting'&&next.key!=='arrival')heldFrame.hold({key:`frame:${next.targetTime}`,targetTime:next.targetTime});
    else if(['loading','playing','blocked'].includes(next.state)&&heldFrame.getDiagnostics().captured)heldFrame.resume({startTime:next.startTime,endTime:next.targetTime});
    else heldFrame.release();
    applyPresentation();
  }
  const player=createLandingVideoPlayer({video,cues:[...LANDING_VIDEO_CUES,LANDING_ARRIVAL_CUE],onState:applyState});
  function cancelOpeningAudio({restore=true}={}){
    const pending=openingAudioPending;if(!pending)return;
    openingAudioPending=null;pending.resolveFrame(false);
    if(restore)player.cancelAudioHold(pending.token);
  }
  function holdOpeningForAudio(){
    if(disposed||!active||!openingAudioAllowed||openingAudioPending||lastState.key!=='where'||reducedMotion)return null;
    let resolveFrame;
    const ready=new Promise(resolve=>{resolveFrame=resolve;});
    const pending={token:null,resolveFrame};openingAudioPending=pending;
    pending.token=player.holdForAudio();
    if(!pending.token){cancelOpeningAudio();return null;}
    return {ready,
      replay(){
        if(openingAudioPending!==pending||disposed||!active||lastState.key!=='where')return false;
        openingAudioPending=null;
        const replayed=player.replayCurrent(pending.token);
        if(replayed)openingAudioAllowed=false;
        return replayed;
      },
      cancel(){if(openingAudioPending===pending)cancelOpeningAudio();}
    };
  }
  resume.addEventListener('click',()=>{const restore=lastState.state==='waiting';heldFrame.release();player.retry({restore});applyState(player.getDiagnostics());});
  skip.addEventListener('click',()=>{if(player.skip())status.textContent=departure.pending?'我們回家了。':'影片已跳過，請回答這一題。';});
  return {
    update({active:enabled=false,key='where',familyId:selectedFamily=familyId,reducedMotion:stillness=false,restore=false}={}) {
      if(disposed)return;
      const nextSource=landingVideoSource(selectedFamily);
      if(nextSource!==source){
        cancelOpeningAudio({restore:false});departure.cancel();player.update({active:false});heldFrame.release();
        hasVisibleFrame=false;retainedCapture=false;source=nextSource;video.src=source;video.load();restore=true;
      }
      if(!enabled||key!=='where'||restore||stillness){openingAudioAllowed=false;cancelOpeningAudio({restore:false});}
      reducedMotion=stillness;
      active=enabled;host.hidden=!active;if(!active){departure.cancel();gate.hidden=true;resume.hidden=true;skip.hidden=true;landingGlass.update({active:false});heldFrame.release();host.classList.remove('has-held-frame','is-resuming');presentedState='inactive';presentedReady=false;}phone.classList.toggle('landing-video-active',active);
      if(!active){delete phone.dataset.landingPlayback;delete phone.dataset.landingFrame;delete phone.dataset.landingCue;delete phone.dataset.landingVideoTime;delete phone.dataset.landingPhase;}
      player.update({active,key:departure.phase!=='idle'?'arrival':key,reducedMotion,restore});
      if(active)applyState(lastState);else{syncSubtitle();onPresentation({state:'inactive',readyForInput:false,key:null,currentTime:video.currentTime||0});reportMedia();}
    },
    depart({onComplete,reducedMotion:stillness=reducedMotion}={}) {
      if(disposed||!active||!departure.begin(onComplete))return false;
      openingAudioAllowed=false;cancelOpeningAudio({restore:false});
      reducedMotion=stillness;
      player.update({active:true,key:'arrival',reducedMotion});
      applyState(lastState);
      return true;
    },
    get readyForInput(){return active&&presentedReady;},
    holdOpeningForAudio,cancelOpeningAudio,
    getDiagnostics:()=>({...player.getDiagnostics(),state:presentedState,readyForInput:active&&presentedReady,phase:departure.phase,heldFrame:heldFrame.getDiagnostics()}),
    dispose(){cancelOpeningAudio({restore:false});disposed=true;cancelSubtitleFrame();reportMedia();for(const event of mediaEvents)video.removeEventListener(event,onMediaEvent);departure.dispose();landingGlass.dispose();heldFrame.dispose();player.dispose();host.remove();gate.remove();skip.remove();status.remove();phone.classList.remove('landing-video-active');delete phone.dataset.landingPlayback;delete phone.dataset.landingFrame;delete phone.dataset.landingCue;delete phone.dataset.landingVideoTime;delete phone.dataset.landingPhase;}
  };
}
