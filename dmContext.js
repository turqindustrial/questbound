import {storyText} from './storyRules';
import {recruitmentTargets,resolveRecruitment} from './followerRules';
import {skillAbilities,skillCheckBonus,trainedSkills} from './skillRules';
import {npcScene,npcServiceError} from './npcRules';
import {modifier,proficiencyBonus} from './characterRules';
import {concentrationAfterDamage} from './spellRules';
import {dungeonChoices,dungeonRooms} from './dungeonRules';
import {knownSpells,spellCostOptions,automaticEffects,spellAbility} from './spellRules';
import {dmCommand} from './dmCommands';
import {adventureStep,encounterFoe} from './adventureRules';
import {appendJournal,journalForGame} from './journalRules';
import {classActions} from './classActions';
import {mapState,mapRoute,mapLocation,travelError} from './mapRules';
import {campaignState,earnedGold,interactionOptions} from './campaignRules';
import {weaponAttacks} from './weaponRules';
import {loadoutFor} from './equipmentRules';
import {combatBasics} from './combatRules';
export function dmChoices(hero,game) {
  if(game.pendingSpell)return [{id:'cancel-spell',label:'Cancel the pending spell',action:{type:'cancel-spell'}}];
  const choices=dungeonChoices(game).map(c=>({...c,action:c.id})),add=(id,label,action=id)=>choices.push({id,label,action});
  const c=campaignState(game),map=mapState(game);
  if(game.stage==='bridge'&&game.enemyHP>0)for(const w of weaponAttacks(hero).filter(w=>!w.blocked&&!w.ranged).slice(0,3))add('encounter-attack:'+w.name,'Attack '+(game.story?.foe??'Lantern Wisp')+' with '+w.name,{type:'encounter-attack',weapon:w.name});
  if(game.story){
    if(game.stage==='inn')for(const npc of npcScene(game).filter(n=>n.present&&n.hp>0))for(const w of weaponAttacks(hero).filter(w=>!w.blocked&&!w.ranged).slice(0,3))add('npc-attack:'+npc.id+':'+w.name,'Attack '+game.story.npcs[npc.id].name+' with '+w.name,{type:'npc-attack',target:npc.id,weapon:w.name});
    if(game.npcCombat?.active){for(const id of ['dodge','flee','wait','surrender'])add('npc-'+id,id);return choices;}
    if(game.stage==='combat'){for(const w of weaponAttacks(hero).filter(w=>!w.blocked&&!w.ranged))add('attack:'+w.name,'Attack with '+w.name);for(const id of ['dodge','flee'])add(id,id);if(game.potions>0)add('potion','Drink healing draught');}
    else if(!['defeat','escaped'].includes(game.stage)){for(const id of ['inn','bridge','tower'])if(id!==mapLocation(game)&&!travelError({...game,stage:game.stage==='victory'?'bridge':game.stage},id))add('travel-'+id,'Travel to '+game.story.locations[id].name,{type:'travel',destination:id});if(game.stage==='bridge'&&game.enemyHP>0)add('approach','Confront '+game.story.foe);if(game.stage==='inn')add('long-rest','Rest safely if the residents permit');if(game.story.status==='active')add('story-complete','Conclude the adventure ONLY when the story resolution conditions have actually been achieved');}
    return choices;
  }
  if(game.stage==='inn')for(const npc of npcScene(game).filter(n=>n.present&&n.hp>0))for(const w of weaponAttacks(hero).filter(w=>!w.blocked&&!w.ranged).slice(0,3))add('npc-attack:'+npc.id+':'+w.name,'Attack '+npc.name+' with '+w.name,{type:'npc-attack',target:npc.id,weapon:w.name});
  if(game.npcCombat?.active){
    for(const id of ['dodge','flee','wait','surrender'])add('npc-'+id,id[0].toUpperCase()+id.slice(1));
    return choices;
  }
  if(game.concentration)add('end-concentration','End concentration',{type:'end-concentration'});
  if(['victory','defeat','escaped'].includes(game.stage))add('restart-adventure','Begin another adventure with this character');
  if(game.stage==='inn'&&!map.accepted)add('study','Study the lantern, accept the quest, and depart for the bridge');
  for(const [id,stage,label] of [['persuade-keeper','inn','Persuade the keeper for a watchtower lead: Charisma DC 10'],['investigate-signal','tower','Decipher the tower signal: Intelligence DC 10']])if(game.stage===stage&&!(game.dmChecks??[]).includes(id)&&!(id==='investigate-signal'&&map.clue))add('check:'+id,label);
  for(const option of interactionOptions(game))add(option.id,option.label);
  if(['inn','bridge','tower'].includes(game.stage)&&(map.accepted||Object.keys(game.npcMemory??{}).length>0))for(const id of ['inn','bridge','tower'])if(id!==game.stage)add('travel-'+id,'Travel to '+id,{type:'travel',destination:id});
  if(game.stage==='inn'){add('long-rest','Take a long rest');if(!map.accepted)add('listen','Accept the keeper’s quest');}
  if(game.stage==='tower'&&!map.clue)add('inspect-tower','Read the carved signal');
  if(game.stage==='bridge'&&game.enemyHP>0){add('approach','Approach the wisp');if(map.clue)add('call-wisp','Call the wisp home peacefully');}
  if(game.stage==='combat'){
    for(const option of classActions(hero,game).filter(a=>['wind','hands','strike'].includes(a.id)&&!a.disabled))add('class:'+option.id,option.name);
    for(const w of weaponAttacks(hero).filter(w=>!w.blocked&&!w.ranged))add('attack:'+w.name,'Attack with '+w.name);
    add('dodge','Dodge');add('flee','Retreat');if(game.potions>0)add('potion','Drink healing draught');
  }
  if(['victory','bridge'].includes(game.stage)&&game.enemyHP===0&&!c.bridgeReward)add('claim-reward','Claim 20 GP reward');
  if(['inn','victory'].includes(game.stage)&&c.bridgeReward&&c.lensQuest==='locked')add('start-lens','Accept the missing lens quest');
  if(game.stage==='tower'&&c.lensQuest==='active')add('find-lens','Recover the signal lens');
  if(game.stage==='inn'&&c.lensQuest==='found')add('deliver-lens','Deliver the signal lens');
  return choices.filter(c=>!npcServiceError(game,c.action));
}
export function dmContext(hero,game,health) {
  const context={npcCombat:game.npcCombat??null,skillChecks:Object.entries(skillAbilities).map(([skill,ability])=>skillCheckBonus(hero,game,ability,skill)),npcSocialState:npcScene(game),resolvedActionEvents:(game.actionEvents??[]).slice(-8),actionContract:{actions: 'Use choices for supported attacks, abilities and travel; castCommand for spells; check for uncertain noncombat attempts; all other mechanical actions require clarification. Never invent an action ID.',movement:'Only supplied travelRoutes and dungeon choices are implemented. Precise tactical positioning and opportunity attacks are not implemented.',witnesses:'Only NPCs present and conscious witness attacks. Recorded npcCombat contains actual initiative and sides. NPC attacks and defender help resolve in the engine after player turns; narrate those results without inventing additional damage. Distant acquaintances learn nothing until informed. Recorded NPC memories override contradictory story notes.'},encounter:game.stage==='combat'?{...encounterFoe(hero,game),currentHP:game.enemyHP,distance:game.castingConditions?.targetDistance??5,clearPath:game.castingConditions?.clearPath!==false}:null,turnResources:{bonusActionUsed:!!game.bonusUsed,reactionUsed:!!game.reactionUsed,spellSlotSpentThisTurn:!!game.slotSpentThisTurn},spellSaveDC:8+proficiencyBonus(hero.level)+modifier(hero.scores[spellAbility[hero.class]]??10),spellAttackBonus:proficiencyBonus(hero.level)+modifier(hero.scores[spellAbility[hero.class]]??10),npcDefenses:{keeper:{ac:10,saveModifiers:0},mara:{ac:10,saveModifiers:0}},castingConditions:game.castingConditions??{},equipment:hero.equipment,loadout:loadoutFor(hero),loadoutGuidance:'Use the class loadout mainWeapon for an unspecified close-range attack. Explicitly named weapons take priority. Only owned gear is available. The focus is available for eligible material components; it does not waive costly or consumed components or hand requirements. Carried bows are inventory, not an implemented ranged-attack action; use only supplied choices.',worldFacts:(game.worldFacts??[]).slice(-12),npcHP:{keeper:12,mara:9,...game.npcHP},dungeon:game.dungeon?.active?{room:dungeonRooms[game.dungeon.room].name,description:dungeonRooms[game.dungeon.room].text,complete:game.dungeon.complete}:null,travelRoutes:['inn','bridge','tower'].filter(id=>id!==mapLocation(game)).map(id=>({destination:id,...mapRoute(mapLocation(game),id)})),castingHelp:'Cast through Send to DM: I cast [spell] on [target]. The game automatically checks casting requirements. Add level N slot for upcasting. You may adjudicate pending spells using the provided spell description and recorded scene. Do not direct players to casting buttons.',spellReference:knownSpells(hero).map(spell=>({name:spell.name,components:spell.components,material:spell.material,level:spell.level,castingTime:spell.castingTime,range:spell.range,availableCosts:spellCostOptions(hero,game,spell)})),nearbyNPCs:game.dungeon?.active?(game.stage==='combat'?[{name:dungeonRooms[game.dungeon.room].foe,voice:'An ancient guardian; speak in terse solemn warnings.'}]:[]):game.stage==='inn'?[{name:'The keeper',voice:'Practical, warm, worried about travelers; never promises unearned rewards.'},{name:'Mara',voice:'A thoughtful traveling medicine courier; knows the road, not undiscovered tower secrets.'}]:['bridge','combat'].includes(game.stage)?[{name:'Lantern Wisp',voice:'Flickers and wordless musical tones; only call it Ember if the logbook was read.'}]:[],conversationHistory:(game.journal?.entries??[]).filter(e=>e.title==='AI DM conversation').slice(-8).map(e=>({...e,text:e.text.slice(0,1800)})),player:{age:hero.age,backstory:hero.backstory,connections:hero.connections,description:hero.description,name:hero.name,species:hero.species,subclass:hero.plannedSubclass,background:hero.background,class:hero.class,level:hero.level,scores:hero.scores,spells:hero.spells??[],health:health??{current:combatBasics(hero).hp,temp:0}},stage:game.stage,map:mapState(game),campaign:campaignState(game),earnedGold:earnedGold(game),enemyHP:game.enemyHP,spellSlotsUsed:game.spellSlotsUsed??[],pendingSpell:game.pendingSpell?{...game.pendingSpell,engineDamage:!!game.pendingSpell.npcTarget&&!!automaticEffects[game.pendingSpell.id],spell:knownSpells(hero).find(s=>s.id===game.pendingSpell.id)}:null,concentration:game.concentration??null,recentEvents:game.log.slice(0,8),journal:(game.journal?.entries??[]).slice(-8).map(e=>({...e,text:e.text.slice(0,1200)})),choices:dmChoices(hero,game).map(({id,label})=>({id,label}))};
  if(game.story){context.story=game.story;context.nearbyNPCs=game.stage==='inn'?Object.entries(game.story.npcs).map(([id,n])=>({id,name:n.name,voice:n.role+' '+n.motive+' '+(n.personality??''),appearance:n.appearance??null})):game.stage==='combat'?[{name:game.story.foe,voice:'The current threat.'}]:[];context.npcSocialState=context.npcSocialState.map(n=>({...n,name:game.story.npcs[n.id].name}));context.campaign=null;context.journal=context.journal.map(e=>({...e,text:storyText(game,e.text)}));context.recentEvents=context.recentEvents.map(t=>storyText(game,t));context.travelRoutes=context.travelRoutes.map(r=>({...r,name:game.story.locations[r.destination]?.name}));if(context.encounter)context.encounter.name=game.story.foe;}
  context.actionContract.openingAttack='Questbound house rule: an initiating hostile attack resolves once before initiative. Initiative then determines the first normal turn among surviving participants. Do not narrate a defender acting before that opening strike or roll initiative yourself; use engineResolved in its supplied order.';
  context.encounterInitiative=game.encounterInitiative??null;
  context.nearbyNPCs=npcScene(game).filter(n=>n.present&&n.hp>0).map(n=>({id:n.id,name:game.story?.npcs?.[n.id]?.name??n.name,role:game.story?.npcs?.[n.id]?.role??(n.id==='keeper'?'Innkeeper':'Traveling medicine courier'),voice:game.story?.npcs?.[n.id]?.personality??n.response,motive:game.story?.npcs?.[n.id]?.motive??(n.id==='keeper'?'Keep the inn and its guests safe.':'Keep travelers safe and deliver medicine.'),appearance:game.story?.npcs?.[n.id]?.appearance??null,attitude:n.attitude,follower:game.followers?.[n.id]??null}));
  context.followers=game.followers??{};
  return context;
}

