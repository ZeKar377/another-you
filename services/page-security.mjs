import {createHash} from 'node:crypto';
export function pageCsp(html){
 const hashes=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(([,attrs])=>!attrs.includes('application/json')&&!/\bsrc=/.test(attrs)).map(([,_,body])=>"'sha256-"+createHash('sha256').update(body).digest('base64')+"'");
 return `default-src 'self'; script-src 'self' ${hashes.join(' ')}; style-src 'self' 'unsafe-inline' data:; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'`;
}
