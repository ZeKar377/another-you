import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {createSessionService} from '../services/session-service.mjs';
import {createSessionStore} from '../services/session-store.mjs';
import {algorithmReport} from '../shared/report.mjs';
import {SessionClient} from '../src/session-client.mjs';
import Fastify from 'fastify';import fastifyStatic from '@fastify/static';
import {registerSessionRoutes} from '../services/session-routes.mjs';
async function context(t,generate){const dataDir=await mkdtemp(path.join(os.tmpdir(),'sanguo-session-'));t.after(()=>rm(dataDir,{recursive:true,force:true}));let calls=0;const reports={generate:async(a,q,options)=>{await options?.beforeCall?.();calls++;return generate?generate(a,q):{report:algorithmReport(a,q),source:'llm',cached:false};}};return {dataDir,reports,service:createSessionService({dataDir,reports,maxCached:1}),calls:()=>calls};}
const progress=(s,a=Array(18).fill(0),step=17)=>({revision:s.revision,answers:a,step,page:'quiz'});
const file=(dir,id)=>path.join(dir,'projects/sanguo/sessions',id+'.json');

test('each random link has isolated answers on disk and survives LRU eviction and process recreation',async t=>{
 const {service,dataDir,reports}=await context(t);const a=await service.create('sanguo');const b=await service.create('sanguo');assert.match(a.sessionId,/^[A-Za-z0-9_-]{32}$/);assert.notEqual(a.sessionId,b.sessionId);
 const answers=Array(18).fill(null);answers[0]=2;
 const saved=await service.save('sanguo',a.sessionId,progress(a,answers,1));assert.equal(saved.responses[0].choice,2);assert.ok(saved.responses[0].selected);
 assert.ok((await service.get('sanguo',b.sessionId)).answers.every(x=>x===null));
 const fresh=createSessionService({dataDir,reports});assert.deepEqual(await fresh.get('sanguo',a.sessionId),saved);
 const disk=JSON.parse(await readFile(file(dataDir,a.sessionId),'utf8'));assert.equal(disk.answers[0],2);assert.equal(disk.step,1);
 await assert.rejects(service.get('unknown',a.sessionId),e=>e.statusCode===404);await assert.rejects(service.get('sanguo','../secret'),e=>e.statusCode===404);
});

test('LLM report and chosen text persist together; retry clears the same file and records the reset',async t=>{
 const {service,dataDir,reports,calls}=await context(t);let s=await service.create('sanguo');s=await service.save('sanguo',s.sessionId,progress(s));s=await service.submit('sanguo',s.sessionId,s.revision);
 assert.equal(s.page,'result');assert.equal(s.source,'llm');assert.equal(s.responses.length,18);assert.ok(s.inference.generatedAt);assert.equal(calls(),1);
 assert.deepEqual(await service.submit('sanguo',s.sessionId,s.revision),s);assert.equal(calls(),1);
 const restarted=createSessionService({dataDir,reports});assert.deepEqual(await restarted.get('sanguo',s.sessionId),s);
 const reset=await restarted.reset('sanguo',s.sessionId,s.revision);assert.equal(reset.sessionId,s.sessionId);assert.equal(reset.createdAt,s.createdAt);assert.equal(reset.resetCount,1);assert.ok(reset.lastResetAt);assert.equal(reset.page,'home');assert.equal(reset.step,0);assert.equal(reset.report,null);assert.equal(reset.inference,null);assert.equal(reset.source,null);assert.deepEqual(reset.responses,[]);assert.ok(reset.answers.every(x=>x===null));
 const disk=JSON.parse(await readFile(file(dataDir,s.sessionId),'utf8'));assert.equal(disk.report,null);assert.equal(disk.resetCount,1);
 const newProcess=createSessionService({dataDir,reports});assert.deepEqual(await newProcess.get('sanguo',s.sessionId),reset);
 const next=await newProcess.reset('sanguo',s.sessionId,reset.revision);assert.equal(next.resetCount,2);
});

