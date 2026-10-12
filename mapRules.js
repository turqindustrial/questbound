// Authored world coordinates in feet; north is positive y. All marked paths are straight.
export const mapCoordinates={inn:{x:0,y:0},bridge:{x:900,y:0},tower:{x:900,y:1200},dungeon:{x:2700,y:0}};
export const mapPace=300; // Fixed exploration pace for this prototype, feet per minute.
export function mapRoute(from,to){const a=mapCoordinates[from],b=mapCoordinates[to];if(!a||!b)return null;if(from==='dungeon'&&to!=='dungeon')return {feet:1800+(to==='bridge'?0:mapRoute('bridge',to).feet),minutes:6+(to==='bridge'?0:mapRoute('bridge',to).minutes)};if(to==='dungeon'&&from!=='dungeon')return mapRoute('dungeon',from);const feet=Math.round(Math.hypot(a.x-b.x,a.y-b.y));return {feet,minutes:feet/mapPace};}
export const mapPlaces={dungeon:{name:'Lantern Vaults',symbol:'◇',description:'Beyond the bridge · eight chambers'},inn:{name:'Crossroads Inn',symbol:'⌂',description:'Warm hearth · shelter and rest'},bridge:{name:'Old Stone Bridge',symbol:'≋',description:'Blue sparks · the missing light'},tower:{name:'Abandoned Watchtower',symbol:'♜',description:'Weathered stone · a forgotten signal'}};

// ---------- The wider region ----------
// A written story starts with three linked places. As the hero explores, the Dungeon Master reveals more places:
// each new one is linked to the place it was found from, at a bearing and distance, so the region grows into a
// network of points of interest. Travel follows the links; time passes by distance.
export const coreIds=['inn','bridge','tower'];
export const placeKinds=['settlement','camp','road','forest','wilds','mountain','water','ruin','cave','shrine','landmark','lair'];
export const placeIcons={settlement:'home',camp:'camp',road:'travel',forest:'leaf',wilds:'compass',mountain:'peak',water:'wave',ruin:'tower',cave:'door',shrine:'sun',landmark:'eye',lair:'skull'};
export const bearings={N:[0,1],NE:[.7071,.7071],E:[1,0],SE:[.7071,-.7071],S:[0,-1],SW:[-.7071,-.7071],W:[-1,0],NW:[-.7071,.7071]};
export const maxWorldPlaces=40;
export const placeDangers=['safe','risky','lair'];
// Kinds of creature a lair can hold (the encounter templates); kept here so the map rules stand alone.
export const lairTemplates=['bandit','wolf','goblin','skeleton','boar','spider','zombies','orc','wolves'];
const lairSketch=f=>!!f&&lairTemplates.includes(f.template)&&typeof f.name==='string'&&f.name.trim().length>0&&f.name.length<=60&&typeof f.appearance==='string'&&f.appearance.trim().length>0&&f.appearance.length<=400;
const FEET_PER_MILE=5280;
export const worldPlaces=game=>game.world?.places??[];
export function worldPlace(game,id){return worldPlaces(game).find(p=>p.id===id)??null;}
// Every known place id: the three starting places (in a story), then discovered ones.
export function knownPlaceIds(game){return [...(game.story?coreIds:[]),...worldPlaces(game).map(p=>p.id)];}

