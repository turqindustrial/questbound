import {storyText} from './storyRules';
import {recruitmentTargets,resolveRecruitment} from './followerRules';
import {skillAbilities,skillCheckBonus,trainedSkills} from './skillRules';
import {npcScene,npcServiceError,npcLore,npcIdsOf,npcProfile,npcMaxHP} from './npcRules';
import {modifier,proficiencyBonus} from './characterRules';
import {concentrationAfterDamage} from './spellRules';
import {dungeonChoices,dungeonRooms} from './dungeonRules';
import {knownSpells,spellCostOptions,automaticEffects,spellAbility} from './spellRules';
import {dmCommand} from './dmCommands';
import {adventureStep,encounterFoe} from './adventureRules';
import {appendJournal,journalForGame} from './journalRules';
import {classActions} from './classActions';
import {mapState,mapLocation,travelError,travelRoute,knownPlaceIds,placeName,placeDescription,worldPlace,worldPlaces,maxWorldPlaces,distanceText} from './mapRules';
import {campaignState,earnedGold,interactionOptions} from './campaignRules';
import {attackOptions} from './weaponRules';
import {fallAtZero,fallPlace} from './deathRules';
import {withAttackIntent} from './dmCommands';
import {npcTies,validDeeds,applyDeeds,canMeetPeople,introducePerson} from './relationshipRules';
import {gearedHero,packOf,arrowsLeft,applyLoot,priceList} from './inventoryRules';
import {foeLabel,foeKind,signatureMoves,heroConditions,fightingCompanions,allFoeTemplates,livingAllies,allyStats} from './encounterRules';
import {loadoutFor} from './equipmentRules';
import {combatBasics} from './combatRules';
// Up to three carried weapons (main weapon first), then bare hands: the attacks a sentence can turn into.
const attackChoices=hero=>{const all=attackOptions(hero);return [...all.filter(w=>!w.unarmed).slice(0,3),...all.filter(w=>w.unarmed)];};
// Known places the hero can set out for, nearest first.
export function travelChoices(game,limit=8){
  const here=mapLocation(game),scene={...game,stage:game.stage==='victory'?'bridge':game.stage};
  return knownPlaceIds(game).filter(id=>id!==here&&!travelError(scene,id)).map(id=>({id,route:travelRoute(scene,mapLocation(scene),id)})).sort((a,b)=>a.route.minutes-b.route.minutes).slice(0,limit).map(t=>t.id);
}
export function dmChoices(hero,game) {
  hero=gearedHero(hero,game);
  if(game.stage==='dead')return [];
  if(game.stage==='dying')return [{id:'death-save',label:'Roll a death saving throw',action:'death-save'}];
  if(game.pendingSpell)return [{id:'cancel-spell',label:'Cancel the pending spell',action:{type:'cancel-spell'}}];
  const choices=dungeonChoices(game).map(c=>({...c,action:c.id})),add=(id,label,action=id)=>choices.push({id,label,action});
  const c=campaignState(game),map=mapState(game);
  if(game.stage==='bridge'&&game.enemyHP>0)for(const w of attackChoices(hero))add('encounter-attack:'+w.name,'Attack '+(game.story?.foe??'Lantern Wisp')+' with '+w.name,{type:'encounter-attack',weapon:w.name});
  // Anyone present and not dead can be attacked; someone lying unconscious can be finished off.
  const victims=npcScene(game).filter(n=>n.present&&n.fate!=='dead');
  // A healing draught can be given to anyone here who is hurt (and brings round someone lying senseless).
  const addPotionGifts=()=>{if((game.potions??0)>0)for(const n of victims)if((game.npcHP?.[n.id]??npcMaxHP(n.id,game))<npcMaxHP(n.id,game))add('give-potion:'+n.id,'Give '+(npcLore(game,n.id)?.name??n.name)+' a healing draught',{type:'give-potion',target:n.id});};
  if(game.story){
    if(['inn','bridge','tower','wild'].includes(game.stage))for(const npc of victims)for(const w of attackChoices(hero))add('npc-attack:'+npc.id+':'+w.name,'Attack '+(npcLore(game,npc.id)?.name??npc.name)+' with '+w.name,{type:'npc-attack',target:npc.id,weapon:w.name});
    if(game.npcCombat?.active){for(const id of ['dodge','flee','wait','surrender'])add('npc-'+id,id);return choices;}
    if(game.stage==='combat'){for(const w of attackOptions(hero))add('attack:'+w.name,'Attack with '+w.name);for(const a of livingAllies(game))for(const w of attackChoices(hero))add('ally-attack:'+a.index+':'+w.name,'Attack the '+a.name+' with '+w.name,{type:'encounter-attack',weapon:w.name,target:'ally:'+a.index});for(const id of ['dodge','flee'])add(id,id);if(game.potions>0)add('potion','Drink healing draught');addPotionGifts();}
    else if(!['defeat','escaped'].includes(game.stage)){for(const id of travelChoices(game))add('travel-'+id,'Travel to '+placeName(game,id),{type:'travel',destination:id});if(game.stage==='bridge'&&game.enemyHP>0)add('approach','Confront '+game.story.foe);if(game.stage==='inn')add('long-rest','Rest safely if the residents permit');if((game.potions??0)>0)add('potion','Drink a healing draught');addPotionGifts();if(game.story.status==='active')add('story-complete','Conclude the adventure ONLY when the story resolution conditions have actually been achieved');}
    return choices;
  }
  if(game.stage==='inn')for(const npc of victims)for(const w of attackChoices(hero))add('npc-attack:'+npc.id+':'+w.name,'Attack '+npc.name+' with '+w.name,{type:'npc-attack',target:npc.id,weapon:w.name});
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
    for(const w of attackOptions(hero))add('attack:'+w.name,'Attack with '+w.name);
    add('dodge','Dodge');add('flee','Retreat');if(game.potions>0)add('potion','Drink healing draught');
  }
  if(['victory','bridge'].includes(game.stage)&&game.enemyHP===0&&!c.bridgeReward)add('claim-reward','Claim 20 GP reward');
  if(['inn','victory'].includes(game.stage)&&c.bridgeReward&&c.lensQuest==='locked')add('start-lens','Accept the missing lens quest');
  if(game.stage==='tower'&&c.lensQuest==='active')add('find-lens','Recover the signal lens');
  if(game.stage==='inn'&&c.lensQuest==='found')add('deliver-lens','Deliver the signal lens');
  return choices.filter(c=>!npcServiceError(game,c.action));
}
export function dmContext(hero,game,health) {
  hero=gearedHero(hero,game);
  const context={npcCombat:game.npcCombat??null,skillChecks:Object.entries(skillAbilities).map(([skill,ability])=>skillCheckBonus(hero,game,ability,skill)),npcSocialState:npcScene(game),resolvedActionEvents:(game.actionEvents??[]).slice(-8),actionContract:{actions: 'Use choices for supported attacks, abilities and travel; castCommand for spells; check for uncertain noncombat attempts; all other mechanical actions require clarification. Never invent an action ID.',movement:game.story?'Known places are reached with their travel choices (travelRoutes). Going anywhere new (a direction, a landmark, a rumoured place) is fully supported: reveal it with discovery and travel true, as described under OPEN WORLD. Precise tactical positioning and opportunity attacks are not implemented.':'Only supplied travelRoutes and dungeon choices are implemented. Precise tactical positioning and opportunity attacks are not implemented.',witnesses:'Only NPCs present and conscious witness attacks. Recorded npcCombat contains actual initiative and sides. NPC attacks and defender help resolve in the engine after player turns; narrate those results without inventing additional damage. Distant acquaintances learn nothing until informed. Recorded NPC memories override contradictory story notes.'},encounter:game.stage==='combat'?{...encounterFoe(hero,game),currentHP:game.enemyHP,distance:game.castingConditions?.targetDistance??5,clearPath:game.castingConditions?.clearPath!==false}:null,turnResources:{bonusActionUsed:!!game.bonusUsed,reactionUsed:!!game.reactionUsed,spellSlotSpentThisTurn:!!game.slotSpentThisTurn},spellSaveDC:8+proficiencyBonus(hero.level)+modifier(hero.scores[spellAbility[hero.class]]??10),spellAttackBonus:proficiencyBonus(hero.level)+modifier(hero.scores[spellAbility[hero.class]]??10),npcDefenses:Object.fromEntries(npcIdsOf(game).map(id=>[id,{ac:npcProfile(game,id).ac,saveModifiers:0}])),castingConditions:game.castingConditions??{},equipment:hero.equipment,loadout:loadoutFor(hero),loadoutGuidance:'Use the class loadout mainWeapon for an unspecified close-range attack. Explicitly named weapons take priority. Only owned gear is available. The focus is available for eligible material components; it does not waive costly or consumed components or hand requirements. Carried bows are inventory, not an implemented ranged-attack action; use only supplied choices.',worldFacts:(game.worldFacts??[]).slice(-12),npcHP:{...Object.fromEntries(npcIdsOf(game).map(id=>[id,npcMaxHP(id,game)])),...game.npcHP},dungeon:game.dungeon?.active?{room:dungeonRooms[game.dungeon.room].name,description:dungeonRooms[game.dungeon.room].text,complete:game.dungeon.complete}:null,travelRoutes:(game.story?knownPlaceIds(game):['inn','bridge','tower']).filter(id=>id!==mapLocation(game)).map(id=>({destination:id,name:placeName(game,id),...travelRoute(game,mapLocation(game),id)})).filter(r=>Number.isFinite(r.feet)),castingHelp:'Cast through Send to DM: I cast [spell] on [target]. The game automatically checks casting requirements. Add level N slot for upcasting. You may adjudicate pending spells using the provided spell description and recorded scene. Do not direct players to casting buttons.',spellReference:knownSpells(hero).map(spell=>({name:spell.name,components:spell.components,material:spell.material,level:spell.level,castingTime:spell.castingTime,range:spell.range,availableCosts:spellCostOptions(hero,game,spell)})),nearbyNPCs:game.dungeon?.active?(game.stage==='combat'?[{name:dungeonRooms[game.dungeon.room].foe,voice:'An ancient guardian; speak in terse solemn warnings.'}]:[]):game.stage==='inn'?[{name:'The keeper',voice:'Practical, warm, worried about travelers; never promises unearned rewards.'},{name:'Mara',voice:'A thoughtful traveling medicine courier; knows the road, not undiscovered tower secrets.'}]:['bridge','combat'].includes(game.stage)?[{name:'Lantern Wisp',voice:'Flickers and wordless musical tones; only call it Ember if the logbook was read.'}]:[],conversationHistory:(game.journal?.entries??[]).filter(e=>e.title==='AI DM conversation').slice(-8).map(e=>({...e,text:e.text.slice(0,1800)})),player:{age:hero.age,backstory:hero.backstory,connections:hero.connections,description:hero.description,name:hero.name,species:hero.species,subclass:hero.plannedSubclass,background:hero.background,class:hero.class,level:hero.level,scores:hero.scores,spells:hero.spells??[],health:health??{current:combatBasics(hero).hp,temp:0}},stage:game.stage,map:mapState(game),campaign:campaignState(game),earnedGold:earnedGold(game),enemyHP:game.enemyHP,spellSlotsUsed:game.spellSlotsUsed??[],pendingSpell:game.pendingSpell?{...game.pendingSpell,engineDamage:!!game.pendingSpell.npcTarget&&!!automaticEffects[game.pendingSpell.id],spell:knownSpells(hero).find(s=>s.id===game.pendingSpell.id)}:null,concentration:game.concentration??null,recentEvents:game.log.slice(0,8),journal:(game.journal?.entries??[]).slice(-8).map(e=>({...e,text:e.text.slice(0,1200)})),choices:dmChoices(hero,game).map(({id,label})=>({id,label}))};
  if(game.story){context.story=game.story;context.nearbyNPCs=game.stage==='inn'?Object.entries(game.story.npcs).map(([id,n])=>({id,name:n.name,voice:n.role+' '+n.motive+' '+(n.personality??''),appearance:n.appearance??null})):game.stage==='combat'?[{name:foeLabel(game),voice:'The current threat.'}]:[];context.npcSocialState=context.npcSocialState.map(n=>({...n,name:npcLore(game,n.id)?.name??n.name,role:npcLore(game,n.id)?.role??null,livesAt:game.people?.[n.id]?placeName(game,game.people[n.id].home):null,ties:npcTies(game,n.id)}));context.campaign=null;context.journal=context.journal.map(e=>({...e,text:storyText(game,e.text)}));context.recentEvents=context.recentEvents.map(t=>storyText(game,t));if(context.encounter)context.encounter.name=foeLabel(game);
    // The wider region: where the hero is, what they know of, and whether a new place can be revealed now.
    const here=mapLocation(game),visited=mapState(game).visited;
    context.world={current:{id:here,name:placeName(game,here),description:placeDescription(game,here),kind:worldPlace(game,here)?.kind??null},
     knownPlaces:knownPlaceIds(game).map(id=>{const r=id===here?{feet:0,minutes:0}:travelRoute(game,here,id);return {id,name:placeName(game,id),kind:worldPlace(game,id)?.kind??'starting place',description:placeDescription(game,id).slice(0,300),distance:r?distanceText(r.feet):'unknown',minutes:r?.minutes??null,visited:visited.includes(id)};}),
     canDiscover:['inn','bridge','tower','wild'].includes(game.stage)&&!game.pendingSpell&&!game.npcCombat?.active&&(health?.current??1)>0&&worldPlaces(game).length<maxWorldPlaces,placesLeft:maxWorldPlaces-worldPlaces(game).length,
     canIntroduce:canMeetPeople(game)&&(health?.current??1)>0,peopleMet:Object.keys(game.people??{}).length};
    if(game.stage==='wild')context.nearbyNPCs=[];}
  // Fates: who has died, how the main foe ended, and whether the hero is dying or dead.
  if(context.encounter){const kind=foeKind(game);context.encounter={...context.encounter,signatureMove:kind?signatureMoves[kind]:null,yourCondition:game.heroCondition?heroConditions[game.heroCondition]:null,companionsFighting:fightingCompanions(game).map(n=>npcLore(game,n.id)?.name??n.name),wildCreature:!!game.wildFight,appearance:game.wildFight?.appearance??game.story?.foeAppearance??null,
    alsoFighting:livingAllies(game).map(a=>{const s=allyStats(game,a.index,hero.level??1);return {name:a.name,kind:a.template,appearance:a.appearance,currentHP:a.hp,maximumHP:a.maximum,ac:s.ac,attack:'+'+s.attackBonus+' to hit, '+s.count+'d'+s.die+(s.bonus?'+'+s.bonus:'')+' '+s.type.toLowerCase()};})};}
  if(context.world){context.world.canAmbush=game.stage==='wild'&&!game.wildFight&&!game.pendingSpell&&(health?.current??1)>0;context.world.creatureTemplates=allFoeTemplates().map(f=>({template:f.key,example:f.group?f.group.count+' '+f.group.plural:f.foe,kind:f.species,pack:!!f.group,signatureMove:signatureMoves[f.key].name}));context.world.knownPlaces=context.world.knownPlaces.map(p=>{const w=worldPlace(game,p.id);return w?{...p,danger:w.danger??'safe',feature:w.feature??null,threat:w.threat?{name:w.threat.name,template:w.threat.template}:null,cleared:!!w.cleared}:p;});}
  // What the hero carries: gold, draughts, arrows and found things, with prices for trades.
  {const pack=packOf(game,hero);context.inventory={gold:pack.gold,healingDraughts:game.potions??0,arrows:arrowsLeft(game,hero),found:pack.items,priceList};}
  context.foeFate=game.foeFate??null;context.npcFates=game.npcFate??{};context.dying=game.dying??null;context.death=game.death??null;
  const weapons=attackOptions(hero);
  context.attackOptions={mainWeapon:weapons.find(w=>!w.unarmed)?.name??'Unarmed Strike',carried:weapons.filter(w=>!w.unarmed).map(w=>w.name+(w.ranged?' (ranged)':'')),unarmed:'Unarmed Strike'};
  context.actionContract.openingAttack='Questbound house rule: an initiating hostile attack resolves once before initiative. Initiative then determines the first normal turn among surviving participants. Do not narrate a defender acting before that opening strike or roll initiative yourself; use engineResolved in its supplied order.';
  context.encounterInitiative=game.encounterInitiative??null;
  context.nearbyNPCs=npcScene(game).filter(n=>n.present&&n.hp>0).map(n=>({id:n.id,...(lore=>({name:lore?.name??n.name,role:lore?.role??null,voice:lore?.personality??n.response,motive:lore?.motive??null,appearance:lore?.appearance??null,species:lore?.species??null}))(npcLore(game,n.id)),attitude:n.attitude,grudge:n.grudge,bond:n.bond,memories:n.memories.slice(-6),follower:game.followers?.[n.id]??null}));
  context.followers=game.followers??{};
  return context;
}

