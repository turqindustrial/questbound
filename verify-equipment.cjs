const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const equipment = fs.readFileSync('equipmentRules.js','utf8').replace(/export /g,'');
const rulesSource = fs.readFileSync('characterRules.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
const r = vm.runInNewContext(equipment + '\n' + rulesSource + '\n({equipmentFor,validEquipment,makeCharacter,blankBuild,classes})');
const form = {...r.blankBuild(),name:'Gear test',species:'Goblin',class:'Artificer',background:'Artisan',bonusMode:'three'};
for (const className of r.classes) {
  const hero = r.makeCharacter({...form,class:className});
  assert.ok(r.validEquipment(hero));
  assert.ok(hero.equipment.items.length > 0);
  assert.equal(hero.equipment.totalGold, hero.equipment.classGold+50);
  assert.equal(hero.equipment.className,className);
  assert.ok(hero.equipment.items.every(i=>Number.isInteger(i.quantity) && i.quantity > 0));
  const changed = {...hero,class:className === 'Wizard' ? 'Fighter' : 'Wizard'};
  assert.ok(!r.validEquipment(changed));
  assert.ok(!r.validEquipment({...hero,equipment:{...hero.equipment,totalGold:9999}}));
}
const melee = r.equipmentFor({...form,class:'Fighter',fighterKit:'melee'});
const ranged = r.equipmentFor({...form,class:'Fighter',fighterKit:'ranged'});
assert.ok(melee.items.some(i=>i.name === 'Chain Mail'));
assert.ok(ranged.items.some(i=>i.name === 'Longbow'));
assert.equal(ranged.totalGold,61);
assert.equal(melee.totalGold,54);
assert.ok(r.equipmentFor({...form,class:'Bard',instrument:'Lute'}).items.some(i=>i.name === 'Lute'));
assert.ok(r.equipmentFor({...form,class:'Monk',instrument:'Drum'}).items.some(i=>i.name === 'Drum'));
assert.throws(()=>r.equipmentFor({...form,class:'Bard',instrument:'Invalid'}));
assert.throws(()=>r.equipmentFor({...form,class:'Fighter',fighterKit:'Invalid'}));
console.log('Passed: 13 class kits, quantities, gold, class changes, Fighter choices, instruments, and invalid saved gear.');
