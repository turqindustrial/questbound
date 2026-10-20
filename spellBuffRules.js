// Blessings, wards and buffs (the table of who a spell for friends reaches, allyTargets, stays in spellRules.js with
// automaticEffects): buffs the hero casts on themselves and their count-down, Shield as a reaction, the hero's armor
// class under spells, Guidance and Resistance spent, and spells for friends: boons on other heroes and companions
// (game.boons), Aid, healing another hero at the table (partyHeal) and Protection from Evil and Good.
import {slotChoices,spellLibrary} from "./spellOptions";
import {modifier} from "./characterRules";
import {npcProfile,npcScene,npcLore} from "./npcRules";
import {boonOn,ownBoonKey,heroIdOf} from "./masteryRules";
import {creatureNature} from "./spellDamageRules";
import {castingAbility,knownSpells,spendSpell,allyTargets} from "./spellRules";
// Only explicitly automated self-casts change defenses; DM rulings may target others.
// Mage Armor and Barkskin set a floor under the hero's AC; Shield of Faith adds 2 and Shield (until their next turn) 5.
export function spellDefense(game,baseAC,attacker={}) {
  const active=game?.concentration;
  const id=active?.automaticProtection===true && active.remaining>0?active.id:null;
  let ac=baseAC;
  if(ac!==null){
    if(game?.buffs?.['mage-armor']?.ac)ac=Math.max(ac,game.buffs['mage-armor'].ac);
    if(game?.buffs?.barkskin)ac=Math.max(ac,17);
    if(id==='shield-of-faith'&&active.self!==false)ac+=2;
    // A friend's Shield of Faith on this hero (game.boons).
    else if(boonOn(game,ownBoonKey(game),'shield-of-faith'))ac+=2;
    if(game?.shieldUp)ac+=5;
  }
  return {ac,disadvantage:id==='blur' && !attacker.blindsight && !attacker.truesight};
}
// Healing another player's hero in the party: up to their maximum, and one who is down (dying) wakes. Null when they
// are not in the party, are this device's own hero, or are dead.
export function partyHeal(game,id,amount){
  const member=game.party?.members?.[id];if(!member||id===game.party.lead||member.status==='dead')return null;
  let name='your companion';try{name=JSON.parse(member.character).name||name;}catch{}
  const most=member.stats?.hp??1,was=member.status==='down'?0:member.health?.current??most,now=Math.min(most,was+Math.max(0,amount));
  if(now<=was)return {party:game.party,name,was,now:was};
  const hero={...(member.hero??{})};delete hero.dying;
  return {party:{...game.party,members:{...game.party.members,[id]:{...member,status:'up',health:{current:now,temp:member.status==='down'?0:member.health?.temp??0},hero}}},name,was,now};
}
const armourWorn=hero=>(hero.equipment?.items??[]).some(i=>i.quantity>0&&/(Armor|Mail|Chain Shirt|Breastplate|Plate)\b/.test(i.name)&&!/^Shield$/.test(i.name));
// A buff the hero casts on themselves.
export function castBuff(hero,game,hp,spell,effect,{mod,request,foeType}){
  const next={...game},lines=[],buffs={...(game.buffs??{})};
  switch(effect.buff){
    case 'bless':lines.push('Bless: you add 1d4 to your attack rolls and saving throws while you hold the spell (up to 1 minute).');break;
    case 'heroism':{const gain=Math.max(1,mod);hp.temp=Math.max(hp.temp,gain);lines.push(`Heroism: you know no fear, and gain ${gain} temporary HP at the start of each of your turns while you hold the spell. Temporary HP now ${hp.temp}.`);break;}
    case 'guidance':lines.push('Guidance: you add 1d4 to your next ability check while the spell holds (up to 1 minute).');break;
    case 'resistance':{
      const said=String(request.intent??'').toLowerCase(),types=['Acid','Bludgeoning','Cold','Fire','Lightning','Necrotic','Piercing','Poison','Radiant','Slashing','Thunder'];
      const t=types.find(x=>said.includes(x.toLowerCase()))??(types.includes(foeType)?foeType:'Slashing');
      next.concentration={...next.concentration,damageType:t};
      lines.push(`Resistance: ${t} damage that reaches you is reduced by 1d4, once a turn, while you hold the spell (up to 1 minute).`);break;
    }
    case 'mage-armor':{
      if(armourWorn(hero))return {error:'Mage Armor works only for someone wearing no armour.'};
      const ac=13+modifier(hero.scores?.Dexterity??10);buffs['mage-armor']={remaining:4800,ac};
      lines.push(`Mage Armor: your Armor Class is ${ac} (13 + Dexterity) for 8 hours, while you wear no armour.`);break;
    }
    case 'ward':case 'stride':{
      const own=ownBoonKey(game),kept=(game.boons?.[own]??[]).filter(b=>b.id!==spell.id);next.boons={...(game.boons??{}),[own]:[...kept,{id:spell.id,by:heroIdOf(game)}]};
      lines.push(effect.buff==='ward'?'Protection from Evil and Good: aberrations, celestials, elementals, fey, fiends and undead have disadvantage on their attacks against you, and cannot charm, frighten or possess you, while you hold the spell (up to 10 minutes).':'Longstrider: you move 10 feet faster for the next hour.');break;
    }
    case 'barkskin':buffs.barkskin={remaining:600};lines.push('Barkskin: your Armor Class is at least 17 for the next hour.');break;
    case 'divine-favor':buffs['divine-favor']={remaining:10};lines.push('Divine Favor: your weapon hits deal an extra 1d4 Radiant damage for 1 minute.');break;
    case 'shillelagh':{
      if(!(hero.equipment?.items??[]).some(i=>i.quantity>0&&/\b(Club|Quarterstaff)\b/.test(i.name)))return {error:'Shillelagh needs a club or a quarterstaff in your hand.'};
      buffs.shillelagh={remaining:10,ability:castingAbility(hero)??'Wisdom'};
      lines.push(`Shillelagh: your club or quarterstaff strikes with your ${castingAbility(hero)??'Wisdom'} and a heavier die for 1 minute.`);break;
    }
    default:break;
  }
  next.buffs=buffs;if(!Object.keys(buffs).length)delete next.buffs;
  return {game:next,lines};
}
// Shield, cast for the hero as a reaction when a blow would otherwise land: +5 AC until the start of their next turn,
// unless the player turned that off on their device.
// Returns null when it cannot or would not help (a critical hit, a blow that hits anyway, no reaction or slot left).
export function shieldReaction(hero,game,attackTotal,ac,critical){
  // The player can keep their slots: the device setting "Use Shield when it saves you" (storyPreferences.js autoShield)
  // reaches the rules as hero.autoShield=false (Adventure.js rulesHero).
  if(hero?.autoShield===false)return null;
  if(critical||attackTotal<ac||attackTotal>=ac+5||game.reactionUsed||game.shieldUp)return null;
  const spell=knownSpells(hero).find(s=>s.id==='shield');if(!spell)return null;
  const slot=slotChoices(hero,game,spell)[0];if(typeof slot!=='number')return null;
  const next=spendSpell(hero,game,spell,slot);if(game.slotSpentThisTurn)next.slotSpentThisTurn=true;else delete next.slotSpentThisTurn;
  return {game:{...next,reactionUsed:true,shieldUp:true},line:`Shield (reaction, level ${slot} slot): a barrier of force flares up: +5 AC until your next turn, so the blow misses.`};
}
// The start of the hero's turn: Shield drops, Resistance can work again, and Heroism grants its temporary hit points.
export function heroTurnBegins(hero,game,health){
  let next=game,hp=health;const lines=[];
  if(next.shieldUp){next={...next};delete next.shieldUp;}
  if(next.concentration?.used){next={...next,concentration:{...next.concentration}};delete next.concentration.used;}
  // A friend's Resistance on this hero works once a turn too.
  const own=ownBoonKey(next),resist=boonOn(next,own,'resistance');
  if(resist?.used)next={...next,boons:{...next.boons,[own]:next.boons[own].map(b=>b.id==='resistance'?{id:b.id,by:b.by,type:b.type}:b)}};
  // Heroism, their own (unless held only for others) or a friend's.
  const heroic=next.concentration?.id==='heroism'&&next.concentration.self!==false?Math.max(1,modifier(hero.scores?.[castingAbility(hero)]??10)):boonOn(next,own,'heroism')?.amount??0;
  if(heroic>0&&(hp?.current??0)>0){
    if(heroic>(hp.temp??0)){hp={...hp,temp:heroic};lines.push(`Heroism: ${heroic} temporary HP.`);}
  }
  return {game:next,health:hp,lines};
}
// Spells and buffs that count down at the end of the hero's turn.
export function tickBuffs(game){
  if(!game.buffs)return game;
  const buffs={};for(const [id,b] of Object.entries(game.buffs)){if(b.remaining===null||b.remaining===undefined){buffs[id]=b;continue;}if(b.remaining>1)buffs[id]={...b,remaining:b.remaining-1};}
  const next={...game,buffs};if(!Object.keys(buffs).length)delete next.buffs;return next;
}
// Guidance spent on an ability check: 1d4, and the spell ends.
export function guidanceBonus(game,random=Math.random){
  // A friend's Guidance on this hero is spent the same way.
  const own=game?ownBoonKey(game):null;
  if(game?.concentration?.id!=='guidance'||game.concentration.self===false){
    if(!own||!boonOn(game,own,'guidance'))return null;
    const die=1+Math.floor(random()*4),list=game.boons[own].filter(b=>b.id!=='guidance'),boons={...game.boons};if(list.length)boons[own]=list;else delete boons[own];
    const next={...game,boons};if(!Object.keys(boons).length)delete next.boons;return {die,game:next};
  }
  const die=1+Math.floor(random()*4),next={...game};delete next.concentration;return {die,game:next};
}
// Resistance: 1d4 off damage of the chosen type, once a turn.
export function resistedDamage(game,type,amount,random=Math.random){
  const c=game.concentration;
  if(c?.id!=='resistance'||c.self===false||c.damageType!==type||c.used||amount<=0){
    // A friend's Resistance on this hero.
    const own=ownBoonKey(game),b=boonOn(game,own,'resistance');
    if(!b||b.type!==type||b.used||amount<=0)return {game,amount,line:null};
    const d=1+Math.floor(random()*4),now=Math.max(0,amount-d);
    return {game:{...game,boons:{...game.boons,[own]:game.boons[own].map(x=>x.id==='resistance'?{...x,used:true}:x)}},amount:now,line:`Resistance takes ${amount-now} off the ${type.toLowerCase()} damage.`};
  }
  const d=1+Math.floor(random()*4),now=Math.max(0,amount-d);
  return {game:{...game,concentration:{...c,used:true}},amount:now,line:`Resistance takes ${amount-now} off the ${type.toLowerCase()} damage.`};
}
// Spells a hero casts for friends, and how many friends one casting reaches.
export const allySpell=id=>!!allyTargets[id];
export const allySpellLimit=(spell,level=spell.level)=>{const t=allyTargets[spell.id]??{base:1};return (t.base??1)+Math.max(0,level-spell.level)*(t.upcast??0);};
// Who a spell for friends can reach: 'self', another hero at the table ('party:<id>'), or a companion here (their id).
const allyBoonKey=(game,a)=>a==='self'?ownBoonKey(game):a.startsWith('party:')?'h:'+a.slice(6):a;
function allyName(game,a){
  if(a==='self')return 'you';
  if(a.startsWith('party:')){try{return JSON.parse(game.party.members[a.slice(6)].character).name||'your companion';}catch{return 'your companion';}}
  return npcProfile(game,a)?.name??a;
}
function allyError(game,a){
  if(a==='self')return '';
  if(typeof a!=='string')return 'Name who the spell is for.';
  if(a.startsWith('party:')){const id=a.slice(6),m=game.party?.members?.[id];if(!m||id===game.party.lead)return 'That hero is not here.';return m.status==='dead'?'They are dead. No spell you know can bring them back.':'';}
  if(!npcScene(game).some(n=>n.id===a&&n.present)||game.npcFate?.[a]==='dead')return 'They are not here.';
  return '';
}
// The other heroes standing at the table, and the companions at the hero's side.
const partyHeroIds=game=>Object.entries(game.party?.members??{}).filter(([id,m])=>id!==game.party.lead&&m?.status==='up').map(([id])=>id);
export const companionsHere=game=>npcScene(game).filter(n=>n.present&&n.fate!=='dead'&&game.followers?.[n.id]?.status==='following').map(n=>n.id);
// When the player names no one: Bless and Aid go to the caster, then the other heroes standing at the table, then the
// companions at their side, as many as the spell reaches; every other spell for friends goes to the caster.
export function defaultAllies(game,spell,level=spell.level){
  if(!['bless','aid'].includes(spell.id))return ['self'];
  return ['self',...partyHeroIds(game).map(id=>'party:'+id),...companionsHere(game)].slice(0,allySpellLimit(spell,level));
}
// The friends a player named ("on me, Bram and Mara", "on the party"): their keys, or null when a name is not one of
// them (the spell then goes to the Dungeon Master's ruling as before).
export function alliesNamed(game,spell,text,level=spell.level){
  const t=String(text??'').toLowerCase().replace(/[.!]+$/,'').trim();
  if(!t)return null;
  if(/^(?:us|us all|all of us|everyone|everybody|the party|my party|my friends|my allies|my companions|the group|the team)$/.test(t))return ['self',...partyHeroIds(game).map(id=>'party:'+id),...companionsHere(game)].slice(0,allySpellLimit(spell,level));
  const names=[];
  for(const id of Object.keys(game.party?.members??{})){if(id===game.party.lead)continue;let name='';try{name=String(JSON.parse(game.party.members[id].character).name??'').toLowerCase();}catch{}if(name)names.push(['party:'+id,name]);}
  for(const n of npcScene(game).filter(p=>p.present&&p.fate!=='dead'))names.push([n.id,String(npcLore(game,n.id)?.name??n.name??n.id).toLowerCase()]);
  const keys=[];
  for(const raw of t.split(/\s*(?:,|\band\b|&)\s*/).map(w=>w.trim().replace(/^(?:the|my)\s+/,'')).filter(Boolean)){
    if(['me','myself','self','i','you'].includes(raw)){keys.push('self');continue;}
    // The game writes people's ids into the player's words ("on mara"), so an id matches too.
    const hit=names.find(([id,name])=>{const first=name.split(' ')[0];return raw===id||raw===name||raw===first||raw.startsWith(first+' ')||name.split(' ').includes(raw);});
    if(!hit)return null;keys.push(hit[0]);
  }
  return keys.length?[...new Set(keys)]:null;
}
const nameList=list=>list.length<=1?(list[0]??''):list.slice(0,-1).join(', ')+' and '+list[list.length-1];
const resistanceType=(request,foeType)=>{const said=String(request.intent??'').toLowerCase(),types=['Acid','Bludgeoning','Cold','Fire','Lightning','Necrotic','Piercing','Poison','Radiant','Slashing','Thunder'];return types.find(x=>said.includes(x.toLowerCase()))??(types.includes(foeType)?foeType:'Slashing');};
// A spell for friends, cast on the friends chosen (the caster among them or not). `hp` is the caster's own hit points,
// changed in place as castBuff does.
export function castOnAllies(hero,game,hp,spell,effect,{level,mod,request,foeType}){
  const limit=allySpellLimit(spell,level),chosen=[...new Set(request.allies?.length?request.allies:['self'])];
  if(chosen.length>limit)return {error:`${spell.name} reaches ${limit===1?'one creature':'up to '+limit+' creatures'} with this slot.`};
  for(const a of chosen){const e=allyError(game,a);if(e)return {error:e};}
  // Guidance helps with ability checks, which the game rolls only for heroes; for a companion the Dungeon Master rules.
  if(effect.buff==='guidance'&&chosen.some(a=>a!=='self'&&!a.startsWith('party:')))return {ruling:true};
  let next={...game};const me=heroIdOf(game),self=chosen.includes('self'),others=chosen.filter(a=>a!=='self'),names=chosen.map(a=>allyName(game,a));
  const who=nameList(names),lines=[];
  // A concentration spell held only for others leaves the caster as they were.
  if(spell.concentration&&next.concentration?.id===spell.id&&!self)next.concentration={...next.concentration,self:false};
  if(effect.aid){
    // Aid: each one's hit point maximum and current hit points rise by 5 for each slot level above 1st, for 8 hours (a
    // long rest ends it). A second casting does not add to the first; a stronger one raises it to the new amount.
    const amount=Math.min(40,5*Math.max(1,level-1)),raised=[];
    for(const a of chosen){
      if(a==='self'){const had=next.buffs?.aid?.amount??0;if(amount>had){next.buffs={...(next.buffs??{}),aid:{remaining:4800,amount}};hp.current+=amount-had;raised.push('you');}continue;}
      if(a.startsWith('party:')){
        const id=a.slice(6),m=next.party.members[id],had=m.hero?.buffs?.aid?.amount??0;if(amount<=had)continue;
        const up=amount-had,most=(m.stats?.hp??1)+up,was=m.status==='down'?0:m.health?.current??m.stats?.hp??1,hero2={...(m.hero??{}),buffs:{...(m.hero?.buffs??{}),aid:{remaining:4800,amount}}};
        if(m.status==='down')delete hero2.dying;
        next.party={...next.party,members:{...next.party.members,[id]:{...m,status:'up',stats:{...(m.stats??{ac:10}),hp:most},health:{current:Math.min(most,was+up),temp:m.status==='down'?0:m.health?.temp??0},hero:hero2}}};
        raised.push(allyName(game,a)+(was===0?' (wakes)':''));continue;
      }
      const had=next.aided?.[a]??0;if(amount<=had)continue;
      const up=amount-had,was=next.npcHP?.[a]??npcProfile(next,a).maximumHP;
      next.aided={...(next.aided??{}),[a]:amount};next.npcHP={...(next.npcHP??{}),[a]:was+up};
      if(was===0&&next.npcFate?.[a]){next.npcFate={...next.npcFate};delete next.npcFate[a];if(!Object.keys(next.npcFate).length)delete next.npcFate;}
      raised.push(allyName(game,a)+(was===0?' (comes round)':''));
    }
    lines.push(raised.length?`Aid on ${nameList(raised)}: each one’s hit point maximum and current hit points rise by ${amount} for 8 hours.`:`Aid: everyone chosen already has as much from Aid (${amount}).`);
    return {game:next,lines};
  }
  if(self){
    if(effect.buff&&['bless','heroism','guidance','resistance'].includes(effect.buff)){const own=castBuff(hero,next,hp,spell,effect,{mod,request,foeType});if(own.error)return own;next=own.game;}
    else if(effect.protection)next.concentration={...next.concentration,automaticProtection:true};
    else next=withBoonFor(next,ownBoonKey(next),{id:spell.id,by:me});
  }
  const type=effect.buff==='resistance'?resistanceType(request,foeType):null,amount=Math.max(1,mod);
  for(const a of others){
    const entry={id:spell.id,by:me,...(effect.buff==='heroism'?{amount}:{}),...(type?{type}:{})};
    next=withBoonFor(next,allyBoonKey(next,a),entry);
    // Heroism's first temporary hit points reach another hero at once.
    if(effect.buff==='heroism'&&a.startsWith('party:')){const id=a.slice(6),m=next.party.members[id];if(m.status==='up'&&(m.health?.temp??0)<amount)next.party={...next.party,members:{...next.party.members,[id]:{...m,health:{current:m.health?.current??m.stats?.hp??1,temp:amount}}}};}
  }
  const on=`${spell.name} on ${who}`;
  lines.push(({
    bless:`${on}: each adds 1d4 to attack rolls and saving throws while you hold the spell (up to 1 minute).`,
    heroism:`${on}: each knows no fear and gains ${amount} temporary HP at the start of each of their turns while you hold the spell.${self?' Your temporary HP now '+hp.temp+'.':''}`,
    guidance:`${on}: the next ability check adds 1d4 while the spell holds (up to 1 minute).`,
    resistance:`${on}: ${type} damage that reaches them is reduced by 1d4, once a turn, while you hold the spell (up to 1 minute).`,
    ward:`${on}: aberrations, celestials, elementals, fey, fiends and undead have disadvantage on their attacks against them, and cannot charm, frighten or possess them, while you hold the spell (up to 10 minutes).`,
    stride:`${on}: each moves 10 feet faster for the next hour.`,
  })[effect.buff]??`${on}: a shimmering field gives each +2 AC while you hold the spell (up to 10 minutes).`);
  return {game:next,lines};
}
function withBoonFor(game,key,entry){const kept=(game.boons?.[key]??[]).filter(b=>b.id!==entry.id);return {...game,boons:{...(game.boons??{}),[key]:[...kept,entry].slice(-8)}};}
// A concentration spell's boons last only while its caster holds it (on this device, or a party member's); casting it
// again replaces the old ones.
export function endBoons(game,recast=null){
  if(!game.boons)return game;
  const me=heroIdOf(game),holds=by=>by===me?game.concentration?.id:game.party?.members?.[by]?.hero?.concentration?.id;
  const boons={};
  for(const [key,list] of Object.entries(game.boons)){
    const kept=list.filter(b=>{const spell=spellLibrary.find(s=>s.id===b.id);if(b.by===me&&recast&&b.id===recast)return false;return !spell?.concentration||holds(b.by)===b.id;});
    if(kept.length)boons[key]=kept;
  }
  if(JSON.stringify(boons)===JSON.stringify(game.boons))return game;
  const next={...game,boons};if(!Object.keys(boons).length)delete next.boons;return next;
}
// Protection from Evil and Good on whoever a creature strikes: disadvantage for an aberration, celestial, elemental,
// fey, fiend or undead. `boonKey`: masteryRules boonKeyOf.
export function wardEdge(game,key,boonKey){return boonOn(game,boonKey,'protection-from-evil-and-good')&&creatureNature(game,key).otherworldly?['Protection from Evil and Good']:[];}
