import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm,writeFile} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {algorithmReport,validateReport,toResult} from '../shared/report.mjs';
import {createReportService} from '../services/report-service.mjs';
import {buildReportInput} from '../services/report-input.mjs';
import {buildQuestionnaire,archetypes} from '../shared/engine.mjs';
const answers=Array(18).fill(0),valid=algorithmReport(answers);
async function context(t,fetchFn,extra={}){const dir=await mkdtemp(path.join(os.tmpdir(),'sanguo-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));return createReportService({dataDir:dir,enabled:true,apiKey:'test-only',fetchFn,...extra});}
const response=report=>({ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(report)}}]})});
test('strict JSON report validation protects rendering and provenance',()=>{assert.equal(toResult(valid,'llm').source,'llm');for(const change of [{top:[...valid.top.slice(0,2),valid.top[0]]},{traits:[1000,0,0,0,0,0]},{summary:'<script>bad</script>'},{evidence:[]},{top:valid.top.map(x=>({...x,percent:70}))}])assert.throws(()=>validateReport({...valid,...change}));assert.throws(()=>toResult(valid,'unknown'));});
test('LLM success uses model judgment, caches it and sends actual story answers without algorithm scores',async t=>{let calls=0;let input;const report={...valid,title:'风中有自己的方向'};const service=await context(t,async(url,req)=>{calls++;const body=JSON.parse(req.body);assert.equal(body.thinking.type,"enabled");assert.equal(body.reasoning_effort,"low");input=JSON.parse(body.messages[1].content);return response(report);});const result=await service.generate(answers);assert.equal(result.source,'llm');assert.equal(result.report.title,report.title);assert.ok(input.answers[0].story);assert.equal(input.answers[0].selected,'先派小队探路，拿到线索再决定');assert.equal(input.traits,undefined);assert.equal((await service.generate(answers)).cached,true);assert.equal(calls,1);});
test('API errors, truncated JSON and invalid fields fall back without leaking provider content',async t=>{for(const fetchFn of [async()=>({ok:false,status:429}),async()=>({ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:'{'}}]})}),async()=>response({...valid,top:[]}),async()=>({ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'not json'}}]})}),async()=>{throw new DOMException('aborted','TimeoutError');}]){const s=await context(t,fetchFn);const r=await s.generate(answers);assert.equal(r.source,'algorithm');assert.deepEqual(r.report,valid);}});
test('disabled provider avoids live calls; invalid user input is rejected before calling',async t=>{let calls=0;const s=await context(t,async()=>{calls++;return response(valid);},{enabled:false});assert.equal((await s.generate(answers)).source,'algorithm');await assert.rejects(s.generate([1]));assert.equal(calls,0);});
test('daily quota persists across instances and concurrent duplicate calls are coalesced',async t=>{let calls=0;const dir=await mkdtemp(path.join(os.tmpdir(),'sanguo-budget-'));t.after(()=>rm(dir,{recursive:true,force:true}));const opts={dataDir:dir,apiKey:'test',enabled:true,dailyLimit:1,fetchFn:async()=>{calls++;await new Promise(r=>setTimeout(r,20));return response(valid);}};const s=createReportService(opts);const rs=await Promise.all([s.generate(answers),s.generate(answers)]);assert.ok(rs.every(r=>r.source==='llm'));assert.equal(calls,1);const after=createReportService(opts);assert.equal((await after.generate(Array(18).fill(1))).reason,'DAILY_LIMIT');assert.equal(calls,1);});

test('unlimited generation ignores a previously exhausted daily budget',async t=>{let calls=0;const dir=await mkdtemp(path.join(os.tmpdir(),'sanguo-unlimited-'));t.after(()=>rm(dir,{recursive:true,force:true}));await writeFile(path.join(dir,'llm-budget.json'),JSON.stringify({day:new Date().toISOString().slice(0,10),count:100}));const service=createReportService({dataDir:dir,apiKey:'test',enabled:true,fetchFn:async()=>{calls++;return response(valid);}});for(const choice of [0,1,2])assert.equal((await service.generate(Array(18).fill(choice))).source,'llm');assert.equal(calls,3);});

