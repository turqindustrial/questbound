// The Written tales shelf (the stories spec, sections 1 and 2.8; WRITTEN-TALES.md): tales written by hand, checked, and
// kept for good in the host's data folder `.questbound-written/` (git-ignored, under QUESTBOUND_DATA when hosted, with a
// copy in the host's Desktop folder "Questbound written tales"), one `<slug>.json` a tale. The Dungeon Master serves
// them: the listing carries each tale's card (its pitch and the card's fields, never a secret, a chapter title, the
// staging or the walkthrough) and a start hands over a player's own copy of the story at once, costing no AI and no
// allowance (dm-server.cjs). Tales are never retired; `plays.json` counts starts for measurement only.
// A file is served only when it passes the shelf's check: the card's fields within their limits, and the copy a player
// would start accepted by the game's own rules (stagingRules.js writtenCheck, run through rules-engine.cjs storyChecks).
// The verdict is kept per file by its time and size, so a tale is checked once; a refused file is noted in the
// diagnostics with mechanical fields only (its file name, why, how many problems). The folder is read again within 30 s
// of a change. The running Dungeon Master keeps this module loaded between requests: bump `revision` (and the literal
// in dm-server.cjs loadWritten) when it changes.
const revision=1;
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const writtenIdPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const writtenSlugPattern=/^[a-z0-9-]{3,28}$/;
const writtenTiers=['short','medium','long'];
const writtenTerrains=['plains','forest','hills','mountains','coast','marsh','desert','snow','caverns'];
const writtenDifficulties=['gentle','steady','hard'];
const pitchLimits={hook:140,blurb:300,mood:40,special:160};
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const line=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const oneLine=v=>String(v).replace(/\s+/g,' ').trim();
// What makes a tale file fit to serve, before the rules see it: the shelf's own fields (WRITTEN-TALES.md, The file).
function fileProblem(tale,name){
 if(!plain(tale))return 'not an object';
 if(tale.format!==1)return 'format';
 if(!writtenIdPattern.test(String(tale.id)))return 'id';
 if(typeof tale.slug!=='string'||!writtenSlugPattern.test(tale.slug)||name!==tale.slug+'.json')return 'slug';
 if(!Number.isInteger(tale.edition)||tale.edition<1||tale.edition>999)return 'edition';
 if(!Number.isInteger(tale.order)||tale.order<0||tale.order>9999)return 'order';
 if(typeof tale.listed!=='boolean')return 'listed';
 if(typeof tale.addedAt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(tale.addedAt))return 'addedAt';
 if(!writtenTiers.includes(tale.length))return 'length';
 if(!Array.isArray(tale.minutes)||tale.minutes.length!==2||!tale.minutes.every(m=>Number.isInteger(m)&&m>0&&m<=2000)||tale.minutes[0]>=tale.minutes[1])return 'minutes';
 if(!writtenDifficulties.includes(tale.difficulty))return 'difficulty';
 if(!['any','together'].includes(tale.party))return 'party';
 if(!Array.isArray(tale.levels)||tale.levels.length!==2||!tale.levels.every(l=>Number.isInteger(l)&&l>=1&&l<=20)||tale.levels[0]>tale.levels[1])return 'levels';
 if(tale.firstTale!==undefined&&tale.firstTale!==true)return 'firstTale';
 if(tale.notes!==undefined&&(!Array.isArray(tale.notes)||tale.notes.length>3||!tale.notes.every(n=>line(n,20))))return 'notes';
 if(!plain(tale.pitch)||!Object.entries(pitchLimits).every(([k,max])=>line(tale.pitch[k],max)))return 'pitch';
 if(!plain(tale.story)||!plain(tale.story.staging)||!line(tale.story.title,100))return 'story';
 return null;
}
// The copy a player starts: the story with an id of its own, active, tagged with the tale it came from, its edition and
// its length (validWrittenTag), and painted under the tale's own art id, so its places and people are painted once for
// every player of the tale.
const artIdOf=id=>'journey-'+id;
function copyOf(entry,id=crypto.randomUUID()){
 return {...JSON.parse(JSON.stringify(entry.story)),id,status:'active',libraryId:entry.id,artId:artIdOf(entry.id),written:{slug:entry.slug,edition:entry.edition,length:entry.length}};
}
// The rules' check of a copy (stagingRules.js writtenCheck), from the same rules every device runs.
function defaultCheck(story){
 try{return require('./rules-engine.cjs').storyChecks().writtenCheck(story);}catch(e){return {ok:false,problems:['the rules could not be loaded']};}
}
// The cover: where the tale begins, painted (free, from the place library) under the tale's art id: the same picture
// its opening scene shows.
function coverSubject(entry){
 const s=entry.story,inn=s?.locations?.inn;if(!plain(inn)||typeof inn.name!=='string'||typeof inn.description!=='string')return null;
 const terrain=writtenTerrains.includes(s.terrain)?s.terrain:null,placeKind=typeof inn.kind==='string'?inn.kind:null;
 return {campaignId:artIdOf(entry.id),kind:'landscape',id:'inn',name:inn.name.trim().slice(0,100),description:inn.description.trim().slice(0,1800),setting:String(s.premise??'').slice(0,800),...(terrain?{terrain}:{}),...(placeKind?{placeKind}:{})};
}
// What a device may see of a tale: its card, never its secrets (no secret, chapter titles or goals, staging, endings'
// words or walkthrough; only counts).
function publicTale(entry,{cover=null}={}){
 const s=entry.story,st=s.staging,subject=coverSubject(entry);
 const chapters=Array.isArray(s.chapters)?s.chapters.length:0,endings=Array.isArray(st?.endings)?st.endings.length:0;
 return {id:entry.id,slug:entry.slug,edition:entry.edition,order:entry.order,addedAt:entry.addedAt,length:entry.length,minutes:[...entry.minutes],difficulty:entry.difficulty,party:entry.party,levels:[...entry.levels],
  ...(entry.firstTale?{firstTale:true}:{}),notes:Array.isArray(entry.notes)?entry.notes.map(oneLine):[],
  title:oneLine(s.title).slice(0,100),hook:oneLine(entry.pitch.hook),blurb:oneLine(entry.pitch.blurb),mood:oneLine(entry.pitch.mood),special:oneLine(entry.pitch.special),
  chapters,endings,region:typeof s.region==='string'&&s.region.trim()?oneLine(s.region).slice(0,60):null,terrain:writtenTerrains.includes(s.terrain)?s.terrain:null,
  cover:subject&&cover&&cover(subject)?subject:null};
}
// A refused file, noted in the diagnostics (live only): the file's name, the kind of refusal and how many problems,
// never the tale's words.
function diagnosticsNote(note){
 try{fs.appendFileSync(path.join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-diagnostics.jsonl'),JSON.stringify({at:new Date().toISOString(),written:'refused',...note})+'\n');}catch{}
}
function createShelf({dir=path.join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-written'),check=defaultCheck,onRefused=null,now=Date.now,random=Math.random,fresh=30000}={}){
 const verdicts=new Map(),dupNoted=new Set();let scanned=-Infinity,current=[];
 const playsFile=path.join(dir,'plays.json');
 const refuse=(name,stamp,reason,problems=0)=>{verdicts.set(name,{stamp,entry:null});try{onRefused?.({file:String(name).replace(/[^a-z0-9._-]/gi,'').slice(0,40),reason,problems});}catch{}};
 // Reads the folder: every <slug>.json but plays.json, each checked once for its time and size.
 function scan(){
  let names=[];try{names=fs.readdirSync(dir).filter(f=>f.endsWith('.json')&&f!=='plays.json');}catch{}
  const kept=[],ids=new Set();
  for(const name of names.sort()){
   let stat;try{stat=fs.statSync(path.join(dir,name));}catch{continue;}
   if(!stat.isFile()||stat.size>400000){if(stat.isFile())refuse(name,stat.mtimeMs+':'+stat.size,'too-large');continue;}
   const stamp=stat.mtimeMs+':'+stat.size,known=verdicts.get(name);
   let entry=known?.stamp===stamp?known.entry:undefined;
   if(entry===undefined){
    let tale;try{tale=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));}catch{refuse(name,stamp,'unreadable');continue;}
    const wrong=fileProblem(tale,name);if(wrong){refuse(name,stamp,'file:'+wrong);continue;}
    const verdict=check(copyOf(tale,'written-check'));
    if(!verdict?.ok){refuse(name,stamp,'rules',Array.isArray(verdict?.problems)?verdict.problems.length:1);continue;}
    entry={id:tale.id,slug:tale.slug,edition:tale.edition,order:tale.order,listed:tale.listed,addedAt:tale.addedAt,length:tale.length,minutes:tale.minutes,difficulty:tale.difficulty,party:tale.party,levels:tale.levels,firstTale:tale.firstTale===true,notes:tale.notes??[],pitch:tale.pitch,story:tale.story};
    verdicts.set(name,{stamp,entry});
   }
   if(!entry)continue;
   // Two files with one id: the first by name is served, the other refused.
   if(ids.has(entry.id)){if(!dupNoted.has(name+'|'+stamp)){dupNoted.add(name+'|'+stamp);try{onRefused?.({file:name.replace(/[^a-z0-9._-]/gi,'').slice(0,40),reason:'duplicate',problems:0});}catch{}}continue;}
   ids.add(entry.id);kept.push(entry);
  }
  for(const name of [...verdicts.keys()])if(!names.includes(name))verdicts.delete(name);
  current=kept.sort((a,b)=>(a.order-b.order)||(a.slug<b.slug?-1:1));scanned=now();
  return current;
 }
 const entries=()=>now()-scanned>=fresh?scan():current;
 const listed=()=>entries().filter(e=>e.listed);
 // The cards, in the shelf's own order (never newest first).
 const list=(opts={})=>listed().map(e=>publicTale(e,opts));
 const has=id=>writtenIdPattern.test(String(id))&&listed().some(e=>e.id===id);
 const readPlays=()=>{try{const v=JSON.parse(fs.readFileSync(playsFile,'utf8'));return plain(v)?v:{};}catch{return {};}};
 function countPlay(id){
  try{const plays=readPlays(),was=plain(plays[id])?plays[id]:{};plays[id]={plays:(Number.isInteger(was.plays)?was.plays:0)+1,last:new Date(now()).toISOString()};
   fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(playsFile+'.tmp',JSON.stringify(plays));fs.renameSync(playsFile+'.tmp',playsFile);}catch{}
 }
 // A player's own copy of a listed tale, or null (no such tale on the shelf).
 function start(id){
  if(!writtenIdPattern.test(String(id)))return null;
  const e=listed().find(x=>x.id===id);if(!e)return null;
  countPlay(e.id);return copyOf(e);
 }
 // Any listed tale of a length (else of any length), by chance: for a game from before the shelf asking for Let fate
 // decide or Easy to get into.
 function any(length='short'){
  const all=listed(),pool=all.filter(e=>e.length===length),from=pool.length?pool:all;
  return from.length?start(from[Math.floor(random()*from.length)%from.length].id):null;
 }
 const plays=()=>readPlays();
 const info=()=>{const all=entries();return {tales:all.length,listed:all.filter(e=>e.listed).length,refused:[...verdicts.values()].filter(v=>!v.entry).length};};
 return {list,start,any,has,plays,info,refresh:scan};
}
const shelf=createShelf({onRefused:diagnosticsNote});
module.exports={revision,createShelf,shelf,publicTale,coverSubject,copyOf,fileProblem,writtenIdPattern,writtenTiers};
