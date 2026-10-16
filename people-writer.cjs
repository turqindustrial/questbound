// Writes a batch of the host's ready-made people (people-library.cjs) for make-people-library.cjs: the Dungeon
// Master's 'people-batch' mode, which only the host may use (dm-server.cjs refuses it to anyone with a guest label, and
// the gateways never pass the mode on). The script sends a brief of up to 20 slots (species, gender, class or null,
// a hint of their calling, the kinds of place and the land they belong to) and the first names already used; the
// story model writes exactly those people with a strict schema, at low effort (short profiles), and every person is
// checked and tidied here before it is returned: their kind, gender and class as asked, our own world's names (never
// a famous one), no name or first name used twice, lengths within the game's limits, and no facial hair on a woman.
// Loaded afresh with dm-server.cjs on every request.
const {providerError}=require('./ai-diagnostics.cjs');
const {modelOptions,outputBudget,readJson}=require('./ai-request.cjs');
const lib=require('./people-library.cjs');
const most=20;
// Names that belong to someone else's world (books, games, films): never used for one of ours, matched word by word.
const famousNames=['drizzt','elminster','strahd','vecna','lolth','mordenkainen','tasha','bigby','volo','xanathar','jarlaxle','bruenor','wulfgar','entreri','minsc','jaheira','imoen','astarion','shadowheart','karlach','laezel',"lae'zel",'halsin','minthara','raistlin','caramon','tasslehoff','tanis','gandalf','frodo','bilbo','samwise','aragorn','legolas','gimli','galadriel','elrond','arwen','sauron','saruman','boromir','faramir','eowyn','éowyn','thranduil','thorin','smaug','geralt','yennefer','ciri','jaskier','dumbledore','voldemort','hermione','daenerys','tyrion','cersei','targaryen','lannister','moiraine','egwene','kvothe','rincewind','elric','belgarath','polgara','allanon','kaladin','kelsier','dovahkiin','alduin','ulfric','morrigan','leliana','varric','ganondorf','zelda','sephiroth','aerith','tifa','tiamat','bahamut','asmodeus','acererak','faerun','waterdeep','neverwinter','greyhawk','eberron','ravenloft']; // book-name guard: these are refused, never used
const famous=name=>String(name).toLowerCase().split(/[\s-]+/).some(w=>famousNames.includes(w.replace(/[^a-zà-ÿ']/g,'')));
const firstOf=name=>String(name).trim().split(/\s+/)[0].toLowerCase();
const cut=(v,max)=>{const s=String(v??'').replace(/\s+/g,' ').trim();if(s.length<=max)return s;const head=s.slice(0,max),end=Math.max(head.lastIndexOf('. '),head.lastIndexOf('! '),head.lastIndexOf('? '));return end>max/2?head.slice(0,end+1):head.slice(0,max-1).replace(/\s+\S*$/,'')+'…';};
// The brief as the script sends it: refused whole when it is not one the script would send.
function validBrief(brief){
 return Array.isArray(brief)&&brief.length>=1&&brief.length<=most&&new Set(brief.map(s=>s?.slot)).size===brief.length&&brief.every(s=>s&&typeof s==='object'&&lib.poolIdPattern.test(String(s.slot))&&lib.speciesList.includes(s.species)&&lib.genderList.includes(s.gender)&&(s.class===null||lib.classList.includes(s.class))&&typeof s.roleHint==='string'&&s.roleHint.length>=3&&s.roleHint.length<=160&&Array.isArray(s.placeKinds)&&s.placeKinds.length>=1&&s.placeKinds.length<=3&&s.placeKinds.every(k=>lib.placeKinds.includes(k))&&lib.terrains.includes(s.terrain));
}
const validAvoid=a=>a===undefined||(Array.isArray(a)&&a.length<=3000&&a.every(n=>typeof n==='string'&&n.length<=60));
function peopleSchema(brief){
 const str={type:'string'},pick=values=>({type:'string',enum:values});
 const item={type:'object',properties:{slot:pick(brief.map(s=>s.slot)),name:str,gender:pick([...new Set(brief.map(s=>s.gender))]),species:pick([...new Set(brief.map(s=>s.species))]),age:pick(lib.ages),role:str,class:{type:['string','null'],enum:[null,...new Set(brief.map(s=>s.class).filter(Boolean))]},appearance:str,personality:str,motive:str,voice:str,hook:str,placeKinds:{type:'array',maxItems:4,items:pick(lib.placeKinds)},terrains:{type:'array',maxItems:4,items:pick(lib.terrains)},toughness:pick(lib.toughnessList),attitude:pick(lib.attitudes)},additionalProperties:false};
 item.required=Object.keys(item.properties);
 return {type:'object',properties:{people:{type:'array',minItems:brief.length,maxItems:brief.length,items:item}},required:['people'],additionalProperties:false};
}
const instructions=`Write the people described in context.brief for Questbound, an original fantasy world: one person for each slot, in the same order, with that slot's id as slot. These are the ordinary and extraordinary people a traveller meets on the road, in villages, camps and wild places; each will be met by players and painted once for a portrait, so make every one of them memorable, specific and different from every other.
Each person has exactly the slot's species, gender (woman, man or other: someone who is neither) and class (a class means their life has truly made them one: a sellsword who is a real Fighter, a temple priest who is a Cleric; null means ordinary folk with no class). roleHint is a starting point for their calling, not a script: give them a role of a few words (at most 80 characters) that fits it, the slot's placeKinds and its terrain.
name: a full name (given name and, usually, a family name or byname), at most 40 characters, letters only, in Questbound's own style and suited to their kind; every given name must be new: never one in context.avoidNames and never two alike in this batch. Never use a name from any book, game, film or myth (no Drizzt, Elminster, Gandalf, Geralt or the like), and never a real celebrity's name.
age: young (a young adult; never a child), adult, middle-aged or old.
appearance: 25 to 55 words (under 350 characters) a portrait painter can work from: face, build, colouring, hair, clothing and one distinguishing mark, consistent with their species, age, gender and calling. A woman never has a beard, moustache, stubble or any facial hair, whatever her species (a dwarf woman has no beard), and her appearance never mentions one.
personality: how they speak and act, at most 120 characters. voice: one speech habit or turn of phrase, at most 80 characters. motive: what they want, at most 200 characters. hook: one sentence (at most 200 characters), a secret, trouble or story the hero could stumble into through them, playable in any tale and never naming a real place.
placeKinds: one to four kinds of place where they would be found (start with the slot's); terrains: one to four lands they suit (start with the slot's terrain). toughness: frail for the old and sickly, tough for fighters and hardened folk, else common. attitude: how they usually take to strangers (unfriendly, indifferent or friendly; vary it).
OWN WORLD: never use names, places, gods, organisations or creatures that belong to any publisher, game, book or film beyond the licensed System Reference Document. Keep everything suitable for players 16 and over.`;
// Every person checked and tidied, or refused (the script asks again for a refused slot in a later batch).
function tidyPeople(raw,brief,avoidNames=[]){
 const used=new Set(avoidNames.map(firstOf)),usedFull=new Set(avoidNames.map(n=>String(n).trim().toLowerCase())),out=[],refused=[];
 const bySlot=new Map((Array.isArray(raw?.people)?raw.people:[]).filter(p=>p&&typeof p==='object').map(p=>[p.slot,p]));
 for(const slot of brief){
  const p=bySlot.get(slot.slot),no=reason=>refused.push({slot:slot.slot,reason});
  if(!p){no('missing');continue;}
  const name=String(p.name??'').replace(/\s+/g,' ').trim();
  if(!/^[\p{L}][\p{L}'’ -]{2,39}$/u.test(name)||name.split(' ').length>4){no('name');continue;}
  if(famous(name)){no('famous name');continue;}
  if(used.has(firstOf(name))||usedFull.has(name.toLowerCase())){no('name used');continue;}
  if(p.species!==slot.species||p.gender!==slot.gender||(p.class??null)!==slot.class){no('kind');continue;}
  let appearance=String(p.appearance??'').replace(/\s+/g,' ').trim();
  if(slot.gender==='woman')appearance=lib.withoutFacialHair(appearance);
  appearance=cut(appearance,lib.limits.appearance);
  if(appearance.split(' ').length<15){no('appearance');continue;}
  const person={id:slot.slot,name,gender:slot.gender,species:slot.species,age:lib.ages.includes(p.age)?p.age:'adult',role:cut(p.role,lib.limits.role),class:slot.class,appearance,personality:cut(p.personality,lib.limits.personality),motive:cut(p.motive,lib.limits.motive),voice:cut(p.voice,lib.limits.voice),hook:cut(p.hook,lib.limits.hook),
   placeKinds:[...new Set([...slot.placeKinds,...(Array.isArray(p.placeKinds)?p.placeKinds:[])].filter(k=>lib.placeKinds.includes(k)))].slice(0,4),terrains:[...new Set([slot.terrain,...(Array.isArray(p.terrains)?p.terrains:[])].filter(t=>lib.terrains.includes(t)))].slice(0,4),
   toughness:lib.toughnessList.includes(p.toughness)?p.toughness:'common',attitude:lib.attitudes.includes(p.attitude)?p.attitude:'indifferent'};
  if(!lib.validPerson(person)){no('fields');continue;}
  used.add(firstOf(name));usedFull.add(name.toLowerCase());out.push(person);
 }
 return {people:out,refused};
}
async function writePeople(body,{apiKey,model,fetchImpl=fetch,onUsage=null,reasoning='low',timeout=170000}){
 const {brief,avoidNames}=body.context;
 if(!validBrief(brief)||!validAvoid(avoidNames))throw Object.assign(Error('The people brief is not one the library would send.'),{httpStatus:400});
 const avoid=(avoidNames??[]).map(n=>String(n).trim()).filter(Boolean);
 const response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},signal:AbortSignal.timeout(timeout),body:JSON.stringify({...modelOptions(model,reasoning),store:false,max_output_tokens:outputBudget(400*brief.length+1000,reasoning),instructions,input:JSON.stringify({brief:brief.map(({slot,species,gender,class:c,roleHint,placeKinds:k,terrain})=>({slot,species,gender,class:c,roleHint,placeKinds:k,terrain})),avoidNames:avoid}),text:{format:{type:'json_schema',name:'people_batch',strict:true,schema:peopleSchema(brief)}}})});
 if(!response.ok)throw await providerError(response);
 const data=await response.json();if(onUsage)try{onUsage(data.usage);}catch{}
 if(data.status!=='completed')throw Error('The people batch was cut short. Ask again.');
 return tidyPeople(readJson(data),brief,avoid);
}
module.exports={writePeople,tidyPeople,peopleSchema,validBrief,famous,famousNames,most,instructions};
