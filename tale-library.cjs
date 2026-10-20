// Ready journeys: a shared library of finished tales that players compare and choose between, ready to start at once
// (2026-10-13, the host's words: "refill the pre written tales list and make each of them a much more inviting journey,
// I want the players to have to think hard between which inviting journey reaches out to them the most, while not
// having to wait forever on new journeys and simultaneously using up less API costs overall").
// Each journey is written once, in the background, at the effort the host chose for the story writer, before anyone has
// chosen it (adventure-generator.cjs `ahead`: the hero is only "you"), with a pitch for the choosing screen (a hook, what
// you will do and face, a mood and what sets it apart) and a clear first errand (so every journey is an easy start).
// Many players each play their own copy, so the writing (and, through the journey's art id, the paintings of its own
// places and people: worldArtRules.js) is paid for once instead of once a player. A device never offers a journey it
// has already played (journeyLibrary.js). A journey retires after `retirePlays` plays or `retireDays` days on offer
// and is replaced one tale at a time: freely while fewer than `floor` are on offer, else at most `perDay` new tales in
// any day, so the library stays fresh without a burst of cost. Each new journey is given a terrain and a mood the
// library has least of and a seed premise none on offer started from, and is told the others' pitches, so no two are
// alike. A journey is offered only when the game's own rules accept it (dm-server.cjs journeyCheck).
// Journeys are kept on disk (.questbound-tales/, under QUESTBOUND_DATA when hosted) as journey-g<generation>-<uuid>.json,
// with library-state.json (recent writes and seeds, the last failure) so a restart keeps the pace. Tales from an earlier
// generation, and the old per-opening stock (<opening>-g4-<uuid>.json), are cleared away once when the library is made.
// The running Dungeon Master keeps this module loaded between requests (it is not reloaded with dm-server.cjs); bump
// `revision` (and the literal in dm-server.cjs loadLibrary) when it changes. Raise `generation` when the story writer's
// output changes shape.
const revision=4,generation=5;
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const day=86400000;
// The library's numbers (see the report of 2026-10-13 for the cost reckoning).
const librarySettings={size:10,floor:6,perDay:4,retirePlays:20,retireDays:14,graceDays:2,failurePause:10*60*1000};
const journeyTerrains=['plains','forest','hills','mountains','coast','marsh','desert','snow','caverns'];
// The moods a journey can be written in, each with a line for the story writer.
const journeyMoods=[
 {id:'mystery',label:'Mystery',steer:'a puzzle with clues to find and a truth to uncover; the answer surprises but was fairly hidden all along'},
 {id:'dread',label:'Dread',steer:'creeping horror: something is wrong and grows worse; told with restraint, never gratuitous'},
 {id:'intrigue',label:'Intrigue',steer:'factions, secrets and shifting loyalties; words are weapons and every ally wants something'},
 {id:'wonder',label:'Wonder',steer:'marvels and strange beauty; the world turns out bigger and stranger than the hero knew'},
 {id:'war',label:'War',steer:'armies, sieges and the people caught between them; courage, loyalty and the cost of winning'},
 {id:'heist',label:'Heist',steer:'a daring plan, unlikely allies, a guarded prize and everything that goes wrong; quick wits matter'},
 {id:'survival',label:'Survival',steer:'a hostile land, failing supplies and hard choices about who and what can be saved'},
 {id:'pursuit',label:'Pursuit',steer:'a chase across the land: someone must be caught, escorted or escaped before time runs out'},
 {id:'sorrow',label:'Sorrow',steer:'a bittersweet tale of loss, old wrongs and what can still be mended'},
 {id:'mirth',label:'Mirth',steer:'a lighter, rollicking tale of eccentric people and comic trouble that still has real danger and heart'}];
