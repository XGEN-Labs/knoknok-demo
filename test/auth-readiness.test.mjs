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
