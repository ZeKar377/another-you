import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../dist/',import.meta.url);
let html=await readFile(new URL('index.html',root),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*src="(\/assets\/[^\"]+\.js)"[^>]*><\/script>/g)];
if(scripts.length!==1)throw Error('Expected a single entry bundle');
const js=(await readFile(new URL('.'+scripts[0][1],root),'utf8')).replace(/<\/script/gi,'<\\/script');
html=html.replace(scripts[0][0],'');
for(const match of [...html.matchAll(/<link\b[^>]*href="(\/assets\/[^\"]+\.css)"[^>]*>/g)]){const css=await readFile(new URL('.'+match[1],root),'utf8');html=html.replace(match[0],()=>'<style>'+css.replace(/<\/style/gi,'<\\/style')+'</style>');}
const watchdog="setTimeout(()=>{const e=document.getElementById('boot-status');if(e)e.textContent='加载较慢，已保存的报告可先阅读。若按钮未出现，请点击重新加载。'},10000);";
html=html.replace('</body>',()=>`<script>${watchdog}</script><script type="module">${js}</script></body>`);
await writeFile(new URL('index.html',root),html);
