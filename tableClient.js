// Client for the shared table: device identity, membership and the sync calls.
// Desktop browsers talk to the loopback table directly; phones go through the paired gateway.
const KEY='questbound.table.v1';
const store={get(){try{return JSON.parse(globalThis.localStorage?.getItem(KEY))??{};}catch{return {};}},set(v){try{globalThis.localStorage?.setItem(KEY,JSON.stringify(v));}catch{}}};
export function tableEndpoint(location=globalThis.location){
 const desktop=location&&['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&['8081','8082'].includes(location.port);
 return !location||desktop?'http://localhost:8086':'/api/sync';
}
export function deviceId(){
 const s=store.get();if(s.deviceId)return s.deviceId;
 const id=(globalThis.crypto?.randomUUID?.()??(Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12)));store.set({...s,deviceId:id});return id;
}
export const tableMembership=()=>{const s=store.get();return {joined:!!s.joined,name:s.name??'',version:Number.isInteger(s.version)?s.version:0};};
export function setTableMembership(changes){store.set({...store.get(),deviceId:deviceId(),...changes});}
async function call(route,body){
 const response=await fetch(tableEndpoint()+'/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({playerId:deviceId(),name:tableMembership().name,...body}),signal:AbortSignal.timeout(12000)});
 const data=await response.json().catch(()=>({}));
 if(response.status===409)return {...data,conflict:true};
 if(!response.ok)throw Error(data.error||'The shared table is not responding. Start Questbound on the PC with the launcher.');
 return data;
}
export const pollTable=(knownVersion,acting)=>call('poll',{knownVersion,...(acting===undefined?{}:{acting})});
export const saveTable=(snapshot,baseVersion,force=false)=>call('save',{snapshot,baseVersion,force});
export const leaveTable=()=>call('leave',{}).catch(()=>null);
// Before the table first replaces this device's save, keep a copy so it can be restored.
const saveKeys=['questbound.character.v1','questbound.adventure.v1'];
export function backupLocalSave(){try{const ls=globalThis.localStorage;if(!ls||ls.getItem('questbound.backup.savedAt'))return;for(const k of saveKeys){const v=ls.getItem(k);if(v!==null)ls.setItem('questbound.backup.'+k,v);}ls.setItem('questbound.backup.savedAt',new Date().toISOString());}catch{}}
export function localBackup(){try{return globalThis.localStorage?.getItem('questbound.backup.savedAt')??null;}catch{return null;}}
export function restoreLocalBackup(){const ls=globalThis.localStorage;for(const k of saveKeys){const v=ls.getItem('questbound.backup.'+k);if(v===null)ls.removeItem(k);else ls.setItem(k,v);ls.removeItem('questbound.backup.'+k);}ls.removeItem('questbound.backup.savedAt');}
