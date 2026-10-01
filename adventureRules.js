import {storyText} from './storyRules';
import {recordNpcAggression,npcServiceError,npcScene,npcProfiles,npcCombatParticipants} from "./npcRules";
import {automaticEffects,requestSpell,resolveSpellRuling,spellDefense,concentrationAfterDamage} from "./spellRules";
import {dungeonRooms,dungeonAction} from "./dungeonRules";
import {campaignState,campaignAction} from "./campaignRules";
import {beginJournal,recordJournalTransition,appendJournal} from "./journalRules";
import {mapState,mapLocation,travelError,travelTo,discoveryError,discoverPlace,worldPlace} from "./mapRules";
import {resolveClassAction} from "./classActions";
import {combatBasics} from "./combatRules";
import {attackOptions,attacksPerAction,rollAttack,rollDamage,rangedMode,weaponRange} from "./weaponRules";
import {modifier} from "./characterRules";
import {updateHealth} from "./healthRules";
import {fallAtZero,deathSave,causeOfFall,fallPlace} from "./deathRules";
import {placeName} from "./mapRules";
import {journalForGame} from "./journalRules";
import {recordConsequences,recordDeed} from "./relationshipRules";
import {heroConditions,shieldBlow,undeadFortitude,companionsAttack,foeRoundMoves,foeAttackMode,pickFoeTarget,foeHitsCompanion,foeHitExtras,startWildFight,endWildFight,validFoeSketch,allFoeTemplates,companionAid} from "./encounterRules";
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
    potions: 1,
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
      const ended = endWildFight(result.game, outcome);
      result.events = [...kept, ...ending];
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
      let foe = place.threat ? {template: place.threat.template, name: place.threat.name, appearance: place.threat.appearance} : null, hpLeft = place.threat?.hp ?? null;
      if (!foe && first && place.danger === 'risky' && random() < 0.4) {
        const pool = allFoeTemplates().filter(f => !(combatBasics(hero).hp < 10 && (hero.level ?? 1) <= 2 && (f.group || f.key === 'orc')));
        const pick = pool[Math.floor(random() * pool.length)];
        foe = {template: pick.key, name: pick.foe, appearance: pick.appearance};
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
      const id = resolvedSpell.npcTarget, was = game.npcHP?.[id] ?? npcProfiles[id].maximumHP;
      if (was > 0 && (result.game.npcHP?.[id] ?? npcProfiles[id].maximumHP) === 0 && !result.game.npcFate?.[id]) {
        const line = npcProfiles[id].name + ' is dead.';
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
      const weapon = attackOptions(hero).find(w => w.name === action.weapon);
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
      if (!weapon.ranged && (game.castingConditions?.clearPath === false || distance > 5)) return {
        game,
        health,
        error: 'Move within 5 feet with a clear path before making a melee attack.'
      };
      if (weapon.ranged && range && distance > range.long) return {
        game,
        health,
        error: `${victim.name} is beyond your ${weapon.name}'s range.`
      };
      // Someone already lying senseless can be finished off where they lie.
      if (victim.hp <= 0) {
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
      let remaining = victim.hp;
      for (let swing = 0; swing < attacksPerAction(hero) && remaining > 0; swing++) {
        const attack = rollAttack(weapon, rangedMode(weapon, {closeEnemy: distance <= 5, distance}), random),
          hit = !attack.miss && (attack.critical || attack.total >= victim.ac);
        const damageRoll = hit ? rollDamage(weapon, attack.critical, random) : null;
        const damage = damageRoll?.total??0;
        remaining = Math.max(0, remaining - damage);
        entries.push(`You use ${weapon.name} against ${victim.name}: d20 [${attack.dice.join(', ')}] (${attack.mode}) + ${weapon.bonus} ${weapon.ability} + ${weapon.attackBonus-weapon.bonus} proficiency = ${attack.total} vs AC ${victim.ac}. ${attack.critical?'Critical hit':hit ? 'Hit' : 'Miss'}; ${damage} ${weapon.type} damage${damageRoll?' ('+(weapon.flat?'1 + '+weapon.bonus:damageRoll.dice.length+'d'+weapon.die+' ['+damageRoll.dice.join(', ')+'] + '+weapon.bonus)+')':''}. ${remaining} HP remaining.`);
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
    let spellResult = null;
    if (action?.type === 'spell' || action?.type === 'spell-ruling') {
      spellResult = action.type === 'spell' ? requestSpell(hero, game, hp, stats.hp, action.request, random, foe) : resolveSpellRuling(hero, game, hp, stats.hp, action.ruling, random);
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
    if (action === 'long-rest' && game.stage === 'inn') return {
      game: {
        ...newAdventure(hero, game),
        enemyHP: game.enemyHP,
        firedTriggers: game.firedTriggers,
        campaign: campaignState(game),
        map: mapState(game),
        log: ['You finish a long rest. HP and casting resources are restored.']
      },
      health: null
    };
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
      entries.push('A Lantern Wisp rises from the broken lamp. While it gathers itself, you have the first move.');
    } else if (game.stage === 'combat') {
      if (hp.current === 0) return {
        game: {
          ...game,
          stage: 'defeat'
        },
        health: hp
      };
      let dodge = false,
        bonusAction = false;
      if (turnOptions.enemyOnly) {
        // The opening attack is already committed; this phase only advances the foe.
      } else if (spellResult) {
        next = spellResult.game;
        hp = spellResult.health;
        next.enemyHP = Math.max(0, next.enemyHP - (spellResult.damage ?? 0));
        entries.push(...spellResult.logs);
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
        if (spellResult.bonus) next.bonusUsed = true;
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
          health
        };
        next = result.game ?? next;
        next.resources = result.resources;
        hp = result.health;
        next.enemyHP = Math.max(0, next.enemyHP - result.damage);
        entries.push(...result.logs);
        bonusAction = result.bonus;
        dodge = !!result.enemyDisadvantage;
        if (bonusAction) next.bonusUsed = true;
      } else if (action === 'potion' && game.potions > 0) {
        const a = 1 + Math.floor(random() * 4),
          b = 1 + Math.floor(random() * 4);
        const healed = updateHealth(hp, stats.hp, 'heal', a + b + 2);
        entries.push(`Healing draught: ${a} + ${b} + 2; restored ${healed.current - hp.current} HP. It uses your turn in this demo.`);
        hp = {
          current: healed.current,
          temp: healed.temp
        };
        next.potions--;
      } else if (action === 'dodge') {
        dodge = true;
        entries.push(game.wildFight ? `You dodge. The ${foe.name} attacks with disadvantage this turn.` : 'You dodge. The wisp attacks with disadvantage this turn.');
      } else {
        const weapon = attackOptions(hero).find(w => `attack:${w.name}` === action);
        if (!weapon) return {
          game,
          health
        };
        // A bow is fine before the foe closes in (the opening attack); once it is within 5 feet, shots have disadvantage.
        // Grit in the eyes, being knocked prone or caught in web also spoils your next attack.
        const mode = game.heroCondition ? 'disadvantage' : rangedMode(weapon, {closeEnemy: !turnOptions.opening});
        if (game.heroCondition) entries.push(heroConditions[game.heroCondition]);
        for (let swing = 0; swing < attacksPerAction(hero) && next.enemyHP > 0; swing++) {
          const attack = rollAttack(weapon, mode, random);
          const hit = !attack.miss && (attack.critical || attack.total >= foe.ac);
          entries.push(`You use ${weapon.name}: d20 [${attack.dice.join(', ')}] (${attack.mode}) + ${weapon.bonus} ${weapon.ability} + ${weapon.attackBonus-weapon.bonus} proficiency = ${attack.total} vs AC ${foe.ac}. ${attack.critical ? 'Critical hit!' : hit ? 'Hit.' : 'Miss.'}`);
          if (hit) {
            const damage = rollDamage(weapon, attack.critical, random);
            const blocked = shieldBlow(next, damage.total, random);
            next = blocked.game;
            next.enemyHP = Math.max(0, next.enemyHP - blocked.damage);
            entries.push(`${damage.total} ${weapon.type.toLowerCase()} damage (${weapon.flat ? '1' : damage.dice.join(' + ')} ${weapon.bonus >= 0 ? '+' : ''}${weapon.bonus}).`);
            if (blocked.line) entries.push(blocked.line);
          }
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
      // Companions travelling with you strike the creature once, after your turn.
      if (next.stage === 'combat' && !bonusAction && !turnOptions.suppressEnemy && !turnOptions.enemyOnly) {
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
      if (next.stage === 'combat' && !bonusAction && !turnOptions.suppressEnemy) {
        const defense = spellDefense(next, stats.ac, foe);
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
        for (let member = 1; member <= attackers && hp.current > 0; member++) {
        const who = attackers > 1 ? `${foe.name} ${member}` : foe.name;
        const mode = foeAttackMode({...next, heroCondition: lingering ?? next.heroCondition}, foe, attackers, {dodge, blur: defense.disadvantage});
        // Sometimes the creature goes for a companion beside you instead.
        const target = pickFoeTarget(next, random);
        if (target) {
          const struck = foeHitsCompanion(next, foe, who, target, mode, random);
          next = struck.game;
          entries.push(...struck.lines);
          continue;
        }
        const attack = rollAttack(foe, mode, random);
        const hit = !attack.miss && (attack.critical || attack.total >= defense.ac);
        entries.push(`${who}: d20 [${attack.dice.join(', ')}] (${attack.mode}) +${foe.attackBonus} = ${attack.total} vs your AC ${defense.ac}. ${attack.critical ? 'Critical hit!' : hit ? 'Hit.' : 'Miss.'}`);
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
        if (hp.current === 0) {
          const fell = fall(next, 'foe', overflow, stats.hp, game.dungeon?.active ? null : game.story ? (foe.group ? 'Cut down by the ' + foe.group.plural : 'Slain by the ' + game.story.foe) : downedBy ? 'Struck down by the ' + downedBy : null);
          next = fell.game;
          entries.push(...fell.entries);
        }
        next.round++;
        next.bonusUsed = false;
        next.slotSpentThisTurn = false;
        next.reactionUsed = false;
        if (next.concentration?.remaining !== null && next.concentration?.remaining !== undefined) {
          next.concentration = {
            ...next.concentration,
            remaining: next.concentration.remaining - 1
          };
          if (next.concentration.remaining <= 0) delete next.concentration;
        }
        if (next.temporarySpell) {
          next.temporarySpell = {
            ...next.temporarySpell,
            remaining: next.temporarySpell.remaining - 1
          };
          if (next.temporarySpell.remaining <= 0) {
            hp.temp = 0;
            delete next.temporarySpell;
          }
        }
        if (next.enemyEffects) next.enemyEffects = Object.fromEntries(Object.entries(next.enemyEffects).filter(([, rounds]) => rounds > 1).map(([key, rounds]) => [key, rounds - 1]));
        if (hp.current === 0) delete next.concentration;
      }
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
      health: hp
    };
  }

function creatureCombatStep(game,health,hero,action,random){
 let scene=game,command=action;
 if(action?.type==='encounter-attack'){
  if(!['bridge','combat'].includes(game.stage)||game.enemyHP<=0)return {game,health,error:'That creature is not within reach here.'};
  if(!attackOptions(hero).some(w=>w.name===action.weapon))return {game,health,error:'Choose a weapon you carry, or attack unarmed.'};
  if(game.stage==='bridge')scene={...game,stage:'combat',openingAttackAvailable:true,encounterInitiative:undefined};
  command='attack:'+action.weapon;
 }
 const spell=command?.type==='spell'?automaticEffects[command.request.id]:command?.type==='spell-ruling'?automaticEffects[scene.pendingSpell?.id]:null;
 const hostile=typeof command==='string'&&command.startsWith('attack:')||spell&&(spell.attack||spell.save||spell.missile)||command?.type==='spell-ruling'&&(command.ruling?.damage??0)>0;
 if(scene.stage==='combat'&&scene.openingAttackAvailable&&hostile){
  const opening=adventureStepCore(scene,health,hero,command,random,{suppressEnemy:true,opening:true});
  if(opening.error||opening.waiting||opening.game===scene)return opening.error?{...opening,game,health}:opening;
  opening.game={...opening.game,openingAttackAvailable:false};
  opening.events=['Opening attack.',...(opening.events??[])];
  if(opening.game.stage!=='combat')return opening;
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
  return result;
 }
 const result=adventureStepCore(scene,health,hero,command,random);
 if(result.game.stage==='combat'&&scene.stage!=='combat')result.game={...result.game,openingAttackAvailable:true,encounterInitiative:undefined};
 else if(scene.openingAttackAvailable&&!result.error&&!result.waiting&&result.game!==scene)result.game={...result.game,openingAttackAvailable:false};
 return result;
}

function adventureStepEngine(game,health,hero,action,random=Math.random){
 const stats=combatBasics(hero),pending=action?.type==='spell-ruling'?game.pendingSpell:null;
 const effect=pending?automaticEffects[pending.id]:null;
 const target=action?.type==='npc-attack'?action.target:pending?.npcTarget&&((effect&&(effect.attack||effect.save||effect.missile))||(action.ruling?.damage??0)>0)?pending.npcTarget:null;
 const active=game.npcCombat?.active;
 if(!active&&!target)return creatureCombatStep(game,health,hero,action,random);
 if(!stats.available||stats.ac===null)return {game,health,error:'Complete your combat statistics first.'};
 if((health?.current??stats.hp)<=0)return {game,health,error:'You are down and cannot act.'};
 if(active&&(typeof action==='string'&&!['npc-dodge','npc-flee','npc-wait','npc-surrender'].includes(action)||action?.type==='travel'))return {game,health,error:'Combat is underway. Attack, cast, dodge, surrender, or flee through Send to DM.'};
 if(active&&['npc-flee','npc-surrender'].includes(action)){
  if(game.pendingSpell)return {game,health,error:'Cancel the pending spell first.'};
  const next={...game,npcCombat:{...game.npcCombat,active:false},log:[action==='npc-flee'?'You disengage and retreat from the inn. Combat ends.':'You lower your weapon and surrender. Combat ends; the witnesses remain hostile.',...game.log].slice(0,40)};
  if(action==='npc-flee'){delete next.npcCombat;return travelTo(next,health??{current:stats.hp,temp:0},'bridge');}
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
  const standing=participants.filter(n=>(next.npcHP?.[n.id]??npcProfiles[n.id].maximumHP)>0);
  if(!standing.length)return {...opening,game:next,health:hp,events:opening.events??[]};
  events.push('Opening attack.',...(opening.events??[]));
  const roll=1+Math.floor(random()*20),second=stats.initiativeAdvantage?1+Math.floor(random()*20):roll;
  const order=[{id:'player',side:'player',role:'attack',initiative:Math.max(roll,second)+stats.initiative},...standing.map(n=>({...n,initiative:1+Math.floor(random()*20)}))].sort((a,b)=>b.initiative-a.initiative||(a.id==='player'?-1:b.id==='player'?1:a.id.localeCompare(b.id)));
  events.push('Your initiative: d20 ['+[roll,...(stats.initiativeAdvantage?[second]:[])].join(', ')+'] + '+stats.initiative+' = '+(Math.max(roll,second)+stats.initiative)+'.');
  events.push(...order.filter(n=>n.id!=='player').map(n=>npcProfiles[n.id].name+' initiative: d20 '+n.initiative+' + 0 = '+n.initiative+'.'));
  events.push('Turn order: '+order.map(n=>n.id==='player'?'You':npcProfiles[n.id].name).join(' → ')+'.');
  events.push('Round 1 begins.');
  next={...next,npcCombat:{active:true,round:1,order,help:null},log:['Combat begins. Initiative: '+order.map(n=>(n.id==='player'?'You':npcProfiles[n.id].name)+' '+n.initiative).join(' / ')+'.',...next.log].slice(0,40)};
  const first=runNpcTurns(next,hp,hero,order.slice(0,order.findIndex(n=>n.id==='player')),false,random);next=first.game;hp=first.health;events.push(...first.events);
  if(next.npcCombat?.active)events.push('Your turn.');
  next={...next,journal:appendJournal(next.journal,'encounter','Combat begins',events.join('\n').slice(0,3000)),bonusUsed:false,reactionUsed:false,slotSpentThisTurn:false};
  return {game:next,health:hp,events};
 }
 if(target&&next.npcCombat)next={...next,npcCombat:{...next.npcCombat,order:next.npcCombat.order.map(n=>n.id===target?{...n,side:'enemy',role:'attack'}:n)}};
 let result=special?{game:{...next,log:[action==='npc-dodge'?'You take the Dodge action.':'You hold your ground.',...next.log].slice(0,40)},health:hp}:adventureStepCore(next,hp,hero,action,random);
 if(result.error)return {game:next,health:hp,events,error:active?result.error:undefined};
 if(result.waiting)return result;
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
 if(result.game.concentration?.remaining!=null){result.game.concentration={...result.game.concentration,remaining:result.game.concentration.remaining-1};if(result.game.concentration.remaining<=0)delete result.game.concentration;}
 result.game={...result.game,journal:appendJournal(result.game.journal,'encounter','Inn combat',events.join('\n').slice(0,3000))};
 return result;
}
function runNpcTurns(game,health,hero,turns,dodge,random){
 let next={...game,npcCombat:{...game.npcCombat}},hp={...health},downed=null;const stats=combatBasics(hero),logs=[];
 const alive=id=>(next.npcHP?.[id]??npcProfiles[id].maximumHP)>0;
 const enemies=()=>next.npcCombat.order.filter(n=>n.side==='enemy'&&alive(n.id));
 for(const actor of turns){
  if(hp.current<=0||!enemies().length)break;
  if(!alive(actor.id))continue;
  const allied=actor.side==='ally',victim=allied?enemies()[0]:null;
  if(actor.role==='help'&&next.npcCombat.order.some(n=>n.side===actor.side&&n.id!==actor.id&&alive(n.id))){next.npcCombat.help=actor.side;logs.push(npcProfiles[actor.id].name+' distracts the opposition to help a defender.');continue;}
  const weapon={attackBonus:2,count:1,die:4,bonus:0};
  const defense=allied?{ac:npcProfiles[victim.id].ac}:spellDefense(next,stats.ac);
  const helped=next.npcCombat.help===actor.side,disadvantage=!allied&&(dodge||defense.disadvantage);
  const attack=rollAttack(weapon,helped===disadvantage?'normal':helped?'advantage':'disadvantage',random);
  if(helped)next.npcCombat.help=null;
  const hit=!attack.miss&&(attack.critical||attack.total>=defense.ac),damageRoll=hit?rollDamage(weapon,attack.critical,random):null,damage=damageRoll?.total??0;
  logs.push(`${npcProfiles[actor.id].name} attacks ${allied?npcProfiles[victim.id].name:'you'}: d20 [${attack.dice.join(', ')}] (${attack.mode}${helped?', Help':''}${!allied&&dodge?', Dodge':''}${defense.disadvantage?', Blur':''}) + 2 = ${attack.total} vs AC ${defense.ac}. ${attack.critical?'Critical hit':hit?'Hit':'Miss'}; ${damage} Bludgeoning damage${damageRoll?' ('+damageRoll.dice.length+'d4 ['+damageRoll.dice.join(', ')+'] + 0)':''}.`);
  if(damage&&allied)next.npcHP={...next.npcHP,[victim.id]:Math.max(0,(next.npcHP?.[victim.id]??npcProfiles[victim.id].maximumHP)-damage)};
  else if(damage){const hurt=updateHealth(hp,stats.hp,'damage',damage);if(hurt.current===0)downed={by:npcProfiles[actor.id].name,overflow:overflowOf(hurt.previous,damage)};hp={current:hurt.current,temp:hurt.temp};const concentration=concentrationAfterDamage(hero,next,damage,random);next=concentration.game;logs.push(...concentration.logs);}
 }
 // Felled in a brawl, the hero is left dying where they lie and the defenders stand back.
 if(hp.current<=0){const fell=fall(next,'npc',downed?.overflow??0,stats.hp,downed?'Struck down by '+downed.by:null);next=fell.game;logs.push(...fell.entries);}
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
 if(game.stage==='dead')return {game,health,error:'Your hero has died. Their story is over; begin a new tale with another hero.'};
 if(game.stage==='dying')return dyingStep(game,health,hero,action,random);
 const result=livingStep(game,health,hero,action,random);
 // "Knock them out" is an intent for this one action; it never stays on the adventure.
 if(result.game&&result.game!==game&&result.game.subdue!==undefined){result.game={...result.game};delete result.game.subdue;}
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
  const helper=game.story?.npcs?.[aid.id]?.name??npcProfiles[aid.id].name,rescued={...game,stage:game.story?'inn':'defeat'};delete rescued.dying;
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
function livingStep(game,health,hero,action,random){
 if(!game.story){const result=adventureStepEngine(game,health,hero,action,random);return {...result,events:result.events??stepLogEntries(game.log,result.game?.log)};}
 if(action==='story-complete')return {game:{...game,story:{...game.story,status:'complete'},log:['Adventure complete: '+game.story.title,...game.log].slice(0,40)},health,events:['Adventure complete: '+game.story.title]};
 const allowed=['approach','dodge','flee','potion','long-rest','npc-dodge','npc-flee','npc-wait','npc-surrender'];
 if(typeof action==='string'&&!allowed.includes(action)&&!action.startsWith('attack:'))return {game,health,error:'That action belongs to a different adventure. Describe what you want to do in this story.'};
 const scene=action?.type==='travel'&&game.stage==='victory'?{...game,stage:'bridge'}:game;
 const result=adventureStepEngine(scene,health,hero,action,random);
 if(result.error||result.game===scene)return {...result,game};
 // Stories continue after a lost fight: the player is back at the starting location and the foe keeps its HP.
 if(['escaped','defeat'].includes(result.game.stage)){const woke=result.game.stage==='defeat'?['You wake at '+game.story.locations.inn.name+', carried back from the fight. Rest to recover.']:[],map=mapState(result.game);result.events=[...(result.events??stepLogEntries(game.log,result.game.log)),...woke];result.game={...result.game,stage:'inn',map:{...map,visited:[...new Set([...map.visited,'inn'])]},log:[...woke,...result.game.log].slice(0,40)};}
 // Lines are retold in the story's own names; the foe's end follows how it fell (slain, or beaten but alive).
 const told={...game,foeFate:result.game.foeFate,world:result.game.world,wildFight:result.game.wildFight??game.wildFight};
 result.game={...result.game,story:game.story,storyHistory:game.storyHistory,log:result.game.log.map(t=>storyText(told,t)),journal:result.game.journal?{...result.game.journal,entries:result.game.journal.entries.map(e=>({...e,title:storyText(told,e.title),text:storyText(told,e.text)}))}:game.journal};
 result.events=(result.events??stepLogEntries(game.log,result.game.log)).map(t=>storyText(told,t));
 if(action==='long-rest')result.game.journal=game.journal;
 return result;
}
