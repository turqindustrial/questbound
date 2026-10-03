import {modifier,proficiencyBonus} from './characterRules';
import {weapons,weaponAttacks} from './weaponRules';
// Weapon Mastery, two-weapon fighting, and grappling and shoving: the 2024 rules (SRD 5.2) in Questbound's own words.
// Each weapon kind has one mastery property (weaponRules.js); a hero uses it only for kinds they have mastered, and only
// Barbarians, Fighters, Paladins, Rangers and Rogues master weapons. What a mastery or a grapple leaves on a creature
// in a fight (prone, grappled, sapped) is kept in game.marks under the creature's key: 'foe', 'ally:0', or a person's id.

// ---------- Weapon Mastery ----------
export const masteryText={
 Cleave:'Cleave: when a melee hit lands, you swing on into a second foe beside the first (once a turn). That blow adds no ability bonus to its damage.',
 Graze:'Graze: a miss still deals damage equal to your ability bonus.',
 Nick:'Nick: the extra attack of two-weapon fighting with this weapon is part of your Attack action, not a bonus action (once a turn).',
 Push:'Push: a hit drives the creature up to 10 feet away from you.',
 Sap:'Sap: a hit leaves the creature with disadvantage on its next attack before your next turn.',
 Slow:'Slow: a hit that deals damage takes 10 feet off the creature’s speed until your next turn.',
 Topple:'Topple: a hit forces a Constitution save against 8 + your ability bonus + proficiency; on a failure the creature falls prone.',
 Vex:'Vex: a hit that deals damage gives you advantage on your next attack against that creature before the end of your next turn.',
};
// How many kinds of weapon a class masters, by level (the Weapon Mastery feature).
export function masteryCount(hero){
 const level=hero?.level??1;
 switch(hero?.class){
  case 'Barbarian':return level>=10?4:level>=4?3:2;
  case 'Fighter':return level>=16?6:level>=10?5:level>=4?4:3;
  case 'Paladin':case 'Ranger':case 'Rogue':return 2;
  default:return 0;
 }
}
// The kinds a hero has mastered, chosen for them from the weapons they carry and are proficient with: the main weapon
// first, then their best weapon for range, then the rest (a Barbarian masters melee weapons only).
export function masteredWeapons(hero){
 const count=masteryCount(hero);if(!count)return [];
 const fit=weaponAttacks(hero).filter(w=>weapons[w.name]?.mastery&&w.proficient&&(hero.class!=='Barbarian'||!w.ranged));
 if(!fit.length)return [];
 const main=fit[0],range=fit.find(w=>w!==main&&w.ranged)??fit.find(w=>w!==main&&/^Thrown\b/.test(String(w.range??'')));
 return [...new Set([main,range,...fit].filter(Boolean).map(w=>w.name))].slice(0,count);
}
// The mastery property this hero can use with this weapon, or null.
export function masteryOf(hero,weapon){
 if(!weapon||weapon.unarmed)return null;
 const mastery=weapons[weapon.name]?.mastery;
 return mastery&&masteredWeapons(hero).includes(weapon.name)?mastery:null;
}

// ---------- Two-weapon fighting (the Light property) ----------
export const isLight=weapon=>!!weapons[weapon?.name]?.light;
// After attacking with a Light weapon (`used`), the other hand can make one extra attack with a different Light weapon
// (a second of the same kind counts) as a bonus action. Both hands must be free of a shield.
export function offhandWeapons(hero,used){
 const items=hero.equipment?.items??[];
 if(!used||items.some(i=>i.name==='Shield'&&i.quantity>0))return [];
 const held=name=>items.filter(i=>i.name===name).reduce((n,i)=>n+(i.quantity??0),0);
 return weaponAttacks(hero).filter(w=>!w.blocked&&!w.ranged&&isLight(w)&&(w.name!==used||held(used)>=2));
}

// ---------- Grapple and Shove ----------
const sizes=['Tiny','Small','Medium','Large','Huge','Gargantuan'];
export const heroSize=hero=>/^(Gnome|Goblin|Halfling)$/i.test(String(hero?.species??hero?.race??''))?'Small':'Medium';
const templateSizes={wolf:'Large',spider:'Large',goblin:'Small'};
// A creature's size: a wild creature's from its kind, the story's foe from what it is, people Medium (or Small).
export function creatureSize(game,key){
 if(String(key).startsWith('ally:'))return templateSizes[game.foeAllies?.[Number(String(key).slice(5))]?.template]??'Medium';
 if(key==='foe'){
  if(game.wildFight)return templateSizes[game.wildFight.template]??'Medium';
  if(game.dungeon?.active)return 'Medium';
  if(!game.story)return 'Small';
  const kind=String(game.story.foeSpecies??game.story.foe??'');
  if(/\b(dragon|titan|colossus|kraken|behemoth|leviathan|hydra|roc|tarrasque)\b/i.test(kind)||/\b(hill|frost|fire|stone|cloud|storm) giant\b/i.test(kind)||/^giants?$/i.test(kind.trim()))return 'Huge';
  if(/\b(ogre|troll|bear|horse|wyvern|owlbear|dire|minotaur|griffon|hippogriff|wyrm|elemental|golem|ettin|treant)\b/i.test(kind)||/\bgiant \w+/i.test(kind))return 'Large';
  if(/\b(goblin|kobold|imp|sprite|pixie|halfling|gnome|rat|cat|quasit)\b/i.test(kind))return 'Small';
  return 'Medium';
 }
 return 'Medium';
}
// A grapple or shove works only on a creature no more than one size larger than the hero.
export const withinGrip=(hero,size)=>sizes.indexOf(size)<=sizes.indexOf(heroSize(hero))+1;
export const unarmedDC=hero=>8+modifier(hero.scores?.Strength??10)+proficiencyBonus(hero.level??1);
// The target resists with Strength or Dexterity, whichever is better for it.
export function unarmedSave(saves,random){
 const str=saves?.Strength??0,dex=saves?.Dexterity??0,ability=dex>str?'Dexterity':'Strength',bonus=Math.max(str,dex),die=1+Math.floor(random()*20);
 return {ability,bonus,die,total:die+bonus};
}

