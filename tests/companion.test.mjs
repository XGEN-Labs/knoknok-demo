import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../model.mjs';
import { landingComplete } from '../landing.mjs';
import { applyCompanionBinding, selectLandingCharacter } from '../companion-state.mjs';
import { createApi } from '../api.mjs';
test('server binding overrides stale local completion and restores across devices',()=>{
 const state=initialState();state.session.provider='account';
 state.onboarding.status='ready';state.onboarding.basicsComplete=true;state.onboarding.birthComplete=true;state.onboarding.conversation.complete=true;
 applyCompanionBinding(state,{state:'missing'});assert.equal(landingComplete(state),false);
 const ready={state:'ready',agentId:'A',character:{key:'r1'},userName:'甲',companionName:'小金'};
 applyCompanionBinding(state,ready);assert.equal(landingComplete(state),true);assert.equal(state.users.a.companionName,'小金');
 const fresh=initialState();fresh.session.provider='account';applyCompanionBinding(fresh,ready);assert.equal(landingComplete(fresh),true);
 applyCompanionBinding(fresh,{state:'pending'});assert.equal(landingComplete(fresh),false);
});
test('visual Klin is an explicit published character selection; ambiguous or missing content fails',()=>{
 const one={name:'Klin',key:'r1'},two={name:'Klin',key:'r2'};
 assert.equal(selectLandingCharacter([one],null).key,'r1');
 assert.throws(()=>selectLandingCharacter([],null));assert.throws(()=>selectLandingCharacter([one,two],null));
 assert.equal(selectLandingCharacter([one,two],{character:two}).key,'r2');
});
test('initialization transmits only approved names and content key, with owner check',async()=>{
 let sent;const api=createApi({fetchImpl:async(url,opts)=>{sent={url,...opts};return new Response(JSON.stringify({state:'ready'}))}});
 const body={characterKey:'r1',companionName:'Klin',userName:'甲'};
 await api.initializeCompanion(body,2);assert.equal(sent.url,'/api/companion');assert.equal(sent.headers['X-Knok-User-Id'],'2');assert.deepEqual(JSON.parse(sent.body),body);
});
