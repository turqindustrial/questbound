// The fights of written tales (the stories spec, Phase C; stagingRules.js fight shape, storyRules.js storyBossStats,
// encounterRules.js aloneFoe and scaledFoe, wildFightRules.js creatureRound; WRITTEN-TALES.md 4 and 13):
//   1. the tale's foe: more hit points than a story foe, a second blow from its level, sized to the hero's class when
//      met alone and to the party at a table; grown with the hero; stories with no staging keep their foe
//   2. a creature's blows against a hero alone, by class (never harder; nothing with a companion or a party)
//   3. minions: seated as the fight with the foe begins (from their level, packs one of their kind), scaled to the
//      side, gone with the fight (scattering once the foe falls), back when it is met again unless beaten or sent off
//   4. the foe bloodied, once: rage (a blow more), call (help comes), flee (it breaks away and is met again)
//   5. a hold (the foe cannot fall until it is held, its telling as the fight begins) and a deadline (its effects at
//      once, its advance once the fight is over); the fight's due thing told in the fight and marked told when carried
//   6. companions follow the hero's intent to take the foe alive; the game's own telling gives way to a fight's beat;
//      the Dungeon Master's note for it
//   7. tale-balance.cjs (balance-check.cjs --tale, check 8) plays the fixture's fights without an engine problem
// No AI, no network, no ports.
'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {rulesSource}=require('./rules-files.cjs'),tb=require('./tale-balance.cjs');
const names=[...new Set([...tb.needs,...tb.heroNeeds,'readyHero','validAdventure','settleTurn','stagingIds','beatKey','beatDue','taleNow','storyBossStats','storyFoeStats','bossShape','foeScaling','fightShape','scaledFoe','aloneFoe','encounterFoe','foeForLevel','partyInTale','validStory','routineTelling','fightFloor','bossRaged','withFightShape','worldPlaces','mapLocation','foeOffense','fightingCompanions'])];
const r=vm.runInNewContext(rulesSource({extra:['worldArtRules.js']})+'\n;({'+names.join(',')+'})',{AsyncStorage:{},console,weaponIcon:()=>'sword'},{timeout:20000});
const plain=v=>JSON.parse(JSON.stringify(v));
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'written-fixture.json'),'utf8'));
const heroAt=tb.readyHeroAt(r);
let copies=0;
const copy=(mutate=null)=>{const t=plain(fixture);if(mutate)mutate(t.story.staging,t.story);return tb.taleCopy(t,'shape-'+(++copies));};
const valid=(game,hero)=>assert.ok(r.validAdventure(r.adventureSnapshot(hero,game,null,true),hero),'a valid adventure');
// The fixture seated for this hero at its last chapter, at the foe's stronghold.
function atFoe(hero,mutate=null){
 const g=r.freshStoryGame(hero,copy(mutate),r.newAdventure(hero)),last=g.story.chapters.length-1;
 return {...g,story:{...g.story,chapter:last},pace:{...g.pace,ch:last},stage:'bridge'};
}
const step=(g,hero,action,dice=()=>0.5,health=null)=>{const s=r.adventureStep(g,health,hero,action,dice);assert.ok(!s.error,'refused: '+s.error);return s;};
const minion=(template,name)=>({template,name,appearance:'A creature in the foe\'s pay, '+name.toLowerCase()+', armed and watchful.'});

