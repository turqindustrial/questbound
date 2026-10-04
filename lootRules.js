import {weapons,weaponAttacks} from './weaponRules';
import {packOf,packWith} from './inventoryRules';
import {sceneLocation,npcIdsOf,npcLore} from './npcRules';
import {worldPlace} from './mapRules';
import {templateKeys,foeKind,foeTemplate} from './encounterRules';
import {appendJournal,journalForGame} from './journalRules';
import {fightEnding} from './experienceRules';
// Spoils and magic items. When a fight is won the engine itself notes what fell and where (game.spoils, shared world
// state at the table); searching the fallen (the Loot action) rolls what they carried from tables kept by kind of
// creature, a person's toughness and role, and the looter's level. A lair hides a hoard, and the tale's main foe always
// yields one magic item. Magic items are SRD 5.2 items whose effects the rules really apply: weapons, armour and shields
// +1 to +3, protection, luck, strength and intellect, stealth and keen sight, the wands, the healing draughts and the
// periapt. At most three items that need attunement work at once.

// ---------- The catalogue ----------
// `plus` for weapons, armour and shields; `ac`, `saves`, `checks` (all), `advantage` (skills), `scores` (a floor),
// `spellAttack`, `charges`, `heal` (draughts) and `stabilise` are what the rules read (magicEffects below).
export const magicItems={
 'weapon+1':{name:'+1 Weapon',rarity:'uncommon',attune:false,kind:'weapon',plus:1,effect:'+1 to attack and damage rolls made with it.'},
 'weapon+2':{name:'+2 Weapon',rarity:'rare',attune:false,kind:'weapon',plus:2,effect:'+2 to attack and damage rolls made with it.'},
 'weapon+3':{name:'+3 Weapon',rarity:'very rare',attune:false,kind:'weapon',plus:3,effect:'+3 to attack and damage rolls made with it.'},
 'armor+1':{name:'+1 Armor',rarity:'rare',attune:false,kind:'armor',plus:1,effect:'+1 to armor class while you wear it.'},
 'armor+2':{name:'+2 Armor',rarity:'very rare',attune:false,kind:'armor',plus:2,effect:'+2 to armor class while you wear it.'},
 'shield+1':{name:'+1 Shield',rarity:'uncommon',attune:false,kind:'armor',plus:1,effect:'+1 to armor class on top of the shield’s own +2.'},
 'shield+2':{name:'+2 Shield',rarity:'rare',attune:false,kind:'armor',plus:2,effect:'+2 to armor class on top of the shield’s own +2.'},
 'shield+3':{name:'+3 Shield',rarity:'very rare',attune:false,kind:'armor',plus:3,effect:'+3 to armor class on top of the shield’s own +2.'},
 'cloak-of-protection':{name:'Cloak of Protection',rarity:'uncommon',attune:true,kind:'gear',ac:1,saves:1,effect:'+1 to armor class and to every saving throw.',look:'A plain grey cloak whose hem never quite settles, as if a breeze followed it.'},
 'ring-of-protection':{name:'Ring of Protection',rarity:'rare',attune:true,kind:'gear',ac:1,saves:1,effect:'+1 to armor class and to every saving throw.',look:'A narrow silver band, cool to the touch however long it is worn.'},
 'stone-of-good-luck':{name:'Stone of Good Luck',rarity:'uncommon',attune:true,kind:'gear',saves:1,checks:1,effect:'+1 to every ability check and saving throw.',look:'A smooth agate the size of a thumbnail, banded in honey and cream.'},
 'bracers-of-defense':{name:'Bracers of Defense',rarity:'rare',attune:true,kind:'gear',bracers:2,effect:'+2 to armor class while you wear no armor and carry no shield.',look:'A pair of leather bracers stitched with fine silver wire.'},
 'gauntlets-of-ogre-power':{name:'Gauntlets of Ogre Power',rarity:'uncommon',attune:true,kind:'gear',scores:{Strength:19},effect:'Your Strength is 19 while you wear them (no change if it is already higher).',look:'Heavy iron-knuckled gauntlets that grip like a vice.'},
 'headband-of-intellect':{name:'Headband of Intellect',rarity:'uncommon',attune:true,kind:'gear',scores:{Intelligence:19},effect:'Your Intelligence is 19 while you wear it (no change if it is already higher).',look:'A thin circlet of copper wire set with a single clear stone.'},
 'boots-of-elvenkind':{name:'Boots of Elvenkind',rarity:'uncommon',attune:false,kind:'gear',advantage:['Stealth'],effect:'Your steps make no sound: advantage on Stealth checks.',look:'Soft grey boots of a leather so supple it folds like cloth.'},
 'cloak-of-elvenkind':{name:'Cloak of Elvenkind',rarity:'uncommon',attune:true,kind:'gear',advantage:['Stealth'],effect:'With the hood up you are hard to make out: advantage on Stealth checks.',look:'A hooded cloak whose colour shifts to match whatever lies behind it.'},
 'eyes-of-the-eagle':{name:'Eyes of the Eagle',rarity:'uncommon',attune:true,kind:'gear',advantage:['Perception'],effect:'Clear lenses over the eyes: advantage on Perception checks.',look:'Two crystal lenses that sit over the eyes and sharpen everything far away.'},
 'wand-of-the-war-mage+1':{name:'Wand of the War Mage +1',rarity:'uncommon',attune:true,caster:true,kind:'gear',spellAttack:1,effect:'+1 to your spell attack rolls (spellcasters only).',look:'A slim wand of dark wood, warm in a caster’s hand.'},
 'wand-of-the-war-mage+2':{name:'Wand of the War Mage +2',rarity:'rare',attune:true,caster:true,kind:'gear',spellAttack:2,effect:'+2 to your spell attack rolls (spellcasters only).',look:'A wand of black wood ringed with bands of silver.'},
 'wand-of-the-war-mage+3':{name:'Wand of the War Mage +3',rarity:'very rare',attune:true,caster:true,kind:'gear',spellAttack:3,effect:'+3 to your spell attack rolls (spellcasters only).',look:'A wand of pale bone capped in gold, humming faintly.'},
 'wand-of-magic-missiles':{name:'Wand of Magic Missiles',rarity:'uncommon',attune:false,kind:'gear',charges:7,effect:'As your action in a fight, spend a charge: three darts of force strike a creature you choose for 1d4 + 1 each and never miss. 7 charges; it regains 1d6 + 1 after a long rest. Spending the last charge may crumble it to ash (1 on a d20).',look:'A short wand of pale wood with a bead of blue glass at its tip.'},
 'periapt-of-wound-closure':{name:'Periapt of Wound Closure',rarity:'uncommon',attune:true,kind:'gear',stabilise:true,effect:'If you fall dying, the bleeding stops by itself at the start of your next turn: you are stable and wake with 1 hit point.',look:'A pendant of red stone on a fine chain, warm against the skin.'},
 'potion-greater-healing':{name:'Potion of Greater Healing',rarity:'uncommon',attune:false,kind:'potion',heal:{count:4,die:4,bonus:4},effect:'Drink it to regain 4d4 + 4 hit points (a bonus action in a fight).',look:'A deep red draught that glimmers when shaken.'},
 'potion-superior-healing':{name:'Potion of Superior Healing',rarity:'rare',attune:false,kind:'potion',heal:{count:8,die:4,bonus:8},effect:'Drink it to regain 8d4 + 8 hit points (a bonus action in a fight).',look:'A thick crimson draught that glows faintly in the dark.'},
 'potion-supreme-healing':{name:'Potion of Supreme Healing',rarity:'very rare',attune:false,kind:'potion',heal:{count:10,die:4,bonus:20},effect:'Drink it to regain 10d4 + 20 hit points (a bonus action in a fight).',look:'A blood-red draught that swirls by itself in the vial.'},
};
export const magicItemIds=Object.keys(magicItems);
export const draughtIds=magicItemIds.filter(id=>magicItems[id].heal);
export const maxAttuned=3;
const rarities=['uncommon','rare','very rare'];
const rarityRank=r=>rarities.indexOf(r);
// The looter's tier of play: 1 for levels 1-4, 2 for 5-10, 3 for 11-16, 4 for 17-20.
export const lootTier=level=>level>=17?4:level>=11?3:level>=5?2:1;
// The rarity of a magic item found at this tier.
export function rarityTier(tier,random=Math.random){
 if(tier<=1)return 'uncommon';
 if(tier===2)return random()<.6?'uncommon':'rare';
 if(tier===3)return random()<.5?'rare':'very rare';
 return 'very rare';
}
// The highest rarity a reward may have for a hero of this level (the Dungeon Master's rewards too).
const tierRarity=tier=>({1:'uncommon',2:'rare',3:'very rare',4:'very rare'})[tier]??'uncommon';
export const rarityAllowed=level=>tierRarity(lootTier(level));
export const rarityWithin=(rarity,level)=>rarityRank(rarity)>=0&&rarityRank(rarity)<=rarityRank(rarityAllowed(level));