test('random questionnaire reaches LLM and fallback, and separates cache entries',async t=>{const {buildQuestionnaire}=await import('../shared/engine.mjs');let calls=0;const s=await context(t,async(_url,req)=>{calls++;const input=JSON.parse(JSON.parse(req.body).messages[1].content);assert.equal(input.answers.filter(q=>q.story).length,3);return response(valid);});const a=buildQuestionnaire(['empty-city','guandu','huarong']),b=buildQuestionnaire(['plums','changban','jieting']);await s.generate(answers,a);await s.generate(answers,b);assert.equal(calls,2);const fallback=await context(t,async()=>{throw Error('unused')},{enabled:false});assert.deepEqual((await fallback.generate(answers,b)).report,algorithmReport(answers,b));});

test('all candidates carry distinguishing behavior evidence without a fixed first candidate',()=>{
 const qs=buildQuestionnaire(['empty-city','three-visits','guandu']);const orders=new Set();
 for(let n=0;n<12;n++){
  const a=qs.map((_,i)=>(n+Math.floor(n/(i+1))+i)%4);const input=buildReportInput(a,qs);
  assert.deepEqual(input,buildReportInput(a,qs));
  assert.deepEqual(input.candidates.map(c=>c.id).sort(),archetypes.map(c=>c.id).sort());
  assert.ok(input.candidates.every(c=>c.signals.length===3&&c.distinction.length>10));
  assert.ok(input.candidates.every(c=>!('vector' in c)&&!('score' in c)));
  assert.deepEqual(input.answers.map(x=>x.selected),qs.map((q,i)=>q.options[a[i]].text));
  orders.add(input.candidates[0].id);
 }
 assert.ok(orders.size>=3);
});

test('opposing answer sets keep independent cached model identities through rendering',async t=>{
 const qs=buildQuestionnaire(['empty-city','three-visits','guandu']);let calls=0;
 const service=await context(t,async(_url,req)=>{
  calls++;const input=JSON.parse(JSON.parse(req.body).messages[1].content);
  const id=input.answers[0].selected===qs[0].options[0].text?'caocao':'liubei';
  return response({...valid,top:[{id,percent:50},{id:'simayi',percent:30},{id:'zhouyu',percent:20}]});
 });
 for(const [choice,id] of [[0,'caocao'],[1,'liubei'],[0,'caocao'],[1,'liubei']]){
  const r=await service.generate(Array(18).fill(choice),qs);
  assert.equal(toResult(r.report,r.source).primary.id,id);
 }
 assert.equal(calls,2);
});

test('session-owned report storage can disable the shared answer cache',async t=>{
 let calls=0;const service=await context(t,async()=>{calls++;return response(valid);},{cacheReports:false});
 await service.generate(answers);await service.generate(answers);assert.equal(calls,2);
});

test('session reservations run before fetch and remain independent for identical concurrent answers',async t=>{
 const reserved=new Set();let calls=0;
 const service=await context(t,async()=>{assert.ok(reserved.size>calls);calls++;await new Promise(r=>setTimeout(r,10));return response(valid);},{cacheReports:false});
 const result=await Promise.all(['session-a','session-b'].map(scope=>service.generate(answers,undefined,{scope,beforeCall:async()=>{reserved.add(scope);}})));
 assert.equal(calls,2);assert.ok(result.every(x=>x.source==='llm'));
 const error=Object.assign(Error('SESSION_STORAGE_ERROR'),{statusCode:503});
 await assert.rejects(service.generate(answers,undefined,{scope:'failed-write',beforeCall:async()=>{throw error;}}),e=>e===error);assert.equal(calls,2);
});