// ---------- Each story's own geography ----------
// Every written story has its own shape: where its three starting places lie from each other, and which of them are
// joined by a path (a line, a fork or a loop, never the same sketch twice). A save from before this (no geography)
// keeps the first sketch: a right-angled triangle with all three joined.
const hashText=text=>{let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
// A repeatable random stream from a word: the same story always draws the same land.
export function seededRandom(text){
 let a=hashText(text)||1;
 return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
}
export const terrains=['plains','forest','hills','mountains','coast','marsh','desert','snow','caverns'];
const corePairs=[['inn','bridge'],['bridge','tower'],['inn','tower']];
const compassAngle={N:90,NE:45,E:0,SE:-45,S:-90,SW:-135,W:180,NW:135};
export function validGeography(g){
 if(!g||typeof g!=='object'||!g.at||typeof g.at!=='object'||!Array.isArray(g.links)||g.links.length<2||g.links.length>3)return false;
 if(!coreIds.every(id=>g.at[id]&&Number.isSafeInteger(g.at[id].x)&&Number.isSafeInteger(g.at[id].y)&&Math.abs(g.at[id].x)<=2e5&&Math.abs(g.at[id].y)<=2e5)||g.at.inn.x!==0||g.at.inn.y!==0)return false;
 const keys=g.links.map(l=>Array.isArray(l)&&l.length===2?corePairs.findIndex(p=>(p[0]===l[0]&&p[1]===l[1])||(p[0]===l[1]&&p[1]===l[0])):-1);
 return !keys.includes(-1)&&new Set(keys).size===keys.length&&corePairs.every(([a,b])=>Math.hypot(g.at[a].x-g.at[b].x,g.at[a].y-g.at[b].y)>=300);
}
// The shape of a new story's starting places. layout (from the story writer) may say where the dangerous place and
// the place to investigate lie: {bridge:{bearing,miles},tower:{bearing,miles,from:'inn'|'bridge'}}; whatever it
// leaves out is drawn from the seed.
export function makeGeography(seed,layout=null){
 const random=seededRandom('geography:'+seed),radians=Math.PI/180;
 const hinted=h=>h&&Object.hasOwn(compassAngle,h.bearing)&&typeof h.miles==='number'&&Number.isFinite(h.miles)?{angle:compassAngle[h.bearing]+(random()-.5)*34,feet:Math.round(Math.max(.1,Math.min(8,h.miles))*5280)}:null;
 // Unhinted: any direction, from a few hundred yards to two and a half miles.
 const any=()=>({angle:random()*360,feet:Math.round(950*Math.pow(14,random()))});
 const step=(from,leg)=>({x:Math.round(from.x+Math.cos(leg.angle*radians)*leg.feet),y:Math.round(from.y+Math.sin(leg.angle*radians)*leg.feet)});
 const inn={x:0,y:0},first=hinted(layout?.bridge)??any(),bridge=step(inn,first);
 const via=['inn','bridge'].includes(layout?.tower?.from)?layout.tower.from:random()<.5?'inn':'bridge',origin=via==='inn'?inn:bridge;
 let second=hinted(layout?.tower)??any(),tower=step(origin,second);
 // A third place that would sit on top of another is swung round, then moved out, until it stands clear.
 const nearest=p=>Math.min(Math.hypot(p.x-inn.x,p.y-inn.y),Math.hypot(p.x-bridge.x,p.y-bridge.y)),clear=()=>Math.max(400,.4*Math.min(first.feet,second.feet));
 for(let i=0;i<7&&nearest(tower)<clear();i++){second={...second,angle:second.angle+47};tower=step(origin,second);}
 for(let i=0;i<20&&nearest(tower)<400;i++){second={...second,feet:second.feet+500};tower=step(origin,second);}
 const links=[['inn','bridge'],[via,'tower']],other=via==='inn'?bridge:inn;
 // Now and then the far side is a path too, when it is no longer than the other two.
 if(random()<.3&&Math.hypot(tower.x-other.x,tower.y-other.y)<=1.2*Math.max(first.feet,second.feet))links.push(via==='inn'?['bridge','tower']:['inn','tower']);
 return {at:{inn,bridge,tower},links};
}
export function placeCoordinates(game,id){const p=worldPlace(game,id);return p?{x:p.x,y:p.y}:game?.story?.geography?.at?.[id]??mapCoordinates[id]??null;}
export function placeName(game,id){if(id==='wild')id=game.world?.at;return worldPlace(game,id)?.name??game.story?.locations?.[id]?.name??mapPlaces[id]?.name??String(id??'');}
export function placeDescription(game,id){return worldPlace(game,id)?.description??game.story?.locations?.[id]?.description??mapPlaces[id]?.description??'';}
// Paths: between the three starting places as the story's geography says; each found place to where it was found from.
export function worldLinks(game){return [...(game?.story?.geography?.links??corePairs).map(l=>[l[0],l[1]]),...worldPlaces(game).map(p=>[p.from,p.id])];}

// ---------- Regions: one map sheet each ----------
// The land a story starts in is its home region. A far journey (the Dungeon Master's discovery with a region, or
// going beyond the edge of the map: goBeyond below) or an earlier chapter's country is a region of its own, drawn on
// its own sheet; a place belongs to the region of the place it was found from. Up to twelve lands are remembered
// (the home land and eleven others, r1…r19); when a new one opens and there is no room, the land longest unvisited
// is forgotten (forgetLand).
export const maxRegions=12;
const gentleTerrains=['plains','forest','hills','coast','marsh'];
export function homeRegion(game){const s=game?.story;return {id:'home',name:typeof s?.region==='string'&&s.region.trim()?s.region.trim():s?'Lands about '+s.locations.inn.name:'The Crossroads',terrain:terrains.includes(s?.terrain)?s.terrain:gentleTerrains[hashText('terrain:'+(s?.id??'crossroads'))%gentleTerrains.length]};}
export function mapRegions(game){return [homeRegion(game),...(game?.world?.regions??[])];}
export function regionOfPlace(game,id){return worldPlace(game,id)?.region??'home';}
export function regionPlaceIds(game,region){return knownPlaceIds(game).filter(id=>regionOfPlace(game,id)===region);}
export function currentRegion(game){return regionOfPlace(game,mapLocation(game));}
// A long road is walked eight hours a day: beyond that, each hour on the road takes three.
const roadMinutes=feet=>{const walk=Math.max(1,Math.round(feet/mapPace));return walk>480?walk*3:walk;};
// Shortest walking route between two known places along the paths.
export function travelRoute(game,from,to){
 if(!game.story?.geography&&(!game.world?.places?.length||(coreIds.includes(from)&&coreIds.includes(to))))return mapRoute(from,to);
 const ids=knownPlaceIds(game),dist=Object.fromEntries(ids.map(id=>[id,Infinity])),done=new Set();
 if(!(from in dist)||!(to in dist))return null;
 const edges=worldLinks(game).map(([a,b])=>{const p=placeCoordinates(game,a),q=placeCoordinates(game,b);return [a,b,Math.round(Math.hypot(p.x-q.x,p.y-q.y))];});
 dist[from]=0;
 while(done.size<ids.length){
  const here=ids.filter(id=>!done.has(id)).sort((a,b)=>dist[a]-dist[b])[0];if(dist[here]===Infinity)break;done.add(here);
  for(const [a,b,feet] of edges){if(a===here&&dist[here]+feet<dist[b])dist[b]=dist[here]+feet;if(b===here&&dist[here]+feet<dist[a])dist[a]=dist[here]+feet;}
 }
 if(dist[to]===Infinity)return null;
 return {feet:dist[to],minutes:roadMinutes(dist[to])};
}
// How a distance reads: feet when close, miles beyond a quarter mile.
export const distanceText=feet=>feet<1320?feet.toLocaleString()+' ft':(Math.round(feet/FEET_PER_MILE*10)/10)+' miles';
export const durationText=minutes=>minutes<90?minutes+' min':minutes<2880?(Math.round(minutes/6)/10)+' hours':(Math.round(minutes/144)/10)+' days';
const passingText=minutes=>minutes<90?minutes+' minutes':minutes<2880?(Math.round(minutes/6)/10)+' hours':(Math.round(minutes/144)/10)+' days';
export function mapState(game) {
  return game.map??{visited:game.stage==='inn'?['inn']:['inn','bridge'],accepted:game.stage!=='inn',clue:false,peaceful:false,minutes:0};
}
// Where the hero is. A dying or dead hero lies where they fell.
export function mapLocation(game) {
 if(game.dungeon?.active)return 'dungeon';
 if(game.wildFight)return game.wildFight.place;
 if(game.stage==='wild')return game.world?.at;
 // A party hero who is down or dead is carried with the party (partyView keeps where the party stands in party.stage).
 const carried=game.party?.stage;
 if(carried&&['dying','dead'].includes(game.stage))return carried==='wild'?game.world?.at:carried==='combat'?'bridge':['inn','bridge','tower'].includes(carried)?carried:'inn';
 const fallen=game.stage==='dying'?game.dying?.place:game.stage==='dead'?game.death?.at:null;
 if(fallen)return fallen==='wild'?game.world?.at:fallen==='dungeon'?'bridge':fallen;
 return ['inn','bridge','tower','dungeon'].includes(game.stage)?game.stage:['defeat','escaped','dead'].includes(game.stage)?'inn':'bridge';
}
export function validWorld(game){
 const w=game.world;if(w===undefined)return game.stage!=='wild';
 const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
 if(!w||!game.story||!Array.isArray(w.places)||w.places.length>maxWorldPlaces)return false;
 const seen=new Set(coreIds),names=new Set(Object.values(game.story.locations).map(l=>l.name.trim().toLowerCase()));
 // Regions beyond the home one: r1…r19, each named, each with a terrain, and (once visited) when the hero last arrived.
 if(w.regions!==undefined&&!(Array.isArray(w.regions)&&w.regions.length<maxRegions&&new Set(w.regions.map(r=>r?.id)).size===w.regions.length&&w.regions.every(r=>r&&/^r(?:[1-9]|1\d)$/.test(r.id)&&text(r.name,60)&&terrains.includes(r.terrain)&&(r.last===undefined||(Number.isSafeInteger(r.last)&&r.last>=0)))))return false;
 const regionIds=new Set((w.regions??[]).map(r=>r.id));
 for(const p of w.places){
  if(!p||!/^p\d{1,2}$/.test(p.id)||seen.has(p.id)||!text(p.name,60)||!text(p.description,300)||!placeKinds.includes(p.kind)||!Number.isSafeInteger(p.x)||!Number.isSafeInteger(p.y)||Math.abs(p.x)>2e7||Math.abs(p.y)>2e7||!seen.has(p.from)||(p.region!==undefined&&!regionIds.has(p.region)))return false;
  if((p.danger!==undefined&&!['risky','lair'].includes(p.danger))||(p.feature!==undefined&&!text(p.feature,200))||(p.cleared!==undefined&&p.cleared!==true)||(p.threat!==undefined&&!(lairSketch(p.threat)&&(p.threat.ally===undefined||lairSketch(p.threat.ally))&&(p.threat.hp===undefined||(Number.isInteger(p.threat.hp)&&p.threat.hp>=1&&p.threat.hp<=1000)))))return false;
  const key=p.name.trim().toLowerCase();if(names.has(key))return false;
  seen.add(p.id);names.add(key);
 }
 if(w.at!==null&&!w.places.some(p=>p.id===w.at))return false;
 return game.stage!=='wild'||w.at!==null;
}
export function validMap(game) {
  const m=game.map;if(m===undefined)return game.stage!=='tower'&&game.stage!=='wild';
  const known=new Set([...Object.keys(mapPlaces),...worldPlaces(game).map(p=>p.id)]);
  return validWorld(game) && !!m && Array.isArray(m.visited) && m.visited.length>=1 && m.visited.length<=4+worldPlaces(game).length && new Set(m.visited).size===m.visited.length && m.visited.every(id=>known.has(id)) && m.visited.includes('inn') && m.visited.includes(mapLocation(game)) && ['accepted','clue','peaceful'].every(k=>typeof m[k]==='boolean') && Number.isSafeInteger(m.minutes) && m.minutes>=0 && (!m.clue || m.visited.includes('tower')) && (!m.peaceful || (m.clue && game.stage==='victory')) && (game.stage==='inn' || m.accepted || Object.keys(game.npcMemory??{}).length>0);
}
// A party does not walk off and leave a friend dying where they fell (partyRules.js): their view of the world would
// lose its place. The name of the first other hero who is down, else null.
export function downPartyMember(game){
 const p=game?.party;if(!p?.members)return null;
 for(const [id,m] of Object.entries(p.members))if(id!==p.lead&&m?.status==='down'){try{return JSON.parse(m.character).name||'A friend';}catch{return 'A friend';}}
 return null;
}
export function travelError(game,destination) {
  if(destination==='dungeon')return 'Enter the vaults through the bridge approach.';
  if(!Object.hasOwn(mapPlaces,destination)&&!worldPlace(game,destination))return 'Choose a place on the map.';
  if(game.pendingSpell)return 'Resolve or cancel the pending spell first.';
  if(!['inn','bridge','tower','wild'].includes(game.stage))return 'Finish this encounter or begin another adventure before traveling.';
  {const down=downPartyMember(game);if(down)return down+' lies dying here. Help them up, or wait until they wake, before you travel.';}
  // The keeper's errand gates the crossroads adventure only; a written story is under way from its first scene.
  if(!game.story&&!mapState(game).accepted&&!Object.keys(game.npcMemory??{}).length)return 'Speak with the keeper before leaving the inn.';
  if(destination===mapLocation(game))return 'You are already here.';
  if(!travelRoute(game,mapLocation(game),destination))return 'No known path leads there.';
  return '';
}
// Minutes go by (a journey, a short rest, a retreat): a held spell and temporary hit points from a spell count down
// (ten rounds a minute) and end when their time is up.
export function timePasses(game,health,minutes){
  if(!(minutes>0))return {game,health};
  const next={...game};let hp=health?{...health}:health;
  if(next.concentration?.remaining!=null){next.concentration={...next.concentration,remaining:next.concentration.remaining-minutes*10};if(next.concentration.remaining<=0)delete next.concentration;}
  if(next.temporarySpell?.remaining!=null){next.temporarySpell={...next.temporarySpell,remaining:next.temporarySpell.remaining-minutes*10};if(next.temporarySpell.remaining<=0){if(hp)hp.temp=0;delete next.temporarySpell;}}
  return {game:next,health:hp};
}
export function travelTo(game,health,destination) {
  const route=travelRoute(game,mapLocation(game),destination),wild=!!worldPlace(game,destination);
  const map=mapState(game),moved={...game,stage:wild?'wild':destination,map:{...map,accepted:map.accepted||!!game.story,visited:[...new Set([...map.visited,destination])],minutes:map.minutes+route.minutes}};
  if(game.world)moved.world={...game.world,at:wild?destination:null};
  // When the hero last arrived in a land (the land longest unvisited is the first forgotten when the atlas is full).
  {const land=wild?worldPlace(game,destination).region:null;if(land&&moved.world.regions)moved.world.regions=moved.world.regions.map(r=>r.id===land?{...r,last:moved.map.minutes}:r);}
  // Timed magic advances by the actual route duration.
  const {game:next,health:hp}=timePasses(moved,health,route.minutes);
  // Starting places keep their legacy names in the line (a story retells them); found places are named as written.
  const name=wild?worldPlace(game,destination).name:mapPlaces[destination].name,legacy=!wild&&coreIds.includes(mapLocation(game))&&!game.story?.geography;
  next.log=[legacy?`You travel to ${name}. ${route.feet} ft; ${route.minutes} minutes pass.`:`You travel to ${name}. ${distanceText(route.feet)}; ${passingText(route.minutes)} pass.`,...game.log].slice(0,40);
  return {game:next,health:hp};
}
// Places a new story marks on the map from the start (heard of, not yet visited): up to six, each off one of the
// three starting places. What the story writer described badly is left out.
export const maxLandmarks=6;
export function landmarkPlaces(story,landmarks){
 const places=[],names=new Set(Object.values(story.locations).map(l=>l.name.trim().toLowerCase())),text=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
 for(const l of Array.isArray(landmarks)?landmarks:[]){
  if(places.length>=maxLandmarks)break;
  if(!l||!text(l.name,2,60)||!text(l.description,10,300)||!placeKinds.includes(l.kind)||!Object.hasOwn(bearings,l.bearing)||typeof l.miles!=='number'||!Number.isFinite(l.miles))continue;
  const key=l.name.trim().toLowerCase();if(names.has(key))continue;names.add(key);
  // The compass point is a rough direction: each landmark lies a little off it, so no two maps share a grid.
  const from=coreIds.includes(l.from)?l.from:'inn',origin=story.geography?.at?.[from]??mapCoordinates[from],turn=(seededRandom('landmark:'+story.id+':'+key)()-.5)*.6,[bx,by]=bearings[l.bearing];
  const dx=bx*Math.cos(turn)-by*Math.sin(turn),dy=bx*Math.sin(turn)+by*Math.cos(turn),feet=Math.round(Math.max(.1,Math.min(12,l.miles))*FEET_PER_MILE);
  places.push({id:'p'+(places.length+1),name:l.name.trim(),description:l.description.trim(),kind:l.kind==='lair'?'wilds':l.kind,x:Math.round(origin.x+dx*feet),y:Math.round(origin.y+dy*feet),from,...(l.danger==='risky'?{danger:'risky'}:{}),...(text(l.feature,3,200)?{feature:l.feature.trim()}:{})});
 }
 return places;
}
// Lands beyond the story's own country that the tale speaks of from the start (up to two): each is a region with its
// own map and one known place, days away by road from the starting place. `taken` are the places already marked.
export function farLandPlaces(story,lands,taken=[]){
 const regions=[],places=[],text=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
 const names=new Set([...Object.values(story.locations).map(l=>l.name),...taken.map(p=>p.name)].map(n=>n.trim().toLowerCase())),home=String(story.region??'').trim().toLowerCase();
 for(const l of Array.isArray(lands)?lands:[]){
  if(regions.length>=2)break;
  const p=l?.place;
  if(!l||!text(l.name,2,60)||!terrains.includes(l.terrain)||!Object.hasOwn(bearings,l.bearing)||typeof l.miles!=='number'||!Number.isFinite(l.miles)||!p||!text(p.name,2,60)||!text(p.description,10,300)||!placeKinds.includes(p.kind))continue;
  const land=l.name.trim().toLowerCase(),key=p.name.trim().toLowerCase();
  if(land===home||regions.some(r=>r.name.toLowerCase()===land)||names.has(key))continue;
  names.add(key);
  const id='r'+(regions.length+1),turn=(seededRandom('land:'+story.id+':'+land)()-.5)*.5,[bx,by]=bearings[l.bearing],dx=bx*Math.cos(turn)-by*Math.sin(turn),dy=bx*Math.sin(turn)+by*Math.cos(turn),feet=Math.round(Math.max(15,Math.min(300,l.miles))*FEET_PER_MILE);
  regions.push({id,name:l.name.trim(),terrain:l.terrain});
  places.push({id:'p'+(taken.length+places.length+1),name:p.name.trim(),description:p.description.trim(),kind:p.kind==='lair'?'wilds':p.kind,x:Math.round(dx*feet),y:Math.round(dy*feet),from:'inn',region:id,...(text(l.rumour,3,200)?{feature:l.rumour.trim()}:{})});
 }
 return {regions,places};
}
// The Dungeon Master reveals a place: named, described, and set at a bearing and distance from where the hero is.
export function discoveryError(game,discovery){
 const d=discovery?.place,text=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
 if(!game.story)return 'New places can be found in a written story.';
 if(!['inn','bridge','tower','wild'].includes(game.stage))return 'Finish this encounter before exploring further.';
 if(game.pendingSpell)return 'Resolve or cancel the pending spell first.';
 if(discovery?.travel){const down=downPartyMember(game);if(down)return down+' lies dying here. Help them up, or wait until they wake, before you travel.';}
 // A place in a new land (region: its name and terrain) may lie days away; anything else is within a day's walk.
 const far=d?.region!==undefined&&d?.region!==null;
 if(far&&!(text(d.region?.name,2,60)&&terrains.includes(d.region?.terrain)))return 'That new land was not described clearly enough to map.';
 if(!d||!text(d.name,2,60)||!text(d.description,10,300)||!placeKinds.includes(d.kind)||!Object.hasOwn(bearings,d.bearing)||typeof d.miles!=='number'||!Number.isFinite(d.miles)||d.miles<0.1||d.miles>(far?300:12)||typeof discovery.travel!=='boolean')return 'That new place was not described clearly enough to map.';
 // Optional: how dangerous it is, one notable thing there, and (for a lair) the creature that lives there.
 if((d.danger!==undefined&&!placeDangers.includes(d.danger))||(d.feature!==undefined&&d.feature!==null&&!text(d.feature,3,200))||(d.lair!==undefined&&d.lair!==null&&!(d.danger==='lair'&&lairSketch(d.lair))))return 'That new place was not described clearly enough to map.';
 const key=d.name.trim().toLowerCase();
 if(Object.values(game.story.locations).some(l=>l.name.trim().toLowerCase()===key))return '';
 if(!worldPlaces(game).some(p=>p.name.trim().toLowerCase()===key)&&!landsToForget(game,{places:1,lands:far&&!knownLand(game,d.region.name)?1:0}))return 'Your map is full. Travel to places you already know.';
 return '';
}
export function discoverPlace(game,health,discovery,also={places:[],regions:[]}){
 const d=discovery.place,key=d.name.trim().toLowerCase(),here=mapLocation(game);
 // A place that is already known is simply travelled to (or noted again).
 const existing=[...coreIds.map(id=>({id,name:game.story.locations[id].name})),...worldPlaces(game)].find(p=>p.name.trim().toLowerCase()===key);
 if(existing){if(!discovery.travel||existing.id===here)return {game,health,error:existing.id===here?'You are already here.':existing.name+' is already on your map.'};return travelTo(game,health,existing.id);}
 // The bearing is a rough direction: the place lies a little off the compass point (the same way every time).
 const from=placeCoordinates(game,here),turn=(seededRandom('place:'+game.story.id+':'+key)()-.5)*.6,[bx,by]=bearings[d.bearing],dx=bx*Math.cos(turn)-by*Math.sin(turn),dy=bx*Math.sin(turn)+by*Math.cos(turn),feet=Math.round(d.miles*FEET_PER_MILE);
 const n=Number(freePlaceId(game,also.places).slice(1));
 // A new land gets its own map (unless it is one already known by that name, or the atlas is full); otherwise the
 // place belongs to the region it was found from.
 const regions=game.world?.regions??[],named=d.region?knownLand(game,d.region.name):null;
 const fresh=d.region&&!named&&regions.length<maxRegions-1?{id:freeRegionId(game,also.regions),name:d.region.name.trim(),terrain:d.region.terrain}:null;
 const region=fresh?.id??named?.id??regionOfPlace(game,here);
 const place={id:'p'+n,name:d.name.trim(),description:d.description.trim(),kind:d.kind,x:Math.round(from.x+dx*feet),y:Math.round(from.y+dy*feet),from:here,...(region!=='home'?{region}:{}),
  ...(placeDangers.includes(d.danger)&&d.danger!=='safe'?{danger:d.danger}:{}),...(d.feature?{feature:d.feature.trim()}:{}),...(d.danger==='lair'&&d.lair?{threat:{template:d.lair.template,name:d.lair.name.trim(),appearance:d.lair.appearance.trim(),...(lairSketch(d.lair.ally)?{ally:{template:d.lair.ally.template,name:d.lair.ally.name.trim(),appearance:d.lair.ally.appearance.trim()}}:{})}}:{})};
 const world={...game.world,places:[...worldPlaces(game),place],at:game.world?.at??null,...(fresh?{regions:[...regions,fresh]}:{})};
 const line=`You learn the way to ${place.name}, ${distanceText(feet)} ${d.bearing} of ${placeName(game,here)}${fresh?', in a land new to you: '+fresh.name:''}.`;
 const found={...game,world,log:[line,...game.log].slice(0,40)};
 if(!discovery.travel)return {game:found,health,events:[line]};
 const trip=travelTo(found,health,place.id);
 return {...trip,events:[line,trip.game.log[0]]};
}

// ---------- Room on the map ----------
// Ids for new places and lands: the first free number (p1…p99, r1…r19). `also` holds ids that must not be used again
// in the same turn (those of a land forgotten to make room), so the story log never takes a new place for an old one.
export function freePlaceId(game,also=[]){const used=new Set([...worldPlaces(game).map(p=>p.id),...also]);for(let n=1;n<=99;n++)if(!used.has('p'+n))return 'p'+n;return null;}
export function freeRegionId(game,also=[]){const used=new Set([...(game?.world?.regions??[]).map(r=>r.id),...also]);for(let n=1;n<=19;n++)if(!used.has('r'+n))return 'r'+n;return null;}
export function knownLand(game,name){const key=String(name??'').trim().toLowerCase();return key?(game?.world?.regions??[]).find(r=>r.name.trim().toLowerCase()===key)??null:null;}
// A land the tale still speaks of (in the chapter under way or the next, an open lead or the errand) is kept.
function talePointsTo(game,region){
 const s=game?.story;if(!s)return false;
 const told=[s.chapters?.[s.chapter??0]?.goal,s.chapters?.[(s.chapter??0)+1]?.goal,...(s.leads??[]).filter(l=>!l.done).flatMap(l=>[l.title,l.hook]),s.errand?.task].filter(Boolean).join(' ').toLowerCase();
 return [region.name,...worldPlaces(game).filter(p=>p.region===region.id).map(p=>p.name)].some(n=>n.trim().length>=3&&told.includes(n.trim().toLowerCase()));
}
// Which lands to forget so that `lands` more lands and `places` more places fit: the lands longest unvisited first,
// never the home land, the land the hero stands in, one where a companion waits, or one the tale still points to.
// [] when there is room already; null when no land can be forgotten to make it.
export function landsToForget(game,{lands=0,places=0}={}){
 const regions=game?.world?.regions??[],all=worldPlaces(game);
 const fits=gone=>regions.length-gone.length+lands<=maxRegions-1&&all.filter(p=>!gone.includes(p.region)).length+places<=maxWorldPlaces;
 if(fits([]))return [];
 const here=currentRegion(game),waiting=new Set(Object.values(game.followers??{}).filter(f=>f?.status==='waiting').map(f=>regionOfPlace(game,f.location)));
 const order=regions.map((r,i)=>({r,i})).filter(({r})=>r.id!==here&&!waiting.has(r.id)&&!talePointsTo(game,r)).sort((a,b)=>(a.r.last??-1)-(b.r.last??-1)||a.i-b.i).map(({r})=>r.id);
 const gone=[];for(const id of order){gone.push(id);if(fits(gone))return gone;}
 return null;
}
// A land forgotten: its places leave the map (a road that ran through it now runs straight on), with what was
// remembered of them (visited, the fallen, a greeting on arrival). Its people are let go by the caller
// (npcRules.js forgetLands). Returns the game, the land's name and the ids of the places that went.
export function forgetLand(game,regionId){
 const region=(game.world?.regions??[]).find(r=>r.id===regionId);if(!region)return {game,name:null,places:[]};
 const gone=new Set(worldPlaces(game).filter(p=>p.region===regionId).map(p=>p.id)),byId=Object.fromEntries(worldPlaces(game).map(p=>[p.id,p]));
 const kept=worldPlaces(game).filter(p=>!gone.has(p.id)).map(p=>{let from=p.from;while(gone.has(from))from=byId[from].from;return from===p.from?p:{...p,from};});
 const regions=game.world.regions.filter(r=>r.id!==regionId),world={...game.world,places:kept};
 if(regions.length)world.regions=regions;else delete world.regions;
 const next={...game,world,map:{...mapState(game),visited:mapState(game).visited.filter(id=>!gone.has(id))}};
 if(game.spoils){next.spoils=game.spoils.filter(e=>!gone.has(e.place));if(!next.spoils.length)delete next.spoils;}
 if(game.firedTriggers)next.firedTriggers=game.firedTriggers.filter(t=>!gone.has(String(t).replace(/^arrive:/,'')));
 return {game:next,name:region.name,places:[...gone]};
}
// The map can take one more place (now, or once a far land is forgotten).
export const mapHasRoom=game=>worldPlaces(game).length<maxWorldPlaces||!!landsToForget(game,{places:1});

// ---------- Beyond the edge of the map ----------
// The player may walk off the edge of the land they are in, in any direction, at will: the game opens a new land out
// there (a region of its own, joined by a road to the place on that side of this land's map) with a place to arrive
// at and a landmark or two heard of on the way. Everything about it is drawn from a seed (the story, the land left
// and the direction), so every device and the campaign server agree; the Dungeon Master describes it on arrival.
export const beyondBearings=Object.keys(bearings);
export const beyondWords={N:'north',NE:'north-east',E:'east',SE:'south-east',S:'south',SW:'south-west',W:'west',NW:'north-west'};
const landRoots=['Ash','Bryn','Cal','Dun','Eld','Fal','Gar','Hal','Ister','Kel','Lor','Mar','Nor','Oss','Pell','Rav','Sel','Tor','Ul','Var','Wen','Yor','Ard','Bel','Cor','Dra','Esk','Fen','Gal','Hith','Ird','Kar'];
const landEnds=['mere','holt','dale','wick','moor','reach','vale','mark','ford','fell','garth','ley','combe','wold','strand'];
const landPatterns={plains:['The {R} Downs','The {W} Fields','{W}','The {R} Wold'],forest:['{R}wood','The {R} Weald','The {W} Forest'],hills:['The {R} Hills','The {W} Uplands','The {R} Fells'],mountains:['The {R} Peaks','The {W} Range','The {R} Heights'],coast:['The {R} Coast','The {W} Shore','The {R} Strand'],marsh:['The {R} Fens','The {W} Mire','The {R} Marshes'],desert:['The {R} Wastes','The {W} Sands','The {R} Barrens'],snow:['The {R} Icefields','The White {W}','The {R} Frostlands'],caverns:['The {R} Deeps','The Hollows of {W}','The {R} Underhalls']};
const placePatterns={settlement:['{W}','{R} Market','{W} Crossing'],camp:['{R} Camp','The {R} Waystation'],road:['The {R} Waystone','{R} Toll House'],water:['{R} Landing','{W} Ferry'],mountain:['{R} Pass','{R} Gate'],cave:['{R} Hollow','The {R} Stair'],forest:['{R} Lodge','{W} Clearing'],shrine:['Shrine of {W}','{R} Chapel'],ruin:['The Ruins of {W}','{R} Keep'],landmark:['The {R} Stone','{R} Beacon'],wilds:['{W} Edge','The {R} Barrows']};
const terrainLines={plains:'wide grassland under a big sky',forest:'old woods closing in on every side',hills:'green hills folded one behind another',mountains:'high peaks with snow on their shoulders',coast:'a grey sea breaking on the shore',marsh:'reed beds and black standing water',desert:'dunes and red rock baking in the sun',snow:'a white country under a low pale sun',caverns:'tunnels and halls deep under the earth'};
const kindNouns={settlement:'a small town',camp:'a camp of travellers',road:'a waystation on the road',water:'a landing on the water',mountain:'a pass between the heights',cave:'a cave mouth with a trodden path',forest:'a woodcutters\' lodge',shrine:'a wayside shrine',ruin:'an old ruin',landmark:'a standing stone',wilds:'the edge of the wild'};
const arrivalKinds={plains:'road',forest:'forest',hills:'shrine',mountains:'mountain',coast:'water',marsh:'water',desert:'camp',snow:'settlement',caverns:'cave'};
// Lands that lie that way lean toward that country: snow and peaks to the north, sand and sea to the south.
const leaning={N:['snow','mountains','hills','forest'],NE:['mountains','snow','forest'],E:['plains','hills','coast'],SE:['coast','marsh','plains'],S:['desert','coast','plains','marsh'],SW:['marsh','desert','coast'],W:['coast','forest','hills'],NW:['forest','hills','snow']};
const pickOf=(random,list)=>list[Math.floor(random()*list.length)%list.length];
// The place on this side of the map: the known place of this land that lies farthest in that direction.
export function edgePlace(game,bearing){
 const [bx,by]=bearings[bearing]??[0,1],land=currentRegion(game);
 let best=null,score=-Infinity;
 for(const id of regionPlaceIds(game,land)){const p=placeCoordinates(game,id);if(!p)continue;const v=p.x*bx+p.y*by;if(v>score+1e-6){score=v;best=id;}}
 return best??mapLocation(game);
}
export function beyondError(game,bearing){
 if(!game?.story)return 'Lands beyond the map are found in a written story.';
 if(!Object.hasOwn(bearings,bearing))return 'Choose a direction: north, south, east or west.';
 if(game.pendingSpell)return 'Resolve or cancel the pending spell first.';
 if(!['inn','bridge','tower','wild'].includes(game.stage)||game.wildFight||game.npcCombat?.active||game.dungeon?.active)return 'Finish this encounter before setting out for another land.';
 {const down=downPartyMember(game);if(down)return down+' lies dying here. Help them up, or wait until they wake, before you travel.';}
 if(!landsToForget(game,{lands:1,places:1}))return 'Your map is full. Travel to places you already know.';
 const edge=edgePlace(game,bearing);
 if(edge!==mapLocation(game)&&!travelRoute(game,mapLocation(game),edge))return 'No known road leads to that side of the map.';
 return '';
}
// The new land and its places, worked out from the seed (the game must already have room for them).
// `also`: ids not to use again (a land forgotten this turn).
export function beyondPlan(game,bearing,also={places:[],regions:[]}){
 const here=currentRegion(game),from=edgePlace(game,bearing),origin=placeCoordinates(game,from)??{x:0,y:0},count=(game.world?.regions??[]).length+worldPlaces(game).length;
 const random=seededRandom('beyond:'+(game.story?.id??'')+':'+here+':'+from+':'+bearing+':'+count);
 const homeTerrain=mapRegions(game).find(r=>r.id===here)?.terrain;
 const terrain=pickOf(random,[...leaning[bearing],...terrains].filter(t=>t!==homeTerrain));
 const taken=new Set([...mapRegions(game).map(r=>r.name),...Object.values(game.story.locations).map(l=>l.name),...worldPlaces(game).map(p=>p.name)].map(n=>n.trim().toLowerCase()));
 const word=()=>pickOf(random,landRoots)+pickOf(random,landEnds);
 const named=patterns=>{for(let i=0;i<12;i++){const n=pickOf(random,patterns).replace('{R}',pickOf(random,landRoots)).replace('{W}',word());if(!taken.has(n.toLowerCase())){taken.add(n.toLowerCase());return n;}}return null;};
 const region={id:freeRegionId(game,also.regions),name:named(landPatterns[terrain])??('The Land Beyond '+word()).slice(0,60),terrain};
 const ids=[],nextId=()=>{const id=freePlaceId(game,[...also.places,...ids]);ids.push(id);return id;};
 const [bx,by]=bearings[bearing],turn=(random()-.5)*.5,dx=bx*Math.cos(turn)-by*Math.sin(turn),dy=bx*Math.sin(turn)+by*Math.cos(turn),miles=Math.round(25+random()*45);
 const kind=random()<.5?'settlement':random()<.4?'camp':arrivalKinds[terrain];
 const at={x:Math.round(origin.x+dx*miles*FEET_PER_MILE),y:Math.round(origin.y+dy*miles*FEET_PER_MILE)};
 const arrival={id:nextId(),name:named(placePatterns[kind])??(region.name.replace(/^The /,'')+' Road').slice(0,60),description:(kindNouns[kind][0].toUpperCase()+kindNouns[kind].slice(1)+' where the road from '+placeName(game,from)+' comes into '+region.name+': '+terrainLines[terrain]+'.').slice(0,300),kind,...at,from,region:region.id};
 const places=[arrival],room=maxWorldPlaces-worldPlaces(game).length-1;
 // One or two places heard of on the way in, a few miles on.
 for(let i=0,n=Math.min(room,1+Math.floor(random()*2));i<n;i++){
  const k=pickOf(random,['ruin','shrine','wilds','landmark','forest','water',arrivalKinds[terrain]]),angle=random()*Math.PI*2,far=1+random()*5,name=named(placePatterns[k]);
  if(!name)continue;
  places.push({id:nextId(),name,description:(kindNouns[k][0].toUpperCase()+kindNouns[k].slice(1)+' in '+region.name+', a few miles from '+arrival.name+'.').slice(0,300),kind:k,x:Math.round(at.x+Math.cos(angle)*far*FEET_PER_MILE),y:Math.round(at.y+Math.sin(angle)*far*FEET_PER_MILE),from:arrival.id,region:region.id,...(k==='ruin'||k==='wilds'?{danger:'risky'}:{})});
 }
 return {region,places,from,miles};
}
// Setting out: the new land is put on the map and the hero walks there (eight hours a day: travelRoute).
export function goBeyond(game,health,bearing,also){
 const plan=beyondPlan(game,bearing,also),left=mapRegions(game).find(r=>r.id===currentRegion(game))?.name??'this land';
 const world={...(game.world??{at:null}),places:[...worldPlaces(game),...plan.places],regions:[...(game.world?.regions??[]),plan.region],at:game.world?.at??null};
 const line='You leave '+left+' by the road '+beyondWords[bearing]+' from '+placeName(game,plan.from)+', beyond the edge of your map, for a land new to you: '+plan.region.name+'.';
 const found={...game,world,log:[line,...game.log].slice(0,40)};
 const trip=travelTo(found,health,plan.places[0].id);
 return {...trip,events:[line,trip.game.log[0]],plan};
}
