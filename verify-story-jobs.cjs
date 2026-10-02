const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// A story is written in the background: asked for once with a job id, then asked after every few seconds, so the
// story writer can think for minutes (the host's choice of effort) without any request waiting long.
const {createStoryJobs,jobIdOk,revision}=require('./story-jobs.cjs');
const {generate,storyEffort,questInstructions}=require('./dm-server.cjs');
const c=vm.runInNewContext(fs.readFileSync('dmConnection.js','utf8').replace(/export /g,'')+'\n({askDm,writeStory})',{fetch,AbortSignal,TextDecoder,setTimeout,Date,Math});
const tick=(ms=5)=>new Promise(resolve=>setTimeout(resolve,ms));
const story={title:'T',premise:'P',opening:'O',objective:'J',resolution:'R',secret:'S',foe:'Bog hag',foeSpecies:'Hag',foeAppearance:'A bent green crone with river weed for hair.',locations:{inn:{name:'A',description:'a'},bridge:{name:'B',description:'b'},tower:{name:'C',description:'c'}},npcs:{keeper:{name:'Ivo',species:'Human',role:'r',motive:'m',appearance:'A tall man with a grey beard and a limp.',personality:'Gruff, slow to trust, quick to laugh.',ties:{other:'friend',foe:'enemy',note:'n'}},mara:{name:'Sera',species:'Elf',role:'r',motive:'m',appearance:'A slight elf with ink on her hands and a red scarf.',personality:'Curious and precise, always counting.',ties:{other:'friend',foe:'neutral',note:'n'}}}};
(async()=>{
 // ---- The job store ----
 assert.equal(revision,1);assert.ok(jobIdOk('abcdefghijklmnop'));assert.ok(!jobIdOk('short'));assert.ok(!jobIdOk('has spaces in it, sixteen'));assert.ok(!jobIdOk(42));
 let clock=1000;const jobs=createStoryJobs({now:()=>clock});
 assert.equal(jobs.start('bad id',()=>1).status,'failed');assert.equal(jobs.poll('nobody-knows-this-job').status,'unknown');
 let release,runs=0;const slow=()=>{runs++;return new Promise(resolve=>{release=resolve;});};
 assert.deepEqual(jobs.start('job-aaaaaaaaaaaaaaaa',slow),{status:'pending'});await tick();assert.deepEqual(jobs.poll('job-aaaaaaaaaaaaaaaa'),{status:'pending'});
 assert.deepEqual(jobs.start('job-aaaaaaaaaaaaaaaa',slow),{status:'pending'},'Asking again does not start it twice');await tick();assert.equal(runs,1);
 release({story:{title:'Done'}});await tick();assert.deepEqual(jobs.poll('job-aaaaaaaaaaaaaaaa'),{status:'ready',result:{story:{title:'Done'}}});
 assert.equal(jobs.start('job-aaaaaaaaaaaaaaaa',slow).status,'ready');
 jobs.start('job-bbbbbbbbbbbbbbbb',()=>{throw Error('The new characters need distinct identities.');});await tick();assert.deepEqual(jobs.poll('job-bbbbbbbbbbbbbbbb'),{status:'failed',error:'The new characters need distinct identities.'});
 jobs.start('job-cccccccccccccccc',()=>Promise.reject(Object.assign(Error('aborted'),{name:'TimeoutError'})));await tick();assert.match(jobs.poll('job-cccccccccccccccc').error,/took too long to write/);
 // A few tales at once; a fifth is asked to come back.
 for(let i=0;i<4;i++)assert.equal(jobs.start('job-pending-number-'+i,()=>new Promise(()=>{})).status,'pending');
 assert.match(jobs.start('job-one-too-many-now',()=>1).error,/busy with other tales/);
 // Old jobs are forgotten after a quarter of an hour.
 clock+=16*60*1000;jobs.start('job-dddddddddddddddd',()=>1);await tick();assert.equal(jobs.poll('job-aaaaaaaaaaaaaaaa').status,'unknown');assert.equal(jobs.poll('job-dddddddddddddddd').status,'ready');
 // ---- The story writer's effort ----
 assert.equal(storyEffort('medium',()=>'high'),'high');assert.equal(storyEffort('medium',()=>'banana'),'medium');assert.equal(storyEffort('medium',()=>null),'medium');assert.equal(storyEffort('low',()=>'xhigh'),'xhigh');
 // ---- The Dungeon Master service: start, ask after, done ----
 let request=null,calls=0;const storyFetch=async(url,options)=>{calls++;request=JSON.parse(options.body);assert.ok(options.signal,'The request can be given up on');return {ok:true,json:async()=>({status:'completed',usage:{},output:[{content:[{type:'output_text',text:JSON.stringify(story)}]}]})};};
 const keys={apiKey:'k',model:'gpt-6-luna',storyReasoning:'high',fetchImpl:storyFetch};
 const ask=(context,input='Create a fresh adventure.')=>generate({input,context:{choices:[],...context}},keys);
 const started=await ask({mode:'adventure',introId:'crown',job:'verify-job-000000000001'});assert.deepEqual(started,{status:'pending'});
 await tick();
 const done=await ask({mode:'art',storyJob:'verify-job-000000000001'},'Is the story ready?');assert.equal(done.status,'ready');assert.equal(done.result.story.title,'T');assert.equal(done.result.story.status,'active');
 assert.deepEqual(request.reasoning,{effort:'high'},'In the background the writer thinks as hard as the host chose');assert.equal(request.max_output_tokens,40000);assert.equal(calls,1);
 assert.equal((await ask({mode:'art',storyJob:'verify-job-never-started'})).status,'unknown');
 assert.equal((await ask({mode:'adventure',introId:'crown',job:'no'})).status,'failed','A malformed job id is refused');
 // A browser on an earlier build waits on one request: light thinking, so the tale arrives in time.
 const direct=await ask({mode:'adventure',introId:'crown'});assert.equal(direct.story.title,'T');assert.deepEqual(request.reasoning,{effort:'low'});
 await generate({input:'Create',context:{mode:'adventure',introId:'crown',choices:[]}},{...keys,storyReasoning:'none'});assert.deepEqual(request.reasoning,{effort:'none'});
 // A failed tale says why.
 const bad=async(url,options)=>({ok:true,json:async()=>({status:'incomplete',output:[]})});
 await generate({input:'Create',context:{mode:'adventure',introId:'crown',choices:[],job:'verify-job-000000000002'}},{...keys,fetchImpl:bad});await tick();
 assert.match((await ask({mode:'art',storyJob:'verify-job-000000000002'})).error,/incomplete/);
 // ---- The Dungeon Master is told how a long tale is run ----
 assert.match(questInstructions,/THE LONG TALE:/);assert.match(questInstructions,/story-advance/);assert.match(questInstructions,/lead-done/);assert.match(questInstructions,/a chapter takes many turns/);
 let turnRequest=null;await generate({input:'I look around.',context:{choices:[]}},{apiKey:'k',model:'m',fetchImpl:async(url,options)=>{turnRequest=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({narration:'You look.',dialogue:[],recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null,rewind:null})}]}]})};}});
 assert.ok(turnRequest.instructions.includes(questInstructions));
 // ---- A greeting that comes back as spoken words alone is whole ----
 const greet=reply=>generate({input:'You turn to Yarro Keth.',context:{choices:[],conversationParticipants:[{id:'keeper',name:'Nemi Rusk'},{id:'mara',name:'Yarro Keth'}],sceneTrigger:{id:'greet:mara',cue:'Only Yarro Keth speaks.'}}},{apiKey:'k',model:'m',fetchImpl:async(url,options)=>{turnRequest=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null,rewind:null,...reply})}]}]})};}});
 const hello=await greet({narration:'',dialogue:[{speakerId:'mara',text:'You have the look of someone who reads marks. Good.'}]});
 assert.equal(hello.narration,'Yarro Keth looks up.');assert.equal(hello.dialogue[0].text,'You have the look of someone who reads marks. Good.');
 assert.match(turnRequest.instructions,/never empty, never the spoken words/);
 await assert.rejects(()=>greet({narration:'',dialogue:[]}),/invalid response/,'Nothing said and nothing told is still refused');
 // ---- The game's side: ask once, then ask after it ----
 const sent=[];let gate=null;
 const service=(over={})=>async(url,options)=>{const body=JSON.parse(options.body);sent.push(body);const reply=over.reply?await over.reply(body):await generate(body,{...keys,fetchImpl:async(u,o)=>{if(gate)await gate;return storyFetch(u,o);}});return {ok:true,status:200,headers:{get:()=>'application/json'},json:async()=>reply};};
 const payload={input:'Create a fresh adventure for my character.',context:{mode:'adventure',introId:'crown',choices:[],player:{name:'Vex'}}};
 let open;gate=new Promise(resolve=>{open=resolve;});let pauses=0;
 const written=await c.writeStory('http://dm',payload,{fetchImpl:service(),pause:async()=>{pauses++;if(pauses===2)open();await tick();},every:1});
 assert.equal(written.ok,true);assert.equal(written.body.story.title,'T');
 assert.match(sent[0].context.job,/^[a-z0-9]{24}$/);assert.equal(sent[0].context.player.name,'Vex');assert.ok(pauses>=2,'It waited and asked again');
 assert.ok(sent.slice(1).every(b=>b.context.mode==='art'&&b.context.storyJob===sent[0].context.job&&Array.isArray(b.context.choices)),'Asking after a story is a quick question, like asking after a picture');
 gate=null;
 // A Dungeon Master from before this answers the first request with the story itself.
 sent.length=0;const old=await c.writeStory('http://dm',payload,{fetchImpl:service({reply:async()=>({story:{title:'Old way'}})}),pause:async()=>{}});assert.equal(old.body.story.title,'Old way');assert.equal(sent.length,1);
 // Failure, a restart meanwhile, and a refusal are reported plainly.
 const failed=await c.writeStory('http://dm',payload,{fetchImpl:service({reply:async b=>b.context.job?{status:'pending'}:{status:'failed',error:'The story writer is busy with other tales.'}}),pause:async()=>{}});assert.equal(failed.ok,false);assert.match(failed.body.error,/busy with other tales/);
 const lost=await c.writeStory('http://dm',payload,{fetchImpl:service({reply:async b=>b.context.job?{status:'pending'}:{status:'unknown'}}),pause:async()=>{}});assert.equal(lost.ok,false);assert.match(lost.body.error,/restarted while writing/);
 const refused=await c.writeStory('http://dm',payload,{fetchImpl:async()=>({ok:false,status:503,headers:{get:()=>'application/json'},json:async()=>({error:'Live AI is not configured yet.'})}),pause:async()=>{}});assert.equal(refused.ok,false);assert.match(refused.body.error,/not configured/);
 // A dropped connection while waiting is asked again; a tale that never comes is given up on.
 let n=0;const flaky=await c.writeStory('http://dm',payload,{fetchImpl:async(url,options)=>{const b=JSON.parse(options.body);if(b.context.job)return {ok:true,status:200,headers:{get:()=>'application/json'},json:async()=>({status:'pending'})};if(++n<4)throw Error('network');return {ok:true,status:200,headers:{get:()=>'application/json'},json:async()=>({status:'ready',result:{story:{title:'Came through'}}})};},pause:async()=>{}});assert.equal(flaky.body.story.title,'Came through');
 let time=0;const never=await c.writeStory('http://dm',payload,{fetchImpl:service({reply:async()=>({status:'pending'})}),pause:async()=>{time+=30000;},now:()=>time});assert.equal(never.ok,false);assert.equal(never.status,504);assert.match(never.body.error,/taking too long/);
 const dead=await c.writeStory('http://dm',payload,{fetchImpl:async(url,options)=>{if(JSON.parse(options.body).context.job)return {ok:true,status:200,headers:{get:()=>'application/json'},json:async()=>({status:'pending'})};throw Error('network');},pause:async()=>{}});assert.equal(dead.ok,false);assert.match(dead.body.error,/stopped answering/);
 console.log('Passed: a story is started once and asked after (never started twice, a few at a time, forgotten after a quarter of an hour, failures told plainly); in the background the story writer thinks as hard as the host chose with room to do it, while a browser on an earlier build gets a quick tale in one request; the Dungeon Master is told how a long tale is run; and the game asks once, waits, survives dropped connections and gives up on a tale that never comes.');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