export function commitDmTurn(hero,game,health,action,conversation,random=Math.random){
  let result=resolveDmTurn(hero,game,health,action,conversation,random);
  if(result.error)return result;
  // How the turn touched people, as the Dungeon Master recorded it (gratitude, offence, a debt or a grudge).
  // A note about someone who died this turn is dropped; the engine has already recorded what a killing means.
  const deeds=(Array.isArray(conversation.relationships)?conversation.relationships:[]).filter(d=>validDeeds([d],result.game));
  if(deeds.length){const applied=applyDeeds(result.game,deeds);result={...result,game:{...applied.game,log:[...applied.lines,...applied.game.log].slice(0,40)},events:[...(result.events??[]),...applied.lines]};}
  // Gold and items the Dungeon Master handed over (or took) in this turn.
  if(conversation.loot){const looted=applyLoot(result.game,hero,conversation.loot);if(looted.error)return {game,health,error:looted.error};result={...result,game:{...looted.game,log:[...looted.lines,...looted.game.log].slice(0,40)},events:[...(result.events??[]),...looted.lines]};}
  // Someone new the Dungeon Master brought into the scene, where the turn left the player; the lines this reply gives
  // them (speaker "new") are theirs. The turn's playback uses the rewritten conversation.
  if(conversation.introduce){
    const met=introducePerson(result.game,conversation.introduce);if(met.error)return {game,health,error:met.error};
    conversation={...conversation,dialogue:(conversation.dialogue??[]).map(l=>l.speakerId==='new'?{...l,speakerId:met.id}:l)};
    result={...result,game:{...met.game,log:[...met.lines,...met.game.log].slice(0,40)},events:[...(result.events??[]),...met.lines],conversation,introduced:met.id};
  }
  const present=npcScene(result.game).filter(n=>n.present&&n.hp>0).map(n=>n.id);
  if((conversation.dialogue??[]).some(line=>!present.includes(line.speakerId)))return {game,health,error:'The reply included a character who cannot join this conversation.'};
  return result;
}
function resolveDmTurn(hero,game,health,action,conversation,random){
  if(!conversation||typeof conversation.question!=='string'||!conversation.question.trim()||conversation.question.length>1000||typeof conversation.narration!=='string'||!conversation.narration.trim()||conversation.narration.length>1800)return {game,health,error:'Invalid DM conversation.'};
  if(conversation.worldEvent!==undefined&&conversation.worldEvent!==null&&(typeof conversation.worldEvent!=='string'||!conversation.worldEvent.trim()||conversation.worldEvent.length>800))return {game,health,error:'Invalid world event.'};
  const dialogue=conversation.dialogue??[],present=[...npcScene(game).map(n=>n.id),...(conversation.introduce?['new']:[])];
  if(!Array.isArray(dialogue)||dialogue.length>4||dialogue.some(line=>!line||!present.includes(line.speakerId)||typeof line.text!=='string'||!line.text.trim()||line.text.length>700))return {game,health,error:'The reply included a character who cannot join this conversation.'};
  if(dialogue.length)conversation={...conversation,narration:dialogue.map(line=>(line.speakerId==='new'?String(conversation.introduce.name):npcLore(game,line.speakerId)?.name??npcScene(game).find(n=>n.id===line.speakerId).name)+': '+line.text).join('\n').slice(0,1800)};
  if(action?.type==='recruitment'){
    const result=resolveRecruitment(hero,game,health,action.plans,conversation.question,conversation.npcId??null,random);
    if(result.error)return result;
    return {...result,game:{...result.game,journal:appendJournal(journalForGame(result.game),'note','AI DM conversation','Player: '+conversation.question+'\nDungeon Master: '+conversation.narration)}};
  }
  if(action?.type==='ai-check')return commitWorldCheck(hero,game,health,action.check,conversation,random);
  const command=dmCommand(hero,game,conversation.normalizedCommand??conversation.question,health);
  const commandMatches=command?.action&&JSON.stringify(command.action)===JSON.stringify(action);
  // A newly revealed place is checked by the map rules themselves.
  if(action!==null&&!['ai-spell','ai-ruling','discover','ambush'].includes(action?.type)&&!commandMatches&&!dmChoices(hero,game).some(c=>JSON.stringify(c.action)===JSON.stringify(action)))return {game,health,error:'That DM action is no longer available.'};
  if(action?.type==='ai-spell'){
    if(!command?.action||command.action.type!=='spell'||JSON.stringify(command.action.request)!==JSON.stringify(action.request))return {game,health,error:'Invalid spell interpretation.'};
    const prepared=adventureStep(game,health,hero,command.action,random);if(prepared.error)return prepared;
    if(!prepared.waiting)return {game,health,error:'This spell must use its automatic rules.'};
    return commitAiRuling(hero,prepared.game,prepared.health,action.ruling,conversation,random,game,health);
  }
  if(action?.type==='ai-ruling')return commitAiRuling(hero,game,health,action.ruling,conversation,random,game,health);
  // "Knock them out" in the player's own words makes a finishing melee blow leave the target alive.
  const scene=withAttackIntent(game,conversation.trigger?'':conversation.question);
  const result=action===null?{game,health}:adventureStep(scene,health,hero,action,random);
  if(result.error)return {...result,game};
  if(action!==null&&result.game===scene)return {game,health,error:'That action was not applied. Describe a supported action or clarify your intent.'};
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
 const hp={current:health?.current??combatBasics(hero).hp,temp:health?.temp??0},absorbed=Math.min(hp.temp,damage),overflow=Math.max(0,damage-absorbed-hp.current);hp.temp-=absorbed;hp.current=Math.max(0,hp.current-damage+absorbed);
 let next={...game};const maintained=concentrationAfterDamage(hero,next,damage,random);next=maintained.game;
 // A hazard can drop the hero too: they lie dying where it happened.
 const fell=hp.current===0?fallAtZero(next,{overflow,maximum:combatBasics(hero).hp,cause:'Killed by a hazard: '+c.reason,placeName:placeName(next,fallPlace(next))}):null;if(fell)next=fell.game;
 const outcome=success?c.success:c.failure;
 const text=c.reason+': '+c.ability+(c.skill?' ('+c.skill+')':'')+' d20 ['+dice.join(', ')+']'+(modifiers.reliable&&die<10?' → 10 Reliable Talent':'')+' + '+modifiers.abilityBonus+' ability + '+modifiers.trainingBonus+(modifiers.expert?' Expertise':' training')+' = '+total+' vs DC '+c.dc+'. '+(success?'Success. ':'Failure. ')+outcome+(damageDice.length?' Damage ['+damageDice.join(', ')+'] = '+damage+'.':'');
 next.log=[text,...maintained.logs,...(fell?.entries??[]),...game.log].slice(0,40);next.worldFacts=[...(game.worldFacts??[]),outcome].slice(-60);next.journal=appendJournal(appendJournal(journalForGame(next),'ruling','Action check',text),'note','AI DM conversation','Player: '+conversation.question+'\nDungeon Master: '+conversation.narration+'\nResult: '+outcome);
 return {game:next,health:hp,events:[text,...maintained.logs,...(fell?.entries??[])]};
}
