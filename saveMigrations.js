import {currentSaveVersion} from './saveVersion';
import {heroXp} from './experienceRules';
import {withMemory} from './memoryRules';
import {withCompanionClasses} from './followerRules';
import {grudgeWeight} from './npcRules';
// Old saves, upgraded once, on load, in one place (SAVES.md; the policy is in AGENTS.md "Saves and their formats").
//
// Every save any tester-reachable build ever wrote still loads: the validators accept every old shape, and nothing
// here is needed for a save to load or play. What this module does is bring an older save to the current shape the
// first time this build reads it (characterStorage.loadCharacter, adventureStorage.loadAdventure, the roster, a
// shared table's snapshot as the campaign server reads it or a device adopts it), so that the rules can one day stop
// reading old shapes lazily. A step is added here only when it is exact: the upgraded save means the same game.
// The storage layer keeps the original whenever an upgraded copy would not pass the save checks, so a mistake here can
// never cost anyone a save.
//
// Formats (`saveVersion` on the hero and on the adventure snapshot):
// - 0 (no saveVersion): everything written from the first playtest build (235726f, 30 September 2026) to this one
//   (13 October 2026). Retire no earlier than six months after the last build that wrote it, and never before the
//   full launch.
// - 1: this build. Upgrading 0 → 1:
//   - the hero: a subclass planned under a name since changed takes its new name (formatOneRenames); an old 'Elf'
//     or 'Dark Elf' is kept as it is (portraits are painted from the species as written, and heroSpecies reads it);
//   - a solo adventure: experience from before experience points (a level owed on the road, a main foe beaten and its
//     level not yet taken) becomes experience points (heroXp, which reads them the same way); companions from before
//     classes get theirs, out of a fight (withCompanionClasses, as the play screen and the campaign server do);
//   - any adventure: the story so far is folded into the memory (withMemory, as every settled turn does); a grudge from
//     before weights takes the weight its words give it (grudgeWeight);
//   - a shared table: every seated hero is upgraded as above; the party's own heroes keep their experience as it is
//     until their next award (withExperience upgrades each member then), because an old party counted a won fight
//     differently for each hero.
export const saveFormats=[
 {version:0,from:'2026-09-30',to:'2026-10-13',firstBuild:'235726f',note:'no saveVersion: every save before formats were numbered'},
 {version:1,from:'2026-10-13',note:'saveVersion 1: heroes and snapshots carry their format; older ones upgraded on load'},
];
export const saveVersionOf=value=>Number.isInteger(value?.saveVersion)&&value.saveVersion>0?value.saveVersion:0;
// The renames format 1 makes, as they stood when it was written (an exact step never changes after the fact): later
// renames (the Artificer's, 2026-10-22) are read where the name is used (characterRules.js currentSubclass) and never
// written into a save, because the adventure is tied to the hero's exact text.
const formatOneRenames={'Warrior of the Hidden Step':'Warrior of the Quiet Step'};
// The hero, upgraded to the current format (the same object when it already is).
export function upgradeCharacter(hero){
 if(!hero||typeof hero!=='object'||Array.isArray(hero)||saveVersionOf(hero)>=currentSaveVersion)return hero;
 const next={...hero};
 if(Object.hasOwn(formatOneRenames,next.plannedSubclass??''))next.plannedSubclass=formatOneRenames[next.plannedSubclass];
 next.saveVersion=currentSaveVersion;
 return next;
}
// A hero kept as text (an adventure's `character`, a party member's): upgraded, still as text.
function upgradedText(text){
 let hero;try{hero=JSON.parse(text);}catch{return text;}
 const next=upgradeCharacter(hero);return next===hero?text:JSON.stringify(next);
}
// Whether two heroes kept as text are the same hero: equal as they are, or once both are upgraded (one save may hold
// the hero from before an upgrade and another from after, as when a load was cut short between the two writes).
// The portrait is left out of that comparison: a new face is saved on the hero first and on the adventure after it,
// and a load cut short between the two writes must still find the adventure (characterRules validPortraitChoice).
function withoutPortraitText(text){
 let hero;try{hero=JSON.parse(upgradedText(text));}catch{return text;}
 if(!hero||typeof hero!=='object'||!Object.hasOwn(hero,'portrait'))return upgradedText(text);
 const {portrait,...rest}=hero;return JSON.stringify(rest);
}
export const sameHeroText=(a,b)=>typeof a==='string'&&typeof b==='string'&&(a===b||upgradedText(a)===upgradedText(b)||withoutPortraitText(a)===withoutPortraitText(b));
// Format 0 → 1 for the game itself (see above). Pure: the same game in gives the same game out.
function gameToVersion1(game,hero){
 if(!game||typeof game!=='object')return game;
 let g=game;
 const party=!!g.party;
 if(!party){
  if(g.levelsOwed!==undefined||(g.xp===undefined&&g.stage==='victory')){g={...g,xp:heroXp(g,hero)};delete g.levelsOwed;}
  if(g.stage!=='combat'&&!g.npcCombat?.active&&!g.pendingSpell)g=withCompanionClasses(g,hero);
 }
 if(g.npcMemory&&Object.values(g.npcMemory).some(m=>m?.grudge&&!['grave','blood'].includes(m.grudgeWeight)))
  g={...g,npcMemory:Object.fromEntries(Object.entries(g.npcMemory).map(([id,m])=>[id,m?.grudge&&!['grave','blood'].includes(m.grudgeWeight)?{...m,grudgeWeight:grudgeWeight(m)}:m]))};
 g=withMemory(g);
 if(party&&g.party?.members){
  const members=Object.fromEntries(Object.entries(g.party.members).map(([id,m])=>[id,m&&typeof m.character==='string'?{...m,character:upgradedText(m.character)}:m]));
  g={...g,party:{...g.party,members}};
 }
 return g;
}
// An adventure snapshot ({version:1, character, game, health, chosen}), upgraded to the current format: its hero,
// its game and its stamp. The same object when it already is current.
export function upgradeAdventure(value){
 if(!value||typeof value!=='object'||typeof value.character!=='string'||saveVersionOf(value)>=currentSaveVersion)return value;
 let hero;try{hero=JSON.parse(value.character);}catch{return value;}
 const next=upgradeCharacter(hero);
 return {...value,saveVersion:currentSaveVersion,character:next===hero?value.character:JSON.stringify(next),game:gameToVersion1(value.game,next)};
}
