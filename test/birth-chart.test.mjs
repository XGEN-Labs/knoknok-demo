import test from 'node:test';
import assert from 'node:assert/strict';
import { submitBirthChart, birthChartForm } from '../compat/web-naming/birth-chart.mjs';
const chart={id:'a'.repeat(64),version:1,labels:{dayMaster:'甲木',zodiac:'金牛座'}};
test('waits for saved native chart and bound Agent, returns the same chart reference',async()=>{
 let saves=0,polls=0;
 const api={saveBirthChart:async()=>{saves++;},bootstrap:async()=>({user:{id:1},agent:{status:++polls===1?'setup_required':'bound'},birthChart:{status:'ready',chart}})};
 assert.deepEqual(await submitBirthChart(api,1,{}, {wait:async()=>{}}),chart);assert.equal(saves,1);assert.equal(polls,2);
});
test('rejects account changes and incomplete native results',async()=>{
 const api={saveBirthChart:async()=>{},bootstrap:async()=>({user:{id:2},agent:{status:'bound'},birthChart:{status:'ready',chart}})};
 await assert.rejects(submitBirthChart(api,1,{}),{code:'SESSION_CHANGED'});
});
test('requires explicit exact time and consent instead of reusing a time-period midpoint',()=>{
 const html=birthChartForm({onboarding:{conversation:{answers:{birthDate:'2000-05-15',birthTime:'00:00'}}}},String);
 assert.match(html,/type="time" required/);assert.doesNotMatch(html,/value="00:00"/);assert.match(html,/chart-consent/);
});
