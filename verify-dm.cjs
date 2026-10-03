const assert=require('node:assert/strict');
const {generate,createServer,validRequest,repairedJson,replyShape}=require('./dm-server.cjs');
const body={input:'I return to the inn.',context:{choices:[{id:'travel-inn',label:'Travel to inn'}]}};
const success=reply=>async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');const request=JSON.parse(options.body);assert.equal(request.store,false);assert.equal(request.text.format.strict,true);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(reply)}]}]})};};
(async()=>{
 assert.ok(validRequest(body));assert.equal(validRequest({...body,input:''}),false);
 const reply=await generate(body,{apiKey:'test-only',model:'test-model',fetchImpl:success({narration:'The road leads back to the inn. Shall we go?',actionId:'travel-inn'})});assert.equal(reply.actionId,'travel-inn');
 await assert.rejects(generate(body,{apiKey:'test-only',model:'test-model',fetchImpl:success({narration:'You gain 900 gold.',actionId:'invent-gold'})}));
 // A reply wrapped in markdown fences or prose is read anyway; prose alone is refused by its shape; a refusal is told apart.
 const raw=(text,items)=>async()=>({ok:true,json:async()=>({status:'completed',output:items??[{type:'message',content:[{type:'output_text',text}]}]})});
 const fenced=await generate(body,{apiKey:'test-only',model:'test-model',fetchImpl:raw('```json\n'+JSON.stringify({narration:'The inn is near.',actionId:'travel-inn'})+'\n```')});assert.equal(fenced.actionId,'travel-inn');
 const wrapped=await generate(body,{apiKey:'test-only',model:'test-model',fetchImpl:raw('Here is the reply: '+JSON.stringify({narration:'Back to the inn.',actionId:'travel-inn'})+' Enjoy.')});assert.equal(wrapped.actionId,'travel-inn');
 await assert.rejects(generate(body,{apiKey:'test-only',model:'test-model',fetchImpl:raw('The inn is that way.')}),/usable reply/);
 await assert.rejects(generate(body,{apiKey:'test-only',model:'test-model',fetchImpl:raw('',[{type:'message',content:[{type:'refusal',refusal:'no'}]}])}),/declined to answer/);
 assert.equal(repairedJson('[1,2]'),null);assert.equal(repairedJson('nonsense'),null);assert.deepEqual(repairedJson(' ```json {"a":1} ``` '),{a:1});
 const shape=replyShape('The inn is that way.',{status:'completed',output:[{type:'reasoning'},{type:'message',content:[{type:'output_text'}]}]});assert.deepEqual(shape,{length:20,start:'text',end:'text',items:['reasoning','message:output_text'],status:'completed',incomplete:null,refusal:false});
 await assert.rejects(generate(body,{apiKey:'test-only',model:'test-model',fetchImpl:async()=>({ok:false,status:429})}),/usage limit/);
 await assert.rejects(generate(body,{apiKey:'test-only',model:'test-model',fetchImpl:async()=>({ok:true,json:async()=>({status:'incomplete'})})}),/incomplete/);
 const adjudication={...body,context:{...body.context,pendingSpell:{id:'acid-splash'}}};
 const valid={decision:'cast',note:'Adjudicated save and four acid damage.',damage:4,selfDamage:0,healing:0,temporaryHP:0};
 const ruled=await generate(adjudication,{apiKey:'test-only',model:'test-model',fetchImpl:success({narration:'Acid splashes the keeper.',actionId:null,ruling:valid,worldEvent:'The keeper is angry.',castCommand:null})});assert.equal(ruled.ruling.damage,4);
 await assert.rejects(generate(body,{apiKey:'test-only',model:'test-model',fetchImpl:success({narration:'Invalid unsolicited ruling.',actionId:null,ruling:valid})}),/invalid ruling/);
 await assert.rejects(generate(adjudication,{apiKey:'test-only',model:'test-model',fetchImpl:success({narration:'Invalid damage.',actionId:null,ruling:{...valid,damage:-2}})}),/invalid ruling/);
 await assert.rejects(generate(adjudication,{apiKey:'test-only',model:'test-model',fetchImpl:success({narration:'Ambiguous.',actionId:'travel-inn',ruling:valid})}),/invalid ruling/);
 // Guests (requests the phone gateway labelled): OpenAI is told which guest asked and the host's requests carry no label;
 // only the host may check the AI connection; a guest past the host's daily allowance is refused before any call.
 const told=[],telling=reply=>async(url,options)=>{told.push(JSON.parse(options.body).safety_identifier??null);return success(reply)(url,options);};
 const guestBody={...body,guest:'0123456789abcdef0123456789abcdef'};
 await generate(guestBody,{apiKey:'test-only',model:'test-model',fetchImpl:telling({narration:'Back to the inn.',actionId:'travel-inn'}),spending:{check:()=>({ok:true})}});
 await generate(body,{apiKey:'test-only',model:'test-model',fetchImpl:telling({narration:'Back to the inn.',actionId:'travel-inn'})});
 assert.equal(JSON.stringify(told),JSON.stringify(['qb-guest-0123456789abcdef0123456789abcdef',null]));
 await assert.rejects(generate({...guestBody,context:{mode:'diagnostics',choices:[]}},{apiKey:'test-only',model:'test-model',fetchImpl:async()=>{throw Error('never asked');}}),e=>e.httpStatus===403);
 let asked=0;const usedUp='The host\'s daily allowance for the Dungeon Master is used up. Play resumes tomorrow; your adventure is unchanged.';
 await assert.rejects(generate(guestBody,{apiKey:'test-only',model:'test-model',fetchImpl:async()=>{asked++;throw Error('never asked');},spending:{check:()=>({ok:false,error:usedUp})}}),e=>e.httpStatus===503&&/allowance/.test(e.message));
 assert.equal(asked,0,'nothing is sent to OpenAI once the allowance is used up');
 assert.doesNotMatch(usedUp,/Please wait before asking|busy with other players/,'the game must not keep retrying a used-up allowance');
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
