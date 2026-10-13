// Companions with classes, offers to come along, allies, orders to wait / follow / send for, rests that revive,
// Class shown only for trained people, and the Dungeon Master's side of it (recruitment offers and classes, introduce
// classes, ally and parts, the second look at a join the telling made up). Everything runs through the real code
// paths: adventureStep, commitDmTurn, dmCommand, dmChoices/quickActions and dm-server's generate with a fake provider.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');process.chdir(__dirname);
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','memoryRules.js','spellOptions.js','equipmentRules.js','characterRules.js','subclassRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','lootRules.js','adventureRules.js','partyRules.js','skillRules.js','followerRules.js','experienceRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','worldArtRules.js','iconPaths.js','quickActions.js','pregens.js','sequelRules.js','storyLog.js','entityRules.js','sceneTriggers.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^\s*import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,newAdventure,adventureStep,commitDmTurn,validAdventure,adventureSnapshot,freshStoryGame,joinRegion,npcScene,npcProfile,dmChoices,quickActions,dmCommand,recruitmentTargets,resolveRecruitment,acceptOffer,manageFollower,levelCompanions,withCompanionClasses,companionGroups,followerPlace,isAlly,isCompanion,classFromRole,classedStats,npcClassList,validNpcState,companionsAttack,companionAttack,fightingCompanions,npcCombatParticipants,encounterEntities,startParty,joinParty,partyView,canonicalParty,placeName,dmContext,withStoryLog,hostileEncounterGame,mapLocation})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const kara=r.readyHero('fighter'),hp={current:12,temp:0};
const valid=(g,h=hp,hero=kara)=>r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(g)),h,true),hero);
const step=(g,action,random=()=>0.5,hero=kara)=>{const s=r.adventureStep(g,hp,hero,action,random);assert.equal(s.error,undefined,JSON.stringify(action)+': '+s.error);return {...s,game:r.withStoryLog(g,s.game,hero,{action})};};
const person=(name,at,extra={})=>({name,species:'Human',gender:'man',role:'A '+name.toLowerCase()+' of the vale.',appearance:'A weathered figure in a patched grey cloak, carrying '+name+'\'s tools.',personality:'Quiet and watchful.',motive:'Keep the vale fed.',toughness:'common',attitude:'indifferent',at,foe:'neutral',tie:null,regard:{stance:'indifferent',reason:'Folk are folk.'},...extra});
const written={id:'fens-1',title:'The Fen Lights',premise:'Lights drown travellers in the fen.',opening:'The reeve meets you at the causeway.',objective:'Find what lights the fen.',resolution:'Put out the lights.',secret:'The reeve lit them.',foe:'Fen Warden',status:'active',
 locations:{inn:{name:'Causeway Hall',description:'A hall on stilts above the fen.',kind:'settlement'},bridge:{name:'The Drowned Steps',description:'Stone steps into black water.',kind:'ruin'},tower:{name:'Heron Chapel',description:'A leaning chapel.',kind:'shrine'}},
 npcs:{keeper:{name:'Reeve Ormund',role:'The reeve of the causeway, who keeps the hall.',motive:'Keep his office.',appearance:'A heavy man in a fur-trimmed robe with a chain of office.',personality:'Brisk.',class:null,ties:{other:'acquaintance',foe:'neutral',note:'n'}},mara:{name:'Wren Halloway',role:'A village hunter who knows the fen paths.',motive:'Find her lost brother.',appearance:'A lean young woman with a bow on her shoulder and a red scarf.',personality:'Blunt, warm underneath.',gender:'woman',class:null,ties:{other:'rival',foe:'enemy',note:'n'}}},
 landmarks:[{name:'Old Weir Camp',description:'A reed camp by a broken weir.',kind:'camp',bearing:'E',miles:1.5},{name:'Heron Mill',description:'A mill whose wheel still turns.',kind:'settlement',bearing:'N',miles:2}],
 residents:[person('Tobin Reed','inn',{role:'A sellsword resting between contracts.',toughness:'tough'}),person('Sister Maud','inn',{gender:'woman',role:'A temple priest of the fen chapel.',class:'Cleric'}),person('Old Cobb','Heron Mill',{role:'The miller.'})]};