test('outdated tabs cannot overwrite newer answers or bring back pre-reset content',async t=>{
 const {service}=await context(t);const s=await service.create('sanguo');const results=await Promise.allSettled([service.save('sanguo',s.sessionId,progress(s,Array(18).fill(0))),service.save('sanguo',s.sessionId,progress(s,Array(18).fill(1)))]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.statusCode,409);
 const latest=await service.get('sanguo',s.sessionId);const reset=await service.reset('sanguo',s.sessionId,latest.revision);
 await assert.rejects(service.save('sanguo',s.sessionId,progress(latest)),e=>e.statusCode===409);assert.deepEqual(await service.get('sanguo',s.sessionId),reset);
});

test('reset cannot overlap a live generation and only the committed success consumes a slot',async t=>{
 let release,started;const ready=new Promise(r=>started=r),waiting=new Promise(r=>release=r);
 const {service,dataDir}=await context(t,async(a,q)=>{started();await waiting;return {report:algorithmReport(a,q),source:'llm'};});
 let s=await service.create('sanguo');s=await service.save('sanguo',s.sessionId,progress(s));const job=service.submit('sanguo',s.sessionId,s.revision);await ready;
 const pending=await service.get('sanguo',s.sessionId);assert.equal(pending.llmCalls,0);assert.equal(pending.llmAttempts,1);
 await assert.rejects(service.reset('sanguo',s.sessionId,pending.revision),e=>e.code==='SESSION_BUSY');release();s=await job;
 assert.equal(s.llmCalls,1);assert.equal(s.inference.quotaCharged,true);assert.equal(JSON.parse(await readFile(file(dataDir,s.sessionId),'utf8')).llmCalls,1);
});

test('generation interrupted by restart can resume and provider failures persist algorithm fallback',async t=>{
 const {service,dataDir}=await context(t);let s=await service.create('sanguo');s=await service.save('sanguo',s.sessionId,progress(s));
 const store=createSessionStore({dataDir});s=await store.update('sanguo',s.sessionId,s.revision,state=>({...state,generation:{id:'interrupted',startedAt:new Date().toISOString()}}));
 const restarted=createSessionService({dataDir,reports:{generate:async()=>{throw Error('provider failure');}}});const pending=await restarted.get('sanguo',s.sessionId);assert.equal(pending.generationActive,false);
 const result=await restarted.submit('sanguo',s.sessionId,pending.revision);assert.equal(result.page,'result');assert.equal(result.source,'algorithm');assert.equal(result.inference.reason,'generation_failed');assert.equal(result.generation,null);
});

test('corrupt disk sessions fail closed instead of silently replacing paid-link history',async t=>{
 const {service,dataDir,reports}=await context(t);const s=await service.create('sanguo');await writeFile(file(dataDir,s.sessionId),'{broken');
 const restarted=createSessionService({dataDir,reports});await assert.rejects(restarted.get('sanguo',s.sessionId),e=>e.statusCode===503);assert.equal(await readFile(file(dataDir,s.sessionId),'utf8'),'{broken');
});

test('deep links serve the app; APIs validate progress, persist reports, and never cache private state',async t=>{
 const {service}=await context(t);const app=Fastify();t.after(()=>app.close());await app.register(fastifyStatic,{root:path.resolve('dist')});await registerSessionRoutes(app,{sessions:service});
 const created=await app.inject({method:'POST',url:'/api/v1/projects/sanguo/sessions',payload:{}});assert.equal(created.statusCode,403);assert.equal(created.json().error,'SESSION_CREATION_DISABLED');let s=await service.create('sanguo');s.url='/sanguo/'+s.sessionId;const url=`/api/v1/projects/sanguo/sessions/${s.sessionId}`;
 const page=await app.inject(s.url);assert.equal(page.statusCode,200);assert.match(page.body,/id="root"/);assert.equal(page.headers['cache-control'],'no-store');
 assert.ok(!/<script[^>]*src=/.test(page.body));assert.match(page.body,/<script type="module">/);
 assert.equal((await app.inject(url)).headers['cache-control'],'no-store');
 assert.equal((await app.inject({method:'PATCH',url,payload:progress(s,[4])})).statusCode,400);
 assert.equal((await app.inject({method:'POST',url:url+'/submit',payload:{revision:s.revision}})).statusCode,400);
 s=(await app.inject({method:'PATCH',url,payload:progress(s)})).json();s=(await app.inject({method:'POST',url:url+'/submit',payload:{revision:s.revision}})).json();assert.equal(s.page,'result');
 s=(await app.inject({method:'POST',url:url+'/reset',payload:{revision:s.revision}})).json();assert.equal(s.page,'home');assert.equal(s.report,null);
});

