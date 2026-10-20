// Voice input is an explicit, user-started browser dictation session. Recognition
// results are held until the session ends, then placed in a draft, never sent.
export function communicationModeMarkup(){return '';}
const iconAssets=Object.freeze({
  microphone:'./assets/ui/microphone.svg',
  'x-mark':'./assets/ui/x-mark.svg',
  stop:'./assets/ui/stop.svg',
  'arrow-up':'./assets/ui/arrow-up.svg',
  'speaker-x-mark':'./assets/ui/speaker-x-mark.svg',
  'speaker-wave':'./assets/ui/speaker-wave.svg',
});
const image=(name,extra='')=>iconAssets[name]?`<img src="${iconAssets[name]}" width="24" height="24" alt="" aria-hidden="true" ${extra}>`:'';
// Exact Heroicons 24 outline paths from the existing MIT-licensed UI assets.
// Inline the two states so muting never depends on loading a second image.
const speakerPaths=Object.freeze({
  sound:'M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z',
  muted:'M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z',
});
const speaker=(muted=false,className='')=>`<svg xmlns="http://www.w3.org/2000/svg" class="${className}" data-speaker-state="${muted?'muted':'sound'}" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="${speakerPaths[muted?'muted':'sound']}"/></svg>`;
export function voiceComposerMarkup(){
  return `<button type="button" class="voice-open-button voice-icon-control" data-voice-open aria-label="開始語音輸入">${image('microphone','class="voice-microphone-icon"')}</button><div class="voice-capture-controls" data-voice-capture hidden><button type="button" class="voice-cancel-button voice-icon-control" data-voice-cancel aria-label="取消錄音">${image('x-mark')}</button><div class="voice-capture-stage"><span data-voice-caption role="status" aria-live="polite"></span></div><button type="button" class="voice-stop-button voice-icon-control" data-voice-stop aria-label="停止錄音並轉錄">${image('stop')}</button><button type="button" class="voice-finish-button voice-icon-control" data-voice-finish aria-label="完成錄音並轉成文字">${image('arrow-up')}</button></div><span class="voice-input-status" data-voice-status role="status" aria-live="polite"></span>`;
}
export function restoredControlIcon(name){
  const source=name==='profile'?'./assets/figma-nav-20261009/nav-profile.svg':name==='visit'?'./assets/figma-nav-20261009/nav-visit.svg':name==='more'?'./assets/ui/ellipsis-horizontal.svg':null;
  return source?`<img class="nav-icon restored-control-icon" src="${source}" width="26" height="26" alt="" aria-hidden="true" draggable="false">`:'';
}
export function centeredVolumeIcon(muted=false){return speaker(muted,'nav-icon centered-volume-icon');}
export function recognitionLanguage(profileLanguage,host=globalThis.window){
  const value=String(profileLanguage||'').trim();
  const named={'粵語':'zh-HK','粤语':'zh-HK','廣東話':'zh-HK','广东话':'zh-HK','普通話':'zh-CN','普通话':'zh-CN','國語':'zh-TW','国语':'zh-TW','英語':'en-US','英语':'en-US'};
  if(named[value])return named[value];
  if(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(value))return value;
  return host?.navigator?.language||host?.navigator?.languages?.[0]||'zh-CN';
}
const voiceErrors={
  'not-allowed':'未取得麥克風權限，仍可使用文字輸入。',
  'service-not-allowed':'此瀏覽器未允許語音辨識，仍可使用文字輸入。',
  'audio-capture':'沒有可用的麥克風，仍可使用文字輸入。',
  'no-speech':'沒有收到清楚的語音，請重試或直接輸入文字。',
  network:'語音辨識暫時無法連線，仍可使用文字輸入。',
  'language-not-supported':'此裝置暫不支援目前的語音語言，仍可使用文字輸入。',
};
export function createVoiceInput({window:host=globalThis.window,lang,onState=()=>{},onResult=()=>{},startTimeout=12000,inactivityTimeout=20000,finishTimeout=15000}={}){
  const Recognition=host?.SpeechRecognition||host?.webkitSpeechRecognition;
  const supported=typeof Recognition==='function';
  let recognizer=null,disposed=false,generation=0,finalTranscript='',startTimer,listenTimer,finishTimer;
  let snapshot={supported,status:'idle',message:'',interim:'',transcript:'',errorCode:''};
  const emit=patch=>{if(disposed)return;snapshot={...snapshot,...patch};onState({...snapshot});};
  function release(abort=true){
    generation++;clearTimeout(startTimer);clearTimeout(listenTimer);clearTimeout(finishTimer);startTimer=listenTimer=finishTimer=null;
    const old=recognizer;recognizer=null;
    if(old){old.onstart=old.onaudiostart=old.onsoundstart=old.onspeechstart=old.onspeechend=old.onaudioend=old.onresult=old.onerror=old.onend=null;if(abort)try{old.abort();}catch{}}
  }
  function start(){
    if(disposed||recognizer)return false;
    if(host?.isSecureContext===false){emit({status:'unsupported',message:'請使用 HTTPS 頁面開啟語音輸入，或直接輸入文字。',interim:'',transcript:'',errorCode:'insecure-context'});return false;}
    if(!supported){emit({status:'unsupported',message:'目前瀏覽器未支援語音轉錄，請直接輸入文字。',interim:'',transcript:'',errorCode:'unsupported'});return false;}
    let current;try{current=new Recognition();}catch{emit({status:'error',message:'無法啟動語音輸入，請直接輸入文字。'});return false;}
    recognizer=current;const token=++generation;finalTranscript='';
    const active=()=>!disposed&&generation===token&&recognizer===current;
    current.lang=recognitionLanguage(typeof lang==='function'?lang():lang,host);
    // One explicit dictation at a time. A separate getUserMedia request would
    // compete for the microphone and is deliberately not started here.
    current.continuous=false;current.interimResults=true;current.maxAlternatives=1;
    const expectResult=()=>{
      clearTimeout(listenTimer);
      listenTimer=setTimeout(()=>{if(!active())return;release();finalTranscript='';emit({status:'error',message:'語音辨識未能完成，原有草稿已保留。請重試或輸入文字。',interim:'',transcript:'',errorCode:'result-timeout'});},inactivityTimeout);
      listenTimer?.unref?.();
    };
    const listening=message=>{if(!active()||snapshot.status==='processing')return;clearTimeout(startTimer);startTimer=null;expectResult();emit({status:'listening',message,interim:snapshot.interim});};
    current.onstart=()=>listening('正在聆聽，請說話');
    current.onaudiostart=()=>listening('正在聆聽，請說話');
    current.onsoundstart=()=>listening('已收到聲音，請繼續');
    current.onspeechstart=()=>listening('正在辨識你說的話');
    current.onspeechend=()=>{if(active())stop();};
    current.onaudioend=()=>{if(active())processing();};
    current.onresult=event=>{
      if(!active())return;
      let final='',interim='';
      for(let i=0;i<(event.results?.length||0);i++){
        const result=event.results[i],text=String(result?.[0]?.transcript||'');
        if(result?.isFinal)final+=text;else interim+=text;
      }
      finalTranscript=final;
      clearTimeout(startTimer);startTimer=null;
      if(snapshot.status!=='processing')expectResult();
      emit({status:snapshot.status==='processing'?'processing':'listening',interim,transcript:final,message:snapshot.status==='processing'?'正在轉錄':`${final}${interim}`||'正在聆聽，請說話'});
    };
    current.onerror=event=>{
      if(!active())return;
      const message=voiceErrors[event.error]||'語音輸入已中止，請重試或直接輸入文字。';
      release();finalTranscript='';emit({status:'error',message,interim:'',transcript:'',errorCode:event.error||'recognition-error'});
    };
    current.onend=()=>{
      if(!active())return;
      const text=finalTranscript.trim();release(false);finalTranscript='';
      if(!text){emit({status:'error',message:'沒有收到可轉錄的語音，原有草稿已保留。',interim:'',transcript:'',errorCode:'empty-result'});return;}
      onResult(text);emit({status:'ready',message:'已轉成文字，確認後可自行發送。',interim:'',transcript:text,errorCode:''});
    };
    emit({status:'starting',message:'正在開啟麥克風',interim:'',transcript:'',errorCode:''});
    try{
      current.start();
      if(active()&&snapshot.status==='starting'){
        startTimer=setTimeout(()=>{if(!active())return;release();finalTranscript='';emit({status:'error',message:'瀏覽器未能啟動語音辨識。請檢查麥克風與語音辨識權限，再重試。',interim:'',transcript:'',errorCode:'start-timeout'});},startTimeout);
        startTimer?.unref?.();
      }
      return true;
    }catch{release();emit({status:'error',message:'無法啟動語音輸入，請重試或直接輸入文字。'});return false;}
  }
  function processing(){
    if(!recognizer||disposed||snapshot.status==='processing')return false;
    const token=generation;clearTimeout(startTimer);clearTimeout(listenTimer);startTimer=listenTimer=null;
    emit({status:'processing',message:'正在轉錄'});
    // The timeout reports a real unfinished session; it never invents a result.
    finishTimer=setTimeout(()=>{if(disposed||token!==generation)return;release();finalTranscript='';emit({status:'error',message:'轉錄未能完成，原有草稿已保留。請重試或輸入文字。',interim:'',transcript:'',errorCode:'finish-timeout'});},finishTimeout);
    finishTimer?.unref?.();
    return true;
  }
  function stop(){
    const current=recognizer;if(!processing())return;
    try{current.stop();}catch{release();finalTranscript='';emit({status:'error',message:'未能完成轉錄，原有草稿已保留。',interim:'',transcript:''});}
  }
  function cancel(){release();finalTranscript='';emit({status:'idle',message:'',interim:'',transcript:'',errorCode:''});}
  function dispose(){release();finalTranscript='';disposed=true;}
  return {start,stop,cancel,dispose,getSnapshot:()=>({...snapshot})};
}

