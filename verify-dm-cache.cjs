// Better use of the provider's cache and a leaner turn (the host, 2026-10-17: "put everything that never changes first
// and the turn-by-turn details last, so OpenAI reuses far more of each request" and "only send what the moment needs
// (no spell reference for a fighter, less of the long story memory during a plain fight, fewer far-away places)").
// The provider caches a request part by part (measured live on 2026-10-17: warm turns were cached to exactly the end of
// the instructions and schema, never into the scene, and a retry whose note sat in the instructions got nothing). This
// check drives whole turns through the campaign server's pipeline (server-turn.cjs: the real context, generate in
// dm-server.cjs) with a stand-in provider and asserts: one reply schema for every phase, naming no one and nothing of
// this turn; the instructions are the standing prompt alone, byte for byte the same for every hero, phase, retry and
// second look; then this hero's features, the scene in parts from what lasts to what changes (the player's words in the
// last), and this turn's note after it (phase, a retry's or second look's note, the narrator's voice last); a fighter's
// request carries no spell reference; a fight's carries a short memory and no far-away lands; prompt_cache_key is the
// same for a hero's every request (and dropped if the provider does not know it). It prints how much of each request a
// warm cache could reuse, part by part, and fails below 80%. No network, no AI, no logs written.
const assert=require('node:assert/strict'),vm=require('node:vm');
const r=require('./rules-engine.cjs').rules(),{resolveTurn}=require('./server-turn.cjs');
const server=require('./dm-server.cjs'),{generate,standingPrompt,heroPrompt,replySchemaFor,cacheKeyFor,promptLayout,sceneParts,requestParts,requestScene}=server;
const {rulesSource}=require('./rules-files.cjs'),{journeyStory}=require('./journey-fixtures.cjs');
const R=vm.runInNewContext(rulesSource({extra:['worldArtRules.js']})+'\n({freshStoryGame,newAdventure,adventureSnapshot,readyHero,dmChoices,appendStoryLog,withMemory,rememberFacts})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const plain=v=>JSON.parse(JSON.stringify(v));
const seq=(s=11)=>()=>(s=(s*16807)%2147483647)/2147483647;
const full=o=>({narration:'It happens.',dialogue:[],recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null,rewind:null,fault:null,remember:[],suggestions:[],...o});
const done=o=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(full(o))}]}]})});
const calls=[];let script=null;
const fetchImpl=async(url,options)=>{const q=JSON.parse(options.body);calls.push(q);return script?script(q,calls.length):done({});};
const ask=body=>generate(body,{apiKey:'k',model:'test-model',fetchImpl});
const sent=[];
const play=async(label,snapshot,request,reply=null)=>{const before=calls.length;script=reply;const out=await resolveTurn(snapshot,request,{ask,randomImpl:seq(7)});script=null;calls.slice(before).forEach((q,i)=>sent.push({label:label+(i?' ('+(requestParts(q).tail.includes('LOOK AGAIN')?'asked again':'telling')+')':''),q}));return out;};
const direct=async(label,body,reply)=>generate(body,{apiKey:'k',model:'m',fetchImpl:async(u,opt)=>{const q=JSON.parse(opt.body);sent.push({label,q});return done(typeof reply==='function'?reply(q):reply);}});
const snap=(hero,story=journeyStory(0))=>{const g=plain(R.freshStoryGame(hero,story,R.newAdventure(hero)));return R.adventureSnapshot(hero,{...g,map:{...g.map,accepted:true}},null,true);};
// Roughly the provider's tokens: words with their leading space, numbers in threes, runs of punctuation.
const tokens=s=>{let n=0;for(const m of s.matchAll(/ ?[A-Za-z]+| ?\d{1,3}|\s+| ?[^\sA-Za-z\d]{1,3}/g))n+=m[0].length>10?Math.ceil(m[0].length/7):1;return n;};
// The parts of a request as the provider caches them: the schema with the instructions, then each input message.
const units=q=>[JSON.stringify(q.text.format.schema)+'\n'+q.instructions,...(Array.isArray(q.input)?q.input.map(m=>m.role+'\n'+m.content):[String(q.input)])];
const sharedUnits=(a,b)=>{let n=0;while(n<a.length&&n<b.length&&a[n]===b[n])n++;return n;};
// A long life: 30 lands, 150 places, 96 people, 30 tales remembered and 40 facts kept.
function longGame(game){
 const long=(t,n)=>(t+' ').repeat(Math.ceil(n/(t.length+1))).slice(0,n);let g=plain(game);
 const say=(k,t)=>{g={...g,storyLog:R.appendStoryLog(g.storyLog??[],k,t)};};
 for(let t=1;t<=30;t++){say('story',long('Tale '+t+' of a long life',90)+': the tale began at Haven '+t+'.');for(let c=1;c<=4;c++){if(c>1)say('story','Chapter '+c+': Part '+c+' of tale '+t);for(let i=0;i<8;i++)say(['deed','death','person','victory'][i%4],long((['','You killed ','Met ','Slew '][i%4])+'Line '+t+'.'+c+'.'+i+' that matters',140));g=R.withMemory(g);}if(t<30)say('quest','Adventure complete: Tale '+t+'.');g=R.withMemory(g);}
 for(let i=0;i<40;i++)g=R.rememberFacts(g,[{text:long('A promise number '+i+' made at the ford to a ferryman',150),about:['n'+(1+i%2)],settles:null}]).game;
 const regions=Array.from({length:29},(_,i)=>({id:'r'+(i+1),name:'The Land of '+(i+1),terrain:'hills',last:i})),places=[...g.world.places];
 for(let i=3;i<=150;i++){const home=i<=40,region=home?undefined:regions[(i-41)%regions.length].id,prev=places.filter(p=>p.region===region).at(-1);
  places.push({id:'p'+i,name:'Place number '+i,description:long('A description of place '+i+' about stone and moss and the river',240),kind:'settlement',x:i*9000,y:i*3000,from:prev?.id??'inn',...(region?{region}:{}),...(i%2?{feature:long('A notable thing at place '+i,150)}:{}),...(i%5===0&&home?{danger:'lair',threat:{template:'wolf',name:'Threat '+i,appearance:'A grey wolf with a torn ear and a limp.'}}:{})});}
 const people={...g.people},memory={...g.npcMemory};
 for(let i=3;i<=96;i++){people['n'+i]={name:'Person Named '+i,species:'Human',gender:'other',role:long('A role for person '+i+'.',140),appearance:long('A face weathered by wind',200),personality:'Calm and slow.',motive:'Wants things.',toughness:'common',home:places[i%places.length].id,foe:'neutral',resident:true};memory['n'+i]={attitude:i%3?'friendly':'unfriendly',response:'Warm toward the player.',memories:['I remember the player helped me carry the nets up from the quay in the rain.','They paid fair for the bread.']};}
 return {...g,world:{...g.world,places,regions},people,npcMemory:memory,map:{...g.map,visited:[...new Set([...g.map.visited,...places.map(p=>p.id)])]}};
}
const strictProblems=(s,at,out=[])=>{
 const types=[].concat(s?.type??[]);
 if(types.includes('object')){const keys=Object.keys(s.properties??{});if(s.additionalProperties!==false)out.push(at+' allows other properties');if(JSON.stringify([...(s.required??[])].sort())!==JSON.stringify([...keys].sort()))out.push(at+' does not require every property');for(const k of keys)strictProblems(s.properties[k],at+'.'+k,out);}
 if(types.includes('array'))strictProblems(s.items,at+'[]',out);
 return out;
};
(async()=>{
 const fighter=R.readyHero('fighter'),wizard=R.readyHero('wizard');
 // ---- A session as it is played: turns of a town, a conversation, another hero between, a journey and its telling,
 // a fight, a retry, a second look, a brawl, a long life, a spell ruling, a word out of character and a scene cue ----
 const f=snap(fighter),w=snap(wizard);
 let o=await play('fighter: town',f,{question:'I look around the market.'});const f2=o.snapshot;
 o=await play('fighter: town again',f2,{question:'I watch the people at the stalls for a while.'});const f3=o.snapshot;
 o=await play('fighter: conversation',f3,{question:'Reeve, what do you know about the mill?',npcId:'keeper'},()=>done({narration:'The reeve leans in.',dialogue:[{speakerId:'keeper',text:'The mill is trouble.'}],relationships:[{npcId:'keeper',change:'pleased',memory:'The traveller listened to me about the mill.'}]}));
 o=await play('fighter: conversation again',o.snapshot,{question:'What kind of trouble?',npcId:'keeper'},()=>done({narration:'He frowns.',dialogue:[{speakerId:'keeper',text:'Wolves, or worse.'}],remember:[{text:'The reeve promised ten gold for clearing the mill.',about:['keeper'],settles:null}]}));
 o=await play('fighter: conversation, more',o.snapshot,{question:'I will see to it.',npcId:'keeper'},()=>done({narration:'He nods.',dialogue:[{speakerId:'keeper',text:'Go well.'}]}));
 await play('wizard: town',w,{question:'I look around the market.'});
 const mill=R.dmChoices(fighter,f3.game,f3.health).find(c=>/^travel-/.test(c.id)&&/Mill/.test(c.label));
 o=await play('fighter: to the mill',f3,{question:'I go to the Old Mill.',action:mill.action});const fight=o.snapshot;assert.equal(fight.game.stage,'combat','the mill is a lair');
 const bite=R.dmChoices(fighter,fight.game,fight.health).find(c=>/attack/.test(c.id));
 await play('fighter: fight',fight,{question:'I attack the wolf.',action:bite.action});
 await play('fighter: fight, words',fight,{question:'I shout at the wolf to back off.'});
 // A reply that cannot be used is asked for again; a reply that does not do what the player plainly asked gets a
 // second look. Both are sent with everything before this turn's note unchanged.
 await play('fighter: retried',f3,{question:'I ask around for work.'},(q,n)=>done(requestParts(q).tail.includes('LOOK AGAIN')?{narration:'Nobody has work today.'}:{narration:'You gain 900 gold.',actionId:'invent-gold'}));
 await play('fighter: second look',f3,{question:'I go to the Old Mill.'},()=>done({narration:'The road can wait; you stay in the market.'}));
 const punch=R.dmChoices(fighter,f3.game,f3.health).find(c=>/^npc-attack/.test(c.id));
 o=await play('fighter: brawl',f3,{question:'I hit '+punch.label,action:punch.action});
 const big={...f3,game:longGame(f3.game)};
 o=await play('long life: town',big,{question:'I look around the market.'});
 o=await play('long life: town again',o.snapshot,{question:'I ask the stallholders for news from The Land of 25.'});
 const lb=o.snapshot,lair=R.dmChoices(fighter,lb.game,lb.health).find(c=>/^travel-p(5|10|15|20)$/.test(c.id));
 o=await play('long life: to a lair',lb,{question:'I go there.',action:lair.action});assert.equal(o.snapshot.game.stage,'combat');
 await play('long life: fight, words',o.snapshot,{question:'I shout at the beast.'});
 // A spell awaiting a ruling, the player speaking to the Dungeon Master out of character, and a scene cue.
 const ctx=r.dmContext(wizard,w.game,null,'x');
 await direct('wizard: ruling',{input:'I cast Detect Magic.',context:{...ctx,pendingSpell:{id:'detect-magic',spell:{name:'Detect Magic'}}}},{narration:'x',ruling:{decision:'clarify',note:'Which way?',damage:0,selfDamage:0,healing:0,temporaryHP:0}});
 await direct('wizard: out of character',{input:'DM, what was that roll?',context:{...ctx,outOfCharacter:{canRewind:false,lastTurn:null}}},{narration:'x',rewind:false,fault:false});
 await direct('wizard: scene cue',{input:'',context:{...ctx,sceneTrigger:{cue:'The reeve looks up as you come in.'},conversationParticipants:[{id:'keeper',name:'Reeve'}]}},{narration:'He looks up.',dialogue:[{speakerId:'keeper',text:'Back again?'}]});
 if(process.argv.includes('--labels'))for(const x of sent)console.log(x.label, x.q.prompt_cache_key, requestParts(x.q).tail.slice(0,40));
 const at=label=>{const x=sent.find(x=>x.label===label);assert.ok(x,'sent: '+label);return x.q;},sceneOf=label=>requestScene(at(label)).context;
 for(const label of ['fighter: retried (asked again)','fighter: second look (asked again)','fighter: second look (telling)'])at(label);

 // ---- 1. One reply schema for every phase, naming nothing of this turn, valid for strict output ----
 const schema=JSON.stringify(replySchemaFor());
 for(const {label,q} of sent){assert.equal(JSON.stringify(q.text.format.schema),schema,label+': the one reply schema');assert.equal(q.text.format.strict,true);}
 assert.ok(!/"(?:keeper|mara|n\d+|np\d+|travel-[\w-]+|npc-attack[^"]*|end-turn)"/.test(schema),'the schema names no one and no choice');
 assert.deepEqual(strictProblems(replySchemaFor(),'reply'),[],'strict structured output');
 {const p=replySchemaFor().properties;assert.equal(Object.keys(p)[0],'narration','narration still streams first');assert.equal(Object.keys(p).at(-1),'suggestions');
  for(const k of ['actionId','castCommand','ruling','worldEvent','check','discovery','ambush','loot','introduce','rewind','fault'])assert.ok([].concat(p[k].type).includes('null'),k+' may be null in every phase');}

 // ---- 2. The instructions: the standing prompt alone, the same for every hero, phase, retry and second look ----
 for(const {label,q} of sent){
  assert.equal(q.instructions,standingPrompt,label+': the instructions are the standing prompt, unchanged');
  const first=q.input[0];assert.equal(first.role,'user');assert.ok(first.content.startsWith('THIS HERO\'S CLASS FEATURES (reference): '),label+': then the hero\'s features');
  // No developer message after the instructions: sent as developer messages, the hero's features and the note kept the
  // provider from caching anything past the instructions (layout 3, measured live on 2026-10-20).
  assert.ok(q.input.every(m=>m.role==='user'),label+': every part after the instructions is a user message');
  const tail=requestParts(q).tail;
  for(const turnOnly of ['CURRENT PHASE','SCENE TRIGGER','OUT OF CHARACTER','NARRATOR THIS TURN','LOOK AGAIN']){assert.ok(!standingPrompt.includes(turnOnly+':'),turnOnly+' is never in the standing part');
   assert.ok(!first.content.includes(turnOnly+':')&&q.input.slice(1,-1).every(m=>!String(m.content).includes(turnOnly+':')||String(m.content).startsWith('Scene: ')),label+': '+turnOnly+' only in the note after the scene');}
  if(tail)assert.ok(String(q.input.at(-1).content).startsWith('GAME NOTE FOR THIS TURN'),label+': this turn\'s note is last, opening with its lead');
  assert.ok(!/"spells"|"featureDetails"/.test(q.instructions+first.content),label+': the spells this turn names are read with the scene, not in the cached part');}
 assert.ok(standingPrompt.includes('"coreRules"')&&standingPrompt.includes('"actionRules"')&&standingPrompt.includes('OWN WORLD')&&standingPrompt.includes('HOW THE TURN ARRIVES'),'the shared rules and how the turn arrives are in the standing part');
 assert.match(requestParts(at('wizard: ruling')).tail,/^CURRENT PHASE: Adjudicate pendingSpell/);assert.match(requestParts(at('wizard: out of character')).tail,/^OUT OF CHARACTER:/);
 assert.match(requestParts(at('wizard: scene cue')).tail,/^SCENE TRIGGER: The player has not spoken\. The reeve looks up/);assert.match(requestParts(at('fighter: to the mill')).tail,/^CURRENT PHASE: Narrate the already resolved/);
 assert.match(requestParts(at('fighter: retried (asked again)')).tail,/^LOOK AGAIN: Your last reply could not be used/);assert.match(requestParts(at('fighter: second look (asked again)')).tail,/^LOOK AGAIN: /);
 assert.equal(requestParts(at('fighter: town')).tail,'','an ordinary turn told by the Chronicler has no note');
 // The narrator's voice for this turn is the very last thing the model reads (it ignored a style note buried in the
 // cached part), after a second look's note too.
 {let q=null;const body={input:'I look.',context:{...ctx,storyPreferences:{narrator:'bard'}}};await generate(body,{apiKey:'k',model:'m',fetchImpl:async(u,opt)=>{q=JSON.parse(opt.body);return done({});}});
  assert.equal(q.instructions,standingPrompt);assert.match(q.input.at(-1).content,/\nNARRATOR THIS TURN: Sable the Bard[^\n]*$/,'the narrator\'s line is last');
  const notes=[];await generate({input:'I look.',context:{...ctx,storyPreferences:{narrator:'lamplighter'}}},{apiKey:'k',model:'m',fetchImpl:async(u,opt)=>{const x=JSON.parse(opt.body);notes.push(x);return done(notes.length===1?{narration:'You gain 900 gold.',actionId:'invent-gold'}:{});}});
  assert.match(requestParts(notes[1]).tail,/^LOOK AGAIN:[\s\S]*\nNARRATOR THIS TURN: Wick the Lamplighter[^\n]*$/,'a retry\'s note, then the narrator last');}

 // ---- 3. The scene: in parts from what lasts to what changes, the player's words in the last ----
 const names=['what lasts the tale','the land and what the hero carries','who is here','the story so far'];
 assert.deepEqual(sceneParts.map(p=>p.name),names);
 for(const {label,q} of sent){
  const users=q.input.filter(m=>String(m.content).startsWith('Scene: ')),heads=users.map(m=>m.content.split('\n')[0]);
  assert.ok(q.input.slice(1).every((m,i,a)=>String(m.content).startsWith('Scene: ')||i===a.length-1),label+': the scene parts sit between the hero and this turn\'s note');
  assert.equal(heads.at(-1),'Scene: this turn, and the player\'s message.',label);
  const order=heads.slice(0,-1).map(h=>names.indexOf(h.replace(/^Scene: |\.$/g,'')));assert.ok(order.every((n,i)=>n>=0&&(i===0||n>order[i-1])),label+': the parts in order: '+heads);
  const last=JSON.parse(users.at(-1).content.slice(users.at(-1).content.indexOf('\n')+1)),body=requestScene(q);
  assert.equal(Object.keys(last).at(-1),'input',label+': the player\'s words come last');
  const keys=Object.keys(last.context);if(keys.includes('now'))assert.equal(keys.at(-1),'now',label+': what is true now closes the scene');
  for(const m of users.slice(0,-1)){const part=JSON.parse(m.content.slice(m.content.indexOf('\n')+1)).context;assert.ok(!part.player?.health,label+': the hit points go with this turn');assert.ok(!('now' in part)&&!('choices' in part)&&!('recentEvents' in part));}
  if(body.context.player?.health)assert.ok(last.context.player?.health,label+': the hero\'s hit points with this turn');
  assert.ok(!/:null[,}]|:\[\][,}]|:\{\}[,}]|:""[,}]/.test(JSON.stringify(body.context)),label+': nothing empty is sent');}
 {const s=requestScene(at('fighter: town')),keys=Object.keys(s.context);assert.ok(keys.indexOf('story')<keys.indexOf('world')&&keys.indexOf('world')<keys.indexOf('memory')&&keys.indexOf('memory')<keys.indexOf('choices'),'what lasts the tale, then the land, then the story so far, then this turn');
  assert.equal(s.input,'I look around the market.');}

 // ---- 4. Only what the moment needs ----
 {const fq=at('fighter: town');assert.ok(!/spellReference|rulesReference/.test(JSON.stringify(fq.input)),'a fighter\'s request has no spell reference');assert.ok(/spellReference/.test(JSON.stringify(at('wizard: town').input)),'a wizard\'s has theirs');
  assert.ok(!JSON.parse(fq.input[0].content.slice(fq.input[0].content.indexOf('(reference): ')+13)).some(f=>/spell/i.test(f.automation??'')&&f.class!=='Fighter'),'the hero\'s features are their own');}
 {const named=requestScene(await (async()=>{let q=null;await generate({input:'Could I cast Fire Bolt here?',context:r.dmContext(fighter,f3.game,null,'x')},{apiKey:'k',model:'m',fetchImpl:async(u,opt)=>{q=JSON.parse(opt.body);return done({});}});return q;})()).context;
  assert.equal(named.rulesReference.spells[0].name,'Fire Bolt');assert.equal(named.rulesReference.spells[0].availableToCharacter,false,'a spell the player names is looked up, marked as not theirs');}
 {const s=sceneOf('long life: fight, words');
  assert.ok(s.memory&&Object.keys(s.memory).every(k=>['taleNow','facts','about'].includes(k))&&s.memory.taleNow.length<=2,'a fight carries a short memory: '+Object.keys(s.memory??{}));
  for(const k of ['farLands','morePlaces','regions'])assert.equal(s.world[k],undefined,'no '+k+' in a fight');
  assert.equal(s.peopleElsewhere,undefined,'nobody elsewhere in a fight');assert.ok((s.npcSocialState??[]).every(n=>n.present!==false),'only the people here');
  assert.ok((s.journal??[]).length<=2);
  const calm=sceneOf('long life: town');assert.ok(calm.memory.earlierTales?.length,'out of a fight the memory is told in full');
  assert.ok(calm.world.farLands.length<=10,'the nearest lands only');assert.ok(calm.world.regions.length>=29,'every land still named');
  assert.ok(sceneOf('long life: town again').world.farLands.some(l=>l.name==='The Land of 25'),'a land the player names is kept');
  assert.ok(JSON.stringify(s).length<JSON.stringify(calm).length*0.6,'a fight reads far less than a calm turn: '+JSON.stringify(s).length+' of '+JSON.stringify(calm).length);
  // Every check on the reply still sees the whole context: the trims touch only what the model reads.
  const whole=r.dmContext(fighter,lb.game,lb.health,'x');assert.ok(whole.world.farLands.length>10&&whole.peopleElsewhere?.length,'the context itself is whole');}
 {const s=sceneOf('fighter: conversation');const near=(s.nearbyNPCs??[]).find(n=>n.id==='keeper'),social=s.npcSocialState.find(n=>n.id==='keeper');
  assert.ok(near&&social&&near.attitude===undefined&&social.attitude,'attitude told once, with the standings');assert.ok(near.role&&social.role===undefined,'the role told once, with who is here');
  assert.deepEqual(Object.keys(s.conversationParticipants[0]).sort(),['id','name']);
  const labels=sceneOf('fighter: town').choices.map(c=>c.label);assert.equal(labels.filter(l=>/an Unarmed Strike: they save against DC [0-9]+ or are held/.test(l)).length,1,'a note several choices share is given once');assert.equal(labels.filter(l=>/days on the road/.test(l)).length,1);assert.ok(labels.filter(l=>/^Grapple /.test(l)).length>1);}
 // What each phase cannot use is left out when the reply is read (the one schema allows it).
 {const told=await generate({input:'',context:{...ctx,engineResolved:['You travel to the mill.']}},{apiKey:'k',model:'m',fetchImpl:async()=>done({narration:'You arrive.',actionId:'travel-inn',worldEvent:'x',recruitment:[{npcId:'keeper',decision:'join',reason:'Why not.',terms:'',dc:null,class:null}]})});
  assert.deepEqual([told.narration,told.actionId,told.worldEvent,told.recruitment],['You arrive.',null,null,[]],'a telling only tells');
  const ooc=await generate({input:'DM, why?',context:{...ctx,outOfCharacter:{canRewind:false,lastTurn:null}}},{apiKey:'k',model:'m',fetchImpl:async()=>done({narration:'Because the dice said so.',dialogue:[{speakerId:'keeper',text:'Hm.'}],suggestions:['I ask again.'],rewind:null,fault:null})});
  assert.deepEqual([ooc.dialogue,ooc.suggestions,ooc.rewind,ooc.fault],[[],[],false,false],'out of character only talks');
  const turn=await generate({input:'I look.',context:ctx},{apiKey:'k',model:'m',fetchImpl:async()=>done({narration:'You look.',rewind:true,fault:true})});assert.deepEqual([turn.rewind,turn.fault],[false,false]);
  const ruled=await generate({input:'I cast Detect Magic.',context:{...ctx,pendingSpell:{id:'detect-magic',spell:{name:'Detect Magic'}}}},{apiKey:'k',model:'m',fetchImpl:async()=>done({narration:'You feel for magic.'})});
  assert.equal(ruled.ruling.decision,'clarify','no ruling on the spell awaiting one: asked again, then a clarify that spends nothing');}

 // ---- 5. prompt_cache_key: one for a hero's every request, whatever its phase ----
 {const keys=sent.filter(x=>x.label.startsWith('fighter: ')).map(x=>x.q.prompt_cache_key);
  assert.ok(keys.every(k=>k===keys[0])&&/^qb-dm-[0-7]$/.test(keys[0]),'the same key for a hero\'s turns, tellings, retries and second looks: '+[...new Set(keys)]);
  assert.ok(sent.every(x=>/^qb-dm-[0-7]$/.test(x.q.prompt_cache_key)));assert.equal(sent.every(x=>x.q.store===false),true,'store stays off');
  assert.deepEqual(cacheKeyFor({context:{story:{id:'a'},player:{name:'Kara'}}}),cacheKeyFor({context:{story:{id:'a'},player:{name:'Kara'},engineResolved:['x']}}));
  // A provider that does not know the key is asked again without it, and never again with it.
  const seen=[];const once=async(u,opt)=>{const q=JSON.parse(opt.body);seen.push(q);if(q.prompt_cache_key)return {ok:false,status:400,headers:{get:()=>null},json:async()=>({error:{message:"Unknown parameter: 'prompt_cache_key'.",code:'unknown_parameter',param:'prompt_cache_key'}})};return done({narration:'Fine.'});};
  const out=await generate({input:'I look.',context:ctx},{apiKey:'k',model:'m',fetchImpl:once});
  assert.equal(out.narration,'Fine.');assert.equal(seen.length,2);assert.equal(seen[1].prompt_cache_key,undefined);
  await generate({input:'I look.',context:ctx},{apiKey:'k',model:'m',fetchImpl:once});assert.equal(seen.length,3,'not tried again');
  delete globalThis.__questboundNoCacheKey;
  // Any other refusal is reported as before.
  await assert.rejects(generate({input:'I look.',context:ctx},{apiKey:'k',model:'m',fetchImpl:async()=>({ok:false,status:400,headers:{get:()=>null},json:async()=>({error:{message:'Bad request.'}})})}),/could not complete this request/);
  assert.equal(globalThis.__questboundNoCacheKey,undefined);
  assert.equal(promptLayout,4);}

 // ---- 6. What a warm cache can reuse: every leading part a request shares with one sent before it ----
 const U=sent.map(x=>units(x.q)),T=U.map(u=>u.map(tokens));
 const reuse=(i,j)=>{const n=sharedUnits(U[i],U[j]);return T[i].slice(0,n).reduce((a,b)=>a+b,0);};
 const total=i=>T[i].reduce((a,b)=>a+b,0);
 const idx=label=>sent.findIndex(x=>x.label===label);
 {const share=(a,b)=>sharedUnits(U[idx(a)],U[idx(b)]);
  // (The first move drops the tale's opening lines, once a tale.)
  const t1=idx('fighter: conversation');assert.equal(share('fighter: conversation','fighter: town again'),U[t1].length-1,'two calm turns of a hero share every part but this turn');
  assert.equal(share('fighter: fight, words','fighter: fight'),U[idx('fighter: fight, words')].length-1,'so do two turns of a fight');
  for(const [again,first] of [['fighter: retried (asked again)','fighter: retried'],['fighter: second look (asked again)','fighter: second look']])assert.equal(share(again,first),U[idx(first)].length,again+': everything before its note is the same as the first ask');
  assert.ok(share('fighter: second look (telling)','fighter: second look')>=3,'a telling shares the instructions, the hero and what lasts the tale with the turn before it');
  assert.ok(share('wizard: town','fighter: town')>=1,'two heroes share the schema and the instructions');
  assert.ok(share('wizard: ruling','wizard: town')>=3&&share('wizard: out of character','wizard: town')>=3&&share('wizard: scene cue','wizard: town')>=3,'a ruling, a word out of character and a scene cue share the instructions, the hero and the tale with the hero\'s turns');}
 let cached=0,all=0,rows=[];
 sent.forEach(({label},i)=>{let best=0;for(let j=0;j<i;j++)best=Math.max(best,reuse(i,j));const c=best>=1024?best:0;if(i>0){cached+=c;all+=total(i);}rows.push({label,pct:Math.round(100*c/total(i)),tokens:total(i)});});
 const pct=Math.round(100*cached/all);
 if(process.argv.includes('--rows'))for(const x of rows)console.log(String(x.pct).padStart(4)+'%  '+String(x.tokens).padStart(6)+'  '+x.label);
 assert.ok(pct>=80,'most of each request can come from a warm cache: '+pct+'%');
 // dm-report.cjs shows the cached share and the input per turn, for turns sent in parts, in the cache order and before it.
 {const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'qb-cache-'));
  const now=new Date().toISOString(),line=o=>JSON.stringify({at:now,mode:'turn',model:'gpt-6-luna',output:200,reasoning:0,ask:1,...o});
  fs.writeFileSync(path.join(dir,'.questbound-usage.jsonl'),[line({input:20000,cached:10000}),line({input:19000,cached:17000,layout:2}),line({input:20000,cached:15000,layout:3,phase:'turn'}),line({input:20000,cached:18000,layout:4,phase:'turn'}),line({input:18000,cached:16000,layout:4,phase:'told'}),line({input:20000,cached:19000,layout:4,phase:'turn',ask:2,aside:true})].join('\n')+'\n');
  const out=require('node:child_process').spawnSync(process.execPath,['dm-report.cjs','--dir',dir],{cwd:__dirname,encoding:'utf8'}).stdout;fs.rmSync(dir,{recursive:true,force:true});
  assert.match(out,/sent in parts: 3 turn requests, 19333 input tokens each on average, 91% of them cached/);assert.match(out,/by phase: turns 2 \(93%\), tellings and cues 1 \(89%\), second looks 1 \(95%\)\./);
  assert.match(out,/in parts with developer notes \(until 20 October\): 1 turn requests, 20000 input tokens each on average, 75% of them cached/);
  assert.match(out,/in the cache order: 1 turn requests, 19000 input tokens each on average, 89% of them cached/);assert.match(out,/before it: 1 turn requests, 20000 input tokens each on average, 50% of them cached/);}
 console.log('Cache order: one reply schema for every phase naming nothing of the turn; the instructions are the standing prompt alone ('+tokens(standingPrompt)+' tokens), the same for every hero, phase, retry and second look; then the hero, the scene in parts from what lasts to what changes with the player\'s words last, and this turn\'s note (phase, retry, narrator last); a fighter without spells, a fight with a short memory and no far lands; prompt_cache_key one per hero. About '+pct+'% of '+(sent.length-1)+' requests after the first (about '+Math.round(all/(sent.length-1))+' tokens each) could come from a warm cache.');
})().catch(e=>{console.error(e);process.exit(1);});
