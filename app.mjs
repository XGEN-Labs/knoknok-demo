import { renderFriendNetwork } from './friend-network.mjs?v=20261026-experience-41c';
import { CARD_DESIGN_NAMES, resolveCardDesign } from './card-design.mjs?v=20261023-card-36h';
import { submitDemoRegistration } from './auth-registration.mjs?v=20261026-registration-41';
import { createLandingVideoScene } from './landing-video-scene.mjs?v=20261026-experience-41c';
import { createLoadingState, loadingIndicatorMarkup } from './loading-state.mjs?v=20261023-experience-34d';
import { createSceneAssetReadiness } from './scene-asset-readiness.mjs?v=20261023-experience-34d';
import { voiceComposerMarkup, restoredControlIcon, bindVoiceComposer, centeredVolumeIcon } from './communication-mode.mjs?v=20261026-experience-41c';
import { visibleViewport, sheetPlacement } from './mobile-viewport.mjs?v=20261023-experience-34d';
import { bindSheetDismiss } from './sheet-dismiss.mjs?v=20261023-experience-34d';
import { showCompanionContract } from './contract-story.mjs?v=20261023-experience-34d';
import { prepareAvatar } from './avatar-upload.mjs?v=20261023-experience-34d';
import { initFormControls } from './form-controls.mjs?v=20261023-experience-34d';
import { initDatePickers } from './date-picker.mjs?v=20261026-experience-41c';
import { initTypography } from './typography.mjs?v=20261023-experience-34d';
import { createSceneSound } from './scene-sound.mjs?v=20261026-experience-41c';
import { landingComplete, onboardingDestination } from './landing.mjs?v=20261023-experience-34d';
import { navIcon, backArrow, sendArrow, uiIcon } from './ui-icons.mjs?v=20261026-experience-41c';
import { DEFAULT_CARD_AVATAR, normalizePersonalityTags, normalizeCardAvatar, publicCardData, encodeCard, decodeCard, cardMarkup, cardShareURL, downloadCard, prepareCardFonts } from './public-card.mjs?v=20261026-experience-41c';
// Current UI uses the original illustration; native model exploration stays archived.
import { createKlinWorld } from './klin-reference-2d.mjs?v=20261026-experience-41c';
import { createLoginVideoScene as createLoginSceneBridge, LOGIN_VIDEO_POSTER } from './login-video-scene.mjs?v=20261023-login-video-40';
import { HOME_SCENE_ASSET, WELCOME_SCENE_ASSET, VISIT_SCENE_ASSET, SHARED_SCENE_ASSET } from './scene-assets.mjs?v=20261026-experience-41c';
import { klinAssets, klinMarkup, setKlinLoadingState } from './klin-companion.mjs?v=20261023-original-room-character-39';
import { getOnboardingTurn, getOnboardingMessages } from './conversation-onboarding.mjs?v=20261023-experience-34d';
import { initPixelRoom } from './pixel-room.mjs?v=20261023-experience-34d';
import { createHomeGreeting } from './home-greeting.mjs?v=20261023-experience-34d';
import { pixelCompanionMarkup, initCompanionAnimation, syncCompanionAnimation } from './companion-animation.mjs?v=20261023-experience-34d';
import { captureCompanion, transitionScene, prefersStillness } from './motion.mjs?v=20261023-actions-38';
import { initialState, reduce, validateDemand, publicMessages, serializeState, hydrateState, STORAGE_KEY, validateBasics, validateBirth, BIRTH_TIME_OPTIONS, ageFromBirth, companionProfile, getDemoFriends, getCompanionTurn, SHARED_MOMENT_OPTIONS } from './model.mjs?v=20261026-experience-41c';

const $ = (query, root=document) => root.querySelector(query);
const homeGreeting = createHomeGreeting();
const sceneSound = createSceneSound();
let cleanFormControls,cleanSheetControls,cleanDatePickers,cleanSheetDates,cleanCommunication,voiceRefreshPending=false;
let cardAvatarDraft='';
let avatarUploadSequence=0,cardAvatarUploading=false;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const variantParams = new URLSearchParams(location.search);
const shareDemo = document.documentElement.classList.contains('share-demo');
// Keep historical pixel files archived; the current prototype only presents Klin.
const pixelVariant = false;
const comparisonMode = variantParams.get('compare') === '1' && window.parent !== window;
const STATE_KEY = shareDemo ? `${STORAGE_KEY}-klin-demo-v1` : pixelVariant ? `${STORAGE_KEY}-pixel` : STORAGE_KEY;
const UI_KEY = `${STATE_KEY}-ui`;
document.documentElement.dataset.character = pixelVariant ? 'pixel' : 'soft';
document.documentElement.classList.toggle('comparison-embed', comparisonMode);
let state, ui;
try { state=comparisonMode?initialState():hydrateState(localStorage.getItem(STATE_KEY)); ui=comparisonMode?null:JSON.parse(localStorage.getItem(UI_KEY)||'null'); } catch { state=initialState(); }
ui={route:state.session.authenticated?'home':'welcome',history:[],motion:false,matchResult:'found',failNext:false,selectedInvite:null,selectedRelationship:null,...(ui||{})};
ui.history=Array.isArray(ui.history)?ui.history.filter(route=>typeof route==='string').slice(-16):[];
// A restored page has no pending timer; allow a fresh knock after refresh.
if(ui.visitPhase==='knocking')ui.visitPhase='idle';
if (!state.session.authenticated) ui.route='welcome';
if(ui.route==='profile-edit')ui.route='profile';
if(ui.route==='invite')ui.route='relations';
if (['memory','companion','demand','preview','search','candidate','onboard','initializing'].includes(ui.route)) ui.route=state.session.authenticated?onboardingDestination(state):'welcome';
ui.soundOn=false;
let sharedCard=decodeCard(new URLSearchParams(location.hash.slice(1)).get('card')||'');
if(sharedCard)ui.route='public-card';
let landingHelloTimer,landingReveal=null,landingReaction='';
let visitTimer,visitAttempt=0;
let worldReady=false, klinWorld=null;
let worldFailed=false,sceneLoading=null,sceneImages=null,audioToggleSequence=0;
let filmAudioState={active:false,playing:false,time:0};
const expiredLoading=new Set();
let loginScene=null,landingVideoScene=null,closeContractUI=null;
let renderSequence=0;
let pendingCardFontRefresh=false;
let conversationActive=false,conversationEnterTimer;
let matchingDemandId=null, matchingPhase=0, matchingTimers=[];
let timer, initializeTimer, toastTimer, authResendTimer, stopTransition, pendingSceneRefresh=false, adviceRequest=0, busy=false, companionTyping=false;
// Phone verification is a local prototype interaction, so credentials stay in memory.
const DEMO_ACCOUNT='knoknok.demo',DEMO_PASSWORD='Knoknok2026';
const authDraft={account:DEMO_ACCOUNT,password:DEMO_PASSWORD,phone:'',code:'',sentPhone:'',resendAt:0};
const normalizePhone=value=>String(value||'').replace(/[\s()-]/g,'');
const validPhone=value=>/^(?:(?:\+?86)?1[3-9]\d{9}|(?:\+?852)?[456789]\d{7})$/.test(normalizePhone(value));
const resendSeconds=()=>Math.max(0,Math.ceil((authDraft.resendAt-Date.now())/1000));
// Registration credentials are transient UI input, never part of saved state.
const registrationDraft={account:'',password:'',confirmPassword:''};
const actor = () => state.session.activeUserId;
const me = () => state.users[actor()];
const privateSpace = () => state.private[actor()];
const latestInvite = () => state.invitations.find(x=>x.id===ui.selectedInvite) || state.invitations.filter(x=>x.fromId===actor()||x.toId===actor()).at(-1);
const latestRelationship = () => state.relationships.find(x=>x.id===ui.selectedRelationship&&x.members.includes(actor())) || state.relationships.filter(x=>x.members.includes(actor())).at(-1);
const sharedIntro = () => { const rel=latestRelationship(); return state.invitations.find(x=>x.id===rel?.invitationId)?.snapshot.intro || '從一個輕鬆的話題開始吧。'; };
const candidate = () => state.candidates.filter(x=>x.ownerId===actor()&&x.demandId===state.demand?.id&&['available','invited'].includes(x.status)).at(-1);
const formatDate = time => new Date(time).toLocaleString('zh-HK',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
const tag = (text, type='') => `<span class="tag ${type}">${esc(text)}</span>`;
const backIcon = backArrow;
// Main destinations return home; switching tabs must not change this destination.
const homeReturnRoutes = new Set(['relations','memory','profile','companion','search']);
const roomSceneRoutes = new Set(['home','relations','memory','profile','companion','demand','preview','search','candidate','invite','connected','chat']);
const btn = (text, action, cls='', attrs='') => `<button type="button" class="btn ${cls}" data-action="${action}" ${attrs}>${text}</button>`;
const tiny = (text, action, id='', cls='') => `<button type="button" class="tiny-btn ${cls}" data-action="${action}" data-id="${esc(id)}">${text}</button>`;
const avatar = (id,small=false) => `<span class="avatar ${id==='b'?'person-b':''} ${small?'small':''}" aria-hidden="true">${normalizeCardAvatar(state.users[id]?.cardAvatar)?`<img src="${esc(state.users[id].cardAvatar)}" alt="">`:esc(state.users[id]?.name?.slice(0,1)||'K')}</span>`;
const currentCompanionStage = () => ['welcome','login','register','verify','landing','onboard'].includes(ui.route) ? 'juvenile' : companionProfile(state).stage;
const spiritImage = (label='Klin 伙伴', attrs='', stage=currentCompanionStage()) => pixelVariant ? pixelCompanionMarkup(label, attrs) : klinMarkup({stage,label,attrs});
const companionName = () => me().companionName || 'Klin';
const logoImage = `<img class="brand-logo" src="${pixelVariant?'assets/pixel-scene-20261010/knokknok-wordmark-chunky-pixel-white.png':'assets/brand-20261026/knoknok-handwritten-white.png'}" alt="Knoknok" width="2172" height="724">`;
const spiritAvatar = () => `<span class="avatar small">${spiritImage(`${companionName()} 伙伴`)}</span>`;
const empty = (title,copy,action='') => `<div class="blank-state">${spiritImage(`${companionName()} 伙伴`)}<h3>${title}</h3><p>${copy}</p>${action}</div>`;
const detail = (label,value) => `<div class="detail-line"><dt>${label}</dt><dd>${esc(value)}</dd></div>`;
function save(){if(comparisonMode)return;try{localStorage.setItem(STATE_KEY,serializeState(state));localStorage.setItem(UI_KEY,JSON.stringify(ui));}catch{toast('瀏覽器暫時無法保存，仍可繼續這次體驗。');}}
function dispatch(action, renderNow=true){state=reduce(state,action);save();if(renderNow)render(false);if(state.error&&ui.route!=='landing')toast(state.error);return !state.error;}
function toast(text){const node=$('#toast');node.textContent=text;node.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('visible'),3300);}
function go(route,options={}){
  if(route!==ui.route)sceneSound.stopSpeech();
  if(typeof closeContractUI==='function')closeContractUI();
  if(route==='profile-edit')route='profile';
  if(route==='invite')route='relations';
  if(['memory','companion','demand','preview','search','candidate'].includes(route))route='home';
  if(['onboard','initializing'].includes(route))route=setupRoute();
  // Keep the home page mounted while its native rig finishes loading, so an
  // early card tap can still use the same in-room offer as a later tap.
  const pendingCard=go.pendingCardEntry;
  if(pendingCard&&pendingCard.route===route&&pendingCard.ui===ui&&ui.route==='home'&&!options.cardReadySettled)return pendingCard.promise;
  pendingCard?.cancel();
  const cardEntryToken={};go.cardEntryToken=cardEntryToken;
  if(ui.route==='home'&&['profile','public-card'].includes(route)&&!options.cardReadySettled
    &&typeof klinWorld!=='undefined'&&typeof klinWorld?.ready?.then==='function'&&!worldReady
    &&!pixelVariant&&!prefersStillness(ui.motion)){
    const originUI=ui,originActor=actor(),loadingWorld=klinWorld;
    let settled=false,timeout,resolveWait;
    const promise=new Promise(resolve=>{resolveWait=resolve;});
    const clearWait=()=>{clearTimeout(timeout);if(go.pendingCardEntry?.token===cardEntryToken)delete go.pendingCardEntry;};
    const enterCard=()=>{
      if(settled)return;settled=true;clearWait();
      if(go.cardEntryToken!==cardEntryToken||ui!==originUI||ui.route!=='home'||actor()!==originActor
        ||!state.session.authenticated||(klinWorld&&klinWorld!==loadingWorld)){resolveWait(false);return;}
      // A timeout or failed native load still opens a usable static card.
      go(route,{...options,cardReadySettled:true});resolveWait(true);
    };
    go.pendingCardEntry={route,ui:originUI,token:cardEntryToken,promise,cancel(){if(settled)return;settled=true;clearWait();resolveWait(false);}};
    timeout=setTimeout(enterCard,2500);
    Promise.resolve(loadingWorld.ready).then(enterCard,enterCard);
    return promise;
  }
  clearTimeout(landingHelloTimer);if(route!=='landing'){landingReveal=null;landingReaction='';}closeSheet();
  if(isRoomOverlayRoute(route)&&!isRoomOverlayRoute(ui.route)){ui.sceneRoute=ui.route;ui.sceneConversation=conversationActive;}
  if(conversationActive&&route!=='home'&&!['profile','public-card'].includes(route))setHomeConversation(false);
  const publicRoutes=['welcome','login','register','verify','public-card'];
  if(!state.session.authenticated&&!publicRoutes.includes(route))route='welcome';
  if(state.session.authenticated&&actor()==='a'&&!landingComplete(state)&&!publicRoutes.includes(route))route='landing';
  if(options.replace!==true&&ui.route!==route)ui.history.push(ui.route);
  if(ui.route==='register'&&route!=='register')Object.assign(registrationDraft,{account:'',password:'',confirmPassword:''});
  ui.route=route;
  if(route==='home'&&!pixelVariant){
    const next=reduce(state,{type:'ENTER_COMPANION_HOME'});
    if(next.error){ui.route=setupRoute();}else state=next;
  }
  ui.history=ui.history.slice(-16);save();render(!options.skipTransition,{direction:options.direction||'forward'});
  if(ui.route==='initializing'&&state.onboarding.status==='preparing')startInitialization();
}
function back(){let route=ui.history.pop();while(route==='initializing'&&state.onboarding?.status==='ready')route=ui.history.pop();go(route||(state.session.authenticated?'home':'welcome'),{replace:true,direction:'back'});}
function top(title,sub='',right=''){const control=['chat','connected'].includes(ui.route)?`<button type="button" class="icon-button" data-go="relations" data-direction="back" aria-label="返回串門">${backIcon}</button>`:homeReturnRoutes.has(ui.route)?`<button type="button" class="icon-button header-home" data-go="home" data-direction="back" aria-label="回到首頁" title="回到首頁">${backIcon}</button>`:`<button type="button" class="icon-button" data-action="back" aria-label="返回">${backIcon}</button>`;return `<header class="page-top">${control}<div><h2>${title}</h2>${sub?`<p class="meta">${sub}</p>`:''}</div>${right?`<div class="top-right">${right}</div>`:''}</header>`;}
function nav(){return '';}
function content(body,cls=''){return `<div class="content ${cls}">${body}</div>`;}
function field(label,name,value,attrs='',type='text'){return `<div class="field"><label for="${name}">${label}</label><input class="input" id="${name}" name="${name}" type="${type}" value="${esc(value)}" ${attrs}></div>`;}
function shell(body,cls=''){return `<section class="page ${roomSceneRoutes.has(ui.route)||isRoomOverlayRoute(ui.route)?'room-page':''} ${cls}" data-screen="${ui.route}">${body}</section>`;}
function welcome(){return shell(`<div class="klin-welcome"><span class="klin-art" role="img" aria-label="幼年態 Klin"><img class="figma-companion-image" src="assets/login-world-20261019/source/character-transparent.png" width="1359" height="1157" alt="" draggable="false"></span></div><h2 class="brand">${logoImage}</h2><div class="welcome-actions">${btn('帳號登錄','login','kn-glass-control')}</div>`,'welcome');}
function auth(verification=false,registration=false){
  const fields=registration?[
    ['account','帳號','text','3–30 個字元',30,'username'],
    ['password','密碼','password','至少 6 個字元',64,'new-password'],
    ['confirmPassword','確認密碼','password','再輸入一次密碼',64,'new-password'],
  ].map(([name,label,type,placeholder,maxlength,autocomplete])=>`<div class="field auth-field"><label for="register-${name}">${label}</label><input class="input" id="register-${name}" name="${name}" type="${type}" autocomplete="${autocomplete}" autocapitalize="none" spellcheck="false" maxlength="${maxlength}" placeholder="${placeholder}" value="${esc(registrationDraft[name])}" data-registration-field="${name}" aria-describedby="register-${name}-error"><p class="auth-field-error" id="register-${name}-error" aria-live="polite" hidden></p></div>`).join(''):verification?`<div class="field auth-field"><label for="auth-code">驗證碼</label><input class="input" id="auth-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 位數驗證碼" value="${esc(authDraft.code)}"></div>`:`<div class="field auth-field"><label for="auth-account">帳號</label><input class="input" id="auth-account" name="account" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(authDraft.account)}" aria-describedby="auth-error"></div><div class="field auth-field"><label for="auth-password">密碼</label><input class="input" id="auth-password" name="password" type="password" autocomplete="current-password" value="${esc(authDraft.password)}" aria-describedby="auth-error"></div>`;
  return shell(`<header class="auth-header"><button type="button" class="icon-button auth-back" data-go="${registration?'login':'welcome'}" data-direction="back" aria-label="${registration?'返回登錄':'返回歡迎頁'}">${backIcon}</button><h2 class="auth-brand">${logoImage}</h2></header><div class="auth-panel"><div class="auth-heading"><h1>${registration?'註冊':'帳號密碼登錄'}</h1><p>${registration?'從這裡，開始我們的第一次相遇。':'讓我們把這次相遇記住。'}</p></div><form id="auth-form" class="auth-form" data-form="${registration?'register':verification?'verify':'login'}" novalidate>${fields}<div id="auth-error" class="auth-error" role="alert"></div><div class="auth-submit"><button class="btn dark" type="submit"><span>${registration?'註冊':'登錄'}</span></button></div></form>${verification?'':`<p class="auth-switch">${registration?'已有帳號？':'還沒有帳號？'}<button class="auth-switch-link" type="button" data-go="${registration?'login':'register'}">${registration?'登錄':'註冊'}</button></p>`}</div>`,'auth-page '+(verification?'auth-verify':registration?'auth-login auth-register':'auth-login'));
}

