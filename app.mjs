import { prepareAvatar } from './avatar-upload.mjs?v=20261016-refinement-8';
import { initFormControls } from './form-controls.mjs?v=20261016-refinement-8';
import { initDatePickers } from './date-picker.mjs?v=20261016-refinement-8';
import { initTypography } from './typography.mjs?v=20261016-refinement-8';
import { createSceneSound } from './scene-sound.mjs?v=20261016-refinement-8';
import { METAL_VOICES, landingComplete, onboardingDestination, validMetalVoice } from './landing.mjs?v=20261016-refinement-8';
import { navIcon, backArrow, sendArrow, volumeIcon } from './ui-icons.mjs?v=20261016-refinement-8';
import { normalizePersonalityTags, normalizeCardAvatar, publicCardData, encodeCard, decodeCard, cardMarkup, cardShareURL, downloadCard } from './public-card.mjs?v=20261016-refinement-8';
import { createKlinWorld } from './klin-world.mjs?v=20261016-refinement-8';
import { klinMarkup, setKlinLoadingState } from './klin-companion.mjs?v=20261016-team-9';
import { visitTopics, visitStage } from './visit-scene.mjs?v=20261016-refinement-8';
import { initPixelRoom } from './pixel-room.mjs?v=20261010-pixel-scene-1';
import { createHomeGreeting } from './home-greeting.mjs?v=20261010-natural-greeting-1';
import { pixelCompanionMarkup, initCompanionAnimation, syncCompanionAnimation } from './companion-animation.mjs?v=20261009-gif-2';
import { captureCompanion, transitionScene, prefersStillness } from './motion.mjs?v=20261016-refinement-8';
import { initialState, reduce, validateDemand, publicMessages, serializeState, hydrateState, STORAGE_KEY, validateBasics, validateBirth, ageFromBirth, companionProfile } from './model.mjs?v=20261016-refinement-8';

