import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {once} from 'node:events';
import os from 'node:os';
import path from 'node:path';
test('actual server accepts more than the old IP limit without rate-limit headers',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'sanguo-no-ip-'));
 const child=spawn(process.execPath,['server.mjs'],{cwd:path.resolve('.'),env:{...process.env,DATA_DIR:dir,PORT:'0',HOST:'127.0.0.1',LLM_ENABLED:'false'},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){child.kill();await once(child,'exit');}await rm(dir,{recursive:true,force:true});});
 const url=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Server start timed out')),10000);child.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited'));});child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/Server listening at (http:\/\/127\.0\.0\.1:\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});});
 for(let i=0;i<130;i++){const r=await fetch(url+'/api/health');assert.equal(r.status,200);assert.equal(r.headers.get('x-ratelimit-limit'),null);await r.text();}
});
