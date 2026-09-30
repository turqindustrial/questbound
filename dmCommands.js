import {weaponAttacks} from './weaponRules';
import {npcScene} from './npcRules';
import {dungeonChoices,dungeonRooms} from './dungeonRules';
import {knownSpells,spellCostOptions,automaticEffects,inspectSpellCast} from './spellRules';
function commandWeapon(hero,text,requested){
  const available=weaponAttacks(hero).filter(w=>!w.blocked&&!w.ranged);
  if(requested)return available.find(w=>w.name.toLowerCase()===requested.toLowerCase());
  const type=/^(?:I )?stab\b/i.test(text)?'Piercing':/^(?:I )?slash\b/i.test(text)?'Slashing':null;
  return (type&&available.find(w=>w.type===type))||available[0];
}
// Explicit casting commands are resolved locally so model prose cannot choose a target or spend a slot.
export function dmCommand(hero,game,message,health=null,currentTarget=null){
  let text=message.trim();
  // A short attack keeps the current conversation/combat target. Resolve it once
  // into an explicit command so preview and commit cannot choose different people.
  const short=text.match(/^(?:I )?(attack|strike|stab|slash|hit)(?: (?:them|him|her|it))?(?: with (?:my |the |a )?(.+?))?[.!]?$/i);
  if(short){
    const nearby=npcScene(game).filter(n=>n.present&&n.hp>0),enemies=game.npcCombat?.active?game.npcCombat.order.filter(n=>n.side==='enemy'&&nearby.some(p=>p.id===n.id)):[];
    const recent=[...(game.actionEvents??[])].reverse().find(e=>enemies.some(n=>n.id===e.target))?.target;
    const npc=nearby.find(n=>n.id===currentTarget)??nearby.find(n=>n.id===(recent??enemies[0]?.id));
    const creature=['bridge','combat'].includes(game.stage)&&game.enemyHP>0?(game.dungeon?.active?dungeonRooms[game.dungeon.room]?.foe:game.story?.foe??'Lantern Wisp'):null;
    const target=npc?.id??creature??(nearby.length===1?nearby[0].id:null);
    if(!target)return {error:'Who do you want to attack? Name someone nearby or speak with them first.'};
    const chosen=commandWeapon(hero,text,short[2]);
    const normalizedCommand='I attack '+target+((short[2]??chosen?.name)?' with '+(short[2]??chosen.name):'');
    const resolved=dmCommand(hero,game,normalizedCommand,health);
    return resolved?{...resolved,normalizedCommand}:null;
  }
  if(game.story)for(const [id,npc] of Object.entries(game.story.npcs)){const at=text.toLowerCase().indexOf(npc.name.toLowerCase());if(at>=0)text=text.slice(0,at)+id+text.slice(at+npc.name.length);}
  if(game.story&&/^(?:I )?(?:go to|travel to|move to) /i.test(text)){const target=Object.entries(game.story.locations).find(([id,p])=>text.toLowerCase().includes(p.name.toLowerCase()));if(target)return {action:{type:'travel',destination:target[0]}};}
  if(game.npcCombat?.active){
    const combat=text.replace(/^I /i,'').replace(/[.!]$/,'').toLowerCase();
    if(['dodge','flee','run away','retreat','wait','surrender'].includes(combat))return {action:'npc-'+({'run away':'flee',retreat:'flee'}[combat]??combat)};
  }
  const dungeonPhrases={'enter dungeon':'dungeon:enter','enter the dungeon':'dungeon:enter','enter the lantern vaults':'dungeon:enter','leave dungeon':'dungeon:leave','leave the dungeon':'dungeon:leave','search the archive':'dungeon:search','disarm the trap':'dungeon:disarm','speak dawn':'dungeon:dawn','drink from the basin':'dungeon:basin','claim the treasure':'dungeon:claim','recover the lantern heart':'dungeon:claim','confront the guardian':'dungeon:fight'};
  let command=dungeonPhrases[text.replace(/^I /i,'').replace(/[.!]$/,'').toLowerCase()];
  const move=text.match(/^(?:I )?(?:explore|go to|travel to|move to) (.+?)[.!]?$/i);
  if(move){const n=dungeonRooms.findIndex(r=>r.name.toLowerCase()===move[1].toLowerCase().replace(/^the /,''));if(n>=0)command='dungeon:move:'+n;}
  if(command){if(!dungeonChoices(game).some(c=>c.id===command))return {error:'That route or dungeon action is not available here.'};return {action:command,narration:'Your dungeon action is resolved below.'};}

  if(/^(?:I )?(?:cancel spell|cancel casting)[.!]?$/i.test(text))return {action:{type:'cancel-spell'}};
  if(/^(?:I )?end concentration[.!]?$/i.test(text))return {action:{type:'end-concentration'}};
  if(/^DM ruling:/i.test(text)){
    if(!game.pendingSpell)return {error:'There is no spell awaiting a ruling.'};
    const parts=text.replace(/^DM ruling:/i,'').split(';'),note=parts.shift().trim(),ruling={note,damage:0,selfDamage:0,healing:0,temporaryHP:0};
    for(const part of parts){const match=part.trim().match(/^(damage|selfDamage|healing|temporaryHP)=(\d{1,4})$/i);if(!match)return {error:'Use DM ruling: outcome; damage=0; selfDamage=0; healing=0; temporaryHP=0. Only include values your DM resolved.'};const key=Object.keys(ruling).find(k=>k.toLowerCase()===match[1].toLowerCase());ruling[key]=Number(match[2]);}
    return {action:{type:'spell-ruling',ruling}};
  }
  const attack=text.match(/^(?:I )?(?:attack|strike|stab|slash|hit) (?:the )?(keeper|innkeeper|bartender|mara|traveler)(?: with (?:my |the |a )?(.+?))?[.!]?$/i);
  if(attack){
    const target=['mara','traveler'].includes(attack[1].toLowerCase())?'mara':'keeper';
    const weapon=commandWeapon(hero,text,attack[2]);
    if(!weapon)return {error:'Name an available melee weapon from your inventory.'};
    return {action:{type:'npc-attack',target,weapon:weapon.name}};
  }
  const creatureAttack=text.match(/^(?:I )?(?:attack|strike|stab|slash|hit) (.+?)(?: with (?:my |the |a )?(.+?))?[.!]?$/i);
  if(creatureAttack&&['bridge','combat'].includes(game.stage)){
    const name=game.dungeon?.active?dungeonRooms[game.dungeon.room]?.foe:game.story?.foe??'Lantern Wisp';
    const target=creatureAttack[1].toLowerCase().replace(/^the /,'');
    if([name?.toLowerCase().replace(/^the /,''),'creature','enemy',...(!game.story?['wisp']:[])].includes(target)){
      const weapon=commandWeapon(hero,text,creatureAttack[2]);
      return weapon?{action:{type:'encounter-attack',weapon:weapon.name}}:{error:'Name an available melee weapon from your inventory.'};
    }
  }
  const cast=text.match(/^(?:I )?cast\s+(.+)$/i);if(!cast)return null;
  const spell=knownSpells(hero).sort((a,b)=>b.name.length-a.name.length).find(s=>cast[1].toLowerCase()===s.name.toLowerCase()||cast[1].toLowerCase().startsWith(s.name.toLowerCase()+' '));
  if(!spell)return {error:'Name one of your prepared spells, for example: I cast Cure Wounds on myself.'};
  const detail=cast[1].slice(spell.name.length).trim();
  if(/\b(and|then) (?:I |cast |attack |move |go |flip )/i.test(detail))return {error:'Send one action at a time, including one spell and one target.'};
  if(!/\b(on|at|targeting|toward|towards)\s+\S/i.test(detail)&&spell.range!=='Self')return {error:`Who or what is the target? Send: I cast ${spell.name} on [target]. Include a slot level if you want to upcast.`};

  const costs=spellCostOptions(hero,game,spell),level=detail.match(/\blevel (\d) slot\b/i);
  const slot=/\bas a ritual\b/i.test(detail)?'ritual':/\barcanum\b/i.test(detail)?'arcanum':level?Number(level[1]):costs.find(c=>typeof c==='number')??costs[0];
  if(!costs.includes(slot))return {error:'That casting resource is unavailable. Choose an available slot or rest first.'};
  const target=detail.match(/\b(?:on|at|targeting|towards?)\s+(.+?)(?:,|\s+using\b|\s+with\b|\s+at level\b|\s+level \d slot\b|\s+as a ritual\b|\s+replace concentration\b|\s+components ready\b|$)/i)?.[1]?.trim().replace(/[.!]$/,'').toLowerCase()??(spell.range==='Self'?'myself':undefined);
  if(spell.id==='burning-hands'&&target==='myself')return {error:'Which direction should the 15-foot cone face, and who is in it? For example: I cast Burning Hands toward the wisp.'};
  if(spell.concentration&&game.concentration&&game.concentration.id!==spell.id&&!/replace concentration/i.test(detail))return {error:`Casting ${spell.name} will end ${game.concentration.id}. Add “replace concentration” to your cast if that is your intention.`};
  const request={id:spell.id,slot,intent:text.slice(0,500),componentsConfirmed:true};
  const check=inspectSpellCast(hero,game,health,spell,request,target);if(check.error)return check;
  request.forceDM=check.manual||!!(game.story&&automaticEffects[spell.id]?.detection);
  if(game.stage==='inn'){if(['bartender','the bartender','keeper','the keeper','innkeeper','the innkeeper'].includes(target))request.npcTarget='keeper';if(['mara','the traveler','traveler'].includes(target))request.npcTarget='mara';}
  return {action:{type:'spell',request},narration:check.summary};
}
