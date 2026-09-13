import {test} from 'node:test';import assert from 'node:assert/strict';
import {SessionClient} from '../src/session-client.mjs';
const seed=()=>({project:'sanguo',sessionId:'x'.repeat(32),revision:9,resetCount:1,storyIds:['a','b','c'],answers:[...Array(7).fill(1),...Array(11).fill(null)],step:7,page:'quiz'});
const memory=()=>{const m=new Map();return {setItem:(k,v)=>m.set(k,v),getItem:k=>m.get(k),removeItem:k=>m.delete(k)};};
test('reload restores all 18 unsent choices and flushes them before report submission',async()=>{
 let server=seed(),offline=true,submitted=false;const storage=memory();
 const fetchFn=async(url,req)=>{if(offline)throw Error('lost connection');if(req.method==='PATCH'){const b=JSON.parse(req.body);server={...server,...b,revision:server.revision+1};}if(url.endsWith('/submit')){assert.ok(server.answers.every(a=>a!==null));submitted=true;server={...server,page:'result',report:{ok:true}};}return {ok:true,json:async()=>structuredClone(server)};};
 const first=new SessionClient({fetchFn,storage});first.state=structuredClone(server);const answers=Array(18).fill(1);answers[17]=3;await first.save({answers,step:17,page:'quiz'});assert.ok(first.error);
 offline=false;const reloaded=new SessionClient({fetchFn,storage});await reloaded.load('sanguo',server.sessionId);await reloaded.recoverDraft();assert.deepEqual(server.answers,answers);await reloaded.submit();assert.equal(submitted,true);
});
test('lost PATCH acknowledgement is reconciled without erasing choices or duplicating the write',async()=>{
 let server=seed(),writes=0;const fetchFn=async(url,req)=>{if(req.method==='PATCH'){writes++;server={...server,...JSON.parse(req.body),revision:server.revision+1};throw Error('ack lost');}return {ok:true,json:async()=>structuredClone(server)};};
 const c=new SessionClient({fetchFn,storage:memory()});c.state=structuredClone(server);const answers=Array(18).fill(1);await c.save({answers,step:17,page:'quiz'});await c.flush();assert.equal(writes,1);assert.equal(c.state.revision,10);assert.equal(c.error,null);
});
test('a newer round cannot be overwritten by an old tab draft',async()=>{
 let server=seed();const c=new SessionClient({storage:memory(),fetchFn:async(_url,req)=>req.method==='PATCH'?{ok:false,status:409,json:async()=>({message:'conflict'})}:{ok:true,json:async()=>structuredClone(server)}});c.state=structuredClone(server);server={...server,resetCount:2,revision:10,answers:Array(18).fill(null)};
 await c.save({answers:Array(18).fill(1),step:17,page:'quiz'});assert.ok(c.error);assert.ok(server.answers.every(a=>a===null));
});
test('a lost submit response resumes the pending generation rather than returning to the final question',async()=>{
 let server=seed(),calls=0;server.answers=Array(18).fill(1);server.step=17;const c=new SessionClient({storage:memory(),fetchFn:async(url,req)=>{if(url.endsWith('/submit')){calls++;server={...server,generation:{id:'pending'},generationActive:true};throw Error('ack lost');}return {ok:true,json:async()=>structuredClone(server)};}});c.state=structuredClone(server);const state=await c.submit();assert.equal(calls,1);assert.ok(state.generation);
});
