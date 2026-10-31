import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiAuthAdapter,createAuthEntry} from '../auth-entry.mjs';
import {prepareLandingSubmission,restoreLandingSubmission,creationHandoffInformation} from '../landing-creation.mjs';
import {createLandingHandoff} from '../compat/web-naming/landing-handoff.mjs';
import {initialState,reduce,hydrateState,serializeState} from '../model.mjs';
import {assignedFamily} from '../family-presentation.mjs';

const chart={id:'a'.repeat(64),version:3,labels:{dayMaster:'乙木',zodiac:'金牛座',element:'wood'}};
const input={userName:'新朋友',agentName:'小芽',response:'想慢慢認識你',birthChartId:chart.id,birthChartVersion:3,contract:{version:1,signedAt:1790000000000,userName:'新朋友',companionName:'小芽'}};
const waiting=()=>({user:{id:'new-1',username:'new-user'},accountStatus:'registered',nextAction:'setup_agent',onboarding:{status:'required'},agent:{status:'setup_required'},birthChart:{protocol:'shared-birth-chart-v1',status:'required',chart:null},landingCreation:{flow:'shared-birth-chart-v1',state:'awaiting_input'}});
const saved=()=>({...waiting(),birthChart:{protocol:'shared-birth-chart-v1',status:'ready',chart}});
const bound=()=>({...saved(),nextAction:'open_chat',agent:{status:'bound',agentId:'agent-1',roomId:'room-1'},landingCreation:{flow:'shared-birth-chart-v1',state:'submitted',requestId:'request-1',input,selection:{profileId:'nok/default',content:{id:'content-1',version:'1.0.0',integrity:'sha256:fixture',sourceSha256:'b'.repeat(64),creationProfileId:'nok/default'},chart}}});

test('shared visual element comes only from the native structured receipt after binding',()=>{
 assert.equal(assignedFamily(saved()),null);assert.equal(assignedFamily(bound())?.id,'wood');
 const withoutElement=structuredClone(bound());delete withoutElement.landingCreation.selection.chart.labels.element;
 assert.equal(assignedFamily(withoutElement),null);
});

