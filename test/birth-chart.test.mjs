import test from 'node:test';
import assert from 'node:assert/strict';
import { submitBirthChart, birthChartForm } from '../compat/web-naming/birth-chart.mjs';
const chart={id:'a'.repeat(64),version:1,labels:{dayMaster:'甲木',zodiac:'金牛座'}};
const form={'birth-date':'2000-05-15','birth-time':'23:30','birth-sex':'男','birth-timezone':'Asia/Shanghai',calendar:'solar','leap-month':'否','timezone-confirmed':'已确认','chart-consent':'同意'};
test('returns the saved native chart before Agent creation, without requiring a binding',async()=>{
 let saves=0,polls=0;
 const api={saveBirthChart:async(value,owner)=>{saves++;assert.deepEqual(value,form);assert.equal(owner,1);},bootstrap:async()=>{polls++;return {user:{id:1},agent:{status:'setup_required'},birthChart:{status:'ready',chart}};}};
 assert.deepEqual(await submitBirthChart(api,1,form, {wait:async()=>{throw Error('must not wait for binding');}}),chart);assert.equal(saves,1);assert.equal(polls,1);
});
test('rejects account changes and incomplete native results',async()=>{
 const api={saveBirthChart:async()=>{},bootstrap:async()=>({user:{id:2},agent:{status:'bound'},birthChart:{status:'ready',chart}})};
 await assert.rejects(submitBirthChart(api,1,form),{code:'SESSION_CHANGED'});
});
test('an invalid chart version or missing labels cannot authorize final Landing',async()=>{
 for(const invalid of [{...chart,version:0},{...chart,version:1.5},{...chart,labels:{dayMaster:'甲木'}}]){
  const api={saveBirthChart:async()=>{},bootstrap:async()=>({user:{id:1},agent:{status:'bound'},birthChart:{status:'ready',chart:invalid}})};
  await assert.rejects(submitBirthChart(api,1,form),/不完整/);
 }
});
test('unknown or approximate birth time and missing explicit consent never reach the save route',async()=>{
 for(const patch of [{'birth-time':''},{'birth-time':'子時'},{'birth-time':'約23:30'},{'chart-consent':''},{'timezone-confirmed':''}]){
  let saves=0;const api={saveBirthChart:async()=>{saves++;}};
  await assert.rejects(submitBirthChart(api,1,{...form,...patch}));assert.equal(saves,0);
 }
});
test('a stopped account operation never writes or reads a chart',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 await assert.rejects(submitBirthChart({saveBirthChart:async()=>{calls++;}},1,form,{signal:controller.signal}),{name:'AbortError'});assert.equal(calls,0);
});
test('requires explicit exact time and consent instead of reusing a time-period midpoint',()=>{
 const html=birthChartForm({onboarding:{conversation:{answers:{birthDate:'2000-05-15',birthTime:'00:00'}}}},String);
 assert.match(html,/type="time" required/);assert.doesNotMatch(html,/value="00:00"/);assert.match(html,/chart-consent/);
});
