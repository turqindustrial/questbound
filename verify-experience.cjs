const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Experience points (experienceRules.js): SRD 5.2 thresholds, awards as shares of the current level's gap, limits per
// tale, the Skirmish closed past level 2, every party member's own award, old saves read lazily, levels taken where
// the hero stands, and the pace (a seeded simulation of play).
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','subclassRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','lootRules.js','adventureRules.js','partyRules.js','skillRules.js','followerRules.js','experienceRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','worldArtRules.js','iconPaths.js','quickActions.js','pregens.js','storyLog.js','sequelRules.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^\s*import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,newAdventure,freshStoryGame,validAdventure,adventureSnapshot,levelUpReady,dmChoices,dmContext,commitDmTurn,adventureStep,dmCommand,worldPlaces,mapRegions,hostileEncounterGame,startWildFight,startParty,joinParty,partyView,settleParty,canonicalParty,validParty,carriedBase,withStoryLog,xpThresholds,xpForLevel,levelForXp,xpPace,xpAwards,xpTaleLimits,xpCap,heroXp,experienceView,fightEnding,experienceEvents,withExperience,validExperience,advancedInPlace,validNpcCombat})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const hero=r.readyHero('fighter'),hp=null,plain=v=>JSON.parse(JSON.stringify(v));
const person=(name,gender)=>({name,species:'Human',gender,role:'A resident of the refuge.',motive:'Wants the road safe.',appearance:'A weathered face under a wool hood, with a scar across one brow.',personality:'Plain-spoken and watchful.',regard:{stance:'curious',reason:'I have never met one of your kind.'},ties:{other:'friend',foe:'enemy',note:'They share the refuge.'}});
const written={id:'saga-1',status:'active',title:'The Seal Beneath the Snow',premise:'An heir is missing and a pretender marches.',opening:'A seal is pressed into your hand at the gate.',objective:'Find the heir and settle the succession.',resolution:'The truth of the succession is known and the war averted or faced.',secret:'The heir chose to vanish.',foe:'Kestrel of the Notch',foeSpecies:'Human',foeAppearance:'A lean swordsman in a grey cloak with a hawk mask.',foeDamageType:'Slashing',region:'Veyr',terrain:'mountains',
 layout:{bridge:{bearing:'N',miles:3},tower:{bearing:'E',miles:2,from:'inn'}},
 locations:{inn:{name:'Bellwether Refuge',description:'A pilgrim refuge under the pass.',kind:'settlement'},bridge:{name:'Redknife Notch',description:'A narrow cut in the ridge.',kind:'mountain'},tower:{name:'Shrine of Last Steps',description:'A shrine of worn stairs.',kind:'shrine'}},
 npcs:{keeper:person('Tamsin Rook','woman'),mara:person('Rusk Hale','man')},
 landmarks:['Three-Cairn Road','Sister Bell Shrine','Slate Widow Farm','Meltwater Ford','Hearthvale','Old Toll House','A Seventh Place'].map((name,i)=>({name,description:'A place on the old royal road, number '+(i+1)+'.',kind:'landmark',bearing:['N','E','S','W','NE','SW','SE'][i],miles:2+i,from:'inn',danger:i%2?'risky':'safe',feature:'A marker stone.'})),
 chapters:[
  {title:'A Seal at the Gate',goal:'Question the people of Bellwether Refuge and find a lead to the heir.',turn:'A receipt shows the forged itinerary was paid for from the queen\'s own household.'},
  {title:'The Pass That Remembers',goal:'Reach the Shrine of Last Steps and search its records.',turn:'The heir crossed the pass alive; a mark points to Orthell.'},
  {title:'A Road Beyond Veyr',goal:'Travel to the Orthell border and find who carried the heir\'s last message.',turn:'The heir chose to vanish, and a palace official feared her return.'},
  {title:'The Keeper of the Notch',goal:'Return to Veyr and deal with the guardian of Redknife Notch.',turn:'The guardian was hired to blame the pretender.'},
  {title:'Two Claims, One Crown',goal:'Bring the proof to the capital and face the queen.',turn:'The heir must choose.'}],
 leads:[{title:'The Copyist\'s Debt',hook:'Tamsin asks you to recover her brother\'s wages from the Slate Widow Farm.'},{title:'The Missing Muleteer',hook:'Rusk wants news of a friend last seen at Meltwater Ford.'},{title:'',hook:'nothing'}],
 lands:[{name:'Orthell Lowlands',terrain:'plains',bearing:'SW',miles:64,place:{name:'Pale Reed Ferry',description:'A ferry stage on a slow brown river.',kind:'water'},rumour:'A veiled noble paid for passage under a false name.'},{name:'Veyr',terrain:'coast',bearing:'E',miles:90,place:{name:'Nowhere',description:'The same country cannot be a far land.',kind:'ruin'},rumour:'x'},{name:'Coast of Namar',terrain:'coast',bearing:'E',miles:900,place:{name:'Saltglass Abbey',description:'An abbey of sea-green glass on a headland.',kind:'shrine'},rumour:'Letters of the first queen.'}]};
