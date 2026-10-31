import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {landingBrowserFixture} from '../test/fixtures/landing-browser.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const {initialState}=await import(pathToFileURL(join(root,'dist/web/model.mjs')).href);
const prefix='knokknok-prototype-v1-klin-demo-v1-rebuild-20261023-account-';
function seed(userName,agentName,complete){const s=initialState();Object.assign(s.users.a,{name:userName,companionName:agentName});s.private.a.companion.name=agentName;
 Object.assign(s.onboarding,{basicsComplete:true,birthComplete:true,status:'ready',initializedAt:s.now,contractRequired:true,contract:{version:1,signedAt:s.now,userName,companionName:agentName},conversation:{version:2,step:'complete',complete,messages:[],answers:{birthDate:'1995-03-10',birthTime:null,gender:'女生',birthPlace:'上海',response:'我喜欢周末看展',name:userName,companionName:agentName}}});s.onboarding.agentHandoff={version:1,provider:'knok-agent',digest:'old-test-receipt'};s.private.a.companionMessages.push({id:'previous-chat',role:'user',text:'以前的聊天',source:'model',provider:'knok-agent',status:'sent',createdAt:s.now});return JSON.stringify(s);}
let fixture,browser,context,page;const checks=[],errors=[];const report={passed:false,scope:'Built Web in real Chrome; local BFF/model fixture, no production or Memory verification',checks,pageErrors:errors};
try{
 fixture=await landingBrowserFixture(join(root,'dist/web'));browser=await chromium.launch({...process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:'chrome'},headless:true});context=await browser.newContext({viewport:{width:430,height:932},reducedMotion:'reduce'});
 await context.addInitScript(({prefix,a,b})=>{if(sessionStorage.getItem('seeded'))return;localStorage.setItem(prefix+'101',a);localStorage.setItem(prefix+'202',b);sessionStorage.setItem('seeded','1');},{prefix,a:JSON.stringify(initialState()),b:seed('乙用户','乙伙伴',false)});
 page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));await page.goto(fixture.url,{waitUntil:'domcontentloaded'});
 async function login(id){await page.locator('[data-action="login"]').click();await page.locator('#auth-account').fill(`test${id}`);await page.locator('#auth-password').fill('fixture-only');await page.locator('#auth-form button[type="submit"]').click();}
 async function logout(){await page.locator('.home-top [data-go="profile"]').click();await page.locator('[data-action="account-menu"]').click();await page.locator('[data-action="logout"]').click();await page.locator('[data-action="login"]').waitFor();}
 async function send(id,text){await page.locator('#private-message').click();await page.locator('#private-message').fill(text);await page.locator('#private-message').press('Enter');await page.locator('#conversation-log').getByText(`正常回覆 ${id}`,{exact:true}).last().waitFor();}
 const read=async id=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),prefix+id);
 async function freshLanding(id){await page.locator('#onboarding-calendar').waitFor({state:'visible'});const state=await read(id);assert.equal(state.onboarding.conversation.step,'birthDate');assert.deepEqual(state.onboarding.conversation.answers,{});assert.equal(state.onboarding.contract,null);assert.equal(state.onboarding.agentHandoff,undefined);assert.equal(await page.locator('#private-message').count(),0);}
 // Stage the unchanged questionnaire only after checking the account-level gate.
 async function stageFinish(id,userName,agentName){await page.evaluate(({key,staged})=>{const state=JSON.parse(localStorage.getItem(key));state.onboarding=JSON.parse(staged).onboarding;delete state.onboarding.agentHandoff;localStorage.setItem(key,JSON.stringify(state));},{key:prefix+id,staged:seed(userName,agentName,false)});await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-action="onboarding-coda"]').click();await page.locator('[data-action="onboarding-coda"]').click();}
 await login(202);await page.locator('#private-message').waitFor({state:'visible'});
 assert.ok((await read(202)).private.a.companionMessages.some(m=>m.id==='previous-chat'));
 assert.equal((await read(202)).onboarding.conversation.complete,false);
 await logout();await login(202);await page.locator('#private-message').waitFor({state:'visible'});
 assert.equal(fixture.accepted.length,0);checks.push('existing account skips landing on first visit and logout/login without rewriting draft or history');
 await logout();await login(303);await page.locator('#private-message').waitFor({state:'visible'});
 assert.equal(fixture.accepted.length,0);checks.push('older auth response without onboarding remains usable for existing accounts');
 await logout();await login(101);await freshLanding(101);assert.equal(fixture.calls.length,0);
 await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key));state.onboarding.conversation.answers={birthDate:'1995-03-10'};state.onboarding.conversation.step='birthTime';localStorage.setItem(key,JSON.stringify(state));},prefix+'101');await page.reload({waitUntil:'domcontentloaded'});await page.locator('.birth-hour-grid').waitFor({state:'visible'});assert.equal((await read(101)).onboarding.conversation.answers.birthDate,'1995-03-10');checks.push('new account requires landing and reload resumes unfinished answers');
 await page.evaluate(async()=>{await fetch('/api/auth/logout',{method:'POST'});});await page.reload({waitUntil:'domcontentloaded'});await login(101);await page.locator('.birth-hour-grid').waitFor({state:'visible'});assert.equal((await read(101)).onboarding.conversation.answers.birthDate,'1995-03-10');checks.push('unfinished new account resumes answers after logout/login');
 await stageFinish(101,'甲用户','甲伙伴');
 await page.locator('#chart-date').fill('2024-02-30');await page.locator('#chart-time').fill('12:00');
 await page.locator('#chart-sex').selectOption('男');await page.locator('#chart-zone').selectOption('Asia/Shanghai');
 await page.locator('#chart-calendar').selectOption('lunar');await page.locator('#chart-leap').selectOption('否');
 await page.locator('[name="timezone-confirmed"]').check();await page.locator('[name="chart-consent"]').check();
 await page.locator('[data-form="birth-chart"] button[type="submit"]').click();await page.getByText('日主：壬水 · 星座：白羊座',{exact:true}).waitFor();
 assert.equal(fixture.chartSaves[0].body['birth-date'],'2024-02-30');assert.equal(fixture.chartSaves[0].body.calendar,'lunar');
 checks.push('real Chromium submits lunar 2024-02-30 unchanged and displays the native vector labels');
 assert.equal(fixture.landings.size,0);
 await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/web/chat')&&r.status()===503),page.locator('[data-action="finish-conversation"]').click()]);
 await page.locator('#toast').filter({hasText:'資料仍保留'}).waitFor();assert.equal(await page.locator('#private-message').count(),0);assert.equal((await read(101)).onboarding.agentHandoff,undefined);assert.equal((await read(101)).onboarding.conversation.answers.name,'甲用户');checks.push('failed finish stays on landing and preserves all entered information for retry');
 assert.equal(fixture.landings.size,1);assert.equal(fixture.landings.get(101).input.birthChartVersion,1);assert.ok(fixture.landings.get(101).input.contract.signedAt>0);
 const frozen=structuredClone(fixture.landings.get(101));
 await context.close();context=await browser.newContext({viewport:{width:430,height:932},reducedMotion:'reduce'});await context.addCookies([{name:'fixture',value:'101',url:fixture.url}]);
 page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));await page.goto(fixture.url,{waitUntil:'domcontentloaded'});await page.locator('[data-action="finish-conversation"]').waitFor();
 const restored=await read(101);assert.deepEqual(restored.onboarding.contract,frozen.input.contract);assert.equal(restored.onboarding.conversation.answers.name,'甲用户');assert.equal(restored.onboarding.conversation.answers.response,'我喜欢周末看展');for(const key of ['birthDate','birthTime','gender','birthPlace'])assert.equal(Object.hasOwn(restored.onboarding.conversation.answers,key),false);
 checks.push('submitted but incomplete signed receipt resumes in a fresh browser without rebuilding birth answers');
 const beforeSwitch=fixture.calls.length;await context.addCookies([{name:'fixture',value:'202',url:fixture.url}]);await page.locator('[data-action="finish-conversation"]').click();await page.locator('[data-action="login"]').waitFor();assert.equal(fixture.calls.length,beforeSwitch);
 await login(202);await page.locator('#private-message').waitFor();assert.equal((await read(202)).onboarding.contract,null);assert.equal(fixture.accepted.length,0);await logout();await login(101);await page.locator('[data-action="finish-conversation"]').waitFor();
 await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));Object.assign(s.onboarding.conversation.answers,{name:'未簽本地名',companionName:'未簽本地伙伴',response:'未簽本地介紹'});s.onboarding.contract={version:1,signedAt:Date.now(),userName:'未簽本地名',companionName:'未簽本地伙伴'};localStorage.setItem(key,JSON.stringify(s));},prefix+'101');await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-action="finish-conversation"]').waitFor();assert.deepEqual((await read(101)).onboarding.contract,frozen.input.contract);
 checks.push('A/B/A owner guard blocks stale handoff and server signed input replaces conflicting local names');
 fixture.controls.failHandoff=false;fixture.controls.failCompletion=true;
 await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/auth/onboarding/complete')&&r.status()===503),page.locator('[data-action="finish-conversation"]').click()]);
 await page.locator('#toast').filter({hasText:'資料仍保留'}).waitFor();assert.equal(fixture.onboarding.get(101),'required');assert.equal(await page.locator('#private-message').count(),0);assert.equal(fixture.accepted.length,1);
 fixture.controls.failCompletion=false;await page.locator('[data-action="finish-conversation"]').click();await page.locator('#private-message').waitFor({state:'visible'});
 assert.equal(fixture.onboarding.get(101),'completed');checks.push('completion write failure retains landing; retry saves state without sending the accepted handoff again');
 assert.equal(fixture.accepted.length,1);const prompt=fixture.accepted[0].prompt;for(const value of ['甲用户','甲伙伴','我喜欢周末看展'])assert.ok(prompt.includes(value));assert.ok(!prompt.includes('1995-03-10'));assert.ok(!prompt.includes('上海'));assert.equal(fixture.calls.at(-1).body.messages.length,1);assert.equal((await read(101)).onboarding.agentHandoff.provider,'knok-agent');assert.equal(await page.getByText('HIDDEN_HANDOFF_ACK',{exact:true}).count(),0);checks.push('landing finishes only after one full intake handoff; acknowledgement never appears in home chat');
 await send(101,'正常聊天第一句');const normal=fixture.calls.at(-1);assert.equal(normal.isHandoff,false);assert.deepEqual(normal.body.messages.at(-1),{role:'user',content:'正常聊天第一句'});assert.ok(normal.body.messages.every(m=>!m.content.includes('首次見面（landing）')));
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('#private-message').waitFor({state:'visible'});await send(101,'刷新后继续');assert.equal(fixture.accepted.length,1);checks.push('normal chat contract and UI are unchanged; refresh does not repeat accepted handoff');
 await logout();await login(202);await page.locator('#private-message').waitFor({state:'visible'});await send(202,'老用户聊天');assert.equal(fixture.accepted.length,1);
 await logout();await login(101);await page.locator('#private-message').waitFor({state:'visible'});await send(101,'重新登录继续');assert.equal(fixture.accepted.length,1);checks.push('A-B-A account switching never repeats completed landing or crosses account data');
 await context.close();context=await browser.newContext({viewport:{width:430,height:932},reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));await page.goto(fixture.url,{waitUntil:'domcontentloaded'});
 await login(101);await page.locator('#private-message').waitFor({state:'visible'});await send(101,'新浏览器继续');assert.equal(fixture.accepted.length,1);checks.push('completed account skips landing in a fresh browser with no local data');
 assert.deepEqual(errors,[]);report.passed=true;report.requests=fixture.calls.length;report.acceptedHandoffs=fixture.accepted.length;report.pageBase=fixture.manifest.pageBase;
}catch(error){report.error=error.message;process.exitCode=1;}finally{await mkdir(join(root,'dist/landing-evidence'),{recursive:true});if(page)await page.screenshot({path:join(root,'dist/landing-evidence/browser.png'),fullPage:true}).catch(()=>{});await context?.close();await browser?.close();await fixture?.close();report.cleanedUp=true;await writeFile(join(root,'dist/landing-evidence/browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