function updateAuthControls(){
  if(!['login','register','verify'].includes(ui.route))return;
  const verification=ui.route==='verify',primary=$('.page[data-screen] .auth-submit button');
  if(primary)primary.disabled=ui.route==='register'?false:verification?!/^\d{6}$/.test(authDraft.code):!(authDraft.account.trim()&&authDraft.password);
  const resend=$('.page[data-screen] [data-action="resend-code"]'),remaining=resendSeconds();
  if(resend){resend.disabled=remaining>0;resend.querySelector('span').textContent=remaining?`重新發送(${remaining}s)`:'重新發送';}
  if(!remaining){clearInterval(authResendTimer);authResendTimer=null;}
}
function syncAuthCountdown(){
  clearInterval(authResendTimer);authResendTimer=null;
  updateAuthControls();
  if(ui.route==='verify'&&resendSeconds())authResendTimer=setInterval(updateAuthControls,250);
}
function clearAuthDraft(){clearInterval(authResendTimer);authResendTimer=null;Object.assign(authDraft,{account:DEMO_ACCOUNT,password:DEMO_PASSWORD,phone:'',code:'',sentPhone:'',resendAt:0});Object.assign(registrationDraft,{account:'',password:'',confirmPassword:''});}
function showRegistrationErrors(errors){
  for(const name of ['account','password','confirmPassword']){
    const input=$(`[data-registration-field="${name}"]`),message=$(`#register-${name}-error`);
    if(input)input.setAttribute('aria-invalid',String(Boolean(errors[name])));
    if(message){message.textContent=errors[name]||'';message.hidden=!errors[name];}
  }
  const first=Object.keys(errors)[0];if(first)$(`[data-registration-field="${first}"]`)?.focus({preventScroll:false});
}
function registerDemoAccount(data){
  for(const name of ['account','password','confirmPassword'])registrationDraft[name]=String(data.get(name)||'');
  const result=submitDemoRegistration(registrationDraft);
  if(!result.state){showRegistrationErrors(result.errors);return false;}
  // A new demo identity starts its first encounter, independently of any
  // completed previous demo session. No registration credentials are saved.
  resetSound();clearMatching();homeGreeting.reset();landingVideoScene?.dispose();landingVideoScene=null;
  state=result.state;ui={route:'register',history:[],motion:ui.motion,matchResult:'found',failNext:false,soundOn:false};
  clearAuthDraft();go(setupRoute());revealOnboarding();render(false);return true;
}
function sendDemoCode(){
  authDraft.code='';authDraft.sentPhone=normalizePhone(authDraft.phone);authDraft.resendAt=Date.now()+60000;
  save();go('verify');toast('本地演示驗證碼：123456');
}
function setupRoute(){return onboardingDestination(state);}
function basicsDraft(){return {name:me().name,language:me().language||'粵語',region:me().region||'香港',...(ui.setupBasics||{})};}
function birthDraft(){return {...privateSpace().birth,...(ui.setupBirth||{})};}
function landingProgress(step){return `<div class="landing-progress" aria-label="初次見面，第 ${step} 步，共 4 步">${[1,2,3,4].map(n=>`<i class="${n<=step?'done':''}"></i>`).join('')}</div>`;}
function landing(){
 const turn=getOnboardingTurn(state),all=getOnboardingMessages(state),messages=landingReveal?.key===turn.key?all.slice(0,landingReveal.count):all,waiting=messages.length<all.length;
 const calendar=turn.key==='birthDate',hours=turn.key==='birthTime',coda=turn.canFinish?(ui.onboardingCoda||0):0;
 const visible=coda?[]:turn.key==='response'?[]:turn.canFinish?messages.slice(-1):messages.slice(-2);
 const input=calendar?`<div class="field"><label for="onboarding-calendar">出生日期</label><input id="onboarding-calendar" name="answer" type="date" data-date-purpose="birthday" autocomplete="bday" value="${esc(ui.onboardingDraft||'')}" required></div>`:`<textarea id="onboarding-answer" name="answer" rows="1" maxlength="160" placeholder="${esc(turn.placeholder||'告訴我吧…')}" aria-label="${esc(turn.prompt)}">${esc(ui.onboardingDraft||'')}</textarea>`;
 const epilogue=coda===1?`<div class="onboarding-message is-user"><p>那怎么办呢</p></div><div class="onboarding-message is-klin is-new"><p>先從一句你好開始。我們簽下相遇的約定，我陪你慢慢去看看。</p></div>`:coda===2?`<div class="onboarding-message is-user"><p>好，我记住了</p></div><div class="onboarding-message is-klin is-new"><p>${esc(me().name)}，把這次相遇留下來吧。你願意和我簽下這份契約嗎？</p></div>`:'';
 const choices=hours&&!waiting?`<div class="birth-hour-grid" role="group" aria-label="選擇出生時辰">${(turn.options||[]).map(option=>`<button type="button" data-action="onboarding-reply" data-text="${esc(option.text)}"><strong>${esc(option.label)}</strong><small>${esc(option.range)}</small></button>`).join('')}</div>`:'';
 const replies=!waiting?(hours?'<button type="button" data-action="onboarding-skip">记不清了，跳过</button>':turn.replies.map(r=>`<button type="button" data-action="onboarding-reply" data-text="${esc(r.text)}">${esc(r.label)}</button>`).join('')+(turn.canSkip&&!turn.replies.length?'<button type="button" data-action="onboarding-skip">記不清了，先跳過</button>':'')):'';
 const ending=turn.canFinish?btn(coda===0?'那怎么办呢':coda===1?'好，我记住了':state.onboarding?.contract?.signedAt?'一起回家':'簽署相遇契約',coda<2?'onboarding-coda':state.onboarding?.contract?.signedAt?'finish-conversation':'open-contract'):'';
 return shell(`<button type="button" class="onboarding-klin" data-action="onboarding-touch" aria-label="輕觸 Klin">${spiritImage('正在聽你說話的 Klin','','juvenile')}</button><div class="onboarding-thread"><div class="onboarding-messages" role="log" aria-live="polite">${visible.map((m,i)=>`<div class="onboarding-message ${m.role==='user'?'is-user':'is-klin'} ${i===visible.length-1?'is-new':''}"><p>${esc(m.text)}</p></div>`).join('')}${waiting?`<div class="onboarding-message">${loadingIndicatorMarkup('Klin 正在想…')}</div>`:''}${!waiting&&turn.key==='response'?'<article class="onboarding-reading"><small>彼之境 · 第一段回響</small><h3>有些相遇，正在等一句你好。</h3><p>有時想靠近，有時又想留一點自己的空間。不需要一下子變得熱鬧，我們可以慢慢來。</p></article>':''}${epilogue}</div>${choices}</div><form class="onboarding-composer" data-form="onboarding" novalidate><div class="quick-replies">${replies}</div>${(waiting&&calendar)||hours||turn.key==='gender'?'':ending||`<div class="onboarding-input-row">${calendar?'':voiceComposerMarkup()}${input}<button class="onboarding-send" type="submit" aria-label="回覆 Klin">${sendArrow}</button></div>`}<p class="sr-only" role="alert">${esc(state.error||'')}</p></form>`,'conversation-onboarding'+(hours?' is-birth-time':'')+(turn.canFinish?' is-final-turn':''));
}