export function commitDmTurn(hero,game,health,action,conversation,random=Math.random){
  const result=resolveDmTurn(hero,game,health,action,conversation,random);
  if(result.error)return result;
  const present=npcScene(result.game).filter(n=>n.present&&n.hp>0).map(n=>n.id);
  if((conversation.dialogue??[]).some(line=>!present.includes(line.speakerId)))return {game,health,error:'The reply included a character who cannot join this conversation.'};
  return result;
}
function resolveDmTurn(hero,game,health,action,conversation,random){
  if(!conversation||typeof conversation.question!=='string'||!conversation.question.trim()||conversation.question.length>1000||typeof conversation.narration!=='string'||!conversation.narration.trim()||conversation.narration.length>1800)return {game,health,error:'Invalid DM conversation.'};
  if(conversation.worldEvent!==undefined&&conversation.worldEvent!==null&&(typeof conversation.worldEvent!=='string'||!conversation.worldEvent.trim()||conversation.worldEvent.length>800))return {game,health,error:'Invalid world event.'};
  const dialogue=conversation.dialogue??[],present=npcScene(game).map(n=>n.id);
  if(!Array.isArray(dialogue)||dialogue.length>4||dialogue.some(line=>!line||!present.includes(line.speakerId)||typeof line.text!=='string'||!line.text.trim()||line.text.length>700))return {game,health,error:'The reply included a character who cannot join this conversation.'};
  if(dialogue.length)conversation={...conversation,narration:dialogue.map(line=>(game.story?.npcs?.[line.speakerId]?.name??npcScene(game).find(n=>n.id===line.speakerId).name)+': '+line.text).join('\n').slice(0,1800)};
  if(action?.type==='recruitment'){
    const result=resolveRecruitment(hero,game,health,action.plans,conversation.question,conversation.npcId??null,random);
    if(result.error)return result;
    return {...result,game:{...result.game,journal:appendJournal(journalForGame(result.game),'note','AI DM conversation','Player: '+conversation.question+'\nDungeon Master: '+conversation.narration)}};
  }
  if(action?.type==='ai-check')return commitWorldCheck(hero,game,health,action.check,conversation,random);
  const command=dmCommand(hero,game,conversation.normalizedCommand??conversation.question,health);
  const commandMatches=command?.action&&JSON.stringify(command.action)===JSON.stringify(action);
  if(action!==null&&!['ai-spell','ai-ruling'].includes(action?.type)&&!commandMatches&&!dmChoices(hero,game).some(c=>JSON.stringify(c.action)===JSON.stringify(action)))return {game,health,error:'That DM action is no longer available.'};
  if(action?.type==='ai-spell'){
    if(!command?.action||command.action.type!=='spell'||JSON.stringify(command.action.request)!==JSON.stringify(action.request))return {game,health,error:'Invalid spell interpretation.'};
    const prepared=adventureStep(game,health,hero,command.action,random);if(prepared.error)return prepared;
    if(!prepared.waiting)return {game,health,error:'This spell must use its automatic rules.'};
    return commitAiRuling(hero,prepared.game,prepared.health,action.ruling,conversation,random,game,health);
  }
  if(action?.type==='ai-ruling')return commitAiRuling(hero,game,health,action.ruling,conversation,random,game,health);
  const result=action===null?{game,health}:adventureStep(game,health,hero,action,random);
  if(result.error)return result;
  if(action!==null&&result.game===game)return {game,health,error:'That action was not applied. Describe a supported action or clarify your intent.'};
  return {...result,game:{...result.game,worldFacts:conversation.worldEvent?[...(result.game.worldFacts??[]),conversation.worldEvent].slice(-60):result.game.worldFacts,journal:appendJournal(journalForGame(result.game),'note','AI DM conversation',`${conversation.trigger?'Scene':'Player'}: ${conversation.question}\nAI DM: ${conversation.narration}`)}};
}

