import {npcIdsOf,npcLore,isPersonId,maxPeople,personToughness,coreNpcIds} from './npcRules';
import {coreIds,mapCoordinates,bearings,worldPlaces,placeKinds,maxWorldPlaces} from './mapRules';
import {appendJournal} from './journalRules';
// A hero's next story. Continuing in the same region, everything the hero knows comes along: the earlier story's
// places join the map (a few miles off, joined to the new starting place by a road), and its people, everyone met
// since, their memories, grudges, debts and fates carry over (the earlier residents become people met along the
// way). Setting out somewhere new, only the hero's companions and pack come along. Gold, draughts and training
// always stay with the hero.
export const sequelBearings=Object.keys(bearings);
export const oldPlaceLimit=18;
// What a new story starts from: the hero's own things, nothing tied to the old region.
export function carriedBase(previous){
 return {...(previous?.pack?{pack:previous.pack}:{}),potions:Math.max(1,previous?.potions??1),...(previous?.skillTraining?{skillTraining:previous.skillTraining}:{})};
}
// Can the hero carry on where they are? A written story, a living hero, and not in the middle of a fight.
export function canContinueRegion(game){
 return !!game?.story&&!['dying','dead','combat'].includes(game.stage)&&!game.npcCombat?.active&&!game.wildFight&&!game.dungeon?.active;
}
// What the story writer is told about the region the hero is coming from.
export function regionSummary(game,bearing){
 const s=game.story,people=npcIdsOf(game).filter(id=>s.npcs[id]||game.people?.[id]);
 return {previousTitle:s.title,previousPremise:s.premise,outcome:s.status==='complete'?'completed':'left unfinished',foe:s.foe,foeFate:game.foeFate??(game.enemyHP===0?'defeated':'still at large'),
  newStartBearing:'The new starting place lies a few miles '+({N:'south',NE:'south-west',E:'west',SE:'north-west',S:'north',SW:'north-east',W:'east',NW:'south-east'}[bearing])+' of '+s.locations.inn.name+'.',
  places:[...coreIds.map(id=>s.locations[id].name),...worldPlaces(game).map(p=>p.name)].slice(0,24),
  people:people.map(id=>{const m=game.npcMemory?.[id],lore=npcLore(game,id);return {name:lore.name,role:lore.role,alive:game.npcFate?.[id]!=='dead',feelingAboutHero:m?.grudge?'sworn enemy':m?.bond?'owes the hero a debt':m?.attitude??'indifferent',travelsWithHero:game.followers?.[id]?.status==='following'};}).slice(0,14)};
}
const kindOf={inn:'settlement',bridge:'road',tower:'landmark'};
// Join the earlier region onto a freshly written story (next = freshStoryGame(...)). bearing: where the earlier
// region lies from the new starting place.
export function joinRegion(next,previous,{sameRegion,bearing='N',miles=5}){
 if(!previous?.story)return next;
 const old=previous.story,ids=npcIdsOf(previous),fate=previous.npcFate??{},follow=previous.followers??{};
 const taken=new Set([...Object.values(next.story.locations).map(l=>l.name.trim().toLowerCase())]);
 const unique=name=>{let n=name.trim().slice(0,60),k=n.toLowerCase();if(taken.has(k)){n=('Old '+n).slice(0,60);k=n.toLowerCase();}if(taken.has(k))return null;taken.add(k);return n;};
 // ---- Places ----
 const placeMap={},places=[];
 if(sameRegion){
  const [dx,dy]=bearings[bearing]??bearings.N,shift={x:Math.round(dx*miles*5280),y:Math.round(dy*miles*5280)};
  const add=(from,src,extra={})=>{if(places.length>=Math.min(oldPlaceLimit,maxWorldPlaces))return;const name=unique(src.name);if(!name)return;const id='p'+(places.length+1);places.push({id,name,description:String(src.description).trim().slice(0,300),kind:src.kind,x:src.x+shift.x,y:src.y+shift.y,from,...extra});return id;};
  // The earlier starting place is joined to the new one; its two neighbours to it.
  placeMap.inn=add('inn',{name:old.locations.inn.name,description:old.locations.inn.description,kind:kindOf.inn,...mapCoordinates.inn});
  for(const id of ['bridge','tower'])if(placeMap.inn)placeMap[id]=add(placeMap.inn,{name:old.locations[id].name,description:old.locations[id].description,kind:kindOf[id],...mapCoordinates[id]});
  // Places found while exploring keep their order, so every kept place's path back is kept too.
  for(const p of worldPlaces(previous)){const from=placeMap[p.from];if(!from)continue;const extra={};for(const k of ['danger','feature','cleared','threat'])if(p[k]!==undefined)extra[k]=p[k];const id=add(from,{...p,kind:placeKinds.includes(p.kind)?p.kind:'landmark'},extra);if(id)placeMap[p.id]=id;}
 }
 // ---- People ----
 const following=id=>follow[id]?.status==='following'&&fate[id]!=='dead'&&(previous.npcHP?.[id]??1)>0;
 const homeOf=id=>coreNpcIds.includes(id)||!isPersonId(id)?'inn':previous.people[id].home;
 const priority=id=>following(id)?0:fate[id]==='dead'?3:previous.npcMemory?.[id]?.grudge||previous.npcMemory?.[id]?.bond?1:2;
 const candidates=ids.filter(id=>(old.npcs[id]||previous.people?.[id])&&(following(id)||(sameRegion&&placeMap[homeOf(id)])));
 const kept=[...candidates].sort((a,b)=>priority(a)-priority(b)||ids.indexOf(a)-ids.indexOf(b)).slice(0,maxPeople).sort((a,b)=>ids.indexOf(a)-ids.indexOf(b));
 const idMap=Object.fromEntries(kept.map((id,i)=>[id,'n'+(i+1)]));
 const newNames=new Set(Object.values(next.story.npcs).map(n=>n.name.trim().toLowerCase()));
 const people={},memory={},hp={},fates={},followers={};
 for(const id of kept){
  const nid=idMap[id],lore=npcLore(previous,id),src=previous.people?.[id];
  const core=!src,tie=core?{to:ids.find(x=>x!==id&&coreNpcIds.includes(x))??null,kind:old.npcs[id]?.ties?.other??'acquaintance'}:src.tie;
  const home=following(id)?(sameRegion?placeMap[homeOf(id)]??'inn':'inn'):placeMap[homeOf(id)];
  let name=lore.name;if(newNames.has(name.trim().toLowerCase()))name=(name+' the Elder').slice(0,60);
  people[nid]={name,species:String(lore.species??'').slice(0,60),role:String(lore.role).slice(0,200),appearance:String(lore.appearance??'').trim().length>=10?String(lore.appearance).slice(0,400):(name+', as the hero remembers them.').slice(0,400),personality:String(lore.personality??'').slice(0,200),
   ...(lore.motive?{motive:String(lore.motive).slice(0,400)}:{}),toughness:core?(id==='keeper'?'tough':'common'):src.toughness,home,foe:'neutral',...(tie?.to&&idMap[tie.to]?{tie:{to:idMap[tie.to],kind:tie.kind}}:{})};
  if(previous.npcMemory?.[id]){const m={...previous.npcMemory[id]};if(!following(id))delete m.allegiance;memory[nid]=m;}
  const max=personToughness[people[nid].toughness].maximumHP;
  if(previous.npcHP?.[id]!==undefined)hp[nid]=Math.min(max,previous.npcHP[id]);
  if(fate[id]){fates[nid]=fate[id];hp[nid]=0;}
  if(following(id))followers[nid]={...follow[id],status:'following',location:'inn'};
  else if(follow[id]&&follow[id].status!=='dismissed'&&placeMap[follow[id].location])followers[nid]={...follow[id],location:placeMap[follow[id].location]};
 }
 // ---- The new game ----
 const joined={...next};
 if(places.length)joined.world={places,at:null};
 if(kept.length){joined.people=people;joined.npcMemory=memory;if(Object.keys(hp).length)joined.npcHP=hp;if(Object.keys(fates).length)joined.npcFate=fates;if(Object.keys(followers).length)joined.followers=followers;}
 const visited=(previous.map?.visited??[]).map(id=>placeMap[id]).filter(Boolean);
 joined.map={...next.map,visited:[...new Set([...(next.map?.visited??['inn']),...visited])]};
 const ending=previous.foeFate==='slain'?'The '+old.foe+' was slain.':previous.foeFate==='subdued'?'The '+old.foe+' was beaten and spared.':'The '+old.foe+' is still out there.';
 joined.worldFacts=[...(sameRegion?(previous.worldFacts??[]).slice(-20):[]),...(sameRegion?['Earlier, in '+old.title+': '+ending]:[]),...(next.worldFacts??[])].slice(-60);
 const companions=kept.filter(following).map(id=>people[idMap[id]].name);
 joined.journal=appendJournal(next.journal,'note','Previously',(sameRegion?old.title+' ('+(old.status==='complete'?'completed':'left unfinished')+'). '+ending+' The places and people you knew there are still on your map.':'You left '+old.locations.inn.name+' behind for new country.')+(companions.length?' Travelling with you: '+companions.join(', ')+'.':''));
 return joined;
}
