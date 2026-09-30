const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=['equipmentRules.js','characterRules.js','combatRules.js'].map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({combatBasics,equipmentFor,classes})');
const base={name:'Test',species:'Goliath',class:'Artificer',level:1,background:'Wayfarer',originFeat:'Lucky',scores:{Strength:15,Dexterity:16,Constitution:13,Intelligence:12,Wisdom:11,Charisma:8}};
function calculate(patch={}) {const hero={...base,...patch}; hero.equipment=r.equipmentFor(hero); return r.combatBasics(hero);}
const turq=calculate();assert.equal(turq.hp,9);assert.equal(turq.ac,15);assert.equal(turq.initiative,3);assert.equal(turq.proficiency,2);
assert.equal(calculate({class:'Cleric'}).ac,17);
assert.equal(calculate({class:'Paladin'}).ac,18);
assert.equal(calculate({class:'Fighter'}).ac,16);
assert.equal(calculate({class:'Fighter',fighterKit:'ranged'}).ac,15);
assert.equal(calculate({class:'Barbarian'}).ac,14);
assert.equal(calculate({class:'Monk',scores:{...base.scores,Wisdom:16}}).ac,16);
assert.equal(calculate({class:'Wizard'}).hp,7);
assert.equal(calculate({class:'Wizard'}).ac,13);
assert.equal(calculate({species:'Dwarf',originFeat:'Tough'}).hp,12);
assert.equal(calculate({originFeat:'Alert'}).initiative,5);
assert.equal(calculate({class:'Cleric',scores:{...base.scores,Dexterity:8}}).ac,14);
assert.equal(calculate({class:'Monk',scores:{...base.scores,Wisdom:8}}).ac,13);
assert.ok(calculate({class:'Fighter',scores:{...base.scores,Strength:8}}).armorNote.includes('10 feet'));
assert.equal(r.combatBasics({...base}).ac,null);
assert.equal(r.combatBasics({...base,scores:undefined}).available,false);
assert.equal(r.combatBasics({...base,level:3}).available,true);
for(const className of r.classes){const s=calculate({class:className});assert.ok(s.available);assert.ok(s.hp>0);assert.ok(Number.isInteger(s.ac));}
console.log('Passed: all 13 classes, Turq values, armor caps and shields, unarmored defense, Tough, Dwarf, Alert, missing equipment, and unsupported levels.');
