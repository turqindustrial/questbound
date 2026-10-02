// The adventure as it stood before the player's last turn, kept in memory so the Dungeon Master can take that turn
// back when the player says it went wrong. One turn deep, on this device only, and gone when the page reloads.
let kept=null;
export function rememberTurn(game,health){kept={story:game.story?.id??null,turn:game.playback?.at(-1)?.id??0,game,health};}
// The state to return to, if the last thing that happened was that turn (scene moments and questions to the
// Dungeon Master that followed it go with it).
export function turnToRewind(game){
 if(!kept||kept.story!==(game.story?.id??null))return null;
 const now=game.playback?.at(-1)?.id??0;
 return now>kept.turn&&now-kept.turn<=4?{game:kept.game,health:kept.health}:null;
}
export function forgetTurn(){kept=null;}
// A message meant for the Dungeon Master rather than the story: "DM, …", "DM: …", "(ooc) …".
const direct=/^\s*(?:\(\s*ooc\s*\)|\[\s*ooc\s*\]|ooc\b|dm\b|dungeon master\b)\s*[:,\-]\s*/i;
export const toDungeonMaster=text=>direct.test(String(text??''))||/^\s*(?:\(\s*ooc\s*\)|\[\s*ooc\s*\])/i.test(String(text??''));
export const withoutAddress=text=>String(text??'').replace(direct,'').replace(/^\s*(?:\(\s*ooc\s*\)|\[\s*ooc\s*\])\s*/i,'').trim();
