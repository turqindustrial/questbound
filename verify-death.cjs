const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const {rulesSource}=require('./rules-files.cjs');
// Killing and dying: death saving throws, outright death, a dead hero's save, NPCs killed or knocked out, the story
// foe slain or beaten, and attacks in any wording (main weapon, named weapon, bare hands, a bow).
const source=rulesSource({extra:['rosterRules.js']});
const r=vm.runInNewContext(source+'\n({adventureStep,newAdventure,validAdventure,adventureSnapshot,equipmentFor,attackOptions,unarmedStrike,rangedMode,rollDamage,dmCommand,dmChoices,commitDmTurn,hostileEncounterGame,quickActions,storyText,withAttackIntent,npcScene,dmContext,readyHero,readyHeroes,makeCharacter,blankBuild,startParty,joinParty,partyView,settleParty,mapLocation,knownSpells,slotUsed,sparedBlow,survivalOdds,revivalOptions,deathIsFinal,boughtRevivals,layToRest,graveEntry,validGrave,setAside,maxGraves})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const make=(cls,patch={})=>{const h={name:'Death tester',class:cls,species:'Human',level:1,scores:{Strength:16,Dexterity:14,Constitution:14,Intelligence:10,Wisdom:12,Charisma:10},spells:[],...patch};h.equipment=r.equipmentFor(h);return h;};
const fighter=make('Fighter'),valid=(hero,g,h)=>r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(g)),h,true),hero);
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const seq=values=>{let i=0;return ()=>values[i++]??0.5;};

// ---- Falling, death saves, death ----
// No draught and no Second Wind left, so nothing holds the turn open after the action.
const fight={...r.hostileEncounterGame(fighter,r.newAdventure(fighter),()=>0),potions:0,resources:{wind:2}},open={...fight,openingAttackAvailable:false};
let down=r.adventureStep(open,{current:1,temp:0},fighter,'dodge',()=>0.9);
assert.equal(down.game.stage,'dying');assert.equal(down.health.current,0);same({...down.game.dying},{successes:0,failures:0,place:'bridge',cause:'Slain by the Bandit Cutthroat',placeName:'Overgrown Roadside',where:'bridge',fight:true});
assert.ok(valid(fighter,down.game,down.health));assert.equal(down.game.openingAttackAvailable,undefined);
assert.equal(r.adventureStep(down.game,down.health,fighter,'attack:Greatsword').error,'You are unconscious and dying. Roll a death saving throw to hold on.');
same(r.dmChoices(fighter,down.game).map(c=>c.id),['death-save']);
const chips=r.quickActions(fighter,down.game);assert.equal(chips[0].key,'death-save');assert.equal(chips[0].primary,true);assert.equal(chips.length,1,'Only the death save while dying');
// A natural 1 counts double; three failures kill.
let s=r.adventureStep(down.game,down.health,fighter,'death-save',()=>0);same([s.game.dying.successes,s.game.dying.failures],[0,2]);assert.ok(s.events[0].includes('A natural 1 counts as two failures'));
s=r.adventureStep(s.game,s.health,fighter,'death-save',()=>0.2);assert.equal(s.game.stage,'dead');assert.equal(s.game.death.cause,'Slain by the Bandit Cutthroat');assert.equal(s.game.death.place,'Overgrown Roadside');assert.equal(s.game.death.at,'bridge');assert.equal(s.game.death.massive,false);
assert.ok(s.events.at(-1).endsWith('You die.'));assert.ok(valid(fighter,s.game,s.health));assert.equal(s.game.journal.entries.at(-1).title,'Fallen');
// The dead stay dead.
assert.match(r.adventureStep(s.game,s.health,fighter,'death-save').error,/has died/);assert.match(r.adventureStep(s.game,s.health,fighter,'long-rest').error,/has died/);
same(r.dmChoices(fighter,s.game),[]);same(r.quickActions(fighter,s.game),[]);
// A natural 20 brings the hero straight back with 1 HP, where they fell; the foe is still there.
const twenty=r.adventureStep(down.game,down.health,fighter,'death-save',()=>0.99);
assert.equal(twenty.game.stage,'bridge');assert.equal(twenty.health.current,1);assert.equal(twenty.game.dying,undefined);assert.ok(twenty.game.enemyHP>0);assert.ok(valid(fighter,twenty.game,twenty.health));
assert.ok(r.dmChoices(fighter,twenty.game).some(c=>c.id==='approach'),'The foe can be faced again');
// Three successes: stable, then waking at the starting place with 1 HP.
let stable=down;for(let i=0;i<3;i++)stable=r.adventureStep(stable.game,stable.health,fighter,'death-save',()=>0.6);
assert.equal(stable.game.stage,'inn');assert.equal(stable.health.current,1);assert.equal(stable.game.journal.entries.at(-1).title,'Survived');
// Damage past 0 HP of at least the hero's maximum kills outright.
// (A level-1 hero meets a foe a point softer, storyRules.js foeEase: this one hits as hard as it would at 3rd level.)
const massive=r.adventureStep({...open,story:{...open.story,foeStats:{...open.story.foeStats,bonus:1}}},{current:1,temp:0},fighter,'dodge',()=>0.99);
assert.equal(massive.game.stage,'dead');assert.equal(massive.game.death.massive,true);assert.ok(massive.events.some(t=>t.startsWith('The blow is so savage that it kills you outright')));assert.ok(valid(fighter,massive.game,massive.health));
// A dead or dying save that was tampered with is refused.
assert.ok(!valid(fighter,{...down.game,dying:{...down.game.dying,failures:3}},down.health));
assert.ok(!valid(fighter,{...s.game,stage:'inn'},s.health),'A dead hero cannot be written back to life');
assert.ok(!valid(fighter,down.game,{current:4,temp:0}),'A dying hero has 0 HP');

