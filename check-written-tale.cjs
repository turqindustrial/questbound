#!/usr/bin/env node
// The authoring checker for a written tale (WRITTEN-TALES.md; the build specification's 5.3). Deterministic: no AI, no
// network, no ports. It reads one tale file (.questbound-written/<slug>.json, or a draft anywhere) and the host's
// libraries read-only, seats the tale with the game's own rules (rules-files.cjs, the same rules the campaign server
// runs) and reports, check by check:
//   1 Shape and limits   every field the format names, its limits and the written-tale limits; tidying cuts nothing.
//   2 Seating            the ready-made Fighter, Rogue, Wizard and Cleric at the tale's lowest, middle and highest level,
//                        and parties of 2 and 4 heroes (partyInTale): every resident, landmark and land seated as written.
//   3 Names              every name resolves; names unique in the tale and across the shelf; the avoid and deny lists;
//                        people cast from the library (pool) keep its name, species and gender.
//   4 Structure          finds (two different routes, one mechanical, talk standing alone only in two exchanges and
//                        beside nothing but deeds); nothing that holds as its chapter opens (chapter 1 read exactly,
//                        with beatHolds, against every seated hero) or can never hold there (order: what a later
//                        chapter gives, arms or decides); beats, choices, leads and endings that never get their turn;
//                        what the engine cannot do (keeper or mara moved, a starting place changed or armed, a place
//                        armed twice a chapter); the clock's stall bound; the staging's size; the tier's budgets.
//   5 Walkthroughs       TODO (needs the staging engine, withBeats): today only the walkthrough's shape and names.
//   6 Pictures           cover unique on the shelf; every creature fits the creature library; every place the place
//                        library; every person without a pool is of a common people (a free look-alike face).
//   7 Text               the opening, the reading load before the first move, no digits or rule talk (in its rule
//                        sense: ruleTalk) in what the game tells, no rule talk in what the player reads from the
//                        staging, overused words.
//   8 Balance            each set piece and the tale's foe for the ready-made Fighter, Rogue, Wizard and Cleric at the
//                        tale's lowest, middle and highest level, alone and with one more hero (tale-balance.cjs,
//                        seeded dice): against the targets as warnings (provisional); a fight the Fighter alone at the
//                        tale's lowest level wins less than half the time, or dies in one fight in five or more, is an error.
//                        The Start here tale's chapter-1 set piece won under 80%, or a death in one fight in ten, by any of the four alone is an error.
//   9 Experience         the levels the golden path gives (warnings).
// Usage (from a checkout or worktree of the build branch, never the live checkout):
//   node check-written-tale.cjs <tale.json> [--json] [--people <dir>] [--creatures <dir>] [--places <dir>] [--shelf <dir>]
//                               [--balance <fights a cell, default 40>] [--no-balance]
// The folders default to the live data folders (.questbound-people, .questbound-creatures, .questbound-place-art,
// .questbound-written) under QUESTBOUND_DATA, this checkout, or the main checkout of this git repository. They are only
// read. Exit 0 when the tale passes (warnings allowed), 1 when it fails or cannot be checked.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const {rulesSource}=require('./rules-files.cjs');

// The Start here tale's first fight, for each ready-made hero alone at its lowest level (check 8, an error below it).
const firstFight={won:0.8,death:0.1};
const checkNames={1:'Shape and limits',2:'Seating',3:'Names',4:'Structure',5:'Walkthroughs',6:'Pictures',7:'Text',8:'Balance',9:'Experience'};
// ---------- Lists ----------
// Overused or clashing names (SPEC 4.2): never a whole word of any name in a tale; no place name with "glass" in it.
const avoidNames=['Pell','Noll','Rusk','Tallow','Edda','Mara','Sorn','Voss','Vell','Venn','Vale','Tern','Ysolde'];
// Never anywhere in a tale, names, roles or prose.
const avoidWords=['reeve','crossroads'];
// book-name guard: names never to use (other publishers' worlds, people, gods and creatures), anywhere in a tale.
const publisherWords=/\b(?:beholders?|mind ?flayers?|illithids?|displacer|carrion crawlers?|umber hulks?|githyanki|githzerai|kuo-?toa|slaad|slaadi|yuan-?ti|gauth|tiamat|bahamut|strahd|vecna|lolth|orcus|demogorgon|asmodeus|drizzt|elminster|mordenkainen|tasha|bigby|underdark|faer[uû]n|waterdeep|ravenloft|eberron|greyhawk|baldur|neverwinter|forgotten realms|sword coast|dragonlance|spelljammer|planescape|wargs?|nazg[uû]l|balrogs?|uruks?|ents|hobbits?|middle-earth|westeros|skaven|nurgle|khorne|tyranids?|draugr|drowners?|leshen|xenomorphs?|cthulhu|shoggoths?|dementors?|dungeons ?& ?dragons|d&d|pathfinder|golarion|warhammer)\b/i;// book-name guard
// book-name guard: the subclass and feature names of other books (a copy of verify-subclasses.cjs's deny list, which
// verify-written-format.cjs keeps in step), never used as or in a proper name of a tale (people, places, lands, the
// region, the title, creatures, items). Ordinary words among them (Order, Peace, Grave...) stay free in prose and in
// chapter and ending titles.
const subclassNames=['Hidden Step','Fey Step','Elder Champion','Battle Master','Eldritch Knight','Arcane Archer','Cavalier','Samurai','Psi Warrior','Rune Knight','Echo Knight','Banneret','Totem Warrior','Ancestral Guardian','Storm Herald','Zealot','Wild Heart','World Tree','Path of the Beast','Path of the Giant','Valor','Glamour','Swords','Whispers','Creation','Eloquence','Spirits','Dance','Knowledge','Light Domain','Nature Domain','Tempest','Trickery','War Domain','Death Domain','Forge','Grave','Order','Peace','Twilight','Moon','Dreams','Shepherd','Spores','Stars','Wildfire','Circle of the Sea','Shadow','Elements','Mercy','Drunken','Kensei','Sun Soul','Long Death','Astral Self','Ancients','Vengeance','Conquest','Redemption','Glory','Watchers','Crown','Noble Genies','Beast Master','Gloom Stalker','Horizon Walker','Monster Slayer','Fey Wanderer','Swarmkeeper','Drakewarden','Winter Walker','Assassin','Arcane Trickster','Inquisitive','Mastermind','Scout','Swashbuckler','Phantom','Soulknife','Wild Magic','Divine Soul','Shadow Magic','Storm Sorcery','Aberrant','Clockwork','Lunar','Spellfire','Archfey','Great Old One','Celestial','Hexblade','Fathomless','Genie','Undead Patron','Undying','Abjur*','Conjur*','Divin*','Enchant*','Illusion*','Necroman*','Transmut*','Bladesing*','War Magic','Chronurgy','Graviturgy','Scribes','Cartographer',
 'Combat Superiority','Superiority Dice','Arcane Ward','Portent','Shadow Step','Dread Ambusher',"Hexblade's Curse",'Eldritch Cannon','Steel Defender','Experimental Elixir','Arcane Armor','Vow of Enmity','Bladesong','Rakish Audacity','Colossus Slayer','Arcane Jolt','Battle Ready','Fortified Position','Explosive Cannon','Arcane Firearm','Restorative Reagents','Chemical Mastery','Alchemical Savant','Perfected Armor','Improved Defender','Armor Model','Coordinated Attack',
 // The Artificer's specialities as another publisher named them (verify-subclasses.cjs, 2026-10-22).
 'Alchemist','Armorer','Artillerist','Battle Smith'];
