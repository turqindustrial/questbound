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
export async function findDmEndpoint(){
 for(const endpoint of dmEndpoints())try{
  const response=await fetch(endpoint+'/health',{signal:AbortSignal.timeout(3500)});
  if(response.ok&&(await response.json()).ready)return endpoint;
 }catch{}
 throw Error('The Dungeon Master is offline. Keep the PC and its private DM service running. On a phone, reopen your Phone link if pairing has expired.');
}
