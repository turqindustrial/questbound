import {validStory} from './storyRules';
import {validFollowers} from './followerRules';
import {validSkillTraining} from './skillRules';
import {validNpcState} from './npcRules';
import {validDungeon} from './dungeonRules';
import {validCampaign} from './campaignRules';
import {validMap} from './mapRules';
import {validJournal} from './journalRules';
import {validDeathState} from './deathRules';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {combatBasics} from './combatRules';

const ADVENTURE_KEY = 'questbound.adventure.v1';
const integerBetween = (n,min,max) => Number.isInteger(n) && n>=min && n<=max;
export function adventureSnapshot(hero,game,health,chosen) {
  return {version:1,character:JSON.stringify(hero),game,health:health ? {current:health.current,temp:health.temp} : null,chosen};
}
export function validAdventure(value,hero) {
  const g=value?.game, h=value?.health, maximum=combatBasics(hero).hp;
  return value?.version===1 && typeof value.character==='string' && typeof value.chosen==='boolean'
    && !!g && ['inn','bridge','tower','dungeon','combat','victory','defeat','escaped','wild','dying','dead'].includes(g.stage)
    && validDeathState(g) && (!['dying','dead'].includes(g.stage) || h?.current===0)
    && (g.foeFate===undefined || ['slain','subdued'].includes(g.foeFate))
    && (g.npcFate===undefined || (g.npcFate&&typeof g.npcFate==='object'&&!Array.isArray(g.npcFate)&&Object.entries(g.npcFate).every(([id,fate])=>['keeper','mara'].includes(id)&&['dead','unconscious'].includes(fate)&&g.npcHP?.[id]===0)))
    && (g.encounterLevel===undefined || (integerBetween(g.encounterLevel,1,20) && g.encounterLevel===hero.level)) && integerBetween(g.enemyHP,0,Math.max(10+8*((g.encounterLevel??1)-1),g.dungeon?14+4*(hero.level-1):0,g.story?.foeStats?.maximum??0)) && integerBetween(g.potions,0,1) && integerBetween(g.round,1,Number.MAX_SAFE_INTEGER)
    && Array.isArray(g.log) && g.log.length<=40 && g.log.every(line=>typeof line==='string' && line.length<=1000)
    && (g.playback===undefined || (Array.isArray(g.playback)&&g.playback.length<=12&&g.playback.every((turn,i)=>turn&&Number.isSafeInteger(turn.id)&&turn.id>0&&(i===0||turn.id>g.playback[i-1].id)&&(turn.npcId===null||['keeper','mara'].includes(turn.npcId))&&(turn.participants===undefined||(Array.isArray(turn.participants)&&turn.participants.length<=2&&new Set(turn.participants).size===turn.participants.length&&turn.participants.every(id=>['keeper','mara'].includes(id))))&&Array.isArray(turn.events)&&turn.events.length>0&&turn.events.length<=100&&turn.events.every(e=>e&&['player','initiative','roll','action','effect','story','dialogue','narration'].includes(e.kind)&&typeof e.text==='string'&&e.text.length>0&&e.text.length<=2200&&(e.speakerId===undefined||['keeper','mara'].includes(e.speakerId))&&(e.speakerName===undefined||(typeof e.speakerName==='string'&&e.speakerName.length>0&&e.speakerName.length<=100))))))
    && (h===null || (!!h && integerBetween(h.current,0,maximum) && integerBetween(h.temp,0,9999)))
    && (g.bonusUsed===undefined || typeof g.bonusUsed==='boolean')
    && (g.openingAttackAvailable===undefined || typeof g.openingAttackAvailable==='boolean')
    && (g.encounterInitiative===undefined || (g.encounterInitiative&&integerBetween(g.encounterInitiative.player,-10,50)&&integerBetween(g.encounterInitiative.foe,-10,50)))
    && (g.resources===undefined || (g.resources!==null && typeof g.resources==='object' && !Array.isArray(g.resources) && Object.entries(g.resources).every(([key,n])=>['slots','wind','hands'].includes(key) && integerBetween(n,0,key==='hands'?5*hero.level:key==='wind'?4:4))))
    && (g.journal===undefined || validJournal(g.journal))
    && (g.dmChecks===undefined || (Array.isArray(g.dmChecks)&&g.dmChecks.length<=2&&new Set(g.dmChecks).size===g.dmChecks.length&&g.dmChecks.every(id=>['persuade-keeper','investigate-signal'].includes(id))))
    && (g.worldFacts===undefined||(Array.isArray(g.worldFacts)&&g.worldFacts.length<=60&&g.worldFacts.every(t=>typeof t==='string'&&t.length>0&&t.length<=800)))
    && (g.npcHP===undefined||(g.npcHP&&typeof g.npcHP==='object'&&!Array.isArray(g.npcHP)&&Object.entries(g.npcHP).every(([id,hp])=>['keeper','mara'].includes(id)&&integerBetween(hp,0,id==='keeper'?12:9))))
    && (g.story===undefined||validStory(g.story))
    && validSkillTraining(g.skillTraining,hero)
    && validNpcState(g)
    && validFollowers(g.followers)
    && validDungeon(g.dungeon)
    && (g.stage!=='dungeon'||g.dungeon?.active===true)
    && (!g.dungeon?.active||['dungeon','combat'].includes(g.stage))
    && (!(g.dungeon?.active&&g.stage==='combat')||([2,6].includes(g.dungeon.room)&&!g.dungeon.cleared.includes(g.dungeon.room)))
    && validCampaign(g.campaign)
    && (g.castingConditions===undefined || (g.castingConditions&&typeof g.castingConditions==='object'&&!Array.isArray(g.castingConditions)&&Object.entries(g.castingConditions).every(([key,value])=>key==='targetDistance'?Number.isFinite(value)&&value>=0&&value<=100000:['silenced','handsBound','incapacitated','clearPath'].includes(key)&&typeof value==='boolean')))
    && validMap(g)
    && validSpellState(g)
    && (g.stage!=='victory' || g.enemyHP===0)
    && (g.stage!=='combat' || g.enemyHP>0);
}
export async function loadAdventure(hero) {
  const raw=await AsyncStorage.getItem(ADVENTURE_KEY);
  if(raw===null) return null;
  const value=JSON.parse(raw);
  // A changed character starts a fresh quest; never attach an old hero's HP.
  if(value?.character!==JSON.stringify(hero)) return null;
  if(!validAdventure(value,hero)) throw new Error('Invalid adventure save');
  return value;
}
let adventureWrites=Promise.resolve();
export function saveAdventure(value,hero) {
  if(!validAdventure(value,hero) || value.character!==JSON.stringify(hero)) return Promise.reject(new Error('Invalid adventure save'));
  const raw=JSON.stringify(value);
  const write=adventureWrites.catch(()=>{}).then(()=>AsyncStorage.setItem(ADVENTURE_KEY,raw));
  adventureWrites=write;
  return write;
}

