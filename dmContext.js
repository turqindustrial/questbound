import {resolveRecruitment,standingOffers} from './followerRules';
import {skillAbilities,skillCheckBonus} from './skillRules';
import {npcScene,npcLore,npcIdsOf,npcProfile,npcMaxHP} from './npcRules';
import {modifier,proficiencyBonus,currentSubclass,heroSpecies,speciesProfile} from './characterRules';
import {concentrationAfterDamage} from './spellRules';
import {dungeonRooms} from './dungeonRules';
import {knownSpells,spellCostOptions,automaticEffects,spellAbility} from './spellRules';
import {dmCommand} from './dmCommands';
import {adventureStep,encounterFoe} from './adventureRules';
import {appendJournal,journalForGame} from './journalRules';
import {memoryBlock,rememberFacts} from './memoryRules';
import {shortRestLimit,surgeLimit,turnLeft} from './classActions';
import {subclassBriefs} from './subclassRules';
import {mapState,mapLocation,travelRoute,knownPlaceIds,placeName,worldPlace} from './mapRules';
import {campaignState,earnedGold} from './campaignRules';
import {attackOptions,readyLoadout,attacksPerAction,shieldSlung,shieldInUse,shieldStowed} from './weaponRules';
import {masteryOf,masteredWeapons,masteryText,unarmedDC} from './masteryRules';
import {fallAtZero,fallPlace} from './deathRules';
import {withAttackIntent} from './dmCommands';
import {validDeeds,applyDeeds,introducePerson,speciesRegard,regardSway} from './relationshipRules';
import {gearedHero,packOf,arrowsLeft,applyLoot,priceList} from './inventoryRules';
import {spoilsHere,magicItems,magicSummary,magicCheckMode} from './lootRules';
import {foeLabel,foeKind,signatureMoves,heroConditions,fightingCompanions,allFoeTemplates,livingAllies,allyStats,turnOrderView} from './encounterRules';
import {foeTemplate} from './encounterRules';
const spoilSpecies=key=>foeTemplate(key)?.species??null;
import {combatBasics} from './combatRules';
import {heroXp,xpForLevel} from './experienceRules';
import {spellDamageMax} from "./spellDamageRules";
import {guidanceBonus} from "./spellBuffRules";
import {mapMoves,shortRestsLeft,dmChoices,offeredChoices} from "./dmChoiceRules";
import {briefText,skillLine,withNamedJourneys,storyWorld} from "./dmSceneRules";
import {stagingObjective} from "./stagingRules";
// The other players' heroes in a party at the shared table (partyRules.js): who they are and how they stand, never
// what they will do (their own players decide that).
export function partyOthers(game){
  const p=game?.party;if(!p?.members||typeof p.lead!=='string')return [];
  return Object.entries(p.members).filter(([id])=>id!==p.lead).map(([id,m])=>{let h={};try{h=JSON.parse(m.character)??{};}catch{}const maxHp=m.stats?.hp??1,hp=m.status==='up'?(m.health?.current??maxHp):0;return {id,name:h.name??'A hero',species:h.species||h.race?heroSpecies(h):null,heroClass:h.class??null,level:h.level??1,description:typeof h.description==='string'?h.description.slice(0,240):null,status:m.status,hp,maxHp};});
}
// input: the player's words, when known (a journey they name is offered: withNamedJourneys).
export function dmContext(hero,game,health,input='') {
  hero=gearedHero(hero,game);
  const context={npcCombat:game.npcCombat??null,skillChecks:Object.entries(skillAbilities).map(([skill,ability])=>skillLine(skillCheckBonus(hero,game,ability,skill))),npcSocialState:npcScene(game),resolvedActionEvents:(game.actionEvents??[]).slice(-8),actionContract:{actions: 'Use choices for supported attacks, abilities and travel; castCommand for spells; check for uncertain noncombat attempts; all other mechanical actions require clarification. Never invent an action ID.',movement:game.story?'Known places are reached with their travel choices (travelRoutes). Going anywhere new (a direction, a landmark, a rumoured place) is fully supported: reveal it with discovery and travel true, as described under OPEN WORLD. Precise tactical positioning and opportunity attacks are not implemented.':'Only supplied travelRoutes and dungeon choices are implemented. Precise tactical positioning and opportunity attacks are not implemented.',witnesses:'Only NPCs present and conscious witness attacks. Recorded npcCombat contains actual initiative and sides. NPC attacks and defender help resolve in the engine after player turns; narrate those results without inventing additional damage. Distant acquaintances learn nothing until informed. Recorded NPC memories override contradictory story notes.'},encounter:game.stage==='combat'?{...encounterFoe(hero,game),currentHP:game.enemyHP,distance:game.castingConditions?.targetDistance??5,clearPath:game.castingConditions?.clearPath!==false}:null,turnResources:{actionUsed:!!game.actionUsed,bonusActionUsed:!!game.bonusUsed,reactionUsed:!!game.reactionUsed,spellSlotSpentThisTurn:!!game.slotSpentThisTurn,left:turnLeft(hero,game),attacksPerAction:attacksPerAction(hero),actionSurge:surgeLimit(hero)>0?{left:surgeLimit(hero)-(game.resources?.surge??0),usedThisTurn:!!game.surged}:null},shortRests:{left:shortRestsLeft(hero,game),of:shortRestLimit(hero)},spellSaveDC:8+proficiencyBonus(hero.level)+modifier(hero.scores[spellAbility[hero.class]]??10),spellAttackBonus:proficiencyBonus(hero.level)+modifier(hero.scores[spellAbility[hero.class]]??10),npcDefenses:Object.fromEntries((game.stage==='combat'||game.npcCombat?.active||game.pendingSpell?npcIdsOf(game):npcScene(game).filter(n=>n.present).map(n=>n.id)).map(id=>[id,{ac:npcProfile(game,id).ac,saveModifiers:0}])),castingConditions:game.castingConditions??{},equipment:hero.equipment,loadout:readyLoadout(hero),loadoutGuidance:'Use the class loadout mainWeapon for an unspecified close-range attack. Explicitly named weapons take priority. Only owned gear is available. The focus is available for eligible material components; it does not waive costly or consumed components or hand requirements. Ranged attacks are bow shots (each spends an arrow) and throws of a dagger, handaxe, javelin or spear (throw: choices; the weapon is gathered up after the fight); both have disadvantage once the foe is within 5 feet. Use only supplied choices.',worldFacts:(game.worldFacts??[]).slice(-8).map(t=>briefText(t,300)),npcHP:{...Object.fromEntries(npcIdsOf(game).map(id=>[id,npcMaxHP(id,game)])),...game.npcHP},dungeon:game.dungeon?.active?{room:dungeonRooms[game.dungeon.room].name,description:dungeonRooms[game.dungeon.room].text,complete:game.dungeon.complete}:null,travelRoutes:(game.story?knownPlaceIds(game):['inn','bridge','tower']).filter(id=>id!==mapLocation(game)).map(id=>({destination:id,name:placeName(game,id),...travelRoute(game,mapLocation(game),id)})).filter(r=>Number.isFinite(r.feet)),castingHelp:'Cast through Send to DM: I cast [spell] on [target]. The game automatically checks casting requirements. Add level N slot for upcasting. You may adjudicate pending spells using the provided spell description and recorded scene. Do not direct players to casting buttons.',spellReference:knownSpells(hero).map(spell=>({name:spell.name,components:spell.components,material:spell.material,level:spell.level,castingTime:spell.castingTime,range:spell.range,availableCosts:spellCostOptions(hero,game,spell)})),nearbyNPCs:game.dungeon?.active?(game.stage==='combat'?[{name:dungeonRooms[game.dungeon.room].foe,voice:'An ancient guardian; speak in terse solemn warnings.'}]:[]):game.stage==='inn'?[{name:'The keeper',voice:'Practical, warm, worried about travelers; never promises unearned rewards.'},{name:'Mara',voice:'A thoughtful traveling medicine courier; knows the road, not undiscovered tower secrets.'}]:['bridge','combat'].includes(game.stage)?[{name:'Lantern Wisp',voice:'Flickers and wordless musical tones; only call it Ember if the logbook was read.'}]:[],conversationHistory:(game.journal?.entries??[]).filter(e=>e.title==='AI DM conversation').slice(-6).map(e=>({...e,text:briefText(e.text,1000)})),player:{age:hero.age,backstory:hero.backstory,connections:hero.connections,description:hero.description,name:hero.name,species:heroSpecies(hero),speciesTraits:(p=>({size:p.size,speed:combatBasics(hero).speed??p.speed,darkvision:p.darkvision,traits:p.traits.map(t=>t.name+': '+t.brief+(t.played==='game'?' (applied by the game)':''))}))(speciesProfile(hero)),subclass:currentSubclass(hero.plannedSubclass),subclassFeatures:subclassBriefs(hero),background:hero.background,class:hero.class,level:hero.level,scores:hero.scores,spells:hero.spells??[],health:health??{current:combatBasics(hero).hp,temp:0}},stage:game.stage,map:mapState(game),campaign:campaignState(game),earnedGold:earnedGold(game),enemyHP:game.enemyHP,spellSlotsUsed:game.spellSlotsUsed??[],pendingSpell:game.pendingSpell?{...game.pendingSpell,engineDamage:!!game.pendingSpell.npcTarget&&!!['attack','save','missile','inflict','trueStrike'].some(k=>automaticEffects[game.pendingSpell.id]?.[k]),damageMost:spellDamageMax(hero,knownSpells(hero).find(s=>s.id===game.pendingSpell.id),game.pendingSpell.slot),spell:knownSpells(hero).find(s=>s.id===game.pendingSpell.id)}:null,concentration:game.concentration??null,recentEvents:game.log.slice(0,8),journal:(game.journal?.entries??[]).filter(e=>e.title!=='AI DM conversation').slice(-6).map(e=>({...e,text:briefText(e.text,500)})),choices:offeredChoices(dmChoices(hero,game,health)).map(({id,label})=>({id,label}))};
  context.choices=withNamedJourneys(context.choices,game,input);
  // A level earned and not yet taken: the player takes it with the Level up button. No experience numbers are sent.
  if((hero.level??1)<20&&heroXp(game,hero)>=xpForLevel((hero.level??1)+1))context.levelReady=true;
  if(game.story)storyWorld(context,hero,game,health,input);
  // Fates: who has died, how the main foe ended, and whether the hero is dying or dead.
  if(context.encounter){const kind=foeKind(game);context.encounter={...context.encounter,signatureMove:kind?signatureMoves[kind]:null,yourCondition:game.heroCondition?heroConditions[game.heroCondition]:null,companionsFighting:fightingCompanions(game).map(n=>npcLore(game,n.id)?.name??n.name),wildCreature:!!game.wildFight,appearance:game.wildFight?.appearance??game.story?.foeAppearance??null,
    alsoFighting:livingAllies(game).map(a=>{const s=allyStats(game,a.index,hero.level??1);return {name:a.name,kind:a.template,appearance:a.appearance,currentHP:a.hp,maximumHP:a.maximum,ac:s.ac,attack:'+'+s.attackBonus+' to hit, '+s.count+'d'+s.die+(s.bonus?'+'+s.bonus:'')+' '+s.type.toLowerCase()};})};
   // A written tale's set piece or its boss fight: what the fight is for (stagingRules.js stagingObjective).
   const objective=stagingObjective(game);if(objective)context.encounter.objective=objective;}
  {const others=partyOthers(game);if(others.length)context.party=others.map(m=>({name:m.name,species:m.species,class:m.heroClass,level:m.level,appearance:m.description,condition:m.status==='dead'?'dead':m.status==='down'?'down and dying':m.hp>=m.maxHp?'unhurt':m.hp>m.maxHp/2?'wounded':'badly wounded'}));}
  // A party's fight goes in turns: who acts in what order, and whose turn it is.
  {const turns=turnOrderView(game);if(turns)context.turnOrder={round:turns.round,order:turns.entries.map(e=>e.name+(e.kind==='hero'&&e.status!=='up'?' ('+e.status+')':'')),current:turns.current?.name??null,yourTurn:turns.mine};}
  if(context.world){context.world.canAmbush=game.stage==='wild'&&!game.wildFight&&!game.pendingSpell&&(health?.current??1)>0;context.world.creatureTemplates=allFoeTemplates().map(f=>({template:f.key,example:f.group?f.group.count+' '+f.group.plural:f.foe,kind:f.species,pack:!!f.group,signatureMove:signatureMoves[f.key].name}));context.world.knownPlaces=context.world.knownPlaces.map(p=>{const w=worldPlace(game,p.id);return w&&p.description!==undefined?{...p,danger:w.danger??'safe',...(w.feature?{feature:w.feature}:{}),...(w.threat?{threat:{name:w.threat.name,template:w.threat.template}}:{}),...(w.cleared?{cleared:true}:{})}:p;});}
  // What the hero carries: gold, draughts, arrows and found things, with prices for trades.
  // Magic items carry what they are and do (the catalogue's words), so the telling never invents powers.
  {const pack=packOf(game,hero);context.inventory={gold:pack.gold,healingDraughts:game.potions??0,arrows:arrowsLeft(game,hero),found:pack.items.map(i=>i.magic&&magicItems[i.magic.id]?{...i,magic:{name:magicItems[i.magic.id].name,rarity:magicItems[i.magic.id].rarity,effect:magicSummary(i),...(magicItems[i.magic.id].attune?{attuned:!!i.attuned}:{})}}:i),priceList};}
  // The fallen (and lairs) here not yet searched: the game decides what they hold (the loot choice).
  {const here=spoilsHere(game);if(here.length)context.spoils=here.map(s=>({name:s.name,kind:s.kind,what:s.kind==='person'?npcLore(game,s.person)?.role??null:s.template?spoilSpecies(s.template):null,lair:!!s.lair,feature:s.feature??null}));}
  context.foeFate=game.foeFate??null;context.npcFates=game.npcFate??{};context.dying=game.dying??null;context.death=game.death??null;
  const weapons=attackOptions(hero);
  context.attackOptions={mainWeapon:weapons.find(w=>!w.unarmed)?.name??'Unarmed Strike',carried:weapons.filter(w=>!w.unarmed).map(w=>w.name+(w.ranged?' (ranged)':w.twoHands?' (two-handed)':w.versatile?(w.grip==='two'?' (versatile, in both hands: 1d'+w.die+')':' (versatile, one-handed beside the shield)'):'')),unarmed:'Unarmed Strike',
    // Weapon Mastery (2024 rules): the engine applies these on its own; narrate them as the engine's lines say.
    masteries:masteredWeapons(hero).map(name=>{const w=weapons.find(o=>(o.base??o.name)===name);return name+': '+(w?masteryText[masteryOf(hero,w)]:'');}),
    grappleAndShove:'An Unarmed Strike can grapple or shove a creature prone instead of striking (the grapple and shove choices); it saves against DC '+unarmedDC(hero)+'.',
    twoWeapons:'After an attack with a light weapon, a second light weapon in the other hand can strike as a bonus action (the offhand: choices).',
    hands:shieldStowed(hero)?'The player has put the shield on the hero’s back to keep both hands free (a versatile weapon in both hands for its larger die): it adds nothing to armor class until they take it up again (the game does that when they say so; in a fight it takes their action).':shieldSlung(hero)?'The shield is slung on the hero’s back while both hands hold a two-handed weapon: it adds nothing to armor class.':shieldInUse(hero)?'A shield on one arm: two-handed weapons stay on the back until the player takes one in hand; the player may put the shield on their back to hold a versatile weapon in both hands (the game does that when they say so; in a fight it takes their action).':'No shield: a versatile weapon is held in both hands for its larger die.'};
  // How the creatures in this fight stand: prone, grappled, or sapped (disadvantage on their next attack).
  if(game.marks)context.fightConditions=Object.entries(game.marks).map(([k,m])=>({who:k==='foe'?foeLabel(game):k.startsWith('ally:')?(game.foeAllies?.[Number(k.slice(5))]?.name??k):(npcLore(game,k)?.name??k),conditions:[m.prone?'prone':null,m.grappled?'grappled':null,m.sapped?'sapped':null,...(m.spells??[]).map(s=>s.cond+' ('+s.id.replace(/-/g,' ')+')')].filter(Boolean)}));
  // Spells that last on the hero without concentration (Mage Armor, Barkskin, Divine Favor, Shillelagh).
  if(game.buffs)context.heroSpellEffects=Object.keys(game.buffs).map(id=>id.replace(/-/g,' '));
  context.actionContract.openingAttack='Questbound house rule: an initiating hostile attack resolves once before initiative. Initiative then determines the first normal turn among surviving participants. Do not narrate a defender acting before that opening strike or roll initiative yourself; use engineResolved in its supplied order.';
  context.encounterInitiative=game.encounterInitiative??null;
  // How each person nearby takes to the hero's kind (kin, warm, curious, wary, scornful), with their reason.
  const kindView=id=>{const r=speciesRegard(game,id,hero);return r.stance==='indifferent'?null:{stance:r.stance,reason:r.reason};};
  context.nearbyNPCs=npcScene(game).filter(n=>n.present&&n.hp>0).map(n=>({id:n.id,...(lore=>({name:lore?.name??n.name,role:lore?.role??null,voice:lore?.personality??n.response,motive:lore?.motive??null,appearance:lore?.appearance?briefText(lore.appearance,200):null,species:lore?.species??null,...(lore?.hook?{hook:briefText(lore.hook,120)}:{})}))(npcLore(game,n.id)),attitude:n.attitude,grudge:n.grudge,bond:n.bond,follower:game.followers?.[n.id]??null,trainedAs:n.trainedAs?n.trainedAs.class+' '+n.trainedAs.level:null,standing:n.standing,regardsYourKind:kindView(n.id)}));
  // Offers to come along that still stand (the player has not yet answered).
  {const offers=standingOffers(game);if(offers.length)context.joinOffers=Object.fromEntries(offers.map(id=>[id,game.joinOffers[id]]));}
  context.followers=game.followers??{};
  // The story so far (memoryRules.js): the chronicle of every tale and chapter, and the facts the Dungeon Master asked
  // the game to remember, fitted to a fixed budget with what bears on this moment first. (The memories of the people
  // here are in npcSocialState.)
  {const block=memoryBlock(game,{input,present:npcScene(game).filter(n=>n.present).map(n=>n.id)});if(block)context.memory=block;}
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
    const met=introducePerson(result.game,conversation.introduce,hero);if(met.error)return {game,health,error:met.error};
    conversation={...conversation,dialogue:(conversation.dialogue??[]).map(l=>l.speakerId==='new'?{...l,speakerId:met.id}:l)};
    result={...result,game:{...met.game,log:[...met.lines,...met.game.log].slice(0,40)},events:[...(result.events??[]),...met.lines],conversation,introduced:met.id};
  }
  // Facts the Dungeon Master asked the game to keep (a promise, a secret, a name, a plan), or one it settled.
  if(Array.isArray(conversation.remember)&&conversation.remember.length)result={...result,game:rememberFacts(result.game,conversation.remember,{newId:result.introduced??null}).game};
  const present=npcScene(result.game).filter(n=>n.present&&n.hp>0).map(n=>n.id);
  if((conversation.dialogue??[]).some(line=>!present.includes(line.speakerId)))return {game,health,error:'The reply included a character who cannot join this conversation.'};
  return result;
}
function resolveDmTurn(hero,game,health,action,conversation,random){
  if(!conversation||typeof conversation.question!=='string'||!conversation.question.trim()||conversation.question.length>1000||typeof conversation.narration!=='string'||!conversation.narration.trim()||conversation.narration.length>1800)return {game,health,error:'Invalid DM conversation.'};
  if(conversation.worldEvent!==undefined&&conversation.worldEvent!==null&&(typeof conversation.worldEvent!=='string'||!conversation.worldEvent.trim()||conversation.worldEvent.length>800))return {game,health,error:'Invalid world event.'};
  // In a party's fight only the hero whose turn it is can act (talking is always free).
  {const holder=game.turnOrder?.order?.[game.turnOrder.at]?.id;if(action!==null&&action?.type!=='party-pass'&&game.party&&holder&&holder!==game.party.lead)return {game,health,error:'It is not your turn in this fight. Wait for your turn.'};}
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
  // A newly revealed place is checked by the map rules themselves; the map's own journeys (mapMoves) are always open.
  if(action!==null&&!['ai-spell','ai-ruling','discover','ambush'].includes(action?.type)&&!commandMatches&&!dmChoices(hero,game,health).some(c=>JSON.stringify(c.action)===JSON.stringify(action))&&!mapMoves(game).some(c=>JSON.stringify(c.action)===JSON.stringify(action)))return {game,health,error:'That DM action is no longer available.'};
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
 // The hero as the rules see them: magic worn counts (a Stone of Good Luck, Boots of Elvenkind).
 const plain=hero;hero=gearedHero(hero,game);
 if(game.pendingSpell)return fail('Resolve the pending spell first.');
 if(game.npcCombat?.active)return fail('Finish the combat turn with an attack, spell, dodge, flee, wait, or surrender.');
 // In a fight an attempt like this is the turn's action (2024 rules): once the action is spent it must wait.
 if(game.stage==='combat'&&game.actionUsed)return fail('Your action is already spent this turn: take a bonus action or end your turn.');
 if(c?.skill!=null&&!Object.hasOwn(skillAbilities,c.skill))return fail('Unknown skill; no action was applied.');
 if(/^(?:I )?(?:attack|stab|strike|slash|cast)\b/i.test(conversation.question.trim()))return fail('An attack or spell must use its own rules, not a general skill check.');
 if((health?.current??1)<=0||game.castingConditions?.incapacitated)return fail('You cannot take this action while incapacitated.');
 if(!c||!['Strength','Dexterity','Constitution','Intelligence','Wisdom','Charisma'].includes(c.ability)||!Number.isInteger(c.dc)||c.dc<5||c.dc>30||!['normal','advantage','disadvantage'].includes(c.mode)||!['reason','success','failure'].every(k=>typeof c[k]==='string'&&c[k].length>0&&c[k].length<=300)||!Number.isInteger(c.damageCount)||c.damageCount<0||c.damageCount>20||![4,6,8,10,12,20].includes(c.damageDie)||!['failure','always','none'].includes(c.damageOn))return fail('Invalid action check.');
 if(game.castingConditions?.handsBound&&['Strength','Dexterity'].includes(c.ability))return fail('Your hands are bound. Describe how you can attempt this action or escape the restraint first.');
 const modifiers=skillCheckBonus(hero,game,c.ability,c.skill??null);
 // Winning someone over with words is easier with those who like the hero's kind and harder with those who do not.
 const sway=['Persuasion','Deception','Performance'].includes(c.skill)?regardSway(game,conversation.npcId??null,hero):{bonus:0,note:''};
 const mode=magicCheckMode(hero,c.skill??null,c.mode);c={...c,mode};
 const dice=Array.from({length:c.mode==='normal'?1:2},()=>1+Math.floor(random()*20)),die=c.mode==='advantage'?Math.max(...dice):Math.min(...dice);
 // Guidance adds 1d4 to the check, and is spent.
 const guide=guidanceBonus(game,random),bonus=modifiers.total+sway.bonus+(guide?.die??0),total=(modifiers.reliable?Math.max(10,die):die)+bonus,success=total>=c.dc;
 const damageDice=(c.damageOn==='always'||(c.damageOn==='failure'&&!success))?Array.from({length:c.damageCount},()=>1+Math.floor(random()*c.damageDie)):[],damage=damageDice.reduce((a,b)=>a+b,0);
 const hp={current:health?.current??combatBasics(hero).hp,temp:health?.temp??0},absorbed=Math.min(hp.temp,damage),overflow=Math.max(0,damage-absorbed-hp.current);hp.temp-=absorbed;hp.current=Math.max(0,hp.current-damage+absorbed);
 let next={...(guide?.game??game)};const maintained=concentrationAfterDamage(hero,next,damage,random);next=maintained.game;
 // A hazard can drop the hero too: they lie dying where it happened.
 const fell=hp.current===0?fallAtZero(next,{overflow,maximum:combatBasics(hero).hp,cause:'Killed by a hazard: '+c.reason,placeName:placeName(next,fallPlace(next)),where:mapLocation(next)}):null;if(fell)next=fell.game;
 const outcome=success?c.success:c.failure;
 const text=c.reason+': '+c.ability+(c.skill?' ('+c.skill+')':'')+' d20 ['+dice.join(', ')+']'+(modifiers.reliable&&die<10?' → 10 Reliable Talent':'')+' + '+modifiers.abilityBonus+' ability + '+modifiers.trainingBonus+(modifiers.expert?' Expertise':' training')+(modifiers.magicBonus?' + '+modifiers.magicBonus+' magic':'')+(sway.bonus?(sway.bonus>0?' + ':' - ')+Math.abs(sway.bonus)+' '+sway.note:'')+(guide?' + '+guide.die+' Guidance':'')+' = '+total+' vs DC '+c.dc+'. '+(success?'Success. ':'Failure. ')+outcome+(damageDice.length?' Damage ['+damageDice.join(', ')+'] = '+damage+'.':'');
 next.log=[text,...maintained.logs,...(fell?.entries??[]),...game.log].slice(0,40);next.worldFacts=[...(game.worldFacts??[]),outcome].slice(-60);next.journal=appendJournal(appendJournal(journalForGame(next),'ruling','Action check',text),'note','AI DM conversation','Player: '+conversation.question+'\nDungeon Master: '+conversation.narration+'\nResult: '+outcome);
 // In a fight the attempt spends the action: the turn waits for a bonus action, or the foe answers (in a party, the
 // turn passes on), exactly as after an attack.
 if(game.stage==='combat'&&next.stage==='combat'&&!fell){
  const turn=adventureStep(next,hp,plain,{type:'improvised'},random);
  if(turn.error)return fail(turn.error);
  return {...turn,events:[text,...maintained.logs,...(turn.events??[])]};
 }
 return {game:next,health:hp,events:[text,...maintained.logs,...(fell?.entries??[])]};
}