// ---- The story foe: slain, or beaten but alive ----
let g=fight,h={current:12,temp:0};for(let i=0;i<40&&g.stage==='combat';i++){const step=r.adventureStep(g,h,fighter,'attack:Greatsword',()=>0.7);g=step.game;h=step.health;if(step.events.some(t=>t==='The Bandit Cutthroat is slain.'))break;}
assert.equal(g.stage,'victory');assert.equal(g.foeFate,'slain');assert.ok(g.log.includes('The Bandit Cutthroat is slain.'));assert.ok(valid(fighter,g,h));
const subdue=r.withAttackIntent(fight,'I knock the bandit out with the flat of my blade');assert.equal(subdue.subdue,true);
g=subdue;h={current:12,temp:0};let last;for(let i=0;i<40&&g.stage==='combat';i++){last=r.adventureStep({...g,subdue:true},h,fighter,'attack:Greatsword',()=>0.7);g=last.game;h=last.health;}
assert.equal(g.foeFate,'subdued');assert.ok(last.events.includes('The Bandit Cutthroat collapses, beaten but alive.'));assert.equal(g.subdue,undefined,'The intent never stays on the adventure');
// A pack: members fall dead one by one.
const pack=r.hostileEncounterGame(fighter,r.newAdventure(fighter),()=>2/9);assert.equal(pack.story.foe,'Goblin Raider');
const hitPack=r.adventureStep({...pack,openingAttackAvailable:false},{current:12,temp:0},fighter,'attack:Greatsword',()=>0.7);
assert.ok(hitPack.events.some(t=>/One of the goblin raiders falls dead — 2 still standing\./.test(t)));