function revealOnboarding(from=0){
 clearTimeout(landingHelloTimer);const turn=getOnboardingTurn(state),messages=getOnboardingMessages(state);
 landingReveal={key:turn.key,count:Math.min(from,messages.length)};
 const reveal=()=>{if(ui.route!=='landing'||landingReveal?.key!==turn.key)return;landingReveal.count++;render(false);if(landingReveal.count<messages.length)landingHelloTimer=setTimeout(reveal,prefersStillness(ui.motion)?0:650);else{klinWorld?.interact(turn.key==='name'||turn.key==='complete'?'wave':'look');const thread=$('.onboarding-thread');if(thread)thread.scrollTop=0;}};
 landingHelloTimer=setTimeout(reveal,prefersStillness(ui.motion)?0:450);
}
function answerOnboarding(text,skip=false){
 if(landingVideoScene&&!landingVideoScene.readyForInput)return;
 sceneSound.stopSpeech();cleanCommunication?.stop?.();
 const previous=getOnboardingMessages(state).length;
 if(dispatch(skip?{type:'ONBOARDING_SKIP'}:{type:'ONBOARDING_REPLY',text},false)){ui.onboardingDraft='';ui.onboardingCoda=0;landingReaction='';save();klinWorld?.interact('look');revealOnboarding(previous+1);}
 render(false);const thread=$('.onboarding-thread');if(thread)thread.scrollTop=0;
}
function departToHome(){
 if(ui.route!=='landing'||!state.session.authenticated||!state.onboarding?.contract?.signedAt)return;
 sceneSound.stopSpeech();
 const originUI=ui,who=actor(),signature=state.onboarding.contract.signedAt;
 clearTimeout(landingHelloTimer);
 const arrive=()=>{
  if(ui!==originUI||ui.route!=='landing'||!state.session.authenticated||actor()!==who||state.onboarding?.contract?.signedAt!==signature)return;
  if(dispatch({type:'FINISH_CONVERSATION'},false))go('home',{replace:true,skipTransition:true});
  else render(false);
 };
 initWorld({prewarm:true});
 if(!landingVideoScene){arrive();return;}
 // Repeated taps/renders retain the same departure and its one completion.
 landingVideoScene.depart({onComplete:arrive,reducedMotion:prefersStillness(ui.motion)});
}
function setupCompanion(){return `<div class="setup-companion"><span class="dialogue-dot" aria-hidden="true"></span><div><strong>Klin 正在聽你說</strong><p>${state.onboarding.basicsComplete?`${esc(me().name)}，再認識你一點點。`:'先從你的名字開始吧。'}</p></div></div>`;}
function setupBasics(){const d=basicsDraft();return shell(top(state.onboarding.status==='ready'?'編輯資料':'我該怎麼稱呼你？')+content(`${landingProgress(2)}${setupCompanion()}<form id="setup-basics-form" autocomplete="off" data-form="setup-basics" novalidate><div class="landing-form-card">${field('你的名字','setup-name',state.onboarding.basicsComplete||ui.setupBasics?d.name:'','maxlength="18" autocomplete="off" placeholder="讓我記住你"')}<div class="field"><label for="setup-language">想用什麼語言聊天？</label><select id="setup-language" name="language">${['粵語','普通話','英語'].map(x=>`<option ${d.language===x?'selected':''}>${x}</option>`).join('')}</select></div>${field('你現在住在哪座城市？','setup-region',d.region,'maxlength="60" placeholder="例如：香港"')}</div><div id="basics-error" role="alert"></div></form>`,'with-footer setup-content')+`<div class="fixed-footer"><button type="submit" form="setup-basics-form" class="btn">告訴 Klin ${sendArrow}</button></div>`,'setup-page landing-setup');}
function setupBirth(){
  const d=birthDraft(),zones=[['','不確定'],['Asia/Hong_Kong','香港 · UTC+8'],['Asia/Shanghai','中國大陸 · UTC+8'],['Asia/Taipei','台灣 · UTC+8'],['Asia/Singapore','新加坡 · UTC+8'],['Asia/Tokyo','日本 · UTC+9'],['Europe/London','英國 · 倫敦'],['America/New_York','美國 · 紐約']];
  if(d.timezone&&!zones.some(z=>z[0]===d.timezone))zones.push([d.timezone,d.timezone]);
  return shell(top('你的生日')+content(`${landingProgress(3)}<form id="setup-birth-form" data-form="setup-birth" novalidate><div class="landing-form-card"><p class="birth-intro">再認識你一點點。</p>${field('出生日期','birth-date',state.onboarding.birthComplete||ui.setupBirth?d.date:'','autocomplete="bday" data-date-purpose="birthday"','date')}<div class="field"><label for="birth-time">出生時間</label><div class="birth-time-row"><input class="input" id="birth-time" name="time" type="time" value="${esc(d.time||'')}" ${d.unknownTime?'disabled':''}><label class="check"><input type="checkbox" name="unknownTime" ${d.unknownTime?'checked':''}>不清楚</label></div></div>${field('出生地（選填）','birth-place',d.place||'','maxlength="60" placeholder="例如：香港"')}<div class="field"><label for="birth-timezone">時區（選填）</label><select id="birth-timezone" name="timezone">${zones.map(([value,label])=>`<option value="${value}" ${d.timezone===value?'selected':''}>${label}</option>`).join('')}</select></div></div><p class="small-note">出生資料僅你與 Klin 可見。</p><div id="birth-error" role="alert"></div></form>`,'with-footer setup-content')+`<div class="fixed-footer"><button type="submit" form="setup-birth-form" class="btn">${state.onboarding.status==='ready'?'儲存資料':'下一步'} ${sendArrow}</button></div>`,'setup-page landing-setup birth-page');
}
function initializing(){const failed=state.onboarding?.status==='failed';return shell(top(failed?'再試一次':'準備見面')+`<div class="initializing-content">${spiritImage('Klin 正在準備','style="width:180px;height:180px"')}<h3>${failed?'剛才沒準備好':`${companionName()} 正在認識你`}</h3><p>${failed?'資料已保留，重新試試就好。':'馬上就好。'}</p>${failed?btn('重新準備','retry-initialization'): `<div class="setup-progress" role="progressbar" aria-label="正在準備伙伴"><span></span></div>`}</div>`,'initializing-page');}
function startInitialization(){clearTimeout(initializeTimer);if(state.onboarding?.status==='new'&&state.session.authenticated&&actor()==='a'&&state.onboarding.basicsComplete&&state.onboarding.birthComplete){if(!dispatch({type:'BEGIN_INITIALIZATION'},false))return;}if(state.onboarding?.status!=='preparing')return;initializeTimer=setTimeout(()=>{if(state.onboarding?.status!=='preparing'||!state.session.authenticated)return;const ok=dispatch({type:'FINISH_INITIALIZATION',fail:consumeFailure()},false);if(actor()==='a'&&state.session.authenticated&&ui.route==='initializing'){if(ok&&state.onboarding.status==='ready')go('onboard',{replace:true});else render(false);}},1900);}
function basicsFormPatch(){const f=$('#setup-basics-form');if(!f)return basicsDraft();const d=new FormData(f);return {name:d.get('setup-name'),language:d.get('language'),region:d.get('setup-region')};}
function birthFormPatch(){const f=$('#setup-birth-form');if(!f)return birthDraft();const d=new FormData(f);return {date:d.get('birth-date'),time:d.get('time')||'',unknownTime:d.has('unknownTime'),place:d.get('birth-place')||'',timezone:d.get('timezone')||''};}

function homeScene(){return '<div class="home-scene" aria-hidden="true"></div>';}
function syncHomeScene(){
  const phone=$('#phone');
  // This room survives page renders and Tab changes; only its focus changes.
  if(!phone.querySelector(':scope > .home-scene'))phone.insertAdjacentHTML('afterbegin',homeScene());
  if(pixelVariant)initPixelRoom(phone.querySelector(':scope > .home-scene'));
  phone.dataset.roomScene=roomSceneRoutes.has(currentSceneRoute())?(ui.route==='home'?'home':'blurred'):'off';
}
function volumeButton(){return `<button type="button" class="scene-icon volume-toggle" data-action="toggle-sound" aria-pressed="${Boolean(ui.soundOn)}" aria-label="${ui.soundOn?'關閉聲音':'開啟聲音'}">${centeredVolumeIcon(!ui.soundOn)}</button>`;}
function conversationMarkup(messages){
  return messages.map((m,i)=>`<div class="conversation-message ${m.role==='user'?'own':''}" ${companionTyping&&m.role!=='user'&&i===messages.length-1?'hidden':''}><p>${esc(m.text)}</p></div>`).join('')+(companionTyping?`<div class="conversation-message">${loadingIndicatorMarkup(`${companionName()} 正在回覆…`)}</div>`:'');
}
function setHomeConversation(active){
  const entering=Boolean(active)&&!conversationActive;
  conversationActive=Boolean(active)&&ui.route==='home';
  const phone=$('#phone');phone.dataset.conversation=String(conversationActive);
  if(!conversationActive){clearTimeout(conversationEnterTimer);delete phone.dataset.conversationEntering;}
  else if(entering&&!prefersStillness(ui.motion)){phone.dataset.conversationEntering='true';clearTimeout(conversationEnterTimer);conversationEnterTimer=setTimeout(()=>{delete phone.dataset.conversationEntering;const log=$('#conversation-log');if(conversationActive&&log)log.scrollTop=log.scrollHeight;},450);}
  klinWorld?.setConversationMode?.(conversationActive);
  // In chat, the identity belongs to the header; keep the room itself in place.
  klinWorld?.setLayout?.({character:!conversationActive});
  const identity=$('.home-chat-identity');if(identity)identity.hidden=!conversationActive;
  const companion=$('.home-companion');if(companion)companion.hidden=conversationActive;
  const log=$('#conversation-log');
  if(log){log.hidden=!conversationActive;if(conversationActive)log.scrollTop=log.scrollHeight;}

  const replies=$('.conversation-replies');if(replies)replies.hidden=!conversationActive;
  const dialogue=$('.room-dialogue');if(dialogue)dialogue.setAttribute('aria-hidden',String(conversationActive));
}
function home(){
 const space=privateSpace(),messages=space.companionMessages,reply=messages.filter(m=>m.role!=='user').at(-1),turn=getCompanionTurn(state);
 return shell(`<div class="home-top"><button class="scene-icon" type="button" data-go="profile" aria-label="我的名片">${restoredControlIcon('profile')}</button><div class="home-chat-identity" ${conversationActive?'':'hidden'}><span class="home-chat-avatar" aria-hidden="true"><img src="${DEFAULT_CARD_AVATAR}" alt="" width="36" height="36" draggable="false"></span><span class="home-chat-name">${esc(companionName())}</span></div>${volumeButton()}</div><div class="room-dialogue" aria-live="polite" aria-hidden="${conversationActive}"><div class="room-speech">${companionTyping?loadingIndicatorMarkup('Klin 正在想…'):esc(ui.boopReply||reply?.text||'今天想和我聊點什麼？')}</div></div><button type="button" class="home-companion" data-action="boop" aria-label="輕觸 Klin" ${conversationActive?'hidden':''}>${spiritImage('成年態 Klin','','adult')}</button><div id="conversation-log" class="conversation-log" role="log" aria-label="你和 ${esc(companionName())} 的私人對話" aria-live="polite" ${conversationActive?'':'hidden'}>${conversationMarkup(messages)}</div><div class="home-chat-bottom">${!companionTyping?`<div class="conversation-replies" ${conversationActive?'':'hidden'}>${turn.replies.map(r=>`<button type="button" data-say="${esc(r.text)}">${esc(r.label)}</button>`).join('')}${turn.status==='matched'?'<button type="button" data-go="relations">去串門看看 ↗</button>':''}</div>`:''}<div class="home-chat-actions"><form class="home-composer" data-form="companion"><div class="composer-row">${voiceComposerMarkup()}<textarea name="message" id="private-message" rows="1" placeholder="和 ${esc(companionName())} 聊聊…" aria-label="和 ${esc(companionName())} 聊聊" maxlength="1000">${esc(ui.companionDrafts?.[actor()]||'')}</textarea><button class="send-button" type="submit" aria-label="發送給 ${esc(companionName())}" ${companionTyping?'disabled':''}>${sendArrow}</button></div></form><button type="button" class="visit-entry" data-go="relations" aria-label="串門">${restoredControlIcon('visit')}<span>串門</span></button></div></div>`,'home-page room-chat-page');
}
function companion(){const space=privateSpace();const messages=space.companionMessages.map((m,i)=>`<div class="message ${m.role==='user'?'own':''}" ${companionTyping&&i===space.companionMessages.length-1?'hidden':''}>${m.role==='user'?avatar(actor(),true):spiritAvatar()}<div class="message-content"><div class="bubble">${esc(m.text)}</div></div></div>`).join('');return shell(top(companionName())+`<div class="content messages" id="message-scroll">${messages}${companionTyping?`<div class="message">${spiritAvatar()}<div class="bubble"><span class="typing"><i></i><i></i><i></i></span></div></div>`:''}${space.pendingDemandSuggestion&&!companionTyping?`<div class="glass-card"><h4>找個人一起去？</h4><p class="small-note">先確認，再開始尋找。</p>${btn('整理需求','new-demand','compact')}${btn('先聊聊','dismiss-demand','ghost')}</div>`:''}${space.companionMessages.length<3?`<div class="suggestions"><button type="button" data-say="最近想認識一起看展的朋友">找人看展</button><button type="button" data-say="最近工作有點累，想慢慢聊聊">放鬆一下</button></div>`:''}</div><form class="chat-composer" data-form="companion"><div class="composer-row">${voiceComposerMarkup()}<textarea name="message" id="private-message" rows="1" placeholder="和我聊聊…" aria-label="私人訊息" maxlength="1000"></textarea><button class="send-button" type="submit" aria-label="發送給伙伴" ${companionTyping?'disabled':''}>${sendArrow}</button></div></form>`,'companion-page');}
function memories(){const items=privateSpace().memory.filter(m=>m.status!=='deleted');return shell(top('記憶','每一點了解，都可以由你修正')+content(`<p class="body-copy">這些是我目前了解到的你。<br>用來陪伴你，不會直接分享給別人。</p>${items.length?items.map(m=>`<article class="glass-card memory-card"><div class="tag-row">${tag(m.status==='pending'?'等你確認':'你已確認',m.status==='pending'?'':'green')}${tag('私人','quiet')}</div><p>${esc(m.text)}</p><div class="memory-source">來自：${esc(m.source)}</div><div class="memory-actions" style="margin-top:14px">${m.status==='pending'?tiny('是這樣的','confirm-memory',m.id):''}${tiny('修正','edit-memory',m.id)}${tiny('移除','delete-memory',m.id,'danger')}</div></article>`).join(''):empty('我們可以慢慢認識','聊聊你喜歡的事，我會把新的理解交給你確認。',btn('和伙伴聊聊','companion','compact'))}`,'with-nav')+nav('memory'));}
function friendsSheet(){
  const invs=state.invitations.filter(x=>x.fromId===actor()||x.toId===actor()).slice().reverse(),rels=state.relationships.filter(x=>x.members.includes(actor())).slice().reverse();
  const list=`<div class="section-label">朋友 <span>${rels.length}</span></div>${rels.length?`<div class="glass-card">${rels.map(r=>{const other=state.users[r.members.find(x=>x!==actor())];const msg=publicMessages(state,r.id).at(-1);return `<button type="button" class="row-button list-row" data-relationship="${r.id}">${avatar(other.id)}<span class="row-main"><strong>${esc(other.name)}</strong><small>${r.status!=='active'?'這段聯繫已結束':esc(msg?.text?.slice(0,26)||'從一句你好開始吧')}</small></span><span class="chevron">›</span></button>`;}).join('')}</div>`:`<p class="small-note" style="padding:8px 0 18px">還沒有新朋友。</p>`}<div class="section-label">邀約 <span>${invs.length}</span></div>${invs.length?`<div class="glass-card">${invs.map(inv=>`<button type="button" class="row-button list-row" data-invitation="${inv.id}">${avatar(inv.toId===actor()?inv.fromId:inv.toId)}<span class="row-main"><strong>${esc(inv.toId===actor()?inv.snapshot.name:state.users[inv.toId].name)}</strong><small>${({pending:inv.toId===actor()?'等你回應':'等待對方回應',accepted:'已建立聯繫',declined:'這次先不了',withdrawn:'已撤回',expired:'已到期'})[inv.status]}</small></span><span class="chevron">›</span></button>`).join('')}</div>`:`<p class="small-note" style="padding:8px 0">暫無邀約。</p>`}`;
  showSheet('朋友與邀約',list);
}

function relations(){
 const friends=getDemoFriends(state),query=String(ui.networkQuery||'').trim().toLocaleLowerCase();
 const matches=friend=>!query||`${friend.name} ${(friend.interests||[]).join(' ')} ${friend.recent||''}`.toLocaleLowerCase().includes(query),visibleCount=friends.filter(matches).length;
 return shell(top('串門')+`<div class="network-search">${uiIcon('search')}<input type="search" id="network-query" aria-label="搜尋朋友或話題" placeholder="搜尋朋友或話題" autocomplete="off" value="${esc(ui.networkQuery||'')}"><button type="button" data-action="clear-network-search" aria-label="清除搜尋" ${query?'':'hidden'}>×</button></div><div class="network-search-status" role="status">${query?`找到 ${visibleCount} 位朋友`:''}</div>${renderFriendNetwork({friends,users:state.users,query,ownName:me().name,ownAvatar:me().cardAvatar})}`,'friends-lounge');
}
function filterNetwork(value){
 ui.networkQuery=value;save();const query=value.trim().toLocaleLowerCase();let count=0;
 document.querySelectorAll('.network-friend').forEach(node=>{const match=!query||node.dataset.search.includes(query);node.hidden=!match;if(match)count++;const path=document.querySelector(`.network-connections path[data-friend-id="${node.dataset.id}"]`);if(path)path.toggleAttribute('hidden',!match);});
 const status=$('.network-search-status');if(status)status.textContent=query?`找到 ${count} 位朋友`:'';
 const empty=$('.network-empty');if(empty)empty.hidden=count>0;const clear=$('[data-action="clear-network-search"]');if(clear)clear.hidden=!query;
}

