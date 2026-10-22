import {templateKeys,allyTemplates,scaledFoe,makeAlly,bareFoeName,foeScaleOf,alliesScatter} from './encounterRules';
import {fightOver} from './masteryRules';
import {attitudeLevels,attitudeResponses} from './relationshipRules';
import {isPersonId,metPerson,npcScene,npcLore} from './npcRules';
import {mapLocation,mapState,worldPlaces,worldPlace,placeName} from './mapRules';
import {advanceChapter,finishLead,newAdventure} from './adventureRules';
import {questState,freshStoryGame} from './storyRules';
import {fightEnding} from './experienceRules';
import {appendJournal,journalForGame} from './journalRules';
import {applyLoot} from './inventoryRules';
import {storyEvents} from './storyLog';
import {readyHero} from './pregens';
import {validAdventure,adventureSnapshot} from './adventureStorage';
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
 stake:['id','name','state'],place:['colour'],lead:['id','opens','done'],boss:['if','objective','minions','bloodied','deadline','hold'],bloodied:['kind','tell','line','ally'],ending:['id','title','if','text'],
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
   if(b.bloodied!==undefined){const d=b.bloodied;if(!stagingPlain(d))bad('staging.boss.bloodied','must be {"kind", "tell", "line"}');else{keysOf(d,'bloodied','staging.boss.bloodied');if(!['call','flee','rage'].includes(d.kind))bad('staging.boss.bloodied.kind','must be call, flee or rage');text(d.tell,L.bloodied,'staging.boss.bloodied.tell');text(d.line,L.line,'staging.boss.bloodied.line');
    // The help a foe calls (kind "call"): one creature; without it the foe's first minion comes again.
    if(d.ally!==undefined&&d.ally!==null){if(d.kind!=='call')bad('staging.boss.bloodied.ally','goes only with the kind "call": the creature that answers it');creature(d.ally,'staging.boss.bloodied.ally','creature');}}}
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
  &&(p.ending===null||endings.includes(p.ending))
  // When the clock last acted (the chapter's move count), so two clock beats are never back to back (since the runtime).
  &&(p.clockAt===undefined||n(p.clockAt));
}
// The pace of a tale as its chapter begins, before anything has happened in it: where the hero stands counts as
// reached. (seatStaging will start a tale with it; the checker reads chapter 1's conditions against it.)
export function openingPace(game){
 const minutes=mapState(game).minutes??0,at=mapLocation(game),ch=Number.isInteger(game?.story?.chapter)?game.story.chapter:0;
 return {v:stagingVersion,ch,turns:0,quiet:0,since:minutes,step:0,owed:0,held:0,day:Math.floor(minutes/1440),due:null,told:[],fired:[],seen:typeof at==='string'&&paceIdPattern.test('reach:'+at)?['reach:'+at]:[],marks:{},flags:[],stakes:{},spoke:{},offers:[],leads:[],sign:null,fight:null,ending:null,quietMax:0,clockAt:0};
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
// ======================================================================================================================
// ---------- The runtime (WRITTEN-TALES.md 4.4, 14 and 17; the build specification's 3.2 and 3.3) ----------
// The engine decides when drama arrives, and the Dungeon Master performs it. seatStaging (freshStoryGame, once the
// residents are seated) arms chapter 1's set piece and starts game.pace. withBeats (turnRules.js settleTurn, right after
// the step and before experience, only where the move is made: the device alone, the campaign server at a table, never
// applyRemote) keeps the tale's clock, closes chapters by their finds, fires beats, opens and settles choices, picks the
// ending, and leaves at most one thing due (game.pace.due) for the next reply that goes to the Dungeon Master (taleNow:
// its turn note). stagedPreview is the same applied to a preview (useDmTurn.js, server-turn.cjs), so a beat this very
// move fires rides this very reply; both start from the same game, so the preview and the commit agree. Pure,
// deterministic and total: no randomness, and any input gives a result (an effect that cannot apply is skipped).
// Which beat a reply told: every request names the beat it carried (beatSent: its key "kind:id"), and the device or the
// campaign server records the keys of the requests of a turn in its conversation (`beats`); a beat the game told itself
// in its own words when the Dungeon Master could not be reached is `beatTold` (withBeatLine). Only those are marked
// told, never whatever is due after the move, so nothing is told twice.
const stgFighting=g=>!!g&&(['combat','dying','dead','defeat'].includes(g.stage)||!!g.npcCombat?.active||!!g.turnOrder||!!g.pendingSpell||!!g.wildFight||!!g.dungeon?.active);
const stgList=v=>Array.isArray(v)?v:[];
const stgClean=(v,max)=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,max).trim():'';
// The staging of a game's tale, when it is one the engine can play (one staging chapter for each story chapter).
function stgStaging(game){
 const st=game?.story?.staging;
 return stagingPlain(st)&&Array.isArray(st.chapters)&&Array.isArray(game.story.chapters)&&st.chapters.length===game.story.chapters.length&&st.chapters.length>0?st:null;
}
export const isStaged=game=>!!stgStaging(game);
// The pacing a tale asks for (its length's defaults where it says nothing).
function stgPacing(st){
 const base=stagingPacing[st?.length]??stagingPacing.short,ticks=stagingPlain(st?.ticks)?st.ticks:{};
 return {quiet:stagingInt(st?.quiet,1,99)?st.quiet:base.quiet,drift:stagingInt(st?.drift,1,99)?st.drift:base.drift,rest:ticks.rest===true,days:stagingInt(ticks.days,0,2)?ticks.days:stagingTicks.days};
}
// A working copy of game.pace (a later build's keys kept), with what this build adds filled in.
function stgPace(game){
 const p=game?.pace,fresh=openingPace(game);
 if(!stagingPlain(p))return fresh;
 const obj=v=>stagingPlain(v)?{...v}:{},num=(v,d)=>Number.isInteger(v)&&v>=0?v:d;
 return {...fresh,...p,ch:num(p.ch,fresh.ch),turns:num(p.turns,0),quiet:num(p.quiet,0),quietMax:num(p.quietMax,0),since:num(p.since,fresh.since),day:num(p.day,fresh.day),step:num(p.step,0),owed:num(p.owed,0),held:num(p.held,0),clockAt:num(p.clockAt,0),
  due:stagingPlain(p.due)?p.due:null,told:[...stgList(p.told)],fired:[...stgList(p.fired)],seen:[...stgList(p.seen)],marks:obj(p.marks),flags:[...stgList(p.flags)],stakes:obj(p.stakes),spoke:obj(p.spoke),offers:[...stgList(p.offers)],leads:[...stgList(p.leads)],sign:typeof p.sign==='string'?p.sign:null,fight:stagingPlain(p.fight)?p.fight:null,ending:typeof p.ending==='string'?p.ending:null};
}
// The key a due beat is known by in requests and conversations: "beat:b1", "turn:found:1", "ending:p3"...
export const paceDueKey=due=>stagingPlain(due)&&typeof due.kind==='string'?due.kind+(typeof due.id==='string'?':'+due.id:''):null;
// The place ids a staging names (only their events are kept for a chapter), worked out once per story.
const stgNamedMemo=new WeakMap();
function stgNamed(game){
 const story=game?.story;if(!stagingPlain(story))return new Set();
 let m=stgNamedMemo.get(story);
 if(!m||m.world!==game.world){const ids=stagingIds(game),set=new Set();for(const u of stagingNamesUsed(story.staging))if(u.kind==='place'){const id=ids.place(u.name);if(id)set.add(id);}m={world:game.world,set};stgNamedMemo.set(story,m);}
 return m.set;
}
// A beat, complication or pressure step by its id, with the chapter (0-based) it belongs to.
function stgFind(st,id){
 for(const [i,c] of stgList(st?.chapters).entries())if(stagingPlain(c))for(const kind of ['beats','complications','pressure'])for(const b of stgList(c[kind]))if(stagingPlain(b)&&b.id===id)return {item:b,kind:kind==='beats'?'beat':kind==='complications'?'complication':'pressure',chapter:i};
 return null;
}
const stgLevel=state=>Number.isInteger(state.game?.encounterLevel)?state.game.encounterLevel:Number.isInteger(state.hero?.level)?state.hero.level:1;
const stgFire=(state,id)=>{const f=state.pace.fired;if(typeof id==='string'&&paceIdPattern.test(id)&&!f.includes(id)){f.push(id);if(f.length>400)f.splice(0,f.length-400);}};
const stgLog=(state,line)=>{state.events.push(line);state.game={...state.game,log:[line,...stgList(state.game.log)].slice(0,40)};};
// A creature as the engine seats it (the errand's rules, storyRules.js errandPlaces): below level 3 a pack or the orc
// becomes a lighter creature of its kind; a creature at its side only from level 2 (the orc from 3), never the same kind
// as the threat nor the kind it becomes.
const stgSingles={zombies:'skeleton',wolves:'wolf',orc:'goblin'};
function stgThreat(t,level){
 if(!stagingPlain(t)||!templateKeys.includes(t.template))return null;
 const name=stgClean(t.name,60),appearance=stgClean(t.appearance,400);if(!name||!appearance)return null;
 const template=level>=3?t.template:stgSingles[t.template]??t.template,a=stagingPlain(t.ally)?t.ally:null;
 const ally=a&&level>=2&&allyTemplates.includes(a.template)&&(a.template!=='orc'||level>=3)&&![template,t.template,stgSingles[t.template]].includes(a.template)&&stgClean(a.name,60)&&stgClean(a.appearance,400)?{template:a.template,name:stgClean(a.name,60),appearance:stgClean(a.appearance,400)}:null;
 return {template,name,appearance,...(ally?{ally}:{})};
}
// A place becomes a lair held by a creature, armed for the hero's next arrival and uncleared until it is beaten again:
// a landmark or a far place (never the three starting places), never where the hero is fighting, once a chapter.
function stgArm(state,a){
 if(!stagingPlain(a)||typeof a.at!=='string')return;
 const g=state.game,id=state.ids.place(a.at);if(!id||!/^p\d{1,3}$/.test(id)||!worldPlaces(g).some(p=>p?.id===id))return;
 if(stgFighting(g)&&mapLocation(g)===id)return;
 const key='arm:'+id+':'+(state.pace.ch+1);if(state.pace.fired.includes(key))return;
 const level=stgLevel(state),pick=Number.isInteger(a.fromLevel)&&level<a.fromLevel?(stagingPlain(a.otherwise)?a.otherwise:null):a,threat=pick?stgThreat(pick,level):null;if(!threat)return;
 state.game={...g,world:{...g.world,places:worldPlaces(g).map(p=>{if(p.id!==id)return p;const q={...p,danger:'lair',threat};delete q.cleared;return q;})}};
 stgFire(state,key);
}
// The creature a set piece puts at its place for a hero of this level (its level rules): tale-balance.cjs fights it.
export function stagedThreat(f,level){
 if(!stagingPlain(f)||!stagingPlain(f.threat))return null;
 const pick=Number.isInteger(f.fromLevel)&&level<f.fromLevel?(stagingPlain(f.otherwise)?f.otherwise:null):f.threat;
 return pick?stgThreat(pick,level):null;
}
function stgArmFight(state,i){const f=state.staging.chapters[i]?.fight;if(stagingPlain(f)&&stagingPlain(f.threat))stgArm(state,{...f.threat,at:f.at,fromLevel:f.fromLevel,otherwise:f.otherwise});}
// People a written tale offers as companions wait until they are with the hero, then the offer is made ("Take X along").
function stgOffers(state){
 const p=state.pace;if(!p.offers.length)return;
 const g=state.game,scene=npcScene(g);let offers=stagingPlain(g.joinOffers)?{...g.joinOffers}:{},changed=false;
 p.offers=p.offers.filter(id=>{
  const n=scene.find(x=>x.id===id);
  if(!n||g.npcFate?.[id]==='dead'||g.followers?.[id]?.status==='following')return false;
  if(n.present&&(n.hp??0)>0&&!offers[id]&&!n.grudge&&n.attitude!=='hostile'&&Object.keys(offers).length<3){offers[id]={reason:'Offered to come with you.',terms:''};changed=true;}
  return true;
 });
 if(changed)state.game={...g,joinOffers:offers};
}
const stgEffectOrder=['bring','send','arm','place','stake','give','attitude','offer','fact','lead','flag','decide','clock','boss','advance','end'];
// A `then`: each kind once, in a fixed order; what closes the chapter (advance, end) last. `from` is the id of what
// fired (a closing chapter remembers it as what closed it).
function stgThen(state,then,from){
 if(!stagingPlain(then)||state.depth>3)return;
 state.depth++;
 try{for(const kind of stgEffectOrder)if(Object.hasOwn(then,kind)){try{stgEffect(state,kind,then[kind],from);}catch{}}}
 finally{state.depth--;}
}
function stgEffect(state,kind,v,from){
 const g=state.game,ids=state.ids,p=state.pace,story=g.story,last=p.ch>=stgList(story.chapters).length-1;
 const person=w=>typeof w==='string'?ids.person(w):null;
 if(kind==='bring'){
  const id=person(v);if(!id||!isPersonId(id))return;const who=g.people?.[id];if(!who||g.npcFate?.[id]==='dead'||g.followers?.[id]?.status==='following')return;
  const here=mapLocation(g);if(!/^(?:inn|bridge|tower|p\d{1,3})$/.test(String(here)))return;
  const {hidden:_h,...rest}=who,next={...g,people:{...g.people,[id]:{...rest,home:here}}};
  if(g.followers?.[id]?.status==='waiting')next.followers={...g.followers,[id]:{...g.followers[id],location:here}};
  state.game=next;state.happened=true;
 }else if(kind==='send'){
  if(!stagingPlain(v))return;const id=person(v.who),to=typeof v.to==='string'?ids.place(v.to):null;
  if(!id||!isPersonId(id)||!to||!g.people?.[id]||g.npcFate?.[id]==='dead')return;
  const next={...g,people:{...g.people,[id]:{...g.people[id],home:to}}};
  if(g.followers?.[id]){const f={...g.followers};delete f[id];if(Object.keys(f).length)next.followers=f;else delete next.followers;}
  if(g.joinOffers?.[id]){const o={...g.joinOffers};delete o[id];if(Object.keys(o).length)next.joinOffers=o;else delete next.joinOffers;}
  state.game=next;state.happened=true;
 }else if(kind==='arm')stgArm(state,v);
 else if(kind==='place'){
  if(!stagingPlain(v))return;const id=typeof v.at==='string'?ids.place(v.at):null;if(!id||!/^p\d{1,3}$/.test(id))return;
  const description=stgClean(v.description,300),danger=['safe','risky'].includes(v.danger)?v.danger:null;if(!description&&!danger)return;
  state.game={...g,world:{...g.world,places:worldPlaces(g).map(x=>{if(x.id!==id)return x;const q={...x};if(description)q.description=description;if(danger&&q.danger!=='lair'){if(danger==='risky')q.danger='risky';else delete q.danger;}return q;})}};
 }else if(kind==='stake'){
  if(!stagingPlain(v))return;const known=new Set(stgList(state.staging.stakes).map(k=>k?.id));
  for(const [k,s] of Object.entries(v))if(known.has(k)&&stagingText(s,stagingLimits.stakeState)&&p.stakes[k]!==s){p.stakes[k]=s;state.happened=true;}
 }else if(kind==='give'){
  if(!stagingPlain(v))return;const name=stgClean(v.name,60),note=stgClean(v.note,160);if(!name)return;
  const got=applyLoot(g,state.hero,{gold:0,items:[{name,kind:'quest',qty:1,...(note?{note}:{})}]});if(got.error)return;
  state.game=got.game;for(const line of got.lines)stgLog(state,line);
 }else if(kind==='attitude'){
  if(!stagingPlain(v)||!attitudeLevels.includes(v.to))return;const id=person(v.who);if(!id||g.npcFate?.[id]==='dead')return;
  const m=stagingPlain(g.npcMemory?.[id])?g.npcMemory[id]:{},to=m.grudge?'hostile':m.bond&&['hostile','unfriendly','indifferent'].includes(v.to)?'friendly':v.to,memory=stgClean(v.memory,160);
  state.game={...g,npcMemory:{...g.npcMemory,[id]:{...m,attitude:to,response:attitudeResponses[to]??m.response,memories:[...stgList(m.memories),...(memory?[memory]:[])].slice(-12)}}};
 }else if(kind==='offer'){
  const id=person(v);if(!id||g.npcFate?.[id]==='dead'||g.followers?.[id]?.status==='following')return;
  if(!p.offers.includes(id)&&p.offers.length<12)p.offers.push(id);
  stgOffers(state);
 }else if(kind==='fact'){
  const fact=stgClean(v,200);if(fact)state.game={...g,worldFacts:[...stgList(g.worldFacts),fact].slice(-60)};
 }else if(kind==='lead'){
  if(!stagingPlain(v))return;
  if(typeof v.open==='string'&&stgList(story.leads).some(l=>l?.id===v.open&&!l.done)&&!p.leads.includes(v.open)&&p.leads.length<stagingLimits.leads)p.leads.push(v.open);
  if(typeof v.close==='string')stgCloseLead(state,v.close);
 }else if(kind==='flag'){
  if(typeof v==='string'&&stagingIdPattern.test(v)&&v!=='late'&&!p.flags.includes(v)&&p.flags.length<stagingLimits.flags)p.flags.push(v);
 }else if(kind==='decide'){
  if(!stagingPlain(v))return;const [c,o]=Object.entries(v)[0]??[];stgMark(state,c,o,'lapsed');
 }else if(kind==='clock'){
  const left=Math.max(0,stgList(state.staging.chapters[p.ch]?.pressure).length-p.step);
  if(v===1)p.owed=Math.min(left,p.owed+1);else if(v===-1)p.held=Math.min(99,p.held+1);
 }else if(kind==='advance'){if(v===true&&!last)stgClose(state,from);}
 else if(kind==='end'){if(v==='late'&&last)stgClose(state,from,{late:true});}
 // The foe's minions sent off (gone from its side now and when it is met), or the foe hurt before it is met.
 else if(kind==='boss'){
  if(!stagingPlain(v))return;
  if(v.minions===false&&!p.fired.includes('boss:minions')){stgFire(state,'boss:minions');if(stgFightSrc(g)===1&&stgList(g.foeAllies).length){const gone=alliesScatter(g,a=>'The '+a.name+' breaks off and leaves the fight.');state.game=gone.game;for(const line of gone.lines)stgLog(state,line);}}
  if(v.hurt===true&&!p.fired.includes('boss:hurt'))stgFire(state,'boss:hurt');
 }
}
function stgCloseLead(state,id){
 const lead=stgList(state.game.story.leads).find(l=>l?.id===id);if(!lead||lead.done)return;
 const done=finishLead(state.game,null,id);if(done.error)return;
 state.game=done.game;state.events.push(...stgList(done.events));state.happened=true;
}
// The choice of a chapter by its id.
const stgChoice=(st,id)=>stgList(st?.chapters).map(c=>c?.choice).find(c=>stagingPlain(c)&&c.id===id&&Array.isArray(c.options))??null;
// A choice made (by the player through the Dungeon Master: 'chosen'; settled by the engine: 'settled'; let lapse:
// 'lapsed'): recorded once, its option's `then` applied once, and a line for the feed and the story log.
function stgMark(state,c,o,how){
 const choice=stgChoice(state.staging,c),opt=choice?.options.find(x=>stagingPlain(x)&&x.id===o);if(!opt||state.pace.marks[c])return;
 state.pace.marks[c]=o;stgApplyChoice(state,choice,opt,how);
}
function stgApplyChoice(state,choice,opt,how){
 if(state.pace.fired.includes('chosen:'+choice.id))return;
 stgFire(state,'chosen:'+choice.id);if(how==='lapsed')stgFire(state,'lapsed:'+choice.id);
 state.happened=true;
 stgLog(state,(how==='lapsed'?'Left to fate: ':'You chose: ')+stgClean(opt.label,80).replace(/[.\s]+$/,'')+'.');
 // (what closes the chapter through an option is named by its choice: a pace id stays within 32 characters)
 stgThen(state,opt.then,'opt:'+choice.id);
}
// A chapter begins: its counters start again, its set piece is armed and its opening's effects apply.
function stgOpenChapter(state,i){
 const g=state.game,p=state.pace,minutes=mapState(g).minutes??0,here=mapLocation(g);
 Object.assign(p,{ch:i,turns:0,quiet:0,quietMax:0,since:minutes,day:Math.floor(minutes/1440),step:0,owed:0,held:0,clockAt:0,seen:typeof here==='string'&&paceIdPattern.test('reach:'+here)?['reach:'+here]:[],spoke:{},sign:null,fight:null});
 stgArmFight(state,i);
 const o=state.staging.chapters[i]?.opening;if(stagingPlain(o))stgThen(state,o.then,'opening:'+(i+1));
}
// The chapter under way closes (its find, a beat's or a step's advance, the clock run out): what its find gives, its own
// effects and its choice's late option (both counting from the next chapter's opening), and the next chapter opens; its
// truth is due, with what closed it. In the last chapter the tale completes and the engine picks the ending.
function stgClose(state,closer,{late=false}={}){
 const g=state.game,s=g.story,p=state.pace,ch=p.ch,c=state.staging.chapters[ch]??{},last=ch>=stgList(s.chapters).length-1;
 if(state.closed||s.status!=='active'||(s.chapter??0)!==ch)return;
 state.closed=true;state.happened=true;stgFire(state,'found:'+(ch+1));
 const closing=()=>{
  if(stagingPlain(c.found?.item))stgEffect(state,'give',c.found.item);
  stgThen(state,c.then,'close:'+(ch+1));
  if(stagingPlain(c.choice)&&typeof c.choice.late==='string'&&!state.pace.marks[c.choice.id])stgMark(state,c.choice.id,c.choice.late,'lapsed');
 };
 if(!last){
  const advanced=advanceChapter(g,null,state.hero);if(advanced.error){state.closed=false;return;}
  state.game=advanced.game;state.events.push(...stgList(advanced.events));
  stgOpenChapter(state,ch+1);closing();
  state.pace.due={kind:'turn',id:closer};
  return;
 }
 closing();
 if(late&&!state.pace.flags.includes('late'))state.pace.flags.push('late');
 state.game={...state.game,story:{...state.game.story,status:'complete'}};
 stgLog(state,'Adventure complete: '+s.title);
 const ending=endingOf(state.game,state.pace);
 if(ending){state.pace.ending=ending.id;stgLog(state,'Ending: '+stgClean(ending.title,60).replace(/[.\s]+$/,'')+'.');}
 state.pace.due={kind:'ending',id:closer};
}
// A due beat the request carried is told: marked so (a spared step is not), and nothing is due.
function stgTold(state,carried){
 const p=state.pace;
 // The fight's own due thing (a deadline, a hold, the foe bloodied), told in the fight.
 {const f=paceDueKey(stgFightDue(state.game,p));if(f&&carried.has(f)){p.fight={...p.fight,due:0};state.happened=true;}}
 const key=paceDueKey(p.due);if(!key||!carried.has(key))return;
 const d=p.due,id=typeof d.id==='string'?d.id:null;
 if(id&&stgFind(state.staging,id)&&!p.fired.includes('spared:'+id)&&!p.told.includes(id)&&p.told.length<400)p.told.push(id);
 p.due=null;state.happened=true;
}
// The ending the tale takes: the first whose condition holds, else the last (the default).
export function endingOf(game,pace=game?.pace){
 const st=stgStaging(game);if(!st)return null;
 const list=stgList(st.endings).filter(e=>stagingPlain(e)&&typeof e.id==='string');if(!list.length)return null;
 for(const e of list.slice(0,-1))if(e.if!==undefined&&e.if!==null&&beatHolds(game,e.if,pace))return e;
 return list[list.length-1];
}
// Whether a lead of the tale is open now: from its chapter (staging.leads opens, default the first), or opened by an
// effect. A lead the staging does not name is open from the start, as in any tale.
export function leadOpenNow(game,id,pace=game?.pace){
 const st=stgStaging(game);if(!st)return true;
 const entry=stgList(st.leads).find(l=>stagingPlain(l)&&l.id===id),opens=Number.isInteger(entry?.opens)?entry.opens:1;
 return (game.story.chapter??0)+1>=opens||stgList(pace?.leads).includes(id);
}
// The foe can be confronted: from chapter confrontFrom (default the last), and only while boss.if holds.
export function bossOpen(game){
 const st=stgStaging(game);if(!st)return true;
 const from=stagingInt(st.confrontFrom,1,99)?st.confrontFrom:st.chapters.length,cond=st.boss?.if;
 return (game.story.chapter??0)+1>=from&&(cond===undefined||cond===null||beatHolds(game,cond));
}
// The engine's refusal of a move against the foe held back to its chapter (approach, or an attack at the stronghold).
export function bossBlocked(game,action){
 if(!stgStaging(game)||game.stage!=='bridge'||!(game.enemyHP>0)||game.story.status!=='active')return null;
 if(action!=='approach'&&action?.type!=='encounter-attack')return null;
 return bossOpen(game)?null:(game.story.foe+' is beyond your reach for now.');
}
// The choice open now (it has been put, or is due to be), not yet made, in the chapter under way.
function stgOpenChoice(game){
 const st=stgStaging(game),p=game?.pace;if(!st||!stagingPlain(p)||game.story.status!=='active')return null;
 const c=st.chapters[p.ch]?.choice;
 return stagingPlain(c)&&typeof c.id==='string'&&Array.isArray(c.options)&&!p.marks?.[c.id]&&stgList(p.fired).includes('choice:'+c.id)?c:null;
}
// While a choice is open (out of a fight), the Dungeon Master is offered each option the player may choose now, to select
// only when the player's words or deeds clearly choose it (never a chip: quickActions.js passes them over).
export function stagingChoices(hero,game,health=null){
 if(stgFighting(game))return [];
 const c=stgOpenChoice(game);if(!c)return [];
 return c.options.filter(o=>stagingPlain(o)&&typeof o.id==='string'&&typeof o.label==='string'&&(o.if===undefined||o.if===null||beatHolds(game,o.if))).map(o=>({id:'tale-choice:'+c.id+':'+o.id,label:'The player commits to: '+stgClean(o.label,80)+' (ONLY when their words or deeds clearly choose it)',action:'tale-choice:'+c.id+':'+o.id}));
}
// The move 'tale-choice:<choice>:<option>' (adventureRules.js stepHandler): the choice is recorded; withBeats applies
// what it costs and writes "You chose: …" (after the step, so the story's names are never retold in it).
export function taleChoiceStep(step){
 const {game,health,action}=step,parts=String(action).split(':'),c=stgOpenChoice(game);
 if(parts.length!==3||!c||c.id!==parts[1])return {game,health,error:'That turning point is not before you now.'};
 const o=c.options.find(x=>stagingPlain(x)&&x.id===parts[2]);if(!o)return {game,health,error:'That is not one of the ways open to you.'};
 if(stgFighting(game))return {game,health,error:'Finish the fight first.'};
 if(o.if!==undefined&&o.if!==null&&!beatHolds(game,o.if))return {game,health,error:'That way is not open to you yet.'};
 return {game:{...game,pace:{...game.pace,marks:{...game.pace.marks,[c.id]:o.id}}},health,events:[]};
}
// A written tale is seated: chapter 1's set piece armed, the stakes as written, and the pace as the tale begins.
export function seatStaging(game,hero){
 const st=stgStaging(game);if(!st||game.story.status!=='active')return game;
 try{
  const state={game:{...game},pace:openingPace(game),events:[],hero,staging:st,ids:stagingIds(game),depth:0,closed:false,happened:false};
  state.pace.stakes=Object.fromEntries(stgList(st.stakes).filter(k=>stagingPlain(k)&&typeof k.id==='string'&&stagingText(k.state,stagingLimits.stakeState)).map(k=>[k.id,k.state]));
  stgArmFight(state,state.pace.ch);
  return {...state.game,pace:state.pace};
 }catch{return game;}
}
// One move of a written tale, after the step (WRITTEN-TALES.md 4.4): told, counters, a chapter closed outside, found,
// beats, the choice, the clock (then leads by their conditions and offers that wait). Returns the game, the lines it
// adds to the turn's events, and what is due. A different tale (a new one being seated) is left alone.
export function withBeats(before,after,hero,{action=null,conversation=null}={}){
 const none={game:after,events:[],beat:null};
 try{
  const st=stgStaging(after);
  if(!st||!stagingPlain(after.story)||!stagingPlain(before?.story)||(before.story.id??null)!==(after.story.id??null))return none;
  const state={game:after,pace:stgPace(after),events:[],hero,staging:st,ids:stagingIds(after),depth:0,closed:false,happened:false},p=state.pace;
  const carried=new Set([...stgList(conversation?.beats),conversation?.beatTold].filter(k=>typeof k==='string'));
  const move=!(conversation?.direct||conversation?.trigger);
  // 1. Told: the beat the request carried.
  stgTold(state,carried);
  const finish=()=>{stgTold(state,carried);if(state.happened)p.quiet=0;if(p.quiet>p.quietMax)p.quietMax=p.quiet;state.game={...state.game,pace:p};return {game:state.game,events:state.events,beat:p.due};};
  // A tale completed from outside (the Dungeon Master's story-complete): the engine still picks its ending.
  if(after.story.status!=='active'){
   if(before.story.status==='active'&&!p.ending){const e=endingOf(after,p);if(e){p.ending=e.id;stgLog(state,'Ending: '+stgClean(e.title,60).replace(/[.\s]+$/,'')+'.');p.due={kind:'ending',id:'dm:'+(p.ch+1)};}}
   return finish();
  }
  if(!move)return finish();
  // 2. Counters: the chapter's moves, what happened (events kept for the chapter), who spoke, quiet, what is owed.
  const fighting=stgFighting(before)||stgFighting(after),named=stgNamed(after),pace=stgPacing(st);
  const seen=k=>{if(!p.seen.includes(k)&&p.seen.length<400&&paceIdPattern.test(k))p.seen.push(k);};
  // The chapter's moves are counted out of a fight (the rounds of a fight are no stall), and drift owes a step every
  // "drift" of them.
  if(!fighting){p.turns++;if(pace.drift>0&&p.turns%pace.drift===0)p.owed=Math.min(Math.max(0,stgList(st.chapters[p.ch]?.pressure).length-p.step),p.owed+1);}
  {const here=mapLocation(after);if(named.has(here))seen('reach:'+here);}
  {const end=fightEnding(before,after),at=before.wildFight?.place??(before.stage==='combat'&&!before.dungeon?.active?'bridge':null);if(end.won&&at&&named.has(at))seen('won:'+at);}
  {const c=before.npcCombat;if(c?.active&&after.npcCombat&&after.npcCombat.active===false){const enemies=stgList(c.order).filter(n=>n?.side==='enemy').map(n=>n.id);if(enemies.length&&enemies.every(id=>after.npcFate?.[id]||(after.npcHP?.[id]??1)<=0)){const at=mapLocation(before);if(named.has(at))seen('won:'+at);}}}
  if(action?.type==='loot'){const at=mapLocation(after);if(named.has(at))seen('searched:'+at);}
  if(action?.type==='ai-check'){const at=mapLocation(before);if(named.has(at))seen('checked:'+at);}
  const rested=action==='long-rest';if(rested)seen('rest');
  if(conversation&&conversation.told!=='game')for(const id of new Set(stgList(conversation.dialogue).map(l=>l?.speakerId)))if((id==='keeper'||id==='mara'||isPersonId(id))&&(Object.hasOwn(p.spoke,id)||Object.keys(p.spoke).length<100))p.spoke[id]=Math.min(999,(Number.isInteger(p.spoke[id])?p.spoke[id]:0)+1);
  {const lines=fighting?[]:storyEvents(before,after,hero,{action}).filter(([kind,text])=>kind!=='rest'&&!(kind==='travel'&&/^Returned to /.test(text)));
   // Talk: words with someone (they answer, or the player turned to them); a move without it (a look, a wait) is any other.
   const talk=action===null&&!!conversation&&(!!conversation.npcId||stgList(conversation.dialogue).length>0);
   if(fighting||lines.length)p.quiet=0;else p.quiet=Math.min(9999,p.quiet+(talk?1:2));}
  {const left=()=>Math.max(0,stgList(st.chapters[p.ch]?.pressure).length-p.step),day=Math.floor((mapState(after).minutes??0)/1440);
   if(day>p.day){if(pace.days>0)p.owed=Math.min(left(),p.owed+(day-p.day)*pace.days);p.day=day;}
   if(rested&&pace.rest)p.owed=Math.min(left(),p.owed+1);}
  // A choice the player made with this move (taleChoiceStep): what it costs applies now.
  {const c=st.chapters[p.ch]?.choice,o=stagingPlain(c)&&p.marks[c.id];if(o&&!p.fired.includes('chosen:'+c.id)){const opt=stgList(c.options).find(x=>stagingPlain(x)&&x.id===o);if(opt)stgApplyChoice(state,c,opt,'chosen');}}
  // 3. A chapter closed outside (the Dungeon Master's story-advance): closed as the engine closes one.
  {const ch=after.story.chapter??0;
   if(ch>p.ch&&ch<st.chapters.length&&!state.closed){
    const old=p.ch,c=st.chapters[old]??{};state.closed=true;state.happened=true;stgFire(state,'found:'+(old+1));
    stgOpenChapter(state,ch);
    if(stagingPlain(c.found?.item))stgEffect(state,'give',c.found.item);
    stgThen(state,c.then,'close:'+(old+1));
    if(stagingPlain(c.choice)&&typeof c.choice.late==='string'&&!p.marks[c.choice.id])stgMark(state,c.choice.id,c.choice.late,'lapsed');
    p.due=stagingPlain(st.chapters[ch]?.opening)?{kind:'opening',id:'opening:'+(ch+1)}:null;
   }}
  const calm=()=>!state.closed&&!stgFighting(state.game)&&state.game.story.status==='active';
  // A fight's deadline or hold that closes the chapter (or ends the tale) does so once the fight is over.
  if(calm()&&stagingPlain(p.fight)&&stgFightSrc(state.game)===null){
   const f=p.fight;p.fight=null;
   if(stagingInt(f.close,1,2)){const src=f.src===1?1:0,t=stgTimers(state.game,src)[f.close===1?'deadline':'hold'],then=stagingPlain(t?.then)?t.then:{},tag=(f.close===1?'deadline:':'hold:')+stgFightTag(src,p.ch);
    stgThen(state,{...(then.advance!==undefined?{advance:then.advance}:{}),...(then.end!==undefined?{end:then.end}:{})},tag);}
  }
  // 4. Found: a route that holds closes the chapter (or completes the tale), replacing a beat due but untold.
  if(calm()&&stgList(st.chapters[p.ch]?.found?.any).some(r=>beatHolds(state.game,r,p)))stgClose(state,'found:'+(p.ch+1));
  // 5. Beats: when nothing is due, the first unfired beat whose `when` and `if` hold.
  if(calm()&&!p.due)for(const b of stgList(st.chapters[p.ch]?.beats)){
   if(!stagingPlain(b)||typeof b.id!=='string'||p.fired.includes(b.id)||!beatHolds(state.game,b.when,p)||(b.if!==undefined&&b.if!==null&&!beatHolds(state.game,b.if,p)))continue;
   stgFire(state,b.id);p.due={kind:'beat',id:b.id};state.happened=true;stgThen(state,b.then,b.id);break;
  }
  // 6. The choice: an option the engine settles by its `when`; else the choice opens when `opens` holds and nothing is due.
  if(calm()){const c=st.chapters[p.ch]?.choice;
   if(stagingPlain(c)&&typeof c.id==='string'&&Array.isArray(c.options)&&!p.marks[c.id]){
    const o=c.options.find(x=>stagingPlain(x)&&x.when!==undefined&&x.when!==null&&beatHolds(state.game,x.when,p)&&(x.if===undefined||x.if===null||beatHolds(state.game,x.if,p)));
    if(o)stgMark(state,c.id,o.id,'settled');
    else if(!p.due&&!p.fired.includes('choice:'+c.id)&&(c.opens===undefined||c.opens===null||beatHolds(state.game,c.opens,p))){stgFire(state,'choice:'+c.id);p.due={kind:'choice',id:c.id};state.happened=true;}
   }}
  // 7. The clock, only when nothing is due, out of a fight, at least two moves after its last beat: a tick owed (a rest,
  // a day, drift, {"clock": 1}) fires the next pressure step; quiet fires the next complication that may, else the step.
  // The last step closes the chapter (or ends the tale late) whatever it says.
  if(calm()&&!p.due&&p.turns-p.clockAt>=2){
   const steps=stgList(st.chapters[p.ch]?.pressure),quietBy=p.quiet>=2*pace.quiet;
   if(p.owed>0||quietBy){
    let done=false;
    if(!p.owed){const x=stgList(st.chapters[p.ch]?.complications).find(x=>stagingPlain(x)&&typeof x.id==='string'&&!p.fired.includes(x.id)&&(x.if===undefined||x.if===null||beatHolds(state.game,x.if,p)));
     if(x){stgFire(state,x.id);p.due={kind:'complication',id:x.id};p.clockAt=p.turns;state.happened=true;stgThen(state,x.then,x.id);done=true;}}
    if(!done&&p.step<steps.length){
     p.clockAt=p.turns;state.happened=true;if(p.owed>0)p.owed--;
     if(p.held>0)p.held--;
     else{const s=steps[p.step];p.step++;
      if(stagingPlain(s)&&typeof s.id==='string'){
       const spared=s.if!==undefined&&s.if!==null&&p.step<steps.length&&!beatHolds(state.game,s.if,p);
       stgFire(state,s.id);p.due={kind:'pressure',id:s.id};
       if(spared){stgFire(state,'spared:'+s.id);if(stagingText(s.spared?.sign,stagingLimits.sign))p.sign=s.spared.sign;}
       else{if(stagingText(s.sign,stagingLimits.sign))p.sign=s.sign;stgThen(state,s.then,s.id);}
      }
      if(p.step>=steps.length&&!state.closed)stgClose(state,typeof s?.id==='string'?s.id:'clock:'+(p.ch+1),{late:true});
     }
    }
   }
  }
  // Leads closed by their conditions (paid once), and offers that wait for their person.
  if(!stgFighting(state.game)&&state.game.story.status==='active')for(const l of stgList(st.leads)){
   if(!stagingPlain(l)||typeof l.id!=='string'||l.done===undefined||l.done===null)continue;
   const lead=stgList(state.game.story.leads).find(x=>x?.id===l.id);
   if(lead&&!lead.done&&leadOpenNow(state.game,l.id,p)&&beatHolds(state.game,l.done,p))stgCloseLead(state,l.id);
  }
  stgOffers(state);
  return finish();
 }catch{return none;}
}
// The same, applied to a preview of a move (useDmTurn.js and server-turn.cjs, before the game tells a routine move and
// before a request is built), so a beat this move fires is in this very reply.
export function stagedPreview(before,preview,hero,action){
 if(!preview||preview.error||preview.waiting||!preview.game)return preview;
 const staged=withBeats(before,preview.game,hero,{action,conversation:null});
 return staged.game===preview.game?preview:{...preview,game:staged.game,events:[...stgList(preview.events),...staged.events]};
}
// ---------- Fight shape (the stories spec, Phase C, 2026-10-22) ----------
// The tale's foe and a chapter's set piece are fights with a shape: the foe comes with its minions (boss.minions, seated
// as game.foeAllies when the fight with it begins), turns once at half its hit points (boss.bloodied: call, flee or
// rage), and a set piece or the foe may have a deadline (won within `turns` rounds, else its `then` applies) or a hold
// (it cannot be beaten for `rounds` rounds; its `tell` is told as the fight begins and its `then` once it is held).
// Played by the engine after every step (adventureRules.js adventureStep → withFightShape), on a device's preview, its
// commit and the campaign server alike: nothing here rolls a die. What happens is told through the fight's own due
// thing (game.pace.fight.due: deadline, hold or bloodied), which, unlike the calm beats, is told in the fight (the
// next request to the Dungeon Master carries it; routineTelling gives way to it). The numbers are provisional, tuned
// with balance-check.cjs --tale; survivalOdds and foeEase (deathRules.js, storyRules.js) are never touched.
// `minionsFrom`: the level from which the foe's minions stand beside it (a gentle tale's foe fights alone anyway);
// `callFrom` the same for help it calls; `hurt`: the share of its hit points a foe that comes hurt has lost; `fledShare`:
// the least share of its hit points a foe that breaks away has when met again (it binds its wounds).
// `minionShare`: a minion's hit points against its kind met alone; `minionDrop`: it is a creature of that many levels
// below the hero (its blows and its hit points), so the foe's side is one fight, not three.
export const fightShape={minionsFrom:2,callFrom:2,hurt:0.25,fledShare:0.7,minionShare:0.6,minionDrop:4};
const stgFightKinds=['','deadline','hold','bloodied'],stgPackSingles={zombies:'skeleton',wolves:'wolf'};
// Which staged fight is on: 1 the tale's foe at its stronghold, 0 the chapter's own set piece, null any other (a
// creature by the road, a place armed by an effect, a brawl, the vault). In a party a hero who is down sees the
// party's fight (party.stage).
function stgFightSrc(game){
 const st=stgStaging(game);if(!st)return null;
 const stage=['dying','dead'].includes(game.stage)&&typeof game.party?.stage==='string'?game.party.stage:game.stage;
 if(stage!=='combat'||game.dungeon?.active||game.npcCombat?.active)return null;
 if(!game.wildFight)return 1;
 const f=st.chapters[game.story.chapter??0]?.fight;
 return stagingPlain(f)&&typeof f.at==='string'&&stagingIds(game).place(f.at)===game.wildFight.place?0:null;
}
const stgFightTag=(src,ch)=>src===1?'boss':'c'+(ch+1);
// A fight's timers: the set piece's or the foe's deadline and hold, when sound.
function stgTimers(game,src){
 const st=stgStaging(game),t=src===1?st?.boss:st?.chapters?.[game.story.chapter??0]?.fight;
 if(!stagingPlain(t))return {deadline:null,hold:null};
 return {deadline:stagingPlain(t.deadline)&&stagingInt(t.deadline.turns,1,99)?t.deadline:null,hold:stagingPlain(t.hold)&&stagingInt(t.hold.rounds,1,99)?t.hold:null};
}
// The fight's due thing as {kind, id} (id "boss" or "c2", the chapter of the set piece), or null.
function stgFightDue(game,p=game?.pace){
 const f=p?.fight;if(!stagingPlain(f)||!stagingInt(f.due,1,3))return null;
 return {kind:stgFightKinds[f.due],id:stgFightTag(f.src===1?1:0,Number.isInteger(p.ch)?p.ch:0)};
}
// While a hold lasts, the foe cannot be brought below 1 hit point (creatureRound reads it before the step).
export function fightFloor(game){
 try{
  const src=stgFightSrc(game);if(src===null)return 0;
  return stgTimers(game,src).hold&&!stgList(game.pace?.fired).includes('hold:'+stgFightTag(src,game.pace?.ch??0))?1:0;
 }catch{return 0;}
}
// The foe in a rage (boss.bloodied kind "rage", once at half its hit points): one more blow a round (encounterFoe).
export function bossRaged(game){
 try{const st=stgStaging(game);return !!st&&st.boss?.bloodied?.kind==='rage'&&stgList(game.pace?.fired).includes('bloodied:boss')&&stgFightSrc(game)===1;}catch{return false;}
}
// A creature that stands beside the foe, as the engine seats it: a pack becomes one of its kind, the orc a goblin below
// level 3, and only the kinds that can stand beside another (allyTemplates).
function stgMinion(m,level){
 if(!stagingPlain(m)||!templateKeys.includes(m.template))return null;
 const single=stgPackSingles[m.template]??m.template,template=single==='orc'&&level<3?'goblin':single,name=stgClean(m.name,60),appearance=stgClean(m.appearance,400);
 return allyTemplates.includes(template)&&name&&appearance?{template,name:bareFoeName(name),appearance}:null;
}
// A creature beside the foe, at the side's strength (a party, companions: encounterRules.js scaledFoe).
function stgAlly(sketch,level,f){const lv=Math.max(1,level-fightShape.minionDrop),a=makeAlly(sketch,lv),most=Math.max(3,Math.min(500,Math.round(a.maximum/0.6*fightShape.minionShare*(f>1?f:1))));return {...a,maximum:most,hp:most,...(lv<level?{level:lv}:{})};}
// The fight with the tale's foe begins: its minions stand beside it (unless sent off, or beaten once already), and a
// foe that comes hurt has lost a share of its hit points.
function stgBossBegins(state){
 const g=state.game,st=state.staging,p=state.pace,level=stgLevel(state),max=scaledFoe(g.story.foeStats??{maximum:g.enemyHP},foeScaleOf(g))?.maximum??g.enemyHP;
 if(stgList(p.fired).includes('boss:hurt')&&!stgList(p.fired).includes('boss:hurt-done')){stgFire(state,'boss:hurt-done');if(g.enemyHP>=max)state.game={...state.game,enemyHP:Math.max(1,g.enemyHP-Math.round(max*fightShape.hurt))};}
 if(stgList(p.fired).includes('boss:minions')||level<fightShape.minionsFrom)return;
 const minions=stgList(st.boss?.minions).map(m=>stgMinion(m,level)).filter(Boolean).slice(0,2);if(!minions.length)return;
 const f=foeScaleOf(state.game),allies=minions.map(m=>stgAlly(m,level,f));
 state.game={...state.game,foeAllies:allies};
 stgLog(state,allies.length===1?'The '+allies[0].name+' stands beside '+g.story.foe+'.':'The '+allies[0].name+' and the '+allies[1].name+' stand beside '+g.story.foe+'.');
}
// Once at half its hit points the foe turns: help comes (call), it breaks away (flee) or it fights harder (rage).
function stgBloodied(state){
 const g=state.game,st=state.staging,b=st.boss?.bloodied;
 if(stgFightSrc(g)!==1||!(g.enemyHP>0)||!stagingPlain(b)||!['call','flee','rage'].includes(b.kind)||state.pace.fired.includes('bloodied:boss'))return;
 const max=scaledFoe(g.story.foeStats??{maximum:g.enemyHP},foeScaleOf(g))?.maximum??g.enemyHP;if(g.enemyHP*2>max)return;
 stgFire(state,'bloodied:boss');state.happened=true;
 if(!stagingPlain(state.pace.fight))state.pace.fight={turns:0,src:1,due:0,close:0};
 if(!state.pace.fight.due)state.pace.fight={...state.pace.fight,due:3};
 const level=stgLevel(state);
 if(b.kind==='call'){
  if(level<fightShape.callFrom)return;
  const sketch=stgMinion(b.ally,level)??stgList(st.boss?.minions).map(m=>stgMinion(m,level)).find(Boolean)??null;if(!sketch)return;
  const allies=stgList(g.foeAllies).slice(0,2),slot=allies.length<2?allies.length:allies.findIndex(a=>!(a?.hp>0));if(slot<0)return;
  const ally=stgAlly(sketch,level,foeScaleOf(g)),next={...g,foeAllies:[...allies.slice(0,slot),ally,...allies.slice(slot+1)]};
  if(stagingPlain(next.marks)&&next.marks['ally:'+slot]){next.marks={...next.marks};delete next.marks['ally:'+slot];if(!Object.keys(next.marks).length)delete next.marks;}
  state.game=next;stgLog(state,'The '+ally.name+' joins the fight beside '+g.story.foe+'.');
 }else if(b.kind==='flee'){
  // It breaks away: the fight is over, the foe keeps at least its share of hit points and waits to be met again (the
  // hero goes after it with Approach, at the stronghold); the creatures beside it scatter.
  const scattered=alliesScatter(g,a=>'The '+a.name+' goes with it.');let next={...scattered.game,stage:'bridge',enemyHP:Math.min(max,Math.max(g.enemyHP,Math.round(max*fightShape.fledShare))),round:1,bonusUsed:false,reactionUsed:false,slotSpentThisTurn:false};
  for(const k of ['actionUsed','surged','dodging','openingAttackAvailable','encounterInitiative','turnOrder','foeTricks','heroCondition','foeAllies'])delete next[k];
  next=fightOver(next);state.game=next;stgFire(state,'boss:fled');
  for(const line of scattered.lines)stgLog(state,line);
  stgLog(state,'The '+g.story.foe+' breaks away from the fight and gets clear.');
  state.pace.fight=null;state.pace.fightDue={kind:'bloodied',id:'boss'};
 }
}
// A fight's rounds and timers: a staged fight begins (its timers start, the foe's minions stand beside it), goes on
// (its rounds counted), or is over (only a deadline's or a hold's closing effects stay owed, applied once all is calm:
// withBeats).
function stgFightTimers(state,before){
 const g=state.game,p=state.pace,src=stgFightSrc(g),was=stgFightSrc(before);
 const begun=src!==null&&(was===null||src!==was||(src===0&&before.wildFight?.place!==g.wildFight?.place));
 const round=x=>Number.isInteger(x?.turnOrder?.round)?x.turnOrder.round:Number.isInteger(x?.round)?x.round:1;
 if(begun||(src!==null&&!stagingPlain(p.fight))){
  p.fight={turns:0,src,due:0,close:stagingPlain(p.fight)&&stagingInt(p.fight.close,1,2)?p.fight.close:0};
  // (a fight already under way when this build first saw it only starts counting)
  if(begun&&src===1)stgBossBegins(state);
  const hold=stgTimers(state.game,src).hold,tag=stgFightTag(src,p.ch);
  if(begun&&hold&&!p.fired.includes('hold:'+tag)&&!p.fired.includes('holding:'+tag)){stgFire(state,'holding:'+tag);p.fight.due=2;state.happened=true;}
 }else if(src!==null){const gone=round(g)-round(before);if(gone>0)p.fight={...p.fight,turns:Math.min(999,(p.fight.turns??0)+gone)};}
 else if(src===null&&was!==null){
  // Minions beaten stay beaten: the foe met again comes alone.
  if(was===1&&stgList(before.foeAllies).length&&stgList(before.foeAllies).every(a=>!(a?.hp>0)))stgFire(state,'boss:minions');
  if(stagingPlain(p.fight))p.fight=stagingInt(p.fight.close,1,2)?{turns:p.fight.turns??0,src:p.fight.src??0,due:0,close:p.fight.close}:null;
  return;
 }
 if(src===null||!stagingPlain(p.fight))return;
 const timers=stgTimers(state.game,src),tag=stgFightTag(src,p.ch);
 // What a timer's then does at once; advance and end wait until the fight is over (withBeats closes the chapter then).
 const now=(then,id,close)=>{if(!stagingPlain(then))return;const {advance,end,...rest}=then;stgThen(state,rest,id);if(advance!==undefined||end!==undefined)p.fight={...p.fight,close};};
 if(timers.deadline&&p.fight.turns>=timers.deadline.turns&&!p.fired.includes('deadline:'+tag)){stgFire(state,'deadline:'+tag);state.happened=true;if(!p.fight.due)p.fight={...p.fight,due:1};now(timers.deadline.then,'deadline:'+tag,1);}
 if(timers.hold&&p.fight.turns>=timers.hold.rounds&&!p.fired.includes('hold:'+tag)){stgFire(state,'hold:'+tag);state.happened=true;now(timers.hold.then,'hold:'+tag,2);}
}
// After every step of a written tale (adventureRules.js adventureStep): the fight's shape. Total: any input gives a
// result and never throws; a game with no staging is left as it is.
export function withFightShape(before,result,hero){
 if(!result||result.error||result.waiting||!result.game||result.game===before)return result;
 try{
  const st=stgStaging(result.game);
  if(!st||!stagingPlain(before?.story)||(before.story.id??null)!==(result.game.story.id??null)||result.game.story.status!=='active')return result;
  if(stgFightSrc(before)===null&&stgFightSrc(result.game)===null&&!stagingPlain(result.game.pace?.fight))return result;
  const state={game:result.game,pace:stgPace(result.game),events:[],hero,staging:st,ids:stagingIds(result.game),depth:0,closed:false,happened:false};
  stgFightTimers(state,before);
  stgBloodied(state);
  // A foe that broke away is due its telling at once (out of the fight now): the calm due waits behind it.
  const fled=state.pace.fightDue;delete state.pace.fightDue;
  if(fled&&!state.pace.due)state.pace.due=fled;
  return {...result,game:{...state.game,pace:state.pace},events:[...stgList(result.events),...state.events]};
 }catch{return result;}
}
// ---------- What the Dungeon Master and the screens read ----------
// The one thing due now that the next reply to the Dungeon Master tells: none in a fight (it waits), none of a kind this
// build does not know.
export function beatDue(game){
 if(!stgStaging(game))return null;
 // In a fight only the fight's own due thing is told (a deadline, a hold, the foe bloodied); the rest waits.
 if(stgFighting(game)){try{return stgFightSrc(game)===null?null:stgFightDue(game);}catch{return null;}}
 const due=game?.pace?.due;
 if(!stagingPlain(due)||!paceDueKinds.includes(due.kind))return null;
 return due;
}
export const beatKey=game=>paceDueKey(beatDue(game));
// The beat a request for this scene carries (the rule dm-server.cjs follows when it writes the turn's note): none on a
// scene cue, out of character, or for a spell awaiting its ruling.
export function beatSent(game,{engineResolved=null,sceneTrigger=null,outOfCharacter=null}={}){
 if(sceneTrigger||outOfCharacter||(game?.pendingSpell&&!engineResolved))return null;
 return beatKey(game);
}
function stgCloserTexts(st,game,id){
 const f=typeof id==='string'?stgFind(st,id):null;if(!f)return {tell:null,line:null};
 const spared=stgList(game.pace?.fired).includes('spared:'+id);
 return {tell:stgClean(spared?f.item.spared?.tell:f.item.tell,300)||null,line:stgClean(spared?f.item.spared?.line:f.item.line,300)||null};
}
// The due beat's words: for the Dungeon Master (`tell`, the chapter's truth and the next chapter's opening, the choice's
// question, the ending) and the game's own voice-neutral `line` (told beside any narrator when it cannot be reached).
function stgBeatWords(game,due){
 const st=stgStaging(game),s=game.story;if(!st||!due)return null;
 const kind=due.kind,id=typeof due.id==='string'?due.id:null;
 if(['beat','complication','pressure'].includes(kind)){const f=stgFind(st,id);if(!f)return null;const t=stgCloserTexts(st,game,id);return {kind,id,tell:t.tell,line:t.line,...(stgList(game.pace?.fired).includes('spared:'+id)?{spared:true}:{})};}
 if(kind==='turn'){const closed=s.chapters[(s.chapter??0)-1],o=st.chapters[s.chapter??0]?.opening,t=stgCloserTexts(st,game,id);if(!closed)return null;
  return {kind,id,...(t.tell?{tell:t.tell}:{}),truth:stgClean(closed.turn,400),...(stagingPlain(o)?{opening:stgClean(o.tell,300)}:{}),line:[t.line,stgClean(closed.turn,400),stagingPlain(o)?stgClean(o.line,300):''].filter(Boolean).join(' ')};}
 if(kind==='opening'){const o=st.chapters[s.chapter??0]?.opening;if(!stagingPlain(o))return null;return {kind,id,tell:stgClean(o.tell,300),line:stgClean(o.line,300)};}
 if(kind==='choice'){const c=stgChoice(st,id);if(!c)return null;return {kind,id,ask:stgClean(c.ask,300),line:stgClean(c.ask,300)};}
 // A fight's own: the set piece's or the foe's deadline and hold, the foe bloodied (or broken away).
 if(['deadline','hold','bloodied'].includes(kind)){const src=id==='boss'?1:0,t=src===1?st.boss:st.chapters[s.chapter??0]?.fight,x=kind==='bloodied'?t?.bloodied:t?.[kind];if(!stagingPlain(x))return null;
  const tell=stgClean(x.tell,300);if(!tell)return null;return {kind,id,tell,line:stgClean(x.line,300)||tell,...(kind==='bloodied'&&typeof x.kind==='string'?{turn:x.kind}:{})};}
 if(kind==='ending'){const e=stgList(st.endings).find(x=>stagingPlain(x)&&x.id===game.pace?.ending);if(!e)return null;const t=stgCloserTexts(st,game,id);
  return {kind,id,...(t.tell?{tell:t.tell}:{}),title:stgClean(e.title,60),text:stgClean(e.text,700),line:[t.line,stgClean(e.text,700)].filter(Boolean).join(' ')};}
 return null;
}
// The tale's state for the Dungeon Master (context.taleNow, the turn's part: dm-server.cjs makes the beat the turn's
// note and the stakes and the sign `now` lines): the due beat, what is at stake, and the latest sign of the foe's plan.
export function taleNow(game){
 const st=stgStaging(game);if(!st)return null;
 const out={},due=beatDue(game),words=due?stgBeatWords(game,due):null,stakes=talesStakes(game);
 if(words){const {line:_l,...beat}=words;out.beat=beat;}
 if(stakes.length)out.stakes=stakes;
 if(typeof game.pace?.sign==='string'&&game.pace.sign.trim())out.sign=game.pace.sign;
 return Object.keys(out).length?out:null;
}
// What is at stake, and its state now (the Quest tab's "At stake").
export function talesStakes(game){
 const st=stgStaging(game);if(!st)return [];
 return stgList(st.stakes).filter(k=>stagingPlain(k)&&typeof k.id==='string'&&typeof k.name==='string').map(k=>({name:stgClean(k.name,60),state:stgClean(stagingText(game.pace?.stakes?.[k.id],stagingLimits.stakeState)?game.pace.stakes[k.id]:k.state,80)}));
}
// The due beat in the game's own words, for a telling the game makes when the Dungeon Master cannot be reached.
export function beatLineOf(game){const due=beatDue(game),words=due?stgBeatWords(game,due):null;return words?.line||null;}
// A telling the game made itself (the Dungeon Master unreachable, or a calm move it tells) with the due beat's line
// added, marked so the beat counts as told (conversation.beatTold).
export function withBeatLine(body,game){
 const key=beatKey(game),line=beatLineOf(game);if(!key||!line||!body)return body;
 return {...body,narration:(String(body.narration??'').trim()+' '+line).trim().slice(0,1790),beatTold:key};
}
// The chapter's part for the Dungeon Master (dmSceneRules.js quest, with what lasts the tale: it changes once a
// chapter): where and how its truth is found, what the foe is doing now, the tale's length and chapter, and whether the
// foe is beyond reach. Null for a tale with no staging.
export function stagingQuest(game){
 const st=stgStaging(game);if(!st)return null;
 const ch=game.story.chapter??0,c=st.chapters[ch]??{};
 const length=writtenLengths.includes(st.length)?st.length:'short';
 return {...(stagingText(c.where,400)?{where:c.where}:{}),...(stagingText(c.agenda,400)?{agenda:c.agenda}:{}),pace:length[0].toUpperCase()+length.slice(1)+' tale, chapter '+(ch+1)+' of '+st.chapters.length+'.',...(bossOpen(game)?{}:{bossLater:true})};
}
// What a set piece or the boss fight is for (encounter.objective, read in the fight).
export function stagingObjective(game){
 const st=stgStaging(game);if(!st||!stgFighting(game))return null;
 if(game.wildFight){const f=st.chapters[game.story.chapter??0]?.fight;return stagingPlain(f)&&typeof f.at==='string'&&stagingIds(game).place(f.at)===game.wildFight.place&&stagingText(f.objective,300)?f.objective:null;}
 if(game.stage==='combat'&&!game.dungeon?.active&&stagingText(st.boss?.objective,300))return st.boss.objective;
 return null;
}
// What the Suggestions bar offers from the tale itself: on the opening turn its three first lines, and while a choice is
// open each option's line (filled into the message box, never sent).
export function taleSayLines(game){
 const st=stgStaging(game);if(!st||game.story.status!=='active'||stgFighting(game))return [];
 const opening=!stgList(game.playback).some(t=>stgList(t?.events).some(e=>e?.kind==='player'));
 if(opening&&Array.isArray(st.firstSay))return st.firstSay.filter(t=>typeof t==='string'&&t.trim()).slice(0,3);
 const c=stgOpenChoice(game);
 return c?c.options.filter(o=>stagingPlain(o)&&typeof o.say==='string'&&(o.if===undefined||o.if===null||beatHolds(game,o.if))).map(o=>o.say).slice(0,4):[];
}
// A written place's own arrival lines (staging.places colour), for a journey the game tells itself (calmLines.js).
export function placeColour(game,placeId){
 const st=stgStaging(game);if(!st||!stagingPlain(st.places))return [];
 for(const [name,v] of Object.entries(st.places))if(stagingIds(game).place(name)===placeId)return stgList(v?.colour).filter(t=>typeof t==='string'&&t.trim());
 return [];
}
// What the Quest tab and the journal show of a written tale (the stories spec, 1.6): its length and chapter, what is at
// stake now, the latest sign of the foe's plan (no counter), the choices made (and those left to fate) and the ending
// taken. Only what has happened: never a later chapter, a beat to come or an ending not reached. Null without a staging.
export function taleQuestView(game){
 const st=stgStaging(game);if(!st)return null;
 const length=writtenLengths.includes(st.length)?st.length:'short',p=stagingPlain(game.pace)?game.pace:{};
 const choices=Object.entries(stagingPlain(p.marks)?p.marks:{}).map(([c,o])=>{const opt=stgChoice(st,c)?.options.find(x=>stagingPlain(x)&&x.id===o);return opt?{label:stgClean(opt.label,80).replace(/[.\s]+$/,''),lapsed:stgList(p.fired).includes('lapsed:'+c)}:null;}).filter(Boolean);
 const ending=typeof p.ending==='string'?stgList(st.endings).find(e=>stagingPlain(e)&&e.id===p.ending):null;
 return {tier:length[0].toUpperCase()+length.slice(1)+' tale',stakes:talesStakes(game),sign:typeof p.sign==='string'&&p.sign.trim()?stgClean(p.sign,stagingLimits.sign):null,choices,ending:ending?stgClean(ending.title,60).replace(/[.\s]+$/,''):null};
}
// The latest sign of the foe's plan (calmLines.js adds it, once, to a journey or rest the game tells).
export const pressureSign=game=>stgStaging(game)&&typeof game.pace?.sign==='string'&&game.pace.sign.trim()?game.pace.sign:null;
// Lines for the story log (storyLog.js storyEvents): stakes that changed, choices made, the ending taken.
export function stagingLogLines(before,after){
 const st=stgStaging(after),out=[];if(!st)return out;
 const b=stagingPlain(before?.pace)?before.pace:{},a=stagingPlain(after.pace)?after.pace:{};
 for(const k of stgList(st.stakes))if(stagingPlain(k)&&typeof a.stakes?.[k.id]==='string'&&a.stakes[k.id]!==(b.stakes?.[k.id]??k.state))out.push(['quest','At stake: '+stgClean(k.name,60)+', '+a.stakes[k.id]+'.']);
 for(const [c,o] of Object.entries(stagingPlain(a.marks)?a.marks:{}))if(b.marks?.[c]!==o){const opt=stgChoice(st,c)?.options.find(x=>x?.id===o);if(opt)out.push(['quest',(stgList(a.fired).includes('lapsed:'+c)?'Left to fate: ':'You chose: ')+stgClean(opt.label,80).replace(/[.\s]+$/,'')+'.']);}
 if(typeof a.ending==='string'&&a.ending!==b.ending){const e=stgList(st.endings).find(x=>x?.id===a.ending);if(e)out.push(['quest','Ending: '+stgClean(e.title,60).replace(/[.\s]+$/,'')+'.']);}
 return out;
}
// ---------- The shelf's check of a copy (written-shelf.cjs) ----------
// The copy freshStoryGame makes of a written tale, checked as the shelf serves it: it seats a ready-made hero (the
// Fighter, or `hero`) into a valid adventure with an introduction and two chapters or more, its staging is sound, every
// name the staging uses resolves, nothing is armed or changed at the three starting places, and keeper and mara are
// never moved. {ok, problems}.
export function writtenCheck(story,{hero=null}={}){
 const problems=[];
 try{
  if(!stagingPlain(story)||!stagingPlain(story.staging))return {ok:false,problems:['the tale has no staging']};
  const who=hero??readyHero('fighter'),game=freshStoryGame(who,story,newAdventure(who)),s=game.story;
  if(!validAdventure(adventureSnapshot(who,game,null,true),who))problems.push('the seated game is not a valid adventure');
  if(!s.introduction)problems.push('the tale has no introduction');
  if(stgList(s.chapters).length<2)problems.push('the tale has fewer than two chapters');
  if(!validStaging(s))problems.push(...stagingProblems(s,{most:5}));
  if(!stagingPlain(game.pace))problems.push('the tale was not staged');
  const ids=stagingIds(game);
  for(const u of stagingNamesUsed(s.staging))if(u.kind!=='item'&&!(u.kind==='place'?ids.place(u.name):ids.person(u.name)))problems.push(u.path+': "'+u.name+'" names nothing in this tale');
  const starting=['inn','bridge','tower'],walk=(then,path)=>{if(!stagingPlain(then))return;
   if(stagingPlain(then.arm)&&starting.includes(ids.place(then.arm.at)))problems.push(path+'.arm: a fight at a starting place');
   if(stagingPlain(then.place)&&starting.includes(ids.place(then.place.at)))problems.push(path+'.place: a starting place changed');
   for(const k of ['bring','send']){const who2=k==='bring'?then.bring:then.send?.who;if(typeof who2==='string'&&['keeper','mara'].includes(ids.person(who2)))problems.push(path+'.'+k+': keeper and mara are never moved');}};
  stgList(s.staging.chapters).forEach((c,i)=>{if(!stagingPlain(c))return;const p='staging.chapters['+i+']';
   if(stagingPlain(c.fight)&&starting.includes(ids.place(c.fight.at)))problems.push(p+'.fight: a fight at a starting place');
   walk(c.then,p+'.then');walk(c.opening?.then,p+'.opening.then');for(const kind of ['beats','complications','pressure'])stgList(c[kind]).forEach((b,j)=>walk(b?.then,p+'.'+kind+'['+j+'].then'));stgList(c.choice?.options).forEach((o,j)=>walk(o?.then,p+'.choice.options['+j+'].then'));});
 }catch(e){problems.push('the tale does not seat: '+String(e?.message??e));}
 return {ok:problems.length===0,problems};
}
