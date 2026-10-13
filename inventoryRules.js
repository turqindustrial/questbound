import {weapons,weaponAttacks,readyLoadout,shieldSlung,twoHanderInHand} from './weaponRules';
import {magicItems,magicEffects,magicScores,makeMagicItem,magicSuits,attunedCount,maxAttuned} from './lootRules';
// What the hero carries beyond their starting kit: gold, things found, bought or given, and arrows used up. The
// starting kit stays on the character; the adventure keeps the pack, so a found sword or a bought quiver of arrows
// can be fought with at once.
export const itemKinds=['weapon','armor','potion','ammunition','treasure','gear','quest'];
// Prices in gold (SRD), for the Dungeon Master's trades and for selling treasure at half value.
export const priceList={'Potion of Healing':50,Arrow:0.05,Dagger:2,Handaxe:5,Javelin:0.5,Mace:5,Quarterstaff:0.2,Sickle:1,Spear:1,Greataxe:30,Greatsword:50,Flail:10,Longsword:15,Battleaxe:10,Trident:5,Maul:10,Glaive:20,Halberd:20,Scimitar:25,Shortsword:10,Shortbow:25,Longbow:50};
const startingGold=hero=>Math.max(0,Math.floor(hero?.equipment?.totalGold??0));
export function packOf(game,hero){return game.pack??{gold:startingGold(hero),items:[],spent:{}};}
// A geared hero remembers its starting kit, so arrows are never counted twice.
const startingArrows=hero=>(hero?.equipment?.startingItems??hero?.equipment?.items??[]).filter(i=>i.name==='Arrow').reduce((a,i)=>a+i.quantity,0);
export function arrowsLeft(game,hero){const p=packOf(game,hero),bought=p.items.filter(i=>i.name==='Arrow').reduce((a,i)=>a+i.qty,0);return Math.max(0,startingArrows(hero)+bought-(p.spent?.Arrow??0));}
// The hero as the rules see them right now: starting kit plus weapons and arrows from the pack, minus arrows spent.
// The weapon the player chose to fight with (game.wield, set from the inventory) leads when they carry it.
// A magic weapon fights as its base kind ('Longsword +1' is a longsword) with its plus to attack and damage, and the
// hero's magic items (lootRules.js) set equipment.magic and lift their scores to an item's floor (Gauntlets of Ogre
// Power). The geared hero is never saved, so hit points stay those of the hero themselves.
export const weaponBaseOf=it=>it?.kind==='weapon'?(weapons[it.base]?it.base:weapons[it.name]?it.name:null):null;
export function gearedHero(base,game){
 // Shillelagh on the hero's club or quarterstaff (spellRules.js) changes how it strikes while it lasts.
 let hero=game?.buffs?.shillelagh&&base&&!base.shillelagh?{...base,shillelagh:game.buffs.shillelagh.ability}:base;
 // Aid raises the hero's hit point maximum while it lasts (spellRules.js; combatBasics reads hero.aid).
 if(hero&&game?.buffs?.aid?.amount>0&&!hero.aid)hero={...hero,aid:game.buffs.aid.amount};
 if((!game?.pack&&!game?.wield&&!game?.shieldAway)||!hero?.equipment||hero.equipment.startingItems)return hero;
 const items=(hero.equipment.items??[]).filter(i=>i.name!=='Arrow').map(i=>({...i}));
 for(const it of game.pack?.items??[]){const base=weaponBaseOf(it);if(!base)continue;const plus=it.magic?.plus??0,have=items.find(i=>i.name===it.name);if(have)have.quantity+=it.qty;else items.push({name:it.name,quantity:it.qty,...(base!==it.name?{base}:{}),...(plus?{plus}:{})});}
 // Weapons thrown in a fight and not yet gathered up are not in hand.
 for(const [name,n] of Object.entries(game.pack?.spent??{}))if(name!=='Arrow'){const have=items.find(i=>i.name===name);if(have)have.quantity=Math.max(0,have.quantity-n);}
 const arrows=arrowsLeft(game,hero);if(arrows>0)items.push({name:'Arrow',quantity:arrows});
 const geared={...hero,equipment:{...hero.equipment,items,startingItems:hero.equipment.items,...(game.wield?{wield:game.wield}:{}),...(game.shieldAway===true?{shieldAway:true}:{})}};
 const magic=magicEffects(geared,game.pack);
 if(magic.any){geared.equipment.magic=magic;if(Object.keys(magic.scores).length&&hero.scores)geared.scores=magicScores(hero.scores,magic);}
 return geared;
}
// The shield by choice (the host, 2026-10-12: "a shield bearer should be able to put the shield away to hold their
// weapon with 2 hands, they should make that decision before engagement in the equipment screen or specifically request
// it themselves"): `away` puts it on the back (game.shieldAway), so both hands are free and a versatile weapon is held
// in both for its larger die, at the cost of the shield's armor class and any magic in it; the weapon in hand stays
// in hand (game.wield), or the one named. Taken up again, the shield goes back on the arm, and a two-handed weapon in
// hand goes on the back. Out of a fight it is free; in one it is the hero's action (the rules make donning or doffing
// a shield an action), which the engine accounts for (adventureRules.js heroStep). Returns {game, line} or {error}.
export function setShield(game,hero,away,weapon=null){
 const geared=gearedHero(hero,game);
 if(!(geared?.equipment?.items??[]).some(i=>i.name==='Shield'&&i.quantity>0))return {error:'You carry no shield.'};
 if(away){
  if(shieldSlung(geared))return {error:'Your shield is already on your back.'};
  const all=weaponAttacks(geared),named=weapon?all.find(w=>w.name.toLowerCase()===String(weapon).toLowerCase()||(w.base??'').toLowerCase()===String(weapon).toLowerCase()):null;
  if(weapon&&!named)return {error:'You carry no '+String(weapon).toLowerCase()+'.'};
  if(named?.ranged)return {error:'Name the close-range weapon to hold in both hands.'};
  const keep=named?.name??(twoHanderInHand(geared)?geared.equipment.wield:readyLoadout(geared).mainWeapon),held=all.some(w=>w.name===keep)?keep:null;
  const next={...game,shieldAway:true,...(held?{wield:held}:{})},now=weaponAttacks(gearedHero(hero,next)).find(w=>w.name===held);
  const line=now?.versatile?'You sling your shield on your back and grip your '+now.name+' in both hands: 1d'+now.die+' in place of 1d'+now.oneHandDie+', and your shield adds nothing to your armor class.':'You sling your shield on your back. Both hands are free'+(now?' for your '+now.name:'')+', and your shield adds nothing to your armor class.';
  return {game:next,line};
 }
 if(!shieldSlung(geared))return {error:'Your shield is already on your arm.'};
 const next={...game};delete next.shieldAway;
 if(twoHanderInHand(geared))delete next.wield;
 const after=gearedHero(hero,next);
 if(shieldSlung(after))return {error:'You have no one-handed weapon to fight with beside a shield.'};
 const main=weaponAttacks(after).find(w=>!w.ranged&&!w.blocked);
 return {game:next,line:'You take your shield up on your arm'+(main?.versatile?': your '+main.name+' is back in one hand (1d'+main.die+').':'.')};
}
// A bow shot uses an arrow.
export function spendArrow(game,hero){const p=packOf(game,hero);return {...game,pack:{...p,spent:{...p.spent,Arrow:(p.spent?.Arrow??0)+1}}};}
// A throw leaves the weapon where it landed until the fight is over.
export function spendThrown(game,hero,name){const p=packOf(game,hero);return {...game,pack:{...p,spent:{...p.spent,[name]:(p.spent?.[name]??0)+1}}};}
// After the fight: every thrown weapon is gathered up again (arrows stay spent). Null when nothing was thrown.
export function gatherThrown(game){
 const spent=game.pack?.spent??{},names=Object.keys(spent).filter(k=>k!=='Arrow'&&spent[k]>0);if(!names.length)return null;
 const kept=spent.Arrow!==undefined?{Arrow:spent.Arrow}:{};
 return {game:{...game,pack:{...game.pack,spent:kept}},line:'You gather up your thrown '+names.map(n=>n.toLowerCase()+(spent[n]>1?'s':'')).join(' and ')+'.'};
}
const lootText=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const knownWeapon=name=>Object.keys(weapons).find(w=>w.toLowerCase()===String(name??'').trim().toLowerCase())??null;
// A weapon named with its plus ('+1 Longsword', 'Longsword +1', 'longsword, +2'): its kind and the plus.
function plusWeapon(name){
 const text=String(name).trim(),front=text.match(/^\+([1-3])\s+(.+)$/),back=text.match(/^(.+?),?\s+\+([1-3])$/);
 const [plus,rest]=front?[front[1],front[2]]:back?[back[2],back[1]]:[null,null];
 const base=rest?knownWeapon(rest):null;
 return base?{base,plus:Number(plus)}:null;
}
const draughtNamed=name=>/potion/i.test(name)&&/heal/i.test(name)?(/supreme/i.test(name)?'potion-supreme-healing':/superior/i.test(name)?'potion-superior-healing':/greater/i.test(name)?'potion-greater-healing':'healing'):null;
// Normalise what the Dungeon Master hands over: known weapon names, healing potions (an ordinary one becomes a
// draught; greater, superior and supreme ones keep their strength), arrows. A weapon the game does not know is carried
// as gear rather than refused. A magic item (an id from the catalogue) is built from the catalogue: a magic weapon
// takes the kind its name gives, else the hero's main weapon's, and keeps the name the Dungeon Master gave it.
function normalise(it,hero){
 const name=String(it.name??'').trim(),magicId=typeof it.magic==='string'?it.magic:it.magic?.id??null;
 const plain={...it,name};delete plain.magic;
 if(magicId&&magicItems[magicId]&&!magicItems[magicId].heal&&it.qty>0){
  const named=plusWeapon(name),inName=Object.keys(weapons).find(w=>new RegExp('\\b'+w+'\\b','i').test(name))??null;
  const base=magicId.startsWith('weapon+')?named?.base??inName:null;
  const own=named||knownWeapon(name)||name.toLowerCase()===magicItems[magicId].name.toLowerCase()?null:name;
  const made=makeMagicItem(magicId,hero,{name:own,note:it.note,base});
  if(made)return made;
 }
 const draught=draughtNamed(name)??(magicId&&magicItems[magicId]?.heal?magicId:null);
 if(draught==='healing')return {...plain,name:'Potion of Healing',kind:'potion'};
 if(draught)return {...plain,name:magicItems[draught].name,kind:'potion',magic:{id:draught}};
 if(/^arrows?$/i.test(name))return {...plain,name:'Arrow',kind:'ammunition'};
 // A weapon given or taken by name; a '+1' with no magic behind it is an ordinary one of its kind.
 const weapon=knownWeapon(name)??plusWeapon(name)?.base;if(weapon)return {...plain,name:weapon,kind:'weapon'};
 // Something carried away by name ("I sell the cloak") is matched to what the hero carries, magic or not.
 return {...plain,kind:plain.kind==='weapon'?'gear':plain.kind};
}
// One item into the pack (or a healing draught into the draughts carried). Returns {pack, potions, line, attuned} or
// {error}. A magic item that needs attunement is attuned at once while fewer than three are and it suits the hero.
export function packWith(pack,potions,it,hero){
 if(it.kind==='potion'&&!it.magic){if(potions+it.qty<0)return {error:'You do not have that many potions.'};const now=Math.min(20,potions+it.qty);return {pack,potions:now,line:it.qty>0?`You gain ${it.qty} ${it.name}${it.qty>1?'s':''} (${now} carried).`:`You give up ${-it.qty} ${it.name}${it.qty<-1?'s':''}.`};}
 const items=pack.items.map(i=>({...i})),have=items.find(i=>i.name.toLowerCase()===it.name.toLowerCase());
 if(it.qty<0){if(!have||have.qty+it.qty<0)return {error:'You do not have '+it.name+' to give up.'};have.qty+=it.qty;return {pack:{...pack,items:items.filter(i=>i.qty>0)},potions,line:`You give up ${-it.qty} × ${have.name}.`};}
 // What the Dungeon Master said the thing is travels with it (the first telling is kept).
 const note=typeof it.note==='string'&&it.note.trim()?it.note.trim().slice(0,160):null;
 let attuned=false;
 if(have){
  if((it.magic?.id??null)!==(have.magic?.id??null)||have.kind!==it.kind)return {error:'You already carry something called '+have.name+'.'};
  if(it.magic&&!magicItems[it.magic.id]?.heal&&it.kind!=='weapon')return {error:'You already carry the '+have.name+'.'};
  have.qty+=it.qty;if(note&&!have.note)have.note=note;
 } else {
  if(items.length>=40)return {error:'Your pack is full.'};
  const entry={name:it.name.trim(),kind:it.kind,qty:it.qty,...(it.value!==undefined?{value:Math.round(it.value*100)/100}:{}),...(note?{note}:{}),...(it.base?{base:it.base}:{}),...(it.magic?{magic:{...it.magic}}:{})};
  const m=it.magic&&magicItems[it.magic.id];
  if(m?.attune&&attunedCount({items})<maxAttuned&&magicSuits(it.magic.id,hero)){entry.attuned=true;attuned=true;}
  items.push(entry);
 }
 return {pack:{...pack,items},potions,attuned,line:`You gain ${it.qty>1?it.qty+' × ':''}${it.name}${it.kind==='treasure'&&it.value?' (worth '+it.value+' gold)':''}.`};
}
// Gold found, earned or paid, and items gained or given up, in one bounded change. Returns {game, lines} or {error}.
export function applyLoot(game,hero,loot){
 if(!loot||typeof loot!=='object')return {error:'Nothing changed hands.'};
 const gold=loot.gold??0,raw=loot.items??[],level=hero?.level??1;
 if(!Number.isInteger(gold)||gold>40*level+60||gold<-5000)return {error:'That amount of gold is not plausible here.'};
 if(!Array.isArray(raw)||raw.length>4||!raw.every(it=>it&&lootText(it.name,60)&&itemKinds.includes(it.kind)&&Number.isInteger(it.qty)&&it.qty!==0&&Math.abs(it.qty)<=40&&(it.value==null||(Number.isFinite(it.value)&&it.value>=0&&it.value<=5000))))return {error:'Those items were not described clearly enough.'};
 const items=raw.map(it=>{const clean={...it};if(clean.value==null)delete clean.value;if(clean.note==null)delete clean.note;return normalise(clean,hero);});
 let pack=packOf(game,hero),potions=game.potions??0;const lines=[];
 if(pack.gold+gold<0)return {error:'You do not have enough gold.'};
 pack={...pack,gold:pack.gold+gold,items:pack.items.map(i=>({...i}))};
 if(gold>0)lines.push(`You gain ${gold} gold (now ${pack.gold}).`);if(gold<0)lines.push(`You pay ${-gold} gold (${pack.gold} left).`);
 for(const it of items){
  const put=packWith(pack,potions,it,hero);if(put.error)return {error:put.error};
  pack=put.pack;potions=put.potions;lines.push(put.line);
  if(put.attuned)lines.push('You attune to the '+it.name+'.');
 }
 pack.items=pack.items.filter(i=>i.qty>0);
 return {game:{...game,pack,potions},lines};
}
// A carried magic item is one of the catalogue's, with its plus and charges as the catalogue says.
function validMagic(i){
 if(i.magic===undefined)return i.attuned===undefined&&i.kind!=='potion';
 const m=i.magic&&typeof i.magic==='object'&&magicItems[i.magic.id];
 if(!m||Object.keys(i.magic).some(k=>!['id','plus','charges'].includes(k)))return false;
 if(m.plus!==i.magic.plus)return false;
 if(m.charges?!(Number.isInteger(i.magic.charges)&&i.magic.charges>=0&&i.magic.charges<=m.charges):i.magic.charges!==undefined)return false;
 if(i.attuned!==undefined&&(i.attuned!==true||!m.attune))return false;
 if(m.heal)return i.kind==='potion'&&i.base===undefined;
 if(i.magic.id.startsWith('weapon+'))return i.kind==='weapon'&&!!i.base;
 if(i.magic.id.startsWith('armor+'))return i.kind==='armor'&&!!i.base&&i.base!=='Shield';
 if(i.magic.id.startsWith('shield+'))return i.kind==='armor'&&i.base==='Shield';
 return i.kind===m.kind&&i.base===undefined&&i.qty===1;
}
const armourNames=['Chain Mail','Chain Shirt','Studded Leather Armor','Leather Armor','Shield'];
export function validPack(p){
 if(p===undefined)return true;
 const baseOf=k=>{const it=Array.isArray(p?.items)?p.items.find(i=>i?.name===k):null;return it?.base??String(k).replace(/ \+[1-3]$/,'');};
 return !!p&&Number.isInteger(p.gold)&&p.gold>=0&&p.gold<=1e6&&Array.isArray(p.items)&&p.items.length<=40&&new Set(p.items.map(i=>i?.name?.toLowerCase())).size===p.items.length&&p.items.every(i=>i&&lootText(i.name,60)&&itemKinds.includes(i.kind)&&Number.isInteger(i.qty)&&i.qty>=1&&i.qty<=999&&(i.value===undefined||(Number.isFinite(i.value)&&i.value>=0&&i.value<=5000))&&(i.note===undefined||lootText(i.note,160))
  &&(i.base===undefined||(i.kind==='weapon'?!!weapons[i.base]:i.kind==='armor'&&armourNames.includes(i.base)))&&(i.kind!=='weapon'||!!weapons[i.base??i.name])&&validMagic(i))
  &&p.items.filter(i=>i.attuned).length<=maxAttuned
  &&!!p.spent&&typeof p.spent==='object'&&Object.entries(p.spent).every(([k,v])=>(k==='Arrow'||/^Thrown\b/.test(weapons[baseOf(k)]?.range??''))&&Number.isInteger(v)&&v>=0&&v<=10000);
}
// A healing draught for someone else: it brings round a companion lying senseless.
export function potionHealing(random){const a=1+Math.floor(random()*4),b=1+Math.floor(random()*4);return {a,b,total:a+b+2};}