test('the declared shared protocol enters Landing before a chart or Agent exists and retains the saved receipt',async()=>{
 let server=waiting();const auth=createAuthEntry({adapter:{bootstrap:async()=>server}});
 await auth.bootstrap();assert.equal(auth.getState().step,'landing');assert.equal(auth.getState().bootstrap.birthChart.status,'required');
 server=saved();await auth.bootstrap();assert.equal(auth.getState().step,'landing');assert.deepEqual(auth.getState().bootstrap.birthChart.chart,chart);
 server=bound();await auth.bootstrap();assert.equal(auth.getState().step,'ready');auth.dispose();
});
test('shared capability and flow must agree and malformed receipt versions fail closed',async()=>{
 for(const server of [{...waiting(),birthChart:undefined},{...waiting(),birthChart:{protocol:'future-protocol',status:'required',chart:null}},{...bound(),birthChart:{protocol:'shared-birth-chart-v1',status:'ready',chart:{...chart,version:0}}}]){
  const auth=createAuthEntry({adapter:{bootstrap:async()=>server}});await auth.bootstrap();assert.equal(auth.getState().errorCode,'invalid_response');assert.equal(auth.getState().bootstrap,null);auth.dispose();
 }
});
test('shared signed receipt resumes on a fresh browser without inventing birth answers and pins the same chart',()=>{
 let state=initialState();state.session={authenticated:true,activeUserId:'a',localAuthUserId:'new-1'};
 state.private.a.companionMessages=[{id:'kept',text:'existing history'}];
 assert.equal(restoreLandingSubmission(state,bound()),true);
 assert.equal(state.onboarding.conversation.step,'complete');
 for(const key of ['birthDate','birthTime','gender','birthPlace'])assert.equal(Object.hasOwn(state.onboarding.conversation.answers,key),false);
 state=hydrateState(serializeState(state));assert.equal(state.onboarding.conversation.step,'complete');
 const request=prepareLandingSubmission(state,{bootstrap:bound(),randomUUID:()=>{throw Error('must reuse frozen request');}});
 assert.deepEqual(request,{requestId:'request-1',input});
 assert.deepEqual(creationHandoffInformation(bound(),state),{userName:'新朋友',agentName:'小芽',response:'想慢慢認識你'});
 state=reduce(state,{type:'FINISH_CONVERSATION'});assert.equal(state.error,null);assert.equal(state.onboarding.status,'ready');
 assert.deepEqual(state.users.a.cardTags,['乙木','金牛座']);assert.equal(state.private.a.companionMessages.some(m=>m.id==='kept'),true);
});
test('shared submission requires the authoritative chart and cannot reuse a stale chart reference',()=>{
 const state=initialState();restoreLandingSubmission(state,bound());
 assert.equal(prepareLandingSubmission(state,{bootstrap:waiting()}),null);
 const changed={...saved(),birthChart:{...saved().birthChart,chart:{...chart,version:4}}};
 const request=prepareLandingSubmission(state,{bootstrap:changed,randomUUID:()=> 'request-2'});
 assert.equal(request.input.birthChartVersion,4);assert.equal(request.requestId,'request-2');
 for(const key of ['birthDate','birthTime','gender','birthPlace'])assert.equal(Object.hasOwn(request.input,key),false);
});
test('a completed shared account restores native card defaults in a fresh browser and preserves edited tags',()=>{
 const server={...bound(),onboarding:{status:'completed'}},state=initialState();state.users.a.cardTags=[];delete state.private.a.socialTags;
 assert.equal(restoreLandingSubmission(state,server),true);assert.deepEqual(state.users.a.cardTags,['乙木','金牛座']);
 const edited=initialState();edited.users.a.cardTagsEdited=true;edited.users.a.cardTags=['自己確認的標籤'];delete edited.private.a.socialTags;
 restoreLandingSubmission(edited,server);assert.deepEqual(edited.users.a.cardTags,['自己確認的標籤']);
});
test('shared handoff uses names and introduction without rewriting native birth storage',async()=>{
 let writes=0,prompt='';const handoff=createLandingHandoff({request:async()=>{writes++;throw Error('must preserve native chart profile');},chat:async messages=>{prompt=messages[0].content;return {source:'model',provider:'knok-agent',text:'received'};},accepted:()=>{}});
 handoff.activate('new-1',{agentId:'agent-1',roomId:'room-1'});
 await handoff.ensure(creationHandoffInformation(bound(),initialState()),null,{persistBirthProfile:false});
 assert.equal(writes,0);assert.match(prompt,/小芽/);assert.doesNotMatch(prompt,/birthChart|birthDate|birthTime|birthPlace|gender|2000|23:30/);
});
test('chart save uses same-origin Cookie and the frozen account owner, then reads bootstrap only',async()=>{
 let server=waiting();const calls=[];
 const adapter=createApiAuthAdapter({origin:'https://example.test',fetch:async(url,init)=>{calls.push({path:new URL(url).pathname,init});if(url.endsWith('/onboarding/birth-chart')&&init.method==='POST'){server=saved();return Response.json({birthChart:server.birthChart});}return Response.json(server);}});
 const auth=createAuthEntry({adapter});await auth.bootstrap();assert.equal(typeof auth.saveBirthChart,'function');
 await auth.saveBirthChart({'birth-date':'2000-05-15','birth-time':'23:30','birth-sex':'男','birth-timezone':'Asia/Shanghai',calendar:'solar','leap-month':'否','timezone-confirmed':'已确认','chart-consent':'同意'});assert.equal(auth.getState().step,'landing');assert.deepEqual(auth.getState().bootstrap.birthChart.chart,chart);
 const writes=calls.filter(c=>c.init.method==='POST');assert.equal(writes.length,1);assert.equal(writes[0].path,'/api/auth/onboarding/birth-chart');assert.equal(writes[0].init.headers['X-Knok-User-Id'],'new-1');assert.equal(writes[0].init.credentials,'include');assert.equal(writes[0].init.headers.Authorization,undefined);auth.dispose();
});
test('pending chart saves read the same owner until ready and never require or create an Agent',async()=>{
 const form={'birth-date':'2000-05-15','birth-time':'23:30','birth-sex':'男','birth-timezone':'Asia/Shanghai',calendar:'solar','leap-month':'否','timezone-confirmed':'已确认','chart-consent':'同意'};
 let reads=0,writes=0;const auth=createAuthEntry({adapter:{bootstrap:async()=>{reads++;return reads<3?{...waiting(),birthChart:{protocol:'shared-birth-chart-v1',status:'pending',chart:null}}:saved();},saveBirthChart:async()=>{writes++;return {birthChart:{protocol:'shared-birth-chart-v1',status:'pending',chart:null}};}}});
 await auth.bootstrap();await auth.saveBirthChart(form);assert.equal(writes,1);assert.ok(reads>=3);assert.equal(auth.getState().bootstrap.birthChart.status,'ready');assert.equal(auth.getState().step,'landing');auth.dispose();
});
