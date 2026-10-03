const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Loads the rules the way the other checks do, plus the story modules and the quick-action builder.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','adventureRules.js','skillRules.js','storyRules.js','followerRules.js','adventureStorage.js','deedRules.js','dmCommands.js','dmContext.js','playbackRules.js','sceneTriggers.js','hostileEncounter.js','iconPaths.js','quickActions.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({quickActions,dmChoices,hostileEncounterGame,hostileFoes,newAdventure,adventureStep,commitDmTurn,equipmentFor,combatBasics,validAdventure,adventureSnapshot})',{AsyncStorage:{}});
const make=(cls,scores,spells=[])=>{const hero={name:'Chip tester',class:cls,species:'Human',level:1,background:'Soldier',scores,spells};hero.equipment=r.equipmentFor(hero);return hero;};
const fighter=make('Fighter',{Strength:16,Dexterity:12,Constitution:14,Intelligence:10,Wisdom:12,Charisma:10});
const pick=key=>()=>(r.hostileFoes.findIndex(f=>f.key===key)+.5)/r.hostileFoes.length;
const bandit=r.hostileEncounterGame(fighter,r.newAdventure(fighter),pick('bandit'));
const keys=list=>list.map(q=>q.key);
// In combat: weapon attacks lead, then dodge, retreat and the potion. Nothing that belongs elsewhere.
const health={current:6,temp:0};
const combat=r.quickActions(fighter,bandit,health);
assert.ok(combat[0].primary&&/^attack:/.test(combat[0].key),'An attack is the first chip in combat: '+keys(combat));
assert.equal(combat[0].question,'I attack with my '+combat[0].label+'.');
for(const k of ['dodge','flee','potion'])assert.ok(keys(combat).includes(k),k+' in combat');
assert.equal(combat.filter(q=>q.primary).length,1,'Only the main weapon is highlighted');
assert.equal(combat[1].key,'attack-menu','Attack… sits right beside the main weapon; the other weapons are in it');assert.equal(combat.filter(q=>q.weapon).length,1,'one weapon chip in the row');
assert.ok(!combat.some(q=>q.destination),'No travel while fighting');
assert.ok(!combat.some(q=>/^(npc-attack|story-complete|restart-adventure)/.test(q.key)),'No attacks on townsfolk or story endings as chips');
assert.ok(!keys(combat).includes('cast'),'A Fighter without spells has no Cast chip');
// After a win with nothing to recover (health null is full hit points) no rest is offered that the engine would refuse; hurt, a short rest is.
{const won={...bandit,stage:'victory',enemyHP:0};assert.ok(!keys(r.quickActions(fighter,won,null)).includes('short-rest'),'no short rest at full health');assert.ok(!r.dmChoices(fighter,won,null).some(c=>c.id==='short-rest'));
 assert.ok(keys(r.quickActions(fighter,won,{current:6,temp:0})).includes('short-rest'),'a short rest when hurt');
 for(const q of r.quickActions(fighter,won,null)){const s=r.adventureStep(won,null,fighter,q.action,()=>.5);assert.ok(!s.error,q.key+' at full health after a win: '+s.error);}}
