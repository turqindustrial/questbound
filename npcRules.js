import {mapLocation} from './mapRules';
// Authored campaign relationships, not a universal D&D rule that all witnesses fight.
export const npcProfiles={
 keeper:{name:'The keeper',maximumHP:12,ac:10,knows:['mara'],response:'Defends the inn, refuses hospitality, and calls for help.'},
 mara:{name:'Mara',maximumHP:9,ac:10,knows:['keeper'],response:'Defends the keeper, helping distract an attacker; fights back when personally attacked.'},
};
// Every story has its two residents; the Dungeon Master can bring more named people into the region as the player
// meets them (game.people: n1…n12, each living at the place where they were met).
export const coreNpcIds=['keeper','mara'];
export const maxPeople=12,maxPeopleHere=3;
export const personToughness={frail:{maximumHP:4,ac:10},common:{maximumHP:9,ac:10},tough:{maximumHP:16,ac:13}};
export const isPersonId=id=>/^n(?:[1-9]|1[0-2])$/.test(String(id));
export const npcIdsOf=game=>[...coreNpcIds,...Object.keys(game?.people??{}).filter(isPersonId)];
export function npcProfile(game,id){
 const people=game?.people??{};
 if(Object.hasOwn(npcProfiles,id))return {...npcProfiles[id],knows:[...npcProfiles[id].knows,...Object.keys(people).filter(p=>people[p]?.tie?.to===id)]};
 const p=people[id];if(!isPersonId(id)||!p)return null;
 const t=personToughness[p.toughness]??personToughness.common;
 return {name:p.name,maximumHP:t.maximumHP,ac:t.ac,knows:npcIdsOf(game).filter(o=>o!==id&&(p.tie?.to===o||people[o]?.tie?.to===id)),response:'Defends themselves and those they care about.'};
}
export const npcMaxHP=(id,game)=>npcProfile(game,id)?.maximumHP??10;
// Who someone is, for the Dungeon Master, portraits and the screen: the story's residents, the people met since, or
// the original crossroads pair.
const crossroadsLore={keeper:{role:'Keeper of the Crossroads Inn',motive:'Keep the inn and its guests safe.',personality:null,appearance:null,species:'Human'},mara:{role:'Traveling medicine courier',motive:'Keep travelers safe and deliver medicine.',personality:null,appearance:null,species:'Human'}};
export function npcLore(game,id){
 const s=game?.story?.npcs?.[id];
 if(s)return {name:s.name,role:s.role,motive:s.motive,personality:s.personality??null,appearance:s.appearance??null,species:s.species??null};
 const p=game?.people?.[id];
 if(p&&isPersonId(id))return {name:p.name,role:p.role,motive:p.motive??null,personality:p.personality||null,appearance:p.appearance,species:p.species||null};
 return npcProfiles[id]?{name:npcProfiles[id].name,...crossroadsLore[id]}:null;
}
// Players address people by full name, first name or surname ("Tobin", "Brask"); titles alone do not count.
const nameTitles=['the','captain','lady','lord','sir','dame','master','mistress','old','elder','brother','sister','father','mother','keeper','doctor','healer','aunt','uncle','young'];
export function mentionsName(text,name,atStart=false){
 const q=text.toLowerCase().trim(),full=name.toLowerCase();
 if(atStart?q.startsWith(full):q.includes(full))return true;
 return full.split(/[\s,]+/).filter(t=>t.length>=3&&!nameTitles.includes(t)).some(t=>new RegExp((atStart?'^':'(^|[^a-z])')+t.replace(/[^a-z0-9]/g,'\\$&')+'($|[^a-z])').test(q));
}
// Where the scene is, for people: a place id, or a vault room.
export const sceneLocation=game=>game.dungeon?.active?'dungeon:'+game.dungeon.room:['wild','dying','dead'].includes(game.stage)?mapLocation(game):['combat','victory'].includes(game.stage)?(game.wildFight?game.wildFight.place:'bridge'):['defeat','escaped'].includes(game.stage)?'inn':game.stage;
export function npcScene(game){
 const location=sceneLocation(game);
 return npcIdsOf(game).map(id=>{
  const p=npcProfile(game,id),person=game.people?.[id];
  // Followers go where the player goes; people met on the road stay where they live, and step aside from a fight.
  const present=game.followers?.[id]?game.followers[id].status==='following'||game.followers[id].location===location:person?person.home===location&&!['combat','dying','dead'].includes(game.stage)&&!game.dungeon?.active:game.stage==='inn'&&!game.dungeon?.active;
  return {id,...p,fate:game.npcFate?.[id]??null,grudge:game.npcMemory?.[id]?.grudge??null,bond:game.npcMemory?.[id]?.bond??null,present,hp:game.npcHP?.[id]??p.maximumHP,attitude:game.npcMemory?.[id]?.attitude??'indifferent',memories:game.npcMemory?.[id]?.memories??[],response:game.npcMemory?.[id]?.response??'No hostile response recorded.'};
 });
}
export function recordNpcAggression(before,after,target,kind){
 const victim=npcProfile(before,target);
 if(!victim)return after;
 const scene=npcScene(before),witnesses=scene.filter(n=>n.present&&n.hp>0).map(n=>n.id);
 if(!witnesses.includes(target)&&!scene.some(n=>n.id===target&&n.present))return after;
 const location=sceneLocation(before),max=victim.maximumHP;
 const event={kind,actor:'player',target,location,witnesses,damage:Math.max(0,(before.npcHP?.[target]??max)-(after.npcHP?.[target]??max))};
 const memory={...after.npcMemory},logs=[],killed=after.npcFate?.[target]==='dead'&&before.npcFate?.[target]!=='dead';
 for(const id of witnesses){
  const p=npcProfile(before,id),personal=id===target,knowsVictim=p.knows.includes(target);
  const text=personal?(killed?'The player killed you.':`The player attacked you (${kind}).`):killed?`You saw the player kill ${victim.name}${knowsVictim?', whom you knew':''}.`:`You witnessed the player attack ${victim.name}${knowsVictim?', whom you know':''} (${kind}).`;
  // A grudge keeps someone hostile; a bond (the player once saved them or someone dear) keeps them at least friendly.
  const raw=killed&&!personal?'hostile':!personal&&memory[id]?.allegiance==='player'?'indifferent':personal||knowsVictim?'hostile':'unfriendly';
  const attitude=memory[id]?.grudge?'hostile':memory[id]?.bond&&['hostile','unfriendly','indifferent'].includes(raw)?'friendly':raw;
  const response=after.npcFate?.[id]==='dead'?'Dead.':(after.npcHP?.[id]??p.maximumHP)<=0?'Unconscious; cannot speak or act.':!personal&&memory[id]?.allegiance==='player'&&!killed?'Defends the player against the opposition.':['friendly','devoted'].includes(attitude)?'Shaken by the violence, but still loyal to the player.':p.response;
  const changed=memory[id]?.attitude!==attitude||memory[id]?.response!==response;
  memory[id]={...memory[id],attitude,response,memories:[...(memory[id]?.memories??[]),text].slice(-12)};
  // The dead say nothing; a story's people are described by the story, not the crossroads defaults.
  if(changed&&after.npcFate?.[id]!=='dead')logs.push(`${p.name}: ${attitude} toward you.`+(before.story?'':' '+response));
 }
 let followers=after.followers;
 if(followers?.[target]&&followers[target].status!=='dismissed'){
  followers={...followers,[target]:{...followers[target],status:'dismissed',location:/^dungeon/.test(location)?'inn':location,reason:killed?'Killed by the player.':'Left after being attacked by the player.'}};
  memory[target]={...memory[target]};delete memory[target].allegiance;
 }
 return {...after,followers,npcMemory:memory,actionEvents:[...(after.actionEvents??[]),event].slice(-30),log:[...logs,...after.log].slice(0,40)};
}
export function npcCombatParticipants(game,target){
 return npcScene(game).filter(n=>n.present&&n.hp>0).flatMap(n=>{
  if(n.id===target)return [{id:n.id,side:'enemy',role:'attack'}];
  if(game.npcMemory?.[n.id]?.allegiance==='player')return [{id:n.id,side:'ally',role:'attack'}];
  if(n.knows.includes(target))return [{id:n.id,side:'enemy',role:n.id==='mara'?'help':'attack'}];
  return [];
 });
}
// Fights with people happen wherever people are: the starting places and places found while exploring.
export const npcFightStages=['inn','bridge','tower','wild'];
export function validNpcCombat(game){
 const c=game.npcCombat;if(c===undefined)return true;
 const ids=['player',...npcIdsOf(game)];
 if(!c||!Array.isArray(c.order)||!c.order.every(n=>n&&typeof n==='object'&&(n.id==='player'?n.side==='player':['enemy','ally'].includes(n.side))))return false;
 return c&&npcFightStages.includes(game.stage)&&typeof c.active==='boolean'&&Number.isInteger(c.round)&&c.round>=1&&c.round<=100000&&Array.isArray(c.order)&&c.order.length>=2&&c.order.length<=10&&new Set(c.order.map(n=>n.id)).size===c.order.length&&c.order.filter(n=>n.id==='player'&&n.side==='player').length===1&&c.order.every(n=>n&&ids.includes(n.id)&&['player','enemy','ally'].includes(n.side)&&['attack','help'].includes(n.role)&&Number.isInteger(n.initiative)&&n.initiative>=-10&&n.initiative<=50)&&(c.help===null||c.help==='enemy'||c.help==='ally');
}
export function validNpcState(game){
 const text=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max,known=npcIdsOf(game);
 const ids=v=>Array.isArray(v)&&v.length<=10&&new Set(v).size===v.length&&v.every(id=>known.includes(id));
 return validNpcCombat(game)&&(game.npcMemory===undefined||(game.npcMemory&&typeof game.npcMemory==='object'&&!Array.isArray(game.npcMemory)&&Object.entries(game.npcMemory).every(([id,m])=>known.includes(id)&&m&&['hostile','unfriendly','indifferent','friendly','devoted'].includes(m.attitude)&&(m.allegiance===undefined||m.allegiance==='player')&&text(m.response,300)&&Array.isArray(m.memories)&&m.memories.length<=12&&m.memories.every(t=>text(t,300))&&(m.grudge===undefined||text(m.grudge,200))&&(m.bond===undefined||text(m.bond,200))&&(!m.grudge||m.attitude==='hostile')&&(!m.bond||m.grudge||['friendly','devoted'].includes(m.attitude)))))
 &&(game.actionEvents===undefined||(Array.isArray(game.actionEvents)&&game.actionEvents.length<=30&&game.actionEvents.every(e=>e&&['weapon-attack','harmful-spell'].includes(e.kind)&&e.actor==='player'&&known.includes(e.target)&&/^(?:inn|bridge|tower|dungeon:[0-7]|p\d{1,2})$/.test(e.location)&&ids(e.witnesses)&&Number.isInteger(e.damage)&&e.damage>=0&&e.damage<=40)));
}

export function npcServiceError(game,action){
 const provider=action==='share-supper'?'mara':['long-rest','ask-rumors','check:persuade-keeper','listen','study','claim-reward','start-lens','deliver-lens'].includes(action)?'keeper':null;
 if(!provider)return '';
 const npc=npcScene(game).find(n=>n.id===provider);
 if(!npc.present&&game.followers?.[provider])return npc.name+' is elsewhere and cannot offer this service here.';
 if(npc.hp<=0)return npc.name+(npc.fate==='dead'?' is dead.':' is unconscious and cannot offer this service.');
 if(npc.attitude==='hostile')return npc.name+' refuses to help after the attack. You can leave or talk about what happened; an apology does not automatically restore trust.';
 return '';
}
