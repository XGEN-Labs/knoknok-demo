import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {liveBrowserFixture} from '../test/fixtures/live-browser.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const fixture=await liveBrowserFixture(join(root,'dist/web-live')), browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[],checks=[];let page;
try{
 const context=await browser.newContext({viewport:{width:430,height:932},reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
 await page.goto(fixture.url,{waitUntil:'domcontentloaded'});
 async function login(id){await page.locator('[data-action="login"]').click();await page.locator('#auth-username').fill('test'+id);await page.locator('#auth-form button[type="submit"]').click();await page.locator('#auth-password').fill('fixture-only');if(id===101)await page.locator('#auth-confirmPassword').fill('fixture-only');await page.locator('#auth-form button[type="submit"]').click();}
 async function logout(){if(await page.locator('[data-action="close-conversation"]').isVisible())await page.locator('[data-action="close-conversation"]').click();await page.locator('[data-action="settings-menu"]').click();await page.locator('[data-action="auth-exit"]').click();}
 await login(202);await page.locator('#private-message').waitFor();checks.push('existing account uses real auth adapter and skips Landing');
 await page.waitForFunction(()=>!document.querySelector('#conversation-log').textContent.includes('正在讀取聊天記錄'));
 await page.locator('#private-message').fill('你好');await page.locator('#private-message').press('Enter');await page.locator('#conversation-log').getByText('真實協議回覆 202',{exact:true}).waitFor();checks.push('chat posts to same-origin real protocol');
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('#private-message').waitFor();await page.locator('#private-message').click();await page.locator('#conversation-log').getByText('真實協議回覆 202',{exact:true}).waitFor();checks.push('history restored from server after reload');
 await logout();await page.locator('[data-action="login"]').waitFor();await login(303);await page.locator('#private-message').waitFor();assert.ok(!(await page.locator('#conversation-log').textContent()).includes('202'));checks.push('logout and account switch do not leak prior history');
 await logout();await page.locator('[data-action="login"]').waitFor();await login(101);await page.locator('[data-screen="landing"]').waitFor();checks.push('new registration enters Landing');

 // Stage the already-tested questionnaire answers to exercise its real completion boundary.
 await page.evaluate(()=>{const key='knokknok-prototype-v1-web-live-v1-account-rooms', rows=JSON.parse(localStorage.getItem(key));const row=rows.find(r=>r[0]==='101'),s=JSON.parse(row[1]);Object.assign(s.users.a,{name:'甲用户',companionName:'甲伙伴'});s.private.a.companion.name='甲伙伴';Object.assign(s.onboarding,{basicsComplete:true,birthComplete:true,status:'ready',contractRequired:true,contract:{version:1,signedAt:Date.now(),userName:'甲用户',companionName:'甲伙伴'},conversation:{version:2,step:'complete',complete:false,messages:[],answers:{birthDate:'1995-03-10',birthTime:null,gender:'女生',birthPlace:'上海',response:'我喜欢周末看展',name:'甲用户',companionName:'甲伙伴'}}});delete s.onboarding.agentHandoff;row[1]=JSON.stringify(s);localStorage.setItem(key,JSON.stringify(rows));});
 await page.reload({waitUntil:'domcontentloaded'});if(await page.locator('.landing-video-skip').isVisible())await page.locator('.landing-video-skip').click();await page.locator('[data-action="finish-conversation"]').waitFor();
 fixture.controls.failHandoff=true;
 await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/web/chat')&&r.status()===503),page.locator('[data-action="finish-conversation"]').click()]);
 assert.equal(fixture.status.get(101),'required');assert.equal(await page.locator('#private-message').count(),0);
 fixture.controls.failHandoff=false;fixture.controls.failCompletion=true;
 await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/auth/onboarding/complete')&&r.status()===503),page.locator('[data-action="finish-conversation"]').click()]);
 assert.equal(fixture.status.get(101),'required');const before=fixture.calls.filter(c=>c.path==='/api/web/chat').length;
 fixture.controls.failCompletion=false;await page.locator('[data-action="finish-conversation"]').click();await page.locator('#private-message').waitFor();
 assert.equal(fixture.status.get(101),'completed');assert.equal(fixture.calls.filter(c=>c.path==='/api/web/chat').length,before);
 const handoff=fixture.calls.filter(c=>c.path==='/api/web/chat').at(-1).body.messages;assert.equal(handoff.length,1);for(const value of ['甲用户','甲伙伴','1995-03-10','上海','我喜欢周末看展'])assert.ok(handoff[0].content.includes(value));checks.push('Landing sends intake to native Agent before marking complete; failures preserve answers and accepted handoff is not resent');
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('#private-message').waitFor();assert.equal(fixture.calls.filter(c=>c.path==='/api/web/chat').length,before);checks.push('completed account skips Landing after reload');

 // Native panels share the same Cookie/owner boundary and never change identity in request bodies.
 await page.locator('.home-top [data-go="profile"]').click();await page.locator('[data-action="native-profile-edit"][data-key="preferredName"]').click();
 await page.locator('[data-form="native-profile"] input').fill('新的稱呼');await page.locator('[data-form="native-profile"] button[type="submit"]').click();await page.locator('#sheet').getByText('新的稱呼',{exact:true}).waitFor();assert.equal(fixture.profiles.get(101).fields.homeCity.value,'香港');
 await page.locator('[data-action="native-nickname-edit"]').click();await page.locator('[data-form="native-nickname"] input').fill('新的伙伴');await page.locator('[data-form="native-nickname"] button[type="submit"]').click();await page.locator('#sheet').getByText('新的伙伴',{exact:true}).waitFor();checks.push('native profile edits preserve unedited fields and nickname uses revision guard');
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('[data-action="tag-diary"], [data-action="live-memory"], [data-action^="native-memory"]').count(),0);
 await page.locator('[data-action="settings-menu"]').click();assert.equal(await page.locator('#sheet').getByText('伙伴的記憶',{exact:true}).count(),0);assert.ok(!fixture.calls.some(c=>c.path.startsWith('/api/web/memories/')));checks.push('raw Memory panel and home/settings entries removed; no Memory requests');
 await page.keyboard.press('Escape');await page.locator('[data-go="relations"]').click();await page.locator('[data-action="native-room"]').click();await page.locator('[data-form="native-group"] textarea').fill('共享房間訊息');await page.locator('[data-form="native-group"] button[type="submit"]').click();await page.locator('#sheet').getByText('共享房間訊息',{exact:true}).waitFor();assert.equal(fixture.groupEvents.get(101).length,1);checks.push('existing shared room loads and posts using native protocol');
 assert.ok(fixture.calls.filter(c=>c.path.startsWith('/api/web/')).every(c=>String(c.id)===c.owner));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,scope:'Chrome + local synthetic BFF, not production',checks},null,2));
}catch(error){console.error(JSON.stringify({checks,errors,diagnostics:await page.evaluate(()=>({phone:document.querySelector('#phone').dataset,video:[...document.querySelectorAll('video')].map(v=>({src:v.currentSrc,current:v.currentTime,duration:v.duration,ready:v.readyState,paused:v.paused,error:v.error?.code})),text:document.querySelector('#app').textContent}))}));throw error;}finally{await browser.close();await fixture.close();}