function sharedPeople(){const rel=latestRelationship();return rel?`<div class="shared-people">${rel.members.map(id=>`<span class="shared-person">${avatar(id,true)}<strong>${esc(state.users[id]?.name)}</strong></span>`).join('')}</div>`:'';}
function connected(){return chat();}
function invitePage(){return relations();}

function chat(){
 const rel=latestRelationship();if(!rel)return shell(top('共同空間')+content(empty('等你們都願意','互相接受邀約，就能一起坐坐。',btn('查看邀約','invite'))));
 const other=state.users[rel.members.find(x=>x!==actor())],msgs=publicMessages(state,rel.id);
 return shell(top(esc(other.name),'',`<button type="button" class="scene-icon" data-action="relationship-options" aria-label="管理這段聯繫">⋯</button>`)+sharedPeople()+`<div class="shared-messages" id="message-scroll" role="log" aria-label="共同對話">${msgs.map(m=>`<div class="message ${m.senderId===actor()?'own':''}"><div class="message-content"><div class="message-label">${esc(state.users[m.senderId].name)}</div><div class="bubble">${esc(m.text)}</div>${m.status==='failed'?`<button type="button" class="text-button" data-retry="${m.id}">傳送失敗 · 重試</button>`:''}</div></div>`).join('')}${!msgs.length?`<div class="shared-first-hello"><p>坐近一點，從一句你好開始。</p><button type="button" class="tiny-btn" data-public-say="嗨，很高興認識你！">嗨，很高興認識你！ ↗</button></div>`:''}</div><form class="chat-composer shared-composer" data-form="public-message">${rel.status==='active'?`<button type="button" class="private-entry" data-action="private-help">私下問問 ${esc(companionName())}</button><div class="composer-row"><textarea id="public-message" name="message" rows="1" placeholder="和 ${esc(other.name)} 說句話…" aria-label="發送給 ${esc(other.name)} 的訊息" maxlength="1000">${esc(privateSpace().publicDraft)}</textarea><button class="send-button" type="submit" aria-label="發送給朋友">${sendArrow}</button></div>`:`<p class="scene-hint">這段聯繫已結束。</p>${btn('回到房間','home')}`}</form>`,'shared-space shared-chat-page');
}
function roomMemories(){
 const moments=state.relationships.filter(rel=>rel.members.includes(actor())&&rel.sharedMoment?.completedAt);
 showSheet('小屋里留下的回响',`<p>从第一次叫出彼此的名字，到后来一起经历的小事，都留在这里。</p><div class="realm-memory-list"><article><strong>第一次见面</strong><p>你和 ${esc(companionName())}，有了自己的小屋。</p></article>${moments.map(rel=>`<article><strong>和 ${esc(state.users[rel.members.find(id=>id!==actor())]?.name)} 的回响</strong><p>${rel.members.map(id=>SHARED_MOMENT_OPTIONS.find(option=>option.id===rel.sharedMoment.choices[id])?.label||'').map(esc).join(' · ')}</p></article>`).join('')}</div><p class="small-note">这里不会把私人聊天自动分享给其他人。</p>${btn('回到小屋','close-sheet')}`);
}
function sharedMomentSheet(){
 const rel=latestRelationship();if(!rel||rel.status!=='active')return;
 const moment=rel.sharedMoment,other=rel.members.find(id=>id!==actor()),own=moment?.choices?.[actor()],otherChoice=moment?.choices?.[other],label=id=>SHARED_MOMENT_OPTIONS.find(option=>option.id===id)?.label||'还在想';
 showSheet(moment?.completedAt?'你們留下的回響':'一起選一個當下',`<p>如果現在有一小段空閒，你想和對方一起做什麼？不一樣的答案，也可以聊聊原因。</p>${SHARED_MOMENT_OPTIONS.map(option=>btn(esc(option.label),'choose-moment','white',`data-choice="${option.id}" aria-pressed="${own===option.id}" ${moment?.completedAt?'disabled':''}`)).join('')}${own?`<p>你選擇了「${label(own)}」</p><p>${esc(state.users[other]?.name)}${otherChoice?'選擇了「'+label(otherChoice)+'」':'還在想一想'}</p>`:''}${moment?.completedAt?'<p>這次相遇，已經在共同小屋留下了一點痕跡。</p>':own&&otherChoice?btn(moment?.confirmed?.[actor()]?'等對方也點頭':'一起留在房間裡','keep-moment'):''}${btn('繼續聊天','close-sheet','ghost')}`);
}
function visitSheet(){
 const friend=getDemoFriends(state).find(item=>item.id===ui.selectedVisitId);if(!friend)return;
 const phase=ui.visitPhase||'idle';
 showSheet(friend.name,`<p>${esc(friend.recent)}</p><p role="status">${phase==='knocking'?'輕輕敲兩下，等門裡的人回應。':phase==='open'?'門裡傳來回應：「我在，進來坐坐？」':'和 Klin 一起，去打聲招呼吧。'}</p>${phase==='knocking'?'':btn(phase==='open'?'進去坐坐':'輕輕敲門',phase==='open'?'enter-visit':'knock-visit','white',`data-id="${friend.id}"`)}${btn(phase==='knocking'?'先回門廊':'返回','cancel-visit','ghost')}`);
 ui.visitDialog=true;
}
function requestVisit(friendId){
 clearTimeout(visitTimer);visitAttempt++;
 const friend=getDemoFriends(state).find(item=>item.id===friendId);if(!friend)return;
 ui.selectedVisitId=friendId;ui.visitPhase=friend.connected?'open':'idle';save();render(false);visitSheet();
}
function knockVisit(friendId){
 const friend=getDemoFriends(state).find(item=>item.id===friendId);if(!friend)return;
 clearTimeout(visitTimer);const token=++visitAttempt;ui.selectedVisitId=friendId;ui.visitPhase='knocking';save();render(false);klinWorld?.interact('knock');if(ui.visitDialog)visitSheet();
 visitTimer=setTimeout(()=>{if(token!==visitAttempt||ui.selectedVisitId!==friendId)return;ui.visitPhase=ui.route==='relations'?'open':'idle';save();if(ui.route==='relations'){render(false);if(ui.visitDialog)visitSheet();}},prefersStillness(ui.motion)?0:1350);
}
function myCard(){return publicCardData(me(),{includeRegion:me().shareRegion===true,tags:me().cardTags||[],avatar:me().cardAvatar});}
function refreshVisibleCardArtwork(){
 if(!pendingCardFontRefresh||stopTransition||$('.card-in-handoff'))return;
 pendingCardFontRefresh=false;
 const ownCard=myCard();
 for(const card of document.querySelectorAll('#app [data-business-card],#sheet[open] [data-business-card]')){
  const choice=card.closest('.card-design-choice');
  const data=choice?{...ownCard,design:Number(choice.dataset.design)}:card.closest('.public-card-page')?(sharedCard||ownCard):ownCard;
  const focusedTag=[...card.querySelectorAll('.bc-tag')].indexOf(document.activeElement);
  const focusedAvatar=card.querySelector('.bc-avatar')===document.activeElement;
  const template=document.createElement('template');
  template.innerHTML=cardMarkup(data,{compact:card.classList.contains('is-compact'),showAllTags:!!card.querySelector('[data-action="view-card-tags"]'),editable:!!card.querySelector('.bc-avatar[data-action="edit-card"]')});
  // Preserve the article used by the handoff and every form/input around it.
  card.replaceChildren(...template.content.firstElementChild.childNodes);
  if(focusedTag>=0)card.querySelectorAll('.bc-tag')[focusedTag]?.focus({preventScroll:true});
  else if(focusedAvatar)card.querySelector('.bc-avatar')?.focus({preventScroll:true});
 }
}
function cardTools(editable=false){return editable?'<div class="card-tools"><button type="button" data-action="choose-card-design">更換樣式</button><button type="button" data-action="edit-card"><img src="assets/ui/pencil-square.svg" alt="" aria-hidden="true">編輯</button></div>':'';}

function chooseCardDesign(){
 const data=myCard(),current=resolveCardDesign(data).layout;
 showSheet('選一張像你的名片',`<div class="card-design-grid">${CARD_DESIGN_NAMES.map((name,index)=>`<button type="button" class="card-design-choice" data-action="select-card-design" data-design="${index*7}" aria-pressed="${current===index}" aria-label="${name}樣式">${cardMarkup({...data,design:index*7},{compact:true})}<span>${name}</span></button>`).join('')}</div>${btn('再生成一張','regenerate-card-design','kn-glass-control')}`);
}
function profile(){return shell(top('我的名片','',`<button class="scene-icon" type="button" data-action="account-menu" aria-label="帳號選單">${restoredControlIcon('more')}</button>`)+`<div class="profile-stage">${cardMarkup(myCard(),{showAllTags:true,editable:true})}${cardTools(true)}</div><div class="profile-footer"><div class="card-actions split-buttons">${btn('保存圖片','download-card','white')}${btn('分享名片','share-card')}</div></div>`,'profile-card-page');}
function publicCardPage(){const data=sharedCard||myCard();return shell(`<header class="page-top"><button type="button" class="icon-button" data-action="leave-card" aria-label="返回">${backIcon}</button><div><h2>${sharedCard?'你好，新朋友':'訪客眼中的你'}</h2></div></header><div class="profile-stage">${cardMarkup(data,{showAllTags:true})}</div><div class="profile-footer">${btn(sharedCard?'認識我的 Klin':'回到我的名片','leave-card')}</div>`,'public-card-page');}
function editCard(){
 cardAvatarDraft=normalizeCardAvatar(me().cardAvatar);avatarUploadSequence++;cardAvatarUploading=false;
 const tags=normalizePersonalityTags(me().cardTags||[]);
 showSheet('編輯名片',`<form data-form="profile"><div class="avatar-editor"><span class="avatar-editor-preview" id="card-avatar-preview">${cardAvatarDraft?`<img src="${esc(cardAvatarDraft)}" alt="你的頭像">`:`<img src="${DEFAULT_CARD_AVATAR}" alt="預設頭像">`}</span><div><button type="button" class="avatar-upload-button" data-action="choose-card-avatar">${cardAvatarDraft?'更換頭像':'上傳頭像'}</button><input id="card-avatar-upload" type="file" accept="image/png,image/jpeg,image/webp" class="sr-only"><button type="button" class="text-button" data-action="remove-card-avatar" ${cardAvatarDraft?'':'hidden'}>移除</button><p class="small-note" id="avatar-upload-status">頭像會顯示在名片、分享連結和保存圖片中</p></div></div>${field('你的名字','profile-name',me().name,'maxlength="18"')}<div class="field"><label for="bio">一句話介紹自己</label><textarea id="bio" name="bio" maxlength="160" placeholder="喜歡什麼？最近想一起做什麼？">${esc(me().bio)}</textarea></div><div class="field"><label for="card-personality-tags">我的個性標籤 · 最多 7 個</label><input class="input" id="card-personality-tags" name="cardTags" value="${esc(tags.join('，'))}" maxlength="160" placeholder="例如：AI、夜貓子、攝影控"><div class="personality-tag-suggestions">${['AI','ENFP','夜貓子','電影迷','攝影控','慢熱','咖啡腦袋'].map(t=>`<button class="tiny-btn" type="button" data-action="add-card-tag" data-tag="${t}" aria-pressed="${tags.includes(t)}">${t}</button>`).join('')}</div></div><label class="check"><input type="checkbox" name="shareRegion" ${me().shareRegion?'checked':''}>顯示我的城市：${esc(me().region)}</label><button type="submit" class="btn" style="margin-top:20px">儲存名片</button></form>`);
}
async function uploadCardAvatar(file){
 if(!file)return;const sequence=++avatarUploadSequence;cardAvatarUploading=true;const submit=$('[data-form="profile"] button[type="submit"]');if(submit)submit.disabled=true;const status=$('#avatar-upload-status');if(status)status.textContent='正在準備頭像…';
 try{const avatar=await prepareAvatar(file);if(sequence!==avatarUploadSequence||!$('#sheet').open)return;cardAvatarDraft=avatar;$('#card-avatar-preview').innerHTML=`<img src="${esc(avatar)}" alt="你的頭像">`;$('[data-action="remove-card-avatar"]').hidden=false;$('#avatar-upload-status').textContent='儲存名片後生效';}
 catch(error){if(sequence===avatarUploadSequence&&$('#avatar-upload-status'))$('#avatar-upload-status').textContent=error.message;}
 finally{if(sequence===avatarUploadSequence){cardAvatarUploading=false;const submit=$('[data-form="profile"] button[type="submit"]');if(submit)submit.disabled=false;}}
}

function shareCardSheet(){const native=typeof navigator.share==='function';showSheet('分享名片',`<div class="card-share-sheet"><div class="card-share-preview">${cardMarkup(myCard(),{compact:true})}</div><div class="card-share-actions">${native?btn('分享給朋友','native-share-card','kn-glass-control card-share-primary'):''}${btn('複製連結','copy-card-link','kn-glass-control')}${btn('儲存圖片','download-card','kn-glass-control')}</div><div id="card-share-status" class="card-share-status" role="status" aria-live="polite"></div></div>`);}
function accountMenuSheet(){showSheet('帳號',`<div class="account-menu-actions">${btn('登出','logout','kn-glass-control')}</div>`);}

const views={landing,'public-card':publicCardPage,'setup-basics':setupBasics,'setup-birth':setupBirth,welcome,login:()=>auth(false),register:()=>auth(false,true),verify:()=>auth(true),home,relations,chat,profile,invite:invitePage,connected};
const stages=[['初次相遇','welcome',['welcome','login','register','verify','landing','setup-basics','setup-birth']],['我的小世界','home',['home']],['去朋友家坐坐','relations',['relations','invite','connected','chat']],['我的名片','profile',['profile','public-card']]];
const guides={welcome:['從一句你好開始','和 Klin 聊聊，在對話裡慢慢認識彼此。'],landing:['一次，聊一件事','生日、出生時辰、性別、出生地與稱呼依序收集；私人資料不會進入名片。'],home:['把想法告訴 Klin','陪聊與認識朋友，都從自然對話開始。'],relations:['朋友聚在一起','選一位朋友，坐下來聊聊。這裡的人物與對話是本地示範。'],chat:['你們的對話','需要靈感時，可以私下問問 Klin。'],profile:['帶著你的一點個性','標籤預設展示，也可以編輯或移除。'],'public-card':['分享的那一面','只包含你選擇公開的名片內容。'],login:['帳號密碼演示','預填的帳號與密碼可直接登錄本地示範。'],verify:['手機號演示','本地驗證碼 123456。'],'setup-basics':['修改資料','更新你的稱呼與語言。'],'setup-birth':['私人資料','出生資料只在你與 Klin 之間。']};


