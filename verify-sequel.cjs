const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// The next chapter: continuing in the same region carries the old story's places (shifted a few miles off and joined
// to the new start), its people and everyone met since (with memories, ties, fates, companions), the pack and
// draughts; setting out somewhere new keeps only the companions and the pack. The roster sets heroes aside with
// their adventures; the fallen go to the graveyard.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','adventureRules.js','skillRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','worldArtRules.js','iconPaths.js','quickActions.js','pregens.js','sequelRules.js','rosterRules.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,hostileEncounterGame,newAdventure,adventureStep,commitDmTurn,dmContext,validAdventure,adventureSnapshot,npcScene,introducePerson,resolveRecruitment,freshStoryGame,carriedBase,joinRegion,canContinueRegion,regionSummary,storyText,packOf,setAside,validRosterEntry,restoreEntry,validGrave,maxRoster,mapLocation,placeName,travelRoute})',{AsyncStorage:{},weaponIcon:()=>'sword'});
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
console.log('Passed: the next chapter keeps the region (old places joined a few miles off, people with homes, ties, memories, fates and companions, the pack and the history), somewhere new keeps only companions and the pack, names are told apart, and heroes are set aside in the roster or remembered in the graveyard.');
