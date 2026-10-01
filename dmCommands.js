import {attackOptions} from './weaponRules';
import {gearedHero} from './inventoryRules';
import {npcScene,npcIdsOf,npcLore} from './npcRules';
import {dungeonChoices,dungeonRooms} from './dungeonRules';
import {knownSpells,spellCostOptions,automaticEffects,inspectSpellCast} from './spellRules';
// Any of these starts an attack. The weapon is whatever the player names, else their main weapon; fists and
// feet (or no weapon at all) make an Unarmed Strike, and "shoot" reaches for a bow.
const VERBS='attack|strike|stab|slash|hit|punch|kick|swing at|smash|bash|cut down|cut|hack at|hack|chop at|chop|lunge at|charge at|charge|shoot at|shoot|headbutt|kill|slay|murder|finish off|cleave|club|bludgeon|thrust at|jab|knock out';
const unarmedWords=/\b(?:punch(?:es)?|kick(?:s)?|headbutt|elbow|knee|fists?|bare hands?|unarmed|my hands|tackle)\b/i;
const npcTitleWords=['the','captain','lady','lord','sir','dame','master','mistress','old','elder','brother','sister','father','mother','keeper','doctor','healer','aunt','uncle','young'];
const aliases={knife:'dagger',blade:'sword',sabre:'scimitar',saber:'scimitar',staff:'quarterstaff',club:'mace',hammer:'mace',hatchet:'handaxe',arrow:'bow',arrows:'bow'};
function commandWeapon(hero,text,requested){
  const available=attackOptions(hero);
  if(requested){
    if(unarmedWords.test(requested)||/^(?:my )?(?:hands?|fists?|feet|foot|knees?|elbows?|head)$/i.test(requested.trim()))return available.find(w=>w.unarmed);
    let want=requested.toLowerCase().trim().replace(/^(?:my|the|a|an|this|that)\s+/,'').replace(/[.!]$/,'');want=aliases[want]??aliases[want.replace(/s$/,'')]??want;
    return available.find(w=>w.name.toLowerCase()===want||w.name.toLowerCase()===want.replace(/s$/,''))??available.find(w=>!w.unarmed&&w.name.toLowerCase().includes(want.replace(/s$/,'')));
  }
  if(unarmedWords.test(text))return available.find(w=>w.unarmed);
  if(/\bshoot\b|\bloose an arrow\b|\bfire an arrow\b/i.test(text))return available.find(w=>w.ranged);
  const type=/^(?:I )?stab\b/i.test(text)?'Piercing':/^(?:I )?(?:slash|cut|hack|chop|cleave)\b/i.test(text)?'Slashing':/^(?:I )?(?:smash|bash|club|bludgeon)\b/i.test(text)?'Bludgeoning':null;
  return (type&&available.find(w=>w.type===type&&!w.ranged&&!w.unarmed))||available.find(w=>!w.ranged)||available[0];
}
const missingWeapon=(hero,requested)=>{const carried=attackOptions(hero).filter(w=>!w.unarmed).map(w=>w.name);return {error:requested?'You don\'t carry '+(/^(?:a|an|my|the)\s/i.test(requested)?requested.replace(/^(?:my|the)\s/i,'a '):'a '+requested)+'. '+(carried.length?'You have: '+carried.join(', ')+', or your fists.':'You can fight with your fists.'):'You have no bow ready (or no arrows).'};};
export function spellNickname(known,phrase){
  const first=String(phrase).trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z']/g,'')??'',rest=String(phrase).trim().split(/\s+/).slice(1).join(' ');
  if(first.length<2)return null;
  const initials=s=>s.name.toLowerCase().split(/[^a-z]+/).filter(Boolean).map(w=>w[0]).join('');
  const byInitials=first.length<=4?known.filter(s=>initials(s)===first):[];
  if(byInitials.length===1)return {spell:byInitials[0],rest};
  if(first.length<4)return null;
  const stem=first.replace(/s$/,''),byWord=known.filter(s=>s.name.toLowerCase().split(/[^a-z]+/).some(w=>w.length>=4&&(w===stem||w.startsWith(stem))));
  return byWord.length===1?{spell:byWord[0],rest}:null;
}
// Setting out to knock someone out rather than kill them: a finishing melee blow then leaves them alive.
export const subdueIntent=text=>/\bknock (?:\w+ )?(?:out|unconscious|senseless|cold)\b|\bsubdue|\bnon-?lethal|\bspare (?:him|her|them|it)\b|\bwithout killing\b|\b(?:take|capture) (?:him|her|them|it) alive\b|\bpommel\b|\bflat of (?:my|the) blade\b/i.test(String(text??''));
export const withAttackIntent=(game,text)=>subdueIntent(text)?{...game,subdue:true}:game;
// Explicit casting commands are resolved locally so model prose cannot choose a target or spend a slot.
export function dmCommand(hero,game,message,health=null,currentTarget=null){
  hero=gearedHero(hero,game);
  let text=message.trim();
  // A dying hero can only fight to hold on.
  if(game.stage==='dying')return /\b(?:death sav|saving throw|hold on|stay alive|survive|breathe|stay conscious|fight (?:to|for)|roll)\w*/i.test(text)?{action:'death-save'}:null;
  // A short attack keeps the current conversation/combat target. Resolve it once
  // into an explicit command so preview and commit cannot choose different people.
  const short=text.match(new RegExp('^(?:I )?(?:'+VERBS+')(?: (?:them|him|her|it))?(?: out)?(?: (?:with|using) (?:my |the |a |an )?(.+?))?[.!]?$','i'));
  if(short){
    const nearby=npcScene(game).filter(n=>n.present&&n.hp>0),enemies=game.npcCombat?.active?game.npcCombat.order.filter(n=>n.side==='enemy'&&nearby.some(p=>p.id===n.id)):[];
    const recent=[...(game.actionEvents??[])].reverse().find(e=>enemies.some(n=>n.id===e.target))?.target;
    const npc=nearby.find(n=>n.id===currentTarget)??nearby.find(n=>n.id===(recent??enemies[0]?.id));
    const creature=['bridge','combat'].includes(game.stage)&&game.enemyHP>0?(game.dungeon?.active?dungeonRooms[game.dungeon.room]?.foe:game.story?.foe??'Lantern Wisp'):null;
    // In a fight with the creature, "attack it" means the creature, not a bystander you last spoke to.
    const target=(game.stage==='combat'?creature:null)??npc?.id??creature??(nearby.length===1?nearby[0].id:null);
    if(!target)return {error:'Who do you want to attack? Name someone nearby or speak with them first.'};
    const chosen=commandWeapon(hero,text,short[1]);
    if(!chosen)return missingWeapon(hero,short[1]);
    const normalizedCommand='I attack '+target+' with '+chosen.name;
    const resolved=dmCommand(hero,game,normalizedCommand,health);
    return resolved?{...resolved,normalizedCommand}:null;
  }
  // People are named in full, by first name or by surname ("Tobin", "Brask"); titles alone do not count.
  // Longer names first, so "Edda Reed" is not mistaken for Tobin Reed; a surname two people share names neither.
  if(game.story){
    const parts=npcIdsOf(game).flatMap(id=>{const name=npcLore(game,id)?.name??'';return [[id,name,true],...name.split(/[\s,]+/).filter(t=>t.length>=3&&!npcTitleWords.includes(t.toLowerCase())).map(t=>[id,t,false])];}).filter(p=>p[1]).sort((a,b)=>b[1].length-a[1].length);
    const shared=part=>new Set(parts.filter(p=>!p[2]&&p[1].toLowerCase()===part.toLowerCase()).map(p=>p[0])).size>1,done=new Set();
    for(const [id,part,full] of parts){if(done.has(id)||(!full&&shared(part)))continue;const re=new RegExp('(^|[^A-Za-z0-9])'+part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=$|[^A-Za-z])','i');if(re.test(text)){text=text.replace(re,(m,lead)=>lead+id);done.add(id);}}
  }
  // Healing draughts: drink one, or give one to someone here ("give Tobin a potion", "pour a draught into the captain").
  if(/^(?:I )?(?:drink|quaff|down|swig|take) (?:a |my |one |the )?(?:healing )?(?:potion|draught)/i.test(text))return {action:'potion'};
  const gift=text.match(/^(?:I )?(?:give|feed|hand|pour)\s+(?:(keeper|mara|n\d{1,2})\s+(?:a |my |one |the )?(?:healing )?(?:potion|draught)|(?:a |my |one |the )?(?:healing )?(?:potion|draught)\s+(?:to|into|down)\s+(?:the )?(keeper|mara|n\d{1,2}))/i);
  if(gift)return {action:{type:'give-potion',target:(gift[1]??gift[2]).toLowerCase()}};
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
  const attack=text.match(new RegExp('^(?:I )?(?:'+VERBS+') (?:the )?(keeper|innkeeper|bartender|mara|traveler|n\\d{1,2})(?: out)?(?: (?:with|using) (?:my |the |a |an )?(.+?))?[.!]?$','i'));
  if(attack){
    const said=attack[1].toLowerCase(),target=/^n\d/.test(said)?said:['mara','traveler'].includes(said)?'mara':'keeper';
    const weapon=commandWeapon(hero,text,attack[2]);
    if(!weapon)return missingWeapon(hero,attack[2]);
    return {action:{type:'npc-attack',target,weapon:weapon.name}};
  }
  const creatureAttack=text.match(new RegExp('^(?:I )?(?:'+VERBS+') (.+?)(?: (?:with|using) (?:my |the |a |an )?(.+?))?[.!]?$','i'));
  if(creatureAttack&&['bridge','combat'].includes(game.stage)&&game.enemyHP>0){
    const name=game.dungeon?.active?dungeonRooms[game.dungeon.room]?.foe:game.story?.foe??'Lantern Wisp';
    const target=creatureAttack[1].toLowerCase().replace(/^(?:the|that|this) /,'');
    // "the bandit", "the goblins", "it" or "the beast" all mean the creature in front of you.
    const words=[name,game.story?.foeStats?.group?.plural,game.story?.foeSpecies].filter(Boolean).join(' ').toLowerCase().split(/[^a-z]+/).filter(w=>w.length>=4);
    if([name?.toLowerCase().replace(/^the /,''),'creature','enemy','foe','beast','monster','it','them',...(!game.story?['wisp']:[])].includes(target)||target.split(/[^a-z]+/).some(w=>w.length>=4&&words.some(n=>n.startsWith(w.replace(/s$/,''))||w.startsWith(n)))){
      const weapon=commandWeapon(hero,text,creatureAttack[2]);
      return weapon?{action:{type:'encounter-attack',weapon:weapon.name}}:missingWeapon(hero,creatureAttack[2]);
    }
  }
  const cast=text.match(/^(?:I )?cast\s+(.+)$/i);if(!cast)return null;
  const known=knownSpells(hero).sort((a,b)=>b.name.length-a.name.length);
  let spell=known.find(s=>cast[1].toLowerCase()===s.name.toLowerCase()||cast[1].toLowerCase().startsWith(s.name.toLowerCase()+' ')),detail=spell?cast[1].slice(spell.name.length).trim():'';
  // Obvious shortenings that fit exactly one known spell: initials ("FB") or a word of its name ("missiles", "cure").
  if(!spell){const nick=spellNickname(known,cast[1]);if(nick){spell=nick.spell;detail=nick.rest;}}
  if(!spell)return {error:'Name one of your prepared spells, for example: I cast Cure Wounds on myself.'};
  if(/\b(and|then) (?:I |cast |attack |move |go |flip )/i.test(detail))return {error:'Send one action at a time, including one spell and one target.'};
  if(!/\b(on|at|targeting|toward|towards)\s+\S/i.test(detail)&&spell.range!=='Self')return {error:`Who or what is the target? Send: I cast ${spell.name} on [target]. Include a slot level if you want to upcast.`};

  const costs=spellCostOptions(hero,game,spell),level=detail.match(/\blevel (\d) slot\b/i);
  const slot=/\bas a ritual\b/i.test(detail)?'ritual':/\barcanum\b/i.test(detail)?'arcanum':level?Number(level[1]):costs.find(c=>typeof c==='number')??costs[0];
  if(!costs.includes(slot))return {error:'That casting resource is unavailable. Choose an available slot or rest first.'};
  const target=detail.match(/\b(?:on|at|targeting|towards?)\s+(.+?)(?:,|\s+using\b|\s+with\b|\s+at level\b|\s+level \d slot\b|\s+as a ritual\b|\s+replace concentration\b|\s+components ready\b|$)/i)?.[1]?.trim().replace(/[.!]$/,'').toLowerCase()??(spell.range==='Self'?'myself':undefined);
  if(spell.id==='burning-hands'&&target==='myself')return {error:'Which direction should the 15-foot cone face, and who is in it? For example: I cast Burning Hands toward the wisp.'};
  if(spell.concentration&&game.concentration&&game.concentration.id!==spell.id&&!/replace concentration/i.test(detail))return {error:`Casting ${spell.name} will end ${game.concentration.id}. Add “replace concentration” to your cast if that is your intention.`};
  const request={id:spell.id,slot,intent:text.slice(0,500),componentsConfirmed:true};
  // A person who is here (named, or by title at the crossroads inn) is the spell's target, wherever you are.
  if(npcScene(game).some(n=>n.present&&n.id===target))request.npcTarget=target;
  else if(game.stage==='inn'){if(['bartender','the bartender','keeper','the keeper','innkeeper','the innkeeper'].includes(target))request.npcTarget='keeper';if(['mara','the traveler','traveler'].includes(target))request.npcTarget='mara';}
  if(request.npcTarget&&game.npcFate?.[request.npcTarget]==='dead')return {error:'They are dead. No spell you know can bring them back.'};
  const check=inspectSpellCast(hero,game,health,spell,request,target);if(check.error)return check;
  request.forceDM=check.manual||!!(game.story&&automaticEffects[spell.id]?.detection);
  return {action:{type:'spell',request},narration:check.summary};
}
