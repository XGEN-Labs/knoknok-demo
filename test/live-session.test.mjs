import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveSession} from '../live-session.mjs';
const message=(eventId,seq,text='hello',extra={})=>({kind:'message',eventId,seq,at:'2026-10-28T00:00:00Z',messageId:'m-'+eventId,role:'assistant',content:text,status:'complete',...extra});
const page=(items,extra={})=>({user:{id:1},items,order:'asc',hasMore:false,resumeCursor:'resume',...extra});
test('history paginates, updates replayed lower seq and applies redaction without local cached bodies',async()=>{
 const responses=[page([message('b',8)],{hasMore:true,nextCursor:'second'}),page([message('a',2)]),page([{kind:'redaction',eventId:'r',seq:10,messageId:'m-b'},message('c',3)])],calls=[];
 const session=createLiveSession({fetchImpl:async(url,init)=>{calls.push({url,init});return Response.json(responses.shift());}});session.activate(1);
 await session.history();assert.deepEqual(session.getState().messages.map(m=>m.id),['a','b']);
 await session.history();assert.deepEqual(session.getState().messages.map(m=>m.id),['a','c','b']);assert.equal(session.getState().messages.at(-1).status,'redacted');assert.notEqual(session.getState().messages.at(-1).text,'hello');
 assert.match(calls[1].url,/cursor=second/);assert.match(calls[2].url,/cursor=resume/);assert.equal(calls[0].init.credentials,'same-origin');assert.equal(calls[0].init.headers['X-Knok-User-Id'],'1');assert.equal(calls[0].init.headers.Authorization,undefined);
});
test('scrubbed redaction forces a fresh authoritative read and never restores old text',async()=>{
 const responses=[page([message('a',1,'private')]),page([{kind:'redaction',eventId:'r',seq:2,messageId:null,requiresReload:true}]),page([message('a',1,null,{status:'scrubbed',messageId:null})])],calls=[];
 const session=createLiveSession({fetchImpl:async url=>{calls.push(url);return Response.json(responses.shift());}});session.activate(1);await session.history();await session.history();
 assert.equal(calls[2],'/api/web/chat/history?limit=100');assert.equal(session.getState().messages[0].status,'scrubbed');assert.ok(!JSON.stringify(session.getState()).includes('private'));
});
test('account changes discard in-flight history and cannot populate the next account',async()=>{
 let finish;const session=createLiveSession({fetchImpl:()=>new Promise(resolve=>{finish=resolve;})});session.activate(1);const pending=session.history();session.activate(2);finish(Response.json(page([message('a',1,'old-owner-secret')])));await pending;assert.equal(session.getState().owner,'2');assert.deepEqual(session.getState().messages,[]);
});
test('native chat uses existing API and reconciles committed history without duplicate local messages',async()=>{
 const calls=[];let committed=false;
 const session=createLiveSession({fetchImpl:async(url,init)=>{calls.push({url,init});if(init.method==='POST'){committed=true;return Response.json({text:'real answer',provider:'knok-agent',source:'model'});}return Response.json(page(committed?[message('u',1,'question',{role:'user'}),message('a',2,'real answer')]:[]));}});
 session.activate(1);await session.history();await session.send('question');assert.equal(session.getState().messages.length,2);assert.equal(session.getState().messages[1].text,'real answer');assert.deepEqual(JSON.parse(calls[1].init.body),{messages:[{role:'user',content:'question'}]});
});
test('unknown send is never automatically resubmitted or turned into a fake assistant answer',async()=>{
 let writes=0;const session=createLiveSession({fetchImpl:async(url,init)=>{if(init.method==='POST'){writes++;throw Error('lost response');}return Response.json(page([]));}});session.activate(1);await session.send('question');assert.equal(writes,1);assert.equal(session.getState().messages.length,1);assert.equal(session.getState().messages[0].status,'unknown');await session.history();assert.equal(writes,1);assert.deepEqual(session.getState().messages,[]);
});
test('invalid identity fails closed; missing backend is an error rather than empty history',async()=>{
 let lost=0;const session=createLiveSession({fetchImpl:async()=>Response.json({error:'SESSION_CHANGED',code:'SESSION_CHANGED'},{status:409}),onSessionLost:()=>lost++});session.activate(1);await session.history();assert.equal(lost,1);assert.equal(session.getState().historyReady,false);assert.ok(session.getState().error);
});

test('long native history cannot exceed the existing chat request size or per-message contract',async()=>{
 let sent;const session=createLiveSession({fetchImpl:async(url,init)=>{if(init.method==='POST'){sent=init.body;return Response.json({text:'answer',source:'model',provider:'knok-agent'});}return Response.json(page(Array.from({length:15},(_,i)=>message('e'+i,i+1,'字'.repeat(5000)))));}});session.activate(1);await session.history();await session.send('hello');assert.ok(Buffer.byteLength(sent)<16000);assert.ok(JSON.parse(sent).messages.every(m=>m.content.length<=4000));assert.equal(JSON.parse(sent).messages.at(-1).content,'hello');
});

test('a history subject mismatch clears the current view, invalidates pending requests and disables sends',async()=>{
 let reads=0,lost=0,posts=0;
 const session=createLiveSession({onSessionLost:()=>lost++,fetchImpl:async(url,init)=>{if(init.method==='POST')posts++;return Response.json(++reads===1?page([message('own',1)]):page([message('wrong',2,'other account')],{user:{id:2}}));}});
 session.activate(1);await session.history();assert.equal(session.getState().messages.length,1);await session.history();
 assert.equal(lost,1);assert.equal(session.getState().owner,null);assert.deepEqual(session.getState().messages,[]);assert.equal(await session.send('do not send'),false);assert.equal(posts,0);
});
