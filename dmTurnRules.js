// Pure pieces of a turn with the Dungeon Master (useDmTurn.js plays the turn): what the request carries, what a reply
// must hold, what goes into the turn the device records, and how a failed turn is worded. No I/O, no React: the checks
// load this file beside the rules (rules-files.cjs helperFiles).
import {storyText} from './storyRules';
import {dmContext,partyOthers} from './dmContext';
import {combatBasics} from './combatRules';
import {gearedHero,packOf} from './inventoryRules';
import {conversationPeople,speakingPeople} from './playbackRules';
import {suggestionPossible} from './suggestionRules';
import {dmCommand,withAttackIntent} from './dmCommands';
import {adventureStep} from './adventureRules';
import {dmChoices} from './dmChoiceRules';
import {npcScene,npcLore,npcIdsOf} from './npcRules';
import {knownPlaceIds,placeName,mapRegions} from './mapRules';
import {knownSpells,spellCostOptions} from './spellRules';
import {spellLibrary} from './spellOptions';
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
// What the game knows that a suggestion may name (suggestionRules.js reads the same shape from the Dungeon Master's
// scene): who is here and who is known, the places and lands, this hero's spells and what is left to cast them with,
// the draughts and things carried, and the choices on offer (rests among them).
export function ideaFacts(hero,game,health){
 const name=id=>npcLore(game,id)?.name??null;
 return {stage:game.stage,npcCombat:game.npcCombat??null,choices:dmChoices(hero,game,health).map(c=>({id:c.id,label:c.label})),
  nearbyNPCs:npcScene(game).filter(n=>n.present&&(n.hp??1)>0).map(n=>({name:name(n.id)??n.name})),party:partyOthers(game).filter(m=>m.status!=='dead').map(m=>({name:m.name})),
  npcSocialState:npcIdsOf(game).map(id=>({name:name(id)})).filter(n=>n.name),
  spellReference:knownSpells(hero).map(s=>({name:s.name,level:s.level,availableCosts:spellCostOptions(hero,game,s)})),
  inventory:{healingDraughts:game.potions??0,found:packOf(game,hero).items??[]},
  world:{knownPlaces:knownPlaceIds(game).map(id=>({name:placeName(game,id)})),regions:mapRegions(game).map(r=>r?.name).filter(Boolean)}};
}
// The suggestions this hero can act on now: the shared rule (suggestionRules.js), then the game's own reading of the
// words: a move the rules would refuse (no draught, no slot left, a spell not known, not this hero's turn) is dropped.
// Talk, questions and plans stay. Used for the Dungeon Master's suggestions and the stand-ins alike (DungeonMaster.js).
export function possibleIdeas(hero,game,health,lines){
 const list=(Array.isArray(lines)?lines:[]).filter(t=>typeof t==='string'&&t.trim());if(!list.length||!hero||!game)return list;
 let facts;try{facts=ideaFacts(hero,game,health);}catch{return list;}
 const names=spellLibrary.map(s=>s.name);
 return list.filter(t=>{
  if(!suggestionPossible(t,facts,names))return false;
  let command=null;try{command=dmCommand(hero,game,t,health);}catch{return true;}
  if(command?.error)return !!command.soft&&!/prepared spells/.test(command.error);
  if(command?.action){try{const r=adventureStep(withAttackIntent(game,t),health,hero,command.action,()=>0.5);return !r?.error;}catch{return false;}}
  return true;
 });
}
// A failed turn in the player's words; a scene that moved on, or an adventure that was closed, is not a problem.
export const turnFailureMessage=(game,e)=>e?.name==='TimeoutError'?'The DM took too long. Nothing was applied.':storyText(game,String(e?.message??e));
export const benignTurnFailure=message=>/scene changed|adventure was closed/i.test(message);
