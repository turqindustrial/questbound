// A brawl with people (game.npcCombat): the blow or harmful spell at a person that begins one (attackPerson, brawlStep),
// the hero's moves in it, and the people's turns (runNpcTurns); a held spell used again on a person (moved from
// adventureRules.js).
import {npcScene,npcProfile,npcMaxHP,npcIdsOf,npcCombatParticipants} from "./npcRules";
import {personDefenses,attackBoost,helpless,spendGuidance,riderDamage,spellAgain,moveMark,harmCreature,lastingTurn,spellTurnStarts,spellTurnEnds,charmedBy,spellDefense,shieldReaction,concentrationAfterDamage} from "./spellRules";
import {appendJournal} from "./journalRules";
import {worldPlace,travelTo} from "./mapRules";
import {resolveClassAction} from "./classActions";
import {combatBasics} from "./combatRules";
import {attackOptions,canThrow,thrownAttack,weaponRange,attacksPerAction,oneHanded,rollAttack,rangedMode,rollDamage} from "./weaponRules";
import {proficiencyBonus} from "./characterRules";
import {updateHealth} from "./healthRules";
import {sparedBlow} from "./deathRules";
import {arrowsLeft,spendArrow,spendThrown,potionHealing} from "./inventoryRules";
import {fightingCompanions,partyTargets,companionBrawlWeapon,foeOffense,brawlStrength,foeHitsPartyHero} from "./encounterRules";
import {grappledBy,holding,letGo,unarmedDC,unarmedSave,withMark,heroIdOf,heroEdge,edgeMode,masteryOf,markOf,endHeroTurn,sapsEnd,creatureTurnStarts,foeEdge,sapSpent} from "./masteryRules";
import {subclassAction,subclassUsesLeft,subclassRiderRoll,subclassWardRoll} from "./subclassRules";
import {inHand,drinkDraught,adventureStepCore,stepLogEntries,tickHeroSpells,overflowOf,fall} from "./adventureRules";
// A blow (or a grapple, a shove, the subclass's own action) at a person; it may begin a brawl.
export function attackPerson(step) {
  const {game, health, hero, action, random, stats, hp, entries} = step;
  let {next} = step;
  const victim = npcScene(game).find(n => n.id === action.target && n.present);
  // The subclass's own action turned on a person (`feat`): a Tangle-Bolt, a Rattling Jest, a Feint... as against a
  // creature, with the person's own defences (spellRules.js personDefenses). It may begin a brawl, like a blow.
  if (action.feat) {
    const sub = subclassAction(hero);
    if (!sub || !(sub.effect.mark || sub.effect.vex || sub.effect.strike)) return {game, health, error: 'That is not something you can turn on a person.'};
    if (!victim || game.npcFate?.[victim.id] === 'dead') return {game, health, error: 'That person is not here.'};
    if (victim.hp <= 0) return {game, health, error: `${victim.name} already lies senseless.`};
    if (hp.current <= 0 || game.castingConditions?.incapacitated) return {game, health, error: 'You cannot do that in your current condition.'};
    if (subclassUsesLeft(hero, game) <= 0) return {game, health, error: 'No uses of ' + sub.name + ' remain until you rest.'};
    if (sub.bonus && game.bonusUsed) return {game, health, error: 'Your bonus action is already used this turn.'};
    const used = resolveClassAction(hero, game, hp, stats.hp, sub.id, random, {...personDefenses(game, victim.id), key: victim.id, called: victim.name});
    if (!used) return {game, health, error: 'That is not available right now.'};
    next = {...(used.game ?? next), resources: used.resources};
    entries.push(...used.logs);
    if (used.damage > 0) {
      const left = Math.max(0, victim.hp - used.damage);
      next.npcHP = {...game.npcHP, [victim.id]: left};
      if (left === 0) { next.npcFate = {...game.npcFate, [victim.id]: 'dead'}; entries.push(`${victim.name} is dead.`); }
    }
    next.log = [...entries, ...game.log].slice(0, 40);
    return {game: next, events: entries, health: hp, ...(sub.bonus ? {bonus: true} : {})};
  }
  const carried = attackOptions(hero).find(w => w.name === action.weapon);
  if (action.thrown && carried && !canThrow(carried)) return {game, health, error: `A ${carried.name} is not made for throwing. Daggers, handaxes, javelins and spears are.`};
  // An Unarmed Strike may grapple or shove instead of striking.
  const contest = ['grapple', 'shove'].includes(action.unarmed) ? action.unarmed : null;
  if (action.unarmed !== undefined && (!contest || !carried?.unarmed)) return {game, health, error: 'An unarmed strike can grapple or shove.'};
  const weapon = carried && action.thrown ? thrownAttack(carried) : carried;
  if (!victim || game.npcFate?.[victim.id] === 'dead') return {
    game,
    health,
    error: 'That person is not here to attack.'
  };
  if (hp.current <= 0 || game.castingConditions?.incapacitated || game.castingConditions?.handsBound) return {
    game,
    health,
    error: 'You cannot make this weapon attack in your current condition.'
  };
  if (!weapon) return {
    game,
    health,
    error: 'Choose a weapon you carry, or attack unarmed.'
  };
  const distance = game.castingConditions?.targetDistance ?? 5, range = weaponRange(weapon);
  if (!weapon.ranged && !weapon.thrown && (game.castingConditions?.clearPath === false || distance > 5)) return {
    game,
    health,
    error: 'Move within 5 feet with a clear path before making a melee attack.'
  };
  if ((weapon.ranged || weapon.thrown) && range && distance > range.long) return {
    game,
    health,
    error: `${victim.name} is beyond your ${weapon.name}'s range.`
  };
  // Someone already lying senseless can be finished off where they lie.
  if (victim.hp <= 0) {
    if (contest) return {game, health, error: `${victim.name} already lies senseless.`};
    if (game.subdue) return {
      game,
      health,
      error: `${victim.name} is already unconscious.`
    };
    next.npcFate = {
      ...game.npcFate,
      [victim.id]: 'dead'
    };
    entries.push(`You use ${weapon.name} on ${victim.name}, who lies helpless. ${victim.name} is dead.`);
    next.log = [...entries, ...game.log].slice(0, 40);
    return {
      game: next,
      events: entries,
      health: hp
    };
  }
  if (contest === 'grapple' && grappledBy(next, victim.id, hp)) return {game, health, error: `${victim.name} is already held.`};
  // A two-handed weapon needs the hand that holds a grapple: it lets go first (free).
  if (!contest && weapon.twoHands && holding(next)) { const freed = letGo(next, k => npcProfile(next, k)?.name ?? null); next = freed.game; entries.push(...freed.lines); }
  // After a grapple or shove, the action's other attacks (Extra Attack) are made with a weapon that leaves a hand free.
  const followUp = contest ? attackOptions(hero).find(w => !w.ranged && !(contest === 'grapple' && w.twoHands)) ?? weapon : weapon;
  let remaining = victim.hp, thrownNow = 0, featDone = false;
  for (let swing = 0; swing < attacksPerAction(hero) && remaining > 0; swing++) {
    // The grapple or shove itself: no attack roll; they resist with Strength or Dexterity.
    if (contest && swing === 0) {
      const dc = unarmedDC(hero), save = unarmedSave({}, random), held = save.total < dc;
      entries.push(`${contest === 'grapple' ? 'Grapple' : 'Shove'}: ${victim.name} resists with a ${save.ability} save d20 [${save.die}] + ${save.bonus} = ${save.total} vs DC ${dc}: ${held ? 'failure' : 'success'}. ${held ? (contest === 'grapple' ? 'You have them in your grip: they cannot move, and their blows at anyone but you have disadvantage.' : 'They go down prone.') : (contest === 'grapple' ? 'They wrench free.' : 'They keep their feet.')}`);
      if (held) next = contest === 'grapple' ? withMark(next, victim.id, {grappled: heroIdOf(next)}) : withMark(next, victim.id, {prone: true});
      continue;
    }
    // A hand that holds a grapple leaves one for the weapon: a versatile weapon strikes one-handed (its own die).
    const w = holding(next) ? oneHanded(contest ? followUp : weapon) : contest ? followUp : weapon;
    if (w.ranged) {
      if (arrowsLeft(next, hero) <= 0) { entries.push('You are out of arrows.'); break; }
      next = spendArrow(next, hero);
    } else if (w.thrown) {
      if (thrownNow >= inHand(hero, w.name)) { entries.push(`You have no ${w.name.toLowerCase()} left to throw.`); break; }
      thrownNow++; next = spendThrown(next, hero, w.name);
    }
    // Bless adds 1d4 to the roll; a melee blow on someone paralyzed or asleep is a critical hit.
    const edge = heroEdge(next, victim.id, w), rolled = rollAttack(w, edgeMode(rangedMode(w, {closeEnemy: distance <= 5, distance}), edge), random), blessed = attackBoost(next, random), struckFirst = {...rolled, total: rolled.total + blessed.amount},
      hit = !struckFirst.miss && (struckFirst.critical || struckFirst.total >= victim.ac), attack = hit && !struckFirst.critical && !w.ranged && !w.thrown && helpless(next, victim.id) ? {...struckFirst, critical: true} : struckFirst;
    if (edge.adv.includes('Vex')) { next = {...next}; delete next.vex; }
    if (edge.adv.includes('Guiding Bolt')) next = spendGuidance(next, victim.id);
    const damageRoll = hit ? rollDamage(w, attack.critical, random) : null;
    // Hex, Hunter's Mark or Divine Favor add to a hit.
    const rider = hit ? riderDamage(hero, next, victim.id, attack.critical, random, {weapon: true}) : null;
    if (rider) next = rider.game;
    // The subclass's extra on a hit, once in this attack (a brawl's turn is one attack action).
    const featHit = hit && !featDone ? subclassRiderRoll(hero, {...next, featTurn: undefined}, w, {key: victim.id, called: victim.name, critical: attack.critical, target: personDefenses(next, victim.id), wounded: remaining < (npcMaxHP(victim.id, next) ?? remaining), firstRound: !game.npcCombat?.active || game.npcCombat.round === 1, companion: fightingCompanions(next).some(n => n.id !== victim.id)}, random) : null;
    if (featHit) { featDone = true; next = {...featHit.game}; delete next.featTurn; }
    if (hit && !w.ranged && !w.thrown) next = {...next, lastHit: {target: victim.id, ...(attack.critical ? {critical: true} : {})}};
    const damage = (damageRoll?.total??0) + (rider?.amount ?? 0) + (featHit?.damage ?? 0);
    remaining = Math.max(0, remaining - damage);
    entries.push(`${w.thrown ? 'You throw ' + w.name + ' at' : 'You use ' + w.name + ' against'} ${victim.name}: d20 [${attack.dice.join(', ')}] (${attack.mode}${[...edge.adv, ...edge.dis].length ? ', ' + [...edge.adv, ...edge.dis].join(', ') : ''}) + ${w.bonus} ${w.ability} + ${w.attackBonus-w.bonus-(w.magic??0)} proficiency${w.magic ? ' + ' + w.magic + ' magic' : ''} = ${attack.total} vs AC ${victim.ac}. ${attack.critical?'Critical hit':hit ? 'Hit' : 'Miss'}; ${damage} ${w.type} damage${damageRoll?' ('+(w.flat?'1 + '+w.bonus:damageRoll.dice.length+'d'+w.die+' ['+damageRoll.dice.join(', ')+'] + '+w.bonus)+(w.magic?' + '+w.magic+' magic':'')+')':''}. ${remaining} HP remaining.`);
    if (rider?.lines.length) entries.push(...rider.lines);
    if (featHit) { entries.push(...featHit.lines); if (featHit.mark === 'sapped' || featHit.mark === 'prone') next = withMark(next, victim.id, {[featHit.mark]: true}); }
    if (blessed.amount) entries.push(`Bless adds ${blessed.amount} to the roll.`);
    // Weapon Mastery against a person (Cleave reaches only creatures in a fight with a foe).
    const mastery = masteryOf(hero, w);
    if (hit && remaining > 0) {
      if (mastery === 'Sap') { next = withMark(next, victim.id, {sapped: true}); entries.push(`Sap: ${victim.name} has disadvantage on their next attack.`); }
      if (mastery === 'Vex' && damage > 0) { next = {...next, vex: {target: victim.id, fresh: true}}; entries.push(`Vex: your next attack against ${victim.name} has advantage.`); }
      if (mastery === 'Topple' && !markOf(next, victim.id).prone) {
        const dc = 8 + w.bonus + proficiencyBonus(hero.level ?? 1), die = 1 + Math.floor(random() * 20), falls = die < dc;
        if (falls) next = withMark(next, victim.id, {prone: true});
        entries.push(`Topple: ${victim.name} makes a Constitution save d20 [${die}] + 0 = ${die} vs DC ${dc}: ${falls ? 'failure. They fall prone.' : 'success. They keep their footing.'}`);
      }
    } else if (!hit && mastery === 'Graze' && w.bonus > 0 && remaining > 0) {
      remaining = Math.max(0, remaining - w.bonus);
      entries.push(`Graze: the swing still deals ${w.bonus} ${w.type.toLowerCase()} damage. ${remaining} HP remaining.`);
    }
  }
  next.npcHP = {
    ...game.npcHP,
    [victim.id]: remaining
  };
  // A blow that drops someone kills them, unless the player set out to knock them out with a close-range blow.
  if (remaining === 0) {
    const subdued = !!game.subdue && !weapon.ranged;
    next.npcFate = {
      ...game.npcFate,
      [victim.id]: subdued ? 'unconscious' : 'dead'
    };
    entries.push(subdued ? `${victim.name} drops, unconscious but alive.` : `${victim.name} is dead.`);
  }
  next.log = [...entries, ...game.log].slice(0, 40);
  return {
    game: next,
    events: entries,
    health: hp
  };
}
// A held spell used again on a person in a brawl, or Hex moved to a person: their own defences and hit points.
export function againOnPerson(step) {
  const {game, health, hero, action, random, stats, hp} = step;
  if (game.stage === 'combat') return;
  const id = action.slice(action.indexOf(':') + 1);
  if (!npcIdsOf(game).includes(id) || !npcScene(game).some(n => n.id === id && n.present) || game.npcFate?.[id] === 'dead') return {game, health, error: 'They are not here.'};
  const done = action.startsWith('again:') ? spellAgain(hero, game, hp, stats.hp, id, personDefenses(game, id), random) : {health: hp, ...moveMark(game, id, npcProfile(game, id).name)};
  if (done.error) return {game, health, error: done.error};
  let after = done.game;
  const lines = [...done.logs];
  if (done.damage) { const struck = harmCreature(after, id, done.damage); after = struck.game; if (struck.line) lines.push(struck.line); }
  if (done.bonus && game.npcCombat?.active) after = {...after, bonusUsed: true};
  return {game: {...after, log: [...lines, ...game.log].slice(0, 40)}, health: done.health ?? hp, events: lines, bonus: !!done.bonus};
}
// A brawl with people (game.npcCombat): a move in it, or the blow or harmful spell at a person that begins one.
export function brawlStep(game,health,hero,action,random,opts,stats,target,active){
 if(!stats.available||stats.ac===null)return {game,health,error:'Complete your combat statistics first.'};
 if((health?.current??stats.hp)<=0)return {game,health,error:'You are down and cannot act.'};
 // A bonus action in a brawl (2024 rules): a healing draught, Second Wind or Lay on Hands. It is taken before the
 // action (the action ends the turn here), once a turn, and the people fighting do not answer it.
 // The subclass's own bonus action that heals or shields the hero (a Field Tonic, a Briar Mantle) is taken the same way.
 const ownFeat=subclassAction(hero),selfFeat=!!ownFeat&&ownFeat.bonus&&!!(ownFeat.effect.heal||ownFeat.effect.temp)&&action==='class:'+ownFeat.id;
 if(active&&(['potion','class:wind','class:hands'].includes(action)||selfFeat||typeof action==='string'&&action.startsWith('drink:'))){
  if(game.pendingSpell)return {game,health,error:'Cancel the pending spell first.'};
  if(game.bonusUsed)return {game,health,error:'Your bonus action is already used this turn.'};
  let hp={current:health?.current??stats.hp,temp:health?.temp??0},next={...game},line;
  if(selfFeat&&subclassUsesLeft(hero,game)<=0)return {game,health,error:'No uses of '+ownFeat.name+' remain until you rest.'};
  if(hp.current>=stats.hp&&!(selfFeat&&ownFeat.effect.temp))return {game,health,error:'You are already at full health.'};
  if(action==='potion'){
   if((game.potions??0)<=0)return {game,health,error:'You have no healing draughts left.'};
   const dose=potionHealing(random),healed=updateHealth(hp,stats.hp,'heal',dose.total);
   line=`Healing draught: ${dose.a} + ${dose.b} + 2; restored ${healed.current-hp.current} HP.`;hp={current:healed.current,temp:healed.temp};next.potions=game.potions-1;
  } else if(action.startsWith('drink:')){
   const drunk=drinkDraught(next,hp,stats.hp,action.slice(6),random);if(drunk.error)return {game,health,error:drunk.error};
   next=drunk.game;hp=drunk.health;line=drunk.line;
  } else {
   const used=resolveClassAction(hero,{...game,stage:'combat'},hp,stats.hp,action.slice(6),random);
   if(!used)return {game,health,error:'That is not available right now.'};
   next.resources=used.resources;hp=used.health;line=used.logs.join(' ');
  }
  const events=[line,'You still have your action: attack, cast, dodge, wait, surrender or flee.'];
  return {game:{...next,bonusUsed:true,log:[...events,...game.log].slice(0,40)},health:hp,events};
 }
 if(active&&(typeof action==='string'&&!['npc-dodge','npc-flee','npc-wait','npc-surrender'].includes(action)&&!/^(again|move-mark):/.test(action)||action?.type==='travel'||action?.type==='beyond'))return {game,health,error:'Combat is underway. Attack, cast, dodge, surrender, or flee through Send to DM.'};
 if(active&&['npc-flee','npc-surrender'].includes(action)){
  if(game.pendingSpell)return {game,health,error:'Cancel the pending spell first.'};
  const away=game.stage==='inn'?'bridge':game.stage==='wild'?worldPlace(game,game.world?.at)?.from??'inn':'inn';
  const next={...game,npcCombat:{...game.npcCombat,active:false},log:[action==='npc-flee'?(game.stage==='inn'?'You disengage and retreat from the inn. Combat ends.':'You disengage and retreat. Combat ends.'):'You lower your weapon and surrender. Combat ends; the witnesses remain hostile.',...game.log].slice(0,40)};
  if(action==='npc-flee'){delete next.npcCombat;return travelTo(next,health??{current:stats.hp,temp:0},away);}
  return {game:next,health};
 }
 const special=active&&(['npc-dodge','npc-wait'].includes(action)||action?.type==='shield');
 const trial=special?{game:{...game},health}:adventureStepCore(game,health,hero,action,()=>0.5);
 if(trial.error||trial.waiting||trial.game===game)return trial;
 if(action?.type==='cancel-spell'||action?.type==='end-concentration')return adventureStepCore(game,health,hero,action,random);
 let next=game,hp=health??{current:stats.hp,temp:0};const events=[];
 if(!active){
  const participants=npcCombatParticipants(game,target);
  if(!participants.length)return adventureStepCore(game,health,hero,action,random);
  // Questbound house rule: resolve the initiating attack exactly once, before initiative.
  const opening=adventureStepCore(game,hp,hero,action,random);
  if(opening.error||opening.waiting)return opening;
  next=opening.game;hp=opening.health??hp;
  // Only those still standing after the opening blow take part; if none are, there is no fight to roll for.
  const standing=participants.filter(n=>(next.npcHP?.[n.id]??npcMaxHP(n.id,next))>0);
  if(!standing.length)return {...opening,game:next,health:hp,events:opening.events??[]};
  events.push('Opening attack.',...(opening.events??[]));
  // A party's brawl: every hero rolls once the opening blow has landed (adventureStep); the people fighting roll here.
  if(opts.party){
   const order=[{id:'player',side:'player',role:'attack',initiative:0},...standing.map(n=>({...n,initiative:1+Math.floor(random()*20)}))];
   next={...next,npcCombat:{active:true,round:1,order,help:null,...brawlWorthy(game,order)},log:['Combat begins.',...next.log].slice(0,40)};
   return {game:{...next,journal:appendJournal(next.journal,'encounter','Combat begins',events.join('\n').slice(0,3000))},health:hp,events};
  }
  const roll=1+Math.floor(random()*20),second=stats.initiativeAdvantage?1+Math.floor(random()*20):roll;
  const order=[{id:'player',side:'player',role:'attack',initiative:Math.max(roll,second)+stats.initiative},...standing.map(n=>({...n,initiative:1+Math.floor(random()*20)}))].sort((a,b)=>b.initiative-a.initiative||(a.id==='player'?-1:b.id==='player'?1:a.id.localeCompare(b.id)));
  events.push('Your initiative: d20 ['+[roll,...(stats.initiativeAdvantage?[second]:[])].join(', ')+'] + '+stats.initiative+' = '+(Math.max(roll,second)+stats.initiative)+'.');
  events.push(...order.filter(n=>n.id!=='player').map(n=>npcProfile(next,n.id).name+' initiative: d20 '+n.initiative+' + 0 = '+n.initiative+'.'));
  events.push('Turn order: '+order.map(n=>n.id==='player'?'You':npcProfile(next,n.id).name).join(' → ')+'.');
  events.push('Round 1 begins.');
  next={...next,npcCombat:{active:true,round:1,order,help:null,...brawlWorthy(game,order)},log:['Combat begins. Initiative: '+order.map(n=>(n.id==='player'?'You':npcProfile(next,n.id).name)+' '+n.initiative).join(' / ')+'.',...next.log].slice(0,40)};
  const first=runNpcTurns(next,hp,hero,order.slice(0,order.findIndex(n=>n.id==='player')),false,random);next=first.game;hp=first.health;events.push(...first.events);
  if(next.npcCombat?.active)events.push('Your turn.');
  next={...next,journal:appendJournal(next.journal,'encounter','Combat begins',events.join('\n').slice(0,3000)),bonusUsed:false,reactionUsed:false,slotSpentThisTurn:false};
  return {game:next,health:hp,events};
 }
 if(target&&next.npcCombat)next={...next,npcCombat:{...next.npcCombat,order:next.npcCombat.order.map(n=>n.id===target?{...n,side:'enemy',role:'attack'}:n)}};
 let result=special?{game:{...next,log:[action==='npc-dodge'?'You take the Dodge action.':action?.type==='shield'?action.line:'You hold your ground.',...next.log].slice(0,40)},health:hp}:adventureStepCore(next,hp,hero,action,random);
 if(result.error)return {game:next,health:hp,events,error:active?result.error:undefined};
 if(result.waiting)return result;
 // A bonus action (a bonus-action spell, or a healing draught given to someone) leaves the turn going: the action
 // still follows, and only then do the people fighting answer.
 if(active&&!special&&(result.bonus||action?.type==='give-potion')){
  if(action?.type==='give-potion'&&game.bonusUsed)return {game,health,error:'Your bonus action is already used this turn.'};
  return {...result,game:{...result.game,bonusUsed:true},events:result.events??stepLogEntries(next.log,result.game.log)};
 }
 // A party's brawl: this hero's turn is over; the people fighting act at their own places in the turn order.
 if(opts.party){
  const own=result.events??stepLogEntries(next.log,result.game.log),g={...result.game,bonusUsed:false,reactionUsed:false,slotSpentThisTurn:false},h={...(result.health??hp)};
  tickHeroSpells(g,h);endHeroTurn(g);
  const left=g.npcCombat.order.filter(n=>n.side==='enemy'&&(g.npcHP?.[n.id]??npcProfile(g,n.id).maximumHP)>0);
  if(!left.length){own.push('The opponents are down. Combat ends.');g.npcCombat={...g.npcCombat,active:false};g.log=['The opponents are down. Combat ends.',...g.log].slice(0,40);}
  g.journal=appendJournal(g.journal,'encounter',game.stage==='inn'?'Inn combat':'Combat',[...events,...own].join('\n').slice(0,3000));
  return {...result,game:g,health:h,events:[...events,...own],turnOver:true,dodged:action==='npc-dodge'};
 }
 const order=result.game.npcCombat.order,index=order.findIndex(n=>n.id==='player');
 events.push('Your turn.',...(result.events??stepLogEntries(next.log,result.game.log)));
 result=runNpcTurns(result.game,result.health??hp,hero,order.slice(index+1),action==='npc-dodge',random);
 events.push(...result.events);
 if(result.game.npcCombat?.active){
  events.push('Round '+(result.game.npcCombat.round+1)+' begins.');
  result=runNpcTurns(result.game,result.health??hp,hero,order.slice(0,index),action==='npc-dodge',random);
  events.push(...result.events);
 }
 result.events=events;
 result.game={...result.game,...(result.game.npcCombat?{npcCombat:{...result.game.npcCombat,round:result.game.npcCombat.round+1}}:{}),bonusUsed:false,reactionUsed:false,slotSpentThisTurn:false};
 // The hero's turn is over (Vex reaches into the next), and any Sap not yet spent has run out.
 result.game=sapsEnd(endHeroTurn(result.game));
 // A lasting spell cast this turn can be used again from the next (spellRules.js lastingSpells).
 if(result.game.concentration?.fresh){result.game.concentration={...result.game.concentration};delete result.game.concentration.fresh;}
 if(result.game.concentration?.remaining!=null){result.game.concentration={...result.game.concentration,remaining:result.game.concentration.remaining-1};if(result.game.concentration.remaining<=0)delete result.game.concentration;}
 result.game={...result.game,journal:appendJournal(result.game.journal,'encounter',game.stage==='inn'?'Inn combat':'Combat',events.join('\n').slice(0,3000))};
 return result;
}
// `party`: a party's brawl, where each person fighting picks any standing hero, and a hero who took the Dodge on their
// own turn (`dodging`) is harder to hit.
export function runNpcTurns(game,health,hero,turns,dodge,random,party=null){
 let next={...game,npcCombat:{...game.npcCombat}},hp={...health},downed=null;const stats=combatBasics(hero),logs=[];
 // Who last hurt the hero this round (Hellish Rebuke answers them); Shield drops as the round of blows begins anew.
 delete next.hurtBy;delete next.shieldUp;
 const who=id=>npcProfile(next,id),alive=id=>(next.npcHP?.[id]??who(id).maximumHP)>0;
 const enemies=()=>next.npcCombat.order.filter(n=>n.side==='enemy'&&alive(n.id));
 const dodgeLead=party?(party.dodging??[]).includes(next.party?.lead):dodge;
 // Lasting spells on the people fighting (spellRules.js lastingTurn): what burns them as their turn begins, and the
 // areas heroes hold and acid left on them as it ends (played as the next one's turn begins, or after the last).
 let ending=null;
 const turnEnds=id=>{if(!alive(id))return;const r=lastingTurn(next,id,'end',{...personDefenses(next,id),name:who(id).name},random);next=r.game;logs.push(...r.lines);};
 for(const actor of turns){
  if(ending){turnEnds(ending);ending=null;}
  if(!(hp.current>0||party&&partyTargets(next).length)||!enemies().length)break;
  if(!alive(actor.id))continue;
  const allied=actor.side==='ally',victim=allied?enemies()[0]:null;
  if(!allied){const begun=lastingTurn(next,actor.id,'start',{...personDefenses(next,actor.id),name:who(actor.id).name},random);next=begun.game;logs.push(...begun.lines);if(!alive(actor.id))continue;ending=actor.id;}
  if(actor.role==='help'&&next.npcCombat.order.some(n=>n.side===actor.side&&n.id!==actor.id&&alive(n.id))){next.npcCombat.help=actor.side;logs.push(who(actor.id).name+' distracts the opposition to help a defender.');continue;}
  let weapon=allied?companionBrawlWeapon(next,actor.id):{attackBonus:2,count:1,die:4,bonus:0};
  const helped=next.npcCombat.help===actor.side;
  // Lying prone, they get up first (unless held down); prone, a Sap, or a grapple spoils their blow (masteryRules.js).
  if(next.marks&&!allied){const begun=creatureTurnStarts(next,actor.id,who(actor.id).name,hp);next=begun.game;logs.push(...begun.lines);}
  // Held by a spell (asleep, paralyzed, entranced, commanded), they do nothing but try to shake it off; charmed by
  // the hero, they will not strike them.
  if(!allied&&next.marks?.[actor.id]?.spells){const held=spellTurnStarts(next,actor.id,who(actor.id).name);next=held.game;const ended=spellTurnEnds(next,actor.id,who(actor.id).name,personDefenses(next,actor.id).saves,random);if(held.skip){logs.push(...held.lines);next=ended.game;logs.push(...ended.lines);continue;}if(charmedBy(next,actor.id,heroIdOf(next))&&!party){logs.push(who(actor.id).name+' will not raise a hand against you.');next=ended.game;logs.push(...ended.lines);continue;}next=ended.game;logs.push(...ended.lines);}
  // Facing a bigger side (other heroes, allies fighting beside the hero), each opponent strikes more often and a
  // little harder (encounterRules.js foeOffense); against a hero alone, once as always.
  const press=allied?{swings:1,mult:1}:foeOffense(brawlStrength(next,hero)),avg=(weapon.count??1)*((weapon.die??4)+1)/2;
  if(press.mult!==1)weapon={...weapon,bonus:Math.max(0,Math.round((avg+(weapon.bonus??0))*press.mult-avg))};
  for(let swing=0;swing<press.swings;swing++){
  if(swing>0&&(!(hp.current>0||party&&partyTargets(next).length)||!alive(actor.id)))break;
  // In a party any standing hero may be the one struck.
  if(party&&!allied){
   const pool=[...(hp.current>0?[null]:[]),...partyTargets(next)],pick=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];
   if(pick!==null){
    const dodging=(party.dodging??[]).includes(pick)||foeEdge(next,actor.id,pick,hp).length>0,mode=helped===dodging?'normal':helped?'advantage':'disadvantage';
    if(helped)next.npcCombat.help=null;
    const struck=foeHitsPartyHero(next,{...weapon,type:'Bludgeoning',name:who(actor.id).name,cause:'Struck down by '+who(actor.id).name},who(actor.id).name,pick,mode,random);
    next=sapSpent(struck.game,actor.id);logs.push(...struck.lines);continue;
   }
  }
  const defense=allied?{ac:who(victim.id).ac}:spellDefense(next,stats.ac),why=allied?[]:foeEdge(next,actor.id,heroIdOf(next),hp);
  const disadvantage=!allied&&(dodgeLead||defense.disadvantage||why.length>0);
  const attack=rollAttack(weapon,helped===disadvantage?'normal':helped?'advantage':'disadvantage',random);
  if(!allied)next=sapSpent(next,actor.id);
  if(helped)next.npcCombat.help=null;
  let hit=!attack.miss&&(attack.critical||attack.total>=defense.ac);
  const shield=hit&&!allied?shieldReaction(hero,next,attack.total,defense.ac,attack.critical):null;
  if(shield){next=shield.game;hit=false;}
  const damageRoll=hit?(allied?rollDamage(weapon,attack.critical,random):sparedBlow(rollDamage(weapon,attack.critical,random),hp,()=>rollDamage(weapon,attack.critical,random),random)):null;let damage=damageRoll?.total??0;
  if(shield)logs.push(shield.line);
  // A subclass's Reaction may blunt the blow (subclassRules.js).
  const ward=damage&&!allied?subclassWardRoll(hero,next,damage,random):null;
  logs.push(`${who(actor.id).name} attacks ${allied?who(victim.id).name:'you'}: d20 [${attack.dice.join(', ')}] (${attack.mode}${helped?', Help':''}${!allied&&dodgeLead?', Dodge':''}${defense.disadvantage?', Blur':''}${why.length?', '+why.join(', '):''}) + ${weapon.attackBonus} =${attack.total} vs AC ${defense.ac}. ${attack.critical?'Critical hit':hit?'Hit':'Miss'}; ${damage} ${weapon.type?weapon.type[0].toUpperCase()+weapon.type.slice(1):'Bludgeoning'} damage${damageRoll?' ('+damageRoll.dice.length+'d'+weapon.die+' ['+damageRoll.dice.join(', ')+'] + '+weapon.bonus+')':''}.`);
  if(ward){next=ward.game;damage=ward.total;logs.push(ward.line);}
  if(damage&&allied)next.npcHP={...next.npcHP,[victim.id]:Math.max(0,(next.npcHP?.[victim.id]??who(victim.id).maximumHP)-damage)};
  else if(damage){if(!party)next.hurtBy=actor.id;const hurt=updateHealth(hp,stats.hp,'damage',damage);if(hurt.current===0)downed={by:who(actor.id).name,overflow:overflowOf(hurt.previous,damage)};hp={current:hurt.current,temp:hurt.temp};const concentration=concentrationAfterDamage(hero,next,damage,random);next=concentration.game;logs.push(...concentration.logs);}
  }
 }
 if(ending)turnEnds(ending);
 // Felled in a brawl, the hero is left dying where they lie and the defenders stand back (in a party, the others
 // fight on).
 if(hp.current<=0&&health.current>0||hp.current<=0&&!party){const brawl=next.npcCombat,fell=fall(next,'npc',downed?.overflow??0,stats.hp,downed?'Struck down by '+downed.by:null);next=fell.game;logs.push(...fell.entries);if(party&&brawl?.active&&partyTargets(next).length)next.npcCombat=brawl;}
 else if(!enemies().length){next={...next,npcCombat:{...next.npcCombat,active:false}};logs.push('The opponents are down. Combat ends.');}
 next.log=[...logs,...next.log].slice(0,40);return {game:next,health:hp,events:logs};
}
// Those fighting against the hero who were already hostile (or bore a grudge) before the first blow: only beating
// them is worth experience (experienceRules.js), never beating up someone friendly.
function brawlWorthy(game,order){
 const worthy=order.filter(n=>n.side==='enemy'&&(game.npcMemory?.[n.id]?.attitude==='hostile'||game.npcMemory?.[n.id]?.grudge)).map(n=>n.id);
 return worthy.length?{worthy}:{};
}
