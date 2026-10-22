import {templateKeys,allyTemplates,scaledFoe} from './encounterRules';
import {attitudeLevels} from './relationshipRules';
import {isPersonId,metPerson} from './npcRules';
import {mapLocation,mapState,worldPlaces} from './mapRules';
// ---------- Written tales: the staging format (WRITTEN-TALES.md) ----------
// A written tale (the Short, Medium and Long shelf, .questbound-written/<slug>.json) carries its plan in one optional
// story field, `staging`: per chapter the conditions the engine checks to close it (found), its beats, complications,
// pressure steps (the antagonist's clock), a set-piece fight and a choice; for the tale its stakes, the boss held back
// to its chapter (confrontFrom) and the endings the engine picks. Authors write places and people by their exact names;
// the game resolves them against the seated game (stagingIds). A small world state, `game.pace`, tracks it (the
// runtime engine, withBeats and seatStaging, comes in the next step); validPace checks it already, and beatHolds says
// whether a condition holds (the checker uses it on the seated game today; withBeats will use it every turn).
// Two levels of checking:
// - validStaging (every save, every table snapshot, every build): structure and size only. A kind of condition,
//   effect or due beat this build does not know is accepted (a condition using one never holds, an effect of one does
//   nothing, an unknown due kind means nothing is due), and staging `v` may be any whole number from 1, so a tale or a
//   save written by a later build still loads on an older device, an open tab or a campaign server not yet restarted.
// - stagingProblems(story,{strict:true}) (the authoring checker, check-written-tale.cjs): the whole vocabulary, every
//   authoring limit, every reference and every unknown key.
// A later version only adds kinds and keys: it never changes what an existing one means, never removes a pace key,
// and never changes the shape of an id.
// This file is the one place the vocabularies live: the condition kinds, the effect kinds and the kinds of beat that
// can be due are data here, shared by the validators, the authoring checker and the runtime.
// Nothing at this file's top level reads another file's values (the rules load in one scope, in rules-files.cjs order).
export const stagingVersion=1;
export const writtenLengths=['short','medium','long'];
// Pacing by length (SPEC 1.1): quiet turns before the clock acts, and a pressure step every `drift` chapter moves.
export const stagingPacing={short:{quiet:3,drift:8},medium:{quiet:4,drift:10},long:{quiet:5,drift:12}};
// What ticks the clock besides drift and quiet (staging.ticks): a long rest only when the tale says so (a hard tale
// always does: its card promises it), and each day of the tale's time that passes (on the road or resting) owes this
// many steps.
export const stagingTicks={rest:false,days:1};
// Conditions: each is an object with exactly one of these keys (WRITTEN-TALES.md, Conditions).
export const stagingConditionKinds=['reach','at','clear','won','searched','checked','spoke','met','with','fate','foe','carry','mark','flag','told','step','rest','days','level','any','all','not'];
// Events: they hold once they have happened since the chapter began (game.pace.seen keeps them for the chapter), so
// a beat, a choice or a route that waits for its turn never loses its moment.
export const stagingEvents=['reach','won','searched','checked','rest'];
// A chapter's find needs at least one route the engine settles from what happened (never from words alone).
export const stagingMechanical=['reach','at','clear','won','searched','checked','carry','with','foe'];
// Effects: a `then` object holds any of these keys, each at most once (WRITTEN-TALES.md, Effects).
export const stagingEffectKinds=['bring','send','arm','place','stake','give','attitude','offer','fact','lead','flag','decide','clock','advance','end','boss'];
// The kinds of beat that can be due in game.pace.
export const paceDueKinds=['turn','opening','beat','complication','pressure','choice','ending','deadline','hold','bloodied'];
export const stagingFates=['alive','dead','down','following','hostile'];
export const stagingFoeStates=['slain','subdued','beaten','fought','bloodied'];
// Every authoring limit of the format (the checker's), in characters unless said otherwise.
export const stagingLimits={name:60,place:80,item:60,id:24,say:110,where:200,agenda:160,tell:240,line:160,beatTell:240,complication:160,pressureTell:200,sign:120,colour:140,colours:3,objective:160,threatName:60,appearance:400,ask:200,label:80,endingTitle:60,endingText:600,stakeName:60,stakeState:80,giveNote:160,memory:160,fact:200,placeText:300,bloodied:160,deadline:160,itemNote:160,
 beats:4,complications:3,pressureLeast:2,pressureMost:4,options:[2,4],endings:[2,4],stakes:4,leads:4,minions:2,places:12,routes:6,list:8,depth:4,leaves:12,flags:24,firstSay:3,spokeTimes:[1,6],steps:4,days:[1,30],levels:[1,20],deadlineTurns:[1,20],holdRounds:[1,10],quiet:[1,10],drift:[4,30],tickDays:[0,2]};
// What every build accepts (validStaging): structure and size only. The JSON of a staging is at most `size`
// characters (a long tale is written within 48,000: the checker's tier limits).
export const stagingHardLimits={text:1000,list:16,keys:32,places:24,depth:6,leaves:32,size:64000,number:999};
const stagingIdPattern=/^[a-z][a-z0-9-]{0,23}$/;
// Ids the engine writes into game.pace: an id, or a kind and an id ("reach:p3", "found:1").
const paceIdPattern=/^[a-z][a-z0-9:-]{0,31}$/;
const stagingPlain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const stagingText=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const stagingInt=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
// A value an older build only carries (a later build may give it a shape this one does not know): small plain JSON.
const stagingSmall=(v,depth=0)=>v===null||typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v))||(typeof v==='string'&&v.length<=stagingHardLimits.text)||(depth<6&&Array.isArray(v)&&v.length<=stagingHardLimits.list&&v.every(x=>stagingSmall(x,depth+1)))||(depth<6&&stagingPlain(v)&&Object.keys(v).length<=stagingHardLimits.keys&&Object.values(v).every(x=>stagingSmall(x,depth+1)));
// The keys each kind of staging object may have (unknown keys are ignored by validStaging, so an older build accepts a
// newer tale; the authoring checker reports them, so a misspelt key is caught: stagingProblems(story,{strict:true})).
const stagingKeys={staging:['v','length','quiet','drift','ticks','confrontFrom','noBeyond','firstSay','stakes','places','chapters','leads','boss','endings'],ticks:['rest','days'],
 chapter:['where','agenda','found','opening','then','beats','complications','pressure','fight','choice'],found:['any','item'],item:['name','note'],opening:['tell','line','then'],
 beat:['id','when','if','tell','line','then'],complication:['id','if','tell','line','then'],pressure:['id','if','tell','sign','line','then','spared'],spared:['tell','line','sign'],
 fight:['at','threat','objective','fromLevel','otherwise','deadline','hold'],threat:['template','name','appearance','ally'],creature:['template','name','appearance'],deadline:['turns','tell','then'],hold:['rounds','tell','then'],
 choice:['id','opens','ask','options','late'],option:['id','label','say','if','when','then'],
 stake:['id','name','state'],place:['colour'],lead:['id','opens','done'],boss:['if','objective','minions','bloodied','deadline','hold'],bloodied:['kind','tell','line'],ending:['id','title','if','text'],
 arm:['at','template','name','appearance','ally','fromLevel','otherwise'],send:['who','to'],placeChange:['at','description','danger'],give:['name','note'],attitude:['who','to','memory'],spoke:['who','times'],with:['who','at'],fate:['who','is']};
