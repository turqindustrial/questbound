// Pure pieces of a turn with the Dungeon Master (useDmTurn.js plays the turn): what the request carries, what a reply
// must hold, what goes into the turn the device records, and how a failed turn is worded. No I/O, no React: the checks
// load this file beside the rules (rules-files.cjs helperFiles).
import {storyText} from './storyRules';
import {dmContext} from './dmContext';
import {combatBasics} from './combatRules';
import {gearedHero} from './inventoryRules';
import {conversationPeople,speakingPeople} from './playbackRules';
// What the Dungeon Master is told with the player's words. turnStart tells the DM service the hero's hit points before
// this turn, so figures part-way through it check out.
export const turnRequestContext=({hero,scene,hp,input,health,preferences,talkingTo,alone,extra})=>{const most=combatBasics(gearedHero(hero,scene)).hp;return {...dmContext(hero,scene,hp,input),turnStart:{hp:health?.current??most,max:most},storyPreferences:preferences,conversationWith:talkingTo?{id:talkingTo.id,name:talkingTo.name,role:talkingTo.role,oneOnOne:alone&&conversationPeople(scene).length>1}:null,conversationParticipants:speakingPeople(scene).map(n=>({id:n.id,name:n.name,role:n.role,attitude:n.attitude})),...extra};};
// Why a reply cannot be used (null when it can): the service's own error, or a telling missing or too long.
export const dmReplyError=(ok,body)=>!ok?body.error||'The DM could not respond.':typeof body.narration!=='string'||!body.narration.trim()||body.narration.length>1800?'Invalid DM reply. Nothing was applied.':null;
// Out of character: whether the last turn can be taken back, and what it was (the player's words and what resolved).
export const outOfCharacterContext=(back,last)=>({canRewind:!!back,lastTurn:last?{said:last.events.find(e=>e.kind==='player')?.text??null,resolved:last.events.filter(e=>['initiative','roll','action','effect'].includes(e.kind)).map(e=>e.text).slice(0,30)}:null});
// The engine's lines for a resolved move, as the story names things, for the Dungeon Master to tell.
export const engineLines=(game,events)=>(events??[]).map(t=>storyText(game,t)).slice(0,40);
// What the device records for a turn the Dungeon Master told (Adventure.act's conversation).
export const turnRecord=(question,body,normalizedCommand,target)=>({question,narration:body.narration,dialogue:body.dialogue,worldEvent:body.worldEvent,relationships:body.relationships,remember:body.remember,loot:body.loot,introduce:body.introduce??null,normalizedCommand,npcId:target,...(body.told==='game'?{told:'game',fightRound:body.fightRound}:{})});
// The telling of a move the engine resolved after a recruitment or a check (no world event of its own).
export const toldReply=resolved=>({narration:resolved.narration,dialogue:resolved.dialogue,worldEvent:null,relationships:resolved.relationships,remember:resolved.remember,loot:resolved.loot,introduce:resolved.introduce,suggestions:resolved.suggestions});
// Things the player might say next, as the reply offers them (at most three).
export const suggestionLines=body=>(Array.isArray(body?.suggestions)?body.suggestions:[]).filter(t=>typeof t==='string'&&t.trim()).slice(0,3);
// A failed turn in the player's words; a scene that moved on, or an adventure that was closed, is not a problem.
export const turnFailureMessage=(game,e)=>e?.name==='TimeoutError'?'The DM took too long. Nothing was applied.':storyText(game,String(e?.message??e));
export const benignTurnFailure=message=>/scene changed|adventure was closed/i.test(message);
