const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Species (characterRules.js speciesTraits, spellOptions.js lineageSpells; the host on 2026-10-11: "make sure wood elf
// and high elf are two different classes with their respective values"): High Elf and Wood Elf are species of their
// own, like the Drow, each with its speed, darkvision, traits and lineage spells (a Wood Elf moves 35 feet), shown
// in the builder and the sheet, applied by the rules (spells, Keen Senses, speed) and sent to the Dungeon Master. A hero
// made as a plain Elf stays valid and reads as the species its lineage names, or a High Elf without one. The three
// elves are listed together (the host, 2026-10-12: "maybe drow should be listed under the elves with the others."),
// and the dark elf is called a Drow everywhere players see it; a hero saved as a 'Dark Elf' reads as one, unchanged.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','subclassRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','lootRules.js','adventureRules.js','partyRules.js','skillRules.js','storyRules.js','followerRules.js','experienceRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','sequelRules.js','storyLog.js','descriptions.js','characterOptions.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({regardMemory,species,legacySpecies,speciesGroups,speciesName,speciesTraits,speciesProfile,heroSpecies,baseSpeciesOf,speciesSkills,makeCharacter,buildError,blankBuild,speciesSpells,heroLineage,trainedSkills,combatBasics,isValidCharacter,newAdventure,adventureSnapshot,validAdventure,dmContext,speciesRegard,speciesPlural,readyHero,speciesDetails,heroSize,creatureDefenses,newAdventure})',{AsyncStorage:{}});
const form=(species,extra={})=>({...r.blankBuild(),name:'Lirael',species,class:'Fighter',background:'Guide',plusTwo:'Dexterity',plusOne:'Wisdom',...extra});
const at=(hero,level)=>({...hero,level});
const hp=hero=>({current:r.combatBasics(hero).hp,temp:0});

// ---- What the builder offers ----
for(const name of ['High Elf','Wood Elf','Drow'])assert.ok(r.species.includes(name),name+' is offered');
assert.ok(!r.species.includes('Dark Elf')&&r.legacySpecies.includes('Dark Elf'),'the Dark Elf is offered as the Drow, and heroes saved as one stay valid');
// The Elves are one group in the builder, side by side in the list.
{const elves=r.speciesGroups.find(g=>g.name==='Elves');assert.deepEqual([...elves.members],['High Elf','Wood Elf','Drow']);const at=r.species.indexOf('High Elf');assert.deepEqual([...r.species.slice(at,at+3)],[...elves.members],'listed together');
 const builder=fs.readFileSync('CharacterBuilder.js','utf8');assert.ok(/speciesCards, speciesGroups\)/.test(builder),'the builder groups them');assert.ok(!/Dark Elf \(Drow\)/.test(builder),'and calls the dark elf a Drow');}
assert.ok(!r.species.includes('Elf'),'plain Elf is no longer offered');assert.ok(r.legacySpecies.includes('Elf'),'but heroes made as one stay valid');
for(const name of r.species){assert.ok(r.speciesDetails[name]?.description,name+' is described');assert.ok(r.speciesTraits[name],name+' has its traits');}

// ---- Each elf with its own values ----
const wood=r.makeCharacter(form('Wood Elf')),high=r.makeCharacter(form('High Elf')),dark=r.makeCharacter(form('Drow'));
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
// ---- Heroes saved as a Dark Elf (the Drow's name until 2026-10-12): unchanged, and called a Drow ----
{const oldDark=r.makeCharacter(form('Dark Elf'));assert.equal(oldDark.species,'Dark Elf','the save keeps its own words');assert.equal(r.buildError(oldDark),'');assert.ok(r.isValidCharacter(oldDark));
 assert.deepEqual([oldDark.baseSpecies,oldDark.lineage],['Elf','Drow']);assert.equal(r.heroSpecies(oldDark),'Drow');assert.equal(r.speciesName('Dark Elf'),'Drow');assert.equal(r.speciesName('Human'),'Human');
 const p=r.speciesProfile(oldDark);assert.equal(p.species,'Drow');assert.equal(p.darkvision,120);assert.ok(p.traits.some(t=>t.name==='Drow lineage'));
 assert.deepEqual([...r.speciesSpells(at(oldDark,5))],['dancing-lights','faerie-fire','darkness']);assert.ok(r.trainedSkills(oldDark).includes('Perception'));
 const c=r.dmContext(oldDark,r.newAdventure(oldDark),hp(oldDark));assert.equal(c.player.species,'Drow');assert.equal(c.player.speciesTraits.darkvision,120);
 assert.ok(r.validAdventure(r.adventureSnapshot(oldDark,r.newAdventure(oldDark),hp(oldDark),true),oldDark),'an old Dark Elf save loads');
 // Strangers see them as before (the same seed, the same weights), in the new word.
 const g2=r.newAdventure(oldDark),seen=r.speciesRegard(g2,'mara',oldDark);assert.equal(seen.species,'Dark Elf','the regard seed keeps the saved name');assert.equal(seen.kind,'drow');
 assert.equal(r.speciesRegard(g2,'mara',dark).kind,'drow');assert.equal(r.speciesPlural('Drow'),'drow');
 assert.ok(!/dark el/i.test(r.regardMemory(seen)),'remembered as a Drow: '+r.regardMemory(seen));
 // An elf, a drow or a dark elf among the people knows a Drow as kin, whichever name the hero was saved under.
 for(const kind of ['Drow','Dark elf','Elf'])for(const h of [oldDark,dark]){const people={...g2,story:{id:'kin-test',npcs:{mara:{name:'Mara',species:kind}}}};assert.equal(r.speciesRegard(people,'mara',h).stance,'kin',kind+' and '+h.species);}}
// Elves are Medium, an elf never sleeps, and the ready-made wizard is a High Elf.
assert.equal(r.heroSize(wood),'Medium');assert.equal(r.baseSpeciesOf('Wood Elf'),'Elf');assert.equal(r.baseSpeciesOf('Human'),'Human');
const ilyra=r.readyHero('wizard');assert.equal(ilyra.species,'High Elf');assert.equal(ilyra.lineage,'High Elf');assert.ok(r.speciesSpells(ilyra).includes('prestidigitation'));
console.log('Passed: High Elf, Wood Elf and Drow are species of their own, listed together as the Elves, and a hero saved as a Dark Elf reads as a Drow, unchanged (Wood Elf 35 feet, Druidcraft, Longstrider, Pass without Trace; High Elf Prestidigitation, Detect Magic, Misty Step; both darkvision 60, Fey Ancestry, Keen Senses, Trance); speed, darkvision and traits for every species reach the sheet and the Dungeon Master; Keen Senses trains a skill; heroes made as a plain Elf keep loading as the elf they are.');