// Draw only microphone samples obtained from getUserMedia + AnalyserNode. When
// unavailable, the UI shows the actual recognition state rather than fake bars.
export function createAudioMeter({window:host=globalThis.window,canvas,onAvailability=()=>{},onSamples=()=>{}}={}){
  let resource=null,disposed=false;
  const stopTracks=stream=>{for(const track of stream?.getTracks?.()||[])try{track.stop();}catch{}};
  const closeContext=context=>{try{Promise.resolve(context?.close?.()).catch(()=>{});}catch{}};
  function stop(){
    const old=resource;resource=null;
    if(old){if(old.frame!=null)host?.cancelAnimationFrame?.(old.frame);try{old.source?.disconnect?.();old.analyser?.disconnect?.();}catch{}stopTracks(old.stream);closeContext(old.context);}
    if(!disposed)onAvailability(false);
  }
  async function start(){
    if(disposed)return false;stop();
    const AudioContext=host?.AudioContext||host?.webkitAudioContext;
    const media=host?.navigator?.mediaDevices;
    if(typeof AudioContext!=='function'||!media?.getUserMedia)return false;
    const current={context:null,stream:null,source:null,analyser:null,frame:null};resource=current;
    try{
      current.context=new AudioContext();
      const resume=Promise.resolve(current.context.resume?.()).catch(()=>{});
      const stream=await media.getUserMedia({audio:true});
      if(disposed||resource!==current){stopTracks(stream);closeContext(current.context);return false;}
      current.stream=stream;await resume;
      if(disposed||resource!==current)return false;
      const analyser=current.analyser=current.context.createAnalyser();analyser.fftSize=512;
      current.source=current.context.createMediaStreamSource(stream);current.source.connect(analyser);
      const samples=new Uint8Array(analyser.frequencyBinCount),drawing=canvas?.getContext?.('2d');
      const paint=()=>{
        if(disposed||resource!==current)return;
        analyser.getByteTimeDomainData(samples);onSamples(samples.slice());
        if(drawing){const width=canvas.width,height=canvas.height;drawing.clearRect(0,0,width,height);drawing.lineWidth=2;drawing.strokeStyle='#29272e';drawing.beginPath();for(let i=0;i<samples.length;i++){const x=i*width/(samples.length-1),y=height/2+(samples[i]/128-1)*height*.44;if(i===0)drawing.moveTo(x,y);else drawing.lineTo(x,y);}drawing.stroke();}
        current.frame=host?.requestAnimationFrame?.(paint)??null;
      };
      onAvailability(true);paint();return true;
    }catch{
      if(resource===current)stop();else closeContext(current.context);
      return false;
    }
  }
  return {start,stop,dispose(){stop();disposed=true;}};
}

