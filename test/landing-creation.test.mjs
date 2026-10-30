import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiAuthAdapter,createAuthEntry} from '../auth-entry.mjs';
import {prepareLandingSubmission,restoreLandingSubmission,creationHandoffInformation} from '../landing-creation.mjs';
import {initialState,serializeState,hydrateState} from '../model.mjs';

const input={userName:'新朋友',agentName:'我的伙伴',birthDate:'1998-06-18',birthTime:null,gender:null,birthPlace:null,response:'想慢慢認識你',contract:{version:1,signedAt:1790000000000,userName:'新朋友',companionName:'我的伙伴'}};
const waiting=()=>({user:{id:'new-1',username:'new-user'},accountStatus:'registered',nextAction:'setup_agent',onboarding:{status:'required'},agent:{status:'setup_required'},landingCreation:{flow:'landing-v1',state:'awaiting_input'}});
const submitted=()=>({...waiting(),landingCreation:{flow:'landing-v1',state:'submitted',requestId:'request-1',input,selection:{familyId:'wood',personaSpecId:'nok-wood-1',personaVersion:'8.0.0',ruleVersion:'rongyu-day-master-v1'}},agent:{status:'setup_required',initialization:{state:'pending'}}});
const bound=()=>({...submitted(),nextAction:'open_chat',agent:{status:'bound',agentId:'agent-1',roomId:'room-1'}});

test('incomplete actual assignment fails closed instead of showing a default family',async()=>{
 const server=bound();delete server.landingCreation.selection.familyId;
 const auth=createAuthEntry({adapter:{bootstrap:async()=>server}});await auth.bootstrap();
 assert.equal(auth.getState().step,'bootstrap');assert.equal(auth.getState().errorCode,'invalid_response');assert.equal(auth.getState().bootstrap,null);auth.dispose();
});

test('signed complete input is retained for explicit retry, refresh and cross-device recovery',()=>{
 const contract={version:1,signedAt:Date.now()-1000,userName:input.userName,companionName:input.agentName};
 const server={...submitted(),landingCreation:{...submitted().landingCreation,input:{...input,contract}}};
 let state=initialState();state.session={authenticated:true,activeUserId:'a',localAuthUserId:'new-1'};
 state.private.a.companionMessages=[{id:'kept',text:'old history'}];
 assert.equal(prepareLandingSubmission(state),null);
 assert.equal(restoreLandingSubmission(state,server),true);
 const first=prepareLandingSubmission(state,{randomUUID:()=>{throw Error('must reuse');}});
 assert.equal(first.requestId,'request-1');assert.deepEqual(first.input,server.landingCreation.input);
 state=hydrateState(serializeState(state));assert.deepEqual(prepareLandingSubmission(state),first);
 assert.equal(state.private.a.companionMessages[0].id,'kept');
 assert.equal(creationHandoffInformation(server,state),null);
 assert.deepEqual(creationHandoffInformation({...server,agent:bound().agent},state),Object.fromEntries(Object.entries(input).filter(([key])=>key!=='contract')));
 assert.equal(state.onboarding.conversation.messages.some(m=>m.role==='user'&&['where','contractLight'].includes(m.key)),false);
 const old=initialState(),before=serializeState(old);assert.equal(restoreLandingSubmission(old,{...server,landingCreation:undefined}),false);assert.equal(serializeState(old),before);
});

test('only explicit server-marked new accounts enter Landing before binding',async()=>{
 let result=waiting();const auth=createAuthEntry({adapter:{bootstrap:async()=>result}});
 await auth.bootstrap();assert.equal(auth.getState().step,'landing');
 assert.deepEqual(auth.getState().bootstrap.landingCreation,result.landingCreation);
 result={...waiting(),landingCreation:undefined};await auth.bootstrap();assert.equal(auth.getState().step,'setup');
 result={...waiting(),landingCreation:{flow:'future-flow',state:'awaiting_input'}};await auth.bootstrap();assert.notEqual(auth.getState().step,'landing');
 result=bound();delete result.landingCreation;await auth.bootstrap();assert.equal(auth.getState().step,'ready');
 auth.dispose();
});

