// Username-first authentication. The API adapter follows frontend-login.md;
// the default adapter is an in-memory Demo, never a production identity service.
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.length > 0;
const userValid = user => plain(user) && (nonempty(user.id) || Number.isFinite(user.id)) && nonempty(user.username);

export class AuthEntryError extends Error {
  constructor(message, {status = 0, code = 'network_error', retryAt = 0} = {}) {
    super(message); this.name = 'AuthEntryError'; this.status = status; this.code = code; this.retryAt = retryAt;
  }
}
export function authRetryAt(value, now = Date.now()) {
  if (typeof value !== 'string' || !value.trim()) return now + 30000;
  if (/^\d+(?:\.\d+)?$/.test(value.trim())) return now + Math.ceil(Number(value) * 1000);
  const date = Date.parse(value); return Number.isFinite(date) ? Math.max(now, date) : now + 30000;
}
const protocolError = () => new AuthEntryError('服務回覆不完整，請重試。', {code:'invalid_response'});
const cleanOnboarding = value => {
  if (value === undefined) return {status:'not_required'};
  if (!plain(value) || !['required','completed','not_required'].includes(value.status)) throw protocolError();
  return clone(value);
};
const abortError = () => Object.assign(new Error('Request cancelled'), {name:'AbortError'});
const assertActive = signal => { if (signal?.aborted) throw abortError(); };

export function createApiAuthAdapter({fetch:fetcher = globalThis.fetch, origin = globalThis.location?.origin, logoutPath = null, now = Date.now} = {}) {
  if (typeof fetcher !== 'function') throw new TypeError('A fetch implementation is required');
  const base = new URL(origin || 'http://localhost');
  if (!['http:','https:'].includes(base.protocol)) throw new TypeError('Authentication requires an HTTP origin');
  function endpoint(path) {
    const url = new URL(path, base);
    if (url.origin !== base.origin || !['http:','https:'].includes(url.protocol) || url.username || url.password) throw new TypeError('Authentication endpoints must be same-origin');
    return url.href;
  }
  if (logoutPath !== null) endpoint(logoutPath);
  async function request(path, {method='POST', body, signal, owner}={}) {
    assertActive(signal);
    const response = await fetcher(endpoint(path), {
      method, credentials:'include', mode:'same-origin', redirect:'error', cache:'no-store', signal,
      headers:{Accept:'application/json',...(body === undefined ? {} : {'Content-Type':'application/json'}),...(owner === undefined ? {} : {'X-Knok-User-Id':String(owner)})},
      ...(body === undefined ? {} : {body:JSON.stringify(body)}),
    });
    assertActive(signal);
    let data = null; try { data = await response.json(); } catch { if (response.ok && response.status !== 204) throw protocolError(); }
    assertActive(signal);
    if (!response.ok) {
      const detail = plain(data?.error) ? data.error : data;
      const message = typeof detail?.message === 'string' ? detail.message.slice(0,300) : '請稍後再試。';
      throw new AuthEntryError(message,{status:response.status,code:detail?.code || (typeof data?.error==='string'?data.error:`http_${response.status}`),retryAt:response.status===429?authRetryAt(response.headers?.get('Retry-After'),now()):0});
    }
    return data;
  }
  return {
    kind:'api',
    entry:(username,{signal}={})=>request('/api/auth/entry',{body:{username},signal}),
    signIn:(username,password,{signal}={})=>request('/api/auth/sign-in',{body:{username,password},signal}),
    register:(username,password,{signal}={})=>request('/api/auth/register',{body:{username,password},signal}),
    bootstrap:({signal}={})=>request('/api/auth/bootstrap',{method:'GET',signal}),
    completeOnboarding:(owner,{signal}={})=>request('/api/auth/onboarding/complete',{body:{},owner,signal}),
    logout:({signal}={})=>{
      if (!logoutPath) throw new AuthEntryError('尚未設定服務端登出介面，請稍後再試。',{status:501,code:'logout_unavailable'});
      return request(logoutPath,{signal});
    },
  };
}

