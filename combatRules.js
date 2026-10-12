import {abilities, modifier, validLevel, proficiencyBonus, subclassActive, speciesProfile} from './characterRules';
import {subclassPassive} from './subclassRules';
import {shieldSlung} from './weaponRules';

export const hitDice = {Artificer:8,Barbarian:12,Bard:8,Cleric:8,Druid:8,Fighter:10,Monk:8,Paladin:10,Ranger:10,Rogue:8,Sorcerer:6,Warlock:8,Wizard:6};
export const signed = number => number >= 0 ? `+${number}` : `${number}`;
export function combatBasics(hero) {
  if (!validLevel(hero.level)) return {available:false,reason:'Character level must be between 1 and 20.'};
  if (!hitDice[hero.class] || !hero.scores || !abilities.every(a => Number.isInteger(hero.scores[a]) && hero.scores[a] >= 1 && hero.scores[a] <= 20)) return {available:false,reason:'Complete and save your ability scores in Character Selection to calculate combat statistics.'};
  const mods = Object.fromEntries(abilities.map(a => [a,modifier(hero.scores[a])]));
  const proficiency = proficiencyBonus(hero.level);
  const dwarfBonus = (hero.species ?? hero.race) === 'Dwarf' ? 1 : 0;
  const toughBonus = hero.originFeat === 'Tough' ? 2 : 0;
  const draconicBonus = subclassActive(hero,'Draconic Sorcery') ? hero.level : 0;
  // What the hero's subclass adds (subclassRules.js): hit points per level, initiative, armour class, critical range.
  const sub = subclassPassive(hero), subHP = sub.hp*hero.level;
  const laterHP = Math.max(1,Math.floor(hitDice[hero.class]/2)+1+mods.Constitution);
  // Aid (spellRules.js) raises the maximum while it lasts: gearedHero gives the hero its amount as hero.aid.
  const aidBonus = Number.isInteger(hero.aid) && hero.aid > 0 ? Math.min(40,hero.aid) : 0;
  const hp = Math.max(1,hitDice[hero.class] + mods.Constitution) + (hero.level-1)*laterHP + hero.level*(dwarfBonus+toughBonus) + draconicBonus + subHP + aidBonus;
  const hpFormula = `${hitDice[hero.class]} (${hero.class}) ${signed(mods.Constitution)} Constitution${dwarfBonus ? ' +1 Dwarven Toughness' : ''}${toughBonus ? ' +2 Tough' : ''}${hero.level>1 ? ` + ${hero.level-1} × (${laterHP+dwarfBonus+toughBonus}) later levels` : ''}${draconicBonus ? ` +${draconicBonus} Draconic Resilience` : ''}${subHP ? ` +${subHP} ${sub.hpName}` : ''}${aidBonus ? ` +${aidBonus} Aid` : ''}`;
  const alertBonus = hero.originFeat === 'Alert' ? proficiency : 0;
  const gloomBonus=subclassActive(hero,'Gloom Stalker') ? mods.Wisdom : 0;
  const subInitiative = sub.initiative.reduce((n,i)=>n+mods[i.ability],0);
  const initiative = mods.Dexterity + alertBonus + gloomBonus + subInitiative;
  const initiativeFormula = `${signed(mods.Dexterity)} Dexterity${alertBonus ? ` +${proficiency} Alert` : ''}${gloomBonus ? ` ${signed(gloomBonus)} Dread Ambusher` : ''}${sub.initiative.map(i=>` ${signed(mods[i.ability])} ${i.name}`).join('')}`;
  let ac = null, defense = 'Save your starter equipment to calculate armor class.', acFormula = '', armorNote = '';
  if (hero.equipment?.items) {
    const has = name => hero.equipment.items.some(i => i.name === name && i.quantity > 0);
    // A shield slung on the back while a two-handed weapon is in hand (weaponRules.js Hands) adds nothing.
    const slung = has('Shield') && shieldSlung(hero), shield = has('Shield') && !slung ? 2 : 0;
    if (has('Chain Mail')) {
      ac = 16; defense = 'Chain Mail'; acFormula = '16 from Chain Mail';
      armorNote = 'Chain Mail gives disadvantage on Stealth checks.';
      if (hero.scores.Strength < 13) armorNote += ' Strength below 13 also reduces Speed by 10 feet while wearing it.';
    } else if (has('Chain Shirt')) {ac = 13 + Math.min(mods.Dexterity,2); defense = 'Chain Shirt'; acFormula = `13 ${signed(Math.min(mods.Dexterity,2))} Dexterity (maximum +2)`;}
    else if (has('Studded Leather Armor')) {ac = 12 + mods.Dexterity; defense = 'Studded Leather Armor'; acFormula = `12 ${signed(mods.Dexterity)} Dexterity`;}
    else if (has('Leather Armor')) {ac = 11 + mods.Dexterity; defense = 'Leather Armor'; acFormula = `11 ${signed(mods.Dexterity)} Dexterity`;}
    else {
      ac = 10 + mods.Dexterity; defense = 'Unarmored'; acFormula = `10 ${signed(mods.Dexterity)} Dexterity`;
      // Choose the better available base calculation; base formulas never stack.
      if (hero.class === 'Barbarian' && mods.Constitution > 0) {ac += mods.Constitution; defense = 'Barbarian Unarmored Defense'; acFormula += ` ${signed(mods.Constitution)} Constitution`;}
      if (hero.class === 'Monk' && !shield && mods.Wisdom > 0) {ac += mods.Wisdom; defense = 'Monk Unarmored Defense'; acFormula += ` ${signed(mods.Wisdom)} Wisdom`;}
    }
    if(!hero.equipment.items.some(i=>i.quantity>0 && /Armor|Chain Mail|Chain Shirt/.test(i.name))) {
      const dragon = subclassActive(hero,'Draconic Sorcery') ? 10+mods.Dexterity+mods.Charisma : 0;
      const dance = !shield && subclassActive(hero,'College of Dance') ? 10+mods.Dexterity+mods.Charisma : 0;
      if(Math.max(dragon,dance)>ac){ac=Math.max(dragon,dance);defense=dragon>=dance?'Draconic Resilience':'Dazzling Footwork';acFormula=`10 ${signed(mods.Dexterity)} Dexterity ${signed(mods.Charisma)} Charisma`;}
      const woven = sub.acBase ? 10+mods.Dexterity+mods[sub.acBase] : 0;
      if(woven>ac){ac=woven;defense=sub.acBaseName;acFormula=`10 ${signed(mods.Dexterity)} Dexterity ${signed(mods[sub.acBase])} ${sub.acBase}`;}
    }
    if (shield) {ac += shield; defense += ' + Shield'; acFormula += ' +2 Shield';}
    if (slung) armorNote = (armorNote ? armorNote + ' ' : '') + 'Your shield is on your back while both hands hold your weapon: it adds nothing to your armor class.';
    const armored = hero.equipment.items.some(i=>i.quantity>0 && /Armor|Chain Mail|Chain Shirt/.test(i.name));
    for (const b of sub.acBonus) if (b.when==='any' || (b.when==='armor' && armored) || (b.when==='unarmored' && !armored && !shield)) {ac += b.n; acFormula += ` +${b.n} ${b.name}`;}
    // Magic worn or carried (a geared hero's equipment.magic: +N armour or shield, protection, bracers).
    const magic = hero.equipment.magic;
    if (magic?.ac > 0) {ac += magic.ac; acFormula += ' ' + magic.acText.join(' ');}
  }
  // Speed and darkvision come from the species (a Wood Elf or a Goliath moves 35 feet); Chain Mail without Strength 13
  // takes 10 feet off.
  const kind = speciesProfile(hero), heavy = hero.equipment?.items?.some(i => i.name === 'Chain Mail' && i.quantity > 0) && hero.scores.Strength < 13;
  const speed = kind.speed - (heavy ? 10 : 0), speedFormula = `${kind.speed} ft ${kind.species}${heavy ? ' −10 Chain Mail without Strength 13' : ''}`;
  return {available:true,speed,speedFormula,darkvision:kind.darkvision,size:kind.size,hp,hpFormula,hitDie:`1d${hitDice[hero.class]}`,ac,defense,acFormula,armorNote,initiative,initiativeFormula,proficiency,initiativeAdvantage:subclassActive(hero,'Champion') || (hero.class==='Barbarian' && hero.level>=7) || sub.initiativeAdvantage,criticalThreshold:Math.min(sub.crit,subclassActive(hero,'Champion') ? (hero.level>=15?18:19) : 20)};
}

export function rollResultText(text){
 return text.replace(/(save) (\d+) \+ ([-\d]+) vs DC (\d+)/g,(_,kind,die,bonus)=>kind+' '+(Number(die)+Number(bonus)))
 .replace(/d20 (?:\[[^\]]+\]|\d+)[^=\n]*= ([-\d]+) vs (?:your )?(?:AC|DC) \d+/g,'roll $1')
 .replace(/(save|check) (\d+) \+ ([-\d]+) vs DC \d+/g,(_,kind,die,bonus)=>kind+' '+(Number(die)+Number(bonus)))
 .replace(/\[[^\]]+\] \+ [^;]+; restored (\d+) HP/g,'restored $1 HP')
 .replace(/(Magic Missile:).*?= (\d+) Force damage/g,'$1 $2 Force damage')
 .replace(/\[[^\]]+\] \+ \d+ = (\d+)/g,'$1')
 .replace(/(\d+d\d+) \[[^\]]+\](?: [+-]\d+)? = (\d+)/g,'$2');
}
