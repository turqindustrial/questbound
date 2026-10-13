// The host's library of ready landscape paintings (2026-10-13, the host's words: "about 100-200 pre-generated
// images for image at the intro of an area that the player travels to rather than have them generated at the time
// of travel, to save money on the API"). Every picture of a place the player arrives at is taken from
// .questbound-place-art/ (<id>.jpg plus library.json: [{id, kind, terrain, light, name, description, file}]) at no
// cost; portraits and creatures are still painted (world-art.cjs). A place keeps the picture it was first given
// (its pick is kept under .questbound-art/place-picks/), two places of one tale get different pictures while the
// library has another that fits, and a place painted before the library keeps its painting. While the library is
// still being painted, a place whose land has nothing that fits yet is painted as before; once every kind of place
// has a picture in every terrain, a landscape is never painted again.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
// Copies of mapRules.js placeKinds and terrains (verify-world-art.cjs checks that they agree).
const placeKinds=['settlement','camp','road','forest','wilds','mountain','water','ruin','cave','shrine','landmark','lair'];
const terrains=['plains','forest','hills','mountains','coast','marsh','desert','snow','caverns'];
// The library's own paintings are made through the Dungeon Master under this campaign: never answered from the library.
const libraryCampaign='questbound-place-library-v1';
const libraryEligible=subject=>subject?.kind==='landscape'&&!String(subject.campaignId).startsWith('questbound-place-library');
// When nothing of the same kind fits in a land, the nearest kinds of place do.
const relatedKinds={settlement:['camp','road'],camp:['settlement','road','wilds'],road:['wilds','settlement','camp'],forest:['wilds','road'],wilds:['road','forest','mountain','water'],mountain:['wilds','cave'],water:['wilds','road'],ruin:['landmark','shrine','lair'],cave:['lair','ruin','mountain'],shrine:['ruin','landmark'],landmark:['ruin','shrine','wilds'],lair:['cave','ruin','wilds']};
// Words that say what a place is and what land it lies in, for clients from before subjects carried placeKind and
// terrain (the name counts twice as much as the description).
const kindWords={settlement:/\b(?:village|town|city|hamlet|inn|tavern|market|harbou?r|port|keep|castle|manor|farmstead|farm|mill|quarter|square|guildhouse|stead)\b/g,camp:/\b(?:camp|encampment|outpost|caravan|tents?|lodge|bivouac|waystation)\b/g,road:/\b(?:road|bridge|crossroads?|trail|ford|path|highway|causeway)\b/g,forest:/\b(?:forest|woods?|woodland|grove|thicket|copse|glade)\b/g,wilds:/\b(?:plains?|moor|heath|fields?|meadow|steppe|valley|wilds?|wilderness|downs)\b/g,mountain:/\b(?:mountains?|peaks?|crag|cliffs?|summit|ridge|spire)\b/g,water:/\b(?:lake|river|falls|waterfall|spring|pool|mere|bay|shore|beach|loch|tarn|lagoon|stream|cove)\b/g,ruin:/\b(?:ruins?|ruined|tower|watchtower|fort|fortress|abbey|crumbling|abandoned)\b/g,cave:/\b(?:caves?|caverns?|grotto|tunnels?|mine|hollow|vaults?|crypt|barrow|catacombs?)\b/g,shrine:/\b(?:shrine|temple|chapel|altar|sanctuary|monastery|standing stones)\b/g,landmark:/\b(?:statue|monolith|obelisk|arch|stone circle|colossus|menhir|landmark)\b/g,lair:/\b(?:lair|den|nest|warren)\b/g};
const terrainWords={plains:/\b(?:plains?|grassland|meadows?|farmland|prairie|fields?|pasture)\b/g,forest:/\b(?:forest|woods?|woodland|grove|pines?|oaks?|firs?)\b/g,hills:/\b(?:hills?|downs|moor|heath|valley|knoll)\b/g,mountains:/\b(?:mountains?|peaks?|alpine|crags?|summit|highlands?)\b/g,coast:/\b(?:coast|sea|harbou?r|shore|beach|bay|port|tide|tidal|salt|cove)\b/g,marsh:/\b(?:marsh|swamp|bog|fen|mire|bayou|reeds?)\b/g,desert:/\b(?:desert|dunes?|sands?|oasis|mesa|canyon|badlands)\b/g,snow:/\b(?:snow|snowy|snowbound|icebound|ice|icy|frozen|glacier|frost|tundra|winter)\b/g,caverns:/\b(?:caverns?|underground|subterranean|underdeep|beneath the earth)\b/g};
function bestWord(table,heavy,light){
 let best=null,score=0;
 for(const [name,words] of Object.entries(table)){const n=2*(heavy.match(words)??[]).length+(light.match(words)??[]).length;if(n>score){best=name;score=n;}}
 return best;
}
// What to match a subject on: what the game says (placeKind, terrain), else what its words say, else a plain default.
function matchOf(subject){
 const name=String(subject.name??'').toLowerCase(),words=String(subject.description??'').toLowerCase(),setting=String(subject.setting??'').toLowerCase();
 const kind=placeKinds.includes(subject.placeKind)?subject.placeKind:bestWord(kindWords,name,words)??(subject.id==='inn'?'settlement':subject.id==='tower'?'ruin':'wilds');
 const terrain=terrains.includes(subject.terrain)?subject.terrain:bestWord(terrainWords,name+' '+words,setting)??'plains';
 return {kind,terrain};
}
function validEntry(e){
 return !!e&&typeof e.id==='string'&&/^[a-z]{3,12}-[a-z]{4,10}-\d{1,2}$/.test(e.id)&&placeKinds.includes(e.kind)&&terrains.includes(e.terrain)&&e.file===e.id+'.jpg';
}
// A repeatable preference of one place for one picture (rendezvous hashing: a picture added to the library later
// never reshuffles the others).
const preference=(campaignId,placeId,pictureId)=>parseInt(crypto.createHash('sha256').update(campaignId+'\n'+placeId+'\n'+pictureId).digest('hex').slice(0,12),16);
const kindTerrainComplete=entries=>terrains.every(t=>placeKinds.every(k=>entries.some(e=>e.terrain===t&&e.kind===k)));
// The picture for a place: the same kind in the same land, else a related kind in the same land, each first among
// pictures no other place of this tale has; else (only once the library is complete) the same kind in any land.
// null: nothing fits yet, so the place is painted as before.
function choosePicture(entries,{kind,terrain},{campaignId,placeId,taken=new Set(),complete=kindTerrainComplete(entries)}){
 const best=list=>list.reduce((a,e)=>!a||preference(campaignId,placeId,e.id)>preference(campaignId,placeId,a.id)?e:a,null);
 const free=list=>list.filter(e=>!taken.has(e.id));
 const near=entries.filter(e=>e.terrain===terrain),same=near.filter(e=>e.kind===kind),related=near.filter(e=>(relatedKinds[kind]??[]).includes(e.kind));
 if(same.length||related.length)return best(free(same))??best(free(related))??best(same)??best(related);
 if(!complete||!entries.length)return null;
 const anywhere=entries.filter(e=>e.kind===kind);
 return best(free(anywhere))??best(anywhere)??best(free(entries))??best(entries);
}
function createPlaceLibrary({directory=path.join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-place-art'),picksDirectory=path.join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-art','place-picks'),refreshMs=30000,cacheEntries=40,campaignsKept=300,picksPerCampaign=600}={}){
 let entries=[],byId=new Map(),complete=false,checkedAt=0,stamp=null;const bad=new Set();
 // library.json grows while the library is painted: looked at again at most every refreshMs.
 async function refresh(){
  if(Date.now()-checkedAt<refreshMs&&checkedAt)return;checkedAt=Date.now();
  try{
   const file=path.join(directory,'library.json'),info=await fs.stat(file),now=info.mtimeMs+':'+info.size;
   if(now===stamp)return;
   const list=JSON.parse(await fs.readFile(file,'utf8'));
   const seen=new Set();entries=(Array.isArray(list)?list.slice(0,1000):[]).filter(e=>validEntry(e)&&!seen.has(e.id)&&seen.add(e.id)).map(e=>({id:e.id,kind:e.kind,terrain:e.terrain,file:e.file}));
   byId=new Map(entries.map(e=>[e.id,e]));complete=kindTerrainComplete(entries);stamp=now;
  }catch{entries=[];byId=new Map();complete=false;stamp=null;}
 }
 const usable=()=>entries.filter(e=>!bad.has(e.id));
 // Finished pictures are kept in memory, the most recently used few dozen (each is a few hundred kilobytes).
 const pictures=new Map();
 async function picture(entry){
  if(pictures.has(entry.id)){const dataUrl=pictures.get(entry.id);pictures.delete(entry.id);pictures.set(entry.id,dataUrl);return dataUrl;}
  const bytes=await fs.readFile(path.join(directory,entry.file));
  if(bytes.length<4||bytes.length>12_000_000||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw Error('Not a JPEG');
  const dataUrl='data:image/jpeg;base64,'+bytes.toString('base64');
  pictures.set(entry.id,dataUrl);while(pictures.size>cacheEntries)pictures.delete(pictures.keys().next().value);
  return dataUrl;
 }
 // Each tale's picks ({place id: picture id}) are one small file, read once and kept for the most recent tales.
 const campaigns=new Map(),locks=new Map();
 const picksFile=campaignId=>path.join(picksDirectory,crypto.createHash('sha256').update('questbound-place-picks\n'+campaignId).digest('hex').slice(0,40)+'.json');
 async function picksOf(campaignId){
  if(campaigns.has(campaignId)){const picks=campaigns.get(campaignId);campaigns.delete(campaignId);campaigns.set(campaignId,picks);return picks;}
  let picks={};
  try{const saved=JSON.parse(await fs.readFile(picksFile(campaignId),'utf8'));if(saved?.campaignId===campaignId&&saved.picks&&typeof saved.picks==='object')picks=Object.fromEntries(Object.entries(saved.picks).filter(([k,v])=>typeof k==='string'&&k.length<=100&&typeof v==='string'&&v.length<=40).slice(0,picksPerCampaign));}catch{}
  campaigns.set(campaignId,picks);while(campaigns.size>campaignsKept)campaigns.delete(campaigns.keys().next().value);
  return picks;
 }
 async function savePicks(campaignId,picks){
  await fs.mkdir(picksDirectory,{recursive:true});
  const file=picksFile(campaignId),temporary=file+'.'+crypto.randomBytes(4).toString('hex')+'.partial';
  await fs.writeFile(temporary,JSON.stringify({campaignId,picks}));await fs.rename(temporary,file);
 }
 // One tale's places are chosen one at a time, so two arriving together never take the same picture.
 function serial(campaignId,work){
  const previous=locks.get(campaignId)??Promise.resolve(),next=previous.catch(()=>{}).then(work);
  const tail=next.catch(()=>{});locks.set(campaignId,tail);tail.then(()=>{if(locks.get(campaignId)===tail)locks.delete(campaignId);});
  return next;
 }
 // {status:'ready', key, dataUrl, library: picture id} for a landscape the library can show, else null.
 async function answer(subject,key){
  if(!libraryEligible(subject))return null;
  await refresh();
  if(!entries.length)return null;
  return serial(subject.campaignId,async()=>{
   const picks=await picksOf(subject.campaignId),match=matchOf(subject);
   for(let attempt=0;attempt<3;attempt++){
    let entry=byId.get(picks[subject.id]);
    if(!entry||bad.has(entry.id)){
     const taken=new Set(Object.entries(picks).filter(([id])=>id!==subject.id).map(([,pick])=>pick));
     entry=choosePicture(usable(),match,{campaignId:subject.campaignId,placeId:subject.id,taken,complete});
     if(!entry)return null;
     if(picks[subject.id]!==entry.id&&(Object.hasOwn(picks,subject.id)||Object.keys(picks).length<picksPerCampaign)){picks[subject.id]=entry.id;try{await savePicks(subject.campaignId,picks);}catch{}}
    }
    try{return {status:'ready',key,dataUrl:await picture(entry),library:entry.id};}
    catch{bad.add(entry.id);}
   }
   return null;
  });
 }
 return {answer,refresh,entries:()=>usable(),complete:()=>complete};
}
module.exports={revision:1,createPlaceLibrary,choosePicture,matchOf,libraryEligible,libraryCampaign,relatedKinds,placeKinds,terrains,kindTerrainComplete};
