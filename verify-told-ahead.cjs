// Fewer requests a turn (2026-10-22, the host: "merge telling into first call as you recommended. implement #3, #4, #5";
// toldAhead.js, sceneTriggers.js cueSpoken, fightLines.js routineTelling, dm-server.cjs judge/steadied/secondLooked/
// cacheHoldFor, dm-intent.cjs settled, spending.cjs costOf): a check's outcomes and a journey's arrival written in the
// reply that starts them, and shown when the rules turn out as foreseen (else the telling is asked for as before); a
// move the reply chose that it could tell (an offer taken up, a routine blow) told by it; a moment's first words told in
// the telling of the move that brought it, and no cue played for people who already spoke; unmistakable requests acted
// on at once; small faults mended in place; the prompt cache held across pauses, with a safe fallback.
// Played through the campaign server's resolveTurn (the device's ask does the same) and generate, with a stand-in
// provider: no network, no AI, no logs written.
const assert=require('node:assert/strict');
const r=require('./rules-engine.cjs').rules(),{resolveTurn}=require('./server-turn.cjs');
const {generate,requestParts,requestScene}=require('./dm-server.cjs'),{journeyStory}=require('./journey-fixtures.cjs');
const {readText}=require('./rules-files.cjs');
const plain=v=>JSON.parse(JSON.stringify(v));
const asEffects=o=>{const {narration,dialogue,suggestions,...rest}=o,effects=[];for(const [k,v] of Object.entries(rest))for(const x of [].concat(v))if(x!=null)effects.push({[k]:x});return {narration,dialogue:dialogue??[],effects,suggestions:suggestions??[]};};
const answer=o=>({ok:true,json:async()=>({status:'completed',usage:{input_tokens:100,output_tokens:10},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(asEffects({narration:'It happens.',...o}))}]}]})});
// A turn at the table with a stand-in Dungeon Master: `reply(request, context)` answers each request.
async function play(snapshot,request,reply,{random=()=>0.5}={}){
 const asked=[];
 const ask=body=>generate(body,{apiKey:'k',model:'test-model',fetchImpl:async(u,o)=>{const q=JSON.parse(o.body);asked.push(q);return answer(reply(q,requestScene(q).context,asked.length)??{});}});
 const out=await resolveTurn(snapshot,request,{ask,randomImpl:random});
 return {out,asked,contexts:asked.map(q=>requestScene(q).context)};
}
const kara=r.readyHero('fighter');
const story=journeyStory(0);story.residents=[...story.residents,{name:'Odo Pike',species:'Human',gender:'man',role:'The ferryman.',appearance:'A stooped man in an oilskin coat.',personality:'Wry.',motive:'Get paid.',toughness:'common',attitude:'indifferent',at:'Heron Ferry',foe:'neutral',tie:null,noticed:true,class:null}];
const fresh=r.freshStoryGame(kara,story,r.newAdventure(kara)),town=r.adventureSnapshot(kara,plain({...fresh,map:{...fresh.map,accepted:true}}),null,true);
const odo=Object.keys(town.game.people).find(id=>town.game.people[id].name==='Odo Pike'),ferry=town.game.world.places.find(p=>p.name==='Heron Ferry').id;
const check=(o={})=>({skill:'Investigation',ability:'Intelligence',dc:10,mode:'normal',reason:'Reading the notices',success:'A name stands out.',failure:'Nothing useful.',damageCount:0,damageDie:6,damageOn:'none',...o});
const outcomes={success:{narration:'Halfway down, a name leaps out: Edda Marsh, last seen at the chapel.',dialogue:[{speakerId:'keeper',text:'Edda? She went out a week past and never came back.'}],relationships:[]},failure:{narration:'Rain has smeared the ink past reading.',dialogue:[],relationships:[]}};
(async()=>{
 // ---- 1. A check with both outcomes written ahead: one request, the outcome the dice chose ----
 {let p=await play(town,{question:'I study the notice board for news of the missing.'},(q,c)=>c.engineResolved?{narration:'(asked after the roll)'}:{narration:'You run a finger down the damp notices.',check:check({outcomes})},{random:()=>0.99});
  assert.equal(p.asked.length,1,'a check told ahead asks once');assert.equal(p.out.narration,'You run a finger down the damp notices. Halfway down, a name leaps out: Edda Marsh, last seen at the chapel.');
  assert.ok(p.out.turn.events.some(e=>e.kind==='dialogue'&&e.speakerId==='keeper'),'with the outcome\'s spoken line');assert.ok(p.out.turn.events.some(e=>/ vs DC 10\. Success\. A name stands out\./.test(e.text)),'and the dice card');
  p=await play(town,{question:'I study the notice board for news of the missing.'},(q,c)=>c.engineResolved?{narration:'(asked after the roll)'}:{narration:'You run a finger down the damp notices.',check:check({dc:30,outcomes})},{random:()=>0});
  assert.equal(p.asked.length,1);assert.equal(p.out.narration,'You run a finger down the damp notices. Rain has smeared the ink past reading.','a failure tells the failure');
  // No outcomes: told after the roll, as before.
  p=await play(town,{question:'I study the notice board for news of the missing.'},(q,c)=>c.engineResolved?{narration:'The notices tell you little.'}:{narration:'You look.',check:check()});
  assert.equal(p.asked.length,2,'without outcomes the roll is told by a second request');assert.equal(p.out.narration,'The notices tell you little.');
  // A hazard that drops the hero: more than the roll happened, so the telling is asked for.
  const low=r.adventureSnapshot(kara,town.game,{current:1,temp:0},true);
  p=await play(low,{question:'I climb the slick roof to read the high notice.'},(q,c)=>c.engineResolved?{narration:'You fall hard.'}:{narration:'You climb.',check:check({skill:'Athletics',ability:'Strength',dc:30,damageCount:2,damageDie:6,damageOn:'failure',outcomes})},{random:()=>0});
  assert.equal(p.asked.length,2,'a fall is told after the roll');assert.equal(p.out.snapshot.game.stage,'dying');
  // The reply is read as before; outcomes the server cannot use are left out (and the roll told after), never refused.
  const bad={success:{narration:'',dialogue:[],relationships:[]},failure:outcomes.failure};
  p=await play(town,{question:'I study the notice board for news of the missing.'},(q,c)=>c.engineResolved?{narration:'Told after.'}:{narration:'You look.',check:check({outcomes:bad})});
  assert.equal(p.asked.length,2);assert.equal(p.out.narration,'Told after.');
  // A line from someone not here is left out of an outcome.
  p=await play(town,{question:'I study the notice board for news of the missing.'},(q,c)=>c.engineResolved?{narration:'x'}:{narration:'You look.',check:check({outcomes:{...outcomes,success:{...outcomes.success,dialogue:[{speakerId:odo,text:'Not from here.'},...outcomes.success.dialogue]}}})},{random:()=>0.99});
  assert.equal(p.asked.length,1);assert.deepEqual(plain(p.out.turn.events.filter(e=>e.kind==='dialogue').map(e=>e.speakerId)),['keeper']);}
 // ---- 2. In a fight a check's outcomes are left out (the foe answers there) ----
 {const g=r.hostileEncounterGame(kara,r.newAdventure(kara),()=>0),ctx=r.dmContext(kara,{...g,openingAttackAvailable:false},null,'I kick sand in its eyes.');
  const reply=await generate({input:'I kick sand in its eyes.',context:ctx},{apiKey:'k',model:'m',fetchImpl:async()=>answer({narration:'You scoop up sand.',check:check({skill:null,ability:'Dexterity',outcomes})})});
  assert.ok(reply.check,'the check stands');assert.equal(reply.check.outcomes,null,'its outcomes are told after the roll in a fight');}
 // ---- 3. A journey somewhere new the reply chose, with the arrival written ahead ----
 {const way=q=>({narration:'You take the river path west, reeds hissing at your boots.',actionId:'travel-'+ferry,arrival:{narration:'A rope ferry creaks against its post; a hut leans over brown water.',dialogue:[{speakerId:odo,text:'Crossing, is it? Coin first.'},{speakerId:'keeper',text:'(left at the market)'}]}});
  let p=await play(town,{question:'Let us go and see the ferry.'},(q,c)=>c.engineResolved?{narration:'(asked after the road)'}:way(q));
  assert.equal(p.asked.length,1,'the arrival written ahead: no second request');assert.equal(p.out.snapshot.game.world.at,ferry);
  assert.equal(p.out.narration,'You take the river path west, reeds hissing at your boots. A rope ferry creaks against its post; a hut leans over brown water.');
  assert.deepEqual(plain(p.out.turn.events.filter(e=>e.kind==='dialogue').map(e=>e.speakerId)),[odo],'only those there once the road is walked speak');
  // The ferryman spoke on arriving: no cue is played for him (a device would otherwise ask the Dungeon Master again).
  const before=town.game,after=p.out.snapshot.game;
  assert.ok(r.withSceneTrigger(before,{...after,firedTriggers:before.firedTriggers??[]},'x',p.out.turn).sceneCue===undefined,'the moment is told');
  assert.ok(r.withSceneTrigger(before,{...after,firedTriggers:before.firedTriggers??[]},'x',null).sceneCue?.speakerId===odo,'unless nobody spoke');
  // Without an arrival: told after the road, as before.
  p=await play(town,{question:'Let us go and see the ferry.'},(q,c)=>c.engineResolved?{narration:'The ferry at last.',dialogue:c.speakFirst?[]:[]}:{narration:'You set out.',actionId:'travel-'+ferry});
  assert.equal(p.asked.length,2);assert.equal(p.out.narration,'The ferry at last.');
  // The road brings a fight (the mill is a lair): the arrival written ahead is not shown, the telling is asked for.
  p=await play(town,{question:'We go to the mill.'},(q,c)=>c.engineResolved?{narration:'Wolves burst from the mill.'}:{narration:'You set off down the stream path.',actionId:'travel-p1',arrival:{narration:'The mill is quiet.',dialogue:[]}});
  assert.equal(p.asked.length,2,'a fight on arriving is told after the road');assert.equal(p.out.narration,'Wolves burst from the mill.');assert.equal(p.out.snapshot.game.stage,'combat');
  // An arrival beside anything but a journey is left out by the server.
  const reply=await generate({input:'I wait.',context:r.dmContext(kara,town.game,null,'I wait.')},{apiKey:'k',model:'m',fetchImpl:async()=>answer({narration:'You wait.',arrival:{narration:'x',dialogue:[]}})});
  assert.equal(reply.arrival,null);}
 // ---- 4. A journey back the reply chose: a farewell from someone left behind is not heard there (and the turn stands) ----
 {const there=r.adventureSnapshot(kara,plain({...town.game,stage:'tower',map:{...town.game.map,visited:['inn','tower']}}),null,true);
  const p=await play(there,{question:'Back to the market.'},(q,c)=>c.engineResolved?{narration:'(asked)'}:{narration:'You turn for home.',actionId:'travel-inn'});
  assert.equal(p.asked.length,1);
  const seen=r.adventureSnapshot(kara,plain({...town.game,map:{...town.game.map,visited:['inn','tower']}}),null,true);
  const q=await play(seen,{question:'Back to the chapel, then.'},(qq,c)=>c.engineResolved?{narration:'(asked)'}:{narration:'Tilda waves you off.',dialogue:[{speakerId:'n1',text:'Mind the reeds!'}],actionId:'travel-tower'});
  assert.equal(q.asked.length,1,'a journey back is told by the reply that chose it');assert.equal(q.out.snapshot.game.stage,'tower');assert.ok(!q.out.turn.events.some(e=>e.kind==='dialogue'&&e.speakerId==='n1'),'a line from someone left behind is dropped, not refused');}
 // ---- 5. An offer taken up that the reply chose: told by it ----
 {const offered=r.adventureSnapshot(kara,plain({...town.game,joinOffers:{n1:{reason:'She wants to see the barrow.',terms:'',class:'Fighter'}}}),null,true);
  const choice=r.dmChoices(kara,offered.game,null).find(c=>c.id==='join:n1');assert.ok(choice,'the offer stands');
  const p=await play(offered,{question:'Grab your gaff, then. We leave at once.'},(q,c)=>c.engineResolved?{narration:'(asked)'}:{narration:'Tilda grins and fetches her gaff.',dialogue:[{speakerId:'n1',text:'About time.'}],actionId:'join:n1'});
  assert.equal(p.asked.length,1,'the reply that chose it tells it');assert.equal(p.out.snapshot.game.followers.n1.status,'following');assert.equal(p.out.narration,'Tilda grins and fetches her gaff.');}
 // ---- 6. A fight move the reply chose from the player's own words: a routine result is told after its telling ----
 {const g=r.hostileEncounterGame(kara,r.newAdventure(kara),()=>0),max=r.combatBasics(kara).hp,big={...g,openingAttackAvailable:false,enemyHP:400,story:{...g.story,foeStats:{...g.story.foeStats,maximum:400}}};
  const fight=r.adventureSnapshot(kara,plain(big),{current:max,temp:0},true);
  let p=await play(fight,{question:'I go at the cutthroat like a storm, all elbows and steel.'},(q,c)=>c.engineResolved?{narration:'(asked)'}:{narration:'You surge forward, blade low.',actionId:'attack:Greatsword'});
  assert.equal(p.asked.length,1,'a routine result needs no second request');assert.ok(p.out.narration.startsWith('You surge forward, blade low. '),'the reply\'s own telling first');assert.notEqual(p.out.turn.told,'game','the Dungeon Master spoke in it');
  // A critical hit still goes to the Dungeon Master.
  p=await play(fight,{question:'I go at the cutthroat like a storm, all elbows and steel.'},(q,c)=>c.engineResolved?{narration:'A crushing blow.'}:{narration:'You surge forward.',actionId:'attack:Greatsword'},{random:()=>0.99});
  assert.equal(p.asked.length,2);assert.equal(p.out.narration,'A crushing blow.');}
 // ---- 7. The telling of a first arrival carries the moment's first words (a device sends it; no cue after) ----
 {const dm=readText('useDmTurn.js');
  assert.ok(/sceneTrigger\(game,preview\.game,command\.action\)/.test(dm)&&/speakFirst:\{speakerId:cue\.speakerId,cue:cue\.cue\}/.test(dm),'the device asks for the moment\'s first words with the telling');
  assert.ok(/\(body\.retell\?null:checkTelling\(\{before:game,preview,check:body\.check,reply:body\}\)\)\?\?await request\(/.test(dm),'and tells a check with its outcome before asking (never when the reply was mended: retell)');
  const g=r.adventureStep(town.game,null,kara,{type:'travel',destination:ferry},()=>0.5);
  const cue=r.withSceneTrigger(town.game,g.game,{type:'travel',destination:ferry}).sceneCue;assert.equal(cue.speakerId,odo);
  const ctx={...r.dmContext(kara,g.game,g.health,'I go to the ferry.'),engineResolved:g.events,speakFirst:{speakerId:cue.speakerId,cue:cue.cue},conversationParticipants:r.speakingPeople(g.game).map(n=>({id:n.id,name:n.name,role:n.role}))};
  let q=null;await generate({input:'I go to the ferry.',context:ctx},{apiKey:'k',model:'m',fetchImpl:async(u,o)=>{q=JSON.parse(o.body);return answer({narration:'You arrive.',dialogue:[{speakerId:odo,text:'Crossing?'}]});}});
  const parts=requestParts(q);assert.match(parts.tail,/PEOPLE SPEAK FIRST: The player has just arrived at Heron Ferry for the first time/);assert.ok(parts.tail.includes('Odo Pike ['+odo+'] speaks first'));
  assert.ok(!('speakFirst' in parts.scene)&&!JSON.stringify(parts.scene).includes('People who live here notice'),'the moment is read once, in the note');
  // Someone who lives there must speak: a companion's remark leaves the greeting to come.
  const turnBy=ids=>({events:ids.map(id=>({kind:'dialogue',speakerId:id,text:'…'}))});
  const withMara={...g.game,followers:{mara:{status:'following'}}};
  assert.ok(r.withSceneTrigger(town.game,withMara,{type:'travel',destination:ferry},turnBy(['mara'])).sceneCue,'a companion\'s remark does not greet the newcomer');
  assert.equal(r.withSceneTrigger(town.game,withMara,{type:'travel',destination:ferry},turnBy([odo])).sceneCue,undefined);}
 // ---- 8. Small faults mended in place: a place given by its bare id, a search with nothing left to search ----
 {const ctx=r.dmContext(kara,town.game,null,'Back to the chapel.');
  let reply=await generate({input:'Back to the chapel.',context:ctx},{apiKey:'k',model:'m',fetchImpl:async()=>answer({narration:'You head for the chapel.',actionId:'tower'})});
  assert.equal(reply.actionId,'travel-tower','a bare place id is the journey there');
  let asked=0;reply=await generate({input:'I search the bodies again.',context:ctx},{apiKey:'k',model:'m',fetchImpl:async()=>{asked++;return answer({narration:'You find a purse of 40 gold.',actionId:'loot'});}});
  assert.equal(asked,1,'not asked again');assert.equal(reply.actionId,null);assert.equal(reply.narration,'You look again, but there is nothing left here to search.');}
 // ---- 9. The cache held across pauses: what each model is sent, and the fallback ----
 {const ctx=r.dmContext(kara,town.game,null,'I look around.'),sent=[];
  const run=async(model,holdCache,fetchImpl)=>generate({input:'I look around.',context:ctx},{apiKey:'k',model,holdCache,fetchImpl:fetchImpl??(async(u,o)=>{sent.push(JSON.parse(o.body));return answer({});})});
  await run('gpt-6-luna','12h');let q=sent.at(-1);
  assert.deepEqual(q.input[0].content[0].prompt_cache_breakpoint,{mode:'explicit',ttl:'12h'},'the hero\'s features close the part held 12 hours');assert.equal(q.input[0].content[0].type,'input_text');
  const marked=q.input.filter(m=>Array.isArray(m.content)&&m.content.some(b=>b.prompt_cache_breakpoint));assert.equal(marked.length,2,'two explicit breakpoints (the implicit one is the third of four)');
  const steady=marked[1];assert.equal(steady.role,'user');assert.ok(!steady.content[0].text.startsWith('Scene: the story so far.')&&!steady.content[0].text.startsWith('Scene: this turn'),'the second after the scene that lasts from turn to turn');assert.deepEqual(steady.content[0].prompt_cache_breakpoint,{mode:'explicit'});
  assert.ok(!('prompt_cache_retention' in q)&&!('prompt_cache_options' in q),'the request\'s own ttl (30 minutes) is left as it is');
  assert.deepEqual(requestParts(q).scene,requestParts((await (async()=>{await run('gpt-6-luna','off');return {};})(),sent.at(-1))).scene,'the scene reads the same with or without breakpoints');
  assert.ok(sent.at(-1).input.every(m=>typeof m.content==='string'),'off: plain messages');
  await run('gpt-6-luna','30m');assert.deepEqual(sent.at(-1).input[0].content[0].prompt_cache_breakpoint,{mode:'explicit'});
  await run('gpt-5.5','12h');assert.equal(sent.at(-1).prompt_cache_retention,'24h');assert.ok(sent.at(-1).input.every(m=>typeof m.content==='string'),'an earlier model: retention, no breakpoints');
  await run('gpt-4.1','12h');assert.equal(sent.at(-1).prompt_cache_retention,'24h');
  // A provider that does not know the breakpoints: asked again at once with retention instead; and one that knows
  // neither, with nothing. Each is remembered for the rest of the process.
  const tries=[],refuse=(b,name)=>({ok:false,status:400,headers:{get:()=>null},json:async()=>({error:{message:"Unknown parameter: '"+name+"'."}})});
  await run('gpt-6-luna','12h',async(u,o)=>{const b=JSON.parse(o.body);tries.push(b);if(tries.length===1)return refuse(b,'input[0].content[0].prompt_cache_breakpoint');if(tries.length===2)return refuse(b,'prompt_cache_retention');return answer({});});
  assert.equal(tries.length,3);assert.ok(tries[1].input.every(m=>typeof m.content==='string')&&tries[1].prompt_cache_retention==='24h','breakpoints refused: retention');
  assert.ok(!('prompt_cache_retention' in tries[2])&&tries[2].input.every(m=>typeof m.content==='string'),'retention refused: nothing');
  assert.equal(globalThis.__questboundNoCacheBreakpoints,true);assert.equal(globalThis.__questboundNoCacheRetention,true);
  await run('gpt-6-luna','12h');assert.ok(sent.at(-1).input.every(m=>typeof m.content==='string')&&!('prompt_cache_retention' in sent.at(-1)),'held off for the rest of the process');
  delete globalThis.__questboundNoCacheBreakpoints;delete globalThis.__questboundNoCacheRetention;
  // A 12-hour ttl refused: the breakpoints stay, for the request's own 30 minutes.
  const ttlTries=[];await run('gpt-6-luna','12h',async(u,o)=>{const b=JSON.parse(o.body);ttlTries.push(b);if(ttlTries.length===1)return {ok:false,status:400,headers:{get:()=>null},json:async()=>({error:{message:"Invalid value for 'ttl': '12h'."}})};return answer({});});
  assert.equal(ttlTries.length,2);assert.deepEqual(ttlTries[1].input[0].content[0].prompt_cache_breakpoint,{mode:'explicit'});assert.equal(globalThis.__questboundNoLongTtl,true);delete globalThis.__questboundNoLongTtl;
  await run('gpt-6-luna','12h');assert.ok(!('prompt_cache_retention' in sent.at(-1)),'a newer model is never sent retention beside its breakpoints');
  // Cache writes are priced at their own rates (spending.cjs).
  const {costOf,writeRate}=require('./spending.cjs');assert.deepEqual(writeRate,{short:1.25,long:2.5});
  const line={model:'gpt-6-luna',input:20000,cached:10000,output:200};
  assert.equal(costOf({...line,written:8000,written12h:5000}).toFixed(8),((2000*0.10+3000*0.125+5000*0.25+10000*0.01+200*0.5)/1e6).toFixed(8));assert.equal(costOf(line).toFixed(8),((10000*0.10+10000*0.01+200*0.5)/1e6).toFixed(8),'a line without writes is priced as before');}
 console.log('Told ahead: a check\'s outcome and a journey\'s arrival from the reply that started them (asked again only when the dice or the road went otherwise), an offer taken up and a routine blow told by the reply that chose them, a moment\'s first words in its telling with no cue after, lines only from those still there, a bare place id and an empty search mended in place, the prompt cache held 12 hours on the newer models (retention on the earlier) with a fallback, and cache writes priced.');
})().catch(e=>{console.error(e);process.exit(1);});
