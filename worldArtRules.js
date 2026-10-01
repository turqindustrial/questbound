import {mapPlaces,mapLocation,worldPlace,worldPlaces} from './mapRules';
import {dungeonRooms} from './dungeonRules';
import {npcScene} from './npcRules';
const originalNPCs={keeper:{name:'The keeper',description:'Middle-aged human innkeeper, short salt-and-pepper beard, brown hair, kind but firm eyes, linen shirt and russet waistcoat.'},mara:{name:'Mara',description:'Young adult human woman, brown skin, dark curly hair loosely braided, thoughtful eyes, practical teal traveling cloak, medicine courier with a satchel.'}};
export function npcArtSubject(game,id){
 const person=!game.story?.npcs?.[id]&&game.people?.[id];
 // Someone met while exploring is painted from how the Dungeon Master described them when they were met.
 if(person)return {campaignId:game.story?.id??'crossroads-v1',kind:'portrait',id,name:person.name,description:[person.appearance,person.species,person.role].filter(Boolean).join('. ').slice(0,1800),setting:(game.story?.premise??'').slice(0,800)};
 const npc=game.story?.npcs?.[id]??originalNPCs[id];if(!npc)return null;
 return {campaignId:game.story?.id??'crossroads-v1',kind:'portrait',id,name:npc.name,description:[npc.appearance,npc.role,npc.description].filter(Boolean).join('. ').slice(0,1800),setting:(game.story?.locations?.inn?.description??'Warm crossroads inn in an original fantasy world.').slice(0,800)};
}
export function locationArtSubject(game){
 const room=game.dungeon?.active?dungeonRooms[game.dungeon.room]:null,id=room?'dungeon-'+game.dungeon.room:mapLocation(game),place=room?{name:room.name,description:room.text}:game.story?.locations?.[id]??worldPlace(game,id)??mapPlaces[id];
 if(!place)return null;
 return {campaignId:game.story?.id??'crossroads-v1',kind:'landscape',id,name:place.name,description:place.description,setting:(game.story?.premise??'A crossroads inn, old stone bridge, ruined watchtower and buried lantern vaults in a forested valley.').slice(0,800)};
}
// The player's own hero, painted in the same style as everyone they meet. The identity follows who the hero is
// (name, species, class, look), not their level, so levelling up keeps the portrait.
export function heroArtSubject(hero){
 if(!hero?.name||!hero.class)return null;
 const species=hero.species??hero.race??'',look=[hero.description,(species+' '+hero.class).trim(),hero.background?'Former '+String(hero.background).toLowerCase():null,hero.age?'Age '+hero.age:null].filter(Boolean).join('. ');
 let h=7;for(const c of [hero.name,species,hero.class,hero.description??''].join('|').toLowerCase())h=(h*31+c.charCodeAt(0))>>>0;
 return {campaignId:'hero-'+h.toString(36),kind:'portrait',id:'hero',name:String(hero.name).slice(0,100),description:('The player character, an adventurer. '+look).slice(0,1800),setting:'An original high-fantasy world of roads, inns, ruins and wild places.'};
}
// The painting of a named place in this adventure (the same subject the scene uses when you are there), for the
// illustrated arrival plates in the story feed. Only surface places; the vaults have their own scenes.
export function placeArtSubject(game,name){
 const plain=text=>String(text??'').toLowerCase().replace(/^the\s+/,'').trim();
 const places={...(game.story?.locations??mapPlaces),...Object.fromEntries(worldPlaces(game).map(p=>[p.id,p]))},id=Object.keys(places).find(key=>key!=='dungeon'&&plain(places[key]?.name)===plain(name));
 if(!id)return null;
 return {campaignId:game.story?.id??'crossroads-v1',kind:'landscape',id,name:places[id].name,description:places[id].description,setting:(game.story?.premise??'A crossroads inn, old stone bridge, ruined watchtower and buried lantern vaults in a forested valley.').slice(0,800)};
}
export function creatureArtSubject(game){
 if(game.stage!=='combat')return null;
 // A creature met while exploring is painted from the Dungeon Master's description of it.
 if(game.wildFight){const w=game.wildFight;return {campaignId:game.story?.id??'crossroads-v1',kind:'creature',id:'wild-'+w.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,40),name:w.name,description:('A creature: '+w.name+'. '+w.appearance).slice(0,1800),setting:(locationArtSubject(game)?.description??'').slice(0,800)};}
 const room=game.dungeon?.active?dungeonRooms[game.dungeon.room]:null,name=room?.foe??game.story?.foe??'Lantern Wisp';
 return {campaignId:game.story?.id??'crossroads-v1',kind:'creature',id:room?'guardian-'+game.dungeon.room:'main-foe',name,description:room?'Creature: '+name+'. '+room.text:game.story?.foeAppearance??('A small original fantasy creature: '+name+'. '+(game.story?'':'A floating, pale blue magical light, with sparks and no humanoid face.')),setting:(locationArtSubject(game)?.description??'').slice(0,800)};
}
export function sceneArtSubjects(game){
 return [locationArtSubject(game),...npcScene(game).filter(n=>n.present&&n.hp>0).map(n=>npcArtSubject(game,n.id)),creatureArtSubject(game)].filter(Boolean);
}
