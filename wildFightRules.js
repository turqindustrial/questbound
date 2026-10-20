// Fights with creatures: the tale's foe, a creature met in the wilds (and one at its side), the vault's guardians and
// the crossroads wisp. creatureCombatStep starts the fight with the opening attack and initiative; creatureRound plays a
// round (the hero's move, the companions' blows, the creature's answer). A wild fight starts on arrival or by the
// Dungeon Master's ambush, and ends back at its place (moved from adventureRules.js).
import {automaticEffects,concentrationAfterDamage} from "./spellRules";
import {placeName,timePasses,travelRoute,worldPlace,mapState,mapLocation} from "./mapRules";
import {resolveClassAction,surgeReady,bonusOptions} from "./classActions";
import {combatBasics} from "./combatRules";
import {attackOptions,canThrow,thrownAttack,rangedMode,attacksPerAction,oneHanded,rollAttack,rollDamage} from "./weaponRules";
import {proficiencyBonus} from "./characterRules";
import {updateHealth} from "./healthRules";
import {sparedBlow} from "./deathRules";
import {arrowsLeft,spendArrow,spendThrown} from "./inventoryRules";
import {alliesScatter,endWildFight,allFoeTemplates,naturalAllies,startWildFight,validFoeSketch,hurtAlly,aimedAlly,fightingCompanions,allyStats,shieldBlow,heroConditions,livingAllies,undeadFortitude,companionsAttack,partyTargets,pickFoeTarget,foeRoundMoves,foeAttackMode,foeHitsCompanion,foeHitExtras} from "./encounterRules";
import {offhandWeapons,masteryOf,withinGrip,creatureSize,grappledBy,holding,letGo,unarmedDC,unarmedSave,withMark,heroIdOf,heroEdge,edgeMode,isLight,markOf,endHeroTurn,creatureTurnStarts,foeEdge,boonKeyOf,sapSpent,sapsEnd} from "./masteryRules";
import {packMagic,magicItems} from "./lootRules";
import {subclassAction,subclassUsesLeft,subclassRiderRoll,subclassPassive,subclassWardRoll} from "./subclassRules";
import {fall,inHand,foeStanding,tickHeroSpells,overflowOf,finishStep,adventureStepCore,encounterFoe} from "./adventureRules";
import {givePotion,drinkDraught} from "./recoveryRules";
import {attackBoost,helpless,spendGuidance,wokenByHarm,spellTurnStarts,charmedBy,banedAttack,spellTurnEnds} from "./spellConditionRules";
import {withDefenses,defended,riderDamage} from "./spellDamageRules";
import {spellDefense,wardEdge,shieldReaction,resistedDamage,heroTurnBegins} from "./spellBuffRules";
import {lastingTurn} from "./lastingSpellRules";
// A fight at a found place is over (won, fled or fallen): the step's lines and the game are told and left as it ends.
export function wildFightEnds(game, result) {
  const w = game.wildFight, outcome = result.game.stage === 'victory' ? 'won' : result.game.stage === 'escaped' ? 'fled' : 'fell';
  const fate = result.game.foeFate === 'subdued' ? 'subdued' : 'slain', group = w.stats.group;
  const kept = result.events.filter(t => !/wisp settles|restored the crossing|You retreat to the inn/.test(t));
  const ending = outcome === 'won' ? [fate === 'subdued' ? (group ? 'The last of the ' + group.plural + ' drops senseless.' : 'The ' + w.name + ' collapses, beaten but alive.') : (group ? 'The last of the ' + group.plural + ' falls dead.' : 'The ' + w.name + ' is slain.')] : outcome === 'fled' ? ['You flee from the ' + w.name + ' back toward ' + placeName(game, w.from) + '.'] : [];
  const scattered = outcome === 'won' ? alliesScatter(result.game).lines : [];
  const ended = endWildFight(result.game, outcome);
  result.events = [...kept, ...ending, ...scattered];
  result.game = {...ended, log: [...result.events, ...game.log].slice(0, 40)};
  // Running back the way you came takes as long as the road.
  if (outcome === 'fled') { const away = timePasses(result.game, result.health, travelRoute(game, w.place, w.from)?.minutes ?? 0); result.game = away.game; result.health = away.health; }
}
// A lair's creature (or one the hero fled from) is waiting where they arrive, or a risky place springs an ambush.
export function arrivalAmbush(game, result, hero, random) {
  const place = worldPlace(result.game, result.game.world.at), first = !mapState(game).visited.includes(place.id);
  let foe = place.threat ? {template: place.threat.template, name: place.threat.name, appearance: place.threat.appearance, ...(place.threat.ally ? {ally: place.threat.ally} : {})} : null, hpLeft = place.threat?.hp ?? null;
  if (!foe && first && place.danger === 'risky' && random() < 0.4) {
    const pool = allFoeTemplates().filter(f => !(combatBasics(hero).hp < 10 && (hero.level ?? 1) <= 2 && (f.group || f.key === 'orc')));
    const pick = pool[Math.floor(random() * pool.length)];
    foe = {template: pick.key, name: pick.foe, appearance: pick.appearance};
    // From level 2, a bandit may come with a hound, a goblin with a worg, an orc with a goblin.
    if ((hero.level ?? 1) >= 2 && naturalAllies[pick.key] && random() < 0.35) foe.ally = naturalAllies[pick.key];
  }
  if (foe) {
    const ambush = startWildFight(result.game, hero, foe, {place: place.id, from: mapLocation(game), hp: hpLeft});
    result.events = [...result.events, ...ambush.entries];
    result.game = {...ambush.game, log: [...ambush.entries, ...result.game.log].slice(0, 40)};
  }
}
// The Dungeon Master springs a creature on you at a found place (a hunting beast, a guardian, an ambush).
export function ambushStep(step) {
  const {game, health, hero, action, hp} = step;
  if (!game.story || game.stage !== 'wild' || game.wildFight || game.npcCombat?.active) return {
    game,
    health,
    error: 'A creature can only attack you out in the wilds, away from a fight.'
  };
  if (!validFoeSketch(action.foe)) return {
    game,
    health,
    error: 'That creature was not described clearly enough to fight.'
  };
  if (hp.current <= 0) return {
    game,
    health,
    error: 'You need to recover first.'
  };
  const ambush = startWildFight(game, hero, action.foe, {place: game.world.at, from: game.world.at});
  ambush.game.log = [...ambush.entries, ...game.log].slice(0, 40);
  return {
    game: ambush.game,
    events: ambush.entries,
    health: hp
  };
}
// A round of a fight with a creature (the tale's foe, a creature in the wilds, the vault's guardians, the crossroads
// wisp): the hero's move, the companions' blows, then the creature's answer.
  // In a party's fight the hero's turn can end without the foe answering (turnOptions.foeWaits): the turn order
  // (adventureStep) is told that it is over, and whether the hero took the Dodge.