let game=r.freshStoryGame(kara,written,r.newAdventure(kara));
const id=name=>Object.keys(game.people).find(k=>game.people[k].name===name),tobin=id('Tobin Reed'),maud=id('Sister Maud'),cobb=id('Old Cobb');
assert.ok(tobin&&maud&&cobb,'the residents are seated');
// ---- A trained resident has a class from the start; ordinary folk do not ----
same(game.npcClasses,{[maud]:{class:'Cleric',level:1}},'only the trained priest has a class');
assert.equal(r.npcProfile(game,maud).maximumHP,r.classedStats('Cleric',1).maximumHP);
assert.ok(valid(game));
// ---- 1. Invitations are recognised in many phrasings; questions about the game are not ----
for(const q of ["Why don't you come with me, Wren?",'How about you join us, Wren?','Wren, would you help me find the chapel?',"Wren, let's go together.",'Wren, will you lead the way?','Will you fight with me, Wren?','If you come with me, Wren, I will pay you.','Wren, will you join me?','Wren, follow me.','Wren, come with me.'])
 same(r.recruitmentTargets(game,q),['mara'],q);
for(const q of ['How do followers work?',"What is Wren's job?",'Wren, can you help me with this lock?'])same(r.recruitmentTargets(game,q),[],q);
// ---- 2. Joining writes a class: the Dungeon Master's, else one from the person's role ----
const question='Wren, will you come with me?',plan=(npcId,extra={})=>({npcId,decision:'join',reason:'She wants to find her brother.',terms:'Help her search the fen.',dc:null,class:null,...extra});
let joined=r.commitDmTurn(kara,game,hp,{type:'recruitment',plans:[plan('mara')]},{question,narration:'She shoulders her bow.',npcId:'mara'});
assert.equal(joined.error,undefined,joined.error);
same(joined.game.npcClasses.mara,{class:'Ranger',level:1},'a village hunter fights as a Ranger, a level below the hero (at least 1)');
assert.match(joined.events[0],/^Wren Halloway joins your adventure as a level 1 Ranger\./);
assert.equal(r.npcProfile(joined.game,'mara').maximumHP,r.classedStats('Ranger',1).maximumHP);assert.equal(r.npcProfile(joined.game,'mara').ac,15);
same(r.npcProfile(joined.game,'mara').trainedAs,{class:'Ranger',level:1});
assert.ok(valid(joined.game),'a classed companion saves');
const veteran={...kara,level:6};
const told=r.resolveRecruitment(veteran,game,hp,[plan('mara',{class:'Rogue'})],question,'mara');
same(told.game.npcClasses.mara,{class:'Rogue',level:5},'the class the Dungeon Master gives, a level below the hero');
assert.ok(!r.validNpcState({...game,npcClasses:{mara:{class:'Necromancer',level:1}}}),'an unknown class is refused');
assert.ok(!r.validNpcState({...game,npcClasses:{mara:{class:'Ranger',level:21}}}),'level 21 is refused');
assert.ok(!r.validNpcState({...game,npcClasses:{n99:{class:'Ranger',level:2}}}),'someone unknown is refused');
assert.ok(r.resolveRecruitment(kara,game,hp,[plan('mara',{class:'Necromancer'})],question,'mara').error,'a made-up class is refused');
assert.equal(r.classFromRole('A temple acolyte'),'Cleric');assert.equal(r.classFromRole('Ferryman'),'Fighter');assert.equal(r.classFromRole('A wandering minstrel'),'Bard');
// The companion list shows her from the moment she joins.
same(r.companionGroups(joined.game).travelling.map(c=>c.id),['mara']);
// ---- 3. Offers to come along: recorded, offered as a chip while she is here, taken through the engine ----
const offered=r.commitDmTurn(kara,game,hp,{type:'recruitment',plans:[{npcId:tobin,decision:'offer',reason:'He wants the coin and the road.',terms:'A share of any reward.',dc:null,class:'Fighter'}]},{question:'I tell the hall about the fen lights.',narration:'Tobin stands.',npcId:null});
assert.equal(offered.error,undefined,offered.error);
same(offered.game.joinOffers,{[tobin]:{reason:'He wants the coin and the road.',terms:'A share of any reward.'}});
assert.match(offered.events[0],/Tobin Reed offers to come with you/);
assert.equal(offered.game.followers?.[tobin],undefined,'an offer is not a join');
assert.ok(valid(offered.game));
assert.ok(r.dmChoices(kara,offered.game,hp).some(c=>c.id==='join:'+tobin),'the offer is a choice');
const chip=r.quickActions(kara,offered.game,hp).find(a=>a.key==='join:'+tobin);
assert.ok(chip,'and a chip');assert.equal(chip.label,'Take Tobin along');
const taken=r.commitDmTurn(kara,offered.game,hp,chip.action,{question:chip.question,narration:'Tobin grins.',npcId:null});
assert.equal(taken.error,undefined,taken.error);
assert.equal(taken.game.followers[tobin].status,'following');same(taken.game.npcClasses[tobin],{class:'Fighter',level:1});assert.equal(taken.game.joinOffers,undefined,'the offer is used up');
assert.ok(valid(taken.game));
// A typed yes takes the offer too.
same(r.dmCommand(kara,offered.game,'Yes, Tobin, come with us.',hp)?.action,{type:'accept-offer',id:tobin});
same(r.dmCommand(kara,offered.game,'You can come along.',hp)?.action,{type:'accept-offer',id:tobin},'the only offer, plainly accepted');
assert.notEqual(r.dmCommand(kara,offered.game,"Yes, I'll take a room for the night.",hp)?.action?.type,'accept-offer','a bare yes to something else is not an answer to the offer');
// Away from him, the offer no longer stands.
const away=step(offered.game,{type:'travel',destination:'tower'});
assert.ok(!r.dmChoices(kara,away.game,hp).some(c=>c.id==='join:'+tobin),'no chip once he is not here');
assert.ok(r.acceptOffer(kara,away.game,tobin).error);
// An offer is not a join: an uninvited 'join' is refused, an 'offer' is fine.
assert.ok(r.resolveRecruitment(kara,game,hp,[plan(tobin)],'I look around the hall.',null).error,'nobody joins without being asked');
// ---- 4. Companions fight by their class ----
const foe={name:'Marsh Wolf',ac:12,saves:{Dexterity:2,Wisdom:0},attackBonus:4,count:1,die:6,bonus:2,type:'piercing'};
const fightWith=(npcClasses,followers)=>({...game,stage:'combat',enemyHP:200,followers,npcClasses});
const tobinAlong={[tobin]:{status:'following',location:'inn',reason:'Coin.',terms:''}};
const fighter=r.companionsAttack(fightWith({[tobin]:{class:'Fighter',level:5}},tobinAlong),foe,()=>0.6);
assert.equal(fighter.lines.filter(t=>t.startsWith('Tobin Reed attacks the Marsh Wolf: d20')).length,2,'a level-5 Fighter attacks twice');
assert.ok(fighter.lines.every(t=>/\+ 7 = /.test(t)),'with +7 (proficiency 3, Strength +4 after the level-4 improvement)');assert.ok(fighter.lines.every(t=>/slashing damage \(Greatsword\)/.test(t)));
const wizard=r.companionsAttack(fightWith({[tobin]:{class:'Wizard',level:1}},tobinAlong),foe,()=>0.9);
assert.equal(wizard.lines.length,1);assert.match(wizard.lines[0],/fire damage \(Fire Bolt\)/);
const cleric=r.companionsAttack(fightWith({[tobin]:{class:'Cleric',level:1}},tobinAlong),foe,()=>0.1);
assert.match(cleric.lines[0],/^Tobin Reed calls down radiant flame on the Marsh Wolf \(Sacred Flame\): Dexterity save d20 \[3\] \+ 2 = 5 vs DC 13\. Failure; \d+ radiant damage\.$/);
const bard=r.companionsAttack(fightWith({[tobin]:{class:'Bard',level:1}},tobinAlong),foe,()=>0.1);
assert.ok(bard.game.marks?.foe?.sapped,'a Bard\'s mockery leaves the creature off balance');
const rogue=r.companionsAttack(fightWith({[tobin]:{class:'Rogue',level:3}},tobinAlong),foe,()=>0.9);assert.match(rogue.lines[0],/Sneak Attack/);
const oldSave=r.companionsAttack(fightWith(undefined,tobinAlong),foe,()=>0.6);
assert.match(oldSave.lines[0],/^Tobin Reed attacks the Marsh Wolf: d20 \[13\] \(normal\) \+ 2 = 15/,'a companion from an old save keeps the plain blow');
// In a real fight through the engine, the classed companion's line is in the turn.
{const wolfFight=r.hostileEncounterGame(kara,{...taken.game,story:undefined},()=>0);
 const g={...taken.game,stage:'combat',wildFight:undefined};
 const opened=r.adventureStep({...wolfFight,people:taken.game.people,followers:taken.game.followers,npcClasses:taken.game.npcClasses,enemyHP:200},hp,kara,'attack:Greatsword',()=>0.7);
 const swing=r.adventureStep(opened.game,opened.health??hp,kara,'attack:Greatsword',()=>0.7);
 assert.equal(swing.error,undefined,swing.error);
 assert.ok(swing.events.some(t=>/^Tobin Reed attacks the .+: d20 .*\(Greatsword\)\.$/.test(t)),'the companion swings his greatsword in the turn');
 void g;}
