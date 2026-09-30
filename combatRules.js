import {abilities, modifier, validLevel, proficiencyBonus, subclassActive} from './characterRules';

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
  const laterHP = Math.max(1,Math.floor(hitDice[hero.class]/2)+1+mods.Constitution);
  const hp = Math.max(1,hitDice[hero.class] + mods.Constitution) + (hero.level-1)*laterHP + hero.level*(dwarfBonus+toughBonus) + draconicBonus;
  const hpFormula = `${hitDice[hero.class]} (${hero.class}) ${signed(mods.Constitution)} Constitution${dwarfBonus ? ' +1 Dwarven Toughness' : ''}${toughBonus ? ' +2 Tough' : ''}${hero.level>1 ? ` + ${hero.level-1} × (${laterHP+dwarfBonus+toughBonus}) later levels` : ''}${draconicBonus ? ` +${draconicBonus} Draconic Resilience` : ''}`;
  const alertBonus = hero.originFeat === 'Alert' ? proficiency : 0;
  const gloomBonus=subclassActive(hero,'Gloom Stalker') ? mods.Wisdom : 0;
  const initiative = mods.Dexterity + alertBonus + gloomBonus;
  const initiativeFormula = `${signed(mods.Dexterity)} Dexterity${alertBonus ? ` +${proficiency} Alert` : ''}${gloomBonus ? ` ${signed(gloomBonus)} Dread Ambusher` : ''}`;
  let ac = null, defense = 'Save your starter equipment to calculate armor class.', acFormula = '', armorNote = '';
  if (hero.equipment?.items) {
    const has = name => hero.equipment.items.some(i => i.name === name && i.quantity > 0);
    const shield = has('Shield') ? 2 : 0;
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
    }
    if (shield) {ac += shield; defense += ' + Shield'; acFormula += ' +2 Shield';}
  }
  return {available:true,hp,hpFormula,hitDie:`1d${hitDice[hero.class]}`,ac,defense,acFormula,armorNote,initiative,initiativeFormula,proficiency,initiativeAdvantage:subclassActive(hero,'Champion') || (hero.class==='Barbarian' && hero.level>=7),criticalThreshold:subclassActive(hero,'Champion') ? (hero.level>=15?18:19) : 20};
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