function isRoomOverlayRoute(route){return ['profile','public-card'].includes(route)||(['setup-basics','setup-birth'].includes(route)&&landingComplete(state));}
function currentSceneRoute(){return isRoomOverlayRoute(ui.route)?(['home','relations','chat','connected','welcome','landing'].includes(ui.sceneRoute)?ui.sceneRoute:state.session.authenticated&&landingComplete(state)?'home':'welcome'):ui.route;}
function currentWorldLayout(){const route=currentSceneRoute();if(route==='relations')return {x:.5,footY:.62,height:.18,world:'porch',blur:false,mini:false,character:false};if(route==='landing')return {x:.5,footY:getOnboardingTurn(state).key==='birthTime'?.30:.36,height:getOnboardingTurn(state).key==='birthTime'?.17:.22,world:'welcome',blur:false,mini:false};return (conversationActive||['profile','public-card'].includes(ui.route)&&ui.sceneConversation)&&route==='home'?{world:'home',blur:false,mini:false,character:false}:undefined;}
function syncWorldAnchor(){
  if(!worldReady||['welcome','login','register','verify','landing'].includes(ui.route)||klinWorld.status?.action!=='idle')return;
  const layout=currentWorldLayout();if(layout)klinWorld.setLayout(layout,{immediate:true});
}
// Focus only a newly revealed text turn. Playback, dialogs and voice capture
// keep ownership of focus; receiving other async events never steals it back.
const focusedLandingInputs = new WeakSet();
function focusLandingComposer(){
 if(ui.route!=='landing'||!landingVideoScene?.readyForInput||sceneLoading?.visible||closeContractUI||$('#sheet')?.open||cleanCommunication?.isCapturing())return;
 const input=$('#onboarding-answer');
 if(!input||focusedLandingInputs.has(input)||input.closest('[inert]'))return;
 focusedLandingInputs.add(input);input.focus({preventScroll:true});
}
function syncLandingVideo(){
 if(ui.route==='landing'&&!landingVideoScene)landingVideoScene=createLandingVideoScene({phone:$('#phone'),
  onPresentation:next=>{setScenePending('landing-video',ui.route==='landing'&&!next.hasHeldFrame&&['loading','settling'].includes(next.state),'landing');queueMicrotask(()=>{syncNarration();focusLandingComposer();});},
  onMediaChange:next=>{filmAudioState=next;sceneSound.syncFilm(next);}
 });
 landingVideoScene?.update({active:ui.route==='landing',key:getOnboardingTurn(state).key,reducedMotion:prefersStillness(ui.motion)});
}
function ensureExperience(){
 if(sceneLoading)return;
 const phone=$('#phone');
 sceneLoading=createLoadingState({host:phone,blockTargets:[$('#app')],onChange:()=>queueMicrotask(()=>{syncNarration();focusLandingComposer();}),onTimeout:({key})=>{
  expiredLoading.add(key);
  if(key==='world'){worldFailed=true;setKlinLoadingState(phone,'fallback');}
 }});
 phone.querySelector('.scene-loading-retry')?.remove();
 sceneImages=createSceneAssetReadiness({loading:sceneLoading,onChange:()=>queueMicrotask(syncNarration)});
 phone.insertAdjacentHTML('beforeend',volumeButton().replace('scene-icon volume-toggle','scene-icon volume-toggle landing-volume-toggle kn-glass-control'));
 phone.dataset.bootReady='true';
}
function setScenePending(key,pending,scene){
 if(!pending)expiredLoading.delete(key);
 sceneLoading?.setPending(key,pending&&!expiredLoading.has(key),{scene});
}
function syncAudioControls(){
 const phone=$('#phone');phone.dataset.sound=ui.soundOn?'on':'off';
 for(const button of phone.querySelectorAll('.volume-toggle')){
  button.innerHTML=centeredVolumeIcon(!ui.soundOn);button.setAttribute('aria-pressed',String(Boolean(ui.soundOn)));
  button.setAttribute('aria-label',ui.soundOn?'關閉聲音':'開啟聲音');
 }
 const floating=$('.landing-volume-toggle');if(floating)floating.hidden=ui.route!=='landing';
}
function syncExperience(){
 ensureExperience();sceneLoading.setReducedMotion(prefersStillness(ui.motion));syncAudioControls();
 $('#phone').style.setProperty('--kn-room-scene-image',`url("${HOME_SCENE_ASSET}")`);
 $('#phone').style.setProperty('--kn-welcome-scene-image',`url("${WELCOME_SCENE_ASSET}")`);
 $('#phone').style.setProperty('--kn-visit-scene-image',`url("${VISIT_SCENE_ASSET}")`);
 $('#phone').style.setProperty('--kn-shared-scene-image',`url("${SHARED_SCENE_ASSET}")`);
 const opening=['welcome','login','register','verify'].includes(ui.route),landing=ui.route==='landing';
 const scene=landing?'landing':opening?'welcome':'room';
 const images=landing?[]:[opening?LOGIN_VIDEO_POSTER:ui.route==='relations'?VISIT_SCENE_ASSET:HOME_SCENE_ASSET];
 if(opening)images.push('assets/brand-20261026/knoknok-handwritten-white.png');
 else if(!landing)images.push(klinAssets.adult);
 if(ui.route==='relations')images.push(DEFAULT_CARD_AVATAR,...['wood','water','earth'].map(kind=>`assets/scenes-20261026-41/house-${kind}.webp`));
 if(['profile','public-card'].includes(ui.route))images.push('assets/brand-20261026/knoknok-handwritten-white.png','assets/cloud-realm-20261019/arrival.webp',(ui.route==='public-card'&&sharedCard?sharedCard.avatar:me().cardAvatar)||DEFAULT_CARD_AVATAR);
 if(['chat','connected'].includes(ui.route))images.push(SHARED_SCENE_ASSET);
 sceneImages.update({key:ui.route,urls:images,scene});
 setScenePending('world',!opening&&!landing&&!worldReady&&!worldFailed,'room');
 if(!landing){setScenePending('landing-video',false,'landing');sceneSound.syncFilm({active:false,playing:false,time:0});}
 queueMicrotask(syncNarration);
}
function syncNarration(){
 if(!ui.soundOn||document.hidden||sceneLoading?.visible||!sceneImages?.ready||closeContractUI)return;
 if(ui.route==='landing'){
  if(!landingVideoScene?.readyForInput)return;
  const turn=getOnboardingTurn(state);
  if(landingReveal?.key===turn.key&&landingReveal.count<getOnboardingMessages(state).length)return;
  const scope=`landing:${turn.key}:${ui.onboardingCoda||0}`;
  const texts=[...document.querySelectorAll('.onboarding-message.is-klin p,.onboarding-reading h3,.onboarding-reading>p')].map(node=>node.textContent.trim()).filter(Boolean);
  sceneSound.speakSequence(texts.map((text,index)=>({text,key:`${scope}:${index}:${text}`})),{scope,lang:'zh-CN'});
 }else if(ui.route==='home'&&!companionTyping){
  const node=conversationActive?[...document.querySelectorAll('.conversation-message:not(.own):not([hidden]) p')].at(-1):$('.room-speech');
  const text=node?.textContent.trim();
  if(text)sceneSound.speakSequence([{text,key:`home:${actor()}:${ui.boopCount||0}:${text}`}],{scope:`home:${actor()}`,lang:me().language==='粵語'?'zh-HK':me().language==='English'?'en-US':'zh-CN'});
 }
}
function resetSound(){audioToggleSequence++;ui.soundOn=false;sceneSound.setEnabled(false);sceneSound.resetSession();filmAudioState={active:false,playing:false,time:0};syncAudioControls();}
function syncLoginScene(){
  ensureExperience();
  if(!loginScene)loginScene=createLoginSceneBridge({phone:$('#phone'),onPending:pending=>setScenePending('login-video',pending,'welcome')});
  const active=['welcome','login','register','verify'].includes(ui.route);
  loginScene.update({route:ui.route,active,reducedMotion:prefersStillness(ui.motion)});
  klinWorld?.setActive?.(!active&&ui.route!=='landing');
}
function initWorld({prewarm=false}={}) {
  if(klinWorld || worldFailed || pixelVariant || (!prewarm&&['welcome','login','register','verify','landing'].includes(ui.route)))return;
  setKlinLoadingState($('#phone'),'loading');
  const host=document.createElement('div');
  host.className='klin-world-host';host.setAttribute('aria-hidden','true');
  const placeWorld=()=>{
    const filmOwnsScene=['welcome','login','register','verify','landing'].includes(ui.route);
    klinWorld?.setActive?.(!filmOwnsScene);
    // Preload the adult room behind the film; never initialize landing's old
    // native appearance/evolution while the supplied movie owns that sequence.
    klinWorld?.setPage(filmOwnsScene?'home':currentSceneRoute(),{stage:filmOwnsScene?'adult':currentCompanionStage(),layout:filmOwnsScene?undefined:currentWorldLayout(),immediate:true});
  };
  host.addEventListener('klinworlderror',()=>{worldReady=false;worldFailed=true;setKlinLoadingState($('#phone'),'fallback');setScenePending('world',false,'room');});
  host.addEventListener('klinworldready',()=>{worldReady=true;worldFailed=false;setKlinLoadingState($('#phone'),'ready');placeWorld();setScenePending('world',false,'room');});
  $('#phone').prepend(host);
  try {
    klinWorld=createKlinWorld({host,reducedMotion:prefersStillness(ui.motion)});
    placeWorld();
    Promise.resolve(klinWorld?.ready).then(ok=>{
      if(ok===false||!klinWorld){worldFailed=true;klinWorld=null;host.remove();setKlinLoadingState($('#phone'),'fallback');setScenePending('world',false,'room');return;}
      worldReady=true;worldFailed=false;setKlinLoadingState($('#phone'),'ready');placeWorld();setScenePending('world',false,'room');
    }).catch(()=>{worldReady=false;worldFailed=true;setKlinLoadingState($('#phone'),'fallback');setScenePending('world',false,'room');});
  } catch { worldReady=false;worldFailed=true;setKlinLoadingState($('#phone'),'fallback');setScenePending('world',false,'room'); }
}
function setHomeEntryControlsHidden(hidden){
  const page=$('#app > .home-page');
  page?.classList.toggle('home-entry-pending',hidden);
  for(const control of page?.querySelectorAll('.home-top,.home-chat-bottom')||[])control.inert=hidden;
}
function render(animate=false,motion={}){
  ensureExperience();
  // Incoming messages may refresh the same route during travel. Keep the UI
  // cleared until arrival instead of exposing it over the moving character.
  if(!animate&&stopTransition&&$('#app > .page[data-screen]')?.dataset.screen===ui.route){pendingSceneRefresh=true;return;}
  // Keep the native recognition session alive when incoming content refreshes home.
  // Navigation still disposes it; a finished capture applies the queued refresh.
  if(['home','landing'].includes(ui.route)&&$('#app > .page[data-screen]')?.dataset.screen===ui.route&&cleanCommunication?.isCapturing()){
    voiceRefreshPending=true;return;
  }
  voiceRefreshPending=false;
  const sequence=++renderSequence;
  if(comparisonMode)window.parent.postMessage({type:'knok-compare-state',route:ui.route,character:pixelVariant?'pixel':'soft'},location.origin);
  if(['demand','preview','search','candidate','onboard','initializing','companion','memory'].includes(ui.route))ui.route=setupRoute();
  if(ui.route==='invite')ui.route='relations';
  if(!views[ui.route])ui.route=state.session.authenticated?'home':'welcome';
  pendingSceneRefresh=false;
  const preserveWorld=!animate&&$('#app > .page[data-screen]')?.dataset.screen===ui.route;
  const cancel=stopTransition;stopTransition=null;cancel?.({preserveWorld});
  const focusedComposer=ui.route==='landing'?'#onboarding-answer':'#private-message';
  const restoreComposerFocus=(ui.route==='landing'||conversationActive&&ui.route==='home')&&document.activeElement===$(focusedComposer);
  const selection=restoreComposerFocus?[$(focusedComposer).selectionStart,$(focusedComposer).selectionEnd]:null;
  const app=$('#app'),oldPage=app.querySelector('.page'),oldScroll=$('#message-scroll')?.scrollTop;
  const routeChanged=oldPage?.dataset.screen!==ui.route;
  const sceneOverlay=isRoomOverlayRoute(ui.route),wasOverlay=isRoomOverlayRoute(oldPage?.dataset.screen);
  const cardEntry=['profile','public-card'].includes(ui.route)&&oldPage?.dataset.screen==='home'&&worldReady;
  const useTransition=animate&&oldPage&&routeChanged&&!['welcome','login','register','verify','landing'].includes(ui.route)&&oldPage.dataset.screen!=='welcome'&&((!sceneOverlay&&!wasOverlay)||cardEntry)&&!prefersStillness(ui.motion);
  const previous=useTransition?oldPage:null;
  const scrollPositions=useTransition?[...oldPage.querySelectorAll('.content')].map(node=>({node,top:node.scrollTop,left:node.scrollLeft})):[];
  const source=useTransition?captureCompanion(oldPage,$('#phone')):null;
  cleanDatePickers?.();cleanFormControls?.();cleanCommunication?.dispose();cleanCommunication=null;
  app.innerHTML=views[ui.route]();
  if(ui.route==='home')setHomeEntryControlsHidden(useTransition);
  cleanFormControls=initFormControls(app);cleanDatePickers=initDatePickers(app);initTypography(app);
  if(['chat','connected'].includes(ui.route)){const rel=latestRelationship();klinWorld?.setParticipants?.((rel?.members||[]).map(id=>state.users[id]),{activeId:actor()});}
  if(ui.route==='home')cleanCommunication=bindVoiceComposer({root:$('#app>.home-page'),lang:()=>me().language,getDraft:()=>ui.companionDrafts?.[actor()]||'',onDraft:text=>{ui.companionDrafts={...(ui.companionDrafts||{}),[actor()]:text};save();},onConversationStart:()=>setHomeConversation(true),onStatus:flushVoiceRefresh});
  if(ui.route==='landing'&&$('#onboarding-answer'))cleanCommunication=bindVoiceComposer({root:$('#app>.conversation-onboarding'),inputSelector:'#onboarding-answer',lang:'zh-CN',getDraft:()=>ui.onboardingDraft||'',onDraft:text=>{ui.onboardingDraft=text;save();},onConversationStart:()=>sceneSound.stopSpeech(),onStatus:flushVoiceRefresh});
  syncHomeScene();syncLoginScene();syncLandingVideo();initWorld();
  syncExperience();focusLandingComposer();
  $('#phone').dataset.conversation=String(conversationActive&&ui.route==='home');
  $('#phone').dataset.worldPage=currentSceneRoute();
  $('#phone').dataset.sceneOverlay=String(sceneOverlay);
  klinWorld?.setReducedMotion(prefersStillness(ui.motion));
  klinWorld?.setPortalState?.('idle');
  if(ui.route==='relations'){const friends=getDemoFriends(state),index=Math.max(0,friends.findIndex(friend=>friend.id===ui.selectedVisitId));klinWorld?.setLoungeState?.({count:friends.length,activeId:String(index),phase:ui.visitPhase||'idle'});}
  klinWorld?.setRealmState?.({recognition:ui.route==='landing'?Math.min(1,(getOnboardingTurn(state).progress.index-1)/6):1,conversationPhase:ui.route==='landing'?getOnboardingTurn(state).key:null,thinking:ui.route==='landing'&&landingReveal?.count<getOnboardingMessages(state).length,resting:ui.realmResting===true,keepsake:state.relationships.some(rel=>rel.members.includes(actor())&&rel.sharedMoment?.completedAt)});
  if(!useTransition&&!['welcome','login','register','verify','landing'].includes(ui.route)&&(!sceneOverlay||!oldPage))klinWorld?.setPage(currentSceneRoute(),{stage:currentCompanionStage(),layout:currentWorldLayout(),immediate:!oldPage||routeChanged});
  if(ui.route==='home'&&!useTransition)klinWorld?.setConversationMode?.(conversationActive);
  if(conversationActive&&ui.route==='home'){const log=$('#conversation-log');if(log)log.scrollTop=log.scrollHeight;}
  if(restoreComposerFocus){const composer=$(focusedComposer);composer?.focus({preventScroll:true});composer?.setSelectionRange(...selection);}
  
  if(!animate||useTransition)$('.page')?.classList.add('reenter');
  syncAuthCountdown();
  const status=$('#status-icons');if(status)status.src='assets/figma-20261009/status.svg';
  document.body.classList.toggle('reduced-motion',ui.motion);
  if(pixelVariant)syncCompanionAnimation();
  $('#motion-toggle').setAttribute('aria-pressed',String(ui.motion));
  const stage=Math.max(0,stages.findIndex(x=>x[2].includes(ui.route)));
  const labels={landing:'和 Klin 打個招呼','public-card':'名片預覽','setup-basics':'基本資料','setup-birth':'出生資料',initializing:'準備伙伴',welcome:'歡迎來到 Knoknok',login:'帳號密碼登錄',register:'註冊',verify:'手機驗證碼',onboard:'認識你的伙伴',home:'我的小世界',companion:'和伙伴聊聊',memory:'伙伴的記憶',demand:'整理需求',preview:'分享預覽',search:'認識新朋友',candidate:'候選資料',invite:'雙向邀約',connected:'新的聯繫',relations:'串門',chat:'共同聊天',profile:'我的名片'};
  $('#screen-label').textContent=`${String(stage+1).padStart(2,'0')} / ${labels[ui.route]||'對話'}`;
  $('#stage-count').textContent=`0${stage+1} / 0${stages.length}`;
  $('#journey').innerHTML=stages.map(([label,route],i)=>{let enabled=i===0||state.session.authenticated&&(actor()==='b'||landingComplete(state));return `<button type="button" class="journey-step ${i===stage?'current':''} ${i<stage?'done':''}" data-go="${route}" ${!enabled?'disabled':''}><span class="step-num">${i<stage?'✓':`0${i+1}`}</span><span>${label}</span></button>`;}).join('');
  const g=guides[ui.route]||guides.home;$('#guide-title').textContent=g[0];$('#guide-copy').textContent=g[1];$('#guide-actions').innerHTML=guideButtons();$('#scenario-controls').innerHTML=scenarioControls();
  if(['chat','companion'].includes(ui.route)){const s=$('#message-scroll');if(s)s.scrollTop=animate||oldScroll===undefined?s.scrollHeight:Math.max(oldScroll,s.scrollHeight);}
  const arrived=()=>{
    if(sequence!==renderSequence)return;
    stopTransition=null;syncWorldAnchor();
    if(ui.route==='home')setHomeEntryControlsHidden(false);
    refreshVisibleCardArtwork();
    if(pendingSceneRefresh){pendingSceneRefresh=false;queueMicrotask(()=>render(false));}
  };
  if(animate){
    $('.page h2')?.setAttribute('tabindex','-1');
    if(previous)stopTransition=transitionScene({host:$('#phone'),app,previous,current:app.querySelector('.page'),source,world:worldReady?klinWorld:null,stage:currentCompanionStage(),layout:currentWorldLayout(),scrollPositions,direction:motion.direction,onFinish:arrived});
    else {$('.page h2')?.focus({preventScroll:true});arrived();}
  }else{if(ui.route==='home')setHomeEntryControlsHidden(false);refreshVisibleCardArtwork();}
}

