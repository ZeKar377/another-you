export const SESSION_LLM_LIMIT=3;
export function quotaFor(state){
 const used=state.llmCalls;
 return {limit:SESSION_LLM_LIMIT,used,remaining:Math.max(0,SESSION_LLM_LIMIT-used),period:'lifetime'};
}
