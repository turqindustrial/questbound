// Dropping to 0 HP, death saving throws and death (2024 rules), shared by every way a hero can fall: a creature's
// blow, a brawl at the starting location, a hazard or a spell gone wrong.
// A fallen hero is left where they lie: the attackers turn away, and the hero rolls to hold on. Three successes
// stabilise them (they wake later at 1 HP), a natural 20 brings them straight back with 1 HP, three failures kill
// them. Damage that leaves as much past 0 HP as the hero's maximum kills outright. Death is permanent for that hero.
export const deathStages=['dying','dead'];
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
export function fallAtZero(game,{overflow=0,maximum,cause,placeName}){
 const next={...game},place=fallPlace(game);
 delete next.concentration;delete next.pendingSpell;delete next.npcCombat;delete next.openingAttackAvailable;delete next.encounterInitiative;
 if(next.dungeon?.active)next.dungeon={...next.dungeon,active:false};
 if(overflow>=maximum){
  next.stage='dead';delete next.dying;
  next.death={cause:String(cause).slice(0,300),place:String(placeName??'').slice(0,100),at:place,massive:true,...(game.stage==='combat'?{fight:true}:{})};
  return {game:next,entries:['The blow is so savage that it kills you outright. You die.']};
 }
 // `fight`: the hero fell in a fight, which in a party goes on for the others (partyRules.js).
 next.stage='dying';next.dying={successes:0,failures:0,place,cause:String(cause).slice(0,300),placeName:String(placeName??'').slice(0,100),...(game.stage==='combat'?{fight:true}:{})};
 return {game:next,entries:['You fall unconscious and are dying. Your attackers leave you where you fell. Each turn, roll to hold on: three successes and you stabilise, three failures and you die.']};
}
// One death saving throw. `wake` says where a stabilised hero comes to, and `rise` where a natural 20 leaves them.
export function deathSave(game,health,random=Math.random,{wakeStage='inn',wakeText='',riseStage}={}){
 if(game.stage!=='dying'||!game.dying)return {game,health,error:'You are not dying.'};
 const roll=1+Math.floor(random()*20),d={...game.dying},next={...game};
 let hp={current:0,temp:0};const entries=[];
 if(roll===20){
  hp={current:1,temp:0};next.stage=riseStage??(d.place==='dungeon'?'bridge':d.place);delete next.dying;
  entries.push('Death saving throw: d20 [20] = 20 vs DC 10. Success. A natural 20: you regain 1 HP and open your eyes.');
  return {game:next,health:hp,events:entries};
 }
 if(roll===1)d.failures+=2;else if(roll>=10)d.successes+=1;else d.failures+=1;
 entries.push(`Death saving throw: d20 [${roll}] = ${roll} vs DC 10. ${roll>=10?'Success':'Failure'}.${roll===1?' A natural 1 counts as two failures.':''} Successes ${Math.min(3,d.successes)}, failures ${Math.min(3,d.failures)}.`);
 if(d.failures>=3){
  next.stage='dead';delete next.dying;next.death={cause:d.cause,place:d.placeName,at:d.place,massive:false};
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
export function validDeathState(g){
 const counts=d=>Number.isInteger(d.successes)&&d.successes>=0&&d.successes<=2&&Number.isInteger(d.failures)&&d.failures>=0&&d.failures<=2;
 if(g.stage==='dying'&&!(g.dying&&counts(g.dying)&&fallPlaces.includes(g.dying.place)&&deathText(g.dying.cause,300)&&typeof g.dying.placeName==='string'&&g.dying.placeName.length<=100))return false;
 if(g.stage!=='dying'&&g.dying!==undefined)return false;
 if(g.stage==='dead'&&!(g.death&&deathText(g.death.cause,300)&&typeof g.death.place==='string'&&g.death.place.length<=100&&fallPlaces.includes(g.death.at)&&typeof g.death.massive==='boolean'))return false;
 if(g.stage!=='dead'&&g.death!==undefined)return false;
 return true;
}
// Who or what dropped the hero, for the epitaph and for the Dungeon Master's description of the death.
export const causeOfFall=(game,source)=>source==='hazard'?'A hazard':source==='spell'?'Their own magic':(game.story?.foe?'The '+game.story.foe:game.dungeon?.active?'A vault guardian':'The Lantern Wisp');