const subclassPatterns=subclassNames.map(d=>({name:d.replace(/\*$/,''),re:new RegExp('\\b'+d.replace(/\*$/,'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/'/g,"['’]")+(d.endsWith('*')?'\\w*':'\\b'),'i')}));
// Rule talk: never in what the game tells, the player reads or the Dungeon Master is handed from the staging. Matched in
// its rule sense, so ordinary English stays free ("round the fire", "turn back", "level ground", "the cart rolls out",
// "keep it in check", "at every turn", "storm damage", "to his advantage", "took the initiative").
const numberWords='one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty';
const rulePhrases=[/\bhp\b/i,/\bdc\b/i,/\bxp\b/i,/\bhit points?\b/i,/\bsaving throws?\b/i,/\barmou?r class\b/i,/\bspell slots?\b/i,/\bexperience points?\b/i,/\bbonus actions?\b/i,/\bproficiency bonus\b/i,
 /\b(?:with|has|have|had|gains?|gets?|grants?|at)\s+(?:dis)?advantage\b/i,/\b(?:dis)?advantage on\b/i,
 /\broll(?:s|ed|ing)?\s+(?:for\s+)?initiative\b/i,/\binitiative\s+(?:order|roll|count)\b/i,
 /\b(?:deals?|dealt|dealing|takes?|took|taking|suffers?|suffered)\s+(?:\w+\s+){0,2}damage\b/i,/\b(?:slashing|piercing|bludgeoning|fire|cold|poison|necrotic|radiant|psychic|thunder|lightning|acid|force)\s+damage\b/i,/\bdamage\s+(?:rolls?|dice|die)\b/i,/\bpoints? of damage\b/i,
 /\b(?:your|his|her|their|my)\s+rolls?\b/i,/\b(?:dice|die|d20)\s+rolls?\b/i,/\broll(?:s|ed)?\s+(?:of\s+)?(?:a|an|the)\s+(?:die|dice)\b/i,/\b(?:natural|failed|bad|good|lucky|high|low)\s+roll\b/i,/\broll(?:s|ed)?\s+(?:high|low|well|badly)\b/i,
 /\b(?:ability|skill|world|perception|insight|stealth|athletics|acrobatics|persuasion|deception|intimidation|investigation|arcana|survival|medicine|history|religion|nature|performance|strength|dexterity|constitution|intelligence|wisdom|charisma)\s+checks?\b/i,/\b(?:a|your|failed|passed|successful)\s+checks?\b/i,/\bchecks?\s+(?:fails?|failed|succeeds?|succeeded|passes|passed)\b/i,
 /\blevel(?:s|led|ed|ing)?\s+up\b/i,/\b(?:your|character|spell|caster|hero's|hero’s)\s+levels?\b/i,new RegExp('\\blevels?\\s+(?:'+numberWords+')\\b','i'),/\b(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)[- ]level\b/i,
 /\bslots?\s+(?:left|spent|remaining)\b/i,
 /\b(?:your|my|its|their|the foe's|the enemy's|next|per|this|each)\s+turns?\b(?!\s+(?:back|away|round|around|aside|over|to|toward|towards|into|out|off|on|up|down|from|in|of|at))/i,/\bturn order\b/i,/\bend (?:of )?(?:your|the|their|this|his|her) turn\b/i,
 /\b(?:this|next|each|every|per|one more|another)\s+rounds?\b(?!\s+(?:of (?:drinks|ale|applause|cheers)|table|stone|tower|window|face|belly|hut|room|hill|top|shield))/i,/\brounds? of (?:combat|fighting|battle)\b/i,new RegExp('\\b(?:in|for|within|after|over)\\s+(?:a few|several|'+numberWords+')\\s+rounds\\b','i')];
const ruleTalk=t=>{for(const re of rulePhrases){const m=String(t??'').match(re);if(m)return m[0];}return null;};
// Words that make tales sound alike: each at most once in a whole tale.
const overused=[['ledger',/\bledgers?\b/gi],['archive',/\barchiv(?:e|es|ed|ist|ists)\b/gi],['hearing',/\bhearings?\b/gi],['record',/\brecord(?:s|ed|ing|ings)?\b/gi],['tally',/\btall(?:y|ies|ied)\b/gi]];
// Words in people's names that are titles, not names (name parts are compared without them).
const honorifics=new Set('the of old young brother sister mother father ma pa nan gran granny grandmother grandfather dame sir lady lord duchess duke captain sergeant marshal elder squire jarl princess prince queen king councillor factor harbour-master harbor-master lord-protector lord-general master mistress goodwife goodman widow doctor the-elder'.split(' '));
// The tiers (SPEC 1.1). fights counts set pieces, places armed by an effect and the boss.
const tiers={
 short:{stall:24,options:3,size:16000,chapters:[2,2],pressure:[3,3],endings:[2,4],choices:[1,2],leads:[0,1],people:[4,7],landmarks:[2,4],landmarkMiles:1,farLands:[0,0],fights:[3,4],moves:45,movesLeast:25,levelsGained:[1,2],minutes:[30,60],minuteStep:10},
 medium:{stall:40,options:3,size:32000,chapters:[3,4],pressure:[3,4],endings:[3,4],choices:[2,3],leads:[2,2],people:[6,9],landmarks:[4,5],landmarkMiles:null,farLands:[0,1],fights:[6,8],moves:180,movesLeast:100,levelsGained:[3,4],minutes:[120,240],minuteStep:30},
 long:{stall:48,options:4,size:48000,chapters:[5,6],pressure:[4,4],endings:[3,4],choices:[3,4],leads:[3,4],people:[9,12],landmarks:[6,6],landmarkMiles:null,farLands:[1,2],fights:[12,Infinity],moves:450,movesLeast:300,levelsGained:[5,7],minutes:[360,1200],minuteStep:30}};
const compass=['N','NE','E','SE','S','SW','W','NW'];
const packTemplates=['goblin','zombies','wolves'],singleOf={zombies:'skeleton',wolves:'wolf',orc:'goblin'};
const stepKinds=['go','say','fight','confront','search','check','rest','choose','join','find','attack','advance','lead','wait'];
const fileKeys=['format','id','slug','edition','order','listed','addedAt','length','minutes','difficulty','party','levels','firstTale','notes','shape','pitch','story','walkthrough'];
const storyKeys=['title','premise','opening','objective','resolution','secret','foe','foeSpecies','foeAppearance','foeDamageType','foeVoice','hoard','region','terrain','layout','landmarks','lands','chapters','leads','locations','npcs','residents','introduction','openingDialogue','staging'];
const storyOptional=new Set(['lands','leads']);
const setByGame={id:'the game gives each copy its own id',status:'the game sets it',written:'the shelf sets it when a copy starts',libraryId:'the shelf sets it',artId:'the shelf sets it',foeStats:'the game works the foe out from the hero\'s level',errand:'written tales have no errand: chapter 1 is their first step',introId:'the game sets it',geography:'write layout instead',chapter:'the game keeps the chapter under way',pitch:'the pitch sits beside the story, at the top of the file',regard:'the game works out each person\'s view of the hero\'s kind'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ---------- Small helpers ----------
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const arr=v=>Array.isArray(v)?v:[];
const isText=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
const nameKey=n=>String(n??'').replace(/[’‘]/g,'\'').replace(/\s+/g,' ').trim().toLowerCase().replace(/^the /,'');
const endsOnSentence=t=>typeof t==='string'&&/[.!?]["'”’)]*$/.test(t.trim())&&!/…["'”’)]*$/.test(t.trim());
const wordsOf=t=>String(t??'').match(/[A-Za-z][A-Za-z'’-]*/g)??[];
// The parts of a person's name that are theirs (titles and little words left out), lower-case.
const nameParts=n=>wordsOf(n).map(w=>w.replace(/['’]s$/i,'').toLowerCase()).filter(w=>w.length>=3&&!honorifics.has(w));
const plural=(n,word)=>n+' '+word+(n===1?'':'s');

// The rules, loaded once: the same files the campaign server runs (rules-files.cjs).
let engine=null;
function rules(){
 if(engine)return engine;
 engine=vm.runInNewContext(rulesSource()+'\n;({readyHero,readyHeroes,blankBuild,makeCharacter,isValidCharacter,automaticSpells,spellLimits,spellsForClass,subclassOptions,newAdventure,freshStoryGame,tidyStory,validStory,validAdventure,adventureSnapshot,startParty,joinParty,partyView,partyInTale,validHoard,validTies,validIntroduction,introductionFields,placeKinds,terrains,templateKeys,attitudeLevels,genders,npcClassList,tieKinds,foeTieKinds,magicItems,stagingProblems,stagingIds,stagingNamesUsed,stagingMechanical,stagingEvents,stagingPacing,writtenLengths,validWrittenTag,beatHolds,openingPace,metPerson,maxLandmarks,maxResidents,rarityAllowed,'+[...new Set([...require('./written-walk.cjs').needs,...require('./tale-balance.cjs').needs])].join(',')+'})',{AsyncStorage:{},console},{timeout:10000});
 return engine;
}

// ---------- The libraries (read-only) ----------
// Where the live data folders are: QUESTBOUND_DATA, this checkout, then the main checkout of this git repository (a
// worktree has none of its own).
function dataRoots(){
 const roots=[process.env.QUESTBOUND_DATA,__dirname].filter(Boolean);
 try{
  let common=execFileSync('git',['-C',__dirname,'rev-parse','--git-common-dir'],{encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:5000}).trim();
  if(common){if(!path.isAbsolute(common))common=path.resolve(__dirname,common);roots.push(path.dirname(common));}
 }catch{}
 return [...new Set(roots.map(r=>path.resolve(r)))];
}
function folder(given,name){
 if(given)return {dir:path.resolve(given),given:true,found:fs.existsSync(path.resolve(given))};
 for(const root of dataRoots()){const dir=path.join(root,name);if(fs.existsSync(dir))return {dir,given:false,found:true};}
 return {dir:null,given:false,found:false,looked:dataRoots().map(r=>path.join(r,name))};
}
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function loadPeople(dir){const list=readJson(path.join(dir,'library.json'));return (Array.isArray(list)?list:[]).filter(e=>plain(e)&&/^np\d{3}$/.test(String(e.id))&&typeof e.name==='string');}
function loadCreatures(dir){
 const {catalogue}=require('./creature-library.cjs'),byId=new Map(catalogue.pictures.map(p=>[p.id,p])),seen=new Set(),list=readJson(path.join(dir,'library.json'));
 return (Array.isArray(list)?list:[]).filter(e=>plain(e)&&typeof e.id==='string'&&/^[a-z]+(?:-[a-z]+)*-\d$/.test(e.id)&&byId.has(e.id)&&e.file===e.id+'.jpg'&&!seen.has(e.id)&&seen.add(e.id)).map(e=>({...byId.get(e.id),file:e.file}));
}
function loadPlaces(dir){
 const {placeKinds,terrains}=require('./place-library.cjs'),seen=new Set(),list=readJson(path.join(dir,'library.json'));
 return (Array.isArray(list)?list:[]).filter(e=>plain(e)&&typeof e.id==='string'&&/^[a-z]{3,12}-[a-z]{4,10}-\d{1,2}$/.test(e.id)&&placeKinds.includes(e.kind)&&terrains.includes(e.terrain)&&e.file===e.id+'.jpg'&&!seen.has(e.id)&&seen.add(e.id)).map(e=>({id:e.id,kind:e.kind,terrain:e.terrain,file:e.file}));
}
function loadShelf(dir,self){
 const tales=[],skipped=[];
 for(const name of fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort()){
  const file=path.join(dir,name);if(path.resolve(file)===path.resolve(self))continue;
  try{const t=readJson(file);if(plain(t)&&t.format===1&&plain(t.story))tales.push({file,tale:t});else skipped.push(name);}catch{skipped.push(name);}
 }
 return {tales,skipped};
}

// ---------- A ready-made hero at any level (through the developer options, as the checks do) ----------
function heroAt(key,level){
 const r=rules();
 if(level===1)return r.readyHero(key);
 const form=r.readyHeroes.find(h=>h.key===key).form,sub=Object.keys(r.subclassOptions[form.class]??{})[0]??'';
 const auto=r.automaticSpells({...form,level,plannedSubclass:sub}),limits=r.spellLimits({class:form.class,level}),list=r.spellsForClass(form.class,level).filter(s=>!auto.includes(s.id));
 if(!limits)return r.makeCharacter({...r.blankBuild(),...form,level,devLevel:level,advancements:[],plannedSubclass:sub,spells:[],spellbook:[],spellSelectionVersion:2});
 const take=(pool,n)=>[...new Set([...(form.spells??[]).filter(id=>pool.some(s=>s.id===id)),...pool.map(s=>s.id)])].slice(0,n),prepared=take(list.filter(s=>s.level>0),limits.prepared);
 return r.makeCharacter({...r.blankBuild(),...form,level,devLevel:level,advancements:[],plannedSubclass:sub,spells:[...take(list.filter(s=>s.level===0),limits.cantrips),...prepared],spellbook:limits.book?[...new Set([...prepared,...list.filter(s=>s.level>0).map(s=>s.id)])].slice(0,limits.book):[],spellSelectionVersion:2});
}
// The copy a player starts (written-shelf.cjs start): the story with an id, active, tagged with the tale it came from.
const startCopy=(tale,id='written-check')=>({...JSON.parse(JSON.stringify(tale.story)),id,status:'active',libraryId:uuid.test(String(tale.id))?tale.id:'00000000-0000-4000-8000-000000000000',artId:'journey-'+(uuid.test(String(tale.id))?tale.id:'00000000-0000-4000-8000-000000000000'),written:{slug:/^[a-z0-9-]{3,28}$/.test(String(tale.slug))?tale.slug:'unnamed',edition:Number.isInteger(tale.edition)&&tale.edition>=1&&tale.edition<=999?tale.edition:1,length:['short','medium','long'].includes(tale.length)?tale.length:'short'}});

// ---------- The check ----------
function checkTale(file,options={}){
 const report={file:path.resolve(file),slug:null,ok:false,errors:[],warnings:[],todo:[],libraries:{},checks:{}};
 const fail=(n,where,message)=>report.errors.push({check:n,where,message});
 const warn=(n,where,message)=>report.warnings.push({check:n,where,message});
 const todo=(n,message)=>report.todo.push({check:n,message});
 const finish=()=>{for(const [n,name] of Object.entries(checkNames)){const e=report.errors.filter(x=>x.check===Number(n)).length,w=report.warnings.filter(x=>x.check===Number(n)).length,t=report.todo.some(x=>x.check===Number(n));report.checks[n]={name,status:e?'fail':t&&[5,8,9].includes(Number(n))?'todo':'pass',errors:e,warnings:w};}if(report.checks[9]&&report.checks[5]?.status!=='pass')report.checks[9].status=report.checks[5].status==='fail'?'todo':report.checks[5].status;report.ok=!report.errors.length;return report;};
 let tale;
 try{tale=readJson(file);}catch(e){fail(1,'file','cannot be read as JSON: '+e.message);return finish();}
 if(!plain(tale)){fail(1,'file','must be a JSON object');return finish();}
 report.slug=typeof tale.slug==='string'?tale.slug:null;
 const r=rules(),story=plain(tale.story)?tale.story:{},staging=plain(story.staging)?story.staging:{};
 const tier=tiers[tale.length]??tiers.short;
 const libs={people:folder(options.people,'.questbound-people'),creatures:folder(options.creatures,'.questbound-creatures'),places:folder(options.places,'.questbound-place-art'),shelf:folder(options.shelf,'.questbound-written')};
 for(const [k,f] of Object.entries(libs))report.libraries[k]=f.dir;

 // ===== 1. Shape and limits =====
 {
  for(const k of Object.keys(tale))if(!fileKeys.includes(k))fail(1,k,'unknown key at the top of the file');
  if(tale.format!==1)fail(1,'format','must be 1');
  if(!uuid.test(String(tale.id)))fail(1,'id','must be a fixed lower-case UUID (8-4-4-4-12 hex digits), the same for every edition');
  if(typeof tale.slug!=='string'||!/^[a-z0-9-]{3,28}$/.test(tale.slug))fail(1,'slug','must be 3 to 28 lower-case letters, digits or hyphens');
  else if(path.basename(file)!==tale.slug+'.json'){const onShelf=path.basename(path.dirname(path.resolve(file)))==='.questbound-written'||(!!libs.shelf.dir&&path.resolve(path.dirname(file))===path.resolve(libs.shelf.dir));(onShelf?fail:warn)(1,'slug','the file is named '+path.basename(file)+': on the shelf it must be '+tale.slug+'.json');}
  if(!Number.isInteger(tale.edition)||tale.edition<1||tale.edition>999)fail(1,'edition','must be a whole number from 1 (raise it for each revision)');
  if(!Number.isInteger(tale.order)||tale.order<0||tale.order>9999)fail(1,'order','must be a whole number from 0 to 9999 (the shelf\'s order)');
  if(typeof tale.listed!=='boolean')fail(1,'listed','must be true or false');
  if(typeof tale.addedAt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(tale.addedAt)||Number.isNaN(Date.parse(tale.addedAt+'T00:00:00Z')))fail(1,'addedAt','must be a date written YYYY-MM-DD');
  if(!tiers[tale.length])fail(1,'length','must be short, medium or long');
  else{const [lo,hi]=tier.minutes,m=tale.minutes;
   if(!Array.isArray(m)||m.length!==2||!m.every(Number.isInteger)||m[0]>=m[1])fail(1,'minutes','must be [low, high] in minutes, low below high');
   else if(m.some(x=>x%tier.minuteStep))fail(1,'minutes','must be multiples of '+tier.minuteStep+' for a '+tale.length+' tale');
   else if(m[0]<lo||m[1]>hi)fail(1,'minutes','a '+tale.length+' tale lasts '+lo+' to '+hi+' minutes');}
  if(!['gentle','steady','hard'].includes(tale.difficulty))fail(1,'difficulty','must be gentle, steady or hard');
  if(!['any','together'].includes(tale.party))fail(1,'party','must be any (solo or up to four heroes) or together (best with 2 to 4)');
  const lv=tale.levels;
  if(!Array.isArray(lv)||lv.length!==2||!lv.every(x=>Number.isInteger(x)&&x>=1&&x<=20)||lv[0]>lv[1])fail(1,'levels','must be [lowest, highest] hero levels, 1 to 20');
  if(tale.firstTale!==undefined&&typeof tale.firstTale!=='boolean')fail(1,'firstTale','must be true or false (or left out)');
  if(tale.firstTale===true&&(tale.length!=='short'||tale.difficulty!=='gentle'))fail(1,'firstTale','the Start here tale is a gentle short tale');
  if(tale.notes!==undefined&&(!Array.isArray(tale.notes)||tale.notes.length>3||!tale.notes.every(n=>typeof n==='string'&&/^[a-z][a-z -]{0,19}$/.test(n))))fail(1,'notes','must be up to 3 lower-case words or short phrases (at most 20 characters each)');
  const sh=tale.shape,slug=v=>typeof v==='string'&&/^[a-z][a-z0-9-]{1,31}$/.test(v);
  if(!plain(sh)||!slug(sh.engine)||!slug(sh.twist)||!Array.isArray(sh.endings)||sh.endings.length<1||sh.endings.length>4||!sh.endings.every(slug)||Object.keys(sh).some(k=>!['engine','twist','endings'].includes(k)))fail(1,'shape','must be {"engine": slug, "twist": slug, "endings": [1 to 4 slugs]} (lower-case words joined by hyphens)');
  const p=tale.pitch;
  if(!plain(p))fail(1,'pitch','must be {"hook", "blurb", "mood", "special"}');
  else{for(const k of Object.keys(p))if(!['hook','blurb','mood','special'].includes(k))fail(1,'pitch.'+k,'unknown key');
   for(const [k,max] of [['hook',140],['blurb',300],['mood',40],['special',160]])if(!isText(p[k],1,max))fail(1,'pitch.'+k,'must be text of 1 to '+max+' characters'+(typeof p[k]==='string'?' ('+p[k].length+')':''));}
  if(!plain(tale.story))fail(1,'story','must be an object');
  for(const k of Object.keys(story)){if(Object.hasOwn(setByGame,k))fail(1,'story.'+k,'must not be written: '+setByGame[k]);else if(!storyKeys.includes(k))fail(1,'story.'+k,'unknown key');}
  for(const k of storyKeys)if(story[k]===undefined&&!storyOptional.has(k))fail(1,'story.'+k,'is missing');
  const field=(v,min,max,where)=>{if(!isText(v,min,max))fail(1,where,'must be text of '+min+' to '+max+' characters'+(typeof v==='string'?' ('+v.length+')':''));};
  field(story.title,1,100,'story.title');field(story.premise,1,800,'story.premise');field(story.opening,1,450,'story.opening');field(story.objective,1,400,'story.objective');field(story.resolution,1,600,'story.resolution');field(story.secret,1,600,'story.secret');
  field(story.foe,1,80,'story.foe');field(story.foeSpecies,1,80,'story.foeSpecies');field(story.foeAppearance,10,600,'story.foeAppearance');field(story.foeVoice,1,300,'story.foeVoice');field(story.region,1,60,'story.region');
  if(!['Slashing','Piercing','Bludgeoning','Cold','Fire','Poison','Necrotic'].includes(story.foeDamageType))fail(1,'story.foeDamageType','must be Slashing, Piercing, Bludgeoning, Cold, Fire, Poison or Necrotic');
  if(!r.terrains.includes(story.terrain))fail(1,'story.terrain','must be one of '+r.terrains.join(', '));
  if(story.hoard===undefined||!r.validHoard(story.hoard))fail(1,'story.hoard','must be {"item": a magic item id from the catalogue (WRITTEN-TALES.md), "name": up to 60, "note": up to 160}');
  {const l=story.layout,leg=(x,from)=>plain(x)&&compass.includes(x.bearing)&&typeof x.miles==='number'&&x.miles>=0.1&&x.miles<=8&&Object.keys(x).every(k=>['bearing','miles',...(from?['from']:[])].includes(k))&&(!from||x.from===undefined||['inn','bridge'].includes(x.from));
   if(!plain(l)||!leg(l.bridge,false)||!leg(l.tower,true)||Object.keys(l).some(k=>!['bridge','tower'].includes(k)))fail(1,'story.layout','must be {"bridge": {"bearing", "miles"}, "tower": {"bearing", "miles", "from": "inn" or "bridge"}}, miles 0.1 to 8');}
  const kinds=r.placeKinds.filter(k=>k!=='lair');
  for(const id of ['inn','bridge','tower']){const loc=story.locations?.[id],w='story.locations.'+id;
   if(!plain(loc)){fail(1,w,'is missing');continue;}
   for(const k of Object.keys(loc))if(!['name','description','kind'].includes(k))fail(1,w+'.'+k,'unknown key');
   field(loc.name,2,80,w+'.name');field(loc.description,10,500,w+'.description');if(!r.placeKinds.includes(loc.kind))fail(1,w+'.kind','must be one of '+r.placeKinds.join(', '));}
  if(plain(story.locations))for(const k of Object.keys(story.locations))if(!['inn','bridge','tower'].includes(k))fail(1,'story.locations.'+k,'unknown key: the three places are inn, bridge and tower');
  if(!Array.isArray(story.landmarks)||story.landmarks.length>r.maxLandmarks)fail(1,'story.landmarks','must be a list of at most '+r.maxLandmarks);
  else story.landmarks.forEach((l,i)=>{const w='story.landmarks['+i+']';if(!plain(l)){fail(1,w,'must be an object');return;}
   for(const k of Object.keys(l))if(!['name','description','kind','bearing','miles','from','danger','feature'].includes(k))fail(1,w+'.'+k,'unknown key');
   field(l.name,2,60,w+'.name');field(l.description,10,300,w+'.description');if(!kinds.includes(l.kind))fail(1,w+'.kind','must be one of '+kinds.join(', '));
   if(!compass.includes(l.bearing))fail(1,w+'.bearing','must be one of '+compass.join(', '));if(typeof l.miles!=='number'||l.miles<0.1||l.miles>12)fail(1,w+'.miles','must be 0.1 to 12');
   if(!['inn','bridge','tower'].includes(l.from))fail(1,w+'.from','must be inn, bridge or tower');if(!['safe','risky'].includes(l.danger))fail(1,w+'.danger','must be safe or risky');if(l.feature!==undefined)field(l.feature,3,200,w+'.feature');});
  if(story.lands!==undefined&&(!Array.isArray(story.lands)||story.lands.length>2))fail(1,'story.lands','must be a list of at most 2');
  else arr(story.lands).forEach((l,i)=>{const w='story.lands['+i+']';if(!plain(l)){fail(1,w,'must be an object');return;}
   for(const k of Object.keys(l))if(!['name','terrain','bearing','miles','place','rumour'].includes(k))fail(1,w+'.'+k,'unknown key');
   field(l.name,2,60,w+'.name');if(nameKey(l.name)===nameKey(story.region))fail(1,w+'.name','must differ from the tale\'s own region');if(!r.terrains.includes(l.terrain))fail(1,w+'.terrain','must be one of '+r.terrains.join(', '));
   if(!compass.includes(l.bearing))fail(1,w+'.bearing','must be one of '+compass.join(', '));if(typeof l.miles!=='number'||l.miles<15||l.miles>300)fail(1,w+'.miles','must be 15 to 300');
   if(!plain(l.place))fail(1,w+'.place','must be {"name", "description", "kind"}');else{for(const k of Object.keys(l.place))if(!['name','description','kind'].includes(k))fail(1,w+'.place.'+k,'unknown key');field(l.place.name,2,60,w+'.place.name');field(l.place.description,10,300,w+'.place.description');if(!kinds.includes(l.place.kind))fail(1,w+'.place.kind','must be one of '+kinds.join(', '));}
   if(l.rumour!==undefined)field(l.rumour,3,200,w+'.rumour');});
  if(!Array.isArray(story.chapters)||story.chapters.length<2||story.chapters.length>6)fail(1,'story.chapters','must be a list of 2 to 6');
  else story.chapters.forEach((c,i)=>{const w='story.chapters['+i+']';if(!plain(c)){fail(1,w,'must be an object');return;}for(const k of Object.keys(c))if(!['title','goal','turn'].includes(k))fail(1,w+'.'+k,'unknown key');field(c.title,1,80,w+'.title');field(c.goal,1,300,w+'.goal');field(c.turn,1,200,w+'.turn');});
  if(story.leads!==undefined&&(!Array.isArray(story.leads)||story.leads.length>4))fail(1,'story.leads','must be a list of at most 4');
  else arr(story.leads).forEach((l,i)=>{const w='story.leads['+i+']';if(!plain(l)){fail(1,w,'must be an object');return;}for(const k of Object.keys(l))if(!['title','hook'].includes(k))fail(1,w+'.'+k,'unknown key (lead ids are given by position: l1 is the first)');field(l.title,1,80,w+'.title');field(l.hook,1,300,w+'.hook');});
  const person=(n,w,resident)=>{
   if(!plain(n)){fail(1,w,'must be an object');return;}
   const known=resident?['name','species','gender','role','appearance','personality','motive','toughness','attitude','at','noticed','foe','tie','class','pool']:['name','species','gender','role','motive','appearance','personality','ties','class','pool'];
   for(const k of Object.keys(n)){if(k==='regard')fail(1,w+'.regard','must not be written: '+setByGame.regard);else if(!known.includes(k))fail(1,w+'.'+k,'unknown key');}
   field(n.name,2,60,w+'.name');field(n.species,1,resident?60:80,w+'.species');if(!r.genders.includes(n.gender))fail(1,w+'.gender','must be woman, man or other');
   field(n.role,3,resident?200:300,w+'.role');field(n.appearance,10,resident?400:600,w+'.appearance');field(n.personality,resident?1:10,resident?200:300,w+'.personality');field(n.motive,1,resident?300:400,w+'.motive');
   if(n.class!==undefined&&n.class!==null&&!r.npcClassList.includes(n.class))fail(1,w+'.class','must be null or one of '+r.npcClassList.join(', '));
   if(n.pool!==undefined&&n.pool!==null&&!/^np\d{3}$/.test(String(n.pool)))fail(1,w+'.pool','must be a people-library id such as np042, or null');
   if(resident){
    if(!['frail','common','tough'].includes(n.toughness))fail(1,w+'.toughness','must be frail, common or tough');
    if(!['unfriendly','indifferent','friendly'].includes(n.attitude))fail(1,w+'.attitude','must be unfriendly, indifferent or friendly');
    if(!isText(n.at,1,80))fail(1,w+'.at','must name where they live: a place\'s exact name');
    if(typeof n.noticed!=='boolean')fail(1,w+'.noticed','must be true or false');
    if(!r.foeTieKinds.includes(n.foe))fail(1,w+'.foe','must be one of '+r.foeTieKinds.join(', '));
    if(n.tie!==null&&(!plain(n.tie)||!isText(n.tie.to,1,60)||!r.tieKinds.includes(n.tie.kind)||Object.keys(n.tie).some(k=>!['to','kind'].includes(k))))fail(1,w+'.tie','must be null or {"to": a name, "kind": one of '+r.tieKinds.join(', ')+'}');
   }else if(n.ties===undefined||!r.validTies(n.ties))fail(1,w+'.ties','must be {"other": '+r.tieKinds.join('|')+', "foe": '+r.foeTieKinds.join('|')+', "note": up to 200}');
  };
  for(const id of ['keeper','mara'])person(story.npcs?.[id],'story.npcs.'+id,false);
  if(plain(story.npcs))for(const k of Object.keys(story.npcs))if(!['keeper','mara'].includes(k))fail(1,'story.npcs.'+k,'unknown key: the two are keeper and mara; everyone else is a resident');
  if(!Array.isArray(story.residents)||story.residents.length>r.maxResidents)fail(1,'story.residents','must be a list of at most '+r.maxResidents);
  else story.residents.forEach((n,i)=>person(n,'story.residents['+i+']',true));
  // Introduction: the five fields at half their usual limits.
  {const intro=story.introduction;
   if(!plain(intro))fail(1,'story.introduction','must be {"you", "place", "trouble", "people", "first"}');
   else{for(const k of Object.keys(intro))if(!r.introductionFields.some(([f])=>f===k))fail(1,'story.introduction.'+k,'unknown key');
    for(const [k,,max] of r.introductionFields)field(intro[k],1,Math.floor(max/2),'story.introduction.'+k);}}
  if(!Array.isArray(story.openingDialogue)||story.openingDialogue.length<1||story.openingDialogue.length>2)fail(1,'story.openingDialogue','must be 1 or 2 lines');
  else story.openingDialogue.forEach((l,i)=>{const w='story.openingDialogue['+i+']';if(!plain(l)||Object.keys(l).some(k=>!['speakerId','text'].includes(k))){fail(1,w,'must be {"speakerId", "text"}');return;}
   if(!/^(?:keeper|mara|resident(?:[1-9]|1[0-2]))$/.test(String(l.speakerId)))fail(1,w+'.speakerId','must be keeper, mara or residentN (the Nth resident, who lives at the start)');field(l.text,1,300,w+'.text');});
  if(Array.isArray(story.openingDialogue)&&new Set(story.openingDialogue.map(l=>l?.speakerId)).size!==story.openingDialogue.length)fail(1,'story.openingDialogue','two lines from one speaker: each line is someone else');
  // The staging, strictly (unknown keys reported).
  if(!plain(story.staging))fail(1,'story.staging','must be an object (WRITTEN-TALES.md, The staging)');
  else{const probe={...story,chapters:Array.isArray(story.chapters)?story.chapters:[],leads:(Array.isArray(story.leads)?story.leads:[]).map((l,i)=>({...l,id:'l'+(i+1)}))};
   for(const line of r.stagingProblems(probe,{strict:true})){const at=line.indexOf(': ');fail(1,'story.'+line.slice(0,at),line.slice(at+2));}}
  // Every text ends on a full sentence.
  const prose=[['pitch.hook',tale.pitch?.hook],['pitch.blurb',tale.pitch?.blurb],['pitch.special',tale.pitch?.special],...['premise','opening','objective','resolution','secret','foeAppearance','foeVoice'].map(k=>['story.'+k,story[k]]),['story.hoard.note',story.hoard?.note],
   ...['inn','bridge','tower'].map(id=>['story.locations.'+id+'.description',story.locations?.[id]?.description]),
   ...(Array.isArray(story.landmarks)?story.landmarks:[]).flatMap((l,i)=>[['story.landmarks['+i+'].description',l?.description],...(l?.feature!==undefined?[['story.landmarks['+i+'].feature',l.feature]]:[])]),
   ...(Array.isArray(story.lands)?story.lands:[]).flatMap((l,i)=>[['story.lands['+i+'].place.description',l?.place?.description],...(l?.rumour!==undefined?[['story.lands['+i+'].rumour',l.rumour]]:[])]),
   ...(Array.isArray(story.chapters)?story.chapters:[]).flatMap((c,i)=>[['story.chapters['+i+'].goal',c?.goal],['story.chapters['+i+'].turn',c?.turn]]),
   ...(Array.isArray(story.leads)?story.leads:[]).map((l,i)=>['story.leads['+i+'].hook',l?.hook]),
   ...['keeper','mara'].flatMap(id=>['role','motive','appearance','personality'].map(k=>['story.npcs.'+id+'.'+k,story.npcs?.[id]?.[k]]).concat([['story.npcs.'+id+'.ties.note',story.npcs?.[id]?.ties?.note]])),
   ...(Array.isArray(story.residents)?story.residents:[]).flatMap((n,i)=>['role','appearance','personality','motive'].map(k=>['story.residents['+i+'].'+k,n?.[k]])),
   ...(plain(story.introduction)?Object.entries(story.introduction).map(([k,v])=>['story.introduction.'+k,v]):[]),
   ...(Array.isArray(story.openingDialogue)?story.openingDialogue:[]).map((l,i)=>['story.openingDialogue['+i+'].text',l?.text]),
   ...stagingProse(staging,'story.staging')];
  for(const [where,v] of prose)if(typeof v==='string'&&v.trim()&&!endsOnSentence(v))fail(1,where,'must end on a full sentence (. ! or ?), never cut short');
 }

 // ===== 2. Seating =====
 const levels=Array.isArray(tale.levels)&&tale.levels.length===2&&tale.levels.every(Number.isInteger)?[...new Set([tale.levels[0],Math.round((tale.levels[0]+tale.levels[1])/2),tale.levels[1]])].filter(l=>l>=1&&l<=20):[1];
 let seated=null,parties=0,tried=0;const seatings=[];
 if(plain(tale.story)){
  const seatFailures=new Map(),noteFail=(where,message,who)=>{const k=where+'\u0001'+message;if(!seatFailures.has(k))seatFailures.set(k,[]);seatFailures.get(k).push(who);};
  for(const key of ['fighter','rogue','wizard','cleric'])for(const level of levels){
   const who='the ready-made '+key[0].toUpperCase()+key.slice(1)+' at level '+level;
   let hero;try{hero=heroAt(key,level);}catch(e){noteFail('heroes','could not make '+who+': '+e.message,who);continue;}
   if(!r.isValidCharacter(hero)){noteFail('heroes','could not make '+who,who);continue;}
   let game;try{game=r.freshStoryGame(hero,startCopy(tale),r.newAdventure(hero));}catch(e){noteFail('story',e.message+' (the tale does not seat: see check 1)',who);continue;}
   if(!r.validAdventure(r.adventureSnapshot(hero,game,null,true),hero)){noteFail('story','the seated game is not a valid adventure',who);continue;}
   seatings.push({key,level,hero,game});
   if(!seated)seated={hero,game,level};
  }
  for(const level of [...new Set([levels[0],levels[levels.length-1]])])for(const size of [2,4]){
   const keys=['fighter','rogue','wizard','cleric'].slice(0,size),who='a party of '+size+' at level '+level;tried++;
   try{
    const heroes=keys.map(k=>heroAt(k,level)),seat=i=>'seat-'+'abcd'[i].repeat(16);
    let table=r.startParty(r.adventureSnapshot(heroes[0],r.newAdventure(heroes[0]),null,true),seat(0),'Player 1');
    for(let i=1;i<size;i++){const joined=r.joinParty(table,seat(i),{character:JSON.stringify(heroes[i]),game:r.newAdventure(heroes[i]),health:null,name:'Player '+(i+1)});if(joined.error)throw Error(joined.error);table=joined.snapshot;}
    const begun=r.partyInTale(table,seat(0),startCopy(tale,'written-party-check'),'written');
    if(begun.error)noteFail('party',begun.error,who);
    else{
     let ok=JSON.stringify(begun.snapshot.game.story?.staging)===JSON.stringify(story.staging);if(!ok)noteFail('party','the table\'s copy lost or changed the staging',who);
     for(let i=0;i<size;i++)if(!r.validAdventure(r.partyView(begun.snapshot,seat(i)),heroes[i])){ok=false;noteFail('party','the table seen by player '+(i+1)+' is not a valid adventure',who);}
     if(ok)parties++;
    }
   }catch(e){noteFail('party',e.message,who);}
  }
  report.seated={heroes:seatings.length,parties,tried};
  for(const [k,whoList] of seatFailures){const [where,message]=k.split('\u0001');fail(2,where,message+' ('+(whoList.length>3?whoList.slice(0,3).join('; ')+' and '+(whoList.length-3)+' more':whoList.join('; '))+')');}
  if(seated){
   const g=seated.game,s=g.story;
   // Seated as written: residents where `at` says, the opening's lines, landmarks, lands; nothing trimmed.
   const homeOf=at=>{const k=nameKey(at);for(const id of ['inn','bridge','tower'])if(k===id||k===nameKey(story.locations?.[id]?.name))return id;return arr(g.world?.places).find(p=>nameKey(p.name)===k)?.id??null;};
   (Array.isArray(story.residents)?story.residents:[]).forEach((n,i)=>{
    const w='story.residents['+i+']',id=Object.keys(g.people??{}).find(pid=>g.people[pid].name===String(n?.name??'').replace(/\s+/g,' ').trim()),want=homeOf(n?.at);
    if(!want)fail(2,w+'.at','"'+n?.at+'" is no place of this tale: the game would seat them at the start, or leave them out when the start is full');
    if(!id){if(want)fail(2,w,'"'+n?.name+'" was not seated: '+(want==='inn'?'the start holds 2 residents':'a place holds 3 residents')+', and a name may be used once');return;}
    const p=g.people[id];
    if(want&&p.home!==want)fail(2,w+'.at','lives at '+p.home+', not '+want+' as written (a place holds 3 residents, the start 2)');
    if(n.noticed===false&&want==='inn')fail(2,w+'.noticed','nobody at the start is unnoticed');
    for(const [k,max] of [['role',200],['appearance',400],['personality',200],['motive',300]])if(typeof n[k]==='string'&&(p[k]??'')!==n[k].replace(/\s+/g,' ').trim().slice(0,max))fail(2,w+'.'+k,'was changed when seated (spacing or length)');
    if(n.pool&&p.pool!==n.pool)fail(2,w+'.pool','was not kept (used twice?)');
   });
   const lines=Array.isArray(story.openingDialogue)?story.openingDialogue:[];
   if((s.openingDialogue??[]).length!==lines.length)fail(2,'story.openingDialogue','only '+(s.openingDialogue??[]).length+' of '+lines.length+' lines were kept: a residentN speaker must be the Nth resident and live at the start');
   (Array.isArray(story.landmarks)?story.landmarks:[]).forEach((l,i)=>{const p=arr(g.world?.places).find(x=>!x.region&&x.name===l?.name?.trim());if(!p)fail(2,'story.landmarks['+i+']','"'+l?.name+'" was not put on the map (a name used twice, or a field out of its limits)');else if(p.description!==l.description?.trim()||(l.feature!==undefined&&p.feature!==l.feature.trim()))fail(2,'story.landmarks['+i+']','was changed when put on the map');});
   (Array.isArray(story.lands)?story.lands:[]).forEach((l,i)=>{const p=arr(g.world?.places).find(x=>x.region&&x.name===l?.place?.name?.trim());if(!p)fail(2,'story.lands['+i+']','"'+l?.name+'" was not put on the map');});
   // Tidying cut nothing the author wrote.
   const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
   if(Array.isArray(story.chapters)&&!same(s.chapters,story.chapters.map(c=>({title:c.title,goal:c.goal,turn:c.turn}))))fail(2,'story.chapters','were changed when tidied (spacing or length)');
   if(Array.isArray(story.leads)&&story.leads.length&&!same(s.leads,story.leads.map((l,i)=>({id:'l'+(i+1),title:l.title,hook:l.hook}))))fail(2,'story.leads','were changed when tidied');
   if(plain(story.introduction)&&!same(s.introduction,story.introduction))fail(2,'story.introduction','was replaced when seated: every field must be within its limit');
   if(story.hoard&&!same(s.hoard,story.hoard))fail(2,'story.hoard','was changed when tidied');
   if(!same(s.staging,story.staging))fail(2,'story.staging','was changed when seated');
   if(s.foeVoice!==story.foeVoice)fail(2,'story.foeVoice','was changed when seated');
   for(const k of ['region','terrain','title','premise','opening','objective','resolution','secret'])if(story[k]!==undefined&&s[k]!==story[k])fail(2,'story.'+k,'was changed when tidied');
   for(const id of ['inn','bridge','tower'])if(story.locations?.[id]&&!same(s.locations[id],story.locations[id]))fail(2,'story.locations.'+id,'was changed when tidied');
   // Every name the staging uses resolves, in every seating.
   const unresolved=new Map();
   for(const {game} of seatings){const ids=r.stagingIds(game);for(const u of r.stagingNamesUsed(game.story.staging)){if(u.kind==='item')continue;if(!(u.kind==='place'?ids.place(u.name):ids.person(u.name)))unresolved.set(u.path,u);}}
   for(const u of unresolved.values())fail(3,'story.'+u.path,'"'+u.name+'" is no '+(u.kind==='place'?'place':'person')+' of this tale (write the exact name; case and a leading "The" do not matter)');
   const ids=r.stagingIds(g);
   // Set pieces and armed places are world places (landmarks or far places), never the three starting places; the
   // effects that move people move residents (keeper and mara stay at the start unless they follow the hero), and a
   // place that changes is a world place (the three starting places have no danger to change).
   const armings=[];
   arr(staging.chapters).forEach((c,i)=>{if(plain(c?.fight)&&typeof c.fight.at==='string')armings.push({key:nameKey(c.fight.at),where:'story.staging.chapters['+i+'].fight.at'});});
   for(const [where,v] of stagingEffects(staging,'story.staging')){
    const at=typeof v.value?.at==='string'?ids.place(v.value.at):null,who=typeof v.value==='string'?v.value:v.value?.who,person=typeof who==='string'?ids.person(who):null;
    if(v.kind==='arm'&&typeof v.value?.at==='string')armings.push({key:nameKey(v.value.at),where:where+'.at'});
    if(v.kind==='place'&&['inn','bridge','tower'].includes(at))fail(4,where+'.at','the three starting places do not change: "place" changes a landmark or a far place');
    if((v.kind==='bring'||v.kind==='send')&&['keeper','mara'].includes(person))fail(4,where,'"'+who+'" is the tale\'s '+person+', who stays at the start unless they follow the hero: "'+v.kind+'" moves residents only (make the person who comes or goes a resident)');
   }
   for(const x of armings){const id=ids.place(x.key);if(id&&['inn','bridge','tower'].includes(id))fail(4,x.where,'a fight is set at a landmark or a far place, never at one of the three starting places (the foe waits at the stronghold)');}
   seated.armings=armings;
  }
 }

 // ===== 3. Names =====
 const people=[...['keeper','mara'].map(id=>({name:story.npcs?.[id]?.name,where:'story.npcs.'+id,pool:story.npcs?.[id]?.pool,entry:story.npcs?.[id]})),...(Array.isArray(story.residents)?story.residents:[]).map((n,i)=>({name:n?.name,where:'story.residents['+i+']',pool:n?.pool,entry:n}))].filter(p=>typeof p.name==='string');
 const places=[...['inn','bridge','tower'].map(id=>({name:story.locations?.[id]?.name,where:'story.locations.'+id})),...(Array.isArray(story.landmarks)?story.landmarks:[]).map((l,i)=>({name:l?.name,where:'story.landmarks['+i+']'})),...(Array.isArray(story.lands)?story.lands:[]).map((l,i)=>({name:l?.place?.name,where:'story.lands['+i+'].place'}))].filter(p=>typeof p.name==='string');
 const lands=[{name:story.region,where:'story.region'},...(Array.isArray(story.lands)?story.lands:[]).map((l,i)=>({name:l?.name,where:'story.lands['+i+']'}))].filter(p=>typeof p.name==='string');
 const creatures=talesCreatures(story).filter(c=>typeof c.name==='string');
 const items=[...(story.hoard?.name?[{name:story.hoard.name,where:'story.hoard.name'}]:[]),...stagingEffects(staging,'story.staging').filter(([,v])=>v.kind==='give').map(([where,v])=>({name:v.value?.name,where:where+'.name'})),...arr(staging.chapters).map((c,i)=>({name:c?.found?.item?.name,where:'story.staging.chapters['+i+'].found.item'}))].filter(p=>typeof p.name==='string');
 const foe=typeof story.foe==='string'?[{name:story.foe,where:'story.foe'}]:[],title=typeof story.title==='string'?[{name:story.title,where:'story.title'}]:[];
 {
  const unique=(list,what)=>{const seen=new Map();for(const x of list){const k=nameKey(x.name);if(seen.has(k))fail(3,x.where,'"'+x.name+'" is used twice ('+seen.get(k)+'): every '+what+' name in a tale is different');else seen.set(k,x.where);}};
  unique(places,'place');unique(people,'person\'s');unique([...lands],'land');unique(creatures,'creature');
  const all=[...places.map(x=>({...x,what:'a place'})),...people.map(x=>({...x,what:'a person'})),...lands.map(x=>({...x,what:'a land'})),...foe.map(x=>({...x,what:'the foe'}))],byKey=new Map();
  for(const x of all){const k=nameKey(x.name),o=byKey.get(k);if(o&&o.what!==x.what)fail(3,x.where,'"'+x.name+'" is also '+o.what+' ('+o.where+')');else if(!o)byKey.set(k,x);}
  if(foe.length&&people.some(p=>nameKey(p.name)===nameKey(story.foe)))fail(3,'story.foe','the main foe is never also keeper, mara or a resident');
  const proper=[...places,...people,...lands,...foe,...creatures,...items,...title];
  for(const x of proper){
   for(const a of avoidNames)if(new RegExp('\\b'+a+'\\b','i').test(x.name))fail(3,x.where,'"'+x.name+'" uses "'+a+'", which is on the avoid list (overused or clashing)');
   for(const d of subclassPatterns)if(d.re.test(x.name))fail(3,x.where,'"'+x.name+'" uses "'+d.name+'", a name from another publisher\'s book (the deny list)');
  }
  for(const x of [...places,...lands])if(/glass/i.test(x.name))fail(3,x.where,'"'+x.name+'": no place or land name with "glass" in it (the avoid list)');
  const ready=new Set(r.readyHeroes.flatMap(h=>nameParts(h.form.name)));
  for(const x of [...people,...foe])for(const part of nameParts(x.name))if(ready.has(part))fail(3,x.where,'"'+x.name+'" shares "'+part+'" with a ready-made hero\'s name');
  // Pools: the library's own people keep their name, species and gender (their portraits are already painted).
  if(!libs.people.found)fail(3,'--people','the people library was not found ('+(libs.people.given?libs.people.dir:'looked in '+(libs.people.looked??[]).join(', '))+'): pass --people <folder>');
  else{
   let library=[];try{library=loadPeople(libs.people.dir);}catch(e){fail(3,'--people','cannot read '+path.join(libs.people.dir,'library.json')+': '+e.message);}
   const byId=new Map(library.map(e=>[e.id,e])),byName=new Map(library.map(e=>[nameKey(e.name),e])),parts=new Map();
   for(const e of library)for(const part of nameParts(e.name))parts.set(part,e);
   const pools=new Map();
   for(const p of people){
    if(p.pool){const e=byId.get(p.pool);
     if(pools.has(p.pool))fail(3,p.where+'.pool',p.pool+' is cast twice in this tale');pools.set(p.pool,p.where);
     if(!e){fail(3,p.where+'.pool',p.pool+' is not in the people library');continue;}
     if(p.name!==e.name)fail(3,p.where+'.name','must be the library\'s name for '+p.pool+': "'+e.name+'"');
     if(p.entry.species!==e.species)fail(3,p.where+'.species','must be the library\'s species for '+p.pool+': '+e.species);
     if(p.entry.gender!==e.gender)fail(3,p.where+'.gender','must be the library\'s gender for '+p.pool+': '+e.gender);
     if((p.entry.class??null)!==(e.class??null))warn(3,p.where+'.class','the library has '+p.pool+' as '+(e.class??'untrained')+': their portrait shows that');
     if(typeof e.appearance==='string'&&p.entry.appearance!==e.appearance.slice(0,p.where.includes('residents')?400:600))warn(3,p.where+'.appearance','is not the library\'s look for '+p.pool+', which their portrait shows: copy it word for word');
    }else{
     const same=byName.get(nameKey(p.name));if(same)fail(3,p.where+'.name','"'+p.name+'" is the name of '+same.id+' in the people library: cast them (pool) or choose another name');
     for(const part of nameParts(p.name)){const o=parts.get(part);if(o&&!same)warn(3,p.where+'.name','"'+p.name+'" shares "'+part+'" with '+o.id+' ('+o.name+') in the people library, whom the Dungeon Master may bring into play');}
    }
   }
   report.pools=[...pools.keys()];
  }
 }

 // ===== 4. Structure =====
 const shelf=libs.shelf.found?loadShelf(libs.shelf.dir,file):{tales:[],skipped:[]};
 {
  const chapters=Array.isArray(staging.chapters)?staging.chapters:[],n=Array.isArray(story.chapters)?story.chapters.length:0,last=n-1;
  const kindOf=c=>plain(c)?Object.keys(c)[0]:null,valueOf=c=>plain(c)?Object.values(c)[0]:undefined;
  const mechanical=c=>{const k=kindOf(c);if(!k)return false;const v=c[k];if(k==='foe')return ['slain','subdued','beaten'].includes(v);if(r.stagingMechanical.includes(k))return true;if(k==='all')return Array.isArray(v)&&v.length>0&&v.every(mechanical);if(k==='any')return Array.isArray(v)&&v.some(mechanical);return false;};
  const confrontFrom=Number.isInteger(staging.confrontFrom)?staging.confrontFrom:n,bossFrom=confrontFrom-1;// the first chapter (0-based) in which the foe can be fought
  const lowest=levels[0],highest=levels[levels.length-1];
  const chapterPath=(i,rest)=>'story.staging.chapters['+i+']'+rest;
  const pressureCount=i=>Array.isArray(chapters[i]?.pressure)?chapters[i].pressure.length:0;
  // A condition written the same way twice is the same condition (names compared as the game compares them).
  const canon=c=>Array.isArray(c)?'['+c.map(canon).join(',')+']':plain(c)?'{'+Object.keys(c).sort().map(k=>JSON.stringify(k)+':'+canon(c[k])).join(',')+'}':typeof c==='string'?JSON.stringify(nameKey(c)):JSON.stringify(c);
  // When things first become possible, by chapter (0-based). An effect in a chapter's own `then` applies as it closes,
  // so it counts from the next chapter's opening; one in an `opening` from that chapter's opening; anything else from
  // its own chapter (and, once it has happened, from the next chapter's opening). A choice is made in its chapter (or
  // its `late` option as the chapter closes); the hoard comes with the foe beaten.
  const during=new Map(),atOpening=new Map(),first=(map,key,i)=>{if(key!==undefined&&key!==null&&(!map.has(key)||map.get(key)>i))map.set(key,i);};
  const can=(key,duringAt,openingAt)=>{first(during,key,duringAt);first(atOpening,key,openingAt);};
  const toldAt=new Map(),armedOpening=new Map();
  chapters.forEach((c,i)=>{if(!plain(c))return;
   for(const kind of ['beats','complications','pressure'])arr(c[kind]).forEach(b=>{if(typeof b?.id==='string')toldAt.set(b.id,i);});
   if(plain(c.choice))for(const o of arr(c.choice.options))if(typeof o?.id==='string')can('mark:'+c.choice.id+':'+o.id,i,i+1);
   if(plain(c.fight)&&typeof c.fight.at==='string'){can('armed:'+nameKey(c.fight.at),i,i);if(!armedOpening.has(i))armedOpening.set(i,new Set());armedOpening.get(i).add(nameKey(c.fight.at));}
   if(plain(c.found?.item)&&typeof c.found.item.name==='string')can('item:'+nameKey(c.found.item.name),i+1,i+1);
  });
  for(const [w,v] of stagingEffects(staging,'story.staging')){
   const m=w.match(/^story\.staging\.chapters\[(\d+)\]\.(then|opening\.then)?/),i=m?Number(m[1]):bossFrom,closing=m?.[2]==='then',opening=m?.[2]==='opening.then';
   const [d,o]=closing?[i+1,i+1]:opening?[i,i]:[i,i+1];
   if(v.kind==='flag')can('flag:'+v.value,d,o);
   else if(v.kind==='give'&&typeof v.value?.name==='string')can('item:'+nameKey(v.value.name),d,o);
   else if(v.kind==='decide'&&plain(v.value)){const [ch,op]=Object.entries(v.value)[0]??[];can('mark:'+ch+':'+op,d,o);}
   else if(v.kind==='arm'&&typeof v.value?.at==='string'){const k=nameKey(v.value.at);can('armed:'+k,d,o);if(closing||opening){if(!armedOpening.has(o))armedOpening.set(o,new Set());armedOpening.get(o).add(k);}}
  }
  if(typeof story.hoard?.name==='string')can('item:'+nameKey(story.hoard.name),bossFrom,bossFrom+1);
  const metAtStart=new Set(seated?[story.npcs?.keeper?.name,story.npcs?.mara?.name,...arr(story.residents).map(x=>x?.name)].filter(x=>typeof x==='string').filter(x=>{const id=r.stagingIds(seated.game).person(x);return id&&r.metPerson(seated.game,id);}).map(nameKey):[]);
  // A condition that can never hold during chapter i (an ending's is read at the tale's end, with `ending`).
  // Parts of an "all" that cannot hold together: two options of one choice, slain and subdued, dead and anything else
  // of one person, a condition and its "not".
  const contradictory=parts=>{const marks=new Map(),foe=new Set(),fates=new Map(),keys=new Set(parts.map(canon));
   for(const x of parts){const k=kindOf(x),v=valueOf(x);
    if(k==='mark'){const [ch,op]=Object.entries(plain(v)?v:{})[0]??[];if(marks.has(ch)&&marks.get(ch)!==op)return true;marks.set(ch,op);}
    else if(k==='foe')foe.add(v);
    else if(k==='fate'){const who=nameKey(v?.who);if(!fates.has(who))fates.set(who,new Set());fates.get(who).add(v?.is);}
    else if(k==='not'&&keys.has(canon(v)))return true;}
   return (foe.has('slain')&&foe.has('subdued'))||[...fates.values()].some(f=>f.has('dead')&&f.size>1);};
  // A condition that surely holds whenever it is read (someone met at the start, a level every hero has).
  const always=c=>{const k=kindOf(c),v=valueOf(c);if(k==='met')return metAtStart.has(nameKey(v));if(k==='level')return Number.isInteger(v)&&v<=lowest;if(k==='any')return arr(v).some(always);if(k==='all')return arr(v).length>0&&arr(v).every(always);return false;};
  // The beats of a chapter a condition waits for in every way it can hold.
  const needsTold=c=>{const k=kindOf(c),v=valueOf(c);if(k==='told')return new Set([v]);if(k==='all'){const out=new Set();for(const x of arr(v))for(const y of needsTold(x))out.add(y);return out;}if(k==='any'){const sets=arr(v).map(needsTold);return sets.length?new Set([...sets[0]].filter(x=>sets.every(y=>y.has(x)))):new Set();}return new Set();};
  const never=(c,i,ending=false)=>{const k=kindOf(c),v=valueOf(c),later=key=>during.has(key)&&during.get(key)>i;
   if(k==='any')return arr(v).length>0&&arr(v).every(x=>never(x,i,ending));
   if(k==='all')return arr(v).some(x=>never(x,i,ending))||contradictory(arr(v));
   if(k==='told')return toldAt.has(v)&&toldAt.get(v)>i;
   if(k==='mark'){const [ch,op]=Object.entries(plain(v)?v:{})[0]??[];return later('mark:'+ch+':'+op);}
   if(k==='flag')return v==='late'?!ending:later('flag:'+v);
   if(k==='carry')return later('item:'+nameKey(v));
   if(k==='clear'||k==='won'||k==='searched')return later('armed:'+nameKey(v));
   if(k==='step')return Number.isInteger(v)&&v>(ending?pressureCount(i):pressureCount(i)-1);
   if(k==='level')return Number.isInteger(v)&&v>highest;
   if(k==='foe')return i<bossFrom;
   return false;};
  // Whether a condition surely holds (true), surely not (false) or may hold (null) as chapter i opens (i from 1).
  const atOpen=(c,i)=>{const k=kindOf(c),v=valueOf(c),opened=key=>atOpening.has(key)&&atOpening.get(key)<=i;
   switch(k){
    case 'any':{const x=arr(v).map(y=>atOpen(y,i));return x.includes(true)?true:x.length&&x.every(y=>y===false)?false:null;}
    case 'all':{const x=arr(v).map(y=>atOpen(y,i));return x.length&&x.every(y=>y===true)?true:x.includes(false)?false:null;}
    case 'not':{const x=atOpen(v,i);return x===null?null:!x;}
    case 'met':return metAtStart.has(nameKey(v))?true:null;
    case 'level':return !Number.isInteger(v)?null:v<=lowest?true:v>highest?false:null;
    case 'step':case 'days':return Number.isInteger(v)&&v>=1?false:null;
    case 'rest':case 'won':case 'searched':case 'checked':case 'spoke':return false;
    case 'told':return toldAt.has(v)&&toldAt.get(v)>=i?false:null;
    case 'mark':{const [ch,op]=Object.entries(plain(v)?v:{})[0]??[];return opened('mark:'+ch+':'+op)?null:false;}
    case 'flag':return v==='late'?false:opened('flag:'+v)?null:false;
    case 'carry':return atOpening.has('item:'+nameKey(v))&&!opened('item:'+nameKey(v))?false:null;
    case 'clear':return armedOpening.get(i)?.has(nameKey(v))||!opened('armed:'+nameKey(v))?false:null;
    case 'foe':return i<=bossFrom?false:null;
    default:return null;
   }};
  // Exactly, as the tale begins: chapter 1's conditions against every seated game and its opening pace.
  const atStart=c=>seatings.some(({game})=>r.beatHolds(game,c,r.openingPace(game)));
  // Talk never closes a chapter cheaply: a talk route standing alone needs two or more exchanges, and in an `all` talk
  // stands only beside something done.
  const startPeople=new Set([story.npcs?.keeper?.name,story.npcs?.mara?.name,...arr(story.residents).filter(x=>seated&&r.stagingIds(seated.game).person(x?.name)&&seated.game.people?.[r.stagingIds(seated.game).person(x?.name)]?.home==='inn').map(x=>x?.name)].filter(x=>typeof x==='string').map(nameKey));
  const talk=(c,path,alone)=>{const k=kindOf(c),v=valueOf(c);
   if(k==='spoke'){if(alone){const times=Number.isInteger(v?.times)?v.times:2;if(times<2)fail(4,path+'.spoke.times','talk standing alone closes nothing in one exchange: "times" is 2 or more');else if(startPeople.has(nameKey(v?.who)))warn(4,path+'.spoke','"'+v?.who+'" is with the hero from the start: two exchanges with them close this chapter before its set piece or its places are reached');}return;}
   if(k==='any'){arr(v).forEach((x,j)=>talk(x,path+'.any['+j+']',alone));return;}
   if(k==='all'){const parts=arr(v);if(parts.some(x=>kindOf(x)==='spoke'))parts.forEach((x,j)=>{if(kindOf(x)!=='spoke'&&!mechanical(x))fail(4,path+'.all['+j+']','talk stands beside something done: every other part of an "all" with "spoke" is mechanical ('+r.stagingMechanical.join(', ')+', foe beaten)');});parts.forEach((x,j)=>talk(x,path+'.all['+j+']',false));return;}
   if(k==='not')talk(v,path+'.not',false);};
  chapters.forEach((c,i)=>{
   const w=chapterPath(i,''),routes=Array.isArray(c?.found?.any)?c.found.any:[];
   if(routes.length<2)fail(4,w+'.found','needs at least two routes to the chapter\'s truth');
   if(!routes.some(mechanical))fail(4,w+'.found','needs at least one route the game settles from what happened: '+r.stagingMechanical.join(', ')+' (foe slain, subdued or beaten)');
   const seen=new Map();
   routes.forEach((x,j)=>{const p=w+'.found.any['+j+']',key=canon(x);
    talk(x,p,true);
    if(seen.has(key))fail(4,p,'is the same route as found.any['+seen.get(key)+']: two routes are two different ways in');else seen.set(key,j);
    if(never(x,i))fail(4,p,'can never hold in this chapter (something it needs comes in a later chapter, is given as the chapter closes, is never armed by then, or is a step the clock never reaches)');
    else if(i===0?atStart(x):atOpen(x,i)===true)fail(4,p,i===0?'holds already as the tale begins, so chapter 1 would close on the first move':'holds already as chapter '+(i+1)+' opens, so it would close at once');
    else if(i>0&&kindOf(x)==='fate'&&x.fate?.is==='alive')warn(4,p,'holds for as long as they live, so the chapter may close as it opens');
    if(kindOf(x)==='clear'&&i>0){const k=nameKey(x.clear);if(!armedOpening.get(i)?.has(k)&&during.has('armed:'+k)&&during.get('armed:'+k)<i)fail(4,p+'.clear','"'+x.clear+'" was armed in an earlier chapter and may be cleared already as chapter '+(i+1)+' opens: arm it again as this chapter opens (its fight, or an arm in its opening or the last chapter\'s then), or use "won"');}
    if(usesFoe(x)&&i>=confrontFrom&&!staging.boss?.if)warn(4,p,'the foe can be confronted from chapter '+confrontFrom+', so it may be beaten before chapter '+(i+1)+' opens and this route would then hold at once');
   });
   // Beats that wait for each other's telling: none of them ever fires.
   {const items=['beats','complications','pressure'].flatMap(kind=>arr(c?.[kind]).map((b,j)=>({b,where:w+'.'+kind+'['+j+']'}))),wants=new Map(items.filter(x=>typeof x.b?.id==='string').map(x=>[x.b.id,new Set([...needsTold(x.b.when),...needsTold(x.b.if)])]));
    const reaches=(from,to,seen=new Set())=>{for(const n of wants.get(from)??[]){if(n===to)return true;if(!seen.has(n)&&wants.has(n)){seen.add(n);if(reaches(n,to,seen))return true;}}return false;};
    for(const x of items)if(typeof x.b?.id==='string'&&!wants.get(x.b.id).has(x.b.id)&&reaches(x.b.id,x.b.id))fail(4,x.where+(plain(x.b.when)?'.when':'.if'),'waits for a telling that waits for this one ('+[...wants.get(x.b.id)].join(', ')+'): none of them ever fires');}
   // Beats and choices that never get their turn: a find closes the chapter before anything else is due.
   for(const [kind,list] of [['beats',arr(c?.beats)],['complications',arr(c?.complications)],['pressure',arr(c?.pressure)]])list.forEach((b,j)=>{const p=w+'.'+kind+'['+j+']';
    for(const k of ['when','if']){if(!plain(b?.[k]))continue;
     if(never(b[k],i))fail(4,p+'.'+k,'can never hold in this chapter');
     if(JSON.stringify(b[k]).includes('"told":"'+b.id+'"'))fail(4,p+'.'+k,'waits for its own telling: it can never fire');
     if(k==='when'&&routes.some(x=>implies(b[k],x,canon)))fail(4,p+'.when','is one of the chapter\'s routes (or needs one): the find closes the chapter first, so this beat never fires. Give it to the next chapter (where the hero stands counts as reached as it opens) or put its effects in the chapter\'s "then"');}});
   if(plain(c?.choice)){const ch=c.choice,p=w+'.choice';
    if(plain(ch.opens)){if(never(ch.opens,i))fail(4,p+'.opens','can never hold in this chapter');if(routes.some(x=>implies(ch.opens,x,canon)))fail(4,p+'.opens','is one of the chapter\'s routes (or needs one): the find closes the chapter first, so the choice never opens');}
    arr(ch.options).forEach((o,j)=>{for(const k of ['if','when'])if(plain(o?.[k])){if(never(o[k],i))fail(4,p+'.options['+j+'].'+k,'can never hold in this chapter');else if(k==='when'&&(i===0?atStart(o[k]):atOpen(o[k],i)===true))fail(4,p+'.options['+j+'].when','holds already as the chapter opens, so the engine would settle the choice before it is put');}});}
   const pressure=pressureCount(i);
   if(pressure<tier.pressure[0]||pressure>tier.pressure[1])fail(4,w+'.pressure','a '+tale.length+' tale has '+tier.pressure.join(' to ')+' pressure steps a chapter (it has '+pressure+')');
   if(!c?.fight&&!c?.choice&&i+1<confrontFrom)warn(4,w,'has neither a set piece (fight) nor a choice');
   // A fight that waits for a level: below it, its `otherwise` (or nothing).
   const f=c?.fight;if(plain(f)&&Number.isInteger(f.fromLevel)){
    if(f.fromLevel<=lowest)warn(4,w+'.fight.fromLevel','every hero of this tale is level '+lowest+' or more: leave "fromLevel" out');
    else if(i===0&&!plain(f.otherwise))fail(4,w+'.fight.otherwise','chapter 1\'s set piece is the first fight: below level '+f.fromLevel+' give the creature met there instead ("otherwise")');
    if(f.fromLevel>highest)warn(4,w+'.fight.fromLevel','no hero of this tale reaches level '+f.fromLevel+(plain(f.otherwise)?': only "otherwise" is ever met':', so this set piece is never armed'));}
   // A place armed twice in one chapter: once is a lair, and arming it again needs the first beaten.
   const here=new Map();if(plain(f)&&typeof f.at==='string')here.set(nameKey(f.at),w+'.fight.at');
   for(const [ew,v] of stagingEffects({chapters:chapters.map((x,j)=>j===i?{...x,then:undefined}:j===i-1?{then:x?.then}:{})},'story.staging'))if(v.kind==='arm'&&typeof v.value?.at==='string'){const k=nameKey(v.value.at);if(here.has(k))fail(4,ew.replace(/^story\.staging/,'story.staging')+'.at','"'+v.value.at+'" is already armed in this chapter ('+here.get(k)+'): a place holds one threat at a time');else here.set(k,ew);}
   // The next chapter's set piece where this one is closed by reaching it: the hero is there already.
   if(i>0&&plain(f)&&typeof f.at==='string'){const k=nameKey(f.at),prev=arr(chapters[i-1]?.found?.any);if(prev.some(x=>['reach','at','clear','won','searched','checked'].includes(kindOf(x))&&nameKey(valueOf(x))===k))warn(4,w+'.fight.at','chapter '+i+' may close with the hero at "'+f.at+'": its threat then waits for their next arrival');}
  });
  // Leads: their condition never holds already as the tale begins (it would pay at once), and can hold at some time.
  arr(staging.leads).forEach((l,i)=>{if(!plain(l?.done))return;const p='story.staging.leads['+i+'].done';if(never(l.done,last))fail(4,p,'can never hold in this tale');else if((l.opens??1)===1&&atStart(l.done))fail(4,p,'holds already as the tale begins, so the lead would close (and pay) at once');});
  // Endings: each can be chosen (never behind an earlier ending that holds whenever it does: the engine takes the first).
  {const list=arr(staging.endings);list.forEach((e,i)=>{if(!plain(e?.if))return;const p='story.staging.endings['+i+'].if';if(always(e.if))fail(4,p,'always holds when the tale ends, so no ending after it is ever chosen');const j=list.slice(0,i).findIndex(x=>plain(x?.if)&&implies(e.if,x.if,canon));if(j>=0)fail(4,p,'holds only when endings['+j+'] ("'+list[j].id+'") holds too, and that one is taken first: this ending is never chosen');if(never(e.if,last,true))fail(4,p,'can never hold when the tale ends');});}
  if(n&&(n<tier.chapters[0]||n>tier.chapters[1]))fail(4,'story.chapters','a '+tale.length+' tale has '+tier.chapters.join(' to ')+' chapters (it has '+n+')');
  if(staging.length!==undefined&&staging.length!==tale.length)fail(4,'story.staging.length','must match the file\'s length ("'+tale.length+'")');
  if(!Array.isArray(staging.firstSay)||staging.firstSay.length!==3)fail(4,'story.staging.firstSay','must be exactly three things the player might say first');
  else if(new Set(staging.firstSay.map(nameKey)).size!==3)fail(4,'story.staging.firstSay','the three lines must differ');
  if(staging.noBeyond===false&&tale.length!=='long')warn(4,'story.staging.noBeyond','short and medium tales keep the hero on their own map until the last chapter');
  // The clock: a stalled chapter lasts at most the tier's bound (its steps times drift), and the quiet before the clock
  // acts stays near the tier's own. A hard tale's clock ticks on long rests (its card says so).
  {const pace=r.stagingPacing[tale.length]??r.stagingPacing.short,drift=Number.isInteger(staging.drift)?staging.drift:pace.drift,quiet=Number.isInteger(staging.quiet)?staging.quiet:pace.quiet;
   chapters.forEach((c,i)=>{const steps=pressureCount(i);if(steps*drift>tier.stall)fail(4,'story.staging.drift','chapter '+(i+1)+' would stall for '+(steps*drift)+' moves ('+steps+' steps, one every '+drift+' moves): a '+tale.length+' tale\'s stalled chapter lasts at most '+tier.stall);});
   if(quiet>pace.quiet+2)fail(4,'story.staging.quiet','a '+tale.length+' tale waits at most '+(pace.quiet+2)+' quiet moves before the clock acts (it says '+quiet+')');
   if(tale.difficulty==='hard'&&staging.ticks?.rest!==true)fail(4,'story.staging.ticks.rest','a hard tale\'s clock ticks on long rests (its card says so): "ticks": {"rest": true}');}
  // The staging's size, for the tier.
  {let size=0;try{size=JSON.stringify(story.staging??{}).length;}catch{}report.stagingSize=size;if(size>tier.size)fail(4,'story.staging','is '+size+' characters of JSON: a '+tale.length+' tale\'s staging is at most '+tier.size);}
  const endings=Array.isArray(staging.endings)?staging.endings.length:0,choices=chapters.filter(c=>plain(c?.choice)).length,leads=Array.isArray(story.leads)?story.leads.length:0;
  if(endings&&(endings<tier.endings[0]||endings>tier.endings[1]))fail(4,'story.staging.endings','a '+tale.length+' tale has '+tier.endings.join(' to ')+' endings (it has '+endings+')');
  if(choices<tier.choices[0]||choices>tier.choices[1])fail(4,'story.staging.chapters','a '+tale.length+' tale has '+tier.choices.join(' to ')+' choices (it has '+choices+')');
  chapters.forEach((c,i)=>{const k=arr(c?.choice?.options).length;if(k>tier.options)fail(4,chapterPath(i,'.choice.options'),'a '+tale.length+' tale\'s choice has at most '+tier.options+' options (it has '+k+')');});
  if(leads<tier.leads[0]||leads>tier.leads[1])fail(4,'story.leads','a '+tale.length+' tale has '+tier.leads.join(' to ')+' leads (it has '+leads+')');
  const cast=people.length;if(cast<tier.people[0]||cast>tier.people[1])fail(4,'story.residents','a '+tale.length+' tale names '+tier.people.join(' to ')+' people with keeper and mara (it has '+cast+')');
  const marks=Array.isArray(story.landmarks)?story.landmarks.length:0,far=Array.isArray(story.lands)?story.lands.length:0;
  if(marks<tier.landmarks[0]||marks>tier.landmarks[1])fail(4,'story.landmarks','a '+tale.length+' tale has '+tier.landmarks.join(' to ')+' landmarks (it has '+marks+')');
  if(far<tier.farLands[0]||far>tier.farLands[1])fail(4,'story.lands','a '+tale.length+' tale has '+tier.farLands.join(' to ')+' far lands (it has '+far+')');
  const fights=(seated?.armings??[]).length+1;
  if(fights<tier.fights[0]||fights>tier.fights[1])warn(4,'story.staging','a '+tale.length+' tale has '+tier.fights[0]+(tier.fights[1]===Infinity?' or more':' to '+tier.fights[1])+' fights with the boss: set pieces, armed places and the boss make '+fights);
  (Array.isArray(story.leads)?story.leads:[]).forEach((l,i)=>{if(!arr(staging.leads).some(x=>x?.id==='l'+(i+1)))warn(4,'story.leads['+i+']','has no condition in staging.leads, so only the Dungeon Master can close it');});
  if(seated){
   const g=seated.game,ids=r.stagingIds(g),start=g.story.geography?.at?.inn??{x:0,y:0},miles=id=>{const p=arr(g.world?.places).find(x=>x.id===id);return p?Math.hypot(p.x-start.x,p.y-start.y)/5280:null;};
   if(tier.landmarkMiles)arr(g.world?.places).filter(p=>!p.region).forEach(p=>{const m=miles(p.id);if(m!==null&&m>tier.landmarkMiles+1e-6)fail(4,'story.landmarks','"'+p.name+'" lies '+m.toFixed(2)+' miles from the start: a '+tale.length+' tale keeps its landmarks within '+tier.landmarkMiles+' mile');});
   const first=chapters[0]?.fight;
   if(!plain(first))fail(4,'story.staging.chapters[0].fight','the first chapter has a set piece, so the first fight begins within minutes');
   else{const id=ids.place(first.at),m=id?miles(id):null;if(m!==null&&(m<0.1-1e-6||m>0.3+1e-6))fail(4,'story.staging.chapters[0].fight.at','the first fight is 0.1 to 0.3 mile from the start ("'+first.at+'" is '+m.toFixed(2)+')');}
   // Conditions that can only hold where something was armed or given.
   const given=new Set([nameKey(story.hoard?.name),...items.map(x=>nameKey(x.name))]),armedAnywhere=new Set((seated.armings??[]).map(a=>a.key));
   for(const [w,c] of stagingConditions(staging,'story.staging')){
    const k=kindOf(c),v=c[k];
    if((k==='clear'||k==='won')&&typeof v==='string'&&!armedAnywhere.has(nameKey(v)))fail(4,w+'.'+k,'"'+v+'" has no fight: set a chapter fight there or arm it ({"arm"}), or the condition can never hold');
    if(k==='searched'&&typeof v==='string'&&!armedAnywhere.has(nameKey(v)))warn(4,w+'.'+k,'nothing falls at "'+v+'" unless a fight is set there, so there may be nothing to search');
    if(k==='carry'&&typeof v==='string'&&!given.has(nameKey(v)))warn(4,w+'.'+k,'nothing in the tale gives "'+v+'" (give, found.item or the hoard), so only the Dungeon Master can hand it over');
    if(k==='level'&&Number.isInteger(v)&&v<=lowest)warn(4,w+'.level','every hero of this tale is level '+lowest+' or more, so this always holds');
    if(w.includes('.endings[')&&r.stagingEvents.includes(k))warn(4,w+'.'+k,'"'+k+'" counts only what happened in the last chapter (an ending is chosen when the tale closes): clear, foe or a flag say more');
   }
  }
  // Difficulty.
  const effective=t=>lowest>=3?t:(singleOf[t]??t),minions=Array.isArray(staging.boss?.minions)?staging.boss.minions.length:0;
  if(tale.difficulty==='gentle'){
   // A gentle tale meets single creatures and a foe with nobody at its side (the stories spec, 1.3).
   if(minions)fail(4,'story.staging.boss.minions','a gentle tale\'s foe fights alone: no minions');
   if(staging.boss?.bloodied?.kind==='call')fail(4,'story.staging.boss.bloodied.kind','a gentle tale\'s foe fights alone: it calls no help (flee or rage)');
   for(const c of creatures.filter(x=>x.role==='threat'))if(packTemplates.includes(effective(c.template)))warn(4,c.where,'a gentle tale meets single creatures: "'+c.name+'" is a pack at level '+lowest);
   for(const c of creatures.filter(x=>x.role==='ally'))if(highest>=2)warn(4,c.where,'a gentle tale meets single creatures: "'+c.name+'" stands beside another from level 2');
  }
  for(const c of creatures.filter(x=>x.role==='ally'&&x.template==='orc'))if(lowest<3)warn(4,c.where,'an orc stands beside another creature only from level 3, so below it "'+c.name+'" is not there');
  {const item=r.magicItems[story.hoard?.item],rank=x=>['uncommon','rare','very rare'].indexOf(x);if(item&&rank(item.rarity)>rank(r.rarityAllowed(lowest)))warn(4,'story.hoard.item','"'+story.hoard.item+'" is '+item.rarity+': a hero at level '+lowest+' is given another item instead');}
  if(tale.difficulty==='steady'&&minions>1)warn(4,'story.staging.boss.minions','a steady tale\'s boss has at most one minion');
  // The shelf: one tale per slug and id, one Start here tale, variety in the tier.
  for(const {file:other,tale:t} of shelf.tales){
   const where=path.basename(other);
   if(t.id===tale.id&&t.slug!==tale.slug)fail(4,'id','is also the id of '+where);
   if(t.slug===tale.slug&&t.id!==tale.id)fail(4,'slug','is also the slug of '+where);
   if(t.id===tale.id)continue;
   if(t.firstTale===true&&tale.firstTale===true)fail(4,'firstTale',where+' is already the Start here tale');
   if(t.order===tale.order)warn(4,'order',where+' has the same order ('+tale.order+')');
   if(t.length===tale.length&&plain(t.shape)&&plain(tale.shape)){
    if(t.shape.engine===tale.shape.engine)fail(4,'shape.engine','"'+tale.shape.engine+'" is already the engine of '+where+' in the '+tale.length+' tier');
    if(t.shape.twist===tale.shape.twist)fail(4,'shape.twist','"'+tale.shape.twist+'" is already the twist of '+where+' in the '+tale.length+' tier');
    if(Array.isArray(t.shape.endings)&&Array.isArray(tale.shape.endings)&&[...t.shape.endings].sort().join()===[...tale.shape.endings].sort().join())fail(4,'shape.endings',where+' has the same kinds of ending in the '+tale.length+' tier');
   }
  }
  if(plain(tale.shape)&&shelf.tales.filter(({tale:t})=>t.id!==tale.id&&t.shape?.twist===tale.shape.twist).length>=2)fail(4,'shape.twist','"'+tale.shape.twist+'" is already the twist of two tales on the shelf');
 }
 // Names across the shelf.
 if(!libs.shelf.found)warn(3,'--shelf','no shelf was found ('+(libs.shelf.given?libs.shelf.dir:'looked in '+(libs.shelf.looked??[]).join(', '))+'): names were checked within this tale only');
 for(const s of shelf.skipped)warn(3,'--shelf',s+' on the shelf could not be read as a tale, so it was not compared');
 for(const {file:other,tale:t} of shelf.tales){
  if(t.id===tale.id)continue;
  const where=path.basename(other),os=plain(t.story)?t.story:{};
  const theirs=new Map(),their=(name,what)=>{if(typeof name==='string')theirs.set(nameKey(name),what);};
  their(os.title,'the title');their(os.region,'the region');their(os.foe,'the foe');
  for(const id of ['inn','bridge','tower'])their(os.locations?.[id]?.name,'a place');for(const l of arr(os.landmarks))their(l?.name,'a place');for(const l of arr(os.lands)){their(l?.name,'a land');their(l?.place?.name,'a place');}
  const theirPeople=[os.npcs?.keeper,os.npcs?.mara,...arr(os.residents)].filter(p=>p&&typeof p.name==='string');
  for(const p of theirPeople)their(p.name,'a person');
  const parts=new Map();for(const p of [...theirPeople,{name:os.foe}])for(const part of nameParts(p.name))parts.set(part,p.name);
  for(const x of [...places,...people,...lands,...foe,...title]){const o=theirs.get(nameKey(x.name));if(o)fail(3,x.where,'"'+x.name+'" is already '+o+' in '+where+': names are unique across the shelf');}
  for(const x of [...people,...foe])for(const part of nameParts(x.name))if(parts.has(part)&&!theirs.has(nameKey(x.name)))fail(3,x.where,'"'+x.name+'" shares "'+part+'" with '+parts.get(part)+' in '+where);
  const theirPools=new Set(theirPeople.map(p=>p.pool).filter(Boolean));
  for(const p of people)if(p.pool&&theirPools.has(p.pool))fail(3,p.where+'.pool',p.pool+' is already cast in '+where);
 }

 // ===== 5. Walkthroughs: the shape today; running them needs the staging engine =====
 {
  const w=tale.walkthrough,endingIds=arr(staging.endings).map(e=>e?.id),choiceOptions=new Map(arr(staging.chapters).filter(c=>plain(c?.choice)).map(c=>[c.choice.id,arr(c.choice.options).map(o=>o?.id)]));
  const ids=seated?r.stagingIds(seated.game):null;
  const steps=(list,where)=>{
   if(!Array.isArray(list)||list.length<1||list.length>400){fail(5,where,'must be a list of 1 to 400 steps');return 0;}
   let moves=0;
   list.forEach((s,i)=>{const p=where+'['+i+']';
    if(!plain(s)){fail(5,p,'must be an object');return;}
    const kinds=Object.keys(s).filter(k=>stepKinds.includes(k));
    if(kinds.length!==1||Object.keys(s).some(k=>!stepKinds.includes(k)&&!(k==='speakers'&&kinds[0]==='say'))){fail(5,p,'a step has exactly one of '+stepKinds.join(', ')+' ("say" may add "speakers")');return;}
    const k=kinds[0],v=s[k];moves+=k==='wait'?(Number.isInteger(v)?v:Number.isInteger(v?.moves)?v.moves:1):1;
    if(k==='go'){if(!isText(v,1,80))fail(5,p+'.go','must be a place name');else if(ids&&!ids.place(v))fail(5,p+'.go','"'+v+'" is no place of this tale');}
    else if(k==='say'){if(!isText(v,1,300))fail(5,p+'.say','must be the player\'s words, up to 300 characters');if(s.speakers!==undefined){if(!Array.isArray(s.speakers)||s.speakers.length>4||!s.speakers.every(n=>isText(n,1,60)))fail(5,p+'.speakers','must be a list of up to 4 people\'s names');else if(ids)for(const n of s.speakers)if(!ids.person(n))fail(5,p+'.speakers','"'+n+'" is no person of this tale');}}
    else if(k==='fight'||k==='search'){if(v!==true)fail(5,p+'.'+k,'must be true');}
    else if(k==='confront'){if(!['slay','subdue'].includes(v))fail(5,p+'.confront','must be slay or subdue');}
    else if(k==='check'){if(!['pass','fail'].includes(v))fail(5,p+'.check','must be pass or fail');}
    else if(k==='rest'){if(!['short','long'].includes(v))fail(5,p+'.rest','must be short or long');}
    else if(k==='choose'){if(!plain(v)||Object.keys(v).length!==1)fail(5,p+'.choose','must be {"<choice id>": "<option id>"}');else{const [c,o]=Object.entries(v)[0];if(!choiceOptions.has(c)||!choiceOptions.get(c).includes(o))fail(5,p+'.choose','names no choice and option of this tale');}}
    else if(k==='join'||k==='find'){if(!isText(v,1,60))fail(5,p+'.'+k,'must be a person\'s name');else if(ids&&!ids.person(v))fail(5,p+'.'+k,'"'+v+'" is no person of this tale');}
    else if(k==='attack'){if(!plain(v)||Object.keys(v).some(x=>!['who','to'].includes(x))||!isText(v.who,1,60)||!['kill','subdue'].includes(v.to))fail(5,p+'.attack','must be {"who": a person\'s name, "to": "kill" or "subdue"}');else if(ids&&!ids.person(v.who))fail(5,p+'.attack.who','"'+v.who+'" is no person of this tale');}
    else if(k==='advance'){if(v!==true)fail(5,p+'.advance','must be true');}
    else if(k==='lead'){if(!arr(story.leads).some((l,i)=>'l'+(i+1)===v))fail(5,p+'.lead','must be one of this tale\'s leads (l1 for its first)');}
    else if(k==='wait'){const ok=Number.isInteger(v)?v>=1&&v<=200:plain(v)&&Object.keys(v).every(x=>['moves','talk'].includes(x))&&Number.isInteger(v.moves)&&v.moves>=1&&v.moves<=200&&(v.talk===undefined||typeof v.talk==='boolean');if(!ok)fail(5,p+'.wait','must be a number of quiet moves (1 to 200), or {"moves": 1 to 200, "talk": true or false}');}
   });
   return moves;
  };
  if(!plain(w))fail(5,'walkthrough','must be {"golden": {"ending", "steps"}, "endings": {...}}');
  else{
   for(const k of Object.keys(w))if(!['golden','endings'].includes(k))fail(5,'walkthrough.'+k,'unknown key');
   if(!plain(w.golden)||Object.keys(w.golden).some(k=>!['ending','steps'].includes(k)))fail(5,'walkthrough.golden','must be {"ending": an ending id, "steps": [...]}');
   else{if(!endingIds.includes(w.golden.ending))fail(5,'walkthrough.golden.ending','must be one of this tale\'s endings ('+endingIds.join(', ')+')');
    const moves=steps(w.golden.steps,'walkthrough.golden.steps');if(moves>tier.moves)warn(5,'walkthrough.golden','already '+moves+' moves before its fights: a '+tale.length+' tale\'s golden path is at most '+tier.moves);}
   if(!plain(w.endings))fail(5,'walkthrough.endings','must be an object: a path of steps for each ending');
   else{for(const [id,list] of Object.entries(w.endings)){if(!endingIds.includes(id))fail(5,'walkthrough.endings.'+id,'is no ending of this tale');steps(list,'walkthrough.endings.'+id);}
    for(const id of endingIds)if(typeof id==='string'&&id!==w.golden?.ending&&!Object.hasOwn(w.endings,id))fail(5,'walkthrough.endings','has no path to the ending "'+id+'"');}
  }
  // Then played through the game's own rules (written-walk.cjs: settleTurn, the staging engine, seeded dice and scripted
  // Dungeon Master replies), by the ready-made Fighter at the tale's lowest level, taking each level as it comes: the
  // golden path and every ending's path reach their endings, a passive player (talks, rests, wanders) reaches one through
  // the clock within the tier's stall bound for each chapter, and a violent one (kills every resident the tale names)
  // still finishes. A path is tried with the dice of seeds 1, 2 and 3; one the dice can spoil is said to be fragile.
  if(options.walks===false)todo(5,'TODO(walkthroughs): not played (walks: false).');
  else if(seated&&plain(w)&&!report.errors.some(e=>e.check<=5)){
   const W=require('./written-walk.cjs'),lowest=levels[0],start=startCopy(tale,'written-walk');
   const run=(spec,accept)=>{const tries=[];for(const seed of [1,2,3]){let res;try{res=W.walkTale({r,story:JSON.parse(JSON.stringify(start)),hero:heroAt('fighter',lowest),heroAt:lv=>heroAt('fighter',lv),seed,trace:options.walk===spec.name,...spec});}catch(e){res={ok:false,error:'the walk failed: '+e.message,moves:0,chapters:[],log:[]};}tries.push({seed,res});if(accept(res))break;}const good=tries.find(t=>accept(t.res));return {tries,good,first:tries[0]};};
   const why=(res,ending)=>res.ok?'it ends in "'+res.ending+'", not "'+ending+'"':res.error;
   const summary=t=>t?{seed:t.seed,ok:t.res.ok,ending:t.res.ending??null,moves:t.res.moves,chapters:(t.res.chapters??[]).map(c=>({chapter:c.chapter,at:c.moves,byClock:c.byClock})),levels:t.res.levels??0,...(t.res.error?{error:t.res.error}:{})}:null;
   report.walks={};
   const path=(name,steps,ending,where)=>{
    const got=run({name,steps,mode:'steps'},res=>res.ok&&res.ending===ending);report.walks[name]=summary(got.good??got.first);
    if(options.walk===name)report.walkTrace=(got.good??got.first).res.log;
    if(!got.good){fail(5,where,'played through the rules, '+why(got.first.res,ending)+(got.first.res.moves?' (after '+got.first.res.moves+' moves)':''));return null;}
    if(got.good.seed!==1)warn(5,where,'with the dice of seed 1 '+why(got.first.res,ending)+'; with seed '+got.good.seed+' it reaches "'+ending+'": a path the dice can spoil');
    {const skipped=(got.good.res.log??[]).filter(l=>l.kind==='skipped').length;if(skipped)warn(5,where,'moves '+plural(skipped,'chapter')+' on ({"advance": true}) before the chapter\'s set piece is beaten and its choice made: the Dungeon Master is offered story-advance only after them, so no player can take this path (play the chapters through, or let the clock close them)');}
    return got.good.res;};
   const golden=plain(w.golden)?path('golden',w.golden.steps,w.golden.ending,'walkthrough.golden'):null;
   if(golden){if(golden.moves>tier.moves)fail(5,'walkthrough.golden','takes '+golden.moves+' moves played through the rules (fights included): a '+tale.length+' tale\'s golden path is at most '+tier.moves);else if(golden.moves<tier.movesLeast)warn(5,'walkthrough.golden','takes '+golden.moves+' moves played through the rules: a '+tale.length+' tale\'s golden path is '+tier.movesLeast+' to '+tier.moves);}
   if(plain(w.endings))for(const [id,list] of Object.entries(w.endings))path(id,list,id,'walkthrough.endings.'+id);
   // The passive player: the clock must carry each chapter to its close within the tier's stall bound (and a little for
   // what is told on the way).
   {const got=run({name:'passive',mode:'passive'},res=>res.ok);report.walks.passive=summary(got.good??got.first);if(options.walk==='passive')report.walkTrace=(got.good??got.first).res.log;
    if(!got.good)fail(5,'walkthrough','a passive player (who only talks, rests and wanders) never reaches an ending: '+got.first.res.error);
    else{const c=got.good.res.chapters;c.forEach((x,i)=>{const n=x.at??x.moves,d=n-(i?c[i-1].moves:0);if(d>tier.stall+10)fail(5,'walkthrough','a passive player stays '+d+' moves in chapter '+x.chapter+': the clock must close a stalled '+tale.length+' chapter within about '+tier.stall);});}}
   {const got=run({name:'violent',mode:'violent'},res=>res.ok);report.walks.violent=summary(got.good??got.first);if(options.walk==='violent')report.walkTrace=(got.good??got.first).res.log;
    if(!got.good){if(got.tries.every(t=>t.res.died))warn(5,'walkthrough','a violent player (who kills every resident the tale names) died with every seed before the tale ended');else fail(5,'walkthrough','a violent player (who kills every resident the tale names) never finishes: '+(got.tries.find(t=>!t.res.died)?.res.error??got.first.res.error));}}
   // ===== 9. Experience: the levels the golden path gives a new hero =====
   if(golden){const gained=(golden.endLevel??lowest)-(golden.startLevel??lowest),[lo,hi]=tier.levelsGained;report.walks.golden.levelsGained=gained;
    if(gained<lo||gained>hi)warn(9,'walkthrough.golden','a hero who begins at level '+lowest+' gains '+plural(gained,'level')+' along the golden path: a '+tale.length+' tale gives '+lo+' to '+hi+' (a new hero ends near level '+(lo+1)+' to '+(hi+1)+')');}
  }else if(!report.errors.some(e=>e.check===5))todo(5,'TODO(walkthroughs): not played until the tale passes checks 1 to 4.');
 }

 // ===== 6. Pictures cost nothing =====
 {
  const people6=require('./people-library.cjs');
  for(const p of people)if(!p.pool){
   if(!people6.speciesList.includes(p.entry.species))fail(6,p.where+'.species','"'+p.entry.species+'" is not one of the thirteen common peoples ('+people6.speciesList.join(', ')+'), so their portrait would be painted');
   else if(people6.notALibraryFace({kind:'portrait',name:p.name,role:p.entry.role,description:p.entry.appearance}))warn(6,p.where+'.appearance','reads as a child or one of the dead, so their portrait is painted once for the shelf (not free)');
  }
  if(typeof story.foeSpecies==='string'&&!people6.speciesList.includes(story.foeSpecies)&&foe.length)creatures.push({name:story.foe,appearance:story.foeAppearance,template:null,where:'story.foe',terrain:story.terrain,kind:story.foeSpecies,role:'foe'});
  if(!libs.creatures.found)fail(6,'--creatures','the creature library was not found ('+(libs.creatures.given?libs.creatures.dir:'looked in '+(libs.creatures.looked??[]).join(', '))+'): pass --creatures <folder>');
  else{
   let pictures=[];try{pictures=loadCreatures(libs.creatures.dir);}catch(e){fail(6,'--creatures','cannot read '+path.join(libs.creatures.dir,'library.json')+': '+e.message);}
   const {fitsFor}=require('./creature-library.cjs'),landOf=at=>{const l=arr(story.lands).find(x=>nameKey(x?.place?.name)===nameKey(at));return l?.terrain??story.terrain;};
   for(const c of creatures){
    if(typeof c.appearance!=='string'||(c.template!==null&&!r.templateKeys.includes(c.template)))continue;
    const subject={kind:'creature',campaignId:'written-check',id:'check',name:c.name,description:c.role==='foe'?c.appearance:('A creature: '+c.name+'. '+c.appearance),...(c.template?{template:c.template}:{}),terrain:c.at?landOf(c.at):c.terrain??story.terrain,...(c.kind?{creatureKind:c.kind}:{})};
    if(!fitsFor(pictures,subject).length)fail(6,c.where,'nothing in the creature library fits "'+c.name+'", so it would be painted: name what it is in its name or look (a wolf, a spider, the dead...)');
   }
  }
  if(!libs.places.found)fail(6,'--places','the place-art library was not found ('+(libs.places.given?libs.places.dir:'looked in '+(libs.places.looked??[]).join(', '))+'): pass --places <folder>');
  else{
   let entries=[];try{entries=loadPlaces(libs.places.dir);}catch(e){fail(6,'--places','cannot read '+path.join(libs.places.dir,'library.json')+': '+e.message);}
   const P=require('./place-library.cjs'),complete=P.kindTerrainComplete(entries);
   const check=(name,kind,terrain,where)=>{if(!P.placeKinds.includes(kind)||!P.terrains.includes(terrain))return;if(!P.choosePicture(entries,{kind,terrain},{campaignId:'written-check',placeId:where,complete}))fail(6,where,'no picture in the place-art library fits "'+name+'" ('+kind+' in '+terrain+'), so it would be painted');};
   for(const id of ['inn','bridge','tower'])if(story.locations?.[id])check(story.locations[id].name,story.locations[id].kind,story.terrain,'story.locations.'+id);
   arr(story.landmarks).forEach((l,i)=>check(l?.name,l?.kind,story.terrain,'story.landmarks['+i+']'));
   arr(story.lands).forEach((l,i)=>check(l?.place?.name,l?.place?.kind,l?.terrain,'story.lands['+i+'].place'));
  }
  const cover=[story.locations?.inn?.kind,story.terrain].join(' in ');
  for(const {file:other,tale:t} of shelf.tales)if(t.id!==tale.id&&[t.story?.locations?.inn?.kind,t.story?.terrain].join(' in ')===cover)fail(6,'story.locations.inn.kind','the cover ('+cover+') is already '+path.basename(other)+'\'s: each tale\'s starting kind of place and terrain are its own on the shelf');
 }

 // ===== 7. Text =====
 {
  if(typeof story.opening==='string'){
   const sentences=story.opening.trim().split(/(?<=[.!?]["'”’)]*)\s+/),lastSentence=sentences[sentences.length-1]??'';
   if(!/[?!]["'”’)]*$/.test(lastSentence.trim())&&!/["”]$/.test(lastSentence.trim())&&!/\byou(?:r|rs|rself)?\b/i.test(lastSentence))fail(7,'story.opening','must end on a demand or a question: its last sentence ends with ? or !, is someone\'s words in quotation marks, or turns to "you"');
  }
  const intro=plain(story.introduction)?story.introduction:{},said=Array.isArray(story.openingDialogue)?story.openingDialogue.reduce((n,l)=>n+(typeof l?.text==='string'?l.text.length:0),0):0;
  const load=['place','trouble','first'].reduce((n,k)=>n+(typeof intro[k]==='string'?intro[k].length:0),0)+(typeof story.opening==='string'?story.opening.length:0)+said;
  report.readingLoad=load;
  if(load>900)fail(7,'story','the reading before the first move is '+load+' characters (introduction place, trouble and first; the opening; the opening lines): at most 900');
  for(const [where,v] of stagingTold(staging,'story.staging')){
   if(/\d/.test(v))fail(7,where,'no digits in what the game tells: "'+v.match(/\S*\d\S*/)[0]+'"');
   const m=ruleTalk(v);if(m)fail(7,where,'no rule words in what the game tells: "'+m+'"');
  }
  for(const [where,v] of stagingRead(staging,'story.staging')){const m=ruleTalk(v);if(m)fail(7,where,'no rule words in what the player reads or the Dungeon Master is handed: "'+m+'"');}
  for(const [where,v] of allProse(tale).filter(([w])=>!w.startsWith('story.staging')))if(ruleTalk(v))warn(7,where,'reads like the rules ("'+ruleTalk(v)+'"): tell it as what happens');
  const everything=allText(tale);
  for(const [word,re] of overused){const n=(everything.match(re)??[]).length;if(n>1)fail(7,'tale','"'+word+'" appears '+n+' times: at most once in a tale');}
  for(const word of avoidWords){const n=(everything.match(new RegExp('\\b'+word+'\\b','gi'))??[]).length;if(n)fail(3,'tale','"'+word+'" appears '+n+' times: it is on the avoid list');}
  const named=everything.match(publisherWords);if(named)fail(3,'tale','"'+named[0]+'" belongs to another publisher\'s world: Questbound uses its own names');
  const proseDigits=allProse(tale).filter(([,v])=>/\d/.test(v));
  for(const [where,v] of proseDigits.slice(0,5))warn(7,where,'has a number written in digits ("'+v.match(/\S*\d\S*/)[0]+'"): spell it out or leave it out');
 }

 // ===== 8. Balance: the tale's fights, simulated (tale-balance.cjs; balance-check.cjs --tale prints the same) =====
 if(options.balance===false)todo(8,'TODO(balance): not played (balance: false).');
 else if(report.errors.some(e=>e.check<=4))todo(8,'TODO(balance): not played until the tale passes checks 1 to 4.');
 else{
  const TB=require('./tale-balance.cjs'),fights=Number.isInteger(options.balanceFights)&&options.balanceFights>0?options.balanceFights:40;
  // Seeded dice, so the same tale gives the same report.
  let seed=20261022;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  const fightAt=c=>c.kind==='boss'?'story.staging.boss':'story.staging.chapters['+(c.chapter-1)+'].fight';
  let out=null;try{out=TB.taleBalance({r,story:startCopy(tale,'written-balance'),heroAt,levels:TB.taleLevels(tale),party:[1,2],fights,random});}catch(e){fail(8,'story.staging','the fights could not be played: '+e.message);}
  if(out){
   for(const p of out.problems)fail(8,'story.staging','the rules refused a move in a fight: '+p);
   const lowest=TB.taleLevels(tale)[0],difficulty=['gentle','steady','hard'].includes(tale.difficulty)?tale.difficulty:'steady';
   // The Start here tale is a newcomer's first: its first fight must not be a likely death for any ready-made hero alone
   // (firstFight: won at least 80%, deaths under 10%; the gentle target of 90% stays a warning, since no creature meets
   // it for a level-1 Wizard: measured 2026-10-22, a bandit 80% won, a skeleton 83%, a goblin 50%, a wolf 68% with 13%
   // deaths).
   if(tale.firstTale===true)for(const c of out.cells.filter(c=>!c.none&&c.kind!=='boss'&&c.chapter===1&&c.size===1&&c.level===lowest))if(c.win<firstFight.won||c.death>=firstFight.death)fail(8,fightAt(c),c.label+': the Start here tale\'s first fight: the ready-made '+c.cls+' alone at level '+lowest+' wins '+Math.round(100*c.win)+'% and dies in '+Math.round(100*c.death)+'% (a newcomer\'s first fight: at least '+Math.round(100*firstFight.won)+'% won and under '+Math.round(100*firstFight.death)+'% deaths for every class): lighten it (a lighter creature, such as a lone bandit, through fromLevel and otherwise)');
   for(const c of out.cells.filter(c=>!c.none&&c.key==='fighter'&&c.size===1&&c.level===lowest))if(c.win<0.5||c.death>=0.2)fail(8,fightAt(c),c.label+': the ready-made Fighter alone at level '+lowest+' wins '+Math.round(100*c.win)+'% and dies in '+Math.round(100*c.death)+'%: lighten it (a lighter creature, fromLevel and otherwise, no ally, fewer minions)');
   const byLabel=new Map(out.cells.map(c=>[c.label,c]));
   for(const f of TB.balanceFindings(out.cells,difficulty))warn(8,fightAt(byLabel.get(f.where)??{kind:'boss'}),f.where+': '+f.message);
   report.balance={fights,cells:out.cells.filter(c=>!c.none).map(c=>({fight:c.label,kind:c.kind,class:c.cls,level:c.level,party:c.size,win:Math.round(100*c.win),fall:Math.round(100*c.fall),death:Math.round(100*c.death),...(c.cost!==null?{cost:Math.round(100*c.cost)}:{})}))};
  }
 }
 return finish();
}

// ---------- Walkers over a tale's parts ----------
function stagingEffects(staging,base){
 const out=[],add=(then,where)=>{if(plain(then))for(const [kind,value] of Object.entries(then))out.push([where+'.'+kind,{kind,value}]);};
 arr(staging?.chapters).forEach((c,i)=>{if(!plain(c))return;const p=base+'.chapters['+i+']';add(c.then,p+'.then');add(c.opening?.then,p+'.opening.then');add(c.fight?.deadline?.then,p+'.fight.deadline.then');add(c.fight?.hold?.then,p+'.fight.hold.then');
  for(const kind of ['beats','complications','pressure'])(Array.isArray(c[kind])?c[kind]:[]).forEach((b,j)=>add(b?.then,p+'.'+kind+'['+j+'].then'));
  (Array.isArray(c.choice?.options)?c.choice.options:[]).forEach((o,j)=>add(o?.then,p+'.choice.options['+j+'].then'));});
 if(plain(staging?.boss)){add(staging.boss.deadline?.then,base+'.boss.deadline.then');add(staging.boss.hold?.then,base+'.boss.hold.then');}
 return out;
}
function stagingConditions(staging,base){
 const out=[],walk=(c,where)=>{if(!plain(c))return;out.push([where,c]);const [k,v]=Object.entries(c)[0]??[];if((k==='any'||k==='all')&&Array.isArray(v))v.forEach((x,i)=>walk(x,where+'.'+k+'['+i+']'));if(k==='not')walk(v,where+'.not');};
 arr(staging?.chapters).forEach((c,i)=>{if(!plain(c))return;const p=base+'.chapters['+i+']';(Array.isArray(c.found?.any)?c.found.any:[]).forEach((x,j)=>walk(x,p+'.found.any['+j+']'));
  for(const kind of ['beats','complications','pressure'])(Array.isArray(c[kind])?c[kind]:[]).forEach((b,j)=>{walk(b?.when,p+'.'+kind+'['+j+'].when');walk(b?.if,p+'.'+kind+'['+j+'].if');});
  if(plain(c.choice)){walk(c.choice.opens,p+'.choice.opens');arr(c.choice.options).forEach((o,j)=>{walk(o?.if,p+'.choice.options['+j+'].if');walk(o?.when,p+'.choice.options['+j+'].when');});}});
 arr(staging?.leads).forEach((l,i)=>walk(l?.done,base+'.leads['+i+'].done'));
 if(plain(staging?.boss))walk(staging.boss.if,base+'.boss.if');
 arr(staging?.endings).forEach((e,i)=>walk(e?.if,base+'.endings['+i+'].if'));
 return out;
}
// Whether condition a cannot hold without b holding too (the same condition, a part of an "all", or one way of an "any").
const implies=(a,b,canon)=>{if(!plain(a)||!plain(b))return false;if(canon(a)===canon(b))return true;const [ka,va]=Object.entries(a)[0]??[],[kb,vb]=Object.entries(b)[0]??[];return (ka==='all'&&Array.isArray(va)&&va.some(x=>implies(x,b,canon)))||(kb==='any'&&Array.isArray(vb)&&vb.some(y=>implies(a,y,canon)));};
const usesFoe=c=>{if(!plain(c))return false;const [k,v]=Object.entries(c)[0]??[];if(k==='foe')return true;if(k==='any')return Array.isArray(v)&&v.every(usesFoe);if(k==='all')return Array.isArray(v)&&v.some(usesFoe);return false;};
// What the game tells in its own words (and the Dungeon Master is handed as a beat): tell, line, sign, colour.
function stagingTold(staging,base){
 const out=[],walk=(v,where,key)=>{if(typeof v==='string'){if(['tell','line','sign','colour'].includes(key))out.push([where,v]);return;}if(Array.isArray(v))v.forEach((x,i)=>walk(x,where+'['+i+']',key));else if(plain(v))for(const [k,x] of Object.entries(v))walk(x,where+(/^[A-Za-z_]\w*$/.test(k)?'.'+k:'["'+k+'"]'),key==='colour'?key:k);};
 walk(staging,base,null);return out;
}
// The staging's prose (everything written to be read or told), for the full-sentence rule.
function stagingProse(staging,base){
 const keys=new Set(['tell','line','sign','colour','where','agenda','objective','ask','say','text','note','memory','fact','appearance','description','firstSay']),out=[];
 const walk=(v,where,key)=>{if(typeof v==='string'){if(keys.has(key))out.push([where,v]);return;}if(Array.isArray(v))v.forEach((x,i)=>walk(x,where+'['+i+']',key));else if(plain(v))for(const [k,x] of Object.entries(v))walk(x,where+(/^[A-Za-z_]\w*$/.test(k)?'.'+k:'["'+k+'"]'),['colour','firstSay'].includes(key)?key:k);};
 walk(staging,base,null);return out;
}
// The creatures a tale sets against the hero: set pieces and their allies, armed places and theirs, the boss's minions.
function talesCreatures(story){
 const st=plain(story?.staging)?story.staging:{},out=[];
 const add=(t,at,w)=>{if(!plain(t))return;out.push({name:t.name,appearance:t.appearance,template:t.template,at,where:w,role:'threat'});if(plain(t.ally))out.push({name:t.ally.name,appearance:t.ally.appearance,template:t.ally.template,at,where:w+'.ally',role:'ally'});};
 arr(st.chapters).forEach((c,i)=>{const w='story.staging.chapters['+i+'].fight';if(plain(c?.fight)){add(c.fight.threat,c.fight.at,w+'.threat');add(c.fight.otherwise,c.fight.at,w+'.otherwise');}});
 for(const [where,v] of stagingEffects(st,'story.staging'))if(v.kind==='arm'&&plain(v.value)){const {at,fromLevel,otherwise,...a}=v.value;add(a,at,where);add(otherwise,at,where+'.otherwise');}
 (Array.isArray(st.boss?.minions)?st.boss.minions:[]).forEach((m,i)=>{if(plain(m))out.push({name:m.name,appearance:m.appearance,template:m.template,where:'story.staging.boss.minions['+i+']',role:'minion'});});
 {const a=st.boss?.bloodied?.ally;if(plain(a))out.push({name:a.name,appearance:a.appearance,template:a.template,where:'story.staging.boss.bloodied.ally',role:'minion'});}
 return out;
}
// Every word of the tale a player or the Dungeon Master could read (the walkthrough is the checker's own).
function allText(tale){const {walkthrough,...rest}=tale;return JSON.stringify(rest).replace(/\\"/g,'"');}
// Every prose text of the tale (names, ids, kinds and numbers are not prose), with its path.
const proseKeys=new Set(['premise','opening','objective','resolution','secret','foeAppearance','foeVoice','description','feature','rumour','goal','turn','hook','blurb','special','mood','role','motive','appearance','personality','note','text','you','place','trouble','people','first','tell','line','sign','colour','where','agenda','ask','say','firstSay','memory','fact','state','label','title']);
function allProse(tale){
 const out=[];
 const walk=(v,where,key)=>{if(typeof v==='string'){if(proseKeys.has(key))out.push([where,v]);return;}if(Array.isArray(v))v.forEach((x,i)=>walk(x,where+'['+i+']',key));else if(plain(v))for(const [k,x] of Object.entries(v))walk(x,where?where+'.'+k:k,['colour','firstSay'].includes(key)?key:k);};
 const {walkthrough,shape,...rest}=tale;walk(rest,'',null);return out;
}
// What the player reads or the Dungeon Master is handed from the staging, beyond what the game tells: things to say,
// the choice's question and options, stakes, endings, memories, facts, notes, objectives.
function stagingRead(staging,base){
 const keys=new Set(['firstSay','say','ask','label','state','title','text','memory','fact','note','objective']),out=[];
 const walk=(v,where,key)=>{if(typeof v==='string'){if(keys.has(key))out.push([where,v]);return;}if(Array.isArray(v))v.forEach((x,i)=>walk(x,where+'['+i+']',key));else if(plain(v))for(const [k,x] of Object.entries(v))walk(x,where+(/^[A-Za-z_]\w*$/.test(k)?'.'+k:'["'+k+'"]'),key==='firstSay'?key:k);};
 walk(staging,base,null);return out;
}

// ---------- The report ----------
function textReport(rep){
 const lines=[],head='check-written-tale: '+(rep.slug??path.basename(rep.file))+' — '+(rep.ok?'PASS':'FAIL');
 lines.push(head,'  '+rep.file);
 for(const [n,c] of Object.entries(rep.checks)){
  const status=c.status==='fail'?'FAIL ('+c.errors+')':c.status==='todo'?'TODO':'ok';
  lines.push(' '+n+' '+(c.name+' ').padEnd(22,'.')+' '+status+(c.warnings?'  ('+plural(c.warnings,'warning')+')':''));
  for(const e of rep.errors.filter(x=>x.check===Number(n)))lines.push('     x '+e.where+': '+e.message);
  for(const w of rep.warnings.filter(x=>x.check===Number(n)))lines.push('     ! '+w.where+': '+w.message);
  for(const t of rep.todo.filter(x=>x.check===Number(n)))lines.push('     - '+t.message);
 }
 if(rep.seated)lines.push('Seated: '+rep.seated.heroes+' ready-made heroes at the tale\'s levels, and '+rep.seated.parties+' of '+rep.seated.tried+' parties of 2 and 4 heroes.');
 if(rep.readingLoad!==undefined)lines.push('Reading before the first move: '+rep.readingLoad+' of 900 characters.');
 if(rep.walks)lines.push('Played through the rules: '+Object.entries(rep.walks).filter(([,x])=>x).map(([k,x])=>k+' '+(x.ok?(x.ending?'"'+x.ending+'" ':'')+'in '+x.moves+' moves'+(x.seed!==1?' (seed '+x.seed+')':''):'did not finish')+(k==='golden'&&Number.isInteger(x.levelsGained)?', +'+plural(x.levelsGained,'level'):'')).join('; ')+'.');
 if(rep.balance)lines.push('Fights simulated (check 8): '+rep.balance.cells.length+' cells of '+rep.balance.fights+' fights each (node balance-check.cjs --tale prints them).');
 if(rep.walkTrace)for(const l of rep.walkTrace)lines.push('   '+String(l.move).padStart(3)+' '+l.kind.padEnd(6)+' '+l.text);
 lines.push('Libraries: '+Object.entries(rep.libraries).map(([k,v])=>k+' '+(v??'(not found)')).join('; '));
 lines.push(rep.ok?'Result: PASS'+(rep.warnings.length?' with '+plural(rep.warnings.length,'warning')+' (read them)':'')+'.':'Result: FAIL, '+plural(rep.errors.length,'error')+(rep.warnings.length?' and '+plural(rep.warnings.length,'warning'):'')+'. Fix the errors (x) and run the checker again.');
 return lines.join('\n');
}
function main(argv){
 const opts={},files=[];let json=false;
 for(let i=0;i<argv.length;i++){
  const a=argv[i];
  if(a==='--json')json=true;
  else if(a==='--walk'){if(!argv[i+1]){console.error('check-written-tale: --walk needs golden, passive, violent or an ending\'s id');return 1;}opts.walk=argv[++i];}
  else if(['--people','--creatures','--places','--shelf'].includes(a)){if(!argv[i+1]){console.error('check-written-tale: '+a+' needs a folder');return 1;}opts[a.slice(2)]=argv[++i];}
  else if(a==='--no-balance')opts.balance=false;
  else if(a==='--balance'){const n=Number(argv[i+1]);if(!Number.isInteger(n)||n<1){console.error('check-written-tale: --balance needs the number of fights a cell');return 1;}opts.balanceFights=n;i++;}
  else if(a==='--help'||a==='-h'){console.log('Usage: node check-written-tale.cjs <tale.json> [--json] [--people <dir>] [--creatures <dir>] [--places <dir>] [--shelf <dir>] [--balance <fights>] [--no-balance]');return 0;}
  else if(a.startsWith('--')){console.error('check-written-tale: unknown option '+a);return 1;}
  else files.push(a);
 }
 if(files.length!==1){console.error('Usage: node check-written-tale.cjs <tale.json> [--json] [--people <dir>] [--creatures <dir>] [--places <dir>] [--shelf <dir>]');return 1;}
 const rep=checkTale(files[0],opts);
 console.log(json?JSON.stringify(rep,null,1):textReport(rep));
 return rep.ok?0:1;
}
if(require.main===module)process.exitCode=main(process.argv.slice(2));
module.exports={checkTale,textReport,subclassNames,avoidNames,avoidWords,tiers,ruleTalk,stepKinds};
