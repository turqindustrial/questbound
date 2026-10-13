const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Beyond the map (2026-10-11, the host's words: "make sure travel is possible outside of the region of the map, with
// more map generated outside if the player decides to move to a new map. then make sure the game remembers the old map
// when a new one is generated, there can be a limit to this"): the player can walk off the edge of the land they are
// in, in any direction, and the game opens a new land out there (mapRules.js goBeyond: a region of its own, a road from
// the place on that side of the map, a place to arrive at and one or two heard of; all from a seed, so every device
// and the campaign server agree). Lands travelled are never forgotten (2026-10-12): sixty lands and 150 places fit;
// when the map is full only what the hero merely heard of gives way (a rumour never visited, a land never reached),
// and every land on the map can be travelled back to: on the map, among the choices, by name and at the shared table.
// Synthetic heroes and a stand-in Dungeon Master only: no network, no AI.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','memoryRules.js','spellOptions.js','equipmentRules.js','characterRules.js','subclassRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','lootRules.js','adventureRules.js','partyRules.js','skillRules.js','storyRules.js','followerRules.js','experienceRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','sequelRules.js','storyLog.js','playbackRules.js','sceneTriggers.js','mapLayout.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^\s*import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,newAdventure,hostileEncounterGame,adventureStep,dmChoices,dmContext,mapMoves,quickActions,validAdventure,adventureSnapshot,mapRegions,worldPlaces,worldPlace,currentRegion,mapLocation,travelRoute,travelChoices,roomToMake,commitDmTurn,landsInFull,beyondError,beyondPlan,edgePlace,maxRegions,maxWorldPlaces,regionLayout,withStoryLog,withExperience,freshStoryGame,joinRegion,carriedBase,npcScene,metPerson})',{AsyncStorage:{},weaponIcon:()=>'sword'});
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
// ---- Lands travelled are never forgotten (the host, 2026-10-12: "previous lands travelled should not be forgotten. a
// player should be able to return to those lands.") ----
assert.equal(r.maxRegions,60);assert.equal(r.maxWorldPlaces,150);
let w=g,lands=[];const ways=['N','E','S','W','NE','SW','NW','SE'];
for(let i=0;i<24;i++){const step=go(w,ways[i%8]);assert.ok(!step.events.some(e=>/fades/.test(e)),'nothing fades while there is room: '+step.events[0]);w=step.game;lands.push(r.mapRegions(w).at(-1));if(i%6===5)assert.ok(valid(w),'the save holds with '+(i+2)+' lands');}
assert.equal(r.mapRegions(w).length,25,'home and twenty-four lands travelled');
for(const land of lands)assert.ok(r.mapRegions(w).some(x=>x.id===land.id&&x.name===land.name),land.name+' is still on the map');
assert.ok(lands.every(land=>r.worldPlaces(w).some(p=>p.region===land.id&&w.map.visited.includes(p.id))),'and the place the hero reached in each');
assert.ok(valid(w));assert.ok(!w.storyLog.some(e=>/fades/.test(e.text)),'the story log never says a land faded');
// Every land can be travelled back to: on the map (mapMoves), among the choices (the nearest place of each), by name.
const placesOf=(game,land)=>[...(land==='home'?['inn','bridge','tower']:[]),...r.worldPlaces(game).filter(p=>(p.region??'home')===land).map(p=>p.id)];
{const here=r.mapLocation(w),moves=r.mapMoves(w),journeys=r.travelChoices(w);
 for(const land of r.mapRegions(w)){if(land.id===r.currentRegion(w))continue;const there=placesOf(w,land.id);
  assert.ok(moves.some(m=>m.action.type==='travel'&&there.includes(m.action.destination)),'the map has a road back to '+land.name);
  assert.ok(journeys.some(id=>there.includes(id)),'a journey back to '+land.name+' is among the choices');}
 for(const id of w.map.visited)if(id!==here){assert.ok(r.travelRoute(w,here,id),'a road back to '+id);assert.ok(moves.some(m=>m.action.destination===id),'the map can send the hero back to '+id);}
 // Named by the player, a journey to a land or place the thirty choices have no room for is offered (and taken).
 const offered=r.dmContext(hero,w,hp).choices,first=r.worldPlaces(w).find(p=>p.region===lands[0].id&&w.map.visited.includes(p.id));
 assert.ok(offered.length<=30);
 for(const said of ['I go back to '+lands[0].name+'.','I take the road back to '+first.name+'.']){const ctx=r.dmContext(hero,w,hp,said),id=ctx.choices.find(c=>c.id.startsWith('travel-')&&placesOf(w,lands[0].id).includes(c.id.slice(7)))?.id;
  assert.ok(id,'"'+said+'" offers the journey');assert.ok(ctx.choices.length<=30);assert.ok(ctx.world.knownPlaces.some(p=>p.id===id.slice(7)),'and tells the place in full');
  const went=r.commitDmTurn(hero,w,hp,{type:'travel',destination:id.slice(7)},{question:said,narration:'You take the long road back.'},()=>0.9);assert.equal(went.error,undefined,went.error);assert.equal(r.currentRegion(went.game),lands[0].id);assert.ok(valid(went.game));}
 // Far lands go to the Dungeon Master in brief: the land, how far the road is, and its places by name.
 const told=r.dmContext(hero,w,hp).world;assert.ok(told.knownPlaces.every(p=>r.worldPlace(w,p.id)?.region===r.worldPlace(w,here)?.region||r.travelChoices(w).includes(p.id)||p.id===here),'only this land and the journeys on offer in full');
 assert.ok(told.farLands.length>=20,'twenty lands and more told in brief');for(const f of told.farLands){assert.ok(f.name&&f.road&&(f.places===undefined||f.places.length>0));}assert.ok(told.farLands.filter(f=>f.places).length<=r.landsInFull,'the nearest lands with their places by name');
 assert.ok(told.farLands.some(f=>/days? on the road to /.test(f.road??'')),'how far the road is');
 // And back, all the way: the hero walks home to the first land of all, then to the first land beyond it.
 const home=r.adventureStep(w,hp,hero,{type:'travel',destination:'inn'},()=>0.9);assert.equal(home.error,undefined,home.error);assert.equal(home.game.stage,'inn');
 const firstAgain=r.adventureStep(home.game,hp,hero,{type:'travel',destination:first.id},()=>0.9);assert.equal(firstAgain.error,undefined);assert.equal(firstAgain.game.world.at,first.id);assert.equal(r.mapRegions(firstAgain.game).length,25);}
// ---- When the map is full, only what the hero merely heard of gives way ----
// A map at its 150 places, with rumours of places never visited: going beyond lets the oldest rumour go (in another
// land first), never a place visited, a road back, a land travelled or where someone lives.
const rumourAt=(n,extra={})=>({id:'p'+n,name:'Rumoured Cairn '+n,description:'A cairn someone spoke of, never visited.',kind:'ruin',x:n*400,y:-n*300,from:'inn',...extra});
let crowd={...w,world:{...w.world,places:[...w.world.places]}};
for(let n=1;crowd.world.places.length<r.maxWorldPlaces;n++)if(!crowd.world.places.some(p=>p.id==='p'+n))crowd.world.places.push(rumourAt(n));
crowd={...crowd,people:{n1:{name:'Ada Fenn',species:'Human',role:'A hermit who lives by a cairn.',appearance:'A tall woman in a patched grey cloak.',personality:'Dry.',toughness:'common',home:crowd.world.places.find(p=>/Rumoured/.test(p.name)).id,foe:'neutral'}}};
assert.ok(valid(crowd),'a full map is a valid save');
{const before=r.worldPlaces(crowd),step=go(crowd,'N'),after=r.worldPlaces(step.game),lost=before.filter(p=>!after.some(q=>q.id===p.id&&q.name===p.name));
 assert.ok(after.length<=r.maxWorldPlaces);assert.ok(lost.length>=1&&lost.every(p=>!crowd.map.visited.includes(p.id)&&!before.some(q=>q.from===p.id)&&(p.region??'home')!==r.currentRegion(crowd)),'only places heard of give way (the oldest, in another land): '+lost.map(p=>p.name).join(', '));
 assert.ok(!lost.some(p=>p.id===crowd.people.n1.home),'never where someone lives');assert.ok(step.events.some(e=>/^Your map is full, so (the rumour of|rumours of) /.test(e)),JSON.stringify(step.events));
 assert.equal(r.mapRegions(step.game).length,26,'every land kept, and the new one');assert.ok(crowd.map.visited.every(id=>['inn','bridge','tower'].includes(id)||r.worldPlace(step.game,id)),'every place visited kept');assert.ok(valid(step.game));}
// Full of places the hero has been to: the road goes no further (the Dungeon Master can still find a place only by
// letting nothing go: the map is full).
{const seen={...crowd,map:{...crowd.map,visited:[...new Set([...crowd.map.visited,...crowd.world.places.map(p=>p.id)])]}};assert.ok(valid(seen));
 assert.match(r.beyondError(seen,'N'),/road goes no further/);assert.ok(!r.dmChoices(hero,seen,hp).some(c=>c.id.startsWith('beyond-')),'no way beyond is offered');assert.ok(!r.mapMoves(seen).some(m=>m.action.type==='beyond'));
 assert.match(r.adventureStep(seen,hp,hero,{type:'discover',place:{name:'Saltglass Harbour',description:'A harbour of green glass towers across the strait.',kind:'settlement',bearing:'E',miles:120,region:{name:'The Glass Coast',terrain:'coast'}},travel:true},()=>0.9).error,/map is full/);
 assert.equal(r.dmContext(hero,seen,hp).world.canDiscover,false,'the Dungeon Master is told no new place fits');
 assert.ok(r.mapMoves(seen).filter(m=>m.action.type==='travel').length>=r.maxWorldPlaces,'and every place can still be travelled to');}
// Sixty lands at most: a land heard of and never reached gives way to a new one; lands travelled never do. With every
// land travelled, the road beyond goes no further, and a far land the Dungeon Master finds joins the land the hero is in.
{const atlas=(visitedAll,extra={})=>{const regions=Array.from({length:r.maxRegions-1},(_,i)=>({id:'r'+(i+1),name:'Farland '+(i+1),terrain:'hills'})),places=regions.map((x,i)=>({id:'p'+(i+1),name:'Farhold '+(i+1),description:'A walled town far from home.',kind:'settlement',x:(i+1)*200000,y:5000,from:'inn',region:x.id}));
  return {...g,world:{places,regions,at:null},map:{...g.map,visited:[...g.map.visited,...(visitedAll?places.map(p=>p.id):places.slice(1).map(p=>p.id))]},...extra};};
 const one=atlas(false);assert.ok(valid(one));same(r.roomToMake(one,{lands:1,places:1}),{places:['p1'],regions:['r1']},'the land never reached gives way');
 const step=go(one,'S');assert.ok(step.events[0]==='Word of Farland 1 fades from your map: you never went there.',JSON.stringify(step.events));assert.ok(!r.mapRegions(step.game).some(x=>x.name==='Farland 1'));assert.equal(r.mapRegions(step.game).length,r.maxRegions);assert.ok(valid(step.game));
 assert.equal(r.roomToMake({...one,story:{...one.story,leads:[{id:'l1',title:'A debt in Farland 1',hook:'Someone owes the captain in Farland 1.'}]}},{lands:1}),null,'not a land the tale still speaks of');
 assert.equal(r.roomToMake({...one,followers:{mara:{status:'waiting',location:'p1',reason:'Told to wait.',terms:''}}},{lands:1}),null,'not one where a companion waits');
 const all=atlas(true);assert.ok(valid(all));assert.match(r.beyondError(all,'N'),/road goes no further/);
 const sailed=r.adventureStep(all,hp,hero,{type:'discover',place:{name:'Saltglass Harbour',description:'A harbour of green glass towers across the strait.',kind:'settlement',bearing:'E',miles:120,region:{name:'The Glass Coast',terrain:'coast'}},travel:true},()=>0.9);
 assert.equal(sailed.error,undefined,sailed.error);assert.equal(r.mapRegions(sailed.game).length,r.maxRegions,'no land is let go');assert.equal(r.worldPlace(sailed.game,sailed.game.world.at).region,undefined,'the harbour joins the land the hero set out from');assert.ok(valid(sailed.game));}
// Old saves (twelve lands, ids up to r19 and p99) still load; a land an older version let fade cannot be brought back.
{const old={...g,world:{places:[{id:'p99',name:'Old Ferry',description:'A ferry an older save remembers.',kind:'water',x:9000,y:9000,from:'inn',region:'r19'}],regions:[{id:'r19',name:'The Old Marches',terrain:'marsh',last:40}],at:null}};assert.ok(valid(old));}
// ---- The next tale in the region keeps every land travelled ----
{const nextTale=r.freshStoryGame(hero,{...JSON.parse(JSON.stringify(g.story)),id:'next-1',title:'The Next Road',introduction:undefined},r.newAdventure(hero,r.carriedBase(w)));
 const joined=r.joinRegion(nextTale,w,{sameRegion:true,bearing:'N',miles:5});assert.ok(r.worldPlaces(joined).length<=r.maxWorldPlaces);assert.ok(r.mapRegions(joined).length<=r.maxRegions);
 const names=new Set(r.worldPlaces(joined).map(p=>p.name));
 for(const p of r.worldPlaces(w).filter(p=>w.map.visited.includes(p.id)))assert.ok(names.has(p.name)||names.has('Old '+p.name)||names.has(p.name.slice(0,50)+' (earlier)'),'the next tale keeps '+p.name);
 assert.ok(r.mapRegions(joined).length>=r.mapRegions(w).length+1,'every land travelled comes along as a land of its own');
 for(const p of r.worldPlaces(joined).filter(p=>joined.map.visited.includes(p.id)))assert.ok(r.travelRoute(joined,'inn',p.id),'and can be travelled back to: '+p.name);
 assert.ok(valid(joined));}
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
 // Every one of the twenty-four lands travelled can be reached again at the table, from the map's own moves.
 for(const land of lands){const there=r.worldPlaces(w).find(p=>p.region===land.id&&w.map.visited.includes(p.id));if(there.id===w.world.at)continue;
  assert.ok(r.mapMoves(w).some(m=>m.action.destination===there.id));const t=await resolveTurn(far,{question:'I travel back to '+there.name+'.',action:{type:'travel',destination:there.id}},{ask,randomImpl:()=>0.9});assert.equal(t.snapshot.game.world.at,there.id,'back to '+land.name+' at the table');assert.equal(t.snapshot.game.world.regions.length,24);}
 // Named in words, the Dungeon Master's choice of a journey the thirty choices had no room for is taken too.
 {const there=r.worldPlaces(w).find(p=>p.region===lands[0].id&&w.map.visited.includes(p.id)),told=[];
  const guide=async body=>{told.push(body);return {narration:'You take the long road back.',actionId:'travel-'+there.id,suggestions:[]};};
  const t=await resolveTurn(far,{question:'I go back to '+there.name+'.'},{ask:guide,randomImpl:()=>0.9});
  assert.ok(told[0].context.choices.some(c=>c.id==='travel-'+there.id),'the table offers the journey the player named');assert.equal(t.snapshot.game.world.at,there.id,'and takes it');}
 // ---- The map screen: a compass of ways out, confirmed before the long road ----
 const map=fs.readFileSync('AdventureMap.js','utf8'),screen=fs.readFileSync('Adventure.js','utf8');
 assert.ok(map.includes('function BeyondCard')&&map.includes("accessibilityLabel={'Beyond the map to the '+beyondWords[b]}")&&map.includes('Set out'),'the map has a way beyond its edge');
 assert.ok(map.includes('{beyondCard(()=>setOpen(false))}'),'on the full map too');assert.ok(screen.includes('onBeyond={goBeyond}')&&screen.includes('mapMoves(game)'));
 console.log('Beyond the map: eight ways off any land (choices, never chips; typed or from the map\'s compass), a new seeded land with a road from the edge, days on the road, the same at the table; lands travelled never forgotten (24 kept and travelled back to, solo and at the table, offered by name to the Dungeon Master and told in brief); only rumours and lands never reached give way when the map is full, else the road goes no further; the next tale keeps them all.');
})().catch(e=>{console.error(e);process.exit(1);});
