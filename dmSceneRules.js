// The written story's part of what the Dungeon Master is told (dmContext.js dmContext): the tale and the quest, the
// people not here (in brief, then by name), and the world: this land's places in full, then by name, journeys to
// other lands, far lands in brief, and the places the player's words name (with the journeys there added to the
// choices); the limits that keep one request inside its size however large the world grows.
import {questState,storyText,storyIntroduction} from "./storyRules";
import {npcLore,metPerson,npcScene} from "./npcRules";
import {mapLocation,knownPlaceIds,placeName,travelRoute,currentRegion,mapRegions,regionOfPlace,mapState,placeCoordinates,distanceText,durationText,placeDescription,worldPlace,mapHasRoom,maxWorldPlaces,worldPlaces} from "./mapRules";
import {npcTies,speciesRegard,canMeetPeople,libraryPeopleMet} from "./relationshipRules";
import {foeLabel} from "./encounterRules";
import {mapMoves} from "./dmChoiceRules";
import {stagingQuest,taleNow,leadOpenNow,stagingAdvanceOpen} from "./stagingRules";
// Long text sent to the Dungeon Master is shortened with an ellipsis (the request stays well inside its size limit).
export const briefText=(t,n)=>{t=String(t??'');return t.length>n?t.slice(0,n-1).trimEnd()+'…':t;};
// The chapter's truth (its `turn`: what the chapter uncovers) as the Dungeon Master reads it, at most 200 characters,
// cut at a sentence where one ends far enough in (the stories spec, Phase A1: "tell the find where it is found").
export const truthText=t=>{t=String(t??'').replace(/\s+/g,' ').trim();if(t.length<=200)return t;const head=t.slice(0,200),end=Math.max(head.lastIndexOf('. '),head.lastIndexOf('! '),head.lastIndexOf('? '));return end>=80?head.slice(0,end+1):briefText(t,200);};
// One line per skill ("Arcana: Intelligence +5 (trained)"), as the Dungeon Master reads it, so a request has room for
// the story so far (memoryRules.js). Outside fights and rulings only the defenses of the people here are sent, and the
// latest eight world facts (the lasting facts of a whole life are kept in memory).
export const skillLine=s=>(s.skill??s.ability)+': '+s.ability+' '+(s.total>=0?'+':'')+s.total+(s.expert?' (expert)':s.trained?' (trained)':'')+(s.reliable?' (reliable)':'');
// Known places and lands the player's own words name (a whole name; "the" may be left off): the place, or for a land
// the nearest place in it. Lands travelled are never forgotten, so a journey back to any of them is offered to the
// Dungeon Master when the player names it, however many lands the choices have no room for.
const escapedText=t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const plainWords=t=>String(t??'').toLowerCase().replace(/[’`]/g,"'").replace(/\s+/g,' ').trim();
export function placesNamed(game,input){
  const text=plainWords(input);
  if(!game?.story||text.length<3)return [];
  const said=name=>{const n=plainWords(name).replace(/^the /,'');return n.length>=3&&new RegExp('(?:^|[^a-z0-9])'+escapedText(n)+'(?:$|[^a-z0-9])').test(text);};
  const here=mapLocation(game),ids=knownPlaceIds(game).filter(id=>id!==here),found=ids.filter(id=>said(placeName(game,id)));
  const minutes=id=>travelRoute(game,here,id)?.minutes??Infinity,land=currentRegion(game);
  for(const r of mapRegions(game))if(r.id!==land&&said(r.name)){const near=ids.filter(id=>regionOfPlace(game,id)===r.id).sort((a,b)=>minutes(a)-minutes(b))[0];if(near&&!found.includes(near))found.push(near);}
  return found;
}
// The journeys the player's words name, added to the choices offered (the farthest journeys or ways beyond give way
// past thirty). The game itself accepts any journey on the map (mapMoves), so the chosen one can be taken.
export function withNamedJourneys(choices,game,input){
  if(!input)return choices;
  const moves=mapMoves(game),named=placesNamed(game,input).map(id=>moves.find(m=>m.action.type==='travel'&&m.action.destination===id)).filter(Boolean).slice(0,4);
  let list=[...choices];
  for(const m of named){
    if(list.some(c=>c.id===m.id))continue;
    if(list.length>=30){const i=list.map(c=>/^(?:beyond|travel)-/.test(c.id)&&!named.some(n=>n.id===c.id)).lastIndexOf(true);if(i<0)break;list.splice(i,1);}
    list.push({id:m.id,label:m.label});
  }
  return list;
}
// How much of a large world the Dungeon Master is told, so that one request stays well inside its size limit however
// many lands the hero has travelled (they are never forgotten): places of this land in full, then by name; far lands
// with their places by name; people not here in brief, then by name.
export const placesInFull=10,placesByName=24,landsInFull=10,peopleInBrief=6,peopleByName=20;
// People not here: companions first, then anyone who keeps out of sight, holds a grudge or a debt, then the people
// met. The first few of this land are told in brief; the rest of this land who have been met, by name only
// (peopleElsewhere); people of other lands not at all (they are far away), except a companion waiting there.
function peopleAway(game,state){
  const rank=n=>game.followers?.[n.id]?0:n.hidden?1:(n.grudge||n.bond)?2:n.metHero!==false?3:4;
  const near=state.filter(n=>n.present===false&&(!landAwayOf(game,n.id)||game.followers?.[n.id])).map((n,i)=>({n,i})).sort((a,b)=>rank(a.n)-rank(b.n)||a.i-b.i).map(({n})=>n);
  const named=near.slice(peopleInBrief).filter(n=>n.metHero!==false);
  return {brief:new Set(near.slice(0,peopleInBrief).map(n=>n.id)),named:named.slice(0,peopleByName).map(n=>n.name+(n.role?', '+briefText(n.role,32):'')+(n.livesAt?', at '+n.livesAt:'')+(n.fate==='dead'?' (dead)':n.attitude&&n.attitude!=='indifferent'?' ('+n.attitude+')':''))};
}
// The land someone lives (or waits) in, when it is not the land the hero is in: they are told to the Dungeon Master in
// brief. null for someone in this land or travelling with the hero.
function landAwayOf(game,id){
  const f=game.followers?.[id];if(f?.status==='following')return null;
  const at=f?.status==='waiting'?f.location:game.people?.[id]?.home??(['keeper','mara'].includes(id)?'inn':null);if(!at)return null;
  const land=regionOfPlace(game,at);if(land===currentRegion(game))return null;
  return mapRegions(game).find(r=>r.id===land)?.name??null;
}
// The written story's part of what the Dungeon Master is told (dmContext): the tale without its later chapters and
// the quest, people not here in brief, and the world (this land's places, other lands, whether a new place or person
// can be found now); it fills `context` in place.
export function storyWorld(context,hero,game,health,input){
  // The tale is given without its later chapters: `quest` says which chapter is under way, its truth (what the
  // chapter uncovers, told where its goal points: `truth`, at most 200 characters; `revealedWhenAchieved` whole, for the
  // checks), what follows, and which leads are open (each `ticked` when the player marked it for themselves).
  // A written tale's plan (staging: its beats, later chapters and endings) and its shelf tag never reach the Dungeon
  // Master: the engine decides what happens and when, and the Dungeon Master reads only the chapter under way (where its
  // truth is found, what the foe is doing now, how far the tale has come, whether the foe is beyond reach: stagingQuest),
  // the leads already open, and what is due now (context.taleNow: the beat, the stakes, the clock's latest sign).
  const {chapters,leads,chapter,hoard,staging,written,...told}=game.story,q=questState(game);context.story=told;
  // A written tale's truth is in the scene only while the Dungeon Master may tell it (story-advance offered:
  // stagingAdvanceOpen); else it reaches the Dungeon Master as the STORY BEAT that closes the chapter (taleNow).
  const staged=stagingQuest(game),openLeads=q.openLeads.filter(l=>leadOpenNow(game,l.id)),truth=!staged||stagingAdvanceOpen(game);
  if(q.current||q.leads.length)context.quest={...(q.current?{chapter:q.number,of:q.chapters,title:q.current.title,goal:q.current.goal,...(truth?{truth:truthText(q.current.turn),revealedWhenAchieved:q.current.turn}:{}),finalChapter:q.last,next:q.next?{title:q.next.title,goal:q.next.goal}:null}:{}),...(staged??{}),openLeads:openLeads.map(l=>({id:l.id,title:l.title,hook:l.hook,...(l.noted?{ticked:true}:{})})),leadsSeenThrough:q.leads.filter(l=>l.done).map(l=>l.title)};
  {const now=taleNow(game);if(now)context.taleNow=now;}context.nearbyNPCs=game.stage==='inn'?Object.entries(game.story.npcs).map(([id,n])=>({id,name:n.name,voice:n.role+' '+n.motive+' '+(n.personality??''),appearance:n.appearance??null})):game.stage==='combat'?[{name:foeLabel(game),voice:'The current threat.'}]:[];context.npcSocialState=context.npcSocialState.map(n=>({...n,name:npcLore(game,n.id)?.name??n.name,role:npcLore(game,n.id)?.role??null,livesAt:game.people?.[n.id]?placeName(game,game.people[n.id].home):null,metHero:metPerson(game,n.id),ties:npcTies(game,n.id),regardsYourKind:(r=>r.stance==='indifferent'?null:r.stance)(speciesRegard(game,n.id,hero))}));
  // People not here are told in brief (peopleAway), so a world of many people still fits in one request (the Dungeon
  // Master's server reads the same brief): who and where they are, how they feel, and their last two memories.
  // Someone who keeps out of sight where they live is `unnoticed` until the player finds them.
  {const {brief,named}=peopleAway(game,context.npcSocialState);if(named.length)context.peopleElsewhere=named;
   context.npcSocialState=context.npcSocialState.filter(n=>n.present!==false||brief.has(n.id)).map(n=>n.present!==false?n:landAwayOf(game,n.id)?{id:n.id,name:n.name,role:briefText(n.role,60),livesAt:n.livesAt,land:landAwayOf(game,n.id),present:false,metHero:n.metHero,...(n.hidden?{unnoticed:true}:{}),attitude:n.attitude,...(n.grudge?{grudge:briefText(n.grudge,80)}:{}),...(n.bond?{bond:briefText(n.bond,80)}:{}),...(n.fate?{fate:n.fate}:{}),...(n.standing?{standing:n.standing}:{}),...(n.trainedAs?{trainedAs:n.trainedAs}:{})}:{id:n.id,name:n.name,role:briefText(n.role,100),livesAt:n.livesAt,present:false,metHero:n.metHero,...(n.hidden?{unnoticed:true}:{}),attitude:n.attitude,...(n.grudge?{grudge:briefText(n.grudge,120)}:{}),...(n.grudge&&n.forgiveness?{forgiveness:n.forgiveness}:{}),...(n.forgave?{forgave:n.forgave}:{}),...(n.bond?{bond:briefText(n.bond,120)}:{}),...(n.fate?{fate:n.fate}:{}),...(n.ties?.all?.length||(n.ties?.toFoe&&n.ties.toFoe!=='neutral')?{ties:n.ties}:{}),...(n.standing?{standing:n.standing}:{}),...(n.trainedAs?{trainedAs:n.trainedAs}:{}),...(n.metHero!==false?{memories:(n.memories??[]).slice(-2).map(m=>briefText(m,140))}:{})});}context.campaign=null;context.journal=context.journal.map(e=>({...e,text:storyText(game,e.text)}));context.recentEvents=context.recentEvents.map(t=>storyText(game,t));if(context.encounter)context.encounter.name=foeLabel(game);
  // The wider region: where the hero is, what they know of, and whether a new place can be revealed now.
  const here=mapLocation(game),visited=mapState(game).visited;
  // Lands: the one the hero is in, and every one they know (each has its own map).
  const lands=mapRegions(game),landOf=id=>lands.find(r=>r.id===regionOfPlace(game,id))??lands[0];
  // Which way each known place lies from here (within the same land), so "north" and "along the shore south" can be told from places already known.
  const from=placeCoordinates(game,here),wayTo=id=>{const to=placeCoordinates(game,id);if(!from||!to||id===here||regionOfPlace(game,id)!==regionOfPlace(game,here)||(to.x===from.x&&to.y===from.y))return null;return ['N','NE','E','SE','S','SW','W','NW'][Math.round(Math.atan2(to.x-from.x,to.y-from.y)/(Math.PI/4)+8)%8];};
  // So that a map of many lands and places stays inside one request (lands travelled are never forgotten): the
  // nearest places of this land are told in full (with the errand's place and any the player named), the journeys on
  // offer to other lands in brief, the rest of this land by name and distance (morePlaces), and every other land in
  // brief (farLands: how far the road is, and for the nearest lands the places known there by name).
  const landHere=regionOfPlace(game,here),routeHere=id=>id===here?{feet:0,minutes:0}:travelRoute(game,here,id),minutesTo=id=>routeHere(id)?.minutes??Infinity;
  const thisLand=knownPlaceIds(game).filter(id=>regionOfPlace(game,id)===landHere).sort((a,b)=>minutesTo(a)-minutesTo(b));
  const inFull=new Set([here,game.story.errand?.place,...thisLand.slice(0,placesInFull),...placesNamed(game,input)].filter(Boolean));
  const inBrief=new Set(context.choices.filter(c=>c.id.startsWith('travel-')).map(c=>c.id.slice(7)).filter(id=>!inFull.has(id)));
  const toldOf=id=>inFull.has(id)||inBrief.has(id);
  const placeLine=id=>{const r=routeHere(id),way=wayTo(id);return placeName(game,id)+' ('+(r?distanceText(r.feet):'no known road')+(way?' '+way:'')+(visited.includes(id)?', visited':'')+')';};
  const others=thisLand.filter(id=>!toldOf(id));
  const farLands=lands.filter(l=>l.id!==landHere).map(l=>{const ids=knownPlaceIds(game).filter(id=>regionOfPlace(game,id)===l.id),near=ids.map(id=>({id,r:routeHere(id)})).filter(x=>x.r).sort((a,b)=>a.r.minutes-b.r.minutes)[0];
   return {name:l.name,minutes:near?.r.minutes??Infinity,...(near?{road:distanceText(near.r.feet)+', '+durationText(near.r.minutes)+' on the road to '+placeName(game,near.id)}:{}),ids:ids.filter(id=>!toldOf(id)),any:ids.length>0};}).filter(l=>l.any)
   .sort((a,b)=>a.minutes-b.minutes).map(({name,road,ids},i)=>({name,...(road?{road}:{}),...(i<landsInFull&&ids.length?{places:ids.map(id=>placeName(game,id)+(visited.includes(id)?'':' (heard of)'))}:{})}));
  context.world={current:{id:here,name:placeName(game,here),description:placeDescription(game,here),kind:worldPlace(game,here)?.kind??game.story.locations?.[here]?.kind??null},
   region:{name:landOf(here).name,terrain:landOf(here).terrain},regions:lands.map(r=>r.name),
   knownPlaces:knownPlaceIds(game).filter(toldOf).map(id=>{const r=routeHere(id),away=regionOfPlace(game,id)!==landHere?{land:landOf(id).name}:{};
    if(!inFull.has(id))return {id,name:placeName(game,id),distance:r?distanceText(r.feet):'unknown',minutes:r?.minutes??null,visited:visited.includes(id),...away};
    return {id,name:placeName(game,id),kind:worldPlace(game,id)?.kind??game.story.locations?.[id]?.kind??'starting place',description:briefText(placeDescription(game,id),id===here?300:120),distance:r?distanceText(r.feet):'unknown',bearing:wayTo(id),minutes:r?.minutes??null,visited:visited.includes(id),...(worldPlace(game,id)?.cleared?{cleared:true}:{}),...away};}),
   ...(others.length?{morePlaces:others.slice(0,placesByName).map(placeLine),...(others.length>placesByName?{morePlacesNotListed:others.length-placesByName}:{})}:{}),
   canDiscover:['inn','bridge','tower','wild'].includes(game.stage)&&!game.pendingSpell&&!game.npcCombat?.active&&(health?.current??1)>0&&mapHasRoom(game),placesLeft:maxWorldPlaces-worldPlaces(game).length,
   // Other lands, in brief: how far the road is (to the nearest place there) and the places known there by name.
   ...(farLands.length?{farLands}:{}),
   // Lands on the map (every land travelled is kept).
   landsRemembered:lands.length,
   canIntroduce:canMeetPeople(game)&&(health?.current??1)>0,peopleMet:Object.keys(game.people??{}).length,peopleHere:npcScene(game).filter(n=>n.present&&n.hp>0&&n.fate!=='dead'&&game.followers?.[n.id]?.status!=='following').length};
  // The ready-made people (the host's library) already met in this game, by number (np042 is 42), so the Dungeon
  // Master's server offers others.
  {const met=libraryPeopleMet(game);if(met.length)context.world.poolTaken=met.map(id=>Number(id.slice(2)));}
  // Distances are in world.knownPlaces.
  delete context.travelRoutes;
  // The tale's first move: the introduction the player has just read (storyRules.js), so the first answer keeps to it.
  if(!(game.playback??[]).some(t=>t.events.some(e=>e.kind==='player'))&&(game.playback?.at(-1)?.id??1)<=2){context.openingTurn=true;context.introduction=storyIntroduction(game);}
  if(game.stage==='wild')context.nearbyNPCs=[];
}
