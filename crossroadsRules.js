// The crossroads tale (the adventure without a written story) of the first builds: the inn's quest, accepted with or
// without a study of the lantern, the keeper's and the tower's checks, the watchtower bell, the bridge and its wisp
// (called home or fought) (moved from adventureRules.js; the vault is dungeonRules.js, the rewards campaignRules.js).
// No player reaches it any more (2026-10-21: a game without a tale is never played; see storyRules.js hasTale), and
// its "begin another adventure" restart is gone; the engine keeps these moves for the checks that test the rules on
// the crossroads' fixed places and for old saves, which load as they are and then ask for a tale.
import {mapState,travelTo} from "./mapRules";
import {modifier} from "./characterRules";
import {finishStep} from "./adventureRules";
export function abilityCheck(step) {
  const {game, health, hero, action, random, next, hp} = step;
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
export function inspectTower(step) {
  const {game, health, next} = step;
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
// The crossroads bridge: the wisp called home, or approached for a fight.
export function bridgeStep(step) {
  const {game, health, hero, action, foe, next, hp, entries} = step;
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
  if (game.stage !== 'bridge') return;
  next.stage = hp.current > 0 ? 'combat' : 'defeat';
  next.openingAttackAvailable = true;
  delete next.encounterInitiative;
  // A written story's foe is met in its own words; the crossroads wisp keeps its lamp.
  entries.push(game.story ? (foe.group ? 'The ' + foe.group.plural + ' are upon you. While they gather themselves, you have the first move.' : 'The ' + game.story.foe + ' is upon you. While it gathers itself, you have the first move.') : 'A Lantern Wisp rises from the broken lamp. While it gathers itself, you have the first move.');
  return finishStep(game, hero, next, hp, entries);
}
// At the crossroads inn: the quest accepted, with or without a study of the lantern first.
export function studyOrListen(step) {
  const {game, health, hero, action, random, entries} = step;
  let {next, hp} = step;
  if (game.stage !== 'inn') return;
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
  return finishStep(game, hero, next, hp, entries);
}
