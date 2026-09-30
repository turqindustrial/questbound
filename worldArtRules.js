import {mapPlaces,mapLocation} from './mapRules';
import {dungeonRooms} from './dungeonRules';
import {npcScene} from './npcRules';
const originalNPCs={keeper:{name:'The keeper',description:'Middle-aged human innkeeper, short salt-and-pepper beard, brown hair, kind but firm eyes, linen shirt and russet waistcoat.'},mara:{name:'Mara',description:'Young adult human woman, brown skin, dark curly hair loosely braided, thoughtful eyes, practical teal traveling cloak, medicine courier with a satchel.'}};
export function npcArtSubject(game,id){
 const npc=game.story?.npcs?.[id]??originalNPCs[id];if(!npc)return null;
 return {campaignId:game.story?.id??'crossroads-v1',kind:'portrait',id,name:npc.name,description:[npc.appearance,npc.role,npc.description].filter(Boolean).join('. ').slice(0,1800),setting:(game.story?.locations?.inn?.description??'Warm crossroads inn in an original fantasy world.').slice(0,800)};
}
export function locationArtSubject(game){
 const room=game.dungeon?.active?dungeonRooms[game.dungeon.room]:null,id=room?'dungeon-'+game.dungeon.room:mapLocation(game),place=room?{name:room.name,description:room.text}:game.story?.locations?.[id]??mapPlaces[id];
 if(!place)return null;
 return {campaignId:game.story?.id??'crossroads-v1',kind:'landscape',id,name:place.name,description:place.description,setting:(game.story?.premise??'A crossroads inn, old stone bridge, ruined watchtower and buried lantern vaults in a forested valley.').slice(0,800)};
}
export function creatureArtSubject(game){
 if(game.stage!=='combat')return null;
 const room=game.dungeon?.active?dungeonRooms[game.dungeon.room]:null,name=room?.foe??game.story?.foe??'Lantern Wisp';
 return {campaignId:game.story?.id??'crossroads-v1',kind:'creature',id:room?'guardian-'+game.dungeon.room:'main-foe',name,description:room?'Creature: '+name+'. '+room.text:game.story?.foeAppearance??('A small original fantasy creature: '+name+'. '+(game.story?'':'A floating, pale blue magical light, with sparks and no humanoid face.')),setting:(locationArtSubject(game)?.description??'').slice(0,800)};
}
export function sceneArtSubjects(game){
 return [locationArtSubject(game),...npcScene(game).filter(n=>n.present&&n.hp>0).map(n=>npcArtSubject(game,n.id)),creatureArtSubject(game)].filter(Boolean);
}
