const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Beyond the map (2026-10-11, the host's words: "make sure travel is possible outside of the region of the map, with
// more map generated outside if the player decides to move to a new map. then make sure the game remembers the old map
// when a new one is generated, there can be a limit to this"): the player can walk off the edge of the land they are
// in, in any direction, and the game opens a new land out there (mapRules.js goBeyond: a region of its own, a road from
// the place on that side of the map, a place to arrive at and one or two heard of; all from a seed, so every device
// and the campaign server agree). Twelve lands are remembered; when a new one opens and there is no room, the land
// longest unvisited is forgotten with its people (never the home land, the land the hero is in, one where a companion
// waits or one the tale still points to). Every land on the map can be travelled back to. Synthetic heroes and a
// stand-in Dungeon Master only: no network, no AI.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','subclassRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','lootRules.js','adventureRules.js','partyRules.js','skillRules.js','storyRules.js','followerRules.js','experienceRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','sequelRules.js','storyLog.js','playbackRules.js','sceneTriggers.js','mapLayout.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^\s*import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,newAdventure,hostileEncounterGame,adventureStep,dmChoices,dmContext,mapMoves,quickActions,validAdventure,adventureSnapshot,mapRegions,worldPlaces,worldPlace,currentRegion,mapLocation,travelRoute,travelChoices,landsToForget,beyondError,beyondPlan,edgePlace,maxRegions,maxWorldPlaces,regionLayout,withStoryLog,withExperience,freshStoryGame,joinRegion,carriedBase,npcScene,metPerson})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const hero=r.readyHero('fighter'),hp={current:12,temp:0};
const valid=g=>r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(g)),hp,true),hero);
let g=r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0);g={...g,stage:'inn',enemyHP:0,foeFate:'slain'};delete g.openingAttackAvailable;
const go=(game,bearing,random=()=>0.9)=>{const s=r.adventureStep(game,hp,hero,{type:'beyond',bearing},random);assert.equal(s.error,undefined,bearing+': '+s.error);const logged=r.withStoryLog(game,s.game,hero,{action:{type:'beyond',bearing}});return {...s,game:logged};};
// ---- Offered as choices (never chips), and to the map ----
const choices=r.dmChoices(hero,g,hp);
same(choices.filter(c=>c.id.startsWith('beyond-')).map(c=>c.id),['beyond-N','beyond-NE','beyond-E','beyond-SE','beyond-S','beyond-SW','beyond-W','beyond-NW'],'eight ways off the map');
same(choices.find(c=>c.id==='beyond-N').action,{type:'beyond',bearing:'N'});
assert.ok(!r.quickActions(hero,g,hp).some(a=>String(a.key).startsWith('beyond-')),'never a chip');
assert.ok(r.mapMoves(g).some(m=>m.action.type==='beyond')&&r.mapMoves(g).some(m=>m.action.type==='travel'),'the map can send both');
assert.equal(r.mapMoves({...g,stage:'combat',enemyHP:9}).length,0,'not in a fight');
assert.match(r.beyondError({...g,pendingSpell:{id:'x'}},'N'),/pending spell/);assert.match(r.beyondError(g,'UP'),/direction/);assert.match(r.beyondError({...g,stage:'combat'},'N'),/encounter/);
// ---- Going north: a new land, a road from the edge, days on the road ----
const edge=r.edgePlace(g,'N');
const north=go(g,'N'),land=r.mapRegions(north.game).at(-1),arrival=r.worldPlace(north.game,north.game.world.at);
assert.equal(r.mapRegions(north.game).length,2);assert.equal(land.id,'r1');assert.notEqual(land.terrain,r.mapRegions(g)[0].terrain,'a land different from the last');
assert.equal(north.game.stage,'wild');assert.equal(arrival.region,'r1');assert.equal(arrival.from,edge,'the road leaves from the place on that side of the map');
assert.ok(r.worldPlaces(north.game).length>=2&&r.worldPlaces(north.game).length<=3,'a place to arrive at and one or two heard of');
assert.ok(r.worldPlaces(north.game).every(p=>p.region==='r1'));
const road=r.travelRoute(north.game,'inn',arrival.id);assert.ok(road.feet>=24*5280,'miles away');assert.ok(road.minutes>480*2,'more than a day on the road (eight hours a day)');
assert.equal(north.game.map.minutes-g.map.minutes,r.travelRoute(north.game,r.mapLocation(g),arrival.id).minutes,'time passes by the road');
assert.match(north.events[0],/^You leave The Caravan Road by the road north from .+, beyond the edge of your map, for a land new to you: .+\.$/);
assert.match(north.events[1],/^You travel to /);assert.ok(north.game.storyLog.some(e=>e.text==='Set out for a new land: '+land.name+'.'));
assert.equal(land.last,north.game.map.minutes,'the land remembers when it was reached');
assert.ok(valid(north.game),'the save holds');
same(go(g,'N').game.world,north.game.world,'the same land every time (seeded), on every device and at the table');
assert.notEqual(go(g,'S').game.world.regions[0].name+go(g,'S').game.world.regions[0].terrain,land.name+land.terrain,'another way, another land');
// The map: the home sheet has a road off its edge to the new land; the new land has its own sheet with the road back.
const homeSheet=r.regionLayout(north.game,400,320,{region:'home'}),newSheet=r.regionLayout(north.game,400,320,{region:'r1'});
assert.ok(homeSheet.exits.some(e=>e.region==='r1'));assert.ok(newSheet.ids.includes(arrival.id)&&newSheet.exits.some(e=>e.region==='home'));
// Back home: the map offers a journey to every place a road reaches, and the choices one in every other land.
assert.ok(r.travelChoices(north.game).some(id=>r.worldPlace(north.game,id)===null),'a starting place is among the journeys back');
assert.ok(r.mapMoves(north.game).some(m=>m.action.destination==='inn'));
const back=r.adventureStep(north.game,hp,hero,{type:'travel',destination:'inn'},()=>0.9);assert.equal(back.error,undefined,back.error);assert.equal(back.game.stage,'inn');assert.ok(valid(back.game));
// Experience: the first steps in a new land count with a place reached, and only while places still pay.
const paid=r.withExperience(g,north.game,hero,{action:{type:'beyond',bearing:'N'}});assert.ok(paid.lines.some(l=>/First steps in /.test(l)),JSON.stringify(paid.lines));
const tallied={...g,xpTally:{...(g.xpTally??{tale:g.story.id,fights:0,leads:[]}),tale:g.story.id,places:10,fights:0,leads:[]}};
assert.ok(!r.withExperience(tallied,{...north.game,xpTally:tallied.xpTally},hero,{}).lines.some(l=>/First steps in /.test(l)),'walking off the map again and again is no way to grow');
// ---- Twelve lands remembered, then the one longest unvisited is forgotten ----
let w=g,lands=[];const ways=['N','E','S','W','NE','SW','NW','SE'];
for(let i=0;i<11;i++){w=go(w,ways[i%8]).game;lands.push(r.mapRegions(w).at(-1));assert.ok(valid(w));}
assert.equal(r.mapRegions(w).length,12);assert.equal(r.maxRegions,12);
const oldest=lands[0],full=go(w,'N');
assert.ok(full.events[0]==='The memory of '+oldest.name+' fades.',JSON.stringify(full.events));
assert.ok(!r.mapRegions(full.game).some(x=>x.name===oldest.name)&&r.mapRegions(full.game).length===12,'twelve lands, the oldest forgotten');
assert.ok(!r.worldPlaces(full.game).some(p=>p.region===oldest.id&&p.name.startsWith('')&&r.worldPlaces(w).filter(q=>q.region===oldest.id).some(q=>q.name===p.name)),'its places leave the map');
assert.ok(full.game.map.visited.every(id=>id==='inn'||id==='bridge'||id==='tower'||r.worldPlace(full.game,id)),'and the record of visiting them');
assert.ok(full.game.storyLog.some(e=>e.text==='The memory of '+oldest.name+' fades.'));assert.ok(valid(full.game));
assert.ok(r.worldPlaces(full.game).every(p=>['inn','bridge','tower'].includes(p.from)||r.worldPlace(full.game,p.from)),'a road through a forgotten land runs straight on');
// The longest unvisited goes first: a land visited again is kept over one left alone.
const second=lands[1],revisit=r.worldPlaces(w).find(p=>p.region===second.id);
let w2=r.adventureStep(w,hp,hero,{type:'travel',destination:revisit.id},()=>0.9).game;w2={...w2,wildFight:undefined,stage:'wild'};delete w2.wildFight;
const after=go(w2,'E');assert.ok(r.mapRegions(after.game).some(x=>x.id===second.id),'the land just visited is kept');assert.ok(!r.mapRegions(after.game).some(x=>x.name===oldest.name));
// Never the land the hero stands in, one where a companion waits, or one the tale still points to.
same(r.landsToForget(w,{lands:1}),[oldest.id]);
const waitPlace=r.worldPlaces(w).find(p=>p.region===oldest.id);
same(r.landsToForget({...w,followers:{mara:{status:'waiting',location:waitPlace.id,reason:'Told to wait.',terms:''}}},{lands:1}),[lands[1].id],'a companion waits there');
same(r.landsToForget({...w,story:{...w.story,leads:[{id:'l1',title:'A debt in '+oldest.name,hook:'Someone owes the captain in '+oldest.name+'.'}]}},{lands:1}),[lands[1].id],'the tale still points there');
assert.equal(r.landsToForget({...w,world:{...w.world,at:w.world.at}},{lands:1}).includes(r.currentRegion(w)),false);
// The people of a forgotten land go with it; a companion travelling with the hero stays, and ties to the gone are let go.
const folk={...w,people:{n1:{name:'Ada Fenn',species:'Human',role:'A ferrywoman.',appearance:'A tall woman in oilskins with a boathook.',personality:'Dry.',toughness:'common',home:waitPlace.id,foe:'neutral'},n2:{name:'Bram Holt',species:'Human',role:'A drover who walks with you.',appearance:'A broad man with a crook and a dog.',personality:'Cheerful.',toughness:'common',home:waitPlace.id,foe:'neutral'},n3:{name:'Cora Vey',species:'Human',role:'A trader of the caravan.',appearance:'A small woman with ink-stained fingers.',personality:'Quick.',toughness:'common',home:'inn',foe:'neutral',tie:{to:'n1',kind:'friend'}}},npcMemory:{n1:{attitude:'friendly',response:'Warm.',memories:['You paid the fare.']}},npcHP:{n1:5},followers:{n2:{status:'following',location:'inn',reason:'Came along.',terms:''}}};
assert.ok(valid(folk));
const gone=go(folk,'N').game;
assert.equal(gone.people.n1,undefined,'someone who lived there is forgotten');assert.equal(gone.npcMemory?.n1,undefined);assert.equal(gone.npcHP?.n1,undefined);
assert.ok(gone.people.n2&&gone.followers.n2.status==='following','a companion on the road stays');assert.equal(gone.people.n3.tie,undefined,'a tie to someone forgotten is let go');
assert.ok(valid(gone));
// A new person later takes the first free id (ids freed by a forgotten land are used again).
// ---- A far land found by the Dungeon Master when the atlas is full forgets one too ----
const voyage={name:'Saltglass Harbour',description:'A harbour of green glass towers across the strait.',kind:'settlement',bearing:'E',miles:120,region:{name:'The Glass Coast',terrain:'coast'}};
const sailed=r.adventureStep(w,hp,hero,{type:'discover',place:voyage,travel:true},()=>0.9);assert.equal(sailed.error,undefined,sailed.error);
assert.ok(sailed.events[0].startsWith('The memory of '),JSON.stringify(sailed.events));assert.ok(r.mapRegions(sailed.game).some(x=>x.name==='The Glass Coast'));assert.ok(valid(sailed.game));
// ---- Full, with nothing that may be forgotten: refused plainly ----
const stuck={...w,followers:Object.fromEntries(r.mapRegions(w).slice(1).map((x,i)=>['n'+(i+1),{status:'waiting',location:r.worldPlaces(w).find(p=>p.region===x.id).id,reason:'Waits.',terms:''}])),people:Object.fromEntries(r.mapRegions(w).slice(1).map((x,i)=>['n'+(i+1),{name:'Waiter '+(i+1),species:'Human',role:'A friend who waits.',appearance:'A patient figure in a grey cloak.',personality:'Patient.',toughness:'common',home:'inn',foe:'neutral'}]))};
assert.match(r.beyondError(stuck,'N'),/map is full/);assert.ok(!r.dmChoices(hero,stuck,hp).some(c=>c.id.startsWith('beyond-')));
// ---- The next tale in the region keeps within the twelve ----
const nextTale=r.freshStoryGame(hero,{...JSON.parse(JSON.stringify(g.story)),id:'next-1',title:'The Next Road',introduction:undefined},r.newAdventure(hero,r.carriedBase(w)));
const joined=r.joinRegion(nextTale,w,{sameRegion:true,bearing:'N',miles:5});assert.ok(r.mapRegions(joined).length<=12);assert.ok(r.worldPlaces(joined).length<=r.maxWorldPlaces);
// ---- The Dungeon Master: told the lands remembered; asked to act on "beyond the map" ----
const ctx=r.dmContext(hero,north.game,hp);assert.equal(ctx.world.landsRemembered,2);assert.ok(ctx.world.regions.includes(land.name));
const {secondLook}=require('./dm-intent.cjs'),{generate,contractInstructions}=require('./dm-server.cjs');
const base={stage:'inn',story:{foe:'Bandit'},world:{current:{id:'inn',name:'Caravan Camp',kind:'camp'},knownPlaces:[],canDiscover:true,peopleHere:2,canIntroduce:true},choices:choices.map(c=>({id:c.id,label:c.label}))};
const quiet={narration:'You think it over.',dialogue:[],recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null,suggestions:[]};
const look=input=>secondLook({input,context:base},quiet,{canDiscover:true});
for(const [said,id] of [['I head north beyond the map.','beyond-N'],['We leave this land and go south-west.','beyond-SW'],['I walk east, off the edge of the map','beyond-E'],['I set out for a new land to the west','beyond-W']]){const f=look(said);assert.equal(f?.actionId,id,said);assert.equal(f.sure,true,said);}
assert.equal(look('Is there anything beyond the map?'),null,'a question is answered');assert.equal(look('I will not leave this land.'),null);
assert.equal(look('I want to leave this land.')?.sure??false,false);assert.equal(look('We leave this country.').kind,'beyond the map','no direction: the model is asked which way');
(async()=>{
 const calls=[];const fetchImpl=async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(quiet)}]}]})};};
 const out=await generate({input:'I head north beyond the map.',context:base},{apiKey:'test-only',model:'test-model',fetchImpl});
 assert.equal(out.actionId,'beyond-N','asked twice, the game sets out itself');assert.equal(calls.length,2);assert.match(calls[1].instructions,/LOOK AGAIN: .*beyond-N/);
 assert.ok(calls[0].instructions.includes('BEYOND THE MAP: the choices beyond-N'),'the Dungeon Master is told how lands beyond the map work');
 // ---- At the shared table the campaign server accepts the same moves ----
 const {resolveTurn}=require('./server-turn.cjs'),ask=async()=>({narration:'The road runs on for days.',actionId:null,suggestions:[]});
 const snap=JSON.parse(JSON.stringify(r.adventureSnapshot(hero,g,hp,true)));
 const tableTurn=await resolveTurn(snap,{question:'I leave this land and head north, beyond the edge of the map.',action:{type:'beyond',bearing:'N'}},{ask,randomImpl:()=>0.9});
 assert.equal(tableTurn.snapshot.game.world.regions.length,1);same(tableTurn.snapshot.game.world.regions[0].name,land.name,'the table opens the same land as a device would');
 const far=JSON.parse(JSON.stringify(r.adventureSnapshot(hero,w,hp,true))),distant=r.worldPlaces(w).find(p=>p.region===lands[2].id&&!r.dmChoices(hero,w,hp).some(c=>c.action?.destination===p.id));
 assert.ok(distant,'a place the choices do not offer');{const there=await resolveTurn(far,{question:'I travel to '+distant.name+'.',action:{type:'travel',destination:distant.id}},{ask,randomImpl:()=>0.9});assert.equal(there.snapshot.game.world.at,distant.id,'a journey from the map to a place the chips do not offer');}
 // ---- The map screen: a compass of ways out, confirmed before the long road ----
 const map=fs.readFileSync('AdventureMap.js','utf8'),screen=fs.readFileSync('Adventure.js','utf8');
 assert.ok(map.includes('function BeyondCard')&&map.includes("accessibilityLabel={'Beyond the map to the '+beyondWords[b]}")&&map.includes('Set out'),'the map has a way beyond its edge');
 assert.ok(map.includes('{beyondCard(()=>setOpen(false))}'),'on the full map too');assert.ok(screen.includes('onBeyond={goBeyond}')&&screen.includes('mapMoves(game)'));
 console.log('Beyond the map: eight ways off any land (choices, never chips; typed or from the map\'s compass), a new seeded land with a road from the edge, days on the road, the same at the table; twelve lands remembered, the longest unvisited forgotten with its people (never home, here, a waiting companion\'s or one the tale points to); every land can be travelled back to.');
})().catch(e=>{console.error(e);process.exit(1);});