// ---- 5. Rests bring a downed companion round; the dead stay dead ----
const downed={...taken.game,npcHP:{...taken.game.npcHP,[tobin]:0}};
const short=step(downed,'short-rest');
assert.ok(short.game.npcHP[tobin]>=1,'a short rest brings him round');assert.ok(short.events.some(t=>/Tobin Reed comes round/.test(t)));
const long=step({...downed,stage:'inn'},'long-rest');
assert.equal(long.game.npcHP[tobin],r.classedStats('Fighter',1).maximumHP,'a long rest makes him whole');
const dead={...downed,npcFate:{[tobin]:'dead'}};
assert.equal(step({...dead,stage:'inn'},'long-rest').game.npcHP[tobin],0,'the dead stay dead');
// ---- 6. Orders: wait here, travel away, send for them; everyone ----
const withWren=joined.game;
same(r.dmCommand(kara,withWren,'Wren, wait here.',hp)?.action,{type:'follower',id:'mara',order:'wait'});
const waits=r.commitDmTurn(kara,withWren,hp,{type:'follower',id:'mara',order:'wait'},{question:'Wren, wait here.',narration:'She nods and sits.',npcId:'mara'});
assert.equal(waits.error,undefined,waits.error);
assert.equal(waits.game.followers.mara.status,'waiting');assert.equal(waits.game.followers.mara.location,'inn');assert.ok(valid(waits.game));
assert.equal(r.dmCommand(kara,withWren,'Why did Wren wait?',hp)?.action?.type,undefined,'a question is not an order');
assert.equal(r.dmCommand(kara,withWren,"Wren, don't wait for me.",hp)?.action?.type,undefined,'nor a negative');
const gone=step(waits.game,{type:'travel',destination:'tower'});
assert.ok(!r.npcScene(gone.game).find(n=>n.id==='mara').present,'she stays behind');
same(r.dmCommand(kara,gone.game,'Send word to Wren.',hp)?.action,{type:'follower',id:'mara',order:'call'});
assert.ok(r.dmChoices(kara,gone.game,hp).some(c=>c.id==='follower-call:mara'),'the Dungeon Master may send for her');
assert.ok(!r.quickActions(kara,gone.game,hp).some(a=>/^follower-/.test(a.key)),'orders are not chips');
const called=r.manageFollower(gone.game,'mara','call');
assert.equal(called.error,undefined,called.error);assert.equal(called.game.followers.mara.status,'following');
assert.ok(r.npcScene(called.game).find(n=>n.id==='mara').present,'she has caught up');assert.match(called.events[0],/Word reaches Wren Halloway at Causeway Hall/);
assert.ok(valid(called.game));
// Waiting at a found place reads by its own name (the Companions screen's label).
assert.equal(r.followerPlace(game,'p2'),r.placeName(game,'p2'));assert.notEqual(r.followerPlace(game,'p2'),'undefined');
const both={...taken.game,followers:{...taken.game.followers,mara:withWren.followers.mara},npcClasses:{...taken.game.npcClasses,mara:withWren.npcClasses.mara}};
const all=r.dmCommand(kara,both,'Everyone wait here.',hp)?.action;
same(all,{type:'follower',ids:['mara',tobin].filter(x=>both.followers[x]).sort((a,b)=>Object.keys(both.followers).indexOf(a)-Object.keys(both.followers).indexOf(b)),order:'wait'});
const camp=step(both,all);assert.ok(Object.values(camp.game.followers).every(f=>f.status==='waiting'),'everyone waits');
// Following is the default: a companion comes along on travel and into the wilds.
const trip=step(withWren,{type:'travel',destination:'p1'});
assert.ok(r.npcScene(trip.game).find(n=>n.id==='mara').present,'she follows to a found place');
// An old save: a companion with no class gains one on the next turn, deterministic, and the save stays valid.
const old={...withWren,npcHP:{mara:9}};delete old.npcClasses;
const migrated=r.withCompanionClasses(old,kara);same(migrated.npcClasses,{mara:{class:'Ranger',level:1}});assert.equal(r.withCompanionClasses(migrated,kara),migrated,'idempotent');
assert.ok(valid(old)&&valid(migrated));
// A tough person who becomes a frail-hit-point class keeps within the new maximum.
{const tough={...game,people:{...game.people,[tobin]:{...game.people[tobin],role:'A scholar of old maps.'}},followers:tobinAlong,npcHP:{[tobin]:16}};
 const m=r.withCompanionClasses(tough,kara);assert.equal(m.npcClasses[tobin].class,'Wizard');assert.equal(m.npcHP[tobin],r.classedStats('Wizard',1).maximumHP);assert.ok(valid(m));}
