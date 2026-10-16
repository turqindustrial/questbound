const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const {rulesSource}=require('./rules-files.cjs');
// The Dungeon Master is asked with less: standing guidance lives in the cached instructions, the scene drops what the
// model would read twice or cannot use this phase, small overruns in a reply are repaired instead of refused, test
// runs leave no trace in the local logs, and stories and heroes can come from a separate (thinking) model.
const server=require(process.env.QB_DM??'./dm-server.cjs'),{generate,sceneFor,repairedDiscovery,repairedCreature,repairedIntroduce,contractInstructions}=server;
const {modelOptions,providerTimeout,outputBudget,effortOf}=require('./ai-request.cjs');
const {generateAdventure}=require(process.env.QB_ADV??'./adventure-generator.cjs');
const {checkSetup}=require('./check-dm-setup.cjs');
const source=rulesSource({extra:['worldArtRules.js']});
const r=vm.runInNewContext(source+'\n({readyHero,hostileEncounterGame,newAdventure,appendStoryLog,withMemory,rememberFacts,memoryLimits,dmContext,conversationPeople,adventureStep,validAdventure,adventureSnapshot,maxWorldPlaces,maxRegions,maxPeople,placesInFull,placesByName,landsInFull,peopleInBrief,peopleByName})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const hero=r.readyHero('wizard'),hp={current:8,temp:0};
const camp={...r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0),stage:'inn'};delete camp.openingAttackAvailable;
const chat=Array.from({length:9},(_,i)=>({kind:'note',title:'AI DM conversation',text:'Player: hello '+i+'\nAI DM: '+'words '.repeat(300)}));
const game={...camp,journal:{entries:[...(camp.journal?.entries??[]),...chat]}};
const context=hero=>({...r.dmContext(hero,game,hp),storyPreferences:{brutality:'gritty'},conversationWith:null,conversationParticipants:r.conversationPeople(game).map(n=>({id:n.id,name:n.name,role:n.role,attitude:n.attitude}))});
const full=context(hero),body={input:'I look around the camp.',context:full};
// ---- The scene the model reads ----
const sent=sceneFor(body,{canDiscover:true,canAmbush:false});
assert.equal(sent.input,body.input);const s=sent.context;
for(const key of ['actionContract','loadoutGuidance','castingHelp'])assert.equal(s[key],undefined,key+' moved into the instructions');
for(const text of ['Never invent an action ID','opening strike','attackOptions.mainWeapon','I cast [spell] on [target]','(trained) or (expert)'])assert.ok(contractInstructions.includes(text),text);
assert.ok(s.skillChecks.every(x=>typeof x==='string')&&s.skillChecks.some(x=>/^Arcana: Intelligence \+\d+ \(trained\)$/.test(x)),JSON.stringify(s.skillChecks.slice(0,3)));
assert.equal(s.story.npcs.keeper.appearance,undefined,'Portrait text is for the painter');assert.equal(s.story.npcs.keeper.personality,full.story.npcs.keeper.personality);
assert.deepEqual(Object.keys(s.story.locations.bridge),['name'],'Places are described once, in world.knownPlaces');assert.equal(s.story.foeStats,undefined);
assert.ok(!s.journal.some(e=>e.title==='AI DM conversation'),'Conversation is kept once');assert.equal(s.conversationHistory.length,6);assert.ok(s.conversationHistory.every(e=>e.text.length<=1000&&e.text.endsWith('…')));
assert.ok(Array.isArray(s.world.creatureTemplates)&&s.world.creatureTemplates.every(t=>typeof t==='string')&&s.world.creatureTemplates.some(t=>/^bandit: Bandit Cutthroat \(Human\), signature move /.test(t)));
assert.equal(s.world.knownPlaces.find(p=>p.id==='inn').description,undefined,'The current place is described in world.current');assert.ok(s.world.knownPlaces.filter(p=>p.id!=='inn').every(p=>p.description.length<=140));
assert.equal(s.travelRoutes,undefined,'Distances are in world.knownPlaces');assert.equal(s.npcDefenses,undefined,'No fight, no defenses');
assert.ok(s.spellReference.length>0,'An ordinary turn keeps the spell list');assert.ok(s.choices.length>0);
assert.ok(JSON.stringify(sent).length<JSON.stringify(body).length*0.9,'Smaller again on the server (the device already sends skills as lines and only the defenses of people here): '+JSON.stringify(sent).length+' of '+JSON.stringify(body).length);
// The device already sends the conversation once and briefly, without the old travel list, so a land of many people
// and places stays well inside the 64 kB request limit.
assert.equal(full.conversationHistory.length,6);assert.ok(full.conversationHistory.every(e=>e.text.length<=1000));assert.ok(!full.journal.some(e=>e.title==='AI DM conversation'));assert.equal(full.travelRoutes,undefined);
{const crowd={...game,people:{},npcMemory:{},world:{at:null,places:Array.from({length:40},(_,i)=>({id:'p'+(i+1),name:'Place number '+(i+1),description:'A long description of a place that runs on about stone and moss and the river and the old roads and the people who once lived there. '.repeat(3).slice(0,300),kind:'settlement',x:(i+1)*3000,y:(i+1)*900,from:i?'p'+i:'inn'}))}};
 for(let i=1;i<=48;i++){crowd.people['n'+i]={name:'Person Named '+i,species:'Human',role:('A role that runs to some length for person '+i+'. ').repeat(4).slice(0,200),appearance:'A face '.repeat(60).slice(0,400),personality:'Calm and slow. '.repeat(14).slice(0,200),motive:'Wants things. '.repeat(22).slice(0,300),toughness:'common',home:'p'+(1+i%40),foe:'neutral',resident:true};crowd.npcMemory['n'+i]={attitude:'friendly',response:'Warm toward the player.',memories:['I remember the player helped me carry the nets up from the quay in the rain and the wind.','They asked about my brother and listened to the whole of it.','They paid fair for the bread and asked after my mother.']};}
 const big={input:'I look around the camp.',context:{...r.dmContext(hero,crowd,hp),storyPreferences:{brutality:'gritty'},conversationWith:null,conversationParticipants:[]}},bytes=Buffer.byteLength(JSON.stringify(big));
 assert.ok(bytes<60000,'48 people and 40 places fit in one request: '+bytes+' bytes');
 const away=big.context.npcSocialState.find(n=>n.present===false&&!['keeper','mara'].includes(n.id));assert.equal(away.present,false);assert.ok(away.role.length<=100&&away.metHero===false&&away.memories===undefined&&away.appearance===undefined,'someone elsewhere, not yet met, is sent in brief');}