// ---------- 1. The tale's foe ----------
{
 const base=r.storyFoeStats(3,'Slashing'),boss=r.storyBossStats(3,'Slashing','Fighter');
 assert.ok(boss.maximum>base.maximum,'the foe of a written tale has more hit points than a story foe');
 assert.ok(r.storyBossStats(3,'Slashing').maximum>base.maximum,'at a table too');
 assert.equal(boss.swings,2,'and against a Fighter alone strikes twice a turn from level '+r.bossShape.alone.Fighter.second);
 assert.equal(r.storyBossStats(2,'Slashing','Fighter').swings,undefined,'but once below it');
 assert.equal(r.storyBossStats(5,'Slashing','Wizard').swings,undefined,'and once against a Wizard alone');
 assert.equal(r.storyBossStats(5,'Slashing').swings,undefined,'and at a table, where the scaling to the side adds the blows');
 // Its shape is part of its strength: minions and a turn at half take from its hit points.
 const shaped={boss:{minions:[{template:'bandit',name:'A',appearance:'x'}],bloodied:{kind:'rage'}}};
 assert.ok(r.storyBossStats(3,'Slashing','Fighter',shaped).maximum<boss.maximum,'a foe with a minion and a rage has fewer hit points of its own');
 assert.equal(r.storyBossStats(1,'Slashing','Fighter',{boss:{minions:[{}]}}).maximum,r.storyBossStats(1,'Slashing','Fighter').maximum,'a minion that does not stand beside it at this level costs nothing');
 assert.ok(r.validStory({...atFoe(r.readyHero('fighter')).story,foeStats:boss}),'a story keeps such a stat block');
 for(const level of [1,3,8,20])assert.ok(r.storyBossStats(level,'Fire').maximum<=500,'within the stat block\'s limit at level '+level);
 // Met alone, the foe is sized to the hero's class; at a table the party's scaling does that work.
 const fighter=r.freshStoryGame(heroAt('fighter',3),copy(),r.newAdventure(heroAt('fighter',3))),wizard=r.freshStoryGame(heroAt('wizard',3),copy(),r.newAdventure(heroAt('wizard',3)));
 assert.equal(fighter.story.foeStats.maximum,r.storyBossStats(3,fixture.story.foeDamageType,'Fighter').maximum);
 assert.ok(wizard.story.foeStats.maximum<=fighter.story.foeStats.maximum,'a Wizard alone meets a foe no sturdier than a Fighter does');
 const party=r.freshStoryGame(heroAt('wizard',3),copy(),r.newAdventure(heroAt('wizard',3)),{party:true});
 assert.equal(party.story.foeStats.maximum,r.storyBossStats(3,fixture.story.foeDamageType).maximum,'at a table the class does not size it');
 // Grown with the hero (by their class), as a foe not yet fought always is.
 const grown=r.foeForLevel(fighter,5,'Fighter');assert.equal(grown.story.foeStats.maximum,r.storyBossStats(5,fixture.story.foeDamageType,'Fighter').maximum);assert.equal(grown.enemyHP,grown.story.foeStats.maximum);
 // A story with no staging keeps the story foe.
 const {staging:_s,...unstaged}=copy();const old=r.freshStoryGame(r.readyHero('fighter'),unstaged,r.newAdventure(r.readyHero('fighter')));
 assert.deepEqual(plain(old.story.foeStats),plain(r.storyFoeStats(1,fixture.story.foeDamageType)),'a tale with no staging keeps its foe as before');
 // A foe that strikes twice keeps both blows against a bigger side, and gains more.
 assert.equal(r.scaledFoe(boss,2.15).swings,4,'two blows a turn become four against a party of two');
 assert.equal(r.scaledFoe(base,2.15).swings,r.foeOffense(2.15).swings,'a foe of one blow is scaled as before');
}

// ---------- 2. Blows against a hero alone, by class ----------
{
 const wiz=r.readyHero('wizard'),kara=r.readyHero('fighter'),orc={name:'Orc',maximum:15,ac:13,attackBonus:5,die:12,count:1,bonus:3,type:'Slashing'};
 const alone={stage:'combat',story:null};
 assert.equal(r.aloneFoe(orc,kara,alone),orc,'a Fighter meets the creature as written');
 const soft=r.aloneFoe(orc,wiz,alone);assert.ok(soft.bonus<orc.bonus&&soft.bonus>=0,'a Wizard alone meets softer blows ('+soft.bonus+' for '+orc.bonus+')');
 assert.equal(soft.attackBonus,orc.attackBonus,'only the damage, never the aim');
 assert.equal(r.aloneFoe({...orc,bonus:0},wiz,alone).bonus,0,'never below +0');
 assert.equal(r.aloneFoe(orc,wiz,{stage:'combat',party:{lead:'P0',members:{P0:{}}}}),orc,'a party is met as the side\'s scaling says');
}

