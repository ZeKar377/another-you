import {createHash} from 'node:crypto';
import {archetypes} from '../shared/engine.mjs';

// Narrative definitions, not scores or a preselected winner. Keep all eight eligible.
const profiles={
 zhugeliang:{signals:['反复梳理信息、规划步骤与后手','把周全安排用于团队共同目标','愿意协调并持续落实长期计划'],distinction:'与司马懿相比更关注共同目标的安排；与郭嘉相比更偏系统规划和持续落实。仅仅谨慎、聪明或先了解情况不足以匹配。'},
 caocao:{signals:['主动拍板并承担结果','抓住机会推动局面变化','以目标和行动组织资源'],distinction:'与赵云相比更偏主动开局和目标决断；与孙尚香相比更偏带领团队达成目标。'},
 liubei:{signals:['优先理解人的感受与处境','通过关心和信任凝聚伙伴','重视陪伴与归属'],distinction:'与周瑜相比更偏人情和信任联结；与赵云相比更偏倾听和凝聚人心。'},
 guojia:{signals:['质疑既有解释并发现新可能','通过新视角或小实验破题','享受灵感、洞察和非惯常方案'],distinction:'与诸葛亮相比更偏打破既有规划；与孙尚香相比更偏新想法和验证，而非亲自行动的自由。'},
 zhouyu:{signals:['协调分工、节奏和执行','让不同人的长处服务共同目标','在合作中统筹方向并推进落地'],distinction:'与刘备相比更偏角色分工和执行默契；与诸葛亮相比更偏现场统筹与合作推进。'},
 zhaoyun:{signals:['用具体行动提供支持','重视承诺与可靠兑现','压力下先解决眼前问题并守护伙伴'],distinction:'与曹操相比更偏承担与守护，未必争取主导；与刘备相比更偏实际帮助而非情感凝聚。'},
 simayi:{signals:['保留独立判断和个人边界','观察等待并遵循自己的长期节奏','重视自主方向，不急于参与或表态'],distinction:'与诸葛亮相比更偏自主、边界与等待，不自动推断为替团队布局；不因沉着就推断为任何负面品德。'},
 sunshangxiang:{signals:['自主表达偏好、选择自己的道路','愿意亲身尝试未知并边做边应变','珍惜自由与实际行动的体验'],distinction:'与郭嘉相比更偏亲身探索和行动；与曹操相比更偏个人自主而非掌舵团队。性别不是匹配条件。'}
};

export function buildReportInput(answers,questions){
 const selected=questions.map((q,i)=>({question:i+1,title:q.title,scene:q.scene,story:q.story||null,selected:q.options[answers[i]].text}));
 // Stable per questionnaire + answers, so caching remains deterministic while the
 // first candidate is no longer always Zhuge Liang for every user.
 const seed=JSON.stringify(selected);
 const candidates=archetypes.map(({id,name,title})=>({id,name,title,...profiles[id]}));
 candidates.sort((a,b)=>{
  const rank=id=>createHash('sha256').update(seed+'\0'+id).digest('hex');
  return rank(a.id).localeCompare(rank(b.id));
 });
 return {answers:selected,candidates};
}
