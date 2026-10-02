const assert=require('node:assert/strict');
const {generate,createServer,validRequest}=require('./dm-server.cjs');
const body={input:'I return to the inn.',context:{choices:[{id:'travel-inn',label:'Travel to inn'}]}};
const success=reply=>async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');const request=JSON.parse(options.body);assert.equal(request.store,false);assert.equal(request.text.format.strict,true);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(reply)}]}]})};};
(async()=>{
 assert.ok(validRequest(body));assert.equal(validRequest({...body,input:''}),false);
 const reply=await generate(body,{apiKey:'test-only',model:'test-model',fetchImpl:success({narration:'The road leads back to the inn. Shall we go?',actionId:'travel-inn'})});assert.equal(reply.actionId,'travel-inn');
 await assert.rejects(generate(body,{apiKey:'test-only',model:'test-model',fetchImpl:success({narration:'You gain 900 gold.',actionId:'invent-gold'})}));
 await assert.rejects(generate(body,{apiKey:'test-only',model:'test-model',fetchImpl:async()=>({ok:false,status:429})}),/usage limit/);
 await assert.rejects(generate(body,{apiKey:'test-only',model:'test-model',fetchImpl:async()=>({ok:true,json:async()=>({status:'incomplete'})})}),/incomplete/);
 const adjudication={...body,context:{...body.context,pendingSpell:{id:'acid-splash'}}};
 const valid={decision:'cast',note:'Adjudicated save and four acid damage.',damage:4,selfDamage:0,healing:0,temporaryHP:0};
 const ruled=await generate(adjudication,{apiKey:'test-only',model:'test-model',fetchImpl:success({narration:'Acid splashes the keeper.',actionId:null,ruling:valid,worldEvent:'The keeper is angry.',castCommand:null})});assert.equal(ruled.ruling.damage,4);
 await assert.rejects(generate(body,{apiKey:'test-only',model:'test-model',fetchImpl:success({narration:'Invalid unsolicited ruling.',actionId:null,ruling:valid})}),/invalid ruling/);
 await assert.rejects(generate(adjudication,{apiKey:'test-only',model:'test-model',fetchImpl:success({narration:'Invalid damage.',actionId:null,ruling:{...valid,damage:-2}})}),/invalid ruling/);
 await assert.rejects(generate(adjudication,{apiKey:'test-only',model:'test-model',fetchImpl:success({narration:'Ambiguous.',actionId:'travel-inn',ruling:valid})}),/invalid ruling/);
 const server=createServer({apiKey:'',model:''});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal((await (await fetch(url+'/health')).json()).ready,false);
  const missing=await fetch(url+'/dm',{method:'POST',headers:{Origin:'http://localhost:8082','Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(missing.status,503);
  const denied=await fetch(url+'/dm',{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(denied.status,403);
 }finally{await new Promise(resolve=>server.close(resolve));}
 const live=createServer({apiKey:'test-only',model:'test-model',fetchImpl:success({narration:'The keeper waits by the hearth.',actionId:null})});await new Promise(resolve=>live.listen(0,'127.0.0.1',resolve));
 try{const response=await fetch('http://127.0.0.1:'+live.address().port+'/dm',{method:'POST',headers:{Origin:'http://localhost:8082','Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,200);const answered=await response.json();
  // The player asked to return to the inn and the stand-in model would not: asked twice, then the game sets out itself (dm-intent.cjs).
  assert.equal(answered.actionId,'travel-inn');assert.equal(answered.narration,'You set out for inn.');}finally{await new Promise(resolve=>live.close(resolve));}
 // Several players share the DM: two replies are written at once, the next waits its turn, overflow is told to retry.
 let inFlight=0,peak=0;const gates=[];
 const slow=async(url,options)=>{inFlight++;peak=Math.max(peak,inFlight);await new Promise(resolve=>gates.push(resolve));inFlight--;return success({narration:'Your turn comes.',actionId:null})(url,options);};
 const shared=createServer({apiKey:'test-only',model:'test-model',fetchImpl:slow,concurrency:2,queueLimit:1});await new Promise(resolve=>shared.listen(0,'127.0.0.1',resolve));
 try{
  const ask=()=>fetch('http://127.0.0.1:'+shared.address().port+'/dm',{method:'POST',headers:{Origin:'http://localhost:8081','Content-Type':'application/json'},body:JSON.stringify(body)});
  const first=[ask(),ask(),ask()];await new Promise(resolve=>setTimeout(resolve,150));
  const overflow=await ask();assert.equal(overflow.status,429);assert.match((await overflow.json()).error,/busy with other players/);
  assert.equal(inFlight,2,'Two replies in progress, one waiting');
  while(gates.length||inFlight){gates.shift()?.();await new Promise(resolve=>setTimeout(resolve,40));}
  for(const response of await Promise.all(first))assert.equal(response.status,200);
  assert.equal(peak,2,'Never more than the concurrency limit at once');
 }finally{await new Promise(resolve=>shared.close(resolve));}
 console.log('Passed: AI request/response schema, unknown actions, incomplete replies, provider limits, missing configuration, origin protection, mocked HTTP round trip, and a shared DM queue (concurrency limit, waiting turn, overflow). No paid calls made.');
})().catch(e=>{console.error(e);process.exitCode=1;});
