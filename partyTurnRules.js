// A party's fight at the shared table, in turns: the first move is anyone's (partyStep), then every standing hero and
// the foe (or each person in a brawl) roll initiative (beginPartyFight); passTurns hands the turn on and foeTurn plays
// the foe's turn from a standing hero's point of view (moved from adventureRules.js).
import {npcProfile} from "./npcRules";
import {combatBasics} from "./combatRules";
import {gearedHero} from "./inventoryRules";
import {isPartyGame,settleParty,partyView} from "./partyRules";
import {withMark,fightOver} from "./masteryRules";
import {encounterFoe,heroStep,dyingStep,adventureStepCore,stepLogEntries,toldInStory} from "./adventureRules";
import {runNpcTurns} from "./brawlRules";
// ---------- A party's fight: turns in initiative order ----------
// At the shared table (partyRules.js) each device plays its own hero. The first move of a fight (the opening attack)
// is anyone's; then every standing hero and the foe (or each person in a brawl) roll initiative, and the order is kept
// in the shared world (game.turnOrder: {order:[{id,init}], at, round, dodging}), so every device knows whose turn it
// is. A hero acts only on their own turn. When a hero's turn ends, the same device plays the foe's turn if it comes
// next: the foe strikes any standing hero, once a round. A hero who is down rolls their death save on their turn; a
// hero whose player has gone can be passed ({type:'party-pass'}).
export const partyFightOn=game=>!!game?.npcCombat?.active||game?.stage==='combat'||game?.party?.stage==='combat';
const d20=random=>1+Math.floor(random()*20);
const heroOf=character=>{try{return JSON.parse(character);}catch{return null;}};
const snapshotOf=(game,health,hero)=>({version:1,character:JSON.stringify(hero),game,health,chosen:true});
// up, down or dead; this device's own hero is read from its own game.
function memberStatus(game,id){
 if(id===game.party.lead)return game.stage==='dead'?'dead':game.stage==='dying'?'down':'up';
 return game.party.members[id]?.status??null;
}
function memberName(game,id,hero){
 if(id===game.party.lead)return hero?.name??'A hero';
 return heroOf(game.party.members[id]?.character)?.name??'A hero';
}
export const anyoneStanding=game=>Object.keys(game.party.members).some(id=>memberStatus(game,id)==='up');
// A hero of a party lies down (or dead) while the fight goes on for those still standing (partyRules.js settleParty).
export const partyFightGoesOn=(game,health,hero)=>isPartyGame(game)&&['dying','dead'].includes(game.stage)&&(!!game.npcCombat?.active||settleParty(snapshotOf(game,health,hero)).world.stage==='combat');
const fightFoeName=(hero,game)=>game.wildFight?.name??game.story?.foe??encounterFoe(hero,game).name;
// A death save in a party, whatever comes of it: the party stays where it is, so a hero who wakes (or rises) comes to
// where the others stand, never at the start alone while the world is elsewhere.
function stayWithParty(game,result){
 const next={...result.game,world:game.world,map:game.map};
 if(game.wildFight)next.wildFight=game.wildFight;else delete next.wildFight;
 if(!['dying','dead'].includes(next.stage)){const party={...next.party};next.stage=party.stage??next.stage;delete party.stage;next.party=party;}
 return {...result,game:next};
}
function withoutOrder(game){if(!game.turnOrder)return game;const next={...game};delete next.turnOrder;return next;}
// "Wolf: d20 … vs your AC 14. Hit." told of another hero, when the foe's turn is played from their point of view.
function toldOf(line,name){
 return line.replace(/^(.+?): d20 (.*?) vs your AC (\d+)\./,`$1 attacks ${name}: d20 $2 vs ${name}’s AC $3.`).replace(/^(.+?) attacks you:/,`$1 attacks ${name}:`)
  .replace(/^(.+? = \d+ \w+ damage)\. \d+ damage recorded: .*$/,`$1 to ${name}.`)
  .replace(/^The blow is so savage that it kills you outright\. You die\.$/,`The blow kills ${name} outright.`).replace(/^You fall unconscious and are dying\..*$/,`${name} falls unconscious and is dying.`)
  .replace(/\bat you\b/g,'at '+name).replace(/\byour eyes\b/g,name+'’s eyes').replace(/\bYour next attack\b/g,name+'’s next attack').replace(/\bYou are knocked prone\b/g,name+' is knocked prone').replace(/\bYou keep your feet\b/g,name+' keeps their feet').replace(/\bYou are restrained\b/g,name+' is restrained').replace(/\bYou tear free\b/g,name+' tears free');
}
export function partyStep(game,health,hero,action,random){
 const result=partyStepCore(game,health,hero,action,random);
 if(result.error||result.waiting||!result.game||result.game===game)return result;
 return {...result,game:partyAftermath(result.game,result.health,hero)};
}
// After any party move: a hero who has fallen lets go of what they held (whoever's device played the blow), and once
// the party's fight is over (won, fled, or nobody left standing) nothing of it outlasts it, as for one hero alone. A
// hero who lies down while the others fight on keeps nothing of their own fight either.
function partyAftermath(game,health,hero){
 const settled=settleParty(snapshotOf(game,health,hero)),fallen=Object.keys(settled.members).filter(id=>settled.members[id].status!=='up');
 let next=game;
 for(const [key,mark] of Object.entries(game.marks??{}))if(fallen.includes(mark.grappled))next=withMark(next,key,{grappled:undefined});
 if(!next.npcCombat?.active&&settled.world.stage!=='combat')return fightOver(next);
 if(['dying','dead'].includes(next.stage)&&['vex','lastHit','hurtBy','shieldUp'].some(k=>next[k]!==undefined)){next={...next};for(const k of ['vex','lastHit','hurtBy','shieldUp'])delete next[k];}
 return next;
}
function partyStepCore(game,health,hero,action,random){
 const me=game.party.lead;
 if(game.turnOrder&&!partyFightOn(game))game=withoutOrder(game);
 const order=game.turnOrder;
 // No fight under way, or its first move still to be made: anyone may act.
 if(!order){
  if(action?.type==='party-pass')return {game,health,error:'There is no turn to pass.'};
  let result=heroStep(game,health,hero,action,random,{party:true});
  if(result.error||result.waiting||result.game===game)return result;
  if(game.stage==='dying')result=stayWithParty(game,result);
  if(!partyFightOn(result.game)||result.game.openingAttackAvailable||result.game.stage==='dying')return {...result,game:withoutOrder(result.game)};
  const begun=beginPartyFight(result.game,result.health,hero,random);
  return {...result,game:begun.game,health:begun.health,events:[...(result.events??[]),...begun.events]};
 }
 const current=order.order[order.at];
 // The foe's turn left unplayed (it never should be): play it now.
 if(!current||current.id==='foe'||current.id.startsWith('npc:')){const resumed=passTurns({...game,turnOrder:{...order,at:order.at-1}},health,hero,random);return {...resumed,error:resumed.game.turnOrder?.order?.[resumed.game.turnOrder.at]?.id===me?'The foe has acted. It is your turn now.':'The foe has acted.'};}
 // Another hero's turn, passed because their player has gone (or holds back).
 if(action?.type==='party-pass'){
  if(current.id===me)return {game,health,error:'It is your own turn: act, or end your turn.'};
  const name=memberName(game,current.id,hero),line=memberStatus(game,current.id)==='down'?name+' lies still: no death save this turn.':name+' holds their ground.';
  const passed=passTurns({...game,log:[line,...game.log].slice(0,40)},health,hero,random);
  return {game:passed.game,health:passed.health,events:[line,...passed.events]};
 }
 if(current.id!==me)return {game,health,error:'It is '+memberName(game,current.id,hero)+'’s turn. Wait for it.'};
 let result;
 if(game.stage==='dying'){
  // A death save on this hero's turn; whatever comes of it, the party stays where it is.
  result=dyingStep(game,health,hero,action,random);
  if(result.error)return result;
  result=stayWithParty(game,result);
 } else {
  result=heroStep(game,health,hero,action,random,{party:true});
  if(result.error||result.waiting||result.game===game)return result;
 }
 if(!partyFightOn(result.game))return {...result,game:withoutOrder(result.game)};
 // The turn goes on while a bonus action is still to be taken.
 if(game.stage!=='dying'&&!result.turnOver&&result.game.stage!=='dying')return result;
 let next=result.game;
 if(result.dodged)next={...next,turnOrder:{...next.turnOrder,dodging:[...new Set([...(next.turnOrder.dodging??[]),me])]}};
 const passed=passTurns(next,result.health,hero,random);
 return {...result,game:passed.game,health:passed.health,events:[...(result.events??[]),...passed.events]};
}
// Every standing hero rolls initiative (on this device, for all of them), and the foe or each person fighting.
function beginPartyFight(game,health,hero,random){
 let next={...game,bonusUsed:false,reactionUsed:false,slotSpentThisTurn:false};delete next.actionUsed;delete next.surged;delete next.dodging;
 const settled=settleParty(snapshotOf(next,health,hero)),entries=[],lines=[];
 for(const id of settled.order){
  const member=settled.members[id],h=heroOf(member?.character);if(member?.status!=='up'||!h)continue;
  const stats=combatBasics(h),a=d20(random),b=stats.initiativeAdvantage?d20(random):a,total=Math.max(a,b)+stats.initiative;
  entries.push({id,init:total,dex:h.scores?.Dexterity??10,hero:true});
  lines.push(`${h.name} initiative: d20 [${[a,...(stats.initiativeAdvantage?[b]:[])].join(', ')}] + ${stats.initiative} = ${total}.`);
 }
 if(next.npcCombat?.active){
  for(const n of next.npcCombat.order.filter(n=>n.id!=='player')){entries.push({id:'npc:'+n.id,init:n.initiative,dex:10});lines.push(`${npcProfile(next,n.id).name} initiative: d20 ${n.initiative} + 0 = ${n.initiative}.`);}
 } else {
  const foe=encounterFoe(hero,next),die=d20(random),bonus=foe.saves?.Dexterity??0;
  entries.push({id:'foe',init:die+bonus,dex:10+2*bonus});lines.push(`${fightFoeName(hero,next)} initiative: d20 ${die} + ${bonus} = ${die+bonus}.`);
 }
 // Ties go to the higher Dexterity, then to the heroes.
 entries.sort((a,b)=>b.init-a.init||b.dex-a.dex||Number(!!b.hero)-Number(!!a.hero)||a.id.localeCompare(b.id));
 const label=id=>id==='foe'?fightFoeName(hero,next):id.startsWith('npc:')?npcProfile(next,id.slice(4)).name:memberName(next,id,hero);
 lines.push('Turn order: '+entries.map(e=>label(e.id)).join(' → ')+'.','Round 1 begins.');
 next={...next,turnOrder:{order:entries.map(({id,init})=>({id,init})),at:-1,round:1,dodging:[]},log:[...lines,...next.log].slice(0,40)};
 const passed=passTurns(next,health,hero,random);
 return {game:passed.game,health:passed.health,events:[...lines,...passed.events]};
}
// Hands the turn on: past the dead, through the foe's turn (played here), to the next hero, standing or down.
function passTurns(game,health,hero,random){
 let next=game,hp=health;const lines=[],say=line=>{lines.push(line);next={...next,log:[line,...(next.log??[])].slice(0,40)};};
 for(let step=0;step<24;step++){
  if(!partyFightOn(next)||!anyoneStanding(next)){next=withoutOrder(next);break;}
  const t=next.turnOrder,known=new Set(t.order.map(e=>e.id));
  // A hero who joined during the fight takes the last place in the order.
  const order=[...t.order.filter(e=>e.id==='foe'||e.id.startsWith('npc:')||next.party.members[e.id]),...Object.keys(next.party.members).filter(id=>!known.has(id)&&memberStatus(next,id)==='up').map(id=>({id,init:0}))];
  let at=Math.min(t.at,order.length-1)+1,round=t.round;
  if(at>=order.length){at=0;round++;}
  const entry=order[at];
  next={...next,turnOrder:{...t,order,at,round}};
  if(round>t.round)say('Round '+round+' begins.');
  if(entry.id==='foe'||entry.id.startsWith('npc:')){const phase=foeTurn(next,hp,hero,entry.id,random);next=phase.game;hp=phase.health;lines.push(...phase.events);continue;}
  const status=memberStatus(next,entry.id);
  if(status!=='up'&&status!=='down')continue;
  next={...next,turnOrder:{...next.turnOrder,dodging:(next.turnOrder.dodging??[]).filter(id=>id!==entry.id)}};
  say(memberName(next,entry.id,hero)+'’s turn.');
  break;
 }
 return {game:next,health:hp,events:lines};
}
// The foe's turn (or one person's, in a brawl), played from a standing hero's point of view: this device's own hero
// when they stand, else the first standing hero in the order. The result is read back from this device's point of view.
function foeTurn(game,health,hero,id,random){
 const me=game.party.lead,snapshot=snapshotOf(game,health,hero),settled=settleParty(snapshot);
 const actor=[me,...game.turnOrder.order.map(e=>e.id)].find(m=>settled.members[m]?.status==='up');
 if(!actor)return {game,health,events:[]};
 const view=actor===me?snapshot:partyView(snapshot,actor),them=heroOf(view.character);
 if(!them)return {game,health,events:[]};
 const scene={...view.game};delete scene.pendingSpell;
 // Conditions the foe put on the others last round wear off as it acts again.
 scene.party={...scene.party,members:Object.fromEntries(Object.entries(scene.party.members).map(([m,v])=>[m,v.hero?.heroCondition?{...v,hero:(h=>{delete h.heroCondition;return h;})({...v.hero})}:v]))};
 const dodging=game.turnOrder.dodging??[],geared=gearedHero(them,scene);
 let result;
 if(id==='foe'){
  if(scene.stage!=='combat')return {game,health,events:[]};
  result=adventureStepCore(scene,view.health,geared,'enemy-turn',random,{enemyOnly:true,partyFoe:true,dodging});
 } else {
  const fighter=scene.npcCombat?.active?scene.npcCombat.order.find(n=>n.id===id.slice(4)):null;
  if(!fighter)return {game,health,events:[]};
  result=runNpcTurns(scene,view.health??{current:combatBasics(geared).hp,temp:0},geared,[fighter],false,random,{dodging});
 }
 if(result.error||!result.game)return {game,health,events:[]};
 result={...result,events:result.events??stepLogEntries(scene.log,result.game.log)};
 if(scene.story)toldInStory(scene,result);
 // Told of the hero it was played from, by name, unless that is this device's own hero.
 if(actor!==me){const fresh=result.events.length;result.events=result.events.map(t=>toldOf(t,them.name));result.game={...result.game,log:result.game.log.map((t,i)=>i<fresh?toldOf(t,them.name):t)};}
 const back=partyView({...view,game:result.game,health:result.health},me);
 if(!back)return {game,health,events:[]};
 // This device's own pending spell is its own business (none can be pending at a turn's end; kept for safety).
 return {game:{...back.game,...(game.pendingSpell?{pendingSpell:game.pendingSpell}:{})},health:back.health,events:result.events};
}