test('creation submits authenticated full input once then reads persisted state; it never completes onboarding early',async()=>{
 const calls=[];let server=waiting(),release;
 const gate=new Promise(resolve=>{release=resolve;});
 const adapter=createApiAuthAdapter({origin:'https://example.test',fetch:async(url,init)=>{
  calls.push({path:new URL(url).pathname,...init});
  if(url.endsWith('/agent-initialization/landing')){
   assert.equal(init.headers['X-Knok-User-Id'],'new-1');assert.equal(init.credentials,'include');
   assert.deepEqual(JSON.parse(init.body),{requestId:'request-1',input});await gate;server=submitted();return Response.json(server);
  }
  return Response.json(server);
 }});
 const auth=createAuthEntry({adapter});await auth.bootstrap();
 const first=auth.submitLanding({requestId:'request-1',input});
 await auth.submitLanding({requestId:'request-1',input});release();await first;
 assert.equal(calls.filter(c=>c.method==='POST').length,1);
 assert.equal(auth.getState().step,'setup');assert.deepEqual(auth.getState().bootstrap.landingCreation.input,input);
 await auth.completeOnboarding();assert.equal(calls.length,3);
 server=bound();await auth.bootstrap();assert.equal(auth.getState().step,'ready');auth.dispose();
});

test('an uncertain creation response is recovered by GET and not an automatic repeated write',async()=>{
 let server=waiting(),writes=0;
 const auth=createAuthEntry({adapter:{bootstrap:async()=>server,submitLanding:async()=>{writes++;server=submitted();throw new TypeError('lost response');}}});
 await auth.bootstrap();await auth.submitLanding({requestId:'request-1',input});
 assert.equal(writes,1);assert.equal(auth.getState().step,'setup');
 await auth.submitLanding({requestId:'request-1',input});assert.equal(writes,1);auth.dispose();
});

test('another device already submitted: conflict restores the frozen input without writing a second plan',async()=>{
 let server=waiting(),writes=0;
 const auth=createAuthEntry({adapter:{bootstrap:async()=>server,submitLanding:async()=>{writes++;server=submitted();throw Object.assign(Error('conflict'),{status:409,code:'landing_input_conflict'});}}});
 await auth.bootstrap();await auth.submitLanding({requestId:'another-request',input:{...input,response:'changed draft'}});
 assert.equal(writes,1);assert.equal(auth.getState().step,'setup');assert.deepEqual(auth.getState().bootstrap.landingCreation.input,input);auth.dispose();
});

test('old unbound accounts cannot submit a new creation even when onboarding is required',async()=>{
 const server=waiting();delete server.landingCreation;let writes=0;
 const auth=createAuthEntry({adapter:{bootstrap:async()=>server,submitLanding:async()=>{writes++;}}});
 await auth.bootstrap();await auth.submitLanding({requestId:'request-1',input});assert.equal(writes,0);assert.equal(auth.getState().step,'setup');auth.dispose();
});

test('creation errors retain input route and never display server diagnostics',async()=>{
 const auth=createAuthEntry({adapter:{bootstrap:async()=>waiting(),submitLanding:async()=>{throw Object.assign(Error('/srv/private.ts SECRET'),{status:422,code:'invalid_landing'});}}});
 await auth.bootstrap();await auth.submitLanding({requestId:'request-1',input});
 assert.equal(auth.getState().step,'landing');assert.equal(auth.getState().errorCode,'invalid_landing');assert.doesNotMatch(auth.getState().error,/SECRET|private/);auth.dispose();
});

test('a changed account during creation recovery cannot receive the old account result',async()=>{
 let server=waiting();
 const auth=createAuthEntry({adapter:{bootstrap:async()=>server,submitLanding:async()=>{server={...bound(),user:{id:'other-1',username:'other-user'}};}}});
 await auth.bootstrap();await auth.submitLanding({requestId:'request-1',input});
 assert.equal(auth.getState().errorCode,'session_mismatch');assert.equal(auth.getState().bootstrap,null);auth.dispose();
});
