// What a new tale asks the story writer for (App.js playCharacter keeps the effects: the request itself, the save and
// the screens): where the earlier world lies from the next tale, the opening and any ready journey, the request's words and context,
// and the titles the hero has lived. Pure: nothing here asks, saves or shows anything.
import {taleStart} from './storyPreferences';
import {fateJourney} from './journeyLibrary';
import {writtenIdOf,fateWritten} from './shelfRules';
import {nextTalePlacement} from './sequelRules';
import {hasTale} from './storyRules';
import {isPartyGame} from './partyRules';
import {newAdventure} from './adventureRules';
import {carriedBase} from './sequelRules';
import {adventureSnapshot} from './adventureStorage';
// The next tale of a hero with a story: the earlier world joins the new map (sequelRules.js joinRegion, anchored where the
// hero stands) on a bearing by chance, a few miles away (near: 4 to 7 miles; the next tale here, or a tale in a land the
// hero has reached) or days away (far: 60 to 200 miles; somewhere new, a written tale or a ready journey).
export const sequelPlacement=(random=Math.random,{far=false}={})=>nextTalePlacement(random,{far});
export function taleChoice({selectedIntro,continuing,idea,easyStart,journeysOnOffer,written=null}){
  // The player's own idea: the whole brief for Your own tale, an optional wish for the next tale in a region.
  const wish=(continuing||selectedIntro==='idea')&&idea.trim()?idea.trim().slice(0,300):null;
  if(!continuing&&selectedIntro==='idea'&&!wish)throw Error('Write your idea for the tale first.');
  // Easy start (on unless the player turned it off): orders in hand for any opening; Let fate decide becomes Easy to get into.
  const start=taleStart({selected:selectedIntro,continuing,easyStart});
  // A ready journey (the one chosen, or one by chance for Let fate decide) starts at once: the player's own copy,
  // with its orders in hand (asked for as Easy to get into).
  // A written tale from the shelf (the one chosen, or for Let fate decide one this device has not played, from the open
  // tab) starts at once too, by its id; it is kept as introId 'written'. `written`: {cards, records, tab, titles, current}.
  const shelfCards=written?.cards??[],chosenWritten=continuing?null:writtenIdOf(selectedIntro),fated=!continuing&&!chosenWritten&&selectedIntro==='surprise'&&shelfCards.length?fateWritten(shelfCards,written):null;
  const writtenCard=chosenWritten?shelfCards.find(c=>c.id===chosenWritten)??{id:chosenWritten}:fated;
  if(writtenCard)return {wish:null,start:{...start,introId:'written',easyStart:false},journeyId:writtenCard.id,introId:'written',written:writtenCard};
  const offered=journeysOnOffer??[],journeyId=continuing?null:String(selectedIntro).startsWith('journey:')?String(selectedIntro).slice(8):selectedIntro==='surprise'&&offered.length?fateJourney(offered).id:null,introId=journeyId?'easy':start.introId;
  return {wish,start,journeyId,introId,written:null};
}
// The story writer's request: the opening asked for, the idea, and for a tale beside the land where the hero stands
// (the next tale here, or a tale waiting in a land beyond the map) that land's name and terrain with the tales this
// device has begun (`playedTales`): the Dungeon Master first starts one already written for that land (the shelf's or
// the compendium's) and writes one only when none fits (dm-server.cjs taleMatch). Every tale is written so that any
// hero can play it and it joins the compendium (the 2026-10-23 campaign), so neither the hero nor their story so far is
// sent: the hero's history reaches the Dungeon Master in play (memoryRules.js), and the earlier world joins the new map
// on the device (sequelRules.js joinRegion).
export const taleRequest=({game,continuing,wish,journeyId,introId,start,written=null,land=null,playedTales=[]})=>({input:continuing||land?'Create the next tale of my character’s journey, beside the land where they stand.':'Create a fresh adventure for my character.',context:{mode:'adventure',introId,...(written?{journey:journeyId}:journeyId?{journey:journeyId,easyStart:true}:start.easyStart?{easyStart:true}:{}),...(wish?{idea:wish}:{}),...(land?{land:{name:land.name,terrain:land.terrain},playedTales:(Array.isArray(playedTales)?playedTales:[]).slice(-200)}:{}),choices:[],previousStory:game.story?{title:game.story.title,premise:game.story.premise}:null,previousTitles:game.storyHistory??[],variation:Date.now()+'-'+Math.random()}});
// A tale the hero has already lived (the writer repeated one), and the titles lived once the new one begins.
export const taleRepeats=(game,next)=>[...(game.storyHistory??[]),game.story?.title].filter(Boolean).some(title=>title.toLowerCase()===next.story.title.toLowerCase());
export const taleHistory=(game,next)=>[...new Set([...(game.storyHistory??[]),game.story?.title,next.story.title].filter(Boolean))].slice(-100);
// Where playing leads (App.js: Continue, Play, and any game screen): the adventure itself only with a tale (storyRules.js
// hasTale). A hero with none (a new hero, or an old save from the crossroads tale of the first builds) chooses one on
// the New Adventure screen; with no hero, the heroes. At a shared table, a player without a hero of their own there,
// or at a table whose host has not yet chosen its tale, waits on the table screen.
export function playScreenFor({hero,game,characterChosen,table}){
 if(table?.joined)return table.needsHero||table.needsTale||!hasTale(game)?'Multiplayer':'Adventure';
 if(!hero)return 'Character Selection';
 if(characterChosen&&hasTale(game))return 'Adventure';
 return game?.stage==='dead'?'Character Selection':'Adventure Opening';
}
// What a hero brings to a shared table (campaigns.cjs join and create): their adventure as it stands when it is a
// written tale under way; otherwise (no tale, the Skirmish) a fresh start carrying what they carry into any next tale.
// A table opened that way has no tale yet, and its host chooses one for everyone.
export function tableSnapshot({hero,game,health,chosen}){
 // A hero who is dying or dead brings that state (the table refuses them: they cannot travel now).
 if(hasTale(game)&&game.story.introId!=='hostile'&&!isPartyGame(game)||['dead','dying'].includes(game?.stage))return adventureSnapshot(hero,game,health,chosen);
 return adventureSnapshot(hero,newAdventure(hero,chosen?carriedBase(game):undefined),null,true);
}
