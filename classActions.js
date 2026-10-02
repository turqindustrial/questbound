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
  if(hero.class==='Fighter')add('wind','Second Wind','Bonus action · Heal 1d10 plus your Fighter level. You can still take your main action.','wind',windLimit(hero),true);
  if(hero.class==='Paladin')add('hands','Lay on Hands','Bonus action · Spend your remaining healing pool on yourself, up to missing HP.','hands',5*hero.level,true);
  if(hero.class==='Monk')add('strike','Martial Arts strike','Bonus action · An unarmed attack using your Martial Arts die plus Strength or Dexterity.',null,null,true);
  return actions;
}
// Second Wind uses by Fighter level.
export const windLimit=hero=>hero.level>=10?4:hero.level>=4?3:2;
// Bonus actions worth offering right now in a fight: a class feature with uses left, a healing draught, or a
// bonus-action spell that can still be cast this turn. Healing is only offered to someone who is hurt. The engine
// pauses a turn for these after the action, so the player can use one or end the turn.
export function bonusOptions(hero,game,health,maximum){
  if(game.stage!=='combat'||game.bonusUsed||!validLevel(hero.level))return [];
  const hurt=(health?.current??maximum)<maximum,used=game.resources??{},options=[];
  if(hero.class==='Fighter'&&hurt&&(used.wind??0)<windLimit(hero))options.push({id:'class:wind',name:'Second Wind'});
  if(hero.class==='Paladin'&&hurt&&(used.hands??0)<5*hero.level)options.push({id:'class:hands',name:'Lay on Hands'});
  if(hero.class==='Monk')options.push({id:'class:strike',name:'Martial Arts strike'});
  if(hurt&&(game.potions??0)>0)options.push({id:'potion',name:'Healing draught'});
  for(const spell of knownSpells(hero).filter(s=>s.castingTime==='Bonus Action')){
    const effect=automaticEffects[spell.id],costs=slotChoices(hero,game,spell).filter(cost=>cost===0||!game.slotSpentThisTurn);
    if(!costs.length||(effect?.heal&&!hurt)||game.concentration?.id===spell.id)continue;
    options.push({id:'spell:'+spell.id,name:spell.name,spell:spell.id,automatic:!!effect});
  }
  return options;
}
// Short rests between long rests, as in Baldur's Gate 3: two, or three for a Bard of level 2 or more (Song of Rest).
export const shortRestLimit=hero=>2+(hero.class==='Bard'&&hero.level>=2?1:0);
export function resolveClassAction(hero,game,hp,maximum,id,random=Math.random,target={ac:11,saves:{Dexterity:2,Wisdom:0}}) {
  const option=classActions(hero,game).find(a=>a.id===id&&!a.disabled);if(!option)return null;
  if(id==='wind'&&hp.current>=maximum)return null;
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
