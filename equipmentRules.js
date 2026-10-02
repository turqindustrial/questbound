// Class gear presets use the 2024 starting equipment bundles.
// The Artificer is a Questbound option beyond the System Reference Document; its kit is listed here in the game's own words.
export const instruments = ['Lute', 'Flute', 'Drum'];
export const starterKits = {
  Artificer: {items: [['Studded Leather Armor',1],['Dagger',1],["Thieves’ Tools",1],["Tinker’s Tools",1],["Dungeoneer’s Pack",1]],gold:16,summary:'Light armor, tools, and supplies for a traveling inventor.'},
  Barbarian: {items:[['Greataxe',1],['Handaxe',4],["Explorer’s Pack",1]],gold:15,summary:'A heavy weapon and throwing axes for a direct approach.'},
  Bard: {items:[['Leather Armor',1],['Dagger',2],['Instrument',1],["Entertainer’s Pack",1]],gold:19,summary:'Light protection, an instrument, and performance supplies.'},
  Cleric: {items:[['Chain Shirt',1],['Shield',1],['Mace',1],['Holy Symbol',1],["Priest’s Pack",1]],gold:7,summary:'Armor, a shield, and the essentials for divine spellcasting.'},
  Druid: {items:[['Leather Armor',1],['Shield',1],['Sickle',1],['Druidic Focus (Quarterstaff)',1],["Explorer’s Pack",1],['Herbalism Kit',1]],gold:9,summary:'Travel supplies, light protection, and a nature focus.'},
  Fighter: {items:[['Chain Mail',1],['Greatsword',1],['Flail',1],['Javelin',8],["Dungeoneer’s Pack",1]],gold:4,summary:'Heavy armor and weapons for fighting at close range.'},
  Monk: {items:[['Spear',1],['Dagger',5],['Instrument',1],["Explorer’s Pack",1]],gold:11,summary:'Simple weapons and travel essentials, without armor.'},
  Paladin: {items:[['Chain Mail',1],['Shield',1],['Longsword',1],['Javelin',6],['Holy Symbol',1],["Priest’s Pack",1]],gold:9,summary:'Heavy protection, a sword, and a symbol of your commitment.'},
  Ranger: {items:[['Studded Leather Armor',1],['Scimitar',1],['Shortsword',1],['Longbow',1],['Arrow',20],['Quiver',1],['Druidic Focus (Mistletoe)',1],["Explorer’s Pack",1]],gold:7,summary:'A bow, paired blades, and supplies for wilderness travel.'},
  Rogue: {items:[['Leather Armor',1],['Dagger',2],['Shortsword',1],['Shortbow',1],['Arrow',20],['Quiver',1],["Thieves’ Tools",1],["Burglar’s Pack",1]],gold:8,summary:'Light equipment for precision, stealth, and locked doors.'},
  Sorcerer: {items:[['Spear',1],['Dagger',2],['Arcane Focus (Crystal)',1],["Dungeoneer’s Pack",1]],gold:28,summary:'A crystal focus and basic weapons for your first journey.'},
  Warlock: {items:[['Leather Armor',1],['Sickle',1],['Dagger',2],['Arcane Focus (Orb)',1],['Book (Occult Lore)',1],["Scholar’s Pack",1]],gold:15,summary:'An arcane focus, light armor, and occult study materials.'},
  Wizard: {items:[['Dagger',2],['Arcane Focus (Quarterstaff)',1],['Robe',1],['Spellbook',1],["Scholar’s Pack",1]],gold:5,summary:'A spellbook, staff focus, and supplies for magical study.'},
};
const rangedFighter = {items:[['Studded Leather Armor',1],['Scimitar',1],['Shortsword',1],['Longbow',1],['Arrow',20],['Quiver',1],["Dungeoneer’s Pack",1]],gold:11,summary:'Light armor, a bow, and paired blades for an agile fighter.'};
export function equipmentError(form) {
  if (!Object.hasOwn(starterKits,form.class)) return 'Choose a class before reviewing equipment.';
  if (form.class === 'Fighter' && !['melee','ranged'].includes(form.fighterKit ?? 'melee')) return 'Choose a Fighter starter kit.';
  if (['Bard','Monk'].includes(form.class) && !instruments.includes(form.instrument ?? 'Flute')) return 'Choose an available instrument.';
  return '';
}
export function equipmentFor(form) {
  const error = equipmentError(form);
  if (error) throw new Error(error);
  const preset = form.class === 'Fighter' && form.fighterKit === 'ranged' ? rangedFighter : starterKits[form.class];
  return {
    version:1, className:form.class, background:form.background,
    kit:form.class === 'Fighter' ? (form.fighterKit ?? 'melee') : 'standard',
    summary:preset.summary,
    items:preset.items.map(([name,quantity])=>({name:name === 'Instrument' ? (form.instrument ?? 'Flute') : name,quantity})),
    classGold:preset.gold, backgroundGold:50, totalGold:preset.gold+50,
  };
}
export function validEquipment(form) {
  try { return JSON.stringify(form.equipment) === JSON.stringify(equipmentFor(form)); } catch { return false; }
}

// Derive ready gear from the owned class kit instead of its inventory order.
// This also works for existing saves without changing the character fingerprint,
// replenishing supplies, or detaching the character's saved adventure.
// A class's usual close-range weapons, most typical first. Which one a particular hero fights with is decided by
// their own abilities (readyLoadout in weaponRules.js); this order settles ties and stands in before scores exist.
export const classWeapons = {
  Artificer:['Dagger'], Barbarian:['Greataxe','Handaxe'], Bard:['Dagger'],
  Cleric:['Mace'], Druid:['Quarterstaff','Sickle'], Fighter:['Greatsword','Scimitar','Shortsword','Flail','Javelin'],
  Monk:['Spear','Dagger'], Paladin:['Longsword','Javelin'], Ranger:['Scimitar','Shortsword'],
  Rogue:['Shortsword','Dagger'], Sorcerer:['Dagger','Spear'], Warlock:['Dagger','Sickle'], Wizard:['Quarterstaff','Dagger'],
};
export function loadoutFor(hero) {
  const items=(hero.equipment?.items??[]).filter(item=>item.quantity>0);
  const has=name=>items.some(item=>item.name===name);
  const weaponName=name=>name.includes('(Quarterstaff)')?'Quarterstaff':name;
  const ownedWeapons=items.map(item=>weaponName(item.name));
  const mainWeapon=(classWeapons[hero.class]??[]).find(name=>ownedWeapons.includes(name))??null;
  const armor=['Chain Mail','Chain Shirt','Studded Leather Armor','Leather Armor'].find(has)??null;
  const focus=hero.class==='Bard'?instruments.find(has):hero.class==='Artificer'?['Tinker’s Tools','Thieves’ Tools'].find(has):items.find(item=>/Focus|Holy Symbol/.test(item.name))?.name;
  return {
    mainWeapon,armor,shield:has('Shield'),focus:focus??null,
    rangedWeapon:['Longbow','Shortbow'].find(has)??null,
    ammunition:items.find(item=>item.name==='Arrow')?.quantity??0,
    tools:items.filter(item=>/Tools|Herbalism Kit/.test(item.name)).map(item=>item.name),
    pack:items.find(item=>/Pack$/.test(item.name))?.name??null,
  };
}