function commitAiRuling(hero,game,health,ruling,conversation,random,original,originalHealth){
 const fail=error=>({game:original,health:originalHealth,error});
 if(!game.pendingSpell)return fail('No spell is awaiting a ruling.');
 if(!ruling||!['cast','deny','clarify'].includes(ruling.decision)||typeof ruling.note!=='string'||ruling.note.trim().length<3||ruling.note.length>500||!['damage','selfDamage','healing','temporaryHP'].every(k=>Number.isInteger(ruling[k])&&ruling[k]>=0&&ruling[k]<=500))return fail('Invalid AI ruling. Nothing was spent.');
 let result=ruling.decision==='cast'?adventureStep(game,health,hero,{type:'spell-ruling',ruling},random):ruling.decision==='deny'?adventureStep(game,health,hero,{type:'cancel-spell'},random):{game,health};
 if(result.error)return fail(result.error);
 const event=`AI ruling (${ruling.decision}): ${ruling.note}`;
 return {...result,events:[...(result.events??[]),event],game:{...result.game,worldFacts:[...(result.game.worldFacts??[]),event,...(conversation.worldEvent?[conversation.worldEvent]:[])].slice(-60),journal:appendJournal(appendJournal(journalForGame(result.game),'note','AI spell ruling',event),'note','AI DM conversation',`Player: ${conversation.question}\nAI DM: ${conversation.narration}`)}};
}

