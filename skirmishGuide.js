// The Skirmish as a first lesson: while a first-time player fights the built-in roadside foe, one short line under
// the actions says what the moment calls for (first move, bonus action, a draught, retreat, the win, dying).
// Pure: the Skirmish is the story whose introId is 'hostile'; nothing is shown in a written tale.
export function skirmishHint(game,health,maxHp){
 if(game?.story?.introId!=='hostile')return null;
 const hp=health?.current??maxHp,low=maxHp>0&&hp<=Math.ceil(maxHp/3),hurt=maxHp>0&&hp<=Math.floor(maxHp/2);
 if(game.stage==='dying')return 'You are dying. Each turn, roll a death save: three successes and you wake; three failures and the tale ends.';
 if(game.stage==='dead')return null;
 if(game.stage==='combat'){
  if(game.actionUsed)return 'Your action is spent. Take a bonus action (a healing draught if you are hurt), or end your turn.';
  if(low)return 'Low on hit points. Retreat is always allowed: you fall back to camp, and the bandit keeps its wounds.';
  if(hurt&&(game.potions??0)>0)return 'You are hurt. A healing draught is a bonus action: tap Potion, or fight on.';
  if((game.enemyHP??0)>0&&game.enemyHP<=5)return 'The bandit is nearly down. One more good blow should do it.';
  if(!(game.playback?.length))return 'Your first move. Tap your weapon to attack, or type what you do in your own words.';
  return 'Each turn: one action and one bonus action. Attack, Dodge, cast, or try something bold in your own words.';
 }
 if(game.foeFate==='slain'||game.enemyHP===0)return 'You won. Search the body, speak to the captain or walk to Lookout Rock: whatever you type is understood.';
 if(game.stage==='inn'&&(game.enemyHP??0)>0)return 'You got clear. Rest to recover, then face the bandit again when you are ready.';
 return null;
}
