import {legalUpdated} from './legalText';
// The permissions agreement (legalText.js, shown by Agreement.js) is accepted once per browser, before the first
// game, and asked again when the legal texts change: the record holds the date and the version accepted, nothing else.
export const agreementKey='questbound.agreement.v1';
export const agreementVersion=legalUpdated;
const storage=()=>{try{return globalThis.localStorage??null;}catch{return null;}};
export function agreementStatus(store=storage()){
 const none={accepted:false,acceptedAt:null,version:null};
 try{
  const saved=JSON.parse(store?.getItem(agreementKey)??'null');
  if(!saved||typeof saved!=='object')return none;
  return {accepted:saved.version===agreementVersion,acceptedAt:typeof saved.at==='string'?saved.at:null,version:typeof saved.version==='string'?saved.version:null};
 }catch{return none;}
}
export function acceptAgreement(store=storage(),now=Date.now){
 const record={version:agreementVersion,at:new Date(now()).toISOString()};
 try{store?.setItem(agreementKey,JSON.stringify(record));}catch{}
 return record;
}
export const acceptedOn=iso=>{const d=new Date(iso);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});};