// ---------- 3. Minions ----------
const shaped=(boss)=>(st)=>{st.boss={...st.boss,...boss};};
{
 const hero=heroAt('fighter',2),g=atFoe(hero,shaped({minions:[minion('wolves','The Kennel Pair'),minion('orc','The Hired Brute')]}));
 const opened=step(g,hero,'approach');
 assert.equal(opened.game.stage,'combat');
 assert.equal(opened.game.foeAllies.length,2,'the foe\'s minions stand beside it as the fight begins');
 assert.deepEqual(opened.game.foeAllies.map(a=>a.template),['wolf','goblin'],'a pack as one of its kind, the orc a goblin below level 3');
 assert.ok(opened.game.foeAllies.every(a=>a.hp===a.maximum&&a.maximum>=3),'at their own hit points');
 assert.ok(opened.events.some(e=>/stand beside Corran Stell/.test(e)),'told: '+opened.events.join(' | '));
 valid(opened.game,hero);
 // Below the minions' level the foe comes alone.
 const low=step(atFoe(heroAt('fighter',1),shaped({minions:[minion('bandit','The Hired Knife')]})),heroAt('fighter',1),'approach');
 assert.equal(low.game.foeAllies,undefined,'below level '+r.fightShape.minionsFrom+' the foe fights alone');
 // The foe falls: its minions scatter and leave with the fight.
 const nearly={...opened.game,enemyHP:1,openingAttackAvailable:false,encounterInitiative:{player:20,foe:1}};
 const won=step(nearly,hero,{type:'encounter-attack',weapon:'Greatsword'},()=>0.95);
 assert.equal(won.game.stage,'victory');assert.equal(won.game.foeAllies,undefined,'nothing beside a fallen foe');
 assert.ok(won.events.some(e=>/turns and flees/.test(e)),'they flee: '+won.events.join(' | '));
 valid(won.game,hero);
 // The hero runs: the minions go with the fight, and stand beside the foe again when it is met again.
 const fled=step({...opened.game,openingAttackAvailable:false},hero,'flee');
 assert.equal(fled.game.foeAllies,undefined);valid(fled.game,hero);
 const back=step({...fled.game,stage:'bridge'},hero,'approach');assert.equal(back.game.foeAllies?.length,2,'met again, it has them again');
 // Minions beaten stay beaten.
 const beaten={...opened.game,openingAttackAvailable:false,foeAllies:opened.game.foeAllies.map(a=>({...a,hp:0}))};
 const ran=step(beaten,hero,'flee');assert.ok(ran.game.pace.fired.includes('boss:minions'),'their defeat is remembered');
 assert.equal(step({...ran.game,stage:'bridge'},hero,'approach').game.foeAllies,undefined,'and the foe comes alone after');
 // A party: the minions are as sturdy as the side.
 const lead=heroAt('fighter',3),other=heroAt('cleric',3);
 let table=r.startParty(r.adventureSnapshot(lead,atFoe(lead,shaped({minions:[minion('bandit','The Hired Knife')]})),null,true),'P0','P0');
 table=r.joinParty(table,'P1',{character:JSON.stringify(other),game:null,health:null,name:'P1'}).snapshot;
 const v=r.partyView(table,'P0'),partyStep=step(v.game,lead,'approach');
 const single=r.adventureStep(atFoe(lead,shaped({minions:[minion('bandit','The Hired Knife')]})),null,lead,'approach',()=>0.5).game.foeAllies[0];
 assert.ok(partyStep.game.foeAllies[0].maximum>single.maximum,'a minion is scaled to a party ('+partyStep.game.foeAllies[0].maximum+' against '+single.maximum+')');
}

// ---------- effects: minions sent off, the foe hurt ----------
{
 const hero=heroAt('fighter',2);
 const off=atFoe(hero,shaped({minions:[minion('bandit','The Hired Knife')]}));
 const sent=r.withFightShape(off,{game:{...off,pace:{...off.pace,fired:[...off.pace.fired,'boss:minions']}},health:null,events:[]},hero).game;
 assert.equal(step(sent,hero,'approach').game.foeAllies,undefined,'minions sent off never come');
 const hurt={...off,pace:{...off.pace,fired:[...off.pace.fired,'boss:hurt']}},opened=step(hurt,hero,'approach');
 assert.equal(opened.game.enemyHP,off.enemyHP-Math.round(off.story.foeStats.maximum*r.fightShape.hurt),'a foe that comes hurt has lost a share of its hit points');
 assert.ok(opened.game.pace.fired.includes('boss:hurt-done'));
 const again=step({...step({...opened.game,openingAttackAvailable:false},hero,'flee').game,stage:'bridge'},hero,'approach');
 assert.equal(again.game.enemyHP,opened.game.enemyHP,'only once');
}

