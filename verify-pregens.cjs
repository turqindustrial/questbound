const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Every ready-made hero passes the same checks as a hand-built one and can play a turn at once.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','adventureRules.js','skillRules.js','storyRules.js','followerRules.js','adventureStorage.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','sceneTriggers.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHeroes,readyHero,isValidCharacter,buildError,spellSelectionError,combatBasics,hostileEncounterGame,newAdventure,adventureSnapshot,validAdventure,quickActions,spellActions,adventureStep,dmCommand})',{AsyncStorage:{}});
assert.equal(r.readyHeroes.length,4);
const classes=new Set();
for(const entry of r.readyHeroes){
 const hero=r.readyHero(entry.key);classes.add(hero.class);
 assert.equal(r.buildError(hero),'',entry.key+' build');assert.equal(r.spellSelectionError(hero),'',entry.key+' spells');assert.ok(r.isValidCharacter(hero),entry.key+' saves');
 const stats=r.combatBasics(hero);assert.ok(stats.available&&stats.hp>=6&&stats.ac>=11,entry.key+' can fight: '+JSON.stringify({hp:stats.hp,ac:stats.ac}));
 assert.ok(hero.description.length>20&&hero.backstory.length>40,entry.key+' has a personality');
 // Straight into the combat test: a snapshot saves, and the first action chip resolves.
 const game=r.hostileEncounterGame(hero,r.newAdventure(hero),()=>.4);assert.ok(r.validAdventure(r.adventureSnapshot(hero,game,null,true),hero),entry.key+' adventure saves');
 const first=r.quickActions(hero,game).find(q=>q.action);const step=r.adventureStep(game,null,hero,first.action,()=>.6);assert.ok(!step.error,entry.key+' '+first.key+': '+step.error);
}
assert.deepEqual([...classes].sort(),['Cleric','Fighter','Rogue','Wizard']);
// The casters can cast a combat spell on the foe straight away.
for(const [key,spell] of [['wizard','Fire Bolt'],['cleric','Sacred Flame']]){const hero=r.readyHero(key),game=r.hostileEncounterGame(hero,r.newAdventure(hero),()=>.4);const cast=r.dmCommand(hero,game,'I cast '+spell+' on the enemy');assert.ok(cast?.action&&!cast.error,key+' casts '+spell+': '+JSON.stringify(cast));const step=r.adventureStep(game,null,hero,cast.action,()=>.6);assert.ok(!step.error,step.error);}
// The Cast… picker: in a fight every offered spell is a complete sentence the rules accept; out of a fight, targeted
// spells start the sentence and self spells cast at once.
for(const key of ['wizard','cleric']){
 const hero=r.readyHero(key),fight=r.hostileEncounterGame(hero,r.newAdventure(hero),()=>.4),spells=r.spellActions(hero,fight);
 assert.ok(spells.length>=5,key+' spell list');assert.equal(spells[0].detail,'Cantrip','Cantrips first');
 for(const spell of spells.filter(s=>s.question)){const cast=r.dmCommand(hero,fight,spell.question);assert.ok(cast?.action&&!cast.error,key+' '+spell.question+' → '+JSON.stringify(cast?.error));const step=r.adventureStep(fight,null,hero,cast.action,()=>.6);assert.ok(!step.error,spell.question+': '+step.error);if(/ at /.test(spell.question)){assert.ok(!step.waiting,spell.question+' resolves by the rules, without waiting for a DM ruling');assert.ok((step.events??[]).length>0,spell.question+' does something');}}
 assert.ok(spells.filter(s=>s.question).length>=4,key+' has several one-tap spells');
 assert.ok(!spells.some(s=>/Burning Hands on me|Thunderwave on me/.test(s.question??'')),'Area blasts are never aimed at yourself');
 const calm=r.spellActions(hero,{...fight,stage:'inn'});assert.ok(calm.some(s=>s.prefill&&/ on $/.test(s.prefill)),'Targeted spells start the sentence out of combat');
}
// A fragile wizard meets a single foe in the combat test; sturdier heroes can still meet packs.
const wiz=r.readyHero('wizard'),fighterHero=r.readyHero('fighter');
for(let i=0;i<40;i++){const g=r.hostileEncounterGame(wiz,r.newAdventure(wiz),()=>i/40);assert.ok(!g.story.foeStats.group&&!/Orc/.test(g.story.foe),'Wizard foe '+g.story.foe);}
assert.ok(Array.from({length:40},(_,i)=>r.hostileEncounterGame(fighterHero,r.newAdventure(fighterHero),()=>i/40)).some(g=>g.story.foeStats.group),'Fighters still meet packs');
// The opening Fire Bolt flies before the foe closes in (no close-range disadvantage); once it is adjacent, the penalty applies.
const bolt=r.hostileEncounterGame(wiz,r.newAdventure(wiz),()=>.1),openingCast=r.dmCommand(wiz,bolt,'I cast Fire Bolt at the enemy.');
const opened=r.adventureStep(bolt,null,wiz,openingCast.action,()=>.5);const firstRoll=opened.events.find(t=>/^Fire Bolt: d20/.test(t));
assert.match(firstRoll,/\(normal\)/,'Opening shot: '+firstRoll);
if(opened.game.stage==='combat'){const again=r.adventureStep(opened.game,opened.health,wiz,r.dmCommand(wiz,opened.game,'I cast Fire Bolt at the enemy.').action,()=>.5);assert.match(again.events.find(t=>/^Fire Bolt: d20/.test(t)),/\(disadvantage\)/,'Adjacent foe: ranged spell at disadvantage');}
assert.equal(r.spellActions(r.readyHero('fighter'),r.hostileEncounterGame(r.readyHero('fighter'),r.newAdventure(r.readyHero('fighter')),()=>.4)).length,0,'No spells, no picker');
console.log('Passed: the Cast… picker offers each caster complete, rules-accepted spells in a fight. Passed: four ready-made heroes (Fighter, Rogue, Wizard, Cleric) pass every character check, save with an adventure, act on their first turn, and the casters cast at once.');
