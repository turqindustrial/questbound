const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const rules = vm.runInNewContext((fs.readFileSync('equipmentRules.js','utf8') + '\n' + fs.readFileSync('characterRules.js','utf8')).replace(/^import .*;\r?\n/gm,'').replace(/export /g,'') + '\n({blankBuild,makeCharacter,buildError,modifier,backgrounds,species,classes})');
for (const [background, data] of Object.entries(rules.backgrounds)) {
  const form = {...rules.blankBuild(),name:'Test',species:'Elf',class:'Wizard',background,plusTwo:data.abilities[0],plusOne:data.abilities[1]};
  const result = rules.makeCharacter(form);
  assert.equal(Object.values(result.scores).reduce((a,b)=>a+b,0),75);
  assert.equal(result.level,1);
  assert.equal(result.originFeat,data.feat);
  assert.equal(Object.values(rules.makeCharacter({...form,bonusMode:'three'}).scores).reduce((a,b)=>a+b,0),75);
  assert.ok(rules.buildError({...form,plusOne:form.plusTwo}));
  assert.ok(rules.buildError({...form,baseScores:[15,15,13,12,10,8]}));
}
assert.equal(rules.modifier(8),-1); assert.equal(rules.modifier(17),3);
console.log('Passed: all 16 backgrounds, both bonus modes, invalid bonuses, duplicate scores, fixed starting level, modifiers.');

assert.equal(Object.keys(rules.backgrounds).length,16);
for (const species of ['Goblin','Half-Elf','Dark Elf']) {
  const form = {...rules.blankBuild(),name:'Test',description:'An inventor with copper goggles.',species,class:'Artificer',background:'Artisan',plusTwo:'Intelligence',plusOne:'Dexterity'};
  const hero = rules.makeCharacter(form);
  assert.equal(hero.level,1);
  assert.equal(hero.scores.Intelligence,14);
  assert.equal(hero.scores.Dexterity,15);
  assert.equal(hero.description,form.description);
  assert.equal(hero.baseSpecies,species === 'Dark Elf' ? 'Elf' : species);
  assert.equal(hero.lineage,species === 'Dark Elf' ? 'Drow' : null);
  assert.ok(rules.buildError({...form,description:'x'.repeat(1501)}));
}
const options = vm.runInNewContext(fs.readFileSync('characterOptions.js','utf8').replace(/export /g,'') + '\n({speciesDetails,classDetails,backgroundDescriptions})');
for (const name of rules.species) assert.ok(options.speciesDetails[name].description);
for (const name of rules.classes) assert.ok(options.classDetails[name].description);
for (const name of Object.keys(rules.backgrounds)) assert.ok(options.backgroundDescriptions[name]);
console.log('Passed: requested species, Artificer, Drow lineage, description persistence, and all option descriptions.');

