import {modifier,martialDie,proficiencyBonus,subclassActive} from './characterRules';
import {combatBasics} from './combatRules';
import {loadoutFor,classWeapons} from './equipmentRules';
import {subclassPassive} from './subclassRules';
// How well a weapon suits this hero: the chance to hit an ordinary foe times the damage of a hit.
const weaponScore=w=>Math.max(.05,Math.min(.95,(w.attackBonus+8)/20))*(w.heavyDisadvantage?.5:1)*Math.max(1,(w.count*(w.die+1))/2+w.bonus+(w.magic??0));

// Only weapons available in the current starter kits are supported. `light` weapons can fight two at once, and
// `mastery` is the weapon's mastery property (masteryRules.js), both as in the 2024 rules (SRD 5.2). A `twoHands`
// weapon needs both hands; a `versatile` one deals the die named there when held in both (see Hands below).
export const weapons = {
  Dagger:{die:4,type:'Piercing',finesse:true,light:true,range:'Thrown 20/60 ft.',mastery:'Nick'},
  Handaxe:{die:6,type:'Slashing',light:true,range:'Thrown 20/60 ft.',mastery:'Vex'},
  Javelin:{die:6,type:'Piercing',range:'Thrown 30/120 ft.',mastery:'Slow'},
  Mace:{die:6,type:'Bludgeoning',mastery:'Sap'},
  Quarterstaff:{die:6,type:'Bludgeoning',versatile:8,mastery:'Topple'},
  Sickle:{die:4,type:'Slashing',light:true,mastery:'Nick'},
  Spear:{die:6,type:'Piercing',versatile:8,range:'Thrown 20/60 ft.',mastery:'Sap'},
  Greataxe:{die:12,type:'Slashing',martial:true,heavy:true,twoHands:true,mastery:'Cleave'},
  Greatsword:{count:2,die:6,type:'Slashing',martial:true,heavy:true,twoHands:true,mastery:'Graze'},
  Flail:{die:8,type:'Bludgeoning',martial:true,mastery:'Sap'},
  Longsword:{die:8,type:'Slashing',martial:true,versatile:10,mastery:'Sap'},
  Scimitar:{die:6,type:'Slashing',martial:true,finesse:true,light:true,mastery:'Nick'},
  Shortsword:{die:6,type:'Piercing',martial:true,finesse:true,light:true,mastery:'Vex'},
  Shortbow:{die:6,type:'Piercing',ranged:true,twoHands:true,range:'Range 80/320 ft.',mastery:'Vex'},
  Longbow:{die:8,type:'Piercing',martial:true,ranged:true,heavy:true,twoHands:true,range:'Range 150/600 ft.',mastery:'Slow'},
  // Found, bought or carried off the fallen (not in any starter kit): the common versatile and two-handed weapons.
  Battleaxe:{die:8,type:'Slashing',martial:true,versatile:10,mastery:'Topple'},
  Trident:{die:8,type:'Piercing',martial:true,versatile:10,range:'Thrown 20/60 ft.',mastery:'Topple'},
  Maul:{count:2,die:6,type:'Bludgeoning',martial:true,heavy:true,twoHands:true,mastery:'Topple'},
  Glaive:{die:10,type:'Slashing',martial:true,heavy:true,twoHands:true,reach:true,mastery:'Graze'},
  Halberd:{die:10,type:'Slashing',martial:true,heavy:true,twoHands:true,reach:true,mastery:'Cleave'},
};
// ---------- Hands ----------
// The host, 2026-10-11: "2 handed weapons should take up both hands unless otherwise capable of dual wielding, even so
// there should be a small bonus added for 2 handedly holding a weapon with one handed potential."
// A shield takes a hand. A two-handed weapon (greatsword, greataxe, the bows) takes both: while one is the weapon in
// hand, the shield is slung on the back and adds nothing to armor class, and no other hand strikes. A hero with a
// shield fights with a one-handed weapon unless the player takes a two-handed one in hand (game.wield), or they carry
// no one-handed weapon to fight with. A versatile weapon (longsword, spear, quarterstaff) held in both hands, with no
// shield in use, deals its larger die; one-handed (a shield on the arm, a throw, a grapple held in the other hand) it
// deals its own. Two-weapon fighting needs two Light weapons, and no Light weapon is versatile, so the two never meet.
const weaponKindOf = item => weapons[item.base] ? item.base : item.name.includes('(Quarterstaff)') ? 'Quarterstaff' : item.name;
const carriedItems = hero => (hero?.equipment?.items ?? []).filter(item => item.quantity > 0);
const armsOf = hero => carriedItems(hero).map(item => ({name: item.name.includes('(Quarterstaff)') ? 'Quarterstaff' : item.name, w: weapons[weaponKindOf(item)]})).filter(a => a.w);
// The player took a two-handed weapon in hand (game.wield): both hands are on it.
export const twoHanderInHand = hero => !!armsOf(hero).find(a => a.name === hero?.equipment?.wield)?.w.twoHands;
export function shieldSlung(hero) {
  const items = carriedItems(hero);
  if (!items.some(item => item.name === 'Shield')) return false;
  const arms = armsOf(hero), chosen = arms.find(a => a.name === hero.equipment.wield);
  if (chosen) return !!chosen.w.twoHands;
  return !arms.some(a => !a.w.ranged && !a.w.twoHands) && arms.some(a => !a.w.ranged && a.w.twoHands);
}
// Whether the hero has a shield on the arm now (carried, and not slung for a two-handed weapon).
export const shieldInUse = hero => carriedItems(hero).some(item => item.name === 'Shield') && !shieldSlung(hero);
// A versatile weapon held in one hand (thrown, or with the other hand busy): its own die.
export const oneHanded = weapon => weapon?.grip === 'two' && weapon.oneHandDie ? {...weapon, die: weapon.oneHandDie, grip: 'one'} : weapon;
// How a versatile weapon is held, for the screens: "two-handed" in both hands, "one-handed" with a shield.
export const gripText = weapon => weapon?.versatile ? (weapon.grip === 'two' ? 'two-handed' : 'one-handed') : '';
export function weaponAttacks(hero) {
  if (!combatBasics(hero).available || !hero.equipment?.items) return [];
  const has = name => hero.equipment.items.some(item => item.name === name && item.quantity > 0), shieldUp = shieldInUse(hero);
  const armored = hero.equipment.items.some(item => /Armor|Chain Mail|Chain Shirt/.test(item.name) && item.quantity > 0);
  const attacks = hero.equipment.items.filter(item => item.quantity > 0).flatMap(item => {
    // A magic weapon ('Longsword +1', or a name of its own) fights as its base kind, with its plus to attack and damage.
    const name = item.name.includes('(Quarterstaff)') ? 'Quarterstaff' : item.name, base = weapons[item.base] ? item.base : name;
    const weapon = weapons[base], magic = Number.isInteger(item.plus) ? item.plus : 0;
    if (!weapon) return [];
    const monk = hero.class === 'Monk' && !armored && !shieldUp && !weapon.ranged && (!weapon.martial || weapon.finesse);
    // Shillelagh (spellRules.js): a club or quarterstaff strikes with the caster's spellcasting ability when that is better.
    const staff = !!hero.shillelagh && ['Club', 'Quarterstaff'].includes(name) && (hero.scores[hero.shillelagh] ?? 0) > hero.scores.Strength;
    const ability = staff ? hero.shillelagh : weapon.ranged || ((weapon.finesse || monk) && hero.scores.Dexterity > hero.scores.Strength) ? 'Dexterity' : 'Strength';
    const bonus = modifier(hero.scores[ability]);
    const proficient = subclassActive(hero,'College of Valor') || subclassPassive(hero).martial || (hero.class==='Artificer' && subclassActive(hero,'Battle Smith')) || !weapon.martial || ['Barbarian','Fighter','Paladin','Ranger'].includes(hero.class) || (['Rogue','Monk'].includes(hero.class) && weapon.finesse);
    // Shillelagh (SRD 5.2): a d8, then a d10 at level 5, a d12 at 11 and 2d6 at 17.
    const shilled = !!hero.shillelagh && ['Club', 'Quarterstaff'].includes(name), twoDice = shilled && hero.level >= 17;
    // Both hands on a versatile weapon (no shield on the arm): its larger die, before Shillelagh or Martial Arts.
    const both = !!weapon.versatile && !shieldUp, dieFor = own => twoDice ? 6 : shilled ? Math.max(own, hero.level >= 11 ? 12 : hero.level >= 5 ? 10 : 8) : monk ? Math.max(martialDie(hero.level),own) : own;
    const die = dieFor(both ? weapon.versatile : weapon.die), grip = weapon.twoHands || both ? 'two' : 'one';
    const heavyDisadvantage = !!weapon.heavy && hero.scores[weapon.ranged ? 'Dexterity' : 'Strength'] < 13;
    return [{...weapon,name,...(base !== name ? {base} : {}),...(magic ? {magic} : {}),die,grip,...(both ? {oneHandDie:dieFor(weapon.die)} : {}),count:twoDice ? 2 : weapon.count ?? 1,ability,bonus,attackBonus:bonus+(proficient?proficiencyBonus(hero.level):0)+magic,proficient,monk,heavyDisadvantage,
      criticalThreshold:combatBasics(hero).criticalThreshold,blocked:weapon.twoHands && shieldUp ? 'This weapon needs both hands: take it in hand from your inventory, and your shield goes on your back.' : weapon.ranged && !has('Arrow') ? 'No arrows available.' : '',...(weapon.twoHands && shieldUp ? {handsBlocked:true} : {})}];
  });
  // The main weapon leads: the close-range weapon that suits this hero best (a frail wizard's dagger, a strong
  // one's staff), the class's usual choice settling ties.
  const usual = classWeapons[hero.class] ?? [], rank = w => { const i = usual.indexOf(w.base ?? w.name); return i < 0 ? 99 : i; };
  const best = attacks.filter(w => !w.ranged && !w.blocked).sort((a,b) => weaponScore(b) - weaponScore(a) || rank(a) - rank(b))[0]?.name ?? loadoutFor(hero).mainWeapon;
  // A weapon the player chose to wield (from the inventory) leads instead, bow or blade, while they can use it.
  const chosen = hero.equipment.wield, main = chosen && attacks.some(w => w.name === chosen && !w.blocked) ? chosen : best;
  return attacks.sort((a,b)=>Number(b.name===main)-Number(a.name===main));
}
// Whether the player can take this weapon in hand (game.wield): one ready to use, or a two-handed one kept from use
// only by the shield on the arm (taking it in hand slings the shield).
export const canTakeInHand = (hero, name) => weaponAttacks(hero).some(w => w.name === name && (!w.blocked || w.handsBlocked));
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
  // Hands: a two-handed weapon and a shield do not go together.
  for (const w of weaponAttacks(hero)) if (w.handsBlocked) notes.push('The ' + w.name + ' needs both hands: with your shield on your arm it stays on your back. Take it in hand from your inventory to fight with it; your shield is then slung and adds nothing to your armor class.');
  if (shieldSlung(hero)) notes.push('Your shield is slung on your back while both hands hold your ' + (weaponAttacks(hero).find(w => w.twoHands && !w.blocked)?.name ?? 'weapon') + ': it adds nothing to your armor class. Take a one-handed weapon in hand to raise it again.');
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
// A weapon with the Thrown property (Dagger, Handaxe, Javelin, Spear) can also be thrown: the same attack and damage
// as a ranged attack (disadvantage once the foe is within 5 feet, or beyond normal range), and it leaves your hand
// until you gather it up after the fight (inventoryRules.js).
export const canThrow=weapon=>/^Thrown\b/.test(String(weapon?.range??''));
export const thrownAttack=weapon=>({...oneHanded(weapon),thrown:true});
// Normal and long range in feet for a bow ("Range 80/320 ft.") or a throw ("Thrown 20/60 ft.").
export function weaponRange(weapon) {
  const m = String(weapon?.range ?? '').match(/(\d+)\/(\d+)/);
  return m ? {normal:Number(m[1]),long:Number(m[2])} : null;
}
// A bow shot or a throw has disadvantage with an enemy within 5 feet (once a foe has closed in) or beyond normal range.
export function rangedMode(weapon, {closeEnemy=false,distance=5}={}) {
  if (!weapon?.ranged && !weapon?.thrown) return 'normal';
  const range = weaponRange(weapon);
  return closeEnemy || (range && distance > range.normal) ? 'disadvantage' : 'normal';
}
// The damage arithmetic as the log shows it: "1d8 [6] + 3", or "1 + 2" for a plain unarmed blow.
export function damageMath(weapon, roll) {
  const bonus = (weapon.bonus >= 0 ? ' + ' + weapon.bonus : ' − ' + Math.abs(weapon.bonus)) + (weapon.magic ? ' + ' + weapon.magic + ' magic' : '');
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
  // A magic weapon's plus is added to every hit (Cleave and the other hand drop only the ability bonus).
  return {dice,total:Math.max(0,dice.reduce((sum,n)=>sum+n,0)+weapon.bonus+(weapon.magic??0))};
}

export function attacksPerAction(hero) {
  if(hero.class==='Fighter')return hero.level>=20?4:hero.level>=11?3:hero.level>=5?2:1;
  if(['Barbarian','Monk','Paladin','Ranger'].includes(hero.class) && hero.level>=5)return 2;
  // A subclass's second attack (subclassRules.js): Steel Verses, the Armorer and the Battle Smith.
  return subclassPassive(hero).extraAttack ? 2 : 1;
}
