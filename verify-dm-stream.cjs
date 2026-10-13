const assert=require('node:assert/strict'),http=require('node:http');
// The Dungeon Master's telling is held to the game's numbers (a wrong HP figure in narration is softened, a right one
// kept), and a game turn can be streamed: the narration arrives as it is written, then the checked reply.
const server=require(process.env.QB_DM??'./dm-server.cjs'),{checkedHp,partialNarration,generate,createServer}=server;
const ctx={player:{health:{current:9,temp:0}},enemyHP:7,encounter:{currentHP:7,maximum:16},engineResolved:['You use Greatsword: d20 [15] + 5 = 20 vs AC 12. Hit.','11 slashing damage (4 + 4 + 3).']};
const cases=[
 ['The bandit staggers, down to 3 HP.','The bandit staggers, badly hurt.'],
 ['The bandit is down to 7 HP.','The bandit is down to 7 HP.'],
 ['You are left with 4 HP.','You are badly wounded.'],
 ['The wolf (5 HP left) circles you.','The wolf circles you.'],
 ['The wolf (7 HP left) circles you.','The wolf (7 HP left) circles you.'],
 ['A healing draught restores 2d4+2 HP.','A healing draught restores 2d4+2 HP.'],
 ['It drops to 2 HP and howls.','It is badly hurt and howls.'],
 ['The cut leaves him with only 2 hit points remaining.','The cut leaves him with only 2 hit points remaining.'.replace('with only 2 hit points remaining','badly wounded')],
 ['You strike for 11 damage.','You strike for 11 damage.'],
 ['You are back up to 4 HP now.','You are back up now.'],
 ['You sit at 3 HP, shaking.','You sit wounded, shaking.'],
 ['You are at 9 HP.','You are at 9 HP.'],
];
for(const [said,want] of cases)assert.equal(checkedHp(said,ctx),want,said);
// Hit points part-way through a turn are real too: healed from 5 to 11, then struck down to 7.
const mid={player:{health:{current:7,temp:0}},turnStart:{hp:5,max:12},engineResolved:['Second Wind: 5 + 1; restored 6 HP.','1d6 [3] + 1 = 4 Slashing damage. 4 damage recorded: 0 absorbed by temporary HP, 4 HP lost.']};
assert.equal(checkedHp('You regain 6 hit points, leaving you at 11 HP, then the blade leaves you at 7 HP.',mid),'You regain 6 hit points, leaving you at 11 HP, then the blade leaves you at 7 HP.');
assert.equal(checkedHp('You regain 6 hit points, leaving you at 10 HP.',mid),'You regain 6 hit points, leaving you wounded.');
assert.equal(partialNarration('{"narration":"The blade \\"sings\\"\\nand the'),'The blade "sings"\nand the');
assert.equal(partialNarration('{"narr'),'');
// A streamed answer from the AI service: Server-Sent Events carrying the JSON reply in pieces.
const reply={narration:'Steel rings. The bandit, down to 3 HP, backs away.',dialogue:[],recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null};
const json=JSON.stringify(reply),pieces=[];for(let i=0;i<json.length;i+=9)pieces.push(json.slice(i,i+9));
const sse=[...pieces.map(delta=>'event: response.output_text.delta\ndata: '+JSON.stringify({type:'response.output_text.delta',delta})+'\n\n'),'event: response.completed\ndata: '+JSON.stringify({type:'response.completed',response:{status:'completed',output:[{content:[{type:'output_text',text:json}]}]}})+'\n\n'];
let sent=null;const streamFetch=async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:json}]}]}),body:(async function*(){for(const s of sse){yield Buffer.from(s.slice(0,7));yield Buffer.from(s.slice(7));}})()};};
const body={input:'I swing at the bandit.',context:{choices:[],stage:'combat',...ctx}};
(async()=>{
 const seen=[];const out=await generate(body,{apiKey:'k',model:'m',fetchImpl:streamFetch,onNarration:t=>seen.push(t)});
 assert.equal(sent.stream,true);assert.ok(seen.length>=2,'Narration arrives in pieces');assert.ok(seen.every(t=>!/3 HP/.test(t)),'Partial narration is checked too');assert.ok(seen.every((t,i)=>i===0||t.startsWith(seen[i-1].slice(0,10))));
 assert.equal(out.narration,'Steel rings. The bandit, badly hurt, backs away.','The final reply is checked');
 // Without a listener nothing is streamed (older servers call generate this way).
 const plain=await generate(body,{apiKey:'k',model:'m',fetchImpl:async(u,o)=>{sent=JSON.parse(o.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:json}]}]})};}});
 assert.equal(sent.stream,undefined);assert.equal(plain.narration,'Steel rings. The bandit, badly hurt, backs away.');
 // A streamed reply cut short by the output limit is asked again with more room; cut short every time, the narration
 // written in full is told on its own and nothing else is applied (a parse failure never reaches the player).
 const cutStream=(text,whole)=>({ok:true,body:(async function*(){for(let i=0;i<text.length;i+=9)yield Buffer.from('data: '+JSON.stringify({type:'response.output_text.delta',delta:text.slice(i,i+9)})+'\n\n');yield Buffer.from('data: '+JSON.stringify(whole?{type:'response.completed',response:{status:'completed',output:[{content:[{type:'output_text',text}]}]}}:{type:'response.incomplete',response:{status:'incomplete',incomplete_details:{reason:'max_output_tokens'},usage:{input_tokens:5,output_tokens:3000}}})+'\n\n');})()});
 let rooms=[];
 const again=await generate(body,{apiKey:'k',model:'m',onNarration:()=>{},fetchImpl:async(u,o)=>{rooms.push(JSON.parse(o.body).max_output_tokens);return rooms.length===1?cutStream(json.slice(0,40),false):cutStream(json,true);}});
 assert.deepEqual(rooms,[3000,6000],'more room after a cut-short reply');assert.equal(again.narration,'Steel rings. The bandit, badly hurt, backs away.');
 rooms=[];const drafts=[];
 const kept=await generate(body,{apiKey:'k',model:'m',onNarration:t=>drafts.push(t),fetchImpl:async(u,o)=>{rooms.push(JSON.parse(o.body).max_output_tokens);return cutStream(json.slice(0,json.indexOf('"dialogue"')+5),false);}});
 assert.equal(rooms.length,3,'two quiet attempts after the first');assert.equal(kept.narration,'Steel rings. The bandit, badly hurt, backs away.');assert.equal(kept.actionId,null);assert.ok(drafts.length>=3,'the draft is shown while each attempt is written');
 await assert.rejects(generate(body,{apiKey:'k',model:'m',onNarration:()=>{},fetchImpl:async()=>cutStream('{"narration":"Steel ri',false)}),/could not be used this time/,'nothing usable: a calm error');
 // Through the HTTP service: NDJSON lines when asked, plain JSON otherwise.
 const srv=createServer({apiKey:'k',model:'m',fetchImpl:streamFetch});await new Promise(r=>srv.listen(0,'127.0.0.1',r));const port=srv.address().port;
 const post=payload=>new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port,path:'/dm',method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:8081'}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve({status:res.statusCode,type:res.headers['content-type'],data}));});req.on('error',reject);req.end(JSON.stringify(payload));});
 const streamed=await post({...body,stream:true});
 assert.equal(streamed.status,200);assert.match(streamed.type,/ndjson/);
 const lines=streamed.data.trim().split('\n').map(l=>JSON.parse(l));assert.ok(lines.length>=3);assert.ok(lines.slice(0,-1).every(l=>typeof l.narration==='string'));assert.equal(lines.at(-1).reply.narration,'Steel rings. The bandit, badly hurt, backs away.');
 const whole=await post(body);assert.match(whole.type,/application\/json/);assert.equal(JSON.parse(whole.data).narration,'Steel rings. The bandit, badly hurt, backs away.');
 srv.close();
 // ---- Long requests (a tale, a ready journey, a story job) are streamed ----
 // Node's own fetch gives up on headers that take 300 s and on a body silent for 300 s; the first ready journey was cut
 // off that way on 2026-10-13. A tale is now asked for as a stream and read from its events (ai-request.cjs longResponse).
 const ai=require('./ai-request.cjs'),{generateAdventure}=require('./adventure-generator.cjs'),{journeyStory,journeyPitch}=require('./journey-fixtures.cjs');
 const enc=new TextEncoder(),sseText=events=>events.map(e=>'event: '+e.type+'\ndata: '+JSON.stringify(e)+'\n\n').join('');
 // A stand-in provider streaming its events in uneven pieces (events split across pieces), with an optional silence
 // part-way (as while the writer thinks) that the request's own timeout can end.
 const provider=(events,{gap=0}={})=>{const f=async(url,o)=>{f.sent.push(JSON.parse(o.body));f.options.push(o);const parts=sseText(events).match(/[\s\S]{1,97}/g);let i=0;return new Response(new ReadableStream({async pull(c){if(i>=parts.length)return c.close();if(gap&&i===2)await new Promise((resolve,reject)=>{const t=setTimeout(resolve,gap);o.signal?.addEventListener('abort',()=>{clearTimeout(t);reject(o.signal.reason);});});c.enqueue(enc.encode(parts[i++]));}}),{status:200,headers:{'content-type':'text/event-stream'}});};f.sent=[];f.options=[];return f;};
 const tale=JSON.stringify({...journeyStory(0),pitch:journeyPitch(0)}),deltas=t=>t.match(/[\s\S]{1,150}/g).map(delta=>({type:'response.output_text.delta',delta}));
 const used={input_tokens:5200,output_tokens:21000,output_tokens_details:{reasoning_tokens:18000}},opening=[{type:'response.created',response:{status:'in_progress'}},{type:'response.in_progress',response:{status:'in_progress'}}];
 const journeyAsk={input:'x',context:{mode:'adventure',introId:'easy',ahead:true,libraryBrief:{seed:'a salt town',terrain:'coast',mood:{id:'mystery',label:'Mystery',steer:'a puzzle with clues'},others:[]},choices:[]}};
 const write=(fetchImpl,more={})=>generateAdventure(journeyAsk,{apiKey:'k',model:'gpt-6-luna',reasoning:'high',timeout:20000,fetchImpl,...more});
 const counted=[],writer=provider([...opening,{type:'response.reasoning_summary_text.delta',delta:'Weighing the marsh.'},...deltas(tale),{type:'response.completed',response:{status:'completed',output:[],usage:used}}],{gap:1200});
 const began=Date.now(),written=await write(writer,{onUsage:u=>counted.push(u)});
 assert.ok(Date.now()-began>=1100,'a long silence while the writer thinks is waited out');
 assert.equal(writer.sent[0].stream,true,'a tale is asked for as a stream');assert.equal(writer.sent[0].max_output_tokens,40000);assert.ok(writer.options[0].signal,'bounded by the caller\'s own timeout');
 assert.equal(written.story.title,'The Reed Crown','the tale is put together from the deltas');assert.equal(written.pitch.hook,journeyPitch(0).hook,'its pitch too');
 assert.deepEqual(counted,[used],'its cost is counted once, from the final event');
 // The final event's own output is used when it carries one.
 assert.equal((await write(provider([...opening,{type:'response.completed',response:{status:'completed',output:[{type:'message',content:[{type:'output_text',text:tale}]}],usage:used}}]))).story.title,'The Reed Crown');
 // A provider (or a fake) answering plain JSON is still read.
 assert.equal((await write(async()=>({ok:true,json:async()=>({status:'completed',usage:used,output:[{content:[{type:'output_text',text:tale}]}]})}))).story.title,'The Reed Crown');
 // Failures: each with a mechanical kind for the diagnostics, its cost counted when the provider reports one.
 const fails=async(fetchImpl,kind,message,more={})=>{const cost=[];let caught=null;await write(fetchImpl,{onUsage:u=>cost.push(u),...more}).catch(e=>{caught=e;});assert.ok(caught,kind+' fails');assert.equal(caught.kind,kind,kind);assert.match(caught.message,message,kind);return {error:caught,cost,note:ai.requestFailure(caught)};};
 {const {cost,note}=await fails(provider([...opening,...deltas(tale.slice(0,600)),{type:'response.incomplete',response:{status:'incomplete',incomplete_details:{reason:'max_output_tokens'},usage:used}}]),'incomplete',/incomplete\. Your existing save is unchanged/);
  assert.deepEqual(cost,[used],'a tale cut short is still counted');assert.equal(note.failure,'incomplete');assert.equal(note.reason,'max_output_tokens');assert.ok(Number.isFinite(note.seconds));}
 {const {note}=await fails(provider([...opening,{type:'response.failed',response:{status:'failed',error:{code:'server_error',message:'Something went wrong on our side (secret words).'},usage:used}}]),'failed',/incomplete/);assert.deepEqual([note.failure,note.reason],['failed','server_error']);assert.ok(!JSON.stringify(note).includes('secret'),'never the provider\'s words');}
 {const {note}=await fails(provider([...opening,{type:'error',code:'rate_limit_exceeded',message:'Slow down.'}]),'failed',/incomplete/);assert.equal(note.reason,'rate_limit_exceeded');}
 await fails(provider([...opening,...deltas(tale.slice(0,600))]),'cut-off',/incomplete/);
 await fails(provider([...opening,{type:'response.refusal.delta',delta:'I can\'t help with that.'},{type:'response.completed',response:{status:'completed',output:[],usage:used}}]),'refused',/declined to write that/);
 await fails(provider([...opening,{type:'response.output_text.delta',delta:'Once upon a time, with no JSON at all.'},{type:'response.completed',response:{status:'completed',output:[],usage:used}}]),'invalid-json',/did not return a usable reply/);
 {const {note}=await fails(async()=>new Response(JSON.stringify({error:{code:'insufficient_quota',message:'You exceeded your quota (account words).'}}),{status:429,headers:{'content-type':'application/json'}}),'http',/AI usage limit reached\. HTTP 429; code: insufficient_quota/);assert.deepEqual([note.failure,note.status,note.code],['http',429,'insufficient_quota']);}
 {const {note}=await fails(provider([...opening,...deltas(tale),{type:'response.completed',response:{status:'completed',output:[],usage:used}}],{gap:1500}),'timeout',/./,{timeout:300});assert.equal(note.failure,'timeout');assert.equal(note.status,undefined);}
 {const broken=JSON.parse(tale);broken.npcs.mara.name=broken.npcs.keeper.name;await fails(provider([...opening,...deltas(JSON.stringify(broken)),{type:'response.completed',response:{status:'completed',output:[],usage:used}}]),'invalid-story',/distinct identities/);}
 await fails(async()=>{throw new TypeError('fetch failed');},'network',/fetch failed/);
 assert.deepEqual(ai.requestFailure(Object.assign(Error('the rules refused the tale'),{kind:'rejected'})),{failure:'rejected'});assert.deepEqual(ai.requestFailure(Error('who knows')),{failure:'other'});
 // The failure is written to the diagnostics with its kind only (live runs; never the words), and dm-report counts it.
 {const fsx=require('node:fs'),os=require('node:os'),path=require('node:path'),dir=fsx.mkdtempSync(path.join(os.tmpdir(),'questbound-stream-')),before=process.env.QUESTBOUND_DATA;
  process.env.QUESTBOUND_DATA=dir;
  server.recordWriteFailure('library',Object.assign(Error('The adventure generation was incomplete (provider words).'),{kind:'timeout',seconds:308}),true);
  server.recordWriteFailure('story-job',Object.assign(Error('x'),{kind:'http',status:500}),true,'account-0123456789abcdef');
  server.recordWriteFailure('library',Error('not live'),false);
  const notes=fsx.readFileSync(path.join(dir,'.questbound-diagnostics.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l));
  assert.equal(notes.length,2,'only live writes are noted');assert.deepEqual({...notes[0],at:0},{at:0,write:'library',failure:'timeout',seconds:308});assert.deepEqual({...notes[1],at:0},{at:0,guest:'account-0123456789abcdef',write:'story-job',failure:'http',status:500});
  const report=require('node:child_process').execFileSync(process.execPath,[path.join(__dirname,'dm-report.cjs')],{env:{...process.env,QUESTBOUND_DATA:dir},encoding:'utf8'});
  assert.match(report,/Background tales that failed: 2/);assert.match(report,/library: timeout/);assert.match(report,/story-job: http 500/);
  if(before===undefined)delete process.env.QUESTBOUND_DATA;else process.env.QUESTBOUND_DATA=before;fsx.rmSync(dir,{recursive:true,force:true});}
 // Node's own fetch honours the patient agent (here with short limits to show it), and a real streamed request through
 // it, with a silence part-way, completes.
 {const limited=await ai.patientDispatcher(fetch,300),patient=await ai.patientDispatcher(fetch);
  assert.ok(limited&&patient,'an agent of Node\'s own fetch can be made');assert.equal(await ai.patientDispatcher(fetch),patient,'made once');assert.equal(await ai.patientDispatcher(async()=>{}),null,'a stand-in fetch needs none');
  const slow=http.createServer((req,res)=>{let n=0;req.on('data',()=>{});req.on('end',()=>setTimeout(()=>{res.writeHead(200,{'content-type':'text/event-stream'});const events=sseText([...opening,...deltas(tale),{type:'response.completed',response:{status:'completed',output:[],usage:used}}]).match(/[\s\S]{1,4000}/g);const next=()=>{if(n>=events.length)return res.end();res.write(events[n++]);setTimeout(next,n===1?700:5);};next();},1600));});
  await new Promise(r=>slow.listen(0,'127.0.0.1',r));const local='http://127.0.0.1:'+slow.address().port+'/';
  await assert.rejects(fetch(local,{method:'POST',body:'{}',dispatcher:limited}),e=>e.cause?.code==='UND_ERR_HEADERS_TIMEOUT','the agent\'s own header limit is the one that counts');
  const real=globalThis.fetch,seen=[];globalThis.fetch=(url,o)=>{seen.push(o.dispatcher);return real(local,o);};
  try{const viaReal=await generateAdventure(journeyAsk,{apiKey:'k',model:'gpt-6-luna',reasoning:'high',timeout:20000,fetchImpl:globalThis.fetch});assert.equal(viaReal.story.title,'The Reed Crown');}finally{globalThis.fetch=real;}
  assert.equal(seen[0],patient,'a live tale goes through the patient agent');slow.close();}
 console.log('Passed: wrong HP figures in the telling are softened and right ones kept, partial narration is read from the streamed reply, a streamed reply cut short is asked again with more room (its finished telling kept if nothing more comes), and turns stream as NDJSON (or arrive whole when not asked); a tale is asked for as a stream and put together from its events through a patient agent of Node\'s own fetch (silences waited out, cost counted, cut-short, failed, refused, unreadable, timed-out and HTTP failures each with a mechanical kind noted in the diagnostics).');
})().catch(e=>{console.error(e);process.exit(1);});
