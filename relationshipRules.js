import {npcProfiles} from './npcRules';
import {appendJournal,journalForGame} from './journalRules';
// How each named character feels about the player, and why. Attitudes run from hostile to devoted; deeds move them.
// Two marks are permanent: a grudge (the player killed or gravely harmed someone who matters to them, so they stay
// hostile whatever happens) and a bond (the player saved their life or someone who matters to them, so they never
// fall below friendly). A grudge outweighs a bond. Every change is remembered in the character's own words.
export const attitudeLevels=['hostile','unfriendly','indifferent','friendly','devoted'];
export const tieKinds=['family','beloved','close friend','friend','ally','acquaintance','rival','enemy'];
export const foeTieKinds=['kin','beloved','ally','neutral','enemy'];
export const deedChanges={pleased:1,grateful:2,offended:-1,angered:-2,bond:'bond',grudge:'grudge'};
const mattersDeeply=tie=>['family','beloved','close friend','friend'].includes(tie);
const npcIds=['keeper','mara'];
export const npcName=(game,id)=>game.story?.npcs?.[id]?.name??npcProfiles[id]?.name??id;
// How a character regards the other named character and the story's main foe (written into each story).
export function npcTies(game,id){
 const t=game.story?.npcs?.[id]?.ties;
 return {other:npcIds.find(x=>x!==id),toOther:tieKinds.includes(t?.other)?t.other:'acquaintance',toFoe:foeTieKinds.includes(t?.foe)?t.foe:game.story?'enemy':'neutral',note:typeof t?.note==='string'?t.note:null};
}
const responses={hostile:'Refuses to help the player and wants nothing to do with them.',unfriendly:'Wary and cold toward the player.',indifferent:'No strong feelings about the player.',friendly:'Warm toward the player and willing to help.',devoted:'Devoted to the player and eager to help.'};
// Apply one deed to one character: a step change (+1, -2…), a bond or a grudge. Returns the game and the lines to show.
export function recordDeed(game,id,change,text){
 if(!npcIds.includes(id)||game.npcFate?.[id]==='dead'||!text)return {game,lines:[]};
 const before=game.npcMemory?.[id],was=before?.attitude??'indifferent',name=npcName(game,id),lines=[];
 const entry={attitude:was,response:before?.response??responses[was],memories:[...(before?.memories??[])],...(before?.allegiance?{allegiance:before.allegiance}:{}),...(before?.grudge?{grudge:before.grudge}:{}),...(before?.bond?{bond:before.bond}:{})};
 let level=attitudeLevels.indexOf(was);if(level<0)level=2;
 if(change==='grudge'){if(!entry.grudge)lines.push(name+' will never forgive you.');entry.grudge=String(text).slice(0,200);}
 else if(change==='bond'){if(!entry.bond)lines.push(entry.grudge?name+' is grateful, but cannot forgive you.':name+' owes you a debt they will never forget.');entry.bond=String(text).slice(0,200);level=4;}
 else if(Number.isInteger(change))level=Math.max(0,Math.min(entry.bond?4:3,level+change));
 // Permanent marks: a grudge keeps them hostile; a bond keeps them at least friendly.
 const attitude=entry.grudge?'hostile':entry.bond?attitudeLevels[Math.max(3,level)]:attitudeLevels[level];
 if(attitude!==was&&!lines.length)lines.push(name+': '+attitude+' toward you.');
 entry.attitude=attitude;if(attitude!==was||change==='grudge'||change==='bond')entry.response=entry.grudge?'Holds a grudge against the player that will never fade: '+entry.grudge.slice(0,200):responses[attitude];
 entry.memories=[...entry.memories,String(text).slice(0,300)].slice(-12);
 let next={...game,npcMemory:{...game.npcMemory,[id]:entry}};
 // Someone who now hates the player will not travel with them.
 if(entry.grudge&&next.followers?.[id]&&next.followers[id].status!=='dismissed'){next.followers={...next.followers,[id]:{...next.followers[id],status:'dismissed',reason:'Left the party: '+entry.grudge.slice(0,380)}};delete entry.allegiance;lines.push(name+' leaves your party.');}
 if((change==='grudge'&&!before?.grudge)||(change==='bond'&&!before?.bond))next.journal=appendJournal(journalForGame(next),'encounter',(change==='grudge'?'A grudge: ':'A debt: ')+name,String(text).slice(0,300));
 return {game:next,lines};
}
// What this turn did to the people in the story, found by comparing the game before and after: a killing, a
// knockout, a life saved by healing, and the main foe's end. Applied to everyone it matters to, present or not;
// word gets around.
export function recordConsequences(before,after){
 let game=after;const lines=[];
 const apply=(id,change,text)=>{const r=recordDeed(game,id,change,text);game=r.game;lines.push(...r.lines);};
 const max=id=>npcProfiles[id].maximumHP,hp=(g,id)=>g.npcHP?.[id]??max(id);
 for(const id of npcIds){
  const name=npcName(after,id),killed=after.npcFate?.[id]==='dead'&&before.npcFate?.[id]!=='dead',knocked=after.npcFate?.[id]==='unconscious'&&before.npcFate?.[id]!=='unconscious'&&hp(before,id)>0,saved=hp(before,id)===0&&hp(after,id)>0&&after.npcFate?.[id]!=='dead';
  const other=npcIds.find(x=>x!==id),tie=npcTies(after,other).toOther,mine=tie==='beloved'?'my beloved':'my '+tie;
  if(killed){
   if(mattersDeeply(tie))apply(other,'grudge','The player killed '+name+', '+mine+'.');
   else if(['ally','acquaintance'].includes(tie))apply(other,-2,'The player killed '+name+'.');
   else apply(other,tie==='enemy'?1:0,'The player killed '+name+(tie==='enemy'?', whom I despised.':', my rival.'));
  }
  if(knocked&&mattersDeeply(tie))apply(other,-2,'The player beat '+name+', '+mine+', senseless.');
  else if(knocked&&tie!=='enemy')apply(other,-1,'The player beat '+name+' senseless.');
  if(saved){
   apply(id,'bond','The player saved my life when I lay dying.');
   if(mattersDeeply(tie))apply(other,'bond','The player saved the life of '+name+', '+mine+'.');
   else if(tie!=='enemy')apply(other,1,'The player saved '+name+'\'s life.');
  }
 }
 // The main foe's end matters to those who loved it and to those it threatened.
 if(after.story&&after.foeFate&&!before.foeFate){
  const foe=after.story.foe,slain=after.foeFate==='slain';
  for(const id of npcIds){
   const t=npcTies(after,id).toFoe;
   if(['kin','beloved'].includes(t))apply(id,slain?'grudge':1,slain?'The player killed '+foe+', '+(t==='kin'?'my own kin':'whom I loved')+'.':'The player spared '+foe+', '+(t==='kin'?'my own kin':'whom I loved')+'.');
   else if(t==='ally')apply(id,slain?-2:-1,'The player '+(slain?'killed':'defeated')+' '+foe+', my ally.');
   else if(t==='enemy')apply(id,1,'The player '+(slain?'killed':'defeated')+' the '+foe+' that threatened us.');
  }
 }
 return {game,lines};
}
// How a character's standing reads on screen, and its tone (for colour).
export function attitudeLabel(n){
 if(n?.fate==='dead')return {label:'Dead',tone:'dead'};
 if(n?.grudge)return {label:'Sworn enemy · will never forgive you',tone:'bad'};
 if(n?.attitude==='devoted'||n?.bond)return {label:'Devoted · owes you a debt',tone:'best'};
 return {hostile:{label:'Hostile · remembers what happened',tone:'bad'},unfriendly:{label:'Wary',tone:'warn'},friendly:{label:'Friendly',tone:'good'}}[n?.attitude]??{label:'Listening',tone:'calm'};
}
// The Dungeon Master's record of how a deed touched someone ("grateful", "angered", a bond or a grudge).
export function validDeeds(list,game){
 return Array.isArray(list)&&list.length<=2&&new Set(list.map(d=>d?.npcId)).size===list.length&&list.every(d=>d&&npcIds.includes(d.npcId)&&game.npcFate?.[d.npcId]!=='dead'&&Object.hasOwn(deedChanges,d.change)&&typeof d.memory==='string'&&d.memory.trim().length>=3&&d.memory.length<=200);
}
export function applyDeeds(game,list){
 let next=game;const lines=[];
 for(const d of list??[]){const r=recordDeed(next,d.npcId,deedChanges[d.change],d.memory.trim());next=r.game;lines.push(...r.lines);}
 return {game:next,lines};
}
export function validTies(t){
 return t===undefined||(!!t&&typeof t==='object'&&!Array.isArray(t)&&tieKinds.includes(t.other)&&foeTieKinds.includes(t.foe)&&(t.note===undefined||(typeof t.note==='string'&&t.note.length<=200)));
}
