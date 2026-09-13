import {buildQuestionnaire,score} from '../shared/engine.mjs';
import {createReportService} from '../services/report-service.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const storyIds=['empty-city','three-visits','guandu'];
const questions=buildQuestionnaire(storyIds);
const profiles=[['planning',[0,4,3,2,1,5]],['action',[1,3,0,5,4,2]],['empathy',[2,4,1,0,5,3]],['independence',[3,0,5,1,4,2]],['teamwork',[4,1,2,0,5,3]],['exploration',[5,3,1,0,4,2]]];
const label=process.argv[2]||'baseline';
const service=createReportService({dataDir:`/tmp/sanguo-diversity-${label}`,apiKey:process.env.GLM_API_KEY,endpoint:process.env.GLM_ENDPOINT,model:process.env.GLM_MODEL,enabled:true});
const results=[];
for(let i=0;i<profiles.length;i+=2){await Promise.all(profiles.slice(i,i+2).map(async([name,axes])=>{
 const answers=questions.map(q=>q.options.map((o,index)=>({index,rank:axes.indexOf(o.axis)})).sort((a,b)=>a.rank-b.rank)[0].index);
 const started=Date.now();const result=await service.generate(answers,questions);
 const row={name,answers,storyIds,algorithm:score(answers,questions).primary.id,source:result.source,reason:result.reason,cached:result.cached,seconds:Math.round((Date.now()-started)/100)/10,top:result.report.top,report:result.report};results.push(row);console.log(JSON.stringify({...row,report:undefined,answers:undefined,storyIds:undefined}));
}));}
await mkdir('/tmp/sanguo-diversity-results',{recursive:true});await writeFile(`/tmp/sanguo-diversity-results/${label}.json`,JSON.stringify(results,null,2));
