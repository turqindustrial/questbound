const assert=require('node:assert/strict');
const {diagnose,providerError}=require('./ai-diagnostics.cjs');
const {generate}=require('./dm-server.cjs');
(async()=>{
 const secret='sk-test-secret-never-output';
 const rejected={ok:false,status:401,json:async()=>({error:{code:'invalid_api_key',message:'Invalid key: '+secret}})};
 const result=await generate({input:'Check connection',context:{mode:'diagnostics',choices:[]}},{apiKey:secret,model:'test-model',fetchImpl:async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/models');assert.equal(options.body,undefined);return rejected;}});
 assert.equal(result.diagnostic.code,'invalid_api_key');assert.equal(result.diagnostic.authenticated,false);assert.ok(!JSON.stringify(result).includes(secret));
 const error=await providerError(rejected);assert.ok(error.message.includes('401'));assert.ok(!error.message.includes(secret));
 const unknown=await providerError({ok:false,status:401,json:async()=>({error:{code:secret,message:secret}})});assert.ok(!unknown.message.includes(secret));
 const malformed=await diagnose({apiKey:' "sk-test***" ',model:'test-model',fetchImpl:async()=>rejected});
 for(const key of ['outerWhitespace','containsWhitespace','containsQuotes','containsMaskCharacters'])assert.equal(malformed.diagnostic.configuration[key],true);
 const good=await diagnose({apiKey:secret,model:'test-model',fetchImpl:async()=>({ok:true,status:200,json:async()=>({data:[{id:'test-model'}]})})});assert.equal(good.diagnostic.authenticated,true);assert.equal(good.diagnostic.modelListed,true);
 const restricted=await diagnose({apiKey:secret,fetchImpl:async()=>({ok:false,status:403,json:async()=>({})})});assert.equal(restricted.diagnostic.authenticated,null);
 const offline=await diagnose({apiKey:secret,fetchImpl:async()=>{throw Error(secret);}});assert.equal(offline.diagnostic.authenticated,null);assert.ok(!JSON.stringify(offline).includes(secret));
 console.log('Passed: read-only diagnostics, no generation request, malformed-paste flags, authentication versus permissions, model visibility, and secret redaction including provider errors.');
})().catch(e=>{console.error(e);process.exitCode=1;});
