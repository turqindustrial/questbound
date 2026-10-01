import {mapState,mapLocation,placeName,travelRoute,distanceText} from './mapRules';
// Journal and adventure share one save, so retries cannot duplicate events.
export function appendJournal(journal,kind,title,text) {
  const entry={id:journal.nextId,chapter:journal.chapter,kind,title,text};
  return {...journal,nextId:journal.nextId+1,entries:[...journal.entries,entry]};
}
export function journalForGame(game) {
  if(game.journal)return game.journal;
  const empty={version:1,chapter:1,nextId:1,entries:[]};
  const state={inn:'At the crossroads inn.',tower:'You are exploring the abandoned watchtower.',bridge:'The quest is underway at the bridge.',combat:'The Lantern Wisp encounter is underway.',victory:'The bridge light has been restored.',defeat:'The keeper rescued you after the encounter.',escaped:'You retreated from the bridge.',wild:'Exploring the wider region.',dying:'You lie dying.',dead:'Your hero has died.'}[game.stage]??'The adventure continues.';
  return appendJournal(empty,'checkpoint','Journal opened',`${state} Earlier events are not reconstructed; new milestones and confirmed DM rulings will be kept here.`);
}
export function beginJournal(previous) {
  if(!previous)return appendJournal({version:1,chapter:1,nextId:1,entries:[]},'quest','A new beginning','You arrive at the crossroads inn. Speak with the keeper about the missing bridge light.');
  const old=journalForGame(previous);
  return appendJournal({...old,chapter:old.chapter+1},'quest','A new journey','You return to the inn for another adventure. Your previous journal entries are preserved.');
}
export function recordJournalTransition(before,after,action,hero) {
  let journal=journalForGame(before);
  if(before.stage==='inn' && after.stage==='bridge' && ['study','listen'].includes(action))journal=appendJournal(journal,'quest','Restore the bridge light',action==='study'?'You studied the lantern and followed its blue sparks toward the bridge.':'You listened to the keeper and accepted the quest to restore the bridge light.');
  if(action?.type==='travel'){const route=travelRoute(before,mapLocation(before),action.destination);journal=appendJournal(journal,'quest','Journey to '+placeName(before,action.destination),`You followed the path: ${route.feet<1320?route.feet+' ft':distanceText(route.feet)}. ${route.minutes} minutes passed.`);}
  // A place the Dungeon Master revealed: noted on the map, and walked to when the hero set out for it.
  if(action?.type==='discover'&&(after.world?.places?.length??0)>(before.world?.places?.length??0)){const place=after.world.places.at(-1);journal=appendJournal(journal,'quest',(action.travel?'Journey to ':'Learned of ')+place.name,place.description);}
  if(action==='inspect-tower' && !mapState(before).clue && mapState(after).clue)journal=appendJournal(journal,'quest','The watchkeeper’s signal','Three notes: low, high, low. The lost light once guarded the crossing. Try calling it home at the bridge.');
  if(action==='call-wisp')journal=appendJournal(journal,'quest','A peaceful resolution','You used the three-note signal to guide the wisp home without a fight.');
  if(before.stage==='bridge' && after.stage==='combat')journal=appendJournal(journal,'encounter','The Lantern Wisp','A restless wisp guards the broken lamp. The encounter begins.');
  if(before.stage!==after.stage && ['victory','defeat','escaped'].includes(after.stage)){
    const details={victory:['Bridge light restored','The wisp settled into the lantern. The crossing is safe again.'],defeat:['Rescued by the keeper','You fell during the encounter. The keeper rescued you; the bridge remains dark.'],escaped:['Retreat from the bridge','You escaped to safety. The bridge light still needs to be restored.']}[after.stage];
    journal=appendJournal(journal,'outcome',...details);
  }
  if(action==='long-rest' && before.stage==='inn')journal=appendJournal(journal,'rest','A long rest','You rested at the inn and recovered your HP and casting resources.');
  if(action?.type==='spell-ruling' && before.pendingSpell && !after.pendingSpell){
    journal=appendJournal(journal,'ruling','DM ruling recorded',`Spell: ${before.pendingSpell.id}\nIntent: ${before.pendingSpell.intent}\n${after.log.slice(0,6).join('\n')}`);
  }
  return {...after,journal};
}
export function addJournalNote(game,text) {
  if(typeof text!=='string' || !text.trim() || text.length>2000)return game;
  return {...game,journal:appendJournal(journalForGame(game),'note','Player note',text.trim())};
}
export function journalObjective(stage,map,campaign) {
  if(campaign?.lensQuest==='active')return 'Recover the signal lens beneath the watchtower bell.';
  if(campaign?.lensQuest==='found')return 'Bring the signal lens to the keeper at the inn.';
  if(campaign?.lensQuest==='complete')return 'Completed: the bridge light and signal beacon are restored.';
  if(stage==='inn' && map?.accepted)return 'Restore the bridge light. Follow the map to the bridge or investigate the watchtower.';
  if(stage==='bridge' && map?.clue)return 'Use the watchkeeper’s signal to call the wisp home, or approach it in combat.';
  return {tower:'Investigate the watchtower for a clue to the missing bridge light.',inn:'Speak with the keeper at the crossroads inn.',bridge:'Follow the sparks and investigate the broken bridge lamp.',combat:'Resolve the Lantern Wisp encounter to restore the bridge light.',victory:'Completed: restore the bridge light.',defeat:'Unfinished: restore the bridge light. Recover and begin another attempt.',escaped:'Unfinished: restore the bridge light. Return when you are ready.'}[stage];
}
export function validJournal(journal) {
  if(!journal || journal.version!==1 || !Number.isSafeInteger(journal.chapter) || journal.chapter<1 || !Number.isSafeInteger(journal.nextId) || !Array.isArray(journal.entries) || journal.nextId!==journal.entries.length+1)return false;
  return journal.entries.every((e,i)=>e && e.id===i+1 && Number.isSafeInteger(e.chapter) && e.chapter>=1 && e.chapter<=journal.chapter && (i===0 || e.chapter>=journal.entries[i-1].chapter) && ['quest','checkpoint','encounter','outcome','rest','ruling','note','level'].includes(e.kind) && typeof e.title==='string' && e.title.length>0 && e.title.length<=100 && typeof e.text==='string' && e.text.length>0 && e.text.length<=3000);
}
