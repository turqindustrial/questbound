import {requestSpell,knownSpells,automaticEffects} from './spellRules';
import {modifier,validLevel,martialDie,proficiencyBonus} from './characterRules';
import {rollAttack,rollDamage} from './weaponRules';
import {spellLibrary,slotChoices} from './spellOptions';

export const castingAbilities={Artificer:'Intelligence',Bard:'Charisma',Cleric:'Wisdom',Druid:'Wisdom',Paladin:'Charisma',Ranger:'Wisdom',Sorcerer:'Charisma',Warlock:'Charisma',Wizard:'Intelligence'};
export function classActions(hero,game) {
  if(!validLevel(hero.level))return [];
  const used=game.resources??{},actions=[];
  const add=(id,name,description,resource,limit,bonus=false)=>actions.push({id,name,description,resource,limit,bonus,remaining:resource?Math.max(0,limit-(used[resource]??0)):null,disabled:!!((resource&&(used[resource]??0)>=limit)||(bonus&&game.bonusUsed))});
  // Compatibility for older action callers; the on-screen spell panel uses the same resolver.
  for(const spell of knownSpells(hero).filter(s=>automaticEffects[s.id]))actions.push({id:spell.id,name:spell.name,description:spell.description,remaining:null,disabled:!slotChoices(hero,game,spell).length,bonus:spell.castingTime==='Bonus Action'});
  if(hero.class==='Fighter')add('wind','Second Wind','Bonus action · Heal 1d10 plus your Fighter level. You can still take your main action.','wind',hero.level>=10?4:hero.level>=4?3:2,true);
  if(hero.class==='Paladin')add('hands','Lay on Hands','Bonus action · Spend your remaining healing pool on yourself, up to missing HP.','hands',5*hero.level,true);
  if(hero.class==='Monk')add('strike','Martial Arts strike','Bonus action · An unarmed attack using your Martial Arts die plus Strength or Dexterity.',null,null,true);
  return actions;
}
export function resolveClassAction(hero,game,hp,maximum,id,random=Math.random,target={ac:11,saves:{Dexterity:2,Wisdom:0}}) {
  const option=classActions(hero,game).find(a=>a.id===id&&!a.disabled);if(!option)return null;
  const spell=spellLibrary.find(s=>s.id===id);
  if(spell){const slot=slotChoices(hero,game,spell)[0];const result=requestSpell(hero,game,hp,maximum,{id,slot,intent:'Use the supported effect on the wisp or yourself.',componentsConfirmed:true},random,target);return result.error||result.waiting?null:{...result,resources:result.game.resources??{}};}
  const resources={...game.resources},logs=[];let current=hp.current,damage=0;
  if(id==='wind'){
    const die=1+Math.floor(random()*10);current=Math.min(maximum,current+die+hero.level);resources.wind=(resources.wind??0)+1;logs.push(`Second Wind: ${die} + ${hero.level}; restored ${current-hp.current} HP.`);
  } else if(id==='hands'){
    const healed=Math.min(maximum-current,option.remaining);if(healed===0)return null;
    resources.hands=(resources.hands??0)+healed;current+=healed;logs.push(`Lay on Hands restores ${healed} HP and spends ${healed} healing points.`);
  } else if(id==='strike'){
    const bonus=Math.max(modifier(hero.scores.Strength),modifier(hero.scores.Dexterity)),attackBonus=bonus+proficiencyBonus(hero.level);
    const attack=rollAttack({attackBonus},'normal',random),hit=!attack.miss&&(attack.critical||attack.total>=target.ac);
    logs.push(`Martial Arts strike: d20 [${attack.dice.join(', ')}] + ${attackBonus} vs AC ${target.ac}. ${attack.critical?'Critical hit!':hit?'Hit.':'Miss.'}`);
    if(hit){const roll=rollDamage({count:1,die:martialDie(hero.level),bonus},attack.critical,random);damage=roll.total;logs.push(`${damage} bludgeoning damage (dice ${roll.dice.join(', ')}).`);}
  }
  return {resources,health:{current,temp:hp.temp},damage,logs,bonus:option.bonus};
}
