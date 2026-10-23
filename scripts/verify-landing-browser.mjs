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
 Object.assign(s.onboarding,{basicsComplete:true,birthComplete:true,status:'ready',initializedAt:s.now,contractRequired:true,contract:{version:1,signedAt:s.now,userName,companionName:agentName},conversation:{version:2,step:'complete',complete,messages:[],answers:{birthDate:'1995-03-10',birthTime:null,gender:'女生',birthPlace:'上海',response:'我喜欢周末看展',name:userName,companionName:agentName}}});return JSON.stringify(s);}
let fixture,browser,context,page;const checks=[],errors=[];const report={passed:false,scope:'Built Web in real Chrome; local BFF/model fixture, no production or Memory verification',checks,pageErrors:errors};
try{
 fixture=await landingBrowserFixture(join(root,'dist/web'));browser=await chromium.launch({channel:'chrome',headless:true});context=await browser.newContext({viewport:{width:430,height:932},reducedMotion:'reduce'});
 await context.addInitScript(({prefix,a,b})=>{if(sessionStorage.getItem('seeded'))return;localStorage.setItem(prefix+'101',a);localStorage.setItem(prefix+'202',b);sessionStorage.setItem('seeded','1');},{prefix,a:seed('甲用户','甲伙伴',false),b:seed('乙用户','乙伙伴',true)});
 page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));await page.goto(fixture.url,{waitUntil:'domcontentloaded'});
 async function login(id){await page.locator('[data-action="login"]').click();await page.locator('#auth-account').fill(`test${id}`);await page.locator('#auth-password').fill('fixture-only');await page.locator('#auth-form button[type="submit"]').click();}
 async function logout(){await page.locator('.home-top [data-go="profile"]').click();await page.locator('[data-action="account-menu"]').click();await page.locator('[data-action="logout"]').click();await page.locator('[data-action="login"]').waitFor();}
 async function send(id,text){await page.locator('#private-message').click();await page.locator('#private-message').fill(text);await page.locator('#private-message').press('Enter');await page.locator('#conversation-log').getByText(`正常回覆 ${id}`,{exact:true}).last().waitFor();}
 const read=async id=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),prefix+id);
 await login(101);await page.locator('[data-action="onboarding-coda"]').click();await page.locator('[data-action="onboarding-coda"]').click();
 await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/web/chat')&&r.status()===503),page.locator('[data-action="finish-conversation"]').click()]);
 await page.locator('#toast').filter({hasText:'資料仍保留'}).waitFor();assert.equal(await page.locator('#private-message').count(),0);assert.equal((await read(101)).onboarding.agentHandoff,undefined);assert.equal((await read(101)).onboarding.conversation.answers.name,'甲用户');checks.push('failed finish stays on landing and preserves all entered information for retry');
 fixture.controls.failHandoff=false;await page.locator('[data-action="finish-conversation"]').click();await page.locator('#private-message').waitFor({state:'visible'});
 assert.equal(fixture.accepted.length,1);const prompt=fixture.accepted[0].prompt;for(const value of ['甲用户','甲伙伴','1995-03-10','上海','我喜欢周末看展'])assert.ok(prompt.includes(value));assert.equal(fixture.calls.at(-1).body.messages.length,1);assert.equal((await read(101)).onboarding.agentHandoff.provider,'knok-agent');assert.equal(await page.getByText('HIDDEN_HANDOFF_ACK',{exact:true}).count(),0);checks.push('landing finishes only after one full intake handoff; acknowledgement never appears in home chat');
 await send(101,'正常聊天第一句');const normal=fixture.calls.at(-1);assert.equal(normal.isHandoff,false);assert.deepEqual(normal.body.messages.at(-1),{role:'user',content:'正常聊天第一句'});assert.ok(normal.body.messages.every(m=>!m.content.includes('首次見面（landing）')));
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('#private-message').waitFor({state:'visible'});await send(101,'刷新后继续');assert.equal(fixture.accepted.length,1);checks.push('normal chat contract and UI are unchanged; refresh does not repeat accepted handoff');
 await logout();await login(202);await page.locator('#private-message').waitFor({state:'visible'});await send(202,'旧用户补交');assert.equal(fixture.accepted.length,2);assert.equal(fixture.accepted[1].owner,202);assert.ok(fixture.accepted[1].prompt.includes('乙用户'));assert.ok(!fixture.accepted[1].prompt.includes('甲用户'));
 await logout();await login(101);await page.locator('#private-message').waitFor({state:'visible'});await send(101,'重新登录继续');assert.equal(fixture.accepted.length,2);checks.push('already-completed users hand off once before their first chat; A-B-A relogin remains isolated');
 assert.deepEqual(errors,[]);report.passed=true;report.requests=fixture.calls.length;report.acceptedHandoffs=fixture.accepted.length;report.pageBase=fixture.manifest.pageBase;
}catch(error){report.error=error.message;process.exitCode=1;}finally{await mkdir(join(root,'dist/landing-evidence'),{recursive:true});if(page)await page.screenshot({path:join(root,'dist/landing-evidence/browser.png'),fullPage:true}).catch(()=>{});await context?.close();await browser?.close();await fixture?.close();report.cleanedUp=true;await writeFile(join(root,'dist/landing-evidence/browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
