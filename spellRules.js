import {spellLibrary,automaticSpells,slotChoices,slotUsed} from './spellOptions';
import {modifier,proficiencyBonus,subclassActive} from './characterRules';
import {rollAttack} from './weaponRules';
import {npcProfiles,npcScene} from './npcRules';

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
};
export const cantripDice = level => level>=17?4:level>=11?3:level>=5?2:1;
export function knownSpells(hero) {
  const ids=new Set([...(hero.spells??[]),...automaticSpells(hero),...Object.values(hero.arcanum??{}),...(hero.class==='Wizard'?(hero.spellbook??[]).filter(id=>spellLibrary.some(s=>s.id===id && s.ritual)):[])]);
  return spellLibrary.filter(s=>ids.has(s.id));
}
export function spellMode(id) {return automaticEffects[id]?'automatic':'dm';}
export function spellCostOptions(hero,game,spell) {
  const unpreparedRitual=hero.class==='Wizard' && !hero.spells?.includes(spell.id) && !automaticSpells(hero).includes(spell.id);
  const choices=unpreparedRitual?[]:slotChoices(hero,game,spell);
  if(hero.class==='Warlock' && hero.arcanum?.[spell.level]===spell.id && !game.arcanumUsed?.includes(spell.level))choices.push('arcanum');
  if(spell.ritual)choices.push('ritual');
  return choices;
}
export function castError(hero,game,request) {
  const spell=knownSpells(hero).find(s=>s.id===request?.id);
  if(!spell)return 'That spell is not prepared or granted to this character.';
  if(!['inn','bridge','tower','dungeon','combat'].includes(game.stage))return 'Begin another adventure before casting.';
  if(game.pendingSpell)return 'Resolve or cancel the pending spell first.';
  const flags=game.castingConditions??{},components=spell.components??'';
  if(flags.incapacitated)return 'You cannot cast while incapacitated.';
  if(components.includes('V')&&flags.silenced)return 'This spell needs spoken words, but you are silenced.';
  if((components.includes('S')||components.includes('M'))&&flags.handsBound)return 'This spell needs an available hand, but your hands are bound.';
  if(!spellCostOptions(hero,game,spell).includes(request.slot))return 'No eligible spell slot or free casting remains.';
  if(game.stage==='combat' && request.slot==='ritual')return 'Ritual casting requires time outside this encounter.';
  const bonus=spell.castingTime==='Bonus Action';
  if(game.stage==='combat' && spell.castingTime==='Reaction' && game.reactionUsed)return 'Your reaction is already used.';
  if((game.stage==='combat'||game.npcCombat?.active) && bonus && game.bonusUsed)return 'Your bonus action is already used.';
  if((game.stage==='combat'||game.npcCombat?.active) && typeof request.slot==='number' && request.slot>0 && game.slotSpentThisTurn)return 'You already spent a spell slot this turn.';
  if(typeof request.intent!=='string' || request.intent.trim().length<3 || request.intent.length>500)return 'Describe your target and intended effect.';
  if(request.componentsConfirmed!==true)return 'Confirm that the spell components and casting requirements are available.';
  return '';
}
function spendSpell(hero,game,spell,slot) {
  const next={...game};
  if(typeof slot==='number' && slot>0){next.spellSlotsUsed=Array.from({length:9},(_,i)=>slotUsed(game,i+1)+(i+1===slot?1:0));next.resources={...game.resources,slots:next.spellSlotsUsed[0]};next.slotSpentThisTurn=game.stage==='combat'||!!game.npcCombat?.active;}
  if(slot==='arcanum')next.arcanumUsed=[...(game.arcanumUsed??[]),spell.level];
  if(spell.concentration)next.concentration={id:spell.id,remaining:durationRounds(spell.duration),duration:spell.duration};
  return next;
}
export function durationRounds(duration) {
  const match=duration.match(/(\d+) (round|minute|hour|day)/i);
  return match ? Number(match[1])*({round:1,minute:10,hour:600,day:14400}[match[2].toLowerCase()]) : null;
}
// Only explicitly automated self-casts change defenses; DM rulings may target others.
export function spellDefense(game,baseAC,attacker={}) {
  const active=game?.concentration;
  const id=active?.automaticProtection===true && active.remaining>0?active.id:null;
  return {ac:baseAC===null?null:baseAC+(id==='shield-of-faith'?2:0),disadvantage:id==='blur' && !attacker.blindsight && !attacker.truesight};
}
export function requestSpell(hero,game,health,maximum,request,random=Math.random,target={ac:11,saves:{Dexterity:2,Wisdom:0},distance:5}) {
  if(health?.current===0)return {error:'You cannot cast at 0 HP.'};
  const error=castError(hero,game,request);if(error)return {error};
  const spell=knownSpells(hero).find(s=>s.id===request.id),effect=automaticEffects[spell.id];
  const automatic=!request.forceDM && effect && (request.slot!=='ritual'||effect.detection) && (effect.heal || effect.temp || effect.protection || effect.detection || game.stage==='combat');
  if(!automatic)return {game:{...game,pendingSpell:{...request,id:spell.id}},health,waiting:true,logs:[`${spell.name}: waiting for a DM ruling. No resources spent yet.`]};
  const hp={current:health?.current??maximum,temp:health?.temp??0},logs=[];
  let next=spendSpell(hero,game,spell,request.slot),damage=0,enemyDisadvantage=false;
  const level=typeof request.slot==='number'?request.slot:spell.level;
  const mod=modifier(hero.scores[spellAbility[hero.class]]),bonus=proficiencyBonus(hero.level)+mod,dc=8+bonus;
  const roll=(count,sides)=>Array.from({length:count},()=>1+Math.floor(random()*sides));
  const sum=dice=>dice.reduce((a,b)=>a+b,0);
  const count=spell.level===0?cantripDice(hero.level):(effect.count??1)+(level-spell.level)*(effect.upcast??0);
  if(effect.detection){
    const sensed=game.stage==='inn'?'You sense magic from the keeper’s blue lantern within 30 feet.':['bridge','combat'].includes(game.stage)&&!game.dungeon?.active?'You sense the bridge lantern’s magic within 30 feet.':game.dungeon?.active&&[5,6,7].includes(game.dungeon.room)?'You sense warding magic in this chamber.':'No magical effects are currently recorded within 30 feet.';
    logs.push(`Detect Magic: ${sensed} Concentration, up to 10 minutes. Take a subsequent Magic action to inspect visible auras. Barriers can block detection.`);
    if(request.slot==='ritual'){next.map={...game.map,minutes:(game.map?.minutes??0)+10};logs.push('Ritual completed: 10 minutes elapsed; no spell slot spent.');}
  } else if(effect.protection){
    next.concentration={...next.concentration,automaticProtection:true};
    logs.push(`${spell.name} protects you: ${spell.id==='shield-of-faith'?'+2 AC':'incoming attacks have disadvantage unless the attacker has Blindsight or Truesight'}. Concentration lasts up to ${spell.duration}.`);
  } else if(effect.heal){
    const dice=subclassActive(hero,'Life Domain') && hero.level>=17?Array(count).fill(effect.die):roll(count,effect.die);
    const life=subclassActive(hero,'Life Domain')?2+level:0;
    const healed=Math.max(0,sum(dice)+mod+life);
    if(request.npcTarget){
      // Healing someone else: an unconscious person comes round, which counts as saving their life.
      const id=request.npcTarget,most=npcProfiles[id].maximumHP,was=game.npcHP?.[id]??most,now=Math.min(most,was+healed);
      next.npcHP={...next.npcHP,[id]:now};
      if(was===0&&now>0&&next.npcFate?.[id]){next.npcFate={...next.npcFate};delete next.npcFate[id];if(!Object.keys(next.npcFate).length)delete next.npcFate;}
      logs.push(`${spell.name} on ${npcProfiles[id].name}: [${dice.join(', ')}] + ${mod}${life?` + ${life} Disciple of Life`:''}; restored ${now-was} HP.${was===0&&now>0?' '+npcProfiles[id].name+' stirs and opens their eyes.':''}`);
    } else {
      hp.current=Math.min(maximum,hp.current+healed);
      logs.push(`${spell.name}: [${dice.join(', ')}] + ${mod}${life?` + ${life} Disciple of Life`:''}; restored ${hp.current-(health?.current??maximum)} HP.`);
    }
  } else if(effect.temp){
    const dice=roll(2,4),amount=sum(dice)+4+5*(level-1);
    if(amount>=hp.temp){hp.temp=amount;next.temporarySpell={id:spell.id,remaining:600};}
    logs.push(`False Life: [${dice.join(', ')}] + ${4+5*(level-1)} = ${amount}. Temporary HP now ${hp.temp}; amounts do not stack.`);
  } else if(effect.missile){const die=roll(1,4)[0];damage=(2+level)*(die+1);logs.push(`Magic Missile: ${2+level} darts × (${die}+1) = ${damage} Force damage.`);}
  else if(effect.save){
    const die=roll(1,20)[0],saveBonus=target.saves?.[effect.save]??0,success=die+saveBonus>=dc;
    const damageDice=roll(count,effect.die),rolled=sum(damageDice);
    const potent=subclassActive(hero,'Evoker') && spell.level===0;
    damage=success?(effect.half||potent?Math.floor(rolled/2):0):rolled;
    logs.push(`${spell.name}: ${effect.save} save d20 ${die} + ${saveBonus} = ${die+saveBonus} vs DC ${dc}: ${success?'success':'failure'}; ${damage} ${effect.type} damage. Damage ${count}d${effect.die} [${damageDice.join(', ')}] = ${rolled}${success?(effect.half||potent?'; halved on save.':'; negated on save.'):'.'}`);
    enemyDisadvantage=!!effect.weaken && !success;
  } else if(effect.attack){
    const beams=effect.beams?cantripDice(hero.level):effect.rays?effect.rays+level-spell.level:1;
    for(let i=0;i<beams;i++){
      // During the opening strike the foe has not closed the gap yet, so a ranged spell carries no close-range penalty.
      const nearbyThreat=!game.openingAttackAvailable && (game.castingConditions?.targetDistance??target.distance??5)<=5 && target.canSeeAttacker!==false && !target.incapacitated;
      const attack=rollAttack({attackBonus:bonus},effect.attack==='ranged' && nearbyThreat?'disadvantage':'normal',random);
      const hit=!attack.miss && (attack.critical || attack.total>=target.ac);
      const diceCount=(effect.beams?1:count)*(attack.critical?2:1);
      let damageDice=hit?roll(diceCount,effect.die):[],part=sum(damageDice);
      if(!hit && subclassActive(hero,'Evoker')){damageDice=roll(effect.beams?1:count,effect.die);part=Math.floor(sum(damageDice)/2);}
      damage+=part;logs.push(`${spell.name}${beams>1?` beam ${i+1}`:''}: d20 [${attack.dice.join(', ')}] (${attack.mode}) + ${mod} ${spellAbility[hero.class]} + ${proficiencyBonus(hero.level)} proficiency = ${attack.total} vs AC ${target.ac}. ${attack.critical?'Critical hit':hit?'Hit':'Miss'}; ${part} ${effect.type} damage${damageDice.length?' ('+damageDice.length+'d'+effect.die+' ['+damageDice.join(', ')+']'+(!hit?'; halved by Potent Cantrip':'')+')':''}.`);
      if(hit && effect.condition){next.enemyEffects={...next.enemyEffects,[effect.condition]:spell.id==='chill-touch'?2:1};logs.push(effect.condition+'.');}
    }
  }
  const damageBeforeDefenses=damage;
  if(effect.type && target.immunities?.includes(effect.type))damage=0;
  else {if(effect.type && target.resistances?.includes(effect.type))damage=Math.floor(damage/2);if(effect.type && target.vulnerabilities?.includes(effect.type))damage*=2;}
  if(damage!==damageBeforeDefenses)logs.push(`After the target's ${effect.type} defenses: ${damage} damage applied (${damageBeforeDefenses} before defenses).`);
  return {game:next,health:hp,logs,damage,bonus:spell.castingTime==='Bonus Action',enemyDisadvantage};
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
  const spell=knownSpells(hero).find(s=>s.id===request.id),calculatedLogs=[];
  if(request.npcTarget&&automaticEffects[spell.id]&&!automaticEffects[spell.id].heal&&!automaticEffects[spell.id].temp&&!automaticEffects[spell.id].protection&&!automaticEffects[spell.id].detection){
    const calculated=requestSpell(hero,{...clean,stage:'combat'},health,maximum,{...request,forceDM:false},random,{ac:10,saves:{Strength:0,Dexterity:0,Constitution:0,Intelligence:0,Wisdom:0,Charisma:0},distance:10});
    if(calculated.error)return calculated;
    ruling={...ruling,damage:calculated.damage};calculatedLogs.push('NPC uses the starter commoner defenses: AC 10, ability save modifiers +0.',...calculated.logs);
  }
  let next=spendSpell(hero,clean,spell,request.slot);
  if(game.stage!=='combat'){
    const minutes=Math.ceil((durationRounds(spell.castingTime)??0)/10)+(request.slot==='ritual'?10:0);
    if(minutes)next.map={...game.map,minutes:(game.map?.minutes??0)+minutes};
  }
  // A named person's damage and healing apply to them, never to the caster.
  if(request.npcTarget){const id=request.npcTarget;if(!['keeper','mara'].includes(id)||!npcScene(game).some(n=>n.id===id&&n.present)||game.npcFate?.[id]==='dead')return {error:'That person is not here.'};const most=npcProfiles[id].maximumHP,was=game.npcHP?.[id]??most,now=Math.min(most,Math.max(0,was-ruling.damage)+ruling.healing);next.npcHP={...game.npcHP,[id]:now};if(was===0&&now>0&&next.npcFate?.[id]){next.npcFate={...next.npcFate};delete next.npcFate[id];if(!Object.keys(next.npcFate).length)delete next.npcFate;}}
  if(!spell.concentration && next.concentration?.id===spell.id)delete next.concentration;
  const absorbed=Math.min(health?.temp??0,ruling.selfDamage??0);
  const hp={current:Math.min(maximum,Math.max(0,(health?.current??maximum)-((ruling.selfDamage??0)-absorbed))+(request.npcTarget?0:ruling.healing)),temp:Math.max((health?.temp??0)-absorbed,request.npcTarget?(health?.temp??0)-absorbed:ruling.temporaryHP)};
  const knockedOut=(health?.current??maximum)-((ruling.selfDamage??0)-absorbed)<=0;
  if(knockedOut||hp.current===0)delete next.concentration;
  else {
    const concentration=concentrationAfterDamage(hero,next,ruling.selfDamage??0,random);
    next=concentration.game;calculatedLogs.push(...concentration.logs);
  }
  if(ruling.temporaryHP>=(health?.temp??0) && ruling.temporaryHP>0)delete next.temporarySpell;
  return {game:next,health:hp,damage:request.npcTarget?0:ruling.damage,bonus:spell.castingTime==='Bonus Action',reaction:spell.castingTime==='Reaction',manualRounds:!['Action','Bonus Action','Reaction'].includes(spell.castingTime)?durationRounds(spell.castingTime):0,logs:[`${spell.name} — DM ruling: ${ruling.note.trim()}`,`Target / intent: ${request.intent}`,...calculatedLogs,`Applied: ${ruling.damage} ${request.npcTarget??'enemy'} damage, ${ruling.selfDamage??0} damage to you, ${hp.current-(health?.current??maximum)} healing, temporary HP ${hp.temp}. Casting cost: ${request.slot===0?'cantrip':request.slot==='ritual'?'ritual':request.slot==='arcanum'?'Mystic Arcanum':`level ${request.slot} slot`}. Other effects follow the recorded ruling.`]};
}
export function concentrationAfterDamage(hero,game,damage,random=Math.random) {
  if(game.concentration&&game.castingConditions?.incapacitated){const next={...game};delete next.concentration;return {game:next,logs:['Concentration ended: incapacitated.']};}
  if(!game.concentration || damage<=0)return {game,logs:[]};
  const die=1+Math.floor(random()*20),trained=['Artificer','Barbarian','Fighter','Sorcerer'].includes(hero.class);
  const bonus=modifier(hero.scores.Constitution)+(trained?proficiencyBonus(hero.level):0),dc=Math.min(30,Math.max(10,Math.floor(damage/2)));
  const success=die+bonus>=dc,next={...game};if(!success)delete next.concentration;
  return {game:next,logs:[`Concentration: Constitution save ${die} + ${bonus} vs DC ${dc}. ${success?'Maintained.':'Spell ended.'}`]};
}

