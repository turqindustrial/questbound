// The reply schema the Dungeon Master writes to (moved out of dm-server.cjs on 2026-10-20, code unchanged): one schema
// for every turn (replySchemaFor), the schemas of its parts, the kinds they allow (places, creatures, ties, classes...)
// and what each phase may return (phaseFields). It goes with the standing instructions and must stay byte for byte
// the same for every player, phase, retry and second look (verify-dm-cache.cjs, verify-dm-reliable.cjs strict check).
// dm-server.cjs drops this module from require.cache and loads it afresh with itself on every request.
// Magic items come from the catalogue below (SRD 5.2 items whose effects the game applies), never from the telling.
const magicRarity={'weapon+1':'uncommon','weapon+2':'rare','weapon+3':'very rare','armor+1':'rare','armor+2':'very rare','shield+1':'uncommon','shield+2':'rare','shield+3':'very rare','cloak-of-protection':'uncommon','ring-of-protection':'rare','stone-of-good-luck':'uncommon','bracers-of-defense':'rare','gauntlets-of-ogre-power':'uncommon','headband-of-intellect':'uncommon','boots-of-elvenkind':'uncommon','cloak-of-elvenkind':'uncommon','eyes-of-the-eagle':'uncommon','wand-of-the-war-mage+1':'uncommon','wand-of-the-war-mage+2':'rare','wand-of-the-war-mage+3':'very rare','wand-of-magic-missiles':'uncommon','periapt-of-wound-closure':'uncommon','potion-greater-healing':'uncommon','potion-superior-healing':'rare','potion-supreme-healing':'very rare'};
const magicIds=Object.keys(magicRarity),rarityOrder=['uncommon','rare','very rare'];
// The rarest reward a hero of this level may be given: uncommon to level 4, rare to 10, very rare after.
const rarityFor=level=>level>=11?'very rare':level>=5?'rare':'uncommon';
const lootSchema=max=>({type:['object','null'],properties:{gold:{type:'integer'},items:{type:'array',maxItems:max,items:{type:'object',properties:{name:{type:'string'},kind:{type:'string',enum:['weapon','armor','potion','ammunition','treasure','gear','quest']},qty:{type:'integer'},value:{type:'number'},note:{type:'string'},magic:{type:['string','null'],enum:[null,...magicIds]}},required:['name','kind','qty','value','note','magic'],additionalProperties:false}},reason:{type:'string'}},required:['gold','items','reason'],additionalProperties:false});
const tieKindsList=['family','beloved','close friend','friend','ally','acquaintance','rival','enemy'],foeTieList=['kin','beloved','ally','neutral','enemy'];
const regardStanceList=['kin','warm','curious','indifferent','wary','scornful'],terrainKinds=['plains','forest','hills','mountains','coast','marsh','desert','snow','caverns'];
// The classes a trained person (or a companion) can fight as: the SRD classes and the Artificer (npcRules.js npcClassList).
const npcClassNames=['Artificer','Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard'];
const introduceSchema=(ids,poolIds=[])=>({type:['object','null'],properties:{...(poolIds===null?{pool:{type:['string','null']}}:poolIds.length?{pool:{type:['string','null'],enum:[null,...poolIds]}}:{}),name:{type:'string'},species:{type:'string'},role:{type:'string'},appearance:{type:'string'},personality:{type:'string'},toughness:{type:'string',enum:['frail','common','tough']},attitude:{type:'string',enum:['hostile','unfriendly','indifferent','friendly']},foe:{type:'string',enum:foeTieList},tie:{type:['object','null'],properties:{to:ids?{type:'string',enum:ids}:{type:'string'},kind:{type:'string',enum:tieKindsList}},required:['to','kind'],additionalProperties:false},gender:{type:'string',enum:['woman','man','other']},regard:{type:'object',properties:{stance:{type:'string',enum:regardStanceList},reason:{type:'string'}},required:['stance','reason'],additionalProperties:false},class:{type:['string','null'],enum:[null,...npcClassNames]}},required:[...(poolIds===null||poolIds.length?['pool']:[]),'name','species','role','appearance','personality','toughness','attitude','foe','tie','gender','regard','class'],additionalProperties:false});
const relationshipSchema=(max,ids=['keeper','mara'])=>({type:'array',maxItems:max,items:{type:'object',properties:{npcId:ids?{type:'string',enum:ids}:{type:'string'},change:{type:'string',enum:['pleased','grateful','offended','angered','bond','grudge','amends','forgave','ally','parts']},memory:{type:'string'}},required:['npcId','change','memory'],additionalProperties:false}});
const placeKinds=['settlement','camp','road','forest','wilds','mountain','water','ruin','cave','shrine','landmark','lair'],compass=['N','NE','E','SE','S','SW','W','NW'];
const creatureKinds=['bandit','wolf','goblin','skeleton','boar','spider','zombies','orc','wolves'];
// A creature can bring one of another kind at its side (a bandit's hound, a goblin on a worg); never a pack.
const allyKinds=['bandit','wolf','goblin','skeleton','boar','spider','orc'];
const allySchema={type:['object','null'],properties:{template:{type:'string',enum:allyKinds},name:{type:'string'},appearance:{type:'string'}},required:['template','name','appearance'],additionalProperties:false};
const creatureSchema={type:['object','null'],properties:{template:{type:'string',enum:creatureKinds},name:{type:'string'},appearance:{type:'string'},ally:allySchema},required:['template','name','appearance','ally'],additionalProperties:false};
const discoverySchema={type:['object','null'],properties:{name:{type:'string'},description:{type:'string'},kind:{type:'string',enum:placeKinds},bearing:{type:'string',enum:compass},miles:{type:'number'},travel:{type:'boolean'},danger:{type:'string',enum:['safe','risky','lair']},feature:{type:['string','null']},lair:creatureSchema,region:{type:['object','null'],properties:{name:{type:'string'},terrain:{type:'string',enum:terrainKinds}},required:['name','terrain'],additionalProperties:false}},required:['name','description','kind','bearing','miles','travel','danger','feature','lair','region'],additionalProperties:false};
const checkSchema={type:['object','null'],properties:{skill:{type:['string','null'],enum:[null,'Acrobatics','Animal Handling','Arcana','Athletics','Deception','History','Insight','Intimidation','Investigation','Medicine','Nature','Perception','Performance','Persuasion','Religion','Sleight of Hand','Stealth','Survival']},ability:{type:'string',enum:['Strength','Dexterity','Constitution','Intelligence','Wisdom','Charisma']},dc:{type:'integer'},mode:{type:'string',enum:['normal','advantage','disadvantage']},reason:{type:'string'},success:{type:'string'},failure:{type:'string'},damageCount:{type:'integer'},damageDie:{type:'integer'},damageOn:{type:'string',enum:['failure','always','none']}},required:['skill','ability','dc','mode','reason','success','failure','damageCount','damageDie','damageOn'],additionalProperties:false};
const rulingSchema={type:['object','null'],properties:{decision:{type:'string',enum:['cast','deny','clarify']},note:{type:'string'},damage:{type:'integer'},selfDamage:{type:'integer'},healing:{type:'integer'},temporaryHP:{type:'integer'}},required:['decision','note','damage','selfDamage','healing','temporaryHP'],additionalProperties:false};
// The reply's `remember` field (the story so far, memoryRules.js): at most two facts, each one sentence the game cannot
// see in its own records, with the ids it concerns, or settling a fact listed in context.memory by its id. Valid in
// strict mode: always present, empty when there is nothing to keep.
const rememberSchema=n=>({type:'array',maxItems:n,items:{type:'object',properties:{text:{type:'string',maxLength:200},about:{type:'array',maxItems:4,items:{type:'string',maxLength:40}},settles:{type:['string','null']}},required:['text','about','settles'],additionalProperties:false}});
// The reply's schema: one for every turn (an ordinary turn, a resolved turn or scene cue that only tells, a spell
// awaiting a ruling, a word out of character), naming none of this turn's choices or people, so every request starts
// the same. What each phase may return is held to it when the reply is read (phaseFields, applied in steadied), and judge holds
// the reply to this turn (its choices, who may speak, who may be recruited, who is known), mending what it can.
// The reply's skeleton (2026-10-21, the host: "optimize efficiency even more, then do it again until we are at the
// lowest possible cost per turn"): what nearly every reply fills (narration first, so it streams; the spoken lines;
// the suggestions last) stays at the top, and every game effect is one item of `effects` holding one field
// ({"actionId":"travel-p1"}, {"check":{...}}, {"relationships":{...}}...), so a reply that changes nothing writes
// "effects":[] instead of thirteen empty fields (output costs five times input). flatReply turns the provider's reply
// back into the one shape everything after it reads (steadied, judge, the validators, the second look, the rescue,
// the device and the campaign server), at once when it is read.
const recruitItem={type:'object',properties:{npcId:{type:'string'},decision:{type:'string',enum:['join','decline','check','offer']},reason:{type:'string',maxLength:400},terms:{type:'string',maxLength:300},dc:{type:['integer','null']},class:{type:['string','null'],enum:[null,...npcClassNames]}},required:['npcId','decision','reason','terms','dc','class'],additionalProperties:false};
const definite=s=>({...s,type:'object'});
// Each effect's own schema (as an item of effects it is never null) and, for the three that may come twice, how many.
const effectSchemas=()=>({actionId:{type:'string'},castCommand:{type:'string'},ruling:definite(rulingSchema),worldEvent:{type:'string'},check:definite(checkSchema),discovery:definite(discoverySchema),ambush:definite(creatureSchema),introduce:definite(introduceSchema(null,null)),loot:definite(lootSchema(4)),recruitment:recruitItem,relationships:relationshipSchema(2,null).items,remember:rememberSchema(2).items,rewind:{type:'boolean'},fault:{type:'boolean'}});
const effectLists={recruitment:2,relationships:2,remember:2};
const effectKinds=['recruitment','relationships','loot','introduce','actionId','castCommand','ruling','worldEvent','check','discovery','ambush','rewind','fault','remember'];
let oneReplySchema=null;
function replySchemaFor(){
 if(oneReplySchema)return oneReplySchema;
 const effects=Object.entries(effectSchemas()).map(([k,schema])=>({type:'object',properties:{[k]:schema},required:[k],additionalProperties:false}));
 const properties={narration:{type:'string'},
  dialogue:{type:'array',maxItems:4,items:{type:'object',properties:{speakerId:{type:'string'},text:{type:'string',maxLength:700}},required:['speakerId','text'],additionalProperties:false}},
  effects:{type:'array',maxItems:8,items:{anyOf:effects}},
  suggestions:{type:'array',maxItems:3,items:{type:'string',maxLength:120}}};
 return oneReplySchema={type:'object',properties,required:['narration','dialogue','effects','suggestions'],additionalProperties:false};
}
// A reply schema seen field by field, as the checks read it: each effect of the effects list as a field of its own
// (nullable, or a list of up to its number), between the spoken lines and the suggestions. Any other schema as it is.
function asFields(schema){
 const list=schema?.properties?.effects?.items?.anyOf;if(!Array.isArray(list))return schema;
 const effects={};for(const branch of list)for(const [k,s] of Object.entries(branch.properties??{}))effects[k]=k in effectLists?{type:'array',maxItems:effectLists[k],items:s}:{...s,type:[].concat(s.type,'null')};
 const {effects:_e,suggestions,...top}=schema.properties,properties={...top,...effects,suggestions};
 return {...schema,properties,required:Object.keys(properties)};
}
// The reply with every effect spelled out as a field of its own (the schema before 2026-10-21): sent only if the
// provider refuses the effects list (dm-server.cjs turnAsker), and read by flatReply as it is.
let spelledOut=null;
function spelledOutSchema(){
 if(spelledOut)return spelledOut;
 const {narration,dialogue,suggestions}=replySchemaFor().properties;
 const properties={narration,dialogue,recruitment:{type:'array',maxItems:2,items:recruitItem},relationships:relationshipSchema(2,null),introduce:introduceSchema(null,null),loot:lootSchema(4),actionId:{type:['string','null']},castCommand:{type:['string','null']},ruling:rulingSchema,worldEvent:{type:['string','null']},check:checkSchema,discovery:discoverySchema,ambush:creatureSchema,rewind:{type:['boolean','null']},fault:{type:['boolean','null']},remember:rememberSchema(2),suggestions};
 return spelledOut={type:'object',properties,required:Object.keys(properties),additionalProperties:false};
}
// The provider's reply in the one shape the game reads: every effect in its own field (null, or [] for the three lists),
// as the reply schema once spelled them all out. An effect given twice keeps the first (a list keeps its first two);
// onDrop hears how many were left out. A reply without effects (an older shape, a stand-in in the checks) is read as it is.
function flatReply(value,onDrop=null){
 if(!value||typeof value!=='object'||Array.isArray(value)||!('effects' in value))return value;
 const {effects,...top}=value;let dropped=0;
 const out={narration:top.narration,dialogue:top.dialogue,recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null,rewind:null,fault:null,remember:[],suggestions:top.suggestions};
 for(const [k,v] of Object.entries(top))if(!(k in out))out[k]=v;
 for(const item of Array.isArray(effects)?effects:[]){
  if(!item||typeof item!=='object'||Array.isArray(item))continue;
  for(const [k,v] of Object.entries(item)){
   if(k in effectLists){if(v!=null&&out[k].length<effectLists[k])out[k].push(v);else if(v!=null)dropped++;}
   else if(effectKinds.includes(k)&&v!=null){if(out[k]==null)out[k]=v;else dropped++;}
  }
 }
 if(dropped&&onDrop)try{onDrop(dropped);}catch{}
 return out;
}
// What each phase may return (the reply schema used to hold this; the one schema allows every field): a field a phase
// cannot use is left out when the reply is read, as the old per-phase schemas would have left it. On a spell awaiting a
// ruling a game action beside the ruling is not left out: the reply is unclear, and judge refuses it (asked again,
// then a clarify that spends nothing).
const phaseFields={
 turn:{rewind:false,fault:false},
 told:{recruitment:false,actionId:false,castCommand:false,ruling:false,worldEvent:false,check:false,discovery:false,ambush:false,rewind:false,fault:false},
 ruling:{recruitment:false,relationships:false,introduce:false,loot:false,rewind:false,fault:false,remember:false},
 ooc:{dialogue:false,recruitment:false,relationships:false,introduce:false,loot:false,actionId:false,castCommand:false,ruling:false,worldEvent:false,check:false,discovery:false,ambush:false,remember:false,suggestions:false}};
const listFields=new Set(['dialogue','recruitment','relationships','remember','suggestions']);
module.exports={magicRarity,magicIds,rarityOrder,rarityFor,lootSchema,tieKindsList,foeTieList,regardStanceList,terrainKinds,npcClassNames,introduceSchema,relationshipSchema,placeKinds,compass,creatureKinds,allyKinds,allySchema,creatureSchema,discoverySchema,checkSchema,rulingSchema,rememberSchema,replySchemaFor,spelledOutSchema,asFields,flatReply,effectKinds,phaseFields,listFields};
