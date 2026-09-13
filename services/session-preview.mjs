import {toResult} from '../shared/report.mjs';
import {buildQuestionnaire} from '../shared/engine.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function sessionPreview(state){
 const status='<p id="boot-status" class="quiet centered">正在加载交互功能，你可以先阅读报告。</p><p class="centered"><a href="" class="text-button">重新加载页面</a></p>';
 if(!state.report)return `<main class="session-loading"><h1>另一个你 · 三国人格</h1><p>${state.answers.some(a=>a!==null)?'已找回你的答题进度。':'你的专属链接已就绪。'}</p>${status.replace('你可以先阅读报告。','请稍候。')}</main>`;
 const r=toResult(state.report,state.source),qs=buildQuestionnaire(state.storyIds);
 return `<main><section class="result"><div class="centered"><div class="eyebrow">另一个你 · 三国人格</div><h1>${esc(r.primary.name)}</h1><h2>${esc(r.title)}</h2><p>${esc(r.quote||r.primary.short)}</p></div>${status}<div class="strength-sections">${[['你的优势',r.primary.strength],['你的独特气质',r.summary],['你的高光主场',r.primary.spark],['相处魅力',r.primary.relation],['快乐小行动',r.action]].map(([title,body])=>`<section><h3>${esc(title)}</h3><p>${esc(body)}</p></section>`).join('')}</div><section class="evidence">${r.evidence.map(e=>`<article><small>第 ${e.question} 题 · ${esc(qs[e.question-1].title)}</small><p class="chosen-answer">你的选择：<strong>${esc(qs[e.question-1].options[state.answers[e.question-1]].text)}</strong></p><p>${esc(e.insight)}</p></article>`).join('')}</section><p class="quiet centered">报告已保存，重复查看不扣次数。</p></section></main>`;
}
