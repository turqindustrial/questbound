// What a new tale asks the story writer for (App.js playCharacter keeps the effects: the request itself, the save and
// the screens): where the next tale's region lies, the opening and any ready journey, the request's words and context,
// and the titles the hero has lived. Pure: nothing here asks, saves or shows anything.
import {taleStart} from './storyPreferences';
import {fateJourney} from './journeyLibrary';
import {regionSummary,sequelBearings} from './sequelRules';
import {storySoFarForWriter} from './memoryRules';
import {heroSpecies} from './characterRules';
// The next chapter in the same region: the story writer is told what the hero leaves behind, and the old region joins
// the new map a few miles away, on a bearing by chance.
export const sequelPlacement=()=>({bearing:sequelBearings[Math.floor(Math.random()*sequelBearings.length)],miles:4+Math.round(Math.random()*30)/10});
export function taleChoice({selectedIntro,continuing,idea,easyStart,journeysOnOffer}){
  // The player's own idea: the whole brief for Your own tale, an optional wish for the next tale in a region.
  const wish=(continuing||selectedIntro==='idea')&&idea.trim()?idea.trim().slice(0,300):null;
  if(!continuing&&selectedIntro==='idea'&&!wish)throw Error('Write your idea for the tale first.');
  // Easy start (on unless the player turned it off): orders in hand for any opening; Let fate decide becomes Easy to get into.
  const start=taleStart({selected:selectedIntro,continuing,easyStart});
  // A ready journey (the one chosen, or one by chance for Let fate decide) starts at once: the player's own copy,
  // with its orders in hand (asked for as Easy to get into).
  const offered=journeysOnOffer??[],journeyId=continuing?null:String(selectedIntro).startsWith('journey:')?String(selectedIntro).slice(8):selectedIntro==='surprise'&&offered.length?fateJourney(offered).id:null,introId=journeyId?'easy':start.introId;
  return {wish,start,journeyId,introId};
}
// The story writer's request: the opening asked for, the idea, the region continued, the story so far (never with a
// ready journey) and the hero.
export const taleRequest=({hero,game,characterChosen,continuing,bearing,wish,journeyId,introId,start})=>({input:continuing?'Create the next chapter of my character\'s journey in the same region.':'Create a fresh adventure for my character.',context:{mode:'adventure',introId,...(journeyId?{journey:journeyId,easyStart:true}:start.easyStart?{easyStart:true}:{}),...(wish?{idea:wish}:{}),...(continuing?{continuing:regionSummary(game,bearing)}:{}),...(()=>{const lived=!journeyId&&characterChosen&&game.story?storySoFarForWriter(game):null;return lived?{storySoFar:lived}:{};})(),choices:[],player:{name:hero.name,species:heroSpecies(hero),class:hero.class,level:hero.level,background:hero.background,backstory:hero.backstory},previousStory:game.story?{title:game.story.title,premise:game.story.premise}:null,previousTitles:game.storyHistory??[],variation:Date.now()+'-'+Math.random()}});
// A tale the hero has already lived (the writer repeated one), and the titles lived once the new one begins.
export const taleRepeats=(game,next)=>[...(game.storyHistory??[]),game.story?.title].filter(Boolean).some(title=>title.toLowerCase()===next.story.title.toLowerCase());
export const taleHistory=(game,next)=>[...new Set([...(game.storyHistory??[]),game.story?.title,next.story.title].filter(Boolean))].slice(-100);
