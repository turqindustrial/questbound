// Reading the Dungeon Master's reply (moved out of dm-server.cjs on 2026-10-20, code unchanged): the checks each part
// of a reply must pass (validLoot, validIntroduce, validRelationships, validDiscovery, validCheck, validRuling...), the
// small repairs made instead of refusing (repaired*, clampedLoot, checkedHp, tellingCut), the tidying of dialogue,
// facts to remember and suggestions, and what counts as an unusable reply or a passing fault. dm-server.cjs drops
// this module from require.cache and loads it afresh with itself on every request, after dm-schemas.cjs.
const {magicRarity,magicIds,rarityOrder,rarityFor,tieKindsList,foeTieList,regardStanceList,terrainKinds,npcClassNames,placeKinds,compass,creatureKinds,allyKinds,checkSchema}=require('./dm-schemas.cjs');
// Long text is shortened with an ellipsis; the game's own limits stay the measure of what is too long.
const cut=(s,n)=>typeof s==='string'&&s.length>n?s.slice(0,n-1).trimEnd()+'\u2026':s;
const tidy=(s,n)=>cut(typeof s==='string'?s.trim():s,n);
// Small overruns in a reply (a description a few words too long, a creature given to a place marked merely risky)
// are repaired rather than refused; what is missing or wrong in kind is still refused below.
function repairedCreature(c){
 if(!c||typeof c!=='object')return c;
 const r={...c,name:tidy(c.name,60),appearance:tidy(c.appearance,400)};
 if(r.ally&&typeof r.ally==='object')r.ally={...r.ally,name:tidy(r.ally.name,60),appearance:tidy(r.ally.appearance,400)};
 // A creature at its side is one creature of another kind (a wolf's mate belongs to a pack, a pack is never at anyone's
 // side): one of the same kind, or a pack, is left out rather than the whole place or ambush refused (seen in the
 // diagnostics as "a new place the map could not use", asked again until rescued without it).
 if(r.ally&&typeof r.ally==='object'&&(r.ally.template===r.template||!allyKinds.includes(r.ally.template)))r.ally=null;
 return r;
}
// A new place in other words than the map's own (the stories spec, Phase A9, 2026-10-22: "a new place the map could not
// use" was asked again nine times in one rough session): a kind, bearing or land given in words is read as the nearest
// of the map's own, a missing danger is safe, a description too short is made from the name and kind, distances given
// as text are read, and a lair whose creature the game cannot run is a risky place instead. Only a nameless place is
// still unusable (and dm-server.cjs then leaves it out rather than refusing the reply).
const placeSynonyms=[[/\b(?:town|village|hamlet|city|inn|tavern|farm|farmstead|homestead|manor|keep|castle|fort|fortress|outpost|market|mill|harbou?r|port|dock|quay)\b/i,'settlement'],[/\b(?:camp|encampment|tents?|bivouac|caravan)\b/i,'camp'],[/\b(?:road|track|trail|path|bridge|crossing|ford|pass|causeway)\b/i,'road'],[/\b(?:wood|woods|forest|grove|thicket|copse|glade)\b/i,'forest'],[/\b(?:mountain|peak|ridge|crag|cliff|summit|hill|hills|tor)\b/i,'mountain'],[/\b(?:river|lake|pond|pool|mere|sea|coast|shore|beach|marsh|bog|fen|swamp|spring|well|falls|waterfall)\b/i,'water'],[/\b(?:ruin|ruins|tower|barrow|tomb|crypt|graveyard|cemetery|abbey|monastery|watchtower)\b/i,'ruin'],[/\b(?:cave|cavern|grotto|mine|tunnel|hollow|den|burrow|pit)\b/i,'cave'],[/\b(?:shrine|temple|chapel|altar|church|sanctuary|monument|standing stones?)\b/i,'shrine'],[/\b(?:lair|nest)\b/i,'lair'],[/\b(?:heath|moor|plain|plains|wilds|wilderness|steppe|desert|dunes|badlands|waste)\b/i,'wilds']];
const bearingWords={north:'N',northeast:'NE',east:'E',southeast:'SE',south:'S',southwest:'SW',west:'W',northwest:'NW'};
const terrainSynonyms={plain:'plains',grassland:'plains',woods:'forest',woodland:'forest',hill:'hills',mountain:'mountains',coastal:'coast',sea:'coast',swamp:'marsh',bog:'marsh',fen:'marsh',dunes:'desert',tundra:'snow',ice:'snow',cave:'caverns',underground:'caverns',cavern:'caverns'};
function repairedDiscovery(d){
 if(!d||typeof d!=='object')return d;
 const r={...d,name:tidy(d.name,60),description:tidy(d.description,300)};
 if(!placeKinds.includes(r.kind)){const said=[r.kind,r.name,r.description].filter(v=>typeof v==='string').join(' ');r.kind=(placeSynonyms.find(([re])=>re.test(String(r.kind??'')))??placeSynonyms.find(([re])=>re.test(said)))?.[1]??'landmark';}
 if(!compass.includes(r.bearing)){const w=String(r.bearing??'').toLowerCase().replace(/[^a-z]/g,'');r.bearing=bearingWords[w]??(compass.includes(String(r.bearing??'').toUpperCase())?String(r.bearing).toUpperCase():'N');}
 if(typeof r.miles!=='number'||!Number.isFinite(r.miles)){const n=parseFloat(String(r.miles??''));r.miles=Number.isFinite(n)?n:1;}
 if(typeof r.travel!=='boolean')r.travel=r.travel==='true';
 if(typeof r.name==='string'&&typeof r.description==='string'&&r.description.trim().length<10)r.description=tidy(r.name.trim()+', a '+(r.kind==='wilds'?'stretch of wild country':r.kind)+' not yet explored.',300);
 if(typeof r.feature==='string')r.feature=r.feature.trim().length<3?null:tidy(r.feature,200);
 if(r.region&&typeof r.region==='object'){const name=tidy(r.region.name,60),terrain=terrainKinds.includes(r.region.terrain)?r.region.terrain:terrainSynonyms[String(r.region.terrain??'').toLowerCase()];r.region=typeof name==='string'&&name.length>=2&&terrainKinds.includes(terrain)?{name,terrain}:null;}else r.region=null;
 r.miles=Math.min(r.region?300:12,Math.max(0.1,r.miles));
 if(r.lair&&typeof r.lair==='object'){r.lair=repairedCreature(r.lair);if(validCreature(r.lair))r.danger='lair';else{r.lair=null;r.danger='risky';}}
 else{r.lair=null;if(r.danger==='lair')r.danger='risky';}
 if(!['safe','risky','lair'].includes(r.danger??'safe'))r.danger='safe';
 return r;
}
function repairedIntroduce(p,context){
 if(!p||typeof p!=='object')return p;
 const r={...p,name:tidy(p.name,60),species:tidy(p.species,60),role:tidy(p.role,200),appearance:tidy(p.appearance,400),personality:tidy(p.personality,200)};
 if(r.tie&&typeof r.tie==='object'&&!(knownPeople(context).includes(r.tie.to)&&tieKindsList.includes(r.tie.kind)))r.tie=null;
 if(!['woman','man','other'].includes(r.gender))r.gender='other';
 if(!npcClassNames.includes(r.class))r.class=null;
 r.regard=r.regard&&typeof r.regard==='object'&&regardStanceList.includes(r.regard.stance)&&typeof r.regard.reason==='string'?{stance:r.regard.stance,reason:tidy(r.regard.reason,200)}:null;
 return r;
}
// An item's note is a courtesy: one that is missing or too long is tidied, never a reason to refuse the loot.
const repairedLoot=l=>l&&typeof l==='object'&&Array.isArray(l.items)?{...l,items:l.items.map(i=>i&&typeof i==='object'?{...i,note:typeof i.note==='string'?tidy(i.note,160):''}:i)}:l;
// Gold over what is plausible for the hero's level is cut to the most that is (the narration keeps its find), and
// magic is kept only on the reward of a chapter or a lead, once, within the rarity the level allows. Returns the
// repaired loot and what was changed (for the diagnostics: mechanical fields only).
// An Easy to get into tale's errand is done in the reply that narrates story-advance ('Chapter 1 complete'): that
// reply pays the promised reward. When the model leaves it out, the gold the reward names is paid (within the limits).
// When the errand's promised purse is handed over (the game pays it when the reply hands over nothing): once the game
// closed chapter 1 at the cleared place (story.errand.rewardDue, the stories spec Phase A3, 2026-10-22), the next time
// the hero speaks with keeper; before that build, in the telling of "Chapter 1 complete" after the Dungeon Master moved it on.
const errandPaidTurn=context=>{const e=context?.story?.errand;if(!e)return false;
 if(e.rewardDue===true)return !(context.engineResolved??[]).length&&!context.sceneTrigger&&context.conversationWith?.id==='keeper'&&(context.nearbyNPCs??[]).some(n=>n?.id==='keeper');
 return (context.engineResolved??[]).some(t=>/^Chapter 1 complete: /.test(String(t)));};