const fresh=()=>r.freshStoryGame(hero,JSON.parse(JSON.stringify(written)),r.newAdventure(hero));
const valid=(g,h=hero)=>r.validAdventure(r.adventureSnapshot(h,plain(g),hp,true),h);
const gap=L=>r.xpForLevel(L+1)-r.xpForLevel(L),worth=(share,L)=>Math.round(share*r.xpPace(L)*gap(L));
// One move as Adventure.act makes it: the engine's step, then the experience it earned.
const play=(g,h,action,random,who=hero)=>{const t=r.adventureStep(g,h,who,action,random);assert.ok(!t.error,t.error);const xp=r.withExperience(g,t.game,who,{action});return {...t,game:xp.game,xp};};
const attackUntilDone=(g,h,who=hero)=>{let gained=0;const lines=[];for(let i=0;i<30&&g.stage==='combat';i++){const c=r.dmChoices(who,g,h).find(c=>/^attack/.test(c.id))??r.dmChoices(who,g,h).find(c=>c.id==='end-turn');assert.ok(c,'an attack is offered');const t=play(g,h,c.action??c.id,()=>0.99,who);g=t.game;h=t.health;gained+=t.xp.gained;lines.push(...t.xp.lines);}return {game:g,health:h,gained,lines};};

// ---- The SRD 5.2 table ----
assert.deepEqual(plain(r.xpThresholds),[0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000]);
for(let L=1;L<=20;L++){assert.equal(r.levelForXp(r.xpForLevel(L)),L);if(L>1)assert.equal(r.levelForXp(r.xpForLevel(L)-1),L-1);}
assert.equal(r.levelForXp(999999),20);assert.equal(r.xpCap(1),899);assert.equal(r.xpCap(19),355000);assert.equal(r.xpCap(20),355000);

// ---- Old saves are read lazily ----
const g0=fresh();
assert.equal(r.heroXp(g0,hero),0,'a save without xp is at its level\'s threshold');
assert.equal(r.heroXp(g0,{...hero,level:3}),r.xpForLevel(3));
assert.equal(r.heroXp({...g0,levelsOwed:2},{...hero,level:3}),r.xpForLevel(5),'owed levels become experience');
assert.equal(r.heroXp({...g0,stage:'victory'},hero),r.xpForLevel(2),'an untaken old victory is one level');
assert.equal(r.heroXp({...g0,stage:'victory',xp:120},hero),120,'with xp set a victory gives nothing by itself');
assert.equal(r.heroXp({...g0,xp:2000,levelsOwed:1},{...hero,level:2}),2000,'xp and owed levels: the larger');
assert.equal(r.heroXp({...g0,xp:100,levelsOwed:2},{...hero,level:2}),r.xpForLevel(4));

