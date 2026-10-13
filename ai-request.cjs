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
// Reading what the model wrote. Strict structured output (text.format json_schema, strict) makes a reply one JSON object,
// but the provider has still been seen to send it twice (two output_text items back to back, 2026-10-03) or wrapped in
// fences. The text is every output_text item joined; a refusal item is the model declining (never parsed as a reply).
const outputTexts=data=>(data?.output??[]).flatMap(o=>Array.isArray(o?.content)?o.content:[]).filter(c=>c?.type==='output_text'&&typeof c.text==='string').map(c=>c.text);
const outputText=data=>outputTexts(data).join('');
const refused=data=>(data?.output??[]).some(o=>(Array.isArray(o?.content)?o.content:[]).some(c=>c?.type==='refusal'));
// The first whole {...} in a text, by brace depth outside strings.
function firstObject(text){
 const start=text.indexOf('{');if(start<0)return '';let depth=0,quoted=false,escaped=false;
 for(let i=start;i<text.length;i++){const ch=text[i];if(quoted){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;continue;}if(ch==='"')quoted=true;else if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return text.slice(start,i+1);}
 return '';
}
// JSON wrapped in markdown fences or prose is recovered, and so is a reply sent twice (read as its first complete
// object); anything else is null.
function repairedJson(text){
 if(typeof text!=='string')return null;
 const unfenced=text.replace(/^\s*```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'');
 for(const candidate of [unfenced,unfenced.slice(unfenced.indexOf('{'),unfenced.lastIndexOf('}')+1),firstObject(unfenced)]){if(!candidate||candidate[0]!=='{')continue;try{const value=JSON.parse(candidate);if(value&&typeof value==='object'&&!Array.isArray(value))return value;}catch{}}
 return null;
}
// A story or hero from a completed response: the joined text, else each output item on its own, else repaired.
function readJson(data){
 const text=outputText(data);
 try{return JSON.parse(text);}catch{}
 for(const item of outputTexts(data)){try{const value=JSON.parse(item);if(value&&typeof value==='object')return value;}catch{}}
 const value=repairedJson(text);if(value)return value;
 throw Error(refused(data)?'The AI declined to write that. Try other words.':'The AI did not return a usable reply.');
}
module.exports.outputTexts=outputTexts;module.exports.outputText=outputText;module.exports.refused=refused;module.exports.firstObject=firstObject;module.exports.repairedJson=repairedJson;module.exports.readJson=readJson;