// Lands travelled are never forgotten (2026-10-12), so the largest world a save can hold must still fit one request:
// 60 lands, 150 places (long descriptions, features, lairs), 96 people (long roles, looks and motives, memories,
// grudges and debts), four of them here, and six long exchanges. The land the hero is in is told in full for its
// nearest places, by name for the rest; other lands in brief; people not here in brief, then by name; people of
// other lands not at all. Measured with the hero in a land holding every place, and with places spread over every land.
const largestWorld=[],memorySent=[];
{const long=(t,n)=>(t+' ').repeat(Math.ceil(n/(t.length+1))).slice(0,n);
 // The story so far at its fullest (memoryRules.js, 2026-10-13): a hero's life of 125 tales of six chapters, every
 // chapter full of long lines, forty open facts and twenty settled ones, all of them long, and twelve long world facts.
 const lifeMemory=(()=>{let g={...camp,storyLog:[]};const say=(k,t)=>{g={...g,storyLog:r.appendStoryLog(g.storyLog,k,t)};};
  for(let t=1;t<=125;t++){say('story',long('Tale '+t+' of a long life',90)+': the tale began at '+long('Haven '+t,50)+'.');
   for(let c=1;c<=6;c++){if(c>1)say('story','Chapter '+c+': '+long('Part '+c+' of tale '+t,90));for(let i=0;i<16;i++)say(['deed','death','person','victory'][i%4],long((['','You killed ','Met ','Slew '][i%4])+'Line '+t+'.'+c+'.'+i+' that matters',150));g=r.withMemory(g);}
   if(t<125)say('quest','Adventure complete: '+long('Tale '+t,100)+'.');g=r.withMemory(g);}
  const words='amber barrow cinder dapple ember fallow gorse heron ingot juniper kestrel lantern meadow nettle osier pewter quarry rowan sorrel thistle umber vellum willow yarrow zither'.split(' ');
  const fact=i=>r.rememberFacts(g,[{text:Array.from({length:30},(_,k)=>words[(i*7+k*11)%25]+(i*31+k)).join(' ').slice(0,158),about:i%2?['n1','p1']:['n'+(5+i%80)],settles:null}]).game;
  for(let i=0;i<30;i++)g=fact(i);
  for(let i=0;i<20;i++)g=r.rememberFacts(g,[{text:long('It ended, after all, in the way the old songs said it would, number '+i,158),about:[],settles:g.memory.facts.find(f=>!f.settled).id}]).game;
  for(let i=30;i<80;i++)g=fact(i);
  assert.equal(g.memory.facts.filter(f=>!f.settled).length,r.memoryLimits.openFacts);
  // Every fact about the people and the place where the hero stands (camp has no such people; the atlas below does).
  return {storyLog:g.storyLog,memory:{...g.memory,facts:g.memory.facts.map(f=>({...f,about:['n1','p1'],names:[long('Person Named 1',24),long('Place number 1',28)]}))}};})();
 const worldFacts=Array.from({length:12},(_,i)=>long('A lasting consequence of what the hero did, number '+i,800));
 const atlas=(mode,at)=>{
  const regions=Array.from({length:r.maxRegions-1},(_,i)=>({id:'r'+(i+1),name:long('The Land of '+(i+1),28),terrain:'hills',last:i})),places=[];
  for(let i=1;i<=r.maxWorldPlaces;i++){const region=mode==='one'?'r1':regions[(i-1)%regions.length].id,prev=places.filter(p=>p.region===region).at(-1);
   places.push({id:'p'+i,name:long('Place number '+i,28),description:long('A long description of place '+i+' about stone and moss and the river and the old roads',300),kind:'settlement',x:i*30000,y:i*9000,from:prev?.id??'inn',region,...(i%2?{feature:long('A notable thing at place '+i,200)}:{}),...(i%5===0?{danger:'lair',threat:{template:'bandit',name:'Threat '+i,appearance:long('A scarred figure in a torn cloak',400)}}:{})});}
  const people={},memory={};
  for(let i=1;i<=r.maxPeople;i++){people['n'+i]={name:long('Person Named '+i,24),species:'Human',role:long('A role that runs to some length for person '+i+'.',200),appearance:long('A face weathered by wind and years',400),personality:long('Calm and slow.',200),motive:long('Wants things and will not say why.',300),pool:'np'+String(i).padStart(3,'0'),hook:long('Hides a letter from a dead brother under the floor of the mill',240),toughness:'common',home:i<=4?'p1':places[i%places.length].id,foe:'neutral',resident:true,tie:{to:'n'+(i%r.maxPeople+1),kind:'friend'}};
   memory['n'+i]={attitude:i%3===0?'hostile':'friendly',response:'Warm toward the player.',...(i%3===0?{grudge:'The player killed my brother at the ford and laughed about it after.'}:i%3===1?{bond:'The player pulled me out of the river when the ferry rope snapped.'}:{}),memories:['I remember the player helped me carry the nets up from the quay in the rain and the wind.','They asked about my brother and listened to the whole of it.','They paid fair for the bread and asked after my mother.']};}
  const g={...game,stage:at==='inn'?'inn':'wild',world:{places,regions,at:at==='inn'?null:at},people,npcMemory:memory,...lifeMemory,worldFacts};
  g.map={...g.map,visited:[...new Set([...g.map.visited,...places.map(p=>p.id)])],accepted:true};return g;};
 for(const mode of ['one','spread'])for(const at of ['p1','inn']){
  const big=atlas(mode,at),saved=r.adventureSnapshot(hero,{...big,journal:camp.journal},hp,true);
  assert.ok(r.validAdventure(JSON.parse(JSON.stringify(saved)),hero),'the largest world is a valid save ('+mode+', '+at+')');
  // With a full story log (400 long lines) and the memory of a long life (memoryRules.js) the largest save grows by about 180 kB.
  assert.ok(Buffer.byteLength(JSON.stringify(saved))<500000,'and a save of a sane size: '+Buffer.byteLength(JSON.stringify(saved)));
  const said='I look around. '.repeat(72).slice(0,1000),ctx=r.dmContext(hero,big,hp,said),request={input:said,context:{...ctx,storyPreferences:{brutality:'gritty'},conversationWith:null,conversationParticipants:r.conversationPeople(big).map(n=>({id:n.id,name:n.name,role:n.role,attitude:n.attitude}))}};
  const bytes=Buffer.byteLength(JSON.stringify(request));largestWorld.push(bytes);assert.equal(ctx.world.poolTaken.length,r.maxPeople,'every person met from the people library is named to the server (by number)');memorySent.push(Buffer.byteLength(JSON.stringify(ctx.memory)));assert.ok(ctx.memory.taleNow.length>=2&&(ctx.memory.facts??ctx.memory.otherFacts).length&&ctx.memory.earlierTales.length,'the story so far is told in full measure');assert.ok(bytes<60000,'60 lands, 150 places and 96 people fit in one request ('+mode+', at '+at+'): '+bytes+' bytes');
  const w=ctx.world;assert.equal(w.regions.length,r.maxRegions,'every land is named');assert.ok(w.knownPlaces.filter(p=>p.description!==undefined).length<=r.placesInFull+3,'only the nearest places in full');
  if(mode==='one'&&at==='p1'){assert.equal(w.morePlaces.length,r.placesByName);assert.ok(w.morePlacesNotListed>0);assert.ok(ctx.npcSocialState.filter(n=>n.present===false).length<=r.peopleInBrief);assert.ok(ctx.peopleElsewhere.length<=r.peopleByName);}
  if(mode==='spread'){assert.ok(w.farLands.length>=50);assert.ok(w.farLands.every(l=>l.road));{const listed=w.farLands.filter(l=>l.places).length;assert.ok(listed<=r.landsInFull&&listed>=r.landsInFull-3,'the nearest lands with their places by name: '+listed);}}
  if(mode==='spread'&&at==='inn')assert.ok(!ctx.npcSocialState.some(n=>n.present===false&&big.people[n.id]&&big.world.places.find(p=>p.id===big.people[n.id].home)?.region),'people of other lands are not sent');
  const t=Date.now();for(let k=0;k<3;k++)r.dmContext(hero,big,hp,said);assert.ok((Date.now()-t)/3<1500,'and it is quick to tell: '+(Date.now()-t)/3+' ms');}}