const $ = (query, root=document) => root.querySelector(query);
const homeGreeting = createHomeGreeting();
const sceneSound = createSceneSound();
let cleanFormControls,cleanSheetControls,cleanDatePickers,cleanSheetDates;
let cardAvatarDraft='';
let avatarUploadSequence=0;
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
if (!state.session.authenticated) ui.route='welcome';
if (['memory','companion'].includes(ui.route)) ui.route='home';
ui.soundOn=false;
let sharedCard=decodeCard(new URLSearchParams(location.hash.slice(1)).get('card')||'');
if(sharedCard)ui.route='public-card';
let landingHelloTimer;
let growthPending=false, growthPlaying=false, stopGrowth, growthTimers=[], worldReady=false, klinWorld=null;
let renderSequence=0;
let conversationActive=false;
let matchingDemandId=null, matchingPhase=0, matchingTimers=[];
let timer, initializeTimer, toastTimer, authResendTimer, stopTransition, pendingSceneRefresh=false, adviceRequest=0, busy=false, companionTyping=false;
// Phone verification is a local prototype interaction, so credentials stay in memory.
const authDraft={phone:'',code:'',sentPhone:'',resendAt:0};
const normalizePhone=value=>String(value||'').replace(/[\s()-]/g,'');
const validPhone=value=>/^(?:(?:\+?86)?1[3-9]\d{9}|(?:\+?852)?[456789]\d{7})$/.test(normalizePhone(value));
const resendSeconds=()=>Math.max(0,Math.ceil((authDraft.resendAt-Date.now())/1000));
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
const companionName = () => pixelVariant ? 'Knok' : 'Klin';
const logoImage = `<img class="brand-logo" src="${pixelVariant?'assets/pixel-scene-20261010/knokknok-wordmark-chunky-pixel-white.png':'assets/brand-20261016/knoknok-logo-latest.png'}" alt="Knoknok" width="2172" height="724">`;
const spiritAvatar = () => `<span class="avatar small">${spiritImage(`${companionName()} 伙伴`)}</span>`;
const empty = (title,copy,action='') => `<div class="blank-state">${spiritImage(`${companionName()} 伙伴`)}<h3>${title}</h3><p>${copy}</p>${action}</div>`;
const detail = (label,value) => `<div class="detail-line"><dt>${label}</dt><dd>${esc(value)}</dd></div>`;
function save(){if(comparisonMode)return;try{localStorage.setItem(STATE_KEY,serializeState(state));localStorage.setItem(UI_KEY,JSON.stringify(ui));}catch{toast('瀏覽器暫時無法保存，仍可繼續這次體驗。');}}
function dispatch(action, renderNow=true){state=reduce(state,action);save();if(renderNow)render(false);if(state.error)toast(state.error);return !state.error;}
function toast(text){const node=$('#toast');node.textContent=text;node.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('visible'),3300);}
function go(route,options={}){
  if(['memory','companion'].includes(route))route='home';
  if(growthPlaying||growthPending)finishGrowth();
  clearTimeout(landingHelloTimer);closeSheet();
  if(conversationActive&&route!=='home')setHomeConversation(false);
  if(actor()==='b'&&['demand','preview','search','candidate'].includes(route)){route='relations';toast('切回自己的視角，就可以繼續找朋友。');}
  const publicRoutes=['welcome','login','register','verify','public-card'];
  if(!state.session.authenticated&&!publicRoutes.includes(route))route='welcome';
  if(route==='initializing'&&state.onboarding.status==='ready')route=setupRoute();
  if(state.session.authenticated&&actor()==='a'&&!landingComplete(state)&&!publicRoutes.includes(route)){
    const destination=setupRoute();
    // Profile forms and the first conversation form one required landing journey.
    if(!['landing','setup-basics','setup-birth','initializing','onboard'].includes(route))route=destination;
    if(route==='setup-basics'&&!state.onboarding.interaction.greeted)route='landing';
    if(route==='setup-birth'&&!state.onboarding.basicsComplete)route=destination;
    if(route==='onboard'&&state.onboarding.status!=='ready')route=destination;
  }
  if(options.replace!==true&&ui.route!==route)ui.history.push(ui.route);
  ui.route=route;
  if(route==='home'&&!pixelVariant){
    const juvenile=companionProfile(state).stage==='juvenile';
    const next=reduce(state,{type:'ENTER_COMPANION_HOME'});
    if(next.error){ui.route=setupRoute();}else{state=next;if(juvenile&&companionProfile(state).stage==='adult')growthPending=true;}
  }
  ui.history=ui.history.slice(-16);save();render(true,{direction:options.direction||'forward'});
  if(ui.route==='initializing'&&state.onboarding.status==='preparing')startInitialization();
}
function back(){let route=ui.history.pop();while(route==='initializing'&&state.onboarding?.status==='ready')route=ui.history.pop();go(route||(state.session.authenticated?'home':'welcome'),{replace:true,direction:'back'});}
function top(title,sub='',right=''){const control=['chat','connected'].includes(ui.route)?`<button type="button" class="icon-button" data-go="relations" data-direction="back" aria-label="返回串門">${backIcon}</button>`:homeReturnRoutes.has(ui.route)?`<button type="button" class="icon-button header-home" data-go="home" data-direction="back" aria-label="回到首頁" title="回到首頁">${backIcon}</button>`:`<button type="button" class="icon-button" data-action="back" aria-label="返回">${backIcon}</button>`;return `<header class="page-top">${control}<div><h2>${title}</h2>${sub?`<p class="meta">${sub}</p>`:''}</div>${right?`<div class="top-right">${right}</div>`:''}</header>`;}
function nav(){return '';}
function content(body,cls=''){return `<div class="content ${cls}">${body}</div>`;}
function field(label,name,value,attrs='',type='text'){return `<div class="field"><label for="${name}">${label}</label><input class="input" id="${name}" name="${name}" type="${type}" value="${esc(value)}" ${attrs}></div>`;}
function shell(body,cls=''){return `<section class="page ${roomSceneRoutes.has(ui.route)?'room-page':''} ${cls}" data-screen="${ui.route}">${body}</section>`;}
function welcome(){return shell(`${pixelVariant?`<div class="pixel-welcome">${spiritImage('Knok 像素伙伴')}</div>`:`<div class="klin-welcome">${spiritImage('幼年態 Klin','','juvenile')}</div>`}<h2 class="brand" data-node-id="76:2145">${logoImage}</h2><div class="welcome-actions"><button type="button" class="btn dark figma-primary" data-action="google" data-node-id="76:2210"><span>用谷Google帳號登錄</span></button><button type="button" class="btn white figma-secondary" data-go="login" data-node-id="76:2206"><span>手機號登錄</span></button></div>`,'welcome');}
function auth(verification=false){
  const remaining=resendSeconds(),label=verification?'驗證碼':'手機號碼';
  return shell(`<header class="auth-header"><button type="button" class="icon-button auth-back" data-go="${verification?'login':'welcome'}" data-direction="back" aria-label="${verification?'返回手機號登錄':'返回歡迎頁'}">${backIcon}</button><h2 class="brand">${logoImage}</h2></header><div class="auth-panel"><div class="auth-heading"><h1>${verification?'輸入驗證碼':'用手機號登錄'}</h1><p>${verification?`已發送至 ${esc(normalizePhone(authDraft.phone))}`:'讓我們把這次相遇記住。'}</p></div><form id="auth-form" class="auth-form" data-form="${verification?'verify':'login'}" novalidate><div class="field auth-field"><label for="${verification?'auth-code':'auth-phone'}">${label}</label>${verification?`<input class="input" id="auth-code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="6 位數驗證碼" value="${esc(authDraft.code)}" aria-describedby="auth-error">`:`<input class="input" id="auth-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="輸入手機號碼" value="${esc(authDraft.phone)}" aria-describedby="auth-error">`}</div><div id="auth-error" class="auth-error" role="alert"></div><div class="auth-submit"><button class="btn dark" type="submit" ${(verification?/^\d{6}$/.test(authDraft.code):validPhone(authDraft.phone))?'':'disabled'}><span>${verification?'登錄':'發送驗證碼'}</span></button></div></form>${verification?`<div class="auth-resend"><button type="button" class="text-button" data-action="resend-code" ${remaining?'disabled':''}><span>${remaining?`重新發送（${remaining}s）`:'重新發送'}</span></button></div>`:''}</div>`,'auth-page '+(verification?'auth-verify':'auth-login'));
}
function updateAuthControls(){
  if(!['login','register','verify'].includes(ui.route))return;
  const verification=ui.route==='verify',primary=$('.page[data-screen] .auth-submit button');
  if(primary)primary.disabled=verification?!/^\d{6}$/.test(authDraft.code):!validPhone(authDraft.phone);
  const resend=$('.page[data-screen] [data-action="resend-code"]'),remaining=resendSeconds();
  if(resend){resend.disabled=remaining>0;resend.querySelector('span').textContent=remaining?`重新發送(${remaining}s)`:'重新發送';}
  if(!remaining){clearInterval(authResendTimer);authResendTimer=null;}
}
function syncAuthCountdown(){
  clearInterval(authResendTimer);authResendTimer=null;
  updateAuthControls();
  if(ui.route==='verify'&&resendSeconds())authResendTimer=setInterval(updateAuthControls,250);
}
function clearAuthDraft(){clearInterval(authResendTimer);authResendTimer=null;Object.assign(authDraft,{phone:'',code:'',sentPhone:'',resendAt:0});}
function sendDemoCode(){
  authDraft.code='';authDraft.sentPhone=normalizePhone(authDraft.phone);authDraft.resendAt=Date.now()+60000;
  save();go('verify');toast('本地演示驗證碼：123456');
}
function setupRoute(){return onboardingDestination(state);}
function basicsDraft(){return {name:me().name,language:me().language||'粵語',region:me().region||'香港',...(ui.setupBasics||{})};}
function birthDraft(){return {...privateSpace().birth,...(ui.setupBirth||{})};}
function landingProgress(step){return `<div class="landing-progress" aria-label="初次見面，第 ${step} 步，共 4 步">${[1,2,3,4].map(n=>`<i class="${n<=step?'done':''}"></i>`).join('')}</div>`;}
function landing(){return shell(`<div class="landing-brand">${logoImage}</div>${landingProgress(1)}<div class="landing-intro"><h2>嗨，我是 Klin。</h2><p>很高興，你來到這裡。</p></div><button type="button" class="landing-touch" data-action="landing-greet" aria-label="輕觸 Klin，打個招呼">${spiritImage('幼年態 Klin','','juvenile')}</button><div class="landing-invitation"><button type="button" class="landing-greeting-prompt" data-action="landing-greet"><span aria-hidden="true">✧</span> 輕輕碰我，打個招呼</button></div>`,'landing-page');}
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
function onboard(){
  const interaction=state.onboarding.interaction||{},voice=validMetalVoice(interaction.tone)?METAL_VOICES[interaction.tone]:null,responded=Boolean(voice)&&['resonates','different'].includes(interaction.response);
  const heading=responded?'和你一起，慢慢長大。':voice?'這一點，像你嗎？':'選一束喜歡的光';
  const objects=!voice?`<div class="light-objects">${Object.entries(METAL_VOICES).map(([id,v])=>`<button class="light-object ${id}" type="button" data-action="metal-voice" data-id="${id}" aria-label="${id==='geng'?'觸碰聚光':'觸碰柔光'}，${v.label}"><span class="object-fallback ${id}" aria-hidden="true"></span><span class="choice-glyph ${id}" aria-hidden="true">${id==='geng'?'✦':'◌'}</span><span class="object-caption"><strong>${id==='geng'?'一道聚光':'一圈柔光'}</strong><small>${v.label}</small></span><span class="choice-arrow" aria-hidden="true">↗</span></button>`).join('')}</div>`:'';
  const panel=!voice?``:responded?`<p class="klin-reading">${interaction.response==='resonates'?voice.reply:'好，不急著定義你。讓我在每一次聊天裡，慢慢認識你。'}</p><button type="button" class="btn" data-go="home">牽起 Klin，一起回家 ${sendArrow}</button>`:`<blockquote class="klin-reading"><p>${voice.teaser}</p><p>${voice.reading}</p></blockquote><div class="split-buttons"><button type="button" class="btn white" data-action="metal-response" data-id="different">慢慢認識我</button><button type="button" class="btn" data-action="metal-response" data-id="resonates">嗯，有一點像</button></div><button type="button" class="other-voice" data-action="metal-voice" data-id="${interaction.tone==='geng'?'xin':'geng'}"><span aria-hidden="true">↻</span> 聽聽另一種光</button>`;
  return shell(`<div class="landing-brand">${logoImage}</div>${landingProgress(4)}<div class="landing-intro"><span class="eyebrow">${esc(me().name)} × KLIN</span><h2>${heading}</h2></div><div class="landing-touch reading-portrait">${spiritImage('幼年 Klin','','juvenile')}</div>${objects}<div class="landing-conversation ${voice?'has-reading':''}" aria-live="polite">${panel}</div>`,'landing-page onboard-page');
}
function homeScene(){return '<div class="home-scene" aria-hidden="true"></div>';}
function syncHomeScene(){
  const phone=$('#phone');
  // This room survives page renders and Tab changes; only its focus changes.
  if(!phone.querySelector(':scope > .home-scene'))phone.insertAdjacentHTML('afterbegin',homeScene());
  if(pixelVariant)initPixelRoom(phone.querySelector(':scope > .home-scene'));
  phone.dataset.roomScene=roomSceneRoutes.has(ui.route)?(ui.route==='home'?'home':'blurred'):'off';
}
function volumeButton(){return `<button type="button" class="scene-icon volume-toggle" data-action="toggle-sound" aria-pressed="${Boolean(ui.soundOn)}" aria-label="${ui.soundOn?'關閉聲音':'開啟聲音'}">${volumeIcon(!ui.soundOn)}</button>`;}
function conversationMarkup(messages){
  return messages.map((m,i)=>`<div class="conversation-message ${m.role==='user'?'own':''}" ${companionTyping&&m.role!=='user'&&i===messages.length-1?'hidden':''}><span class="conversation-speaker">${m.role==='user'?'你':'Klin'}</span><p>${esc(m.text)}</p></div>`).join('')+(companionTyping?'<div class="conversation-message"><span class="conversation-speaker">Klin</span><span class="typing" aria-label="Klin 正在回覆"><i></i><i></i><i></i></span></div>':'');
}
function setHomeConversation(active){
  conversationActive=Boolean(active)&&ui.route==='home'&&!growthPlaying;
  const phone=$('#phone');phone.dataset.conversation=String(conversationActive);
  klinWorld?.setConversationMode?.(conversationActive);
  const log=$('#conversation-log'),close=$('.conversation-close');
  if(log){log.hidden=!conversationActive;if(conversationActive)log.scrollTop=log.scrollHeight;}
  if(close)close.hidden=!conversationActive;
  const dialogue=$('.room-dialogue');if(dialogue)dialogue.setAttribute('aria-hidden',String(conversationActive));
}
function home(){
 const space=privateSpace(),messages=space.companionMessages,reply=messages.filter(m=>m.role!=='user').at(-1),latestUser=messages.filter(m=>m.role==='user').at(-1);
 return shell(`<div class="home-top"><h2 class="mini-wordmark">${logoImage}</h2><div class="room-tools"><button class="scene-icon" type="button" data-go="profile" aria-label="我的名片">${navIcon('profile')}</button>${volumeButton()}</div></div><div class="room-dialogue" aria-live="polite" aria-hidden="${conversationActive}"><span class="companion-signature">Klin</span><div class="room-speech">${companionTyping?'<span class="typing"><i></i><i></i><i></i></span>':esc(ui.boopReply||reply?.text||'今天想和我聊點什麼？')}</div></div><button type="button" class="home-companion" data-action="boop" aria-label="輕觸 Klin">${spiritImage('成年態 Klin','','adult')}</button><button type="button" class="conversation-close" data-action="close-conversation" ${conversationActive?'':'hidden'} aria-label="收起聊天，回到陪伴">${backIcon}<span>收起聊天</span></button><div id="conversation-log" class="conversation-log" role="log" aria-label="你和 Klin 的私人對話" aria-live="polite" ${conversationActive?'':'hidden'}>${conversationMarkup(messages)}</div><div class="home-chat-bottom">${latestUser?`<p class="last-whisper">${esc(latestUser.text)}</p>`:'<p class="scene-hint">說點什麼，或一起去遇見新朋友。</p>'}${space.pendingDemandSuggestion&&!companionTyping?'<button class="demand-nudge" type="button" data-action="visit-from-chat">一起找個聊得來的人 ↗</button>':''}<div class="home-chat-actions"><button type="button" class="visit-entry" data-go="relations">${navIcon('visit')}<span>串門</span></button><form class="home-composer" data-form="companion"><div class="composer-row"><textarea name="message" id="private-message" rows="1" placeholder="和 Klin 聊聊…" aria-label="和 Klin 聊聊" maxlength="1000">${esc(ui.companionDrafts?.[actor()]||'')}</textarea><button class="send-button" type="submit" aria-label="發送給 Klin" ${companionTyping?'disabled':''}>${sendArrow}</button></div></form></div></div>`,'home-page room-chat-page');
}
function companion(){const space=privateSpace();const messages=space.companionMessages.map((m,i)=>`<div class="message ${m.role==='user'?'own':''}" ${companionTyping&&i===space.companionMessages.length-1?'hidden':''}>${m.role==='user'?avatar(actor(),true):spiritAvatar()}<div class="message-content"><div class="bubble">${esc(m.text)}</div></div></div>`).join('');return shell(top(companionName())+`<div class="content messages" id="message-scroll">${messages}${companionTyping?`<div class="message">${spiritAvatar()}<div class="bubble"><span class="typing"><i></i><i></i><i></i></span></div></div>`:''}${space.pendingDemandSuggestion&&!companionTyping?`<div class="glass-card"><h4>找個人一起去？</h4><p class="small-note">先確認，再開始尋找。</p>${btn('整理需求','new-demand','compact')}${btn('先聊聊','dismiss-demand','ghost')}</div>`:''}${space.companionMessages.length<3?`<div class="suggestions"><button type="button" data-say="最近想認識一起看展的朋友">找人看展</button><button type="button" data-say="最近工作有點累，想慢慢聊聊">放鬆一下</button></div>`:''}</div><form class="chat-composer" data-form="companion"><div class="composer-row"><textarea name="message" id="private-message" rows="1" placeholder="和我聊聊…" aria-label="私人訊息" maxlength="1000"></textarea><button class="send-button" type="submit" aria-label="發送給伙伴" ${companionTyping?'disabled':''}>${sendArrow}</button></div></form>`,'companion-page');}
function memories(){const items=privateSpace().memory.filter(m=>m.status!=='deleted');return shell(top('記憶','每一點了解，都可以由你修正')+content(`<p class="body-copy">這些是我目前了解到的你。<br>用來陪伴你，不會直接分享給別人。</p>${items.length?items.map(m=>`<article class="glass-card memory-card"><div class="tag-row">${tag(m.status==='pending'?'等你確認':'你已確認',m.status==='pending'?'':'green')}${tag('私人','quiet')}</div><p>${esc(m.text)}</p><div class="memory-source">來自：${esc(m.source)}</div><div class="memory-actions" style="margin-top:14px">${m.status==='pending'?tiny('是這樣的','confirm-memory',m.id):''}${tiny('修正','edit-memory',m.id)}${tiny('移除','delete-memory',m.id,'danger')}</div></article>`).join(''):empty('我們可以慢慢認識','聊聊你喜歡的事，我會把新的理解交給你確認。',btn('和伙伴聊聊','companion','compact'))}`,'with-nav')+nav('memory'));}
function demand(){
 const d=state.draft,errors=validateDemand(d,state.now),validDays=Math.max(1,Math.ceil((d.expiresAt-state.now)/86400000)||7),dayOptions=[...new Set([1,3,7,validDays])].sort((a,b)=>a-b),needsOptions=Boolean(errors.time||errors.area||errors.expiresAt);
 const schedule=Number.isFinite(Date.parse(d.time))?formatDate(d.time):'選擇時間';
 return shell(top('想一起做什麼？','1 / 2 · 帶上一個小話題')+content(`<form id="demand-form" class="request-panel" data-form="demand" novalidate><div class="request-essentials"><div class="field"><label for="topic">這次想聊的事</label><textarea id="topic" name="topic" maxlength="160" rows="2">${esc(d.topic)}</textarea></div><div class="chips request-topics" aria-label="話題靈感">${['一起看展','週末拍照','聊聊電影'].map(x=>`<button type="button" class="chip" data-topic="${x}">${x}</button>`).join('')}</div><div class="field"><label for="language">用什麼語言？</label><select id="language" name="language">${['粵語','普通話','英語'].map(x=>`<option ${d.language===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field request-mode"><span class="field-label" id="request-mode-label">怎麼開始？</span><div class="chips" role="group" aria-labelledby="request-mode-label"><button type="button" class="chip ${d.mode==='online'?'selected':''}" data-mode="online" aria-pressed="${d.mode==='online'}">線上聊聊</button><button type="button" class="chip ${d.mode==='offline'?'selected':''}" data-mode="offline" aria-pressed="${d.mode==='offline'}">一起見面</button></div><input name="mode" type="hidden" value="${esc(d.mode)}"></div></div><details class="request-options" ${needsOptions?'open':''}><summary><span>時間與更多設定</span><small data-request-option-summary>${esc(schedule)}${d.mode==='offline'?` · ${esc(d.area)}`:''} · 尋找 ${validDays} 天</small></summary><div class="request-options-body"><div class="field"><label for="time">方便交流的時間</label><input type="datetime-local" class="input date-input" id="time" name="time" value="${esc(d.time)}"></div>${d.mode==='offline'?`<div class="field"><label for="area">可前往的區域</label><select id="area" name="area">${['九龍','香港島','新界'].map(x=>`<option ${d.area===x?'selected':''}>${x}</option>`).join('')}</select></div>`:''}<div class="field"><label for="valid-days">找多久？</label><select id="valid-days" name="validDays">${dayOptions.map(n=>`<option value="${n}" ${validDays===n?'selected':''}>${n} 天</option>`).join('')}</select><span class="field-note">到期停止尋找，已認識的朋友會保留。</span></div></div></details><div id="demand-error" role="alert"></div></form><p class="request-privacy">下一步，確認給新朋友的介紹。</p>`,'with-footer request-content')+`<div class="fixed-footer"><div class="split-buttons">${btn('暫存','save-draft','white')}<button type="submit" form="demand-form" class="btn">下一步</button></div></div>`,'request-page');
}
function details(d){return `<dl class="detail-list">${detail('想做的事',d.topic)}${detail('語言',d.language)}${detail('時間',formatDate(d.time))}${detail('方式',d.mode==='online'?'先在線上聊聊':`線下見面 · ${d.area}`)}</dl>`;}
function preview(){return shell(top('把這句你好帶出去','2 / 2 · 確認後才會分享')+content(`<section class="request-panel request-intro"><div class="list-row">${avatar(actor())}<div><strong>${esc(me().name)}</strong><small>給新朋友的一句話</small></div></div><label class="field"><span class="sr-only">你的對外介紹</span><textarea id="intro-preview" aria-label="你的對外介紹" maxlength="300">${esc(state.draft.intro)}</textarea></label></section><section class="request-panel request-review"><div class="section-label"><span>用來找人的條件</span><button type="button" class="text-button" data-go="demand">修改</button></div>${details(state.draft)}</section><p class="request-privacy">只分享這份介紹與配對條件。<br>私人對話和記憶，留在你與 Klin 之間。</p>`,'with-footer request-content')+`<div class="fixed-footer">${btn('確認分享，開始找朋友','submit-demand')}</div>`,'request-page request-preview-page');}
function visitArtwork(action,label,phase='idle') {
  return visitStage({pixel:pixelVariant,companion:spiritImage(`陪你串門的 ${companionName()}`),action,label,phase});
}
function visitReview() {
  const d=state.draft;
  showSheet('帶一句話出發',`<div class="visit-review-v8"><div class="field"><label for="intro-preview">新朋友會看到</label><textarea id="intro-preview" class="visit-review-intro" maxlength="400">${esc(d.intro)}</textarea></div><div class="visit-review-conditions"><span>${esc(d.language)} · ${d.mode==='online'?'線上聊聊':esc(d.area)}</span><span>${esc(formatDate(d.time))}</span><button type="button" class="text-button" data-action="new-demand">修改</button></div><details class="visit-review-more"><summary>話題與尋找期限</summary><p>${esc(d.topic)}</p><p>尋找至 ${esc(formatDate(d.expiresAt))}</p></details><p class="visit-review-note">只公開介紹與配對條件，私人資料不會分享。</p>${btn('開始找朋友','submit-demand')}</div>`);
}
function search(){
 const d=state.demand,c=candidate();if(!d)return relations();
 const waiting=matchingDemandId===d.id,stopped=['paused','expired','ended'].includes(d.status);
 let title,action,label;
 if(stopped){title=d.status==='paused'?'先歇一會兒':'這趟旅程結束了';action=d.status==='paused'?'resume-demand':'new-demand';label=d.status==='paused'?'繼續出發':'再走一趟';}
 else if(c){title=`${esc(c.name)} 在光的另一邊`;action=c.status==='invited'?'invite':'candidate';label=c.status==='invited'?'查看邀約':'認識一下';}
 else if(d.status==='no_candidates'&&!waiting){title='再等一個聊得來的人';action='wait-again';label='再找找';}
 else{title=['Klin 帶你出發','有人也喜歡這個話題','等一個新的你好'][matchingPhase];action='visit-knock';label='打個招呼';}
 return shell(top('串門','',`<button class="friends-button" type="button" data-action="visit-people">朋友</button>`)+`<div class="portal-intro"><h3 data-match-title>${title}</h3><p>${esc(d.conditions.topic)}</p></div>${portalHit(action,label)}<div class="portal-bottom"><p class="scene-hint" data-visit-reply aria-live="polite">${c?'先看看介紹，喜歡再邀請。':stopped?'照自己的步調就好。':'把一句你好，輕輕送過去。'}</p>${waiting?`<div class="visit-progress" role="status" aria-label="正在尋找朋友">${[0,1,2].map(i=>`<i class="${i<=matchingPhase?'active':''}"></i>`).join('')}</div>`:''}${!stopped?btn('先等等','pause-demand','ghost'):''}</div>`,'portal-page search-scene');
}
function candidatePage(){const c=candidate();if(!c)return shell(top('新的可能')+content(empty('這位朋友暫時離開了','再走近另一道光吧。',btn('回到光門','search'))));return shell(top('一個新的可能')+`<div class="connection-profile"><div class="connection-name"><span class="large-avatar">${esc(c.name.slice(0,1))}</span><div><h3>${esc(c.name)}</h3><p>${esc(c.bio)}</p></div></div><div class="connection-reasons">${c.reasons.slice(0,2).map(x=>`<p>✧ ${esc(x)}</p>`).join('')}</div><div class="field"><label for="invite-intro">帶給對方的一句話</label><textarea id="invite-intro" aria-label="邀約中分享的介紹" maxlength="300">${esc(state.draft.intro)}</textarea></div><p class="scene-hint">只有確認的介紹，會隨邀約分享。</p></div><div class="fixed-footer"><div class="split-buttons">${btn('再看看','skip-candidate','white')}${btn('想認識你','send-invitation')}</div></div>`,'connection-page');}
function invitePage(){
 const inv=latestInvite();if(!inv)return shell(top('邀約')+content(empty('等一個新的你好','讓 Klin 陪你認識新朋友。',btn('去串門','relations'))));
 const incoming=inv.toId===actor(),other=incoming?{...state.users[inv.fromId],name:inv.snapshot.name}:state.users[inv.toId];
 const labels={pending:incoming?'有人想認識你':'你好，已送達',accepted:'我們都願意',declined:'這次先不了',withdrawn:'邀約已撤回',expired:'邀約已到期'};
 const notes={pending:incoming?`${other.name} 想和你聊聊。`:`等 ${other.name} 的一句你好。`,accepted:`你和 ${other.name}，準備好認識彼此了。`,declined:'照自己的步調，再遇見新朋友。',withdrawn:incoming?`${other.name} 已撤回這次邀約。`:'你已撤回這次邀約。',expired:'這次邀約已結束，可以重新出發。'};
 return shell(top(incoming?'收到的邀約':'我的邀約')+`<div class="connection-profile invitation-profile"><article class="invitation-panel"><div class="connection-name"><span class="large-avatar" aria-hidden="true">${esc(other.name.slice(0,1))}</span><div><h3>${labels[inv.status]}</h3><p>${esc(notes[inv.status]||'')}</p></div></div><div class="invitation-note"><span>${incoming?'對方的一句話':'你送出的一句話'}</span><p>${esc(inv.snapshot.intro)}</p></div><p class="request-privacy">${inv.status==='pending'?'雙方接受後，開啟共同空間。':inv.status==='accepted'?'共同空間已為你們準備好。':'準備好時，再去遇見新朋友。'}</p></article></div><div class="fixed-footer">${inv.status==='pending'?(incoming?`<div class="split-buttons">${btn('這次先不了','decline-invite','white')}${btn('我也想認識你','accept-invite')}</div>`:btn('撤回邀約','withdraw-invite','white')):inv.status==='accepted'?btn('進入共同空間','open-chat'):btn('回到串門','relations','secondary')}</div>`,'connection-page invitation-page');
}
function sharedPeople(){const rel=latestRelationship();return `<div class="shared-people">${(rel?.members||['a','b']).map((id,i)=>`<div class="shared-person person-${i}"><span class="user-scene-avatar">${avatar(id)}</span><strong>${esc(state.users[id].name)}</strong><small>${id===actor()?'你與 Klin':'朋友與 Klin'}</small></div>`).join('')}</div>`;}
function connected(){const rel=latestRelationship();if(!rel)return invitePage();return shell(top('我們的小天地')+`<div class="shared-welcome"><h3>你好，新的朋友。</h3><p>兩個你們，兩個陪伴。</p></div>${sharedPeople()}<div class="shared-start"><p>從「${esc(sharedIntro().slice(0,48))}」開始吧。</p>${btn('一起坐坐','open-chat')}</div>`,'shared-space connected-scene');}
function friendsSheet(){
  const invs=state.invitations.filter(x=>x.fromId===actor()||x.toId===actor()).slice().reverse(),rels=state.relationships.filter(x=>x.members.includes(actor())).slice().reverse();
  const list=`<div class="section-label">朋友 <span>${rels.length}</span></div>${rels.length?`<div class="glass-card">${rels.map(r=>{const other=state.users[r.members.find(x=>x!==actor())];const msg=publicMessages(state,r.id).at(-1);return `<button type="button" class="row-button list-row" data-relationship="${r.id}">${avatar(other.id)}<span class="row-main"><strong>${esc(other.name)}</strong><small>${r.status!=='active'?'這段聯繫已結束':esc(msg?.text?.slice(0,26)||'從一句你好開始吧')}</small></span><span class="chevron">›</span></button>`;}).join('')}</div>`:`<p class="small-note" style="padding:8px 0 18px">還沒有新朋友。</p>`}<div class="section-label">邀約 <span>${invs.length}</span></div>${invs.length?`<div class="glass-card">${invs.map(inv=>`<button type="button" class="row-button list-row" data-invitation="${inv.id}">${avatar(inv.toId===actor()?inv.fromId:inv.toId)}<span class="row-main"><strong>${esc(inv.toId===actor()?inv.snapshot.name:state.users[inv.toId].name)}</strong><small>${({pending:inv.toId===actor()?'等你回應':'等待對方回應',accepted:'已建立聯繫',declined:'這次先不了',withdrawn:'已撤回',expired:'已到期'})[inv.status]}</small></span><span class="chevron">›</span></button>`).join('')}</div>`:`<p class="small-note" style="padding:8px 0">暫無邀約。</p>`}`;
  showSheet('朋友與邀約',list);
}

function portalHit(action,label){return `<button type="button" class="portal-hit" data-action="${action}" aria-label="${label}"><span class="portal-fallback" aria-hidden="true"></span><span class="portal-label">${label} <span aria-hidden="true">↗</span></span></button>`;}
function relations(){
 const selected=visitTopics.find(x=>x.topic===state.draft.topic)?.id,count=state.relationships.filter(x=>x.members.includes(actor())).length+state.invitations.filter(x=>x.status==='pending'&&(x.toId===actor()||x.fromId===actor())).length;
 const action=actor()==='a'?'visit-review':'visit-people',label=actor()==='a'?'開始找朋友':'查看朋友與邀約';
 return shell(top('串門','',`<button class="friends-button" type="button" data-action="visit-people">朋友${count?` · ${count}`:''}</button>`)+`<div class="portal-intro"><h3>${actor()==='a'?'去認識一個新朋友':'有人在等你'}</h3>${actor()==='a'?`<div class="visit-topics" aria-label="想和朋友一起做的事">${visitTopics.map(t=>`<button type="button" class="visit-topic" data-action="visit-topic" data-id="${t.id}" aria-pressed="${selected===t.id}">${t.label}</button>`).join('')}<button type="button" class="visit-topic custom" data-action="new-demand" aria-label="自訂找人話題">＋</button></div>`:''}</div><button type="button" class="portal-hit portal-door-hit" data-action="${action}" aria-label="觸碰光門，${label}"><span class="portal-fallback" aria-hidden="true"></span></button><div class="portal-bottom">${btn(label,action)}${actor()==='a'&&state.demand?`<button type="button" class="portal-resume" data-go="search">${candidate()?'有人應門了':'繼續上次的尋找'} →</button>`:''}</div>`,'portal-page portal-order-v8');
}
function chat(){
 const rel=latestRelationship();if(!rel)return shell(top('共同空間')+content(empty('等你們都願意','互相接受邀約，就能一起坐坐。',btn('查看邀約','invite'))));
 const other=state.users[rel.members.find(x=>x!==actor())],msgs=publicMessages(state,rel.id);
 return shell(top('我們的小天地','',`<button type="button" class="scene-icon" data-action="relationship-options" aria-label="管理這段聯繫">⋯</button>`)+sharedPeople()+`<div class="shared-messages" id="message-scroll" role="log" aria-label="共同對話">${msgs.map(m=>`<div class="message ${m.senderId===actor()?'own':''}"><div class="message-content"><div class="message-label">${esc(state.users[m.senderId].name)}</div><div class="bubble">${esc(m.text)}</div>${m.status==='failed'?`<button type="button" class="text-button" data-retry="${m.id}">傳送失敗 · 重試</button>`:''}</div></div>`).join('')}${!msgs.length?`<div class="shared-first-hello"><p>坐近一點，從一句你好開始。</p><button type="button" class="tiny-btn" data-public-say="嗨，很高興認識你！">嗨，很高興認識你！ ↗</button></div>`:''}</div><form class="chat-composer shared-composer" data-form="public-message">${rel.status==='active'?`<button type="button" class="private-entry" data-action="private-help">私下問問 Klin <span>· 僅你可見</span></button><div class="composer-row"><textarea id="public-message" name="message" rows="1" placeholder="和 ${esc(other.name)} 說句話…" aria-label="發送給 ${esc(other.name)} 的訊息" maxlength="1000">${esc(privateSpace().publicDraft)}</textarea><button class="send-button" type="submit" aria-label="發送給朋友">${sendArrow}</button></div>`:`<p class="scene-hint">這段聯繫已結束。</p>${btn('回到房間','home')}`}</form>`,'shared-space shared-chat-page');
}
function myCard(){return publicCardData(me(),{includeRegion:me().shareRegion===true,tags:me().cardTags||[],avatar:me().cardAvatar});}
function profile(){return shell(top('我的名片','',`<button class="scene-icon" type="button" data-action="private-profile" aria-label="私人資料與帳號">⋯</button>`)+`<div class="profile-stage">${cardMarkup(myCard())}<div class="profile-card-tools"><button type="button" class="text-button" data-action="preview-card">↗ 訪客視角</button><button type="button" class="text-button" data-action="edit-card">編輯與標籤</button></div></div><div class="profile-footer"><div class="card-actions split-buttons">${btn('保存圖片','download-card','white')}${btn('分享名片','share-card')}</div><p class="scene-hint">只帶走你選擇公開的那一面。</p></div>`,'profile-card-page');}
function publicCardPage(){const data=sharedCard||myCard();return shell(`<header class="page-top"><button type="button" class="icon-button" data-action="leave-card" aria-label="返回">${backIcon}</button><div><h2>${sharedCard?'你好，新朋友':'訪客眼中的你'}</h2></div></header><div class="profile-stage">${cardMarkup(data)}</div><div class="profile-footer">${btn(sharedCard?'認識我的 Klin':'回到我的名片','leave-card')}</div>`,'public-card-page');}
function editCard(){
 cardAvatarDraft=normalizeCardAvatar(me().cardAvatar);avatarUploadSequence++;
 const tags=normalizePersonalityTags(me().cardTags||[]);
 showSheet('這張名片，很像你',`<form data-form="profile"><div class="avatar-editor"><span class="avatar-editor-preview" id="card-avatar-preview">${cardAvatarDraft?`<img src="${esc(cardAvatarDraft)}" alt="你的頭像">`:esc(me().name?.slice(0,1)||'你')}</span><div><button type="button" class="avatar-upload-button" data-action="choose-card-avatar">${cardAvatarDraft?'更換頭像':'上傳頭像'}</button><input id="card-avatar-upload" type="file" accept="image/png,image/jpeg,image/webp" class="sr-only"><button type="button" class="text-button" data-action="remove-card-avatar" ${cardAvatarDraft?'':'hidden'}>移除</button><p class="small-note" id="avatar-upload-status">頭像會出現在分享名片上</p></div></div>${field('你的名字','profile-name',me().name,'maxlength="18"')}<div class="field"><label for="bio">一句話介紹自己</label><textarea id="bio" name="bio" maxlength="160" placeholder="喜歡什麼？最近想一起做什麼？">${esc(me().bio)}</textarea></div><div class="field"><label for="card-personality-tags">我的個性標籤 · 最多 7 個</label><input class="input" id="card-personality-tags" name="cardTags" value="${esc(tags.join('，'))}" maxlength="160" placeholder="例如：AI、夜貓子、攝影控"><div class="personality-tag-suggestions">${['AI','ENFP','夜貓子','電影迷','攝影控','慢熱','咖啡腦袋'].map(t=>`<button class="tiny-btn" type="button" data-action="add-card-tag" data-tag="${t}" aria-pressed="${tags.includes(t)}">${t}</button>`).join('')}</div><p class="small-note">興趣、個性、你的日常，用逗號分開。</p></div><label class="check"><input type="checkbox" name="shareRegion" ${me().shareRegion?'checked':''}>顯示我的城市：${esc(me().region)}</label><button type="submit" class="btn" style="margin-top:20px">儲存名片</button></form>`);
}
async function uploadCardAvatar(file){
 if(!file)return;const sequence=++avatarUploadSequence;const status=$('#avatar-upload-status');if(status)status.textContent='正在準備頭像…';
 try{const avatar=await prepareAvatar(file);if(sequence!==avatarUploadSequence||!$('#sheet').open)return;cardAvatarDraft=avatar;$('#card-avatar-preview').innerHTML=`<img src="${esc(avatar)}" alt="你的頭像">`;$('[data-action="remove-card-avatar"]').hidden=false;$('#avatar-upload-status').textContent='儲存名片後生效';}
 catch(error){if(sequence===avatarUploadSequence&&$('#avatar-upload-status'))$('#avatar-upload-status').textContent=error.message;}
}

function shareCardSheet(){showSheet('這張名片，準備好了',`${cardMarkup(myCard(),{compact:true})}<p class="small-note">只分享上面這些內容。連結保留這一版名片，之後編輯不會改動已分享的版本。</p><div class="card-actions">${btn('複製名片連結','copy-card-link')}${typeof navigator.share==='function'?btn('打開分享選單','native-share-card','white'):''}${btn('保存名片圖片','download-card','ghost')}</div><div id="card-share-status" role="status"></div>`);}
function privateProfileSheet(){const b=privateSpace().birth;showSheet('私人資料與帳號',`<dl class="detail-list">${detail('語言',me().language)}${detail('城市',me().region)}${detail('生日',b.date||'未填寫')}</dl><p class="small-note">出生資料只用於我們之間的陪伴，不會放到分享名片。</p>${actor()==='a'?btn('編輯私人資料','edit-setup','white'):''}${btn('登出演示帳號','logout','ghost')}`);}


const views={landing,'public-card':publicCardPage,'setup-basics':setupBasics,'setup-birth':setupBirth,initializing,welcome,login:()=>auth(false),register:()=>auth(false),verify:()=>auth(true),onboard,home,companion,memory:memories,demand,preview,search,candidate:candidatePage,invite:invitePage,connected,relations,chat,profile};
const stages=[['登入與資料','welcome',['welcome','login','register','verify','landing','setup-basics','setup-birth','initializing']],['認識你的伙伴','home',['onboard','home','profile']],['房間裡聊聊','home',['home']],['整理社交需求','demand',['demand','preview']],['看看新的可能','search',['search','candidate']],['雙向邀約','invite',['invite','connected']],['開始真人交流','chat',['relations','chat']]];
const guides={landing:['初次見面','先輕觸 Klin 打個招呼，再用對話交換你的資料。'], 'public-card':['一張可以帶走的名片','這裡只顯示分享時確認的公開內容，不包含生辰、私人對話或記憶。'], 'setup-basics':['先建立你的資料','暱稱、對話語言和地區會保留在你的檔案。'], 'setup-birth':['由你的資料開始','生日用來建立基礎檔案；時間與出生地不詳仍可繼續。這些資料不會跟著邀約分享。'],initializing:['準備你的伙伴','完成後見到同一位默認伙伴。幼年態先與你見面，進入首頁後成長為成年態。'],welcome:['你好，Knoknok','使用 Google 演示帳號，或體驗手機號登錄。登入後接著填寫基本資料與生日。'],login:['手機號登錄','可用示範號碼 17724797877。這是本地演示，不會發送真實短信；驗證碼為 123456。'],register:['手機號登錄','可用示範號碼 17724797877。這是本地演示，不會發送真實短信；驗證碼為 123456。'],verify:['驗證手機號','本地演示驗證碼為 123456。倒計時結束後可重新發送，也可以返回修改手機號。'],onboard:['一位伙伴，慢慢認識你','不需要先選人格或完成測試。認識伙伴後，就能開始陪聊或找朋友。'],home:['先聊聊，或去認識朋友','在房間直接和 Klin 聊天。輸入框旁的串門通向新朋友，右上方可查看名片與開關聲音。'],companion:['把想法自然說出來','試試「想找人一起看展」。伙伴會先詢問是否整理需求，由你決定是否開始。'],memory:['讓理解可以被修正','確認、修改或移除一條記憶。私人記憶和對外介紹分開保存。'],demand:['這次，你想一起做什麼？','可以修改主題、時間、語言和交流方式。選擇線下時才需要地區。'],preview:['分享之前，看得清清楚楚','對外介紹可以直接編輯。私人傾訴不會自動跟著邀約公開。'],search:['等待也有清楚的下一步','使用下方控制可體驗沒有候選、暫停與到期。所有候選都是虛構演示。'],candidate:['介紹一個值得試著認識的人','看見共同話題與推薦理由，再由自己決定是否送出邀約。'],invite:['關係需要兩邊都願意','切到阿朗的視角看看收到的內容，再接受或婉拒。也可以直接模擬對方回應。'],connected:['兩次願意，一個新的開始','現在雙方都有了共同聊天入口。私人伙伴留在各自身邊。'],relations:['新的朋友留在這裡','邀約和已建立的聯繫分開。找人需求到期，不會刪掉已認識的朋友。'],chat:['由真人說話，伙伴私下幫忙','試試私人建議：放入輸入框、修改、再親自發送。切換視角可檢查可見範圍。'],profile:['名片由自己定義','修改暱稱和介紹，或返回查看伙伴目前對你的理解。']};
function currentWorldLayout(){return conversationActive&&ui.route==='home'?{x:.5,footY:.37,height:.13,world:'home',blur:false,mini:false}:undefined;}
function syncWorldAnchor(){
  if(!worldReady||growthPlaying||klinWorld.status?.action!=='idle')return;
  const layout=currentWorldLayout();if(layout)klinWorld.setLayout(layout,{immediate:true});
}
function initWorld() {
  if(klinWorld || pixelVariant)return;
  setKlinLoadingState($('#phone'),'loading');
  const host=document.createElement('div');
  host.className='klin-world-host';host.setAttribute('aria-hidden','true');
  host.addEventListener('klinworlderror',()=>{worldReady=false;setKlinLoadingState($('#phone'),'fallback');if(growthPlaying)finishGrowth();});
  host.addEventListener('klinworldready',()=>{worldReady=true;setKlinLoadingState($('#phone'),'ready');klinWorld?.setPage(ui.route,{stage:currentCompanionStage(),layout:currentWorldLayout(),immediate:true});});
  $('#phone').prepend(host);
  try {
    klinWorld=createKlinWorld({host,reducedMotion:prefersStillness(ui.motion)});
    Promise.resolve(klinWorld?.ready).then(ok=>{
      if(ok===false||!klinWorld){klinWorld=null;growthPending=false;host.remove();setKlinLoadingState($('#phone'),'fallback');return;}
      worldReady=true;setKlinLoadingState($('#phone'),'ready');
      klinWorld.setPage(ui.route,{stage:growthPending?'juvenile':currentCompanionStage(),layout:currentWorldLayout(),immediate:true});
      if(growthPending&&!stopTransition)playGrowth();
    }).catch(()=>{worldReady=false;setKlinLoadingState($('#phone'),'fallback');});
  } catch { worldReady=false;setKlinLoadingState($('#phone'),'fallback'); }
}
function finishGrowth(){
  const cancel=stopGrowth;stopGrowth=null;cancel?.();
  growthTimers.forEach(clearTimeout);growthTimers=[];
  growthPending=false;growthPlaying=false;
  $('#phone').removeAttribute('data-growing');
  $('#phone > .growth-story')?.remove();
  if(ui.route==='home')klinWorld?.setPage('home',{stage:'adult',immediate:true});
  
}
function playGrowth({replay=false}={}){
  if(ui.route!=='home'||growthPlaying)return;
  if(stopTransition){growthPending=true;return;}
  if(prefersStillness(ui.motion)||!worldReady){
    if(!worldReady&&klinWorld&&!prefersStillness(ui.motion))return;
    growthPending=false;klinWorld?.setStage?.('adult');return;
  }
  growthPending=false;growthPlaying=true;
  const phone=$('#phone');phone.dataset.growing='true';
  phone.insertAdjacentHTML('beforeend',`<div class="growth-story"><div class="growth-story-heading"><h2>和你一起，慢慢長大。</h2><p data-growth-copy role="status" aria-live="polite">你帶來的光，正在讓我長大。</p></div><div class="growth-story-footer"><span class="growth-progress" aria-hidden="true"><i></i></span><button type="button" data-action="skip-growth">直接回家</button></div></div>`);
  for(const [delay,text] of [[1500,'把這束光，藏進心裡。'],[3400,'長大一點，更靠近你一點。']])growthTimers.push(setTimeout(()=>{const copy=$('[data-growth-copy]');if(copy)copy.textContent=text;},delay));
  klinWorld.setPage('home',{stage:'juvenile',immediate:true});
  stopGrowth=klinWorld.grow({replay:true,onComplete:finishGrowth});
  growthTimers.push(setTimeout(finishGrowth,6000));
}
function render(animate=false,motion={}){
  // Incoming messages may refresh the same route during travel. Keep the UI
  // cleared until arrival instead of exposing it over the moving character.
  if(!animate&&stopTransition&&$('#app > .page[data-screen]')?.dataset.screen===ui.route){pendingSceneRefresh=true;return;}
  const sequence=++renderSequence;
  if(comparisonMode)window.parent.postMessage({type:'knok-compare-state',route:ui.route,character:pixelVariant?'pixel':'soft'},location.origin);
  if(actor()==='b'&&['demand','preview','search','candidate'].includes(ui.route))ui.route='relations';
  if(!views[ui.route])ui.route=state.session.authenticated?'home':'welcome';
  pendingSceneRefresh=false;
  const preserveWorld=!animate&&$('#app > .page[data-screen]')?.dataset.screen===ui.route;
  const cancel=stopTransition;stopTransition=null;cancel?.({preserveWorld});
  const restoreComposerFocus=conversationActive&&ui.route==='home'&&document.activeElement?.id==='private-message';
  const selection=restoreComposerFocus?[$('#private-message').selectionStart,$('#private-message').selectionEnd]:null;
  const app=$('#app'),oldPage=app.querySelector('.page'),oldScroll=$('#message-scroll')?.scrollTop;
  const routeChanged=oldPage?.dataset.screen!==ui.route;
  const useTransition=animate&&oldPage&&routeChanged&&!prefersStillness(ui.motion);
  const previous=useTransition?oldPage:null;
  const scrollPositions=useTransition?[...oldPage.querySelectorAll('.content')].map(node=>({node,top:node.scrollTop,left:node.scrollLeft})):[];
  const source=useTransition?captureCompanion(oldPage,$('#phone')):null;
  cleanDatePickers?.();cleanFormControls?.();
  app.innerHTML=views[ui.route]();
  cleanFormControls=initFormControls(app);cleanDatePickers=initDatePickers(app);initTypography(app);
  if(['chat','connected'].includes(ui.route)){const rel=latestRelationship();klinWorld?.setParticipants?.((rel?.members||[]).map(id=>state.users[id]),{activeId:actor()});}
  syncHomeScene();initWorld();
  $('#phone').dataset.conversation=String(conversationActive&&ui.route==='home');
  $('#phone').dataset.worldPage=ui.route;
  klinWorld?.setReducedMotion(prefersStillness(ui.motion));
  klinWorld?.setPortalState?.(ui.route==='search'?(candidate()?'found':matchingDemandId?'seeking':'idle'):'idle');
  if(!useTransition&&(!growthPlaying||prefersStillness(ui.motion)))klinWorld?.setPage(ui.route,{stage:growthPending?'juvenile':currentCompanionStage(),layout:currentWorldLayout(),immediate:!oldPage||routeChanged});
  if(growthPlaying&&prefersStillness(ui.motion))finishGrowth();
  if(ui.route==='home'&&!useTransition)klinWorld?.setConversationMode?.(conversationActive);
  if(conversationActive&&ui.route==='home'){const log=$('#conversation-log');if(log)log.scrollTop=log.scrollHeight;}
  if(restoreComposerFocus){const composer=$('#private-message');composer?.focus({preventScroll:true});composer?.setSelectionRange(...selection);}
  
  if(!animate||useTransition)$('.page')?.classList.add('reenter');
  syncAuthCountdown();
  const status=$('#status-icons');if(status)status.src='assets/figma-20261009/status.svg';
  document.body.classList.toggle('reduced-motion',ui.motion);
  if(pixelVariant)syncCompanionAnimation();
  $('#motion-toggle').setAttribute('aria-pressed',String(ui.motion));
  const stage=Math.max(0,stages.findIndex(x=>x[2].includes(ui.route)));
  const labels={landing:'和 Klin 打個招呼','public-card':'名片預覽','setup-basics':'基本資料','setup-birth':'出生資料',initializing:'準備伙伴',welcome:'歡迎來到 Knoknok',login:'手機號登錄',register:'手機號登錄',verify:'手機驗證碼',onboard:'認識你的伙伴',home:'我的小世界',companion:'和伙伴聊聊',memory:'伙伴的記憶',demand:'整理需求',preview:'分享預覽',search:'認識新朋友',candidate:'候選資料',invite:'雙向邀約',connected:'新的聯繫',relations:'串門',chat:'共同聊天',profile:'我的名片'};
  $('#screen-label').textContent=`${String(stage+1).padStart(2,'0')} / ${labels[ui.route]}`;
  $('#stage-count').textContent=`0${stage+1} / 07`;
  $('#journey').innerHTML=stages.map(([label,route],i)=>{let enabled=i===0||state.session.authenticated&&(actor()==='b'||landingComplete(state))&&(i<4||i===4&&state.demand||i===5&&state.invitations.length||i===6&&state.relationships.length);return `<button type="button" class="journey-step ${i===stage?'current':''} ${i<stage?'done':''}" data-go="${route}" ${!enabled?'disabled':''}><span class="step-num">${i<stage?'✓':`0${i+1}`}</span><span>${label}</span></button>`;}).join('');
  const g=guides[ui.route];$('#guide-title').textContent=g[0];$('#guide-copy').textContent=g[1];$('#guide-actions').innerHTML=guideButtons();$('#scenario-controls').innerHTML=scenarioControls();
  if(['chat','companion'].includes(ui.route)){const s=$('#message-scroll');if(s)s.scrollTop=animate||oldScroll===undefined?s.scrollHeight:Math.max(oldScroll,s.scrollHeight);}
  const arrived=()=>{
    if(sequence!==renderSequence)return;
    stopTransition=null;syncWorldAnchor();
    if(growthPending&&ui.route==='home')playGrowth();
    if(pendingSceneRefresh){pendingSceneRefresh=false;queueMicrotask(()=>render(false));}
  };
  if(animate){
    $('.page h2')?.setAttribute('tabindex','-1');
    if(previous)stopTransition=transitionScene({host:$('#phone'),app,previous,current:app.querySelector('.page'),source,world:worldReady?klinWorld:null,stage:growthPending?'juvenile':currentCompanionStage(),layout:currentWorldLayout(),scrollPositions,direction:motion.direction,onFinish:arrived});
    else {$('.page h2')?.focus({preventScroll:true});arrived();}
  }else if(growthPending&&!growthPlaying)playGrowth();
}

function guideButtons(){const inv=latestInvite();if(ui.route==='invite'&&inv?.status==='pending'&&actor()===inv.fromId)return `<button class="review-btn primary" type="button" data-action="simulate-accept">模擬對方接受邀約</button><button class="review-btn" type="button" data-action="switch-b">切到阿朗，親自回應</button>`;if(ui.route==='chat'&&latestRelationship()?.status==='active')return `<button type="button" class="review-btn primary" data-action="simulate-reply">模擬 ${esc(state.users[actor()==='a'?'b':'a'].name)} 回覆</button><button type="button" class="review-btn" data-action="private-help">看看私人 AI 建議</button>`;if(ui.route==='search'&&state.demand&&['seeking','no_candidates'].includes(state.demand.status))return `<button type="button" class="review-btn primary" data-action="simulate-found">模擬找到一位朋友</button>`;if(ui.route==='welcome')return `<button class="review-btn primary" type="button" data-action="google">開始完整體驗</button>`;return '';}
function scenarioControls(){return `${state.session.authenticated?`<div class="role-switch"><button class="review-btn ${actor()==='a'?'active':''}" type="button" data-action="switch-a">${esc(state.users.a.name)} 視角</button><button class="review-btn ${actor()==='b'?'active':''}" type="button" data-action="switch-b">阿朗視角</button></div>`:`<p class="small-note">登入後可切換雙方視角</p>`}<div class="scenario-group"><button class="review-btn" type="button" data-action="simulate-none" ${!state.demand?'disabled':''}>沒有候選</button><button class="review-btn" type="button" data-action="simulate-expire" ${!state.demand?'disabled':''}>請求到期</button><button class="review-btn ${ui.failNext?'active':''}" type="button" data-action="fail-next">${ui.failNext?'下次將失敗':'下次發送失敗'}</button><button class="review-btn" type="button" data-action="reset">重新開始</button></div><p class="small-note" style="font-size:11px;margin-top:14px">候選與聊天均為演示。<br>不會發送真實邀約或訊息。</p>`;}

function showSheet(title,body){cleanSheetDates?.();cleanSheetControls?.();const dialog=$('#sheet');$('#sheet-content').innerHTML=`<div class="sheet-inner"><div class="sheet-handle"></div><div class="sheet-title"><h3 id="sheet-title">${title}</h3><button type="button" class="icon-button" data-action="close-sheet" aria-label="關閉">×</button></div>${body}</div>`;dialog.setAttribute('aria-labelledby','sheet-title');if(!dialog.open)dialog.showModal();$('#phone').classList.add('sheet-open');if(!$('#phone > .phone-scrim'))$('#phone').insertAdjacentHTML('beforeend','<div class="phone-scrim" aria-hidden="true"></div>');cleanSheetControls=initFormControls(dialog);cleanSheetDates=initDatePickers(dialog);initTypography(dialog);positionSheet();}
function positionSheet(){const phone=$('#phone'),dialog=$('#sheet'),r=phone.getBoundingClientRect(),scale=r.width/phone.offsetWidth;dialog.style.setProperty('--sheet-left',`${r.left}px`);dialog.style.setProperty('--sheet-bottom',`${Math.max(0,innerHeight-r.bottom)}px`);dialog.style.setProperty('--sheet-width',`${phone.offsetWidth}px`);dialog.style.setProperty('--sheet-height',`${Math.min(r.height,innerHeight)*.85/scale}px`);dialog.style.setProperty('--sheet-scale',String(scale));}
function closeSheet(){cleanSheetDates?.();cleanSheetDates=null;adviceRequest++;cleanSheetControls?.();cleanSheetControls=null;if($('#sheet').open)$('#sheet').close();$('#phone').classList.remove('sheet-open');}
$('#sheet').addEventListener('close',()=>$('#phone').classList.remove('sheet-open'));
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
function simulateReply(){const rel=latestRelationship();if(!rel||rel.status!=='active')return;const original=actor();dispatch({type:'SWITCH_USER',userId:original==='a'?'b':'a'},false);dispatch({type:'SEND_MESSAGE',relationshipId:rel.id,text:'嗨，很高興認識你！我也一直想找人聊聊展覽。你比較喜歡攝影還是設計類的？'},false);dispatch({type:'SWITCH_USER',userId:original},false);render(false);toast('已加入一則模擬對方回覆');}
async function runAction(action,element){
  if(action==='close-conversation'){setHomeConversation(false);$('#private-message')?.blur();$('.home-companion')?.focus({preventScroll:true});return;}
  if(views[action])return go(action);
  switch(action){
    case 'back': return back();
    case 'landing-greet':{
      if(ui.route!=='landing'||element.disabled)return;
      element.disabled=true;klinWorld?.interact('wave');
      dispatch({type:'GREET_COMPANION'},false);
      $('.landing-invitation').innerHTML='<p>你好呀，我也很高興見到你。</p>';
      landingHelloTimer=setTimeout(()=>{if(ui.route==='landing')go(state.onboarding.basicsComplete?setupRoute():'setup-basics');},prefersStillness(ui.motion)?0:650);return;
    }
    case 'metal-voice':if(dispatch({type:'SELECT_METAL_VOICE',tone:element.dataset.id},false)){render(false);klinWorld?.interact(element.dataset.id);}return;
    case 'metal-response':if(dispatch({type:'RESPOND_TO_KLIN',response:element.dataset.id},false)){klinWorld?.interact('wave');render(false);}return;
    case 'skip-growth':return finishGrowth();
    case 'close-sheet': return closeSheet();
    case 'edit-card':return editCard();
    case 'choose-card-avatar':$('#card-avatar-upload')?.click();return;
    case 'add-card-tag':{const input=$('#card-personality-tags');const current=normalizePersonalityTags(input.value.split(/[,，、]/));const tag=element.dataset.tag;if(current.includes(tag)){input.value=current.filter(t=>t!==tag).join('，');element.setAttribute('aria-pressed','false');return;}if(current.length>=7)return toast('最多選擇 7 個標籤。');input.value=[...current,tag].join('，');element.setAttribute('aria-pressed','true');return;}
    case 'remove-card-avatar':avatarUploadSequence++;cardAvatarDraft='';$('#card-avatar-upload').value='';$('#card-avatar-preview').textContent=me().name?.slice(0,1)||'你';element.hidden=true;$('#avatar-upload-status').textContent='儲存名片後移除頭像';return;
    case 'preview-card':sharedCard=null;return go('public-card');
    case 'leave-card':{
      const fromLink=Boolean(sharedCard);sharedCard=null;
      if(new URLSearchParams(location.hash.slice(1)).has('card'))history.replaceState(null,'',location.pathname+location.search);
      return go(fromLink?(state.session.authenticated?setupRoute():'welcome'):'profile',{replace:true,direction:'back'});
    }
    case 'share-card':return shareCardSheet();
    case 'private-profile':return privateProfileSheet();
    case 'copy-card-link':{
      const url=cardShareURL(myCard(),location.href);
      try{await navigator.clipboard.writeText(url);toast('名片連結已複製，可以傳給新朋友。');$('#card-share-status').textContent='連結已複製';}
      catch{const target=$('#card-share-status');if(target)target.innerHTML=`<label class="field">名片連結<input class="input" readonly value="${esc(url)}" aria-label="複製名片連結"></label>`;target?.querySelector('input')?.select();}
      return;
    }
    case 'native-share-card':{
      try{await navigator.share({title:`${me().name}的 Knoknok 名片`,text:'從一個你好開始。',url:cardShareURL(myCard(),location.href)});}catch(error){if(error.name!=='AbortError')toast('暫時無法打開分享選單，可以複製連結。');}return;
    }
    case 'download-card':{
      element.disabled=true;try{await downloadCard(myCard());toast('名片圖片已準備下載。');}catch{toast('圖片暫時無法匯出，可以先分享名片連結。');}finally{element.disabled=false;}return;
    }
    case 'google': return showSheet('使用 Google 演示帳號',`<p>選擇虛構帳號體驗登入。這裡不會連接 Google，也不會讀取你的真實帳號。</p><button type="button" class="row-button glass-card list-row" data-action="google-confirm">${avatar('a')}<span class="row-main"><strong>Frank</strong><small>frank@example.com · 演示帳號</small></span><span>›</span></button>`);
    case 'google-confirm':dispatch({type:'DEMO_LOGIN',provider:'google'},false);return go(setupRoute());
    case 'toggle-password':{const input=$('#password');input.type=input.type==='password'?'text':'password';element.textContent=input.type==='password'?'顯示':'隱藏';element.setAttribute('aria-label',input.type==='password'?'顯示密碼':'隱藏密碼');return;}
    case 'auth-info':return showSheet('演示登入說明','<p>手機號可使用 17724797877，驗證碼為 123456。所有驗證均在本機模擬，不會發送真實短信。</p>'+btn('知道了','close-sheet'));
    case 'resend-code':if(ui.route==='verify'&&!resendSeconds()&&validPhone(authDraft.phone))sendDemoCode();return;
    case 'edit-setup':ui.setupBasics=null;ui.setupBirth=null;return go('setup-basics');
    case 'retry-initialization':if(dispatch({type:'BEGIN_INITIALIZATION'},false)){go('initializing');startInitialization();}return;

    case 'boop':klinWorld?.interact('wave');sceneSound.cue('reply');ui.boopReply=['我在。今天過得怎麼樣？','被你發現了，我一直在等你。','要聊聊，還是一起去串門？'][(ui.boopCount=(ui.boopCount||0)+1)%3];return render(false);
    case 'toggle-sound':ui.soundOn=await sceneSound.setEnabled(!ui.soundOn).catch(()=>false);save();render(false);return;
    case 'visit-from-chat':return go('relations');
    case 'visit-find':return go('relations');
    case 'visit-people':return friendsSheet();
    case 'visit-topic':{const t=visitTopics.find(x=>x.id===element.dataset.id);if(!t)return;klinWorld?.interact('look');dispatch({type:'UPDATE_DRAFT',patch:{topic:t.topic,intro:t.intro}},false);render(false);return;}
    case 'visit-review':sceneSound.cue('portal');klinWorld?.interact('knock');return visitReview();
    case 'visit-knock':klinWorld?.interact('knock');sceneSound.cue('portal');if(!matchingDemandId)startMatching();return;
    case 'new-demand':if(actor()!=='a'){toast('先切回 Frank，體驗建立找人需求。');return;}dispatch({type:'CREATE_DEMAND_DRAFT'},false);return go('demand');
    case 'dismiss-demand':dispatch({type:'DISMISS_DEMAND_SUGGESTION'});return toast('好，今天我們就慢慢聊。');
    case 'save-draft':dispatch({type:'UPDATE_DRAFT',patch:formPatch()},false);go('home');return toast('想法已暫存，還沒有開始找人。');
    case 'submit-demand':{const intro=$('#intro-preview')?.value??state.draft.intro;dispatch({type:'UPDATE_DRAFT',patch:{intro}},false);if(state.invitations.some(x=>x.status==='pending'))return confirmSheet('更新這次需求？','更新後會撤回尚未回覆的邀約，並使用新的條件重新尋找。已建立的聯繫會保留。','submit-replace','確認更新');if(dispatch({type:'SUBMIT_DEMAND',fail:consumeFailure()},false)){go('search');startMatching();}return;}
    case 'submit-replace':if(dispatch({type:'SUBMIT_DEMAND',confirmReplace:true,fail:consumeFailure()},false)){go('search');startMatching();}return;
    case 'simulate-found':clearMatching();ui.matchResult='found';if(dispatch({type:'MATCH_FOUND'},false))go('search');return;
    case 'simulate-none':clearMatching();ui.matchResult='none';if(dispatch({type:'MATCH_NONE'},false))go('search');return;
    case 'simulate-expire':clearMatching();dispatch({type:'ADVANCE_TIME',now:Math.max(state.demand?.expiresAt||0,state.now+86400000)+1000},false);closeSheet();render(false);return toast('已模擬到期，未完成邀約不能再接受。');
    case 'wait-again':ui.matchResult='found';return startMatching();
    case 'pause-demand':return confirmSheet('暫停尋找新朋友？','新的推薦會停止，尚未回覆的邀約也會撤回。已認識的朋友和聊天不受影響。','confirm-pause','暫停尋找');
    case 'confirm-pause':clearMatching();if(dispatch({type:'PAUSE_DEMAND'},false)){go('search');toast('已暫停，你可以按自己的步調來。');}return;
    case 'resume-demand':if(dispatch({type:'RESUME_DEMAND'},false)){go('search');startMatching();}return;
    case 'skip-candidate':if(candidate())dispatch({type:'SKIP_CANDIDATE',candidateId:candidate().id},false);dispatch({type:'MATCH_NONE'},false);return go('search');
    case 'send-invitation':{const c=candidate();if(!c)return toast('候選已失效，請返回尋找頁。');const intro=$('#invite-intro')?.value??state.draft.intro;if(dispatch({type:'SEND_INVITATION',candidateId:c.id,intro,fail:consumeFailure()},false)){ui.selectedInvite=state.invitations.at(-1).id;go('invite');}return;}
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
    case 'relationship-options':return showSheet('這段聯繫',`<p>你可以決定這段關係要以什麼步調繼續。</p>${btn('結束這段聯繫','end-relationship','white')}${btn('封鎖對方','block-relationship','danger')}${btn('回報不合適互動','report-relationship','ghost')}`);
    case 'end-relationship':return confirmSheet('結束這段聯繫？','結束後雙方不能再在這裡傳送訊息。過去的對話會保留供查看。','confirm-end','結束聯繫');
    case 'block-relationship':return confirmSheet('封鎖對方？','雙方不能繼續傳訊，也不會再收到彼此的推薦或邀約。','confirm-block','封鎖對方');
    case 'confirm-end':case 'confirm-block':dispatch({type:action==='confirm-end'?'END_RELATIONSHIP':'BLOCK_RELATIONSHIP',relationshipId:latestRelationship()?.id},false);closeSheet();return render(false);
    case 'report-relationship':return showSheet('回報這段互動',`<form data-form="report"><p>此原型只記錄模擬回報，不會送交真人審核。</p><div class="field"><label for="report-reason">發生了什麼？</label><select id="report-reason" name="reason"><option>不合適或令人不舒服的內容</option><option>冒充身份</option><option>騷擾或重複邀請</option></select></div><button type="submit" class="btn">記錄模擬回報</button></form>`);
    case 'toggle-motion':ui.motion=!ui.motion;save();render(false);if($('#sheet').open)showControls();return;
    case 'fail-next':ui.failNext=!ui.failNext;save();render(false);if($('#sheet').open)showControls();return toast(ui.failNext?'下次提交、AI 建議或消息發送將模擬失敗。':'已恢復正常發送。');
    case 'logout':clearMatching();homeGreeting.reset();clearAuthDraft();dispatch({type:'DEMO_LOGOUT'},false);ui.history=[];return go('welcome',{replace:true});
    case 'reset':return confirmSheet('重新體驗整個流程？','將清除這份原型在本機的演示資料，從歡迎頁重新開始。','confirm-reset','重新開始');
    case 'confirm-reset':homeGreeting.reset();clearAuthDraft();clearMatching();clearTimeout(initializeTimer);busy=false;companionTyping=false;state=initialState();ui={route:'welcome',history:[],motion:ui.motion,matchResult:'found',failNext:false};closeSheet();save();return render(true);
  }
}

document.addEventListener('click',e=>{const el=e.target.closest('button,a');if(!el)return;if(el.dataset.go){e.preventDefault();if(el.closest('.bottom-nav')&&el.dataset.go===ui.route)return;return go(el.dataset.go,{direction:el.dataset.direction});}if(el.dataset.action){e.preventDefault();return runAction(el.dataset.action,el);}if(el.dataset.topic){$('#topic').value=el.dataset.topic;return;}if(el.dataset.mode){dispatch({type:'UPDATE_DRAFT',patch:{...formPatch(),mode:el.dataset.mode}},false);return render(false);}if(el.dataset.invitation){ui.selectedInvite=el.dataset.invitation;return go('invite');}if(el.dataset.relationship){ui.selectedRelationship=el.dataset.relationship;return go('chat');}if(el.dataset.say){return sendCompanion(el.dataset.say);}if(el.dataset.publicSay){dispatch({type:'SET_PUBLIC_DRAFT',text:el.dataset.publicSay},false);render(false);$('#public-message')?.focus();return;}if(el.dataset.retry){dispatch({type:'RETRY_MESSAGE',messageId:el.dataset.retry,fail:consumeFailure()});return;}});
function sendCompanion(text){if(companionTyping)return;if(!text.trim())return toast('先寫一句想說的話吧。');const who=actor();ui.companionDrafts={...(ui.companionDrafts||{}),[who]:''};delete ui.boopReply;companionTyping=true;sceneSound.cue('send');klinWorld?.interact('look');dispatch({type:'COMPANION_SEND',text},false);render(false);if(conversationActive)$('#private-message')?.focus({preventScroll:true});setTimeout(()=>{companionTyping=false;if(actor()===who&&['companion','home'].includes(ui.route)){sceneSound.cue('reply');klinWorld?.interact('wave');render(false);}},950);}
document.addEventListener('submit',e=>{const form=e.target.closest('form[data-form]');if(!form)return;e.preventDefault();const data=new FormData(form);switch(form.dataset.form){case 'login':case 'register':{
  const phone=normalizePhone(data.get('phone'));
  if(!validPhone(phone)){$('#auth-error').innerHTML='<p class="form-error">請填寫有效的手機號。</p>';$('#auth-phone').setAttribute('aria-invalid','true');return;}
  authDraft.phone=phone;
  if(authDraft.sentPhone===phone&&resendSeconds()){go('verify');return toast('本地演示驗證碼：123456');}
  return sendDemoCode();
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
case 'companion':return sendCompanion(String(data.get('message')||''));
case 'demand':{dispatch({type:'UPDATE_DRAFT',patch:formPatch()},false);const errors=validateDemand(state.draft,state.now);delete errors.intro;if(Object.keys(errors).length){if(errors.time||errors.area||errors.expiresAt){const options=$('.request-options');if(options)options.open=true;}$('#demand-error').innerHTML=`<p class="form-error">${esc(Object.values(errors)[0])}</p>`;$('#demand-error').scrollIntoView({block:'nearest'});return;}return go('preview');}
case 'profile':{const tags=String(data.get('cardTags')||'').split(/[,，、]/).map(t=>t.trim()).filter(Boolean);if(tags.length>7)return toast('最多選擇 7 個標籤。');if(dispatch({type:'UPDATE_PROFILE',patch:{name:data.get('profile-name'),bio:data.get('bio'),cardTags:normalizePersonalityTags(tags),cardAvatar:cardAvatarDraft,shareRegion:data.has('shareRegion')}},false)){closeSheet();render(false);toast('名片已保存。');}return;}
case 'memory':if(dispatch({type:'MEMORY_EDIT',memoryId:form.dataset.id,text:data.get('text')})){closeSheet();toast('已修正，我會按新的理解陪伴你。');}return;
case 'report':dispatch({type:'REPORT_RELATIONSHIP',relationshipId:latestRelationship()?.id,reason:data.get('reason')},false);closeSheet();return toast('已記錄模擬回報，尚未送交真人審核。');
case 'public-message':{const rel=latestRelationship();if(!rel)return;const text=String(data.get('message')||'');if(dispatch({type:'SEND_MESSAGE',relationshipId:rel.id,text,fail:consumeFailure()},false))render(false);return;}
}});
document.addEventListener('focusin',e=>{if(e.target.id==='private-message'&&ui.route==='home')setHomeConversation(true);});
document.addEventListener('input',e=>{
  if(e.target.id==='auth-phone'||e.target.id==='auth-code'){
    if(e.target.id==='auth-phone')authDraft.phone=e.target.value;
    else if(!e.isComposing){e.target.value=e.target.value.replace(/[^0-9]/g,'').slice(0,6);authDraft.code=e.target.value;}
    e.target.removeAttribute('aria-invalid');$('#auth-error').textContent='';updateAuthControls();
  }
if(e.target.closest('#setup-basics-form')){ui.setupBasics=basicsFormPatch();save();}if(e.target.closest('#setup-birth-form')){ui.setupBirth=birthFormPatch();save();}if(e.target.id==='private-message'){ui.companionDrafts={...(ui.companionDrafts||{}),[actor()]:e.target.value};save();}if(e.target.id==='public-message')dispatch({type:'SET_PUBLIC_DRAFT',text:e.target.value},false);if(e.target.id==='intro-preview')dispatch({type:'UPDATE_DRAFT',patch:{intro:e.target.value}},false);});
document.addEventListener('change',e=>{if(e.target.closest('#demand-form')){const summary=$('[data-request-option-summary]');if(summary){const data=new FormData($('#demand-form'));summary.textContent=`${data.get('time')?formatDate(String(data.get('time'))):'選個方便的時間'}${data.get('mode')==='offline'&&data.get('area')?` · ${data.get('area')}`:''} · 尋找 ${data.get('validDays')||7} 天`;}}if(e.target.id==='card-avatar-upload'){uploadCardAvatar(e.target.files?.[0]);return;}if(e.target.name==='unknownTime'){const input=$('#birth-time');input.disabled=e.target.checked;if(e.target.checked)input.value='';ui.setupBirth=birthFormPatch();save();}if(e.target.closest('#setup-basics-form')){ui.setupBasics=basicsFormPatch();save();}if(e.target.closest('#setup-birth-form')){ui.setupBirth=birthFormPatch();save();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&conversationActive&&!$('#sheet').open){e.preventDefault();setHomeConversation(false);$('#private-message')?.blur();$('.home-companion')?.focus({preventScroll:true});return;}if(e.target.matches('.visit-tab')&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const find=e.key==='Home'||e.key!=='End'&&e.target.dataset.action==='visit-people';runAction(find?'visit-find':'visit-people',e.target);$(`.visit-tab[data-action="visit-${find?'find':'people'}"]`)?.focus();return;}if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&['public-message','private-message'].includes(e.target.id)){e.preventDefault();e.target.closest('form').requestSubmit();}});
$('#sheet').addEventListener('click',e=>{if(e.target===$('#sheet')){const r=$('#sheet').getBoundingClientRect();if(e.clientY<r.top||e.clientY>r.bottom||e.clientX<r.left||e.clientX>r.right)closeSheet();}});
$('#reset-button').onclick=()=>runAction('reset');
$('#motion-toggle').onclick=()=>{ui.motion=!ui.motion;save();render(false);};
function showControls(){showSheet('演示控制',`${guideButtons()}${scenarioControls()}<button type="button" class="review-btn" data-action="toggle-motion" aria-pressed="${ui.motion}">${ui.motion?'恢復動畫效果':'減少動態'}</button>`);}
$('#mobile-controls').onclick=showControls;
function resize(){klinWorld?.resize();const availableHeight=innerHeight-(shareDemo?140:innerHeight<=850?137:157);const scale=innerWidth<=650?1:Math.max(.62,Math.min(1,availableHeight/874,(innerWidth-80)/402));document.documentElement.style.setProperty('--scale',String(scale));positionSheet();}
window.addEventListener('resize',()=>{resize();requestAnimationFrame(syncWorldAnchor);});
document.addEventListener('scroll',e=>{if(e.target.matches?.('.visit-content'))requestAnimationFrame(syncWorldAnchor);},true);
window.addEventListener('scroll',()=>{if($('#sheet').open)positionSheet();},{passive:true});
window.addEventListener('storage',e=>{
  if(comparisonMode||e.key!==STATE_KEY)return;
  if(growthPlaying)finishGrowth();growthPending=false;
  const before=actor(),authenticated=state.session.authenticated;
  state=hydrateState(e.newValue);
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
document.addEventListener('animationend',e=>{
  if(e.animationName!=='klin-arrive')return;
  const companion=e.target.closest('.home-companion.is-growing');
  companion?.classList.remove('is-growing');
  companion?.querySelector('.growth-origin')?.remove();
});
setInterval(()=>{if(!state.session.authenticated)return;const previous=JSON.stringify([state.demand?.status,state.invitations.map(x=>x.status)]);state=reduce(state,{type:'ADVANCE_TIME'});if(previous!==JSON.stringify([state.demand?.status,state.invitations.map(x=>x.status)])){save();render(false);}},15000);
if(ui.route!=='public-card'&&state.session.authenticated&&actor()==='a'&&!landingComplete(state))ui.route=setupRoute();
if(ui.route==='initializing'&&state.onboarding.status==='ready')ui.route=setupRoute();
// Comparison frames use disposable demo state; the main prototype stays untouched.
function prepareComparison(route) {
  if(route==='welcome') {
    homeGreeting.reset();clearAuthDraft();clearMatching(); clearTimeout(initializeTimer); companionTyping=false; busy=false;
    state=initialState(); ui={route:'welcome',history:[],motion:ui.motion,matchResult:'found',failNext:false};
  } else if(!state.session.authenticated || !landingComplete(state)) {
    state=initialState();
    for(const action of [{type:'DEMO_LOGIN'}, {type:'GREET_COMPANION'}, {type:'SAVE_BASICS',patch:state.users.a}, {type:'SAVE_BIRTH',patch:state.private.a.birth}, {type:'BEGIN_INITIALIZATION'}, {type:'FINISH_INITIALIZATION'}, {type:'SELECT_METAL_VOICE',tone:'xin'}, {type:'RESPOND_TO_KLIN',response:'different'}]) state=reduce(state,action);
    ui.history=[];
  }
}
if(comparisonMode) {
  prepareComparison('home'); ui.route='home';
  window.addEventListener('message',event=>{
    if(event.source!==window.parent || event.origin!==location.origin || event.data?.type!=='knok-compare-route')return;
    const route=event.data.route;
    if(!['home','onboard','companion','relations','welcome'].includes(route))return;
    prepareComparison(route); go(route,{replace:true});
  });
}
if(!pixelVariant&&ui.route==='home'&&state.session.authenticated)state=reduce(state,{type:'ENTER_COMPANION_HOME'});
resize();render(true);
if(pixelVariant)initCompanionAnimation();
if(ui.route==='initializing')startInitialization();
if(ui.route==='search')startMatching();

matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event=>{klinWorld?.setReducedMotion(event.matches||ui.motion);if(event.matches){const cancel=stopTransition;stopTransition=null;cancel?.();if(growthPlaying||growthPending)finishGrowth();klinWorld?.setPage(ui.route,{stage:currentCompanionStage(),layout:currentWorldLayout(),immediate:true});}});

window.addEventListener('hashchange',()=>{const card=decodeCard(new URLSearchParams(location.hash.slice(1)).get('card')||'');if(card){sharedCard=card;go('public-card');}else if(sharedCard){sharedCard=null;go(state.session.authenticated?setupRoute():'welcome',{replace:true});}});
