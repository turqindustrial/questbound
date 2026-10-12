import {dmChoices,shortRestsLeft} from './dmContext';
import {knownSpells,automaticEffects,castingStages,spellCostOptions,castableNow,sustainTargets,lastingSpells} from './spellRules';
import {placeName} from './mapRules';
import {weaponIcon} from './iconPaths';
import {combatBasics} from './combatRules';
import {attackOptions,thrownAttack} from './weaponRules';
import {gearedHero,arrowsLeft} from './inventoryRules';
import {foeLabel} from './encounterRules';
import {npcLore} from './npcRules';
import {masteryOf,unarmedDC} from './masteryRules';
import {partyMembers} from './partyRules';
import {dmCommand} from './dmCommands';
import {spoilsHere,magicItems,packMagic} from './lootRules';
import {subclassAction,subclassUsesLeft} from './subclassRules';
// One-tap actions for this moment of the game, drawn from the engine's own list of valid choices. Each one sends a
// plain sentence to the Dungeon Master with the engine action attached, so the rules resolve it and the DM narrates.
// Spells need a target, so "Cast…" starts the sentence in the message box instead. `icon` names a line icon
// (Icon.js); `glyph` is its text fallback.
const verbs={
 dodge:['⛨','Dodge','I take the Dodge action.','shield'],flee:['↩','Retreat','I retreat from the fight.','retreat'],potion:['✚','Potion','I drink a healing draught.','potion'],
 'long-rest':['☾','Long rest','I take a long rest.','rest'],'short-rest':['☾','Short rest','I take a short rest.','camp'],'npc-dodge':['⛨','Dodge','I dodge.','shield'],'npc-flee':['↩','Flee','I flee.','retreat'],'npc-wait':['⧗','Wait','I wait.','wait'],
 'npc-surrender':['⚐','Surrender','I surrender.','flag'],'cancel-spell':['✕','Cancel spell','Cancel spell','close'],'end-concentration':['✕','End concentration','End concentration','close'],
 'class:wind':['✚','Second Wind','I use Second Wind.','heal'],'class:hands':['✚','Lay on Hands','I lay my hands on my wounds.','heal'],'class:strike':['✊','Bonus strike','I follow up with a quick unarmed strike.','fist'],
 'class:surge':['»','Action Surge','I use Action Surge.','bolt'],
};
// In a fight these cost a bonus action, not the action: their chips say so.
const bonusIds=['potion','class:wind','class:hands','class:strike'];
const isBonus=id=>bonusIds.includes(id)||id.startsWith('drink:');
// Free in a fight: they cost neither the action nor the bonus action.
const freeIds=['class:surge'];
export function quickActions(hero,game,health=null){
 // The main weapon leads (gold); backup weapons wait at the end so defence and the potion stay within thumb reach.
 const place=id=>placeName(game,id),primary=[],rest=[],backup=[],last=[];let trips=0;
 const choices=dmChoices(hero,game,health),armed=choices.some(c=>/^(attack|encounter-attack):/.test(c.id)&&!c.id.endsWith(':Unarmed Strike'));
 const fighting=game.stage==='combat';
 for(const c of choices){
  const id=c.id;
  // End turn leads (gold) once the action is spent; before that it waits at the end of the row.
  if(id==='end-turn'){(game.actionUsed?primary:last).push({key:id,glyph:'⧗',icon:'forward',label:'End turn',question:'I end my turn.',action:c.action,primary:!!game.actionUsed});continue;}
  // Attacking townsfolk and declaring the story finished stay deliberate, typed decisions.
  if(/^(npc-attack|story-complete|story-advance|lead-done|restart-adventure)/.test(id))continue;
  // Going beyond the edge of the map is chosen on the map (or asked for in words), never a chip.
  if(id.startsWith('beyond-'))continue;
  // Passing an absent player's turn is offered by the play screen's waiting row, after a wait.
  if(id==='party-pass')continue;
  // Orders to companions are given in words or on the Companions screen; an offer to come along gets a chip.
  if(id.startsWith('follower-'))continue;
  if(id.startsWith('join:')){const name=npcLore(game,c.action.id)?.name??'them',short=name.split(' ').filter(w=>!/^(?:captain|lady|lord|sir|dame|master|mistress|old|elder|brother|sister|father|mother|the)$/i.test(w))[0]??name;primary.push({key:id,glyph:'✚',icon:'party',label:'Take '+short+' along',question:'Yes, '+short+', come with me.',action:c.action,primary:true});continue;}
  // A draught away from a fight is typed or asked for; a companion lying senseless gets a Revive chip.
  if(id==='potion'&&game.stage!=='combat')continue;
  // The creature beside the foe gets one chip, with the main weapon.
  if(id.startsWith('ally-attack:')){const [,index,weapon]=id.split(':'),ally=game.foeAllies?.[Number(index)];if(!ally||(weapon==='Unarmed Strike'&&armed)||primary.concat(rest).some(a=>a.ally===index))continue;rest.unshift({key:id,glyph:'⚔',icon:weapon==='Unarmed Strike'?'fist':weaponIcon(weapon),label:'Hit '+ally.name.split(' ').pop(),question:'I attack the '+ally.name+' with my '+(weapon==='Unarmed Strike'?'bare hands':weapon)+'.',action:c.action,ally:index});continue;}
  // A fallen friend in a party is revived with a draught, like a fallen companion.
  if(id.startsWith('give-potion:party:')){const member=game.party?.members?.[c.action.target.slice(6)];if(member?.status!=='down')continue;const name=c.label.replace(/^Give | a healing draught(?: \(bonus action\))?$/g,'');primary.push({key:id,glyph:'✚',icon:'potion',label:'Revive '+name.split(' ')[0],question:'I give '+name+' a healing draught.',action:c.action});continue;}
  if(id.startsWith('give-potion:')){const target=c.action.target;if((game.npcHP?.[target]??1)>0)continue;const name=game.story?.npcs?.[target]?.name??c.label.replace(/^Give | a healing draught(?: \(bonus action\))?$/g,'');primary.push({key:id,glyph:'✚',icon:'potion',label:'Revive '+name.split(' ').filter(w=>!/^(captain|the|old|young|sir|lady|lord)$/i.test(w))[0],question:'I give '+name+' a healing draught.',action:c.action});continue;}
  // Searching the fallen leads the row right after a win (one chip, however many lie here).
  if(id==='loot'){const n=spoilsHere(game).length;primary.unshift({key:id,glyph:'⚲',icon:'bag',label:'Loot',...(n>1?{detail:String(n)}:{}),question:'I search the fallen for anything of value.',action:c.action,primary:true});continue;}
  // A stronger healing draught from the pack (a bonus action in a fight).
  if(id.startsWith('drink:')){const m=magicItems[id.slice(6)],held=(game.pack?.items??[]).find(i=>i.magic?.id===id.slice(6));if(!m)continue;rest.push({key:id,glyph:'✚',icon:'potion',label:m.name.replace(/^Potion of /,'').replace(/ Healing$/,'')+(held?.qty>1?' ×'+held.qty:''),question:'I drink a '+m.name.toLowerCase().replace(/^potion/,'potion')+'.',action:c.action,...(fighting?{detail:'Bonus'}:{})});continue;}
  // The Wand of Magic Missiles at the foe (at the creature beside it, by typing "I use my wand on …").
  if(id==='item:wand-of-magic-missiles'){const wand=packMagic(game,'wand-of-magic-missiles');rest.unshift({key:id,glyph:'✧',icon:'staff',label:'Wand',detail:(wand?.magic?.charges??0)+' charges',question:'I use my wand of magic missiles.',action:c.action});continue;}
  if(id.startsWith('ally-item:'))continue;
  if(id==='death-save'){primary.push({key:id,glyph:'☠',icon:'skull',label:'Death save',question:'I fight to hold on.',action:c.action,primary:true});continue;}
  // Throws, and attacks with the other weapons, are in the Attack… picker.
  if(/^(throw|encounter-throw|ally-throw|npc-throw):/.test(id)||/^(grapple|shove)$|^(ally|npc)-(grapple|shove):/.test(id))continue;
  // Two-weapon fighting: after a Light weapon's attack, the other hand's (a bonus action, or with Nick part of the action).
  // A lasting spell used again (Spiritual Weapon, Heat Metal, the Flaming Sphere, Moonbeam, Call Lightning, Vampiric
  // Touch), and Hex or Hunter's Mark moved once its creature has dropped: a chip per creature it can reach.
  if(id.startsWith('again:')||id.startsWith('move-mark:')){const move=id.startsWith('move-mark:'),key=id.slice(id.indexOf(':')+1),spellName=knownSpells(hero).find(sp=>sp.id===game.concentration?.id)?.name??'Spell',who=sustainTargets(game).find(t=>t.key===key)?.name??'them',bonus=move||lastingSpells[game.concentration?.id]?.again==='bonus',short=who.replace(/^the /i,'');primary.push({key:id,glyph:'✧',icon:move?'eldritch':'spell',label:spellName,detail:(bonus?'Bonus':'Action')+' · '+short.charAt(0).toUpperCase()+short.slice(1),question:move?'I move '+spellName+' to '+who+'.':'I use '+spellName+' on '+who+'.',action:c.action});continue;}
  if(id.startsWith('offhand:')){const weapon=id.slice(8),nick=/Nick/.test(c.label);primary.push({key:id,glyph:'⚔',icon:weaponIcon(weapon),label:weapon,detail:nick?'Nick':'Bonus',question:'I strike with the '+weapon.toLowerCase()+' in my other hand.',action:c.action,primary:true});continue;}
  // Bare hands get a chip only when there is no weapon to hand; otherwise "I punch him" still works when typed.
  if(/^(attack|encounter-attack):/.test(id)){const weapon=id.split(':').pop();if(weapon==='Unarmed Strike'&&armed)continue;const first=!primary.some(a=>a.weapon);if(!first)continue;(first?primary:backup).push({key:id,glyph:'⚔',icon:weapon==='Unarmed Strike'?'fist':weaponIcon(weapon),label:weapon==='Unarmed Strike'?'Unarmed':weapon,question:weapon==='Unarmed Strike'?'I attack with my bare hands.':'I attack with my '+weapon+'.',action:c.action,primary:first,weapon});continue;}
  if(id==='approach'){primary.push({key:id,glyph:'⚔',icon:'swords',label:c.label,question:'I '+c.label[0].toLowerCase()+c.label.slice(1)+'.',action:c.action,primary:true});continue;}
  // The Lantern Vaults belong to the crossroads; in a written story they are only reached by asking the DM.
  if(id.startsWith('dungeon:')){if(game.story&&id==='dungeon:enter')continue;const [glyph,label,icon]=dungeonLabels(id,c.label);(id==='dungeon:fight'?primary:rest).push({key:id,glyph,icon,label,question:'I '+c.label[0].toLowerCase()+c.label.slice(1)+'.',action:c.action,primary:id==='dungeon:fight'});continue;}
  // The nearest few places get a chip; the Map tab lists every place you know.
  if(id.startsWith('travel-')){const destination=c.action?.destination??id.slice(7);if(game.story&&++trips>4)continue;rest.push({key:id,glyph:'➜',icon:'travel',label:place(destination),question:'I travel to '+place(destination)+'.',action:c.action,destination});continue;}
  // A subclass's own action (subclassRules.js) brings its own chip, with the uses left.
  const feat=subclassAction(hero),own=!!feat&&id==='class:'+feat.id;
  const verb=verbs[id]??(own?feat.chip:null);
  // A short rest comes first for a hero who is hurt (it is what they are looking for); otherwise it waits with the rest.
  if(id==='short-rest'){const chip={key:id,glyph:verb[0],icon:verb[3],label:verb[1],question:verb[2],action:c.action,detail:shortRestsLeft(hero,game)+' left'};if(health&&health.current<combatBasics(hero).hp)rest.unshift(chip);else rest.push(chip);continue;}
  if(own){rest.push({key:id,glyph:verb[0],icon:verb[3],label:verb[1],question:verb[2],action:c.action,detail:(fighting&&feat.bonus?'Bonus · ':'')+subclassUsesLeft(hero,game)+' left'});continue;}
  if(verb){rest.push({key:id,glyph:verb[0],icon:verb[3],label:id==='potion'&&game.potions>1?verb[1]+' ×'+game.potions:verb[1],question:verb[2],action:c.action,...(fighting&&isBonus(id)?{detail:'Bonus'}:fighting&&freeIds.includes(id)?{detail:'Free'}:{}),...(id==='class:surge'?{primary:true}:{})});continue;}
  rest.push({key:id,glyph:'✦',icon:'star',label:c.label.replace(/:.*$/,''),question:c.label.replace(/:.*$/,'')+'.',action:c.action});
 }
 // Attack…: every weapon, melee and ranged, at whoever can be attacked now (attackActions). In a fight it sits beside
  // the main weapon; elsewhere it waits with the other actions.
 if(!game.actionUsed&&attackTargets(hero,game,health).length){const chip={key:'attack-menu',glyph:'⚔',icon:'swords',label:'Attack…'};const at=primary.findIndex(a=>a.weapon);if(at>=0)primary.splice(at+1,0,chip);else if(fighting)primary.push(chip);else rest.push(chip);}
 // Cast… opens the spells that can be cast right now (spellActions): none while dying, and once the action is spent
 // only bonus-action spells.
 if(!game.pendingSpell&&castingStages.includes(game.stage)&&(health?.current??1)>0&&!(game.actionUsed&&game.bonusUsed)&&spellActions(hero,game).length)primary.push({key:'cast',glyph:'✧',icon:'spell',label:'Cast…',prefill:'I cast '});
 return [...primary,...rest,...backup,...last];
}
// Who can be attacked right now, each with the weapons that can reach them (drawn from the engine's own choices, so
// every move is one the rules accept): the foe of this fight (or the one waiting at the bridge), a creature beside
// it, and the people here.
export function attackTargets(hero,game,health=null){
 const targets=new Map(),put=(key,name,kind,weapon,thrown,choice,unarmed=null)=>{if(!targets.has(key))targets.set(key,{key,name,kind,moves:[]});targets.get(key).moves.push({weapon,thrown,choice,unarmed});};
 for(const c of dmChoices(hero,game,health)){
  let m;
  if((m=c.id.match(/^(attack|throw|encounter-attack|encounter-throw):(.+)$/)))put('foe',foeLabel(game),'foe',m[2],m[1].endsWith('throw'),c);
  else if((m=c.id.match(/^(ally-attack|ally-throw):(\d+):(.+)$/))){const ally=game.foeAllies?.[Number(m[2])];if(ally)put('ally:'+m[2],ally.name,'ally',m[3],m[1]==='ally-throw',c);}
  else if((m=c.id.match(/^(npc-attack|npc-throw):([^:]+):(.+)$/)))put('npc:'+m[2],npcLore(game,m[2])?.name??m[2],'person',m[3],m[1]==='npc-throw',c);
  // An Unarmed Strike that grapples or shoves (masteryRules.js).
  else if(c.id==='grapple'||c.id==='shove')put('foe',foeLabel(game),'foe','Unarmed Strike',false,c,c.id);
  else if((m=c.id.match(/^ally-(grapple|shove):(\d+)$/))){const ally=game.foeAllies?.[Number(m[2])];if(ally)put('ally:'+m[2],ally.name,'ally','Unarmed Strike',false,c,m[1]);}
  else if((m=c.id.match(/^npc-(grapple|shove):(.+)$/)))put('npc:'+m[2],npcLore(game,m[2])?.name??m[2],'person','Unarmed Strike',false,c,m[1]);
 }
 return [...targets.values()];
}
// The Attack… picker: Back, the target (chosen first when there is more than one, and always when only people are
// there: attacking someone is never a default), then the weapons under Melee and Ranged with their numbers. A weapon
// chip sends the attack at once, like any other chip.
export function attackActions(hero,game,health=null,targetKey=null){
 const targets=attackTargets(hero,game,health),armed=gearedHero(hero,game),options=attackOptions(armed);
 const target=targets.find(t=>t.key===targetKey)??targets.find(t=>t.kind==='foe')??null;
 const row=[{key:'attack-back',glyph:'‹',icon:'back',label:'Back',back:true}];
 if(targets.length>1||!target)for(const t of targets)row.push({key:'target:'+t.key,glyph:'◎',icon:t.kind==='person'?'people':'swords',label:t.name.replace(/^the /i,'').split(' ').slice(0,2).join(' '),target:t.key,primary:t===target,detail:t===target?'Target':undefined});
 if(!target){row.push({key:'heading:choose',heading:'Choose who to attack'});return row;}
 const the=target.kind==='person'?target.name:'the '+target.name.replace(/^the /i,'');
 const signed=n=>(n>=0?'+':'−')+Math.abs(n),dice=w=>w.flat?String(Math.max(1,1+w.bonus)):w.count+'d'+w.die+(w.bonus?(w.bonus>0?'+':'−')+Math.abs(w.bonus):'');
 const held=name=>(armed.equipment?.items??[]).filter(i=>i.name===name).reduce((n,i)=>n+(i.quantity??0),0);
 const melee=[],ranged=[];
 for(const move of target.moves){
  // Grapple and Shove: the creature saves against the hero's Strength DC.
  if(move.unarmed){melee.push({key:move.choice.id,glyph:'✊',icon:'fist',label:move.unarmed==='grapple'?'Grapple':'Shove',detail:'DC '+unarmedDC(armed),question:move.unarmed==='grapple'?'I grapple '+the+'.':'I shove '+the+' to the ground.',action:move.choice.action,unarmed:move.unarmed});continue;}
  const base=options.find(o=>o.name===move.weapon);if(!base)continue;
  const w=move.thrown?thrownAttack(base):base,count=w.ranged?arrowsLeft(game,hero):move.thrown?held(w.name):null;
  const question=w.unarmed?'I attack '+the+' with my bare hands.':move.thrown?'I throw my '+w.name.toLowerCase()+' at '+the+'.':w.ranged?'I shoot '+the+' with my '+w.name.toLowerCase()+'.':'I attack '+the+' with my '+w.name.toLowerCase()+'.';
  (w.ranged||move.thrown?ranged:melee).push({key:move.choice.id,glyph:'⚔',icon:w.unarmed?'fist':move.thrown?'spear':weaponIcon(w.name),label:w.unarmed?'Unarmed':w.name,detail:signed(w.attackBonus)+' · '+dice(w)+(count!==null?' · ×'+count:'')+(masteryOf(armed,w)?' · '+masteryOf(armed,w):''),question,action:move.choice.action,weapon:w.name,mastery:masteryOf(armed,w)});
 }
 row.push({key:'heading:melee',heading:'Melee'},...melee,{key:'heading:ranged',heading:'Ranged'},...(ranged.length?ranged:[{key:'heading:no-ranged',heading:'Nothing to shoot or throw',quiet:true}]));
 return row;
}
// The Cast… picker: every spell the hero knows, cantrips first. Spells the rules resolve on their own cast in one tap:
// healing, protection and detection on yourself; attacks and blasts at the enemy during a fight. Anything else starts
// the sentence so the player says how and at whom. The words are parsed exactly like typed casting.
export function spellActions(hero,game){
 if(!castingStages.includes(game.stage)||game.pendingSpell)return [];
 const creatures=game.stage==='combat',fighting=creatures||!!game.npcCombat?.active,foe=game.story||game.dungeon?.active?'the enemy':'the wisp';
 // In a party, healing reaches the other heroes too: a chip for each one who is hurt or down.
 const hurtFriends=partyMembers(game).filter(m=>!m.lead&&m.status!=='dead'&&(m.status==='down'||(m.hp!=null&&m.maxHp!=null&&m.hp<m.maxHp)));
 const held=game.concentration?.id,heldName=held?knownSpells(hero).find(s=>s.id===held)?.name??null:null;
 // What can be cast now: in a fight only spells of an action or a bonus action (only the bonus ones once the action
 // is spent), Hellish Rebuke right after being hurt, and Divine Smite right after a melee hit; Shield is raised for
 // you. Out of a fight, anything but a reaction that waits for its moment.
 const now=spell=>{
  const effect=automaticEffects[spell.id];
  if(effect?.smite)return !!game.lastHit&&!game.bonusUsed;
  if(spell.castingTime==='Reaction')return fighting?spell.id==='hellish-rebuke'&&!!game.hurtBy&&!game.reactionUsed:!!effect?.narrated;
  if(!fighting)return true;
  if(game.actionUsed)return spell.castingTime==='Bonus Action'&&!effect?.asAction&&!game.bonusUsed;
  return ['Action','Bonus Action'].includes(spell.castingTime)&&!(spell.castingTime==='Bonus Action'&&!effect?.asAction&&game.bonusUsed);
 };
 return knownSpells(hero).filter(spell=>now(spell)&&spellCostOptions(hero,game,spell).length>0&&(!fighting||castableNow(hero,game,spell,spell.castingTime==='Reaction'?{reaction:true}:{}))).sort((a,b)=>a.level-b.level||a.name.localeCompare(b.name)).flatMap(spell=>{
  const effect=automaticEffects[spell.id],self=!!(effect&&(effect.heal||effect.temp||effect.protection||effect.detection||effect.buff));
  // The chip says what the cast costs when that is not a plain slot, and what it ends.
  const costs=spellCostOptions(hero,game,spell),how=costs.includes('species')?'Free':!fighting&&costs.includes('ritual')?'Ritual · 10 min':null;
  const ends=spell.concentration&&held&&held!==spell.id&&heldName?'ends '+heldName:null;
  const timing=fighting&&spell.castingTime==='Bonus Action'&&!effect?.asAction?'Bonus':fighting&&spell.castingTime==='Reaction'?'Reaction':null;
  const base={key:'spell:'+spell.id,glyph:'✧',icon:effect?.heal?'heal':effect?.protection||effect?.temp||effect?.buff?'shield':effect?.detection||effect?.narrated?'eye':spellIcon(effect?.type),label:spell.name,detail:[spell.level?'Level '+spell.level:'Cantrip',timing,how,ends].filter(Boolean).join(' · ')};
  // A friend's chip carries its own cast, aimed at that hero by id (two heroes may share a name).
  const friendCast=m=>{const question='I cast '+spell.name+' on '+m.name+'.',c=dmCommand(hero,game,question);return {question,...(c?.action?.type==='spell'?{action:{...c.action,request:{...c.action.request,partyTarget:m.id}}}:{})};};
  const friends=effect?.heal&&!spell.id.startsWith('mass-')?hurtFriends.map(m=>({...base,key:base.key+':party:'+m.id,label:spell.name,detail:'on '+m.name.split(' ')[0]+(m.status==='down'?' · down':''),...friendCast(m)})):[];
  // A spell already held needs no second chip on yourself.
  if(self&&spell.concentration&&held===spell.id)return friends;
  if(self)return [{...base,question:'I cast '+spell.name+' on me.'},...friends];
  if(effect?.smite)return [{...base,question:'I cast '+spell.name+'.'}];
  if(effect?.narrated&&!effect.object)return [{...base,question:'I cast '+spell.name+'.'}];
  if(effect?.rider&&held===spell.id)return [];
  if(effect&&creatures&&!effect.narrated)return [{...base,question:'I cast '+spell.name+' at '+foe+'.'}];
  return [{...base,prefill:'I cast '+spell.name+' '+(spell.range==='Self'?'':'on ')}];
 });
}
function spellIcon(type=''){return {fire:'flame',cold:'frost',lightning:'bolt',thunder:'bolt',radiant:'sun',necrotic:'skull',force:'spell',poison:'potion',acid:'potion',psychic:'eye'}[String(type).toLowerCase()]??'spell';}
function dungeonLabels(id,label){
 const short={'dungeon:enter':['◈','Enter the vaults','door'],'dungeon:leave':['↩','Leave the vaults','retreat'],'dungeon:disarm':['⚙','Disarm the trap','key'],'dungeon:search':['⌕','Search the archive','search'],'dungeon:dawn':['✦','Speak “Dawn”','sun'],'dungeon:basin':['✚','Drink from the basin','potion'],'dungeon:claim':['✦','Claim the treasure','gem']};
 return short[id]??(id==='dungeon:fight'?['⚔',label,'swords']:['➜',label.replace(/^Explore /,''),'compass']);
}