test('browser coalesces queued answers and retains the latest draft after network failures',async()=>{
 const storage=new Map();let state={project:'sanguo',sessionId:'a'.repeat(32),revision:0,resetCount:0,storyIds:['a','b','c'],answers:Array(18).fill(null),step:0,page:'quiz'},calls=0,offline=false;
 const client=new SessionClient({storage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)},fetchFn:async(url,req)=>{if(offline)throw Error('offline');if(req.method==='GET')return {ok:true,json:async()=>structuredClone(state)};calls++;const body=JSON.parse(req.body);state={...state,...body,revision:state.revision+1};return {ok:true,json:async()=>structuredClone(state)};}});client.state=structuredClone(state);
 const a=Array(18).fill(null);a[0]=0;client.save({answers:[...a],step:0,page:'quiz'});a[1]=1;client.save({answers:[...a],step:1,page:'quiz'});await client.flush();assert.equal(calls,1);assert.equal(state.answers[1],1);assert.equal(storage.size,0);
 offline=true;a[2]=2;await client.save({answers:[...a],step:2,page:'quiz'});await assert.rejects(client.flush());assert.equal(storage.size,1);assert.equal(client.draft.progress.answers[2],2);
 offline=false;await client.retrySave();assert.equal(state.answers[2],2);assert.equal(client.error,null);assert.equal(storage.size,0);
});

test('private HTML carries the latest matching session and escapes embedded JSON safely',async t=>{
 const {sessionPage}=await import('../services/session-page.mjs');
 const payload={text:'</script><script>alert(1)</script>&\u2028'};
 const html=sessionPage('<body><div id="root"></div></body>',payload);
 assert.equal((html.match(/<script/g)||[]).length,1);
 const raw=html.match(/type="application\/json">(.*?)<\/script>/s)[1];assert.deepEqual(JSON.parse(raw),payload);
 const {service}=await context(t);const app=Fastify();t.after(()=>app.close());await registerSessionRoutes(app,{sessions:service});
 let s=await service.create('sanguo');const answers=Array(18).fill(null);answers[2]=3;s=await service.save('sanguo',s.sessionId,progress(s,answers,2));
 const r=await app.inject('/sanguo/'+s.sessionId);const boot=JSON.parse(r.body.match(/id="session-bootstrap" type="application\/json">(.*?)<\/script>/s)[1]);assert.equal(boot.sessionId,s.sessionId);assert.equal(boot.answers[2],3);assert.equal(boot.step,2);assert.equal(r.headers['cache-control'],'no-store');
 const gzip=await app.inject({url:'/sanguo/'+s.sessionId,headers:{'accept-encoding':'gzip'}});assert.equal(gzip.headers['content-encoding'],'gzip');
 const noGzip=await app.inject({url:'/sanguo/'+s.sessionId,headers:{'accept-encoding':'gzip;q=0'}});assert.equal(noGzip.headers['content-encoding'],undefined);
});

