// A phone's localhost is the phone, so shared builds use the paired gateway.
export function dmEndpoints(location=globalThis.location){
 const desktop=location&&['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&['8081','8082'].includes(location.port);
 return !location||desktop?['http://localhost:8084','http://localhost:8083']:['/api'];
}
export async function findDmEndpoint(){
 for(const endpoint of dmEndpoints())try{
  const response=await fetch(endpoint+'/health',{signal:AbortSignal.timeout(3500)});
  if(response.ok&&(await response.json()).ready)return endpoint;
 }catch{}
 throw Error('The Dungeon Master is offline. Keep the PC and its private DM service running. On a phone, reopen your Phone link if pairing has expired.');
}