function validSpellState(g) {
  const text=(v,max)=>typeof v==='string' && v.length>0 && v.length<=max;
  const spellTime=v=>v && text(v.id,100) && (v.remaining===null || integerBetween(v.remaining,1,10000000));
  const pending=g.pendingSpell;
  return (g.spellSlotsUsed===undefined || (Array.isArray(g.spellSlotsUsed) && g.spellSlotsUsed.length===9 && g.spellSlotsUsed.every(n=>integerBetween(n,0,4))))
    && (g.slotSpentThisTurn===undefined || typeof g.slotSpentThisTurn==='boolean')
    && (g.reactionUsed===undefined || typeof g.reactionUsed==='boolean')
    && (g.arcanumUsed===undefined || (Array.isArray(g.arcanumUsed) && new Set(g.arcanumUsed).size===g.arcanumUsed.length && g.arcanumUsed.every(n=>integerBetween(n,6,9))))
    && (g.concentration===undefined || (spellTime(g.concentration) && text(g.concentration.duration,150) && (g.concentration.automaticProtection===undefined || (g.concentration.automaticProtection===true && ['blur','shield-of-faith'].includes(g.concentration.id) && integerBetween(g.concentration.remaining,1,g.concentration.id==='blur'?10:100)))))
    && (g.temporarySpell===undefined || spellTime(g.temporarySpell))
    && (g.enemyEffects===undefined || (g.enemyEffects && typeof g.enemyEffects==='object' && !Array.isArray(g.enemyEffects) && Object.entries(g.enemyEffects).every(([name,n])=>['No opportunity attacks','Cannot regain HP','Speed reduced by 10 feet'].includes(name) && integerBetween(n,1,2))))
    && (pending===undefined || (pending && text(pending.id,100) && text(pending.intent,500) && pending.intent.trim().length>=3 && pending.componentsConfirmed===true && (pending.npcTarget===undefined||['keeper','mara'].includes(pending.npcTarget)) && (integerBetween(pending.slot,0,9) || ['ritual','arcanum'].includes(pending.slot))));
}
