import {spellLibrary,automaticSpells,speciesSpells,speciesUseLimit,slotChoices,slotUsed} from './spellOptions';
import {modifier,proficiencyBonus,subclassActive} from './characterRules';
import {rollAttack,rollDamage,attackOptions} from './weaponRules';
import {npcProfile,npcScene,npcIdsOf} from './npcRules';
import {heroIdOf,markOf,withMark,edgeMode} from './masteryRules';

export const spellAbility={Artificer:'Intelligence',Bard:'Charisma',Cleric:'Wisdom',Druid:'Wisdom',Paladin:'Charisma',Ranger:'Wisdom',Sorcerer:'Charisma',Warlock:'Charisma',Wizard:'Intelligence',Fighter:'Intelligence',Rogue:'Intelligence'};
// Explicit effects only. Unimplemented spells use a visible DM ruling, never guessed dice.
export const automaticEffects={
  'detect-magic':{detection:true},
  'shield-of-faith':{protection:true},
  blur:{protection:true},
  'acid-splash':{save:'Dexterity',die:6,type:'Acid'},
  'sacred-flame':{save:'Dexterity',die:8,type:'Radiant'},
  'vicious-mockery':{save:'Wisdom',die:6,type:'Psychic',weaken:true},
  shock:{attack:'melee',die:8,type:'Lightning',condition:'No opportunity attacks'},
  blast:{attack:'ranged',die:10,type:'Force',beams:true},
  'fire-bolt':{attack:'ranged',die:10,type:'Fire'},
  'poison-spray':{attack:'ranged',die:12,type:'Poison'},
  'chill-touch':{attack:'melee',die:10,type:'Necrotic',condition:'Cannot regain HP'},
  'ray-of-frost':{attack:'ranged',die:8,type:'Cold',condition:'Speed reduced by 10 feet'},
  'burning-hands':{save:'Dexterity',die:6,count:3,upcast:1,type:'Fire',half:true},
  fireball:{save:'Dexterity',die:6,count:8,upcast:1,type:'Fire',half:true},
  'lightning-bolt':{save:'Dexterity',die:6,count:8,upcast:1,type:'Lightning',half:true},
  'chain-lightning':{save:'Dexterity',die:8,count:10,type:'Lightning',half:true},
  'circle-of-death':{save:'Constitution',die:8,count:8,upcast:2,type:'Necrotic',half:true},
  'scorching-ray':{attack:'ranged',rays:3,die:6,count:2,type:'Fire'},
  'mass-cure-wounds':{heal:true,die:8,count:5,upcast:1},
  'mass-healing-word':{heal:true,die:4,count:2,upcast:1},
  'inflict-wounds':{save:'Constitution',die:10,count:2,upcast:1,type:'Necrotic',half:true},
  cure:{heal:true,die:8,count:2,upcast:2},
  'healing-word':{heal:true,die:4,count:2,upcast:2},
  'false-life':{temp:true},
  missile:{missile:true,type:'Force'},
  // Damage spells the game rolls itself (checked against each spell's own text in spellCatalog.json). Lasting areas
  // (Moonbeam, Flaming Sphere, Call Lightning, Spirit Guardians) deal their first damage when cast.
  'starry-wisp':{attack:'ranged',die:8,type:'Radiant'},
  'produce-flame':{attack:'ranged',die:8,type:'Fire',asAction:true},
  'guiding-bolt':{attack:'ranged',die:6,count:4,upcast:1,type:'Radiant',condition:'Next attack has advantage'},
  'ray-of-sickness':{attack:'ranged',die:8,count:2,upcast:1,type:'Poison',condition:'Poisoned'},
  thunderwave:{save:'Constitution',die:8,count:2,upcast:1,type:'Thunder',half:true},
  shatter:{save:'Constitution',die:8,count:3,upcast:1,type:'Thunder',half:true},
  'dissonant-whispers':{save:'Wisdom',die:6,count:3,upcast:1,type:'Psychic',half:true},
  'mind-spike':{save:'Wisdom',die:8,count:3,upcast:1,type:'Psychic',half:true},
  blight:{save:'Constitution',die:8,count:8,upcast:1,type:'Necrotic',half:true},
  'cone-of-cold':{save:'Constitution',die:8,count:8,upcast:1,type:'Cold',half:true},
  moonbeam:{save:'Constitution',die:10,count:2,upcast:1,type:'Radiant',half:true},
  'flaming-sphere':{save:'Dexterity',die:6,count:2,upcast:1,type:'Fire',half:true},
  'call-lightning':{save:'Dexterity',die:10,count:3,upcast:1,type:'Lightning',half:true},
  'spirit-guardians':{save:'Wisdom',die:8,count:3,upcast:1,type:'Radiant',half:true},
  'hellish-rebuke':{save:'Dexterity',die:10,count:2,upcast:1,type:'Fire',half:true},
  'sorcerous-burst':{attack:'ranged',die:8,chooseType:['Acid','Cold','Fire','Lightning','Poison','Psychic','Thunder'],explode:true},
  'chromatic-orb':{attack:'ranged',die:8,count:3,upcast:1,chooseType:['Acid','Cold','Fire','Lightning','Poison','Thunder']},
  'vampiric-touch':{attack:'melee',die:6,count:3,upcast:1,type:'Necrotic',drain:true},
  'acid-arrow':{attack:'ranged',die:4,count:4,upcast:1,type:'Acid',missHalf:true},
  'ice-knife':{attack:'ranged',die:10,type:'Piercing',then:{save:'Dexterity',die:6,count:2,upcast:1,type:'Cold'}},
  'flame-strike':{save:'Dexterity',die:6,count:5,upcast:1,type:'Fire',also:'Radiant',half:true},
  'spiritual-weapon':{attack:'melee',die:8,upcast:1,type:'Force',addMod:true},
};
// Sensing and everyday magic: the game spends the casting (a slot, a ritual's ten minutes, nothing for a cantrip) and
// the Dungeon Master describes what happens, in one telling with no ruling to wait for. Each hint says what to
// describe. `object` marks spells that are cast at something or someone named, so the chip starts the sentence.
export const narratedSpells={
  light:['the light it sheds and what it shows',true],'dancing-lights':['the floating lights and what they reveal'],
  'mage-hand':['what the spectral hand does',true],prestidigitation:['the small trick the hero performs'],
  thaumaturgy:['the small wonder the hero shows'],druidcraft:['the small natural wonder the hero makes'],
  elementalism:['the small play of the elements the hero makes'],message:['the whispered message and any reply',true],
  'minor-illusion':['the sound or image the hero creates'],mending:['the break that closes',true],
  'detect-magic':['what magic, if any, is within 30 feet, and of what kind'],
  'detect-evil-and-good':['whether any aberration, celestial, elemental, fey, fiend or undead is within 30 feet, and where'],
  'detect-poison-and-disease':['any poison, poisonous creature or disease within 30 feet'],
  'comprehend-languages':['what the words heard or read mean'],'speak-with-animals':['what the animals say',true],
  'speak-with-plants':['what the plants remember',true],'locate-object':['which way the object lies, if it is near',true],
  'locate-animals-or-plants':['which way the nearest such creature or plant lies',true],
  'see-invisibility':['anything invisible or out of phase that is now seen'],darkvision:['what can now be seen in the dark'],
  'find-traps':['whether a trap lies within sight, but not where'],'purify-food-and-drink':['the food or drink made clean',true],
  'create-or-destroy-water':['the water made or taken away',true],'illusory-script':['the hidden writing',true],
  alarm:['the ward that is set'],'tiny-hut':['the dome of force raised around the party'],
  'unseen-servant':['the invisible servant and its errand'],'floating-disk':['the floating disk that follows the hero'],
  'spider-climb':['the hero clinging to walls and ceilings'],'water-breathing':['breathing beneath the water'],
  'water-walk':['walking on the surface of water'],jump:['the great leap'],longstrider:['the lighter, longer stride'],
  'expeditious-retreat':['the burst of speed'],'disguise-self':['the hero’s new appearance'],
  'silent-image':['the silent illusion the hero shapes'],augury:['an omen: weal, woe, both or neither, for a plan in the next 30 minutes'],
  divination:['a short, truthful answer to one question about the next seven days'],'pass-without-trace':['the hush and shadow that hide the party’s tracks'],
  'misty-step':['the hero vanishing in silver mist and stepping out up to 30 feet away'],darkness:['the magical darkness that fills a 15-foot sphere'],
  'gentle-repose':['the body kept from decay',true],knock:['the lock or bar that opens',true],'rope-trick':['the hidden space above the rope'],
  'speak-with-dead':['the answers the dead give to up to five questions',true],tongues:['the hero speaking and understanding every language'],
  clairvoyance:['what the invisible sensor sees or hears far away'],sending:['the short message sent and the reply',true],
  'detect-thoughts':['the surface thoughts the hero senses',true],
  'animal-messenger':['the small beast that carries the message',true],'locate-creature':['which way the creature lies, if it is near',true],
  'find-the-path':['the way to the place named'],'arcane-eye':['what the invisible eye sees'],'commune-with-nature':['what the land around knows'],
  levitate:['the creature or object rising',true],fly:['the hero taking to the air'],'feather-fall':['the slow, gentle fall'],
};
for(const [id,[hint,object]] of Object.entries(narratedSpells))automaticEffects[id]={...(automaticEffects[id]??{}),narrated:hint,...(object?{object:true}:{})};
// Where a spell can be cast: anywhere the hero stands and is not down (a found place and after victory included).
export const castingStages=['inn','bridge','tower','wild','victory','dungeon','combat'];
const spellName=id=>spellLibrary.find(s=>s.id===id)?.name??id;
// Casting a concentration spell ends the one already held (2024 rules): the line that says so.
export function concentrationReplaced(game,spell){
  return spell.concentration&&game.concentration&&game.concentration.id!==spell.id?`${spellName(game.concentration.id)} ends: you can hold only one spell at a time.`:null;
}
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
  return {ac:profile?.ac??10,saves:{Strength:save,Dexterity:save,Constitution:save,Intelligence:save,Wisdom:save,Charisma:save},distance:10,name:profile?.name??'They',save};
}
export const cantripDice = level => level>=17?4:level>=11?3:level>=5?2:1;
export function knownSpells(hero) {
  const ids=new Set([...(hero.spells??[]),...automaticSpells(hero),...speciesSpells(hero),...Object.values(hero.arcanum??{}),...(hero.class==='Wizard'?(hero.spellbook??[]).filter(id=>spellLibrary.some(s=>s.id===id && s.ritual)):[])]);
  return spellLibrary.filter(s=>ids.has(s.id));
}
// The ability a hero casts with: their class's, or (for a species spell cast by someone with no spellcasting class)
// the best of Intelligence, Wisdom and Charisma, as a lineage lets a hero choose.
export function castingAbility(hero){
  if(spellAbility[hero?.class])return spellAbility[hero.class];
  const s=hero?.scores??{};return ['Charisma','Wisdom','Intelligence'].reduce((best,a)=>(s[a]??0)>(s[best]??0)?a:best,'Intelligence');
}
export function spellMode(id) {return automaticEffects[id]?'automatic':'dm';}
export function spellCostOptions(hero,game,spell) {
  const unpreparedRitual=hero.class==='Wizard' && !hero.spells?.includes(spell.id) && !automaticSpells(hero).includes(spell.id);
  const choices=unpreparedRitual?[]:slotChoices(hero,game,spell);
  if(hero.class==='Warlock' && hero.arcanum?.[spell.level]===spell.id && !game.arcanumUsed?.includes(spell.level))choices.push('arcanum');
  if(spell.ritual)choices.push('ritual');
  // A spell the hero's species grants: once per long rest without a slot (speciesUseLimit), and with slots by a hero
  // who has them (spellcasting from another source is still spellcasting).
  if(speciesSpells(hero).includes(spell.id)&&spell.level>0&&(game.speciesUsed?.[spell.id]??0)<speciesUseLimit(hero,spell.id))choices.unshift('species');
  return choices;
}
// In a fight a spell must be quick: one that takes a minute or more waits for a calmer moment, and a reaction is cast
// when its moment comes (Shield when a blow would land, Hellish Rebuke right after you are hurt), not as your action.
export function fightTimingError(spell,game,reaction=false){
  if(!(game.stage==='combat'||game.npcCombat?.active))return '';
  if(!['Action','Bonus Action','Reaction'].includes(spell.castingTime))return `${spell.name} takes ${spell.castingTime.toLowerCase()} to cast: not in the middle of a fight.`;
  if(spell.castingTime==='Reaction'&&!reaction)return spell.id==='shield'?'Shield is a reaction: the game raises it for you when a blow would otherwise land.':`${spell.name} is cast as a reaction, when its moment comes, not as your action.`;
  return '';
}
export function castError(hero,game,request) {
  const spell=knownSpells(hero).find(s=>s.id===request?.id);
  if(!spell)return 'That spell is not prepared or granted to this character.';
  if(!castingStages.includes(game.stage))return game.stage==='dying'?'You are dying: only a death save now.':game.stage==='dead'?'The dead cast no spells.':'You cannot cast a spell right now.';
  if(game.pendingSpell)return 'Resolve or cancel the pending spell first.';
  const fighting=game.stage==='combat'||!!game.npcCombat?.active,timing=fightTimingError(spell,game,request.reaction);
  if(timing)return timing;
  const flags=game.castingConditions??{},components=spell.components??'';
  if(flags.incapacitated)return 'You cannot cast while incapacitated.';
  if(components.includes('V')&&flags.silenced)return 'This spell needs spoken words, but you are silenced.';
  if((components.includes('S')||components.includes('M'))&&flags.handsBound)return 'This spell needs an available hand, but your hands are bound.';
  if(!spellCostOptions(hero,game,spell).includes(request.slot))return 'No eligible spell slot or free casting remains.';
  if(game.stage==='combat' && request.slot==='ritual')return 'Ritual casting requires time outside this encounter.';
  const bonus=spell.castingTime==='Bonus Action'&&!automaticEffects[spell.id]?.asAction;
  // One action a turn (2024 rules): a spell cast as an action needs the action still unspent, and the extra action
  // of a Fighter's Action Surge cannot be the Magic action.
  if(game.stage==='combat' && !bonus && spell.castingTime!=='Reaction' && game.actionUsed)return 'You have already used your action this turn. Use a bonus action or end your turn.';
  if(game.stage==='combat' && !bonus && spell.castingTime!=='Reaction' && game.surged)return 'The extra action from Action Surge cannot be used to cast a spell.';
  if(fighting && spell.castingTime==='Reaction' && game.reactionUsed)return 'Your reaction is already used.';
  if(fighting && request.reaction && spell.id==='hellish-rebuke' && !game.hurtBy)return 'Hellish Rebuke answers a creature that has just hurt you.';
  if(automaticEffects[spell.id]?.smite && !game.lastHit)return `${spell.name} follows a hit with a melee weapon or an unarmed strike: strike first.`;
  if((game.stage==='combat'||game.npcCombat?.active) && bonus && game.bonusUsed)return 'Your bonus action is already used.';
  if((game.stage==='combat'||game.npcCombat?.active) && typeof request.slot==='number' && request.slot>0 && game.slotSpentThisTurn)return 'You already spent a spell slot this turn.';
  if(typeof request.intent!=='string' || request.intent.trim().length<3 || request.intent.length>500)return 'Describe your target and intended effect.';
  if(request.componentsConfirmed!==true)return 'Confirm that the spell components and casting requirements are available.';
  return '';
}
// Whether the spell could be cast at this moment with some cost the hero has (the chips offer only these): in a
// fight no ritual, and no slot once one was spent this turn. The same rules as castError, so a chip is never refused.
export function castableNow(hero,game,spell,extra={}){
  const fighting=game.stage==='combat'||!!game.npcCombat?.active;
  const costs=spellCostOptions(hero,game,spell).filter(c=>!(fighting&&c==='ritual')&&!(fighting&&typeof c==='number'&&c>0&&game.slotSpentThisTurn));
  return costs.some(slot=>!castError(hero,game,{id:spell.id,slot,intent:'now',componentsConfirmed:true,...extra}));
}
function spendSpell(hero,game,spell,slot) {
  const next={...game};
  if(typeof slot==='number' && slot>0){next.spellSlotsUsed=Array.from({length:9},(_,i)=>slotUsed(game,i+1)+(i+1===slot?1:0));next.resources={...game.resources,slots:next.spellSlotsUsed[0]};next.slotSpentThisTurn=game.stage==='combat'||!!game.npcCombat?.active;}
  if(slot==='arcanum')next.arcanumUsed=[...(game.arcanumUsed??[]),spell.level];
  if(slot==='species')next.speciesUsed={...(game.speciesUsed??{}),[spell.id]:(game.speciesUsed?.[spell.id]??0)+1};
  if(spell.concentration)next.concentration={id:spell.id,remaining:durationRounds(spell.duration),duration:spell.duration};
  return next;
}
export function durationRounds(duration) {
  const match=duration.match(/(\d+) (round|minute|hour|day)/i);
  return match ? Number(match[1])*({round:1,minute:10,hour:600,day:14400}[match[2].toLowerCase()]) : null;
}
// Only explicitly automated self-casts change defenses; DM rulings may target others.
// Mage Armor and Barkskin set a floor under the hero's AC; Shield of Faith adds 2 and Shield (until their next turn) 5.
export function spellDefense(game,baseAC,attacker={}) {
  const active=game?.concentration;
  const id=active?.automaticProtection===true && active.remaining>0?active.id:null;
  let ac=baseAC;
  if(ac!==null){
    if(game?.buffs?.['mage-armor']?.ac)ac=Math.max(ac,game.buffs['mage-armor'].ac);
    if(game?.buffs?.barkskin)ac=Math.max(ac,17);
    if(id==='shield-of-faith')ac+=2;
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
export function requestSpell(hero,game,health,maximum,request,random=Math.random,target={ac:11,saves:{Dexterity:2,Wisdom:0},distance:5}) {
  if(health?.current===0)return {error:'You cannot cast at 0 HP.'};
  const error=castError(hero,game,request);if(error)return {error};
  const spell=knownSpells(hero).find(s=>s.id===request.id),effect=automaticEffects[spell.id];
  const fighting=game.stage==='combat'||!!game.npcCombat?.active;
  // What resolves on its own: healing, protection, sensing and everyday magic, buffs on yourself anywhere; blasts,
  // curses and conditions in a fight (out of one, aimed at a person, they go to the Dungeon Master's ruling).
  const anywhere=effect&&(effect.heal||effect.temp||effect.protection||effect.detection||effect.narrated||effect.buff);
  const automatic=!request.forceDM&&effect&&(request.slot!=='ritual'||effect.detection||effect.narrated)&&(anywhere||game.stage==='combat'||(effect.rider&&!!request.npcTarget));
  if(!automatic)return {game:{...game,pendingSpell:{...request,id:spell.id}},health,waiting:true,logs:[`${spell.name}: waiting for a DM ruling. No resources spent yet.`]};
  const hp={current:health?.current??maximum,temp:health?.temp??0},logs=[];
  const replaced=concentrationReplaced(game,spell);if(replaced)logs.push(replaced);
  let next=endSpellMarks(spendSpell(hero,game,spell,request.slot),spell.concentration?spell.id:null),damage=0,enemyDisadvantage=false;
  const level=typeof request.slot==='number'?request.slot:spell.level;
  const mod=modifier(hero.scores[castingAbility(hero)]),bonus=proficiencyBonus(hero.level)+mod,dc=8+bonus;
  const roll=(count,sides)=>Array.from({length:count},()=>1+Math.floor(random()*sides));
  const sum=dice=>dice.reduce((a,b)=>a+b,0);
  const count=spell.level===0?cantripDice(hero.level):(effect.count??1)+(level-spell.level)*(effect.upcast??0);
  const key=request.npcTarget??request.aim??'foe',called=target.name?(key==='foe'?'the '+String(target.name).replace(/^the /i,''):target.name):'the target';
  // The time a ritual or a long casting takes, out of a fight.
  const elapsed=()=>{if(fighting)return;const minutes=Math.ceil((durationRounds(spell.castingTime)??0)/10)+(request.slot==='ritual'?10:0);if(minutes&&(next.map??game.map))next.map={...(next.map??game.map),minutes:((next.map??game.map).minutes??0)+minutes};};
  // A creature's saving throw against this spell (Bane takes 1d4 off it).
  const saveAgainst=(ability,advantage=false)=>{
    const dice=advantage?roll(2,20):roll(1,20),die=advantage?Math.max(...dice):dice[0],saveBonus=target.saves?.[ability]??0,shift=spellSaveShift(next,key,random);
    const total=die+saveBonus-shift.amount;
    return {die,dice,saveBonus,total,success:total>=dc,text:`${ability} save d20 ${advantage?'['+dice.join(', ')+'] (advantage)':die} + ${saveBonus}${shift.amount?' − '+shift.amount+' Bane':''} = ${total} vs DC ${dc}`};
  };
  let type=effect.type;
  if(effect.chooseType){const said=String(request.intent??'').toLowerCase();type=effect.chooseType.find(t=>new RegExp('\\b'+t.toLowerCase()+'\\b').test(said))??effect.chooseType[0];}
  if(effect.narrated&&!(effect.detection&&!game.story)){
    // Sensing and everyday magic: the casting is spent and the Dungeon Master tells what happens.
    elapsed();
    logs.push(`${spell.name}${request.slot==='ritual'?' (ritual, 10 minutes)':''}: cast${spell.concentration?', concentration up to '+spell.duration:''}. The Dungeon Master describes ${effect.narrated}.`);
  } else if(effect.detection){
    const sensed=game.stage==='inn'?'You sense magic from the keeper’s blue lantern within 30 feet.':['bridge','combat'].includes(game.stage)&&!game.dungeon?.active?'You sense the bridge lantern’s magic within 30 feet.':game.dungeon?.active&&[5,6,7].includes(game.dungeon.room)?'You sense warding magic in this chamber.':'No magical effects are currently recorded within 30 feet.';
    logs.push(`Detect Magic: ${sensed} Concentration, up to 10 minutes. Take a subsequent Magic action to inspect visible auras. Barriers can block detection.`);
    if(request.slot==='ritual'){next.map={...game.map,minutes:(game.map?.minutes??0)+10};logs.push('Ritual completed: 10 minutes elapsed; no spell slot spent.');}
  } else if(effect.protection){
    next.concentration={...next.concentration,automaticProtection:true};
    logs.push(`${spell.name} protects you: ${spell.id==='shield-of-faith'?'+2 AC':'incoming attacks have disadvantage unless the attacker has Blindsight or Truesight'}. Concentration lasts up to ${spell.duration}.`);
  } else if(effect.buff){
    const buffed=castBuff(hero,next,hp,spell,effect,{level,mod,request,random,foeType:target.type});
    if(buffed.error)return {error:buffed.error};
    next=buffed.game;logs.push(...buffed.lines);elapsed();
  } else if(effect.heal){
    const dice=subclassActive(hero,'Life Domain') && hero.level>=17?Array(count).fill(effect.die):roll(count,effect.die);
    const life=subclassActive(hero,'Life Domain')?2+level:0;
    const healed=Math.max(0,sum(dice)+mod+life);
    if(request.partyTarget){
      // Another player's hero at the shared table (partyRules.js): their own hit points; one who is down wakes.
      const id=request.partyTarget,woke=partyHeal(game,id,healed);if(!woke)return {error:'That hero is not here.'};
      next.party=woke.party;
      logs.push(`${spell.name} on ${woke.name}: [${dice.join(', ')}] + ${mod}${life?` + ${life} Disciple of Life`:''}; restored ${woke.now-woke.was} HP.${woke.was===0&&woke.now>0?' '+woke.name+' stirs and opens their eyes.':''}`);
    } else if(request.npcTarget){
      // Healing someone else: an unconscious person comes round, which counts as saving their life.
      const id=request.npcTarget,most=npcProfile(game,id).maximumHP,was=game.npcHP?.[id]??most,now=Math.min(most,was+healed);
      next.npcHP={...next.npcHP,[id]:now};
      if(was===0&&now>0&&next.npcFate?.[id]){next.npcFate={...next.npcFate};delete next.npcFate[id];if(!Object.keys(next.npcFate).length)delete next.npcFate;}
      logs.push(`${spell.name} on ${npcProfile(game,id).name}: [${dice.join(', ')}] + ${mod}${life?` + ${life} Disciple of Life`:''}; restored ${now-was} HP.${was===0&&now>0?' '+npcProfile(game,id).name+' stirs and opens their eyes.':''}`);
    } else {
      hp.current=Math.min(maximum,hp.current+healed);
      logs.push(`${spell.name}: [${dice.join(', ')}] + ${mod}${life?` + ${life} Disciple of Life`:''}; restored ${hp.current-(health?.current??maximum)} HP.`);
      // A mass healing spell reaches the rest of the party too (up to six creatures: four heroes at most).
      if(spell.id.startsWith('mass-')&&game.party?.members){
        const reached=[];
        for(const id of Object.keys(game.party.members)){if(id===game.party.lead)continue;const woke=partyHeal({...game,party:next.party??game.party},id,healed);if(woke&&woke.now>woke.was){next.party=woke.party;reached.push(`${woke.name} ${woke.now-woke.was}${woke.was===0?' (wakes)':''}`);}}
        if(reached.length)logs.push(`${spell.name} also heals ${reached.join(', ')} HP.`);
      }
    }
  } else if(effect.temp){
    const dice=roll(2,4),amount=sum(dice)+4+5*(level-1);
    if(amount>=hp.temp){hp.temp=amount;next.temporarySpell={id:spell.id,remaining:600};}
    logs.push(`False Life: [${dice.join(', ')}] + ${4+5*(level-1)} = ${amount}. Temporary HP now ${hp.temp}; amounts do not stack.`);
  } else if(effect.rider){
    // Hex and Hunter's Mark: the curse or mark settles on the creature (or person) named, and every hit with an attack
    // roll on it deals the extra damage while the spell is held. With no one named it settles on the next one you hit.
    const on=game.stage==='combat'||request.npcTarget?key:null;
    next.concentration={...next.concentration,...(on?{target:on}:{})};
    logs.push(`${spell.name}: ${on?called:'the next creature you hit'} is ${spell.id==='hex'?'cursed':'marked'}. Each of your hits with an attack roll on it deals an extra 1d${effect.rider.die} ${effect.rider.type} damage while you hold the spell (up to ${spell.duration}).`);
  } else if(effect.smite){
    // Divine Smite: right after a melee hit, radiant damage to the creature struck (more against fiends and undead).
    const hit=game.lastHit,nature=creatureNature(game,hit?.target??key),extra=nature.undead||nature.fiend?1:0,dice=roll((2+(level-1)+extra)*(hit?.critical?2:1),8);
    damage=sum(dice);
    logs.push(`Divine Smite: ${dice.length}d8 [${dice.join(', ')}] = ${damage} Radiant damage${extra?' (more against '+(nature.undead?'the undead':'a fiend')+')':''}${hit?.critical?', doubled by the critical hit':''}.`);
    delete next.lastHit;
  } else if(effect.trueStrike){
    // True Strike: one attack with the hero's own weapon, guided by their spellcasting ability; Radiant if they say so,
    // and more radiant damage from level 5.
    const options=attackOptions(hero),w=options.find(x=>!x.unarmed&&!x.ranged&&!x.blocked)??options.find(x=>!x.blocked)??options[0];
    if(!w)return {error:'True Strike needs a weapon in your hand.'};
    const struck={...w,bonus:mod,attackBonus:bonus,ability:castingAbility(hero)};
    const nearbyThreat=!game.openingAttackAvailable&&(game.castingConditions?.targetDistance??target.distance??5)<=5;
    const edge=spellEdge(next,key,!!w.ranged),rolled=rollAttack(struck,edgeMode(w.ranged&&nearbyThreat?'disadvantage':'normal',edge),random),bless=attackBoost(next,random);
    const attack={...rolled,total:rolled.total+bless.amount},hit=!attack.miss&&(attack.critical||attack.total>=target.ac),critical=attack.critical||(hit&&!w.ranged&&helpless(next,key));
    if(edge.adv.includes('Guiding Bolt'))next=spendGuidance(next,key);
    const radiant=/\bradiant\b/i.test(request.intent??''),kind=radiant?'Radiant':w.type;
    let line=`True Strike with your ${w.name}: d20 [${attack.dice.join(', ')}] (${attack.mode}) + ${mod} ${castingAbility(hero)} + ${proficiencyBonus(hero.level)} proficiency${bless.amount?' + '+bless.amount+' Bless':''} = ${attack.total} vs AC ${target.ac}. ${critical?'Critical hit':hit?'Hit':'Miss'}`;
    if(hit){
      const blow=rollDamage(struck,critical,random),extra=roll((hero.level>=17?3:hero.level>=11?2:hero.level>=5?1:0)*(critical?2:1),6);
      damage=defended(target,kind,blow.total)+defended(target,'Radiant',extra.reduce((a,b)=>a+b,0));
      line+=`; ${blow.total} ${kind} damage (${blow.dice.join(' + ')} + ${mod})${extra.length?' and '+extra.reduce((a,b)=>a+b,0)+' Radiant ('+extra.length+'d6 ['+extra.join(', ')+'])':''}.`;
      const rider=riderDamage(hero,next,key,critical,random,{weapon:true});next=rider.game;damage+=defended(target,rider.type,rider.amount);
      logs.push(line,...rider.lines);
      if(!w.ranged)next={...next,lastHit:{target:key,...(critical?{critical:true}:{})}};
    } else logs.push(line+'.');
  } else if(effect.missile){const die=roll(1,4)[0];damage=(2+level)*(die+1);logs.push(`Magic Missile: ${2+level} darts × (${die}+1) = ${damage} Force damage.`);}
  else if(effect.inflict){
    // A spell that lays a condition on a creature (it saves to shake it off): kept in game.marks for the fight.
    const how=effect.inflict,nature=creatureNature(game,key);
    if(how.humanoid&&!nature.humanoid)logs.push(`${spell.name}: ${called} is not a humanoid, so the spell has no hold on it.`);
    else {
      const save=saveAgainst(how.save,!!how.fightAdvantage);
      logs.push(`${spell.name}: ${called} makes a ${save.text}: ${save.success?'success. It shakes off the spell.':'failure. '+conditionText(how.cond,called,spell)}`);
      if(!save.success){
        const cond=spell.id==='command'&&/\bgrovel/i.test(request.intent??'')?'groveling':how.cond;
        next=withSpellMark(next,key,{id:spell.id,cond,by:heroIdOf(next),dc,save:how.repeatWith??how.save,...(how.turns?{rounds:how.turns}:spell.concentration?{}:{rounds:durationRounds(spell.duration)?Math.min(100,durationRounds(spell.duration)):10})});
        if(cond==='laughing')next=withMark(next,key,{prone:true});
      }
    }
  } else if(effect.save){
    const save=saveAgainst(effect.save),success=save.success;
    const potent=subclassActive(hero,'Evoker') && spell.level===0;
    const part=(t)=>{const dice=roll(count,effect.die),rolled=sum(dice),dealt=success?(effect.half||potent?Math.floor(rolled/2):0):rolled;return {dice,rolled,dealt:defended(target,t,dealt),before:dealt,type:t};};
    const parts=[part(type),...(effect.also?[part(effect.also)]:[])];
    damage=parts.reduce((n,p)=>n+p.dealt,0);
    logs.push(`${spell.name}: ${save.text}: ${success?'success':'failure'}; ${parts.map(p=>p.before+' '+p.type).join(' and ')} damage. Damage ${parts.map(p=>count+'d'+effect.die+' ['+p.dice.join(', ')+'] = '+p.rolled).join('; ')}${success?(effect.half||potent?'; halved on save.':'; negated on save.'):'.'}`);
    for(const p of parts)if(p.dealt!==p.before)logs.push(`After the target's ${p.type} defenses: ${p.dealt} damage applied (${p.before} before defenses).`);
    enemyDisadvantage=!!effect.weaken && !success;
  } else if(effect.attack){
    const beams=effect.beams?cantripDice(hero.level):effect.rays?effect.rays+level-spell.level:1;
    for(let i=0;i<beams;i++){
      // During the opening strike the foe has not closed the gap yet, so a ranged spell carries no close-range penalty.
      const nearbyThreat=!game.openingAttackAvailable && (game.castingConditions?.targetDistance??target.distance??5)<=5 && target.canSeeAttacker!==false && !target.incapacitated;
      const edge=spellEdge(next,key,effect.attack==='ranged');
      const base=effect.attack==='ranged' && nearbyThreat?'disadvantage':'normal';
      // A Wand of the War Mage adds to spell attack rolls (lootRules.js).
      const war=hero.equipment?.magic?.spellAttack??0,rolled=rollAttack({attackBonus:bonus+war},edgeMode(base,edge),random),bless=attackBoost(next,random);
      const attack={...rolled,total:rolled.total+bless.amount};
      const hit=!attack.miss && (attack.critical || attack.total>=target.ac);
      const critical=attack.critical||(hit&&effect.attack==='melee'&&helpless(next,key));
      if(edge.adv.includes('Guiding Bolt'))next=spendGuidance(next,key);
      const diceCount=(effect.beams?1:count)*(critical?2:1);
      let damageDice=hit?roll(diceCount,effect.die):[];
      if(hit&&effect.explode){let extra=0;for(let j=0;j<damageDice.length&&extra<Math.max(1,mod);j++)if(damageDice[j]===effect.die){damageDice.push(roll(1,effect.die)[0]);extra++;}}
      let part=sum(damageDice)+(hit&&effect.addMod?mod:0),note='';
      if(!hit && subclassActive(hero,'Evoker')){damageDice=roll(effect.beams?1:count,effect.die);part=Math.floor(sum(damageDice)/2);note='; halved by Potent Cantrip';}
      else if(!hit && effect.missHalf){damageDice=roll(count,effect.die);part=Math.floor(sum(damageDice)/2);note='; half on a miss';}
      const before=part;part=defended(target,type,part);
      logs.push(`${spell.name}${beams>1?` beam ${i+1}`:''}: d20 [${attack.dice.join(', ')}] (${attack.mode}${[...edge.adv,...edge.dis].length?', '+[...edge.adv,...edge.dis].join(', '):''}) + ${mod} ${castingAbility(hero)} + ${proficiencyBonus(hero.level)} proficiency${war?` + ${war} magic`:''}${bless.amount?' + '+bless.amount+' Bless':''} = ${attack.total} vs AC ${target.ac}. ${critical?'Critical hit':hit?'Hit':'Miss'}; ${before} ${type} damage${damageDice.length?' ('+damageDice.length+'d'+effect.die+' ['+damageDice.join(', ')+']'+(effect.addMod&&hit?' + '+mod:'')+note+')':''}.`);
      if(part!==before)logs.push(`After the target's ${type} defenses: ${part} damage applied (${before} before defenses).`);
      if(hit){
        const rider=riderDamage(hero,next,key,critical,random);next=rider.game;part+=defended(target,rider.type,rider.amount);logs.push(...rider.lines);
      }
      damage+=part;
      if(hit && effect.drain && part>0){const back=Math.floor(part/2),was=hp.current;hp.current=Math.min(maximum,hp.current+back);logs.push(`You draw back ${hp.current-was} HP.`);}
      if(hit && effect.condition){
        if(effect.condition==='Next attack has advantage')next=withSpellMark(next,key,{id:spell.id,cond:'guided',by:heroIdOf(next),dc,save:'Wisdom',rounds:1});
        else if(effect.condition==='Poisoned')next=withSpellMark(next,key,{id:spell.id,cond:'poisoned',by:heroIdOf(next),dc,save:'Constitution',rounds:1});
        else next.enemyEffects={...next.enemyEffects,[effect.condition]:spell.id==='chill-touch'?2:1};
        logs.push(effect.condition+'.');
      }
    }
    if(effect.then){
      // Ice Knife: hit or miss, the shard bursts.
      const t=effect.then,save=saveAgainst(t.save),dice=roll((t.count??1)+(level-spell.level)*(t.upcast??0),t.die),rolled=sum(dice),dealt=save.success?0:defended(target,t.type,rolled);
      damage+=dealt;logs.push(`The shard bursts: ${save.text}: ${save.success?'success; no':'failure; '+dealt} ${t.type} damage${save.success?'':` (${dice.length}d${t.die} [${dice.join(', ')}])`}.`);
    }
  }
  if(damage>0&&!effect.inflict){
    const broke=spellCondsOf(next,key).filter(c=>breakable.includes(c));
    if(broke.length){next=breakOnDamage(next,key);logs.push(brokenLine(called.charAt(0).toUpperCase()+called.slice(1),broke));}
  }
  return {game:next,health:hp,logs,damage,bonus:spell.castingTime==='Bonus Action'&&!effect.asAction,reaction:spell.castingTime==='Reaction',enemyDisadvantage};
}
// A target's resistance, immunity or vulnerability to a damage type.
function defended(target,type,amount){
  if(!type||!amount)return amount;
  if(target.immunities?.includes(type))return 0;
  let n=amount;if(target.resistances?.includes(type))n=Math.floor(n/2);if(target.vulnerabilities?.includes(type))n*=2;
  return n;
}
export function resolveSpellRuling(hero,game,health,maximum,ruling,random=Math.random) {
  if(health?.current===0)return {error:'You cannot cast at 0 HP.'};
  const request=game.pendingSpell?{...game.pendingSpell}:null;if(!request)return {error:'No spell is awaiting a ruling.'};
  // Older saves predate explicit NPC target IDs; recover only unambiguous local targets.
  if(!request.npcTarget && game.stage==='inn'){
    const target=(request.intent??'').match(/\b(?:on|at)\s+(?:the\s+)?(bartender|innkeeper|keeper|mara|traveler)[.!]?$/i)?.[1]?.toLowerCase();
    if(target)request.npcTarget=['mara','traveler'].includes(target)?'mara':'keeper';
  }
  const clean={...game};delete clean.pendingSpell;
  const error=castError(hero,clean,request);if(error)return {error};
  if(typeof ruling?.note!=='string' || ruling.note.trim().length<3 || ruling.note.length>500)return {error:'Record the DM’s ruling (3–500 characters).'};
  if(ruling.selfDamage!==undefined && (!Number.isInteger(ruling.selfDamage) || ruling.selfDamage<0 || ruling.selfDamage>9999))return {error:'Damage to you must be a whole number from 0 to 9,999.'};
  for(const key of ['damage','healing','temporaryHP'])if(!Number.isInteger(ruling[key]) || ruling[key]<0 || ruling[key]>9999)return {error:'Use whole-number effects from 0 to 9,999.'};
  if(game.stage!=='combat' && !request.npcTarget && ruling.damage>0)return {error:'Enemy damage can only be applied in combat.'};
  const spell=knownSpells(hero).find(s=>s.id===request.id),calculatedLogs=[],effect=automaticEffects[spell.id];
  const replaced=concentrationReplaced(clean,spell);if(replaced)calculatedLogs.push(replaced);
  // A spell the game can work out against a person (damage, a condition) is rolled here, against their own defences.
  let marks=null;
  if(request.npcTarget&&effect&&(effect.attack||effect.save||effect.missile||effect.inflict||effect.trueStrike)){
    const defenses=personDefenses(clean,request.npcTarget),{name,save}=defenses;
    // A reaction (Hellish Rebuke) the Dungeon Master allowed answers this person.
    const reacting=spell.castingTime==='Reaction'?{hurtBy:request.npcTarget}:{};
    const calculated=requestSpell(hero,{...clean,stage:'combat',...reacting},health,maximum,{...request,forceDM:false,...(spell.castingTime==='Reaction'?{reaction:true}:{})},random,defenses);
    if(calculated.error)return calculated;
    ruling={...ruling,damage:calculated.damage};calculatedLogs.push(`${name}: AC ${defenses.ac}, saving throws ${save>=0?'+':''}${save}.`,...calculated.logs.filter(l=>l!==replaced));
    if(effect.inflict)marks=calculated.game.marks;
  }
  // A Dungeon Master's damage is held to what the spell can deal.
  const most=spellDamageMax(hero,spell,request.slot);
  if(ruling.damage>most){calculatedLogs.push(`Damage limited to what ${spell.name} can deal: ${most}.`);ruling={...ruling,damage:most};}
  let next=endSpellMarks(spendSpell(hero,clean,spell,request.slot),spell.concentration?spell.id:null);
  if(marks!==null){if(marks)next.marks=marks;else delete next.marks;}
  if(game.stage!=='combat'&&!game.npcCombat?.active){
    const minutes=Math.ceil((durationRounds(spell.castingTime)??0)/10)+(request.slot==='ritual'?10:0);
    if(minutes&&game.map)next.map={...game.map,minutes:(game.map.minutes??0)+minutes};
  }
  // A named person's damage and healing apply to them, never to the caster.
  if(request.npcTarget){const id=request.npcTarget;if(!npcIdsOf(game).includes(id)||!npcScene(game).some(n=>n.id===id&&n.present)||game.npcFate?.[id]==='dead')return {error:'That person is not here.'};const most=npcProfile(game,id).maximumHP,was=game.npcHP?.[id]??most,now=Math.min(most,Math.max(0,was-ruling.damage)+ruling.healing);next.npcHP={...game.npcHP,[id]:now};if(was===0&&now>0&&next.npcFate?.[id]){next.npcFate={...next.npcFate};delete next.npcFate[id];if(!Object.keys(next.npcFate).length)delete next.npcFate;}}
  // Another player's hero: the ruling's healing is theirs (one who is down wakes), and nothing here harms them.
  if(request.partyTarget){const woke=partyHeal(game,request.partyTarget,ruling.healing);if(!woke)return {error:'That hero is not here.'};next.party=woke.party;}
  const other=!!(request.npcTarget||request.partyTarget);
  if(!spell.concentration && next.concentration?.id===spell.id)delete next.concentration;
  const absorbed=Math.min(health?.temp??0,ruling.selfDamage??0);
  const hp={current:Math.min(maximum,Math.max(0,(health?.current??maximum)-((ruling.selfDamage??0)-absorbed))+(other?0:ruling.healing)),temp:Math.max((health?.temp??0)-absorbed,other?(health?.temp??0)-absorbed:ruling.temporaryHP)};
  const knockedOut=(health?.current??maximum)-((ruling.selfDamage??0)-absorbed)<=0;
  if(knockedOut||hp.current===0)delete next.concentration;
  else {
    const concentration=concentrationAfterDamage(hero,next,ruling.selfDamage??0,random);
    next=concentration.game;calculatedLogs.push(...concentration.logs);
  }
  if(ruling.temporaryHP>=(health?.temp??0) && ruling.temporaryHP>0)delete next.temporarySpell;
  return {game:next,health:hp,damage:other?0:ruling.damage,bonus:spell.castingTime==='Bonus Action',reaction:spell.castingTime==='Reaction',logs:[`${spell.name} — DM ruling: ${ruling.note.trim()}`,`Target / intent: ${request.intent}`,...calculatedLogs,`Applied: ${ruling.damage} ${request.npcTarget??'enemy'} damage, ${ruling.selfDamage??0} damage to you, ${hp.current-(health?.current??maximum)} healing, temporary HP ${hp.temp}. Casting cost: ${request.slot===0?'cantrip':request.slot==='ritual'?'ritual':request.slot==='arcanum'?'Mystic Arcanum':`level ${request.slot} slot`}. Other effects follow the recorded ruling.`]};
}
export function concentrationAfterDamage(hero,game,damage,random=Math.random) {
  if(game.concentration&&game.castingConditions?.incapacitated){const next={...game};delete next.concentration;return {game:next,logs:['Concentration ended: incapacitated.']};}
  if(!game.concentration || damage<=0)return {game,logs:[]};
  const die=1+Math.floor(random()*20),trained=['Artificer','Barbarian','Fighter','Sorcerer'].includes(hero.class);
  const bonus=modifier(hero.scores.Constitution)+(trained?proficiencyBonus(hero.level):0)+(hero.equipment?.magic?.saves??0),dc=Math.min(30,Math.max(10,Math.floor(damage/2)));
  // Bless adds 1d4 to the save; a Cloak or Ring of Protection or a Stone of Good Luck adds to every saving throw (a geared hero's magic).
  const blessed=attackBoost(game,random).amount;
  const success=die+bonus+blessed>=dc,next={...game};if(!success)delete next.concentration;
  return {game:next,logs:[`Concentration: Constitution save ${die} + ${bonus}${blessed?' + '+blessed+' Bless':''} vs DC ${dc}. ${success?'Maintained.':'Spell ended.'}`]};
}

// ---------- Spells that last in a fight: conditions, curses, blessings ----------
// Conditions a spell lays on a creature in a fight (it saves against the caster's DC). They are kept in game.marks under
// the creature's key ('foe', 'ally:0', a person's id) as `spells` entries {id, cond, by: the caster's hero id, dc,
// save, rounds?}; one held by concentration ends when the caster's concentration does (endSpellMarks).
export const spellConditions={
  sleep:{save:'Wisdom',cond:'asleep'},
  'hypnotic-pattern':{save:'Wisdom',cond:'entranced'},
  'hold-person':{save:'Wisdom',cond:'paralyzed',humanoid:true},
  'hold-monster':{save:'Wisdom',cond:'paralyzed'},
  'hideous-laughter':{save:'Wisdom',cond:'laughing'},
  command:{save:'Wisdom',cond:'commanded',turns:1},
  entangle:{save:'Strength',cond:'restrained'},
  web:{save:'Dexterity',cond:'restrained',repeatWith:'Strength'},
  'faerie-fire':{save:'Dexterity',cond:'outlined'},
  blindnessdeafness:{save:'Constitution',cond:'blinded'},
  'color-spray':{save:'Constitution',cond:'blinded',turns:1},
  'charm-person':{save:'Wisdom',cond:'charmed',humanoid:true,fightAdvantage:true},
  'charm-monster':{save:'Wisdom',cond:'charmed',fightAdvantage:true},
  fear:{save:'Wisdom',cond:'frightened'},
  bane:{save:'Charisma',cond:'baned'},
};
for(const [id,inflict] of Object.entries(spellConditions))automaticEffects[id]={...(automaticEffects[id]??{}),inflict};
// Curses and marks that add damage to the caster's hits, buffs on the caster, and Divine Smite after a hit.
Object.assign(automaticEffects,{
  hex:{rider:{die:6,type:'Necrotic'}},'hunters-mark':{rider:{die:6,type:'Force'}},
  bless:{buff:'bless'},heroism:{buff:'heroism'},guidance:{buff:'guidance'},resistance:{buff:'resistance'},
  'mage-armor':{buff:'mage-armor'},barkskin:{buff:'barkskin'},'divine-favor':{buff:'divine-favor'},shillelagh:{buff:'shillelagh'},
  'divine-smite':{smite:true,type:'Radiant'},'true-strike':{trueStrike:true,type:'Radiant'},
  shield:{shield:true},
});
const conditionLines={
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
function conditionText(cond,called,spell){return (called.charAt(0).toUpperCase()+called.slice(1))+' '+(conditionLines[cond]??'is affected by '+spell.name+'.');}
// What a creature is, as far as spells care: a humanoid (Hold Person, Charm Person), undead or a fiend (Divine Smite).
const humanoidWords=/\b(human|humans|elf|elves|elven|dwarf|dwarves|halfling|gnome|orc|orcs|goblin|goblins|hobgoblin|bugbear|kobold|tiefling|dragonborn|goliath|bandit|bandits|cultist|cultists|knight|guard|soldier|thief|mage|priest|priestess|witch|wizard|sorcerer|sorceress|warlock|captain|brigand|pirate|raider|assassin|noble|merchant|lord|lady|queen|king|woman|man)\b/i;
export function creatureNature(game,key){
  if(key&&key!=='foe'&&!String(key).startsWith('ally:'))return {humanoid:true,undead:false,fiend:false};
  const kind=(key==='foe'?(game.wildFight?[game.wildFight.template,game.wildFight.name].join(' '):game.dungeon?.active?'warden construct':game.story?[game.story.foeSpecies,game.story.foe].join(' '):'lantern wisp'):String(game.foeAllies?.[Number(String(key).slice(5))]?.template??'')).toLowerCase();
  return {humanoid:humanoidWords.test(kind),undead:/\b(undead|skeleton|skeletons|zombie|zombies|ghoul|ghast|wight|wraith|specter|spectre|ghost|vampire|lich|mummy|revenant|banshee)\b/.test(kind),fiend:/\b(fiend|demon|devil|imp|quasit|hellhound|fiendish)\b/.test(kind)};
}
const spellMarksOf=(game,key)=>markOf(game,key).spells??[];
export function withSpellMark(game,key,entry){
  const kept=spellMarksOf(game,key).filter(m=>!(m.id===entry.id&&m.by===entry.by));
  return withMark(game,key,{spells:[...kept,entry].slice(-4)});
}
function setSpellMarks(game,key,list){return withMark(game,key,{spells:list.length?list:undefined});}
export const spellCondsOf=(game,key)=>spellMarksOf(game,key).map(m=>m.cond);
// Whether a creature is helpless (a melee hit on it from beside it is a critical hit).
export const helpless=(game,key)=>spellCondsOf(game,key).some(c=>['paralyzed','asleep'].includes(c));
// Whether a creature does nothing on its turn.
export const spellIncapacitated=(game,key)=>spellCondsOf(game,key).some(c=>['paralyzed','asleep','entranced','laughing','commanded','groveling'].includes(c));
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
// Disadvantage on a creature's own attacks from what spells left on it.
export const spellFoeEdge=(game,key)=>spellCondsOf(game,key).filter(c=>['restrained','blinded','frightened','poisoned'].includes(c));
// Guiding Bolt's glow is spent on the first attack made at the creature.
export function spendGuidance(game,key){const list=spellMarksOf(game,key);return list.some(m=>m.cond==='guided')?setSpellMarks(game,key,list.filter(m=>m.cond!=='guided')):game;}
// Bane on a creature: 1d4 off its attack roll or saving throw.
export function spellSaveShift(game,key,random=Math.random){return spellCondsOf(game,key).includes('baned')?{amount:1+Math.floor(random()*4)}:{amount:0};}
export function banedAttack(game,key,attack,random=Math.random){
  if(!spellCondsOf(game,key).includes('baned')||attack.critical||attack.miss)return {attack,note:''};
  const d=1+Math.floor(random()*4);return {attack:{...attack,total:attack.total-d},note:' − '+d+' Bane'};
}
// Bless on this hero: 1d4 on an attack roll or a saving throw.
export function attackBoost(game,random=Math.random){return game.concentration?.id==='bless'?{amount:1+Math.floor(random()*4)}:{amount:0};}
// Harm breaks a magical sleep, a trance and a charm.
const breakable=['asleep','entranced','charmed'];
const brokenLine=(name,conds)=>`${name} is hurt, and ${conds.map(c=>c==='charmed'?'the charm breaks':c==='asleep'?'wakes':'snaps out of the trance').join(' and ')}.`;
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
export function endSpellMarks(game,recast=null){
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
  const still=conds.find(c=>['paralyzed','asleep','entranced','laughing','commanded','groveling'].includes(c));
  if(still)lines.push(`${name} ${({paralyzed:'is paralyzed and cannot act.',asleep:'sleeps on.',entranced:'stands entranced.',laughing:'is helpless with laughter.',commanded:'obeys your command and loses its turn.',groveling:'grovels and loses its turn.'})[still]}`);
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
// Hex or Hunter's Mark on the creature struck, and Divine Favor on a weapon hit: the extra damage of one hit.
export function riderDamage(hero,game,key,critical,random=Math.random,{weapon=false}={}){
  let next=game;const lines=[];let amount=0,type=null;
  const held=game.concentration,effect=held?automaticEffects[held.id]:null;
  if(effect?.rider){
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
const armourWorn=hero=>(hero.equipment?.items??[]).some(i=>i.quantity>0&&/(Armor|Mail|Chain Shirt|Breastplate|Plate)\b/.test(i.name)&&!/^Shield$/.test(i.name));
// A buff the hero casts on themselves.
function castBuff(hero,game,hp,spell,effect,{mod,request,foeType}){
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
// Shield, cast for the hero as a reaction when a blow would otherwise land: +5 AC until the start of their next turn.
// Returns null when it cannot or would not help (a critical hit, a blow that hits anyway, no reaction or slot left).
export function shieldReaction(hero,game,attackTotal,ac,critical){
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
  if(next.concentration?.id==='heroism'&&(hp?.current??0)>0){
    const gain=Math.max(1,modifier(hero.scores?.[castingAbility(hero)]??10));
    if(gain>(hp.temp??0)){hp={...hp,temp:gain};lines.push(`Heroism: ${gain} temporary HP.`);}
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
  if(game?.concentration?.id!=='guidance')return null;
  const die=1+Math.floor(random()*4),next={...game};delete next.concentration;return {die,game:next};
}
// Resistance: 1d4 off damage of the chosen type, once a turn.
export function resistedDamage(game,type,amount,random=Math.random){
  const c=game.concentration;if(c?.id!=='resistance'||c.damageType!==type||c.used||amount<=0)return {game,amount,line:null};
  const d=1+Math.floor(random()*4),now=Math.max(0,amount-d);
  return {game:{...game,concentration:{...c,used:true}},amount:now,line:`Resistance takes ${amount-now} off the ${type.toLowerCase()} damage.`};
}

// Shared preflight for conversational casting. Unknown world facts never become fabricated effects.
// In a story fight the creature can be named loosely: "the bandit", "the goblins", "the beast", "him", "it".
function storyFoeNamed(game,target){
  if(!game.story?.foe||game.stage!=='combat'||game.dungeon?.active||typeof target!=='string')return false;
  const t=target.toLowerCase().replace(/^(?:the|that|this)\s+/,'').trim();
  if(['it','him','her','them','foe','beast','monster','enemy','creature'].includes(t))return true;
  const words=(game.wildFight?[game.wildFight.name,game.wildFight.template,game.wildFight.stats?.group?.plural]:[game.story.foe,game.story.foeSpecies,game.story.foeStats?.group?.plural]).filter(Boolean).join(' ').toLowerCase().split(/[^a-z]+/).filter(w=>w.length>=4);
  return t.split(/[^a-z]+/).some(w=>w.length>=4&&words.some(f=>f.startsWith(w.replace(/s$/,''))||w.startsWith(f)));
}
export function inspectSpellCast(hero,game,health,spell,request,target){
  const error=castError(hero,game,request);if(error)return {error};
  if(health?.current===0)return {error:'You are at 0 HP and cannot begin casting. Recover first.'};
  const flags=game.castingConditions??{},components=spell.components??'',items=hero.equipment?.items??[];
  if(flags.incapacitated)return {error:'You cannot cast while incapacitated.'};
  if(components.includes('V')&&flags.silenced)return {error:'This spell needs spoken words, but you are silenced.'};
  if((components.includes('S')||components.includes('M'))&&flags.handsBound)return {error:'This spell needs an available hand, but your hands are bound.'};
  const effect=automaticEffects[spell.id],self=!!effect&&(effect.heal||effect.temp||effect.protection||effect.detection||effect.buff),onSelf=/^(?:me|myself|self)\b/.test(target??''),onWisp=(game.dungeon?.active?['enemy','the enemy',...(game.dungeon.room===6?['lantern warden','the lantern warden']:['stone sentinel','the stone sentinel'])]:game.story?.foe?[game.story.foe.toLowerCase(),'the '+game.story.foe.toLowerCase(),'enemy','the enemy','creature','the creature']:['wisp','the wisp','lantern wisp','the lantern wisp','enemy','the enemy']).includes(target)&&game.stage==='combat'||storyFoeNamed(game,target)||(!!request.aim&&game.stage==='combat');
  if(onWisp&&flags.clearPath===false)return {error:'The target is behind an obstruction. Get a clear path before casting.'};
  const distance=onSelf?0:onWisp?(flags.targetDistance??5):null;
  const range=spell.id==='burning-hands'?15:spell.range==='Touch'?5:spell.range.match(/^(\d+) feet$/)?.[1];
  if(distance!==null&&range!==undefined&&distance>Number(range))return {error:`The target is ${distance} feet away; ${spell.name} reaches ${range} feet.`};
  const reasons=[];
  if(!effect)reasons.push('This spell’s effects need a DM ruling.');
  // Healing a person who is here resolves on its own, like healing yourself.
  const healPerson=!!effect?.heal&&(!!request.npcTarget||!!request.partyTarget);
  // Sensing and everyday magic, Divine Smite after a hit and a curse on a person need no ruling about their target.
  const settled=!!effect?.narrated||(!!effect?.smite&&!!game.lastHit)||(!!effect?.rider&&!!request.npcTarget);
  if(!settled&&!(self?(onSelf||healPerson):onWisp))reasons.push('This target or area needs a DM ruling.');
  if(!effect?.narrated&&!(spell.castingTime==='Reaction'&&request.reaction)&&(!['Action','Bonus Action'].includes(spell.castingTime)||(request.slot==='ritual'&&!effect?.detection)))reasons.push('Casting time, reaction trigger, or ritual completion needs a DM ruling.');
  // A priced component the hero plainly carries needs no check: Bless's holy symbol (a Cleric's or Paladin's kit), or
  // the weapon True Strike is cast through.
  const material=spell.material??'',carried=(/^a Holy Symbol worth \d+\+ GP$/i.test(material)&&items.some(i=>i.quantity>0&&/Holy Symbol/i.test(i.name)))||(/^a weapon with which you have proficiency/i.test(material)&&attackOptions(hero).some(w=>!w.unarmed&&w.proficient&&!w.blocked));
  const special=!carried&&/\b(?:gp|sp|cp|pp|worth|consum\w*)\b/i.test(material+' '+spell.description);
  if(components.includes('M')){
    const focusByClass={Wizard:/Arcane Focus/i,Sorcerer:/Arcane Focus/i,Warlock:/Arcane Focus/i,Cleric:/Holy Symbol/i,Paladin:/Holy Symbol/i,Druid:/Druidic Focus/i,Ranger:/Druidic Focus/i,Bard:/Lute|Flute|Drum/i,Artificer:/Tools/i};
    const focus=items.some(i=>i.quantity>0&&(/Component Pouch/i.test(i.name)||focusByClass[hero.class]?.test(i.name)));
    if(special)reasons.push('Costly or consumed materials must be verified and accounted for by a DM.');
    else if(!focus)reasons.push('No suitable focus or component pouch is recorded; material availability needs a DM ruling.');
  }
  return {manual:reasons.length>0,reasons,summary:`${spell.name}: ${spell.castingTime}; range ${spell.range}; components ${components}; duration ${spell.duration}. ${request.slot===0?'Cantrip: no slot.':request.slot==='ritual'?'Ritual: no slot, 10 extra minutes.':request.slot==='arcanum'?'Uses Mystic Arcanum.':`Uses a level ${request.slot} slot.`} ${spell.concentration?'Requires concentration. ':''}${reasons.length?reasons.join(' '):'Prepared spell, resources, target and implemented effect checked.'} The scene assumes normal speech and a free casting hand unless a restriction is recorded.`};
}
