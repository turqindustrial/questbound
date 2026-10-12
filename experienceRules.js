import {worldPlace,mapState,placeName,regionOfPlace,mapRegions} from './mapRules';
import {isPartyGame} from './partyRules';
import {npcLore} from './npcRules';
import {dungeonRooms} from './dungeonRules';
// Experience points. A hero's level rises with experience, worked out by the game itself from what really happened
// (a fight won, a chapter finished, a lead seen through, a place reached, the tale's end), never from the Dungeon
// Master's words. The thresholds are the SRD 5.2 table. Each award is a share of the gap between the hero's current
// level and the next, times a pace that falls as levels rise, so early levels come quickly and later ones take a
// good while: every tuning number lives in xpPace and xpAwards and nowhere else.
export const xpThresholds=[0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000];
export const xpForLevel=level=>xpThresholds[Math.max(1,Math.min(20,Math.floor(level)||1))-1];
export function levelForXp(xp){let level=1;while(level<20&&xp>=xpThresholds[level])level++;return level;}
// How fast a level comes: a multiplier on every share. It never rises from level 2 on. Tuned (verify-experience.cjs
// simulates it) so that a player meeting about 1.3 fights, a chapter and a few places an hour reaches level 2 after
// the first two fights (about 12 minutes), level 3 at about 35 minutes, 4 at 1.5 h, 5 at 3 h, 10 at 14 h, 15 at 28 h
// and 20 at about 45 h.
export function xpPace(level){
 if(level>=20)return 0;
 if(level<=1)return 8;
 if(level===2)return 2.2;
 if(level===3)return 1.6;
 if(level===4)return 0.95;
 if(level<=9)return 0.69;
 if(level<=14)return 0.55;
 return 0.45;
}
// What each thing is worth, as a share of the current level's gap (before the pace).
export const xpAwards={creature:.07,lairMul:1.5,manyMul:1.25,boss:.35,brawlFoe:.04,brawlMax:2,chapter:.35,lead:.12,tale:.25,place:.015,land:.05};
// Limits per tale: creature fights past the eighth are worth a quarter, places past the tenth nothing, and the
// Skirmish (a practice fight) teaches nothing past level 2.
export const xpTaleLimits={fights:8,lateFightMul:.25,places:10,skirmishBelow:3};
export const xpMax=xpThresholds[19];
// The most experience a hero of this level can hold: one level may wait to be taken, never two.
export const xpCap=level=>level>=19?xpMax:xpForLevel(level+2)-1;
// The experience a hero has. Saves from before experience points are read lazily: a level owed on the road
// (levelsOwed), or a main foe beaten and its level not yet taken (an old 'victory'), count as that much experience.
// In an old party every hero but the winner already had that victory as a level owed (the old partyVictory), and
// every hero sees the world's 'victory', so there it counts only for a hero with no level owed: never twice.
export function heroXp(game,hero){
 const level=Math.max(1,Math.min(20,hero?.level??1)),owed=Number.isInteger(game?.levelsOwed)?game.levelsOwed:0;
 const won=game?.xp===undefined&&game?.stage==='victory'&&!(game.party&&owed>0)?1:0;
 return Math.max(xpForLevel(level),Number.isInteger(game?.xp)?game.xp:0,xpForLevel(Math.min(20,level+owed+won)));
}
// The numbers for the screen: the hero's level, experience, this level's floor and the next level's threshold.
export function experienceView(game,hero){
 const level=Math.max(1,Math.min(20,hero?.level??1)),xp=heroXp(game,hero),floor=xpForLevel(level),max=level>=20;
 const next=max?floor:xpForLevel(level+1);
 return {level,xp,floor,next,progress:max?1:Math.max(0,Math.min(1,(xp-floor)/(next-floor))),ready:!max&&xp>=next,max};
}
// How a fight that ended this turn went: { ended, won, fled, down }. One definition for the story log, experience
// and the spoils: a creature fight is won when its place is cleared, a vault guardian when its room is, the tale's
// own foe when it has no hit points left (or the tale says victory). In a party the world's place (party.stage)
// says whether the fight goes on, so a fight won while this hero lies dying is still won.
const xpFighting=g=>g?.stage==='combat'||(!!g?.party&&g.party.stage==='combat');
export function fightEnding(before,after){
 const none={ended:false,won:false,fled:false,down:false};
 if(!before||!after||before===after)return none;
 const ended=xpFighting(before)&&!xpFighting(after),down=['dying','dead','defeat'].includes(after.stage);
 if(!ended)return {...none,down};
 const won=before.wildFight?!!worldPlace(after,before.wildFight.place)?.cleared&&!after.wildFight
  :before.dungeon?.active?after.stage==='dungeon'||!!after.dungeon?.cleared?.includes(before.dungeon.room)&&!before.dungeon.cleared?.includes(before.dungeon.room)
  :after.stage==='victory'||after.enemyHP===0||after.party?.stage==='victory';
 return {ended,won:won&&(!down||isPartyGame(after)),fled:!won&&!down,down};
}
const xpTaleKey=game=>String(game?.story?.id??'crossroads').slice(0,120);
const xpFreshTally=key=>({tale:key,fights:0,places:0,leads:[]});
const xpTallyOf=game=>{const key=xpTaleKey(game),t=game?.xpTally;return t&&t.tale===key?{...t,leads:[...(t.leads??[])]}:xpFreshTally(key);};
const xpFoeName=game=>game.dungeon?.active?dungeonRooms[game.dungeon.room]?.foe??'The guardian':game.wildFight?.name??game.story?.foe??'Lantern Wisp';
const xpTitle=text=>{const t=String(text??'').trim();return t?t[0].toUpperCase()+t.slice(1):t;};
// What one turn was worth: [{share,label,practice?}] and the tale's tally after it. Shares do not depend on level,
// except a Skirmish win (practice), which pays only heroes below level 3.
export function experienceEvents(before,after,hero,{action=null}={}){
 const sources=[],tally=xpTallyOf(before);
 if(!before||!after||before===after||xpTaleKey(before)!==xpTaleKey(after))return {sources,tally:xpTallyOf(after)};
 const a=xpAwards,limits=xpTaleLimits,skirmish=before.story?.introId==='hostile';
 // ---- Fights ----
 const end=fightEnding(before,after);
 if(end.won&&!before.npcCombat?.active){
  const name=xpTitle(xpFoeName(before));
  if(skirmish&&!before.wildFight&&!before.dungeon?.active){sources.push({share:a.creature,label:name+' defeated',practice:true});tally.fights++;}
  else if(before.wildFight||before.dungeon?.active||!before.story){
   const w=before.wildFight,lair=!!w&&worldPlace(before,w.place)?.danger==='lair',many=(w?.stats?.group?.size??0)>1||(before.foeAllies??[]).length>0;
   const late=tally.fights>=limits.fights?limits.lateFightMul:1;
   sources.push({share:a.creature*(lair?a.lairMul:1)*(many?a.manyMul:1)*late,label:name+(lair?' (a lair cleared)':'')+' defeated'});tally.fights++;
  } else if(!tally.boss){sources.push({share:a.boss,label:name+' defeated'});tally.boss=true;}
 }
 // A brawl won: everyone fighting against the hero is down. Only those who were already hostile (or bore a grudge)
 // when it began are worth anything: beating up friendly people teaches nothing. Surrender and flight pay nothing.
 const c=before.npcCombat;
 if(c?.active&&after.npcCombat&&after.npcCombat.active===false&&(isPartyGame(after)||!end.down&&!['dying','dead','defeat'].includes(after.stage))){
  const enemies=c.order.filter(n=>n.side==='enemy').map(n=>n.id),beaten=id=>!!after.npcFate?.[id]||(after.npcHP?.[id]??1)<=0;
  if(enemies.length&&enemies.every(beaten)){
   const worthy=(c.worthy??[]).filter(id=>enemies.includes(id)).slice(0,a.brawlMax);
   if(worthy.length){const late=tally.fights>=limits.fights?limits.lateFightMul:1;sources.push({share:a.brawlFoe*worthy.length*late,label:'Bested '+worthy.map(id=>npcLore(after,id)?.name??'a foe').join(' and ')});tally.fights++;}
  }
 }
 // ---- The tale ----
 const ch0=before.story?.chapter??0,ch1=after.story?.chapter??0;
 if(after.story?.chapters&&ch1>ch0)for(let n=ch0;n<ch1;n++)sources.push({share:a.chapter,label:'Chapter '+(n+1)+' finished'});
 for(const l of after.story?.leads??[])if(l.done&&!before.story?.leads?.find(x=>x.id===l.id)?.done&&!tally.leads.includes(l.id)){sources.push({share:a.lead,label:'Lead seen through'});tally.leads=[...tally.leads,l.id].slice(-4);}
 if(before.story?.status==='active'&&after.story?.status==='complete'&&!tally.complete){sources.push({share:a.tale,label:'Tale complete'});tally.complete=true;}
 // ---- Places reached for the first time, and the first steps in a land ----
 const seen=new Set(mapState(before).visited??[]),fresh=(mapState(after).visited??[]).filter(id=>!seen.has(id)&&id!=='inn'&&id!=='dungeon');
 const roomFor=Math.max(0,limits.places-tally.places),paid=fresh.slice(0,roomFor);
 if(paid.length){sources.push({share:a.place*paid.length,label:paid.length===1?'Reached '+placeName(after,paid[0]):paid.length+' new places reached'});tally.places+=paid.length;}
 const landsSeen=new Set([...seen].map(id=>regionOfPlace(before,id)));
 // (a land counts only with a place that was paid for, so walking off the map again and again is no way to grow)
 for(const land of [...new Set(paid.map(id=>regionOfPlace(after,id)))])if(land!=='home'&&!landsSeen.has(land)){const r=mapRegions(after).find(x=>x.id===land);sources.push({share:a.land,label:'First steps in '+(r?.name??'a new land')});}
 return {sources,tally};
}
const xpGain=(shares,xp,level)=>{
 if(level>=20||shares<=0)return 0;
 const L=levelForXp(xp);if(L>=20)return 0;
 return Math.round(shares*xpPace(L)*(xpForLevel(L+1)-xpForLevel(L)));
};
// One hero's award: shares (practice ones only below level 3), their experience before, their level.
const xpAward=(sources,base,level)=>{
 const shares=sources.filter(s=>!s.practice||level<xpTaleLimits.skirmishBelow).reduce((t,s)=>t+s.share,0),gain=xpGain(shares,base,level);
 const next=Math.max(base,Math.min(xpCap(level),base+gain));
 return {gain,next,got:next-base};
};
const xpLevelOf=character=>{try{const h=JSON.parse(character);return Number.isInteger(h?.level)?h.level:1;}catch{return 1;}};
const xpNumber=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,',');
// The turn's experience, applied: the lead hero's own (game.xp), and every other living hero's at a party's table
// (each their own full award, worked out from their own level). Old owed levels are folded into experience here.
// Only the device whose action changed the world calls this; a state adopted from the table is never awarded again.
export function withExperience(before,after,hero,{action=null}={}){
 if(!before||!after||before===after)return {game:after,lines:[],gained:0,ready:false,labels:[]};
 const {sources,tally}=experienceEvents(before,after,hero,{action});
 const level=Math.max(1,Math.min(20,hero?.level??1));
 // The lead's experience as it stood: never the lazy 'victory' level of the state after (that is this turn's win).
 const base=Math.max(heroXp(before,hero),Number.isInteger(after.xp)?after.xp:0,xpForLevel(Math.min(20,level+(Number.isInteger(after.levelsOwed)?after.levelsOwed:0))));
 const gone=['dead'].includes(after.stage)||before.stage==='dead';
 const mine=gone?{gain:0,next:base,got:0}:xpAward(sources,base,level);
 let game={...after,xp:mine.next};delete game.levelsOwed;
 const t0=JSON.stringify(after.xpTally??null),changed=JSON.stringify(tally)!==JSON.stringify(xpTallyOf(before));
 if(changed&&JSON.stringify(tally)!==t0)game.xpTally=tally;
 // The rest of the party.
 let others=false;
 if(isPartyGame(after)&&sources.length){
  const members={...after.party.members};
  for(const [id,m] of Object.entries(members)){
   if(id===after.party.lead||!m||m.status==='dead')continue;
   const lv=xpLevelOf(m.character),h=m.hero??{},b=Math.max(xpForLevel(lv),Number.isInteger(h.xp)?h.xp:0,xpForLevel(Math.min(20,lv+(Number.isInteger(h.levelsOwed)?h.levelsOwed:0)))),award=xpAward(sources,b,lv);
   if(award.got<=0)continue;
   const nh={...h,xp:award.next};delete nh.levelsOwed;members[id]={...m,hero:nh};others=true;
  }
  if(others)game.party={...after.party,members};
 }
 const lines=[],labels=sources.filter(s=>!s.practice||level<xpTaleLimits.skirmishBelow).map(s=>s.label);
 if(mine.got>0)lines.push('Experience: +'+xpNumber(mine.got)+' ('+labels.join('; ')+').'+(others?' Every hero in the party gains experience too.':''));
 else if(others)lines.push('The party gains experience ('+sources.map(s=>s.label).join('; ')+').');
 if(!gone&&sources.some(s=>s.practice)&&level>=xpTaleLimits.skirmishBelow)lines.push('A practice fight: no experience past level 2.');
 if(!gone&&mine.gain>mine.got&&level<20)lines.push('Take your waiting level to go on gaining experience.');
 const ready=level<20&&levelForXp(mine.next)>level&&levelForXp(base)<=level;
 if(ready)lines.push('You have earned a level. Take it when you are ready.');
 return {game,lines,gained:mine.got,ready,labels};
}
// A level taken where the hero stands (rested, a main foe not yet met grown to match); the party and the world are
// kept. The caller adds the journal and story lines and the grown foe.
export function advancedInPlace(game,hero,character){
 const advanced={...game,xp:heroXp(game,hero),round:1};
 if(!isPartyGame(game))advanced.encounterLevel=character.level;
 delete advanced.levelsOwed;
 for(const key of ['resources','spellSlotsUsed','arcanumUsed','shortRests','concentration','temporarySpell','enemyEffects','bonusUsed','slotSpentThisTurn','reactionUsed','actionUsed','surged','featTurn','dodging','castingConditions','heroCondition','foeTricks'])delete advanced[key];
 return advanced;
}
const xpInteger=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi;
export function validExperience(g){
 if(g?.xp!==undefined&&!xpInteger(g.xp,0,xpMax))return false;
 const t=g?.xpTally;if(t===undefined)return true;
 if(!t||typeof t!=='object'||Array.isArray(t))return false;
 const keys=['tale','fights','places','leads','boss','complete'];
 return Object.keys(t).every(k=>keys.includes(k))&&typeof t.tale==='string'&&t.tale.length>0&&t.tale.length<=120&&xpInteger(t.fights,0,999)&&xpInteger(t.places,0,999)
  &&Array.isArray(t.leads)&&t.leads.length<=4&&new Set(t.leads).size===t.leads.length&&t.leads.every(id=>typeof id==='string'&&/^l[1-4]$/.test(id))&&(t.boss===undefined||t.boss===true)&&(t.complete===undefined||t.complete===true);
}
