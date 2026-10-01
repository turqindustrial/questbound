// How a model is asked. Reasoning models (GPT-5 and later, the o-series) take a reasoning effort and refuse
// nothing else; older models refuse the field. Game turns think not at all (fast and cheap: the engine does the
// arithmetic), while a new story or hero may think a little, which needs more time and room for the answer.
const reasoningModel=model=>/^(gpt-[5-9]|o[1-9])/i.test(String(model??''));
const efforts=['none','minimal','low','medium','high','xhigh'];
const effortOf=effort=>{const e=String(effort??'none').trim().toLowerCase();return efforts.includes(e)?e:'none';};
function modelOptions(model,effort='none'){return reasoningModel(model)?{model,reasoning:{effort:effortOf(effort)}}:{model};}
const thinking=effort=>!['none','minimal'].includes(effortOf(effort));
// Phones reach the DM through a gateway that waits 90 seconds, so a thinking reply gives up before the gateway does.
const providerTimeout=effort=>thinking(effort)?80000:30000;
// Reasoning tokens count against the output budget: leave room so the answer itself is never cut short.
const outputBudget=(base,effort)=>thinking(effort)?base+6000:base;
module.exports={reasoningModel,effortOf,modelOptions,thinking,providerTimeout,outputBudget};