export function bindVoiceComposer({root,window:host=globalThis.window,getDraft=()=>root?.querySelector('#private-message')?.value||'',onDraft=()=>{},onConversationStart=()=>{},onStatus=()=>{},lang,startTimeout,inactivityTimeout,finishTimeout}={}){
  if(!root)return {dispose(){},stop(){},getMode:()=> 'text',setMode(){}};
  const textarea=root.querySelector('#private-message'),capture=root.querySelector('[data-voice-capture]'),caption=root.querySelector('[data-voice-caption]'),status=root.querySelector('[data-voice-status]');
  const originalPlaceholder=textarea?.getAttribute?.('placeholder')??textarea?.placeholder??'';
  const stopButton=root.querySelector('[data-voice-stop]'),finishButton=root.querySelector('[data-voice-finish]');
  let disposed=false,baseDraft='';
  const syncDraft=()=>{root.dataset.hasDraft=String(Boolean(textarea?.value?.trim()));};
  function paint(state){
    if(disposed)return;
    const recording=['starting','listening','processing'].includes(state.status),processing=state.status==='processing';
    root.dataset.voiceCapture=String(recording);root.dataset.voiceState=state.status;root.dataset.voiceError=state.errorCode||'';
    if(capture)capture.hidden=!recording;
    if(caption){caption.textContent=state.message;caption.setAttribute('title',state.message);}
    if(stopButton)stopButton.disabled=processing||state.status==='starting';
    if(finishButton){finishButton.disabled=processing||state.status==='starting';finishButton.setAttribute('aria-busy',String(processing));}
    if(status)status.textContent=['error','unsupported'].includes(state.status)?state.message:'';
    const failed=['error','unsupported'].includes(state.status);root.dataset.voiceFallback=String(failed);
    if(textarea)textarea.placeholder=failed?'語音暫不可用，請輸入文字':originalPlaceholder;
    syncDraft();onStatus(state);
  }
  const voice=createVoiceInput({window:host,lang,startTimeout,inactivityTimeout,finishTimeout,onState:paint,onResult:text=>{
    const draft=`${baseDraft}${baseDraft&&!/\s$/.test(baseDraft)?' ':''}${text}`.slice(0,1000);
    if(textarea)textarea.value=draft;onDraft(draft);syncDraft();
  }});
  function begin(){
    if(disposed)return false;
    baseDraft=String(getDraft()||'');textarea?.blur?.();onConversationStart();
    return voice.start();
  }
  const click=event=>{
    const button=event.target.closest?.('button[data-voice-open],button[data-voice-cancel],button[data-voice-stop],button[data-voice-finish]');
    if(!button||!root.contains(button))return;
    event.preventDefault();
    if(button.hasAttribute('data-voice-cancel')){voice.cancel();return;}
    if(button.hasAttribute('data-voice-stop')||button.hasAttribute('data-voice-finish')){voice.stop();return;}
    begin();
  };
  const input=event=>{if(event.target===textarea){textarea.placeholder=originalPlaceholder;root.dataset.voiceFallback='false';if(status)status.textContent='';syncDraft();}};
  const visibility=()=>{if(root.ownerDocument?.hidden)voice.cancel();};
  root.addEventListener('click',click);root.addEventListener('input',input);root.ownerDocument?.addEventListener('visibilitychange',visibility);
  delete root.dataset.communicationMode;paint(voice.getSnapshot());
  return {start:begin,stop(){voice.cancel();},getSnapshot:voice.getSnapshot,isCapturing:()=>root.dataset.voiceCapture==='true',getMode:()=>root.dataset.voiceCapture==='true'?'voice':'text',setMode(next){if(next!=='voice')voice.cancel();},dispose(){disposed=true;voice.dispose();root.removeEventListener('click',click);root.removeEventListener('input',input);root.ownerDocument?.removeEventListener('visibilitychange',visibility);}};
}
// Compatibility for the current host integration. There is no top mode switch.
export const bindCommunicationMode=bindVoiceComposer;
