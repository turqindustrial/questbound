import {hostileFoes,foeStatsFor} from './hostileEncounter';
import {npcProfile,npcLore,npcScene,isAlly,npcWhereabouts} from './npcRules';
import {withMark,boonOn,blessRoll,boonResisted} from './masteryRules';
import {rollAttack,rollDamage} from './weaponRules';
import {worldPlace,worldPlaces,placeName} from './mapRules';
import {modifier} from './characterRules';
import {appendJournal,journalForGame} from './journalRules';
import {magicSaveBonus} from './lootRules';
// Fights away from the story's own foe: a creature met at a place found while exploring (a lair, or an ambush on
// arrival), and what every kind of monster can do beyond a plain attack. Companions who travel with the hero fight
// beside them, and can be knocked down in turn.
// Looked up when needed (never at load), so the order files load in does not matter.
export const templateKeys=['bandit','wolf','goblin','skeleton','boar','spider','zombies','orc','wolves'];
export const foeTemplate=key=>hostileFoes.find(f=>f.key===key)??null;
export const allFoeTemplates=()=>hostileFoes;
// One signature move per kind of monster. `foe` lines name the creature; the engine rolls everything.
export const signatureMoves={
 bandit:{name:'Dirty Trick',text:'Once in a fight, a hit also flings grit in your eyes: your next attack has disadvantage.'},
 wolf:{name:'Knockdown',text:'A hit can knock you prone (Strength save DC 13): your next attack has disadvantage and its next bite advantage.'},
 goblin:{name:'Ganging Up',text:'While two or more stand, each hit deals an extra 1d4.'},
 skeleton:{name:'Shield Wall',text:'The first blow that lands on it each fight loses 1d6 damage to its shield.'},
 boar:{name:'Charge',text:'Its first hit in a fight deals an extra 2d6.'},
 spider:{name:'Web',text:'Once in a fight it spits web (Dexterity save DC 12): restrained, your next attack has disadvantage and its next bite advantage.'},
 zombies:{name:'Undead Fortitude',text:'Once in a fight, a blow that would finish it may leave it standing at 1 HP (Constitution save).'},
 orc:{name:'Savage Blow',text:'A hit in the first round deals an extra 1d8.'},
 wolves:{name:'Pack Tactics',text:'While both stand, they attack with advantage.'},
};
export const heroConditions={blinded:'Blinded by grit: your next attack has disadvantage.',prone:'Knocked prone: your next attack has disadvantage and the foe\'s next attack has advantage.',restrained:'Caught in web: your next attack has disadvantage and the foe\'s next attack has advantage.'};
// The kind of monster in the current fight, when known: a wild creature, or a ready-made encounter story's foe.
export function foeKind(game){
 if(game.wildFight)return game.wildFight.template;
 const m=String(game.story?.id??'').match(/^hostile-encounter-(\w+)$/);
 return m&&templateKeys.includes(m[1])?m[1]:null;
}
const foePlural=name=>/s$/i.test(name)?name.toLowerCase():name.toLowerCase()+'s';
// Stats for a creature built from a template at the hero's level, under its own name.
export function wildFoeStats(template,name,level){
 const f=foeTemplate(template),stats=foeStatsFor(f,level);
 return stats.group?{...stats,group:{...stats.group,plural:foePlural(name)}}:stats;
}
export function foeLabel(game){return game.wildFight?.name??game.story?.foe??'Encounter opponent';}
const sketchText=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
export function validFoeSketch(f){return !!f&&templateKeys.includes(f.template)&&sketchText(f.name,60)&&sketchText(f.appearance,400);}
// ---------- A second creature at the foe's side ----------
// Mixed fights: a creature can bring one of another kind (a bandit's hound, a goblin's worg). It is weaker than one
// met alone (60% HP), attacks every round, can be aimed at by name, and runs when its leader falls.
export const allyTemplates=['bandit','wolf','goblin','skeleton','boar','spider','orc'];
export const naturalAllies={bandit:{template:'wolf',name:'War Hound',appearance:'A lean, scarred hound in a spiked leather collar, trained to go for the legs.'},goblin:{template:'wolf',name:'Worg',appearance:'A mangy, red-eyed worg with a crude goblin saddle strapped to its back.'},orc:{template:'goblin',name:'Goblin Lackey',appearance:'A snivelling goblin in the orc\'s cast-off mail, clutching a rusty knife.'}};
export const validAllySketch=(a,lead)=>validFoeSketch(a)&&allyTemplates.includes(a.template)&&a.template!==lead;
export function makeAlly(sketch,level){const max=Math.max(3,Math.round(wildFoeStats(sketch.template,sketch.name,level).maximum*.6));return {template:sketch.template,name:sketch.name.trim(),appearance:sketch.appearance.trim(),hp:max,maximum:max};}
export function allyStats(game,i,level){const a=game.foeAllies?.[i];if(!a)return null;const s={...wildFoeStats(a.template,a.name,level),name:a.name,maximum:a.maximum};delete s.group;return s;}
export const livingAllies=game=>(game.foeAllies??[]).map((a,index)=>({...a,index})).filter(a=>a.hp>0);
// Which of them an attack or spell is aimed at ("ally:0"), if that one still stands.
export function aimedAlly(game,aim){const m=String(aim??'').match(/^ally:([01])$/);if(!m)return null;const i=Number(m[1]);return game.foeAllies?.[i]?.hp>0?i:null;}
export function hurtAlly(game,i,damage){const a=game.foeAllies[i],hp=Math.max(0,a.hp-damage);return {game:{...game,foeAllies:game.foeAllies.map((x,j)=>j===i?{...x,hp}:x)},hp,line:hp===0?(game.subdue?`The ${a.name} drops, beaten.`:`The ${a.name} is slain.`):null};}
export function alliesScatter(game){const lines=livingAllies(game).map(a=>`With its leader down, the ${a.name} turns and flees.`),next={...game};delete next.foeAllies;return {game:next,lines};}
export function validFoeAllies(g){const a=g.foeAllies;if(a===undefined)return true;return g.stage==='combat'&&Array.isArray(a)&&a.length>=1&&a.length<=2&&a.every(x=>!!x&&allyTemplates.includes(x.template)&&sketchText(x.name,60)&&sketchText(x.appearance,400)&&Number.isInteger(x.maximum)&&x.maximum>=1&&x.maximum<=500&&Number.isInteger(x.hp)&&x.hp>=0&&x.hp<=x.maximum);}
// A creature lunges out at a found place. The story's own foe keeps its HP and fate for later.
export function startWildFight(game,hero,foe,{place,from,hp=null}){
 const stats=wildFoeStats(foe.template,foe.name,hero.level??1),ally=foe.ally&&validAllySketch(foe.ally,foe.template)?makeAlly(foe.ally,hero.level??1):null;
 const next={...game,stage:'combat',enemyHP:hp??stats.maximum,round:1,openingAttackAvailable:true,
  wildFight:{template:foe.template,name:foe.name.trim(),appearance:foe.appearance.trim(),stats,place,from:from??place,storyFoeHP:game.enemyHP,...(game.foeFate?{storyFoeFate:game.foeFate}:{}),...(ally?{ally:{template:ally.template,name:ally.name,appearance:ally.appearance}}:{})},
  world:{...game.world,at:place}};
 delete next.foeFate;delete next.encounterInitiative;delete next.foeTricks;delete next.heroCondition;delete next.foeAllies;
 if(ally)next.foeAllies=[ally];
 const many=stats.group?stats.group.size+' '+stats.group.plural:'A '+next.wildFight.name;
 return {game:next,entries:[`${many} ${stats.group?'burst':'bursts'} out at ${placeName(game,place)}${ally?', a '+ally.name+' at '+(stats.group?'their':'its')+' side':''}! ${stats.group||ally?'They haven\'t':'It hasn\'t'} closed the gap yet: you have the first move.`]};
}
// The fight is over: won (the creature is dead or beaten), fled (back the way you came) or fell (you lie dying).
export function endWildFight(game,outcome){
 const w=game.wildFight,next={...game,enemyHP:w.storyFoeHP};
 delete next.wildFight;delete next.foeTricks;delete next.heroCondition;delete next.openingAttackAvailable;delete next.encounterInitiative;delete next.foeFate;delete next.foeAllies;
 if(w.storyFoeFate)next.foeFate=w.storyFoeFate;
 const places=worldPlaces(game).map(p=>{if(p.id!==w.place)return p;const q={...p};if(outcome==='won'){delete q.threat;q.cleared=true;}else q.threat={template:w.template,name:w.name,appearance:w.appearance,hp:Math.max(1,game.enemyHP),...(w.ally?{ally:w.ally}:{})};return q;});
 next.world={...game.world,places,at:outcome==='fled'?(worldPlace(game,w.from)?w.from:null):w.place};
 if(outcome==='won')next.stage='wild';
 if(outcome==='fled')next.stage=worldPlace(game,w.from)?'wild':w.from;
 next.journal=appendJournal(journalForGame(next),'encounter',(outcome==='won'?'Defeated ':outcome==='fled'?'Fled from ':'Fell to ')+w.name,`At ${placeName(game,w.place)}.`);
 return next;
}
export function validWildFight(g){
 const w=g.wildFight;if(w===undefined)return true;
 return !!w&&g.stage==='combat'&&templateKeys.includes(w.template)&&sketchText(w.name,60)&&sketchText(w.appearance,400)&&!!worldPlace(g,w.place)&&(['inn','bridge','tower'].includes(w.from)||!!worldPlace(g,w.from))&&Number.isInteger(w.storyFoeHP)&&w.storyFoeHP>=0&&w.storyFoeHP<=500&&(w.storyFoeFate===undefined||['slain','subdued'].includes(w.storyFoeFate))&&(w.ally===undefined||validAllySketch(w.ally,w.template))&&!!w.stats&&Number.isInteger(w.stats.maximum)&&w.stats.maximum>=1&&w.stats.maximum<=1000&&g.world?.at===w.place;
}
export function validCombatExtras(g){
 const t=g.foeTricks,c=g.heroCondition;
 return (t===undefined||(t&&typeof t==='object'&&!Array.isArray(t)&&Object.entries(t).every(([k,v])=>['dirty','charge','shield','web','fortitude'].includes(k)&&v===true)))&&(c===undefined||Object.hasOwn(heroConditions,c))&&validFoeAllies(g);
}
// ---------- Signature moves ----------
// How the creature's next attack is rolled: advantage from pack tactics or a downed/caught hero, disadvantage from Dodge.
export function foeAttackMode(game,foe,standing,{dodge=false,blur=false}={}){
 const kind=foeKind(game),adv=(kind==='wolves'&&standing>=2)||['prone','restrained'].includes(game.heroCondition),dis=dodge||blur;
 return adv===dis?'normal':adv?'advantage':'disadvantage';
}
// Extra damage a hit carries, and anything it does to the hero. Returns {extra, dice, note, game}.
export function foeHitExtras(game,hero,foe,standing,random){
 const kind=foeKind(game);let next=game,extra=0,dice=[],note='';const tricks={...game.foeTricks};
 const roll=(n,d)=>Array.from({length:n},()=>1+Math.floor(random()*d));
 if(kind==='goblin'&&standing>=2){dice=roll(1,4);extra=dice[0];note=' + Ganging Up 1d4 ['+dice[0]+']';}
 if(kind==='boar'&&!tricks.charge){dice=roll(2,6);extra=dice[0]+dice[1];note=' + Charge 2d6 ['+dice.join(', ')+']';tricks.charge=true;}
 if(kind==='orc'&&game.round===1){dice=roll(1,8);extra=dice[0];note=' + Savage Blow 1d8 ['+dice[0]+']';}
 const lines=[];
 if(kind==='bandit'&&!tricks.dirty&&game.round>=2){tricks.dirty=true;next={...next,heroCondition:'blinded'};lines.push(`Dirty Trick: the ${foe.name} flings grit in your eyes. Your next attack has disadvantage.`);}
 if(kind==='wolf'){const die=roll(1,20)[0],bonus=modifier(hero.scores?.Strength??10)+magicSaveBonus(hero),total=die+bonus;if(total<13){next={...next,heroCondition:'prone'};lines.push(`Knockdown: Strength save d20 [${die}] + ${bonus} = ${total} vs DC 13. Failure. You are knocked prone.`);}else lines.push(`Knockdown: Strength save d20 [${die}] + ${bonus} = ${total} vs DC 13. Success. You keep your feet.`);}
 return {game:{...next,foeTricks:tricks},extra,note,lines};
}
// Moves made instead of, or before, the creature's attacks this round.
export function foeRoundMoves(game,hero,foe,random){
 const kind=foeKind(game);if(kind!=='spider'||game.foeTricks?.web||game.round<2)return {game,lines:[]};
 const die=1+Math.floor(random()*20),bonus=modifier(hero.scores?.Dexterity??10)+magicSaveBonus(hero),total=die+bonus,caught=total<12;
 return {game:{...game,foeTricks:{...game.foeTricks,web:true},...(caught?{heroCondition:'restrained'}:{})},lines:[`Web: the ${foe.name} spits a sticky mass at you. Dexterity save d20 [${die}] + ${bonus} = ${total} vs DC 12. ${caught?'Failure. You are restrained.':'Success. You tear free.'}`]};
}
// Damage the creature takes from a weapon blow, after its shield (skeleton) catches the first one.
export function shieldBlow(game,damage,random){
 if(foeKind(game)!=='skeleton'||game.foeTricks?.shield||damage<=0)return {game,damage,line:null};
 const block=1+Math.floor(random()*6),left=Math.max(0,damage-block);
 return {game:{...game,foeTricks:{...game.foeTricks,shield:true}},damage:left,line:`Shield Wall: the skeleton catches the blow on its cracked shield (1d6 [${block}]); ${left} damage gets through.`};
}
// A blow that would finish a zombie may not (once a fight).
export function undeadFortitude(game,foe,random){
 if(foeKind(game)!=='zombies'||game.foeTricks?.fortitude||game.enemyHP!==0)return {game,line:null};
 const die=1+Math.floor(random()*20),bonus=foe.saves?.Constitution??0,total=die+bonus,stands=total>=10;
 return {game:{...game,foeTricks:{...game.foeTricks,fortitude:true},...(stands?{enemyHP:1}:{})},line:`Undead Fortitude: Constitution save d20 [${die}] + ${bonus} = ${total} vs DC 10. ${stands?'Success. It lurches back up with 1 HP.':'Failure. It stays down.'}`};
}
// ---------- Companions in a fight ----------
// A companion fights as their class (game.npcClasses, npcRules.js), at their level: weapons for the martial classes,
// a cantrip for the casters. Saves from before classes (and anyone without one) keep the old plain blow.
const companionWeapon={keeper:{die:6,type:'bludgeoning'},mara:{die:4,type:'piercing'}};
export function companionAttack(cls,level){
 const l=Math.max(1,Math.min(20,Math.floor(level)||1)),prof=2+Math.floor((l-1)/4),mod=l>=8?5:l>=4?4:3,n=l>=17?4:l>=11?3:l>=5?2:1,extra=l>=5?2:1,hit=prof+mod;
 const weapon=(label,count,die,bonus,type,attacks=1)=>({kind:'attack',label,attacks,weapon:{attackBonus:hit,count,die,bonus,type}});
 switch(cls){
  case 'Fighter':return weapon('Greatsword',2,6,mod,'slashing',l>=20?4:l>=11?3:extra);
  case 'Barbarian':return weapon('Greataxe',1,12,mod+(l>=16?4:l>=9?3:2),'slashing',extra);
  case 'Paladin':return weapon('Longsword',1,8,mod,'slashing',extra);
  case 'Ranger':return weapon('Longbow',1,8,mod,'piercing',extra);
  case 'Monk':return weapon('Unarmed strike',1,l>=17?12:l>=11?10:l>=5?8:6,mod,'bludgeoning',extra+1);
  case 'Rogue':return {...weapon('Shortsword',1,6,mod,'piercing'),sneak:Math.ceil(l/2)};
  case 'Artificer':return weapon('Light Crossbow',1,8,mod,'piercing');
  case 'Wizard':case 'Sorcerer':return weapon('Fire Bolt',n,10,0,'fire');
  case 'Druid':return weapon('Produce Flame',n,8,0,'fire');
  case 'Warlock':return weapon('Eldritch Blast',1,10,l>=2?mod:0,'force',n);
  case 'Cleric':return {kind:'save',label:'Sacred Flame',ability:'Dexterity',dc:8+prof+mod,weapon:{attackBonus:hit,count:n,die:8,bonus:0,type:'radiant'},verb:'calls down radiant flame on',melee:{attackBonus:hit,count:1,die:6,bonus:mod,type:'bludgeoning',label:'Mace'}};
  case 'Bard':return {kind:'save',label:'Vicious Mockery',ability:'Wisdom',dc:8+prof+mod,weapon:{attackBonus:hit,count:n,die:6,bonus:0,type:'psychic'},verb:'hurls a cutting insult at',sap:true,melee:{attackBonus:hit,count:1,die:8,bonus:mod,type:'piercing',label:'Rapier'}};
  default:return null;
 }
}
// What a classed companion swings in a brawl with people: their weapon (a Cleric's mace, a Bard's rapier).
export function companionBrawlWeapon(game,id){
 const t=game?.npcClasses?.[id],a=t?companionAttack(t.class,t.level):null;
 if(!a)return {attackBonus:2,count:1,die:4,bonus:0,type:'bludgeoning'};
 return a.kind==='save'?a.melee:a.weapon;
}
// Everyone fighting beside the hero: companions who travel with them, and allies who live where the fight is.
export function fightingCompanions(game){
 const where=game.wildFight?.place??(game.stage==='combat'?(game.story?'bridge':null):null);
 return npcScene(game).filter(n=>n.hp>0&&n.fate!=='dead'&&(game.followers?.[n.id]?.status==='following'&&n.present||where&&isAlly(game,n.id)&&npcWhereabouts(game,n.id)===where));
}
const npcLabel=(game,id)=>npcLore(game,id)?.name??id;
// Each companion acts once after your turn: a weapon's attacks, a cantrip's attack or its save.
// `bonus`: what the hero adds to their companions' attack rolls (a Marshal's Captain's Call).
// Spells friends cast on a companion or another hero (masteryRules.js boons), if that file is loaded with this one.
const boonHere=(g,k,id)=>typeof boonOn==='function'?boonOn(g,k,id):null;
const resistHere=(g,k,t,a,r)=>typeof boonResisted==='function'?boonResisted(g,k,t,a,r):{amount:a,line:null};
export function companionsAttack(game,foe,random,bonus=0){
 let next=game;const lines=[];
 for(const n of fightingCompanions(game)){
  if(next.enemyHP<=0)break;
  const name=npcLabel(game,n.id),t=game.npcClasses?.[n.id],plan=t?companionAttack(t.class,t.level):null;
  if(!plan){
   const w=companionWeapon[n.id]??{die:4,type:'bludgeoning'},blessed=typeof blessRoll==='function'?blessRoll(next,n.id,random):0,attack=rollAttack({attackBonus:2+bonus+blessed},'normal',random),hit=!attack.miss&&(attack.critical||attack.total>=foe.ac);
   const damage=hit?rollDamage({count:1,die:w.die,bonus:0},attack.critical,random).total:0;
   next={...next,enemyHP:Math.max(0,next.enemyHP-damage)};
   lines.push(`${name} attacks the ${foe.name}: d20 [${attack.dice.join(', ')}] (normal) + ${2+bonus}${blessed?' + '+blessed+' Bless':''} = ${attack.total} vs AC ${foe.ac}. ${attack.critical?'Critical hit':hit?'Hit':'Miss'}; ${damage} ${w.type} damage.`);
   continue;
  }
  if(plan.kind==='save'){
   const bonus=foe.saves?.[plan.ability]??0,die=1+Math.floor(random()*20),total=die+bonus,saved=total>=plan.dc;
   const damage=saved?0:rollDamage(plan.weapon,false,random).total;
   next={...next,enemyHP:Math.max(0,next.enemyHP-damage)};
   if(!saved&&plan.sap&&next.enemyHP>0&&typeof withMark==='function')next=withMark(next,'foe',{sapped:true});
   lines.push(`${name} ${plan.verb} the ${foe.name} (${plan.label}): ${plan.ability} save d20 [${die}] + ${bonus} = ${total} vs DC ${plan.dc}. ${saved?'Success; no damage.':`Failure; ${damage} ${plan.weapon.type} damage.`+(plan.sap&&next.enemyHP>0?' Its next attack has disadvantage.':'')}`);
   continue;
  }
  let sneak=plan.sneak??0;
  for(let i=0;i<plan.attacks&&next.enemyHP>0;i++){
   const blessed=typeof blessRoll==='function'?blessRoll(next,n.id,random):0,aimed={...plan.weapon,attackBonus:plan.weapon.attackBonus+bonus+blessed},attack=rollAttack(aimed,'normal',random),hit=!attack.miss&&(attack.critical||attack.total>=foe.ac);
   let damage=hit?rollDamage(plan.weapon,attack.critical,random).total:0,note='';
   // A Rogue's first hit each turn finds a gap while the hero keeps the creature busy.
   if(hit&&sneak){const extra=rollDamage({count:sneak*(attack.critical?2:1),die:6,bonus:0},false,random).total;damage+=extra;note=', Sneak Attack';sneak=0;}
   next={...next,enemyHP:Math.max(0,next.enemyHP-damage)};
   lines.push(`${name} attacks the ${foe.name}: d20 [${attack.dice.join(', ')}] (normal) + ${aimed.attackBonus} = ${attack.total} vs AC ${foe.ac}. ${attack.critical?'Critical hit':hit?'Hit':'Miss'}; ${damage} ${plan.weapon.type} damage (${plan.label}${note}).`);
  }
 }
 return {game:next,lines};
}
// The other players' heroes in a party at the shared table who are still standing (partyRules.js keeps the party).
export function partyTargets(game){
 const party=game?.party;if(!party?.members||typeof party.lead!=='string')return [];
 return Object.entries(party.members).filter(([id,m])=>id!==party.lead&&m?.status==='up').map(([id])=>id);
}
// Who the creature goes for: usually you, sometimes a companion beside you. In a party every standing hero is as
// likely as you (companions draw a quarter of the blows when there are any).
export function pickFoeTarget(game,random){
 const companions=fightingCompanions(game).filter(n=>(game.npcHP?.[n.id]??npcProfile(game,n.id).maximumHP)>0);
 const heroes=partyTargets(game);
 if(heroes.length){
  const r=random();
  if(companions.length&&r<0.25)return companions[Math.min(companions.length-1,Math.floor(r/0.25*companions.length))].id;
  const share=companions.length?(r-0.25)/0.75:r,pool=[null,...heroes.map(id=>'party:'+id)];
  return pool[Math.min(pool.length-1,Math.floor(share*pool.length))];
 }
 if(!companions.length)return null;
 const r=random();return r<0.6?null:companions[Math.min(companions.length-1,Math.floor((r-0.6)/0.4*companions.length))].id;
}
// A blow aimed at another player's hero: their own armour and hit points; at 0 they fall and are dying (they roll
// their death saves on their own turn), and damage past 0 of at least their maximum kills them outright.
export function foeHitsPartyHero(game,foe,who,pid,mode,random){
 const member=game.party.members[pid],name=partyHeroName(member),ac=(member.stats?.ac??10)+(boonHere(game,'h:'+pid,'shield-of-faith')?2:0),most=member.stats?.hp??1;
 const attack=rollAttack(foe,mode,random),hit=!attack.miss&&(attack.critical||attack.total>=ac);
 const lines=[`${who} attacks ${name}: d20 [${attack.dice.join(', ')}] (${attack.mode}) +${foe.attackBonus} = ${attack.total} vs ${name}’s AC ${ac}. ${attack.critical?'Critical hit':hit?'Hit':'Miss'}.`];
 if(!hit)return {game,lines};
 const damage=rollDamage(foe,attack.critical,random),resisted=resistHere(game,'h:'+pid,foe.type,Math.max(1,damage.total),random),total=resisted.amount,was=member.health?.current??most,now=Math.max(0,was-total);
 const place=game.wildFight?'wild':game.dungeon?.active?'dungeon':['inn','bridge','tower','wild'].includes(game.stage)?game.stage:'bridge',where=String(placeName(game,place)??'').slice(0,100),cause=(foe.cause??'The '+foe.name).slice(0,300);
 let next={...member,health:{current:now,temp:0}},fell='';
 if(now===0&&total-was>=most){next={...next,status:'dead',hero:{...omitDying(member.hero),death:{cause,place:where,at:place,massive:true,fight:true}}};fell=` The blow kills ${name} outright.`;}
 else if(now===0){next={...next,status:'down',hero:{...omitDying(member.hero),dying:{successes:0,failures:0,place,cause,placeName:where,fight:true}}};fell=` ${name} falls unconscious and is dying.`;}
 lines.push(`${damage.dice.length}d${foe.die} [${damage.dice.join(', ')}] + ${foe.bonus}${resisted.line?' − '+(Math.max(1,damage.total)-total)+' Resistance':''} = ${total} ${foe.type} damage to ${name}.`+fell);
 return {game:{...game,party:{...game.party,members:{...game.party.members,[pid]:next}}},lines};
}
const omitDying=hero=>{const h={...(hero??{})};delete h.dying;delete h.death;return h;};
// A party's fight in turns (adventureRules.js), for the screen and the Dungeon Master: each place in the order, whose
// turn it is, and whether it is this device's own hero's.
export function turnOrderView(game){
 const t=game?.turnOrder,p=game?.party;if(!t||!p?.members||!Array.isArray(t.order))return null;
 const foeName=game.wildFight?.name??game.story?.foe??(game.dungeon?.active?'Vault guardian':'Lantern Wisp');
 const entries=t.order.map((e,i)=>{
  const current=i===t.at;
  if(e.id==='foe')return {id:e.id,kind:'foe',name:foeName,current};
  if(e.id.startsWith('npc:')){const id=e.id.slice(4);return {id:e.id,kind:'person',name:npcLabel(game,id),current,down:(game.npcHP?.[id]??1)<=0};}
  const m=p.members[e.id];if(!m)return null;
  const mine=e.id===p.lead,status=mine?(game.stage==='dead'?'dead':game.stage==='dying'?'down':'up'):m.status;
  return {id:e.id,kind:'hero',name:partyHeroName(m),player:m.name||null,mine,status,current};
 }).filter(Boolean);
 const current=entries.find(e=>e.current)??null;
 return {round:t.round,entries,current,mine:!!current?.mine};
}
export const partyHeroName=member=>{try{return JSON.parse(member.character).name||'your companion';}catch{return 'your companion';}};
export function foeHitsCompanion(game,foe,who,id,mode,random){
 if(typeof id==='string'&&id.startsWith('party:'))return foeHitsPartyHero(game,foe,who,id.slice(6),mode,random);
 const npc=npcProfile(game,id),ac=npc.ac+(boonHere(game,id,'shield-of-faith')?2:0),attack=rollAttack(foe,mode,random),hit=!attack.miss&&(attack.critical||attack.total>=ac);
 const lines=[`${who} attacks ${npcLabel(game,id)}: d20 [${attack.dice.join(', ')}] (${attack.mode}) +${foe.attackBonus} = ${attack.total} vs AC ${ac}. ${attack.critical?'Critical hit':hit?'Hit':'Miss'}.`];
 if(!hit)return {game,lines};
 const damage=rollDamage(foe,attack.critical,random),resisted=resistHere(game,id,foe.type,Math.max(1,damage.total),random),was=game.npcHP?.[id]??npc.maximumHP,now=Math.max(0,was-resisted.amount);
 lines.push(`${damage.dice.length}d${foe.die} [${damage.dice.join(', ')}] + ${foe.bonus}${resisted.line?' − '+(Math.max(1,damage.total)-resisted.amount)+' Resistance':''} = ${resisted.line?resisted.amount:damage.total} ${foe.type} damage to ${npcLabel(game,id)}.`+(now===0?` ${npcLabel(game,id)} falls unconscious.`:''));
 return {game:{...game,npcHP:{...game.npcHP,[id]:now}},lines};
}
// A companion beside a dying hero tries to stop the bleeding first (Medicine, DC 10); a healer among them (a Cleric,
// Druid, Bard or Paladin) speaks a word of healing instead, and never fails.
const healerClasses=['Cleric','Druid','Bard','Paladin'];
export function companionAid(game,random){
 const helpers=fightingCompanions(game).filter(n=>game.followers?.[n.id]?.status==='following');
 const healer=helpers.find(n=>healerClasses.includes(game.npcClasses?.[n.id]?.class)),helper=healer??helpers[0];if(!helper)return null;
 if(healer)return {id:healer.id,success:true,line:`${npcLabel(game,healer.id)} kneels beside you and speaks a word of healing over you (${game.npcClasses[healer.id].class}). Success.`};
 const die=1+Math.floor(random()*20),total=die+2,success=total>=10;
 return {id:helper.id,success,line:`${npcLabel(game,helper.id)} kneels beside you and presses on your wounds: Medicine d20 [${die}] + 2 = ${total} vs DC 10. ${success?'Success.':'Failure.'}`};
}