// ---- NPCs: killed, knocked out, finished off ----
const story={...fight,stage:'inn',enemyHP:fight.enemyHP,map:{...fight.map,visited:['inn','bridge']}};delete story.openingAttackAvailable;
let kill=r.adventureStep(story,{current:12,temp:0},fighter,{type:'npc-attack',target:'mara',weapon:'Greatsword'},()=>0.99);
assert.equal(kill.game.npcHP.mara,0);assert.equal(kill.game.npcFate.mara,'dead');assert.ok(kill.events.some(t=>t==='Tobin Reed is dead.'));assert.ok(valid(fighter,kill.game,kill.health));
assert.ok(kill.game.npcMemory.keeper.memories.some(t=>t.startsWith('You saw the player kill')));assert.equal(kill.game.npcMemory.keeper.attitude,'hostile');
assert.ok(!r.dmChoices(fighter,kill.game).some(c=>c.id.startsWith('npc-attack:mara')),'The dead cannot be attacked again');
const ko=r.adventureStep(r.withAttackIntent(story,'I knock Tobin out'),{current:12,temp:0},fighter,{type:'npc-attack',target:'mara',weapon:'Greatsword'},()=>0.99);
assert.equal(ko.game.npcFate.mara,'unconscious');assert.ok(ko.events.includes('Tobin Reed drops, unconscious but alive.'));assert.equal(ko.game.subdue,undefined);assert.ok(valid(fighter,ko.game,ko.health));
// Someone lying senseless can be finished off once the fight is over.
const calm={...ko.game};delete calm.npcCombat;
const finish=r.adventureStep(calm,ko.health,fighter,{type:'npc-attack',target:'mara',weapon:'Greatsword'},()=>0.5);
assert.equal(finish.error,undefined);assert.equal(finish.game.npcFate.mara,'dead');assert.ok(finish.events.some(t=>t.endsWith('Tobin Reed is dead.')));
// Through the DM: the player's own words decide whether a finishing blow kills.
const spoken=r.commitDmTurn(fighter,story,{current:12,temp:0},{type:'npc-attack',target:'mara',weapon:'Greatsword'},{question:'I knock Tobin out cold with the pommel of my sword.',narration:'You swing the pommel.'},()=>0.99);
assert.equal(spoken.error,undefined);assert.equal(spoken.game.npcFate.mara,'unconscious');

