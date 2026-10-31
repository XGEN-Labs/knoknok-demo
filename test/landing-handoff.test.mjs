import test from 'node:test';
import assert from 'node:assert/strict';
import { createLandingHandoff, landingInformation, landingPrompt } from '../compat/web-naming/landing-handoff.mjs';
import { createApi } from '../compat/web-naming/api.mjs';
const information={userName:'小岚',agentName:'星舟',birthDate:'1995-03-10',birthTime:null,gender:'女生',birthPlace:'上海',response:'我喜欢周末去看展'};
const response={source:'model',provider:'knok-agent',text:'已收到。'};
function harness(chat=async()=>response){const calls=[],receipts=[];const controller=createLandingHandoff({chat:async(...args)=>{calls.push(args);return chat(...args);},accepted:(r,o)=>receipts.push({receipt:r,owner:o})});controller.activate(1);return{controller,calls,receipts};}
test('full actual landing information is carried with unset choices, not initial demo defaults',()=>{
 assert.equal(landingInformation({users:{a:{name:'Frank',companionName:'Klin'}},onboarding:{}}),null);
 const answers={name:'小岚',companionName:'星舟',birthDate:'1995-03-10',birthTime:null,gender:'女生',birthPlace:'上海',response:'我喜欢周末去看展'};
 assert.deepEqual(landingInformation({onboarding:{conversation:{answers}}}),information);
 const prompt=landingPrompt(information);assert.ok(!prompt.includes(information.birthDate));assert.ok(!prompt.includes(information.birthPlace));assert.match(prompt,/不用再提問/);assert.match(prompt,/不啟動其他任務/);assert.match(prompt,/私有資料規則/);
});
test('one existing chat request contains the full handoff and its reply is only acknowledged, not inserted into later chat',async()=>{
 const h=harness();await h.controller.ensure(information);assert.equal(h.calls.length,1);assert.equal(h.calls[0][0].length,1);assert.equal(h.calls[0][0][0].role,'user');assert.equal(h.calls[0][0][0].content,landingPrompt(information));assert.equal(h.calls[0][1],'1');assert.deepEqual(h.calls[0][3],{purpose:'landing_handoff'});assert.equal(h.receipts.length,1);assert.equal(h.receipts[0].receipt.provider,'knok-agent');assert.equal('text' in h.receipts[0].receipt,false);
});
test('refresh and login reuse only this owner and this intake receipt; later normal chat does not resend it',async()=>{
 const h=harness();await h.controller.ensure(information);const receipt=h.receipts[0].receipt;
 h.controller.activate(1);await h.controller.ensure(information,receipt);assert.equal(h.calls.length,1);
 h.controller.activate(2);await h.controller.ensure(information,receipt);assert.equal(h.calls.length,2);assert.equal(h.receipts[1].owner,'2');
 h.controller.activate(1);await h.controller.ensure({...information,agentName:'新名字'},receipt);assert.equal(h.calls.length,3);
});
test('two simultaneous finish clicks share one pending submission',async()=>{
 let finish;const h=harness(()=>new Promise(r=>finish=r));const a=h.controller.ensure(information),b=h.controller.ensure(information);
 while(!finish)await new Promise(r=>setImmediate(r));finish(response);assert.deepEqual(await Promise.all([a,b]),[true,true]);assert.equal(h.calls.length,1);assert.equal(h.receipts.length,1);
});
test('failure retains intake and permits explicit retry without claiming acceptance',async()=>{
 let fail=true;const h=harness(async()=>{if(fail)throw Error('offline');return response;});const original=structuredClone(information);
 await assert.rejects(h.controller.ensure(information));assert.deepEqual(information,original);assert.equal(h.receipts.length,0);
 fail=false;await h.controller.ensure(information);assert.equal(h.calls.length,2);assert.equal(h.receipts.length,1);
});
test('fallback reply cannot stand in for native Agent delivery',async()=>{
 const h=harness(async()=>({...response,provider:'gemini'}));await assert.rejects(h.controller.ensure(information));assert.equal(h.receipts.length,0);
});
test('late old-account response never saves a receipt under the new account',async()=>{
 let finish;const h=harness(()=>new Promise(r=>finish=r));const pending=h.controller.ensure(information);
 while(!finish)await new Promise(r=>setImmediate(r));h.controller.activate(2);assert.equal(h.calls[0][2].aborted,true);finish(response);await assert.rejects(pending,{name:'AbortError'});assert.equal(h.receipts.length,0);
});
test('empty legacy data does not generate invented user facts',async()=>{const h=harness();assert.equal(await h.controller.ensure(null),false);assert.equal(h.calls.length,0);});
test('handoff uses unchanged cookie-authenticated Web chat contract and owner guard',async()=>{
 let observed;const api=createApi({fetchImpl:async(url,options)=>{observed={url,options};return new Response(JSON.stringify(response),{headers:{'content-type':'application/json'}});}});
 const h=createLandingHandoff({chat:api.chat,accepted:()=>{}});h.activate(2);await h.ensure(information);
 assert.equal(observed.url,'/api/web/chat');assert.equal(observed.options.credentials,'same-origin');assert.equal(observed.options.headers['X-Knok-User-Id'],'2');assert.deepEqual(Object.keys(JSON.parse(observed.options.body)),['messages']);assert.equal(observed.options.headers.Authorization,undefined);
});

