import {requestSpell,knownSpells,automaticEffects,spellCostOptions} from './spellRules';
import {modifier,validLevel,martialDie,proficiencyBonus} from './characterRules';
import {rollAttack,rollDamage} from './weaponRules';
import {spellLibrary,slotChoices} from './spellOptions';
import {offhandWeapons,masteryOf,withMark} from './masteryRules';
import {npcScene,npcMaxHP,npcLore} from './npcRules';
import {subclassAction,subclassUses,subclassRiderRoll,subclassDefended,subclassScaled} from './subclassRules';

export const castingAbilities={Artificer:'Intelligence',Bard:'Charisma',Cleric:'Wisdom',Druid:'Wisdom',Paladin:'Charisma',Ranger:'Wisdom',Sorcerer:'Charisma',Warlock:'Charisma',Wizard:'Intelligence'};
export function classActions(hero,game) {
  if(!validLevel(hero.level))return [];
  const used=game.resources??{},actions=[];
  const add=(id,name,description,resource,limit,bonus=false)=>actions.push({id,name,description,resource,limit,bonus,remaining:resource?Math.max(0,limit-(used[resource]??0)):null,disabled:!!((resource&&(used[resource]??0)>=limit)||(bonus&&game.bonusUsed))});
  // Compatibility for older action callers; the on-screen spell panel uses the same resolver.
  for(const spell of knownSpells(hero).filter(s=>automaticEffects[s.id]&&!automaticEffects[s.id].narrated))actions.push({id:spell.id,name:spell.name,description:spell.description,remaining:null,disabled:!slotChoices(hero,game,spell).length,bonus:spell.castingTime==='Bonus Action'});
  if(hero.class==='Fighter')add('wind','Second Wind','Bonus action · Heal 1d10 plus your Fighter level. You can still take your main action.','wind',windLimit(hero),true);
  if(hero.class==='Paladin')add('hands','Lay on Hands','Bonus action · Spend your remaining healing pool on yourself, up to missing HP.','hands',5*hero.level,true);
  if(hero.class==='Monk')add('strike','Martial Arts strike','Bonus action · An unarmed attack using your Martial Arts die plus Strength or Dexterity.',null,null,true);
  if(surgeLimit(hero)>0)add('surge','Action Surge','Free · One more action this turn (not a spell). Back after a short or long rest.','surge',surgeLimit(hero));
  // The subclass's own action (subclassRules.js), its uses counted in resources.feat.
  const sub=subclassAction(hero);
  if(sub)add(sub.id,sub.name,sub.description,'feat',subclassUses(hero,sub.uses),sub.bonus);
  return actions;
}
// Action Surge (a Fighter from level 2, 2024 rules): one more action on your turn, though not the Magic action; once
// per short or long rest, twice from level 17 (still once a turn). `game.surged` marks the turn it was used in.
export const surgeLimit=hero=>hero?.class==='Fighter'&&(hero.level??1)>=2?((hero.level??1)>=17?2:1):0;
export const surgeReady=(hero,game)=>surgeLimit(hero)>0&&!game.surged&&(game.resources?.surge??0)<surgeLimit(hero);
// What a move costs on a turn (2024 rules): 'action', 'bonus' or 'free'. An attack is one action however many blows
// Extra Attack makes; drinking or giving a healing draught, Second Wind, Lay on Hands, a Monk's strike, the other
// hand's light weapon and bonus-action spells are bonus actions; ending the turn, Action Surge and a Nick strike are free.
export function turnCost(hero,game,action){
  const fight=game.stage==='combat'||!!game.npcCombat?.active;
  if(action==='end-turn'||action==='class:surge')return 'free';
  if(typeof action==='string'&&action.startsWith('offhand:')){const w=offhandWeapons(hero,game.lightAttack?.weapon).find(o=>o.name===action.slice(8));return w&&masteryOf(hero,w)==='Nick'&&!game.nickUsed?'free':'bonus';}
  if(['potion','class:wind','class:hands','class:strike'].includes(action)||typeof action==='string'&&action.startsWith('drink:'))return fight?'bonus':'action';
  if(action?.type==='give-potion')return fight?'bonus':'action';
  {const sub=subclassAction(hero);if(sub?.bonus&&action==='class:'+sub.id)return fight?'bonus':'action';}
  if(action?.type==='spell'){const spell=knownSpells(hero).find(s=>s.id===action.request?.id);if(!spell)return 'action';if(spell.castingTime==='Reaction')return 'free';return spell.castingTime==='Bonus Action'&&!automaticEffects[spell.id]?.asAction?'bonus':'action';}
  return 'action';
}
// What the hero still has this turn, in words (for the Dungeon Master and the screen), or null outside a fight.
export function turnLeft(hero,game){
  const fight=game.stage==='combat'||!!game.npcCombat?.active;if(!fight)return null;
  const holder=game.turnOrder?.order?.[game.turnOrder.at]?.id;
  if(game.party&&holder&&holder!==game.party.lead)return "nothing: it is another hero's turn";
  const a=!game.actionUsed,b=!game.bonusUsed;
  let t=a&&b?'their action and their bonus action':a?'their action (the bonus action is spent)':b?'only their bonus action (the action is spent)':'nothing but ending the turn';
  if(a&&game.surged)t+="; this action is Action Surge's extra one, which cannot cast a spell";
  else if(!a&&surgeReady(hero,game))t+='; Action Surge (free) would give them one more action';
  if(game.slotSpentThisTurn)t+='; a spell slot is already spent this turn, so only cantrips can still be cast';
  return t;
}
// Second Wind uses by Fighter level.
export const windLimit=hero=>hero.level>=10?4:hero.level>=4?3:2;
// Bonus actions worth offering right now in a fight: a class feature with uses left, a healing draught, or a
// bonus-action spell that can still be cast this turn. Healing is only offered to someone who is hurt. The engine
// pauses a turn for these after the action, so the player can use one or end the turn.
export function bonusOptions(hero,game,health,maximum){
  if(game.stage!=='combat'||!validLevel(hero.level))return [];
  // Two-weapon fighting: after an attack with a Light weapon, the other hand's Light weapon (a bonus action, or part
  // of the Attack action with Nick).
  const offhand=[];
  if(game.lightAttack&&!game.nickUsed)for(const w of offhandWeapons(hero,game.lightAttack.weapon)){const nick=masteryOf(hero,w)==='Nick'&&!game.nickUsed;if(nick||!game.bonusUsed)offhand.push({id:'offhand:'+w.name,name:'Off-hand '+w.name,nick});}
  if(game.bonusUsed)return offhand;
  const hurt=(health?.current??maximum)<maximum,used=game.resources??{},options=[...offhand];
  if(hero.class==='Fighter'&&hurt&&(used.wind??0)<windLimit(hero))options.push({id:'class:wind',name:'Second Wind'});
  if(hero.class==='Paladin'&&hurt&&(used.hands??0)<5*hero.level)options.push({id:'class:hands',name:'Lay on Hands'});
  if(hero.class==='Monk')options.push({id:'class:strike',name:'Martial Arts strike'});
  // A subclass's bonus action with uses left: healing only when hurt, temporary hit points only when they would add some.
  const sub=subclassAction(hero);
  if(sub?.bonus&&(used.feat??0)<subclassUses(hero,sub.uses)&&(!sub.effect.heal||hurt)&&(!sub.effect.temp||(health?.temp??0)<subclassTempFloor(hero,sub)))options.push({id:'class:'+sub.id,name:sub.name});
  if(hurt&&(game.potions??0)>0)options.push({id:'potion',name:'Healing draught'});
  // Giving a healing draught to someone beside you is a bonus action too (2024 rules): a hurt or fallen person here,
  // or another hero of the party.
  options.push(...potionGifts(game));
  for(const spell of knownSpells(hero).filter(s=>s.castingTime==='Bonus Action')){
    const effect=automaticEffects[spell.id],costs=spellCostOptions(hero,game,spell).filter(cost=>cost!=='ritual'&&(cost===0||cost==='species'||!game.slotSpentThisTurn));
    if(!costs.length||(effect?.heal&&!hurt)||game.concentration?.id===spell.id||(effect?.smite&&!game.lastHit)||spell.castingTime==='Reaction')continue;
    options.push({id:'spell:'+spell.id,name:spell.name,spell:spell.id,automatic:!!effect});
  }
  return options;
}
// Who could be given a healing draught right now: people here who are hurt (or lie senseless), and the party's other
// heroes who are hurt or down. Each is {id, name, action}.
export function potionGifts(game){
  if((game.potions??0)<=0)return [];
  const list=[];
  for(const n of npcScene(game)){if(!n.present||n.fate==='dead')continue;const most=npcMaxHP(n.id,game);if((game.npcHP?.[n.id]??most)<most)list.push({id:'give-potion:'+n.id,name:'Give '+(npcLore(game,n.id)?.name??n.name)+' a healing draught',action:{type:'give-potion',target:n.id}});}
  const p=game.party;
  if(p?.members&&typeof p.lead==='string')for(const [id,m] of Object.entries(p.members)){if(id===p.lead||m.status==='dead')continue;const most=m.stats?.hp??1,hp=m.status==='up'?(m.health?.current??most):0;if(m.status==='down'||hp<most){let name='A hero';try{name=JSON.parse(m.character)?.name??name;}catch{}list.push({id:'give-potion:party:'+id,name:'Give '+name+' a healing draught',action:{type:'give-potion',target:'party:'+id}});}}
  return list;
}
// Short rests between long rests, as in Baldur's Gate 3: two, or three for a Bard of level 2 or more (Song of Rest).
export const shortRestLimit=hero=>2+(hero.class==='Bard'&&hero.level>=2?1:0);
// The least temporary hit points a subclass action grants (worth offering only to someone with fewer).
export function subclassTempFloor(hero,sub){const t=sub?.effect?.temp;if(!t)return 0;return t.count+(t.plus==='level'?hero.level:t.plus==='twiceLevel'?2*hero.level:Number.isInteger(t.plus)?t.plus:modifier(hero.scores?.[t.plus]??10));}
export function resolveClassAction(hero,game,hp,maximum,id,random=Math.random,target={ac:11,saves:{Dexterity:2,Wisdom:0}}) {
  const option=classActions(hero,game).find(a=>a.id===id&&!a.disabled);if(!option)return null;
  if(id==='wind'&&hp.current>=maximum)return null;
  const spell=spellLibrary.find(s=>s.id===id);
  if(spell){const slot=slotChoices(hero,game,spell)[0];const result=requestSpell(hero,game,hp,maximum,{id,slot,intent:'Use the supported effect on the wisp or yourself.',componentsConfirmed:true},random,target);return result.error||result.waiting?null:{...result,resources:result.game.resources??{}};}
  const resources={...game.resources},logs=[];let current=hp.current,damage=0;
  const sub=subclassAction(hero);
  if(sub&&id===sub.id)return resolveSubclassAction(hero,game,hp,maximum,sub,random,target);
  let next=game;
  if(id==='wind'){
    const die=1+Math.floor(random()*10);current=Math.min(maximum,current+die+hero.level);resources.wind=(resources.wind??0)+1;logs.push(`Second Wind: ${die} + ${hero.level}; restored ${current-hp.current} HP.`);
  } else if(id==='hands'){
    const healed=Math.min(maximum-current,option.remaining);if(healed===0)return null;
    resources.hands=(resources.hands??0)+healed;current+=healed;logs.push(`Lay on Hands restores ${healed} HP and spends ${healed} healing points.`);
  } else if(id==='strike'){
    const bonus=Math.max(modifier(hero.scores.Strength),modifier(hero.scores.Dexterity)),attackBonus=bonus+proficiencyBonus(hero.level);
    const attack=rollAttack({attackBonus},'normal',random),hit=!attack.miss&&(attack.critical||attack.total>=target.ac);
    logs.push(`Martial Arts strike: d20 [${attack.dice.join(', ')}] + ${attackBonus} vs AC ${target.ac}. ${attack.critical?'Critical hit!':hit?'Hit.':'Miss.'}`);
    if(hit){const roll=rollDamage({count:1,die:martialDie(hero.level),bonus},attack.critical,random);damage=roll.total;logs.push(`${damage} bludgeoning damage (dice ${roll.dice.join(', ')}).`);
      // A subclass's extra on a Martial Arts hit (Serpent's Fang, Slip Behind), once a turn.
      const extra=subclassRiderRoll(hero,game,{name:'Unarmed Strike',type:'Bludgeoning',unarmed:true,monk:true},{key:target.key??'foe',called:target.called,critical:attack.critical,target,wounded:target.wounded,firstRound:target.firstRound,companion:target.companion},random);
      if(extra){next=extra.game;damage+=extra.damage;logs.push(...extra.lines);}}
  }
  return {resources,health:{current,temp:hp.temp},damage,logs,bonus:option.bonus,...(next!==game?{game:next}:{})};
}
// A subclass's action (subclassRules.js): healing, temporary hit points, a foe thrown off its next attack, an opening
// for the hero's next attack, or a strike the creature saves against. `target` is the creature's stats with its key
// ('foe' or 'ally:N') and how to call it. Returns null when it cannot be used now (at full health for healing).
function resolveSubclassAction(hero,game,hp,maximum,sub,random,target){
  const e=sub.effect,mod=a=>modifier(hero.scores?.[a]??10),plusOf=p=>p==='level'?hero.level:p==='twiceLevel'?2*hero.level:Number.isInteger(p)?p:mod(p);
  const roll=(count,die)=>Array.from({length:count},()=>1+Math.floor(random()*die)),sum=a=>a.reduce((n,v)=>n+v,0);
  const key=target?.key??'foe',called=target?.called??'the foe',dc=8+proficiencyBonus(hero.level)+mod(castingAbilities[hero.class]??'Strength');
  const resources={...game.resources,feat:(game.resources?.feat??0)+1},logs=[];let next=game,current=hp.current,temp=hp.temp??0,damage=0;
  const save=ability=>{const die=1+Math.floor(random()*20),bonus=target?.saves?.[ability]??0;return {die,bonus,total:die+bonus,success:die+bonus>=dc,text:`${ability} save d20 [${die}] + ${bonus} = ${die+bonus} vs DC ${dc}`};};
  const plusText=n=>n?(n>0?' + ':' − ')+Math.abs(n):'';
  if(e.heal){
    if(current>=maximum)return null;
    const dice=roll(e.heal.count,e.heal.die),plus=plusOf(e.heal.plus),amount=Math.max(1,sum(dice)+plus);current=Math.min(maximum,current+amount);
    logs.push(`${sub.name}: [${dice.join(', ')}]${plusText(plus)}; restored ${current-hp.current} HP.`);
  } else if(e.temp){
    const dice=roll(e.temp.count,e.temp.die),plus=plusOf(e.temp.plus),amount=Math.max(1,sum(dice)+plus);
    logs.push(`${sub.name}: ${dice.length?'['+dice.join(', ')+']'+plusText(plus)+' = ':''}${amount} temporary HP${amount>temp?'':'; you keep the '+temp+' you already have'}.`);
    temp=Math.max(temp,amount);
  } else if(e.mark){
    const words={sapped:'has disadvantage on its next attack',prone:'is knocked prone'}[e.mark];
    if(e.save){const s=save(e.save);logs.push(`${sub.name}: ${called} makes a ${s.text}: ${s.success?'success. It shrugs it off.':'failure. It '+words+'.'}`);if(!s.success)next=withMark(next,key,{[e.mark]:true});}
    else{next=withMark(next,key,{[e.mark]:true});logs.push(`${sub.name}: you fade half out of sight. The next attack ${called} makes has disadvantage.`);}
  } else if(e.vex){
    next={...next,vex:{target:key,fresh:true}};logs.push(`${sub.name}: your next attack against ${called} has advantage.`);
  } else if(e.strike){
    const st=e.strike,count=subclassScaled(sub.scale,hero.level,st.count),s=save(st.save),dice=roll(count,st.die),raw=sum(dice),landed=s.success?(st.half?Math.floor(raw/2):0):raw;
    damage=subclassDefended(target,st.type,landed);
    if(!s.success&&st.mark)next=withMark(next,key,{[st.mark]:true});
    logs.push(`${sub.name}: ${called} makes a ${s.text}: ${s.success?'success':'failure'}. ${damage} ${st.type} damage (${count}d${st.die} [${dice.join(', ')}]${s.success&&st.half?', halved':''}${damage!==landed?'; '+landed+' before its defences':''})${!s.success&&st.mark==='prone'?'; it is knocked prone':''}.`);
  }
  return {resources,health:{current,temp},damage,logs,bonus:!!sub.bonus,game:next,key};
}
