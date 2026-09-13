import {quotaFor} from './session-quota.mjs';
import {randomUUID} from 'node:crypto';
import {createSessionStore,emptyRound,validateProgress,sessionError} from './session-store.mjs';
import {buildQuestionnaire,score} from '../shared/engine.mjs';
import {algorithmReport,validateReport} from '../shared/report.mjs';

export function createSessionService({dataDir,reports,model='glm-5.3',maxCached,now=Date.now}){
 const store=createSessionStore({dataDir,maxCached,now}),jobs=new Map();
 const decorate=state=>({...state,llmQuota:quotaFor(state),generationActive:!!state.generation&&jobs.has(state.generation.id)});
 const get=async(project,id)=>decorate(await store.get(project,id));
 return {
  async create(project){return decorate(await store.create(project));},get,
  async save(project,id,body){validateProgress(body);return decorate(await store.update(project,id,body.revision,state=>{
   if(state.generation||state.report)throw sessionError('SESSION_CONFLICT',409);
   const qs=buildQuestionnaire(state.storyIds);
   return {...state,answers:[...body.answers],step:body.step,page:body.page,responses:qs.flatMap((q,i)=>body.answers[i]===null?[]:[{question:i+1,title:q.title,scene:q.scene,story:q.story||null,choice:body.answers[i],selected:q.options[body.answers[i]].text}])};
  }));},
  async reset(project,id,revision){return decorate(await store.update(project,id,revision,state=>{if(state.generation&&jobs.has(state.generation.id))throw sessionError('SESSION_BUSY',409);if(quotaFor(state).remaining===0)throw sessionError('SESSION_LLM_LIMIT',403);return {...state,...emptyRound(),resetCount:state.resetCount+1,lastResetAt:new Date().toISOString()};}));},
  async submit(project,id,revision){
   const previous=await store.get(project,id);
   if(previous.revision!==revision)throw sessionError('SESSION_CONFLICT',409);
   if(previous.report)return decorate(previous);
   if(previous.generation&&jobs.has(previous.generation.id))return jobs.get(previous.generation.id);
   if(quotaFor(previous).remaining===0&&!previous.generation)throw sessionError('SESSION_LLM_LIMIT',403);
   const generationId=randomUUID();
   const job=(async()=>{
    let state=await store.update(project,id,revision,current=>{
     const qs=buildQuestionnaire(current.storyIds);try{score(current.answers,qs);}catch{throw sessionError('INCOMPLETE_ANSWERS',400);}
     return {...current,page:'quiz',generation:{id:generationId,startedAt:new Date().toISOString()}};
    });
    const qs=buildQuestionnaire(state.storyIds);let result;
    // Persist attempts separately; only a saved valid LLM report consumes quota.
    const beforeCall=async()=>{state=await store.update(project,id,state.revision,current=>{
     if(current.generation?.id!==generationId)throw sessionError('SESSION_CONFLICT',409);
     const quota=quotaFor(current);
     if(quota.remaining===0)throw sessionError('SESSION_LLM_LIMIT',403);
     return {...current,llmAttempts:(current.llmAttempts??current.llmCalls)+1,generation:{...current.generation,attemptNumber:(current.llmAttempts??current.llmCalls)+1}};
    });};
    try{
     // A restart after the last reservation must recover a report without a fourth call.
     result=quotaFor(state).remaining===0?{report:algorithmReport(state.answers,qs),source:'algorithm',reason:'session_llm_limit'}:await reports.generate(state.answers,qs,{beforeCall,scope:generationId});
     result.report=validateReport(result.report);if(!['llm','algorithm'].includes(result.source))throw Error();
    }catch(e){if(e.statusCode)throw e;result={report:algorithmReport(state.answers,qs),source:'algorithm',reason:'generation_failed'};}
    // Revision and generation identity prevent pre-reset work from reviving old answers/reports.
    return decorate(await store.update(project,id,state.revision,current=>{
     if(current.generation?.id!==generationId)throw sessionError('SESSION_CONFLICT',409);
     return {...current,llmCalls:current.llmCalls+(result.source==='llm'?1:0),report:result.report,source:result.source,page:'result',generation:null,inference:{quotaCharged:result.source==='llm',source:result.source,model:result.source==='llm'?model:null,cached:result.cached===true,reason:result.source==='algorithm'?result.reason||'generation_failed':null,generatedAt:new Date().toISOString()}};
    }));
   })();
   jobs.set(generationId,job);try{return await job;}finally{jobs.delete(generationId);}
  }
 };
}