// ---- 7. Parting ways with a friend leaves an ally ----
const friend={...withWren,npcMemory:{...withWren.npcMemory,mara:{...withWren.npcMemory.mara,attitude:'friendly'}}};
const parted=r.manageFollower(friend,'mara','dismiss');
assert.equal(parted.game.npcMemory.mara.allegiance,'player');assert.ok(r.isAlly(parted.game,'mara'));assert.ok(!r.isCompanion(parted.game,'mara'));
assert.match(parted.events[0],/parts ways with you but remains your ally/);
same(r.companionGroups(parted.game).allies.map(a=>a.id),['mara'],'she is listed under Allies');
assert.ok(r.npcCombatParticipants(parted.game,tobin).some(p=>p.id==='mara'&&p.side==='ally'),'at her home she sides with the hero');
const cool=r.manageFollower({...withWren,npcMemory:{...withWren.npcMemory,mara:{...withWren.npcMemory.mara,attitude:'indifferent'}}},'mara','dismiss');
assert.equal(cool.game.npcMemory.mara.allegiance,undefined,'someone cooler just goes their way');
// ---- 8. Allies through the Dungeon Master ----
const pledge=r.commitDmTurn(kara,game,hp,null,{question:'Will you hold the hall if the lights come?',narration:'Cobb nods.',relationships:[{npcId:'keeper',change:'ally',memory:'I promised to hold the hall for the hero.'}]});
assert.equal(pledge.error,undefined,pledge.error);assert.equal(pledge.game.npcMemory.keeper.allegiance,'player');assert.equal(pledge.game.followers?.keeper,undefined,'an ally does not travel');
assert.ok(pledge.events.some(t=>/will stand with you/.test(t)));assert.ok(valid(pledge.game));
const grudging={...game,npcMemory:{keeper:{attitude:'hostile',response:'Hostile.',memories:[],grudge:'You killed my brother.'}}};
assert.equal(r.commitDmTurn(kara,grudging,hp,null,{question:'Help me.',narration:'No.',relationships:[{npcId:'keeper',change:'ally',memory:'I will stand with the hero.'}]}).game.npcMemory.keeper.allegiance,undefined,'never while a grudge stands');
const withdrawn=r.commitDmTurn(kara,pledge.game,hp,null,{question:'x',narration:'He turns away.',relationships:[{npcId:'keeper',change:'parts',memory:'The hero lied to me.'}]});
assert.equal(withdrawn.game.npcMemory.keeper.allegiance,undefined);
// ---- 9. Allies fight beside the hero only where they live ----
const atMill={...game,stage:'combat',wildFight:{place:'p2'},npcMemory:{[cobb]:{attitude:'friendly',response:'Helps.',memories:[],allegiance:'player'}}};
assert.ok(r.fightingCompanions(atMill).some(n=>n.id===cobb),'the miller fights at his mill');
assert.ok(!r.fightingCompanions({...atMill,wildFight:{place:'p1'}}).some(n=>n.id===cobb),'not elsewhere');
// ---- 10. Class only for those who have one ----
const entities=r.encounterEntities(kara,joined.game,hp);
const wren=entities.find(e=>e.id==='mara'),reeve=entities.find(e=>e.id==='keeper'),fenFoe=entities.find(e=>e.id==='foe');
assert.equal(wren.className,'Ranger');assert.equal(wren.level,1);assert.match(wren.note,/Level 1 Ranger, travels with you/);
assert.equal(reeve.className,null);assert.equal(reeve.level,null);assert.equal(reeve.role,'The reeve of the causeway, who keeps the hall.');assert.equal(reeve.scores,null);
assert.equal(fenFoe.className,null);assert.equal(fenFoe.kind,'Creature');
assert.ok(entities.every(e=>!/commoner/i.test(e.note??'')),'no "commoner" anywhere');
// The Dungeon Master sees who is trained and who stands where.
{const ctx=r.dmContext(kara,parted.game,hp);const n=ctx.nearbyNPCs.find(x=>x.id==='mara');assert.equal(n.trainedAs,'Ranger 1');assert.equal(n.standing,'ally');}
// ---- 11. The next tale keeps a companion's class under the new id; offers stay behind ----
{const along={...taken.game,joinOffers:{[maud]:{reason:'She wants to come.',terms:''}}};
 const next=r.freshStoryGame(kara,{...written,id:'fens-2',residents:[]},r.newAdventure(kara));
 const sequel=r.joinRegion(next,along,{sameRegion:false,bearing:'N',miles:5});
 const nid=Object.keys(sequel.people).find(k=>sequel.people[k].name==='Tobin Reed');
 assert.ok(nid);same(sequel.npcClasses[nid],{class:'Fighter',level:1});assert.equal(sequel.followers[nid].status,'following');assert.equal(sequel.joinOffers,undefined);
 assert.ok(valid(sequel));}