// ---------- 4. Bloodied ----------
const toHalf=(g)=>({...g,enemyHP:Math.floor(r.encounterFoe(heroAt('fighter',3),g).maximum/2)+1,openingAttackAvailable:false,encounterInitiative:{player:20,foe:1}});
const swing=(g,hero,dice=()=>0.7)=>step(g,hero,{type:'encounter-attack',weapon:hero.class==='Fighter'?'Greatsword':'Dagger'},dice);
{
 const hero=heroAt('fighter',3);
 // Rage: once at half its hit points, one blow more a turn.
 const rage=step(atFoe(hero,shaped({bloodied:{kind:'rage',tell:'Bloodied, Corran Stell throws down his bow and comes on with a long knife.',line:'Bloodied, the poacher draws a long knife.'}})),hero,'approach');
 const before=r.encounterFoe(hero,rage.game).swings??1,hit=swing(toHalf(rage.game),hero);
 assert.ok(hit.game.pace.fired.includes('bloodied:boss'),'the foe is bloodied once at half');
 assert.ok(r.bossRaged(hit.game),'and rages');assert.equal(r.encounterFoe(hero,hit.game).swings,before+1,'a blow more a turn');
 assert.deepEqual(plain(r.beatDue(hit.game)),{kind:'bloodied',id:'boss'},'told in the fight');
 const words=r.taleNow(hit.game)?.beat;assert.equal(words?.kind,'bloodied');assert.match(words.tell,/long knife/);
 const told=r.settleTurn({hero,game:rage.game,health:null,action:{type:'encounter-attack',weapon:'Greatsword'},conversation:{question:'I attack.',narration:'You strike.',dialogue:[],npcId:null,beats:['bloodied:boss']},random:()=>0.9}).result;
 assert.equal(told.game.pace.fight?.due??0,0,'a request that carried it marks it told');
 // Call: help comes (the tale's own creature for it, else the foe's first minion), from its level.
 const call=step(atFoe(hero,shaped({bloodied:{kind:'call',tell:'Bloodied, Corran Stell whistles, and a hound comes out of the brush.',line:'Bloodied, the poacher whistles up a hound.',ally:minion('wolf','The Poacher\'s Hound')}})),hero,'approach');
 const called=swing(toHalf(call.game),hero);
 assert.equal(called.game.foeAllies?.length,1,'help comes');assert.equal(called.game.foeAllies[0].name,'Poacher\'s Hound');valid(called.game,hero);
 assert.ok(called.events.some(e=>/joins the fight/.test(e)),called.events.join(' | '));
 const low=heroAt('fighter',1),callLow=swing(toHalf(step(atFoe(low,shaped({bloodied:{kind:'call',tell:'Bloodied, he whistles.',line:'He whistles.',ally:minion('wolf','The Poacher\'s Hound')}})),low,'approach').game),low,()=>0.99);
 assert.equal(callLow.game.foeAllies,undefined,'no help below level '+r.fightShape.callFrom);
 // Flee: it breaks away, keeps at least half its hit points, and is met again at its stronghold.
 const flee=step(atFoe(hero),hero,'approach'),broke=swing(toHalf(flee.game),hero);
 assert.equal(broke.game.stage,'bridge','the fight is over: it broke away');
 assert.ok(broke.game.enemyHP>=Math.round(r.encounterFoe(hero,flee.game).maximum*r.fightShape.fledShare)-1,'with a share of its hit points');
 assert.ok(broke.game.enemyHP>0&&!broke.game.foeFate);valid(broke.game,hero);
 assert.deepEqual(plain(r.beatDue(broke.game)),{kind:'bloodied',id:'boss'},'its breaking away is told next');
 const met=step(broke.game,hero,'approach');assert.equal(met.game.stage,'combat','gone after, it is met again');
 const twice=swing({...met.game,enemyHP:2,openingAttackAvailable:false},hero,()=>0.2);assert.ok(!twice.game.pace.fired.includes('boss:fled')||twice.game.stage!=='bridge'||twice.game.pace.fired.filter(x=>x==='bloodied:boss').length===1,'it breaks away once');
}

