import {storyText,questState} from './storyRules';
import {recordNpcAggression,npcServiceError,npcScene,npcProfile,npcMaxHP,npcLore,npcCombatParticipants,npcIdsOf,forgetLands} from "./npcRules";
import {automaticEffects,requestSpell,resolveSpellRuling,spellDefense,concentrationAfterDamage,riderDamage,attackBoost,helpless,spendGuidance,banedAttack,charmedBy,spellTurnStarts,spellTurnEnds,shieldReaction,tickBuffs,resistedDamage,wokenByHarm,endSpellMarks,heroTurnBegins,personDefenses,lastingTurn,wardEdge,spellAgain,moveMark,markGone,harmCreature,againError,withDefenses,defended} from "./spellRules";
import {dungeonRooms,dungeonAction} from "./dungeonRules";
import {campaignState,campaignAction} from "./campaignRules";
import {beginJournal,recordJournalTransition,appendJournal} from "./journalRules";
import {mapState,mapLocation,travelError,travelTo,discoveryError,discoverPlace,worldPlace,travelRoute,timePasses,beyondError,goBeyond,landsToForget,knownLand} from "./mapRules";
import {resolveClassAction,bonusOptions,shortRestLimit,surgeReady,turnCost} from "./classActions";
import {combatBasics} from "./combatRules";
import {attackOptions,attacksPerAction,rollAttack,rollDamage,rangedMode,weaponRange,canThrow,thrownAttack,oneHanded} from "./weaponRules";
import {modifier} from "./characterRules";
import {updateHealth} from "./healthRules";
import {fallAtZero,deathSave,causeOfFall,fallPlace} from "./deathRules";
import {placeName} from "./mapRules";
import {journalForGame} from "./journalRules";
import {recordConsequences,recordDeed} from "./relationshipRules";
import {gearedHero,arrowsLeft,spendArrow,spendThrown,gatherThrown,potionHealing} from "./inventoryRules";
import {heroConditions,shieldBlow,undeadFortitude,companionsAttack,companionBrawlWeapon,foeRoundMoves,foeAttackMode,pickFoeTarget,partyHeroName,foeHitsCompanion,foeHitExtras,startWildFight,endWildFight,validFoeSketch,allFoeTemplates,companionAid,naturalAllies,allyStats,livingAllies,aimedAlly,hurtAlly,alliesScatter,partyTargets,foeHitsPartyHero,fightingCompanions,sideStrength,brawlStrength,foeScaleKey,foeScaleOf,scaledFoe,foeOffense} from "./encounterRules";
import {isPartyGame,settleParty,partyView} from "./partyRules";
import {boonKeyOf,masteryOf,isLight,offhandWeapons,creatureSize,withinGrip,unarmedDC,unarmedSave,heroIdOf,markOf,withMark,grappledBy,letGo,holding,heroEdge,edgeMode,foeEdge,creatureTurnStarts,sapSpent,sapsEnd,endHeroTurn,fightOver} from "./masteryRules";
import {proficiencyBonus} from "./characterRules";
import {withSpoils,takeSpoils,magicItems,packMagic,rechargeWands} from "./lootRules";
import {subclassAction,subclassUsesLeft,subclassRiderRoll,subclassWardRoll,subclassVictoryTemp,subclassPassive,subclassShortRecharge,subclassSpender} from "./subclassRules";
import {manageFollower,orderFollowers,acceptOffer} from "./followerRules";
// A pack carried into a new adventure: arrows shot stay spent, thrown weapons are back in hand.
function thrownPickedUp(pack){
  if(!pack?.spent||Object.keys(pack.spent).every(k=>k==='Arrow'))return pack;
  const next={...pack},spent=Object.fromEntries(Object.entries(pack.spent).filter(([k])=>k==='Arrow'));
  if(Object.keys(spent).length)next.spent=spent;else delete next.spent;
  return next;
}
// Damage past 0 HP from one blow (temporary HP soaks first): it decides an outright death.
const overflowOf=(previous,amount)=>Math.max(0,amount-(previous?.temp??0)-(previous?.current??0));
const fall=(game,source,overflow,maximum,who)=>fallAtZero(game,{overflow,maximum,cause:who??causeOfFall(game,source),placeName:placeName(game,fallPlace(game))});
  export const lanternFoe = {
    name: 'Lantern Wisp',
    maximum: 10,
    ac: 11,
    attackBonus: 2,
    bonus: 0,
    count: 1,
    die: 4,
    type: 'Cold',
    saves: {
      Dexterity: 2,
      Wisdom: 0
    }
  };
  // The foe as it fights: its own numbers, scaled to the side it faces (encounterRules.js scaledFoe; a hero alone is
  // never scaled).
  export function encounterFoe(hero, game) {
    // With what it is immune or vulnerable to (spellRules.js creatureDefenses: the undead take no Poison, a skeleton
    // breaks under Bludgeoning).
    return withDefenses(game, 'foe', scaledFoe(baseEncounterFoe(hero, game), foeScaleOf(game)));
  }
  // A fight under way against a bigger side than it was written for: the foe's scale is set (or raised, when someone
  // joins) and its hit points (and any creature at its side) grow in proportion. Never lowered mid-fight.
  export function withFoeScale(game, hero) {
    if (game?.stage !== 'combat' || game.npcCombat?.active || !(game.enemyHP > 0)) return game;
    const f = sideStrength(game, hero), key = foeScaleKey(game), cur = game.foeScale?.key === key ? game.foeScale.f : 1;
    if (!(f > cur + 0.001)) return game;
    const base = baseEncounterFoe(hero, game), was = scaledFoe(base, cur).maximum, now = scaledFoe(base, f).maximum, grow = now / was;
    const next = {...game, foeScale: {f, key}, enemyHP: Math.min(now, Math.max(1, Math.round(game.enemyHP * grow)))};
    if (Array.isArray(game.foeAllies)) next.foeAllies = game.foeAllies.map(a => { const maximum = Math.min(500, Math.round(a.maximum * f / cur)); return {...a, maximum, hp: Math.min(maximum, Math.round(a.hp * maximum / a.maximum))}; });
    return next;
  }
  function baseEncounterFoe(hero, game) {
    if (game?.dungeon?.active && game.stage === 'combat') {
      const boss = game.dungeon.room === 6;
      return {
        ...lanternFoe,
        name: dungeonRooms[game.dungeon.room].foe,
        maximum: (boss ? 14 : 8) + 4 * (hero.level - 1),
        ac: boss ? 13 : 11,
        attackBonus: boss ? 3 : 2
      };
    }
    // A creature met at a place found while exploring fights with its own stats.
    if (game?.wildFight) return {...lanternFoe, ...game.wildFight.stats, name: game.wildFight.name};
    // A story may bring its own stat block (and group size); otherwise the standard encounter scaling applies.
    if (game?.story?.foeStats) return {...lanternFoe, ...game.story.foeStats, name: game.story.foe};
    const level = game?.encounterLevel ?? 1;
    return {
      ...lanternFoe,
      type: game?.story?.foeDamageType ?? lanternFoe.type,
      maximum: 10 + 8 * (level - 1),
      ac: 11 + Math.floor((level - 1) / 4),
      attackBonus: 2 + Math.floor((level - 1) / 4),
      count: 1 + Math.floor((level - 1) / 5),
      saves: {
        Strength: 0,
        Dexterity: 2 + Math.floor((level - 1) / 4),
        Constitution: 1,
        Wisdom: Math.floor((level - 1) / 4),
        Intelligence: 0,
        Charisma: 0
      }
    };
  }
  // Members of a group still standing: each holds memberHP of the shared pool.
  export function foeStanding(foe, enemyHP) {
    if (!foe?.group || enemyHP <= 0) return enemyHP > 0 ? 1 : 0;
    return Math.min(foe.group.size, Math.ceil(enemyHP / foe.group.memberHP));
  }
  export const newAdventure = (hero, previous) => ({
    followers: previous?.followers,
    skillTraining: previous?.skillTraining,
    npcMemory: previous?.npcMemory,
    actionEvents: previous?.actionEvents,
    npcHP: previous?.npcHP,
    npcClasses: previous?.npcClasses,
    worldFacts: previous?.worldFacts,
    dungeon: previous?.dungeon ? {
      ...previous.dungeon,
      active: false
    } : undefined,
    dmChecks: previous?.dmChecks ?? [],
    campaign: campaignState(previous),
    map: {
      visited: ['inn'],
      accepted: false,
      clue: false,
      peaceful: false,
      minutes: 0
    },
    journal: beginJournal(previous),
    stage: 'inn',
    encounterLevel: hero?.level ?? 1,
    enemyHP: 10 + 8 * ((hero?.level ?? 1) - 1),
    // What you carry comes with you (weapons thrown in an unfinished fight picked up again); a fresh start always has
    // at least one draught.
    ...(previous?.pack ? {pack: thrownPickedUp(previous.pack)} : {}),
    // Experience (and, in old saves, a level earned on the road and not yet taken) stays earned; deeds are the hero's
    // for good.
    ...(Number.isInteger(previous?.xp) ? {xp: previous.xp} : {}),
    ...(previous?.levelsOwed ? {levelsOwed: previous.levelsOwed} : {}),
    ...(previous?.deeds?.length ? {deeds: previous.deeds} : {}),
    potions: Math.max(1, previous?.potions ?? 1),
    round: 1,
    log: []
  });
  function adventureStepCore(game, health, hero, action, random = Math.random, turnOptions = {}) {
    const result = resolveAdventureStep(game, health, hero, action, random, turnOptions);
    result.events = result.events ?? stepLogEntries(game.log,result.game?.log);
    if (result.error || result.waiting || result.game === game) return result;
    if (game.dungeon?.active && game.stage === 'combat' && result.game.stage === 'victory') {
      result.events=result.events.filter(t=>!t.includes('wisp settles')&&!t.includes('restored the crossing'));
      result.events.push(dungeonRooms[game.dungeon.room].foe+' is defeated. The next passage is open.');
      const cleared = [...new Set([...game.dungeon.cleared, game.dungeon.room])];
      result.game = {
        ...result.game,
        stage: 'dungeon',
        dungeon: {
          ...game.dungeon,
          cleared
        },
        log: [dungeonRooms[game.dungeon.room].foe + ' is defeated. The next passage is open.', ...result.game.log.filter(t => !t.includes('wisp settles') && !t.includes('restored the crossing'))].slice(0, 40)
      };
    }
    if (game.dungeon?.active && ['defeat', 'escaped'].includes(result.game.stage)) result.game = {
      ...result.game,
      dungeon: {
        ...game.dungeon,
        active: false
      }
    };
    // A fight at a found place ends back at that place (or the way you came, if you ran); the story's own foe is untouched.
    // In a party, a hero who falls leaves the fight to the others while anyone stands (partyRules.js stageAfterFall).
    const partyFightsOn = isPartyGame(result.game) && ['dying', 'dead'].includes(result.game.stage) && anyoneStanding(result.game);
    if (game.wildFight && result.game.wildFight && result.game.stage !== 'combat' && !partyFightsOn) {
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
    // Tricks and conditions belong to one fight.
    if (result.game.stage !== 'combat' && (result.game.heroCondition || (result.game.foeTricks && !partyFightsOn))) {
      result.game = {...result.game};
      delete result.game.heroCondition;
      if (!partyFightsOn) delete result.game.foeTricks;
    }
    // Arriving somewhere new can be dangerous: a lair's creature (or one you fled from) is waiting, and a risky
    // place may hide an ambush the first time you set foot there.
    if ((action?.type === 'travel' || action?.type === 'discover' || action?.type === 'beyond') && result.game.stage === 'wild' && !result.game.wildFight) {
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
    const resolvedSpell = action?.type === 'spell-ruling' ? game.pendingSpell : null;
    const spellEffect = resolvedSpell ? automaticEffects[resolvedSpell.id] : null;
    const harmfulSpell = resolvedSpell?.npcTarget && (spellEffect && (spellEffect.attack || spellEffect.save || spellEffect.missile) || (action.ruling?.damage ?? 0) > 0);
    // A spell that drops someone kills them, just as a weapon does.
    if (harmfulSpell) {
      const id = resolvedSpell.npcTarget, was = game.npcHP?.[id] ?? npcProfile(game, id).maximumHP;
      if (was > 0 && (result.game.npcHP?.[id] ?? npcProfile(game, id).maximumHP) === 0 && !result.game.npcFate?.[id]) {
        const line = npcProfile(game, id).name + ' is dead.';
        result.game = {...result.game, npcFate: {...result.game.npcFate, [id]: 'dead'}, log: [line, ...result.game.log].slice(0, 40)};
        result.events.push(line);
      }
    }
    if (action?.type === 'npc-attack' || harmfulSpell) {
      const beforeAggression=result.game;
      result.game = recordNpcAggression(game, result.game, action.type === 'npc-attack' ? action.target : resolvedSpell.npcTarget, action.type === 'npc-attack' ? 'weapon-attack' : 'harmful-spell');
      // Others an area or a many-target spell caught remember it too.
      if (harmfulSpell) for (const id of npcIdsOf(game)) if (id !== resolvedSpell.npcTarget && (result.game.npcHP?.[id] ?? npcProfile(result.game, id)?.maximumHP ?? 0) < (game.npcHP?.[id] ?? npcProfile(game, id)?.maximumHP ?? 0)) result.game = recordNpcAggression(game, result.game, id, 'harmful-spell');
      result.events.push(...stepLogEntries(beforeAggression.log,result.game.log));
    }
    const map = mapState(result.game),
      location = mapLocation(result.game);
    const mapped = {
      ...result.game,
      dmChecks: result.game.dmChecks ?? game.dmChecks ?? [],
      map: {
        ...map,
        visited: [...new Set([...map.visited, location])]
      }
    };
    let recorded = recordJournalTransition(game, mapped, action, hero);
    if (action?.type === 'npc-attack' || harmfulSpell) recorded = {
      ...recorded,
      journal: appendJournal(recorded.journal, 'encounter', 'Witnessed attack', recorded.log.slice(0, 6).join('\n'))
    };
    if (result.campaignEvent) recorded = {
      ...recorded,
      journal: appendJournal(recorded.journal, 'quest', result.campaignEvent.title, result.campaignEvent.text)
    };
    // People remember: a killing, a knockout, a life saved or the main foe's end changes how they feel about the player.
    const consequences = recordConsequences(game, recorded);
    recorded = consequences.lines.length ? {...consequences.game, log: [...consequences.lines, ...consequences.game.log].slice(0, 40)} : consequences.game;
    result.events.push(...consequences.lines);
    return {
      ...result,
      game: recorded
    };
  }
  function resolveAdventureStep(game, health, hero, action, random = Math.random, turnOptions = {}) {
    const stats = combatBasics(hero),
      foe = encounterFoe(hero, game);
    if (!stats.available || stats.ac === null) return {
      game,
      health
    };
    let next = {
        ...game
      },
      hp = {
        current: health?.current ?? stats.hp,
        temp: health?.temp ?? 0
      };
    const entries = [];
    // In a party's fight the hero's turn can end without the foe answering (turnOptions.foeWaits): the turn order
    // (adventureStep) is told that it is over, and whether the hero took the Dodge.
    let turnOver = false, dodged = false;
    if (action?.type === 'cancel-spell') {
      delete next.pendingSpell;
      return {
        game: next,
        health
      };
    }
    if (game.pendingSpell && action?.type !== 'spell-ruling') return {
      game,
      health,
      error: 'Resolve or cancel the spell request first.'
    };
    const serviceError = npcServiceError(game, action);
    if (serviceError) return {
      game,
      health,
      error: serviceError
    };
    if (action?.type === 'npc-attack') {
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
    if (typeof action === 'string' && action.startsWith('check:')) {
      const id = action.slice(6),
        checks = {
          'persuade-keeper': {
            stage: 'inn',
            ability: 'Charisma',
            dc: 10
          },
          'investigate-signal': {
            stage: 'tower',
            ability: 'Intelligence',
            dc: 10
          }
        },
        check = checks[id];
      if (!check || game.stage !== check.stage || (game.dmChecks ?? []).includes(id) || hp.current <= 0 || id === 'investigate-signal' && mapState(game).clue) return {
        game,
        health,
        error: 'That check is not available in this scene.'
      };
      const die = 1 + Math.floor(random() * 20),
        bonus = modifier(hero.scores[check.ability]),
        success = die + bonus >= check.dc;
      const outcome = success ? id === 'persuade-keeper' ? 'The keeper shares a lead: investigate the carved instructions beneath the watchtower bell.' : 'You decipher the signal: low, high, low. Return to the bridge to call the light home.' : 'You learn nothing new from this attempt. You can still use the scene’s other interactions.';
      const text = `${check.ability} check: d20 ${die} ${bonus >= 0 ? '+' : ''}${bonus} = ${die + bonus} vs DC ${check.dc}. ${success ? 'Success.' : 'Failure.'} ${outcome}`;
      next.dmChecks = [...(game.dmChecks ?? []), id];
      if (success && id === 'investigate-signal') next.map = {
        ...mapState(game),
        clue: true
      };
      next.log = [text, ...game.log].slice(0, 40);
      return {
        game: next,
        health,
        campaignEvent: {
          title: 'Ability check',
          text
        }
      };
    }
    if (action === 'restart-adventure' && ['victory', 'defeat', 'escaped'].includes(game.stage)) return {
      game: newAdventure(hero, game),
      health: null
    };
    const dungeonResult = dungeonAction(game, health, hero, action, random);
    if (dungeonResult) return dungeonResult;
    const campaignResult = campaignAction(game, action);
    if (campaignResult) {
      if (campaignResult.error) return {
        game,
        health,
        error: campaignResult.error
      };
      return {
        game: {
          ...campaignResult.game,
          log: [campaignResult.text, ...game.log].slice(0, 40)
        },
        health,
        campaignEvent: campaignResult
      };
    }
    if (action?.type === 'end-concentration') {
      delete next.concentration;
      next.log = ['You end concentration.', ...game.log].slice(0, 40);
      return {
        game: next,
        health
      };
    }
    if (action?.type === 'travel') {
      const error = travelError(game, action.destination);
      if (error) return {
        game,
        health,
        error
      };
      if (hp.current <= 0) return {
        game,
        health,
        error: 'You need to recover before traveling.'
      };
      const traveling={...game};delete traveling.npcCombat;return travelTo(traveling, hp, action.destination);
    }
    if (action?.type === 'discover') {
      const error = discoveryError(game, action);
      if (error) return {
        game,
        health,
        error
      };
      if (hp.current <= 0) return {
        game,
        health,
        error: 'You need to recover before exploring.'
      };
      const exploring={...game};delete exploring.npcCombat;
      // A place in a new land when the atlas is full: the land longest unvisited is forgotten first (mapRules.js).
      const far=action.place?.region&&!knownLand(game,action.place.region.name);
      const room=forgetLands(exploring,landsToForget(exploring,{places:1,lands:far?1:0})??[]);
      const found=discoverPlace(room.game, hp, action, room);
      return room.lines.length&&!found.error?{...found,events:[...room.lines,...(found.events??[])]}:found;
    }
    // Beyond the edge of the map: a new land opens that way (forgetting the land longest unvisited when the atlas is
    // full) and the hero walks there; the trip takes days.
    if (action?.type === 'beyond') {
      const error = beyondError(game, action.bearing);
      if (error) return {game, health, error};
      if (hp.current <= 0) return {game, health, error: 'You need to recover before traveling.'};
      const leaving={...game};delete leaving.npcCombat;
      const room=forgetLands(leaving,landsToForget(leaving,{lands:1,places:1})??[]);
      const trip=goBeyond(room.game, hp, action.bearing, room);
      return {game:trip.game, health:trip.health, events:[...room.lines, ...trip.events]};
    }
    // A healing draught for someone else: a companion lying senseless comes round (and owes you their life).
    const givePotion = () => {
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
    };
    if (action?.type === 'give-potion' && game.stage !== 'combat') {
      const error = givePotion();
      if (error) return {game, health, error};
      next.log = [...entries, ...game.log].slice(0, 40);
      return {game: next, events: entries, health: hp};
    }
    // Drinking a healing draught away from a fight.
    if (action === 'potion' && game.stage !== 'combat') {
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
    if (typeof action === 'string' && action.startsWith('drink:') && game.stage !== 'combat') {
      if (!['inn', 'bridge', 'tower', 'wild', 'victory'].includes(game.stage) || game.npcCombat?.active) return {game, health, error: 'You cannot drink a draught right now.'};
      const drunk = drinkDraught(next, hp, stats.hp, action.slice(6), random);
      if (drunk.error) return {game, health, error: drunk.error};
      next = drunk.game; hp = drunk.health; entries.push(drunk.line);
      next.log = [...entries, ...game.log].slice(0, 40);
      return {game: next, events: entries, health: hp};
    }
    // The Dungeon Master springs a creature on you at a found place (a hunting beast, a guardian, an ambush).
    if (action?.type === 'ambush') {
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
    if (action === 'inspect-tower') {
      if (game.stage !== 'tower') return {
        game,
        health,
        error: 'Visit the watchtower to investigate.'
      };
      if (mapState(game).clue) return {
        game,
        health,
        error: 'You have already learned the lantern call.'
      };
      next.map = {
        ...mapState(game),
        clue: true
      };
      next.log = ['Beneath the watchtower bell, you find three musical marks: low, high, low. A carved message reads: Call the lost light home; it guards the crossing still.', ...game.log].slice(0, 40);
      return {
        game: next,
        health
      };
    }
    if (['call-wisp', 'approach'].includes(action) && game.enemyHP === 0) return {
      game,
      health,
      error: 'The bridge is already safe.'
    };
    if (action === 'call-wisp') {
      if (game.stage !== 'bridge' || !mapState(game).clue) return {
        game,
        health,
        error: 'Learn the watchtower signal and return to the bridge first.'
      };
      if (hp.current <= 0) return {
        game,
        health,
        error: 'You need to recover first.'
      };
      next.stage = 'victory';
      next.enemyHP = 0;
      next.map = {
        ...mapState(game),
        peaceful: true
      };
      next.log = ['You hum the watchkeeper’s call: low, high, low. The wisp answers and settles into the lamp. You restore the crossing without a fight.', ...game.log].slice(0, 40);
      return {
        game: next,
        health
      };
    }
    // An attack or spell aimed at the creature fighting beside the foe ("ally:0").
    // A held spell used again on a person in a brawl, or Hex moved to a person: their own defences and hit points.
    if (typeof action === 'string' && /^(again|move-mark):/.test(action) && game.stage !== 'combat') {
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
    // A held spell used again ("again:<creature>") or Hex moved ("move-mark:<creature>") names its creature.
    const sustained = game.stage === 'combat' && typeof action === 'string' && /^(again|move-mark):/.test(action) ? action.slice(action.indexOf(':') + 1) : null;
    const aim = game.stage === 'combat' ? aimedAlly(game, sustained ?? action?.request?.aim ?? (action?.type === 'spell-ruling' ? game.pendingSpell?.aim : null) ?? game.aim) : null;
    if (sustained !== null && sustained !== 'foe' && aim === null) return {game, health, error: 'That creature is not in this fight.'};
    const aimedFoe = aim !== null ? allyStats(game, aim, hero.level ?? 1) : null;
    let spellResult = null;
    if (action?.type === 'spell' || action?.type === 'spell-ruling') {
      // An area, or a spell with several targets, can reach the other creatures in the fight too.
      const others = game.stage === 'combat' && game.enemyHP > 0 ? [{...foe, key: 'foe'}, ...livingAllies(game).map(a => ({...allyStats(game, a.index, hero.level ?? 1), key: 'ally:' + a.index}))] : [];
      spellResult = action.type === 'spell' ? requestSpell(hero, game, hp, stats.hp, action.request, random, {...(aimedFoe ?? foe), others}) : resolveSpellRuling(hero, game, hp, stats.hp, action.ruling, random);
      if (spellResult.error) return {
        game,
        health,
        error: spellResult.error
      };
      if (spellResult.waiting || game.stage !== 'combat') return {
        ...spellResult,
        events: spellResult.logs,
        game: {
          ...spellResult.game,
          log: [...spellResult.logs, ...game.log].slice(0, 40)
        }
      };
    }
    // A lasting spell used again (Spiritual Weapon, Heat Metal, the Flaming Sphere, Moonbeam, Call Lightning, Vampiric
    // Touch), or Hex or Hunter's Mark moved to a new creature once its own has dropped: played like a spell's result.
    if (sustained !== null) {
      const struck = aim !== null ? 'ally:' + aim : 'foe', called = aimedFoe ? 'the ' + aimedFoe.name : foe.group ? 'the ' + foe.group.plural : 'the ' + foe.name.replace(/^the /i, '');
      spellResult = action.startsWith('again:') ? spellAgain(hero, game, hp, stats.hp, struck, aimedFoe ?? foe, random) : {health: hp, ...moveMark(game, struck, called)};
      if (spellResult.error) return {game, health, error: spellResult.error};
    }
    // A short rest, as in Baldur's Gate 3: two between long rests (three for a Bard with Song of Rest), anywhere
    // out of a fight. It restores half the hero's hit points, and half of each companion's, and what returns on a
    // short rest: a Fighter's Second Wind and a Warlock's spell slots. A long rest brings the short rests back.
    if (action === 'short-rest') {
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
    if (action === 'long-rest' && game.stage === 'inn') {
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
    if (game.stage === 'inn' && ['study', 'listen'].includes(action)) {
      if (mapState(game).accepted) return {
        game,
        health,
        error: 'The quest is already accepted. Use the map to travel.'
      };
      next.stage = 'bridge';
      next.map = {
        ...mapState(game),
        accepted: true,
        visited: [...new Set([...mapState(game).visited, 'bridge'])]
      };
      const journey = travelTo({
        ...game,
        map: {
          ...mapState(game),
          accepted: true
        }
      }, hp, 'bridge');
      next = journey.game;
      hp = journey.health;
      entries.push(journey.game.log[0]);
      if (action === 'study') {
        const die = 1 + Math.floor(random() * 20),
          bonus = modifier(hero.scores.Intelligence);
        entries.push(`Study the lantern: ${die} ${bonus >= 0 ? '+' : ''}${bonus} = ${die + bonus} against DC 10.`);
        if (die + bonus >= 10) {
          hp.temp = Math.max(hp.temp, 3);
          entries.push('You awaken a protective spark: 3 temporary HP (keep a higher existing amount).');
        } else entries.push('The markings remain a mystery, but the flame points toward the old bridge.');
      } else entries.push('The keeper explains: a lost wisp has stolen the bridge light. You promise to bring it home.');
      entries.push('The keeper lends you one healing draught. Follow the blue sparks to the bridge.');
    } else if (game.stage === 'bridge' && action === 'approach') {
      next.stage = hp.current > 0 ? 'combat' : 'defeat';
      next.openingAttackAvailable = true;
      delete next.encounterInitiative;
      // A written story's foe is met in its own words; the crossroads wisp keeps its lamp.
      entries.push(game.story ? (foe.group ? 'The ' + foe.group.plural + ' are upon you. While they gather themselves, you have the first move.' : 'The ' + game.story.foe + ' is upon you. While it gathers itself, you have the first move.') : 'A Lantern Wisp rises from the broken lamp. While it gathers itself, you have the first move.');
    } else if (game.stage === 'combat') {
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
        const error = givePotion();
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
          const damage = rollDamage(foe, attack.critical, random);
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
          const damage = rollDamage(a, attack.critical, random), resisted = resistedDamage(next, a.type, Math.max(1, damage.total), random);
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
    } else return {
      game,
      health
    };
    if (next.stage === 'victory' && game.stage !== 'victory' && hero.level >= 3 && hero.class === 'Warlock' && hero.plannedSubclass === 'Fiend Patron') {
      hp.temp = Math.max(hp.temp, Math.max(1, hero.level + modifier(hero.scores.Charisma)));
      entries.push('Dark One’s Blessing grants temporary HP.');
    }
    // A subclass's gift on a won fight (Ferryman's Due).
    const gift = next.stage === 'victory' && game.stage !== 'victory' ? subclassVictoryTemp(hero) : null;
    if (gift) {
      hp.temp = Math.max(hp.temp, gift.amount);
      entries.push(`${gift.name}: ${gift.amount} temporary HP.`);
    }
    next.log = [...entries, ...game.log].slice(0, 40);
    return {
      game: next,
      events: entries,
      health: hp,
      ...(turnOver ? {turnOver, dodged} : {})
    };
  }
// A hero's own spells count down at the end of each of their turns: concentration, and temporary hit points from a
// spell such as False Life.
function tickHeroSpells(next, hp) {
  if (next.concentration?.fresh) { next.concentration = {...next.concentration}; delete next.concentration.fresh; }
  if (next.concentration?.remaining !== null && next.concentration?.remaining !== undefined) {
    next.concentration = {...next.concentration, remaining: next.concentration.remaining - 1};
    if (next.concentration.remaining <= 0) delete next.concentration;
  }
  if (next.buffs) { const ticked = tickBuffs(next); if (ticked.buffs) next.buffs = ticked.buffs; else delete next.buffs; }
  if (next.concentration?.used) { next.concentration = {...next.concentration}; delete next.concentration.used; }
  if (next.temporarySpell) {
    next.temporarySpell = {...next.temporarySpell, remaining: next.temporarySpell.remaining - 1};
    if (next.temporarySpell.remaining <= 0) {
      hp.temp = 0;
      delete next.temporarySpell;
    }
  }
}

// How many of a weapon the hero has in hand right now (the hero the rules see: thrown ones not yet gathered are gone).
const inHand=(hero,name)=>(hero.equipment?.items??[]).filter(i=>i.name===name).reduce((n,i)=>n+(i.quantity??0),0);
// `opts.party`: a party's fight, whose turns adventureStep orders. The opening attack rolls no initiative here (every
// hero rolls once it is made), and a hero's turn ends without the foe answering.
function creatureCombatStep(game,health,hero,action,random,opts={}){
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

function adventureStepEngine(game,health,hero,action,random=Math.random,opts={}){
 const stats=combatBasics(hero),pending=action?.type==='spell-ruling'?game.pendingSpell:null;
 const effect=pending?automaticEffects[pending.id]:null;
 const target=action?.type==='npc-attack'?action.target:pending?.npcTarget&&((effect&&(effect.attack||effect.save||effect.missile||effect.trueStrike))||(action.ruling?.damage??0)>0)?pending.npcTarget:null;
 const active=game.npcCombat?.active;
 if(!active&&!target)return creatureCombatStep(game,health,hero,action,random,opts);
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
 const special=active&&['npc-dodge','npc-wait'].includes(action);
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
 let result=special?{game:{...next,log:[action==='npc-dodge'?'You take the Dodge action.':'You hold your ground.',...next.log].slice(0,40)},health:hp}:adventureStepCore(next,hp,hero,action,random);
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
function runNpcTurns(game,health,hero,turns,dodge,random,party=null){
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
  const damageRoll=hit?rollDamage(weapon,attack.critical,random):null;let damage=damageRoll?.total??0;
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

// A single engine phase prepends its entries, already in execution order.
function stepLogEntries(before=[],after=[]){
 if(before===after)return [];
 for(let start=0;start<after.length;start++){
  const tail=after.slice(start);
  if(tail.length<=before.length&&tail.every((line,i)=>line===before[i]))return after.slice(0,start);
 }
 return after.slice();
}

export function adventureStep(game,health,hero,action,random=Math.random){
 // Two moves in one message (dmCommands.js twoMoves): played one after the other while the turn allows.
 if(action?.type==='turn')return wholeTurn(game,health,hero,action,random);
 // A foe facing more than one hero (companions, allies, a party) is scaled to the side, before and after the move
 // (a fight may begin, or someone join it, in this step).
 const scaled=withFoeScale(game,hero);
 // A party at the shared table takes its fights in turns.
 const played=isPartyGame(scaled)?partyStep(scaled,health,hero,action,random):heroStep(scaled,health,hero,action,random);
 const result=played.error||played.waiting||!played.game||played.game===scaled?{...played,game:played.game===scaled?game:played.game}:{...played,game:withFoeScale(played.game,hero)};
 // Whatever fell in this step (a creature, a lair's owner, the tale's foe, a person) can be searched afterwards.
 return withSpoils(game,result,hero);
}
// A whole turn from one sentence: an action and a bonus action (or a free move) in a fight, in the order said; or one
// move with the rest of the sentence told to wait (`rest`, `why`). The second move follows only while it is still this
// hero's turn (the first paused for a bonus action, or was itself the bonus action).
function wholeTurn(game,health,hero,action,random){
 const steps=action.steps,fight=game.stage==='combat'||!!game.npcCombat?.active,said=typeof action.rest==='string'&&action.rest.length>0&&action.rest.length<=200?action.rest:null;
 const geared=gearedHero(hero,game),costs=Array.isArray(steps)?steps.map(s=>turnCost(geared,game,s)):[];
 if(!Array.isArray(steps)||steps.length<1||steps.length>2||steps.some(s=>!s||s.type==='turn')||(steps.length===1&&!said)||(steps.length===2&&!(fight&&costs.filter(c=>c==='action').length===1&&costs.some(c=>c!=='action'))))return {game,health,error:'One thing at a time.'};
 const wait=(result,line)=>({...result,events:[...(result.events??[]),line],game:{...result.game,log:[line,...(result.game.log??[])].slice(0,40)}});
 const first=adventureStep(game,health,hero,steps[0],random);
 if(first.error||first.waiting)return first;
 if(steps.length===1)return wait(first,fight?'Not this turn: "'+said+'" must wait for your next turn ('+(action.why==='a turn has only one bonus action'?'a turn has only one bonus action':action.why==='send it on its own'?'send it on its own':'a turn has one action and one bonus action')+').':'One thing at a time: "'+said+'" waits for your next message.');
 const g=first.game,holder=g.turnOrder?.order?.[g.turnOrder.at]?.id;
 const still=(g.stage==='combat'||!!g.npcCombat?.active)&&!first.turnOver&&(!!g.actionUsed||!!g.bonusUsed&&!game.bonusUsed)&&(!g.turnOrder||holder===g.party?.lead);
 if(!still)return said?wait(first,'Not this turn: "'+said+'" must wait for your next turn.'):first;
 const second=adventureStep(g,first.health,hero,steps[1],random);
 if(second.error)return wait(first,'Not done: '+second.error);
 if(second.waiting)return wait(first,'Not done: that spell needs the Dungeon Master to rule on it, so cast it on its own.');
 return {...second,events:[...(first.events??[]),...(second.events??[])]};
}
// ---------- A party's fight: turns in initiative order ----------
// At the shared table (partyRules.js) each device plays its own hero. The first move of a fight (the opening attack)
// is anyone's; then every standing hero and the foe (or each person in a brawl) roll initiative, and the order is kept
// in the shared world (game.turnOrder: {order:[{id,init}], at, round, dodging}), so every device knows whose turn it
// is. A hero acts only on their own turn. When a hero's turn ends, the same device plays the foe's turn if it comes
// next: the foe strikes any standing hero, once a round. A hero who is down rolls their death save on their turn; a
// hero whose player has gone can be passed ({type:'party-pass'}).
export const partyFightOn=game=>!!game?.npcCombat?.active||game?.stage==='combat'||game?.party?.stage==='combat';
const d20=random=>1+Math.floor(random()*20);
const heroOf=character=>{try{return JSON.parse(character);}catch{return null;}};
const snapshotOf=(game,health,hero)=>({version:1,character:JSON.stringify(hero),game,health,chosen:true});
// up, down or dead; this device's own hero is read from its own game.
function memberStatus(game,id){
 if(id===game.party.lead)return game.stage==='dead'?'dead':game.stage==='dying'?'down':'up';
 return game.party.members[id]?.status??null;
}
function memberName(game,id,hero){
 if(id===game.party.lead)return hero?.name??'A hero';
 return heroOf(game.party.members[id]?.character)?.name??'A hero';
}
const anyoneStanding=game=>Object.keys(game.party.members).some(id=>memberStatus(game,id)==='up');
// A hero of a party lies down (or dead) while the fight goes on for those still standing (partyRules.js settleParty).
const partyFightGoesOn=(game,health,hero)=>isPartyGame(game)&&['dying','dead'].includes(game.stage)&&(!!game.npcCombat?.active||settleParty(snapshotOf(game,health,hero)).world.stage==='combat');
const fightFoeName=(hero,game)=>game.wildFight?.name??game.story?.foe??encounterFoe(hero,game).name;
// A death save in a party, whatever comes of it: the party stays where it is, so a hero who wakes (or rises) comes to
// where the others stand, never at the start alone while the world is elsewhere.
function stayWithParty(game,result){
 const next={...result.game,world:game.world,map:game.map};
 if(game.wildFight)next.wildFight=game.wildFight;else delete next.wildFight;
 if(!['dying','dead'].includes(next.stage)){const party={...next.party};next.stage=party.stage??next.stage;delete party.stage;next.party=party;}
 return {...result,game:next};
}
function withoutOrder(game){if(!game.turnOrder)return game;const next={...game};delete next.turnOrder;return next;}
// "Wolf: d20 … vs your AC 14. Hit." told of another hero, when the foe's turn is played from their point of view.
function toldOf(line,name){
 return line.replace(/^(.+?): d20 (.*?) vs your AC (\d+)\./,`$1 attacks ${name}: d20 $2 vs ${name}’s AC $3.`).replace(/^(.+?) attacks you:/,`$1 attacks ${name}:`)
  .replace(/^(.+? = \d+ \w+ damage)\. \d+ damage recorded: .*$/,`$1 to ${name}.`)
  .replace(/^The blow is so savage that it kills you outright\. You die\.$/,`The blow kills ${name} outright.`).replace(/^You fall unconscious and are dying\..*$/,`${name} falls unconscious and is dying.`)
  .replace(/\bat you\b/g,'at '+name).replace(/\byour eyes\b/g,name+'’s eyes').replace(/\bYour next attack\b/g,name+'’s next attack').replace(/\bYou are knocked prone\b/g,name+' is knocked prone').replace(/\bYou keep your feet\b/g,name+' keeps their feet').replace(/\bYou are restrained\b/g,name+' is restrained').replace(/\bYou tear free\b/g,name+' tears free');
}
// Those fighting against the hero who were already hostile (or bore a grudge) before the first blow: only beating
// them is worth experience (experienceRules.js), never beating up someone friendly.
function brawlWorthy(game,order){
 const worthy=order.filter(n=>n.side==='enemy'&&(game.npcMemory?.[n.id]?.attitude==='hostile'||game.npcMemory?.[n.id]?.grudge)).map(n=>n.id);
 return worthy.length?{worthy}:{};
}
function partyStep(game,health,hero,action,random){
 const result=partyStepCore(game,health,hero,action,random);
 if(result.error||result.waiting||!result.game||result.game===game)return result;
 return {...result,game:partyAftermath(result.game,result.health,hero)};
}
// After any party move: a hero who has fallen lets go of what they held (whoever's device played the blow), and once
// the party's fight is over (won, fled, or nobody left standing) nothing of it outlasts it, as for one hero alone. A
// hero who lies down while the others fight on keeps nothing of their own fight either.
function partyAftermath(game,health,hero){
 const settled=settleParty(snapshotOf(game,health,hero)),fallen=Object.keys(settled.members).filter(id=>settled.members[id].status!=='up');
 let next=game;
 for(const [key,mark] of Object.entries(game.marks??{}))if(fallen.includes(mark.grappled))next=withMark(next,key,{grappled:undefined});
 if(!next.npcCombat?.active&&settled.world.stage!=='combat')return fightOver(next);
 if(['dying','dead'].includes(next.stage)&&['vex','lastHit','hurtBy','shieldUp'].some(k=>next[k]!==undefined)){next={...next};for(const k of ['vex','lastHit','hurtBy','shieldUp'])delete next[k];}
 return next;
}
function partyStepCore(game,health,hero,action,random){
 const me=game.party.lead;
 if(game.turnOrder&&!partyFightOn(game))game=withoutOrder(game);
 const order=game.turnOrder;
 // No fight under way, or its first move still to be made: anyone may act.
 if(!order){
  if(action?.type==='party-pass')return {game,health,error:'There is no turn to pass.'};
  let result=heroStep(game,health,hero,action,random,{party:true});
  if(result.error||result.waiting||result.game===game)return result;
  if(game.stage==='dying')result=stayWithParty(game,result);
  if(!partyFightOn(result.game)||result.game.openingAttackAvailable||result.game.stage==='dying')return {...result,game:withoutOrder(result.game)};
  const begun=beginPartyFight(result.game,result.health,hero,random);
  return {...result,game:begun.game,health:begun.health,events:[...(result.events??[]),...begun.events]};
 }
 const current=order.order[order.at];
 // The foe's turn left unplayed (it never should be): play it now.
 if(!current||current.id==='foe'||current.id.startsWith('npc:')){const resumed=passTurns({...game,turnOrder:{...order,at:order.at-1}},health,hero,random);return {...resumed,error:resumed.game.turnOrder?.order?.[resumed.game.turnOrder.at]?.id===me?'The foe has acted. It is your turn now.':'The foe has acted.'};}
 // Another hero's turn, passed because their player has gone (or holds back).
 if(action?.type==='party-pass'){
  if(current.id===me)return {game,health,error:'It is your own turn: act, or end your turn.'};
  const name=memberName(game,current.id,hero),line=memberStatus(game,current.id)==='down'?name+' lies still: no death save this turn.':name+' holds their ground.';
  const passed=passTurns({...game,log:[line,...game.log].slice(0,40)},health,hero,random);
  return {game:passed.game,health:passed.health,events:[line,...passed.events]};
 }
 if(current.id!==me)return {game,health,error:'It is '+memberName(game,current.id,hero)+'’s turn. Wait for it.'};
 let result;
 if(game.stage==='dying'){
  // A death save on this hero's turn; whatever comes of it, the party stays where it is.
  result=dyingStep(game,health,hero,action,random);
  if(result.error)return result;
  result=stayWithParty(game,result);
 } else {
  result=heroStep(game,health,hero,action,random,{party:true});
  if(result.error||result.waiting||result.game===game)return result;
 }
 if(!partyFightOn(result.game))return {...result,game:withoutOrder(result.game)};
 // The turn goes on while a bonus action is still to be taken.
 if(game.stage!=='dying'&&!result.turnOver&&result.game.stage!=='dying')return result;
 let next=result.game;
 if(result.dodged)next={...next,turnOrder:{...next.turnOrder,dodging:[...new Set([...(next.turnOrder.dodging??[]),me])]}};
 const passed=passTurns(next,result.health,hero,random);
 return {...result,game:passed.game,health:passed.health,events:[...(result.events??[]),...passed.events]};
}
// Every standing hero rolls initiative (on this device, for all of them), and the foe or each person fighting.
function beginPartyFight(game,health,hero,random){
 let next={...game,bonusUsed:false,reactionUsed:false,slotSpentThisTurn:false};delete next.actionUsed;delete next.surged;delete next.dodging;
 const settled=settleParty(snapshotOf(next,health,hero)),entries=[],lines=[];
 for(const id of settled.order){
  const member=settled.members[id],h=heroOf(member?.character);if(member?.status!=='up'||!h)continue;
  const stats=combatBasics(h),a=d20(random),b=stats.initiativeAdvantage?d20(random):a,total=Math.max(a,b)+stats.initiative;
  entries.push({id,init:total,dex:h.scores?.Dexterity??10,hero:true});
  lines.push(`${h.name} initiative: d20 [${[a,...(stats.initiativeAdvantage?[b]:[])].join(', ')}] + ${stats.initiative} = ${total}.`);
 }
 if(next.npcCombat?.active){
  for(const n of next.npcCombat.order.filter(n=>n.id!=='player')){entries.push({id:'npc:'+n.id,init:n.initiative,dex:10});lines.push(`${npcProfile(next,n.id).name} initiative: d20 ${n.initiative} + 0 = ${n.initiative}.`);}
 } else {
  const foe=encounterFoe(hero,next),die=d20(random),bonus=foe.saves?.Dexterity??0;
  entries.push({id:'foe',init:die+bonus,dex:10+2*bonus});lines.push(`${fightFoeName(hero,next)} initiative: d20 ${die} + ${bonus} = ${die+bonus}.`);
 }
 // Ties go to the higher Dexterity, then to the heroes.
 entries.sort((a,b)=>b.init-a.init||b.dex-a.dex||Number(!!b.hero)-Number(!!a.hero)||a.id.localeCompare(b.id));
 const label=id=>id==='foe'?fightFoeName(hero,next):id.startsWith('npc:')?npcProfile(next,id.slice(4)).name:memberName(next,id,hero);
 lines.push('Turn order: '+entries.map(e=>label(e.id)).join(' → ')+'.','Round 1 begins.');
 next={...next,turnOrder:{order:entries.map(({id,init})=>({id,init})),at:-1,round:1,dodging:[]},log:[...lines,...next.log].slice(0,40)};
 const passed=passTurns(next,health,hero,random);
 return {game:passed.game,health:passed.health,events:[...lines,...passed.events]};
}
// Hands the turn on: past the dead, through the foe's turn (played here), to the next hero, standing or down.
function passTurns(game,health,hero,random){
 let next=game,hp=health;const lines=[],say=line=>{lines.push(line);next={...next,log:[line,...(next.log??[])].slice(0,40)};};
 for(let step=0;step<24;step++){
  if(!partyFightOn(next)||!anyoneStanding(next)){next=withoutOrder(next);break;}
  const t=next.turnOrder,known=new Set(t.order.map(e=>e.id));
  // A hero who joined during the fight takes the last place in the order.
  const order=[...t.order.filter(e=>e.id==='foe'||e.id.startsWith('npc:')||next.party.members[e.id]),...Object.keys(next.party.members).filter(id=>!known.has(id)&&memberStatus(next,id)==='up').map(id=>({id,init:0}))];
  let at=Math.min(t.at,order.length-1)+1,round=t.round;
  if(at>=order.length){at=0;round++;}
  const entry=order[at];
  next={...next,turnOrder:{...t,order,at,round}};
  if(round>t.round)say('Round '+round+' begins.');
  if(entry.id==='foe'||entry.id.startsWith('npc:')){const phase=foeTurn(next,hp,hero,entry.id,random);next=phase.game;hp=phase.health;lines.push(...phase.events);continue;}
  const status=memberStatus(next,entry.id);
  if(status!=='up'&&status!=='down')continue;
  next={...next,turnOrder:{...next.turnOrder,dodging:(next.turnOrder.dodging??[]).filter(id=>id!==entry.id)}};
  say(memberName(next,entry.id,hero)+'’s turn.');
  break;
 }
 return {game:next,health:hp,events:lines};
}
// The foe's turn (or one person's, in a brawl), played from a standing hero's point of view: this device's own hero
// when they stand, else the first standing hero in the order. The result is read back from this device's point of view.
function foeTurn(game,health,hero,id,random){
 const me=game.party.lead,snapshot=snapshotOf(game,health,hero),settled=settleParty(snapshot);
 const actor=[me,...game.turnOrder.order.map(e=>e.id)].find(m=>settled.members[m]?.status==='up');
 if(!actor)return {game,health,events:[]};
 const view=actor===me?snapshot:partyView(snapshot,actor),them=heroOf(view.character);
 if(!them)return {game,health,events:[]};
 const scene={...view.game};delete scene.pendingSpell;
 // Conditions the foe put on the others last round wear off as it acts again.
 scene.party={...scene.party,members:Object.fromEntries(Object.entries(scene.party.members).map(([m,v])=>[m,v.hero?.heroCondition?{...v,hero:(h=>{delete h.heroCondition;return h;})({...v.hero})}:v]))};
 const dodging=game.turnOrder.dodging??[],geared=gearedHero(them,scene);
 let result;
 if(id==='foe'){
  if(scene.stage!=='combat')return {game,health,events:[]};
  result=adventureStepCore(scene,view.health,geared,'enemy-turn',random,{enemyOnly:true,partyFoe:true,dodging});
 } else {
  const fighter=scene.npcCombat?.active?scene.npcCombat.order.find(n=>n.id===id.slice(4)):null;
  if(!fighter)return {game,health,events:[]};
  result=runNpcTurns(scene,view.health??{current:combatBasics(geared).hp,temp:0},geared,[fighter],false,random,{dodging});
 }
 if(result.error||!result.game)return {game,health,events:[]};
 result={...result,events:result.events??stepLogEntries(scene.log,result.game.log)};
 if(scene.story)toldInStory(scene,result);
 // Told of the hero it was played from, by name, unless that is this device's own hero.
 if(actor!==me){const fresh=result.events.length;result.events=result.events.map(t=>toldOf(t,them.name));result.game={...result.game,log:result.game.log.map((t,i)=>i<fresh?toldOf(t,them.name):t)};}
 const back=partyView({...view,game:result.game,health:result.health},me);
 if(!back)return {game,health,events:[]};
 // This device's own pending spell is its own business (none can be pending at a turn's end; kept for safety).
 return {game:{...back.game,...(game.pendingSpell?{pendingSpell:game.pendingSpell}:{})},health:back.health,events:result.events};
}
function heroStep(game,health,hero,action,random,opts={}){
 if(game.stage==='dead')return {game,health,error:'Your hero has died. Their story is over; begin a new tale with another hero.'};
 if(game.stage==='dying')return dyingStep(game,health,hero,action,random);
 // Searching the fallen: what they carried is rolled once, and goes into the looter's own pack (lootRules.js).
 if(action?.type==='loot')return takeSpoils(game,health,gearedHero(hero,game),random);
 // Orders to companions ("Mara, wait here", "Everyone follow me", sending word to one left behind) and taking up
 // someone's offer to come along (followerRules.js). Neither can be done mid-fight.
 if(action?.type==='follower'){
  const ids=Array.isArray(action.ids)?action.ids:[action.id];
  if(!['wait','resume','call','dismiss'].includes(action.order)||!ids.length||ids.some(id=>typeof id!=='string'))return {game,health,error:'That companion order is not available.'};
  const done=ids.length>1?orderFollowers(game,ids,action.order):manageFollower(game,ids[0],action.order);
  if(done.error)return {game,health,error:done.error};
  return {game:done.game,health,events:done.events};
 }
 if(action?.type==='accept-offer'){const done=acceptOffer(hero,game,action.id);return done.error?{game,health,error:done.error}:{game:done.game,health,events:done.events};}
 // The rules see the hero as they are now: found weapons in hand, arrows already spent gone.
 const result=livingStep(game,health,gearedHero(hero,game),action,random,opts);
 // Once no fight is on, weapons thrown in it are gathered up again, and nothing of the fight (a grip, a creature lying
 // prone, Vex) outlasts it.
 // A concentration spell's marks end with it (a failed concentration save, a fall, a new spell).
 // What it left on friends ends with it too; Hex or Hunter's Mark whose creature dropped waits to be moved.
 if(result.game&&!result.error){if(result.game.marks||result.game.boons)result.game=endSpellMarks(result.game);result.game=markGone(result.game);}
 if(result.game&&!result.error&&result.game.stage!=='combat'&&!result.game.npcCombat?.active&&!partyFightGoesOn(result.game,result.health,hero)){result.game=fightOver(result.game);const gathered=gatherThrown(result.game);if(gathered){result.game={...gathered.game,log:[gathered.line,...(gathered.game.log??[])].slice(0,40)};result.events=[...(result.events??[]),gathered.line];}}
 // A finished brawl's record (kept for the step that ended it: experienceRules.js) goes once the hero has left the
 // place or a fight of another kind has begun there.
 if(result.game&&!result.error&&result.game.npcCombat&&!result.game.npcCombat.active&&(mapLocation(result.game)!==mapLocation(game)||!['inn','bridge','tower','wild'].includes(result.game.stage)&&!(isPartyGame(result.game)&&['dying','dead'].includes(result.game.stage)))){result.game={...result.game};delete result.game.npcCombat;}
 // "Knock them out" is an intent for this one action; it never stays on the adventure.
 if(result.game&&result.game!==game&&(result.game.subdue!==undefined||result.game.aim!==undefined)){result.game={...result.game};delete result.game.subdue;delete result.game.aim;}
 return result;
}
// While dying the hero can do one thing: fight to hold on.
function dyingStep(game,health,hero,action,random){
 if(action!=='death-save')return {game,health,error:'You are unconscious and dying. Roll a death saving throw to hold on.'};
 const start=game.story?.locations?.inn?.name;
 // A companion at your side tries to stop the bleeding first; if they do, they carry you to safety.
 const aid=companionAid(game,random);
 let result;
 if(aid?.success){
  const helper=npcLore(game,aid.id)?.name??aid.id,rescued={...game,stage:game.story?'inn':'defeat'};delete rescued.dying;
  const told=recordDeed(rescued,aid.id,0,'I pulled the player back from the brink of death.').game;
  result={game:told,health:{current:1,temp:0},events:[aid.line,`You are stable. ${helper} carries you back to ${start??'the inn'}, and hours later you wake with 1 HP.`]};
 } else {
  // Magic worn helps: a Periapt of Wound Closure stops the bleeding, a cloak or stone adds to the save.
  const magic=gearedHero(hero,game).equipment?.magic;
  result=deathSave(game,health,random,{...(game.story?{wakeStage:'inn',wakeText:'at '+start+'. Someone found you and carried you back.'}:{wakeStage:'defeat',wakeText:'at the inn. The keeper found you and carried you back.'}),bonus:magic?.saves??0,stabilise:!!magic?.stabilise});
  if(result.error)return result;
  if(aid)result={...result,events:[aid.line,...result.events]};
 }
 if(result.game.world&&result.game.stage!=='wild'&&result.game.stage!=='dying'&&result.game.stage!=='dead')result={...result,game:{...result.game,world:{...result.game.world,at:null}}};
 const map=mapState(result.game),next={...result.game,map:{...map,visited:[...new Set([...map.visited,mapLocation(result.game)])]},log:[...result.events,...game.log].slice(0,40)};
 if(next.stage==='dead')next.journal=appendJournal(journalForGame(next),'encounter','Fallen',hero.name+' died. '+next.death.cause+(next.death.place?' at '+next.death.place:'')+'.');
 else if(next.stage!=='dying')next.journal=appendJournal(journalForGame(next),'encounter','Survived',hero.name+' clung to life after falling'+(game.dying.placeName?' at '+game.dying.placeName:'')+'.');
 return {...result,game:next};
}
// The chapter under way is finished: what it reveals is told, and the next begins. Finishing it is worth experience
// to every hero (experienceRules.js), worked out after the turn.
function advanceChapter(game,health,hero){
 const q=questState(game);
 if(!q?.current||q.last||game.story.status!=='active')return {game,health,error:'There is no further chapter to begin.'};
 const done=q.current,next=q.next,number=q.number;
 const lines=['Chapter '+number+' complete: '+done.title+'. '+done.turn,'Chapter '+(number+1)+' begins: '+next.title+'. '+next.goal];
 let journal=appendJournal(journalForGame(game),'quest',('Chapter '+number+' complete: '+done.title).slice(0,100),done.turn);
 journal=appendJournal(journal,'quest',('Chapter '+(number+1)+': '+next.title).slice(0,100),next.goal);
 return {game:{...game,story:{...game.story,chapter:game.story.chapter+1},journal,worldFacts:[...(game.worldFacts??[]),('Chapter '+number+' ('+done.title+') is finished: '+done.turn).slice(0,800)].slice(-60),log:[...lines,...game.log].slice(0,40)},health,events:lines};
}
// A lead (a side errand of the tale) has been seen through.
function finishLead(game,health,id){
 const lead=(game.story.leads??[]).find(l=>l.id===id);
 if(!lead||lead.done)return {game,health,error:'That lead is not open.'};
 const line='Lead seen through: '+lead.title+'.';
 return {game:{...game,story:{...game.story,leads:game.story.leads.map(l=>l.id===id?{...l,done:true}:l)},journal:appendJournal(journalForGame(game),'quest',('Lead seen through: '+lead.title).slice(0,100),lead.hook),log:[line,...game.log].slice(0,40)},health,events:[line]};
}
function livingStep(game,health,hero,action,random,opts={}){
 if(!game.story){const result=adventureStepEngine(game,health,hero,action,random,opts);return {...result,events:result.events??stepLogEntries(game.log,result.game?.log)};}
 // A long tale ends only in its last chapter; before that the chapter under way gives place to the next.
 if(action==='story-complete'){
  if(!questState(game).last)return {game,health,error:'The tale has chapters still to come.'};
  return {game:{...game,story:{...game.story,status:'complete'},log:['Adventure complete: '+game.story.title,...game.log].slice(0,40)},health,events:['Adventure complete: '+game.story.title]};
 }
 if(action==='story-advance')return advanceChapter(game,health,hero);
 if(action?.type==='lead-done')return finishLead(game,health,action.id);
 const allowed=['approach','dodge','flee','potion','long-rest','short-rest','end-turn','class:wind','class:hands','class:strike','class:surge','npc-dodge','npc-flee','npc-wait','npc-surrender'];
 const ownFeat=subclassAction(hero);if(ownFeat)allowed.push('class:'+ownFeat.id);
 if(typeof action==='string'&&!allowed.includes(action)&&!['grapple','shove'].includes(action)&&!/^(attack|throw|offhand|drink|item|again|move-mark):/.test(action))return {game,health,error:'That action belongs to a different adventure. Describe what you want to do in this story.'};
 const scene=(action?.type==='travel'||action?.type==='beyond')&&game.stage==='victory'?{...game,stage:'bridge'}:game;
 const result=adventureStepEngine(scene,health,hero,action,random,opts);
 if(result.error||result.game===scene)return {...result,game};
 // Stories continue after a lost fight: the player is back at the starting location and the foe keeps its HP.
 if(['escaped','defeat'].includes(result.game.stage)){const away=timePasses(result.game,result.health,travelRoute(game,mapLocation(game),'inn')?.minutes??0);result.game=away.game;result.health=away.health;const woke=result.game.stage==='defeat'?['You wake at '+game.story.locations.inn.name+', carried back from the fight. Rest to recover.']:[],map=mapState(result.game);result.events=[...(result.events??stepLogEntries(game.log,result.game.log)),...woke];result.game={...result.game,stage:'inn',map:{...map,visited:[...new Set([...map.visited,'inn'])]},log:[...woke,...result.game.log].slice(0,40)};}
 toldInStory(game,result);
 if(action==='long-rest')result.game.journal=game.journal;
 return result;
}
// Lines are retold in the story's own names; the foe's end follows how it fell (slain, or beaten but alive).
function toldInStory(game,result){
 const told={...game,foeFate:result.game.foeFate,world:result.game.world,wildFight:result.game.wildFight??game.wildFight};
 result.game={...result.game,story:game.story,storyHistory:game.storyHistory,log:result.game.log.map(t=>storyText(told,t)),journal:result.game.journal?{...result.game.journal,entries:result.game.journal.entries.map(e=>({...e,title:storyText(told,e.title),text:storyText(told,e.text)}))}:game.journal};
 result.events=(result.events??stepLogEntries(game.log,result.game.log)).map(t=>storyText(told,t));
 return result;
}
// A stronger healing draught from the pack (lootRules.js): Greater 4d4 + 4, Superior 8d4 + 8, Supreme 10d4 + 20.
function drinkDraught(game,hp,maximum,id,random){
 const draught=magicItems[id],it=(game.pack?.items??[]).find(i=>i.kind==='potion'&&i.magic?.id===id&&i.qty>0);
 if(!draught?.heal||!it)return {error:'You carry no such draught.'};
 if(hp.current>=maximum)return {error:'You are already at full health.'};
 const dice=Array.from({length:draught.heal.count},()=>1+Math.floor(random()*draught.heal.die)),amount=dice.reduce((a,b)=>a+b,0)+draught.heal.bonus,healed=updateHealth(hp,maximum,'heal',amount);
 const items=game.pack.items.map(i=>i===it?{...i,qty:i.qty-1}:i).filter(i=>i.qty>0);
 const label=draught.name.replace(/^Potion of /,'').replace(/ Healing$/,'');
 return {game:{...game,pack:{...game.pack,items}},health:{current:healed.current,temp:healed.temp},line:`${label} healing draught: ${draught.heal.count}d${draught.heal.die} [${dice.join(', ')}] + ${draught.heal.bonus}; restored ${healed.current-hp.current} HP.`};
}
