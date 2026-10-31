import test from 'node:test';
import assert from 'node:assert/strict';
import * as charts from '../compat/web-naming/birth-chart.mjs';
import {initialState} from '../model.mjs';

const chart={id:'a'.repeat(64),version:1,labels:{dayMaster:'壬水',zodiac:'白羊座',element:'water'}};
const input={userName:'已簽甲',agentName:'已簽伙伴',response:'已確認的介紹',birthChartId:chart.id,birthChartVersion:1,contract:{version:1,signedAt:1790000000000,userName:'已簽甲',companionName:'已簽伙伴'}};
const boot=()=>({user:{id:101},onboarding:{status:'required'},agent:{status:'bound'},birthChart:{protocol:'shared-birth-chart-v1',status:'ready',chart:structuredClone(chart)},landingCreation:{flow:'shared-birth-chart-v1',state:'submitted',requestId:'signed-1',input:structuredClone(input)}});

test('compat restores only the frozen non-birth signed input over conflicting local answers',()=>{
 assert.equal(typeof charts.restoreSharedLanding,'function');
 const state=initialState();state.onboarding.conversation.answers={name:'本地舊名',companionName:'本地舊伙伴',response:'本地舊介紹',birthDate:'1995-03-10',birthTime:'02:00'};
 assert.equal(charts.restoreSharedLanding(state,boot(),101),true);
 assert.deepEqual(state.onboarding.conversation.answers,{name:'已簽甲',companionName:'已簽伙伴',response:'已確認的介紹'});
 assert.deepEqual(state.onboarding.contract,input.contract);assert.equal(state.users.a.name,'已簽甲');assert.equal(state.users.a.companionName,'已簽伙伴');
 assert.deepEqual(state.onboarding.creationRequest,{requestId:'signed-1',input});
 const reloaded=charts.sharedLandingConversation(JSON.parse(JSON.stringify(state.onboarding.conversation)));
 assert.equal(reloaded.step,'complete');assert.equal(reloaded.complete,false);assert.deepEqual(reloaded.answers,state.onboarding.conversation.answers);
});
test('compat refuses a different owner or mismatched chart without changing that account',()=>{
 assert.equal(typeof charts.restoreSharedLanding,'function');
 for(const server of [{...boot(),user:{id:202}},{...boot(),birthChart:{...boot().birthChart,chart:{...chart,version:2}}}]){
  const state=initialState(),before=structuredClone(state);assert.equal(charts.restoreSharedLanding(state,server,101),false);assert.deepEqual(state,before);
 }
});
test('compat signed-receipt handoff uses server names and introduction and requires its binding',()=>{
 assert.equal(typeof charts.sharedLandingInformation,'function');
 assert.deepEqual(charts.sharedLandingInformation(boot(),101),{userName:'已簽甲',agentName:'已簽伙伴',response:'已確認的介紹'});
 assert.equal(charts.sharedLandingInformation({...boot(),agent:{status:'setup_required'}},101),null);
 assert.equal(charts.sharedLandingInformation(boot(),202),null);
 const invalid=boot();invalid.landingCreation.input.birthDate='1995-03-10';assert.equal(charts.sharedLandingInformation(invalid,101),null);
});