// ---- Attacks in any wording ----
const unarmed=r.unarmedStrike(fighter);assert.equal(unarmed.name,'Unarmed Strike');assert.equal(unarmed.attackBonus,5);assert.equal(r.rollDamage(unarmed,true,()=>0.99).total,4,'1 + Strength, and a critical adds no dice');
assert.equal(r.attackOptions(fighter).at(-1).name,'Unarmed Strike');assert.equal(r.attackOptions(fighter)[0].name,'Greatsword','Main weapon first');
const monk=make('Monk',{scores:{Strength:10,Dexterity:16,Constitution:14,Intelligence:10,Wisdom:14,Charisma:8}});const fists=r.unarmedStrike(monk);assert.equal(fists.flat,false);assert.equal(fists.ability,'Dexterity');assert.ok(fists.die>=6);
const bare={...fighter,equipment:{...fighter.equipment,items:[]}};same(r.attackOptions(bare).map(w=>w.name),['Unarmed Strike'],'No weapon: fists');
const rogue=make('Rogue');const bow=r.attackOptions(rogue).find(w=>w.name==='Shortbow');assert.ok(bow,'A bow with arrows is an option');
assert.equal(r.rangedMode(bow,{closeEnemy:false}),'normal');assert.equal(r.rangedMode(bow,{closeEnemy:true}),'disadvantage');assert.equal(r.rangedMode(bow,{distance:100}),'disadvantage');
const inFight={...fight,openingAttackAvailable:false};
const parse=(hero,text,game=inFight)=>r.dmCommand(hero,game,text,{current:12,temp:0});
same(parse(fighter,'I attack').action,{type:'encounter-attack',weapon:'Greatsword'},'Unnamed: main weapon');
same(parse(fighter,'I punch him').action,{type:'encounter-attack',weapon:'Unarmed Strike'});
same(parse(fighter,'I kick the bandit in the face').action,{type:'encounter-attack',weapon:'Unarmed Strike'});
same(parse(fighter,'I swing at it with my sword').action,{type:'encounter-attack',weapon:'Greatsword'},'"sword" is the sword they carry');
same(parse(fighter,'Hack at the bandit').action,{type:'encounter-attack',weapon:'Greatsword'});
same(parse(fighter,'I attack with my fists').action,{type:'encounter-attack',weapon:'Unarmed Strike'});
same(parse(rogue,'I shoot it').action,{type:'encounter-attack',weapon:'Shortbow'});
assert.match(parse(fighter,'I shoot it').error,/no bow/);
assert.match(parse(fighter,'I attack it with my warhammer').error,/You don't carry a warhammer\. You have: Greatsword/);
same(parse(bare,'I attack').action,{type:'encounter-attack',weapon:'Unarmed Strike'},'No weapon: unarmed');
same(parse(fighter,'Kill Tobin',story).action,{type:'npc-attack',target:'mara',weapon:'Greatsword'});
// Quick actions: bare hands only lead when there is nothing else.
assert.ok(!r.quickActions(fighter,inFight).some(a=>a.weapon==='Unarmed Strike'));
const bareChip=r.quickActions(bare,inFight)[0];assert.equal(bareChip.weapon,'Unarmed Strike');assert.equal(bareChip.label,'Unarmed');assert.equal(bareChip.primary,true);
// Fists and bows resolve in the engine (the opening shot has no disadvantage; a later one does).
const shot=r.adventureStep(fight,{current:10,temp:0},rogue,{type:'encounter-attack',weapon:'Shortbow'},()=>0.5);assert.equal(shot.error,undefined);assert.ok(shot.events.some(t=>t.startsWith('You use Shortbow: d20 [11] (normal)')));
// The Rogue has mastered the shortbow (Vex): a hit that hurts gives the next shot advantage, which cancels the
// disadvantage of shooting with the foe beside you. Without it, the close shot has disadvantage.
if(shot.game.vex){const vexed=r.adventureStep(shot.game,shot.health,rogue,'attack:Shortbow',()=>0.5);assert.ok(vexed.events.some(t=>t.startsWith('You use Shortbow: d20 [11] (normal, Vex)')),vexed.events.join(' | '));}
const plainShot={...shot.game};delete plainShot.vex;
const close=r.adventureStep(plainShot,shot.health,rogue,'attack:Shortbow',()=>0.5);assert.ok(close.events.some(t=>t.startsWith('You use Shortbow: d20 [11, 11] (disadvantage)')));
const punch=r.adventureStep(inFight,{current:12,temp:0},fighter,'attack:Unarmed Strike',()=>0.99);assert.ok(punch.events.includes('4 bludgeoning damage (1 +3).'));
// Spells at a loosely named foe ("the bandit", "him") are rolled by the engine, not sent for a manual ruling.
const wiz=r.readyHero('wizard'),wfight=r.hostileEncounterGame(wiz,r.newAdventure(wiz),()=>0);
for(const target of ['the bandit','him','the Bandit Cutthroat']){const cast=r.dmCommand(wiz,wfight,'I cast Fire Bolt at '+target,null);assert.equal(cast.action?.type,'spell',target);assert.equal(cast.action.request.forceDM,false,target);const step=r.adventureStep(wfight,null,wiz,cast.action,()=>0.9);assert.equal(step.waiting,undefined,target);assert.ok(step.game.enemyHP<wfight.enemyHP,target);}
// Obvious shortenings that fit one known spell resolve at once; anything vaguer goes to the DM.
for(const [said,id] of [['I cast FB at the bandit','fire-bolt'],['I cast mm at him','missile'],['I cast missiles at the bandit','missile'],['I cast frost at it','ray-of-frost']])assert.equal(r.dmCommand(wiz,wfight,said,null).action?.request?.id,id,said);
assert.match(r.dmCommand(wiz,wfight,'I cast a spell at the bandit',null).error,/Name one of your prepared spells/);
// The DM sees what the hero carries.
{const told=r.dmContext(rogue,inFight,{current:10,temp:0}).attackOptions;same({mainWeapon:told.mainWeapon,carried:told.carried,unarmed:told.unarmed},{mainWeapon:'Shortsword',carried:['Shortsword','Dagger','Shortbow (ranged)'],unarmed:'Unarmed Strike'});
 // A Rogue masters two kinds: the main weapon and the bow (Weapon Mastery); grappling and two weapons are explained.
 same(told.masteries.map(m=>m.split(':')[0]),['Shortsword','Shortbow']);assert.match(told.grappleAndShove,/DC \d+/);assert.match(told.twoWeapons,/light weapon/);}
// ---- Fortune near death (survivalOdds): never told, only the roll that counts is written down ----
const seeded=seed=>{let x=(seed*48271+12345)%2147483647;return ()=>(x=(x*16807)%2147483647)/2147483647;};
{const roll={dice:[6],total:7},low={dice:[1],total:2};
 same(r.sparedBlow(roll,{current:5},()=>low,()=>0.4),low,'a blow that would drop the hero is sometimes rolled again, the lower kept');
 same(r.sparedBlow(roll,{current:5},()=>low,()=>0.6),roll,'and sometimes not');
 same(r.sparedBlow(roll,{current:9},()=>low,()=>0),roll,'a blow that leaves them standing is never touched');
 same(r.sparedBlow(roll,{current:3,temp:5},()=>low,()=>0),roll,'temporary hit points count');
 same(r.sparedBlow({dice:[1],total:2},{current:2},()=>roll,()=>0),{dice:[1],total:2},'the second roll is kept only when lower');}
const words=/\b(luck|lucky|fortune|reroll|re-roll|rolled again|spared|mercy)\b/i;
const damageLine=/^(\d+)d(\d+) \[([\d, ]+)\] \+ (\d+) = (\d+) \w+ damage\./;
const odds={...r.survivalOdds};
function trial(seed){
 // The hero at 3 HP takes the Dodge; the bandit strikes back. Did it drop them, and is every line consistent?
 const step=r.adventureStep(open,{current:3,temp:0},fighter,'dodge',seeded(seed));
 for(const line of step.events){assert.ok(!words.test(line),'never told: '+line);const m=line.match(damageLine);if(m){const sum=m[3].split(', ').reduce((a,b)=>a+Number(b),0);assert.equal(Number(m[5]),Math.max(1,sum+Number(m[4])),'the dice shown add up: '+line);}
  const d=line.match(/^Death saving throw: d20 \[(\d+)\] = (\d+)/);if(d)assert.equal(d[1],d[2]);}
 return step;
}
function dropRate(n){let drops=0;for(let i=1;i<=n;i++)if(trial(i).game.stage!=='combat')drops++;return drops/n;}
const plain=(()=>{r.survivalOdds.blow=0;r.survivalOdds.save=0;try{return dropRate(400);}finally{Object.assign(r.survivalOdds,odds);}})(),lucky=dropRate(400);
assert.ok(lucky<plain,'fortune near death keeps a hero standing more often ('+lucky+' vs '+plain+')');assert.ok(lucky>plain*0.5,'but a blow can still drop them ('+lucky+' vs '+plain+')');
// The same dice give the same turn, so a campaign server and a device agree.
same(r.adventureStep(open,{current:3,temp:0},fighter,'dodge',seeded(77)),r.adventureStep(open,{current:3,temp:0},fighter,'dodge',seeded(77)));
// Death saves: a failed save is now and then rolled again (the better kept). Dying is still dangerous.
function deathRate(n){let dead=0;for(let i=1;i<=n;i++){let st={game:down.game,health:down.health};const rnd=seeded(i*7+3);for(let k=0;k<12&&st.game.stage==='dying';k++){st=r.adventureStep(st.game,st.health,fighter,'death-save',rnd);for(const line of st.events??[])assert.ok(!words.test(line),line);}if(st.game.stage==='dead')dead++;}return dead/n;}
const savesPlain=(()=>{r.survivalOdds.save=0;try{return deathRate(400);}finally{Object.assign(r.survivalOdds,odds);}})(),savesLucky=deathRate(400);
assert.ok(savesLucky<savesPlain&&savesLucky>0.15,'death saves are a touch kinder, never safe ('+savesLucky+' vs '+savesPlain+')');
// Nothing the Dungeon Master or the player reads names it.
for(const f of ['dmContext.js','turnResourceRules.js','dmChoiceRules.js','dmSceneRules.js','dm-server.cjs','dm-instructions.cjs','dm-rules.cjs','descriptions.js','legalText.js','feedbackRules.js','chronicleRules.js','loadingRules.js'])assert.ok(!/survivalOdds|sparedBlow/.test(fs.readFileSync(f,'utf8')),f+' never mentions the hidden luck');

// ---- Bringing the dead back, or laying them to rest ----
const deadGame=s.game;
assert.equal(r.deathIsFinal(deadGame,fighter),true,'alone, a dead hero cannot be brought back');same(r.revivalOptions(deadGame,fighter),[]);same(r.boughtRevivals(deadGame,fighter),[],'nothing is sold yet');
assert.equal(r.validAdventure(r.adventureSnapshot(fighter,{...deadGame,death:{...deadGame.death,where:'x'.repeat(81)}},s.health,true),fighter),false,'the place of a fall is short');
// A companion trained as a Cleric of level 5 can speak Revivify, if there is a 300 gp diamond's worth of gold.
const withCleric=(gold,level=5)=>({...deadGame,followers:{mara:{status:'following',location:'inn',reason:'Test.',terms:''}},npcClasses:{mara:{class:'Cleric',level}},pack:{...(deadGame.pack??{items:[],spent:{}}),gold}});
assert.ok(valid(fighter,withCleric(350),s.health));
same(r.revivalOptions(withCleric(350,4),fighter),[],'a cleric below 5th level does not know it');
const short=r.revivalOptions(withCleric(120),fighter);assert.equal(short.length,1);assert.equal(short[0].ready,false);assert.match(short[0].short,/300 gp/);assert.equal(r.deathIsFinal(withCleric(120),fighter),true,'without the diamond, death is final');
same(r.dmChoices(fighter,withCleric(120)),[]);assert.match(r.adventureStep(withCleric(120),s.health,fighter,{type:'revive',by:'mara'}).error,/300 gp/);
assert.equal(r.deathIsFinal(withCleric(350),fighter),false);same(r.dmChoices(fighter,withCleric(350)).map(c=>c.id),['revive:mara']);same(r.quickActions(fighter,withCleric(350)),[],'asked from the epitaph, not a chip');
const back=r.adventureStep(withCleric(350),s.health,fighter,{type:'revive',by:'mara'});
assert.equal(back.error,undefined,back.error);assert.equal(back.game.stage,'bridge','back where they fell');same(back.health,{current:1,temp:0});assert.equal(back.game.pack.gold,50,'the diamond is paid');assert.equal(back.game.death,undefined);
assert.ok(back.events[0].includes('Revivify'));assert.ok(valid(fighter,back.game,back.health));assert.equal(back.game.journal.entries.at(-1).title,'Brought back');
assert.match(r.adventureStep(withCleric(350),s.health,fighter,{type:'revive',by:'keeper'}).error,/Nobody here/);
assert.match(r.adventureStep(withCleric(350),s.health,fighter,'long-rest').error,/has died/,'nothing else while dead');
// Laid to rest: a memorial line only, never a save to play again.
const grave=r.graveEntry(fighter,deadGame,Date.UTC(2026,9,11));assert.equal(grave.character,undefined,'no sheet in a grave');assert.ok(r.validGrave(grave));
same(Object.keys(grave).sort(),['at','cause','class','level','name','place','species','story']);
assert.ok(r.validGrave({...grave,character:JSON.stringify(fighter)}),'graves from before are still read');
const entry={id:'x1',character:JSON.stringify(fighter)},rested=r.layToRest([entry,{id:'x2',character:'{}'}],[],fighter,deadGame,Date.UTC(2026,9,11));
same(rested.roster.map(e=>e.id),['x2'],'out of the roster');assert.equal(rested.graves.length,1);
same(r.layToRest(rested.roster,rested.graves,fighter,deadGame).graves.length,1,'one grave for one fall');
same(r.setAside([],[],fighter,deadGame,s.health,true).graves.map(g=>g.name),[fighter.name]);
// At a shared table: a hero who knows Revivify, with a slot of 3rd level and 300 gp, brings a friend back while the
// party is still where they fell; never mid-fight, never later.
{const entry=r.readyHeroes.find(h=>h.key==='cleric'),cleric=r.makeCharacter({...r.blankBuild(),...entry.form,level:5,plannedSubclass:'Life Domain',advancements:[],spellSelectionVersion:2});
 assert.ok(r.knownSpells(cleric).some(sp=>sp.id==='revivify'),'a Life cleric of 5th level knows Revivify');
 const camp={...r.newAdventure(cleric),pack:{gold:400,items:[],spent:{}}},where=r.mapLocation(camp);
 let table=r.startParty(r.adventureSnapshot(cleric,camp,{current:20,temp:0},true),'A','Sam');
 table=r.joinParty(table,'B',{character:JSON.stringify(fighter),game:null,health:null,name:'Jo'}).snapshot;
 table=r.partyView(table,'A');
 const death=where2=>({cause:'Slain by the Bandit Cutthroat',place:'The road',at:'bridge',massive:false,where:where2});
 const withDead=(where2,patch={})=>{const t=JSON.parse(JSON.stringify(table));t.game.party.members.B={...t.game.party.members.B,status:'dead',health:{current:0,temp:0},hero:{...t.game.party.members.B.hero,death:death(where2)}};t.game={...t.game,...patch};return t;};
 const t=withDead(where);assert.ok(r.validAdventure(t,cleric),'a party with a fallen friend is valid');
 assert.ok(r.dmChoices(cleric,t.game,t.health).some(c=>c.id==='revive:party:B'));const chip=r.quickActions(cleric,t.game,t.health).find(a=>a.key==='revive:party:B');assert.ok(chip,'a Revivify chip');assert.equal(chip.label,'Revivify Death');
 same(r.dmCommand(cleric,t.game,'I cast Revivify on Death tester',t.health).action,chip.action,'typed, the same move');
 assert.match(r.dmCommand(cleric,withDead('elsewhere').game,'I cast Revivify on Death tester',t.health).error,/too late/);
 const raised=r.adventureStep(t.game,t.health,cleric,chip.action,()=>0.5);assert.equal(raised.error,undefined,raised.error);
 const B=raised.game.party.members.B;assert.equal(B.status,'up');same(B.health,{current:1,temp:0});assert.equal(B.hero.death,undefined);assert.equal(raised.game.pack.gold,100);assert.equal(r.slotUsed(raised.game,3),1,'a 3rd-level slot');
 const after=r.adventureSnapshot(cleric,raised.game,raised.health,true);assert.ok(r.validAdventure(after,cleric));assert.notEqual(r.partyView(after,'B').game.stage,'dead','the fallen friend stands again on their own device');
 assert.match(r.adventureStep(withDead('elsewhere').game,t.health,cleric,chip.action).error,/too late/,'only where they fell');
 assert.match(r.adventureStep(withDead(undefined).game,t.health,cleric,chip.action).error,/too late/,'a fall from before this has no moment left');
 assert.match(r.adventureStep(withDead(where,{pack:{gold:120,items:[],spent:{}}}).game,t.health,cleric,chip.action).error,/300 gp/);
 const plainCleric=r.readyHero('cleric');assert.ok(!r.dmChoices(plainCleric,withDead(where).game,t.health).some(c=>c.id.startsWith('revive:')),'a 1st-level cleric cannot');
 assert.equal(r.deathIsFinal(r.partyView(t,'B').game,fighter),false,'a hero at a table is never laid to rest by the rules');}
// The device lays a hero to rest when death is final, and leaves them out of every save from then on.
{const app=['App.js','useHeroSaves.js'].map(f=>fs.readFileSync(f,'utf8')).join(' ');for(const piece of ['deathIsFinal(game,hero)','layToRest(','forgetAdventure()','forgetCharacter()','restingRef.current===JSON.stringify(hero)'])assert.ok(app.includes(piece),'App.js lays the dead to rest: '+piece);
 const adv=fs.readFileSync('Adventure.js','utf8');for(const piece of ['revivalOptions(','Begin a new hero','onLetGo'])assert.ok(adv.includes(piece),'the epitaph: '+piece);}
// ---- Words while dying are answered by the game (2026-10-22, the project review: each one cost a request) ----
// Anything typed that is not a death save gets a short line pointing at the Death save, seeded and varied, with no
// request, on a device and at a table; a death save still rolls; out of character still reaches the Dungeon Master.
{const rr=require('./rules-engine.cjs').rules(),{resolveTurn}=require('./server-turn.cjs'),hero=rr.readyHero('fighter');
 const fightG={...rr.hostileEncounterGame(hero,rr.newAdventure(hero),()=>0),potions:0,resources:{wind:2},openingAttackAvailable:false};
 const fallen=rr.adventureStep(fightG,{current:1,temp:0},hero,'dodge',()=>0.9);assert.equal(fallen.game.stage,'dying');
 const told=rr.dyingTelling({hero,game:fallen.game});assert.ok(told&&/Death save/.test(told.narration)&&told.told==='game',JSON.stringify(told));
 assert.equal(rr.dyingTelling({hero,game:fightG}),null,'only while dying');
 const seen=new Set(Array.from({length:12},(_,i)=>rr.dyingTelling({hero,game:{...fallen.game,playback:[{id:i+2,npcId:null,events:[{kind:'narration',text:'x'}]}]}}).narration));assert.ok(seen.size>=4,'varied');
 assert.notEqual(rr.dyingTelling({hero,game:{...fallen.game,playback:[...(fallen.game.playback??[]),{id:99,npcId:null,told:'game',events:[{kind:'narration',text:told.narration}]}]}}).narration,told.narration,'never the line just said');
 for(const l of vm.runInNewContext(rulesSource()+'\n(dyingLines)',{AsyncStorage:{}})){const [solo,twin]=l.split('|');assert.ok(twin&&twin.includes('{hero}')&&!/\byou\b|\byour\b/i.test(twin),'a twin told of the hero: '+l);assert.ok(/Death save/.test(solo)&&/Death save/.test(twin));}
 const src=fs.readFileSync('useDmTurn.js','utf8');assert.ok(src.indexOf('dyingTelling({hero,game})')>0&&src.indexOf('dyingTelling({hero,game})')<src.indexOf("const body=await request(game,health,command?.error?{castingIssue:command.error}:{});"),'a device answers before any request');
 let asked=0;const ask=async()=>{asked++;return {narration:'The Dungeon Master answers.',suggestions:[]};};
 (async()=>{const snap=rr.adventureSnapshot(hero,fallen.game,fallen.health,true);
  const said=await resolveTurn(snap,{question:'Tobin, help me!'},{ask,randomImpl:()=>.5});assert.equal(asked,0,'no request at the table');assert.match(said.narration,/Death save/);assert.equal(said.turn.told,'game');assert.equal(said.snapshot.game.stage,'dying','nothing changes');
  const save=await resolveTurn(snap,{question:'I fight to hold on.'},{ask,randomImpl:()=>.5});assert.ok(save.events.some(t=>/death sav/i.test(t)),'a death save still rolls: '+save.events.join(' | '));
  await resolveTurn(snap,{question:'DM, can I still be saved?'},{ask,randomImpl:()=>.5});assert.equal(asked,1,'out of character still reaches the Dungeon Master');
 })().catch(e=>{console.error(e);process.exit(1);});}
console.log('Passed: falling and death saves (natural 1 and 20, stable, dead), outright death, protected dead saves, foes slain or beaten, NPCs killed, knocked out and finished off, and attacks by any wording with main weapon, named weapon, fists or bow; fortune near death (unseen, consistent dice, same on every device), Revivify by a companion or a friend at the table, and the dead laid to rest as a memorial line. Fortune near death: a blow at 3 HP drops the hero '+Math.round(100*lucky)+'% of the time instead of '+Math.round(100*plain)+'%, and '+Math.round(100*savesLucky)+'% of the dying die instead of '+Math.round(100*savesPlain)+'%.');
