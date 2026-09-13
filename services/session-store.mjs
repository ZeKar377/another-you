import {randomBytes,randomUUID,randomInt} from 'node:crypto';
import {mkdir,readFile,open,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import {buildQuestionnaire} from '../shared/engine.mjs';
import {stories} from '../shared/stories.mjs';
import {validateReport} from '../shared/report.mjs';

export {SESSION_LLM_LIMIT} from './session-quota.mjs';
export const SESSION_ID=/^[A-Za-z0-9_-]{32}$/;
export function sessionError(code,statusCode){return Object.assign(new Error(code),{code,statusCode});}
export function checkAddress(project,id){if(project!=='sanguo'||!SESSION_ID.test(id))throw sessionError('SESSION_NOT_FOUND',404);}
export function drawStories(){const ids=stories.map(s=>s.id);for(let i=ids.length-1;i>0;i--){const j=randomInt(i+1);[ids[i],ids[j]]=[ids[j],ids[i]];}return ids.slice(0,3);}
export function emptyRound(){return {storyIds:drawStories(),answers:Array(18).fill(null),responses:[],step:0,page:'home',report:null,source:null,inference:null,generation:null};}
export function validateProgress(body){if(!body||!Array.isArray(body.answers)||body.answers.length!==18||body.answers.some(a=>a!==null&&(!Number.isInteger(a)||a<0||a>3))||!Number.isInteger(body.step)||body.step<0||body.step>17||!['home','quiz'].includes(body.page))throw sessionError('INVALID_PROGRESS',400);}

export function createSessionStore({dataDir,maxCached=1000,now=Date.now}){
 const cache=new Map(),locks=new Map();
 const key=(project,id)=>{checkAddress(project,id);return project+'/'+id;};
 const file=(project,id)=>path.join(dataDir,'projects',project,'sessions',id+'.json');
 function remember(k,state){cache.delete(k);cache.set(k,structuredClone(state));while(cache.size>maxCached)cache.delete(cache.keys().next().value);}
 async function exclusive(k,fn){const previous=locks.get(k)||Promise.resolve();const job=previous.catch(()=>{}).then(fn);locks.set(k,job);try{return await job;}finally{if(locks.get(k)===job)locks.delete(k);}}
 async function read(project,id){const k=key(project,id);if(cache.has(k)){const state=cache.get(k);remember(k,state);return structuredClone(state);}let state;try{state=JSON.parse(await readFile(file(project,id),'utf8'));}catch(e){if(e.code==='ENOENT')throw sessionError('SESSION_NOT_FOUND',404);throw sessionError('SESSION_STORAGE_ERROR',503);}
  try{if(state.schemaVersion!==1||state.project!==project||state.sessionId!==id||!Number.isInteger(state.revision)||state.revision<0)throw Error();validateProgress({...state,page:state.page==='result'?'quiz':state.page});buildQuestionnaire(state.storyIds);if(state.report)validateReport(state.report);}catch{throw sessionError('SESSION_STORAGE_ERROR',503);}
  if(state.llmCalls===undefined)return write({...state,llmCalls:0,quotaStartedAt:new Date(now()).toISOString(),revision:state.revision+1});
  if(!Number.isSafeInteger(state.llmCalls)||state.llmCalls<0)throw sessionError('SESSION_STORAGE_ERROR',503);
  remember(k,state);return structuredClone(state);
 }
 async function write(state){const target=file(state.project,state.sessionId),dir=path.dirname(target);await mkdir(dir,{recursive:true,mode:0o700});const tmp=target+'.'+randomUUID()+'.tmp';let handle;
  try{handle=await open(tmp,'wx',0o600);await handle.writeFile(JSON.stringify(state));await handle.sync();await handle.close();handle=null;await rename(tmp,target);const directory=await open(dir,'r');try{await directory.sync();}finally{await directory.close();}}catch{throw sessionError('SESSION_STORAGE_ERROR',503);}finally{if(handle)await handle.close();await unlink(tmp).catch(()=>{});}
  remember(key(state.project,state.sessionId),state);return structuredClone(state);
 }
 return {
  async create(project){if(project!=='sanguo')throw sessionError('PROJECT_NOT_FOUND',404);const id=randomBytes(24).toString('base64url');const timestamp=new Date(now()).toISOString();return exclusive(key(project,id),()=>write({schemaVersion:1,project,sessionId:id,revision:0,createdAt:timestamp,updatedAt:timestamp,resetCount:0,lastResetAt:null,llmCalls:0,quotaStartedAt:timestamp,...emptyRound()}));},
  get(project,id){return exclusive(key(project,id),()=>read(project,id));},
  update(project,id,revision,change){return exclusive(key(project,id),async()=>{const state=await read(project,id);if(!Number.isInteger(revision)||revision!==state.revision)throw sessionError('SESSION_CONFLICT',409);const updated=change(state);if(updated===null)return state;return write({...updated,project,sessionId:id,revision:state.revision+1,updatedAt:new Date().toISOString()});});}
 };
}
