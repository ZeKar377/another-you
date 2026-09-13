import {readFile} from 'node:fs/promises';
import {sessionPage,sendSessionPage} from './session-page.mjs';
import {checkAddress} from './session-store.mjs';
const messages={SESSION_BUSY:'报告正在生成，请稍候再重新探索。',SESSION_LLM_LIMIT:'本链接的 3 次测试机会已用完，已生成的报告仍可查看。',SESSION_NOT_FOUND:'链接不存在，请确认你打开的是完整链接。',PROJECT_NOT_FOUND:'这个项目暂未开放。',SESSION_CONFLICT:'此链接已在其他页面更新，正在恢复最新进度。',INVALID_PROGRESS:'答题信息不完整，请刷新后重试。',INCOMPLETE_ANSWERS:'请先完成全部18道题。',SESSION_STORAGE_ERROR:'暂时无法保存，请稍后重试。'};
export async function registerSessionRoutes(app,{sessions}){
 const template=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 const prefix='/api/v1/projects/:project/sessions';
 const run=fn=>async(req,reply)=>{reply.header('Cache-Control','no-store');try{return await fn(req,reply);}catch(e){if(e.statusCode&&messages[e.code])return reply.code(e.statusCode).send({error:e.code,message:messages[e.code]});req.log.error({code:'SESSION_OPERATION_FAILED'},'Session operation failed');return reply.code(503).send({error:'SESSION_STORAGE_ERROR',message:messages.SESSION_STORAGE_ERROR});}};
 app.post(prefix,async(_req,reply)=>reply.header('Cache-Control','no-store').code(403).send({error:'SESSION_CREATION_DISABLED',message:'暂不支持自行创建链接，请使用已领取的专属链接。'}));
 app.get(prefix+'/:sessionId',run(req=>sessions.get(req.params.project,req.params.sessionId)));
 app.patch(prefix+'/:sessionId',run(req=>sessions.save(req.params.project,req.params.sessionId,req.body)));
 app.post(prefix+'/:sessionId/reset',run(req=>sessions.reset(req.params.project,req.params.sessionId,req.body?.revision)));
 app.post(prefix+'/:sessionId/submit',run(req=>sessions.submit(req.params.project,req.params.sessionId,req.body?.revision)));
 app.get('/sanguo/:sessionId',run(async(req,reply)=>{checkAddress('sanguo',req.params.sessionId);const state=await sessions.get('sanguo',req.params.sessionId);return sendSessionPage(reply,req,sessionPage(template,state));}));
 app.get('/sanguo',async(_req,reply)=>reply.header('Cache-Control','no-cache').sendFile('index.html',{cacheControl:false}));
}