// ---- A creature fight in the wilds ----
assert.equal(worth(r.xpAwards.creature,1),168,'a first fight is 168 experience at level 1');
const wildAt=(g,place,extra={})=>{g={...g,stage:'wild',world:{...g.world,places:r.worldPlaces(g).map(p=>p.id===place.id?{...p,...extra}:p),at:place.id},map:{...g.map,visited:[...new Set([...g.map.visited,place.id])]}};return {...r.startWildFight(g,hero,{template:'wolf',name:'Grey Wolf',appearance:'A lean grey wolf with a torn ear.'},{place:place.id,from:place.id}).game,enemyHP:1};};
let g=fresh();const spot=r.worldPlaces(g)[0];
let w=attackUntilDone(wildAt(g,spot),null);
assert.equal(w.game.stage,'wild');assert.equal(w.gained,168);assert.ok(w.lines.includes('Experience: +168 (Grey Wolf defeated).'),w.lines.join(' | '));
assert.equal(w.game.xp,168);assert.equal(w.game.xpTally.fights,1);assert.ok(valid(w.game));assert.equal(r.levelUpReady(w.game,hero),false,'one fight is not a level');
const second=attackUntilDone(wildAt(w.game,r.worldPlaces(w.game)[1]),null);
assert.equal(second.game.xp,336);assert.equal(r.levelUpReady(second.game,hero),true,'two fights reach level 2');assert.ok(second.lines.includes('You have earned a level. Take it when you are ready.'));
const ready=r.withStoryLog(w.game,second.game,hero,{});assert.ok(ready.storyLog.some(e=>e.kind==='level'&&e.text==='Ready for level 2.'));assert.ok(!ready.storyLog.some(e=>/Earned a level on the road/.test(e.text)));
// A lair is worth half again, a pack or a creature at its side a quarter more, the ninth fight of a tale a quarter.
const lair=attackUntilDone(wildAt(fresh(),spot,{danger:'lair'}),null);assert.equal(lair.gained,worth(r.xpAwards.creature*1.5,1));assert.equal(lair.gained,252);
const start=wildAt(fresh(),spot),won=r.adventureStep(start,null,hero,r.dmChoices(hero,start,null).find(c=>/^attack/.test(c.id)).id,()=>0.99);assert.ok(!won.error&&won.game.stage==='wild');
assert.equal(r.withExperience({...start,foeAllies:[{template:'wolf',name:'Second Wolf',hp:0,maximum:5}]},won.game,hero).gained,210,'a creature at its side');
assert.equal(r.withExperience({...start,xpTally:{tale:'saga-1',fights:8,places:0,leads:[]}},won.game,hero).gained,worth(r.xpAwards.creature*.25,1),'the ninth fight in a tale');
assert.equal(r.fightEnding(start,won.game).won,true);assert.equal(r.fightEnding(start,start).ended,false);

// ---- The Skirmish: practice, closed past level 2 ----
let sk=r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0);sk={...sk,enemyHP:1};
const skStart=sk,skWon=attackUntilDone(sk,null);assert.equal(skWon.game.stage,'victory');assert.equal(skWon.gained,168,'practice pays below level 3');
assert.equal(r.levelUpReady(skWon.game,hero),false,'a Skirmish win is no longer a level by itself');
const hero3={...hero,level:3},skBefore={...skStart,xp:r.xpForLevel(3)};const skLate=r.withExperience(skBefore,{...skWon.game,xp:r.xpForLevel(3)},hero3);
assert.equal(skLate.gained,0);assert.ok(skLate.lines.includes('A practice fight: no experience past level 2.'));assert.equal(r.levelUpReady(skLate.game,hero3),false,'farming is closed');
assert.equal(r.withExperience({...skStart,xp:r.xpForLevel(2)},{...skWon.game,xp:r.xpForLevel(2)},{...hero,level:2}).gained,worth(r.xpAwards.creature,2));

// ---- The tale's own foe: paid once ----
let boss={...fresh(),stage:'bridge'};boss=r.adventureStep(boss,null,hero,'approach',()=>0.99).game;boss={...boss,enemyHP:1};
const slain=attackUntilDone(boss,null);assert.equal(slain.game.stage,'victory');assert.equal(slain.gained,worth(r.xpAwards.boss,1));assert.equal(slain.game.xpTally.boss,true);
assert.equal(r.withExperience({...boss,xpTally:slain.game.xpTally},slain.game,hero).gained,0,'the main foe pays once a tale');

