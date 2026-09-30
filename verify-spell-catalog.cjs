const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const catalog=JSON.parse(fs.readFileSync('spellCatalog.json')),progression=JSON.parse(fs.readFileSync('spellProgression.json'));
const source=fs.readFileSync('spellOptions.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
const r=vm.runInNewContext(source+'\n({spellsForClass,spellLimits,spellSelectionError,automaticSpells})',{catalog,progression});
assert.equal(catalog.length,339);assert.equal(new Set(catalog.map(s=>s.id)).size,339);
for(const name of Object.keys(progression))for(let level=1;level<=20;level++){
 const hero={class:name,level,spellSelectionVersion:2},limits=r.spellLimits(hero),options=r.spellsForClass(name,level),auto=r.automaticSpells(hero);
 assert.ok(auto.every(id=>catalog.some(s=>s.id===id)),name);
 const pool=options.filter(s=>!auto.includes(s.id));
 hero.spells=pool.filter(s=>s.level===0).slice(0,limits.cantrips).map(s=>s.id);
 const leveled=pool.filter(s=>s.level>0);
 hero.spellbook=leveled.slice(0,limits.book).map(s=>s.id);
 hero.spells.push(...leveled.slice(0,limits.prepared).map(s=>s.id));
 assert.equal(r.spellSelectionError(hero),'',`${name} ${level}`);
 assert.ok(options.every(s=>s.level<=limits.maxSpellLevel));
 hero.spells.push(hero.spells[0]);assert.ok(r.spellSelectionError(hero));
}
assert.equal(r.spellLimits({class:'Wizard',level:3}).maxSpellLevel,2);
assert.equal(r.spellLimits({class:'Warlock',level:5}).maxSpellLevel,3);
assert.equal(r.spellLimits({class:'Ranger',level:5}).maxSpellLevel,2);
assert.equal(r.spellsForClass('Fighter',1).length,0);
assert.equal(r.spellsForClass('Wizard',0).length,0);
assert.equal(r.spellSelectionError({class:'Artificer',level:1,spells:['cure','shock']},false),'');
assert.ok(r.spellSelectionError({class:'Artificer',level:1,spells:['cure','shock'],spellSelectionVersion:2},false));
console.log('Passed: 339 unique spells, all nine casting progressions at levels 1–20, free class spells, exact counts, level gating, duplicates, wizard books and legacy saves.');
