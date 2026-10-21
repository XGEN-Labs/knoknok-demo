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
const voiceHelpMarkup=()=>`<section class="voice-help-panel kn-glass-control" data-voice-help role="dialog" aria-label="語音輸入說明" hidden><div class="voice-help-heading"><h3 data-voice-help-title>語音輸入</h3><button type="button" class="voice-icon-control" data-voice-help-close aria-label="關閉語音說明">${image('x-mark')}</button></div><div class="voice-help-content"><p data-voice-help-message></p><p class="voice-help-guide" data-voice-help-guide></p><label class="voice-help-language" data-voice-language-label>本次聽寫語言<select data-voice-language aria-label="本次聽寫語言"><option value="">跟隨個人資料</option><option value="zh-CN">普通話</option><option value="zh-HK">粵語</option><option value="en-US">英語</option></select></label><p class="voice-help-keyboard" data-voice-keyboard-guide></p></div><div class="voice-help-actions"><button type="button" class="kn-glass-control" data-voice-retry>重試語音</button><button type="button" class="kn-glass-control" data-voice-use-text>返回文字</button></div></section>`;
// Exact Heroicons 24 outline paths from the existing MIT-licensed UI assets.
// Inline the two states so muting never depends on loading a second image.
const speakerPaths=Object.freeze({
  sound:'M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z',
  muted:'M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z',
});
const speaker=(muted=false,className='')=>`<svg xmlns="http://www.w3.org/2000/svg" class="${className}" data-speaker-state="${muted?'muted':'sound'}" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="${speakerPaths[muted?'muted':'sound']}"/></svg>`;
export function voiceComposerMarkup(){
  return `<button type="button" class="voice-open-button voice-icon-control" data-voice-open aria-label="開始語音輸入" aria-expanded="false">${image('microphone','class="voice-microphone-icon"')}</button><div class="voice-capture-controls" data-voice-capture hidden><button type="button" class="voice-cancel-button voice-icon-control" data-voice-cancel aria-label="取消錄音">${image('x-mark')}</button><div class="voice-capture-stage"><span data-voice-caption role="status" aria-live="polite"></span></div><button type="button" class="voice-stop-button voice-icon-control" data-voice-stop aria-label="停止錄音並轉錄">${image('stop')}</button><button type="button" class="voice-finish-button voice-icon-control" data-voice-finish aria-label="完成錄音並轉成文字">${image('arrow-up')}</button></div><span class="voice-input-status" data-voice-status role="status" aria-live="polite"></span>${voiceHelpMarkup()}`;
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
export function voiceFailureDetails(code){
  const details={
    unsupported:['此瀏覽器沒有聽寫功能','瀏覽器不支援聽寫，點麥克風查看','這個瀏覽器沒有提供網頁聽寫功能。','如正在應用程式內開啟，可嘗試在 Safari 單獨開啟此頁；也可使用系統鍵盤聽寫。',false],
    'insecure-context':['請從安全頁面開啟','請從安全頁面使用聽寫','目前頁面不是安全連線，瀏覽器不能在這裡使用語音輸入。','請從正式預覽連結開啟此頁，再使用語音；也可以返回文字輸入。',false],
    'policy-blocked':['此頁未開放麥克風','此頁未開放語音，點麥克風查看','目前頁面或內嵌預覽不允許使用麥克風。','請在 Safari 單獨開啟正式頁面；如果仍不可用，可使用系統鍵盤聽寫。',false],
    'not-allowed':['語音權限未開放','未允許麥克風，點麥克風查看','瀏覽器沒有允許這次語音輸入，可能與網站或系統的權限設定有關。','在 Safari 的頁面選單查看「網站設定」，允許麥克風後重試；也請檢查 iPhone 的語音辨識權限。',true],
    'service-not-allowed':['瀏覽器未開放語音辨識','瀏覽器未開放聽寫，點麥克風查看','瀏覽器拒絕啟動語音辨識服務；這和是否聽到你的聲音是不同的問題。','可檢查 iPhone 是否已啟用 Siri 或聽寫。如在應用程式內開啟，可嘗試 Safari；或使用系統鍵盤聽寫。',false],
    'audio-capture':['未能使用麥克風','未能使用麥克風，點一下查看','瀏覽器未能取得麥克風音訊。','請檢查麥克風權限、耳機連線，並結束可能佔用麥克風的通話，再重試。',true],
    'no-speech':['沒有聽到清楚的說話','沒有聽到說話，點麥克風重試','這次辨識沒有偵測到清楚的說話。','等畫面顯示正在聆聽後，再靠近麥克風說一句完整的話。',true],
    'no-match':['這一句未能辨認','未能辨認，點麥克風查看','辨識服務沒有把這次聲音轉成可用的文字。','請選擇你正在說的語言，再用一句短句重試。',true],
    network:['語音服務未能連線','聽寫服務未連線，點麥克風查看','這次語音辨識所需的連線沒有完成。網頁能打開，也不代表語音服務能連上。','請檢查網絡後重試。若持續失敗，可以返回文字並使用系統鍵盤聽寫。',true],
    'language-not-supported':['這個語言暫未支援','聽寫語言未支援，點麥克風查看','裝置的語音辨識服務不支援目前選擇的語言。','請在下方明確選擇另一種本次聽寫語言後再試，或使用系統鍵盤聽寫。',false],
    'start-timeout':['語音服務沒有啟動','聽寫未能啟動，點麥克風查看','瀏覽器沒有回報語音服務已開始，這次沒有完成錄音或轉寫。','請確認麥克風與語音辨識權限；也可檢查 Siri 或聽寫是否啟用，再重試。',true],
    'result-timeout':['未收到辨識文字','未收到聽寫文字，點麥克風查看','語音服務已啟動，但未能在這次等待中完成文字辨識。','請檢查語言及網絡後重試。若持續失敗，可重新開啟頁面或使用系統鍵盤聽寫。',true],
    'finish-timeout':['這次聽寫未能完成','聽寫未完成，點麥克風查看','停止後仍未收到完整的辨識結果；原有草稿已保留。','請重試一句短句；若持續失敗，可以使用系統鍵盤聽寫。',true],
    'empty-result':['沒有收到完成的文字','沒有聽寫結果，點麥克風查看','這次語音服務已結束，但沒有提供完成的文字；原有草稿已保留。','請確認本次聽寫語言，等正在聆聽後再說話，或使用系統鍵盤聽寫。',true],
    aborted:['語音輸入被中斷','聽寫已中斷，點麥克風查看','瀏覽器或系統中斷了這次語音輸入，原有草稿已保留。','請留在目前頁面，用一句短句重試。',true],
    'recognition-busy':['上一段語音尚未結束','語音仍在結束，請稍後重試','瀏覽器還未能開始另一段語音。','稍候再點「重試語音」，或重新開啟頁面。',true],
  };
  const [title,placeholder,message,guide,canRetry]=details[code]||['未能啟動這次聽寫','聽寫未成功，點麥克風查看','瀏覽器未能完成這次聽寫，原有草稿已保留。','可以重試；若仍失敗，請使用系統鍵盤聽寫或直接輸入文字。',true];
  return{title,placeholder,message,guide,canRetry};
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

export function bindVoiceComposer({root,window:host=globalThis.window,getDraft=()=>root?.querySelector('#private-message')?.value||'',onDraft=()=>{},onConversationStart=()=>{},onStatus=()=>{},lang,startTimeout,inactivityTimeout,finishTimeout}={}){
  if(!root)return {dispose(){},stop(){},getMode:()=> 'text',setMode(){}};
  const textarea=root.querySelector('#private-message'),capture=root.querySelector('[data-voice-capture]'),caption=root.querySelector('[data-voice-caption]'),status=root.querySelector('[data-voice-status]');
  const originalPlaceholder=textarea?.getAttribute?.('placeholder')??textarea?.placeholder??'';
  const openButton=root.querySelector('[data-voice-open]'),stopButton=root.querySelector('[data-voice-stop]'),finishButton=root.querySelector('[data-voice-finish]');
  const help=root.querySelector('[data-voice-help]'),helpTitle=root.querySelector('[data-voice-help-title]'),helpMessage=root.querySelector('[data-voice-help-message]'),helpGuide=root.querySelector('[data-voice-help-guide]'),keyboardGuide=root.querySelector('[data-voice-keyboard-guide]'),helpRetry=root.querySelector('[data-voice-retry]'),helpClose=root.querySelector('[data-voice-help-close]'),language=root.querySelector('[data-voice-language]'),languageLabel=root.querySelector('[data-voice-language-label]');
  let disposed=false,baseDraft='',failureState=null,sessionLanguage='';
  const syncDraft=()=>{root.dataset.hasDraft=String(Boolean(textarea?.value?.trim()));};
  function closeHelp(restoreFocus=false){if(help)help.hidden=true;openButton?.setAttribute('aria-expanded','false');if(restoreFocus)openButton?.focus?.({preventScroll:true});}
  function updateHelp(){
    if(!failureState)return;
    const detail=voiceFailureDetails(failureState.errorCode);
    if(helpTitle)helpTitle.textContent=detail.title;
    if(helpMessage)helpMessage.textContent=detail.message;
    if(helpGuide)helpGuide.textContent=detail.guide;
    const languageCanChange=!['unsupported','insecure-context','policy-blocked','service-not-allowed','not-allowed','audio-capture'].includes(failureState.errorCode);
    if(languageLabel)languageLabel.hidden=!languageCanChange;
    if(language)language.value=sessionLanguage;
    const changedLanguage=languageCanChange&&failureState.errorCode==='language-not-supported'&&sessionLanguage&&recognitionLanguage(sessionLanguage,host)!==failureState.locale;
    if(helpRetry)helpRetry.hidden=!(detail.canRetry||changedLanguage);
    if(keyboardGuide)keyboardGuide.textContent='也可以用系統鍵盤聽寫：\n1. 點「返回文字」打開鍵盤。\n2. 點 iPhone 鍵盤上的麥克風，把說話變成草稿。\n3. 若沒有聽寫按鈕，在「設定 › 一般 › 鍵盤」開啟「啟用聽寫」。\n文字仍需由你確認後發送；這裡不會發送錄音。';
  }
  function showHelp(){
    if(!failureState||!help)return;
    updateHelp();help.hidden=false;openButton?.setAttribute('aria-expanded','true');helpClose?.focus?.({preventScroll:true});
  }
  function paint(state){
    if(disposed)return;
    const recording=['starting','listening','processing'].includes(state.status),processing=state.status==='processing',failed=['error','unsupported'].includes(state.status);
    root.dataset.voiceCapture=String(recording);root.dataset.voiceState=state.status;root.dataset.voiceError=state.errorCode||'';root.dataset.voiceFallback=String(failed);
    if(capture)capture.hidden=!recording;
    if(caption){caption.textContent=state.message;caption.setAttribute('title',state.message);}
    if(stopButton)stopButton.disabled=processing||state.status==='starting';
    if(finishButton){finishButton.disabled=processing||state.status==='starting';finishButton.setAttribute('aria-busy',String(processing));}
    if(status)status.textContent=failed?state.message:'';
    failureState=failed?{...state}:null;
    if(openButton)openButton.setAttribute('aria-label',failed?'查看語音輸入說明':'開始語音輸入');
    if(textarea)textarea.placeholder=failed?voiceFailureDetails(state.errorCode).placeholder:originalPlaceholder;
    if(!failed)closeHelp();
    syncDraft();onStatus(state);
  }
  const voice=createVoiceInput({window:host,lang:()=>sessionLanguage||(typeof lang==='function'?lang():lang),startTimeout,inactivityTimeout,finishTimeout,onState:paint,onResult:text=>{
    const draft=`${baseDraft}${baseDraft&&!/\s$/.test(baseDraft)?' ':''}${text}`.slice(0,1000);
    if(textarea)textarea.value=draft;onDraft(draft);syncDraft();
  }});
  function begin(){
    if(disposed)return false;
    closeHelp();baseDraft=String(getDraft()||'');textarea?.blur?.();onConversationStart();return voice.start();
  }
  const click=event=>{
    const button=event.target.closest?.('button[data-voice-open],button[data-voice-cancel],button[data-voice-stop],button[data-voice-finish],button[data-voice-help-close],button[data-voice-retry],button[data-voice-use-text]');
    if(!button||!root.contains(button))return;
    event.preventDefault();
    if(button.hasAttribute('data-voice-help-close')){closeHelp(true);return;}
    if(button.hasAttribute('data-voice-use-text')){closeHelp();voice.cancel();textarea?.focus?.({preventScroll:true});return;}
    if(button.hasAttribute('data-voice-retry')){if(helpRetry?.hidden===false)begin();return;}
    if(button.hasAttribute('data-voice-cancel')){voice.cancel();return;}
    if(button.hasAttribute('data-voice-stop')||button.hasAttribute('data-voice-finish')){voice.stop();return;}
    if(failureState){showHelp();return;}
    begin();
  };
  const input=event=>{if(event.target===textarea){if(['error','unsupported'].includes(voice.getSnapshot().status))voice.cancel();failureState=null;closeHelp();textarea.placeholder=originalPlaceholder;root.dataset.voiceFallback='false';if(status)status.textContent='';openButton?.setAttribute('aria-label','開始語音輸入');syncDraft();}};
  const change=event=>{if(event.target===language){sessionLanguage=['zh-CN','zh-HK','en-US'].includes(language.value)?language.value:'';updateHelp();}};
  const keydown=event=>{if(event.key==='Escape'&&help&&!help.hidden){event.preventDefault();event.stopPropagation?.();closeHelp(true);}};
  const visibility=()=>{if(root.ownerDocument?.hidden){closeHelp();voice.cancel();}};
  root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('change',change);root.addEventListener('keydown',keydown);root.ownerDocument?.addEventListener('visibilitychange',visibility);
  delete root.dataset.communicationMode;paint(voice.getSnapshot());
  return {start:begin,stop(){voice.cancel();},getSnapshot:voice.getSnapshot,getDiagnostics:voice.getDiagnostics,isCapturing:()=>root.dataset.voiceCapture==='true',getMode:()=>root.dataset.voiceCapture==='true'?'voice':'text',setMode(next){if(next!=='voice')voice.cancel();},dispose(){disposed=true;voice.dispose();closeHelp();root.removeEventListener('click',click);root.removeEventListener('input',input);root.removeEventListener('change',change);root.removeEventListener('keydown',keydown);root.ownerDocument?.removeEventListener('visibilitychange',visibility);}};
}
// Compatibility for the current host integration. There is no top mode switch.
export const bindCommunicationMode=bindVoiceComposer;
