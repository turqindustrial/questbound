// Better use of the provider's cache and a leaner turn (the host, 2026-10-17: "put everything that never changes first
// and the turn-by-turn details last, so OpenAI reuses far more of each request" and "only send what the moment needs
// (no spell reference for a fighter, less of the long story memory during a plain fight, fewer far-away places)").
// The provider reuses the longest start a request shares with one it saw shortly before, reading the reply schema
// first, then the instructions, then the input. This check drives whole turns through the campaign server's pipeline
// (server-turn.cjs: the real context, generate in dm-server.cjs) with a stand-in provider and asserts: the reply schema
// is one of four fixed shapes that name no one and nothing of this turn; the standing instructions come first and are
// the same for every hero, turn and phase; this hero's features, then the turn's phase and narrator follow; the scene is
// in the cache order with the player's words last; a fighter's request carries no spell reference; a fight's carries a
// short memory and no far-away lands; prompt_cache_key is stable (and dropped if the provider does not know it). It
// prints how much of each request a warm cache could reuse. No network, no AI, no logs written.
const assert=require('node:assert/strict'),vm=require('node:vm');
const r=require('./rules-engine.cjs').rules(),{resolveTurn}=require('./server-turn.cjs');
const server=require('./dm-server.cjs'),{generate,sceneFor,standingPrompt,heroPrompt,replySchemaFor,cacheKeyFor,promptLayout}=server;
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
const play=async(label,snapshot,request)=>{const before=calls.length;const out=await resolveTurn(snapshot,request,{ask,randomImpl:seq(7)});calls.slice(before).forEach((q,i)=>sent.push({label:label+(i?' (telling)':''),q}));return out;};
const snap=(hero,story=journeyStory(0))=>{const g=plain(R.freshStoryGame(hero,story,R.newAdventure(hero)));return R.adventureSnapshot(hero,{...g,map:{...g.map,accepted:true}},null,true);};
const promptOf=q=>JSON.stringify(q.text.format.schema)+'\n'+q.instructions+'\n'+q.input;
const shared=(a,b)=>{let i=0;const n=Math.min(a.length,b.length);while(i<n&&a.charCodeAt(i)===b.charCodeAt(i))i++;return i;};
// Roughly the provider's tokens: words with their leading space, numbers in threes, runs of punctuation.
const tokens=s=>{let n=0;for(const m of s.matchAll(/ ?[A-Za-z]+| ?\d{1,3}|\s+| ?[^\sA-Za-z\d]{1,3}/g))n+=m[0].length>10?Math.ceil(m[0].length/7):1;return n;};
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
 // ---- A session of turns: a town, a conversation, another hero, a fight, a brawl, a long life ----
 const f=snap(fighter),w=snap(wizard);
 let o=await play('fighter: town',f,{question:'I look around the market.'});const f2=o.snapshot;
 o=await play('fighter: town again',f2,{question:'I watch the people at the stalls for a while.'});const f3=o.snapshot;
 await play('fighter: conversation',f3,{question:'Reeve, what do you know about the mill?',npcId:'keeper'});
 await play('wizard: town',w,{question:'I look around the market.'});
 const mill=R.dmChoices(fighter,f3.game,f3.health).find(c=>/^travel-/.test(c.id)&&/Mill/.test(c.label));
 o=await play('fighter: to the mill',f3,{question:'I go to the Old Mill.',action:mill.action});const fight=o.snapshot;assert.equal(fight.game.stage,'combat','the mill is a lair');
 const bite=R.dmChoices(fighter,fight.game,fight.health).find(c=>/attack/.test(c.id));
 await play('fighter: fight',fight,{question:'I attack the wolf.',action:bite.action});
 await play('fighter: fight, words',fight,{question:'I shout at the wolf to back off.'});
 const punch=R.dmChoices(fighter,f3.game,f3.health).find(c=>/^npc-attack/.test(c.id));
 o=await play('fighter: brawl',f3,{question:'I hit '+punch.label,action:punch.action});
 const big={...f3,game:longGame(f3.game)};
 o=await play('long life: town',big,{question:'I look around the market.'});
 o=await play('long life: town again',o.snapshot,{question:'I ask the stallholders for news from The Land of 25.'});
 const lb=o.snapshot,lair=R.dmChoices(fighter,lb.game,lb.health).find(c=>/^travel-p(5|10|15|20)$/.test(c.id));
 o=await play('long life: to a lair',lb,{question:'I go there.',action:lair.action});assert.equal(o.snapshot.game.stage,'combat');
 await play('long life: fight, words',o.snapshot,{question:'I shout at the beast.'});
 // A spell awaiting a ruling, and the player speaking to the Dungeon Master out of character.
 const ctx=r.dmContext(wizard,w.game,null,'x');
 script=q=>done({narration:'x',ruling:q.text.format.schema.properties.ruling.type==='object'?{decision:'clarify',note:'Which way?',damage:0,selfDamage:0,healing:0,temporaryHP:0}:null,rewind:false,fault:false});
 await generate({input:'I cast Detect Magic.',context:{...ctx,pendingSpell:{id:'detect-magic',spell:{name:'Detect Magic'}}}},{apiKey:'k',model:'m',fetchImpl:async(u,opt)=>{const q=JSON.parse(opt.body);sent.push({label:'wizard: ruling',q});return script(q);}});
 await generate({input:'DM, what was that roll?',context:{...ctx,outOfCharacter:{canRewind:false,lastTurn:null}}},{apiKey:'k',model:'m',fetchImpl:async(u,opt)=>{const q=JSON.parse(opt.body);sent.push({label:'wizard: out of character',q});return script(q);}});
 script=null;

 // ---- 1. The reply schema: four fixed shapes, naming nothing of this turn, valid for strict output ----
 const shapes=new Map();
 for(const {label,q} of sent){const key=q.prompt_cache_key.split('-')[2],schema=JSON.stringify(q.text.format.schema);
  assert.equal(schema,JSON.stringify(replySchemaFor(key)),label+': the schema is the fixed '+key+' shape');
  if(shapes.has(key))assert.equal(shapes.get(key),schema);shapes.set(key,schema);
  assert.ok(!/"(?:keeper|mara|n\d+|np\d+|travel-[\w-]+|npc-attack[^"]*|end-turn)"/.test(schema),label+': the schema names no one and no choice');}
 assert.deepEqual([...shapes.keys()].sort(),['ooc','ruling','told','turn'],'every shape was sent');
 for(const shape of ['turn','told','ruling','ooc'])assert.deepEqual(strictProblems(replySchemaFor(shape),shape),[],'strict structured output');
 {const t=replySchemaFor('turn').properties,told=replySchemaFor('told').properties,ru=replySchemaFor('ruling').properties,ooc=replySchemaFor('ooc').properties;
  assert.equal(told.actionId.type,'null');assert.equal(told.check.type,'null');assert.equal(told.discovery.type,'null');assert.equal(told.recruitment.maxItems,0);
  assert.equal(ru.ruling.type,'object','a spell awaiting a ruling must have one');assert.equal(ru.actionId.type,'null');
  assert.equal(ooc.dialogue.maxItems,0);assert.equal(ooc.suggestions.maxItems,0);assert.equal(ooc.rewind.type,'boolean');assert.equal(t.rewind.type,'null');
  assert.equal(Object.keys(t)[0],'narration','narration still streams first');}

 // ---- 2. The instructions: the standing part first, the same for everyone; then the hero; then the turn ----
 for(const {label,q} of sent){
  assert.ok(q.instructions.startsWith(standingPrompt),label+': the standing instructions come first, unchanged');
  const rest=q.instructions.slice(standingPrompt.length);assert.ok(rest.startsWith('\nTHIS HERO\'S CLASS FEATURES (reference): '),label+': then the hero\'s features');
  for(const turnOnly of ['CURRENT PHASE','SCENE TRIGGER','OUT OF CHARACTER','NARRATOR THIS TURN','LOOK AGAIN'])assert.ok(!standingPrompt.includes(turnOnly+':'),turnOnly+' is never in the standing part');
  assert.ok(!/"spells"|"featureDetails"/.test(q.instructions),label+': the spells this turn names are read with the scene, not in the cached part');}
 assert.ok(standingPrompt.includes('"coreRules"')&&standingPrompt.includes('"actionRules"')&&standingPrompt.includes('OWN WORLD'),'the shared rules are in the standing part');
 assert.ok(sent.find(x=>x.label==='wizard: ruling').q.instructions.indexOf('Adjudicate pendingSpell')>standingPrompt.length,'the phase comes after the standing part');
 // The narrator's voice for this turn is still last (the model ignored a style note buried in the cached part).
 {const body={input:'I look.',context:{...ctx,storyPreferences:{narrator:'bard'}}};let q=null;await generate(body,{apiKey:'k',model:'m',fetchImpl:async(u,opt)=>{q=JSON.parse(opt.body);return done({});}});
  assert.ok(q.instructions.startsWith(standingPrompt)&&/NARRATOR THIS TURN: Sable the Bard[^\n]*$/.test(q.instructions),'the narrator\'s line is last');}

 // ---- 3. The scene: in the cache order, the player's words last ----
 for(const {label,q} of sent){const input=JSON.parse(q.input),keys=Object.keys(input.context);
  assert.equal(Object.keys(input).at(-1),'input',label+': the player\'s words come last');
  if(keys.includes('now'))assert.equal(keys.at(-1),'now',label+': what is true now closes the scene');
  if(keys.includes('story')&&keys.includes('choices'))assert.ok(keys.indexOf('story')<keys.indexOf('choices'),label+': what lasts the tale before what changes each turn');
  if(input.context.player?.health)assert.equal(Object.keys(input.context.player).at(-1),'health',label+': the hero\'s hit points last within the hero');
  assert.ok(!/:null[,}]|:\[\][,}]|:\{\}[,}]|:""[,}]/.test(JSON.stringify(input.context)),label+': nothing empty is sent');}

 // ---- 4. Only what the moment needs ----
 const at=label=>sent.find(x=>x.label===label).q,sceneOf=label=>JSON.parse(at(label).input).context;
 {const fq=at('fighter: town');assert.ok(!/spellReference|rulesReference/.test(fq.input),'a fighter\'s request has no spell reference');assert.ok(/spellReference/.test(at('wizard: town').input),'a wizard\'s has theirs');
  assert.ok(!JSON.parse(fq.instructions.slice(fq.instructions.lastIndexOf('(reference): ')+13).split('\n')[0]).some(f=>/spell/i.test(f.automation??'')&&f.class!=='Fighter'),'the hero\'s features are their own');}
 {const named=JSON.parse((await generate({input:'Could I cast Fire Bolt here?',context:r.dmContext(fighter,f3.game,null,'x')},{apiKey:'k',model:'m',fetchImpl:async(u,opt)=>{sent.push({label:'fighter: names a spell',q:JSON.parse(opt.body)});return done({});}}),sent.at(-1).q.input)).context;
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

 // ---- 5. prompt_cache_key ----
 {const keys=sent.filter(x=>x.label.startsWith('fighter: town')||x.label==='fighter: conversation').map(x=>x.q.prompt_cache_key);
  assert.ok(keys.every(k=>k===keys[0])&&/^qb-dm-turn-[0-3]$/.test(keys[0]),'the same key for a hero\'s turns: '+keys);
  assert.ok(sent.every(x=>/^qb-dm-(turn|told|ruling|ooc)-[0-3]$/.test(x.q.prompt_cache_key)));assert.equal(sent.every(x=>x.q.store===false),true,'store stays off');
  assert.deepEqual(cacheKeyFor('told',{context:{story:{id:'a'},player:{name:'Kara'}}}),cacheKeyFor('told',{context:{story:{id:'a'},player:{name:'Kara'}}}));
  // A provider that does not know the key is asked again without it, and never again with it.
  const seen=[];const once=async(u,opt)=>{const q=JSON.parse(opt.body);seen.push(q);if(q.prompt_cache_key)return {ok:false,status:400,headers:{get:()=>null},json:async()=>({error:{message:"Unknown parameter: 'prompt_cache_key'.",code:'unknown_parameter',param:'prompt_cache_key'}})};return done({narration:'Fine.'});};
  const out=await generate({input:'I look.',context:ctx},{apiKey:'k',model:'m',fetchImpl:once});
  assert.equal(out.narration,'Fine.');assert.equal(seen.length,2);assert.equal(seen[1].prompt_cache_key,undefined);
  await generate({input:'I look.',context:ctx},{apiKey:'k',model:'m',fetchImpl:once});assert.equal(seen.length,3,'not tried again');
  delete globalThis.__questboundNoCacheKey;
  // Any other refusal is reported as before.
  await assert.rejects(generate({input:'I look.',context:ctx},{apiKey:'k',model:'m',fetchImpl:async()=>({ok:false,status:400,headers:{get:()=>null},json:async()=>({error:{message:'Bad request.'}})})}),/could not complete this request/);
  assert.equal(globalThis.__questboundNoCacheKey,undefined);
  assert.equal(promptLayout,2);}

 // ---- 6. What a warm cache can reuse ----
 const prompts=sent.map(x=>promptOf(x.q)),head=q=>JSON.stringify(q.text.format.schema).length+1+q.instructions.length;
 const share=(i,j)=>shared(prompts[i],prompts[j]);
 {const i=sent.findIndex(x=>x.label==='fighter: town again'),j=sent.findIndex(x=>x.label==='fighter: town');
  assert.ok(share(i,j)/prompts[i].length>0.8,'two calm turns of a hero share most of the request: '+Math.round(100*share(i,j)/prompts[i].length)+'%');
  const wiz=sent.findIndex(x=>x.label==='wizard: town');assert.ok(share(wiz,j)>=JSON.stringify(sent[j].q.text.format.schema).length+standingPrompt.length,'two heroes share the schema and the standing instructions');}
 let cached=0,total=0;
 sent.forEach(({q},i)=>{let best=0;for(let j=0;j<sent.length;j++)if(j!==i)best=Math.max(best,j<i?share(i,j):Math.min(share(i,j),head(q)));const c=tokens(prompts[i].slice(0,best));cached+=c>=1024?c:0;total+=tokens(prompts[i]);});
 // dm-report.cjs shows the cached share and the input per turn, for turns in the cache order and before it.
 {const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'qb-cache-'));
  const now=new Date().toISOString(),line=o=>JSON.stringify({at:now,mode:'turn',model:'gpt-6-luna',output:200,reasoning:0,ask:1,...o});
  fs.writeFileSync(path.join(dir,'.questbound-usage.jsonl'),[line({input:20000,cached:10000}),line({input:19000,cached:17000,layout:2})].join('\n')+'\n');
  const out=require('node:child_process').spawnSync(process.execPath,['dm-report.cjs','--dir',dir],{cwd:__dirname,encoding:'utf8'}).stdout;fs.rmSync(dir,{recursive:true,force:true});
  assert.match(out,/in the cache order: 1 turn requests, 19000 input tokens each on average, 89% of them cached/);assert.match(out,/before it: 1 turn requests, 20000 input tokens each on average, 50% of them cached/);}
 const pct=Math.round(100*cached/total);assert.ok(pct>=70,'most of each request can come from the cache: '+pct+'%');
 console.log('Cache order: four fixed reply shapes naming nothing of the turn, the standing instructions first and the same for every hero and phase ('+tokens(standingPrompt)+' tokens), then the hero, the phase and the narrator; the scene from what lasts to what changes with the player\'s words last; a fighter without spells, a fight with a short memory and no far lands; prompt_cache_key stable. About '+pct+'% of '+sent.length+' requests (about '+Math.round(total/sent.length)+' tokens each) could come from a warm cache.');
})().catch(e=>{console.error(e);process.exit(1);});
