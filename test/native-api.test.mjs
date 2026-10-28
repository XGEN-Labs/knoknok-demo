import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeApi,projectGroupEvents,readGroupHistory} from '../native-api.mjs';
const message=(id,seq,text='private')=>({id:'event-'+id,seq,type:'message.posted',message:{id,text,origin:'human',status:'complete'}});
test('group projection applies later redactions and scrubbed records before returning bodies',()=>{
 const rows=projectGroupEvents([message('a',1),{id:'redaction',seq:2,type:'message.redacted',messageId:'a'}]);assert.equal(rows[0].status,'redacted');assert.ok(!JSON.stringify(rows).includes('private'));
 const unknown=projectGroupEvents([message('b',1),{id:'redaction',seq:2,type:'message.redacted',scrubbed:true}]);assert.ok(!JSON.stringify(unknown).includes('private'));
});
test('group history drains all pages and never returns a partial successful history',async()=>{
 const pages=[{events:[message('a',1)],cursor:'one'},{events:[{id:'r',seq:2,type:'message.redacted',messageId:'a'}],cursor:'two'},{events:[],cursor:'two'}];
 const result=await readGroupHistory({groupEvents:async()=>pages.shift()},'room');assert.equal(result[0].status,'redacted');assert.equal(pages.length,0);
 let count=0;await assert.rejects(readGroupHistory({groupEvents:async()=>{if(count++)throw Error('failure');return {events:[message('a',1)],cursor:'one'};}},'room'),/failure/);
});
test('closed or switched account discards group results',async()=>{
 const result=await readGroupHistory({groupEvents:async()=>({events:[message('a',1)],cursor:'one'})},'room',()=>false);assert.equal(result,null);
});
test('native adapter fixes paths and leaves identity selection to session/server',async()=>{
 const calls=[],api=createNativeApi({request:async(...args)=>{calls.push(args);return {};}});
 await api.memoryList({});await api.updateProfile({homeCity:{value:'上海'}});await api.groupPost('room/id',{clientMsgId:'fixed',text:'hello'});
 assert.deepEqual(calls,[['/api/web/memories/list',{method:'POST',body:{}}],['/api/web/profile',{method:'PATCH',body:{homeCity:{value:'上海'}}}],['/api/web/groups/room%2Fid/post',{method:'POST',body:{clientMsgId:'fixed',text:'hello'}}]]);
});