// ---------- Marks on the creatures in a fight ----------
export const heroIdOf=game=>game.party?.lead??'hero';
export const markOf=(game,key)=>game.marks?.[key]??{};
export function withMark(game,key,patch){
 const now={...markOf(game,key),...patch};
 for(const k of Object.keys(now))if(now[k]===undefined||now[k]===false)delete now[k];
 const marks={...(game.marks??{})};if(Object.keys(now).length)marks[key]=now;else delete marks[key];
 const next={...game,marks};if(!Object.keys(marks).length)delete next.marks;
 return next;
}
// Who holds the creature, while they are still standing (a hero who drops lets go).
export function grappledBy(game,key,health){
 const by=markOf(game,key).grappled;if(!by)return null;
 if(by===heroIdOf(game))return (health?.current??1)>0&&!['dying','dead'].includes(game.stage)?by:null;
 return game.party?.members?.[by]?.status==='up'?by:null;
}
// Letting go of whatever this hero holds (free: before swinging a two-handed weapon, or with both hands).
export function letGo(game,names){
 const me=heroIdOf(game),lines=[];let next=game;
 for(const [key,mark] of Object.entries(game.marks??{}))if(mark.grappled===me){next=withMark(next,key,{grappled:undefined});lines.push('You let go of '+(names(key)??'your hold')+'.');}
 return {game:next,lines};
}
export const holding=game=>Object.values(game.marks??{}).some(m=>m.grappled===heroIdOf(game));
// The edge on a hero's attack at a creature: advantage from Vex, or at arm's length against one lying prone;
// disadvantage for a shot or throw at a prone one.
export function heroEdge(game,key,weapon){
 const adv=[],dis=[];
 if(game.vex?.target===key)adv.push('Vex');
 if(markOf(game,key).prone)((weapon.ranged||weapon.thrown)?dis:adv).push('prone');
 return {adv,dis};
}
export function edgeMode(base,{adv,dis}){
 const a=base==='advantage'||adv.length>0,d=base==='disadvantage'||dis.length>0;
 return a===d?'normal':a?'advantage':'disadvantage';
}
// The creature's own attack: disadvantage while it lies prone, after a Sap, and (grappled) at anyone but the one
// holding it. `target` is the hero struck (their id), or anything else for a companion.
export function foeEdge(game,key,target,health){
 const mark=markOf(game,key),why=[];
 if(mark.prone)why.push('prone');
 if(mark.sapped)why.push('Sap');
 const by=grappledBy(game,key,health);if(by&&by!==target)why.push('grappled');
 return why;
}
// At the start of its turn a prone creature gets up, unless a grapple holds it (its speed is 0); a hold whose hero has
// dropped is gone.
export function creatureTurnStarts(game,key,name,health){
 let next=game;const lines=[],mark=markOf(game,key);
 if(mark.grappled&&!grappledBy(game,key,health))next=withMark(next,key,{grappled:undefined});
 if(mark.prone){if(grappledBy(next,key,health))lines.push(name+' is held down and cannot get up.');else{next=withMark(next,key,{prone:undefined});lines.push(name+' gets back to its feet.');}}
 return {game:next,lines};
}
// A Sap is spent on the creature's first attack roll, and ends before the hero's next turn anyway.
export const sapSpent=(game,key)=>markOf(game,key).sapped?withMark(game,key,{sapped:undefined}):game;
export function sapsEnd(game){let next=game;for(const key of Object.keys(game.marks??{}))next=sapSpent(next,key);return next;}
// The end of the hero's own turn: what lasts only for a turn goes, and Vex lasts one more turn of theirs.
export function endHeroTurn(next){
 delete next.lightAttack;delete next.nickUsed;delete next.cleaveUsed;
 if(next.vex){if(next.vex.fresh)next.vex={target:next.vex.target};else delete next.vex;}
 return next;
}
// Nothing of a fight outlasts it.
export function fightOver(game){
 if(!['marks','vex','lightAttack','nickUsed','cleaveUsed'].some(k=>game[k]!==undefined))return game;
 const next={...game};for(const k of ['marks','vex','lightAttack','nickUsed','cleaveUsed'])delete next[k];return next;
}
export function validMarks(g){
 const keys=/^(?:foe|ally:[01]|keeper|mara|n(?:[1-9]|1[0-2]))$/;
 return (g.marks===undefined||(!!g.marks&&typeof g.marks==='object'&&!Array.isArray(g.marks)&&Object.entries(g.marks).every(([k,m])=>keys.test(k)&&m&&typeof m==='object'&&Object.entries(m).every(([f,v])=>(['prone','sapped'].includes(f)&&v===true)||(f==='grappled'&&typeof v==='string'&&v.length>0&&v.length<=80)))))
  &&(g.vex===undefined||(!!g.vex&&keys.test(String(g.vex.target))&&(g.vex.fresh===undefined||g.vex.fresh===true)))
  &&(g.lightAttack===undefined||(!!g.lightAttack&&typeof g.lightAttack.weapon==='string'&&g.lightAttack.weapon.length<=30&&keys.test(String(g.lightAttack.target))))
  &&(g.nickUsed===undefined||g.nickUsed===true)&&(g.cleaveUsed===undefined||g.cleaveUsed===true);
}
