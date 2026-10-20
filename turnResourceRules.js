// What is left of a turn to offer as choices (dmContext.js dmChoices): class features and draughts as a bonus action
// in a creature fight or a brawl, a subclass's own action, and a lasting spell used again as the action.
import {npcMaxHP,npcLore} from "./npcRules";
import {windLimit,subclassTempFloor,potionGifts,surgeReady} from "./classActions";
import {subclassAction,subclassUses} from "./subclassRules";
import {offhandWeapons,masteryOf} from "./masteryRules";
import {carriedDraughts} from "./lootRules";
import {combatBasics} from "./combatRules";
import {sustainOptions} from "./lastingSpellRules";
// Class features used as a bonus action in a fight, while they have uses left (healing ones only when hurt, if the
// caller knows the hero's HP).
export function bonusChoices(hero,game,health){
  if(game.stage!=='combat')return [];
  // Two-weapon fighting: after a Light weapon's attack, the other hand's (a bonus action, or with Nick part of the
  // Attack action).
  const offhand=[];
  if(game.lightAttack&&!game.nickUsed)for(const w of offhandWeapons(hero,game.lightAttack.weapon)){const nick=masteryOf(hero,w)==='Nick'&&!game.nickUsed;if(nick||!game.bonusUsed)offhand.push(['offhand:'+w.name,'Strike with the '+w.name+' in your other hand ('+(nick?'Nick: part of your Attack action':'bonus action')+')']);}
  if(game.bonusUsed)return offhand;
  // Health not known is full health, as the rules read it (classActions.js bonusOptions).
  const maximum=combatBasics(hero).hp,hurt=(health?.current??maximum)<maximum,used=game.resources??{},list=[...offhand];
  if(hero.class==='Fighter'&&hurt&&(used.wind??0)<windLimit(hero))list.push(['class:wind','Second Wind (bonus action): regain 1d10 + your level HP']);
  if(hero.class==='Paladin'&&hurt&&(used.hands??0)<5*hero.level)list.push(['class:hands','Lay on Hands on yourself (bonus action)']);
  if(hero.class==='Monk')list.push(['class:strike','Martial Arts strike (bonus action)']);
  // The subclass's own bonus action, while it has uses (subclassRules.js).
  const sub=subclassAction(hero),left=sub?subclassUses(hero,sub.uses)-(used.feat??0):0;
  if(sub?.bonus&&left>0&&(!sub.effect.heal||hurt)&&(!sub.effect.temp||(health?.temp??0)<subclassTempFloor(hero,sub)))list.push(['class:'+sub.id,sub.name+' (bonus action, '+left+' left)']);
  if((game.potions??0)>0&&hurt)list.push(['potion','Drink a healing draught (bonus action)']);
  // Stronger draughts from the pack (Greater, Superior, Supreme healing).
  if(hurt)for(const d of carriedDraughts(game))list.push(['drink:'+d.magic.id,'Drink a '+d.name+' (bonus action)']);
  // Giving a draught to someone hurt or fallen beside you is a bonus action too (2024 rules).
  for(const g of potionGifts(game))list.push([g.id,g.name+' (bonus action)',g.action]);
  // A lasting spell's bonus action (Spiritual Weapon, Heat Metal, the Flaming Sphere), or moving Hex or Hunter's Mark.
  for(const [id,label,action,kind] of sustainOptions(game))if(kind==='bonus')list.push([id,label,action]);
  // Action Surge, once the action is spent: one more action this turn (not a spell).
  if(game.actionUsed&&surgeReady(hero,game))list.push(['class:surge','Action Surge (free): take one more action this turn, though not to cast a spell']);
  return list;
}
// Bonus actions in a brawl, taken before the action (which ends the turn there): a healing draught, Second Wind, Lay on
// Hands, or a draught for someone hurt beside you.
export function brawlBonusChoices(hero,game,health){
  if(!game.npcCombat?.active||game.bonusUsed||game.pendingSpell)return [];
  const maximum=combatBasics(hero).hp,hurt=(health?.current??maximum)<maximum,used=game.resources??{},list=[];
  if(hero.class==='Fighter'&&hurt&&(used.wind??0)<windLimit(hero))list.push(['class:wind','Second Wind (bonus action): regain 1d10 + your level HP']);
  if(hero.class==='Paladin'&&hurt&&(used.hands??0)<5*hero.level)list.push(['class:hands','Lay on Hands on yourself (bonus action)']);
  if((game.potions??0)>0&&hurt)list.push(['potion','Drink a healing draught (bonus action)']);
  if(hurt)for(const d of carriedDraughts(game))list.push(['drink:'+d.magic.id,'Drink a '+d.name+' (bonus action)']);
  // The subclass's own bonus action that heals or shields the hero (subclassRules.js).
  const sub=subclassAction(hero),left=sub?subclassUses(hero,sub.uses)-(used.feat??0):0;
  if(sub?.bonus&&left>0&&((sub.effect.heal&&hurt)||(sub.effect.temp&&(health?.temp??0)<subclassTempFloor(hero,sub))))list.push(['class:'+sub.id,sub.name+' (bonus action, '+left+' left)']);
  for(const g of potionGifts(game))list.push([g.id,g.name+' (bonus action)',g.action]);
  for(const [id,label,action,kind] of sustainOptions(game))if(kind==='bonus')list.push([id,label,action]);
  return list;
}
// The subclass's own action turned on someone fighting in a brawl (a Tangle-Bolt, a Rattling Jest, a Feint), while
// it has uses: one choice for each person still standing against the hero.
export function brawlFeatChoices(hero,game){
  if(!game.npcCombat?.active||game.pendingSpell)return [];
  const sub=subclassAction(hero),left=sub?subclassUses(hero,sub.uses)-(game.resources?.feat??0):0;
  if(!sub||left<=0||!(sub.effect.mark||sub.effect.vex||sub.effect.strike)||(sub.bonus&&game.bonusUsed))return [];
  return game.npcCombat.order.filter(n=>n.side==='enemy'&&(game.npcHP?.[n.id]??npcMaxHP(n.id,game))>0).map(n=>{const name=npcLore(game,n.id)?.name??n.id;return ['npc-feat:'+n.id,sub.name+' at '+name+' ('+(sub.bonus?'bonus action, ':'')+left+' left)',{type:'npc-attack',target:n.id,feat:true}];});
}
// A lasting spell used again as the action (Moonbeam moved, Call Lightning, Vampiric Touch).
export const sustainActions=game=>sustainOptions(game).filter(c=>c[3]==='action');
// The subclass's own action that takes the action (a Tangle-Bolt, a Field Engine), while it has uses.
export function featChoices(hero,game){
  const sub=subclassAction(hero),left=sub?subclassUses(hero,sub.uses)-(game.resources?.feat??0):0;
  return sub&&!sub.bonus&&left>0?[['class:'+sub.id,sub.name+' ('+left+' left)']]:[];
}