const binding={agentId:'agent-1',roomId:'room-1'};
const stored=(profile=null,version=0,extra={})=>({...binding,version,profile,profileConsent:false,updatedAt:null,...extra});
function storageHarness({initial=stored(),patchFailure,get=undefined}={}){
 let current=structuredClone(initial);const operations=[],receipts=[];
 const controller=createLandingHandoff({
  request:async(path,options={})=>{operations.push({path,method:options.method||'GET',body:options.body});if(!options.method)return get?get():structuredClone(current);if(patchFailure)throw patchFailure;assert.equal(options.body.expectedVersion,current.version);current=stored(options.body.profile,current.version+1,{profileConsent:options.body.profileConsent,updatedAt:'2026-10-30T00:00:00Z'});return structuredClone(current);},
  chat:async()=>{operations.push({method:'CHAT'});return response;},accepted:(receipt,owner)=>receipts.push({receipt,owner}),
 });controller.activate(1,binding);return {controller,operations,receipts,current:()=>current};
}
test('confirmed Landing stores the structured profile before chat and maps only actual Gregorian answers',async()=>{
 const h=storageHarness();await h.controller.ensure(information);
 assert.deepEqual(h.operations.map(op=>op.method),['GET','PATCH','CHAT']);
 assert.deepEqual(h.operations[1],{path:'/api/web/birth-profile',method:'PATCH',body:{expectedVersion:0,profile:{nickname:'小岚',birthDate:'1995-03-10',calendar:'solar',birthSex:'女',birthplace:'上海'},profileConsent:true}});
 assert.equal(h.receipts.length,1);
});
test('unknown answers omit birth fields instead of guessing time, timezone, sex or confirmation',async()=>{
 const h=storageHarness();await h.controller.ensure({...information,birthDate:null,birthTime:null,gender:'不想说',birthPlace:null});
 assert.deepEqual(h.current().profile,{nickname:'小岚'});
 const male=storageHarness();await male.controller.ensure({...information,birthTime:'09:05',gender:'男性'});assert.equal(male.current().profile.birthSex,'男');assert.equal(male.current().profile.birthTime,'09:05');
});
test('a failed structured save keeps the submitted answers and never acknowledges or chats',async()=>{
 const h=storageHarness({patchFailure:Error('offline')}),before=structuredClone(information);
 await assert.rejects(h.controller.ensure(information),/offline/);assert.deepEqual(information,before);assert.deepEqual(h.operations.map(op=>op.method),['GET','PATCH']);assert.equal(h.receipts.length,0);
});
test('an old accepted receipt repairs missing native storage without sending Landing chat again',async()=>{
 const old=harness();await old.controller.ensure(information);
 const h=storageHarness();await h.controller.ensure(information,old.receipts[0].receipt);
 assert.deepEqual(h.operations.map(op=>op.method),['GET','PATCH']);assert.equal(h.current().profile.birthDate,'1995-03-10');assert.equal(h.receipts.length,0);
});
test('legacy repair preserves newer server data and previously cleared profiles without invoking chat',async()=>{
 for(const initial of [stored({birthDate:'2000-02-02'},4,{profileConsent:true}),stored(null,7)]){
  const h=storageHarness({initial});await h.controller.repair(information);await h.controller.repair(information);
  assert.deepEqual(h.operations.map(op=>op.method),['GET']);assert.deepEqual(h.current(),initial);
 }
});
test('legacy repair resolves a concurrent initialization by reading the winner, never overwriting it',async()=>{
 const winner=stored({birthDate:'2001-01-01'},1,{profileConsent:true});let reads=0;
 const h=storageHarness({get:()=>++reads===1?stored():winner,patchFailure:Object.assign(Error('conflict'),{status:409})});
 assert.equal(await h.controller.repair(information),true);assert.deepEqual(h.operations.map(op=>op.method),['GET','PATCH','GET']);assert.equal(h.receipts.length,0);
});
test('account switching while reading storage cancels before PATCH or Landing chat',async()=>{
 let finish;const h=storageHarness({get:()=>new Promise(resolve=>finish=resolve)});const pending=h.controller.ensure(information);
 for(let turns=0;!finish&&turns<100;turns++)await new Promise(resolve=>setImmediate(resolve));assert.equal(typeof finish,'function','storage read must precede handoff');h.controller.activate(2,{agentId:'agent-2',roomId:'room-2'});finish(stored());
 await assert.rejects(pending,{name:'AbortError'});assert.deepEqual(h.operations.map(op=>op.method),['GET']);assert.equal(h.receipts.length,0);
});
test('birth form edits use the viewed version and preserve unrelated native profile fields',async()=>{
 const h=storageHarness({initial:stored({nickname:'Native',birthDate:'1990-01-01',birthTime:'07:00',birthTimezone:'Asia/Tokyo',birthTimezoneConfirmed:true,birthSex:'女',calendar:'lunar',leapMonth:true,mbti:'INTJ'},3,{profileConsent:true})});
 const viewed=await h.controller.readBirthProfile();
 await h.controller.saveBirthProfile({date:'1995-03-10',time:'',unknownTime:true,place:'上海',timezone:''},viewed);
 assert.deepEqual(h.operations[1].body,{expectedVersion:3,profile:{nickname:'Native',birthSex:'女',mbti:'INTJ',birthDate:'1995-03-10',calendar:'solar',birthplace:'上海'},profileConsent:true});
 assert.equal(h.operations.filter(op=>op.method==='CHAT').length,0);
});
test('birth form conflicts reject the save with its draft intact and no blind retry',async()=>{
 const h=storageHarness({initial:stored({nickname:'Native'},2),patchFailure:Object.assign(Error('conflict'),{status:409})});
 const viewed=await h.controller.readBirthProfile(),draft={date:'1995-03-10',time:'07:00',unknownTime:false,place:'上海',timezone:'Asia/Shanghai'},before=structuredClone(draft);
 await assert.rejects(h.controller.saveBirthProfile(draft,viewed),/conflict/);assert.deepEqual(draft,before);assert.deepEqual(h.operations.map(op=>op.method),['GET','PATCH']);
});
test('storage reads and writes reuse the authenticated live request contract',async()=>{
 const {createLiveSession}=await import('../live-session.mjs');let current=stored();const calls=[];
 const live=createLiveSession({fetchImpl:async(url,init)=>{calls.push({url,init});if(init.method==='PATCH'){const body=JSON.parse(init.body);current=stored(body.profile,1,{profileConsent:body.profileConsent,updatedAt:'2026-10-30T00:00:00Z'});}return Response.json(current);}});live.activate(1);
 const controller=createLandingHandoff({request:(...args)=>live.request(...args),chat:async()=>response,accepted:()=>{}});controller.activate(1,binding);await controller.ensure(information);
 assert.equal(calls.length,2);for(const {url,init} of calls){assert.equal(url,'/api/web/birth-profile');assert.equal(init.credentials,'same-origin');assert.equal(init.redirect,'error');assert.equal(init.headers['X-Knok-User-Id'],'1');assert.equal(init.headers.Authorization,undefined);}
});

