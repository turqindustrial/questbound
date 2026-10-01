import {conversationPeople} from './playbackRules';
import {mapLocation,placeName,placeDescription} from './mapRules';
// Engine-detected moments where present characters speak first. Each trigger fires once per adventure.
const place=(game,id)=>placeName(game,id);
const foe=game=>game.story?.foe??'Lantern Wisp';
export function sceneTrigger(before,after,action){
 if(!after||after===before||after.pendingSpell||after.npcCombat?.active)return null;
 const speakers=conversationPeople(after);if(!speakers.length)return null;
 const fired=after.firedTriggers??[],from=mapLocation(before),to=mapLocation(after),moved=from!==to&&after.stage!=='combat';
 const candidates=[];
 // Waking after being found dying: whoever carried the hero back speaks first (every time it happens).
 if(before.stage==='dying'&&after.stage==='inn')candidates.push({id:'wake',scene:'You wake at '+place(after,'inn')+'.',cue:'The player was found lying near death'+(before.dying?.placeName?' at '+before.dying.placeName:'')+' and carried back to '+place(after,'inn')+'. They have just woken with 1 HP, weak and battered. The residents react, tell how they found the player, and ask what happened.',fallback:'Easy — you\'re back with us. We found you half dead out there. What happened?'});
 if(before.stage==='combat'&&to==='inn')candidates.push({id:'retreat',scene:'You fall back to '+place(after,'inn')+'.',cue:'The player has just been driven back to '+place(after,'inn')+' after losing a fight with the '+foe(after)+' — they fled or were knocked out and carried back. The residents react, tend to them and ask what happened.',fallback:'Easy — sit down before you fall down. What happened out there?'});
 if(moved&&to==='inn'&&after.enemyHP===0)candidates.push({id:'return-victorious',scene:'You return to '+place(after,'inn')+'.',cue:'The player has just returned to '+place(after,'inn')+' after defeating the '+foe(after)+'. The residents react to seeing them again and ask about what happened.',fallback:'You made it back! Is it true — is the '+foe(after)+' really gone?'});
 if(moved&&to==='inn')candidates.push({id:'return-inn',scene:'You return to '+place(after,'inn')+'.',cue:'The player has just walked back into '+place(after,'inn')+' after being away. The residents notice and speak first, asking what they found or sharing news.',fallback:'You\'re back. What did you find out there?'});
 if(moved&&to!=='inn')candidates.push({id:'arrive:'+to,scene:'You arrive at '+place(after,to)+'.',cue:'The player and their companions have just arrived at '+place(after,to)+' for the first time: '+placeDescription(after,to)+' The companions react to what they see.',fallback:'So this is '+place(after,to)+'. Stay close — I don\'t like the look of it.'});
 if(before.stage==='combat'&&after.stage==='victory')candidates.push({id:'victory',scene:'The '+foe(after)+' falls.',cue:'The player has just defeated the '+foe(after)+' in combat. Companions who witnessed the fight react.',fallback:'It\'s over… that was closer than I\'d like. Are you hurt?'});
 if(action==='long-rest')candidates.push({id:'rest',scene:'Morning comes after a long rest.',cue:'The player wakes after a full night of rest at '+place(after,'inn')+'. The residents greet them in the morning.',fallback:'Morning. You slept like a stone — ready for another day of it?'});
 const trigger=candidates.find(t=>t.id==='wake'||!fired.includes(t.id));
 return trigger?{...trigger,speakerId:speakers[0].id}:null;
}
export function withSceneTrigger(before,after,action){
 const trigger=sceneTrigger(before,after,action);
 return trigger?{...after,sceneCue:trigger,firedTriggers:[...new Set([...(after.firedTriggers??[]),trigger.id])].slice(-20)}:after;
}
