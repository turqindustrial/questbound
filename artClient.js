import {findDmEndpoint} from './dmConnection';
const cache=new Map();
export const artIdentity=subject=>JSON.stringify([subject.campaignId,subject.kind,subject.id]);
export const cachedArt=subject=>subject?cache.get(artIdentity(subject)):null;
export function ensureArt(subject,{retry=false}={}){
 return new Promise((resolve,reject)=>{
  let unsubscribe,done=false;
  if(retry)retryArt(subject);
  unsubscribe=subscribeArt(subject,entry=>{if(done||entry.status==='pending')return;done=true;unsubscribe?.();entry.status==='ready'?resolve(entry.dataUrl):reject(Error(entry.error??'The illustration is unavailable.'));});
  if(done)unsubscribe();
 });
}
async function endpoint(){
 return findDmEndpoint();
}
export function subscribeArt(subject,listener){
 const key=artIdentity(subject);let entry=cache.get(key);
 if(!entry){entry={status:'pending',listeners:new Set(),started:false};cache.set(key,entry);}
 entry.listeners.add(listener);listener(entry);
 if(!entry.started){entry.started=true;void run(entry,subject,false);}
 return()=>entry.listeners.delete(listener);
}
export function retryArt(subject){const entry=cache.get(artIdentity(subject));if(!entry||entry.running||entry.status==='ready')return;void run(entry,subject,true);}
async function run(entry,subject,retry){
 entry.running=true;entry.status='pending';entry.error=null;publish(entry);
 try{
  const url=await endpoint(),deadline=Date.now()+600000;let first=true;
  while(Date.now()<deadline){
   const response=await fetch(url+'/dm',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(12000),body:JSON.stringify({input:'Illustrate this encountered subject.',context:{mode:'art',choices:[],subject,retry:retry&&first}})});
   if(response.status===429){await delay(3500);continue;}
   const result=await response.json();if(!response.ok)throw Error(result.error??'The image service is unavailable.');
   if(result.status==='ready'&&typeof result.dataUrl==='string'&&result.dataUrl.startsWith('data:image/jpeg;base64,')){entry.status='ready';entry.dataUrl=result.dataUrl;publish(entry);return;}
   if(result.status==='failed')throw Error(result.error??'The illustration could not be generated.');
   if(result.status!=='pending')throw Error('The image service needs the updated Questbound server.');
   first=false;await delay(2500);
  }
  throw Error('The illustration is still taking a while. Retry to check its progress.');
 }catch(e){entry.status='failed';entry.error=e.name==='TimeoutError'?'The image service did not respond. You can retry.':e.message;publish(entry);}
 finally{entry.running=false;}
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function publish(entry){for(const listener of entry.listeners)listener({...entry});}
