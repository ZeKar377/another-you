import {gzipSync} from 'node:zlib';
import {sessionPreview} from './session-preview.mjs';
export function sessionPage(template,state){
 if(state.storyIds)template=template.replace(/<!--app-preview-start-->[\s\S]*?<!--app-preview-end-->/,()=>sessionPreview(state));
 const json=JSON.stringify(state).replace(/[<>&\u2028\u2029]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
 return template.replace('<body>',`<body><script id="session-bootstrap" type="application/json">${json}</script>`);
}
export function sendSessionPage(reply,request,html){
 reply.header('Cache-Control','no-store').header('Vary','Accept-Encoding').type('text/html; charset=utf-8');
 const acceptsGzip=(request.headers['accept-encoding']||'').split(',').some(part=>{const [encoding,...options]=part.trim().split(';');const q=options.find(x=>x.trim().startsWith('q='));return encoding==='gzip'&&Number(q?q.trim().slice(2):1)>0;});
 if(acceptsGzip)return reply.header('Content-Encoding','gzip').send(gzipSync(html));
 return reply.send(html);
}
