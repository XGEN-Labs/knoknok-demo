import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiAuthAdapter,createAuthEntry} from '../auth-entry.mjs';
import {authEntryPanel} from '../auth-entry-ui.mjs';

test('bootstrap failures keep account input and use safe recovery text without retrying',async()=>{
 const calls=[];
 const controller=createAuthEntry({adapter:createApiAuthAdapter({origin:'https://example.test',fetch:async(url,init)=>{
  calls.push({url,init});return Response.json({error:{code:'INTERNAL_PRIVATE',message:'Error at /srv/private/account.ts:42\nsecret diagnostic'}},{status:500});
 }})});
 controller.changeUsername('existing-test-user');await controller.bootstrap();
 const view=controller.getState();assert.equal(view.step,'bootstrap');assert.equal(view.username,'existing-test-user');
 const html=authEntryPanel(view);assert.doesNotMatch(html,/INTERNAL_PRIVATE|secret diagnostic|\/srv\/private/);
 assert.equal(calls.length,1);assert.equal(calls[0].init.method,'GET');assert.equal(calls[0].init.credentials,'include');
 assert.match(html,/auth-bootstrap/);controller.dispose();
});
const setup = initialization => ({user:{id:'account-1',username:'registered-user'},accountStatus:'registered',nextAction:'setup_agent',agent:{status:'setup_required',...(initialization===undefined?{}:{initialization}),automaticProvisioning:true},onboarding:{status:'required'},memory:{status:'not_loaded'}});
for(const [state,pattern] of [['pending',/正在為你準備伙伴/],['working',/正在為你準備伙伴/],['retry_wait',/暫時未能完成.*重試策略/],['blocked',/準備遇到問題.*無法繼續/],['legacy_required',/原有伙伴的綁定需要處理/],['future_state',/尚未確認伙伴的準備狀態/]]){
 test(`setup ${state} has accurate safe copy and reload is only one status read`,async()=>{
  let reads=0;
  const auth=createAuthEntry({adapter:{kind:'api',bootstrap:async()=>{reads++;return setup({state,phase:'identity',retryable:true,error:'upstream_rejected /srv/private.ts\nsecret',retryAt:Date.now()+10000});}}});
  await auth.bootstrap();const view=auth.getState();assert.equal(view.step,'setup');assert.equal(view.authenticated,true);
  const html=authEntryPanel(view);assert.match(html,pattern);assert.match(html,/只查詢最新狀態/);assert.doesNotMatch(html,/upstream_rejected|secret|\/srv\/|identity/);assert.equal(reads,1);
  await auth.bootstrap();assert.equal(reads,2);auth.dispose();
 });
}
test('legacy missing initialization stays usable without claiming success or failure',async()=>{
 const auth=createAuthEntry({adapter:{bootstrap:async()=>setup()}});await auth.bootstrap();
 const html=authEntryPanel(auth.getState());assert.match(html,/尚未確認伙伴的準備狀態/);assert.match(html,/auth-bootstrap/);assert.match(html,/auth-exit/);auth.dispose();
});
test('bound accounts remain ready and missing binding IDs still fail closed',async()=>{
 let result={...setup(),nextAction:'open_chat',agent:{status:'bound',agentId:'agent-1',roomId:'room-1'}};
 const auth=createAuthEntry({adapter:{bootstrap:async()=>result}});await auth.bootstrap();assert.equal(auth.getState().step,'ready');assert.equal(auth.getState().bootstrap.onboarding.status,'required');
 result={...result,agent:{status:'bound',agentId:'agent-1'}};await auth.bootstrap();assert.equal(auth.getState().step,'bootstrap');assert.equal(auth.getState().errorCode,'invalid_response');auth.dispose();
});
test('unavailable recovery does not claim a request is still running and preserves rate limiting',async()=>{
 let response=Response.json({error:{code:'private',message:'secret'}},{status:429,headers:{'Retry-After':'30'}});
 const auth=createAuthEntry({adapter:createApiAuthAdapter({origin:'https://example.test',fetch:async()=>response})});await auth.bootstrap();
 const view=auth.getState();assert.ok(view.retryAt>Date.now());const html=authEntryPanel(view,{remaining:30});assert.match(html,/目前未能確認/);assert.doesNotMatch(html,/正在確認登入狀態/);assert.match(html,/30 秒後重試/);assert.match(html,/disabled/);auth.dispose();
});
test('failed logout on the setup page keeps the account and hides backend diagnostic text',async()=>{
 const auth=createAuthEntry({adapter:{bootstrap:async()=>setup({state:'blocked'}),logout:async()=>{throw Object.assign(Error('Error /srv/private.ts INTERNAL_PRIVATE'),{status:500,code:'internal'});}}});
 await auth.bootstrap();await auth.logout();const view=auth.getState();assert.equal(view.step,'setup');assert.equal(view.authenticated,true);assert.equal(view.username,'registered-user');assert.doesNotMatch(authEntryPanel(view),/\/srv\/|INTERNAL_PRIVATE/);auth.dispose();
});

