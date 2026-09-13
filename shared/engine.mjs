import {stories} from './stories.mjs';
export const dimensions=['谋略','行动','共情','独立','协作','探索'];
const q=(title,scene,options)=>({title,scene,options:options.map(([text,axis])=>({text,axis}))});
export const questions=[
q('一封密信，打乱了所有计划。','你和伙伴筹备已久的计划，突然出现一个未知变量。你会先……',[['把线索拼起来，找出真正的问题',0],['先做一件能稳住局面的事',1],['问问大家最担心什么',2],['跳出原计划，试一条新路',5]]),
q('帐中议事，众人各执一词。','决策迟迟不能落地，而天色已经暗了。',[['列清得失，让事实说话',0],['主动拍板，承担这次责任',1],['找到彼此都在乎的目标',4],['保留判断，不为共识妥协',3]]),
q('初到一座陌生的城。','没有任务安排，你拥有完整的一天。',[['走进书肆，了解这里的来龙去脉',0],['找当地人聊聊他们的生活',2],['一个人闲逛，不赶任何约定',3],['往地图上没有标注的地方走',5]]),
q('一位伙伴，犯了不小的错。','事情仍有补救余地，但他已经十分自责。',[['先把局面补救回来，再复盘',1],['先听他说完，让他缓一口气',2],['和他一起调整分工，避免重演',4],['追查出错的环节，修正机制',0]]),
q('你得到一支小队。','第一次出发之前，你最想做好什么？',[['给每个人安排合适的位置',4],['定好目标与备用路线',0],['带头完成最难的第一步',1],['给大家试错和发挥的空间',5]]),
q('一个机会，回报可观但前路不明。','你有选择权，也有拒绝的余地。',[['做一个小实验，再决定是否投入',5],['机会稍纵即逝，先行动',1],['确认它符合自己的长期方向',3],['找可信的伙伴一起评估',4]]),
q('忙碌之后，你如何恢复自己？','终于可以把事务暂时交给别人。',[['关掉消息，独处一会儿',3],['和熟悉的人吃顿饭',2],['做一件从未尝试的小事',5],['整理思绪，让明天更清晰',0]]),
q('两位朋友，都希望你站在自己这边。','你听到的，是两个完全不同的版本。',[['分别听完，理解各自的委屈',2],['把争议转成能一起解决的问题',4],['保持自己的判断，不急着站队',3],['核实关键事实再开口',0]]),
q('一项重复的工作，交到了你手里。','它不难，却已经沿用了许多年。',[['尝试更聪明的新做法',5],['拆成步骤，尽快完成',1],['研究为什么一直这样做',0],['与伙伴分工，让每个人轻松一点',4]]),
q('你发现，大多数人都看错了方向。','你的想法还没有得到认可。',[['整理证据，耐心说服',0],['自己先走一段，拿结果说话',1],['即使没人支持，也保留判断',3],['找一个愿意尝试的人，共同验证',5]]),
q('有人向你求助，却说不清原因。','你也正好有一件事急着处理。',[['放慢一点，问他最近怎么样',2],['帮他确定一个马上能做的动作',1],['约定一个能认真交流的时间',3],['找合适的人一起帮忙',4]]),
q('夜里，营地里只剩下一盏灯。','你还醒着，多半是因为……',[['一个难题还没有想透',0],['有个新点子，想趁热试试',5],['惦记着某个人的处境',2],['享受这一刻只属于自己',3]]),
q('一次合作获得了出乎意料的成功。','大家问你，最值得记住的是什么？',[['我们在关键时刻敢于迈出一步',1],['每个人都找到了自己的位置',4],['我们始终照顾着彼此',2],['我们打破了原本的限制',5]]),
q('别人给你一份“标准答案”。','但你的经历，似乎并不完全符合它。',[['追问它成立的前提',0],['相信亲身体验，保留自己的版本',3],['尝试组合出第三种答案',5],['听听不同的人如何理解',2]]),
q('面对一个漫长目标，你靠什么坚持？','热情会起伏，进展也不会总是顺利。',[['把目标拆成今天能完成的一步',1],['身边有彼此托底的伙伴',4],['它是我真正想做的事',3],['不断发现其中新的可能性',5]]),
q('一位同伴即将远行。','临别之前，你会送给他……',[['一份细致的路线与提醒',0],['一句“需要我时，随时来找我”',2],['一件马上能派上用场的东西',1],['介绍沿途值得信赖的朋友',4]]),
q('你希望自己的决定，被如何记住？','多年以后，回头看今天。',[['在复杂局面里，看清了方向',0],['没有辜负那些信任我的人',2],['始终活成了自己认可的样子',3],['让一群人走到了更远的地方',4]]),
q('故事的下一章，你最想去哪里？','这次，没有别人替你决定。',[['去一个能把想法变成现实的地方',1],['去未知处，再认识一次世界',5],['去有伙伴、有牵挂的地方',4],['去能按自己节奏生活的地方',3]])
];
export const baseQuestions=questions.map(q=>({...q,options:q.options.map(o=>({...o}))}));
for(const s of stories){Object.assign(questions[s.index],q(s.title,s.scene,s.options),{story:s.name+' · 故事改编',background:'/backgrounds/'+s.id+'-v1.webp',focus:s.focus});}
export const archetypes=[
{id:'zhugeliang',name:'诸葛亮',title:'静水深流的布局者',short:'胸中有丘壑，落子有回声。',color:'#426250',vector:[95,55,60,70,85,40],strength:'你善于在杂乱信息里找到秩序，也愿意替团队多想一步。',spark:'',relation:'你重视可靠的约定。把你的推演过程说出来，会让伙伴更容易跟上你。'},
{id:'caocao',name:'曹操',title:'破局向前的掌舵者',short:'风起时，你已经扬帆。',color:'#835245',vector:[85,95,30,85,55,70],strength:'你能在不确定中做出选择，并愿意为自己的决定承担责任。',spark:'',relation:'你欣赏坦诚和能力。让伙伴知道他们可以提出不同意见，会让合作更长久。'},
{id:'liubei',name:'刘备',title:'聚人成光的同行者',short:'你走过的地方，总有人愿意同行。',color:'#8b7040',vector:[55,55,95,35,95,35],strength:'你能认真看见人的处境，让不同的人在同一个目标下建立信任。',spark:'',relation:'你擅长建立归属感，也值得被照顾。试着直接说出自己的需要。'},
{id:'guojia',name:'郭嘉',title:'不循常路的洞察者',short:'别人看见棋局，你看见另一种可能。',color:'#5c657e',vector:[95,45,40,85,35,95],strength:'你对变化敏锐，常能跳出惯常的解释，发现被忽略的机会。',spark:'',relation:'你需要能接住想象力的伙伴。把灵感拆成具体一步，比等待完全理解更有效。'},
{id:'zhouyu',name:'周瑜',title:'从容有度的统筹者',short:'让每一份才华，各自闪光。',color:'#885b51',vector:[80,80,50,50,90,65],strength:'你既能把握方向，也能协调节奏，让大家的长处相互成就。',spark:'',relation:'你喜欢有默契的合作。提前讲清期待，比默默失望更容易建立默契。'},
{id:'zhaoyun',name:'赵云',title:'笃定可靠的守护者',short:'不必声张，你的行动自有分量。',color:'#467078',vector:[45,90,80,75,65,30],strength:'面对压力，你倾向于把事情做好，用行动给身边的人安全感。',spark:'',relation:'你重视真诚与兑现。偶尔用语言表达关心，会让行动更容易被读懂。'},
{id:'simayi',name:'司马懿',title:'沉着自持的观察者',short:'不急于落子，也不轻易随风。',color:'#666257',vector:[90,45,30,95,40,35],strength:'你能保持自己的节奏，在压力中观察局势，不轻易被他人的情绪推着走。',spark:'',relation:'你重视边界。适度分享真实想法，可以减少别人把安静误解成疏远。'},
{id:'sunshangxiang',name:'孙尚香',title:'自在果敢的开拓者',short:'心之所向，不必等谁许可。',color:'#9c6045',vector:[40,90,55,95,35,90],strength:'你愿意尝试，也敢于表达偏好。面对未知，你常能找到行动的勇气。',spark:'',relation:'你珍惜自由，也尊重鲜明的个性。提前沟通自己的节奏，能让亲近更自在。'}
];
const positiveTraits={
zhugeliang:['你擅长为复杂事情找到清晰的起点。在需要规划与协调的场景，你的周全能让大家更安心地出发。','你愿意把思考分享给伙伴，用清楚的安排和认真倾听建立默契。'],
caocao:['你愿意把想法化成行动，在需要有人带头的时刻，你的决断能让团队看见前进的方向。','你珍视坦诚交流与各展所长，明确表达期待，让伙伴更容易与你并肩。'],
liubei:['你能看见不同人的长处，让一群人找到愿意共同奔赴的目标，这份凝聚力很有温度。','你善于表达关心、回应信任，给彼此留出被理解和被支持的空间。'],
guojia:['你容易发现常规之外的可能，把新点子化成小尝试时，常能为局面带来新鲜的方向。','你欣赏有趣的想法，愿意和伙伴交换视角，让交流成为灵感的起点。'],
zhouyu:['你能把不同节奏协调在一起，让各人的才华在共同目标中发挥作用，合作因此更有章法。','你重视清楚的约定和彼此的发挥，善于在合作中建立从容可靠的默契。'],
zhaoyun:['你愿意把关心落实成具体行动，在需要支持和兑现承诺的时刻，你的可靠很有力量。','你珍惜真诚与陪伴，用细致行动回应别人，也愿意让支持在彼此之间流动。'],
simayi:['你能守住自己的节奏，认真观察变化，在需要耐心和持续判断的事情上展现沉着。','你尊重彼此的空间，珍视稳定坦诚的联系，让相处有清晰的边界和长久的信任。'],
sunshangxiang:['你敢表达偏好，也愿意尝试新的道路，把自主与行动结合时，你的鲜明个性格外动人。','你欣赏真实而鲜明的人，愿意分享探索的快乐，也尊重彼此独特的步调。']
};
for(const a of archetypes){[a.spark,a.relation]=positiveTraits[a.id];a.portrait='/portraits/'+a.id+'-v1.webp';}
export function score(answers,questionSet=questions){
 const questions=questionSet;
 if(!Array.isArray(answers)||answers.length!==questions.length||answers.some((v,i)=>!Number.isInteger(v)||v<0||v>=questions[i].options.length))throw new Error('请完成全部18道题');
 const counts=dimensions.map(()=>0), possible=dimensions.map(()=>0);
 questions.forEach((q,i)=>{q.options.forEach(o=>possible[o.axis]++);counts[q.options[answers[i]].axis]++});
 const traits=counts.map((v,i)=>Math.round(100*v/possible[i]));
 // Compensate for choice exposure, then compare relative preference profiles.
 const max=Math.max(...traits,1);const vector=traits.map(v=>v/max*100);
 const ranked=archetypes.map(a=>({...a,distance:Math.sqrt(a.vector.reduce((s,v,i)=>s+(v-vector[i])**2,0)/6)})).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));
 const top=ranked.slice(0,3); const weights=top.map(a=>Math.exp(-a.distance/20));const sum=weights.reduce((a,b)=>a+b,0);
 const percentages=weights.map(w=>Math.floor(100*w/sum));let remainder=100-percentages.reduce((a,b)=>a+b,0);for(let i=0;remainder>0;i++,remainder--)percentages[i%3]++;
 return {version:'sanguo-2',traits,top:top.map((a,i)=>({...a,percent:percentages[i]})),primary:top[0]};
}

export function buildQuestionnaire(storyIds){
 if(!Array.isArray(storyIds)||storyIds.length!==3||new Set(storyIds).size!==3||storyIds.some(id=>!stories.some(s=>s.id===id)))throw Error('INVALID_STORY_SELECTION');
 const selected=new Set(storyIds);return baseQuestions.map((base,i)=>{const s=stories.find(s=>s.index===i&&selected.has(s.id));return s?{...q(s.title,s.scene,s.options),story:s.name+' · 故事改编',background:'/backgrounds/'+s.id+'-v1.webp',focus:s.focus}:base;});
}
