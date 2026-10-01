import AsyncStorage from '@react-native-async-storage/async-storage';
import {isValidCharacter} from './characterStorage';
import {validAdventure,adventureSnapshot} from './adventureStorage';
import {placeName,mapLocation} from './mapRules';
// Your company of heroes on this device. Starting another hero no longer throws the current one away: a living hero
// is set aside in the roster with their adventure exactly as it was (switch back any time), and a hero who died is
// remembered in the graveyard with how and where they fell.
const ROSTER_KEY='questbound.roster.v1',GRAVES_KEY='questbound.graveyard.v1';
export const maxRoster=8,maxGraves=40;
const rosterText=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
export function rosterEntry(hero,game,health,chosen,now=Date.now()){
 return {id:now.toString(36)+Math.random().toString(36).slice(2,7),savedAt:new Date(now).toISOString(),character:JSON.stringify(hero),adventure:adventureSnapshot(hero,game,health,!!chosen),
  summary:{name:hero.name,level:hero.level,species:hero.species??hero.race,class:hero.class,story:game.story?.title??null,place:game.story?placeName(game,mapLocation(game)):null}};
}
export function graveEntry(hero,game,now=Date.now()){
 return {name:hero.name,level:hero.level,species:hero.species??hero.race,class:hero.class,cause:String(game.death?.cause??'Fell on the road').slice(0,300),place:game.death?.place??null,story:game.story?.title??null,at:new Date(now).toISOString(),character:JSON.stringify(hero)};
}
export function validRosterEntry(e){
 try{const hero=JSON.parse(e.character);return rosterText(e.id,40)&&rosterText(e.savedAt,40)&&isValidCharacter(hero)&&e.adventure?.character===e.character&&validAdventure(e.adventure,hero)&&e.adventure.game.stage!=='dead'&&!!e.summary&&rosterText(e.summary.name,60);}catch{return false;}
}
export function validGrave(g){
 return !!g&&rosterText(g.name,60)&&Number.isInteger(g.level)&&g.level>=1&&g.level<=20&&rosterText(g.class,60)&&rosterText(g.cause,300)&&(g.place===null||rosterText(g.place,100))&&(g.story===null||rosterText(g.story,100))&&rosterText(g.at,40)&&typeof g.character==='string';
}
async function readList(key,valid){
 const raw=await AsyncStorage.getItem(key);if(raw===null)return [];
 const list=JSON.parse(raw);return Array.isArray(list)?list.filter(valid):[];
}
export const loadRoster=()=>readList(ROSTER_KEY,validRosterEntry);
export const loadGraveyard=()=>readList(GRAVES_KEY,validGrave);
// Set the current hero aside before another takes their place. Returns the updated roster and graveyard (or an error
// when the roster is full, so nothing is lost).
export function setAside(roster,graves,hero,game,health,chosen,now=Date.now()){
 if(!hero)return {roster,graves};
 const character=JSON.stringify(hero);
 if(game?.stage==='dead'){
  if(graves.some(g=>g.character===character))return {roster,graves};
  return {roster,graves:[graveEntry(hero,game,now),...graves].slice(0,maxGraves)};
 }
 const others=roster.filter(e=>e.character!==character);
 if(others.length>=maxRoster)return {error:'Your company already has '+maxRoster+' heroes waiting. Retire one under Heroes first.'};
 return {roster:[rosterEntry(hero,game,health,chosen,now),...others],graves};
}
export async function saveLists({roster,graves}){
 await AsyncStorage.setItem(ROSTER_KEY,JSON.stringify(roster));
 await AsyncStorage.setItem(GRAVES_KEY,JSON.stringify(graves));
}
// The hero, adventure and health to restore from a roster entry.
export function restoreEntry(entry){
 if(!validRosterEntry(entry))throw Error('That hero\'s save could not be read. They stay in your roster.');
 return {hero:JSON.parse(entry.character),game:entry.adventure.game,health:entry.adventure.health,chosen:entry.adventure.chosen};
}