// Bonus actions say so, End turn waits at the end of the row, and a hero at full health is not offered healing.
assert.equal(combat.at(-1).key,'end-turn');assert.equal(combat.find(q=>q.key==='potion').detail,'Bonus');assert.equal(combat.find(q=>q.key==='class:wind').detail,'Bonus');
assert.ok(!keys(r.quickActions(fighter,bandit,{current:12,temp:0})).some(k=>['potion','class:wind'].includes(k)),'Nothing to heal at full health');
// Every combat chip resolves through the same engine path as a typed action, and through the DM commit.
for(const q of combat.filter(q=>q.action)){
 const step=r.adventureStep(bandit,health,fighter,q.action,()=>.6);assert.ok(!step.error,q.key+': '+step.error);assert.ok((step.events??[]).length>0,q.key+' produces events');
 const turn=r.commitDmTurn(fighter,bandit,health,q.action,{question:q.question,narration:'Your action is resolved below.'},()=>.6);assert.ok(!turn.error,q.key+' commits: '+turn.error);
}
// Win the fight: travel chips appear, named after the story's places, and travelling works.
// Once the action is spent, End turn leads (gold) and only bonus actions stay beside it.
const spent=r.adventureStep({...bandit,openingAttackAvailable:false},health,fighter,'dodge',()=>.01);assert.equal(spent.game.actionUsed,true);
const waiting=r.quickActions(fighter,spent.game,spent.health);assert.equal(waiting[0].key,'end-turn');assert.equal(waiting[0].primary,true);assert.equal(JSON.stringify(keys(waiting).sort()),'["class:wind","end-turn","potion"]');
for(const q of waiting){const s=r.adventureStep(spent.game,spent.health,fighter,q.action,()=>.01);assert.ok(!s.error,q.key+': '+s.error);assert.equal(s.game.actionUsed,undefined,q.key+' ends the turn');assert.equal(s.game.round,spent.game.round+1);}
let game=bandit,hp=health;for(let i=0;i<24&&game.stage==='combat';i++){const s=r.adventureStep(game,hp,fighter,game.actionUsed?'end-turn':combat[0].action,()=>.95);game=s.game;hp=s.health;}
assert.notEqual(game.stage,'combat','The bandit falls to repeated hits');
const after=r.quickActions(fighter,game),trips=after.filter(q=>q.destination);
assert.ok(trips.length>=1,'Travel chips after the fight: '+keys(after));
for(const q of trips){assert.equal(q.label,game.story.locations[q.destination].name);assert.equal(q.question,'I travel to '+q.label+'.');const s=r.adventureStep(game,hp,fighter,q.action,()=>.5);assert.ok(!s.error,q.key+': '+s.error);}
assert.ok(!after.some(q=>q.key==='dungeon:enter'),'No crossroads dungeon chip inside a written story');
// Travel is only offered when the rules allow it. The crossroads keeper's errand gates the old adventure;
// a written story never strands its hero at camp (older level-ups left such saves behind), and still saves validly.
const crossroads=r.newAdventure(fighter);
assert.ok(!r.quickActions(fighter,crossroads).some(q=>q.destination),'Crossroads: no travel before the keeper is heard');
const camp={...game,stage:'inn',map:{visited:['inn'],accepted:false,clue:false,peaceful:false,minutes:0},npcMemory:undefined};
const leave=r.quickActions(fighter,camp).filter(q=>q.destination);
assert.ok(leave.length>=2,'Story camp: travel chips even after an old level-up');
const moved=r.adventureStep(camp,hp,fighter,leave[0].action,()=>.5);assert.ok(!moved.error,moved.error);
assert.ok(r.validAdventure(r.adventureSnapshot(fighter,moved.game,moved.health,true),fighter),'The journey saves as a valid adventure');
// The crossroads adventure keeps its vault, with short labels that resolve.
const legacy={...r.newAdventure(fighter),stage:'bridge',enemyHP:0},vault=r.quickActions(fighter,legacy).find(q=>q.key==='dungeon:enter');
assert.equal(vault?.label,'Enter the vaults');
const entered=r.adventureStep(legacy,health,fighter,vault.action,()=>.5);assert.ok(!entered.error,entered.error);
const inside=r.quickActions(fighter,entered.game);assert.ok(inside.some(q=>q.key==='dungeon:leave'&&q.label==='Leave the vaults'),'Vault chips: '+keys(inside));
for(const q of inside.filter(q=>q.action)){const s=r.adventureStep(entered.game,health,fighter,q.action,()=>.5);assert.ok(!s.error,q.key+': '+s.error);}
// Casters get a Cast… chip that starts the sentence instead of sending it.
const wizard=make('Wizard',{Strength:8,Dexterity:14,Constitution:14,Intelligence:16,Wisdom:12,Charisma:10},['fire-bolt','magic-missile']);
const cast=r.quickActions(wizard,r.hostileEncounterGame(wizard,r.newAdventure(wizard),pick('bandit'))).find(q=>q.key==='cast');
assert.ok(cast&&cast.prefill==='I cast '&&!cast.action,'Casters get a Cast… prefill chip');
// A spell waiting on a ruling offers only the way out.
assert.equal(JSON.stringify(keys(r.quickActions(fighter,{...bandit,pendingSpell:{id:'fire-bolt'}}))),'["cancel-spell"]');
console.log('Passed: combat chips (attack first, dodge, retreat, potion) resolve through the engine and the DM commit; travel chips use story place names, follow the travel rules (stories never strand a hero at camp) and save validly; vault chips stay in the crossroads adventure with short labels; casters get Cast…; pending spells offer only Cancel.');
