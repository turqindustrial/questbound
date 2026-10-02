const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
// The Dungeon Master is asked with less: standing guidance lives in the cached instructions, the scene drops what the
// model would read twice or cannot use this phase, small overruns in a reply are repaired instead of refused, test
// runs leave no trace in the local logs, and stories and heroes can come from a separate (thinking) model.
const server=require(process.env.QB_DM??'./dm-server.cjs'),{generate,sceneFor,repairedDiscovery,repairedCreature,repairedIntroduce,contractInstructions}=server;
const {modelOptions,providerTimeout,outputBudget,effortOf}=require('./ai-request.cjs');
const {generateAdventure}=require(process.env.QB_ADV??'./adventure-generator.cjs');
const {checkSetup}=require('./check-dm-setup.cjs');
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','adventureRules.js','skillRules.js','followerRules.js','adventureStorage.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','worldArtRules.js','iconPaths.js','quickActions.js','pregens.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,hostileEncounterGame,newAdventure,dmContext,conversationPeople,adventureStep})',{AsyncStorage:{},weaponIcon:()=>'sword'});
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
assert.ok(JSON.stringify(sent).length<JSON.stringify(body).length*0.75,'At least a quarter smaller: '+JSON.stringify(sent).length+' of '+JSON.stringify(body).length);
const quiet=sceneFor(body,{}).context;assert.equal(quiet.world.creatureTemplates,undefined,'Templates only when a creature can appear');
const narrated=sceneFor({...body,context:{...full,engineResolved:['You rest.']}},{}).context;assert.deepEqual(narrated.choices,[]);assert.equal(narrated.spellReference,undefined);assert.equal(narrated.recentEvents.length,Math.min(4,full.recentEvents.length));
const legacy=sceneFor({input:'x',context:{...r.dmContext(hero,r.newAdventure(hero),hp)}},{}).context;assert.ok(Array.isArray(legacy.travelRoutes),'Without a written story the routes stay');
assert.deepEqual(sceneFor({input:'x',context:{choices:[]}},{}),{input:'x',context:{choices:[]}},'A bare context passes through');
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
 assert.deepEqual(request.reasoning,{effort:'none'},'Turns do not think');assert.equal(request.max_output_tokens,2000);
 assert.ok(request.instructions.includes(contractInstructions),'The standing guidance is in the instructions');
 const input=JSON.parse(request.input);assert.equal(input.context.actionContract,undefined);assert.equal(input.input,body.input);assert.ok(Array.isArray(input.context.world.creatureTemplates),'A camp turn may reveal a lair');
 await generate(body,{apiKey:'k',model:'gpt-4.1',fetchImpl:fake({})});assert.equal(request.reasoning,undefined,'Models without reasoning are not sent the field');
 await generate(body,{apiKey:'k',model:'gpt-6-luna',reasoning:'low',fetchImpl:fake({})});assert.deepEqual(request.reasoning,{effort:'low'});assert.equal(request.max_output_tokens,8000,'Thinking needs room');
 const place={name:'Drowned Chapel',description:'A sunken chapel, '+long(400),kind:'ruin',bearing:'N',miles:2,travel:true,danger:'risky',feature:null,lair:{template:'wolf',name:'Greymaw',appearance:'A huge grey wolf, '+long(500),ally:null}};
 const found=await generate(body,{apiKey:'k',model:'gpt-6-luna',fetchImpl:fake({narration:'You find a chapel.',discovery:place})});
 assert.equal(found.discovery.danger,'lair');assert.equal(found.discovery.description.length,300);assert.equal(found.discovery.lair.appearance.length,400);
 const wilds={...body,context:{...full,stage:'wild',world:{...full.world,canAmbush:true,canDiscover:false}}};
 const sprung=await generate(wilds,{apiKey:'k',model:'gpt-6-luna',fetchImpl:fake({narration:'It leaps.',ambush:{template:'boar',name:'Tusker',appearance:'A boar '+long(500),ally:null}})});
 assert.equal(sprung.ambush.appearance.length,400);
 await assert.rejects(generate(body,{apiKey:'k',model:'gpt-6-luna',fetchImpl:fake({narration:'x',discovery:{...place,description:'Short'}})}),/could not use/,'A too-short description is still refused');
 await assert.rejects(generate(body,{apiKey:'k',model:'gpt-6-luna',fetchImpl:fake({narration:'x',actionId:'not-a-choice'})}),/invalid response/);
 for(const [file,before] of logs)assert.equal(size(file),before,file+' is untouched by test runs');
 // Stories and heroes go to the story writer, which may think.
 await generate({input:'Create a fresh adventure.',context:{mode:'adventure',introId:'caravan',choices:[]}},{apiKey:'k',model:'gpt-6-luna',storyModel:'gpt-6-astra',fetchImpl:async(url,options)=>{request=JSON.parse(options.body);throw Error('stop');}}).catch(()=>{});
 assert.equal(request.model,'gpt-6-astra','The story writer model writes the adventure');
 const story={title:'T',premise:'P',opening:'O',objective:'J',resolution:'R',secret:'S',foe:'Bog hag',foeSpecies:'Hag',foeAppearance:'A bent green crone with river weed for hair.',locations:{inn:{name:'A',description:'a'},bridge:{name:'B',description:'b'},tower:{name:'C',description:'c'}},npcs:{keeper:{name:'Ivo',species:'Human',role:'r',motive:'m',appearance:'A tall man with a grey beard and a limp.',personality:'Gruff, slow to trust, quick to laugh.',ties:{other:'friend',foe:'enemy',note:'n'}},mara:{name:'Sera',species:'Elf',role:'r',motive:'m',appearance:'A slight elf with ink on her hands and a red scarf.',personality:'Curious and precise, always counting.',ties:{other:'friend',foe:'neutral',note:'n'}}}};
 const storyFetch=async(url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',usage:{input_tokens:9,output_tokens:9},output:[{content:[{type:'output_text',text:JSON.stringify(story)}]}]})};};
 let usage=null;await generateAdventure({context:{introId:'garden'}},{apiKey:'k',model:'gpt-6-astra',reasoning:'medium',fetchImpl:storyFetch,onUsage:u=>{usage=u;}});
 assert.deepEqual(request.reasoning,{effort:'medium'});assert.equal(request.max_output_tokens,10200);assert.deepEqual(usage,{input_tokens:9,output_tokens:9});
 await generateAdventure({context:{introId:'garden'}},{apiKey:'k',model:'gpt-6-luna',fetchImpl:storyFetch});assert.deepEqual(request.reasoning,{effort:'none'});assert.equal(request.max_output_tokens,4200);
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
 console.log('Passed: the scene is trimmed ('+JSON.stringify(body).length+' to '+JSON.stringify(sent).length+' characters) with the guidance in the cached instructions, overruns in discoveries, creatures and introductions are repaired, fake-provider runs leave the logs alone, stories go to the story writer with thinking room, and the setup check looks that model up.');
})().catch(e=>{console.error(e);process.exit(1);});
