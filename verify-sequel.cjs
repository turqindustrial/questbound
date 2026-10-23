const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const {rulesSource}=require('./rules-files.cjs');
// The next chapter: continuing in the same region carries the old story's places (shifted a few miles off and joined
// to the new start), its people and everyone met since (with memories, ties, fates, companions), the pack and
// draughts; setting out somewhere new keeps only the companions and the pack. The roster sets heroes aside with
// their adventures; the fallen go to the graveyard.
const source=rulesSource({extra:['worldArtRules.js','rosterRules.js']});
const r=vm.runInNewContext(source+'\n({readyHero,hostileEncounterGame,newAdventure,adventureStep,commitDmTurn,dmContext,validAdventure,adventureSnapshot,npcScene,introducePerson,resolveRecruitment,freshStoryGame,carriedBase,joinRegion,canContinueRegion,regionSummary,storyText,packOf,setAside,validRosterEntry,restoreEntry,validGrave,maxRoster,mapLocation,placeName,travelRoute,worldPlaces,mapRegions,oldPlaceLimit,memoryOf,metPerson,greeting,nextTalePlacement,sequelMiles,stagingNameKey,regionOfPlace,knownPlaceIds,libraryPeopleMet,stagingIds})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const kara=r.readyHero('fighter'),hp={current:12,temp:0};
const valid=(g,h=null)=>r.validAdventure(r.adventureSnapshot(kara,JSON.parse(JSON.stringify(g)),h,true),kara);
// ---- The first story: a hut found in the hills, a man met there, a lair beyond, Tobin along, the foe slain ----
let g={...r.hostileEncounterGame(kara,r.newAdventure(kara),()=>0),stage:'inn'};delete g.openingAttackAvailable;
g=r.adventureStep(g,hp,kara,{type:'discover',place:{name:'Smokewood Hut',description:'A woodcutter\'s hut in the northern hills.',kind:'settlement',bearing:'N',miles:2.5,danger:'safe'},travel:true},()=>0.5).game;
g=r.introducePerson(g,{name:'Harlan Voss',species:'Human',role:'A woodcutter who lives alone in the hills.',appearance:'A broad, grey-bearded man in a sap-stained leather apron.',personality:'Terse, careful, kind underneath.',toughness:'common',attitude:'friendly',foe:'enemy',tie:{to:'keeper',kind:'family'}}).game;
g=r.adventureStep(g,hp,kara,{type:'discover',place:{name:'Widow Hollow',description:'A dripping hollow strung with grey silk.',kind:'cave',bearing:'E',miles:1,danger:'lair',feature:'A satchel under the webs.',lair:{template:'spider',name:'Grey Widow',appearance:'A spider as large as a pony, grey and bristled.'}},travel:false},()=>0.5).game;
g=r.adventureStep(g,hp,kara,{type:'travel',destination:'inn'},()=>0.5).game;
g=r.resolveRecruitment(kara,g,hp,[{npcId:'mara',decision:'join',reason:'He wants to see the world.',terms:'He cooks.',dc:null}],'Tobin, come with me.',null,()=>0.5).game;
g={...g,npcMemory:{...g.npcMemory,n1:{attitude:'devoted',response:'Devoted to the player and eager to help.',memories:['The player saved my brother.'],bond:'The player saved my brother.'}},foeFate:'slain',enemyHP:0,story:{...g.story,status:'complete'},pack:{gold:120,items:[{name:'Brass crow token',kind:'quest',qty:1}],spent:{}},potions:3};
assert.ok(valid(g),'The first story is a valid save');assert.ok(r.canContinueRegion(g));
const summary=r.regionSummary(g,'N');
assert.equal(summary.previousTitle,g.story.title);assert.equal(summary.outcome,'completed');assert.ok(summary.places.includes('Smokewood Hut'));
assert.ok(summary.people.some(p=>p.name==='Harlan Voss'&&p.feelingAboutHero==='owes the hero a debt'));assert.ok(summary.people.some(p=>p.name==='Tobin Reed'&&p.travelsWithHero));
assert.match(summary.newStartBearing,/south of Caravan Camp/);
// ---- A second story, written for the same region ----
const story2={...g.story,id:'s2',title:'The Salt Road',status:'active',premise:'Salt caravans vanish on the marsh road.',opening:'Gulls scream over the salt pans.',foe:'Marsh Hag',foeSpecies:'Hag',
 locations:{inn:{name:'Saltmere',description:'A salt-pan village on stilts.'},bridge:{name:'The Drowned Causeway',description:'A sunken stone road across the marsh.'},tower:{name:'Gull Tower',description:'A leaning lighthouse full of nests.'}},
 npcs:{keeper:{...g.story.npcs.keeper,name:'Ysolde Fenn'},mara:{...g.story.npcs.mara,name:'Pim Ashdown'}}};
delete story2.openingDialogue;
const fresh=r.freshStoryGame(kara,story2,r.newAdventure(kara,r.carriedBase(g)));
// Experience carries into the next tale; the tale's tally (fights, places, leads) starts again.
{const withXp=r.freshStoryGame(kara,story2,r.newAdventure(kara,r.carriedBase({...g,xp:250,xpTally:{tale:g.story.id,fights:4,places:2,leads:[]}})));assert.equal(withXp.xp,250);assert.equal(withXp.xpTally,undefined);assert.ok(valid(withXp));}
let next=r.joinRegion(fresh,g,{sameRegion:true,bearing:'N',miles:5});
assert.ok(valid(next),'The continued story is a valid save');
// Places: the old start, its two neighbours, then the places found there, joined in order.
// The lookout hangs off whichever place the earlier story's own paths joined it to.
const rockFrom=g.story.geography.links.some(l=>l.includes('tower')&&l.includes('inn'))?'p1':'p2';
same(next.world.places.map(p=>[p.id,p.name,p.from]),[['p1','Caravan Camp','inn'],['p2','Overgrown Roadside','p1'],['p3','Lookout Rock',rockFrom],['p4','Smokewood Hut','p1'],['p5','Widow Hollow','p4']]);
// The earlier country keeps a map of its own.
same(next.world.regions.map(x=>[x.id,x.name]),[['r1','Lands about Caravan Camp']],'The new story is set on the same Caravan Road, so the earlier sheet is named for its camp');
assert.equal(r.joinRegion(r.freshStoryGame(kara,{...story2,region:'The Brinefold'},r.newAdventure(kara,r.carriedBase(g))),g,{sameRegion:true,bearing:'N',miles:5}).world.regions[0].name,'The Caravan Road');
// The new residents' first impressions sit beside what old acquaintances remember.
{const warm=r.joinRegion(r.freshStoryGame(kara,{...story2,npcs:{...story2.npcs,keeper:{...story2.npcs.keeper,regard:{stance:'scornful',reason:'I have no use for sellswords.'}}}},r.newAdventure(kara,r.carriedBase(g))),g,{sameRegion:true,bearing:'N',miles:5});assert.equal(warm.npcMemory.keeper.attitude,'unfriendly');assert.equal(warm.npcMemory.n3.bond,'The player saved my brother.');assert.ok(valid(warm));}assert.ok(next.world.places.every(p=>p.region==='r1'),'Every old place is on the old map');
assert.equal(next.world.places[0].y,26400,'Five miles north');assert.equal(next.world.places[4].threat.name,'Grey Widow');
assert.ok(r.travelRoute(next,'inn','p4'),'There is a road back');assert.ok(next.map.visited.includes('p1')&&next.map.visited.includes('p4'));
// People: the old residents and Harlan, with their homes, ties, memories and Tobin still at your side.
same(Object.entries(next.people).map(([id,p])=>[id,p.name,p.home,p.tie?.to??null]),[['n1','Captain Oona Brask','p1','n2'],['n2','Tobin Reed','p1','n1'],['n3','Harlan Voss','p4','n1']]);
assert.equal(next.people.n1.toughness,'tough');assert.equal(next.npcMemory.n3.bond,'The player saved my brother.');
assert.equal(next.followers.n2.status,'following');assert.ok(r.npcScene(next).find(n=>n.id==='n2').present,'Tobin is beside you at the new start');
assert.ok(!r.npcScene(next).find(n=>n.id==='n1').present);
const back=r.adventureStep(next,hp,kara,{type:'travel',destination:'p1'},()=>0.5);assert.equal(back.error,undefined);
assert.ok(r.npcScene(back.game).find(n=>n.id==='n1').present,'The captain is where you left her');assert.ok(valid(back.game));
// Pack, draughts, history.
assert.equal(r.packOf(next,kara).gold,120);assert.equal(next.potions,3);same(next.pack.items.map(i=>i.name),['Brass crow token']);
assert.ok(next.journal.entries.some(e=>e.title==='Previously'&&/Travelling with you: Tobin Reed/.test(e.text)));
assert.ok(next.worldFacts.some(t=>/Earlier, in .*The Bandit Cutthroat was slain/.test(t)));
// The new story's names stay as written; the old residents are not mistaken for the new ones.
const ctx=r.dmContext(kara,next,hp);assert.ok(ctx.nearbyNPCs.some(n=>n.name==='Tobin Reed'));assert.ok(ctx.nearbyNPCs.some(n=>n.name==='Ysolde Fenn'));
assert.equal(r.storyText(next,'Tobin Reed nods to Ysolde Fenn.'),'Tobin Reed nods to Ysolde Fenn.');
// A name the new story also uses, and an old place the new story also has, are told apart.
const twin=r.joinRegion(r.freshStoryGame(kara,{...story2,locations:{...story2.locations,tower:{name:'Lookout Rock',description:'A rock.'}},npcs:{...story2.npcs,mara:{...story2.npcs.mara,name:'Tobin Reed'}}},r.newAdventure(kara,r.carriedBase(g))),g,{sameRegion:true,bearing:'E',miles:4});
assert.ok(twin.world.places.some(p=>p.name==='Old Lookout Rock'));assert.ok(Object.values(twin.people).some(p=>p.name==='Tobin Reed the Elder'));assert.ok(valid(twin));
// ---- Somewhere new: only companions and the pack ----
const away=r.joinRegion(fresh,g,{sameRegion:false});
assert.equal(away.world,undefined);same(Object.entries(away.people).map(([id,p])=>[id,p.name,p.home]),[['n1','Tobin Reed','inn']]);assert.equal(away.followers.n1.status,'following');
assert.ok(away.journal.entries.some(e=>e.title==='Previously'&&/left Caravan Camp behind/.test(e.text)));assert.ok(valid(away));assert.equal(r.packOf(away,kara).gold,120);
// ---- The dead stay dead ----
const mourned={...g,npcFate:{n1:'dead'},npcHP:{...g.npcHP,n1:0}};
const after=r.joinRegion(fresh,mourned,{sameRegion:true,bearing:'S',miles:6});assert.equal(after.npcFate.n3,'dead');assert.equal(after.npcHP.n3,0);assert.ok(valid(after));
// ---- The roster and the graveyard ----
const pip=r.readyHero('rogue');
let lists=r.setAside([],[],kara,g,hp,true,Date.UTC(2026,9,1));
assert.equal(lists.roster.length,1);assert.ok(r.validRosterEntry(lists.roster[0]));same(lists.roster[0].summary.story,g.story.title);
const restored=r.restoreEntry(lists.roster[0]);same(restored.game,JSON.parse(JSON.stringify(g)));assert.equal(restored.hero.name,kara.name);
lists=r.setAside(lists.roster,lists.graves,kara,back.game,hp,true);assert.equal(lists.roster.length,1,'The same hero set aside again replaces their entry');
const dead={...g,stage:'dead',death:{cause:'Killed by the Grey Widow',place:'Widow Hollow',at:'p2'}};
const buried=r.setAside(lists.roster,lists.graves,pip,dead,{current:0,temp:0},true);
assert.equal(buried.graves.length,1);assert.ok(r.validGrave(buried.graves[0]));assert.equal(buried.graves[0].cause,'Killed by the Grey Widow');assert.equal(buried.roster.length,1,'The dead are not playable');
const full=Array.from({length:r.maxRoster},(_,i)=>({...lists.roster[0],id:'x'+i,character:JSON.stringify({...kara,name:'Hero '+i})}));
assert.match(r.setAside(full,[],pip,r.newAdventure(pip),null,false).error,/already has 8 heroes/);
// ---- Lands travelled are never forgotten (2026-10-12): places the hero went to come along however far down the list
// they are (past the twenty places only heard of that come too), as lands of their own, with the roads back ----
{let w=g;for(let i=0;i<30;i++)w=r.adventureStep(w,hp,kara,{type:'discover',place:{name:'Heard-of Cairn '+i,description:'A cairn someone spoke of, never visited.',kind:'ruin',bearing:'S',miles:1+i/10},travel:false},()=>0.5).game;
 w=r.adventureStep(w,hp,kara,{type:'discover',place:{name:'Saltglass Harbour',description:'A harbour of green glass towers across the strait.',kind:'settlement',bearing:'E',miles:120,region:{name:'The Glass Coast',terrain:'coast'}},travel:true},()=>0.9).game;
 w=r.adventureStep(w,hp,kara,{type:'discover',place:{name:'Glass Market',description:'A market of glassblowers above the harbour.',kind:'settlement',bearing:'N',miles:2},travel:true},()=>0.9).game;
 w=r.adventureStep(w,hp,kara,{type:'travel',destination:'inn'},()=>0.5).game;assert.ok(valid(w));
 const joined=r.joinRegion(r.freshStoryGame(kara,{...story2,id:'s3'},r.newAdventure(kara,r.carriedBase(w))),w,{sameRegion:true,bearing:'N',miles:5}),names=r.worldPlaces(joined).map(p=>p.name);
 assert.ok(names.includes('Saltglass Harbour')&&names.includes('Glass Market'),'places visited in a far land come along');
 {const heard=names.filter(n=>n.startsWith('Heard-of Cairn')).length;assert.ok(heard<=r.oldPlaceLimit&&heard>=r.oldPlaceLimit-2,'and up to twenty places only heard of: '+heard);}
 assert.ok(r.mapRegions(joined).some(x=>x.name==='The Glass Coast'),'as a land of its own');
 assert.ok(r.travelRoute(joined,'inn',r.worldPlaces(joined).find(p=>p.name==='Glass Market').id),'with the road back');assert.ok(valid(joined));}
// ---- Every land of a campaign remembered (2026-10-23, the host's words: "all areas traveled in a single campaign should
// be remembered so they can be returned to. and NPCs should all have memory of seeing the player before if they have"):
// the next tale joins the earlier world where the hero stands (the anchor), near or days away, in whichever land ----
{for(let i=0;i<40;i++){const near=r.nextTalePlacement(Math.random),far=r.nextTalePlacement(Math.random,{far:true});
  assert.ok(near.miles>=4&&near.miles<=7&&far.miles>=60&&far.miles<=200,JSON.stringify([near,far]));}
 same(r.sequelMiles,{near:[4,7],far:[60,200]});
 // The earlier world: a far land with a market the hero walked to and stands in (never back at the start).
 let w=r.adventureStep(g,hp,kara,{type:'discover',place:{name:'Saltglass Harbour',description:'A harbour of green glass towers across the strait.',kind:'settlement',bearing:'E',miles:120,region:{name:'The Glass Coast',terrain:'coast'}},travel:true},()=>0.9).game;
 w=r.adventureStep(w,hp,kara,{type:'discover',place:{name:'Glass Market',description:'A market of glassblowers above the harbour.',kind:'settlement',bearing:'N',miles:2},travel:true},()=>0.9).game;
 w=r.adventureStep(w,hp,kara,{type:'discover',place:{name:'The Mill',description:'A tide mill on the glass coast, its wheel still.',kind:'landmark',bearing:'S',miles:1},travel:false},()=>0.9).game;
 // People of the earlier tale: one met at the market, a resident there never met (someone the hero never reached), one
 // still out of sight where the hero has been, and one met who lives where the hero stood.
 const market=r.worldPlaces(w).find(p=>p.name==='Glass Market').id,mill=r.worldPlaces(w).find(p=>p.name==='The Mill').id,hut=r.worldPlaces(w).find(p=>p.name==='Smokewood Hut').id;
 const person=(name,home,extra={})=>({name,species:'Human',role:'A glassblower on the coast.',appearance:'A lean woman with burn-scarred hands and a leather apron.',personality:'Quick and wry.',toughness:'common',home,foe:'neutral',gender:'woman',...extra});
 w={...w,people:{...w.people,n4:person('Ilse Varro',market,{resident:true}),n5:person('Odile Marsh',mill,{resident:true}),n6:person('Bettany Crow',hut,{resident:true,hidden:true}),n7:person('Wenna Hask',hut,{resident:true})},
  npcMemory:{...w.npcMemory,n4:{attitude:'indifferent',response:'Neutral toward the player.',memories:['The traveller asked about the kilns.']},n7:{attitude:'indifferent',response:'Neutral toward the player.',memories:['The traveller bought a lamp from me at the hut.']}}};
 assert.ok(valid(w),'the earlier world is a valid save');assert.equal(r.mapLocation(w),market,'the hero stands in the far land');
 same(['n4','n5','n6','n7'].map(id=>r.metPerson(w,id)),[true,false,false,true],'met, never reached, still out of sight, met');
 // A far placement (somewhere new), anchored where the hero stands: the market lies those miles off the new start, a
 // road runs to it, and every place the hero ever went to can be walked back to from the new start.
 const s4={...story2,id:'s4',title:'The Tide Road',locations:{...story2.locations,bridge:{name:'Mill',description:'A watermill on the tide road, wheel turning.'}}};
 const joined=r.joinRegion(r.freshStoryGame(kara,s4,r.newAdventure(kara,r.carriedBase(w))),w,{sameRegion:true,bearing:'W',miles:150,anchor:r.mapLocation(w)});
 assert.ok(valid(joined),'the joined tale is a valid save');
 const at=r.worldPlaces(joined).find(p=>p.name==='Glass Market');assert.equal(at.from,'inn','the road from the new start runs to where the hero stood');
 assert.equal(Math.round(Math.hypot(at.x,at.y)/5280),150,'150 miles off');assert.ok(at.x<0,'to the west');
 assert.ok(r.travelRoute(joined,'inn',at.id).minutes>480*3*2,'days on the road');
 const keyOf=p=>p.name,oldVisited=w.map.visited.length;assert.equal(joined.map.visited.length,1+oldVisited,'every place the hero went to comes along');
 for(const id of joined.map.visited)assert.ok(r.travelRoute(joined,'inn',id),'and can be walked back to: '+id);
 assert.ok(r.mapRegions(joined).some(x=>x.name==='The Glass Coast')&&r.mapRegions(joined).some(x=>x.name==='Lands about Caravan Camp'),'both earlier lands kept as lands of their own');
 assert.equal(r.regionOfPlace(joined,at.id),r.mapRegions(joined).find(x=>x.name==='The Glass Coast').id,'the anchor keeps its land');
 {const camp=r.worldPlaces(joined).find(p=>p.name==='Caravan Camp');assert.ok(camp&&r.travelRoute(joined,'inn',camp.id),'the earlier start is reached through the far land');}
 // Names as the staging compares them: "The Mill" of the earlier tale and the new tale's "Mill" never both show.
 const keys=[...Object.values(joined.story.locations).map(l=>l.name),...r.worldPlaces(joined).map(keyOf)].map(r.stagingNameKey);
 assert.equal(new Set(keys).size,keys.length,'no two places read as one name');assert.ok(r.worldPlaces(joined).some(p=>p.name==='The Old Mill'),'the earlier one is the Old Mill');
 // People: met stays met (with memories, greeted as someone known), never reached stays unmet, out of sight stays so.
 const nid=name=>Object.entries(joined.people).find(([,p])=>p.name===name)?.[0];
 same(['Ilse Varro','Odile Marsh','Bettany Crow','Wenna Hask'].map(n=>r.metPerson(joined,nid(n))),[true,false,false,true],'who was met is met, who was not is not');
 assert.ok(joined.people[nid('Odile Marsh')].resident&&joined.people[nid('Bettany Crow')].hidden,'kept as residents of their homes');
 same(joined.npcMemory[nid('Ilse Varro')].memories,['The traveller asked about the kilns.'],'their memories with them');
 {const there=r.adventureStep(joined,hp,kara,{type:'travel',destination:at.id},()=>0.9).game;assert.equal(r.greeting(there,nid('Ilse Varro'),kara).mood,'again','greeted as someone met before');}
 // Near, from the start (the default anchor), as before: the earlier start a few miles off.
 const nearby=r.joinRegion(r.freshStoryGame(kara,{...s4,id:'s5'},r.newAdventure(kara,r.carriedBase(w))),w,{sameRegion:true,bearing:'N',miles:5});
 assert.equal(r.worldPlaces(nearby).find(p=>p.name==='Caravan Camp').y,26400,'the default anchor is the earlier start');assert.ok(valid(nearby));
 assert.ok(nearby.storyLog.some(e=>/a new tale began nearby/.test(e.text))&&joined.storyLog.some(e=>/a new tale began, days down the road/.test(e.text)),'the story log says how far');
 // Someone met where they stood rather than at their home: still met once their home is on the map unvisited.
 {const metAway={...w,people:{...w.people,n8:person('Cass Orrin',mill,{resident:true})},npcMemory:{...w.npcMemory}};const seen={...metAway,world:{...metAway.world,at:mill},stage:'wild'};
  assert.equal(r.metPerson(seen,'n8'),true,'met where they live, standing there');const j=r.joinRegion(r.freshStoryGame(kara,{...s4,id:'s6'},r.newAdventure(kara,r.carriedBase(seen))),seen,{sameRegion:true,bearing:'N',miles:5,anchor:'wild'});
  const id=Object.entries(j.people).find(([,p])=>p.name==='Cass Orrin')[0];assert.equal(r.metPerson(j,id),true,'and still met in the next tale');assert.ok(valid(j));}
}
// The story writer never knows whom the hero has met, so a next tale may cast a library person the hero already knows:
// the new tale's one keeps the library's identity (its name, which a written tale's staging uses); the earlier one keeps
// the hero's history but stands for nobody in the library ("the Elder", no pool or hook), so no library person is in a
// game twice, and every other library person kept still counts as met (poolTaken).
{const known={...g,people:{...g.people,n1:{...g.people.n1,pool:'np042',hook:'Keeps a letter he never sent.'},n2:{name:'Mirela Danu',species:'Human',role:'A ferrywoman on the hill road.',appearance:'A broad woman with tar-black hands and a rope coil.',personality:'Blunt.',toughness:'common',home:g.people.n1.home,foe:'neutral',gender:'woman',pool:'np043',hook:'Owes the toll-keeper a season of wages.'}},
  npcMemory:{...g.npcMemory,n2:{attitude:'friendly',response:'Friendly toward the player.',memories:['The traveller helped me with the ferry rope.']}}};
 assert.ok(valid(known));same(r.libraryPeopleMet(known).sort(),['np042','np043']);
 const recast={...story2,id:'s7',npcs:{...story2.npcs,keeper:{...story2.npcs.keeper,name:'Harlan Voss',pool:'np042'}}};
 const j=r.joinRegion(r.freshStoryGame(kara,recast,r.newAdventure(kara,r.carriedBase(known))),known,{sameRegion:true,bearing:'N',miles:5});
 assert.ok(valid(j),'still a valid save');same(r.libraryPeopleMet(j).sort(),['np042','np043'],'each library person once: the new tale\'s keeper and the ferrywoman kept');
 const elder=Object.values(j.people).find(p=>p.name==='Harlan Voss the Elder');assert.ok(elder,'the earlier one is told apart by name');assert.equal(elder.pool,undefined);assert.equal(elder.hook,undefined);
 assert.equal(j.npcMemory[Object.entries(j.people).find(([,p])=>p===elder)[0]].bond,'The player saved my brother.','and keeps the hero\'s history');
 assert.equal(r.stagingIds(j).person('Harlan Voss'),'keeper','the name resolves to the new tale\'s own');
 const mirela=Object.values(j.people).find(p=>p.name==='Mirela Danu');assert.equal(mirela.pool,'np043');assert.equal(mirela.hook,'Owes the toll-keeper a season of wages.');}
// The hero's whole story comes along either way (memoryRules.js, verify-memory.cjs): the earlier tale closed in the
// chronicle, the new one under way.
for(const sameRegion of [true,false]){const m=r.memoryOf(r.joinRegion(r.freshStoryGame(kara,story2,r.newAdventure(kara,r.carriedBase(g))),g,{sameRegion,bearing:'N'}));
 assert.deepEqual(JSON.parse(JSON.stringify(m.tales.map(t=>[t.title,t.status,!!t.summary]))),[[g.story.title,'complete',true],['The Salt Road','active',false]],'the chronicle carries on ('+(sameRegion?'same region':'somewhere new')+')');}
console.log('Passed: the next chapter keeps the region (old places joined a few miles off or days away, at the place where the hero stood, in any land, every place visited reachable, people met kept met and those never reached unmet, names told apart as the staging reads them; people with homes, ties, memories, fates and companions, the pack and the history), somewhere new keeps only companions and the pack (and the whole chronicle, both ways), names are told apart, and heroes are set aside in the roster or remembered in the graveyard.');
