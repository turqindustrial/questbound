// Dropping to 0 HP, death saving throws and death (2024 rules), shared by every way a hero can fall: a creature's
// blow, a brawl at the starting location, a hazard or a spell gone wrong.
// A fallen hero is left where they lie: the attackers turn away, and the hero rolls to hold on. Three successes
// stabilise them (they wake later at 1 HP), a natural 20 brings them straight back with 1 HP, three failures kill
// them. Damage that leaves as much past 0 HP as the hero's maximum kills outright. A dead hero stays dead unless someone
// present brings them back at once (Revivify, below); otherwise the device lays them to rest (App.js: the hero and their
// adventure leave the save, and only a memorial line stays in the graveyard, rosterRules.js).
import {npcScene,npcLore} from './npcRules';
import {knownSpells} from './spellRules';
import {slotChoices} from './spellOptions';
import {mapLocation} from './mapRules';
// The odds that keep a hero alive, in one place (tuned with balance-check.cjs, which also reports deaths). Close to
// death, fortune leans a little toward the hero: a blow that would drop them is now and then rolled again and the
// lower kept, and a failed death save is now and then rolled again and the better kept. Only the roll that counts is
// ever written down, so the feed, the log and the Dungeon Master see an ordinary roll. Never mention this to players.
// (The other half of making a new hero's first fights survivable is foeEase in storyRules.js.)
export const survivalOdds={blow:0.5,save:0.25};
// A blow that would take the hero from `current` (with `temp`) to 0: sometimes rolled again (`again` rolls it), the
// lower kept. Returns the roll to use. Draws from the engine's own random(), so a campaign server's dice agree.
export function sparedBlow(roll,{current,temp=0},again,random=Math.random){
 if(!roll||current<=0||roll.total<current+temp)return roll;
 if(random()>=survivalOdds.blow)return roll;
 const second=again();return second&&second.total<roll.total?second:roll;
}
const deathText=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const fallPlaces=['inn','bridge','tower','wild','dungeon'];
// Where the hero lies: a creature fight happens at the dangerous site, a brawl at the starting location.
export function fallPlace(game){
 if(game.dungeon?.active)return 'dungeon';
 if(game.wildFight)return 'wild';
 if(['inn','bridge','tower','wild'].includes(game.stage))return game.stage;
 if(game.npcCombat)return 'inn';
 return 'bridge';
}
// Called when damage has just taken the hero from above 0 to 0 HP. `overflow` is the damage left over past 0.
// `where`: the map location (mapRules.js mapLocation) where they fell, which bounds the moment for a revival.
export function fallAtZero(game,{overflow=0,maximum,cause,placeName,where=null}){
 const next={...game},place=fallPlace(game),spot=typeof where==='string'&&where.length>0&&where.length<=80?{where}:{};
 delete next.concentration;delete next.pendingSpell;delete next.npcCombat;delete next.openingAttackAvailable;delete next.encounterInitiative;
 if(next.dungeon?.active)next.dungeon={...next.dungeon,active:false};
 if(overflow>=maximum){
  next.stage='dead';delete next.dying;
  next.death={cause:String(cause).slice(0,300),place:String(placeName??'').slice(0,100),at:place,massive:true,...spot,...(game.stage==='combat'?{fight:true}:{})};
  return {game:next,entries:['The blow is so savage that it kills you outright. You die.']};
 }
 // `fight`: the hero fell in a fight, which in a party goes on for the others (partyRules.js).
 next.stage='dying';next.dying={successes:0,failures:0,place,cause:String(cause).slice(0,300),placeName:String(placeName??'').slice(0,100),...spot,...(game.stage==='combat'?{fight:true}:{})};
 return {game:next,entries:['You fall unconscious and are dying. Your attackers leave you where you fell. Each turn, roll to hold on: three successes and you stabilise, three failures and you die.']};
}
// One death saving throw. `wake` says where a stabilised hero comes to, and `rise` where a natural 20 leaves them.
// `bonus`: what the hero's magic adds to the save (a Cloak of Protection, a Stone of Good Luck); a natural 1 and 20 still
// read the die. `stabilise`: a Periapt of Wound Closure stops the bleeding at the start of the turn, as three successes.
export function deathSave(game,health,random=Math.random,{wakeStage='inn',wakeText='',riseStage,bonus=0,stabilise=false}={}){
 if(game.stage!=='dying'||!game.dying)return {game,health,error:'You are not dying.'};
 if(stabilise){const next={...game};next.stage=wakeStage;delete next.dying;return {game:next,health:{current:1,temp:0},events:['Periapt of Wound Closure: the pendant warms against your skin and the bleeding stops.','You are stable. Hours later you wake with 1 HP'+(wakeText?' '+wakeText:'.')]};}
 // Fortune near death (survivalOdds): a failed save is sometimes rolled again and the better kept; only that roll is told.
 let roll=1+Math.floor(random()*20);
 if((roll===1||roll+bonus<10)&&random()<survivalOdds.save)roll=Math.max(roll,1+Math.floor(random()*20));
 const d={...game.dying},next={...game},total=roll+bonus;
 let hp={current:0,temp:0};const entries=[];
 if(roll===20){
  hp={current:1,temp:0};next.stage=riseStage??(d.place==='dungeon'?'bridge':d.place);delete next.dying;
  entries.push('Death saving throw: d20 [20] = 20 vs DC 10. Success. A natural 20: you regain 1 HP and open your eyes.');
  return {game:next,health:hp,events:entries};
 }
 if(roll===1)d.failures+=2;else if(total>=10)d.successes+=1;else d.failures+=1;
 entries.push(`Death saving throw: d20 [${roll}]${bonus?' + '+bonus:''} = ${total} vs DC 10. ${roll!==1&&total>=10?'Success':'Failure'}.${roll===1?' A natural 1 counts as two failures.':''} Successes ${Math.min(3,d.successes)}, failures ${Math.min(3,d.failures)}.`);
 if(d.failures>=3){
  next.stage='dead';delete next.dying;next.death={cause:d.cause,place:d.placeName,at:d.place,massive:false,...(typeof d.where==='string'?{where:d.where}:{})};
  entries.push('Your breathing slows, then stops. You die.');
  return {game:next,health:hp,events:entries};
 }
 if(d.successes>=3){
  hp={current:1,temp:0};next.stage=wakeStage;delete next.dying;
  entries.push('You are stable. Hours later you wake with 1 HP'+(wakeText?' '+wakeText:'.'));
  return {game:next,health:hp,events:entries};
 }
 next.dying=d;
 return {game:next,health:hp,events:entries};
}
const whereOk=r=>r.where===undefined||typeof r.where==='string'&&r.where.length>0&&r.where.length<=80;
export function validDeathState(g){
 const counts=d=>Number.isInteger(d.successes)&&d.successes>=0&&d.successes<=2&&Number.isInteger(d.failures)&&d.failures>=0&&d.failures<=2;
 if(g.stage==='dying'&&!(g.dying&&counts(g.dying)&&fallPlaces.includes(g.dying.place)&&deathText(g.dying.cause,300)&&typeof g.dying.placeName==='string'&&g.dying.placeName.length<=100&&whereOk(g.dying)))return false;
 if(g.stage!=='dying'&&g.dying!==undefined)return false;
 if(g.stage==='dead'&&!(g.death&&deathText(g.death.cause,300)&&typeof g.death.place==='string'&&g.death.place.length<=100&&fallPlaces.includes(g.death.at)&&typeof g.death.massive==='boolean'&&whereOk(g.death)))return false;
 if(g.stage!=='dead'&&g.death!==undefined)return false;
 return true;
}
// Who or what dropped the hero, for the epitaph and for the Dungeon Master's description of the death.
export const causeOfFall=(game,source)=>source==='hazard'?'A hazard':source==='spell'?'Their own magic':(game.story?.foe?'The '+game.story.foe:game.dungeon?.active?'A vault guardian':'The Lantern Wisp');

