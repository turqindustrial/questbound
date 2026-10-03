const assert=require('node:assert/strict'),r=require('./verify-dm-integration.cjs');
// With Strength 16 and Dexterity 14 the strongest close-range weapon in each kit leads (a strong Sorcerer's spear,
// not the dagger); ties go to the class's usual weapon.
const expected={Artificer:['Dagger',14],Barbarian:['Greataxe',14],Bard:['Dagger',13],Cleric:['Mace',17],Druid:['Quarterstaff',15],Fighter:['Greatsword',16],Monk:['Spear',14],Paladin:['Longsword',18],Ranger:['Scimitar',14],Rogue:['Shortsword',13],Sorcerer:['Spear',12],Warlock:['Dagger',13],Wizard:['Quarterstaff',12]};
// The 2024 starting equipment, item for item, with each class's gold.
const kits2024={
 Artificer:['Studded Leather Armor×1,Dagger×1,Thieves’ Tools×1,Tinker’s Tools×1,Dungeoneer’s Pack×1',16],
 Barbarian:['Greataxe×1,Handaxe×4,Explorer’s Pack×1',15],
 Bard:['Leather Armor×1,Dagger×2,Flute×1,Entertainer’s Pack×1',19],
 Cleric:['Chain Shirt×1,Shield×1,Mace×1,Holy Symbol×1,Priest’s Pack×1',7],
 Druid:['Leather Armor×1,Shield×1,Sickle×1,Druidic Focus (Quarterstaff)×1,Explorer’s Pack×1,Herbalism Kit×1',9],
 Fighter:['Chain Mail×1,Greatsword×1,Flail×1,Javelin×8,Dungeoneer’s Pack×1',4],
 Monk:['Spear×1,Dagger×5,Flute×1,Explorer’s Pack×1',11],
 Paladin:['Chain Mail×1,Shield×1,Longsword×1,Javelin×6,Holy Symbol×1,Priest’s Pack×1',9],
 Ranger:['Studded Leather Armor×1,Scimitar×1,Shortsword×1,Longbow×1,Arrow×20,Quiver×1,Druidic Focus (Mistletoe)×1,Explorer’s Pack×1',7],
 Rogue:['Leather Armor×1,Dagger×2,Shortsword×1,Shortbow×1,Arrow×20,Quiver×1,Thieves’ Tools×1,Burglar’s Pack×1',8],
 Sorcerer:['Spear×1,Dagger×2,Arcane Focus (Crystal)×1,Dungeoneer’s Pack×1',28],
 Warlock:['Leather Armor×1,Sickle×1,Dagger×2,Arcane Focus (Orb)×1,Book (Occult Lore)×1,Scholar’s Pack×1',15],
 Wizard:['Dagger×2,Arcane Focus (Quarterstaff)×1,Robe×1,Spellbook×1,Scholar’s Pack×1',5]};
