import {npcScene} from './npcRules';
import {combatBasics} from './combatRules';
import {encounterFoe} from './adventureRules';
import {spellDefense} from './spellRules';
import {dungeonRooms} from './dungeonRules';
import {npcArtSubject,creatureArtSubject} from './worldArtRules';
const scoreNames=['Strength','Dexterity','Constitution','Intelligence','Wisdom','Charisma'];
export function encounterEntities(hero,game,health){
 if(!hero)return [];
 const stats=combatBasics(hero),npcs=npcScene(game).map(n=>{
  const lore=game.story?.npcs?.[n.id];
  return {id:n.id,name:lore?.name??n.name,aliases:!game.story&&n.id==='keeper'?['keeper','the keeper','innkeeper','bartender']:[],species:lore?.species??(game.story?'Not recorded':'Human'),className:'Commoner',level:1,ac:n.ac,hp:n.hp,maximum:n.maximumHP,temp:0,scores:Object.fromEntries(scoreNames.map(a=>[a,10])),description:[lore?.role,lore?.appearance,lore?.personality].filter(Boolean).join('\n'),art:npcArtSubject(game,n.id),note:'Uses the current commoner combat profile. No adventuring class levels.'};
 });
 const creature=(scene,id)=>{
  const foe=encounterFoe(hero,scene),room=scene.dungeon?.active?dungeonRooms[scene.dungeon.room]:null;
  return {id,name:room?.foe??game.story?.foe??foe.name,aliases:!room&&!game.story?['wisp','the wisp']:[],species:room?'Construct':game.story?.foeSpecies??(game.story?'Not recorded':'Spirit'),className:'Creature',level:game.encounterLevel??hero.level,ac:foe.ac,hp:game.enemyHP,maximum:foe.maximum,temp:0,scores:Object.fromEntries(scoreNames.map(a=>[a,10+2*(foe.saves?.[a]??0)])),description:room?.text??game.story?.foeAppearance??'A floating light from the old lantern network.',art:creatureArtSubject({...scene,stage:'combat'}),note:'Custom encounter profile. Level is encounter scaling, not an adventuring class. Ability scores reflect the engine’s saving modifiers.'};
 };
 const main=creature({...game,dungeon:undefined},'foe');
 if(game.dungeon?.active){main.hp=null;for(const room of [2,6])if(game.dungeon.visited.includes(room)){const guardian=creature({...game,stage:'combat',dungeon:{...game.dungeon,room}},'guardian-'+room);guardian.hp=game.dungeon.cleared.includes(room)?0:game.stage==='combat'&&game.dungeon.room===room?game.enemyHP:null;npcs.push(guardian);}}
 return [{id:'player',name:hero.name,aliases:[],species:hero.species??hero.race,className:hero.class,level:hero.level,ac:spellDefense(game,stats.ac).ac,hp:health?.current??stats.hp,maximum:stats.hp,temp:health?.temp??0,scores:hero.scores,description:hero.description??'',note:''},...npcs,main];
}
export function combatRoster(entities,game){
 if(game.npcCombat){return game.npcCombat.order.map(actor=>({...entities.find(e=>e.id===actor.id),side:actor.side,initiative:actor.initiative})).filter(e=>e.id);}
 if(game.stage==='combat'||game.encounterInitiative){
  const id=game.dungeon?.active?'guardian-'+game.dungeon.room:'foe';
  return [entities.find(e=>e.id==='player'),entities.find(e=>e.id===id)].filter(Boolean).map(e=>({...e,side:e.id==='player'?'player':'enemy',initiative:game.encounterInitiative?.[e.id==='player'?'player':'foe']})).sort((a,b)=>(b.initiative??0)-(a.initiative??0));
 }
 return [];
}
export function entityMentions(text,entities){
 const aliases=entities.flatMap(e=>[e.name,...(e.aliases??[])].filter(Boolean).map(name=>({name,id:e.id}))).sort((a,b)=>b.name.length-a.name.length);
 const parts=[];let cursor=0,plain=0;
 const word=c=>!!c&&/[\p{L}\p{N}_]/u.test(c);
 while(cursor<text.length){
  const match=aliases.find(a=>text.slice(cursor,cursor+a.name.length).toLowerCase()===a.name.toLowerCase()&&!word(text[cursor-1])&&!word(text[cursor+a.name.length]));
  if(!match){cursor++;continue;}
  if(cursor>plain)parts.push({text:text.slice(plain,cursor)});
  parts.push({text:text.slice(cursor,cursor+match.name.length),id:match.id});cursor+=match.name.length;plain=cursor;
 }
 if(plain<text.length)parts.push({text:text.slice(plain)});
 return parts;
}
