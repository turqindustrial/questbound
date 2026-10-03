const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Every story has its own land: its three starting places lie differently each time (a line, a fork, a loop: not
// one fixed triangle), a few more places are marked from the start, far journeys open new regions with maps of
// their own, and each region is drawn to suit its terrain. Also: the Dungeon Master and the story writer are asked
// for all of this, and what they send is tidied rather than refused.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','adventureRules.js','partyRules.js','skillRules.js','storyRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','mapLayout.js','mapArt.js','storyLog.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,hostileEncounterGame,newAdventure,adventureStep,commitDmTurn,dmContext,validAdventure,adventureSnapshot,validStory,freshStoryGame,makeGeography,validGeography,landmarkPlaces,terrains,mapRegions,regionOfPlace,regionPlaceIds,currentRegion,homeRegion,travelRoute,worldLinks,placeCoordinates,regionLayout,regionLabels,regionMapSvg,exitLabelBoxes,mapThemes,knownPlaceIds,mapLocation,durationText,maxRegions,storyEvents,storyFoeStats,encounterFoe})',{AsyncStorage:{}});
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const kara=r.readyHero('fighter'),hp={current:12,temp:0};
const valid=(g,h=hp)=>r.validAdventure(r.adventureSnapshot(kara,JSON.parse(JSON.stringify(g)),h,true),kara);
// ---- Geography: valid, repeatable, and never one fixed shape ----
const shapes=new Set(),angles=[];
for(let i=0;i<60;i++){
 const g=r.makeGeography('story-'+i);assert.ok(r.validGeography(g),'A drawn geography is valid ('+i+')');same(r.makeGeography('story-'+i),g,'The same story draws the same land');
 const via=g.links.find(l=>l.includes('tower'))[0],loop=g.links.length===3;shapes.add((loop?'loop':via==='inn'?'fork':'line'));
 angles.push(Math.round(Math.atan2(g.at.bridge.y,g.at.bridge.x)*180/Math.PI));
 const d=(a,b)=>Math.hypot(g.at[a].x-g.at[b].x,g.at[a].y-g.at[b].y);assert.ok(d('inn','bridge')>=400&&d('inn','tower')>=400&&d('bridge','tower')>=400,'Places stand apart');
}
same([...shapes].sort(),['fork','line','loop'],'Lines, forks and loops all turn up');
assert.ok(new Set(angles.map(a=>Math.round(a/45))).size>=7,'The dangerous place lies in every direction, story by story');
// The story writer's layout is honoured: direction (give or take), distance, and what the third place hangs off.
const hinted=r.makeGeography('x',{bridge:{bearing:'N',miles:2},tower:{bearing:'E',miles:1,from:'bridge'}});
assert.ok(hinted.at.bridge.y>9000&&Math.abs(hinted.at.bridge.x)<3400,'North, two miles');assert.ok(Math.abs(Math.hypot(hinted.at.bridge.x,hinted.at.bridge.y)-10560)<3);
assert.ok(hinted.links.some(l=>l[0]==='bridge'&&l[1]==='tower'));assert.ok(hinted.at.tower.x>hinted.at.bridge.x+4000,'East of the dangerous place');
assert.ok(r.validGeography(r.makeGeography('y',{bridge:{bearing:'up',miles:'far'},tower:null})),'A bad layout falls back to the seed');
assert.ok(!r.validGeography({at:{inn:{x:0,y:0},bridge:{x:10,y:0},tower:{x:900,y:900}},links:[['inn','bridge'],['bridge','tower']]}),'Places on top of each other are refused');
assert.ok(!r.validGeography({at:{inn:{x:0,y:0},bridge:{x:900,y:0},tower:{x:900,y:900}},links:[['inn','bridge']]}),'All three must be joined');
// ---- A new story: its geography, its land's name and terrain, and landmarks marked from the start ----
const base={...r.hostileEncounterGame(kara,r.newAdventure(kara),()=>0).story,id:'salt-1',title:'The Salt Road',status:'active'};delete base.openingDialogue;delete base.geography;delete base.introId;delete base.region;delete base.terrain;
const written={...base,region:'The Brinefold',terrain:'coast',layout:{bridge:{bearing:'W',miles:1.5},tower:{bearing:'S',miles:.8,from:'inn'}},
 locations:{inn:{name:'Saltmere',description:'A salt-pan village on stilts.',kind:'settlement'},bridge:{name:'The Drowned Causeway',description:'A sunken stone road across the marsh.',kind:'road'},tower:{name:'Gull Tower',description:'A leaning lighthouse full of nests.',kind:'castle'}},
 landmarks:[{name:'Tern Ferry',description:'A rope ferry across the brown estuary, with a bell to call the ferryman.',kind:'water',bearing:'E',miles:2,from:'inn',danger:'safe',feature:'A bell nobody answers.'},
  {name:'The Wreck of the Margit',description:'A cog broken on the bar, her ribs showing at low tide.',kind:'ruin',bearing:'N',miles:3,from:'bridge',danger:'risky',feature:''},
  {name:'Saltmere',description:'Not allowed: the name is taken.',kind:'settlement',bearing:'N',miles:1,from:'inn',danger:'safe',feature:''},
  {name:'Nowhere',description:'short',kind:'ruin',bearing:'N',miles:1,from:'inn',danger:'safe',feature:''}]};
const start=r.freshStoryGame(kara,written,r.newAdventure(kara));
assert.ok(valid(start,null),'A new story with its own land is a valid save');
assert.equal(start.story.layout,undefined);assert.equal(start.story.landmarks,undefined,'The hints are used, not stored');
assert.ok(r.validGeography(start.story.geography));assert.ok(start.story.geography.at.bridge.x<-6000,'West, as written');
// The story's main foe is sturdier than a creature met by the road, sized to the hero when the story begins.
same(r.storyFoeStats(1,'Piercing'),{maximum:18,ac:12,attackBonus:3,die:6,count:1,bonus:1,type:'Piercing',saves:{Strength:1,Dexterity:2,Constitution:1,Intelligence:0,Wisdom:0,Charisma:0}});
assert.equal(r.storyFoeStats(5).maximum,58);assert.equal(r.storyFoeStats(5,'Sonic').type,'Slashing');assert.ok(r.validStory({...start.story,foeStats:r.storyFoeStats(20)}));
const told=r.freshStoryGame(kara,{...written,foeStats:undefined,foeDamageType:'Poison'},r.newAdventure(kara));assert.equal(told.story.foeStats.type,'Poison');assert.equal(told.enemyHP,18);assert.equal(r.encounterFoe(kara,{...told,stage:'combat'}).maximum,18);
assert.equal(r.freshStoryGame(kara,{...written,foeStats:undefined,foeDamageType:'Sonic'},r.newAdventure(kara)).story.foeDamageType,undefined,'An unknown kind of harm is dropped');
same(r.homeRegion(start),{id:'home',name:'The Brinefold',terrain:'coast'});assert.equal(start.story.locations.tower.kind,undefined,'An unknown kind of place is dropped');assert.equal(start.story.locations.bridge.kind,'road');
same(start.world.places.map(p=>[p.id,p.name,p.from,p.danger??'safe']),[['p1','Tern Ferry','inn','safe'],['p2','The Wreck of the Margit','bridge','risky']],'Good landmarks are on the map; a taken name and a thin description are left off');
assert.ok(!start.map.visited.includes('p1'),'Heard of, not visited');assert.equal(start.world.places[1].feature,undefined);
assert.equal(r.worldLinks(start).length,start.story.geography.links.length+2);
// Travel follows the story's own paths and distances.
const toFerry=r.adventureStep(start,hp,kara,{type:'travel',destination:'p1'},()=>0.99);assert.equal(toFerry.error,undefined);assert.equal(toFerry.game.world.at,'p1');assert.match(toFerry.game.log[0],/^You travel to Tern Ferry\. 2 miles; 35 minutes pass\.$/);
const toCauseway=r.adventureStep(start,hp,kara,{type:'travel',destination:'bridge'},()=>0.99);assert.equal(toCauseway.game.stage,'bridge');assert.match(toCauseway.game.log[0],/1\.5 miles; 26 minutes pass/);
// A story with nothing extra still gets a land of its own; an old save keeps the old triangle.
const plain=r.freshStoryGame(kara,base,r.newAdventure(kara));assert.ok(r.validGeography(plain.story.geography));assert.equal(plain.world,undefined);assert.ok(r.terrains.includes(r.homeRegion(plain).terrain));assert.match(r.homeRegion(plain).name,/^Lands about /);
const old={...plain,story:{...plain.story}};delete old.story.geography;assert.ok(valid(old,null));same(r.placeCoordinates(old,'tower'),{x:900,y:1200});same(r.travelRoute(old,'inn','tower'),{feet:1500,minutes:5});assert.equal(r.worldLinks(old).length,3);
// ---- Far journeys: a discovery with a region opens a new map ----
const camp={...start,stage:'inn'};
const voyage={name:'Port Halloway',description:'A harbour town of tarred sheds and gulls, three days down the coast.',kind:'settlement',bearing:'S',miles:140,danger:'safe',feature:null,lair:null,region:{name:'The Halloway Shore',terrain:'hills'}};
assert.match(r.adventureStep(camp,hp,kara,{type:'discover',place:{...voyage,region:null},travel:true},()=>0.5).error,/not described clearly/,'Days of travel need a new land');
assert.match(r.adventureStep(camp,hp,kara,{type:'discover',place:{...voyage,region:{name:'X',terrain:'hills'}},travel:true},()=>0.5).error,/new land/);
assert.match(r.adventureStep(camp,hp,kara,{type:'discover',place:{...voyage,region:{name:'Somewhere',terrain:'jungle'}},travel:true},()=>0.5).error,/new land/);
const sailed=r.adventureStep(camp,hp,kara,{type:'discover',place:voyage,travel:true},()=>0.5);
assert.equal(sailed.error,undefined);assert.equal(sailed.game.world.at,'p3');same(sailed.game.world.regions,[{id:'r1',name:'The Halloway Shore',terrain:'hills'}]);assert.equal(sailed.game.world.places[2].region,'r1');
assert.match(sailed.events[0],/in a land new to you: The Halloway Shore\.$/);assert.match(sailed.events[1],/140 miles; [\d.]+ days pass/);assert.ok(valid(sailed.game));
assert.equal(r.currentRegion(sailed.game),'r1');same(r.mapRegions(sailed.game).map(x=>x.name),['The Brinefold','The Halloway Shore']);
assert.ok(r.storyEvents(camp,sailed.game,kara,{}).some(([kind,text])=>text==='Set out for a new land: The Halloway Shore.'),'The log notes the new land');
// Places found there belong to that land; places found back home belong to home.
const inland=r.adventureStep(sailed.game,hp,kara,{type:'discover',place:{name:'Halloway Beacon',description:'A stone beacon tower on the headland above the town.',kind:'landmark',bearing:'W',miles:1.2,danger:'safe',feature:null,lair:null,region:null},travel:false},()=>0.5).game;
assert.equal(inland.world.places.at(-1).region,'r1');same(r.regionPlaceIds(inland,'r1'),['p3','p4']);same(r.regionPlaceIds(inland,'home'),['inn','bridge','tower','p1','p2']);
// Naming the same land again adds to it instead of opening another.
const again=r.adventureStep({...inland,stage:'inn',world:{...inland.world,at:null}},hp,kara,{type:'discover',place:{...voyage,name:'Cutter Cove',miles:150,region:{name:'the halloway shore',terrain:'coast'}},travel:false},()=>0.5).game;
assert.equal(again.world.regions.length,1);assert.equal(again.world.places.at(-1).region,'r1');
// The way back is a long road: walked eight hours a day.
const back=r.travelRoute(inland,'p3','inn');assert.ok(Math.abs(back.feet-140*5280)<3);assert.equal(back.minutes,Math.round(140*5280/300)*3);assert.match(r.durationText(back.minutes),/days$/);
// The Dungeon Master is told which land the hero is in and which they know.
const world=r.dmContext(kara,inland,hp).world;same(world.region,{name:'The Halloway Shore',terrain:'hills'});same(world.regions,['The Brinefold','The Halloway Shore']);assert.equal(world.knownPlaces.find(p=>p.id==='p1').land,'The Brinefold');assert.equal(world.knownPlaces.find(p=>p.id==='bridge').kind,'road');
// Saves refuse a place in a land that does not exist, and more lands than the atlas holds.
assert.ok(!valid({...inland,world:{...inland.world,places:inland.world.places.map(p=>p.id==='p4'?{...p,region:'r5'}:p)}}));
assert.ok(!valid({...inland,world:{...inland.world,regions:Array.from({length:r.maxRegions},(_,i)=>({id:'r'+(i+1),name:'Land '+i,terrain:'plains'}))}}));
// ---- One sheet per region ----
const home=r.regionLayout(inland,360,340,{region:'home'}),shore=r.regionLayout(inland,360,340,{region:'r1'});
same(home.ids,['inn','bridge','tower','p1','p2']);same(shore.ids,['p3','p4']);assert.equal(r.regionLayout(inland,360,340).region,'r1','The sheet of the land the hero is in by default');
same(home.exits.map(e=>[e.from,e.to,e.region]),[['inn','p3','r1']]);same(shore.exits.map(e=>[e.from,e.to,e.region]),[['p3','inn','home']]);
assert.ok(home.exits[0].y>home.at.inn.y&&home.exits[0].y>=320,'The road south leaves by the bottom edge');assert.ok(shore.exits[0].y<=20,'and arrives from the north');
for(const layout of [home,shore])for(const id of layout.ids){const p=layout.at[id];assert.ok(p.x>=37&&p.x<=323&&p.y>=37&&p.y<=303,id+' inside its sheet');}
const lone=r.regionLayout(sailed.game,360,340,{region:'r1'});same(lone.at.p3,{x:180,y:165},'A land with one known place puts it in the middle');
// The starting three no longer make the same triangle: across stories their sheets differ.
const sheets=new Set();for(let i=0;i<12;i++){const g=r.freshStoryGame(kara,{...base,id:'shape-'+i},r.newAdventure(kara)),l=r.regionLayout(g,340,323);sheets.add(JSON.stringify(l.at)+JSON.stringify(l.links));}
assert.ok(sheets.size>=11,'Twelve stories, (nearly) twelve different maps: '+sheets.size);
// ---- Drawn to suit the land ----
const draw=(game,region,terrain,w=360,h=340)=>{const layout=r.regionLayout(game,w,h,{region}),names=Object.fromEntries(layout.exits.map(e=>[e.to,r.mapRegions(game).find(x=>x.id===e.region).name]));
 return r.regionMapSvg({w,h,seed:game.story.id+':'+region,terrain,ids:layout.ids,at:layout.at,links:layout.links,exits:layout.exits,exitNames:names,labels:r.regionLabels(game,w,h,layout,{here:r.mapLocation(game)}),here:r.mapLocation(game),visited:new Set(game.map.visited),kinds:Object.fromEntries(layout.ids.map(id=>[id,'wilds'])),icons:Object.fromEntries(layout.ids.map(id=>[id,'compass'])),title:r.mapRegions(game).find(x=>x.id===region).name});};
const drawn={};
for(const terrain of r.terrains){
 assert.ok(r.mapThemes[terrain],terrain+' has a theme');
 const svg=draw(inland,'home',terrain);drawn[terrain]=svg;
 assert.ok(svg.length>2500,terrain);assert.ok(!/NaN|undefined|Infinity/.test(svg),terrain+': clean numbers');assert.equal(draw(inland,'home',terrain),svg,terrain+': the same sheet every time');
 assert.equal((svg.match(/<circle r="14.5"/g)??[]).length,5,terrain+': a marker for every place');assert.ok(svg.includes('THE BRINEFOLD'));assert.ok(svg.includes('to The Halloway Shore'),terrain+': the road out is named');
}
assert.equal(new Set(Object.values(drawn)).size,r.terrains.length,'Every terrain draws its own sheet');
assert.ok(drawn.coast.includes('#7fa3a8'),'A coast has a sea');assert.ok(!drawn.desert.includes('#7fa3a8'));assert.ok(drawn.caverns.includes('#3b2f24'),'Caverns have walls');
assert.notEqual(draw(inland,'r1','hills'),drawn.hills,'Another region of the same terrain is another map');
// Sheets of other sizes and a crowded land stay clean.
for(const [w,h] of [[230,250],[760,517],[1180,680]])for(const terrain of ['coast','mountains','forest','marsh','snow'])assert.ok(!/NaN|undefined|Infinity/.test(draw(inland,'home',terrain,w,h)),terrain+' at '+w+'×'+h);
console.log('Passed: every story draws its own land (lines, forks and loops in every direction, the writer\'s layout honoured, old saves unchanged), landmarks are on the map from the start, far journeys open new regions with their own sheets and roads between them, saves guard regions, and all '+r.terrains.length+' terrains draw their own repeatable, clean maps.');