const kits=new Set();
for(const [className,[weapon,ac]] of Object.entries(expected)){
  const hero={name:'Loadout tester',race:'Human',species:'Human',class:className,level:1,background:'Soldier',spells:[],scores:{Strength:16,Dexterity:14,Constitution:14,Intelligence:14,Wisdom:14,Charisma:14}};
  hero.equipment=r.equipmentFor(hero);kits.add(JSON.stringify(hero.equipment.items));
  assert.equal(hero.equipment.items.map(i=>i.name+'×'+i.quantity).join(','),kits2024[className][0],className+' kit');assert.equal(hero.equipment.classGold,kits2024[className][1],className+' gold');assert.equal(hero.equipment.totalGold,kits2024[className][1]+50);
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
  // Before a hero has scores (the kits offered to the AI character writer), the class's usual weapon stands in.
  assert.equal(supplied.loadout.mainWeapon,className==='Sorcerer'?'Dagger':weapon);
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
// ---- Each hero fights with what suits them: the same kit, a different main weapon ----
const fs=require('fs'),vm=require('vm');
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','adventureRules.js','skillRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','worldArtRules.js','iconPaths.js','quickActions.js','pregens.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const q=vm.runInNewContext(source+'\n({readyHero,readyHeroes,readyLoadout,loadoutWarnings,weaponAttacks,attackOptions,equipmentFor,combatBasics,quickActions,hostileEncounterGame,newAdventure})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const build=(cls,scores,extra={})=>{const h={name:'Kit tester',race:'Human',species:'Human',class:cls,level:1,background:'Soldier',spells:[],scores:{Strength:10,Dexterity:10,Constitution:12,Intelligence:10,Wisdom:10,Charisma:10,...scores},...extra};h.equipment=q.equipmentFor(h);return h;};
const main=h=>q.readyLoadout(h).mainWeapon;
assert.equal(main(build('Wizard',{Strength:8,Dexterity:14})),'Dagger','A frail, quick wizard fights with the dagger');
assert.equal(main(build('Wizard',{Strength:15,Dexterity:8})),'Quarterstaff','A strong wizard keeps the staff');
assert.equal(main(build('Sorcerer',{Strength:8,Dexterity:15})),'Dagger');assert.equal(main(build('Druid',{Strength:8,Dexterity:8})),'Quarterstaff','No finesse weapon: the bigger die');
assert.equal(main(build('Monk',{Strength:8,Dexterity:16})),'Spear','A monk uses Dexterity with either; the spear is the usual choice');
assert.equal(main(build('Fighter',{Strength:9,Dexterity:16},{fighterKit:'melee'})),'Flail','A weak fighter in the melee kit: the greatsword is too heavy to swing well');
assert.equal(main(build('Fighter',{Strength:16,Dexterity:12},{fighterKit:'melee'})),'Greatsword');
assert.equal(main(build('Fighter',{Strength:10,Dexterity:16},{fighterKit:'ranged'})),'Scimitar');
assert.equal(main(build('Paladin',{Strength:16})),'Longsword');assert.equal(main(build('Barbarian',{Strength:12,Dexterity:14})),'Handaxe','Under Strength 13 the greataxe has disadvantage');
// The same order drives the attack list and the first chip.
for(const h of [build('Wizard',{Strength:8,Dexterity:14}),build('Fighter',{Strength:9,Dexterity:16})]){assert.equal(q.attackOptions(h)[0].name,main(h));assert.equal(q.quickActions(h,q.hostileEncounterGame(h,q.newAdventure(h),()=>0))[0].label,main(h));}
// Warnings name what does not suit the hero.
const weak=q.loadoutWarnings(build('Fighter',{Strength:9,Dexterity:16},{fighterKit:'melee'}));
assert.ok(weak.some(t=>/Chain Mail needs Strength 13/.test(t)));assert.ok(weak.some(t=>/Greatsword is a heavy weapon/.test(t)));assert.ok(weak.some(t=>/Ranged kit/.test(t)));
assert.ok(q.loadoutWarnings(build('Fighter',{Strength:16,Dexterity:10},{fighterKit:'ranged'})).some(t=>/Melee kit/.test(t)));
assert.equal(q.loadoutWarnings(build('Fighter',{Strength:16,Dexterity:12},{fighterKit:'melee'})).length,0);
// The four ready-made heroes: the right weapon in hand, the armour worn, no warnings.
const ready={fighter:['Greatsword','Chain Mail',16],rogue:['Shortsword','Leather Armor',14],wizard:['Dagger',null,12],cleric:['Mace','Chain Shirt',14]};
for(const [key,[weapon,armor,ac]] of Object.entries(ready)){const h=q.readyHero(key),gear=q.readyLoadout(h);assert.equal(gear.mainWeapon,weapon,key);assert.equal(gear.armor,armor,key);assert.equal(q.combatBasics(h).ac,ac,key+' AC');assert.equal(q.loadoutWarnings(h).join(' | '),'',key+' fits their kit');}
assert.equal(q.readyLoadout(q.readyHero('rogue')).rangedWeapon,'Shortbow');assert.equal(q.readyLoadout(q.readyHero('cleric')).shield,true);assert.equal(q.readyLoadout(q.readyHero('wizard')).focus,'Arcane Focus (Quarterstaff)');
console.log('Passed: 13 class kits match the 2024 starting equipment item for item, equipped AC, default weapons committing damage, explicit weapons and stab intent, unavailable gear, both Fighter kits, instrument focus, AI/manual equipment consistency, unchanged save fingerprints; each hero\'s main weapon suits their own abilities, ill-fitting kits are flagged, and the ready-made heroes fit theirs.');