// ---- Chapters, leads, the tale's end ----
const say={question:'I lay the receipt on the table.',narration:'Tamsin goes pale.'};
g=fresh();let t=r.commitDmTurn(hero,g,hp,'story-advance',say,()=>.5);assert.ok(!t.error,t.error);
let x=r.withExperience(g,t.game,hero,{action:'story-advance'});assert.equal(x.gained,worth(r.xpAwards.chapter,1));assert.equal(x.lines[0],'Experience: +840 (Chapter 1 finished).');assert.equal(x.game.levelsOwed,undefined);
t=r.commitDmTurn(hero,g,hp,{type:'lead-done',id:'l1'},say,()=>.5);x=r.withExperience(g,t.game,hero);assert.equal(x.gained,worth(r.xpAwards.lead,1));assert.deepEqual(plain(x.game.xpTally.leads),['l1']);
// Unticked by hand and ticked again: nothing more.
const unticked={...x.game,story:{...x.game.story,leads:x.game.story.leads.map(l=>l.id==='l1'?{id:l.id,title:l.title,hook:l.hook}:l)}};const u=r.withExperience(x.game,unticked,hero);assert.equal(u.gained,0);
const reticked={...u.game,story:{...u.game.story,leads:u.game.story.leads.map(l=>l.id==='l1'?{...l,done:true}:l)}};assert.equal(r.withExperience(u.game,reticked,hero).gained,0,'a lead pays once');
const ending=r.withExperience({...g,xp:0},{...g,xp:0,story:{...g.story,status:'complete'}},hero);assert.equal(ending.gained,worth(r.xpAwards.tale,1));
assert.equal(r.withExperience({...g,xpTally:ending.game.xpTally},{...g,story:{...g.story,status:'complete'}},hero).gained,0,'the tale ends once');

// ---- Places and lands ----
g=fresh();const trip=r.adventureStep(g,null,hero,{type:'travel',destination:'bridge'},()=>.5);assert.ok(!trip.error,trip.error);
x=r.withExperience(g,trip.game,hero);assert.equal(x.gained,worth(r.xpAwards.place,1));assert.match(x.lines[0],/^Experience: \+36 \(Reached .+\)\.$/);
assert.equal(r.withExperience({...g,xpTally:{tale:'saga-1',fights:0,places:10,leads:[]}},trip.game,hero).gained,0,'ten places a tale');
const far=r.worldPlaces(g).find(p=>p.region&&p.region!=='home');assert.ok(far,'the tale has a far land');
x=r.withExperience(g,{...g,map:{...g.map,visited:[...g.map.visited,far.id]}},hero);assert.equal(x.gained,worth(r.xpAwards.place+r.xpAwards.land,1),'a new land');assert.ok(/First steps in /.test(x.lines[0]));

// ---- A brawl: only those already hostile are worth anything ----
const inn=r.newAdventure(hero),foeHp={current:12,temp:0};
const hostile={...inn,npcMemory:{keeper:{attitude:'hostile',response:'Wants you gone.',memories:[]}}};
const seq=values=>()=>values.length?values.shift():0.5;
const brawl=r.adventureStep(hostile,foeHp,hero,r.dmCommand(hero,hostile,'I attack the keeper with my greatsword',foeHp).action,seq([0,0,.9,.8,.8,.75]));assert.ok(!brawl.error,brawl.error);assert.equal(brawl.game.npcCombat.active,true);
assert.deepEqual(plain(brawl.game.npcCombat.worthy),['keeper'],'the hostile keeper is worthy, Mara is not');assert.ok(r.validNpcCombat(brawl.game));
assert.equal(r.validNpcCombat({...brawl.game,npcCombat:{...brawl.game.npcCombat,worthy:['n9']}}),false,'an unknown worthy id is refused');
const downAll=c=>Object.fromEntries(c.npcCombat.order.filter(n=>n.side==='enemy').map(n=>[n.id,0]));
assert.equal(r.withExperience(brawl.game,{...brawl.game,npcCombat:{...brawl.game.npcCombat,active:false},npcHP:{...brawl.game.npcHP,...downAll(brawl.game)}},hero).gained,worth(r.xpAwards.brawlFoe,1));
assert.equal(r.withExperience(brawl.game,{...brawl.game,npcCombat:{...brawl.game.npcCombat,active:false}},hero).gained,0,'surrender or flight pays nothing');
const friendly=r.adventureStep(inn,foeHp,hero,r.dmCommand(hero,inn,'I attack the keeper with my greatsword',foeHp).action,seq([0,0,.9,.8,.8,.75]));
assert.equal(friendly.game.npcCombat.worthy,undefined);
assert.equal(r.withExperience(friendly.game,{...friendly.game,npcCombat:{...friendly.game.npcCombat,active:false},npcHP:{...friendly.game.npcHP,...downAll(friendly.game)}},hero).gained,0,'beating up a friendly keeper teaches nothing');