// ---------- What a hero carries and wears ----------
const wornArmour=hero=>(hero?.equipment?.startingItems??hero?.equipment?.items??[]).find(i=>i.quantity>0&&/Armor$|Chain Mail|Chain Shirt/.test(i.name))?.name??null;
const carriesShield=hero=>(hero?.equipment?.startingItems??hero?.equipment?.items??[]).some(i=>i.name==='Shield'&&i.quantity>0);
const casterClasses=['Artificer','Bard','Cleric','Druid','Sorcerer','Warlock','Wizard'];
const weaponless=['Druid','Sorcerer','Warlock','Wizard'];
// The hero's main close-range weapon kind (its base, for a magic one).
function mainWeaponKind(hero){
 const w=weaponAttacks(hero).find(o=>!o.ranged&&!o.blocked)??weaponAttacks(hero).find(o=>!o.blocked);
 return w?w.base??w.name:null;
}
const mainUsesStrength=hero=>{const w=weaponAttacks(hero).find(o=>!o.blocked);return !w||w.ability==='Strength';};
// Whether an item from the catalogue is worth giving this hero (a reward suits whoever earns it).
export function magicSuits(id,hero){
 const item=magicItems[id];if(!item||!hero?.scores)return false;
 if(id.startsWith('weapon+'))return !weaponless.includes(hero.class)&&!!mainWeaponKind(hero);
 if(id.startsWith('armor+'))return !!wornArmour(hero);
 if(id.startsWith('shield+'))return carriesShield(hero);
 if(id==='bracers-of-defense')return !wornArmour(hero)&&!carriesShield(hero);
 if(id==='gauntlets-of-ogre-power')return (hero.scores.Strength??10)<19&&mainUsesStrength(hero)&&!weaponless.includes(hero.class);
 if(id==='headband-of-intellect')return ['Wizard','Artificer'].includes(hero.class)&&(hero.scores.Intelligence??10)<19;
 if(id==='boots-of-elvenkind'||id==='cloak-of-elvenkind')return ['Rogue','Ranger','Monk'].includes(hero.class)||(hero.scores.Dexterity??10)>=14;
 if(item.caster)return casterClasses.includes(hero.class);
 return true;
}
// A carried magic item: its name ('Longsword +1', 'Chain Mail +1', 'Shield +2' or the catalogue's), kind and mechanics.
// `base` for a weapon or armour is the kind it is made as; `name`/`note` from the story writer keep their own words.
export function makeMagicItem(id,hero,{name=null,note=null,base=null}={}){
 const item=magicItems[id];if(!item)return null;
 let kind=item.kind,made=base;
 if(id.startsWith('weapon+')){made=made&&weapons[made]?made:mainWeaponKind(hero);if(!made)return null;}
 else if(id.startsWith('armor+')){made=made??wornArmour(hero);if(!made)return null;}
 else if(id.startsWith('shield+'))made='Shield';
 const plain=made?made+' +'+item.plus:item.name;
 const own=typeof name==='string'&&name.trim()?name.trim().slice(0,60):plain;
 return {name:own,kind,qty:1,...(made?{base:made}:{}),magic:{id,...(item.plus?{plus:item.plus}:{}),...(item.charges?{charges:item.charges}:{})},...(typeof note==='string'&&note.trim()?{note:note.trim().slice(0,160)}:{})};
}
export const attunedCount=pack=>(pack?.items??[]).filter(i=>i.attuned).length;
// Whether a carried item is working for the hero: attuned, or one that needs no attunement.
const working=it=>!!it?.magic&&!!magicItems[it.magic.id]&&(!magicItems[it.magic.id].attune||it.attuned===true);
// What the hero's magic items do, all together. `hero` carries the kit (worn armour, a shield).
export function magicEffects(hero,pack){
 const out={ac:0,acText:[],saves:0,checks:0,advantage:[],spellAttack:0,scores:{},stabilise:false,any:false};
 const armour=wornArmour(hero),shield=carriesShield(hero);
 for(const it of pack?.items??[]){
  if(!working(it))continue;
  const item=magicItems[it.magic.id],id=it.magic.id;out.any=true;
  if(id.startsWith('armor+')&&armour&&it.base===armour){out.ac+=item.plus;out.acText.push('+'+item.plus+' '+it.name);}
  if(id.startsWith('shield+')&&shield){out.ac+=item.plus;out.acText.push('+'+item.plus+' '+it.name);}
  if(item.ac){out.ac+=item.ac;out.acText.push('+'+item.ac+' '+it.name);}
  if(item.bracers&&!armour&&!shield){out.ac+=item.bracers;out.acText.push('+'+item.bracers+' '+it.name);}
  out.saves+=item.saves??0;out.checks+=item.checks??0;
  if(item.caster?casterClasses.includes(hero?.class):item.spellAttack)out.spellAttack=Math.max(out.spellAttack,item.spellAttack??0);
  for(const s of item.advantage??[])if(!out.advantage.includes(s))out.advantage.push(s);
  for(const [k,v] of Object.entries(item.scores??{}))out.scores[k]=Math.max(out.scores[k]??0,v);
  if(item.stabilise)out.stabilise=true;
 }
 return out;
}
// The bonus to every saving throw from what the hero wears (a geared hero, or a hero and the game).
export const magicSaveBonus=(hero,game=null)=>(hero?.equipment?.magic??(game?.pack?magicEffects(hero,game.pack):null))?.saves??0;
// How a check is rolled once the hero's magic is counted: an item's advantage cancels a disadvantage.
export function magicCheckMode(hero,skill,mode){
 if(!skill||!(hero?.equipment?.magic?.advantage??[]).includes(skill))return mode;
 return mode==='disadvantage'?'normal':'advantage';
}

