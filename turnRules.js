import {commitDmTurn} from './dmContext';
import {adventureStep} from './adventureRules';
import {withExperience} from './experienceRules';
import {recordedTurn} from './playbackRules';
import {withSceneTrigger} from './sceneTriggers';
import {withStoryLog} from './storyLog';
import {withDeeds} from './deedRules';
import {withMemory} from './memoryRules';

// One turn settled the same way everywhere: on the device when playing alone (Adventure.act) and on the campaign
// server at a shared table (server-turn.cjs, through rules-engine.cjs). The rules see `ruled` (the hero with this
// device's settings, such as autoShield); everything recorded uses the plain hero, so a setting is never saved.
// Order: the rules (with the Dungeon Master's words when there are any), experience for every living hero, the turn
// recorded for the feed, the scene cue (devices only), the story log, the deeds that log earns, then the story log
// folded into the lasting memory (memoryRules.js).
export function settleTurn({hero,ruled=hero,game,health,action=null,conversation=null,random=Math.random,sceneTrigger=true}){
 let result=conversation?commitDmTurn(ruled,game,health,action,conversation,random):adventureStep(game,health,ruled,action,random);
 if(result.error)return {error:result.error,result};
 const xp=withExperience(game,result.game,hero,{action});result={...result,game:xp.game,events:[...(result.events??[]),...xp.lines]};
 if(conversation)result=recordedTurn(hero,game,health,result,result.conversation??conversation,conversation.npcId??null);
 result={...result,game:{...result.game}};delete result.game.sceneCue;
 // The moment's cue is played only if those it would have speak first did not already speak in this turn.
 if(sceneTrigger&&!conversation?.trigger&&!conversation?.direct)result.game=withSceneTrigger(game,result.game,action,result.turn??null);
 result.game=withStoryLog(game,result.game,hero,{action});
 const marked=withDeeds(result.game,hero);result.game=marked.game;
 result.game=withMemory(result.game);
 return {result,xp,fresh:marked.fresh??[]};
}
