import {archetypes,questions,score} from './engine.mjs';
export const REPORT_VERSION='sanguo-report-3';
const strings={title:[2,24],quote:[2,40],summary:[20,400],strength:[10,240],spark:[10,240],relation:[10,240],action:[10,180]};
export function validateReport(r){
 const fail=()=>{throw new Error('INVALID_REPORT')};
 if(!r||r.schemaVersion!==REPORT_VERSION)fail();
 for(const [k,[min,max]] of Object.entries(strings))if(typeof r[k]!=='string'||r[k].trim().length<min||r[k].length>max||/[<>]/.test(r[k]))fail();
 if(!Array.isArray(r.top)||r.top.length!==3||new Set(r.top.map(x=>x?.id)).size!==3)fail();
 if(r.top.some((x,i)=>!archetypes.some(a=>a.id===x.id)||!Number.isInteger(x.percent)||x.percent<1||x.percent>100||(i>0&&x.percent>r.top[i-1].percent))||r.top.reduce((s,x)=>s+x.percent,0)!==100)fail();
 if(!Array.isArray(r.traits)||r.traits.length!==6||r.traits.some(x=>!Number.isInteger(x)||x<0||x>100))fail();
 if(!Array.isArray(r.evidence)||r.evidence.length!==3||new Set(r.evidence.map(x=>x?.question)).size!==3||r.evidence.some(x=>!Number.isInteger(x?.question)||x.question<1||x.question>questions.length||typeof x.insight!=='string'||x.insight.length<4||x.insight.length>180||/[<>]/.test(x.insight)))fail();
 // Copy only whitelisted fields; untrusted extra properties never reach the report renderer.
 return {schemaVersion:REPORT_VERSION,top:r.top.map(({id,percent})=>({id,percent})),traits:[...r.traits],...Object.fromEntries(Object.keys(strings).map(k=>[k,r[k].trim()])),evidence:r.evidence.map(({question,insight})=>({question,insight}))};
}
export function algorithmReport(answers,questionSet=questions){const questions=questionSet;const r=score(answers,questions);return validateReport({schemaVersion:REPORT_VERSION,top:r.top.map(({id,percent})=>({id,percent})),traits:r.traits,title:r.primary.title,quote:r.primary.short,summary:`你的选择更接近${r.top.map(x=>x.name).join('、')}的不同侧面。${r.primary.strength}这些偏好会随着情境而变化，你不必用一个人物定义自己。`,strength:r.primary.strength,spark:r.primary.spark,relation:r.primary.relation,action:'今天选一件让你有成就感的小事，花十分钟把它做好，再把这份小小的开心分享给喜欢的人。',evidence:[0,5,12].map(i=>({question:i+1,insight:`你选择了“${questions[i].options[answers[i]].text}”。这项选择参与了本次原型匹配。`}))});}
export function toResult(report,source='algorithm'){
 const r=validateReport(report);if(!['llm','algorithm'].includes(source))throw new Error('INVALID_SOURCE');
 const top=r.top.map(x=>({...archetypes.find(a=>a.id===x.id),percent:x.percent}));return {...r,source,top,primary:{...top[0],title:r.title,short:r.quote,strength:r.strength,spark:r.spark,relation:r.relation},raw:r};
}
