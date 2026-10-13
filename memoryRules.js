import {knownPlaceIds,placeName,mapLocation} from './mapRules';
import {npcIdsOf,npcLore,mentionsName} from './npcRules';
// ---------- The story so far, remembered for good ----------
// The Dungeon Master remembers every adventure from its first turn to its last (the host, 2026-10-13: "fix the dungeon
// master's memory so that it remembers everybody's adventure from start to finish"). game.memory keeps, in the save
// (and in the shared world at a table):
//  - the chronicle: every tale (title, how it began and ended) and every chapter of it, each a handful of the story
//    log's lines (storyLog.js) with the rest folded into counts and names, so nothing is ever dropped, only
//    compressed, and older tales more than newer ones. It is worked out by the game from the story log alone (the log
//    keeps 400 lines, the chronicle everything), lazily, so an old save gets one built from what it has.
//  - facts the game cannot see: a promise, a secret learned, a name given to something, a debt in words, a plan, who
//    knows what. The Dungeon Master adds them with its `remember` reply field (at most two a turn) and settles them
//    when they stop mattering (a promise kept or broken); a settled fact is folded into its chapter.
// The people and places themselves stay where they are (npcMemory, game.people, the map). Each turn the Dungeon
// Master is sent a compact block (memoryBlock) within a fixed budget: the tale under way, open facts that matter here
// first, the history of anyone or anywhere the player names, then earlier tales, shorter the older they are.
export const memoryLimits={activeBeats:14,closedBeats:8,taleBeats:4,fullTales:4,longSummaries:30,tales:120,openFacts:40,settledFacts:20,factsPerTurn:2,budget:4500};
const memText=(text,max=160)=>{const t=String(text??'').replace(/\s+/g,' ').trim();return t.length>max?t.slice(0,max-1).trimEnd()+'…':t;};
const memList=names=>names.length<=1?names.join(''):names.slice(0,-1).join(', ')+' and '+names.at(-1);
const memTaleStart=/^(.*): (?:the tale began at|a new tale began nearby, at|a new tale began, far away, at) (.*?)\.?$/;
const freshFolded=()=>({met:[],metN:0,places:[],placesN:0,fights:0,won:0,fled:0,gold:0,finds:0,rests:0,more:0});
const freshChapter=(n,title='')=>({n,title:memText(title,100),done:false,beats:[],folded:freshFolded()});
// How much a line of the story matters when there is no room to keep them all (storyLog.js wording).
const beatRanks=[
 [/^Settled: |^Died|^You killed |was killed\.$|^Adventure complete|^Saw a lead through/,10],
 [/swore never to forgive you|forgave you\.$|owes you a debt for life|^Fell to |^Was beaten by |^Fell, dying|^Clung to life/,9],
 [/ joined you\.$| left your company\.$|turned against you|^Set out for a new land|^Remembered: /,8],
 [/^Slew |^Beat |^Defeated |^You knocked |^Fled from /,7],
 [/^Met |^You won .* over\.$|turned cold toward you|reached level|^Ready for level/,6],
 [/^Found |^Went down into|^Came back up|was struck down|stayed behind to wait/,5],
 [/for the first time\.$/,4],
 [/^A fight broke out|^Fought |^Gave up |came round\.$/,3],
 [/^Learned of |^Gained \d+ gold|^Paid \d+ gold|^Got /,2],
 [/^Returned to |^Took a (?:long|short) rest/,1],
];
export function beatRank(text){for(const [re,n] of beatRanks)if(re.test(text))return n;return 3;}
// A line given up for room is kept as a count or a name in its chapter's `folded` record.
function foldBeat(f,text){
 const name=(re)=>{const m=text.match(re);return m?memText(m[1],60):null;};
 const met=name(/^Met (.+?)(?:, |\.$)/),place=name(/^Found (.+)\.$/)??name(/^Learned of (.+?)(?:, |\.$)/)??name(/^Reached (.+?) for the first time\.$/)??name(/^Set out for a new land: (.+)\.$/);
 if(met){if(f.met.length<6&&!f.met.includes(met))f.met.push(met);else f.metN++;}
 else if(place){if(f.places.length<6&&!f.places.includes(place))f.places.push(place);else f.placesN++;}
 else if(/^(?:A fight broke out|Fought )/.test(text))f.fights++;
 else if(/^(?:Slew|Beat|Defeated) /.test(text))f.won++;
 else if(/^Fled from /.test(text))f.fled++;
 else if(/^Gained \d+ gold/.test(text))f.gold+=Number(text.match(/\d+/)[0]);
 else if(/^Paid \d+ gold/.test(text))f.gold-=Number(text.match(/\d+/)[0]);
 else if(/^(?:Got|Gave up) /.test(text))f.finds++;
 else if(/^Took a (?:long|short) rest/.test(text))f.rests++;
 else f.more++;
 return f;
}
// Keep at most `room` lines: the least important (the oldest of them first) are folded away.
function trimBeats(chapter,room){
 if(chapter.beats.length<=room)return chapter;
 const beats=[...chapter.beats],folded={...chapter.folded,met:[...chapter.folded.met],places:[...chapter.folded.places]};
 while(beats.length>room){let worst=0;for(let i=1;i<beats.length;i++)if(beatRank(beats[i])<beatRank(beats[worst]))worst=i;foldBeat(folded,beats[worst]);beats.splice(worst,1);}
 return {...chapter,beats,folded};
}
export function foldedText(f){
 if(!f)return '';const parts=[];
 if(f.met.length)parts.push('met '+memList([...f.met,...(f.metN?[f.metN+' more']:[])]));
 if(f.places.length)parts.push('came upon '+memList([...f.places,...(f.placesN?[f.placesN+' more']:[])]));
 if(f.won||f.fled||f.fights)parts.push((f.won?'won '+f.won:'')+(f.won&&f.fled?', ':'')+(f.fled?'fled '+f.fled:'')+((f.won||f.fled)&&f.fights?' of ':'')+(f.fights?f.fights+' fight'+(f.fights>1?'s':''):' fight'+(f.won+f.fled>1?'s':'')));
 if(f.gold)parts.push(f.gold>0?'gained '+f.gold+' gold':'spent '+(-f.gold)+' gold');
 if(f.finds)parts.push(f.finds+' find'+(f.finds>1?'s':'')+' and trade'+(f.finds>1?'s':''));
 if(f.rests)parts.push(f.rests+' rest'+(f.rests>1?'s':''));
 if(f.more)parts.push(f.more+' lesser moment'+(f.more>1?'s':''));
 return parts.join('; ');
}
const statusWords={active:'under way',complete:'completed',left:'left unfinished'};
// A closed tale's own summary (kept when its chapters are folded away): how it ended, its chapters and what mattered most.
function memTaleSummary(tale){
 const beats=tale.chapters.flatMap(c=>c.beats).filter(b=>beatRank(b)>=7);
 const folded=foldedText(tale.chapters.reduce((all,c)=>{for(const b of c.folded.met)if(all.met.length<6&&!all.met.includes(b))all.met.push(b);else all.metN++;all.metN+=c.folded.metN;for(const b of c.folded.places)if(all.places.length<6&&!all.places.includes(b))all.places.push(b);else all.placesN++;all.placesN+=c.folded.placesN;for(const k of ['fights','won','fled','gold','finds','rests','more'])all[k]+=c.folded[k];return all;},freshFolded()));
 const titles=tale.chapters.map(c=>c.title).filter(Boolean);
 return memText(statusWords[tale.status]+(tale.began?', begun at '+tale.began:'')+'.'+(titles.length?' Chapters: '+titles.join('; ')+'.':'')+(beats.length?' '+beats.join(' '):'')+(folded?' Also: '+folded+'.':''),400);
}
function closeTale(tale){
 if(!tale||tale.summary)return tale;
 const closed={...tale,status:tale.status==='active'?'left':tale.status,chapters:tale.chapters.map(c=>trimBeats({...c,done:true},memoryLimits.taleBeats))};
 return {...closed,summary:memTaleSummary({...tale,status:closed.status})};
}
// Older tales are kept more briefly: the newest few closed tales keep their chapters; then the summary alone; past
// a hundred and twenty tales the oldest are folded into one line (era).
function compressTales(m){
 let tales=m.tales,era=m.era;
 let seen=0;
 tales=[...tales].reverse().map(t=>{if(!t.summary)return t;seen++;if(seen>memoryLimits.fullTales&&t.chapters.length)t={...t,chapters:[]};if(seen>memoryLimits.longSummaries&&t.summary&&t.summary.length>160)t={...t,summary:memText(t.summary,160)};return t;}).reverse();
 while(tales.length>memoryLimits.tales){const old=tales[0];tales=tales.slice(1);const line=old.title+' ('+statusWords[old.status]+')';era={count:(era?.count??0)+1,text:memText(era?.text?era.text+'; '+line:line,1500)};}
 return {...m,tales,...(era?{era}:{})};
}
const emptyMemory=()=>({v:1,cursor:{id:0,text:''},tales:[],facts:[],nextFact:1});
// The game's own story: the current story's chapter titles where the tale being told is this one.
function currentChapterTitle(game,tale,n){return game?.story&&tale&&game.story.title===tale.title?game.story.chapters?.[n-1]?.title??'':'';}
function openTale(m,game,title,began){
 const tales=m.tales.map((t,i)=>i===m.tales.length-1?closeTale(t):t);
 const no=(m.tales.at(-1)?.no??m.era?.count??0)+1,tale={no,title:memText(title,120)||'A tale',status:'active',...(began?{began:memText(began,80)}:{}),chapters:[]};
 tale.chapters=[freshChapter(1,currentChapterTitle(game,tale,1))];
 return compressTales({...m,tales:[...tales,tale]});
}
function withCurrentTale(m,game){
 const last=m.tales.at(-1);if(last&&!last.summary)return m;
 return openTale(m,game,game?.story?.title??'Earlier days',null);
}
// One line of the story log, folded into the chronicle where it happened.
function foldLine(m,game,line){
 const text=String(line.text??'');
 if(line.kind==='story'){
  const start=text.match(memTaleStart);
  if(start)return openTale(m,game,start[1],start[2]);
  const ch=text.match(/^Chapter (\d+): (.+)$/);
  if(ch){m=withCurrentTale(m,game);const tales=[...m.tales],tale={...tales.at(-1)},n=Number(ch[1]);
   tale.chapters=[...tale.chapters.map(c=>c.done?c:trimBeats({...c,done:true},memoryLimits.closedBeats)),freshChapter(n,ch[2])];
   tales[tales.length-1]=tale;return {...m,tales};}
 }
 m=withCurrentTale(m,game);
 const tales=[...m.tales],tale={...tales.at(-1)};
 if(/^Finished chapter \d+/.test(text))return m;
 if(/^Adventure complete: /.test(text))tale.status='complete';
 const chapters=[...tale.chapters],c={...chapters.at(-1)};
 c.beats=[...c.beats,memText(text,160)];chapters[chapters.length-1]=trimBeats(c,memoryLimits.activeBeats);
 tale.chapters=chapters;tales[tales.length-1]=tale;return {...m,tales};
}
// The memory as it stands: the saved one with any story log lines it has not yet folded (an old save without one is
// built from its log: the tales it no longer holds come from storyHistory and the journal's "Previously" note).
const memoryCache=new WeakMap();
export function memoryOf(game){
 if(!game||typeof game!=='object')return emptyMemory();
 const log=Array.isArray(game.storyLog)?game.storyLog:[];
 const key=game.storyLog??game,cached=memoryCache.get(key);if(cached&&cached.from===game.memory)return cached.memory;
 let m=game.memory&&typeof game.memory==='object'?game.memory:null,start=0;
 if(!m){
  m=emptyMemory();
  // Earlier tales the log has scrolled past (or never held) are known by their titles.
  const told=new Set(log.map(l=>String(l.text).match(memTaleStart)?.[1]).filter(Boolean));
  for(const title of (Array.isArray(game.storyHistory)?game.storyHistory:[]).filter(t=>typeof t==='string'&&t!==game.story?.title&&!told.has(t)))m={...m,tales:[...m.tales,{no:m.tales.length+1,title:memText(title,120),status:'left',chapters:[],summary:'From before the chronicle was kept.'}]};
 if(m.tales.length&&![...told].some(t=>t!==game.story?.title)){const previously=(game.journal?.entries??[]).find(e=>e.title==='Previously');if(previously){const tales=[...m.tales];tales[tales.length-1]={...tales.at(-1),summary:memText(previously.text,400)};m={...m,tales};}}
 }else{
  const c=m.cursor??{id:0,text:''},at=log.findIndex(l=>l.id===c.id);
  if(at>=0&&log[at].text===c.text)start=at+1;
  else if(log.length&&log[0].id>c.id)start=0;
  else if(log.length&&(at>=0||log.at(-1).id<c.id||c.id===0)){
   // The log began again (a new adventure without the old one's log): the tale under way is over.
   start=0;if(c.id>0&&m.tales.length&&!m.tales.at(-1).summary){const tales=[...m.tales];tales[tales.length-1]=closeTale(tales.at(-1));m={...m,tales};}
  }else start=log.length;
 }
 for(let i=start;i<log.length;i++)m=foldLine(m,game,log[i]);
 if(start<log.length)m={...m,cursor:{id:log.at(-1).id,text:log.at(-1).text}};
 // The tale under way takes its chapter titles from the story itself.
 const last=m.tales.at(-1);
 if(last&&!last.summary&&game.story?.title===last.title&&game.story.chapters){const fixed=last.chapters.map(c=>!c.title&&game.story.chapters[c.n-1]?{...c,title:memText(game.story.chapters[c.n-1].title,100)}:c);if(fixed.some((c,i)=>c!==last.chapters[i])){const tales=[...m.tales];tales[tales.length-1]={...last,chapters:fixed};m={...m,tales};}}
 if(last&&!last.summary&&last.status!=='complete'&&game.story?.title===last.title&&game.story.status==='complete'){const tales=[...m.tales];tales[tales.length-1]={...tales.at(-1),status:'complete'};m={...m,tales};}
 memoryCache.set(key,{from:game.memory,memory:m});
 return m;
}
// Kept in the save: run after every settled turn (turnRules.js), so the chronicle never falls behind the log.
export function withMemory(game){
 if(!game||typeof game!=='object')return game;
 const m=memoryOf(game);if(m===game.memory)return game;
 if(!game.memory&&!m.tales.length&&!m.facts.length)return game;
 return {...game,memory:m};
}
// The tale that has just ended, closed (a new tale is starting: sequelRules.js carriedBase).
export function closedMemory(game){
 let m=memoryOf(game);if(!m.tales.length&&!m.facts.length)return null;
 const last=m.tales.at(-1);
 if(last&&!last.summary){const tales=[...m.tales];tales[tales.length-1]=closeTale({...last,status:last.status==='complete'||game?.story?.status==='complete'?'complete':'active'});m=compressTales({...m,tales});}
 return m;
}
// People and places are numbered afresh in a next tale (sequelRules.js joinRegion): facts follow them, and an id
// that did not come along is dropped (the names stay in the fact's own words).
export function remappedMemory(m,people={},places={}){
 if(!m)return m;
 const map=id=>Object.hasOwn(people,id)?people[id]:Object.hasOwn(places,id)?places[id]:null;
 return {...m,facts:m.facts.map(f=>({...f,about:f.about.map(map).filter(Boolean)}))};
}
// ---------- Facts the Dungeon Master asks the game to remember ----------
const mechanical=/\b\d+\s*(?:hp|hit points?|xp|ac|dc)\b|\b(?:hit points?|armou?r class|spell slots?|initiative|saving throws?|d20|\d*d\d+|experience points?|level up)\b/i;
const factWords=t=>new Set((String(t).toLowerCase().match(/[a-z0-9']+/g)??[]).filter(w=>w.length>2));
function sameFact(a,b){const A=factWords(a),B=factWords(b),small=Math.min(A.size,B.size);if(!small)return false;let shared=0;for(const w of A)if(B.has(w))shared++;return shared/small>=0.8;}
export const factIdPattern=/^f\d{1,6}$/;
// One `remember` item: {text, about:[ids], settles:null|fact id}. Up to two a turn; too short or long, mechanical,
// a repeat of an open fact, or settling a fact that is not open: left out (never a reason to refuse a turn).
export function rememberFacts(game,list,{newId=null}={}){
 const items=(Array.isArray(list)?list:[]).filter(i=>i&&typeof i==='object').slice(0,memoryLimits.factsPerTurn);
 if(!items.length)return {game,lines:[]};
 let m=memoryOf(game);
 const people=new Set(npcIdsOf(game)),places=new Set(knownPlaceIds(game)),lines=[];
 const nameOf=id=>people.has(id)?npcLore(game,id)?.name??null:placeName(game,id);
 const at=m.cursor?.id??0;
 for(const item of items){
  const text=memText(item.text,200);if(text.length<8||text.length>180||mechanical.test(text))continue;
  const fact=memText(text,160);
  const settles=typeof item.settles==='string'&&item.settles.trim()?item.settles.trim():null,open=settles?m.facts.find(f=>!f.settled&&f.id===settles):null;
  if(settles&&!open)continue;
  if(open){
   m={...m,facts:m.facts.map(f=>f===open?{...f,settled:fact,settledAt:at}:f)};
   m=addBeat(m,game,memText('Settled: '+open.text.replace(/[.\s]+$/,'')+' — '+fact,160));lines.push('Settled: '+fact);continue;
  }
  if(m.facts.some(f=>!f.settled&&sameFact(f.text,fact)))continue;
  const about=[...new Set((Array.isArray(item.about)?item.about:[]).map(id=>id==='new'&&newId?newId:id).filter(id=>typeof id==='string'&&(people.has(id)||places.has(id))))].slice(0,4);
  const names=about.map(nameOf).filter(Boolean).map(n=>memText(n,60));
  m={...m,facts:[...m.facts,{id:'f'+m.nextFact,text:fact,about,names,tale:m.tales.at(-1)?.no??0,at}],nextFact:m.nextFact+1};
  lines.push('Remembered: '+fact);
 }
 m=tidyFacts(m,game);
 return {game:lines.length?{...game,memory:m}:game,lines};
}
function addBeat(m,game,text){
 m=withCurrentTale(m,game);const tales=[...m.tales],tale={...tales.at(-1)},chapters=[...tale.chapters],c={...chapters.at(-1)};
 c.beats=[...c.beats,text];chapters[chapters.length-1]=trimBeats(c,memoryLimits.activeBeats);tale.chapters=chapters;tales[tales.length-1]=tale;return {...m,tales};
}
// Room for facts: the oldest open facts past forty are folded into the chronicle ("Remembered: …"); settled facts past
// twenty are let go (their settling is already a line of the chronicle).
function tidyFacts(m,game){
 let facts=m.facts;
 const open=facts.filter(f=>!f.settled);
 for(const f of open.slice(0,Math.max(0,open.length-memoryLimits.openFacts))){m=addBeat(m,game,memText('Remembered: '+f.text,160));facts=facts.filter(x=>x!==f);}
 const settled=facts.filter(f=>f.settled);
 for(const f of settled.slice(0,Math.max(0,settled.length-memoryLimits.settledFacts)))facts=facts.filter(x=>x!==f);
 return {...m,facts};
}
// ---------- Checks on a save ----------
const memInt=(v,lo,hi)=>Number.isSafeInteger(v)&&v>=lo&&v<=hi;
const memStr=(v,lo,hi)=>typeof v==='string'&&v.length>=lo&&v.length<=hi;
const validFolded=f=>!!f&&typeof f==='object'&&Array.isArray(f.met)&&f.met.length<=6&&f.met.every(n=>memStr(n,1,60))&&Array.isArray(f.places)&&f.places.length<=6&&f.places.every(n=>memStr(n,1,60))&&['metN','placesN','fights','won','fled','finds','rests','more'].every(k=>memInt(f[k],0,1e7))&&memInt(f.gold,-1e9,1e9);
const validChapter=c=>!!c&&typeof c==='object'&&memInt(c.n,0,99)&&memStr(c.title,0,100)&&typeof c.done==='boolean'&&Array.isArray(c.beats)&&c.beats.length<=memoryLimits.activeBeats+2&&c.beats.every(b=>memStr(b,1,160))&&validFolded(c.folded);
const validTale=t=>!!t&&typeof t==='object'&&memInt(t.no,1,1e7)&&memStr(t.title,1,120)&&['active','complete','left'].includes(t.status)&&(t.status!=='active'||t.summary===undefined)&&(t.began===undefined||memStr(t.began,1,80))&&(t.summary===undefined||memStr(t.summary,1,400))&&Array.isArray(t.chapters)&&t.chapters.length<=40&&t.chapters.every(validChapter);
const validFact=f=>!!f&&typeof f==='object'&&factIdPattern.test(f.id)&&memStr(f.text,1,160)&&Array.isArray(f.about)&&f.about.length<=4&&f.about.every(id=>typeof id==='string'&&/^[a-z][a-z0-9:_-]{0,40}$/.test(id))&&Array.isArray(f.names)&&f.names.length<=4&&f.names.every(n=>memStr(n,1,60))&&memInt(f.tale,0,1e7)&&memInt(f.at,0,1e12)&&(f.settled===undefined||memStr(f.settled,1,160))&&(f.settledAt===undefined||memInt(f.settledAt,0,1e12));
export function validMemory(m){
 if(m===undefined)return true;
 if(!m||typeof m!=='object'||Array.isArray(m)||m.v!==1)return false;
 if(!m.cursor||!memInt(m.cursor.id,0,1e12)||!memStr(m.cursor.text,0,160))return false;
 if(!Array.isArray(m.tales)||m.tales.length>memoryLimits.tales||!m.tales.every(validTale)||m.tales.slice(0,-1).some(t=>t.summary===undefined))return false;
 if(m.era!==undefined&&!(m.era&&memInt(m.era.count,1,1e7)&&memStr(m.era.text,1,1500)))return false;
 if(!Array.isArray(m.facts)||m.facts.length>memoryLimits.openFacts+memoryLimits.settledFacts||!m.facts.every(validFact)||new Set(m.facts.map(f=>f.id)).size!==m.facts.length)return false;
 return memInt(m.nextFact,1,1e7)&&m.facts.every(f=>Number(f.id.slice(1))<m.nextFact);
}
// ---------- What the Dungeon Master is told each turn ----------
// Everything as short strings, fitted to a fixed budget in order of what matters now: the tale under way and its
// chapter, the open facts about whoever and wherever is here (or named), the history of people and places the player
// names, the earlier chapters, the last tale, settled facts that bear on this, other open facts briefly, and earlier
// tales more briefly the older they are.
const chapterLine=(c,now)=>'Chapter '+c.n+(c.title?', '+c.title:'')+(now?' (now)':c.done?' (done)':'')+': '+(c.beats.length?c.beats.join(' '):'')+(foldedText(c.folded)?(c.beats.length?' Also: ':'')+foldedText(c.folded)+'.':'');
const memoryShares={taleNow:1700,facts:1300,about:700,settledFacts:450,otherFacts:650,earlierTales:1500};
export function memoryBlock(game,{input='',present=[]}={}){
 const m=memoryOf(game);if(!m.tales.length&&!m.facts.length)return null;
 const items=[],add=(section,text,rank)=>{if(text)items.push({section,text,rank,order:items.length});};
 const here=mapLocation(game),said=String(input??'');
 const people=npcIdsOf(game),named=people.filter(id=>{const n=npcLore(game,id)?.name;return n&&said.length>=3&&mentionsName(said,n);});
 const placesSaid=knownPlaceIds(game).filter(id=>{const n=placeName(game,id);return n&&n.length>=3&&said.toLowerCase().includes(n.toLowerCase().replace(/^the /,''));});
 const near=new Set([...present,here,...named,...placesSaid,...Object.entries(game.followers??{}).filter(([,f])=>f?.status==='following').map(([id])=>id)]);
 const nearNames=[...near].map(id=>people.includes(id)?npcLore(game,id)?.name:placeName(game,id)).filter(Boolean);
 const bears=f=>f.about.some(id=>near.has(id))||f.names.some(n=>nearNames.includes(n)||mentionsName(said,n))||(said.length>=3&&nearNames.some(n=>mentionsName(f.text,n)));
 // The tale under way.
 const total=m.tales.length+(m.era?.count??0),now=m.tales.length&&!m.tales.at(-1).summary?m.tales.at(-1):null;
 if(now){
  add('taleNow','Tale '+now.no+' of '+total+': '+now.title+' ('+statusWords[now.status]+(now.began?', begun at '+now.began:'')+').',100);
  now.chapters.forEach((c,i)=>{const last=i===now.chapters.length-1;add('taleNow',memText(chapterLine(c,last),last?1100:i>=now.chapters.length-2?420:260),last?96:80-(now.chapters.length-i));});
 }
 // Facts: those that bear on this moment first, then the rest briefly; settled ones only where they bear on it.
 const fact=f=>f.id+(f.names.length?' ['+f.names.join(', ')+']':'')+': '+f.text;
 const open=m.facts.filter(f=>!f.settled).reverse(),relevant=open.filter(bears),others=open.filter(f=>!bears(f));
 relevant.forEach((f,i)=>add('facts',fact(f),94-i*0.01));
 others.forEach((f,i)=>add('otherFacts',memText(fact(f),90),i<6?78-i*0.01:58-i*0.01));
 m.facts.filter(f=>f.settled&&bears(f)).reverse().slice(0,4).forEach((f,i)=>add('settledFacts',memText(f.id+': '+f.text.replace(/[.\s]+$/,'')+' — settled: '+f.settled,240),72-i));
 // Anyone or anywhere the player names: every line of the chronicle that speaks of them.
 const lines=m.tales.flatMap(t=>t.chapters.flatMap(c=>c.beats.map(b=>({t,b}))));
 for(const id of [...named,...placesSaid].slice(0,3)){
  const name=people.includes(id)?npcLore(game,id)?.name:placeName(game,id);if(!name)continue;
  const told=lines.filter(({b})=>mentionsName(b,name)).map(({t,b})=>(t===now?'':t.title+': ')+b);
  if(told.length)add('about',memText(name+': '+told.slice(-8).join(' '),600),88);
 }
 // Earlier tales, newest first: the last few with their summaries, then shorter, then by title only.
 const closed=m.tales.filter(t=>t.summary).reverse();
 closed.forEach((t,i)=>{
  const head='Tale '+t.no+': '+t.title+' — '+(t.summary??statusWords[t.status]);
  if(i<3)add('earlierTales',memText(head,i===0?480:300),76-i*4);
  else if(i<12)add('earlierTales',memText(head,150),50-i);
 });
 // The oldest of all, in the order they were lived: the first tales and the last of these always named, the middle counted.
 if(closed.length>12||m.era){
  const oldest=[...(m.era?[m.era.text]:[]),...closed.slice(12).reverse().map(t=>t.title+' ('+statusWords[t.status]+')')];
  let line='Before that, oldest first: '+oldest.join('; ');
  for(let cut=1;line.length>500&&cut<oldest.length;cut++){const head=Math.ceil((oldest.length-cut)/2),tail=oldest.length-cut-head;line='Before that, oldest first: '+[...oldest.slice(0,head),'… '+cut+' more …',...(tail?oldest.slice(-tail):[])].join('; ');}
  add('earlierTales',memText(line,520),75);
 }
 // Fit the budget: the most important first, each section keeping its own order.
 // Each part has a share of the budget, so a crowd of facts never pushes the tale out (and the other way about).
 const kept=[],used={},size=()=>JSON.stringify(memoryGroups(kept)).length;
 for(const it of [...items].sort((a,b)=>b.rank-a.rank)){
  const cost=it.text.length+3;if((used[it.section]??0)+cost>memoryShares[it.section])continue;
  kept.push(it);if(size()>memoryLimits.budget){kept.pop();continue;}used[it.section]=(used[it.section]??0)+cost;
 }
 const block=memoryGroups(kept);
 const left=open.length-kept.filter(i=>i.section==='facts'||i.section==='otherFacts').length;
 if(left>0)block.moreFacts=left;
 return block;
}
function memoryGroups(items){
 const out={};for(const it of [...items].sort((a,b)=>a.order-b.order))(out[it.section]??=[]).push(it.text);return out;
}
// ---------- The story so far, for the Log tab ----------
// Earlier tales (and chapters that have scrolled out of the story log) as short readable lines, newest first.
export function chronicleView(game){
 const m=memoryOf(game),firstLogged=(Array.isArray(game?.storyLog)?game.storyLog:[])[0]?.id??Infinity;
 const tales=m.tales.filter(t=>t.summary).reverse().map(t=>({no:t.no,title:t.title,status:statusWords[t.status],text:t.summary??''}));
 return {tales,era:m.era??null,openFacts:m.facts.filter(f=>!f.settled).length,firstLogged};
}