function flushVoiceRefresh(state){
  // Keep the just-received failure visible instead of replacing it with idle UI.
  if(['error','unsupported'].includes(state?.status))return;
  if(!voiceRefreshPending||cleanCommunication?.isCapturing())return;
  const composer=cleanCommunication;
  queueMicrotask(()=>{
    if(!voiceRefreshPending||!['home','landing'].includes(ui.route)||cleanCommunication!==composer||composer?.isCapturing())return;
    voiceRefreshPending=false;render(false);
  });
}

function guideButtons(){if(ui.route==='chat'&&latestRelationship()?.status==='active')return `<button class="review-btn" type="button" data-action="simulate-reply">模擬朋友回覆</button>`;return '';}
function scenarioControls(){return `<div class="scenario-group"><button class="review-btn" type="button" data-action="reset">重新開始</button></div><p class="small-note">對話與朋友均為本地示範。</p>`;}

let cleanSheetDismiss;
function showSheet(title,body){cleanSheetDismiss?.();cleanSheetDates?.();cleanSheetControls?.();const dialog=$('#sheet');dialog.classList.toggle('card-editor-sheet',body.includes('data-form="profile"'));$('#sheet-content').innerHTML=`<div class="sheet-inner"><div class="sheet-handle"></div><div class="sheet-title"><h3 id="sheet-title" tabindex="-1" autofocus>${esc(title)}</h3></div>${body}</div>`;dialog.setAttribute('aria-labelledby','sheet-title');if(!dialog.open)dialog.showModal();$('#phone').classList.add('sheet-open');if(!$('#phone > .phone-scrim'))$('#phone').insertAdjacentHTML('beforeend','<div class="phone-scrim" aria-hidden="true"></div>');cleanSheetControls=initFormControls(dialog);cleanSheetDates=initDatePickers(dialog);initTypography(dialog);positionSheet();cleanSheetDismiss=bindSheetDismiss(dialog,closeSheet);$('#sheet-title').focus({preventScroll:true});}
function positionSheet(){const phone=$('#phone'),dialog=$('#sheet'),v=visibleViewport(window),p=sheetPlacement(phone.getBoundingClientRect(),phone.offsetWidth,{...v,layoutHeight:innerHeight});for(const key of ['left','bottom','width','height'])dialog.style.setProperty(`--sheet-${key}`,`${p[key]}px`);dialog.style.setProperty('--sheet-scale',String(p.scale));}
function closeSheet(){cleanSheetDismiss?.();cleanSheetDismiss=null;$('#sheet').classList.remove('card-editor-sheet');ui.visitDialog=false;cleanSheetDates?.();cleanSheetDates=null;adviceRequest++;cleanSheetControls?.();cleanSheetControls=null;if($('#sheet').open)$('#sheet').close();$('#phone').classList.remove('sheet-open');}
$('#sheet').addEventListener('cancel',e=>{e.preventDefault();closeSheet();});
$('#sheet').addEventListener('close',()=>{if(!$('#sheet').open)closeSheet();});
function confirmSheet(title,copy,action,buttonText='確認',id=''){showSheet(title,`<p>${copy}</p>${btn(buttonText,action,'',`data-id="${esc(id)}"`)}${btn('再想一下','close-sheet','ghost')}`);}
function privateHelp(){const rel=latestRelationship();if(!rel||rel.status!=='active')return toast('這段聯繫已結束，可以回到伙伴頁聊聊。');showSheet(`私下問問 ${companionName()}`, `<div class="sheet-private-label">${spiritImage(`${companionName()} 伙伴`)}僅你可見 · ${esc(me().name)} 的伙伴</div><p>不知道怎麼開口？我可以幫你準備一句話。你可以修改，也可以不用。</p>${btn('幫我想個開場','generate-advice')}`);}
function adviceSheet(){const p=privateSpace();showSheet(`私下問問 ${companionName()}`, `<div class="sheet-private-label">${spiritImage(`${companionName()} 伙伴`)}僅你可見 · 不會自動發送</div>${p.aiError?`<p class="form-error">${esc(p.aiError)}</p>${btn('再試一次','generate-advice')}`:`<p>${esc(p.aiAdvice)}</p><div class="field"><label for="ai-draft">可以這樣說</label><textarea id="ai-draft" maxlength="1000">${esc(p.aiDraft)}</textarea></div>${btn('放入聊天輸入框','use-advice')}${btn('這次不用','discard-advice','ghost')}`}`);}
function formPatch(){const form=$('#demand-form');if(!form)return {};const data=new FormData(form);return {topic:String(data.get('topic')||''),language:String(data.get('language')||''),time:String(data.get('time')||''),mode:String(data.get('mode')||'online'),area:String(data.get('area')||state.draft.area),expiresAt:state.now+Number(data.get('validDays')||7)*86400000};}
function consumeFailure(){const fail=ui.failNext;ui.failNext=false;save();return fail;}
function clearMatching(){clearTimeout(timer);matchingTimers.forEach(clearTimeout);matchingTimers=[];matchingDemandId=null;matchingPhase=0;}
function refreshMatching(){if(ui.route==='search'){if(stopTransition)pendingSceneRefresh=true;else render(false);}}
function startMatching(){
  clearMatching();
  const demandId=state.demand?.id;
  if(!demandId||!['seeking','no_candidates'].includes(state.demand.status)||candidate())return;
  matchingDemandId=demandId;
  const active=()=>state.demand?.id===demandId&&['seeking','no_candidates'].includes(state.demand.status);
  for(const [i,ms] of [1700,3400].entries())matchingTimers.push(setTimeout(()=>{if(!active())return;matchingPhase=i+1;if(ui.route==='search'){const heading=$('[data-match-title]'),progress=$('.visit-progress');if(heading)heading.textContent=[`和 ${companionName()} 一起出發`,'找一個聊得來的人','看看有誰願意認識你'][matchingPhase];if(progress){progress.setAttribute('aria-label',`正在尋找朋友，第 ${matchingPhase+1} 步，共 3 步`);progress.querySelectorAll('i').forEach((node,n)=>node.classList.toggle('active',n<=matchingPhase));}}},ms));
  timer=setTimeout(()=>{if(!active())return;clearMatching();if(!dispatch({type:ui.matchResult==='none'?'MATCH_NONE':'MATCH_FOUND'},false))dispatch({type:'MATCH_NONE'},false);refreshMatching();},5600);
  refreshMatching();
}
function switchActor(userId){closeSheet();if(dispatch({type:'SWITCH_USER',userId},false)){if(ui.route==='invite'||state.invitations.length&&!state.relationships.length)go('invite',{replace:true});else if(ui.route==='chat'&&state.relationships.length)go('chat',{replace:true});else go(userId==='b'?'relations':'home',{replace:true});}}
function simulateReply(){const rel=latestRelationship();if(!rel||rel.status!=='active')return;const original=actor();dispatch({type:'SWITCH_USER',userId:rel.members.find(id=>id!==original)},false);dispatch({type:'SEND_MESSAGE',relationshipId:rel.id,text:'聽起來不錯，我也想多聽你說說。最近有什麼特別喜歡的嗎？'},false);dispatch({type:'SWITCH_USER',userId:original},false);render(false);toast('已加入一則模擬對方回覆');}
async function runAction(action,element){
  if(action==='close-conversation'){setHomeConversation(false);$('#private-message')?.blur();$('.home-companion')?.focus({preventScroll:true});return;}
  if(views[action])return go(action);
  switch(action){
    case 'back': return back();
    case 'start-conversation':return state.session.authenticated?go(setupRoute()):runAction('google');
    case 'onboarding-touch':klinWorld?.interact('wave');if(ui.route==='landing'){landingReaction='嗯，我感覺到你了。再碰一下也可以。';render(false);}return;
    case 'onboarding-coda':ui.onboardingCoda=Math.min(2,(ui.onboardingCoda||0)+1);save();klinWorld?.interact('wave');render(false);return;

    case 'realm-memories':return roomMemories();
    case 'realm-rest':ui.realmResting=!ui.realmResting;ui.boopReply=ui.realmResting?'那就一起安靜待一會兒。我在。':null;save();closeSheet();klinWorld?.interact('look');render(false);return;
    case 'choose-visit':clearTimeout(visitTimer);visitAttempt++;ui.selectedVisitId=element.dataset.id;ui.visitPhase='idle';save();render(false);return;
    case 'knock-visit':return knockVisit(element.dataset.id);
    case 'cancel-visit':clearTimeout(visitTimer);visitAttempt++;ui.visitPhase='idle';save();closeSheet();render(false);return;
    case 'enter-visit':if(ui.visitPhase==='open'||getDemoFriends(state).find(friend=>friend.id===element.dataset.id)?.connected){ui.visitPhase='idle';if(dispatch({type:'OPEN_DEMO_FRIEND',friendId:element.dataset.id},false)){ui.selectedRelationship=getCompanionTurn(state).relationshipId;go('chat');}}return;
    case 'shared-moment':return sharedMomentSheet();
    case 'choose-moment':if(dispatch({type:'CHOOSE_SHARED_MOMENT',relationshipId:latestRelationship()?.id,choice:element.dataset.choice,simulatePartner:true},false))sharedMomentSheet();return;
    case 'keep-moment':if(dispatch({type:'KEEP_SHARED_MOMENT',relationshipId:latestRelationship()?.id},false)){render(false);sharedMomentSheet();klinWorld?.interact('look');}return;

    case 'onboarding-reply':return answerOnboarding(element.dataset.text);
    case 'onboarding-skip':return answerOnboarding('',true);
    case 'onboarding-back':clearTimeout(landingHelloTimer);landingReveal=null;landingReaction='';ui.onboardingCoda=0;ui.onboardingDraft='';dispatch({type:'ONBOARDING_BACK'});return;
    case 'onboarding-history':return showSheet('我們剛才的對話',`<div class="onboarding-messages">${getOnboardingMessages(state).map(m=>`<div class="onboarding-message ${m.role==='user'?'is-user':'is-klin'}"><p>${esc(m.text)}</p></div>`).join('')}</div>`);
    case 'clear-network-search':filterNetwork('');$('#network-query').value='';$('#network-query').focus();return;
    case 'open-contract':{
      if(!getOnboardingTurn(state).canFinish||landingVideoScene&&!landingVideoScene.readyForInput)return;closeContractUI?.();
      sceneSound.stopSpeech();
      const who=actor(),name=me().name,partner=companionName(),soundControl=$('.landing-volume-toggle');
      closeContractUI=showCompanionContract({phone:$('#phone'),getWorld:()=>null,userName:name,companionName:partner,reduced:prefersStillness(ui.motion),onClose:()=>{closeContractUI=null;if(soundControl)$('#phone').append(soundControl);},onCommit:()=>{if(ui.route!=='landing'||actor()!==who||me().name!==name||companionName()!==partner)return;if(dispatch({type:'SIGN_COMPANION_CONTRACT'},false))departToHome();else render(false);}});if(soundControl)$('.contract-story')?.append(soundControl);return;
    }
    case 'finish-conversation':return departToHome();
    case 'choose-card-design':return chooseCardDesign();
    case 'select-card-design':{if(dispatch({type:'UPDATE_PROFILE',patch:{cardDesign:Number(element.dataset.design)}},false)){closeSheet();render(false);}return;}
    case 'regenerate-card-design':{const old=resolveCardDesign(myCard()).seed;let seed;do{seed=crypto.getRandomValues(new Uint32Array(1))[0];}while(seed%6===old%6);if(dispatch({type:'UPDATE_PROFILE',patch:{cardDesign:seed}},false)){closeSheet();render(false);}return;}
    case 'view-card-tags':{const data=ui.route==='public-card'&&sharedCard?sharedCard:myCard();return showSheet('所有標籤',`<div class="all-card-tags">${data.tags.length?data.tags.map(tag=>`<span>${esc(tag)}</span>`).join(''):'<p>還沒有留下標籤。</p>'}</div>`);}
    case 'open-demo-friend':return requestVisit(element.dataset.id);
    case 'talk-friends':go('home');setHomeConversation(true);$('#private-message')?.focus({preventScroll:true});return;
    case 'close-sheet': return closeSheet();
    case 'edit-card':return editCard();
    case 'choose-card-avatar':$('#card-avatar-upload')?.click();return;
    case 'add-card-tag':{const input=$('#card-personality-tags');const current=normalizePersonalityTags(input.value.split(/[,，、]/));const tag=element.dataset.tag;if(current.includes(tag)){input.value=current.filter(t=>t!==tag).join('，');element.setAttribute('aria-pressed','false');return;}if(current.length>=7)return toast('最多選擇 7 個標籤。');input.value=[...current,tag].join('，');element.setAttribute('aria-pressed','true');return;}
    case 'remove-card-avatar':avatarUploadSequence++;cardAvatarUploading=false;$('[data-form="profile"] button[type="submit"]').disabled=false;cardAvatarDraft='';$('#card-avatar-upload').value='';$('#card-avatar-preview').innerHTML=`<img src="${DEFAULT_CARD_AVATAR}" alt="預設頭像">`;element.hidden=true;$('#avatar-upload-status').textContent='儲存名片後恢復預設頭像';return;
    case 'preview-card':sharedCard=null;return go('public-card');
    case 'leave-card':{
      const fromLink=Boolean(sharedCard);sharedCard=null;
      if(new URLSearchParams(location.hash.slice(1)).has('card'))history.replaceState(null,'',location.pathname+location.search);
      return go(fromLink?(state.session.authenticated?setupRoute():'welcome'):'profile',{replace:true,direction:'back'});
    }
    case 'share-card':return shareCardSheet();
    case 'account-menu':return accountMenuSheet();
    case 'copy-card-link':{
      const url=cardShareURL(myCard(),location.href);
      try{await navigator.clipboard.writeText(url);toast('名片連結已複製，可以傳給新朋友。');$('#card-share-status').textContent='連結已複製';$('#card-share-status').dataset.feedback='success';}
      catch{const target=$('#card-share-status');target?.removeAttribute('data-feedback');if(target)target.innerHTML=`<label class="field">名片連結<input class="input" readonly value="${esc(url)}" aria-label="複製名片連結"></label>`;target?.querySelector('input')?.select();}
      return;
    }
    case 'native-share-card':{
      try{await navigator.share({title:`${me().name}的 Knoknok 名片`,text:'從一個你好開始。',url:cardShareURL(myCard(),location.href)});}catch(error){if(error.name!=='AbortError')toast('暫時無法打開分享選單，可以複製連結。');}return;
    }
    case 'download-card':{
      element.disabled=true;element.setAttribute('aria-busy','true');try{await downloadCard(myCard());toast('名片圖片已準備下載。');}catch{toast('圖片暫時無法匯出，可以先分享名片連結。');}finally{element.disabled=false;element.removeAttribute('aria-busy');}return;
    }
    case 'google': return showSheet('使用 Google 演示帳號',`<p>選擇虛構帳號體驗登入。這裡不會連接 Google，也不會讀取你的真實帳號。</p><button type="button" class="row-button glass-card list-row" data-action="google-confirm">${avatar('a')}<span class="row-main"><strong>Frank</strong><small>frank@example.com · 演示帳號</small></span><span>›</span></button>`);
    case 'google-confirm':dispatch({type:'DEMO_LOGIN',provider:'google'},false);go(setupRoute());if(ui.route==='landing'&&!getOnboardingMessages(state).some(m=>m.role==='user')){revealOnboarding();render(false);}return;
    case 'toggle-password':{const input=$('#password');input.type=input.type==='password'?'text':'password';element.textContent=input.type==='password'?'顯示':'隱藏';element.setAttribute('aria-label',input.type==='password'?'顯示密碼':'隱藏密碼');return;}
    case 'auth-info':return showSheet('演示登入說明','<p>手機號可使用 17724797877，驗證碼為 123456。所有驗證均在本機模擬，不會發送真實短信。</p>'+btn('知道了','close-sheet'));
    case 'resend-code':if(ui.route==='verify'&&!resendSeconds()&&validPhone(authDraft.phone))sendDemoCode();return;
    case 'retry-initialization':if(dispatch({type:'BEGIN_INITIALIZATION'},false)){go('initializing');startInitialization();}return;

    case 'boop':klinWorld?.interact('wave');sceneSound.cue('reply');ui.boopReply=['我在。今天過得怎麼樣？','被你發現了，我一直在等你。','要聊聊，還是一起去串門？'][(ui.boopCount=(ui.boopCount||0)+1)%3];return render(false);
    case 'toggle-sound':{
      const request=++audioToggleSequence,desired=!ui.soundOn;ui.soundOn=desired;syncAudioControls();
      const enabled=await sceneSound.setEnabled(desired).catch(()=>false);
      if(request!==audioToggleSequence)return;
      ui.soundOn=enabled;save();syncAudioControls();sceneSound.syncFilm(filmAudioState);syncNarration();
      return;
    }
    case 'visit-from-chat':return go('relations');
    case 'withdraw-invite':return confirmSheet('撤回這份邀約？','撤回後，對方將無法再接受這份邀約。','confirm-withdraw','撤回邀約');
    case 'confirm-withdraw':if(dispatch({type:'WITHDRAW_INVITATION',invitationId:latestInvite()?.id},false))go('invite',{replace:true});return;
    case 'decline-invite':if(dispatch({type:'DECLINE_INVITATION',invitationId:latestInvite()?.id},false))go('invite',{replace:true});return;
    case 'accept-invite':if(dispatch({type:'ACCEPT_INVITATION',invitationId:latestInvite()?.id},false)){ui.selectedRelationship=latestInvite().relationshipId;go('connected');}return;
    case 'simulate-accept':{const inv=latestInvite();if(!inv||inv.status!=='pending')return toast('邀約已失效。');const original=actor();dispatch({type:'SWITCH_USER',userId:inv.toId},false);const success=dispatch({type:'ACCEPT_INVITATION',invitationId:inv.id},false);dispatch({type:'SWITCH_USER',userId:original},false);if(success){ui.selectedRelationship=latestInvite().relationshipId;go('connected');}return;}
    case 'open-chat':ui.selectedRelationship=latestInvite()?.relationshipId||latestRelationship()?.id;return go('chat');
    case 'switch-a':return switchActor('a');case 'switch-b':return switchActor('b');
    case 'simulate-reply':return simulateReply();
    case 'private-help':return privateHelp();
    case 'generate-advice':{const rel=latestRelationship(),id=actor();if(!rel)return;showSheet(`${companionName()} 正在想一想`,`<div class="sheet-private-label">僅你可見</div><div class="typing"><i></i><i></i><i></i></div><p>從你們的共同話題，找一句輕鬆的開場。</p>`);const request=++adviceRequest;setTimeout(()=>{if(actor()!==id||request!==adviceRequest||!state.session.authenticated||!$('#sheet').open)return;dispatch({type:'REQUEST_AI_DRAFT',relationshipId:rel.id,fail:consumeFailure()},false);if($('#sheet').open)adviceSheet();},800);return;}
    case 'use-advice':dispatch({type:'EDIT_AI_DRAFT',text:$('#ai-draft')?.value||''},false);dispatch({type:'USE_AI_DRAFT'},false);closeSheet();render(false);$('#public-message')?.focus();return toast('已放入草稿，修改後由你親自發送。');
    case 'discard-advice':dispatch({type:'DISCARD_AI_DRAFT'},false);return closeSheet();
    case 'confirm-memory':return dispatch({type:'MEMORY_CONFIRM',memoryId:element.dataset.id});
    case 'edit-memory':{const m=privateSpace().memory.find(x=>x.id===element.dataset.id);return showSheet('修正我的理解',`<form data-form="memory" data-id="${esc(m.id)}"><p>你最了解自己。告訴我，怎麼說更準確？</p><textarea name="text" maxlength="500" aria-label="修正記憶">${esc(m.text)}</textarea><button type="submit" class="btn" style="margin-top:18px">保存修正</button></form>`);}
    case 'delete-memory':return confirmSheet('移除這條記憶？','伙伴以後不會再使用這條理解。已確認的找人條件和已發出的介紹仍各自保留，不會自動撤回。','confirm-delete-memory','移除記憶',element.dataset.id);
    case 'confirm-delete-memory':dispatch({type:'MEMORY_DELETE',memoryId:element.dataset.id});return closeSheet();
    case 'relationship-options':return showSheet('這段聯繫',`<p>你可以決定這段關係要以什麼步調繼續。</p>${btn('一起留下一段回響','shared-moment','white')}${btn('結束這段聯繫','end-relationship','white')}${btn('封鎖對方','block-relationship','danger')}${btn('回報不合適互動','report-relationship','ghost')}`);
    case 'end-relationship':return confirmSheet('結束這段聯繫？','結束後雙方不能再在這裡傳送訊息。過去的對話會保留供查看。','confirm-end','結束聯繫');
    case 'block-relationship':return confirmSheet('封鎖對方？','雙方不能繼續傳訊，也不會再收到彼此的推薦或邀約。','confirm-block','封鎖對方');
    case 'confirm-end':case 'confirm-block':dispatch({type:action==='confirm-end'?'END_RELATIONSHIP':'BLOCK_RELATIONSHIP',relationshipId:latestRelationship()?.id},false);closeSheet();return render(false);
    case 'report-relationship':return showSheet('回報這段互動',`<form data-form="report"><p>此原型只記錄模擬回報，不會送交真人審核。</p><div class="field"><label for="report-reason">發生了什麼？</label><select id="report-reason" name="reason"><option>不合適或令人不舒服的內容</option><option>冒充身份</option><option>騷擾或重複邀請</option></select></div><button type="submit" class="btn">記錄模擬回報</button></form>`);
    case 'toggle-motion':closeContractUI?.();ui.motion=!ui.motion;save();render(false);if($('#sheet').open)showControls();return;
    case 'fail-next':ui.failNext=!ui.failNext;save();render(false);if($('#sheet').open)showControls();return toast(ui.failNext?'下次提交、AI 建議或消息發送將模擬失敗。':'已恢復正常發送。');
    case 'logout':resetSound();clearMatching();homeGreeting.reset();clearAuthDraft();dispatch({type:'DEMO_LOGOUT'},false);ui.history=[];return go('welcome',{replace:true});
    case 'reset':return confirmSheet('重新體驗整個流程？','將清除這份原型在本機的演示資料，從歡迎頁重新開始。','confirm-reset','重新開始');
    case 'confirm-reset':resetSound();landingVideoScene?.dispose();landingVideoScene=null;homeGreeting.reset();clearAuthDraft();clearMatching();clearTimeout(initializeTimer);busy=false;companionTyping=false;state=initialState();ui={route:'welcome',history:[],motion:ui.motion,matchResult:'found',failNext:false};closeSheet();save();return render(true);
  }
}