// The fallen not yet searched reach the model as they are (lootRules.js).
{const spoils=[{name:'Grey Widow',kind:'creature',what:'Giant spider',lair:true,feature:'A satchel under the webs.'}];assert.deepEqual(sceneFor({...body,context:{...full,spoils}},{}).context.spoils,spoils,'context.spoils survives the trim');}
const quiet=sceneFor(body,{}).context;assert.equal(quiet.world.creatureTemplates,undefined,'Templates only when a creature can appear');
const narrated=sceneFor({...body,context:{...full,engineResolved:['You rest.']}},{}).context;assert.deepEqual(narrated.choices,[]);assert.equal(narrated.spellReference,undefined);assert.equal(narrated.recentEvents.length,Math.min(4,full.recentEvents.length));
const legacy=sceneFor({input:'x',context:{...r.dmContext(hero,r.newAdventure(hero),hp)}},{}).context;assert.ok(Array.isArray(legacy.travelRoutes),'Without a written story the routes stay');
assert.deepEqual(sceneFor({input:'x',context:{choices:[]}},{}),{input:'x',context:{now:['No fight is in progress here: nothing is attacking the player, who is free to act, talk, rest where it is offered and travel.'],choices:[]}},'A bare context passes through, with what is true now put first');
// ---- Repairs instead of refusals ----
const long=n=>'x'.repeat(n);
const fixed=repairedDiscovery({name:' Drowned Chapel ',description:'A '+long(400),kind:'ruin',bearing:'N',miles:30,travel:true,danger:'risky',feature:long(250),lair:{template:'wolf',name:long(80),appearance:'Grey '+long(500),ally:null}});
assert.equal(fixed.name,'Drowned Chapel');assert.equal(fixed.description.length,300);assert.ok(fixed.description.endsWith('…'));assert.equal(fixed.feature.length,200);assert.equal(fixed.miles,12);assert.equal(fixed.danger,'lair','A creature makes it a lair');assert.equal(fixed.lair.name.length,60);assert.equal(fixed.lair.appearance.length,400);
assert.equal(repairedDiscovery({name:'Cairn',description:'Stones.',kind:'landmark',bearing:'E',miles:1,travel:false,danger:'lair',feature:'  ',lair:null}).danger,'risky','A lair without a creature is merely risky');
assert.equal(repairedDiscovery({name:'Cairn',description:'Stones.',feature:'  '}).feature,null);
assert.equal(repairedDiscovery(null),null);assert.equal(repairedCreature(null),null);assert.equal(repairedIntroduce(null,{}),null);
const beast=repairedCreature({template:'bandit',name:'Red Maddock',appearance:long(450),ally:{template:'wolf',name:'Hound',appearance:'A hound '+long(450)}});
assert.equal(beast.appearance.length,400);assert.equal(beast.ally.appearance.length,400);assert.equal(beast.ally.template,'wolf');
const met=repairedIntroduce({name:'Old Hob',species:'Human',role:long(260),appearance:'A '+long(500),personality:long(240),toughness:'frail',attitude:'indifferent',foe:'neutral',tie:{to:'n9',kind:'friend'}},full);
assert.equal(met.role.length,200);assert.equal(met.appearance.length,400);assert.equal(met.personality.length,200);assert.equal(met.tie,null,'A tie to nobody known is dropped');
assert.deepEqual(repairedIntroduce({name:'Hob',tie:{to:'keeper',kind:'friend'}},full).tie,{to:'keeper',kind:'friend'});
// ---- Through generate: the request, the repairs, and no log entries from a fake provider ----
const blank={narration:'The camp is quiet.',dialogue:[],recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null};
let request=null;const fake=reply=>async(url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',usage:{input_tokens:5000,output_tokens:100},output:[{content:[{type:'output_text',text:JSON.stringify({...blank,...reply})}]}]})};};
const size=file=>{try{return fs.statSync(file).size;}catch{return 0;}};
(async()=>{
 const logs=['.questbound-diagnostics.jsonl','.questbound-usage.jsonl'].map(f=>[f,size(f)]);
 const reply=await generate(body,{apiKey:'k',model:'gpt-6-luna',fetchImpl:fake({})});
 assert.equal(reply.narration,'The camp is quiet.');
 assert.deepEqual(request.reasoning,{effort:'none'},'Turns do not think');assert.equal(request.max_output_tokens,3000,'room for a long telling with four spoken lines');
 assert.ok(request.instructions.includes(contractInstructions),'The standing guidance is in the instructions');
 const input=JSON.parse(request.input);assert.equal(input.context.actionContract,undefined);assert.equal(input.input,body.input);assert.ok(Array.isArray(input.context.world.creatureTemplates),'A camp turn may reveal a lair');
 await generate(body,{apiKey:'k',model:'gpt-4.1',fetchImpl:fake({})});assert.equal(request.reasoning,undefined,'Models without reasoning are not sent the field');
 await generate(body,{apiKey:'k',model:'gpt-6-luna',reasoning:'low',fetchImpl:fake({})});assert.deepEqual(request.reasoning,{effort:'low'});assert.equal(request.max_output_tokens,9000,'Thinking needs room');
 const place={name:'Drowned Chapel',description:'A sunken chapel, '+long(400),kind:'ruin',bearing:'N',miles:2,travel:true,danger:'risky',feature:null,lair:{template:'wolf',name:'Greymaw',appearance:'A huge grey wolf, '+long(500),ally:null}};
 const found=await generate(body,{apiKey:'k',model:'gpt-6-luna',fetchImpl:fake({narration:'You find a chapel.',discovery:place})});
 assert.equal(found.discovery.danger,'lair');assert.equal(found.discovery.description.length,300);assert.equal(found.discovery.lair.appearance.length,400);
 const wilds={...body,context:{...full,stage:'wild',world:{...full.world,canAmbush:true,canDiscover:false}}};
 const sprung=await generate(wilds,{apiKey:'k',model:'gpt-6-luna',fetchImpl:fake({narration:'It leaps.',ambush:{template:'boar',name:'Tusker',appearance:'A boar '+long(500),ally:null}})});
 assert.equal(sprung.ambush.appearance.length,400);
 // Still refused (asked again, then the turn goes on without it): a too-short description, an action not on offer.
 assert.equal((await generate(body,{apiKey:'k',model:'gpt-6-luna',fetchImpl:fake({narration:'x',discovery:{...place,description:'Short'}})})).discovery,null,'A too-short description is still refused');
 assert.equal((await generate(body,{apiKey:'k',model:'gpt-6-luna',fetchImpl:fake({narration:'x',actionId:'not-a-choice'})})).actionId,null);
 for(const [file,before] of logs)assert.equal(size(file),before,file+' is untouched by test runs');
 // Stories and heroes go to the story writer, which may think.
 await generate({input:'Create a fresh adventure.',context:{mode:'adventure',introId:'caravan',choices:[]}},{apiKey:'k',model:'gpt-6-luna',storyModel:'gpt-6-astra',fetchImpl:async(url,options)=>{request=JSON.parse(options.body);throw Error('stop');}}).catch(()=>{});
 assert.equal(request.model,'gpt-6-astra','The story writer model writes the adventure');
 const story={title:'T',premise:'P',opening:'O',objective:'J',resolution:'R',secret:'S',foe:'Bog hag',foeSpecies:'Hag',foeAppearance:'A bent green crone with river weed for hair.',locations:{inn:{name:'A',description:'a'},bridge:{name:'B',description:'b'},tower:{name:'C',description:'c'}},npcs:{keeper:{name:'Ivo',species:'Human',role:'r',motive:'m',appearance:'A tall man with a grey beard and a limp.',personality:'Gruff, slow to trust, quick to laugh.',ties:{other:'friend',foe:'enemy',note:'n'}},mara:{name:'Sera',species:'Elf',role:'r',motive:'m',appearance:'A slight elf with ink on her hands and a red scarf.',personality:'Curious and precise, always counting.',ties:{other:'friend',foe:'neutral',note:'n'}}}};
 const storyFetch=async(url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',usage:{input_tokens:9,output_tokens:9},output:[{content:[{type:'output_text',text:JSON.stringify(story)}]}]})};};
 let usage=null;await generateAdventure({context:{introId:'drowned'}},{apiKey:'k',model:'gpt-6-astra',reasoning:'medium',fetchImpl:storyFetch,onUsage:u=>{usage=u;}});
 assert.deepEqual(request.reasoning,{effort:'medium'});assert.equal(request.max_output_tokens,12000);assert.deepEqual(usage,{input_tokens:9,output_tokens:9});
 // Deep thought about a long tale gets plenty of room.
 await generateAdventure({context:{introId:'drowned'}},{apiKey:'k',model:'gpt-6-astra',reasoning:'high',fetchImpl:storyFetch});assert.deepEqual(request.reasoning,{effort:'high'});assert.equal(request.max_output_tokens,40000);
 await generateAdventure({context:{introId:'drowned'}},{apiKey:'k',model:'gpt-6-luna',fetchImpl:storyFetch});assert.deepEqual(request.reasoning,{effort:'none'});assert.equal(request.max_output_tokens,6000);
 // The models the host chose are read on live requests: the play model answers turns, the story writer follows it
 // unless it was set apart, and a malformed file changes nothing. A stand-in provider never reads them.
 {const {liveModels,chosenModel}=require('./dm-server.cjs'),files=f=>n=>f[n]??null;
  assert.deepEqual(liveModels('gpt-5.6-luna','gpt-5.6-luna',files({'.questbound-model':'gpt-6-luna'})),{model:'gpt-6-luna',storyModel:'gpt-6-luna'});
  assert.deepEqual(liveModels('gpt-5.6-luna','gpt-5.6-luna',files({'.questbound-model':'gpt-6-luna','.questbound-story-model':'gpt-5.6-luna'})),{model:'gpt-6-luna',storyModel:'gpt-5.6-luna'});
  assert.deepEqual(liveModels('gpt-6-luna','gpt-6-astra',files({'.questbound-model':'gpt-6-nova'})),{model:'gpt-6-nova',storyModel:'gpt-6-astra'},'A story writer set apart stays');
  assert.deepEqual(liveModels('a-model','a-model',files({})),{model:'a-model',storyModel:'a-model'});
  assert.equal(chosenModel('no-such-file'),null);assert.equal(chosenModel('launch.ps1'),null,'Only a bare model id counts');
  await generate(body,{apiKey:'k',model:'stand-in-model',fetchImpl:async(url,options)=>{request=JSON.parse(options.body);throw Error('stop');}}).catch(()=>{});assert.equal(request.model,'stand-in-model','Tests keep the model they pass');}
 // The setup check looks the story writer up without spending tokens.
 const calls=[];const setupFetch=status=>async(url,options)=>{calls.push(url);if(url.endsWith('/responses'))return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(blank)}]}]})};return {ok:status<400,status,json:async()=>({})};};
 assert.equal((await checkSetup({apiKey:'sk-test',model:'gpt-6-luna',storyModel:'gpt-6-astra',fetchImpl:setupFetch(200)})).ok,true);assert.ok(calls.at(-1).endsWith('/v1/models/gpt-6-astra'));
 const missing=await checkSetup({apiKey:'sk-test',model:'gpt-6-luna',storyModel:'gpt-6-nope',fetchImpl:setupFetch(404)});assert.equal(missing.ok,false);assert.equal(missing.kind,'story-model');
 calls.length=0;assert.equal((await checkSetup({apiKey:'sk-test',model:'gpt-6-luna',storyModel:'gpt-6-luna',fetchImpl:setupFetch(500)})).ok,true);assert.equal(calls.length,1,'The same model is not looked up again');
 // The request helper.
 assert.deepEqual(modelOptions('gpt-4.1','none'),{model:'gpt-4.1'});assert.deepEqual(modelOptions('o3','low'),{model:'o3',reasoning:{effort:'low'}});assert.deepEqual(modelOptions('gpt-6-luna','silly'),{model:'gpt-6-luna',reasoning:{effort:'none'}});
 assert.equal(effortOf(' Medium '),'medium');assert.equal(providerTimeout('none'),30000);assert.equal(providerTimeout('medium'),80000);assert.equal(outputBudget(2500,'minimal'),2500);assert.equal(outputBudget(2500,'high'),8500);
 // No check is offered while fighting people or once the action of a creature fight is spent (dm-rules refuses
 // both; bug: the schema offered one, the reply was refused and the whole turn failed), and a refusal of either kind
 // is asked again rather than shown to the player.
 {const check={skill:'Persuasion',ability:'Charisma',dc:13,mode:'normal',reason:'Talk them down',success:'They lower blades',failure:'They sneer',damageCount:0,damageDie:6,damageOn:'none'};
  for(const scene of [{npcCombat:{active:true},stage:'inn'},{stage:'combat',turnResources:{actionUsed:true}}]){
   const reply=await generate({input:'I shout at them to stop and try to talk them down.',context:{choices:[{id:'end-turn',label:'End turn'}],...scene}},{apiKey:'k',model:'gpt-6-luna',fetchImpl:fake({narration:'You raise your hands and plead.'})});
   assert.equal(request.text.format.schema.properties.check.type,'null','no check on offer');assert.equal(reply.check,null);}
  await generate({input:'I try to talk the guard round.',context:{choices:[],stage:'inn'}},{apiKey:'k',model:'gpt-6-luna',fetchImpl:fake({narration:'He listens.'})});assert.deepEqual(request.text.format.schema.properties.check.type,['object','null'],'a check stays on offer out of a fight');
  let asked=0;const stubborn=async(url,options)=>{asked++;request=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({...blank,narration:'You plead.',...(asked===1?{check}:{})})}]}]})};};
  const again=await generate({input:'I talk them down.',context:{choices:[],stage:'inn',npcCombat:{active:true}}},{apiKey:'k',model:'gpt-6-luna',fetchImpl:stubborn});assert.equal(asked,2,'a refused check is asked again');assert.equal(again.check,null);}
 // The errand reward (an Easy to get into tale): the telling of 'Chapter 1 complete' is asked to pay it, and pays the
 // gold the reward names when the reply leaves it out (bug: the instruction said to pay it beside story-advance,
 // where loot is always dropped, so the purse was never paid).
 {const errand={title:'Burn the camp',task:'Burn out the reaver camp.',place:'Reaver Camp',reward:'40 gold and the jarl\'s favour'};
  const context={choices:[],stage:'inn',inventory:{gold:10,items:[]},player:{level:1},story:{errand},engineResolved:['Chapter 1 complete: Burn the camp. A letter.','Chapter 2 begins: The Fjord. Find the ships.']};
  const paid=await generate({input:'I tell the jarl the camp is burned out.',context},{apiKey:'k',model:'gpt-6-luna',fetchImpl:fake({narration:'The jarl nods.'})});
  assert.match(request.instructions,/keeper hands over the promised reward \(40 gold and the jarl's favour\) now/);assert.equal(paid.loot?.gold,40,'the named gold is paid');
  const given=await generate({input:'I tell the jarl.',context},{apiKey:'k',model:'gpt-6-luna',fetchImpl:fake({narration:'He pays.',loot:{gold:25,items:[{name:'Jarl\'s Ring',kind:'treasure',qty:1,value:50,note:'Gold.',magic:null}],reason:'The promised reward'}})});
  assert.equal(given.loot.gold,25,'the model\'s own reward is kept as given');
  const later=await generate({input:'I tell the jarl.',context:{...context,engineResolved:['Chapter 2 complete: The Fjord.']}},{apiKey:'k',model:'gpt-6-luna',fetchImpl:fake({narration:'He nods.'})});assert.equal(later.loot,null,'only the errand\'s own chapter pays it');}
 console.log('Passed: the scene is trimmed ('+JSON.stringify(body).length+' to '+JSON.stringify(sent).length+' characters; the largest world of 60 lands, 150 places and 96 people, with the story so far of 125 tales and 60 facts, asks in '+Math.max(...largestWorld)+' bytes at most, '+Math.max(...memorySent)+' of them memory) with the guidance in the cached instructions, overruns in discoveries, creatures and introductions are repaired, fake-provider runs leave the logs alone, stories go to the story writer with thinking room, and the setup check looks that model up; no check is offered in a brawl or after the action is spent, and the errand’s reward is paid when its chapter is told.');
})().catch(e=>{console.error(e);process.exit(1);});
