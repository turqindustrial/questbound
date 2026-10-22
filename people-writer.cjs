// Writes a batch of the host's ready-made people (people-library.cjs) for make-people-library.cjs: the Dungeon
// Master's 'people-batch' mode, which only the host may use (dm-server.cjs refuses it to anyone with a guest label, and
// the gateways never pass the mode on). The script sends a brief of up to 20 slots (species, gender, class or null,
// the age band when it sets one (the second batch does), a hint of their calling, a theme for their hook, the kinds of
// place and the land they belong to) and the names
// already used; the story model writes exactly those people with a strict schema, at low effort (short profiles), and
// every person is checked and tidied here before it is returned: their kind, gender and class as asked, our own
// world's names (never a famous one), and entirely unique (the host, 2026-10-16: "make sure they are all entirely
// unique"): no part of a name (given name or family name, whatever its case or accents) used before, and no look,
// calling or hook nearly the same as anyone's already in the library or the batch (`tooAlike`: shared words); lengths
// within the game's limits, and no facial hair on a woman. A refused slot is asked for again by the script.
// Loaded afresh with dm-server.cjs on every request.
const fs=require('node:fs'),path=require('node:path');
const {providerError}=require('./ai-diagnostics.cjs');
const {modelOptions,outputBudget,readJson}=require('./ai-request.cjs');
const lib=require('./people-library.cjs');
const most=20;
// Names that belong to someone else's world (books, games, films): never used for one of ours, matched word by word.
const famousNames=['drizzt','elminster','strahd','vecna','lolth','mordenkainen','tasha','bigby','volo','xanathar','jarlaxle','bruenor','wulfgar','entreri','minsc','jaheira','imoen','astarion','shadowheart','karlach','laezel','halsin','minthara','raistlin','caramon','tasslehoff','tanis','gandalf','frodo','bilbo','samwise','aragorn','legolas','gimli','galadriel','elrond','arwen','sauron','saruman','boromir','faramir','eowyn','thranduil','thorin','smaug','geralt','yennefer','ciri','jaskier','dumbledore','voldemort','hermione','daenerys','tyrion','cersei','targaryen','lannister','moiraine','egwene','kvothe','rincewind','elric','belgarath','polgara','allanon','kaladin','kelsier','dovahkiin','alduin','ulfric','morrigan','leliana','varric','ganondorf','zelda','sephiroth','aerith','tifa','tiamat','bahamut','asmodeus','acererak','faerun','waterdeep','neverwinter','greyhawk','eberron','ravenloft']; // book-name guard: these are refused, never used
// A name's parts, as they are compared: no accents, no case, split at spaces, hyphens and apostrophes; little words
// (of, the, van…) do not count.
const particles=new Set(['of','the','de','du','da','del','della','van','von','der','den','la','le','al','el','ap','ab','mac','mc','o','y','and']);
const plain=text=>String(text??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const nameParts=name=>plain(name).split(/[\s'’-]+/).map(w=>w.replace(/[^a-z]/g,'')).filter(w=>w.length>=2&&!particles.has(w));
const famous=name=>nameParts(name).some(w=>famousNames.includes(w));
// Content words of a text (no little words), for telling near-duplicates apart.
const common=new Set('a an and the of in on at to with from for by over under into his her their its their them they he she who whom whose that this these those is are was were be has have had not but or as one two old young long short small large thin broad tall eyes hair face skin wears wearing worn dark light grey gray brown black white red pale deep left right side hand hands over across behind always never very'.split(' '));
const words=text=>new Set(plain(text).split(/[^a-z]+/).filter(w=>w.length>=3&&!common.has(w)));
const jaccard=(a,b)=>{if(!a.size||!b.size)return 0;let n=0;for(const w of a)if(b.has(w))n++;return n/(a.size+b.size-n);};
const similarity={appearance:0.5,hook:0.5,role:0.75};
// Which field (role, appearance or hook) makes a person nearly the same as one of `others`, or null.
function tooAlike(p,others){
 const mine={role:words(p.role),appearance:words(p.appearance),hook:words(p.hook)},roleText=plain(p.role).replace(/[^a-z]+/g,' ').trim();
 for(const o of others){
  if(!o||o.id===p.id)continue;
  if(roleText&&roleText===plain(o.role).replace(/[^a-z]+/g,' ').trim())return 'role';
  if(mine.role.size>=2&&jaccard(mine.role,words(o.role))>=similarity.role)return 'role';
  if(jaccard(mine.appearance,words(o.appearance))>=similarity.appearance)return 'appearance';
  if(jaccard(mine.hook,words(o.hook))>=similarity.hook)return 'hook';
 }
 return null;
}
// Whether a name shares a part with any name in `used` (a Set of parts).
const nameClash=(name,used)=>nameParts(name).some(w=>used.has(w));
const cut=(v,max)=>{const s=String(v??'').replace(/\s+/g,' ').trim();if(s.length<=max)return s;const head=s.slice(0,max),end=Math.max(head.lastIndexOf('. '),head.lastIndexOf('! '),head.lastIndexOf('? '));return end>max/2?head.slice(0,end+1):head.slice(0,max-1).replace(/\s+\S*$/,'')+'…';};
// The brief as the script sends it: refused whole when it is not one the script would send.
function validBrief(brief){
 return Array.isArray(brief)&&brief.length>=1&&brief.length<=most&&new Set(brief.map(s=>s?.slot)).size===brief.length&&brief.every(s=>s&&typeof s==='object'&&lib.poolIdPattern.test(String(s.slot))&&lib.speciesList.includes(s.species)&&lib.genderList.includes(s.gender)&&(s.class===null||lib.classList.includes(s.class))&&(s.age===undefined||lib.ages.includes(s.age))&&typeof s.roleHint==='string'&&s.roleHint.length>=3&&s.roleHint.length<=160&&typeof s.hookTheme==='string'&&s.hookTheme.length>=3&&s.hookTheme.length<=200&&Array.isArray(s.placeKinds)&&s.placeKinds.length>=1&&s.placeKinds.length<=3&&s.placeKinds.every(k=>lib.placeKinds.includes(k))&&lib.terrains.includes(s.terrain));
}
const validAvoid=a=>a===undefined||(Array.isArray(a)&&a.length<=3000&&a.every(n=>typeof n==='string'&&n.length<=60));
function peopleSchema(brief){
 const str={type:'string'},pick=values=>({type:'string',enum:values});
 // A brief whose slots all give an age (the second batch) allows only those ages.
 const item={type:'object',properties:{slot:pick(brief.map(s=>s.slot)),name:str,gender:pick([...new Set(brief.map(s=>s.gender))]),species:pick([...new Set(brief.map(s=>s.species))]),age:pick(brief.every(s=>s.age)?lib.ages.filter(a=>brief.some(s=>s.age===a)):lib.ages),role:str,class:{type:['string','null'],enum:[null,...new Set(brief.map(s=>s.class).filter(Boolean))]},appearance:str,personality:str,motive:str,voice:str,hook:str,placeKinds:{type:'array',maxItems:4,items:pick(lib.placeKinds)},terrains:{type:'array',maxItems:4,items:pick(lib.terrains)},toughness:pick(lib.toughnessList),attitude:pick(lib.attitudes)},additionalProperties:false};
 item.required=Object.keys(item.properties);
 return {type:'object',properties:{people:{type:'array',minItems:brief.length,maxItems:brief.length,items:item}},required:['people'],additionalProperties:false};
}
const instructions=`Write the people described in context.brief for Questbound, an original fantasy world: one person for each slot, in the same order, with that slot's id as slot. These are the ordinary and extraordinary people a traveller meets on the road, in villages, camps and wild places; each will be met by players and painted once for a portrait, so make every one of them memorable, specific and entirely unique: no two people alike in name, look, calling or secret.
Each person has exactly the slot's species, gender (woman, man or other: someone who is neither) and class (a class means their life has truly made them one: a sellsword who is a real Fighter, a temple priest who is a Cleric; null means ordinary folk with no class). roleHint is a starting point for their calling, not a script: give them a role of a few words (at most 80 characters) of their own that fits it, the slot's placeKinds and its terrain.
name: a full name (given name and, usually, a family name or byname), at most 40 characters, letters only, in Questbound's own style and suited to their kind. Every part of every name must be new: never a given name or family name that appears in context.avoidNames, and never one shared by two people in this batch. Never use a name from any book, game, film or myth (no Drizzt, Elminster, Gandalf, Geralt or the like), and never a real celebrity's name.
age: young (a young adult; never a child), adult, middle-aged or old. When the slot gives an age, use exactly that age, and let the look show it (a young adult looks young, an old one old).
appearance: 25 to 55 words (under 350 characters) a portrait painter can work from: face, build, colouring, hair, clothing and one distinguishing mark of their own, consistent with their species, age, gender and calling, and unlike anyone else's. A woman never has a beard, moustache, stubble or any facial hair, whatever her species (a dwarf woman has no beard), and her appearance never mentions one.
personality: how they speak and act, at most 120 characters. voice: one speech habit or turn of phrase, at most 80 characters. motive: what they want, at most 200 characters. hook: one sentence (at most 200 characters) built on the slot's hookTheme, made particular to this person: a secret, trouble or story the hero could stumble into through them, playable in any tale and never naming a real place.
placeKinds: one to four kinds of place where they would be found (start with the slot's); terrains: one to four lands they suit (start with the slot's terrain). toughness: frail for the old and sickly, tough for fighters and hardened folk, else common. attitude: how they usually take to strangers (unfriendly, indifferent or friendly; vary it).
OWN WORLD: never use names, places, gods, organisations or creatures that belong to any publisher, game, book or film beyond the licensed System Reference Document. Keep everything suitable for players 16 and over.`;
// Every person checked and tidied, or refused (the script asks again for a refused slot in a later batch). `existing`
// is the library so far ({id, name, role, appearance, hook}), `avoidNames` the names the script sent.
function tidyPeople(raw,brief,avoidNames=[],existing=[]){
 const used=new Set([...avoidNames,...existing.map(e=>e?.name)].flatMap(nameParts)),others=existing.filter(e=>e&&typeof e==='object'),out=[],refused=[];
 const bySlot=new Map((Array.isArray(raw?.people)?raw.people:[]).filter(p=>p&&typeof p==='object').map(p=>[p.slot,p]));
 for(const slot of brief){
  const p=bySlot.get(slot.slot),no=reason=>refused.push({slot:slot.slot,reason});
  if(!p){no('missing');continue;}
  const name=String(p.name??'').replace(/\s+/g,' ').trim();
  if(!/^[\p{L}][\p{L}'’ -]{2,39}$/u.test(name)||name.split(' ').length>4||!nameParts(name).length){no('name');continue;}
  if(famous(name)){no('famous name');continue;}
  if(nameClash(name,used)){no('name used');continue;}
  if(p.species!==slot.species||p.gender!==slot.gender||(p.class??null)!==slot.class){no('kind');continue;}
  if(slot.age&&p.age!==slot.age){no('age');continue;}
  let appearance=String(p.appearance??'').replace(/\s+/g,' ').trim();
  if(slot.gender==='woman')appearance=lib.withoutFacialHair(appearance);
  appearance=cut(appearance,lib.limits.appearance);
  if(appearance.split(' ').length<15){no('appearance');continue;}
  const person={id:slot.slot,name,gender:slot.gender,species:slot.species,age:lib.ages.includes(p.age)?p.age:'adult',role:cut(p.role,lib.limits.role),class:slot.class,appearance,personality:cut(p.personality,lib.limits.personality),motive:cut(p.motive,lib.limits.motive),voice:cut(p.voice,lib.limits.voice),hook:cut(p.hook,lib.limits.hook),
   placeKinds:[...new Set([...slot.placeKinds,...(Array.isArray(p.placeKinds)?p.placeKinds:[])].filter(k=>lib.placeKinds.includes(k)))].slice(0,4),terrains:[...new Set([slot.terrain,...(Array.isArray(p.terrains)?p.terrains:[])].filter(t=>lib.terrains.includes(t)))].slice(0,4),
   toughness:lib.toughnessList.includes(p.toughness)?p.toughness:'common',attitude:lib.attitudes.includes(p.attitude)?p.attitude:'indifferent'};
  if(!lib.validPerson(person)){no('fields');continue;}
  const alike=tooAlike(person,[...others,...out]);if(alike){no('too alike: '+alike);continue;}
  for(const w of nameParts(name))used.add(w);out.push(person);
 }
 return {people:out,refused};
}
// The library as it stands on this PC (the script writes it between batches), for the uniqueness checks.
function existingPeople(file=path.join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-people','library.json')){
 try{const list=JSON.parse(fs.readFileSync(file,'utf8'));return Array.isArray(list)?list.filter(e=>e&&typeof e==='object'&&typeof e.name==='string').slice(0,2000).map(e=>({id:e.id,name:e.name,role:String(e.role??''),appearance:String(e.appearance??''),hook:String(e.hook??'')})):[];}catch{return [];}
}
async function writePeople(body,{apiKey,model,fetchImpl=fetch,onUsage=null,reasoning='low',timeout=170000,libraryFile}){
 const {brief,avoidNames}=body.context;
 if(!validBrief(brief)||!validAvoid(avoidNames))throw Object.assign(Error('The people brief is not one the library would send.'),{httpStatus:400});
 const avoid=(avoidNames??[]).map(n=>String(n).trim()).filter(Boolean);
 const response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},signal:AbortSignal.timeout(timeout),body:JSON.stringify({...modelOptions(model,reasoning),store:false,max_output_tokens:outputBudget(400*brief.length+1000,reasoning),instructions,input:JSON.stringify({brief:brief.map(({slot,species,gender,class:c,age,roleHint,hookTheme,placeKinds:k,terrain})=>({slot,species,gender,class:c,...(age?{age}:{}),roleHint,hookTheme,placeKinds:k,terrain})),avoidNames:avoid}),text:{format:{type:'json_schema',name:'people_batch',strict:true,schema:peopleSchema(brief)}}})});
 if(!response.ok)throw await providerError(response);
 const data=await response.json();if(onUsage)try{onUsage(data.usage);}catch{}
 if(data.status!=='completed')throw Error('The people batch was cut short. Ask again.');
 return tidyPeople(readJson(data),brief,avoid,existingPeople(libraryFile));
}
module.exports={writePeople,tidyPeople,tooAlike,nameParts,nameClash,existingPeople,similarity,peopleSchema,validBrief,famous,famousNames,most,instructions};
