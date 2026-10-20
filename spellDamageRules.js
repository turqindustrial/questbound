// What a spell's damage meets and how far it may go: the most a spell can deal (spellDamageMax, which holds a Dungeon
// Master's ruling), a target's defences (a person's, a creature's nature, resistance and vulnerability), the extra
// damage of Hex, Hunter's Mark and Divine Favor on a hit, and a creature's hit points after a spell's damage.
import {modifier} from "./characterRules";
import {npcProfile,classSaves,npcLore} from "./npcRules";
import {castingAbility,cantripDice,automaticEffects,spellName} from "./spellRules";
const spellDamageTypes='Acid|Bludgeoning|Cold|Fire|Force|Lightning|Necrotic|Piercing|Poison|Psychic|Radiant|Slashing|Thunder';
// The most damage a spell can deal to one target, read from its own text (every damage roll it names, summed, with
// the spellcasting modifier where the spell adds it), raised for a higher slot or a cantrip's levels. A Dungeon
// Master's ruling is held to this; 0 when the spell names no damage dice.
export function spellDamageMax(hero,spell,slot){
  if(!spell)return 0;
  const sentences=String(spell.description??'').split(/(?<=\.)\s+/),mod=modifier(hero?.scores?.[castingAbility(hero)]??10);
  let most=0,types=0;
  for(const sentence of sentences){
    if(!/damage/i.test(sentence))continue;
    const dice=[...sentence.matchAll(/(\d+)d(\d+)(?:\s*\+\s*(\d+))?/g)];if(!dice.length)continue;
    for(const d of dice)most+=Number(d[1])*Number(d[2])*(spell.level===0?cantripDice(hero?.level??1):1)+Number(d[3]??0);
    if(/spellcasting ability modifier/i.test(sentence))most+=Math.max(0,mod);
    types=Math.max(types,(sentence.match(new RegExp('\\b(?:'+spellDamageTypes+')\\b','g'))??[]).length);
  }
  const up=String(spell.higherLevel??'').match(/increases? by (\d+)d(\d+) for (?:each|every) (?:spell )?slot level above (\d)/i);
  const level=typeof slot==='number'?slot:spell.level;
  if(up&&level>Number(up[3]))most+=Number(up[1])*Number(up[2])*(level-Number(up[3]))*Math.max(1,Math.min(2,types));
  return most;
}
// A person's defences against a spell: their own armour class, and saves by how tough they are.
export function personDefenses(game,id){
  const profile=npcProfile(game,id),toughness=game.people?.[id]?.toughness,save=toughness==='tough'?2:toughness==='frail'?-1:0;
  // A trained person (npcRules.js npcClasses) adds their proficiency to their class's two saving throws.
  const t=profile?.trainedAs,prof=t?2+Math.floor((t.level-1)/4):0,saves=Object.fromEntries(['Strength','Dexterity','Constitution','Intelligence','Wisdom','Charisma'].map(a=>[a,t?Math.max(save,1)+((classSaves[t.class]??[]).includes(a)?prof:0):save]));
  return {ac:profile?.ac??10,saves,distance:10,name:profile?.name??'They',save};
}
// A target's resistance, immunity or vulnerability to a damage type.
export function defended(target,type,amount){
  if(!type||!amount||!target)return amount;
  const has=list=>(list??[]).some(t=>String(t).toLowerCase()===String(type).toLowerCase());
  if(has(target.immunities))return 0;
  let n=amount;if(has(target.resistances))n=Math.floor(n/2);if(has(target.vulnerabilities))n*=2;
  return n;
}
// What a creature is, as far as spells care: a humanoid (Hold Person, Charm Person), undead or a fiend (Divine Smite).
const humanoidWords=/\b(human|humans|elf|elves|elven|dwarf|dwarves|halfling|gnome|orc|orcs|goblin|goblins|hobgoblin|bugbear|kobold|tiefling|dragonborn|goliath|bandit|bandits|cultist|cultists|knight|guard|soldier|thief|mage|priest|priestess|witch|wizard|sorcerer|sorceress|warlock|captain|brigand|pirate|raider|assassin|noble|merchant|lord|lady|queen|king|woman|man)\b/i;
export function creatureNature(game,key){
  // A person is a humanoid; an elf goes into a trance instead of sleeping (so magic cannot put it to sleep).
  if(key&&key!=='foe'&&!String(key).startsWith('ally:'))return {humanoid:true,undead:false,fiend:false,construct:false,skeleton:false,sleepless:/\b(elf|elves|elven|drow)\b/i.test(String(npcLore(game,key)?.species??''))};
  const kind=(key==='foe'?(game.wildFight?[game.wildFight.template,game.wildFight.name].join(' '):game.dungeon?.active?'warden construct':game.story?[game.story.foeSpecies,game.story.foe].join(' '):'lantern wisp'):String(game.foeAllies?.[Number(String(key).slice(5))]?.template??'')).toLowerCase();
  return {humanoid:humanoidWords.test(kind),otherworldly:/\b(aberration|beholder|celestial|angel|deva|elemental|fey|sprite|pixie|dryad|hag|fiend|fiendish|demon|devil|imp|quasit|hellhound|undead|skeleton|skeletons|zombie|zombies|ghoul|ghast|wight|wraith|specter|spectre|ghost|vampire|lich|mummy|revenant|banshee|wisp)\b/.test(kind),undead:/\b(undead|skeleton|skeletons|zombie|zombies|ghoul|ghast|wight|wraith|specter|spectre|ghost|vampire|lich|mummy|revenant|banshee)\b/.test(kind),fiend:/\b(fiend|demon|devil|imp|quasit|hellhound|fiendish)\b/.test(kind),construct:/\b(construct|golem|animated|homunculus)\b/.test(kind),skeleton:/\bskeletons?\b/.test(kind),sleepless:/\b(elf|elves|elven|drow)\b/.test(kind)};
}
// What a creature shrugs off, as SRD 5.2 gives it (worked out from what it is, so old saves and written foes have it
// too): the undead and constructs take no Poison damage and are never Poisoned or Exhausted (so magic cannot put them
// to sleep either); a skeleton's bones break under Bludgeoning blows; an elf's trance keeps it from magical sleep.
export function creatureDefenses(game,key){
  const nature=creatureNature(game,key),tireless=nature.undead||nature.construct;
  return {immunities:tireless?['Poison']:[],conditionImmunities:tireless?['Poisoned','Exhaustion']:[],vulnerabilities:nature.skeleton?['Bludgeoning']:[],sleepless:tireless||!!nature.sleepless};
}
// A target's numbers with what it is immune or vulnerable to added (anything written for it is kept).
export function withDefenses(game,key,target){
  if(!target)return target;
  const own=creatureDefenses(game,key),join=(a,b)=>[...new Set([...(a??[]),...b])];
  return {...target,immunities:join(target.immunities,own.immunities),conditionImmunities:join(target.conditionImmunities,own.conditionImmunities),vulnerabilities:join(target.vulnerabilities,own.vulnerabilities),sleepless:!!target.sleepless||own.sleepless};
}
// Hex or Hunter's Mark on the creature struck, and Divine Favor on a weapon hit: the extra damage of one hit.
export function riderDamage(hero,game,key,critical,random=Math.random,{weapon=false}={}){
  let next=game;const lines=[];let amount=0,type=null;
  const held=game.concentration,effect=held?automaticEffects[held.id]:null;
  if(effect?.rider&&!held.lost&&!held.gone){
    if(!held.target){next={...next,concentration:{...held,target:key}};lines.push(`${spellName(held.id)} settles on the creature you struck.`);}
    if(!held.target||held.target===key){
      const dice=Array.from({length:critical?2:1},()=>1+Math.floor(random()*effect.rider.die)),n=dice.reduce((a,b)=>a+b,0);
      amount+=n;type=effect.rider.type;lines.push(`${spellName(held.id)}: +${n} ${effect.rider.type} damage (${dice.length}d${effect.rider.die} [${dice.join(', ')}]).`);
    }
  }
  if(weapon&&(game.buffs?.['divine-favor']?.remaining??0)>0){
    const dice=Array.from({length:critical?2:1},()=>1+Math.floor(random()*4)),n=dice.reduce((a,b)=>a+b,0);
    amount+=n;type=type??'Radiant';lines.push(`Divine Favor: +${n} Radiant damage (${dice.length}d4 [${dice.join(', ')}]).`);
  }
  return {game:next,amount,type,lines};
}
// A creature's hit points as a spell's damage leaves them: the foe, a creature beside it, or a person.
export function harmCreature(game,key,amount){
  if(!amount)return {game,line:null};
  if(key==='foe')return {game:{...game,enemyHP:Math.max(0,(game.enemyHP??0)-amount)},line:null};
  if(String(key).startsWith('ally:')){const i=Number(String(key).slice(5)),a=game.foeAllies?.[i];if(!a)return {game,line:null};const hp=Math.max(0,a.hp-amount);return {game:{...game,foeAllies:game.foeAllies.map((x,j)=>j===i?{...x,hp}:x)},line:hp===0&&a.hp>0?(game.subdue?'The '+a.name+' drops, beaten.':'The '+a.name+' is slain.'):null};}
  const most=npcProfile(game,key)?.maximumHP??10,was=game.npcHP?.[key]??most,now=Math.max(0,was-amount);
  let next={...game,npcHP:{...game.npcHP,[key]:now}},line=null;
  // A spell that drops someone kills them, as a weapon does.
  if(was>0&&now===0&&!next.npcFate?.[key]){next.npcFate={...next.npcFate,[key]:'dead'};line=(npcProfile(game,key)?.name??key)+' is dead.';}
  return {game:next,line};
}
