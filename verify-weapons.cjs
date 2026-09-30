const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=['equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js'].map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({weaponAttacks,rollAttack,rollDamage,equipmentFor,classes})');
const base={species:'Goliath',class:'Artificer',level:1,background:'Wayfarer',scores:{Strength:15,Dexterity:16,Constitution:13,Intelligence:12,Wisdom:11,Charisma:8}};
function list(patch={}){const h={...base,...patch};h.equipment=r.equipmentFor(h);return r.weaponAttacks(h);}
const dagger=list()[0];assert.equal(dagger.name,'Dagger');assert.equal(dagger.attackBonus,5);assert.equal(dagger.bonus,3);assert.equal(dagger.die,4);
assert.equal(list({scores:{...base.scores,Strength:18}})[0].ability,'Strength');
for(const name of r.classes) {const items=list({class:name});assert.ok(items.length>0,name);assert.ok(items.every(w=>w.proficient),name);}
assert.equal(list({class:'Monk'}).find(w=>w.name==='Dagger').die,6);
assert.equal(list({class:'Monk'})[0].ability,'Dexterity');
assert.equal(list({class:'Wizard'}).find(w=>w.name==='Quarterstaff').die,6);
assert.equal(list({class:'Paladin'})[0].die,8);
const axe=list({class:'Barbarian',scores:{...base.scores,Strength:8}})[0];assert.ok(axe.heavyDisadvantage);
let values=[0.99,0];const low=r.rollAttack(axe,'normal',()=>values.shift());assert.equal(low.natural,1);assert.ok(low.miss);
assert.equal(r.rollAttack(axe,'advantage',()=>0.5).dice.length,1);
values=[0,0.99];assert.ok(r.rollAttack(dagger,'advantage',()=>values.shift()).critical);
values=[0,0.99];assert.ok(r.rollAttack(dagger,'disadvantage',()=>values.shift()).miss);
assert.equal(r.rollDamage(dagger,false,()=>0).total,4);
const crit=r.rollDamage(dagger,true,()=>0.99);assert.equal(crit.total,11);assert.equal(crit.dice.length,2);
assert.equal(r.rollDamage(list({class:'Fighter'})[0],true,()=>0).dice.length,4);
assert.equal(r.rollDamage({...dagger,bonus:-5},false,()=>0).total,0);
assert.equal(r.weaponAttacks({...base,level:2}).length,0);
assert.equal(r.weaponAttacks(base).length,0);
const ranged=list({class:'Fighter',fighterKit:'ranged'}).find(w=>w.name==='Longbow');assert.equal(ranged.attackBonus,5);assert.equal(ranged.die,8);
console.log('Passed: all starter classes, Turq dagger, finesse, Monk, focus staffs, heavy disadvantage/cancellation, criticals, misses, damage bounds and legacy saves.');