test('unexpected sex strings cannot turn inherited object properties into profile values',async()=>{
 const h=storageHarness();await h.controller.ensure({...information,gender:'constructor'});assert.equal(Object.hasOwn(h.current().profile,'birthSex'),false);
});
test('a signed-out storage repair rejects with the session cancellation contract',async()=>{
 const h=storageHarness();h.controller.clear();await assert.rejects(h.controller.repair(information),{name:'AbortError'});
});
test('a mismatched binding response is never saved or acknowledged',async()=>{
 const h=storageHarness({initial:stored(null,0,{agentId:'another-agent'})});await assert.rejects(h.controller.ensure(information));assert.deepEqual(h.operations.map(op=>op.method),['GET']);assert.equal(h.receipts.length,0);
});
test('switching account during a profile write cannot acknowledge or chat for the old owner',async()=>{
 let finish;const calls=[],receipts=[];const h=createLandingHandoff({request:async(path,options)=>{calls.push(options?.method||'GET');return options?new Promise(resolve=>finish=resolve):stored();},chat:async()=>{calls.push('CHAT');return response;},accepted:r=>receipts.push(r)});h.activate(1,binding);
 const pending=h.ensure(information);for(let turns=0;!finish&&turns<100;turns++)await new Promise(resolve=>setImmediate(resolve));assert.equal(typeof finish,'function');h.activate(2,{agentId:'agent-2',roomId:'room-2'});finish(stored({birthDate:'1995-03-10'},1,{profileConsent:true,updatedAt:'2026-10-30T00:00:00Z'}));
 await assert.rejects(pending,{name:'AbortError'});assert.deepEqual(calls,['GET','PATCH']);assert.equal(receipts.length,0);
});

