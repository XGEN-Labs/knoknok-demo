import { uiIcon } from './ui-icons.mjs?v=20261031-product-sync';
// Voice input is an explicit, user-started browser dictation session. Recognition
// results are held until the session ends, then placed in a draft, never sent.
export function communicationModeMarkup(){return '';}
export function voiceComposerMarkup(){
  return `<button type="button" class="voice-open-button voice-icon-control" data-voice-open aria-label="開始語音輸入">${uiIcon('microphone',{className:'voice-microphone-icon'})}</button><div class="voice-capture-controls" data-voice-capture hidden><button type="button" class="voice-cancel-button voice-icon-control" data-voice-cancel aria-label="取消錄音">${uiIcon('close')}</button><div class="voice-capture-stage"><span data-voice-caption role="status" aria-live="polite"></span></div><button type="button" class="voice-stop-button voice-icon-control" data-voice-stop aria-label="停止錄音並轉錄">${uiIcon('stop')}</button><button type="button" class="voice-finish-button voice-icon-control" data-voice-finish aria-label="完成錄音並轉成文字">${uiIcon('send')}</button></div><span class="voice-input-status" data-voice-status role="status" aria-live="polite"></span>`;
}
export function restoredControlIcon(name){
  return ['profile','visit','more'].includes(name)?uiIcon(name,{className:'nav-icon restored-control-icon'}):'';
}
export function centeredVolumeIcon(muted=false){return uiIcon(muted?'volume-muted':'volume',{className:'nav-icon centered-volume-icon',attributes:`data-speaker-state="${muted?'muted':'sound'}"`});}
export function recognitionLanguage(profileLanguage,host=globalThis.window){
  const value=String(profileLanguage||'').trim();
  const named={'粵語':'zh-HK','粤语':'zh-HK','廣東話':'zh-HK','广东话':'zh-HK','普通話':'zh-CN','普通话':'zh-CN','國語':'zh-TW','国语':'zh-TW','英語':'en-US','英语':'en-US'};
  if(named[value])return named[value];
  if(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(value))return value;
  return host?.navigator?.language||host?.navigator?.languages?.[0]||'zh-CN';
}
export function voiceFailureDetails(code){
  const details={
    unsupported:['此瀏覽器不支援聽寫，請用文字',false],
    'insecure-context':['請從安全連結開啟後使用語音',false],
    'policy-blocked':['此頁未開放麥克風，請用文字',false],
    'not-allowed':['麥克風未獲允許，開放後重試',true],
    'service-not-allowed':['聽寫服務未開放，請用文字',false],
    'audio-capture':['麥克風無法使用，點麥克風重試',true],
    'no-speech':['沒有聽到說話，點麥克風重試',true],
    'no-match':['未能辨認這一句，點麥克風重試',true],
    network:['語音連線失敗，點麥克風重試',true],
    'language-not-supported':['此語言未支援聽寫，請用文字',false],
    'start-timeout':['聽寫未能啟動，點麥克風重試',true],
    'result-timeout':['未收到辨識文字，點麥克風重試',true],
    'finish-timeout':['這次聽寫未完成，點麥克風重試',true],
    'empty-result':['沒有聽寫結果，點麥克風重試',true],
    aborted:['聽寫已中斷，點麥克風重試',true],
    'recognition-busy':['語音尚未結束，請稍後重試',true],
  };
  const [message,canRetry]=details[code]||['聽寫未成功，點麥克風重試',true];
  return{message,canRetry};
}
function microphonePolicy(host){
  const policy=host?.document?.permissionsPolicy||host?.document?.featurePolicy;
  try{return typeof policy?.allowsFeature==='function'?policy.allowsFeature('microphone'):null;}catch{return null;}
}
export function createVoiceInput({window:host=globalThis.window,lang,onState=()=>{},onResult=()=>{},startTimeout=12000,inactivityTimeout=20000,finishTimeout=15000}={}){
  const api=typeof host?.SpeechRecognition==='function'?'SpeechRecognition':typeof host?.webkitSpeechRecognition==='function'?'webkitSpeechRecognition':null;
  const Recognition=api?host[api]:null,supported=Boolean(Recognition);
  let recognizer=null,disposed=false,generation=0,attempt=0,finalTranscript='',startTimer,listenTimer,finishTimer,permissionStatus,permissionChanged;
  let snapshot={supported,status:'idle',message:'',interim:'',transcript:'',errorCode:'',errorName:'',locale:''};
  let diagnostics={attempt:0,api,secureContext:host?.isSecureContext??null,microphonePolicy:microphonePolicy(host),microphonePermission:'unknown',online:host?.navigator?.onLine??null,locale:'',events:[]};
  let began=0;
  const time=()=>host?.performance?.now?.()??Date.now();
  const mark=(type,details={})=>{diagnostics.events.push({type,elapsed:Math.max(0,Math.round(time()-began)),...details});diagnostics.events=diagnostics.events.slice(-30);};
  const emit=patch=>{if(disposed)return;snapshot={...snapshot,...patch};onState({...snapshot});};
  function release(abort=true){
    generation++;clearTimeout(startTimer);clearTimeout(listenTimer);clearTimeout(finishTimer);startTimer=listenTimer=finishTimer=null;
    if(permissionStatus&&permissionChanged)permissionStatus.removeEventListener?.('change',permissionChanged);permissionStatus=permissionChanged=null;
    const old=recognizer;recognizer=null;
    if(old){old.onstart=old.onaudiostart=old.onsoundstart=old.onspeechstart=old.onspeechend=old.onaudioend=old.onresult=old.onnomatch=old.onerror=old.onend=null;if(abort)try{old.abort();}catch{}}
  }
  function fail(code,{status='error',name='',message=''}={}){
    mark('failure',{code,phase:snapshot.status,name});
    diagnostics.failure={code,name,phase:snapshot.status,serviceMessage:String(message).slice(0,240)};
    release();finalTranscript='';
    emit({status,message:voiceFailureDetails(code).message,interim:'',transcript:'',errorCode:code,errorName:name});
  }
  function inspectPermission(currentAttempt){
    const permissions=host?.navigator?.permissions;
    if(typeof permissions?.query!=='function')return;
    // Read-only and nonblocking. Never await this before start(), because doing
    // so could lose the original user gesture on mobile browsers.
    try{Promise.resolve(permissions.query({name:'microphone'})).then(result=>{
      if(disposed||attempt!==currentAttempt)return;
      diagnostics.microphonePermission=['granted','denied','prompt'].includes(result?.state)?result.state:'unknown';
      if(recognizer&&typeof result?.addEventListener==='function'){
        permissionStatus=result;permissionChanged=()=>{
          if(disposed||attempt!==currentAttempt||!recognizer)return;
          diagnostics.microphonePermission=result.state;
          if(result.state==='denied')fail('not-allowed');
        };result.addEventListener('change',permissionChanged);
      }
    }).catch(()=>{});}catch{}
  }
  function start(){
    if(disposed||recognizer)return false;
    began=time();attempt++;diagnostics={attempt,api,secureContext:host?.isSecureContext??null,microphonePolicy:microphonePolicy(host),microphonePermission:'unknown',online:host?.navigator?.onLine??null,locale:'',events:[]};
    mark('requested');
    if(host?.isSecureContext===false){fail('insecure-context',{status:'unsupported'});return false;}
    if(diagnostics.microphonePolicy===false){fail('policy-blocked',{status:'unsupported'});return false;}
    if(!supported){fail('unsupported',{status:'unsupported'});return false;}
    let locale;try{locale=recognitionLanguage(typeof lang==='function'?lang():lang,host);}catch(error){fail('language-config-error',{name:error?.name});return false;}
    diagnostics.locale=locale;inspectPermission(attempt);
    let current;try{current=new Recognition();}catch(error){fail(error?.name==='NotSupportedError'?'unsupported':'construct-failed',{name:error?.name,message:error?.message});return false;}
    recognizer=current;const token=++generation;finalTranscript='';
    const active=()=>!disposed&&generation===token&&recognizer===current;
    try{current.lang=locale;current.continuous=false;current.interimResults=true;current.maxAlternatives=1;}catch(error){fail('configure-failed',{name:error?.name,message:error?.message});return false;}
    const expectResult=()=>{
      clearTimeout(listenTimer);
      listenTimer=setTimeout(()=>{if(active())fail('result-timeout');},inactivityTimeout);
      listenTimer?.unref?.();
    };
    const listening=(type,message)=>{if(!active()||snapshot.status==='processing')return;mark(type);clearTimeout(startTimer);startTimer=null;expectResult();emit({status:'listening',message,interim:snapshot.interim});};
    current.onstart=()=>listening('started','正在聆聽，請說話');
    current.onaudiostart=()=>listening('audio-started','正在聆聽，請說話');
    current.onsoundstart=()=>listening('sound-detected','已收到聲音，請繼續');
    current.onspeechstart=()=>listening('speech-detected','正在辨識你說的話');
    current.onspeechend=()=>{if(active()){mark('speech-ended');stop();}};
    current.onaudioend=()=>{if(active()){mark('audio-ended');processing();}};
    current.onnomatch=()=>{if(active())fail('no-match');};
    current.onresult=event=>{
      if(!active())return;
      let final='',interim='';
      for(let i=0;i<(event.results?.length||0);i++){
        const result=event.results[i],text=String(result?.[0]?.transcript||'');
        if(result?.isFinal)final+=text;else interim+=text;
      }
      finalTranscript=final;mark(final?'final-result':'interim-result');
      clearTimeout(startTimer);startTimer=null;
      if(snapshot.status!=='processing')expectResult();
      emit({status:snapshot.status==='processing'?'processing':'listening',interim,transcript:final,message:snapshot.status==='processing'?'正在轉錄':`${final}${interim}`||'正在聆聽，請說話'});
    };
    current.onerror=event=>{if(active())fail(event.error||'recognition-error',{message:event.message});};
    current.onend=()=>{
      if(!active())return;
      mark('ended');const text=finalTranscript.trim();
      if(!text){fail('empty-result');return;}
      release(false);finalTranscript='';
      onResult(text);emit({status:'ready',message:'已轉成文字，確認後可自行發送。',interim:'',transcript:text,errorCode:'',errorName:''});
    };
    emit({status:'starting',message:'正在開啟麥克風',interim:'',transcript:'',errorCode:'',errorName:'',locale});
    try{
      // Only SpeechRecognition owns the microphone. No second getUserMedia
      // stream, permission prompt, AudioContext or fake waveform is started.
      current.start();
      if(active()&&snapshot.status==='starting'){
        startTimer=setTimeout(()=>{if(active())fail('start-timeout');},startTimeout);
        startTimer?.unref?.();
      }
      return active();
    }catch(error){
      const code=error?.name==='NotAllowedError'?'not-allowed':error?.name==='SecurityError'?'policy-blocked':error?.name==='NotSupportedError'?'unsupported':error?.name==='InvalidStateError'?'recognition-busy':error?.name==='NetworkError'?'network':['NotReadableError','NotFoundError'].includes(error?.name)?'audio-capture':error?.name==='AbortError'?'aborted':'start-failed';
      fail(code,{name:error?.name,message:error?.message});return false;
    }
  }
  function processing(){
    if(!recognizer||disposed||snapshot.status==='processing')return false;
    const token=generation;clearTimeout(startTimer);clearTimeout(listenTimer);startTimer=listenTimer=null;
    emit({status:'processing',message:'正在轉錄'});
    finishTimer=setTimeout(()=>{if(!disposed&&token===generation)fail('finish-timeout');},finishTimeout);
    finishTimer?.unref?.();return true;
  }
  function stop(){
    const current=recognizer;if(!processing())return;
    mark('stop-requested');try{current.stop();}catch(error){fail('stop-failed',{name:error?.name,message:error?.message});}
  }
  function cancel(){mark('cancelled');release();finalTranscript='';emit({status:'idle',message:'',interim:'',transcript:'',errorCode:'',errorName:''});}
  function dispose(){release();finalTranscript='';disposed=true;}
  // Diagnostics contain only API/environment, event names and failure metadata.
  // Recognized words, drafts and audio are never included, persisted or sent.
  return {start,stop,cancel,dispose,getSnapshot:()=>({...snapshot}),getDiagnostics:()=>({...diagnostics,events:diagnostics.events.map(event=>({...event})),failure:diagnostics.failure?{...diagnostics.failure}:undefined})};
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

export function bindVoiceComposer({root,inputSelector='#private-message',window:host=globalThis.window,getDraft=()=>root?.querySelector('#private-message')?.value||'',onDraft=()=>{},onConversationStart=()=>{},onStatus=()=>{},lang,startTimeout,inactivityTimeout,finishTimeout}={}){
  if(!root)return {dispose(){},stop(){},getMode:()=> 'text',setMode(){}};
  const textarea=root.querySelector(inputSelector),capture=root.querySelector('[data-voice-capture]'),caption=root.querySelector('[data-voice-caption]'),status=root.querySelector('[data-voice-status]');
  const openButton=root.querySelector('[data-voice-open]'),stopButton=root.querySelector('[data-voice-stop]'),finishButton=root.querySelector('[data-voice-finish]');
  const defaultPlaceholder=textarea?.placeholder??'';
  let disposed=false,baseDraft='';
  const syncDraft=()=>{root.dataset.hasDraft=String(Boolean(textarea?.value?.trim()));};
  function paint(state){
    if(disposed)return;
    const recording=['starting','listening','processing'].includes(state.status),processing=state.status==='processing',failed=['error','unsupported'].includes(state.status);
    root.dataset.voiceCapture=String(recording);root.dataset.voiceState=state.status;root.dataset.voiceError=state.errorCode||'';root.dataset.voiceFallback=String(failed);
    if(capture)capture.hidden=!recording;
    if(caption){caption.textContent=state.message;caption.setAttribute('title',state.message);}
    if(stopButton)stopButton.disabled=processing||state.status==='starting';
    if(finishButton){finishButton.disabled=processing||state.status==='starting';finishButton.setAttribute('aria-busy',String(processing));}
    if(status)status.textContent=failed?state.message:'';
    // An empty draft presents recovery inside its existing input. The live
    // status remains available to assistive technology without occupying space.
    if(textarea)textarea.placeholder=failed&&!textarea.value.trim()?state.message:defaultPlaceholder;
    if(openButton){openButton.setAttribute('aria-label',failed?'重試語音輸入':'開始語音輸入');openButton.setAttribute('title',failed?state.message:'');}
    syncDraft();onStatus(state);
  }
  const voice=createVoiceInput({window:host,lang,startTimeout,inactivityTimeout,finishTimeout,onState:paint,onResult:text=>{
    const draft=`${baseDraft}${baseDraft&&!/\s$/.test(baseDraft)?' ':''}${text}`.slice(0,1000);
    if(textarea)textarea.value=draft;onDraft(draft);syncDraft();
  }});
  function begin(){
    if(disposed||['starting','listening','processing'].includes(voice.getSnapshot().status))return false;
    baseDraft=String(getDraft()||'');textarea?.blur?.();onConversationStart();return voice.start();
  }
  const click=event=>{
    const button=event.target.closest?.('button[data-voice-open],button[data-voice-cancel],button[data-voice-stop],button[data-voice-finish]');
    if(!button||!root.contains(button))return;
    event.preventDefault();
    if(button.hasAttribute('data-voice-cancel')){voice.cancel();return;}
    if(button.hasAttribute('data-voice-stop')||button.hasAttribute('data-voice-finish')){voice.stop();return;}
    // A second microphone tap retries directly; no modal, tutorial or language
    // sheet interrupts the conversation. Preflight failures remain explicit.
    begin();
  };
  const input=event=>{if(event.target===textarea){if(['error','unsupported'].includes(voice.getSnapshot().status))voice.cancel();syncDraft();}};
  const visibility=()=>{if(root.ownerDocument?.hidden)voice.cancel();};
  root.addEventListener('click',click);root.addEventListener('input',input);root.ownerDocument?.addEventListener('visibilitychange',visibility);
  delete root.dataset.communicationMode;paint(voice.getSnapshot());
  return {start:begin,stop(){voice.cancel();},getSnapshot:voice.getSnapshot,getDiagnostics:voice.getDiagnostics,isCapturing:()=>root.dataset.voiceCapture==='true',getMode:()=>root.dataset.voiceCapture==='true'?'voice':'text',setMode(next){if(next!=='voice')voice.cancel();},dispose(){disposed=true;voice.dispose();root.removeEventListener('click',click);root.removeEventListener('input',input);root.ownerDocument?.removeEventListener('visibilitychange',visibility);}};
}
// Compatibility for the current host integration. There is no top mode switch.
export const bindCommunicationMode=bindVoiceComposer;
