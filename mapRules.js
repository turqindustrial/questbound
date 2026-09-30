// Authored world coordinates in feet; north is positive y. All marked paths are straight.
export const mapCoordinates={inn:{x:0,y:0},bridge:{x:900,y:0},tower:{x:900,y:1200},dungeon:{x:2700,y:0}};
export const mapPace=300; // Fixed exploration pace for this prototype, feet per minute.
export function mapRoute(from,to){const a=mapCoordinates[from],b=mapCoordinates[to];if(!a||!b)return null;if(from==='dungeon'&&to!=='dungeon')return {feet:1800+(to==='bridge'?0:mapRoute('bridge',to).feet),minutes:6+(to==='bridge'?0:mapRoute('bridge',to).minutes)};if(to==='dungeon'&&from!=='dungeon')return mapRoute('dungeon',from);const feet=Math.round(Math.hypot(a.x-b.x,a.y-b.y));return {feet,minutes:feet/mapPace};}
export const mapPlaces={dungeon:{name:'Lantern Vaults',symbol:'◇',description:'Beyond the bridge · eight chambers'},inn:{name:'Crossroads Inn',symbol:'⌂',description:'Warm hearth · shelter and rest'},bridge:{name:'Old Stone Bridge',symbol:'≋',description:'Blue sparks · the missing light'},tower:{name:'Abandoned Watchtower',symbol:'♜',description:'Weathered stone · a forgotten signal'}};
export function mapState(game) {
  return game.map??{visited:game.stage==='inn'?['inn']:['inn','bridge'],accepted:game.stage!=='inn',clue:false,peaceful:false,minutes:0};
}
export function mapLocation(game) {if(game.dungeon?.active)return 'dungeon';return ['inn','bridge','tower','dungeon'].includes(game.stage)?game.stage:['defeat','escaped'].includes(game.stage)?'inn':'bridge';}
export function validMap(game) {
  const m=game.map;if(m===undefined)return game.stage!=='tower';
  return !!m && Array.isArray(m.visited) && m.visited.length>=1 && m.visited.length<=4 && new Set(m.visited).size===m.visited.length && m.visited.every(id=>Object.hasOwn(mapPlaces,id)) && m.visited.includes('inn') && m.visited.includes(mapLocation(game)) && ['accepted','clue','peaceful'].every(k=>typeof m[k]==='boolean') && Number.isSafeInteger(m.minutes) && m.minutes>=0 && (!m.clue || m.visited.includes('tower')) && (!m.peaceful || (m.clue && game.stage==='victory')) && (game.stage==='inn' || m.accepted || Object.keys(game.npcMemory??{}).length>0);
}
export function travelError(game,destination) {
  if(destination==='dungeon')return 'Enter the vaults through the bridge approach.';
  if(!Object.hasOwn(mapPlaces,destination))return 'Choose a place on the map.';
  if(game.pendingSpell)return 'Resolve or cancel the pending spell first.';
  if(!['inn','bridge','tower'].includes(game.stage))return 'Finish this encounter or begin another adventure before traveling.';
  // The keeper's errand gates the crossroads adventure only; a written story is under way from its first scene.
  if(!game.story&&!mapState(game).accepted&&!Object.keys(game.npcMemory??{}).length)return 'Speak with the keeper before leaving the inn.';
  if(destination===game.stage)return 'You are already here.';
  return '';
}
export function travelTo(game,health,destination) {
  const route=mapRoute(mapLocation(game),destination);
  const map=mapState(game),next={...game,stage:destination,map:{...map,accepted:map.accepted||!!game.story,visited:[...new Set([...map.visited,destination])],minutes:map.minutes+route.minutes}};
  let hp=health?{...health}:health;
  // Timed magic advances by the actual route duration.
  if(next.concentration?.remaining!=null){next.concentration={...next.concentration,remaining:next.concentration.remaining-route.minutes*10};if(next.concentration.remaining<=0)delete next.concentration;}
  if(next.temporarySpell?.remaining!=null){next.temporarySpell={...next.temporarySpell,remaining:next.temporarySpell.remaining-route.minutes*10};if(next.temporarySpell.remaining<=0){if(hp)hp.temp=0;delete next.temporarySpell;}}
  next.log=[`You travel to ${mapPlaces[destination].name}. ${route.feet} ft; ${route.minutes} minutes pass.`,...game.log].slice(0,40);
  return {game:next,health:hp};
}
