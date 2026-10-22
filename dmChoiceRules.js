// What the Dungeon Master may choose for the player this turn (dmChoices; the screen's chips are built from it too:
// quickActions.js): attacks and throws, journeys and the ways beyond the map (travelChoices, beyondChoices, mapMoves),
// rests, companions' orders, and the list kept to thirty (offeredChoices).
import {questState} from "./storyRules";
import {standingOffers,maxFollowing,followerPlace} from "./followerRules";
import {npcScene,npcMaxHP,npcLore,npcServiceError} from "./npcRules";
import {dungeonChoices} from "./dungeonRules";
import {shortRestLimit} from "./classActions";
import {subclassShortRecharge} from "./subclassRules";
import {mapLocation,knownPlaceIds,travelError,travelRoute,regionOfPlace,placeName,beyondWords,beyondBearings,beyondError,mapState} from "./mapRules";
import {campaignState,interactionOptions} from "./campaignRules";
import {attackOptions,canThrow} from "./weaponRules";
import {unarmedDC,withinGrip,creatureSize,grappledBy,markOf} from "./masteryRules";
import {revivalOptions,revivalSpell,partyRevivalError} from "./deathRules";
import {gearedHero} from "./inventoryRules";
import {packMagic,lootError,carriedDraughts} from "./lootRules";
import {livingAllies} from "./encounterRules";
import {combatBasics} from "./combatRules";
import {bonusChoices,brawlBonusChoices,brawlFeatChoices,sustainActions,featChoices} from "./turnResourceRules";
import {partyOthers} from "./dmContext";
import {bossOpen,isStaged,leadOpenNow,stagingChoices,stagingAdvanceOpen} from "./stagingRules";
// Up to three carried weapons (main weapon first), then bare hands: the attacks a sentence can turn into.
const attackChoices=hero=>{const all=attackOptions(hero);return [...all.filter(w=>!w.unarmed).slice(0,3),...all.filter(w=>w.unarmed)];};
// Weapons the hero can throw right now (a dagger, handaxe, javelin or spear still in hand).
const throwChoices=hero=>attackOptions(hero).filter(canThrow);
// Known places the hero can set out for, nearest first; and the nearest place of every other land on the map, so
// any land the hero has known can be travelled back to.
export function travelChoices(game,limit=8){
  const here=mapLocation(game),scene={...game,stage:game.stage==='victory'?'bridge':game.stage};
  const all=knownPlaceIds(game).filter(id=>id!==here&&!travelError(scene,id)).map(id=>({id,route:travelRoute(scene,mapLocation(scene),id)})).sort((a,b)=>a.route.minutes-b.route.minutes),near=all.slice(0,limit);
  for(const t of all.slice(limit))if(!near.some(n=>regionOfPlace(game,n.id)===regionOfPlace(game,t.id)))near.push(t);
  return near.map(t=>t.id);
}
// Every move the map can send (AdventureMap.js): a journey to any known place a road reaches, and a road beyond the
// edge of the map. The campaign server accepts these too (server-turn.cjs), so every land on the map can be travelled
// back to from its sheet, however far it lies.
export function mapMoves(game){
  if(!game?.story||['combat','dying','dead','defeat','escaped'].includes(game.stage)||game.npcCombat?.active)return [];
  return [...travelChoices(game,Infinity).map(id=>({id:'travel-'+id,label:'Travel to '+placeName(game,id),action:{type:'travel',destination:id}})),...beyondChoices(game).map(b=>({id:'beyond-'+b,label:'Go beyond the map to the '+beyondWords[b]+' (days on the road to a land not yet on any map)',action:{type:'beyond',bearing:b}}))];
}
// The directions in which the hero may go beyond the edge of the map now (mapRules.js beyondError).
export function beyondChoices(game){
  const scene={...game,stage:game.stage==='victory'?'bridge':game.stage};
  return beyondBearings.filter(b=>!beyondError(scene,b));
}
// Short rests: where one can be taken, and how many are left before the next long rest.
export function shortRestsLeft(hero,game){return Math.max(0,shortRestLimit(hero)-(game.shortRests??0));}
// Worth offering: the hero is hurt (health null means full hit points, as everywhere else), a companion is, or a
// short-rest ability is spent. The engine refuses a rest with nothing to recover, so nothing offers one.
function restWouldHelp(hero,game,health){
  if(health&&Number.isFinite(health.current)&&health.current<combatBasics(hero).hp)return true;
  if(hero.class==='Fighter'&&(game.resources?.wind??0)>0)return true;
  if(hero.class==='Fighter'&&(game.resources?.surge??0)>0)return true;
  if(hero.class==='Warlock'&&((game.spellSlotsUsed??[]).some(n=>n>0)||(game.resources?.slots??0)>0))return true;
  if(subclassShortRecharge(hero,game))return true;
  // A companion knocked down (0 HP, not dead) comes round with a rest, so a rest is worth it for them too.
  return npcScene(game).some(n=>game.followers?.[n.id]?.status==='following'&&n.present&&n.fate!=='dead'&&n.hp<npcMaxHP(n.id,game));
}
const canShortRest=(hero,game,health=null)=>['inn','bridge','tower','wild','victory'].includes(game.stage)&&!game.npcCombat?.active&&!game.dungeon?.active&&shortRestsLeft(hero,game)>0&&restWouldHelp(hero,game,health);
// Companions out of a fight: taking up someone's offer to come along (a chip), and orders the Dungeon Master may
// carry out when the player gives them in their own words (wait here, come along again, send word to one elsewhere).
function companionChoices(game){
  const list=[],scene=npcScene(game),name=id=>npcLore(game,id)?.name??scene.find(n=>n.id===id)?.name??id,travelling=Object.values(game.followers??{}).filter(f=>f?.status==='following').length;
  for(const id of standingOffers(game))if(travelling<maxFollowing)list.push({id:'join:'+id,label:'Take '+name(id)+' along: they offered to come with you',action:{type:'accept-offer',id}});
  for(const [id,f] of Object.entries(game.followers??{})){
    const n=scene.find(x=>x.id===id);if(!n||n.fate==='dead')continue;
    if(f.status==='following'&&n.present&&n.hp>0)list.push({id:'follower-wait:'+id,label:name(id)+' waits here: ONLY when the player has told them to stay',action:{type:'follower',id,order:'wait'}});
    if(f.status==='waiting'&&n.hp>0&&n.attitude!=='hostile'&&travelling<maxFollowing)list.push(n.present?{id:'follower-resume:'+id,label:name(id)+' comes along again: ONLY when the player has asked them to',action:{type:'follower',id,order:'resume'}}:{id:'follower-call:'+id,label:'Send word to '+name(id)+' at '+followerPlace(game,f.location)+' to catch up: ONLY when the player has asked for them',action:{type:'follower',id,order:'call'}});
  }
  return list;
}
export function dmChoices(hero,game,health=null) {
  hero=gearedHero(hero,game);
  // In a party's fight, nothing can be done on someone else's turn (partyTurnRules.js keeps the order).
  // (Only passing the turn of a hero whose player has gone, which the screen offers after a wait.)
  {const holder=game.turnOrder?.order?.[game.turnOrder.at]?.id;if(game.party&&holder&&holder!==game.party.lead)return game.party.members[holder]?[{id:'party-pass',label:'Pass the turn of a hero whose player is away',action:{type:'party-pass'}}]:[];}
  // The dead can only be brought back, by a companion at their side who knows how (deathRules.js).
  if(game.stage==='dead')return revivalOptions(game,hero).filter(o=>o.ready&&o.kind==='companion').map(o=>({id:'revive:'+o.id,label:'Ask '+o.name+' to bring you back with '+revivalSpell.name+' (a '+o.cost+' gp diamond)',action:{type:'revive',by:o.id}}));
  if(game.stage==='dying')return [{id:'death-save',label:'Roll a death saving throw',action:'death-save'}];
  if(game.pendingSpell)return [{id:'cancel-spell',label:'Cancel the pending spell',action:{type:'cancel-spell'}}];
  const choices=(game.story?[]:dungeonChoices(game)).map(c=>({...c,action:c.id})),add=(id,label,action=id)=>choices.push({id,label,action});
  // A friend at the table who has just died, while the party is still where they fell.
  for(const m of partyOthers(game))if(m.status==='dead'&&!partyRevivalError(game,hero,m.id,health))add('revive:party:'+m.id,'Cast '+revivalSpell.name+' on '+m.name+' (a 3rd-level slot and a '+revivalSpell.diamond+' gp diamond)',{type:'revive',target:'party:'+m.id});
  const c=campaignState(game),map=mapState(game);
  // The action is spent this turn: a bonus action, or the end of the turn, is all that remains.
  if(game.stage==='combat'&&game.actionUsed){add('end-turn','End your turn');for(const [id,label,action] of bonusChoices(hero,game,health))add(id,label,action);return choices;}
  // A written tale's foe is held back to its chapter (stagingRules.js bossOpen): no attack on it at the stronghold before.
  // Never in a brawl there: the people fighting come first (the engine would leave the foe untouched).
  if(game.stage==='bridge'&&game.enemyHP>0&&bossOpen(game)&&!game.npcCombat?.active){for(const w of attackChoices(hero))add('encounter-attack:'+w.name,'Attack '+(game.story?.foe??'Lantern Wisp')+' with '+w.name,{type:'encounter-attack',weapon:w.name});for(const w of throwChoices(hero))add('encounter-throw:'+w.name,'Throw '+w.name+' at '+(game.story?.foe??'Lantern Wisp'),{type:'encounter-attack',weapon:w.name,thrown:true});}
  // Anyone present and not dead can be attacked; someone lying unconscious can be finished off.
  const victims=npcScene(game).filter(n=>n.present&&n.fate!=='dead');
  // An Unarmed Strike can grapple or shove (prone) a creature no more than one size larger than the hero.
  const addUnarmed=()=>{
    const dc=unarmedDC(hero);
    for(const key of ['foe',...livingAllies(game).map(a=>'ally:'+a.index)]){
      if(!withinGrip(hero,creatureSize(game,key)))continue;
      const name=key==='foe'?(game.wildFight?.name??game.story?.foe??(game.dungeon?.active?'the guardian':'the wisp')):'the '+game.foeAllies[Number(key.slice(5))].name,ally=key!=='foe'?':'+key.slice(5):'';
      if(!grappledBy(game,key,health))add((ally?'ally-':'')+'grapple'+ally,'Grapple '+name+' (an Unarmed Strike: it saves against DC '+dc+' or is held)',ally?{type:'encounter-attack',weapon:'Unarmed Strike',target:key,unarmed:'grapple'}:'grapple');
      if(!markOf(game,key).prone)add((ally?'ally-':'')+'shove'+ally,'Shove '+name+' to the ground (an Unarmed Strike: it saves against DC '+dc+' or falls prone)',ally?{type:'encounter-attack',weapon:'Unarmed Strike',target:key,unarmed:'shove'}:'shove');
    }
  };
  const addPersonUnarmed=npc=>{if(npc.hp<=0)return;const dc=unarmedDC(hero),name=npcLore(game,npc.id)?.name??npc.name;if(!grappledBy(game,npc.id,health))add('npc-grapple:'+npc.id,'Grapple '+name+' (an Unarmed Strike: they save against DC '+dc+' or are held)',{type:'npc-attack',target:npc.id,weapon:'Unarmed Strike',unarmed:'grapple'});if(!markOf(game,npc.id).prone)add('npc-shove:'+npc.id,'Shove '+name+' to the ground (an Unarmed Strike: they save against DC '+dc+' or fall prone)',{type:'npc-attack',target:npc.id,weapon:'Unarmed Strike',unarmed:'shove'});};
  // A Wand of Magic Missiles with charges left: an action, at the foe or the creature beside it.
  const addMagicItems=()=>{if(!packMagic(game,'wand-of-magic-missiles')||game.surged)return;add('item:wand-of-magic-missiles','Use the Wand of Magic Missiles on '+(game.wildFight?.name??game.story?.foe??'the foe')+' (an action: three darts of force that never miss)');for(const a of livingAllies(game))add('ally-item:'+a.index+':wand-of-magic-missiles','Use the Wand of Magic Missiles on the '+a.name,{type:'use-item',id:'wand-of-magic-missiles',target:'ally:'+a.index});};
  // A healing draught can be given to anyone here who is hurt (and brings round someone lying senseless).
  const addPotionGifts=()=>{if((game.potions??0)>0){for(const n of victims)if((game.npcHP?.[n.id]??npcMaxHP(n.id,game))<npcMaxHP(n.id,game))add('give-potion:'+n.id,'Give '+(npcLore(game,n.id)?.name??n.name)+' a healing draught',{type:'give-potion',target:n.id});
   // Another player's hero who is hurt or has fallen (a party at the shared table).
   for(const m of partyOthers(game))if(m.status!=='dead'&&(m.status==='down'||m.hp<m.maxHp))add('give-potion:party:'+m.id,'Give '+m.name+' a healing draught',{type:'give-potion',target:'party:'+m.id});}};
  if(game.story){
    if(['inn','bridge','tower','wild'].includes(game.stage))for(const npc of victims){for(const w of attackChoices(hero))add('npc-attack:'+npc.id+':'+w.name,'Attack '+(npcLore(game,npc.id)?.name??npc.name)+' with '+w.name,{type:'npc-attack',target:npc.id,weapon:w.name});for(const w of throwChoices(hero))add('npc-throw:'+npc.id+':'+w.name,'Throw '+w.name+' at '+(npcLore(game,npc.id)?.name??npc.name),{type:'npc-attack',target:npc.id,weapon:w.name,thrown:true});addPersonUnarmed(npc);}
    if(game.npcCombat?.active){for(const id of ['dodge','flee','wait','surrender'])add('npc-'+id,id);for(const [id,label,action] of brawlBonusChoices(hero,game,health))add(id,label,action);for(const [id,label,action] of brawlFeatChoices(hero,game))add(id,label,action);for(const [id,label,action] of sustainActions(game))add(id,label,action);return choices;}
    if(game.stage==='combat'){for(const w of attackOptions(hero))add('attack:'+w.name,'Attack with '+w.name);for(const w of throwChoices(hero))add('throw:'+w.name,'Throw '+w.name);for(const a of livingAllies(game)){for(const w of attackChoices(hero))add('ally-attack:'+a.index+':'+w.name,'Attack the '+a.name+' with '+w.name,{type:'encounter-attack',weapon:w.name,target:'ally:'+a.index});for(const w of throwChoices(hero))add('ally-throw:'+a.index+':'+w.name,'Throw '+w.name+' at the '+a.name,{type:'encounter-attack',weapon:w.name,target:'ally:'+a.index,thrown:true});}addUnarmed();addMagicItems();for(const [id,label] of featChoices(hero,game))add(id,label);for(const [id,label,action] of sustainActions(game))add(id,label,action);for(const id of ['dodge','flee'])add(id,id);for(const [id,label,action] of bonusChoices(hero,game,health))add(id,label,action);add('end-turn','End your turn without acting');}
    else if(!['defeat','escaped'].includes(game.stage)){for(const id of travelChoices(game))add('travel-'+id,'Travel to '+placeName(game,id),{type:'travel',destination:id});for(const b of beyondChoices(game))add('beyond-'+b,'Go beyond the map to the '+beyondWords[b]+' (days on the road to a land not yet on any map)',{type:'beyond',bearing:b});if(game.stage==='bridge'&&game.enemyHP>0&&bossOpen(game))add('approach','Confront '+game.story.foe);if(canShortRest(hero,game,health))add('short-rest','Take a short rest ('+shortRestsLeft(hero,game)+' left): regain half your HP');if(game.stage==='inn'&&!npcServiceError(game,'long-rest'))add('long-rest','Rest safely if the residents permit');if((game.potions??0)>0&&!!health&&health.current<combatBasics(hero).hp)add('potion','Drink a healing draught');addPotionGifts();
      // Searching the fallen (and any lair) that lie here; and stronger draughts when hurt.
      if(!lootError(game,health))add('loot','Search the fallen and anything they guarded',{type:'loot'});
      for(const c of companionChoices(game))add(c.id,c.label,c.action);
      if(!health||health.current<combatBasics(hero).hp)for(const d of carriedDraughts(game))add('drink:'+d.magic.id,'Drink a '+d.name);
      // The tale: the chapter under way gives place to the next (or, in the last one, the story ends), and each open lead can be closed.
      // A written tale (stagingRules.js) ends where the engine finds it ends, takes only leads already open, and offers
      // each option of a choice that is open (never a chip): the player commits, the Dungeon Master selects it.
      if(game.story.status==='active'){const q=questState(game),staged=isStaged(game);
        // A written tale's chapter is closed by the Dungeon Master only once its set piece and choice are behind the player.
        if(q.current&&!q.last&&(!staged||stagingAdvanceOpen(game)))add('story-advance','Chapter '+q.number+' ("'+q.current.title.slice(0,50)+'") is done: its truth found where the goal points, told in this reply (never before)');
        else if(!staged)add('story-complete','Conclude the adventure ONLY when the story resolution conditions have actually been achieved');
        for(const l of q.openLeads)if(leadOpenNow(game,l.id))add('lead-done:'+l.id,'Lead seen through ("'+l.title.slice(0,60)+'"): ONLY when the player has actually resolved it',{type:'lead-done',id:l.id});
        for(const c of stagingChoices(hero,game,health))add(c.id,c.label,c.action);}}
    return choices;
  }
  if(game.stage==='inn')for(const npc of victims)for(const w of attackChoices(hero))add('npc-attack:'+npc.id+':'+w.name,'Attack '+npc.name+' with '+w.name,{type:'npc-attack',target:npc.id,weapon:w.name});
  if(game.npcCombat?.active){
    for(const id of ['dodge','flee','wait','surrender'])add('npc-'+id,id[0].toUpperCase()+id.slice(1));
    for(const [id,label,action] of sustainActions(game))add(id,label,action);
    for(const [id,label,action] of brawlBonusChoices(hero,game,health))add(id,label,action);
    for(const [id,label,action] of brawlFeatChoices(hero,game))add(id,label,action);
    return choices;
  }
  if(game.concentration)add('end-concentration','End concentration',{type:'end-concentration'});
  if(game.stage==='inn'&&!map.accepted)add('study','Study the lantern, accept the quest, and depart for the bridge');
  for(const [id,stage,label] of [['persuade-keeper','inn','Persuade the keeper for a watchtower lead: Charisma DC 10'],['investigate-signal','tower','Decipher the tower signal: Intelligence DC 10']])if(game.stage===stage&&!(game.dmChecks??[]).includes(id)&&!(id==='investigate-signal'&&map.clue))add('check:'+id,label);
  for(const option of interactionOptions(game))add(option.id,option.label);
  if(game.stage!=='combat'&&!game.dungeon?.active)for(const c of companionChoices(game))add(c.id,c.label,c.action);
  if(['inn','bridge','tower'].includes(game.stage)&&(map.accepted||Object.keys(game.npcMemory??{}).length>0))for(const id of ['inn','bridge','tower'])if(id!==game.stage)add('travel-'+id,'Travel to '+id,{type:'travel',destination:id});
  if(canShortRest(hero,game,health))add('short-rest','Take a short rest ('+shortRestsLeft(hero,game)+' left): regain half your HP');
  if(game.stage==='inn'){add('long-rest','Take a long rest');if(!map.accepted)add('listen','Accept the keeper’s quest');}
  if(game.stage==='tower'&&!map.clue)add('inspect-tower','Read the carved signal');
  if(game.stage==='bridge'&&game.enemyHP>0){add('approach','Approach the wisp');if(map.clue)add('call-wisp','Call the wisp home peacefully');}
  if(game.stage==='combat'){
    for(const w of attackOptions(hero))add('attack:'+w.name,'Attack with '+w.name);
    for(const w of throwChoices(hero))add('throw:'+w.name,'Throw '+w.name);
    addUnarmed();
    for(const [id,label] of featChoices(hero,game))add(id,label);
    for(const [id,label,action] of sustainActions(game))add(id,label,action);
    add('dodge','Dodge');add('flee','Retreat');for(const [id,label,action] of bonusChoices(hero,game,health))add(id,label,action);
    add('end-turn','End your turn without acting');
  }
  if(['victory','bridge'].includes(game.stage)&&game.enemyHP===0&&!c.bridgeReward)add('claim-reward','Claim 20 GP reward');
  if(['inn','victory'].includes(game.stage)&&c.bridgeReward&&c.lensQuest==='locked')add('start-lens','Accept the missing lens quest');
  if(game.stage==='tower'&&c.lensQuest==='active')add('find-lens','Recover the signal lens');
  if(game.stage==='inn'&&c.lensQuest==='found')add('deliver-lens','Deliver the signal lens');
  return choices.filter(c=>!npcServiceError(game,c.action));
}
// The Dungeon Master is offered at most thirty choices. With a crowd present, attacks on bystanders keep one weapon
// each, then the farthest journeys go (the map still lists every place); the tale's own choices are never dropped.
export function offeredChoices(list,limit=30){
  if(list.length<=limit)return list;
  const armed=new Set();
  let kept=list.filter(c=>{if(c.id.startsWith('npc-throw:'))return false;if(!c.id.startsWith('npc-attack:'))return true;const who=c.id.split(':')[1];if(armed.has(who))return false;armed.add(who);return true;});
  for(const drop of ['npc-shove:','npc-grapple:','ally-shove:','ally-grapple:','ally-throw:','encounter-throw:','beyond-','travel-','give-potion:','npc-attack:'])while(kept.length>limit){const i=kept.map(c=>c.id.startsWith(drop)).lastIndexOf(true);if(i<0)break;kept=kept.filter((c,n)=>n!==i);}
  // Past the limit the last of the rest give way, never the tale's own choices.
  const own=c=>/^(?:story-|lead-done:|tale-choice:)/.test(c.id);
  while(kept.length>limit){const i=kept.map(c=>!own(c)).lastIndexOf(true);if(i<0)break;kept=kept.filter((c,n)=>n!==i);}
  return kept.slice(0,limit);
}
