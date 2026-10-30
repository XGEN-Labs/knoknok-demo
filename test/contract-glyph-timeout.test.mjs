import test from 'node:test';
import assert from 'node:assert/strict';
import {loadContractSignatureGlyphs,createContractSignature} from '../contract-story.mjs';
test('stalled signature assets use the existing full-name fallback instead of blocking contract signing',async()=>{
 let calls=0;const glyphs=await Promise.race([loadContractSignatureGlyphs('爸爸',{timeoutMs:20,fetcher:async(url,{signal}={})=>{calls++;return new Promise((resolve,reject)=>signal?.addEventListener('abort',()=>reject(signal.reason),{once:true}));}}),new Promise(resolve=>setTimeout(()=>resolve(null),80))]);
 assert.notEqual(glyphs,null);assert.equal(calls,1);const signature=createContractSignature('爸爸',glyphs);assert.deepEqual(signature.fallback,['爸','爸']);assert.equal(signature.characters,2);
});
