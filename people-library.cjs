// The host's library of ready-made people (2026-10-16, the host's words: "use the api to generate 1000 completely
// unique npcs for the players to run into so that it doesn't eat up all of my credit as they progress" and "make sure
// to keep in mind every class, race, and gender"; then: "let's cut that npc amount to 300 for now and make sure they are
// all entirely unique"). Three hundred people, written once through the Dungeon Master
// (make-people-library.cjs, the 'people-batch' mode) and each painted once, live in .questbound-people/
// (library.json: [{id np001…np300, name, gender, species, age, role, class, appearance, personality, motive, voice, hook,
// placeKinds, terrains, toughness, attitude}] plus <id>.jpg; under QUESTBOUND_DATA when hosted); a second batch of about
// thirty more a species (np301…np690) is planned the same way. When the Dungeon
// Master brings someone new into a scene it is offered a few of them that suit where the hero is
// (context.world.peopleToMeet); a person it introduces from the list is stored whole with `pool:<id>`, and their
// portrait is that person's ready painting (world-art.cjs), so meeting them costs nothing to paint. Nobody is offered
// twice in one game.
// Faces (2026-10-22, the host: "make sure all unique faces painted are added to the library of potential faces in the
// game"): every face painted for someone in play is copied into the library by import-painted-faces.cjs as a face only
// (faces.json: [{id nf001…, faceOnly:true, species, gender, age, class, role, appearance, kin, traits, from, source,
// sha256, name, painted}] plus <id>.jpg). A face only is never offered to the Dungeon Master or the story writer as
// someone to meet or cast (it has no name, motive or hook of its own): it is a portrait for look-alikes and heroes.
// The running Dungeon Master keeps this module loaded (world-art.cjs loads it afresh when it loads): a change here needs
// world-art's revision and dm-server.cjs's literals raised together.
const fs=require('node:fs/promises'),fsSync=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const revision=3;
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
// People (np…) may be met; faces only (nf…) are portraits. Both are library faces.
const poolIdPattern=/^np\d{3}$/,faceOnlyPattern=/^nf\d{3,4}$/,faceIdPattern=/^(?:np\d{3}|nf\d{3,4})$/;
const limits={name:40,role:80,appearance:400,personality:120,motive:200,voice:80,hook:200};
const text=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
const list=(v,of,most)=>Array.isArray(v)&&v.length>=1&&v.length<=most&&v.every(x=>of.includes(x))&&new Set(v).size===v.length;
function validPerson(e){
 return !!e&&typeof e==='object'&&poolIdPattern.test(String(e.id))&&text(e.name,3,limits.name)&&genderList.includes(e.gender)&&speciesList.includes(e.species)&&ages.includes(e.age)&&text(e.role,3,limits.role)
  &&(e.class===null||classList.includes(e.class))&&text(e.appearance,20,limits.appearance)&&text(e.personality,3,limits.personality)&&text(e.motive,3,limits.motive)&&text(e.voice,0,limits.voice)&&text(e.hook,3,limits.hook)
  &&list(e.placeKinds,placeKinds,4)&&list(e.terrains,terrains,4)&&toughnessList.includes(e.toughness)&&attitudes.includes(e.attitude);
}
// What sets a face apart from the common peoples' (traitsOf). A face only with one of the `unlikeTraits` has no
// common species (null): it is shown only to someone of an invented people with the same features.
const traitList=['horns','tusks','scales','fur','muzzle','beak','feathers','antennae','gills','shell','bark','fungus','quills','tendrils'];
const unlikeTraits=new Set(['fur','muzzle','beak','feathers','antennae','gills','shell','bark','fungus','quills','tendrils']);
const kinPattern=/^[a-z][a-z-]{2,29}$/;
function validFace(e){
 return !!e&&typeof e==='object'&&e.faceOnly===true&&faceOnlyPattern.test(String(e.id))&&(e.species===null||speciesList.includes(e.species))&&genderList.includes(e.gender)&&ages.includes(e.age)&&(e.class===null||classList.includes(e.class))
  &&text(e.role,0,limits.role)&&text(e.appearance,20,limits.appearance)&&(e.kin===null||kinPattern.test(String(e.kin)))&&Array.isArray(e.traits)&&e.traits.length<=traitList.length&&e.traits.every(t=>traitList.includes(t))&&new Set(e.traits).size===e.traits.length
  &&(e.species!==null||e.traits.some(t=>unlikeTraits.has(t)))&&(e.from===null||text(e.from,1,120))&&/^[0-9a-f]{64}$/.test(String(e.source))&&/^[0-9a-f]{64}$/.test(String(e.sha256))&&(e.name===null||text(e.name,1,100))&&(e.painted===null||text(e.painted,1,40));
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
 const free=entries.filter(e=>!taken.has(e.id)&&!e.faceOnly);
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
// ---------- Reading someone from the words written about them ----------
// The look alone: a description without the painter's opening words ("A woman, with a woman's face…", "A man.") and
// without what the game adds after the look (the species and the role, joined on with ". ", so the look ends at the
// first ".."), nor the role when it is repeated at the end.
const openingWords=/^\s*(?:A woman, with a woman's face: smooth cheeks and chin, no beard, no moustache, no stubble or facial hair of any kind\.\s*|A man\.\s*|The player character, an adventurer\.\s*)+/i;
function lookText(description,role=''){
 let t=String(description??'').replace(openingWords,'');
 const cut=t.indexOf('.. ');if(cut>0)t=t.slice(0,cut+1);
 const r=String(role??'').trim();if(r.length>8){const at=t.lastIndexOf(r);if(at>0)t=t.slice(0,at);}
 return t.trim();
}
// Whether a description was written under the rule that a woman is painted with no facial hair (2026-10-02): the game
// opens every woman's description with these words since then.
const paintedAsWoman=description=>/^\s*A woman, with a woman's face: smooth cheeks and chin, no beard/i.test(String(description??''));
// Species named in words (earliest first; the longer name wins at the same place, so a half-elf is no elf).
const speciesPatterns=[[/\bhalf[- ]?el(?:f|ves|ven)\b/,'Half-Elf'],[/\bwood[- ]el(?:f|ves|ven)\b/,'Wood Elf'],[/\bhigh[- ]el(?:f|ves|ven)\b/,'High Elf'],[/\b(?:drow|dark[- ]el(?:f|ves|ven))\b/,'Drow'],[/\b(?:elf|elves|elven|elfin|elvish)\b/,'Elf'],[/\bdwar(?:f|fs|ves|ven|vish)\b/,'Dwarf'],[/\bgnom(?:e|es|ish)\b/,'Gnome'],[/\bgoblins?\b/,'Goblin'],[/\bgoliaths?\b/,'Goliath'],[/\bhalflings?\b/,'Halfling'],[/\b(?:half[- ]?orcs?|orcs?|orcish)\b/,'Orc'],[/\btieflings?\b/,'Tiefling'],[/\bdragonborn\b/,'Dragonborn'],[/\bhumans?\b/,'Human']];
function speciesOf(textIn){
 const t=String(textIn??'').toLowerCase();let best=null,at=Infinity,length=0;
 for(const [pattern,name] of speciesPatterns){const m=pattern.exec(t);if(m&&(m.index<at||(m.index===at&&m[0].length>length))){best=name;at=m.index;length=m[0].length;}}
 return best;
}
const lookAlikeSpecies=[...speciesList,'Elf','unknown'];
const speciesCandidates=s=>s==='Elf'?['High Elf','Wood Elf']:[s];
// Features some invented peoples have. Horns, tusks and scales point to a common people (a tiefling's, an orc's, a
// dragonborn's face); the others belong to none of them.
const traitPatterns={
 horns:/\b(?:horned|hornkin|horn-?crowned)\b|(?<!(?:hunting|drinking|powder|signal|war|brass|ox|cow|blowing|calling|horn|shoe|fog|green|tin)[- ]?)\bhorns\b(?![- ]?(?:rimmed|buttons?|combs?|handled|hilted|cups?|beads?|toggles?))|\b(?:one|left|right|broken|notched|chipped) horn\b(?![- ]?(?:rimmed|button|comb|handled|cup|bead|toggle))/,
 tusks:/\btusk(?:s|ed)?\b(?![- ]?(?:necklace|pendant|charm|hilt|handle|toggle|button|bead|comb|carving|knife|pipe|ring))/,
 scales:/\b(?:scaled|scaly|lizardfolk|saurian|scalekin)\b|\b[a-z]+scale\b|(?<!(?:of|brass|weighing|merchant'?s?|balance|tin|copper|pocket|trader'?s?|iron|bronze|gold|silver)\s)\bscales\b(?!\s+(?:of justice|and weights|hang|hung|at (?:his|her|their) belt))/,
 fur:/\b(?:tawny|russet|brindled|spotted|striped|sleek|dense|coarse|thick|short|grey|gray|brown|black|white|golden|silver|ruddy|sandy|dappled|red|cream|tabby)\s+fur\b(?![- ]?(?:trimmed|lined|cloak|collar|hat|cap|mantle|coat|vest|boots|hood|cape|wrap|stole|ruff))|\b(?:covered|furred) in fur\b|\bmane of (?:\w+ )*(?:fur|hair)\b(?=[^.]*\b(?:muzzle|snout)\b)|\b(?:jackalfolk|gnoll|catfolk|foxfolk|ratfolk|wolfkin|houndfolk|beastfolk|bearfolk)\b/,
 muzzle:/\b(?:muzzle|snout)\b(?![- ]?(?:guard|strap))/,
 beak:/\bbeak(?:ed)?\b|\b(?:birdfolk|ravenfolk|owlfolk|crowfolk)\b/,
 feathers:/\b(?:feathered|plumage)\b|\b(?:crest|crown|ruff|mane|cap) of (?:[\w-]+ )*feathers\b|\bfeathers (?:instead of|in place of|for) hair\b/,
 antennae:/\bantenn(?:ae|as)\b|\bcompound eyes\b|\bmothkin\b/,
 gills:/\bgills?\b|\bgill[- ]?(?:slits|frills)\b|\b(?:ear|neck)[- ]frills?\b|\bfin(?:like|-like)? (?:ear|ears|frills|crest)\b|\bfrills\b|\bwebbed (?:fingers|hands)\b/,
 shell:/\bshell\b(?=[^.]*\b(?:back|shoulders|smooth|pebbled|plated|mottled|scute)\b)|\bcarapace\b|\bshell-?scutes?\b|\bshell(?:kin|back)\b/,
 bark:/\bbark(?:like|-like)? skin\b|\bskin (?:like|of) bark\b|\bbarkskin\b/,
 fungus:/\b(?:myconid|mushroom|toadstool|sporekin|fungus[- ]?folk)\b/,
 quills:/\bquills\b|\bspines (?:instead of|in place of|for) hair\b|\bcrown of (?:[\w-]+ )*spines\b/,
 tendrils:/\btendrils (?:instead of|in place of|for) hair\b|\b(?:rope|root)-?like tendrils\b/,
};
function traitsOf(look){
 const t=String(look??'').toLowerCase(),found=new Set(traitList.filter(k=>traitPatterns[k].test(t)));
 // A scaled people's snout, frills and crest are a lizard's, which a dragonborn face has.
 if(found.has('scales'))for(const k of ['muzzle','gills','quills'])found.delete(k);
 return traitList.filter(k=>found.has(k));
}
const unlikeOf=traits=>(Array.isArray(traits)?traits:[]).filter(t=>unlikeTraits.has(t));
// The common people nearest to someone of a people the library has nobody of (an invented people), or null when none
// is near (fur, a beak, antennae, gills, a shell…): scales a dragonborn, horns a tiefling, tusks an orc, stone-grey skin
// a goliath, green skin an orc (a goblin when small), violet or ashen skin a drow, red or blue skin a tiefling, pointed
// ears a half-elf, and anyone else a human.
function nearestSpecies(look,traits=traitsOf(look),kin=null){
 const t=String(look??'').toLowerCase(),k=String(kin??'').toLowerCase(),has=new Set(traits);
 if(unlikeOf(traits).length)return null;
 if(has.has('scales')||/scale|lizard|drake|dragon/.test(k))return 'Dragonborn';
 if(has.has('horns')||/horn/.test(k))return 'Tiefling';
 if(has.has('tusks')||/tusk/.test(k))return 'Orc';
 const tones=[...t.matchAll(/\b((?:[a-z]+-)*[a-z]+)[- ](?:skin(?:ned)?|complexion)\b/g)].map(m=>m[1]).join(' ');
 if(/\b(?:stone|slate|basalt|granite|flint|quartz|rock)\b/.test(tones)||/stone|rock|granite|basalt/.test(k))return 'Goliath';
 if(/\b(?:green|moss|mossy|sage|jade)\b/.test(tones)||/moss/.test(k))return /\b(?:small|slight|short|tiny|little)\b/.test(t)&&!/\b(?:broad|strong|heavy|heavyset|tall|big|powerful|burly)\b/.test(t)?'Goblin':'Orc';
 if(/\b(?:violet|lavender|obsidian|charcoal|ashen)\b/.test(tones))return 'Drow';
 if(/\b(?:red|crimson|scarlet|purple|lilac|plum|blue|cobalt|indigo|teal)\b/.test(tones))return 'Tiefling';
 if(/\b(?:pointed|tapered|leaf-shaped) ears\b/.test(t))return 'Half-Elf';
 return 'Human';
}
// The name of an invented people the words give ("a 61-year-old mosskin woman", "a lean, long-armed drel with", or the
// species the game adds after a person's look), or null. Only asked when no common people is named.
const notKin=new Set('buckskin sealskin oilskin kidskin lambskin goatskin deerskin calfskin moleskin doeskin sharkskin pigskin wolfskin bearskin pumpkin napkin bumpkin catkin bodkin firkin jerkin gherkin manikin mannikin lambkin siskin welkin buskin ramekin pipkin firstborn highborn lowborn newborn stubborn freeborn baseborn inborn townsfolk kinsfolk menfolk womenfolk fisherfolk countryfolk shoehorn foghorn longhorn bighorn tinhorn greenhorn'.split(' '));
const kinSuffix=/^[a-z]{3,}(?:kin|folk|born|scale|horn|blood|spawn)$/;
const looksWords=new Set('lean tall short wiry slight broad stocky sturdy compact small large thin heavyset stout spare lanky rangy gaunt plump round muscular powerful slender lithe willowy squat burly hulking narrow long young old elderly aged weathered scarred grizzled greying graying silver tired stooped proud quiet nervous cheerful stern grim kindly sharp heavy hardy strong frail pale dark fair freckled bald bearded retired former local travelling traveling wandering nonbinary androgynous adult figure soul big little tiny bony sinewy hunched upright straight-backed broad-shouldered long-limbed long-armed narrow-shouldered heavy-set well-built barrel-chested barrel-built round-faced sharp-eyed one-eyed soft-spoken middle-aged white-haired grey-haired gray-haired and very rather'.split(' '));
const commonKinds=new Set(['human','humans','elf','elves','elven','dwarf','dwarves','orc','orcs','half-orc','goblin','goblins','halfling','halflings','gnome','gnomes','tiefling','tieflings','goliath','goliaths','dragonborn','drow','half-elf','woman','man','person','unknown']);
const tidyKin=w=>{const k=String(w??'').toLowerCase().replace(/[^a-z -]+/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,30);return kinPattern.test(k)&&!commonKinds.has(k)?k:null;};
const participle=w=>/(?:ed|ly|ish|ful)$/.test(w)||(/ing$/.test(w)&&!/ling$/.test(w));
function kinOf(description,look=lookText(description)){
 // The species the game adds after the look: a short sentence of its own.
 const s=appendedSpecies(description);
 if(/^[a-z][a-z' -]{2,29}$/.test(s)&&s.split(/\s+/).length<=2&&!/\b(?:a|an|the|who|and|of)\b/.test(s)){const k=tidyKin(s);if(k)return k;}
 const first=String(look??'').toLowerCase().split(/(?<=[.!?])\s+/)[0];
 for(const w of first.match(/[a-z]{3,}/g)??[])if(kinSuffix.test(w)&&!notKin.has(w)&&!/skin$/.test(w)&&!commonKinds.has(w))return w;
 const lead=/(?:\b(?:\d{1,3}|[a-z]+(?:-[a-z]+)?)[- ]years?[- ]old|(?:^|\b(?:is|was)\s)an?)\s+((?:[a-z-]+,?\s+){0,4}?)([a-z-]+)\s+(?:woman|man|person|with|who|of|in)\b/g;let m;
 while((m=lead.exec(first))){
  const before=m[1].split(/[\s,]+/).filter(Boolean),w=m[2];
  if(!before.every(b=>looksWords.has(b)||participle(b)))continue;
  if(looksWords.has(w)||commonKinds.has(w)||participle(w))continue;
  const k=tidyKin(w);if(k)return k;
 }
 return null;
}
// How old someone looks, in the library's bands: years first ("a 61-year-old", "At 34", "Age 29", "a woman of fifty",
// "in her late fifties"), then words.
const tens={twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
const units={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9};
const teens={ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19};
function spelled(w){w=String(w).toLowerCase();if(/^\d+$/.test(w))return Number(w);if(teens[w])return teens[w];if(units[w])return units[w];const m=/^(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](one|two|three|four|five|six|seven|eight|nine))?$/.exec(w);return m?tens[m[1]]+(m[2]?units[m[2]]:0):null;}
const tensWord='(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?';
const teenWord='ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen';
const bigNumber='(\\d{2,3}|'+tensWord+'|'+teenWord+')',anyNumber='(\\d{1,3}|'+tensWord+'|'+teenWord+'|one|two|three|four|five|six|seven|eight|nine)';
const yearsPatterns=[new RegExp('(?<![a-z]-)\\b'+anyNumber+'[- ]years?[- ]old\\b'),new RegExp('\\bage[ds]?:? '+bigNumber+'\\b'),new RegExp('\\bat '+bigNumber+'\\b'),new RegExp('\\b(?:woman|man|person|adult|soul) of '+bigNumber+'\\b'),new RegExp('\\b(?:is|was) '+bigNumber+'\\b')];
function yearsOf(look){
 const t=String(look??'').toLowerCase().split(/(?<=[.!?])\s+/).slice(0,2).join(' ');
 for(const p of yearsPatterns){const m=p.exec(t);if(m){const n=spelled(m[1]);if(n&&n<=999)return n;}}
 const d=/\b(?:in )?(?:his|her|their) (early |mid-?|late )?(twenties|thirties|forties|fifties|sixties|seventies|eighties|nineties)\b/.exec(t);if(d)return tens[d[2].slice(0,-3)+'y']+(d[1]?.startsWith('early')?2:d[1]?.startsWith('late')?8:5);
 return null;
}
const longLived=new Set(['Dwarf','High Elf','Wood Elf','Drow','Gnome','Elf']);
const bandOfYears=(n,species=[])=>n>=100&&species.some(s=>longLived.has(s))?(n<175?'adult':n<350?'middle-aged':'old'):n<26?'young':n<45?'adult':n<60?'middle-aged':'old';
const ageWords=t=>/\b(?:middle[- ]aged|forties|fifties|greying|graying|grizzled)\b/.test(t)?'middle-aged':/\b(?:elderly|aged|ancient|venerable|wizened|sixties|seventies|eighties|white[- ]haired|silver[- ]haired|crone|grandmother|grandfather|old (?:man|woman|soldier|sailor|priest|priestess|hermit|widow|widower|farmer|fisherman|fisherwoman|smith|dwarf|elf|human|gnome|halfling|orc|goblin|goliath|tiefling))\b/.test(t)?'old':/\b(?:young|youthful|youth|teenage|twenties|barely grown|lad|lass)\b/.test(t)?'young':null;
function ageOf(look,species=[]){const n=yearsOf(look);return n?bandOfYears(n,species):ageWords(String(look??'').toLowerCase());}
const womanWordsHere=/\b(?:she|her|hers|herself|woman|lady|female|mother|sister|daughter|wife|widow|queen|princess|priestess|matron|maiden|aunt|grandmother|abbess|huntress|sorceress|seamstress|midwife|crone)\b/g,manWordsHere=/\b(?:he|him|his|himself|man|male|father|brother|son|husband|widower|king|prince|uncle|grandfather|abbot)\b/g;
const genderFromWords=t=>{const w=(t.match(womanWordsHere)??[]).length,m=(t.match(manWordsHere)??[]).length;return w>m?'woman':m>w?'man':null;};
// Whether the words make someone neither a woman nor a man ("nonbinary", "androgynous", or only "they").
const otherFromWords=t=>/\b(?:nonbinary|non-binary|androgynous)\b/.test(t)||(/\b(?:they|their|them|themself|themselves)\b/.test(t)&&!genderFromWords(t));
// A gender from the words: what they say, else a beard makes a man, else "they" someone neither; null when nothing says.
const genderOfWords=textIn=>{const t=String(textIn??'').toLowerCase();return genderFromWords(t)??(facialHair.test(t)?'man':otherFromWords(t)?'other':null);};
// The species the game adds after a person's look (".. mosskin. A fish seller…"), lower case, or ''.
const appendedSpecies=description=>(String(description??'').split(/\.\.\s+/)[1]??'').split(/(?<=[.!?])\s+/)[0].replace(/[.!?\s]+$/,'').trim().toLowerCase();
// Nobody in the library is a child, and nobody is a ghost, a walking corpse, a construct or a beast: those are painted.
// Read where the words say what someone is (their name, the opening clause of their look and of their role), so a
// skeleton key, a dragon tattoo, kid gloves, a beast-hunter, "a giant of a man" or a "fifty-two-year-old" are no
// reason to paint.
const childWords=/\b(?:child|kid(?![- ]?(?:gloves?|skin|leather|boots))|toddler|infant|baby(?![- ]?(?:faced|face|fat|soft|blue))|boy|girl|urchin|youngster|lad|lass)\b/;
const beingWords=/\b(?:undead(?![- ](?:hunter|slayer))|skeleton(?![- ]?keys?)|skeletal|zombie|corpse(?![- ](?:pale|white|grey|gray|collector|bearer|carrier|cart))|ghost(?![- ](?:stories|story|pale|white|lantern|light|hunter|teller))|ghostly(?![- ](?:pale|white))|spectral|spectre|specter|spirit(?![- ](?:talker|speaker|caller|reader|medium|guide|singer|seer|worker|binder|keeper|lamp|lantern|charm|board|drum|mask|bottle|ward))|wraith|lich|vampire(?![- ]bat)|ghoul|revenant|wight|mummy|phantom|apparition|construct|golem|automaton|elemental(?![- ](?:magic|charms?|sigils?|runes?|tattoos?))|fiend|demon|devil(?!-may-care)|abomination|beast(?![- ](?:hunter|tamer|keeper|master|speaker|handler|trainer|catcher|healer|doctor|herd))|monster(?![- ](?:hunter|slayer|catcher))|werewolf|lycanthrope|shapeshifter|hag|giant(?!\s+of\s+an?\s)(?![- ](?:sized|built|framed|hands?|frame|build|strength|stature))|ogre|troll|dragon(?![- ]?(?:tattoo|scale|bone|hide|pendant|brooch|amulet|emblem|crest|banner|clasp|ring|figurehead|carving|charm|head|shaped|born))|wyrm)\b/;
const childYears=new RegExp('(?<!(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[- ]?)\\b(?:[1-9]|1[0-3]|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen)[- ]years?[- ]old\\b(?![- ]?(?:son|daughter|child|children|brother|sister|boy|girl|grandson|granddaughter|niece|nephew|ward|apprentice|horse|mule|dog|goat|wine|cask))');
const headOf=t=>String(t??'').toLowerCase().split(/[,;:.!?]|\s(?:with|who|whose|wearing|carrying|in a|in an)\s/)[0].slice(0,120);
function notALibraryFace(subject){
 const look=lookText(subject?.description,subject?.role),first=look.toLowerCase().split(/(?<=[.!?])\s+/)[0];
 const heads=[headOf(look),headOf(subject?.role),String(subject?.name??'').toLowerCase()];
 if(heads.some(h=>childWords.test(h)||beingWords.test(h))||childYears.test(first))return true;
 return /\b(?:undead|zombie|lich|wraith|wight|revenant|ghoul|spectre|specter|phantom|apparition|golem|automaton|translucent|incorporeal)\b/.test(first);
}
// ---------- Look-alikes ----------
// Look-alikes (2026-10-16, the host's words: "make sure all of those along with all of the previously generated
// images for landscapes are implemented into the game to save API credits"; 2026-10-22: "make sure all unique faces
// painted are added to the library of potential faces"). Anyone shown with a portrait who is not a player's hero and
// not themselves from the library (a tale's keeper and mara, its residents, people the Dungeon Master invents, a tale's
// foe who is a person) is shown with the face of the library person or face only that looks most like them (world-art.cjs
// asks lookAlike), so nobody is painted while a face fits. The match: the same species and gender (any gender of that
// species when it is not known), then the same training (a trained person one trained in their class first, then
// another trained one; an ordinary person an ordinary one), then age, then calling and look in words; repeatable (a
// hash of the tale, the person and the picture). Someone of an invented people (a species none of the common peoples)
// is matched as the common people nearest them (nearestSpecies), their own people's faces first (the same `kin`, then
// the same features); one whose features no common people has (fur, a beak, antennae, gills…) only with faces that
// share them. A face only of an invented people is shown only to invented peoples, never to a common one. One face to
// one person in a tale while another of their kind is free: people from the library in the game (avoid), faces already
// given in the tale (and in its ready journey's own campaign, related) and faces painted for that very tale (from) are
// taken; when every face that fits is taken, the one used least in the tale is shown again rather than painting. Each
// tale's picks are kept (.questbound-art/people-picks/), so a person never changes face. A child, a ghost or a beast,
// or someone whose features no face in the library shares, is painted.
// What a subject is matched on, or null when the library holds nobody like them (world-art.cjs validateSubject has
// already kept only known values: species one of lookAlikeSpecies, gender, trained a class, kin a word). A portrait
// without a species (an older client) is read from its words; a creature only ever by the species it says, or (an
// invented people) when its words say it is a woman, a man or a person.
function lookAlikeOf(subject){
 if(!subject||!['portrait','creature'].includes(subject.kind))return null;
 if(notALibraryFace(subject))return null;
 const words=String(subject.description??''),look=lookText(words,subject.role),low=look.toLowerCase(),role=String(subject.role??'');
 const given=lookAlikeSpecies.includes(subject.species)&&subject.species!=='unknown'?subject.species:null;
 // No species sent (an older client): read from the look, then from the species the game adds after it.
 const named=given??(subject.kind==='portrait'&&(subject.species===undefined||subject.species===null)?speciesOf(low)??speciesOf(appendedSpecies(words)):null);
 const gender=genderList.includes(subject.gender)?subject.gender:genderOfWords(words);
 const base={gender,trained:classList.includes(subject.trained)?subject.trained:null,role:wordsOf(role),look:wordsOf(look)};
 if(named)return {...base,species:speciesCandidates(named),age:ageOf(low,speciesCandidates(named)),invented:false,kin:null,traits:traitsOf(low)};
 // An invented people (a creature only when its words make it a person).
 if(subject.kind==='creature'&&!(subject.species==='unknown'&&/\b(?:woman|man|person)\b/.test(headOf(look))))return null;
 const kin=typeof subject.kin==='string'&&kinPattern.test(subject.kin)?subject.kin:kinOf(words,look),traits=traitsOf(low),near=nearestSpecies(low,traits,kin);
 return {...base,species:near?[near]:[],age:ageOf(low,near?[near]:[]),invented:true,kin,traits};
}
const stopWords=new Set('the and with her his their its who has have from for into over under that this they them she him are was were one two some all any not but out off very more most little small large long short older young old years year face eyes hair woman man person people adult wears wearing worn keeps kept carries carrying looks look like than then when where what which while each other own just only also about after before always never often still well much many'.split(' '));
const wordCache=new WeakMap();
function wordsOf(textIn){const t=String(textIn??'').toLowerCase();return new Set((t.match(/[a-z]{3,}/g)??[]).filter(w=>!stopWords.has(w)));}
function entryWords(e){let w=wordCache.get(e);if(!w){w={role:wordsOf(e.role),look:wordsOf(e.appearance)};wordCache.set(e,w);}return w;}
const overlap=(a,b)=>{if(!a.size||!b.size)return 0;let n=0;for(const w of a)if(b.has(w))n++;return n/(a.size+b.size-n);};
// Whether a library face can stand for this subject: for a common people, a face of that people with nothing of an
// invented people about it; for an invented one, a face of their own people (kin), or one whose features match theirs
// (all of the features no common people has, both ways but one), or one of the nearest common people with none.
function faceFits(e,match){
 const faceUnlike=unlikeOf(e.traits);
 if(!match.invented)return match.species.includes(e.species)&&!e.kin&&!faceUnlike.length;
 if(match.kin&&e.kin===match.kin)return true;
 const mine=unlikeOf(match.traits);
 if(mine.length){const shared=mine.filter(t=>faceUnlike.includes(t)).length;return shared>=Math.max(1,Math.ceil(mine.length/2))&&faceUnlike.filter(t=>!mine.includes(t)).length<=1;}
 return match.species.includes(e.species)&&!faceUnlike.length;
}
// The face that looks most like them, first among those nobody in this tale has (`taken`: a Set, or a Map of how
// often each is used); when every face that fits is taken, the one used least (then the best); null when nothing fits.
function choosePortrait(entries,match,{campaignId='',personId='',taken=new Set(),usable=()=>true}={}){
 const fits=entries.filter(e=>faceFits(e,match));
 const same=(match.gender?fits.filter(e=>e.gender===match.gender):fits).filter(usable);
 if(!same.length)return null;
 const uses=id=>taken instanceof Map?(taken.get(id)??0):taken.has(id)?1:0;
 const least=Math.min(...same.map(e=>uses(e.id))),list=same.filter(e=>uses(e.id)===least),order=ages;
 const trait=e=>{const a=new Set(match.traits??[]),b=new Set(e.traits??[]);if(!a.size&&!b.size)return 1;let n=0;for(const t of a)if(b.has(t))n++;return n/(a.size+b.size-n);};
 const score=e=>{const w=entryWords(e);return [match.invented?(match.kin&&e.kin===match.kin?2:0)+trait(e):0,match.trained?(e.class===match.trained?2:e.class?1:0):(e.class?0:2),match.age?2-Math.min(2,Math.abs(order.indexOf(e.age)-order.indexOf(match.age))):0,2*overlap(match.role,w.role)+overlap(match.look,w.look),preference(campaignId+'\n'+personId,e.id)];};
 const better=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]>b[i];return false;};
 let best=null,bestScore=null;
 for(const e of list){const s=score(e);if(!bestScore||better(s,bestScore)){best=e;bestScore=s;}}
 return best;
}
function createPeopleLibrary({directory=path.join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-people'),refreshMs=30000,cacheEntries=30,picksDirectory=null,campaignsKept=300,picksPerCampaign=600}={}){
 let entries=[],faces=[],byId=new Map(),faceById=new Map(),checkedAt=0,stamp=null;
 const stampOf=async file=>{try{const info=await fs.stat(file);return info.mtimeMs+':'+info.size;}catch{return '-';}};
 const readList=async file=>{try{const raw=JSON.parse(await fs.readFile(file,'utf8'));return Array.isArray(raw)?raw:[];}catch{return [];}};
 // library.json (the people) and faces.json (faces only) grow while they are written: looked at again at most every
 // refreshMs.
 async function refresh(){
  if(Date.now()-checkedAt<refreshMs&&checkedAt)return;checkedAt=Date.now();
  try{
   const peopleFile=path.join(directory,'library.json'),facesFile=path.join(directory,'faces.json'),now=(await stampOf(peopleFile))+'|'+(await stampOf(facesFile));
   if(now===stamp)return;
   const seen=new Set(),names=new Set();
   entries=(await readList(peopleFile)).slice(0,2000).filter(e=>validPerson(e)&&!seen.has(e.id)&&!names.has(e.name.toLowerCase())&&seen.add(e.id)&&names.add(e.name.toLowerCase())).map(e=>({id:e.id,name:e.name.trim(),gender:e.gender,species:e.species,age:e.age,role:e.role.trim(),class:e.class,appearance:e.appearance.trim(),personality:e.personality.trim(),motive:e.motive.trim(),voice:e.voice.trim(),hook:e.hook.trim(),placeKinds:e.placeKinds,terrains:e.terrains,toughness:e.toughness,attitude:e.attitude}));
   faces=(await readList(facesFile)).slice(0,5000).filter(e=>validFace(e)&&!seen.has(e.id)&&seen.add(e.id)).map(e=>({id:e.id,faceOnly:true,gender:e.gender,species:e.species,age:e.age,role:e.role.trim(),class:e.class,appearance:e.appearance.trim(),kin:e.kin,traits:e.traits,from:e.from}));
   byId=new Map(entries.map(e=>[e.id,e]));faceById=new Map([...entries,...faces].map(e=>[e.id,e]));stamp=now;
  }catch{entries=[];faces=[];byId=new Map();faceById=new Map();stamp=null;}
 }
 // Portraits are kept in memory, the most recently shown few dozen.
 const pictures=new Map();
 async function portrait(id){
  if(!faceIdPattern.test(String(id)))return null;
  if(pictures.has(id)){const dataUrl=pictures.get(id);pictures.delete(id);pictures.set(id,dataUrl);return dataUrl;}
  let bytes;try{bytes=await fs.readFile(path.join(directory,id+'.jpg'));}catch{return null;}
  if(bytes.length<4||bytes.length>12_000_000||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)return null;
  const dataUrl='data:image/jpeg;base64,'+bytes.toString('base64');
  pictures.set(id,dataUrl);while(pictures.size>cacheEntries)pictures.delete(pictures.keys().next().value);
  return dataUrl;
 }
 const hasPortrait=id=>faceIdPattern.test(String(id))&&fsSync.existsSync(path.join(directory,id+'.jpg'));
 // Each tale's faces ({person id: library id}, look-alikes and library people shown alike) are one small file, read
 // once and kept for the most recent tales; one tale's faces are chosen one at a time, so two people shown together
 // never take the same face.
 const campaigns=new Map(),locks=new Map(),bad=new Set();
 const picksFile=campaignId=>path.join(picksDirectory,crypto.createHash('sha256').update('questbound-people-picks\n'+campaignId).digest('hex').slice(0,40)+'.json');
 async function picksOf(campaignId){
  if(campaigns.has(campaignId)){const picks=campaigns.get(campaignId);campaigns.delete(campaignId);campaigns.set(campaignId,picks);return picks;}
  let picks={};
  if(picksDirectory)try{const saved=JSON.parse(await fs.readFile(picksFile(campaignId),'utf8'));if(saved?.campaignId===campaignId&&saved.picks&&typeof saved.picks==='object')picks=Object.fromEntries(Object.entries(saved.picks).filter(([k,v])=>typeof k==='string'&&k.length<=100&&faceIdPattern.test(String(v))).slice(0,picksPerCampaign));}catch{}
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
 // A library face shown in a tale (a person with `pool`, or a hero's face) is noted, so nobody else there is given it.
 function notePool(campaignId,personId,id){
  if(typeof campaignId!=='string'||typeof personId!=='string'||!faceIdPattern.test(String(id)))return Promise.resolve();
  return serial(campaignId,async()=>keep(campaignId,await picksOf(campaignId),personId,id));
 }
 // The faces already given in these tales (dm-server.cjs keeps them out of peopleToMeet).
 async function takenIn(campaignIds){
  const out=new Set();
  for(const id of (Array.isArray(campaignIds)?campaignIds:[]).filter(c=>typeof c==='string'&&c.length&&c.length<=120).slice(0,4))for(const v of Object.values(await picksOf(id)))out.add(v);
  return out;
 }
 // {status:'ready', key, dataUrl, library: id} with the library face most like this subject, else null.
 async function lookAlike(subject,key){
  const match=lookAlikeOf(subject);if(!match)return null;
  await refresh();if(!entries.length&&!faces.length)return null;
  return serial(subject.campaignId,async()=>{
   const picks=await picksOf(subject.campaignId);
   for(let attempt=0;attempt<3;attempt++){
    let entry=faceById.get(picks[subject.id]);
    if(!entry||bad.has(entry.id)){
     const related=typeof subject.related==='string'&&subject.related!==subject.campaignId?await picksOf(subject.related):{};
     // How often each face is shown in this tale already; a face painted for this very tale is someone's own face.
     const taken=new Map(),use=(id,n=1)=>taken.set(id,(taken.get(id)??0)+n);
     for(const [id,v] of Object.entries(picks))if(id!==subject.id)use(v);
     for(const v of Object.values(related))use(v);
     for(const v of Array.isArray(subject.avoid)?subject.avoid:[])use(v);
     const tales=new Set([subject.campaignId,subject.related].filter(Boolean));
     for(const f of faces)if(f.from&&tales.has(f.from))use(f.id,1000);
     entry=choosePortrait([...entries,...faces],match,{campaignId:subject.campaignId,personId:subject.id,taken,usable:e=>!bad.has(e.id)&&hasPortrait(e.id)});
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
 // The people to offer the Dungeon Master where the hero is: suited, unused in this game (never a face only).
 async function suited(options){await refresh();return suitedPeople(entries,options);}
 async function get(id){await refresh();return byId.get(id)??null;}
 return {refresh,suited,get,portrait,hasPortrait,lookAlike,notePool,takenIn,entries:()=>entries,faces:()=>faces,allFaces:()=>[...entries,...faces]};
}
// The Dungeon Master's copy (dm-server.cjs reads it through loadPeople()).
const people=createPeopleLibrary();
module.exports={revision,createPeopleLibrary,people,suitedPeople,lookAlikeOf,choosePortrait,faceFits,speciesOf,lookAlikeSpecies,toMeet,filledIntroduce,validPerson,validFace,portraitText,portraitSubject,withoutFacialHair,peopleCampaign,poolIdPattern,faceOnlyPattern,faceIdPattern,speciesList,classList,genderList,placeKinds,terrains,ages,toughnessList,attitudes,limits,
 lookText,paintedAsWoman,traitsOf,traitList,unlikeTraits,unlikeOf,nearestSpecies,kinOf,tidyKin,yearsOf,ageOf,genderFromWords,otherFromWords,genderOfWords,appendedSpecies,notALibraryFace};
