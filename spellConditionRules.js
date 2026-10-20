// Conditions a spell lays on a creature in a fight (spellRules.js spellConditions): the marks that keep them
// (game.marks[key].spells), what they do to attacks and saves, how harm breaks sleep and charms, and how they play
// out on the creature's turn.
import {spellLibrary} from "./spellOptions";
import {markOf,withMark,boonOn,ownBoonKey,heroIdOf} from "./masteryRules";
import {spellName} from "./spellRules";
import {endBoons} from "./spellBuffRules";
const conditionLines={
  drowsy:'grows heavy-eyed and does nothing until the end of its next turn, when it must save again or fall asleep. Harm rouses it.',
  asleep:'falls into a magical sleep: it does nothing until it wakes, and wakes if it is hurt.',
  entranced:'stands entranced and does nothing; harm breaks the spell.',
  paralyzed:'is paralyzed: it cannot act, attacks on it have advantage, and a blow from beside it is a critical hit. It tries to break free at the end of each of its turns.',
  laughing:'collapses in helpless laughter: it is prone and does nothing. It tries to recover at the end of each of its turns.',
  commanded:'obeys the command and loses its next turn.',groveling:'grovels: it drops prone and loses its next turn.',
  restrained:'is held fast: its attacks have disadvantage and attacks on it have advantage. It tries to break free at the end of each of its turns.',
  outlined:'is outlined in light: attacks on it have advantage while the spell holds.',
  blinded:'is blinded: its attacks have disadvantage and attacks on it have advantage. It tries again at the end of each of its turns.',
  charmed:'is charmed: it will not attack you, until you or your friends harm it.',
  frightened:'is frightened: its attacks have disadvantage. It tries to master its fear at the end of each of its turns.',
  baned:'is baned: it takes 1d4 off its attack rolls and saving throws while the spell holds.',
};
export function conditionText(cond,called,spell){return (called.charAt(0).toUpperCase()+called.slice(1))+' '+(conditionLines[cond]??'is affected by '+spell.name+'.');}
const spellMarksOf=(game,key)=>markOf(game,key).spells??[];
export function withSpellMark(game,key,entry){
  const kept=spellMarksOf(game,key).filter(m=>!(m.id===entry.id&&m.by===entry.by));
  return withMark(game,key,{spells:[...kept,entry].slice(-4)});
}
export function setSpellMarks(game,key,list){return withMark(game,key,{spells:list.length?list:undefined});}
export const spellCondsOf=(game,key)=>spellMarksOf(game,key).map(m=>m.cond);
// Whether a creature is helpless (a melee hit on it from beside it is a critical hit).
export const helpless=(game,key)=>spellCondsOf(game,key).some(c=>['paralyzed','asleep'].includes(c));
// Whether a creature will not attack this hero (charmed by them).
export const charmedBy=(game,key,heroId)=>spellMarksOf(game,key).some(m=>m.cond==='charmed'&&m.by===heroId);
// The edge on an attack at a creature from what spells left on it: advantage on one paralyzed, asleep, held fast,
// blinded, outlined or struck by Guiding Bolt.
export function spellEdge(game,key,ranged=false){
  const adv=[],dis=[],conds=spellCondsOf(game,key);
  if(conds.some(c=>['paralyzed','asleep','restrained','blinded','outlined','entranced'].includes(c)))adv.push(conds.find(c=>['paralyzed','asleep','restrained','blinded','outlined','entranced'].includes(c)));
  if(conds.includes('guided'))adv.push('Guiding Bolt');
  const prone=markOf(game,key).prone;if(prone)(ranged?dis:adv).push('prone');
  return {adv,dis};
}
// Guiding Bolt's glow is spent on the first attack made at the creature.
export function spendGuidance(game,key){const list=spellMarksOf(game,key);return list.some(m=>m.cond==='guided')?setSpellMarks(game,key,list.filter(m=>m.cond!=='guided')):game;}
// Bane on a creature: 1d4 off its attack roll or saving throw.
export function spellSaveShift(game,key,random=Math.random){return spellCondsOf(game,key).includes('baned')?{amount:1+Math.floor(random()*4)}:{amount:0};}
export function banedAttack(game,key,attack,random=Math.random){
  if(!spellCondsOf(game,key).includes('baned')||attack.critical||attack.miss)return {attack,note:''};
  const d=1+Math.floor(random()*4);return {attack:{...attack,total:attack.total-d},note:' − '+d+' Bane'};
}
// Bless on this hero: 1d4 on an attack roll or a saving throw.
// (Their own Bless, unless they hold it only for others, or a friend's Bless on them: game.boons.)
export function attackBoost(game,random=Math.random){return (game.concentration?.id==='bless'&&game.concentration.self!==false)||boonOn(game,ownBoonKey(game),'bless')?{amount:1+Math.floor(random()*4)}:{amount:0};}
// Harm breaks a magical sleep, a trance and a charm.
export const breakable=['asleep','drowsy','entranced','charmed'];
export const brokenLine=(name,conds)=>`${name} is hurt, and ${conds.map(c=>c==='charmed'?'the charm breaks':c==='asleep'?'wakes':c==='drowsy'?'is roused':'snaps out of the trance').join(' and ')}.`;
export function breakOnDamage(game,key){
  const list=spellMarksOf(game,key);if(!list.some(m=>breakable.includes(m.cond)))return game;
  return setSpellMarks(game,key,list.filter(m=>!breakable.includes(m.cond)));
}
// Wakes anyone whose hit points fell between two states of the game (any blow, from anyone); returns the lines.
export function wokenByHarm(before,after,name=k=>k){
  let game=after;const lines=[];
  const hpOf=(g,k)=>k==='foe'?g.enemyHP:String(k).startsWith('ally:')?g.foeAllies?.[Number(String(k).slice(5))]?.hp:g.npcHP?.[k];
  for(const key of Object.keys(after.marks??{})){
    const was=hpOf(before,key),now=hpOf(after,key);
    if(typeof was!=='number'||typeof now!=='number'||now>=was)continue;
    const broke=spellMarksOf(after,key).filter(m=>breakable.includes(m.cond));
    if(!broke.length)continue;
    game=breakOnDamage(game,key);if(now>0)lines.push(brokenLine(name(key),broke.map(m=>m.cond)));
  }
  return {game,lines};
}
// A concentration spell's marks last only while its caster holds it (theirs on this device, or a party member's).
// The same holds for what such a spell left on friends (endBoons).
export function endSpellMarks(game,recast=null){
  if(game.boons)game=endBoons(game,recast);
  if(!game.marks)return game;
  const me=heroIdOf(game),holds=by=>by===me?game.concentration?.id:game.party?.members?.[by]?.hero?.concentration?.id;
  let next=game;
  for(const key of Object.keys(game.marks)){
    const list=spellMarksOf(game,key);if(!list.length)continue;
    const kept=list.filter(m=>{const spell=spellLibrary.find(s=>s.id===m.id);if(m.by===me&&recast&&m.id===recast)return false;return !spell?.concentration||holds(m.by)===m.id;});
    if(kept.length!==list.length)next=setSpellMarks(next,key,kept);
  }
  return next;
}
// At the start of a creature's turn: whether spells keep it from acting.
export function spellTurnStarts(game,key,name){
  const conds=spellCondsOf(game,key),lines=[];
  const still=conds.find(c=>['paralyzed','asleep','drowsy','entranced','laughing','commanded','groveling'].includes(c));
  if(still)lines.push(`${name} ${({paralyzed:'is paralyzed and cannot act.',asleep:'sleeps on.',drowsy:'is drowsy and does nothing.',entranced:'stands entranced.',laughing:'is helpless with laughter.',commanded:'obeys your command and loses its turn.',groveling:'grovels and loses its turn.'})[still]}`);
  // Commanded to grovel, it throws itself down: it lies prone until its next turn.
  return {skip:!!still,lines,game:still==='groveling'?withMark(game,key,{prone:true}):game};
}
// At the end of a creature's turn: it tries again to shake off a spell that allows it, and short spells run out.
export function spellTurnEnds(game,key,name,saves,random=Math.random){
  const list=spellMarksOf(game,key);if(!list.length)return {game,lines:[]};
  const kept=[],lines=[];
  for(const m of list){
    if(m.rounds!==undefined&&m.rounds<=1){if(['poisoned','blinded','charmed','frightened'].includes(m.cond))lines.push(`${name} is no longer ${m.cond}.`);continue;}
    const entry=m.rounds!==undefined?{...m,rounds:m.rounds-1}:m;
    // Sleep: drowsy to the end of its turn, then a second Wisdom save, or it sleeps (Unconscious) while the spell lasts.
    if(m.cond==='drowsy'){
      const die=1+Math.floor(random()*20),bonus=saves?.[m.save]??0,bane=spellCondsOf(game,key).includes('baned')?1+Math.floor(random()*4):0,total=die+bonus-bane,woke=total>=m.dc;
      lines.push(`${name} makes a ${m.save} save d20 ${die} + ${bonus}${bane?' − '+bane+' Bane':''} = ${total} vs DC ${m.dc}: ${woke?'it shakes off '+spellName(m.id)+'.':'it falls into a magical sleep, and only harm or a hard shake will wake it.'}`);
      if(!woke)kept.push({...entry,cond:'asleep'});
      continue;
    }
    if(['paralyzed','laughing','restrained','blinded','frightened'].includes(m.cond)){
      const die=1+Math.floor(random()*20),bonus=saves?.[m.save]??0,bane=spellCondsOf(game,key).includes('baned')?1+Math.floor(random()*4):0,total=die+bonus-bane;
      if(total>=m.dc){lines.push(`${name} makes a ${m.save} save d20 ${die} + ${bonus} = ${total} vs DC ${m.dc} and breaks free of ${spellName(m.id)}.`);continue;}
      lines.push(`${name} makes a ${m.save} save d20 ${die} + ${bonus} = ${total} vs DC ${m.dc} and stays ${({paralyzed:'paralyzed',laughing:'helpless with laughter',restrained:'held fast',blinded:'blinded',frightened:'frightened'})[m.cond]}.`);
    }
    kept.push(entry);
  }
  let next=setSpellMarks(game,key,kept);
  // Hideous Laughter keeps a creature down; once it ends the creature can get up as usual.
  return {game:next,lines};
}
