import {templateKeys} from './encounterRules';
import {attitudeLevels} from './relationshipRules';
// ---------- Written tales: the staging format (WRITTEN-TALES.md) ----------
// A written tale (the Short, Medium and Long shelf, .questbound-written/<slug>.json) carries its plan in one optional
// story field, `staging`: per chapter the conditions the engine checks to close it (found), its beats, complications,
// pressure steps (the antagonist's clock), a set-piece fight and a choice; for the tale its stakes, the boss held back
// to its chapter (confrontFrom) and the endings the engine picks. Authors write places and people by their exact names;
// the game resolves them against the seated game (stagingIds). A small world state, `game.pace`, will track it (the
// runtime engine, withBeats and seatStaging, comes in the next step); validPace checks it already.
// This file is the one place the vocabularies live: the condition kinds, the effect kinds and the kinds of beat that
// can be due are data here, shared by the validators, the authoring checker (check-written-tale.cjs) and the runtime.
// Nothing at this file's top level reads another file's values (the rules load in one scope, in rules-files.cjs order).
export const writtenLengths=['short','medium','long'];
// Pacing by length (SPEC 1.1): quiet turns before the clock acts, and a pressure step every `drift` chapter moves.
export const stagingPacing={short:{quiet:3,drift:8},medium:{quiet:4,drift:10},long:{quiet:5,drift:12}};
// Conditions: each is an object with exactly one of these keys (WRITTEN-TALES.md, Conditions).
export const stagingConditionKinds=['reach','clear','won','searched','checked','spoke','met','with','fate','foe','carry','mark','flag','told','step','rest','days','any','all','not'];
// A chapter's find needs at least one route the engine settles from what happened (never from words alone).
export const stagingMechanical=['reach','clear','won','searched','checked','carry','with','foe'];
// Effects: a `then` object holds any of these keys, each at most once (WRITTEN-TALES.md, Effects).
export const stagingEffectKinds=['bring','send','arm','place','stake','give','attitude','offer','fact','lead','flag','decide','advance','end','boss'];
// The kinds of beat that can be due in game.pace.
export const paceDueKinds=['turn','opening','beat','complication','pressure','choice','ending','deadline','bloodied'];
export const stagingFates=['alive','dead','down','following','hostile'];
export const stagingFoeStates=['slain','subdued','beaten','fought'];
// A creature at a set piece's side, as for an errand (storyRules.js errandPlaces): one of these, never the same kind.
const stagingAllyKinds=['bandit','wolf','goblin','skeleton','boar','spider','orc'];
// Every limit of the format, in characters unless said otherwise.
export const stagingLimits={name:60,place:80,item:60,id:24,say:110,where:200,agenda:160,tell:240,line:160,beatTell:240,complication:160,pressureTell:200,sign:120,colour:140,colours:3,objective:160,threatName:60,appearance:400,ask:200,label:80,endingTitle:60,endingText:600,stakeName:60,stakeState:80,giveNote:160,memory:160,fact:200,placeText:300,bloodied:160,deadline:160,itemNote:160,
 beats:4,complications:3,pressureLeast:2,pressureMost:4,options:[2,3],endings:[2,4],stakes:4,leads:4,minions:2,places:12,routes:6,list:8,depth:4,flags:24,firstSay:3,spokeTimes:[1,6],steps:4,days:[1,30],deadlineTurns:[1,20]};
const stagingIdPattern=/^[a-z][a-z0-9-]{0,23}$/;
const stagingPlain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const stagingText=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const stagingInt=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
// The keys each kind of staging object may have (unknown keys are ignored by validStaging, so an older build accepts a
// newer tale; the authoring checker reports them, so a misspelt key is caught: stagingProblems(story,{strict:true})).
const stagingKeys={staging:['v','length','quiet','drift','confrontFrom','noBeyond','firstSay','stakes','places','chapters','leads','boss','endings'],
 chapter:['where','agenda','found','opening','then','beats','complications','pressure','fight','choice'],found:['any','item'],item:['name','note'],opening:['tell','line','then'],
 beat:['id','when','if','tell','line','then'],complication:['id','tell','line','then'],pressure:['id','tell','sign','line','then'],fight:['at','threat','objective','deadline'],
 threat:['template','name','appearance','ally'],creature:['template','name','appearance'],deadline:['turns','tell','then'],choice:['id','opens','ask','options','late'],option:['id','label','say','when','then'],
 stake:['id','name','state'],place:['colour'],lead:['id','opens','done'],boss:['minions','bloodied'],bloodied:['kind','tell','line'],ending:['id','title','if','text'],
 arm:['at','template','name','appearance','ally'],send:['who','to'],placeChange:['at','description','danger'],give:['name','note'],attitude:['who','to','memory'],spoke:['who','times'],with:['who','at'],fate:['who','is']};