// ---------- What fell: spoils ----------
const spoilText=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
export const maxSpoils=6;
export function validSpoils(g){
 const s=g?.spoils;if(s===undefined)return true;
 const people=npcIdsOf(g);
 return Array.isArray(s)&&s.length<=maxSpoils&&s.every(e=>!!e&&typeof e==='object'&&['creature','person','boss'].includes(e.kind)&&spoilText(e.name,60)&&spoilText(e.place,40)
  &&(e.template===undefined||templateKeys.includes(e.template))&&(e.count===undefined||(Number.isInteger(e.count)&&e.count>=1&&e.count<=4))
  &&(e.ally===undefined||e.ally===true)&&(e.lair===undefined||e.lair===true)&&(e.feature===undefined||spoilText(e.feature,200))
  &&(e.kind!=='person'||people.includes(e.person))&&(e.person===undefined||e.kind==='person')&&(e.kind!=='creature'||e.template!==undefined));
}
// The fallen (and lairs) that can still be searched where the hero stands.
export function spoilsHere(game){
 const here=sceneLocation(game);
 return (game?.spoils??[]).filter(s=>s.place===here&&(s.kind!=='person'||!!game.npcFate?.[s.person]));
}
// Whether searching is possible right now (out of any fight, with nothing waiting), and something lies here.
export function lootError(game,health){
 if(!['inn','bridge','tower','wild','victory'].includes(game.stage))return 'There is nothing to search here right now.';
 if(game.npcCombat?.active||game.turnOrder||game.wildFight)return 'Finish the fight first.';
 if(game.pendingSpell)return 'Resolve the pending spell first.';
 if((health?.current??1)<=0)return 'You cannot search anything while down.';
 if(!spoilsHere(game).length)return 'Nothing left to search here.';
 return null;
}
const trimmed=(t,n)=>String(t??'').trim().slice(0,n);
// After every engine step: what fell in it (a creature in the wilds or at its lair, the creature at its side, the
// tale's foe or a Skirmish's creature, a person) is noted where it fell.
export function withSpoils(before,result,hero){
 const after=result?.game;
 if(!after||result.error||after===before||!before?.story)return result;
 const found=[];
 const w=before.wildFight;
 if(w&&!after.wildFight){
  const place=worldPlace(after,w.place);
  // A won fight is what experienceRules.js says it is (fightEnding), so spoils, experience and the story log agree.
  if(fightEnding(before,after).won&&!place?.threat&&!['dying','dead'].includes(after.stage)){
   const lair=worldPlace(before,w.place)?.danger==='lair';
   found.push({kind:'creature',template:w.template,name:trimmed(w.name,60),place:w.place,...(w.stats?.group?.size>1?{count:Math.min(4,w.stats.group.size)}:{}),...(lair?{lair:true}:{}),...(lair&&spoilText(worldPlace(before,w.place)?.feature,200)?{feature:worldPlace(before,w.place).feature.trim()}:{})});
   const events=result.events??[];
   for(const a of before.foeAllies??[]){
    if(!templateKeys.includes(a.template))continue;
    const fell=a.hp===0||events.some(t=>t===`The ${a.name} is slain.`||t===`The ${a.name} drops, beaten.`);
    if(fell)found.push({kind:'creature',template:a.template,name:trimmed(a.name,60),place:w.place,ally:true});
   }
  }
 } else if(!w&&!before.dungeon?.active&&['combat','bridge'].includes(before.stage)&&after.stage==='victory'){
  const kind=foeKind(before),place=sceneLocation(after);
  if(kind)found.push({kind:'creature',template:kind,name:trimmed(before.story.foe,60),place,...(foeTemplate(kind)?.group?{count:Math.min(4,foeTemplate(kind).group.size)}:{})});
  else if(spoilText(before.story.foe,60))found.push({kind:'boss',name:before.story.foe.trim(),place});
 }
 // People who fell to the hero (dead or senseless), never a companion who was at their side.
 for(const id of Object.keys(after.npcFate??{})){
  if(before.npcFate?.[id]||!npcIdsOf(after).includes(id)||before.followers?.[id]?.status==='following')continue;
  const name=npcLore(after,id)?.name;if(!spoilText(name,60))continue;
  found.push({kind:'person',person:id,name:name.trim(),place:sceneLocation(after)});
 }
 if(!found.length)return result;
 const spoils=[...(after.spoils??[]).filter(s=>!(s.kind==='person'&&found.some(f=>f.person===s.person))),...found].slice(-maxSpoils);
 return {...result,game:{...after,spoils}};
}

