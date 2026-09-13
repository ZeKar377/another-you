// The server owns committed state. A per-tab journal protects unsent answers across reloads.
export class SessionClient {
 constructor({fetchFn=(url,options)=>fetch(url,options),onStatus=(_status)=>{},storage=globalThis.sessionStorage}={}){this.fetchFn=fetchFn;this.onStatus=onStatus;this.storage=storage;this.state=null;this.tail=Promise.resolve();this.pending=0;this.error=null;this.draft=null;}
 async request(url,method='GET',body,timeout=15000){let response;try{response=await this.fetchFn(url,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeout),cache:'no-store'});}catch{throw Object.assign(Error('连接暂时中断，答案已在本页暂存，请重新同步。'),{status:0});}let data;try{data=await response.json();}catch{throw Object.assign(Error('响应未完整收到，答案已暂存，请重新同步。'),{status:0});}if(!response.ok)throw Object.assign(Error(data.message||data.error||'暂时无法保存，请稍后重试。'),{status:response.status});return data;}
 path(){if(!this.state)throw Error('链接尚未加载');return `/api/v1/projects/${this.state.project}/sessions/${this.state.sessionId}`;}
 draftKey(){return 'another-you:draft:'+this.state.sessionId;}
 journal(){try{if(this.draft)this.storage?.setItem(this.draftKey(),JSON.stringify(this.draft));else this.storage?.removeItem(this.draftKey());}catch{}}
 status(){this.onStatus({pending:this.pending,error:this.error});}
 async load(project,id){this.state=await this.request(`/api/v1/projects/${project}/sessions/${id}`);this.error=null;this.status();return this.state;}
 async refresh(){return this.load(this.state.project,this.state.sessionId);}
 sameRound(a,b){return a.resetCount===b.resetCount&&JSON.stringify(a.storyIds)===JSON.stringify(b.storyIds);}
 remember(progress){const base=this.draft?.base||structuredClone(this.state);this.draft={base,progress:structuredClone(progress)};this.journal();}
 async persistDraft(draft){
  let target=this.state;
  for(let attempt=0;attempt<2;attempt++){
   if(!this.sameRound(draft.base,target)||target.report||target.generation)throw Object.assign(Error('这个链接的轮次已更新，草稿已保留，请检查最新进度。'),{status:409});
   const base=draft.base.answers||[],current=target.answers||[];
   const answers=draft.progress.answers.map((value,i)=>{if(value===base[i])return current[i]??null;if(current[i]!==base[i]&&current[i]!==value)throw Object.assign(Error('另一页面修改了相同题目，草稿已保留，请检查后重试。'),{status:409});return value;});
   const progress={...draft.progress,answers};
   if(JSON.stringify(progress.answers)===JSON.stringify(target.answers)&&progress.step===target.step&&progress.page===target.page){this.state=target;return target;}
   try{const saved=await this.request(this.path(),'PATCH',{...progress,revision:target.revision});this.state=saved;return saved;}
   catch(e){if(attempt||![0,409,502,503,504].includes(e.status))throw e;target=await this.request(this.path());}
  }
 }
 save(progress){this.remember(progress);this.pending++;this.status();
  this.tail=this.tail.then(async()=>{if(this.error||!this.draft)return;const snapshot=this.draft;try{await this.persistDraft(snapshot);if(this.draft===snapshot)this.draft=null;else this.draft={...this.draft,base:structuredClone(this.state)};this.journal();}catch(e){this.error=e;}}).finally(()=>{this.pending--;this.status();});return this.tail;
 }
 async retrySave(){await this.tail;if(!this.draft){this.error=null;return this.refresh();}this.pending++;this.status();try{const draft=this.draft;await this.persistDraft(draft);if(this.draft===draft)this.draft=null;this.error=null;this.journal();return this.state;}catch(e){this.error=e;throw e;}finally{this.pending--;this.status();}}
 async recoverDraft(){try{this.draft=JSON.parse(this.storage?.getItem(this.draftKey())||'null');}catch{this.draft=null;}if(!this.draft)return this.state;if(!this.sameRound(this.draft.base,this.state)||this.state.report||this.state.generation){this.draft=null;this.journal();return this.state;}return this.retrySave();}
 async flush(){await this.tail;if(this.error||this.draft)await this.retrySave();}
 async submit(){await this.flush();try{this.state=await this.request(this.path()+'/submit','POST',{revision:this.state.revision},60000);}catch(e){if(![0,409,502,503,504].includes(e.status))throw e;const latest=await this.refresh();if(latest.report||latest.generation)return latest;this.state=await this.request(this.path()+'/submit','POST',{revision:latest.revision},60000);}return this.state;}
 async reset(){await this.tail;await this.refresh();this.state=await this.request(this.path()+'/reset','POST',{revision:this.state.revision});this.draft=null;this.journal();this.error=null;this.status();return this.state;}
}
