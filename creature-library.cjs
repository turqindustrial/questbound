// The host's library of ready creature pictures (2026-10-17, the host's words: "we should do the same thing for all
// creatures as well", as for places and people). Every creature a player fights (a lair's or an errand's threat, a
// creature the Dungeon Master springs in an ambush, a tale's main foe when it is a creature, the vault's guardians, the
// Skirmish's foe) is shown with the library picture that fits it best, free: .questbound-creatures/<id>.jpg plus
// library.json ([{id, file, ...}], ids from creature-catalogue.cjs; under QUESTBOUND_DATA when hosted), painted once
// by make-creature-library.cjs. The match is worked out from what the game says (its template, the land's terrain,
// the kind a tale's foe is) and the creature's own name and look in words: what it is first (a wolf, a spider, the
// dead), then what sets one of its kind apart (colour, a mark, a band rather than one), then the land. A creature keeps
// the picture it was first given (its pick is kept under .questbound-art/creature-picks/), two creatures of one tale
// get different pictures while another fits, and a creature painted before the library keeps its painting. When
// nothing in the library fits well enough the creature is painted as before (world-art.cjs notes what was missing).
// The running Dungeon Master keeps this module loaded (world-art.cjs loads it afresh when it loads): a change here or
// in creature-catalogue.cjs needs world-art's revision and dm-server.cjs's literals raised together.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const revision=1;
delete require.cache[require.resolve('./creature-catalogue.cjs')];
const catalogue=require('./creature-catalogue.cjs');
// The library's own pictures are painted through the Dungeon Master under this campaign: never answered from the
// library, and only the host may paint it (world-art.cjs).
const libraryCampaign='questbound-creature-library-v1';
// A copy of encounterRules.js templateKeys (verify-creature-library.cjs checks that they agree).
const templateKeys=['bandit','wolf','goblin','skeleton','boar','spider','zombies','orc','wolves'];
const terrains=catalogue.terrains;
const libraryEligible=subject=>subject?.kind==='creature'&&!String(subject.campaignId).startsWith('questbound-creature-library')&&subject.campaignId!=='questbound-creatures-v1';
// ---------- Words ----------
const irregular={wolves:'wolf',elves:'elf',dwarves:'dwarf',thieves:'thief',knives:'knife',scarves:'scarf',hooves:'hoof',wharves:'wharf',leaves:'leaf',halves:'half',lives:'life',wives:'wife',calves:'calf',selves:'self',men:'man',women:'woman',teeth:'tooth',feet:'foot',mice:'mouse',geese:'goose',children:'child',axes:'axe',oxen:'ox',harpies:'harpy',flies:'fly',dice:'die',lice:'louse',cyclopes:'cyclops',mercenaries:'mercenary'};
function singular(w){
 if(irregular[w])return irregular[w];
 if(w.length<=3||/(?:ss|us|is|ous|ps)$/.test(w))return w;
 if(/ies$/.test(w)&&w.length>4)return w.slice(0,-3)+'y';
 if(/(?:ches|shes|xes|zes|sses|oes)$/.test(w))return w.slice(0,-2);
 return w.endsWith('s')?w.slice(0,-1):w;
}
// A text as a list of plain singular words (a hyphenated word counts as its parts).
const tokensOf=text=>(String(text??'').toLowerCase().replace(/[’']/g,'').match(/[a-z]+/g)??[]).map(singular);
const phraseOf=text=>tokensOf(text);
// Where a phrase (a list of words) first appears in a list of words, or -1.
function findPhrase(tokens,phrase){
 if(!phrase.length)return -1;
 outer:for(let i=0;i+phrase.length<=tokens.length;i++){for(let j=0;j<phrase.length;j++)if(tokens[i+j]!==phrase[j])continue outer;return i;}
 return -1;
}
// Words that say what family a creature is of, whatever its kind.
const familyWords={
 beast:['beast','animal','predator','fur','pelt','furred'],
 monstrosity:['monster','monstrous','hybrid'],
 undead:['undead','dead','corpse','cadaver','bone','skeletal','rotting','rotted','grave','tomb','crypt','barrow','burial','ghostly','spectral','revenant','deathless','shroud','risen','unliving'],
 fiend:['fiend','fiendish','demon','devil','infernal','hellish','brimstone','sulphur','sulfur','abyssal','damned'],
 fey:['fey','faerie','fairy','glamour','enchanted','otherworldly'],
 giant:['giant','colossal','towering','hulking'],
 raider:['raider','looter','tribe','warband','scavenged','crude'],
 folk:['blade','sword','knife','cudgel','club','dagger','leather','jerkin','coat','cloak','hood','armed','weapon','crossbow'],
 dragon:['dragon','draconic','wyrm','scaled','breath'],
 ooze:['ooze','slime','jelly','gelatinous','pudding','acidic','quivering','blob','oozing'],
 elemental:['elemental','living','whirling','spirit'],
 construct:['construct','golem','automaton','clockwork','animated','rune','mechanical','gear','rivet','carved'],
 plant:['plant','fungus','fungal','mushroom','spore','root','vine','moss','bark','thorn','bloom','leaf','fibre','fiber'],
 aberration:['aberration','tentacle','tentacled','alien','writhing','maw','eyestalk'],
 swarm:['swarm','countless','seething','thousand','hundred'],
};
// Words that say a creature is a band, not one.
const bandWords=['band','crew','gang','pack','troop','horde','several','knot','mob','swarm','company','handful','flock','host','warband','brood','clutch','party','cult','coven','group','two','three','four','five','six','seven','eight','nine','ten','few','many','dozen','lot'];
// Colour and shape words are weak: they alone never make a creature fit.
const weak=new Set(['grey','gray','black','white','pale','red','blue','green','brown','dark','long','tall','eye','leg','large','small','huge','one','two','three','four','six','eight','lean','broad','low','scale','wing','fang','claw','horn','tail','teeth','tooth','head','skin','hide','fur']);
// What a subject is matched on.
function featuresOf(subject){
 const name=tokensOf(subject.name),kind=tokensOf(subject.creatureKind),desc=tokensOf(subject.description);
 const nameTokens=[...name,'|',...kind],all=new Set([...name,...kind,...desc]);
 const nameText=String(subject.name??'').trim();
 // A band: words that say so, or a name like "The Chaff Knives" (the, then a plural last word).
 const plural=/^the\s/i.test(nameText)&&/[a-z]{3,}s$/i.test(nameText)&&!/(?:ss|us|is)$/i.test(nameText);
 const band=bandWords.some(w=>desc.slice(0,25).includes(w)||name.includes(w))||plural;
 // Someone of an invented people (a person, not a beast): fits only when a kind of creature is named outright.
 const personLike=/\b(?:\d+|[a-z]+)-year-old\b|\b(?:man|woman|men|women|person)\b/i.test(String(subject.description??''));
 return {name:nameTokens,desc,all,band,personLike,template:templateKeys.includes(subject.template)?subject.template:null,terrain:terrains.includes(subject.terrain)?subject.terrain:null};
}
// Words of a picture's own look (and of its twist alone, for the second picture of a kind): a creature described like
// one picture rather than its sibling is shown that one.
const stop=new Set('this that with from into over under their they them its it’s has have and the for are was were one two its while each other only also very more most some than then when where what which who whose like just much many about after before around behind beside across along through toward towards still even here there been being upon onto down back half both same such itself'.split(' '));
const contentOf=text=>new Set(tokensOf(text).filter(w=>w.length>=4&&!stop.has(w)));
const lookCache=new WeakMap();
function lookOf(picture){let l=lookCache.get(picture);if(!l){const all=contentOf(picture.description),base=contentOf(picture.look??picture.description);l={all,twist:new Set([...contentOf(picture.twist??'')].filter(w=>!base.has(w)))};lookCache.set(picture,l);}return l;}
const phraseCache=new Map();
const phrases=list=>{const key=list.join('\n');let p=phraseCache.get(key);if(!p){p=list.map(phraseOf).filter(x=>x.length);phraseCache.set(key,p);}return p;};
// How well one picture fits: {score, confident}.
function fitOf(picture,f,earliest){
 let nameScore=0;
 for(const phrase of phrases(picture.names)){
  let s=0;
  if(findPhrase(f.name,phrase)>=0)s=12;
  else{const at=findPhrase(f.desc,phrase);if(at>=0)s=at===earliest?9:6;}
  if(!s&&phrase.length===1&&phrase[0].length>=4&&f.name.some(t=>t.length>=phrase[0].length+3&&(t.endsWith(phrase[0])||t.startsWith(phrase[0]))))s=8;
  if(s&&phrase.length>1)s+=3;
  nameScore=Math.max(nameScore,s);
 }
 const templateScore=f.template&&picture.templates.includes(f.template)?6+(picture.template===f.template?1:0):0;
 const familyHit=(familyWords[picture.family]??[]).some(w=>f.all.has(w));
 let tagScore=0,strong=0;
 const variant=new Set(picture.variantTags);
 for(const tag of new Set(picture.tags)){const p=phraseOf(tag);if(!p.length)continue;const hit=p.length===1?f.all.has(p[0]):findPhrase(f.desc,p)>=0;if(!hit)continue;tagScore+=1.5+(variant.has(tag)?1.5:0);if(!weak.has(p.join(' ')))strong++;}
 tagScore=Math.min(tagScore,14);
 const look=lookOf(picture);let shared=0,missing=0;for(const w of look.all)if(f.all.has(w))shared++;for(const w of look.twist)if(!f.all.has(w))missing++;
 const lookScore=Math.min(5,shared*0.5)-Math.min(3,missing*0.2);
 const bandScore=f.band?(picture.band?3:0):(picture.band?-4:0),terrainScore=f.terrain&&picture.terrains.includes(f.terrain)?1:0;
 const confident=nameScore>0||templateScore>0||(!f.personLike&&(strong>=3||(familyHit&&strong>=2)));
 return {score:nameScore+templateScore+(familyHit?3:0)+tagScore+lookScore+bandScore+terrainScore,confident,named:nameScore>0};
}
// Every library picture that fits this creature, best first: [{picture, score}]. Only confident fits.
function fitsFor(pictures,subject){
 const f=featuresOf(subject);
 // The kind named first in the look counts more than one named later ("an orc in a wolf-pelt mantle" is an orc).
 let earliest=Infinity;
 for(const p of pictures)for(const phrase of phrases(p.names)){const at=findPhrase(f.desc,phrase);if(at>=0&&at<earliest)earliest=at;}
 return pictures.map(p=>({picture:p,...fitOf(p,f,earliest)})).filter(x=>x.confident).sort((a,b)=>b.score-a.score);
}
// A repeatable preference of one creature for one picture (rendezvous hashing).
const preference=(campaignId,creatureId,pictureId)=>parseInt(crypto.createHash('sha256').update(campaignId+'\n'+creatureId+'\n'+pictureId).digest('hex').slice(0,12),16);
// The picture for a creature: among those that fit nearly as well as the best, first one no other creature of this
// tale has, then the best fit, then a repeatable hash; a repeat only when every close fit is taken. null: nothing
// fits well enough, so the creature is painted.
function choosePicture(pictures,subject,{campaignId=subject.campaignId,creatureId=subject.id,taken=new Set()}={}){
 const fits=fitsFor(pictures,subject);if(!fits.length)return null;
 const best=fits[0].score,close=fits.filter(x=>x.score>=Math.max(best-4,best*0.7));
 const order=(a,b)=>b.score-a.score||preference(campaignId,creatureId,b.picture.id)-preference(campaignId,creatureId,a.picture.id);
 const free=close.filter(x=>!taken.has(x.picture.id)).sort(order);
 return (free[0]??close.sort(order)[0]).picture;
}
// The best guess, fitting or not, for the host's note of what the library is missing.
function bestGuess(pictures,subject){
 const f=featuresOf(subject);let best=null;
 for(const p of pictures){const fit=fitOf(p,f,-1);if(!best||fit.score>best.score)best={id:p.id,score:Math.round(fit.score*10)/10};}
 return best;
}
const pictureIds=new Map(catalogue.pictures.map(p=>[p.id,p]));
const validEntry=e=>!!e&&typeof e.id==='string'&&/^[a-z]+(?:-[a-z]+)*-\d$/.test(e.id)&&pictureIds.has(e.id)&&e.file===e.id+'.jpg';
function createCreatureLibrary({directory=path.join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-creatures'),picksDirectory=path.join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-art','creature-picks'),refreshMs=30000,cacheEntries=40,campaignsKept=300,picksPerCampaign=600}={}){
 let entries=[],byId=new Map(),checkedAt=0,stamp=null;const bad=new Set();
 // library.json grows while the library is painted: looked at again at most every refreshMs.
 async function refresh(){
  if(Date.now()-checkedAt<refreshMs&&checkedAt)return;checkedAt=Date.now();
  try{
   const file=path.join(directory,'library.json'),info=await fs.stat(file),now=info.mtimeMs+':'+info.size;
   if(now===stamp)return;
   const list=JSON.parse(await fs.readFile(file,'utf8')),seen=new Set();
   entries=(Array.isArray(list)?list.slice(0,1000):[]).filter(e=>validEntry(e)&&!seen.has(e.id)&&seen.add(e.id)).map(e=>({...pictureIds.get(e.id),file:e.file}));
   byId=new Map(entries.map(e=>[e.id,e]));stamp=now;
  }catch{entries=[];byId=new Map();stamp=null;}
 }
 const usable=()=>entries.filter(e=>!bad.has(e.id));
 const pictures=new Map();
 async function picture(entry){
  if(pictures.has(entry.id)){const dataUrl=pictures.get(entry.id);pictures.delete(entry.id);pictures.set(entry.id,dataUrl);return dataUrl;}
  const bytes=await fs.readFile(path.join(directory,entry.file));
  if(bytes.length<4||bytes.length>12_000_000||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw Error('Not a JPEG');
  const dataUrl='data:image/jpeg;base64,'+bytes.toString('base64');
  pictures.set(entry.id,dataUrl);while(pictures.size>cacheEntries)pictures.delete(pictures.keys().next().value);
  return dataUrl;
 }
 // Each tale's picks ({creature id: picture id}) are one small file, read once and kept for the most recent tales.
 const campaigns=new Map(),locks=new Map();
 const picksFile=campaignId=>path.join(picksDirectory,crypto.createHash('sha256').update('questbound-creature-picks\n'+campaignId).digest('hex').slice(0,40)+'.json');
 async function picksOf(campaignId){
  if(campaigns.has(campaignId)){const picks=campaigns.get(campaignId);campaigns.delete(campaignId);campaigns.set(campaignId,picks);return picks;}
  let picks={};
  try{const saved=JSON.parse(await fs.readFile(picksFile(campaignId),'utf8'));if(saved?.campaignId===campaignId&&saved.picks&&typeof saved.picks==='object')picks=Object.fromEntries(Object.entries(saved.picks).filter(([k,v])=>typeof k==='string'&&k.length<=100&&typeof v==='string'&&v.length<=60).slice(0,picksPerCampaign));}catch{}
  campaigns.set(campaignId,picks);while(campaigns.size>campaignsKept)campaigns.delete(campaigns.keys().next().value);
  return picks;
 }
 async function savePicks(campaignId,picks){
  await fs.mkdir(picksDirectory,{recursive:true});
  const file=picksFile(campaignId),temporary=file+'.'+crypto.randomBytes(4).toString('hex')+'.partial';
  await fs.writeFile(temporary,JSON.stringify({campaignId,picks}));await fs.rename(temporary,file);
 }
 // One tale's creatures are chosen one at a time, so two shown together never take the same picture.
 function serial(campaignId,work){
  const previous=locks.get(campaignId)??Promise.resolve(),next=previous.catch(()=>{}).then(work);
  const tail=next.catch(()=>{});locks.set(campaignId,tail);tail.then(()=>{if(locks.get(campaignId)===tail)locks.delete(campaignId);});
  return next;
 }
 // {status:'ready', key, dataUrl, library: picture id} for a creature the library can show, else null.
 async function answer(subject,key){
  if(!libraryEligible(subject))return null;
  await refresh();
  if(!entries.length)return null;
  return serial(subject.campaignId,async()=>{
   const picks=await picksOf(subject.campaignId);
   for(let attempt=0;attempt<3;attempt++){
    let entry=byId.get(picks[subject.id]);
    if(!entry||bad.has(entry.id)){
     const taken=new Set(Object.entries(picks).filter(([id])=>id!==subject.id).map(([,pick])=>pick));
     entry=choosePicture(usable(),subject,{taken});
     if(!entry)return null;
     if(picks[subject.id]!==entry.id&&(Object.hasOwn(picks,subject.id)||Object.keys(picks).length<picksPerCampaign)){picks[subject.id]=entry.id;try{await savePicks(subject.campaignId,picks);}catch{}}
    }
    try{return {status:'ready',key,dataUrl:await picture(entry),library:entry.id};}
    catch{bad.add(entry.id);}
   }
   return null;
  });
 }
 // What the library would have offered (for the note when a creature is painted for want of a picture).
 async function guess(subject){await refresh();return bestGuess(usable(),subject);}
 return {answer,guess,refresh,entries:()=>usable()};
}
module.exports={revision,createCreatureLibrary,choosePicture,fitsFor,featuresOf,bestGuess,tokensOf,singular,libraryEligible,libraryCampaign,templateKeys,terrains,catalogue};
