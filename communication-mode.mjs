// Voice input is an explicit, user-started browser dictation session. Recognition
// results are held until the session ends, then placed in a draft, never sent.
export function communicationModeMarkup(){return '';}
const iconAssets=Object.freeze({
  'audio-lines':'./assets/ui/audio-lines.svg',
  'x-mark':'./assets/ui/x-mark.svg',
  stop:'./assets/ui/stop.svg',
  'arrow-up':'./assets/ui/arrow-up.svg',
  'speaker-x-mark':'./assets/ui/speaker-x-mark.svg',
  'speaker-wave':'./assets/ui/speaker-wave.svg',
});
const image=(name,extra='')=>iconAssets[name]?`<img src="${iconAssets[name]}" width="24" height="24" alt="" aria-hidden="true" ${extra}>`:'';
export function voiceComposerMarkup(){
  return `<button type="button" class="voice-open-button voice-icon-control" data-voice-open aria-label="開始語音輸入">${image('audio-lines')}</button><div class="voice-capture-controls" data-voice-capture hidden><button type="button" class="voice-cancel-button voice-icon-control" data-voice-cancel aria-label="取消錄音">${image('x-mark')}</button><div class="voice-capture-stage"><canvas data-voice-meter width="320" height="40" aria-hidden="true" hidden></canvas><span data-voice-caption role="status" aria-live="polite"></span></div><button type="button" class="voice-stop-button voice-icon-control" data-voice-stop aria-label="停止錄音並轉錄">${image('stop')}</button><button type="button" class="voice-finish-button voice-icon-control" data-voice-finish aria-label="完成錄音並轉成文字">${image('arrow-up')}</button></div><span class="voice-input-status" data-voice-status role="status" aria-live="polite"></span>`;
}
export function restoredControlIcon(name){
  const source=name==='profile'?'./assets/figma-nav-20261009/nav-profile.svg':name==='visit'?'./assets/figma-nav-20261009/nav-visit.svg':name==='more'?'./assets/ui/ellipsis-horizontal.svg':null;
  return source?`<img class="nav-icon restored-control-icon" src="${source}" width="26" height="26" alt="" aria-hidden="true" draggable="false">`:'';
}
export function centeredVolumeIcon(muted=false){return image(muted?'speaker-x-mark':'speaker-wave','class="nav-icon centered-volume-icon"');}
const voiceErrors={
  'not-allowed':'未取得麥克風權限，仍可使用文字輸入。',
  'service-not-allowed':'此瀏覽器未允許語音辨識，仍可使用文字輸入。',
  'audio-capture':'沒有可用的麥克風，仍可使用文字輸入。',
  'no-speech':'沒有收到清楚的語音，請重試或直接輸入文字。',
  network:'語音辨識暫時無法連線，仍可使用文字輸入。',
  'language-not-supported':'此裝置暫不支援目前的語音語言，仍可使用文字輸入。',
};
export function createVoiceInput({window:host=globalThis.window,lang='zh-HK',onState=()=>{},onResult=()=>{},finishTimeout=15000}={}){
  const Recognition=host?.SpeechRecognition||host?.webkitSpeechRecognition;
  const supported=typeof Recognition==='function';
  let recognizer=null,disposed=false,generation=0,finalTranscript='',finishTimer;
  let snapshot={supported,status:'idle',message:'',interim:'',transcript:''};
  const emit=patch=>{if(disposed)return;snapshot={...snapshot,...patch};onState({...snapshot});};
  function release(abort=true){
    generation++;clearTimeout(finishTimer);finishTimer=null;
    const old=recognizer;recognizer=null;
    if(old){old.onstart=old.onresult=old.onerror=old.onend=null;if(abort)try{old.abort();}catch{}}
  }
  function start(){
    if(disposed||recognizer)return false;
    if(!supported){emit({status:'unsupported',message:'目前瀏覽器未支援語音轉錄，請直接輸入文字。',interim:'',transcript:''});return false;}
    let current;try{current=new Recognition();}catch{emit({status:'error',message:'無法啟動語音輸入，請直接輸入文字。'});return false;}
    recognizer=current;const token=++generation;finalTranscript='';
    const active=()=>!disposed&&generation===token&&recognizer===current;
    current.lang=lang;current.continuous=true;current.interimResults=true;current.maxAlternatives=1;
    current.onstart=()=>{if(active())emit({status:'listening',message:'正在聆聽',interim:''});};
    current.onresult=event=>{
      if(!active())return;
      let final='',interim='';
      for(let i=0;i<(event.results?.length||0);i++){
        const result=event.results[i],text=String(result?.[0]?.transcript||'');
        if(result?.isFinal)final+=text;else interim+=text;
      }
      finalTranscript=final;
      emit({interim,message:snapshot.status==='processing'?'正在轉錄':interim||'正在聆聽'});
    };
    current.onerror=event=>{
      if(!active())return;
      const message=voiceErrors[event.error]||'語音輸入已中止，請重試或直接輸入文字。';
      release();finalTranscript='';emit({status:'error',message,interim:'',transcript:''});
    };
    current.onend=()=>{
      if(!active())return;
      const text=finalTranscript.trim();release(false);finalTranscript='';
      if(!text){emit({status:'error',message:'沒有收到可轉錄的語音，原有草稿已保留。',interim:'',transcript:''});return;}
      onResult(text);emit({status:'ready',message:'已轉成文字，確認後可自行發送。',interim:'',transcript:text});
    };
    emit({status:'starting',message:'正在開啟麥克風',interim:'',transcript:''});
    try{current.start();return true;}catch{release();emit({status:'error',message:'無法啟動語音輸入，請重試或直接輸入文字。'});return false;}
  }
  function stop(){
    if(!recognizer||disposed||snapshot.status==='processing')return;
    const current=recognizer,token=generation;
    emit({status:'processing',message:'正在轉錄',interim:''});
    // The timeout reports a real unfinished session; it never invents a result.
    finishTimer=setTimeout(()=>{if(disposed||token!==generation)return;release();finalTranscript='';emit({status:'error',message:'轉錄未能完成，原有草稿已保留。請重試或輸入文字。',interim:'',transcript:''});},finishTimeout);
    finishTimer?.unref?.();
    try{current.stop();}catch{release();finalTranscript='';emit({status:'error',message:'未能完成轉錄，原有草稿已保留。',interim:'',transcript:''});}
  }
  function cancel(){release();finalTranscript='';emit({status:'idle',message:'',interim:'',transcript:''});}
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

export function bindVoiceComposer({root,window:host=globalThis.window,getDraft=()=>root?.querySelector('#private-message')?.value||'',onDraft=()=>{},onConversationStart=()=>{},onStatus=()=>{},lang='zh-HK'}={}){
  if(!root)return {dispose(){},stop(){},getMode:()=> 'text',setMode(){}};
  const textarea=root.querySelector('#private-message'),capture=root.querySelector('[data-voice-capture]'),caption=root.querySelector('[data-voice-caption]'),canvas=root.querySelector('[data-voice-meter]'),status=root.querySelector('[data-voice-status]');
  const originalPlaceholder=textarea?.getAttribute?.('placeholder')??textarea?.placeholder??'';
  const stopButton=root.querySelector('[data-voice-stop]'),finishButton=root.querySelector('[data-voice-finish]');
  let disposed=false,baseDraft='',meterActive=false;
  const syncDraft=()=>{root.dataset.hasDraft=String(Boolean(textarea?.value?.trim()));};
  const meter=createAudioMeter({window:host,canvas,onAvailability:active=>{if(disposed)return;meterActive=active;if(canvas)canvas.hidden=!active;if(caption)caption.classList.toggle('voice-caption-with-meter',active);}});
  function paint(state){
    if(disposed)return;
    const recording=['starting','listening','processing'].includes(state.status),processing=state.status==='processing';
    root.dataset.voiceCapture=String(recording);root.dataset.voiceState=state.status;
    if(capture)capture.hidden=!recording;
    if(caption){caption.textContent=state.message;caption.classList.toggle('voice-caption-with-meter',meterActive&&!processing);}
    if(canvas)canvas.hidden=!meterActive||processing;
    if(stopButton)stopButton.disabled=processing||state.status==='starting';
    if(finishButton){finishButton.disabled=processing||state.status==='starting';finishButton.setAttribute('aria-busy',String(processing));}
    if(status)status.textContent=['error','unsupported'].includes(state.status)?state.message:'';
    if(textarea)textarea.placeholder=['error','unsupported'].includes(state.status)?'語音暫不可用，請輸入文字':originalPlaceholder;
    if(!['starting','listening'].includes(state.status))meter.stop();
    syncDraft();onStatus(state);
  }
  const voice=createVoiceInput({window:host,lang,onState:paint,onResult:text=>{
    const draft=`${baseDraft}${baseDraft&&!/\s$/.test(baseDraft)?' ':''}${text}`.slice(0,1000);
    if(textarea)textarea.value=draft;onDraft(draft);syncDraft();
  }});
  function begin(){
    if(disposed)return false;
    baseDraft=String(getDraft()||'');textarea?.blur?.();onConversationStart();
    const started=voice.start();if(started)void meter.start();return started;
  }
  const click=event=>{
    const button=event.target.closest?.('button[data-voice-open],button[data-voice-cancel],button[data-voice-stop],button[data-voice-finish]');
    if(!button||!root.contains(button))return;
    event.preventDefault();
    if(button.hasAttribute('data-voice-cancel')){voice.cancel();meter.stop();return;}
    if(button.hasAttribute('data-voice-stop')||button.hasAttribute('data-voice-finish')){voice.stop();meter.stop();return;}
    begin();
  };
  const input=event=>{if(event.target===textarea){textarea.placeholder=originalPlaceholder;if(status)status.textContent='';syncDraft();}};
  const visibility=()=>{if(root.ownerDocument?.hidden){voice.cancel();meter.stop();}};
  root.addEventListener('click',click);root.addEventListener('input',input);root.ownerDocument?.addEventListener('visibilitychange',visibility);
  delete root.dataset.communicationMode;paint(voice.getSnapshot());
  return {start:begin,stop(){voice.cancel();meter.stop();},getMode:()=>root.dataset.voiceCapture==='true'?'voice':'text',setMode(next){if(next!=='voice'){voice.cancel();meter.stop();}},dispose(){disposed=true;voice.dispose();meter.dispose();root.removeEventListener('click',click);root.removeEventListener('input',input);root.ownerDocument?.removeEventListener('visibilitychange',visibility);}};
}
// Compatibility for the current host integration. There is no top mode switch.
export const bindCommunicationMode=bindVoiceComposer;