// ---- Caps, level 20, the dead ----
g=fresh();t=r.commitDmTurn(hero,{...g,xp:800},hp,'story-advance',say,()=>.5);x=r.withExperience({...g,xp:800},t.game,hero);assert.equal(x.game.xp,899,'never two levels waiting');assert.ok(x.lines.includes('Take your waiting level to go on gaining experience.'));
x=r.withExperience({...g,xp:354000},{...t.game,xp:354000},{...hero,level:19});assert.equal(x.game.xp,355000);
const h20={...hero,level:20};x=r.withExperience({...g,xp:355000},{...t.game,xp:355000},h20);assert.equal(x.gained,0);assert.equal(x.lines.length,0);
assert.equal(r.withExperience(g,{...t.game,stage:'dead'},hero).gained,0,'the dead gain nothing');
// Nothing happened: nothing changes. A turn taken back starts from the experience it had then.
assert.equal(r.withExperience(g,g,hero).game,g);
x=r.withExperience({...g,xp:50},{...t.game,xp:50},hero);assert.equal(x.game.xp,50+840);
x=r.withExperience({...g,levelsOwed:1},{...g,levelsOwed:1,log:['A moment passes.',...g.log]},hero);assert.equal(x.game.levelsOwed,undefined);assert.equal(x.game.xp,r.xpForLevel(2),'owed levels are folded into experience');
x=r.withExperience({...g,stage:'victory'},{...g,stage:'victory',log:['A moment passes.',...g.log]},hero);assert.equal(x.game.xp,r.xpForLevel(2),'an old untaken victory is kept as experience');

// ---- Saves ----
assert.ok(valid({...g,xp:1234,xpTally:{tale:'saga-1',fights:3,places:2,leads:['l1'],boss:true}}));
for(const bad of [{xp:-1},{xp:1.5},{xp:400000},{xpTally:{tale:'',fights:0,places:0,leads:[]}},{xpTally:{tale:'x',fights:-1,places:0,leads:[]}},{xpTally:{tale:'x',fights:0,places:0,leads:['l9']}},{xpTally:{tale:'x',fights:0,places:0,leads:[],boss:false}},{xpTally:{tale:'x',fights:0,places:0,leads:[],extra:1}}])assert.equal(r.validExperience(bad),false,JSON.stringify(bad));
assert.equal(valid({...g,xp:-3}),false);assert.ok(valid({...g,levelsOwed:2}),'old owed levels still load');

// ---- Taking a level ----
const ripe={...fresh(),xp:400};assert.equal(r.levelUpReady(ripe,hero),true);
for(const [state,why] of [[{stage:'combat'},'in a fight'],[{stage:'dying'},'while dying'],[{npcCombat:{active:true}},'in a brawl'],[{pendingSpell:{id:'x'}},'with a spell waiting'],[{turnOrder:{order:[],at:0,round:1}},'in a party\'s turn order'],[{stage:'dungeon'},'in the vaults']])assert.equal(r.levelUpReady({...ripe,...state},hero),false,why);
assert.equal(r.levelUpReady({...ripe,stage:'victory'},hero),true,'at victory when the experience is there');assert.equal(r.levelUpReady({...ripe,xp:299,stage:'victory'},hero),false);
const taken=r.advancedInPlace({...ripe,levelsOwed:1,resources:{wind:0}},hero,{...hero,level:2});assert.equal(taken.levelsOwed,undefined);assert.equal(taken.xp,400);assert.equal(taken.encounterLevel,2);assert.equal(taken.resources,undefined);assert.equal(taken.stage,ripe.stage);
assert.equal(r.levelUpReady(taken,{...hero,level:2}),false,'the level is taken');

// ---- The screen's numbers ----
assert.deepEqual(plain(r.experienceView({...g,xp:600},hero)),{level:1,xp:600,floor:0,next:300,progress:1,ready:true,max:false});
assert.deepEqual(plain(r.experienceView({...g,xp:1800},{...hero,level:3})),{level:3,xp:1800,floor:900,next:2700,progress:.5,ready:false,max:false});
assert.equal(r.experienceView(g,h20).max,true);
// The Dungeon Master is told only that a level waits.
assert.equal(r.dmContext(hero,{...g,xp:400},hp).levelReady,true);assert.equal(r.dmContext(hero,g,hp).levelReady,undefined);assert.ok(!JSON.stringify(r.dmContext(hero,{...g,xp:400},hp)).includes('"xp"'),'no experience numbers');

