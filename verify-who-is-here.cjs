const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Who is here, and what they say (2026-10-11, the host's words: "have npcs appear as they are discovered as well as the
// ones that are immediately noticeable at any given location, not all locations need multiple people, but many should"
// and "make sure npcs have different things to say when interacting with multiple"). A tale seats more people where
// people gather (up to three a place, two at the start, twelve residents, 48 people in all); someone the writer marks
// noticed:false keeps out of sight (`hidden`) until the Dungeon Master has the player find them; arriving somewhere
// peopled with nobody named there asks the Dungeon Master once more for someone to meet; and two people in one reply
// never say the same thing (a later echo is dropped, never the reply). Stand-in providers only: no network, no AI.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','subclassRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','lootRules.js','adventureRules.js','partyRules.js','skillRules.js','storyRules.js','followerRules.js','experienceRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','sequelRules.js','storyLog.js','playbackRules.js','sceneTriggers.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^\s*import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,newAdventure,freshStoryGame,adventureStep,commitDmTurn,dmContext,npcScene,metPerson,conversationPeople,validAdventure,adventureSnapshot,validPeople,withStoryLog,sceneTrigger,introducePerson,canMeetPeople,roomForSomeoneNew,freePersonId,maxPeople,residentsPerPlace,residentsAtStart,maxResidents})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const hero=r.readyHero('fighter'),hp={current:12,temp:0};
const valid=g=>r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(g)),hp,true),hero);
const person=(name,at,extra={})=>({name,species:'Human',gender:'woman',role:'A '+name.toLowerCase()+' of the marsh.',appearance:'A weathered figure in a patched grey cloak, with '+name+'\'s tools.',personality:'Watchful.',motive:'Get by.',toughness:'common',attitude:'indifferent',at,foe:'neutral',tie:null,noticed:true,...extra});
const written={id:'here-1',title:'The Reed Crown',premise:'A drowned barrow wakes.',opening:'At the market the reeve hands you an order.',objective:'Learn who woke the barrow.',resolution:'Lay it to rest.',secret:'The reeve did.',foe:'Barrow warden',status:'active',
 locations:{inn:{name:'Stillwater Market',description:'A market on stilts.',kind:'settlement'},bridge:{name:'The Drowned Barrow',description:'A sunken mound.',kind:'ruin'},tower:{name:'Saltmarsh Chapel',description:'A leaning chapel.',kind:'shrine'}},
 npcs:{keeper:{name:'Reeve Ormund',role:'The reeve.',motive:'Keep office.',appearance:'A heavy man in a fur robe.',personality:'Brisk.',ties:{other:'acquaintance',foe:'neutral',note:'n'}},mara:{name:'Wren Halloway',role:'A barge guide.',motive:'Find her brother.',appearance:'A lean young woman with a pole.',personality:'Blunt.',ties:{other:'rival',foe:'enemy',note:'n'}}},
 landmarks:[{name:'Heron Ferry',description:'A ferry landing where three boats tie up for the night.',kind:'water',bearing:'N',miles:2},{name:'Burnt Hut',description:'A burned hut on a hummock in the reeds.',kind:'ruin',bearing:'E',miles:1}],
 residents:[person('Tilda Marsh','inn'),person('Brom Ashby','inn',{gender:'man'}),person('Third Stall','inn'),person('Ferry Ann','Heron Ferry'),person('Ferry Bo','Heron Ferry',{gender:'man'}),person('Ferry Cy','Heron Ferry'),person('Ferry Four','Heron Ferry'),
  person('Old Nettle','tower',{noticed:false,role:'A hermit hiding in the chapel crypt.'}),person('Brother Pell','tower',{gender:'man'}),person('Hidden Child','inn',{noticed:false})]};