// ---- Bringing the dead back ----
// Revivify (SRD 5.2, 3rd level): someone who died within the last minute comes back with 1 HP, and a diamond worth
// 300 gp turns to dust. In this game "the last minute" is the moment of the death itself: a hero alone stays exactly
// as they fell until their player chooses, and at a shared table the party can do it while it is still where the
// hero fell (death.where). Who can cast it: a hero who knows it and has a slot of 3rd level or more left, or a
// companion following the hero who is trained in a class that has it by their level (npcClasses). The diamond is
// paid from the gold in the caster's pack (the hero's own pack when a companion casts it).
export const revivalSpell={id:'revivify',name:'Revivify',level:3,diamond:300};
const reviverLevels={Cleric:5,Druid:5,Paladin:9,Ranger:9,Artificer:9};
const deadAt=record=>typeof record?.where==='string'?record.where:null;
// Buyable revives (the host's plan for later): something bought ahead, such as a scroll or a token carried in the
// pack, would be listed here as {kind:'item', id, name, cost:0, ready:true} and spent by reviveHero. Nothing is sold yet.
export function boughtRevivals(game,hero){return [];}
// What could bring this dead hero back now, on their own device: companions at their side (and, later, revives
// bought ahead). Each option says whether it is ready (`ready`) and, if not, why (`short`). Empty: death is final.
export function revivalOptions(game,hero){
 if(game?.stage!=='dead'||!game.death||game.party)return [];
 const gold=game.pack?.gold??0,options=[];
 for(const n of npcScene(game)){
  const trained=game.npcClasses?.[n.id],need=reviverLevels[trained?.class];
  if(game.followers?.[n.id]?.status!=='following'||n.fate==='dead'||!(n.hp>0)||!need||(trained.level??1)<need)continue;
  const name=npcLore(game,n.id)?.name??n.id,ready=gold>=revivalSpell.diamond;
  options.push({kind:'companion',id:n.id,name,cost:revivalSpell.diamond,ready,short:ready?null:name+' knows '+revivalSpell.name+', but it needs a diamond worth '+revivalSpell.diamond+' gp, and you carry '+gold+' gp.'});
 }
 return [...options,...boughtRevivals(game,hero)];
}
// Nobody can bring them back: the device lays the hero to rest (App.js). A hero at a shared table is never laid to
// rest by the rules: the table keeps their seat as fallen, and the player brings a new hero (partyRules.js joinParty).
export const deathIsFinal=(game,hero)=>game?.stage==='dead'&&!game.party&&!revivalOptions(game,hero).some(o=>o.ready);
// A companion speaks Revivify over the hero: back with 1 HP where they fell, the diamond paid from the pack. The
// foe, if any, is where it was (as after a natural 20 on a death save).
export function reviveHero(game,health,hero,by){
 const option=revivalOptions(game,hero).find(o=>o.id===by);
 if(!option)return {game,health,error:game?.stage==='dead'?'Nobody here can bring you back.':'You are not dead.'};
 if(!option.ready)return {game,health,error:option.short};
 const next={...game,stage:game.death.at==='dungeon'?'bridge':game.death.at,pack:{...(game.pack??{gold:0,items:[]}),gold:(game.pack?.gold??0)-option.cost}};delete next.death;
 const line=option.name+' presses a diamond to your chest and speaks '+revivalSpell.name+'. The stone crumbles to dust, and you draw breath again with 1 HP.';
 return {game:next,health:{current:1,temp:0},events:[line]};
}
// At a shared table: whether the hero in the lead can bring a fallen friend (party member `pid`) back now.
export function partyRevivalError(game,hero,pid,hp){
 const member=game.party?.members?.[pid];
 if(!member||pid===game.party.lead)return 'That hero is not here.';
 if(member.status!=='dead')return revivalSpell.name+' is for someone who has died.';
 if((hp?.current??1)<=0||['dying','dead'].includes(game.stage))return 'You cannot do that while down.';
 if(game.stage==='combat'||game.npcCombat?.active)return revivalSpell.name+' takes a moment of quiet: finish the fight first.';
 const where=deadAt(member.hero?.death);
 if(!where||where!==mapLocation(game))return 'It is too late: '+revivalSpell.name+' calls back only someone who died moments ago, where they fell.';
 const spell=knownSpells(hero).find(s=>s.id===revivalSpell.id);
 if(!spell)return 'You do not know '+revivalSpell.name+'.';
 if(!slotChoices(hero,game,spell).some(slot=>slot>=revivalSpell.level))return 'You have no spell slot of 3rd level or higher left.';
 if((game.pack?.gold??0)<revivalSpell.diamond)return revivalSpell.name+' needs a diamond worth '+revivalSpell.diamond+' gp, and you carry '+(game.pack?.gold??0)+' gp.';
 return '';
}