test('three durable per-link calls survive resets, eviction and restart; exhaustion preserves report',async t=>{
 const ctx=await context(t);let service=ctx.service,s=await service.create('sanguo');
 for(let n=1;n<=3;n++){
  s=await service.save('sanguo',s.sessionId,{...progress(s),llmCalls:0});
  s=await service.submit('sanguo',s.sessionId,s.revision);
  assert.equal(s.llmQuota.used,n);assert.equal(s.llmQuota.remaining,3-n);assert.equal(s.llmQuota.period,'lifetime');
  assert.equal(JSON.parse(await readFile(file(ctx.dataDir,s.sessionId),'utf8')).llmCalls,n);
  assert.deepEqual(await service.submit('sanguo',s.sessionId,s.revision),s);
  await service.create('sanguo');service=createSessionService({dataDir:ctx.dataDir,reports:ctx.reports,maxCached:1});
  assert.equal((await service.get('sanguo',s.sessionId)).llmCalls,n);
  if(n<3){s=await service.reset('sanguo',s.sessionId,s.revision);assert.equal(s.llmCalls,n);}
 }
 await assert.rejects(service.reset('sanguo',s.sessionId,s.revision),e=>e.code==='SESSION_LLM_LIMIT');
 assert.deepEqual(await service.get('sanguo',s.sessionId),s);assert.equal(ctx.calls(),3);
 const other=await service.create('sanguo');assert.equal(other.llmQuota.remaining,3);
});

test('attempts are durable before dispatch but provider failures do not consume quota',async t=>{
 let ctx,id;
 ctx=await context(t,async()=>{const disk=JSON.parse(await readFile(file(ctx.dataDir,id),'utf8'));assert.equal(disk.llmCalls,0);assert.equal(disk.llmAttempts,1);throw Error('HTTP failure');});
 let s=await ctx.service.create('sanguo');id=s.sessionId;s=await ctx.service.save('sanguo',id,progress(s));s=await ctx.service.submit('sanguo',id,s.revision);
 assert.equal(s.source,'algorithm');assert.equal(s.llmQuota.remaining,3);assert.equal(s.inference.quotaCharged,false);
 s=await ctx.service.reset('sanguo',id,s.revision);assert.equal(s.llmCalls,0);
});

test('pre-network algorithm fallback does not consume quota',async t=>{
 const {dataDir}=await context(t);const service=createSessionService({dataDir,reports:{generate:async(a,q)=>({report:algorithmReport(a,q),source:'algorithm',reason:'busy'})}});
 let s=await service.create('sanguo');s=await service.save('sanguo',s.sessionId,progress(s));s=await service.submit('sanguo',s.sessionId,s.revision);assert.equal(s.llmCalls,0);assert.equal(s.llmQuota.remaining,3);
});

