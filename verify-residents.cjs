const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// A tale's people: besides keeper and mara, a written tale names residents who live in its country (two at the
// starting place, so the opening is never two people alone; others where the tale puts them). They are seated in
// game.people, met when the hero first reaches where they live, carried into the next tale, and an Easy to get into
// tale begins with an errand whose place is a lair on the map. People caps: 24 in a region, 4 at a place.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','adventureRules.js','partyRules.js','skillRules.js','storyRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','sequelRules.js','storyLog.js','playbackRules.js','sceneTriggers.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,newAdventure,adventureStep,commitDmTurn,validAdventure,adventureSnapshot,freshStoryGame,joinRegion,carriedBase,npcScene,metPerson,seatResidents,validStory,validPeople,introducePerson,canMeetPeople,isPersonId,maxPeople,maxPeopleHere,maxResidents,dmContext,storyEvents,withStoryLog,sceneTrigger,validMarks,startParty,joinParty,partyView,canonicalParty,conversationPeople})',{AsyncStorage:{}});
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const kara=r.readyHero('fighter'),hp={current:12,temp:0};
const valid=(g,h=hp,hero=kara)=>r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(g)),h,true),hero);
const step=(g,action,random=()=>0.5)=>{const s=r.adventureStep(g,hp,kara,action,random);assert.equal(s.error,undefined,JSON.stringify(action)+': '+s.error);return {...s,game:r.withStoryLog(g,s.game,kara,{action})};};
const person=(name,at,extra={})=>({name,species:'Human',gender:'woman',role:'A '+name.toLowerCase()+' of the vale.',appearance:'A weathered figure in a patched grey cloak, carrying '+name+'\'s tools.',personality:'Quiet and watchful.',motive:'Keep the vale fed.',toughness:'common',attitude:'indifferent',at,foe:'neutral',tie:null,regard:{stance:'indifferent',reason:'Folk are folk.'},...extra});
const written={id:'reeds-1',title:'The Reed Crown',premise:'A drowned barrow wakes under the reeds.',opening:'The reeve hands you a sealed order at the market cross.',objective:'Learn who woke the barrow.',resolution:'Lay the barrow to rest or bargain with what sleeps there.',secret:'The reeve opened the barrow for its silver.',foe:'Barrow warden',status:'active',
 locations:{inn:{name:'Stillwater Market',description:'A crowded market on stilts above the reeds.',kind:'settlement'},bridge:{name:'The Drowned Barrow',description:'A mound half sunk in black water.',kind:'ruin'},tower:{name:'Saltmarsh Chapel',description:'A leaning chapel where the old records are kept.',kind:'shrine'}},
 npcs:{keeper:{name:'Reeve Ormund',role:'The reeve of Stillwater, who gives orders here.',motive:'Keep his office.',appearance:'A heavy man in a fur-trimmed robe with a chain of office.',personality:'Brisk and impatient.',ties:{other:'acquaintance',foe:'neutral',note:'n'}},mara:{name:'Wren Halloway',role:'A barge guide.',motive:'Find her lost brother.',appearance:'A lean young woman with a pole on her shoulder and a red scarf.',personality:'Blunt, warm underneath.',ties:{other:'rival',foe:'enemy',note:'n'}}},
 landmarks:[{name:'Old Weir Camp',description:'A reed camp by a broken weir where smoke rises at night.',kind:'camp',bearing:'E',miles:1.5,danger:'risky'},{name:'Heron Mill',description:'A mill whose wheel still turns in the slow water.',kind:'settlement',bearing:'N',miles:2},{name:'Lantern Ferry',description:'A ferry landing lit by green lamps across the marsh.',kind:'water',bearing:'W',miles:2.5}],
 residents:[
  person('Tilda Marsh','inn',{tie:{to:'Reeve Ormund',kind:'rival'},regard:{stance:'scornful',reason:'Your sort cheated my father at the toll.'}}),
  person('Brom Ashby','Stillwater Market',{gender:'man',toughness:'tough',attitude:'friendly',tie:{to:'Tilda Marsh',kind:'family'}}),
  person('Third Stallholder','inn'),                       // the starting place already has two
  person('Brother Anselm','tower',{gender:'man'}),
  person('Mother Reed','Heron Mill',{toughness:'frail'}),
  person('Cass Fenwick','lantern ferry',{tie:{to:'mara',kind:'beloved'}}),
  person('Lost Soul','The Sunken Spire'),                  // no such place: the starting place, which is full
  person('wren halloway','inn'),                           // the name of someone the tale already has
  person('X','inn'),                                       // too short a name
  {name:'Not a person'},
 ],
 errand:{title:'Clear the weir',task:'Drive the reavers out of Old Weir Camp.',place:'Old Weir Camp',reward:'Forty gold pieces from the reeve.',threat:{template:'bandit',name:'Weir Reavers',appearance:'Mud-streaked raiders in stolen fishing leathers with hooked spears.',ally:{template:'wolf',name:'Marsh Hound',appearance:'A lean grey hound with reed burrs in its coat.'}}},
 openingDialogue:[{speakerId:'keeper',text:'You have your orders. The weir by sundown.'},{speakerId:'resident2',text:'Bring my brother\'s knife back if you find it.'},{speakerId:'resident4',text:'(not here)'},{speakerId:'resident3',text:'(refused)'},{speakerId:'mara',text:'I can pole you there in an hour.'}],
 chapters:[{title:'The weir',goal:'Clear Old Weir Camp and report to Reeve Ormund for your reward.',turn:'A letter on the reaver chief names the reeve.'},{title:'The barrow',goal:'Go to the barrow.',turn:'The warden wakes.'}]};
