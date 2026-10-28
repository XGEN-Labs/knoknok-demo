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
 assert.deepEqual(landingInformation({onboarding:{conversation:{answers}}}),{userName:information.userName,agentName:information.agentName,response:information.response});
 const prompt=landingPrompt(information);assert.ok(!prompt.includes(information.birthDate));assert.ok(!prompt.includes(information.birthPlace));assert.match(prompt,/不用再提問/);assert.match(prompt,/不啟動其他任務/);assert.match(prompt,/私有資料規則/);
});
test('one existing chat request contains the full handoff and its reply is only acknowledged, not inserted into later chat',async()=>{
 const h=harness();await h.controller.ensure(information);assert.equal(h.calls.length,1);assert.equal(h.calls[0][0].length,1);assert.equal(h.calls[0][0][0].role,'user');assert.equal(h.calls[0][0][0].content,landingPrompt(information));assert.equal(h.calls[0][1],'1');assert.equal(h.receipts.length,1);assert.equal(h.receipts[0].receipt.provider,'knok-agent');assert.equal('text' in h.receipts[0].receipt,false);
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