// ---------- What they carried: spoil tables ----------
const lootDice=(n,d,random)=>{let t=0;for(let i=0;i<n;i++)t+=1+Math.floor(random()*d);return t;};
const chance=(p,random)=>random()<p;
const treasure=(name,value,note)=>({name,kind:'treasure',qty:1,value,note});
// Each kind of creature yields what it really would: beasts their hides and teeth, raiders a thin purse and a blade.
// L is the looter's level, T their tier; coin is multiplied by the tier. Names and notes are Questbound's own.
export const spoilNotes={
 'Silver cloak pin':'A silver pin for fastening a cloak, worked in the shape of a leaf.',
 'Stolen signet ring':'A heavy gold ring with a seal on it that someone will want back.',
 'Dire wolf pelt':'A thick grey hide from a dire wolf. Furriers and trappers pay well for one.',
 'Wolf fangs':'Long yellow fangs. Some wear them for luck; traders buy them by the handful.',
 'Wolf pelt':'A grey wolf’s hide, rough-cured where it fell.',
 'Goblin trinkets':'A jumble of bright buttons, bent spoons and a cracked mirror, hoarded the way goblins hoard.',
 'Burial ring':'A tarnished ring taken from old bones. Someone was buried with it on purpose.',
 'Boar tusks':'Two curved ivory tusks, yellowed at the root.',
 'Boar meat':'Enough for a few hearty meals.',
 'Spider silk':'A tight bundle of strong, sticky silk. Rope-makers prize it.',
 'Venom sac':'A spider’s venom gland, carefully cut free. An apothecary pays well for it.',
 'Tarnished locket':'A small locket gone green with age, a lock of hair still inside.',
 'Fur mantle':'A shaggy mantle of stitched pelts, the sort a raider wears into battle.',
 'Small garnet':'A small, dark red gem.','Silver chalice':'A dented silver cup with a worn engraving.',
 'Moonstone':'A pale gem with a soft blue sheen.','Gilded icon':'A small painted icon framed in gold leaf.',
 'Star ruby':'A deep red gem with a six-rayed star of light inside it.','Black pearl':'A perfect pearl, black as a still night.',
 'Engraved silver armband':'A silver armband engraved with running hounds.','Gold-chased goblet':'A heavy goblet chased with gold vines.',
 'Jewelled circlet':'A slim circlet set with small bright stones.','Ancient gold crown':'A crown of soft old gold from a forgotten reign.',
};
const piece=(name,value,qty=1)=>({...treasure(name,value,spoilNotes[name]),qty});
const coinCarriers=['bandit','goblin','skeleton','zombies','orc'];
function creatureSpoils(template,count,L,T,random){
 const n=Math.max(1,count??1),out={gold:0,items:[],potions:0};
 const add=it=>out.items.push(it);
 if(template==='bandit'){out.gold=lootDice(2,6,random)+2*L;if(chance(.5,random))add({name:'Scimitar',kind:'weapon',qty:1});if(chance(.35,random))out.potions++;if(chance(.4,random))add(chance(.5,random)?piece('Silver cloak pin',5*T):piece('Stolen signet ring',10*T));}
 else if(template==='wolf'){add(piece('Dire wolf pelt',8));add(piece('Wolf fangs',1,lootDice(1,4,random)));}
 else if(template==='wolves'){add(piece('Wolf pelt',2,n));add(piece('Wolf fangs',1,lootDice(2,4,random)));}
 else if(template==='goblin'){for(let i=0;i<n;i++)out.gold+=lootDice(1,4,random);add(piece('Goblin trinkets',3));if(chance(.3,random))add({name:'Shortsword',kind:'weapon',qty:1});}
 else if(template==='skeleton'){out.gold=lootDice(1,10,random)+L;if(chance(.3,random))add(piece('Burial ring',15*T));if(chance(.25,random))add({name:'Shortsword',kind:'weapon',qty:1});}
 else if(template==='boar'){add(piece('Boar tusks',4,2));add({name:'Boar meat',kind:'gear',qty:1,note:spoilNotes['Boar meat']});}
 else if(template==='spider'){add(piece('Spider silk',6));if(chance(.5,random))add(piece('Venom sac',15));}
 else if(template==='zombies'){for(let i=0;i<n;i++)out.gold+=lootDice(1,6,random);if(chance(.4,random))add(piece('Tarnished locket',5));}
 else if(template==='orc'){out.gold=lootDice(2,6,random)+L;if(chance(.5,random))add({name:'Greataxe',kind:'weapon',qty:1});add(piece('Fur mantle',6));if(chance(.25,random))out.potions++;}
 if(coinCarriers.includes(template))out.gold*=T;
 return out;
}
const roleWeapons=[[/guard|soldier|captain|knight|mercenar|sergeant|warden|sentry/i,'Longsword'],[/hunter|scout|ranger|archer|trapper|forester/i,'Shortbow'],[/priest|acolyte|cleric|monk|friar|abbot/i,'Mace'],[/thief|smuggler|bandit|assassin|cutpurse|rogue|spy/i,'Dagger']];
function personSpoils(game,id,L,random){
 const toughness=game.people?.[id]?.toughness??'common',lore=npcLore(game,id)??{},out={gold:0,items:[],potions:0};
 out.gold=toughness==='frail'?lootDice(1,4,random):toughness==='tough'?lootDice(3,6,random)+L:lootDice(2,6,random);
 const weapon=roleWeapons.find(([re])=>re.test(String(lore.role??'')))?.[1]??(chance(.4,random)?'Dagger':null);
 if(weapon){out.items.push({name:weapon,kind:'weapon',qty:1});if(weapon==='Shortbow')out.items.push({name:'Arrow',kind:'ammunition',qty:lootDice(2,6,random)});}
 if(chance(toughness==='tough'?.3:.15,random))out.potions++;
 const first=String(lore.name??'').split(/\s+/).find(w=>w.length>=2&&!/^(the|old|young|captain|lady|lord|sir|dame|brother|sister|mother|father)$/i.test(w));
 if(first&&chance(.25,random))out.items.push(treasure(('Keepsake of '+first).slice(0,60),2,'A small thing they kept close: a carved token, a pressed flower, a letter worn soft.'));
 return out;
}
const hoardGems={1:[['Small garnet',10],['Silver chalice',25]],2:[['Moonstone',50],['Gilded icon',75]],3:[['Star ruby',250]],4:[['Black pearl',750]]};
const bossTreasure={1:['Engraved silver armband',25],2:['Gold-chased goblet',100],3:['Jewelled circlet',250],4:['Ancient gold crown',750]};
// A magic item at this rarity that suits the hero and that they do not already carry (draughts aside).
function magicPick(hero,pack,rarity,random,avoid=[]){
 const have=new Set((pack?.items??[]).map(i=>i.magic?.id).filter(Boolean));
 const pool=magicItemIds.filter(id=>magicItems[id].rarity===rarity&&!magicItems[id].heal&&!have.has(id)&&!avoid.includes(id)&&magicSuits(id,hero));
 if(!pool.length)return null;
 return pool[Math.floor(random()*pool.length)];
}
// The tale's foe always carries one remarkable thing: the story writer's hoard when its rarity fits the tier, else a
// weighted pick of what suits the looter, falling back to a magic weapon, then a cloak of protection.
export function bossItem(hero,game,tier,random=Math.random){
 const pack=packOf(game,hero),hoard=game.story?.hoard;
 if(hoard&&magicItems[hoard.item]&&!magicItems[hoard.item].heal&&rarityRank(magicItems[hoard.item].rarity)<=rarityRank(tierRarity(tier))&&magicSuits(hoard.item,hero)){
  const made=makeMagicItem(hoard.item,hero,{name:hoard.name,note:hoard.note});if(made)return made;
 }
 const rarity=rarityTier(tier,random);
 const id=magicPick(hero,pack,rarity,random)??magicPick(hero,pack,'uncommon',random)??(magicSuits('weapon+'+(rarityRank(rarity)+1),hero)?'weapon+'+(rarityRank(rarity)+1):'cloak-of-protection');
 return makeMagicItem(id,hero,id===hoard?.item?{name:hoard.name,note:hoard.note}:{})??makeMagicItem('cloak-of-protection',hero);
}
function lairHoard(hero,game,T,L,random){
 const out={gold:lootDice(4,10,random)*T+5*L,items:[],magic:[]};
 const gems=hoardGems[T],[name,value]=gems[Math.floor(random()*gems.length)];out.items.push(piece(name,value));
 if(chance(T<=1?.25:T===2?.35:.45,random)){const id=magicPick(hero,packOf(game,hero),rarityTier(Math.max(1,T-1),random),random);const made=id&&makeMagicItem(id,hero);if(made)out.magic.push(made);}
 return out;
}
function bossSpoils(hero,game,T,L,random){
 const out={gold:10*L+lootDice(2,10,random)*T,items:[],potions:0,magic:[]};
 const [name,value]=bossTreasure[T];out.items.push(piece(name,value));
 const item=bossItem(hero,game,T,random);if(item)out.magic.push(item);
 if(chance(.5,random)){const made=makeMagicItem(T<=1?'potion-greater-healing':'potion-superior-healing',hero);if(made)out.magic.push(made);}
 return out;
}
const listed=it=>(it.qty>1?it.qty+' × ':'')+it.name+(it.kind==='treasure'&&it.value?' (worth '+it.value+' gold'+(it.qty>1?' each':'')+')':'');
// Search the fallen (and any lair) where the hero stands: each entry is rolled once and then gone.
export function takeSpoils(game,health,hero,random=Math.random){
 const error=lootError(game,health);if(error)return {game,health,error};
 const here=spoilsHere(game),L=hero?.level??1,T=lootTier(L);
 let gold=0,potions=0;const items=[],magic=[],names=[];
 for(const s of here){
  const label=s.kind==='creature'?'the '+s.name.replace(/^the /i,'')+(s.count>1?' and the rest of its pack':''):s.name;
  names.push(label+(s.lair?' and its lair'+(s.feature?' ('+s.feature.replace(/\.$/,'')+')':''):''));
  const rolled=s.kind==='creature'?creatureSpoils(s.template,s.count,L,T,random):s.kind==='person'?personSpoils(game,s.person,L,random):bossSpoils(hero,game,T,L,random);
  gold+=rolled.gold;potions+=rolled.potions??0;items.push(...rolled.items);magic.push(...(rolled.magic??[]));
  if(s.lair){const h=lairHoard(hero,game,T,L,random);gold+=h.gold;items.push(...h.items);magic.push(...h.magic);}
 }
 // Like things found together are counted together; one magic item of a kind is enough.
 {const seen=new Set();for(let i=magic.length-1;i>=0;i--){const m=magic[i];if(m.kind==='potion')continue;if(seen.has(m.magic.id))magic.splice(i,1);else seen.add(m.magic.id);}}
 const merged=[];for(const it of items){const same=merged.find(m=>m.name===it.name&&m.kind===it.kind);if(same)same.qty+=it.qty;else merged.push({...it});}
 const lines=['You search '+names.join(', ')+'.'];
 const found=[...(gold>0?[gold+' gold']:[]),...(potions>0?[(potions>1?potions+' × ':'')+'Potion of Healing']:[]),...merged.map(listed),...magic.filter(m=>m.kind==='potion').map(m=>m.name)];
 lines.push('Found: '+(found.length?found.join(', '):'nothing of value')+'.');
 let pack=packOf(game,hero),drafts=game.potions??0;const left=[];
 pack={...pack,gold:Math.min(1e6,pack.gold+gold),items:pack.items.map(i=>({...i}))};
 drafts=Math.min(20,drafts+potions);
 for(const it of [...merged,...magic]){const put=packWith(pack,drafts,it,hero);if(put.error){left.push(it.name);continue;}pack=put.pack;drafts=put.potions;if(it.magic&&it.kind!=='potion')lines.push('Among the hoard: '+it.name+' ('+magicItems[it.magic.id].rarity+'): '+magicItems[it.magic.id].effect+(put.attuned?' You attune to it.':magicItems[it.magic.id].attune?' You can attune to it from your inventory (three attuned items at most).':''));}
 if(left.length)lines.push('Left behind (your pack is full): '+left.join(', ')+'.');
 const spoils=(game.spoils??[]).filter(s=>!here.includes(s));
 const next={...game,pack,potions:drafts,log:[...lines,...(game.log??[])].slice(0,40)};
 if(spoils.length)next.spoils=spoils;else delete next.spoils;
 next.journal=appendJournal(journalForGame(next),'note','Spoils',lines.join('\n').slice(0,3000));
 return {game:next,health,events:lines};
}
// Attune to a carried magic item (out of a fight). With three attuned already, the oldest attuned one gives way.
export function attuneItem(game,hero,name){
 const pack=packOf(game,hero),it=pack.items.find(i=>i.name===name);
 if(!it?.magic||!magicItems[it.magic.id]?.attune)return {error:'That item needs no attunement.'};
 if(it.attuned)return {error:'You are already attuned to it.'};
 if(game.stage==='combat'||game.npcCombat?.active)return {error:'Attuning takes a quiet hour: not in a fight.'};
 const items=pack.items.map(i=>({...i}));let dropped=null;
 if(attunedCount(pack)>=maxAttuned){const first=items.find(i=>i.attuned);delete first.attuned;dropped=first.name;}
 items.find(i=>i.name===name).attuned=true;
 return {game:{...game,pack:{...pack,items}},lines:['You attune to the '+name+'.'+(dropped?' The '+dropped+' goes quiet.':'')]};
}
// A wand's charge, a draught: what the hero's own magic gives them to use.
export const packMagic=(game,id)=>(game?.pack?.items??[]).find(i=>i.magic?.id===id&&(i.magic.charges===undefined||i.magic.charges>0));
export const carriedDraughts=game=>(game?.pack?.items??[]).filter(i=>i.kind==='potion'&&draughtIds.includes(i.magic?.id)&&i.qty>0);
// After a long rest each Wand of Magic Missiles regains 1d6 + 1 charges (at most 7).
export function rechargeWands(game,random){
 const items=game.pack?.items;if(!items?.some(i=>i.magic?.id==='wand-of-magic-missiles'))return {game,lines:[]};
 const lines=[];
 const next=items.map(i=>{if(i.magic?.id!=='wand-of-magic-missiles')return i;const back=lootDice(1,6,random)+1,charges=Math.min(7,(i.magic.charges??0)+back);if(charges>(i.magic.charges??0))lines.push('The '+i.name+' regains its charges ('+charges+').');return {...i,magic:{...i.magic,charges}};});
 return {game:{...game,pack:{...game.pack,items:next}},lines};
}
// What a magic item is, in a sentence or two (the inventory and the Dungeon Master read it).
export function magicSummary(item){
 const m=magicItems[item?.magic?.id];if(!m)return '';
 const charges=item.magic.charges!==undefined?' '+item.magic.charges+' of 7 charges left.':'';
 return m.name+(m.attune?' (requires attunement)':'')+': '+m.effect+charges;
}
export const rarityLabel=item=>{const m=magicItems[item?.magic?.id];return m?m.rarity[0].toUpperCase()+m.rarity.slice(1)+(m.attune?(item.attuned?' · attuned':' · not attuned'):''):null;};
// The hero's own scores as their magic sets them (Gauntlets of Ogre Power, a Headband of Intellect).
export const magicScores=(scores,magic)=>Object.fromEntries(Object.entries(scores??{}).map(([k,v])=>[k,Math.max(v,magic?.scores?.[k]??0)]));
