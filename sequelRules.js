import {npcIdsOf,npcLore,isPersonId,maxPeople,personToughness,coreNpcIds} from './npcRules';
import {coreIds,bearings,worldPlaces,worldLinks,placeCoordinates,placeKinds,maxWorldPlaces,maxRegions,mapRegions,homeRegion} from './mapRules';
import {appendJournal,appendStoryLog} from './journalRules';
// A hero's next story. Continuing in the same region, everything the hero knows comes along: the earlier story's
// places join the map (a few miles off, joined to the new starting place by a road), and its people, everyone met
// since, their memories, grudges, debts and fates carry over (the earlier residents become people met along the
// way). Setting out somewhere new, only the hero's companions and pack come along. Gold, draughts and training
// always stay with the hero.
export const sequelBearings=Object.keys(bearings);
export const oldPlaceLimit=20;
// What a new story starts from: the hero's own things, nothing tied to the old region.
export function carriedBase(previous){
 return {...(previous?.pack?{pack:previous.pack}:{}),potions:Math.max(1,previous?.potions??1),...(previous?.skillTraining?{skillTraining:previous.skillTraining}:{}),...(previous?.levelsOwed?{levelsOwed:previous.levelsOwed}:{}),...(previous?.deeds?.length?{deeds:previous.deeds}:{})};
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
 const own=worldPlaces(next),taken=new Set([...Object.values(next.story.locations),...own].map(l=>l.name.trim().toLowerCase()));
 const unique=name=>{let n=name.trim().slice(0,60),k=n.toLowerCase();if(taken.has(k)){n=('Old '+n).slice(0,60);k=n.toLowerCase();}if(taken.has(k))return null;taken.add(k);return n;};
 // ---- Places ----
 const placeMap={},places=[];
 // The earlier country keeps its own map: its home region becomes a region of the new story (r1), and any lands
 // it had beyond that follow as further regions.
 // (A new story may already speak of far lands of its own, r1 and r2: the earlier country's regions follow those.)
 const regions=[],regionMap={},ownRegions=next.world?.regions??[];
 if(sameRegion){
  const [dx,dy]=bearings[bearing]??bearings.N,shift={x:Math.round(dx*miles*5280),y:Math.round(dy*miles*5280)};
  const regionFor=oldId=>{if(regionMap[oldId])return regionMap[oldId];if(ownRegions.length+regions.length>=maxRegions-1)return regions[0]?.id??null;const source=mapRegions(previous).find(r=>r.id===oldId)??homeRegion(previous);const id='r'+(ownRegions.length+regions.length+1),taken=[homeRegion(next).name,...ownRegions.map(r=>r.name),...regions.map(r=>r.name)].map(n=>n.toLowerCase());let name=source.name.slice(0,60);if(taken.includes(name.toLowerCase()))name=(oldId==='home'?'Lands about '+old.locations.inn.name:name+' (earlier)').slice(0,60);regions.push({id,name,terrain:source.terrain});return regionMap[oldId]=id;};
  const add=(from,src,oldRegion,extra={})=>{if(places.length>=Math.min(oldPlaceLimit,maxWorldPlaces-own.length))return;const name=unique(src.name);if(!name)return;const id='p'+(own.length+places.length+1),region=regionFor(oldRegion);places.push({id,name,description:String(src.description).trim().slice(0,300),kind:src.kind,x:src.x+shift.x,y:src.y+shift.y,from,...(region?{region}:{}),...extra});return id;};
  const core=id=>({name:old.locations[id].name,description:old.locations[id].description,kind:placeKinds.includes(old.locations[id].kind)?old.locations[id].kind:kindOf[id],...placeCoordinates(previous,id)});
  // The earlier starting place is joined to the new one; its two neighbours follow the earlier story's own paths.
  placeMap.inn=add('inn',core('inn'),'home');
  const links=worldLinks(previous).filter(([a,b])=>coreIds.includes(a)&&coreIds.includes(b));
  for(let pass=0;pass<2;pass++)for(const [a,b] of links)for(const [known,next] of [[a,b],[b,a]])if(placeMap[known]&&!placeMap[next])placeMap[next]=add(placeMap[known],core(next),'home');
  // Places found while exploring keep their order, so every kept place's path back is kept too.
  for(const p of worldPlaces(previous)){const from=placeMap[p.from];if(!from)continue;const extra={};for(const k of ['danger','feature','cleared','threat'])if(p[k]!==undefined)extra[k]=p[k];const id=add(from,{...p,kind:placeKinds.includes(p.kind)?p.kind:'landmark'},p.region??'home',extra);if(id)placeMap[p.id]=id;}
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
   ...(lore.motive?{motive:String(lore.motive).slice(0,400)}:{}),toughness:core?(id==='keeper'?'tough':'common'):src.toughness,home,foe:'neutral',...(tie?.to&&idMap[tie.to]?{tie:{to:idMap[tie.to],kind:tie.kind}}:{}),
    ...(['woman','man','other'].includes(lore.gender)?{gender:lore.gender}:{}),...((src??old.npcs[id])?.regard?{regard:(src??old.npcs[id]).regard}:{})};
  if(previous.npcMemory?.[id]){const m={...previous.npcMemory[id]};if(!following(id))delete m.allegiance;memory[nid]=m;}
  const max=personToughness[people[nid].toughness].maximumHP;
  if(previous.npcHP?.[id]!==undefined)hp[nid]=Math.min(max,previous.npcHP[id]);
  if(fate[id]){fates[nid]=fate[id];hp[nid]=0;}
  if(following(id))followers[nid]={...follow[id],status:'following',location:'inn'};
  else if(follow[id]&&follow[id].status!=='dismissed'&&placeMap[follow[id].location])followers[nid]={...follow[id],location:placeMap[follow[id].location]};
 }
 // ---- The new game ----
 const joined={...next};
 // Places the new story marked from the start come first on its own map; the earlier country follows.
 if(places.length)joined.world={places:[...own,...places],at:null,...(ownRegions.length+regions.length?{regions:[...ownRegions,...regions]}:{})};
 if(kept.length){joined.people=people;joined.npcMemory={...next.npcMemory,...memory};if(Object.keys(hp).length)joined.npcHP=hp;if(Object.keys(fates).length)joined.npcFate=fates;if(Object.keys(followers).length)joined.followers=followers;}
 const visited=(previous.map?.visited??[]).map(id=>placeMap[id]).filter(Boolean);
 joined.map={...next.map,visited:[...new Set([...(next.map?.visited??['inn']),...visited])]};
 const ending=previous.foeFate==='slain'?'The '+old.foe+' was slain.':previous.foeFate==='subdued'?'The '+old.foe+' was beaten and spared.':'The '+old.foe+' is still out there.';
 joined.worldFacts=[...(sameRegion?(previous.worldFacts??[]).slice(-20):[]),...(sameRegion?['Earlier, in '+old.title+': '+ending]:[]),...(next.worldFacts??[])].slice(-60);
 // The hero's story so far carries on: the earlier chapters, then the opening of this one.
 if(previous.storyLog?.length){const first=next.storyLog?.[0]?.text??next.story.title;joined.storyLog=appendStoryLog(previous.storyLog,'story',first.replace(': the tale began at ',sameRegion?': a new tale began nearby, at ':': a new tale began, far away, at '));}
 const companions=kept.filter(following).map(id=>people[idMap[id]].name);
 joined.journal=appendJournal(next.journal,'note','Previously',(sameRegion?old.title+' ('+(old.status==='complete'?'completed':'left unfinished')+'). '+ending+' The places and people you knew there are still on your map.':'You left '+old.locations.inn.name+' behind for new country.')+(companions.length?' Travelling with you: '+companions.join(', ')+'.':''));
 return joined;
}