// Shared preflight for conversational casting. Unknown world facts never become fabricated effects.
// In a story fight the creature can be named loosely: "the bandit", "the goblins", "the beast", "him", "it".
function storyFoeNamed(game,target){
  if(!game.story?.foe||game.stage!=='combat'||game.dungeon?.active||typeof target!=='string')return false;
  const t=target.toLowerCase().replace(/^(?:the|that|this)\s+/,'').trim();
  if(['it','him','her','them','foe','beast','monster','enemy','creature'].includes(t))return true;
  const words=[game.story.foe,game.story.foeSpecies,game.story.foeStats?.group?.plural].filter(Boolean).join(' ').toLowerCase().split(/[^a-z]+/).filter(w=>w.length>=4);
  return t.split(/[^a-z]+/).some(w=>w.length>=4&&words.some(f=>f.startsWith(w.replace(/s$/,''))||w.startsWith(f)));
}
export function inspectSpellCast(hero,game,health,spell,request,target){
  const error=castError(hero,game,request);if(error)return {error};
  if(health?.current===0)return {error:'You are at 0 HP and cannot begin casting. Recover first.'};
  const flags=game.castingConditions??{},components=spell.components??'',items=hero.equipment?.items??[];
  if(flags.incapacitated)return {error:'You cannot cast while incapacitated.'};
  if(components.includes('V')&&flags.silenced)return {error:'This spell needs spoken words, but you are silenced.'};
  if((components.includes('S')||components.includes('M'))&&flags.handsBound)return {error:'This spell needs an available hand, but your hands are bound.'};
  const effect=automaticEffects[spell.id],self=!!effect&&(effect.heal||effect.temp||effect.protection||effect.detection),onSelf=['me','myself','self'].includes(target),onWisp=(game.dungeon?.active?['enemy','the enemy',...(game.dungeon.room===6?['lantern warden','the lantern warden']:['stone sentinel','the stone sentinel'])]:game.story?.foe?[game.story.foe.toLowerCase(),'the '+game.story.foe.toLowerCase(),'enemy','the enemy','creature','the creature']:['wisp','the wisp','lantern wisp','the lantern wisp']).includes(target)&&game.stage==='combat'||storyFoeNamed(game,target);
  if(onWisp&&flags.clearPath===false)return {error:'The target is behind an obstruction. Get a clear path before casting.'};
  const distance=onSelf?0:onWisp?(flags.targetDistance??5):null;
  const range=spell.id==='burning-hands'?15:spell.range==='Touch'?5:spell.range.match(/^(\d+) feet$/)?.[1];
  if(distance!==null&&range!==undefined&&distance>Number(range))return {error:`The target is ${distance} feet away; ${spell.name} reaches ${range} feet.`};
  const reasons=[];
  if(!effect)reasons.push('This spell’s effects need a DM ruling.');
  // Healing a person who is here resolves on its own, like healing yourself.
  const healPerson=!!effect?.heal&&!!request.npcTarget;
  if(!(self?(onSelf||healPerson):onWisp))reasons.push('This target or area needs a DM ruling.');
  if(!['Action','Bonus Action'].includes(spell.castingTime)||(request.slot==='ritual'&&!effect?.detection))reasons.push('Casting time, reaction trigger, or ritual completion needs a DM ruling.');
  const material=spell.material??'',special=/\b(?:gp|sp|cp|pp|worth|consum\w*)\b/i.test(material+' '+spell.description);
  if(components.includes('M')){
    const focusByClass={Wizard:/Arcane Focus/i,Sorcerer:/Arcane Focus/i,Warlock:/Arcane Focus/i,Cleric:/Holy Symbol/i,Paladin:/Holy Symbol/i,Druid:/Druidic Focus/i,Ranger:/Druidic Focus/i,Bard:/Lute|Flute|Drum/i,Artificer:/Tools/i};
    const focus=items.some(i=>i.quantity>0&&(/Component Pouch/i.test(i.name)||focusByClass[hero.class]?.test(i.name)));
    if(special)reasons.push('Costly or consumed materials must be verified and accounted for by a DM.');
    else if(!focus)reasons.push('No suitable focus or component pouch is recorded; material availability needs a DM ruling.');
  }
  return {manual:reasons.length>0,reasons,summary:`${spell.name}: ${spell.castingTime}; range ${spell.range}; components ${components}; duration ${spell.duration}. ${request.slot===0?'Cantrip: no slot.':request.slot==='ritual'?'Ritual: no slot, 10 extra minutes.':request.slot==='arcanum'?'Uses Mystic Arcanum.':`Uses a level ${request.slot} slot.`} ${spell.concentration?'Requires concentration. ':''}${reasons.length?reasons.join(' '):'Prepared spell, resources, target and implemented effect checked.'} The scene assumes normal speech and a free casting hand unless a restriction is recorded.`};
}
