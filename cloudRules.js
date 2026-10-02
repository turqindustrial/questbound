import AsyncStorage from '@react-native-async-storage/async-storage';
import {tableEndpoint} from './tableClient';
import {noteSnapshot,saveToAccount} from './accountRules';
// Cloud saves: the current hero and adventure are also kept on the host PC under this browser's recovery code, a
// little after play settles. Entering the code in another browser or device that can reach the game restores them
// there (and that device then saves under the same code). Only a hash of the code is stored on the PC.
const CLOUD_KEY='questbound.cloud.v1',codeLetters='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const normalCode=code=>String(code??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
export const showCode=code=>normalCode(code).replace(/(.{4})(?=.)/g,'$1-');
const randomBytes=n=>{const a=new Uint8Array(n);globalThis.crypto.getRandomValues(a);return a;};
export const newRecoveryCode=(random=randomBytes)=>Array.from(random(12),b=>codeLetters[b%32]).join('');
export async function cloudSettings(){
 try{const s=JSON.parse(await AsyncStorage.getItem(CLOUD_KEY)??'null');if(s&&/^[A-Z0-9]{12}$/.test(s.code))return s;}catch{}
 const fresh={code:newRecoveryCode(),savedAt:null,enabled:true};
 await AsyncStorage.setItem(CLOUD_KEY,JSON.stringify(fresh));return fresh;
}
export async function setCloudSettings(changes){const s={...await cloudSettings(),...changes};await AsyncStorage.setItem(CLOUD_KEY,JSON.stringify(s));return s;}
async function cloudCall(route,body,fetchImpl=fetch){
 const response=await fetchImpl(tableEndpoint()+'/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.error||'The cloud save on the host PC could not be reached.');
 return data;
}
export async function uploadSave(snapshot,fetchImpl){
 const s=await cloudSettings();if(!s.enabled)return null;
 const r=await cloudCall('cloud-save',{code:s.code,snapshot},fetchImpl);await setCloudSettings({savedAt:r.savedAt});return r.savedAt;
}
export const downloadSave=(code,fetchImpl)=>cloudCall('cloud-load',{code:normalCode(code)},fetchImpl);
// Saves are sent a few seconds after play settles, not on every step.
let cloudTimer=null,cloudPending=null;
export function scheduleCloudSave(snapshot,delay=8000){
 cloudPending=snapshot;noteSnapshot(snapshot);clearTimeout(cloudTimer);
 // The same copy goes to the player's account when they are signed in (accountRules.js).
 cloudTimer=setTimeout(()=>{const s=cloudPending;cloudPending=null;if(s){uploadSave(s).catch(()=>{});saveToAccount(s).catch(()=>{});}},delay);
}