// Names are compared without case, spacing or a leading "The" (an author may write "the Lower Stage" or "The Lower Stage").
export const stagingNameKey=name=>String(name??'').replace(/[’‘]/g,'\'').replace(/\s+/g,' ').trim().toLowerCase().replace(/^the /,'');
// How many plain conditions a condition holds (any, all and not count what is inside them); past any depth a build
// accepts, more than any build accepts.
export const stagingLeaves=(c,depth=0)=>{if(depth>stagingHardLimits.depth)return Infinity;if(!stagingPlain(c))return 1;const [k,v]=Object.entries(c)[0]??[];if((k==='any'||k==='all')&&Array.isArray(v))return v.reduce((n,x)=>n+stagingLeaves(x,depth+1),0);if(k==='not')return stagingLeaves(v,depth+1);return 1;};
// What is wrong with a story's staging, as lines "path: problem" (empty when it is sound). `most` stops early (the game
// only needs to know whether it is sound); `strict` is the authoring checker's mode: the whole vocabulary, the authoring
// limits, every reference and unknown keys. Without it only structure and size are checked (see the top of the file).
export function stagingProblems(story,{most=Infinity,strict=false}={}){
 const out=[],L=stagingLimits,H=stagingHardLimits;
 const bad=(path,problem)=>{if(out.length<most)out.push(path+': '+problem);};
 const s=story?.staging;
 if(!stagingPlain(s)){bad('staging','must be an object');return out;}
 // Its size first: a staging is read with every save and table snapshot.
 let size=0;try{size=JSON.stringify(s).length;}catch{bad('staging','must be plain JSON');return out;}
 if(size>H.size){bad('staging','is '+size+' characters of JSON: at most '+H.size);return out;}
 const keysOf=(o,kind,path)=>{if(strict&&stagingPlain(o))for(const k of Object.keys(o))if(!stagingKeys[kind].includes(k))bad(path,'unknown key "'+k+'"');};
 const text=(v,max,path)=>{const m=strict?max:H.text;if(!strict&&v===undefined)return;if(!stagingText(v,m))bad(path,typeof v==='string'&&v.length>m?'longer than '+m+' characters ('+v.length+')':'must be text of 1 to '+m+' characters');};
 const id=(v,path)=>{if(typeof v!=='string'||!stagingIdPattern.test(v))bad(path,'must be an id: a lower-case letter, then up to 23 letters, digits or hyphens');};
 // A list: the authoring bounds when strict, else at most the hard limit (and at least `need`).
 const listOf=(v,least,most_,path,need=0)=>{const lo=strict?least:need,hi=strict?most_:H.list;if(v===undefined&&lo===0)return [];if(!Array.isArray(v)||v.length<lo||v.length>hi){bad(path,'must be a list of '+lo+' to '+hi);return Array.isArray(v)?v.slice(0,H.list):[];}return v;};
 const small=(v,path)=>{if(!stagingSmall(v))bad(path,'must be small plain JSON');};
 const chapters=Array.isArray(s.chapters)?s.chapters:[],storyChapters=Array.isArray(story.chapters)?story.chapters:[],last=storyChapters.length-1;
 keysOf(s,'staging','staging');
 if(strict?s.v!==stagingVersion:!stagingInt(s.v,1,H.number))bad('staging.v',strict?'must be '+stagingVersion:'must be a whole number from 1');
 if(strict?!writtenLengths.includes(s.length):!(typeof s.length==='string'&&stagingIdPattern.test(s.length)))bad('staging.length','must be one of '+writtenLengths.join(', '));
 if(s.quiet!==undefined&&!stagingInt(s.quiet,...(strict?L.quiet:[1,99])))bad('staging.quiet','must be a whole number from '+(strict?L.quiet.join(' to '):'1 to 99'));
 if(s.drift!==undefined&&!stagingInt(s.drift,...(strict?L.drift:[1,99])))bad('staging.drift','must be a whole number from '+(strict?L.drift.join(' to '):'1 to 99'));
 if(s.ticks!==undefined){if(!stagingPlain(s.ticks))bad('staging.ticks','must be {"rest": true|false, "days": 0, 1 or 2}');else if(!strict)small(s.ticks,'staging.ticks');else{keysOf(s.ticks,'ticks','staging.ticks');if(s.ticks.rest!==undefined&&typeof s.ticks.rest!=='boolean')bad('staging.ticks.rest','must be true or false');if(s.ticks.days!==undefined&&!stagingInt(s.ticks.days,...L.tickDays))bad('staging.ticks.days','must be 0, 1 or 2 (steps owed for each day of the tale\'s time)');}}
 if(s.confrontFrom!==undefined&&!stagingInt(s.confrontFrom,1,Math.max(1,storyChapters.length)))bad('staging.confrontFrom','must be a chapter number from 1 to '+storyChapters.length);
 if(s.noBeyond!==undefined&&typeof s.noBeyond!=='boolean')bad('staging.noBeyond','must be true or false');
 if(s.firstSay!==undefined)listOf(s.firstSay,1,L.firstSay,'staging.firstSay').forEach((t,i)=>text(t,L.say,'staging.firstSay['+i+']'));
 // Ids first, so that references can be checked against them.
 const stakeIds=new Set(),fireIds=new Set(),toldIds=new Set(),choices=new Map(),flags=new Set();
 listOf(s.stakes,0,L.stakes,'staging.stakes').forEach((k,i)=>{const p='staging.stakes['+i+']';if(!stagingPlain(k)){bad(p,'must be an object');return;}keysOf(k,'stake',p);if((strict?!/^s[1-4]$/.test(String(k.id)):!(typeof k.id==='string'&&stagingIdPattern.test(k.id)))||stakeIds.has(k.id))bad(p+'.id',strict?'must be s1, s2, s3 or s4, each once':'must be an id, each once');stakeIds.add(k.id);text(k.name,L.stakeName,p+'.name');text(k.state,L.stakeState,p+'.state');});
 const fire=(v,path)=>{id(v,path);if(fireIds.has(v))bad(path,'"'+v+'" is used twice: beat, complication, pressure, choice and ending ids are unique in a tale');fireIds.add(v);};
 chapters.forEach((c,i)=>{if(!stagingPlain(c))return;
  for(const [list,kind] of [[c.beats,'beats'],[c.complications,'complications'],[c.pressure,'pressure']])if(Array.isArray(list))list.slice(0,H.list).forEach((b,j)=>{if(stagingPlain(b)){fire(b.id,'staging.chapters['+i+'].'+kind+'['+j+'].id');toldIds.add(b.id);}});
  if(stagingPlain(c.choice)){fire(c.choice.id,'staging.chapters['+i+'].choice.id');choices.set(c.choice.id,new Set((Array.isArray(c.choice.options)?c.choice.options:[]).map(o=>o?.id)));}
 });
 (Array.isArray(s.endings)?s.endings.slice(0,H.list):[]).forEach((e,i)=>{if(stagingPlain(e))fire(e.id,'staging.endings['+i+'].id');});
 // Flags any effect sets (a {flag} condition must name one of them, or "late").
 const allThens=[];
 chapters.forEach(c=>{if(!stagingPlain(c))return;allThens.push(c.then,c.opening?.then,c.fight?.deadline?.then,c.fight?.hold?.then);for(const list of [c.beats,c.complications,c.pressure])if(Array.isArray(list))for(const b of list)allThens.push(b?.then);if(Array.isArray(c.choice?.options))for(const o of c.choice.options)allThens.push(o?.then);});
 allThens.push(s.boss?.deadline?.then,s.boss?.hold?.then);
 for(const t of allThens)if(stagingPlain(t)&&typeof t.flag==='string')flags.add(t.flag);
 const leadIds=new Set((Array.isArray(story.leads)?story.leads:[]).map(l=>l?.id));
 // A condition: exactly one key, nested at most `depth` deep, at most `leaves` plain conditions in all; strict, of a
 // known kind with its value of the right shape (a build accepts kinds it does not know: they never hold there).
 const condition=(c,path,depth=1)=>{
  if(!stagingPlain(c)||Object.keys(c).length!==1){bad(path,'a condition is an object with exactly one key');return;}
  if(depth===1){const n=stagingLeaves(c),m=strict?L.leaves:H.leaves;if(n>m){bad(path,n===Infinity?'nests deeper than any build reads ('+H.depth+')':'holds '+n+' conditions: at most '+m);return;}}
  const [kind,v]=Object.entries(c)[0],p=path+'.'+kind,maxDepth=strict?L.depth:H.depth,maxList=strict?L.list:H.list;
  if(kind==='any'||kind==='all'){if(!Array.isArray(v)||v.length<1||v.length>maxList){bad(p,'must be a list of 1 to '+maxList+' conditions');return;}if(depth>=maxDepth){bad(p,'conditions nest at most '+maxDepth+' deep');return;}v.forEach((x,i)=>condition(x,p+'['+i+']',depth+1));return;}
  if(kind==='not'){if(depth>=maxDepth){bad(p,'conditions nest at most '+maxDepth+' deep');return;}condition(v,p,depth+1);return;}
  if(!strict){small(v,p);return;}
  if(!stagingConditionKinds.includes(kind)){bad(path,'unknown condition "'+kind+'"');return;}
  const who=(w,q)=>text(w,L.name,q);
  if(['reach','at','clear','won','searched','checked'].includes(kind))text(v,L.place,p);
  else if(kind==='met')who(v,p);
  else if(kind==='carry')text(v,L.item,p);
  else if(kind==='spoke'){if(!stagingPlain(v)){bad(p,'must be {"who": name, "times": n}');return;}keysOf(v,'spoke',p);who(v.who,p+'.who');if(v.times!==undefined&&!stagingInt(v.times,...L.spokeTimes))bad(p+'.times','must be a whole number from '+L.spokeTimes.join(' to '));}
  else if(kind==='with'){if(!stagingPlain(v)){bad(p,'must be {"who": name} or {"who": name, "at": place}');return;}keysOf(v,'with',p);who(v.who,p+'.who');if(v.at!==undefined)text(v.at,L.place,p+'.at');}
  else if(kind==='fate'){if(!stagingPlain(v)){bad(p,'must be {"who": name, "is": state}');return;}keysOf(v,'fate',p);who(v.who,p+'.who');if(!stagingFates.includes(v.is))bad(p+'.is','must be one of '+stagingFates.join(', '));}
  else if(kind==='foe'){if(!stagingFoeStates.includes(v))bad(p,'must be one of '+stagingFoeStates.join(', '));}
  else if(kind==='mark'){if(!stagingPlain(v)||Object.keys(v).length!==1){bad(p,'must be {"<choice id>": "<option id>"}');return;}const [ch,op]=Object.entries(v)[0];if(!choices.has(ch))bad(p,'names no choice of this tale ("'+ch+'")');else if(!choices.get(ch).has(op))bad(p,'choice "'+ch+'" has no option "'+op+'"');}
  else if(kind==='flag'){id(v,p);if(typeof v==='string'&&v!=='late'&&!flags.has(v))bad(p,'no effect sets the flag "'+v+'"');}
  else if(kind==='told'){id(v,p);if(typeof v==='string'&&!toldIds.has(v))bad(p,'names no beat, complication or pressure step of this tale ("'+v+'")');}
  else if(kind==='step'){if(!stagingInt(v,1,L.steps))bad(p,'must be a whole number from 1 to '+L.steps);}
  else if(kind==='rest'){if(v!==true)bad(p,'must be true');}
  else if(kind==='days'){if(!stagingInt(v,...L.days))bad(p,'must be a whole number from '+L.days.join(' to '));}
  else if(kind==='level'){if(!stagingInt(v,...L.levels))bad(p,'must be a whole number from '+L.levels.join(' to '));}
 };
 const optionalCondition=(c,path)=>{if(c!==undefined&&c!==null)condition(c,path);};
 // A condition the format requires (a beat's when, a lead's done); an older build only checks one that is there.
 const required=(c,path)=>{if(strict||(c!==undefined&&c!==null))condition(c,path);};
 // A creature: {template, name, appearance}; a threat may add one ally at its side. Not strict: small plain JSON.
 const creature=(t,path,kind,keys=true)=>{
  if(!stagingPlain(t)){bad(path,'must be {"template", "name", "appearance"'+(kind==='threat'?', "ally"':'')+'}');return;}
  if(!strict){small(t,path);return;}
  if(keys)keysOf(t,kind,path);
  if(!templateKeys.includes(t.template))bad(path+'.template','must be one of '+templateKeys.join(', '));
  text(t.name,L.threatName,path+'.name');text(t.appearance,L.appearance,path+'.appearance');
  if(kind!=='creature'&&t.ally!==undefined&&t.ally!==null){
   const a=t.ally;if(!stagingPlain(a)){bad(path+'.ally','must be null or {"template", "name", "appearance"}');return;}
   keysOf(a,'creature',path+'.ally');
   // As for an errand (storyRules.js errandPlaces): never the same kind as the threat, nor the lighter kind it becomes
   // below third level (zombies a skeleton, wolves a wolf, the orc goblins), which would be dropped at its side.
   const lighter={zombies:'skeleton',wolves:'wolf',orc:'goblin'}[t.template];
   if(!allyTemplates.includes(a.template))bad(path+'.ally.template','must be one of '+allyTemplates.join(', ')+' (one creature, or the goblin band)');
   else if(a.template===t.template)bad(path+'.ally.template','must be a different kind from the threat it stands beside');
   else if(a.template===lighter)bad(path+'.ally.template','"'+t.template+'" become'+(t.template==='orc'?'s':'')+' '+(t.template==='orc'?'goblins':'a '+lighter)+' below third level, so a '+lighter+' ally of the same kind would be dropped: choose another kind');
   text(a.name,L.threatName,path+'.ally.name');text(a.appearance,L.appearance,path+'.ally.appearance');
  }
 };
 // Where a creature is placed (a chapter's fight, an arm effect): from a level, else another creature (or none).
 const placement=(f,path)=>{
  if(f.fromLevel!==undefined&&!stagingInt(f.fromLevel,...L.levels))bad(path+'.fromLevel','must be a whole number from '+L.levels.join(' to '));
  if(f.otherwise!==undefined&&f.otherwise!==null){if(f.fromLevel===undefined)bad(path+'.otherwise','goes with "fromLevel": the creature placed below that level');creature(f.otherwise,path+'.otherwise','threat');}
 };
 // A fight's or the boss's timer (Phase C; accepted now): a deadline in the hero's turns, or rounds to hold out.
 const timer=(d,path,kind)=>{const [key,range,max]=kind==='hold'?['rounds',L.holdRounds,L.deadline]:['turns',L.deadlineTurns,L.deadline];
  if(!stagingPlain(d)){bad(path,'must be {"'+key+'", "tell", "then"?}');return null;}
  keysOf(d,kind,path);if(!stagingInt(d[key],...(strict?range:[1,H.number])))bad(path+'.'+key,'must be a whole number from '+(strict?range.join(' to '):'1'));text(d.tell,max,path+'.tell');return d;};
 // Effects: `closes` says whether this then may close the chapter or the tale (advance, end).
 const effects=(then,path,{closes=false,lastChapter=false}={})=>{
  if(then===undefined||then===null)return;
  if(!stagingPlain(then)){bad(path,'must be an object of effects');return;}
  if(!strict){small(then,path);return;}
  for(const [kind,v] of Object.entries(then)){
   const p=path+'.'+kind;
   if(!stagingEffectKinds.includes(kind)){bad(p,'unknown effect "'+kind+'"');continue;}
   if(kind==='bring'||kind==='offer')text(v,L.name,p);
   else if(kind==='send'){if(!stagingPlain(v)){bad(p,'must be {"who": name, "to": place}');continue;}keysOf(v,'send',p);text(v.who,L.name,p+'.who');text(v.to,L.place,p+'.to');}
   else if(kind==='arm'){if(!stagingPlain(v)){bad(p,'must be {"at", "template", "name", "appearance", "ally"}');continue;}text(v.at,L.place,p+'.at');keysOf(v,'arm',p);const {at,fromLevel,otherwise,...threat}=v;creature(threat,p,'threat',false);placement(v,p);}
   else if(kind==='place'){if(!stagingPlain(v)){bad(p,'must be {"at": place, "description"?, "danger"?}');continue;}keysOf(v,'placeChange',p);text(v.at,L.place,p+'.at');if(v.description===undefined&&v.danger===undefined)bad(p,'changes nothing: give a description, a danger or both');if(v.description!==undefined)text(v.description,L.placeText,p+'.description');if(v.danger!==undefined&&!['safe','risky'].includes(v.danger))bad(p+'.danger','must be safe or risky');}
   else if(kind==='stake'){if(!stagingPlain(v)||!Object.keys(v).length){bad(p,'must be {"s1": "new state"}');continue;}for(const [k,state] of Object.entries(v)){if(!stakeIds.has(k))bad(p,'names no stake of this tale ("'+k+'")');text(state,L.stakeState,p+'.'+k);}}
   else if(kind==='give'){if(!stagingPlain(v)){bad(p,'must be {"name", "note"}');continue;}keysOf(v,'give',p);text(v.name,L.item,p+'.name');text(v.note,L.giveNote,p+'.note');}
   else if(kind==='attitude'){if(!stagingPlain(v)){bad(p,'must be {"who", "to", "memory"}');continue;}keysOf(v,'attitude',p);text(v.who,L.name,p+'.who');if(!attitudeLevels.includes(v.to))bad(p+'.to','must be one of '+attitudeLevels.join(', '));text(v.memory,L.memory,p+'.memory');}
   else if(kind==='fact')text(v,L.fact,p);
   else if(kind==='lead'){if(!stagingPlain(v)||Object.keys(v).length!==1||!['open','close'].includes(Object.keys(v)[0])){bad(p,'must be {"open": "l1"} or {"close": "l1"}');continue;}const l=Object.values(v)[0];if(!leadIds.has(l))bad(p,'names no lead of this tale ("'+l+'")');}
   else if(kind==='flag'){id(v,p);if(v==='late')bad(p,'"late" is set by {"end": "late"} only');}
   else if(kind==='decide'){if(!stagingPlain(v)||Object.keys(v).length!==1){bad(p,'must be {"<choice id>": "<option id>"}');continue;}const [ch,op]=Object.entries(v)[0];if(!choices.has(ch))bad(p,'names no choice of this tale ("'+ch+'")');else if(!choices.get(ch).has(op))bad(p,'choice "'+ch+'" has no option "'+op+'"');}
   else if(kind==='clock'){if(v!==1&&v!==-1)bad(p,'must be 1 (the next pressure step now) or -1 (the next step held back once)');}
   else if(kind==='advance'){if(v!==true)bad(p,'must be true');else if(!closes)bad(p,'may not close the chapter here');else if(lastChapter)bad(p,'the last chapter closes with {"end": "late"}, not advance');}
   else if(kind==='end'){if(v!=='late')bad(p,'must be "late"');else if(!closes)bad(p,'may not end the tale here');else if(!lastChapter)bad(p,'only the last chapter may end the tale');}
   else if(kind==='boss'){if(!stagingPlain(v)||Object.keys(v).length!==1||!((v.minions===false)||(v.hurt===true)))bad(p,'must be {"minions": false} or {"hurt": true}');}
  }
 };
 // The chapters: exactly one for each of the story's chapters, in the same order (the engine reads them by index).
 if(!Array.isArray(s.chapters)||s.chapters.length!==storyChapters.length||storyChapters.length<2)bad('staging.chapters','must have exactly one entry for each of the story\'s chapters ('+storyChapters.length+')');
 chapters.slice(0,H.list).forEach((c,i)=>{
  const p='staging.chapters['+i+']',lastChapter=i===last;
  if(!stagingPlain(c)){bad(p,'must be an object');return;}
  keysOf(c,'chapter',p);
  text(c.where,L.where,p+'.where');text(c.agenda,L.agenda,p+'.agenda');
  if(!stagingPlain(c.found)||!Array.isArray(c.found.any)||c.found.any.length<1||c.found.any.length>(strict?L.routes:H.list))bad(p+'.found','must be {"any": [1 to '+(strict?L.routes:H.list)+' conditions]}');
  else{keysOf(c.found,'found',p+'.found');c.found.any.forEach((x,j)=>condition(x,p+'.found.any['+j+']'));
   if(c.found.item!==undefined){if(!stagingPlain(c.found.item))bad(p+'.found.item','must be {"name", "note"}');else{keysOf(c.found.item,'item',p+'.found.item');text(c.found.item.name,L.item,p+'.found.item.name');text(c.found.item.note,L.itemNote,p+'.found.item.note');}}}
  if(c.opening!==undefined){
   if(i===0)bad(p+'.opening','the first chapter has no opening: the tale\'s own opening is its start');
   else if(!stagingPlain(c.opening))bad(p+'.opening','must be {"tell", "line", "then"?}');
   else{keysOf(c.opening,'opening',p+'.opening');text(c.opening.tell,L.tell,p+'.opening.tell');text(c.opening.line,L.line,p+'.opening.line');effects(c.opening.then,p+'.opening.then');}
  }
  effects(c.then,p+'.then');
  const item=(b,q,kind)=>{if(!stagingPlain(b)){bad(q,'must be an object');return false;}keysOf(b,kind,q);return true;};
  listOf(c.beats,0,L.beats,p+'.beats').forEach((b,j)=>{const q=p+'.beats['+j+']';if(!item(b,q,'beat'))return;required(b.when,q+'.when');optionalCondition(b.if,q+'.if');text(b.tell,L.beatTell,q+'.tell');text(b.line,L.line,q+'.line');effects(b.then,q+'.then',{closes:true,lastChapter});});
  listOf(c.complications,0,L.complications,p+'.complications').forEach((b,j)=>{const q=p+'.complications['+j+']';if(!item(b,q,'complication'))return;optionalCondition(b.if,q+'.if');text(b.tell,L.complication,q+'.tell');text(b.line,L.line,q+'.line');effects(b.then,q+'.then',{closes:true,lastChapter});});
  const pressure=listOf(c.pressure,L.pressureLeast,L.pressureMost,p+'.pressure');
  pressure.forEach((b,j)=>{const q=p+'.pressure['+j+']';if(!item(b,q,'pressure'))return;text(b.tell,L.pressureTell,q+'.tell');text(b.sign,L.sign,q+'.sign');text(b.line,L.line,q+'.line');effects(b.then,q+'.then',{closes:true,lastChapter});
   // A step that happens only "unless …": its if, and what is told when it is spared (the clock still moves).
   if(b.if!==undefined&&b.if!==null){condition(b.if,q+'.if');if(strict&&j===pressure.length-1)bad(q+'.if','the last pressure step always happens: it closes the chapter');if(!stagingPlain(b.spared))bad(q+'.spared','a step with "if" says what happens when it is spared: {"tell", "line", "sign"?}');}
   if(b.spared!==undefined){if(!stagingPlain(b.spared))bad(q+'.spared','must be {"tell", "line", "sign"?}');else{keysOf(b.spared,'spared',q+'.spared');text(b.spared.tell,L.pressureTell,q+'.spared.tell');text(b.spared.line,L.line,q+'.spared.line');if(b.spared.sign!==undefined)text(b.spared.sign,L.sign,q+'.spared.sign');if(strict&&(b.if===undefined||b.if===null))bad(q+'.spared','goes with "if": what is told when the step is spared');}}});
  // The clock always moves the tale on: its last step closes the chapter (or, in the last chapter, ends the tale late).
  // (The engine closes a chapter whose steps have all fired in any case, so a build never depends on it.)
  const closing=pressure[pressure.length-1]?.then;
  if(strict&&pressure.length&&!(lastChapter?closing?.end==='late':closing?.advance===true))bad(p+'.pressure['+(pressure.length-1)+'].then',lastChapter?'the last chapter\'s last pressure step must end the tale: {"end": "late"}':'the last pressure step must close the chapter: {"advance": true}');
  if(c.fight!==undefined){const f=c.fight,q=p+'.fight';
   if(!stagingPlain(f))bad(q,'must be {"at", "threat", "objective", "fromLevel"?, "otherwise"?, "deadline"?, "hold"?}');
   else if(!strict){if(typeof f.at!=='string'||!stagingPlain(f.threat))bad(q,'must have "at" (a place) and "threat" (a creature)');small(f,q);}
   else{keysOf(f,'fight',q);text(f.at,L.place,q+'.at');creature(f.threat,q+'.threat','threat');text(f.objective,L.objective,q+'.objective');placement(f,q);
    if(f.deadline!==undefined&&timer(f.deadline,q+'.deadline','deadline'))effects(f.deadline.then,q+'.deadline.then',{closes:true,lastChapter});
    if(f.hold!==undefined&&timer(f.hold,q+'.hold','hold'))effects(f.hold.then,q+'.hold.then',{closes:true,lastChapter});}}
  if(c.choice!==undefined){const ch=c.choice,q=p+'.choice';
   if(!stagingPlain(ch))bad(q,'must be {"id", "opens", "ask", "options", "late"?}');
   else{keysOf(ch,'choice',q);optionalCondition(ch.opens,q+'.opens');text(ch.ask,L.ask,q+'.ask');
    const options=listOf(ch.options,L.options[0],L.options[1],q+'.options',1),seen=new Set(),guarded=new Set();
    options.forEach((o,j)=>{const r=q+'.options['+j+']';if(!stagingPlain(o)){bad(r,'must be an object');return;}keysOf(o,'option',r);id(o.id,r+'.id');if(seen.has(o.id))bad(r+'.id','"'+o.id+'" is used twice in this choice');seen.add(o.id);text(o.label,L.label,r+'.label');text(o.say,L.say,r+'.say');optionalCondition(o.if,r+'.if');optionalCondition(o.when,r+'.when');effects(o.then,r+'.then',{closes:true,lastChapter});if(o.if!==undefined&&o.if!==null)guarded.add(o.id);});
    if(ch.late!==undefined){if(!seen.has(ch.late))bad(q+'.late','must be the id of one of this choice\'s options');else if(strict&&guarded.has(ch.late))bad(q+'.late','the option applied when the chapter closes undecided has no "if"');
     else if(strict){const t=options.find(o=>o?.id===ch.late)?.then;if(stagingPlain(t)&&(t.advance!==undefined||t.end!==undefined))bad(q+'.late','the option applied as the chapter closes cannot close it again: no "advance" or "end" in its "then"');}}}}
 });
 // The tale's leads (story.leads, l1 to l4): when each opens and the condition that closes it.
 if(s.leads!==undefined){const seen=new Set();
  listOf(s.leads,0,L.leads,'staging.leads').forEach((l,i)=>{const p='staging.leads['+i+']';if(!stagingPlain(l)){bad(p,'must be an object');return;}keysOf(l,'lead',p);if((strict?!leadIds.has(l.id):!(typeof l.id==='string'&&stagingIdPattern.test(l.id)))||seen.has(l.id))bad(p+'.id','must name one of the story\'s leads (l1 for its first), each once');seen.add(l.id);if(l.opens!==undefined&&!stagingInt(l.opens,1,Math.max(1,storyChapters.length)))bad(p+'.opens','must be a chapter number from 1 to '+storyChapters.length);required(l.done,p+'.done');});}
 if(s.boss!==undefined){const b=s.boss;
  if(!stagingPlain(b))bad('staging.boss','must be {"if"?, "objective"?, "minions"?, "bloodied"?, "deadline"?, "hold"?}');
  else if(!strict)small(b,'staging.boss');
  else{keysOf(b,'boss','staging.boss');
   optionalCondition(b.if,'staging.boss.if');
   if(b.objective!==undefined)text(b.objective,L.objective,'staging.boss.objective');
   if(b.minions!==undefined)listOf(b.minions,0,L.minions,'staging.boss.minions').forEach((m,i)=>creature(m,'staging.boss.minions['+i+']','creature'));
   if(b.bloodied!==undefined){const d=b.bloodied;if(!stagingPlain(d))bad('staging.boss.bloodied','must be {"kind", "tell", "line"}');else{keysOf(d,'bloodied','staging.boss.bloodied');if(!['call','flee','rage'].includes(d.kind))bad('staging.boss.bloodied.kind','must be call, flee or rage');text(d.tell,L.bloodied,'staging.boss.bloodied.tell');text(d.line,L.line,'staging.boss.bloodied.line');}}
   if(b.deadline!==undefined&&timer(b.deadline,'staging.boss.deadline','deadline'))effects(b.deadline.then,'staging.boss.deadline.then');
   if(b.hold!==undefined&&timer(b.hold,'staging.boss.hold','hold'))effects(b.hold.then,'staging.boss.hold.then');}}
 // Endings: the engine takes the first whose condition holds, else the last (the default, which has none).
 const endings=listOf(s.endings,L.endings[0],L.endings[1],'staging.endings',1);
 endings.forEach((e,i)=>{const p='staging.endings['+i+']';if(!stagingPlain(e)){bad(p,'must be an object');return;}keysOf(e,'ending',p);text(e.title,L.endingTitle,p+'.title');text(e.text,L.endingText,p+'.text');
  if(!strict){optionalCondition(e.if,p+'.if');return;}
  if(i===endings.length-1){if(e.if!==undefined&&e.if!==null)bad(p+'.if','the last ending is the default: it has no "if"');}
  else if(e.if===undefined||e.if===null)bad(p+'.if','every ending but the last needs an "if"');else condition(e.if,p+'.if');});
 if(s.places!==undefined){
  if(!stagingPlain(s.places)||Object.keys(s.places).length>(strict?L.places:H.places))bad('staging.places','must be an object of at most '+(strict?L.places:H.places)+' places');
  else for(const [name,v] of Object.entries(s.places)){const p='staging.places["'+name+'"]';if(!stagingText(name,strict?L.place:H.text))bad(p,'a place name of 1 to '+(strict?L.place:H.text)+' characters');if(!stagingPlain(v)||!Array.isArray(v.colour)||v.colour.length<1||v.colour.length>(strict?L.colours:H.list)){bad(p,'must be {"colour": [1 to '+(strict?L.colours:H.list)+' lines]}');continue;}keysOf(v,'place',p);v.colour.forEach((t,i)=>text(t,L.colour,p+'.colour['+i+']'));}
 }
 if(strict&&flags.size>L.flags)bad('staging','sets more than '+L.flags+' flags');
 return out;
}
// The validator story.staging must pass on every build (storyRules.js validStory): structure and size only (see the
// top of the file). The authoring checker uses stagingProblems(story,{strict:true}).
export const validStaging=story=>stagingProblems(story,{most:1}).length===0;
// The tag a written tale's copy carries (written-shelf.cjs start: the tale it came from, its edition and length). A
// length a later build adds is accepted.
export function validWrittenTag(w){
 return stagingPlain(w)&&typeof w.slug==='string'&&/^[a-z0-9-]{3,28}$/.test(w.slug)&&stagingInt(w.edition,1,9999)&&typeof w.length==='string'&&/^[a-z]{3,12}$/.test(w.length);
}
// game.pace: where the written tale stands (world state, shared at a table, never a hero field; WRITTEN-TALES.md,
// game.pace). Every key the format names must be there and sound; keys it does not know are ignored and `v` may be any
// whole number from 1, so a game saved by a later build still loads. Lists are sized for the largest tale a build
// accepts (stagingHardLimits), never for the tale at hand.
export function validPace(p,game){
 const st=game?.story?.staging;
 if(!stagingPlain(p)||!stagingPlain(st)||!Array.isArray(st.chapters))return false;
 const ids=(list,most)=>Array.isArray(list)&&list.length<=most&&new Set(list).size===list.length&&list.every(x=>typeof x==='string'&&paceIdPattern.test(x));
 const n=(v,most=1e9)=>stagingInt(v,0,most),person=id=>id==='keeper'||id==='mara'||isPersonId(id);
 const choices=new Map((st.chapters??[]).filter(c=>stagingPlain(c?.choice)).map(c=>[c.choice.id,Array.isArray(c.choice.options)?c.choice.options.map(o=>o?.id):[]]));
 const stakes=new Set((Array.isArray(st.stakes)?st.stakes:[]).map(k=>k?.id)),endings=(Array.isArray(st.endings)?st.endings:[]).map(e=>e?.id),leads=new Set((Array.isArray(game.story.leads)?game.story.leads:[]).map(l=>l?.id));
 return stagingInt(p.v,1,stagingHardLimits.number)&&stagingInt(p.ch,0,st.chapters.length-1)&&n(p.turns)&&n(p.quiet)&&Number.isSafeInteger(p.since)&&p.since>=0&&n(p.step,99)&&n(p.owed,99)&&n(p.held,99)&&n(p.day)&&n(p.quietMax)
  &&(p.due===null||(stagingPlain(p.due)&&typeof p.due.kind==='string'&&stagingIdPattern.test(p.due.kind)&&(p.due.id===undefined||(typeof p.due.id==='string'&&paceIdPattern.test(p.due.id)))))
  &&ids(p.told,400)&&ids(p.fired,400)&&ids(p.seen,400)
  &&stagingPlain(p.marks)&&Object.entries(p.marks).every(([c,o])=>choices.has(c)&&choices.get(c).includes(o))
  &&Array.isArray(p.flags)&&p.flags.length<=stagingLimits.flags+1&&new Set(p.flags).size===p.flags.length&&p.flags.every(f=>typeof f==='string'&&stagingIdPattern.test(f))
  &&stagingPlain(p.stakes)&&Object.entries(p.stakes).every(([k,v])=>stakes.has(k)&&stagingText(v,stagingLimits.stakeState))
  &&stagingPlain(p.spoke)&&Object.keys(p.spoke).length<=100&&Object.entries(p.spoke).every(([k,v])=>person(k)&&stagingInt(v,0,999))
  &&Array.isArray(p.offers)&&p.offers.length<=12&&new Set(p.offers).size===p.offers.length&&p.offers.every(person)
  &&Array.isArray(p.leads)&&p.leads.length<=stagingLimits.leads&&new Set(p.leads).size===p.leads.length&&p.leads.every(l=>leads.has(l))
  &&(p.sign===null||stagingText(p.sign,stagingLimits.sign))
  &&(p.fight===null||(stagingPlain(p.fight)&&Object.keys(p.fight).length<=8&&Object.values(p.fight).every(v=>stagingInt(v,0,999))&&stagingInt(p.fight.turns,0,999)))
  &&(p.ending===null||endings.includes(p.ending));
}
// The pace of a tale as its chapter begins, before anything has happened in it: where the hero stands counts as
// reached. (seatStaging will start a tale with it; the checker reads chapter 1's conditions against it.)
export function openingPace(game){
 const minutes=mapState(game).minutes??0,at=mapLocation(game),ch=Number.isInteger(game?.story?.chapter)?game.story.chapter:0;
 return {v:stagingVersion,ch,turns:0,quiet:0,since:minutes,step:0,owed:0,held:0,day:Math.floor(minutes/1440),due:null,told:[],fired:[],seen:typeof at==='string'&&paceIdPattern.test('reach:'+at)?['reach:'+at]:[],marks:{},flags:[],stakes:{},spoke:{},offers:[],leads:[],sign:null,fight:null,ending:null,quietMax:0};
}
// Whether a condition holds for a game and its pace (WRITTEN-TALES.md, Conditions). Pure and total: any input
// validStaging accepts, and anything else, gives true or false and never throws. A condition that uses a kind this
// build does not know never holds (a `not` around one included), so a later tale degrades to "never" rather than
// "always".
export function beatHolds(game,c,pace=game?.pace){
 const known=(x,depth)=>{if(!stagingPlain(x)||depth>stagingHardLimits.depth+2)return false;const e=Object.entries(x);if(e.length!==1)return false;const [k,v]=e[0];if(k==='any'||k==='all')return Array.isArray(v)&&v.length>0&&v.length<=stagingHardLimits.list&&v.every(y=>known(y,depth+1));if(k==='not')return known(v,depth+1);return stagingConditionKinds.includes(k);};
 if(!stagingPlain(game)||!known(c,0))return false;
 const pc=stagingPlain(pace)?pace:{},ids=stagingIds(game),seen=new Set(Array.isArray(pc.seen)?pc.seen:[]),here=mapLocation(game);
 const list=v=>Array.isArray(v)?v:[],named=v=>typeof v==='string'?v:null;
 const test=x=>{
  const [kind,v]=Object.entries(x)[0];
  const place=()=>named(v)&&ids.place(v),who=w=>named(w)&&ids.person(w);
  switch(kind){
   case 'any':return v.some(test);
   case 'all':return v.every(test);
   case 'not':return !test(v);
   case 'reach':{const id=place();return !!id&&(seen.has('reach:'+id)||here===id);}
   case 'at':{const id=place();return !!id&&here===id;}
   case 'won':case 'searched':case 'checked':{const id=place();return !!id&&seen.has(kind+':'+id);}
   case 'rest':return v===true&&seen.has('rest');
   case 'clear':{const id=place();return !!id&&!!worldPlaces(game).find(p=>p?.id===id)?.cleared;}
   case 'spoke':{const id=who(v?.who),times=Number.isInteger(v?.times)?v.times:2;return !!id&&Number.isInteger(pc.spoke?.[id])&&pc.spoke[id]>=times;}
   case 'met':{const id=who(v);return !!id&&metPerson(game,id);}
   case 'with':{const id=who(v?.who);if(!id||game.followers?.[id]?.status!=='following'||game.npcFate?.[id]==='dead')return false;if(v.at===undefined)return true;const at=named(v.at)&&ids.place(v.at);return !!at&&here===at;}
   case 'fate':{const id=who(v?.who);if(!id)return false;const fate=game.npcFate?.[id],alive=fate!=='dead';
    if(v.is==='alive')return alive;if(v.is==='dead')return !alive;if(v.is==='down')return alive&&(fate==='unconscious'||game.npcHP?.[id]===0);
    if(v.is==='following')return alive&&game.followers?.[id]?.status==='following';if(v.is==='hostile')return alive&&(game.npcMemory?.[id]?.attitude??'indifferent')==='hostile';return false;}
   case 'foe':{const wild=game.wildFight,fate=wild?wild.storyFoeFate:game.foeFate,hp=wild?wild.storyFoeHP:game.enemyHP,stats=game.story?.foeStats,scale=wild?wild.storyFoeScale:game.foeScale;
    const full=stagingPlain(stats)&&!game.dungeon?.active?scaledFoe(stats,scale?.key==='story'?scale.f:1)?.maximum:null,measured=Number.isInteger(full)&&full>0&&Number.isInteger(hp);
    if(v==='slain'||v==='subdued')return fate===v;if(v==='beaten')return fate==='slain'||fate==='subdued';
    if(v==='fought')return !!fate||(measured&&hp<full);if(v==='bloodied')return !!fate||(measured&&hp*2<=full);return false;}
   case 'carry':return !!named(v)&&list(game.pack?.items).some(i=>stagingNameKey(i?.name)===stagingNameKey(v));
   case 'mark':{const e=stagingPlain(v)?Object.entries(v):[];return e.length===1&&pc.marks?.[e[0][0]]===e[0][1];}
   case 'flag':return list(pc.flags).includes(v);
   case 'told':return list(pc.told).includes(v);
   case 'step':return Number.isInteger(v)&&Number.isInteger(pc.step)&&pc.step>=v;
   case 'days':return Number.isInteger(v)&&Math.floor(((mapState(game).minutes??0)-(Number.isInteger(pc.since)?pc.since:0))/1440)>=v;
   case 'level':return Number.isInteger(v)&&(Number.isInteger(game.encounterLevel)?game.encounterLevel:1)>=v;
   default:return false;
  }
 };
 try{return test(c)===true;}catch{return false;}
}
// Every name a staging uses, with what kind of thing it names and where: {kind: 'place'|'person'|'item', name, path}.
export function stagingNamesUsed(staging){
 const list=v=>Array.isArray(v)?v:[],out=[],add=(kind,name,path)=>{if(typeof name==='string'&&name.trim())out.push({kind,name,path});};
 const condition=(c,path,depth=0)=>{
  if(!stagingPlain(c)||depth>stagingHardLimits.depth)return;
  for(const [kind,v] of Object.entries(c)){
   const p=path+'.'+kind;
   if(['reach','at','clear','won','searched','checked'].includes(kind))add('place',v,p);
   else if(kind==='met')add('person',v,p);
   else if(kind==='carry')add('item',v,p);
   else if(kind==='spoke'||kind==='fate')add('person',v?.who,p+'.who');
   else if(kind==='with'){add('person',v?.who,p+'.who');add('place',v?.at,p+'.at');}
   else if(kind==='any'||kind==='all'){list(v).forEach((x,i)=>condition(x,p+'['+i+']',depth+1));}
   else if(kind==='not')condition(v,p,depth+1);
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
  if(c.fight){add('place',c.fight.at,p+'.fight.at');effects(c.fight.deadline?.then,p+'.fight.deadline.then');effects(c.fight.hold?.then,p+'.fight.hold.then');}
  if(c.choice){condition(c.choice.opens,p+'.choice.opens');list(c.choice.options).forEach((o,j)=>{condition(o?.if,p+'.choice.options['+j+'].if');condition(o?.when,p+'.choice.options['+j+'].when');effects(o?.then,p+'.choice.options['+j+'].then');});}
 });
 list(staging.leads).forEach((l,i)=>condition(l?.done,'staging.leads['+i+'].done'));
 if(stagingPlain(staging.boss)){condition(staging.boss.if,'staging.boss.if');effects(staging.boss.deadline?.then,'staging.boss.deadline.then');effects(staging.boss.hold?.then,'staging.boss.hold.then');}
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
  for(const [id,p] of Object.entries(stagingPlain(game.people)?game.people:{}))put(people,p?.name,id);
  m={world:game.world,people:game.people,places,byName:people};
  stagingIdMemo.set(story,m);
 }
 const memo=m;
 return {place:name=>memo.places.get(stagingNameKey(name))??null,person:name=>memo.byName.get(stagingNameKey(name))??null};
}