test('unchanged birth save accepts an equal native version only when profile and consent match',async()=>{
 const profile={nickname:'Native',birthDate:'1995-03-10',calendar:'solar',birthTime:'09:05',birthplace:'上海',birthTimezone:'Asia/Shanghai',birthTimezoneConfirmed:true},current=stored(profile,3,{profileConsent:true,updatedAt:'2026-10-30T00:00:00Z'});
 const draft={date:'1995-03-10',time:'09:05',unknownTime:false,place:'上海',timezone:'Asia/Shanghai'};
 for(const mismatch of [false,true]){
  const controller=createLandingHandoff({request:async(path,options)=>options&&mismatch?{...current,profile:{...profile,birthplace:'北京'}}:structuredClone(current),chat:async()=>response,accepted:()=>{}});controller.activate(1,binding);
  const viewed=await controller.readBirthProfile();
  if(mismatch)await assert.rejects(controller.saveBirthProfile(draft,viewed));
  else assert.deepEqual(await controller.saveBirthProfile(draft,viewed),current);
 }
});
test('birth form changes to date, time or place invalidate old timezone confirmation',async()=>{
 const initial=stored({birthDate:'1995-03-10',birthTime:'09:05',birthplace:'上海',birthTimezone:'Asia/Shanghai',birthTimezoneConfirmed:true,calendar:'solar'},3,{profileConsent:true});
 for(const change of [{date:'1996-04-12'},{time:'11:00'},{place:'北京'}]){
  const h=storageHarness({initial}),viewed=await h.controller.readBirthProfile();await h.controller.saveBirthProfile({date:'1995-03-10',time:'09:05',unknownTime:false,place:'上海',timezone:'Asia/Shanghai',...change},viewed);
  assert.equal(Object.hasOwn(h.current().profile,'birthTimezoneConfirmed'),false);
 }
});
test('changed Landing birth fields cannot reuse an earlier timezone confirmation',async()=>{
 const h=storageHarness({initial:stored({nickname:'小岚',birthDate:'1994-01-01',birthTime:'09:05',birthplace:'北京',birthSex:'女',calendar:'solar',birthTimezone:'Asia/Shanghai',birthTimezoneConfirmed:true},3,{profileConsent:true})});
 await h.controller.ensure({...information,birthTime:'09:05'});assert.equal(h.current().profile.birthTimezone,'Asia/Shanghai');assert.equal(Object.hasOwn(h.current().profile,'birthTimezoneConfirmed'),false);
});
