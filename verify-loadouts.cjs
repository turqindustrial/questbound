const assert=require('node:assert/strict'),r=require('./verify-dm-integration.cjs');
const expected={Artificer:['Dagger',14],Barbarian:['Greataxe',14],Bard:['Dagger',13],Cleric:['Mace',17],Druid:['Quarterstaff',15],Fighter:['Greatsword',16],Monk:['Spear',14],Paladin:['Longsword',18],Ranger:['Scimitar',14],Rogue:['Shortsword',13],Sorcerer:['Dagger',12],Warlock:['Dagger',13],Wizard:['Quarterstaff',12]};
const kits=new Set();
for(const [className,[weapon,ac]] of Object.entries(expected)){
  const hero={name:'Loadout tester',race:'Human',species:'Human',class:className,level:1,background:'Soldier',spells:[],scores:{Strength:16,Dexterity:14,Constitution:14,Intelligence:14,Wisdom:14,Charisma:14}};
  hero.equipment=r.equipmentFor(hero);kits.add(JSON.stringify(hero.equipment.items));
  const game=r.newAdventure(hero),hp={current:r.combatBasics(hero).hp,temp:0};
  const saved=JSON.stringify(r.adventureSnapshot(hero,game,hp,true));
  const context=r.dmContext(hero,game,hp);
  assert.equal(context.loadout.mainWeapon,weapon,className);
  assert.equal(r.weaponAttacks(hero)[0].name,weapon);
  assert.equal(r.combatBasics(hero).ac,ac,className+' armor');
  const command=r.dmCommand(hero,game,'attack the keeper',hp);
  assert.equal(command.action.weapon,weapon);
  const committed=r.commitDmTurn(hero,game,hp,command.action,{question:'attack the keeper',narration:'Your attack lands.'},()=>0.75);
  assert.equal(committed.error,undefined,className);
  assert.ok(committed.game.npcHP.keeper<12,className+' actual damage');
  assert.ok(committed.events.some(e=>e.includes('You use '+weapon)),className+' actual weapon');
  assert.equal(JSON.stringify(r.adventureSnapshot(hero,game,hp,true)),saved,'Loadout derives without changing saved character/progress');
  assert.ok(r.validAdventure(JSON.parse(saved),hero));
  const supplied=r.characterDraftContext().classes.find(c=>c.name===className).starterKits[0];
  assert.equal(JSON.stringify(supplied.items),JSON.stringify(hero.equipment.items),'AI and manual kit match');
  assert.equal(supplied.loadout.mainWeapon,weapon);
  if(className==='Fighter'){
    const archer={...hero,fighterKit:'ranged'};archer.equipment=r.equipmentFor(archer);
    const loadout=r.dmContext(archer,game,hp).loadout;
    assert.equal(loadout.mainWeapon,'Scimitar');assert.equal(loadout.rangedWeapon,'Longbow');assert.equal(loadout.ammunition,20);
    assert.equal(r.combatBasics(archer).ac,14);
    assert.equal(r.characterDraftContext().classes.find(c=>c.name==='Fighter').starterKits.length,2);
  }
  if(className==='Wizard'){
    assert.equal(r.dmCommand(hero,game,'stab the keeper',hp).action.weapon,'Dagger');
    assert.equal(r.dmCommand(hero,game,'attack the keeper with my dagger',hp).action.weapon,'Dagger');
    assert.equal(r.dmCommand(hero,game,'stab them',hp,'keeper').action.weapon,'Dagger');
    assert.ok(r.dmCommand(hero,game,'attack the keeper with a greatsword',hp).error,'Cannot invent unowned gear');
    const missing={...hero,equipment:{...hero.equipment,items:hero.equipment.items.map(i=>({...i,quantity:i.name.includes('Quarterstaff')?0:i.quantity}))}};
    assert.equal(r.dmCommand(missing,game,'attack the keeper',hp).action.weapon,'Dagger','Unavailable primary falls back to owned weapon');
  }
  if(className==='Bard'){
    const bard={...hero,instrument:'Lute'};bard.equipment=r.equipmentFor(bard);
    assert.equal(r.dmContext(bard,game,hp).loadout.focus,'Lute');
  }
}
assert.equal(kits.size,13,'Every class has a distinct complete kit');
console.log('Passed: 13 distinct class loadouts, equipped AC, default weapons committing damage, explicit weapons and stab intent, unavailable gear, both Fighter kits, instrument focus, AI/manual equipment consistency and unchanged save fingerprints.');
