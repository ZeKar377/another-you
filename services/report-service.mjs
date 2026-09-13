import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {questions,score} from '../shared/engine.mjs';
import {buildReportInput} from './report-input.mjs';
import {validateReport,algorithmReport,REPORT_VERSION} from '../shared/report.mjs';
export function createReportService({dataDir,apiKey='',endpoint='https://api.z.ai/api/paas/v4/chat/completions',model='glm-5.3',enabled=false,cacheReports=true,dailyLimit=0,timeoutMs=45000,fetchFn=fetch,promptPath=new URL('../prompts/sanguo-persona.md',import.meta.url),logger={warn(){}}}){
 let active=0,queue=Promise.resolve();const pending=new Map();
 async function reserve(){if(dailyLimit===0)return;const task=queue.then(async()=>{if(!Number.isInteger(dailyLimit)||dailyLimit<1||dailyLimit>100)throw Error('BUDGET_UNAVAILABLE');await mkdir(dataDir,{recursive:true});const file=`${dataDir}/llm-budget.json`;const day=new Date().toISOString().slice(0,10);let state;try{state=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('BUDGET_UNAVAILABLE');state={day,count:0};}if(state.day!==day)state={day,count:0};if(!Number.isInteger(state.count)||state.count<0)throw Error('BUDGET_UNAVAILABLE');if(state.count>=dailyLimit)throw Error('DAILY_LIMIT');state.count++;await writeFile(file+'.tmp',JSON.stringify(state),{mode:0o600});await rename(file+'.tmp',file);});queue=task.catch(()=>{});return task;}
 async function run(answers,questionSet=questions,{beforeCall,scope}={}){
 const questions=questionSet;
 score(answers,questions); // Validate input only. Its result does not guide the LLM.
 const fallback=reason=>({report:algorithmReport(answers,questions),source:'algorithm',reason});
 if(!enabled||!apiKey)return fallback('not_configured');
 let key;
 try{
 const url=new URL(endpoint);if(url.protocol!=='https:'||!['api.z.ai','open.bigmodel.cn'].includes(url.hostname)||url.pathname.includes('/coding/'))throw Error('ENDPOINT_NOT_ALLOWED');
 const prompt=await readFile(promptPath,'utf8');const input=buildReportInput(answers,questions);key=createHash('sha256').update(JSON.stringify({input,prompt,model,questions,version:REPORT_VERSION})).digest('hex');
 const cached=`${dataDir}/reports/${key}.json`;if(cacheReports)try{return {report:validateReport(JSON.parse(await readFile(cached,'utf8'))),source:'llm',cached:true};}catch{}
 if(scope)key+=':'+scope;
 if(pending.has(key))return await pending.get(key);
 if(active>=2)return fallback('busy');
 const job=(async()=>{active++;try{
 await reserve();
 if(beforeCall)await beforeCall();
 const resp=await fetchFn(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},signal:AbortSignal.timeout(timeoutMs),body:JSON.stringify({model,messages:[{role:'system',content:prompt},{role:'user',content:JSON.stringify(input)}],response_format:{type:'json_object'},thinking:{type:'enabled'},reasoning_effort:'low',max_tokens:6000,temperature:0.6})});
 if(!resp.ok)throw Error(`HTTP_${resp.status}`);
 const json=await resp.json();const c=json?.choices?.[0];if(c?.finish_reason!=='stop'||typeof c.message?.content!=='string'||c.message.content.length>20000)throw Error('INVALID_COMPLETION');
 const report=validateReport(JSON.parse(c.message.content));
 if(cacheReports){await mkdir(`${dataDir}/reports`,{recursive:true});await writeFile(cached,JSON.stringify(report),{mode:0o600});}return {report,source:'llm',cached:false};
 }finally{active--;}})();pending.set(key,job);try{return await job;}finally{pending.delete(key);}
 }catch(e){if(e.statusCode)throw e;const reason=/^(HTTP_\d+|DAILY_LIMIT|BUDGET_UNAVAILABLE|INVALID_REPORT|INVALID_COMPLETION|ENDPOINT_NOT_ALLOWED)$/.test(e.message)?e.message:(e.name==='TimeoutError'||e.name==='AbortError')?'timeout':'generation_failed';logger.warn({reason},'Report fell back to algorithm');return fallback(reason);}
 }
 return {generate:run};
}