// ---- 12. Companions level a step behind the hero ----
{const g={...both,followers:{...both.followers,mara:{...both.followers.mara,status:'waiting'}},npcHP:{[tobin]:10,mara:5}};
 g.followers.extra=undefined;delete g.followers.extra;
 const gone2={...g,followers:{...g.followers},npcClasses:{...g.npcClasses}};
 const leveled=r.levelCompanions(gone2,4);
 same(leveled.npcClasses[tobin],{class:'Fighter',level:3});same(leveled.npcClasses.mara,{class:'Ranger',level:3},'a waiting one too');
 assert.equal(leveled.npcHP[tobin],10+r.classedStats('Fighter',3).maximumHP-r.classedStats('Fighter',1).maximumHP);
 const dismissed={...gone2,followers:{...gone2.followers,mara:{...gone2.followers.mara,status:'dismissed'}}};
 same(r.levelCompanions(dismissed,4).npcClasses.mara,{class:'Ranger',level:1},'not someone who parted ways');}
// ---- 13. A shared table: classes and offers are shared world, the same from every point of view ----
{const ilyra=r.readyHero('wizard');
 const hosted=r.startParty(r.adventureSnapshot(kara,taken.game,hp,true),'A','Sam');
 const table=r.joinParty(hosted,'B',{character:JSON.stringify(ilyra),game:r.newAdventure(ilyra),health:null,name:'Jo'}).snapshot;
 const viewB=r.partyView(table,'B');
 same(viewB.game.npcClasses,taken.game.npcClasses,'every hero sees the same classes');
 same(r.canonicalParty(table),r.canonicalParty(viewB));
 assert.ok(r.validAdventure(viewB,ilyra),'the party save is valid with a classed companion');
 const fromB=r.adventureStep(viewB.game,viewB.health,ilyra,{type:'follower',id:tobin,order:'wait'},()=>0.5);
 assert.equal(fromB.error,undefined,fromB.error);assert.equal(fromB.game.followers[tobin].status,'waiting','any hero at the table can give an order');}