// Seed premises: a starting thought for the writer, who makes it its own (Questbound's own words throughout).
const journeySeeds=['a mountain kingdom whose heir has vanished and a pretender marching on the capital','a pilgrim road across a tidal marsh, a stolen reliquary and a spreading fever','a caravan city at the edge of a sand sea and a buried forge-city waking under the dunes','a northern march in a winter that will not end and a voice on the glacier calling the wolves','a kingdom under the mountains whose light-wells are going dark and a regent with something to hide','a great river port where people wake without their names and a guild that buys what they forget','a war-torn border, a prisoner who could end the war and two armies who want her dead','an island chain after a great storm, a drowned lighthouse and a fleet that never came home','a high steppe of horse clans, a broken truce and a stolen ancestor-banner','a jungle river of overgrown temples, a vanished expedition and a rival crew a day ahead','a city of canals in carnival week, a masked killer and a prince travelling in disguise','a frontier valley of new farms on old graves and something that has started to answer the church bell',
 'a salt-mining town that buries its dead in the old galleries, and lately the miners hear knocking from the sealed ones','a floating market of lashed-together barges drifting down a flooded valley, a drowned bell tower and a merchant who sells weather','a monastery of bell-ringers on a pillar of rock whose bells keep something asleep, and a novice who has stopped ringing','a hill country where every village keeps a tame giant as a neighbour, and one giant has walked off in the night carrying a child','a desert road of wind-shrines where a caravan has arrived with every traveller alive and none of them casting a shadow','a lakeside duchy at its once-a-generation tournament, a champion found dead in his armour before the first joust, and nine people with a reason','a snowbound pass where a mail coach of sealed letters has overturned, and every letter in it is a confession','a forest of stone trees in a salt marsh, a lantern-lit fishing village and a tide that has stopped going out','an orchard valley whose fruit gives whoever eats it one true memory, and someone harvesting it before the season','a city on a cliff where taxes are paid in years of service, a runaway with a stolen ledger and the collectors at your heels','a cavern realm of glowworm lakes where the map-makers\' guild has started drawing tunnels that do not exist yet','a shire of white cliffs where the gulls have gone silent, the boats come home empty and the lighthouse keeper writes only in riddles'];
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// One line of text, trimmed to its limit at a sentence or clause where it can be.
const pitchLine=(v,max)=>{const t=String(v??'').replace(/\s+/g,' ').trim();if(t.length<=max)return t;const cut=t.slice(0,max-1),stop=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf('; '),cut.lastIndexOf(', '));return (stop>max*.5?cut.slice(0,stop+1):cut.replace(/\s+\S*$/,'')+'…').trim();};
const firstLine=(v,max)=>pitchLine((String(v??'').replace(/\s+/g,' ').trim().match(/^.+?[.!?](?=\s|$)/)?.[0])??v,max);
// The pitch the choosing screen shows: what the writer wrote, kept to its limits, or (field by field) one built from the
// tale itself, so a journey is never offered with an empty card.
const pitchFields=[['hook',140],['blurb',420],['mood',40],['special',160]];
function tidyPitch(pitch,story,mood=null){
 const p=pitch&&typeof pitch==='object'?pitch:{},s=story??{};
 const fallback={hook:firstLine(s.premise,140),blurb:pitchLine(s.premise,420),mood:mood?.label??'Adventure',special:firstLine(s.objective,160)};
 return Object.fromEntries(pitchFields.map(([k,max])=>{const v=pitchLine(p[k],max);return [k,v.length>=(k==='mood'?3:12)?v:pitchLine(fallback[k],max)];}));
}
const validPitch=p=>!!p&&typeof p==='object'&&pitchFields.every(([k,max])=>typeof p[k]==='string'&&p[k].trim().length>0&&p[k].length<=max);
// The whole chapters a journey has (as the game will keep them), for "5 chapters" on its card.
const chapterCount=story=>{const n=(Array.isArray(story?.chapters)?story.chapters:[]).filter(c=>c&&typeof c==='object'&&[c.title,c.goal,c.turn].every(v=>typeof v==='string'&&v.trim())).length;return n>=2?Math.min(n,6):1;};
// The painting of where the journey begins: its card's cover, and the very picture the opening scene shows (the same
// art id, campaign and place), so it is painted once for every player of that journey.
const artIdOf=id=>'journey-'+id;
function coverSubject(entry){
 const inn=entry?.story?.locations?.inn;if(!inn||typeof inn.name!=='string'||typeof inn.description!=='string')return null;
 const terrain=journeyTerrains.includes(entry.story.terrain)?entry.story.terrain:null,placeKind=typeof inn.kind==='string'?inn.kind:null;
 return {campaignId:artIdOf(entry.id),kind:'landscape',id:'inn',name:inn.name.trim().slice(0,100),description:inn.description.trim().slice(0,1800),setting:String(entry.story.premise??'').slice(0,800),...(terrain?{terrain}:{}),...(placeKind?{placeKind}:{})};
}
// What a player's device may see of a journey: its pitch and nothing of the tale's secrets.
function publicJourney(entry,{cover=null}={}){
 const s=entry.story,subject=coverSubject(entry);
 return {id:entry.id,title:pitchLine(s.title,100),hook:entry.pitch.hook,blurb:entry.pitch.blurb,mood:entry.pitch.mood,special:entry.pitch.special,chapters:chapterCount(s),region:typeof s.region==='string'&&s.region.trim()?pitchLine(s.region,60):null,terrain:journeyTerrains.includes(s.terrain)?s.terrain:null,cover:subject&&cover&&cover(subject)?subject:null};
}
function createLibrary({dir=path.join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-tales'),now=Date.now,random=Math.random,...options}={}){
 const set={...librarySettings,...options};
 const current=new RegExp('^journey-g'+generation+'-[0-9a-f-]{36}\\.json$'),stateFile=path.join(dir,'library-state.json');
 // Tales of an earlier generation and the old stock of tales written ahead per opening are never served.
 try{for(const f of fs.readdirSync(dir))if(/^[a-z]+-(?:g\d+-)?[0-9a-f-]{36}\.json(?:\.tmp)?$/.test(f)&&!current.test(f))fs.rmSync(path.join(dir,f),{force:true});}catch{}
 let filling=null;
 const readState=()=>{try{const v=JSON.parse(fs.readFileSync(stateFile,'utf8'));if(v.generation!==generation)throw 0;return {full:v.full===true,writes:Array.isArray(v.writes)?v.writes.filter(Number.isFinite).slice(-40):[],seeds:Array.isArray(v.seeds)?v.seeds.filter(Number.isInteger).slice(-12):[],lastFailure:Number.isFinite(v.lastFailure)?v.lastFailure:-Infinity};}catch{return {full:false,writes:[],seeds:[],lastFailure:-Infinity};}};
 const writeJson=(file,value)=>{fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(value));fs.renameSync(file+'.tmp',file);};
 const saveState=state=>{try{writeJson(stateFile,{generation,full:state.full===true,writes:state.writes.slice(-40),seeds:state.seeds.slice(-12),lastFailure:Number.isFinite(state.lastFailure)?state.lastFailure:null});}catch{}};
 const fileOf=id=>path.join(dir,'journey-g'+generation+'-'+id+'.json');
 const sound=e=>!!e&&idPattern.test(String(e.id))&&!!e.story&&typeof e.story==='object'&&validPitch(e.pitch)&&Number.isFinite(e.offeredAt)&&Number.isInteger(e.plays);
 function entries(){
  let names=[];try{names=fs.readdirSync(dir).filter(f=>current.test(f));}catch{}
  const list=[];for(const f of names){try{const e=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));if(sound(e)&&f==='journey-g'+generation+'-'+e.id+'.json')list.push(e);else fs.rmSync(path.join(dir,f),{force:true});}catch{}}
  return list;
 }
 // Retires journeys that have been played enough or offered long enough, and clears away retired ones after a grace
 // period (a player who had the card on screen can still begin it for a while).
 function maintained(){
  const t=now(),kept=[];
  for(const e of entries()){
   if(e.retiredAt==null&&(e.plays>=set.retirePlays||t-e.offeredAt>=set.retireDays*day)){e.retiredAt=t;try{writeJson(fileOf(e.id),e);}catch{}}
   if(e.retiredAt!=null&&t-e.retiredAt>=set.graceDays*day){try{fs.rmSync(fileOf(e.id),{force:true});}catch{}continue;}
   kept.push(e);
  }
  return kept;
 }
 const offered=()=>maintained().filter(e=>e.retiredAt==null).sort((a,b)=>(a.offeredAt-b.offeredAt)||(a.id<b.id?-1:1));
 // Newest first, so a player who comes back sees what is new at the top.
 const list=(opts={})=>offered().reverse().map(e=>publicJourney(e,opts));
 // A copy of the journey for one player: a story of their own (its own id), which knows the journey it came from and
 // paints the journey's own places and people under the journey's art id.
 function start(id){
  if(!idPattern.test(String(id)))return null;
  const e=maintained().find(x=>x.id===id);if(!e)return null;
  e.plays++;if(e.retiredAt==null&&e.plays>=set.retirePlays)e.retiredAt=now();
  try{writeJson(fileOf(e.id),e);}catch{}
  return {...JSON.parse(JSON.stringify(e.story)),id:crypto.randomUUID(),status:'active',libraryId:e.id,artId:artIdOf(e.id)};
 }
 // Any journey on offer (for a game from before the library, asking for Let fate decide or Easy to get into).
 const any=()=>{const on=offered();return on.length?start(on[Math.floor(random()*on.length)].id):null;};
 // What the next journey is written to be: the terrain and the mood the library has least of, a seed premise no journey
 // on offer (nor the last few written) started from, and the pitches already on offer to differ from.
 function brief(on=offered()){
  const state=readState(),least=(items,used)=>{const counts=items.map(x=>used.filter(u=>u===x).length),low=Math.min(...counts),pool=items.filter((x,i)=>counts[i]===low);return pool[Math.floor(random()*pool.length)];};
  const terrain=least(journeyTerrains,on.map(e=>e.brief?.terrain??e.story.terrain));
  const mood=least(journeyMoods.map(m=>m.id),on.map(e=>e.brief?.mood?.id));
  const taken=new Set([...on.map(e=>e.brief?.seedIndex),...state.seeds]),free=journeySeeds.map((_,i)=>i).filter(i=>!taken.has(i)),pool=free.length?free:journeySeeds.map((_,i)=>i).filter(i=>!on.some(e=>e.brief?.seedIndex===i));
  const seedIndex=(pool.length?pool:journeySeeds.map((_,i)=>i))[Math.floor(random()*(pool.length||journeySeeds.length))];
  const others=on.map(e=>({title:pitchLine(e.story.title,100),region:e.story.region??null,terrain:e.story.terrain??null,mood:e.pitch.mood,hook:e.pitch.hook,foe:pitchLine(e.story.foe,80),threat:e.story.errand?.threat?.template??null,start:pitchLine(e.story.locations?.inn?.name,80)}));
  return {terrain,mood:journeyMoods.find(m=>m.id===mood),seed:journeySeeds[seedIndex],seedIndex,others};
 }
 // Whether another journey should be written now: the library is short of its size, and either it has never yet been
 // full (the first fill, or a new generation), or it is below its floor, or it is within the day's pace (attempts
 // count, so a failing writer cannot spend more than the pace allows).
 function due(){
  const n=offered().length,state=readState();
  if(n>=set.size){if(!state.full){state.full=true;saveState(state);}return false;}
  if(!state.full||n<set.floor)return true;
  const t=now();return state.writes.filter(w=>t-w<day).length<set.perDay;
 }
 // Starts writing one journey, unless one is being written, a write failed in the last ten minutes or none is due.
 // `write(brief)` resolves to {story,pitch}; `accept(story)` says whether the game's rules take it; `onStocked(entry)`
 // follows a journey into the library (its cover is painted); `onFailure(error)` hears why a write failed (its `kind`:
 // rejected by the rules, too like one on offer, no story, or the writer's own). When one is done, the next follows,
 // until none is due.
 function topUp(write,{accept=()=>true,onStocked=null,onFailure=null}={}){
  const state=readState();
  if(filling||now()-state.lastFailure<set.failurePause||!due())return false;
  const on=offered(),b=brief(on);state.writes.push(now());saveState(state);
  filling=Promise.resolve().then(()=>write(b)).then(result=>{
   const story=result?.story;if(!story||typeof story!=='object'||Array.isArray(story))throw Object.assign(Error('no story'),{kind:'no-story'});
   if(!accept(story))throw Object.assign(Error('the rules refused the tale'),{kind:'rejected'});
   const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.trim().toLowerCase()===b.trim().toLowerCase();
   if(on.some(e=>same(e.story.title,story.title)||(story.region&&same(e.story.region,story.region))))throw Object.assign(Error('too like a journey on offer'),{kind:'too-alike'});
   const t=now(),entry={id:crypto.randomUUID(),generation,at:new Date(t).toISOString(),offeredAt:t,plays:0,retiredAt:null,brief:{terrain:b.terrain,mood:b.mood,seedIndex:b.seedIndex},pitch:tidyPitch(result.pitch,story,b.mood),story};
   writeJson(fileOf(entry.id),entry);
   const after=readState();after.seeds.push(b.seedIndex);saveState(after);
   try{onStocked?.(entry);}catch{}
  }).then(()=>true,e=>{const after=readState();after.lastFailure=now();saveState(after);try{onFailure?.(e);}catch{}return false;}).then(ok=>{filling=null;if(ok)topUp(write,{accept,onStocked,onFailure});});
  return true;
 }
 // Resolves once nothing is being written (a chain of journeys included).
 const settled=async()=>{while(filling)await filling;};
 const info=()=>{const all=maintained(),t=now();return {offered:all.filter(e=>e.retiredAt==null).length,retired:all.filter(e=>e.retiredAt!=null).length,writesToday:readState().writes.filter(w=>t-w<day).length,size:set.size};};
 return {list,start,any,brief,due,topUp,settled,busy:()=>!!filling,info,offered,settings:set};
}
const library=createLibrary();
module.exports={revision,generation,librarySettings,journeyTerrains,journeyMoods,journeySeeds,tidyPitch,validPitch,chapterCount,coverSubject,publicJourney,artIdOf,createLibrary,library};
