const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Species (characterRules.js speciesTraits, spellOptions.js lineageSpells; the host on 2026-10-11: "make sure wood elf
// and high elf are two different classes with their respective values"): High Elf and Wood Elf are species of their
// own, like the Dark Elf, each with its speed, darkvision, traits and lineage spells (a Wood Elf moves 35 feet), shown
// in the builder and the sheet, applied by the rules (spells, Keen Senses, speed) and sent to the Dungeon Master. A hero
// made as a plain Elf stays valid and reads as the species its lineage names, or a High Elf without one.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','subclassRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','lootRules.js','adventureRules.js','partyRules.js','skillRules.js','storyRules.js','followerRules.js','experienceRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','sequelRules.js','storyLog.js','descriptions.js','characterOptions.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({species,legacySpecies,speciesTraits,speciesProfile,heroSpecies,baseSpeciesOf,speciesSkills,makeCharacter,buildError,blankBuild,speciesSpells,heroLineage,trainedSkills,combatBasics,isValidCharacter,newAdventure,adventureSnapshot,validAdventure,dmContext,speciesRegard,speciesPlural,readyHero,speciesDetails,heroSize,creatureDefenses,newAdventure})',{AsyncStorage:{}});
const form=(species,extra={})=>({...r.blankBuild(),name:'Lirael',species,class:'Fighter',background:'Guide',plusTwo:'Dexterity',plusOne:'Wisdom',...extra});
const at=(hero,level)=>({...hero,level});
const hp=hero=>({current:r.combatBasics(hero).hp,temp:0});

// ---- What the builder offers ----
for(const name of ['High Elf','Wood Elf','Dark Elf'])assert.ok(r.species.includes(name),name+' is offered');
assert.ok(!r.species.includes('Elf'),'plain Elf is no longer offered');assert.ok(r.legacySpecies.includes('Elf'),'but heroes made as one stay valid');
for(const name of r.species){assert.ok(r.speciesDetails[name]?.description,name+' is described');assert.ok(r.speciesTraits[name],name+' has its traits');}

// ---- Each elf with its own values ----
const wood=r.makeCharacter(form('Wood Elf')),high=r.makeCharacter(form('High Elf')),dark=r.makeCharacter(form('Dark Elf'));
assert.deepEqual([wood.baseSpecies,wood.lineage],['Elf','Wood Elf']);assert.deepEqual([high.baseSpecies,high.lineage],['Elf','High Elf']);assert.deepEqual([dark.baseSpecies,dark.lineage],['Elf','Drow']);
assert.deepEqual([wood,high,dark].map(h=>r.combatBasics(h).speed),[35,30,30],'a Wood Elf moves 35 feet, the others 30');
assert.deepEqual([wood,high,dark].map(h=>r.speciesProfile(h).darkvision),[60,60,120]);
for(const h of [wood,high,dark])for(const t of ['Fey Ancestry','Keen Senses','Trance'])assert.ok(r.speciesProfile(h).traits.some(x=>x.name===t),h.species+' has '+t);
assert.deepEqual([...r.speciesSpells(wood)],['druidcraft']);assert.deepEqual([...r.speciesSpells(at(wood,3))],['druidcraft','longstrider']);assert.deepEqual([...r.speciesSpells(at(wood,5))],['druidcraft','longstrider','pass-without-trace']);
assert.deepEqual([...r.speciesSpells(at(high,5))],['prestidigitation','detect-magic','misty-step']);
assert.deepEqual([...r.speciesSpells(at(dark,5))],['dancing-lights','faerie-fire','darkness']);
assert.ok(r.buildError(form('Wood Elf',{lineage:'High Elf'})),'a Wood Elf cannot take the High Elf lineage');
// Speed 35 reaches the sheet's formula and the Dungeon Master; Chain Mail without Strength 13 still takes 10 feet off.
assert.match(r.combatBasics(wood).speedFormula,/35 ft Wood Elf/);
const ctx=r.dmContext(wood,r.newAdventure(wood),hp(wood));assert.equal(ctx.player.species,'Wood Elf');assert.equal(ctx.player.speciesTraits.speed,35);assert.equal(ctx.player.speciesTraits.darkvision,60);assert.ok(ctx.player.speciesTraits.traits.some(t=>/^Keen Senses/.test(t)));
const slowed={...wood,scores:{...wood.scores,Strength:10},equipment:{...wood.equipment,items:[...wood.equipment.items,{name:'Chain Mail',quantity:1}]}};assert.equal(r.combatBasics(slowed).speed,25);
// Other species keep their own: a Goliath strides 35 feet, a Halfling is Small, a Dwarf sees 120 feet in the dark.
assert.equal(r.speciesProfile('Goliath').speed,35);assert.equal(r.speciesProfile('Halfling').size,'Small');assert.equal(r.speciesProfile('Dwarf').darkvision,120);assert.equal(r.speciesProfile('Human').darkvision,0);

// ---- Keen Senses: every elf is trained in Insight, Perception or Survival ----
assert.ok(r.trainedSkills(wood).includes('Perception'),'Perception unless chosen otherwise');
assert.ok(r.trainedSkills(r.makeCharacter(form('High Elf',{keenSense:'Insight'}))).includes('Insight'));
assert.ok(!r.trainedSkills(r.makeCharacter(form('Human'))).includes('Perception'),'a human is not');
assert.ok(r.buildError(form('Human',{keenSense:'Perception'})),'only elves choose Keen Senses');assert.ok(r.buildError(form('Wood Elf',{keenSense:'Arcana'})));

// ---- Heroes made as a plain Elf ----
const oldWood={...r.makeCharacter(form('Elf',{lineage:'Wood Elf'}))},oldBare={...r.makeCharacter(form('Elf'))};
assert.equal(oldWood.species,'Elf','the save keeps its own words');assert.equal(r.buildError(oldWood),'');assert.ok(r.isValidCharacter(oldWood));
assert.equal(r.heroSpecies(oldWood),'Wood Elf');assert.equal(r.combatBasics(oldWood).speed,35);assert.deepEqual([...r.speciesSpells(oldWood)],['druidcraft']);
assert.equal(oldBare.lineage,null);assert.equal(r.heroSpecies(oldBare),'High Elf','an Elf made before lineages reads as a High Elf (30 feet, as before)');
assert.equal(r.combatBasics(oldBare).speed,30);assert.equal(r.heroLineage(oldBare),'High Elf');assert.deepEqual([...r.speciesSpells(oldBare)],['prestidigitation']);
assert.ok(r.trainedSkills(oldBare).includes('Perception'));
assert.equal(r.dmContext(oldWood,r.newAdventure(oldWood),hp(oldWood)).player.species,'Wood Elf');
for(const h of [oldWood,oldBare,wood,high,dark])assert.ok(r.validAdventure(r.adventureSnapshot(h,r.newAdventure(h),hp(h),true),h),h.species+' saves load');
// How strangers see them: an old Elf keeps the regard it had (the same seed), the new ones have their own words.
assert.equal(r.speciesPlural('Wood Elf'),'wood elves');assert.equal(r.speciesPlural('High Elf'),'high elves');
const g=r.newAdventure(oldWood);assert.equal(r.speciesRegard(g,'mara',oldWood).kind,'elves');
// Elves are Medium, an elf never sleeps, and the ready-made wizard is a High Elf.
assert.equal(r.heroSize(wood),'Medium');assert.equal(r.baseSpeciesOf('Wood Elf'),'Elf');assert.equal(r.baseSpeciesOf('Human'),'Human');
const ilyra=r.readyHero('wizard');assert.equal(ilyra.species,'High Elf');assert.equal(ilyra.lineage,'High Elf');assert.ok(r.speciesSpells(ilyra).includes('prestidigitation'));
console.log('Passed: High Elf and Wood Elf are species of their own (Wood Elf 35 feet, Druidcraft, Longstrider, Pass without Trace; High Elf Prestidigitation, Detect Magic, Misty Step; both darkvision 60, Fey Ancestry, Keen Senses, Trance); speed, darkvision and traits for every species reach the sheet and the Dungeon Master; Keen Senses trains a skill; heroes made as a plain Elf keep loading as the elf they are.');
