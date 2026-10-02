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
export const maxWorldPlaces=30;
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
// The land a story starts in is its home region. A far journey (the Dungeon Master's discovery with a region) or an
// earlier chapter's country is a region of its own, drawn on its own sheet; a place belongs to the region of the
// place it was found from.
export const maxRegions=8;
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
 const fallen=game.stage==='dying'?game.dying?.place:game.stage==='dead'?game.death?.at:null;
 if(fallen)return fallen==='wild'?game.world?.at:fallen==='dungeon'?'bridge':fallen;
 return ['inn','bridge','tower','dungeon'].includes(game.stage)?game.stage:['defeat','escaped','dead'].includes(game.stage)?'inn':'bridge';
}
export function validWorld(game){
 const w=game.world;if(w===undefined)return game.stage!=='wild';
 const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
 if(!w||!game.story||!Array.isArray(w.places)||w.places.length>maxWorldPlaces)return false;
 const seen=new Set(coreIds),names=new Set(Object.values(game.story.locations).map(l=>l.name.trim().toLowerCase()));
 // Regions beyond the home one: r1…r9, each named, each with a terrain.
 if(w.regions!==undefined&&!(Array.isArray(w.regions)&&w.regions.length<maxRegions&&new Set(w.regions.map(r=>r?.id)).size===w.regions.length&&w.regions.every(r=>r&&/^r[1-9]$/.test(r.id)&&text(r.name,60)&&terrains.includes(r.terrain))))return false;
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
export function travelError(game,destination) {
  if(destination==='dungeon')return 'Enter the vaults through the bridge approach.';
  if(!Object.hasOwn(mapPlaces,destination)&&!worldPlace(game,destination))return 'Choose a place on the map.';
  if(game.pendingSpell)return 'Resolve or cancel the pending spell first.';
  if(!['inn','bridge','tower','wild'].includes(game.stage))return 'Finish this encounter or begin another adventure before traveling.';
  // The keeper's errand gates the crossroads adventure only; a written story is under way from its first scene.
  if(!game.story&&!mapState(game).accepted&&!Object.keys(game.npcMemory??{}).length)return 'Speak with the keeper before leaving the inn.';
  if(destination===mapLocation(game))return 'You are already here.';
  if(!travelRoute(game,mapLocation(game),destination))return 'No known path leads there.';
  return '';
}
export function travelTo(game,health,destination) {
  const route=travelRoute(game,mapLocation(game),destination),wild=!!worldPlace(game,destination);
  const map=mapState(game),next={...game,stage:wild?'wild':destination,map:{...map,accepted:map.accepted||!!game.story,visited:[...new Set([...map.visited,destination])],minutes:map.minutes+route.minutes}};
  if(game.world)next.world={...game.world,at:wild?destination:null};
  let hp=health?{...health}:health;
  // Timed magic advances by the actual route duration.
  if(next.concentration?.remaining!=null){next.concentration={...next.concentration,remaining:next.concentration.remaining-route.minutes*10};if(next.concentration.remaining<=0)delete next.concentration;}
  if(next.temporarySpell?.remaining!=null){next.temporarySpell={...next.temporarySpell,remaining:next.temporarySpell.remaining-route.minutes*10};if(next.temporarySpell.remaining<=0){if(hp)hp.temp=0;delete next.temporarySpell;}}
  // Starting places keep their legacy names in the line (a story retells them); found places are named as written.
  const name=wild?worldPlace(game,destination).name:mapPlaces[destination].name,legacy=!wild&&coreIds.includes(mapLocation(game))&&!game.story?.geography;
  next.log=[legacy?`You travel to ${name}. ${route.feet} ft; ${route.minutes} minutes pass.`:`You travel to ${name}. ${distanceText(route.feet)}; ${passingText(route.minutes)} pass.`,...game.log].slice(0,40);
  return {game:next,health:hp};
}
// Places a new story marks on the map from the start (heard of, not yet visited): up to four, each off one of the
// three starting places. What the story writer described badly is left out.
export function landmarkPlaces(story,landmarks){
 const places=[],names=new Set(Object.values(story.locations).map(l=>l.name.trim().toLowerCase())),text=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
 for(const l of Array.isArray(landmarks)?landmarks:[]){
  if(places.length>=4)break;
  if(!l||!text(l.name,2,60)||!text(l.description,10,300)||!placeKinds.includes(l.kind)||!Object.hasOwn(bearings,l.bearing)||typeof l.miles!=='number'||!Number.isFinite(l.miles))continue;
  const key=l.name.trim().toLowerCase();if(names.has(key))continue;names.add(key);
  // The compass point is a rough direction: each landmark lies a little off it, so no two maps share a grid.
  const from=coreIds.includes(l.from)?l.from:'inn',origin=story.geography?.at?.[from]??mapCoordinates[from],turn=(seededRandom('landmark:'+story.id+':'+key)()-.5)*.6,[bx,by]=bearings[l.bearing];
  const dx=bx*Math.cos(turn)-by*Math.sin(turn),dy=bx*Math.sin(turn)+by*Math.cos(turn),feet=Math.round(Math.max(.1,Math.min(12,l.miles))*FEET_PER_MILE);
  places.push({id:'p'+(places.length+1),name:l.name.trim(),description:l.description.trim(),kind:l.kind==='lair'?'wilds':l.kind,x:Math.round(origin.x+dx*feet),y:Math.round(origin.y+dy*feet),from,...(l.danger==='risky'?{danger:'risky'}:{}),...(text(l.feature,3,200)?{feature:l.feature.trim()}:{})});
 }
 return places;
}
// The Dungeon Master reveals a place: named, described, and set at a bearing and distance from where the hero is.
export function discoveryError(game,discovery){
 const d=discovery?.place,text=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
 if(!game.story)return 'New places can be found in a written story.';
 if(!['inn','bridge','tower','wild'].includes(game.stage))return 'Finish this encounter before exploring further.';
 if(game.pendingSpell)return 'Resolve or cancel the pending spell first.';
 // A place in a new land (region: its name and terrain) may lie days away; anything else is within a day's walk.
 const far=d?.region!==undefined&&d?.region!==null;
 if(far&&!(text(d.region?.name,2,60)&&terrains.includes(d.region?.terrain)))return 'That new land was not described clearly enough to map.';
 if(!d||!text(d.name,2,60)||!text(d.description,10,300)||!placeKinds.includes(d.kind)||!Object.hasOwn(bearings,d.bearing)||typeof d.miles!=='number'||!Number.isFinite(d.miles)||d.miles<0.1||d.miles>(far?300:12)||typeof discovery.travel!=='boolean')return 'That new place was not described clearly enough to map.';
 // Optional: how dangerous it is, one notable thing there, and (for a lair) the creature that lives there.
 if((d.danger!==undefined&&!placeDangers.includes(d.danger))||(d.feature!==undefined&&d.feature!==null&&!text(d.feature,3,200))||(d.lair!==undefined&&d.lair!==null&&!(d.danger==='lair'&&lairSketch(d.lair))))return 'That new place was not described clearly enough to map.';
 const key=d.name.trim().toLowerCase();
 if(Object.values(game.story.locations).some(l=>l.name.trim().toLowerCase()===key))return '';
 if(!worldPlaces(game).some(p=>p.name.trim().toLowerCase()===key)&&worldPlaces(game).length>=maxWorldPlaces)return 'Your map is full. Travel to places you already know.';
 return '';
}
export function discoverPlace(game,health,discovery){
 const d=discovery.place,key=d.name.trim().toLowerCase(),here=mapLocation(game);
 // A place that is already known is simply travelled to (or noted again).
 const existing=[...coreIds.map(id=>({id,name:game.story.locations[id].name})),...worldPlaces(game)].find(p=>p.name.trim().toLowerCase()===key);
 if(existing){if(!discovery.travel||existing.id===here)return {game,health,error:existing.id===here?'You are already here.':existing.name+' is already on your map.'};return travelTo(game,health,existing.id);}
 // The bearing is a rough direction: the place lies a little off the compass point (the same way every time).
 const from=placeCoordinates(game,here),turn=(seededRandom('place:'+game.story.id+':'+key)()-.5)*.6,[bx,by]=bearings[d.bearing],dx=bx*Math.cos(turn)-by*Math.sin(turn),dy=bx*Math.sin(turn)+by*Math.cos(turn),feet=Math.round(d.miles*FEET_PER_MILE);
 const n=Math.max(0,...worldPlaces(game).map(p=>Number(p.id.slice(1))))+1;
 // A new land gets its own map (unless it is one already known by that name, or the atlas is full); otherwise the
 // place belongs to the region it was found from.
 const regions=game.world?.regions??[],named=d.region?regions.find(r=>r.name.trim().toLowerCase()===d.region.name.trim().toLowerCase()):null;
 const fresh=d.region&&!named&&regions.length<maxRegions-1?{id:'r'+(Math.max(0,...regions.map(r=>Number(r.id.slice(1))))+1),name:d.region.name.trim(),terrain:d.region.terrain}:null;
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
