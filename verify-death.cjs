const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Killing and dying: death saving throws, outright death, a dead hero's save, NPCs killed or knocked out, the story
// foe slain or beaten, and attacks in any wording (main weapon, named weapon, bare hands, a bow).
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','adventureRules.js','skillRules.js','storyRules.js','followerRules.js','adventureStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','quickActions.js','characterStorage.js','pregens.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({adventureStep,newAdventure,validAdventure,adventureSnapshot,equipmentFor,attackOptions,unarmedStrike,rangedMode,rollDamage,dmCommand,dmChoices,commitDmTurn,hostileEncounterGame,quickActions,storyText,withAttackIntent,npcScene,dmContext,readyHero})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const make=(cls,patch={})=>{const h={name:'Death tester',class:cls,species:'Human',level:1,scores:{Strength:16,Dexterity:14,Constitution:14,Intelligence:10,Wisdom:12,Charisma:10},spells:[],...patch};h.equipment=r.equipmentFor(h);return h;};
const fighter=make('Fighter'),valid=(hero,g,h)=>r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(g)),h,true),hero);
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const seq=values=>{let i=0;return ()=>values[i++]??0.5;};

// ---- Falling, death saves, death ----
const fight=r.hostileEncounterGame(fighter,r.newAdventure(fighter),()=>0),open={...fight,openingAttackAvailable:false};
let down=r.adventureStep(open,{current:1,temp:0},fighter,'dodge',()=>0.9);
assert.equal(down.game.stage,'dying');assert.equal(down.health.current,0);same({...down.game.dying},{successes:0,failures:0,place:'bridge',cause:'Slain by the Bandit Cutthroat',placeName:'Overgrown Roadside'});
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
const massive=r.adventureStep(open,{current:1,temp:0},fighter,'dodge',()=>0.99);
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
const close=r.adventureStep(shot.game,shot.health,rogue,'attack:Shortbow',()=>0.5);assert.ok(close.events.some(t=>t.startsWith('You use Shortbow: d20 [11, 11] (disadvantage)')));
const punch=r.adventureStep(inFight,{current:12,temp:0},fighter,'attack:Unarmed Strike',()=>0.99);assert.ok(punch.events.includes('4 bludgeoning damage (1 +3).'));
// Spells at a loosely named foe ("the bandit", "him") are rolled by the engine, not sent for a manual ruling.
const wiz=r.readyHero('wizard'),wfight=r.hostileEncounterGame(wiz,r.newAdventure(wiz),()=>0);
for(const target of ['the bandit','him','the Bandit Cutthroat']){const cast=r.dmCommand(wiz,wfight,'I cast Fire Bolt at '+target,null);assert.equal(cast.action?.type,'spell',target);assert.equal(cast.action.request.forceDM,false,target);const step=r.adventureStep(wfight,null,wiz,cast.action,()=>0.9);assert.equal(step.waiting,undefined,target);assert.ok(step.game.enemyHP<wfight.enemyHP,target);}
// Obvious shortenings that fit one known spell resolve at once; anything vaguer goes to the DM.
for(const [said,id] of [['I cast FB at the bandit','fire-bolt'],['I cast mm at him','missile'],['I cast missiles at the bandit','missile'],['I cast frost at it','ray-of-frost']])assert.equal(r.dmCommand(wiz,wfight,said,null).action?.request?.id,id,said);
assert.match(r.dmCommand(wiz,wfight,'I cast a spell at the bandit',null).error,/Name one of your prepared spells/);
// The DM sees what the hero carries.
same({...r.dmContext(rogue,inFight,{current:10,temp:0}).attackOptions},{mainWeapon:'Shortsword',carried:['Shortsword','Dagger','Shortbow (ranged)'],unarmed:'Unarmed Strike'});
console.log('Passed: falling and death saves (natural 1 and 20, stable, dead), outright death, protected dead saves, foes slain or beaten, NPCs killed, knocked out and finished off, and attacks by any wording with main weapon, named weapon, fists or bow.');
