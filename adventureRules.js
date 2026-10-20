import {storyText,questState} from './storyRules';
import {recordNpcAggression,npcServiceError,npcProfile,npcLore,npcIdsOf} from "./npcRules";
import {automaticEffects,requestSpell,resolveSpellRuling,tickBuffs,spellAgain,moveMark,markGone,withDefenses,knownSpells} from "./spellRules";
import {slotChoices,slotUsed} from "./spellOptions";
import {dungeonRooms,dungeonAction} from "./dungeonRules";
import {campaignState,campaignAction} from "./campaignRules";
import {beginJournal,recordJournalTransition,appendJournal} from "./journalRules";
import {mapState,mapLocation,travelRoute,timePasses} from "./mapRules";
import {turnCost} from "./classActions";
import {combatBasics} from "./combatRules";
import {modifier} from "./characterRules";
import {fallAtZero,deathSave,causeOfFall,fallPlace,reviveHero,partyRevivalError,revivalSpell} from "./deathRules";
import {placeName} from "./mapRules";
import {journalForGame} from "./journalRules";
import {recordConsequences,recordDeed} from "./relationshipRules";
import {gearedHero,gatherThrown,setShield} from "./inventoryRules";
import {partyHeroName,companionAid,allyStats,livingAllies,aimedAlly,sideStrength,foeScaleKey,foeScaleOf,scaledFoe} from "./encounterRules";
import {isPartyGame} from "./partyRules";
import {fightOver} from "./masteryRules";
import {withSpoils,takeSpoils} from "./lootRules";
import {subclassAction,subclassVictoryTemp} from "./subclassRules";
import {manageFollower,orderFollowers,acceptOffer} from "./followerRules";
import {wildFightEnds,arrivalAmbush,ambushStep,creatureRound,creatureCombatStep} from "./wildFightRules";
import {anyoneStanding,partyFightGoesOn,partyStep} from "./partyTurnRules";
import {attackPerson,againOnPerson,brawlStep} from "./brawlRules";
import {giveDraught,drinkPotion,drinkFromPack,shortRest,longRest} from "./recoveryRules";
import {travelStep,discoverStep,beyondStep} from "./travelRules";
import {abilityCheck,restartAdventure,inspectTower,bridgeStep,studyOrListen} from "./crossroadsRules";
import {endSpellMarks} from "./spellConditionRules";
// A pack carried into a new adventure: arrows shot stay spent, thrown weapons are back in hand.
function thrownPickedUp(pack){
  if(!pack?.spent||Object.keys(pack.spent).every(k=>k==='Arrow'))return pack;
  const next={...pack},spent=Object.fromEntries(Object.entries(pack.spent).filter(([k])=>k==='Arrow'));
  if(Object.keys(spent).length)next.spent=spent;else delete next.spent;
  return next;
}
// Damage past 0 HP from one blow (temporary HP soaks first): it decides an outright death.
export const overflowOf=(previous,amount)=>Math.max(0,amount-(previous?.temp??0)-(previous?.current??0));
export const fall=(game,source,overflow,maximum,who)=>fallAtZero(game,{overflow,maximum,cause:who??causeOfFall(game,source),placeName:placeName(game,fallPlace(game)),where:mapLocation(game)});
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
    // The story so far (memoryRules.js): every tale and the facts kept from it go with the hero into the next.
    ...(previous?.memory ? {memory: previous.memory} : {}),
    potions: Math.max(1, previous?.potions ?? 1),
    round: 1,
    log: []
  });
  export function adventureStepCore(game, health, hero, action, random = Math.random, turnOptions = {}) {
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
    if (game.wildFight && result.game.wildFight && result.game.stage !== 'combat' && !partyFightsOn) wildFightEnds(game, result);
    // Tricks and conditions belong to one fight.
    if (result.game.stage !== 'combat' && (result.game.heroCondition || (result.game.foeTricks && !partyFightsOn))) {
      result.game = {...result.game};
      delete result.game.heroCondition;
      if (!partyFightsOn) delete result.game.foeTricks;
    }
    // Arriving somewhere new can be dangerous: a lair's creature (or one you fled from) is waiting, and a risky
    // place may hide an ambush the first time you set foot there.
    if ((action?.type === 'travel' || action?.type === 'discover' || action?.type === 'beyond') && result.game.stage === 'wild' && !result.game.wildFight) arrivalAmbush(game, result, hero, random);
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
    // Each kind of move has its handler (stepHandler); one that does not apply here lets the move go on.
    const step = {game, health, hero, action, random, turnOptions, stats, foe, next, hp, entries};
    const handler = stepHandler(action), handled = handler ? handler(step) : undefined;
    if (handled) return handled;
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
    // An attack or spell aimed at the creature fighting beside the foe ("ally:0").
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
    if (game.stage === 'combat') return creatureRound(step, spellResult, aim, aimedFoe);
    return {
      game,
      health
    };
  }
