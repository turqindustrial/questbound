// What a playtest note carries so the host can find and fix what the player ran into: the game's build, the hero and
// their spells, where the adventure stands (stage, fight, turn order), the last two turns as the feed showed them,
// the latest story-log lines, recent problems (problemLog.js) and how the game ran on the device (sound, drawing).
// Pure and bounded: every string is cut, every list capped, and the whole object stays well under 16 KB. Nothing
// here is sent anywhere until the player sends a note (Feedback.js). Callers work out place, chapter and turn text.
const FEEDBACK_MAX_BYTES=16000;
const fbText=(value,max=200)=>value==null?null:String(value).replace(/[\u0000-\u0008\u000b-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,max)||null;
const fbNum=value=>Number.isFinite(value)?value:null;
const fbList=(list,max,each)=>Array.isArray(list)?list.slice(0,max).map(each).filter(v=>v!=null):[];
const fbName=value=>typeof value==='string'?fbText(value,60):value&&typeof value==='object'?fbText(value.name??value.id,60):null;

// The bundle's content hash from the game script's file name (/_expo/static/js/web/index-<hash>.js): which build a
// note was written on. Null in development or outside a browser.
export function pageBuild(doc=globalThis.document){
 try{const src=doc?.querySelector?.('script[src*="/_expo/static/js/web/index-"]')?.getAttribute?.('src')??'';const hash=/index-([0-9a-f]{8})/i.exec(src);return hash?hash[1].toLowerCase():'dev';}catch{return 'dev';}
}

// The one-line summary that has always headed a note: hero, story, screen and where (kept for older readers).
export function feedbackSummary({hero,game,screen,place}={}){
 const stage={combat:'in combat',victory:'after a victory',defeat:'after a defeat',escaped:'after retreating',dying:'while dying',dead:'after dying'}[game?.stage];
 return {hero:hero?fbText(hero.name+' (Level '+hero.level+' '+(hero.species??hero.race)+' '+hero.class+')',120):'',story:fbText(game?.story?.title,120)??'',screen:fbText(screen,40)??'',where:[fbText(place,80),stage].filter(Boolean).join(', ')};
}

function fbFight(game){
 if(game?.wildFight)return {kind:'wild',foe:fbText(game.wildFight.name,60),foeHp:fbNum(game.enemyHP)};
 if(game?.npcCombat?.active)return {kind:'people',round:fbNum(game.npcCombat.round),foe:fbList((game.npcCombat.order??[]).filter(e=>e?.side!=='player'),4,e=>fbText(e.name??e.id,40)).join(', ')||null,foeHp:null,people:fbList((game.npcCombat.order??[]).filter(e=>e?.id&&e.side!=='player'),4,e=>({id:fbText(e.id,8),hp:fbNum(game.npcHP?.[e.id])}))};
 if(game?.stage==='combat')return {kind:'creature',foe:fbText(game.story?.foe??game.encounter?.name,60),foeHp:fbNum(game.enemyHP),allies:fbList(game.foeAllies,3,a=>a?{name:fbText(a.name,40),hp:fbNum(a.hp)}:null)};
 return null;
}

function fbTurn(turn){
 if(!turn||!Array.isArray(turn.events))return null;
 const said=turn.events.find(e=>e?.kind==='player'||e?.kind==='action');
 const words=turn.events.filter(e=>e?.kind==='narration'||e?.kind==='dialogue').map(e=>(e.kind==='dialogue'&&e.speakerName?e.speakerName+': ':'')+e.text).join(' ');
 const rulings=turn.events.filter(e=>['roll','effect','initiative'].includes(e?.kind)||(e?.kind==='action'&&e!==said)).slice(0,10).map(e=>fbText(e.text,200)).filter(Boolean);
 return {said:fbText(said?.text,300),narration:fbText(words,400),rulings};
}

const fbLogLine=entry=>fbText(typeof entry==='string'?entry:entry?.text??entry?.line,200);

export function feedbackDetails({hero,game,health,screen,theme,place,chapter,turn,table,dm,device,audio,perf,problems,build}={}){
 const g=game??{},h=hero??{};
 const details={
  v:1,build:fbText(build,16)??'dev',screen:fbText(screen,40),theme:fbText(theme,16),
  hero:hero?{
   name:fbText(h.name,60),species:fbText(h.species??h.race,40),class:fbText(h.class,30),subclass:fbText(h.subclass,40),level:fbNum(h.level),
   hp:[fbNum(health?.current),fbNum(health?.max),fbNum(health?.temp)],
   spells:{known:fbList(h.spells,40,fbName),spellbook:fbList(h.spellbook,40,fbName),slotsUsed:fbList(g.spellSlotsUsed,9,fbNum),concentration:fbText(g.concentration?.id,40)},
   resources:g.resources&&typeof g.resources==='object'?Object.fromEntries(Object.entries(g.resources).slice(0,16).map(([k,v])=>[fbText(k,30),typeof v==='number'?v:fbText(v,30)])):null,
  }:null,
  game:{
   stage:fbText(g.stage,20),story:fbText(g.story?.title,100),introId:fbText(g.story?.introId,30),chapter:fbText(chapter,100),place:fbText(place,80),
   round:fbNum(g.round),actionUsed:!!g.actionUsed,bonusUsed:!!g.bonusUsed,fight:fbFight(g),
   turn:fbText(turn,80),party:g.party?.members?{size:Object.keys(g.party.members).length,joined:!!table?.joined}:table?.joined?{size:fbNum(table.players?.length),joined:true}:null,
   levelsOwed:fbNum(g.levelsOwed),xp:fbNum(g.xp),
  },
  recent:fbList((g.playback??[]).slice(-2),2,fbTurn),
  log:fbList((g.storyLog??[]).slice(-6),6,fbLogLine),
  problems:fbList((problems??[]).slice(-5),5,p=>p?{kind:fbText(p.kind,12),at:fbText(p.at,30),said:fbText(p.said,300),error:fbText(p.error,300),answer:fbText(p.answer,300),stage:fbText(p.stage,20),action:fbText(p.action,40),spell:fbText(p.spell,40)}:null),
  dm:dm?{connected:dm.connected??null,protocol:fbText(dm.protocol,20)}:null,
  device:device?{label:fbText(device.label,120),dpr:fbNum(device.dpr),cores:fbNum(device.cores),memory:fbNum(device.memory),reducedMotion:!!device.reducedMotion,effects:fbText(device.effects,10),fullscreen:!!device.fullscreen}:null,
  audio:audio&&typeof audio==='object'?Object.fromEntries(Object.entries(audio).slice(0,20).map(([k,v])=>[fbText(k,30),typeof v==='number'||typeof v==='boolean'||v==null?v:fbText(v,40)])):null,
  perf:perf&&typeof perf==='object'?Object.fromEntries(Object.entries(perf).slice(0,12).map(([k,v])=>[fbText(k,30),typeof v==='number'||typeof v==='boolean'||v==null?v:fbText(v,40)])):null,
 };
 // A last guard on size: drop the bulkiest parts first if a strange save still makes it too large.
 for(const cut of [d=>{d.log=d.log.slice(-3);},d=>{d.recent=d.recent.slice(-1);},d=>{if(d.hero)d.hero.spells.spellbook=[];},d=>{d.recent=[];},d=>{d.problems=d.problems.slice(-2);}]){
  if(JSON.stringify(details).length<=FEEDBACK_MAX_BYTES)break;cut(details);
 }
 return details;
}
