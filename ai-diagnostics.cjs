// Never expose provider messages: authentication errors may echo credential text.
const codes=new Set(['invalid_api_key','invalid_authentication','mismatched_organization','organization_deactivated','account_deactivated','ip_not_authorized','insufficient_permissions','model_not_found','insufficient_quota','rate_limit_exceeded','billing_hard_limit_reached','credit_balance_exhausted']);
async function providerFailure(response){
 let body;try{body=await response.json();}catch{body={};}
 const code=codes.has(body?.error?.code)?body.error.code:'unclassified';
 const status=Number.isInteger(response.status)?response.status:0;
 const message=status===401?'OpenAI rejected authentication.':status===403?'OpenAI denied access.':status===429?'AI usage limit reached.':status===404?'The requested model or resource was not found.':'The AI provider could not complete this request.';
 return {status,code,message};
}
async function providerError(response){const d=await providerFailure(response);return Error(`${d.message} HTTP ${d.status}; code: ${d.code}. No game action was applied.`);}
async function diagnose({apiKey,model,fetchImpl=fetch}){
 const key=typeof apiKey==='string'?apiKey:'';
 const configuration={keyPresent:!!key,outerWhitespace:key!==key.trim(),containsWhitespace:/\s/.test(key),containsQuotes:/["'“”‘’]/.test(key),containsMaskCharacters:/[*•…]/.test(key),hasExpectedPrefix:key.startsWith('sk-'),modelConfigured:!!model};
 if(!key)return {diagnostic:{configuration,authenticated:false,message:'No key was supplied to this server.'}};
 // Read-only credential check; no text generation, tokens or game-state changes.
 let response;
 try{response=await fetchImpl('https://api.openai.com/v1/models',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});}
 catch{return {diagnostic:{configuration,authenticated:null,message:'The connection failed before authentication could be checked.'}};}
 if(!response.ok)return {diagnostic:{configuration,authenticated:response.status===401?false:null,...await providerFailure(response)}};
 const data=await response.json();
 return {diagnostic:{configuration,authenticated:true,status:response.status,modelListed:Array.isArray(data.data)?data.data.some(m=>m.id===model):null,message:'OpenAI accepted the existing key for model listing. Generating responses also requires model and endpoint permissions.'}};
}
module.exports={diagnose,providerError};
