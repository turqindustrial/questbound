import {npcScene} from './npcRules';
import {mapState,mapLocation} from './mapRules';

// Tellings written ahead (2026-10-22, the host: "merge telling into first call"). When the Dungeon Master's reply
// starts something the dice or the road decide, the reply also writes what is told once it is decided: a check's two
// outcomes (check.outcomes), and the arrival at a place not yet visited beside the travel choice that goes there
// (arrival). Before this, every such move asked the Dungeon Master a second time only to tell its result. The device
// (useDmTurn.js) and the campaign server (server-turn.cjs) show the telling written ahead only when the rules turned out
// as it foresaw (nothing but the roll or the road happened: no fall, no fight, no ambush, nobody new joining in); in
// any other case they ask for the telling as before. Pure, so every device and the server agree.

const taFighting=g=>!!g&&(['combat','dying','dead','defeat'].includes(g.stage)||!!g.npcCombat?.active||!!g.turnOrder||!!g.wildFight||!!g.pendingSpell);
// Who can speak once the move is made: present, conscious people (the game refuses a line from anyone else).
export function presentAfter(game){return new Set(npcScene(game).filter(n=>n.present&&(n.hp??0)>0).map(n=>n.id));}
const taLines=(lines,game,max=4)=>{const here=presentAfter(game);return (Array.isArray(lines)?lines:[]).filter(l=>l&&here.has(l.speakerId)&&typeof l.text==='string'&&l.text.trim()).slice(0,max);};
const taJoin=(...parts)=>parts.map(p=>String(p??'').trim()).filter(Boolean).join(' ').slice(0,1700);

// A check the Dungeon Master asked for, told with the outcome the dice decided: the reply's opening of the attempt, then
// that outcome's telling, lines and how it touched someone. Null when the reply wrote no outcomes or the roll brought
// more than its own line (a fall, damage that broke concentration, a fight), so the telling is asked for as before.
export function checkTelling({before,preview,check,reply}){
 const outcomes=check?.outcomes;if(!outcomes||!preview||preview.error||!before)return null;
 const after=preview.game;if(!after||taFighting(before)||taFighting(after))return null;
 if(after.stage!==before.stage||(preview.health?.current??1)<=0)return null;
 const events=(preview.events??[]).map(t=>String(t??''));if(events.length!==1)return null;
 const verdict=/ vs DC \d+\. (Success|Failure)\. /.exec(events[0])?.[1];if(!verdict)return null;
 const told=verdict==='Success'?outcomes.success:outcomes.failure;
 if(!told||typeof told.narration!=='string'||!told.narration.trim())return null;
 return {narration:taJoin(reply?.narration,told.narration),dialogue:taLines(told.dialogue,after,2),relationships:Array.isArray(told.relationships)?told.relationships.slice(0,1):[],remember:[],loot:null,introduce:null,worldEvent:null,suggestions:[]};
}

// A move the Dungeon Master chose (its actionId) that the game cannot tell as a routine calm move (calmLines.js), told by
// that reply when it could foresee the outcome:
//  - a journey to a place not yet visited, with the arrival the reply wrote ahead (shown only when the road brought
//    nothing but the journey: no ambush or fight on arriving, the hero where it was going);
//  - taking up someone's offer to come along (the reply already told them joining).
// Null for anything else, and the telling is asked for as before.
export function aheadTelling({before,after,action,events=[],chosen}){
 if(!chosen||!before||!after||taFighting(before)||taFighting(after))return null;
 const said=String(chosen.narration??'').trim();if(!said)return null;
 const lines=(events??[]).map(t=>String(t??''));
 const keep=extra=>({narration:taJoin(said,extra?.narration),dialogue:taLines([...(Array.isArray(chosen.dialogue)?chosen.dialogue:[]),...(Array.isArray(extra?.dialogue)?extra.dialogue:[])],after),relationships:chosen.relationships??[],remember:chosen.remember??[],suggestions:chosen.suggestions??[],worldEvent:chosen.worldEvent??null,loot:null,introduce:null});
 if(action?.type==='travel'&&typeof action.destination==='string'){
  const arrival=chosen.arrival;if(!arrival||typeof arrival.narration!=='string'||!arrival.narration.trim())return null;
  if((mapState(before).visited??[]).includes(action.destination)||mapLocation(after)!==action.destination)return null;
  if(!lines.length||!lines.every(t=>/^You travel to .+\. [\d.,]+ (?:ft|miles?); .+ pass(?:es)?\.$/.test(t)))return null;
  return keep(arrival);
 }
 // A written tale's turning point the player's words chose (stagingRules.js): the reply that chose it told it.
 if(typeof action==='string'&&action.startsWith('tale-choice:'))return keep(null);
 if(action?.type==='accept-offer'&&typeof action.id==='string'){
  if(lines.length!==1||!presentAfter(after).has(action.id))return null;
  return keep(null);
 }
 return null;
}
