// A phone's localhost is the phone, so shared builds use the paired gateway.
export function dmEndpoints(location=globalThis.location){
 const desktop=location&&['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&['8081','8082'].includes(location.port);
 return !location||desktop?['http://localhost:8084','http://localhost:8083']:['/api'];
}
// Sends one request to the Dungeon Master. A busy DM (another player's turn is being written) refuses before doing
// any work, so the request is simply asked again for up to a minute instead of showing an error.
export async function askDm(endpoint,payload,{timeout=90000,wait=60000,fetchImpl=fetch,now=Date.now,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 const deadline=now()+wait;
 for(;;){
  const response=await fetchImpl(endpoint+'/dm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(timeout)});
  const body=await response.json().catch(()=>({}));
  if(response.status===429&&/Please wait before asking|busy with other players/.test(body?.error??'')&&now()<deadline){await pause(800+Math.random()*700);continue;}
  return {ok:response.ok,status:response.status,body};
 }
}
export async function findDmEndpoint(){
 for(const endpoint of dmEndpoints())try{
  const response=await fetch(endpoint+'/health',{signal:AbortSignal.timeout(3500)});
  if(response.ok&&(await response.json()).ready)return endpoint;
 }catch{}
 throw Error('The Dungeon Master is offline. Keep the PC and its private DM service running. On a phone, reopen your Phone link if pairing has expired.');
}
