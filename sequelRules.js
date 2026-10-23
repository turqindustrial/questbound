import {npcIdsOf,npcLore,isPersonId,maxPeople,personToughness,coreNpcIds,npcClassOf,classedStats,metPerson} from './npcRules';
import {coreIds,bearings,worldPlaces,worldLinks,placeCoordinates,placeKinds,maxWorldPlaces,maxRegions,mapRegions,homeRegion,currentRegion} from './mapRules';
import {stagingNameKey} from './stagingRules';
import {libraryPeopleMet} from './relationshipRules';
import {appendJournal,appendStoryLog} from './journalRules';
import {closedMemory,remappedMemory} from './memoryRules';
// A hero's next story. Everything the hero knows comes along (sameRegion): the earlier world's lands and places join the
// map (a few miles off, or days away for somewhere new, joined to the new starting place by a road from where the hero
// stood), and its people, everyone met since, their memories, grudges, debts and fates carry over (residents the hero
// never reached stay unmet). Without sameRegion (an older caller), only the hero's companions and pack come along.
// Gold, draughts and training always stay with the hero.
export const sequelBearings=Object.keys(bearings);
// Lands travelled are never forgotten: every place of the earlier country the hero went to comes along, with the
// roads back to it; of the places only heard of, up to oldPlaceLimit come too.
export const oldPlaceLimit=20;
// Where the earlier country lies from a next tale's starting place: a bearing, and a few miles off (near: the next tale
// here, or in a land the hero has reached) or days away (far: somewhere new, the 2026-10-23 campaign, so that every land
// of a campaign can be travelled back to). `random` is Math.random on a device, a seeded one at a table.
export const sequelMiles={near:[4,7],far:[60,200]};
export function nextTalePlacement(random=Math.random,{far=false}={}){
 const [low,high]=sequelMiles[far?'far':'near'];
 return {bearing:sequelBearings[Math.floor(random()*sequelBearings.length)%sequelBearings.length],miles:Math.round((low+random()*(high-low))*10)/10};
}
// The land where the hero stands, as a next tale asks for it (dm-server.cjs taleLand): its name and terrain.
export function landHere(game){
 const land=mapRegions(game).find(r=>r.id===currentRegion(game))??homeRegion(game);
 return {id:land.id,name:land.name,terrain:land.terrain};
}
// "A tale waits in <Land>" (the 2026-10-23 campaign, the host's words: "once the player completes the story or decides
// to move to a new area, new potential stories should be written"): offered while the hero stands in a land first reached
// in this tale (its "Set out for a new land" line in the story log since the tale began: beyond the map, or a far land
// the Dungeon Master opened), never the home land, a land the tale itself spoke of from the start (story.lands) or a
// land of an earlier tale; only out of a fight, alive, with nothing waiting on the hero, and never at a shared table
// (the table's host chooses its tales). `dismissed`: keys (taleWaitsKey) the player answered Not now. The land, or null.
export const taleWaitsKey=(game,land)=>String(game?.story?.id??'')+'|'+String(land?.name??'').trim().toLowerCase();
export function landTaleOffer(game,{dismissed=[]}={}){
 const s=game?.story;
 if(!s||s.introId==='hostile'||game.party||game.turnOrder||game.pendingSpell||game.wildFight||game.npcCombat?.active||game.dungeon?.active||['dying','dead','combat','defeat'].includes(game.stage))return null;
 const land=landHere(game);if(land.id==='home')return null;
 const name=land.name.trim().toLowerCase();
 if((Array.isArray(s.lands)?s.lands:[]).some(l=>typeof l?.name==='string'&&l.name.trim().toLowerCase()===name))return null;
 const log=Array.isArray(game.storyLog)?game.storyLog:[],start=log.map(e=>e?.kind).lastIndexOf('story');
 if(!log.slice(start+1).some(e=>e?.kind==='place'&&e.text===('Set out for a new land: '+land.name+'.').slice(0,150)))return null;
 const key=taleWaitsKey(game,land);
 return dismissed.includes(key)?null:{name:land.name,terrain:land.terrain,key};
}
// What a new story starts from: the hero's own things, nothing tied to the old region, and the hero's whole story so far
// (memoryRules.js: the tale just ended is closed into the chronicle; next tales and new lands alike keep it).
export function carriedBase(previous){
 return {...(previous?.pack?{pack:previous.pack}:{}),potions:Math.max(1,previous?.potions??1),...(previous?.skillTraining?{skillTraining:previous.skillTraining}:{}),...(Number.isInteger(previous?.xp)?{xp:previous.xp}:{}),...(previous?.levelsOwed?{levelsOwed:previous.levelsOwed}:{}),...(previous?.deeds?.length?{deeds:previous.deeds}:{}),...(memory=>memory?{memory}:{})(previous?closedMemory(previous):null)};
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
  people:people.map(id=>{const m=game.npcMemory?.[id],lore=npcLore(game,id);return {name:lore.name,role:lore.role,alive:game.npcFate?.[id]!=='dead',feelingAboutHero:m?.grudge?'sworn enemy':m?.bond?'owes the hero a debt':m?.forgave&&!['friendly','devoted'].includes(m.attitude)?'forgave the hero; trust is thin':m?.attitude??'indifferent',travelsWithHero:game.followers?.[id]?.status==='following'};}).slice(0,14)};
}
const kindOf={inn:'settlement',bridge:'road',tower:'landmark'};
// Join the earlier world onto a freshly written story (next = freshStoryGame(...)). bearing and miles: where the anchor
// lies from the new starting place. `anchor`: the place of the earlier world where the hero stands (a starting place id
// or a found place's id; 'wild' reads as the place they are at), by default the earlier starting place. The earlier
// world is joined at the anchor: it lies `miles` off along `bearing`, a road runs from the new start to it, and every
// earlier place keeps a road back through the places it was reached by (the earlier world's own paths, followed out
// from the anchor), in whichever land the anchor lies.
export function joinRegion(next,previous,{sameRegion,bearing='N',miles=5,anchor='inn'}={}){
 if(!previous?.story)return next;
 const old=previous.story,ids=npcIdsOf(previous),fate=previous.npcFate??{},follow=previous.followers??{};
 // Names are kept apart as the staging compares them (without case, spacing, curly quotes or a leading "The"), so "The
 // Mill" and "Mill" never both show and a written tale's own names still resolve to its own places and people.
 const own=worldPlaces(next),taken=new Set([...Object.values(next.story.locations),...own].map(l=>stagingNameKey(l.name)));
 const olden=n=>/^the /i.test(n)?'The Old '+n.slice(4):'Old '+n;
 const unique=name=>{const n=name.trim().slice(0,60),k=[n,olden(n).slice(0,60),(n.slice(0,50)+' (earlier)')].find(c=>!taken.has(stagingNameKey(c)));if(!k)return null;taken.add(stagingNameKey(k));return k;};
 // ---- Places ----
 const placeMap={},places=[];
 // The earlier country keeps its own map: its home region becomes a region of the new story (r1), and any lands
 // it had beyond that follow as further regions.
 // (A new story may already speak of far lands of its own, r1 and r2: the earlier country's regions follow those.)
 const regions=[],regionMap={},ownRegions=next.world?.regions??[];
 if(sameRegion){
  const olds=worldPlaces(previous),byOld=Object.fromEntries(olds.map(p=>[p.id,p]));
  const root=(id=>coreIds.includes(id)||byOld[id]?id:'inn')(anchor==='wild'?previous.world?.at:anchor==='dungeon'?'bridge':anchor),at=placeCoordinates(previous,root)??{x:0,y:0};
  const [dx,dy]=bearings[bearing]??bearings.N,shift={x:Math.round(dx*miles*5280-at.x),y:Math.round(dy*miles*5280-at.y)};
  // A land comes along as a land of its own while there is room (sixty lands in all); past that (a very long life of
  // tales), a place the hero went to joins the earlier country's first land rather than being lost, and a place only
  // heard of in a land that has no room is left behind.
  const regionFor=(oldId,needed)=>{if(regionMap[oldId])return regionMap[oldId];if(ownRegions.length+regions.length>=maxRegions-1)return needed?regions[0]?.id??null:undefined;const source=mapRegions(previous).find(r=>r.id===oldId)??homeRegion(previous);const id='r'+(ownRegions.length+regions.length+1),taken=[homeRegion(next).name,...ownRegions.map(r=>r.name),...regions.map(r=>r.name)].map(n=>n.toLowerCase());let name=source.name.slice(0,60);if(taken.includes(name.toLowerCase()))name=(oldId==='home'?'Lands about '+old.locations.inn.name:name+' (earlier)').slice(0,60);regions.push({id,name,terrain:source.terrain});return regionMap[oldId]=id;};
  let heardOf=0;
  const add=(from,src,oldRegion,extra={},needed=true)=>{if(places.length>=maxWorldPlaces-own.length||(!needed&&heardOf>=oldPlaceLimit))return;const region=regionFor(oldRegion,needed);if(region===undefined)return;const name=unique(src.name);if(!name)return;if(!needed)heardOf++;const id='p'+(own.length+places.length+1);places.push({id,name,description:String(src.description).trim().slice(0,300),kind:src.kind,x:src.x+shift.x,y:src.y+shift.y,from,...(region?{region}:{}),...extra});return id;};
  const core=id=>({name:old.locations[id].name,description:old.locations[id].description,kind:placeKinds.includes(old.locations[id].kind)?old.locations[id].kind:kindOf[id],...placeCoordinates(previous,id)});
  // The earlier world's roads, followed out from the anchor (fewest roads away first, in the order the map keeps them):
  // each place comes after the one it is reached from, so its road back runs through places already kept.
  const near={};for(const [a,b] of worldLinks(previous))if((coreIds.includes(a)||byOld[a])&&(coreIds.includes(b)||byOld[b])){(near[a]??=[]).push(b);(near[b]??=[]).push(a);}
  const parent={[root]:null},order=[root];for(let i=0;i<order.length;i++)for(const n of near[order[i]]??[])if(!(n in parent)){parent[n]=order[i];order.push(n);}
  // First every place the hero went to (the three earlier starting places always, and wherever a companion waits)
  // with the places on the road from the anchor to them; then places only heard of.
  const went=new Set([...coreIds,...(previous.map?.visited??[]),...Object.values(follow).filter(f=>f?.status==='waiting').map(f=>f.location)]),needed=new Set();
  for(const id of order)if(went.has(id))for(let q=id;q!==null&&q!==undefined&&!needed.has(q);q=parent[q])needed.add(q);
  // Places keep the earlier map's order where they can (the starting places, then places in the order they were
  // found), each taken once the place it is reached from is kept.
  const sequence=[...order.filter(id=>coreIds.includes(id)),...olds.map(p=>p.id).filter(id=>id in parent)];
  for(const pass of [true,false])for(let more=true;more;){more=false;for(const id of sequence){
   if(needed.has(id)!==pass||placeMap[id])continue;const from=parent[id]===null?'inn':placeMap[parent[id]];if(!from)continue;
   let nid;
   if(coreIds.includes(id))nid=add(from,core(id),'home',{},pass);
   else{const p=byOld[id],extra={};for(const k of ['danger','feature','cleared','threat'])if(p[k]!==undefined)extra[k]=p[k];nid=add(from,{...p,kind:placeKinds.includes(p.kind)?p.kind:'landmark'},p.region??'home',extra,pass);}
   if(nid){placeMap[id]=nid;more=true;}
  }}
 }
 // ---- People ----
 const following=id=>follow[id]?.status==='following'&&fate[id]!=='dead'&&(previous.npcHP?.[id]??1)>0;
 const homeOf=id=>coreNpcIds.includes(id)||!isPersonId(id)?'inn':previous.people[id].home;
 const priority=id=>following(id)?0:fate[id]==='dead'?3:previous.npcMemory?.[id]?.grudge||previous.npcMemory?.[id]?.bond?1:2;
 const candidates=ids.filter(id=>(old.npcs[id]||previous.people?.[id])&&(following(id)||(sameRegion&&placeMap[homeOf(id)])));
 // The new tale's own people (its residents) keep their ids; the earlier people are numbered after them.
 const first=Math.max(0,...Object.keys(next.people??{}).map(k=>Number(k.slice(1))));
 const kept=[...candidates].sort((a,b)=>priority(a)-priority(b)||ids.indexOf(a)-ids.indexOf(b)).slice(0,Math.max(0,maxPeople-first)).sort((a,b)=>ids.indexOf(a)-ids.indexOf(b));
 const idMap=Object.fromEntries(kept.map((id,i)=>[id,'n'+(first+i+1)]));
 const newNames=new Set([...Object.values(next.story.npcs),...Object.values(next.people??{})].map(n=>stagingNameKey(n.name)));
 // Who the hero had met: the earlier tale's residents keep `resident` (and `hidden`, while still out of sight) so that
 // one never reached stays unmet, while everyone met stays met with all their memories (relationshipRules.js metPerson).
 const metBefore=Object.fromEntries(ids.map(id=>[id,metPerson(previous,id)]));
 // Nobody from the people library is met twice in one game, but the story writer, who never knows whom the hero has met,
 // may cast the same library person in the next tale. The new tale's one keeps the library's identity (its staging and
 // lines name them); the earlier one keeps the hero's history with them (memories, ties, fate) but no longer stands for
 // that library person (no pool or hook), and the name clash below makes them "<name> the Elder".
 const seatedPools=new Set(libraryPeopleMet(next));
 const people={},memory={},hp={},fates={},followers={},classes={};
 for(const id of kept){
  const nid=idMap[id],lore=npcLore(previous,id),src=previous.people?.[id];
  const core=!src,tie=core?{to:ids.find(x=>x!==id&&coreNpcIds.includes(x))??null,kind:old.npcs[id]?.ties?.other??'acquaintance'}:src.tie;
  const home=following(id)?(sameRegion?placeMap[homeOf(id)]??'inn':'inn'):placeMap[homeOf(id)];
  let name=lore.name;if(newNames.has(stagingNameKey(name)))name=(name+' the Elder').slice(0,60);
  people[nid]={name,species:String(lore.species??'').slice(0,60),role:String(lore.role).slice(0,200),appearance:String(lore.appearance??'').trim().length>=10?String(lore.appearance).slice(0,400):(name+', as the hero remembers them.').slice(0,400),personality:String(lore.personality??'').slice(0,200),
   ...(lore.motive?{motive:String(lore.motive).slice(0,400)}:{}),...((src??old.npcs[id])?.pool&&!seatedPools.has((src??old.npcs[id]).pool)?{pool:(src??old.npcs[id]).pool,...(src?.hook?{hook:String(src.hook).slice(0,240)}:{})}:{}),toughness:core?(id==='keeper'?'tough':'common'):src.toughness,home,foe:'neutral',...(tie?.to&&idMap[tie.to]?{tie:{to:idMap[tie.to],kind:tie.kind}}:{}),
    ...(['woman','man','other'].includes(lore.gender)?{gender:lore.gender}:{}),...((src??old.npcs[id])?.regard?{regard:(src??old.npcs[id]).regard}:{}),
   ...(src?.resident===true?{resident:true}:{}),...(src?.hidden===true&&!metBefore[id]?{hidden:true}:{})};
  if(previous.npcMemory?.[id]){const m={...previous.npcMemory[id]};if(!following(id))delete m.allegiance;memory[nid]=m;}
  // A trained person (every companion is one) keeps their class and level under their new id.
  const trained=npcClassOf(previous,id);if(trained){classes[nid]={class:trained.class,level:trained.level};people[nid].class=trained.class;}
  const max=trained?classedStats(trained.class,trained.level).maximumHP:personToughness[people[nid].toughness].maximumHP;
  if(previous.npcHP?.[id]!==undefined)hp[nid]=Math.min(max,previous.npcHP[id]);
  if(fate[id]){fates[nid]=fate[id];hp[nid]=0;}
  if(following(id))followers[nid]={...follow[id],status:'following',location:'inn'};
  else if(follow[id]&&follow[id].status!=='dismissed'&&placeMap[follow[id].location])followers[nid]={...follow[id],location:placeMap[follow[id].location]};
 }
 // ---- The new game ----
 const joined={...next};
 // Places the new story marked from the start come first on its own map; the earlier country follows.
 if(places.length)joined.world={places:[...own,...places],at:null,...(ownRegions.length+regions.length?{regions:[...ownRegions,...regions]}:{})};
 if(kept.length){joined.people={...next.people,...people};joined.npcMemory={...next.npcMemory,...memory};if(Object.keys(hp).length)joined.npcHP={...next.npcHP,...hp};if(Object.keys(fates).length)joined.npcFate={...next.npcFate,...fates};if(Object.keys(followers).length)joined.followers={...next.followers,...followers};if(Object.keys(classes).length)joined.npcClasses={...next.npcClasses,...classes};}
 // Offers to come along were made in the earlier country; they do not carry over.
 delete joined.joinOffers;
 const visited=(previous.map?.visited??[]).map(id=>placeMap[id]).filter(Boolean);
 joined.map={...next.map,visited:[...new Set([...(next.map?.visited??['inn']),...visited])]};
 // Someone met before who would now read as not yet met (met where they stood, not at their home) is no longer counted
 // as one of a tale's residents: they are simply someone the hero knows.
 for(const id of kept){const nid=idMap[id];if(metBefore[id]&&joined.people?.[nid]?.resident&&!metPerson(joined,nid)){const p={...joined.people[nid]};delete p.resident;delete p.hidden;joined.people={...joined.people,[nid]:p};}}
 const ending=previous.foeFate==='slain'?'The '+old.foe+' was slain.':previous.foeFate==='subdued'?'The '+old.foe+' was beaten and spared.':'The '+old.foe+' is still out there.';
 joined.worldFacts=[...(sameRegion?(previous.worldFacts??[]).slice(-20):[]),...(sameRegion?['Earlier, in '+old.title+': '+ending]:[]),...(next.worldFacts??[])].slice(-60);
 // The hero's story so far carries on: the earlier chapters, then the opening of this one. The lasting memory
 // (memoryRules.js) keeps every earlier tale; its facts follow the people and places that came along, renumbered.
 joined.memory=remappedMemory(next.memory??closedMemory(previous),idMap,placeMap);if(!joined.memory)delete joined.memory;
 if(previous.storyLog?.length){const first=next.storyLog?.[0]?.text??next.story.title;joined.storyLog=appendStoryLog(previous.storyLog,'story',first.replace(': the tale began at ',sameRegion?(miles>=20?': a new tale began, days down the road, at ':': a new tale began nearby, at '):': a new tale began, far away, at '));}
 const companions=kept.filter(following).map(id=>people[idMap[id]].name);
 joined.journal=appendJournal(next.journal,'note','Previously',(sameRegion?old.title+' ('+(old.status==='complete'?'completed':'left unfinished')+'). '+ending+' The places and people you knew there are still on your map.':'You left '+old.locations.inn.name+' behind for new country.')+(companions.length?' Travelling with you: '+companions.join(', ')+'.':''));
 return joined;
}