const game=r.freshStoryGame(hero,written,r.newAdventure(hero)),byName=Object.fromEntries(Object.entries(game.people).map(([id,p])=>[p.name,{id,...p}]));
// ---- How many a place holds: two residents at the start, three at a peopled landmark ----
assert.equal(r.residentsAtStart,2);assert.equal(r.residentsPerPlace,3);assert.equal(r.maxResidents,12);assert.equal(r.maxPeople,48);
assert.ok(byName['Tilda Marsh']&&byName['Brom Ashby']&&!byName['Third Stall'],'two at the starting place, where keeper and mara are too');
assert.ok(byName['Ferry Ann']&&byName['Ferry Bo']&&byName['Ferry Cy']&&!byName['Ferry Four'],'three at the ferry, never a fourth resident');
assert.equal(byName['Hidden Child'],undefined,'the starting place has no room left (and nobody hides in the opening)');
// ---- Noticed at once, or found by looking ----
const nettle=byName['Old Nettle'];assert.equal(nettle.hidden,true);assert.equal(byName['Brother Pell'].hidden,undefined);assert.ok(r.validPeople(game)&&valid(game));
assert.ok(!r.validPeople({...game,people:{...game.people,[nettle.id]:{...game.people[nettle.id],hidden:'yes'}}}),'hidden is true or absent');
let chapel=r.adventureStep(game,hp,hero,{type:'travel',destination:'tower'},()=>0.5);assert.equal(chapel.error,undefined);chapel={...chapel,game:r.withStoryLog(game,chapel.game,hero,{action:{type:'travel',destination:'tower'}})};
const here=r.npcScene(chapel.game).filter(n=>n.present).map(n=>n.id);
assert.ok(here.includes(byName['Brother Pell'].id)&&!here.includes(nettle.id),'on arriving, the brother is in plain sight; the hermit is not');
assert.equal(r.metPerson(chapel.game,nettle.id),false,'not yet met (so not in the People panel)');assert.equal(r.metPerson(chapel.game,byName['Brother Pell'].id),true);
assert.ok(chapel.game.storyLog.some(e=>e.text.startsWith('Met Brother Pell'))&&!chapel.game.storyLog.some(e=>e.text.startsWith('Met Old Nettle')));
assert.ok(!r.conversationPeople(chapel.game).some(n=>n.id===nettle.id),'nobody can speak to someone they have not found');
const ctx=r.dmContext(hero,chapel.game,hp),told=ctx.npcSocialState.find(n=>n.id===nettle.id);
assert.equal(told.unnoticed,true);assert.equal(told.present,false);assert.equal(told.livesAt,'Saltmarsh Chapel');assert.equal(ctx.world.peopleHere,1);
// The player searches the crypt; the Dungeon Master introduces her by her exact name: found, met, present, in the Log.
const found=r.commitDmTurn(hero,chapel.game,hp,null,{question:'I search the crypt below the chapel.',narration:'In the dark below, someone is breathing.',introduce:{name:'Old Nettle',species:'Human',role:'A hermit hiding in the chapel crypt.',appearance:'A bent woman wrapped in sacking and dried reeds.',personality:'Whispers.',toughness:'frail',attitude:'unfriendly',foe:'neutral',tie:null,gender:'woman',class:null,regard:null},dialogue:[{speakerId:'new',text:'Leave me be.'}]});
assert.equal(found.error,undefined,found.error);const after=r.withStoryLog(chapel.game,found.game,hero,{});
assert.equal(after.people[nettle.id].hidden,undefined);assert.equal(Object.keys(after.people).length,Object.keys(chapel.game.people).length,'found, not added again');
assert.ok(r.npcScene(after).find(n=>n.id===nettle.id).present&&r.metPerson(after,nettle.id),'now in the scene and the People panel');
assert.ok(after.storyLog.some(e=>e.text.startsWith('Met Old Nettle')));assert.ok(after.journal.entries.some(e=>e.title==='Met: Old Nettle'));assert.ok(valid(after));
// A place full of people can still give up someone hiding there, but takes nobody new.
{const crowded={...chapel.game,people:{...chapel.game.people,n40:{...chapel.game.people[byName['Brother Pell'].id],name:'Sister Ash'},n41:{...chapel.game.people[byName['Brother Pell'].id],name:'Sister Bryn'}}};
 assert.equal(r.canMeetPeople(crowded),true,'the hermit can still be found');assert.equal(r.roomForSomeoneNew(crowded),false);
 assert.ok(r.introducePerson(crowded,{name:'A Stranger',species:'Human',role:'A stranger here.',appearance:'A tall stranger in a long coat.',personality:'Quiet.',toughness:'common',attitude:'indifferent',foe:'neutral',tie:null},hero).error,'nobody new at a full place');
 assert.equal(r.introducePerson(crowded,{name:'Old Nettle',species:'Human',role:'A hermit.',appearance:'A bent woman in sacking.',personality:'Whispers.',toughness:'frail',attitude:'unfriendly',foe:'neutral',tie:null},hero).error,undefined,'the hermit is found');}
