// The host's library of ready-made people (2026-10-16, the host's words: "use the api to generate 1000 completely
// unique npcs for the players to run into so that it doesn't eat up all of my credit as they progress" and "make sure
// to keep in mind every class, race, and gender"; then: "let's cut that npc amount to 300 for now and make sure they are all
// entirely unique"). Three hundred people, written once through the Dungeon Master
// (make-people-library.cjs, the 'people-batch' mode) and each painted once, live in .questbound-people/
// (library.json: [{id np001…np300, name, gender, species, age, role, class, appearance, personality, motive, voice, hook,
// placeKinds, terrains, toughness, attitude}] plus <id>.jpg; under QUESTBOUND_DATA when hosted). When the Dungeon
// Master brings someone new into a scene it is offered a few of them that suit where the hero is
// (context.world.peopleToMeet); a person it introduces from the list is stored whole with `pool:<id>`, and their
// portrait is that person's ready painting (world-art.cjs), so meeting them costs nothing to paint. Nobody is offered
// twice in one game. The running Dungeon Master keeps this module loaded (world-art.cjs loads it afresh when it loads):
// a change here needs world-art's revision and dm-server.cjs's literals raised together.
const fs=require('node:fs/promises'),fsSync=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const revision=2;
// Copies of the game's own lists (verify-people-library.cjs checks that they agree): characterRules species and
// classes, mapRules placeKinds and terrains.
const speciesList=['Dragonborn','Dwarf','High Elf','Wood Elf','Drow','Gnome','Goblin','Goliath','Half-Elf','Halfling','Human','Orc','Tiefling'];
const classList=['Artificer','Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard'];
const genderList=['woman','man','other'];
const placeKinds=['settlement','camp','road','forest','wilds','mountain','water','ruin','cave','shrine','landmark','lair'];
const terrains=['plains','forest','hills','mountains','coast','marsh','desert','snow','caverns'];
const ages=['young','adult','middle-aged','old'],toughnessList=['frail','common','tough'],attitudes=['unfriendly','indifferent','friendly'];
// The library's own portraits are painted through the Dungeon Master under this campaign (only the host may).
const peopleCampaign='questbound-people-library-v1';
const poolIdPattern=/^np\d{3}$/;
const limits={name:40,role:80,appearance:400,personality:120,motive:200,voice:80,hook:200};
const text=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
const list=(v,of,most)=>Array.isArray(v)&&v.length>=1&&v.length<=most&&v.every(x=>of.includes(x))&&new Set(v).size===v.length;
function validPerson(e){
 return !!e&&typeof e==='object'&&poolIdPattern.test(String(e.id))&&text(e.name,3,limits.name)&&genderList.includes(e.gender)&&speciesList.includes(e.species)&&ages.includes(e.age)&&text(e.role,3,limits.role)
  &&(e.class===null||classList.includes(e.class))&&text(e.appearance,20,limits.appearance)&&text(e.personality,3,limits.personality)&&text(e.motive,3,limits.motive)&&text(e.voice,0,limits.voice)&&text(e.hook,3,limits.hook)
  &&list(e.placeKinds,placeKinds,4)&&list(e.terrains,terrains,4)&&toughnessList.includes(e.toughness)&&attitudes.includes(e.attitude);
}
// What a person's portrait is painted from: their look, kind, age and calling. A woman is never painted with facial
// hair (worldArtRules.js portraitDescription says the same to the painter).
const facialHair=/\b(?:beard(?:ed|s)?|moustach(?:e|es|ed|ioed)|mustach(?:e|es|ed|ioed)|stubbl(?:e|ed|y)|whisker(?:s|ed)?|sideburns|goatee)\b/i;
function withoutFacialHair(textIn){
 return String(textIn??'').split(/(?<=[.!?;])\s+/).map(sentence=>facialHair.test(sentence)?sentence.split(/,\s*|\s+and\s+|\s+with\s+/).filter(part=>!facialHair.test(part)).join(', '):sentence).filter(s=>s.trim().length>2).join(' ').trim();
}
function portraitText(p){
 const who=[p.age==='young'?'A young':p.age==='old'?'An old':p.age==='middle-aged'?'A middle-aged':'An adult',p.species,p.gender==='woman'?'woman':p.gender==='man'?'man':'person',p.class?'('+p.class.toLowerCase()+')':null].filter(Boolean).join(' ')+', '+String(p.role).replace(/[.\s]+$/,'')+'.';
 const look=p.gender==='woman'?'A woman, with a woman\'s face: smooth cheeks and chin, no beard, no moustache, no stubble or facial hair of any kind. '+withoutFacialHair(p.appearance):p.gender==='man'?'A man. '+p.appearance:p.appearance;
 return (who+' '+look).slice(0,1800);
}
// A portrait subject for the library painter (make-people-library.cjs --portraits).
const portraitSubject=p=>({campaignId:peopleCampaign,kind:'portrait',id:p.id,name:p.name,description:portraitText(p),setting:'Questbound, an original fantasy world. A plain, softly lit background.'});
// A repeatable preference of one game's place for one person (rendezvous hashing: a person added later never
// reshuffles the others), so the same few people are offered at a place until one of them is met.
const preference=(seed,personId)=>parseInt(crypto.createHash('sha256').update(String(seed)+'\n'+personId).digest('hex').slice(0,12),16);
// The people who suit a place: of its kind and its land first, then of its land, then of its kind, then anyone, each
// in a repeatable order for this game and place; at most one in four trained in a class (most people are ordinary
// folk), never anyone in `taken`.
function suitedPeople(entries,{kind=null,terrain=null,taken=new Set(),seed='',count=4}={}){
 const free=entries.filter(e=>!taken.has(e.id));
 const score=e=>(kind&&e.placeKinds.includes(kind)?2:0)+(terrain&&e.terrains.includes(terrain)?3:0);
 const ranked=free.map(e=>({e,s:score(e),p:preference(seed,e.id)})).sort((a,b)=>b.s-a.s||b.p-a.p).map(x=>x.e);
 const out=[],trainedMost=Math.max(1,Math.floor(count/4));
 for(const e of ranked){if(out.length>=count)break;if(e.class&&out.filter(x=>x.class).length>=trainedMost)continue;out.push(e);}
 for(const e of ranked){if(out.length>=count)break;if(!out.includes(e))out.push(e);}
 return out;
}
// How a library person is shown to the Dungeon Master in context.world.peopleToMeet: enough to introduce them well.
const cutText=(v,max)=>{const s=String(v??'').replace(/\s+/g,' ').trim();return s.length<=max?s:s.slice(0,max-1).replace(/\s+\S*$/,'')+'…';};
const toMeet=e=>({pool:e.id,name:e.name,species:e.species,gender:e.gender,age:e.age,role:e.role,...(e.class?{class:e.class}:{}),look:cutText(e.appearance,140),hook:cutText(e.hook,160)});
// The whole person the game stores when the Dungeon Master introduces them (relationshipRules introducePerson): who
// they are comes from the library; how they meet the hero (attitude, foe, tie, regard) from the Dungeon Master.
function filledIntroduce(sketch,e){
 return {...sketch,name:e.name,species:e.species,gender:e.gender,role:cutText(e.role,200),appearance:cutText(e.gender==='woman'?withoutFacialHair(e.appearance):e.appearance,400),personality:cutText(e.personality+(e.voice?' '+e.voice.replace(/^./,c=>c.toUpperCase()).replace(/([^.!?])$/,'$1.'):''),200),motive:cutText(e.motive,300),hook:cutText(e.hook,240),toughness:e.toughness,class:e.class??null,pool:e.id};
}
// Look-alikes (2026-10-16, the host's words: "make sure all of those along with all of the previously generated
// images for landscapes are implemented into the game to save API credits"). Anyone shown with a portrait who is not a
// player's hero and not themselves from the library (a tale's keeper and mara, its residents, people the Dungeon
// Master invents, a tale's foe who is a person) is shown with the portrait of the library person who looks most like
// them (world-art.cjs asks lookAlike), so nobody is painted while a match exists. The match: the same species and
// gender (any gender of that species when it is not known), then the same training (a trained person one trained in
// their class first, then another trained one; an ordinary person an ordinary one), then age, then calling and look in
// words; repeatable (a hash of the tale, the person and the picture). One face to one person in a tale while another of
// their kind is free: people from the library in the game (avoid) and faces already given in the tale (and in its
// ready journey's own campaign, related) are taken. Each tale's picks are kept (.questbound-art/people-picks/), so a
// person never changes face. A child, a ghost or a beast, or someone of a kind the library has nobody of, is painted.
const lookAlikeSpecies=[...speciesList,'Elf','unknown'];
// Species named in words (earliest first; the longer name wins at the same place, so a half-elf is no elf).
const speciesPatterns=[[/\bhalf[- ]?el(?:f|ves|ven)\b/,'Half-Elf'],[/\bwood[- ]el(?:f|ves|ven)\b/,'Wood Elf'],[/\bhigh[- ]el(?:f|ves|ven)\b/,'High Elf'],[/\b(?:drow|dark[- ]el(?:f|ves|ven))\b/,'Drow'],[/\b(?:elf|elves|elven|elfin|elvish)\b/,'Elf'],[/\bdwar(?:f|fs|ves|ven|vish)\b/,'Dwarf'],[/\bgnom(?:e|es|ish)\b/,'Gnome'],[/\bgoblins?\b/,'Goblin'],[/\bgoliaths?\b/,'Goliath'],[/\bhalflings?\b/,'Halfling'],[/\b(?:half[- ]?orcs?|orcs?|orcish)\b/,'Orc'],[/\btieflings?\b/,'Tiefling'],[/\bdragonborn\b/,'Dragonborn'],[/\bhumans?\b/,'Human']];
function speciesOf(textIn){
 const t=String(textIn??'').toLowerCase();let best=null,at=Infinity,length=0;
 for(const [pattern,name] of speciesPatterns){const m=pattern.exec(t);if(m&&(m.index<at||(m.index===at&&m[0].length>length))){best=name;at=m.index;length=m[0].length;}}
 return best;
}
const speciesCandidates=s=>s==='Elf'?['High Elf','Wood Elf']:[s];
// Nobody in the library is a child, and nobody is a ghost, a walking corpse or a beast: those are painted.
const notInLibrary=/\b(?:child|children|kid|toddler|infant|baby|boy|girl|urchin|youngster|(?:[1-9]|1[0-3]|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen)[- ]years?[- ]old|undead|skeleton|skeletal|zombie|corpse|ghost|ghostly|spectral|spectre|specter|spirit|wraith|lich|vampire|ghoul|revenant|wight|mummy|construct|golem|automaton|elemental|fiend|demon|devil|abomination|beast|monster|werewolf|lycanthrope|shapeshifter|hag|giant|ogre|troll|dragon|wyrm)\b/;
const womanWordsHere=/\b(?:she|her|hers|herself|woman|lady|female|mother|sister|daughter|wife|widow|queen|princess|priestess|matron|maiden|aunt|grandmother|abbess|huntress|sorceress|seamstress|midwife|crone)\b/g,manWordsHere=/\b(?:he|him|his|himself|man|male|father|brother|son|husband|widower|king|prince|uncle|grandfather|abbot)\b/g;
const genderFromWords=t=>{const w=(t.match(womanWordsHere)??[]).length,m=(t.match(manWordsHere)??[]).length;return w>m?'woman':m>w?'man':null;};
const ageOf=t=>/\b(?:middle[- ]aged|forties|fifties|greying|graying|grizzled)\b/.test(t)?'middle-aged':/\b(?:elderly|aged|ancient|venerable|wizened|sixties|seventies|eighties|white[- ]haired|silver[- ]haired|crone|grandmother|grandfather|old (?:man|woman|soldier|sailor|priest|priestess|hermit|widow|widower|farmer|fisherman|fisherwoman|smith|dwarf|elf|human|gnome|halfling|orc|goblin|goliath|tiefling))\b/.test(t)?'old':/\b(?:young|youthful|youth|teenage|twenties|barely grown|lad|lass)\b/.test(t)?'young':null;
const stopWords=new Set('the and with her his their its who has have from for into over under that this they them she him are was were one two some all any not but out off very more most little small large long short older young old years year face eyes hair woman man person people adult wears wearing worn keeps kept carries carrying looks look like than then when where what which while each other own just only also about after before always never often still well much many'.split(' '));
const wordCache=new WeakMap();
function wordsOf(textIn){const t=String(textIn??'').toLowerCase();return new Set((t.match(/[a-z]{3,}/g)??[]).filter(w=>!stopWords.has(w)));}
function entryWords(e){let w=wordCache.get(e);if(!w){w={role:wordsOf(e.role),look:wordsOf(e.appearance)};wordCache.set(e,w);}return w;}
const overlap=(a,b)=>{if(!a.size||!b.size)return 0;let n=0;for(const w of a)if(b.has(w))n++;return n/(a.size+b.size-n);};
// What a subject is matched on, or null when the library holds nobody like them (world-art.cjs validateSubject has
// already kept only known values: species one of lookAlikeSpecies, gender, trained a class). A portrait without a
// species (an older client) is read from its words; a creature only ever by the species it says.
function lookAlikeOf(subject){
 if(!subject||!['portrait','creature'].includes(subject.kind))return null;
 const words=String(subject.description??''),low=words.toLowerCase(),role=String(subject.role??'');
 if(notInLibrary.test(low)||notInLibrary.test(role.toLowerCase())||notInLibrary.test(String(subject.name??'').toLowerCase()))return null;
 const written=subject.species==='unknown'?null:lookAlikeSpecies.includes(subject.species)?subject.species:subject.kind==='portrait'?speciesOf(low):null;
 if(!written)return null;
 const gender=genderList.includes(subject.gender)?subject.gender:genderFromWords(low);
 return {species:speciesCandidates(written),gender,trained:classList.includes(subject.trained)?subject.trained:null,age:ageOf(low),role:wordsOf(role),look:wordsOf(words)};
}
// The library person who looks most like them, first among those nobody in this tale has (taken); a repeat only when
// every one of their species and gender is taken; null when the library has nobody of their kind.
function choosePortrait(entries,match,{campaignId='',personId='',taken=new Set(),usable=()=>true}={}){
 const kin=entries.filter(e=>match.species.includes(e.species));
 const same=(match.gender?kin.filter(e=>e.gender===match.gender):kin).filter(usable);
 if(!same.length)return null;
 const free=same.filter(e=>!taken.has(e.id)),list=free.length?free:same,order=ages;
 const score=e=>{const w=entryWords(e);return [match.trained?(e.class===match.trained?2:e.class?1:0):(e.class?0:2),match.age?2-Math.min(2,Math.abs(order.indexOf(e.age)-order.indexOf(match.age))):0,2*overlap(match.role,w.role)+overlap(match.look,w.look),preference(campaignId+'\n'+personId,e.id)];};
 const better=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]>b[i];return false;};
 let best=null,bestScore=null;
 for(const e of list){const s=score(e);if(!bestScore||better(s,bestScore)){best=e;bestScore=s;}}
 return best;
}
function createPeopleLibrary({directory=path.join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-people'),refreshMs=30000,cacheEntries=30,picksDirectory=null,campaignsKept=300,picksPerCampaign=600}={}){
 let entries=[],byId=new Map(),checkedAt=0,stamp=null;
 // library.json grows while the library is written: looked at again at most every refreshMs.
 async function refresh(){
  if(Date.now()-checkedAt<refreshMs&&checkedAt)return;checkedAt=Date.now();
  try{
   const file=path.join(directory,'library.json'),info=await fs.stat(file),now=info.mtimeMs+':'+info.size;
   if(now===stamp)return;
   const raw=JSON.parse(await fs.readFile(file,'utf8')),seen=new Set(),names=new Set();
   entries=(Array.isArray(raw)?raw.slice(0,2000):[]).filter(e=>validPerson(e)&&!seen.has(e.id)&&!names.has(e.name.toLowerCase())&&seen.add(e.id)&&names.add(e.name.toLowerCase())).map(e=>({id:e.id,name:e.name.trim(),gender:e.gender,species:e.species,age:e.age,role:e.role.trim(),class:e.class,appearance:e.appearance.trim(),personality:e.personality.trim(),motive:e.motive.trim(),voice:e.voice.trim(),hook:e.hook.trim(),placeKinds:e.placeKinds,terrains:e.terrains,toughness:e.toughness,attitude:e.attitude}));
   byId=new Map(entries.map(e=>[e.id,e]));stamp=now;
  }catch{entries=[];byId=new Map();stamp=null;}
 }
 // Portraits are kept in memory, the most recently shown few dozen.
 const pictures=new Map();
 async function portrait(id){
  if(!poolIdPattern.test(String(id)))return null;
  if(pictures.has(id)){const dataUrl=pictures.get(id);pictures.delete(id);pictures.set(id,dataUrl);return dataUrl;}
  let bytes;try{bytes=await fs.readFile(path.join(directory,id+'.jpg'));}catch{return null;}
  if(bytes.length<4||bytes.length>12_000_000||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)return null;
  const dataUrl='data:image/jpeg;base64,'+bytes.toString('base64');
  pictures.set(id,dataUrl);while(pictures.size>cacheEntries)pictures.delete(pictures.keys().next().value);
  return dataUrl;
 }
 const hasPortrait=id=>poolIdPattern.test(String(id))&&fsSync.existsSync(path.join(directory,id+'.jpg'));
 // Each tale's faces ({person id: library id}, look-alikes and library people shown alike) are one small file, read
 // once and kept for the most recent tales; one tale's faces are chosen one at a time, so two people shown together
 // never take the same face.
 const campaigns=new Map(),locks=new Map(),bad=new Set();
 const picksFile=campaignId=>path.join(picksDirectory,crypto.createHash('sha256').update('questbound-people-picks\n'+campaignId).digest('hex').slice(0,40)+'.json');
 async function picksOf(campaignId){
  if(campaigns.has(campaignId)){const picks=campaigns.get(campaignId);campaigns.delete(campaignId);campaigns.set(campaignId,picks);return picks;}
  let picks={};
  if(picksDirectory)try{const saved=JSON.parse(await fs.readFile(picksFile(campaignId),'utf8'));if(saved?.campaignId===campaignId&&saved.picks&&typeof saved.picks==='object')picks=Object.fromEntries(Object.entries(saved.picks).filter(([k,v])=>typeof k==='string'&&k.length<=100&&poolIdPattern.test(String(v))).slice(0,picksPerCampaign));}catch{}
  campaigns.set(campaignId,picks);while(campaigns.size>campaignsKept)campaigns.delete(campaigns.keys().next().value);
  return picks;
 }
 async function savePicks(campaignId,picks){
  if(!picksDirectory)return;
  await fs.mkdir(picksDirectory,{recursive:true});
  const file=picksFile(campaignId),temporary=file+'.'+crypto.randomBytes(4).toString('hex')+'.partial';
  await fs.writeFile(temporary,JSON.stringify({campaignId,picks}));await fs.rename(temporary,file);
 }
 function serial(campaignId,work){
  const previous=locks.get(campaignId)??Promise.resolve(),next=previous.catch(()=>{}).then(work);
  const tail=next.catch(()=>{});locks.set(campaignId,tail);tail.then(()=>{if(locks.get(campaignId)===tail)locks.delete(campaignId);});
  return next;
 }
 const keep=async(campaignId,picks,personId,id)=>{if(picks[personId]===id||(!Object.hasOwn(picks,personId)&&Object.keys(picks).length>=picksPerCampaign))return;picks[personId]=id;try{await savePicks(campaignId,picks);}catch{}};
 // A library person shown in a tale (a portrait with `pool`) is noted, so nobody else there is given their face.
 function notePool(campaignId,personId,id){
  if(typeof campaignId!=='string'||typeof personId!=='string'||!poolIdPattern.test(String(id)))return Promise.resolve();
  return serial(campaignId,async()=>keep(campaignId,await picksOf(campaignId),personId,id));
 }
 // The faces already given in these tales (dm-server.cjs keeps them out of peopleToMeet).
 async function takenIn(campaignIds){
  const out=new Set();
  for(const id of (Array.isArray(campaignIds)?campaignIds:[]).filter(c=>typeof c==='string'&&c.length&&c.length<=120).slice(0,4))for(const v of Object.values(await picksOf(id)))out.add(v);
  return out;
 }
 // {status:'ready', key, dataUrl, library: id} with the face of the library person most like this subject, else null.
 async function lookAlike(subject,key){
  const match=lookAlikeOf(subject);if(!match)return null;
  await refresh();if(!entries.length)return null;
  return serial(subject.campaignId,async()=>{
   const picks=await picksOf(subject.campaignId);
   for(let attempt=0;attempt<3;attempt++){
    let entry=byId.get(picks[subject.id]);
    if(!entry||bad.has(entry.id)){
     const related=typeof subject.related==='string'&&subject.related!==subject.campaignId?await picksOf(subject.related):{};
     const taken=new Set([...Object.entries(picks).filter(([id])=>id!==subject.id).map(([,v])=>v),...Object.values(related),...(Array.isArray(subject.avoid)?subject.avoid:[])]);
     entry=choosePortrait(entries,match,{campaignId:subject.campaignId,personId:subject.id,taken,usable:e=>!bad.has(e.id)&&hasPortrait(e.id)});
     if(!entry)return null;
     await keep(subject.campaignId,picks,subject.id,entry.id);
    }
    const dataUrl=await portrait(entry.id);
    if(dataUrl)return {status:'ready',key,dataUrl,library:entry.id};
    bad.add(entry.id);
   }
   return null;
  });
 }
 // The people to offer the Dungeon Master where the hero is: suited, unused in this game.
 async function suited(options){await refresh();return suitedPeople(entries,options);}
 async function get(id){await refresh();return byId.get(id)??null;}
 return {refresh,suited,get,portrait,hasPortrait,lookAlike,notePool,takenIn,entries:()=>entries};
}
// The Dungeon Master's copy (dm-server.cjs reads it through loadPeople()).
const people=createPeopleLibrary();
module.exports={revision,createPeopleLibrary,people,suitedPeople,lookAlikeOf,choosePortrait,speciesOf,lookAlikeSpecies,toMeet,filledIntroduce,validPerson,portraitText,portraitSubject,withoutFacialHair,peopleCampaign,poolIdPattern,speciesList,classList,genderList,placeKinds,terrains,ages,toughnessList,attitudes,limits};
