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
const revision=1;
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
function createPeopleLibrary({directory=path.join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-people'),refreshMs=30000,cacheEntries=30}={}){
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
 // The people to offer the Dungeon Master where the hero is: suited, unused in this game.
 async function suited(options){await refresh();return suitedPeople(entries,options);}
 async function get(id){await refresh();return byId.get(id)??null;}
 return {refresh,suited,get,portrait,hasPortrait,entries:()=>entries};
}
// The Dungeon Master's copy (dm-server.cjs reads it through loadPeople()).
const people=createPeopleLibrary();
module.exports={revision,createPeopleLibrary,people,suitedPeople,toMeet,filledIntroduce,validPerson,portraitText,portraitSubject,withoutFacialHair,peopleCampaign,poolIdPattern,speciesList,classList,genderList,placeKinds,terrains,ages,toughnessList,attitudes,limits};
