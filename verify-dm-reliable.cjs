// A Dungeon Master turn that fails should be rare (the host, 2026-10-13: under 1 in 200, and never a parse failure in
// front of the player). This check drives whole turns through the campaign server's pipeline (server-turn.cjs: the
// real context, generate in dm-server.cjs, then the rules) with a stand-in provider that misbehaves the ways the live
// diagnostics showed (a reply sent twice, a reply cut short, a refusal, a join beside a journey, spoken lines with no
// telling, a spell denied that the rules allow, an unusable ruling, provider faults) and asserts each turn ends
// playable, with nothing invalid applied. It also checks every request schema is valid for strict structured output,
// and that dm-report.cjs reports the failure rate per 200 turns. No network, no AI, no logs written.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const r=require('./rules-engine.cjs').rules(),{resolveTurn}=require('./server-turn.cjs');
const {generate}=require('./dm-server.cjs');
const {generateCharacter}=require('./character-generator.cjs'),{generateAdventure}=require('./adventure-generator.cjs');
const seq=(s=11)=>()=>(s=(s*16807)%2147483647)/2147483647;
const full=o=>({narration:'',dialogue:[],recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null,rewind:null,fault:null,suggestions:[],...o});
const done=o=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:typeof o==='string'?o:JSON.stringify(full(o))}]}]});
const cut=text=>({status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[{type:'message',content:[{type:'output_text',text}]}]});
// The stand-in provider plays a script, one step per request (the last step repeats); every request is kept.
const schemas=[];
function provider(script){
 const calls=[];
 const fetchImpl=async(url,options)=>{
  const request=JSON.parse(options.body);calls.push(request);if(request.text?.format?.schema)schemas.push([request.text.format.name,request.text.format.schema]);
  const step=script[Math.min(calls.length-1,script.length-1)];
  if(step instanceof Error)throw step;
  if(step?.httpStatus)return {ok:false,status:step.httpStatus,headers:{get:()=>null},json:async()=>({error:{code:'server_error'}})};
  return {ok:true,json:async()=>step};
 };
 return {calls,fetchImpl};
}
const table=script=>{const p=provider(script);return {calls:p.calls,ask:body=>generate(body,{apiKey:'test-only',model:'test-model',fetchImpl:p.fetchImpl})};};
const wizard=r.readyHero('wizard'),start=r.newAdventure(wizard);
const inn=r.adventureSnapshot(wizard,{...start,map:{...start.map,accepted:true}},null,true);
const turn=async(script,request,snapshot=inn)=>{const t=table(script);const out=await resolveTurn(snapshot,request,{ask:t.ask,randomImpl:seq(7)});assert.ok(r.validAdventure(out.snapshot,wizard),'the turn leaves a valid adventure');return {out,calls:t.calls,game:out.snapshot.game};};
const playable=async(label,...args)=>{try{return await turn(...args);}catch(e){throw Error(label+': '+e.message);}};
const zero={damage:0,selfDamage:0,healing:0,temporaryHP:0};
(async()=>{
 // 1. A reply sent twice (two objects back to back in one item, or two output items): the first is read.
 {const twice=JSON.stringify(full({narration:'The fire pops.'}))+JSON.stringify(full({narration:'The fire pops again.'}));
  let t=await playable('two objects',[done(twice)],{question:'I warm my hands by the fire.'});assert.equal(t.out.narration,'The fire pops.');assert.equal(t.calls.length,1,'read at once, not asked again');
  t=await playable('two items',[{status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(full({narration:'Rain on the shutters.'}))}]},{type:'message',content:[{type:'output_text',text:JSON.stringify(full({narration:'Rain again.'}))}]}]}],{question:'I listen to the rain.'});
  assert.equal(t.out.narration,'Rain on the shutters.');assert.equal(t.calls.length,1);}
 // 1b. The provider writes each game effect as an item of effects: read as every effect in its own field. A choice id
 //     copied with the brackets the choices are listed in ("[travel-tower]") is that choice, and a telling given as
 //     null beside it is framed, without asking again (both seen in the diagnostics on 2026-10-21).
 {const id=r.dmChoices(wizard,inn.game,inn.health).map(c=>c.id).find(x=>/^travel-/.test(x));assert.ok(id,'a journey on offer');
  let t=await playable('effects list',[done(JSON.stringify({narration:'You set out.',dialogue:[],effects:[{actionId:id},{remember:{text:'The keeper owes you a favour.',about:['keeper'],settles:null}}],suggestions:[]})),done({narration:'You arrive.'})],{question:'I set out on the road.'});
  assert.equal(t.calls.length,2,'the journey and its telling');assert.equal(t.out.narration,'You arrive.');
  t=await playable('brackets',[done(JSON.stringify({narration:null,dialogue:[],effects:[{actionId:'['+id+']'}],suggestions:[]})),done({narration:'You arrive.'})],{question:'I set out on the road.'});
  assert.equal(t.calls.length,2,'mended in place: never asked again');assert.equal(t.out.narration,'You arrive.');}
 // 2. A reply cut short by the output limit is asked again with twice the room; cut short every time, a telling that
 //    was written in full is told on its own (nothing else applied).
 {let t=await playable('cut short once',[cut('{"narration":"The fire'),done({narration:'The fire burns low.'})],{question:'I watch the fire.'});
  assert.equal(t.out.narration,'The fire burns low.');assert.equal(t.calls.length,2);assert.equal(t.calls[0].max_output_tokens,3000);assert.equal(t.calls[1].max_output_tokens,6000,'more room after a cut-short reply');
  t=await playable('cut short always',[cut('{"narration":"The fire burns low.","dialogue":[{"speakerId":"ma')],{question:'I watch the fire.'});
  assert.equal(t.out.narration,'The fire burns low.');assert.equal(t.calls.length,3,'two quiet attempts after the first');assert.equal(t.calls[2].max_output_tokens,8000,'room grows to a ceiling');
  await assert.rejects(turn([cut('{"narr')],{question:'I watch the fire.'}),/could not be used this time/,'nothing usable: a calm error, never a parse failure');}
 // 3. A refusal is the model declining: told as such, never asked again.
 {const t=table([{status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'No.'}]}]}]);
  await assert.rejects(resolveTurn(inn,{question:'I warm my hands.'},{ask:t.ask,randomImpl:seq(7)}),/declined to answer/);assert.equal(t.calls.length,1);}
 // 4. Someone joins as the hero sets out (the diagnostics, 2026-10-10: a join with travel-p1, refused three times). The
 //    join is the turn and the journey waits for the next one; a decline beside the journey is dropped and the hero goes.
 {const joined=await playable('join beside travel',[done({narration:'Mara shoulders her pack and you set out together.',recruitment:[{npcId:'mara',decision:'join',reason:'She wants to see the bridge for herself.',terms:'',dc:null,class:null}],actionId:'travel-bridge'}),done({narration:'Mara falls in beside you.'})],{question:'Mara, come with me to the bridge.'});
  assert.equal(joined.calls.length,2,'the join, then its telling: never asked again for the journey');assert.equal(require('./dm-schemas.cjs').asFields(joined.calls[0].text.format.schema).properties.recruitment.maxItems>0,true);
  assert.equal(joined.game.stage,'inn','the journey waits for the next turn');assert.ok(!joined.game.map.visited.includes('bridge'));assert.equal(joined.out.narration,'Mara falls in beside you.');
  const went=await playable('decline beside travel',[done({narration:'Mara shakes her head; you go alone.',recruitment:[{npcId:'mara',decision:'decline',reason:'She has her own errand here.',terms:'',dc:null,class:null}],actionId:'travel-bridge'}),done({narration:'The bridge looms out of the mist.'})],{question:'Mara, come with me to the bridge.'});
  assert.notEqual(went.game.stage,'inn','the hero sets out');assert.ok(went.game.map.visited.includes('bridge'));}
 // 5. Spoken lines with no telling: on a scene cue (a greeting) and on an ordinary turn, the framing is supplied.
 {const greeted=await playable('greeting with no telling',[done({narration:'',dialogue:[{speakerId:'mara',text:'You have the look of someone who reads marks.'}]})],{greet:true,npcId:'mara'});
  assert.match(greeted.out.narration,/looks up\./);assert.equal(greeted.calls.length,1);
  const answered=await playable('answer with no telling',[done({narration:'',dialogue:[{speakerId:'mara',text:'Nothing good comes up that road.'}]})],{question:'Mara, what news from the road?'});
  assert.match(answered.out.narration,/looks up\./);assert.equal(answered.calls.length,1);
  const t=table([done({narration:'',dialogue:[]})]),stood=await resolveTurn(inn,{greet:true,npcId:'mara'},{ask:t.ask,randomImpl:seq(7)});
  assert.ok(stood.narration.trim()&&r.validAdventure(stood.snapshot,wizard),'a greeting the DM could not give falls back to the stand-in line');}
 // 6. A spell the rules allow, denied by the Dungeon Master (the diagnostics, 2026-10-03: Guiding Bolt "not prepared"):
 //    the rules decide, and the hero casts it. With a castingIssue the DM's refusal agrees with the rules and stands.
 {const denied=await playable('deny of a castable spell',[done({narration:'You cannot cast that.',ruling:{decision:'deny',note:'Detect Magic is not prepared.',...zero}}),done({narration:'A faint blue glow lingers on the keeper\'s ring.'})],{question:'Quietly, I use detect magic to sense the room.'});
  assert.equal(denied.calls.length,2);assert.equal(denied.game.concentration?.id,'detect-magic','the spell is cast by the rules');assert.match(JSON.stringify(denied.game.log),/Detect Magic/);
  const context=r.dmContext(wizard,inn.game,null,'x'),ask=async(input,extra,reply)=>{const p=provider([done(reply)]);return generate({input,context:{...context,...extra}},{apiKey:'test-only',model:'test-model',fetchImpl:p.fetchImpl});};
  const deny={narration:'The spell will not come.',ruling:{decision:'deny',note:'Not now.',...zero}};
  let reply=await ask('I use detect magic.',{castingIssue:'Name a target.'},deny);assert.equal(reply.ruling,null);assert.equal(reply.castCommand,null,'a castingIssue: the refusal stands');
  reply=await ask('I use detect magic.',{castingIssue:'Name a target.'},{...deny,castCommand:'I cast Detect Magic on me'});assert.equal(reply.castCommand,null,'the diagnostics, 2026-10-04: a deny beside the cast it refuses');assert.equal(reply.narration,'The spell will not come.');
  reply=await ask('Can I use detect magic here?',{},deny);assert.equal(reply.castCommand,null,'a question is answered, never cast');
  reply=await ask('I use prestidigitation to light the candle.',{},deny);assert.equal(reply.castCommand,null,'a spell the hero cannot pay for now is left to the telling');
  reply=await ask('I use detect magic, sweeping the room.',{},deny);assert.equal(reply.castCommand,'I cast Detect Magic, sweeping the room');}
 // 7. A check together with an actionId (the diagnostics, 2026-10-02): the journey is kept and the check dropped.
 {const look={skill:'Perception',ability:'Wisdom',dc:12,mode:'normal',reason:'Watch the hedges',success:'Nothing stirs.',failure:'You miss a movement.',damageCount:0,damageDie:6,damageOn:'none'};
  const t=await playable('check beside travel',[done({narration:'You set off, eyes on the hedges.',actionId:'travel-bridge',check:look}),done({narration:'The bridge is quiet.'})],{question:'I head to the bridge, watching the hedges.'});
  assert.ok(t.game.map.visited.includes('bridge'));}
 // 8. Passing provider faults are tried once more; two in a row are reported as they are.
 {let t=await playable('server error once',[{httpStatus:500},done({narration:'The keeper nods.'})],{question:'I nod to the keeper.'});assert.equal(t.calls.length,2);
  t=await playable('time out once',[Object.assign(Error('The operation was aborted due to timeout'),{name:'TimeoutError'}),done({narration:'The keeper nods.'})],{question:'I nod to the keeper.'});assert.equal(t.calls.length,2);
  const twice=table([{httpStatus:502}]);await assert.rejects(resolveTurn(inn,{question:'I nod to the keeper.'},{ask:twice.ask,randomImpl:seq(7)}),/provider could not complete/);assert.equal(twice.calls.length,2);}
 // 9. A resolved turn whose telling is lost every time keeps the engine's results with a plain line.
 {const go=r.dmChoices(wizard,inn.game).find(c=>c.id==='travel-bridge');
  const t=await playable('resolved telling lost',[done({narration:'   '})],{question:'I go to the bridge.',action:go.action});
  assert.equal(t.out.narration,'The moment settles as the dice fell.');assert.ok(t.game.map.visited.includes('bridge'));assert.equal(t.calls.length,3);}
 // 10. Prose with no reply in it, every time: the player sees a calm error with nothing applied.
 await assert.rejects(turn([done('The keeper shrugs.')],{question:'I shrug back.'}),/could not be used this time, so nothing was applied/);
 // 11. Every schema sent is valid for strict structured output (every property required, no extra properties,
 //     nullable by type lists, only keywords the provider accepts), in every phase of a turn and for stories and heroes.
 {const context=r.dmContext(wizard,inn.game,null,'x'),phases=[{},{outOfCharacter:{canRewind:true,lastTurn:null}},{sceneTrigger:{id:'greet:mara',cue:'Mara speaks.'}},{engineResolved:['You travel to the bridge.']},{pendingSpell:{id:'detect-magic',spell:{name:'Detect Magic'}}},{world:{...context.world,canDiscover:true,canAmbush:true,canIntroduce:true},conversationParticipants:[{id:'mara',name:'Mara'}],recruitmentTargets:['mara'],inventory:{gold:10,items:[]}}];
  for(const extra of phases){const p=provider([done({narration:'x',ruling:extra.pendingSpell?{decision:'clarify',note:'Which?',...zero}:null,rewind:extra.outOfCharacter?false:null,fault:extra.outOfCharacter?false:null})]);await generate({input:'I look.',context:{...context,...extra}},{apiKey:'k',model:'m',fetchImpl:p.fetchImpl});}
  const stop=async(url,options)=>{const request=JSON.parse(options.body);schemas.push([request.text.format.name,request.text.format.schema]);throw Error('stop');};
  await generateCharacter({input:'A hero',context:{mode:'character'}},{apiKey:'k',model:'m',fetchImpl:stop}).catch(()=>{});
  await generateAdventure({input:'A tale',context:{mode:'adventure',introId:'caravan',choices:[]}},{apiKey:'k',model:'m',fetchImpl:stop}).catch(()=>{});
  await generateAdventure({input:'A tale',context:{mode:'adventure',introId:'easy',easyStart:true,choices:[]}},{apiKey:'k',model:'m',fetchImpl:stop}).catch(()=>{});
  const names=new Set(schemas.map(([n])=>n));for(const n of ['dm_reply','character_draft','new_adventure'])assert.ok(names.has(n),n+' was checked');
  const keywords=new Set(['type','properties','required','additionalProperties','items','enum','maxItems','minItems','maxLength','minimum','maximum','description','anyOf','const','pattern']);
  const typeOf=v=>v===null?'null':Number.isInteger(v)?'integer':typeof v;
  const problems=(s,at,out)=>{
   if(!s||typeof s!=='object'){out.push(at+' is not a schema');return out;}
   for(const k of Object.keys(s))if(!keywords.has(k))out.push(at+' uses '+k);
   const types=[].concat(s.type??[]);if(!types.length&&!s.anyOf)out.push(at+' has no type');
   if(types.includes('object')){const keys=Object.keys(s.properties??{});if(s.additionalProperties!==false)out.push(at+' allows other properties');if(JSON.stringify([...(s.required??[])].sort())!==JSON.stringify([...keys].sort()))out.push(at+' does not require every property');for(const k of keys)problems(s.properties[k],at+'.'+k,out);}
   if(types.includes('array'))problems(s.items,at+'[]',out);
   for(const [i,a] of (s.anyOf??[]).entries())problems(a,at+'|'+i,out);
   if(Array.isArray(s.enum)&&types.length)for(const v of s.enum)if(!types.includes(typeOf(v))&&!(typeOf(v)==='integer'&&types.includes('number')))out.push(at+' enum value '+JSON.stringify(v)+' is not of its type');
   return out;
  };
  for(const [name,schema] of schemas){const found=problems(schema,name,[]);assert.deepEqual(found,[],'strict structured output: '+found.slice(0,5).join('; '));}}
 // 12. The turn's time is kept: when a slow first reply leaves too little of the 80 seconds, there is no retry and no
 //     second look, and the usable part of the reply is told at once (the gateways give up at 90).
 {const realNow=Date.now;let shift=0;Date.now=()=>realNow()+shift;
  try{const context=r.dmContext(wizard,inn.game,null,'x'),p=provider([done({narration:'You set off at last.',actionId:'invent-a-journey'})]);
   const slow=async(url,options)=>{shift+=75000;return p.fetchImpl(url,options);};
   const reply=await generate({input:'I go to the bridge.',context},{apiKey:'k',model:'m',fetchImpl:slow});
   assert.equal(p.calls.length,1,'no time for another attempt or a second look');assert.equal(reply.actionId,'travel-bridge','the unknown journey is never applied; the plain one the player named is started by the game');}
  finally{Date.now=realNow;}}
 // 13. The reliability report: failures per 200 turns, host and guests apart, seen by the player or mended quietly.
 {const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qb-dm-report-')),now=Date.now(),at=m=>new Date(now-m*60000).toISOString(),guest='0123456789abcdef0123456789abcdef';
  const usage=[],notes=[];
  for(let i=0;i<300;i++)usage.push({at:at(i+10),mode:'turn',model:'gpt-6-luna',input:1000,cached:500,output:200,reasoning:0,ask:1,...(i%3?{guest}:{})});
  usage.push({at:at(5),mode:'turn',model:'gpt-6-luna',input:1000,cached:500,output:200,reasoning:0,ask:2,guest});
  notes.push({at:at(9),guest,error:'The recruitment decision was invalid. Nothing was applied.'},{at:at(9),guest,secondLook:'unusable reply',outcome:'asked again'},{at:at(9),guest,turn:'asked again',reasons:['recruitment'],asks:2,phase:'ordinary'});
  notes.push({at:at(8),guest:null,turn:'rescued',reasons:['unreadable','unreadable','unreadable'],asks:3,phase:'ordinary'},{at:at(7),guest:null,turn:'failed',reasons:['cut short','cut short','cut short'],asks:3,phase:'ordinary'});
  notes.push({at:at(6),guest,secondLook:'ruling without a spell',outcome:'dropped'},{at:at(6),guest:null,error:'unparseable reply',aside:true});
  fs.writeFileSync(path.join(dir,'.questbound-usage.jsonl'),usage.map(u=>JSON.stringify(u)).join('\n')+'\n');fs.writeFileSync(path.join(dir,'.questbound-diagnostics.jsonl'),notes.map(u=>JSON.stringify(u)).join('\n')+'\n');
  const run=spawnSync(process.execPath,['dm-report.cjs','--dir',dir,'--days','14'],{cwd:__dirname,encoding:'utf8'});fs.rmSync(dir,{recursive:true,force:true});
  assert.equal(run.status,0,run.stderr);const text=run.stdout;
  assert.match(text,/Reliability, last 14 days: 300 turns/);
  assert.match(text,/Seen by the player: 1 failed turn \(0\.67 per 200 turns\)/);
  assert.match(text,/host: 100 turns, 1 failed \(2\.00 per 200\), 1 rescued/);assert.match(text,/guests: 200 turns, 0 failed \(0\.00 per 200\), 0 rescued, 1 asked again/);
  assert.match(text,/Mended quietly: 3 turns \(1 asked again, 1 rescued, 1 mended in place\)/);
  assert.match(text,/Goal: under 1 failed turn in 200/);}
 console.log('Reliable turns: replies sent twice read once, cut-short replies asked again with more room (and their telling kept if nothing more comes), refusals told as such, a join beside a journey kept as the turn, lines with no telling framed, a spell the rules allow cast despite a denial, provider faults tried once more, lost tellings of resolved turns replaced, every request schema strict, and dm-report showing failures per 200 turns for host and guests, seen and mended.');
})().catch(e=>{console.error(e);process.exitCode=1;});