test('a stalled username check times out, releases busy and permits one explicit retry',async()=>{
 let calls=0;const adapter=createApiAuthAdapter({origin:'https://example.test',entryTimeoutMs:20,fetch:async(url,{signal})=>{
  calls++;if(calls>1)return Response.json({username:'existing-user',nextAction:'login'});
  return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
 }});const auth=createAuthEntry({adapter});
 const pending=auth.entry('existing-user');assert.equal(auth.getState().busy,true);
 await Promise.race([pending,new Promise(resolve=>setTimeout(resolve,80))]);
 assert.equal(auth.getState().busy,false);assert.equal(auth.getState().errorCode,'request_timeout');assert.equal(auth.getState().step,'entry');assert.equal(auth.getState().username,'existing-user');
 assert.doesNotMatch(authEntryPanel(auth.getState()),/正在檢查|disabled/);assert.match(auth.getState().error,/逾時/);assert.equal(calls,1);
 await auth.entry('existing-user');assert.equal(calls,2);assert.equal(auth.getState().step,'login');auth.dispose();
});
test('changing username aborts the old check without a timeout error in the new input',async()=>{
 const auth=createAuthEntry({adapter:createApiAuthAdapter({origin:'https://example.test',entryTimeoutMs:20,fetch:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))})});
 const pending=auth.entry('old-user');auth.changeUsername('new-user');await pending;
 assert.equal(auth.getState().username,'new-user');assert.equal(auth.getState().busy,false);assert.equal(auth.getState().error,'');auth.dispose();
});

const subjectBootstrap=user=>({user,accountStatus:'registered',nextAction:'open_chat',agent:{status:'bound',agentId:'synthetic-agent',roomId:'synthetic-room'},onboarding:{status:'not_required'}});
test('sign-in refuses a response for a username different from the checked account',async()=>{
 let bootstraps=0;const wrong={id:1,username:'knoknok01'};
 const auth=createAuthEntry({adapter:{entry:async username=>({username,nextAction:'login'}),signIn:async()=>({user:wrong,nextAction:'bootstrap'}),bootstrap:async()=>{bootstraps++;return subjectBootstrap(wrong);}}});
 await auth.entry('knoknok22');await auth.signIn('synthetic-only');
 assert.notEqual(auth.getState().step,'ready');assert.equal(auth.getState().errorCode,'session_mismatch');assert.equal(auth.getState().authenticated,false);assert.equal(bootstraps,0);auth.dispose();
});
test('post-sign-in bootstrap must preserve the authenticated subject ID as well as username',async()=>{
 const expected={id:24,username:'knoknok22'},other={id:1,username:'knoknok22'};
 const auth=createAuthEntry({adapter:{entry:async username=>({username,nextAction:'login'}),signIn:async()=>({user:expected,nextAction:'bootstrap'}),bootstrap:async()=>subjectBootstrap(other)}});
 await auth.entry(expected.username);await auth.signIn('synthetic-only');
 assert.notEqual(auth.getState().step,'ready');assert.equal(auth.getState().errorCode,'session_mismatch');assert.equal(auth.getState().bootstrap,null);auth.dispose();
});

test('subject checks use entry canonical username rather than the originally typed case',async()=>{
 const user={id:24,username:'knoknok22'};
 const auth=createAuthEntry({adapter:{entry:async()=>({username:user.username,nextAction:'login'}),signIn:async()=>({user,nextAction:'bootstrap'}),bootstrap:async()=>subjectBootstrap({...user,id:'24'})}});
 await auth.entry('KNOKNOK22');await auth.signIn('synthetic-only');assert.equal(auth.getState().step,'ready');auth.dispose();
});
test('invalidating one page clears its authentication without logging out any server session or auto-reading',async()=>{
 const user={id:24,username:'knoknok22'};let reads=0,logouts=0;
 const auth=createAuthEntry({adapter:{entry:async()=>({username:user.username,nextAction:'login'}),signIn:async()=>({user,nextAction:'bootstrap'}),bootstrap:async()=>{reads++;return subjectBootstrap(user);},logout:async()=>{logouts++;}}});
 await auth.entry(user.username);await auth.signIn('synthetic-only');auth.invalidateSession();
 assert.equal(auth.getState().authenticated,false);assert.equal(auth.getState().step,'entry');assert.equal(auth.getState().username,user.username);assert.equal(auth.getState().bootstrap,null);assert.equal(reads,1);assert.equal(logouts,0);auth.dispose();
});
