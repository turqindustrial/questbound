const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// The wider region: the Dungeon Master reveals places beyond a story's first three, each linked to where it was
// found; the hero travels the links, time passes by distance, saves stay valid, and written names stay intact.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','adventureRules.js','partyRules.js','skillRules.js','storyRules.js','followerRules.js','adventureStorage.js','deedRules.js','dmCommands.js','dmContext.js','hostileEncounter.js','quickActions.js','worldArtRules.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({adventureStep,newAdventure,validAdventure,adventureSnapshot,equipmentFor,dmChoices,dmContext,commitDmTurn,hostileEncounterGame,quickActions,storyText,travelRoute,mapLocation,placeName,locationArtSubject,placeArtSubject,npcScene,maxWorldPlaces})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const hero={name:'Wanderer',class:'Fighter',species:'Human',level:1,scores:{Strength:16,Dexterity:14,Constitution:14,Intelligence:10,Wisdom:12,Charisma:10},spells:[]};hero.equipment=r.equipmentFor(hero);
const hp={current:12,temp:0},valid=(g,h=hp)=>r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(g)),h,true),hero);
let g=r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0);g={...g,stage:'inn',enemyHP:g.enemyHP};delete g.openingAttackAvailable;assert.ok(valid(g));
const discover=(game,place,travel=true)=>r.adventureStep(game,hp,hero,{type:'discover',place,travel},()=>0.5);
// Reveal a place without going there: it joins the map, linked to camp.
const ridge={name:'Thornback Ridge',description:'A spine of wind-scoured rock above the road, crowned by a broken cairn.',kind:'mountain',bearing:'N',miles:2};
let found=discover(g,ridge,false);assert.equal(found.error,undefined);
// The place lies two miles off, north give or take a little (never dead on the compass point), the same every time.
const spot=found.game.world.places[0];same({...spot,x:0,y:0},{id:'p1',name:'Thornback Ridge',description:ridge.description,kind:'mountain',x:0,y:0,from:'inn'});
assert.ok(Math.abs(Math.hypot(spot.x,spot.y)-10560)<=2,'Two miles away');assert.ok(spot.y>10560*Math.cos(.31)&&Math.abs(spot.x)<10560*Math.sin(.31)+1,'Roughly north');same(discover(g,ridge,false).game.world.places[0],spot,'The same place every time');
assert.equal(found.game.stage,'inn');
assert.equal(found.events[0],'You learn the way to Thornback Ridge, 2 miles N of Caravan Camp.');assert.ok(valid(found.game));assert.equal(found.game.journal.entries.at(-1).title,'Learned of Thornback Ridge');
// Travel there: time passes by distance and the hero is "in the wild" at that place.
let trip=r.adventureStep(found.game,hp,hero,{type:'travel',destination:'p1'},()=>0.5);
assert.equal(trip.game.stage,'wild');assert.equal(trip.game.world.at,'p1');assert.equal(r.mapLocation(trip.game),'p1');assert.equal(trip.game.map.minutes,35);
assert.equal(trip.game.log[0],'You travel to Thornback Ridge. 2 miles; 35 minutes pass.');assert.ok(valid(trip.game));
// From the ridge, discover and walk straight to a further place; it links to the ridge, not to camp.
const cave={name:'Hollow of Teeth',description:'A cave mouth fringed with icicle-like stone, breathing cold air.',kind:'cave',bearing:'E',miles:1.5};
let deeper=discover(trip.game,cave);assert.equal(deeper.error,undefined);
assert.equal(deeper.game.world.at,'p2');assert.equal(deeper.game.world.places[1].from,'p1');assert.equal(deeper.events.length,2);assert.ok(valid(deeper.game));
// The way home follows the paths (cave → ridge → camp), not a straight line.
{const way=r.travelRoute(deeper.game,'p2','inn');assert.ok(Math.abs(way.feet-18480)<=3);assert.equal(way.minutes,62);}
const home=r.adventureStep(deeper.game,hp,hero,{type:'travel',destination:'inn'},()=>0.5);
assert.equal(home.game.stage,'inn');assert.equal(home.game.world.at,null);assert.ok(home.game.log[0].startsWith('You travel to Caravan Camp. 3.5 miles'));assert.ok(valid(home.game));
// Choices and quick actions offer known places; the DM sees the region.
const choices=r.dmChoices(hero,deeper.game).map(c=>c.id);assert.ok(choices.includes('travel-p1')&&choices.includes('travel-inn'));
assert.ok(r.quickActions(hero,deeper.game).some(a=>a.destination==='p1'&&a.label==='Thornback Ridge'));
const world=r.dmContext(hero,deeper.game,hp).world;assert.equal(world.current.name,'Hollow of Teeth');assert.equal(world.canDiscover,true);assert.equal(world.knownPlaces.length,5);assert.equal(world.knownPlaces.find(p=>p.id==='p1').distance,'1.5 miles');
// Through the DM turn path too.
const viaDm=r.commitDmTurn(hero,trip.game,hp,{type:'discover',place:cave,travel:true},{question:'I follow the cold air east to the cave I glimpsed.',narration:'You pick your way east.'},()=>0.5);
assert.equal(viaDm.error,undefined);assert.equal(viaDm.game.world.at,'p2');
// Naming an already-known place just travels there; nonsense is refused.
const again=discover(deeper.game,{...ridge,miles:5});assert.equal(again.game.world.places.length,2);assert.equal(again.game.world.at,'p1');
assert.match(discover(g,{...ridge,miles:40}).error,/not described clearly/);assert.match(discover(g,{...ridge,kind:'castle'}).error,/not described clearly/);
assert.match(r.adventureStep({...g,stage:'combat'},hp,hero,{type:'discover',place:ridge,travel:true}).error,/Finish this encounter/);
// Saves refuse impossible worlds.
assert.ok(!valid({...trip.game,world:{...trip.game.world,at:'p9'}}));assert.ok(!valid({...trip.game,world:{...trip.game.world,places:[{...trip.game.world.places[0],from:'p7'}]}}));
assert.ok(!valid({...found.game,world:{...found.game.world,places:[...found.game.world.places,{...found.game.world.places[0],id:'p2'}]}}),'Two places cannot share a name');
// The map fills up at its limit.
let full=g;for(let i=0;i<r.maxWorldPlaces;i++)full=discover(full,{...ridge,name:'Ridge '+i},false).game;
assert.match(discover(full,{...ridge,name:'One too many'},false).error,/map is full/);assert.ok(valid(full));
// Written names survive the story retelling (a place called "...Bridge" is not rewritten).
const bridgeTown=discover(g,{name:'Hangman\'s Bridge',description:'A rope bridge over a gorge, with a gallows at its far end.',kind:'landmark',bearing:'SW',miles:3});
assert.ok(bridgeTown.events[1].startsWith('You travel to Hangman\'s Bridge. 3 miles'));assert.equal(r.storyText(bridgeTown.game,bridgeTown.events[1]),bridgeTown.events[1]);
assert.equal(r.storyText(g,'You travel to Old Stone Bridge.'),'You travel to Overgrown Roadside.');
// Art and companions follow the hero out there.
assert.equal(r.locationArtSubject(trip.game).name,'Thornback Ridge');assert.equal(r.placeArtSubject(trip.game,'Thornback Ridge').id,'p1');
const joined=r.commitDmTurn(hero,g,hp,{type:'recruitment',plans:[{npcId:'mara',decision:'join',reason:'He wants to see the ridge.',terms:'Share the food.',dc:null}]},{question:'Tobin, will you come with me?',narration:'He grins.',npcId:'mara'},()=>.9).game;
const together=r.adventureStep(discover(joined,ridge,false).game,hp,hero,{type:'travel',destination:'p1'},()=>0.5).game;
assert.ok(r.npcScene(together).find(n=>n.id==='mara').present,'A companion travels into the wild');assert.ok(valid(together));
// Dying out in the wild: the hero lies where they fell and a natural 20 gets them up there.
const hurt=r.commitDmTurn(hero,trip.game,{current:1,temp:0},{type:'ai-check',check:{skill:'Athletics',ability:'Strength',dc:30,mode:'normal',reason:'Climb the cairn',success:'You reach the top.',failure:'You fall.',damageCount:2,damageDie:6,damageOn:'failure'}},{question:'I climb the cairn.',narration:'You climb.'},()=>0.5);
assert.equal(hurt.game.stage,'dying');assert.equal(r.mapLocation(hurt.game),'p1');assert.ok(valid(hurt.game,hurt.health));
const up=r.adventureStep(hurt.game,hurt.health,hero,'death-save',()=>0.99);assert.equal(up.game.stage,'wild');assert.equal(up.game.world.at,'p1');assert.ok(valid(up.game,up.health));
console.log('Passed: places revealed and travelled to, linked paths and travel time, DM choices and context, saves guarded, map limit, names kept, art and companions in the wild, and falling out there.');
