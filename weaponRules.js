import {modifier,martialDie,proficiencyBonus,subclassActive} from './characterRules';
import {combatBasics} from './combatRules';
import {loadoutFor,classWeapons} from './equipmentRules';
// How well a weapon suits this hero: the chance to hit an ordinary foe times the damage of a hit.
const weaponScore=w=>Math.max(.05,Math.min(.95,(w.attackBonus+8)/20))*(w.heavyDisadvantage?.5:1)*Math.max(1,(w.count*(w.die+1))/2+w.bonus);

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
  const attacks = hero.equipment.items.filter(item => item.quantity > 0).flatMap(item => {
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
  });
  // The main weapon leads: the close-range weapon that suits this hero best (a frail wizard's dagger, a strong
  // one's staff), the class's usual choice settling ties.
  const usual = classWeapons[hero.class] ?? [], rank = w => { const i = usual.indexOf(w.name); return i < 0 ? 99 : i; };
  const best = attacks.filter(w => !w.ranged && !w.blocked).sort((a,b) => weaponScore(b) - weaponScore(a) || rank(a) - rank(b))[0]?.name ?? loadoutFor(hero).mainWeapon;
  // A weapon the player chose to wield (from the inventory) leads instead, bow or blade, while they can use it.
  const chosen = hero.equipment.wield, main = chosen && attacks.some(w => w.name === chosen && !w.blocked) ? chosen : best;
  return attacks.sort((a,b)=>Number(b.name===main)-Number(a.name===main));
}
// The gear a hero has ready, with the main weapon chosen for their own abilities (or by the player).
export function readyLoadout(hero) {
  const base = loadoutFor(hero), all = weaponAttacks(hero), first = all[0], best = (first && !first.blocked && first.name === hero.equipment?.wield ? first : all.find(w => !w.ranged && !w.blocked))?.name;
  return {...base, mainWeapon: best ?? base.mainWeapon};
}
// Where a starter kit sits badly with this hero's abilities, in plain words.
export function loadoutWarnings(hero) {
  if (!combatBasics(hero).available || !hero.equipment?.items) return [];
  const has = name => hero.equipment.items.some(item => item.name === name && item.quantity > 0), notes = [], {Strength, Dexterity} = hero.scores;
  if (has('Chain Mail') && Strength < 13) notes.push('Chain Mail needs Strength 13: with ' + Strength + ', your Speed drops by 10 feet.');
  for (const w of weaponAttacks(hero)) if (w.heavyDisadvantage) notes.push(w.name + ' is a heavy weapon: with ' + (w.ranged ? 'Dexterity ' + Dexterity : 'Strength ' + Strength) + ' (under 13), attacks with it have disadvantage.');
  if (hero.class === 'Fighter') {
    const ranged = (hero.fighterKit ?? hero.equipment.kit) === 'ranged';
    if (!ranged && Dexterity >= Strength + 2) notes.push('Your Dexterity is higher than your Strength: the Ranged kit (a longbow, light armor and finesse blades) suits this hero better.');
    if (ranged && Strength >= Dexterity + 2) notes.push('Your Strength is higher than your Dexterity: the Melee kit (chain mail and a greatsword) suits this hero better.');
  }
  return notes;
}
// Everyone can fight with fists, feet or a headbutt: 1 + Strength damage, or the Martial Arts die for an unarmored Monk.
export function unarmedStrike(hero) {
  if (!combatBasics(hero).available) return null;
  const items = hero.equipment?.items ?? [];
  const monk = hero.class === 'Monk' && !items.some(item => item.quantity > 0 && (/Armor|Chain Mail|Chain Shirt/.test(item.name) || item.name === 'Shield'));
  const ability = monk && hero.scores.Dexterity > hero.scores.Strength ? 'Dexterity' : 'Strength', bonus = modifier(hero.scores[ability]);
  return {name:'Unarmed Strike',type:'Bludgeoning',unarmed:true,flat:!monk,die:monk?martialDie(hero.level):1,count:1,ability,bonus,attackBonus:bonus+proficiencyBonus(hero.level),proficient:true,monk,heavyDisadvantage:false,criticalThreshold:combatBasics(hero).criticalThreshold,blocked:''};
}
// What the hero can actually attack with: owned weapons (main weapon first, bows when there are arrows), then bare hands.
export function attackOptions(hero) {
  const unarmed = unarmedStrike(hero);
  return [...weaponAttacks(hero).filter(w => !w.blocked), ...(unarmed ? [unarmed] : [])];
}
// Normal and long range in feet for a bow ("Range 80/320 ft.").
export function weaponRange(weapon) {
  const m = String(weapon?.range ?? '').match(/(\d+)\/(\d+)/);
  return m ? {normal:Number(m[1]),long:Number(m[2])} : null;
}
// A bow shot has disadvantage with an enemy within 5 feet (once a foe has closed in) or beyond normal range.
export function rangedMode(weapon, {closeEnemy=false,distance=5}={}) {
  if (!weapon?.ranged) return 'normal';
  const range = weaponRange(weapon);
  return closeEnemy || (range && distance > range.normal) ? 'disadvantage' : 'normal';
}
// The damage arithmetic as the log shows it: "1d8 [6] + 3", or "1 + 2" for a plain unarmed blow.
export function damageMath(weapon, roll) {
  const bonus = weapon.bonus >= 0 ? ' + ' + weapon.bonus : ' − ' + Math.abs(weapon.bonus);
  return weapon.flat ? '1' + bonus : roll.dice.length + 'd' + weapon.die + ' [' + roll.dice.join(', ') + ']' + bonus;
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
  // A plain unarmed strike rolls no dice, so a critical hit adds nothing to it.
  if (weapon.flat) return {dice:[],total:Math.max(1,1+weapon.bonus)};
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
