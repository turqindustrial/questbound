const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// A party at the shared table (partyRules.js): every player brings their own hero into one adventure. Each device sees
// the table with its own hero in the lead, and that change of view is never sent as a move; foes strike any standing
// hero; a hero who falls is dying and rolls on their own turn while the fight goes on for the others; a friend can be
// revived with a draught; a victory earns every living hero a level; saves accept a party; the Dungeon Master is told
// of the others but never speaks or acts for them.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','adventureRules.js','skillRules.js','storyRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','sequelRules.js','storyLog.js','partyRules.js','sharedTableSync.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext('Math.random=(()=>{let s=7;return ()=>(s=(s*16807)%2147483647)/2147483647;})();\n'+source+'\n({readyHero,hostileEncounterGame,newAdventure,adventureStep,validAdventure,adventureSnapshot,combatBasics,startParty,joinParty,partyView,settleParty,canonicalParty,partyMembers,partyVictory,soloFromParty,isPartyGame,pickFoeTarget,foeHitsPartyHero,partyTargets,dmChoices,dmContext,quickActions,validParty,createSharedTableSync})',{AsyncStorage:{}});
const plain=v=>JSON.parse(JSON.stringify(v));
const kara=r.readyHero('fighter'),ilyra=r.readyHero('wizard'),maxA=r.combatBasics(kara).hp,maxB=r.combatBasics(ilyra).hp;
const valid=(view,hero)=>r.validAdventure(plain(view),hero);
const seq=values=>{let i=0;return ()=>values[Math.min(i++,values.length-1)];};
(async()=>{
 // ---- Starting and joining ----
 const fight=r.hostileEncounterGame(kara,r.newAdventure(kara));assert.equal(fight.stage,'combat');
 const hosted=r.startParty(r.adventureSnapshot(kara,fight,{current:maxA,temp:0},true),'A','Sam');
 assert.ok(r.isPartyGame(hosted.game)&&valid(hosted,kara),'the host\'s table is a valid party of one');
 const joined=r.joinParty(hosted,'B',{character:JSON.stringify(ilyra),game:r.newAdventure(ilyra),health:null,name:'Jo'});
 const viewB=joined.snapshot;assert.ok(viewB,'Jo joins');assert.equal(viewB.game.party.lead,'B');assert.equal(JSON.parse(viewB.character).name,ilyra.name);
 assert.ok(valid(viewB,ilyra),'Jo\'s view is a valid save for Jo\'s hero');assert.equal(viewB.game.stage,'combat','Jo arrives in the fight the party is in');
 assert.equal(JSON.stringify(r.partyMembers(viewB.game).map(m=>[m.id,m.name,m.player,m.lead])),JSON.stringify([['A',kara.name,'Sam',false],['B',ilyra.name,'Jo',true]]));
 // The view turns without changing anything: Sam's device sees the same table with Kara in the lead.
 const viewA=r.partyView(viewB,'A');assert.equal(JSON.parse(viewA.character).name,kara.name);assert.equal(JSON.stringify(viewA.health),JSON.stringify({current:maxA,temp:0}));assert.ok(valid(viewA,kara));
 assert.equal(r.canonicalParty(viewA),r.canonicalParty(viewB),'every point of view settles to the same table');
 assert.equal(r.canonicalParty(r.partyView(viewA,'B')),r.canonicalParty(viewB));assert.equal(r.partyView(viewB,'C'),null,'a stranger is not in the party');
 assert.equal(r.joinParty(viewB,'B',{character:viewB.character,game:viewB.game,health:viewB.health,name:'Jo'}).snapshot.game.party.lead,'B','joining again changes nothing');
 // A fifth hero is turned away.
 let full=viewB;for(const id of ['C','D'])full=r.joinParty(full,id,{character:JSON.stringify(r.readyHero('rogue')),game:null,health:null,name:id}).snapshot;
 assert.match(r.joinParty(full,'E',{character:JSON.stringify(r.readyHero('cleric')),game:null,health:null,name:'E'}).error,/four heroes at most/);

 // ---- The sync: a change of view is not sent; a real change is ----
 const saved=[];let table={version:1,snapshot:viewB};
 const sync=r.createSharedTableSync({pollTable:async()=>({version:table.version,snapshot:table.snapshot,players:[]}),saveTable:async(snapshot,base)=>{saved.push(snapshot);table={version:base+1,snapshot};return {version:table.version,players:[]};},leaveTable:async()=>({}),applyRemote:async()=>{},canonical:r.canonicalParty});
 await sync.start(0);await sync.submit(viewA);assert.equal(saved.length,0,'Sam\'s device seeing the table from Kara does not write to it');
 const moved=r.partyView(viewB,'A');moved.game={...moved.game,potions:moved.game.potions+1};await sync.submit(moved);assert.equal(saved.length,1,'a real change is written');
 assert.ok(saved[0].version===1&&typeof saved[0].character==='string'&&saved[0].game?.party,'the snapshot itself is written, not the form it is compared by');

 // ---- Foes strike any standing hero ----
 assert.equal(JSON.stringify(r.partyTargets(viewB.game)),JSON.stringify(['A']));
 assert.equal(r.pickFoeTarget(viewB.game,()=>0.9),'party:A','the foe may go for Kara');assert.equal(r.pickFoeTarget(viewB.game,()=>0.2),null,'or for Jo\'s hero, in the lead');
 const solo=r.hostileEncounterGame(kara,r.newAdventure(kara));assert.equal(r.pickFoeTarget(solo,()=>0.9),null,'without a party nothing changes');
 const foe={name:'Bandit Cutthroat',attackBonus:4,die:6,count:1,bonus:2,type:'Slashing'};
 const low={...viewB.game,party:{...viewB.game.party,members:{...viewB.game.party.members,A:{...viewB.game.party.members.A,health:{current:2,temp:0}}}}};
 const struck=r.foeHitsPartyHero(low,foe,'Bandit Cutthroat','A','normal',seq([0.95,0.5]));
 const fallen=struck.game.party.members.A;assert.equal(fallen.status,'down');assert.equal(fallen.health.current,0);assert.ok(fallen.hero.dying&&fallen.hero.dying.fight,'Kara is dying, in a fight');
 assert.match(struck.lines.join(' '),new RegExp('Bandit Cutthroat attacks '+kara.name+': d20.*damage to '+kara.name+'\\. '+kara.name+' falls unconscious and is dying\\.'));
 const killed=r.foeHitsPartyHero(low,{...foe,die:12,count:4,bonus:40},'Brute','A','normal',seq([0.95,0.99]));assert.equal(killed.game.party.members.A.status,'dead','damage past 0 of her maximum kills her outright');

 // ---- A fallen hero rolls on their own turn; the fight goes on for the others ----
 const afterBlow={...viewB,game:struck.game};
 const downA=r.partyView(afterBlow,'A');assert.equal(downA.game.stage,'dying');assert.equal(JSON.stringify(downA.health),JSON.stringify({current:0,temp:0}));assert.ok(valid(downA,kara),'Kara\'s view while dying is a valid save');
 assert.equal(r.partyView(afterBlow,'B').game.stage,'combat','Jo fights on');
 assert.ok(r.dmChoices(ilyra,r.partyView(afterBlow,'B').game,viewB.health).some(c=>c.id==='give-potion:party:A'),'Jo is offered a draught for Kara');
 assert.ok(r.quickActions(ilyra,r.partyView(afterBlow,'B').game,viewB.health).some(c=>c.label==='Revive '+kara.name.split(' ')[0]),'as a Revive chip');
 const save=r.adventureStep(downA.game,downA.health,kara,'death-save',()=>0.6);assert.equal(save.game.stage,'dying');
 const afterSave={...downA,game:save.game,health:save.health};assert.equal(r.settleParty(afterSave).world.stage,'combat','a death save does not move the party');assert.equal(r.settleParty(afterSave).members.A.hero.dying.successes,1);
 assert.equal(r.partyView(afterSave,'B').game.stage,'combat');
 // Jo revives Kara with a draught (it costs Jo's turn).
 const viewB2=r.partyView(afterSave,'B');const revived=r.adventureStep(viewB2.game,viewB2.health,ilyra,{type:'give-potion',target:'party:A'},()=>0.5);
 assert.ok(!revived.error,revived.error);assert.equal(revived.game.potions,viewB2.game.potions-1);const back0=revived.game.party.members.A;assert.ok(back0.status==='up'||new RegExp('attacks '+kara.name).test((revived.events??[]).join(' ')),'revived (unless the foe struck her down again at once)');
 // Out of a fight the draught is all that happens.
 const calm=r.adventureStep({...viewB2.game,stage:'bridge'},viewB2.health,ilyra,{type:'give-potion',target:'party:A'},()=>0.5);assert.ok(!calm.error,calm.error);const back=calm.game.party.members.A;assert.equal(back.status,'up');assert.ok(back.health.current>0);assert.equal(back.hero.dying,undefined);
 assert.match((revived.events??revived.game.log).join(' '),new RegExp('opens their eyes'));
 const upA=r.partyView({...viewB2,game:{...calm.game,stage:'combat'},health:calm.health},'A');assert.equal(upA.game.stage,'combat');assert.ok(upA.health.current>0&&valid(upA,kara),'Kara is back in the fight');
 // The hero in the lead falls in the fight: the fight goes on for Kara.
 const leadFalls={...viewB2,health:{current:0,temp:0},game:{...viewB2.game,stage:'dying',dying:{successes:0,failures:0,place:'bridge',cause:'The Bandit',placeName:'The road',fight:true}}};
 const leadFallsUpA={...leadFalls,game:{...leadFalls.game,party:{...leadFalls.game.party,members:{...leadFalls.game.party.members,A:{...leadFalls.game.party.members.A,status:'up',health:{current:5,temp:0}}}}}};
 assert.equal(r.settleParty(leadFallsUpA).world.stage,'combat');assert.equal(r.partyView(leadFallsUpA,'A').game.stage,'combat');
 // Nobody standing: the foe leaves them where they fell.
 assert.equal(r.settleParty(leadFalls).world.stage,'bridge','the foe leaves when every hero is down');

 // ---- A victory earns every living hero a level ----
 const won=r.partyVictory({stage:'combat'},{...viewB.game,stage:'victory'});assert.equal(won.party.members.A.hero.levelsOwed,1);assert.equal(won.party.members.B.hero?.levelsOwed??0,0,'the hero in the lead levels as before');
 const deadWon=r.partyVictory({stage:'combat'},{...killed.game,stage:'victory'});assert.equal(deadWon.party.members.A.hero?.levelsOwed??0,0,'not the dead');

 // ---- Saves and leaving ----
 assert.equal(r.validParty({party:{lead:'X',members:{A:viewB.game.party.members.A}}}),false,'the lead must be in the party');
 assert.equal(r.validParty({party:{...viewB.game.party,members:{...viewB.game.party.members,A:{...viewB.game.party.members.A,status:'flying'}}}}),false);
 const tooMany={};for(const id of ['A','B','C','D','E'])tooMany[id]=viewB.game.party.members.A;assert.equal(r.validParty({party:{lead:'A',members:tooMany}}),false);
 const levelled={...viewB,game:{...viewB.game,encounterLevel:3}};assert.ok(valid(levelled,ilyra),'heroes of different levels share one fight');
 assert.equal(valid({...levelled,game:r.soloFromParty(levelled).game},ilyra),false,'alone, the old rule holds');
 assert.ok(valid({...levelled,game:r.soloFromParty(levelled,ilyra.level).game},ilyra),'leaving, the fight is set to the hero\'s own level');
 const alone=r.soloFromParty(viewB);assert.equal(alone.game.party,undefined);assert.ok(valid(alone,ilyra),'leaving: Jo\'s adventure goes on alone');

 // ---- The Dungeon Master is told of the others ----
 const told=r.dmContext(ilyra,r.partyView(afterBlow,'B').game,viewB.health);assert.equal(told.party.length,1);assert.equal(told.party[0].name,kara.name);assert.equal(told.party[0].condition,'down and dying');assert.equal(told.player.name,ilyra.name);
 assert.equal(r.dmContext(kara,solo,{current:maxA,temp:0}).party,undefined,'nothing without a party');
 const dm=fs.readFileSync(require.resolve('./dm-server.cjs'),'utf8');assert.ok(/PARTY: context\.party/.test(dm)&&/never speak, decide, move, attack, cast or act for them/.test(dm)&&dm.includes('narratorInstructions+partyInstructions+'),'the Dungeon Master never acts for another player\'s hero');
 console.log('Party: own heroes at one table, the same table from every point of view (a turned view is never sent), foes striking any standing hero, falling, death saves on one\'s own turn while the fight goes on, a draught to revive a friend, levels for every living hero, party saves and leaving, and a Dungeon Master who never acts for another player\'s hero.');
})().catch(e=>{console.error(e);process.exit(1);});
