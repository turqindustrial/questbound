// Spells that go on working while their caster holds them (Moonbeam, Spirit Guardians, Heat Metal...): the damage
// they deal again on a creature's turn, the same spell used again or moved, the chips for it, and what becomes of a
// curse or mark once its creature is gone.
import {spellLibrary} from "./spellOptions";
import {modifier,proficiencyBonus} from "./characterRules";
import {rollAttack} from "./weaponRules";
import {npcProfile} from "./npcRules";
import {heroIdOf,markOf,edgeMode} from "./masteryRules";
import {spellSaveShift,withSpellMark,spellCondsOf,breakable,breakOnDamage,brokenLine,setSpellMarks,spellEdge,attackBoost,helpless,spendGuidance} from "./spellConditionRules";
import {defended,harmCreature,withDefenses,riderDamage} from "./spellDamageRules";
import {spellName,castingAbility,heatLine,automaticEffects} from "./spellRules";
// ---------- Spells that go on working ----------
// Concentration spells whose damage comes again (2024 rules), while the caster holds them and the fight lasts: at the end
// of the turn of a creature in the area (zone 'area': every creature in the fight; 'target': the one it was cast on or
// moved to), or as the caster's bonus action or Magic action on a later turn (`again`; `later`: not on the turn it was
// cast; `move`: it moves to the creature it is used on; `same`: only the creature first chosen). The caster's
// concentration keeps {level, dc, target, fresh} for this, so another device can play it at the shared table.
export const lastingSpells={
  moonbeam:{zone:'target',save:'Constitution',die:10,count:2,upcast:1,type:'Radiant',half:true,again:'action',move:true,verb:'move the beam onto'},
  'flaming-sphere':{zone:'target',save:'Dexterity',die:6,count:2,upcast:1,type:'Fire',half:true,again:'bonus',move:true,verb:'roll the sphere into'},
  'call-lightning':{save:'Dexterity',die:10,count:3,upcast:1,type:'Lightning',half:true,again:'action',later:true,verb:'call down lightning on'},
  'spirit-guardians':{zone:'area',save:'Wisdom',die:8,count:3,upcast:1,type:'Radiant',half:true},
  'insect-plague':{zone:'area',save:'Constitution',die:10,count:4,upcast:1,type:'Piercing',half:true},
  'wall-of-fire':{zone:'area',die:8,count:5,upcast:1,type:'Fire'},
  'black-tentacles':{zone:'area',save:'Strength',die:6,count:3,type:'Bludgeoning',restrain:true},
  'heat-metal':{again:'bonus',die:8,count:2,upcast:1,type:'Fire',later:true,same:true,verb:'heat the metal of'},
  'spiritual-weapon':{again:'bonus',attack:'melee',die:8,count:1,upcast:1,type:'Force',addMod:true,later:true,verb:'strike with the spiritual weapon at'},
  'vampiric-touch':{again:'action',attack:'melee',die:6,count:3,upcast:1,type:'Necrotic',drain:true,later:true,verb:'drain'},
};
// Damage a spell leaves on one creature, by the spell that left it (its mark in game.marks): Acid Arrow's and
// Vitriolic Sphere's later acid at the end of its next turn, Searing Smite's burn and Ensnaring Strike's thorns at the
// start of each of its turns, and burning webs.
const markHarm={
  'acid-arrow':{cond:'acid',on:'end',die:4,count:2,upcast:1,from:2,type:'Acid'},
  'vitriolic-sphere':{cond:'acid',on:'end',die:4,count:5,type:'Acid'},
  'searing-smite':{cond:'burning',on:'start',die:6,count:1,upcast:1,from:1,type:'Fire',saveEnds:'Constitution'},
  'ensnaring-strike':{cond:'restrained',on:'start',die:6,count:1,upcast:1,from:1,type:'Piercing'},
  web:{cond:'aflame',on:'start',die:4,count:2,type:'Fire',once:true},
};
const spellLevelOf=id=>spellLibrary.find(s=>s.id===id)?.level??1;
// Every hero holding a lasting spell: this device's own and the party's (each with the hero's name for the feed).
function lastingSources(game){
  const me=heroIdOf(game),list=[];
  if(game.concentration&&lastingSpells[game.concentration.id])list.push({by:me,c:game.concentration,name:null});
  for(const [id,m] of Object.entries(game.party?.members??{})){
    if(id===me||m?.status!=='up'||!lastingSpells[m.hero?.concentration?.id])continue;
    let name='a companion';try{name=JSON.parse(m.character).name||name;}catch{}
    list.push({by:id,c:m.hero.concentration,name});
  }
  return list;
}
// What spells do to a creature at the start or end of its turn (`phase`): the damage spells left on it, and the areas
// heroes hold. `foe`: its name and defences (saves, resistances). Returns the game with its hit points changed.
export function lastingTurn(game,key,phase,foe,random=Math.random){
  let next=game,total=0;const lines=[],name=foe?.name??'It',roll=(n,d)=>Array.from({length:n},()=>1+Math.floor(random()*d)),sum=d=>d.reduce((a,b)=>a+b,0);
  for(const m of markOf(game,key).spells??[]){
    const h=markHarm[m.id];if(!h||h.cond!==m.cond||h.on!==phase)continue;
    const dice=roll(h.count+Math.max(0,(m.level??h.from??0)-(h.from??0))*(h.upcast??0),h.die),dealt=defended(foe??{},h.type,sum(dice));
    total+=dealt;let line=`${spellName(m.id)}: ${name} takes ${dealt} ${h.type} damage (${dice.length}d${h.die} [${dice.join(', ')}]).`;
    if(h.saveEnds){const die=1+Math.floor(random()*20),bonus=foe?.saves?.[h.saveEnds]??0,shift=spellSaveShift(next,key,random).amount,t=die+bonus-shift,ok=t>=m.dc;line+=` ${h.saveEnds} save d20 ${die} + ${bonus}${shift?' − '+shift+' Bane':''} = ${t} vs DC ${m.dc}: ${ok?'the flames die out.':'it keeps burning.'}`;if(ok)next=dropSpellMark(next,key,m);}
    if(h.once)next=dropSpellMark(next,key,m);
    lines.push(line);
  }
  if(phase==='end')for(const src of lastingSources(next)){
    const l=lastingSpells[src.c.id];if(!l.zone||(l.zone==='target'&&src.c.target!==key))continue;
    const level=src.c.level??spellLevelOf(src.c.id),dc=src.c.dc??13,dice=roll(l.count+Math.max(0,level-spellLevelOf(src.c.id))*(l.upcast??0),l.die),rolled=sum(dice);
    let saved=false,text='';
    if(l.save){const die=1+Math.floor(random()*20),bonus=foe?.saves?.[l.save]??0,shift=spellSaveShift(next,key,random).amount,t=die+bonus-shift;saved=t>=dc;text=`${l.save} save d20 ${die} + ${bonus}${shift?' − '+shift+' Bane':''} = ${t} vs DC ${dc}: ${saved?'success':'failure'}; `;}
    const dealt=defended(foe??{},l.type,saved?(l.half?Math.floor(rolled/2):0):rolled);total+=dealt;
    lines.push(`${spellName(src.c.id)}${src.name?' ('+src.name+')':''}: ${name} ends its turn in it. ${text}${dealt} ${l.type} damage (${dice.length}d${l.die} [${dice.join(', ')}]${saved&&l.half?', halved':''}).`);
    if(l.restrain&&!saved&&!(markOf(next,key).spells??[]).some(m=>m.id===src.c.id))next=withSpellMark(next,key,{id:src.c.id,cond:'restrained',by:src.by,dc,save:'Strength'});
  }
  if(total>0){
    const struck=harmCreature(next,key,total);next=struck.game;if(struck.line)lines.push(struck.line);
    const broke=spellCondsOf(next,key).filter(c=>breakable.includes(c));if(broke.length){next=breakOnDamage(next,key);lines.push(brokenLine(name,broke));}
  }
  return {game:next,lines,damage:total};
}
function dropSpellMark(game,key,m){return setSpellMarks(game,key,(markOf(game,key).spells??[]).filter(x=>!(x.id===m.id&&x.cond===m.cond&&x.by===m.by)));}
// Webs that fire touches burn away: a creature caught in them is free, and burns at the start of its next turn.
export function websBurn(game,key,type,name){
  if(type!=='Fire')return {game,lines:[]};
  const caught=(markOf(game,key).spells??[]).find(m=>m.id==='web'&&m.cond==='restrained');if(!caught)return {game,lines:[]};
  let next=dropSpellMark(game,key,caught);next=withSpellMark(next,key,{id:'web',cond:'aflame',by:caught.by,dc:caught.dc,save:'Dexterity',rounds:1});
  return {game:next,lines:[`The webs around ${name.replace(/^The /,'the ')} catch fire and burn away: ${name} is free, but burns at the start of its next turn.`]};
}
// The spell held can be used again this turn (its kind: 'bonus' or 'action'), or why not.
export function againError(game,fighting=game.stage==='combat'||!!game.npcCombat?.active){
  const c=game.concentration,l=c?lastingSpells[c.id]:null;
  if(!l?.again)return 'You hold no spell you can call on again.';
  if(!fighting)return `${spellName(c.id)} is used again in a fight.`;
  if(l.later&&c.fresh)return `${spellName(c.id)} can be used again on a later turn.`;
  if(l.again==='bonus'&&game.bonusUsed)return 'Your bonus action is already used this turn.';
  if(l.again==='action'&&game.actionUsed)return 'You have already used your action this turn. Use a bonus action or end your turn.';
  if(l.again==='action'&&game.surged)return 'The extra action from Action Surge cannot be used for magic.';
  return '';
}
// A lasting spell used again (Spiritual Weapon's strike, Heat Metal, rolling the Flaming Sphere, moving Moonbeam, Call
// Lightning, Vampiric Touch) on the creature `key`, whose defences are `target`.
export function spellAgain(hero,game,health,maximum,key,target,random=Math.random){
  const fighting=game.stage==='combat'||!!game.npcCombat?.active,error=againError(game,fighting);if(error)return {error};
  if(health?.current===0)return {error:'You cannot cast at 0 HP.'};
  target=withDefenses(game,key,target);
  const c=game.concentration,l=lastingSpells[c.id],spell=spellLibrary.find(s=>s.id===c.id),level=c.level??spell.level;
  if(l.same&&c.target&&key!==c.target)return {error:`${spell.name} works only on the metal it first heated.`};
  const mod=modifier(hero.scores[castingAbility(hero)]),bonus=proficiencyBonus(hero.level)+mod,dc=8+bonus,roll=(n,d)=>Array.from({length:n},()=>1+Math.floor(random()*d)),sum=d=>d.reduce((a,b)=>a+b,0);
  const count=l.count+Math.max(0,level-spell.level)*(l.upcast??0),called=key==='foe'?'the '+String(target.name??'foe').replace(/^the /i,''):target.name??key;
  let next={...game,concentration:{...c,...(l.move?{target:key}:{})}},damage=0;const hp={current:health?.current??maximum,temp:health?.temp??0},logs=[],how=l.again==='bonus'?'bonus action':'action';
  if(l.attack){
    const edge=spellEdge(next,key,false),rolled=rollAttack({attackBonus:bonus+(hero.equipment?.magic?.spellAttack??0)},edgeMode('normal',edge),random),bless=attackBoost(next,random);
    const attack={...rolled,total:rolled.total+bless.amount},hit=!attack.miss&&(attack.critical||attack.total>=target.ac),critical=attack.critical||(hit&&helpless(next,key));
    if(edge.adv.includes('Guiding Bolt'))next=spendGuidance(next,key);
    let line=`${spell.name} (${how}) at ${called}: d20 [${attack.dice.join(', ')}] (${attack.mode}) + ${bonus}${bless.amount?' + '+bless.amount+' Bless':''} = ${attack.total} vs AC ${target.ac}. ${critical?'Critical hit':hit?'Hit':'Miss'}`;
    if(hit){
      const dice=roll(count*(critical?2:1),l.die),raw=sum(dice)+(l.addMod?mod:0);damage=defended(target,l.type,raw);
      line+=`; ${damage} ${l.type} damage (${dice.length}d${l.die} [${dice.join(', ')}]${l.addMod?' + '+mod:''}).`;logs.push(line);
      const rider=riderDamage(hero,next,key,critical,random);next=rider.game;damage+=defended(target,rider.type,rider.amount);logs.push(...rider.lines);
      if(l.drain&&damage>0){const was=hp.current;hp.current=Math.min(maximum,hp.current+Math.floor(damage/2));logs.push(`You draw back ${hp.current-was} HP.`);}
    } else logs.push(line+'.');
  } else {
    const dice=roll(count,l.die),rolled=sum(dice);
    if(l.save){
      const die=1+Math.floor(random()*20),saveBonus=target.saves?.[l.save]??0,shift=spellSaveShift(next,key,random).amount,total=die+saveBonus-shift,saved=total>=dc;
      damage=defended(target,l.type,saved?(l.half?Math.floor(rolled/2):0):rolled);
      logs.push(`${spell.name} (${how}) on ${called}: ${l.save} save d20 ${die} + ${saveBonus}${shift?' − '+shift+' Bane':''} = ${total} vs DC ${dc}: ${saved?'success':'failure'}; ${damage} ${l.type} damage (${count}d${l.die} [${dice.join(', ')}]${saved&&l.half?', halved':''}).`);
    } else {
      // Heat Metal: the damage comes with no save; a failed Constitution save drops the metal if it can, and keeping hold
      // of it (a success, or armour it wears) spoils its attacks until your next turn.
      damage=defended(target,l.type,rolled);
      const die=1+Math.floor(random()*20),saveBonus=target.saves?.Constitution??0,total=die+saveBonus,saved=total>=dc,worn=!!c.worn;
      logs.push(`${spell.name} (${how}): the metal of ${called} glows red-hot again: ${damage} ${l.type} damage (${count}d${l.die} [${dice.join(', ')}]). Constitution save d20 ${die} + ${saveBonus} = ${total} vs DC ${dc}: ${heatLine(saved,worn)}`);
      if(saved||worn)next=withSpellMark(next,key,{id:spell.id,cond:'scorched',by:heroIdOf(next),dc,save:'Constitution',rounds:1});
    }
  }
  if(damage>0){
    const burnt=websBurn(next,key,l.type,called.charAt(0).toUpperCase()+called.slice(1));next=burnt.game;logs.push(...burnt.lines);
    const broke=spellCondsOf(next,key).filter(c2=>breakable.includes(c2));if(broke.length){next=breakOnDamage(next,key);logs.push(brokenLine(called.charAt(0).toUpperCase()+called.slice(1),broke));}
  }
  return {game:next,health:hp,logs,damage,bonus:l.again==='bonus'};
}
// Hex or Hunter's Mark moved to a new creature (a bonus action) once the one it was on has dropped.
export function moveMark(game,key,called){
  const c=game.concentration;if(!c||!automaticEffects[c.id]?.rider)return {error:'You hold no Hex or Hunter’s Mark to move.'};
  if(!c.lost)return {error:`${spellName(c.id)} moves only once the creature it is on has dropped.`};
  if((game.stage==='combat'||game.npcCombat?.active)&&game.bonusUsed)return {error:'Your bonus action is already used this turn.'};
  const next={...game,concentration:{...c,target:key}};delete next.concentration.lost;
  return {game:next,logs:[`${spellName(c.id)} moves to ${called} (bonus action): each of your hits with an attack roll on it deals the extra damage.`],damage:0,bonus:true};
}
// Hex or Hunter's Mark whose creature has dropped (it may be moved with a bonus action: `lost`), or whose fight has
// ended without it dropping (it holds on a creature no longer here: `gone`).
export function markGone(game){
  const c=game.concentration;if(!c?.target)return game;
  // Any other held spell on a creature of a fight that is over: one that stays on its creature (Heat Metal) ends with
  // it gone; one that can be moved (Moonbeam, Flaming Sphere) is held on nothing until it is moved or runs out.
  if(!automaticEffects[c.id]?.rider){
    const k=String(c.target);if(!(k==='foe'||k.startsWith('ally:'))||game.stage==='combat')return game;
    const next={...game};if(lastingSpells[c.id]?.same)delete next.concentration;else{next.concentration={...c};delete next.concentration.target;}
    return next;
  }
  const k=String(c.target),fight=game.stage==='combat';
  const dropped=k==='foe'?game.enemyHP<=0:k.startsWith('ally:')?!(game.foeAllies?.[Number(k.slice(5))]?.hp>0):(game.npcHP?.[k]??1)<=0||game.npcFate?.[k]==='dead';
  const away=!dropped&&(k==='foe'||k.startsWith('ally:'))&&!fight;
  if(!dropped&&!away)return game;
  const next={...game,concentration:{...c,...(dropped?{lost:true}:{gone:true})}};delete next.concentration.target;return next;
}
// What a held spell can do again right now, as choices: [id, label, action, kind] (kind 'bonus' or 'action'), at each
// creature it can reach (`keys`: the foe and the creatures beside it, or the people fighting; with names).
export function sustainChoices(game,targets){
  const c=game.concentration,list=[];if(!c)return list;
  const l=lastingSpells[c.id],fighting=game.stage==='combat'||!!game.npcCombat?.active;
  if(l?.again&&!againError(game,fighting)){
    const name=spellName(c.id),pool=l.same&&c.target?targets.filter(t=>t.key===c.target):targets;
    for(const t of pool)list.push(['again:'+t.key,`${name} (${l.again==='bonus'?'bonus action':'action'}): ${l.verb} ${t.name}`,'again:'+t.key,l.again]);
  }
  if(c.lost&&automaticEffects[c.id]?.rider&&!((game.stage==='combat'||game.npcCombat?.active)&&game.bonusUsed))
    for(const t of targets)list.push(['move-mark:'+t.key,`Move ${spellName(c.id)} to ${t.name} (bonus action)`,'move-mark:'+t.key,'bonus']);
  return list;
}
// The creatures a held spell can reach now: the foe and the creatures beside it, or the people fighting the hero.
export function sustainTargets(game){
  if(game.stage==='combat'){
    const foe=game.wildFight?.name??game.story?.foe??(game.dungeon?.active?'the guardian':'the Lantern Wisp');
    return [...(game.enemyHP>0?[{key:'foe',name:/^the /i.test(foe)?foe:'the '+foe}]:[]),...(game.foeAllies??[]).map((a,i)=>({key:'ally:'+i,name:'the '+a.name,hp:a.hp})).filter(a=>a.hp>0).map(({key,name})=>({key,name}))];
  }
  if(game.npcCombat?.active)return game.npcCombat.order.filter(n=>n.side==='enemy'&&(game.npcHP?.[n.id]??npcProfile(game,n.id)?.maximumHP??1)>0&&game.npcFate?.[n.id]!=='dead').map(n=>({key:n.id,name:npcProfile(game,n.id)?.name??n.id}));
  return [];
}
export const sustainOptions=game=>sustainChoices(game,sustainTargets(game));