export function creatureRound(step, spellResult, aim, aimedFoe) {
  const {game, health, hero, action, random, turnOptions, stats, foe, entries} = step;
  let {next, hp} = step;
  let turnOver = false, dodged = false;
  if (hp.current === 0) return {
    game: {
      ...game,
      stage: 'defeat'
    },
    health: hp
  };
  let dodge = false,
    bonusAction = false,
    usedBonus = false,
    reacted = false,
    nickNow = false;
  const ending = action === 'end-turn';
  if (turnOptions.enemyOnly) {
    // The opening attack is already committed; this phase only advances the foe.
  } else if (ending) {
    entries.push(game.actionUsed ? 'You end your turn.' : 'You hold your ground and end your turn.');
  } else if (spellResult) {
    next = spellResult.game;
    hp = spellResult.health;
    entries.push(...spellResult.logs);
    if (aim !== null) {
      const struck = hurtAlly(next, aim, spellResult.damage ?? 0);
      next = struck.game;
      if (struck.line) entries.push(struck.line);
    } else next.enemyHP = Math.max(0, next.enemyHP - (spellResult.damage ?? 0));
    // The other creatures an area or a many-target spell caught.
    for (const s of spellResult.splash ?? []) {
      if (s.key === 'foe') next.enemyHP = Math.max(0, next.enemyHP - s.damage);
      else { const i = aimedAlly(next, s.key); if (i === null) continue; const struck = hurtAlly(next, i, s.damage); next = struck.game; if (struck.line) entries.push(struck.line); }
    }
    bonusAction = spellResult.bonus || spellResult.reaction;
    if (spellResult.reaction) { next.reactionUsed = true; reacted = true; }
    dodge = !!spellResult.enemyDisadvantage;
    if (spellResult.bonus) { next.bonusUsed = true; usedBonus = true; }
    if (hp.current === 0) {
      const fell = fall(next, 'spell', 0, stats.hp);
      next = fell.game;
      entries.push(...fell.entries);
    }
  } else if (action === 'flee') {
    next.stage = 'escaped';
    entries.push('You retreat to the inn. The bridge remains dark, but you live to try again.');
  } else if (typeof action === 'string' && action.startsWith('class:') && action !== 'class:surge') {
    // Aimed at the foe or at the creature beside it; a subclass's extra on a hit needs to know how it stands.
    const sub = subclassAction(hero), own = !!sub && action === 'class:' + sub.id, struck = aimedFoe ?? foe;
    const target = {...struck, key: aim !== null ? 'ally:' + aim : 'foe', called: aim !== null ? 'the ' + aimedFoe.name : foe.group ? 'the ' + foe.group.plural : 'the ' + foe.name.replace(/^the /i, ''), wounded: aim !== null ? (game.foeAllies?.[aim]?.hp ?? 0) < (aimedFoe.maximum ?? 0) : game.enemyHP < (foe.maximum ?? game.enemyHP), firstRound: !!turnOptions.opening || game.round === 1, companion: fightingCompanions(game).length > 0};
    const result = resolveClassAction(hero, game, hp, stats.hp, action.slice(6), random, target);
    if (!result) return {
      game,
      health,
      error: own && subclassUsesLeft(hero, game) <= 0 ? 'No uses of ' + sub.name + ' remain until you rest.' : game.bonusUsed && (!own || sub.bonus) ? 'Your bonus action is already used this turn.' : (action === 'class:wind' || own && sub.effect.heal) && hp.current >= stats.hp ? 'You are already at full health.' : 'That is not available right now.'
    };
    next = result.game ? {...result.game} : next;
    next.resources = result.resources;
    hp = result.health;
    if (result.damage > 0 && target.key !== 'foe') { entries.push(...result.logs); const hurt = hurtAlly(next, aim, result.damage); next = hurt.game; if (hurt.line) entries.push(hurt.line); result.logs = []; }
    else next.enemyHP = Math.max(0, next.enemyHP - result.damage);
    entries.push(...result.logs);
    bonusAction = result.bonus;
    dodge = !!result.enemyDisadvantage;
    if (bonusAction) { next.bonusUsed = true; usedBonus = true; }
  } else if (action?.type === 'improvised') {
    // An attempt the Dungeon Master ruled as a check (commitWorldCheck): its roll is already told; it spends the action.
  } else if (action === 'class:surge') {
    // Action Surge: one more action this turn (not the Magic action), once a turn, once per short or long rest.
    if (game.surged) return {game, health, error: 'Action Surge works once a turn.'};
    if (!game.actionUsed) return {game, health, error: 'Take your action first: Action Surge then gives you one more.'};
    if (!surgeReady(hero, game)) return {game, health, error: game.surged ? 'Action Surge works once a turn.' : 'Action Surge is spent until you rest.'};
    next.resources = {...game.resources, surge: (game.resources?.surge ?? 0) + 1};
    next.surged = true;
    delete next.actionUsed;
    entries.push('Action Surge: you push past your limits and take one more action.');
    next.log = [...entries, ...game.log].slice(0, 40);
    return {game: next, events: entries, health: hp};
  } else if (action?.type === 'give-potion') {
    // Giving a healing draught to someone beside you is a bonus action (2024 rules), like drinking one.
    if (game.bonusUsed) return {game, health, error: 'Your bonus action is already used this turn.'};
    const error = givePotion(game, action, hp, next, entries, random);
    if (error) return {game, health, error};
    next.bonusUsed = true;
    bonusAction = true;
    usedBonus = true;
  } else if (action === 'potion' && game.potions > 0) {
    // Drinking a healing draught is a bonus action: you can still act this turn.
    if (game.bonusUsed) return {game, health, error: 'Your bonus action is already used this turn.'};
    if (hp.current >= stats.hp) return {game, health, error: 'You are already at full health.'};
    const a = 1 + Math.floor(random() * 4),
      b = 1 + Math.floor(random() * 4);
    const healed = updateHealth(hp, stats.hp, 'heal', a + b + 2);
    entries.push(`Healing draught: ${a} + ${b} + 2; restored ${healed.current - hp.current} HP.`);
    hp = {
      current: healed.current,
      temp: healed.temp
    };
    next.potions--;
    next.bonusUsed = true;
    bonusAction = true;
    usedBonus = true;
  } else if (typeof action === 'string' && action.startsWith('drink:')) {
    // A stronger healing draught is a bonus action too.
    if (game.bonusUsed) return {game, health, error: 'Your bonus action is already used this turn.'};
    const drunk = drinkDraught(next, hp, stats.hp, action.slice(6), random);
    if (drunk.error) return {game, health, error: drunk.error};
    next = drunk.game; hp = drunk.health; entries.push(drunk.line);
    next.bonusUsed = true;
    bonusAction = true;
    usedBonus = true;
  } else if (action === 'item:wand-of-magic-missiles') {
    // A Wand of Magic Missiles: an action, three darts of force that never miss, at the foe or the one beside it.
    // Activating a magic item is the Magic action, which Action Surge's extra action cannot be.
    if (game.surged) return {game, health, error: 'The extra action from Action Surge cannot be used to work magic: attack, dodge or retreat.'};
    const wand = packMagic(next, 'wand-of-magic-missiles');
    if (!wand) return {game, health, error: 'Your wand has no charges left.'};
    const darts = [0, 1, 2].map(() => 1 + Math.floor(random() * 4)), total = darts.reduce((a, b) => a + b, 0) + 3, charges = wand.magic.charges - 1;
    let items = next.pack.items.map(i => i === wand ? {...i, magic: {...i.magic, charges}} : i), crumbled = false;
    // Spending the last charge may crumble it to ash.
    if (charges === 0 && 1 + Math.floor(random() * 20) === 1) { items = items.filter(i => i.name !== wand.name); crumbled = true; }
    next.pack = {...next.pack, items};
    const victim = aim !== null ? 'the ' + next.foeAllies[aim].name : foe.group ? 'the ' + foe.group.plural : 'the ' + foe.name.replace(/^the /i, '');
    entries.push(`${wand.name}: three darts of force strike ${victim}: [${darts.join(', ')}] + 3 = ${total} force damage. ${crumbled ? 'The last charge spent, the wand crumbles to ash.' : charges + ' charge' + (charges === 1 ? '' : 's') + ' left.'}`);
    if (aim !== null) { const struck = hurtAlly(next, aim, total); next = struck.game; if (struck.line) entries.push(struck.line); }
    else next.enemyHP = Math.max(0, next.enemyHP - total);
  } else if (action === 'dodge') {
    dodge = true;
    entries.push(game.wildFight ? `You dodge. The ${foe.name} attacks with disadvantage this turn.` : 'You dodge. The wisp attacks with disadvantage this turn.');
  } else if (action?.type === 'shield') {
    // The shield put on the back or taken up (heroStep has already changed it): that is the action.
    entries.push(action.line);
  } else {
    // An attack: with a weapon (attack:, throw:), with the other hand's Light weapon after a Light one (offhand:,
    // two-weapon fighting), or an Unarmed Strike that grapples or shoves instead of striking (grapple, shove).
    // Weapon Mastery, Vex and a prone or grappled creature shape the rolls (masteryRules.js).
    const throwing = typeof action === 'string' && action.startsWith('throw:'), offhand = typeof action === 'string' && action.startsWith('offhand:'), contest = action === 'grapple' || action === 'shove' ? action : null;
    const named = throwing ? attackOptions(hero).find(w => w.name === action.slice(6) && canThrow(w)) : null;
    const weapon = contest ? attackOptions(hero).find(w => w.unarmed) : offhand ? offhandWeapons(hero, game.lightAttack?.weapon).find(w => w.name === action.slice(8)) ?? null : throwing ? (named ? thrownAttack(named) : null) : attackOptions(hero).find(w => `attack:${w.name}` === action);
    if (offhand && !game.lightAttack) return {game, health, error: 'Attack with a light weapon first; then your other hand can strike.'};
    // The Light property gives one extra attack a turn (Nick only changes what it costs).
    if (offhand && game.nickUsed) return {game, health, error: 'Your other hand has already struck this turn.'};
    if (!weapon) return throwing ? {game, health, error: `You have no ${action.slice(6).toLowerCase()} to throw.`} : offhand ? {game, health, error: 'Your other hand needs a second light weapon, and no shield, for that.'} : {
      game,
      health
    };
    const nick = offhand && masteryOf(hero, weapon) === 'Nick' && !game.nickUsed;
    if (offhand && !nick && game.bonusUsed) return {game, health, error: 'Your bonus action is already used this turn.'};
    const key = aim !== null ? 'ally:' + aim : 'foe', targetOf = k => k === 'foe' ? foe : withDefenses(next, k, allyStats(next, Number(k.slice(5)), hero.level ?? 1));
    const called = k => 'the ' + targetOf(k).name.replace(/^the /i, ''), Called = k => 'T' + called(k).slice(1);
    const standing = k => k === 'foe' ? next.enemyHP > 0 : (next.foeAllies?.[Number(k.slice(5))]?.hp ?? 0) > 0;
    if (contest && !withinGrip(hero, creatureSize(next, key))) return {game, health, error: `${Called(key)} is too big for you to ${contest}.`};
    if (contest === 'grapple' && grappledBy(next, key, hp)) return {game, health, error: `${Called(key)} is already held.`};
    // A two-handed weapon, or a weapon in each hand, needs the hand that holds a grapple: it lets go first (free).
    if (!contest && (weapon.twoHands || offhand) && holding(next)) { const freed = letGo(next, called); next = freed.game; entries.push(...freed.lines); }
    // Damage to the foe (its shield may catch a blow) or to the creature at its side, through what it is immune or
    // vulnerable to (`type`: the damage type); returns what got through.
    let finalBlow = null;
    const harm = (k, amount, shield, type, critical = false) => {
      const blocked = k === 'foe' && shield ? shieldBlow(next, amount, random) : {game: next, damage: amount, line: null}; next = blocked.game;
      const dealt = type ? defended(targetOf(k), type, blocked.damage) : blocked.damage;
      const note = dealt !== blocked.damage ? `${Called(k)} ${dealt === 0 ? 'is immune to' : dealt > blocked.damage ? 'is vulnerable to' : 'resists'} ${String(type).toLowerCase()} damage: ${dealt} damage applied (${blocked.damage} before defenses).` : null;
      const line = [blocked.line, note].filter(Boolean).join(' ') || null;
      if (k === 'foe') { next.enemyHP = Math.max(0, next.enemyHP - dealt); if (dealt > 0) finalBlow = {damage: dealt, type, critical}; return {dealt, line}; }
      const struck = hurtAlly(next, Number(k.slice(5)), dealt); next = struck.game; return {dealt, hp: struck.hp, line: [line, struck.line].filter(Boolean).join(' ') || null};
    };
    let thrownNow = 0, lightUsed = null;
    // A bow is fine before the foe closes in (the opening attack); once it is within 5 feet, shots have disadvantage.
    // Grit in the eyes, being knocked prone or caught in web also spoils your next attack.
    const baseMode = w => game.heroCondition ? 'disadvantage' : rangedMode(w, {closeEnemy: !turnOptions.opening});
    if (game.heroCondition) entries.push(heroConditions[game.heroCondition]);
    // After a grapple or shove, the action's other attacks (Extra Attack) are made with the main weapon, or with one
    // that leaves a hand free to hold on.
    const followUp = contest ? attackOptions(hero).find(w => !w.ranged && !(contest === 'grapple' && w.twoHands)) ?? weapon : weapon;
    for (let swing = 0; swing < (offhand ? 1 : attacksPerAction(hero)) && standing(key); swing++) {
      // The grapple or shove itself: no attack roll; the creature resists with Strength or Dexterity.
      if (contest && swing === 0) {
        const dc = unarmedDC(hero), save = unarmedSave(targetOf(key).saves, random), held = save.total < dc;
        entries.push(`${contest === 'grapple' ? 'Grapple' : 'Shove'}: ${called(key)} resists with a ${save.ability} save d20 [${save.die}] + ${save.bonus} = ${save.total} vs DC ${dc}: ${held ? 'failure' : 'success'}. ${held ? (contest === 'grapple' ? 'You have it in your grip: it cannot move, and its attacks on anyone but you have disadvantage.' : 'It goes down prone.') : (contest === 'grapple' ? 'It wrenches free.' : 'It keeps its feet.')}`);
        if (held) next = contest === 'grapple' ? withMark(next, key, {grappled: heroIdOf(next)}) : withMark(next, key, {prone: true});
        continue;
      }
      // A hand that holds a grapple leaves one for the weapon: a versatile weapon strikes one-handed (its own die).
      const w = holding(next) ? oneHanded(contest ? followUp : weapon) : contest ? followUp : weapon;
      // Each bow shot uses an arrow, and each throw one of the weapons thrown; with none left, there is no shot.
      if (w.ranged) {
        if (arrowsLeft(next, hero) <= 0) { entries.push('You are out of arrows.'); break; }
        next = spendArrow(next, hero);
      } else if (w.thrown) {
        if (thrownNow >= inHand(hero, w.name)) { entries.push(`You have no ${w.name.toLowerCase()} left to throw.`); break; }
        thrownNow++; next = spendThrown(next, hero, w.name);
      }
      // Bless adds 1d4 to the roll; a melee blow on a creature paralyzed or asleep is a critical hit.
      const woundedBefore = key === 'foe' ? next.enemyHP < (foe.maximum ?? next.enemyHP) : (next.foeAllies?.[Number(key.slice(5))]?.hp ?? 0) < (targetOf(key).maximum ?? 0);
      const target = targetOf(key), edge = heroEdge(next, key, w), rolled = rollAttack(w, edgeMode(baseMode(w), edge), random), blessed = attackBoost(next, random), struckFirst = {...rolled, total: rolled.total + blessed.amount}, hit = !struckFirst.miss && (struckFirst.critical || struckFirst.total >= target.ac), attack = hit && !struckFirst.critical && !w.ranged && !w.thrown && helpless(next, key) ? {...struckFirst, critical: true} : struckFirst;
      if (edge.adv.includes('Vex')) { next = {...next}; delete next.vex; }
      if (edge.adv.includes('Guiding Bolt')) next = spendGuidance(next, key);
      if (blessed.amount) entries.push(`Bless adds ${blessed.amount} to the roll.`);
      const used = offhand ? ' (other hand)' : '';
      if (key === 'foe') entries.push(`${w.thrown ? 'You throw' : 'You use'} ${w.name}${used}: d20 [${attack.dice.join(', ')}] (${attack.mode}${[...edge.adv, ...edge.dis].length ? ', ' + [...edge.adv, ...edge.dis].join(', ') : ''}) + ${w.bonus} ${w.ability} + ${w.attackBonus-w.bonus-(w.magic??0)} proficiency${w.magic ? ' + ' + w.magic + ' magic' : ''} = ${attack.total} vs AC ${target.ac}. ${attack.critical ? 'Critical hit!' : hit ? 'Hit.' : 'Miss.'}`);
      else entries.push(`${w.thrown ? 'You throw ' + w.name + used + ' at' : 'You use ' + w.name + used + ' on'} the ${target.name}: d20 [${attack.dice.join(', ')}] (${attack.mode}${[...edge.adv, ...edge.dis].length ? ', ' + [...edge.adv, ...edge.dis].join(', ') : ''}) + ${w.bonus} ${w.ability} + ${w.attackBonus-w.bonus-(w.magic??0)} proficiency${w.magic ? ' + ' + w.magic + ' magic' : ''} = ${attack.total} vs AC ${target.ac}. ${attack.critical ? 'Critical hit!' : hit ? 'Hit.' : 'Miss.'}`);
      if (isLight(w) && !offhand) lightUsed = w.name;
      const mastery = masteryOf(hero, w);
      if (hit) {
        // The other hand's blow adds no ability bonus to its damage (unless that bonus is negative).
        const dw = offhand && w.bonus > 0 ? {...w, bonus: 0} : w, damage = rollDamage(dw, attack.critical, random), done = harm(key, damage.total, true, dw.type, attack.critical);
        const magicPart = dw.magic ? ' + ' + dw.magic + ' magic' : '';
        if (key === 'foe') entries.push(`${damage.total} ${dw.type.toLowerCase()} damage (${dw.flat ? '1' : damage.dice.join(' + ')} ${dw.bonus >= 0 ? '+' : ''}${dw.bonus}${magicPart}).`);
        else entries.push(`The ${target.name} takes ${damage.total} ${dw.type.toLowerCase()} damage (${dw.flat ? '1' : damage.dice.join(' + ')} ${dw.bonus >= 0 ? '+' : ''}${dw.bonus}${magicPart}); ${done.hp} HP left.`);
        if (done.line) entries.push(done.line);
        // Hex, Hunter's Mark or Divine Favor add to the hit; a melee hit opens the way for Divine Smite.
        const rider = riderDamage(hero, next, key, attack.critical, random, {weapon: true});
        next = rider.game;
        entries.push(...rider.lines);
        if (rider.amount > 0 && standing(key)) { const extra = harm(key, rider.amount, false, rider.type); if (extra.line) entries.push(extra.line); }
        // The subclass's extra on a hit, once a turn (subclassRules.js): fire in the blow, an opening, the first cut.
        const featHit = standing(key) ? subclassRiderRoll(hero, next, w, {key, called: called(key), critical: attack.critical, target, wounded: woundedBefore, firstRound: !!turnOptions.opening || game.round === 1, companion: fightingCompanions(next).length > 0}, random) : null;
        if (featHit) {
          next = featHit.game;
          entries.push(...featHit.lines);
          if (featHit.damage > 0) { const extra = harm(key, featHit.damage, false); if (extra.line) entries.push(extra.line); }
          if (featHit.mark === 'sapped' && standing(key)) next = withMark(next, key, {sapped: true});
          if (featHit.mark === 'prone' && standing(key)) next = withMark(next, key, {prone: true});
        }
        if (!w.ranged && !w.thrown) next = {...next, lastHit: {target: key, ...(attack.critical ? {critical: true} : {})}};
        // Weapon Mastery: what a hit does besides its damage.
        if (mastery === 'Sap' && standing(key)) { next = withMark(next, key, {sapped: true}); entries.push(`Sap: ${called(key)} has disadvantage on its next attack.`); }
        if (mastery === 'Vex' && done.dealt > 0 && standing(key)) { next = {...next, vex: {target: key, fresh: true}}; entries.push(`Vex: your next attack against ${called(key)} has advantage.`); }
        if (mastery === 'Slow' && done.dealt > 0 && standing(key)) { next = {...next, enemyEffects: {...next.enemyEffects, 'Speed reduced by 10 feet': Math.max(1, next.enemyEffects?.['Speed reduced by 10 feet'] ?? 0)}}; entries.push(`Slow: ${called(key)} loses 10 feet of speed until your next turn.`); }
        if (mastery === 'Topple' && standing(key) && !markOf(next, key).prone) {
          const dc = 8 + w.bonus + proficiencyBonus(hero.level ?? 1), die = 1 + Math.floor(random() * 20), bonus = target.saves?.Constitution ?? 0, falls = die + bonus < dc;
          if (falls) next = withMark(next, key, {prone: true});
          entries.push(`Topple: ${called(key)} makes a Constitution save d20 [${die}] + ${bonus} = ${die + bonus} vs DC ${dc}: ${falls ? 'failure. It falls prone.' : 'success. It keeps its footing.'}`);
        }
        if (mastery === 'Cleave' && !w.ranged && !w.thrown && !next.cleaveUsed) {
          // A second creature beside the first: the one at the foe's side, the foe itself, or another of its pack.
          const beside = livingAllies(next)[0], other = key === 'foe' ? (beside ? 'ally:' + beside.index : foe.group && foeStanding(foe, next.enemyHP) >= 2 ? 'foe' : null) : next.enemyHP > 0 ? 'foe' : null;
          if (other !== null) {
            next = {...next, cleaveUsed: true};
            const second = targetOf(other), edge2 = heroEdge(next, other, w), swing2 = rollAttack(w, edgeMode(baseMode(w), edge2), random), hit2 = !swing2.miss && (swing2.critical || swing2.total >= second.ac);
            entries.push(`Cleave: you swing on into ${other === key ? 'another of the ' + foe.group.plural : called(other)}: d20 [${swing2.dice.join(', ')}] (${swing2.mode}) + ${w.attackBonus} = ${swing2.total} vs AC ${second.ac}. ${swing2.critical ? 'Critical hit!' : hit2 ? 'Hit.' : 'Miss.'}`);
            if (hit2) { const cut = rollDamage({...w, bonus: Math.min(0, w.bonus)}, swing2.critical, random), landed = harm(other, cut.total, false, w.type); entries.push(`${cut.total} ${w.type.toLowerCase()} damage (${cut.dice.join(' + ')}${w.bonus < 0 ? ' − ' + Math.abs(w.bonus) : ''}${w.magic ? ' + ' + w.magic + ' magic' : ''}).`); if (landed.line) entries.push(landed.line); }
          }
        }
      } else if (mastery === 'Graze' && w.bonus > 0 && standing(key)) {
        // Graze: even a miss deals the ability bonus.
        const done = harm(key, w.bonus, false, w.type);
        entries.push(`Graze: the swing still deals ${w.bonus} ${w.type.toLowerCase()} damage.`);
        if (done.line) entries.push(done.line);
      }
    }
    if (lightUsed) next = {...next, lightAttack: {weapon: lightUsed, target: key}};
    if (offhand) {
      // Two-weapon fighting: a bonus action, or (Nick) part of the Attack action, once a turn.
      if (nick) next.nickUsed = true; else next.bonusUsed = true;
      usedBonus = true;
      bonusAction = true;
      nickNow = nick;
    }
    const fortitude = undeadFortitude(next, foe, random, finalBlow);
    next = fortitude.game;
    if (fortitude.line) entries.push(fortitude.line);
    if (next.enemyHP === 0) {
      next.foeFate = game.subdue && !weapon.ranged ? 'subdued' : 'slain';
      next.stage = 'victory';
      entries.push('The wisp settles into the lantern. Warm light spills over the bridge. You have restored the crossing!');
    }
  }
  if (next.stage === 'combat' && next.enemyHP === 0 && !turnOptions.enemyOnly) {
    const fortitude = undeadFortitude(next, foe, random, spellResult?.damage > 0 ? {damage: spellResult.damage, type: automaticEffects[action?.request?.id ?? game.pendingSpell?.id]?.type} : null);
    next = fortitude.game;
    if (fortitude.line) entries.push(fortitude.line);
  }
  if (next.stage === 'combat' && next.enemyHP === 0) {
    next.foeFate = 'slain';
    next.stage = 'victory';
    entries.push('The wisp settles into the lantern. You have restored the crossing!');
  }
  // One action a turn: once it is spent, only a bonus action, a reaction (Hellish Rebuke) or ending the turn remains.
  if (game.actionUsed && !usedBonus && !reacted && !ending && !turnOptions.enemyOnly) return {
    game,
    health,
    error: 'You have already used your action this turn. Use a bonus action or end your turn.'
  };
  // After the action, a hero who still has a bonus action worth using gets the chance: the turn waits for it, or
  // for End turn. A bonus action taken after the action ends the turn by itself.
  const acted = !bonusAction && !ending && !turnOptions.enemyOnly;
  const paused = acted && next.stage === 'combat' && !turnOptions.suppressEnemy && hp.current > 0 && (bonusOptions(hero, next, hp, stats.hp).length > 0 || surgeReady(hero, next));
  if (paused) {
    next.actionUsed = true;
    // A Dodge (or a foe thrown off by a spell) still counts when the turn ends.
    if (dodge) next.dodging = true;
    entries.push('You still have a bonus action: use it, or end your turn.');
  }
  if (usedBonus && game.actionUsed) bonusAction = false;
  // The other hand's blow under Nick was part of the action: a bonus action may still follow it.
  if (nickNow && next.stage === 'combat' && hp.current > 0 && (bonusOptions(hero, next, hp, stats.hp).length > 0 || surgeReady(hero, next))) {
    bonusAction = true;
    next.actionUsed = true;
    entries.push('You still have a bonus action: use it, or end your turn.');
  }
  if (paused) bonusAction = true;
  if (game.dodging && !paused) dodge = true;
  // Companions travelling with you strike the creature once, after your turn (in a party's fight, once a round,
  // just before the foe acts).
  if (next.stage === 'combat' && !bonusAction && !turnOptions.suppressEnemy && (turnOptions.partyFoe || !turnOptions.enemyOnly && !turnOptions.foeWaits)) {
    const helped = companionsAttack(next, foe, random, subclassPassive(hero).companionBonus === 'proficiency' ? proficiencyBonus(hero.level) : 0);
    next = helped.game;
    entries.push(...helped.lines);
    if (next.enemyHP === 0) {
      const fortitude = undeadFortitude(next, foe, random);
      next = fortitude.game;
      if (fortitude.line) entries.push(fortitude.line);
    }
    if (next.enemyHP === 0) {
      next.foeFate = 'slain';
      next.stage = 'victory';
      entries.push('The wisp settles into the lantern. You have restored the crossing!');
    }
  }
  if (next.stage === 'combat' && !bonusAction && turnOptions.foeWaits) {
    // A party's fight: this hero's turn is over. The foe acts at its own place in the turn order.
    turnOver = true;
    dodged = dodge;
    next.bonusUsed = false;
    next.slotSpentThisTurn = false;
    next.reactionUsed = false;
    delete next.actionUsed;
    delete next.surged;
    delete next.dodging;
    tickHeroSpells(next, hp);
    endHeroTurn(next);
  } else if (next.stage === 'combat' && !bonusAction && !turnOptions.suppressEnemy) {
    // Anyone hurt since a spell put them to sleep or charmed them is free of it.
    const woke = wokenByHarm(game, next, k => k === 'foe' ? 'The ' + foe.name.replace(/^the /i, '') : String(k).startsWith('ally:') ? 'The ' + allyStats(next, Number(k.slice(5)), hero.level ?? 1).name : k);
    next = woke.game;
    entries.push(...woke.lines);
    const defense = spellDefense(next, stats.ac, foe);
    let hurtByNow = null;
    // A creature lying prone gets up as its turn begins (unless a grapple holds it down), and a hold whose hero has
    // dropped is gone. Prone, a Sap, or a grapple (at anyone but the one holding it) spoil its attacks.
    if (next.marks) for (const k of ['foe', ...livingAllies(next).map(a => 'ally:' + a.index)]) { const begun = creatureTurnStarts(next, k, k === 'foe' ? 'The ' + foe.name.replace(/^the /i, '') : 'The ' + allyStats(next, Number(k.slice(5)), hero.level ?? 1).name, hp); next = begun.game; entries.push(...begun.lines); }
    const heldOff = (k, target) => foeEdge(next, k, target === null ? heroIdOf(next) : String(target).startsWith('party:') ? String(target).slice(6) : 'companion', hp);
    // In a party's foe turn, whoever is struck may have taken the Dodge on their own turn; Blur guards only the
    // hero it was cast on (the one this turn is played from).
    const dodgingNow = target => turnOptions.partyFoe ? (turnOptions.dodging ?? []).includes(target === null ? next.party?.lead : String(target).replace(/^party:/, '')) : dodge;
    const blurNow = target => turnOptions.partyFoe ? target === null && defense.disadvantage : defense.disadvantage;
    // A party fights on while anyone stands: once this hero is down the foe turns to the others.
    const fightOn = () => hp.current > 0 || turnOptions.partyFoe && partyTargets(next).length > 0;
    const foeTarget = () => { const t = pickFoeTarget(next, random); if (t !== null || hp.current > 0 || !turnOptions.partyFoe) return t; const others = partyTargets(next); return 'party:' + others[Math.min(others.length - 1, Math.floor(random() * others.length))]; };
    // As its turn begins, what burns or grips it hurts it (Searing Smite, Ensnaring Strike, burning webs).
    const foeBegins = lastingTurn(next, 'foe', 'start', {...foe, name: 'The ' + foe.name.replace(/^the /i, '')}, random);
    next = foeBegins.game;
    entries.push(...foeBegins.lines);
    // Each standing member of a group attacks in turn.
    const attackers = foeStanding(foe, next.enemyHP), fallen = foeStanding(foe, game.enemyHP) - attackers;
    if (foe.group && fallen > 0) entries.push(`${fallen === 1 ? 'One of the' : fallen} ${foe.group.plural} ${fallen === 1 ? 'falls' : 'fall'} ${game.subdue ? 'senseless' : 'dead'} — ${attackers} still standing.`);
    // A condition from last round (prone, caught in web) gives the creature its edge now, then wears off.
    const lingering = next.heroCondition;
    delete next.heroCondition;
    const moves = foeRoundMoves(next, hero, foe, random);
    next = moves.game;
    entries.push(...moves.lines);
    let downedBy = null, overflow = 0;
    // A creature a spell holds (asleep, paralyzed, entranced, commanded) does nothing this turn.
    const foeName = 'The ' + foe.name.replace(/^the /i, ''), held = spellTurnStarts(next, 'foe', foeName);
    next = held.game;
    entries.push(...held.lines);
    // A lone foe facing a bigger side strikes more than once (encounterRules.js scaledFoe); a pack by its members.
    const swings = foe.group || attackers < 1 ? attackers : Math.max(1, foe.swings ?? 1);
    for (let member = 1; member <= swings && fightOn() && !held.skip; member++) {
    const who = attackers > 1 ? `${foe.name} ${member}` : foe.name;
    // Sometimes the creature goes for a companion beside you instead (or, in a party, another hero).
    // Protection from Evil and Good on whoever it goes for spoils every blow it aims at them.
    const target = foeTarget(), why = [...(member === 1 ? heldOff('foe', target) : []), ...wardEdge(next, 'foe', boonKeyOf(next, target))];
    const mode = foeAttackMode({...next, heroCondition: target !== null && turnOptions.partyFoe ? undefined : lingering ?? next.heroCondition}, foe, attackers, {dodge: dodgingNow(target), blur: blurNow(target) || why.length > 0});
    if (target) {
      const struck = foeHitsCompanion(next, foe, who, target, mode, random);
      next = struck.game;
      entries.push(...struck.lines);
      if (member === 1) next = sapSpent(next, 'foe');
      continue;
    }
    // Charmed by this hero, it will not strike them.
    if (charmedBy(next, 'foe', heroIdOf(next))) { entries.push(`${who} will not raise a hand against you.`); continue; }
    const baned = banedAttack(next, 'foe', rollAttack(foe, mode, random), random), attack = baned.attack;
    if (member === 1) next = sapSpent(next, 'foe');
    const ac = spellDefense(next, stats.ac, foe).ac;
    let hit = !attack.miss && (attack.critical || attack.total >= ac);
    entries.push(`${who}: d20 [${attack.dice.join(', ')}] (${attack.mode}${why.length ? ', ' + why.join(', ') : ''}) +${foe.attackBonus}${baned.note} = ${attack.total} vs your AC ${ac}. ${attack.critical ? 'Critical hit!' : hit ? 'Hit.' : 'Miss.'}`);
    // Shield, as a reaction, when it turns this blow into a miss.
    const shield = hit ? shieldReaction(hero, next, attack.total, ac, attack.critical) : null;
    if (shield) { next = shield.game; entries.push(shield.line); hit = false; }
    if (hit) {
      const damage = sparedBlow(rollDamage(foe, attack.critical, random), hp, () => rollDamage(foe, attack.critical, random), random);
      const extras = foeHitExtras(next, hero, foe, attackers, random);
      next = extras.game;
      const resisted = resistedDamage(next, foe.type, Math.max(1, damage.total + extras.extra), random);
      next = resisted.game;
      let total = resisted.amount;
      if (resisted.line) entries.push(resisted.line);
      // A subclass's Reaction may blunt the blow (subclassRules.js), even to nothing.
      const ward = subclassWardRoll(hero, next, total, random);
      if (ward) { next = ward.game; total = ward.total; entries.push(ward.line); }
      if (total > 0) hurtByNow = 'foe';
      const hurt = total > 0 ? updateHealth(hp, stats.hp, 'damage', total) : {current: hp.current, temp: hp.temp, previous: hp, message: 'No damage gets through.'};
      if (hurt.current === 0) {
        downedBy = who;
        overflow = overflowOf(hurt.previous, total);
      }
      hp = {
        current: hurt.current,
        temp: hurt.temp
      };
      entries.push(`${damage.dice.length}d${foe.die} [${damage.dice.join(', ')}] + ${foe.bonus}${extras.note}${ward ? ' − ' + ward.reduced + ' ' + ward.name : ''} = ${total} ${foe.type} damage. ${hurt.message}`);
      entries.push(...extras.lines);
      if (total > 0) {
        const concentration = concentrationAfterDamage(hero, next, total, random);
        next = concentration.game;
        entries.push(...concentration.logs);
      }
    }
    }
    // The creature at its side attacks too.
    let allyDowned = null;
    for (const ally of livingAllies(next)) {
      if (!fightOn()) break;
      const a = allyStats(next, ally.index, hero.level ?? 1), allyBegins = lastingTurn(next, 'ally:' + ally.index, 'start', {...a, name: 'The ' + a.name}, random);
      next = allyBegins.game;
      entries.push(...allyBegins.lines);
      if (!(next.foeAllies?.[ally.index]?.hp > 0)) continue;
      const still = spellTurnStarts(next, 'ally:' + ally.index, 'The ' + a.name);
      if (still.skip) { next = still.game; entries.push(...still.lines); continue; }
      const target = foeTarget(), why = [...heldOff('ally:' + ally.index, target), ...wardEdge(next, 'ally:' + ally.index, boonKeyOf(next, target))], mode = dodgingNow(target) || blurNow(target) || why.length > 0 ? 'disadvantage' : 'normal';
      if (target) { const struck = foeHitsCompanion(next, a, a.name, target, mode, random); next = sapSpent(struck.game, 'ally:' + ally.index); entries.push(...struck.lines); continue; }
      if (charmedBy(next, 'ally:' + ally.index, heroIdOf(next))) { entries.push(`The ${a.name} will not raise a hand against you.`); continue; }
      const baned = banedAttack(next, 'ally:' + ally.index, rollAttack(a, mode, random), random), attack = baned.attack, ac = spellDefense(next, stats.ac, a).ac;
      let hit = !attack.miss && (attack.critical || attack.total >= ac);
      next = sapSpent(next, 'ally:' + ally.index);
      entries.push(`${a.name}: d20 [${attack.dice.join(', ')}] (${attack.mode}${why.length ? ', ' + why.join(', ') : ''}) +${a.attackBonus}${baned.note} = ${attack.total} vs your AC ${ac}. ${attack.critical ? 'Critical hit!' : hit ? 'Hit.' : 'Miss.'}`);
      const shield = hit ? shieldReaction(hero, next, attack.total, ac, attack.critical) : null;
      if (shield) { next = shield.game; entries.push(shield.line); hit = false; }
      if (!hit) continue;
      const damage = sparedBlow(rollDamage(a, attack.critical, random), hp, () => rollDamage(a, attack.critical, random), random), resisted = resistedDamage(next, a.type, Math.max(1, damage.total), random);
      next = resisted.game;
      if (resisted.line) entries.push(resisted.line);
      const ward = subclassWardRoll(hero, next, resisted.amount, random), total = ward ? ward.total : resisted.amount;
      if (ward) { next = ward.game; entries.push(ward.line); }
      if (total <= 0) { entries.push(`${damage.dice.length}d${a.die} [${damage.dice.join(', ')}] + ${a.bonus} − ${ward.reduced} ${ward.name} = 0 ${a.type} damage. No damage gets through.`); continue; }
      const hurt = updateHealth(hp, stats.hp, 'damage', total);
      if (total > 0) hurtByNow = 'ally:' + ally.index;
      if (hurt.current === 0) { allyDowned = a.name; overflow = overflowOf(hurt.previous, total); }
      hp = {current: hurt.current, temp: hurt.temp};
      entries.push(`${damage.dice.length}d${a.die} [${damage.dice.join(', ')}] + ${a.bonus}${ward ? ' − ' + ward.reduced + ' ' + ward.name : ''} = ${total} ${a.type} damage. ${hurt.message}`);
      const concentration = concentrationAfterDamage(hero, next, total, random);
      next = concentration.game;
      entries.push(...concentration.logs);
    }
    if (hp.current === 0) {
      const fell = fall(next, 'foe', overflow, stats.hp, game.dungeon?.active ? null : allyDowned ? 'Struck down by the ' + allyDowned : game.wildFight ? (foe.group ? 'Cut down by the ' + foe.group.plural : 'Slain by the ' + game.wildFight.name) : game.story ? (foe.group ? 'Cut down by the ' + foe.group.plural : 'Slain by the ' + game.story.foe) : downedBy ? 'Struck down by the ' + downedBy : null);
      next = fell.game;
      entries.push(...fell.entries);
    }
    next.round++;
    next.bonusUsed = false;
    next.slotSpentThisTurn = false;
    next.reactionUsed = false;
    delete next.actionUsed;
    delete next.surged;
    delete next.dodging;
    // In a party each hero's spells count down at the end of their own turn instead.
    if (!turnOptions.partyFoe) tickHeroSpells(next, hp);
    // A Sap lasts only until the next turn of the hero who landed it; their own turn is over.
    next = sapsEnd(next);
    if (!turnOptions.enemyOnly) endHeroTurn(next);
    // At the end of their turns the creatures try again to shake off what spells hold them; then the hero's turn
    // begins: Shield drops, Heroism steadies them, and a creature that just hurt them can be answered (Hellish Rebuke).
    // As their turns end, the areas heroes hold (Moonbeam, Spirit Guardians and the rest) and acid left on them burn.
    for (const k of ['foe', ...livingAllies(next).map(a => 'ally:' + a.index)]) {
      const st = k === 'foe' ? foe : allyStats(next, Number(k.slice(5)), hero.level ?? 1);
      if (k === 'foe' ? next.enemyHP <= 0 : !(next.foeAllies?.[Number(k.slice(5))]?.hp > 0)) continue;
      const burnt = lastingTurn(next, k, 'end', {...st, name: 'The ' + st.name.replace(/^the /i, '')}, random);
      next = burnt.game;
      entries.push(...burnt.lines);
      const ended = spellTurnEnds(next, k, 'The ' + st.name.replace(/^the /i, ''), st.saves, random);
      next = ended.game;
      entries.push(...ended.lines);
    }
    if (hurtByNow && hp.current > 0 && !turnOptions.partyFoe) next.hurtBy = hurtByNow; else delete next.hurtBy;
    const begins = heroTurnBegins(hero, next, hp);
    next = begins.game;
    hp = begins.health;
    entries.push(...begins.lines);
    if (next.enemyEffects) next.enemyEffects = Object.fromEntries(Object.entries(next.enemyEffects).filter(([, rounds]) => rounds > 1).map(([key, rounds]) => [key, rounds - 1]));
    if (hp.current === 0) delete next.concentration;
  }
  // The foe dropped on its own turn by a lasting spell (burning, a held area).
  if (next.stage === 'combat' && next.enemyHP === 0) {
    const fortitude = undeadFortitude(next, foe, random);
    next = fortitude.game;
    if (fortitude.line) entries.push(fortitude.line);
    if (next.enemyHP === 0) {
      next.foeFate = 'slain';
      next.stage = 'victory';
      entries.push('The wisp settles into the lantern. You have restored the crossing!');
    }
  }
  if (next.stage !== 'combat') { delete next.actionUsed; delete next.surged; delete next.dodging; }
  return finishStep(game, hero, next, hp, entries, turnOver, dodged);
}
// `opts.party`: a party's fight, whose turns adventureStep orders. The opening attack rolls no initiative here (every
// hero rolls once it is made), and a hero's turn ends without the foe answering.
export function creatureCombatStep(game,health,hero,action,random,opts={}){
 let scene=game,command=action;
 // The aim at a second creature lasts for this one action.
 const strip=r=>{if(r?.game?.aim!==undefined){r.game={...r.game};delete r.game.aim;}return r;};
 if(action?.type==='encounter-attack'){
  if(!['bridge','combat'].includes(game.stage)||game.enemyHP<=0)return {game,health,error:'That creature is not within reach here.'};
  if(!attackOptions(hero).some(w=>w.name===action.weapon))return {game,health,error:'Choose a weapon you carry, or attack unarmed.'};
  if(action.thrown&&!attackOptions(hero).some(w=>w.name===action.weapon&&canThrow(w)))return {game,health,error:'A '+action.weapon+' is not made for throwing. Daggers, handaxes, javelins and spears are.'};
  if(action.unarmed!==undefined&&!['grapple','shove'].includes(action.unarmed))return {game,health,error:'An unarmed strike can grapple or shove.'};
  if(game.stage==='bridge')scene={...game,stage:'combat',openingAttackAvailable:true,encounterInitiative:undefined};
  command=action.unarmed??(action.thrown?'throw:':'attack:')+action.weapon;
  if(action.target!==undefined){if(aimedAlly(game,action.target)===null)return {game,health,error:'That creature is not in this fight.'};scene={...scene,aim:action.target};}
 }
 // A magic item aimed at the creature beside the foe (the Wand of Magic Missiles).
 if(action?.type==='use-item'){
  if(game.stage!=='combat'||!magicItems[action.id])return {game,health,error:'That cannot be used here.'};
  command='item:'+action.id;
  if(action.target!==undefined){if(aimedAlly(game,action.target)===null)return {game,health,error:'That creature is not in this fight.'};scene={...game,aim:action.target};}
 }
 const spell=command?.type==='spell'?automaticEffects[command.request.id]:command?.type==='spell-ruling'?automaticEffects[scene.pendingSpell?.id]:null;
 const hostile=typeof command==='string'&&(command.startsWith('attack:')||command.startsWith('throw:')||command.startsWith('item:')||['grapple','shove'].includes(command))||spell&&(spell.attack||spell.save||spell.missile||spell.inflict||spell.trueStrike||spell.smite)||command?.type==='spell-ruling'&&(command.ruling?.damage??0)>0;
 if(scene.stage==='combat'&&scene.openingAttackAvailable&&hostile){
  const opening=adventureStepCore(scene,health,hero,command,random,{suppressEnemy:true,opening:true});
  if(opening.error||opening.waiting||opening.game===scene)return opening.error?{...opening,game,health}:opening;
  // The opening move is a turn of its own: what lasts a turn ends with it, and Vex reaches into the next.
  opening.game=endHeroTurn({...opening.game,openingAttackAvailable:false});
  opening.events=['Opening attack.',...(opening.events??[])];
  if(opening.game.stage!=='combat'||opts.party)return strip(opening);
  const stats=combatBasics(hero),foe=encounterFoe(hero,scene),a=1+Math.floor(random()*20),b=stats.initiativeAdvantage?1+Math.floor(random()*20):a,enemyDie=1+Math.floor(random()*20),enemyBonus=foe.saves?.Dexterity??0;
  const initiative={player:Math.max(a,b)+stats.initiative,foe:enemyDie+enemyBonus};
  opening.game.encounterInitiative=initiative;
  opening.events.push('Your initiative: d20 ['+[a,...(stats.initiativeAdvantage?[b]:[])].join(', ')+'] + '+stats.initiative+' = '+initiative.player+'.',foe.name+' initiative: d20 '+enemyDie+' + '+enemyBonus+' = '+initiative.foe+'.','Turn order: '+(initiative.player>=initiative.foe?'You → '+foe.name:foe.name+' → You')+'.','Round 1 begins.');
  let result=opening;
  if(initiative.foe>initiative.player){
   result=adventureStepCore(opening.game,opening.health,hero,'enemy-turn',random,{enemyOnly:true});
   result.events=[...opening.events,...(result.events??[])];result.game={...result.game,round:1};
  }
  if(result.game.stage==='combat')result.events.push('Your turn.');
  result.game={...result.game,bonusUsed:false,reactionUsed:false,slotSpentThisTurn:false,log:[...result.events,...game.log].slice(0,40)};
  return strip(result);
 }
 const result=adventureStepCore(scene,health,hero,command,random,opts.party?{foeWaits:true}:{});
 if(result.game.stage==='combat'&&scene.stage!=='combat')result.game={...result.game,openingAttackAvailable:true,encounterInitiative:undefined};
 // A bonus action (a draught, Second Wind) before the first blow leaves the opening attack for the action that follows.
 else if(scene.openingAttackAvailable&&!result.error&&!result.waiting&&result.game!==scene&&!(result.game.bonusUsed&&!scene.bonusUsed&&result.game.round===scene.round))result.game={...result.game,openingAttackAvailable:false};
 return strip(result);
}