document.addEventListener('click',e=>{const el=e.target.closest('button,a');if(!el)return;if(el.dataset.go){e.preventDefault();if(el.closest('.bottom-nav')&&el.dataset.go===ui.route)return;return go(el.dataset.go,{direction:el.dataset.direction});}if(el.dataset.action){e.preventDefault();return runAction(el.dataset.action,el);}if(el.dataset.topic){$('#topic').value=el.dataset.topic;return;}if(el.dataset.mode){dispatch({type:'UPDATE_DRAFT',patch:{...formPatch(),mode:el.dataset.mode}},false);return render(false);}if(el.dataset.invitation){ui.selectedInvite=el.dataset.invitation;return go('invite');}if(el.dataset.relationship){ui.selectedRelationship=el.dataset.relationship;return go('chat');}if(el.dataset.say){return sendCompanion(el.dataset.say);}if(el.dataset.publicSay){dispatch({type:'SET_PUBLIC_DRAFT',text:el.dataset.publicSay},false);render(false);$('#public-message')?.focus();return;}if(el.dataset.retry){dispatch({type:'RETRY_MESSAGE',messageId:el.dataset.retry,fail:consumeFailure()});return;}});
function sendCompanion(text){if(companionTyping)return;if(!text.trim())return toast('先寫一句想說的話吧。');sceneSound.stopSpeech();const who=actor();ui.companionDrafts={...(ui.companionDrafts||{}),[who]:''};delete ui.boopReply;companionTyping=true;sceneSound.cue('send');klinWorld?.interact('look');dispatch({type:'COMPANION_SEND',text},false);render(false);if(conversationActive)$('#private-message')?.focus({preventScroll:true});setTimeout(()=>{companionTyping=false;if(actor()===who&&['companion','home'].includes(ui.route)){sceneSound.cue('reply');klinWorld?.interact('wave');render(false);}},950);}
document.addEventListener('submit',e=>{const form=e.target.closest('form[data-form]');if(!form)return;e.preventDefault();const data=new FormData(form);switch(form.dataset.form){case 'register':return registerDemoAccount(data);case 'login':{
  const account=String(data.get('account')||'').trim(),password=String(data.get('password')||'');
  authDraft.account=account;authDraft.password=password;
  if(account!==DEMO_ACCOUNT||password!==DEMO_PASSWORD){$('#auth-error').innerHTML='<p class="form-error">帳號或密碼不正確，再試一次。</p>';return;}
  if(!dispatch({type:'DEMO_LOGIN',provider:'demo'},false))return;
  clearAuthDraft();go(setupRoute());revealOnboarding();render(false);return;
}
case 'verify':{
  const code=String(data.get('code')||'').trim();
  authDraft.code=code;
  if(!/^\d{6}$/.test(code)){$('#auth-error').innerHTML='<p class="form-error">請填寫 6 位驗證碼。</p>';$('#auth-code').setAttribute('aria-invalid','true');return;}
  if(!validPhone(authDraft.sentPhone)||normalizePhone(authDraft.phone)!==authDraft.sentPhone)return go('login');
  if(!dispatch({type:'DEMO_LOGIN',provider:'account',code},false)){$('#auth-error').innerHTML=`<p class="form-error">${esc(state.error)}</p>`;$('#auth-code').setAttribute('aria-invalid','true');return;}
  clearAuthDraft();return go(setupRoute());
}
case 'setup-basics':{const patch=basicsFormPatch(),errors=validateBasics(patch);if(Object.keys(errors).length){$('#basics-error').innerHTML=`<p class="form-error">${esc(Object.values(errors)[0])}</p>`;$('#basics-error').scrollIntoView({block:'nearest'});return;}if(dispatch({type:'SAVE_BASICS',patch},false)){if(state.onboarding.status!=='ready'&&!state.demand)dispatch({type:'UPDATE_DRAFT',patch:{language:patch.language}},false);ui.setupBasics=null;go('setup-birth');}return;}
case 'setup-birth':{const patch=birthFormPatch(),errors=validateBirth(patch,state.now);if(Object.keys(errors).length){$('#birth-error').innerHTML=`<p class="form-error">${esc(Object.values(errors)[0])}</p>`;$('#birth-error').scrollIntoView({block:'nearest'});return;}if(dispatch({type:'SAVE_BIRTH',patch},false)){ui.setupBirth=null;if(state.onboarding.status==='ready'){go('profile');toast('資料已儲存。');}else if(dispatch({type:'BEGIN_INITIALIZATION'},false)){go('initializing');startInitialization();}}return;}
case 'onboarding':return answerOnboarding(String(data.get('answer')||''));
case 'companion':return sendCompanion(String(data.get('message')||''));
case 'demand':{dispatch({type:'UPDATE_DRAFT',patch:formPatch()},false);const errors=validateDemand(state.draft,state.now);delete errors.intro;if(Object.keys(errors).length){if(errors.time||errors.area||errors.expiresAt){const options=$('.request-options');if(options)options.open=true;}$('#demand-error').innerHTML=`<p class="form-error">${esc(Object.values(errors)[0])}</p>`;$('#demand-error').scrollIntoView({block:'nearest'});return;}return go('preview');}
case 'profile':{if(cardAvatarUploading)return toast('頭像正在準備，請稍等。');const tags=String(data.get('cardTags')||'').split(/[,，、]/).map(t=>t.trim()).filter(Boolean);if(tags.length>7)return toast('最多選擇 7 個標籤。');if(dispatch({type:'UPDATE_PROFILE',patch:{name:data.get('profile-name'),bio:data.get('bio'),cardTags:normalizePersonalityTags(tags),cardAvatar:cardAvatarDraft,shareRegion:data.has('shareRegion')}},false)){closeSheet();render(false);toast('名片已保存。');}return;}
case 'memory':if(dispatch({type:'MEMORY_EDIT',memoryId:form.dataset.id,text:data.get('text')})){closeSheet();toast('已修正，我會按新的理解陪伴你。');}return;
case 'report':dispatch({type:'REPORT_RELATIONSHIP',relationshipId:latestRelationship()?.id,reason:data.get('reason')},false);closeSheet();return toast('已記錄模擬回報，尚未送交真人審核。');
case 'public-message':{const rel=latestRelationship();if(!rel)return;const text=String(data.get('message')||'');if(dispatch({type:'SEND_MESSAGE',relationshipId:rel.id,text,fail:consumeFailure()},false))render(false);return;}
}});
document.addEventListener('focusin',e=>{if(e.target.id==='private-message'&&ui.route==='home')setHomeConversation(true);});
document.addEventListener('input',e=>{if(e.target.dataset.registrationField){const name=e.target.dataset.registrationField;registrationDraft[name]=e.target.value;e.target.removeAttribute('aria-invalid');const error=$(`#register-${name}-error`);if(error){error.textContent='';error.hidden=true;}updateAuthControls();return;}if(e.target.id==='auth-account'||e.target.id==='auth-password'){authDraft[e.target.name]=e.target.value;$('#auth-error').textContent='';updateAuthControls();return;}if(e.target.id==='network-query'){filterNetwork(e.target.value);return;}
  if(e.target.id==='auth-phone'||e.target.id==='auth-code'){
    if(e.target.id==='auth-phone')authDraft.phone=e.target.value;
    else if(!e.isComposing){e.target.value=e.target.value.replace(/[^0-9]/g,'').slice(0,6);authDraft.code=e.target.value;}
    e.target.removeAttribute('aria-invalid');$('#auth-error').textContent='';updateAuthControls();
  }
if(['onboarding-answer','onboarding-calendar'].includes(e.target.id)){ui.onboardingDraft=e.target.value;save();}if(e.target.closest('#setup-basics-form')){ui.setupBasics=basicsFormPatch();save();}if(e.target.closest('#setup-birth-form')){ui.setupBirth=birthFormPatch();save();}if(e.target.id==='private-message'){ui.companionDrafts={...(ui.companionDrafts||{}),[actor()]:e.target.value};save();}if(e.target.id==='public-message')dispatch({type:'SET_PUBLIC_DRAFT',text:e.target.value},false);if(e.target.id==='intro-preview')dispatch({type:'UPDATE_DRAFT',patch:{intro:e.target.value}},false);});
document.addEventListener('change',e=>{if(e.target.closest('#demand-form')){const summary=$('[data-request-option-summary]');if(summary){const data=new FormData($('#demand-form'));summary.textContent=`${data.get('time')?formatDate(String(data.get('time'))):'選個方便的時間'}${data.get('mode')==='offline'&&data.get('area')?` · ${data.get('area')}`:''} · 尋找 ${data.get('validDays')||7} 天`;}}if(e.target.id==='card-avatar-upload'){uploadCardAvatar(e.target.files?.[0]);return;}if(e.target.name==='unknownTime'){const input=$('#birth-time');input.disabled=e.target.checked;if(e.target.checked)input.value='';ui.setupBirth=birthFormPatch();save();}if(e.target.closest('#setup-basics-form')){ui.setupBasics=basicsFormPatch();save();}if(e.target.closest('#setup-birth-form')){ui.setupBirth=birthFormPatch();save();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&conversationActive&&!$('#sheet').open){e.preventDefault();setHomeConversation(false);$('#private-message')?.blur();$('.home-companion')?.focus({preventScroll:true});return;}if(e.target.matches('.visit-tab')&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const find=e.key==='Home'||e.key!=='End'&&e.target.dataset.action==='visit-people';runAction(find?'visit-find':'visit-people',e.target);$(`.visit-tab[data-action="visit-${find?'find':'people'}"]`)?.focus();return;}if(e.key==='Enter'&&e.target.id==='onboarding-answer'&&!e.target.value.trim()){e.preventDefault();return;}if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&['public-message','private-message','onboarding-answer'].includes(e.target.id)){e.preventDefault();e.target.closest('form').requestSubmit();}});
$('#sheet').addEventListener('click',e=>{if(e.target===$('#sheet')){const r=$('#sheet').getBoundingClientRect();if(e.clientY<r.top||e.clientY>r.bottom||e.clientX<r.left||e.clientX>r.right)closeSheet();}});
$('#reset-button').onclick=()=>runAction('reset');
$('#motion-toggle').onclick=()=>{closeContractUI?.();ui.motion=!ui.motion;save();render(false);};
function showControls(){closeContractUI?.();showSheet('演示控制',`${guideButtons()}${scenarioControls()}<button type="button" class="review-btn" data-action="toggle-motion" aria-pressed="${ui.motion}">${ui.motion?'恢復動畫效果':'減少動態'}</button>`);}
$('#mobile-controls').onclick=showControls;
function resize(){const v=visibleViewport(window),root=document.documentElement;root.style.setProperty('--app-height',`${v.height}px`);root.style.setProperty('--app-offset-top',`${v.top}px`);$('#phone').dataset.keyboardOpen=String(v.keyboard);const availableHeight=innerHeight-(shareDemo?140:innerHeight<=850?137:157);const scale=innerWidth<=650?1:Math.max(.62,Math.min(1,availableHeight/874,(innerWidth-80)/402));root.style.setProperty('--scale',String(scale));positionSheet();klinWorld?.resize();}
window.addEventListener('resize',()=>{resize();requestAnimationFrame(syncWorldAnchor);});
window.visualViewport?.addEventListener('resize',resize);
window.visualViewport?.addEventListener('scroll',resize);
document.addEventListener('pointerdown',e=>{if(!conversationActive||ui.route!=='home'||$('#sheet').open||e.target.closest('.home-chat-bottom,.home-top,.conversation-message,dialog,.mobile-controls'))return;setHomeConversation(false);$('#private-message')?.blur();},{capture:true});
document.addEventListener('scroll',e=>{if(e.target.matches?.('.visit-content'))requestAnimationFrame(syncWorldAnchor);},true);
window.addEventListener('scroll',()=>{if($('#sheet').open)positionSheet();},{passive:true});
window.addEventListener('storage',e=>{
  if(comparisonMode||e.key!==STATE_KEY)return;
  closeContractUI?.();
  clearTimeout(landingHelloTimer);landingReveal=null;landingReaction='';
  const before=actor(),authenticated=state.session.authenticated;
  state=hydrateState(e.newValue);
  if(authenticated&&!state.session.authenticated)resetSound();
  if(before!==actor()||authenticated!==state.session.authenticated){
    closeSheet();companionTyping=false;clearMatching();ui.history=[];
    ui.route=state.session.authenticated?(actor()==='a'?setupRoute():'relations'):'welcome';
  }
  if(ui.route!=='public-card'&&state.session.authenticated&&actor()==='a'&&!landingComplete(state))ui.route=setupRoute();
  if(ui.route==='home'&&state.session.authenticated&&companionProfile(state).stage==='juvenile'){
    state=reduce(state,{type:'ENTER_COMPANION_HOME'});save();
  }
  render(false);
  if(ui.route==='initializing')startInitialization();
});
setInterval(()=>{if(!state.session.authenticated)return;const previous=JSON.stringify([state.demand?.status,state.invitations.map(x=>x.status)]);state=reduce(state,{type:'ADVANCE_TIME'});if(previous!==JSON.stringify([state.demand?.status,state.invitations.map(x=>x.status)])){save();render(false);}},15000);
if(ui.route!=='public-card'&&state.session.authenticated&&actor()==='a'&&!landingComplete(state))ui.route=setupRoute();
if(ui.route==='initializing'&&state.onboarding.status==='ready')ui.route=setupRoute();
// Comparison frames use disposable demo state; the main prototype stays untouched.
function prepareComparison(route) {
  if(route==='welcome') {
    resetSound();
    landingVideoScene?.dispose();landingVideoScene=null;homeGreeting.reset();clearAuthDraft();clearMatching(); clearTimeout(initializeTimer); companionTyping=false; busy=false;
    state=initialState(); ui={route:'welcome',history:[],motion:ui.motion,matchResult:'found',failNext:false};
  } else if(!state.session.authenticated || !landingComplete(state)) {
    state=initialState();
    state=reduce(state,{type:'DEMO_LOGIN'});
    for(const text of ['1998年6月18日','不清楚','暫不說','不清楚','慢慢來','小林','就叫 Klin'])state=reduce(state,{type:'ONBOARDING_REPLY',text});
    state=reduce(state,{type:'SIGN_COMPANION_CONTRACT'});
    state=reduce(state,{type:'FINISH_CONVERSATION'});
    ui.history=[];
  }
}
if(comparisonMode) {
  const initialComparisonScreen=variantParams.get('screen')==='welcome'?'welcome':'home';
  prepareComparison(initialComparisonScreen); ui.route=initialComparisonScreen;
  window.addEventListener('message',event=>{
    if(event.source!==window.parent || event.origin!==location.origin || event.data?.type!=='knok-compare-route')return;
    const route=event.data.route;
    if(!['home','landing','companion','relations','welcome'].includes(route))return;
    prepareComparison(route==='landing'?'welcome':route);if(route==='landing')state=reduce(state,{type:'DEMO_LOGIN'});go(route,{replace:true});
  });
}
if(!pixelVariant&&ui.route==='home'&&state.session.authenticated)state=reduce(state,{type:'ENTER_COMPANION_HOME'});
resize();render(true);
prepareCardFonts().then(()=>{pendingCardFontRefresh=true;refreshVisibleCardArtwork();});
if(pixelVariant)initCompanionAnimation();
if(ui.route==='initializing')startInitialization();


matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event=>{closeContractUI?.();syncLoginScene();syncLandingVideo();klinWorld?.setReducedMotion(event.matches||ui.motion);if(event.matches){const cancel=stopTransition;stopTransition=null;cancel?.();klinWorld?.setPage(currentSceneRoute(),{stage:currentCompanionStage(),layout:currentWorldLayout(),immediate:true});}});

window.addEventListener('hashchange',()=>{const card=decodeCard(new URLSearchParams(location.hash.slice(1)).get('card')||'');if(card){sharedCard=card;go('public-card');}else if(sharedCard){sharedCard=null;go(state.session.authenticated?setupRoute():'welcome',{replace:true});}});