// Who handles each kind of move: an action object by its type, an action word by itself (or by its prefix, such as
// 'drink:'). A handler returns the step's result, or nothing to let the move go on (most often to the fight). The
// table is made on first use, since some handlers live in modules that import this one.
let stepHandlers = null;
function stepHandler(action) {
  if (!stepHandlers) stepHandlers = {
    type: {'npc-attack': attackPerson, 'end-concentration': endConcentration, travel: travelStep, discover: discoverStep, beyond: beyondStep, 'give-potion': giveDraught, ambush: ambushStep},
    word: {'check:': abilityCheck, 'restart-adventure': restartAdventure, potion: drinkPotion, 'drink:': drinkFromPack, 'inspect-tower': inspectTower, 'call-wisp': bridgeStep, approach: bridgeStep, 'again:': againOnPerson, 'move-mark:': againOnPerson, 'short-rest': shortRest, 'long-rest': longRest, study: studyOrListen, listen: studyOrListen}
  };
  const table = typeof action === 'string' ? stepHandlers.word : stepHandlers.type, key = typeof action === 'string' ? action.replace(/:[^]*$/, ':') : action?.type;
  return typeof key === 'string' && Object.hasOwn(table, key) ? table[key] : null;
}
function endConcentration(step) {
  const {game, health, next} = step;
  delete next.concentration;
  next.log = ['You end concentration.', ...game.log].slice(0, 40);
  return {
    game: next,
    health
  };
}
// How a step ends: gifts for a won fight, then the log.
export function finishStep(game, hero, next, hp, entries, turnOver = false, dodged = false) {
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
export function tickHeroSpells(next, hp) {
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
export const inHand=(hero,name)=>(hero.equipment?.items??[]).filter(i=>i.name===name).reduce((n,i)=>n+(i.quantity??0),0);

function adventureStepEngine(game,health,hero,action,random=Math.random,opts={}){
 const stats=combatBasics(hero),pending=action?.type==='spell-ruling'?game.pendingSpell:null;
 const effect=pending?automaticEffects[pending.id]:null;
 const target=action?.type==='npc-attack'?action.target:pending?.npcTarget&&((effect&&(effect.attack||effect.save||effect.missile||effect.trueStrike))||(action.ruling?.damage??0)>0)?pending.npcTarget:null;
 const active=game.npcCombat?.active;
 if(!active&&!target)return creatureCombatStep(game,health,hero,action,random,opts);
 return brawlStep(game,health,hero,action,random,opts,stats,target,active);
}

// A single engine phase prepends its entries, already in execution order.
export function stepLogEntries(before=[],after=[]){
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
export function heroStep(game,health,hero,action,random,opts={}){
 if(game.stage==='dead'){
  if(action?.type==='revive'&&typeof action.by==='string'){const back=reviveHero(game,health,hero,action.by);if(back.error)return back;const next={...back.game,log:[...back.events,...game.log].slice(0,40)};next.journal=appendJournal(journalForGame(next),'encounter','Brought back',hero.name+' died and was brought back by '+(back.events[0].split(' presses')[0])+'.');return {...back,game:next};}
  return {game,health,error:'Your hero has died. Their story is over; begin a new tale with another hero.'};
 }
 // Revivify on a hero of the party who has just died (deathRules.js): a 3rd-level slot and a 300 gp diamond.
 if(action?.type==='revive'&&typeof action.target==='string'&&action.target.startsWith('party:'))return reviveFriend(game,health,hero,action.target.slice(6));
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
 // The shield put on the back to hold a weapon in both hands, or taken up again (inventoryRules.js setShield; typed,
 // dmCommands.js shieldCommand). Out of a fight it is free. In one it is the hero's action (donning or doffing a shield
 // takes an action in the rules), on their own turn: the shield changes first, so the foe's answer meets the new
 // armor class, and the turn goes on as after a Dodge (a bonus action may follow; then the foe acts).
 const before=game,shieldMove=action?.type==='shield';
 if(shieldMove){
  if(typeof action.away!=='boolean'||(action.weapon!=null&&(typeof action.weapon!=='string'||action.weapon.length>60)))return {game,health,error:'Say whether the shield goes on your back or on your arm.'};
  const fight=game.stage==='combat'||!!game.npcCombat?.active;
  if(fight&&game.pendingSpell)return {game,health,error:'Cancel the pending spell first.'};
  if(fight&&game.actionUsed)return {game,health,error:'Putting a shield on or off takes your action, and you have already used it this turn. Use a bonus action or end your turn.'};
  const done=setShield(game,hero,action.away,action.weapon??null);
  if(done.error)return {game,health,error:done.error};
  if(!fight)return {game:{...done.game,log:[done.line,...(game.log??[])].slice(0,40)},health,events:[done.line]};
  game=done.game;action={type:'shield',away:action.away,line:done.line+' That takes your action.'};
 }
 // The rules see the hero as they are now: found weapons in hand, arrows already spent gone.
 const result=livingStep(game,health,gearedHero(hero,game),action,random,opts);
 if(shieldMove&&result.error)return {...result,game:before,health};
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
function reviveFriend(game,health,hero,pid){
 const error=partyRevivalError(game,hero,pid,health);if(error)return {game,health,error};
 const spell=knownSpells(hero).find(s=>s.id===revivalSpell.id),slot=Math.min(...slotChoices(hero,game,spell).filter(s=>s>=revivalSpell.level)),member=game.party.members[pid],name=partyHeroName(member);
 const own={...(member.hero??{})};delete own.death;delete own.dying;
 const next={...game,spellSlotsUsed:Array.from({length:9},(_,i)=>slotUsed(game,i+1)+(i+1===slot?1:0)),pack:{...(game.pack??{gold:0,items:[]}),gold:(game.pack?.gold??0)-revivalSpell.diamond},party:{...game.party,members:{...game.party.members,[pid]:{...member,status:'up',health:{current:1,temp:0},hero:own}}}};
 next.resources={...game.resources,slots:next.spellSlotsUsed[0]};
 const line='You press a diamond to '+name+'’s chest and cast '+revivalSpell.name+' ('+slot+(slot===3?'rd':'th')+'-level slot). The stone crumbles to dust, and '+name+' draws breath again with 1 HP.';
 return {game:{...next,log:[line,...game.log].slice(0,40)},health,events:[line]};
}
// While dying the hero can do one thing: fight to hold on.
export function dyingStep(game,health,hero,action,random){
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
export function toldInStory(game,result){
 const told={...game,foeFate:result.game.foeFate,world:result.game.world,wildFight:result.game.wildFight??game.wildFight};
 result.game={...result.game,story:game.story,storyHistory:game.storyHistory,log:result.game.log.map(t=>storyText(told,t)),journal:result.game.journal?{...result.game.journal,entries:result.game.journal.entries.map(e=>({...e,title:storyText(told,e.title),text:storyText(told,e.text)}))}:game.journal};
 result.events=(result.events??stepLogEntries(game.log,result.game.log)).map(t=>storyText(told,t));
 return result;
}