const errandPurse=context=>{const m=/(\d[\d,]*)\s*(?:gold|gp)\b/i.exec(String(context?.story?.errand?.reward??''));return m?Number(m[1].replace(/,/g,'')):0;};
const magicRewardTurn=context=>(context.engineResolved??[]).some(t=>/^Chapter \d+ complete: |^Lead seen through: /.test(String(t)));
function clampedLoot(l,context){
 if(!l||typeof l!=='object'||!Array.isArray(l.items))return {loot:l,changed:[]};
 const level=context.player?.level??1,cap=40*level+60,changed=[];let next=l;
 if(Number.isInteger(l.gold)&&l.gold>cap){next={...next,gold:cap};changed.push('gold');}
 let given=0;const allowed=magicRewardTurn(context),most=rarityOrder.indexOf(rarityFor(level));
 next={...next,items:next.items.map(i=>{if(!i||typeof i!=='object'||i.magic==null)return i;const ok=allowed&&i.qty>0&&given===0&&magicIds.includes(i.magic)&&rarityOrder.indexOf(magicRarity[i.magic])<=most;if(ok){given++;return i;}changed.push('magic');return {...i,magic:null};})};
 return {loot:next,changed};
}
function validLoot(l,context){if(l===null)return true;const level=context.player?.level??1,have=context.inventory?.gold??0;return !!l&&Number.isInteger(l.gold)&&l.gold<=40*level+60&&have+l.gold>=0&&Array.isArray(l.items)&&l.items.length<=4&&l.items.every(i=>i&&typeof i.name==='string'&&i.name.trim().length>0&&i.name.length<=60&&['weapon','armor','potion','ammunition','treasure','gear','quest'].includes(i.kind)&&(i.magic==null||magicIds.includes(i.magic))&&Number.isInteger(i.qty)&&i.qty!==0&&Math.abs(i.qty)<=40&&typeof i.value==='number'&&i.value>=0&&i.value<=5000)&&typeof l.reason==='string'&&l.reason.length<=300&&(l.gold!==0||l.items.length>0);}
// The people the game knows: the two residents and anyone met since (n1…n48).
const personId=id=>/^(?:keeper|mara|n(?:[1-9]|[1-8]\d|9[0-6]))$/.test(String(id));
const knownPeople=context=>{const ids=(context.npcSocialState??[]).map(n=>n?.id).filter(personId);return ids.length?ids:['keeper','mara'];};
function validIntroduce(p,context){if(p===null)return true;const t=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;return !!p&&t(p.name,2,60)&&p.name.trim().toLowerCase()!==String(context.story?.foe??'').toLowerCase()&&t(p.species,0,60)&&t(p.role,3,200)&&t(p.appearance,10,400)&&t(p.personality,0,200)&&['frail','common','tough'].includes(p.toughness)&&['hostile','unfriendly','indifferent','friendly'].includes(p.attitude)&&foeTieList.includes(p.foe)&&(p.tie===null||(!!p.tie&&knownPeople(context).includes(p.tie.to)&&tieKindsList.includes(p.tie.kind)))&&(p.class===undefined||p.class===null||npcClassNames.includes(p.class));}
function validRelationships(list,context){const dead=Object.entries(context.npcFates??{}).filter(([,f])=>f==='dead').map(([id])=>id);return Array.isArray(list)&&list.length<=2&&new Set(list.map(d=>d?.npcId)).size===list.length&&list.every(d=>d&&knownPeople(context).includes(d.npcId)&&!dead.includes(d.npcId)&&['pleased','grateful','offended','angered','bond','grudge','amends','forgave','ally','parts'].includes(d.change)&&typeof d.memory==='string'&&d.memory.trim().length>=3&&d.memory.length<=200&&relationshipAllowed(d,context));}
// Amends only for someone the player has wronged; forgiveness of a grudge only as far as the game's own count allows
// (enough amends and time, or this deed the last amends needed once the time has passed); someone cold without a
// grudge may let a lesser wrong go. The same rule as validDeeds in relationshipRules.js.
function relationshipAllowed(d,context){
 const s=(context.npcSocialState??[]).find(n=>n?.id===d.npcId),cold=['hostile','unfriendly'].includes(s?.attitude);
 if(d.change==='amends')return !!s?.grudge||cold;
 // An ally only without a grudge or hostility, and never someone already travelling along; parting only from an ally.
 {const f=context.followers?.[d.npcId]?.status,along=f==='following'||f==='waiting';
  if(d.change==='ally')return !s?.grudge&&s?.attitude!=='hostile'&&!along;
  if(d.change==='parts')return s?.standing==='ally'&&!along;}
 if(d.change==='forgave'){if(!s?.grudge)return cold;const f=s.forgiveness;return !!f&&typeof f==='object'&&(f.canForgive===true||(Number(f.amendsToGo)<=1&&f.daysToGo===0));}
 return true;
}
const validSketch=c=>!!c&&typeof c.name==='string'&&c.name.trim().length>=2&&c.name.length<=60&&typeof c.appearance==='string'&&c.appearance.trim().length>=10&&c.appearance.length<=400;
const validCreature=c=>c===null||(!!c&&creatureKinds.includes(c.template)&&validSketch(c)&&(c.ally==null||(allyKinds.includes(c.ally.template)&&c.ally.template!==c.template&&validSketch(c.ally))));
function validDiscovery(d){return d===null||(d&&typeof d.name==='string'&&d.name.trim().length>=2&&d.name.length<=60&&typeof d.description==='string'&&d.description.trim().length>=10&&d.description.length<=300&&placeKinds.includes(d.kind)&&compass.includes(d.bearing)&&typeof d.miles==='number'&&Number.isFinite(d.miles)&&typeof d.travel==='boolean'&&['safe','risky','lair'].includes(d.danger??'safe')&&(d.feature==null||(typeof d.feature==='string'&&d.feature.trim().length>=3&&d.feature.length<=200))&&validCreature(d.lair??null)&&(!d.lair||d.danger==='lair'));}
// A cast only goes ahead when the player's words name a spell (or something that could be a nickname for one):
// "I cast a spell at him" never lets the model pick the spell.
const genericWords=new Set('i cast casts casting a an the my some any spell spells magic magical cantrip cantrips at on to toward towards into onto him her them it its this that target enemy foe creature monster thing with use uses using and again now please me myself self level slot first second third fourth fifth sixth seventh eighth ninth something anything whatever random best strongest attack attacks hit strike shoot throw hurl arcane divine'.split(' '));
function spellNamed(input,context){
 const story=context.story??{},names=[story.foe,story.foeSpecies,...Object.values(story.npcs??{}).map(n=>n.name),...(context.conversationParticipants??[]).map(n=>n.name),context.encounter?.name].filter(Boolean).join(' ').toLowerCase();
 const words=String(input).toLowerCase().match(/[a-z][a-z']*/g)??[];
 return words.some(w=>w.length>=2&&!genericWords.has(w)&&!names.split(/[^a-z']+/).includes(w));
}
function validCheck(c){return c===null||(c&&(c.skill==null||checkSchema.properties.skill.enum.includes(c.skill))&&['Strength','Dexterity','Constitution','Intelligence','Wisdom','Charisma'].includes(c.ability)&&Number.isInteger(c.dc)&&c.dc>=5&&c.dc<=30&&['normal','advantage','disadvantage'].includes(c.mode)&&['reason','success','failure'].every(k=>typeof c[k]==='string'&&c[k].length>0&&c[k].length<=300)&&Number.isInteger(c.damageCount)&&c.damageCount>=0&&c.damageCount<=20&&[4,6,8,10,12,20].includes(c.damageDie)&&['failure','always','none'].includes(c.damageOn));}
function validRuling(r){return r===null||(r&&['cast','deny','clarify'].includes(r.decision)&&typeof r.note==='string'&&r.note.trim().length>=3&&r.note.length<=500&&['damage','selfDamage','healing','temporaryHP'].every(k=>Number.isInteger(r[k])&&r[k]>=0&&r[k]<=500));}
// Narration may only state hit points the game knows: HP in the context (hero, foe, people, a creature at the foe's
// side) or numbers in the engine's resolved lines. A wrong "down to 3 HP" becomes "badly hurt", a wrong number in
// brackets is dropped, and any other wrong "N HP" loses its number. Correct numbers are left alone.
function knownHp(context){
 const n=new Set(),add=v=>{if(Number.isInteger(v))n.add(v);};
 add(context.player?.health?.current);add(context.player?.health?.temp);add(context.enemyHP);add(context.encounter?.currentHP);add(context.encounter?.maximum);
 for(const v of Object.values(context.npcHP??{}))add(v);
 for(const a of context.encounter?.alsoFighting??[]){add(a.currentHP);add(a.maximumHP);}
 // From the engine's lines, only numbers that are HP: "7 HP remaining", "restored 8 HP", "12 → 7".
 for(const line of context.engineResolved??[])for(const m of String(line).matchAll(/(\d+)\s*(?:HP|hit points?)\b|→\s*(\d+)/gi))n.add(Number(m[1]??m[2]));
 // The hero's hit points part-way through the turn (healed, then struck) are real figures too: follow the lines in order.
 const start=context.turnStart;
 if(start&&Number.isInteger(start.hp)&&Number.isInteger(start.max)){
  let hp=start.hp;n.add(hp);
  for(const line of context.engineResolved??[]){
   const healed=/restored (\d+) HP/i.exec(String(line)),lost=/(\d+) HP lost/i.exec(String(line));
   if(healed&&!/ on |gives? |rests too/i.test(String(line))){hp=Math.min(start.max,hp+Number(healed[1]));n.add(hp);}
   if(lost){hp=Math.max(0,hp-Number(lost[1]));n.add(hp);}
  }
 }
 return n;
}
const hpWords='(?:HP|hit points?)';
// Damage told as figures in the telling (the stories spec, Phase A6, 2026-10-22: "exactly 4 fire damage"): the dice cards
// show the numbers, so the words tell the harm as action. "takes exactly 7 slashing damage" becomes "takes a cut", "hits it
// for 6 damage" "hits it hard", and a figure in brackets goes. Every damage figure is softened, right or wrong (unlike hit
// points, which a telling may quote when the game knows them).
const damageTypes='acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder';
const damageWords={acid:'a burn',bludgeoning:'a heavy blow',cold:'a numbing chill',fire:'a burn',force:'a hard blow',lightning:'a jolt',necrotic:'a withering touch',piercing:'a wound',poison:'poison',psychic:'a stab of pain',radiant:'a searing light',slashing:'a cut',thunder:'a concussive blow'};
const damageFigure='(?:exactly\\s+|only\\s+|just\\s+|a mere\\s+|some\\s+)?\\d+\\s+(?:points?\\s+of\\s+)?(?:('+damageTypes+')\\s+)?damage\\b';
function softDamage(text){
 if(typeof text!=='string'||!/\d/.test(text)||!/damage/i.test(text))return text;
 return text
  .replace(new RegExp('\\s*\\([^()]*?\\d+\\s+(?:points?\\s+of\\s+)?(?:(?:'+damageTypes+')\\s+)?damage\\b[^()]*\\)','gi'),'')
  .replace(new RegExp('\\bfor\\s+(?:an?\\s+)?(?:(?:extra|additional|further)\\s+)?'+damageFigure,'gi'),'hard')
  .replace(new RegExp('\\b(?:(?:an?\\s+)?(?:extra|additional|further)\\s+|another\\s+)?'+damageFigure,'gi'),(m,type)=>damageWords[String(type??'').toLowerCase()]??'a wound')
  .replace(/ {2,}/g,' ').replace(/ +([,.;!?])/g,'$1');
}
function checkedHp(text,context){
 if(typeof text!=='string'||!/\d/.test(text))return text;
 const ok=knownHp(context),bad=v=>!ok.has(Number(v));
 return softDamage(text)
  .replace(new RegExp('\\s*\\([^()]*?(?<![\\w+-])(\\d+)\\s*'+hpWords+'\\b[^()]*\\)','gi'),(m,v)=>bad(v)?'':m)
  .replace(new RegExp('\\b(down to|drops? to|dropping to|falls? to|falling to|reduced to|left with|leaving (?:it|him|her|them|you) with|with only|with just)\\s+(?:only\\s+|just\\s+)?(\\d+)\\s*'+hpWords+'\\b(?:\\s+(?:left|remaining))?','gi'),(m,lead,v)=>{if(!bad(v))return m;const l=lead.toLowerCase();return /^(drop|fall)/.test(l)?'is badly hurt':/^leaving/.test(l)?lead.replace(/\s+with$/i,'')+' badly wounded':/^(with|left)/.test(l)?'badly wounded':'badly hurt';})
  // "back up to 9 HP" loses the figure; "at 9 HP" becomes "wounded"; any other wrong figure becomes "wounds".
  .replace(new RegExp('((?:\\s+back)?(?:\\s+up)?)\\s+to\\s+(?:only\\s+|just\\s+)?(\\d+)\\s*'+hpWords+'\\b','gi'),(m,lead,v)=>bad(v)?lead:m)
  .replace(new RegExp('\\bat\\s+(?:only\\s+|just\\s+)?(\\d+)\\s*'+hpWords+'\\b','gi'),(m,v)=>bad(v)?'wounded':m)
  .replace(new RegExp('(?<![\\w+-])(\\d+)\\s*'+hpWords+'\\b(?:\\s+(?:left|remaining))?','gi'),(m,v)=>bad(v)?'wounds':m)
  .replace(/ {2,}/g,' ').replace(/ +([,.;!?])/g,'$1');
}
// Replies that could not be used for a mechanical reason (asked again quietly, then rescued), and passing faults of the
// provider (tried once more).
const unusable=message=>/^(The AI (did not return a usable reply|proposed an invalid|reply was incomplete)|Invalid check plan|The DM (described|included|must return)|The recruitment decision|Out of character|Spell damage must|A denied or clarified|The action is already resolved|The action of the player is already spent|A check cannot be made during a fight)/.test(String(message));
const transient=e=>['TimeoutError','AbortError'].includes(e?.name)||/HTTP 5\d\d|fetch failed|ECONNRESET|socket hang up/i.test(String(e?.message??''));
function faultKind(e){const m=String(e?.message??'');return e?.name==='TimeoutError'?'timed out':/usable reply/.test(m)?'unreadable':/incomplete/.test(m)?'cut short':/HTTP 5|fetch failed|ECONNRESET|socket/i.test(m)?'provider fault':/invalid ruling|cast, deny|denied or clarified|Spell damage/.test(m)?'ruling':/recruitment/.test(m)?'recruitment':/speaker/.test(m)?'speaker':/new place/.test(m)?'place':/creature/.test(m)?'creature':/check/i.test(m)?'check':/invalid response/.test(m)?'telling':/Out of character/.test(m)?'out of character':/already resolved/.test(m)?'resolved twice':'other';}
// A check's failure written ahead that changes nothing (the stories spec, Phase A2, 2026-10-22: 21 checks failed into
// nothing in the saved games, and a chapter stalled behind one failed roll): its last sentence says the attempt came to
// nothing ("you find nothing", "nothing comes of it", "in vain") with no turn after it (but, until, instead...) and
// nobody speaks. Such a reply is asked for again, like any unusable reply; a rescue keeps the check without its outcomes.
const deadEndWords=/\b(?:(?:find|finds|found|turns?\s+up|turned\s+up|yields?|yielded|reveals?|revealed|learns?|learned|gets?|notices?|noticed|spots?|spotted|hears?|heard|discovers?|discovered|uncovers?|uncovered|sees?|saw)\s+(?:nothing|no\s+(?:sign|trace|clue|answer|sense|luck|more|further)|little\s+of\s+(?:use|note|value))|nothing\s+(?:happens|comes\s+of\s+it|of\s+(?:note|use|value|interest)|useful|more|stirs|changes|new)|inconclusive|to\s+no\s+avail|in\s+vain|no\s+luck|comes?\s+up\s+empty|empty-handed|draws?\s+a\s+blank|leads?\s+nowhere|nothing\s+to\s+show)\b/i;
const deadEndTurns=/\b(?:but|yet|though|although|however|instead|until|except|only|as|when|while|before|meanwhile|then)\b/i;
function deadEnd(text,dialogue=[]){
 if(Array.isArray(dialogue)&&dialogue.length)return false;
 const sentences=String(text??'').trim().split(/(?<=[.!?])\s+/).filter(Boolean),last=sentences.at(-1)??'',m=deadEndWords.exec(last);
 return !!m&&!deadEndTurns.test(last.slice(m.index+m[0].length));
}
// A telling too long for the feed is cut after its last whole sentence that fits.
function tellingCut(text,max){const head=text.slice(0,max),end=Math.max(...['. ','! ','? ','.\n','!\n','?\n','."','!"','?"','.\u201d','!\u201d','?\u201d'].map(s=>head.lastIndexOf(s)));return end>max/2?head.slice(0,end+2).trim():head.replace(/\s+\S*$/,'')+'\u2026';}
// A spell named in the player's words that the hero knows and can pay for now (spellReference carries each known spell's
// costs), when the words are a cast and not a question or a refusal. The rules are the authority on what can be cast.
function castableSpell(input,context){
 const said=String(input??'').replace(/\s+/g,' ').trim();
 if(!said||/\?/.test(said)||/^(?:can|could|may|might|should|would|will|do|does|did|is|am|are|what|how|why|when|where|which|who)\b/i.test(said)||/\b(?:not|don't|do not|never|won't|without)\b/i.test(said))return null;
 const named=(context.spellReference??[]).filter(s=>typeof s?.name==='string'&&s.name.length>=3&&said.toLowerCase().includes(s.name.toLowerCase()));
 return named.length===1&&Array.isArray(named[0].availableCosts)&&named[0].availableCosts.length?named[0]:null;
}
function castWords(input,spell){
 const said=String(input??'').replace(/\s+/g,' ').trim().replace(/[.!]+$/,''),at=said.search(/\bcast\b/i);
 if(at>=0)return ('I '+said.slice(at)).slice(0,500);
 const i=said.toLowerCase().indexOf(spell.name.toLowerCase());
 return ('I cast '+spell.name+(i>=0?said.slice(i+spell.name.length):'')).slice(0,500);
}
// Different words from different people: a line that repeats or echoes an earlier line of the same reply (the same
// words, most of the same words, or the same short greeting) is dropped; the first line always stays.
const echoStop=new Set('the a an and of to you your i is it in on at for we me my be are this that with so but or not no yes oh ah well here there what who has have do does did was were will can come came'.split(' '));
const greetingWords=new Set(['welcome','hello','greetings','hail','evening','morning','afternoon','well','ho','hey']);
const lineWords=t=>(String(t??'').toLowerCase().replace(/[’']/g,'').match(/[a-z0-9]+/g)??[]);
function echoes(a,b){
 const A=lineWords(a),B=lineWords(b);if(!A.length||!B.length)return false;
 if(A.join(' ')===B.join(' '))return true;
 const sa=new Set(A.filter(w=>!echoStop.has(w))),sb=new Set(B.filter(w=>!echoStop.has(w))),small=Math.min(sa.size,sb.size);
 // Two short lines that open alike ("Welcome, traveller." / "Welcome to the market!") are one greeting.
 if(A.length<=6&&B.length<=6&&(A.slice(0,2).join(' ')===B.slice(0,2).join(' ')||(greetingWords.has(A[0])&&A[0]===B[0])))return true;
 if(small<2)return false;
 let shared=0;for(const w of sa)if(sb.has(w))shared++;
 return shared>=2&&shared/small>=0.7;
}
function distinctDialogue(lines){const kept=[];for(const l of Array.isArray(lines)?lines:[]){if(l&&kept.some(k=>echoes(k.text,l.text)))continue;kept.push(l);}return kept;}
// The reply's `remember` field tidied (its schema, rememberSchema, is in dm-schemas.cjs).
const rememberMechanics=/\b\d+\s*(?:hp|hit points?|xp|ac|dc)\b|\b(?:hit points?|armou?r class|spell slots?|initiative|saving throws?|d20|\d*d\d+|experience points?|level up)\b/i;
function cleanRemember(list,context){
 const shown=[...(context?.memory?.facts??[]),...(context?.memory?.otherFacts??[])].map(t=>String(t)),openIds=new Set(shown.map(t=>t.match(/^(f\d{1,6})\b/)?.[1]).filter(Boolean));
 const words=t=>new Set((String(t).toLowerCase().match(/[a-z0-9']+/g)??[]).filter(w=>w.length>2)),same=(a,b)=>{const A=words(a),B=words(b),n=Math.min(A.size,B.size);if(!n)return false;let k=0;for(const w of A)if(B.has(w))k++;return k/n>=0.8;};
 const kept=[];
 for(const f of (Array.isArray(list)?list:[]).slice(0,2)){
  if(!f||typeof f!=='object'||typeof f.text!=='string')continue;
  const text=f.text.replace(/\s+/g,' ').trim(),settles=typeof f.settles==='string'&&f.settles.trim()?f.settles.trim():null;
  if(text.length<8||text.length>180||rememberMechanics.test(text)||(settles&&!openIds.has(settles)))continue;
  if(!settles&&(shown.some(t=>same(t.replace(/^f\d+(?: \[[^\]]*\])?: /,''),text))||kept.some(k=>same(k.text,text))))continue;
  const about=[...new Set((Array.isArray(f.about)?f.about:[]).filter(id=>typeof id==='string'&&(id==='new'||personId(id)||/^(?:inn|bridge|tower|p\d{1,3})$/.test(id))))].slice(0,4);
  kept.push({text:text.length>160?text.slice(0,159).trimEnd()+'…':text,about,settles});
 }
 return kept;
}
// Whether a suggestion can happen now (suggestionRules.js, the one rule the device uses too, with facts from the game):
// read here from the scene this turn was given (body.context) with the spell catalogue's names. The file is loaded as
// text each time this module is, so an edit there is live with the next request, as one here is.
const suggestionPossible=(()=>{try{const fn=require('node:vm').runInNewContext(require('./rules-files.cjs').moduleSource('suggestionRules.js')+'\n;suggestionPossible'),names=require('./spellCatalog.json').map(s=>s.name);return (text,context)=>{try{return fn(text,context,names)!==false;}catch{return true;}};}catch{return ()=>true;}})();
// What the player might say next (the Suggestions tab): at most three short lines in their own voice, tidied here and
// never a reason to refuse a reply. Lines that speak out of character, state hit points, repeat what the player just
// said or run long are dropped, and so is anything this hero cannot do now (suggestionPossible).
function cleanSuggestions(list,input,context=null){
 const seen=new Set(),said=String(input??'').trim().toLowerCase();
 return (Array.isArray(list)?list:[]).filter(t=>typeof t==='string').map(t=>t.replace(/\s+/g,' ').trim().replace(/^(?:[-*\u2022]\s+|\d+[.)]\s+)/,'').replace(/^["'\u201c\u2018]+|["'\u201d\u2019]+$/g,'').trim())
  .filter(t=>{const key=t.toLowerCase();if(t.length<3||t.length>110||/^(?:\(\s*ooc|\[\s*ooc|ooc\b|dm\b|dungeon master\b)/i.test(t)||/\d+\s*(?:HP|hit points?)\b/i.test(t)||/\b(?:button|click)\b/i.test(t)||key===said||seen.has(key)||!suggestionPossible(t,context))return false;seen.add(key);return true;}).slice(0,3);
}
module.exports={suggestionPossible,cut,tidy,repairedCreature,repairedDiscovery,repairedIntroduce,repairedLoot,errandPaidTurn,errandPurse,magicRewardTurn,clampedLoot,validLoot,personId,knownPeople,validIntroduce,validRelationships,relationshipAllowed,validSketch,validCreature,validDiscovery,genericWords,spellNamed,validCheck,validRuling,knownHp,hpWords,softDamage,checkedHp,unusable,transient,faultKind,deadEnd,tellingCut,castableSpell,castWords,echoStop,greetingWords,lineWords,echoes,distinctDialogue,rememberMechanics,cleanRemember,cleanSuggestions};