// A first arrival is greeted by someone in plain sight, never by someone hiding.
const cue=r.sceneTrigger(game,chapel.game,{type:'travel',destination:'tower'});assert.ok(!cue||cue.speakerId!==nettle.id);
// ---- New ids: the first free one (a forgotten land frees them) ----
assert.equal(r.freePersonId({n1:{},n2:{},n4:{}}),'n3');assert.equal(r.freePersonId(Object.fromEntries(Array.from({length:48},(_,i)=>['n'+(i+1),{}]))),null);
(async()=>{
 const server=require('./dm-server.cjs'),{secondLook}=require('./dm-intent.cjs');
 const quiet={narration:'You reach the ferry.',dialogue:[],recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null,suggestions:[]};
 // ---- Arriving somewhere peopled and finding nobody named there: asked once more for someone to meet ----
 const arrival={stage:'wild',story:{foe:'Barrow warden'},engineResolved:['You travel to Heron Ferry. 2 miles; 40 minutes pass.'],world:{current:{id:'p1',name:'Heron Ferry',kind:'water'},knownPlaces:[],peopleHere:0,canIntroduce:true},choices:[],npcSocialState:[]};
 assert.equal(secondLook({input:'I travel to Heron Ferry.',context:arrival},quiet)?.kind,'nobody here');
 assert.equal(secondLook({input:'x',context:{...arrival,world:{...arrival.world,current:{...arrival.world.current,kind:'ruin'}}}},quiet),null,'a ruin may be empty');
 assert.equal(secondLook({input:'x',context:{...arrival,world:{...arrival.world,peopleHere:2}}},quiet),null,'people are here already');
 assert.equal(secondLook({input:'x',context:{...arrival,engineResolved:['You rest.']}},quiet),null,'only on arriving');
 const ferryman={name:'Oswin Reedly',species:'Human',role:'The ferryman of Heron Ferry.',appearance:'A stooped man in a tarred coat with a lantern on a pole.',personality:'Slow and kind.',toughness:'common',attitude:'indifferent',foe:'neutral',tie:null,gender:'man',class:null,regard:null};
 const calls=[];const replies=[quiet,{...quiet,narration:'An old ferryman lifts his lantern.',introduce:ferryman,dialogue:[{speakerId:'new',text:'Crossing tonight?'}]}];
 const fetchImpl=async(url,options)=>{calls.push(JSON.parse(options.body));const reply=replies[Math.min(calls.length-1,replies.length-1)];return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(reply)}]}]})};};
 const met=await server.generate({input:'I travel to Heron Ferry.',context:arrival},{apiKey:'test-only',model:'test-model',fetchImpl});
 assert.equal(calls.length,2);assert.match(calls[1].instructions,/LOOK AGAIN: Your telling brings the player to Heron Ferry, a water/);assert.equal(met.introduce?.name,'Oswin Reedly','someone to meet');
 // ---- Different words: a later line that echoes an earlier one is dropped, never the reply ----
 const crowd={stage:'inn',story:{foe:'Barrow warden'},world:{current:{id:'inn',name:'Stillwater Market',kind:'settlement'},knownPlaces:[],peopleHere:3,canIntroduce:true},choices:[],npcSocialState:[{id:'keeper',name:'Reeve Ormund',present:true},{id:'mara',name:'Wren Halloway',present:true},{id:'n1',name:'Tilda Marsh',present:true}],conversationParticipants:[{id:'keeper',name:'Reeve Ormund'},{id:'mara',name:'Wren Halloway'},{id:'n1',name:'Tilda Marsh'}]};
 const echo={...quiet,narration:'The three of them look up.',dialogue:[{speakerId:'keeper',text:'Welcome, stranger.'},{speakerId:'mara',text:'Welcome, traveller!'},{speakerId:'n1',text:'The barrow is awake, and the reeve will not say why.'},{speakerId:'mara',text:'The reeve will not say why the barrow is awake.'}]};
 const echoCalls=[];const out=await server.generate({input:'Hello, everyone.',context:crowd},{apiKey:'test-only',model:'test-model',fetchImpl:async(url,options)=>{echoCalls.push(JSON.parse(options.body));return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(echo)}]}]})};}});
 same(out.dialogue.map(l=>l.speakerId),['keeper','n1'],'each says something of their own');assert.equal(echoCalls.length,1,'never asked again over it');
 assert.ok(server.distinctDialogue([{speakerId:'keeper',text:'Go to the ferry.'},{speakerId:'mara',text:'I can pole you there.'}]).length===2,'different words are kept');
 // ---- What the Dungeon Master and the story writer are told ----
 const said=echoCalls[0].instructions;
 assert.ok(said.includes('WHO IS HERE: on arriving anywhere, the people anyone would notice at once are there at once')&&said.includes('marked unnoticed'),'noticeable people at once, others when found');
 assert.ok(said.includes('DIFFERENT WORDS: when several people speak in one reply'),'different words from different people');
 const cueCalls=[];await server.generate({input:'You arrive.',context:{...crowd,sceneTrigger:{id:'arrive:inn',cue:'The player arrives.'}}},{apiKey:'test-only',model:'test-model',fetchImpl:async(url,options)=>{cueCalls.push(JSON.parse(options.body));return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({...quiet,narration:'They look up.',dialogue:[{speakerId:'keeper',text:'There you are.'}]})}]}]})};}});
 assert.match(cueCalls[0].instructions,/each speaker saying something different \(never two greetings alike\)/);
 const gen=fs.readFileSync('adventure-generator.cjs','utf8');assert.ok(gen.includes('noticed:{type:\'boolean\'}')&&gen.includes('noticed: true for someone in plain sight')&&gen.includes('six to ten further named people (never more than twelve)'),'the writer seats people where they would be');
 console.log('Who is here: people seated where they gather (two at the start, three at a peopled place, 48 in all), noticed at once or found by looking (hidden until introduced by name, then met and in the People panel), arrivals at peopled places with nobody named asked again for someone to meet, and different words from different people (echoes dropped, greetings never alike).');
})().catch(e=>{console.error(e);process.exit(1);});