// ---------- 5. Hold and deadline ----------
{
 const hero=heroAt('fighter',3),hold={rounds:2,tell:'Until the horn has sounded three times, Corran Stell keeps to the trees and cannot be cornered.',then:{stake:{s1:'heard across the wood'}}};
 const g=step(atFoe(hero,(st)=>{st.boss={hold};st.stakes=st.stakes?.length?st.stakes:[{id:'s1',name:'Kettle Camp',state:'holding on'}];}),hero,'approach');
 assert.deepEqual(plain(r.beatDue(g.game)),{kind:'hold',id:'boss'},'a hold is told as the fight begins');
 assert.equal(r.fightFloor(g.game),1,'and holds the foe up');
 const held=swing({...g.game,enemyHP:2,openingAttackAvailable:false,encounterInitiative:{player:20,foe:1}},hero,()=>0.99);
 assert.equal(held.game.stage,'combat','a blow that would drop it leaves it standing');assert.equal(held.game.enemyHP,1);
 assert.ok(held.events.some(e=>/will not go down yet/.test(e)),held.events.join(' | '));
 // Two rounds on, it has been held: its effects apply and it can fall.
 let x=held.game,h=held.health;for(let i=0;i<4&&!x.pace.fired.includes('hold:boss');i++){const s=r.adventureStep({...x,enemyHP:Math.max(x.enemyHP,30)},h,hero,x.actionUsed?'end-turn':'dodge',()=>0.01);assert.ok(!s.error,s.error);x=s.game;h=s.health??h;}
 assert.ok(x.pace.fired.includes('hold:boss'),'the hold is served');assert.equal(r.fightFloor(x),0);
 if(x.pace.stakes?.s1)assert.equal(x.pace.stakes.s1,'heard across the wood','its effects apply');
 // A deadline: its effects at once, its advance once the fight is over.
 const dead={turns:1,tell:'The carts are loaded while you fight, and the first one rolls.',then:{clock:1,advance:true}};
 const tale=copy((st)=>{st.chapters[0].fight={...st.chapters[0].fight,deadline:dead};});
 const kara=heroAt('fighter',3),seated=r.freshStoryGame(kara,tale,r.newAdventure(kara)),place=r.stagingIds(seated).place(tale.staging.chapters[0].fight.at);
 const arrived=r.startWildFight(seated,kara,r.stagedThreat(tale.staging.chapters[0].fight,3),{place,from:'inn'}).game;
 let f=arrived,fh=null;for(let i=0;i<6&&!f.pace?.fired?.includes('deadline:c1');i++){const s=r.adventureStep({...f,enemyHP:Math.max(f.enemyHP,20)},fh,kara,f.actionUsed?'end-turn':'dodge',()=>0.01);assert.ok(!s.error,s.error);f=s.game;fh=s.health??fh;}
 assert.ok(f.pace.fired.includes('deadline:c1'),'the deadline passes');
 assert.deepEqual(plain(r.beatDue(f)),{kind:'deadline',id:'c1'},'told in the fight');
 assert.equal(f.pace.fight.close,1,'its advance waits for the fight to end');assert.equal(f.story.chapter,0);
 const ended=r.settleTurn({hero:kara,game:{...f,enemyHP:1},health:fh,action:{type:'encounter-attack',weapon:'Greatsword'},conversation:{question:'I attack.',narration:'You strike.',dialogue:[],npcId:null,beats:['deadline:c1']},random:()=>0.95}).result;
 assert.equal(ended.game.story.chapter,1,'once the fight is over the chapter closes');
 assert.equal(ended.game.pace.due?.kind,'turn','its truth is due');assert.match(String(ended.game.pace.due?.id),/^deadline:c1$/);
 valid(ended.game,kara);
}

