import {npcProfiles,npcProfile,npcIdsOf,coreNpcIds,isPersonId,maxPeople,maxPeopleHere,personToughness,sceneLocation,genders} from './npcRules';
import {appendJournal,journalForGame} from './journalRules';
import {seededRandom} from './mapRules';
// How each named character feels about the player, and why. Attitudes run from hostile to devoted; deeds move them.
// Two marks are permanent: a grudge (the player killed or gravely harmed someone who matters to them, so they stay
// hostile whatever happens) and a bond (the player saved their life or someone who matters to them, so they never
// fall below friendly). A grudge outweighs a bond. Every change is remembered in the character's own words.
export const attitudeLevels=['hostile','unfriendly','indifferent','friendly','devoted'];
export const tieKinds=['family','beloved','close friend','friend','ally','acquaintance','rival','enemy'];
export const foeTieKinds=['kin','beloved','ally','neutral','enemy'];
export const deedChanges={pleased:1,grateful:2,offended:-1,angered:-2,bond:'bond',grudge:'grudge'};
const mattersDeeply=tie=>['family','beloved','close friend','friend'].includes(tie);
export const npcName=(game,id)=>game.story?.npcs?.[id]?.name??npcProfile(game,id)?.name??npcProfiles[id]?.name??id;
// How one character regards another: the story's two residents always know each other; someone met later has at
// most one tie, to a character already known, and it runs both ways. Strangers have no tie (null).
export function tieBetween(game,from,to){
 if(from===to)return null;
 if(coreNpcIds.includes(from)&&coreNpcIds.includes(to)){const t=game.story?.npcs?.[from]?.ties;return tieKinds.includes(t?.other)?t.other:'acquaintance';}
 const a=game.people?.[from],b=game.people?.[to];
 if(a?.tie?.to===to)return a.tie.kind;
 if(b?.tie?.to===from)return b.tie.kind;
 return null;
}
export const foeTie=(game,id)=>{if(coreNpcIds.includes(id)){const t=game.story?.npcs?.[id]?.ties?.foe;return foeTieKinds.includes(t)?t:game.story?'enemy':'neutral';}return foeTieKinds.includes(game.people?.[id]?.foe)?game.people[id].foe:'neutral';};
// How a character regards the others and the story's main foe (written into each story, or given when they were met).
export function npcTies(game,id){
 const t=game.story?.npcs?.[id]?.ties,core=coreNpcIds.includes(id),other=core?coreNpcIds.find(x=>x!==id):game.people?.[id]?.tie?.to??null;
 const all=npcIdsOf(game).map(o=>({id:o,kind:tieBetween(game,id,o)})).filter(x=>x.kind).map(x=>({...x,name:npcName(game,x.id)}));
 return {other,toOther:other?tieBetween(game,id,other):null,toFoe:foeTie(game,id),note:core&&typeof t?.note==='string'?t.note:null,all};
}
const responses={hostile:'Refuses to help the player and wants nothing to do with them.',unfriendly:'Wary and cold toward the player.',indifferent:'No strong feelings about the player.',friendly:'Warm toward the player and willing to help.',devoted:'Devoted to the player and eager to help.'};
// Apply one deed to one character: a step change (+1, -2…), a bond or a grudge. Returns the game and the lines to show.
export function recordDeed(game,id,change,text){
 if(!npcIdsOf(game).includes(id)||game.npcFate?.[id]==='dead'||!text)return {game,lines:[]};
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
 let game=after;const lines=[],ids=npcIdsOf(after);
 const apply=(id,change,text)=>{const r=recordDeed(game,id,change,text);game=r.game;lines.push(...r.lines);};
 const max=id=>npcProfile(after,id).maximumHP,hp=(g,id)=>g.npcHP?.[id]??max(id);
 for(const id of ids){
  const name=npcName(after,id),killed=after.npcFate?.[id]==='dead'&&before.npcFate?.[id]!=='dead',knocked=after.npcFate?.[id]==='unconscious'&&before.npcFate?.[id]!=='unconscious'&&hp(before,id)>0,saved=hp(before,id)===0&&hp(after,id)>0&&after.npcFate?.[id]!=='dead';
  if(!killed&&!knocked&&!saved)continue;
  if(saved)apply(id,'bond','The player saved my life when I lay dying.');
  for(const other of ids){
   const tie=tieBetween(after,other,id);if(!tie)continue;
   const mine=tie==='beloved'?'my beloved':'my '+tie;
   if(killed){
    if(mattersDeeply(tie))apply(other,'grudge','The player killed '+name+', '+mine+'.');
    else if(['ally','acquaintance'].includes(tie))apply(other,-2,'The player killed '+name+'.');
    else apply(other,tie==='enemy'?1:0,'The player killed '+name+(tie==='enemy'?', whom I despised.':', my rival.'));
   }
   if(knocked&&mattersDeeply(tie))apply(other,-2,'The player beat '+name+', '+mine+', senseless.');
   else if(knocked&&tie!=='enemy')apply(other,-1,'The player beat '+name+' senseless.');
   if(saved){
    if(mattersDeeply(tie))apply(other,'bond','The player saved the life of '+name+', '+mine+'.');
    else if(tie!=='enemy')apply(other,1,'The player saved '+name+'\'s life.');
   }
  }
 }
 // The main foe's end matters to those who loved it and to those it threatened.
 if(after.story&&after.foeFate&&!before.foeFate){
  const foe=after.story.foe,slain=after.foeFate==='slain';
  for(const id of ids){
   const t=foeTie(after,id);
   if(['kin','beloved'].includes(t))apply(id,slain?'grudge':1,slain?'The player killed '+foe+', '+(t==='kin'?'my own kin':'whom I loved')+'.':'The player spared '+foe+', '+(t==='kin'?'my own kin':'whom I loved')+'.');
   else if(t==='ally')apply(id,slain?-2:-1,'The player '+(slain?'killed':'defeated')+' '+foe+', my ally.');
   else if(t==='enemy')apply(id,1,'The player '+(slain?'killed':'defeated')+' the '+foe+' that threatened us.');
  }
 }
 return {game,lines};
}
// ---------- How people take to the hero's kind ----------
// Everyone has a view of the hero's species before a word is said: kin (one of their own), warm, curious,
// indifferent, wary or scornful, with a reason. The story writer or the Dungeon Master may give it (regard on the
// character); otherwise it is drawn from who they are and how that species is commonly seen, the same way every
// time. It sets the first impression (how they feel on meeting) and sways attempts to win them over with words;
// deeds still move people as before, and someone the hero has won over stops holding their kind against them.
export const regardStances=['kin','warm','curious','indifferent','wary','scornful'];
export const validRegard=r=>r===undefined||(!!r&&typeof r==='object'&&regardStances.includes(r.stance)&&typeof r.reason==='string'&&r.reason.length<=200);
export const speciesPlurals={Human:'humans',Dwarf:'dwarves',Elf:'elves','Dark Elf':'dark elves',Gnome:'gnomes',Goblin:'goblins',Goliath:'goliaths','Half-Elf':'half-elves',Halfling:'halflings',Orc:'orcs',Tiefling:'tieflings',Dragonborn:'dragonborn'};
export const speciesPlural=species=>{const s=String(species??'').trim();return speciesPlurals[s]??(s?s.toLowerCase()+' folk':'strangers');};
// How each kind is commonly met by strangers: weights for warm, curious, indifferent, wary, scornful.
const reputations={Human:[2,1,6,1,0],Dwarf:[3,1,4,2,0],Elf:[2,3,3,2,0],'Dark Elf':[0,2,2,5,1],Gnome:[3,3,3,1,0],Goblin:[0,1,2,5,2],Goliath:[1,4,3,2,0],'Half-Elf':[2,2,5,1,0],Halfling:[4,1,4,1,0],Orc:[0,1,2,5,2],Tiefling:[0,2,2,5,1],Dragonborn:[1,4,2,3,0]};
const regardReasons={kin:'One of their own kind.',warm:'Has always got on well with {kind}.',curious:'Has met few {kind} and is full of questions.',indifferent:'',wary:'Has heard hard things about {kind} and keeps their guard up.',scornful:'Thinks little of {kind} and does not hide it.'};
const sameKind=(a,b)=>{const x=String(a??'').toLowerCase(),y=String(b??'').toLowerCase();return !!x&&!!y&&(x===y||x.split(/[^a-z]+/).includes(y)||y.split(/[^a-z]+/).includes(x));};
export function speciesRegard(game,id,hero){
 const species=hero?.species??hero?.race??'',kind=speciesPlural(species),written=game?.story?.npcs?.[id]?.regard??game?.people?.[id]?.regard;
 const lore=game?.story?.npcs?.[id]??game?.people?.[id]??null,name=lore?.name??npcProfiles[id]?.name??id;
 const made=(stance,reason)=>({stance,reason:(reason&&reason.trim()?reason.trim():regardReasons[stance].replace('{kind}',kind)),species,kind});
 if(written&&regardStances.includes(written.stance))return made(written.stance,written.reason);
 if(sameKind(lore?.species,species))return made(species==='Human'?'indifferent':'kin');
 const weights=reputations[species]??[1,3,4,2,0],random=seededRandom('regard:'+(game?.story?.id??'crossroads')+':'+name+':'+species),total=weights.reduce((a,b)=>a+b,0);
 let roll=random()*total,index=0;while(index<weights.length-1&&roll>=weights[index]){roll-=weights[index];index++;}
 return made(['warm','curious','indifferent','wary','scornful'][index]);
}
// The first impression a view of the hero's kind makes: where an attitude starts before any deed.
export const regardAttitude=stance=>stance==='kin'||stance==='warm'?'friendly':stance==='scornful'?'unfriendly':'indifferent';
// How it sways words (Persuasion, Deception, Performance) aimed at that person, until they are won over.
export function regardSway(game,id,hero){
 if(!id||!npcIdsOf(game).includes(id))return {bonus:0,note:''};
 const m=game.npcMemory?.[id];if(m?.bond||m?.grudge||['friendly','devoted'].includes(m?.attitude)&&!['kin','warm'].includes(speciesRegard(game,id,hero).stance))return {bonus:0,note:''};
 const r=speciesRegard(game,id,hero),bonus={kin:2,warm:2,curious:0,indifferent:0,wary:-2,scornful:-3}[r.stance];
 return {bonus,note:bonus?(r.stance==='kin'?'kin':r.stance+' of '+r.kind):''};
}
export function regardLabel(r){
 return r?{kin:'Kin: one of their own',warm:'Fond of '+r.kind,curious:'Curious about '+r.kind,wary:'Wary of '+r.kind,scornful:'Scornful of '+r.kind}[r.stance]??null:null;
}
// A new story's two residents meet the hero with their view of the hero's kind already formed.
export function firstImpressions(game,hero){
 let memory={...game.npcMemory};
 for(const id of coreNpcIds){
  if(memory[id]||!game.story?.npcs?.[id])continue;
  const r=speciesRegard(game,id,hero),attitude=regardAttitude(r.stance);
  if(attitude!=='indifferent')memory[id]={attitude,response:responses[attitude],memories:[regardMemory(r)]};
 }
 return Object.keys(memory).length?{...game,npcMemory:memory}:game;
}
// The first thing someone remembers about the hero when their kind already means something to them.
export function regardMemory(r){
 const one=String(r.species||'stranger').toLowerCase(),a=/^[aeiou]/.test(one)?'An ':'A ';
 const own={kin:'One of my own kind came by: '+a.toLowerCase()+one+'.',warm:a+one+'. I have always got on well with '+r.kind+'.',curious:a+one+'. I have met few '+r.kind+', and I have questions.',wary:a+one+'. I have heard hard things about '+r.kind+', and I am keeping my guard up.',scornful:a+one+'. I think little of '+r.kind+'.'}[r.stance]??a+one+'.';
 return (r.reason&&!Object.values(regardReasons).some(t=>t.replace('{kind}',r.kind)===r.reason)?a+one+' newcomer. '+r.reason:own).slice(0,300);
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
 const known=npcIdsOf(game);
 return Array.isArray(list)&&list.length<=2&&new Set(list.map(d=>d?.npcId)).size===list.length&&list.every(d=>d&&known.includes(d.npcId)&&game.npcFate?.[d.npcId]!=='dead'&&Object.hasOwn(deedChanges,d.change)&&typeof d.memory==='string'&&d.memory.trim().length>=3&&d.memory.length<=200);
}
export function applyDeeds(game,list){
 let next=game;const lines=[];
 for(const d of list??[]){const r=recordDeed(next,d.npcId,deedChanges[d.change],d.memory.trim());next=r.game;lines.push(...r.lines);}
 return {game:next,lines};
}
export function validTies(t){
 return t===undefined||(!!t&&typeof t==='object'&&!Array.isArray(t)&&tieKinds.includes(t.other)&&foeTieKinds.includes(t.foe)&&(t.note===undefined||(typeof t.note==='string'&&t.note.length<=200)));
}
// ---------- People met along the way ----------
// Someone the Dungeon Master brings into the story (a ferryman, a hermit, a dead man's widow): they live where they
// were met, remember the player like anyone else, can be talked to, recruited, healed or fought, and may be tied to
// someone already known. Meeting someone already known (by name) brings them here instead of creating a double.
const personText=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
export const meetingAttitudes=['hostile','unfriendly','indifferent','friendly'];
export function canMeetPeople(game){
 if(!game.story||!['inn','bridge','tower','wild'].includes(game.stage)||game.npcCombat?.active||game.wildFight||game.dungeon?.active||game.pendingSpell)return false;
 const here=sceneLocation(game),people=Object.entries(game.people??{});
 return people.length<maxPeople&&people.filter(([id,p])=>p.home===here&&game.npcFate?.[id]!=='dead').length<maxPeopleHere;
}
export function introducePerson(game,sketch,hero=null){
 if(!game.story||!['inn','bridge','tower','wild'].includes(game.stage)||game.npcCombat?.active||game.wildFight||game.dungeon?.active)return {game,error:'No one new can be met here right now.'};
 const s=sketch??{},name=typeof s.name==='string'?s.name.trim().replace(/\s+/g,' '):'';
 if(!personText(name,2,60)||!personText(s.role,3,200)||!personText(s.appearance,10,400)||!(s.species==null||personText(s.species,0,60))||!(s.personality==null||personText(s.personality,0,200))||!Object.hasOwn(personToughness,s.toughness)||!meetingAttitudes.includes(s.attitude)||!foeTieKinds.includes(s.foe))return {game,error:'The Dungeon Master described someone the game could not use.'};
 const here=sceneLocation(game),key=name.toLowerCase(),known=npcIdsOf(game);
 if(s.tie!=null&&!(s.tie&&known.includes(s.tie.to)&&tieKinds.includes(s.tie.kind)))return {game,error:'The Dungeon Master tied someone to a person the game does not know.'};
 if(key===String(game.story.foe).toLowerCase())return {game,error:'That is the name of your foe.'};
 // Someone already known: they are here now (unless they travel with you, or are dead).
 const same=known.find(id=>npcName(game,id).trim().toLowerCase()===key);
 if(same){
  if(game.npcFate?.[same]==='dead')return {game,error:npcName(game,same)+' is dead.'};
  if(!isPersonId(same)||game.followers?.[same]||game.people[same].home===here)return {game,id:same,lines:[]};
  return {game:{...game,people:{...game.people,[same]:{...game.people[same],home:here}}},id:same,lines:[]};
 }
 if(!canMeetPeople(game))return {game,error:Object.keys(game.people??{}).length>=maxPeople?'The region already has as many named people as the game can remember.':'This place already has as many named people as the game can show.'};
 const id='n'+(Math.max(0,...Object.keys(game.people??{}).map(k=>Number(k.slice(1))))+1);
 // Whether they are a woman or a man (for their portrait), and how they take to the hero's kind, when given.
 const regard=s.regard&&validRegard(s.regard)&&s.regard.stance!=='indifferent'?{stance:s.regard.stance,reason:s.regard.reason.trim().slice(0,200)}:null;
 const person={name,species:String(s.species??'').trim().slice(0,60),role:s.role.trim(),appearance:s.appearance.trim(),personality:String(s.personality??'').trim().slice(0,200),toughness:s.toughness,home:here,foe:s.foe,...(s.tie?{tie:{to:s.tie.to,kind:s.tie.kind}}:{}),...(genders.includes(s.gender)?{gender:s.gender}:{}),...(regard?{regard}:{})};
 let next={...game,people:{...game.people,[id]:person}};
 if(s.attitude!=='indifferent')next.npcMemory={...next.npcMemory,[id]:{attitude:s.attitude,response:responses[s.attitude],memories:[]}};
 // Met with no feelings either way, their view of the hero's kind makes the first impression.
 else if(hero){const r=speciesRegard(next,id,hero),first=regardAttitude(r.stance);if(first!=='indifferent')next.npcMemory={...next.npcMemory,[id]:{attitude:first,response:responses[first],memories:[regardMemory(r)]}};}
 const lines=[];
 // Word has reached them: someone dear to them died by the player's hand.
 const lost=s.tie&&game.npcFate?.[s.tie.to]==='dead'&&mattersDeeply(s.tie.kind);
 if(lost){const r=recordDeed(next,id,'grudge','The player killed '+npcName(game,s.tie.to)+', '+(s.tie.kind==='beloved'?'my beloved':'my '+s.tie.kind)+'.');next=r.game;lines.push(...r.lines);}
 next.journal=appendJournal(journalForGame(next),'encounter','Met: '+name,name+', '+person.role.replace(/[.\s]+$/,'')+'.'+(s.tie?' '+name+' is '+npcName(game,s.tie.to)+'\'s '+s.tie.kind+'.':''));
 return {game:next,id,lines};
}
// The people met while exploring, as stored in a save.
export function validPeople(game){
 const p=game.people;if(p===undefined)return true;
 if(!p||typeof p!=='object'||Array.isArray(p)||!game.story)return false;
 const ids=Object.keys(p),known=npcIdsOf(game);
 return ids.length<=maxPeople&&ids.every(id=>{const x=p[id];return isPersonId(id)&&!!x&&personText(x.name,2,60)&&personText(x.species,0,60)&&personText(x.role,3,200)&&personText(x.appearance,10,400)&&personText(x.personality,0,200)&&Object.hasOwn(personToughness,x.toughness)&&/^(?:inn|bridge|tower|p\d{1,2})$/.test(x.home)&&foeTieKinds.includes(x.foe)&&(x.tie===undefined||(!!x.tie&&known.includes(x.tie.to)&&x.tie.to!==id&&tieKinds.includes(x.tie.kind)))&&(x.gender===undefined||genders.includes(x.gender))&&validRegard(x.regard);})
  &&new Set(ids.map(id=>p[id].name.toLowerCase())).size===ids.length;
}
