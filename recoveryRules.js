// Recovering: healing draughts (drunk, or given to a companion or another hero; the stronger ones from the pack) and
// short and long rests, as moves of the adventure step (moved from adventureRules.js). In a fight a draught is a bonus
// action, played by the creature fight's round (wildFightRules.js) or a brawl (brawlRules.js).
import {npcScene,npcMaxHP,npcLore} from "./npcRules";
import {campaignState} from "./campaignRules";
import {timePasses,mapState} from "./mapRules";
import {shortRestLimit} from "./classActions";
import {updateHealth} from "./healthRules";
import {potionHealing} from "./inventoryRules";
import {partyHeroName} from "./encounterRules";
import {rechargeWands,magicItems} from "./lootRules";
import {subclassShortRecharge,subclassSpender} from "./subclassRules";
// A healing draught for someone else: a companion lying senseless comes round (and owes you their life).
export function givePotion(game, action, hp, next, entries, random) {
  // Another player's hero in the party: their own hit points; a fallen one wakes.
  if (typeof action.target === 'string' && action.target.startsWith('party:')) {
    const pid = action.target.slice(6), member = game.party?.members?.[pid];
    if (!member || pid === game.party.lead || member.status === 'dead') return 'That hero is not here.';
    if ((game.potions ?? 0) <= 0) return 'You have no healing draughts left.';
    if (hp.current <= 0) return 'You cannot do that while down.';
    const name = partyHeroName(member), most = member.stats?.hp ?? 1, was = member.status === 'down' ? 0 : member.health?.current ?? most;
    if (was >= most) return name + ' is not hurt.';
    const dose = potionHealing(random), now = Math.min(most, was + dose.total), hero = {...(member.hero ?? {})};
    delete hero.dying;
    next.party = {...game.party, members: {...game.party.members, [pid]: {...member, status: 'up', health: {current: now, temp: 0}, hero}}};
    next.potions = game.potions - 1;
    entries.push(`You give ${name} a healing draught: ${dose.a} + ${dose.b} + 2; restored ${now - was} HP.${was === 0 ? ' ' + name + ' stirs and opens their eyes.' : ''}`);
    return '';
  }
  const person = npcScene(game).find(n => n.id === action.target && n.present && n.fate !== 'dead');
  if (!person) return 'That person is not here.';
  if ((game.potions ?? 0) <= 0) return 'You have no healing draughts left.';
  if (hp.current <= 0) return 'You cannot do that while down.';
  const most = npcMaxHP(person.id, game), was = game.npcHP?.[person.id] ?? most;
  if (was >= most) return person.name + ' is not hurt.';
  const dose = potionHealing(random), now = Math.min(most, was + dose.total);
  next.npcHP = {...game.npcHP, [person.id]: now};
  if (was === 0 && next.npcFate?.[person.id]) { next.npcFate = {...next.npcFate}; delete next.npcFate[person.id]; if (!Object.keys(next.npcFate).length) delete next.npcFate; }
  next.potions = game.potions - 1;
  entries.push(`You give ${person.name} a healing draught: ${dose.a} + ${dose.b} + 2; restored ${now - was} HP.${was === 0 ? ' ' + person.name + ' stirs and opens their eyes.' : ''}`);
  return '';
}
export function giveDraught(step) {
  const {game, health, action, random, next, hp, entries} = step;
  if (game.stage === 'combat') return;
  const error = givePotion(game, action, hp, next, entries, random);
  if (error) return {game, health, error};
  next.log = [...entries, ...game.log].slice(0, 40);
  return {game: next, events: entries, health: hp};
}
// Drinking a healing draught away from a fight.
export function drinkPotion(step) {
  const {game, health, random, stats, next, entries} = step;
  let {hp} = step;
  if (game.stage === 'combat') return;
  if (!['inn', 'bridge', 'tower', 'wild', 'victory'].includes(game.stage)) return {game, health, error: 'You cannot drink a draught right now.'};
  if ((game.potions ?? 0) <= 0) return {game, health, error: 'You have no healing draughts left.'};
  if (hp.current >= stats.hp) return {game, health, error: 'You are already at full health.'};
  const dose = potionHealing(random), healed = updateHealth(hp, stats.hp, 'heal', dose.total);
  entries.push(`Healing draught: ${dose.a} + ${dose.b} + 2; restored ${healed.current - hp.current} HP.`);
  hp = {current: healed.current, temp: healed.temp};
  next.potions = game.potions - 1;
  next.log = [...entries, ...game.log].slice(0, 40);
  return {game: next, events: entries, health: hp};
}
// A stronger healing draught (Greater, Superior, Supreme) from the pack, away from a fight.
export function drinkFromPack(step) {
  const {game, health, action, random, stats, entries} = step;
  let {next, hp} = step;
  if (game.stage === 'combat') return;
  if (!['inn', 'bridge', 'tower', 'wild', 'victory'].includes(game.stage) || game.npcCombat?.active) return {game, health, error: 'You cannot drink a draught right now.'};
  const drunk = drinkDraught(next, hp, stats.hp, action.slice(6), random);
  if (drunk.error) return {game, health, error: drunk.error};
  next = drunk.game; hp = drunk.health; entries.push(drunk.line);
  next.log = [...entries, ...game.log].slice(0, 40);
  return {game: next, events: entries, health: hp};
}
// A short rest, as in Baldur's Gate 3: two between long rests (three for a Bard with Song of Rest), anywhere
// out of a fight. It restores half the hero's hit points, and half of each companion's, and what returns on a
// short rest: a Fighter's Second Wind and a Warlock's spell slots. A long rest brings the short rests back.
export function shortRest(step) {
  const {game, health, hero, stats, next, hp, entries} = step;
  const limit = shortRestLimit(hero), used = game.shortRests ?? 0;
  if (game.stage === 'combat' || game.npcCombat?.active) return {game, health, error: 'You cannot rest in the middle of a fight.'};
  if (!['inn', 'bridge', 'tower', 'wild', 'victory'].includes(game.stage)) return {game, health, error: 'You cannot rest here.'};
  if (hp.current <= 0) return {game, health, error: 'You cannot rest while down.'};
  if (used >= limit) return {game, health, error: 'You have no short rests left. A long rest at a safe place restores them.'};
  const lines = [], now = Math.min(stats.hp, hp.current + Math.floor(stats.hp / 2));
  if (now > hp.current) lines.push(`You bind your wounds and catch your breath: restored ${now - hp.current} HP.`);
  for (const n of npcScene(game)) {
    if (game.followers?.[n.id]?.status !== 'following' || !n.present || n.fate === 'dead') continue;
    const most = npcMaxHP(n.id, game), was = game.npcHP?.[n.id] ?? most, better = was <= 0 ? Math.max(1, Math.floor(most / 2)) : Math.min(most, was + Math.floor(most / 2));
    if (better <= was) continue;
    next.npcHP = {...next.npcHP, [n.id]: better};
    // A companion knocked senseless comes round with the rest.
    if (was <= 0) { if (next.npcFate?.[n.id] === 'unconscious') { next.npcFate = {...next.npcFate}; delete next.npcFate[n.id]; } lines.push(`${npcLore(game, n.id)?.name ?? n.name} comes round and binds their wounds: ${better} HP.`); }
    else lines.push(`${npcLore(game, n.id)?.name ?? n.name} rests too: restored ${better - was} HP.`);
  }
  if (hero.class === 'Fighter' && (game.resources?.wind ?? 0) > 0) {
    next.resources = {...game.resources, wind: 0};
    lines.push('Second Wind is ready again.');
  }
  if (hero.class === 'Fighter' && (game.resources?.surge ?? 0) > 0) {
    next.resources = {...(next.resources ?? game.resources), surge: 0};
    lines.push('Action Surge is ready again.');
  }
  if (subclassShortRecharge(hero, game)) {
    next.resources = {...(next.resources ?? game.resources), feat: 0};
    lines.push(subclassSpender(hero).name + ' is ready again.');
  }
  if (hero.class === 'Warlock' && ((game.spellSlotsUsed ?? []).some(n => n > 0) || (game.resources?.slots ?? 0) > 0)) {
    next.spellSlotsUsed = Array(9).fill(0);
    next.resources = {...(next.resources ?? game.resources), slots: 0};
    lines.push('Your pact magic returns: spell slots restored.');
  }
  if (!lines.length) return {game, health, error: 'You are already rested: there is nothing to recover.'};
  next.shortRests = used + 1;
  entries.push(`Short rest (${used + 1} of ${limit}).`, ...lines);
  next.log = [...entries, ...game.log].slice(0, 40);
  // An hour goes by: a held spell or a spell's temporary hit points may run out meanwhile.
  const rested = timePasses(next, {current: now, temp: hp.temp}, 60);
  return {game: rested.game, events: entries, health: rested.health};
}
// A long rest restores hit points, spell slots, class features and the short rests. Everything else about the
// adventure stays exactly as it was: the places found, the people met, the pack, the story so far.
export function longRest(step) {
  const {game, random} = step;
  if (game.stage !== 'inn') return;
  const rested = {...game, round: 1, potions: Math.max(1, game.potions ?? 1), map: mapState(game), campaign: campaignState(game)};
  for (const key of ['resources', 'spellSlotsUsed', 'arcanumUsed', 'speciesUsed', 'buffs', 'boons', 'aided', 'shieldUp', 'hurtBy', 'lastHit', 'shortRests', 'concentration', 'temporarySpell', 'enemyEffects', 'bonusUsed', 'slotSpentThisTurn', 'reactionUsed', 'actionUsed', 'surged', 'dodging', 'castingConditions', 'heroCondition', 'foeTricks', 'pendingSpell']) delete rested[key];
  const lines = ['You finish a long rest. HP and casting resources are restored.'];
  // Companions who are with you sleep it off too (one knocked senseless wakes whole).
  for (const n of npcScene(game)) {
    if (game.followers?.[n.id]?.status !== 'following' || n.fate === 'dead') continue;
    const most = npcMaxHP(n.id, game), was = game.npcHP?.[n.id] ?? most;
    if (was < most) { rested.npcHP = {...rested.npcHP, [n.id]: most}; if (rested.npcFate?.[n.id] === 'unconscious') { rested.npcFate = {...rested.npcFate}; delete rested.npcFate[n.id]; } lines.push(`${npcLore(game, n.id)?.name ?? n.name} ${was <= 0 ? 'wakes, tended through the night, and is' : 'is'} rested and whole again.`); }
  }
  // A Wand of Magic Missiles regains 1d6 + 1 charges overnight.
  const wands = rechargeWands(rested, random);
  Object.assign(rested, wands.game); lines.push(...wands.lines);
  rested.log = [...lines, ...game.log].slice(0, 40);
  return {game: rested, events: lines, health: null};
}
// A stronger healing draught from the pack (lootRules.js): Greater 4d4 + 4, Superior 8d4 + 8, Supreme 10d4 + 20.
export function drinkDraught(game,hp,maximum,id,random){
 const draught=magicItems[id],it=(game.pack?.items??[]).find(i=>i.kind==='potion'&&i.magic?.id===id&&i.qty>0);
 if(!draught?.heal||!it)return {error:'You carry no such draught.'};
 if(hp.current>=maximum)return {error:'You are already at full health.'};
 const dice=Array.from({length:draught.heal.count},()=>1+Math.floor(random()*draught.heal.die)),amount=dice.reduce((a,b)=>a+b,0)+draught.heal.bonus,healed=updateHealth(hp,maximum,'heal',amount);
 const items=game.pack.items.map(i=>i===it?{...i,qty:i.qty-1}:i).filter(i=>i.qty>0);
 const label=draught.name.replace(/^Potion of /,'').replace(/ Healing$/,'');
 return {game:{...game,pack:{...game.pack,items}},health:{current:healed.current,temp:healed.temp},line:`${label} healing draught: ${draught.heal.count}d${draught.heal.die} [${dice.join(', ')}] + ${draught.heal.bonus}; restored ${healed.current-hp.current} HP.`};
}
