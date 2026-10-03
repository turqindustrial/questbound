import {storyText,questState} from './storyRules';
import {recordNpcAggression,npcServiceError,npcScene,npcProfile,npcMaxHP,npcLore,npcCombatParticipants} from "./npcRules";
import {automaticEffects,requestSpell,resolveSpellRuling,spellDefense,concentrationAfterDamage} from "./spellRules";
import {dungeonRooms,dungeonAction} from "./dungeonRules";
import {campaignState,campaignAction} from "./campaignRules";
import {beginJournal,recordJournalTransition,appendJournal} from "./journalRules";
import {mapState,mapLocation,travelError,travelTo,discoveryError,discoverPlace,worldPlace} from "./mapRules";
import {resolveClassAction,bonusOptions,shortRestLimit} from "./classActions";
import {combatBasics} from "./combatRules";
import {attackOptions,attacksPerAction,rollAttack,rollDamage,rangedMode,weaponRange,canThrow,thrownAttack} from "./weaponRules";
import {modifier} from "./characterRules";
import {updateHealth} from "./healthRules";
import {fallAtZero,deathSave,causeOfFall,fallPlace} from "./deathRules";
import {placeName} from "./mapRules";
import {journalForGame} from "./journalRules";
import {recordConsequences,recordDeed} from "./relationshipRules";
import {gearedHero,arrowsLeft,spendArrow,spendThrown,gatherThrown,potionHealing} from "./inventoryRules";
import {heroConditions,shieldBlow,undeadFortitude,companionsAttack,foeRoundMoves,foeAttackMode,pickFoeTarget,partyHeroName,foeHitsCompanion,foeHitExtras,startWildFight,endWildFight,validFoeSketch,allFoeTemplates,companionAid,naturalAllies,allyStats,livingAllies,aimedAlly,hurtAlly,alliesScatter,partyTargets,foeHitsPartyHero} from "./encounterRules";
import {isPartyGame,settleParty,partyView} from "./partyRules";
import {masteryOf,isLight,offhandWeapons,creatureSize,withinGrip,unarmedDC,unarmedSave,heroIdOf,markOf,withMark,grappledBy,letGo,holding,heroEdge,edgeMode,foeEdge,creatureTurnStarts,sapSpent,sapsEnd,endHeroTurn,fightOver} from "./masteryRules";
import {proficiencyBonus} from "./characterRules";
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
  export function encounterFoe(hero, game) {
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
    // A level earned on the road and not yet taken stays earned; deeds are the hero's for good.
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
    if (game.wildFight && result.game.wildFight && result.game.stage !== 'combat') {
      const w = game.wildFight, outcome = result.game.stage === 'victory' ? 'won' : result.game.stage === 'escaped' ? 'fled' : 'fell';
      const fate = result.game.foeFate === 'subdued' ? 'subdued' : 'slain', group = w.stats.group;
      const kept = result.events.filter(t => !/wisp settles|restored the crossing|You retreat to the inn/.test(t));
      const ending = outcome === 'won' ? [fate === 'subdued' ? (group ? 'The last of the ' + group.plural + ' drops senseless.' : 'The ' + w.name + ' collapses, beaten but alive.') : (group ? 'The last of the ' + group.plural + ' falls dead.' : 'The ' + w.name + ' is slain.')] : outcome === 'fled' ? ['You flee from the ' + w.name + ' back toward ' + placeName(game, w.from) + '.'] : [];
      const scattered = outcome === 'won' ? alliesScatter(result.game).lines : [];
      const ended = endWildFight(result.game, outcome);
      result.events = [...kept, ...ending, ...scattered];
      result.game = {...ended, log: [...result.events, ...game.log].slice(0, 40)};
    }
    // Tricks and conditions belong to one fight.
    if (result.game.stage !== 'combat' && (result.game.heroCondition || result.game.foeTricks)) {
      result.game = {...result.game};
      delete result.game.heroCondition;
      delete result.game.foeTricks;
    }
    // Arriving somewhere new can be dangerous: a lair's creature (or one you fled from) is waiting, and a risky
    // place may hide an ambush the first time you set foot there.
    if ((action?.type === 'travel' || action?.type === 'discover') && result.game.stage === 'wild' && !result.game.wildFight) {
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
      let remaining = victim.hp, thrownNow = 0;
      for (let swing = 0; swing < attacksPerAction(hero) && remaining > 0; swing++) {
        // The grapple or shove itself: no attack roll; they resist with Strength or Dexterity.
        if (contest && swing === 0) {
          const dc = unarmedDC(hero), save = unarmedSave({}, random), held = save.total < dc;
          entries.push(`${contest === 'grapple' ? 'Grapple' : 'Shove'}: ${victim.name} resists with a ${save.ability} save d20 [${save.die}] + ${save.bonus} = ${save.total} vs DC ${dc}: ${held ? 'failure' : 'success'}. ${held ? (contest === 'grapple' ? 'You have them in your grip: they cannot move, and their blows at anyone but you have disadvantage.' : 'They go down prone.') : (contest === 'grapple' ? 'They wrench free.' : 'They keep their feet.')}`);
          if (held) next = contest === 'grapple' ? withMark(next, victim.id, {grappled: heroIdOf(next)}) : withMark(next, victim.id, {prone: true});
          continue;
        }
        const w = contest ? followUp : weapon;
        if (w.ranged) {
          if (arrowsLeft(next, hero) <= 0) { entries.push('You are out of arrows.'); break; }
          next = spendArrow(next, hero);
        } else if (w.thrown) {
          if (thrownNow >= inHand(hero, w.name)) { entries.push(`You have no ${w.name.toLowerCase()} left to throw.`); break; }
          thrownNow++; next = spendThrown(next, hero, w.name);
        }
        const edge = heroEdge(next, victim.id, w), attack = rollAttack(w, edgeMode(rangedMode(w, {closeEnemy: distance <= 5, distance}), edge), random),
          hit = !attack.miss && (attack.critical || attack.total >= victim.ac);
        if (edge.adv.includes('Vex')) { next = {...next}; delete next.vex; }
        const damageRoll = hit ? rollDamage(w, attack.critical, random) : null;
        const damage = damageRoll?.total??0;
        remaining = Math.max(0, remaining - damage);
        entries.push(`${w.thrown ? 'You throw ' + w.name + ' at' : 'You use ' + w.name + ' against'} ${victim.name}: d20 [${attack.dice.join(', ')}] (${attack.mode}${[...edge.adv, ...edge.dis].length ? ', ' + [...edge.adv, ...edge.dis].join(', ') : ''}) + ${w.bonus} ${w.ability} + ${w.attackBonus-w.bonus} proficiency = ${attack.total} vs AC ${victim.ac}. ${attack.critical?'Critical hit':hit ? 'Hit' : 'Miss'}; ${damage} ${w.type} damage${damageRoll?' ('+(w.flat?'1 + '+w.bonus:damageRoll.dice.length+'d'+w.die+' ['+damageRoll.dice.join(', ')+'] + '+w.bonus)+')':''}. ${remaining} HP remaining.`);
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
      const exploring={...game};delete exploring.npcCombat;return discoverPlace(exploring, hp, action);
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
    const aim = game.stage === 'combat' ? aimedAlly(game, action?.request?.aim ?? (action?.type === 'spell-ruling' ? game.pendingSpell?.aim : null) ?? game.aim) : null;
    const aimedFoe = aim !== null ? allyStats(game, aim, hero.level ?? 1) : null;
    let spellResult = null;
    if (action?.type === 'spell' || action?.type === 'spell-ruling') {
      spellResult = action.type === 'spell' ? requestSpell(hero, game, hp, stats.hp, action.request, random, aimedFoe ?? foe) : resolveSpellRuling(hero, game, hp, stats.hp, action.ruling, random);
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
        const most = npcMaxHP(n.id, game), was = game.npcHP?.[n.id] ?? most, better = Math.min(most, was + Math.floor(most / 2));
        if (was <= 0 || better <= was) continue;
        next.npcHP = {...next.npcHP, [n.id]: better};
        lines.push(`${npcLore(game, n.id)?.name ?? n.name} rests too: restored ${better - was} HP.`);
      }
      if (hero.class === 'Fighter' && (game.resources?.wind ?? 0) > 0) {
        next.resources = {...game.resources, wind: 0};
        lines.push('Second Wind is ready again.');
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
      return {game: next, events: entries, health: {current: now, temp: hp.temp}};
    }
    // A long rest restores hit points, spell slots, class features and the short rests. Everything else about the
    // adventure stays exactly as it was: the places found, the people met, the pack, the story so far.
    if (action === 'long-rest' && game.stage === 'inn') {
      const rested = {...game, round: 1, potions: Math.max(1, game.potions ?? 1), map: mapState(game), campaign: campaignState(game)};
      for (const key of ['resources', 'spellSlotsUsed', 'arcanumUsed', 'shortRests', 'concentration', 'temporarySpell', 'enemyEffects', 'bonusUsed', 'slotSpentThisTurn', 'reactionUsed', 'actionUsed', 'dodging', 'castingConditions', 'heroCondition', 'foeTricks', 'pendingSpell']) delete rested[key];
      const lines = ['You finish a long rest. HP and casting resources are restored.'];
      // Companions who are with you (and still on their feet) sleep it off too.
      for (const n of npcScene(game)) {
        if (game.followers?.[n.id]?.status !== 'following' || n.fate === 'dead') continue;
        const most = npcMaxHP(n.id, game), was = game.npcHP?.[n.id] ?? most;
        if (was > 0 && was < most) { rested.npcHP = {...rested.npcHP, [n.id]: most}; lines.push(`${npcLore(game, n.id)?.name ?? n.name} is rested and whole again.`); }
      }
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
        bonusAction = spellResult.bonus || spellResult.reaction || !!spellResult.manualRounds;
        if (spellResult.reaction) next.reactionUsed = true;
        if (spellResult.manualRounds) {
          next.round += spellResult.manualRounds;
          next.bonusUsed = false;
          next.slotSpentThisTurn = false;
          next.reactionUsed = false;
          entries.push(`The DM resolved ${spellResult.manualRounds} rounds of casting and intervening events.`);
        }
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
      } else if (typeof action === 'string' && action.startsWith('class:')) {
        const result = resolveClassAction(hero, game, hp, stats.hp, action.slice(6), random, foe);
        if (!result) return {
          game,
          health,
          error: game.bonusUsed ? 'Your bonus action is already used this turn.' : action === 'class:wind' && hp.current >= stats.hp ? 'You are already at full health.' : 'That is not available right now.'
        };
        next = result.game ?? next;
        next.resources = result.resources;
        hp = result.health;
        next.enemyHP = Math.max(0, next.enemyHP - result.damage);
        entries.push(...result.logs);
        bonusAction = result.bonus;
        dodge = !!result.enemyDisadvantage;
        if (bonusAction) { next.bonusUsed = true; usedBonus = true; }
      } else if (action?.type === 'give-potion') {
        // Saving a fallen companion costs your turn.
        const error = givePotion();
        if (error) return {game, health, error};
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
        const key = aim !== null ? 'ally:' + aim : 'foe', targetOf = k => k === 'foe' ? foe : allyStats(next, Number(k.slice(5)), hero.level ?? 1);
        const called = k => 'the ' + targetOf(k).name.replace(/^the /i, ''), Called = k => 'T' + called(k).slice(1);
        const standing = k => k === 'foe' ? next.enemyHP > 0 : (next.foeAllies?.[Number(k.slice(5))]?.hp ?? 0) > 0;
        if (contest && !withinGrip(hero, creatureSize(next, key))) return {game, health, error: `${Called(key)} is too big for you to ${contest}.`};
        if (contest === 'grapple' && grappledBy(next, key, hp)) return {game, health, error: `${Called(key)} is already held.`};
        // A two-handed weapon, or a weapon in each hand, needs the hand that holds a grapple: it lets go first (free).
        if (!contest && (weapon.twoHands || offhand) && holding(next)) { const freed = letGo(next, called); next = freed.game; entries.push(...freed.lines); }
        // Damage to the foe (its shield may catch a blow) or to the creature at its side; returns what got through.
        const harm = (k, amount, shield) => {
          if (k === 'foe') { const blocked = shield ? shieldBlow(next, amount, random) : {game: next, damage: amount, line: null}; next = blocked.game; next.enemyHP = Math.max(0, next.enemyHP - blocked.damage); return {dealt: blocked.damage, line: blocked.line}; }
          const struck = hurtAlly(next, Number(k.slice(5)), amount); next = struck.game; return {dealt: amount, hp: struck.hp, line: struck.line};
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
          const w = contest ? followUp : weapon;
          // Each bow shot uses an arrow, and each throw one of the weapons thrown; with none left, there is no shot.
          if (w.ranged) {
            if (arrowsLeft(next, hero) <= 0) { entries.push('You are out of arrows.'); break; }
            next = spendArrow(next, hero);
          } else if (w.thrown) {
            if (thrownNow >= inHand(hero, w.name)) { entries.push(`You have no ${w.name.toLowerCase()} left to throw.`); break; }
            thrownNow++; next = spendThrown(next, hero, w.name);
          }
          const target = targetOf(key), edge = heroEdge(next, key, w), attack = rollAttack(w, edgeMode(baseMode(w), edge), random), hit = !attack.miss && (attack.critical || attack.total >= target.ac);
          if (edge.adv.includes('Vex')) { next = {...next}; delete next.vex; }
          const used = offhand ? ' (other hand)' : '';
          if (key === 'foe') entries.push(`${w.thrown ? 'You throw' : 'You use'} ${w.name}${used}: d20 [${attack.dice.join(', ')}] (${attack.mode}${[...edge.adv, ...edge.dis].length ? ', ' + [...edge.adv, ...edge.dis].join(', ') : ''}) + ${w.bonus} ${w.ability} + ${w.attackBonus-w.bonus} proficiency = ${attack.total} vs AC ${target.ac}. ${attack.critical ? 'Critical hit!' : hit ? 'Hit.' : 'Miss.'}`);
          else entries.push(`${w.thrown ? 'You throw ' + w.name + used + ' at' : 'You use ' + w.name + used + ' on'} the ${target.name}: d20 [${attack.dice.join(', ')}] (${attack.mode}${[...edge.adv, ...edge.dis].length ? ', ' + [...edge.adv, ...edge.dis].join(', ') : ''}) + ${w.bonus} ${w.ability} + ${w.attackBonus-w.bonus} proficiency = ${attack.total} vs AC ${target.ac}. ${attack.critical ? 'Critical hit!' : hit ? 'Hit.' : 'Miss.'}`);
          if (isLight(w) && !offhand) lightUsed = w.name;
          const mastery = masteryOf(hero, w);
          if (hit) {
            // The other hand's blow adds no ability bonus to its damage (unless that bonus is negative).
            const dw = offhand && w.bonus > 0 ? {...w, bonus: 0} : w, damage = rollDamage(dw, attack.critical, random), done = harm(key, damage.total, true);
            if (key === 'foe') entries.push(`${damage.total} ${dw.type.toLowerCase()} damage (${dw.flat ? '1' : damage.dice.join(' + ')} ${dw.bonus >= 0 ? '+' : ''}${dw.bonus}).`);
            else entries.push(`The ${target.name} takes ${damage.total} ${dw.type.toLowerCase()} damage (${dw.flat ? '1' : damage.dice.join(' + ')} ${dw.bonus >= 0 ? '+' : ''}${dw.bonus}); ${done.hp} HP left.`);
            if (done.line) entries.push(done.line);
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
                if (hit2) { const cut = rollDamage({...w, bonus: Math.min(0, w.bonus)}, swing2.critical, random), landed = harm(other, cut.total, false); entries.push(`${cut.total} ${w.type.toLowerCase()} damage (${cut.dice.join(' + ')}${w.bonus < 0 ? ' − ' + Math.abs(w.bonus) : ''}).`); if (landed.line) entries.push(landed.line); }
              }
            }
          } else if (mastery === 'Graze' && w.bonus > 0 && standing(key)) {
            // Graze: even a miss deals the ability bonus.
            const done = harm(key, w.bonus, false);
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
        const fortitude = undeadFortitude(next, foe, random);
        next = fortitude.game;
        if (fortitude.line) entries.push(fortitude.line);
        if (next.enemyHP === 0) {
          next.foeFate = game.subdue && !weapon.ranged ? 'subdued' : 'slain';
          next.stage = 'victory';
          entries.push('The wisp settles into the lantern. Warm light spills over the bridge. You have restored the crossing!');
        }
      }
      if (next.stage === 'combat' && next.enemyHP === 0 && !turnOptions.enemyOnly) {
        const fortitude = undeadFortitude(next, foe, random);
        next = fortitude.game;
        if (fortitude.line) entries.push(fortitude.line);
      }
      if (next.stage === 'combat' && next.enemyHP === 0) {
        next.foeFate = 'slain';
        next.stage = 'victory';
        entries.push('The wisp settles into the lantern. You have restored the crossing!');
      }
      // One action a turn: once it is spent, only a bonus action or ending the turn remains.
      if (game.actionUsed && !usedBonus && !ending && !turnOptions.enemyOnly) return {
        game,
        health,
        error: 'You have already used your action this turn. Use a bonus action or end your turn.'
      };
      // After the action, a hero who still has a bonus action worth using gets the chance: the turn waits for it, or
      // for End turn. A bonus action taken after the action ends the turn by itself.
      const acted = !bonusAction && !ending && !turnOptions.enemyOnly;
      const paused = acted && next.stage === 'combat' && !turnOptions.suppressEnemy && hp.current > 0 && !spellResult?.manualRounds && bonusOptions(hero, next, hp, stats.hp).length > 0;
      if (paused) {
        next.actionUsed = true;
        // A Dodge (or a foe thrown off by a spell) still counts when the turn ends.
        if (dodge) next.dodging = true;
        entries.push('You still have a bonus action: use it, or end your turn.');
      }
      if (usedBonus && game.actionUsed) bonusAction = false;
      // The other hand's blow under Nick was part of the action: a bonus action may still follow it.
      if (nickNow && next.stage === 'combat' && hp.current > 0 && bonusOptions(hero, next, hp, stats.hp).length > 0) {
        bonusAction = true;
        next.actionUsed = true;
        entries.push('You still have a bonus action: use it, or end your turn.');
      }
      if (paused) bonusAction = true;
      if (game.dodging && !paused) dodge = true;
      // Companions travelling with you strike the creature once, after your turn (in a party's fight, once a round,
      // just before the foe acts).
      if (next.stage === 'combat' && !bonusAction && !turnOptions.suppressEnemy && (turnOptions.partyFoe || !turnOptions.enemyOnly && !turnOptions.foeWaits)) {
        const helped = companionsAttack(next, foe, random);
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
        delete next.dodging;
        tickHeroSpells(next, hp);
        endHeroTurn(next);
      } else if (next.stage === 'combat' && !bonusAction && !turnOptions.suppressEnemy) {
        const defense = spellDefense(next, stats.ac, foe);
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
        for (let member = 1; member <= attackers && fightOn(); member++) {
        const who = attackers > 1 ? `${foe.name} ${member}` : foe.name;
        // Sometimes the creature goes for a companion beside you instead (or, in a party, another hero).
        const target = foeTarget(), why = member === 1 ? heldOff('foe', target) : [];
        const mode = foeAttackMode({...next, heroCondition: target !== null && turnOptions.partyFoe ? undefined : lingering ?? next.heroCondition}, foe, attackers, {dodge: dodgingNow(target), blur: blurNow(target) || why.length > 0});
        if (target) {
          const struck = foeHitsCompanion(next, foe, who, target, mode, random);
          next = struck.game;
          entries.push(...struck.lines);
          if (member === 1) next = sapSpent(next, 'foe');
          continue;
        }
        const attack = rollAttack(foe, mode, random);
        if (member === 1) next = sapSpent(next, 'foe');
        const hit = !attack.miss && (attack.critical || attack.total >= defense.ac);
        entries.push(`${who}: d20 [${attack.dice.join(', ')}] (${attack.mode}${why.length ? ', ' + why.join(', ') : ''}) +${foe.attackBonus} = ${attack.total} vs your AC ${defense.ac}. ${attack.critical ? 'Critical hit!' : hit ? 'Hit.' : 'Miss.'}`);
        if (hit) {
          const damage = rollDamage(foe, attack.critical, random);
          const extras = foeHitExtras(next, hero, foe, attackers, random);
          next = extras.game;
          const total = Math.max(1, damage.total + extras.extra);
          const hurt = updateHealth(hp, stats.hp, 'damage', total);
          if (hurt.current === 0) {
            downedBy = who;
            overflow = overflowOf(hurt.previous, total);
          }
          hp = {
            current: hurt.current,
            temp: hurt.temp
          };
          entries.push(`${damage.dice.length}d${foe.die} [${damage.dice.join(', ')}] + ${foe.bonus}${extras.note} = ${total} ${foe.type} damage. ${hurt.message}`);
          entries.push(...extras.lines);
          const concentration = concentrationAfterDamage(hero, next, total, random);
          next = concentration.game;
          entries.push(...concentration.logs);
        }
        }
        // The creature at its side attacks too.
        let allyDowned = null;
        for (const ally of livingAllies(next)) {
          if (!fightOn()) break;
          const target = foeTarget(), a = allyStats(next, ally.index, hero.level ?? 1), why = heldOff('ally:' + ally.index, target), mode = dodgingNow(target) || blurNow(target) || why.length > 0 ? 'disadvantage' : 'normal';
          if (target) { const struck = foeHitsCompanion(next, a, a.name, target, mode, random); next = sapSpent(struck.game, 'ally:' + ally.index); entries.push(...struck.lines); continue; }
          const attack = rollAttack(a, mode, random), hit = !attack.miss && (attack.critical || attack.total >= defense.ac);
          next = sapSpent(next, 'ally:' + ally.index);
          entries.push(`${a.name}: d20 [${attack.dice.join(', ')}] (${attack.mode}${why.length ? ', ' + why.join(', ') : ''}) +${a.attackBonus} = ${attack.total} vs your AC ${defense.ac}. ${attack.critical ? 'Critical hit!' : hit ? 'Hit.' : 'Miss.'}`);
          if (!hit) continue;
          const damage = rollDamage(a, attack.critical, random), total = Math.max(1, damage.total), hurt = updateHealth(hp, stats.hp, 'damage', total);
          if (hurt.current === 0) { allyDowned = a.name; overflow = overflowOf(hurt.previous, total); }
          hp = {current: hurt.current, temp: hurt.temp};
          entries.push(`${damage.dice.length}d${a.die} [${damage.dice.join(', ')}] + ${a.bonus} = ${total} ${a.type} damage. ${hurt.message}`);
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
        delete next.dodging;
        // In a party each hero's spells count down at the end of their own turn instead.
        if (!turnOptions.partyFoe) tickHeroSpells(next, hp);
        // A Sap lasts only until the next turn of the hero who landed it; their own turn is over.
        next = sapsEnd(next);
        if (!turnOptions.enemyOnly) endHeroTurn(next);
        if (next.enemyEffects) next.enemyEffects = Object.fromEntries(Object.entries(next.enemyEffects).filter(([, rounds]) => rounds > 1).map(([key, rounds]) => [key, rounds - 1]));
        if (hp.current === 0) delete next.concentration;
      }
      if (next.stage !== 'combat') { delete next.actionUsed; delete next.dodging; }
    } else return {
      game,
      health
    };
    if (next.stage === 'victory' && game.stage !== 'victory' && hero.level >= 3 && hero.class === 'Warlock' && hero.plannedSubclass === 'Fiend Patron') {
      hp.temp = Math.max(hp.temp, Math.max(1, hero.level + modifier(hero.scores.Charisma)));
      entries.push('Dark One’s Blessing grants temporary HP.');
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
  if (next.concentration?.remaining !== null && next.concentration?.remaining !== undefined) {
    next.concentration = {...next.concentration, remaining: next.concentration.remaining - 1};
    if (next.concentration.remaining <= 0) delete next.concentration;
  }
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
 const spell=command?.type==='spell'?automaticEffects[command.request.id]:command?.type==='spell-ruling'?automaticEffects[scene.pendingSpell?.id]:null;
 const hostile=typeof command==='string'&&(command.startsWith('attack:')||command.startsWith('throw:')||['grapple','shove'].includes(command))||spell&&(spell.attack||spell.save||spell.missile)||command?.type==='spell-ruling'&&(command.ruling?.damage??0)>0;
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
 const target=action?.type==='npc-attack'?action.target:pending?.npcTarget&&((effect&&(effect.attack||effect.save||effect.missile))||(action.ruling?.damage??0)>0)?pending.npcTarget:null;
 const active=game.npcCombat?.active;
 if(!active&&!target)return creatureCombatStep(game,health,hero,action,random,opts);
 if(!stats.available||stats.ac===null)return {game,health,error:'Complete your combat statistics first.'};
 if((health?.current??stats.hp)<=0)return {game,health,error:'You are down and cannot act.'};
 if(active&&(typeof action==='string'&&!['npc-dodge','npc-flee','npc-wait','npc-surrender'].includes(action)||action?.type==='travel'))return {game,health,error:'Combat is underway. Attack, cast, dodge, surrender, or flee through Send to DM.'};
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
   next={...next,npcCombat:{active:true,round:1,order,help:null},log:['Combat begins.',...next.log].slice(0,40)};
   return {game:{...next,journal:appendJournal(next.journal,'encounter','Combat begins',events.join('\n').slice(0,3000))},health:hp,events};
  }
  const roll=1+Math.floor(random()*20),second=stats.initiativeAdvantage?1+Math.floor(random()*20):roll;
  const order=[{id:'player',side:'player',role:'attack',initiative:Math.max(roll,second)+stats.initiative},...standing.map(n=>({...n,initiative:1+Math.floor(random()*20)}))].sort((a,b)=>b.initiative-a.initiative||(a.id==='player'?-1:b.id==='player'?1:a.id.localeCompare(b.id)));
  events.push('Your initiative: d20 ['+[roll,...(stats.initiativeAdvantage?[second]:[])].join(', ')+'] + '+stats.initiative+' = '+(Math.max(roll,second)+stats.initiative)+'.');
  events.push(...order.filter(n=>n.id!=='player').map(n=>npcProfile(next,n.id).name+' initiative: d20 '+n.initiative+' + 0 = '+n.initiative+'.'));
  events.push('Turn order: '+order.map(n=>n.id==='player'?'You':npcProfile(next,n.id).name).join(' → ')+'.');
  events.push('Round 1 begins.');
  next={...next,npcCombat:{active:true,round:1,order,help:null},log:['Combat begins. Initiative: '+order.map(n=>(n.id==='player'?'You':npcProfile(next,n.id).name)+' '+n.initiative).join(' / ')+'.',...next.log].slice(0,40)};
  const first=runNpcTurns(next,hp,hero,order.slice(0,order.findIndex(n=>n.id==='player')),false,random);next=first.game;hp=first.health;events.push(...first.events);
  if(next.npcCombat?.active)events.push('Your turn.');
  next={...next,journal:appendJournal(next.journal,'encounter','Combat begins',events.join('\n').slice(0,3000)),bonusUsed:false,reactionUsed:false,slotSpentThisTurn:false};
  return {game:next,health:hp,events};
 }
 if(target&&next.npcCombat)next={...next,npcCombat:{...next.npcCombat,order:next.npcCombat.order.map(n=>n.id===target?{...n,side:'enemy',role:'attack'}:n)}};
 let result=special?{game:{...next,log:[action==='npc-dodge'?'You take the Dodge action.':'You hold your ground.',...next.log].slice(0,40)},health:hp}:adventureStepCore(next,hp,hero,action,random);
 if(result.error)return {game:next,health:hp,events,error:active?result.error:undefined};
 if(result.waiting)return result;
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
 if(result.game.concentration?.remaining!=null){result.game.concentration={...result.game.concentration,remaining:result.game.concentration.remaining-1};if(result.game.concentration.remaining<=0)delete result.game.concentration;}
 result.game={...result.game,journal:appendJournal(result.game.journal,'encounter',game.stage==='inn'?'Inn combat':'Combat',events.join('\n').slice(0,3000))};
 return result;
}
// `party`: a party's brawl, where each person fighting picks any standing hero, and a hero who took the Dodge on their
// own turn (`dodging`) is harder to hit.
function runNpcTurns(game,health,hero,turns,dodge,random,party=null){
 let next={...game,npcCombat:{...game.npcCombat}},hp={...health},downed=null;const stats=combatBasics(hero),logs=[];
 const who=id=>npcProfile(next,id),alive=id=>(next.npcHP?.[id]??who(id).maximumHP)>0;
 const enemies=()=>next.npcCombat.order.filter(n=>n.side==='enemy'&&alive(n.id));
 const dodgeLead=party?(party.dodging??[]).includes(next.party?.lead):dodge;
 for(const actor of turns){
  if(!(hp.current>0||party&&partyTargets(next).length)||!enemies().length)break;
  if(!alive(actor.id))continue;
  const allied=actor.side==='ally',victim=allied?enemies()[0]:null;
  if(actor.role==='help'&&next.npcCombat.order.some(n=>n.side===actor.side&&n.id!==actor.id&&alive(n.id))){next.npcCombat.help=actor.side;logs.push(who(actor.id).name+' distracts the opposition to help a defender.');continue;}
  const weapon={attackBonus:2,count:1,die:4,bonus:0};
  const helped=next.npcCombat.help===actor.side;
  // Lying prone, they get up first (unless held down); prone, a Sap, or a grapple spoils their blow (masteryRules.js).
  if(next.marks&&!allied){const begun=creatureTurnStarts(next,actor.id,who(actor.id).name,hp);next=begun.game;logs.push(...begun.lines);}
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
  const hit=!attack.miss&&(attack.critical||attack.total>=defense.ac),damageRoll=hit?rollDamage(weapon,attack.critical,random):null,damage=damageRoll?.total??0;
  logs.push(`${who(actor.id).name} attacks ${allied?who(victim.id).name:'you'}: d20 [${attack.dice.join(', ')}] (${attack.mode}${helped?', Help':''}${!allied&&dodgeLead?', Dodge':''}${defense.disadvantage?', Blur':''}${why.length?', '+why.join(', '):''}) + 2 =${attack.total} vs AC ${defense.ac}. ${attack.critical?'Critical hit':hit?'Hit':'Miss'}; ${damage} Bludgeoning damage${damageRoll?' ('+damageRoll.dice.length+'d4 ['+damageRoll.dice.join(', ')+'] + 0)':''}.`);
  if(damage&&allied)next.npcHP={...next.npcHP,[victim.id]:Math.max(0,(next.npcHP?.[victim.id]??who(victim.id).maximumHP)-damage)};
  else if(damage){const hurt=updateHealth(hp,stats.hp,'damage',damage);if(hurt.current===0)downed={by:who(actor.id).name,overflow:overflowOf(hurt.previous,damage)};hp={current:hurt.current,temp:hurt.temp};const concentration=concentrationAfterDamage(hero,next,damage,random);next=concentration.game;logs.push(...concentration.logs);}
 }
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
 // A party at the shared table takes its fights in turns.
 if(isPartyGame(game))return partyStep(game,health,hero,action,random);
 return heroStep(game,health,hero,action,random);
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
const fightFoeName=(hero,game)=>game.wildFight?.name??game.story?.foe??encounterFoe(hero,game).name;
function withoutOrder(game){if(!game.turnOrder)return game;const next={...game};delete next.turnOrder;return next;}
// "Wolf: d20 … vs your AC 14. Hit." told of another hero, when the foe's turn is played from their point of view.
function toldOf(line,name){
 return line.replace(/^(.+?): d20 (.*?) vs your AC (\d+)\./,`$1 attacks ${name}: d20 $2 vs ${name}’s AC $3.`).replace(/^(.+?) attacks you:/,`$1 attacks ${name}:`)
  .replace(/^(.+? = \d+ \w+ damage)\. \d+ damage recorded: .*$/,`$1 to ${name}.`)
  .replace(/^The blow is so savage that it kills you outright\. You die\.$/,`The blow kills ${name} outright.`).replace(/^You fall unconscious and are dying\..*$/,`${name} falls unconscious and is dying.`)
  .replace(/\bat you\b/g,'at '+name).replace(/\byour eyes\b/g,name+'’s eyes').replace(/\bYour next attack\b/g,name+'’s next attack').replace(/\bYou are knocked prone\b/g,name+' is knocked prone').replace(/\bYou keep your feet\b/g,name+' keeps their feet').replace(/\bYou are restrained\b/g,name+' is restrained').replace(/\bYou tear free\b/g,name+' tears free');
}
function partyStep(game,health,hero,action,random){
 const me=game.party.lead;
 if(game.turnOrder&&!partyFightOn(game))game=withoutOrder(game);
 const order=game.turnOrder;
 // No fight under way, or its first move still to be made: anyone may act.
 if(!order){
  if(action?.type==='party-pass')return {game,health,error:'There is no turn to pass.'};
  const result=heroStep(game,health,hero,action,random,{party:true});
  if(result.error||result.waiting||result.game===game)return result;
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
  result={...result,game:{...result.game,world:game.world,map:game.map,...(game.wildFight?{wildFight:game.wildFight}:{})}};
  if(!['dying','dead'].includes(result.game.stage)){const party={...result.game.party};const stage=party.stage??result.game.stage;delete party.stage;result.game={...result.game,stage,party};}
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
 let next={...game,bonusUsed:false,reactionUsed:false,slotSpentThisTurn:false};delete next.actionUsed;delete next.dodging;
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
 // The rules see the hero as they are now: found weapons in hand, arrows already spent gone.
 const result=livingStep(game,health,gearedHero(hero,game),action,random,opts);
 // Once no fight is on, weapons thrown in it are gathered up again, and nothing of the fight (a grip, a creature lying
 // prone, Vex) outlasts it.
 if(result.game&&!result.error&&result.game.stage!=='combat'&&!result.game.npcCombat?.active){result.game=fightOver(result.game);const gathered=gatherThrown(result.game);if(gathered){result.game={...gathered.game,log:[gathered.line,...(gathered.game.log??[])].slice(0,40)};result.events=[...(result.events??[]),gathered.line];}}
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
  result=deathSave(game,health,random,game.story?{wakeStage:'inn',wakeText:'at '+start+'. Someone found you and carried you back.'}:{wakeStage:'defeat',wakeText:'at the inn. The keeper found you and carried you back.'});
  if(result.error)return result;
  if(aid)result={...result,events:[aid.line,...result.events]};
 }
 if(result.game.world&&result.game.stage!=='wild'&&result.game.stage!=='dying'&&result.game.stage!=='dead')result={...result,game:{...result.game,world:{...result.game.world,at:null}}};
 const map=mapState(result.game),next={...result.game,map:{...map,visited:[...new Set([...map.visited,mapLocation(result.game)])]},log:[...result.events,...game.log].slice(0,40)};
 if(next.stage==='dead')next.journal=appendJournal(journalForGame(next),'encounter','Fallen',hero.name+' died. '+next.death.cause+(next.death.place?' at '+next.death.place:'')+'.');
 else if(next.stage!=='dying')next.journal=appendJournal(journalForGame(next),'encounter','Survived',hero.name+' clung to life after falling'+(game.dying.placeName?' at '+game.dying.placeName:'')+'.');
 return {...result,game:next};
}
// The chapter under way is finished: what it reveals is told, and the next begins. Every second chapter finished
// earns the hero a level, taken when they choose (levelUpReady).
function advanceChapter(game,health,hero){
 const q=questState(game);
 if(!q?.current||q.last||game.story.status!=='active')return {game,health,error:'There is no further chapter to begin.'};
 const done=q.current,next=q.next,number=q.number,earns=number%2===0&&(hero?.level??1)+(game.levelsOwed??0)<20;
 const lines=['Chapter '+number+' complete: '+done.title+'. '+done.turn,'Chapter '+(number+1)+' begins: '+next.title+'. '+next.goal,...(earns?['You have earned a level. Take it when you are ready.']:[])];
 let journal=appendJournal(journalForGame(game),'quest',('Chapter '+number+' complete: '+done.title).slice(0,100),done.turn);
 journal=appendJournal(journal,'quest',('Chapter '+(number+1)+': '+next.title).slice(0,100),next.goal);
 return {game:{...game,story:{...game.story,chapter:game.story.chapter+1},...(earns?{levelsOwed:(game.levelsOwed??0)+1}:{}),journal,worldFacts:[...(game.worldFacts??[]),('Chapter '+number+' ('+done.title+') is finished: '+done.turn).slice(0,800)].slice(-60),log:[...lines,...game.log].slice(0,40)},health,events:lines};
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
 const allowed=['approach','dodge','flee','potion','long-rest','short-rest','end-turn','class:wind','class:hands','class:strike','npc-dodge','npc-flee','npc-wait','npc-surrender'];
 if(typeof action==='string'&&!allowed.includes(action)&&!['grapple','shove'].includes(action)&&!/^(attack|throw|offhand):/.test(action))return {game,health,error:'That action belongs to a different adventure. Describe what you want to do in this story.'};
 const scene=action?.type==='travel'&&game.stage==='victory'?{...game,stage:'bridge'}:game;
 const result=adventureStepEngine(scene,health,hero,action,random,opts);
 if(result.error||result.game===scene)return {...result,game};
 // Stories continue after a lost fight: the player is back at the starting location and the foe keeps its HP.
 if(['escaped','defeat'].includes(result.game.stage)){const woke=result.game.stage==='defeat'?['You wake at '+game.story.locations.inn.name+', carried back from the fight. Rest to recover.']:[],map=mapState(result.game);result.events=[...(result.events??stepLogEntries(game.log,result.game.log)),...woke];result.game={...result.game,stage:'inn',map:{...map,visited:[...new Set([...map.visited,'inn'])]},log:[...woke,...result.game.log].slice(0,40)};}
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
