import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiAuthAdapter, createAuthEntry, createDemoAuthAdapter} from '../auth-entry.mjs';
import {createApi} from '../compat/web-naming/api.mjs';
import {landingComplete, applyAccountOnboarding} from '../landing.mjs';
import {initialState, reduce, serializeState, hydrateState} from '../model.mjs';

test('existing account bypasses landing without fabricating questionnaire or dropping history',()=>{
 let state=initialState();state=reduce(state,{type:'DEMO_LOGIN'});
 state.private.a.companionMessages.push({id:'retained',role:'user',text:'old conversation'});
 const answers=structuredClone(state.onboarding);
 applyAccountOnboarding(state,{status:'not_required'});
 assert.equal(landingComplete(state),true);
 state=reduce(state,{type:'ENTER_COMPANION_HOME'});
 assert.equal(state.error,null);assert.deepEqual(state.onboarding,answers);
 assert.ok(state.private.a.companionMessages.some(m=>m.id==='retained'));
 state=hydrateState(serializeState(state));
 applyAccountOnboarding(state,{status:'completed'});assert.equal(landingComplete(state),true);
 applyAccountOnboarding(state,{status:'required'});assert.equal(landingComplete(state),false);
});

test('demo registration stays required across logout until completed; returning accounts skip',async()=>{
 const auth=createAuthEntry({adapter:createDemoAuthAdapter()});
 await auth.entry('newtest');await auth.register('only-test-password','only-test-password');
 assert.equal(auth.getState().bootstrap.onboarding.status,'required');
 await auth.logout();await auth.entry('newtest');await auth.signIn('only-test-password');
 assert.equal(auth.getState().bootstrap.onboarding.status,'required');
 await auth.completeOnboarding();await auth.logout();await auth.entry('newtest');await auth.signIn('only-test-password');
 assert.equal(auth.getState().bootstrap.onboarding.status,'completed');
 await auth.logout();await auth.entry('knoknok.demo');await auth.signIn('Knoknok2026');
 assert.equal(auth.getState().bootstrap.onboarding.status,'not_required');
});

test('real adapter preserves server onboarding and completion uses cookie plus owner consistency header',async()=>{
 const calls=[];let status='required';
 const adapter=createApiAuthAdapter({origin:'https://example.test',logoutPath:'/api/auth/logout',fetch:async(url,init)=>{
  calls.push({url,init});
  if(url.endsWith('/onboarding/complete')){assert.equal(init.headers['X-Knok-User-Id'],'42');assert.equal(init.credentials,'include');assert.deepEqual(JSON.parse(init.body),{});status='completed';return Response.json({onboarding:{status}});}
  return Response.json({user:{id:42,username:'newtest'},accountStatus:'registered',nextAction:'open_chat',agent:{status:'bound',agentId:'agent',roomId:'room'},onboarding:{status},memory:{status:'not_loaded'}});
 }});
 const auth=createAuthEntry({adapter});await auth.bootstrap();assert.equal(auth.getState().bootstrap.onboarding.status,'required');
 await auth.completeOnboarding();assert.equal(auth.getState().bootstrap.onboarding.status,'completed');assert.equal(calls.length,2);
});

test('compat auth accepts old response but rejects unknown onboarding instead of inventing progress',async()=>{
 let data={user:{id:1,username:'old'}};
 const api=createApi({fetchImpl:async()=>Response.json(data)});
 assert.equal((await api.me()).onboarding.status,'not_required');
 data={...data,onboarding:{status:'required'}};assert.equal((await api.login('old','test')).onboarding.status,'required');
 data={...data,onboarding:{status:'unknown'}};await assert.rejects(api.me());
});
