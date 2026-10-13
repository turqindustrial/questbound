import AsyncStorage from './playerStorage';
import {isValidCharacter} from './characterStorage';
import {validAdventure,adventureSnapshot} from './adventureStorage';
import {placeName,mapLocation} from './mapRules';
import {upgradeCharacter,upgradeAdventure,sameHeroText} from './saveMigrations';
// Your company of heroes on this device. Starting another hero no longer throws the current one away: a living hero
// is set aside in the roster with their adventure exactly as it was (switch back any time), and a hero who died is
// remembered in the graveyard with how and where they fell. A grave is a memorial line only (name, species, class,
// level, the tale and how they fell): no sheet and no save, so the fallen can never be played again. Graves written
// before this kept the hero's sheet; it is dropped when the graveyard is read.
const ROSTER_KEY='questbound.roster.v1',GRAVES_KEY='questbound.graveyard.v1';
export const maxRoster=8,maxGraves=40;
const rosterText=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
export function rosterEntry(hero,game,health,chosen,now=Date.now()){
 return {id:now.toString(36)+Math.random().toString(36).slice(2,7),savedAt:new Date(now).toISOString(),character:JSON.stringify(hero),adventure:adventureSnapshot(hero,game,health,!!chosen),
  summary:{name:hero.name,level:hero.level,species:hero.species??hero.race,class:hero.class,story:game.story?.title??null,place:game.story?placeName(game,mapLocation(game)):null}};
}
export function graveEntry(hero,game,now=Date.now()){
 return {name:String(hero.name).slice(0,60),level:hero.level,species:String(hero.species??hero.race??'').slice(0,60),class:hero.class,cause:String(game.death?.cause??'Fell on the road').slice(0,300),place:game.death?.place?String(game.death.place).slice(0,100):null,story:game.story?.title?String(game.story.title).slice(0,100):null,at:new Date(now).toISOString()};
}
// The same fall, written twice (a reload while the epitaph was showing): one grave.
const sameGrave=(a,b)=>a.name===b.name&&a.level===b.level&&a.class===b.class&&a.cause===b.cause&&a.place===b.place&&a.story===b.story;
const memorial=g=>{const {character,...line}=g;return line;};
// A hero who has died and cannot be brought back (deathRules.js deathIsFinal) is laid to rest: a grave for them, and
// out of the roster if they were ever set aside there. The caller then removes the hero and their adventure from
// the save (App.js).
export function layToRest(roster,graves,hero,game,now=Date.now()){
 const character=JSON.stringify(hero),grave=graveEntry(hero,game,now);
 return {roster:roster.filter(e=>!sameHeroText(e.character,character)),graves:graves.some(g=>sameGrave(g,grave))?graves:[grave,...graves].slice(0,maxGraves)};
}
export function validRosterEntry(e){
 try{const hero=JSON.parse(e.character);return rosterText(e.id,40)&&rosterText(e.savedAt,40)&&isValidCharacter(hero)&&e.adventure?.character===e.character&&validAdventure(e.adventure,hero)&&e.adventure.game.stage!=='dead'&&!!e.summary&&rosterText(e.summary.name,60);}catch{return false;}
}
export function validGrave(g){
 return !!g&&rosterText(g.name,60)&&Number.isInteger(g.level)&&g.level>=1&&g.level<=20&&rosterText(g.class,60)&&rosterText(g.cause,300)&&(g.place===null||rosterText(g.place,100))&&(g.story===null||rosterText(g.story,100))&&rosterText(g.at,40)&&(g.character===undefined||typeof g.character==='string');
}
async function readList(key,valid){
 const raw=await AsyncStorage.getItem(key);if(raw===null)return [];
 const list=JSON.parse(raw);return Array.isArray(list)?list.filter(valid):[];
}
export const loadRoster=()=>readList(ROSTER_KEY,validRosterEntry);
export const loadGraveyard=()=>readList(GRAVES_KEY,validGrave).then(list=>list.map(memorial));
// Set the current hero aside before another takes their place. Returns the updated roster and graveyard (or an error
// when the roster is full, so nothing is lost).
export function setAside(roster,graves,hero,game,health,chosen,now=Date.now()){
 if(!hero)return {roster,graves};
 const character=JSON.stringify(hero);
 if(game?.stage==='dead')return layToRest(roster,graves,hero,game,now);
 const others=roster.filter(e=>!sameHeroText(e.character,character));
 if(others.length>=maxRoster)return {error:'Your company already has '+maxRoster+' heroes waiting. Retire one under Heroes first.'};
 return {roster:[rosterEntry(hero,game,health,chosen,now),...others],graves};
}
export async function saveLists({roster,graves}){
 await AsyncStorage.setItem(ROSTER_KEY,JSON.stringify(roster));
 await AsyncStorage.setItem(GRAVES_KEY,JSON.stringify(graves));
}
// The hero, adventure and health to restore from a roster entry, upgraded to the current save format when the
// upgraded copy passes the save checks (saveMigrations.js), else as they were set aside. `adventure` is the snapshot
// to save for them.
export function restoreEntry(entry){
 if(!validRosterEntry(entry))throw Error('That hero\'s save could not be read. They stay in your roster.');
 const hero=JSON.parse(entry.character),newer=upgradeCharacter(hero),adventure=upgradeAdventure(entry.adventure);
 const use=adventure!==entry.adventure&&isValidCharacter(newer)&&adventure.character===JSON.stringify(newer)&&validAdventure(adventure,newer)?{hero:newer,adventure}:{hero,adventure:entry.adventure};
 return {hero:use.hero,adventure:use.adventure,game:use.adventure.game,health:use.adventure.health,chosen:use.adventure.chosen};
}
