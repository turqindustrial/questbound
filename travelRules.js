// Travel as moves of the adventure step: to a known place, to a place found while exploring, and beyond the edge of
// the map (the roads, lands and room on the map are mapRules.js; moved from adventureRules.js).
import {travelError,travelTo,discoveryError,knownLand,letRumoursGo,discoveryRoom,discoverPlace,beyondError,roomToMake,goBeyond} from "./mapRules";
export function travelStep(step) {
  const {game, health, action, hp} = step;
  const error = travelError(game, action.destination);
  if (error) return {
    game,
    health,
    error
  };
  if (hp.current <= 0) return {
    game,
    health,
    error: 'You need to recover before traveling.'
  };
  const traveling={...game};delete traveling.npcCombat;return travelTo(traveling, hp, action.destination);
}
export function discoverStep(step) {
  const {game, health, action, hp} = step;
  const error = discoveryError(game, action);
  if (error) return {
    game,
    health,
    error
  };
  if (hp.current <= 0) return {
    game,
    health,
    error: 'You need to recover before exploring.'
  };
  const exploring={...game};delete exploring.npcCombat;
  // When the map is full, a rumour never followed (or a land never reached) gives way first; lands travelled are
  // never forgotten (mapRules.js roomToMake).
  const far=!!action.place?.region&&!knownLand(game,action.place.region.name);
  const room=letRumoursGo(exploring,discoveryRoom(exploring,far));
  const found=discoverPlace(room.game, hp, action, room);
  return room.lines.length&&!found.error?{...found,events:[...room.lines,...(found.events??[])]}:found;
}
// Beyond the edge of the map: a new land opens that way (a rumour or a land never reached giving way when the map
// is full; lands travelled are never forgotten) and the hero walks there; the trip takes days.
export function beyondStep(step) {
  const {game, health, action, hp} = step;
  const error = beyondError(game, action.bearing);
  if (error) return {game, health, error};
  if (hp.current <= 0) return {game, health, error: 'You need to recover before traveling.'};
  const leaving={...game};delete leaving.npcCombat;
  const room=letRumoursGo(leaving,roomToMake(leaving,{lands:1,places:1}));
  const trip=goBeyond(room.game, hp, action.bearing, room);
  return {game:trip.game, health:trip.health, events:[...room.lines, ...trip.events]};
}
