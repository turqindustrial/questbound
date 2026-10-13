// OpenAI's moderation check on what players type (free; model omni-moderation-latest, POST /v1/moderations), asked by
// the Dungeon Master (dm-server.cjs generate) before a player's words reach the story model, and for table names (the
// account service asks with context.mode 'moderate'). Only the Dungeon Master holds the API key, so the check lives
// in its process. This module stays loaded while dm-server.cjs is reloaded on each request: the short cache of
// verdicts, each player's count of held-back messages and any pause live here. Bump `revision` (and the literal in
// dm-server's loadModeration) when it changes.
//
// What is held back is decided by category scores, not by the provider's own flag: a fantasy game is full of fights,
// so violence (graphic or not) and illicit deeds never stop a message; sexual content involving minors always does;
// hate, harassment and threats against a person, instructions for self-harm and sexual content do above the scores
// in `limits`. Words that sound like the player themselves may be at risk (self-harm intent) get a caring line with a
// pointer to help instead of a refusal, and never count against them. Names at a table are held to stricter scores.
//
// It fails open: if the check cannot be reached within `timeout`, the message goes on (noted in the security log at
// most every ten minutes). Each held-back message is noted in the security log by category names and the player's
// pseudonymous label (bans.cjs moderationLabel) only, never the words. Three in an hour pause that player's Dungeon
// Master for twenty minutes (sexual content involving minors counts twice).
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {moderationLabel}=require('./bans.cjs');
const revision=1;
const ENDPOINT='https://api.openai.com/v1/moderations',MODEL='omni-moderation-latest';
const limits={
 turn:{'sexual/minors':0.1,'hate':0.6,'hate/threatening':0.5,'harassment':0.85,'harassment/threatening':0.9,'sexual':0.75,'self-harm/instructions':0.5},
 name:{'sexual/minors':0.05,'hate':0.35,'hate/threatening':0.3,'harassment':0.6,'harassment/threatening':0.7,'sexual':0.5,'self-harm/instructions':0.5,'self-harm/intent':0.6},
};
const careLimits={'self-harm/intent':0.6,'self-harm':0.85};
const labels={'sexual/minors':'sexual content involving minors','sexual':'sexual content','hate':'hateful words','hate/threatening':'hateful threats','harassment':'harassment','harassment/threatening':'threats against a person','self-harm/instructions':'instructions for self-harm','self-harm/intent':'talk of self-harm'};
// The provider's result for one text: {categories:{name:bool}, category_scores:{name:number}}.
function verdictFor(result,purpose='turn'){
 const scores=result?.category_scores??{},flags=result?.categories??{},limit=limits[purpose]??limits.turn;
 const over=Object.keys(limit).filter(k=>Number(scores[k])>=limit[k]||(k==='sexual/minors'&&flags[k]===true));
 if(over.includes('sexual/minors'))return {action:'refuse',categories:over};
 if(purpose==='turn'){const hurt=Object.keys(careLimits).filter(k=>Number(scores[k])>=careLimits[k]);if(hurt.length)return {action:'care',categories:hurt};}
 return over.length?{action:'refuse',categories:over}:{action:'allow',categories:[]};
}
const CARE_LINE='That sounded as if it might be about you rather than your hero. If you are thinking about hurting yourself, please reach out to someone now: in the US call or text 988, in the UK or Ireland call Samaritans on 116 123, or find a helpline where you are at findahelpline.com. Your words were not sent to the Dungeon Master, and your adventure is unchanged.';
function moderationLine(verdict,purpose='turn'){
 if(verdict.action==='care')return CARE_LINE;
 const what=[...new Set(verdict.categories.map(c=>labels[c]??'words the game does not allow'))].join(' and ');
 return purpose==='name'?'That name was held back by the game’s content check ('+what+'). Choose another name.':'The game’s content check held that back ('+what+'), so the Dungeon Master never saw it. Fights and peril are fine; try saying it another way. Your adventure is unchanged.';
}
const pauseLine=ms=>'Your messages to the Dungeon Master are paused for about '+Math.max(1,Math.ceil(ms/60000))+' minute'+(Math.ceil(ms/60000)>1?'s':'')+', because several were held back by the content check. Your adventure is unchanged.';
// The player behind a request: the label the gateway or account service gave it ('account-<id>' or a browser hash).
const labelOf=guest=>typeof guest==='string'&&guest?moderationLabel(guest.startsWith('account-')?guest.slice(8):guest):'host';
function createModeration({fetchImpl=fetch,now=Date.now,timeout=2500,logFile=path.join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-security.jsonl'),cacheMs=600000,window=3600000,strikesToPause=3,pauseMs=1200000}={}){
 const cache=new Map(),strikes=new Map(),pauses=new Map(),lastStrike=new Map();let quietUntil=0;
 // The same shape as operations.cjs audit rows: mechanical labels only.
 const note=(event,account,route)=>{if(!logFile)return;try{fs.mkdirSync(path.dirname(logFile),{recursive:true});if(fs.existsSync(logFile)&&fs.statSync(logFile).size>1048576){fs.rmSync(logFile+'.old',{force:true});fs.renameSync(logFile,logFile+'.old');}fs.appendFileSync(logFile,JSON.stringify({at:new Date(now()).toISOString(),event,account,...(route?{route:String(route).replace(/\//g,':').replace(/[^a-zA-Z0-9:_+-]/g,'').slice(0,100)}:{})})+'\n',{mode:0o600});}catch{}};
 const paused=guest=>{if(!guest)return 0;const until=pauses.get(guest)??0;if(until<=now()){pauses.delete(guest);return 0;}return until-now();};
 function strike(guest,key,weight){
  // One message re-sent at once (a retry, or a turn that asks the Dungeon Master twice) counts once.
  const k=guest+':'+key;if(now()-(lastStrike.get(k)??-Infinity)<30000)return;lastStrike.set(k,now());if(lastStrike.size>4000)lastStrike.delete(lastStrike.keys().next().value);
  const list=[...(strikes.get(guest)??[]).filter(t=>t>now()-window),...Array(weight).fill(now())];strikes.set(guest,list);if(strikes.size>4000)strikes.delete(strikes.keys().next().value);
  if(list.length>=strikesToPause&&!paused(guest)){pauses.set(guest,now()+pauseMs);strikes.set(guest,[]);note('moderation-paused',labelOf(guest));}
 }
 async function ask(text,apiKey){
  const response=await fetchImpl(ENDPOINT,{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},signal:AbortSignal.timeout(timeout),body:JSON.stringify({model:MODEL,input:text})});
  if(!response.ok)throw Error('moderation '+response.status);
  const data=await response.json(),result=data?.results?.[0];if(!result||typeof result!=='object')throw Error('moderation reply');return result;
 }
 return {
  paused,
  pauseLine,
  // {action:'allow'|'refuse'|'care', categories, line?, unchecked?}
  async check(text,{apiKey,guest=null,purpose='turn'}={}){
   const words=typeof text==='string'?text.trim().slice(0,4000):'';if(!words||!apiKey)return {action:'allow',categories:[]};
   const key=crypto.createHash('sha256').update(purpose+'\n'+words).digest('hex');
   let hit=cache.get(key),verdict;
   if(hit&&hit.at>now()-cacheMs)verdict=hit.verdict;
   else{
    try{verdict=verdictFor(await ask(words,apiKey),purpose);}
    catch{if(now()>=quietUntil){quietUntil=now()+600000;note('moderation-unavailable',labelOf(guest));}return {action:'allow',categories:[],unchecked:true};}
    cache.set(key,{verdict,at:now()});if(cache.size>1000)cache.delete(cache.keys().next().value);
   }
   if(verdict.action==='allow')return verdict;
   if(!hit||hit.at<=now()-cacheMs)note(verdict.action==='care'?'moderation-care':'moderation-refused',labelOf(guest),purpose+':'+verdict.categories.join('+'));
   if(guest&&verdict.action==='refuse')strike(guest,key,verdict.categories.includes('sexual/minors')?2:1);
   return {...verdict,line:moderationLine(verdict,purpose)};
  },
 };
}
module.exports={revision,createModeration,verdictFor,moderationLine,pauseLine,limits,careLimits,ENDPOINT,MODEL,moderation:createModeration()};