// ---------- 6. Companions, the game's own telling, the Dungeon Master's note ----------
{
 const hero=heroAt('fighter',3),g=step(atFoe(hero,st=>{delete st.boss.bloodied;}),hero,'approach').game;
 // (no bonus action to wait for: Second Wind and Action Surge spent, no draught)
 const withMara={...g,resources:{wind:2,surge:1},potions:0,followers:{mara:{status:'following',location:'inn',reason:'Test.',terms:''}},npcClasses:{mara:{class:'Fighter',level:2}},enemyHP:6,openingAttackAvailable:false,encounterInitiative:{player:20,foe:1},subdue:true};
 const s=r.adventureStep(withMara,null,hero,{type:'encounter-attack',weapon:'Greatsword'},(()=>{let n=0;return()=>n++<1?0.02:0.99;})());
 assert.ok(s.events.some(t=>/^Linnet Spey attacks/.test(t)),'the companion strikes: '+s.events.join(' | '));
 assert.equal(s.game.stage,'victory');assert.equal(s.game.foeFate,'subdued','a companion\'s blow takes the foe alive when the hero set out to');
 // Protect: someone who lives where the fight is and stands with the hero fights in it (encounterRules.js fightingCompanions).
 {const kara=heroAt('fighter',3),tale=copy(),seated=r.freshStoryGame(kara,tale,r.newAdventure(kara)),at=r.stagingIds(seated).place(tale.staging.chapters[0].fight.at),id=Object.keys(seated.people)[0];
  const home={...seated,people:{...seated.people,[id]:{...seated.people[id],home:at}},npcMemory:{...seated.npcMemory,[id]:{...(seated.npcMemory?.[id]??{}),allegiance:'player',attitude:'friendly'}}};
  const fight=r.startWildFight(home,kara,r.stagedThreat(tale.staging.chapters[0].fight,3),{place:at,from:'inn'}).game;
  assert.ok(r.fightingCompanions(fight).some(n=>n.id===id),'an ally who lives at the set piece fights in it');}
 const rage=step(atFoe(hero,shaped({bloodied:{kind:'rage',tell:'Bloodied, he rages.',line:'He rages.'}})),hero,'approach');
 const due=swing(toHalf(rage.game),hero);
 assert.equal(r.routineTelling({hero,before:rage.game,preview:due,health:null,action:{type:'encounter-attack',weapon:'Greatsword'},words:'I attack with my Greatsword.',preferences:{narrator:'chronicler'}}),null,'the game\'s own telling gives way to a fight\'s beat');
 const {beatNote}=require('./dm-instructions.cjs');
 assert.match(beatNote({context:{taleNow:{beat:{kind:'bloodied',id:'boss',tell:'Bloodied, he rages.'}}}}),/STORY BEAT THIS TURN \(in the fight\): Bloodied, he rages\./);
}

// ---------- 7. tale-balance.cjs ----------
{
 const out=tb.taleBalance({r,story:tb.taleCopy(fixture,'balance'),heroAt,classes:['fighter','wizard'],levels:[1,3],party:[1,2],fights:6,random:(()=>{let a=7;return()=>{a=(a*16807)%2147483647;return a/2147483647;};})()});
 assert.deepEqual(out.problems,[],'no engine problem');
 assert.ok(out.cells.some(c=>c.kind==='boss')&&out.cells.some(c=>c.kind==='set'),'the set pieces and the foe');
 assert.ok(out.cells.every(c=>c.none||(c.win>=0&&c.win<=1&&c.fights===6)),'every cell played');
 const found=tb.balanceFindings([{label:'x',kind:'boss',size:1,cls:'Wizard',level:1,win:0.5,fall:0.5,death:0.1,cost:0.9}],'gentle');
 assert.equal(found.length,4,'wins, hit points, falls and deaths against the targets');
}
console.log('Fight shape: the tale\'s foe sized by level and class (against a Fighter alone a second blow from level '+r.bossShape.alone.Fighter.second+'), blows against a hero alone by class, minions seated, scaled, scattering and remembered, the foe bloodied (rage, call, flee) once, a hold and a deadline with their tellings in the fight, companions taking the foe alive, an ally who lives at a set piece fighting in it, the game\'s telling giving way, and tale-balance.cjs playing the fixture\'s fights.');
