import AsyncStorage from '@react-native-async-storage/async-storage';
import {tableEndpoint} from './tableClient';
// A player's account on the host's PC (accounts.cjs): an email and a password that keep their hero and adventure
// there, so signing in on another device, or on this one after its data is lost, brings them back.
// This device remembers the email and a sign-in token, never the password.
const ACCOUNT_KEY='questbound.account.v1';
export const tidyEmail=email=>String(email??'').trim().toLowerCase();
export const emailProblem=email=>/^[^\s@]{1,64}@[^\s@.]{1,63}(\.[^\s@.]{1,63})+$/.test(tidyEmail(email))&&tidyEmail(email).length<=254?null:'Enter a full email address, like name@example.com.';
export const passwordProblem=password=>typeof password!=='string'||password.length<8?'Choose a password of at least 8 characters.':password.length>200?'That password is too long.':null;
// {email, token, savedAt, hold} or null. `hold` is set after signing in to an account that already has a saved
// adventure: nothing is uploaded from this device until the player has chosen which adventure to keep.
export async function accountState(){
 try{const s=JSON.parse(await AsyncStorage.getItem(ACCOUNT_KEY)??'null');return s&&typeof s.email==='string'&&/^[a-f0-9]{64}$/.test(s.token??'')?s:null;}catch{return null;}
}
const remember=async state=>{if(state)await AsyncStorage.setItem(ACCOUNT_KEY,JSON.stringify(state));else await AsyncStorage.removeItem(ACCOUNT_KEY);return state;};
async function accountCall(route,body,fetchImpl=fetch){
 let response;
 try{response=await fetchImpl(tableEndpoint()+'/account-'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});}
 catch{throw Error('The host\'s PC could not be reached. Check your connection and try again.');}
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(Error(data.error||'The host\'s PC could not complete that. Try again.'),{status:response.status});
 return data;
}
// A token the host no longer accepts (expired, or the password was changed elsewhere) signs this device out.
const signedOutBy=async error=>{if(error?.status===401)await remember(null);throw error;};
export async function registerAccount(email,password,fetchImpl){
 const problem=emailProblem(email)??passwordProblem(password);if(problem)throw Error(problem);
 const r=await accountCall('register',{email:tidyEmail(email),password},fetchImpl);
 // A fresh account takes this device's adventure; one whose password the host reset may already hold a save.
 return remember({email:r.email,token:r.token,savedAt:r.savedAt??null,hold:!!r.savedAt});
}
export async function signIn(email,password,fetchImpl){
 if(emailProblem(email))throw Error(emailProblem(email));
 if(typeof password!=='string'||!password)throw Error('Enter your password.');
 const r=await accountCall('login',{email:tidyEmail(email),password},fetchImpl);
 return remember({email:r.email,token:r.token,savedAt:r.savedAt??null,hold:!!r.savedAt});
}
export async function signOut(fetchImpl){
 const s=await accountState();if(s)await accountCall('logout',{token:s.token},fetchImpl).catch(()=>{});
 return remember(null);
}
// The adventure the game last saved on this device, so "save now" has something to send.
let latest=null;
export const noteSnapshot=snapshot=>{latest=snapshot;};
// Sends an adventure to the account (the latest one seen when none is given). Does nothing while signed out or on hold.
export async function saveToAccount(snapshot=latest,fetchImpl){
 const s=await accountState();if(!s||s.hold||!snapshot)return null;
 const r=await accountCall('save',{token:s.token,snapshot},fetchImpl).catch(signedOutBy);
 await remember({...s,savedAt:r.savedAt});return r.savedAt;
}
export async function loadFromAccount(fetchImpl){
 const s=await accountState();if(!s)throw Error('Sign in first.');
 return accountCall('load',{token:s.token},fetchImpl).catch(signedOutBy);
}
// The player has chosen which adventure this device plays: saving to the account carries on.
export async function releaseHold(){const s=await accountState();return s?remember({...s,hold:false}):null;}
export async function changePassword(current,next,fetchImpl){
 const s=await accountState();if(!s)throw Error('Sign in first.');
 if(passwordProblem(next))throw Error(passwordProblem(next).replace('a password','a new password'));
 await accountCall('password',{token:s.token,password:current,newPassword:next},fetchImpl);return true;
}
export async function deleteAccount(password,fetchImpl){
 const s=await accountState();if(!s)throw Error('Sign in first.');
 await accountCall('delete',{token:s.token,password},fetchImpl);return remember(null);
}
