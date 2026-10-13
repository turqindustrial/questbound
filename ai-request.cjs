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
 throw Object.assign(Error(refused(data)?'The AI declined to write that. Try other words.':'The AI did not return a usable reply.'),{kind:refused(data)?'refused':'invalid-json'});
}
module.exports.outputTexts=outputTexts;module.exports.outputText=outputText;module.exports.refused=refused;module.exports.firstObject=firstObject;module.exports.repairedJson=repairedJson;module.exports.readJson=readJson;

// Long requests: a tale (and a ready journey) written at high effort takes three to five minutes. Node's own fetch
// (undici) gives up on a response whose headers have not come within 300 s, and on a body silent for 300 s; the first
// journey written for the library was cut off that way on 2026-10-13 (308 s, nothing logged). So a long request is
// streamed (server-sent events: the headers come at once and the text flows), and it goes through an agent of Node's
// own fetch whose header and silence limits are ten minutes, so the caller's own timeout is the only bound. That agent
// is made from the global one Node keeps under undici's shared symbol (no package needed); if that ever changes it is
// simply not used. Kept on globalThis so a reload of this file never makes another.
const patientKey=Symbol.for('questbound.patientAgent');
async function patientDispatcher(fetchImpl=fetch,limit=600000){
 if(fetchImpl!==globalThis.fetch)return null;
 try{
  const kept=globalThis[patientKey]??={};if(kept[limit])return kept[limit];
  const key=Symbol.for('undici.globalDispatcher.1');
  if(!globalThis[key])await globalThis.fetch('data:,').catch(()=>{});
  const Agent=globalThis[key]?.constructor;if(typeof Agent!=='function'||Agent.name!=='Agent')return null;
  return kept[limit]=new Agent({headersTimeout:limit,bodyTimeout:limit});
 }catch{return null;}
}
// A streamed response read to its end: the final response (completed, incomplete or failed) as the provider sent it,
// with the text gathered from the deltas put in where the final event lacks it. An 'error' event becomes a failed
// response; a stream that ends with no final event is 'cut off'.
async function streamedResponse(response){
 const decoder=new TextDecoder();let buffer='',text='',refusal='',final=null;
 const read=block=>{
  const data=block.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trim()).join('');if(!data||data==='[DONE]')return;
  let event;try{event=JSON.parse(data);}catch{return;}
  if(event.type==='response.output_text.delta'&&typeof event.delta==='string')text+=event.delta;
  else if(event.type==='response.refusal.delta'&&typeof event.delta==='string')refusal+=event.delta;
  else if(['response.completed','response.incomplete','response.failed'].includes(event.type)&&event.response&&typeof event.response==='object')final=event.response;
  else if(event.type==='error')final={status:'failed',error:{code:typeof event.code==='string'?event.code:typeof event.error?.code==='string'?event.error.code:null}};
 };
 const blocks=()=>{let cut;while((cut=buffer.search(/\r?\n\r?\n/))>=0){const m=buffer.slice(cut).match(/^\r?\n\r?\n/)[0];read(buffer.slice(0,cut));buffer=buffer.slice(cut+m.length);}};
 for await(const chunk of response.body){buffer+=typeof chunk==='string'?chunk:decoder.decode(chunk,{stream:true});blocks();}
 buffer+=decoder.decode();blocks();if(buffer.trim())read(buffer);
 const data=final??{status:'cut off'};
 if(!outputTexts(data).length&&!refused(data)&&(text||refusal))data.output=[{type:'message',content:[...(text?[{type:'output_text',text}]:[]),...(refusal?[{type:'refusal',refusal}]:[])]}];
 return data;
}
// Asks for a long response (`payload` is the Responses API body; it is streamed) and returns the completed response.
// Its cost is counted (onUsage) whenever the provider reports one, a cut-short reply included. Every failure carries a
// mechanical `kind` (timeout, http, incomplete, failed, cut-off, network) and how many seconds had passed, for the
// diagnostics (requestFailure).
async function longResponse(payload,{apiKey,timeout,fetchImpl=fetch,onUsage=null,incomplete='The AI reply was incomplete.'}){
 const started=Date.now(),seconds=()=>Math.round((Date.now()-started)/1000);
 const tag=e=>{if(e&&typeof e==='object'&&!e.kind){const code=e.cause?.code??e.code;e.kind=e.name==='TimeoutError'||e.name==='AbortError'||/TIMEOUT/.test(String(code??''))?'timeout':'network';if(code&&typeof code==='string')e.code=code;}if(e&&typeof e==='object')e.seconds??=seconds();return e;};
 const dispatcher=await patientDispatcher(fetchImpl);
 let response,data;
 try{response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},signal:AbortSignal.timeout(timeout),...(dispatcher?{dispatcher}:{}),body:JSON.stringify({...payload,stream:true})});}catch(e){throw tag(e);}
 if(!response.ok){const {providerError}=require('./ai-diagnostics.cjs'),e=await providerError(response);throw Object.assign(e,{kind:'http',status:response.status,seconds:seconds()});}
 try{data=/text\/event-stream/i.test(response.headers?.get?.('content-type')??'')?await streamedResponse(response):await response.json();}catch(e){throw tag(e);}
 if(onUsage&&data?.usage)try{onUsage(data.usage);}catch{}
 if(data?.status!=='completed')throw Object.assign(Error(incomplete),{kind:data?.status==='incomplete'?'incomplete':data?.status==='failed'?'failed':'cut-off',reason:data?.incomplete_details?.reason??data?.error?.code??null,seconds:seconds()});
 return data;
}
// What a failed long write was, in mechanical terms only (never the provider's words), for .questbound-diagnostics.jsonl.
const mechanical=v=>typeof v==='string'&&/^[A-Za-z0-9_.:-]{1,60}$/.test(v)?v:null;
function requestFailure(e){
 const known=['timeout','http','incomplete','failed','cut-off','network','refused','invalid-json','invalid-story','rejected','too-alike','no-story','ceiling'];
 const kind=known.includes(e?.kind)?e.kind:e?.name==='TimeoutError'?'timeout':'other';
 const status=kind==='http'&&Number.isInteger(e?.status)?e.status:null,code=kind==='http'?mechanical(/code: ([A-Za-z0-9_]+)/.exec(String(e?.message??''))?.[1]):mechanical(e?.code);
 return {failure:kind,...(status?{status}:{}),...(code?{code}:{}),...(mechanical(e?.reason)?{reason:e.reason}:{}),...(Number.isFinite(e?.seconds)?{seconds:e.seconds}:{})};
}
module.exports.patientDispatcher=patientDispatcher;module.exports.streamedResponse=streamedResponse;module.exports.longResponse=longResponse;module.exports.requestFailure=requestFailure;