function commitWorldCheck(hero,game,health,c,conversation,random){
 const fail=error=>({game,health,error});
 if(game.pendingSpell)return fail('Resolve the pending spell first.');
 if(game.npcCombat?.active)return fail('Finish the combat turn with an attack, spell, dodge, flee, wait, or surrender.');
 if(c?.skill!=null&&!Object.hasOwn(skillAbilities,c.skill))return fail('Unknown skill; no action was applied.');
 if(/^(?:I )?(?:attack|stab|strike|slash|cast)\b/i.test(conversation.question.trim()))return fail('An attack or spell must use its own rules, not a general skill check.');
 if((health?.current??1)<=0||game.castingConditions?.incapacitated)return fail('You cannot take this action while incapacitated.');
 if(!c||!['Strength','Dexterity','Constitution','Intelligence','Wisdom','Charisma'].includes(c.ability)||!Number.isInteger(c.dc)||c.dc<5||c.dc>30||!['normal','advantage','disadvantage'].includes(c.mode)||!['reason','success','failure'].every(k=>typeof c[k]==='string'&&c[k].length>0&&c[k].length<=300)||!Number.isInteger(c.damageCount)||c.damageCount<0||c.damageCount>20||![4,6,8,10,12,20].includes(c.damageDie)||!['failure','always','none'].includes(c.damageOn))return fail('Invalid action check.');
 if(game.castingConditions?.handsBound&&['Strength','Dexterity'].includes(c.ability))return fail('Your hands are bound. Describe how you can attempt this action or escape the restraint first.');
 const modifiers=skillCheckBonus(hero,game,c.ability,c.skill??null);
 const dice=Array.from({length:c.mode==='normal'?1:2},()=>1+Math.floor(random()*20)),die=c.mode==='advantage'?Math.max(...dice):Math.min(...dice),bonus=modifiers.total,total=(modifiers.reliable?Math.max(10,die):die)+bonus,success=total>=c.dc;
 const damageDice=(c.damageOn==='always'||(c.damageOn==='failure'&&!success))?Array.from({length:c.damageCount},()=>1+Math.floor(random()*c.damageDie)):[],damage=damageDice.reduce((a,b)=>a+b,0);
 const hp={current:health?.current??combatBasics(hero).hp,temp:health?.temp??0},absorbed=Math.min(hp.temp,damage);hp.temp-=absorbed;hp.current=Math.max(0,hp.current-damage+absorbed);
 let next={...game};const maintained=concentrationAfterDamage(hero,next,damage,random);next=maintained.game;if(hp.current===0){delete next.concentration;next.stage='defeat';if(next.dungeon)next.dungeon={...next.dungeon,active:false};}
 const outcome=success?c.success:c.failure;
 const text=c.reason+': '+c.ability+(c.skill?' ('+c.skill+')':'')+' d20 ['+dice.join(', ')+']'+(modifiers.reliable&&die<10?' → 10 Reliable Talent':'')+' + '+modifiers.abilityBonus+' ability + '+modifiers.trainingBonus+(modifiers.expert?' Expertise':' training')+' = '+total+' vs DC '+c.dc+'. '+(success?'Success. ':'Failure. ')+outcome+(damageDice.length?' Damage ['+damageDice.join(', ')+'] = '+damage+'.':'');
 next.log=[text,...maintained.logs,...game.log].slice(0,40);next.worldFacts=[...(game.worldFacts??[]),outcome].slice(-60);next.journal=appendJournal(appendJournal(journalForGame(next),'ruling','Action check',text),'note','AI DM conversation','Player: '+conversation.question+'\nDungeon Master: '+conversation.narration+'\nResult: '+outcome);
 return {game:next,health:hp,events:[text,...maintained.logs]};
}
