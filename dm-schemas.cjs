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
let oneReplySchema=null;
function replySchemaFor(){
 if(oneReplySchema)return oneReplySchema;
 const properties={narration:{type:'string'},
  dialogue:{type:'array',maxItems:4,items:{type:'object',properties:{speakerId:{type:'string'},text:{type:'string',maxLength:700}},required:['speakerId','text'],additionalProperties:false}},
  recruitment:{type:'array',maxItems:2,items:{type:'object',properties:{npcId:{type:'string'},decision:{type:'string',enum:['join','decline','check','offer']},reason:{type:'string',maxLength:400},terms:{type:'string',maxLength:300},dc:{type:['integer','null']},class:{type:['string','null'],enum:[null,...npcClassNames]}},required:['npcId','decision','reason','terms','dc','class'],additionalProperties:false}},
  relationships:relationshipSchema(2,null),
  introduce:introduceSchema(null,null),
  loot:lootSchema(4),
  actionId:{type:['string','null']},
  castCommand:{type:['string','null']},
  ruling:rulingSchema,
  worldEvent:{type:['string','null']},
  check:checkSchema,
  discovery:discoverySchema,
  ambush:creatureSchema,
  rewind:{type:['boolean','null']},
  fault:{type:['boolean','null']},
  remember:rememberSchema(2),
  suggestions:{type:'array',maxItems:3,items:{type:'string',maxLength:120}}};
 return oneReplySchema={type:'object',properties,required:['narration','dialogue','recruitment','relationships','loot','introduce','actionId','castCommand','ruling','worldEvent','check','discovery','ambush','rewind','fault','remember','suggestions'],additionalProperties:false};
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
module.exports={magicRarity,magicIds,rarityOrder,rarityFor,lootSchema,tieKindsList,foeTieList,regardStanceList,terrainKinds,npcClassNames,introduceSchema,relationshipSchema,placeKinds,compass,creatureKinds,allyKinds,allySchema,creatureSchema,discoverySchema,checkSchema,rulingSchema,rememberSchema,replySchemaFor,phaseFields,listFields};
