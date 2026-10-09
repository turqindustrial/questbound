import AsyncStorage from '@react-native-async-storage/async-storage';
import {legalUpdated} from './legalText';
import {tableEndpoint} from './tableClient';
import {selectProfile,currentProfile} from './playerStorage';
const KEY='questbound.account.v2',OLD='questbound.account.v1';
export const tidyEmail=email=>String(email??'').trim().toLowerCase();
export const emailProblem=email=>/^[^\s@]{1,64}@[^\s@.]{1,63}(\.[^\s@.]{1,63})+$/.test(tidyEmail(email))&&tidyEmail(email).length<=254?null:'Enter a full email address.';
export const passwordProblem=password=>typeof password!=='string'||password.length<8?'Choose a password of at least 8 characters.':password.length>200?'That password is too long.':null;
export async function accountState(){try{const a=JSON.parse(await AsyncStorage.getItem(KEY)??'null');return a&&/^[a-f0-9]{64}$/.test(a.id??'')?a:null;}catch{return null;}}
async function remember(state){if(state)await AsyncStorage.setItem(KEY,JSON.stringify(state));else await AsyncStorage.removeItem(KEY);return state;}
export async function accountCall(route,body={},fetchImpl=fetch){
 const where=globalThis.location;if(where?.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(where.hostname))throw Error('Use the encrypted HTTPS game link.');
 const expected=!['register','login','verify','status'].includes(route)&&currentProfile()!=='guest'?{expectedAccountId:currentProfile()}:{};
 let response;try{response=await fetchImpl(tableEndpoint()+'/account-'+route,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,...expected}),signal:AbortSignal.timeout(20000)});}catch{throw Error('The host could not be reached. Your local progress is kept.');}
 const data=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(Error(data.error||'Account request failed.'),{status:response.status});return data;
}
export async function bootstrapAccount(fetchImpl){
 await AsyncStorage.removeItem(OLD); // Old browser-readable tokens are never reused.
 const saved=await accountState();
 try{const status=await accountCall('status',{},fetchImpl);if(!status.verified||!/^[a-f0-9]{64}$/.test(status.id??''))throw Object.assign(Error('The host must apply the account service update.'),{status:503});const next={...saved,...status,email:saved?.id===status.id?saved.email:'Verified account'};await remember(next);selectProfile(next.id);return next;}
 catch(error){if(error.status===401){await remember(null);selectProfile(null);return null;}selectProfile(saved?.id);return saved;}
}
async function entered(result){
 if(result.verificationRequired)return result;
 if(result.token||result.verified!==true||!/^[a-f0-9]{64}$/.test(result.id??''))throw Error('The host must run Apply-Security-Update.cmd before signing in.');
 const state={id:result.id,email:result.email,verified:true,savedAt:result.savedAt??null,hold:!!result.savedAt};await remember(state);latest=null;selectProfile(state.id);return state;
}
export async function registerAccount(email,password,fetchImpl,recoveryCode=''){
 const problem=emailProblem(email)??passwordProblem(password);if(problem)throw Error(problem);
 return entered(await accountCall('register',{email:tidyEmail(email),password,termsVersion:legalUpdated,ageConfirmed:true,...(recoveryCode?{recoveryCode:recoveryCode.trim()}: {})},fetchImpl));
}
export async function signIn(email,password,fetchImpl){if(emailProblem(email))throw Error(emailProblem(email));return entered(await accountCall('login',{email:tidyEmail(email),password,termsVersion:legalUpdated,ageConfirmed:true},fetchImpl));}
export async function verifyEmail(email,challenge,code,fetchImpl){return entered(await accountCall('verify',{email:tidyEmail(email),challenge,code:code.trim()},fetchImpl));}
export async function signOut(fetchImpl,all=false){try{await accountCall(all?'logout-all':'logout',{},fetchImpl);}catch(e){if(all||e.status!==401)throw e;}await remember(null);latest=null;selectProfile(null);}
export const signOutEverywhere=fetchImpl=>signOut(fetchImpl,true);
let latest=null;
export const noteSnapshot=snapshot=>{latest={snapshot,owner:currentProfile()};};
const signedOutBy=async (error,owner=currentProfile())=>{if(error.status===401&&owner===currentProfile()){await remember(null);selectProfile(null);}throw error;};
export async function saveToAccount(snapshot,fetchImpl){
 const owner=currentProfile(),s=await accountState();if(!s||s.id!==owner||s.hold)return null;
 if(!snapshot){if(latest?.owner!==owner)return null;snapshot=latest.snapshot;}if(!snapshot)return null;
 if(currentProfile()!==owner)return null;
 const r=await accountCall('save',{snapshot},fetchImpl).catch(error=>signedOutBy(error,owner));if(currentProfile()===owner)await remember({...s,savedAt:r.savedAt});return r.savedAt;
}
export async function loadFromAccount(fetchImpl){return accountCall('load',{},fetchImpl).catch(signedOutBy);}
export async function releaseHold(){const s=await accountState();return s?remember({...s,hold:false}):null;}
export async function changePassword(current,next,fetchImpl){if(passwordProblem(next))throw Error(passwordProblem(next));return accountCall('password',{password:current,newPassword:next},fetchImpl);}
export async function deleteAccount(password,fetchImpl){await accountCall('delete',{password},fetchImpl);await remember(null);latest=null;selectProfile(null);}