// ---- Next tales carry experience; the tally starts again ----
const nextTale=r.freshStoryGame(hero,{...plain(written),id:'saga-2',title:'Another Tale'},r.newAdventure(hero,r.carriedBase({...g,xp:777,xpTally:{tale:'saga-1',fights:5,places:3,leads:[]}})));
assert.equal(nextTale.xp,777);assert.equal(r.experienceEvents(nextTale,nextTale,hero).tally.fights,0);

// ---- A party: everyone's own award, the chapter for all (it once reached only the device that moved it on) ----
const ilyra=r.readyHero('wizard');
const hosted=r.startParty(r.adventureSnapshot(hero,fresh(),null,true),'A','Sam');
const table=r.joinParty(hosted,'B',{character:JSON.stringify(ilyra),game:r.newAdventure(ilyra),health:null,name:'Jo'}).snapshot;
const viewA=r.partyView(table,'A');
t=r.commitDmTurn(hero,viewA.game,viewA.health,'story-advance',say,()=>.5);assert.ok(!t.error,t.error);x=r.withExperience(viewA.game,t.game,hero,{action:'story-advance'});
assert.equal(x.game.xp,840);assert.equal(x.game.party.members.B.hero.xp,840,'the chapter reaches every hero');assert.match(x.lines[0],/Every hero in the party gains experience too\.$/);
const settled={...viewA,game:x.game,health:t.health};assert.ok(r.validParty(x.game));
const viewB=r.partyView(settled,'B');assert.equal(viewB.game.xp,840);assert.equal(r.levelUpReady(viewB.game,ilyra),true,'Jo can take her level on her own device');
assert.equal(r.settleParty(settled).world.xp,undefined,'experience is each hero\'s own');
assert.equal(r.canonicalParty(settled),r.canonicalParty(r.partyView(settled,'B')),'the same table from either side');
// A party's fight with the tale's foe, won: both heroes gain, and taking a level keeps the party.
let pg={...viewA.game,stage:'bridge'};pg=r.adventureStep(pg,viewA.health,hero,'approach',()=>0.99).game;pg={...pg,enemyHP:1};
let ph=viewA.health,gainedA=0;const partyLines=[];
for(let i=0;i<40&&pg.stage==='combat';i++){const c=r.dmChoices(hero,pg,ph).find(c=>/^attack/.test(c.id))??r.dmChoices(hero,pg,ph).find(c=>c.id==='end-turn');if(!c)break;const s=r.adventureStep(pg,ph,hero,c.action??c.id,()=>0.99);if(s.error)break;const e=r.withExperience(pg,s.game,hero,{});partyLines.push(...e.lines);gainedA+=e.gained;pg=e.game;ph=s.health;}
assert.equal(pg.stage,'victory',partyLines.join(' | '));assert.ok(gainedA>0);assert.ok(pg.party.members.B.hero.xp>0,'Jo gains from the fight too');assert.equal(r.settleParty({...viewA,game:pg,health:ph}).world.xpTally.boss,true,'the tally belongs to the world');
const kept=r.advancedInPlace(pg,hero,{...hero,level:2});assert.ok(kept.party&&kept.party.members.B,'the table keeps its party');assert.equal(kept.encounterLevel,pg.encounterLevel);