// Names are compared without case, spacing or a leading "The" (an author may write "the Lower Stage" or "The Lower Stage").
export const stagingNameKey=name=>String(name??'').replace(/[’‘]/g,'\'').replace(/\s+/g,' ').trim().toLowerCase().replace(/^the /,'');
// What is wrong with a story's staging, as lines "path: problem" (empty when it is sound). `most` stops early (the game
// only needs to know whether it is sound); `strict` also reports keys the format does not know (the authoring checker).
export function stagingProblems(story,{most=Infinity,strict=false}={}){
 const out=[],L=stagingLimits;
 const bad=(path,problem)=>{if(out.length<most)out.push(path+': '+problem);};
 const s=story?.staging;
 if(!stagingPlain(s)){bad('staging','must be an object');return out;}
 const keysOf=(o,kind,path)=>{if(strict&&stagingPlain(o))for(const k of Object.keys(o))if(!stagingKeys[kind].includes(k))bad(path,'unknown key "'+k+'"');};
 const text=(v,max,path)=>{if(!stagingText(v,max))bad(path,typeof v==='string'&&v.length>max?'longer than '+max+' characters ('+v.length+')':'must be text of 1 to '+max+' characters');};
 const id=(v,path)=>{if(typeof v!=='string'||!stagingIdPattern.test(v))bad(path,'must be an id: a lower-case letter, then up to 23 letters, digits or hyphens');};
 const chapters=Array.isArray(s.chapters)?s.chapters:[],storyChapters=Array.isArray(story.chapters)?story.chapters:[],last=storyChapters.length-1;
 keysOf(s,'staging','staging');
 if(s.v!==1)bad('staging.v','must be 1');
 if(!writtenLengths.includes(s.length))bad('staging.length','must be one of '+writtenLengths.join(', '));
 if(s.quiet!==undefined&&!stagingInt(s.quiet,1,10))bad('staging.quiet','must be a whole number from 1 to 10');
 if(s.drift!==undefined&&!stagingInt(s.drift,4,30))bad('staging.drift','must be a whole number from 4 to 30');
 if(s.confrontFrom!==undefined&&!stagingInt(s.confrontFrom,1,Math.max(1,storyChapters.length)))bad('staging.confrontFrom','must be a chapter number from 1 to '+storyChapters.length);
 if(s.noBeyond!==undefined&&typeof s.noBeyond!=='boolean')bad('staging.noBeyond','must be true or false');
 if(s.firstSay!==undefined){if(!Array.isArray(s.firstSay)||s.firstSay.length<1||s.firstSay.length>L.firstSay)bad('staging.firstSay','must be 1 to '+L.firstSay+' lines');else s.firstSay.forEach((t,i)=>text(t,L.say,'staging.firstSay['+i+']'));}
 // Ids first, so that references can be checked against them.
 const stakes=Array.isArray(s.stakes)?s.stakes:[],stakeIds=new Set(),fireIds=new Set(),toldIds=new Set(),choices=new Map(),flags=new Set(['late']);
 if(s.stakes!==undefined&&(!Array.isArray(s.stakes)||s.stakes.length>L.stakes))bad('staging.stakes','must be a list of at most '+L.stakes);
 stakes.forEach((k,i)=>{const p='staging.stakes['+i+']';if(!stagingPlain(k)){bad(p,'must be an object');return;}keysOf(k,'stake',p);if(!/^s[1-4]$/.test(String(k.id))||stakeIds.has(k.id))bad(p+'.id','must be s1, s2, s3 or s4, each once');stakeIds.add(k.id);text(k.name,L.stakeName,p+'.name');text(k.state,L.stakeState,p+'.state');});
 const fire=(v,path)=>{id(v,path);if(fireIds.has(v))bad(path,'"'+v+'" is used twice: beat, complication, pressure, choice and ending ids are unique in a tale');fireIds.add(v);};
 chapters.forEach((c,i)=>{if(!stagingPlain(c))return;
  for(const [list,kind] of [[c.beats,'beats'],[c.complications,'complications'],[c.pressure,'pressure']])if(Array.isArray(list))list.forEach((b,j)=>{if(stagingPlain(b)){fire(b.id,'staging.chapters['+i+'].'+kind+'['+j+'].id');toldIds.add(b.id);}});
  if(stagingPlain(c.choice)){fire(c.choice.id,'staging.chapters['+i+'].choice.id');choices.set(c.choice.id,new Set((Array.isArray(c.choice.options)?c.choice.options:[]).map(o=>o?.id)));}
 });
 (Array.isArray(s.endings)?s.endings:[]).forEach((e,i)=>{if(stagingPlain(e))fire(e.id,'staging.endings['+i+'].id');});
 // Flags any effect sets (a {flag} condition must name one of them, or "late").
 const walkEffects=(then,visit)=>{if(stagingPlain(then))visit(then);};
 const allThens=[];
 chapters.forEach(c=>{if(!stagingPlain(c))return;allThens.push(c.then,c.opening?.then,c.fight?.deadline?.then);for(const list of [c.beats,c.complications,c.pressure])if(Array.isArray(list))for(const b of list)allThens.push(b?.then);if(Array.isArray(c.choice?.options))for(const o of c.choice.options)allThens.push(o?.then);});
 for(const t of allThens)walkEffects(t,e=>{if(typeof e.flag==='string')flags.add(e.flag);});
 const leadIds=new Set((Array.isArray(story.leads)?story.leads:[]).map(l=>l?.id));
 // A condition: exactly one known kind, its value of the right shape, nested at most `depth` deep.
 const condition=(c,path,depth=1)=>{
  if(!stagingPlain(c)||Object.keys(c).length!==1){bad(path,'a condition is an object with exactly one key');return;}
  const [kind,v]=Object.entries(c)[0];
  if(!stagingConditionKinds.includes(kind)){bad(path,'unknown condition "'+kind+'"');return;}
  const p=path+'.'+kind,place=()=>text(v,L.place,p),who=(w,q)=>text(w,L.name,q);
  if(['reach','clear','won','searched','checked'].includes(kind))place();
  else if(kind==='met')who(v,p);
  else if(kind==='carry')text(v,L.item,p);
  else if(kind==='spoke'){if(!stagingPlain(v)){bad(p,'must be {"who": name, "times": n}');return;}keysOf(v,'spoke',p);who(v.who,p+'.who');if(v.times!==undefined&&!stagingInt(v.times,...L.spokeTimes))bad(p+'.times','must be a whole number from '+L.spokeTimes.join(' to '));}
  else if(kind==='with'){if(!stagingPlain(v)){bad(p,'must be {"who": name} or {"who": name, "at": place}');return;}keysOf(v,'with',p);who(v.who,p+'.who');if(v.at!==undefined)text(v.at,L.place,p+'.at');}
  else if(kind==='fate'){if(!stagingPlain(v)){bad(p,'must be {"who": name, "is": state}');return;}keysOf(v,'fate',p);who(v.who,p+'.who');if(!stagingFates.includes(v.is))bad(p+'.is','must be one of '+stagingFates.join(', '));}
  else if(kind==='foe'){if(!stagingFoeStates.includes(v))bad(p,'must be one of '+stagingFoeStates.join(', '));}
  else if(kind==='mark'){if(!stagingPlain(v)||Object.keys(v).length!==1){bad(p,'must be {"<choice id>": "<option id>"}');return;}const [ch,op]=Object.entries(v)[0];if(!choices.has(ch))bad(p,'names no choice of this tale ("'+ch+'")');else if(!choices.get(ch).has(op))bad(p,'choice "'+ch+'" has no option "'+op+'"');}
  else if(kind==='flag'){id(v,p);if(typeof v==='string'&&!flags.has(v))bad(p,'no effect sets the flag "'+v+'"');}
  else if(kind==='told'){id(v,p);if(typeof v==='string'&&!toldIds.has(v))bad(p,'names no beat, complication or pressure step of this tale ("'+v+'")');}
  else if(kind==='step'){if(!stagingInt(v,1,L.steps))bad(p,'must be a whole number from 1 to '+L.steps);}
  else if(kind==='rest'){if(v!==true)bad(p,'must be true');}
  else if(kind==='days'){if(!stagingInt(v,...L.days))bad(p,'must be a whole number from '+L.days.join(' to '));}
  else if(kind==='any'||kind==='all'){if(!Array.isArray(v)||v.length<1||v.length>L.list){bad(p,'must be a list of 1 to '+L.list+' conditions');return;}if(depth>=L.depth){bad(p,'conditions nest at most '+L.depth+' deep');return;}v.forEach((x,i)=>condition(x,p+'['+i+']',depth+1));}
  else if(kind==='not'){if(depth>=L.depth){bad(p,'conditions nest at most '+L.depth+' deep');return;}condition(v,p,depth+1);}
 };
 const optionalCondition=(c,path)=>{if(c!==undefined&&c!==null)condition(c,path);};
 const creature=(t,path,kind)=>{
  if(!stagingPlain(t)){bad(path,'must be {"template", "name", "appearance"'+(kind==='threat'?', "ally"':'')+'}');return;}
  keysOf(t,kind,path);
  if(!templateKeys.includes(t.template))bad(path+'.template','must be one of '+templateKeys.join(', '));
  text(t.name,L.threatName,path+'.name');text(t.appearance,L.appearance,path+'.appearance');
  if(kind!=='creature'&&t.ally!==undefined&&t.ally!==null){
   const a=t.ally;if(!stagingPlain(a)){bad(path+'.ally','must be null or {"template", "name", "appearance"}');return;}
   keysOf(a,'creature',path+'.ally');
   if(!stagingAllyKinds.includes(a.template))bad(path+'.ally.template','must be one of '+stagingAllyKinds.join(', ')+' (a single creature)');
   else if(a.template===t.template)bad(path+'.ally.template','must be a different kind from the threat it stands beside');
   text(a.name,L.threatName,path+'.ally.name');text(a.appearance,L.appearance,path+'.ally.appearance');
  }
 };
 // Effects: `where` says what may close the chapter or tale from here (advance or end).
 const effects=(then,path,{closes=false,lastChapter=false}={})=>{
  if(then===undefined||then===null)return;
  if(!stagingPlain(then)){bad(path,'must be an object of effects');return;}
  for(const [kind,v] of Object.entries(then)){
   const p=path+'.'+kind;
   if(!stagingEffectKinds.includes(kind)){bad(p,'unknown effect "'+kind+'"');continue;}
   if(kind==='bring'||kind==='offer')text(v,L.name,p);
   else if(kind==='send'){if(!stagingPlain(v)){bad(p,'must be {"who": name, "to": place}');continue;}keysOf(v,'send',p);text(v.who,L.name,p+'.who');text(v.to,L.place,p+'.to');}
   else if(kind==='arm'){if(!stagingPlain(v)){bad(p,'must be {"at", "template", "name", "appearance", "ally"}');continue;}text(v.at,L.place,p+'.at');const {at,...threat}=v;keysOf(v,'arm',p);creature(threat,p,'threat');}
   else if(kind==='place'){if(!stagingPlain(v)){bad(p,'must be {"at": place, "description"?, "danger"?}');continue;}keysOf(v,'placeChange',p);text(v.at,L.place,p+'.at');if(v.description===undefined&&v.danger===undefined)bad(p,'changes nothing: give a description, a danger or both');if(v.description!==undefined)text(v.description,L.placeText,p+'.description');if(v.danger!==undefined&&!['safe','risky'].includes(v.danger))bad(p+'.danger','must be safe or risky');}
   else if(kind==='stake'){if(!stagingPlain(v)||!Object.keys(v).length){bad(p,'must be {"s1": "new state"}');continue;}for(const [k,state] of Object.entries(v)){if(!stakeIds.has(k))bad(p,'names no stake of this tale ("'+k+'")');text(state,L.stakeState,p+'.'+k);}}
   else if(kind==='give'){if(!stagingPlain(v)){bad(p,'must be {"name", "note"}');continue;}keysOf(v,'give',p);text(v.name,L.item,p+'.name');text(v.note,L.giveNote,p+'.note');}
   else if(kind==='attitude'){if(!stagingPlain(v)){bad(p,'must be {"who", "to", "memory"}');continue;}keysOf(v,'attitude',p);text(v.who,L.name,p+'.who');if(!attitudeLevels.includes(v.to))bad(p+'.to','must be one of '+attitudeLevels.join(', '));text(v.memory,L.memory,p+'.memory');}
   else if(kind==='fact')text(v,L.fact,p);
   else if(kind==='lead'){if(!stagingPlain(v)||Object.keys(v).length!==1||!['open','close'].includes(Object.keys(v)[0])){bad(p,'must be {"open": "l1"} or {"close": "l1"}');continue;}const l=Object.values(v)[0];if(!leadIds.has(l))bad(p,'names no lead of this tale ("'+l+'")');}
   else if(kind==='flag'){id(v,p);if(v==='late')bad(p,'"late" is set by {"end": "late"} only');}
   else if(kind==='decide'){if(!stagingPlain(v)||Object.keys(v).length!==1){bad(p,'must be {"<choice id>": "<option id>"}');continue;}const [ch,op]=Object.entries(v)[0];if(!choices.has(ch))bad(p,'names no choice of this tale ("'+ch+'")');else if(!choices.get(ch).has(op))bad(p,'choice "'+ch+'" has no option "'+op+'"');}
   else if(kind==='advance'){if(v!==true)bad(p,'must be true');else if(!closes)bad(p,'may not close the chapter here');else if(lastChapter)bad(p,'the last chapter closes with {"end": "late"}, not advance');}
   else if(kind==='end'){if(v!=='late')bad(p,'must be "late"');else if(!closes)bad(p,'may not end the tale here');else if(!lastChapter)bad(p,'only the last chapter may end the tale');}
   else if(kind==='boss'){if(!stagingPlain(v)||Object.keys(v).length!==1||!((v.minions===false)||(v.hurt===true)))bad(p,'must be {"minions": false} or {"hurt": true}');}
  }
 };
 // The chapters: exactly one for each of the story's chapters, in the same order.
 if(!Array.isArray(s.chapters)||s.chapters.length!==storyChapters.length||storyChapters.length<2)bad('staging.chapters','must have exactly one entry for each of the story\'s chapters ('+storyChapters.length+')');
 chapters.forEach((c,i)=>{
  const p='staging.chapters['+i+']',lastChapter=i===last;
  if(!stagingPlain(c)){bad(p,'must be an object');return;}
  keysOf(c,'chapter',p);
  text(c.where,L.where,p+'.where');text(c.agenda,L.agenda,p+'.agenda');
  if(!stagingPlain(c.found)||!Array.isArray(c.found.any)||c.found.any.length<1||c.found.any.length>L.routes)bad(p+'.found','must be {"any": [1 to '+L.routes+' conditions]}');
  else{keysOf(c.found,'found',p+'.found');c.found.any.forEach((x,j)=>condition(x,p+'.found.any['+j+']'));
   if(c.found.item!==undefined){if(!stagingPlain(c.found.item))bad(p+'.found.item','must be {"name", "note"}');else{keysOf(c.found.item,'item',p+'.found.item');text(c.found.item.name,L.item,p+'.found.item.name');text(c.found.item.note,L.itemNote,p+'.found.item.note');}}}
  if(c.opening!==undefined){
   if(i===0)bad(p+'.opening','the first chapter has no opening: the tale\'s own opening is its start');
   else if(!stagingPlain(c.opening))bad(p+'.opening','must be {"tell", "line", "then"?}');
   else{keysOf(c.opening,'opening',p+'.opening');text(c.opening.tell,L.tell,p+'.opening.tell');text(c.opening.line,L.line,p+'.opening.line');effects(c.opening.then,p+'.opening.then');}
  }
  effects(c.then,p+'.then');
  const listOf=(v,most,least,path)=>{if(v===undefined&&least===0)return [];if(!Array.isArray(v)||v.length<least||v.length>most){bad(path,'must be a list of '+least+' to '+most);return Array.isArray(v)?v:[];}return v;};
  listOf(c.beats,L.beats,0,p+'.beats').forEach((b,j)=>{const q=p+'.beats['+j+']';if(!stagingPlain(b)){bad(q,'must be an object');return;}keysOf(b,'beat',q);condition(b.when,q+'.when');optionalCondition(b.if,q+'.if');text(b.tell,L.beatTell,q+'.tell');text(b.line,L.line,q+'.line');effects(b.then,q+'.then',{closes:true,lastChapter});});
  listOf(c.complications,L.complications,0,p+'.complications').forEach((b,j)=>{const q=p+'.complications['+j+']';if(!stagingPlain(b)){bad(q,'must be an object');return;}keysOf(b,'complication',q);text(b.tell,L.complication,q+'.tell');text(b.line,L.line,q+'.line');effects(b.then,q+'.then',{closes:true,lastChapter});});
  const pressure=listOf(c.pressure,L.pressureMost,L.pressureLeast,p+'.pressure');
  pressure.forEach((b,j)=>{const q=p+'.pressure['+j+']';if(!stagingPlain(b)){bad(q,'must be an object');return;}keysOf(b,'pressure',q);text(b.tell,L.pressureTell,q+'.tell');text(b.sign,L.sign,q+'.sign');text(b.line,L.line,q+'.line');effects(b.then,q+'.then',{closes:true,lastChapter});});
  // The clock always moves the tale on: its last step closes the chapter (or, in the last chapter, ends the tale late).
  const closing=pressure[pressure.length-1]?.then;
  if(pressure.length&&!(lastChapter?closing?.end==='late':closing?.advance===true))bad(p+'.pressure['+(pressure.length-1)+'].then',lastChapter?'the last chapter\'s last pressure step must end the tale: {"end": "late"}':'the last pressure step must close the chapter: {"advance": true}');
  if(c.fight!==undefined){const f=c.fight,q=p+'.fight';
   if(!stagingPlain(f))bad(q,'must be {"at", "threat", "objective", "deadline"?}');
   else{keysOf(f,'fight',q);text(f.at,L.place,q+'.at');creature(f.threat,q+'.threat','threat');text(f.objective,L.objective,q+'.objective');
    if(f.deadline!==undefined){const d=f.deadline;if(!stagingPlain(d))bad(q+'.deadline','must be {"turns", "tell", "then"?}');else{keysOf(d,'deadline',q+'.deadline');if(!stagingInt(d.turns,...L.deadlineTurns))bad(q+'.deadline.turns','must be a whole number from '+L.deadlineTurns.join(' to '));text(d.tell,L.deadline,q+'.deadline.tell');effects(d.then,q+'.deadline.then',{closes:true,lastChapter});}}}}
  if(c.choice!==undefined){const ch=c.choice,q=p+'.choice';
   if(!stagingPlain(ch))bad(q,'must be {"id", "opens", "ask", "options", "late"?}');
   else{keysOf(ch,'choice',q);optionalCondition(ch.opens,q+'.opens');text(ch.ask,L.ask,q+'.ask');
    const options=listOf(ch.options,L.options[1],L.options[0],q+'.options'),seen=new Set();
    options.forEach((o,j)=>{const r=q+'.options['+j+']';if(!stagingPlain(o)){bad(r,'must be an object');return;}keysOf(o,'option',r);id(o.id,r+'.id');if(seen.has(o.id))bad(r+'.id','"'+o.id+'" is used twice in this choice');seen.add(o.id);text(o.label,L.label,r+'.label');text(o.say,L.say,r+'.say');optionalCondition(o.when,r+'.when');effects(o.then,r+'.then',{closes:true,lastChapter});});
    if(ch.late!==undefined&&!seen.has(ch.late))bad(q+'.late','must be the id of one of this choice\'s options');}}
 });
 // The tale's leads (story.leads, l1 to l4): when each opens and the condition that closes it.
 if(s.leads!==undefined){const seen=new Set();
  if(!Array.isArray(s.leads)||s.leads.length>L.leads)bad('staging.leads','must be a list of at most '+L.leads);
  else s.leads.forEach((l,i)=>{const p='staging.leads['+i+']';if(!stagingPlain(l)){bad(p,'must be an object');return;}keysOf(l,'lead',p);if(!leadIds.has(l.id)||seen.has(l.id))bad(p+'.id','must name one of the story\'s leads (l1 for its first), each once');seen.add(l.id);if(l.opens!==undefined&&!stagingInt(l.opens,1,Math.max(1,storyChapters.length)))bad(p+'.opens','must be a chapter number from 1 to '+storyChapters.length);condition(l.done,p+'.done');});}
 if(s.boss!==undefined){const b=s.boss;
  if(!stagingPlain(b))bad('staging.boss','must be {"minions"?, "bloodied"?}');
  else{keysOf(b,'boss','staging.boss');
   if(b.minions!==undefined){if(!Array.isArray(b.minions)||b.minions.length>L.minions)bad('staging.boss.minions','must be a list of at most '+L.minions);else b.minions.forEach((m,i)=>creature(m,'staging.boss.minions['+i+']','creature'));}
   if(b.bloodied!==undefined){const d=b.bloodied;if(!stagingPlain(d))bad('staging.boss.bloodied','must be {"kind", "tell", "line"}');else{keysOf(d,'bloodied','staging.boss.bloodied');if(!['call','flee','rage'].includes(d.kind))bad('staging.boss.bloodied.kind','must be call, flee or rage');text(d.tell,L.bloodied,'staging.boss.bloodied.tell');text(d.line,L.line,'staging.boss.bloodied.line');}}}}
 // Endings: 2 to 4; the engine takes the first whose condition holds, so the last has none (the default).
 const endings=Array.isArray(s.endings)?s.endings:[];
 if(!Array.isArray(s.endings)||endings.length<L.endings[0]||endings.length>L.endings[1])bad('staging.endings','must be a list of '+L.endings.join(' to '));
 endings.forEach((e,i)=>{const p='staging.endings['+i+']';if(!stagingPlain(e)){bad(p,'must be an object');return;}keysOf(e,'ending',p);text(e.title,L.endingTitle,p+'.title');text(e.text,L.endingText,p+'.text');
  if(i===endings.length-1){if(e.if!==undefined&&e.if!==null)bad(p+'.if','the last ending is the default: it has no "if"');}
  else if(e.if===undefined||e.if===null)bad(p+'.if','every ending but the last needs an "if"');else condition(e.if,p+'.if');});
 if(s.places!==undefined){
  if(!stagingPlain(s.places)||Object.keys(s.places).length>L.places)bad('staging.places','must be an object of at most '+L.places+' places');
  else for(const [name,v] of Object.entries(s.places)){const p='staging.places["'+name+'"]';if(!stagingText(name,L.place))bad(p,'a place name of 1 to '+L.place+' characters');if(!stagingPlain(v)||!Array.isArray(v.colour)||v.colour.length<1||v.colour.length>L.colours){bad(p,'must be {"colour": [1 to '+L.colours+' lines]}');continue;}keysOf(v,'place',p);v.colour.forEach((t,i)=>text(t,L.colour,p+'.colour['+i+']'));}
 }
 if(flags.size>L.flags)bad('staging','sets more than '+L.flags+' flags');
 return out;
}
// The validator story.staging must pass (storyRules.js validStory): one staging chapter per story chapter, every id
// unique, every limit kept, every condition and effect of a known kind, each chapter's last pressure step closing it
// (the last chapter's ending the tale late), and two to four endings with a final default.
export const validStaging=story=>stagingProblems(story,{most:1}).length===0;
// The tag a written tale's copy carries (written-shelf.cjs start: the tale it came from, its edition and length).
export function validWrittenTag(w){
 return stagingPlain(w)&&typeof w.slug==='string'&&/^[a-z0-9-]{3,28}$/.test(w.slug)&&stagingInt(w.edition,1,999)&&writtenLengths.includes(w.length);
}
// game.pace: where the written tale stands (world state, shared at a table, never a hero field). Every key the format
// names must be there and sound; keys it does not know are ignored, so a game saved by a later build still loads.
export function validPace(p,game){
 const st=game?.story?.staging;
 if(!stagingPlain(p)||!stagingPlain(st)||!Array.isArray(st.chapters))return false;
 const ids=list=>Array.isArray(list)&&list.length<=80&&new Set(list).size===list.length&&list.every(x=>typeof x==='string'&&/^[a-z][a-z0-9:-]{0,31}$/.test(x));
 const choices=new Map((st.chapters??[]).filter(c=>stagingPlain(c?.choice)).map(c=>[c.choice.id,(c.choice.options??[]).map(o=>o?.id)]));
 const stakes=new Set((st.stakes??[]).map(k=>k?.id)),endings=(st.endings??[]).map(e=>e?.id);
 return p.v===1&&stagingInt(p.ch,0,st.chapters.length-1)&&stagingInt(p.turns,0,1e6)&&stagingInt(p.quiet,0,1e6)&&stagingInt(p.since,0,1e6)&&stagingInt(p.step,0,stagingLimits.pressureMost)&&stagingInt(p.owed,0,20)&&stagingInt(p.day,0,1e6)&&stagingInt(p.quietMax,0,1e6)
  &&(p.due===null||(stagingPlain(p.due)&&paceDueKinds.includes(p.due.kind)&&(p.due.id===undefined||(typeof p.due.id==='string'&&/^[a-z][a-z0-9:-]{0,31}$/.test(p.due.id)))))
  &&ids(p.told)&&ids(p.fired)
  &&stagingPlain(p.marks)&&Object.entries(p.marks).every(([c,o])=>choices.has(c)&&choices.get(c).includes(o))
  &&Array.isArray(p.flags)&&p.flags.length<=stagingLimits.flags&&new Set(p.flags).size===p.flags.length&&p.flags.every(f=>typeof f==='string'&&stagingIdPattern.test(f))
  &&stagingPlain(p.stakes)&&Object.entries(p.stakes).every(([k,v])=>stakes.has(k)&&stagingText(v,stagingLimits.stakeState))
  &&stagingPlain(p.spoke)&&Object.keys(p.spoke).length<=100&&Object.entries(p.spoke).every(([k,v])=>/^(?:keeper|mara|n(?:[1-9]|[1-8]\d|9[0-6]))$/.test(k)&&stagingInt(v,0,999))
  &&(p.sign===null||stagingText(p.sign,stagingLimits.sign))
  &&(p.fight===null||(stagingPlain(p.fight)&&stagingInt(p.fight.turns,0,999)))
  &&(p.ending===null||endings.includes(p.ending));
}
// Every name a staging uses, with what kind of thing it names and where: {kind: 'place'|'person'|'item', name, path}.
export function stagingNamesUsed(staging){
 const list=v=>Array.isArray(v)?v:[],out=[],add=(kind,name,path)=>{if(typeof name==='string'&&name.trim())out.push({kind,name,path});};
 const condition=(c,path)=>{
  if(!stagingPlain(c))return;
  for(const [kind,v] of Object.entries(c)){
   const p=path+'.'+kind;
   if(['reach','clear','won','searched','checked'].includes(kind))add('place',v,p);
   else if(kind==='met')add('person',v,p);
   else if(kind==='carry')add('item',v,p);
   else if(kind==='spoke'||kind==='fate')add('person',v?.who,p+'.who');
   else if(kind==='with'){add('person',v?.who,p+'.who');add('place',v?.at,p+'.at');}
   else if(kind==='any'||kind==='all'){list(v).forEach((x,i)=>condition(x,p+'['+i+']'));}
   else if(kind==='not')condition(v,p);
  }
 };
 const effects=(then,path)=>{
  if(!stagingPlain(then))return;
  for(const [kind,v] of Object.entries(then)){
   const p=path+'.'+kind;
   if(kind==='bring'||kind==='offer')add('person',v,p);
   else if(kind==='send'){add('person',v?.who,p+'.who');add('place',v?.to,p+'.to');}
   else if(kind==='arm'||kind==='place')add('place',v?.at,p+'.at');
   else if(kind==='attitude')add('person',v?.who,p+'.who');
   else if(kind==='give')add('item',v?.name,p+'.name');
  }
 };
 if(!stagingPlain(staging))return out;
 for(const name of Object.keys(stagingPlain(staging.places)?staging.places:{}))add('place',name,'staging.places["'+name+'"]');
 list(staging.chapters).forEach((c,i)=>{
  if(!stagingPlain(c))return;const p='staging.chapters['+i+']';
  list(c.found?.any).forEach((x,j)=>condition(x,p+'.found.any['+j+']'));
  if(c.found?.item)add('item',c.found.item.name,p+'.found.item.name');
  effects(c.opening?.then,p+'.opening.then');effects(c.then,p+'.then');
  for(const kind of ['beats','complications','pressure'])list(c[kind]).forEach((b,j)=>{condition(b?.when,p+'.'+kind+'['+j+'].when');condition(b?.if,p+'.'+kind+'['+j+'].if');effects(b?.then,p+'.'+kind+'['+j+'].then');});
  if(c.fight){add('place',c.fight.at,p+'.fight.at');effects(c.fight.deadline?.then,p+'.fight.deadline.then');}
  if(c.choice){condition(c.choice.opens,p+'.choice.opens');list(c.choice.options).forEach((o,j)=>{condition(o?.when,p+'.choice.options['+j+'].when');effects(o?.then,p+'.choice.options['+j+'].then');});}
 });
 list(staging.leads).forEach((l,i)=>condition(l?.done,'staging.leads['+i+'].done'));
 list(staging.endings).forEach((e,i)=>condition(e?.if,'staging.endings['+i+'].if'));
 return out;
}
// The names a tale's staging uses, resolved for a seated game: places to 'inn', 'bridge', 'tower' or a world place id
// (p1…), people to 'keeper', 'mara' or a person id (n1…). Worked out once and kept while the story, the world and the
// people stay the same objects (like mapRules.js routeMemo). An unknown name resolves to null.
const stagingIdMemo=new WeakMap();
export function stagingIds(game){
 const story=game?.story;
 if(!stagingPlain(story))return {place:()=>null,person:()=>null};
 let m=stagingIdMemo.get(story);
 if(!m||m.world!==game.world||m.people!==game.people){
  const places=new Map(),people=new Map(),put=(map,name,id)=>{const k=stagingNameKey(name);if(k&&!map.has(k))map.set(k,id);};
  for(const id of ['inn','bridge','tower'])put(places,story.locations?.[id]?.name,id);
  for(const p of Array.isArray(game.world?.places)?game.world.places:[])if(p&&typeof p.id==='string')put(places,p.name,p.id);
  for(const id of ['keeper','mara'])put(people,story.npcs?.[id]?.name,id);
  for(const [id,p] of Object.entries(game.people??{}))put(people,p?.name,id);
  m={world:game.world,people:game.people,places,byName:people};
  stagingIdMemo.set(story,m);
 }
 const memo=m;
 return {place:name=>memo.places.get(stagingNameKey(name))??null,person:name=>memo.byName.get(stagingNameKey(name))??null};
}
