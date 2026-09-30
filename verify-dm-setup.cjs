const assert=require('node:assert/strict');
const {checkSetup}=require('./check-dm-setup.cjs');
const config={apiKey:'sk-test-only-not-a-real-key',model:'test-model'};
(async()=>{
 let calls=0;
 const fail=status=>async()=>{calls++;return {ok:false,status,json:async()=>({error:{code:status===401?'invalid_api_key':'other',message:'NEVER LOG '+config.apiKey}})};};
 for(const apiKey of ['', 'key name', 'sk-***', 'sk-space key'])assert.equal((await checkSetup({...config,apiKey,fetchImpl:fail(401)})).kind,'format');
 assert.equal(calls,0);
 for(const [status,kind] of [[401,'authentication'],[403,'permission'],[429,'limit'],[404,'model']]){const result=await checkSetup({...config,fetchImpl:fail(status)});assert.equal(result.ok,false);assert.equal(result.kind,kind);assert.ok(!JSON.stringify(result).includes(config.apiKey));}
 const network=await checkSetup({...config,fetchImpl:async()=>{throw Error('network '+config.apiKey)}});assert.equal(network.kind,'connection');assert.ok(!JSON.stringify(network).includes(config.apiKey));
 const verified=await checkSetup({...config,fetchImpl:async(url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(JSON.parse(options.body).store,false);
  return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({narration:'The Dungeon Master is ready.',actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null})}]}]})};
 }});assert.equal(verified.ok,true);
 console.log('Passed: private setup format checks, authentication/permission/limit/model distinctions, secret-safe errors, and successful live-reply validation. Mocked provider; no paid calls.');
})().catch(e=>{console.error(e);process.exitCode=1;});
