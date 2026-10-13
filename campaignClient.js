import {tableEndpoint,tableMembership} from './tableClient';
import {currentProfile} from './playerStorage';
export async function campaignCall(route,body={},timeout=20000){
 const response=await fetch(tableEndpoint()+'/'+route,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({campaignId:tableMembership().campaignId,...body,expectedAccountId:currentProfile()}),signal:AbortSignal.timeout(timeout)});
 const data=await response.json().catch(()=>({}));if(response.status===409&&data.conflict)return data;
 if(!response.ok)throw Object.assign(Error(data.error||'The campaign could not be reached. Your last saved turn is kept.'),{status:response.status,removed:data.removed===true,banned:data.banned===true});return data;
}
