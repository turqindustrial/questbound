import {mapLocation,placeName,worldPlaces,mapRegions,distanceText,placeCoordinates} from './mapRules';
import {npcIdsOf,npcLore} from './npcRules';
import {dungeonRooms} from './dungeonRules';
import {appendStoryLog} from './journalRules';
import {packOf} from './inventoryRules';
// The story so far: one short line for every thing that mattered (a place reached, someone met, a fight and how it
// ended, a death, a debt or a grudge, gold and finds, rests, levels, the end of the tale). Each line is worked out
// by comparing the adventure before and after a turn, so nothing depends on how the Dungeon Master told it, and a
// turn that is taken back takes its lines with it. The Log tab shows it; the journal keeps the long form.
const clip=(text,max=150)=>{const t=String(text??'').replace(/\s+/g,' ').trim();return t.length>max?t.slice(0,max-1).trimEnd()+'…':t;};
const nameOf=(game,id)=>npcLore(game,id)?.name??id;
const foeName=game=>game.dungeon?.active?dungeonRooms[game.dungeon.room]?.foe??'the guardian':game.wildFight?.name??game.story?.foe??'Lantern Wisp';
const the=name=>/^(the|a|an) /i.test(name)?name:'the '+name;
const list=names=>names.length<=1?names.join(''):names.slice(0,-1).join(', ')+' and '+names.at(-1);
// What one turn added to the story: [kind, text] pairs, in the order they happened.
export function storyEvents(before,after,hero,{action=null}={}){
 const lines=[],add=(kind,text)=>lines.push([kind,text]);
 if(!before||!after||before===after)return lines;
 // A different tale altogether is recorded by whoever started it.
 if((before.story?.id??null)!==(after.story?.id??null))return lines;
 const here=mapLocation(after),was=mapLocation(before),placeNow=placeName(after,here),visitedBefore=new Set(before.map?.visited??[]);
 // ---- New places and new lands ----
 const knownBefore=new Set(worldPlaces(before).map(p=>p.id)),found=worldPlaces(after).filter(p=>!knownBefore.has(p.id));
 const landsBefore=new Set(mapRegions(before).map(r=>r.id));
 for(const land of mapRegions(after))if(!landsBefore.has(land.id))add('place','Set out for a new land: '+land.name+'.');
 for(const p of found){
  if(p.id===here)continue;
  const from=placeCoordinates(after,p.from),feet=from?Math.round(Math.hypot(p.x-from.x,p.y-from.y)):0;
  add('place','Learned of '+p.name+(feet?', '+distanceText(feet)+' from '+placeName(after,p.from):'')+'.');
 }
 // ---- Travel ----
 // How a fight that ended this turn went: the hero fell, won (the creature's place is cleared, the guardian's room
 // is open, the foe has no hit points left) or got away.
 const ended=before.stage==='combat'&&after.stage!=='combat',down=['dying','dead','defeat'].includes(after.stage);
 const won=ended&&!down&&(before.wildFight?!!worldPlaces(after).find(p=>p.id===before.wildFight.place)?.cleared:before.dungeon?.active?after.stage==='dungeon':after.stage==='victory'||after.enemyHP===0);
 const fled=ended&&!down&&!won;
 if(here!==was&&!['dying','dead','defeat','escaped'].includes(after.stage)&&!fled){
  if(after.dungeon?.active&&!before.dungeon?.active)add('travel','Went down into the Lantern Vaults.');
  else if(!after.dungeon?.active&&before.dungeon?.active)add('travel','Came back up from the Lantern Vaults.');
  else if(found.some(p=>p.id===here))add('place','Found '+placeNow+'.');
  else add('travel',(visitedBefore.has(here)?'Returned to ':'Reached ')+placeNow+(visitedBefore.has(here)?'':' for the first time')+'.');
 }
 // ---- People ----
 for(const id of Object.keys(after.people??{}))if(!before.people?.[id]){const p=after.people[id],role=clip(String(p.role??'').split(/[,;:(]| who | that | which | at the | in the | from the /)[0].replace(/[.\s]+$/,''),44);add('person','Met '+p.name+(role?', '+role[0].toLowerCase()+role.slice(1):'')+'.');}
 for(const id of npcIdsOf(after)){
  const name=nameOf(after,id),f0=before.followers?.[id]?.status,f1=after.followers?.[id]?.status;
  if(f1==='following'&&f0!=='following')add('person',name+' joined you.');
  else if(f0==='following'&&f1==='waiting')add('person',name+' stayed behind to wait.');
  else if(f0==='following'&&f1&&f1!=='following')add('person',name+' left your company.');
  const fate0=before.npcFate?.[id],fate1=after.npcFate?.[id],struck=(after.actionEvents??[]).length>(before.actionEvents??[]).length&&after.actionEvents.at(-1)?.target===id;
  if(fate1==='dead'&&fate0!=='dead')add('death',struck?'You killed '+name+'.':name+' was killed.');
  else if(fate1==='unconscious'&&fate0!=='unconscious')add('deed',struck?'You knocked '+name+' senseless.':name+' was struck down.');
  else if(fate0==='unconscious'&&!fate1)add('deed',name+' came round.');
  const m0=before.npcMemory?.[id],m1=after.npcMemory?.[id];
  if(m1?.grudge&&!m0?.grudge)add('deed',name+' swore never to forgive you.');
  else if(m1?.bond&&!m0?.bond)add('deed',name+' owes you a debt for life.');
  else if(m1&&m1.attitude!==(m0?.attitude??'indifferent')&&fate1!=='dead'){
   if(m1.attitude==='hostile')add('deed',name+' turned against you.');
   else if(m1.attitude==='unfriendly'&&['indifferent','friendly','devoted'].includes(m0?.attitude??'indifferent')&&(!after.people?.[id]||before.people?.[id]))add('deed',name+' turned cold toward you.');
   // Won over by a deed, not simply well met: they were known before this turn.
   else if(m1.attitude==='friendly'&&['hostile','unfriendly','indifferent'].includes(m0?.attitude??'indifferent')&&(!after.people?.[id]||before.people?.[id]))add('deed','You won '+name+' over.');
  }
 }
 // ---- Fights ----
 if(after.npcCombat?.active&&!before.npcCombat?.active){const foes=after.npcCombat.order.filter(n=>n.side==='enemy').map(n=>nameOf(after,n.id));add('fight','A fight broke out'+(foes.length?' with '+list(foes):'')+' at '+placeNow+'.');}
 if(after.stage==='combat'&&before.stage!=='combat')add('fight','Fought '+the(foeName(after))+' at '+placeName(after,mapLocation(after))+'.');
 if(ended){
  // Spared: the hero set out to knock it down, and the game's own lines say it lies beaten but alive.
  const foe=the(foeName(before)),spared=(after.foeFate==='subdued'&&before.foeFate!=='subdued')||(after.log??[]).slice(0,8).some(t=>/beaten but alive|drops senseless/.test(t));
  if(after.stage==='defeat')add('fall','Was beaten by '+foe+' and carried to safety.');
  else if(down)add('fall','Fell to '+foe+'.');
  else if(fled)add('flight','Fled from '+foe+'.');
  else add('victory',before.dungeon?.active?'Defeated '+foe+'.':(spared?'Beat '+foe+' and spared it':'Slew '+foe)+'.');
 }
 // ---- Falling, holding on, dying ----
 if(after.stage==='dying'&&before.stage!=='dying'&&before.stage!=='combat')add('fall','Fell, dying, at '+placeNow+'.');
 if(before.stage==='dying'&&!['dying','dead'].includes(after.stage))add('fall','Clung to life and woke at '+placeNow+'.');
 if(after.stage==='dead'&&before.stage!=='dead')add('death','Died'+(after.death?.place?' at '+after.death.place:'')+(after.death?.cause?': '+String(after.death.cause).replace(/[.\s]+$/,'')[0].toLowerCase()+String(after.death.cause).replace(/[.\s]+$/,'').slice(1):'')+'.');
 // ---- Gold and finds ----
 if(before.pack||after.pack){
  const g0=packOf(before,hero).gold,g1=packOf(after,hero).gold;
  if(Number.isInteger(g0)&&Number.isInteger(g1)&&g1!==g0)add('loot',(g1>g0?'Gained '+(g1-g0):'Paid '+(g0-g1))+' gold.');
  const had=Object.fromEntries((before.pack?.items??[]).map(i=>[i.name,i.qty])),has=Object.fromEntries((after.pack?.items??[]).map(i=>[i.name,i.qty]));
  const gained=Object.keys(has).filter(n=>n!=='Arrow'&&has[n]>(had[n]??0)).map(n=>(has[n]-(had[n]??0)>1?(has[n]-(had[n]??0))+' × ':'')+n),lost=Object.keys(had).filter(n=>n!=='Arrow'&&(has[n]??0)<had[n]);
  if(gained.length)add('loot','Got '+list(gained)+'.');
  if(lost.length)add('loot','Gave up '+list(lost)+'.');
 }
 if((after.potions??0)>(before.potions??0)&&action!=='long-rest')add('loot','Got '+((after.potions-before.potions)===1?'a healing draught':(after.potions-before.potions)+' healing draughts')+'.');
 // ---- Rests, the errand, the end of the tale ----
 if(action==='long-rest'&&after!==before)add('rest','Took a long rest at '+placeNow+'.');
 if(action==='short-rest'&&(after.shortRests??0)>(before.shortRests??0))add('rest','Took a short rest at '+placeNow+'.');
 // A long tale: a chapter finished (the next opens under its own heading) and leads seen through.
 if(after.story?.chapters&&(after.story.chapter??0)>(before.story?.chapter??0)){const c=after.story.chapters,n=before.story?.chapter??0;add('quest','Finished chapter '+(n+1)+': '+c[n].title+'.');add('story','Chapter '+(after.story.chapter+1)+': '+c[after.story.chapter].title);}
 for(const l of after.story?.leads??[])if(l.done&&!before.story?.leads?.find(x=>x.id===l.id)?.done)add('quest','Saw a lead through: '+l.title+'.');
 if((after.levelsOwed??0)>(before.levelsOwed??0))add('level','Earned a level on the road.');
 if(after.story&&before.story?.status==='active'&&after.story.status==='complete')add('quest','Adventure complete: '+after.story.title+'.');
 // The crossroads adventure tells its own milestones in its journal.
 if(!after.story){const old=before.journal?.entries?.length??0;for(const e of (after.journal?.entries??[]).slice(old))if(['quest','outcome'].includes(e.kind)&&!/^Journey to /.test(e.title))add('quest',e.title+'.');}
 return lines;
}
export function withStoryLog(before,after,hero,options){
 const lines=storyEvents(before,after,hero,options);
 if(!lines.length)return after.storyLog||!before?.storyLog?after:{...after,storyLog:before.storyLog};
 let log=after.storyLog??before.storyLog??[];
 for(const [kind,text] of lines)log=appendStoryLog(log,kind,text);
 return {...after,storyLog:log};
}
