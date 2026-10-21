import {tableEndpoint,tableMembership} from './tableClient';
import {currentProfile} from './playerStorage';
// A request's own time limit, and a signal of the caller's (a held wait the table hook lets go); written out rather than
// AbortSignal.any, which older phone browsers lack.
function limitedBy(timeout,signal){
 if(!signal)return AbortSignal.timeout(timeout);
 const both=new AbortController(),timer=setTimeout(()=>both.abort(),timeout);
 if(signal.aborted)both.abort();else signal.addEventListener('abort',()=>both.abort(),{once:true});
 both.signal.addEventListener('abort',()=>clearTimeout(timer),{once:true});return both.signal;
}
export async function campaignCall(route,body={},timeout=20000,signal=null){
 const response=await fetch(tableEndpoint()+'/'+route,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({campaignId:tableMembership().campaignId,...body,expectedAccountId:currentProfile()}),signal:limitedBy(timeout,signal)});
 const data=await response.json().catch(()=>({}));if(response.status===409&&data.conflict)return data;
 if(!response.ok)throw Object.assign(Error(data.error||'The campaign could not be reached. Your last saved turn is kept.'),{status:response.status,removed:data.removed===true,banned:data.banned===true,retryAfter:Number(response.headers?.get?.('retry-after'))||0});return data;
}