test('last-slot concurrent submits and orphan recovery never dispatch a fourth call',async t=>{
 const ctx=await context(t);let s=await ctx.service.create('sanguo');s=await ctx.service.save('sanguo',s.sessionId,progress(s));
 const store=createSessionStore({dataDir:ctx.dataDir});s=await store.update('sanguo',s.sessionId,s.revision,v=>({...v,llmCalls:2}));
 let service=createSessionService({dataDir:ctx.dataDir,reports:ctx.reports});
 const results=await Promise.allSettled([service.submit('sanguo',s.sessionId,s.revision),service.submit('sanguo',s.sessionId,s.revision)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(ctx.calls(),1);
 s=await service.get('sanguo',s.sessionId);
 const freshStore=createSessionStore({dataDir:ctx.dataDir});s=await freshStore.update('sanguo',s.sessionId,s.revision,v=>({...v,report:null,source:null,page:'quiz',generation:{id:'orphan'}}));
 service=createSessionService({dataDir:ctx.dataDir,reports:ctx.reports});s=await service.submit('sanguo',s.sessionId,s.revision);
 assert.equal(s.source,'algorithm');assert.equal(s.inference.reason,'session_llm_limit');assert.equal(s.generation,null);assert.equal(ctx.calls(),1);
 const anotherStore=createSessionStore({dataDir:ctx.dataDir});s=await anotherStore.update('sanguo',s.sessionId,s.revision,v=>({...v,report:null,page:'quiz'}));
 service=createSessionService({dataDir:ctx.dataDir,reports:ctx.reports});await assert.rejects(service.submit('sanguo',s.sessionId,s.revision),e=>e.code==='SESSION_LLM_LIMIT');assert.equal(ctx.calls(),1);
});

test('legacy sessions gain persistent quota without losing history; corrupt counters fail closed',async t=>{
 const ctx=await context(t);let s=await ctx.service.create('sanguo');s=await ctx.service.save('sanguo',s.sessionId,progress(s));delete s.llmCalls;delete s.quotaStartedAt;delete s.llmQuota;delete s.llmDaily;
 await writeFile(file(ctx.dataDir,s.sessionId),JSON.stringify(s));let service=createSessionService({dataDir:ctx.dataDir,reports:ctx.reports});const migrated=await service.get('sanguo',s.sessionId);
 assert.equal(migrated.llmCalls,0);assert.deepEqual(migrated.answers,s.answers);assert.ok(migrated.quotaStartedAt);assert.equal(JSON.parse(await readFile(file(ctx.dataDir,s.sessionId),'utf8')).llmCalls,0);
 await writeFile(file(ctx.dataDir,s.sessionId),JSON.stringify({...migrated,llmCalls:-1}));service=createSessionService({dataDir:ctx.dataDir,reports:ctx.reports});await assert.rejects(service.get('sanguo',s.sessionId),e=>e.statusCode===503);
});

test('lifetime quota never replenishes across days and preserves legacy totals above the new limit',async t=>{
 const ctx=await context(t);let clock=Date.parse('2026-09-12T23:59:59+08:00');const now=()=>clock;
 let service=createSessionService({dataDir:ctx.dataDir,reports:ctx.reports,now});let s=await service.create('sanguo');
 for(let i=0;i<3;i++){s=await service.save('sanguo',s.sessionId,progress(s));s=await service.submit('sanguo',s.sessionId,s.revision);if(i<2)s=await service.reset('sanguo',s.sessionId,s.revision);}
 const before=s;clock+=86400000*7;s=await service.get('sanguo',s.sessionId);assert.equal(s.llmQuota.remaining,0);assert.deepEqual(s,before);
 await assert.rejects(service.reset('sanguo',s.sessionId,s.revision),e=>e.code==='SESSION_LLM_LIMIT');
 const store=createSessionStore({dataDir:ctx.dataDir});s=await store.update('sanguo',s.sessionId,s.revision,v=>({...v,llmCalls:7,llmDaily:{day:'2026-09-01',count:5}}));
 service=createSessionService({dataDir:ctx.dataDir,reports:ctx.reports,now});s=await service.get('sanguo',s.sessionId);assert.equal(s.llmCalls,7);assert.equal(s.llmQuota.used,7);assert.equal(s.llmQuota.remaining,0);assert.deepEqual(s.report,before.report);
 assert.deepEqual(await service.submit('sanguo',s.sessionId,s.revision),s);await assert.rejects(service.reset('sanguo',s.sessionId,s.revision),e=>e.code==='SESSION_LLM_LIMIT');assert.equal(ctx.calls(),3);
});

test('a report returning after midnight survives concurrent reads and keeps the cumulative count',async t=>{
 let clock=Date.parse('2026-09-12T23:59:59+08:00'),started,release;
 const ready=new Promise(r=>started=r),waiting=new Promise(r=>release=r);
 const ctx=await context(t,async(a,q)=>{started();await waiting;return {source:'llm',report:algorithmReport(a,q)};});
 const service=createSessionService({dataDir:ctx.dataDir,reports:ctx.reports,now:()=>clock});let s=await service.create('sanguo');s=await service.save('sanguo',s.sessionId,progress(s));
 const pending=service.submit('sanguo',s.sessionId,s.revision);await ready;clock+=1000;const read=await service.get('sanguo',s.sessionId);assert.equal(read.llmQuota.remaining,3);release();s=await pending;assert.equal(s.source,'llm');assert.equal(s.llmCalls,1);assert.equal(s.llmQuota.used,1);assert.equal(s.llmQuota.remaining,2);
});

test('mobile IP changes retain the session quota; fourth attempt gets the total-limit message',async t=>{
 const ctx=await context(t);const app=Fastify();t.after(()=>app.close());await registerSessionRoutes(app,{sessions:ctx.service});let s=await ctx.service.create('sanguo');const base='/api/v1/projects/sanguo/sessions/'+s.sessionId;
 for(let i=0;i<3;i++){
  s=(await app.inject({method:'PATCH',url:base,remoteAddress:'198.51.100.'+(i+1),payload:progress(s)})).json();
  const generated=await app.inject({method:'POST',url:base+'/submit',remoteAddress:'203.0.113.'+(i+1),payload:{revision:s.revision}});assert.equal(generated.statusCode,200);s=generated.json();assert.equal(s.llmQuota.used,i+1);
  if(i<2)s=(await app.inject({method:'POST',url:base+'/reset',payload:{revision:s.revision}})).json();
 }
 const blocked=await app.inject({method:'POST',url:base+'/reset',remoteAddress:'192.0.2.123',payload:{revision:s.revision}});assert.equal(blocked.statusCode,403);assert.match(blocked.json().message,/3 次测试机会已用完/);assert.equal(ctx.calls(),3);
});

test('failed, invalid and timed-out reports leave the final slot available; success charges once',async t=>{
 const ctx=await context(t);let attempts=0;
 const reports={generate:async(a,q,opts)=>{await opts.beforeCall();attempts++;if(attempts===1)throw new DOMException('aborted','TimeoutError');if(attempts===2)return {source:'llm',report:{broken:true}};if(attempts===3)return {source:'algorithm',reason:'HTTP_500',report:algorithmReport(a,q)};return {source:'llm',report:algorithmReport(a,q)};}};
 let s=await ctx.service.create('sanguo');const store=createSessionStore({dataDir:ctx.dataDir});s=await store.update('sanguo',s.sessionId,s.revision,v=>({...v,llmCalls:2}));
 const service=createSessionService({dataDir:ctx.dataDir,reports});
 for(let i=1;i<=4;i++){s=await service.save('sanguo',s.sessionId,progress(s));s=await service.submit('sanguo',s.sessionId,s.revision);assert.equal(s.llmCalls,i<4?2:3);assert.equal(s.inference.quotaCharged,i===4);if(i<4)s=await service.reset('sanguo',s.sessionId,s.revision);}
 assert.equal(attempts,4);assert.equal(s.llmQuota.remaining,0);assert.equal(s.llmAttempts,6);
 assert.deepEqual(await service.submit('sanguo',s.sessionId,s.revision),s);assert.equal(attempts,4);
});

test('saved report is readable in HTML before JavaScript; scripts are bundled and hash-authorized',async t=>{
 const {pageCsp}=await import('../services/page-security.mjs');const {createHash}=await import('node:crypto');
 const {service}=await context(t);let s=await service.create('sanguo');s=await service.save('sanguo',s.sessionId,progress(s));s=await service.submit('sanguo',s.sessionId,s.revision);
 const app=Fastify();t.after(()=>app.close());await registerSessionRoutes(app,{sessions:service});const r=await app.inject('/sanguo/'+s.sessionId);
 const beforeModule=r.body.split('<script type="module">')[0];assert.ok(beforeModule.includes(s.report.summary));assert.ok(beforeModule.includes('你的优势'));assert.ok(beforeModule.includes('重新加载页面'));
 assert.ok(!/<script[^>]*src=/.test(r.body));assert.ok(!/<link[^>]*href="\/assets\//.test(r.body));
 const template=await readFile('dist/index.html','utf8');const csp=pageCsp(template);assert.ok(!csp.split('style-src')[0].includes('unsafe-inline'));
 const executable=[...r.body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(m=>!m[1].includes('application/json'));
 for(const [,attrs,body] of executable)assert.ok(csp.includes(createHash('sha256').update(body).digest('base64')));
});