// ---- An old crossroads save (no story) still recruits and fights ----
{const plain=r.newAdventure(kara);const q='Mara, will you join me?';
 const j=r.resolveRecruitment(kara,plain,hp,[{npcId:'mara',decision:'join',reason:'The road is dangerous.',terms:'',dc:null}],q,'mara');
 assert.equal(j.error,undefined,j.error);same(j.game.npcClasses.mara,{class:'Rogue',level:1},'a medicine courier fights as a Rogue');assert.ok(valid(j.game));}
// ---- The Dungeon Master server (fake provider) ----
const server=require('./dm-server.cjs'),intent=require('./dm-intent.cjs');
let lastRequest=null;
const reply=extra=>async(url,options)=>{lastRequest=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({narration:'Tobin looks up.',dialogue:[],recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null,rewind:false,fault:null,suggestions:[],...extra})}]}]})};};
const keys={apiKey:'test-only',model:'test-model'};
const social=[{id:'keeper',name:'Reeve Ormund',attitude:'indifferent'},{id:'mara',name:'Wren Halloway',attitude:'indifferent'},{id:'n1',name:'Tobin Reed',attitude:'friendly'}];
const body=(extra={},input='I tell them about the fen lights.')=>({input,context:{choices:[],story:{foe:'Fen Warden'},npcSocialState:social,nearbyNPCs:social,conversationParticipants:social,followers:{},recruitmentTargets:[],world:{canIntroduce:true},...extra}});
const hob={name:'Hob Tallow',species:'Human',role:'A ferryman.',appearance:'A stooped old man with a long pole.',personality:'Grumbling.',toughness:'common',attitude:'indifferent',foe:'neutral',tie:null,gender:'man',regard:{stance:'indifferent',reason:'Folk are folk.'}};
(async()=>{
 // An offer from someone present who was not invited is accepted; a join from them is not.
 const offer=await server.generate(body(),{...keys,fetchImpl:reply({recruitment:[{npcId:'n1',decision:'offer',reason:'He wants the road.',terms:'',dc:null,class:'Fighter'}]})});
 same(offer.recruitment.map(p=>[p.npcId,p.decision,p.class]),[['n1','offer','Fighter']]);
 const schema=lastRequest.text.format.schema.properties.recruitment.items.properties;
 assert.ok(schema.decision.enum.includes('offer'));assert.ok(schema.class.enum.includes('Ranger')&&schema.class.enum.includes(null));
 assert.deepEqual((await server.generate(body(),{...keys,fetchImpl:reply({recruitment:[{npcId:'n1',decision:'join',reason:'He wants the road.',terms:'',dc:null,class:'Fighter'}]})})).recruitment,[],'an uninvited join is refused');
 const invited=await server.generate(body({recruitmentTargets:['mara']},'Wren, will you come with me?'),{...keys,fetchImpl:reply({recruitment:[{npcId:'mara',decision:'join',reason:'Her brother.',terms:'',dc:null,class:'Necromancer'}]})});
 assert.equal(invited.recruitment[0].class,null,'a made-up class becomes null');
 // introduce: a Cleric is kept, a made-up class repaired to null.
 const cleric=await server.generate(body(),{...keys,fetchImpl:reply({introduce:{...hob,class:'Cleric'}})});assert.equal(cleric.introduce.class,'Cleric');
 const odd=await server.generate(body(),{...keys,fetchImpl:reply({introduce:{...hob,class:'Necromancer'}})});assert.equal(odd.introduce.class,null);
 assert.ok(lastRequest.text.format.schema.properties.introduce.required.includes('class'));
 // ally and parts in relationships.
 const ally=await server.generate(body(),{...keys,fetchImpl:reply({relationships:[{npcId:'keeper',change:'ally',memory:'I will hold the hall for the hero.'}]})});
 same(ally.relationships.map(d=>d.change),['ally']);
 const instructions=JSON.stringify(lastRequest);
 assert.match(instructions,/COMPANIONS AND ALLIES/);assert.match(instructions,/CLASSES: Only people whose npcSocialState entry has trainedAs/);
 // The second look: a join told but not recorded.
 const ctx={context:{nearbyNPCs:[{id:'n1',name:'Tobin Reed'}],recruitmentTargets:['n1']},input:'How about you join us, Tobin?'};
 const fault=intent.secondLook(ctx,{narration:'Tobin Reed shoulders his pack and joins you on the road.',recruitment:[],dialogue:[]});
 assert.equal(fault?.kind,'unrecorded join');assert.equal(fault.sure,false,'never settled by the game');assert.match(fault.note,/recruitment is empty/);
 assert.equal(intent.secondLook(ctx,{narration:'Tobin Reed shoulders his pack and joins you on the road.',recruitment:[{npcId:'n1',decision:'join'}],dialogue:[]}),null,'recorded: nothing to say');
 assert.equal(intent.secondLook({...ctx,context:{...ctx.context,nearbyNPCs:[{id:'n1',name:'Tobin Reed',standing:'companion'}]}},{narration:'Tobin Reed comes along with you.',recruitment:[],dialogue:[]}),null,'already a companion');
 assert.equal(intent.secondLook(ctx,{narration:'Tobin shrugs.',recruitment:[],dialogue:[{speakerId:'n1',text:"I'll come with you, then."}]})?.kind,'unrecorded join','their own words count');
 console.log('Companions: classes for trained people and every companion (stats and attacks by class, a level below the hero), invitations in many words, offers to come along with a chip, allies who stay home and fight where they live, orders to wait, follow, send for and part ways, rests that revive, classes kept in the next tale and at a shared table, and the Dungeon Master held to all of it.');
})().catch(e=>{console.error(e);process.exit(1);});
