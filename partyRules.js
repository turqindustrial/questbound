import {combatBasics} from './combatRules';
// A party at the shared table: every player brings their own hero into one adventure. The world (the story, the map,
// the people, the fight) is shared; each hero's own state (hit points, draughts, pack, slots, deeds, dying...) is kept
// per hero in game.party.members. A snapshot always has one hero in the lead: the one whose device sent it. Every
// device views the table with its own hero in the lead (partyView), so the rules engine always plays one hero, the
// player's own; the others travel with them, can be struck by the foe (encounterRules.js) and given a draught
// (adventureRules.js), and the Dungeon Master is told about them but never speaks or acts for them (dmContext.js).
// Turning the view is not a move: the table compares snapshots in their settled form (canonicalParty), which is the
// same from every point of view, so only real changes are sent.
export const heroFields=['potions','pack','wield','skillTraining','levelsOwed','deeds','resources','shortRests','spellSlotsUsed','arcanumUsed','concentration','castingConditions','temporarySpell','heroCondition','pendingSpell','dying','death'];
// What belongs to one hero's turn and does not outlast it.
const turnFields=['actionUsed','bonusUsed','reactionUsed','dodging','aim','subdue','slotSpentThisTurn'];
export const maxPartySize=4;
export const isPartyGame=game=>!!game?.party&&typeof game.party==='object'&&!!game.party.members&&typeof game.party.lead==='string';
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o?.[k]!==undefined).map(k=>[k,o[k]]));
const omit=(o,keys)=>{const c={...o};for(const k of keys)delete c[k];return c;};
const parse=text=>{try{return JSON.parse(text);}catch{return null;}};
const statsOf=character=>{const hero=parse(character);if(!hero)return {ac:10,hp:1};const b=combatBasics(hero);return {ac:b.ac,hp:b.hp};};
// Where the party stands when the hero in the lead has just fallen: a fight in the wilds or with the story's foe goes
// on for the others; a brawl, a hazard or a vault ends where it happened.
const placeOf=record=>{const place=record?.at??record?.place??'inn';return place==='dungeon'?'bridge':['inn','bridge','tower','wild'].includes(place)?place:'inn';};
function stageAfterFall(game){
 const record=game.dying??game.death??{},fight=!!record.fight;
 if(fight&&game.wildFight)return 'combat';
 if(fight&&placeOf(record)==='bridge'&&game.enemyHP>0&&!game.foeFate)return 'combat';
 return placeOf(record);
}
// The settled table: the world as it stands and every hero's own state, the lead's taken from the snapshot.
export function settleParty(snapshot){
 const game=snapshot.game,party=game.party,lead=party.lead,status=game.stage==='dead'?'dead':game.stage==='dying'?'down':'up';
 const members={...party.members};
 members[lead]={...(members[lead]??{}),character:snapshot.character,health:snapshot.health,hero:omit(pick(game,heroFields),status==='up'?['dying','death']:[]),status,stats:statsOf(snapshot.character)};
 // The world's own place: where the party was when this hero, down already, took their turn (party.stage), or where
 // it stands now.
 let stage=party.stage??(status==='up'?game.stage:stageAfterFall(game));
 // Nobody left standing: the foe leaves them where they fell, as for one hero alone.
 if(stage==='combat'&&!Object.values(members).some(m=>m.status==='up'))stage=placeOf(game.dying??game.death??Object.values(members).map(m=>m.hero?.dying??m.hero?.death).find(Boolean));
 const world=omit(game,[...heroFields,...turnFields,'party','stage']);
 return {chosen:snapshot.chosen,world:{...world,stage},members,order:party.order??Object.keys(members)};
}
// The table with this player's own hero in the lead. Null when they are not in the party.
export function partyView(snapshot,me){
 const settled=settleParty(snapshot),mine=settled.members[me];if(!mine)return null;
 const game={...settled.world,...(mine.hero??{}),party:{members:settled.members,lead:me,order:settled.order}};
 if(mine.status!=='up'){game.party.stage=settled.world.stage;game.stage=mine.status==='dead'?'dead':'dying';}
 if(mine.status==='up'){delete game.dying;delete game.death;}
 game.potions=game.potions??0;
 return {version:1,chosen:settled.chosen,character:mine.character,health:mine.status==='up'?mine.health:{current:0,temp:0},game};
}
// The same text from every point of view (keys sorted), for deciding whether anything really changed.
const stable=value=>Array.isArray(value)?'['+value.map(stable).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}':JSON.stringify(value);
export function canonicalParty(snapshot){
 if(!isPartyGame(snapshot?.game))return JSON.stringify(snapshot);
 const s=settleParty(snapshot);return stable({...s,members:Object.fromEntries(Object.entries(s.members).map(([id,m])=>[id,omit(m,['stats'])]))});
}
// A hero's own things from their current adventure (carried into the party as they are), and a fresh state otherwise.
const ownState=(game,health)=>({hero:{potions:1,...omit(pick(game??{},heroFields),['dying','death','pendingSpell','concentration'])},health:health&&health.current>0?health:null});
// The host turns their own table into a party with their hero in the lead.
export function startParty(snapshot,me,name){
 return {...snapshot,game:{...snapshot.game,party:{lead:me,order:[me],members:{[me]:{name:String(name||'').slice(0,40),character:snapshot.character,health:snapshot.health,hero:{},status:'up',stats:statsOf(snapshot.character)}}}}};
}
// A player joins with their own hero (or replaces a hero of theirs who has died). Returns the table seen from them, or
// an error.
export function joinParty(snapshot,me,{character,game,health,name}){
 const settled=settleParty(snapshot),known=settled.members[me];
 if(known&&known.status!=='dead'&&known.character===character)return {snapshot:partyView(snapshot,me)};
 if(!known&&Object.keys(settled.members).length>=maxPartySize)return {error:'This party is full: four heroes at most.'};
 const own=ownState(game,health);
 const members={...settled.members,[me]:{name:String(name||'').slice(0,40),character,health:own.health,hero:own.hero,status:'up',stats:statsOf(character)}};
 const order=[...settled.order.filter(id=>id!==me),me];
 // The lead's own state stays in the snapshot, where settling reads it.
 return {snapshot:partyView({...snapshot,game:{...snapshot.game,party:{...snapshot.game.party,members,order}}},me)};
}
// Leaving the table: this player's own adventure goes on alone from where the party stands, at their own hero's level
// (a party's fight may have been set by another hero's level; the foe's hit points are kept within what that allows).
export function soloFromParty(snapshot,level=null){
 if(!isPartyGame(snapshot?.game))return snapshot;
 const game=omit(snapshot.game,['party']);if(snapshot.game.party.stage&&!['dying','dead'].includes(game.stage))game.stage=snapshot.game.party.stage;
 if(Number.isInteger(level)&&game.encounterLevel!==undefined&&game.encounterLevel!==level){
  game.encounterLevel=level;
  const most=Math.max(10+8*(level-1),game.dungeon?14+4*(level-1):0,game.story?.foeStats?.maximum??0,game.wildFight?.stats?.maximum??0);
  if(Number.isInteger(game.enemyHP))game.enemyHP=Math.min(game.enemyHP,most);
 }
 return {...snapshot,game};
}
// The others, for the screen and the Dungeon Master: name, player, condition and hit points.
export function partyMembers(game){
 if(!isPartyGame(game))return [];
 return (game.party.order??Object.keys(game.party.members)).filter(id=>game.party.members[id]).map(id=>{const m=game.party.members[id],hero=parse(m.character)??{};return {id,lead:id===game.party.lead,name:hero.name??'A hero',player:m.name||null,species:hero.species??hero.race??'',heroClass:hero.class??'',level:hero.level??1,status:m.status,hp:m.health?.current??m.stats?.hp??null,maxHp:m.stats?.hp??null};});
}
// A won fight earns a level for every other hero still alive (taken on their own next turn, as an owed level).
export function partyVictory(before,after){
 if(!isPartyGame(after)||after.stage!=='victory'||before?.stage==='victory')return after;
 const members=Object.fromEntries(Object.entries(after.party.members).map(([id,m])=>[id,id===after.party.lead||m.status==='dead'?m:{...m,hero:{...m.hero,levelsOwed:Math.min(5,(m.hero?.levelsOwed??0)+1)}}]));
 return {...after,party:{...after.party,members}};
}
