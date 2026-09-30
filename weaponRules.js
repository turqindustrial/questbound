import {modifier,martialDie,proficiencyBonus,subclassActive} from './characterRules';
import {combatBasics} from './combatRules';
import {loadoutFor} from './equipmentRules';

// Only weapons available in the current starter kits are supported.
export const weapons = {
  Dagger:{die:4,type:'Piercing',finesse:true,range:'Thrown 20/60 ft.'},
  Handaxe:{die:6,type:'Slashing',range:'Thrown 20/60 ft.'},
  Javelin:{die:6,type:'Piercing',range:'Thrown 30/120 ft.'},
  Mace:{die:6,type:'Bludgeoning'},
  Quarterstaff:{die:6,type:'Bludgeoning',versatile:true},
  Sickle:{die:4,type:'Slashing'},
  Spear:{die:6,type:'Piercing',versatile:true,range:'Thrown 20/60 ft.'},
  Greataxe:{die:12,type:'Slashing',martial:true,heavy:true,twoHands:true},
  Greatsword:{count:2,die:6,type:'Slashing',martial:true,heavy:true,twoHands:true},
  Flail:{die:8,type:'Bludgeoning',martial:true},
  Longsword:{die:8,type:'Slashing',martial:true,versatile:true},
  Scimitar:{die:6,type:'Slashing',martial:true,finesse:true},
  Shortsword:{die:6,type:'Piercing',martial:true,finesse:true},
  Shortbow:{die:6,type:'Piercing',ranged:true,twoHands:true,range:'Range 80/320 ft.'},
  Longbow:{die:8,type:'Piercing',martial:true,ranged:true,heavy:true,twoHands:true,range:'Range 150/600 ft.'},
};
export function weaponAttacks(hero) {
  if (!combatBasics(hero).available || !hero.equipment?.items) return [];
  const has = name => hero.equipment.items.some(item => item.name === name && item.quantity > 0);
  const armored = hero.equipment.items.some(item => /Armor|Chain Mail|Chain Shirt/.test(item.name) && item.quantity > 0);
  const loadout=loadoutFor(hero);
  return hero.equipment.items.filter(item => item.quantity > 0).flatMap(item => {
    const name = item.name.includes('(Quarterstaff)') ? 'Quarterstaff' : item.name;
    const weapon = weapons[name];
    if (!weapon) return [];
    const monk = hero.class === 'Monk' && !armored && !has('Shield') && !weapon.ranged && (!weapon.martial || weapon.finesse);
    const ability = weapon.ranged || ((weapon.finesse || monk) && hero.scores.Dexterity > hero.scores.Strength) ? 'Dexterity' : 'Strength';
    const bonus = modifier(hero.scores[ability]);
    const proficient = subclassActive(hero,'College of Valor') || (hero.class==='Artificer' && subclassActive(hero,'Battle Smith')) || !weapon.martial || ['Barbarian','Fighter','Paladin','Ranger'].includes(hero.class) || (['Rogue','Monk'].includes(hero.class) && weapon.finesse);
    const die = monk ? Math.max(martialDie(hero.level),weapon.die) : weapon.die;
    const heavyDisadvantage = !!weapon.heavy && hero.scores[weapon.ranged ? 'Dexterity' : 'Strength'] < 13;
    return [{...weapon,name,die,count:weapon.count ?? 1,ability,bonus,attackBonus:bonus+(proficient?proficiencyBonus(hero.level):0),proficient,monk,heavyDisadvantage,
      criticalThreshold:combatBasics(hero).criticalThreshold,blocked:weapon.twoHands && has('Shield') ? 'This weapon needs two free hands. Shield changes are not available yet.' : weapon.ranged && !has('Arrow') ? 'No arrows available.' : ''}];
  }).sort((a,b)=>Number(b.name===loadout.mainWeapon)-Number(a.name===loadout.mainWeapon));
}
export function rollAttack(weapon, mode='normal', random=Math.random) {
  if (!['normal','advantage','disadvantage'].includes(mode)) throw new Error('Invalid roll mode');
  const advantage = mode === 'advantage';
  const disadvantage = mode === 'disadvantage' || !!weapon.heavyDisadvantage;
  const effective = advantage === disadvantage ? 'normal' : advantage ? 'advantage' : 'disadvantage';
  const dice = Array.from({length:effective === 'normal' ? 1 : 2},()=>1+Math.floor(random()*20));
  const natural = effective === 'advantage' ? Math.max(...dice) : Math.min(...dice);
  return {dice,natural,total:natural+weapon.attackBonus,critical:natural>=(weapon.criticalThreshold??20),miss:natural===1,mode:effective};
}
export function rollDamage(weapon, critical=false, random=Math.random) {
  const dice = Array.from({length:weapon.count*(critical?2:1)},()=>1+Math.floor(random()*weapon.die));
  return {dice,total:Math.max(0,dice.reduce((sum,n)=>sum+n,0)+weapon.bonus)};
}

export function attacksPerAction(hero) {
  if(hero.class==='Fighter')return hero.level>=20?4:hero.level>=11?3:hero.level>=5?2:1;
  if(['Barbarian','Monk','Paladin','Ranger'].includes(hero.class) && hero.level>=5)return 2;
  if(hero.class==='Artificer' && hero.level>=5 && ['Armorer','Battle Smith'].includes(hero.plannedSubclass))return 2;
  if(hero.level>=6 && ((hero.class==='Bard' && hero.plannedSubclass==='College of Valor') || (hero.class==='Wizard' && hero.plannedSubclass==='Bladesinger')))return 2;
  return 1;
}