// ---- The pace: a seeded simulation of play ----
for(let L=2;L<19;L++)assert.ok(r.xpPace(L+1)<=r.xpPace(L),'the pace never rises from level 2 on');
assert.equal(r.xpPace(20),0);
function simulate(seed,rates){
 let s=seed;const rnd=()=>(s=(s*16807)%2147483647)/2147483647,a=r.xpAwards,lim=r.xpTaleLimits;let xp=0,level=1,tally={fights:0,places:0,leads:0,boss:false};const at={};
 const gain=share=>{if(level>=20)return;const L=r.levelForXp(xp);if(L>=20)return;xp=Math.min(r.xpCap(level),xp+Math.round(share*r.xpPace(L)*gap(L)));};
 const fight=mul=>{gain(a.creature*mul*(tally.fights>=lim.fights?lim.lateFightMul:1));tally.fights++;};
 for(let m=1;m<=60*120&&level<20;m++){
  if(m===8||m===18)fight(1); // the errand's opening fights
  const p=x=>rnd()<x/60;
  if(p(rates.fight))fight(rnd()<.3?a.manyMul:1);
  if(p(rates.lair))fight(a.lairMul);
  if(p(rates.brawl)){gain(a.brawlFoe*(tally.fights>=lim.fights?lim.lateFightMul:1));tally.fights++;}
  if(p(rates.place)&&tally.places<lim.places){gain(a.place);tally.places++;}
  if(p(rates.land))gain(a.land);
  if(p(rates.lead)&&tally.leads<4){gain(a.lead);tally.leads++;}
  if(p(rates.chapter))gain(a.chapter);
  if(p(rates.tale)){if(!tally.boss)gain(a.boss);gain(a.tale);tally={fights:0,places:0,leads:0,boss:false};}
  while(r.levelForXp(xp)>level){level++;at[level]=m;}
 }
 return at;
}
// Per hour: 1.3 fights, 0.2 lairs, 0.2 brawls, 2.5 places, 0.8 leads, a chapter, and a tale ended every 4.5 hours.
const runs=600,times={};for(let i=0;i<runs;i++){const at=simulate(1+i*7919,{fight:1.3,lair:.2,brawl:.2,place:2.5,land:.05,lead:.8,chapter:1,tale:.22});for(const L in at)(times[L]??=[]).push(at[L]/60);}
const median=L=>{const v=[...(times[L]??[])].sort((a,b)=>a-b);return v.length<runs/2?Infinity:v[Math.floor(runs/2)];};
const bands={2:[.1,.35],3:[.4,.9],4:[1.2,1.9],5:[2.5,3.6],10:[12,16.5],15:[24,32],20:[39,51]};
for(const [L,[lo,hi]] of Object.entries(bands)){const m=median(L);assert.ok(m>=lo&&m<=hi,'level '+L+' at '+m.toFixed(2)+' h, wanted '+lo+' to '+hi);}
for(let L=4;L<=10;L++){const step=median(L)-median(L-1);assert.ok(step>=.8&&step<=3.5,'level '+L+' takes '+step.toFixed(2)+' h');}

console.log('Experience: SRD 5.2 thresholds; old saves read lazily (owed levels, an untaken victory); creature fights, lairs, packs and the ninth fight; the Skirmish closed past level 2; the main foe, chapters, leads and the tale paid once; places (ten a tale) and new lands; brawls only for the hostile; caps, level 20 and the dead; saves; levels taken where the hero stands (party kept); the Dungeon Master told only that a level waits; parties paid each their own; pace medians '+Object.keys(bands).map(L=>'L'+L+' '+median(L).toFixed(1)+' h').join(', ')+'.');

// ---- The Dungeon Master's standing instructions and request (a fake provider; nothing is sent) ----
(async()=>{
 const server=require(process.env.QB_DM??'./dm-server.cjs');
 assert.ok(server.questInstructions.includes('EXPERIENCE AND LEVELS: the game keeps the hero\'s experience itself'),'the standing instruction');
 assert.ok(server.questInstructions.includes('context.levelReady means the hero has earned a level not yet taken'));assert.ok(!server.questInstructions.includes('levelEarned'));
 const blank={narration:'The road is quiet.',dialogue:[],recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null};
 let request=null;const fetchImpl=async(url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',usage:{input_tokens:100,output_tokens:10},output:[{content:[{type:'output_text',text:JSON.stringify(blank)}]}]})};};
 const ripeGame={...fresh(),xp:400},body={input:'I rest a moment by the road.',context:{...r.dmContext(hero,ripeGame,hp),storyPreferences:{brutality:'gritty'},conversationWith:null,conversationParticipants:[]}};
 const reply=await server.generate(body,{apiKey:'k',model:'gpt-6-luna',fetchImpl});assert.equal(reply.narration,'The road is quiet.');
 const sent=JSON.stringify(request.input);assert.ok(sent.includes('levelReady'),'the model is told a level waits');assert.ok(!/"xp"|xpTally|levelsOwed/.test(sent),'and never the numbers');
 assert.ok(request.instructions.includes('EXPERIENCE AND LEVELS'));
})().catch(error=>{console.error(error);process.exitCode=1;});
