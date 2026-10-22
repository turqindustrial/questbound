// Makes the host's library of ready-made people (people-library.cjs): three hundred people players run into, each with
// a portrait painted once, so meeting someone new costs nothing to paint (2026-10-16, the host's words: "use the api to
// generate 1000 completely unique npcs for the players to run into so that it doesn't eat up all of my credit as they
// progress", "make sure to keep in mind every class, race, and gender", then "let's cut that npc amount to 300 for now
// and make sure they are all entirely unique"). Run by hand on the host's PC, through the host's own running Dungeon
// Master (loopback, as the desktop game asks; the API key never leaves it):
//   node make-people-library.cjs              writes the people (text), 20 at a time, into .questbound-people/library.json
//   node make-people-library.cjs --portraits  paints each person's portrait, one at a time, into .questbound-people/<id>.jpg
// Options: --limit N (at most N people or portraits this run), --budget D (stop before this run spends D dollars),
// --plan (write the plan and say what is left to do and about what it would cost; nothing is asked of anyone),
// --batch 2 (the second batch as well: see below), --no-desktop (no copy to the Desktop folder). Both phases are
// resumable: what is done is skipped. Everything is under QUESTBOUND_DATA when that is set (a hosted game), else beside
// this file.
// The second batch (2026-10-22, the host's words: "make about 30 different portraits per race, appealing to all classes
// and non classes alike, then add them to the roster of character portraits that we already have"), ids np301…np690:
// thirty people of each species, fifteen trained (every class once, two classes twice) and fifteen ordinary, ten of
// each gender, each gender's ten spread over the ages (three young adults, two adults, two middle-aged, three old: the
// first batch had few young and old faces), a calling (secondClassHints and secondOrdinaryRoles, with a twist of its
// own) and a hook theme (secondThemes and secondAngles) never used before, the nine lands in turn. Its slots give the
// age, which the writer must keep. Entirely unique against the whole library, as the first batch was. Run, in order:
//   node make-people-library.cjs --batch 2 --plan        the plan and the expected cost (about $0.03 a portrait)
//   node make-people-library.cjs --batch 2               writes the 390 people (text, cents in all)
//   node make-people-library.cjs --portraits             paints every person not yet painted, one at a time
// The plan (.questbound-people/plan.json, written first and always the same), ids np001…np300: 169 trained people, every
// class with every species exactly once, genders turning so that each class and each species has all three; and 131
// ordinary people (no class) spread evenly over the 39 species and gender pairs (three each, four for fourteen of them).
// Every slot has a calling of its own (roleHint: a calling and a twist, never two alike) and a hook theme of its own
// (hookTheme), with kinds of place from the calling and the nine lands in turn. Nobody is a child. Entirely unique:
// the Dungeon Master refuses a name part used before or a look, calling or hook nearly the same as anyone's
// (people-writer.cjs), this script checks again before it keeps anyone, and a refused slot is asked for again.
// The host funds these jobs: their usage is tagged (job 'people-library') and never counts against the game's
// spending ceilings (spending.cjs). It stops cleanly, saying why, on an OpenAI billing or quota error, when a painting
// is refused for the key's access, or after three failures in a row.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const lib=require('./people-library.cjs');
const writer=require('./people-writer.cjs');
const total=300,batchSize=20;
const classHints={
 Artificer:[['tinker who mends clockwork and lamps',['settlement','road']],['engineer of bridges, locks and mills',['settlement','water']],['alchemist-smith with a cart of oddities',['road','camp']],['inventor of strange devices',['settlement','ruin']]],
 Barbarian:[['clan warrior far from home',['wilds','camp']],['pit fighter',['settlement','camp']],['hunter of the wild clans',['wilds','forest','mountain']],['bodyguard with a temper',['road','settlement']]],
 Bard:[['travelling minstrel',['road','settlement']],['storyteller at the hearth',['settlement','camp']],['herald and messenger',['road','landmark']],['court poet fallen on hard times',['settlement']]],
 Cleric:[['temple priest',['shrine','settlement']],['wandering healer-priest',['road','camp']],['shrine keeper',['shrine','landmark']],['battle chaplain',['camp','ruin']]],
 Druid:[['grove warden',['forest','shrine']],['herb-wise hermit',['wilds','forest']],['keeper of standing stones',['landmark','wilds']],['beast-speaker of the marshes and shores',['water','wilds']]],
 Fighter:[['veteran sellsword',['road','camp']],['guard captain',['settlement']],['retired soldier',['settlement','wilds']],['duelling instructor',['settlement']]],
 Monk:[['wandering ascetic',['road','mountain']],['monastery cook',['shrine','mountain']],['bare-handed doorwarden',['settlement']],['pilgrim of a silent order',['shrine','road']]],
 Paladin:[['oath-bound knight',['road','settlement']],['temple champion',['shrine']],['sentinel of an old order',['ruin','landmark']],['penitent errant',['road','wilds']]],
 Ranger:[['border scout',['wilds','mountain']],['tracker for hire',['forest','road']],['beast hunter',['forest','lair']],['road warden',['road']]],
 Rogue:[['smuggler',['water','cave']],['cutpurse with a code',['settlement']],['information broker',['settlement','road']],['locksmith of uncertain honesty',['settlement','ruin']]],
 Sorcerer:[['wild-blooded wanderer',['road','wilds']],['fortune-teller with real power',['settlement','camp']],['storm-touched sailor',['water']],['reluctant heir to strange magic',['settlement','landmark']]],
 Warlock:[['scholar bound by a bargain',['ruin','settlement']],['hermit with an unseen patron',['cave','wilds']],['debt-collector for an otherworldly power',['road','settlement']],['cursed heir of a fallen house',['ruin','landmark']]],
 Wizard:[['village sage',['settlement']],['tower scholar',['ruin','landmark']],['travelling lecturer',['road','settlement']],['curse-breaker for hire',['road','ruin']]],
};
const ordinaryRoles=[['innkeeper',['settlement','road']],['trader',['road','settlement','camp']],['farmer',['settlement','wilds']],['lay priest or temple servant',['shrine','settlement']],['gate guard',['settlement','road']],['sailor or boat hand',['water','settlement']],['outlaw',['forest','wilds','cave']],['minor noble',['settlement','landmark']],['scholar or scribe',['settlement','ruin']],['blacksmith',['settlement','camp']],['hermit',['mountain','cave','forest']],['ferry keeper',['water','road']],['herder',['wilds','mountain']],['miner',['cave','mountain']],['fisher',['water']],['hunter or trapper',['forest','wilds']],['herbalist',['forest','settlement']],['merchant',['settlement','road']],['camp cook',['camp','settlement']],['carter or wagoner',['road']],['beggar with sharp eyes',['settlement','road']],['pilgrim',['shrine','road']],['miller',['settlement','water']],['toll keeper',['road','landmark']],['lamplighter or night watch',['settlement']],['grave-digger',['shrine','settlement']],['weaver or tailor',['settlement']],['caravan guard',['road','camp']],['ruin-picker',['ruin','cave','lair']],['shepherd',['wilds','mountain']],['brewer',['settlement']],['courier',['road','settlement']],['midwife or healer',['settlement']],['mapmaker',['landmark','road','ruin']],['beast keeper',['camp','lair']]];
// What sets each calling apart (one per slot with its calling: never the same calling and twist twice).
const twists=['newly arrived from far away','near the end of a long career','with a reputation they did not earn','who works only by night','in debt to the wrong people','sworn to an old promise','travelling with a loyal animal','from a family of rivals','disgraced and starting over','quietly the best at it for miles','who has never left home before','who takes stories as payment','with a strange lucky charm','caring for a sick relative','with a small trade on the side','hiding a former life'];
// Hook themes: 25 kinds of trouble, each with 12 angles, 300 in all, never two alike.
const hookThemes=['a missing person','a forged document','a buried treasure','a broken oath','a stolen heirloom','a forbidden love','a hidden identity','a debt to a dangerous creditor','a cursed object','a secret map','an old crime','a rival\'s sabotage','a lost recipe or formula','a smuggled cargo','a prophecy they half believe','an inheritance dispute','a ghost they keep seeing','a sealed door','a poisoned well or field','a ring of false coin','a message that must be delivered','a stranger who once saved their life','a wager gone wrong','a creature they secretly feed','a betrayal in the family'];
const hookAngles=['that they cannot report to anyone','that someone powerful wants kept quiet','that only an outsider could help with','that ties them to the nearest ruin','that is about to come due','that they are ashamed of','that they lie about to everyone','that could make a stranger rich','that endangers their neighbours','that they would trade anything to undo','that a rival is also chasing','that nobody else believes'];
const trainedCount=lib.classList.length*lib.speciesList.length;
const order=key=>crypto.createHash('sha256').update('questbound-people-plan-v2\n'+key).digest('hex');
// The plan: always the same 300 slots, in a mixed order, ids np001…np300.
function planPeople(){
 const slots=[];
 lib.classList.forEach((cls,c)=>lib.speciesList.forEach((species,s)=>{const gender=lib.genderList[(c+s)%lib.genderList.length],[base,placeKinds]=classHints[cls][s%classHints[cls].length];slots.push({key:'trained:'+cls+':'+species,species,gender,class:cls,roleHint:base+', '+twists[(s+5*c)%twists.length],placeKinds});}));
 const combos=lib.speciesList.flatMap(species=>lib.genderList.map(gender=>({species,gender}))).sort((a,b)=>order('combo:'+a.species+':'+a.gender).localeCompare(order('combo:'+b.species+':'+b.gender)));
 for(let i=0;i<total-trainedCount;i++){const {species,gender}=combos[i%combos.length],b=i%ordinaryRoles.length,k=Math.floor(i/ordinaryRoles.length),[base,placeKinds]=ordinaryRoles[b];slots.push({key:'ordinary:'+i,species,gender,class:null,roleHint:base+', '+twists[(b+k)%twists.length],placeKinds});}
 slots.sort((a,b)=>order(a.key).localeCompare(order(b.key)));
 return slots.map((s,i)=>({slot:'np'+String(i+1).padStart(3,'0'),species:s.species,gender:s.gender,class:s.class,roleHint:s.roleHint,hookTheme:hookThemes[i%hookThemes.length]+' '+hookAngles[Math.floor(i/hookThemes.length)],placeKinds:s.placeKinds.slice(0,3),terrain:lib.terrains[i%lib.terrains.length]}));
}
// ---------- The second batch: about thirty more people of each species (np301…np690) ----------
const secondPerSpecies=30,secondTotal=secondPerSpecies*lib.speciesList.length;
// Callings never used in the first batch: four more for each class, forty more ordinary ones.
const secondClassHints={
 Artificer:[['repairer of mills, pumps and waterwheels',['settlement','water']],['maker of artificial limbs and braces',['settlement']],['salvager who rebuilds old ruin devices',['ruin','camp']],['lamp-and-lens grinder for lighthouses',['water','landmark']]],
 Barbarian:[['exiled chieftain\'s heir',['wilds','camp']],['avalanche-born mountain guide',['mountain']],['tavern bouncer with a long fuse',['settlement','road']],['raider turned ferryman',['water','wilds']]],
 Bard:[['puppeteer with a travelling stage',['road','settlement']],['funeral singer',['shrine','settlement']],['satirist hiding from a lord',['settlement','road']],['keeper of a clan\'s songs and lineages',['camp','landmark']]],
 Cleric:[['bone-setter for a mountain shrine',['shrine','mountain']],['chaplain to a mining crew',['cave','mountain']],['priest of a drowned god at the harbour',['water','shrine']],['caretaker of a roadside chapel',['road','shrine']]],
 Druid:[['beekeeper of the old hives',['forest','settlement']],['tide-reader of the salt flats',['water','wilds']],['keeper of a sacred spring',['shrine','wilds']],['seed-saver for burned fields',['settlement','wilds']]],
 Fighter:[['caravan master',['road','camp']],['arena champion gone grey',['settlement']],['bridge warden',['road','water','landmark']],['quartermaster of a frontier fort',['camp','ruin']]],
 Monk:[['tea-house keeper of a hidden order',['settlement','road']],['ferry pole-master who fights with the pole',['water']],['wandering mediator of feuds',['road','camp']],['lantern-bearer of a mountain stair',['mountain','shrine']]],
 Paladin:[['protector of a pilgrims\' road',['road','shrine']],['knight of a disbanded order',['ruin','settlement']],['oath-sworn hunter of grave robbers',['ruin','lair']],['champion of a poor parish',['settlement','shrine']]],
 Ranger:[['falconer of the high passes',['mountain','wilds']],['swamp guide',['wilds','water']],['poacher-catcher for a forest lord',['forest']],['map-runner for caravans',['road','camp']]],
 Rogue:[['fence for stolen relics',['settlement','ruin']],['card sharp of the river boats',['water','settlement']],['tomb-robber with a conscience',['ruin','cave']],['spy posing as a peddler',['road','settlement']]],
 Sorcerer:[['wanderer marked by a lightning strike',['wilds','mountain']],['heir to a dragon\'s bargain',['ruin','lair']],['healer whose own magic frightens them',['settlement']],['street performer with true sparks',['settlement','road']]],
 Warlock:[['pawnbroker with an unseen partner',['settlement']],['lighthouse keeper who hears the deep',['water','landmark']],['oracle bound to a buried thing',['cave','shrine']],['duellist with a borrowed blade-pact',['road','settlement']]],
 Wizard:[['archivist of a burned library',['ruin','settlement']],['weather-watcher in a stone tower',['landmark','mountain']],['apothecary-scholar',['settlement']],['retired battle mage running an orchard',['settlement','wilds']]],
};
const secondOrdinaryRoles=[['laundry keeper',['settlement','water']],['cooper or barrel-maker',['settlement']],['potter',['settlement','road']],['charcoal burner',['forest','camp']],['salt-panner',['water','wilds']],['stable hand',['settlement','road']],['tanner',['settlement']],['net-mender',['water']],['bell-ringer',['shrine','settlement']],['quarry worker',['mountain','cave']],['woodcutter',['forest']],['beekeeper',['forest','settlement']],['peddler of ribbons and needles',['road','settlement']],['cartographer\'s assistant',['settlement','landmark']],['dockhand',['water','settlement']],['goatherd',['mountain','wilds']],['candle-maker',['settlement','shrine']],['rat-catcher',['settlement','cave','lair']],['ferry cook',['water']],['shrine sweeper',['shrine']],['tollbridge clerk',['road','landmark']],['well-digger',['settlement','wilds']],['falconer\'s helper',['wilds','mountain']],['inn cook',['settlement','road']],['bookbinder',['settlement']],['dressmaker',['settlement']],['cheesemaker',['settlement','wilds']],['ropemaker',['settlement','water']],['ruin guide for travellers',['ruin','landmark']],['stew-seller who follows the camps',['camp','road']],['lighthouse lamp-trimmer',['water','landmark']],['grave-tender',['shrine','ruin']],['mushroom forager',['cave','forest']],['pack-mule driver',['road','mountain']],['retired sailor',['water','settlement']],['herb-seller at the market',['settlement']],['town crier',['settlement']],['scrap dealer',['camp','ruin','lair']],['ice-cutter',['mountain','settlement']],['lamp-oil seller',['settlement','road']]];
// Twists that suit any age, never one of the first batch's.
const secondTwists=['who keeps a meticulous diary','who never takes off a borrowed ring','who sings while working','who cannot read but hides it','who trusts animals more than people','with a famous relative they dislike','who collects odd buttons','who owes their life to a stranger','with a rival across the road','who is secretly generous','who always bargains','with a nickname they hate','who is training an apprentice','who saw something they should not have','who is saving for a journey','who speaks too plainly'];
// Hook themes: 26 kinds of trouble, each with 15 angles, 390 in all, none of them the first batch's.
const secondThemes=['a vanished caravan','a counterfeit relic','a sealed letter','a stolen horse','a midnight bargain','a lost sibling','a broken engagement','a hidden cellar','a poisoned gift','an old map fragment','a disputed boundary stone','a silent bell','a missing ledger page','a borrowed sword','a strange illness','a buried name','a ruined mill','a wrong grave','a bribed judge','a song that summons something','a foundling now grown','a lighthouse that went dark','a debt paid in the wrong coin','a festival that ended in blood','a gift from a dragon','an apprentice who ran away'];
const secondAngles=['that only they remember','that a neighbour suspects','that the law has forgotten','that is returning tonight','that they were paid to keep quiet','that started with a kindness','that someone is blackmailing them over','that they mean to set right alone','that has a witness nobody believes','that led them to this place','that their family must never learn','that a stranger keeps asking about','that is written down somewhere','that could cost them their trade','that they half believe was a dream'];
const secondOrder=key=>crypto.createHash('sha256').update('questbound-people-plan-2\n'+key).digest('hex');
// The second batch's plan: always the same 390 slots, in a mixed order, ids np301…np690.
function planSecondBatch(){
 const slots=[],ageSpread=['young','young','young','adult','adult','middle-aged','middle-aged','old','old','old'];
 let ordinaryIndex=0;
 lib.speciesList.forEach((species,s)=>{
  const classes=[...lib.classList,lib.classList[(2*s)%lib.classList.length],lib.classList[(2*s+1)%lib.classList.length]];
  // Ten of each gender (five trained, five ordinary), each ten spread over the ages, in a mixed but fixed order.
  const agesOf=Object.fromEntries(lib.genderList.map(g=>[g,ageSpread.map((age,i)=>({age,k:secondOrder('age:'+species+':'+g+':'+i)})).sort((a,b)=>a.k.localeCompare(b.k)).map(x=>x.age)]));
  const nextAge=g=>agesOf[g].shift();
  classes.forEach((cls,k)=>{const c=lib.classList.indexOf(cls),extra=k>=lib.classList.length,hints=secondClassHints[cls],[base,placeKinds]=hints[(s+(extra?2:0))%hints.length],gender=lib.genderList[(k+s)%3];slots.push({key:'trained2:'+species+':'+k,species,gender,class:cls,age:nextAge(gender),roleHint:base+', '+secondTwists[(s+3*c+(extra?7:0))%secondTwists.length],placeKinds});});
  for(let k=0;k<secondPerSpecies-classes.length;k++){const i=ordinaryIndex++,b=i%secondOrdinaryRoles.length,round=Math.floor(i/secondOrdinaryRoles.length),[base,placeKinds]=secondOrdinaryRoles[b],gender=lib.genderList[(k+s+1)%3];slots.push({key:'ordinary2:'+species+':'+k,species,gender,class:null,age:nextAge(gender),roleHint:base+', '+secondTwists[(b+round)%secondTwists.length],placeKinds});}
 });
 slots.sort((a,b)=>secondOrder(a.key).localeCompare(secondOrder(b.key)));
 return slots.map((s,i)=>({slot:'np'+String(total+1+i).padStart(3,'0'),species:s.species,gender:s.gender,class:s.class,age:s.age,roleHint:s.roleHint,hookTheme:secondThemes[i%secondThemes.length]+' '+secondAngles[Math.floor(i/secondThemes.length)],placeKinds:s.placeKinds.slice(0,3),terrain:lib.terrains[i%lib.terrains.length]}));
}
// The whole plan for a batch: the first batch, or both.
const planFor=batch=>batch>=2?[...planPeople(),...planSecondBatch()]:planPeople();
// What the plan's people look like, a line for each species (trained/ordinary, women/men/other, young/adult/middle-aged/old).
function planTable(slots){
 const rows=lib.speciesList.map(species=>{const mine=slots.filter(s=>s.species===species),n=f=>mine.filter(f).length;return '  '+species.padEnd(11)+String(mine.length).padStart(3)+'  trained '+n(s=>s.class)+', ordinary '+n(s=>!s.class)+'  ·  '+lib.genderList.map(g=>n(s=>s.gender===g)).join('/')+'  ·  '+lib.ages.map(a=>n(s=>s.age===a)).join('/');});
 return ['  people     all  trained, ordinary  ·  women/men/other  ·  young/adult/middle-aged/old',...rows].join('\n');
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>=0&&process.argv[i+1]!==undefined?Number(process.argv[i+1]):fallback;};
function runCost(dataDir,since){
 const s=require('./spending.cjs');let text=0;
 try{for(const line of fs.readFileSync(path.join(dataDir,'.questbound-usage.jsonl'),'utf8').split('\n'))if(line.trim())try{const e=JSON.parse(line);if(e.mode==='people'&&Date.parse(e.at)>=since)text+=s.costOf(e);}catch{}}catch{}
 return text;
}
const billing=message=>/insufficient_quota|billing|exceeded your current quota|HTTP 401|HTTP 403|rejected image-generation authorization|cannot generate images|usage limit|unavailable to this API project|not configured/i.test(String(message));
function writeAtomic(file,text){
 const temporary=file+'.'+crypto.randomBytes(4).toString('hex')+'.partial';fs.writeFileSync(temporary,text);
 for(let i=0;;i++){try{fs.renameSync(temporary,file);return;}catch(e){if(i>=5)throw e;const until=Date.now()+200;while(Date.now()<until);}}
}
async function main(){
 const dataDir=process.env.QUESTBOUND_DATA||__dirname,dir=path.join(dataDir,'.questbound-people'),dm=process.env.QB_DM_URL||'http://127.0.0.1:8084/dm';
 const desktop=process.argv.includes('--no-desktop')?null:path.join(process.env.USERPROFILE||process.env.HOME||dataDir,'Desktop','Questbound people');
 const limit=arg('--limit',Infinity),budget=arg('--budget',Infinity),started=Date.now(),batch=arg('--batch',1);
 if(![1,2].includes(batch)){console.log('--batch is 1 or 2.');return 1;}
 fs.mkdirSync(dir,{recursive:true});
 const plan=planFor(batch);writeAtomic(path.join(dir,'plan.json'),JSON.stringify(plan,null,1));
 const libraryFile=path.join(dir,'library.json');
 const readLibrary=()=>{try{const list=JSON.parse(fs.readFileSync(libraryFile,'utf8'));return Array.isArray(list)?list.filter(lib.validPerson):[];}catch{return [];}};
 if(process.argv.includes('--plan')){
  console.log('Plan written: '+plan.length+' people in '+path.join(dir,'plan.json'));
  // What is left to do, and about what it would cost: the text at what the people written so far cost (else a
  // generous guess), each portrait at the painting price.
  const library=readLibrary(),done=new Set(library.map(p=>p.id)),toWrite=plan.filter(s=>!done.has(s.slot)),toPaint=library.filter(p=>!fs.existsSync(path.join(dir,p.id+'.jpg'))).length+toWrite.length;
  const price=require('./spending.cjs').paintingPrice,spentText=runCost(dataDir,0),textEach=library.length&&spentText>0?spentText/library.length:0.001;
  if(batch>=2){const second=planSecondBatch();console.log('The second batch: '+second.length+' people ('+second[0].slot+'…'+second.at(-1).slot+'), '+second.filter(s=>s.class).length+' trained (every class with every species, two classes twice a species) and '+second.filter(s=>!s.class).length+' ordinary:\n'+planTable(second));}
  console.log('To write: '+toWrite.length+' people (text about $'+(toWrite.length*textEach).toFixed(2)+'). To paint: '+toPaint+' portraits (about $'+(toPaint*price).toFixed(2)+' at $'+price.toFixed(2)+' a portrait). About $'+(toWrite.length*textEach+toPaint*price).toFixed(2)+' in all.');
  if(toWrite.length)console.log('Next: node make-people-library.cjs'+(batch>=2?' --batch 2':'')+', then node make-people-library.cjs --portraits (both take --limit N and --budget D).');
  else if(toPaint)console.log('Next: node make-people-library.cjs --portraits (takes --limit N and --budget D).');
  return 0;
 }
 const ask=async(context,input,timeout)=>{
  const response=await fetch(dm,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:8081'},body:JSON.stringify({input,context:{choices:[],...context}}),signal:AbortSignal.timeout(timeout)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(Error(data?.error||('HTTP '+response.status)),{status:response.status});
  return data;
 };
 if(!process.argv.includes('--portraits')){
  // The people: written 20 at a time, with every name used so far, until each slot is filled.
  let library=readLibrary(),stale=0,made=0,failures=0;
  while(true){
   const done=new Set(library.map(p=>p.id)),pending=plan.filter(s=>!done.has(s.slot));
   if(!pending.length){console.log('All '+plan.length+' people are written.');break;}
   if(made>=limit){console.log('Stopped at the limit of '+limit+' this run.');break;}
   const spent=runCost(dataDir,started);if(spent>=budget){console.log('Stopped: this run has spent $'+spent.toFixed(2)+' (budget $'+budget.toFixed(2)+').');break;}
   const brief=pending.slice(0,Math.min(batchSize,limit-made));
   try{
    const reply=await ask({mode:'people-batch',brief,avoidNames:library.map(p=>p.name)},'Write these people.',200000);
    // Checked again here before anyone is kept: a whole person, one asked for, and unique (no name part used before,
    // nobody nearly the same as anyone already kept).
    const fresh=[],again=[];
    for(const p of Array.isArray(reply.people)?reply.people:[]){
     if(!lib.validPerson(p)||!brief.some(s=>s.slot===p.id)||done.has(p.id))continue;
     const used=new Set([...library,...fresh].flatMap(q=>writer.nameParts(q.name))),alike=writer.nameClash(p.name,used)?'name used':writer.tooAlike(p,[...library,...fresh]);
     if(alike){again.push(alike);continue;}
     fresh.push(p);
    }
    library=[...library,...fresh].sort((a,b)=>a.id.localeCompare(b.id));writeAtomic(libraryFile,JSON.stringify(library,null,1));
    made+=fresh.length;failures=0;stale=fresh.length?0:stale+1;
    console.log(new Date().toISOString().slice(11,19)+' wrote '+fresh.length+' of '+brief.length+(reply.refused?.length||again.length?' ('+((reply.refused?.length??0)+again.length)+' to ask again: '+[...new Set([...(reply.refused??[]).map(r=>r.reason),...again])].join(', ')+')':'')+'; '+library.length+'/'+plan.length+' in the library; text so far about $'+runCost(dataDir,started).toFixed(3));
    if(stale>=3){console.log('Stopped: three batches in a row added nobody. Look at the refusals above.');break;}
   }catch(e){
    if(billing(e.message)){console.log('Stopped: OpenAI refused for billing, quota or access ('+e.message.slice(0,200)+'). Nothing is lost; run again when it is sorted.');return 2;}
    failures++;console.log('Batch failed ('+String(e.message).slice(0,160)+')'+(failures>=3?'.':'; trying again shortly.'));
    if(failures>=3){console.log('Stopped after three failures in a row. Nothing is lost; run again later.');return 1;}
    await sleep(15000);
   }
  }
  if(desktop)try{fs.mkdirSync(desktop,{recursive:true});fs.copyFileSync(libraryFile,path.join(desktop,'library.json'));}catch{}
  return 0;
 }
 // The portraits: one at a time, so players' own pictures never wait behind them.
 const price=require('./spending.cjs').paintingPrice,library=readLibrary(),todo=library.filter(p=>!fs.existsSync(path.join(dir,p.id+'.jpg')));
 console.log(library.length+' people in the library, '+(library.length-todo.length)+' painted, '+todo.length+' to paint (about $'+(todo.length*price).toFixed(2)+' at $'+price.toFixed(2)+' a painting).');
 if(desktop)fs.mkdirSync(desktop,{recursive:true});
 let painted=0,failures=0;
 for(const person of todo){
  if(painted>=limit){console.log('Stopped at the limit of '+limit+' this run.');break;}
  if((painted+1)*price>budget){console.log('Stopped: this run has spent about $'+(painted*price).toFixed(2)+' on portraits (budget $'+budget.toFixed(2)+').');break;}
  const subject=lib.portraitSubject(person);let done=false,lastError='';
  try{
   let reply=await ask({mode:'art',subject,retry:true},'Paint this person.',30000);const t0=Date.now();
   while(reply?.status==='pending'&&Date.now()-t0<240000){await sleep(4000);reply=await ask({mode:'art',subject},'Paint this person.',30000);}
   const encoded=reply?.status==='ready'&&typeof reply.dataUrl==='string'?reply.dataUrl.replace(/^data:image\/jpeg;base64,/,''):null,bytes=encoded?Buffer.from(encoded,'base64'):null;
   if(bytes&&bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255){
    writeAtomic(path.join(dir,person.id+'.jpg'),bytes);if(desktop)fs.writeFileSync(path.join(desktop,person.id+'.jpg'),bytes);
    painted++;failures=0;done=true;
    console.log(new Date().toISOString().slice(11,19)+' painted '+person.id+' '+person.name+' ('+(library.length-todo.length+painted)+'/'+library.length+'); this run about $'+(painted*price).toFixed(2));
   }else lastError=reply?.error??('the picture was '+(reply?.status??'not answered'));
  }catch(e){lastError=e.message;}
  if(done)continue;
  if(billing(lastError)){console.log('Stopped: OpenAI refused the painting for billing, quota or access ('+String(lastError).slice(0,200)+'). Nothing is lost; run again when it is sorted.');return 2;}
  failures++;console.log('Not painted: '+person.id+' ('+String(lastError).slice(0,160)+')');
  if(failures>=3){console.log('Stopped after three failures in a row. Nothing is lost; run again later.');return 1;}
  await sleep(10000);
 }
 if(desktop)try{fs.copyFileSync(libraryFile,path.join(desktop,'library.json'));}catch{}
 const left=readLibrary().filter(p=>!fs.existsSync(path.join(dir,p.id+'.jpg'))).length;
 console.log('Painted '+painted+' this run (about $'+(painted*price).toFixed(2)+'); '+left+' left to paint.');
 return 0;
}
if(require.main===module)main().then(code=>process.exit(code??0),e=>{console.error(e.message);process.exit(1);});
module.exports={planPeople,planSecondBatch,planFor,planTable,classHints,ordinaryRoles,twists,hookThemes,hookAngles,secondClassHints,secondOrdinaryRoles,secondTwists,secondThemes,secondAngles,total,secondTotal,secondPerSpecies,trainedCount};