export function createDemoAuthAdapter({
  initialSession = null, accountStore = new Map(), existingUsername = 'knoknok.demo', existingPassword = 'Knoknok2026', crypto = globalThis.crypto,
} = {}) {
  const fixture = {user:{id:'demo-fixture',username:existingUsername},agent:{status:'bound',agentId:'demo-fixture-agent',roomId:'demo-fixture-room'},kind:'fixture',onboarding:{status:'not_required'}};
  let session = null, counter = accountStore.size;
  function record(username) { return username === existingUsername ? fixture : accountStore.get(username); }
  function publicSession(value) {
    return {user:clone(value.user),accountStatus:'registered',nextAction:'open_chat',agent:clone(value.agent),memory:{status:'not_loaded'},onboarding:clone(value.onboarding),demo:true,demoAccountKind:value.kind};
  }
  // This optional seed only resumes the host's already-authenticated local Demo.
  // It is not a cookie, proof of identity, or an API mode fallback.
  if (initialSession && initialSession.authenticated !== false) {
    const username = initialSession.user?.username || initialSession.username || existingUsername;
    if (username === existingUsername) session = fixture;
    else {
      const id = String(initialSession.user?.id || initialSession.id || `demo-user-${++counter}`);
      session = record(username) || {user:{id,username},agent:{status:'bound',agentId:initialSession.agentId||`demo-agent-${id}`,roomId:initialSession.roomId||`demo-room-${id}`},kind:'ephemeral',onboarding:cleanOnboarding(initialSession.onboarding),hash:null,salt:null};
      accountStore.set(username,session);
    }
  }
  async function digest(password,salt) {
    if (!crypto?.subtle) throw new AuthEntryError('目前瀏覽器無法建立本地演示帳號。',{code:'demo_unavailable',status:503});
    const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${salt}\u0000${password}`));
    return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  return {
    kind:'demo',
    async entry(username,{signal}={}) {
      assertActive(signal);
      if (!nonempty(username.trim())) throw new AuthEntryError('請輸入帳號。',{status:400,code:'username_required'});
      if (Array.from(username).length<3 || Array.from(username).length>30) throw new AuthEntryError('帳號需要 3–30 個字元。',{status:400,code:'username_length'});
      username=username.trim();
      return record(username) ? {username,nextAction:'login'} : {username,nextAction:'register',passwordMode:'set_password'};
    },
    async signIn(username,password,{signal}={}) {
      assertActive(signal); const account = record(username);
      if (!account) throw new AuthEntryError('帳號不存在，請重新檢查。',{status:409,code:'account_not_found'});
      const valid = account.kind === 'fixture' ? password === existingPassword : !!account.hash && await digest(password,account.salt) === account.hash;
      assertActive(signal);
      if (!valid) throw new AuthEntryError('帳號或密碼不正確，或帳號暫不可用。',{status:401,code:'invalid_credentials'});
      session = account; return {user:clone(account.user),nextAction:'bootstrap'};
    },
    async register(username,password,{signal}={}) {
      assertActive(signal);
      if (record(username)) throw new AuthEntryError('帳號已存在，請登入或修改帳號。',{status:409,code:'account_exists'});
      if (!nonempty(username.trim()) || !nonempty(password)) throw new AuthEntryError('請填寫帳號和密碼。',{status:400,code:'missing_credentials'});
      if (Array.from(username).length<3 || Array.from(username).length>30) throw new AuthEntryError('帳號需要 3–30 個字元。',{status:400,code:'username_length'});
      if (password.length<6 || password.length>64) throw new AuthEntryError('密碼需要 6–64 個字元。',{status:400,code:'password_length'});
      const salt = crypto?.randomUUID?.() || `${Date.now()}-${++counter}`, hash = await digest(password,salt); assertActive(signal);
      if (record(username)) throw new AuthEntryError('帳號已存在，請登入或修改帳號。',{status:409,code:'account_exists'});
      const id=`demo-user-${salt}`;
      session={user:{id,username},agent:{status:'bound',agentId:`demo-agent-${salt}`,roomId:`demo-room-${salt}`},kind:'ephemeral',onboarding:{status:'required'},hash,salt};
      accountStore.set(username,session); return {user:clone(session.user),nextAction:'bootstrap'};
    },
    async bootstrap({signal}={}) { assertActive(signal); if (!session) throw new AuthEntryError('請重新登入。',{status:401,code:'unauthenticated'}); return publicSession(session); },
    async completeOnboarding(owner,{signal}={}) {
      assertActive(signal);
      if (!session) throw new AuthEntryError('請重新登入。',{status:401,code:'unauthenticated'});
      if (String(session.user.id)!==String(owner)) throw new AuthEntryError('登入帳號已變更。',{status:409,code:'SESSION_CHANGED'});
      if (session.onboarding.status==='required') session.onboarding={status:'completed'};
      return {onboarding:clone(session.onboarding)};
    },
    async logout({signal}={}) { assertActive(signal); session=null; return null; },
  };
}

function cleanBootstrap(value) {
  if (!plain(value) || !userValid(value.user) || value.accountStatus !== 'registered' || !plain(value.agent)) throw protocolError();
  const bound = value.nextAction === 'open_chat' && value.agent.status === 'bound' && nonempty(value.agent.agentId) && nonempty(value.agent.roomId);
  const setup = value.nextAction === 'setup_agent' && value.agent.status === 'setup_required';
  if (!bound && !setup) throw protocolError();
  return {user:clone(value.user),onboarding:cleanOnboarding(value.onboarding),accountStatus:'registered',nextAction:value.nextAction,agent:clone(value.agent),memory:plain(value.memory)?clone(value.memory):{status:'not_loaded'},...(value.chat?{chat:clone(value.chat)}:{}),...(value.demo===true?{demo:true,demoAccountKind:value.demoAccountKind}: {})};
}
export function createAuthEntry({adapter = createDemoAuthAdapter(), onChange = () => {}, now = Date.now} = {}) {
  let state={step:'entry',username:'',passwordMode:null,busy:false,error:'',errorCode:'',retryAt:0,authenticated:false,bootstrap:null,user:null,adapterKind:adapter.kind||'api'};
  let sequence=0,requestController=null,disposed=false;
  const snapshot=()=>clone(state);
  function emit(patch) { state={...state,...patch}; if (!disposed) onChange(snapshot()); return snapshot(); }
  function begin(patch={}) {
    requestController?.abort();requestController=new AbortController();const id=++sequence;
    emit({busy:true,error:'',errorCode:'',...patch});return {id,signal:requestController.signal};
  }
  const current=token=>!disposed && token.id===sequence && !token.signal.aborted;
  const waiting=()=>disposed || (state.retryAt>now());
  function problem(error,token,patch={}) {
    if (!current(token) || error?.name==='AbortError') return snapshot();
    const status=Number(error?.status)||0,code=error?.code||'network_error';
    const message=status===429?'操作有點頻繁，請稍等後再試。':status===503?'服務暫時不可用，請稍後重試。':status===401?'帳號或密碼不正確，或帳號暫不可用。':code==='invalid_response'?'服務回覆不完整，請重試。':status===0?'連線暫時中斷，請重試。':error?.message||'暫時無法完成，請重試。';
    return emit({busy:false,error:message,errorCode:code,retryAt:status===429?(error.retryAt||now()+30000):0,...patch});
  }
  function applyEntry(result) {
    if (!plain(result) || !nonempty(result.username) || !['login','register'].includes(result.nextAction) || (result.nextAction==='register'&&!['set_password','assigned_password'].includes(result.passwordMode))) throw protocolError();
    emit({step:result.nextAction,username:result.username,passwordMode:result.nextAction==='register'?result.passwordMode:null,busy:false,error:'',errorCode:'',retryAt:0});
  }
  async function restore(token,{recoveryUsername=null}={}) {
    try {
      const result=cleanBootstrap(await adapter.bootstrap({signal:token.signal}));if (!current(token)) return snapshot();
      if (recoveryUsername && result.user.username!==recoveryUsername) {
        return emit({step:'bootstrap',busy:false,authenticated:true,bootstrap:null,user:result.user,error:'目前登入的帳號與剛才不同，請先退出後重新檢查帳號。',errorCode:'session_mismatch'});
      }
      return emit({step:result.agent.status==='bound'?'ready':'setup',username:result.user.username,authenticated:true,user:result.user,bootstrap:result,busy:false,error:'',errorCode:'',retryAt:0,passwordMode:null});
    } catch(error) {
      if (!current(token)) return snapshot();
      if (error.status===401) return emit({step:'entry',authenticated:false,user:null,bootstrap:null,passwordMode:null,busy:false,error:'',errorCode:'',retryAt:0});
      return problem(error,token,{step:'bootstrap'});
    }
  }
  async function recoverLostMutation(token,username) {
    emit({step:'bootstrap',error:'',errorCode:''});
    const result=await restore(token,{recoveryUsername:username});if (!current(token) || result.authenticated || result.step==='bootstrap' || result.errorCode==='session_mismatch') return result;
    // An uncertain write is never repeated automatically. Check the same account.
    emit({busy:true});
    try {
      const check=await adapter.entry(username,{signal:token.signal});if (!current(token)) return snapshot();applyEntry(check);
      return emit({error:check.nextAction==='login'?'帳號已存在，請使用剛才的密碼登入。':'尚未確認註冊成功，請檢查後重試。',errorCode:'response_lost'});
    } catch(error) { return problem(error,token,{step:'entry',username}); }
  }
  async function mutate(kind,password,confirmation) {
    if (waiting() || state.busy || state.step!==kind) return snapshot();
    if (!nonempty(password)) return emit({error:'請輸入密碼。',errorCode:'password_required'});
    if (kind==='register' && state.passwordMode==='set_password' && password!==confirmation) return emit({error:'兩次密碼不一致，請再確認。',errorCode:'password_mismatch'});
    const username=state.username,token=begin();
    try {
      const result=await adapter[kind==='login'?'signIn':'register'](username,password,{signal:token.signal});
      if (!current(token)) return snapshot();
      if (!plain(result) || !userValid(result.user) || result.nextAction!=='bootstrap') throw protocolError();
      emit({step:'bootstrap',authenticated:true,user:clone(result.user),bootstrap:null});
      return restore(token,{recoveryUsername:result.user.username});
    } catch(error) {
      if (!current(token)) return snapshot();
      if (error?.name==='AbortError') return snapshot();
      if (!error.status || error.code==='invalid_response') return recoverLostMutation(token,username);
      if (kind==='register'&&error.status===409&&error.code==='account_exists') return emit({step:'login',passwordMode:null,busy:false,error:'帳號已存在，請登入或修改帳號。',errorCode:error.code});
      if (kind==='login'&&error.status===409&&error.code==='account_not_found') return emit({step:'entry',passwordMode:null,busy:false,error:'帳號狀態已改變，請重新檢查帳號。',errorCode:error.code});
      return problem(error,token,{step:kind});
    }
  }
  return {
    getState:snapshot,
    async entry(username) {
      if (waiting()) return snapshot();
      if (state.authenticated) return emit({error:'請先退出目前帳號，再切換帳號。',errorCode:'logout_required'});
      if (typeof username!=='string'||!username.trim()) return emit({error:'請輸入帳號。',errorCode:'username_required'});
      if (state.busy&&state.step==='entry'&&state.username===username) return snapshot();
      const token=begin({step:'entry',username,passwordMode:null,authenticated:false,bootstrap:null,user:null});
      try {const result=await adapter.entry(username,{signal:token.signal});if(current(token))applyEntry(result);return snapshot();}catch(error){return problem(error,token,{step:'entry'});}
    },
    signIn:password=>mutate('login',password),
    register:(password,confirmation)=>mutate('register',password,confirmation),
    changeUsername(username=state.username) {
      if (disposed) return snapshot();requestController?.abort();sequence++;
      if (state.authenticated) return emit({busy:false,error:'請先退出目前帳號，再切換帳號。',errorCode:'logout_required'});
      return emit({step:'entry',username:typeof username==='string'?username:state.username,passwordMode:null,busy:false,error:'',errorCode:'',authenticated:false,user:null,bootstrap:null});
    },
    async bootstrap() {if(waiting()||state.busy)return snapshot();return restore(begin({step:'bootstrap'}));},
    async completeOnboarding() {
      if(waiting()||state.busy||!state.authenticated||state.step!=='ready')return snapshot();
      const owner=state.user.id,token=begin();
      try {
        const result=await adapter.completeOnboarding(owner,{signal:token.signal});
        if(!current(token))return snapshot();
        const onboarding=cleanOnboarding(result?.onboarding);
        if(onboarding.status==='required'||!result?.onboarding)throw protocolError();
        return emit({busy:false,bootstrap:{...state.bootstrap,onboarding}});
      } catch(error){return problem(error,token);}
    },
    async logout() {
      if(disposed)return snapshot();const token=begin();
      try {await adapter.logout({signal:token.signal});if(!current(token))return snapshot();return emit({step:'entry',username:'',passwordMode:null,busy:false,error:'',errorCode:'',retryAt:0,authenticated:false,user:null,bootstrap:null});}
      catch(error){return problem(error,token);}
    },
    dispose() {if(disposed)return;requestController?.abort();sequence++;disposed=true;state={...state,busy:false};},
  };
}
