// A phone's localhost is the phone, so shared builds use the paired gateway.
export function dmEndpoints(location=globalThis.location){
 const desktop=location&&['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&['8081','8082'].includes(location.port);
 return !location||desktop?['http://localhost:8084','http://localhost:8083']:['/api'];
}
// Sends one request to the Dungeon Master. A busy DM (another player's turn is being written) refuses before doing
// any work, so the request is simply asked again for up to a minute instead of showing an error.
// With onNarration, a game turn is asked for as a stream: the narration is handed over while it is being written,
// then the checked reply. A service that does not stream simply answers with the whole reply.
export async function askDm(endpoint,payload,{timeout=90000,wait=60000,fetchImpl=fetch,now=Date.now,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),onNarration=null}={}){
 const deadline=now()+wait,sent=onNarration?{...payload,stream:true}:payload;
 for(;;){
  const response=await fetchImpl(endpoint+'/dm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sent),signal:AbortSignal.timeout(timeout)});
  const streamed=/ndjson/.test(response.headers?.get?.('content-type')??'');
  const body=streamed?await readTurn(response,onNarration):await response.json().catch(()=>({}));
  if(streamed)return {ok:response.ok&&!body.error,status:body.error?502:response.status,body};
  if(response.status===429&&/Please wait before asking|busy with other players/.test(body?.error??'')&&now()<deadline){await pause(800+Math.random()*700);continue;}
  return {ok:response.ok,status:response.status,body};
 }
}
// Reads a streamed turn: {narration} lines while it is written, then {reply} or {error}.
export async function readTurn(response,onNarration){
 let result=null,buffer='';
 const take=line=>{if(!line.trim())return;let m;try{m=JSON.parse(line);}catch{return;}if(typeof m.narration==='string'){try{onNarration?.(m.narration);}catch{}}else if(m.reply)result=m.reply;else if(m.error)result={error:m.error};};
 if(response.body?.getReader){const reader=response.body.getReader(),decoder=new TextDecoder();for(;;){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let i;while((i=buffer.indexOf('\n'))>=0){take(buffer.slice(0,i));buffer=buffer.slice(i+1);}}take(buffer);}
 else for(const line of (await response.text()).split('\n'))take(line);
 return result??{error:'The Dungeon Master\'s reply was cut off. Nothing was applied; try again.'};
}
// A new story is written in the background (the story writer may think for minutes): the game asks once with a job
// id, is told the tale is under way, and asks after it every few seconds until it is ready. No request waits long,
// so a phone's gateway and the shared link never give up on it. A Dungeon Master from before this simply answers the
// first request with the story. Returns {ok,body} like askDm; body.story is the tale.
// The job id is drawn from the browser's secure random source, so nobody can guess another player's tale.
const secureRandom=()=>{try{return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;}catch{return Math.random();}};
const newJobId=(random=secureRandom)=>Array.from({length:24},()=>'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(random()*36)]).join('');
export async function writeStory(endpoint,payload,{fetchImpl=fetch,now=Date.now,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),every=3000,limit=480000,random=secureRandom}={}){
 const job=newJobId(random),started=now();
 const first=await askDm(endpoint,{...payload,context:{...payload.context,job}},{fetchImpl,now,pause});
 if(!first.ok||first.body?.story||first.body?.status===undefined)return first;
 let state=first.body,misses=0;
 for(;;){
  if(state?.status==='ready')return state.result?.story?{ok:true,status:200,body:state.result}:{ok:false,status:502,body:{error:'The story came back incomplete. Your adventure is unchanged; try again.'}};
  if(state?.status==='failed')return {ok:false,status:502,body:{error:state.error||'The story could not be written. Your adventure is unchanged.'}};
  if(state?.status==='unknown')return {ok:false,status:502,body:{error:'The Dungeon Master was restarted while writing your story. Your adventure is unchanged; try again.'}};
  if(now()-started>limit)return {ok:false,status:504,body:{error:'The story is taking too long to write. Your adventure is unchanged; try again.'}};
  await pause(every);
  // A dropped connection while waiting (a phone asleep, a tunnel hiccup) is simply asked again.
  try{const asked=await askDm(endpoint,{input:'Is the story ready?',context:{mode:'art',choices:[],storyJob:job}},{timeout:20000,fetchImpl,now,pause});
   if(asked.ok&&asked.body&&typeof asked.body.status==='string'){state=asked.body;misses=0;}
   else if(asked.status===401)return asked;
   else if(++misses>=8)return {ok:false,status:asked.status,body:{error:asked.body?.error||'The Dungeon Master stopped answering. Your adventure is unchanged; try again.'}};
  }catch{if(++misses>=8)return {ok:false,status:503,body:{error:'The Dungeon Master stopped answering. Your adventure is unchanged; try again.'}};}
 }
}
export async function findDmEndpoint(){
 for(const endpoint of dmEndpoints())try{
  const response=await fetch(endpoint+'/health',{signal:AbortSignal.timeout(3500)});
  if(response.ok&&(await response.json()).ready)return endpoint;
 }catch{}
 throw Error('The Dungeon Master is offline. Keep the PC and its private DM service running. On a phone, reopen your Phone link if pairing has expired.');
}