let game=r.freshStoryGame(kara,written,r.newAdventure(kara));
// ---- Residents seated where they live ----
const people=game.people,byName=Object.fromEntries(Object.entries(people).map(([id,p])=>[p.name,{id,...p}]));
same(Object.keys(people),['n1','n2','n3','n4','n5'],'five residents seated, numbered from n1');
assert.equal(byName['Tilda Marsh'].home,'inn');assert.equal(byName['Brom Ashby'].home,'inn','a starting place named by its name');
assert.equal(byName['Brother Anselm'].home,'tower');assert.equal(byName['Mother Reed'].home,'p2','a landmark by its exact name');assert.equal(byName['Cass Fenwick'].home,'p3','names are matched without regard to case');
for(const name of ['Third Stallholder','Lost Soul','wren halloway','X'])assert.equal(byName[name],undefined,name+' is left out');
assert.ok(Object.values(people).every(p=>p.resident===true&&p.motive==='Keep the vale fed.'),'residents are marked and keep what they want');
same(byName['Tilda Marsh'].tie,{to:'keeper',kind:'rival'},'a tie to keeper by name');same(byName['Brom Ashby'].tie,{to:'n1',kind:'family'},'a tie to another resident by name');same(byName['Cass Fenwick'].tie,{to:'mara',kind:'beloved'},'a tie by id');
assert.equal(byName['Brom Ashby'].toughness,'tough');assert.equal(game.npcMemory.n2.attitude,'friendly','a written attitude');
assert.equal(game.npcMemory.n1.attitude,'unfriendly','a scornful view of the hero\'s kind makes a cold first impression');assert.equal(byName['Tilda Marsh'].regard.stance,'scornful');
assert.equal(byName['Brother Anselm'].regard,undefined,'an indifferent view is worked out by the game');
assert.equal(game.story.residents,undefined,'the written list is not kept in the story');
assert.ok(valid(game),'a tale with residents saves');assert.ok(r.validPeople(game));
// ---- The opening: more than two people, and residents speak in it ----
const opening=r.npcScene(game).filter(n=>n.present).map(n=>n.id);
same(opening,['keeper','mara','n1','n2'],'the opening scene has four people in it');
same(game.story.openingDialogue.map(l=>l.speakerId),['keeper','n2','mara'],'resident lines go to the right people; anyone not at the start is dropped');
same(game.playback[0].participants,['keeper','mara','n1','n2']);assert.equal(game.playback[0].events[2].speakerName,'Brom Ashby');
assert.ok(r.validStory(game.story));assert.ok(!r.validStory({...game.story,openingDialogue:[{speakerId:'n25',text:'x'}]}));
const ctx=r.dmContext(kara,game,hp);
assert.equal(ctx.world.peopleHere,4,'the Dungeon Master is told how many named people are here');
same(ctx.nearbyNPCs.map(n=>n.name),['Reeve Ormund','Wren Halloway','Tilda Marsh','Brom Ashby']);
const anselm=ctx.npcSocialState.find(n=>n.id==='n3');assert.equal(anselm.metHero,false);assert.equal(anselm.livesAt,'Saltmarsh Chapel');assert.equal(ctx.npcSocialState.find(n=>n.id==='n1').metHero,true);
assert.equal(JSON.stringify(ctx.story).includes('residents'),false);
// ---- Met on reaching where they live ----
assert.equal(r.metPerson(game,'n3'),false);assert.equal(r.metPerson(game,'n1'),true,'people at the start are met at once');assert.equal(r.metPerson(game,'keeper'),true);
let chapel=step(game,{type:'travel',destination:'tower'});
assert.equal(r.metPerson(chapel.game,'n3'),true,'met on arrival');assert.ok(chapel.game.storyLog.some(l=>l.text==='Met Brother Anselm, a brother anselm of the vale.'),'the Log says so');
const back=step(chapel.game,{type:'travel',destination:'inn'}),again=step(back.game,{type:'travel',destination:'tower'});
assert.equal(again.game.storyLog.filter(l=>/^Met Brother Anselm/.test(l.text)).length,1,'once, not on every return');
assert.ok(valid(again.game));
// A resident greets a newcomer on arrival before the companions do.
const arrival=r.sceneTrigger(back.game,{...step(back.game,{type:'travel',destination:'p2'}).game,firedTriggers:[]},{type:'travel'});
assert.ok(arrival,'a scene cue on arrival');assert.equal(arrival.speakerId,'n4','Mother Reed speaks first at her mill');
// ---- The errand: its place is a lair held by the creature the hero was sent against ----
const weir=game.world.places.find(p=>p.name==='Old Weir Camp');
assert.equal(weir.danger,'lair');assert.equal(weir.threat.template,'bandit');assert.equal(weir.threat.name,'Weir Reavers');assert.equal(weir.threat.ally,undefined,'no second creature for a first-level hero');
same(game.story.errand,{title:'Clear the weir',task:'Drive the reavers out of Old Weir Camp.',place:weir.id,reward:'Forty gold pieces from the reeve.'});
assert.ok(game.journal.entries[0].text.includes('Your orders: Drive the reavers out of Old Weir Camp.'));
assert.equal(r.dmContext(kara,game,hp).story.errand.place,weir.id,'the Dungeon Master knows the errand');
const raid=step(game,{type:'travel',destination:weir.id});
assert.ok(raid.game.wildFight,'travelling there starts the fight');assert.equal(raid.game.stage,'combat');assert.ok(valid(raid.game,raid.health??hp));
// Stronger heroes may face a pair; a pack or an orc becomes a lighter creature for a new hero.
const veteran={...r.readyHero('fighter'),level:3};
const vgame=r.freshStoryGame(veteran,{...written,id:'reeds-2',errand:{...written.errand,threat:{...written.errand.threat,template:'wolves'}}},r.newAdventure(veteran));
const vweir=vgame.world.places.find(p=>p.name==='Old Weir Camp');assert.equal(vweir.threat.template,'wolves');assert.equal(vweir.threat.ally,undefined,'never a creature of the same kind at its side');
const paired=r.freshStoryGame(veteran,{...written,id:'reeds-7'},r.newAdventure(veteran)).world.places.find(p=>p.name==='Old Weir Camp');assert.equal(paired.threat.ally.template,'wolf','a second creature for a seasoned hero');
assert.equal(r.freshStoryGame(kara,{...written,id:'reeds-3',errand:{...written.errand,threat:{...written.errand.threat,template:'orc'}}},r.newAdventure(kara)).world.places.find(p=>p.name==='Old Weir Camp').threat.template,'goblin');
// A misnamed errand place falls back to the first risky landmark; an errand with no usable creature is dropped.
const misnamed=r.freshStoryGame(kara,{...written,id:'reeds-4',errand:{...written.errand,place:'Weir of Sorrows'},landmarks:[written.landmarks[1],written.landmarks[0]]},r.newAdventure(kara));
assert.equal(misnamed.story.errand.place,'p2');assert.equal(misnamed.world.places.find(p=>p.id==='p2').danger,'lair');
const plain=r.freshStoryGame(kara,{...written,id:'reeds-5',errand:{...written.errand,threat:{template:'dragon',name:'x',appearance:'y'}}},r.newAdventure(kara));
assert.equal(plain.story.errand,undefined);assert.ok(plain.world.places.every(p=>p.danger!=='lair'));
// A tale without residents, errand or opening lines (an older story writer) starts as before.
const {residents,errand,openingDialogue,...older}=written;const old=r.freshStoryGame(kara,{...older,id:'reeds-6'},r.newAdventure(kara));
assert.equal(old.people,undefined);assert.equal(old.playback,undefined);assert.ok(valid(old));
// ---- Caps: 24 people in a region, 4 at a place; ids n1…n24 ----
assert.equal(r.maxPeople,24);assert.equal(r.maxPeopleHere,4);assert.equal(r.maxResidents,8);
assert.ok(r.isPersonId('n13')&&r.isPersonId('n24')&&!r.isPersonId('n25')&&!r.isPersonId('n0'));
const many={...game,people:{...game.people}};for(let i=6;i<=24;i++)many.people['n'+i]={...game.people.n3,name:'Villager '+i,home:'p1'};
assert.ok(r.validPeople(many),'twenty-four people');assert.ok(!r.validPeople({...many,people:{...many.people,n25:{...game.people.n3,name:'One Too Many'}}}),'never a twenty-fifth');
assert.ok(r.validMarks({marks:{n15:{prone:true}}})&&!r.validMarks({marks:{n25:{prone:true}}}),'marks on people up to n24');
assert.ok(valid({...game,playback:[{id:2,npcId:'n20',participants:['n20'],events:[{kind:'dialogue',speakerId:'n20',speakerName:'Brom Ashby',text:'Hello.'}]}],people:{...game.people,n20:{...game.people.n2,name:'Someone Twenty'}}}),'a speaker n20 is accepted in saves');
// Four people may live at one place: a third and fourth may still be met at the market, not a fifth.
let market=game;
for(const name of ['Pell Rush','Ada Weir']){assert.ok(r.canMeetPeople(market),name);const met=r.introducePerson(market,{...person(name,'inn'),attitude:'indifferent',tie:null},kara);assert.equal(met.error,undefined);market=met.game;}
assert.equal(r.canMeetPeople(market),false,'four live here');
// Introducing a resident by name moves them to where the hero is, never makes a second one.
const named=r.introducePerson(game,{...person('Mother Reed','inn'),tie:null},kara);assert.equal(named.id,'n4');assert.equal(named.game.people.n4.home,'inn');assert.equal(Object.keys(named.game.people).length,5);assert.ok(r.metPerson(named.game,'n4'));
// ---- The next tale in the region keeps its own residents; earlier people follow them ----
const earlier={...again.game,npcMemory:{...again.game.npcMemory,n3:{attitude:'friendly',response:'x',memories:['The player rang the chapel bell for me.']}}};
const nextWritten={...written,id:'reeds-next',title:'The Salt Road',errand:undefined,landmarks:[],residents:[person('Gil Saltby','inn',{regard:{stance:'wary',reason:'Strangers bring trouble.'},attitude:'unfriendly'}),person('Nan Ferris','inn')],npcs:{keeper:{...written.npcs.keeper,name:'Captain Hale'},mara:{...written.npcs.mara,name:'Ora Vell'}},locations:{inn:{name:'Salt Gate',description:'A toll gate on the salt road.'},bridge:{name:'Salt Caves',description:'Caves where the salt is cut.'},tower:{name:'Toll House',description:'Where the tolls are counted.'}}};
const next=r.freshStoryGame(kara,nextWritten,r.newAdventure(kara,r.carriedBase(earlier)));
same(Object.keys(next.people),['n1','n2']);
const joined=r.joinRegion(next,earlier,{sameRegion:true,bearing:'S',miles:4});
assert.equal(joined.people.n1.name,'Gil Saltby','the new residents keep their ids');assert.equal(joined.people.n2.name,'Nan Ferris');
assert.equal(joined.npcMemory.n1.attitude,'unfriendly','and their own first impressions');
const anselmNow=Object.entries(joined.people).find(([,p])=>p.name==='Brother Anselm');assert.ok(anselmNow&&Number(anselmNow[0].slice(1))>2,'earlier people are numbered after them');
assert.ok(joined.npcMemory[anselmNow[0]].memories.includes('The player rang the chapel bell for me.'),'their memories follow them');
assert.ok(!joined.npcMemory.n1.memories.some(m=>/chapel bell/.test(m)),'no memory crosses to the wrong person');
assert.ok(Object.keys(joined.people).length<=r.maxPeople);assert.ok(valid(joined));
// ---- A shared table: residents are shared world, the same from every point of view ----
const ilyra=r.readyHero('wizard');
const hosted=r.startParty(r.adventureSnapshot(kara,game,hp,true),'A','Sam');
const both=r.joinParty(hosted,'B',{character:JSON.stringify(ilyra),game:r.newAdventure(ilyra),health:null,name:'Jo'}).snapshot;
const viewB=r.partyView(both,'B');
assert.equal(JSON.stringify(viewB.game.people),JSON.stringify(game.people),'every hero sees the same people');
assert.equal(JSON.stringify(r.canonicalParty(both)),JSON.stringify(r.canonicalParty(viewB)));
assert.ok(r.validAdventure(viewB,ilyra),'the party save is valid with residents');
// ---- The Dungeon Master: people elsewhere told in brief, residents and peopleHere explained, ids up to n24 ----
const server=require('./dm-server.cjs');
const told=server.sceneFor({input:'I look around.',context:JSON.parse(JSON.stringify(ctx))},{}).context;
const away=told.npcSocialState.find(n=>n.id==='n3'),near=told.npcSocialState.find(n=>n.id==='n1');
same(Object.keys(away).sort(),['attitude','bond','fate','grudge','id','livesAt','memories','metHero','name','role','ties'].sort(),'someone elsewhere is told in brief');
assert.ok(near.present&&near.regardsYourKind!==undefined,'someone here is told in full');
const brief=server.sceneFor({input:'x',context:{npcSocialState:[{id:'n5',name:'Cass',present:false,memories:['a','b','c','d'],appearance:'long'}]}},{}).context.npcSocialState[0];same(brief.memories,['c','d']);assert.equal(brief.appearance,undefined);
(async()=>{
 let sent=null;const fake=reply=>async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({narration:'Brom nods.',dialogue:[{speakerId:'n20',text:'Welcome back.'}],recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,check:null,discovery:null,ambush:null,...reply})}]}]})};};
 const social=[{id:'keeper',name:'Reeve Ormund',present:true},{id:'n20',name:'Brom Ashby',present:true}];
 const out=await server.generate({input:'I greet Brom.',context:{choices:[],story:{foe:'Barrow warden'},npcSocialState:social,conversationParticipants:[{id:'n20',name:'Brom Ashby'}],nearbyNPCs:[{id:'n20',name:'Brom Ashby'}],world:{canIntroduce:true,peopleHere:2}}},{apiKey:'test-only',model:'test-model',fetchImpl:fake({})});
 assert.equal(out.dialogue?.[0]?.speakerId,'n20','a person n20 may speak');
 assert.ok(sent.instructions.includes('metHero')&&sent.instructions.includes('peopleHere')&&sent.instructions.includes('PEOPLE ANYWHERE: places are lived in'),'the Dungeon Master names people when scenes call for them');
 assert.ok(sent.instructions.includes('ERRAND: context.story.errand'),'and keeps an errand tale about its errand');
 assert.match(sent.input,/Named people here: Brom Ashby./,'the plain account of the present names who is here');
 console.log('Residents: a tale\'s people seated where they live (two at the start, never more than two a place, ties by name), met on reaching their homes (in the Log once), speaking in the opening, kept by the next tale with earlier people numbered after them, shared at the table; Easy to get into\'s errand as a lair; 24 people a region and 4 a place.');
})().catch(e=>{console.error(e);process.exit(1);});
