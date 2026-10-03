const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Developer options: a hero's level and ability scores set freely for testing. Such a hero passes the same checks as
// any other (saves, spells for their level, equipment), fights with their level's hit points, and still improves
// when they level up afterwards.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','adventureRules.js','skillRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','worldArtRules.js','iconPaths.js','quickActions.js','pregens.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHeroes,blankBuild,buildError,finalScores,makeCharacter,validDevScores,isValidCharacter,combatBasics,spellSelectionError,spellLimits,spellsForClass,attacksPerAction,newAdventure,hostileEncounterGame,adventureStep,validAdventure,adventureSnapshot,foeStatsFor,hostileFoes})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const form=key=>({...r.blankBuild(),...r.readyHeroes.find(h=>h.key===key).form,level:1,advancements:[],spellSelectionVersion:2});
const all=n=>({Strength:n,Dexterity:n,Constitution:n,Intelligence:n,Wisdom:n,Charisma:n});
// ---- Scores: free, within 1 to 20 ----
assert.ok(r.validDevScores(all(20)));assert.ok(r.validDevScores({...all(10),Strength:1}));
for(const bad of [null,[],{...all(10),Strength:21},{...all(10),Strength:0},{...all(10),Strength:9.5},{Strength:10},{...all(10),Luck:10}])assert.ok(!r.validDevScores(bad),JSON.stringify(bad));
const kara=form('fighter');
same(r.finalScores(kara),{Strength:17,Dexterity:13,Constitution:15,Intelligence:8,Wisdom:12,Charisma:10},'The usual rules without developer scores');
const strong={...kara,devScores:{...all(20),Intelligence:3},devLevel:5,level:5};
assert.equal(r.buildError(strong),'');same(r.finalScores(strong),{...all(20),Intelligence:3});
assert.match(r.buildError({...kara,devScores:{...all(10),Strength:25}}),/1 to 20/);assert.match(r.buildError({...kara,devLevel:0}),/developer level/);
// ---- A level-5 fighter with 20s: a valid character, with level-5 hit points and two attacks ----
const hero=r.makeCharacter(strong);
assert.equal(hero.level,5);same(hero.scores,{...all(20),Intelligence:3});assert.ok(r.isValidCharacter(hero));
assert.equal(r.combatBasics(hero).hp,10+5+4*(6+5));assert.equal(r.combatBasics(hero).proficiency,3);assert.equal(r.attacksPerAction(hero),2);
assert.ok(r.isValidCharacter(JSON.parse(JSON.stringify(hero))),'Survives a save and reload');
assert.ok(!r.isValidCharacter({...hero,scores:{...hero.scores,Strength:19}}),'Scores must still match the build');
// They fight creatures scaled to their level, and the adventure saves.
const fight=r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0);
assert.equal(fight.encounterLevel,5);assert.equal(fight.story.foeStats.maximum,r.foeStatsFor(r.hostileFoes[0],5).maximum);
const turn=r.adventureStep(fight,null,hero,'attack:Greatsword',()=>0.9);assert.equal(turn.error,undefined);
assert.ok(r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(turn.game)),turn.health,true),hero));
// ---- Level 20, and level 1 with odd scores ----
const max=r.makeCharacter({...kara,devScores:all(20),devLevel:20,level:20});assert.ok(r.isValidCharacter(max));assert.equal(r.attacksPerAction(max),4);
const frail=r.makeCharacter({...kara,devScores:{...all(1),Strength:13},devLevel:1,level:1});assert.ok(r.isValidCharacter(frail));assert.equal(r.combatBasics(frail).hp,10-5);
// ---- Casters need the spells of their level ----
const wizard={...form('wizard'),devScores:all(18),devLevel:5,level:5};
assert.match(r.spellSelectionError(wizard),/Choose exactly|Prepare exactly|spellbook/,'Level 5 needs more spells than the level-1 picks');
const limits=r.spellLimits(wizard),pool=r.spellsForClass('Wizard',5),cantrips=pool.filter(s=>s.level===0).slice(0,limits.cantrips).map(s=>s.id),book=pool.filter(s=>s.level>0).slice(0,limits.book).map(s=>s.id);
const ready={...wizard,spells:[...cantrips,...book.slice(0,limits.prepared)],spellbook:book};
assert.equal(r.spellSelectionError(ready),'');assert.ok(r.isValidCharacter(r.makeCharacter(ready)));
// ---- Levelling up afterwards still improves the hero ----
const grown={...strong,devScores:{...all(14)},level:6,advancements:[{level:6,abilities:['Strength','Strength']}]};
assert.equal(r.buildError(grown),'');assert.equal(r.finalScores(grown).Strength,16,'An improvement after the developer level counts');
assert.equal(r.finalScores({...grown,advancements:[{level:4,abilities:['Strength','Strength']}]}).Strength,14,'One from before it does not');
assert.match(r.buildError({...strong,level:6,advancements:[{level:6,abilities:['Strength','Strength']}]}),/above 20/);
// Back to the standard rules.
const plain={...strong,devScores:undefined,devLevel:undefined,level:1};same(r.finalScores(plain),r.finalScores(kara));assert.ok(r.isValidCharacter(r.makeCharacter(plain)));
console.log('Passed: developer heroes take any level from 1 to 20 and ability scores from 1 to 20, stay valid through saves, get their level\'s hit points, attacks and creatures, need their level\'s spells, improve with later level-ups, and return to the standard rules cleanly.');
